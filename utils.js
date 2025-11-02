// utils.js

// UI 유틸리티 (showToast, renderChart 등)

const pages = ['mainPage', 'studentPage', 'friendsPage', 'teacherLogin', 'teacherDashboard', 'studentReportPage', 'studentLogin', 'noteToTeacherPage']; 
const tooltip = document.getElementById('tooltip');
const toastEl = document.getElementById('toast');

function showToast(message, actionText = null, actionCallback = null, expiryCallback = null) {
    clearTimeout(toastTimeout);
    clearTimeout(undoTimeout);
    
    const toastContent = `<span>${message}</span>`;
    const undoButton = actionText && actionCallback ? `<button id="undoButton" class="ml-4 font-bold underline text-blue-800">${actionText}</button>` : '';
    
    toastEl.innerHTML = toastContent + undoButton;
    toastEl.classList.remove('hidden', 'opacity-0');
    
    if (actionCallback) {
        document.getElementById('undoButton')?.addEventListener('click', () => {
            clearTimeout(toastTimeout);
            clearTimeout(undoTimeout);
            actionCallback(); 
        });

        undoTimeout = setTimeout(() => {
            if (expiryCallback) {
                expiryCallback();  
            }
        }, 5000); 
    }

    const hideDelay = actionCallback ? 5500 : 3000;
    toastTimeout = setTimeout(() => {
        toastEl.classList.add('opacity-0');
        setTimeout(() => toastEl.classList.add('hidden'), 300);
    }, hideDelay);
}

function renderChart(canvasId, type, data, options) {
    let canvasElement = null;
    if (typeof canvasId === 'string') {
         canvasElement = document.getElementById(canvasId);
         if (!canvasElement && document.querySelector(canvasId)) {
             canvasElement = document.querySelector(canvasId);
         }
    } else if (canvasId instanceof HTMLCanvasElement) {
        canvasElement = canvasId;
    }

    if (!canvasElement) { console.error("Canvas element not found for:", canvasId); return; }

    const chartKey = canvasElement.id ? canvasElement.id : canvasElement.dataset.chartId || (canvasElement.dataset.chartId = `chart-${Math.random()}`);
    if (chartInstances[chartKey]) chartInstances[chartKey].destroy();
    const ctx = canvasElement.getContext('2d');
    chartInstances[chartKey] = new Chart(ctx, { type, data, options });
}

// --- 페이지 관리 ---
function showPage(pageId) {
    pages.forEach(p => {
        const el = document.getElementById(p);
        if(el) {
             el.classList.add('hidden');
             el.classList.remove('fade-in'); 
        }
    });
    
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.remove('hidden');
        targetPage.classList.add('fade-in'); 
    } else {
         console.error("Target page element not found for:", pageId);
         return;
    }

    window.scrollTo(0, 0);
    
    if (pageId === 'friendsPage') {
        syncDataFromGAS(true).then(() => {
            renderFloatingEmotions();
        });
    }
    if (pageId === 'teacherDashboard') renderTeacherDashboard();
    if (pageId === 'studentLogin' || pageId === 'studentPage' || pageId === 'noteToTeacherPage') {
        populateForms(); 
    }
}

// 삭제 관련 유틸리티
function undoDelete() {
    if (!lastDeletedEntry) return;
    allDataCache.push(lastDeletedEntry);
    allDataCache.sort((a, b) => a.date.localeCompare(b.date));
    saveDataLocally(allDataCache);
    refreshAfterDelete();
    showToast('삭제가 취소되었습니다.');
    lastDeletedEntry = null; 
    clearTimeout(undoTimeout); 
}
function refreshAfterDelete() {
    if (!document.getElementById('teacherDashboard').classList.contains('hidden') &&
        document.getElementById('dailyTab').classList.contains('active')) {
        renderDailyReport();
        renderStudentListForDashboard();
    } else if (!document.getElementById('studentReportPage').classList.contains('hidden') && currentStudentForReport) {
         renderStudentReport(currentStudentForReport); 
    }
}
async function deleteEntry(id) {
    const idStr = String(id); 
    if (!idStr) { showToast("삭제 오류: ID가 비어 있습니다."); return; }
    
    const btn = document.querySelector(`button[data-id="${idStr}"]`);
    if (btn) { btn.disabled = true; btn.textContent = '...'; }

    const entryIndex = allDataCache.findIndex(e => String(e.id) === idStr);
    if (entryIndex === -1) { showToast('삭제 오류: 해당 기록을 찾을 수 없습니다.'); return; }

    lastDeletedEntry = allDataCache.splice(entryIndex, 1)[0];
    saveDataLocally(allDataCache);
    refreshAfterDelete();

    showToast('기록이 삭제되었습니다.', '되돌리기', () => undoDelete(), () => confirmDelete());
}
async function confirmDelete() {
    if (!lastDeletedEntry) return; 
    const entryToDelete = lastDeletedEntry;
    lastDeletedEntry = null; 
    if (entryToDelete.synced === true) {
        try {
            const res = await fetch(GAS_URL, {
                method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
                body: JSON.stringify({ action: 'delete', id: entryToDelete.id, id_numeric: (String(entryToDelete.id).match(/\d+/)?.[0] ?? null) }) 
            });
            const txt = await res.text();
            let result;
            try { 
                if (!txt) throw new Error("EMPTY_RESPONSE");
                result = JSON.parse(txt); 
            } catch { 
                result = {}; 
            }
            if (res.ok && result.status === 'success') { console.log('Server delete successful.'); } 
            else { enqueuePendingDelete(entryToDelete.id); }
        } catch (err) {
            enqueuePendingDelete(entryToDelete.id);
        }
    }
}
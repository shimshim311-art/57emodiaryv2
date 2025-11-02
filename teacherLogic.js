// teacherLogic.js

// 교사 관련 로직 (대시보드, 교사 로그인, 로그아웃)

function handleTeacherLogin(e) { 
    if (e && e.preventDefault) {
        e.preventDefault(); 
    }
    
    const pw = document.getElementById('teacherPassword'); 
    if (pw.value === TEACHER_PASSWORD) { 
        document.getElementById('loginError').classList.add('hidden'); 
        pw.value = ''; 
        showPage('teacherDashboard'); 
    } else { 
        document.getElementById('loginError').classList.remove('hidden'); 
    } 
    return false; 
}

function logoutTeacher() { 
    showPage('mainPage'); 
}

function renderTeacherDashboard() {
    const datePicker = document.getElementById('dashboardDate');
    const monthPicker = document.getElementById('dashboardMonth');
    datePicker.value = datePicker.value || getTodayDateString();
    const today = new Date();
    monthPicker.value = monthPicker.value || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    if (!datePicker.dataset.listenerAttached) {
         datePicker.addEventListener('change', () => {
             renderDailyReport();
             renderStudentListForDashboard();
         });
         datePicker.dataset.listenerAttached = 'true';
    }
    if (!monthPicker.dataset.listenerAttached) {
        monthPicker.addEventListener('change', renderMonthlyReport);
        monthPicker.dataset.listenerAttached = 'true';
    }


    switchDashboardTab(document.querySelector('.tab-button.active')?.id === 'monthlyTab' ? 'monthly' : 
                         document.querySelector('.tab-button.active')?.id === 'notesTab' ? 'notes' : 'daily');
    if (document.querySelector('.tab-button.active')?.id !== 'notesTab') {
         renderStudentListForDashboard();
    }
}

function switchDashboardTab(tab) {
    document.getElementById('dailyTab').classList.toggle('active', tab === 'daily');
    document.getElementById('monthlyTab').classList.toggle('active', tab === 'monthly');
    document.getElementById('notesTab').classList.toggle('active', tab === 'notes'); 

    document.getElementById('dailyReportContent').classList.toggle('hidden', tab !== 'daily');
    document.getElementById('monthlyReportContent').classList.toggle('hidden', tab !== 'monthly');
    document.getElementById('notesContent').classList.toggle('hidden', tab !== 'notes'); 

    document.getElementById('dashboardDate').classList.toggle('hidden', tab !== 'daily');
    document.getElementById('dashboardMonth').classList.toggle('hidden', tab !== 'monthly');

    if (tab === 'daily') {
         renderDailyReport();
         renderStudentListForDashboard();
    }
    if (tab === 'monthly') renderMonthlyReport();
    if (tab === 'notes') renderTeacherNotes(); 
}

function handleListClick(e) {
    if (e.target.classList.contains('delete-btn')) {
        const rawId = e.target.dataset.id; 
        deleteEntry(rawId); 
    }
}

function renderDailyReport() {
    const selectedDate = document.getElementById('dashboardDate').value;
    document.getElementById('dailyDistributionTitle').textContent = `${selectedDate} 감정 분포`;
    document.getElementById('dailyEntriesTitle').textContent = `${selectedDate}의 기록`;

    const dailyData = getAllData().filter(d => d.date === selectedDate);
    const categoryCounts = { positive: 0, negative: 0, neutral: 0 };
    dailyData.forEach(entry => categoryCounts[getEmotionType(entry.emotion, entry)]++);

    document.getElementById('todaySubmissionCount').textContent = `${dailyData.length} / ${STUDENT_NUMBERS.length}`;
    document.getElementById('todayPositiveCount').textContent = categoryCounts.positive;
    document.getElementById('todayNegativeCount').textContent = categoryCounts.negative;

    renderChart('dailyDistributionChart', 'pie', { labels: ['긍정', '부정', '중립'], datasets: [{ data: Object.values(categoryCounts), backgroundColor: ['#4CAF50', '#F44336', '#FFC107'] }] }, { responsive: true, maintainAspectRatio: false });

    const listContainer = document.getElementById('dailyEntriesList');
    listContainer.innerHTML = dailyData.length ? '' : '<p class="text-gray-500">선택한 날짜에 기록이 없습니다.</p>';
    dailyData.forEach(entry => {
        listContainer.innerHTML += `
         <div class="border-b pb-3 flex items-center">
           <div class="flex-grow">
             <p class="font-bold">${entry.emoji} ${entry.studentNumber}번 - <span class="font-medium">${entry.emotion}</span></p>
             <p class="text-sm text-gray-600 pl-7">${entry.reason}</p>
           </div>
           <button data-id="${String(entry.id)}"
                   class="delete-btn bg-red-100 text-red-600 hover:bg-red-200 text-xs font-bold py-1 px-2 rounded-md">
             삭제
           </button>
         </div>`;
    });

    listContainer.removeEventListener('click', handleListClick); 
    listContainer.addEventListener('click', handleListClick);

    renderStudentListForDashboard();
}

function renderMonthlyReport() {
    const monthString = document.getElementById('dashboardMonth').value;
    const [year, month] = monthString.split('-').map(Number);
    const monthData = getAllData().filter(d => d.date.startsWith(monthString));

    const daysInMonth = new Date(year, month, 0).getDate();
    const categoryCounts = { positive: 0, negative: 0, neutral: 0 };
    monthData.forEach(entry => categoryCounts[getEmotionType(entry.emotion, entry)]++);

    document.getElementById('monthlyPositiveCount').textContent = categoryCounts.positive;
    document.getElementById('monthlyNeutralCount').textContent = categoryCounts.neutral;
    document.getElementById('monthlyNegativeCount').textContent = categoryCounts.negative;

    renderChart('monthlyDistributionChart', 'doughnut', { labels: ['긍정', '부정', '중립'], datasets: [{ data: Object.values(categoryCounts), backgroundColor: ['#4CAF50', '#F44336', '#FFC107'] }] }, { responsive: true, maintainAspectRatio: false });

    const dailyTrends = Array(daysInMonth).fill(null).map((_, i) => {
        const dayStr = `${monthString}-${String(i + 1).padStart(2, '0')}`;
        const dayData = monthData.filter(d => d.date === dayStr);
        if (!dayData) return null;
        const category = getEmotionType(dayData.emotion, dayData);
        if (category === 'positive') return 1;
        if (category === 'negative') return -1;
        return 0;
    });

    renderChart('monthlyTrendChart', 'bar', {
        labels: Array(daysInMonth).fill(null).map((_, i) => i + 1),
        datasets: [
            { label: '긍정', data: dailyTrends.map(d => d.positive), backgroundColor: '#4CAF50' },
            { label: '중립', data: dailyTrends.map(d => d.neutral), backgroundColor: '#FFC107' },
            { label: '부정', data: dailyTrends.map(d => d.negative), backgroundColor: '#F44336' }
        ]
    }, { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true, title: { display: true, text: `${month}월` } }, y: { stacked: true, max: 100, ticks: { callback: (value) => value + '%' } } } });
}

function renderStudentListForDashboard() {
    const studentLinksContainer = document.getElementById('studentReportLinks');
    if (!studentLinksContainer) return;

    studentLinksContainer.innerHTML = '';
    const selectedDate = document.getElementById('dashboardDate').value;
    const submittedStudents = getAllData()
        .filter(d => d.date === selectedDate)
        .map(d => d.studentNumber); 

    STUDENT_NUMBERS.sort((a,b) => parseInt(a) - parseInt(b)).forEach(num => { 
         const submitted = submittedStudents.includes(num);
         const buttonClass = submitted
             ? 'bg-blue-200 hover:bg-blue-300 text-blue-800'
             : 'bg-gray-100 hover:bg-gray-200 text-gray-700';
         renderStudentReport(num, true);
         studentLinksContainer.innerHTML += `<button onclick="renderStudentReport('${num}', true)" class="${buttonClass} font-medium py-2 px-3 rounded-lg transition">${num}번</button>`;
    });
}

async function refreshDashboardData() {
    const success = await syncDataFromGAS(true); 
    if (success) {
        renderTeacherDashboard(); 
        showToast("대시보드가 최신 기록으로 새로고침되었습니다."); 
    }
}

async function renderTeacherNotes() {
    const listContainer = document.getElementById('notesList');
    const errorEl = document.getElementById('notesLoadingError');
    listContainer.innerHTML = '<div class="text-center py-10"><div class="loader mx-auto"></div><p class="text-gray-600 mt-4">쪽지 불러오는 중...</p></div>';
    errorEl.classList.add('hidden');

    try {
        const response = await fetch(GAS_URL + '?action=readNotes', { mode: 'cors' });
        const result = await response.json();

        if (response.ok && Array.isArray(result)) {
            listContainer.innerHTML = '';
            
            if (result.length === 0) {
                listContainer.innerHTML = '<p class="text-gray-500 text-center py-10">도착한 쪽지가 없습니다.</p>';
                return;
            }

            result.slice().reverse().forEach(note => {
                const timestamp = new Date(note.timestamp).toLocaleString('ko-KR', { 
                    year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' 
                });

                listContainer.innerHTML += `
                    <div class="bg-gray-50 p-4 rounded-xl shadow-md border border-gray-200">
                        <div class="flex justify-between items-start mb-2 border-b pb-2">
                            <span class="font-bold text-lg text-gray-800">💌 ${note.name}번 학생</span>
                            <span class="text-xs text-gray-500">${timestamp}</span>
                        </div>
                        <p class="text-gray-700 whitespace-pre-wrap">${note.content}</p>
                    </div>
                `;
            });
        } else {
            listContainer.innerHTML = '';
            errorEl.classList.remove('hidden');
        }

    } catch (error) {
        listContainer.innerHTML = '';
        errorEl.classList.remove('hidden');
        errorEl.textContent = "서버 통신 오류: 쪽지를 불러올 수 없습니다.";
    }
}
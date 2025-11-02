// reportLogic.js

// 리포트 렌더링 및 AI 조언 로직

async function callGeminiAPI(prompt) {
    if (!API_KEY) { console.log("Gemini API key is not set."); return null; }
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${API_KEY}`;
    // ... (이전의 callGeminiAPI 함수 내용) ...
    try {
        let response;
        let delay = 1000;
        for (let i = 0; i < 5; i++) {
            response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
            if (response.ok) break;
            if (response.status === 429 || response.status >= 500) {
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2;
            } else {
                return null;
            }
        }
        if (!response.ok) { return null; }
        const result = await response.json();
        return result.candidates?.[0]?.content?.parts?.[0]?.text.trim() || null;
    } catch (error) { return null; }
}


async function renderStudentReportContent(containerSelector, studentNumber, monthString) {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    const studentAllData = getAllData().filter(d => d.studentNumber === studentNumber);
    const studentMonthData = studentAllData.filter(d => d.date.startsWith(monthString));
    
    // 월 표시 업데이트
    const yearMonth = monthString.split('-').map(s => parseInt(s));
    const monthTitle = `${yearMonth[0]}년 ${yearMonth[1]}월`;
    container.querySelector('#candyJarTitle').textContent = `🍬 감정 사탕 병 (${monthTitle})`;
    container.querySelector('#monthlyRecordsTitle').textContent = `${monthTitle}의 전체 기록`;

    // 통계 계산 (선택된 달의 기록만 사용)
    const totalMonthRecords = studentMonthData.length; 
    const totalAllRecords = studentAllData.length; // 전체 기록 수는 따로 표시
    const categoryCounts = { positive: 0, negative: 0, neutral: 0 };
    studentMonthData.forEach(entry => categoryCounts[getEmotionType(entry.emotion, entry)]++);

    // 1. 통계 요약 섹션 업데이트
    container.querySelector('#myTotalRecords').textContent = totalMonthRecords; 
    container.querySelector('#myPositiveCount').textContent = categoryCounts.positive;
    container.querySelector('#myNeutralCount').textContent = categoryCounts.neutral;
    container.querySelector('#myNegativeCount').textContent = categoryCounts.negative;
    
    // 2. 차트 렌더링
    renderChart(container.querySelector('#myEmotionChart'), 'doughnut', { labels: ['긍정', '부정', '중립'], datasets: [{ data: Object.values(categoryCounts), backgroundColor: ['#4CAF50', '#F44336', '#FFC107'] }] }, { responsive: true, maintainAspectRatio: false });

    const [year, month] = monthString.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const dailyTrends = Array(daysInMonth).fill(null).map((_, i) => {
        const dayStr = `${monthString}-${String(i + 1).padStart(2, '0')}`;
        const dayData = studentMonthData.find(d => d.date === dayStr); 
        if (!dayData) return null;
        const category = getEmotionType(dayData.emotion, dayData);
        if (category === 'positive') return 1;
        if (category === 'negative') return -1;
        return 0;
    });

    renderChart(container.querySelector('#myTrendChart'), 'line', {
        labels: Array(daysInMonth).fill(null).map((_, i) => i + 1),
        datasets: [{
            label: '감정 변화', data: dailyTrends, borderColor: '#667eea', backgroundColor: '#667eea20', fill: true, tension: 0.1, spanGaps: true
        }]
    }, { responsive: true, maintainAspectRatio: false, scales: { x: { title: { display: true, text: `${month}월` } }, y: { ticks: { callback: (v) => { if (v === 1) return '긍정'; if (v === -1) return '부정'; if (v === 0) return '중립'; return null; } }, min: -1.5, max: 1.5 } } });

    // 3. 자주 느끼는 감정 TOP 5 (선택된 달 기준)
    const topEmotionsContainer = container.querySelector('#myTopEmotions');
    topEmotionsContainer.innerHTML = '';
    
    const emotionCountsMonth = studentMonthData.reduce((acc, curr) => { 
        acc[curr.emotion] = (acc[curr.emotion] || 0) + 1; 
        return acc; 
    }, {});
    const sortedEmotions = Object.entries(emotionCountsMonth).sort((a, b) => b[1] - a[1]).slice(0, 5);

    if (sortedEmotions.length > 0) {
        sortedEmotions.forEach(([emotion, count], index) => {
            const emoji = studentAllData.find(d => d.emotion === emotion)?.emoji || DEFAULT_EMOJIS[getEmotionType(emotion)];
            topEmotionsContainer.innerHTML += `<div class="flex items-center justify-between text-gray-700 border-b pb-2"><span>${index + 1}. ${emoji} ${emotion}</span><span class="font-bold">${count}회</span></div>`;
        });
    } else {
        topEmotionsContainer.innerHTML = '<p class="text-gray-500">기록이 없습니다.</p>';
    }

    // 4. 감정 사탕 병 (선택된 달 기록만)
    const candyContainer = container.querySelector('#candyContainer');
    candyContainer.innerHTML = '';
    
    if (studentMonthData.length > 0) {
        const jarVisualWidth = 400 * 1.09; 
        const jarVisualHeight = 500 * 1.09; 
        const candySize = 126; 
        const offsetX = (candyContainer.offsetWidth - jarVisualWidth) / 2;
        const offsetY = (candyContainer.offsetHeight - jarVisualHeight) / 2;
        const stackWidth = candySize * 0.7; 
        const maxCandiesPerRow = Math.floor((jarVisualWidth * 0.8) / stackWidth); 
        const stackHeight = candySize * 0.3;

        studentMonthData.forEach((entry, index) => {
            const candy = document.createElement('div');
            candy.className = `w-28 h-28 rounded-full flex items-center justify-center text-7xl absolute falling-candy`; 
            candy.textContent = entry.emoji;
            candy.title = `${entry.date}: ${entry.emotion}`;
            const row = Math.floor(index / maxCandiesPerRow);
            const col = index % maxCandiesPerRow;
            let finalBottom = offsetY + (row * stackHeight) + (Math.random() * 5 - 2.5); 
            let finalLeft = offsetX + (jarVisualWidth * 0.1) + (col * stackWidth) 
                          + (row % 2 === 1 ? stackWidth / 2 : 0) 
                          + (Math.random() * 10 - 5);
            if (finalLeft + candySize > offsetX + jarVisualWidth * 0.9) { finalLeft -= stackWidth / 2; }
            candy.style.left = `${finalLeft}px`;
            candy.style.bottom = `${finalBottom}px`; 
            candy.style.animationDelay = `${index * 0.15}s`; 
            candy.style.setProperty('--final-rotate', `${Math.random() * 360}deg`); 

            candy.onmouseenter = (e) => {
                tooltip.innerHTML = `<strong>${entry.date}</strong><br><span>${entry.emotion} ${entry.emoji}</span><br><span class="text-sm">${entry.reason}</span>`;
                tooltip.classList.add('show');
                const rect = e.target.getBoundingClientRect();
                tooltip.style.left = `${rect.left + rect.width / 2 - tooltip.offsetWidth / 2}px`;
                tooltip.style.top = `${rect.top - tooltip.offsetHeight - 5}px`;
            };
            candy.onmouseleave = () => tooltip.classList.remove('show');
            candyContainer.appendChild(candy);
        });
    } else {
        candyContainer.innerHTML = '<p class="text-gray-500">선택한 달에 기록된 감정 사탕이 없습니다.</p>';
    }


    // 5. 선택한 달의 전체 기록
    const recordsContainer = container.querySelector('#myRecentRecords');
    recordsContainer.innerHTML = '';
    if (studentMonthData.length > 0) {
        studentMonthData.slice().sort((a, b) => b.date.localeCompare(a.date)).forEach(entry => {
            recordsContainer.innerHTML += `
                <div class="bg-gray-50 p-4 rounded-xl shadow-sm border-l-4 ${entry.category === 'positive' ? 'border-green-500' : entry.category === 'negative' ? 'border-red-500' : 'border-gray-500'}">
                    <p class="font-semibold text-gray-800">${entry.date} &middot; ${entry.emotion} ${entry.emoji}</p>
                    <p class="text-sm text-gray-600 mt-1 whitespace-pre-wrap">${entry.reason}</p>
                </div>
            `;
        });
    } else {
        recordsContainer.innerHTML = '<p class="text-gray-500">선택한 달의 기록이 없습니다.</p>';
    }
}

function renderStudentReport(studentNumber, isTeacherView = true) {
    currentStudentForReport = studentNumber;
    showPage('studentReportPage');

    document.getElementById('studentReportNumber').textContent = `${studentNumber}번 학생의 리포트`;
    
    const monthPicker = document.getElementById('studentReportMonth');
    if (!monthPicker.dataset.listenerAttached) {
         monthPicker.addEventListener('change', () => renderStudentReport(studentNumber, isTeacherView));
         monthPicker.dataset.listenerAttached = 'true';
    }
    
    const today = new Date();
    const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    monthPicker.value = monthPicker.value || defaultMonth;
    
    const selectedMonth = monthPicker.value;

    document.getElementById('dashboardButton').classList.toggle('hidden', !isTeacherView);
    document.getElementById('mainPageButton').classList.toggle('hidden', isTeacherView);
    
    renderStudentReportContent('#studentReportPage', studentNumber, selectedMonth);

    const aiAdviceEl = document.getElementById('aiAdvice');
    const generateAdviceBtn = document.getElementById('generateAdviceBtn');
    const adviceContainer = document.querySelector('#studentReportPage > .max-w-4xl > .bg-white.rounded-2xl.shadow-lg.p-6.mb-6:last-child');
    
    if (adviceContainer) {
        if (isTeacherView) {
            adviceContainer.classList.add('hidden');
        } else {
            adviceContainer.classList.remove('hidden');
            if (aiAdviceEl) aiAdviceEl.innerHTML = '<p class="text-sm text-gray-500">버튼을 눌러 선생님의 격려 메시지를 생성해 보세요.</p>';
            if (generateAdviceBtn) {
                 generateAdviceBtn.disabled = false;
                 generateAdviceBtn.textContent = '조언 생성하기';
            }
        }
    }
}

async function fetchAIAdvice() {
    const studentNumber = currentStudentForReport;
    if (!studentNumber) return showToast('학생 번호가 선택되지 않았습니다.');
    if (!API_KEY) return showToast('선생님! Gemini API 키를 설정해야 사용할 수 있어요.');

    const btn = document.getElementById('generateAdviceBtn');
    const aiAdviceEl = document.getElementById('aiAdvice');
    
    btn.disabled = true;
    btn.textContent = '조언 분석 중...';
    aiAdviceEl.innerHTML = '<div class="loader mx-auto"></div><p class="text-center text-purple-700 mt-2">학생의 감정 기록을 분석하는 중입니다...</p>';

    const studentData = getAllData().filter(d => d.studentNumber === studentNumber);
    
    if (studentData.length === 0) {
         aiAdviceEl.innerHTML = '<p class="text-red-600 font-semibold">아직 이 학생의 기록이 없어 조언을 생성할 수 없습니다.</p>';
         btn.disabled = false;
         btn.textContent = '조언 생성하기';
         return;
    }
    
    // ... (Gemini API 호출 로직)
    const recentRecords = studentData.slice(-5).map(e => `[${e.date} ${e.emotion}] ${e.reason}`).join('\n');
    const totalCounts = studentData.reduce((acc, curr) => { acc[getEmotionType(curr.emotion, curr)]++; return acc; }, { positive: 0, negative: 0, neutral: 0 });
    
    const prompt = `당신은 초등학생의 담임 선생님입니다. 아래는 ${studentNumber}번 학생의 최근 감정일기 기록과 전체적인 감정 통계입니다. 이 정보를 바탕으로 학생에게 힘이 되고 격려가 되는 긍정적이고 따뜻한 **짧은 조언** 한 마디를 한국어로 작성해 주세요. 조언은 반드시 3문장 이내로 작성해야 합니다.

<학생 감정 통계>
- 전체 기록: ${studentData.length}건
- 긍정: ${totalCounts.positive}회, 부정: ${totalCounts.negative}회, 중립: ${totalCounts.neutral}회

<최근 5일간의 기록 (최신순)>
${recentRecords}

선생님의 조언:`;

    const advice = await callGeminiAPI(prompt);

    if (advice) {
        aiAdviceEl.innerHTML = `<p class="whitespace-pre-wrap">${advice}</p>`;
    } else {
        aiAdviceEl.innerHTML = '<p class="text-red-600 font-semibold">AI 조언 생성에 실패했습니다. 다시 시도해 주세요.</p>';
    }

    btn.disabled = false;
    btn.textContent = '조언 다시 생성하기';
}
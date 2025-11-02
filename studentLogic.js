// studentLogic.js

// 학생 관련 로직 (감정일기 작성, 쪽지 보내기, 학생 로그인)

function populateForms() {
    const numSelect = document.getElementById('studentNumber'); 
    const loginNumSelect = document.getElementById('studentLoginNumber'); 
    const noteNumSelect = document.getElementById('noteStudentNumber'); 

    const options = ['<option value="">번호 선택</option>']
        .concat(STUDENT_NUMBERS.map(num => `<option value="${num}">${num}번</option>`))
        .join('');
        
    if (numSelect) numSelect.innerHTML = options;
    if (loginNumSelect) loginNumSelect.innerHTML = options;
    if (noteNumSelect) noteNumSelect.innerHTML = options; 

    Object.entries(EMOTIONS).forEach(([category, emotions]) => {
        const container = document.getElementById(`${category}Emotions`);
        if (container) {  
            container.innerHTML = '';
            const bgColor = category === 'positive' ? 'bg-green-50 hover:bg-green-100' : category === 'negative' ? 'bg-red-50 hover:bg-red-100' : 'bg-gray-50 hover:bg-gray-100';
            for (const [emotion, emoji] of Object.entries(emotions)) {
                container.innerHTML += `<div class="emotion-card ${bgColor} p-3 rounded-lg cursor-pointer text-center text-xs" onclick="selectEmotion('${emotion}', '${emoji}', '${category}', this)"><div class="text-2xl mb-1">${emoji}</div><div class="font-medium">${emotion}</div></div>`;
            }
        }
    });
}

function selectEmotion(emotion, emoji, category, element) {
    document.querySelectorAll('.emotion-card').forEach(el => el.classList.remove('ring-2', 'ring-blue-500'));
    if (element) element.classList.add('ring-2', 'ring-blue-500');
    document.getElementById('selectedEmotion').value = emotion;
    document.getElementById('selectedEmoji').value = emoji;
    document.getElementById('selectedCategory').value = category;
}
function showCustomEmotionInput() { document.getElementById('customEmotionContainer').classList.remove('hidden'); }
function hideCustomEmotionInput() { document.getElementById('customEmotionContainer').classList.add('hidden'); }

async function setCustomCategory(category) {
    const customEmotionText = pendingCustomEmotion.text;
    let finalEmoji = pendingCustomEmotion.emoji;

    if (!finalEmoji) {
        const emojiPrompt = `다음 한국어 감정에 가장 어울리는 대표 얼굴 표정 이모지(emoji) 하나만 응답해 주세요. 다른 설명 없이 이모지만 응답해야 합니다.\n\n감정: "${customEmotionText}"`;
        const recommendedEmoji = await callGeminiAPI(emojiPrompt);
        if (recommendedEmoji && /\p{Emoji}/u.test(recommendedEmoji)) {
            finalEmoji = recommendedEmoji.slice(0, 2);
        } else {
            finalEmoji = DEFAULT_EMOJIS[category];
        }
    }

    selectEmotion(customEmotionText, finalEmoji, category, null);
    showToast(`'${customEmotionText} ${finalEmoji}' 감정이 선택되었습니다.`);
    hideCustomEmotionInput();
    document.getElementById('categoryModal').classList.add('hidden');
    pendingCustomEmotion = {};
}

async function handleCustomEmotion() {
    const inputEl = document.getElementById('customEmotionInput');
    const customEmotionText = inputEl.value.trim();
    if (!customEmotionText) return showToast('감정을 입력해주세요.');
    const confirmButton = inputEl.nextElementSibling;
    confirmButton.disabled = true; confirmButton.textContent = '...';

    pendingCustomEmotion = { text: customEmotionText, emoji: null };

    const prompt = `다음 한국어 감정을 분석해서 가장 어울리는 대표 얼굴 표정 이모지(emoji)와 감정의 긍정/부정/중립 분류를 JSON 형식으로 응답해 주세요. category는 'positive', 'negative', 'neutral' 중 하나여야 합니다. 다른 설명 없이 JSON 객체만 응답해야 합니다. 형식: {"emoji": "...", "category": "..."}\n\n감정: "${customEmotionText}"`;
    const responseText = await callGeminiAPI(prompt);
    confirmButton.disabled = false; confirmButton.textContent = '확인';

    if (responseText) {
        try {
            const cleanedResponse = responseText.replace(/```json\n?/, '').replace(/```$/, '');
            const result = JSON.parse(cleanedResponse);
            if (result.emoji && result.category && /\p{Emoji}/u.test(result.emoji)) {
                pendingCustomEmotion.emoji = result.emoji.slice(0, 2);
                setCustomCategory(result.category);
                return;
            }
        } catch (e) {
            console.error("Error parsing AI response:", e, responseText);
        }
    }

    document.getElementById('fallbackEmotionText').textContent = `"${customEmotionText}"`;
    document.getElementById('categoryModal').classList.remove('hidden');
}

// 감정일기 제출
document.getElementById('emotionForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const today = getTodayDateString();
    const studentNumber = document.getElementById('studentNumber').value;
    if (!studentNumber) { return showToast('번호를 선택해주세요!'); }
    if (!document.getElementById('selectedEmotion').value) { return showToast('감정을 선택해주세요!'); }
    if (!document.getElementById('emotionReason').value.trim()) { return showToast('감정의 이유를 입력해주세요!'); }

    if (getAllData().find(d => d.date === today && d.studentNumber === studentNumber)) { return showToast('이미 오늘 감정일기를 작성했어요!'); }

    const newEntryForGAS = {
        id: Date.now(), timestamp: new Date().toISOString(), name: studentNumber,
        emotion: document.getElementById('selectedEmotion').value, 
        tag: document.getElementById('selectedCategory').value || 'neutral', 
        content: document.getElementById('emotionReason').value, 
        emoji: document.getElementById('selectedEmoji').value 
    };
    
    const newEntryInternal = {
        id: newEntryForGAS.id, date: today, studentNumber: studentNumber,
        emotion: newEntryForGAS.emotion, emoji: newEntryForGAS.emoji, reason: newEntryForGAS.content, 
        category: newEntryForGAS.tag, synced: false 
    };

    const submitButton = e.target.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = '저장 중...';
    let serverSuccess = false;

    try {
        const response = await fetch(GAS_URL, {
            method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
            body: JSON.stringify({ action: "create", data: newEntryForGAS })
        });
        
        const txt = await response.text();
        let result;
        try { 
            if (!txt) throw new Error("EMPTY_RESPONSE");
            result = JSON.parse(txt); 
        } catch (err) {
             result = { status: "error", message: "응답 파싱 오류" };
        }

        if (response.ok && result.status === "success") {
            const serverId = String(result.id ?? newEntryForGAS.id);
            const entryWithServerId = { ...newEntryInternal, id: serverId, synced: true };
            allDataCache.push(entryWithServerId);
            serverSuccess = true;

            const feedbackMessages = ["오늘도 힘내세요! 멋진 하루가 될 거예요. 화이팅!", "아침부터 기록하는 당신, 정말 멋져요! 응원합니다!", "좋은 시작이에요! 오늘 하루도 긍정 에너지 가득하길!", "감사합니다! 당신의 하루를 응원할게요. 화이팅!", "기록 완료! 오늘 하루도 반짝반짝 빛나길 바라요."];
            showToast(feedbackMessages[Math.floor(Math.random() * feedbackMessages.length)]);
            
        } else {
            console.error("GAS 쓰기 오류:", result.message);
            allDataCache.push(newEntryInternal);
            showToast(`저장 실패: ${result.message || '서버 오류. 교사에게 문의하세요.'}`);
        }

    } catch (error) {
        console.error("Fetch Error (Create):", error);
        allDataCache.push(newEntryInternal);
        showToast("서버 통신 오류! 기록을 로컬에 임시 저장했습니다. 다시 시도해 주세요.");
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = '💾 감정일기 저장하기';
        saveDataLocally(allDataCache);
        e.target.reset();
        document.querySelectorAll('.emotion-card').forEach(el => el.classList.remove('ring-2', 'ring-blue-500'));
        
        if (serverSuccess) { showPage('mainPage'); }
    }
});

// 쪽지 전송
document.getElementById('noteForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const studentNumber = document.getElementById('noteStudentNumber').value;
    const noteContent = document.getElementById('noteContent').value;

    if (!studentNumber || !noteContent.trim()) { return showToast('번호 선택과 쪽지 내용을 모두 입력해주세요.'); }

    const noteEntry = { timestamp: new Date().toISOString(), name: studentNumber, content: noteContent.trim() };

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = '전송 중...';

    try {
        const response = await fetch(GAS_URL, {
            method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: "sendNote", data: noteEntry })
        });
        
        const txt = await response.text();
        let result;
        try { 
            if (!txt) throw new Error("EMPTY_RESPONSE");
            result = JSON.parse(txt); 
        } catch (err) {
             result = { status: "error", message: "응답 파싱 오류" };
        }

        if (response.ok && result.status === "success") {
            showToast("쪽지가 선생님께 성공적으로 전달되었습니다! (비밀 보장)");
            e.target.reset();
            showPage('mainPage');
        } else {
            showToast("쪽지 전송 실패: 서버 오류. GAS 설정을 확인해주세요.");
        }
    } catch (error) {
        showToast("서버 통신 오류로 쪽지 전송에 실패했습니다.");
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '💌 쪽지 전송하기';
    }
});

// 학생 로그인
async function handleStudentLogin(e) {
    e.preventDefault();
    
    const studentNumber = document.getElementById('studentLoginNumber').value;
    const inputPw = document.getElementById('studentLoginPassword').value;
    const errorEl = document.getElementById('studentLoginError');

    if (!studentNumber || !inputPw) {
        errorEl.textContent = '번호와 비밀번호를 모두 입력해주세요.';
        errorEl.classList.remove('hidden');
        return;
    }

    const SECRET = 572;
    const MULTIPLIER = 17;
    const expectedPw = ((Number(studentNumber) * MULTIPLIER) + SECRET).toString().slice(-4).padStart(4, '0');

    if (inputPw === expectedPw) {
        errorEl.classList.add('hidden');
        document.getElementById('studentLoginForm').reset();
        renderStudentReport(studentNumber, false); 
    } else {
        errorEl.textContent = '번호 또는 비밀번호가 올바르지 않습니다.';
        errorEl.classList.remove('hidden');
    }
}
// dataManager.js

// --- 초기 설정 및 데이터 ---
// ⭐ 1. Google Apps Script 웹 앱 URL
const GAS_URL = "https://script.google.com/macros/s/AKfycbwXACgqFbq9KL6VV0C5mrY2z9buQ1EIo8sXggck9RcdcLQkrad646ccx5WdaOJPoLsjIA/exec"; // 👈 [중요] 이 부분을 선생님의 새 GAS URL로 교체하셔야 합니다.

// ⭐ 2. 데이터 캐시 변수
let allDataCache = [];
let dataLoaded = false; // 데이터 로드 완료 플래그

const DB_NAME = 'emotionDiaryDB_v2'; 
const SAMPLE_DATA_FLAG = 'sampleDataGenerated_v5_NoSample'; 
const TEACHER_PASSWORD = 'teacher572';
const API_KEY = "AIzaSyDnAn0avxLdzICLBYitlpUMErEqB2jB97s"; 
const PENDING_DELETES = 'emotionDiary_pendingDeletes'; 

// ⭐ [수정] 학생 이름 제거
const STUDENT_NUMBERS = ["2", "3", "4", "5", "6", "7", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "30"];

const EMOTIONS = {positive:{'기쁨':'😊','설렘':'🤗','만족':'🙂','평온함':'😇','감사':'🥰','자신감':'😎','희망':'😌','즐거움':'😄','사랑':'😍','뿌듯함':'🤩'},negative:{'슬픔':'😢','분노':'😠','좌절':'😞','두려움':'😨','불안':'😰','외로움':'😔','실망':'😕','후회':'😣','질투':'😒','짜증':'😤'},neutral:{'혼란':'😵','놀람':'😲','긴장':'😬','무기력':'😑','답답함':'😖','억울함':'😤','부끄러움':'😳','의심':'🤔','피곤함':'😴','서운함':'🙁'}};
const DEFAULT_EMOJIS = { positive: '😊', negative: '😟', neutral: '😐' };

let chartInstances = {};
let currentStudentForReport = null; 
let pendingCustomEmotion = {};

// ⭐ [수정] 되돌리기 기능용 변수
let toastTimeout = null;
let undoTimeout = null;
let lastDeletedEntry = null; 

// --- 유틸리티 및 데이터 관리 ---
const getTodayDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};
const getAllData = () => {
  if (dataLoaded) {
    return allDataCache.map(entry => ({
      ...entry,
      id: String(entry.id),     
      synced: entry.synced === true,
      date: (entry.date || (entry.timestamp ? entry.timestamp.split('T')[0] : getTodayDateString())),
      studentNumber: (entry.studentNumber || entry.name),
      reason: (entry.reason || entry.content),
      category: (entry.category || entry.tag)
    }));
  }
  const localData = localStorage.getItem(DB_NAME);
  return localData ? JSON.parse(localData).map(entry => ({
    ...entry,
    id: String(entry.id),       
    synced: entry.synced === true,
    date: (entry.date || (entry.timestamp ? entry.timestamp.split('T')[0] : getTodayDateString())),
    studentNumber: (entry.studentNumber || entry.name),
    reason: (entry.reason || entry.content),
    category: (entry.category || entry.tag)
  })) : [];
};
const saveDataLocally = (data) => {
  const dataToSave = data.map(entry => ({
    id: String(entry.id),       
    synced: entry.synced === true,
    date: (entry.date || (entry.timestamp ? entry.timestamp.split('T')[0] : getTodayDateString())),
    studentNumber: (entry.studentNumber || entry.name),
    emotion: entry.emotion,
    emoji: entry.emoji,
    reason: (entry.reason || entry.content),
    category: (entry.category || entry.tag)
  }));
  localStorage.setItem(DB_NAME, JSON.stringify(dataToSave));
  allDataCache = dataToSave;
  dataLoaded = true;
};
const getEmotionType = (emotion, entry = null) => {
    if (entry && entry.category) return entry.category;  
    for (const type in EMOTIONS) {  
        if (EMOTIONS[type][emotion]) return type;  
    }
    return 'neutral';
};
function enqueuePendingDelete(idStr) {
  try {
   const q = JSON.parse(localStorage.getItem(PENDING_DELETES) || '[]');
   if (!q.includes(idStr)) q.push(idStr);
   localStorage.setItem(PENDING_DELETES, JSON.stringify(q));
  } catch {}
}
async function flushPendingDeletes() {
  const q = JSON.parse(localStorage.getItem(PENDING_DELETES) || '[]');
  if (!q.length) return;
  const remains = [];
  for (const idStr of q) {
    try {
      const res = await fetch(GAS_URL, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
        body: JSON.stringify({ 
            action: 'delete', 
            id: idStr,
            id_numeric: (idStr.match(/\d+/)?.[0] ?? null) 
        })
       });
       const result = await res.json();
       const ok = res.ok && result.status === 'success';
       if (!ok) {
           if (result.message && result.message.includes("삭제할 ID를 찾을 수 없습니다")) {
             console.log(`Pending delete for ${idStr} already processed on server.`);
           } else {
             remains.push(idStr); 
           }
       }
    } catch {
       remains.push(idStr); 
    }
  }
  localStorage.setItem(PENDING_DELETES, JSON.stringify(remains));
}
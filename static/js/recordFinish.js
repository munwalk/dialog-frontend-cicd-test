let speakerAnalysisToken = null;
let speakerAnalysisCheckInterval = null;

/* 전역 변수 */
let meetingData = null;
let speakerMappingData = {};
let actionItems = [];
let currentEditingTranscriptIndex = -1;
let activeKeyword = null;
let isEditingSummary = false;
let originalSummaryData = {};
let currentMappingSpeaker = null;
let currentUserName = null;
let tempSelectedParticipant = null;

/* ===============================
   Chatbot & Sidebar Fetch
=================================*/
document.addEventListener("DOMContentLoaded", async () => {
  const user = await loadCurrentUser();

  let userSettings = {};
  try {
    userSettings = user || {};
    if (userSettings && userSettings.name) {
      currentUserName = userSettings.name;
      console.log(`로그인한 사용자: ${currentUserName}`);
    } else {
      console.warn("로그인한 사용자 이름을 찾을 수 없습니다. (userSettings)");
      currentUserName = "사용자";
    }
  } catch (e) {
    console.error("userSettings 로드 실패", e);
    currentUserName = "사용자";
    userSettings = { name: "사용자" };
  }

  // 챗봇 로드
  fetch("components/chatbot.html")
    .then(res => res.text())
    .then(html => {
      const container = document.getElementById("chatbot-container");
      container.innerHTML = html;

      const closeBtn = container.querySelector(".close-chat-btn");
      const sendBtn = container.querySelector(".send-btn");
      const chatInput = container.querySelector("#chatInput");
      const floatingBtn = document.getElementById("floatingChatBtn");

      if (closeBtn) closeBtn.addEventListener("click", closeChat);
      if (sendBtn) sendBtn.addEventListener("click", sendMessage);
      if (chatInput) chatInput.addEventListener("keypress", handleChatEnter);
      if (floatingBtn) floatingBtn.addEventListener("click", openChat);
    });

  // 사이드바 로드
  fetch("components/sidebar.html")
    .then(res => res.text())
    .then(html => {
      const sidebar = document.getElementById("sidebar-container");
      sidebar.innerHTML = html;

      const currentPage = window.location.pathname.split("/").pop();
      const navItems = sidebar.querySelectorAll(".nav-menu a");

      navItems.forEach(item => {
        const linkPath = item.getAttribute("href");
        if (linkPath === currentPage) {
          item.classList.add("active");
        } else {
          item.classList.remove("active");
        }
      });

      if (typeof loadCurrentUser === 'function') {
        console.log('recordFinish.js: app.js의 loadCurrentUser()를 호출합니다.');
        loadCurrentUser();
      } else {
        console.error('recordFinish.js: app.js의 loadCurrentUser() 함수를 찾을 수 없습니다.');

        document.querySelectorAll(".user-avatar").forEach(el => { el.textContent = "U"; });
        document.querySelectorAll(".user-name").forEach(el => { el.textContent = "사용자"; });
        document.querySelectorAll(".user-email").forEach(el => { el.textContent = ""; });
      }
    });

  // 서버에서 회의 데이터 로드
  await loadMeetingDataFromServer();
  
  // sessionStorage에서 발화자 분석 토큰 확인 (recordPage에서 전달된 경우)
  const savedToken = sessionStorage.getItem("speakerAnalysisToken");
  if (savedToken) {
      console.log("🎤 저장된 발화자 분석 토큰 발견:", savedToken);
      speakerAnalysisToken = savedToken;
      sessionStorage.removeItem("speakerAnalysisToken");
      startCheckingSpeakerAnalysisResult();
  } 
  
  // 발화자 분석 상태 체크 및 UI 업데이트
  checkSpeakerAnalysisStatus();
  checkMappingCompletion();
  checkActionGenerationButtonState(); // '내 할 일 생성' 버튼 상태도 체크
});

function openConfirmModal(title, message, onConfirm) {
    const modal = document.getElementById('confirmModal');
    const titleEl = document.getElementById('confirmTitle');
    const msgEl = document.getElementById('confirmMessage');
    const okBtn = document.getElementById('confirmOkBtn');
    const cancelBtn = document.getElementById('confirmCancelBtn');

    titleEl.textContent = title;
    msgEl.innerHTML = message;

    modal.classList.remove('hidden');

    // 취소 버튼이 항상 보이도록
    if (cancelBtn) {
        cancelBtn.style.display = ''; 
    }

    const closeModal = () => modal.classList.add('hidden');
    cancelBtn.onclick = closeModal;
    okBtn.onclick = () => {
        closeModal();
        if (onConfirm) onConfirm();
    };
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add("hidden");
    }
    document.body.style.overflow = "";
}


// 에러 모달 표시 함수 (확인 버튼만)
function showErrorModal(title, message, onConfirm) {
    const modal = document.getElementById('confirmModal');
    if (!modal) {
        // 모달이 없으면 alert 사용
        alert(`${title}\n\n${message}`);
        if (onConfirm) onConfirm();
        return;
    }
    
    const titleEl = document.getElementById('confirmTitle');
    const msgEl = document.getElementById('confirmMessage');
    const okBtn = document.getElementById('confirmOkBtn');
    const cancelBtn = document.getElementById('confirmCancelBtn');

    titleEl.textContent = title;
    msgEl.innerHTML = message;
    
    // 취소 버튼 숨기기 (에러 모달은 확인만 있으면 됨)
    if (cancelBtn) {
        cancelBtn.style.display = 'none';
    }

    modal.classList.remove('hidden');

    const closeModal = () => {
        modal.classList.add('hidden');
        if (cancelBtn) cancelBtn.style.display = '';
    };
    
    okBtn.onclick = () => {
        closeModal();
        if (onConfirm) onConfirm();
    };
}

/* 공통 메시지 */
function showSuccessMessage(msg) {
  const div = document.createElement("div");
  div.className = "success-toast";
  div.textContent = msg;
  Object.assign(div.style, {
      position: "fixed",
      top: "24px",
      right: "24px",
      background: "#10b981",
      color: "#fff",
      padding: "12px 20px",
      borderRadius: "8px",
      zIndex: "9999",
  });
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 2500);
}

function showErrorMessage(msg) {
  const div = document.createElement("div");
  div.className = "error-toast";
  div.textContent = msg;
  Object.assign(div.style, {
      position: "fixed",
      top: "24px",
      right: "24px",
      background: "#ef4444",
      color: "#fff",
      padding: "12px 20px",
      borderRadius: "8px",
      zIndex: "9999",
  });
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 2500);
}

/* ===============================
   발화자 분석 함수들
=================================*/

// 발화자 분석 시작 함수
async function startSpeakerAnalysis(fileUrl) {
    if (!fileUrl) {
        console.error("❌ 발화자 분석 시작 실패: fileUrl이 없습니다.");
        showErrorMessage("오디오 파일 URL이 없어 발화자 분석을 시작할 수 없습니다.");
        return;
    }

    console.log("🎤 발화자 분석 시작 요청:", fileUrl);
    showLoadingMessage("발화자 분석을 시작합니다...");

    try {
        const response = await fetch("http://localhost:8000/api/analyze/object", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                file_url: fileUrl,
                language: "ko",
                speaker_min: -1,
                speaker_max: -1
            })
        });

        if (!response.ok) {
            throw new Error(`발화자 분석 요청 실패: ${response.status}`);
        }

        const result = await response.json();
        speakerAnalysisToken = result.token;
        
        console.log("✅ 발화자 분석 토큰 받음:", speakerAnalysisToken);
        hideLoadingMessage(); // 로딩 메시지 숨기기
        showSuccessMessage(`발화자 분석이 시작되었습니다.`);

        // 주기적으로 결과 확인 (3초마다)
        startCheckingSpeakerAnalysisResult();

    } catch (error) {
        hideLoadingMessage(); // 에러 시 로딩 메시지 숨기기
        console.error("❌ 발화자 분석 시작 오류:", error);
        showErrorMessage("발화자 분석 시작에 실패했습니다.");
    }
}

// 발화자 분석 결과 주기적 확인
function startCheckingSpeakerAnalysisResult() {
    if (!speakerAnalysisToken) {
        console.error("❌ 발화자 분석 토큰이 없습니다.");
        return;
    }

    if (speakerAnalysisCheckInterval) {
        clearInterval(speakerAnalysisCheckInterval);
    }

    let checkCount = 0;
    const maxChecks = 60; // 최대 3분 (3초 × 60)

    console.log("⏳ 발화자 분석 결과 확인 시작...");
    showLoadingMessage("발화자 분석 결과 확인 중..."); 
    
    speakerAnalysisCheckInterval = setInterval(async () => {
        checkCount++;

        if (checkCount > maxChecks) {
            clearInterval(speakerAnalysisCheckInterval);
            hideLoadingMessage(); 
            showErrorMessage("발화자 분석 시간이 초과되었습니다.");
            return;
        }

        try {
            const response = await fetch(`http://localhost:8000/api/analyze/${speakerAnalysisToken}`);
            
            if (!response.ok) {
                throw new Error(`결과 조회 실패: ${response.status}`);
            }

            const result = await response.json();

            if (result.status === "COMPLETED" || result.success) {
                clearInterval(speakerAnalysisCheckInterval);
                hideLoadingMessage(); 
                console.log("발화자 분석 완료!", result);
                
                // meetingData에 발화자 분석 결과 저장
                if (meetingData) {
                    meetingData.speakerAnalysis = result;
                    
                    // segments를 transcripts 형식으로 변환
                    if (result.segments && Array.isArray(result.segments)) {
                        meetingData.transcripts = result.segments.map((seg, idx) => ({
                            // speakerName과 speaker(ID)를 명확히 구분
                            speaker: seg.speaker?.name || `화자${seg.speaker?.label || 0}`, // 이것을 ID로 사용
                            speakerName: seg.speaker?.name || `화자${seg.speaker?.label || 0}`, // 이것을 이름으로 사용
                            speakerLabel: seg.speaker?.label,  // CLOVA label 보존
                            time: formatTimestamp(seg.start),
                            text: seg.text || "",
                            startTime: seg.start,
                            endTime: seg.end,
                            sequenceOrder: idx,
                            isDeleted: false
                        }));
                        
                        console.log(`${meetingData.transcripts.length}개의 발화 로그 변환 완료`);
                    }

                    // 참석자 목록 업데이트
                    if (result.speakers && Array.isArray(result.speakers)) {
                        const speakerNames = result.speakers.map(s => s.name);
                        // 기존 참석자 목록과 병합 (중복 제거)
                        meetingData.participants = [...new Set([...(meetingData.participants || []), ...speakerNames])];
                        
                        console.log(`참석자 목록 업데이트: ${meetingData.participants.join(', ')}`);
                    }

                    // UI 업데이트
                    displayTranscripts();
                    updateTranscriptStats();
                    checkMappingCompletion();
                    checkActionGenerationButtonState(); 
                    displayMeetingInfo(); // 참석자 수 업데이트
                    
                    // 발화자 분석 버튼 숨기기
                    const analysisBtn = document.getElementById('startSpeakerAnalysisBtn');
                    if (analysisBtn) {
                        analysisBtn.style.display = 'none';
                    }
                    
                    // 서버에 저장
                    await saveMeetingDataToServer();
                }

                showSuccessMessage("발화자 분석이 완료되었습니다!");
                
            } else if (result.status === "FAILED" || result.error) {
                clearInterval(speakerAnalysisCheckInterval);
                hideLoadingMessage(); 
                console.error("발화자 분석 실패:", result);
                showErrorMessage("발화자 분석에 실패했습니다.");
                
                // 버튼 상태 복구
                const analysisBtn = document.getElementById('startSpeakerAnalysisBtn');
                if (analysisBtn) {
                    analysisBtn.disabled = false;
                    analysisBtn.classList.remove('analyzing');
                    analysisBtn.querySelector('span').textContent = '발화자 구분 분석 시작';
                }
                
                // 토큰 초기화
                speakerAnalysisToken = null;
                
            } else {
                // 아직 진행 중
                const progress = result.progress || 0;
                console.log(`발화자 분석 진행 중... ${progress}%`);
                // 로딩 메시지 업데이트
                const loadingToast = document.getElementById("loadingToast");
                if (loadingToast) {
                    loadingToast.textContent = `발화자 분석 진행 중... ${Math.round(progress)}%`;
                }
            }

        } catch (error) {
            console.error("발화자 분석 결과 확인 오류:", error);
            clearInterval(speakerAnalysisCheckInterval);
            hideLoadingMessage();
        }

    }, 3000); // 3초마다 확인
}

// 타임스탬프 포맷팅 함수 (ms → "00:00:00")
function formatTimestamp(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}


// 발화자에게 고유 색상을 매핑하는 객체
const speakerColorMap = {};
let colorHUEIndex = 0;
const HUE_STEP = 137.5;

function getSpeakerColor(speakerId) {
    if (!speakerColorMap[speakerId]) {
        const hue = (colorHUEIndex * HUE_STEP) % 360;

        const saturation = 65; // 채도 (너무 쨍하지 않게)
        const lightness = 40;  // 명도 (너무 밝지 않게 - 글씨가 흰색이므로)

        const hslToHex = (h, s, l) => {
            l /= 100;
            const a = (s * Math.min(l, 1 - l)) / 100;
            const f = n => {
                const k = (n + h / 30) % 12;
                const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
                return Math.round(255 * color).toString(16).padStart(2, '0');
            };
            return `#${f(0)}${f(8)}${f(4)}`;
        };

        speakerColorMap[speakerId] = hslToHex(hue, saturation, lightness);
        colorHUEIndex++;
    }
    return speakerColorMap[speakerId];
}

/* ===============================
   회의 ID 가져오기
=================================*/
function getMeetingId() {
    // 1. URL에서 meetingId 파라미터 확인
    const urlParams = new URLSearchParams(window.location.search);
    const urlMeetingId = urlParams.get('meetingId');
    
    if (urlMeetingId) {
        console.log('URL에서 회의 ID 발견:', urlMeetingId);
        // URL에서 찾았으면 localStorage에도 저장 (다음에도 사용 가능하도록)
        localStorage.setItem('currentMeetingId', urlMeetingId);
        return urlMeetingId;
    }
    
    // 2. localStorage에서 확인
    const storedMeetingId = localStorage.getItem('currentMeetingId');
    if (storedMeetingId) {
        console.log('localStorage에서 회의 ID 발견:', storedMeetingId);
        return storedMeetingId;
    }
    
    // 3. 둘 다 없음
    console.error('회의 ID를 찾을 수 없습니다');
    return null;
}

/* ===============================
   서버에서 회의 데이터 로드
=================================*/
async function loadMeetingDataFromServer() {
    try {
        const meetingId = getMeetingId();
        if (!meetingId) {
            showErrorModal(
                '회의 정보 없음',
                '회의 데이터를 불러올 수 없습니다.<br>회의를 먼저 생성하거나 진행해주세요.',
                () => { window.location.href = 'new-meeting.html'; }
            );
            return;
        }

        console.log(`📥 회의 데이터 로드 시작 (ID: ${meetingId})`);

        // 1. 회의 기본 정보 로드 (동일)
        const response = await fetch(`http://localhost:8080/api/meetings/${meetingId}`, { credentials: 'include' });
        if (!response.ok) throw new Error('회의 정보를 불러올 수 없습니다.');
        const data = await response.json();

        // 2. 발화 로그(Transcript) 로드
        const transcriptResponse = await fetch(`http://localhost:8080/api/transcripts/meeting/${meetingId}`, { credentials: 'include' });
        
        let loadedTranscripts = [];
        const restoredMapping = {}; 

        if (transcriptResponse.ok) {
            const tData = await transcriptResponse.json();
            
            // 여기서 isDeleted가 true인 것은 걸러냅니다.
            // 이렇게 하면 DB에 1로 남아있어도, 화면에는 로드되지 않습니다.
            const activeData = tData.filter(t => !t.isDeleted);

            loadedTranscripts = activeData.map(t => {
                // ID(Speaker 1)와 이름(가나디)이 다르면 매핑된 것으로 간주
                const originalId = t.speakerId || t.speaker; // DTO 필드명 대응
                const currentName = t.speakerName;

                if (originalId && currentName && originalId !== currentName) {
                    restoredMapping[originalId] = currentName;
                }

                return {
                    id: t.id,
                    speaker: originalId,        // 변하지 않는 ID (Speaker 1)
                    speakerName: currentName,   // 화면 표시용 이름 (가나디)
                    speakerLabel: t.speakerLabel,
                    time: t.timeLabel || formatTimeFromMs(t.startTime),
                    text: t.text,
                    startTime: t.startTime,
                    endTime: t.endTime,
                    isDeleted: false,
                    sequenceOrder: t.sequenceOrder
                };
            });
            
            // 순서 정렬
            loadedTranscripts.sort((a, b) => a.sequenceOrder - b.sequenceOrder);
        }

        // 3. 데이터 전역 변수 설정
        meetingData = {
            meetingId: data.meetingId,
            title: data.title,
            date: data.scheduledAt,
            
            // 서버에서 받은 참석자 명단 적용 (없으면 빈 배열)
            participants: data.participants || [], 
            
            keywords: (data.keywords || []).map(k => ({ 
                text: k.text, source: k.source ? k.source.toUpperCase() : "USER" 
            })),
            
            purpose: data.purpose || "",
            agenda: data.agenda || "",
            summary: data.summary || "",
            importance: data.importance || { level: "MEDIUM", reason: "" },
            transcripts: loadedTranscripts,
            duration: 0,
            audioFileUrl: null
        };

        // 복구된 매핑 정보를 전역 변수에 적용
        speakerMappingData = restoredMapping;
        console.log("매핑 정보 복원 완료:", speakerMappingData);

        // 액션 아이템 매핑 (서버에서 받은 데이터 -> 프론트엔드 변수)
        actionItems = (data.actionItems || []).map(item => ({
            title: item.task,
            assignee: item.assignee,
            // 날짜 포맷 처리 (YYYY-MM-DD)
            deadline: item.dueDate ? item.dueDate.split('T')[0] : "",
            source: item.source ? item.source.toUpperCase() : "USER",
            
            // 서버 DTO 필드명이 isCompleted 인지, completed 인지 확인 필요
            // DTO에는 isCompleted로 되어 있으므로 아래 코드가 맞음.
            // 만약 안 나온다면 || false 처리 때문에 false로 덮어써지는지 확인.
            isCompleted: item.isCompleted === true // 명시적으로 true일 때만 true
        }));

        await loadRecording(meetingId);

        // UI 업데이트
        displayMeetingInfo();
        displayTranscripts();
        checkMappingCompletion(); 
        checkActionGenerationButtonState();
        displayAISummary();

        renderActionItems();

        // 로컬 스토리지 백업
        localStorage.setItem("lastMeeting", JSON.stringify(meetingData));

    } catch (error) {
        console.error('데이터 로드 실패:', error);
    }
}

/* Recording 데이터 로드 */
async function loadRecording(meetingId) {
    try {
        const response = await fetch(`http://localhost:8080/api/recordings/meeting/${meetingId}`, {
            credentials: 'include'
        });

        if (response.ok) {
            const recording = await response.json();
            meetingData.duration = recording.durationSeconds || 0;
            meetingData.audioFileUrl = recording.audioFileUrl;
            meetingData.audioFormat = recording.audioFormat;
            meetingData.audioFileSize = recording.audioFileSize;
            
            console.log('Recording 데이터 로드 완료');
            // Duration 업데이트를 위해 다시 호출
            displayMeetingInfo();
        } else {
            console.warn('Recording 데이터가 없습니다');
        }
    } catch (error) {
        console.error('Recording 로드 실패:', error);
    }
}

/* 밀리초를 시간 문자열로 변환 (항상 HH:MM:SS) */
function formatTimeFromMs(ms) {
    if (ms === null || ms === undefined) return "00:00:00"; // 기본값 수정
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    
    // 조건문 없이 항상 시:분:초 포맷 유지
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/* ===============================
   UI: 회의 정보 및 타이틀 표시
=================================*/
function displayMeetingInfo() {
  if (!meetingData) return;

  const title = meetingData.title || "제목 없음";
  const titleEl = document.getElementById("meetingTitle");
  if (titleEl) titleEl.textContent = title;

  const dateEl = document.getElementById("meetingDate");
  if (meetingData.date && dateEl) {
      const date = new Date(meetingData.date);
      dateEl.textContent = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }

  const dur = document.getElementById("meetingDuration");
  if (dur) {
      dur.textContent = formatDuration(meetingData.duration || 0);
  }

  const part = document.getElementById("participantCount");
  if (meetingData.participants && part) {
      part.textContent = meetingData.participants.length + "명 참석";
  }
}

function formatDuration(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/* ===============================
   UI: 제목 수정 모달
=================================*/
function editMeetingTitle() {
  const modal = document.getElementById("titleModal");
  const input = document.getElementById("newTitleInput");
  const currentTitle = document.getElementById("meetingTitle").textContent;

  input.value = currentTitle;
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";

  setTimeout(() => {
    input.focus();
    input.onkeypress = function(e) {
      if (e.key === 'Enter') saveNewTitle();
    };
  }, 100);
}

function closeTitleModal() {
  closeModal('titleModal');
}

function saveNewTitle() {
  const input = document.getElementById("newTitleInput");
  const newTitle = input.value.trim();

  if (newTitle) {
    meetingData.title = newTitle;
    document.getElementById("meetingTitle").textContent = newTitle;
    showSuccessMessage("회의 제목이 수정되었습니다.");
    closeTitleModal();
  } else {
    showErrorMessage("회의 제목을 입력해주세요.");
  }
}

/* 키워드 하이라이트 헬퍼 */
function highlightKeywords(text) {
  // activeKeyword 변수는 전역에 선언되어 있어야 합니다 (기존 코드 상단에 있음)
  if (!activeKeyword) return text;
  
  try {
      // 특수문자 이스케이프 처리 등을 추가하면 더 좋지만, 기존 로직 유지
      const regex = new RegExp("(" + activeKeyword + ")", "gi");
      return text.replace(regex, '<mark class="transcript-highlight">$1</mark>');
  } catch (e) {
      console.warn("RegExp error:", e);
      return text;
  }
}

/* ===============================
   UI: 실시간 변환 로그 렌더링
=================================*/
function displayTranscripts() {
  if (!meetingData || !meetingData.transcripts) return;
  const body = document.getElementById("transcriptList");
  body.innerHTML = "";

  if (meetingData.transcripts.length === 0) {
    body.innerHTML = `<div style="text-align: center; padding: 40px; color: #9ca3af;"><p>회의 녹취록이 없습니다.</p></div>`;
    updateTranscriptStats();
    return;
  }

  meetingData.transcripts.forEach((transcript, index) => {

    const item = document.createElement("div");
    
    // 1. 화자 정보 매핑
    const speakerId = transcript.speaker; 
    const speakerClass = speakerMappingData[speakerId] ? "mapped" : "";
    const displayName = speakerMappingData[speakerId] || transcript.speakerName || speakerId;
    const avatarText = displayName ? displayName.charAt(0).toUpperCase() : "?";
    const speakerColor = getSpeakerColor(speakerId);
    const isSelf = (currentUserName === displayName);

    // 2. 삭제된 항목이면 CSS 클래스(is-deleted) 추가 -> CSS가 줄 긋고 흐리게 만듦
    const isDeleted = transcript.isDeleted || false;
    item.className = `transcript-item ${isSelf ? 'is-self' : ''} ${isDeleted ? 'is-deleted' : ''}`;
    item.setAttribute("data-index", index);

    // 3. 버튼 분기 (삭제됨 ? 복구 버튼 : 삭제 버튼)
    let controlButtons = '';
    if (isDeleted) {
        controlButtons = `
          <button class="undo-transcript-btn" onclick="undoTranscript(${index})" title="복구">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21.5 2v6h-6M2.5 22v-6h6"/>
              <path d="M2 11.5A10 10 0 0 1 11.5 2a10 10 0 0 1 8.01 4.04"/>
              <path d="M22 12.5a10 10 0 0 1-19.04 1.96"/>
            </svg>
          </button>
        `;
    } else {
        // 수정/삭제 버튼 표시
        controlButtons = `
          <button class="edit-transcript-btn" onclick="editTranscript(${index})" title="수정">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="delete-transcript-btn" onclick="deleteTranscript(${index})" title="삭제">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2v2"/>
            </svg>
          </button>
        `;
    }

    item.innerHTML = `
      <div class="speaker-avatar-wrapper">
        <div class="speaker-avatar ${speakerClass}"
            onclick="openSpeakerModal('${speakerId}')"
            title="${displayName} (ID: ${speakerId})"
            style="background: ${speakerColor};">
          ${avatarText}
        </div>
      </div>
      <div class="transcript-content">
        <div class="transcript-header">
          <div class="transcript-meta">
            <span class="speaker-name ${speakerClass}"
                  onclick="openSpeakerModal('${speakerId}')"
                  style="color: ${speakerColor};">
              ${displayName}
            </span>
            <span class="time-stamp">${transcript.time}</span>
          </div>
          <div class="transcript-controls" style="display: flex; gap: 4px;">
            ${controlButtons}
          </div>
        </div>
        <div class="transcript-text" id="transcript-text-${index}">${highlightKeywords(transcript.text)}</div>
      </div>
    `;
    body.appendChild(item);
  });
  
  updateTranscriptStats();
}

/* ===============================
   직무 확인 모달 생성 및 표시
=================================*/
function showJobCheckModal(onConfirm) {
  // 1. 기존에 열려있는 모달이 있다면 제거 (중복 방지)
  const existingModal = document.getElementById('customJobModal');
  if (existingModal) existingModal.remove();

  // 2. HTML 구조 생성 
  // (recordFinish.css에 정의된 .job-modal-* 클래스들을 사용합니다)
  const modalHtml = `
    <div id="customJobModal" class="job-modal-overlay" style="display: flex;">
      <div class="job-modal-content">
        <h3 class="job-modal-title">직무 설정 확인</h3>
        <p class="job-modal-desc">
          직무가 설정되지 않았습니다.<br>
          중립적인 요약이 생성됩니다. 계속하시겠습니까?<br><br>
          <span style='font-size: 13px; color: #6b7280;'>(직무 설정은 '설정' 페이지에서 할 수 있습니다.)</span>
        </p>
        
        <div class="job-modal-actions">
          <button id="btnCancelJob" class="job-modal-btn btn-secondary">
            취소
          </button>
          <button id="btnConfirmJob" class="job-modal-btn btn-primary">
            확인
          </button>
        </div>
      </div>
    </div>
  `;

  // 3. body 태그 맨 끝에 모달 HTML 추가
  document.body.insertAdjacentHTML('beforeend', modalHtml);

  // 4. 버튼 이벤트 연결
  const modal = document.getElementById('customJobModal');
  const btnCancel = document.getElementById('btnCancelJob');
  const btnConfirm = document.getElementById('btnConfirmJob');

  // 모달 닫기만 수행
  btnCancel.addEventListener('click', () => {
    modal.remove();
  });

  // 모달 닫고, 요약 생성 계속 진행
  btnConfirm.addEventListener('click', () => {
    modal.remove();
    if (onConfirm) onConfirm();
  });
}

/* ===============================
   AI 요약 및 키워드 렌더링 (메인 함수)
=================================*/
function startFullSummaryGeneration() {
  const userSettings = JSON.parse(localStorage.getItem('userSettings'));
  const userJob = userSettings ? userSettings.job : null;

  // 실제 요약 생성을 수행하는 내부 함수
  const proceedToSummary = (job) => {
    console.log(`AI 요약 생성 진행 (직무: ${job || '없음'})`);
    generateAISummary(job);
  };

  // 직무 설정 확인 로직
  if (!userJob || userJob === "NONE" || userJob === "") {
    // 직무가 없으면 -> 커스텀 모달 띄우기
    showJobCheckModal(() => proceedToSummary(userJob));
  } else {
    // 직무가 있으면 -> 바로 진행
    proceedToSummary(userJob);
  }
}

/* AI 요약 생성 (파싱 강화) */
async function generateAISummary(userJob) {
    showLoadingState();
    showLoadingMessage("AI 요약을 생성하는 중...");

    const generateBtn = document.getElementById('generateSummaryBtn');
    if (generateBtn) generateBtn.disabled = true;

    const jobPersona = (!userJob || userJob === "NONE") ? "general" : userJob;

    try {
        const meetingId = getMeetingId();
        if (!meetingId) throw new Error("Meeting ID를 찾을 수 없습니다.");

        const response = await fetch(`http://localhost:8080/api/meetings/summarize?meetingId=${meetingId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                transcripts: meetingData.transcripts.filter(t => !t.isDeleted),
                meetingDate: meetingData.date,
                speakerMapping: speakerMappingData,
                userJob: jobPersona
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || `서버 오류: ${response.status}`);

        hideLoadingMessage();

        let rawSummary = data.summary.overallSummary || "";
        let cleanSummary = rawSummary;
        let extractedReason = "AI 분석 결과가 없습니다.";

        // 파싱 로직 강화
        if (rawSummary.includes("(중요도 판정 사유:")) {
            const parts = rawSummary.split("(중요도 판정 사유:");
            cleanSummary = parts[0].trim();
            let reasonPart = parts[1].replace(")", "").trim();
            extractedReason = reasonPart.split(/중요도\s*평가/)[0].trim();
        } else if (rawSummary.includes("중요도 평가 :")) {
            const parts = rawSummary.split("중요도 평가 :");
            cleanSummary = parts[0].trim();
            extractedReason = parts[1].trim();
        }

        meetingData.purpose = data.summary.purpose;
        meetingData.agenda = data.summary.agenda;
        meetingData.summary = cleanSummary;

        meetingData.importance = {
            level: data.summary.importance || "MEDIUM",
            reason: extractedReason
        };

        const userKeywords = (meetingData.keywords || []).filter(k => k.source && k.source.toUpperCase() === 'USER');
        const existingTexts = new Set(userKeywords.map(k => k.text.trim().toLowerCase()));

        const newAiKeywords = [];
        (data.summary.keywords || []).forEach(text => {
            if (!existingTexts.has(text.trim().toLowerCase())) {
                newAiKeywords.push({ text: text, source: 'AI' });
                existingTexts.add(text.trim().toLowerCase());
            }
        });
        
        const limitedAiKeywords = newAiKeywords.slice(0, 5); 
        meetingData.keywords = [...userKeywords, ...limitedAiKeywords];

        displayAISummary();
        showSuccessMessage('AI 요약이 생성되었습니다!');

    } catch (error) {
        hideLoadingMessage();
        console.error('AI 요약 생성 실패:', error);
        showErrorMessage(error.message || 'AI 요약 생성에 실패했습니다.');
        displayAISummary(); // 실패 시 복구
    } finally {
        if (generateBtn) generateBtn.disabled = false;
    }
}

/* 로딩 상태 표시 (키워드 로딩 추가, 중요도 숨김) */
function showLoadingState() {
    const placeholderEl = document.getElementById("aiSummaryPlaceholder");
    const contentEl = document.getElementById("aiSummaryContent");
    const importanceEl = document.getElementById("importanceBlock");
    const keywordsEl = document.getElementById("keywords"); 

    // 1. 플레이스홀더 숨기고 컨텐츠 영역 보이기 (로딩 텍스트 표시용)
    if (placeholderEl) placeholderEl.classList.add("hidden");
    if (contentEl) contentEl.classList.remove("hidden");

    const loadingText = '<span style="color: #9ca3af;">AI 요약 생성 중...</span>';
    document.getElementById("purposeView").innerHTML = loadingText;
    document.getElementById("agendaView").innerHTML = loadingText;
    document.getElementById("summaryView").innerHTML = loadingText;
    
    // 키워드 영역에도 로딩 표시
    if (keywordsEl) {
        keywordsEl.innerHTML = '<div style="color: #9ca3af; padding: 10px;">키워드 분석 중...</div>';
    }
    
    // 중요도는 로딩 중에 숨김 (나중에 displayAISummary에서 다시 보여줌)
    if (importanceEl) importanceEl.classList.add("hidden");
}

/* AI 요약 표시 (중요도 표시 버그 해결) */
function displayAISummary() {
    const placeholderEl = document.getElementById("aiSummaryPlaceholder");
    const contentEl = document.getElementById("aiSummaryContent");
    const toggleBtn = document.getElementById("toggleEditBtn");
    const importanceEl = document.getElementById("importanceBlock"); // 요소 찾기

    // 1. 키워드 렌더링
    if (typeof renderKeywords === 'function') {
        renderKeywords();
    }

    // 2. 데이터 존재 여부 확인
    let hasData = false;
    if (meetingData.summary && meetingData.summary.trim() !== "") hasData = true;
    if (meetingData.importance && typeof meetingData.importance === 'object' && meetingData.importance.reason) hasData = true;

    // 3. 화면 전환
    if (!hasData) {
        if (placeholderEl) placeholderEl.classList.remove("hidden");
        if (contentEl) contentEl.classList.add("hidden");
        if (toggleBtn) toggleBtn.disabled = true;
        return; 
    } 
    else {
        if (placeholderEl) placeholderEl.classList.add("hidden");
        if (contentEl) contentEl.classList.remove("hidden");
        if (toggleBtn) toggleBtn.disabled = false;
    }

    // --- 데이터 렌더링 ---

    document.getElementById("purposeView").textContent = meetingData.purpose || "";
    
    let rawAgenda = meetingData.agenda || "";
    document.getElementById("agendaView").textContent = rawAgenda.replace(/^-\s*/, "");

    let rawSummary = meetingData.summary || "";
    let cleanSummary = rawSummary
        .replace(/^(요약|Summary)[:\s]*/i, "")  
        .split(/\(중요도 판정 사유:/)[0]       
        .split(/중요도\s*평가/)[0] // 평가 텍스트 더 강력하게 제거          
        .trim();

    document.getElementById("summaryView").textContent = cleanSummary;

    // 6. 중요도 채우기
    if (meetingData.importance) {
        // 로딩 때 숨겨진 중요도 블록을 다시 보이게 함
        if (importanceEl) importanceEl.classList.remove("hidden");

        const summaryBlock = document.querySelector("#importanceBlock .summary-text");
        
        if (summaryBlock) {
            summaryBlock.innerHTML = ""; 

            let level = 'MEDIUM';
            let reason = '';

            if (typeof meetingData.importance === 'object') {
                level = meetingData.importance.level || 'MEDIUM';
                reason = meetingData.importance.reason || '';
            } else {
                level = meetingData.importance;
            }
            
            // 안전장치: 텍스트에 '중요도 평가'가 남아있다면 제거
            if (reason) {
                reason = reason.split(/중요도\s*평가/)[0].trim();
            }

            const badgeSpan = document.createElement("span");
            badgeSpan.textContent = level; 
            badgeSpan.className = 'importance-level'; 
            
            const upperLevel = String(level).toUpperCase();
            badgeSpan.classList.remove('level-high', 'level-medium', 'level-low', 'level-default');
            
            if (upperLevel === 'HIGH' || upperLevel === '높음') badgeSpan.classList.add('level-high');
            else if (upperLevel === 'MEDIUM' || upperLevel === '보통') badgeSpan.classList.add('level-medium');
            else if (upperLevel === 'LOW' || upperLevel === '낮음') badgeSpan.classList.add('level-low');
            else badgeSpan.classList.add('level-default');

            const levelMap = { 'HIGH': '높음', 'MEDIUM': '보통', 'LOW': '낮음' };
            const korLevel = levelMap[upperLevel] || level;

            const titleDiv = document.createElement("div");
            titleDiv.style.fontWeight = "600";
            titleDiv.style.color = "#374151";
            titleDiv.style.marginTop = "12px"; 
            titleDiv.style.marginBottom = "8px"; 
            titleDiv.textContent = `중요도 평가 : ${korLevel}`;

            const descDiv = document.createElement("div");
            descDiv.style.color = "#6b7280";
            descDiv.style.lineHeight = "1.6";
            descDiv.textContent = reason;

            summaryBlock.appendChild(badgeSpan);
            summaryBlock.appendChild(titleDiv);
            summaryBlock.appendChild(descDiv);
        }
    }
}

function renderKeywords() {
    const kwContainer = document.getElementById("keywords");
    if (!kwContainer) return; 
    kwContainer.innerHTML = "";

    if (!meetingData || !meetingData.keywords || meetingData.keywords.length === 0) return;

    (meetingData.keywords || []).forEach(k_obj => {
        const tag = document.createElement("div");
        const isUser = k_obj.source && k_obj.source.toUpperCase() === 'USER';
        const sourceClass = isUser ? 'keyword-user' : 'keyword-ai';
        
        tag.className = `keyword ${sourceClass}`;
        tag.textContent = k_obj.text;
        tag.onclick = () => toggleKeyword(tag, k_obj.text);
        kwContainer.appendChild(tag);
    });
}

function displayDefaultSummary() {
    document.getElementById("purposeView").textContent = "AI 요약을 생성할 수 없습니다.";
    document.getElementById("agendaView").textContent = "API 설정을 확인해주세요.";
    document.getElementById("summaryView").textContent = "HyperCLOVA API 키가 필요합니다.";
}

/* 액션 아이템 렌더링 (박스/리스트 토글 적용) */
function renderActionItems() {
    const placeholder = document.getElementById("actionItemPlaceholder");
    const listContainer = document.getElementById("actionList");
    
    // 1. 데이터가 없으면 -> 플레이스홀더 보임
    if (!actionItems || actionItems.length === 0) {
        if (placeholder) {
            placeholder.classList.remove("hidden");
            placeholder.style.display = "block"; // 강제 표시
        }
        if (listContainer) {
            listContainer.classList.add("hidden");
            listContainer.style.display = "none"; // 강제 숨김
            listContainer.innerHTML = "";
        }
        return;
    }
    
    // 2. 데이터가 있으면 -> 플레이스홀더 숨김, 리스트 보임
    if (placeholder) {
        placeholder.classList.add("hidden");
        placeholder.style.display = "none"; // 강제 숨김
    }
    if (listContainer) {
        listContainer.classList.remove("hidden");
        listContainer.style.display = "block"; // 강제 표시
        listContainer.innerHTML = "";
        
        // 리스트 생성 로직 (기존과 동일)
        actionItems.forEach((a, index) => {
            const isUser = a.source && a.source.toUpperCase() === 'USER';
            const sourceTag = isUser
                ? '<span class="action-source-tag user">사용자</span>'
                : '<span class="action-source-tag ai">AI 생성</span>';

            const div = document.createElement("div");
            div.className = "action-item";
            div.innerHTML = `
                <div class="rfc-action-header">
                    <div class="action-title">${a.title}${sourceTag}</div>
                    <div class="action-controls">
                        <button class="btn-icon-small" onclick="editAction(${index})" title="수정">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button class="btn-icon-small delete" onclick="deleteAction(${index})" title="삭제">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                    </div>
                </div>
                ${a.deadline ? `<div class="action-meta">기한: ${a.deadline}</div>` : ''}
                ${a.assignee ? `<div class="action-meta">담당: ${a.assignee}</div>` : ''}
                <div class="action-buttons">
                    <button class="calendar-btn ${a.addedToCalendar ? 'added' : ''}" onclick="toggleCalendar(${index})">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        ${a.addedToCalendar ? '캘린더에 추가됨' : '캘린더에 추가'}
                    </button>
                </div>
            `;
            listContainer.appendChild(div);
        });
    }
}

/* '내 할 일 생성' 버튼 활성화 상태 체크 */
function checkActionGenerationButtonState() {
    const hasCurrentUser = Object.values(speakerMappingData).includes(currentUserName);
    const generateBtn = document.getElementById('generateMyActionsBtn');

    if (generateBtn) {
        if (hasCurrentUser) {
            generateBtn.disabled = false;
            generateBtn.classList.remove('btn-secondary');
            generateBtn.classList.add('btn-primary');
        } else {
            generateBtn.disabled = true;
            generateBtn.classList.remove('btn-primary');
            generateBtn.classList.add('btn-secondary');
        }
    }
}

function updateTranscriptStats() {
  const countEl = document.getElementById("transcriptCount");
  const mappingEl = document.getElementById("mappingStatus");

  if (!meetingData || !meetingData.transcripts) {
      if (countEl) countEl.textContent = `총 0개 발화`;
      if (mappingEl) mappingEl.textContent = `0/0 매핑 완료`;
      return;
  }

  const activeTranscripts = meetingData.transcripts.filter(t => !t.isDeleted);
  const total = activeTranscripts.length;
  const uniqueSpeakers = [...new Set(activeTranscripts.map(t => t.speaker))];
  const mappedCount = uniqueSpeakers.filter(s => speakerMappingData[s]).length;

  if (countEl) countEl.textContent = `총 ${total}개 발화`;
  if (mappingEl) mappingEl.textContent = `${mappedCount}/${uniqueSpeakers.length} 매핑 완료`;
}

/* ===============================
   발화 점유율 차트
=================================*/
function openParticipationChart() {
  if (!meetingData || !meetingData.transcripts) {
      showErrorMessage("회의 데이터가 없습니다.");
      return;
  }

  const filteredTranscripts = meetingData.transcripts.filter(t => !t.isDeleted);

  if (filteredTranscripts.length === 0) {
      showErrorMessage("표시할 발화 로그가 없습니다.");
      return;
  }

  const speakerCounts = {};
  filteredTranscripts.forEach(t => {
      // 매핑된 이름이 있으면 그것을, 없으면 원본 ID를 사용
      const speaker = speakerMappingData[t.speaker] || t.speakerName || t.speaker;
      speakerCounts[speaker] = (speakerCounts[speaker] || 0) + 1;
  });

  const total = filteredTranscripts.length;
  const chartData = Object.entries(speakerCounts).map(([speaker, count]) => ({
      speaker,
      count,
      percentage: ((count / total) * 100).toFixed(1)
  }));

  // 발화 많은 순 정렬
  chartData.sort((a, b) => {
    if (a.count !== b.count) {
      return b.count - a.count;
    }
    return a.speaker.localeCompare(b.speaker);
  });

  const container = document.getElementById("chartContainer");
  container.innerHTML = "";

  chartData.forEach(data => {
      const barDiv = document.createElement("div");
      barDiv.className = "chart-bar";
      barDiv.innerHTML = `
          <div class="chart-label">
              <span class="chart-name">${data.speaker}</span>
              <span class="chart-percentage">${data.percentage}% (${data.count}회)</span>
          </div>
          <div class="chart-bar-bg">
              <div class="chart-bar-fill" style="width: ${data.percentage}%"></div>
          </div>
      `;
      container.appendChild(barDiv);
  });

  const modal = document.getElementById("chartModal");
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeChartModal() {
  closeModal('chartModal');
}

/* 액션 아이템 렌더링 (화면 표시 강제 적용) */
function renderActionItems() {
    const placeholder = document.getElementById("actionItemPlaceholder");
    const listContainer = document.getElementById("actionList");
    
    // 데이터가 없는 경우
    if (!actionItems || actionItems.length === 0) {
        if (placeholder) {
            placeholder.classList.remove("hidden");
            placeholder.style.display = "block"; // 보이게 설정
        }
        if (listContainer) {
            listContainer.classList.add("hidden");
            listContainer.style.display = "none";  // 숨김 설정
            listContainer.innerHTML = "";
        }
        return;
    }
    
    // 데이터가 있는 경우 (여기가 실행되어야 함)
    if (placeholder) {
        placeholder.classList.add("hidden");
        placeholder.style.display = "none"; // 박스 숨김
    }
    
    if (listContainer) {
        listContainer.classList.remove("hidden");
        listContainer.style.display = "block"; // 리스트 보임
        listContainer.innerHTML = "";
        
        // 리스트 아이템 생성
        actionItems.forEach((a, index) => {
            const isUser = a.source && a.source.toUpperCase() === 'USER';
            const sourceTag = isUser
                ? '<span class="action-source-tag user">사용자</span>'
                : '<span class="action-source-tag ai">AI 생성</span>';

            const div = document.createElement("div");
            div.className = "action-item";
            div.innerHTML = `
                <div class="rfc-action-header">
                    <div class="action-title">${a.title}${sourceTag}</div>
                    <div class="action-controls">
                        <button class="btn-icon-small" onclick="editAction(${index})" title="수정">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button class="btn-icon-small delete" onclick="deleteAction(${index})" title="삭제">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                    </div>
                </div>
                ${a.deadline ? `<div class="action-meta">기한: ${a.deadline}</div>` : ''}
                ${a.assignee ? `<div class="action-meta">담당: ${a.assignee}</div>` : ''}
                <div class="action-buttons">
                    <button class="calendar-btn ${a.addedToCalendar ? 'added' : ''}" onclick="toggleCalendar(${index})">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        ${a.addedToCalendar ? '캘린더에 추가됨' : '캘린더에 추가'}
                    </button>
                </div>
            `;
            listContainer.appendChild(div);
        });
    }
}

function editAction(index) {
    const action = actionItems[index];
    document.getElementById("actionTitle").value = action.title;
    document.getElementById("actionDeadline").value = action.deadline || "";
    
    const assigneeSelect = document.getElementById("actionAssignee");
    assigneeSelect.innerHTML = '<option value="">담당자 선택</option>';
    (meetingData.participants || []).forEach(p => {
        const selected = (p === action.assignee) ? 'selected' : '';
        assigneeSelect.innerHTML += `<option value="${p}" ${selected}>${p}</option>`;
    });

    const assigneeField = document.querySelector('.form-group:has(#actionAssignee)');
    if (assigneeField) assigneeField.style.display = 'block';
    
    const modal = document.getElementById("actionModal");
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    
    const saveBtn = modal.querySelector(".btn-primary");
    saveBtn.textContent = "수정";
    saveBtn.onclick = () => {
        const title = document.getElementById("actionTitle").value.trim();
        if (!title) {
            showErrorMessage("액션 아이템을 입력해주세요.");
            return;
        }
        const deadline = document.getElementById("actionDeadline").value;
        const assignee = document.getElementById("actionAssignee").value;
        
        actionItems[index] = { 
            title, 
            assignee: assignee || "", 
            deadline,
            addedToCalendar: action.addedToCalendar, 
            source: action.source || 'USER',
            isCompleted: action.isCompleted || false
        };
        
        renderActionItems();
        closeActionModal();
        showSuccessMessage("액션 아이템이 수정되었습니다.");
        
        saveBtn.textContent = "추가";
        saveBtn.onclick = saveAction;
    };
}

async function toggleCalendar(index) {      
  const item = actionItems[index];
    if (!item) return;   
    const isAdding = !item.addedToCalendar;

    if (isAdding) {       
        if (!item.deadline) {
            showErrorMessage("캘린더에 추가하려면 '기한'이 설정되어야 합니다.");
            return;
        }
        const bodyData = {
            calendarId: "primary", 
            eventData: {
                summary: item.title, 
                start: { date: item.deadline },
                end: { date: item.deadline }
            }
        };
        try {
            const response = await fetch('http://localhost:8080/api/calendar/events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(bodyData)
            });
            if (!response.ok) throw new Error('캘린더 이벤트 생성에 실패했습니다.');

            const newEvent = await response.json();
            item.googleEventId = newEvent.googleEventId; 
            item.addedToCalendar = true; 
            showSuccessMessage("캘린더에 추가되었습니다.");
        } catch (error) {
            console.error("캘린더 추가 실패:", error);
            showErrorMessage(error.message || "캘린더 추가에 실패했습니다.");
        }
    } else {
        const eventId = item.googleEventId;
        if (!eventId) {
            showErrorMessage("캘린더에서 제거할 수 없습니다. (이벤트 ID 없음)");
            item.addedToCalendar = false;
            renderActionItems();
            return;
        }
        try {
            const response = await fetch(`http://localhost:8080/api/calendar/events/${eventId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            if (!response.ok) throw new Error('캘린더 이벤트 삭제에 실패했습니다.');

            item.googleEventId = null; 
            item.addedToCalendar = false; 
            showErrorMessage("캘린더에서 제거되었습니다.");
        } catch (error) {
            console.error("캘린더 삭제 실패:", error);
            showErrorMessage(error.message || "캘린더 삭제에 실패했습니다.");
        }
    }
    renderActionItems();
}

function openActionModal() {
    const modal = document.getElementById("actionModal");
    document.getElementById("actionTitle").value = "";
    document.getElementById("actionDeadline").value = "";
    
    const assigneeSelect = document.getElementById("actionAssignee");
    assigneeSelect.innerHTML = '<option value="">담당자 선택</option>';
    (meetingData.participants || []).forEach(p => {
        const selected = (p === currentUserName) ? 'selected' : '';
        assigneeSelect.innerHTML += `<option value="${p}" ${selected}>${p}</option>`;
    });
    
    const assigneeField = document.querySelector('.form-group:has(#actionAssignee)');
    if (assigneeField) assigneeField.style.display = 'block';
    
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
}

function saveAction() {
    const title = document.getElementById("actionTitle").value.trim();
    if (!title) {
        showErrorMessage("액션 아이템을 입력해주세요.");
        return;
    }
    const deadline = document.getElementById("actionDeadline").value;
    const assignee = document.getElementById("actionAssignee").value;
    
    actionItems.push({ 
        title, 
        assignee: assignee || "", 
        deadline, 
        addedToCalendar: false, 
        source: 'USER',
        isCompleted: false
    });
    
    renderActionItems();
    closeActionModal();
    showSuccessMessage("액션 아이템이 추가되었습니다.");
}

function closeActionModal() {
    const modal = document.getElementById("actionModal");
    closeModal('actionModal');
    const saveBtn = modal.querySelector(".btn-primary");
    if (saveBtn) {
        saveBtn.textContent = "추가";
        saveBtn.onclick = saveAction;
    }
}

function deleteAction(index) {
  openConfirmModal("액션 아이템 삭제", "이 액션 아이템을 삭제하시겠습니까?", () => {
      actionItems.splice(index, 1);
      renderActionItems();
      showErrorMessage("액션 아이템이 삭제되었습니다.");
  });
}

/* ===============================
   발화 로그(Transcript) 편집
=================================*/
function openAddTranscriptModal() {
    const modal = document.getElementById("addTranscriptModal");
    const speakerSelect = document.getElementById("newTranscriptSpeaker");
    speakerSelect.innerHTML = ""; 
    
    const allParticipantNames = [...(meetingData.participants || [])].sort();
    let speakerOptions = allParticipantNames.map(name => `<option value="${name}">${name}</option>`).join('');
    speakerSelect.innerHTML = `<option value="">발화자를 선택하세요</option>` + speakerOptions;

    document.getElementById("newTranscriptTime").value = "";
    document.getElementById("newTranscriptText").value = "";

    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
}

function closeAddTranscriptModal() { closeModal('addTranscriptModal'); }

/* 발화 추가 (API 호출 X, 로컬 배열에 즉시 추가 + 자동 매핑) */
function saveNewTranscript() {
    const speakerNameInput = document.getElementById("newTranscriptSpeaker");
    const speakerName = speakerNameInput.value.trim();
    const time = document.getElementById("newTranscriptTime").value.trim();
    const text = document.getElementById("newTranscriptText").value.trim();

    if (!speakerName) { showErrorMessage("발화자를 선택해주세요."); return; }
    if (!time || !time.match(/^\d{2}:\d{2}:\d{2}$/)) { showErrorMessage("시간을 '00:00:00' 형식으로 입력해주세요."); return; }
    if (!text) { showErrorMessage("발화 내용을 입력해주세요."); return; }

    // 이름으로 ID 찾기 또는 새 ID 발급 (자동 매핑)
    let finalSpeakerId = null;
    
    // 1. 이미 매핑된 사람인지 확인
    // 예: { "Speaker 1": "가나디" } -> "가나디" 입력 시 "Speaker 1" 찾음
    const mappedId = Object.keys(speakerMappingData).find(key => speakerMappingData[key] === speakerName);
    
    if (mappedId) {
        finalSpeakerId = mappedId; // 이미 아는 사람이면 그 ID 사용
    } else {
        // 2. 모르는 사람이면 -> 새로운 ID 발급 (Speaker N+1)
        // 기존 데이터에서 "Speaker 숫자" 중 가장 큰 숫자를 찾음
        let maxIndex = 0;
        if (meetingData.transcripts) {
            meetingData.transcripts.forEach(t => {
                // DB에서 온 ID(Speaker 1) 또는 로컬에서 만든 ID 확인
                const spkId = t.speaker; 
                if (spkId && spkId.startsWith("Speaker ")) {
                    const num = parseInt(spkId.replace("Speaker ", ""));
                    if (!isNaN(num) && num > maxIndex) maxIndex = num;
                }
            });
        }
        // 다음 번호 생성 (예: Speaker 3)
        finalSpeakerId = "Speaker " + (maxIndex + 1);
        
        // 3. 매핑 데이터에 즉시 등록 (이게 있어야 '매핑 완료'로 뜸)
        speakerMappingData[finalSpeakerId] = speakerName;
    }

    // 2. 시간 변환
    const startTimeMs = timeToMs(time);

    // 3. 로컬 객체 생성
    const newTranscriptObj = {
        id: null, 
        speaker: finalSpeakerId,   // Speaker 1 (또는 새로 딴 ID)
        speakerName: speakerName,  // 가나디
        time: time,
        text: text,
        startTime: startTimeMs,
        endTime: startTimeMs + 3000, 
        isDeleted: false,
        sequenceOrder: meetingData.transcripts ? meetingData.transcripts.length : 0
    };

    // 4. 배열에 추가 및 정렬
    if (!meetingData.transcripts) meetingData.transcripts = [];
    meetingData.transcripts.push(newTranscriptObj);
    
    meetingData.transcripts.sort((a, b) => a.startTime - b.startTime);

    // 5. UI 갱신
    displayTranscripts();
    
    // 여기서 checkMappingCompletion이 돌면서 방금 추가한 speakerMappingData 덕분에 '매핑 완료'로 인식됨
    checkMappingCompletion(); 
    checkActionGenerationButtonState(); // 버튼 상태도 갱신
    
    closeAddTranscriptModal();
    showSuccessMessage("새 발화 로그가 추가되었습니다.");
}

function editTranscript(index) {
  if (currentEditingTranscriptIndex !== -1) cancelTranscriptEdit(currentEditingTranscriptIndex);
  currentEditingTranscriptIndex = index;

  const item = document.querySelector(`.transcript-item[data-index="${index}"]`);
  const textDiv = item.querySelector(".transcript-text");
  const originalText = meetingData.transcripts[index].text;

  const mappedNames = [...new Set(Object.values(speakerMappingData))];
  const participantNames = meetingData.participants || [];
  const allNames = [...new Set([...mappedNames, ...participantNames])].sort();

  const currentSpeakerId = meetingData.transcripts[index].speaker;
  const currentSpeakerName = speakerMappingData[currentSpeakerId] || meetingData.transcripts[index].speakerName || currentSpeakerId;

  let speakerOptions = allNames.map(name =>
    `<option value="${name}" ${name === currentSpeakerName ? 'selected' : ''}>${name}</option>`
  ).join('');

  textDiv.innerHTML = `
      <div class="form-group transcript-editor-group">
          <label class="form-label transcript-editor-label">발화자 변경</label>
          <select class="form-select" id="transcript-speaker-editor-${index}">${speakerOptions}</select>
      </div>
      <div class="form-group">
          <label class="form-label transcript-editor-label">내용 수정</label>
          <textarea class="summary-editor transcript-editor-textarea" id="transcript-text-editor-${index}">${originalText}</textarea>
      </div>
      <div class="transcript-editor-actions">
          <button class="btn btn-secondary" onclick="cancelTranscriptEdit(${index})">취소</button>
          <button class="btn btn-primary" onclick="saveTranscriptEdit(${index})">저장</button>
      </div>
  `;
  document.getElementById(`transcript-text-editor-${index}`).focus();
}

/* 발화 수정 (ID 동기화 및 자동 매핑 추가) */
function saveTranscriptEdit(index) {
    const speakerEditor = document.getElementById(`transcript-speaker-editor-${index}`);
    const textEditor = document.getElementById(`transcript-text-editor-${index}`);
    const newSpeakerName = speakerEditor.value; 
    const newText = textEditor.value.trim();

    if (!newText) { showErrorMessage("내용을 입력해주세요."); return; }

    // 변경된 이름에 맞춰 ID 재설정 (saveNewTranscript와 동일 로직 적용)
    let finalSpeakerId = null;

    // 1. 이미 매핑된 사람인지 확인 (이름으로 ID 찾기)
    const mappedId = Object.keys(speakerMappingData).find(key => speakerMappingData[key] === newSpeakerName);

    if (mappedId) {
        finalSpeakerId = mappedId; // 이미 있는 사람이면 그 ID 사용
    } else {
        // 2. 새로운 사람이면 -> 새 ID 발급 (Speaker N+1)
        let maxIndex = 0;
        if (meetingData.transcripts) {
            meetingData.transcripts.forEach(t => {
                const spkId = t.speaker; 
                if (spkId && spkId.startsWith("Speaker ")) {
                    const num = parseInt(spkId.replace("Speaker ", ""));
                    if (!isNaN(num) && num > maxIndex) maxIndex = num;
                }
            });
        }
        finalSpeakerId = "Speaker " + (maxIndex + 1);
        
        // 3. 매핑 데이터에 즉시 등록 (실시간 반영을 위해 필수)
        speakerMappingData[finalSpeakerId] = newSpeakerName;
        
        // 참석자 목록에도 없으면 추가해줌 (UI 일관성)
        if (!meetingData.participants.includes(newSpeakerName)) {
            meetingData.participants.push(newSpeakerName);
        }
    }

    // 데이터 반영
    meetingData.transcripts[index].text = newText;
    meetingData.transcripts[index].speaker = finalSpeakerId; 
    meetingData.transcripts[index].speakerName = newSpeakerName; 

    currentEditingTranscriptIndex = -1;
    
    // UI 및 상태 갱신
    displayTranscripts();
    checkMappingCompletion();       // 매핑 카운트 갱신 (이제 3/3으로 정상 계산됨)
    checkActionGenerationButtonState(); // 내 할 일 버튼 상태 갱신
    
    showSuccessMessage("발화 로그가 수정되었습니다.");
}

/* 삭제 함수 (API 호출 X, 화면에서만 처리) */
function deleteTranscript(index) {
  if (!meetingData || !meetingData.transcripts[index]) return;
  
  // 메모리 상에서 상태 변경
  meetingData.transcripts[index].isDeleted = true;
  
  // 화면 갱신
  displayTranscripts();
  checkMappingCompletion();
  checkActionGenerationButtonState();
  
  // 안내 메시지
  showErrorMessage("발화 로그가 삭제 상태로 변경되었습니다.");
}

/* 복구 함수 (API 호출 X, 화면에서만 처리) */
function undoTranscript(index) {
  if (!meetingData || !meetingData.transcripts[index]) return;
  
  // 메모리 상에서 상태 변경
  meetingData.transcripts[index].isDeleted = false;
  
  // 화면 갱신
  displayTranscripts();
  checkMappingCompletion();
  checkActionGenerationButtonState();
}

function cancelTranscriptEdit(index) {
  currentEditingTranscriptIndex = -1;
  displayTranscripts();
}

/* ===============================
   저장 및 내보내기
=================================*/
function toggleDropdown() {
  const dropdown = document.getElementById("downloadDropdown");
  if (dropdown) dropdown.classList.toggle("show");
}

// 드롭다운 외부 클릭 시 닫기
document.addEventListener("click", (e) => {
  const dropdown = document.getElementById("downloadDropdown");
  const btn = document.getElementById("downloadBtn");
  if (dropdown && btn && !dropdown.contains(e.target) && !btn.contains(e.target)) {
    dropdown.classList.remove("show");
  }
});

/* 내보내기용 데이터 수집 */
function collectFinalData() {
  // 1. 삭제되지 않은 발화만 필터링 및 이름 매핑 적용
  const filteredTranscripts = (meetingData.transcripts || [])
      .filter(t => !t.isDeleted)
      .map(t => {
          const displayName = speakerMappingData[t.speaker] || t.speakerName || t.speaker;
          return {
              id: t.speaker,      // 원본 ID (Speaker 1) - 필요 시 참조용
              name: displayName,
              time: t.time,       
              text: t.text
          };
      });

  // 2. 키워드: 텍스트와 출처(AI/USER) 모두 포함
  const fullKeywords = (meetingData.keywords || []).map(k => ({
      text: k.text,
      source: k.source ? k.source.toUpperCase() : "USER"
  }));

  // 3. 액션 아이템: 출처(AI/USER) 포함
  const fullActions = actionItems.map(a => ({
      task: a.title,
      assignee: a.assignee || "미지정",
      deadline: a.deadline || "-",
      isCompleted: a.isCompleted,
      source: a.source ? a.source.toUpperCase() : "USER"
  }));

  // 4. 중요도 데이터 처리
  let importanceData = { level: "보통", reason: "분석된 내용이 없습니다." };
  if (meetingData.importance) {
      if (typeof meetingData.importance === 'object') {
          importanceData.level = meetingData.importance.level || "보통";
          importanceData.reason = meetingData.importance.reason || "";
      } else {
          importanceData.level = meetingData.importance;
      }
  }

  return {
    title: meetingData.title || "회의록",
    date: document.getElementById("meetingDate") ? document.getElementById("meetingDate").textContent : "",
    duration: document.getElementById("meetingDuration") ? document.getElementById("meetingDuration").textContent : "",
    
    // 참석자 목록 + 참석자 수
    participants: meetingData.participants || [],
    participantCount: (meetingData.participants || []).length,
    
    purpose: meetingData.purpose || "내용 없음",
    agenda: meetingData.agenda || "내용 없음",
    summary: meetingData.summary || "내용 없음",
    
    // 중요도 (값 + 내용)
    importance: importanceData,

    // 출처가 포함된 객체 리스트
    keywords: fullKeywords,
    actions: fullActions,
    
    transcripts: filteredTranscripts
  };
}

/* JSON 내보내기 */
function exportJSON() {
  const dropdown = document.getElementById("downloadDropdown");
  if (dropdown) dropdown.classList.remove("show");
  
  try {
      const data = collectFinalData();
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${data.title.replace(/\s+/g, '_')}_Results.json`;
      document.body.appendChild(a);
      a.click();
      
      setTimeout(() => {
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
      }, 100);

      showSuccessMessage("JSON 파일이 다운로드되었습니다.");
  } catch (e) {
      console.error("JSON 내보내기 실패:", e);
      showErrorMessage("JSON 생성 중 오류가 발생했습니다.");
  }
}

/* PDF 내보내기 */
async function exportPDF() {
    const dropdown = document.getElementById("downloadDropdown");
    if (dropdown) dropdown.classList.remove("show");

    if (typeof jspdf === 'undefined') {
        showErrorMessage("PDF 라이브러리(jspdf)가 로드되지 않았습니다.");
        return;
    }

    showLoadingMessage("PDF 파일을 생성 중입니다...");

    try {
        // 1. 한글 폰트 로드 (절대 경로 권장)
        const fontPath = '/static/fonts/NotoSansKR-Regular.ttf';
        const fontResponse = await fetch(fontPath);
        
        if (!fontResponse.ok) throw new Error(`폰트 파일을 찾을 수 없습니다. (${fontPath})`);
        
        const fontBuffer = await fontResponse.arrayBuffer();
        const fontData = btoa(
            new Uint8Array(fontBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );

        const { jsPDF } = jspdf;
        const doc = new jsPDF();
        const data = collectFinalData();

        doc.addFileToVFS('NotoSansKR-Regular.ttf', fontData);
        doc.addFont('NotoSansKR-Regular.ttf', 'NotoSansKR', 'normal');
        doc.setFont('NotoSansKR', 'normal');

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 20;
        const contentWidth = pageWidth - (margin * 2);
        let currentY = 20;

        // --- [헤더] ---
        doc.setFontSize(22);
        doc.setTextColor(44, 62, 80);
        const titleLines = doc.splitTextToSize(data.title, contentWidth);
        doc.text(titleLines, margin, currentY);
        currentY += (titleLines.length * 10) + 10;

        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`일시: ${data.date}  |  시간: ${data.duration}`, margin, currentY);
        currentY += 6;
        
        // 참석자 수 표시
        const partText = `참석자(${data.participantCount}명): ${data.participants.join(', ')}`;
        const partLines = doc.splitTextToSize(partText, contentWidth);
        doc.text(partLines, margin, currentY);
        currentY += (partLines.length * 6) + 10;

        doc.setDrawColor(200, 200, 200);
        doc.line(margin, currentY, pageWidth - margin, currentY);
        currentY += 15;

        // --- 1. AI 요약 ---
        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        doc.text("1. AI 요약", margin, currentY);
        currentY += 10;

        doc.setFontSize(11);

        // 중요도 표시
        const impLevel = data.importance.level;
        let impColor = [0, 0, 0]; // 기본 검정
        if (impLevel === 'HIGH' || impLevel === '높음') impColor = [231, 76, 60]; // 빨강
        else if (impLevel === 'LOW' || impLevel === '낮음') impColor = [39, 174, 96]; // 초록
        
        doc.setTextColor(...impColor);
        doc.text(`[중요도: ${impLevel}]`, margin, currentY);
        doc.setTextColor(80, 80, 80);
        
        // 중요도 사유 줄바꿈 처리
        const reasonLines = doc.splitTextToSize(`- 사유: ${data.importance.reason}`, contentWidth);
        doc.text(reasonLines, margin, currentY + 6);
        currentY += (reasonLines.length * 6) + 10;

        // 목적, 안건, 요약 내용
        const summaryItems = [
            { label: "회의 목적", text: data.purpose },
            { label: "주요 안건", text: data.agenda },
            { label: "전체 요약", text: data.summary }
        ];

        summaryItems.forEach(item => {
            doc.setTextColor(0, 0, 0); // 라벨 검정
            doc.text(`[${item.label}]`, margin, currentY);
            
            doc.setTextColor(80, 80, 80); // 내용 회색
            const textLines = doc.splitTextToSize(item.text, contentWidth - 5);
            doc.text(textLines, margin + 5, currentY + 6);
            
            currentY += (textLines.length * 6) + 10;
            
            if (currentY > pageHeight - margin) { doc.addPage(); currentY = 20; }
        });

        // 하이라이트 키워드 (출처 표시)
        doc.setTextColor(0, 0, 0);
        doc.text(`[하이라이트 키워드]`, margin, currentY);
        currentY += 6;
        
        if (data.keywords.length > 0) {
            // 가로로 나열하기 위해 텍스트 병합
            const keywordStr = data.keywords.map(k => {
                const tag = k.source === 'AI' ? '(AI)' : '(User)';
                return `${k.text} ${tag}`;
            }).join(',  ');
            
            const kwLines = doc.splitTextToSize(keywordStr, contentWidth - 5);
            doc.setTextColor(41, 128, 185); // 파란색 계열
            doc.text(kwLines, margin + 5, currentY);
            currentY += (kwLines.length * 6) + 10;
        } else {
            doc.text("키워드 없음", margin + 5, currentY);
            currentY += 10;
        }

        // --- 2. 액션 아이템 ---
        if (currentY > pageHeight - 40) { doc.addPage(); currentY = 20; }
        
        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        doc.text("2. 액션 아이템", margin, currentY);
        currentY += 8;

        if (data.actions.length > 0) {
            doc.setFontSize(10);
            data.actions.forEach(action => {
                // 출처(AI/User) 표시
                const sourceTag = action.source === 'AI' ? '[AI]' : '[User]';
                const actionText = `• ${sourceTag} ${action.task} (담당: ${action.assignee}, 기한: ${action.deadline})`;
                const actionLines = doc.splitTextToSize(actionText, contentWidth);
                
                if (currentY + (actionLines.length * 6) > pageHeight - margin) {
                    doc.addPage();
                    currentY = 20;
                }
                
                doc.text(actionLines, margin, currentY);
                currentY += (actionLines.length * 6) + 2;
            });
        } else {
            doc.setFontSize(10);
            doc.setTextColor(150, 150, 150);
            doc.text("등록된 액션 아이템이 없습니다.", margin, currentY);
            doc.setTextColor(0, 0, 0);
            currentY += 10;
        }
        currentY += 10;

        // --- 3. 상세 대화 내용 ---
        doc.addPage();
        currentY = 20;

        doc.setFontSize(14);
        doc.text("3. 상세 대화 내용", margin, currentY);
        currentY += 10;

        doc.setFontSize(10);
        
        // 발화자별 색상 지정을 위한 맵
        const speakerColors = {};
        // 사용할 색상 팔레트 (파랑, 빨강, 초록, 보라, 주황, 청록, 갈색)
        const colorPalette = [
            [41, 128, 185], [192, 57, 43], [39, 174, 96], 
            [142, 68, 173], [211, 84, 0], [22, 160, 133], [127, 140, 141]
        ];
        let colorIndex = 0;

        if (data.transcripts.length > 0) {
            data.transcripts.forEach(t => {
                // 발화자 색상 할당
                if (!speakerColors[t.name]) {
                    speakerColors[t.name] = colorPalette[colorIndex % colorPalette.length];
                    colorIndex++;
                }
                const thisColor = speakerColors[t.name];

                // 헤더: 이름 [시간]
                const header = `${t.name} [${t.time}]`;
                doc.setTextColor(...thisColor); // 이름에 색상 적용
                doc.text(header, margin, currentY);
                currentY += 5;

                // 내용
                doc.setTextColor(0, 0, 0); // 내용은 검정
                const textLines = doc.splitTextToSize(t.text, contentWidth);
                
                const requiredHeight = (textLines.length * 5) + 10;
                if (currentY + requiredHeight > pageHeight - margin) {
                    doc.addPage();
                    currentY = 20;
                    // 페이지 넘김 후 헤더 반복 표시
                    doc.setTextColor(...thisColor);
                    doc.text(`${header} (계속)`, margin, currentY);
                    currentY += 5;
                    doc.setTextColor(0, 0, 0);
                }

                doc.text(textLines, margin, currentY);
                currentY += (textLines.length * 5) + 8;
            });
        } else {
            doc.setTextColor(150, 150, 150);
            doc.text("대화 내용이 없습니다.", margin, currentY);
        }

        hideLoadingMessage();
        doc.save(`${data.title.replace(/\s+/g, '_')}.pdf`);
        showSuccessMessage("PDF 파일이 다운로드되었습니다.");

    } catch (error) {
        hideLoadingMessage();
        console.error("PDF 생성 오류:", error);
        showErrorMessage("PDF 생성 중 오류가 발생했습니다: " + error.message);
    }
}

// 서버 전송 데이터 수집 (ID/이름 구분 및 참석자 포함)
function collectUpdateData() {
    // 1. 중요도 데이터 처리
    let importanceData = { level: "MEDIUM", reason: "" };
    if (meetingData.importance) {
        if (typeof meetingData.importance === 'object') {
            importanceData.level = meetingData.importance.level || "MEDIUM";
            importanceData.reason = meetingData.importance.reason || "";
        } else {
            importanceData.level = meetingData.importance; 
        }
    }

    // 2. 키워드 리스트 처리 (기존 동일)
    const keywordList = (meetingData.keywords || []).map(k => ({
        text: k.text, source: k.source ? k.source.toUpperCase() : "USER"
    }));

    // 3. 액션 아이템 리스트 처리 (기존 동일)
    const actionItemList = (actionItems || []).map(item => ({
        task: item.title, 
        assignee: item.assignee, 
        dueDate: item.deadline,
        source: item.source ? item.source.toUpperCase() : "USER",
        isCompleted: item.isCompleted || false 
    }));

    // 4. 참석자 명단 처리 (기존 동일)
    const participantList = (meetingData.participants || []).map(name => {
        let originalId = Object.keys(speakerMappingData).find(key => speakerMappingData[key] === name);
        if (!originalId) {
            originalId = name;
        }
        return {
            speakerId: originalId, 
            name: name             
        };
    });

    // 5. 발화 로그(Transcript) 처리
    // 먼저 시간순으로 정렬을 확실하게 합니다.
    const sortedTranscripts = (meetingData.transcripts || []).sort((a, b) => a.startTime - b.startTime);

    const transcriptList = sortedTranscripts.map((t, index) => {
        let realSpeakerId = t.speaker; 
        if (!realSpeakerId) {
            realSpeakerId = t.speakerName || "Unknown";
        }

        return {
            id: t.id, 
            speaker: realSpeakerId,
            speakerName: t.speakerName,
            text: t.text || "",
            startTime: t.startTime || 0,
            endTime: t.endTime || 0,
            
            // 현재 정렬된 순서(index)대로 번호를 다시 매깁니다. (0, 1, 2, 3...)
            // 이렇게 하면 중간에 삭제하거나 추가해도 DB에는 깔끔한 순서로 저장됩니다.
            sequenceOrder: index, 
            
            isDeleted: t.isDeleted || false 
        };
    });

    // 6. 최종 리턴 (기존 동일)
    return {
        title: meetingData.title,
        purpose: meetingData.purpose,
        agenda: meetingData.agenda,
        summary: meetingData.summary,
        importance: importanceData,
        keywords: keywordList,
        actionItems: actionItemList,
        participants: participantList, 
        transcripts: transcriptList
    };
}

async function saveMeeting() {
    if (!meetingData) {
        showErrorMessage("저장할 회의 데이터가 없습니다.");
        return;
    }
    const meetingId = getMeetingId();
    if (!meetingId) {
        showErrorMessage("회의 ID를 찾을 수 없습니다.");
        return;
    }

    const updateDto = collectUpdateData();
    console.log("📤 서버로 전송할 데이터:", updateDto);
    showLoadingMessage("회의록을 서버에 저장 중...");

    try {
        const response = await fetch(`http://localhost:8080/api/meetings/${meetingId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(updateDto)
        });

        if (!response.ok) throw new Error(await response.text());

        hideLoadingMessage();
        showSuccessMessage("회의록이 서버에 저장되었습니다.");
        
        if (meetingData) {
            meetingData.actions = actionItems;
            localStorage.setItem("lastMeeting", JSON.stringify(meetingData));
        }
    } catch (error) {
        hideLoadingMessage();
        console.error("서버 저장 실패:", error);
        showErrorMessage(`서버 저장 실패: ${error.message}`);
    }
}

/* 매핑 완료 상태 체크 및 AI 요약 버튼 활성화 */
function checkMappingCompletion() {
    if (!meetingData || !meetingData.transcripts) return;

    // 1. '삭제되지 않은' 로그들만 대상으로 함
    const activeTranscripts = meetingData.transcripts.filter(t => !t.isDeleted);
    
    // 2. DB에 저장된 원본 Speaker ID들의 집합 (예: Speaker 1, Speaker 2...)
    const uniqueSpeakerIds = [...new Set(activeTranscripts.map(t => t.speaker))];
    
    // 3. 실제로 매핑이 되었는지 확인하는 로직 수정
    // speakerMappingData에 해당 ID가 키로 존재하고, 값(이름)이 비어있지 않아야 함
    const mappedCount = uniqueSpeakerIds.filter(id => {
        const mappedName = speakerMappingData[id];
        return mappedName && mappedName.trim() !== "";
    }).length;

    const totalSpeakers = uniqueSpeakerIds.length;
    const allMapped = totalSpeakers > 0 && mappedCount === totalSpeakers;

    // UI 업데이트
    const mappingStatusEl = document.getElementById("mappingStatus");
    if (mappingStatusEl) {
        mappingStatusEl.textContent = `${mappedCount}/${totalSpeakers} 매핑 완료`;
    }

    const generateBtn = document.getElementById('generateSummaryBtn');
    if (generateBtn) {
        generateBtn.disabled = !allMapped;
    }
    
    // 매핑 상태가 변했으므로 내 할 일 버튼 상태도 같이 체크해줌
    checkActionGenerationButtonState(); 
}

/* '내 할 일 생성' 버튼 활성화 상태 체크 (로직 강화) */
function checkActionGenerationButtonState() {
    const generateBtn = document.getElementById('generateMyActionsBtn');
    const placeholder = document.getElementById("actionItemPlaceholder");
    const listContainer = document.getElementById("actionList");

    // 단순히 매핑 목록만 보는 게 아니라, '활성 발화'에 내가 있는지 확인
    let userHasTranscript = false;
    
    if (meetingData && meetingData.transcripts) {
        // 1. 삭제되지 않은 발화들만 추림
        const activeTranscripts = meetingData.transcripts.filter(t => !t.isDeleted);
        
        // 2. 활성 발화들의 Speaker ID를 이용해 매핑된 이름을 찾음
        // 그 이름 중에 '현재 로그인한 사용자'가 있는지 확인
        userHasTranscript = activeTranscripts.some(t => {
            const mappedName = speakerMappingData[t.speaker];
            return mappedName === currentUserName;
        });
    }

    // 버튼 상태 제어
    if (generateBtn) {
        if (userHasTranscript) {
            // 내가 발화자에 포함되어 있으면 활성화
            generateBtn.disabled = false;
            generateBtn.classList.remove('btn-secondary');
            generateBtn.classList.add('btn-primary');
        } else {
            // 없으면 비활성화 (가나디 -> 새로운 으로 바꾸면 즉시 비활성됨)
            generateBtn.disabled = true;
            generateBtn.classList.remove('btn-primary');
            generateBtn.classList.add('btn-secondary');
        }
    }
}

/* 화자 매핑 저장 (API 호출 X, 로컬 변수만 업데이트) */
function saveSpeakerMapping() {
    // 선택된 변경사항이 없으면 그냥 닫기
    if (!tempSelectedParticipant) {
        closeSpeakerModal();
        return;
    }

    const speakerId = currentMappingSpeaker; // 예: Speaker 1
    const newName = tempSelectedParticipant; // 예: 가나디

    // 1. 전역 매핑 데이터 업데이트
    speakerMappingData[speakerId] = newName;

    // 2. 메모리에 있는 Transcript들의 speakerName도 일괄 업데이트 (화면 즉시 반영용)
    if (meetingData && meetingData.transcripts) {
        meetingData.transcripts.forEach(t => {
            // ID가 일치하면 이름을 변경
            if (t.speaker === speakerId) {
                t.speakerName = newName;
            }
        });
    }

    // 3. UI 갱신 및 모달 닫기
    closeSpeakerModal();
    displayTranscripts(); 
    checkMappingCompletion();
    checkActionGenerationButtonState();

    showSuccessMessage("발화자 매핑이 적용되었습니다.");
}

/* 내 할 일 생성 (플레이스홀더 토글 추가) */
async function generateMyActions() {
    if (!meetingData || !meetingData.transcripts) {
        showErrorMessage("회의 데이터가 없습니다.");
        return;
    }

    showLoadingMessage("내 할 일을 생성하는 중...");
    const generateBtn = document.getElementById('generateMyActionsBtn');
    if (generateBtn) generateBtn.disabled = true;

    let userSettings = {};
    try {
        userSettings = JSON.parse(localStorage.getItem('userSettings')) || {};
    } catch (e) { console.warn("localStorage 파싱 오류", e); }
    
    const userJob = userSettings.job || "general"; 
    const meetingId = getMeetingId();
    
    if (!meetingId) {
        showErrorMessage("Meeting ID를 찾을 수 없습니다.");
        return;
    }

    try {
        const response = await fetch(`http://localhost:8080/api/meetings/generate-all-actions?meetingId=${meetingId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                transcripts: meetingData.transcripts.filter(t => !t.isDeleted),
                speakerMapping: speakerMappingData,
                meetingDate: meetingData.date,
                userJob: (userJob === "NONE" || !userJob) ? "general" : userJob,
                currentUserName: currentUserName
            })
        });

        if (response.status === 401) throw new Error("로그인이 필요합니다.");
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || `서버 오류: ${response.status}`);
        }

        const data = await response.json();
        hideLoadingMessage();

        if (data.success) {
            const aiActions = (data.actions || []).map(a => ({ ...a, source: 'AI' }));

            // 내 것만 필터링
            const aiMyActions = aiActions.filter(action => 
                action.assignee === currentUserName || 
                action.assignee === '' ||              
                action.assignee === null ||            
                (action.assignee && action.assignee.includes('팀')) ||      
                (action.assignee && action.assignee.includes('미지정'))    
            );
            
            const userManualActions = (actionItems || []).filter(item => item.source === 'USER');
            actionItems = [...userManualActions, ...aiMyActions];

            // 데이터 갱신 후 화면 다시 그리기 (플레이스홀더 토글 포함)
            meetingData.actions = actionItems;
            
            // 1. 플레이스홀더 숨기고 리스트 보이기
            const placeholder = document.getElementById("actionItemPlaceholder");
            const listContainer = document.getElementById("actionList");
            if (placeholder) placeholder.classList.add("hidden");
            if (listContainer) listContainer.classList.remove("hidden");

            // 2. 리스트 렌더링
            renderActionItems();

            // 성공 메시지
            if (aiMyActions.length > 0) {
                showSuccessMessage(`${aiMyActions.length}개의 할 일이 생성되었습니다!`);
            } else if (userManualActions.length > 0) {
                showSuccessMessage("AI가 추가로 생성한 할 일은 0개입니다.");
            } else {
                showErrorMessage("회원님이 담당하는 액션 아이템이 없습니다.");
            }
        } else {
            throw new Error(data.error || "알 수 없는 오류");
        }
    } catch (error) {
        hideLoadingMessage();
        console.error('내 할 일 생성 실패:', error);
        showErrorMessage(error.message || '할 일 생성에 실패했습니다.');
    } finally {
        if (generateBtn) generateBtn.disabled = false;
    }
}

function showLoadingMessage(msg) {
    let div = document.getElementById("loadingToast");
    if (!div) {
        div = document.createElement("div");
        div.id = "loadingToast";
        Object.assign(div.style, {
            position: "fixed",
            top: "24px",
            right: "24px",
            background: "#8E44AD",
            color: "#fff",
            padding: "12px 20px",
            borderRadius: "8px",
            zIndex: "9999",
        });
        document.body.appendChild(div);
    }
    div.textContent = msg;
}

function hideLoadingMessage() {
    const toast = document.getElementById("loadingToast");
    if (toast) toast.remove();
}

/* ===============================
   발화자 분석 상태 체크 및 UI 업데이트
=================================*/

// 발화자 분석이 필요한지 확인하고 UI 업데이트
function checkSpeakerAnalysisStatus() {
    if (!meetingData) return;

    // audioFileUrl이 있고, transcript가 비어있을 때 분석 버튼 표시
    const needsAnalysis = meetingData.audioFileUrl && 
                        (!meetingData.transcripts || meetingData.transcripts.length === 0);

    // 발화자 분석 버튼 찾기
    let analysisBtn = document.getElementById('startSpeakerAnalysisBtn');
    const transcriptHeader = document.querySelector('.transcript-area .area-meta'); 
    
    if (needsAnalysis) {
        // 버튼이 없으면 생성
        if (!analysisBtn && transcriptHeader) {
            analysisBtn = createSpeakerAnalysisButton();
            transcriptHeader.insertAdjacentElement('afterend', analysisBtn);
        }
        
        // 버튼 활성화
        if(analysisBtn) {
            analysisBtn.disabled = false;
            analysisBtn.style.display = 'flex';
        }
        
        console.log('💡 발화자 분석이 필요합니다. 버튼을 클릭하여 시작하세요.');
    } else if (analysisBtn) {
        // Transcript가 있거나 오디오 파일이 없으면 버튼 숨기기
        analysisBtn.style.display = 'none';
        console.log('발화자 분석이 필요 없거나 완료됨 - 버튼 숨김');
    }
}

// 발화자 분석 시작 버튼 생성 (DOM 조작)
function createSpeakerAnalysisButton() {
    const button = document.createElement('button');
    button.id = 'startSpeakerAnalysisBtn';
    button.className = 'btn btn-primary'; 
    button.style.marginTop = '16px';
    button.style.width = '100%';
    button.style.justifyContent = 'center';
    button.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
        <span>발화자 구분 분석 시작</span>
    `;
    
    button.onclick = handleSpeakerAnalysisButtonClick;
    
    // Analyzing 상태용 스타일 동적 추가
    const style = document.createElement('style');
    style.textContent = `
        .btn.analyzing {
            background: #f97316;
            cursor: wait;
        }
        .btn.analyzing:hover {
            background: #ea580c;
            transform: none;
            box-shadow: none;
        }
        .btn.analyzing span::after {
            content: '...';
            animation: dots 1.5s steps(4, end) infinite;
            display: inline-block;
            width: 20px;
            text-align: left;
        }
        @keyframes dots {
            0%, 20% { content: '.'; }
            40% { content: '..'; }
            60%, 100% { content: '...'; }
        }
    `;
    
    if (!document.getElementById('speaker-analysis-btn-style')) {
        style.id = 'speaker-analysis-btn-style';
        document.head.appendChild(style);
    }
    
    return button;
}

// 발화자 분석 버튼 클릭 핸들러
async function handleSpeakerAnalysisButtonClick() {
    const button = document.getElementById('startSpeakerAnalysisBtn');
    
    if (!meetingData || !meetingData.audioFileUrl) {
        showErrorMessage('오디오 파일 정보가 없습니다.');
        return;
    }
    
    if (speakerAnalysisToken) {
        showErrorMessage('이미 발화자 분석이 진행 중입니다.');
        return;
    }
    
    openConfirmModal(
        '발화자 구분 분석',
        '발화자 구분 분석을 시작하시겠습니까?<br><span style="color: #6b7280; font-size: 13px;">분석 시간은 녹음 길이에 따라 다르며, 수 분이 소요될 수 있습니다.</span>',
        async () => {
            button.disabled = true;
            button.classList.add('analyzing');
            button.querySelector('span').textContent = '분석 중';
            
            await startSpeakerAnalysis(meetingData.audioFileUrl);
        }
    );
}

/**
 * [서버 저장] 발화자 분석 완료 후 생성된 Transcript 데이터를 서버에 일괄 저장
 * (분석이 끝나자마자 호출됨)
 */
async function saveMeetingDataToServer() {
    if (!meetingData || !meetingData.transcripts || meetingData.transcripts.length === 0) {
        console.warn('저장할 Transcript 데이터가 없습니다.');
        return;
    }

    const meetingId = getMeetingId();
    if (!meetingId) {
        console.error('Meeting ID를 찾을 수 없어 서버 저장 불가');
        showErrorMessage('회의 ID를 찾을 수 없습니다.');
        return;
    }

    console.log(`💾 Transcript 서버 저장 시작... (Meeting ID: ${meetingId})`);

    try {
        const transcriptDtos = meetingData.transcripts.map((transcript, index) => {
            const speakerLabel = transcript.speakerLabel !== undefined 
                ? transcript.speakerLabel 
                : null;

            return {
                speakerId: transcript.speaker,
                speakerName: transcript.speakerName || transcript.speaker,
                speakerLabel: speakerLabel,
                text: transcript.text,
                startTime: transcript.startTime,
                endTime: transcript.endTime,
                // timeLabel은 DTO에 없으면 무시됨 (계산 가능하므로)
                sequenceOrder: transcript.sequenceOrder !== undefined ? transcript.sequenceOrder : index
            };
        });

        console.log(`📤 전송할 Transcript 수: ${transcriptDtos.length}개`);

        const response = await fetch(
            `http://localhost:8080/api/transcripts/batch?meetingId=${meetingId}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(transcriptDtos)
            }
        );

        if (!response.ok) throw new Error(`서버 응답 오류: ${response.status}`);

        const savedTranscripts = await response.json();
        console.log(`Transcript ${savedTranscripts.length}개 서버 저장 완료`);
        
        showSuccessMessage(`발화 로그 ${savedTranscripts.length}개가 저장되었습니다.`);

        // 저장 후 ID 동기화 (추후 편집/삭제를 위해)
        savedTranscripts.forEach(savedDto => {
            const matchingTranscript = meetingData.transcripts.find(
                t => t.sequenceOrder === savedDto.sequenceOrder
            );
            if (matchingTranscript) {
                matchingTranscript.id = savedDto.id;
                matchingTranscript.createdAt = savedDto.createdAt;
                matchingTranscript.updatedAt = savedDto.updatedAt;
            }
        });

    } catch (error) {
        console.error('❌ Transcript 서버 저장 실패:', error);
        showErrorMessage('발화 로그 저장에 실패했습니다.');
    }
}

/* ===============================
   참석자(발화자) 관리 및 매핑 함수
=================================*/
function openSpeakerModal(speaker) {
  currentMappingSpeaker = speaker;
  tempSelectedParticipant = speakerMappingData[speaker] || null;
  const modal = document.getElementById("speakerModal");
  const list = document.getElementById("participantList");
  list.innerHTML = "";
  
  (meetingData.participants || []).forEach((p, index) => {
      const item = document.createElement("div");
      item.className = "participant-item";
      if (tempSelectedParticipant === p) item.classList.add("selected");
      
      item.innerHTML = `
          <div class="participant-avatar">${p.charAt(0)}</div>
          <span class="participant-name">${p}</span>
          <button class="participant-delete-btn" onclick="event.stopPropagation(); deleteParticipant(${index})" title="삭제">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
          </button>
      `;
      item.onclick = () => selectParticipant(item, p);
      list.appendChild(item);
  });

  const addForm = document.createElement("div");
  addForm.className = "add-participant-form";
  addForm.innerHTML = `
      <input type="text" class="add-participant-input" id="newParticipantInput" placeholder="새 참석자 이름 입력">
      <button class="add-participant-btn" onclick="addParticipant()">추가</button>
  `;
  list.appendChild(addForm);
  
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";

  setTimeout(() => {
      const input = document.getElementById("newParticipantInput");
      if (input) {
          input.addEventListener("keypress", (e) => {
              if (e.key === "Enter") addParticipant();
          });
      }
  }, 100);
}

/* 참석자 추가 (API 호출 X, 로컬 배열에만 추가) */
function addParticipant() {
    const input = document.getElementById("newParticipantInput");
    const name = input.value.trim();
    
    if (!name) { showErrorMessage("참석자 이름을 입력해주세요."); return; }
    
    if (!meetingData.participants) meetingData.participants = [];
    if (meetingData.participants.includes(name)) {
        showErrorMessage("이미 존재하는 참석자입니다.");
        return;
    }

    // 1. 로컬 메모리에 먼저 추가
    meetingData.participants.push(name);
    input.value = "";

    // 2. 서버 저장(saveMeeting) 제거 -> 로컬 화면만 갱신
    // 모달 UI 갱신
    const speaker = currentMappingSpeaker;
    closeSpeakerModal();
    openSpeakerModal(speaker);
    
    // 메인 화면 참석자 수 갱신
    displayMeetingInfo();
    
    // 안내 메시지 변경
    showSuccessMessage("참석자가 추가되었습니다.");
}

/* 참석자 삭제 (API 호출 X, 로컬 배열에서만 삭제) */
function deleteParticipant(index) {
  const participant = meetingData.participants[index];
  
  openConfirmModal(
    "참석자 삭제",
    `'${participant}'님을 삭제하시겠습니까?`,
    () => { 
      // 1. 로컬 메모리에서 삭제
      meetingData.participants.splice(index, 1);
      
      // 관련된 매핑 정보도 삭제 (로컬)
      Object.keys(speakerMappingData).forEach(speaker => {
        if (speakerMappingData[speaker] === participant) {
            delete speakerMappingData[speaker];
        }
      });

      // 2. 서버 저장(saveMeeting) 제거 -> 로컬 화면만 갱신
      closeSpeakerModal();
      openSpeakerModal(currentMappingSpeaker);
      
      displayTranscripts();
      checkMappingCompletion();
      checkActionGenerationButtonState();
      displayMeetingInfo(); // 참석자 수 갱신 추가
      
      // 안내 메시지 변경
      showSuccessMessage("참석자가 삭제되었습니다.");
    }
  );
}

function selectParticipant(item, participant) {
  document.querySelectorAll(".participant-item").forEach(el => el.classList.remove("selected"));
  item.classList.add("selected");
  tempSelectedParticipant = participant;
}

function closeSpeakerModal() { 
    closeModal('speakerModal'); 
    tempSelectedParticipant = null; // 닫을 때 임시값 초기화
}


/* ===============================
   키워드 관리 모달 함수
=================================*/
function openKeywordModal() {
  const modal = document.getElementById("keywordModal");
  if (!modal) return;

  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  renderKeywordManageList(); // 목록 렌더링

  const input = document.getElementById("modalKeywordInput");
  if (input) {
    input.onkeypress = function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        addManualKeywordFromModal();
      }
    };
    setTimeout(() => input.focus(), 100);
  }
}

function closeKeywordModal() {
  closeModal('keywordModal');
  renderKeywords(); // 메인 화면 갱신
  showSuccessMessage("키워드 변경사항이 저장되었습니다.");
}

function addManualKeywordFromModal() {
  const input = document.getElementById("modalKeywordInput");
  if (!input) return;
  const newKeyword = input.value.trim();

  if (newKeyword.length === 0) { showErrorMessage("입력된 내용이 없습니다."); return; }

  const newKeywordObj = { text: newKeyword, source: 'USER' }; // USER 강제

  if (!meetingData.keywords) meetingData.keywords = [];
  const isDuplicate = meetingData.keywords.some(k => k.text.toLowerCase() === newKeyword.toLowerCase());
  if (isDuplicate) { showErrorMessage("이미 존재하는 키워드입니다."); return; }

  meetingData.keywords.push(newKeywordObj);
  input.value = "";
  renderKeywordManageList(); 
}

function deleteKeyword(index) {
  if (index < 0 || !meetingData.keywords) return;
  meetingData.keywords.splice(index, 1);
  renderKeywordManageList();
}

function renderKeywordManageList() {
  const listContainer = document.getElementById("keywordManageList");
  if (!listContainer) return;
  listContainer.innerHTML = "";

  if (!meetingData.keywords || meetingData.keywords.length === 0) {
    listContainer.innerHTML = `<p style="color: #9ca3af; text-align: center;">키워드가 없습니다.</p>`;
    return;
  }

  meetingData.keywords.forEach((k_obj, index) => {
    const item = document.createElement("div");
    item.className = "keyword-manage-item";
    
    const isUser = k_obj.source && k_obj.source.toUpperCase() === 'USER';
    const sourceTag = isUser
      ? '<span class="keyword-source-tag user">사용자</span>'
      : '<span class="keyword-source-tag ai">AI 생성</span>';

    item.innerHTML = `
      <div><span class="keyword-text">${k_obj.text}</span>${sourceTag}</div>
      <button class="btn-icon-small delete" onclick="deleteKeyword(${index})" title="삭제">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>
    `;
    listContainer.appendChild(item);
  });
}

/* ===============================
   요약 편집 모드 함수들 (누락된 부분)
=================================*/
function toggleSummaryEdit() {
    isEditingSummary = true;
    
    // 1. 뷰 숨기기, 에디터 보이기
    document.getElementById("purposeView").classList.add("hidden");
    document.getElementById("agendaView").classList.add("hidden");
    document.getElementById("summaryView").classList.add("hidden");
    
    const pEditor = document.getElementById("purposeEditor");
    const aEditor = document.getElementById("agendaEditor");
    const sEditor = document.getElementById("summaryEditor");
    
    pEditor.classList.remove("hidden");
    aEditor.classList.remove("hidden");
    sEditor.classList.remove("hidden");

    // 2. 기존 값 에디터에 채우기
    pEditor.value = meetingData.purpose || "";
    aEditor.value = meetingData.agenda || "";
    sEditor.value = meetingData.summary || "";
    
    // 3. 중요도 에디터 처리 (선택형이나 텍스트로 단순화)
    const impBlock = document.getElementById("importanceBlock");
    const impText = impBlock.querySelector(".summary-text");
    const impEditor = document.getElementById("importanceEditor");
    
    if(impText) impText.classList.add("hidden");
    impEditor.classList.remove("hidden");
    // 중요도 사유만 편집하도록 설정
    impEditor.value = meetingData.importance.reason || "";

    // 4. 버튼 상태 변경
    document.getElementById("toggleEditBtn").classList.add("hidden");
    document.getElementById("editActions").classList.remove("hidden");
}

function cancelSummaryEdit() {
    isEditingSummary = false;

    // 1. 에디터 숨기기, 뷰 보이기
    document.getElementById("purposeView").classList.remove("hidden");
    document.getElementById("agendaView").classList.remove("hidden");
    document.getElementById("summaryView").classList.remove("hidden");
    
    document.getElementById("purposeEditor").classList.add("hidden");
    document.getElementById("agendaEditor").classList.add("hidden");
    document.getElementById("summaryEditor").classList.add("hidden");

    const impBlock = document.getElementById("importanceBlock");
    const impText = impBlock.querySelector(".summary-text");
    const impEditor = document.getElementById("importanceEditor");
    
    if(impText) impText.classList.remove("hidden");
    impEditor.classList.add("hidden");

    // 2. 버튼 상태 복구
    document.getElementById("toggleEditBtn").classList.remove("hidden");
    document.getElementById("editActions").classList.add("hidden");
}

function saveSummaryEdit() {
    // 1. 에디터의 값을 meetingData에 반영
    meetingData.purpose = document.getElementById("purposeEditor").value;
    meetingData.agenda = document.getElementById("agendaEditor").value;
    meetingData.summary = document.getElementById("summaryEditor").value;
    
    // 중요도 사유 업데이트
    if(typeof meetingData.importance === 'object') {
        meetingData.importance.reason = document.getElementById("importanceEditor").value;
    }

    // 2. 화면 갱신 (displayAISummary 재활용)
    displayAISummary();
    
    // 3. 편집 모드 종료
    cancelSummaryEdit();
    
    // 4. 성공 메시지
    showSuccessMessage("요약 내용이 수정되었습니다.");
}

/* ===============================
   키워드 토글 함수 (누락된 부분)
=================================*/
function toggleKeyword(element, text) {
    if (!element) return;

    // 1. 다른 키워드가 활성화되어 있다면 끄기
    if (activeKeyword && activeKeyword !== text) {
        const prevActive = document.querySelector('.keyword.active');
        if (prevActive) prevActive.classList.remove('active');
    }

    // 2. 현재 클릭한 키워드 상태 토글 (켜기/끄기)
    if (element.classList.contains('active')) {
        element.classList.remove('active');
        activeKeyword = null; // 선택 해제
    } else {
        element.classList.add('active');
        activeKeyword = text; // 선택 설정
    }

    // 3. 발화 로그 다시 그려서 하이라이트 적용
    displayTranscripts();
}

// 시간 문자열(HH:MM:SS)을 밀리초(ms)로 변환
function timeToMs(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(':').map(Number);
    // 시 * 3600 + 분 * 60 + 초 -> 밀리초 변환
    return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
}
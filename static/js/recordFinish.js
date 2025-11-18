let speakerAnalysisToken = null;
let speakerAnalysisCheckInterval = null;

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

  // ✅ 서버에서 회의 데이터 로드
  await loadMeetingDataFromServer();
  
  // ✅ sessionStorage에서 발화자 분석 토큰 확인 (recordPage에서 전달된 경우)
  const savedToken = sessionStorage.getItem("speakerAnalysisToken");
  if (savedToken) {
      console.log("🎤 저장된 발화자 분석 토큰 발견:", savedToken);
      speakerAnalysisToken = savedToken;
      sessionStorage.removeItem("speakerAnalysisToken");
      startCheckingSpeakerAnalysisResult();
  } 
  
  // ✅ 발화자 분석 상태 체크 및 UI 업데이트
  checkSpeakerAnalysisStatus();
  checkMappingCompletion();
  checkActionGenerationButtonState(); // [추가] '내 할 일 생성' 버튼 상태도 체크
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

    // [수정] 취소 버튼이 항상 보이도록
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

/**
 * [NEW] 에러 모달 표시 함수 (확인 버튼만)
 */
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
        if (cancelBtn) cancelBtn.style.display = ''; // 원상복구
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
   [NEW] 발화자 분석 함수들
=================================*/

// 발화자 분석 시작 함수
async function startSpeakerAnalysis(fileUrl) {
    if (!fileUrl) {
        console.error("❌ 발화자 분석 시작 실패: fileUrl이 없습니다.");
        showErrorMessage("오디오 파일 URL이 없어 발화자 분석을 시작할 수 없습니다.");
        return;
    }

    console.log("🎤 발화자 분석 시작 요청:", fileUrl);
    showLoadingMessage("발화자 분석을 시작합니다..."); // [수정] showSuccessMessage -> showLoadingMessage

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
        hideLoadingMessage(); // [수정] 로딩 메시지 숨기기
        showSuccessMessage(`발화자 분석이 시작되었습니다.`);

        // 주기적으로 결과 확인 (3초마다)
        startCheckingSpeakerAnalysisResult();

    } catch (error) {
        hideLoadingMessage(); // [수정] 에러 시 로딩 메시지 숨기기
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
    showLoadingMessage("발화자 분석 결과 확인 중..."); // [추가] 확인 중 로딩
    
    speakerAnalysisCheckInterval = setInterval(async () => {
        checkCount++;

        if (checkCount > maxChecks) {
            clearInterval(speakerAnalysisCheckInterval);
            hideLoadingMessage(); // [추가]
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
                hideLoadingMessage(); // [추가]
                console.log("✅ 발화자 분석 완료!", result);
                
                // meetingData에 발화자 분석 결과 저장
                if (meetingData) {
                    meetingData.speakerAnalysis = result;
                    
                    // segments를 transcripts 형식으로 변환
                    if (result.segments && Array.isArray(result.segments)) {
                        meetingData.transcripts = result.segments.map((seg, idx) => ({
                            // [수정] speakerName과 speaker(ID)를 명확히 구분
                            speaker: seg.speaker?.name || `화자${seg.speaker?.label || 0}`, // 이것을 ID로 사용
                            speakerName: seg.speaker?.name || `화자${seg.speaker?.label || 0}`, // 이것을 이름으로 사용
                            speakerLabel: seg.speaker?.label,  // ✅ CLOVA label 보존
                            time: formatTimestamp(seg.start),
                            text: seg.text || "",
                            startTime: seg.start,
                            endTime: seg.end,
                            sequenceOrder: idx,  // ✅ 순서 명시
                            isDeleted: false
                        }));
                        
                        console.log(`✅ ${meetingData.transcripts.length}개의 발화 로그 변환 완료`);
                    }

                    // 참석자 목록 업데이트
                    if (result.speakers && Array.isArray(result.speakers)) {
                        const speakerNames = result.speakers.map(s => s.name);
                        // 기존 참석자 목록과 병합 (중복 제거)
                        meetingData.participants = [...new Set([...(meetingData.participants || []), ...speakerNames])];
                        
                        console.log(`✅ 참석자 목록 업데이트: ${meetingData.participants.join(', ')}`);
                    }

                    // UI 업데이트
                    displayTranscripts();
                    updateTranscriptStats();
                    checkMappingCompletion();
                    checkActionGenerationButtonState(); // [추가]
                    displayMeetingInfo(); // [추가] 참석자 수 업데이트
                    
                    // ✅ 발화자 분석 버튼 숨기기
                    const analysisBtn = document.getElementById('startSpeakerAnalysisBtn');
                    if (analysisBtn) {
                        analysisBtn.style.display = 'none';
                    }
                    
                    // 서버에 저장
                    await saveMeetingDataToServer();
                }

                showSuccessMessage("발화자 분석이 완료되었습니다! 🎉");
                
            } else if (result.status === "FAILED" || result.error) {
                clearInterval(speakerAnalysisCheckInterval);
                hideLoadingMessage(); // [추가]
                console.error("❌ 발화자 분석 실패:", result);
                showErrorMessage("발화자 분석에 실패했습니다.");
                
                // ✅ 버튼 상태 복구
                const analysisBtn = document.getElementById('startSpeakerAnalysisBtn');
                if (analysisBtn) {
                    analysisBtn.disabled = false;
                    analysisBtn.classList.remove('analyzing');
                    analysisBtn.querySelector('span').textContent = '발화자 구분 분석 시작';
                }
                
                // ✅ 토큰 초기화
                speakerAnalysisToken = null;
                
            } else {
                // 아직 진행 중
                const progress = result.progress || 0;
                console.log(`⏳ 발화자 분석 진행 중... ${progress}%`);
                // [수정] 로딩 메시지 업데이트
                const loadingToast = document.getElementById("loadingToast");
                if (loadingToast) {
                    loadingToast.textContent = `발화자 분석 진행 중... ${Math.round(progress)}%`;
                }
            }

        } catch (error) {
            console.error("❌ 발화자 분석 결과 확인 오류:", error);
            // [수정] 인터벌 종료, 메시지 숨기기 (오류 발생 시)
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

/* ===============================
   [NEW] 회의 ID 가져오기
=================================*/
function getMeetingId() {
    // 1. URL에서 meetingId 파라미터 확인
    const urlParams = new URLSearchParams(window.location.search);
    const urlMeetingId = urlParams.get('meetingId');
    
    if (urlMeetingId) {
        console.log('✅ URL에서 회의 ID 발견:', urlMeetingId);
        // URL에서 찾았으면 localStorage에도 저장 (다음에도 사용 가능하도록)
        localStorage.setItem('currentMeetingId', urlMeetingId);
        return urlMeetingId;
    }
    
    // 2. localStorage에서 확인
    const storedMeetingId = localStorage.getItem('currentMeetingId');
    if (storedMeetingId) {
        console.log('✅ localStorage에서 회의 ID 발견:', storedMeetingId);
        return storedMeetingId;
    }
    
    // 3. 둘 다 없음
    console.error('❌ 회의 ID를 찾을 수 없습니다');
    return null;
}

/* ===============================
   [NEW] 서버에서 회의 데이터 로드
=================================*/
async function loadMeetingDataFromServer() {
    try {
        const meetingId = getMeetingId();
        
        if (!meetingId) {
            console.error('회의 ID를 찾을 수 없습니다');
            
            // 사용자에게 친절한 안내 메시지
            showErrorModal(
                '회의 정보 없음',
                '회의 데이터를 불러올 수 없습니다.<br>' +
                '회의를 먼저 생성하거나 진행해주세요.',
                () => {
                    window.location.href = 'new-meeting.html'; // 회의 생성 페이지로 이동
                }
            );
            return;
        }

        console.log(`📥 회의 데이터 로드 시작 (ID: ${meetingId})`);

        const response = await fetch(`http://localhost:8080/api/meetings/${meetingId}`, {
            credentials: 'include'
        });

        if (response.status === 404) {
            throw new Error('해당 회의를 찾을 수 없습니다. 삭제되었거나 존재하지 않는 회의입니다.');
        }

        if (response.status === 401) {
            showErrorMessage('로그인이 필요합니다');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1500);
            return;
        }

        if (!response.ok) {
            throw new Error(`서버 응답 오류: ${response.status}`);
        }

        const data = await response.json();
        
        // [수정] 서버 데이터를 meetingData 형식으로 변환 (actionItems 추가)
        meetingData = {
            meetingId: data.meetingId,
            title: data.title || "회의록",
            date: data.scheduledAt || new Date().toISOString(),
            duration: 0,
            participants: data.participants || [],
            transcripts: [],
            // [수정] Base의 actionItems 형식(객체)으로 변환
            actions: (data.actionItems || []).map(item => ({
                title: item.task,
                assignee: item.assignee,
                deadline: item.dueDate,
                addedToCalendar: false, // 기본값
                source: item.source || 'ai' // 'ai' 또는 'user'
            })),
            keywords: (data.keywords || []).map(k => ({ text: k, source: 'user' })), // 'user'가 맞는지 확인 필요
            audioFileUrl: null,
            // [추가] 요약 정보 로드
            purpose: data.purpose,
            agenda: data.agenda,
            summary: data.summary,
            importance: data.importance // { level, reason }
        };
        
        // [추가] Base의 전역 actionItems 변수에도 할당
        actionItems = meetingData.actions || [];

        // Transcript 데이터 로드
        await loadTranscripts(meetingId);
        
        // Recording 데이터 로드
        await loadRecording(meetingId);

        console.log('✅ 회의 데이터 로드 완료:', meetingData);
        
        // [수정] Base의 loadMeetingData 함수 로직을 여기에 통합
        displayMeetingInfo();
        displayTranscripts();
        
        // purpose, agenda, summary, importance가 있으면 표시
        if (meetingData.purpose && meetingData.agenda && meetingData.summary) {
            displayAISummary();
        } else {
            // 기본값 표시
            document.getElementById("purposeView").textContent = "AI 요약 생성 버튼을 눌러 회의 목적을 생성하세요.";
            document.getElementById("agendaView").textContent = "AI 요약 생성 버튼을 눌러 주요 안건을 생성하세요.";
            document.getElementById("summaryView").textContent = "AI 요약 생성 버튼을 눌러 전체 요약을 생성하세요.";

            const importanceEl = document.getElementById("importanceBlock");
            if (importanceEl) importanceEl.classList.add("hidden");
        }
        
        renderKeywords(); // 키워드는 항상 표시
        renderActionItems();
        updateTranscriptStats();
        
    } catch (error) {
        console.error('❌ 회의 데이터 로드 실패:', error);
        showErrorModal(
            '데이터 로드 실패',
            `회의 데이터를 불러오는데 실패했습니다.<br>${error.message}`,
            () => {
                window.location.href = 'dashboard.html'; // 대시보드로 이동
            }
        );
    }
}

/* [NEW] Transcript 데이터 로드 */
async function loadTranscripts(meetingId) {
    try {
        const response = await fetch(`http://localhost:8080/api/transcripts/meeting/${meetingId}`, {
            credentials: 'include'
        });

        if (response.ok) {
            const transcripts = await response.json();
            
            // [수정] Transcript 데이터 변환 (formatTimeFromMs 사용)
            meetingData.transcripts = transcripts.map(t => ({
                id: t.id, // [추가]
                speaker: t.speakerId || t.speakerName || 'Unknown',
                speakerName: t.speakerName,
                speakerLabel: t.speakerLabel, // [추가]
                time: t.timeLabel || formatTimeFromMs(t.startTime),
                text: t.text || '',
                startTime: t.startTime,
                endTime: t.endTime,
                isDeleted: t.isDeleted || false
            }));

            console.log(`✅ Transcript ${transcripts.length}개 로드 완료`);
        } else {
            console.warn('Transcript 데이터가 없습니다');
            meetingData.transcripts = [];
        }
    } catch (error) {
        console.error('Transcript 로드 실패:', error);
        meetingData.transcripts = [];
    }
}

/* [NEW] Recording 데이터 로드 */
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
            
            console.log('✅ Recording 데이터 로드 완료');
            console.log('   - 오디오 URL:', meetingData.audioFileUrl);
        } else {
            console.warn('Recording 데이터가 없습니다');
        }
    } catch (error) {
        console.error('Recording 로드 실패:', error);
    }
}

/* [NEW] 밀리초를 시간 문자열로 변환 (HH:MM:SS 또는 MM:SS) */
function formatTimeFromMs(ms) {
    if (ms === null || ms === undefined) return "00:00";
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    
    if (h > 0) {
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    } else {
        // [수정] Base의 formatTimestamp와 통일 (00:00:00)
        return `00:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
}


/* [REPLACE] 회의 정보 표시 (서버 코드 버전) */
function displayMeetingInfo() {
  if (!meetingData) return;

  const title = meetingData.title || "제목 없음";
  document.getElementById("meetingTitle").textContent = title;

  const dateEl = document.getElementById("meetingDate");
  if (meetingData.date && dateEl) {
      const date = new Date(meetingData.date);
      dateEl.textContent = `${date.getFullYear()}.${String(
          date.getMonth() + 1
      ).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")} ${String(
          date.getHours()
      ).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }

  const dur = document.getElementById("meetingDuration");
  if (dur) { // [수정] duration이 0일 수도 있으므로 항상 업데이트
      dur.textContent = formatDuration(meetingData.duration || 0);
  }

  const part = document.getElementById("participantCount");
  if (meetingData.participants && part)
      part.textContent = meetingData.participants.length + "명 참석";
}

/* [REPLACE] formatDuration (서버 코드 버전) */
function formatDuration(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/* [REPLACE] 회의 제목 수정 (서버 코드 버전) */
function editMeetingTitle() {
  const modal = document.getElementById("titleModal");
  const input = document.getElementById("newTitleInput");
  const currentTitle = document.getElementById("meetingTitle").textContent;

  input.value = currentTitle; // 현재 제목을 입력창에 미리 채워넣기
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";

  // 입력창에 포커스 및 엔터키 이벤트 추가
  setTimeout(() => {
    input.focus();
    input.onkeypress = function(e) {
      if (e.key === 'Enter') {
        saveNewTitle();
      }
    };
  }, 100);
}

/* [REPLACE] 제목 수정 모달 닫기 (서버 코드 버전) */
function closeTitleModal() {
  // [수정] Base의 closeModal 함수 사용
  closeModal('titleModal');
}

/* [REPLACE] 제목 저장 (서버 코드 버전) */
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

/* [REPLACE] 키워드 하이라이트 (서버 코드 버전 - mark 태그 스타일 수정) */
function highlightKeywords(text) {
  if (!activeKeyword) return text;
  const regex = new RegExp("(" + activeKeyword + ")", "gi");
  // [수정] Base의 .transcript-highlight CSS 클래스 사용
  return text.replace(
      regex,
      '<mark class="transcript-highlight">$1</mark>'
  );
}

/* [REPLACE] 실시간 로그 표시 (서버 코드 버전 - 빈 상태 처리, ID 기반 색상) */
function displayTranscripts() {
  if (!meetingData || !meetingData.transcripts) return;
  const body = document.getElementById("transcriptList");
  body.innerHTML = "";

  if (meetingData.transcripts.length === 0) {
    body.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #9ca3af;">
        <p>회의 녹취록이 없습니다.</p>
        <p style="font-size: 14px; margin-top: 8px;">[발화자 구분 분석 시작] 버튼을 눌러 녹취록을 생성하세요.</p>
      </div>
    `;
    updateTranscriptStats(); // [추가] 통계 '0'으로 업데이트
    return;
  }

  meetingData.transcripts.forEach((transcript, index) => {
    const item = document.createElement("div");
    item.className = "transcript-item";
    item.setAttribute("data-index", index);

    // [수정] speakerName은 표시용, speaker(ID)는 매핑 및 색상용
    const speakerId = transcript.speaker; 
    const speakerClass = speakerMappingData[speakerId] ? "mapped" : "";
    const displayName = speakerMappingData[speakerId] || transcript.speakerName || speakerId;
    const avatarText = displayName.charAt(0).toUpperCase();

    const speakerColor = getSpeakerColor(speakerId); // [수정] ID(speaker) 기준으로 색상 할당

    const isSelf = (currentUserName === displayName);
    const selfClass = isSelf ? 'is-self' : '';
    item.className = `transcript-item ${selfClass}`;

    const isDeleted = transcript.isDeleted || false;
    if (isDeleted) {
        item.classList.add('is-deleted');
    }

    const deleteButtonHtml = isDeleted ? `
      <button class="undo-transcript-btn" onclick="undoTranscript(${index})" title="복구">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21.5 2v6h-6M2.5 22v-6h6"/>
          <path d="M2 11.5A10 10 0 0 1 11.5 2a10 10 0 0 1 8.01 4.04"/>
          <path d="M22 12.5a10 10 0 0 1-19.04 1.96"/>
        </svg>
      </button>
    ` : `
      <button class="delete-transcript-btn" onclick="deleteTranscript(${index})" title="삭제">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      </button>
    `;

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
            <button class="edit-transcript-btn" onclick="editTranscript(${index})" title="수정" ${isDeleted ? 'disabled' : ''}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            ${deleteButtonHtml}
          </div>

        </div>
        <div class="transcript-text" id="transcript-text-${index}">${highlightKeywords(transcript.text)}</div>
      </div>
    `;
    body.appendChild(item);
  });
  updateTranscriptStats();
}


/* [KEEP] 로그 통계 업데이트 (Base 버전 - isDeleted 필터링) */
function updateTranscriptStats() {
  const countEl = document.getElementById("transcriptCount");
  const mappingEl = document.getElementById("mappingStatus");

  if (!meetingData || !meetingData.transcripts) {
      // [추가] 데이터가 없을 때 0으로 초기화
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

/**
 * [KEEP] AI 요약 생성 (버튼 클릭 시) (Base 버전)
 * 1. 직무 정보 확인 (NONE/null 체크)
 * 2. generateAISummary 함수 호출
 */
function startFullSummaryGeneration() {
  // 1. localStorage에서 직무 정보 가져오기
    const userSettings = JSON.parse(localStorage.getItem('userSettings'));
    const userJob = userSettings ? userSettings.job : null; // 예: "BACKEND_DEVELOPER" 또는 null

    // AI 요약을 실행하는 실제 로직을 별도 함수로 정의
    const proceedToSummary = (job) => {
        console.log(`AI 요약 생성 진행 (직무: ${job || '없음'})`);
        generateAISummary(job);
    };

// 2. 직무가 없는(NONE) 경우 확인
    if (!userJob || userJob === "NONE" || userJob === "") {

        // 3-A. 직무가 없으면, 커스텀 모달을 띄웁니다.
        openConfirmModal(
            "직무 설정 확인", // 모달 Title
            // 모달 Message (HTML 사용 가능)
            "직무가 설정되지 않았습니다.<br>중립적인 요약이 생성됩니다. 계속하시겠습니까?<br><br><span style='font-size: 13px; color: #6b7280;'>(직무 설정은 '설정' 페이지에서 할 수 있습니다.)</span>", 
            // OnConfirm (확인 버튼 클릭 시) 콜백
            () => {
                proceedToSummary(userJob);
            }
        );
        // (취소 버튼 클릭 시) 모달만 닫히고 아무 작업도 수행되지 않습니다.

    } else {
        // 3-B. 직무가 있으면, 즉시 요약 생성을 실행합니다.
        proceedToSummary(userJob);
    }
}

/* ===============================
    [KEEP] AI 요약 생성 (HyperCLOVA 사용) (Base 버전)
=================================*/

async function generateAISummary(userJob) {
    showLoadingState();
    showLoadingMessage("AI 요약을 생성하는 중...");

    const generateBtn = document.getElementById('generateSummaryBtn');
    if (generateBtn) generateBtn.disabled = true;

    const jobPersona = (!userJob || userJob === "NONE") ? "general" : userJob;

    try {
        // [수정] meetingId 추가
        const meetingId = getMeetingId();
        if (!meetingId) throw new Error("Meeting ID를 찾을 수 없습니다.");

        const response = await fetch(`http://localhost:8000/api/meeting/summarize?meetingId=${meetingId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                transcripts: meetingData.transcripts.filter(t => !t.isDeleted),
                meetingDate: meetingData.date,
                speakerMapping: speakerMappingData,
                userJob: jobPersona // 직무 정보(페르소나) 추가
            })
        });

        const data = await response.json();
        
        if (!response.ok) { // [추가]
             throw new Error(data.detail || `서버 오류: ${response.status}`);
        }

        hideLoadingMessage();

        meetingData.purpose = data.summary.purpose;
        meetingData.agenda = data.summary.agenda;
        meetingData.summary = data.summary.overallSummary;
        meetingData.importance = data.summary.importance;
        
        const userKeywords = (meetingData.keywords || []).filter(k => k.source === 'user');
        const aiKeywords = (data.summary.keywords || []).map(k => ({ text: k, source: 'ai' }));
        meetingData.keywords = [...userKeywords, ...aiKeywords];
        
        displayAISummary();
        showSuccessMessage('AI 요약이 생성되었습니다!');

    } catch (error) {
        hideLoadingMessage();
        console.error('AI 요약 생성 실패:', error);

        let errorMessage = 'AI 요약 생성에 실패했습니다.';
        if (error.message) { // [수정]
            errorMessage = error.message;
        }
        showErrorMessage(errorMessage);
        displayDefaultSummary();
    } finally {
        if (generateBtn) generateBtn.disabled = false;
    }
}

/* [KEEP] (Base 버전) */
function showLoadingState() {
    const loadingText = '<span style="color: #9ca3af;">AI 요약 생성 중...</span>';

    document.getElementById("purposeView").innerHTML = loadingText;
    document.getElementById("agendaView").innerHTML = loadingText;
    document.getElementById("summaryView").innerHTML = loadingText;

    const importanceEl = document.getElementById("importanceBlock");
    if (importanceEl) importanceEl.classList.add("hidden");

    document.getElementById("keywords").innerHTML = loadingText;
}

/* [KEEP] (Base 버전) */
function displayAISummary() {
    const toggleBtn = document.getElementById("toggleEditBtn");
    if (toggleBtn) toggleBtn.disabled = false;

    const importanceEl = document.getElementById("importanceBlock");
    if (importanceEl) importanceEl.classList.remove("hidden");

    document.getElementById("purposeView").textContent = 
        meetingData.purpose || "프로젝트 방향성 논의 및 세부 일정 수립";
    document.getElementById("agendaView").textContent = 
        meetingData.agenda || "예산 배정, 일정 조율, 역할 분담";
    document.getElementById("summaryView").textContent = 
        meetingData.summary || "이번 회의에서는 프로젝트의 주요 목표와 일정에 대해 논의했습니다.";

    // 중요도 표시
    if (meetingData.importance) {
        const summaryTextDiv = document.querySelector("#importanceBlock .summary-text");
        if (!summaryTextDiv) return;

        const levelEl = document.createElement("span");
        levelEl.id = "importanceLevel";

        const reasonEl = document.createElement("div");
        reasonEl.id = "importanceReason";
        reasonEl.style.marginTop = "4px";
        reasonEl.style.color = "#6b7280";

        summaryTextDiv.innerHTML = "";
        summaryTextDiv.appendChild(levelEl);
        summaryTextDiv.appendChild(reasonEl);

        const level = meetingData.importance.level || '보통';

        let cleanReason = meetingData.importance.reason || "";
        if (cleanReason.startsWith(level)) {
            cleanReason = cleanReason.substring(level.length).trim();
        }
        cleanReason = cleanReason.trim(); 

        // 5. 새로 만든 요소에 내용과 스타일 적용
        levelEl.textContent = level;
        levelEl.className = 'importance-level';
        if (level === '높음') {
            levelEl.classList.add('level-high');
        } else if (level === '보통') {
            levelEl.classList.add('level-medium');
        } else if (level === '낮음') {
            levelEl.classList.add('level-low');
        } else {
            levelEl.classList.add('level-default');
        }

        reasonEl.textContent = cleanReason; 

        console.log('회의 중요도:', meetingData.importance);
    }

    // 키워드 표시
    renderKeywords();
}

/*
* [KEEP] '키워드 표시' 로직 (Base 버전)
*/
function renderKeywords() {
    const kwContainer = document.getElementById("keywords");
    if (!kwContainer) return; 

    kwContainer.innerHTML = "";

    if (!meetingData || !meetingData.keywords || meetingData.keywords.length === 0) {
        // 키워드가 없을 때 비어있는 대신 안내 문구 표시 (선택 사항)
        // kwContainer.innerHTML = `<p style="color: #6b7280; font-size: 13px;">키워드가 없습니다.</p>`;
        return;
    }

    (meetingData.keywords || []).forEach(k_obj => {
        const tag = document.createElement("div");
        const sourceClass = k_obj.source === 'user' ? 'keyword-user' : 'keyword-ai';
        tag.className = `keyword ${sourceClass}`;
        tag.textContent = k_obj.text;
        tag.onclick = () => toggleKeyword(tag, k_obj.text);
        kwContainer.appendChild(tag);
    });
}

/* [KEEP] (Base 버전) */
function displayDefaultSummary() {
    document.getElementById("purposeView").textContent = "AI 요약을 생성할 수 없습니다.";
    document.getElementById("agendaView").textContent = "API 설정을 확인해주세요.";
    document.getElementById("summaryView").textContent = "HyperCLOVA API 키가 필요합니다.";
}

/* [KEEP] 이하 모든 함수는 Base 버전 유지 */

function openSpeakerModal(speaker) {
  currentMappingSpeaker = speaker;
  const modal = document.getElementById("speakerModal");
  const list = document.getElementById("participantList");
  list.innerHTML = "";
  
  // [수정] meetingData.participants가 없을 경우 방어 코드
  (meetingData.participants || []).forEach((p, index) => {
      const item = document.createElement("div");
      item.className = "participant-item";
      if (speakerMappingData[speaker] === p) item.classList.add("selected");
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

function addParticipant() {
  const input = document.getElementById("newParticipantInput");
  const name = input.value.trim();
  
  if (!name) {
      showErrorMessage("참석자 이름을 입력해주세요.");
      return;
  }
  
  if (!meetingData.participants) { // [추가]
      meetingData.participants = [];
  }

  if (meetingData.participants.includes(name)) {
      showErrorMessage("이미 존재하는 참석자입니다.");
      return;
  }

  meetingData.participants.push(name);
  input.value = "";
  
  const speaker = currentMappingSpeaker;
  closeSpeakerModal();
  openSpeakerModal(speaker);
  
  showSuccessMessage(`${name}님이 추가되었습니다.`);
}

function deleteParticipant(index) {
  const participant = meetingData.participants[index];

  openConfirmModal(
    "참석자 삭제",
    `'${participant}'님을 참석자 목록에서 삭제하시겠습니까?<br><span style="color: #ef4444; font-size: 13px;">(매핑된 발화 로그도 함께 연결이 끊어집니다.)</span>`,
    () => {
      meetingData.participants.splice(index, 1);

      Object.keys(speakerMappingData).forEach(speaker => {
        if (speakerMappingData[speaker] === participant) {
          delete speakerMappingData[speaker];
        }
      });

      const speaker = currentMappingSpeaker;
      closeSpeakerModal();
      openSpeakerModal(speaker);
      displayTranscripts();
      checkMappingCompletion();
      checkActionGenerationButtonState(); // [추가]

      showErrorMessage(`${participant}님이 삭제되었습니다.`);
    }
  );
}

function deleteKeyword(index) {
  if (index < 0 || !meetingData.keywords || index >= meetingData.keywords.length) {
    return;
  }
  
  const keywordToDelete = meetingData.keywords[index].text;
  
  openConfirmModal(
    "키워드 삭제",
    `'${keywordToDelete}' 키워드를 삭제하시겠습니까?`,
    () => {
      meetingData.keywords.splice(index, 1);
      renderKeywordManageList();
    }
  );
}

function deleteAction(index) {
  openConfirmModal(
    "액션 아이템 삭제",
    "이 액션 아이템을 삭제하시겠습니까?",
    () => {
      actionItems.splice(index, 1);
      renderActionItems();
      showErrorMessage("액션 아이템이 삭제되었습니다.");
    }
  );
}

function selectParticipant(item, participant) {
  document.querySelectorAll(".participant-item").forEach(el => el.classList.remove("selected"));
  item.classList.add("selected");
  speakerMappingData[currentMappingSpeaker] = participant;
}

function closeSpeakerModal() {
  closeModal('speakerModal');
}

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
      const speaker = speakerMappingData[t.speaker] || t.speaker;
      speakerCounts[speaker] = (speakerCounts[speaker] || 0) + 1;
  });

  const total = filteredTranscripts.length;
  const chartData = Object.entries(speakerCounts).map(([speaker, count]) => ({
      speaker,
      count,
      percentage: ((count / total) * 100).toFixed(1)
  }));

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

function toggleSummaryEdit() {
    isEditingSummary = !isEditingSummary;
    const editBtn = document.getElementById("editBtnText");
    const editActions = document.getElementById("editActions");

    const toggleBtn = document.getElementById("toggleEditBtn");

    const sections = [
        { view: "purposeView", editor: "purposeEditor" },
        { view: "agendaView", editor: "agendaEditor" },
        { view: "summaryView", editor: "summaryEditor" },
        { view: "importanceReason", editor: "importanceEditor" }
    ];

  if (isEditingSummary) {
      editBtn.textContent = "편집 중";
      editActions.classList.remove("hidden");

      if (toggleBtn) toggleBtn.disabled = true;

      originalSummaryData = {};
      sections.forEach(({ view, editor }) => {
          const viewEl = document.getElementById(view);
          const editEl = document.getElementById(editor);
          const text = viewEl.textContent.trim();
          originalSummaryData[view] = text;
          editEl.value = text;
          viewEl.classList.add("hidden");
          editEl.classList.remove("hidden");
      });
  } else {
      editBtn.textContent = "편집";
      editActions.classList.add("hidden");

      if (toggleBtn) toggleBtn.disabled = false;

      sections.forEach(({ view, editor }) => {
          const viewEl = document.getElementById(view);
          const editEl = document.getElementById(editor);
          viewEl.classList.remove("hidden");
          editEl.classList.add("hidden");
      });
  }
}

function saveSummaryEdit() {
  const idsToSave = [
    { editorId: "purposeEditor", viewId: "purposeView", dataKey: "purpose" },
    { editorId: "agendaEditor", viewId: "agendaView", dataKey: "agenda" },
    { editorId: "summaryEditor", viewId: "summaryView", dataKey: "summary" },
    { editorId: "importanceEditor", viewId: "importanceReason", dataKey: "importanceReason" }
  ];

  idsToSave.forEach(({ editorId, viewId, dataKey }) => {
    const editor = document.getElementById(editorId);
    const view = document.getElementById(viewId);
    const newText = editor.value.trim() || "내용 없음";

    view.textContent = newText;

    if (dataKey === "importanceReason") {
      if (meetingData.importance) {
        meetingData.importance.reason = newText;
      } else {
        meetingData.importance = { level: "보통", reason: newText };
      }
    } else {
      meetingData[dataKey] = newText;
    }
  });

  toggleSummaryEdit();
  showSuccessMessage("AI 요약이 저장되었습니다.");
}

function cancelSummaryEdit() {
  ["purpose", "agenda", "summary"].forEach(id => {
      const view = document.getElementById(`${id}View`);
      view.textContent = originalSummaryData[`${id}View`];
  });
  const reasonView = document.getElementById("importanceReason"); // [추가]
  if (reasonView) {
      reasonView.textContent = originalSummaryData["importanceReason"];
  }
  toggleSummaryEdit();
}

function toggleKeyword(el, keyword) {
  if (activeKeyword === keyword) {
      activeKeyword = null;
      el.classList.remove("active");
  } else {
      document.querySelectorAll(".keyword").forEach(tag => tag.classList.remove("active"));
      el.classList.add("active");
      activeKeyword = keyword;
  }
  displayTranscripts();
}

function openKeywordModal() {
  const modal = document.getElementById("keywordModal");
  if (!modal) return;

  // 1. 모달을 엽니다.
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";

  // 2. 현재 키워드 리스트를 모달 안에 채웁니다.
  renderKeywordManageList();

  // 3. (엔터키 지원) 입력창에 엔터키 이벤트를 연결합니다.
  const input = document.getElementById("modalKeywordInput");
  if (input) {
    input.onkeypress = function(e) {
      if (e.key === 'Enter') {
        e.preventDefault(); // 폼 제출 방지
        addManualKeywordFromModal();
      }
    };
    // 모달이 열릴 때 입력창에 포커스
    setTimeout(() => input.focus(), 100);
  }
}

function closeKeywordModal() {
  closeModal('keywordModal');

  // 모달이 닫힐 때, 변경된 키워드 목록을
  // 메인 화면에도 다시 그려줍니다. (삭제된 항목 반영)
  renderKeywords();
  showSuccessMessage("키워드 변경사항이 저장되었습니다.");
}

function addManualKeywordFromModal() {
  const input = document.getElementById("modalKeywordInput");
  if (!input) return;

  const newKeyword = input.value.trim();

  // 1. 입력값이 없으면 무시
  if (newKeyword.length === 0) {
    showErrorMessage("추가할 키워드를 입력하세요.");
    return;
  }

  // 2. 키워드 객체 생성 ('user' 태그)
  const newKeywordObj = {
    text: newKeyword,
    source: 'user'
  };

  if (!meetingData.keywords) {
    meetingData.keywords = [];
  }

  // 3. 중복 검사 (텍스트 기준)
  const isDuplicate = meetingData.keywords.some(k => k.text.toLowerCase() === newKeyword.toLowerCase());
  if (isDuplicate) {
    showErrorMessage("이미 존재하는 키워드입니다.");
    return;
  }

  // 4. 데이터에 추가하고 입력창 비우기
  meetingData.keywords.push(newKeywordObj);
  input.value = "";

  // 5. 모달 안의 목록을 새로고침 (즉시 반영)
  renderKeywordManageList(); 
}

function renderKeywordManageList() {
  const listContainer = document.getElementById("keywordManageList");
  if (!listContainer) return;

  listContainer.innerHTML = ""; // 목록 비우기

  if (!meetingData.keywords || meetingData.keywords.length === 0) {
    listContainer.innerHTML = `<p style="color: #6b7280; text-align: center; font-size: 14px;">추가된 키워드가 없습니다.</p>`;
    return;
  }

  meetingData.keywords.forEach((k_obj, index) => {
    const item = document.createElement("div");
    item.className = "keyword-manage-item";
    
    const sourceTag = k_obj.source === 'user' 
      ? '<span class="keyword-source-tag user">사용자</span>'
      : '<span class="keyword-source-tag ai">AI 생성</span>';

    item.innerHTML = `
      <div>
        <span class="keyword-text">${k_obj.text}</span>
        ${sourceTag}
      </div>
      <button class="btn-icon-small delete" onclick="deleteKeyword(${index})" title="삭제">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      </button>
    `;
    listContainer.appendChild(item);
  });
}

function renderActionItems() {
    const container = document.getElementById("actionList");
    container.innerHTML = "";
    
    if (!actionItems || actionItems.length === 0) { // [추가]
        container.innerHTML = `<p style="color: #9ca3af; text-align: center; font-size: 13px; padding: 16px 0;">액션 아이템이 없습니다.</p>`;
        return;
    }
    
    actionItems.forEach((a, index) => {
        const sourceTag = a.source === 'user'
            ? '<span class="action-source-tag user">사용자</span>'
            : '<span class="action-source-tag ai">AI 생성</span>';

        const div = document.createElement("div");
        div.className = "action-item";
        div.innerHTML = `
            <div class="rfc-action-header">
                <div class="action-title">
                    ${a.title}${sourceTag}
                </div>
                <div class="action-controls">
                    <button class="btn-icon-small" onclick="editAction(${index})" title="수정">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="btn-icon-small delete" onclick="deleteAction(${index})" title="삭제">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                </div>
            </div>
            ${a.deadline ? `<div class="action-meta">기한: ${a.deadline}</div>` : ''}
            ${a.assignee ? `<div class="action-meta">담당: ${a.assignee}</div>` : ''}
            <div class="action-buttons">
                <button class="calendar-btn ${a.addedToCalendar ? 'added' : ''}" onclick="toggleCalendar(${index})">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    ${a.addedToCalendar ? '캘린더에 추가됨' : '캘린더에 추가'}
                </button>
            </div>
        `;
        container.appendChild(div);
    });
}

function editAction(index) {
    const action = actionItems[index];
    document.getElementById("actionTitle").value = action.title;
    document.getElementById("actionDeadline").value = action.deadline || "";
    
    // [수정] 담당자 필드(select) 채우기 및 선택
    const assigneeSelect = document.getElementById("actionAssignee");
    assigneeSelect.innerHTML = '<option value="">담당자 선택</option>'; // 초기화
    (meetingData.participants || []).forEach(p => {
        const selected = (p === action.assignee) ? 'selected' : '';
        assigneeSelect.innerHTML += `<option value="${p}" ${selected}>${p}</option>`;
    });

    // 담당자 선택 필드 보이기
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
        const assignee = document.getElementById("actionAssignee").value; // [수정]
        
        actionItems[index] = { 
            title, 
            assignee: assignee || currentUserName, // [수정]
            deadline,
            addedToCalendar: action.addedToCalendar, 
            source: action.source || 'user'
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
    if (!item) 
        return;   
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
            // 4. API 호출 (addDailyTodo 로직 재사용)
            const response = await fetch('http://localhost:8080/api/calendar/events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(bodyData)
            });

            if (!response.ok) {
                throw new Error('캘린더 이벤트 생성에 실패했습니다.');
            }

            const newEvent = await response.json();
            item.googleEventId = newEvent.googleEventId; // 
            item.addedToCalendar = true; // 상태 변경
            
            showSuccessMessage("캘린더에 추가되었습니다.");

        } catch (error) {
            console.error("캘린더 추가 실패:", error);
            showErrorMessage(error.message || "캘린더 추가에 실패했습니다.");
        }

    } else {

        // 6. 저장된 'googleEventId'가 없으면 API로 삭제할 수 없습니다.
        const eventId = item.googleEventId;
        if (!eventId) {
            showErrorMessage("캘린더에서 제거할 수 없습니다. (이벤트 ID 없음)");
            // UI 상태만 롤백
            item.addedToCalendar = false;
            renderActionItems();
            return;
        }

        try {
            // 7. API 호출 (deleteApiTodo 로직 재사용)
            const response = await fetch(`${CALENDAR_BASE_URL}/events/${eventId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('캘린더 이벤트 삭제에 실패했습니다.');
            }

            // 8. API 삭제 성공 시
            item.googleEventId = null; // ID 제거
            item.addedToCalendar = false; // 상태 변경
            showErrorMessage("캘린더에서 제거되었습니다.");

        } catch (error) {
            console.error("캘린더 삭제 실패:", error);
            showErrorMessage(error.message || "캘린더 삭제에 실패했습니다.");
            // 실패했으므로 상태를 변경하지 않습니다.
        }
    }
    // 9. API 호출 성공/실패 여부와 관계없이, 최종 상태를 기준으로 UI를 다시 그립니다.
    renderActionItems();
}

function openActionModal() {
    const modal = document.getElementById("actionModal");
    document.getElementById("actionTitle").value = "";
    document.getElementById("actionDeadline").value = "";
    
    // [수정] 담당자 필드(select) 채우기 (현재 사용자로 기본 선택)
    const assigneeSelect = document.getElementById("actionAssignee");
    assigneeSelect.innerHTML = '<option value="">담당자 선택</option>'; // 초기화
    (meetingData.participants || []).forEach(p => {
        const selected = (p === currentUserName) ? 'selected' : ''; // [수정]
        assigneeSelect.innerHTML += `<option value="${p}" ${selected}>${p}</option>`;
    });
    
    // 담당자 선택 필드 보이기
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
    const assignee = document.getElementById("actionAssignee").value; // [수정]
    
    // 담당자는 선택된 값 또는 현재 사용자
    actionItems.push({ 
        title, 
        assignee: assignee || currentUserName, // [수정]
        deadline, 
        addedToCalendar: false, 
        source: 'user'
    });
    
    renderActionItems();
    closeActionModal();
    showSuccessMessage("액션 아이템이 추가되었습니다.");
}

function closeActionModal() {
    const modal = document.getElementById("actionModal");
    closeModal('actionModal');

    // 모달이 닫힐 때, '수정' 상태였던 버튼을 '추가' 상태로 초기화
    const saveBtn = modal.querySelector(".btn-primary");
    if (saveBtn) {
        saveBtn.textContent = "추가";
        saveBtn.onclick = saveAction;
    }
}

function openAddTranscriptModal() {
    const modal = document.getElementById("addTranscriptModal");
    const speakerSelect = document.getElementById("newTranscriptSpeaker");

    speakerSelect.innerHTML = ""; // 기존 옵션 비우기
    
    // [수정] 참석자 목록 (participants) 기준으로 생성
    const allParticipantNames = [...(meetingData.participants || [])].sort();

    let speakerOptions = allParticipantNames.map(name =>
        `<option value="${name}">${name}</option>`
    ).join('');

    speakerSelect.innerHTML = `<option value="">발화자를 선택하세요</option>` + speakerOptions;

    document.getElementById("newTranscriptTime").value = "";
    document.getElementById("newTranscriptText").value = "";

    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
}

function closeAddTranscriptModal() {
    closeModal('addTranscriptModal');
}

function saveNewTranscript() {
    const speakerName = document.getElementById("newTranscriptSpeaker").value; // [수정]
    const time = document.getElementById("newTranscriptTime").value.trim();
    const text = document.getElementById("newTranscriptText").value.trim();

    if (!speakerName) { // [수정]
        showErrorMessage("발화자를 선택해주세요.");
        return;
    }
    if (!time || !time.match(/^\d{2}:\d{2}:\d{2}$/)) {
        showErrorMessage("시간을 '00:00:00' 형식으로 입력해주세요.");
        return;
    }
    if (!text) {
        showErrorMessage("발화 내용을 입력해주세요.");
        return;
    }

    // [수정] speakerId 찾기 (매핑 기준)
    let speakerId = speakerName; // 기본값은 이름 자체
    const mappedSpeakerId = Object.keys(speakerMappingData).find(
        key => speakerMappingData[key] === speakerName
    );

    if (mappedSpeakerId) {
        speakerId = mappedSpeakerId; // 예: 'Speaker 2'
    } else {
        // 매핑된 ID가 없다면, transcripts 목록에서 speakerName과 일치하는 speaker ID를 찾음
        const existingTranscript = meetingData.transcripts.find(t => t.speakerName === speakerName);
        if (existingTranscript) {
            speakerId = existingTranscript.speaker;
        }
        // 그래도 없으면, speakerName을 ID로 사용 (신규 참석자일 수 있음)
    }

    const newTranscript = {
        speaker: speakerId, // ID
        speakerName: speakerName, // 이름 [추가]
        time: time,
        text: text,
        isDeleted: false,
        startTime: null, // [추가]
        endTime: null // [추가]
    };

    meetingData.transcripts.push(newTranscript);

    meetingData.transcripts.sort((a, b) => {
        return a.time.localeCompare(b.time);
    });

    displayTranscripts();
    checkMappingCompletion(); 
    checkActionGenerationButtonState(); // [추가]
    closeAddTranscriptModal();
    showSuccessMessage("새 발화 로그가 추가되었습니다.");
}

function editTranscript(index) {
  if (currentEditingTranscriptIndex !== -1) {
      cancelTranscriptEdit(currentEditingTranscriptIndex);
  }
  currentEditingTranscriptIndex = index;

  const item = document.querySelector(`.transcript-item[data-index="${index}"]`);
  const textDiv = item.querySelector(".transcript-text");
  const originalText = meetingData.transcripts[index].text;

  // [수정] 발화자 목록 기준 변경 (ID -> 이름)
  // 1. 매핑된 이름 목록 (고유)
  const mappedNames = [...new Set(Object.values(speakerMappingData))];
  // 2. 전체 참석자 이름 목록
  const participantNames = meetingData.participants || [];
  // 3. 둘을 합쳐 고유한 이름 목록 생성
  const allNames = [...new Set([...mappedNames, ...participantNames])].sort();

  const currentSpeakerId = meetingData.transcripts[index].speaker;
  const currentSpeakerName = speakerMappingData[currentSpeakerId] || meetingData.transcripts[index].speakerName || currentSpeakerId;

  let speakerOptions = allNames.map(name =>
    `<option value="${name}" ${name === currentSpeakerName ? 'selected' : ''}>
      ${name}
    </option>`
  ).join('');

  textDiv.innerHTML = `
      <div class="form-group transcript-editor-group">
          <label class="form-label transcript-editor-label">발화자 변경</label>
          <select class="form-select" id="transcript-speaker-editor-${index}">
              ${speakerOptions}
          </select>
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
  const editor = document.getElementById(`transcript-text-editor-${index}`);
  editor.focus();
}

function saveTranscriptEdit(index) {
  const speakerEditor = document.getElementById(`transcript-speaker-editor-${index}`);
  const textEditor = document.getElementById(`transcript-text-editor-${index}`);

  const newSpeakerName = speakerEditor.value; // [수정]
  const newText = textEditor.value.trim();

  if (!newText) {
      showErrorMessage("내용을 입력해주세요.");
      return;
  }

  // [수정] 새 이름(newSpeakerName)에 해당하는 ID(speakerId) 찾기
  let newSpeakerId = newSpeakerName; // 기본값
  const mappedSpeakerId = Object.keys(speakerMappingData).find(
        key => speakerMappingData[key] === newSpeakerName
  );
  if (mappedSpeakerId) {
      newSpeakerId = mappedSpeakerId;
  } else {
      const existingTranscript = meetingData.transcripts.find(t => t.speakerName === newSpeakerName);
      if (existingTranscript) {
          newSpeakerId = existingTranscript.speaker;
      }
  }


  meetingData.transcripts[index].text = newText;
  meetingData.transcripts[index].speaker = newSpeakerId; // [수정] ID
  meetingData.transcripts[index].speakerName = newSpeakerName; // [수정] 이름

  currentEditingTranscriptIndex = -1;

  displayTranscripts();
  checkMappingCompletion();
  checkActionGenerationButtonState(); // [추가]

  showSuccessMessage("발화 로그가 수정되었습니다.");
}

function deleteTranscript(index) {
  if (!meetingData || !meetingData.transcripts[index]) return;

  meetingData.transcripts[index].isDeleted = true;

  displayTranscripts();
  
  // [수정] 두 함수 모두 호출
  checkMappingCompletion();
  checkActionGenerationButtonState();

  showErrorMessage("발화 로그가 삭제되었습니다. (복구 가능)");
}

function undoTranscript(index) {
  if (!meetingData || !meetingData.transcripts[index]) return;

  meetingData.transcripts[index].isDeleted = false;

  displayTranscripts();

  // [수정] 두 함수 모두 호출
  checkMappingCompletion();
  checkActionGenerationButtonState();

  showSuccessMessage("발화 로그가 복구되었습니다.");
}

function cancelTranscriptEdit(index) {
  currentEditingTranscriptIndex = -1;
  displayTranscripts();
}

function toggleDropdown() {
  const dropdown = document.getElementById("downloadDropdown");
  dropdown.classList.toggle("show");
}

document.addEventListener("click", (e) => {
  const dropdown = document.getElementById("downloadDropdown");
  const btn = document.getElementById("downloadBtn");
  if (dropdown && btn && !dropdown.contains(e.target) && !btn.contains(e.target)) {
    dropdown.classList.remove("show");
  }
});

function collectFinalData() {
  const filteredTranscripts = (meetingData.transcripts || []).filter(t => !t.isDeleted);

  const mappedTranscripts = filteredTranscripts.map(t => {
    const speakerName = speakerMappingData[t.speaker] || t.speakerName || t.speaker; // [수정]
    return {
      ...t,
      speaker: speakerName // 'speaker' 필드를 매핑된 이름으로 덮어쓰기
    };
  });

  const sortedSpeakerMapping = {};
  Object.keys(speakerMappingData)
    .sort((a, b) => {
        // [수정] "화자1", "화자10" 정렬 지원
      const numA = parseInt(a.replace(/[^0-9]/g, ''), 10);
      const numB = parseInt(b.replace(/[^0-9]/g, ''), 10);
      
      if (!isNaN(numA) && !isNaN(numB)) {
          return numA - numB;
      }
      return a.localeCompare(b); // 숫자가 아니면 문자열 비교
    })
    .forEach(key => {
      sortedSpeakerMapping[key] = speakerMappingData[key];
    });

  return {
    ...meetingData,
    transcripts: mappedTranscripts,
    speakerMapping: sortedSpeakerMapping,
    actions: actionItems,
    createdAt: new Date().toISOString(),
  };
}

function exportJSON() {
  const dropdown = document.getElementById("downloadDropdown");
  if (dropdown) dropdown.classList.remove("show");
  
  const data = collectFinalData();
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${meetingData.title || "meeting"}.json`;
  a.click();
  showSuccessMessage("JSON 파일이 다운로드되었습니다.");
}

async function exportPDF() {
    const dropdown = document.getElementById("downloadDropdown");
    if (dropdown) dropdown.classList.remove("show");

    if (typeof jspdf === 'undefined') {
        showErrorMessage("PDF 라이브러리를 불러오는 데 실패했습니다.");
        return;
    }

    try {
        const fontResponse = await fetch('./static/fonts/NotoSansKR-Regular.ttf');
        if (!fontResponse.ok) {
            throw new Error('폰트 파일을 불러오는 데 실패했습니다.');
        }
        const fontBuffer = await fontResponse.arrayBuffer();

        const fontData = btoa(
            new Uint8Array(fontBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );

        const { jsPDF } = jspdf;
        const doc = new jsPDF();
        const data = collectFinalData();

        // 한글 폰트 설정
        doc.addFileToVFS('NotoSansKR-Regular.ttf', fontData);
        doc.addFont('NotoSansKR-Regular.ttf', 'NotoSansKR', 'normal');
        doc.setFont('NotoSansKR', 'normal');

        const pageHeight = doc.internal.pageSize.getHeight();
        const marginBottom = 20; // 하단 여백
        let currentY = 20;

        // --- 제목 및 메타 정보 ---
        doc.setFontSize(20);
        const titleText = doc.splitTextToSize(data.title || "회의록", 170);
        doc.text(titleText, 20, currentY, { lineHeightFactor: 1.3 });
        currentY += (titleText.length * 10 * 1.3);

        doc.setFontSize(12);
        currentY += 5;
        doc.text(`회의 일시: ${document.getElementById("meetingDate").textContent}`, 20, currentY);
        currentY += 7;
        doc.text(`회의 시간: ${document.getElementById("meetingDuration").textContent}`, 20, currentY);
        currentY += 7;
        doc.text(`참석자: ${(data.participants || []).join(', ')}`, 20, currentY); // [수정]

        // --- AI 요약 ---
        currentY += 15;
        doc.setFontSize(16);
        doc.text("AI 요약", 20, currentY);

        doc.setFontSize(12);
        currentY += 10;
        doc.text("회의 목적:", 20, currentY);
        currentY += 7;
        const purposeText = doc.splitTextToSize(data.purpose || "-", 170);
        doc.text(purposeText, 20, currentY, { lineHeightFactor: 1.5 });
        currentY += (purposeText.length * 7 * 1.5) + 5;

        doc.text("주요 안건:", 20, currentY);
        currentY += 7;
        const agendaText = doc.splitTextToSize(data.agenda || "-", 170);
        doc.text(agendaText, 20, currentY, { lineHeightFactor: 1.5 });
        currentY += (agendaText.length * 7 * 1.5) + 5;

        doc.text("전체 요약:", 20, currentY);
        currentY += 7;
        const summaryText = doc.splitTextToSize(data.summary || "-", 170);
        doc.text(summaryText, 20, currentY, { lineHeightFactor: 1.5 });
        currentY += (summaryText.length * 7 * 1.5) + 5;

        doc.text("회의 중요도:", 20, currentY);
        currentY += 7;
        const importanceText = `${data.importance?.level || "보통"} - ${data.importance?.reason || "분석되지 않음"}`;
        const importanceLines = doc.splitTextToSize(importanceText, 170);
        doc.text(importanceLines, 20, currentY, { lineHeightFactor: 1.5 });
        currentY += (importanceLines.length * 7 * 1.5);

        // --- 하이라이트 키워드 ---
        if (currentY + 30 > pageHeight - marginBottom) { 
            doc.addPage();
            currentY = 20; 
        }

        currentY += 15;
        doc.setFontSize(16);
        doc.text("하이라이트 키워드", 20, currentY);
        currentY += 10;
        
        doc.setFontSize(12);
        if (data.keywords && data.keywords.length > 0) {
            const keywordText = data.keywords.map(k => k.text).join(', ');
            const keywordLines = doc.splitTextToSize(keywordText, 170);
            
            doc.text(keywordLines, 20, currentY, { lineHeightFactor: 1.5 });
            currentY += (keywordLines.length * 7 * 1.5) + 5;
        } else {
            doc.text("생성된 하이라이트 키워드가 없습니다.", 20, currentY);
            currentY += 7;
        }

        // --- 액션 아이템 ---
        if (currentY + 30 > pageHeight - marginBottom) { 
            doc.addPage();
            currentY = 20;
        }
        
        currentY += 15; 
        doc.setFontSize(16);
        doc.text("액션 아이템", 20, currentY);
        currentY += 10;

        doc.setFontSize(12);
        if (data.actions && data.actions.length > 0) {
            data.actions.forEach((item, index) => {
                const itemText = `${index + 1}. ${item.title} (담당: ${item.assignee || '미지정'}, 기한: ${item.deadline || '미지정'})`;
                const splitText = doc.splitTextToSize(itemText, 170);

                const itemHeight = (splitText.length * 7 * 1.5) + 5; 

                if (currentY + itemHeight > pageHeight - marginBottom) {
                    doc.addPage();
                    currentY = 20;
                }

                doc.text(splitText, 20, currentY, { lineHeightFactor: 1.5 });
                currentY += itemHeight;
            });
        } else {
            doc.text("추가된 액션 아이템이 없습니다.", 20, currentY);
            currentY += 7;
        }

        // --- 실시간 변환 로그 추가 ---
        if (currentY + 30 > pageHeight - marginBottom) {
            doc.addPage();
            currentY = 20;
        }

        currentY += 15;
        doc.setFontSize(16);
        doc.text("실시간 변환 로그", 20, currentY);
        currentY += 10;

        doc.setFontSize(10);

        if (data.transcripts && data.transcripts.length > 0) {
            data.transcripts.forEach((item) => {
                const headerText = `[${item.time}] ${item.speaker}`;
                const contentText = item.text;

                const headerLines = doc.splitTextToSize(headerText, 170);
                const contentLines = doc.splitTextToSize(contentText, 165); 

                const itemHeight = (headerLines.length * 6 * 1.5) + (contentLines.length * 6 * 1.5) + 5;

                if (currentY + itemHeight > pageHeight - marginBottom) {
                    doc.addPage();
                    currentY = 20;
                }

                doc.setFont('NotoSansKR', 'normal'); 
                doc.text(headerLines, 20, currentY, { lineHeightFactor: 1.5 });
                currentY += (headerLines.length * 6 * 1.5);

                doc.setFont('NotoSansKR', 'normal');
                doc.text(contentLines, 25, currentY, { lineHeightFactor: 1.5 }); 
                currentY += (contentLines.length * 6 * 1.5) + 5; 
            });
        } else {
            doc.text("실시간 변환 로그가 없습니다.", 20, currentY);
            currentY += 7;
        }

        doc.setFontSize(12);

        // 파일 저장
        doc.save(`${data.title || "meeting"}.pdf`);
        showSuccessMessage("PDF 파일이 다운로드되었습니다.");

    } catch (error) {
        console.error("PDF 생성 중 폰트 로드 오류:", error);
        showErrorMessage("PDF 생성 실패: 폰트 파일을 불러올 수 없습니다.");
    }
}


async function saveMeeting() {
  if (!meetingData) {
      showErrorMessage("저장할 회의 데이터가 없습니다.");
      return;
  }
  
  const meetingId = getMeetingId();
  if (!meetingId) {
      showErrorMessage("회의 ID를 찾을 수 없어 저장할 수 없습니다.");
      return;
  }
  
  showLoadingMessage("회의록을 서버에 저장 중...");

  // 1. (Base) 삭제된 로그 필터링
  if (meetingData && meetingData.transcripts) {
    meetingData.transcripts = meetingData.transcripts.filter(t => !t.isDeleted);
  }

  // 2. (Base) 전역 actionItems를 meetingData.actions에 동기화
  meetingData.actions = actionItems;

  // 3. (Server) 서버로 보낼 DTO 생성
  //    (주의: Base의 actionItems 형식을 Backend의 ActionItemDTO 형식으로 변환)
  const actionItemDTOs = (meetingData.actions || []).map(a => ({
      task: a.title,
      assignee: a.assignee,
      dueDate: a.deadline || null,
      source: a.source || 'user'
  }));
  
  const keywordStrings = (meetingData.keywords || []).map(k => k.text);

  const updateDto = {
    title: meetingData.title,
    participants: meetingData.participants,    
    purpose: meetingData.purpose,
    agenda: meetingData.agenda,
    summary: meetingData.summary,
    importance: meetingData.importance,
    keywords: keywordStrings,
    actionItems: actionItemDTOs // 
  };

  try {
      // 4. (Server) Meeting 정보 업데이트
      const response = await fetch(`http://localhost:8080/api/meetings/${meetingId}`, {
          method: 'PATCH', // 또는 'PUT'
          headers: {
              'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify(updateDto)
      });
      
      if (!response.ok) {
          const errText = await response.text();
          throw new Error(errText || `회의 정보 저장 실패: ${response.status}`);
      }
      
      hideLoadingMessage();
      showSuccessMessage("회의록이 서버에 저장되었습니다.");

  } catch (error) {
      hideLoadingMessage();
      console.error("서버 저장 실패:", error);
      showErrorMessage(`서버 저장 실패: ${error.message}`);
  }
  
  // 6. (Base) 로컬 저장 (백업용)
  localStorage.setItem("lastMeeting", JSON.stringify(meetingData));
  localStorage.setItem("lastSpeakerMapping", JSON.stringify(speakerMappingData));
}

/* AI 요약 버튼 활성화 체크 */
function checkMappingCompletion() {
    if (!meetingData || !meetingData.transcripts) return;

    // 1. (Base) '삭제되지 않은' 로그 기준
    const activeTranscripts = meetingData.transcripts.filter(t => !t.isDeleted);
    const uniqueSpeakers = [...new Set(activeTranscripts.map(t => t.speaker))];
    
    // 2. 매핑된 발화자 수
    const mappedCount = uniqueSpeakers.filter(s => speakerMappingData[s]).length;

    // 3. 발화자가 1명 이상이고, 전체 수와 매핑된 수가 같은지 확인
    const allMapped = uniqueSpeakers.length > 0 && mappedCount === uniqueSpeakers.length;
    const generateBtn = document.getElementById('generateSummaryBtn');

    if (generateBtn) {
        if (allMapped) {
            generateBtn.disabled = false;
            console.log('모든 발화자 매핑 완료. AI 요약 버튼 활성화.');
        } else {
            generateBtn.disabled = true;
            console.log('아직 매핑되지 않은 발화자가 있습니다. AI 요약 버튼 비활성화.');
        }
    }
}

// '내 할 일 생성' 버튼 활성화 상태를 체크하는 공통 함수
function checkActionGenerationButtonState() {
    const hasCurrentUser = Object.values(speakerMappingData).includes(currentUserName);
    const hasAiActions = actionItems.some(item => item.source === 'ai');
    const generateBtn = document.getElementById('generateMyActionsBtn');
    const infoText = document.getElementById('actionInfoText');

    if (hasCurrentUser && generateBtn) {
        generateBtn.disabled = false;
        generateBtn.classList.remove('btn-secondary');
        generateBtn.classList.add('btn-primary');

        if (infoText) {
            if (hasAiActions) {
                infoText.style.display = 'none';
            } else {
                infoText.style.display = 'block';
                infoText.textContent = '내 할 일 생성 버튼을 클릭하여 할 일을 생성하세요';
                infoText.style.color = '#10b981';
            }
        }
    } else if (generateBtn) {
        generateBtn.disabled = true;
        generateBtn.classList.remove('btn-primary');
        generateBtn.classList.add('btn-secondary');

        if (infoText) {
            infoText.style.display = 'block'; // [수정]
            infoText.textContent = '발화자 매핑 후 내 할 일을 생성할 수 있습니다';
            infoText.style.color = '#9ca3af';
        }
    }
}

// 발화자 매핑 저장 시 버튼 활성화
function saveSpeakerMapping() {
    closeSpeakerModal();
    displayTranscripts();

    checkActionGenerationButtonState();

    showSuccessMessage("발화자 매핑이 저장되었습니다.");

    // AI 요약 버튼 활성화 여부 체크
    checkMappingCompletion();
}


// 내 할 일만 생성 (담당자 표시 제거)
async function generateMyActions() {
    if (!meetingData || !meetingData.transcripts) {
        showErrorMessage("회의 데이터가 없습니다.");
        return;
    }

    showLoadingMessage("내 할 일을 생성하는 중...");

    const generateBtn = document.getElementById('generateMyActionsBtn');
    if (generateBtn) generateBtn.disabled = true;

    const userSettings = JSON.parse(localStorage.getItem('userSettings'));
    const userJob = userSettings ? userSettings.job : "general"; // 기본값 'general'
    
    // [추가]
    const meetingId = getMeetingId();
    if (!meetingId) {
        showErrorMessage("Meeting ID를 찾을 수 없습니다.");
        return;
    }

    try {
        const response = await fetch(`http://localhost:8000/api/meeting/generate-all-actions?meetingId=${meetingId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                transcripts: meetingData.transcripts.filter(t => !t.isDeleted),
                speakerMapping: speakerMappingData,
                meetingDate: meetingData.date,
                userJob: (userJob === "NONE" || !userJob) ? "general" : userJob,
                currentUserName: currentUserName
            })
        });

        if (!response.ok) {
             const errData = await response.json(); // [수정]
             throw new Error(errData.detail || `서버 오류: ${response.status}`);
        }

        const data = await response.json();

        hideLoadingMessage();

        if (data.success) {
            // [수정] data.actions (Base 형식)
            const aiActions = (data.actions || []).map(a => ({
                ...a,
                source: 'ai' // 소스 명시
            }));

            // 내 것만 필터링
            const aiMyActions = aiActions.filter(action => 
               action.assignee === currentUserName || // 1. 내 이름과 일치
               action.assignee === '' ||              // 2. 담당자 없음 (AI가 페르소나 기반으로 생성)
               action.assignee === null ||            // 2b. 담당자 없음 (null)
               action.assignee.includes('팀') ||      // 3. '팀' (팀 담당)
               action.assignee.includes('미지정')    // 4. '담당자 미지정'
            );
            
            const userManualActions = (actionItems || []).filter(item => item.source === 'user');
            actionItems = [...userManualActions, ...aiMyActions];

            if (aiMyActions.length > 0) {
                showSuccessMessage(`${aiMyActions.length}개의 할 일이 생성되었습니다!`);
            } else if (userManualActions.length > 0) {
                showSuccessMessage("AI가 추가로 생성한 할 일은 0개입니다.");
            } else {
                showErrorMessage("회원님이 담당하는 액션 아이템이 없습니다.");
            }
            meetingData.actions = actionItems;
            renderActionItems();

            // 생성 완료 후 안내 문구 숨기기
            const infoText = document.getElementById('actionInfoText');
            if (infoText) {
                infoText.style.display = 'none';
            }
        } else {
            throw new Error(data.error || "알 수 없는 오류");
        }
    } catch (error) {
        hideLoadingMessage();
        console.error('내 할 일 생성 실패:', error);

        let errorMessage = '할 일 생성에 실패했습니다.';
        if (error.message) { // [수정]
            errorMessage = error.message;
        }
        showErrorMessage(errorMessage);
    } finally {
        if (generateBtn) generateBtn.disabled = false;
    }
}

function showLoadingMessage(msg) {
    let div = document.getElementById("loadingToast"); // [수정]
    if (!div) { // 없으면 새로 생성
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
    div.textContent = msg; // 내용 업데이트
}

function hideLoadingMessage() {
    const toast = document.getElementById("loadingToast");
    if (toast) toast.remove();
}

/* ===============================
   [NEW] 발화자 분석 상태 체크 및 UI 업데이트
=================================*/

/**
 * 발화자 분석이 필요한지 확인하고 UI 업데이트
 */
function checkSpeakerAnalysisStatus() {
    if (!meetingData) return;

    // [수정] audioFileUrl이 있고, transcript가 비어있을 때
    const needsAnalysis = meetingData.audioFileUrl && 
                         (!meetingData.transcripts || meetingData.transcripts.length === 0);

    // 발화자 분석 버튼 찾기
    let analysisBtn = document.getElementById('startSpeakerAnalysisBtn');
    const transcriptHeader = document.querySelector('.transcript-area .area-meta'); // [수정] 위치 변경
    
    if (needsAnalysis) {
        // 버튼이 없으면 생성
        if (!analysisBtn && transcriptHeader) {
            analysisBtn = createSpeakerAnalysisButton();
            // [수정] area-meta 다음에 버튼 추가
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
        console.log('✅ 발화자 분석이 필요 없거나 완료됨 - 버튼 숨김');
    }
}

/**
 * 발화자 분석 시작 버튼 생성
 */
function createSpeakerAnalysisButton() {
    // 버튼 생성
    const button = document.createElement('button');
    button.id = 'startSpeakerAnalysisBtn';
    button.className = 'btn btn-primary'; // [수정] 기본 버튼 스타일 활용
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
    
    // [수정] 버튼 스타일은 style.css/recordFinish.css의 .btn-primary를 따름
    // analyzing 상태를 위한 별도 스타일 추가
    const style = document.createElement('style');
    style.textContent = `
        .btn.analyzing {
            background: #f97316; /* 주황색 */
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

/**
 * 발화자 분석 버튼 클릭 핸들러
 */
async function handleSpeakerAnalysisButtonClick() {
    const button = document.getElementById('startSpeakerAnalysisBtn');
    
    if (!meetingData || !meetingData.audioFileUrl) {
        showErrorMessage('오디오 파일 정보가 없습니다.');
        return;
    }
    
    // 이미 분석 중이면 중복 실행 방지
    if (speakerAnalysisToken) {
        showErrorMessage('이미 발화자 분석이 진행 중입니다.');
        return;
    }
    
    // 확인 모달 표시
    openConfirmModal(
        '발화자 구분 분석',
        '발화자 구분 분석을 시작하시겠습니까?<br><span style="color: #6b7280; font-size: 13px;">분석 시간은 녹음 길이에 따라 다르며, 수 분이 소요될 수 있습니다.</span>',
        async () => {
            // 버튼 상태 변경
            button.disabled = true;
            button.classList.add('analyzing');
            button.querySelector('span').textContent = '분석 중';
            
            // 발화자 분석 시작
            await startSpeakerAnalysis(meetingData.audioFileUrl);
        }
    );
}


/* ===============================
   [NEW] 서버 저장 함수
=================================*/

/**
 * 발화자 분석 완료 후 Transcript 데이터를 서버에 저장하는 함수
 */
async function saveMeetingDataToServer() {
    if (!meetingData || !meetingData.transcripts || meetingData.transcripts.length === 0) {
        console.warn('⚠️ 저장할 Transcript 데이터가 없습니다.');
        return;
    }

    const meetingId = getMeetingId();
    if (!meetingId) {
        console.error('❌ Meeting ID를 찾을 수 없어 서버 저장 불가');
        showErrorMessage('회의 ID를 찾을 수 없습니다.');
        return;
    }

    console.log(`💾 Transcript 서버 저장 시작... (Meeting ID: ${meetingId})`);

    try {
        // Frontend transcripts를 Backend DTO 형식으로 변환
        const transcriptDtos = meetingData.transcripts.map((transcript, index) => {
            // speakerLabel 추출 (있으면 사용, 없으면 null)
            const speakerLabel = transcript.speakerLabel !== undefined 
                ? transcript.speakerLabel 
                : null;

            return {
                speakerId: transcript.speaker,           // 화자 ID (예: "spk_0" 또는 "화자1")
                speakerName: transcript.speakerName || transcript.speaker,  // 화자 이름
                speakerLabel: speakerLabel,              // CLOVA speaker label (정수)
                text: transcript.text,                   // 발화 내용
                startTime: transcript.startTime,         // 시작 시간 (ms)
                endTime: transcript.endTime,             // 종료 시간 (ms)
                timeLabel: transcript.time,              // [추가] "00:00:00"
                sequenceOrder: transcript.sequenceOrder !== undefined ? transcript.sequenceOrder : index  // 발화 순서
            };
        });

        console.log(`📤 전송할 Transcript 수: ${transcriptDtos.length}개`);

        // Backend API 호출 - 일괄 저장
        const response = await fetch(
            `http://localhost:8080/api/transcripts/batch?meetingId=${meetingId}`,
            {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json'
                },
                credentials: 'include',  // 세션 쿠키 포함
                body: JSON.stringify(transcriptDtos)
            }
        );

        if (!response.ok) {
            throw new Error(`서버 응답 오류: ${response.status}`);
        }

        const savedTranscripts = await response.json();
        console.log(`✅ Transcript ${savedTranscripts.length}개 서버 저장 완료`);
        
        showSuccessMessage(`발화 로그 ${savedTranscripts.length}개가 저장되었습니다.`);

        // 저장된 데이터로 meetingData 업데이트 (ID 등 추가된 정보 반영)
        // [수정] 저장된 ID를 기준으로 매핑
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
/* ===============================
   전역 변수 선언
=================================*/
let meetingData = null;
let transcriptContent = null;

let ws = null;
let isWebSocketConnected = false;

let micStream = null;
let audioContext = null;
let audioWorkletNode = null;

let sentences = [];
let isRecording = false;
let isPaused = false;
let isRecordingComplete = false;

let recordingMetadata = {
  audioFileUrl: '',
  audioFormat: 'wav',
  audioFileSize: null,
  durationSeconds: 0,
};

let timerSeconds = 0;
let timerInterval = null;

let analyser = null;
let animationId = null;

/* ===============================
   키워드 하이라이트 색상 팔레트
=================================*/
const HIGHLIGHT_COLORS = [
  { bg: '#fef3c7', text: '#92400e', border: '#fde68a', name: '노란색' },
  { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd', name: '파란색' },
  { bg: '#fce7f3', text: '#9f1239', border: '#fbcfe8', name: '분홍색' },
  { bg: '#d1fae5', text: '#065f46', border: '#a7f3d0', name: '초록색' },
  { bg: '#e0e7ff', text: '#3730a3', border: '#c7d2fe', name: '인디고' },
  { bg: '#fed7aa', text: '#9a3412', border: '#fdba74', name: '주황색' },
  { bg: '#e9d5ff', text: '#6b21a8', border: '#d8b4fe', name: '보라색' },
  { bg: '#fecaca', text: '#991b1b', border: '#fca5a5', name: '빨간색' },
];

let keywordColorMap = new Map();


/* ===============================
   Chatbot & Sidebar Fetch
=================================*/
document.addEventListener("DOMContentLoaded", () => {

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

      loadCurrentUser();

      const currentPage = window.location.pathname.split("/").pop();
      const navItems = sidebar.querySelectorAll(".nav-menu a");

      navItems.forEach(item => {
        const linkPath = item.getAttribute("href");

        // 먼저 모든 active 제거
        item.classList.remove("active");

        // recording.html과 recordFinish.html은 recordSetting 메뉴를 active로 표시
        if (currentPage === "recording.html" || currentPage === "recordFinish.html") {
          if (linkPath === "recordSetting.html") {
            item.classList.add("active");
            console.log("✅ active 추가:", linkPath);
          }
        } else {
          // 다른 페이지들은 기존 로직 유지
          if (linkPath === currentPage) {
            item.classList.add("active");
            console.log("✅ active 추가:", linkPath);
          }
        }
      });

      // 최종 확인
      console.log("=== 최종 active 상태 ===");
      navItems.forEach(item => {
        console.log(item.getAttribute("href"), "→", item.classList.contains("active"));
      });
    })
    .catch(err => console.error("사이드바 로드 실패:", err));

  // 트랜스크립트 컨텐츠 참조
  transcriptContent = document.getElementById("transcriptContent");
  // 회의 정보 로드
  loadMeetingData();
  // 버튼 이벤트 리스너 등록
  initializeButtons();
  // 접기/펼치기 기능 초기화
  initializeCollapsibleCards();
});

/* ===============================
   사용자 정보 로드
=================================*/
async function loadCurrentUser() {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/auth/me`, {
      credentials: 'include'
    });
    if (response.ok) {
      const user = await response.json();
      displayUserName(user);
      return user;
    } else if (response.status === 401) {
      window.location.href = '/login.html';
      return null;
    } else {
      displayUserName(null);
      return null;
    }
  } catch (error) {
    console.error('네트워크 오류', error);
    displayUserName(null);
    return null;
  }
}

// 사용자 이름 표시
function displayUserName(user) {
    // 메인 헤더
    const nameElement = document.querySelector("#user-name");
    if (nameElement)
        nameElement.textContent = (user && user.name) || (user && user.email) || '사용자';

    // 사이드바 이름
    document.querySelectorAll(".user-name").forEach(el => {
        el.textContent = (user && user.name) || (user && user.email) || '사용자';
    });

    // 사이드바 이메일
    document.querySelectorAll(".user-email").forEach(el => {
        el.textContent = (user && user.email) || '';
    });

    // 사이드바 아바타 (선택)
    document.querySelectorAll(".user-avatar").forEach(el => {
        el.textContent = (user && user.name) ? user.name.charAt(0).toUpperCase() : "U";
    });
}

function openConfirmModal(title, message, onConfirm) {
  const modal = document.getElementById('confirmModal');
  const titleEl = document.getElementById('confirmTitle');
  const msgEl = document.getElementById('confirmMessage');
  const okBtn = document.getElementById('confirmOkBtn');
  const cancelBtn = document.getElementById('confirmCancelBtn');

  titleEl.textContent = title;
  msgEl.innerHTML = message;

  modal.classList.remove('hidden');

  const closeModal = () => modal.classList.add('hidden');
  cancelBtn.onclick = closeModal;
  okBtn.onclick = () => {
    closeModal();
    if (onConfirm) onConfirm();
  };
}

/* ===============================
   공통 메시지 함수
=================================*/
function showSuccessMessage(message) {
  const existing = document.querySelector('.success-message');
  if (existing) existing.remove();

  const msg = document.createElement('div');
  msg.className = 'success-message';
  msg.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%) translateY(-20px);
    background: linear-gradient(135deg, #8E44AD 0%, #9b59b6 100%);
    color: white;
    padding: 10px 16px;
    border-radius: 20px;
    box-shadow: 0 2px 12px rgba(142, 68, 173, 0.3);
    z-index: 10000;
    display: flex;
    align-items: center;
    gap: 8px;
    opacity: 0;
    transition: all 0.4s cubic-bezier(0.68, -0.55, 0.27, 1.55);
    max-width: 400px;
    font-weight: 500;
    font-size: 14px;
  `;
  msg.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
    <span>${message}</span>
  `;
  document.body.appendChild(msg);

  // 등장 애니메이션
  requestAnimationFrame(() => {
    msg.style.opacity = '1';
    msg.style.transform = 'translateX(-50%) translateY(0)';
  });

  setTimeout(() => {
    msg.style.opacity = '0';
    msg.style.transform = 'translateX(-50%) translateY(-20px)';
    setTimeout(() => msg.remove(), 400);
  }, 3000);
}

function showErrorMessage(message) {
  const existing = document.querySelector('.error-message');
  if (existing) existing.remove();

  const msg = document.createElement('div');
  msg.className = 'error-message';
  msg.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%) translateY(-20px);
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: white;
    padding: 10px 16px;
    border-radius: 20px;
    box-shadow: 0 2px 12px rgba(239, 68, 68, 0.3);
    z-index: 10000;
    display: flex;
    align-items: center;
    gap: 8px;
    opacity: 0;
    transition: all 0.4s cubic-bezier(0.68, -0.55, 0.27, 1.55);
    max-width: 400px;
    font-weight: 500;
    font-size: 14px;
  `;
  msg.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
    <span>${message}</span>
  `;
  document.body.appendChild(msg);

  // 등장 애니메이션
  requestAnimationFrame(() => {
    msg.style.opacity = '1';
    msg.style.transform = 'translateX(-50%) translateY(0)';
  });

  setTimeout(() => {
    msg.style.opacity = '0';
    msg.style.transform = 'translateX(-50%) translateY(-20px)';
    setTimeout(() => msg.remove(), 400);
  }, 3000);
}

/* ========================================================================================
    회의 데이터 로드 (Spring 백엔드 연동) - 개선 버전
======================================================================================== */

async function loadMeetingData() {
  console.log("📡 회의 데이터 로드 시작...");

  try {
    // 1) URL에서 meetingId 읽기
    const urlParams = new URLSearchParams(window.location.search);
    let meetingIdFromUrl = urlParams.get("meetingId");

    console.log("🔍 URL 파라미터:", window.location.search);
    console.log("🔍 URL에서 추출한 meetingId:", meetingIdFromUrl);

    // 2) URL에 meetingId 없으면 localStorage에서 복구
    if (!meetingIdFromUrl) {
      const savedId = localStorage.getItem("currentMeetingId");
      console.log("💾 localStorage에서 조회:", savedId);

      if (savedId) {
        console.warn("⚠️ URL에 meetingId 없음 → localStorage에서 복구");
        const newUrl = `${location.origin}/recording.html?meetingId=${savedId}`;
        console.log("🔄 리다이렉트:", newUrl);
        window.location.href = newUrl;
        return;
      } else {
        console.error("❌ meetingId를 찾을 수 없음 (URL과 localStorage 모두)");
        showErrorMessage("회의 정보를 찾을 수 없습니다. 회의 설정 페이지로 돌아가주세요.");

        // 5초 후 recordSetting으로 이동
        setTimeout(() => {
          window.location.href = "/recordSetting.html";
        }, 5000);
        return;
      }
    }

    // 3) URL로 받은 meetingId 저장
    localStorage.setItem("currentMeetingId", meetingIdFromUrl);
    const meetingId = meetingIdFromUrl;

    console.log("✅ 사용할 meetingId:", meetingId);
    console.log("📤 API 요청 URL:", `/api/meetings/${meetingId}`);

    // 4) Spring API 호출
    const res = await fetch(`/api/meetings/${meetingId}`, {
      credentials: "include",
      headers: {
        "Accept": "application/json"
      }
    });

    console.log("📥 API 응답 상태:", res.status, res.statusText);

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`❌ 회의 정보 로드 실패: ${res.status} ${res.statusText}`);
      console.error("❌ 응답 내용:", errorText);
      throw new Error(`회의 정보 로드 실패 (${res.status})`);
    }

    meetingData = await res.json();
    console.log("✅ 회의 데이터 로드 완료:", meetingData);
    console.log("📋 회의 제목:", meetingData.title);
    console.log("👥 참석자:", meetingData.participants);
    console.log("🏷️ 키워드:", meetingData.keywords);

    displayMeetingInfo();

  } catch (e) {
    console.error("❌ 회의 데이터 로드 중 오류:", e);
    showErrorMessage(`회의 정보를 불러오지 못했습니다: ${e.message}`);
  }
}

/* ===============================
   회의 정보 렌더링
=================================*/
function displayMeetingInfo() {
  if (!meetingData) {
    console.warn("⚠️ meetingData가 없습니다.");
    return;
  }

  console.log("🎨 회의 정보 렌더링 시작...");

  // 회의 제목
  const titleEl = document.getElementById("meetingTitle");
  if (titleEl) {
    titleEl.textContent = meetingData.title || "제목 없음";
    console.log("✅ 제목 표시:", titleEl.textContent);
  } else {
    console.error("❌ meetingTitle 요소를 찾을 수 없음");
  }

  // 회의 일시
  const dateEl = document.getElementById("meetingDate");
  if (dateEl && meetingData.scheduledAt) {
    const date = new Date(meetingData.scheduledAt);
    dateEl.textContent = date.toLocaleString("ko-KR", {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    console.log("✅ 일시 표시:", dateEl.textContent);
  } else {
    console.warn("⚠️ meetingDate 요소를 찾을 수 없거나 scheduledAt 데이터 없음");
  }

  // 회의 설명
  const descEl = document.getElementById("meetingDescription");
  const descSection = document.getElementById("descriptionSection");
  if (descEl && descSection) {
    if (meetingData.description && meetingData.description.trim()) {
      descEl.textContent = meetingData.description;
      descSection.style.display = "block";
      console.log("✅ 설명 표시:", meetingData.description);
    } else {
      descSection.style.display = "none";
      console.log("ℹ️ 설명 없음 - 섹션 숨김");
    }
  }

  // 참석자
  const participantsList = document.getElementById("participantsList");
  const participantCount = document.getElementById("participantCount");

  if (participantsList && meetingData.participants) {
    participantsList.innerHTML = "";
    participantCount.textContent = `${meetingData.participants.length}명`;

    console.log(`✅ 참석자 ${meetingData.participants.length}명 표시 시작`);

    meetingData.participants.forEach((name, index) => {
      const chip = document.createElement("div");
      chip.className = "participant-chip";
      chip.innerHTML = `
        <div class="participant-avatar-mini">${name[0] || '?'}</div>
        <span>${name}</span>
      `;
      participantsList.appendChild(chip);
      console.log(`  ${index + 1}. ${name}`);
    });
  } else {
    console.warn("⚠️ participantsList 요소를 찾을 수 없거나 participants 데이터 없음");
  }

  // 키워드
  const keywordsList = document.getElementById("keywordsList");
  const keywordCount = document.getElementById("keywordCount");

  if (keywordsList && meetingData.keywords) {
    keywordsList.innerHTML = "";
    if (keywordCount) {
      keywordCount.textContent = `${meetingData.keywords.length}개`;
    }

    console.log(`✅ 키워드 ${meetingData.keywords.length}개 표시 시작`);

    // 🔥 키워드별 색상 할당
    keywordColorMap.clear();

    meetingData.keywords.forEach((keyword, index) => {
      const keywordStr = typeof keyword === 'string' ? keyword : (keyword.name || keyword.text || String(keyword));
      
      // 색상 할당
      const color = HIGHLIGHT_COLORS[index % HIGHLIGHT_COLORS.length];
      keywordColorMap.set(keywordStr, color);
      
      const chip = document.createElement("span");
      chip.className = "keyword-chip";
      chip.textContent = keywordStr;
      
      // 🔥 키워드 목록에도 같은 색상 적용
      chip.style.cssText = `
        background: linear-gradient(135deg, ${color.bg} 0%, ${color.border} 100%);
        color: ${color.text};
        border: 1px solid ${color.border};
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 600;
      `;
      
      keywordsList.appendChild(chip);
      console.log(`  ${index + 1}. ${keywordStr} - ${color.name}`);
    });

    console.log('✅ 키워드 색상 매핑 완료:', keywordColorMap);
  } else {
    console.warn("⚠️ keywordsList 요소를 찾을 수 없거나 keywords 데이터 없음");
  }

  console.log("🎨 회의 정보 렌더링 완료");
}

/* ===============================
   접기/펼치기 초기화
=================================*/
function initializeCollapsibleCards() {
  document.querySelectorAll(".info-card-collapsible").forEach(card => {
    const header = card.querySelector(".info-header");
    if (header) {
      header.addEventListener("click", () => {
        card.classList.toggle("collapsed");
      });
    }
  });
}

/* ========================================================================================
  WebSocket STT 연결 - 완전 구현 버전
======================================================================================== */
function connectSTTWebSocket(language = "ko") {
  if (ws && ws.readyState === WebSocket.OPEN) {
    console.log("⚠️ 이미 WebSocket 연결됨");
    return;
  }

  // 상대 경로 사용 - Nginx가 ai-server:8000으로 프록시
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${location.host}/ws/realtime`;

  console.log("🔗 WebSocket 연결 시도:", wsUrl);

  ws = new WebSocket(wsUrl);
  ws.binaryType = "arraybuffer";

  ws.onopen = () => {
    console.log("✅ WebSocket 연결 성공");
    isWebSocketConnected = true;

    const micStatusLabel = document.querySelector(".mic-status-label");
    if (micStatusLabel) micStatusLabel.textContent = "녹음 중";

    // STT 시작 메시지 전송
    ws.send(JSON.stringify({
      action: "start",
      language: language
    }));

    console.log(`📤 STT 시작 요청 전송 (언어: ${language})`);

    // 오디오 캡처 시작
    startAudioCapture();
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log("📩 WebSocket 메시지:", data);

      // -------------------------
      // 🔹 상태 메시지 처리
      // -------------------------
      if (data.type === "status") {
        console.log(`ℹ️ 상태: ${data.message} - ${data.info}`);

        if (data.message === "recording") {
          showSuccessMessage("STT 인식 시작");
        } else if (data.message === "paused") {
          showSuccessMessage("STT 일시정지됨");
        } else if (data.message === "resumed") {
          showSuccessMessage("STT 재개됨");
        }
        return;
      }

      // -------------------------
      // 🔥 수정: 부분/최종 구분 없이 모두 즉시 표시
      // -------------------------
      if (data.type === "transcription") {
        // 빈 텍스트는 무시
        if (!data.text || data.text.trim() === "") {
          console.warn("⚠️ 빈 텍스트 수신 - 무시");
          return;
        }

        // 부분 인식이든 최종이든 모두 문장으로 추가
        const newSentence = {
          text: data.text.trim(),
          recordingTime: timerSeconds,
          confidence: data.confidence || 0,
          isFinal: data.isSentenceEnd || false  // 최종 여부 기록 (선택적)
        };

        sentences.push(newSentence);
        console.log(`✅ 문장 추가 (${sentences.length}) [${formatTime(timerSeconds)}]:`, newSentence.text);

        // UI 업데이트
        displaySentences();
        updateTranscriptCount();

        // 🔥 키워드 감지 로그만 (Toast 제거)
        if (meetingData?.keywords && meetingData.keywords.length > 0) {
          meetingData.keywords.forEach(keyword => {
            const keywordStr = typeof keyword === 'string' ? keyword : (keyword.name || keyword.text || '');
            if (keywordStr && data.text.includes(keywordStr)) {
              console.log(`🔑 키워드 감지: "${keywordStr}" in "${data.text.substring(0, 50)}..."`);
              // ✅ 텍스트 하이라이트만 사용 (Toast 알림 제거)
            }
          });
        }

        // 자동 스크롤
        if (document.getElementById("autoScroll")?.checked) {
          transcriptContent.scrollTop = transcriptContent.scrollHeight;
        }

        return;
      }

      // -------------------------
      // Object Storage 업로드 완료
      // -------------------------
      if (data.type === "audio_uploaded") {
        console.log("✅ Object Storage 업로드 완료:", data.file_url);

        recordingMetadata.audioFileUrl = data.file_url;

        if (window.audioUploadResolver) {
          window.audioUploadResolver(data.file_url);
          window.audioUploadResolver = null;
        }

        showSuccessMessage("녹음 파일 업로드 완료");
        return;
      }

      // -------------------------
      // STT 최종 종료 메시지 (여기서만 WebSocket 종료)
      // -------------------------
      if (data.type === "done") {
        console.log("🎉 STT done 수신 → 안전한 종료 시작");
        console.log("📁 최종 파일 URL:", data.file_url);

        if (data.file_url) {
          recordingMetadata.audioFileUrl = data.file_url;
        }

        isRecordingComplete = true;

        // 여기서만 WebSocket을 닫아야 파일이 1개만 생김!
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }

        return;
      }

      // -------------------------
      // 에러
      // -------------------------
      if (data.type === "error") {
        console.error("❌ STT 오류:", data.message);
        showErrorMessage(`STT 오류: ${data.message}`);
        return;
      }

    } catch (e) {
      console.error("❌ WebSocket 메시지 파싱 실패:", e);
    }
  };

  ws.onerror = (error) => {
    console.error("❌ WebSocket 오류:", error);
    showErrorMessage("실시간 음성 인식 연결 오류");
  };

  ws.onclose = (event) => {
    console.log(`🔌 WebSocket 연결 종료 (코드: ${event.code}, 이유: ${event.reason || '없음'})`);
    isWebSocketConnected = false;

    const micStatusLabel = document.querySelector(".mic-status-label");
    if (micStatusLabel) micStatusLabel.textContent = "대기 중";
  };
}

/* ===============================
   오디오 캡처 시작
=================================*/
async function startAudioCapture() {
  try {
    console.log("🎤 오디오 캡처 시작 요청...");

    // 마이크 권한 요청 (브라우저는 48kHz/44.1kHz로 캡처)
    if (!micStream) {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      console.log("✅ 마이크 접근 성공");
    }

    // AudioContext 생성 (브라우저 기본 샘플레이트 사용)
    if (!audioContext || audioContext.state === "closed") {
      audioContext = new AudioContext();
      console.log(`🎧 AudioContext 샘플레이트: ${audioContext.sampleRate}Hz`);
      console.log(`   → pcm-processor.js가 ${audioContext.sampleRate}Hz → 16kHz로 다운샘플링합니다`);
    }

    // AudioWorklet 로드
    try {
      await audioContext.audioWorklet.addModule("static/js/pcm-processor.js");
      console.log("✅ AudioWorklet 모듈 로드 성공");
    } catch (e) {
      console.error("❌ AudioWorklet 로드 실패:", e);
      throw new Error("pcm-processor.js 파일을 찾을 수 없습니다");
    }

    // 오디오 처리 체인 구성
    const source = audioContext.createMediaStreamSource(micStream);
    audioWorkletNode = new AudioWorkletNode(audioContext, "pcm-processor");

    // 이게 없어서 PCM 데이터가 전송 안 됐음!
    audioWorkletNode.port.onmessage = (event) => {
      const data = event.data;

      // 디버깅 메시지 처리
      if (data.type === 'init') {
        console.log(`🎤 PCM Processor 초기화:`);
        console.log(`   입력: ${data.inputRate}Hz`);
        console.log(`   출력: ${data.targetRate}Hz`);
        console.log(`   비율: 1:${data.ratio.toFixed(3)}`);
        return;
      }

      if (data.type === 'stats') {
        console.log(`📊 PCM 통계:`);
        console.log(`   입력 샘플: ${data.inputSamples}`);
        console.log(`   출력 샘플: ${data.outputSamples}`);
        console.log(`   실제 비율: 1:${data.actualRatio} (기대값: 1:${data.expectedRatio})`);
        return;
      }

      // PCM 데이터 (Int16Array) → WebSocket 전송
      if (data instanceof Int16Array) {
        if (ws?.readyState === WebSocket.OPEN && !isPaused) {
          ws.send(data.buffer);
        }
      }
    };

    // 연결
    source.connect(audioWorkletNode);
    audioWorkletNode.connect(audioContext.destination);

    console.log("✅ 오디오 캡처 체인 구성 완료");
    console.log("📡 실시간 PCM 데이터 전송 시작");

  } catch (e) {
    console.error("❌ 오디오 캡처 실패:", e);

    if (e.name === "NotAllowedError") {
      showErrorMessage("마이크 접근 권한이 거부되었습니다");
    } else if (e.name === "NotFoundError") {
      showErrorMessage("마이크를 찾을 수 없습니다");
    } else {
      showErrorMessage(`오디오 캡처 실패: ${e.message}`);
    }

    // 실패 시 정리
    stopAudioCapture();
  }
}

/* ===============================
   오디오 캡처 중지
=================================*/
function stopAudioCapture() {
  console.log("🛑 오디오 캡처 중지");

  // AudioWorklet 연결 해제
  if (audioWorkletNode) {
    audioWorkletNode.disconnect();
    audioWorkletNode.port.close();
    audioWorkletNode = null;
    console.log("  ✓ AudioWorklet 해제");
  }

  // 마이크 스트림 중지
  if (micStream) {
    micStream.getTracks().forEach(track => {
      track.stop();
      console.log(`  ✓ 마이크 트랙 중지: ${track.label}`);
    });
    micStream = null;
  }

  // AudioContext 종료
  if (audioContext && audioContext.state !== "closed") {
    audioContext.close();
    audioContext = null;
    console.log("  ✓ AudioContext 종료");
  }

  console.log("✅ 오디오 리소스 정리 완료");
}

/* =============================================================================
  키워드 하이라이트 토스트
================================================================================ */

// 정규식 특수문자 이스케이프
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 키워드 하이라이트 적용
function highlightKeywords(text, keywords) {
  if (!keywords || keywords.length === 0 || keywordColorMap.size === 0) {
    return escapeHtml(text);
  }

  let highlighted = escapeHtml(text);

  keywords.forEach((keyword) => {
    const keywordStr = typeof keyword === 'string' ? keyword : (keyword.name || keyword.text || '');
    if (!keywordStr) return;

    const color = keywordColorMap.get(keywordStr);
    if (!color) return;

    // 대소문자 구분 없이 전역 치환
    const regex = new RegExp(`(${escapeRegExp(keywordStr)})`, 'gi');
    
    highlighted = highlighted.replace(regex, (match) => {
      return `<span class="keyword-highlight" style="
        background: linear-gradient(135deg, ${color.bg} 0%, ${color.border} 100%);
        color: ${color.text};
        border-bottom: 2px solid ${color.border};
        padding: 2px 6px;
        border-radius: 4px;
        font-weight: 600;
      ">${match}</span>`;
    });
  });

  return highlighted;
}
/* ===========================================================================
  문장 UI 렌더링
=============================================================================== */

function displaySentences() {
  // 🔥 단순화: 전체 다시 렌더링
  transcriptContent.innerHTML = "";

  sentences.forEach((s, idx) => {
    const div = document.createElement("div");
    div.className = "transcript-item";
    div.dataset.sentenceIndex = idx;

    const timeStr = formatTime(s.recordingTime || 0);

    // 🔥 키워드 하이라이트 적용
    const highlightedText = meetingData?.keywords 
        ? highlightKeywords(s.text, meetingData.keywords)
        : escapeHtml(s.text);

    div.innerHTML = `
      <div class="transcript-meta">
        <span class="transcript-time">${timeStr}</span>
        ${s.confidence ? `<span class="confidence" style="margin-left:8px;color:#9ca3af;font-size:12px;">${Math.round(s.confidence * 100)}%</span>` : ''}
        ${!s.isFinal ? '<span style="margin-left:6px;color:#3b82f6;font-size:0.85em;">인식중</span>' : ''}
      </div>
      <div class="transcript-text">${highlightedText}</div>
    `;

    transcriptContent.appendChild(div);
  });

  // 자동 스크롤
  if (document.getElementById("autoScroll")?.checked) {
    transcriptContent.scrollTop = transcriptContent.scrollHeight;
  }
}

function updateTranscriptCount() {
  const el = document.getElementById("transcriptCount");
  if (el) el.textContent = `${sentences.length}개 발화`;
}

/* =============================================================================
  키워드 하이라이트 토스트
================================================================================ */
function showHighlightToast(keyword, sentence) {
  const container = document.getElementById("highlightToastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = "highlight-toast";
  toast.style.cssText = `
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 16px 20px;
    border-radius: 12px;
    margin-bottom: 12px;
    box-shadow: 0 4px 20px rgba(102, 126, 234, 0.3);
    animation: slideInRight 0.3s ease;
  `;

  toast.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <span style="font-weight:600;font-size:14px;">🔑 ${escapeHtml(keyword)}</span>
      <span style="opacity:0.8;font-size:12px;">${formatTime(timerSeconds)}</span>
    </div>
    <div style="font-size:13px;line-height:1.5;opacity:0.95;">
      ${escapeHtml(sentence.substring(0, 100))}${sentence.length > 100 ? '...' : ''}
    </div>
  `;

  container.appendChild(toast);

  // 5초 후 자동 제거
  setTimeout(() => {
    toast.style.animation = "slideOutRight 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

/* =============================================================================
  HTML 이스케이프 (XSS 방지)
================================================================================ */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}


/* ============================================================================
  타이머
=============================================================================== */
function startTimer() {
  timerInterval = setInterval(() => {
    timerSeconds++;
    document.getElementById("timerDisplay").textContent = formatTime(timerSeconds);
  }, 1000);
}

function formatTime(sec) {
  const h = String(Math.floor(sec / 3600)).padStart(2, "0");
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  // 🔥 1시간 미만이면 항상 mm:ss 형식으로 표시
  return h === "00" ? `${m}:${s}` : `${h}:${m}:${s}`;
}

/* ===========================================================================
  마이크 비주얼라이저
=============================================================================== */

async function startMicVisualizer() {
  // micStream은 startAudioCapture()에서 이미 생성됨
  let retryCount = 0;
  while (!micStream && retryCount < 10) {
    console.log(`⏳ micStream 대기 중... (${retryCount + 1}/10)`);
    await new Promise(resolve => setTimeout(resolve, 100));
    retryCount++;
  }

  if (!micStream) {
    console.warn("⚠️ 마이크 스트림을 찾을 수 없습니다 (비주얼라이저 생략)");
    return;
  }

  if (!audioContext || audioContext.state === "closed") {
    console.warn("⚠️ AudioContext가 없습니다 (비주얼라이저 생략)");
    return;
  }

  analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  const src = audioContext.createMediaStreamSource(micStream);
  src.connect(analyser);

  console.log("✅ 마이크 비주얼라이저 시작");
  visualize();
}

function visualize() {
  const bars = document.querySelectorAll(".audio-bar"); // wave-bar → audio-bar
  if (bars.length === 0) {
    console.error("audio-bar 요소를 찾을 수 없습니다");
    return;
  }

  const dataArray = new Uint8Array(analyser.frequencyBinCount);

  function update() {
    if (isPaused) {
      animationId = requestAnimationFrame(update);
      return;
    }

    analyser.getByteFrequencyData(dataArray);
    const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;

    bars.forEach((bar, i) => {
      const value = dataArray[i * 8] || avg;
      bar.style.height = Math.max(10, (value / 255) * 100) + "%";
    });

    animationId = requestAnimationFrame(update);
  }

  update();
}

function pauseMicVisualizer() {
  if (audioContext) audioContext.suspend();
}

async function resumeMicVisualizer() {
  if (audioContext) await audioContext.resume();
}

function stopMicVisualizer() {
  if (animationId) cancelAnimationFrame(animationId);
  if (audioContext) audioContext.close();
}

/* ========================================================================================
  버튼 이벤트 초기화
======================================================================================== */

function initializeButtons() {
  const startBtn = document.getElementById("startBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const endBtn = document.getElementById("endBtn");

  if (!startBtn || !pauseBtn || !endBtn) {
    console.error("❌ 버튼 요소를 찾을 수 없습니다.");
    return;
  }

  /* ===============================
     녹음 시작
  =================================*/
  startBtn.addEventListener("click", async () => {
    if (isRecording) return;

    console.log("🎙 녹음 시작");
    isRecording = true;

    startBtn.style.display = "none";
    pauseBtn.style.display = "flex";
    endBtn.disabled = false;
    const endWarning = document.querySelector(".end-warning");
    if (endWarning) {
      endWarning.style.display = "none";
    }

    startTimer();
    connectSTTWebSocket("ko");

    startMicVisualizer();

    transcriptContent.innerHTML = "";
    sentences = [];

    showSuccessMessage("녹음이 시작되었습니다");
  });

  /* ===============================
     일시정지 / 재개
  =================================*/
  pauseBtn.addEventListener("click", async () => {
    isPaused = !isPaused;

    if (isPaused) {
      console.log("⏸ 녹음 일시정지");
      clearInterval(timerInterval);
      ws?.send(JSON.stringify({ action: "pause" }));
      // pauseMicVisualizer(); // 🔥 이 줄 주석 처리 또는 삭제!
      showSuccessMessage("녹음 일시정지");
      pauseBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <polygon points="10 8 16 12 10 16 10 8"/>
      </svg>
      재개
    `;
    } else {
      console.log("▶️ 녹음 재개");
      startTimer();
      ws?.send(JSON.stringify({ action: "resume" }));
      // await resumeMicVisualizer(); // 🔥 이 줄도 주석 처리 또는 삭제!
      showSuccessMessage("녹음 재개");
      pauseBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="6" y="4" width="4" height="16"/>
        <rect x="14" y="4" width="4" height="16"/>
      </svg>
      일시정지
    `;
    }
  });


  /* ========================================================================================
    회의 종료 처리 - 개선 버전
  ======================================================================================== */

  // 기존 endBtn 이벤트 리스너를 다음 코드로 교체하세요 (1037-1157번째 줄)

  endBtn.addEventListener("click", () => {
    if (!isRecording) return;

    openConfirmModal(
      "회의 종료",
      "회의를 종료하시겠습니까?<br>종료하면 발화자 분석을 시작합니다.",
      async () => {
        console.log("🛑 회의 종료 처리 시작");

        clearInterval(timerInterval);
        stopAudioCapture();
        stopMicVisualizer();

        const meetingId = localStorage.getItem("currentMeetingId");

        if (!meetingId) {
          console.error("❌ meetingId가 없어서 회의 종료 불가");
          showErrorMessage("회의 ID를 찾을 수 없습니다");
          return;
        }

        // WebSocket으로 stop 신호를 보내고 audio_uploaded 메시지를 기다림
        if (ws?.readyState === WebSocket.OPEN) {
          console.log("📤 WebSocket에 stop 신호 전송 - 파일 업로드 대기 시작");

          // 🔥 개선: 타임아웃을 20초로 연장
          const UPLOAD_TIMEOUT = 20000; // 10000 → 20000

          // Promise를 만들어서 audio_uploaded 메시지를 기다림
          const audioUrlPromise = new Promise((resolve, reject) => {
            window.audioUploadResolver = resolve;
            window.audioUploadRejecter = reject;

            // 타임아웃 설정
            const timeoutId = setTimeout(() => {
              if (window.audioUploadResolver) {
                console.error(`❌ ${UPLOAD_TIMEOUT / 1000}초 타임아웃 발생`);
                window.audioUploadResolver = null;
                window.audioUploadRejecter = null;
                reject(new Error(`파일 업로드 타임아웃 (${UPLOAD_TIMEOUT / 1000}초 초과)`));
              }
            }, UPLOAD_TIMEOUT);

            // 🔥 타임아웃 ID 저장 (성공 시 clearTimeout 하기 위해)
            window.uploadTimeoutId = timeoutId;
          });

          // stop 신호 전송
          ws.send(JSON.stringify({ action: "stop" }));

          try {
            // audio_uploaded 메시지를 받을 때까지 대기
            console.log(`⏳ 파일 업로드 완료 대기 중 (최대 ${UPLOAD_TIMEOUT / 1000}초)...`);
            const audioFileUrl = await audioUrlPromise;

            // 🔥 성공 시 타임아웃 취소
            if (window.uploadTimeoutId) {
              clearTimeout(window.uploadTimeoutId);
              window.uploadTimeoutId = null;
            }

            console.log("✅ 파일 업로드 완료 확인:", audioFileUrl);

          } catch (error) {
            console.error("❌ 파일 업로드 대기 중 에러:", error);

            // 🔥 타임아웃 정리
            if (window.uploadTimeoutId) {
              clearTimeout(window.uploadTimeoutId);
              window.uploadTimeoutId = null;
            }

            showErrorMessage("녹음 파일 업로드에 실패했습니다. 다시 시도해주세요.");
            return;
          }
        }

        // 이제 audioFileUrl이 확실히 있는 상태에서 검증
        console.log("📊 현재 recordingMetadata:", JSON.stringify(recordingMetadata, null, 2));
        console.log("🎯 audioFileUrl 값:", recordingMetadata.audioFileUrl);

        if (!recordingMetadata.audioFileUrl || recordingMetadata.audioFileUrl.trim() === "") {
          console.error("❌ audioFileUrl이 여전히 비어있습니다!");
          showErrorMessage("녹음 파일 URL을 찾을 수 없습니다. 다시 시도해주세요.");
          return;
        }

        // Recording 정보만 포함 (Transcript 제외)
        const payload = {
          duration: timerSeconds,
          endTime: new Date().toISOString(),
          recording: {
            audioFileUrl: recordingMetadata.audioFileUrl,
            audioFormat: "wav",
            audioFileSize: recordingMetadata.audioFileSize,
            durationSeconds: timerSeconds,
          }
        };

        console.log("📤 회의 종료 데이터 (전송 직전):", JSON.stringify(payload, null, 2));

        try {
          const res = await fetch(`/api/meetings/${meetingId}/finish`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(payload),
          });

          if (!res.ok) {
            const errorText = await res.text();
            console.error("❌ 회의 저장 실패:", errorText);
            throw new Error("저장 실패");
          }

          console.log("✅ 회의 저장 완료 (녹음 파일)");

          // 실시간 텍스트는 sessionStorage에 임시 저장
          const realTimeTranscripts = sentences.map((s, i) => ({
            text: s.text,
            startTime: s.recordingTime,
            endTime: s.recordingTime,
            sequenceOrder: i,
            confidence: s.confidence || 0
          }));

          sessionStorage.setItem("realTimeTranscripts", JSON.stringify(realTimeTranscripts));
          console.log(`💾 실시간 텍스트 ${realTimeTranscripts.length}개 임시 저장`);

          showSuccessMessage("회의 저장 완료! 발화자 분석을 시작합니다...");

          setTimeout(() => {
            window.location.href = `recordFinish.html?meetingId=${meetingId}`;
          }, 1000);

        } catch (err) {
          console.error("❌ 회의 저장 중 오류:", err);
          showErrorMessage("회의 저장 실패: " + err.message);
        }
      }
    );
  });
}

/* ========================================================================================
  모달
======================================================================================== */
function openConfirmModal(title, msg, onConfirm) {
  const modal = document.getElementById("confirmModal");
  if (!modal) return;

  modal.classList.remove("hidden");

  const titleEl = document.getElementById("confirmTitle");
  const msgEl = document.getElementById("confirmMessage");

  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.innerHTML = msg;

  const cancelBtn = document.getElementById("confirmCancelBtn");
  const okBtn = document.getElementById("confirmOkBtn");

  if (cancelBtn) {
    cancelBtn.onclick = () => {
      modal.classList.add("hidden");
    };
  }

  if (okBtn) {
    okBtn.onclick = () => {
      modal.classList.add("hidden");
      onConfirm();
    };
  }
}
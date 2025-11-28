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

            // 사이드바 로드 후 사용자 정보 주입
            loadCurrentUser();

            // 현재 페이지 활성화
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
        })
        .catch(error => {
            console.error('사이드바 로드 실패:', error);
        });
});

// 사용자 정보 로드 함수 (API에서만)
async function loadCurrentUser() {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/auth/me`, {
      credentials: 'include'  // 이 옵션만 있으면 브라우저가 HttpOnly 쿠키를 요청에 자동 포함!
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

/* ===============================
   유틸리티 함수
=================================*/
function getCookie(name) {
    const cookies = document.cookie.split(";").map(c => c.trim());
    for (const cookie of cookies) {
        if (cookie.startsWith(name + "=")) {
            return cookie.substring(name.length + 1);
        }
    }
    return null;
}

function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split('')
                .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );
        return JSON.parse(jsonPayload);
    } catch (e) { 
        console.error('JWT 파싱 실패:', e);
        return null; 
    }
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
        border-radius: 8px;
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

/* ===============================
   마이크 테스트 기능
=================================*/
let isTesting = false;
let audioContext = null;
let analyser = null;
let microphone = null;
let javascriptNode = null;
let micStream = null; // 추가: 실제 오디오 스트림 참조용

document.getElementById('micTestBtn').addEventListener('click', async function() {
    if (!isTesting) {
        try {
            micStream = await navigator.mediaDevices.getUserMedia({ audio: true }); // 전역에 저장
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            microphone = audioContext.createMediaStreamSource(micStream);
            javascriptNode = audioContext.createScriptProcessor(2048, 1, 1);

            analyser.smoothingTimeConstant = 0.8;
            analyser.fftSize = 1024;

            microphone.connect(analyser);
            analyser.connect(javascriptNode);
            javascriptNode.connect(audioContext.destination);

            javascriptNode.onaudioprocess = function() {
                const array = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(array);
                const avg = array.reduce((a, b) => a + b) / array.length;
                const percent = Math.min(100, (avg / 128) * 100);
                document.getElementById('micLevelBar').style.width = percent + '%';
            };

            isTesting = true;
            this.classList.add('testing');
            this.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="6" y="4" width="4" height="16"/>
                    <rect x="14" y="4" width="4" height="16"/>
                </svg>
                테스트 중지
            `;
            showSuccessMessage('마이크 테스트가 시작되었습니다');
        } catch {
            showErrorMessage('마이크 접근 권한이 필요합니다');
        }
    } else {
        // 오디오 리소스 정리
        if (microphone) microphone.disconnect();
        if (javascriptNode) javascriptNode.disconnect();
        if (audioContext) audioContext.close();

        // 여기 추가: 실제 마이크 사용 중단
        if (micStream) {
            micStream.getTracks().forEach(track => track.stop());
            micStream = null;
        }

        document.getElementById('micLevelBar').style.width = '0%';
        isTesting = false;
        this.classList.remove('testing');
        this.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
            테스트 시작
        `;
    }
});


/* ===============================
   참석자 추가/삭제
   ✨ Toast 최소화 - 시각적 피드백 강화
=================================*/
const participantInput = document.getElementById('participant-name');
const participantList = document.querySelector('.participants-list');

document.querySelector('.add-participant-btn').addEventListener('click', () => {
    const name = participantInput.value.trim();
    if (!name) return;
    
    // 중복 체크
    const existingParticipants = Array.from(document.querySelectorAll('.participant-name'))
        .map(p => p.textContent.trim());
    
    if (existingParticipants.includes(name)) {
        showErrorMessage('이미 추가된 참석자입니다');
        return;
    }
    
    const item = document.createElement('div');
    item.className = 'participant-item';
    item.innerHTML = `
        <div class="participant-avatar">${name[0]}</div>
        <span class="participant-name">${name}</span>
        <button class="remove-participant-btn">✕</button>
    `;
    
    // ✨ 부드러운 등장 애니메이션 추가
    item.style.opacity = '0';
    item.style.transform = 'translateX(-10px)';
    item.style.transition = 'all 0.3s ease';
    
    participantList.appendChild(item);
    participantInput.value = '';
    
    // 애니메이션 트리거
    requestAnimationFrame(() => {
        item.style.opacity = '1';
        item.style.transform = 'translateX(0)';
    });
    
    // ❌ Toast 제거 - 목록에 추가되는 게 보이므로 충분
    // showSuccessMessage('참석자가 추가되었습니다');
    
    item.querySelector('.remove-participant-btn').addEventListener('click', () => {
        // ✨ 부드러운 퇴장 애니메이션
        item.style.opacity = '0';
        item.style.transform = 'translateX(-10px)';
        setTimeout(() => item.remove(), 300);
        // ❌ Toast 제거
    });
});

participantInput.addEventListener('keypress', e => {
    if (e.key === 'Enter') document.querySelector('.add-participant-btn').click();
});

document.querySelectorAll('.remove-participant-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const item = btn.closest('.participant-item');
        item.style.opacity = '0';
        item.style.transform = 'translateX(-10px)';
        setTimeout(() => item.remove(), 300);
        // ❌ Toast 제거
    });
});


/* ===============================
   키워드 추가/삭제
   ✨ Toast 최소화 - 시각적 피드백 강화
=================================*/
const keywordInput = document.getElementById('keyword-input');
const keywordList = document.querySelector('.keywords-list');

document.querySelector('.add-keyword-btn').addEventListener('click', () => {
    const word = keywordInput.value.trim();
    if (!word) return;
    
    // 중복 체크
    const existingKeywords = Array.from(document.querySelectorAll('.keyword-tag'))
        .map(tag => tag.textContent.replace('✕', '').trim());
    
    if (existingKeywords.includes(word)) {
        showErrorMessage('이미 추가된 키워드입니다');
        return;
    }
    
    const tag = document.createElement('span');
    tag.className = 'keyword-tag';
    tag.innerHTML = `${word}<button class="remove-keyword-btn">✕</button>`;
    
    // ✨ 부드러운 등장 애니메이션
    tag.style.opacity = '0';
    tag.style.transform = 'scale(0.8)';
    tag.style.transition = 'all 0.3s cubic-bezier(0.68, -0.55, 0.27, 1.55)';
    
    keywordList.appendChild(tag);
    keywordInput.value = '';
    
    // 애니메이션 트리거
    requestAnimationFrame(() => {
        tag.style.opacity = '1';
        tag.style.transform = 'scale(1)';
    });
    
    // ❌ Toast 제거 - 태그 추가되는 게 보이므로 충분
    // showSuccessMessage('키워드가 추가되었습니다');
    
    tag.querySelector('.remove-keyword-btn').addEventListener('click', () => {
        // ✨ 부드러운 퇴장 애니메이션
        tag.style.opacity = '0';
        tag.style.transform = 'scale(0.8)';
        setTimeout(() => tag.remove(), 300);
        // ❌ Toast 제거
    });
});

keywordInput.addEventListener('keypress', e => {
    if (e.key === 'Enter') document.querySelector('.add-keyword-btn').click();
});

document.querySelectorAll('.remove-keyword-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tag = btn.closest('.keyword-tag');
        tag.style.opacity = '0';
        tag.style.transform = 'scale(0.8)';
        setTimeout(() => tag.remove(), 300);
        // ❌ Toast 제거
    });
});


/* ===============================
   회의 시작 - 개선된 버전
=================================*/
document.querySelector('.btn-primary').addEventListener('click', async () => {
    const title = document.getElementById('meeting-title');
    const date = document.getElementById('meeting-scheduledAt');
    const description = document.getElementById('meeting-description');

    // 에러 표시 초기화
    title.classList.remove('error');
    date.classList.remove('error');

    // 필수값 검증 - ✅ Toast 유지 (중요!)
    if (!title.value.trim()) {
        title.classList.add('error');
        showErrorMessage('회의 제목을 입력해주세요');
        title.focus();
        return;
    }
    if (!date.value) {
        date.classList.add('error');
        showErrorMessage('회의 일시를 선택해주세요');
        date.focus();
        return;
    }

    // 참석자가 없으면 경고 - ✅ Toast 유지 (중요!)
    const participantItems = document.querySelectorAll('.participant-item');
    if (participantItems.length === 0) {
        showErrorMessage('최소 1명의 참석자를 추가해주세요');
        participantInput.focus();
        return;
    }

    // 회의 데이터 수집
    const participants = [];
    participantItems.forEach(item => {
        participants.push(item.querySelector('.participant-name').textContent);
    });

    const keywords = [];
    document.querySelectorAll('.keyword-tag').forEach(tag => {
        const text = tag.textContent.replace('✕', '').trim();
        keywords.push(text);
    });

    const fixedDate = date.value.length === 16 ? date.value + ":00" : date.value;
    const meetingData = {
        title: title.value.trim(),
        scheduledAt: fixedDate,
        description: description.value.trim(),
        participants: participants,
        keywords: keywords
    };

    console.log("📤 서버로 보낼 회의 데이터:", meetingData);

    // 버튼 비활성화 (중복 클릭 방지)
    const btn = document.querySelector('.btn-primary');
    btn.disabled = true;
    btn.textContent = '생성 중...';

    try {
        // Spring Boot API로 전송
        const res = await fetch("/api/meetings", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: 'include',
            body: JSON.stringify(meetingData)
        });

        console.log("📡 응답 상태:", res.status);

        if (!res.ok) {
            const errorText = await res.text();
            console.error("❌ 서버 오류 응답:", errorText);
            throw new Error(`HTTP ${res.status}: ${errorText}`);
        }

        const data = await res.json();
        console.log("✅ 서버 응답 데이터:", data);

        if (!data || !data.meetingId) {
            throw new Error('서버 응답에 meetingId가 없습니다');
        }

        // localStorage에 저장
        localStorage.setItem("currentMeetingId", data.meetingId);
        console.log("💾 localStorage에 저장됨:", data.meetingId);

        // ✅ Toast 유지 (중요한 성공 알림!)
        showSuccessMessage('회의가 성공적으로 생성되었습니다!');

        // 페이지 이동
        setTimeout(() => {
            const targetUrl = `${location.origin}/recording.html?meetingId=${data.meetingId}`;
            console.log("🚀 페이지 이동:", targetUrl);
            window.location.href = targetUrl;
        }, 1000);

    } catch (err) {
        console.error("❌ 회의 생성 실패:", err);
        // ✅ Toast 유지 (중요한 에러 알림!)
        showErrorMessage(`회의 생성 실패: ${err.message}`);
        
        // 버튼 재활성화
        btn.disabled = false;
        btn.textContent = '회의 시작';
    }
});


/* ===============================
   취소 버튼
=================================*/
document.querySelector('.btn-secondary').addEventListener('click', () => {
    if (confirm('회의 설정을 취소하시겠습니까?')) {
        window.location.href = '/dashboard.html';
    }
});

/* ===============================
   기본 날짜 설정
=================================*/
const now = new Date();
now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
document.getElementById('meeting-scheduledAt').value = now.toISOString().slice(0, 16);
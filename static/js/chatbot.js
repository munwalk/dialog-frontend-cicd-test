// 전역 함수로 명시적 등록
window.toggleHistory = function() {
    const sidebar = document.getElementById('historySidebar');
    const isOpen = sidebar.classList.contains('open');
    
    if (isOpen) {
        sidebar.classList.remove('open');
        removeHistoryOverlay();
    } else {
        sidebar.classList.add('open');
        addHistoryOverlay();
        loadHistoryList();
    }
};

window.startNewChat = function() {
    console.log('[NEW CHAT] 새 대화 시작');
    
    if (currentChatHistory.length > 0) {
        saveChatHistory();
    }

    if (currentSessionId) {
        deleteContextOnBackend(currentSessionId);
    }
    
    currentSessionId = generateSessionId();
    localStorage.setItem('chatSessionId', currentSessionId);
    console.log('[NEW CHAT] 새 세션 ID:', currentSessionId);
    
    currentChatHistory = [];
    
    if (currentTypingTimeout) {
        clearTimeout(currentTypingTimeout);
        currentTypingTimeout = null;
    }
    
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = '';
    chatMessages.dataset.initialized = 'false';
    
    initChatbot();
};

let currentChatMode = 'search'; // 'search' 또는 'faq'
let currentSessionId = null;
let currentChatHistory = [];
let currentTypingTimeout = null;

// ========== 세션 ID 생성 함수 추가 ==========
function generateSessionId() {
    return 'session-' + Date.now();
}


// ========== 백엔드 컨텍스트 삭제 함수 추가 ==========
async function deleteContextOnBackend(sessionId) {
    if (!sessionId) return;
    
    try {
        await fetch('http://localhost:8000/api/context/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ session_id: sessionId })
        });
        console.log('[DELETE] 컨텍스트 삭제 완료:', sessionId);
    } catch (error) {
        console.warn('[DELETE] 컨텍스트 삭제 실패 (무시):', error);
    }
}

// ============================================================
// 챗봇 모드 전환
// ============================================================

function switchChatMode(mode) {
    console.log('Switching to mode:', mode); // 디버그용
    
    currentChatMode = mode;
    const searchBtn = document.getElementById('searchModeBtn');
    const faqBtn = document.getElementById('faqModeBtn');
    
    if (mode === 'search') {
        searchBtn.classList.add('active');
        faqBtn.classList.remove('active');
        addMessage('회의록 검색 모드입니다. 궁금한 회의 내용을 물어보세요! 📝', false);
    } else {
        faqBtn.classList.add('active');
        searchBtn.classList.remove('active');
        addMessage('FAQ 모드입니다. 궁금한 점을 물어보세요! 💡', false);
    }
}

// ============================================================
// 로컬 스토리지 관리
// ============================================================

// 세션 기반 저장 - 봇 메시지가 2개 이상일 때만 저장
function saveChatHistory() {
    // 사용자 메시지가 최소 1개 이상 있어야 저장
    const userMessages = currentChatHistory.filter(m => m.role === 'user');
    
    if (userMessages.length === 0) {
        console.log('[SAVE] 저장할 대화 없음 (사용자 메시지 0개)');
        return;
    }
    
    const histories = JSON.parse(localStorage.getItem('chatHistories') || '[]');
    
    // 첫 사용자 메시지로 제목 생성
    const firstUserMsg = userMessages[0];
    const title = firstUserMsg.content.substring(0, 30) + 
                  (firstUserMsg.content.length > 30 ? '...' : '');
    
    const history = {
        id: currentSessionId || Date.now(), // 세션 ID 사용
        title: title,
        messages: [...currentChatHistory], // 전체 대화 복사
        mode: currentChatMode,
        timestamp: new Date().toISOString()
    };
    
    // 중복 체크 (같은 세션 ID면 덮어쓰기)
    const existingIndex = histories.findIndex(h => h.id === history.id);
    if (existingIndex !== -1) {
        histories[existingIndex] = history; // 덮어쓰기
        console.log('[SAVE] 기존 히스토리 업데이트:', title);
    } else {
        histories.unshift(history); // 새로 추가
        console.log('[SAVE] 새 히스토리 추가:', title);
    }
    
    // 최대 50개만 저장
    if (histories.length > 50) {
        histories.pop();
    }
    
    localStorage.setItem('chatHistories', JSON.stringify(histories));
}

function newChat() {
    currentChatHistory = [];
    currentSessionId = null;
    
    // 사용자 이름 가져오기
    fetchUserName().then(userName => {
        const greeting = userName 
            ? `안녕하세요~ ${userName}님! 👋 오늘도 멋진 회의를 시작해보세요.`
            : '안녕하세요! 👋 오늘도 멋진 회의를 시작해보세요.';
        
        document.getElementById('chatMessages').innerHTML = `
            <div class="message bot">
                <div class="message-bubble">${greeting}</div>
            </div>
        `;
    });
}

// 사용자 이름 가져오기
async function fetchUserName() {
    try {
        const response = await fetch('http://localhost:8080/api/auth/me', {  // [수정] user -> auth
            credentials: 'include'
        });
        if (response.ok) {
            const user = await response.json();
            return user.name;
        }
    } catch (error) {
        console.error('사용자 정보 가져오기 실패:', error);
    }
    return null;
}

// ============================================================
// 메시지 추가 (타이핑 애니메이션)
// ============================================================

function addMessage(text, isUser = false, source = null, useTyping = false) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user' : 'bot'}`;
    
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    
    messageDiv.appendChild(bubble);
    chatMessages.appendChild(messageDiv);
    
    // 히스토리에 저장
    currentChatHistory.push({
        role: isUser ? 'user' : 'assistant',
        content: text,
        source: source,
        timestamp: new Date().toISOString()
    });
    
    // 타이핑 애니메이션 (봇 메시지만)
    if (!isUser && useTyping) {
        typeText(bubble, text, source);
    } else {
        bubble.textContent = text;
    }
    
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function typeText(element, text, source, speed = 30, charsPerFrame = 3) {
    if (currentTypingTimeout) {
        clearTimeout(currentTypingTimeout);
    }
    
    let index = 0;
    
    function type() {
        if (index < text.length) {
            const chunk = text.substring(index, index + charsPerFrame);
            element.textContent += chunk;
            index += charsPerFrame;
            
            currentTypingTimeout = setTimeout(type, speed);
            
            const chatMessages = document.getElementById('chatMessages');
            chatMessages.scrollTop = chatMessages.scrollHeight;
        } else {
            currentTypingTimeout = null;
        }
    }
    
    type();
}

// ============================================================
// 로딩 애니메이션
// ============================================================

function showLoading() {
    const chatMessages = document.getElementById('chatMessages');
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message bot';
    loadingDiv.id = 'loadingMessage';
    
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';
    
    loadingDiv.appendChild(bubble);
    chatMessages.appendChild(loadingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeLoading() {
    const loading = document.getElementById('loadingMessage');
    if (loading) loading.remove();
}

// ============================================================
// 메시지 전송
// ============================================================

async function sendMessage() {
    if (currentTypingTimeout) {
        clearTimeout(currentTypingTimeout);
        currentTypingTimeout = null;
    }

    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    addMessage(message, true);
    input.value = '';
    
    showLoading();
    
    try {
        // FAQ는 FastAPI로, 검색은 Spring Boot로
        const endpoint = currentChatMode === 'search' 
            ? 'http://localhost:8080/api/chatbot/search'  // Spring Boot
            : 'http://localhost:8000/api/faq';            // FastAPI

        // [수정] 모드별로 요청 body 구조 다르게 생성
        let requestBody;
        
        if (currentChatMode === 'search') {
            // 회의록 검색: Spring Boot 형식
            requestBody = {
                message: message,
                history: currentChatHistory,
                session_id: currentSessionId || getSessionId()
            };
        } else {
            // FAQ: FastAPI 형식
            requestBody = {
                message: message,  // ← query 아니고 message!
                history: currentChatHistory || []  // ← history도 보내기
            };
        }

        console.log('📤 요청 body:', requestBody); // 디버깅용

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(requestBody)
        });
        
        removeLoading();
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        console.log('📡 응답 상태:', response.status);
        console.log('📡 Content-Type:', response.headers.get('content-type'));
        
        // JSON 파싱 에러 방지를 위해 text로 먼저 받고 파싱
        const text = await response.text();
        console.log('📡 응답 원본 길이:', text.length);
        console.log('📡 응답 시작:', text.substring(0, 100));
        
        let data;
        try {
            data = JSON.parse(text);
            console.log('✅ JSON 파싱 성공');
        } catch (parseError) {
            console.error('❌ JSON 파싱 실패:', parseError);
            console.error('❌ 파싱 실패 위치:', text.substring(1420, 1450));
            throw new Error('JSON 파싱 실패: ' + parseError.message);
        }
        
        if (data.session_id) {
            currentSessionId = data.session_id;
        } 
        
        // 타이핑 애니메이션으로 봇 응답 표시
        addMessage(data.answer || data.response || '응답을 받지 못했습니다.', false, data.source, true);
        
    } catch (error) {
        console.error('Error:', error);
        removeLoading();
        addMessage('오류가 발생했습니다. 다시 시도해주세요. 😥', false);
    }
}

function getSessionId() {
    let sessionId = localStorage.getItem('chatSessionId');
    if (!sessionId) {
        sessionId = 'session-' + Date.now();
        localStorage.setItem('chatSessionId', sessionId);
    }
    return sessionId;
}

function handleChatEnter(event) {
    if (event.key === 'Enter') {
        event.preventDefault();  // 기본 엔터 동작 방지
        
        const input = document.getElementById('chatInput');
        const message = input.value.trim();
        
        // 빈 메시지면 전송 안 함
        if (!message || message.length === 0) {
            console.log('[전송 차단] 빈 메시지');
            return;
        }
        
        sendMessage();
    }
}

function closeChat() {
    const chatBot = document.getElementById('chatBot');
    if (!chatBot) return;
    
    console.log('[CLOSE] 챗봇 닫기');
    
    // 1. 현재 대화 저장
    saveChatHistory();

        // 백엔드 컨텍스트 삭제
    if (currentSessionId) {
        deleteContextOnBackend(currentSessionId);
    }
    
    chatBot.classList.remove('open');
    
    // 대화 메시지 완전 초기화
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
        chatMessages.innerHTML = '';
        chatMessages.dataset.initialized = 'false';
    }
    
    // 2. 대화 히스토리 초기화 (저장 후)
    currentChatHistory = [];
    
    // 3. 새 세션 ID 생성
    currentSessionId = generateSessionId();
    localStorage.setItem('chatSessionId', currentSessionId);
    console.log('[CLOSE] 새 세션 ID:', currentSessionId);

    // 타이핑 애니메이션 중지
    if (currentTypingTimeout) {
        clearTimeout(currentTypingTimeout);
        currentTypingTimeout = null;
    }
    
    // 플로팅 버튼 다시 표시 & body 클래스 제거
    const floatingBtn = document.getElementById("floatingChatBtn");
    if (floatingBtn) floatingBtn.classList.remove("hidden");
    document.body.classList.remove("chat-open");
}

// 챗봇 초기화 - 사용자 이름으로 인사
async function initChatbot() {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    // 이미 초기화되었으면 건너뛰기
    if (chatMessages.dataset.initialized === 'true') {
        return;
    }
    
    const userName = await fetchUserName();
    const greeting = userName 
        ? `안녕하세요~ ${userName}님! 👋 오늘도 멋진 회의를 시작해보세요.`
        : '안녕하세요! 👋 오늘도 멋진 회의를 시작해보세요.';
    
    chatMessages.innerHTML = `
        <div class="message bot">
            <div class="message-bubble">${greeting}</div>
        </div>
    `;
    
    // 초기화 완료 표시
    chatMessages.dataset.initialized = 'true';
}

// 페이지 로드 시 챗봇 초기화
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function() {
        // chatMessages 요소가 있을 때만 초기화
        setTimeout(() => {
            if (document.getElementById('chatMessages')) {
                initChatbot();
            }
        }, 500); // 챗봇 HTML이 로드될 때까지 대기
    });
}

// ============================================================
// 새 대화 시작
// ============================================================

function startNewChat() {
    console.log('[NEW CHAT] 새 대화 시작');
    
    // 현재 대화 저장
    if (currentChatHistory.length > 0) {
        saveChatHistory();
    }

    // 백엔드 컨텍스트 삭제
    if (currentSessionId) {
        deleteContextOnBackend(currentSessionId);
    }
    
    // ========== 2. 새 세션 ID 생성 ==========
    currentSessionId = generateSessionId();
    localStorage.setItem('chatSessionId', currentSessionId);
    console.log('[NEW CHAT] 새 세션 ID:', currentSessionId);
    
    // 초기화
    currentChatHistory = [];
    
    // 타이핑 중지
    if (currentTypingTimeout) {
        clearTimeout(currentTypingTimeout);
        currentTypingTimeout = null;
    }
    
    // 화면 초기화
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = '';
    chatMessages.dataset.initialized = 'false';
    
    // 인사 메시지
    initChatbot();
}

// ============================================================
// 히스토리 토글
// ============================================================

function toggleHistory() {
    const sidebar = document.getElementById('historySidebar');
    const isOpen = sidebar.classList.contains('open');
    
    if (isOpen) {
        sidebar.classList.remove('open');
        removeHistoryOverlay();
    } else {
        sidebar.classList.add('open');
        addHistoryOverlay();
        loadHistoryList();
    }
}

function addHistoryOverlay() {
    const overlay = document.getElementById('historyOverlay');
    if (overlay) {
        overlay.onclick = toggleHistory;
        setTimeout(() => overlay.classList.add('active'), 10);
    }
}

function removeHistoryOverlay() {
    const overlay = document.getElementById('historyOverlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
}

// ============================================================
// 히스토리 목록 로드
// ============================================================

function loadHistoryList() {
    const historyList = document.getElementById('historyList');
    const histories = JSON.parse(localStorage.getItem('chatHistories') || '[]');
    
    if (histories.length === 0) {
        historyList.innerHTML = `
            <div class="history-empty">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <p>저장된 대화가 없습니다</p>
            </div>
        `;
        return;
    }
    
    historyList.innerHTML = histories.map((history, index) => {
        const date = new Date(history.timestamp);
        const timeStr = formatTimeAgo(date);
        const modeIcon = history.mode === 'search' ? '📝' : '💡';
        
        return `
            <div class="history-item" onclick="loadHistory(${index})">
                <div class="history-item-title">${history.title}</div>
                <div class="history-item-meta">
                    <div class="history-item-time">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                        </svg>
                        ${timeStr}
                    </div>
                    <div class="history-item-mode">${modeIcon} ${history.mode === 'search' ? '검색' : 'FAQ'}</div>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================================
// 히스토리 불러오기
// ============================================================

function loadHistory(index) {
    const histories = JSON.parse(localStorage.getItem('chatHistories') || '[]');
    const history = histories[index];
    
    if (!history) return;
    
    // 현재 대화 저장
    if (currentChatHistory.length > 0) {
        saveChatHistory();
    }
    
    // 히스토리 적용
    currentChatHistory = history.messages;
    currentChatMode = history.mode;
    currentSessionId = 'session-' + Date.now(); // 새 세션
    
    // 모드 전환
    switchChatMode(currentChatMode);
    
    // 화면에 메시지 복원
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = '';
    
    history.messages.forEach(msg => {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${msg.role === 'user' ? 'user' : 'bot'}`;
        
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        bubble.textContent = msg.content;
        
        messageDiv.appendChild(bubble);
        chatMessages.appendChild(messageDiv);
    });
    
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // 히스토리 닫기
    toggleHistory();
    
    console.log('📂 히스토리 불러오기:', history.title);
}

// ============================================================
// 시간 포맷
// ============================================================

function formatTimeAgo(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return '방금 전';
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    if (days < 7) return `${days}일 전`;
    
    return date.toLocaleDateString('ko-KR');
}

// ========== 페이지 로드 시 새 세션 시작 ==========
window.addEventListener('load', () => {
    console.log('[LOAD] 페이지 로드 - 새 세션 시작');
    currentSessionId = generateSessionId();
    localStorage.setItem('chatSessionId', currentSessionId);
    console.log('[LOAD] 세션 ID:', currentSessionId);
});

// ========== 페이지 언로드 시 컨텍스트 삭제 ==========
window.addEventListener('beforeunload', () => {
    console.log('[UNLOAD] 페이지 종료 - 대화 저장');
    saveChatHistory();

    // 백엔드 컨텍스트 삭제
    if (currentSessionId) {
        deleteContextOnBackend(currentSessionId);
    }

});
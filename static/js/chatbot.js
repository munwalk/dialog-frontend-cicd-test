let currentChatMode = 'search'; // 'search' 또는 'faq'
let currentSessionId = null;
let currentChatHistory = [];
let currentTypingTimeout = null;

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

function saveChatHistory() {
    const histories = JSON.parse(localStorage.getItem('chatHistories') || '[]');
    
    if (currentChatHistory.length > 0) {
        const history = {
            id: Date.now(),
            title: currentChatHistory[0].content.substring(0, 30) + '...',
            messages: currentChatHistory,
            mode: currentChatMode,
            timestamp: new Date().toISOString()
        };
        
        histories.unshift(history);
        
        // 최대 50개만 저장
        if (histories.length > 50) {
            histories.pop();
        }
        
        localStorage.setItem('chatHistories', JSON.stringify(histories));
    }
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
        const endpoint = currentChatMode === 'search' ? '/api/chatbot/search' : '/api/chatbot/faq';
        
        const response = await fetch(`http://localhost:8080${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
                message: message,
                history: [],
                session_id: currentSessionId || getSessionId()
            })
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
        
        // 히스토리 저장
        saveChatHistory();
        
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
    
    chatBot.classList.remove('open'); // ← display 대신 클래스로!
    
    // 대화 메시지 완전 초기화
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
        chatMessages.innerHTML = '';
        chatMessages.dataset.initialized = 'false';
    }
    
    // 대화 컨텍스트 초기화
    currentChatHistory = [];
    currentSessionId = null;
    
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
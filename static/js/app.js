// ============================================================
// API URL 설정
// ============================================================

const API_BASE_URL = 'http://localhost:8080/api';

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.toggle('collapsed');
    }
}

// 페이지 전환 (SPA 스타일)
function changePage(pageName) {
    const pages = ['mainPage', 'recordingPage', 'meetingsPage'];
    pages.forEach(id => {
        const page = document.getElementById(id);
        if (page) page.classList.add('hidden');
    });

    if (pageName === 'main') {
        const mainPage = document.getElementById('mainPage');
        if (mainPage) mainPage.classList.remove('hidden');
    } else if (pageName === 'recording') {
        const recordingPage = document.getElementById('recordingPage');
        if (recordingPage) recordingPage.classList.remove('hidden');
    } else if (pageName === 'meetings') {
        const meetingsPage = document.getElementById('meetingsPage');
        if (meetingsPage) meetingsPage.classList.remove('hidden');
    }

    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => item.classList.remove('active'));
    if (event) {
        const navItem = event.target.closest('.nav-item');
        if (navItem) navItem.classList.add('active');
    }
}

function openChat() {
    const chat = document.getElementById("chatBot");
    
    if (!chat) {
        console.error('❌ #chatBot 요소를 찾을 수 없습니다!');
        console.log('💡 챗봇 HTML이 아직 로드되지 않았을 수 있습니다.');
        return;
    }
    
    console.log('✅ 챗봇 열기 시작');
    
    // display 복구
    chat.style.display = 'flex';
    chat.classList.add("open");
    
    // 플로팅 버튼 숨기기
    const floatingBtn = document.getElementById("floatingChatBtn");
    if (floatingBtn) floatingBtn.classList.add("hidden");
    document.body.classList.add("chat-open");
    
    // ========== 챗봇 초기화 (지연 실행) ==========
    setTimeout(() => {
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages && typeof initChatbot === 'function') {
            console.log('✅ 챗봇 초기화 실행');
            initChatbot();
        } else {
            console.warn('⚠️ chatMessages 또는 initChatbot 함수를 찾을 수 없습니다.');
        }
    }, 100);
}

function closeChat() {
    const chatBot = document.getElementById('chatBot');
    if (!chatBot) return;
    
    chatBot.classList.remove('open'); // ← 클래스로 처리
    
    // 나머지 코드는 그대로
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
        chatMessages.innerHTML = '';
        chatMessages.dataset.initialized = 'false';
    }
    
    currentChatHistory = [];
    currentSessionId = null;
    
    if (currentTypingTimeout) {
        clearTimeout(currentTypingTimeout);
        currentTypingTimeout = null;
    }
    
    // [추가] 플로팅 버튼 다시 표시
    const floatingBtn = document.getElementById("floatingChatBtn");
    if (floatingBtn) floatingBtn.classList.remove("hidden");
    document.body.classList.remove("chat-open");
}

function sendMessage() {
    console.log("메시지 전송 (UI만)");
}

function handleChatEnter(e) {
    if (e.key === "Enter") sendMessage();
}

// 페이지 전환 함수
function showPage(pageName) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.add('hidden');
    });

    const targetPage = document.getElementById(pageName + 'Page');
    if (targetPage) targetPage.classList.remove('hidden');

    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    const activeNav = document.querySelector(`[data-page="${pageName}"]`);
    if (activeNav) activeNav.classList.add('active');

    if (pageName === 'home' && typeof window.refreshHomeData === 'function') {
        window.refreshHomeData();
    }

    if (pageName === 'calendar' && typeof initCalendar === 'function') {
        initCalendar();
    }
}

document.addEventListener('DOMContentLoaded', async () => {

    // ========== 챗봇 초기화 ==========
    await window.initializeChatbot();
        
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const pageName = item.getAttribute('data-page');
            if (pageName) showPage(pageName);
        });
    });

    try {
        // 현재 로그인된 사용자 정보 가져오기
        const user = await loadCurrentUser();
        // 관리자 페이지 이동 버튼 요소
        const adminBtn = document.getElementById('adminButton');
        // role이 ADMIN인지 체크 후 버튼 노출/숨김 제어
        if (user && user.role === 'ADMIN' && adminBtn) {
            adminBtn.style.display = 'inline-block'; // 버튼 보이기
        } else if (adminBtn) {
            adminBtn.style.display = 'none'; // 버튼 숨기기
        }
    } catch (error) {
        console.error('유저 정보 로드 실패:', error);
        const adminBtn = document.getElementById('adminButton');
        if (adminBtn) adminBtn.style.display = 'none'; // 문제 발생 시 버튼 숨김
    }
});


// 프로필 드롭다운 토글
function toggleProfileDropdown() {
    const dropdown = document.getElementById('profileDropdown');
    if (dropdown) {
        dropdown.classList.toggle('active');
    }
}

// 외부 클릭 시 드롭다운 닫기
document.addEventListener('click', function(event) {
    const dropdown = document.getElementById('profileDropdown');
    const authBtn = document.querySelector('.auth-btn');
    
    if (dropdown && authBtn) {
        if (!authBtn.contains(event.target) && !dropdown.contains(event.target)) {
            dropdown.classList.remove('active');
        }
    }
});

// 설정 페이지로 이동
function goToSettings() {
    window.location.href = 'settings.html';
    const dropdown = document.getElementById('profileDropdown');
    if (dropdown) {
        dropdown.classList.remove('active');
    }
}

// =====================================
// ✅ 유틸리티 함수
// =====================================
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
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c =>
            '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        ).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) { 
        console.error('JWT 파싱 실패:', e);
        return null; 
    }
}

// 어드민 페이지로 이동
function goToAdminDashboard() {
  window.location.href = '/dashboard.html';  
}



// =====================================
// ✅ 사용자 정보 주입 함수 (통합)
// =====================================
async function loadCurrentUser() {
    try {
        // axios 인스턴스 사용 (fetch 대신)
        const response = await apiClient.get('/auth/me');
        if (response.status === 200) {
            const user = response.data;
            displayUserName(user);
            return user;
        }
    } catch (error) {
        if (error.response && error.response.status === 401) {
            // 여기서 바로 리다이렉트 하지 말고,
            // 재발급 인터셉터가 처리할 수 있도록 에러 반환
            console.warn('401 Unauthorized 발생, 토큰 재발급을 시도하세요.');
            throw error; 
        } else {
            console.error('네트워크 오류', error);
            displayUserName(null);
            return null;
        }
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
    // 챗봇 이름 표시
    const chatWelcomeName = document.querySelector("#chat-name"); 
    if (chatWelcomeName) 
        chatWelcomeName.textContent = (user && user.name) || (user && user.email) || '사용자';

    // 사이드바 이메일
    document.querySelectorAll(".user-email").forEach(el => {
        el.textContent = (user && user.email) || '';
    });

    // 사이드바 아바타 (선택)
    document.querySelectorAll(".user-avatar").forEach(el => {
        el.textContent = (user && user.name) ? user.name.charAt(0).toUpperCase() : "U";
    });
}


// =====================================
// axios 인스턴스 생성, 쿠키 자동 포함
// =====================================
const apiClient = axios.create({
    baseURL: 'http://localhost:8080/api',
    withCredentials: true,
});

// =====================================
// ✅ 중복 재발급 방지 및 요청 큐 로직 추가
// =====================================
let isTokenRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    // 큐에 대기 중인 요청들을 처리하거나 실패를 전달
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

// =====================================
// 토큰 재발급 함수
// =====================================

async function requestTokenReissue() {
    try {
        //  재발급 요청 시도 로그 추가
        console.log(' JWT 재발급 요청 시작: /api/reissue'); 
        const response = await apiClient.post('/reissue');
        if (response.status === 200) {
            console.log('Access token 재발급 성공');
            return true;
        }
    } catch (error) {
        // 요청 실패 로그 강화 (error.response 확인)
        console.error('JWT 재발급 실패 (서버 응답 확인 필요):', error.response || error);
    }
    return false; 
}

// =====================================
// axios 요청 인터셉터 (수정됨)
// =====================================
apiClient.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;
    
    // 401 에러가 아니거나, 재시도 요청이거나, 요청 정보가 없으면 무시
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // [중요] Google 재연동 오류(invalid_grant)는 인터셉터가 처리하지 않고
    //          원래 요청(calendar.js)의 catch 블록으로 즉시 보냅니다.
    if (error.response.data && error.response.data.errorCode === "GOOGLE_REAUTH_REQUIRED") {
        console.warn("인터셉터: Google 재연동 필요. 'calendar.js'로 처리를 위임합니다.");
        return Promise.reject(error);
    }

    // 1. 재발급 시도 중인 경우: 현재 요청을 큐에 추가하고 대기
    if (isTokenRefreshing) {
      return new Promise(function(resolve, reject) {
        failedQueue.push({ resolve, reject, originalRequest });
      })
      .then(() => {
        // 큐에 있던 요청을 재시도
        return apiClient(originalRequest);
      })
      .catch(err => {
        return Promise.reject(err);
      });
    }

    // 2. 재발급 시도 시작 (isTokenRefreshing이 false인 경우)
    isTokenRefreshing = true;
    originalRequest._retry = true;

    try {
      // [수정] 오직 JWT 재발급만 시도
      const jwtReissueSuccess = await requestTokenReissue();
      
      if (jwtReissueSuccess) {
        console.log("JWT Access Token 재발급 성공, 큐 처리 및 요청 재시도");
        processQueue(null, null); // 큐에 대기 중인 요청 처리
        await loadCurrentUser(); // (선택) 헤더 UI 업데이트
        return apiClient(originalRequest);
      }

      // [수정] Google 토큰 재발급 로직 (fetchGoogleAccessToken) 삭제
      // [수정] JWT 재발급 실패 시 바로 예외 발생
      console.error("JWT 토큰 재발급 실패");
      throw new Error('JWT reissue failed'); 

    } catch (err) {
      // 최종 실패 시 로그인 페이지로 리다이렉트
      console.error("JWT 재발급 최종 실패! 로그인 페이지로 이동합니다. ");
      processQueue(err, null); // 큐에 대기 중인 요청에 실패 전달
      logout();
      return Promise.reject(err);
    } finally {
      isTokenRefreshing = false; // 재발급 플래그 해제
    }
  }
);
// =====================================
// 커스텀 예외 처리 함수 
// =====================================
window.CustomExceptionHandlers = {
    handleGoogleOAuthException(errorData, context) {
        showAlert(errorData.message || "Google OAuth 인증 오류가 발생했습니다.", 'error', context);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('userInfo');
        document.cookie = 'jwt=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        console.warn("GoogleOAuthException 발생, 사용자 재로그인 필요");
        setTimeout(() => {
            window.location.href = "/login.html";
        }, 2000);
    },
    handleResourceNotFoundException(errorData, context) {
        showAlert(errorData.message || "요청한 리소스를 찾을 수 없습니다.", 'error', context);
    },
    handleAccessDeniedException(errorData, context) {
        showAlert(errorData.message || "접근 권한이 없습니다.", 'error', context);
    },
    handleBadRequestException(errorData, context) {
        // signup 쪽이면 개별 필드 에러로, 아니면 공통 알림으로
        if (context === 'signup') {
            showSignupEmailError(errorData.message || "잘못된 요청입니다.");
        } else if (context === 'forgot') {
            const forgotMessage = document.getElementById('forgotMessage');
            forgotMessage.textContent = errorData.message || "잘못된 요청입니다.";
            forgotMessage.classList.add('show', 'error-alert');
            setTimeout(() => {
                forgotMessage.classList.remove('show');
                forgotMessage.textContent = '';
            }, 3000);
        } else {
            showAlert(errorData.message || "잘못된 요청입니다.", 'error', context);
        }
    },
    handleUserNotFoundException(errorData, context) {
        if (context === 'signup') {
            showSignupEmailError(errorData.message || "존재하지 않는 아이디입니다.");
        } else if (context === 'forgot') {
            const forgotMessage = document.getElementById('forgotMessage');
            forgotMessage.textContent = errorData.message || "존재하지 않는 사용자입니다.";
            forgotMessage.classList.add('show', 'error-alert');
            setTimeout(() => {
                forgotMessage.classList.remove('show');
                forgotMessage.textContent = '';
            }, 3000);
        } else {
            showEmailError(errorData.message || "존재하지 않는 아이디입니다.");
        }
    },
    handleUserAlreadyExistsException(errorData, context) {
        showAlert(errorData.message || "이미 존재하는 사용자입니다.", 'error', context);
    },
    handleInvalidPasswordException(errorData, context) {
        if (context === 'signup') {
            showSignupPasswordError(errorData.message || "비밀번호가 올바르지 않습니다.");
        } else {
            showPasswordError(errorData.message || "비밀번호가 올바르지 않습니다.");
        }
    },
    handleInactiveUserException(errorData, context) {
        showAlert(errorData.message || "비활성화된 사용자입니다. 문의해 주세요.", 'error', context);
    },
    handleUserRoleAccessDeniedException(errorData, context) {
        showAlert(errorData.message || "접근 권한이 없습니다.", 'error', context);
    },
    handleSocialUserSaveException(errorData, context) {
        showAlert(errorData.message || "소셜 사용자 저장에 실패했습니다.", 'error', context);
    },
    handleRefreshTokenException(errorData, context) {
        showAlert(errorData.message || "리프레시 토큰 오류입니다. 재로그인 해주세요.", 'error', context);
    },
    handleSocialUserInfoException(errorData, context) {
        showAlert(errorData.message || "소셜 사용자 정보 처리 중 오류가 발생했습니다.", 'error', context);
    },
    handleInvalidJwtTokenException(errorData, context) {
        showAlert(errorData.message || "유효하지 않은 토큰입니다. 재인증이 필요합니다.", 'error', context);
    },
    handleOAuthUserNotFoundException(errorData, context) {
        showAlert(errorData.message || "OAuth 사용자 정보를 찾을 수 없습니다.", 'error', context);
    },
    handleTermsNotAcceptedException(errorData, context) {
        showTermsError(errorData.message || "약관에 동의해야 가입할 수 있습니다.");
    },
    handleErrorResponse(status, errorData, context) {
        switch (status) {
            case 400:
                if (errorData.error === "약관 미동의") {
                    this.handleTermsNotAcceptedException(errorData, context);
                } else if (errorData.error === "이미 존재하는 사용자") {
                    this.handleUserAlreadyExistsException(errorData, context);
                } else if (errorData.error === "사용자 없음") {
                    this.handleUserNotFoundException(errorData, context);
                } else {
                    this.handleBadRequestException(errorData, context);
                }
                break;
            case 401:
                if (errorData.errorCode === "GOOGLE_REAUTH_REQUIRED") {
                    this.handleGoogleOAuthException(errorData, context);
                } else if (errorData.error === "비밀번호 오류") {
                    this.handleInvalidPasswordException(errorData, context);
                } else if (errorData.error === "리프레시 토큰 오류") {
                    this.handleRefreshTokenException(errorData, context);
                } else if (errorData.error === "유효하지 않은 토큰") {
                    this.handleInvalidJwtTokenException(errorData, context);
                } else {
                    showAlert(errorData.message || "인증이 필요합니다.", 'error', context);
                }
                break;
            case 403:
                if (errorData.error === "권한 없음") {
                    this.handleUserRoleAccessDeniedException(errorData, context);
                } else if (errorData.error === "비활성 사용자") {
                    this.handleInactiveUserException(errorData, context);
                } else if (errorData.error === "소셜 사용자 저장 실패") {
                    this.handleSocialUserSaveException(errorData, context);
                } else {
                    this.handleAccessDeniedException(errorData, context);
                }
                break;
            case 404:
                if (errorData.error === "사용자 없음") {
                    this.handleUserNotFoundException(errorData, context);
                } else if (errorData.error === "OAuth 사용자 없음") {
                    this.handleOAuthUserNotFoundException(errorData, context);
                } else {
                    this.handleResourceNotFoundException(errorData, context);
                }
                break;
            case 500:
                if (errorData.error === "소셜 사용자 정보 오류") {
                    this.handleSocialUserInfoException(errorData, context);
                } else if (context === 'forgot') {
                    const forgotMessage = document.getElementById('forgotMessage');
                    forgotMessage.textContent = errorData.message || "서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
                    forgotMessage.classList.add('show', 'error-alert');
                    setTimeout(() => {
                        forgotMessage.classList.remove('show');
                        forgotMessage.textContent = '';
                    }, 3000);
                } else {
                    showAlert("서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해주세요.", 'error', context);
                }
                break;
            default:
                if (context === 'forgot') {
                    const forgotMessage = document.getElementById('forgotMessage');
                    forgotMessage.textContent = errorData.message || "알 수 없는 오류가 발생했습니다.";
                    forgotMessage.classList.add('show', 'error-alert');
                    setTimeout(() => {
                        forgotMessage.classList.remove('show');
                        forgotMessage.textContent = '';
                    }, 3000);
                } else {
                    showAlert(errorData.message || "알 수 없는 오류가 발생했습니다.", 'error', context);
                }
                break;
        }
    }
};


// =====================================
// 소셜 로그인 후 또는 토큰 재발급 요청
// =====================================
async function fetchGoogleAccessToken() {
    const token = getCookie('jwt'); // 또는 다른 곳에서 토큰 획득
    const payload = parseJwt(token);
    const userEmail = payload?.email;

    if (!userEmail) {
        return false; // 토큰 파싱 실패 시 false만 반환
    }

    try {
        //  재발급 요청 시도 로그 추가
        console.log('Google 토큰 재발급 요청 시작: /api/oauth2/google/token');
        const response = await apiClient.post('/oauth2/google/token', null, {
            params: { userEmail },
        });
        return true;
    } catch (e) {
        //  요청 실패 로그 강화
        console.error('Google 토큰 재발급 실패 (서버 응답 확인 필요):', e.response || e);
        return false;
    }
}


// =====================================
// ✅ 로그아웃 함수 (수정됨)
// =====================================
async function logout() {
    const result = await showConfirm('로그아웃 하시겠습니까?');
    if (result) {
        try {
            await fetch('http://localhost:8080/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include' 
            });
            showAlert('정상적으로 로그아웃되었습니다.','success');
        } catch (error) {
            showAlert('로그아웃 처리 중 오류가 발생했습니다.', 'error');
            console.error("로그아웃 요청 중 에러 발생 (무시하고 진행):", error);
        } finally {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('jwtToken');
            localStorage.removeItem('user');
            window.location.href = 'login.html';
        }
    }
    const dropdown = document.getElementById('profileDropdown');
    if (dropdown) {
        dropdown.classList.remove('active');
    }
}

// ============================================================
// 챗봇 HTML 로드 함수
// ============================================================

async function loadChatbotHTML() {
    try {
        const response = await fetch('components/chatbot.html');
        if (!response.ok) {
            throw new Error(`챗봇 HTML 로드 실패: ${response.status}`);
        }
        
        const html = await response.text();
        
        // #chatbot-container에 주입
        const container = document.getElementById('chatbot-container');
        if (container) {
            container.innerHTML = html;
            console.log('✅ 챗봇 HTML 로드 완료');
            return true;
        } else {
            console.error('❌ #chatbot-container를 찾을 수 없습니다!');
            return false;
        }
    } catch (error) {
        console.error('❌ 챗봇 HTML 로드 오류:', error);
        return false;
    }
}

// ============================================================
// 챗봇 JS 로드 함수 (중복 방지)
// ============================================================
function loadChatbotJS() {
    if (document.querySelector('script[src="static/js/chatbot.js"]')) {
        console.log('ℹ️ 챗봇 JS 이미 로드됨');
        attachChatbotEvents(); // 이벤트 재부착
        return;
    }
    
    const script = document.createElement('script');
    script.src = 'static/js/chatbot.js';
    script.onload = () => {
        console.log('✅ 챗봇 JS 로드 완료');
        attachChatbotEvents(); // 로드 완료 후 이벤트 부착
    };
    script.onerror = () => {
        console.error('❌ 챗봇 JS 로드 실패');
    };
    document.body.appendChild(script);
}

// ============================================================
// 전역 챗봇 초기화 함수 (중복 방지)
// ============================================================
window.initializeChatbot = async function() {
    // 이미 초기화되었는지 체크
    if (window._chatbotInitialized) {
        console.log('ℹ️ 챗봇 이미 초기화됨');
        return;
    }
    
    const chatbotContainer = document.getElementById('chatbot-container');
    
    if (!chatbotContainer) {
        console.log('ℹ️ 챗봇 컨테이너 없음');
        return;
    }

    // CSS 중복 체크
    if (!document.querySelector('link[href="static/css/chatbot.css"]')) {
        const chatbotCSS = document.createElement('link');
        chatbotCSS.rel = 'stylesheet';
        chatbotCSS.href = 'static/css/chatbot.css';
        document.head.appendChild(chatbotCSS);
        console.log('✅ chatbot.css 로드');
    }

    const htmlLoaded = await loadChatbotHTML();
    
    if (htmlLoaded) {
        loadChatbotJS();
        window._chatbotInitialized = true;
    }
};

// ============================================================
/* =========================================
   ✅ 전역 알림(Toast) 함수 추가
   어디서든 showAlert('메시지', 'error') 형태로 호출 가능
========================================= */
window.showAlert = function(message, type = 'success') {
    // 1. 기존에 떠 있는 알림이 있다면 제거 (중복 방지)
    const existingToast = document.getElementById('global-toast');
    if (existingToast) existingToast.remove();

    // 2. 스타일 설정 (성공: 보라색/초록색, 에러: 빨간색)
    let bgColor, textColor, icon;
    if (type === 'error') {
        bgColor = '#FEE2E2'; // 연한 빨강
        textColor = '#DC2626'; // 진한 빨강
        icon = '⚠️';
    } else {
        bgColor = '#8E44AD'; // 메인 테마 보라색
        textColor = '#FFFFFF'; // 흰색 텍스트
        icon = '✅';
    }

    // 3. HTML 생성 (화면 상단 중앙에 뜸)
    const toastHtml = `
        <div id="global-toast" style="
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%) translateY(-20px);
            background-color: ${bgColor};
            color: ${textColor};
            padding: 12px 24px;
            border-radius: 50px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            font-weight: 600;
            font-size: 15px;
            display: flex;
            align-items: center;
            gap: 8px;
            opacity: 0;
            transition: all 0.3s cubic-bezier(0.68, -0.55, 0.27, 1.55);
        ">
            <span>${icon}</span>
            <span>${message}</span>
        </div>
    `;

    // 4. Body에 추가
    document.body.insertAdjacentHTML('beforeend', toastHtml);

    // 5. 등장 애니메이션
    requestAnimationFrame(() => {
        const toast = document.getElementById('global-toast');
        if (toast) {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(-50%) translateY(0)'; // 아래로 툭 떨어지는 효과
        }
    });

    // 6. 3초 뒤 자동 삭제
    setTimeout(() => {
        const toast = document.getElementById('global-toast');
        if (toast) {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(-20px)'; // 위로 사라짐
            setTimeout(() => toast.remove(), 300);
        }
    }, 3000);
};

/* =========================================
   ✅ 전역 컨펌(Confirm) 함수 추가
   const result = await showConfirm('삭제하시겠습니까?'); 형태로 사용
========================================= */
window.showConfirm = function(message) {
    return new Promise((resolve) => {
        // 1. 기존에 떠 있는 컨펌 창이 있다면 제거 (중복 방지)
        const existingConfirm = document.getElementById('global-confirm');
        if (existingConfirm) existingConfirm.remove();

        // 2. HTML 생성 (배경 오버레이 + 모달 창)
        const confirmHtml = `
            <div id="global-confirm" style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 20000;
                opacity: 0;
                transition: opacity 0.3s ease;
            ">
                <div style="
                    background: white;
                    padding: 30px;
                    border-radius: 16px;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.2);
                    text-align: center;
                    min-width: 320px;
                    transform: scale(0.9);
                    transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                ">
                    <div style="font-size: 40px; margin-bottom: 10px;"></div>
                    <p style="
                        margin: 0 0 24px 0; 
                        font-size: 17px; 
                        color: #333; 
                        font-weight: 600;
                        line-height: 1.5;
                    ">${message}</p>
                    
                    <div style="display: flex; gap: 10px; justify-content: center;">
                        <button id="btn-cancel" style="
                            padding: 10px 24px;
                            border: none;
                            border-radius: 8px;
                            background-color: #E5E7EB;
                            color: #4B5563;
                            font-weight: 600;
                            cursor: pointer;
                            font-size: 14px;
                        ">취소</button>
                        <button id="btn-confirm" style="
                            padding: 10px 24px;
                            border: none;
                            border-radius: 8px;
                            background-color: #8E44AD; 
                            color: white;
                            font-weight: 600;
                            cursor: pointer;
                            font-size: 14px;
                        ">확인</button>
                    </div>
                </div>
            </div>
        `;

        // 3. Body에 추가
        document.body.insertAdjacentHTML('beforeend', confirmHtml);

        // 4. 등장 애니메이션
        const modalOverlay = document.getElementById('global-confirm');
        const modalBox = modalOverlay.querySelector('div'); // 내부 박스

        requestAnimationFrame(() => {
            modalOverlay.style.opacity = '1';
            modalBox.style.transform = 'scale(1)';
        });

        // 5. 버튼 이벤트 핸들링 및 종료 처리 함수
        const cleanup = (result) => {
            modalOverlay.style.opacity = '0';
            modalBox.style.transform = 'scale(0.9)';
            
            // 애니메이션 시간(0.3s) 후 DOM 제거 및 Promise 반환
            setTimeout(() => {
                modalOverlay.remove();
                resolve(result); // true(확인) 또는 false(취소) 반환
            }, 300);
        };

        // 6. 버튼 클릭 리스너 등록
        document.getElementById('btn-confirm').onclick = () => cleanup(true);
        document.getElementById('btn-cancel').onclick = () => cleanup(false);
        
        // (옵션) 배경 클릭 시 취소 처리하려면 아래 주석 해제
        // modalOverlay.onclick = (e) => { if(e.target === modalOverlay) cleanup(false); };
    });
};

// 챗봇 이벤트 부착 함수
function attachChatbotEvents() {
    const floatingBtn = document.getElementById('floatingChatBtn');
    
    if (floatingBtn) {
        // 기존 이벤트 제거 (중복 방지)
        floatingBtn.replaceWith(floatingBtn.cloneNode(true));
        
        // 새로 가져온 버튼에 이벤트 부착
        const newBtn = document.getElementById('floatingChatBtn');
        newBtn.addEventListener('click', openChat);
        
        console.log('✅ 챗봇 버튼 이벤트 부착 완료');
    } else {
        console.warn('⚠️ floatingChatBtn 찾을 수 없음');
    }
}

// 챗봇 열기
function openChat() {
    console.log('✅ 챗봇 열기 시작');
    const chatBot = document.getElementById('chatBot');
    const floatingBtn = document.getElementById('floatingChatBtn');
    
    if (!chatBot) {
        console.error('❌ chatBot 요소를 찾을 수 없습니다');
        return;
    }
    
    chatBot.classList.add('open');
    if (floatingBtn) floatingBtn.classList.add('hidden');
    document.body.classList.add('chat-open');
    
    // 챗봇이 열릴 때 초기화
    if (typeof initChatbot === 'function') {
        initChatbot();
    }
    
    console.log('✅ 챗봇 열림');
}
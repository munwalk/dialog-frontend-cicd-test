/* ===============================
    Longin & Signup 탭 변환
=================================*/
// 탭 요소와 폼, 컨테이너 선택
const signinTab = document.getElementById('signinTab');
const signupTab = document.getElementById('signupTab');
const signinForm = document.getElementById('signinForm');
const signupForm = document.getElementById('signupForm');
const authContainer = document.querySelector('.auth-container');

signinTab.addEventListener('click', function() {
    signinTab.classList.add('active');
    signupTab.classList.remove('active');
    signinForm.classList.add('active');
    signupForm.classList.remove('active');
    authContainer.classList.remove('signup-mode');
    hideAlerts();
    clearFieldErrors();
});

signupTab.addEventListener('click', function() {
    signupTab.classList.add('active');
    signinTab.classList.remove('active');
    signupForm.classList.add('active');
    signinForm.classList.remove('active');
    authContainer.classList.add('signup-mode');
    hideAlerts();
    clearFieldErrors();
});

/* ===============================
    비밀번호 표시/숨기기 기능
=================================*/
const passwordToggles = document.querySelectorAll('.password-toggle');

passwordToggles.forEach(toggle => {
    toggle.addEventListener('click', function() {
        const targetId = this.getAttribute('data-target');
        const input = document.getElementById(targetId);
        const eyeIcon = this.querySelector('.eye-icon');
        const eyeOffIcon = this.querySelector('.eye-off-icon');
        
        if (input.type === 'password') {
            input.type = 'text';
            eyeIcon.style.display = 'none';
            eyeOffIcon.style.display = 'block';
        } else {
            input.type = 'password';
            eyeIcon.style.display = 'block';
            eyeOffIcon.style.display = 'none';
        }
    });
});

/* ===============================
    이메일/비밀번호 필드 에러 알림 요소
=================================*/
const emailErrorAlert = document.getElementById('emailErrorAlert');
const passwordErrorAlert = document.getElementById('passwordErrorAlert');

function clearFieldErrors() {
    emailErrorAlert.textContent = '';
    emailErrorAlert.classList.remove('show');
    passwordErrorAlert.textContent = '';
    passwordErrorAlert.classList.remove('show');
}

function showEmailError(message) {
    clearFieldErrors();
    emailErrorAlert.textContent = message;
    emailErrorAlert.classList.add('show');
    setTimeout(() => {
        emailErrorAlert.classList.remove('show');
        emailErrorAlert.textContent = '';
    }, 2000);
}

function showPasswordError(message) {
    clearFieldErrors();
    passwordErrorAlert.textContent = message;
    passwordErrorAlert.classList.add('show');
    setTimeout(() => {
        passwordErrorAlert.classList.remove('show');
        passwordErrorAlert.textContent = '';
    }, 2000);
}

/* ===============================
    팝업 알림 함수 (디버깅 로그 포함)
=================================*/
function showAlert(message, type, context) {
    let errorAlert, successAlert;

    if (context === 'signup') {
        errorAlert = document.getElementById('signupErrorAlert');
        successAlert = document.getElementById('signupSuccessAlert');
    } else {
        // 기본값은 로그인폼
        errorAlert = document.getElementById('signinErrorAlert');
        successAlert = document.getElementById('signinSuccessAlert');
    }

    if (!errorAlert || !successAlert) {
        console.warn('알림 영역 DOM 요소를 찾을 수 없습니다.');
        return;
    }
    hideAlerts(context);

    const alertDiv = type === 'error' ? errorAlert : successAlert;
    alertDiv.textContent = message;
    alertDiv.classList.add('show');
    setTimeout(() => {
        alertDiv.classList.remove('show');
        alertDiv.textContent = '';
    }, 3000);
}


function hideAlerts(context) {
    let errorAlert, successAlert;
    if (context === 'signup') {
        errorAlert = document.getElementById('signupErrorAlert');
        successAlert = document.getElementById('signupSuccessAlert');
    } else {
        errorAlert = document.getElementById('signinErrorAlert');
        successAlert = document.getElementById('signinSuccessAlert');
    }
    if (errorAlert) errorAlert.classList.remove('show');
    if (successAlert) successAlert.classList.remove('show');
}

/* ===============================
    로그인 폼 제출 처리 (이메일/비밀번호 예외 분리 처리 적용)
=================================*/
signinForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const email = document.getElementById('signin-email').value.trim();
    const password = document.getElementById('signin-password').value;
    clearFieldErrors();

    if (!email || !password) {
        showAlert('이메일과 비밀번호를 모두 입력하세요.', 'error');
        return;
    }

    try {
        const response = await fetch('http://localhost:8080/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
            credentials: 'include'
        });
        const data = await response.json();

        if (response.ok && data.token) {
            showAlert('로그인 성공!', 'success');
            setTimeout(() => {
                window.location.href = '/home.html'; 
            }, 2000);
        } else {
            if (response.status === 400) {
                if (data.error === "존재하지 않는 아이디" || data.error === "이메일 오류") {
                    showEmailError(data.message || "존재하지 않는 이메일입니다.");
                } else if (data.error === "비밀번호 오류" || data.error === "비밀번호가 올바르지 않습니다.") {
                    showPasswordError(data.message || "비밀번호가 올바르지 않습니다.");
                } else {
                    window.CustomExceptionHandlers.handleErrorResponse(response.status, data);
                }
            } else {
                window.CustomExceptionHandlers.handleErrorResponse(response.status, data);
            }
        }
    } catch (error) {
        console.error('네트워크 또는 서버 오류:', error);
        window.CustomExceptionHandlers.handleErrorResponse(null, { message: '네트워크 오류 또는 서버 오류: ' + error.message });
    }
});
// 각 회원가입용 에러 함수, 초기화 함수 추가
const signupNameErrorAlert = document.getElementById('signupNameErrorAlert');
const signupEmailErrorAlert = document.getElementById('signupEmailErrorAlert');
const signupPasswordErrorAlert = document.getElementById('signupPasswordErrorAlert');
const signupConfirmErrorAlert = document.getElementById('signupConfirmErrorAlert');
const termsErrorAlert = document.getElementById('termsErrorAlert');

// 전체 에러 초기화
function clearSignupFieldErrors() {
    signupNameErrorAlert.textContent = '';
    signupNameErrorAlert.classList.remove('show');
    signupEmailErrorAlert.textContent = '';
    signupEmailErrorAlert.classList.remove('show');
    signupPasswordErrorAlert.textContent = '';
    signupPasswordErrorAlert.classList.remove('show');
    signupConfirmErrorAlert.textContent = '';
    signupConfirmErrorAlert.classList.remove('show');
    if(termsErrorAlert) {
    termsErrorAlert.textContent = '';
    termsErrorAlert.classList.remove('show');
    }
}

// 각 필드 에러 표시 함수
function showSignupNameError(msg) {
    clearSignupFieldErrors();
    signupNameErrorAlert.textContent = msg;
    signupNameErrorAlert.classList.add('show');
    setTimeout(() => {
        signupNameErrorAlert.classList.remove('show');
        signupNameErrorAlert.textContent = '';
    }, 2000);
}
function showSignupEmailError(msg) {
    clearSignupFieldErrors();
    signupEmailErrorAlert.textContent = msg;
    signupEmailErrorAlert.classList.add('show');
    setTimeout(() => {
        signupEmailErrorAlert.classList.remove('show');
        signupEmailErrorAlert.textContent = '';
    }, 2000);
}
function showSignupPasswordError(msg) {
    clearSignupFieldErrors();
    signupPasswordErrorAlert.textContent = msg;
    signupPasswordErrorAlert.classList.add('show');
    setTimeout(() => {
        signupPasswordErrorAlert.classList.remove('show');
        signupPasswordErrorAlert.textContent = '';
    }, 2000);
}
function showSignupConfirmError(msg) {
    clearSignupFieldErrors();
    signupConfirmErrorAlert.textContent = msg;
    signupConfirmErrorAlert.classList.add('show');
    setTimeout(() => {
        signupConfirmErrorAlert.classList.remove('show');
        signupConfirmErrorAlert.textContent = '';
    }, 2000);
}
function showTermsError(msg) {
    termsErrorAlert.textContent = msg;
    termsErrorAlert.classList.add('show');
    setTimeout(() => {
        termsErrorAlert.classList.remove('show');
        termsErrorAlert.textContent = '';
    }, 2000);
}
/* ===============================
    회원가입 폼 제출 처리 (디버깅 포함)
=================================*/
signupForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    clearSignupFieldErrors();

    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirm = document.getElementById('signup-confirm').value;
    const terms = document.getElementById('terms').checked;

    if (!name) {
        showSignupNameError('이름을 입력해주세요.');
        return;
    }
    if (name.length < 2) {
        showSignupNameError('이름은 2자 이상 입력해주세요.');
        return;
    }
    if (!email) {
        showSignupEmailError('이메일을 입력해주세요.');
        return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showSignupEmailError('올바른 이메일 형식을 입력해주세요.');
        return;
    }
    if (!password) {
        showSignupPasswordError('비밀번호를 입력해주세요.');
        return;
    }
    if (password.length < 12) {
        showSignupPasswordError('비밀번호는 12자 이상 입력해주세요.');
        return;
    }
    if (!confirm) {
        showSignupConfirmError('비밀번호 확인을 입력해주세요.');
        return;
    }
    if (password !== confirm) {
        showSignupConfirmError('비밀번호가 일치하지 않습니다.');
        return;
    }
    if (!terms) {
        showTermsError('이용약관에 동의해주세요.');
        return;
    }

    try {
        const response = await fetch('http://localhost:8080/api/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password, terms })
        });
        const data = await response.json();
        if (response.ok && data.success) {
            showAlert('회원가입 성공! 로그인 페이지로 이동합니다.', 'success', 'signup');
            setTimeout(() => {
                signinTab.click();
                signupForm.reset();
            }, 2000);
        } else {
            console.log('handleErrorResponse 호출됨', response.status, data);
            window.CustomExceptionHandlers.handleErrorResponse(response.status, data, 'signup');
        }
    } catch (error) {
        console.error('서버 오류:', error);
        window.CustomExceptionHandlers.handleErrorResponse(null, { message: '서버 오류: ' + error.message });
    }
});

/* ===============================
    소셜 로그인 팝업 메시지 수신 처리 (한 번만 등록)
=================================*/
window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin) return;

    const { token, user, error } = event.data;
    if (error) {
        window.CustomExceptionHandlers.handleErrorResponse(null, { message: error });
        return;
    }
    if (token) {
        localStorage.setItem('jwtToken', token);
        showAlert("로그인 완료!", 'success');
    }
    if (user) {
        localStorage.setItem('user', JSON.stringify(user));
        showAlert("사용자 정보 저장 완료", 'success');
    }
    const popup = window.open('', 'socialLogin');
    if (popup) popup.close();
    setTimeout(() => {
        window.location.href = '/home.html';
    }, 1000);
});

/* ===============================
    소셜 로그인 버튼 클릭 핸들러 (팝업 대신 현재 창 이동)
=================================*/
// Google 로그인 버튼
const googleLoginBtn = document.getElementById('googleLoginBtn');
if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', function() {
        window.location.href = 'http://localhost:8080/oauth2/authorization/google';
    });
}

// Kakao 로그인 버튼
const kakaoLoginBtn = document.getElementById('kakaoLoginBtn');
if (kakaoLoginBtn) {
    kakaoLoginBtn.addEventListener('click', function() {
        window.location.href = 'http://localhost:8080/oauth2/authorization/kakao';
    });
}

// Google 회원가입 버튼
const googleSignupBtn = document.getElementById('googleSignupBtn');
if (googleSignupBtn) {
    googleSignupBtn.addEventListener('click', function() {
        window.location.href = 'http://localhost:8080/oauth2/authorization/google';
    });
}

// Kakao 회원가입 버튼
const kakaoSignupBtn = document.getElementById('kakaoSignupBtn');
if (kakaoSignupBtn) {
    kakaoSignupBtn.addEventListener('click', function() {
        window.location.href = 'http://localhost:8080/oauth2/authorization/kakao';
    });
}

// ===============================
//   비밀번호 찾기 (이메일 인증) 모달 기능
// ===============================

// 모달 관련 요소 선택
const forgotLink = document.querySelector('.forgot-link');
const modal = document.getElementById('forgotPasswordModal');
const modalClose = document.querySelector('.modal-close');
const sendForgotBtn = document.getElementById('sendForgotBtn');
const forgotMessage = document.getElementById('forgotMessage');

// 1. "비밀번호를 잊으셨나요?" 클릭 시 모달 열기
if (forgotLink && modal) {
    forgotLink.addEventListener('click', function(e) {
        e.preventDefault();
        document.getElementById('forgotEmail').value = '';
        forgotMessage.textContent = '';
        forgotMessage.classList.remove('success-alert', 'error-alert');
        modal.style.display = 'flex';
    });
}

// 2. 닫기 버튼/모달 바깥 클릭 시 닫기
if (modalClose && modal) {
    modalClose.addEventListener('click', function() {
        modal.style.display = 'none';
    });
    window.addEventListener('click', function(e) {
        if (e.target === modal) modal.style.display = 'none';
    });
}

// 3. "메일 보내기" 버튼 클릭 시 API 호출
if (sendForgotBtn) {
    sendForgotBtn.addEventListener('click', function() {
        const email = document.getElementById('forgotEmail').value.trim();
        forgotMessage.textContent = '';
        forgotMessage.classList.remove('success-alert', 'error-alert');

        if (!email || !email.includes('@')) {
            forgotMessage.textContent = '이메일 주소를 올바르게 입력하세요.';
            forgotMessage.classList.add('error-alert');
            return;
        }

        fetch('http://localhost:8080/api/auth/forgotPassword', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                forgotMessage.textContent = '메일이 발송되었습니다. 메일함을 확인하세요.';
                forgotMessage.classList.remove('error-alert');
                forgotMessage.classList.add('success-alert');
            } else {
                forgotMessage.textContent = data.message || '발송 실패';
                forgotMessage.classList.remove('success-alert');
                forgotMessage.classList.add('error-alert');
            }
        })
        .catch(() => {
            forgotMessage.textContent = '서버 오류가 발생했습니다.';
            forgotMessage.classList.remove('success-alert');
            forgotMessage.classList.add('error-alert');
        });
    });
}
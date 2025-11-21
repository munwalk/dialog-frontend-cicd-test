/* ===============================
    로그인 & 회원가입 탭 변환
================================= */
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
================================= */
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
================================= */
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
================================= */
function showAlert(message, type, context) {
    let errorAlert, successAlert;

    if (context === 'signup') {
        errorAlert = document.getElementById('signupErrorAlert');
        successAlert = document.getElementById('signupSuccessAlert');
    } else {
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
================================= */
signinForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const email = document.getElementById('signin-email').value.trim();
    const password = document.getElementById('signin-password').value;

    // 아이디 기억하기 체크 여부 
    const rememberCheckbox = document.getElementById('remember');
    const rememberId = rememberCheckbox ? rememberCheckbox.checked : false;
    clearFieldErrors();

    if (!email || !password) {
        showAlert('이메일과 비밀번호를 모두 입력하세요.', 'error');
        return;
    }

    try {
        const response = await fetch('http://localhost:8080/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, rememberId }),
            credentials: 'include'
        });
        const data = await response.json();

        if (response.ok && data.success) {
            if (data.needJobSetup) {
                sessionStorage.setItem('showJobPersonaModal', 'true');
            }
            
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
    회원가입 폼 제출 처리
================================= */
signupForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    clearSignupFieldErrors();

    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirm = document.getElementById('signup-confirm').value;

    const termsAgree = document.getElementById('termsAgree');
    const privacyAgree = document.getElementById('privacyAgree');

    const isTermsChecked = termsAgree ? termsAgree.checked : false;
    const isPrivacyChecked = privacyAgree ? privacyAgree.checked : false;

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
    if (!isTermsChecked || !isPrivacyChecked) {
        showTermsError('이용약관 및 개인정보처리방침에 모두 동의해주세요.');
        return;
    }

    try {
        const response = await fetch('http://localhost:8080/api/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password, terms: true })
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
    약관 데이터 분리 (이용약관 / 개인정보처리방침)
================================= */

// 1. 이용약관 내용
const termsServiceHtml = `
    <h3>서비스 이용약관</h3>
    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">

    <h4>제 1 조 (목적)</h4>
    <p>이 약관은 DialoG (이하 '회사')이 제공하는 모든 온라인 서비스(이하 '서비스')의 이용과 관련하여 회사와 회원의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.</p>

    <h4>제 2 조 (용어의 정의)</h4>
    <p>
        1. '회원'이라 함은 본 약관에 동의하고 개인정보를 제공하여 이용계약을 체결한 자를 말합니다.<br>
        2. '서비스'라 함은 단말기(PC, 모바일 등)와 상관없이 회원이 이용할 수 있는 DialoG 및 관련 제반 서비스를 말합니다.
    </p>

    <h4>제 3 조 (약관의 게시 및 개정)</h4>
    <p>회사는 본 약관을 서비스 초기 화면에 게시하며, 관련 법령을 위배하지 않는 범위 내에서 약관을 개정할 수 있습니다. 개정 시 적용일자 7일 전부터 공지합니다.</p>

    <h4>제 4 조 (회원가입 및 탈퇴)</h4>
    <p>
        1. 이용 계약은 회원이 약관 내용에 동의하고 가입 신청을 함으로써 체결됩니다.<br>
        2. <b>본 서비스는 만 14세 이상만 이용 가능하며, 만 14세 미만 아동의 가입은 제한될 수 있습니다.</b><br>
        3. 회원은 언제든지 설정 메뉴 등을 통해 이용 계약 해지(탈퇴)를 신청할 수 있으며, 회사는 관련 법령이 정하는 바에 따라 이를 즉시 처리합니다.
    </p>

    <h4>제 5 조 (회원의 의무)</h4>
    <p>회원은 다음 행위를 하여서는 안 됩니다.</p>
    <ul>
        <li>신청 또는 변경 시 허위 내용의 등록</li>
        <li>타인의 정보 도용</li>
        <li>회사의 지적재산권 침해 또는 업무 방해 (해킹, 매크로 사용 등)</li>
        <li>기타 관련 법령에 위배되는 행위</li>
    </ul>

    <h4>제 6 조 (서비스 제공 및 변경)</h4>
    <p>
        회사는 연중무휴 1일 24시간 서비스 제공을 원칙으로 합니다.<br>
        단, 시스템 점검, 교체, 고장, 통신두절 등의 사유가 발생한 경우 서비스의 제공을 일시적으로 중단할 수 있습니다.
    </p>

    <h4>제 7 조 (면책조항)</h4>
    <p>
        1. 회사는 천재지변 또는 이에 준하는 불가항력으로 인하여 서비스를 제공할 수 없는 경우에는 서비스 제공에 관한 책임이 면제됩니다.<br>
        2. 회사는 회원의 귀책사유로 인한 서비스 이용의 장애에 대하여는 책임을 지지 않습니다.<br>
        3. 회사는 무료로 제공되는 서비스 이용과 관련하여 관련 법령에 특별한 규정이 없는 한 책임을 지지 않습니다.
    </p>

    <h4>제 8 조 (준거법 및 재판관할)</h4>
    <p>본 약관과 관련하여 발생한 분쟁에 대해서는 대한민국 법을 준거법으로 하며, 분쟁에 관한 소송은 서울중앙지방법원을 관할 법원으로 합니다.</p>
`;

// 2. 개인정보처리방침 내용
const privacyPolicyHtml = `
    <h3>개인정보처리방침</h3>
    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">

    <p>
        <b>1. 개인정보 수집 및 이용목적</b><br>
        회사는 회원 가입 의사 확인, 회원 식별/인증, 서비스 제공 및 유지·관리를 목적으로 개인정보를 처리합니다.
    </p>

    <p>
        <b>2. 수집하는 개인정보의 항목</b><br>
        - 필수항목: 아이디(이메일), 비밀번호, 이름, 닉네임<br>
        - 소셜 로그인 시: 해당 SNS(Google, Kakao 등)에서 제공하는 식별자 및 프로필 정보<br>
        - 자동수집항목: 서비스 이용기록, 접속 로그, 쿠키, 접속 IP 정보
    </p>

    <p>
        <b>3. 개인정보의 보유 및 이용기간</b><br>
        회사는 원칙적으로 개인정보 수집 및 이용목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다. 단, 다음의 정보는 아래의 이유로 명시한 기간 동안 보존합니다.<br>
        - 회원 탈퇴 시: 분쟁 해결 및 민원 처리를 위해 30일간 보관 후 파기<br>
        - 관계 법령 위반에 따른 수사·조사 등이 진행 중인 경우: 해당 종료 시까지
    </p>

    <p>
        <b>4. 개인정보의 파기절차 및 방법</b><br>
        전자적 파일 형태의 정보는 기록을 재생할 수 없는 기술적 방법을 사용하여 삭제합니다.
    </p>

    <p>
        <b>5. 개인정보의 제3자 제공</b><br>
        회사는 정보주체의 동의, 법률의 특별한 규정 등 관련 법령에 해당하는 경우를 제외하고는 개인정보를 제3자에게 제공하지 않습니다.
    </p>
    
    <p>
        <b>6. 이용자 및 법정대리인의 권리와 행사방법</b><br>
        이용자는 언제든지 자신의 개인정보를 조회하거나 수정할 수 있으며, 쿠키 저장을 거부할 수 있습니다.<br>
        (설정 방법 예시: 웹브라우저 상단의 도구 > 인터넷 옵션 > 개인정보)
    </p>

    <p>
        <b>7. 개인정보 보호책임자</b><br>
        - 이름: 개인정보 관리 담당자<br>
        - 연락처: DialoG@dialog.com
    </p>

    <p style="color: #888; font-size: 0.9em; margin-top: 20px;">
        기타 세부사항은 서비스 공지사항을 통해 추가로 고지합니다.
    </p>
`;

// DOM 요소 선택
const showTermsLink = document.getElementById('showTermsLink');
const closeTermsModal = document.getElementById('closeTermsModal');
const termsModal = document.getElementById('termsModal');
const termsContent = document.getElementById('termsContent');

// 이용약관 보기 버튼
const btnShowTerms = document.getElementById('btnShowTerms');
if (btnShowTerms && termsModal && termsContent) {
    btnShowTerms.addEventListener('click', function(e) {
        e.preventDefault(); // 라벨 클릭 방지
        termsContent.innerHTML = termsServiceHtml; // 이용약관 HTML 넣기
        termsModal.style.display = 'block';
    });
}

// 개인정보처리방침 보기 버튼
const btnShowPrivacy = document.getElementById('btnShowPrivacy');
if (btnShowPrivacy && termsModal && termsContent) {
    btnShowPrivacy.addEventListener('click', function(e) {
        e.preventDefault(); // 라벨 클릭 방지
        termsContent.innerHTML = privacyPolicyHtml; // 개인정보 HTML 넣기
        termsModal.style.display = 'block';
    });
}

/* ===============================
     공통 함수 정의 (모달 닫기 및 외부 클릭 닫기)
===============================*/
function addModalCloseHandlers(modalId, closeBtnSelector) {
    const modal = document.getElementById(modalId);
    const closeBtn = modal && modal.querySelector(closeBtnSelector);
    const modalContent = modal && modal.querySelector('.modal-content');
    if (modal) {
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }
        window.addEventListener('mousedown', (event) => {
            if (modal.style.display !== 'none' && !modalContent.contains(event.target)) {
                modal.style.display = 'none';
            }
        });
    }
}

addModalCloseHandlers('termsModal', '.modal-close');
addModalCloseHandlers('forgotPasswordModal', '.modal-close');

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

/* ===============================
    비밀번호 찾기 (이메일 인증) 모달 기능
================================= */
const forgotLink = document.querySelector('.forgot-link');
const modal = document.getElementById('forgotPasswordModal');
const modalClose = document.querySelector('.modal-close');
const sendForgotBtn = document.getElementById('sendForgotBtn');
const forgotSuccessAlert = document.getElementById('forgotSuccessAlert');
const forgotMessage = document.getElementById('forgotMessage');

if (forgotLink && modal) {
    forgotLink.addEventListener('click', function(e) {
        e.preventDefault();
        document.getElementById('forgotEmail').value = '';
        forgotMessage.textContent = '';
        forgotMessage.classList.remove('success-alert', 'error-alert');
        modal.style.display = 'flex';
    });
}

if (sendForgotBtn) {
    sendForgotBtn.addEventListener('click', function() {
        const email = document.getElementById('forgotEmail').value.trim();
        forgotSuccessAlert.style.display = 'none';
        forgotSuccessAlert.classList.remove('show');
        forgotMessage.classList.remove('show', 'error-alert');
        forgotSuccessAlert.textContent = '';
        forgotMessage.textContent = '';

        if (!email || !email.includes('@')) {
            forgotMessage.textContent = '이메일 주소를 올바르게 입력하세요.';
            forgotMessage.classList.add('show', 'error-alert');
            setTimeout(() => {
                forgotMessage.classList.remove('show');
                forgotMessage.textContent = '';
            }, 3000);
            return;
        }
        
        fetch('http://localhost:8080/api/auth/forgotPassword', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        })
        .then(res => res.json().then(data => ({status: res.status, body: data})))
        .then(({ status, body }) => {
            if (status === 200 && body.success) {
                forgotSuccessAlert.textContent = '메일이 발송되었습니다. 메일함을 확인하세요.';
                forgotSuccessAlert.style.display = 'block';
                forgotSuccessAlert.classList.add('show');
                setTimeout(() => {
                    forgotSuccessAlert.classList.remove('show');
                    forgotSuccessAlert.style.display = 'none';
                    forgotSuccessAlert.textContent = '';
                }, 3000);
            } else {
                window.CustomExceptionHandlers.handleErrorResponse(status, body, 'forgot');
            }
        })
        .catch(() => {
            window.CustomExceptionHandlers.handleErrorResponse(
                500, 
                { message: '서버 내부 오류가 발생했습니다.' },
                'forgot'
            );
        });
    });
}

/* ===============================
    쿠키 유틸리티 및 아이디 기억하기 초기화
================================= */
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

// 페이지 로드 시 저장된 이메일이 있는지 확인
document.addEventListener('DOMContentLoaded', function() {
    const savedEmail = getCookie('savedEmail');
    const emailInput = document.getElementById('signin-email');
    const rememberCheckbox = document.getElementById('remember');

    if (savedEmail && emailInput) {
        emailInput.value = decodeURIComponent(savedEmail); // 이메일 입력창 채우기
        if (rememberCheckbox) {
            rememberCheckbox.checked = true; // 체크박스 켜기
        }
    }
});
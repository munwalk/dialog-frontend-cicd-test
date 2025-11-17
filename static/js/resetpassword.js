function getTokenFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('token');
}

const resetPasswordForm = document.getElementById('resetPasswordForm');
const resetError = document.getElementById('resetError');
const resetSuccess = document.getElementById('resetSuccess');
const newPasswordErrorAlert = document.getElementById('newPasswordErrorAlert');
const confirmPasswordErrorAlert = document.getElementById('confirmPasswordErrorAlert');

// 필드별 에러 3초 후 사라짐
function showFieldError(element, message) {
    element.textContent = message;
    element.classList.add('show');
    setTimeout(() => {
        element.classList.remove('show');
        element.textContent = '';
    }, 3000);
}

// 전체 성공/에러 알림
function showAlert(message, type) {
    resetError.classList.remove('show');
    resetSuccess.classList.remove('show');
    if (type === 'error') {
        resetError.textContent = message;
        resetError.classList.add('show');
        setTimeout(() => {
            resetError.classList.remove('show');
            resetError.textContent = '';
        }, 3000);
    } else if (type === 'success') {
        resetSuccess.textContent = message;
        resetSuccess.classList.add('show');
    }
}

resetPasswordForm.addEventListener('submit', async function(e) {
    e.preventDefault();

    // 알림 초기화
    resetError.classList.remove('show'); resetError.textContent = '';
    resetSuccess.classList.remove('show'); resetSuccess.textContent = '';
    newPasswordErrorAlert.classList.remove('show'); newPasswordErrorAlert.textContent = '';
    confirmPasswordErrorAlert.classList.remove('show'); confirmPasswordErrorAlert.textContent = '';

    const token = getTokenFromUrl();
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (!newPassword) {
        showFieldError(newPasswordErrorAlert, "새 비밀번호를 입력하세요.");
        return;
    }
    if (!confirmPassword) {
        showFieldError(confirmPasswordErrorAlert, "비밀번호 확인을 입력하세요.");
        return;
    }
    if (newPassword !== confirmPassword) {
        showFieldError(confirmPasswordErrorAlert, "비밀번호가 일치하지 않습니다.");
        return;
    }
    if (newPassword.length < 12) {
        showFieldError(newPasswordErrorAlert, "비밀번호는 12자 이상 입력해주세요.");
        return;
    }

    try {
        const response = await fetch('http://localhost:8080/api/auth/resetPassword', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, newPassword })
        });
        const data = await response.json();
        if (response.ok && data.success) {
            showAlert("비밀번호가 성공적으로 변경되었습니다. 다시 로그인해주세요.", 'success');
            setTimeout(() => window.location.href = "/login.html", 2500);
        } else {
            showAlert(data.message || "비밀번호 변경에 실패했습니다.", 'error');
        }
    } catch (error) {
        showAlert("서버 오류: " + error.message, 'error');
    }
});

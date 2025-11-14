/* ===============================
   [통합] 홈 화면 전용 JS (home.js)
================================= */

document.addEventListener("DOMContentLoaded", () => {
    loadCommonComponents();
    initHomeData();
    loadRecentMeetings();
});

// =========================================
//  1. 공통 컴포넌트 로드
// =========================================
function loadCommonComponents() {
    fetch("components/chatbot.html")
        .then(res => res.text())
        .then(html => {
            const container = document.getElementById("chatbot-container");
            if (container) {
                container.innerHTML = html;
                initChatbotEventListeners();
                loadCurrentUser();
            }
        });

    fetch("components/sidebar.html")
        .then(res => res.text())
        .then(html => {
            const sidebar = document.getElementById("sidebar-container");
            if (sidebar) {
                sidebar.innerHTML = html;
                activateCurrentNav(sidebar);
                loadCurrentUser();
            }
        });
}

function initChatbotEventListeners() {
    const closeBtn = document.querySelector(".close-chat-btn");
    const sendBtn = document.querySelector(".send-btn");
    const chatInput = document.querySelector("#chatInput");
    const floatingBtn = document.getElementById("floatingChatBtn");

    if (window.closeChat && closeBtn) closeBtn.addEventListener("click", window.closeChat);
    if (window.sendMessage && sendBtn) sendBtn.addEventListener("click", window.sendMessage);
    if (window.handleChatEnter && chatInput) chatInput.addEventListener("keypress", window.handleChatEnter);
    if (window.openChat && floatingBtn) floatingBtn.addEventListener("click", window.openChat);
}

function activateCurrentNav(sidebar) {
    const currentPage = window.location.pathname.split("/").pop();
    sidebar.querySelectorAll(".nav-menu a").forEach(item => {
        item.classList.toggle("active", item.getAttribute("href") === currentPage);
    });
}

// =========================================
//  3. 홈 데이터 관리 (API 기반)
// =========================================
const API_BASE_URL = 'http://localhost:8080/api/calendar';
const today = new Date();

async function initHomeData() {
    console.log('🏠 홈 데이터 초기화 시작');
    displayCurrentDate();
    await fetchHomeData();
}

function displayCurrentDate() {
    const dateDisplay = document.getElementById('current-date-display');
    if (dateDisplay) {
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        dateDisplay.textContent = `${today.getMonth() + 1}월 ${today.getDate()}일 (${days[today.getDay()]})`;
    }
}

function formatDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// [핵심] 서버 데이터 요청 및 에러 처리
async function fetchHomeData() {
    const startDate = new Date(); startDate.setDate(today.getDate() - 30);
    const endDate = new Date(); endDate.setDate(today.getDate() + 30);
    const startStr = formatDate(startDate);
    const endStr = formatDate(endDate);

    try {
        console.log(`📡 API 데이터 요청: ${startStr} ~ ${endStr}`);
        const response = await fetch(`${API_BASE_URL}/events?startDate=${startStr}&endDate=${endStr}`, {
            method: 'GET', credentials: 'include', cache: 'no-store'
        });

        if (response.ok) {
            // 1. API 성공 시
           const data = await response.json();
           const events = data.map(event => {
                let type;
                if (event.eventType === 'MEETING') {
                    type = 'meeting';
                } else if (event.eventType === 'TASK' || event.eventType === 'PERSONAL') {
                    type = 'personal';
                } else {
                    type = 'other';
                }

                return {
                    ...event, // isCompleted: true가 여기에 포함됨
                    date: new Date(event.eventDate),
                    type: type,
                    important: event.isImportant,
                    completed: event.isCompleted // 덮어쓰지 않고 서버 값을 그대로 사용
                };
            });
            console.log(`✅ 데이터 수신 완료: ${events.length}건`);
            renderAllComponents(events);
        } else {
            // 2. API 실패 시 (401, 500 등)
            console.warn(`⚠️ API 오류 발생 (Status: ${response.status})`);            

            renderAllComponents([]); // <-- 빈 배열로 렌더링 호출
        }
    } catch (error) {
        // 3. 네트워크 오류 시
        console.error("❌ 네트워크 오류:", error);
        // 네트워크 오류 시에도 'Empty State'를 띄우도록 빈 배열로 렌더링
        renderAllComponents([]);
    }
}

// =========================================
// 4. Google 연동 배너 (Modal에서 Banner로 수정)
// =========================================
function showGoogleLinkModal() { // 함수 이름은 유지하되, 내용은 배너로 변경
    // 1. 기존 배너가 있으면 제거 (중복 방지)
    const existingBanner = document.getElementById('googleLinkBanner'); // ID 변경
    if (existingBanner) {
        existingBanner.remove();
    }

    // 2. 배너 HTML (상단 고정 배너 스타일)
    const bannerHtml = `
                <div id="googleLinkBanner" class="google-link-banner">
            <div class="banner-icon-text">
                <span class="banner-icon">⚠️</span>             <p>
                    <strong>Google 캘린더 연동 필요:</strong>
                    최신 일정을 불러오기 위해 Google 계정 연동을 갱신해주세요.
                </p>
            </div>
            <div class="banner-actions">
                <button onclick="startGoogleLink()" class="google-btn">
                    Google 계정으로 계속하기
                </button>
                                <button onclick="closeGoogleBanner()" class="banner-close-btn">×</button>
            </div>
        </div>
    `;
    
    // 3. body에 추가
    document.body.insertAdjacentHTML('beforeend', bannerHtml);

    // 4. 애니메이션 시작
    setTimeout(() => {
        const banner = document.getElementById('googleLinkBanner'); // ID 변경
        if (banner) {
            banner.classList.add('visible'); 
        }
    }, 10);
}

// 전역 함수: 배너 닫기 (이름 변경: closeGoogleBanner)
window.closeGoogleBanner = function() {
    const banner = document.getElementById('googleLinkBanner'); // ID 변경
    if (banner) {
        banner.classList.remove('visible'); // visible 클래스 제거
        
        // 애니메이션(0.2s)이 끝난 후 DOM에서 완전히 제거
        setTimeout(() => {
            banner.remove();
        }, 200); 
    }
};

// 전역 함수: 연동 시작 (이 함수는 수정할 필요 없음)
window.startGoogleLink = async function() {
    try {
        const res = await fetch('http://localhost:8080/api/calendar/link/start', {
             method: 'GET', credentials: 'include' 
        });
        if (res.ok) {
            const data = await res.json();
            window.location.href = data.authUrl;
        } else {
            alert("연동 시작 실패. 서버 상태를 확인해주세요.");
        }
    } catch (e) {
        console.error("연동 오류:", e);
        alert("연동 중 오류가 발생했습니다.");
    }
};

function openGoogleAuthModal() {
    // 1. 기존 모달이 있으면 제거 (중복 방지)
    const existingModal = document.getElementById('googleAuthModal');
    if (existingModal) {
        existingModal.remove();
    }

    // 2. 모달 HTML (home.css에 정의된 스타일 기반)
    const modalHtml = `
        <div id="googleAuthModal" class="modal-overlay">
            <div class="modal-container">
                <div class="modal-header">
                    <h3>Google 캘린더 연동 필요</h3>
                    <button onclick="closeGoogleAuthModal()" class="close-btn">×</button>
                </div>
                <div class="modal-body">
                    최신 일정을 불러오기 위해<br>
                    Google 계정 연동을 갱신해주세요.
                </div>
                <div class="modal-footer">
                    <button onclick="startGoogleLink()" class="google-btn">
                        Google 계정으로 계속하기
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // 3. body에 추가
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // 4. 애니메이션 시작 (home.css의 .modal-overlay.visible 스타일 사용)
    setTimeout(() => {
        const modal = document.getElementById('googleAuthModal');
        if (modal) {
            modal.classList.add('visible'); 
        }
    }, 10);
}

/**
 * Google 연동 모달을 닫습니다. (전역으로 등록)
 */
window.closeGoogleAuthModal = function() {
    const modal = document.getElementById('googleAuthModal');
    if (modal) {
        modal.classList.remove('visible');
        // (home.css의 .modal-overlay transition이 0.3s = 300ms 임)
        setTimeout(() => {
            modal.remove();
        }, 300); 
    }
};

// =========================================
//  5. UI 렌더링 함수들
// =========================================
function renderAllComponents(events) {
    renderTodoList(events);
    renderImportantMeetings(events);
    //renderRecentMeetings(events);
}

function renderTodoList(events) {
    const listEl = document.querySelector('.todo-list');
    if (!listEl) return;
    const todayStr = formatDate(today);
    const todos = events.filter(e => (e.eventType === 'TASK' || e.eventType === 'PERSONAL') && formatDate(e.date) === todayStr);

    if (todos.length === 0) {
            listEl.innerHTML = '<div class="empty-message" style="color: #9ca3af; text-align: center; padding: 24px 0;">오늘의 할일이 없습니다.</div>';
            return;
        }

    todos.forEach(todo => {
        const item = document.createElement('div');
        item.className = `todo-item ${todo.completed ? 'completed' : ''}`;
        item.innerHTML = `<input type="checkbox" class="todo-checkbox" id="todo-${todo.id}" ${todo.completed ? 'checked' : ''}><label for="todo-${todo.id}" class="todo-label">${todo.title}</label>`;
        item.querySelector('.todo-checkbox').addEventListener('change', async (e) => {
            
            // 1. e.target.checked 값 확인 (체크하면 true, 해제하면 false)
            console.log("체크박스 변경:", e.target.checked); // 👈 (디버깅 로그 추가)

            item.classList.toggle('completed', e.target.checked);

            // 2. 이 함수로 e.target.checked 값이 그대로 전달되어야 합니다.
            await updateTodoStatus(todo.id, e.target.checked);
        });
        listEl.appendChild(item);
    });
}

function renderImportantMeetings(events) { // 'events'는 필터링 전 원본 배열입니다.
    const listEl = document.querySelector('.deadline-list');
    if (!listEl) return;
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    // 1. 필터 로직 (이것은 올바르게 수정되었습니다)
    const meetings = events.filter(e => (e.important === true && e.type === 'meeting') && e.date >= todayOnly).sort((a, b) => a.date - b.date).slice(0, 3);

    // 2. "Google 연동" 버튼 HTML (API 실패 시 사용)
    const emptyStateHtml = `
        <div class="google-empty-state">
            <span class="empty-state-icon">📅</span>
            <p class="empty-state-text">
                Google 캘린더를 연동하고<br>
                중요한 회의 일정을 자동으로 불러오세요.
            </p>
            <button class="empty-state-button" onclick="openGoogleAuthModal()">
                + Google 계정 연동하기
            </button>
        </div>`;
    
    // 3. "중요 회의 없음" 메시지 (API는 성공했으나, 필터 결과가 0건일 때 사용)
    const noMeetingsHtml = `
        <div class="empty-message" style="color: #9ca3af; text-align: center; padding: 24px 0;">
            다가오는 중요한 회의가 없습니다.
        </div>
    `;

    // 4. [로직 수정]
    if (meetings.length > 0) {
        // 1. 보여줄 중요 회의가 있음
        listEl.innerHTML = '';
    } else if (events.length > 0) {
        // 2. API는 성공(events.length > 0)했지만, 필터된 중요 회의가 없음 (meetings.length === 0)
        listEl.innerHTML = noMeetingsHtml;
    } else {
        // 3. API가 실패/오류 (events.length === 0)
        listEl.innerHTML = emptyStateHtml;
    }

    // 5. 회의 목록 렌더링 (이 코드는 meetings.length > 0 일 때만 실행됨)
    meetings.forEach(m => {
        const diff = Math.ceil((m.date - todayOnly) / (1000 * 60 * 60 * 24));
        listEl.innerHTML += `<div class="deadline-item ${diff <= 3 ? 'urgent' : ''}"><div class="deadline-info"><div class="deadline-title">${m.title}</div><div class="deadline-meta"><span class="deadline-date">${m.date.getMonth() + 1}/${String(m.date.getDate()).padStart(2, '0')}</span><span class="deadline-badge ${diff <= 3 ? 'urgent' : ''}">${diff === 0 ? 'D-Day' : 'D-' + diff}</span></div></div></div>`;
    });
}
function loadRecentMeetings() {
    console.log('🔄 "최근 회의" 데이터 로드 시작...');

    // [수정] /api/calendar/events가 아닌 /api/meetings 호출
    fetch('http://localhost:8080/api/meetings', {
        method: 'GET',
        credentials: 'include' 
    })
    .then(response => {
        if (response.status === 401) throw new Error('인증 실패 (401)');
        if (!response.ok) throw new Error('최근 회의 API 호출 실패');
        return response.json();
    })
    .then(meetingList => { // DTO가 배열이라고 가정
        const processedEvents = meetingList.map(meeting => ({
            date: new Date(meeting.scheduledAt), // DTO 필드명 확인 필요
            title: meeting.title,
            type: 'meeting'
        }));

        renderRecentMeetings(processedEvents);
    })
    .catch(error => {
        console.error('최근 회의 로딩 중 오류:', error);
        renderRecentMeetings([]); 
    });
}

function renderRecentMeetings(events) {
    const listEl = document.querySelector('.meeting-list');
    if (!listEl) return;
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    // const meetings = events.filter(e => e.type === 'meeting' && e.date < todayOnly).sort((a, b) => b.date - a.date).slice(0, 3);
    const meetings = events.filter(e => e.type === 'meeting' && e.date < todayOnly).sort((a, b) => b.date - a.date).slice(0, 3);

    listEl.innerHTML = meetings.length ? '' : '<div class="empty-message" style="color: #9ca3af; text-align: center; padding: 24px 0;">최근 회의 기록이 없습니다</div>';
    meetings.forEach(m => {
        listEl.innerHTML += `<div class="meeting-item"><div class="meeting-info"><div class="meeting-title">${m.title}</div><div class="meeting-meta"><span class="meeting-date">${String(m.date.getMonth() + 1).padStart(2, '0')}/${String(m.date.getDate()).padStart(2, '0')}</span><span class="meeting-participants">회의</span></div></div></div>`;
    });
}


async function updateTodoStatus(todoId, isCompleted) {
    // 👇 (디버깅 로그 추가)
    console.log(`서버로 전송: ID=${todoId}, 완료상태=${isCompleted}`); 

    try { 
        await fetch(`${API_BASE_URL}/events/${todoId}/completion`, { 
            method: 'PATCH', 
            headers: { 'Content-Type': 'application/json' }, 
            credentials: 'include',
            body: JSON.stringify({ isCompleted: isCompleted }) // 👈 이 isCompleted가 true여야 합니다.
        }); 
    } catch (e) { 
        console.error(e); 
    }
}
// 기타 리스너
//document.addEventListener('visibilitychange', () => { if (!document.hidden) fetchHomeData(); });
function goToMeetings() { window.location.href = 'meetings.html'; }
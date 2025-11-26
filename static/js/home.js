/* ===============================
   [통합] 홈 화면 전용 JS (home.js)
================================= */

document.addEventListener("DOMContentLoaded", async () => {
    await initializeChatbot();
    
    // 1. 공통 컴포넌트 로드 (사이드바, 챗봇 등)
    // await을 써서 컴포넌트 로드가 끝날 때까지 기다립니다. (loadCommonComponents 수정 필요)
    await loadCommonComponents(); 

    // 2. 사용자 정보 확인 (로그인 상태 체크)
    // app.js에 있는 loadCurrentUser가 완료된 후 데이터를 불러옵니다.
    if (typeof loadCurrentUser === 'function') {
        const user = await loadCurrentUser(); 
        if (!user) return; // 로그인이 안 되어 있으면 중단 (loadCurrentUser 내부에서 리다이렉트 처리됨)
    }

    // 3. 데이터 로드 (이제 안전하게 호출 가능)
    initHomeData();
    loadRecentMeetings();
    checkAndShowJobModal();
});

// loadCommonComponents를 async로 변경하고 Promise를 반환하도록 수정
async function loadCommonComponents() {
    const promises = [];

    // 사이드바 로드
    const sidebarPromise = fetch("components/sidebar.html")
        .then(res => res.text())
        .then(html => {
            const sidebar = document.getElementById("sidebar-container");
            if (sidebar) {
                sidebar.innerHTML = html;
                activateCurrentNav(sidebar);
            }
        });
    promises.push(sidebarPromise);

    // 모든 로드가 끝날 때까지 기다림
    await Promise.all(promises);
}

function activateCurrentNav(sidebar) {
    const currentPage = window.location.pathname.split("/").pop();
    sidebar.querySelectorAll(".nav-menu a").forEach(item => {
        const href = item.getAttribute("href");
        // home.html 인 경우 / 또는 home.html 모두 활성화
        if (href === currentPage || (currentPage === "" && href === "home.html")) {
            item.classList.add("active");
        } else {
            item.classList.remove("active");
        }
    });
}

// =========================================
//  2. 홈 데이터 초기화 및 API 설정
// =========================================
const CALENDAR_API_BASE = 'http://localhost:8080/api/calendar';
const HOME_API_BASE = 'http://localhost:8080/api/home'; // [신규] 통계용 API
const today = new Date();

async function initHomeData() {
    console.log('홈 데이터 초기화 시작');
    displayCurrentDate();
    
    // 병렬로 호출하여 로딩 속도 최적화 가능하지만, 순차 호출로 안정성 확보
    await fetchHomeData(); // 상단 3개 카드 (캘린더/Todo)
    await loadHomeStats(); // 하단 4개 통계 카드
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

// =========================================
//  3. 상단 카드 데이터 (일정, Todo) 로드
// =========================================
async function fetchHomeData() {
    const startDate = new Date(); startDate.setDate(today.getDate() - 30);
    const endDate = new Date(); endDate.setDate(today.getDate() + 30);
    const startStr = formatDate(startDate);
    const endStr = formatDate(endDate);

    try {
        console.log(`일정/할일 데이터 요청: ${startStr} ~ ${endStr}`);

        const response = await fetch(`${CALENDAR_API_BASE}/events?startDate=${startStr}&endDate=${endStr}`, {
            method: 'GET', credentials: 'include', cache: 'no-store'
        });

        if (response.ok) {
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
                    ...event, 
                    date: new Date(event.eventDate + 'T00:00:00'),
                    type: type,
                    important: event.isImportant,
                    completed: event.isCompleted
                };
            });
            console.log(`일정/할일 수신 완료: ${events.length}건`);
            renderAllComponents(events);
        } else {
            console.warn(`API 오류 발생 (Status: ${response.status})`);
            renderAllComponents([]);
        }
    } catch (error) {
        console.error("네트워크 오류:", error);
        renderAllComponents([]);
    }
}

// =========================================
//  4. 하단 통계 데이터 로드
// =========================================
async function loadHomeStats() {
    console.log('통계 데이터 로드 시작...');
    try {
        const response = await fetch(`${HOME_API_BASE}/stats`, {
            method: 'GET',
            credentials: 'include', // 쿠키 인증 포함
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
            const data = await response.json();
            console.log('✅ 통계 데이터 수신 완료:', data);
            
            // 1. 이번 달 회의
            updateStatCard('stat-meeting-count', data.thisMonthMeetingCount + '건', 'stat-meeting-diff', data.meetingCountDiff);
            
            // 2. 총 참여 시간
            updateStatCard('stat-total-time', data.totalMeetingTime, 'stat-time-diff', data.meetingHoursDiff);
            
            // 3. 미결 액션아이템
            updateStatCard('stat-action-items', data.openActionItems + '개', 'stat-action-diff', data.actionItemsDiff);
            
            // 4. 종료된 회의 (확정된 주요결정사항)
            updateStatCard('stat-decisions', data.confirmedMeetings + '건', 'stat-decision-diff', data.meetingsDiff);

        } else {
            console.warn(`통계 API 오류 (Status: ${response.status})`);
        }
    } catch (error) {
        console.error("통계 API 네트워크 오류:", error);
    }
}

// 통계 카드 업데이트 헬퍼 함수
function updateStatCard(valueId, valueText, diffId, diffText) {
    const valueEl = document.getElementById(valueId);
    const diffEl = document.getElementById(diffId);

    if (valueEl) valueEl.textContent = valueText;
    if (diffEl) {
        diffEl.textContent = diffText;
        // 증감률 색상 처리 ('-' 포함 시 빨강, 아니면 보라)
        if (diffText && diffText.includes('-')) {
            diffEl.style.color = '#ef4444'; 
        } else {
            diffEl.style.color = '#8E44AD'; 
        }
    }
}

// =========================================
//  5. 최근 회의 데이터 로드 (별도 API 사용 시)
// =========================================
function loadRecentMeetings() {
    console.log('🔄 "최근 회의" 데이터 로드 시작...');

    const endDate = new Date(today);
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 60); // 60일 전

    const startStr = formatDate(startDate);
    const endStr = formatDate(endDate);
    
    fetch(`${CALENDAR_API_BASE}/events?startDate=${startStr}&endDate=${endStr}`, {
        method: 'GET',
        credentials: 'include' 
    })
    .then(response => {
        if (response.status === 401) throw new Error('인증 실패 (401)');
        if (!response.ok) throw new Error('최근 회의 API 호출 실패');
        return response.json();
    })
    .then(allEventsList => {    
        const meetingsOnly = allEventsList.filter(e => e.eventType === 'MEETING');
        
        const processedEvents = meetingsOnly.map(meeting => ({
            date: new Date(meeting.eventDate + 'T' + (meeting.time || '00:00:00')), 
            title: meeting.title,
            type: 'meeting',
            eventDateStr: meeting.eventDate
        }));

        renderRecentMeetings(processedEvents);
    })
    .catch(error => {
        console.error('최근 회의 로딩 중 오류:', error);
        renderRecentMeetings([]); 
    });
}

// =========================================
//  6. UI 렌더링 (To-Do, 중요 회의, 최근 회의)
// =========================================
function renderAllComponents(events) {
    renderTodoList(events);
    renderImportantMeetings(events);
}

function renderTodoList(events) {
    const listEl = document.querySelector('.todo-list');
    if (!listEl) return;
    const todayStr = formatDate(today);
    
    // 오늘 날짜의 TASK 또는 PERSONAL 이벤트 필터링
    const todos = events.filter(e => (e.eventType === 'TASK' || e.eventType === 'PERSONAL') && formatDate(e.date) === todayStr);

    if (todos.length === 0) {
        listEl.innerHTML = '<div class="empty-message" style="color: #9ca3af; text-align: center; padding: 24px 0;">오늘의 할일이 없습니다.</div>';
        return;
    }

    listEl.innerHTML = ''; // 초기화
    todos.forEach(todo => {
        const item = document.createElement('div');
        item.className = `todo-item ${todo.completed ? 'completed' : ''}`;
        item.innerHTML = `
            <input type="checkbox" class="todo-checkbox" id="todo-${todo.id}" ${todo.completed ? 'checked' : ''}>
            <label for="todo-${todo.id}" class="todo-label">${todo.title}</label>
        `;
        
        // 체크박스 이벤트
        item.querySelector('.todo-checkbox').addEventListener('change', async (e) => {
            console.log("체크박스 변경:", e.target.checked); 
            item.classList.toggle('completed', e.target.checked);
            await updateTodoStatus(todo.id, e.target.checked);
        });
        listEl.appendChild(item);
    });
}

function renderImportantMeetings(events) { 
    const listEl = document.querySelector('.deadline-list');
    if (!listEl) return;
    
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    // 필터: 중요(별) + 회의(meeting) + 오늘 이후
    const meetings = events.filter(e => (e.important === true && e.type === 'meeting') && e.date >= todayOnly)
                           .sort((a, b) => a.date - b.date)
                           .slice(0, 3);

    const emptyStateHtml = `
    <div class="google-empty-state" style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%; padding: 20px;">       
        <p class="empty-state-text" style="font-size: 14px; color: #6b7280; line-height: 1.6; margin-bottom: 24px; text-align: center;">
            Google 캘린더를 연동하고<br>중요한 회의 일정을 자동으로 불러오세요.
        </p>
        <button class="empty-state-button" style="height: 34px; padding: 0 14px; font-size: 15px; font-weight: 600; display: flex; align-items: center; border-radius: 8px; background: #8E44AD; color: #fff; border: none; cursor: pointer;" onclick="openGoogleAuthModal()">
            + Google 계정 연동하기
        </button>
    </div>`;

    const noMeetingsHtml = `
        <div class="empty-message" style="color: #9ca3af; text-align: center; padding: 24px 0;">
            다가오는 중요한 회의가 없습니다.
        </div>
    `;

    if (meetings.length > 0) {
        listEl.innerHTML = '';
        meetings.forEach(m => {
            const diff = Math.ceil((m.date - todayOnly) / (1000 * 60 * 60 * 24));
            const dateStr = formatDate(m.date); 
            
            listEl.innerHTML += `
                <div class="deadline-item ${diff <= 3 ? 'urgent' : ''}" 
                     onclick="goToCalendarWithDate('${dateStr}')" 
                     style="cursor: pointer;"
                     title="클릭하여 캘린더에서 보기">
                    <div class="deadline-info">
                        <div class="deadline-title">${m.title}</div>
                        <div class="deadline-meta">
                            <span class="deadline-date">${m.date.getMonth() + 1}/${String(m.date.getDate()).padStart(2, '0')}</span>
                            <span class="deadline-badge ${diff <= 3 ? 'urgent' : ''}">${diff === 0 ? 'D-Day' : 'D-' + diff}</span>
                        </div>
                    </div>
                </div>`;
        });
    } else if (events.length > 0) {
        // 데이터는 있으나 중요 회의가 없음
        listEl.innerHTML = noMeetingsHtml;
    } else {
        // 데이터 로드 실패 또는 데이터 0건 (연동 필요 상태로 가정)
        listEl.innerHTML = emptyStateHtml;
    }
}

function renderRecentMeetings(events) {
    const listEl = document.querySelector('.meeting-list');
    if (!listEl) return;
    
    // 오늘을 포함하여 과거의 회의만 표시
    const tomorrowOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    
    const meetings = events.filter(e => e.type === 'meeting' && e.date < tomorrowOnly)
        .sort((a, b) => b.date - a.date) // 최신순 정렬
        .slice(0, 3); // 상위 3개

    listEl.innerHTML = meetings.length ? '' : '<div class="empty-message" style="color: #9ca3af; text-align: center; padding: 24px 0;">최근 회의 기록이 없습니다</div>';
    
    meetings.forEach(m => {
        listEl.innerHTML += `
            <div class="meeting-item">
                <div class="meeting-info">
                    <div class="meeting-title" 
                         onclick="goToCalendarWithDate('${m.eventDateStr}')"
                         style="cursor: pointer;"
                         title="캘린더에서 이 날짜 보기">
                        ${m.title}
                    </div>
                    <div class="meeting-meta">
                        <span class="meeting-date">${String(m.date.getMonth() + 1).padStart(2, '0')}/${String(m.date.getDate()).padStart(2, '0')}</span>
                        <span class="meeting-participants">회의</span>
                    </div>
                </div>
            </div>`;
    });
}

// =========================================
//  7. 액션 및 헬퍼 함수들
// =========================================

// To-Do 완료 상태 업데이트
async function updateTodoStatus(todoId, isCompleted) {   
    console.log(`서버로 전송: ID=${todoId}, 완료상태=${isCompleted}`); 
    try {
        await fetch(`${CALENDAR_API_BASE}/events/${todoId}/completion`, { 
            method: 'PATCH', 
            headers: { 'Content-Type': 'application/json' }, 
            credentials: 'include',
            body: JSON.stringify({ isCompleted: isCompleted })
        }); 
    } catch (e) { 
        console.error(e); 
    }
}

// 페이지 이동 헬퍼
function goToMeetings() { window.location.href = 'meetings.html'; }
function goToAdminDashboard() { window.location.href = 'dashboard.html'; }
function goToCalendarWithDate(dateStr) { window.location.href = `calendar.html?date=${dateStr}`; }

// =========================================
//  8. Google 연동 모달 및 배너 로직
// =========================================

// (1) 배너 표시 함수 (자동 감지 시)
function showGoogleLinkModal() { 
    const existingBanner = document.getElementById('googleLinkBanner');
    if (existingBanner) existingBanner.remove();

    const bannerHtml = `
        <div id="googleLinkBanner" class="google-link-banner">
            <div class="banner-icon-text">
                <span class="banner-icon">⚠️</span>
                <p>
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
    document.body.insertAdjacentHTML('beforeend', bannerHtml);
    setTimeout(() => {
        const banner = document.getElementById('googleLinkBanner');
        if (banner) banner.classList.add('visible'); 
    }, 10);
}

window.closeGoogleBanner = function() {
    const banner = document.getElementById('googleLinkBanner');
    if (banner) {
        banner.classList.remove('visible');
        setTimeout(() => banner.remove(), 200); 
    }
};

// (2) 모달 표시 함수 (버튼 클릭 시)
window.openGoogleAuthModal = function() {
    const existingModal = document.getElementById('googleAuthModal');
    if (existingModal) existingModal.remove();

    const modalHtml = `
        <div id="googleAuthModal" class="modal-overlay">
            <div class="modal-container">
                <div class="modal-header">
                    <h3>Google 캘린더 연동 필요</h3>
                    <button onclick="closeGoogleAuthModal()" class="close-btn">×</button>
                </div>
                <div class="modal-body" style="text-align:center; padding:20px;">
                    <p style="color:#666; margin-bottom:20px;">
                        최신 일정을 불러오기 위해<br>Google 계정 연동을 갱신해주세요.
                    </p>
                </div>
                <div class="modal-footer">
                    <button onclick="startGoogleLink()" class="google-btn" style="width:100%; justify-content:center;">
                        Google 계정으로 계속하기
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    setTimeout(() => {
        const modal = document.getElementById('googleAuthModal');
        if (modal) modal.classList.add('visible'); 
    }, 10);
}

window.closeGoogleAuthModal = function() {
    const modal = document.getElementById('googleAuthModal');
    if (modal) {
        modal.classList.remove('visible');
        setTimeout(() => modal.remove(), 300); 
    }
};

// (3) 연동 시작 (공통)
window.startGoogleLink = async function() {
    try {
        const res = await fetch(`${CALENDAR_API_BASE}/link/start`, {
             method: 'GET', credentials: 'include' 
        });
        if (res.ok) {
            const data = await res.json();
            window.location.href = data.authUrl;
        } else {
            alert("연동 시작에 실패했습니다. 서버 상태를 확인해주세요.");
        }
    } catch (e) {
        console.error("연동 오류:", e);
        alert("연동 중 오류가 발생했습니다.");
    }
};

// =========================================
//  9. 직무 설정 유도 모달
// =========================================
function checkAndShowJobModal() {
    // 1. 소셜 로그인 리다이렉트 감지
    const urlParams = new URLSearchParams(window.location.search);
    const socialNeedSetup = urlParams.get('needJobSetup');

    if (socialNeedSetup === 'true') {
        sessionStorage.setItem('showJobPersonaModal', 'true');
        const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({path: cleanUrl}, '', cleanUrl);
    }

    // 2. 노출 조건 확인
    const shouldShow = sessionStorage.getItem('showJobPersonaModal');
    const hideForever = localStorage.getItem('hideJobGuideForever');

    if (shouldShow === 'true' && !hideForever) {
        const modal = document.getElementById('jobPersonaModal');
        if (modal) {
            modal.style.display = 'flex'; 
        }
        sessionStorage.removeItem('showJobPersonaModal');
    }
}

window.closeJobModal = function(neverShowAgain) {
    const modal = document.getElementById('jobPersonaModal');
    if (modal) {
        modal.style.display = 'none';
    }
    if (neverShowAgain) {
        localStorage.setItem('hideJobGuideForever', 'true');
    }
};
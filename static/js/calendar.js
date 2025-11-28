/* ===============================================
1. 전역 상태 및 API 설정 (병합됨)
=================================================*/
let currentUser = null;         // (API) 로그인한 사용자 정보
let calendarEvents = [];      // (API) 백엔드에서 불러온 이벤트 원본 배열
let currentYearMonth;         // (API) 현재 캘린더가 표시하는 년/월 (Date 객체)
let selectedDate;             // (API) YYYY-MM-DD 형식의 문자열
let starListenerAttached = false; // 별표 이벤트 리스너 중복 방지

// API URL
const CALENDAR_BASE_URL = `${BACKEND_BASE_URL}/api/calendar`;

// (참고) LocalStorage 키는 이 파일에서 사용되지 않습니다.
const STORAGE_KEY = 'calendar_events';
const TODO_STORAGE_KEY = 'calendar_todos';


/* ===============================================
2. To-do CRUD (API 버전)
=================================================*/

async function addDailyTodo() {
    const todoInput = document.getElementById('todoInput'); 
    
    if (!selectedDate) {
        showAlert("먼저 캘린더에서 날짜를 선택해주세요.", 'error');
        return;
    }
    if (!todoInput || !todoInput.value.trim()) {
        showAlert("할 일을 입력해주세요.", 'error');
        return;
    }
    
    const todoTitle = todoInput.value.trim();
    const targetDate = selectedDate; // YYYY-MM-DD
    const TODO_CREATE_URL = `${BACKEND_BASE_URL}/api/calendar/events`;

    try {
        console.log(`🔄 To-do 생성 요청: ${todoTitle} (마감일: ${targetDate})`);
        
        const response = await fetch(TODO_CREATE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ 
                calendarId: "primary", 
                eventData: {
                    summary: todoTitle, 
                    start: { date: targetDate },
                    end: { date: targetDate }
                }
            })
        });

        if (response.ok) {
            // 서버에서 생성된 데이터를 받아옵니다 (ID 등 필요)
            const newEventData = await response.json();

            // 로컬 상태(calendarEvents)에 즉시 추가할 객체 생성
            // 서버 응답(GoogleEventResponseDTO)과 프론트엔드 모델을 맞춥니다.
            const newLocalEvent = {
                id: newEventData.id,            // 구글 ID 또는 DB ID
                googleEventId: newEventData.id, // 삭제/수정을 위해 ID 매핑
                title: todoTitle,
                eventDate: targetDate,
                eventType: 'TASK',              // To-do는 TASK 타입
                isCompleted: false,
                isImportant: false
            };

            // 전역 배열에 추가
            calendarEvents.push(newLocalEvent);

            // UI 부분 갱신 (전체 렌더링 X -> 필요한 부분만 O)
            // 1. 달력 그리드에 점(Dot) 다시 그리기
            displayEventDots(calendarEvents); 
            
            // 2. 우측 To-do 리스트 갱신
            renderTodoList(targetDate);

            // 3. 만약 날짜 오버레이가 켜져 있다면, 거기도 갱신
            const dailyOverlay = document.getElementById('dailyEventsList');
            if (dailyOverlay && !dailyOverlay.classList.contains('hidden')) {
                if (typeof showDailyEventOverlay === 'function') {
                    showDailyEventOverlay(targetDate);
                }
            }

            showAlert('할 일이 추가되었습니다'); 
            todoInput.value = ''; 

        } else {
            const errorText = await response.text();
            console.error(` To-do 생성 실패 (${response.status}):`, errorText);
            showAlert(`To-do 생성 실패: ${errorText}`, 'error');
        }
    } catch (error) {
        console.error(' To-do 생성 중 네트워크 오류:', error);
        showAlert('네트워크 오류 또는 JSON 처리 오류가 발생했습니다.', 'error');
    }
}

/* 2. 할 일 수정 모달 (오버레이 잠시 숨김 로직 적용) */
async function editApiTodo(eventId, currentTitle, eventDate) {
    // 1. 일정 오버레이가 열려있다면 잠시 숨김
    const dailyOverlay = document.getElementById('dailyEventsList');
    const isOverlayOpen = dailyOverlay && !dailyOverlay.classList.contains('hidden');
    
    if (isOverlayOpen) {
        dailyOverlay.classList.add('hidden'); // 시야에서 제거
    }

    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay'; 
    modalOverlay.id = 'editTodoModal';
    
    // Z-Index 및 포지션 강제 설정
    modalOverlay.style.zIndex = "2147483647"; 
    modalOverlay.style.position = "fixed";

    const modalContent = document.createElement('div');    
    modalContent.className = 'modal-container'; 

    modalContent.innerHTML = `
        <div class="modal-header">
            <h3>할 일 수정</h3>
            <button class="close-btn">x</button> 
        </div>
        <div class="modal-body">
            <label style="font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 4px;">할 일 내용</label>
            <input type="text" id="editTodoInput" class="edit-modal-input" value="${currentTitle}" autocomplete="off">
        </div>
        <div class="modal-footer">
            <button class="edit-modal-btn cancel">취소</button>
            <button class="edit-modal-btn confirm">수정 완료</button>
        </div>
    `;

    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);
    
    // DOM에 추가된 후 변수를 여기서 확실하게 선언합니다.
    const editInput = document.getElementById('editTodoInput');

    // 포커스 및 애니메이션
    setTimeout(() => {
        if(editInput) { editInput.focus(); editInput.select(); }
        modalOverlay.classList.add('visible');
    }, 10);

    // 닫기 함수
    const closeModal = () => {
        modalOverlay.classList.remove('visible');
        setTimeout(() => {
            if (document.body.contains(modalOverlay)) {
                document.body.removeChild(modalOverlay);
            }
            // 닫을 때 숨겼던 오버레이 복구
            if (isOverlayOpen) {
                dailyOverlay.classList.remove('hidden');
            }
        }, 300);
    };

    // 저장 로직
    modalContent.querySelector('.confirm').addEventListener('click', async () => {
        // 여기서도 위에서 선언한 editInput 변수를 사용
        const newTitle = editInput.value;
        
        if (!newTitle || !newTitle.trim() || newTitle === currentTitle) {
            closeModal();
            return; 
        }
        
        const EDIT_URL = `${CALENDAR_BASE_URL}/events/${eventId}`; 
        const bodyData = {
            calendarId: "primary",
            eventData: { summary: newTitle.trim(), start: { date: eventDate }, end: { date: eventDate } }
        };

        try {
            const response = await fetch(EDIT_URL, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(bodyData)
            });

            if (response.ok) {
                if (typeof showSuccessMessage === 'function') showSuccessMessage('할 일이 수정되었습니다');
                
                // 메모리 갱신
                const ev = calendarEvents.find(e => String(e.id)===String(eventId) || String(e.googleEventId)===String(eventId));
                if(ev) ev.title = newTitle.trim();

                // 화면 갱신
                if (typeof renderCalendar === 'function') await renderCalendar(); 
                if(selectedDate && typeof showDailyEventOverlay === 'function') showDailyEventOverlay(selectedDate);
                
                // 모달 닫기 (이때는 오버레이 복구 로직을 타지 않게 하기 위해 직접 DOM 제거하거나 플래그 처리 가능하지만, 
                // showDailyEventOverlay가 다시 오버레이를 켜주므로 closeModal 호출해도 무방하거나 더 자연스러움)
                
                // 여기서는 showDailyEventOverlay가 켜지므로, closeModal 호출 시 '숨김 복구'가 겹치지 않게
                // 모달만 조용히 제거합니다.
                modalOverlay.classList.remove('visible');
                setTimeout(() => { 
                    if(document.body.contains(modalOverlay)) document.body.removeChild(modalOverlay); 
                }, 300);

            } else {
                console.error(await response.text());
                closeModal(); // 실패 시 원래대로 복구
            }
        } catch (error) {
            console.error(error);
            closeModal();
        }
    });

    modalContent.querySelector('.cancel').addEventListener('click', closeModal);
    modalContent.querySelector('.close-btn').addEventListener('click', closeModal);
    
    // 배경 클릭 닫기
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });
    
    // 엔터키 입력 시 저장 (이제 editInput 변수가 정의되어 있어 에러 안 남)
    if (editInput) {
        editInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                modalContent.querySelector('.confirm').click();
            }
        });
    }
}

/* 3. 커스텀 삭제 모달 (오버레이 잠시 숨김 로직 적용) */
function openDeleteConfirmModal(title, onConfirm) {
    // 1. 일정 오버레이가 열려있다면 잠시 숨김
    const dailyOverlay = document.getElementById('dailyEventsList');
    const isOverlayOpen = dailyOverlay && !dailyOverlay.classList.contains('hidden');
    
    if (isOverlayOpen) {
        dailyOverlay.classList.add('hidden');
    }

    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';
    modalOverlay.style.zIndex = "2147483647";
    modalOverlay.style.position = "fixed";

    const modalContent = document.createElement('div');
    modalContent.className = 'modal-container';
    
    modalContent.innerHTML = `
        <div class="modal-header">
            <h3 style="color: #ef4444;">삭제 확인</h3>
            <button class="close-btn">×</button>
        </div>
        <div class="modal-body">
            <p style="color: #374151; line-height: 1.5;">
                "${title}" 항목을 정말 삭제하시겠습니까?<br>
                <span style="font-size: 13px; color: #6b7280;">삭제된 데이터는 복구할 수 없습니다.</span>
            </p>
        </div>
        <div class="modal-footer">
            <button class="edit-modal-btn cancel">취소</button>
            <button class="edit-modal-btn confirm" style="background-color: #ef4444; border-color: #ef4444; color: white;">삭제하기</button>
        </div>
    `;

    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);

    setTimeout(() => modalOverlay.classList.add('visible'), 10);

    const closeModal = () => {
        modalOverlay.classList.remove('visible');
        setTimeout(() => { 
            if (document.body.contains(modalOverlay)) document.body.removeChild(modalOverlay);
            // 취소 시 오버레이 복구
            if (isOverlayOpen) dailyOverlay.classList.remove('hidden');
        }, 300);
    };

    modalContent.querySelector('.confirm').addEventListener('click', () => {
        // 확인 시: 모달만 닫고(DOM제거), 콜백 함수 실행
        // 콜백 함수(deleteApiTodo 내부)에서 데이터 갱신 후 오버레이를 다시 켜줄 것임
        modalOverlay.classList.remove('visible');
        setTimeout(() => { if (document.body.contains(modalOverlay)) document.body.removeChild(modalOverlay); }, 300);
        onConfirm();
    });
    
    modalContent.querySelector('.cancel').addEventListener('click', closeModal);
    modalContent.querySelector('.close-btn').addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });
}

/* 4. 할 일 삭제 함수 (커스텀 모달 연결) */
function deleteApiTodo(eventId, title) {
    // 기존 showConfirm 대신 openDeleteConfirmModal 사용
    openDeleteConfirmModal(title, async () => {
        const DELETE_URL = `${CALENDAR_BASE_URL}/events/${eventId}`;

        try {
            const response = await fetch(DELETE_URL, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (response.ok) {
                if (typeof showSuccessMessage === 'function') showSuccessMessage('할 일이 삭제되었습니다');
                
                // 메모리 삭제
                calendarEvents = calendarEvents.filter(e => String(e.id) !== String(eventId) && String(e.googleEventId) !== String(eventId));

                // 데이터 갱신
                if (typeof renderCalendar === 'function') await renderCalendar(); 
                if(selectedDate && typeof showDailyEventOverlay === 'function') showDailyEventOverlay(selectedDate);
            } else {
                console.error("삭제 실패", await response.text());
            }
        } catch (error) {
            console.error('삭제 오류', error);
        }
    });
}

/* ===============================================
4. Google 연동 팝업 (API 기반)
=================================================*/
function showGoogleLinkButton() {
    const modal = document.getElementById('googleLinkModal');
    const linkButton = document.getElementById('conn-google-btn');
    const closeButton = document.getElementById('closeModalBtn');

    if (!modal || !linkButton || !closeButton) {
        console.error("❌ Google 연동 모달 UI 요소를 찾을 수 없습니다.");
        return;
    }

    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('visible'), 10); 

    closeButton.addEventListener('click', () => {
        modal.classList.remove('visible');
        setTimeout(() => modal.style.display = 'none', 200); 
    });

    if (!linkButton.dataset.listenerAdded) {
        linkButton.addEventListener('click', async () => {
            try {
                console.log('🔄 Google 연동 시작 API 호출...');
                const response = await fetch(`${BACKEND_BASE_URL}/api/calendar/link/start`, { 
                    method: 'GET',
                    credentials: 'include'
                });
                
                if (response.ok) {
                    const data = await response.json();
                    window.location.href = data.authUrl; 
                } else {
                    showAlert("연동 시작에 실패했습니다. 다시 로그인해주세요.", 'error');
                }
            } catch (error) {
                console.error("Google 연동 시작 오류:", error);
                showAlert("연동 중 오류가 발생했습니다.", 'error');
            }
        });
        linkButton.dataset.listenerAdded = 'true';
    }
}

function formatDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// "YYYY-MM-DD" -> "12월 4일 (목)" (날짜 버그 수정)
function formatDisplayDate(dateString) {
    const parts = dateString.split('-').map(Number);
    const year = parts[0];
    const monthIndex = parts[1] - 1; 
    const day = parts[2];
    const dateObj = new Date(year, monthIndex, day);
    return dateObj.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
}

// API 데이터를 기반으로 특정 날짜의 이벤트 필터링
function getEventsForDate(dateString) { // "YYYY-MM-DD"
    return calendarEvents.filter(event => event.eventDate === dateString);
}

/* 5. 사이드바 회의 목록 - "더 보기" 기능 추가 */
function renderMeetingList(dateStr) {
    const list = document.getElementById('meetingList');
    const title = document.getElementById('meetingCardTitleContent');
    const count = document.getElementById('meetingCount');
    if (!list) return;

    title.textContent = `${formatDisplayDate(dateStr).split('(')[0].trim()}의 회의`;
    const events = getEventsForDate(dateStr).filter(e => e.eventType === 'MEETING');
    count.textContent = `(총 ${events.length}개)`;
    list.innerHTML = '';

    if (events.length === 0) {
        list.innerHTML = '<p class="cell-secondary" style="text-align:center; padding:16px;">회의가 없습니다.</p>';
        return;
    }

    // 회의 아이템 DOM 요소 생성 함수 (중복 제거)
    const createMeetingItem = (e) => {
        const item = document.createElement('div');
        item.className = 'meeting-item';
        const isImp = e.isImportant;
        const id = e.googleEventId || e.id;

        item.innerHTML = `
            <span class="meeting-item-dot type-team"></span>
            <div class="meeting-item-text">${e.title}</div>
            <button class="star-btn ${isImp ? 'active' : ''}" data-meeting-id="${id}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="${isImp ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
            </button>
        `;
        return item;
    };

    // 1. 처음 5개 렌더링
    events.slice(0, 5).forEach(e => {
        list.appendChild(createMeetingItem(e));
    });

    // 2. 5개 초과 시 '더 보기' 버튼 생성
    if (events.length > 5) {
        const remaining = events.length - 5;
        const moreLink = document.createElement('div');

        // 스타일 적용
        moreLink.style.textAlign = 'center';
        moreLink.style.padding = '12px 0';
        moreLink.style.fontSize = '13px';
        moreLink.style.color = '#6b7280';
        moreLink.style.cursor = 'pointer';
        moreLink.style.fontWeight = '500';
        moreLink.textContent = `...외 ${remaining}개 더 보기`;

        // 클릭 시 버튼을 제거하고 나머지 리스트를 추가함
        moreLink.onclick = (e) => {
            e.stopPropagation(); 
            moreLink.remove();   // 더보기 버튼 삭제
            
            // 나머지 아이템 렌더링
            events.slice(5).forEach(restEvent => {
                list.appendChild(createMeetingItem(restEvent));
            });
        };

        list.appendChild(moreLink);
    }
}

// [UI 렌더링] 우측 To-do 목록
function renderTodoList(dateString) {
    const todoListEl = document.getElementById('todoList');
    const todoCardTitleContentEl = document.getElementById('todoCardTitleContent');
    const todoCountEl = document.getElementById('todoCount');

    if (!todoListEl || !todoCardTitleContentEl || !todoCountEl) return;

    const formattedDate = formatDisplayDate(dateString).split('(')[0].trim();
    todoCardTitleContentEl.textContent = `${formattedDate}의 To-do`;

    const selectedEvents = getEventsForDate(dateString);
    const todos = selectedEvents.filter(event => event.eventType === 'TASK' || event.eventType === 'PERSONAL');

    todoListEl.innerHTML = '';

    if (todos.length === 0) {
        todoListEl.innerHTML = '<p class="cell-secondary" style="text-align: center; padding: 16px 0;">등록된 할 일이 없습니다.</p>';
        todoCountEl.textContent = `(총 0개)`;
        return;
    }

    todos.forEach(event => {
        const todoItem = document.createElement('div');
        todoItem.className = `todo-item ${event.isCompleted ? 'completed' : ''}`;
        
        const eventId = event.googleEventId || event.id; 
        
        todoItem.innerHTML = `
            <span class="todo-item-dot type-personal"></span>
            <div class="todo-item-text">${event.title}</div>
            <div class="todo-actions">
                <button type="button" class="todo-action-btn edit">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                </button>
                <button type="button" class="todo-action-btn delete">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2v2"/>
                    </svg>
                </button>
            </div>
        `;

        const editBtn = todoItem.querySelector('.edit');
        editBtn.onclick = function(e) {
            e.preventDefault(); 
            e.stopPropagation();
            e.stopImmediatePropagation();
            console.log('수정 버튼 클릭됨');
            editApiTodo(String(eventId), event.title, event.eventDate); 
        };
        
        const deleteBtn = todoItem.querySelector('.delete');
        deleteBtn.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            console.log('삭제 버튼 클릭됨');
            deleteApiTodo(String(eventId), event.title);
        };

        todoListEl.appendChild(todoItem);
    });
    
    todoCountEl.textContent = `(총 ${todos.length}개)`;
}

//  [UI 렌더링] 캘린더에 이벤트 점(dot) 표시 (UI Dev 코드)
function displayEventDots(events) {
    document.querySelectorAll('.event-dots').forEach(dot => dot.remove());

    const eventsByDate = {};
    events.forEach(event => {
        const dateStr = event.eventDate; // "YYYY-MM-DD"
        if (!dateStr) return; 
        if (!eventsByDate[dateStr]) {
            eventsByDate[dateStr] = [];
        }
        eventsByDate[dateStr].push(event);
    });

    for (const dateStr in eventsByDate) {
        const cell = document.querySelector(`.calendar-day-cell[data-date="${dateStr}"]`);
        if (cell) {
            const dayEvents = eventsByDate[dateStr];
            const dotsContainer = document.createElement('div');
            dotsContainer.className = 'event-dots';
            
            const hasTeamEvent = dayEvents.some(e => e.eventType === 'MEETING');
            const hasPersonalEvent = dayEvents.some(e => e.eventType === 'TASK' || e.eventType === 'PERSONAL');
            
            if (hasTeamEvent) {
                const dot = document.createElement('span');
                dot.className = 'event-dot event-type-team';
                dotsContainer.appendChild(dot);
            }
            if (hasPersonalEvent) {
                const dot = document.createElement('span');
                dot.className = 'event-dot event-type-personal';
                dotsContainer.appendChild(dot);
            }
            
            const dayContent = cell.querySelector('.day-number').parentElement;
            if(dayContent) {
                dayContent.appendChild(dotsContainer);
            }
        }
    }
}

// [UI 렌더링] 날짜 클릭 시 오버레이 표시 (UI Dev 코드)
function showDailyEventOverlay(dateString) {
    const dailyEventsList = document.getElementById('dailyEventsList');
    const dailyEventsTitle = document.getElementById('dailyEventsTitle');
    const dailyEventsContent = document.getElementById('dailyEventsContent');
    if (!dailyEventsList || !dailyEventsTitle || !dailyEventsContent) {
        console.error("오버레이 상세창의 HTML ID(dailyEventsList 등)를 찾을 수 없습니다.");
        return; 
    }

    dailyEventsTitle.textContent = `${formatDisplayDate(dateString)}의 일정`;
    dailyEventsContent.innerHTML = ''; 
    
    const selectedEvents = getEventsForDate(dateString);
    const meetings = selectedEvents.filter(e => e.eventType === 'MEETING');
    const todos = selectedEvents.filter(e => e.eventType === 'TASK' || e.eventType === 'PERSONAL');

    // 오버레이용 회의 섹션
    const meetingSection = document.createElement('div');
    meetingSection.className = 'daily-events-section';
    meetingSection.innerHTML = '<div class="daily-events-section-title">회의</div>';
    const meetingList = document.createElement('div');
    meetingList.className = 'daily-events-list';
    if (meetings.length === 0) {
        meetingList.innerHTML = '<p class="cell-secondary" style="text-align: center; padding: 16px;">등록된 회의가 없습니다.</p>';
    } else {
        meetings.forEach(item => {
            const meetingItem = document.createElement('div');
            meetingItem.className = 'daily-event-item type-team';
            const isImportant = item.isImportant || false;
            meetingItem.innerHTML = `
                <div class="event-details">
                    <div class="event-title">${item.title}</div>
                    <div class="event-meta">팀 회의 ${isImportant ? ' • 중요' : ''}</div>
                </div>
                ${isImportant ? `<svg class="event-star" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" style="margin-left: 8px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>` : ''}
            `;
            meetingList.appendChild(meetingItem);
        });
    }
    meetingSection.appendChild(meetingList);

    // 오버레이용 To-do 섹션
    const todoSection = document.createElement('div');
    todoSection.className = 'daily-events-section';
    todoSection.innerHTML = '<div class="daily-events-section-title">To-do</div>';
    const todoList = document.createElement('div');
    todoList.className = 'daily-events-list';
    if (todos.length === 0) {
        todoList.innerHTML = '<p class="cell-secondary" style="text-align: center; padding: 16px;">등록된 할 일이 없습니다.</p>';
    } else {
        todos.forEach(event => {
        const eventItem = document.createElement('div');
        eventItem.className = `daily-event-item type-personal ${event.isCompleted ? 'completed' : ''}`;

        const categoryText = (event.eventType === 'TASK') ? '업무' : '개인';

        const titleStyle = event.isCompleted ? 'text-decoration: line-through; color: #9ca3af;' : '';
        const metaStyle = 'font-size: 13px; color: #6b7280; margin-top: 2px;';
        const statusHtml = event.isCompleted ? '<span style="color: #8b5cf6; font-weight: 600;"> • 확인</span>' : '';

        eventItem.innerHTML = `
            <div class="event-details">
                <div class="event-title" style="${titleStyle}">${event.title}</div>
                <div class="event-meta" style="${metaStyle}">
                    <span class="event-category">${categoryText}</span>
                    ${statusHtml}
                </div>
            </div>
        `;
        todoList.appendChild(eventItem);
    });
    }
    todoSection.appendChild(todoList);
    
    dailyEventsContent.appendChild(meetingSection);
    dailyEventsContent.appendChild(todoSection);
    dailyEventsList.classList.remove('hidden');
}

// [UI 렌더링] 오버레이 닫기 (UI Dev 코드)
window.closeDailyEvents = function() {
    const dailyEventsList = document.getElementById('dailyEventsList');
    if (dailyEventsList) {
        dailyEventsList.classList.add('hidden');
    }
    document.querySelectorAll('.calendar-day-cell.selected').forEach(cell => {
        cell.classList.remove('selected');
    });
    // [수정] 날짜 선택을 해제할 때, 오늘 날짜의 사이드바를 다시 표시
    const todayStr = formatDateString(new Date());
    selectDate(todayStr, false); // false: 오버레이 안 띄움
}

async function initializeCalendar() {
    console.log("캘린더 초기화 및 렌더링 시작...");
    
    // 1. URL에서 'date' 파라미터 읽기
    const urlDate = getQueryParam('date'); // 헬퍼 함수 사용
    const today = new Date();
    const todayStr = formatDateString(today);

    let targetDate;
    let showOverlayOnLoad = false; // 오버레이 띄울지 결정하는 변수

    // 2. URL 날짜 유효성 검사
    if (isValidDateString(urlDate)) { // 헬퍼 함수 사용
        console.log(`URL에서 날짜 (${urlDate})를 로드합니다.`);
        targetDate = urlDate; 
        const parts = urlDate.split('-').map(Number);
        currentYearMonth = new Date(parts[0], parts[1] - 1, 1); 
        showOverlayOnLoad = true; // ⭐️ URL에 날짜가 있으니 오버레이 띄움!
    } else {
        console.log("URL 날짜가 없거나 유효하지 않습니다. 오늘 날짜로 시작합니다.");
        targetDate = todayStr;
        currentYearMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    }
    
    // 3. 이벤트 리스너 등록
    document.getElementById('prevMonthBtn')?.addEventListener('click', () => changeMonth(-1));
    document.getElementById('nextMonthBtn')?.addEventListener('click', () => changeMonth(1));
    document.getElementById('addTodoBtn')?.addEventListener('click', addDailyTodo);
    document.getElementById('todoInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addDailyTodo(); 
        }
    });

    // 4. 캘린더 렌더링
    await renderCalendar(); 

    // 5. URL에서 가져온 설정대로 날짜 선택 및 오버레이 표시
    selectDate(targetDate, showOverlayOnLoad);
}

// 월 변경
function changeMonth(delta) {
    currentYearMonth.setMonth(currentYearMonth.getMonth() + delta);
    selectedDate = null; 
    closeDailyEvents(); 
    renderCalendar(); 
}

// 캘린더 그리기 (API 호출 트리거)
async function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    const header = document.getElementById('currentMonthYear');
    if (!grid || !header) return;

    grid.innerHTML = ''; 
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    dayNames.forEach(day => {
        const dayLabel = document.createElement('div');
        dayLabel.className = 'calendar-day-label';
        dayLabel.textContent = day;
        grid.appendChild(dayLabel);
    });

    const year = currentYearMonth.getFullYear();
    const month = currentYearMonth.getMonth(); // 0-11
    header.textContent = `${year}년 ${month + 1}월`;

    const firstDayOfMonth = new Date(year, month, 1).getDay(); 
    const daysInMonth = new Date(year, month + 1, 0).getDate(); 
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    
    // 이전 달
    for (let i = 0; i < firstDayOfMonth; i++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day-cell other-month';
        const dayNumber = document.createElement('span');
        dayNumber.className = 'day-number';
        dayNumber.textContent = daysInPrevMonth - firstDayOfMonth + 1 + i;
        dayCell.appendChild(dayNumber);
        grid.appendChild(dayCell);
    }

    // 현재 달
    const todayStr = formatDateString(new Date()); 
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dateStr = formatDateString(date);

        const dayElement = document.createElement('div');
        dayElement.classList.add('calendar-day-cell');
        dayElement.dataset.date = dateStr;
        
        const dayContent = document.createElement('div');
        dayContent.style.cssText = 'display: flex; flex-direction: column; align-items: flex-end; width: 100%;';
        
        if (dateStr === todayStr) {
            dayElement.classList.add('today');
        }

        const dayNumber = document.createElement('span');
        dayNumber.className = 'day-number';
        dayNumber.textContent = day;
        dayContent.appendChild(dayNumber);
        
        dayElement.appendChild(dayContent);

        dayElement.addEventListener('click', () => {
            selectDate(dateStr, true); // true: 클릭 시 오버레이 띄움
        });
        
        grid.appendChild(dayElement);
    }    
    
    // 다음 달
    const totalCells = grid.children.length;
    const remainingCells = 42 - totalCells; // 6줄(42칸) 기준
    
    if (remainingCells > 0 && remainingCells < 7) { 
        for (let i = 1; i <= remainingCells; i++) {
            const dayCell = document.createElement('div');
            dayCell.className = 'calendar-day-cell other-month';
            const dayNumber = document.createElement('span');
            dayNumber.className = 'day-number';
            dayNumber.textContent = i;
            dayCell.appendChild(dayNumber);
            grid.appendChild(dayCell);
        }
    }
    
    const totalRows = Math.ceil((grid.children.length - 7) / 7); 
    grid.style.gridTemplateRows = `auto repeat(${totalRows}, 1fr)`;
    
    // 캘린더 이벤트 로드 (API 호출)
    if (currentUser) {
        await loadCalendarEvents(year, month); // month (0-11)
    } else {
        console.warn("캘린더 이벤트 로드 중단: 사용자 정보(currentUser)가 설정되지 않았습니다.");
        return Promise.resolve();
    }
}

// 캘린더 이벤트 로드 (API)
async function loadCalendarEvents(year, monthIndex) {
    if (!currentUser) {
        console.error("❗ loadCalendarEvents: 사용자 인증 정보가 누락되었습니다.");
        return;
    }
    
    const month = monthIndex + 1; // 1-12
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = formatDateString(new Date(year, month, 0)); 
    
    const FETCH_URL = `${CALENDAR_BASE_URL}/events?startDate=${startDate}&endDate=${endDate}`;

    const header = document.getElementById('currentMonthYear');
    if (header) header.textContent = `${year}년 ${month}월`;

    try {
        const response = await fetch(FETCH_URL, {
            method: 'GET',
            credentials: 'include',
            cache: 'no-store'
        });

        if (header) header.textContent = `${year}년 ${month}월`;

        if (response.ok) {
            const data = await response.json();
            calendarEvents = data; // 🚨 전역 API 이벤트 배열 업데이트
            console.log("✅ 캘린더 이벤트 로드 성공:", data.length, "개");
            
            displayEventDots(calendarEvents);
            
            if (selectedDate) {
                // [버그 수정] renderSidebar -> renderMeetingList/renderTodoList 호출
                renderMeetingList(selectedDate);
                renderTodoList(selectedDate);
            }

        } else {
            const errorData = await response.json().catch(() => ({ message: "Unknown error" })); 

            if (response.status === 401 && errorData.errorCode === "GOOGLE_REAUTH_REQUIRED") {
                console.warn("⚠️ Google 연동 필요:", errorData.message);
                showGoogleLinkButton(); // 연동 팝업 띄우기
            } else {
                console.error("❌ [Spring] Calendar event loading error:", response.status, errorData.message || response.statusText);
            }
        }
    } catch (error) {
        console.error(`❌ [Spring] Calendar event loading network error: ${error}`);
        if (header) header.textContent = `${year}년 ${month}월 (오류 발생)`;
    }
}

// 날짜 선택 핸들러 (병합됨)
function selectDate(dateStr, showOverlay = true) { 
    selectedDate = dateStr; 
    console.log(`날짜 선택: ${selectedDate}`);

    // 1. 하이라이트 CSS 적용
    document.querySelectorAll('.calendar-day-cell.selected').forEach(el => el.classList.remove('selected'));
    const selectedCell = document.querySelector(`.calendar-day-cell[data-date="${dateStr}"]`);
    if (selectedCell) {
        selectedCell.classList.add('selected');
    }
    
    renderMeetingList(dateStr);
    renderTodoList(dateStr);
     
    if (showOverlay) {
        showDailyEventOverlay(dateStr);
    }
}

// // 이벤트 리스너 추가 함수 안되면 삭제해야함. (pih 수정.)
// async function toggleImportance(eventId, starBtn) {
//     const TOGGLE_URL = `${CALENDAR_BASE_URL}/events/${eventId}/importance`;
//     //const TOGGLE_URL = `${CALENDAR_BASE_URL}/${eventId}/importance`;

//     try {
//         console.log(`🔄 중요도 토글 요청: ${eventId}`);

//         const response = await fetch(TOGGLE_URL, {
//             method: 'PATCH', // 또는 백엔드 API에 맞는 메서드 (POST/PUT 등)
//             credentials: 'include',
//              headers: { 'Content-Type': 'application/json' }
//         });

//         if (!response.ok) {
//             throw new Error(`HTTP error! status: ${response.status}`);
//         }

//         console.log(` 중요도 토글 성공: ${eventId}`);

//     } catch (error) {
//         console.error(' 중요도 토글 실패:', error);
//         showAlert('중요도 변경에 실패했습니다.', 'error');
        
//         // 실패 시 UI 롤백
//         starBtn.classList.toggle('active');
//         const svg = starBtn.querySelector('svg');
//         if (starBtn.classList.contains('active')) {
//              svg.setAttribute('fill', 'currentColor');
//         } else {
//              svg.setAttribute('fill', 'none');
//         }
//     }
// }

/* 1. 중요도 토글 함수 (좌측 달력 점 동기화 및 오버레이 갱신) */
async function toggleImportance(eventId, starBtn) {
    if (starBtn.disabled) return;
    
    // 1. [UI 즉시 반영] 버튼 스타일 토글
    const isCurrentlyActive = starBtn.classList.contains('active');
    const newState = !isCurrentlyActive;
    
    starBtn.classList.toggle('active', newState);
    const svg = starBtn.querySelector('svg');
    if(svg) svg.setAttribute('fill', newState ? 'currentColor' : 'none');

    // 2. [데이터 동기화] 메모리 상의 이벤트 데이터 찾아서 갱신
    const event = calendarEvents.find(e => String(e.googleEventId) === String(eventId) || String(e.id) === String(eventId));
    
    if (event) {
        event.isImportant = newState;
        
        // 좌측 캘린더 그리드의 점(dot) 즉시 다시 그리기
        if (typeof displayEventDots === 'function') displayEventDots(calendarEvents); 

        // 3. [UI 동기화] 오버레이가 열려있고 해당 날짜라면 내용 갱신
        if (selectedDate && event.eventDate === selectedDate) {
            const overlay = document.getElementById('dailyEventsList');
            if (overlay && !overlay.classList.contains('hidden')) {
                // showDailyEventOverlay 함수가 있다면 호출
                if (typeof showDailyEventOverlay === 'function') showDailyEventOverlay(selectedDate); 
            }
        }
    }

    // 4. API 요청 (백그라운드)
    starBtn.disabled = true; 
    const TOGGLE_URL = `${CALENDAR_BASE_URL}/events/${eventId}/importance`;

    try {
        const response = await fetch(TOGGLE_URL, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) throw new Error(`Status: ${response.status}`);
        console.log(`✅ 중요도 토글 서버 저장 완료 (${newState})`);

    } catch (error) {
        console.error('❌ 중요도 토글 실패:', error);
        // 실패 시 롤백
        starBtn.classList.toggle('active', isCurrentlyActive);
        if(svg) svg.setAttribute('fill', isCurrentlyActive ? 'currentColor' : 'none');
        if (event) {
            event.isImportant = isCurrentlyActive;
            if (typeof displayEventDots === 'function') displayEventDots(calendarEvents);
            if (selectedDate && typeof showDailyEventOverlay === 'function') showDailyEventOverlay(selectedDate);
        }
        if (typeof showSuccessMessage === 'function') showSuccessMessage('중요도 변경 실패'); // 알림
    } finally {
        starBtn.disabled = false;
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    // 챗봇 초기화 (전역 함수 사용)
    await initializeChatbot();
    
    // 사이드바 로드
    fetch("components/sidebar.html")

    // // 1. [병합] 별표 버튼 클릭 리스너 (이벤트 위임)
    // document.addEventListener('click', function(e) {
    //     const starBtn = e.target.closest('.star-btn');
    //     if (starBtn) {
    //         const meetingId = starBtn.getAttribute('data-meeting-id');

    //         starBtn.classList.toggle('active');
    //         const svg = starBtn.querySelector('svg');
    //         if (starBtn.classList.contains('active')) {
    //             svg.setAttribute('fill', 'currentColor');
    //         } else {
    //             svg.setAttribute('fill', 'none');
    //         }
            
    //         console.log(`⭐ 별표 클릭됨! ID: ${meetingId}`);
    //         toggleImportance(meetingId, starBtn);
    //     }
    // });

    // [수정] 별표 클릭 리스너 - 중복 방지
    if (!starListenerAttached) {
        document.addEventListener('click', function(e) {
            const starBtn = e.target.closest('.star-btn');
            if (starBtn) {
                // 이미 처리 중이면 무시
                if (starBtn.disabled) {
                    console.log('⚠️ 별표 처리 중... 대기하세요');
                    return;
                }

                const meetingId = starBtn.getAttribute('data-meeting-id');
                console.log(`⭐ 별표 클릭! ID: ${meetingId}`);

                // API 호출 (UI는 성공 후 자동 업데이트됨)
                toggleImportance(meetingId, starBtn);
            }
        });
        starListenerAttached = true;
        console.log('✅ 별표 이벤트 리스너 등록 완료');
    }

    // 2. 사이드바 로드 및 메인 로직 시작 (순차 처리)
    fetch("components/sidebar.html")
        .then(res => res.ok ? res.text() : Promise.reject('Sidebar HTML not found'))
        .then(html => {
            const sidebar = document.getElementById("sidebar-container");
            if (!sidebar) throw new Error("사이드바 컨테이너(#sidebar-container)를 찾을 수 없습니다.");
            sidebar.innerHTML = html;
            return loadCurrentUser();
        })
        .then(user => { 
            currentUser = user; 

            const sidebar = document.getElementById("sidebar-container");
            const currentPage = window.location.pathname.split("/").pop();
            const navItems = sidebar.querySelectorAll(".nav-menu a");
            navItems.forEach(item => {
                const linkPath = item.getAttribute("href");
                item.classList.toggle("active", linkPath === currentPage);
            });

            if (currentUser) {
                console.log("로그인 사용자 확인: " + (currentUser.email || "이메일 없음"));
                initializeCalendar(); 
            } else { 
                console.error("오류: 사용자 정보를 가져올 수 없습니다. (user is null)");
            }
        })
        .catch(error => {
            console.error('페이지 초기화 실패 (사이드바 또는 사용자 정보):', error);
        });
});

/* ===============================================
// 7. (UI Dev) 헬퍼 함수
=================================================*/
function showSuccessMessage(msg) {
    const div = document.createElement("div");
    div.textContent = msg;
    Object.assign(div.style, {
        position: "fixed",
        top: "24px",
        right: "24px",
        background: "#10b981",
        color: "#fff",
        padding: "12px 20px",
        borderRadius: "8px",
        zIndex: "9999",
        boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)"
    });
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 2500);
}

// (UI Dev) JWT 파싱 헬퍼
function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error("Invalid JWT token", e);
        return null;
    }
}

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

function getQueryParam(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name); // 예: '2025-11-21' 또는 null
}

// 2. 날짜 문자열이 'YYYY-MM-DD' 형식인지 간단히 검사
function isValidDateString(dateStr) {
    if (!dateStr) return false;
    return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}
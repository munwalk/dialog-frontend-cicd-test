/* ===============================
   meetings.js - 회의록 목록 관리 (정렬/필터/검색 포함)
=================================*/

// 전체 데이터를 저장할 전역 변수
let allMeetings = [];

document.addEventListener("DOMContentLoaded", () => {
    // 1. 사이드바 로드
    fetch("components/sidebar.html")
        .then(res => res.text())
        .then(html => {
            document.getElementById("sidebar-container").innerHTML = html;
            if (typeof loadCurrentUser === 'function') loadCurrentUser();
            
            // 사이드바 활성화 로직 (홈 불빛 끄고 현재 페이지만 켜기)
            const navItems = document.querySelectorAll(".nav-menu a");
            navItems.forEach(el => el.classList.remove("active"));
            navItems.forEach(item => {
                if (item.getAttribute("href") === "meetings.html") {
                    item.classList.add("active");
                }
            });
        });

    // 2. 챗봇 로드 및 이벤트 연결 (추가된 부분)
    fetch("components/chatbot.html")
        .then(res => res.text())
        .then(html => {
            const container = document.getElementById("chatbot-container");
            container.innerHTML = html;

            const closeBtn = container.querySelector(".close-chat-btn");
            const sendBtn = container.querySelector(".send-btn");
            const chatInput = container.querySelector("#chatInput");
            const floatingBtn = document.getElementById("floatingChatBtn");

            // [중요] chatbot.js 로드 시점 차이로 인한 오류 방지를 위해 화살표 함수로 감싸서 실행
            if (closeBtn) {
                closeBtn.addEventListener("click", () => {
                    if (typeof closeChat === 'function') closeChat();
                });
            }

            if (sendBtn) {
                sendBtn.addEventListener("click", () => {
                    if (typeof sendMessage === 'function') sendMessage();
                });
            }

            if (chatInput) {
                chatInput.addEventListener("keypress", (e) => {
                    if (typeof handleChatEnter === 'function') handleChatEnter(e);
                });
            }

            if (floatingBtn) {
                floatingBtn.addEventListener("click", () => {
                    if (typeof openChat === 'function') openChat();
                });
            }
        });

    // 3. 이벤트 리스너 등록 (정렬, 필터, 검색)
    setupEventListeners();

    // 4. 데이터 불러오기
    fetchMeetings();
});

function setupEventListeners() {
    // 정렬 기준 변경
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        sortSelect.addEventListener('change', applyFilters);
    }

    // 우선순위 필터 변경
    const priorityFilter = document.getElementById('priorityFilter');
    if (priorityFilter) {
        priorityFilter.addEventListener('change', applyFilters);
    }

    // 검색어 입력 (입력할 때마다 실시간 필터링)
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            // 검색창 스타일 (값이 있으면 X버튼 표시 등)
            const wrapper = e.target.closest('.search-input-wrapper');
            if (wrapper) {
                e.target.value ? wrapper.classList.add('has-value') : wrapper.classList.remove('has-value');
            }
            applyFilters();
        });
    }

    // 검색 초기화 버튼
    const searchClearBtn = document.getElementById('searchClearBtn');
    if (searchClearBtn) {
        searchClearBtn.addEventListener('click', () => {
            const input = document.getElementById('searchInput');
            input.value = '';
            input.closest('.search-input-wrapper').classList.remove('has-value');
            applyFilters();
        });
    }

    // 검색 패널 토글 버튼
    const searchToggleBtn = document.getElementById('searchToggleBtn');
    const searchPanel = document.getElementById('searchPanel');
    if (searchToggleBtn && searchPanel) {
        searchToggleBtn.addEventListener('click', () => {
            searchPanel.classList.toggle('hidden');
            if (!searchPanel.classList.contains('hidden')) {
                document.getElementById('searchInput').focus();
            }
        });
    }
}

/* 서버에서 데이터 가져오기 */
async function fetchMeetings() {
    try {
        const response = await fetch('http://dialogai.duckdns.org:8080/api/meetings', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });

        if (response.status === 401) {
            alert("로그인이 필요합니다.");
            window.location.href = "login.html";
            return;
        }

        if (!response.ok) throw new Error("회의록 목록을 불러오지 못했습니다.");

        // 전역 변수에 저장
        allMeetings = await response.json();
        
        // 초기 렌더링 (필터 적용)
        applyFilters();

    } catch (error) {
        console.error("Error fetching meetings:", error);
        showErrorState();
    }
}

/* 통합 필터링 및 정렬 로직 */
function applyFilters() {
    let result = [...allMeetings]; // 원본 보호를 위해 복사

    // 1. 검색어 필터링
    const searchInput = document.getElementById('searchInput');
    const keyword = searchInput ? searchInput.value.trim().toLowerCase() : "";
    
    if (keyword) {
        result = result.filter(m => {
            const title = (m.title || "").toLowerCase();
            // 키워드 배열(객체 or 문자열) 처리
            const keywordsStr = (m.keywords || []).map(k => (typeof k === 'object' ? k.text : k).toLowerCase()).join(" ");
            return title.includes(keyword) || keywordsStr.includes(keyword);
        });
    }

    // 2. 우선순위 필터링
    const priorityFilter = document.getElementById('priorityFilter');
    const priorityVal = priorityFilter ? priorityFilter.value : "all";

    if (priorityVal !== "all") {
        result = result.filter(m => {
            // DTO 구조에 따라 importance가 문자열이거나 객체일 수 있음
            let level = "MEDIUM";
            if (m.importance) {
                level = (typeof m.importance === 'object') ? m.importance.level : m.importance;
            }
            // 서버 데이터(HIGH)와 필터 값(high) 대소문자 매칭
            return String(level).toUpperCase() === priorityVal.toUpperCase();
        });
    }

    // 3. 정렬 (Sort)
    const sortSelect = document.getElementById('sortSelect');
    const sortVal = sortSelect ? sortSelect.value : "date-desc";

    result.sort((a, b) => {
        const dateA = new Date(a.scheduledAt || a.meetingDate || 0);
        const dateB = new Date(b.scheduledAt || b.meetingDate || 0);
        const durA = a.durationSeconds || 0;
        const durB = b.durationSeconds || 0;
        const titleA = (a.title || "").toLowerCase();
        const titleB = (b.title || "").toLowerCase();

        switch (sortVal) {
            case 'date-desc': return dateB - dateA; // 최신순
            case 'date-asc': return dateA - dateB;  // 오래된순
            case 'title-asc': return titleA.localeCompare(titleB); // 제목순
            case 'duration-desc': return durB - durA; // 긴 시간 순
            default: return dateB - dateA;
        }
    });

    renderMeetingList(result);
}

/* 목록 그리기 */
function renderMeetingList(meetings) {
    const tableCard = document.querySelector('.table-card');
    const header = tableCard.querySelector('.table-header'); 
    
    tableCard.innerHTML = '';
    if (header) tableCard.appendChild(header);

    if (!meetings || meetings.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.style.padding = "60px 0";
        emptyDiv.style.textAlign = "center";
        emptyDiv.style.color = "#9ca3af";
        emptyDiv.innerHTML = `<p>조건에 맞는 회의록이 없습니다.</p>`;
        tableCard.appendChild(emptyDiv);
        return;
    }

    meetings.forEach(meeting => {
        const dateObj = new Date(meeting.scheduledAt || meeting.meetingDate);
        const dateStr = `${(dateObj.getMonth()+1).toString().padStart(2, '0')}/${dateObj.getDate().toString().padStart(2, '0')}`;
        const timeStr = `${dateObj.getHours().toString().padStart(2, '0')}:${dateObj.getMinutes().toString().padStart(2, '0')}`;

        // SCHEDULED 상태 처리
        let pClass = 'medium';
        let pLabel = '보통';

        if (meeting.status === 'SCHEDULED') {
            pClass = 'pending'; 
            pLabel = '분석 전';
        } else {
            // 완료된 회의라도 사유가 없으면 '-'로 표시
            let priority = "MEDIUM";
            let reason = "";
            
            if (meeting.importance && typeof meeting.importance === 'object') {
                priority = meeting.importance.level;
                reason = meeting.importance.reason;
            } else {
                priority = meeting.importance;
                // 객체가 아니고 문자열만 왔다면 reason 확인 불가 -> 일단 표시하거나, 
                // 백엔드 DTO 구조상 importance는 객체로 옴
            }

            // 사유가 비어있으면 분석 안 된 것으로 간주
            if (!reason || reason.trim() === "" || reason === "평가 내용 없음") {
                pClass = 'pending';
                pLabel = '-'; // '보통' 대신 대시 표시
            } else {
                pClass = getPriorityClass(priority);
                pLabel = getPriorityLabel(priority);
            }
        }

        const keywordHtml = renderKeywords(meeting.keywords);

        const row = document.createElement('div');
        row.className = 'table-row';
        row.onclick = () => goToMeetingDetail(meeting.meetingId || meeting.id); 

        row.innerHTML = `
            <div class="table-cell">
                <span class="cell-primary">${dateStr}</span>
                <span class="cell-secondary">${timeStr}</span>
            </div>
            <div class="table-cell">
                <span class="cell-primary">${meeting.title}</span>
            </div>
            <div class="table-cell">
                <span class="cell-secondary">${(meeting.participants || []).length}명</span>
            </div>
            <div class="table-cell">
                <span class="cell-secondary">${formatDuration(meeting.durationSeconds || 0)}</span>
            </div>
            <div class="table-cell">
                <span class="priority-badge ${pClass}">${pLabel}</span>
            </div>
            <div class="table-cell">
                <div class="keyword-list">
                    ${keywordHtml}
                </div>
            </div>
        `;
        tableCard.appendChild(row);
    });
}

// 에러 표시 함수
function showErrorState() {
    const tableCard = document.querySelector('.table-card');
    const header = tableCard.querySelector('.table-header');
    tableCard.innerHTML = '';
    if(header) tableCard.appendChild(header);
    
    const errDiv = document.createElement('div');
    errDiv.style.padding = "20px";
    errDiv.style.textAlign = "center";
    errDiv.style.color = "#ef4444";
    errDiv.innerHTML = "데이터를 불러오는 중 오류가 발생했습니다.<br>잠시 후 다시 시도해주세요.";
    tableCard.appendChild(errDiv);
}

// --- 헬퍼 함수들 ---

function getPriorityClass(p) {
    if (!p) return 'medium';
    p = String(p).toUpperCase();
    if (p === 'HIGH' || p === '높음') return 'high';
    if (p === 'LOW' || p === '낮음') return 'low';
    return 'medium';
}

function getPriorityLabel(p) {
    if (!p) return '보통';
    p = String(p).toUpperCase();
    if (p === 'HIGH' || p === '높음') return '높음';
    if (p === 'LOW' || p === '낮음') return '낮음';
    return '보통';
}

function formatDuration(seconds) {
    if (!seconds) return "0분";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}시간 ${m}분`;
    return `${m}분`;
}

function renderKeywords(keywords) {
    if (!keywords || keywords.length === 0) return '';
    
    // DTO: [{text: "키워드", source: "AI"}, ...] 또는 ["키워드", ...]
    const list = keywords.map(k => (typeof k === 'object' ? k.text : k));
    
    const max = 2;
    let html = list.slice(0, max).map(k => `<span class="keyword-tag">#${k}</span>`).join('');
    
    if (list.length > max) {
        html += `<span class="keyword-more">+${list.length - max}</span>`;
    }
    return html;
}

function goToMeetingDetail(id) {
    if(id) window.location.href = `meetingDetail.html?id=${id}`;
}
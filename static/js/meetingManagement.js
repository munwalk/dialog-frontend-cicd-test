/* ===============================
   Chatbot & Sidebar Fetch
=================================*/
document.addEventListener("DOMContentLoaded", () => {
    // 챗봇 로드
    fetch("components/chatbot.html")
        .then(res => res.text())
        .then(html => {
            const container = document.getElementById("chatbot-container");
            container.innerHTML = html;

            const closeBtn = container.querySelector(".close-chat-btn");
            const sendBtn = container.querySelector(".send-btn");
            const chatInput = container.querySelector("#chatInput");
            const floatingBtn = document.getElementById("floatingChatBtn");

            if (closeBtn) closeBtn.addEventListener("click", closeChat);
            if (sendBtn) sendBtn.addEventListener("click", sendMessage);
            if (chatInput) chatInput.addEventListener("keypress", handleChatEnter);
            if (floatingBtn) floatingBtn.addEventListener("click", openChat);
        });
    
    // 사이드바 로드
    fetch("components/sidebar.html")
        .then(res => res.text())
        .then(async html => {
            const sidebar = document.getElementById("sidebar-container");
            sidebar.innerHTML = html;

            // ✅ 사이드바 로드 후 사용자 정보 주입
            await loadCurrentUser();

            // 현재 페이지 활성화
            const currentPage = window.location.pathname.split("/").pop();
            const navItems = sidebar.querySelectorAll(".nav-menu a");

            navItems.forEach(item => {
                const linkPath = item.getAttribute("href");
                if (linkPath === currentPage) {
                    item.classList.add("active");
                } else {
                    item.classList.remove("active");
                }
            });
        })
        .catch(error => {
            console.error('사이드바 로드 실패:', error);
        });
    loadAndRenderMeetings();
});

// 신규 회의 등록(테스트)
function addMeeting() {
  alert('신규 회의 등록!');
}

async function loadAndRenderMeetings() {
    const tableBody = document.querySelector(".meetings-table tbody");
    if (!tableBody) {
        console.error("테이블 <tbody>를 찾을 수 없습니다.");
        return;
    }

    // 1. 로딩 표시
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">회의 목록을 불러오는 중...</td></tr>';

    try {
        // app.js에 정의된 'apiClient'를 사용하여 백엔드 API 호출
        const response = await apiClient.get('/admin/meetings');
        const meetings = response.data;

        // 2. 데이터가 없는 경우
        if (!meetings || meetings.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">등록된 회의가 없습니다.</td></tr>';
            return;
        }

        // 3. 데이터가 있으면 테이블 렌더링
        tableBody.innerHTML = ''; // 로딩 표시 제거 및 초기화
        meetings.forEach(meeting => {
            tableBody.appendChild(createMeetingRow(meeting));
        });

    } catch (error) {
        console.error("회의 목록 로드 실패:", error);
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">목록을 불러오는 데 실패했습니다.</td></tr>';
    }
}

function createMeetingRow(meeting) {
    const tr = document.createElement('tr');

    const meetingId = meeting.meetingId;
    const title = meeting.title || '제목 없음';
    const date = meeting.scheduledAt ? new Date(meeting.scheduledAt).toLocaleDateString() : '날짜 없음';
    const participants = meeting.participants && meeting.participants.length > 0 ? meeting.participants.join(', ') : '참여자 없음';
    const statusText = (meeting.status === 'CLOSED') ? '종료' : '진행중';
    const statusClass = (meeting.status === 'CLOSED') ? 'closed' : 'ongoing';
    
    const author = meeting.authorName || 'N/A';

    const tdTitle = document.createElement('td');
    tdTitle.textContent = title;
    tr.appendChild(tdTitle);

    const tdDate = document.createElement('td');
    tdDate.textContent = date;
    tr.appendChild(tdDate);

    const tdParticipants = document.createElement('td');
    tdParticipants.textContent = participants;
    tr.appendChild(tdParticipants);

    const tdStatus = document.createElement('td');
    tdStatus.innerHTML = `<span class="meeting-status ${statusClass}">${statusText}</span>`;
    tr.appendChild(tdStatus);

    const tdAuthor = document.createElement('td');
    tdAuthor.textContent = author;
    tr.appendChild(tdAuthor);

    const tdActions = document.createElement('td');
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'meeting-actions';

    // 상세 버튼
    const detailsBtn = document.createElement('button');
    detailsBtn.className = 'small-action-btn';
    detailsBtn.dataset.action = 'details';
    detailsBtn.dataset.id = meetingId;
    detailsBtn.textContent = '상세';
    detailsBtn.addEventListener('click', handleDetailsClick);

    // 수정 버튼
    const editBtn = document.createElement('button');
    editBtn.className = 'small-action-btn';
    editBtn.dataset.action = 'edit';
    editBtn.dataset.id = meetingId;
    editBtn.textContent = '수정';
    editBtn.addEventListener('click', handleEditClick);

    // 삭제 버튼
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'small-action-btn danger';
    deleteBtn.dataset.action = 'delete';
    deleteBtn.dataset.id = meetingId;
    deleteBtn.textContent = '삭제';
    deleteBtn.addEventListener('click', handleDeleteClick);

    actionsDiv.appendChild(detailsBtn);
    actionsDiv.appendChild(editBtn);
    actionsDiv.appendChild(deleteBtn);
    tdActions.appendChild(actionsDiv);
    tr.appendChild(tdActions);

    return tr;
}

function handleDetailsClick(event) {
    const meetingId = event.target.dataset.id;
    //alert(`상세: ${meetingId}번 회의 (상세 페이지 이동 로직 필요)`);
    window.location.href = `meetingDetail.html?id=${meetingId}`;
}

function handleEditClick(event) {
    const meetingId = event.target.dataset.id;
    // "수정" 버튼이 동작하는 것을 확인
    alert(`수정: ${meetingId}번 회의 (수정 페이지 이동 또는 모달 열기 로직 필요)`);
    // 예: window.location.href = \`/meeting-edit.html?id=\${meetingId}\`;
}

async function handleDeleteClick(event) {
    const meetingId = event.target.dataset.id;
    const deleteButton = event.target;

    if (confirm(`회의(ID: ${meetingId})를 정말 삭제하시겠습니까?`)) {        

        deleteButton.disabled = true;
        deleteButton.textContent = '삭제 중...';

        try {
            await apiClient.delete(`/admin/meetings/${meetingId}`); 

            alert('삭제되었습니다.');
            
            loadAndRenderMeetings(); 

        } catch (error) {
            console.error('삭제 실패:', error);
            alert('삭제에 실패했습니다. (예: 404 - 찾을 수 없음)');

        } finally {
            if (deleteButton) {
                 deleteButton.disabled = false;
                 deleteButton.textContent = '삭제';
            }
        }
    }
}
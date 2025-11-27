/* ===============================
   meetingDetail.js - 최종 수정 (삭제 성공 모달 적용)
=================================*/

let meetingData = null; 
let currentUserName = "사용자"; 
let activeKeyword = null; 

document.addEventListener("DOMContentLoaded", async () => {
    // 사이드바
    await fetch("components/sidebar.html")
        .then(res => res.text())
        .then(html => {
            document.getElementById("sidebar-container").innerHTML = html;
            const navItems = document.querySelectorAll(".nav-menu a");
            navItems.forEach(el => el.classList.remove("active"));
            navItems.forEach(item => {
                if (item.getAttribute("href") === "meetings.html") { 
                    item.classList.add("active"); 
                }
            });
        });

    // 사용자 정보
    if(typeof loadCurrentUser === 'function') {
        try {
            const user = await loadCurrentUser(); 
            if(user && user.name) {
                currentUserName = user.name;
            }
        } catch (e) {
            console.warn("User load failed", e);
        }
    }

    // 챗봇 로드 및 이벤트 연결
    fetch("components/chatbot.html")
        .then(res => res.text())
        .then(html => {
            const container = document.getElementById("chatbot-container");
            container.innerHTML = html;

            const closeBtn = container.querySelector(".close-chat-btn");
            const sendBtn = container.querySelector(".send-btn");
            const chatInput = container.querySelector("#chatInput");
            const floatingBtn = document.getElementById("floatingChatBtn");

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

    const urlParams = new URLSearchParams(window.location.search);
    const meetingId = urlParams.get('id');

    if (!meetingId) {
        showErrorModal("잘못된 접근입니다.");
        setTimeout(() => window.location.href = 'meetings.html', 1500);
        return;
    }

    loadMeetingDetail(meetingId);
});

function showErrorModal(msg) {
    const modal = document.getElementById('errorModal');
    const msgEl = document.getElementById('errorModalMessage');
    if (modal && msgEl) {
        msgEl.textContent = msg;
        modal.classList.remove('hidden');
    } else {
        alert(msg);
    }
}

async function loadMeetingDetail(meetingId) {
    try {
        const [metaRes, transRes, recRes] = await Promise.all([
            fetch(`http://dialogai.duckdns.org:8080/api/meetings/${meetingId}`, { credentials: 'include' }),
            fetch(`http://dialogai.duckdns.org:8080/api/transcripts/meeting/${meetingId}`, { credentials: 'include' }),
            fetch(`http://dialogai.duckdns.org:8080/api/recordings/meeting/${meetingId}`, { credentials: 'include' })
        ]);

        // 1. 기본 정보(metaRes)는 필수이므로 실패 시 에러 처리
        if (!metaRes.ok) throw new Error("회의 정보를 찾을 수 없습니다.");
        const metaData = await metaRes.json();

        // 2. 대화 내용(transRes) 처리
        let transcripts = [];
        if (transRes.ok) {
            const tData = await transRes.json();
            transcripts = tData.filter(t => !t.isDeleted).sort((a,b) => a.sequenceOrder - b.sequenceOrder);
        }

        // 3. 녹음 파일(recRes) 처리
        // 404(녹음 없음)인 경우를 명시적으로 체크하여 정상 흐름으로 처리
        let realDuration = 0;
        
        if (recRes.status === 404) {
            console.log("이 회의에는 녹음 파일이 없습니다.");
            // 에러를 던지지 않고 duration을 0으로 유지
        } else if (recRes.ok) {
            const recData = await recRes.json();
            realDuration = recData.durationSeconds || 0;
        }

        // 데이터 통합 객체 생성
        meetingData = {
            id: metaData.meetingId,
            status: metaData.status,
            title: metaData.title,
            date: metaData.scheduledAt, 
            durationSeconds: realDuration, 
            participantCount: (metaData.participants || []).length,
            participants: metaData.participants || [],
            keywords: metaData.keywords || [],
            actions: metaData.actionItems || [],
            purpose: metaData.purpose,
            agenda: metaData.agenda,
            summary: metaData.summary,
            importance: metaData.importance || { level: "MEDIUM", reason: "" },
            transcripts: transcripts
        };

        renderDetailView();

    } catch (error) {
        console.error(error);
        showErrorModal("데이터 로드 실패: " + error.message);
    }
}

function renderDetailView() {
    if (!meetingData) return;

    // 1. 헤더 정보 표시
    document.getElementById('meetingTitle').textContent = meetingData.title;
    if(meetingData.date) {
        const dateObj = new Date(meetingData.date);
        const dateStr = `${dateObj.getFullYear()}.${String(dateObj.getMonth()+1).padStart(2,'0')}.${String(dateObj.getDate()).padStart(2,'0')} ${String(dateObj.getHours()).padStart(2,'0')}:${String(dateObj.getMinutes()).padStart(2,'0')}`;
        document.getElementById('meetingDate').textContent = dateStr;
    }
    document.getElementById('meetingDuration').textContent = formatDuration(meetingData.durationSeconds);
    document.getElementById('participantCount').textContent = `${meetingData.participantCount}명 참석`;

    // 2. 헤더 버튼 (상태별 분기)
    const actionContainer = document.querySelector('.header-actions');
    if (actionContainer) {
        if (meetingData.status === 'SCHEDULED') {
            // [예정된 회의] -> 삭제 / 회의 시작
            actionContainer.innerHTML = `
                <button class="action-btn delete" onclick="deleteMeeting()" style="background: white; color: #ef4444; border: 1px solid #e5e7eb;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2v2"></path></svg>
                    삭제
                </button>
                <button class="action-btn primary" onclick="startMeetingRecording(${meetingData.id})">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3" fill="currentColor"></circle></svg>
                    회의 시작
                </button>
            `;
        } else {
            // [완료된 회의] -> 삭제 / 수정 / PDF
            actionContainer.innerHTML = `
                <button class="action-btn delete" onclick="deleteMeeting()" style="background: white; color: #ef4444; border: 1px solid #e5e7eb;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2v2"></path></svg>
                    삭제
                </button>
                <button class="action-btn secondary" onclick="goToEdit()">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                    수정
                </button>
                <button class="action-btn primary" onclick="exportPDF()">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                    PDF 다운로드
                </button>
            `;
        }
    }

    // 3. 대화 내용 렌더링
    displayTranscripts();

    // 4. AI 요약 & 액션 아이템 (상태별 UI 분기)
    const aiSection = document.getElementById('aiSummarySection');
    const summaryTexts = document.querySelectorAll('.summary-text');
    const impEl = document.querySelector('.importance-text');
    const actionList = document.getElementById('actionList');

    if (aiSection) aiSection.style.display = 'block';

    if (meetingData.status === 'SCHEDULED') {
        // ============================================================
        // [CASE 1] 분석 전 (SCHEDULED)
        // - 모든 텍스트: "분석 전"
        // - 뱃지: 없음
        // - 액션 아이템: "생성 전" (왼쪽 정렬)
        // ============================================================
        
        if(summaryTexts.length >= 3) {
            // 목적, 안건, 요약 모두 "분석 전"으로 통일
            summaryTexts[0].innerHTML = "<span style='color: #9ca3af;'>분석 전</span>";
            summaryTexts[1].innerHTML = "<span style='color: #9ca3af;'>분석 전</span>";
            summaryTexts[2].innerHTML = "<span style='color: #9ca3af;'>분석 전</span>";
        }

        if (impEl) {
            // 중요도: 뱃지 없이 텍스트만 표시
            impEl.innerHTML = `<span style="color: #9ca3af; font-size: 14px;">분석 전</span>`;
        }

        if (actionList) {
            // 액션 아이템: 왼쪽 정렬(text-align: left) 적용
            actionList.innerHTML = `
                <div style="text-align: left; padding: 10px 0; color: #9ca3af; font-size: 14px;">
                    생성 전
                </div>
            `;
        }

    } else {
        // [CASE 2] 완료됨 (COMPLETED) 상태 처리

        // 1. 실제 분석된 데이터가 있는지 판단하는 기준
        // (요약이 비어있거나, 중요도 사유가 없으면 분석 안 된 것으로 간주)
        let isAnalyzed = false;
        
        if (meetingData.summary && meetingData.summary.trim() !== "" && meetingData.summary !== "요약 없음") {
            isAnalyzed = true;
        }
        
        // -------------------------------------------------------
        // (1) 텍스트 필드 (목적, 안건, 요약) 통일
        // -------------------------------------------------------
        if(summaryTexts.length >= 3) {
            if (isAnalyzed) {
                // 데이터가 있을 때
                summaryTexts[0].textContent = meetingData.purpose || "-";
                
                let agendaText = meetingData.agenda || "-";
                summaryTexts[1].textContent = agendaText.replace(/^-\s*/, ""); 
                
                let cleanSummary = meetingData.summary
                    .replace(/^(요약|Summary)[:\s]*/i, "")
                    .split("(중요도")[0]
                    .split("중요도 평가")[0]
                    .trim();
                
                summaryTexts[2].innerHTML = cleanSummary;
                summaryTexts[2].style.color = "#374151"; // 검은색 (내용)
            } else {
                // 데이터가 없을 때
                summaryTexts[0].innerHTML = "<span style='color: #9ca3af;'>-</span>";
                summaryTexts[1].innerHTML = "<span style='color: #9ca3af;'>-</span>";
                summaryTexts[2].innerHTML = "<span style='color: #9ca3af;'>생성된 요약이 없습니다.</span>";
            }
        }
        
        // -------------------------------------------------------
        // (2) 중요도 표시 (사유가 없으면 MEDIUM이라도 숨김 처리)
        // -------------------------------------------------------
        if (impEl) {
            let level = "MEDIUM";
            let reason = "";
            let hasReason = false; // 사유 존재 여부

            if (meetingData.importance) {
                if (typeof meetingData.importance === 'object') {
                    level = meetingData.importance.level || "MEDIUM";
                    reason = meetingData.importance.reason || "";
                } else {
                    level = meetingData.importance;
                }
            }

            // 중요도 사유가 유의미한지 체크
            if (reason && reason.trim() !== "" && reason !== "평가 내용 없음") {
                hasReason = true;
            }

            if (hasReason) {
                // [분석 완료] 뱃지 + 사유 표시
                const upperLevel = String(level).toUpperCase(); 
                let badgeClass = "medium";
                let korLabel = "보통";

                if(upperLevel === 'HIGH' || upperLevel === '높음') { badgeClass = 'high'; korLabel = '높음'; }
                else if(upperLevel === 'LOW' || upperLevel === '낮음') { badgeClass = 'low'; korLabel = '낮음'; }

                // 텍스트에서 중복 제거
                if (reason.includes("중요도 평가")) {
                    reason = reason.split("중요도 평가")[0].trim();
                }

                impEl.innerHTML = `
                    <div class="importance-container">
                        <span class="importance-badge ${badgeClass}">${upperLevel}</span>
                        <div class="importance-text-content">
                            <p class="importance-title">중요도 평가 : ${korLabel}</p>
                            <p class="importance-desc">${reason}</p>
                        </div>
                    </div>
                `;
            } else {
                // [분석 안됨] 뱃지 숨김 + "-" 표시
                // DB에 MEDIUM이 있어도 사유가 없으면 안 보여줌
                impEl.innerHTML = `
                    <div class="importance-container">
                        <span style="color: #9ca3af; font-size: 14px;">-</span>
                        <div class="importance-text-content" style="margin-top: 4px;">
                            <p class="importance-desc" style="color: #9ca3af; font-size: 14px;">평가 내용 없음</p>
                        </div>
                    </div>
                `;
            }
        }

        // -------------------------------------------------------
        // (3) 액션 아이템 리스트
        // -------------------------------------------------------
        if (actionList) {
            if (meetingData.actions && meetingData.actions.length > 0) {
                // ... (기존 리스트 렌더링 코드 유지) ...
                actionList.innerHTML = meetingData.actions.map(a => {
                    const source = (a.source ? a.source.toUpperCase() : 'USER');
                    const sourceText = (source === 'AI') ? 'AI' : '사용자';
                    const badgeClass = (source === 'AI') ? 'ai' : 'user';
                    const sourceBadge = `<span class="action-source-badge ${badgeClass}">${sourceText}</span>`;
                    const assignee = a.assignee ? `담당: ${a.assignee}` : '담당: 미지정';
                    const date = a.dueDate ? `기한: ${a.dueDate.split('T')[0]}` : '기한: -';
        
                    return `
                    <div class="action-item">
                        <div class="action-header">
                            <div class="action-title">${a.task} ${sourceBadge}</div>
                        </div>
                        <div class="action-meta">
                            <div>${date}</div>
                            <div style="color: #d1d5db;">|</div>
                            <div>${assignee}</div>
                        </div>
                    </div>`;
                }).join('');
            } else {
                // 액션 아이템 없을 때 (가운데 정렬 안내 문구)
                actionList.innerHTML = `
                    <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 14px;">
                        등록된 액션 아이템이 없습니다.
                    </div>
                `;
            }
        }
    }
    
    renderKeywords();
}

/* 회의 시작 버튼 클릭 핸들러 */
function startMeetingRecording(meetingId) {
    // 녹음 페이지로 이동 (파일명: recording.html)
    window.location.href = `recording.html?meetingId=${meetingId}`;
}

function displayTranscripts() {
    const list = document.getElementById('transcriptList');
    list.innerHTML = '';
    
    const speakerColorMap = {}; 
    let hueIndex = 0;

    meetingData.transcripts.forEach(t => {
        const name = t.speakerName || t.speakerId || "Unknown";
        
        if (!speakerColorMap[t.speakerId]) {
            speakerColorMap[t.speakerId] = getSpeakerColor(hueIndex++);
        }
        const color = speakerColorMap[t.speakerId];
        
        const isSelf = (name.trim() === currentUserName.trim());
        const timeStr = t.startTime !== undefined ? formatTimeFromMs(t.startTime) : (t.timeLabel || "00:00:00");
        
        let contentHtml = t.text;
        if (activeKeyword) {
            try {
                const regex = new RegExp(`(${activeKeyword})`, 'gi');
                contentHtml = t.text.replace(regex, '<span class="highlight">$1</span>');
            } catch(e) {}
        }

        const div = document.createElement("div");
        div.className = `transcript-item ${isSelf ? 'is-self' : ''}`;
        
        let headerContent = '';
        if (isSelf) {
            headerContent = `
                <span class="speaker-name" style="color:${color}; margin-right:8px;">${name}</span>
                <span class="time-stamp">${timeStr}</span>
            `;
        } else {
            headerContent = `
                <span class="speaker-name" style="color:${color}">${name}</span>
                <span class="time-stamp" style="margin-left:8px;">${timeStr}</span>
            `;
        }
        
        div.innerHTML = `
            <div class="speaker-avatar-wrapper">
                <div class="speaker-avatar" style="background:${color}">${name.charAt(0)}</div>
            </div>
            <div class="transcript-content">
                <div class="transcript-header">
                    ${headerContent}
                </div>
                <div class="transcript-text">${contentHtml}</div>
            </div>
        `;
        list.appendChild(div);
    });

    if (activeKeyword) {
        const first = document.querySelector('.highlight');
        if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function renderKeywords() {
    const kwContainer = document.querySelector('.keywords');
    if (!kwContainer || !meetingData.keywords) return;

    kwContainer.innerHTML = meetingData.keywords.map(k => {
        const text = k.text || k;
        const source = (k.source ? k.source.toUpperCase() : 'USER');
        const cssClass = (source === 'AI') ? 'keyword-ai' : 'keyword-user';
        const isActive = (activeKeyword === text) ? 'active' : '';
        
        return `<div class="keyword ${cssClass} ${isActive}" onclick="toggleHighlight('${text}')">${text}</div>`;
    }).join('');
}

function toggleHighlight(keyword) {
    if (activeKeyword === keyword) {
        activeKeyword = null; 
    } else {
        activeKeyword = keyword; 
    }
    renderKeywords(); 
    displayTranscripts(); 
}

/* Export & Helper Functions */
async function exportPDF() {
    if (!meetingData) return;
    if (typeof jspdf === 'undefined') {
        showErrorModal("PDF 라이브러리 오류");
        return;
    }
    const btn = document.querySelector('.action-btn.primary');
    btn.innerHTML = `생성 중...`;
    btn.disabled = true;
    try {
        const fontPath = '/static/fonts/NotoSansKR-Regular.ttf';
        const fontResponse = await fetch(fontPath);
        if (!fontResponse.ok) throw new Error("폰트 로드 실패");
        const fontBuffer = await fontResponse.arrayBuffer();
        const fontData = btoa(new Uint8Array(fontBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
        const { jsPDF } = jspdf;
        const doc = new jsPDF();
        doc.addFileToVFS('NotoSansKR-Regular.ttf', fontData);
        doc.addFont('NotoSansKR-Regular.ttf', 'NotoSansKR', 'normal');
        doc.setFont('NotoSansKR', 'normal');
        
        const data = {
            title: meetingData.title,
            date: document.getElementById('meetingDate').textContent,
            duration: document.getElementById('meetingDuration').textContent,
            participantCount: meetingData.participantCount,
            participants: meetingData.participants,
            purpose: meetingData.purpose,
            agenda: meetingData.agenda,
            summary: meetingData.summary,
            importance: meetingData.importance,
            keywords: meetingData.keywords,
            actions: meetingData.actions,
            transcripts: meetingData.transcripts.map(t => ({
                name: t.speakerName || t.speakerId,
                time: t.startTime !== undefined ? formatTimeFromMs(t.startTime) : (t.timeLabel || "00:00:00"), 
                text: t.text
            }))
        };
        drawPDF(doc, data);
        doc.save(`${data.title}.pdf`);
    } catch (e) {
        console.error(e);
        showErrorModal("PDF 생성 실패");
    } finally {
        btn.innerHTML = `PDF 다운로드`;
        btn.disabled = false;
    }
}

function drawPDF(doc, data) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    let currentY = 20;
    
    // 1. 헤더 (제목, 일시, 시간, 참석자)
    doc.setFontSize(22); doc.setTextColor(44, 62, 80);
    const titleLines = doc.splitTextToSize(data.title, contentWidth);
    doc.text(titleLines, margin, currentY);
    currentY += (titleLines.length * 10) + 10;
    
    doc.setFontSize(10); doc.setTextColor(100, 100, 100);
    doc.text(`일시: ${data.date}  |  소요 시간: ${data.duration}`, margin, currentY);
    currentY += 6;
    
    doc.text(`참석자(${data.participantCount}명): ${data.participants.join(', ')}`, margin, currentY);
    currentY += 15;
    
    doc.setDrawColor(200, 200, 200); doc.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 15;

    // 2. AI 요약 섹션
    doc.setFontSize(14); doc.setTextColor(0,0,0);
    doc.text("1. AI 요약", margin, currentY);
    currentY += 10;
    doc.setFontSize(11);
    
    const impLevel = (typeof data.importance === 'object') ? data.importance.level : data.importance;
    const reasonText = (typeof data.importance === 'object') ? data.importance.reason : "";
    
    let impColor = [0,0,0];
    const upperImp = String(impLevel).toUpperCase();
    
    if (upperImp === 'HIGH' || upperImp === '높음') impColor = [239, 68, 68];
    else if (upperImp === 'LOW' || upperImp === '낮음') impColor = [234, 179, 8];
    else impColor = [249, 115, 22];
    
    doc.setTextColor(...impColor);
    doc.text(`[중요도: ${impLevel}]`, margin, currentY);
    doc.setTextColor(80, 80, 80);
    
    const reasonLines = doc.splitTextToSize(`- 사유: ${reasonText}`, contentWidth);
    doc.text(reasonLines, margin, currentY + 6);
    currentY += (reasonLines.length * 6) + 10;
    
    const items = [{l:"회의 목적", t: data.purpose}, {l:"주요 안건", t: data.agenda}, {l:"전체 요약", t: data.summary}];
    items.forEach(i => {
        doc.setTextColor(0,0,0); doc.text(`[${i.l}]`, margin, currentY);
        doc.setTextColor(80,80,80);
        const lines = doc.splitTextToSize(i.t || "", contentWidth-5);
        doc.text(lines, margin+5, currentY+6);
        currentY += (lines.length*6) + 10;
        
        if (currentY > pageHeight - margin) { doc.addPage(); currentY = 20; }
    });

    // 하이라이트 키워드 섹션
    doc.setTextColor(0, 0, 0);
    doc.text(`[하이라이트 키워드]`, margin, currentY);
    currentY += 6;
    
    if (data.keywords && data.keywords.length > 0) {
        const keywordStr = data.keywords.map(k => {
            const text = k.text || k;
            const source = k.source ? (String(k.source).toUpperCase() === 'AI' ? '(AI)' : '(User)') : '';
            return `${text} ${source}`;
        }).join(',  ');
        
        const kwLines = doc.splitTextToSize(keywordStr, contentWidth - 5);
        doc.setTextColor(41, 128, 185); 
        doc.text(kwLines, margin + 5, currentY);
        currentY += (kwLines.length * 6) + 10;
    } else {
        doc.setTextColor(150, 150, 150);
        doc.text("키워드 없음", margin + 5, currentY);
        currentY += 10;
    }

    if (currentY > pageHeight - 40) { doc.addPage(); currentY=20; }

    // 액션 아이템 섹션
    doc.setFontSize(14); doc.setTextColor(0,0,0);
    doc.text("2. 액션 아이템", margin, currentY);
    currentY += 8;
    
    if (data.actions && data.actions.length > 0) {
        doc.setFontSize(10);
        data.actions.forEach(a => {
            const sourceTag = (a.source && String(a.source).toUpperCase() === 'AI') ? '[AI]' : '[User]';
            const assignee = a.assignee || "미지정";
            const date = a.dueDate ? a.dueDate.split('T')[0] : "-";
            
            const actionText = `• ${sourceTag} ${a.task} (담당: ${assignee}, 기한: ${date})`;
            const actionLines = doc.splitTextToSize(actionText, contentWidth);
            
            if (currentY + (actionLines.length * 6) > pageHeight - margin) {
                doc.addPage();
                currentY = 20;
            }
            
            doc.text(actionLines, margin, currentY);
            currentY += (actionLines.length * 6) + 2;
        });
    } else {
        doc.setFontSize(10); doc.setTextColor(150, 150, 150);
        doc.text("등록된 액션 아이템이 없습니다.", margin, currentY);
    }
    currentY += 15;

    // 3. 상세 대화 내용
    if (currentY > pageHeight - 40) { doc.addPage(); currentY=20; }
    doc.setFontSize(14); doc.setTextColor(0,0,0);
    doc.text("3. 상세 대화 내용", margin, currentY);
    currentY += 10;
    doc.setFontSize(10);
    
    const speakerColors = {};
    function getRandomColor() {
        const r = Math.floor(Math.random() * 200); 
        const g = Math.floor(Math.random() * 200);
        const b = Math.floor(Math.random() * 200);
        return [r, g, b];
    }
    
    data.transcripts.forEach(t => {
        const name = t.speakerName || t.name || t.speakerId || "Unknown";
        const time = t.time || (t.startTime ? formatTimeFromMs(t.startTime) : "00:00:00");
        const text = t.text || "";

        if(!speakerColors[name]) { 
            speakerColors[name] = getRandomColor(); 
        }
        const thisColor = speakerColors[name];
        
        const textLines = doc.splitTextToSize(text, contentWidth);
        const blockHeight = 5 + (textLines.length * 5) + 8;
        
        if (currentY + blockHeight > pageHeight - margin) {
            doc.addPage();
            currentY = 20; 
        }
        
        const header = `${name} [${time}]`;
        doc.setTextColor(...thisColor); 
        doc.text(header, margin, currentY); 
        currentY += 5;
        
        doc.setTextColor(0,0,0);
        doc.text(textLines, margin, currentY); 
        currentY += (textLines.length * 5) + 8;
    });
}

function goToEdit() {
    const urlParams = new URLSearchParams(window.location.search);
    window.location.href = `recordFinish.html?meetingId=${urlParams.get('id')}`;
}

/* ==================================================
   삭제 관련 함수 (모달 띄우기)
   ================================================== */

function deleteMeeting() {
    if (!meetingData || !meetingData.id) return;
    
    // 모달 띄우기 (hidden 클래스 제거)
    const modal = document.getElementById('deleteConfirmModal');
    if (modal) {
        modal.classList.remove('hidden');
    }
}

/* 삭제 모달 닫기 */
function closeDeleteModal() {
    const modal = document.getElementById('deleteConfirmModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

/* [중요] 삭제 확인 -> 성공 모달 표시 로직 */
async function confirmDeleteProcess() {
    // 1. 먼저 삭제 확인 모달(빨간색 창)을 닫습니다.
    closeDeleteModal();

    if (!meetingData || !meetingData.id) return;

    try {
        const response = await fetch(`http://dialogai.duckdns.org:8080/api/meetings/${meetingData.id}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        if (response.ok) {
            // 2. 성공 시 alert 대신 성공 모달(보라색)을 띄웁니다.
            const successModal = document.getElementById('deleteSuccessModal');
            if (successModal) {
                successModal.classList.remove('hidden');
            }
        } else {
            throw new Error("삭제 실패");
        }
    } catch (error) {
        console.error(error);
        showErrorModal("삭제 중 오류가 발생했습니다.");
    }
}

/* [중요] 성공 모달 닫기 -> 목록 페이지 이동 */
function closeSuccessModal() {
    const modal = document.getElementById('deleteSuccessModal');
    if (modal) {
        modal.classList.add('hidden');
    }
    // 확인 버튼을 누르면 목록 페이지로 이동
    window.location.href = 'meetings.html'; 
}

function formatDuration(sec) {
    if(!sec) return "00:00:00";
    const h = Math.floor(sec/3600);
    const m = Math.floor((sec%3600)/60);
    const s = Math.floor(sec%60);
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function formatTimeFromMs(ms) {
    if (!ms && ms !== 0) return "00:00:00";
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function getSpeakerColor(index) {
    const hue = (index * 137.5) % 360;
    return `hsl(${hue}, 65%, 40%)`;
}
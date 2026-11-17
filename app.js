/**
 * NWC204 - Computer Networking (CCNA 1 - ITN) Review App Logic
 * Premium interactive platform with Shuffle, Multi-select support, Bookmarks, and LocalStorage persistence.
 */

// Global State
const STORAGE_KEY_ANSWERS = 'nwc204_user_answers_v1';
const STORAGE_KEY_BOOKMARKS = 'nwc204_bookmarked_ids_v1';

let userAnswers = {}; // { [examId]: { [questionId]: { selected: ['A'], isCorrect: true } } }
let savedQuestionIds = new Set(); // Set of question IDs

let currentExamId = null;
let currentExam = null;
let activeQuestions = []; // Active list (can be original or shuffled)
let originalQuestions = []; // Backup of original order
let currentQuestionIndex = 0;
let isShuffled = false;
let currentFilter = 'all'; // 'all' | 'unanswered' | 'wrong' | 'saved'
let pendingMultiSelect = new Set(); // Set of selected labels for multi-choice

// Load from LocalStorage
function loadLocalStorage() {
    try {
        const storedAns = localStorage.getItem(STORAGE_KEY_ANSWERS);
        if (storedAns) userAnswers = JSON.parse(storedAns);

        const storedBm = localStorage.getItem(STORAGE_KEY_BOOKMARKS);
        if (storedBm) savedQuestionIds = new Set(JSON.parse(storedBm));
    } catch (e) {
        console.warn('Could not load from localStorage:', e);
    }
}

function saveLocalStorage() {
    try {
        localStorage.setItem(STORAGE_KEY_ANSWERS, JSON.stringify(userAnswers));
        localStorage.setItem(STORAGE_KEY_BOOKMARKS, JSON.stringify(Array.from(savedQuestionIds)));
    } catch (e) {
        console.warn('Could not save to localStorage:', e);
    }
}

// Toast Notification
let toastTimeout = null;
function showToast(msg, duration = 2500) {
    const toast = document.getElementById('toastNotification');
    const toastText = document.getElementById('toastMessage');
    if (!toast || !toastText) return;

    toastText.textContent = msg;
    toast.style.display = 'block';

    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.style.display = 'none';
    }, duration);
}

// Format Cisco CLI commands & keywords in question text
function formatQuestionContent(text) {
    if (!text) return '';
    // Wrap common Cisco CLI commands and IP formats in <code>
    return text
        .replace(/\b(ip address [^\s]+ [^\s]+)/gi, '<code>$1</code>')
        .replace(/\b(line console 0|line vty 0 \d|configure terminal|copy running-config startup-config|show ip interface brief|show interfaces|show ip route|no shutdown|service password-encryption|enable secret [^\s]+|enable password [^\s]+|transport input ssh|login|arp -a|ping|traceroute|tracert|nslookup)\b/gi, '<code>$1</code>')
        .replace(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?:\/\d{1,2})?)\b/g, '<code>$1</code>')
        .replace(/\b(fe80::[0-9a-fA-F:]*|2001:db8:[0-9a-fA-F:]*(?:\/\d{1,2})?|::1)\b/g, '<code>$1</code>');
}

/* ==========================================================================
   DASHBOARD LOGIC
   ========================================================================== */
function renderDashboard() {
    const container = document.getElementById('examCardsContainer');
    if (!container || typeof NWC204_EXAMS === 'undefined') return;

    container.innerHTML = '';
    let totalAllDone = 0;
    let totalAllCorrect = 0;
    let totalAllWrong = 0;

    NWC204_EXAMS.forEach((exam, idx) => {
        const examAns = userAnswers[exam.id] || {};
        const totalQ = exam.questions.length;
        let doneCount = 0;
        let correctCount = 0;
        let wrongCount = 0;

        exam.questions.forEach(q => {
            const ans = examAns[q.id];
            if (ans) {
                doneCount++;
                if (ans.isCorrect) correctCount++;
                else wrongCount++;
            }
        });

        // Tally for non-comprehensive sets
        if (exam.id !== 'exam_all') {
            totalAllDone += doneCount;
            totalAllCorrect += correctCount;
            totalAllWrong += wrongCount;
        }

        const percent = totalQ > 0 ? Math.round((doneCount / totalQ) * 100) : 0;
        const accuracy = doneCount > 0 ? Math.round((correctCount / doneCount) * 100) : 0;

        let statusText = 'Chưa làm';
        let statusClass = 'status-not-started';
        if (doneCount === totalQ) {
            statusText = 'Hoàn thành';
            statusClass = 'status-completed';
        } else if (doneCount > 0) {
            statusText = `Đang làm (${doneCount}/${totalQ})`;
            statusClass = 'status-in-progress';
        }

        const isComp = exam.id === 'exam_all';
        const card = document.createElement('div');
        card.className = `exam-card ${isComp ? 'is-comprehensive' : ''}`;

        card.innerHTML = `
            <div>
                <div class="exam-card-header">
                    <span class="exam-badge-tag">${isComp ? '⚡ TỔNG HỢP 249 CÂU' : exam.code}</span>
                    <span class="exam-status-tag ${statusClass}">${statusText}</span>
                </div>
                <h3 class="exam-card-title">${exam.title}</h3>
                <p class="exam-card-desc">
                    Gồm <strong>${totalQ} câu hỏi trắc nghiệm</strong>. Đúng: <span style="color: var(--accent-success); font-weight:700;">${correctCount}</span> • Sai: <span style="color: var(--accent-wrong); font-weight:700;">${wrongCount}</span> ${doneCount > 0 ? `• Chính xác: ${accuracy}%` : ''}
                </p>
                <div class="exam-card-progress">
                    <div class="card-progress-labels">
                        <span>Tiến độ</span>
                        <span>${percent}%</span>
                    </div>
                    <div class="progress-track">
                        <div class="progress-bar-fill" style="width: ${percent}%;"></div>
                    </div>
                </div>
            </div>
            <div class="exam-card-actions">
                <button class="btn-start-exam" data-exam-id="${exam.id}">
                    <span>${doneCount > 0 ? '▶ Tiếp tục ôn tập' : '🚀 Bắt đầu làm bài'}</span>
                </button>
                ${doneCount > 0 ? `<button class="btn-reset-card" data-exam-id="${exam.id}" title="Làm lại đề này">🔄</button>` : ''}
            </div>
        `;

        container.appendChild(card);
    });

    // Update Global Stats
    const totalGlobalPool = 249;
    document.getElementById('statTotalDone').textContent = `${totalAllDone} / ${totalGlobalPool}`;
    const globalAcc = totalAllDone > 0 ? Math.round((totalAllCorrect / totalAllDone) * 100) : 0;
    document.getElementById('statAccuracy').textContent = `${globalAcc}%`;
    document.getElementById('statTotalWrong').textContent = totalAllWrong;
    document.getElementById('statTotalSaved').textContent = savedQuestionIds.size;

    // Attach Start & Reset Listeners
    container.querySelectorAll('.btn-start-exam').forEach(btn => {
        btn.addEventListener('click', () => {
            const eid = btn.dataset.examId;
            startExam(eid);
        });
    });

    container.querySelectorAll('.btn-reset-card').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const eid = btn.dataset.examId;
            if (confirm(`Bạn có chắc muốn xóa toàn bộ kết quả của đề này và làm lại từ đầu không?`)) {
                delete userAnswers[eid];
                saveLocalStorage();
                renderDashboard();
                showToast('Đã xóa dữ liệu đề thi thành công!');
            }
        });
    });
}

/* ==========================================================================
   START / SWITCH EXAM VIEW
   ========================================================================== */
function startExam(examId) {
    currentExamId = examId;
    currentExam = NWC204_EXAMS.find(e => e.id === examId);
    if (!currentExam) return;

    originalQuestions = [...currentExam.questions];
    activeQuestions = [...originalQuestions];
    currentQuestionIndex = 0;
    isShuffled = false;
    currentFilter = 'all';
    pendingMultiSelect.clear();

    // Switch Views
    document.getElementById('dashboardView').style.display = 'none';
    document.getElementById('practiceView').style.display = 'block';
    document.getElementById('headerExamTitleWrap').style.display = 'flex';

    // Header badge
    document.getElementById('navExamBadge').textContent = currentExam.code;
    document.getElementById('navExamTitle').textContent = currentExam.shortTitle;
    document.getElementById('examCurrentTitle').textContent = currentExam.title;

    // Reset Shuffle UI
    updateShuffleUI();

    // Render Question & Matrix
    updateFilterCounts();
    renderQuestionGrid();
    renderCurrentQuestion();
    updateRightSidebarStats();

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function returnToDashboard() {
    currentExamId = null;
    currentExam = null;
    document.getElementById('practiceView').style.display = 'none';
    document.getElementById('dashboardView').style.display = 'block';
    document.getElementById('headerExamTitleWrap').style.display = 'none';

    renderDashboard();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ==========================================================================
   SHUFFLE & RESTORE LOGIC
   ========================================================================== */
function shuffleQuestions() {
    if (!currentExam) return;
    
    // Fisher-Yates Shuffle
    for (let i = activeQuestions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [activeQuestions[i], activeQuestions[j]] = [activeQuestions[j], activeQuestions[i]];
    }

    isShuffled = true;
    currentQuestionIndex = 0;
    pendingMultiSelect.clear();

    updateShuffleUI();
    renderQuestionGrid();
    renderCurrentQuestion();
    showToast(`🔀 Đã tráo đổi ngẫu nhiên ${activeQuestions.length} câu hỏi!`);
}

function restoreOriginalOrder() {
    if (!currentExam) return;

    activeQuestions = [...originalQuestions];
    isShuffled = false;
    currentQuestionIndex = 0;
    pendingMultiSelect.clear();

    updateShuffleUI();
    renderQuestionGrid();
    renderCurrentQuestion();
    showToast(`↺ Đã khôi phục về thứ tự gốc 1 đến ${activeQuestions.length}!`);
}

function updateShuffleUI() {
    const btnRestore = document.getElementById('btnRestoreOrder');
    const badge = document.getElementById('shuffleStatusBadge');

    if (isShuffled) {
        btnRestore.style.display = 'inline-flex';
        badge.textContent = 'Đã xáo trộn 🔀';
        badge.classList.add('is-shuffled');
    } else {
        btnRestore.style.display = 'none';
        badge.textContent = 'Thứ tự chuẩn';
        badge.classList.remove('is-shuffled');
    }
}

/* ==========================================================================
   QUESTION FILTERING & MATRIX
   ========================================================================== */
function getFilteredQuestions() {
    if (!currentExam) return [];
    const examAns = userAnswers[currentExam.id] || {};

    return activeQuestions.filter(q => {
        const ans = examAns[q.id];
        const isSaved = savedQuestionIds.has(q.id);

        if (currentFilter === 'unanswered') return !ans;
        if (currentFilter === 'wrong') return ans && !ans.isCorrect;
        if (currentFilter === 'saved') return isSaved;
        return true;
    });
}

function updateFilterCounts() {
    if (!currentExam) return;
    const examAns = userAnswers[currentExam.id] || {};

    let total = activeQuestions.length;
    let unans = 0;
    let wrong = 0;
    let saved = 0;

    activeQuestions.forEach(q => {
        const ans = examAns[q.id];
        if (!ans) unans++;
        else if (!ans.isCorrect) wrong++;
        if (savedQuestionIds.has(q.id)) saved++;
    });

    document.getElementById('countAll').textContent = total;
    document.getElementById('countUnanswered').textContent = unans;
    document.getElementById('countWrong').textContent = wrong;
    document.getElementById('countSaved').textContent = saved;
}

function renderQuestionGrid() {
    if (!currentExam) return;
    const gridDesktop = document.getElementById('questionMatrix');
    const gridMobile = document.getElementById('questionMatrixMobile');
    if (!gridDesktop) return;

    gridDesktop.innerHTML = '';
    if (gridMobile) gridMobile.innerHTML = '';

    const examAns = userAnswers[currentExam.id] || {};

    activeQuestions.forEach((q, idx) => {
        const isSaved = savedQuestionIds.has(q.id);
        const ans = examAns[q.id];

        // Filter check for visibility in matrix
        let isVisible = true;
        if (currentFilter === 'unanswered' && ans) isVisible = false;
        if (currentFilter === 'wrong' && (!ans || ans.isCorrect)) isVisible = false;
        if (currentFilter === 'saved' && !isSaved) isVisible = false;

        const box = document.createElement('div');
        box.className = 'matrix-item';
        box.textContent = idx + 1;
        box.dataset.index = idx;

        if (idx === currentQuestionIndex) box.classList.add('current');
        if (ans) {
            box.classList.add(ans.isCorrect ? 'correct' : 'wrong');
        }
        if (isSaved) box.classList.add('saved');
        if (!isVisible) box.style.opacity = '0.25';

        const clickHandler = () => {
            currentQuestionIndex = idx;
            renderCurrentQuestion();
            highlightMatrixCurrent();
            closeMobileMatrix();
        };

        box.addEventListener('click', clickHandler);
        gridDesktop.appendChild(box);

        if (gridMobile) {
            const mobBox = box.cloneNode(true);
            mobBox.addEventListener('click', clickHandler);
            gridMobile.appendChild(mobBox);
        }
    });

    // Update progress text in sidebar
    let answeredCount = Object.keys(examAns).length;
    document.getElementById('sidebarProgressText').textContent = `${answeredCount} / ${activeQuestions.length}`;
}

function highlightMatrixCurrent() {
    document.querySelectorAll('.matrix-item').forEach(box => {
        const idx = parseInt(box.dataset.index);
        if (idx === currentQuestionIndex) {
            box.classList.add('current');
            box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else {
            box.classList.remove('current');
        }
    });
}

/* ==========================================================================
   RENDER CURRENT QUESTION
   ========================================================================== */
function renderCurrentQuestion() {
    if (!currentExam || activeQuestions.length === 0) return;
    const q = activeQuestions[currentQuestionIndex];
    if (!q) return;

    pendingMultiSelect.clear();
    highlightMatrixCurrent();

    // 1. Question Number & Meta
    document.getElementById('qNumberPill').textContent = `CÂU ${currentQuestionIndex + 1} / ${activeQuestions.length}`;
    document.getElementById('qCategoryPill').textContent = q.category || 'CCNA ITN';
    document.getElementById('examProgressCount').textContent = `Câu ${currentQuestionIndex + 1} / ${activeQuestions.length}`;

    // 2. Question Type & Notice
    const typePill = document.getElementById('qTypePill');
    const multiNotice = document.getElementById('multiChoiceNotice');
    const multiNoticeText = document.getElementById('multiChoiceNoticeText');
    const multiSubmitWrapper = document.getElementById('multiSubmitWrapper');

    if (q.is_multiple) {
        const count = q.required_count || 2;
        typePill.textContent = `⚡ Chọn ${count} đáp án`;
        typePill.style.background = 'rgba(245, 158, 11, 0.2)';
        typePill.style.color = '#fbbf24';

        multiNotice.style.display = 'flex';
        multiNoticeText.textContent = `Câu hỏi này yêu cầu chọn ${count} đáp án đúng. Hãy tích chọn đủ các phương án và bấm "Xác nhận đáp án".`;
        document.getElementById('requiredCountText').textContent = count;
        document.getElementById('selectedCountText').textContent = '0';
    } else {
        typePill.textContent = `⚡ Chọn 1 đáp án`;
        typePill.style.background = 'rgba(59, 130, 246, 0.15)';
        typePill.style.color = '#60a5fa';

        multiNotice.style.display = 'none';
        multiSubmitWrapper.style.display = 'none';
    }

    // 3. Bookmark state
    const btnBm = document.getElementById('btnBookmark');
    const isSaved = savedQuestionIds.has(q.id);
    if (isSaved) {
        btnBm.classList.add('active');
        btnBm.querySelector('.bookmark-label').textContent = 'Đã lưu ⭐';
    } else {
        btnBm.classList.remove('active');
        btnBm.querySelector('.bookmark-label').textContent = 'Lưu câu này';
    }

    // 4. Question Text with Cisco Code highlighting
    document.getElementById('questionText').innerHTML = formatQuestionContent(q.question);

    // 5. Existing Answer Check
    const examAns = userAnswers[currentExam.id] || {};
    const existingAns = examAns[q.id];

    // 6. Render Options
    const optContainer = document.getElementById('optionsContainer');
    optContainer.innerHTML = '';

    const correctLetters = new Set(q.correct_answers || [q.correct_answer]);

    q.options.forEach(opt => {
        const row = document.createElement('div');
        row.className = 'option-row';
        row.dataset.label = opt.label;

        row.innerHTML = `
            <div class="option-letter-badge">${opt.label}</div>
            <div class="option-text-body">${formatQuestionContent(opt.content)}</div>
        `;

        // If question was already answered, reveal state & lock
        if (existingAns) {
            row.classList.add('locked');
            const wasSelected = existingAns.selected.includes(opt.label);
            const isCorrect = correctLetters.has(opt.label);

            if (isCorrect) {
                row.classList.add('is-correct');
            } else if (wasSelected && !isCorrect) {
                row.classList.add('is-wrong');
            }
        } else {
            // Interactive click handler
            row.addEventListener('click', () => {
                handleOptionClick(q, opt.label, row);
            });
        }

        optContainer.appendChild(row);
    });

    // 7. Multi-choice submit button visibility
    if (q.is_multiple && !existingAns) {
        multiSubmitWrapper.style.display = 'block';
        updateMultiSubmitButton(q);
    } else {
        multiSubmitWrapper.style.display = 'none';
    }

    // 8. Explanation Card
    const expCard = document.getElementById('explanationCard');
    const expText = document.getElementById('explanationText');
    if (existingAns) {
        expCard.style.display = 'block';
        expText.innerHTML = `
            <div style="margin-bottom: 8px;"><strong>Đáp án đúng:</strong> <span style="color: var(--accent-success); font-weight: 800;">${Array.from(correctLetters).join(', ')}</span></div>
            <div>${q.explanation || 'Không có giải thích chi tiết cho câu hỏi này.'}</div>
        `;
    } else {
        expCard.style.display = 'none';
    }

    // 9. Prev / Next Navigation buttons
    document.getElementById('btnPrevQ').disabled = currentQuestionIndex === 0;
    document.getElementById('btnNextQ').disabled = currentQuestionIndex === activeQuestions.length - 1;

    updateRightSidebarStats();
}

/* ==========================================================================
   OPTION SELECTION & ANSWER PROCESSING
   ========================================================================== */
function handleOptionClick(q, label, rowElement) {
    const examAns = userAnswers[currentExam.id] || {};
    if (examAns[q.id]) return; // Already locked

    if (!q.is_multiple) {
        // Single Choice: Check Immediately!
        processUserAnswer(q, [label]);
    } else {
        // Multi-choice: Toggle Selection
        if (pendingMultiSelect.has(label)) {
            pendingMultiSelect.delete(label);
            rowElement.classList.remove('is-selected-pending');
        } else {
            const req = q.required_count || 2;
            if (pendingMultiSelect.size < req) {
                pendingMultiSelect.add(label);
                rowElement.classList.add('is-selected-pending');
            } else {
                showToast(`Bạn chỉ được chọn tối đa ${req} đáp án!`);
            }
        }
        updateMultiSubmitButton(q);
    }
}

function updateMultiSubmitButton(q) {
    const btn = document.getElementById('btnConfirmMulti');
    const selectedCount = pendingMultiSelect.size;
    const required = q.required_count || 2;

    document.getElementById('selectedCountText').textContent = selectedCount;
    document.getElementById('requiredCountText').textContent = required;

    if (selectedCount === required) {
        btn.disabled = false;
    } else {
        btn.disabled = true;
    }
}

function processUserAnswer(q, selectedLabels) {
    if (!currentExam) return;

    if (!userAnswers[currentExam.id]) {
        userAnswers[currentExam.id] = {};
    }

    const correctSet = new Set(q.correct_answers || [q.correct_answer]);
    let isAllCorrect = true;

    if (selectedLabels.length !== correctSet.size) {
        isAllCorrect = false;
    } else {
        for (const l of selectedLabels) {
            if (!correctSet.has(l)) {
                isAllCorrect = false;
                break;
            }
        }
    }

    // Save answer
    userAnswers[currentExam.id][q.id] = {
        selected: selectedLabels,
        isCorrect: isAllCorrect,
        timestamp: Date.now()
    };
    saveLocalStorage();

    // Re-render question & matrix
    renderCurrentQuestion();
    renderQuestionGrid();
    updateFilterCounts();
    updateRightSidebarStats();

    if (isAllCorrect) {
        showToast('🎉 Chính xác! Đáp án hoàn toàn đúng.');
    } else {
        showToast('❌ Sai rồi! Hãy đọc giải thích bên dưới nhé.');
    }
}

/* ==========================================================================
   RIGHT SIDEBAR PROGRESS & METRICS
   ========================================================================== */
function updateRightSidebarStats() {
    if (!currentExam) return;
    const examAns = userAnswers[currentExam.id] || {};
    const total = activeQuestions.length;

    let correct = 0;
    let wrong = 0;
    let saved = 0;

    activeQuestions.forEach(q => {
        const ans = examAns[q.id];
        if (ans) {
            if (ans.isCorrect) correct++;
            else wrong++;
        }
        if (savedQuestionIds.has(q.id)) saved++;
    });

    const answered = Object.keys(examAns).length;
    const percent = total > 0 ? Math.round((answered / total) * 100) : 0;

    document.getElementById('examLinearProgress').style.width = `${percent}%`;
    document.getElementById('examPercentText').textContent = `${percent}%`;

    document.getElementById('metricAnswered').textContent = `${answered} / ${total}`;
    document.getElementById('metricCorrect').textContent = correct;
    document.getElementById('metricWrong').textContent = wrong;
    document.getElementById('metricSaved').textContent = saved;
}

/* ==========================================================================
   MOBILE MATRIX MODAL
   ========================================================================== */
function openMobileMatrix() {
    const modal = document.getElementById('mobileMatrixModal');
    if (modal) modal.style.display = 'flex';
}

function closeMobileMatrix() {
    const modal = document.getElementById('mobileMatrixModal');
    if (modal) modal.style.display = 'none';
}

/* ==========================================================================
   EVENT LISTENERS SETUP
   ========================================================================== */
function initEvents() {
    // Navigation
    document.getElementById('brandHome').addEventListener('click', returnToDashboard);
    document.getElementById('btnBackToHome').addEventListener('click', returnToDashboard);

    // Reset All Data
    document.getElementById('btnResetAll').addEventListener('click', () => {
        if (confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử làm bài và các câu đã lưu không?')) {
            userAnswers = {};
            savedQuestionIds.clear();
            saveLocalStorage();
            if (currentExamId) {
                returnToDashboard();
            } else {
                renderDashboard();
            }
            showToast('Đã đặt lại toàn bộ hệ thống!');
        }
    });

    // Reset Current Exam
    document.getElementById('btnResetCurrentExam').addEventListener('click', () => {
        if (!currentExam) return;
        if (confirm(`Bạn có muốn xóa toàn bộ kết quả của ${currentExam.shortTitle} để làm lại không?`)) {
            delete userAnswers[currentExam.id];
            saveLocalStorage();
            currentQuestionIndex = 0;
            renderQuestionGrid();
            renderCurrentQuestion();
            updateFilterCounts();
            showToast('Đã làm mới đề thi!');
        }
    });

    // Shuffle & Restore
    document.getElementById('btnShuffle').addEventListener('click', shuffleQuestions);
    document.getElementById('btnRestoreOrder').addEventListener('click', restoreOriginalOrder);

    // Bookmark Question
    document.getElementById('btnBookmark').addEventListener('click', () => {
        if (!currentExam) return;
        const q = activeQuestions[currentQuestionIndex];
        if (!q) return;

        if (savedQuestionIds.has(q.id)) {
            savedQuestionIds.delete(q.id);
            showToast('Đã bỏ lưu câu hỏi này');
        } else {
            savedQuestionIds.add(q.id);
            showToast('⭐ Đã lưu câu hỏi vào danh sách ôn tập');
        }
        saveLocalStorage();
        renderCurrentQuestion();
        renderQuestionGrid();
        updateFilterCounts();
    });

    // Confirm Multi-choice
    document.getElementById('btnConfirmMulti').addEventListener('click', () => {
        if (!currentExam) return;
        const q = activeQuestions[currentQuestionIndex];
        if (!q || !q.is_multiple) return;

        if (pendingMultiSelect.size !== (q.required_count || 2)) {
            showToast(`Hãy chọn đủ ${q.required_count || 2} phương án trước khi bấm xác nhận!`);
            return;
        }

        processUserAnswer(q, Array.from(pendingMultiSelect).sort());
    });

    // Prev / Next Navigation
    document.getElementById('btnPrevQ').addEventListener('click', () => {
        if (currentQuestionIndex > 0) {
            currentQuestionIndex--;
            renderCurrentQuestion();
        }
    });

    document.getElementById('btnNextQ').addEventListener('click', () => {
        if (currentQuestionIndex < activeQuestions.length - 1) {
            currentQuestionIndex++;
            renderCurrentQuestion();
        }
    });

    // Filter Mode Pills
    document.querySelectorAll('.filter-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            currentFilter = pill.dataset.filter;

            // Find first matching question in this filter
            const filtered = getFilteredQuestions();
            if (filtered.length > 0) {
                const targetId = filtered[0].id;
                const idx = activeQuestions.findIndex(q => q.id === targetId);
                if (idx !== -1) currentQuestionIndex = idx;
            }

            renderQuestionGrid();
            renderCurrentQuestion();
        });
    });

    // Mobile Matrix Drawer
    document.getElementById('btnToggleMobileMatrix').addEventListener('click', openMobileMatrix);
    document.getElementById('btnCloseMobileMatrix').addEventListener('click', closeMobileMatrix);
    document.getElementById('mobileMatrixBackdrop').addEventListener('click', closeMobileMatrix);

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
        // If not in practice view, ignore
        if (!currentExam || document.getElementById('practiceView').style.display === 'none') return;

        // Arrow keys for Next / Prev
        if (e.key === 'ArrowLeft') {
            if (currentQuestionIndex > 0) {
                currentQuestionIndex--;
                renderCurrentQuestion();
            }
        } else if (e.key === 'ArrowRight') {
            if (currentQuestionIndex < activeQuestions.length - 1) {
                currentQuestionIndex++;
                renderCurrentQuestion();
            }
        }

        // Keys 1, 2, 3, 4, 5, 6 or A, B, C, D, E, F
        const q = activeQuestions[currentQuestionIndex];
        if (!q) return;

        let letter = null;
        if (e.key >= '1' && e.key <= '6') {
            const num = parseInt(e.key);
            letter = String.fromCharCode(64 + num); // 1->A, 2->B...
        } else if (['a', 'b', 'c', 'd', 'e', 'f'].includes(e.key.toLowerCase())) {
            letter = e.key.toUpperCase();
        }

        if (letter) {
            const optRow = document.querySelector(`.option-row[data-label="${letter}"]`);
            if (optRow) optRow.click();
        }

        // Enter to confirm multi-choice
        if (e.key === 'Enter' && q.is_multiple) {
            const btn = document.getElementById('btnConfirmMulti');
            if (btn && !btn.disabled) btn.click();
        }
    });
}

// Initialization on DOM Loaded
document.addEventListener('DOMContentLoaded', () => {
    loadLocalStorage();
    initEvents();
    renderDashboard();
});

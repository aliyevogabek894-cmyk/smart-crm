// ═══════════════════════════════════════════════════
// Smart Nazorat CRM — Asosiy Script
// Barcha xatolar tuzatilgan, sinxronizatsiya to'liq
// ═══════════════════════════════════════════════════

// ─── XSS Himoya ───
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ─── DOM Elements ───
const loginScreen = document.getElementById('loginScreen');
const appContainer = document.getElementById('appContainer');
const adminContainer = document.getElementById('adminContainer');
const loginForm = document.getElementById('loginForm');
const loginInput = document.getElementById('loginInput');
const passwordInput = document.getElementById('passwordInput');
const loginError = document.getElementById('loginError');

// ─── Data Paths ───
let currentUserDoc = "main";
let currentSnapshotUnsubscribe = null;

// ─── Login Logic ───
async function initializeApp() {
    const isAdmin = sessionStorage.getItem('is_admin') === 'true';
    const loggedIn = sessionStorage.getItem('smart_logged_in') === 'true';
    const username = sessionStorage.getItem('smart_username');

    if (loggedIn && username) {
        if (loginScreen) loginScreen.style.display = 'none';
        
        if (isAdmin && !sessionStorage.getItem('viewing_as_admin')) {
            if (adminContainer) adminContainer.style.display = 'block';
            if (appContainer) appContainer.style.display = 'none';
            loadAdminUsers();
        } else {
            if (adminContainer) adminContainer.style.display = 'none';
            if (appContainer) appContainer.style.display = 'block';
            currentUserDoc = username;
            
            const nameSpan = document.getElementById('currentUsernameSpan');
            if (nameSpan) nameSpan.innerText = username;

            const retBtn = document.getElementById('adminReturnBtn');
            if (retBtn) retBtn.style.display = isAdmin ? 'block' : 'none';
            
            loadData();
        }
    } else {
        if (loginScreen) loginScreen.style.display = 'flex';
    }
}

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const enteredLogin = loginInput ? loginInput.value.trim().toLowerCase() : '';
        const enteredPass = passwordInput.value.trim();
        
        // Admin Master Check
        if (enteredLogin === 'admin' && enteredPass === '2225') {
            sessionStorage.setItem('smart_logged_in', 'true');
            sessionStorage.setItem('smart_username', 'admin');
            sessionStorage.setItem('is_admin', 'true');
            sessionStorage.removeItem('viewing_as_admin');
            
            loginScreen.style.display = 'none';
            adminContainer.style.display = 'block';
            loadAdminUsers();
            return;
        }

        // Tizimdan qidirish
        const loadingBtn = loginForm.querySelector('button');
        const oldText = loadingBtn.innerText;
        loadingBtn.innerText = "Tekshirilmoqda...";
        loadingBtn.disabled = true;

        try {
            const docRef = db.collection("crmSettings").doc("users");
            const docSnap = await docRef.get();
            let users = [];
            if (docSnap.exists) {
                users = docSnap.data().list || [];
            }
            
            const user = users.find(u => u.login === enteredLogin && u.password === enteredPass);
            if (user) {
                sessionStorage.setItem('smart_logged_in', 'true');
                sessionStorage.setItem('smart_username', user.login);
                sessionStorage.setItem('is_admin', 'false');
                sessionStorage.removeItem('viewing_as_admin');
                
                loginScreen.style.display = 'none';
                appContainer.style.display = 'block';
                currentUserDoc = user.login;
                loadData();
            } else {
                loginError.style.display = 'block';
                setTimeout(() => { loginError.style.display = 'none'; }, 3000);
            }
        } catch (err) {
            console.error(err);
            alert("Internet yoki baza xatoligi!");
        } finally {
            loadingBtn.innerText = oldText;
            loadingBtn.disabled = false;
        }
    });
}

function logout() {
    sessionStorage.clear();
    location.reload();
}

function returnToAdminPanel() {
    sessionStorage.removeItem('viewing_as_admin');
    if(currentSnapshotUnsubscribe) currentSnapshotUnsubscribe();
    location.reload();
}

window.logout = logout;
window.returnToAdminPanel = returnToAdminPanel;

// ─── Tungi Rejim Boshqaruvi ───
function initTheme() {
    const savedTheme = localStorage.getItem('smart_theme') || 'light';
    document.documentElement.setAttribute('data-bs-theme', savedTheme);
    updateThemeBtn(savedTheme);
}

window.toggleTheme = () => {
    const currentTheme = document.documentElement.getAttribute('data-bs-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-bs-theme', newTheme);
    localStorage.setItem('smart_theme', newTheme);
    updateThemeBtn(newTheme);
};

function updateThemeBtn(theme) {
    const btn = document.getElementById('themeToggleBtn');
    if (btn) {
        if (theme === 'dark') {
            btn.innerHTML = '<i class="fas fa-sun me-1"></i> Kun';
            btn.classList.remove('btn-outline-secondary');
            btn.classList.add('btn-outline-light');
        } else {
            btn.innerHTML = '<i class="fas fa-moon me-1"></i> Tun';
            btn.classList.remove('btn-outline-light');
            btn.classList.add('btn-outline-secondary');
        }
    }
}

document.addEventListener('DOMContentLoaded', initTheme);

// ─── Eski localStorage ni bir marta tozalash ───
localStorage.removeItem('smart_students');
localStorage.removeItem('smart_classes');
localStorage.removeItem('smart_data');

// ─── Firebase Setup ───
const firebaseConfig = {
    apiKey: "AIzaSyBOEZGzczHy9njwXDtNA7TlM-vEzngbFDw",
    authDomain: "domla-aliyev.firebaseapp.com",
    projectId: "domla-aliyev",
    storageBucket: "domla-aliyev.firebasestorage.app",
    messagingSenderId: "762189436245",
    appId: "1:762189436245:web:78132d7e3e036b942d4bdc",
    measurementId: "G-PLR0EHDC9Q"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// Firestore offline persistence yoqish — sinxronizatsiya uchun muhim
db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
    console.warn("Persistence xatolik:", err.code);
});

// ─── Application State ───
let students = [];
let classes = [];
let currentClassFilter = 'all';
let isSaving = false;
let dataLoaded = false;
let userProfile = { name: '', subject: '', avatar: '' };
let pendingAvatarData = null;

// ─── Sync Indicator ───
const syncIndicator = document.getElementById('syncIndicator');
let syncTimeout = null;

function showSyncStatus(type, text) {
    if (!syncIndicator) return;
    syncIndicator.className = 'sync-indicator show ' + type;
    syncIndicator.innerHTML = type === 'saving'
        ? `<span class="sync-dot"></span> ${escapeHtml(text)}`
        : text;
    clearTimeout(syncTimeout);
    if (type !== 'saving') {
        syncTimeout = setTimeout(() => {
            syncIndicator.classList.remove('show');
        }, 2500);
    }
}

// ─── Load Data from Firebase ───
async function loadData() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) loadingOverlay.style.display = 'flex';

    try {
        const docRef = db.collection("crmData").doc(currentUserDoc);
        const docSnap = await docRef.get();

        if (docSnap.exists) {
            const data = docSnap.data();
            students = data.students || [];
            classes = data.classes || [];
            userProfile = data.profile || { name: currentUserDoc, subject: 'Mutaxassislik kiritilmagan', avatar: '' };
        } else {
            userProfile = { name: currentUserDoc, subject: 'Mutaxassislik kiritilmagan', avatar: '' };
        }

        // Migrate: agar class bo'sh bo'lsa, studentlardan olish
        if (classes.length === 0 && students.length > 0) {
            classes = [...new Set(students.map(s => s.classGroup || 'Asosiy'))];
            if (classes.length === 0) classes = ['Asosiy'];
            await saveStudentsToFirebase();
        }

        dataLoaded = true;
        renderClassOptions();
        renderUrgentBadges();
        renderProfileDisplay();
        render();
    } catch (e) {
        console.error("Firebase'dan o'qishda xatolik:", e);
        showSyncStatus('error', '❌ Server bilan bog\'lanib bo\'lmadi');
    } finally {
        if (loadingOverlay) loadingOverlay.style.display = 'none';
    }

    // ═══ REALTIME LISTENER — Sinxronizatsiya kaliti ═══
    // hasPendingWrites tekshiruvi — telefondan yoki kompyuterdan
    // o'zgarish bo'lganda to'g'ri ishlashini ta'minlaydi
    currentSnapshotUnsubscribe = db.collection("crmData").doc(currentUserDoc).onSnapshot((doc) => {
        // Faqat serverdan tasdiqlangan o'zgarishlarni qabul qilish
        // hasPendingWrites = true bo'lsa, bu bizning local yozuvimiz,
        // uni e'tiborsiz qoldiramiz chunki biz allaqachon local state'ni yangilaganmiz
        if (doc.exists && !doc.metadata.hasPendingWrites) {
            const data = doc.data();
            students = data.students || [];
            classes = data.classes || [];
            if (data.profile) {
                userProfile = data.profile;
            }

            if (dataLoaded) {
                renderClassOptions();
                renderUrgentBadges();
                renderProfileDisplay();
                render();
                showSyncStatus('saved', '✅ Yangilandi');
            }
        }
    }, (error) => {
        console.error("Realtime listener xatolik:", error);
    });
}

// ─── Save to Firebase ───
async function saveStudentsToFirebase() {
    isSaving = true;
    showSyncStatus('saving', 'Saqlanmoqda...');

    try {
        await db.collection("crmData").doc(currentUserDoc).set({
            students: students,
            classes: classes,
            profile: userProfile,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
        showSyncStatus('saved', '✅ Saqlandi');
    } catch (e) {
        console.error("Saqlashda xatolik:", e);
        showSyncStatus('error', '❌ Xatolik! Qayta urinib ko\'ring');
    } finally {
        isSaving = false;
    }
}

function saveStudents() {
    saveStudentsToFirebase();
    render();
}

// ─── DOM Elements ───
const form = document.getElementById('addStudentForm');
const searchInput = document.getElementById('searchInput');
const studentList = document.getElementById('studentList');
const mainClassFilter = document.getElementById('mainClassFilter');
const todayCallCountEl = document.getElementById('todayCallCount');
const mostIgnoredStudentEl = document.getElementById('mostIgnoredStudent');
const classGroupSelect = document.getElementById('classGroup');
const newClassInput = document.getElementById('newClassInput');
const draftInput = document.getElementById('draftInput');
const draftSuggest = document.getElementById('draftSuggest');
const urgentBadges = document.getElementById('urgentBadges');

// ─── Utility Functions ───
function getTodayString() {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function calculateDaysAgo(dateString) {
    if (!dateString) return null;
    const past = new Date(dateString);
    past.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.floor(Math.abs(today - past) / (1000 * 60 * 60 * 24));
}

function formatDateUi(dateStr) {
    if (!dateStr) return 'Hech qachon';
    const [y, m, d] = dateStr.split('-');
    return `${d}.${m}.${y}`;
}

// ─── Evaluate Student Status ───
function evaluateStudent(student) {
    const daysAgo = calculateDaysAgo(student.lastCall);
    let borderClass = 'status-neutral';
    let tags = [];

    if (student.lastCall === null) {
        borderClass = 'status-bad border-danger border border-1';
        tags.push(`<span class="badge bg-danger rounded-pill"><i class="fas fa-exclamation-circle me-1"></i> TEL QILISH KERAK!</span>`);
    } else if (daysAgo === 0) {
        borderClass = 'status-good border-success border border-1';
        tags.push(`<span class="badge bg-success rounded-pill"><i class="fas fa-check-circle me-1"></i> Bugun qayd etilgan</span>`);
    } else if (daysAgo >= 3) {
        borderClass = 'status-bad border-danger border border-1';
        tags.push(`<span class="badge bg-danger rounded-pill"><i class="fas fa-clock me-1"></i> ${daysAgo} kun o'tdi!</span>`);
    } else {
        borderClass = 'status-neutral border-info border border-1';
        tags.push(`<span class="badge bg-info text-dark rounded-pill"><i class="fas fa-calendar-alt me-1"></i> ${daysAgo} kun oldin</span>`);
    }

    // Sinf tag
    tags.unshift(`<span class="badge bg-secondary rounded-pill"><i class="fas fa-school me-1"></i> ${escapeHtml(student.classGroup || 'Asosiy')}</span>`);

    if (student.isUrgent) {
        borderClass = 'border-danger border-3';
        tags.unshift(`<span class="badge bg-danger rounded-pill fw-bold" style="font-size: 0.85rem;"><i class="fas fa-bolt me-1"></i> TEZDA: ${escapeHtml(student.urgentReason || 'Qoralama')}</span>`);
    }

    // Problem Signal
    const hasProblem = (student.notes || '').toLowerCase().includes('dars qilm');
    let problemHtml = '';
    if (hasProblem) {
        problemHtml = `<div class="problem-signal"><i class="fas fa-exclamation-triangle me-1"></i> Ota-onaga tezroq qo'ng'iroq qiling!</div>`;
    }

    return { borderClass, tags: tags.join(''), problemHtml, daysAgo };
}

// ─── Main Render ───
function render() {
    // Class filter options
    const uniqueClasses = [...classes].sort();

    let optionsHtml = `<option value="all"><i class="fas fa-folder me-1"></i> Barcha sinflar</option>`;
    uniqueClasses.forEach(cls => {
        optionsHtml += `<option value="${escapeHtml(cls)}"><i class="fas fa-school me-1"></i> ${escapeHtml(cls)} sinfi</option>`;
    });
    if (mainClassFilter) {
        mainClassFilter.innerHTML = optionsHtml;
        mainClassFilter.value = currentClassFilter;
    }

    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

    // Filter students
    let filtered = students.filter(s => {
        const matchesClass = currentClassFilter === 'all' || (s.classGroup || 'Asosiy') === currentClassFilter;
        const matchesSearch = s.firstName.toLowerCase().includes(searchTerm) ||
                              s.lastName.toLowerCase().includes(searchTerm) ||
                              s.phone.includes(searchTerm);
        return matchesClass && matchesSearch;
    });

    // Urgent students first
    filtered.sort((a, b) => {
        if (a.isUrgent && !b.isUrgent) return -1;
        if (!a.isUrgent && b.isUrgent) return 1;
        return 0;
    });

    // Render
    if (filtered.length === 0) {
        if (studentList) studentList.innerHTML = `<p style="text-align: center; color: #94a3b8; padding: 2rem 0;">O'quvchilar topilmadi yoki hali qo'shilmagan.</p>`;
    } else {
        if (studentList) studentList.innerHTML = filtered.map((student, index) => {
            const { borderClass, tags, problemHtml } = evaluateStudent(student);
            const delay = 0.1 + (index * 0.05);

            // Last call feedback
            let lastFeedbackHtml = '';
            if (student.callHistory && student.callHistory.length > 0) {
                let sortedHistory = [...student.callHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
                let lastRecord = sortedHistory[0];
                if (lastRecord) {
                    let rTeacher = escapeHtml(lastRecord.teacherReason || "Noma'lum");
                    let rParent = escapeHtml(lastRecord.parentFeedback || (lastRecord.reason || "Noma'lum"));
                    lastFeedbackHtml = `
                    <div class="feedback-box">
                        <span class="feedback-teacher"><i class="fas fa-chalkboard-teacher me-1"></i> <b>Maqsad:</b> ${rTeacher}</span>
                        <span class="feedback-parent"><i class="fas fa-comment-dots me-1"></i> <b>Ota-ona:</b> ${rParent}</span>
                    </div>`;
                }
            }

            let cleanPhone = student.phone.replace(/[^0-9+]/g, '');

            return `
            <div class="card mb-3 glass-card animate-in ${borderClass}" style="animation-delay: ${delay}s;">
                <div class="card-body d-flex flex-column flex-md-row justify-content-between gap-3">
                    <div>
                        <h5 class="fw-bold mb-2 display-font">${escapeHtml(student.firstName)} ${escapeHtml(student.lastName)}</h5>
                        <div class="d-flex align-items-center flex-wrap gap-2 mb-2">
                            <span class="text-muted small"><i class="fas fa-phone me-1"></i> ${escapeHtml(student.phone)}</span>
                            <a href="tel:${cleanPhone}" class="btn btn-sm btn-success rounded-pill px-3 py-1 shadow-sm fw-bold border-0" style="font-size:0.8rem; line-height: 1.6;"><i class="fas fa-phone-alt me-1"></i> Tel qilish</a>
                        </div>
                        <p class="mb-2 text-dark small"><i class="fas fa-sticky-note me-1 text-muted"></i> ${escapeHtml(student.notes || "Izoh yo'q")}</p>
                        ${lastFeedbackHtml}
                        <div class="d-flex flex-wrap gap-1 mt-2">${tags}</div>
                        ${problemHtml}
                    </div>
                    <div class="d-flex flex-row flex-md-column gap-2 align-items-md-end justify-content-end">
                        <button class="btn btn-primary btn-sm flex-grow-1 flex-md-grow-0 fw-bold px-4" onclick="markCalled('${student.id}')"><i class="fas fa-phone-alt me-1"></i> Qo'ng'iroq qayd etish</button>
                        <div class="d-flex gap-2 w-100 justify-content-end">
                            <button class="btn btn-outline-secondary btn-sm flex-grow-1" onclick="openEditStudentModal('${student.id}')" title="Tahrirlash"><i class="fas fa-edit"></i></button>
                            <button class="btn btn-outline-danger btn-sm flex-grow-1" onclick="deleteStudent('${student.id}')" title="O'chirish"><i class="fas fa-trash-alt"></i></button>
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');
    }

    updateStats();
}

window.setClassFilter = (cls) => {
    currentClassFilter = cls;
    render();
};

// ─── Dashboard Stats ───
function updateStats() {
    const todayStr = getTodayString();

    let targetStudents = students;
    if (currentClassFilter !== 'all') {
        targetStudents = students.filter(s => (s.classGroup || 'Asosiy') === currentClassFilter);
    }

    const todayCalls = targetStudents.filter(s => s.lastCall === todayStr).length;
    if (todayCallCountEl) todayCallCountEl.textContent = todayCalls;

    let problematicCount = targetStudents.filter(s => {
        let calls = 0;
        if (s.callHistory && s.callHistory.length > 0) {
            calls = s.callHistory.length;
        } else {
            calls = s.lastCall ? 1 : 0;
        }
        return calls >= 3;
    }).length;

    const probEl = document.getElementById('problematicStudentsCount');
    if (probEl) {
        probEl.textContent = problematicCount + " ta";
    }
}

// ─── Class Options for Form ───
function renderClassOptions() {
    let html = `<option value="" disabled selected>Sinfni tanlang...</option>`;
    classes.sort().forEach(c => {
        html += `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`;
    });
    html += `<option value="_add_new_" style="font-weight: bold; color: var(--primary);">+ Yangi sinf qo'shish...</option>`;
    if (classGroupSelect) classGroupSelect.innerHTML = html;
}

// Event: New class select
if (classGroupSelect) {
    classGroupSelect.addEventListener('change', (e) => {
        if (e.target.value === '_add_new_') {
            newClassInput.style.display = 'block';
            newClassInput.setAttribute('required', 'true');
        } else {
            newClassInput.style.display = 'none';
            newClassInput.removeAttribute('required');
        }
    });
}

// ─── Add Student ───
if (form) {
    form.addEventListener('submit', (e) => {
        e.preventDefault();

        let finalClass = classGroupSelect.value;
        if (finalClass === '_add_new_') {
            finalClass = newClassInput.value.trim().toUpperCase();
            if (!finalClass) return;
            if (!classes.includes(finalClass)) {
                classes.push(finalClass);
                renderClassOptions();
            }
        }

        const newStudent = {
            id: generateId(),
            firstName: document.getElementById('firstName').value.trim(),
            lastName: document.getElementById('lastName').value.trim(),
            classGroup: finalClass,
            phone: document.getElementById('parentPhone').value.trim(),
            notes: document.getElementById('notes').value.trim(),
            lastCall: null,
            dateAdded: getTodayString()
        };

        students.push(newStudent);
        saveStudents();
        form.reset();
        newClassInput.style.display = 'none';
    });
}

// ─── Search ───
if (searchInput) searchInput.addEventListener('input', render);

// ─── Call Feedback ───
window.currentCallId = null;

window.markCalled = (id) => {
    window.currentCallId = id;
    document.getElementById('callReasonInput').value = '';
    document.getElementById('parentFeedbackInput').value = '';
    document.getElementById('callFeedbackModal').classList.add('active');
};

window.closeCallFeedbackModal = () => {
    document.getElementById('callFeedbackModal').classList.remove('active');
    window.currentCallId = null;
};

window.saveCallFeedback = () => {
    const id = window.currentCallId;
    if (!id) return;
    const idx = students.findIndex(s => s.id === id);
    if (idx !== -1) {
        const teacherReason = document.getElementById('callReasonInput').value.trim() || 'Izohsiz';
        const parentFeedback = document.getElementById('parentFeedbackInput').value.trim() || 'Izohsiz';

        students[idx].lastCall = getTodayString();
        if (!students[idx].callHistory) {
            students[idx].callHistory = [];
        }
        students[idx].callHistory.push({
            date: new Date().toISOString(),
            teacherReason: teacherReason,
            parentFeedback: parentFeedback,
            reason: `Maqsad: ${teacherReason} | Ota-ona fikri: ${parentFeedback}`
        });

        students[idx].isUrgent = false;
        saveStudents();
        renderUrgentBadges();
        closeCallFeedbackModal();
    }
};

// ─── History Modal ───
window.openHistoryModal = () => {
    const historyListEl = document.getElementById('historyList');
    document.getElementById('historyModal').classList.add('active');

    let htmlContent = '';

    let targetStudents = students;
    if (currentClassFilter !== 'all') {
        targetStudents = students.filter(s => (s.classGroup || 'Asosiy') === currentClassFilter);
    }

    const calledStudents = targetStudents.filter(s => s.lastCall !== null || (s.callHistory && s.callHistory.length > 0));

    if (calledStudents.length === 0) {
        let filterMsg = currentClassFilter !== 'all' ? "Bu sinfda hali" : "Hali";
        historyListEl.innerHTML = `<p style="text-align:center; color:#94a3b8; padding: 1rem 0;">${filterMsg} hech kimga qo'ng'iroq qilinmadi.</p>`;
        return;
    }

    calledStudents.forEach(s => {
        let historyHtml = '';
        let records = [];

        if (s.callHistory && s.callHistory.length > 0) {
            records = [...s.callHistory];
        } else if (s.lastCall) {
            records = [{ date: s.lastCall + 'T12:00:00.000Z', reason: '' }];
        }

        records.sort((a, b) => {
            let dateA = typeof a === 'string' ? a : a.date;
            let dateB = typeof b === 'string' ? b : b.date;
            return new Date(dateB) - new Date(dateA);
        });

        records.forEach(record => {
            let dateRaw = typeof record === 'string' ? record : record.date;
            let reasonStr = '';

            if (typeof record !== 'string') {
                if (record.teacherReason || record.parentFeedback) {
                    reasonStr = `<div style="margin-top: 0.3rem; padding-left: 0.8rem; border-left: 2px solid #e2e8f0;">
                         <span style="color:#64748b; font-size: 0.82rem; display: block;">👨‍🏫 Maqsad: ${escapeHtml(record.teacherReason || '-')}</span>
                         <span style="color: var(--primary); font-size: 0.82rem; display: block;">💬 Ota-ona: ${escapeHtml(record.parentFeedback || '-')}</span>
                     </div>`;
                } else if (record.reason) {
                    reasonStr = `<br><span style="color:#64748b; font-size: 0.82rem;">💬 ${escapeHtml(record.reason)}</span>`;
                }
            }

            const d = new Date(dateRaw);
            const niceDate = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()} — <b>${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}</b>`;
            historyHtml += `<li style="margin-bottom: 0.4rem; border-bottom: 1px dashed #e2e8f0; padding-bottom: 0.4rem;"><i class="fas fa-clock text-muted me-1"></i> ${niceDate}${reasonStr}</li>`;
        });

        let cleanPhone = s.phone.replace(/[^0-9+]/g, '');

        htmlContent += `
            <div class="card mb-3 glass-card border-0 shadow-sm animate-in">
                <div class="card-body p-3">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <b class="fs-6 text-primary display-font"><i class="fas fa-user-circle me-1"></i> ${escapeHtml(s.firstName)} ${escapeHtml(s.lastName)}</b>
                    </div>
                    <div class="d-flex align-items-center gap-2 mb-3">
                        <span class="text-muted small"><i class="fas fa-phone-alt me-1"></i> ${escapeHtml(s.phone)}</span>
                        <a href="tel:${cleanPhone}" class="btn btn-sm btn-outline-success rounded-pill px-2 py-0" style="font-size: 0.75rem;"><i class="fas fa-phone-alt"></i> Tel</a>
                    </div>
                    <ul class="list-unstyled mb-0 small text-muted">
                        ${historyHtml}
                    </ul>
                </div>
            </div>`;
    });

    historyListEl.innerHTML = htmlContent;
};

window.closeHistoryModal = () => {
    document.getElementById('historyModal').classList.remove('active');
};

// ─── Class Manager ───
window.openClassManager = () => {
    const listEl = document.getElementById('classListContainer');
    document.getElementById('classManageModal').classList.add('active');

    let html = '';
    const sortedClasses = [...classes].sort();

    sortedClasses.forEach(cls => {
        const safeCls = escapeHtml(cls);
        html += `
        <div class="card mb-2 glass-card border-0 shadow-sm">
            <div class="card-body p-3 d-flex justify-content-between align-items-center">
                <b class="fs-6 display-font"><i class="fas fa-layer-group me-2 text-primary"></i>${safeCls}</b>
                <div class="d-flex gap-2">
                    <button class="btn btn-sm btn-outline-secondary" onclick="renameClass('${cls.replace(/'/g, "\\'")}')" title="O'zgartirish"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="removeClass('${cls.replace(/'/g, "\\'")}')" title="O'chirish"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        </div>`;
    });

    if (sortedClasses.length === 0) {
        html = '<p style="text-align:center; color:#94a3b8; padding: 1rem 0;">Sinflar mavjud emas</p>';
    }
    listEl.innerHTML = html;
};

window.closeClassManager = () => {
    document.getElementById('classManageModal').classList.remove('active');
};

window.renameClass = (oldName) => {
    const newName = prompt(`"${oldName}" nomini o'zgartirish:`, oldName);
    if (newName && newName.trim() !== '' && newName.trim() !== oldName) {
        const finalName = newName.trim().toUpperCase();
        classes = classes.map(c => c === oldName ? finalName : c);
        classes = [...new Set(classes)];
        students.forEach(s => {
            if (s.classGroup === oldName) s.classGroup = finalName;
        });

        if (currentClassFilter === oldName) currentClassFilter = finalName;

        saveStudents();
        openClassManager();
        renderClassOptions();
    }
};

// BUG FIX: Avval 2 marta saveStudents chaqirilayotgan edi — hozir faqat 1 marta
window.removeClass = (clsName) => {
    if (confirm(`Diqqat! "${clsName}" sinfini o'chirasizmi?\n\n(Bu sinfdagi barcha o'quvchilar "Asosiy" guruhiga o'tkaziladi.)`)) {
        classes = classes.filter(c => c !== clsName);
        students.forEach(s => {
            if (s.classGroup === clsName) s.classGroup = 'Asosiy';
        });

        if (currentClassFilter === clsName) currentClassFilter = 'all';

        saveStudents(); // Faqat BIR marta saqlash
        openClassManager();
        renderClassOptions();
    }
};

// ─── Delete Student ───
window.deleteStudent = (id) => {
    const student = students.find(s => s.id === id);
    if (!student) return;
    if (confirm(`"${student.firstName} ${student.lastName}" ni o'chirasizmi?`)) {
        students = students.filter(s => s.id !== id);
        saveStudents();
    }
};

// ─── Edit Student Modal ───
window.openEditStudentModal = (id) => {
    const student = students.find(s => s.id === id);
    if (!student) return;

    document.getElementById('editStudentId').value = student.id;
    document.getElementById('editFirstName').value = student.firstName;
    document.getElementById('editLastName').value = student.lastName;
    document.getElementById('editPhone').value = student.phone || '';
    document.getElementById('editNotes').value = student.notes || '';

    document.getElementById('editStudentModal').classList.add('active');
};

window.closeEditStudentModal = () => {
    document.getElementById('editStudentModal').classList.remove('active');
};

const editStudentForm = document.getElementById('editStudentForm');
if (editStudentForm) {
    editStudentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('editStudentId').value;
        const idx = students.findIndex(s => s.id === id);

        if (idx !== -1) {
            students[idx].firstName = document.getElementById('editFirstName').value.trim();
            students[idx].lastName = document.getElementById('editLastName').value.trim();
            students[idx].phone = document.getElementById('editPhone').value.trim();
            students[idx].notes = document.getElementById('editNotes').value.trim();

            saveStudents();
            closeEditStudentModal();
        }
    });
}

// ─── Most Called Modal ───
window.openMostCalledModal = () => {
    document.getElementById('mostCalledModal').classList.add('active');
    renderMostCalledClasses();
};

window.closeMostCalledModal = () => {
    document.getElementById('mostCalledModal').classList.remove('active');
};

function getStudentCallCount(student) {
    if (student.callHistory && student.callHistory.length > 0) {
        return student.callHistory.length;
    }
    return student.lastCall ? 1 : 0;
}

window.renderMostCalledClasses = () => {
    const listEl = document.getElementById('mostCalledContent');
    const backBtn = document.getElementById('mostCalledBackBtn');
    if (backBtn) backBtn.style.display = 'none';

    let html = '';
    const sortedClasses = [...classes].sort();

    sortedClasses.forEach(cls => {
        let classStudents = students.filter(s => (s.classGroup === cls || (s.classGroup == null && cls === 'Asosiy')));
        let problemCount = classStudents.filter(s => getStudentCallCount(s) >= 3).length;

        html += `
        <div class="card mb-2 glass-card border-0 shadow-sm" style="cursor: pointer;" onclick="showMostCalledStudents('${cls.replace(/'/g, "\\'")}')">
            <div class="card-body d-flex justify-content-between align-items-center p-3">
                <b style="font-size: 1.05rem;" class="text-primary display-font"><i class="fas fa-school me-2"></i> ${escapeHtml(cls)}</b>
                <span class="badge ${problemCount > 0 ? 'bg-danger' : 'bg-secondary'} rounded-pill px-3 py-2" style="font-size: 0.85rem;">
                    <i class="fas fa-exclamation-triangle me-1"></i> ${problemCount} ta
                </span>
            </div>
        </div>`;
    });

    if (sortedClasses.length === 0) {
        html = '<p style="text-align:center; color:#94a3b8; padding: 1rem;">Sinflar mavjud emas</p>';
    }
    listEl.innerHTML = html;
};

window.showMostCalledStudents = (clsName) => {
    const listEl = document.getElementById('mostCalledContent');
    const backBtn = document.getElementById('mostCalledBackBtn');
    if (backBtn) backBtn.style.display = 'block';

    let classStudents = students.filter(s => (s.classGroup === clsName || (s.classGroup == null && clsName === 'Asosiy')));
    let problemStudents = classStudents.filter(s => getStudentCallCount(s) >= 3);
    problemStudents.sort((a, b) => getStudentCallCount(b) - getStudentCallCount(a));
    problemStudents = problemStudents.slice(0, 7);

    let html = `<div style="margin-bottom: 0.8rem; color: var(--primary); font-weight: 700; font-size: 1.05rem; text-align: center;"><i class="fas fa-school me-1"></i> ${escapeHtml(clsName)} sinfi (Top 7)</div>`;

    if (problemStudents.length === 0) {
        html += `<p style="text-align:center; color:#94a3b8; padding: 1rem;">Bu sinfda 3+ marta qo'ng'iroq qilingan o'quvchilar yo'q.</p>`;
    } else {
        problemStudents.forEach((s, ix) => {
            const calls = getStudentCallCount(s);
                let cleanPhone = s.phone.replace(/[^0-9+]/g, '');
            html += `
            <div class="card mb-2 border-danger border-2 shadow-sm glass-card">
                <div class="card-body p-3">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <b class="fs-6 display-font">${ix + 1}. <i class="fas fa-user me-1 text-primary"></i> ${escapeHtml(s.firstName)} ${escapeHtml(s.lastName)}</b>
                        <span class="badge bg-danger rounded-pill px-2 py-1"><i class="fas fa-phone-alt me-1"></i> ${calls} marta</span>
                    </div>
                    <div class="d-flex align-items-center gap-2 mb-2">
                        <span class="text-muted small"><i class="fas fa-mobile-alt me-1"></i> ${escapeHtml(s.phone)}</span>
                        <a href="tel:${cleanPhone}" class="btn btn-sm btn-outline-success rounded-pill px-2 py-0" style="font-size: 0.75rem;"><i class="fas fa-phone-alt"></i> Tel</a>
                    </div>
                    <div class="text-muted small"><i><i class="fas fa-info-circle me-1"></i> Izoh:</i> ${escapeHtml(s.notes || "Yo'q")}</div>
                </div>
            </div>`;
        });
    }

    listEl.innerHTML = html;
};

// ─── Draft Functionality ───
if (draftInput) {
    draftInput.addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase().trim();
        if (!val) {
            draftSuggest.style.display = 'none';
            return;
        }

        let targetStudents = currentClassFilter === 'all'
            ? students
            : students.filter(s => (s.classGroup || 'Asosiy') === currentClassFilter);

        const matches = targetStudents.filter(s =>
            !s.isUrgent && (s.firstName.toLowerCase().includes(val) || s.lastName.toLowerCase().includes(val))
        );

        if (matches.length > 0) {
            draftSuggest.style.display = 'block';
            draftSuggest.innerHTML = matches.map(m => `
                <div class="px-3 py-2 border-bottom" style="cursor: pointer; font-size: 0.95rem; transition: background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'" onmousedown="markUrgent('${m.id}')">
                    <i class="fas fa-user text-muted me-1"></i> <b class="text-dark">${escapeHtml(m.firstName)} ${escapeHtml(m.lastName)}</b>
                    <span class="badge bg-secondary-subtle text-secondary ms-2 rounded-pill">${escapeHtml(m.classGroup || 'Asosiy')}</span>
                </div>
            `).join('');
        } else {
            draftSuggest.style.display = 'none';
        }
    });

    draftInput.addEventListener('blur', () => {
        setTimeout(() => { draftSuggest.style.display = 'none'; }, 200);
    });
}

window.markUrgent = (id) => {
    const idx = students.findIndex(s => s.id === id);
    if (idx !== -1) {
        students[idx].isUrgent = true;
        students[idx].urgentReason = "Darsda qatnashmagani uchun";
        saveStudents();
        if (draftInput) draftInput.value = '';
        renderUrgentBadges();
    }
};

window.resolveUrgent = (id) => {
    const idx = students.findIndex(s => s.id === id);
    if (idx !== -1) {
        students[idx].isUrgent = false;
        saveStudents();
        renderUrgentBadges();
    }
};

window.renderUrgentBadges = () => {
    if (!urgentBadges) return;
    const urgents = students.filter(s => s.isUrgent && (currentClassFilter === 'all' || (s.classGroup || 'Asosiy') === currentClassFilter));

    if (urgents.length > 0) {
        urgentBadges.innerHTML = urgents.map(u => `
            <div class="badge bg-danger rounded-pill d-flex align-items-center gap-2 p-2 px-3 shadow-sm animate-in" style="font-size: 0.9rem;">
                <i class="fas fa-bolt"></i> ${escapeHtml(u.firstName)} ${escapeHtml(u.lastName)}
                <button onclick="resolveUrgent('${u.id}')" class="btn-close btn-close-white" style="font-size: 0.6rem;" title="Bekor qilish"></button>
            </div>
        `).join('');
    } else {
        urgentBadges.innerHTML = '';
    }
};

// ─── Export Modal ───
window.openExportModal = () => {
    document.getElementById('exportModal').classList.add('active');
    const select = document.getElementById('exportClassFilter');
    let html = `<option value="all"><i class="fas fa-folder me-1"></i> Barcha sinflar</option>`;
    const uniqueClasses = [...classes].sort();
    uniqueClasses.forEach(c => {
        html += `<option value="${escapeHtml(c)}"><i class="fas fa-school me-1"></i> ${escapeHtml(c)}</option>`;
    });
    if (select) select.innerHTML = html;
};

window.closeExportModal = () => {
    document.getElementById('exportModal').classList.remove('active');
};

function getExportData() {
    const filter = document.getElementById('exportClassFilter').value;
    let targetStudents = filter === 'all'
        ? students
        : students.filter(s => (s.classGroup || 'Asosiy') === filter);

    return targetStudents.sort((a, b) => {
        if (a.isUrgent && !b.isUrgent) return -1;
        if (!a.isUrgent && b.isUrgent) return 1;
        return 0;
    });
}

function openTelegramAfterDownload() {
    window.open('https://t.me/alliyev_2225', '_blank');
}

window.exportStyledReport = (type) => {
    const data = getExportData();
    if (data.length === 0) { alert("Ma'lumot yo'q!"); return; }

    const d = new Date();
    const dateStr = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
    const filterText = document.getElementById('exportClassFilter').options[document.getElementById('exportClassFilter').selectedIndex].text;

    let htmlContent = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
        <meta charset="utf-8">
        <title>Hisobot</title>
    </head>
    <body style="font-family: Arial, sans-serif;">
        <h2 style="text-align: center; color: #4338ca;">Ustoz Aliyev - O'quvchi Hisoboti</h2>
        <p style="text-align: center; color: #333333;">Sana: <b>${dateStr}</b> | Sinf: <b>${filterText}</b></p>
        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; text-align: center;">
            <tr style="background-color: #4338ca; color: #ffffff; font-weight: bold;">
                <th style="padding: 10px;">T/r</th>
                <th style="padding: 10px;">Ism Familiya</th>
                <th style="padding: 10px;">Sinf</th>
                <th style="padding: 10px;">Ota-ona telefoni</th>
                <th style="padding: 10px;">Izoh / Muammo</th>
                <th style="padding: 10px;">Holati</th>
                <th style="padding: 10px;">Oxirgi aloqa</th>
                <th style="padding: 10px;">Qo'ng'iroq maqsadi</th>
                <th style="padding: 10px;">Ota-ona fikri</th>
            </tr>`;

    data.forEach((s, idx) => {
        let holatTekst = s.isUrgent ? 'TEZDA QO\'NG\'IROQ 🚨' : (s.lastCall ? 'Gaplashilgan ✅' : 'Tel qilinmagan ⏳');
        let oxirgiTel = s.lastCall ? formatDateUi(s.lastCall) : "QILINMAGAN";
        
        let lastCallReason = "-";
        let lastParentFeedback = "-";
        
        if (s.callHistory && s.callHistory.length > 0) {
            let lastCallInfo = s.callHistory[s.callHistory.length - 1];
            if (lastCallInfo.teacherReason) lastCallReason = lastCallInfo.teacherReason;
            if (lastCallInfo.parentFeedback) lastParentFeedback = lastCallInfo.parentFeedback;
        }
        
        // Use safer colors for Excel visibility
        let rowColor = s.isUrgent ? '#fce8e6' : (s.lastCall ? '#e6f4ea' : '#ffffff');
        let textColor = s.isUrgent ? '#c5221f' : '#000000';

        htmlContent += `
            <tr style="background-color: ${rowColor}; color: ${textColor};">
                <td>${idx + 1}</td>
                <td><b>${escapeHtml(s.firstName)} ${escapeHtml(s.lastName)}</b></td>
                <td>${escapeHtml(s.classGroup || 'Asosiy')}</td>
                <td>${escapeHtml(s.phone)}</td>
                <td>${escapeHtml(s.isUrgent ? s.urgentReason : (s.notes || "-"))}</td>
                <td>${holatTekst}</td>
                <td>${oxirgiTel}</td>
                <td>${escapeHtml(lastCallReason)}</td>
                <td>${escapeHtml(lastParentFeedback)}</td>
            </tr>`;
    });

    htmlContent += `</table></body></html>`;

    let blobType = type === 'excel' ? 'application/vnd.ms-excel' : 'application/msword';
    let fileExtension = type === 'excel' ? 'xls' : 'doc';

    const blob = new Blob(['\ufeff', htmlContent], { type: blobType });
    const fileName = `Ustoz_Aliyev_Hisobot_${dateStr}.${fileExtension}`;
    const file = new File([blob], fileName, { type: blobType });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    if (type === 'word') {
        openTelegramAfterDownload();
    }
    
    closeExportModal();
};

window.exportToTelegramText = () => {
    const data = getExportData();
    if (data.length === 0) { alert("Ma'lumot yo'q!"); return; }

    let reportList = [];
    data.forEach(s => {
        let lastCallReason = "-";
        let lastParentFeedback = "-";
        if (s.callHistory && s.callHistory.length > 0) {
            let lastCallInfo = s.callHistory[s.callHistory.length - 1];
            if (lastCallInfo.teacherReason) lastCallReason = lastCallInfo.teacherReason;
            if (lastCallInfo.parentFeedback) lastParentFeedback = lastCallInfo.parentFeedback;
        }

        let feedbackText = (lastCallReason !== "-" || lastParentFeedback !== "-") 
            ? `\n   📞 Maqsad: ${lastCallReason}\n   💬 Ota-ona fikri: ${lastParentFeedback}` 
            : "";

        if (s.isUrgent) {
            reportList.push(`🚨 ${s.firstName} ${s.lastName} - (${s.urgentReason || 'Muammo'})${feedbackText}`);
        } else {
            const daysAgo = calculateDaysAgo(s.lastCall);
            if (s.lastCall === null) {
                reportList.push(`🔴 ${s.firstName} ${s.lastName} - (Tel qilinmagan)${feedbackText}`);
            } else if (daysAgo !== null && daysAgo >= 3) {
                reportList.push(`🔴 ${s.firstName} ${s.lastName} - (${daysAgo} kun o'tdi)${feedbackText}`);
            } else {
                reportList.push(`✅ ${s.firstName} ${s.lastName} - (Gaplashilgan)${feedbackText}`);
            }
        }
    });

    const filterText = document.getElementById('exportClassFilter').options[document.getElementById('exportClassFilter').selectedIndex].text;
    const todayStr = new Date().toLocaleDateString('uz-UZ');

    let message = `📅 Hisobot (${todayStr}, ${filterText})\n\n`;
    message += reportList.map((item, i) => `${i + 1}. ${item}`).join('\n\n');
    message += `\n\n🤖 Ustoz Aliyev tizimi orqali`;

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://t.me/alliyev_2225?text=${encodedMessage}`, '_blank');
    closeExportModal();
};

// ─── Admin Users Logic ───
let adminUsersList = [];

async function loadAdminUsers() {
    const listEl = document.getElementById('teachersList');
    if (!listEl) return;
    listEl.innerHTML = `<p style="text-align: center; color: #94a3b8; padding: 2rem 0;">Yuklanmoqda...</p>`;

    try {
        const docRef = db.collection("crmSettings").doc("users");
        const docSnap = await docRef.get();
        
        if (docSnap.exists) {
            adminUsersList = docSnap.data().list || [];
        } else {
            adminUsersList = [];
        }
        
        renderAdminUsers();
    } catch (e) {
        console.error("Foydalanuvchilarni yuklashda xato:", e);
        listEl.innerHTML = `<p style="text-align: center; color: var(--danger); padding: 2rem 0;">Xatolik yuz berdi.</p>`;
    }
}

function renderAdminUsers() {
    const listEl = document.getElementById('teachersList');
    if (!listEl) return;

    if (adminUsersList.length === 0) {
        listEl.innerHTML = `<p style="text-align: center; color: #94a3b8; padding: 2rem 0;">Hali o'qituvchilar yo'q.</p>`;
        return;
    }

    listEl.innerHTML = adminUsersList.map((u, i) => `
        <div class="card shadow-sm border-0 glass-card animate-in stagger-${(i % 3) + 1}">
            <div class="card-body d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
                <div>
                    <h5 class="fw-bold text-primary mb-1 display-font"><i class="fas fa-user-shield me-2"></i> ${escapeHtml(u.login)}</h5>
                    <p class="text-muted mb-0"><i class="fas fa-key me-2"></i> Parol: ${escapeHtml(u.password)}</p>
                </div>
                <div class="d-flex gap-2">
                    <button class="btn btn-warning fw-bold text-dark w-100" onclick="viewAsTeacher('${u.login}')"><i class="fas fa-eye me-1"></i> Kirish</button>
                    <button class="btn btn-outline-danger w-100" onclick="deleteTeacher('${u.login}')" title="O'chirish"><i class="fas fa-trash-alt"></i></button>
                </div>
            </div>
        </div>
    `).join('');
}

const addTeacherForm = document.getElementById('addTeacherForm');
if (addTeacherForm) {
    addTeacherForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const loginStr = document.getElementById('newTeacherLogin').value.trim().toLowerCase();
        const passStr = document.getElementById('newTeacherPassword').value.trim();

        if (loginStr === 'admin' || loginStr === 'main') {
            alert("Bu logindan foydalanish mumkin emas!");
            return;
        }

        if (adminUsersList.some(u => u.login === loginStr)) {
            alert("Bunday login allaqachon mavjud!");
            return;
        }

        const btn = addTeacherForm.querySelector('button');
        const oldText = btn.innerText;
        btn.innerText = "Qo'shilmoqda...";
        btn.disabled = true;

        adminUsersList.push({ login: loginStr, password: passStr });

        try {
            await db.collection("crmSettings").doc("users").set({
                list: adminUsersList
            });
            addTeacherForm.reset();
            renderAdminUsers();
        } catch (e) {
            console.error("Qo'shishda xato:", e);
            alert("Xatolik! Qayta urinib ko'ring.");
        } finally {
            btn.innerText = oldText;
            btn.disabled = false;
        }
    });
}

window.deleteTeacher = async (login) => {
    if (confirm(`Rostdan ham "${login}" o'qituvchisini o'chirasizmi? (Diqqat: u endi tizimga kira olmaydi, lekin ma'lumotlari o'chib ketmaydi)`)) {
        adminUsersList = adminUsersList.filter(u => u.login !== login);
        try {
            await db.collection("crmSettings").doc("users").set({
                list: adminUsersList
            });
            renderAdminUsers();
        } catch(e) {
            console.error(e);
            alert("O'chirishda xatolik");
        }
    }
};

window.viewAsTeacher = (login) => {
    sessionStorage.setItem('smart_username', login);
    sessionStorage.setItem('viewing_as_admin', 'true');
    location.reload();
};

// ─── Profile Logic ───
window.renderProfileDisplay = () => {
    const nameEl = document.getElementById('navProfileName');
    const subjEl = document.getElementById('navProfileSubject');
    const imgEl = document.getElementById('navAvatarImage');

    if (nameEl) nameEl.innerText = userProfile.name || currentUserDoc;
    if (subjEl) subjEl.innerText = userProfile.subject || 'Mutaxassislik kiritilmagan';
    if (imgEl && userProfile.avatar) {
        imgEl.src = userProfile.avatar;
    }
};

window.openProfileModal = () => {
    document.getElementById('profileNameInput').value = userProfile.name || currentUserDoc;
    document.getElementById('profileSubjectInput').value = userProfile.subject || '';
    if (userProfile.avatar) {
        document.getElementById('profilePreviewImg').src = userProfile.avatar;
    }
    pendingAvatarData = null;
    document.getElementById('profileEditModal').classList.add('active');
};

window.closeProfileModal = () => {
    document.getElementById('profileEditModal').classList.remove('active');
};

window.handleProfileImageSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_SIZE = 250;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_SIZE) {
                    height *= MAX_SIZE / width;
                    width = MAX_SIZE;
                }
            } else {
                if (height > MAX_SIZE) {
                    width *= MAX_SIZE / height;
                    height = MAX_SIZE;
                }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // Compress as JPEG 80% quality
            pendingAvatarData = canvas.toDataURL('image/jpeg', 0.8);
            document.getElementById('profilePreviewImg').src = pendingAvatarData;
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
};

const profileEditForm = document.getElementById('profileEditForm');
if (profileEditForm) {
    profileEditForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btn = profileEditForm.querySelector('button');
        const oldText = btn.innerText;
        btn.innerText = "Saqlanmoqda...";
        btn.disabled = true;

        userProfile.name = document.getElementById('profileNameInput').value.trim();
        userProfile.subject = document.getElementById('profileSubjectInput').value.trim();
        if (pendingAvatarData) {
            userProfile.avatar = pendingAvatarData;
        }

        try {
            await saveStudentsToFirebase();
            renderProfileDisplay();
            closeProfileModal();
        } catch(err) {
            alert("Xatolik yuz berdi!");
        } finally {
            btn.innerText = oldText;
            btn.disabled = false;
        }
    });
}

// ─── Start Application ───
initializeApp();

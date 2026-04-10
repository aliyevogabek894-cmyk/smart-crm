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

            if (dataLoaded) {
                renderClassOptions();
                renderUrgentBadges();
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
        borderClass = 'status-bad';
        tags.push(`<span class="tag tag-red">🔴 TEL QILISH KERAK!</span>`);
    } else if (daysAgo === 0) {
        borderClass = 'status-good';
        tags.push(`<span class="tag tag-green">🟢 Bugun qo'ng'iroq qilindi</span>`);
    } else if (daysAgo >= 3) {
        borderClass = 'status-bad';
        tags.push(`<span class="tag tag-red">🔴 ${daysAgo} kun o'tdi!</span>`);
    } else {
        borderClass = 'status-neutral';
        tags.push(`<span class="tag tag-blue">🔵 ${daysAgo} kun oldin</span>`);
    }

    // Sinf tag
    tags.unshift(`<span class="tag" style="background:#e2e8f0; color:#475569;">🏫 ${escapeHtml(student.classGroup || 'Asosiy')}</span>`);

    if (student.isUrgent) {
        borderClass = 'status-bad';
        tags.unshift(`<span class="tag tag-red" style="font-size: 0.85rem;">🚨 TEZDA: ${escapeHtml(student.urgentReason || 'Qoralama')}</span>`);
    }

    // Problem Signal
    const hasProblem = (student.notes || '').toLowerCase().includes('dars qilm');
    let problemHtml = '';
    if (hasProblem) {
        problemHtml = `<div class="problem-signal">⚠️ Ota-onaga tezroq qo'ng'iroq qiling!</div>`;
    }

    return { borderClass, tags: tags.join(''), problemHtml, daysAgo };
}

// ─── Main Render ───
function render() {
    // Class filter options
    const uniqueClasses = [...classes].sort();

    let optionsHtml = `<option value="all">📁 Barcha sinflar</option>`;
    uniqueClasses.forEach(cls => {
        optionsHtml += `<option value="${escapeHtml(cls)}">🏫 ${escapeHtml(cls)} sinfi</option>`;
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
                    <div style="font-size: 0.82rem; margin-top: 0.4rem; padding: 0.4rem 0.6rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
                        <span style="color: #64748b; display: block; margin-bottom: 0.2rem;">👨‍🏫 <b>Maqsad:</b> ${rTeacher}</span>
                        <span style="color: var(--primary); display: block;">💬 <b>Ota-ona:</b> ${rParent}</span>
                    </div>`;
                }
            }

            let cleanPhone = student.phone.replace(/[^0-9+]/g, '');

            return `
            <div class="student-card stagger-item ${borderClass}" style="animation-delay: ${delay}s;">
                <div class="student-info">
                    <h3>${escapeHtml(student.firstName)} ${escapeHtml(student.lastName)}</h3>
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.3rem; flex-wrap: wrap;">
                        <span style="font-size: 0.88rem; color: var(--text-muted);">📞 ${escapeHtml(student.phone)}</span>
                        <a href="tel:${cleanPhone}" class="tel-link-btn">📲 Tel</a>
                    </div>
                    <p>📝 ${escapeHtml(student.notes || "Izoh yo'q")}</p>
                    ${lastFeedbackHtml}
                    <div class="tags-container">${tags}</div>
                    ${problemHtml}
                </div>
                <div class="actions">
                    <button class="call-btn" onclick="markCalled('${student.id}')">📞 Tel qildim</button>
                    <button class="edit-btn" onclick="openEditStudentModal('${student.id}')" title="Tahrirlash">✏️</button>
                    <button class="delete-btn" onclick="deleteStudent('${student.id}')" title="O'chirish">🗑️</button>
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
            historyHtml += `<li style="margin-bottom: 0.4rem; border-bottom: 1px dashed #e2e8f0; padding-bottom: 0.4rem;">🕰 ${niceDate}${reasonStr}</li>`;
        });

        htmlContent += `
            <div class="history-item" style="flex-direction: column; align-items: flex-start; margin-bottom: 0.8rem;">
                <div style="margin-bottom: 0.6rem;">
                    <b style="font-size: 1.05rem; color: var(--primary);">👤 ${escapeHtml(s.firstName)} ${escapeHtml(s.lastName)}</b>
                    <div style="color: var(--text-muted); font-size: 0.85rem; margin-top: 0.15rem;">📞 ${escapeHtml(s.phone)}</div>
                </div>
                <ul style="list-style: none; padding-left: 0; width: 100%; color: var(--text-muted); font-size: 0.9rem;">
                    ${historyHtml}
                </ul>
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
        <div class="history-item" style="display: flex; justify-content: space-between; align-items: center; padding: 0.8rem;">
            <b>${safeCls}</b>
            <div style="display: flex; gap: 0.6rem; font-size: 1.1rem;">
                <button onclick="renameClass('${cls.replace(/'/g, "\\'")}')" style="background:none; border:none; cursor:pointer; padding: 0.3rem;" title="O'zgartirish">✏️</button>
                <button onclick="removeClass('${cls.replace(/'/g, "\\'")}')" style="background:none; border:none; cursor:pointer; padding: 0.3rem;" title="O'chirish">🗑️</button>
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
        <div class="history-item" style="display: flex; justify-content: space-between; align-items: center; padding: 0.9rem; cursor: pointer; transition: background 0.2s;" onclick="showMostCalledStudents('${cls.replace(/'/g, "\\'")}')">
            <b style="font-size: 1.05rem; color: var(--primary);">🏫 ${escapeHtml(cls)}</b>
            <span style="background: ${problemCount > 0 ? 'var(--danger)' : '#cbd5e1'}; color: white; padding: 0.25rem 0.7rem; border-radius: 20px; font-size: 0.85rem; font-weight: 700;">
                ${problemCount} ta
            </span>
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

    let html = `<div style="margin-bottom: 0.8rem; color: var(--primary); font-weight: 700; font-size: 1.05rem; text-align: center;">🏫 ${escapeHtml(clsName)} sinfi (Top 7)</div>`;

    if (problemStudents.length === 0) {
        html += `<p style="text-align:center; color:#94a3b8; padding: 1rem;">Bu sinfda 3+ marta qo'ng'iroq qilingan o'quvchilar yo'q.</p>`;
    } else {
        problemStudents.forEach((s, ix) => {
            const calls = getStudentCallCount(s);
            html += `
            <div class="history-item" style="flex-direction: column; align-items: flex-start; margin-bottom: 0.6rem; padding: 0.9rem; border-left: 4px solid var(--danger); background: #fffcfc; border-radius: 10px;">
                <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
                    <b style="font-size: 1.05rem;">${ix + 1}. 👤 ${escapeHtml(s.firstName)} ${escapeHtml(s.lastName)}</b>
                    <span style="background: var(--danger); color: white; padding: 0.2rem 0.6rem; border-radius: 12px; font-size: 0.82rem; font-weight: 700;">
                        📞 ${calls} marta
                    </span>
                </div>
                <div style="color: var(--text-muted); font-size: 0.85rem; margin-top: 0.3rem;">📞 ${escapeHtml(s.phone)}</div>
                <div style="color: #64748b; font-size: 0.82rem; margin-top: 0.3rem;"><i>Izoh:</i> ${escapeHtml(s.notes || "Yo'q")}</div>
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
                <div style="padding: 0.7rem 1rem; cursor: pointer; border-bottom: 1px solid #f1f5f9; font-size: 0.95rem; transition: background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'" onmousedown="markUrgent('${m.id}')">
                    👤 <b>${escapeHtml(m.firstName)} ${escapeHtml(m.lastName)}</b>
                    <span style="color: var(--primary); font-size: 0.8rem; margin-left: 0.5rem; background: var(--primary-light); padding: 0.1rem 0.5rem; border-radius: 12px;">${escapeHtml(m.classGroup || 'Asosiy')}</span>
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
            <div style="background: linear-gradient(135deg, var(--danger), #dc2626); color: white; padding: 0.35rem 0.9rem; border-radius: 50px; font-size: 0.88rem; font-weight: 700; display: flex; align-items: center; gap: 0.4rem; box-shadow: 0 3px 10px rgba(239,68,68,0.3);">
                🚨 ${escapeHtml(u.firstName)} ${escapeHtml(u.lastName)}
                <button onclick="resolveUrgent('${u.id}')" style="background: rgba(255,255,255,0.9); color: var(--danger); border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; font-size: 0.7rem; display: flex; align-items: center; justify-content: center;" title="Bekor qilish">✕</button>
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
    let html = `<option value="all">📁 Barcha sinflar</option>`;
    const uniqueClasses = [...classes].sort();
    uniqueClasses.forEach(c => {
        html += `<option value="${escapeHtml(c)}">🏫 ${escapeHtml(c)}</option>`;
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

window.exportToExcel = () => {
    if (typeof XLSX === 'undefined') {
        alert("Kutubxona yuklanmoqda, 2-3 soniya kuting...");
        return;
    }
    const data = getExportData();
    if (data.length === 0) { alert("Ma'lumot yo'q!"); return; }

    const excelData = data.map((s, index) => ({
        "T/r": index + 1,
        "Ism Familiya": s.firstName + ' ' + s.lastName,
        "Sinf": s.classGroup || 'Asosiy',
        "Ota-ona raqami": s.phone,
        "Izoh": s.isUrgent ? s.urgentReason : (s.notes || ""),
        "Oxirgi qo'ng'iroq": s.lastCall ? formatDateUi(s.lastCall) : "Qilinmagan",
        "Holati": s.isUrgent ? "TEZDA QO'NG'IROQ" : (s.lastCall ? "Gaplashilgan" : "Tel qilinmagan")
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Hisobot");

    const d = new Date();
    const fileName = `Ustoz_Aliyev_${d.getFullYear()}_${d.getMonth() + 1}_${d.getDate()}.xlsx`;

    try {
        const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/octet-stream' });
        const file = new File([blob], fileName, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            navigator.share({ title: 'Excel Hisobot', files: [file] })
                .then(() => closeExportModal())
                .catch(() => closeExportModal());
        } else {
            openTelegramAfterDownload();
            XLSX.writeFile(workbook, fileName);
            closeExportModal();
        }
    } catch (e) {
        console.error(e);
        openTelegramAfterDownload();
        XLSX.writeFile(workbook, fileName);
        closeExportModal();
    }
};

window.exportToWord = () => {
    const data = getExportData();
    if (data.length === 0) { alert("Ma'lumot yo'q!"); return; }

    let htmlContent = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><title>Hisobot</title></head><body>
    <h2 style="text-align:center;">Ustoz Aliyev - O'quvchi Hisoboti</h2>
    <table border="1" style="border-collapse: collapse; width: 100%;">
        <tr style="background-color: #f1f5f9;">
            <th style="padding: 5px;">T/r</th><th style="padding: 5px;">Ism Familiya</th><th style="padding: 5px;">Sinf</th><th style="padding: 5px;">Tel</th><th style="padding: 5px;">Holati / Izoh</th><th style="padding: 5px;">Oxirgi tel</th>
        </tr>`;

    data.forEach((s, idx) => {
        let holat = s.isUrgent ? `<b>⚠️ DIQQAT: ${s.urgentReason}</b>` : (s.notes || '-');
        let oxirgiTel = s.lastCall ? formatDateUi(s.lastCall) : "QILINMAGAN";

        htmlContent += `
        <tr>
            <td style="padding: 5px;">${idx + 1}</td>
            <td style="padding: 5px;">${s.firstName} ${s.lastName}</td>
            <td style="padding: 5px;">${s.classGroup || 'Asosiy'}</td>
            <td style="padding: 5px;">${s.phone}</td>
            <td style="padding: 5px;">${holat}</td>
            <td style="padding: 5px;">${oxirgiTel}</td>
        </tr>`;
    });

    htmlContent += `</table></body></html>`;

    const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
    const d = new Date();
    const fileName = `Ustoz_Aliyev_${d.getFullYear()}_${d.getMonth() + 1}_${d.getDate()}.doc`;
    const file = new File([blob], fileName, { type: 'application/msword' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ title: 'Word Hisobot', files: [file] })
            .then(() => closeExportModal())
            .catch(() => closeExportModal());
    } else {
        openTelegramAfterDownload();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        closeExportModal();
    }
};

window.exportToTelegramText = () => {
    const data = getExportData();
    if (data.length === 0) { alert("Ma'lumot yo'q!"); return; }

    let reportList = [];
    data.forEach(s => {
        if (s.isUrgent) {
            reportList.push(`🚨 ${s.firstName} ${s.lastName} - (${s.urgentReason || 'Muammo'})`);
        } else {
            const daysAgo = calculateDaysAgo(s.lastCall);
            if (s.lastCall === null) {
                reportList.push(`🔴 ${s.firstName} ${s.lastName} - (Hali qo'ng'iroq qilinmagan)`);
            } else if (daysAgo !== null && daysAgo >= 3) {
                reportList.push(`🔴 ${s.firstName} ${s.lastName} - (${daysAgo} kun o'tdi)`);
            }
        }
    });

    if (reportList.length === 0) {
        alert("Hammasi a'lo! Muammoli o'quvchi yo'q.");
        return;
    }

    const filterText = document.getElementById('exportClassFilter').options[document.getElementById('exportClassFilter').selectedIndex].text;
    const todayStr = new Date().toLocaleDateString('uz-UZ');

    let message = `📅 Kunlik Hisobot (${todayStr}, ${filterText})\n\n`;
    message += `⚠️ Quyidagi o'quvchilar bo'yicha ogohlantirish:\n\n`;
    message += reportList.map((item, i) => `${i + 1}. ${item}`).join('\n');
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
        <div class="student-card stagger-item" style="animation-delay: ${0.1 + (i * 0.05)}s;">
            <div class="student-info">
                <h3 style="color: var(--primary);">👤 Login: ${escapeHtml(u.login)}</h3>
                <p>🔑 Parol: ${escapeHtml(u.password)}</p>
            </div>
            <div class="actions">
                <button class="call-btn" style="background: var(--warning); box-shadow: 0 3px 0 #b45309;" onclick="viewAsTeacher('${u.login}')">👁 Kirish</button>
                <button class="delete-btn" onclick="deleteTeacher('${u.login}')" title="O'chirish">🗑️</button>
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

// ─── Start Application ───
initializeApp();

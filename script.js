// Login Logic
const MAXFIY_PAROL = '2225';

const loginScreen = document.getElementById('loginScreen');
const appContainer = document.getElementById('appContainer');
const loginForm = document.getElementById('loginForm');
const passwordInput = document.getElementById('passwordInput');
const loginError = document.getElementById('loginError');

if (sessionStorage.getItem('smart_logged_in') === 'true') {
    if(loginScreen) loginScreen.style.display = 'none';
    if(appContainer) appContainer.style.display = 'block';
}

if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (passwordInput.value === MAXFIY_PAROL) {
            sessionStorage.setItem('smart_logged_in', 'true');
            loginScreen.style.display = 'none';
            appContainer.style.display = 'block';
        } else {
            loginError.style.display = 'block';
        }
    });
}

// State
let students = JSON.parse(localStorage.getItem('smart_students')) || [];
let classes = JSON.parse(localStorage.getItem('smart_classes')) || [];
let currentClassFilter = 'all';

// Migrate old data on startup if needed
if (classes.length === 0) {
    classes = [...new Set(students.map(s => s.classGroup || 'Asosiy'))];
    if (classes.length === 0) classes = ['Asosiy'];
    localStorage.setItem('smart_classes', JSON.stringify(classes));
}

// DOM Elements
const form = document.getElementById('addStudentForm');
const searchInput = document.getElementById('searchInput');
const studentList = document.getElementById('studentList');
const mainClassFilter = document.getElementById('mainClassFilter');
const todayCallCountEl = document.getElementById('todayCallCount');
const mostIgnoredStudentEl = document.getElementById('mostIgnoredStudent');
const classGroupSelect = document.getElementById('classGroup');
const newClassInput = document.getElementById('newClassInput');

// Draft Elements
const draftInput = document.getElementById('draftInput');
const draftSuggest = document.getElementById('draftSuggest');
const urgentBadges = document.getElementById('urgentBadges');

// Utility to handle date logic without timezone issues
function getTodayString() {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

// Ensure unique IDs
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Calculate days between two date strings (YYYY-MM-DD)
function calculateDaysAgo(dateString) {
    if (!dateString) return null;
    const past = new Date(dateString);
    // Ignore time parts
    past.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = Math.abs(today - past);
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

// Format date nicely (DD.MM.YYYY)
function formatDateUi(dateStr) {
    if(!dateStr) return 'Hech qachon';
    const [y, m, d] = dateStr.split('-');
    return `${d}.${m}.${y}`;
}

// Save to LocalStorage
function saveStudents() {
    localStorage.setItem('smart_students', JSON.stringify(students));
    render();
}

// Process student to determine tags and status
function evaluateStudent(student) {
    const daysAgo = calculateDaysAgo(student.lastCall);
    let borderClass = 'status-neutral';
    let tags = [];
    
    // Call Status Logic
    if (student.lastCall === null) {
        borderClass = 'status-bad';
        tags.push(`<span class="tag tag-red">🔴 TEL QILISH KERAK!</span>`);
    } else if (daysAgo === 0) {
        borderClass = 'status-good';
        tags.push(`<span class="tag tag-green">🟢 Yangi qo'ng'iroq (Bugun: ${formatDateUi(student.lastCall)})</span>`);
    } else if (daysAgo >= 3) {
        borderClass = 'status-bad';
        tags.push(`<span class="tag tag-red">🔴 ${daysAgo} kun o'tdi, TEL QILING! (Oxirgi marta: ${formatDateUi(student.lastCall)})</span>`);
    } else {
        borderClass = 'status-neutral';
        tags.push(`<span class="tag tag-blue">🔵 Oxirgi tel: ${formatDateUi(student.lastCall)}</span>`);
    }
    
    // Tag for class
    tags.unshift(`<span class="tag" style="background:#e2e8f0; color:#475569;">🏫 ${student.classGroup || 'Asosiy'}</span>`);

    if (student.isUrgent) {
        borderClass = 'status-bad';
        tags.unshift(`<span class="tag tag-red" style="font-size: 0.95rem;">🚨 TEZDA QO'NG'IROQ: ${student.urgentReason || 'Qoralama'}</span>`);
    }

    // Problem Signal Idea Logic
    const hasProblem = student.notes.toLowerCase().includes('dars qilm');
    let problemHtml = '';
    if (hasProblem) {
        problemHtml = `<div class="problem-signal">⚠️ Ota-onaga tezroq qo'ng'iroq qiling! (Sabab: Dars qilmayapti)</div>`;
    }

    return { borderClass, tags: tags.join(''), problemHtml, daysAgo };
}

// Render the list
function render() {
    // Generate Main Filter Options from global classes
    const uniqueClasses = [...classes].sort();
    
    let optionsHtml = `<option value="all">📁 Barcha sinflar</option>`;
    uniqueClasses.forEach(cls => {
        optionsHtml += `<option value="${cls}">🏫 ${cls} sinfi</option>`;
    });
    if(mainClassFilter) {
        mainClassFilter.innerHTML = optionsHtml;
        mainClassFilter.value = currentClassFilter;
    }

    const searchTerm = searchInput.value.toLowerCase().trim();
    
    // Filter by class and search
    let filtered = students.filter(s => {
        const matchesClass = currentClassFilter === 'all' || (s.classGroup || 'Asosiy') === currentClassFilter;
        const matchesSearch = s.firstName.toLowerCase().includes(searchTerm) || 
                              s.lastName.toLowerCase().includes(searchTerm) ||
                              s.phone.includes(searchTerm);
        return matchesClass && matchesSearch;
    });

    // Bring urgent students to top
    filtered.sort((a, b) => {
        if (a.isUrgent && !b.isUrgent) return -1;
        if (!a.isUrgent && b.isUrgent) return 1;
        return 0;
    });

    // Render list
    if (filtered.length === 0) {
        studentList.innerHTML = `<p style="text-align: center; color: #64748b;">O'quvchilar topilmadi yoki hali qo'shilmagan.</p>`;
    } else {
        studentList.innerHTML = filtered.map((student, index) => {
            const { borderClass, tags, problemHtml } = evaluateStudent(student);
            const delay = 0.9 + (index * 0.1); // Staggering
            
            // Generate last feedback html
            let lastFeedbackHtml = '';
            if (student.callHistory && student.callHistory.length > 0) {
                let sortedHistory = [...student.callHistory].sort((a,b) => new Date(b.date) - new Date(a.date));
                let lastRecord = sortedHistory[0];
                if(lastRecord) {
                    let rTeacher = lastRecord.teacherReason || "Noma'lum (Eski yozuv)";
                    let rParent = lastRecord.parentFeedback || (lastRecord.reason || "Noma'lum");
                    lastFeedbackHtml = `
                    <div style="font-size: 0.85rem; margin-top: 0.5rem; padding: 0.5rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
                        <span style="color: #64748b; display: block; margin-bottom: 0.3rem;">👨‍🏫 <b>Maqsadingiz:</b> ${rTeacher}</span>
                        <span style="color: #0284c7; display: block;">💬 <b>Ota-ona fikri:</b> ${rParent}</span>
                    </div>`;
                }
            }

            // Cleanup phone number for link
            let cleanPhone = student.phone.replace(/[^0-9+]/g, '');
            
            return `
            <div class="student-card stagger-item ${borderClass}" style="animation-delay: ${delay}s;" data-tilt data-tilt-max="5" data-tilt-glare="true" data-tilt-max-glare="0.2">
                <div class="student-info">
                    <h3>${student.firstName} ${student.lastName}</h3>
                    <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.4rem; flex-wrap: wrap;">
                        <span>📞 ${student.phone}</span>
                        <a href="tel:${cleanPhone}" class="tel-link-btn">
                            📲 Tel qilish
                        </a>
                    </div>
                    <p>📝 ${student.notes || "Izoh yo'q"}</p>
                    ${lastFeedbackHtml}
                    <div class="tags-container">
                        ${tags}
                    </div>
                    ${problemHtml}
                </div>
                <div class="actions">
                    <button class="call-btn" onclick="markCalled('${student.id}')">📞 Tel qildim</button>
                    <button class="primary-btn" style="padding: 0.6rem; margin-left: 0.5rem; background: #64748b;" onclick="openEditStudentModal('${student.id}')" title="Tahrirlash">✏️</button>
                    <button class="delete-btn" onclick="deleteStudent('${student.id}')" style="margin-left: 0.5rem;">❌</button>
                </div>
            </div>
            `;
        }).join('');
    }

    // Call VanillaTilt manually just in case for dynamic elements
    setTimeout(() => {
        if (window.VanillaTilt) {
            window.VanillaTilt.init(document.querySelectorAll(".student-card"), {
                max: 5,
                speed: 400,
                glare: true,
                "max-glare": 0.2
            });
        }
    }, 100);

    // Update Stats
    updateStats();
}

window.setClassFilter = (cls) => {
    currentClassFilter = cls;
    render();
};

// Update Dashboard Statistics
function updateStats() {
    const todayStr = getTodayString();
    
    let targetStudents = students;
    if (currentClassFilter !== 'all') {
        targetStudents = students.filter(s => (s.classGroup || 'Asosiy') === currentClassFilter);
    }
    
    const todayCalls = targetStudents.filter(s => s.lastCall === todayStr).length;
    todayCallCountEl.textContent = todayCalls;

    let mostIgnored = null;
    let maxDays = -1;

    for (let s of targetStudents) {
        if (s.lastCall === null) {
            mostIgnored = s;
            break; // Never called is the worst
        }
        const days = calculateDaysAgo(s.lastCall);
        if (days !== null && days > maxDays) {
            maxDays = days;
            mostIgnored = s;
        }
    }

    if (mostIgnored) {
        mostIgnoredStudentEl.textContent = `${mostIgnored.firstName} ${mostIgnored.lastName}`;
    } else {
        mostIgnoredStudentEl.textContent = "Hamma zo'r!";
    }
}

// Initial form UI state functions
function renderClassOptions() {
    let html = `<option value="" disabled selected>Sinfni tanlang...</option>`;
    classes.sort().forEach(c => {
        html += `<option value="${c}">${c}</option>`;
    });
    html += `<option value="_add_new_" style="font-weight: bold; color: #3b82f6;">+ Yangi sinf qo'shish...</option>`;
    if(classGroupSelect) classGroupSelect.innerHTML = html;
}

// Event: Select handle for new class
classGroupSelect.addEventListener('change', (e) => {
    if(e.target.value === '_add_new_') {
        newClassInput.style.display = 'block';
        newClassInput.setAttribute('required', 'true');
    } else {
        newClassInput.style.display = 'none';
        newClassInput.removeAttribute('required');
    }
});

// Event: Add Student
form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    let finalClass = classGroupSelect.value;
    if (finalClass === '_add_new_') {
        finalClass = newClassInput.value.trim().toUpperCase();
        if (!classes.includes(finalClass)) {
            classes.push(finalClass);
            localStorage.setItem('smart_classes', JSON.stringify(classes));
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
        lastCall: null, // YYYY-MM-DD
        dateAdded: getTodayString()
    };

    students.push(newStudent);
    saveStudents();
    form.reset();
});

// Event: Search
searchInput.addEventListener('input', render);

window.currentCallId = null;

// Action: Mark Called Modal Open
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
    if(!id) return;
    const idx = students.findIndex(s => s.id === id);
    if(idx !== -1) {
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
        
        students[idx].isUrgent = false; // Auto un-draft when called
        saveStudents();
        renderUrgentBadges();
        render(); // update UI with the new parent feedback
        closeCallFeedbackModal();
    }
};

// History Modal Functions
window.openHistoryModal = () => {
    const historyListEl = document.getElementById('historyList');
    document.getElementById('historyModal').classList.add('active');
    
    let htmlContent = '';
    
    let targetStudents = students;
    if (currentClassFilter !== 'all') {
        targetStudents = students.filter(s => (s.classGroup || 'Asosiy') === currentClassFilter);
    }
    
    const calledStudents = targetStudents.filter(s => s.lastCall !== null || (s.callHistory && s.callHistory.length > 0));

    if(calledStudents.length === 0) {
        let filterMsg = currentClassFilter !== 'all' ? "Bu sinfda hali" : "Hali";
        historyListEl.innerHTML = `<p style="text-align:center; color:#64748b;">${filterMsg} hech kimga qo'ng'iroq qilinmadi.</p>`;
        return;
    }

    calledStudents.forEach(s => {
        let historyHtml = '';
        let records = [];

        if (s.callHistory && s.callHistory.length > 0) {
            records = [...s.callHistory];
        } else if (s.lastCall) {
            records = [ { date: s.lastCall + 'T12:00:00.000Z', reason: '' } ];
        }

        // Sort this student's records descending (newest first)
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
                    reasonStr = `<div style="margin-top: 0.3rem; padding-left: 0.8rem; border-left: 2px solid #cbd5e1;">
                         <span style="color:#64748b; font-size: 0.85rem; display: block;">👨‍🏫 Maqsad: ${record.teacherReason || '-'}</span>
                         <span style="color:#0284c7; font-size: 0.85rem; display: block;">💬 Ota-ona fikri: ${record.parentFeedback || '-'}</span>
                     </div>`;
                } else if(record.reason) { 
                    reasonStr = `<br><span style="color:#64748b; font-size: 0.85rem; margin-top: 0.2rem; display: inline-block;">💬 <b>Suhbat:</b> ${record.reason}</span>`;
                }
            }

            const d = new Date(dateRaw);
            const niceDate = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth()+1).padStart(2, '0')}.${d.getFullYear()} — <b>${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}</b>`;
            historyHtml += `<li style="margin-bottom: 0.4rem; border-bottom: 1px dashed #cbd5e1; padding-bottom: 0.4rem;">🕰 ${niceDate}${reasonStr}</li>`;
        });

        htmlContent += `
            <div class="history-item" style="flex-direction: column; align-items: flex-start; margin-bottom: 1rem;">
                <div style="margin-bottom: 0.8rem;">
                    <b style="font-size: 1.1rem; color: var(--primary);">👤 ${s.firstName} ${s.lastName}</b>
                    <div style="color: var(--text-muted); font-size: 0.9rem; margin-top: 0.2rem;">📞 ${s.phone}</div>
                </div>
                <ul style="list-style: none; padding-left: 0; width: 100%; color: var(--text-muted); font-size: 0.95rem;">
                    ${historyHtml}
                </ul>
            </div>
        `;
    });

    historyListEl.innerHTML = htmlContent;
};

window.closeHistoryModal = () => {
    document.getElementById('historyModal').classList.remove('active');
};

// Class Manager Modal Functions
window.openClassManager = () => {
    const listEl = document.getElementById('classListContainer');
    document.getElementById('classManageModal').classList.add('active');
    
    let html = '';
    const sortedClasses = [...classes].sort();
    
    sortedClasses.forEach(cls => {
        html += `
        <div class="history-item" style="display: flex; justify-content: space-between; align-items: center; padding: 0.8rem;">
            <b>${cls}</b>
            <div style="display: flex; gap: 0.8rem; font-size: 1.2rem;">
                <button onclick="renameClass('${cls}')" style="background:none; border:none; cursor:pointer;" title="O'zgartirish">✏️</button>
                <button onclick="removeClass('${cls}')" style="background:none; border:none; cursor:pointer;" title="O'chirish">🗑️</button>
            </div>
        </div>
        `;
    });

    if (sortedClasses.length === 0) {
        html = '<p style="text-align:center; color:#64748b;">Sinflar mavjud emas</p>';
    }
    listEl.innerHTML = html;
};

window.closeClassManager = () => {
    document.getElementById('classManageModal').classList.remove('active');
};

window.renameClass = (oldName) => {
    const newName = prompt(`"${oldName}" nomini quyidagiga o'zgartirish:`, oldName);
    if (newName && newName.trim() !== '' && newName.trim() !== oldName) {
        const finalName = newName.trim().toUpperCase();
        
        // Update the classes array
        classes = classes.map(c => c === oldName ? finalName : c);
        // Ensure uniqueness
        classes = [...new Set(classes)];
        localStorage.setItem('smart_classes', JSON.stringify(classes));
        
        // Update all students connected to this class
        students.forEach(s => {
            if (s.classGroup === oldName) {
                s.classGroup = finalName;
            }
        });
        saveStudents();
        
        // Retain selection if we are viewing the renamed class
        if (currentClassFilter === oldName) currentClassFilter = finalName;
        
        openClassManager(); // Refresh modal
        renderClassOptions(); // Refresh dropdown
        render(); // Refresh main list
    }
};

window.removeClass = (clsName) => {
    if (confirm(`Diqqat! "${clsName}" sinfini o'chirasizmi?\n\n(Dastur xavfsizligi uchun bu sinfdagi barcha o'quvchilar "Asosiy" guruhiga o'tkaziladi. O'quvchilar o'chib ketmaydi.)`)) {
        classes = classes.filter(c => c !== clsName);
        localStorage.setItem('smart_classes', JSON.stringify(classes));

        students.forEach(s => {
            if (s.classGroup === clsName) {
                s.classGroup = 'Asosiy';
            }
        });
        saveStudents();
        
        if (currentClassFilter === clsName) currentClassFilter = 'all';

        openClassManager();
        renderClassOptions();
        render();
    }
};

// Action: Delete Student
window.deleteStudent = (id) => {
    if(confirm("Haqiqatan ham bu o'quvchini o'chirasizmi?")) {
        students = students.filter(s => s.id !== id);
        saveStudents();
    }
};

// Edit Student Modal Functions
window.openEditStudentModal = (id) => {
    const student = students.find(s => s.id === id);
    if(!student) return;

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
if(editStudentForm) {
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

// Draft Functionality
if (draftInput) {
    draftInput.addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase().trim();
        if(!val) {
            draftSuggest.style.display = 'none';
            return;
        }
        
        let targetStudents = currentClassFilter === 'all' 
            ? students 
            : students.filter(s => (s.classGroup || 'Asosiy') === currentClassFilter);

        const matches = targetStudents.filter(s => 
            !s.isUrgent && (s.firstName.toLowerCase().includes(val) || s.lastName.toLowerCase().includes(val))
        );

        if(matches.length > 0) {
            draftSuggest.style.display = 'block';
            draftSuggest.innerHTML = matches.map(m => `
                <div style="padding: 0.8rem; cursor: pointer; border-bottom: 1px solid #e2e8f0; font-size: 1rem; transition: background 0.2s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='white'" onmousedown="markUrgent('${m.id}')">
                    👤 <b>${m.firstName} ${m.lastName}</b> 
                    <span style="color: var(--primary); font-size: 0.85rem; margin-left: 0.5rem; background: #e0f2fe; padding: 0.1rem 0.5rem; border-radius: 12px;">${m.classGroup || 'Asosiy'}</span>
                </div>
            `).join('');
        } else {
            draftSuggest.style.display = 'none';
        }
    });

    draftInput.addEventListener('blur', () => { setTimeout(() => { draftSuggest.style.display = 'none'; }, 200) });
}

window.markUrgent = (id) => {
    const idx = students.findIndex(s => s.id === id);
    if(idx !== -1) {
        students[idx].isUrgent = true;
        students[idx].urgentReason = "Darsda qatnashmagani uchun";
        saveStudents();
        if(draftInput) draftInput.value = '';
        renderUrgentBadges();
    }
};

window.resolveUrgent = (id) => {
    const idx = students.findIndex(s => s.id === id);
    if(idx !== -1) {
        students[idx].isUrgent = false;
        saveStudents();
        renderUrgentBadges();
    }
};

window.renderUrgentBadges = () => {
    if(!urgentBadges) return;
    const urgents = students.filter(s => s.isUrgent && (currentClassFilter === 'all' || (s.classGroup || 'Asosiy') === currentClassFilter));
    
    if (urgents.length > 0) {
        urgentBadges.innerHTML = urgents.map(u => `
            <div style="background: var(--danger); color: white; padding: 0.4rem 1rem; border-radius: 20px; font-size: 0.95rem; font-weight: bold; display: flex; align-items: center; gap: 0.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                🚨 ${u.firstName} ${u.lastName}
                <button onclick="resolveUrgent('${u.id}')" style="background: white; color: var(--danger); border: none; border-radius: 50%; width: 22px; height: 22px; cursor: pointer; font-weight: bold; display: flex; align-items: center; justify-content: center; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'" title="Qoralama yechildi">❌</button>
            </div>
        `).join('');
    } else {
        urgentBadges.innerHTML = '';
    }
}

// Export Modal Logic
window.openExportModal = () => {
    document.getElementById('exportModal').classList.add('active');
    
    // Populate select
    const select = document.getElementById('exportClassFilter');
    let html = `<option value="all">📁 Barcha sinflar (Umumiy hisobot)</option>`;
    const uniqueClasses = [...classes].sort();
    uniqueClasses.forEach(c => {
        html += `<option value="${c}">🏫 ${c}</option>`;
    });
    if(select) select.innerHTML = html;
};

window.closeExportModal = () => {
    document.getElementById('exportModal').classList.remove('active');
};

function getExportData() {
    const filter = document.getElementById('exportClassFilter').value;
    let targetStudents = filter === 'all' 
        ? students 
        : students.filter(s => (s.classGroup || 'Asosiy') === filter);
        
    return targetStudents.sort((a,b) => {
        if(a.isUrgent && !b.isUrgent) return -1;
        if(!a.isUrgent && b.isUrgent) return 1;
        return 0;
    });
}

function openTelegramAfterDownload() {
    window.open('https://t.me/aliliyev_2225', '_blank');
}

window.exportToExcel = () => {
    if(typeof XLSX === 'undefined') {
        alert("Kutubxona hozir yuklanmoqda, iltimos 2-3 soniya kuting...");
        return;
    }
    const data = getExportData();
    if(data.length === 0) { alert("Bu guruh uchun ma'lumot yo'q!"); return; }
    
    const excelData = data.map((s, index) => ({
        "T/r": index + 1,
        "Ism Familiya": s.firstName + ' ' + s.lastName,
        "Sinf": s.classGroup || 'Asosiy',
        "Ota-ona raqami": s.phone,
        "Izoh / Diqqatsizlik sababi": s.isUrgent ? s.urgentReason : (s.notes || ""),
        "Oxirgi qo'ng'iroq": s.lastCall ? formatDateUi(s.lastCall) : "Qilinmagan",
        "Holati": s.isUrgent ? "TEZDA QO'NG'IROQ" : (s.lastCall ? "Gaplashilgan" : "Tel qilinmagan")
    }));
    
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Hisobot");
    
    const d = new Date();
    const fileName = `Smart_Nazorat_${d.getFullYear()}_${d.getMonth()+1}_${d.getDate()}.xlsx`;
    
    try {
        const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/octet-stream' });
        const file = new File([blob], fileName, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            navigator.share({
                title: 'Excel Hisobot',
                files: [file]
            }).then(() => closeExportModal()).catch(() => closeExportModal());
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
    if(data.length === 0) { alert("Bu guruh uchun ma'lumot yo'q!"); return; }
    
    let htmlContent = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><title>Hisobot</title></head><body>
    <h2 style="text-align:center;">Smart Nazorat - O'quvchilar Hisoboti</h2>
    <table border="1" style="border-collapse: collapse; width: 100%; border: 1px solid black;">
        <tr style="background-color: #f1f5f9;">
            <th style="padding: 5px;">T/r</th><th style="padding: 5px;">Ism Familiya</th><th style="padding: 5px;">Sinf</th><th style="padding: 5px;">Tel</th><th style="padding: 5px;">Holati / Izoh</th><th style="padding: 5px;">Oxirgi tel</th>
        </tr>
    `;
    
    data.forEach((s, idx) => {
        let holat = s.isUrgent ? `<b>⚠️ DIQQAT: ${s.urgentReason}</b>` : (s.notes ? s.notes : '-');
        let oxirgiTel = s.lastCall ? formatDateUi(s.lastCall) : "QILINMAGAN";
        
        htmlContent += `
        <tr>
            <td style="padding: 5px;">${idx+1}</td>
            <td style="padding: 5px;">${s.firstName} ${s.lastName}</td>
            <td style="padding: 5px;">${s.classGroup || 'Asosiy'}</td>
            <td style="padding: 5px;">${s.phone}</td>
            <td style="padding: 5px;">${holat}</td>
            <td style="padding: 5px;">${oxirgiTel}</td>
        </tr>
        `;
    });
    
    htmlContent += `</table></body></html>`;
    
    const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
    const d = new Date();
    const fileName = `Smart_Nazorat_${d.getFullYear()}_${d.getMonth()+1}_${d.getDate()}.doc`;
    const file = new File([blob], fileName, { type: 'application/msword' });
    
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({
            title: 'Word Hisobot',
            files: [file]
        }).then(() => closeExportModal()).catch(() => closeExportModal());
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
    if(data.length === 0) { alert("Bu guruh uchun ma'lumot yo'q!"); return; }
    
    let reportList = [];
    data.forEach(s => {
        if (s.isUrgent) {
            reportList.push(`🚨 ${s.firstName} ${s.lastName} - (Sabab: ${s.urgentReason || 'Muammo'})`);
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
        alert("Hammasi a'lo! Hozircha ushbu guruhda muammoli o'quvchi yo'q.");
        return;
    }

    const filterText = document.getElementById('exportClassFilter').options[document.getElementById('exportClassFilter').selectedIndex].text;
    const todayStr = new Date().toLocaleDateString('uz-UZ');
    
    let message = `📅 Kunlik Hisobot (Sana: ${todayStr}, ${filterText})\n\n`;
    message += `⚠️ Ustoz, quyidagi o'quvchilar bo'yicha ogohlantirish bering:\n\n`;
    message += reportList.map((item, i) => `${i + 1}. ${item}`).join('\n');
    message += `\n\n🤖 Smart Nazorat tizimi orqali eslatma`;

    const encodedMessage = encodeURIComponent(message);
    const telegramUrl = `https://t.me/aliliyev_2225?text=${encodedMessage}`;
    window.open(telegramUrl, '_blank');
    closeExportModal();
};

// Initial Render
renderClassOptions();
renderUrgentBadges();
render();

/* 
 * EXECUTION PAGE LOGIC
 * View-Only Info + Manhour Recording
 */

const DB_KEY = 'mro_collab_data';
let currentWO = null;
let timerInterval = null;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Get ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const woUid = urlParams.get('id');

    if (!woUid) {
        alert("No Work Order specified!");
        window.location.href = 'index.html';
        return;
    }

    loadData(woUid);
    
    // Global Listeners (Reusing logic from main script)
    document.getElementById('btnConflictYes').addEventListener('click', confirmJoinTeam);
    document.getElementById('btnConflictNo').addEventListener('click', () => { 
        document.getElementById('conflictModal').style.display = 'none'; pendingStart = null; 
    });
    document.getElementById('btnConfirmStatus').addEventListener('click', confirmFinalStatus);
    document.getElementById('btnSavePhoto').addEventListener('click', savePhoto);
    document.getElementById('btnSkipPhoto').addEventListener('click', skipPhoto);
    document.getElementById('photoInput').addEventListener('change', previewPhoto);

    // Timer
    timerInterval = setInterval(updateLiveTimers, 1000);
});

// --- DATA & RENDER ---

function loadData(uid) {
    const raw = localStorage.getItem(DB_KEY);
    const allWos = raw ? JSON.parse(raw) : [];
    
    currentWO = allWos.find(w => w.uid === uid);

    if (!currentWO) {
        alert("Work Order not found.");
        window.location.href = 'index.html';
        return;
    }

    renderPage();
}

function saveData() {
    // We need to update the specific WO in the main array
    const raw = localStorage.getItem(DB_KEY);
    let allWos = raw ? JSON.parse(raw) : [];
    
    const idx = allWos.findIndex(w => w.uid === currentWO.uid);
    if (idx !== -1) {
        allWos[idx] = currentWO; // Update memory
        localStorage.setItem(DB_KEY, JSON.stringify(allWos)); // Save to DB
        renderPage(); // Re-render this page
    }
}

function renderPage() {
    const container = document.getElementById('executionContainer');
    container.innerHTML = '';

    // 1. Static Banner (View Only)
    const headerHtml = `
        <div class="wo-static-banner">
            <div class="wo-info-grid">
                <div class="info-item"><label>WO No</label><span>${currentWO.header.wo}</span></div>
                <div class="info-item"><label>Reg</label><span>${currentWO.header.reg}</span></div>
                <div class="info-item"><label>Part Desc</label><span>${currentWO.header.desc}</span></div>
                <div class="info-item"><label>Customer</label><span>${currentWO.header.cust}</span></div>
            </div>
        </div>
    `;
    container.innerHTML += headerHtml;

    // 2. Findings List
    currentWO.findings.forEach(f => {
        container.appendChild(createFindingComponent(f));
    });
    
    updateGlobalIndicator();
}

function createFindingComponent(f) {
    const card = document.createElement('div');
    card.className = 'clean-finding';

    // Status Logic for Header
    const activeCount = f.mh.activeSessions.length;
    let statusText = "OPEN";
    let statusColor = "#6c757d"; // Gray

    if (activeCount > 0) {
        statusText = `ACTIVE (${activeCount})`;
        statusColor = "#ffc107"; // Yellow/Orange
    } else if (f.mh.logs.length > 0 && f.status !== 'CLOSED') {
        statusText = "ON HOLD";
        statusColor = "#17a2b8"; // Blue
    } else if (f.status === 'CLOSED') {
        statusText = "CLOSED";
        statusColor = "#28a745"; // Green
    }

    const isClosed = f.status === 'CLOSED';

    // Logs Table Generation
    let logsHtml = f.mh.logs.map(l => `
        <tr>
            <td>${formatDate(l.stop)}</td>
            <td><strong>${l.emp}</strong></td>
            <td>${l.task}</td>
            <td>${formatMs(l.duration)}</td>
        </tr>
    `).join('');
    if (logsHtml === '') logsHtml = '<tr><td colspan="4" style="text-align:center; color:#999;">No records yet</td></tr>';

    card.innerHTML = `
        <!-- HEADER: No + Status -->
        <div class="cf-header" style="border-left: 5px solid ${statusColor}">
            <div class="cf-title">Finding #${f.num}</div>
            <div style="font-size:0.75rem; font-weight:bold; color:${statusColor}; border:1px solid ${statusColor}; padding:2px 8px; border-radius:12px;">
                ${statusText}
            </div>
        </div>

        <!-- BODY: Description (Read Only) -->
        <div class="cf-desc-box">
            <label style="font-size:0.7rem; color:#999; text-transform:uppercase;">Description / Discrepancy</label>
            <div style="margin-top:5px;">${f.desc || "<em>No description provided.</em>"}</div>
        </div>

        <!-- DROPDOWN 1: INFO & MATERIALS -->
        <button class="accordion-btn" onclick="toggleAccordion(this)">
            <span><i class="fas fa-info-circle"></i> Info & Materials</span>
            <i class="fas fa-chevron-down"></i>
        </button>
        <div class="accordion-content">
            ${f.photo ? `<div style="margin-bottom:15px;"><img src="${f.photo}" style="max-width:100px; border:1px solid #ccc; padding:2px;"><br><small>Reference Image</small></div>` : ''}
            
            <div style="font-size:0.85rem; margin-bottom:10px;">
                <strong>Action Given:</strong><br>
                Please rectify per CMM 32-40-05. (Static Text)
            </div>

            <table class="info-table">
                <thead><tr><th>Material / P/N</th><th>Qty</th><th>Status</th></tr></thead>
                <tbody>
                    ${f.materials.map(m => `
                        <tr>
                            <td>${m.name}</td>
                            <td>${m.qty}</td>
                            <td><span class="avail-badge">In Stock</span></td> 
                        </tr>
                    `).join('')}
                    ${f.materials.length === 0 ? '<tr><td colspan="3" style="font-style:italic">No materials listed</td></tr>' : ''}
                </tbody>
            </table>
        </div>

        <!-- DROPDOWN 2: MANHOUR RECORD (The Workspace) -->
        <button class="accordion-btn" onclick="toggleAccordion(this)">
            <span><i class="fas fa-clock"></i> Manhour Record</span>
            <i class="fas fa-chevron-down"></i>
        </button>
        <div class="accordion-content" style="${activeCount > 0 ? 'display:block' : ''}"> <!-- Auto-open if active -->
            <div class="mh-record-box">
                
                <!-- Active Mechanics -->
                ${activeCount > 0 ? `
                <div class="active-mechanics">
                    ${f.mh.activeSessions.map(s => `
                        <div class="mech-item">
                            <span><i class="fas fa-user-cog"></i> <b>${s.emp}</b></span>
                            <span id="timer-${f.id}-${s.emp}" class="mech-timer">00:00:00</span>
                        </div>
                    `).join('')}
                </div>` : ''}

                <!-- Inputs -->
                <div class="mh-inputs">
                    <input type="text" id="emp-${f.id}" placeholder="Your Emp ID" ${isClosed ? 'disabled' : ''}>
                    <input type="text" id="task-${f.id}" placeholder="Task Code" ${isClosed ? 'disabled' : ''}>
                </div>

                <!-- Controls -->
                <div class="action-btns">
                    ${!isClosed ? 
                        `<button class="btn-success" onclick="initiateStart('${f.id}')">Start Job</button>` : 
                        `<button class="btn-success" disabled>Closed</button>`
                    }
                    ${activeCount > 0 ? 
                        `<button class="btn-danger" onclick="initiateStop('${f.id}')">Stop Job</button>` : 
                        `<button class="btn-danger" disabled>Stop</button>`
                    }
                </div>

                <!-- Logs History -->
                <div style="margin-top:15px;">
                    <label style="font-size:0.7rem; color:#888;">HISTORY LOG</label>
                    <table class="info-table" style="margin-top:5px;">
                        <thead><tr><th>Date</th><th>Who</th><th>Task</th><th>Dur</th></tr></thead>
                        <tbody>${logsHtml}</tbody>
                    </table>
                </div>

            </div>
        </div>
    `;
    return card;
}

// --- ACCORDION LOGIC ---
function toggleAccordion(btn) {
    btn.classList.toggle('active');
    const content = btn.nextElementSibling;
    if (content.style.display === "block") {
        content.style.display = "none";
    } else {
        content.style.display = "block";
    }
}

// --- REUSED MANHOUR LOGIC (Simplified for Single WO Context) ---

let pendingStart = null;
let pendingStop = null;

function initiateStart(fid) {
    const f = currentWO.findings.find(x => x.id === fid);
    const emp = document.getElementById(`emp-${fid}`).value.trim();
    const task = document.getElementById(`task-${fid}`).value.trim();

    if(!emp || !task) { alert("Emp ID & Task required"); return; }
    
    // Check local duplicate
    if(f.mh.activeSessions.find(s => s.emp.toLowerCase() === emp.toLowerCase())) {
        alert("You are already active!"); return;
    }

    if(f.mh.activeSessions.length > 0) {
        // Conflict
        pendingStart = { fid, emp, task };
        const list = document.getElementById('activeUserList');
        list.innerHTML = f.mh.activeSessions.map(s => `<li>${s.emp}</li>`).join('');
        document.getElementById('conflictModal').style.display = 'block';
    } else {
        executeStart(fid, emp, task);
    }
}

function confirmJoinTeam() {
    if(pendingStart) executeStart(pendingStart.fid, pendingStart.emp, pendingStart.task);
    document.getElementById('conflictModal').style.display = 'none';
}

function executeStart(fid, emp, task) {
    const f = currentWO.findings.find(x => x.id === fid);
    f.mh.activeSessions.push({ start: new Date().toISOString(), emp, task });
    f.status = 'IN_PROGRESS';
    saveData();
}

function initiateStop(fid) {
    const f = currentWO.findings.find(x => x.id === fid);
    
    if(f.mh.activeSessions.length === 1) {
        prepareStop(fid, f.mh.activeSessions[0].emp);
    } else {
        const container = document.getElementById('stopUserButtons');
        container.innerHTML = f.mh.activeSessions.map(s => 
            `<button class="user-btn" onclick="prepareStop('${fid}', '${s.emp}')">${s.emp}</button>`
        ).join('');
        document.getElementById('stopSelectModal').style.display = 'block';
    }
}

function prepareStop(fid, emp) {
    document.getElementById('stopSelectModal').style.display = 'none';
    pendingStop = { fid, emp, stopTime: new Date().toISOString() };
    
    const f = currentWO.findings.find(x => x.id === fid);
    if(f.mh.activeSessions.length === 1) {
        document.getElementById('statusModal').style.display = 'block';
    } else {
        finalizeStop(false);
    }
}

function confirmFinalStatus() {
    const status = document.querySelector('input[name="taskStatus"]:checked').value;
    finalizeStop(status === 'CLOSED', status);
}

function finalizeStop(isClosed, status = 'ON_HOLD') {
    const { fid, emp, stopTime } = pendingStop;
    const f = currentWO.findings.find(x => x.id === fid);
    const idx = f.mh.activeSessions.findIndex(s => s.emp === emp);
    
    if(idx > -1) {
        const s = f.mh.activeSessions[idx];
        const dur = new Date(stopTime) - new Date(s.start);
        f.mh.logs.push({ start: s.start, stop: stopTime, duration: dur, emp: s.emp, task: s.task });
        f.mh.activeSessions.splice(idx, 1);
    }
    
    if(f.mh.activeSessions.length === 0) f.status = status;
    document.getElementById('statusModal').style.display = 'none';

    if(isClosed) {
        document.getElementById('photoModal').style.display = 'block';
    } else {
        saveData();
    }
}

// --- PHOTO ---
let tempImg = null;
function previewPhoto(e) {
    const file = e.target.files[0];
    if(file) {
        const r = new FileReader();
        r.onload = (ev) => { tempImg = ev.target.result; document.getElementById('fileNameDisplay').innerText = file.name; document.getElementById('btnSavePhoto').disabled=false; }
        r.readAsDataURL(file);
    }
}
function savePhoto() {
    if(pendingStop && tempImg) {
        const f = currentWO.findings.find(x => x.id === pendingStop.fid);
        f.photo = tempImg;
        saveData();
    }
    document.getElementById('photoModal').style.display = 'none';
}
function skipPhoto() { document.getElementById('photoModal').style.display = 'none'; saveData(); }


// --- UTILS ---
function formatDate(iso) {
    const d = new Date(iso);
    return `${d.getDate()}/${d.getMonth()+1} ${d.getHours()}:${d.getMinutes() < 10 ? '0'+d.getMinutes() : d.getMinutes()}`;
}
function formatMs(ms) {
    let s = Math.floor((ms/1000)%60);
    let m = Math.floor((ms/(1000*60))%60);
    let h = Math.floor(ms/(1000*60*60));
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
function pad(n) { return n<10?'0'+n:n; }

function updateLiveTimers() {
    if(!currentWO) return;
    const now = new Date();
    currentWO.findings.forEach(f => {
        f.mh.activeSessions.forEach(s => {
            const el = document.getElementById(`timer-${f.id}-${s.emp}`);
            if(el) el.innerText = formatMs(now - new Date(s.start));
        });
    });
}
function updateGlobalIndicator() {
    // Optional implementation
}

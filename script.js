/**
 * AIRCRAFT MAINTENANCE COLLABORATIVE WO SYSTEM
 * Pure Vanilla JavaScript | LocalStorage Persistence
 */

// --- INITIAL DATA STRUCTURE ---
const INITIAL_DATA = {
    woNumber: "WO-2024-0092-A1",
    customer: "Global Aero Logistics",
    registration: "PK-GLL",
    partDescription: "CFM56-7B Engine Inlet Cowl",
    pn: "335-076-401-0",
    sn: "ENG-882910",
    findings: [
        { id: "01", status: "OPEN", description: "Rivets missing on outer skin panel at clock pos 3:00.", action: "Replace missing rivets IAW AMM 51-40-00", materials: [{pn: "MS20470AD4-5", desc: "Rivet", qty: 20, status: "In-Stock"}], logs: [], activeSessions: [] },
        { id: "02", status: "OPEN", description: "Corrosion detected on inner acoustic liner.", action: "Treat corrosion and apply sealant", materials: [{pn: "BMS5-95", desc: "Sealant", qty: 1, status: "AOG"}], logs: [], activeSessions: [] },
        { id: "03", status: "OPEN", description: "Impact damage on leading edge, 2-inch dent.", action: "Perform NDT inspection", materials: [], logs: [], activeSessions: [] },
        { id: "04", status: "OPEN", description: "Loose fasteners on cowl anti-ice ducting.", action: "Re-torque fasteners to 45 in-lb", materials: [], logs: [], activeSessions: [] },
        { id: "05", status: "OPEN", description: "General visual inspection of latch assemblies.", action: "Lubricate latches", materials: [{pn: "MIL-PRF-23827", desc: "Grease", qty: 1, status: "In-Stock"}], logs: [], activeSessions: [] }
    ]
};

let appState = null;

// --- CORE INITIALIZATION ---
function init() {
    const saved = localStorage.getItem('AIRCRAFT_WO_STATE');
    appState = saved ? JSON.parse(saved) : INITIAL_DATA;
    
    // Set Header Info
    document.getElementById('display-wo-no').textContent = appState.woNumber;
    document.getElementById('display-customer').textContent = appState.customer;
    document.getElementById('display-reg').textContent = appState.registration;
    document.getElementById('display-part-desc').textContent = appState.partDescription;
    document.getElementById('display-pn').textContent = appState.pn;
    document.getElementById('display-sn').textContent = appState.sn;

    renderFindings();
    startTimerEngine();
}

function save() {
    localStorage.setItem('AIRCRAFT_WO_STATE', JSON.stringify(appState));
}

// --- UI RENDERING ---
function renderFindings() {
    const container = document.getElementById('findings-container');
    container.innerHTML = '';

    appState.findings.forEach(f => {
        const card = document.createElement('div');
        card.className = `finding-card status-${f.status.toLowerCase().replace(' ', '-')}`;
        
        card.innerHTML = `
            <div class="finding-top-row">
                <span class="finding-no">FINDING #${f.id}</span>
                <span class="badge ${getStatusBadgeClass(f.status)}">${f.status}</span>
            </div>
            <div class="finding-body">
                <div>
                    <label class="info-group">Description</label>
                    <textarea class="description-box" readonly>${f.description}</textarea>
                </div>

                <div class="interact-area">
                    <!-- INFO DROPDOWN -->
                    <div class="dropdown-section">
                        <button class="dropdown-trigger" onclick="toggleDropdown(this)">
                            ℹ️ TECHNICAL INFO <span>▼</span>
                        </button>
                        <div class="dropdown-content">
                            <p><strong>Action:</strong> ${f.action}</p>
                            <div class="table-responsive">
                                <table>
                                    <thead><tr><th>P/N</th><th>Desc</th><th>Qty</th><th>Status</th></tr></thead>
                                    <tbody>
                                        ${f.materials.map(m => `<tr><td>${m.pn}</td><td>${m.desc}</td><td>${m.qty}</td><td>${m.status}</td></tr>`).join('')}
                                        ${f.materials.length === 0 ? '<tr><td colspan="4">No materials required</td></tr>' : ''}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <!-- MAN-HOUR DROPDOWN -->
                    <div class="dropdown-section">
                        <button class="dropdown-trigger" onclick="toggleDropdown(this)">
                            ⏱️ MAN-HOUR RECORD <span>▼</span>
                        </button>
                        <div class="dropdown-content active">
                            <div class="mh-input-grid">
                                <input type="text" id="emp-${f.id}" placeholder="Emp ID (e.g. 505)">
                                <input type="text" id="task-${f.id}" placeholder="Task Code">
                            </div>
                            <button class="btn btn-primary" onclick="handleStartBtn('${f.id}')">START TASK</button>
                            
                            <!-- Active Timers -->
                            <div id="active-list-${f.id}" class="active-timers-list ${f.activeSessions.length ? '' : 'hidden'}">
                                <strong>Active Sessions:</strong>
                                <div id="timers-container-${f.id}"></div>
                                <button class="btn btn-stop" style="margin-top:10px" onclick="handleStopBtn('${f.id}')">STOP TASK</button>
                            </div>

                            <!-- Performing Log -->
                            <div style="margin-top:1rem">
                                <label style="font-size:0.7rem; font-weight:bold; color:var(--text-muted)">PERFORMING LOG</label>
                                <div class="table-responsive">
                                    <table>
                                        <thead><tr><th>Time</th><th>User</th><th>Task</th><th>Act</th></tr></thead>
                                        <tbody>
                                            ${f.logs.slice().reverse().map(l => `
                                                <tr>
                                                    <td>${new Date(l.time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</td>
                                                    <td><strong>${l.empId}</strong></td>
                                                    <td>${l.taskCode}</td>
                                                    <td>${l.type}</td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

function getStatusBadgeClass(status) {
    if (status === 'CLOSED') return 'badge-success';
    if (status === 'IN PROGRESS') return 'badge-primary';
    return '';
}

function toggleDropdown(btn) {
    const content = btn.nextElementSibling;
    content.classList.toggle('active');
    btn.querySelector('span').textContent = content.classList.contains('active') ? '▲' : '▼';
}

// --- LOGIC: START TASK ---
function handleStartBtn(findingId) {
    const empId = document.getElementById(`emp-${findingId}`).value.trim();
    const taskCode = document.getElementById(`task-${findingId}`).value.trim();

    if (!empId || !taskCode) {
        alert("Please enter both Employee ID and Task Code.");
        return;
    }

    const finding = appState.findings.find(f => f.id === findingId);
    
    // Check if finding is already closed
    if(finding.status === 'CLOSED') {
        alert("Finding is closed.");
        return;
    }

    // Conflict Check: Is someone else working?
    if (finding.activeSessions.length > 0) {
        const activeNames = finding.activeSessions.map(s => s.empId).join(', ');
        showModal(
            "Collaborative Work",
            `<p>This finding is currently being worked on by: <strong>${activeNames}</strong></p><p>Do you want to join this task in parallel?</p>`,
            [
                { text: "YES, JOIN", class: "btn-primary", onclick: () => executeStart(findingId, empId, taskCode) },
                { text: "CANCEL", onclick: closeModal }
            ]
        );
    } else {
        executeStart(findingId, empId, taskCode);
    }
}

function executeStart(findingId, empId, taskCode) {
    const finding = appState.findings.find(f => f.id === findingId);
    
    const session = {
        empId,
        taskCode,
        startTime: new Date().toISOString()
    };

    finding.activeSessions.push(session);
    finding.status = 'IN PROGRESS';
    
    finding.logs.push({
        time: new Date().toISOString(),
        empId,
        taskCode,
        type: 'START'
    });

    save();
    closeModal();
    renderFindings();
}

// --- LOGIC: STOP TASK ---
function handleStopBtn(findingId) {
    const finding = appState.findings.find(f => f.id === findingId);
    
    if (finding.activeSessions.length > 1) {
        // Multi-user: select who is stopping
        let html = `<p>Multiple mechanics are active. Who is stopping?</p><div style="display:grid; gap:10px; margin-top:15px;">`;
        finding.activeSessions.forEach((s, idx) => {
            html += `<button class="btn btn-primary" onclick="executeStop('${findingId}', ${idx})">${s.empId} (${s.taskCode})</button>`;
        });
        html += `</div>`;
        showModal("Stop Session", html, [{ text: "CANCEL", onclick: closeModal }]);
    } else {
        executeStop(findingId, 0);
    }
}

function executeStop(findingId, sessionIndex) {
    const finding = appState.findings.find(f => f.id === findingId);
    const session = finding.activeSessions[sessionIndex];
    
    finding.logs.push({
        time: new Date().toISOString(),
        empId: session.empId,
        taskCode: session.taskCode,
        type: 'STOP'
    });

    finding.activeSessions.splice(sessionIndex, 1);

    // If last person stopped, determine final status
    if (finding.activeSessions.length === 0) {
        save();
        closeModal();
        promptFinalStatus(findingId);
    } else {
        save();
        closeModal();
        renderFindings();
    }
}

function promptFinalStatus(findingId) {
    showModal(
        "Task Interruption / Completion",
        `<p>No active sessions remaining for Finding #${findingId}. What is the current status?</p>`,
        [
            { text: "ON HOLD / HANDOVER", class: "btn-primary", onclick: () => finalizeFinding(findingId, 'ON HOLD') },
            { text: "CLOSE FINDING", class: "btn-stop", onclick: () => promptPhotoUpload(findingId) }
        ]
    );
}

function promptPhotoUpload(findingId) {
    showModal(
        "Final Evidence",
        `<p>Please upload a photo of the completed work for Finding #${findingId}.</p>`,
        [
            { text: "SELECT PHOTO", class: "btn-primary", onclick: () => triggerPhotoInput(findingId) },
            { text: "SKIP & CLOSE", onclick: () => finalizeFinding(findingId, 'CLOSED') }
        ]
    );
}

function triggerPhotoInput(findingId) {
    const input = document.getElementById('hidden-photo-input');
    input.onchange = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = () => {
            // In real app, we'd store the Base64 'reader.result' in the finding
            finalizeFinding(findingId, 'CLOSED');
        };
        reader.readAsDataURL(file);
    };
    input.click();
}

function finalizeFinding(findingId, status) {
    const finding = appState.findings.find(f => f.id === findingId);
    finding.status = status;
    save();
    closeModal();
    renderFindings();
}

// --- TIMER ENGINE ---
function startTimerEngine() {
    setInterval(() => {
        appState.findings.forEach(f => {
            if (f.activeSessions.length > 0) {
                const container = document.getElementById(`timers-container-${f.id}`);
                if (!container) return;

                let html = '';
                f.activeSessions.forEach(s => {
                    const elapsed = Math.floor((new Date() - new Date(s.startTime)) / 1000);
                    const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
                    const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
                    const s_ = String(elapsed % 60).padStart(2, '0');
                    html += `<div class="timer-row"><span>👤 ${s.empId}</span> <span>${h}:${m}:${s_}</span></div>`;
                });
                container.innerHTML = html;
            }
        });
    }, 1000);
}

// --- MODAL UTILS ---
function showModal(title, bodyHtml, buttons) {
    const modal = document.getElementById('modal-overlay');
    const body = document.getElementById('modal-body');
    const footer = document.getElementById('modal-footer');

    body.innerHTML = `<h3 style="margin-bottom:10px">${title}</h3>` + bodyHtml;
    footer.innerHTML = '';

    buttons.forEach(btn => {
        const b = document.createElement('button');
        b.className = `btn ${btn.class || ''}`;
        b.textContent = btn.text;
        b.onclick = btn.onclick;
        footer.appendChild(b);
    });

    modal.classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
}

// BOOTSTRAP
window.onload = init;

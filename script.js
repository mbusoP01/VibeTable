/* VibeTable Logic - Mobile & Dynamic */

const CLIENT_ID = '951024875343-365jk5cjfkjbg8co3elc75jn41pe0ama.apps.googleusercontent.com'; 
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.profile';

// Default config
let appData = { 
    userName: "Student", userPic: null, theme: 'light',
    events: [], 
    timetable: {}, timetableColors: {}, 
    startHour: 7, endHour: 23, 
    notes: [], noteGroups: ['General', 'Law', 'Business']
};
let accessToken = null;
let selectedColor = null;
let audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg'); 

const bibleVerses = [
    "I can do all things through Christ who strengthens me. - Phil 4:13",
    "For I know the plans I have for you... plans to prosper you. - Jer 29:11",
    "The Lord is my shepherd; I shall not want. - Psalm 23:1",
    "Be strong and courageous. Do not be afraid. - Joshua 1:9"
];

window.onload = function() {
    initGoogleAuth();
    initScrollPickers();
    renderColorPickers();
    loadBibleQuote();
    setupDragDrop();
};

/* --- 1. CORE & MOBILE UI --- */
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('mobile-overlay').classList.toggle('open');
}

function loadBibleQuote() {
    const index = Math.floor(Math.random() * bibleVerses.length);
    document.getElementById('daily-quote').innerText = bibleVerses[index];
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => {
        el.classList.remove('active');
        el.style.display = 'none';
    });
    const target = document.getElementById(tabId);
    if(target) {
        target.style.display = 'block';
        setTimeout(() => target.classList.add('active'), 10);
    }
    if(tabId === 'timetable') renderTimetable();
    if(tabId === 'notes') renderNotes();
    if(tabId === 'countdowns') renderEvents();
    if(tabId === 'profile') updateProfileUI();

    // AUTO CLOSE SIDEBAR ON MOBILE
    if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('mobile-overlay').classList.remove('open');
    }
}

/* --- 2. DYNAMIC TIMETABLE --- */
function extendTimetable(direction) {
    if(direction === 'start') {
        if(appData.startHour > 0) appData.startHour--;
    } else {
        if(appData.endHour < 24) appData.endHour++;
    }
    saveDataToDrive();
    renderTimetable();
}

function renderTimetable() {
    const grid = document.getElementById('timetable-grid');
    if(!grid) return; grid.innerHTML = ''; 
    const days = ['Time', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    
    // Header
    days.forEach(d => { 
        let div = document.createElement('div'); 
        div.className = 'grid-header'; 
        div.innerText = d; 
        grid.appendChild(div); 
    });
    
    // Dynamic Loop
    for (let i = appData.startHour; i <= appData.endHour; i++) {
        let time = document.createElement('div'); 
        time.className = 'time-slot'; 
        time.innerText = `${i}:00`; 
        grid.appendChild(time);
        
        for (let j = 0; j < 5; j++) {
            let key = `${days[j+1]}-${i}`;
            let slot = document.createElement('div'); 
            slot.className = 'class-slot bubble';
            if(appData.timetableColors && appData.timetableColors[key]) slot.style.background = appData.timetableColors[key];
            
            let input = document.createElement('input');
            input.value = appData.timetable[key] || ''; 
            input.placeholder = '+';
            input.onchange = (e) => { appData.timetable[key] = e.target.value; saveDataToDrive(); };
            slot.onclick = (e) => { 
                if(selectedColor && e.target !== input) { 
                    if(!appData.timetableColors) appData.timetableColors = {};
                    appData.timetableColors[key] = selectedColor; 
                    slot.style.background = selectedColor; 
                    saveDataToDrive(); 
                } 
            };
            slot.appendChild(input); 
            grid.appendChild(slot);
        }
    }
}

/* --- 3. ALARM SYSTEM --- */
let timerInterval;
let timerSeconds = 1500; 

function updateTimerDisplay() {
    let m = Math.floor(timerSeconds / 60);
    let s = timerSeconds % 60;
    document.getElementById('timer-display').innerText = `${m}:${s < 10 ? '0' : ''}${s}`;
}
function startTimer() {
    if(timerInterval) return;
    document.getElementById('btn-start').classList.add('alarm-active');
    timerInterval = setInterval(() => {
        if(timerSeconds > 0) {
            timerSeconds--;
            updateTimerDisplay();
        } else {
            triggerAlarm();
        }
    }, 1000);
}
function pauseTimer() { 
    clearInterval(timerInterval); 
    timerInterval = null; 
    document.getElementById('btn-start').classList.remove('alarm-active');
}
function resetTimer() { 
    pauseTimer(); 
    timerSeconds = 1500; 
    updateTimerDisplay(); 
}
function requestNotification() {
    if (Notification.permission !== "granted") Notification.requestPermission();
    audio.play().then(() => audio.pause()); 
}
function triggerAlarm() {
    clearInterval(timerInterval);
    document.getElementById('btn-start').classList.remove('alarm-active');
    
    // Play Sound Loop
    audio.currentTime = 0;
    audio.play();
    setTimeout(() => audio.play(), 1000); 
    setTimeout(() => audio.play(), 2000);

    // Browser Notification
    if (Notification.permission === "granted") {
        new Notification("VibeTable: Time is up!");
    } else {
        alert("TIME IS UP!");
    }
}

/* --- 4. AUTH & PERSISTENT DATA --- */
function initGoogleAuth() {
    try {
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID, scope: SCOPES,
            callback: async (r) => { if(r.access_token) { accessToken = r.access_token; await handleLogin(); } }
        });
    } catch(e) {}
}
function handleAuthClick() { tokenClient.requestAccessToken(); }

async function handleLogin() {
    const login = document.getElementById('login-screen');
    if(login) login.remove(); 
    document.getElementById('app-screen').classList.remove('hidden');
    document.getElementById('app-screen').classList.add('active');
    
    let res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {headers:{'Authorization':'Bearer '+accessToken}});
    let user = await res.json();
    
    const sidebarPic = document.getElementById('sidebar-pic');
    const profilePic = document.getElementById('profile-pic-large');
    if(sidebarPic) sidebarPic.src = user.picture;
    if(profilePic) profilePic.src = user.picture;
    
    await loadData();
    if(appData.userName) document.getElementById('dash-name').innerText = appData.userName;
    else document.getElementById('dash-name').innerText = user.given_name;
    
    renderGroups(); renderTimetable(); renderEvents(); renderNotes(); updateProfileUI();
}

// PERSISTENCE LOGIC
const CURRENT_FILE = 'vibetable_v9.json'; 
async function loadData() {
    try {
        let q = "https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='" + CURRENT_FILE + "'";
        let r = await fetch(q, {headers:{'Authorization':'Bearer '+accessToken}});
        let d = await r.json();
        
        if(d.files && d.files.length > 0) {
            let f = await fetch(`https://www.googleapis.com/drive/v3/files/${d.files[0].id}?alt=media`, {headers:{'Authorization':'Bearer '+accessToken}});
            appData = await f.json();
        } else {
            console.log("New version not found, checking for old data...");
            let qOld = "https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='vibetable_v7.json'";
            let rOld = await fetch(qOld, {headers:{'Authorization':'Bearer '+accessToken}});
            let dOld = await rOld.json();
            if(dOld.files && dOld.files.length > 0) {
                let fOld = await fetch(`https://www.googleapis.com/drive/v3/files/${dOld.files[0].id}?alt=media`, {headers:{'Authorization':'Bearer '+accessToken}});
                appData = await fOld.json();
                console.log("Migrated data from v7");
            }
        }
        
        if(!appData.startHour) appData.startHour = 7;
        if(!appData.endHour) appData.endHour = 23;
        
    } catch(e) { console.error(e); }
}

async function saveDataToDrive() {
    let blob = new Blob([JSON.stringify(appData)], {type:'application/json'});
    let form = new FormData();
    form.append('metadata', new Blob([JSON.stringify({name:CURRENT_FILE, parents:['appDataFolder']})], {type:'application/json'}));
    form.append('file', blob);
    await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {method:'POST', headers:{'Authorization':'Bearer '+accessToken}, body:form});
}

/* --- OTHER UTILS --- */
function setupDragDrop() {
    const zone = document.getElementById('drop-zone');
    if(!zone) return;
    zone.ondragover = (e) => { e.preventDefault(); zone.style.borderColor = 'var(--accent)'; };
    zone.ondragleave = (e) => { e.preventDefault(); zone.style.borderColor = 'var(--primary)'; };
    zone.ondrop = (e) => {
        e.preventDefault();
        zone.style.borderColor = 'var(--primary)';
        const file = e.dataTransfer.files[0];
        if(file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (event) => {
                appData.userPic = event.target.result;
                updateProfileUI();
                saveDataToDrive();
                alert("Profile picture updated!");
            };
            reader.readAsDataURL(file);
        }
    };
}
const palette = ['#E3D8C1', '#CEC1A8', '#B59E7D', '#AAA396', '#E6CBB8', '#B4833D', '#81754B', '#584738', '#B8E6C1'];
function renderColorPickers() {
    const c = document.getElementById('timetable-colors');
    const h = document.getElementById('highlighter-toolbar');
    if(!c) return; c.innerHTML = ''; h.innerHTML = '';
    palette.forEach(col => {
        let dot = document.createElement('div');
        dot.className = 'color-dot'; dot.style.background = col;
        dot.onclick = () => { selectedColor = col; };
        c.appendChild(dot);
        let hl = document.createElement('div');
        hl.className = 'hl-btn'; hl.style.background = col;
        hl.onmousedown = (e) => { e.preventDefault(); document.execCommand('hiliteColor', false, col); };
        h.appendChild(hl);
    });
}
function initScrollPickers() { populateWheel('picker-day', 1, 31); populateWheel('picker-month', 1, 12); populateWheel('picker-year', 2025, 2030); populateWheel('picker-hour', 0, 23); populateWheel('picker-minute', 0, 59); }
function populateWheel(id, min, max) { const el = document.getElementById(id); if(!el) return; el.innerHTML = '<div style="height:70px; width:100%"></div>'; for(let i=min; i<=max; i++) { let item = document.createElement('div'); item.className = 'picker-item'; item.innerText = i < 10 ? '0'+i : i; item.dataset.val = i; el.appendChild(item); } el.innerHTML += '<div style="height:70px; width:100%"></div>'; }
function getWheelVal(id) { const el = document.getElementById(id); if(!el) return 0; let index = Math.round(el.scrollTop / 40); let target = el.children[index + 1]; return target ? parseInt(target.dataset.val) : 0; }
function addEvent() { let name = document.getElementById('event-name').value; let y = getWheelVal('picker-year') || 2025; let m = (getWheelVal('picker-month') || 1) - 1; let d = getWheelVal('picker-day') || 1; let h = getWheelVal('picker-hour') || 9; let min = getWheelVal('picker-minute') || 0; if(name) { let date = new Date(y, m, d, h, min); appData.events.push({name, date: date.toISOString()}); renderEvents(); saveDataToDrive(); alert('Saved!'); } }
function renderEvents() { const c = document.getElementById('countdown-container'); if(!c) return; c.innerHTML = ''; appData.events.forEach((e, i) => { let diff = new Date(e.date) - new Date(); let days = Math.floor(diff / (1000*60*60*24)); let div = document.createElement('div'); div.className = 'glass-panel bubble'; div.innerHTML = `<h3>${e.name}</h3><h1 style="color:var(--accent);">${days} Days</h1><button onclick="delEvent(${i})" style="color:red;border:none;background:none;cursor:pointer;">Delete</button>`; c.appendChild(div); }); }
function delEvent(i) { appData.events.splice(i, 1); renderEvents(); saveDataToDrive(); }
function renderGroups() { const sel = document.getElementById('note-group-select'); const fil = document.getElementById('note-group-filter'); if(!sel) return; const curVal = fil.value; sel.innerHTML = ''; fil.innerHTML = '<option value="All">All Groups</option>'; if(!appData.noteGroups) appData.noteGroups = ['General']; appData.noteGroups.forEach(g => { sel.innerHTML += `<option value="${g}">${g}</option>`; fil.innerHTML += `<option value="${g}">${g}</option>`; }); fil.value = curVal; }
function manageGroups() { let action = prompt("Type: 'new', 'rename', or 'delete'"); if(!action) return; action = action.toLowerCase(); if(action === 'new') { if(appData.noteGroups.length >= 20) return alert("Max 20 groups allowed."); let g = prompt("New Group Name:"); if(g) { appData.noteGroups.push(g); renderGroups(); saveDataToDrive(); } } else if (action === 'rename') { let current = document.getElementById('note-group-filter').value; if(current === 'All' || current === 'General') return alert("Cannot rename All or General."); let newName = prompt("Rename " + current + " to:"); if(newName) { let idx = appData.noteGroups.indexOf(current); if(idx > -1) appData.noteGroups[idx] = newName; appData.notes.forEach(n => { if(n.group === current) n.group = newName; }); renderGroups(); renderNotes(); saveDataToDrive(); } } else if (action === 'delete') { let current = document.getElementById('note-group-filter').value; if(current === 'All' || current === 'General') return alert("Cannot delete All or General."); if(confirm("Delete " + current + "? Notes will move to General.")) { let idx = appData.noteGroups.indexOf(current); if(idx > -1) appData.noteGroups.splice(idx, 1); appData.notes.forEach(n => { if(n.group === current) n.group = "General"; }); document.getElementById('note-group-filter').value = 'All'; renderGroups(); renderNotes(); saveDataToDrive(); } } }
function createNewNote() { appData.notes.push({title:"New Note", body:"", group:"General"}); renderNotes(); loadNote(appData.notes.length-1); saveDataToDrive(); }
function renderNotes() { const list = document.getElementById('note-list'); const filter = document.getElementById('note-group-filter').value; if(!list) return; list.innerHTML = ''; appData.notes.forEach((n, i) => { if(filter === 'All' || n.group === filter) { let btn = document.createElement('button'); btn.className = 'nav-btn'; btn.innerHTML = `<div><span style="font-weight:bold">${n.title}</span><br><small style="opacity:0.7">${n.group}</small></div>`; btn.onclick = () => loadNote(i); list.appendChild(btn); } }); }
function loadNote(i) { let n = appData.notes[i]; document.getElementById('note-title').value = n.title; document.getElementById('note-body').innerHTML = n.body; document.getElementById('note-group-select').value = n.group; document.getElementById('note-title').oninput = (e) => appData.notes[i].title = e.target.value; document.getElementById('note-group-select').onchange = (e) => { appData.notes[i].group = e.target.value; saveDataToDrive(); renderNotes(); }; document.getElementById('note-body').onblur = function() { appData.notes[i].body = this.innerHTML; saveDataToDrive(); }; }
function filterNotes() { renderNotes(); }
function updateNoteGroup() { /* Handled inline */ }
function saveProfile() { appData.userName = document.getElementById('edit-name').value; appData.userPic = document.getElementById('edit-pic').value || appData.userPic; saveDataToDrive(); updateProfileUI(); alert("Profile Saved"); }
function updateProfileUI() { if(appData.userName) { document.getElementById('dash-name').innerText = appData.userName; document.getElementById('edit-name').value = appData.userName; } if(appData.userPic) { document.getElementById('sidebar-pic').src = appData.userPic; document.getElementById('profile-pic-large').src = appData.userPic; } if(appData.theme === 'dark') document.body.setAttribute('data-theme', 'dark'); }
function toggleTheme() { if(document.body.hasAttribute('data-theme')) { document.body.removeAttribute('data-theme'); appData.theme = 'light'; } else { document.body.setAttribute('data-theme', 'dark'); appData.theme = 'dark'; } saveDataToDrive(); }

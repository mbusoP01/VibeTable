/* VibeTable Logic - Student OS Final */

const CLIENT_ID = '951024875343-365jk5cjfkjbg8co3elc75jn41pe0ama.apps.googleusercontent.com'; 
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.profile';

let appData = { 
    userName: "Student", userPic: null, theme: 'light',
    events: [], timetable: {}, timetableColors: {}, 
    startHour: 7, endHour: 23, showWeekends: false,
    notes: [], noteGroups: ['Group 1', 'Group 2'], flashcards: [] 
};
let accessToken = null;
let selectedColor = null;
let audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg'); 

const bibleVerses = {
    morning: ["Be strong and courageous. - Josh 1:9", "His mercies are new every morning. - Lam 3:23"],
    midday: ["I can do all things through Christ. - Phil 4:13", "Commit to the Lord whatever you do. - Prov 16:3"],
    evening: ["The Lord is my shepherd. - Ps 23:1", "Come to me, all you who are weary. - Matt 11:28"],
    night: ["Peace I leave with you. - John 14:27", "When I am afraid, I put my trust in you. - Ps 56:3"]
};

window.onload = function() {
    initGoogleAuth();
    initScrollPickers();
    renderColorPickers();
    setupDragDrop();
    initHeatmap();
    setInterval(updateTimeLine, 60000); 
    setInterval(updateDashboard, 60000);
};

/* --- DASHBOARD LOGIC --- */
function updateDashboard() {
    // 1. Greeting
    const now = new Date();
    const hr = now.getHours();
    let greet = "Hello";
    if(hr < 12) greet = "Good Morning";
    else if(hr < 18) greet = "Good Afternoon";
    else greet = "Good Evening";
    document.getElementById('greet-msg').innerText = `${greet}, ${appData.userName || 'Student'}.`;

    // 2. Bible Quote (5hr blocks approx)
    let verseType = 'morning';
    if(hr >= 10 && hr < 15) verseType = 'midday';
    if(hr >= 15 && hr < 20) verseType = 'evening';
    if(hr >= 20 || hr < 5) verseType = 'night';
    // Pick based on day of year to rotate daily
    const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
    const verses = bibleVerses[verseType];
    document.getElementById('daily-quote').innerText = verses[dayOfYear % verses.length];

    // 3. Up Next
    const nextEvent = appData.events.find(e => new Date(e.date) > now);
    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const todayName = dayNames[now.getDay()];
    // Check timetable for current hour
    let currentClass = appData.timetable[`${todayName}-${hr}`];
    
    if(currentClass) {
        document.getElementById('up-next-display').innerText = `Now: ${currentClass}`;
        document.getElementById('up-next-sub').innerText = `Check timetable for details.`;
    } else if (nextEvent) {
        const diff = Math.ceil((new Date(nextEvent.date) - now) / (1000*60*60*24));
        document.getElementById('up-next-display').innerText = `Upcoming: ${nextEvent.name}`;
        document.getElementById('up-next-sub').innerText = `In ${diff} days.`;
    } else {
        document.getElementById('up-next-display').innerText = "All caught up!";
        document.getElementById('up-next-sub').innerText = "Time to relax.";
    }
}

/* --- UI --- */
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('mobile-overlay').classList.toggle('open');
}
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => { el.classList.remove('active'); el.style.display = 'none'; });
    const target = document.getElementById(tabId);
    if(target) { target.style.display = 'block'; setTimeout(() => target.classList.add('active'), 10); }
    if(tabId === 'timetable') { renderTimetable(); updateTimeLine(); }
    if(tabId === 'dashboard') updateDashboard();
    if(tabId === 'notes') renderNotes();
    if(tabId === 'countdowns') { renderEvents(); initHeatmap(); }
    if(tabId === 'study') renderFlashcard();
    if(tabId === 'profile') updateProfileUI();
    if (window.innerWidth <= 768) { document.getElementById('sidebar').classList.remove('open'); document.getElementById('mobile-overlay').classList.remove('open'); }
}

/* --- TIMETABLE --- */
function toggleWeekends() { appData.showWeekends = !appData.showWeekends; saveDataToDrive(); renderTimetable(); }

function modifyTimetable(end, action) {
    if (action === 'add') {
        if(end === 'start' && appData.startHour > 0) appData.startHour--;
        if(end === 'end' && appData.endHour < 24) appData.endHour++;
    } else {
        if(end === 'start' && appData.startHour < appData.endHour) appData.startHour++;
        if(end === 'end' && appData.endHour > appData.startHour) appData.endHour--;
    }
    saveDataToDrive(); renderTimetable();
}

function renderTimetable() {
    const grid = document.getElementById('timetable-grid');
    if(!grid) return; grid.innerHTML = ''; 
    if(appData.showWeekends) grid.classList.add('show-weekends'); else grid.classList.remove('show-weekends');
    const days = appData.showWeekends ? ['Time', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['Time', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const cols = appData.showWeekends ? 7 : 5;

    // Headers
    days.forEach((d, index) => { 
        let div = document.createElement('div'); 
        div.className = 'grid-header';
        if(index === 0) div.classList.add('sticky-col'); 
        div.innerText = d; 
        grid.appendChild(div); 
    });
    
    // Rows
    for (let i = appData.startHour; i <= appData.endHour; i++) {
        let time = document.createElement('div'); 
        time.className = 'time-slot sticky-col'; 
        time.innerText = `${i}:00`; 
        grid.appendChild(time);
        
        for (let j = 0; j < cols; j++) {
            let key = `${days[j+1]}-${i}`;
            let slot = document.createElement('div'); slot.className = 'class-slot bubble';
            if(appData.timetableColors && appData.timetableColors[key]) slot.style.background = appData.timetableColors[key];
            let input = document.createElement('input');
            input.value = appData.timetable[key] || ''; input.placeholder = '+';
            input.onchange = (e) => { appData.timetable[key] = e.target.value; saveDataToDrive(); };
            slot.onclick = (e) => { if(selectedColor && e.target !== input) { if(!appData.timetableColors) appData.timetableColors = {}; appData.timetableColors[key] = selectedColor; slot.style.background = selectedColor; saveDataToDrive(); } };
            slot.appendChild(input); grid.appendChild(slot);
        }
    }
    updateTimeLine();
}

function updateTimeLine() {
    const line = document.getElementById('current-time-line');
    const now = new Date();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const headerHeight = 40; 
    const rowHeight = 61; 
    let hoursPastStart = currentHour - appData.startHour;
    let pixelsDown = headerHeight + (hoursPastStart * rowHeight) + ((currentMin / 60) * rowHeight);
    const maxPixels = headerHeight + ((appData.endHour - appData.startHour + 1) * rowHeight);
    if (pixelsDown < headerHeight) pixelsDown = headerHeight; 
    if (pixelsDown > maxPixels) pixelsDown = maxPixels; 
    line.style.top = `${pixelsDown}px`;
    line.style.display = 'block';
}

/* --- FLASHCARDS --- */
let currentCard = 0;
function addFlashcard() {
    let q = document.getElementById('fc-q').value; let a = document.getElementById('fc-a').value;
    if(q && a) { if(!appData.flashcards) appData.flashcards = []; appData.flashcards.push({q, a}); document.getElementById('fc-q').value = ''; document.getElementById('fc-a').value = ''; saveDataToDrive(); renderFlashcard(); }
}
function renderFlashcard() {
    const front = document.getElementById('card-front-text'); const back = document.getElementById('card-back-text'); const counter = document.getElementById('card-counter');
    if(!appData.flashcards || appData.flashcards.length === 0) { front.innerText = "No cards yet."; back.innerText = "Add one below!"; counter.innerText = "0 / 0"; return; }
    if(currentCard >= appData.flashcards.length) currentCard = 0; if(currentCard < 0) currentCard = appData.flashcards.length - 1;
    front.innerText = appData.flashcards[currentCard].q; back.innerText = appData.flashcards[currentCard].a; counter.innerText = `${currentCard + 1} / ${appData.flashcards.length}`; document.getElementById('flashcard-display').classList.remove('flipped');
}
function flipCard() { document.getElementById('flashcard-display').classList.toggle('flipped'); }
function nextCard() { currentCard++; renderFlashcard(); }
function prevCard() { currentCard--; renderFlashcard(); }

/* --- HEATMAP --- */
function initHeatmap() { const grid = document.getElementById('heatmap-grid'); if(!grid) return; grid.innerHTML = ''; const now = new Date(); const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(); for(let i=1; i<=daysInMonth; i++) { let dayDiv = document.createElement('div'); dayDiv.className = 'heat-day'; dayDiv.innerText = i; let count = 0; appData.events.forEach(e => { let d = new Date(e.date); if(d.getDate() === i && d.getMonth() === now.getMonth()) count++; }); if(count > 0) dayDiv.classList.add(count > 1 ? 'heat-level-2' : 'heat-level-1'); grid.appendChild(dayDiv); } }
let timerInterval; let timerSeconds = 1500; function updateTimerDisplay() { let m = Math.floor(timerSeconds / 60); let s = timerSeconds % 60; document.getElementById('timer-display').innerText = `${m}:${s < 10 ? '0' : ''}${s}`; } function startTimer() { if(timerInterval) return; document.getElementById('btn-start').classList.add('alarm-active'); timerInterval = setInterval(() => { if(timerSeconds > 0) { timerSeconds--; updateTimerDisplay(); } else { triggerAlarm(); } }, 1000); } function pauseTimer() { clearInterval(timerInterval); timerInterval = null; document.getElementById('btn-start').classList.remove('alarm-active'); } function resetTimer() { pauseTimer(); timerSeconds = 1500; updateTimerDisplay(); } function requestNotification() { if (Notification.permission !== "granted") Notification.requestPermission(); audio.play().then(() => audio.pause()); } function triggerAlarm() { clearInterval(timerInterval); document.getElementById('btn-start').classList.remove('alarm-active'); audio.currentTime = 0; audio.play(); setTimeout(() => audio.play(), 1000); setTimeout(() => audio.play(), 2000); if (Notification.permission === "granted") new Notification("VibeTable: Time is up!"); else alert("TIME IS UP!"); }
function initGoogleAuth() { try { tokenClient = google.accounts.oauth2.initTokenClient({ client_id: CLIENT_ID, scope: SCOPES, callback: async (r) => { if(r.access_token) { accessToken = r.access_token; await handleLogin(); } } }); } catch(e) {} }
function handleAuthClick() { tokenClient.requestAccessToken(); }
async function handleLogin() { const login = document.getElementById('login-screen'); if(login) login.remove(); document.getElementById('app-screen').classList.remove('hidden'); document.getElementById('app-screen').classList.add('active'); let res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {headers:{'Authorization':'Bearer '+accessToken}}); let user = await res.json(); const sidebarPic = document.getElementById('sidebar-pic'); const profilePic = document.getElementById('profile-pic-large'); if(sidebarPic) sidebarPic.src = user.picture; if(profilePic) profilePic.src = user.picture; await loadData(); if(appData.userName) document.getElementById('dash-name').innerText = appData.userName; else document.getElementById('dash-name').innerText = user.given_name; updateDashboard(); renderGroups(); renderTimetable(); renderEvents(); renderNotes(); updateProfileUI(); initHeatmap(); }
const CURRENT_FILE = 'vibetable_v11.json'; async function loadData() { try { let q = "https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='" + CURRENT_FILE + "'"; let r = await fetch(q, {headers:{'Authorization':'Bearer '+accessToken}}); let d = await r.json(); if(d.files && d.files.length > 0) { let f = await fetch(`https://www.googleapis.com/drive/v3/files/${d.files[0].id}?alt=media`, {headers:{'Authorization':'Bearer '+accessToken}}); appData = await f.json(); } else { let qOld = "https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='vibetable_v10.json'"; let rOld = await fetch(qOld, {headers:{'Authorization':'Bearer '+accessToken}}); let dOld = await rOld.json(); if(dOld.files && dOld.files.length > 0) { let fOld = await fetch(`https://www.googleapis.com/drive/v3/files/${dOld.files[0].id}?alt=media`, {headers:{'Authorization':'Bearer '+accessToken}}); appData = await fOld.json(); } } if(!appData.startHour) appData.startHour = 7; if(!appData.endHour) appData.endHour = 23; } catch(e) { console.error(e); } }
async function saveDataToDrive() { let blob = new Blob([JSON.stringify(appData)], {type:'application/json'}); let form = new FormData(); form.append('metadata', new Blob([JSON.stringify({name:CURRENT_FILE, parents:['appDataFolder']})], {type:'application/json'})); form.append('file', blob); await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {method:'POST', headers:{'Authorization':'Bearer '+accessToken}, body:form}); }
function setupDragDrop() { const zone = document.getElementById('drop-zone'); if(!zone) return; zone.ondragover = (e) => { e.preventDefault(); zone.style.borderColor = 'var(--accent)'; }; zone.ondragleave = (e) => { e.preventDefault(); zone.style.borderColor = 'var(--primary)'; }; zone.ondrop = (e) => { e.preventDefault(); zone.style.borderColor = 'var(--primary)'; const file = e.dataTransfer.files[0]; if(file && file.type.startsWith('image/')) { const reader = new FileReader(); reader.onload = (event) => { appData.userPic = event.target.result; updateProfileUI(); saveDataToDrive(); alert("Profile picture updated!"); }; reader.readAsDataURL(file); } }; }
function renderColorPickers() { const c = document.getElementById('timetable-colors'); const h = document.getElementById('highlighter-toolbar'); if(!c) return; c.innerHTML = ''; h.innerHTML = ''; palette.forEach(col => { let dot = document.createElement('div'); dot.className = 'color-dot'; dot.style.background = col; dot.onclick = () => { selectedColor = col; }; c.appendChild(dot); let hl = document.createElement('div'); hl.className = 'hl-btn'; hl.style.background = col; hl.onmousedown = (e) => { e.preventDefault(); document.execCommand('hiliteColor', false, col); }; h.appendChild(hl); }); }
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
const palette = ['#E3D8C1', '#CEC1A8', '#B59E7D', '#AAA396', '#E6CBB8', '#B4833D', '#81754B', '#584738', '#B8E6C1'];

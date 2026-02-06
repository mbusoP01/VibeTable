/* VibeTable Logic - Production Stable */

const CLIENT_ID = '951024875343-365jk5cjfkjbg8co3elc75jn41pe0ama.apps.googleusercontent.com'; 
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.profile';
const CURRENT_FILE = 'vibetable_v13.json'; 

let appData = { 
    userName: "Student", userPic: null, theme: 'light',
    events: [], timetable: {}, timetableColors: {}, 
    startHour: 7, endHour: 23, showWeekends: false,
    notes: [], noteGroups: ['Group 1', 'Group 2'], flashcards: [],
    habits: [{name: "Read", streak: 0, last: null}, {name: "Gym", streak: 0, last: null}, {name: "Water", streak: 0, last: null}],
    todos: [], timerTarget: null 
};

let accessToken = null;
let driveFileId = null; // Stores the ID so we update instead of duplicate
let audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg'); 
let timerInterval;
let friendData = null; 
let isViewingFriend = false;

const bibleVerses = {
    morning: ["Be strong and courageous. - Josh 1:9", "His mercies are new every morning. - Lam 3:23"],
    midday: ["I can do all things through Christ. - Phil 4:13", "Commit to the Lord whatever you do. - Prov 16:3"],
    evening: ["The Lord is my shepherd. - Ps 23:1", "Come to me, all you who are weary. - Matt 11:28"],
    night: ["Peace I leave with you. - John 14:27", "When I am afraid, I put my trust in you. - Ps 56:3"]
};

window.onload = function() {
    checkSession();
    document.addEventListener('click', updateActivity);
    document.addEventListener('keypress', updateActivity);
    
    // Attempt silent auth on load
    initGoogleAuth(); 
    
    initScrollPickers(); renderColorPickers(); setupDragDrop(); initHeatmap();
    setInterval(updateTimeLine, 60000); setInterval(updateDashboard, 60000);
    if(appData.timerTarget) checkTimerState();
};

/* --- SESSION LOGIC --- */
function checkSession() {
    const lastActive = localStorage.getItem('vibetable_last_active');
    const now = Date.now();
    
    // If inactive for > 30 mins, force login, but keep data safe
    if (lastActive && (now - lastActive > 1800000)) {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('app-screen').classList.add('hidden');
        // We DO NOT wipe local storage here to prevent data loss. 
        // We just hide the UI.
    } else {
        loadFromLocal();
    }
    updateActivity();
}
function updateActivity() { localStorage.setItem('vibetable_last_active', Date.now()); }

/* --- SYNC ENGINE (FIXED) --- */
function saveToLocal() { localStorage.setItem('vibetable_data', JSON.stringify(appData)); updateSyncUI(); }

function loadFromLocal() {
    const local = localStorage.getItem('vibetable_data');
    if (local) { 
        appData = JSON.parse(local); 
        // Restore UI state
        if(document.getElementById('login-screen')) document.getElementById('login-screen').remove(); 
        document.getElementById('app-screen').classList.remove('hidden'); 
        document.getElementById('app-screen').classList.add('active');
        
        refreshAllUI();
    }
}

async function triggerSync() { 
    saveToLocal(); // Always save to phone first
    if(!accessToken) { handleAuthClick(); return; }

    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";

    const contentType = 'application/json';
    const metadata = { name: CURRENT_FILE, mimeType: contentType, parents: ['appDataFolder'] };

    const multipartRequestBody =
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: ' + contentType + '\r\n\r\n' +
        JSON.stringify(appData) +
        close_delim;

    try {
        let requestPath = '/upload/drive/v3/files?uploadType=multipart';
        let method = 'POST';

        // IF WE HAVE A FILE ID, WE UPDATE (PATCH) INSTEAD OF CREATE
        if (driveFileId) {
            requestPath = `/upload/drive/v3/files/${driveFileId}?uploadType=multipart`;
            method = 'PATCH';
        }

        let response = await fetch('https://www.googleapis.com' + requestPath, {
            method: method,
            headers: {
                'Content-Type': 'multipart/related; boundary="' + boundary + '"',
                'Authorization': 'Bearer ' + accessToken
            },
            body: multipartRequestBody
        });

        if (response.status === 401) {
            // Token expired! Re-auth
            console.log("Token expired. Refreshing...");
            handleAuthClick(); 
            return; 
        }

        if (response.ok) {
            let result = await response.json();
            driveFileId = result.id; // Save ID for next time
            updateSyncUI(true);
            alert("Synced successfully!");
        }
    } catch (e) {
        console.error("Sync failed", e);
        alert("Sync failed. Check internet.");
    }
}

async function loadData() {
    try {
        let q = "https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='" + CURRENT_FILE + "'";
        let r = await fetch(q, {headers:{'Authorization':'Bearer '+accessToken}});
        
        if (r.status === 401) return; // Silent fail if token dead on load

        let d = await r.json();
        if(d.files && d.files.length > 0) {
            driveFileId = d.files[0].id; // CAPTURE THE ID
            let f = await fetch(`https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`, {headers:{'Authorization':'Bearer '+accessToken}});
            let cloudData = await f.json();
            // Merge cloud data? For now, we overwrite local to ensure sync
            appData = cloudData;
            saveToLocal();
            refreshAllUI();
        }
    } catch(e) { console.error(e); }
}

function updateSyncUI(isSynced = false) {
    const badge = document.getElementById('sync-status');
    if(accessToken && isSynced) {
        badge.className = 'status-badge online';
        badge.innerHTML = '<i class="fas fa-check-circle"></i> <span>Synced</span>';
    } else if (accessToken) {
        badge.className = 'status-badge online'; // Logged in but pending save
        badge.innerHTML = '<i class="fas fa-wifi"></i> <span>Connected</span>';
    } else {
        badge.className = 'status-badge offline';
        badge.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> <span>Offline Mode</span>';
    }
}

/* --- AUTH --- */
function initGoogleAuth() {
    try {
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID, scope: SCOPES,
            callback: async (r) => { 
                if(r.access_token) { 
                    accessToken = r.access_token; 
                    await handleLogin(); 
                } 
            }
        });
        // Try silent load if we have a hint? Not possible with implicit flow easily, 
        // so we wait for user action or cached token if we moved to code flow.
    } catch(e) {}
}
function handleAuthClick() { tokenClient.requestAccessToken(); }
async function handleLogin() { 
    if(document.getElementById('login-screen')) document.getElementById('login-screen').remove(); 
    document.getElementById('app-screen').classList.remove('hidden'); 
    document.getElementById('app-screen').classList.add('active'); 
    
    // Fetch User Info
    let res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {headers:{'Authorization':'Bearer '+accessToken}});
    let user = await res.json();
    if(user.picture) {
        document.getElementById('sidebar-pic').src = user.picture;
        document.getElementById('profile-pic-large').src = user.picture;
    }
    
    await loadData(); // Check cloud
    if(appData.userName) document.getElementById('dash-name').innerText = appData.userName;
    updateSyncUI(true);
}

/* --- UI REFRESHER --- */
function refreshAllUI() {
    renderGroups(); renderTimetable(); renderEvents(); renderNotes(); updateProfileUI(); updateDashboard(); initHeatmap(); renderHabits(); renderTodos();
}

/* --- [KEEP ALL OTHER FUNCTIONS: renderTimetable, updateDashboard, Timer, etc. FROM PREVIOUS STEP] --- */
/* (Copy paste the Dashboard, Timetable, Study, Timer functions from the previous response here. They were correct.) */

/* --- ADDED FOR COMPLETENESS: --- */
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); document.getElementById('mobile-overlay').classList.toggle('open'); }
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

// ... [Include all the Timetable, Notes, Flashcard, PDF logic from previous response] ...

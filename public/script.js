// --- STATE ---
let currentUser = null;
let gameState = null;
let currentDailyWord = "";
let currentGuess = "";
let guesses = [];
const MAX_GUESSES = 6;

// --- DOM ELEMENTS ---
const screens = {
    login: document.getElementById('login-screen'),
    pairing: document.getElementById('pairing-screen'),
    game: document.getElementById('game-screen')
};

// --- INITIALIZATION ---
function init() {
    setupEventListeners();
    checkAuth();
}

function setupEventListeners() {
    document.getElementById('login-btn').addEventListener('click', login);
    document.getElementById('logout-btn').addEventListener('click', logout);
    document.getElementById('pair-btn').addEventListener('click', pair);
    document.getElementById('puzzle-trigger-btn').addEventListener('click', openPuzzle);
    document.getElementById('charcoal-tool').addEventListener('click', openMessageModal);
    document.getElementById('send-message-btn').addEventListener('click', sendMessage);
    document.getElementById('toggle-debug').addEventListener('click', () => {
        document.getElementById('debug-controls').classList.toggle('hidden');
    });

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
        });
    });

    window.addEventListener('keydown', handleKeyPress);
}

async function checkAuth() {
    // Basic check - if cookie exists, try to get state
    const res = await fetch('/api/state');
    if (res.ok) {
        const data = await res.json();
        gameState = data;
        
        // Find current user's name from cookies or from server response
        // Let's get the username from the document.cookie reliably
        const match = document.cookie.match(/(?:^|; )username=([^;]*)/);
        if (match) {
            currentUser = { username: decodeURIComponent(match[1]).toLowerCase() };
        }
        
        if (data.paired) {
            showScreen('game');
            updateUI();
        } else {
            showScreen('pairing');
        }
    } else {
        showScreen('login');
    }
}

// --- AUTH ---
async function login() {
    const username = document.getElementById('username-input').value.trim();
    const password = document.getElementById('password-input').value.trim();
    const audio = new Audio('Outdoors.mp3');
    const music = new Audio('music.mp3');
    music.volume = 0.03;
    audio.loop=true;
    music.loop=true;


    if (!username || !password) return;

    if (audio.paused) {
      audio.play();
      music.play();
    } else {
      audio.pause();
      music.pause();
    }


    const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });

    if (res.ok) {
        currentUser = await res.json();
        document.getElementById('username-input').value = "";
        document.getElementById('password-input').value = "";
        checkAuth();
    } else {
        const err = await res.json();
        alert(err.error || "Login failed");
    }
}

async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    const audio = new Audio('Outdoors.mp3');
    const music = new Audio('music.mp3');

    if (audio.paused) {
      audio.play();
      music.play();
    } else {
      audio.pause();
      music.pause();
    }
  
    // Manually delete the cookie on client side if possible, just in case
    document.cookie = "username=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    gameState = null;
    currentUser = null;
    // Hard refresh to completely clear all JS states, variables, active canvas, and show clean login screen
    window.location.reload();
}

async function pair() {
    const partnerName = document.getElementById('partner-input').value.trim();
    if (!partnerName) return;

    const res = await fetch('/api/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnerName })
    });

    if (res.ok) {
        checkAuth();
    } else {
        alert("Partner not found or already paired.");
    }
}

// --- UI UPDATES ---
function showScreen(screenId) {
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    screens[screenId].classList.remove('hidden');
}

function updateUI() {
    if (!gameState) return;

    // Use gameState.username returned securely from server state
    const activeUser = gameState.username || "You";
    
    document.getElementById('user-display').textContent = activeUser;
    document.getElementById('partner-display').textContent = gameState.partner || "Partner";

    // Update Fire Visuals
    const flame = document.getElementById('main-flame');
    const level = gameState.fireLevel;
    flame.style.height = `${level}%`;
    flame.style.width = `${level * 0.8}%`;
    flame.style.opacity = level / 100;

    // Daily Puzzle Button
    const puzzleBtn = document.getElementById('puzzle-trigger-btn');
    if (gameState.completedToday) {
        puzzleBtn.classList.add('hidden');
        document.getElementById('charcoal-tool').classList.remove('hidden');
    } else {
        puzzleBtn.classList.remove('hidden');
        document.getElementById('charcoal-tool').classList.add('hidden');
    }

    // Messages / Ash Pile
    // The server is already doing the heavy lifting of filtering unread partner messages!
    // We just show whatever unread messages are passed to us.
    if (gameState.messages && gameState.messages.length > 0) {
        document.getElementById('message-indicator').classList.remove('hidden');
        const latestMessage = gameState.messages[gameState.messages.length - 1];
        initAshReveal(latestMessage.text, latestMessage.id);
    } else {
        document.getElementById('message-indicator').classList.add('hidden');
        activeMessageId = null;
    }
}

// --- WORDLE PUZZLE ---
async function openPuzzle() {
    const res = await fetch('/api/word');
    const data = await res.json();
    currentDailyWord = data.word.toUpperCase();
    
    document.getElementById('puzzle-modal').classList.remove('hidden');
    renderWordleGrid();
    renderKeyboard();
    guesses = [];
    currentGuess = "";
}

function renderWordleGrid() {
    const grid = document.getElementById('wordle-grid');
    grid.innerHTML = "";
    for (let i = 0; i < MAX_GUESSES; i++) {
        const row = document.createElement('div');
        row.className = 'wordle-row';
        for (let j = 0; j < 5; j++) {
            const cell = document.createElement('div');
            cell.className = 'wordle-cell';
            cell.id = `cell-${i}-${j}`;
            row.appendChild(cell);
        }
        grid.appendChild(row);
    }
}

function renderKeyboard() {
    const keyboard = document.getElementById('keyboard');
    const layout = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
    keyboard.innerHTML = "";
    
    layout.forEach(rowStr => {
        const row = document.createElement('div');
        row.className = 'keyboard-row';
        rowStr.split('').forEach(char => {
            const key = document.createElement('div');
            key.className = 'key';
            key.textContent = char;
            key.addEventListener('click', () => handleInput(char));
            row.appendChild(key);
        });
        keyboard.appendChild(row);
    });

    const enterKey = document.createElement('div');
    enterKey.className = 'key';
    enterKey.textContent = "ENTER";
    enterKey.addEventListener('click', () => handleInput("ENTER"));
    keyboard.appendChild(enterKey);

    const delKey = document.createElement('div');
    delKey.className = 'key';
    delKey.textContent = "DEL";
    delKey.addEventListener('click', () => handleInput("BACKSPACE"));
    keyboard.appendChild(delKey);
}

function handleKeyPress(e) {
    if (document.getElementById('puzzle-modal').classList.contains('hidden')) return;
    handleInput(e.key.toUpperCase());
}

function handleInput(key) {
    if (key === "ENTER") {
        submitGuess();
    } else if (key === "BACKSPACE") {
        currentGuess = currentGuess.slice(0, -1);
        updateGrid();
    } else if (/^[A-Z]$/.test(key) && currentGuess.length < 5) {
        currentGuess += key;
        updateGrid();
    }
}

function updateGrid() {
    const rowIdx = guesses.length;
    for (let i = 0; i < 5; i++) {
        const cell = document.getElementById(`cell-${rowIdx}-${i}`);
        cell.textContent = currentGuess[i] || "";
    }
}

async function submitGuess() {
    if (currentGuess.length !== 5) return;

    const rowIdx = guesses.length;
    const result = checkGuess(currentGuess, currentDailyWord);
    
    // Animate cells
    for (let i = 0; i < 5; i++) {
        const cell = document.getElementById(`cell-${rowIdx}-${i}`);
        cell.classList.add(result[i]);
    }

    guesses.push(currentGuess);
    
    if (currentGuess === currentDailyWord) {
        // WIN
        confetti();
        await fetch('/api/puzzle/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ guesses: guesses.length })
        });
        setTimeout(() => {
            document.getElementById('puzzle-modal').classList.add('hidden');
            checkAuth(); // Refresh state
        }, 2000);
    } else if (guesses.length === MAX_GUESSES) {
        alert("The fire dims... but try again tomorrow. Word was: " + currentDailyWord);
        document.getElementById('puzzle-modal').classList.add('hidden');
    }
    
    currentGuess = "";
}

function checkGuess(guess, target) {
    const result = Array(5).fill("absent");
    const targetArr = target.split('');
    const guessArr = guess.split('');

    // First pass: Correct
    for (let i = 0; i < 5; i++) {
        if (guessArr[i] === targetArr[i]) {
            result[i] = "correct";
            targetArr[i] = null;
            guessArr[i] = null;
        }
    }

    // Second pass: Present
    for (let i = 0; i < 5; i++) {
        if (guessArr[i] && targetArr.includes(guessArr[i])) {
            result[i] = "present";
            targetArr[targetArr.indexOf(guessArr[i])] = null;
        }
    }
    return result;
}

// --- MESSAGING ---
function openMessageModal() {
    document.getElementById('message-modal').classList.remove('hidden');
}

async function sendMessage() {
    const text = document.getElementById('message-input').value.trim();
    if (!text) return;

    const res = await fetch('/api/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
    });

    if (res.ok) {
        document.getElementById('message-modal').classList.add('hidden');
        document.getElementById('message-input').value = "";
        // Fire Toss Animation could be added here
        confetti({ particleCount: 50, colors: ['#ff6f00', '#ffca28'] });
        checkAuth();
    }
}

// --- ASH REVEAL ---
let activeMessageId = null;

function initAshReveal(text, messageId) {
    // If we're already viewing this exact unread message, don't re-initialize the canvas
    if (activeMessageId === messageId) return;
    
    activeMessageId = messageId;
    const canvas = document.getElementById('ash-canvas');
    const ctx = canvas.getContext('2d');
    const container = document.getElementById('ash-pile');
    
    // Clear old note
    const oldNote = container.querySelector('.revealed-note');
    if (oldNote) oldNote.remove();

    const note = document.createElement('div');
    note.className = 'revealed-note';
    note.textContent = text;
    container.appendChild(note);

    canvas.width = container.offsetWidth || 200;
    canvas.height = container.offsetHeight || 100;

    // Draw ash layer
    ctx.fillStyle = '#444';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Grainy texture
    for(let i=0; i<500; i++) {
        ctx.fillStyle = `rgba(0,0,0,${Math.random()*0.2})`;
        ctx.fillRect(Math.random()*canvas.width, Math.random()*canvas.height, 2, 2);
    }

    let isDrawing = false;
    
    // Instead of simple stroke counts which can trigger without scrubbing much,
    // let's divide the canvas into a small 8x4 grid of sectors.
    // When 30% of these grid sectors have been touched, the message is marked as read!
    // This makes the 30% threshold highly accurate and extremely satisfying to brush away.
    const cols = 8;
    const rows = 4;
    const sectors = Array(cols * rows).fill(false);
    const requiredSectors = Math.ceil(cols * rows * 0.3); // 30% of 32 = 10 sectors

    const scrub = (e) => {
        if (!isDrawing) return;
        const rect = canvas.getBoundingClientRect();
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        
        if (clientX === undefined || clientY === undefined) return;
        
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(x, y, 22, 0, Math.PI * 2);
        ctx.fill();
        
        // Find which sector was scrubbed
        const colIdx = Math.max(0, Math.min(cols - 1, Math.floor((x / canvas.width) * cols)));
        const rowIdx = Math.max(0, Math.min(rows - 1, Math.floor((y / canvas.height) * rows)));
        const sectorIdx = rowIdx * cols + colIdx;
        
        if (!sectors[sectorIdx]) {
            sectors[sectorIdx] = true;
            const clearedSectors = sectors.filter(s => s).length;
            if (clearedSectors >= requiredSectors) {
                markMessageRead(activeMessageId);
            }
        }
    };

    const startDrawing = (e) => {
        isDrawing = true;
        scrub(e);
    };

    canvas.onmousedown = startDrawing;
    canvas.onmousemove = scrub;
    window.addEventListener('mouseup', () => { isDrawing = false; });
    
    canvas.addEventListener('touchstart', (e) => {
        isDrawing = true;
        scrub(e);
    }, { passive: true });
    canvas.addEventListener('touchmove', (e) => {
        scrub(e);
    }, { passive: true });
    window.addEventListener('touchend', () => { isDrawing = false; });
}

async function markMessageRead(messageId) {
    if (!messageId) return;
    
    // Check if already marked read locally to avoid duplicate calls
    if (!activeMessageId) return;

    // Call API to mark as read permanently on server
    const res = await fetch('/api/message/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId })
    });
    if (res.ok) {
        // Prevent re-triggering while fading
        activeMessageId = null;
        
        // Softly clear indicator after a brief delay so they can read the rest of the text
        setTimeout(() => {
            document.getElementById('message-indicator').classList.add('hidden');
            // Refresh full gameState from server to sync perfectly
            checkAuth();
        }, 3000);
    }
}

// --- DEBUG ---
async function debugFastForward() {
    await fetch('/api/debug/fast-forward', { method: 'POST' });
    checkAuth();
}

async function debugResetPuzzle() {
    await fetch('/api/debug/reset-puzzle', { method: 'POST' });
    checkAuth();
}

async function debugSimulateMessage() {
    await fetch('/api/debug/simulate-message', { method: 'POST' });
    checkAuth();
}

// Start
init();

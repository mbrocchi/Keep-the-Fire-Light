const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Helper to read/write data
const getData = () => JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const saveData = (data) => fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

const WORDS = ["HEARTH", "SHIFT", "CABIN", "FLAME", "NIGHT", "EMBER", "WOODS", "LIGHT", "STOKE", "ROAST"];

// Get today's word based on date
const getDailyWord = () => {
    const today = new Date().toISOString().split('T')[0];
    const seed = today.split('-').reduce((a, b) => parseInt(a) + parseInt(b), 0);
    return WORDS[seed % WORDS.length];
};

// Middleware to check authentication
const auth = (req, res, next) => {
    const username = req.cookies.username ? req.cookies.username.toLowerCase() : null;
    if (!username) return res.status(401).json({ error: 'Unauthorized' });
    const data = getData();
    const user = data.users.find(u => u.username.toLowerCase() === username);
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = user;
    next();
};

// --- AUTH ROUTES ---

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    const lowerUsername = username.toLowerCase();
    let data = getData();
    let user = data.users.find(u => u.username.toLowerCase() === lowerUsername);

    if (!user) {
        // Create new user if not exists
        user = { 
            username: lowerUsername, 
            password: password, // In a real app, hash this
            partner: null, 
            lastLogin: new Date().toISOString() 
        };
        data.users.push(user);
        saveData(data);
    } else {
        // Check password
        if (user.password !== password) {
            return res.status(401).json({ error: 'Invalid password' });
        }
    }

    res.cookie('username', lowerUsername, { httpOnly: true }); // Session cookie
    res.json(user);
});

app.post('/api/logout', (req, res) => {
    res.clearCookie('username');
    res.json({ success: true });
});

app.post('/api/pair', auth, (req, res) => {
    const partnerName = req.body.partnerName ? req.body.partnerName.toLowerCase() : null;
    if (!partnerName) return res.status(400).json({ error: 'Partner name required' });

    let data = getData();
    const userIndex = data.users.findIndex(u => u.username.toLowerCase() === req.user.username.toLowerCase());
    const partnerIndex = data.users.findIndex(u => u.username.toLowerCase() === partnerName);

    if (partnerIndex === -1) return res.status(404).json({ error: 'Partner not found. They must login once first.' });
    if (data.users[partnerIndex].partner) return res.status(400).json({ error: 'Partner already paired' });
    if (partnerName === req.user.username.toLowerCase()) return res.status(400).json({ error: 'Cannot pair with yourself' });

    const campsiteId = `camp_${Date.now()}`;
    const actualPartnerName = data.users[partnerIndex].username; // use their original case or lower
    data.users[userIndex].partner = actualPartnerName;
    data.users[partnerIndex].partner = req.user.username;
    data.users[userIndex].campsiteId = campsiteId;
    data.users[partnerIndex].campsiteId = campsiteId;

    data.campsites.push({
        id: campsiteId,
        members: [req.user.username.toLowerCase(), partnerName.toLowerCase()],
        fireLevel: 100, // 0 to 100
        lastActivity: new Date().toISOString(),
        messages: []
    });

    saveData(data);
    res.json({ success: true, campsiteId });
});

// --- GAME ROUTES ---

app.get('/api/state', auth, (req, res) => {
    let data = getData();
    const campsite = data.campsites.find(c => c.members.includes(req.user.username.toLowerCase()));
    
    if (!campsite) return res.json({ paired: false });

    // Self-healing: Ensure every message has a unique ID and correct data structure
    let modified = false;
    campsite.messages.forEach((m, idx) => {
        if (!m.id) {
            m.id = `msg_healed_${Date.now()}_${idx}`;
            modified = true;
        }
        if (!m.readBy) {
            m.readBy = [];
            modified = true;
        }
    });
    if (modified) {
        saveData(data);
    }

    // Calculate decay
    const lastActivity = new Date(campsite.lastActivity);
    const now = new Date();
    const hoursPassed = (now - lastActivity) / (1000 * 60 * 60);
    const decayRate = 2; // 2% per hour
    campsite.fireLevel = Math.max(10, campsite.fireLevel - (hoursPassed * decayRate));

    // Daily Word Status
    const today = new Date().toISOString().split('T')[0];
    const user = data.users.find(u => u.username.toLowerCase() === req.user.username.toLowerCase());
    const completedToday = user.lastPuzzleDate === today;

    // Filter messages: Only send messages that are NOT sent by this user, AND have NOT been read by this user
    const usernameLower = req.user.username.toLowerCase();
    const unreadPartnerMessages = campsite.messages.filter(m => {
        const isFromPartner = m.sender.toLowerCase() !== usernameLower;
        const hasNotRead = !m.readBy.map(u => u.toLowerCase()).includes(usernameLower);
        return isFromPartner && hasNotRead;
    });

    res.json({
        paired: true,
        username: user.username, // Send actual username back
        fireLevel: campsite.fireLevel,
        messages: unreadPartnerMessages, // Only return unread partner messages!
        completedToday,
        partner: user.partner,
        dailyWord: completedToday ? getDailyWord() : null
    });
});

app.post('/api/puzzle/complete', auth, (req, res) => {
    const { guesses } = req.body; // number of guesses used
    const data = getData();
    const userIndex = data.users.findIndex(u => u.username === req.user.username);
    const campsite = data.campsites.find(c => c.members.includes(req.user.username));

    const today = new Date().toISOString().split('T')[0];
    data.users[userIndex].lastPuzzleDate = today;

    // Fuel the fire: 6 max guesses. Kindling = 6 - guessesUsed + 1
    const kindling = 7 - guesses; 
    campsite.fireLevel = Math.min(100, campsite.fireLevel + (kindling * 15));
    campsite.lastActivity = new Date().toISOString();

    saveData(data);
    res.json({ success: true, fireLevel: campsite.fireLevel });
});

app.post('/api/message', auth, (req, res) => {
    const { text } = req.body;
    let data = getData();
    const campsite = data.campsites.find(c => c.members.includes(req.user.username));

    campsite.messages.push({
        id: `msg_${Date.now()}`,
        sender: req.user.username,
        text,
        timestamp: new Date().toISOString(),
        readBy: [req.user.username]
    });
    campsite.lastActivity = new Date().toISOString();
    campsite.fireLevel = Math.min(100, campsite.fireLevel + 5); // Small boost for message

    saveData(data);
    res.json({ success: true });
});

app.post('/api/message/read', auth, (req, res) => {
    const { messageId } = req.body;
    let data = getData();
    const campsite = data.campsites.find(c => c.members.includes(req.user.username.toLowerCase()));
    
    const message = campsite.messages.find(m => m.id === messageId);
    if (message) {
        const usernameLower = req.user.username.toLowerCase();
        if (!message.readBy.map(u => u.toLowerCase()).includes(usernameLower)) {
            message.readBy.push(usernameLower);
            saveData(data);
        }
    }
    res.json({ success: true });
});

// --- DEBUG ROUTES ---

app.post('/api/debug/fast-forward', auth, (req, res) => {
    let data = getData();
    const campsite = data.campsites.find(c => c.members.includes(req.user.username.toLowerCase()));
    
    // Set last activity to 24 hours ago and drop fire level
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);
    campsite.lastActivity = yesterday.toISOString();
    campsite.fireLevel = 20;

    // Fast-forward should also reset the daily puzzle status for both members so they can stoke the fire again
    campsite.members.forEach(member => {
        const u = data.users.find(user => user.username.toLowerCase() === member.toLowerCase());
        if (u) {
            u.lastPuzzleDate = null;
        }
    });

    saveData(data);
    res.json({ success: true });
});

app.post('/api/debug/reset-puzzle', auth, (req, res) => {
    let data = getData();
    const user = data.users.find(u => u.username === req.user.username);
    user.lastPuzzleDate = null;
    saveData(data);
    res.json({ success: true });
});

app.post('/api/debug/simulate-message', auth, (req, res) => {
    let data = getData();
    const user = data.users.find(u => u.username === req.user.username);
    const campsite = data.campsites.find(c => c.members.includes(req.user.username));
    
    campsite.messages.push({
        id: `msg_sim_${Date.now()}`,
        sender: user.partner || "system",
        text: "Thinking of you!",
        timestamp: new Date().toISOString(),
        readBy: []
    });
    saveData(data);
    res.json({ success: true });
});

app.get('/api/word', auth, (req, res) => {
    res.json({ word: getDailyWord() });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

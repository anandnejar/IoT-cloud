const express = require('express');
const fs = require('fs');
const path = require('path');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'sistec-secret-key',
    resave: false,
    saveUninitialized: true
}));

// Simple JSON Database setup
const dbPath = path.join(__dirname, 'database.json');
const lcdPath = path.join(__dirname, 'lcd.txt');

// Initialize files if they don't exist
if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify({ users: [], records: [] }));
if (!fs.existsSync(lcdPath)) fs.writeFileSync(lcdPath, "HELLO SISTec");

function readDB() {
    return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}
function writeDB(data) {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

// Timezone +5:30 (Asia/Kolkata) Helper
function getISTDate() {
    const date = new Date();
    const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
    const ist = new Date(utc + (3600000 * 5.5));
    
    const time = ist.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const formattedDate = ist.getDate().toString().padStart(2, '0') + '-' + 
                          (ist.getMonth() + 1).toString().padStart(2, '0') + '-' + 
                          ist.getFullYear();
    return { time, date: formattedDate };
}

// --- AUTH APIs ---
app.post('/api/register', (req, res) => {
    const { name, email, password } = req.body;
    let db = readDB();
    db.users.push({ name, email, password });
    writeDB(db);
    res.redirect('/index.html');
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    let db = readDB();
    let user = db.users.find(u => u.email === email && u.password === password);
    if (user) {
        req.session.user = user.name;
        res.redirect('/dashboard.html');
    } else {
        res.send("Invalid Login. <a href='/index.html'>Try Again</a>");
    }
});

app.get('/api/user', (req, res) => {
    if (req.session.user) res.json({ name: req.session.user });
    else res.status(401).json({ error: "Not logged in" });
});

// --- DASHBOARD APIs ---
app.post('/api/lcd', (req, res) => {
    let text = req.body.text.substring(0, 16); // Max 16 chars
    fs.writeFileSync(lcdPath, text);
    res.json({ success: true });
});

app.get('/api/records', (req, res) => {
    let db = readDB();
    res.json(db.records);
});

app.delete('/api/records/:id', (req, res) => {
    let db = readDB();
    db.records = db.records.filter(r => r.id != req.params.id);
    writeDB(db);
    res.json({ success: true });
});

// --- HARDWARE APIs (For ESP8266) ---
// API 1: Save Temperature & Humidity (GET Method for easy ESP handling)
app.get('/api/update', (req, res) => {
    const temp = req.query.temp || 0;
    const hum = req.query.hum || 0;
    const ist = getISTDate();
    
    let db = readDB();
    db.records.push({
        id: Date.now(), // simple unique ID
        temperature: temp,
        humidity: hum,
        time: ist.time,
        date: ist.date
    });
    writeDB(db);
    
    res.send("DATA SENT...!!");
});

// API 2: Fetch Text from lcd.txt
app.get('/api/lcd-text', (req, res) => {
    let text = fs.readFileSync(lcdPath, 'utf8');
    res.send(text);
});

// Redirect root to index
app.get('/', (req, res) => res.redirect('/index.html'));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
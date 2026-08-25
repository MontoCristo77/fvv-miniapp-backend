const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

const BOT_TOKEN = process.env.BOT_TOKEN;
const DATA_FILE = path.join(__dirname, 'data.json');

// ----- Ma'lumotlarni fayldan o'qish va yozish -----
function loadAppeals() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (err) {
        console.error('Faylni o\'qishda xatolik:', err);
    }
    return [];
}

function saveAppeals(appeals) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(appeals, null, 2));
    } catch (err) {
        console.error('Faylni yozishda xatolik:', err);
    }
}

let appeals = loadAppeals();
let nextId = appeals.length ? Math.max(...appeals.map(a => a.id)) + 1 : 1;

// ----- ADMIN ID LAR -----
const ADMIN_IDS = [7117334799]; // Qo'shimcha admin ID larini qo'shishingiz mumkin

// ----- Telegram xabar yuborish -----
async function sendTelegramMessage(chatId, text) {
    if (!BOT_TOKEN) return false;
    try {
        const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: text })
        });
        const data = await response.json();
        return data.ok === true;
    } catch (err) {
        console.error('Telegram xabar yuborish xatolik:', err);
        return false;
    }
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// ----- API: FOYDALANUVCHI -----
app.get('/api/appeals', (req, res) => {
    res.json(appeals);
});

app.post('/api/appeals', (req, res) => {
    const { fullName, position, type, region, description, file, userId, userName } = req.body;
    const newAppeal = {
        id: nextId++,
        fullName: fullName || '',
        position: position || '',
        type: type || 'boshqa',
        region: region || '',
        description: description || '',
        file: file || null,
        userId: userId || null,
        userName: userName || 'Anonim',
        status: 'pending',
        createdAt: new Date().toISOString(),
        deadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        adminResponse: null,
        responseDate: null
    };
    appeals.push(newAppeal);
    saveAppeals(appeals);
    res.status(201).json(newAppeal);
});

// ----- API: ADMIN -----
app.get('/api/admin/appeals', (req, res) => {
    res.json(appeals);
});

app.put('/api/admin/appeals/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const { status, adminResponse } = req.body;
    const index = appeals.findIndex(a => a.id === id);
    if (index === -1) {
        return res.status(404).json({ error: 'Murojaat topilmadi' });
    }
    if (status) appeals[index].status = status;
    if (adminResponse) {
        appeals[index].adminResponse = adminResponse;
        appeals[index].responseDate = new Date().toISOString();
    }
    saveAppeals(appeals);
    res.json(appeals[index]);
});

app.delete('/api/admin/appeals/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const index = appeals.findIndex(a => a.id === id);
    if (index === -1) {
        return res.status(404).json({ error: 'Murojaat topilmadi' });
    }
    appeals.splice(index, 1);
    saveAppeals(appeals);
    res.status(204).send();
});

// ----- ADMIN JAVOB YOZGANDA XABAR YUBORISH -----
app.post('/api/admin/notify', async (req, res) => {
    const { appealId, message } = req.body;
    const appeal = appeals.find(a => a.id === appealId);
    if (!appeal) {
        return res.status(404).json({ error: 'Murojaat topilmadi' });
    }
    if (!appeal.userId) {
        return res.status(400).json({ error: 'Foydalanuvchi ID si yo‘q' });
    }
    const text = `📩 Sizning #${appealId} raqamli murojaatingizga javob berildi:\n\n${message}`;
    const sent = await sendTelegramMessage(appeal.userId, text);
    if (sent) {
        res.json({ success: true, message: 'Xabar yuborildi' });
    } else {
        res.status(500).json({ error: 'Xabar yuborishda xatolik' });
    }
});

// ----- ADMINLIKNI TEKSHIRISH -----
app.post('/api/check-admin', (req, res) => {
    const { userId } = req.body;
    const isAdmin = ADMIN_IDS.includes(Number(userId));
    res.json({ isAdmin });
});

// ----- FRONTEND -----
app.get('*', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

app.listen(PORT, () => {
    console.log(`✅ Server ${PORT} portda ishga tushdi`);
    if (BOT_TOKEN) {
        console.log('🤖 Telegram bot ulangan');
    } else {
        console.warn('⚠️ BOT_TOKEN sozlanmagan!');
    }
});
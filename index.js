const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

const BOT_TOKEN = process.env.BOT_TOKEN;
console.log('🔍 BOT_TOKEN mavjudmi?', BOT_TOKEN ? 'HA' : 'YO\'Q');

const DATA_FILE = path.join(__dirname, 'data.json');
const USERS_FILE = path.join(__dirname, 'users.json');

function loadJSON(file) {
    try {
        if (fs.existsSync(file)) {
            return JSON.parse(fs.readFileSync(file, 'utf8'));
        }
    } catch (e) { console.error('Yuklash xatolik:', e.message); }
    return [];
}

function saveJSON(file, data) {
    try {
        fs.writeFileSync(file, JSON.stringify(data, null, 2));
    } catch (e) { console.error('Saqlash xatolik:', e.message); }
}

let appeals = loadJSON(DATA_FILE);
let users = loadJSON(USERS_FILE);
let nextId = appeals.length ? Math.max(...appeals.map(a => a.id)) + 1 : 1;

const ADMIN_IDS = [7117334799];

async function sendTelegramMessage(chatId, text) {
    if (!BOT_TOKEN) return false;
    try {
        const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text })
        });
        const data = await res.json();
        return data.ok === true;
    } catch (e) {
        console.error('Telegram xatolik:', e.message);
        return false;
    }
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

app.post('/webhook', async (req, res) => {
    const update = req.body;
    if (update.message && update.message.text === '/start') {
        const chatId = update.message.chat.id;
        const from = update.message.from;
        const user = {
            id: from.id,
            firstName: from.first_name || '',
            lastName: from.last_name || '',
            username: from.username || '',
            registeredAt: new Date().toISOString()
        };
        const existing = users.find(u => u.id === user.id);
        if (!existing) {
            users.push(user);
            saveJSON(USERS_FILE, users);
        }
        await sendTelegramMessage(chatId, `Assalomu alaykum, ${user.firstName}! ✅ Siz ro'yxatdan o'tdingiz.`);
    }
    res.sendStatus(200);
});

app.get('/api/appeals', (req, res) => res.json(appeals));

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
    saveJSON(DATA_FILE, appeals);
    res.status(201).json(newAppeal);
});

app.get('/api/admin/appeals', (req, res) => res.json(appeals));

app.put('/api/admin/appeals/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const { status, adminResponse } = req.body;
    const index = appeals.findIndex(a => a.id === id);
    if (index === -1) return res.status(404).json({ error: 'Murojaat topilmadi' });
    if (status) appeals[index].status = status;
    if (adminResponse) {
        appeals[index].adminResponse = adminResponse;
        appeals[index].responseDate = new Date().toISOString();
    }
    saveJSON(DATA_FILE, appeals);
    res.json(appeals[index]);
});

app.delete('/api/admin/appeals/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const index = appeals.findIndex(a => a.id === id);
    if (index === -1) return res.status(404).json({ error: 'Murojaat topilmadi' });
    appeals.splice(index, 1);
    saveJSON(DATA_FILE, appeals);
    res.status(204).send();
});

// ----- MUDDATNI UZAYTIRISH (xatoliklarni logga chiqaradi) -----
app.put('/api/admin/appeals/:id/extend', (req, res) => {
    console.log('📥 Extend so‘rovi keldi:', req.params.id, req.body);
    const id = parseInt(req.params.id);
    const { days } = req.body;
    if (!days || days < 1) {
        console.log('❌ Kunlar soni xato:', days);
        return res.status(400).json({ error: 'Kunlar soni to‘g‘ri emas (min 1)' });
    }
    const index = appeals.findIndex(a => a.id === id);
    if (index === -1) {
        console.log('❌ Murojaat topilmadi:', id);
        return res.status(404).json({ error: 'Murojaat topilmadi' });
    }
    if (appeals[index].status === 'resolved') {
        console.log('❌ Hal qilingan murojaat:', id);
        return res.status(400).json({ error: 'Hal qilingan murojaat muddatini uzaytirib bo‘lmaydi' });
    }
    const currentDeadline = new Date(appeals[index].deadline);
    currentDeadline.setDate(currentDeadline.getDate() + days);
    appeals[index].deadline = currentDeadline.toISOString();
    saveJSON(DATA_FILE, appeals);
    console.log('✅ Muddat yangilandi:', appeals[index].deadline);
    res.json(appeals[index]);
});

app.post('/api/admin/notify', async (req, res) => {
    const { appealId, message } = req.body;
    const appeal = appeals.find(a => a.id === appealId);
    if (!appeal) return res.status(404).json({ error: 'Murojaat topilmadi' });
    if (!appeal.userId) return res.status(400).json({ error: 'Foydalanuvchi ID si yo‘q' });
    if (!BOT_TOKEN) return res.status(500).json({ error: 'BOT_TOKEN sozlanmagan' });
    const text = `📩 Sizning #${appealId} raqamli murojaatingizga javob berildi:\n\n${message}`;
    const sent = await sendTelegramMessage(appeal.userId, text);
    if (sent) {
        res.json({ success: true, message: 'Xabar yuborildi' });
    } else {
        res.status(500).json({ error: 'Xabar yuborishda xatolik' });
    }
});

app.post('/api/check-admin', (req, res) => {
    const { userId } = req.body;
    res.json({ isAdmin: ADMIN_IDS.includes(Number(userId)) });
});

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
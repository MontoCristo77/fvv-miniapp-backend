const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

// Telegram bot token (Railway Variables dan olinadi)
const BOT_TOKEN = process.env.BOT_TOKEN;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// ----- MA'LUMOTLAR (vaqtinchalik xotira) -----
let appeals = [];
let nextId = 1;

// ----- ADMIN ID RO'YXATI (o'zingiznikini yozing!) -----
const ADMIN_IDS = [7117334799]; // 

// ----- FUNKSIYA: Telegram xabar yuborish -----
async function sendTelegramMessage(chatId, text) {
    if (!BOT_TOKEN) {
        console.error('BOT_TOKEN sozlanmagan!');
        return false;
    }
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

// ----- API: FOYDALANUVCHI (murojaat yuborish va o'z murojaatlarini ko'rish) -----
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
    res.status(201).json(newAppeal);
});

// ----- API: ADMIN (barcha murojaatlar, tahrirlash, o'chirish) -----
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
    res.json(appeals[index]);
});

app.delete('/api/admin/appeals/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const index = appeals.findIndex(a => a.id === id);
    if (index === -1) {
        return res.status(404).json({ error: 'Murojaat topilmadi' });
    }
    appeals.splice(index, 1);
    res.status(204).send();
});

// ----- API: ADMIN JAVOB YOZGANDA XABAR YUBORISH -----
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

// ----- FRONTEND (barcha boshqa so'rovlar index.html ga) -----
app.get('*', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// ----- SERNI ISHGA TUSHIRISH -----
app.listen(PORT, () => {
    console.log(`✅ Server ${PORT} portda ishga tushdi`);
    if (BOT_TOKEN) {
        console.log('🤖 Telegram bot ulangan');
    } else {
        console.warn('⚠️ BOT_TOKEN sozlanmagan! Iltimos, Railway Variables ga qo\'shing.');
    }
});
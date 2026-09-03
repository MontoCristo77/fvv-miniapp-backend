const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

const BOT_TOKEN = process.env.BOT_TOKEN;
const BOT_USERNAME = process.env.BOT_USERNAME || 'sirdaryoFVBgamurojaat_bot';

console.log('🔍 BOT_TOKEN mavjudmi?', BOT_TOKEN ? 'HA' : 'YO\'Q');
console.log('🤖 BOT_USERNAME:', BOT_USERNAME);

const DATA_FILE = path.join(__dirname, 'data.json');
const USERS_FILE = path.join(__dirname, 'users.json');
const MESSAGES_FILE = path.join(__dirname, 'messages.json');

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
let messages = loadJSON(MESSAGES_FILE);
let nextId = appeals.length ? Math.max(...appeals.map(a => a.id)) + 1 : 1;

const ADMIN_IDS = [7117334799, 72259146]; // O'zingizning admin ID laringiz

async function sendTelegramMessage(chatId, text, extra = {}) {
    if (!BOT_TOKEN) return false;
    try {
        const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown', ...extra })
        });
        const data = await res.json();
        return data.ok === true;
    } catch (e) {
        console.error('Telegram xatolik:', e.message);
        return false;
    }
}

// Foydalanuvchiga xabar yuborish (matn)
async function sendMessageToUser(userId, text) {
    return sendTelegramMessage(userId, text);
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// ----- WEBHOOK (barcha xabarlarni qabul qiladi) -----
app.post('/webhook', async (req, res) => {
    const update = req.body;
    console.log('📥 Webhook so‘rovi:', JSON.stringify(update, null, 2));

    // Agar xabar bo'lsa
    if (update.message) {
        const msg = update.message;
        const chatId = msg.chat.id;
        const from = msg.from;

        // Foydalanuvchini ro'yxatga olish (agar mavjud bo'lmasa)
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
            console.log(`✅ Yangi foydalanuvchi ro'yxatdan o'tdi: ${user.id}`);
        }

        // /start buyrug'i
        if (msg.text && msg.text === '/start') {
            await sendTelegramMessage(chatId, `Assalomu alaykum, ${user.firstName}! ✅ Siz ro'yxatdan o'tdingiz.\n\n📱 Murojaat yuborish uchun pastdagi tugmani bosing.`);
            res.sendStatus(200);
            return;
        }

        // Foydalanuvchi yuborgan xabarni saqlash (matn, audio, video_note)
        let messageType = 'text';
        let content = null;
        let fileId = null;

        if (msg.text) {
            messageType = 'text';
            content = msg.text;
        } else if (msg.audio) {
            messageType = 'audio';
            fileId = msg.audio.file_id;
            content = msg.audio.file_name || 'Audio';
        } else if (msg.video_note) {
            messageType = 'video_note';
            fileId = msg.video_note.file_id;
            content = 'Dumaloq video';
        } else {
            // Boshqa turdagi xabarlarni e'tiborsiz qoldiramiz (yoki keyin qo'shamiz)
            res.sendStatus(200);
            return;
        }

        const newMessage = {
            id: messages.length + 1,
            userId: from.id,
            userName: (from.first_name || '') + ' ' + (from.last_name || ''),
            type: messageType,
            content: content,
            fileId: fileId || null,
            createdAt: new Date().toISOString()
        };
        messages.push(newMessage);
        saveJSON(MESSAGES_FILE, messages);
        console.log(`📩 Yangi xabar saqlandi: ${messageType} dan ${user.id}`);

        // Adminlarga xabar kelganligi haqida xabar yuborish (faqat matn yoki audio yoki video)
        const adminText = `📩 *Yangi xabar!*\n\n👤 *Foydalanuvchi:* ${user.firstName} ${user.lastName}\n📌 *Tur:* ${messageType}\n📝 *Matn:* ${msg.text || 'Audio/Video'}\n🕒 *Vaqt:* ${new Date().toLocaleString()}`;
        ADMIN_IDS.forEach(async (adminId) => {
            await sendTelegramMessage(adminId, adminText);
        });

        res.sendStatus(200);
        return;
    }

    res.sendStatus(200);
});

// ----- API: murojaatlar (oldingidek) -----
app.get('/api/appeals', (req, res) => res.json(appeals));

app.post('/api/appeals', async (req, res) => {
    const { fullName, position, type, region, description, subject, address, privacy, anonymous, file, userId, userName } = req.body;
    const newAppeal = {
        id: nextId++,
        fullName: fullName || '',
        position: position || '',
        type: type || 'boshqa',
        region: region || '',
        description: description || '',
        subject: subject || '',
        address: address || '',
        privacy: privacy || 'open',
        anonymous: anonymous || false,
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

    // Adminlarga xabar yuborish
    try {
        const adminMessage = 
`📩 *Yangi murojaat #${newAppeal.id} keldi!*

👤 *Foydalanuvchi:* ${newAppeal.userName}
📌 *Turi:* ${newAppeal.type}
📍 *Tuzilma:* ${newAppeal.region}
📝 *Mavzu:* ${newAppeal.subject || 'Ko‘rsatilmagan'}
📝 *Tavsif:* ${newAppeal.description.substring(0, 100)}${newAppeal.description.length > 100 ? '...' : ''}

🔗 *Ko‘rish uchun:* https://t.me/${BOT_USERNAME}?start=appeal_${newAppeal.id}`;

        const adminPromises = ADMIN_IDS.map(adminId => 
            sendTelegramMessage(adminId, adminMessage).catch(err => 
                console.error(`Admin ${adminId} ga xabar yuborishda xatolik:`, err)
            )
        );
        await Promise.all(adminPromises);
        console.log(`✅ Adminlarga xabar yuborildi (murojaat #${newAppeal.id})`);
    } catch (err) {
        console.error('Adminlarga xabar yuborishda xatolik:', err);
    }

    res.status(201).json(newAppeal);
});

// ----- API: ADMIN (murojaatlar, foydalanuvchilar, xabarlar) -----
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

app.put('/api/admin/appeals/:id/extend', (req, res) => {
    const id = parseInt(req.params.id);
    const { days } = req.body;
    if (!days || days < 1) {
        return res.status(400).json({ error: 'Kunlar soni to‘g‘ri emas (min 1)' });
    }
    const index = appeals.findIndex(a => a.id === id);
    if (index === -1) return res.status(404).json({ error: 'Murojaat topilmadi' });
    if (appeals[index].status === 'resolved') {
        return res.status(400).json({ error: 'Hal qilingan murojaat muddatini uzaytirib bo‘lmaydi' });
    }
    const currentDeadline = new Date(appeals[index].deadline);
    currentDeadline.setDate(currentDeadline.getDate() + days);
    appeals[index].deadline = currentDeadline.toISOString();
    saveJSON(DATA_FILE, appeals);
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

// ----- YANGI: Admin broadcast (barcha foydalanuvchilarga xabar yuborish) -----
app.post('/api/admin/broadcast', async (req, res) => {
    const { message } = req.body;
    if (!message || message.trim().length === 0) {
        return res.status(400).json({ error: 'Xabar matnini kiriting!' });
    }

    // Admin tekshiruvi (xavfsizlik)
    // Biz admin ekanligini tekshirish uchun so'rov yuboruvchi user ID ni olishimiz kerak.
    // Buni frontenddan userId ni yuborish orqali yoki session orqali qilish mumkin.
    // Hozircha qulaylik uchun frontenddan userId ni yuboramiz va tekshiramiz.
    const { userId } = req.body;
    if (!ADMIN_IDS.includes(Number(userId))) {
        return res.status(403).json({ error: 'Ruxsat yo‘q! Faqat admin.' });
    }

    const allUsers = loadJSON(USERS_FILE);
    const sentCount = 0;
    const failed = [];

    for (const user of allUsers) {
        try {
            await sendTelegramMessage(user.id, `📢 *Admin xabari:*\n\n${message}`);
            sentCount++;
        } catch (err) {
            failed.push(user.id);
            console.error(`Xabar yuborishda xatolik (${user.id}):`, err);
        }
    }

    res.json({
        success: true,
        sent: sentCount,
        failed: failed,
        total: allUsers.length
    });
});

// ----- YANGI: Foydalanuvchi xabarlarini olish (admin uchun) -----
app.get('/api/admin/messages', (req, res) => {
    // Admin tekshiruvi (oddiy)
    const { userId } = req.query;
    if (!ADMIN_IDS.includes(Number(userId))) {
        return res.status(403).json({ error: 'Ruxsat yo‘q!' });
    }
    res.json(messages);
});

// ----- ADMINLIKNI TEKSHIRISH -----
app.post('/api/check-admin', (req, res) => {
    const { userId } = req.body;
    res.json({ isAdmin: ADMIN_IDS.includes(Number(userId)) });
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
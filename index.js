const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public')); // statik fayllar (index.html) shu papkada

// ----- API ROUTES (wildcard'dan OLDIN kelishi kerak!) -----
let appeals = []; // vaqtinchalik xotira (keyinchalik DB ga o'tkaziladi)

// Barcha murojaatlarni olish
app.get('/api/appeals', (req, res) => {
    res.json(appeals);
});

// Yangi murojaat qo'shish
app.post('/api/appeals', (req, res) => {
    const newAppeal = {
        id: Date.now(),
        ...req.body,
        status: 'pending',
        createdAt: new Date().toISOString()
    };
    appeals.push(newAppeal);
    res.status(201).json(newAppeal);
});

// ----- FRONTEND (barcha boshqa so'rovlar index.html ga) -----
// Bu wildcard route API'dan keyin kelishi shart!
app.get('*', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Serverni ishga tushirish
app.listen(PORT, () => {
    console.log(`✅ Server ${PORT} portda ishga tushdi`);
});
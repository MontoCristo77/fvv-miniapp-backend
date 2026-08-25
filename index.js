const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '400mb' }));
app.use(express.static('public'));

app.get('/', (req, res) => {
    res.send('Server ishlayapti!');
});

app.listen(PORT, () => console.log(`✅ Server ${PORT} portda ishga tushdi`));
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { logError } = require('./logger');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/requests', require('./routes/requests'));
app.use('/api/reports', require('./routes/reports'));

app.use(express.static(path.join(__dirname, '..', '..', 'frontend')));

// Глобальный обработчик ошибок (ТЗ 5.3.7)
app.use((err, req, res, next) => {
  logError(err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера. Попробуйте позже.' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Сервер запущен: http://localhost:${port}`));
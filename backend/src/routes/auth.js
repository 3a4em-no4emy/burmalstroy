const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { logError } = require('../logger');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { login, password, role, full_name, email, phone } = req.body;
    if (!login || !password || !full_name) {
      return res.status(400).json({ error: 'Логин, пароль и ФИО обязательны' });
    }
    if (!['student', 'specialist', 'manager'].includes(role)) {
      return res.status(400).json({ error: 'Недопустимая роль' });
    }
    
    const exists = db.prepare('SELECT id FROM users WHERE login = ?').get(login);
    if (exists) return res.status(409).json({ error: 'Логин уже занят' });

    const hash = await bcrypt.hash(password, 10);
    const info = db.prepare(
      'INSERT INTO users (login, password_hash, role, full_name, email, phone) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(login, hash, role, full_name, email || null, phone || null);

    res.status(201).json({ message: 'Пользователь создан', id: info.lastInsertRowid });
  } catch (e) {
    logError(e);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { login, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE login = ?').get(login);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }
        const token = jwt.sign(
      { id: user.id, role: user.role, full_name: user.full_name },
      process.env.JWT_SECRET || 'dev_secret',
      { expiresIn: '1d' }
    );
    res.json({ token, user: { id: user.id, login: user.login, role: user.role, full_name: user.full_name } });
  } catch (e) {
    logError(e);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
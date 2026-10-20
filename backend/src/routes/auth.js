const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { auth } = require('../middleware/auth');

const router = express.Router();

function sign(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, full_name: user.full_name },
    process.env.JWT_SECRET || 'dev_secret',
    { expiresIn: '7d' }
  );
}

router.post('/register', async (req, res) => {
  try {
    const { full_name, email, phone, password, role } = req.body || {};
    if (!full_name || !email || !password) {
      return res.status(400).json({ error: 'Заполните ФИО, email и пароль' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Некорректный email' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Пароль не короче 6 символов' });
    }
    const userRole = ['student', 'employee'].includes(role) ? role : 'student';

    if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
      return res.status(409).json({ error: 'Email уже зарегистрирован' });
    }

    const hash = await bcrypt.hash(password, 10);
    const info = db.prepare(
      `INSERT INTO users (full_name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)`
    ).run(full_name, email, phone || null, hash, userRole);

    const user = db.prepare(
      'SELECT id, full_name, email, phone, role, notifications_enabled FROM users WHERE id = ?'
    ).get(info.lastInsertRowid);

    res.status(201).json({ user, token: sign(user) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Введите email и пароль' });
    }
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) return res.status(401).json({ error: 'Неверный email или пароль' });
    if (!(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }
    const { password_hash, ...safe } = user;
    res.json({ user: safe, token: sign(safe) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.get('/me', auth(), (req, res) => {
  const user = db.prepare(
    'SELECT id, full_name, email, phone, role, notifications_enabled FROM users WHERE id = ?'
  ).get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  res.json({ user });
});

router.patch('/me', auth(), (req, res) => {
  const current = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!current) return res.status(404).json({ error: 'Пользователь не найден' });
  const { full_name, phone, notifications_enabled } = req.body || {};
  db.prepare('UPDATE users SET full_name = ?, phone = ?, notifications_enabled = ? WHERE id = ?').run(
    full_name ?? current.full_name,
    phone ?? current.phone,
    notifications_enabled === undefined ? current.notifications_enabled : (notifications_enabled ? 1 : 0),
    req.user.id
  );
  const user = db.prepare(
    'SELECT id, full_name, email, phone, role, notifications_enabled FROM users WHERE id = ?'
  ).get(req.user.id);
  res.json({ user });
});

module.exports = router;
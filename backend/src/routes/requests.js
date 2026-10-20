const express = require('express');
const db = require('../db');
const { auth, requireRole } = require('../middleware/auth');
const { createNotification, notifyStatusChange } = require('../services/notifications');

const router = express.Router();
const STATUSES = ['new', 'in_progress', 'done', 'rejected'];

function validate(body) {
  const errors = {};
  const { room, subject, description } = body || {};
  if (!room || String(room).trim().length < 1 || String(room).length > 20)
    errors.room = 'Укажите комнату (1–20 символов)';
  if (!subject || String(subject).trim().length < 3 || String(subject).length > 120)
    errors.subject = 'Тема: 3–120 символов';
  if (!description || String(description).trim().length < 5 || String(description).length > 2000)
    errors.description = 'Описание: 5–2000 символов';
  return errors;
}

// Создать заявку
router.post('/', auth(), (req, res) => {
  const errors = validate(req.body);
  if (Object.keys(errors).length) {
    return res.status(400).json({ error: 'Ошибка валидации', fields: errors });
  }
  const { room, subject, description } = req.body;
  const info = db.prepare(
    `INSERT INTO requests (author_id, room, subject, description) VALUES (?, ?, ?, ?)`
  ).run(req.user.id, String(room).trim(), String(subject).trim(), String(description).trim());

  const request = db.prepare('SELECT * FROM requests WHERE id = ?').get(info.lastInsertRowid);
  db.prepare(
    `INSERT INTO request_history (request_id, old_status, new_status, changed_by, comment)
     VALUES (?, NULL, 'new', ?, 'Заявка создана')`
  ).run(request.id, req.user.id);

  // Подтверждение автору
  createNotification({
    userId: req.user.id,
    requestId: request.id,
    title: `Заявка #${request.id} принята`,
    message: `Ваша заявка «${request.subject}» (комната ${request.room}) принята в обработку.`,
  });

  // Уведомление персоналу
  const staff = db.prepare(`SELECT id FROM users WHERE role IN ('specialist','manager')`).all();
  for (const s of staff) {
    createNotification({
      userId: s.id,
      requestId: request.id,
      title: `Новая заявка #${request.id}`,
      message: `${req.user.full_name}: ${request.subject} (комната ${request.room})`,
    });
  }

  res.status(201).json({ request });
});

// Мои заявки
router.get('/my', auth(), (req, res) => {
  const rows = db.prepare(
    `SELECT r.*, u.full_name AS author_name FROM requests r
     JOIN users u ON u.id = r.author_id
     WHERE r.author_id = ? ORDER BY r.created_at DESC`
  ).all(req.user.id);
  res.json({ requests: rows });
});

// Все заявки (специалист / заведующий)
router.get('/', auth(), requireRole('specialist', 'manager'), (req, res) => {
  const { status, from, to, room } = req.query;
  const where = [];
  const params = [];
  if (status && STATUSES.includes(status)) { where.push('r.status = ?'); params.push(status); }
  if (from) { where.push('date(r.created_at) >= date(?)'); params.push(from); }
  if (to)   { where.push('date(r.created_at) <= date(?)'); params.push(to); }
  if (room) { where.push('r.room LIKE ?'); params.push('%' + room + '%'); }

  const sql = `SELECT r.*, u.full_name AS author_name, s.full_name AS specialist_name
    FROM requests r
    JOIN users u ON u.id = r.author_id
    LEFT JOIN users s ON s.id = r.assigned_to
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY r.created_at DESC`;
  res.json({ requests: db.prepare(sql).all(...params) });
});

// Одна заявка с историей
router.get('/:id', auth(), (req, res) => {
  const request = db.prepare(
    `SELECT r.*, u.full_name AS author_name FROM requests r
     JOIN users u ON u.id = r.author_id WHERE r.id = ?`
  ).get(req.params.id);
  if (!request) return res.status(404).json({ error: 'Заявка не найдена' });
  if (['student', 'employee'].includes(req.user.role) && request.author_id !== req.user.id) {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  const history = db.prepare(
    `SELECT h.*, u.full_name AS changed_by_name FROM request_history h
     LEFT JOIN users u ON u.id = h.changed_by
     WHERE h.request_id = ? ORDER BY h.changed_at ASC`
  ).all(request.id);
  res.json({ request, history });
});

// Смена статуса (только специалист)
router.patch('/:id/status', auth(), requireRole('specialist'), (req, res) => {
  const { status, comment } = req.body || {};
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Недопустимый статус' });
  }
  const request = db.prepare('SELECT * FROM requests WHERE id = ?').get(req.params.id);
  if (!request) return res.status(404).json({ error: 'Заявка не найдена' });
  if (request.status === status) {
    return res.status(400).json({ error: 'Статус уже установлен' });
  }

  const oldStatus = request.status;
  db.prepare(
    `UPDATE requests SET status = ?, updated_at = datetime('now'),
     assigned_to = COALESCE(assigned_to, ?) WHERE id = ?`
  ).run(status, req.user.id, request.id);

  db.prepare(
    `INSERT INTO request_history (request_id, old_status, new_status, changed_by, comment)
     VALUES (?, ?, ?, ?, ?)`
  ).run(request.id, oldStatus, status, req.user.id, comment || null);

  const updated = db.prepare('SELECT * FROM requests WHERE id = ?').get(request.id);

  notifyStatusChange({ request: updated, oldStatus, newStatus: status })
    .catch((e) => console.error('notify error:', e));

  res.json({ request: updated });
});

module.exports = router;
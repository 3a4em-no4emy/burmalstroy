const express = require('express');
const db = require('../db');
const { auth, requireRole } = require('../middleware/auth');
const { logError } = require('../logger');

const router = express.Router();

// Подача заявки (ТЗ 5.3.1)
router.post('/', auth(), (req, res) => {
  try {
    const { applicant_name, submission_date, room, description } = req.body;
    
    // Серверная валидация
    if (!applicant_name || !submission_date || !room || !description) {
      return res.status(400).json({ error: 'Все поля обязательны для заполнения' });
    }
    if (isNaN(Date.parse(submission_date))) {
      return res.status(400).json({ error: 'Некорректная дата подачи' });
    }

    const info = db.prepare(
      `INSERT INTO requests (author_id, applicant_name, submission_date, room, description) 
       VALUES (?, ?, ?, ?, ?)`
    ).run(req.user.id, applicant_name, submission_date, room, description);

    db.prepare(`INSERT INTO status_log (request_id, old_status, new_status, changed_by) VALUES (?, NULL, 'new', ?)`)
      .run(info.lastInsertRowid, req.user.id);

    res.status(201).json({ message: 'Заявка создана', id: info.lastInsertRowid });
  } catch (e) {
    logError(e);
    res.status(500).json({ error: 'Ошибка при создании заявки' });
  }
});

// Просмотр заявок (для студента — свои, для специалиста/заведующего — все)
router.get('/', auth(), (req, res) => {
  try {
    let rows;
    if (req.user.role === 'student') {
      rows = db.prepare('SELECT * FROM requests WHERE author_id = ? ORDER BY created_at DESC').all(req.user.id);
    } else {
      rows = db.prepare('SELECT * FROM requests ORDER BY created_at DESC').all();
    }
    res.json({ requests: rows });
  } catch (e) {
    logError(e);
    res.status(500).json({ error: 'Ошибка при получении списка заявок' });
  }
});

// Смена статуса (ТЗ 5.3.2, 5.3.5, 5.3.6)
router.patch('/:id/status', auth(), requireRole('specialist'), (req, res) => {
  try {
    const { status } = req.body;
    if (!['new', 'in_progress', 'done'].includes(status)) {
      return res.status(400).json({ error: 'Недопустимый статус' });
    }

    const request = db.prepare('SELECT * FROM requests WHERE id = ?').get(req.params.id);
    if (!request) return res.status(404).json({ error: 'Заявка не найдена' });
    if (request.status === status) return res.status(400).json({ error: 'Статус уже установлен' });

    // Обновление статуса
    db.prepare(`UPDATE requests SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, req.params.id);
    
    // Запись в журнал
    db.prepare(`INSERT INTO status_log (request_id, old_status, new_status, changed_by) VALUES (?, ?, ?, ?)`)
      .run(req.params.id, request.status, status, req.user.id);

    res.json({ message: 'Статус обновлен' });
  } catch (e) {
    logError(e);
    res.status(500).json({ error: 'Ошибка при смене статуса' });
  }
});

// Получение журнала изменений для заявки (ТЗ 5.3.6)
router.get('/:id/history', auth(), (req, res) => {
  try {
    const history = db.prepare(`
      SELECT l.*, u.full_name AS changed_by_name 
      FROM status_log l 
      LEFT JOIN users u ON u.id = l.changed_by 
      WHERE l.request_id = ? ORDER BY l.changed_at ASC
    `).all(req.params.id);
    res.json({ history });
  } catch (e) {
    logError(e);
    res.status(500).json({ error: 'Ошибка при получении журнала' });
  }
});

module.exports = router;
const express = require('express');
const db = require('../db');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth(), (req, res) => {
  const rows = db.prepare(
    `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`
  ).all(req.user.id);
  const unread = db.prepare(
    `SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0`
  ).get(req.user.id).c;
  res.json({ notifications: rows, unread });
});

router.post('/read-all', auth(), (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true });
});

router.post('/:id/read', auth(), (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.user.id);
  res.json({ ok: true });
});

module.exports = router;
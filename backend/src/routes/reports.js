const express = require('express');
const db = require('../db');
const { auth, requireRole } = require('../middleware/auth');
const { logError } = require('../logger');

const router = express.Router();

// Сводка за период (ТЗ 5.3.4)
router.get('/summary', auth(), requireRole('manager'), (req, res) => {
  try {
    let { from, to } = req.query;
    
    // Если период не передан, берем последнюю неделю
    if (!from || !to) {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 6 * 24 * 3600 * 1000);
      from = weekAgo.toISOString().slice(0, 10);
      to = now.toISOString().slice(0, 10);
    }

    // Сводка по статусам за период
    const stats = db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM requests 
      WHERE date(created_at) BETWEEN date(?) AND date(?)
      GROUP BY status
    `).all(from, to);

    res.json({ period: { from, to }, stats });
  } catch (e) {
    logError(e);
    res.status(500).json({ error: 'Ошибка при формировании сводки' });
  }
});

module.exports = router;
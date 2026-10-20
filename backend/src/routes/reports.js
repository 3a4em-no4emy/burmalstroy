const express = require('express');
const db = require('../db');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Сводка (для заведующего и специалиста)
router.get('/summary', auth(), requireRole('manager', 'specialist'), (req, res) => {
  const { from, to, room, status } = req.query;
  const where = [];
  const params = [];

  let dateFrom = from;
  let dateTo = to;
  if (!dateFrom && !dateTo) {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 6 * 24 * 3600 * 1000);
    dateFrom = weekAgo.toISOString().slice(0, 10);
    dateTo = now.toISOString().slice(0, 10);
  }
  if (dateFrom) { where.push('date(r.created_at) >= date(?)'); params.push(dateFrom); }
  if (dateTo)   { where.push('date(r.created_at) <= date(?)'); params.push(dateTo); }
  if (room)     { where.push('r.room LIKE ?'); params.push('%' + room + '%'); }
  if (status)   { where.push('r.status = ?'); params.push(status); }

  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const byStatus = db.prepare(
    `SELECT r.status, COUNT(*) AS count FROM requests r ${whereSql} GROUP BY r.status`
  ).all(...params);

  const byDay = db.prepare(
    `SELECT date(r.created_at) AS day, COUNT(*) AS count,
       SUM(CASE WHEN r.status = 'done' THEN 1 ELSE 0 END) AS done
     FROM requests r ${whereSql}
     GROUP BY date(r.created_at) ORDER BY day ASC`
  ).all(...params);

  const byRoom = db.prepare(
    `SELECT r.room, COUNT(*) AS count FROM requests r ${whereSql}
     GROUP BY r.room ORDER BY count DESC LIMIT 20`
  ).all(...params);

  const total = db.prepare(`SELECT COUNT(*) AS c FROM requests r ${whereSql}`).get(...params).c;

  const avg = db.prepare(
    `SELECT AVG((julianday(r.updated_at) - julianday(r.created_at)) * 24.0) AS avg_hours
     FROM requests r ${whereSql ? whereSql + ' AND' : 'WHERE'} r.status = 'done'`
  ).get(...params).avg_hours;

  res.json({
    period: { from: dateFrom, to: dateTo },
    total,
    byStatus,
    byDay,
    byRoom,
    avgCompletionHours: avg ? Math.round(avg * 10) / 10 : null,
  });
});

module.exports = router;
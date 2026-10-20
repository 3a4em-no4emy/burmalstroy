const db = require('../db');
const { sendEmail } = require('./email');

const STATUS_LABELS = {
  new: 'Новая',
  in_progress: 'В работе',
  done: 'Выполнена',
  rejected: 'Отклонена',
};

function createNotification({ userId, requestId, title, message }) {
  return db.prepare(
    `INSERT INTO notifications (user_id, request_id, title, message) VALUES (?, ?, ?, ?)`
  ).run(userId, requestId || null, title, message).lastInsertRowid;
}

async function notifyStatusChange({ request, oldStatus, newStatus }) {
  const author = db.prepare('SELECT * FROM users WHERE id = ?').get(request.author_id);
  if (!author) return;

  const title = `Заявка #${request.id}: статус изменён`;
  const message =
    `Статус вашей заявки «${request.subject}» (комната ${request.room}) изменён: ` +
    `${STATUS_LABELS[oldStatus]} → ${STATUS_LABELS[newStatus]}.`;

  createNotification({ userId: author.id, requestId: request.id, title, message });

  if (author.notifications_enabled && author.email) {
    try {
      await sendEmail({
        to: author.email,
        subject: `[БурмалСТРОЙ] ${title}`,
        text: message,
        html: `<p>${message}</p><p>Заявка №${request.id}</p>`,
      });
    } catch (e) {
      console.error('Не удалось отправить email:', e.message);
    }
  }
}

module.exports = { createNotification, notifyStatusChange };
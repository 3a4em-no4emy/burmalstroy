const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter !== null) return transporter;
  if (!process.env.SMTP_HOST) { transporter = false; return false; }
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  return transporter;
}

async function sendEmail({ to, subject, text, html }) {
  const t = getTransporter();
  if (!t) {
    console.log(`[email:dev] to=${to} subject="${subject}"\n${text}\n`);
    return { dev: true };
  }
  return t.sendMail({
    from: process.env.SMTP_FROM || 'noreply@burmalstroy.local',
    to, subject, text, html,
  });
}

module.exports = { sendEmail };
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./db');

(async () => {
  const users = [
    { full_name: 'Иванов Иван', email: 'student@example.com', role: 'student' },
    { full_name: 'Петрова Анна', email: 'employee@example.com', role: 'employee' },
    { full_name: 'Сидоров Пётр', email: 'spec@example.com', role: 'specialist' },
    { full_name: 'Кузнецов Олег', email: 'manager@example.com', role: 'manager' },
  ];
  const hash = await bcrypt.hash('password123', 10);
  for (const u of users) {
    if (db.prepare('SELECT id FROM users WHERE email = ?').get(u.email)) {
      console.log('Уже есть:', u.email);
      continue;
    }
    db.prepare('INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)')
      .run(u.full_name, u.email, hash, u.role);
    console.log('Создан:', u.email);
  }
  console.log('\nГотово. Пароль у всех: password123');
})();
const jwt = require('jsonwebtoken');

function auth() {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Требуется авторизация' });
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
      next();
    } catch {
      return res.status(401).json({ error: 'Недействительный токен' });
    }
  };
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      // ТЗ 5.3.5: Вывод сообщения об отказе
      return res.status(403).json({ error: 'Отказано в доступе: недостаточно прав' });
    }
    next();
  };
}

module.exports = { auth, requireRole };
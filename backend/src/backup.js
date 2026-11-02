const fs = require('fs');
const path = require('path');
require('dotenv').config();

const dbPath = process.env.DB_PATH || './data/burmalstroy.db';
const backupDir = path.join(__dirname, '..', 'backups');

if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(backupDir, `burmalstroy-${timestamp}.db`);

fs.copyFileSync(dbPath, backupPath);
console.log(`✅ Резервная копия создана: ${backupPath}`);
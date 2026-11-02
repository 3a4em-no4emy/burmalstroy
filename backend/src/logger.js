const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, '..', 'error.log');

function logError(err) {
  const time = new Date().toISOString();
  const msg = `[${time}] ${err.stack || err.message || err}\n`;
  fs.appendFileSync(logFile, msg);
  console.error(msg);
}

module.exports = { logError };
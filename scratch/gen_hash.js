const bcrypt = require('bcryptjs');
const pw = 'admin123';
const hash = bcrypt.hashSync(pw, 10);
console.log(`Hash for ${pw}: ${hash}`);

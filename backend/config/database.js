const mysql = require('mysql2/promise');
require('dotenv').config();

// Aiven MySQL wajib SSL — aktif otomatis kalau DB_SSL=true
const sslConfig = process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false;

const pool = mysql.createPool({
  host:             process.env.DB_HOST     || 'jogja-furniture-db-adi-db97.d.aivencloud.com',
  port:             parseInt(process.env.DB_PORT || '19730'),
  user:             process.env.DB_USER     || 'avnadmin',
  password:         process.env.DB_PASSWORD || 'AVNS_lTWcKifVEm7xHG8MZNq',
  database:         process.env.DB_NAME     || 'jogja_furniture',
  ssl:              sslConfig,
  waitForConnections: true,
  connectionLimit:  10,
  queueLimit:       0,
  connectTimeout:   20000,
});

pool.getConnection()
  .then(conn => {
    console.log('✅ MySQL connected →', process.env.DB_NAME, process.env.DB_SSL === 'true' ? '(SSL)' : '');
    conn.release();
  })
  .catch(err => {
    console.error('❌ MySQL connection failed:', err.message);
    // Jangan crash server, biarkan retry
  });

module.exports = pool;

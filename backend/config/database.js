const mysql = require('mysql2/promise');
require('dotenv').config();

// Aiven MySQL wajib SSL — aktif otomatis kalau DB_SSL=true
const sslConfig = process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false;

const pool = mysql.createPool({
  host:             process.env.DB_HOST     || 'localhost',
  port:             parseInt(process.env.DB_PORT || '3306'),
  user:             process.env.DB_USER     || 'root',
  password:         process.env.DB_PASSWORD || '',
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

const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'jogja_furniture',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test the connection
pool.getConnection()
  .then(connection => {
    console.log('✅ MySQL connected successfully to', process.env.DB_NAME);
    connection.release();
  })
  .catch(err => {
    console.error('❌ Defaulting MySQL failed:', err.message);
  });

module.exports = pool;

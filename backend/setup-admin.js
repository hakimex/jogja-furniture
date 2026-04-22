const db = require('./config/database');
const bcrypt = require('bcryptjs');

async function setupAdmin() {
  try {
    // Check if admin user already exists
    const [existing] = await db.query(
      'SELECT * FROM admin_users WHERE username = ? OR email = ?',
      ['admin', 'admin@jogjafurniture.com']
    );
    
    if (existing.length > 0) {
      console.log('Admin user already exists');
      return;
    }
    
    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    await db.query(`
      INSERT INTO admin_users (username, email, password, full_name, role, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [
      'admin',
      'admin@jogjafurniture.com', 
      hashedPassword,
      'Administrator',
      'superadmin',
      1
    ]);
    
    console.log('Admin user created successfully!');
    console.log('Username: admin');
    console.log('Password: admin123');
    console.log('Role: superadmin');
    
  } catch (error) {
    console.error('Error setting up admin:', error.message);
  } finally {
    process.exit(0);
  }
}

setupAdmin();

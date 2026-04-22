const db      = require('../config/database');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');

// LOGIN
exports.login = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username dan password wajib diisi' });
  }

  try {
    const [rows] = await db.query(
      'SELECT * FROM admin_users WHERE username=? OR email=?',
      [username, username]
    );

    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'Username atau password salah' });
    }

    const admin = rows[0];
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Username atau password salah' });
    }

    // Update last login
    await db.query('UPDATE admin_users SET last_login=NOW() WHERE id=?', [admin.id]);

    const token = jwt.sign(
      { id: admin.id, username: admin.username, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      success: true,
      message: 'Login berhasil',
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        full_name: admin.full_name,
        role: admin.role,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET PROFILE (admin)
exports.getProfile = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, username, email, full_name, role, last_login, created_at FROM admin_users WHERE id=?',
      [req.admin.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Admin tidak ditemukan' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// CHANGE PASSWORD
exports.changePassword = async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ success: false, message: 'Password lama dan baru wajib diisi' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ success: false, message: 'Password baru minimal 6 karakter' });
  }

  try {
    const [rows] = await db.query('SELECT password FROM admin_users WHERE id=?', [req.admin.id]);
    const isMatch = await bcrypt.compare(current_password, rows[0].password);
    if (!isMatch) return res.status(400).json({ success: false, message: 'Password lama salah' });

    const hashed = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE admin_users SET password=? WHERE id=?', [hashed, req.admin.id]);
    res.json({ success: true, message: 'Password berhasil diubah' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DASHBOARD STATS
exports.getDashboard = async (req, res) => {
  try {
    const [[{ total_products }]] = await db.query('SELECT COUNT(*) as total_products FROM products WHERE is_active=1');
    const [[{ total_categories }]] = await db.query('SELECT COUNT(*) as total_categories FROM categories WHERE is_active=1');
    const [[{ total_services }]] = await db.query('SELECT COUNT(*) as total_services FROM services WHERE is_active=1');
    const [[{ total_testimonials }]] = await db.query('SELECT COUNT(*) as total_testimonials FROM testimonials');
    const [[{ unread_contacts }]] = await db.query('SELECT COUNT(*) as unread_contacts FROM contacts WHERE is_read=0');
    const [[{ total_contacts }]] = await db.query('SELECT COUNT(*) as total_contacts FROM contacts');
    const [[{ featured_products }]] = await db.query('SELECT COUNT(*) as featured_products FROM products WHERE is_featured=1 AND is_active=1');

    // Recent contacts
    const [recent_contacts] = await db.query(
      'SELECT id, name, subject, created_at, is_read FROM contacts ORDER BY created_at DESC LIMIT 5'
    );

    // Top viewed products
    const [top_products] = await db.query(
      'SELECT id, name, slug, view_count FROM products WHERE is_active=1 ORDER BY view_count DESC LIMIT 5'
    );

    res.json({
      success: true,
      data: {
        stats: { total_products, total_categories, total_services, total_testimonials,
                 unread_contacts, total_contacts, featured_products },
        recent_contacts,
        top_products,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

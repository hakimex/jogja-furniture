/**
 * usersController.js — User Management (Superadmin only)
 */
const db     = require('../config/database');
const bcrypt = require('bcryptjs');
const { log } = require('../middleware/activityLogger');

const VALID_ROLES = ['superadmin', 'admin_gudang', 'admin_website', 'marketing'];

const getIp = (req) => req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;

// GET all users
exports.getAll = async (req, res) => {
  try {
    const { search = '', role = '', page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    let where = '1=1';

    if (search) { where += ' AND (username LIKE ? OR full_name LIKE ? OR email LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    if (role)   { where += ' AND role = ?'; params.push(role); }

    const [[{ total }]] = await db.query(`SELECT COUNT(*) as total FROM admin_users WHERE ${where}`, params);
    const [rows] = await db.query(
      `SELECT id, username, email, full_name, phone, role, is_active, last_login, created_at
       FROM admin_users WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    res.json({ success: true, data: rows, pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// GET single user
exports.getOne = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, username, email, full_name, phone, role, is_active, last_login, created_at FROM admin_users WHERE id=?',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
    res.json({ success: true, data: rows[0] });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// CREATE user
exports.create = async (req, res) => {
  const { username, email, password, full_name, phone, role } = req.body;
  if (!username || !email || !password) return res.status(400).json({ success: false, message: 'Username, email, dan password wajib diisi' });
  if (!VALID_ROLES.includes(role)) return res.status(400).json({ success: false, message: 'Role tidak valid' });
  if (password.length < 6) return res.status(400).json({ success: false, message: 'Password minimal 6 karakter' });

  try {
    const hashed = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO admin_users (username, email, password, full_name, phone, role, is_active, created_by) VALUES (?,?,?,?,?,?,1,?)',
      [username, email, hashed, full_name || null, phone || null, role, req.admin.id]
    );
    log({ userId: req.admin.id, username: req.admin.username, role: req.admin.role, action: 'CREATE_USER', module: 'Users', description: `Membuat user: ${username} (${role})`, recordId: result.insertId, recordType: 'user', ipAddress: getIp(req) });
    res.status(201).json({ success: true, message: 'User berhasil dibuat', id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ success: false, message: 'Username atau email sudah digunakan' });
    res.status(500).json({ success: false, message: err.message });
  }
};

// UPDATE user
exports.update = async (req, res) => {
  const { id } = req.params;
  const { email, full_name, phone, role, is_active } = req.body;
  if (role && !VALID_ROLES.includes(role)) return res.status(400).json({ success: false, message: 'Role tidak valid' });

  // Cegah superadmin menonaktifkan dirinya sendiri
  if (parseInt(id) === req.admin.id && is_active === 0) {
    return res.status(400).json({ success: false, message: 'Anda tidak dapat menonaktifkan akun sendiri' });
  }

  try {
    const fields = [], params = [];
    if (email !== undefined)     { fields.push('email=?');     params.push(email); }
    if (full_name !== undefined) { fields.push('full_name=?'); params.push(full_name); }
    if (phone !== undefined)     { fields.push('phone=?');     params.push(phone || null); }
    if (role !== undefined)      { fields.push('role=?');      params.push(role); }
    if (is_active !== undefined) { fields.push('is_active=?'); params.push(is_active ? 1 : 0); }
    if (!fields.length) return res.status(400).json({ success: false, message: 'Tidak ada data yang diubah' });

    params.push(id);
    const [result] = await db.query(`UPDATE admin_users SET ${fields.join(',')} WHERE id=?`, params);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });

    log({ userId: req.admin.id, username: req.admin.username, role: req.admin.role, action: 'UPDATE_USER', module: 'Users', description: `Update user ID ${id}`, recordId: parseInt(id), recordType: 'user', ipAddress: getIp(req) });
    res.json({ success: true, message: 'User berhasil diupdate' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ success: false, message: 'Email sudah digunakan user lain' });
    res.status(500).json({ success: false, message: err.message });
  }
};

// RESET PASSWORD
exports.resetPassword = async (req, res) => {
  const { id } = req.params;
  const { new_password } = req.body;
  if (!new_password || new_password.length < 6) return res.status(400).json({ success: false, message: 'Password baru minimal 6 karakter' });

  try {
    const hashed = await bcrypt.hash(new_password, 10);
    const [result] = await db.query('UPDATE admin_users SET password=? WHERE id=?', [hashed, id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });

    // Invalidate sessions
    await db.query('UPDATE login_sessions SET is_active=0 WHERE user_id=?', [id]);

    log({ userId: req.admin.id, username: req.admin.username, role: req.admin.role, action: 'RESET_PASSWORD', module: 'Users', description: `Reset password user ID ${id}`, recordId: parseInt(id), recordType: 'user', ipAddress: getIp(req) });
    res.json({ success: true, message: 'Password berhasil direset. User akan diminta login ulang.' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// TOGGLE ACTIVE
exports.toggleActive = async (req, res) => {
  const { id } = req.params;
  if (parseInt(id) === req.admin.id) return res.status(400).json({ success: false, message: 'Tidak dapat menonaktifkan akun sendiri' });

  try {
    const [[user]] = await db.query('SELECT id, username, is_active FROM admin_users WHERE id=?', [id]);
    if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });

    const newStatus = user.is_active ? 0 : 1;
    await db.query('UPDATE admin_users SET is_active=? WHERE id=?', [newStatus, id]);
    if (newStatus === 0) await db.query('UPDATE login_sessions SET is_active=0 WHERE user_id=?', [id]);

    log({ userId: req.admin.id, username: req.admin.username, role: req.admin.role, action: newStatus ? 'ACTIVATE_USER' : 'DEACTIVATE_USER', module: 'Users', description: `${newStatus ? 'Aktifkan' : 'Nonaktifkan'} user: ${user.username}`, recordId: parseInt(id), recordType: 'user', ipAddress: getIp(req) });
    res.json({ success: true, message: `User berhasil ${newStatus ? 'diaktifkan' : 'dinonaktifkan'}`, is_active: newStatus });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// DELETE user
exports.remove = async (req, res) => {
  const { id } = req.params;
  if (parseInt(id) === req.admin.id) return res.status(400).json({ success: false, message: 'Tidak dapat menghapus akun sendiri' });

  try {
    const [[user]] = await db.query('SELECT username FROM admin_users WHERE id=?', [id]);
    if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });

    await db.query('DELETE FROM admin_users WHERE id=?', [id]);
    log({ userId: req.admin.id, username: req.admin.username, role: req.admin.role, action: 'DELETE_USER', module: 'Users', description: `Hapus user: ${user.username}`, ipAddress: getIp(req) });
    res.json({ success: true, message: 'User berhasil dihapus' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// FORCE LOGOUT user (invalidate all sessions)
exports.forceLogout = async (req, res) => {
  try {
    await db.query('UPDATE login_sessions SET is_active=0 WHERE user_id=?', [req.params.id]);
    log({ userId: req.admin.id, username: req.admin.username, role: req.admin.role, action: 'FORCE_LOGOUT', module: 'Sessions', description: `Force logout user ID ${req.params.id}`, ipAddress: getIp(req) });
    res.json({ success: true, message: 'Semua sesi user berhasil diterminasi' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// GET activity logs
exports.getActivityLogs = async (req, res) => {
  try {
    const { user_id = '', module = '', action = '', page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    let where = '1=1';

    if (user_id) { where += ' AND user_id=?'; params.push(user_id); }
    if (module)  { where += ' AND module=?';  params.push(module); }
    if (action)  { where += ' AND action=?';  params.push(action); }

    const [[{ total }]] = await db.query(`SELECT COUNT(*) as total FROM activity_logs WHERE ${where}`, params);
    const [rows] = await db.query(
      `SELECT * FROM activity_logs WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    res.json({ success: true, data: rows, pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// GET login sessions
exports.getSessions = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT ls.*, u.username, u.full_name, u.role
       FROM login_sessions ls LEFT JOIN admin_users u ON u.id = ls.user_id
       WHERE ls.is_active=1 ORDER BY ls.created_at DESC LIMIT 100`
    );
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// GET dashboard stats for superadmin
exports.getControlCenterStats = async (req, res) => {
  try {
    const [[{ total_users }]]      = await db.query('SELECT COUNT(*) as total_users FROM admin_users WHERE is_active=1');
    const [[{ active_sessions }]]  = await db.query('SELECT COUNT(*) as active_sessions FROM login_sessions WHERE is_active=1 AND expires_at > NOW()');
    const [[{ total_orders }]]     = await db.query('SELECT COUNT(*) as total_orders FROM orders');
    const [[{ pending_orders }]]   = await db.query("SELECT COUNT(*) as pending_orders FROM orders WHERE status='pending'");
    const [[{ total_customers }]]  = await db.query('SELECT COUNT(*) as total_customers FROM customers');
    const [[{ total_suppliers }]]  = await db.query('SELECT COUNT(*) as total_suppliers FROM suppliers');
    const [[{ new_products }]]     = await db.query("SELECT COUNT(*) as new_products FROM products WHERE publish_status IN ('new','draft','review')");
    const [[{ revenue_month }]]    = await db.query("SELECT COALESCE(SUM(total),0) as revenue_month FROM orders WHERE payment_status='paid' AND MONTH(created_at)=MONTH(NOW())");

    const [recent_logs]   = await db.query('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 10');
    const [users_by_role] = await db.query('SELECT role, COUNT(*) as count FROM admin_users WHERE is_active=1 GROUP BY role');

    // Revenue per day for last 30 days
    const [revenue_30days] = await db.query(`
      SELECT DATE_FORMAT(d.date, '%d/%m') as date,
             COALESCE(SUM(o.total), 0) as revenue
      FROM (
        SELECT DATE_SUB(CURDATE(), INTERVAL n DAY) as date
        FROM (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION
              SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION
              SELECT 10 UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14 UNION
              SELECT 15 UNION SELECT 16 UNION SELECT 17 UNION SELECT 18 UNION SELECT 19 UNION
              SELECT 20 UNION SELECT 21 UNION SELECT 22 UNION SELECT 23 UNION SELECT 24 UNION
              SELECT 25 UNION SELECT 26 UNION SELECT 27 UNION SELECT 28 UNION SELECT 29) nums
      ) d
      LEFT JOIN orders o ON DATE(o.created_at) = d.date AND o.payment_status = 'paid'
      GROUP BY d.date ORDER BY d.date ASC
    `);

    res.json({
      success: true,
      data: {
        stats: { total_users, active_sessions, total_orders, pending_orders, total_customers, total_suppliers, new_products, revenue_month },
        recent_logs,
        users_by_role,
        revenue_30days,
      }
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

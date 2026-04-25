/**
 * usersController.js — User Management (Superadmin only)
 * Fixed: safe error messages, pagination caps, input validation
 */

'use strict';

const db     = require('../config/database');
const bcrypt = require('bcryptjs');
const { log } = require('../middleware/activityLogger');

const VALID_ROLES = ['superadmin', 'admin_gudang', 'admin_website', 'marketing'];
const getIp = (req) => req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;

const safePaginate = (page, limit, maxLimit = 100) => {
  const p = Math.max(1, parseInt(page) || 1);
  const l = Math.min(Math.max(1, parseInt(limit) || 20), maxLimit);
  return { page: p, limit: l, offset: (p - 1) * l };
};

// ── GET all users ──────────────────────────────────────────────
exports.getAll = async (req, res) => {
  try {
    const { search = '', role = '' } = req.query;
    const { page, limit, offset } = safePaginate(req.query.page, req.query.limit);
    const params = [];
    let where = '1=1';

    if (search) { where += ' AND (username LIKE ? OR full_name LIKE ? OR email LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    if (role && VALID_ROLES.includes(role)) { where += ' AND role = ?'; params.push(role); }

    const [[{ total }]] = await db.query(`SELECT COUNT(*) as total FROM admin_users WHERE ${where}`, params);
    const [rows] = await db.query(
      `SELECT id, username, email, full_name, phone, role, is_active, last_login, created_at
       FROM admin_users WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    res.json({ success: true, data: rows, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error('[users.getAll]', err);
    res.status(500).json({ success: false, message: 'Gagal memuat data user.' });
  }
};

// ── GET single user ────────────────────────────────────────────
exports.getOne = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, username, email, full_name, phone, role, is_active, last_login, created_at FROM admin_users WHERE id = ?',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('[users.getOne]', err);
    res.status(500).json({ success: false, message: 'Gagal memuat data user.' });
  }
};

// ── CREATE user ────────────────────────────────────────────────
exports.create = async (req, res) => {
  const { username, email, password, full_name, phone, role } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ success: false, message: 'Username, email, dan password wajib diisi' });
  }
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ success: false, message: 'Role tidak valid. Pilihan: ' + VALID_ROLES.join(', ') });
  }
  if (password.length < 8) {
    return res.status(400).json({ success: false, message: 'Password minimal 8 karakter' });
  }
  if (password.length > 200) {
    return res.status(400).json({ success: false, message: 'Password terlalu panjang' });
  }
  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, message: 'Format email tidak valid' });
  }

  try {
    const hashed = await bcrypt.hash(password, 12);
    const [result] = await db.query(
      'INSERT INTO admin_users (username, email, password, full_name, phone, role, is_active, created_by) VALUES (?,?,?,?,?,?,1,?)',
      [username.trim(), email.trim().toLowerCase(), hashed, full_name || null, phone || null, role, req.admin.id]
    );
    log({
      userId: req.admin.id, username: req.admin.username, role: req.admin.role,
      action: 'CREATE_USER', module: 'Users',
      description: `Membuat user: ${username} (${role})`,
      recordId: result.insertId, recordType: 'user', ipAddress: getIp(req),
    });
    res.status(201).json({ success: true, message: 'User berhasil dibuat', id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'Username atau email sudah digunakan' });
    }
    console.error('[users.create]', err);
    res.status(500).json({ success: false, message: 'Gagal membuat user.' });
  }
};

// ── UPDATE user ────────────────────────────────────────────────
exports.update = async (req, res) => {
  const { id } = req.params;
  const { email, full_name, phone, role, is_active } = req.body;

  if (role && !VALID_ROLES.includes(role)) {
    return res.status(400).json({ success: false, message: 'Role tidak valid' });
  }
  if (parseInt(id) === req.admin.id && is_active === 0) {
    return res.status(400).json({ success: false, message: 'Anda tidak dapat menonaktifkan akun sendiri' });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, message: 'Format email tidak valid' });
  }

  try {
    const fields = [], params = [];
    if (email !== undefined)     { fields.push('email=?');     params.push(email.trim().toLowerCase()); }
    if (full_name !== undefined) { fields.push('full_name=?'); params.push(full_name); }
    if (phone !== undefined)     { fields.push('phone=?');     params.push(phone || null); }
    if (role !== undefined)      { fields.push('role=?');      params.push(role); }
    if (is_active !== undefined) { fields.push('is_active=?'); params.push(is_active ? 1 : 0); }

    if (!fields.length) return res.status(400).json({ success: false, message: 'Tidak ada data yang diubah' });

    params.push(id);
    const [result] = await db.query(`UPDATE admin_users SET ${fields.join(',')} WHERE id = ?`, params);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });

    log({
      userId: req.admin.id, username: req.admin.username, role: req.admin.role,
      action: 'UPDATE_USER', module: 'Users',
      description: `Update user ID ${id}`,
      recordId: parseInt(id), recordType: 'user', ipAddress: getIp(req),
    });
    res.json({ success: true, message: 'User berhasil diupdate' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'Email sudah digunakan user lain' });
    }
    console.error('[users.update]', err);
    res.status(500).json({ success: false, message: 'Gagal mengupdate user.' });
  }
};

// ── RESET PASSWORD ─────────────────────────────────────────────
exports.resetPassword = async (req, res) => {
  const { id } = req.params;
  const { new_password } = req.body;

  if (!new_password || new_password.length < 8) {
    return res.status(400).json({ success: false, message: 'Password baru minimal 8 karakter' });
  }
  if (new_password.length > 200) {
    return res.status(400).json({ success: false, message: 'Password terlalu panjang' });
  }

  try {
    const hashed = await bcrypt.hash(new_password, 12);
    const [result] = await db.query('UPDATE admin_users SET password = ? WHERE id = ?', [hashed, id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });

    // Invalidate all sessions
    await db.query('UPDATE login_sessions SET is_active = 0 WHERE user_id = ?', [id]);

    log({
      userId: req.admin.id, username: req.admin.username, role: req.admin.role,
      action: 'RESET_PASSWORD', module: 'Users',
      description: `Reset password user ID ${id}`,
      recordId: parseInt(id), recordType: 'user', ipAddress: getIp(req),
    });
    res.json({ success: true, message: 'Password berhasil direset. User akan diminta login ulang.' });
  } catch (err) {
    console.error('[users.resetPassword]', err);
    res.status(500).json({ success: false, message: 'Gagal reset password.' });
  }
};

// ── TOGGLE ACTIVE ──────────────────────────────────────────────
exports.toggleActive = async (req, res) => {
  const { id } = req.params;
  if (parseInt(id) === req.admin.id) {
    return res.status(400).json({ success: false, message: 'Tidak dapat menonaktifkan akun sendiri' });
  }

  try {
    const [[user]] = await db.query('SELECT id, username, is_active FROM admin_users WHERE id = ?', [id]);
    if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });

    const newStatus = user.is_active ? 0 : 1;
    await db.query('UPDATE admin_users SET is_active = ? WHERE id = ?', [newStatus, id]);
    if (newStatus === 0) {
      await db.query('UPDATE login_sessions SET is_active = 0 WHERE user_id = ?', [id]);
    }

    log({
      userId: req.admin.id, username: req.admin.username, role: req.admin.role,
      action: newStatus ? 'ACTIVATE_USER' : 'DEACTIVATE_USER', module: 'Users',
      description: `${newStatus ? 'Aktifkan' : 'Nonaktifkan'} user: ${user.username}`,
      recordId: parseInt(id), recordType: 'user', ipAddress: getIp(req),
    });
    res.json({ success: true, message: `User berhasil ${newStatus ? 'diaktifkan' : 'dinonaktifkan'}`, is_active: newStatus });
  } catch (err) {
    console.error('[users.toggleActive]', err);
    res.status(500).json({ success: false, message: 'Gagal mengubah status user.' });
  }
};

// ── DELETE user ────────────────────────────────────────────────
exports.remove = async (req, res) => {
  const { id } = req.params;
  if (parseInt(id) === req.admin.id) {
    return res.status(400).json({ success: false, message: 'Tidak dapat menghapus akun sendiri' });
  }

  try {
    const [[user]] = await db.query('SELECT username FROM admin_users WHERE id = ?', [id]);
    if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });

    await db.query('DELETE FROM admin_users WHERE id = ?', [id]);
    log({
      userId: req.admin.id, username: req.admin.username, role: req.admin.role,
      action: 'DELETE_USER', module: 'Users',
      description: `Hapus user: ${user.username}`, ipAddress: getIp(req),
    });
    res.json({ success: true, message: 'User berhasil dihapus' });
  } catch (err) {
    console.error('[users.remove]', err);
    res.status(500).json({ success: false, message: 'Gagal menghapus user.' });
  }
};

// ── FORCE LOGOUT ───────────────────────────────────────────────
exports.forceLogout = async (req, res) => {
  try {
    await db.query('UPDATE login_sessions SET is_active = 0 WHERE user_id = ?', [req.params.id]);
    log({
      userId: req.admin.id, username: req.admin.username, role: req.admin.role,
      action: 'FORCE_LOGOUT', module: 'Sessions',
      description: `Force logout user ID ${req.params.id}`, ipAddress: getIp(req),
    });
    res.json({ success: true, message: 'Semua sesi user berhasil diterminasi' });
  } catch (err) {
    console.error('[users.forceLogout]', err);
    res.status(500).json({ success: false, message: 'Gagal force logout.' });
  }
};

// ── ACTIVITY LOGS ──────────────────────────────────────────────
exports.getActivityLogs = async (req, res) => {
  try {
    const { user_id = '', module = '', action = '' } = req.query;
    const { page, limit, offset } = safePaginate(req.query.page, req.query.limit, 200);
    const params = [];
    let where = '1=1';

    if (user_id) { where += ' AND user_id = ?';  params.push(user_id); }
    if (module)  { where += ' AND module = ?';   params.push(module); }
    if (action)  { where += ' AND action = ?';   params.push(action); }

    const [[{ total }]] = await db.query(`SELECT COUNT(*) as total FROM activity_logs WHERE ${where}`, params);
    const [rows] = await db.query(
      `SELECT * FROM activity_logs WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    res.json({ success: true, data: rows, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error('[users.getActivityLogs]', err);
    res.status(500).json({ success: false, message: 'Gagal memuat activity logs.' });
  }
};

// ── SESSIONS ───────────────────────────────────────────────────
exports.getSessions = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT ls.id, ls.ip_address, ls.user_agent, ls.is_active, ls.expires_at, ls.created_at,
              u.username, u.full_name, u.role
       FROM login_sessions ls
       LEFT JOIN admin_users u ON u.id = ls.user_id
       WHERE ls.is_active = 1 ORDER BY ls.created_at DESC LIMIT 100`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[users.getSessions]', err);
    res.status(500).json({ success: false, message: 'Gagal memuat sesi.' });
  }
};

// ── CONTROL CENTER STATS ───────────────────────────────────────
exports.getControlCenterStats = async (req, res) => {
  try {
    const [[{ total_users }]]     = await db.query('SELECT COUNT(*) as total_users FROM admin_users WHERE is_active = 1');
    const [[{ active_sessions }]] = await db.query('SELECT COUNT(*) as active_sessions FROM login_sessions WHERE is_active = 1 AND expires_at > NOW()');
    const [[{ total_orders }]]    = await db.query('SELECT COUNT(*) as total_orders FROM orders');
    const [[{ pending_orders }]]  = await db.query("SELECT COUNT(*) as pending_orders FROM orders WHERE status = 'pending'");
    const [[{ total_customers }]] = await db.query('SELECT COUNT(*) as total_customers FROM customers');
    const [[{ total_suppliers }]] = await db.query('SELECT COUNT(*) as total_suppliers FROM suppliers');
    const [[{ total_products }]]  = await db.query('SELECT COUNT(*) as total_products FROM products');
    const [[{ new_products }]]    = await db.query("SELECT COUNT(*) as new_products FROM products WHERE publish_status IN ('new','draft','review')");
    const [[{ today_orders }]]    = await db.query("SELECT COUNT(*) as today_orders FROM orders WHERE DATE(created_at) = CURDATE()");
    const [[{ month_confirmed }]] = await db.query("SELECT COUNT(*) as month_confirmed FROM orders WHERE status = 'confirmed' AND MONTH(created_at) = MONTH(NOW()) AND YEAR(created_at) = YEAR(NOW())");
    const [[{ low_stock }]]       = await db.query('SELECT COUNT(*) as low_stock FROM products WHERE warehouse_stock <= 3');
    const [[{ out_of_stock }]]    = await db.query('SELECT COUNT(*) as out_of_stock FROM products WHERE warehouse_stock = 0');
    const [[{ unread_contacts }]] = await db.query('SELECT COUNT(*) as unread_contacts FROM contacts WHERE is_read = 0');
    const [[{ inventory_val }]]   = await db.query('SELECT COALESCE(SUM(warehouse_stock * cost_price), 0) as inventory_val FROM products');

    const [recent_logs]   = await db.query('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 10');
    const [users_by_role] = await db.query('SELECT role, COUNT(*) as count FROM admin_users WHERE is_active = 1 GROUP BY role');
    const [orders_30days] = await db.query(`
      SELECT DATE_FORMAT(d.date, '%d/%m') as date, COUNT(o.id) as count
      FROM (
        SELECT DATE_SUB(CURDATE(), INTERVAL n DAY) as date
        FROM (
          SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION
          SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION
          SELECT 10 UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14 UNION
          SELECT 15 UNION SELECT 16 UNION SELECT 17 UNION SELECT 18 UNION SELECT 19 UNION
          SELECT 20 UNION SELECT 21 UNION SELECT 22 UNION SELECT 23 UNION SELECT 24 UNION
          SELECT 25 UNION SELECT 26 UNION SELECT 27 UNION SELECT 28 UNION SELECT 29
        ) nums
      ) d
      LEFT JOIN orders o ON DATE(o.created_at) = d.date
      GROUP BY d.date ORDER BY d.date ASC
    `);

    res.json({
      success: true,
      data: {
        stats: {
          total_users, active_sessions, total_orders, pending_orders,
          total_customers, total_suppliers, new_products, total_products,
          today_orders, month_confirmed, low_stock, out_of_stock, unread_contacts, inventory_value: inventory_val || 0,
        },
        recent_logs,
        users_by_role,
        orders_30days,
      },
    });
  } catch (err) {
    console.error('[users.getControlCenterStats]', err);
    res.status(500).json({ success: false, message: 'Gagal memuat statistik.' });
  }
};

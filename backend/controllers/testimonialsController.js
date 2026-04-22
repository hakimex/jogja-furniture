const db = require('../config/database');

// ── TESTIMONIALS ──────────────────────────────────────────────

exports.getAll = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM testimonials WHERE is_active=1 ORDER BY sort_order ASC, id ASC'
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAllAdmin = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM testimonials ORDER BY sort_order ASC, id ASC');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.create = async (req, res) => {
  const { name, role, initial, rating, content, product_ref, sort_order } = req.body;
  if (!name || !content) return res.status(400).json({ success: false, message: 'Nama dan konten wajib diisi' });

  try {
    const [result] = await db.query(
      'INSERT INTO testimonials (name, role, initial, rating, content, product_ref, sort_order) VALUES (?,?,?,?,?,?,?)',
      [name, role, initial || name[0].toUpperCase(), rating || 5, content, product_ref, sort_order || 0]
    );
    res.status(201).json({ success: true, message: 'Testimoni berhasil dibuat', id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.update = async (req, res) => {
  const { name, role, initial, rating, content, product_ref, sort_order, is_active } = req.body;
  try {
    const [result] = await db.query(
      `UPDATE testimonials SET name=?, role=?, initial=?, rating=?, content=?, 
       product_ref=?, sort_order=?, is_active=? WHERE id=?`,

    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Testimoni tidak ditemukan' });
    res.json({ success: true, message: 'Testimoni berhasil diupdate' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM testimonials WHERE id=?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Testimoni tidak ditemukan' });
    res.json({ success: true, message: 'Testimoni berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── CONTACTS ─────────────────────────────────────────────────

exports.submitContact = async (req, res) => {
  const { name, email, phone, subject, message, product_ref } = req.body;
  if (!name || !message) {
    return res.status(400).json({ success: false, message: 'Nama dan pesan wajib diisi' });
  }

  try {
    await db.query(
      'INSERT INTO contacts (name, email, phone, subject, message, product_ref) VALUES (?,?,?,?,?,?)',
      [name, email, phone, subject, message, product_ref]
    );
    res.status(201).json({ success: true, message: 'Pesan berhasil dikirim! Kami akan segera menghubungi Anda.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAllContacts = async (req, res) => {
  try {
    const { page = 1, limit = 20, is_read = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = '1=1';
    const params = [];
    if (is_read !== '') { where += ' AND is_read=?'; params.push(is_read); }

    const [countRows] = await db.query(`SELECT COUNT(*) as total FROM contacts WHERE ${where}`, params);
    const [rows] = await db.query(
      `SELECT * FROM contacts WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      success: true, data: rows,
      pagination: { total: countRows[0].total, page: parseInt(page), limit: parseInt(limit) }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.markRead = async (req, res) => {
  try {
    await db.query('UPDATE contacts SET is_read=1 WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Pesan ditandai sudah dibaca' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteContact = async (req, res) => {
  try {
    await db.query('DELETE FROM contacts WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Pesan berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

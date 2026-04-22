const db   = require('../config/database');
const path = require('path');
const fs   = require('fs');
const slugify = require('slugify');

function makeSlug(name) {
  return slugify(name, { lower: true, strict: true, locale: 'id' });
}

// GET all (public)
exports.getAll = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM services WHERE is_active=1 ORDER BY sort_order ASC, id ASC'
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET one by slug (public)
exports.getOne = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM services WHERE slug=? AND is_active=1', [req.params.slug]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Layanan tidak ditemukan' });

    const service = rows[0];
    const [gallery] = await db.query(
      'SELECT * FROM service_gallery WHERE service_id=? ORDER BY sort_order ASC',
      [service.id]
    );
    res.json({ success: true, data: { ...service, gallery } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── ADMIN ────────────────────────────────────────────────────

exports.getAllAdmin = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM services ORDER BY sort_order ASC, id ASC');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.create = async (req, res) => {
  const { name, icon, short_desc, description, info, color_from, color_to, sort_order } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'Nama layanan wajib diisi' });

  try {
    let slug = makeSlug(name);
    const [existing] = await db.query('SELECT id FROM services WHERE slug LIKE ?', [`${slug}%`]);
    if (existing.length > 0) slug = `${slug}-${Date.now()}`;

    const image = req.file ? req.file.filename : null;

    const [result] = await db.query(
      `INSERT INTO services (name, slug, icon, short_desc, description, info, image, color_from, color_to, sort_order)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [name, slug, icon || '🛠', short_desc, description, info, image,
       color_from || '#5C2E0E', color_to || '#C49A6C', sort_order || 0]
    );
    res.status(201).json({ success: true, message: 'Layanan berhasil dibuat', id: result.insertId, slug });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.update = async (req, res) => {
  const { name, slug, icon, short_desc, description, info, color_from, color_to, sort_order, is_active } = req.body;
  const image = req.file ? req.file.filename : undefined;

  try {
    let query = `UPDATE services SET name=?, slug=?, icon=?, short_desc=?, description=?, info=?,
      color_from=?, color_to=?, sort_order=?, is_active=?`;
    const params = [name, slug, icon, short_desc, description, info, color_from, color_to,
      parseInt(sort_order) || 0, (is_active == 1 || is_active === 'true' || is_active === '1') ? 1 : 0];

    if (image) { query += ', image=?'; params.push(image); }
    query += ' WHERE id=?';
    params.push(req.params.id);

    const [result] = await db.query(query, params);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Layanan tidak ditemukan' });
    res.json({ success: true, message: 'Layanan berhasil diupdate' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM services WHERE id=?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Layanan tidak ditemukan' });
    res.json({ success: true, message: 'Layanan berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

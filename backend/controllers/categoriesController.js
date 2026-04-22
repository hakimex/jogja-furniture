const db = require('../config/database');

// GET semua kategori (public)
exports.getAll = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT c.*, COUNT(p.id) as product_count
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id AND p.is_active = 1
       WHERE c.is_active = 1
       GROUP BY c.id
       ORDER BY c.sort_order ASC, c.name ASC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET satu kategori by slug (public)
exports.getOne = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM categories WHERE slug = ? AND is_active = 1',
      [req.params.slug]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Kategori tidak ditemukan' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── ADMIN ─────────────────────────────────────────────────────

// GET all (admin, including inactive)
exports.getAllAdmin = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT c.*, COUNT(p.id) as product_count
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id
       GROUP BY c.id
       ORDER BY c.sort_order ASC, c.id ASC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// CREATE
exports.create = async (req, res) => {
  const { name, slug, icon, color_from, color_to, description, sort_order } = req.body;
  if (!name || !slug) return res.status(400).json({ success: false, message: 'Nama dan slug wajib diisi' });
  try {
    const [result] = await db.query(
      'INSERT INTO categories (name, slug, icon, color_from, color_to, description, sort_order) VALUES (?,?,?,?,?,?,?)',
      [name, slug, icon || '📦', color_from || '#5C2E0E', color_to || '#C49A6C', description, sort_order || 0]
    );
    res.status(201).json({ success: true, message: 'Kategori berhasil dibuat', id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'Slug sudah digunakan' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// UPDATE
exports.update = async (req, res) => {
  const { name, slug, icon, color_from, color_to, description, sort_order, is_active } = req.body;
  const image = req.file ? req.file.filename : undefined;

  try {
    let query = `UPDATE categories SET name=?, slug=?, icon=?, color_from=?, color_to=?, description=?, sort_order=?, is_active=?`;
    const params = [name, slug, icon, color_from, color_to, description, sort_order || 0, is_active !== undefined ? is_active : 1];

    if (image) {
      query += ', image=?';
      params.push(image);
    }
    query += ' WHERE id=?';
    params.push(req.params.id);

    const [result] = await db.query(query, params);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Kategori tidak ditemukan' });
    res.json({ success: true, message: 'Kategori berhasil diupdate' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE
exports.remove = async (req, res) => {
  try {
    // Set products category ke null dulu
    await db.query('UPDATE products SET category_id = NULL WHERE category_id = ?', [req.params.id]);
    const [result] = await db.query('DELETE FROM categories WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Kategori tidak ditemukan' });
    res.json({ success: true, message: 'Kategori berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

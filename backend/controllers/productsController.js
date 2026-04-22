/**
 * productsController.js v2 — Products with Publish Workflow
 */
const db      = require('../config/database');
const path    = require('path');
const fs      = require('fs');
const slugify = require('slugify');
const { log } = require('../middleware/activityLogger');

const VALID_STATUSES = ['new','draft','review','ready','published','hidden','out_of_stock','archived'];
const getIp = (req) => req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;

function makeSlug(name) {
  return slugify(name, { lower: true, strict: true, locale: 'id' });
}

// ── PUBLIC ────────────────────────────────────────────────────

exports.getAll = async (req, res) => {
  try {
    const { search = '', category = '', featured = '', tag = '', page = 1, limit = 12 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    // PUBLIC: hanya tampilkan yang sudah published
    let where = "p.publish_status = 'published' AND p.is_active = 1";

    if (search) { where += ' AND (p.name LIKE ? OR p.short_desc LIKE ? OR p.material LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    if (category) { where += ' AND c.slug = ?'; params.push(category); }
    if (featured === '1' || featured === 'true') { where += ' AND p.is_featured = 1'; }
    if (tag) { where += ' AND EXISTS (SELECT 1 FROM product_tags pt WHERE pt.product_id = p.id AND pt.tag = ?)'; params.push(tag); }

    const [[{ total }]] = await db.query(`SELECT COUNT(*) as total FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE ${where}`, params);
    const [rows] = await db.query(
      `SELECT p.id, p.name, p.slug, p.short_desc, p.material, p.dimensions, p.price_label, p.thumbnail, p.is_featured, p.sort_order, p.created_at,
              c.name as category_name, c.slug as category_slug, c.icon as category_icon, c.color_from, c.color_to
       FROM products p LEFT JOIN categories c ON c.id = p.category_id
       WHERE ${where} ORDER BY p.is_featured DESC, p.sort_order ASC, p.created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    res.json({ success: true, data: rows, pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getOne = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT p.*, c.name as category_name, c.slug as category_slug, c.icon as category_icon, c.color_from, c.color_to
       FROM products p LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.slug = ? AND p.publish_status = 'published' AND p.is_active = 1`,
      [req.params.slug]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Produk tidak ditemukan' });
    const product = rows[0];
    const [images] = await db.query('SELECT * FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, sort_order ASC', [product.id]);
    const [tags]   = await db.query('SELECT tag FROM product_tags WHERE product_id = ?', [product.id]);
    await db.query('UPDATE products SET view_count = view_count + 1 WHERE id = ?', [product.id]);
    res.json({ success: true, data: { ...product, images, tags: tags.map(t => t.tag) } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getFeatured = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 6;
    const [rows] = await db.query(
      `SELECT p.id, p.name, p.slug, p.short_desc, p.thumbnail, p.price_label, p.is_featured,
              c.name as category_name, c.slug as category_slug, c.icon as category_icon, c.color_from, c.color_to
       FROM products p LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.publish_status = 'published' AND p.is_active = 1 AND p.is_featured = 1
       ORDER BY p.sort_order ASC, p.created_at DESC LIMIT ?`,
      [limit]
    );
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── ADMIN ─────────────────────────────────────────────────────

exports.getAdminById = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT p.*, c.name as category_name, c.slug as category_slug,
              u.full_name as created_by_name, pub.full_name as published_by_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN admin_users u ON u.id = p.created_by
       LEFT JOIN admin_users pub ON pub.id = p.published_by
       WHERE p.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Produk tidak ditemukan' });
    const product = rows[0];
    const [images] = await db.query('SELECT * FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, sort_order ASC', [product.id]);
    const [tags]   = await db.query('SELECT tag FROM product_tags WHERE product_id = ?', [product.id]);
    res.json({ success: true, data: { ...product, images, tags: tags.map(t => t.tag) } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getAllAdmin = async (req, res) => {
  try {
    const { search = '', category = '', status = '', page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    let where = '1=1';

    // Role-based filtering
    const userRole = req.admin?.role;
    if (userRole === 'admin_website') {
      // Admin website sees published + new products
      // No restriction — they see everything to manage CMS
    }
    if (userRole === 'marketing') {
      // Marketing only sees published products
      where += " AND p.publish_status = 'published'";
    }

    if (search)   { where += ' AND p.name LIKE ?'; params.push(`%${search}%`); }
    if (category) { where += ' AND c.slug = ?'; params.push(category); }
    if (status)   { where += ' AND p.publish_status = ?'; params.push(status); }

    const [[{ total }]] = await db.query(`SELECT COUNT(*) as total FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE ${where}`, params);
    const [rows] = await db.query(
      `SELECT p.*, c.name as category_name, u.full_name as created_by_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN admin_users u ON u.id = p.created_by
       WHERE ${where} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    res.json({ success: true, data: rows, pagination: { total: total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// GET products awaiting website publish (for admin_website)
exports.getNewFromWarehouse = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const [[{ total }]] = await db.query("SELECT COUNT(*) as total FROM products WHERE publish_status IN ('new','draft','review','ready')");
    const [rows] = await db.query(
      `SELECT p.*, c.name as category_name, u.full_name as created_by_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN admin_users u ON u.id = p.created_by
       WHERE p.publish_status IN ('new','draft','review','ready')
       ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
      [parseInt(limit), offset]
    );
    res.json({ success: true, data: rows, pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// CREATE product (admin_gudang — warehouse input)
exports.create = async (req, res) => {
  const { category_id, name, short_desc, description, specification, material, dimensions,
    price_label, is_featured, sort_order, meta_title, meta_desc, tags,
    sku, warehouse_stock, unit, cost_price, sell_price } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'Nama produk wajib diisi' });

  try {
    let slug = makeSlug(name);
    const [existing] = await db.query('SELECT id FROM products WHERE slug LIKE ?', [`${slug}%`]);
    if (existing.length > 0) slug = `${slug}-${Date.now()}`;

    const thumbnail = req.files?.thumbnail?.[0]?.filename || null;
    const [result]  = await db.query(
      `INSERT INTO products (category_id, name, slug, sku, short_desc, description, specification, material, dimensions,
        price_label, thumbnail, is_featured, sort_order, meta_title, meta_desc,
        warehouse_stock, unit, cost_price, sell_price, publish_status, is_active, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'new',0,?)`,
      [category_id || null, name, slug, sku || null, short_desc, description, specification, material, dimensions,
       price_label || 'Hubungi Kami', thumbnail, is_featured ? 1 : 0, sort_order || 0, meta_title, meta_desc,
       parseInt(warehouse_stock) || 0, unit || 'unit', parseFloat(cost_price) || 0, parseFloat(sell_price) || 0,
       req.admin.id]
    );
    const productId = result.insertId;

    if (req.files?.images) {
      await Promise.all(req.files.images.map((file, idx) =>
        db.query('INSERT INTO product_images (product_id, filename, sort_order) VALUES (?,?,?)', [productId, file.filename, idx])
      ));
    }
    if (tags) {
      const tagList = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()).filter(Boolean);
      await Promise.all(tagList.map(tag => db.query('INSERT IGNORE INTO product_tags (product_id, tag) VALUES (?,?)', [productId, tag])));
    }

    // Notify admin_website
    await db.query(
      "INSERT INTO notifications (target_role, type, title, message, link, created_by) VALUES ('admin_website','info',?,?,?,?)",
      ['Produk Baru dari Gudang', `Produk "${name}" siap untuk diproses di CMS Website.`, '/admin/panel.html#products-new', req.admin.id]
    );

    log({ userId: req.admin.id, username: req.admin.username, role: req.admin.role, action: 'CREATE', module: 'Products', description: `Tambah produk: ${name}`, recordId: productId, recordType: 'product', ipAddress: getIp(req) });
    res.status(201).json({ success: true, message: 'Produk berhasil dibuat dan masuk antrian Admin Website', id: productId, slug });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// UPDATE product - warehouse fields (admin_gudang)
exports.update = async (req, res) => {
  const { id } = req.params;
  const { category_id, name, slug, short_desc, description, specification, material, dimensions,
    price_label, is_featured, is_active, sort_order, meta_title, meta_desc, tags,
    sku, warehouse_stock, unit, cost_price, sell_price } = req.body;

  try {
    if (slug) {
      const [slugCheck] = await db.query('SELECT id FROM products WHERE slug=? AND id!=?', [slug, id]);
      if (slugCheck.length > 0) return res.status(400).json({ success: false, message: 'Slug sudah digunakan produk lain' });
    }

    const thumbnail = req.files?.thumbnail?.[0]?.filename;
    if (thumbnail) {
      const [[oldProd]] = await db.query('SELECT thumbnail FROM products WHERE id=?', [id]);
      if (oldProd?.thumbnail) {
        const oldThumbPath = path.join(__dirname, '..', 'uploads', 'products', oldProd.thumbnail);
        if (fs.existsSync(oldThumbPath)) { try { fs.unlinkSync(oldThumbPath); } catch(e) {} }
      }
    }

    let query = `UPDATE products SET category_id=?, name=?, slug=?, sku=?, short_desc=?, description=?, specification=?,
      material=?, dimensions=?, price_label=?, is_featured=?, is_active=?, sort_order=?, meta_title=?, meta_desc=?,
      warehouse_stock=?, unit=?, cost_price=?, sell_price=?`;
    const params = [
      category_id || null, name, slug, sku || null, short_desc, description, specification,
      material, dimensions, price_label, is_featured ? 1 : 0, is_active !== undefined ? is_active : 1,
      sort_order || 0, meta_title, meta_desc,
      parseInt(warehouse_stock) || 0, unit || 'unit', parseFloat(cost_price) || 0, parseFloat(sell_price) || 0
    ];
    if (thumbnail) { query += ', thumbnail=?'; params.push(thumbnail); }
    query += ' WHERE id=?';
    params.push(id);

    const [result] = await db.query(query, params);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Produk tidak ditemukan' });

    if (req.files?.images) {
      const [[maxOrder]] = await db.query('SELECT COALESCE(MAX(sort_order),0)+1 as next FROM product_images WHERE product_id=?', [id]);
      await Promise.all(req.files.images.map((file, idx) =>
        db.query('INSERT INTO product_images (product_id, filename, sort_order) VALUES (?,?,?)', [id, file.filename, maxOrder.next + idx])
      ));
    }
    if (tags !== undefined) {
      await db.query('DELETE FROM product_tags WHERE product_id=?', [id]);
      const tagList = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()).filter(Boolean);
      if (tagList.length) await Promise.all(tagList.map(tag => db.query('INSERT IGNORE INTO product_tags (product_id, tag) VALUES (?,?)', [id, tag])));
    }

    log({ userId: req.admin.id, username: req.admin.username, role: req.admin.role, action: 'UPDATE', module: 'Products', description: `Update produk ID ${id}: ${name}`, recordId: parseInt(id), recordType: 'product', ipAddress: getIp(req) });
    res.json({ success: true, message: 'Produk berhasil diupdate' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// UPDATE CMS fields only (admin_website) — edit judul, deskripsi, SEO, foto
exports.updateCMS = async (req, res) => {
  const { id } = req.params;
  const { name, slug, short_desc, description, specification, material, dimensions,
    price_label, is_featured, meta_title, meta_desc, tags } = req.body;

  try {
    if (slug) {
      const [slugCheck] = await db.query('SELECT id FROM products WHERE slug=? AND id!=?', [slug, id]);
      if (slugCheck.length > 0) return res.status(400).json({ success: false, message: 'Slug sudah digunakan produk lain' });
    }

    const thumbnail = req.files?.thumbnail?.[0]?.filename;
    if (thumbnail) {
      const [[oldProd]] = await db.query('SELECT thumbnail FROM products WHERE id=?', [id]);
      if (oldProd?.thumbnail) {
        const oldThumbPath = path.join(__dirname, '..', 'uploads', 'products', oldProd.thumbnail);
        if (fs.existsSync(oldThumbPath)) { try { fs.unlinkSync(oldThumbPath); } catch(e) {} }
      }
    }

    const fields = [], params = [];
    const addField = (col, val) => { if (val !== undefined) { fields.push(`${col}=?`); params.push(val); } };

    addField('name',           name);
    addField('slug',           slug);
    addField('short_desc',     short_desc);
    addField('description',    description);
    addField('specification',  specification);
    addField('material',       material);
    addField('dimensions',     dimensions);
    addField('price_label',    price_label);
    addField('meta_title',     meta_title);
    addField('meta_desc',      meta_desc);
    if (is_featured !== undefined) { fields.push('is_featured=?'); params.push(is_featured ? 1 : 0); }
    if (thumbnail) { fields.push('thumbnail=?'); params.push(thumbnail); }

    if (fields.length) {
      params.push(id);
      const [result] = await db.query(`UPDATE products SET ${fields.join(',')} WHERE id=?`, params);
      if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Produk tidak ditemukan' });
    }

    if (req.files?.images) {
      const [[maxOrder]] = await db.query('SELECT COALESCE(MAX(sort_order),0)+1 as next FROM product_images WHERE product_id=?', [id]);
      await Promise.all(req.files.images.map((file, idx) =>
        db.query('INSERT INTO product_images (product_id, filename, sort_order) VALUES (?,?,?)', [id, file.filename, maxOrder.next + idx])
      ));
    }
    if (tags !== undefined) {
      await db.query('DELETE FROM product_tags WHERE product_id=?', [id]);
      const tagList = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()).filter(Boolean);
      if (tagList.length) await Promise.all(tagList.map(tag => db.query('INSERT IGNORE INTO product_tags (product_id, tag) VALUES (?,?)', [id, tag])));
    }

    log({ userId: req.admin.id, username: req.admin.username, role: req.admin.role, action: 'UPDATE_CMS', module: 'Products', description: `Update CMS produk ID ${id}`, recordId: parseInt(id), recordType: 'product', ipAddress: getIp(req) });
    res.json({ success: true, message: 'Konten produk berhasil diupdate' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// PUBLISH product (admin_website)
exports.publish = async (req, res) => {
  try {
    const [[prod]] = await db.query('SELECT id, name, publish_status FROM products WHERE id=?', [req.params.id]);
    if (!prod) return res.status(404).json({ success: false, message: 'Produk tidak ditemukan' });

    await db.query(
      "UPDATE products SET publish_status='published', is_active=1, published_by=?, published_at=NOW() WHERE id=?",
      [req.admin.id, req.params.id]
    );
    log({ userId: req.admin.id, username: req.admin.username, role: req.admin.role, action: 'PUBLISH', module: 'Products', description: `Publish produk: ${prod.name}`, recordId: prod.id, recordType: 'product', ipAddress: getIp(req) });
    res.json({ success: true, message: `Produk "${prod.name}" berhasil dipublish ke website` });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// UNPUBLISH product (admin_website)
exports.unpublish = async (req, res) => {
  try {
    const [[prod]] = await db.query('SELECT id, name FROM products WHERE id=?', [req.params.id]);
    if (!prod) return res.status(404).json({ success: false, message: 'Produk tidak ditemukan' });

    await db.query("UPDATE products SET publish_status='hidden', is_active=0 WHERE id=?", [req.params.id]);
    log({ userId: req.admin.id, username: req.admin.username, role: req.admin.role, action: 'UNPUBLISH', module: 'Products', description: `Unpublish produk: ${prod.name}`, recordId: prod.id, recordType: 'product', ipAddress: getIp(req) });
    res.json({ success: true, message: `Produk "${prod.name}" berhasil disembunyikan dari website` });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// UPDATE status (admin_website)
exports.updateStatus = async (req, res) => {
  const { status } = req.body;
  if (!VALID_STATUSES.includes(status)) return res.status(400).json({ success: false, message: `Status tidak valid. Pilihan: ${VALID_STATUSES.join(', ')}` });

  try {
    const [[prod]] = await db.query('SELECT id, name FROM products WHERE id=?', [req.params.id]);
    if (!prod) return res.status(404).json({ success: false, message: 'Produk tidak ditemukan' });

    const is_active = status === 'published' ? 1 : 0;
    const extraFields = status === 'published' ? ', published_by=?, published_at=NOW()' : '';
    const extraParams = status === 'published' ? [req.admin.id, req.params.id] : [req.params.id];
    await db.query(`UPDATE products SET publish_status=?, is_active=?${extraFields} WHERE id=?`, [status, is_active, ...extraParams]);

    log({ userId: req.admin.id, username: req.admin.username, role: req.admin.role, action: 'STATUS_UPDATE', module: 'Products', description: `Status produk ${prod.name} → ${status}`, recordId: prod.id, recordType: 'product', ipAddress: getIp(req) });
    res.json({ success: true, message: `Status produk berhasil diubah ke: ${status}` });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// DELETE product
exports.remove = async (req, res) => {
  try {
    const [[prod]] = await db.query('SELECT thumbnail FROM products WHERE id=?', [req.params.id]);
    if (prod?.thumbnail) {
      const thumbPath = path.join(__dirname, '..', 'uploads', 'products', prod.thumbnail);
      if (fs.existsSync(thumbPath)) { try { fs.unlinkSync(thumbPath); } catch(e) {} }
    }
    const [images] = await db.query('SELECT filename FROM product_images WHERE product_id=?', [req.params.id]);
    images.forEach(img => {
      const filePath = path.join(__dirname, '..', 'uploads', 'products', img.filename);
      if (fs.existsSync(filePath)) { try { fs.unlinkSync(filePath); } catch(e) {} }
    });
    const [result] = await db.query('DELETE FROM products WHERE id=?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Produk tidak ditemukan' });

    log({ userId: req.admin.id, username: req.admin.username, role: req.admin.role, action: 'DELETE', module: 'Products', description: `Hapus produk ID ${req.params.id}`, ipAddress: getIp(req) });
    res.json({ success: true, message: 'Produk berhasil dihapus' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteImage = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT filename FROM product_images WHERE id=?', [req.params.imageId]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Gambar tidak ditemukan' });
    const filePath = path.join(__dirname, '..', 'uploads', 'products', rows[0].filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await db.query('DELETE FROM product_images WHERE id=?', [req.params.imageId]);
    res.json({ success: true, message: 'Gambar berhasil dihapus' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.setPrimaryImage = async (req, res) => {
  try {
    const { productId, imageId } = req.params;
    await db.query('UPDATE product_images SET is_primary=0 WHERE product_id=?', [productId]);
    await db.query('UPDATE product_images SET is_primary=1 WHERE id=? AND product_id=?', [imageId, productId]);
    const [img] = await db.query('SELECT filename FROM product_images WHERE id=?', [imageId]);
    if (img.length) await db.query('UPDATE products SET thumbnail=? WHERE id=?', [img[0].filename, productId]);
    res.json({ success: true, message: 'Gambar utama berhasil diset' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

/**
 * warehouseController.js — Warehouse Management System
 * Handles: Stock Transactions, Suppliers, Customers
 */
const db  = require('../config/database');
const { log } = require('../middleware/activityLogger');

const getIp = (req) => req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;

// ══════════════════════════════════════════════════════════════
// DASHBOARD GUDANG
// ══════════════════════════════════════════════════════════════
exports.getDashboard = async (req, res) => {
  try {
    const [[{ total_products }]]     = await db.query('SELECT COUNT(*) as total_products FROM products');
    const [[{ low_stock }]]          = await db.query('SELECT COUNT(*) as low_stock FROM products WHERE warehouse_stock <= 3 AND warehouse_stock > 0');
    const [[{ out_of_stock }]]       = await db.query('SELECT COUNT(*) as out_of_stock FROM products WHERE warehouse_stock = 0');
    const [[{ total_suppliers }]]    = await db.query('SELECT COUNT(*) as total_suppliers FROM suppliers WHERE is_active=1');
    const [[{ total_customers }]]    = await db.query('SELECT COUNT(*) as total_customers FROM customers WHERE is_active=1');
    const [[{ pending_orders }]]     = await db.query("SELECT COUNT(*) as pending_orders FROM orders WHERE status IN ('pending','confirmed','processing')");
    const [[{ stock_in_today }]]     = await db.query("SELECT COALESCE(SUM(qty),0) as stock_in_today FROM stock_transactions WHERE type='in' AND DATE(created_at)=CURDATE()");
    const [[{ stock_out_today }]]    = await db.query("SELECT COALESCE(SUM(qty),0) as stock_out_today FROM stock_transactions WHERE type='out' AND DATE(created_at)=CURDATE()");

    // Calculate total inventory value (stock * cost_price)
    const [[{ inventory_value }]]    = await db.query('SELECT COALESCE(SUM(warehouse_stock * cost_price), 0) as inventory_value FROM products');

    const [low_stock_products] = await db.query(
      'SELECT p.id, p.name, p.sku, p.warehouse_stock, p.unit, c.name as category_name FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.warehouse_stock <= 5 ORDER BY p.warehouse_stock ASC LIMIT 10'
    );
    const [recent_transactions] = await db.query(
      `SELECT st.*, p.name as product_name, p.sku, u.full_name as created_by_name
       FROM stock_transactions st
       LEFT JOIN products p ON p.id=st.product_id
       LEFT JOIN admin_users u ON u.id=st.created_by
       ORDER BY st.created_at DESC LIMIT 10`
    );

    // Stock flow last 7 days (for chart)
    const [stock_flow_7days] = await db.query(`
      SELECT DATE_FORMAT(d.date, '%d/%m') as date,
             SUM(CASE WHEN st.type = 'in' THEN st.qty ELSE 0 END) as stock_in,
             SUM(CASE WHEN st.type = 'out' THEN st.qty ELSE 0 END) as stock_out
      FROM (
        SELECT CURDATE() as date UNION SELECT DATE_SUB(CURDATE(), INTERVAL 1 DAY) UNION
        SELECT DATE_SUB(CURDATE(), INTERVAL 2 DAY) UNION SELECT DATE_SUB(CURDATE(), INTERVAL 3 DAY) UNION
        SELECT DATE_SUB(CURDATE(), INTERVAL 4 DAY) UNION SELECT DATE_SUB(CURDATE(), INTERVAL 5 DAY) UNION
        SELECT DATE_SUB(CURDATE(), INTERVAL 6 DAY)
      ) d
      LEFT JOIN stock_transactions st ON DATE(st.created_at) = d.date
      GROUP BY d.date ORDER BY d.date ASC
    `);

    res.json({
      success: true,
      data: {
        stats: {
          total_products, low_stock, out_of_stock, total_suppliers, total_customers,
          pending_orders, stock_in_today, stock_out_today, inventory_value
        },
        low_stock_products,
        recent_transactions,
        stock_flow_7days
      }
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ══════════════════════════════════════════════════════════════
// STOCK TRANSACTIONS
// ══════════════════════════════════════════════════════════════
exports.getAllTransactions = async (req, res) => {
  try {
    const { type = '', product_id = '', date_from = '', date_to = '', page = 1, limit = 30 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    let where = '1=1';

    if (type)       { where += ' AND st.type=?';           params.push(type); }
    if (product_id) { where += ' AND st.product_id=?';     params.push(product_id); }
    if (date_from)  { where += ' AND DATE(st.created_at)>=?'; params.push(date_from); }
    if (date_to)    { where += ' AND DATE(st.created_at)<=?'; params.push(date_to); }

    const [[{ total }]] = await db.query(`SELECT COUNT(*) as total FROM stock_transactions st WHERE ${where}`, params);
    const [rows] = await db.query(
      `SELECT st.*, p.name as product_name, p.sku, p.unit,
              s.name as supplier_name, u.full_name as created_by_name
       FROM stock_transactions st
       LEFT JOIN products p ON p.id=st.product_id
       LEFT JOIN suppliers s ON s.id=st.supplier_id
       LEFT JOIN admin_users u ON u.id=st.created_by
       WHERE ${where}
       ORDER BY st.created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    res.json({ success: true, data: rows, pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// STOCK IN (Barang Masuk)
exports.stockIn = async (req, res) => {
  const { product_id, qty, supplier_id, reference_no, unit_price, notes } = req.body;
  if (!product_id || !qty || qty <= 0) return res.status(400).json({ success: false, message: 'Produk dan jumlah barang masuk wajib diisi' });

  try {
    const [[product]] = await db.query('SELECT id, name, warehouse_stock, unit FROM products WHERE id=?', [product_id]);
    if (!product) return res.status(404).json({ success: false, message: 'Produk tidak ditemukan' });

    const qtyBefore = product.warehouse_stock;
    const qtyAfter  = qtyBefore + parseInt(qty);
    const totalPrice = (parseFloat(unit_price) || 0) * parseInt(qty);

    await db.query('UPDATE products SET warehouse_stock=? WHERE id=?', [qtyAfter, product_id]);
    const [result] = await db.query(
      `INSERT INTO stock_transactions (product_id, type, qty, qty_before, qty_after, reference_type, reference_no, supplier_id, unit_price, total_price, notes, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [product_id, 'in', parseInt(qty), qtyBefore, qtyAfter, 'purchase', reference_no || null, supplier_id || null, unit_price || 0, totalPrice, notes || null, req.admin.id]
    );

    // Notify admin_website if product was out_of_stock
    if (qtyBefore === 0) {
      await db.query("UPDATE products SET publish_status=CASE WHEN publish_status='out_of_stock' THEN 'published' ELSE publish_status END WHERE id=?", [product_id]);
    }

    log({ userId: req.admin.id, username: req.admin.username, role: req.admin.role, action: 'STOCK_IN', module: 'Stock', description: `Barang masuk: ${product.name} +${qty} unit (${qtyBefore}→${qtyAfter})`, recordId: result.insertId, recordType: 'stock_transaction', ipAddress: getIp(req) });
    res.status(201).json({ success: true, message: `Barang masuk berhasil. Stok: ${qtyBefore} → ${qtyAfter}`, id: result.insertId });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// STOCK OUT (Barang Keluar)
exports.stockOut = async (req, res) => {
  const { product_id, qty, order_id, reference_no, notes } = req.body;
  if (!product_id || !qty || qty <= 0) return res.status(400).json({ success: false, message: 'Produk dan jumlah barang keluar wajib diisi' });

  try {
    const [[product]] = await db.query('SELECT id, name, warehouse_stock, unit, sell_price FROM products WHERE id=?', [product_id]);
    if (!product) return res.status(404).json({ success: false, message: 'Produk tidak ditemukan' });
    if (product.warehouse_stock < parseInt(qty)) {
      return res.status(400).json({ success: false, message: `Stok tidak cukup. Stok tersedia: ${product.warehouse_stock} ${product.unit}` });
    }

    const qtyBefore = product.warehouse_stock;
    const qtyAfter  = qtyBefore - parseInt(qty);
    const totalPrice = (parseFloat(product.sell_price) || 0) * parseInt(qty);

    await db.query('UPDATE products SET warehouse_stock=? WHERE id=?', [qtyAfter, product_id]);

    // Auto update publish_status if stock hits zero
    if (qtyAfter === 0) {
      await db.query("UPDATE products SET publish_status=CASE WHEN publish_status='published' THEN 'out_of_stock' ELSE publish_status END WHERE id=?", [product_id]);
    }

    const [result] = await db.query(
      `INSERT INTO stock_transactions (product_id, type, qty, qty_before, qty_after, reference_type, reference_no, order_id, unit_price, total_price, notes, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [product_id, 'out', parseInt(qty), qtyBefore, qtyAfter, 'sale', reference_no || null, order_id || null, product.sell_price || 0, totalPrice, notes || null, req.admin.id]
    );

    log({ userId: req.admin.id, username: req.admin.username, role: req.admin.role, action: 'STOCK_OUT', module: 'Stock', description: `Barang keluar: ${product.name} -${qty} unit (${qtyBefore}→${qtyAfter})`, recordId: result.insertId, recordType: 'stock_transaction', ipAddress: getIp(req) });
    res.status(201).json({ success: true, message: `Barang keluar berhasil. Stok: ${qtyBefore} → ${qtyAfter}`, id: result.insertId });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// STOCK ADJUSTMENT
exports.stockAdjustment = async (req, res) => {
  const { product_id, new_qty, notes } = req.body;
  if (!product_id || new_qty === undefined) return res.status(400).json({ success: false, message: 'Produk dan stok baru wajib diisi' });

  try {
    const [[product]] = await db.query('SELECT id, name, warehouse_stock FROM products WHERE id=?', [product_id]);
    if (!product) return res.status(404).json({ success: false, message: 'Produk tidak ditemukan' });

    const qtyBefore = product.warehouse_stock;
    const qtyAfter  = parseInt(new_qty);
    const diffQty   = qtyAfter - qtyBefore;

    await db.query('UPDATE products SET warehouse_stock=? WHERE id=?', [qtyAfter, product_id]);
    await db.query(
      `INSERT INTO stock_transactions (product_id, type, qty, qty_before, qty_after, reference_type, notes, created_by)
       VALUES (?,?,?,?,?,?,?,?)`,
      [product_id, 'adjustment', Math.abs(diffQty), qtyBefore, qtyAfter, 'adjustment', notes || `Adjustment: ${qtyBefore} → ${qtyAfter}`, req.admin.id]
    );

    log({ userId: req.admin.id, username: req.admin.username, role: req.admin.role, action: 'STOCK_ADJUSTMENT', module: 'Stock', description: `Adjustment stok: ${product.name} (${qtyBefore}→${qtyAfter})`, ipAddress: getIp(req) });
    res.json({ success: true, message: `Stok berhasil disesuaikan: ${qtyBefore} → ${qtyAfter}` });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// GET stock report summary
exports.getStockSummary = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT p.id, p.sku, p.name, p.warehouse_stock, p.unit, p.cost_price, p.sell_price,
             p.publish_status, c.name as category_name,
             COALESCE(SUM(CASE WHEN st.type='in' THEN st.qty ELSE 0 END),0) AS total_in,
             COALESCE(SUM(CASE WHEN st.type='out' THEN st.qty ELSE 0 END),0) AS total_out,
             (p.warehouse_stock * p.cost_price) AS stock_value
      FROM products p
      LEFT JOIN categories c ON c.id=p.category_id
      LEFT JOIN stock_transactions st ON st.product_id=p.id
      GROUP BY p.id ORDER BY p.warehouse_stock ASC`
    );
    const [[{ total_value }]] = await db.query('SELECT COALESCE(SUM(warehouse_stock * cost_price),0) as total_value FROM products');
    res.json({ success: true, data: rows, total_stock_value: total_value });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ══════════════════════════════════════════════════════════════
// SUPPLIERS
// ══════════════════════════════════════════════════════════════
exports.getAllSuppliers = async (req, res) => {
  try {
    const { search = '', page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    let where = '1=1';
    if (search) { where += ' AND (name LIKE ? OR code LIKE ? OR contact_name LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }

    const [[{ total }]] = await db.query(`SELECT COUNT(*) as total FROM suppliers WHERE ${where}`, params);
    const [rows] = await db.query(
      `SELECT * FROM suppliers WHERE ${where} ORDER BY name ASC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    res.json({ success: true, data: rows, pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.createSupplier = async (req, res) => {
  const { code, name, contact_name, phone, email, address, city, province, notes } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'Nama supplier wajib diisi' });
  try {
    const [result] = await db.query(
      'INSERT INTO suppliers (code, name, contact_name, phone, email, address, city, province, notes, created_by) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [code || null, name, contact_name || null, phone || null, email || null, address || null, city || null, province || null, notes || null, req.admin.id]
    );
    log({ userId: req.admin.id, username: req.admin.username, role: req.admin.role, action: 'CREATE', module: 'Suppliers', description: `Tambah supplier: ${name}`, recordId: result.insertId, recordType: 'supplier', ipAddress: getIp(req) });
    res.status(201).json({ success: true, message: 'Supplier berhasil ditambahkan', id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ success: false, message: 'Kode supplier sudah digunakan' });
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateSupplier = async (req, res) => {
  const { id } = req.params;
  const { code, name, contact_name, phone, email, address, city, province, notes, is_active } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'Nama supplier wajib diisi' });
  try {
    const [result] = await db.query(
      'UPDATE suppliers SET code=?, name=?, contact_name=?, phone=?, email=?, address=?, city=?, province=?, notes=?, is_active=? WHERE id=?',
      [code || null, name, contact_name || null, phone || null, email || null, address || null, city || null, province || null, notes || null, is_active !== undefined ? is_active : 1, id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Supplier tidak ditemukan' });
    log({ userId: req.admin.id, username: req.admin.username, role: req.admin.role, action: 'UPDATE', module: 'Suppliers', description: `Update supplier: ${name}`, recordId: parseInt(id), recordType: 'supplier', ipAddress: getIp(req) });
    res.json({ success: true, message: 'Supplier berhasil diupdate' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteSupplier = async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM suppliers WHERE id=?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Supplier tidak ditemukan' });
    log({ userId: req.admin.id, username: req.admin.username, role: req.admin.role, action: 'DELETE', module: 'Suppliers', description: `Hapus supplier ID ${req.params.id}`, ipAddress: getIp(req) });
    res.json({ success: true, message: 'Supplier berhasil dihapus' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ══════════════════════════════════════════════════════════════
// CUSTOMERS
// ══════════════════════════════════════════════════════════════
exports.getAllCustomers = async (req, res) => {
  try {
    const { search = '', page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    let where = '1=1';
    if (search) { where += ' AND (name LIKE ? OR code LIKE ? OR phone LIKE ? OR email LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`); }

    const [[{ total }]] = await db.query(`SELECT COUNT(*) as total FROM customers WHERE ${where}`, params);
    const [rows] = await db.query(
      `SELECT c.*, COUNT(o.id) as total_orders_count, COALESCE(SUM(o.total),0) as total_spend_actual
       FROM customers c LEFT JOIN orders o ON o.customer_id=c.id
       WHERE ${where} GROUP BY c.id ORDER BY c.name ASC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    res.json({ success: true, data: rows, pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getCustomer = async (req, res) => {
  try {
    const [[customer]] = await db.query('SELECT * FROM customers WHERE id=?', [req.params.id]);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer tidak ditemukan' });
    const [orders] = await db.query('SELECT id, order_number, status, total, created_at FROM orders WHERE customer_id=? ORDER BY created_at DESC LIMIT 10', [req.params.id]);
    res.json({ success: true, data: { ...customer, orders } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.createCustomer = async (req, res) => {
  const { code, name, phone, email, address, city, province, notes } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'Nama customer wajib diisi' });
  try {
    const [result] = await db.query(
      'INSERT INTO customers (code, name, phone, email, address, city, province, notes, created_by) VALUES (?,?,?,?,?,?,?,?,?)',
      [code || null, name, phone || null, email || null, address || null, city || null, province || null, notes || null, req.admin.id]
    );
    log({ userId: req.admin.id, username: req.admin.username, role: req.admin.role, action: 'CREATE', module: 'Customers', description: `Tambah customer: ${name}`, recordId: result.insertId, recordType: 'customer', ipAddress: getIp(req) });
    res.status(201).json({ success: true, message: 'Customer berhasil ditambahkan', id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ success: false, message: 'Kode customer sudah digunakan' });
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateCustomer = async (req, res) => {
  const { id } = req.params;
  const { code, name, phone, email, address, city, province, notes, is_active } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'Nama customer wajib diisi' });
  try {
    const [result] = await db.query(
      'UPDATE customers SET code=?, name=?, phone=?, email=?, address=?, city=?, province=?, notes=?, is_active=? WHERE id=?',
      [code || null, name, phone || null, email || null, address || null, city || null, province || null, notes || null, is_active !== undefined ? is_active : 1, id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Customer tidak ditemukan' });
    log({ userId: req.admin.id, username: req.admin.username, role: req.admin.role, action: 'UPDATE', module: 'Customers', description: `Update customer: ${name}`, recordId: parseInt(id), recordType: 'customer', ipAddress: getIp(req) });
    res.json({ success: true, message: 'Customer berhasil diupdate' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteCustomer = async (req, res) => {
  try {
    const [[{ order_count }]] = await db.query('SELECT COUNT(*) as order_count FROM orders WHERE customer_id=?', [req.params.id]);
    if (order_count > 0) return res.status(400).json({ success: false, message: `Customer memiliki ${order_count} order. Nonaktifkan saja (jangan hapus).` });
    const [result] = await db.query('DELETE FROM customers WHERE id=?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Customer tidak ditemukan' });
    log({ userId: req.admin.id, username: req.admin.username, role: req.admin.role, action: 'DELETE', module: 'Customers', description: `Hapus customer ID ${req.params.id}`, ipAddress: getIp(req) });
    res.json({ success: true, message: 'Customer berhasil dihapus' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

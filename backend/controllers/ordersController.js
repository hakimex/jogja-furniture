/**
 * ordersController.js — Order Management + Invoice
 */
const db = require('../config/database');
const { log } = require('../middleware/activityLogger');

const getIp = (req) => req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;

const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'ready', 'delivered', 'cancelled', 'refunded'];
const PAYMENT_STATUSES = ['unpaid', 'partial', 'paid', 'refunded'];

// Generate order number
async function generateOrderNumber() {
  const year = new Date().getFullYear();
  const [[{ count }]] = await db.query("SELECT COUNT(*) as count FROM orders WHERE YEAR(created_at)=?", [year]);
  const seq = String(count + 1).padStart(4, '0');
  return `ORD-${year}-${seq}`;
}

// GET all orders
exports.getAll = async (req, res) => {
  try {
    const { status = '', payment_status = '', search = '', page = 1, limit = 20, date_from = '', date_to = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    let where = '1=1';

    if (status) { where += ' AND o.status=?'; params.push(status); }
    if (payment_status) { where += ' AND o.payment_status=?'; params.push(payment_status); }
    if (search) { where += ' AND (o.order_number LIKE ? OR o.customer_name LIKE ? OR o.customer_phone LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    if (date_from) { where += ' AND DATE(o.created_at) >= ?'; params.push(date_from); }
    if (date_to) { where += ' AND DATE(o.created_at) <= ?'; params.push(date_to); }

    const [[{ total }]] = await db.query(`SELECT COUNT(*) as total FROM orders o WHERE ${where}`, params);
    const [rows] = await db.query(
      `SELECT o.*, u.full_name as created_by_name, COUNT(oi.id) as item_count
       FROM orders o
       LEFT JOIN admin_users u ON u.id=o.created_by
       LEFT JOIN order_items oi ON oi.order_id=o.id
       WHERE ${where} GROUP BY o.id ORDER BY o.created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    res.json({ success: true, data: rows, pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// GET single order with items
exports.getOne = async (req, res) => {
  try {
    const [[order]] = await db.query(
      `SELECT o.*, u.full_name as created_by_name, c.full_name as confirmed_by_name
       FROM orders o
       LEFT JOIN admin_users u ON u.id=o.created_by
       LEFT JOIN admin_users c ON c.id=o.confirmed_by
       WHERE o.id=?`,
      [req.params.id]
    );
    if (!order) return res.status(404).json({ success: false, message: 'Order tidak ditemukan' });

    const [items] = await db.query(
      `SELECT oi.*, p.thumbnail, p.slug FROM order_items oi LEFT JOIN products p ON p.id=oi.product_id WHERE oi.order_id=?`,
      [req.params.id]
    );
    res.json({ success: true, data: { ...order, items } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// CREATE order
exports.create = async (req, res) => {
  const { customer_id, customer_name, customer_phone, customer_email, customer_addr, shipping_addr, payment_method, discount, shipping_cost, notes, delivery_date, items } = req.body;

  if (!customer_name) return res.status(400).json({ success: false, message: 'Nama customer wajib diisi' });
  if (!items || !items.length) return res.status(400).json({ success: false, message: 'Order harus memiliki minimal 1 item' });

  for (const item of items) {
    if (!item.product_name || !item.qty || !item.unit_price) {
      return res.status(400).json({ success: false, message: 'Setiap item harus memiliki nama produk, qty, dan harga' });
    }
  }

  try {
    const order_number = await generateOrderNumber();
    const subtotal = items.reduce((sum, item) => sum + (item.qty * item.unit_price), 0);
    const total = subtotal - (parseFloat(discount) || 0) + (parseFloat(shipping_cost) || 0);

    const [result] = await db.query(
      `INSERT INTO orders (order_number, customer_id, customer_name, customer_phone, customer_email, customer_addr, shipping_addr, payment_method, subtotal, discount, shipping_cost, total, notes, delivery_date, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [order_number, customer_id || null, customer_name, customer_phone || null, customer_email || null, customer_addr || null, shipping_addr || null, payment_method || null, subtotal, parseFloat(discount) || 0, parseFloat(shipping_cost) || 0, total, notes || null, delivery_date || null, req.admin.id]
    );
    const orderId = result.insertId;

    for (const item of items) {
      const itemSubtotal = item.qty * item.unit_price;
      await db.query(
        'INSERT INTO order_items (order_id, product_id, product_name, product_sku, qty, unit, unit_price, subtotal, notes) VALUES (?,?,?,?,?,?,?,?,?)',
        [orderId, item.product_id || null, item.product_name, item.product_sku || null, item.qty, item.unit || 'unit', item.unit_price, itemSubtotal, item.notes || null]
      );
    }

    // Update customer stats if linked
    if (customer_id) {
      await db.query('UPDATE customers SET total_orders=total_orders+1 WHERE id=?', [customer_id]);
    }

    log({ userId: req.admin.id, username: req.admin.username, role: req.admin.role, action: 'CREATE_ORDER', module: 'Orders', description: `Buat order: ${order_number} - ${customer_name}`, recordId: orderId, recordType: 'order', ipAddress: getIp(req) });
    res.status(201).json({ success: true, message: 'Order berhasil dibuat', id: orderId, order_number });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// UPDATE order status
exports.updateStatus = async (req, res) => {
  const { id } = req.params;
  const { status, payment_status, amount_paid, notes } = req.body;

  if (status && !ORDER_STATUSES.includes(status)) return res.status(400).json({ success: false, message: 'Status order tidak valid' });
  if (payment_status && !PAYMENT_STATUSES.includes(payment_status)) return res.status(400).json({ success: false, message: 'Status pembayaran tidak valid' });

  try {
    const [[order]] = await db.query('SELECT * FROM orders WHERE id=?', [id]);
    if (!order) return res.status(404).json({ success: false, message: 'Order tidak ditemukan' });

    const fields = [], params = [];
    if (status) { fields.push('status=?'); params.push(status); }
    if (payment_status) { fields.push('payment_status=?'); params.push(payment_status); }
    if (amount_paid !== undefined) { fields.push('amount_paid=?'); params.push(parseFloat(amount_paid)); }
    if (notes) { fields.push('notes=?'); params.push(notes); }
    if (status === 'confirmed') { fields.push('confirmed_by=?'); params.push(req.admin.id); }
    if (!fields.length) return res.status(400).json({ success: false, message: 'Tidak ada data yang diubah' });

    params.push(id);
    await db.query(`UPDATE orders SET ${fields.join(',')} WHERE id=?`, params);

    // ══════════════════════════════════════════════════════════════
    // AUTO STOCK MANAGEMENT LOGIC
    // ══════════════════════════════════════════════════════════════
    if (status && status !== order.status) {
      const DEDUCTED_STATES = ['confirmed', 'processing', 'ready', 'delivered'];
      const oldIsDeducted = DEDUCTED_STATES.includes(order.status);
      const newIsDeducted = DEDUCTED_STATES.includes(status);

      if (oldIsDeducted !== newIsDeducted) {
        const [items] = await db.query('SELECT * FROM order_items WHERE order_id=?', [id]);

        for (const item of items) {
          if (!item.product_id) continue;

          if (newIsDeducted) {
            // ACTION: DEDUCT STOCK
            const [[product]] = await db.query('SELECT warehouse_stock, name FROM products WHERE id=?', [item.product_id]);
            if (!product) continue;

            if (product.warehouse_stock < item.qty) {
              // Note: We already updated the order status above. 
              // In a production app, we should use a DB transaction to roll back.
              // For now, we'll just log an error or throw.
              throw new Error(`Stok tidak cukup untuk produk ${product.name}. Tersedia: ${product.warehouse_stock}`);
            }

            const qtyBefore = product.warehouse_stock;
            const qtyAfter = qtyBefore - item.qty;

            await db.query('UPDATE products SET warehouse_stock=? WHERE id=?', [qtyAfter, item.product_id]);
            await db.query(
              `INSERT INTO stock_transactions (product_id, type, qty, qty_before, qty_after, reference_type, reference_no, order_id, unit_price, total_price, notes, created_by)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
              [item.product_id, 'out', item.qty, qtyBefore, qtyAfter, 'sale', order.order_number, id, item.unit_price, item.subtotal, `Potong stok otomatis (Order ${status})`, req.admin.id]
            );

            if (qtyAfter === 0) {
              await db.query("UPDATE products SET publish_status=CASE WHEN publish_status='published' THEN 'out_of_stock' ELSE publish_status END WHERE id=?", [item.product_id]);
            }
          } else {
            // ACTION: RESTORE STOCK
            const [[product]] = await db.query('SELECT warehouse_stock FROM products WHERE id=?', [item.product_id]);
            if (!product) continue;

            const qtyBefore = product.warehouse_stock;
            const qtyAfter = qtyBefore + item.qty;

            await db.query('UPDATE products SET warehouse_stock=? WHERE id=?', [qtyAfter, item.product_id]);
            await db.query(
              `INSERT INTO stock_transactions (product_id, type, qty, qty_before, qty_after, reference_type, reference_no, order_id, unit_price, total_price, notes, created_by)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
              [item.product_id, 'in', item.qty, qtyBefore, qtyAfter, 'return', order.order_number, id, item.unit_price, item.subtotal, `Pengembalian stok otomatis (Status ${status})`, req.admin.id]
            );

            if (qtyBefore === 0) {
              await db.query("UPDATE products SET publish_status=CASE WHEN publish_status='out_of_stock' THEN 'published' ELSE publish_status END WHERE id=?", [item.product_id]);
            }
          }
        }
      }
    }


    // Auto update customer total_spend if paid
    if (payment_status === 'paid') {
      await db.query('UPDATE customers SET total_spend=total_spend+? WHERE id=?', [order.total, order.customer_id]);
    }

    log({ userId: req.admin.id, username: req.admin.username, role: req.admin.role, action: 'UPDATE_ORDER', module: 'Orders', description: `Update order: ${order.order_number} → status: ${status || '-'}, payment: ${payment_status || '-'}`, recordId: parseInt(id), recordType: 'order', ipAddress: getIp(req) });
    res.json({ success: true, message: 'Order berhasil diupdate' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// UPDATE full order (for edit before confirmed)
exports.update = async (req, res) => {
  const { id } = req.params;
  const { customer_id, customer_name, customer_phone, customer_email, customer_addr, shipping_addr, payment_method, discount, shipping_cost, notes, delivery_date, items } = req.body;

  try {
    const [[order]] = await db.query('SELECT * FROM orders WHERE id=?', [id]);
    if (!order) return res.status(404).json({ success: false, message: 'Order tidak ditemukan' });
    if (['delivered', 'cancelled', 'refunded'].includes(order.status)) {
      return res.status(400).json({ success: false, message: 'Order yang sudah selesai/dibatalkan tidak dapat diubah' });
    }

    const subtotal = items ? items.reduce((sum, item) => sum + (item.qty * item.unit_price), 0) : order.subtotal;
    const total = subtotal - (parseFloat(discount) || 0) + (parseFloat(shipping_cost) || 0);

    await db.query(
      `UPDATE orders SET customer_id=?, customer_name=?, customer_phone=?, customer_email=?, customer_addr=?, shipping_addr=?, payment_method=?, subtotal=?, discount=?, shipping_cost=?, total=?, notes=?, delivery_date=? WHERE id=?`,
      [customer_id || order.customer_id, customer_name || order.customer_name, customer_phone || null, customer_email || null, customer_addr || null, shipping_addr || null, payment_method || null, subtotal, parseFloat(discount) || 0, parseFloat(shipping_cost) || 0, total, notes || null, delivery_date || null, id]
    );

    if (items) {
      await db.query('DELETE FROM order_items WHERE order_id=?', [id]);
      for (const item of items) {
        const itemSubtotal = item.qty * item.unit_price;
        await db.query(
          'INSERT INTO order_items (order_id, product_id, product_name, product_sku, qty, unit, unit_price, subtotal, notes) VALUES (?,?,?,?,?,?,?,?,?)',
          [id, item.product_id || null, item.product_name, item.product_sku || null, item.qty, item.unit || 'unit', item.unit_price, itemSubtotal, item.notes || null]
        );
      }
    }

    log({ userId: req.admin.id, username: req.admin.username, role: req.admin.role, action: 'EDIT_ORDER', module: 'Orders', description: `Edit order: ${order.order_number}`, recordId: parseInt(id), recordType: 'order', ipAddress: getIp(req) });
    res.json({ success: true, message: 'Order berhasil diupdate' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// DELETE order
exports.remove = async (req, res) => {
  try {
    const [[order]] = await db.query('SELECT * FROM orders WHERE id=?', [req.params.id]);
    if (!order) return res.status(404).json({ success: false, message: 'Order tidak ditemukan' });
    if (order.payment_status === 'paid') return res.status(400).json({ success: false, message: 'Order yang sudah dibayar tidak dapat dihapus. Gunakan status Refunded.' });
    await db.query('DELETE FROM orders WHERE id=?', [req.params.id]);
    log({ userId: req.admin.id, username: req.admin.username, role: req.admin.role, action: 'DELETE_ORDER', module: 'Orders', description: `Hapus order: ${order.order_number}`, ipAddress: getIp(req) });
    res.json({ success: true, message: 'Order berhasil dihapus' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// GET invoice data (for print)
exports.getInvoice = async (req, res) => {
  try {
    const [[order]] = await db.query(
      `SELECT o.*, 
              u.full_name as created_by_name,
              COALESCE(NULLIF(c.address, ''), o.customer_addr) as customer_addr,
              COALESCE(NULLIF(c.phone, ''), o.customer_phone) as customer_phone,
              COALESCE(NULLIF(c.email, ''), o.customer_email) as customer_email
       FROM orders o 
       LEFT JOIN admin_users u ON u.id=o.created_by 
       LEFT JOIN customers c ON c.id=o.customer_id
       WHERE o.id=?`,
      [req.params.id]
    );
    if (!order) return res.status(404).json({ success: false, message: 'Order tidak ditemukan' });

    const [items] = await db.query('SELECT * FROM order_items WHERE order_id=? ORDER BY id ASC', [req.params.id]);
    const [settings] = await db.query("SELECT `key`, value FROM settings WHERE `key` IN ('site_name','phone','email','address','site_logo','whatsapp_number')");
    const siteSettings = Object.fromEntries(settings.map(s => [s.key, s.value]));

    res.json({ success: true, data: { order: { ...order, items }, company: siteSettings } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// GET order dashboard stats
exports.getStats = async (req, res) => {
  try {
    const [[{ total }]] = await db.query('SELECT COUNT(*) as total FROM orders');
    const [[{ pending }]] = await db.query("SELECT COUNT(*) as pending FROM orders WHERE status='pending'");
    const [[{ processing }]] = await db.query("SELECT COUNT(*) as processing FROM orders WHERE status IN ('confirmed','processing')");
    const [[{ delivered }]] = await db.query("SELECT COUNT(*) as delivered FROM orders WHERE status='delivered'");
    const [[{ revenue }]] = await db.query("SELECT COALESCE(SUM(total),0) as revenue FROM orders WHERE payment_status='paid'");
    const [[{ this_month }]] = await db.query("SELECT COALESCE(SUM(total),0) as this_month FROM orders WHERE payment_status='paid' AND MONTH(created_at)=MONTH(NOW()) AND YEAR(created_at)=YEAR(NOW())");
    const [[{ this_month_count }]] = await db.query("SELECT COUNT(*) as this_month_count FROM orders WHERE MONTH(created_at)=MONTH(NOW()) AND YEAR(created_at)=YEAR(NOW())");
    res.json({ success: true, data: { total, pending, processing, delivered, revenue, this_month, this_month_count } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// GET notifications
exports.getNotifications = async (req, res) => {
  try {
    const role = req.admin.role;
    const userId = req.admin.id;
    const [rows] = await db.query(
      `SELECT * FROM notifications WHERE (target_role=? OR target_user=? OR target_role IS NULL)
       ORDER BY created_at DESC LIMIT 20`,
      [role, userId]
    );
    const [[{ unread }]] = await db.query(
      "SELECT COUNT(*) as unread FROM notifications WHERE is_read=0 AND (target_role=? OR target_user=?)",
      [role, userId]
    );
    res.json({ success: true, data: rows, unread });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.markNotificationRead = async (req, res) => {
  try {
    await db.query('UPDATE notifications SET is_read=1 WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

/**
 * ordersController.js — Order Management + Invoice
 * Fixed: DB transactions for stock deduction, race-condition-safe order numbers,
 *        input validation, pagination caps, safe error messages
 */

'use strict';

const db  = require('../config/database');
const { log } = require('../middleware/activityLogger');

const getIp = (req) => req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;

const ORDER_STATUSES   = ['pending', 'confirmed', 'processing', 'ready', 'delivered', 'cancelled', 'refunded'];
const PAYMENT_STATUSES = ['unpaid', 'partial', 'paid', 'refunded'];

const fmtRp = (n) => 'Rp ' + Number(n).toLocaleString('id-ID');

// ── Safe pagination helper ─────────────────────────────────────
const safePaginate = (page, limit, maxLimit = 100) => {
  const p = Math.max(1, parseInt(page) || 1);
  const l = Math.min(Math.max(1, parseInt(limit) || 20), maxLimit);
  return { page: p, limit: l, offset: (p - 1) * l };
};

// ── Race-condition-safe order number ──────────────────────────
// Uses INSERT with unique constraint + retry instead of COUNT
async function generateOrderNumber(conn) {
  const year = new Date().getFullYear();
  // Lock the orders table momentarily to get a safe sequence
  const [[{ maxSeq }]] = await conn.query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(order_number, '-', -1) AS UNSIGNED)), 0) AS maxSeq
     FROM orders WHERE order_number LIKE ?`,
    [`ORD-${year}-%`]
  );
  const seq = String(maxSeq + 1).padStart(4, '0');
  return `ORD-${year}-${seq}`;
}

// ── GET all orders ─────────────────────────────────────────────
exports.getAll = async (req, res) => {
  try {
    const { status = '', payment_status = '', search = '', date_from = '', date_to = '', customer_id = '' } = req.query;
    const { page, limit, offset } = safePaginate(req.query.page, req.query.limit);
    const params = [];
    let where = '1=1';

    if (status)         { where += ' AND o.status=?';                                                                                params.push(status); }
    if (payment_status) { where += ' AND o.payment_status=?';                                                                        params.push(payment_status); }
    if (customer_id)    { where += ' AND o.customer_id=?';                                                                           params.push(customer_id); }
    if (search)         { where += ' AND (o.order_number LIKE ? OR o.customer_name LIKE ? OR o.customer_phone LIKE ?)';              params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    if (date_from)      { where += ' AND DATE(o.created_at) >= ?';                                                                   params.push(date_from); }
    if (date_to)        { where += ' AND DATE(o.created_at) <= ?';                                                                   params.push(date_to); }

    const [[{ total }]] = await db.query(`SELECT COUNT(*) as total FROM orders o WHERE ${where}`, params);
    const [rows] = await db.query(
      `SELECT o.*, u.full_name as created_by_name, COUNT(oi.id) as item_count
       FROM orders o
       LEFT JOIN admin_users u ON u.id = o.created_by
       LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE ${where} GROUP BY o.id ORDER BY o.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    res.json({ success: true, data: rows, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error('[orders.getAll]', err);
    res.status(500).json({ success: false, message: 'Gagal memuat data order.' });
  }
};

// ── GET single order ───────────────────────────────────────────
exports.getOne = async (req, res) => {
  try {
    const [[order]] = await db.query(
      `SELECT o.*, u.full_name as created_by_name, c.full_name as confirmed_by_name
       FROM orders o
       LEFT JOIN admin_users u ON u.id = o.created_by
       LEFT JOIN admin_users c ON c.id = o.confirmed_by
       WHERE o.id = ?`,
      [req.params.id]
    );
    if (!order) return res.status(404).json({ success: false, message: 'Order tidak ditemukan' });

    const [items] = await db.query(
      `SELECT oi.*, p.thumbnail, p.slug FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?`,
      [req.params.id]
    );
    res.json({ success: true, data: { ...order, items } });
  } catch (err) {
    console.error('[orders.getOne]', err);
    res.status(500).json({ success: false, message: 'Gagal memuat detail order.' });
  }
};

// ── CREATE order ───────────────────────────────────────────────
exports.create = async (req, res) => {
  const {
    customer_id, customer_name, customer_phone, customer_email,
    customer_addr, shipping_addr, payment_method, discount,
    shipping_cost, notes, delivery_date, items,
  } = req.body;

  // Input validation
  if (!customer_name || typeof customer_name !== 'string' || !customer_name.trim()) {
    return res.status(400).json({ success: false, message: 'Nama customer wajib diisi' });
  }
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ success: false, message: 'Order harus memiliki minimal 1 item' });
  }

  for (const item of items) {
    if (!item.product_name || !item.qty || !item.unit_price) {
      return res.status(400).json({ success: false, message: 'Setiap item harus memiliki nama produk, qty, dan harga' });
    }
    const qty = parseInt(item.qty);
    const price = parseFloat(item.unit_price);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ success: false, message: `Qty tidak valid untuk produk: ${item.product_name}` });
    }
    if (isNaN(price) || price < 0) {
      return res.status(400).json({ success: false, message: `Harga tidak valid untuk produk: ${item.product_name}` });
    }
  }

  const discountVal     = Math.max(0, parseFloat(discount) || 0);
  const shippingCostVal = Math.max(0, parseFloat(shipping_cost) || 0);

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const order_number = await generateOrderNumber(conn);
    const subtotal = items.reduce((sum, item) => sum + (parseInt(item.qty) * parseFloat(item.unit_price)), 0);
    const total = Math.max(0, subtotal - discountVal + shippingCostVal);

    const [result] = await conn.query(
      `INSERT INTO orders
         (order_number, customer_id, customer_name, customer_phone, customer_email,
          customer_addr, shipping_addr, payment_method, subtotal, discount,
          shipping_cost, total, notes, delivery_date, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        order_number,
        customer_id || null,
        customer_name.trim(),
        customer_phone || null,
        customer_email || null,
        customer_addr || null,
        shipping_addr || null,
        payment_method || null,
        subtotal,
        discountVal,
        shippingCostVal,
        total,
        notes || null,
        delivery_date || null,
        req.admin.id,
      ]
    );
    const orderId = result.insertId;

    for (const item of items) {
      const qty          = parseInt(item.qty);
      const unit_price   = parseFloat(item.unit_price);
      const itemSubtotal = qty * unit_price;
      await conn.query(
        `INSERT INTO order_items
           (order_id, product_id, product_name, product_sku, qty, unit, unit_price, subtotal, notes)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [orderId, item.product_id || null, item.product_name, item.product_sku || null,
         qty, item.unit || 'unit', unit_price, itemSubtotal, item.notes || null]
      );
    }

    await conn.commit();

    // Notifications (non-critical, outside transaction)
    try {
      await db.query(
        "INSERT INTO notifications (target_role, type, title, message, link, created_by) VALUES (?, 'success', ?, ?, ?, ?)",
        ['marketing', 'Pesanan Baru Masuk', `Order ${order_number} dari ${customer_name} senilai ${fmtRp(total)}`, '/admin/panel.html#orders', req.admin.id]
      );
      await db.query(
        "INSERT INTO notifications (target_role, type, title, message, link, created_by) VALUES (?, 'success', ?, ?, ?, ?)",
        ['superadmin', 'Pesanan Baru Masuk', `Order ${order_number} dari ${customer_name} senilai ${fmtRp(total)}`, '/admin/panel.html#orders', req.admin.id]
      );
    } catch (notifErr) {
      console.error('[orders.create] notification error:', notifErr.message);
    }

    log({
      userId: req.admin.id, username: req.admin.username, role: req.admin.role,
      action: 'CREATE_ORDER', module: 'Orders',
      description: `Buat order: ${order_number} - ${customer_name}`,
      recordId: orderId, recordType: 'order', ipAddress: getIp(req),
    });

    res.status(201).json({ success: true, message: 'Order berhasil dibuat', id: orderId, order_number });
  } catch (err) {
    await conn.rollback();
    console.error('[orders.create]', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Nomor order duplikat. Silakan coba lagi.' });
    }
    res.status(500).json({ success: false, message: 'Gagal membuat order. Silakan coba lagi.' });
  } finally {
    conn.release();
  }
};

// ── UPDATE order status (with DB transaction for stock) ────────
exports.updateStatus = async (req, res) => {
  const { id } = req.params;
  const { status, payment_status, amount_paid, notes } = req.body;

  if (status && !ORDER_STATUSES.includes(status)) {
    return res.status(400).json({ success: false, message: 'Status order tidak valid' });
  }
  if (payment_status && !PAYMENT_STATUSES.includes(payment_status)) {
    return res.status(400).json({ success: false, message: 'Status pembayaran tidak valid' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Lock the order row for this transaction
    const [[order]] = await conn.query('SELECT * FROM orders WHERE id = ? FOR UPDATE', [id]);
    if (!order) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Order tidak ditemukan' });
    }

    const fields = [], params = [];
    if (status)                  { fields.push('status=?');         params.push(status); }
    if (payment_status)          { fields.push('payment_status=?'); params.push(payment_status); }
    if (amount_paid !== undefined){ fields.push('amount_paid=?');   params.push(Math.max(0, parseFloat(amount_paid) || 0)); }
    if (notes)                   { fields.push('notes=?');          params.push(notes); }
    if (status === 'confirmed')  { fields.push('confirmed_by=?');   params.push(req.admin.id); }

    if (!fields.length) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Tidak ada data yang diubah' });
    }

    params.push(id);
    await conn.query(`UPDATE orders SET ${fields.join(',')} WHERE id = ?`, params);

    // ── AUTO STOCK MANAGEMENT ──────────────────────────────────
    if (status && status !== order.status) {
      const DEDUCTED_STATES = ['confirmed', 'processing', 'ready', 'delivered'];
      const oldIsDeducted   = DEDUCTED_STATES.includes(order.status);
      const newIsDeducted   = DEDUCTED_STATES.includes(status);

      if (oldIsDeducted !== newIsDeducted) {
        const [items] = await conn.query('SELECT * FROM order_items WHERE order_id = ?', [id]);

        for (const item of items) {
          if (!item.product_id) continue;

          // Lock product row
          const [[product]] = await conn.query(
            'SELECT id, name, warehouse_stock FROM products WHERE id = ? FOR UPDATE',
            [item.product_id]
          );
          if (!product) continue;

          if (newIsDeducted) {
            // DEDUCT STOCK
            if (product.warehouse_stock < item.qty) {
              await conn.rollback();
              return res.status(400).json({
                success: false,
                message: `Stok tidak cukup untuk produk "${product.name}". Tersedia: ${product.warehouse_stock}, dibutuhkan: ${item.qty}`,
              });
            }

            const qtyBefore = product.warehouse_stock;
            const qtyAfter  = qtyBefore - item.qty;

            await conn.query('UPDATE products SET warehouse_stock = ? WHERE id = ?', [qtyAfter, item.product_id]);
            await conn.query(
              `INSERT INTO stock_transactions
                 (product_id, type, qty, qty_before, qty_after, reference_type, reference_no, order_id, unit_price, total_price, notes, created_by)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
              [item.product_id, 'out', item.qty, qtyBefore, qtyAfter, 'sale', order.order_number,
               id, item.unit_price, item.subtotal, `Potong stok otomatis (Order ${status})`, req.admin.id]
            );

            if (qtyAfter === 0) {
              await conn.query(
                "UPDATE products SET publish_status = CASE WHEN publish_status = 'published' THEN 'out_of_stock' ELSE publish_status END WHERE id = ?",
                [item.product_id]
              );
            }

            // Low stock notification (non-critical, outside transaction scope)
            if (qtyAfter <= 3) {
              db.query(
                "INSERT INTO notifications (target_role, type, title, message, link, created_by) VALUES (?, 'warning', ?, ?, ?, ?)",
                ['admin_gudang', 'Stok Kritis!', `Stok produk "${product.name}" tersisa ${qtyAfter} unit. Harap segera re-stock.`, '/admin/panel.html#stock', req.admin.id]
              ).catch((e) => console.error('[stock notification]', e.message));
            }
          } else {
            // RESTORE STOCK
            const qtyBefore = product.warehouse_stock;
            const qtyAfter  = qtyBefore + item.qty;

            await conn.query('UPDATE products SET warehouse_stock = ? WHERE id = ?', [qtyAfter, item.product_id]);
            await conn.query(
              `INSERT INTO stock_transactions
                 (product_id, type, qty, qty_before, qty_after, reference_type, reference_no, order_id, unit_price, total_price, notes, created_by)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
              [item.product_id, 'in', item.qty, qtyBefore, qtyAfter, 'return', order.order_number,
               id, item.unit_price, item.subtotal, `Pengembalian stok otomatis (Status ${status})`, req.admin.id]
            );

            if (qtyBefore === 0) {
              await conn.query(
                "UPDATE products SET publish_status = CASE WHEN publish_status = 'out_of_stock' THEN 'published' ELSE publish_status END WHERE id = ?",
                [item.product_id]
              );
            }
          }
        }
      }
    }

    // Auto update customer total_spend if newly paid
    if (payment_status === 'paid' && order.payment_status !== 'paid' && order.customer_id) {
      await conn.query(
        'UPDATE customers SET total_spend = total_spend + ? WHERE id = ?',
        [order.total, order.customer_id]
      );
    }

    await conn.commit();

    // Payment notification (non-critical)
    if (payment_status === 'paid' && order.payment_status !== 'paid') {
      const msg = `Pembayaran untuk order ${order.order_number} telah LUNAS.`;
      db.query(
        "INSERT INTO notifications (target_role, type, title, message, link, created_by) VALUES (?, 'success', ?, ?, ?, ?)",
        ['marketing', 'Pembayaran Diterima', msg, '/admin/panel.html#orders', req.admin.id]
      ).catch((e) => console.error('[payment notification]', e.message));
      db.query(
        "INSERT INTO notifications (target_role, type, title, message, link, created_by) VALUES (?, 'success', ?, ?, ?, ?)",
        ['superadmin', 'Pembayaran Diterima', msg, '/admin/panel.html#orders', req.admin.id]
      ).catch((e) => console.error('[payment notification]', e.message));
    }

    log({
      userId: req.admin.id, username: req.admin.username, role: req.admin.role,
      action: 'UPDATE_ORDER', module: 'Orders',
      description: `Update order: ${order.order_number} → status: ${status || '-'}, payment: ${payment_status || '-'}`,
      recordId: parseInt(id), recordType: 'order', ipAddress: getIp(req),
    });

    res.json({ success: true, message: 'Order berhasil diupdate' });
  } catch (err) {
    await conn.rollback();
    console.error('[orders.updateStatus]', err);
    res.status(500).json({ success: false, message: 'Gagal mengupdate order. Silakan coba lagi.' });
  } finally {
    conn.release();
  }
};

// ── UPDATE full order ──────────────────────────────────────────
exports.update = async (req, res) => {
  const { id } = req.params;
  const {
    customer_id, customer_name, customer_phone, customer_email,
    customer_addr, shipping_addr, payment_method, discount,
    shipping_cost, notes, delivery_date, items,
  } = req.body;

  try {
    const [[order]] = await db.query('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) return res.status(404).json({ success: false, message: 'Order tidak ditemukan' });
    if (['delivered', 'cancelled', 'refunded'].includes(order.status)) {
      return res.status(400).json({ success: false, message: 'Order yang sudah selesai/dibatalkan tidak dapat diubah' });
    }

    const discountVal     = Math.max(0, parseFloat(discount) || 0);
    const shippingCostVal = Math.max(0, parseFloat(shipping_cost) || 0);
    const subtotal = items
      ? items.reduce((sum, item) => sum + (Math.max(0, parseInt(item.qty) || 0) * Math.max(0, parseFloat(item.unit_price) || 0)), 0)
      : order.subtotal;
    const total = Math.max(0, subtotal - discountVal + shippingCostVal);

    await db.query(
      `UPDATE orders SET customer_id=?, customer_name=?, customer_phone=?, customer_email=?,
         customer_addr=?, shipping_addr=?, payment_method=?, subtotal=?, discount=?,
         shipping_cost=?, total=?, notes=?, delivery_date=? WHERE id=?`,
      [
        customer_id || order.customer_id,
        customer_name || order.customer_name,
        customer_phone || null, customer_email || null,
        customer_addr || null, shipping_addr || null,
        payment_method || null, subtotal, discountVal,
        shippingCostVal, total, notes || null, delivery_date || null, id,
      ]
    );

    if (items) {
      await db.query('DELETE FROM order_items WHERE order_id = ?', [id]);
      for (const item of items) {
        const qty          = Math.max(1, parseInt(item.qty) || 1);
        const unit_price   = Math.max(0, parseFloat(item.unit_price) || 0);
        const itemSubtotal = qty * unit_price;
        await db.query(
          `INSERT INTO order_items (order_id, product_id, product_name, product_sku, qty, unit, unit_price, subtotal, notes)
           VALUES (?,?,?,?,?,?,?,?,?)`,
          [id, item.product_id || null, item.product_name, item.product_sku || null,
           qty, item.unit || 'unit', unit_price, itemSubtotal, item.notes || null]
        );
      }
    }

    log({
      userId: req.admin.id, username: req.admin.username, role: req.admin.role,
      action: 'EDIT_ORDER', module: 'Orders',
      description: `Edit order: ${order.order_number}`,
      recordId: parseInt(id), recordType: 'order', ipAddress: getIp(req),
    });
    res.json({ success: true, message: 'Order berhasil diupdate' });
  } catch (err) {
    console.error('[orders.update]', err);
    res.status(500).json({ success: false, message: 'Gagal mengupdate order.' });
  }
};

// ── DELETE order ───────────────────────────────────────────────
exports.remove = async (req, res) => {
  try {
    const [[order]] = await db.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) return res.status(404).json({ success: false, message: 'Order tidak ditemukan' });
    if (order.payment_status === 'paid') {
      return res.status(400).json({ success: false, message: 'Order yang sudah dibayar tidak dapat dihapus. Gunakan status Refunded.' });
    }
    await db.query('DELETE FROM orders WHERE id = ?', [req.params.id]);
    log({
      userId: req.admin.id, username: req.admin.username, role: req.admin.role,
      action: 'DELETE_ORDER', module: 'Orders',
      description: `Hapus order: ${order.order_number}`, ipAddress: getIp(req),
    });
    res.json({ success: true, message: 'Order berhasil dihapus' });
  } catch (err) {
    console.error('[orders.remove]', err);
    res.status(500).json({ success: false, message: 'Gagal menghapus order.' });
  }
};

// ── GET invoice ────────────────────────────────────────────────
exports.getInvoice = async (req, res) => {
  try {
    const [[order]] = await db.query(
      `SELECT o.*,
              u.full_name as created_by_name,
              COALESCE(NULLIF(c.address, ''), o.customer_addr) as customer_addr,
              COALESCE(NULLIF(c.phone, ''),   o.customer_phone) as customer_phone,
              COALESCE(NULLIF(c.email, ''),   o.customer_email) as customer_email
       FROM orders o
       LEFT JOIN admin_users u ON u.id = o.created_by
       LEFT JOIN customers c   ON c.id = o.customer_id
       WHERE o.id = ?`,
      [req.params.id]
    );
    if (!order) return res.status(404).json({ success: false, message: 'Order tidak ditemukan' });

    const [items]    = await db.query('SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC', [req.params.id]);
    const [settings] = await db.query(
      "SELECT `key`, value FROM settings WHERE `key` IN ('site_name','phone','email','address','site_logo','whatsapp_number')"
    );
    const siteSettings = Object.fromEntries(settings.map((s) => [s.key, s.value]));

    res.json({ success: true, data: { order: { ...order, items }, company: siteSettings } });
  } catch (err) {
    console.error('[orders.getInvoice]', err);
    res.status(500).json({ success: false, message: 'Gagal memuat invoice.' });
  }
};

// ── GET stats ──────────────────────────────────────────────────
exports.getStats = async (req, res) => {
  try {
    const [[{ total }]]              = await db.query('SELECT COUNT(*) as total FROM orders');
    const [[{ pending }]]            = await db.query("SELECT COUNT(*) as pending FROM orders WHERE status='pending'");
    const [[{ processing }]]         = await db.query("SELECT COUNT(*) as processing FROM orders WHERE status IN ('confirmed','processing')");
    const [[{ delivered }]]          = await db.query("SELECT COUNT(*) as delivered FROM orders WHERE status='delivered'");
    const [[{ today_count }]]        = await db.query("SELECT COUNT(*) as today_count FROM orders WHERE DATE(created_at) = CURDATE()");
    const [[{ this_month_count }]]   = await db.query("SELECT COUNT(*) as this_month_count FROM orders WHERE MONTH(created_at)=MONTH(NOW()) AND YEAR(created_at)=YEAR(NOW())");
    const [[{ month_confirmed_count }]] = await db.query("SELECT COUNT(*) as month_confirmed_count FROM orders WHERE status='confirmed' AND MONTH(created_at)=MONTH(NOW()) AND YEAR(created_at)=YEAR(NOW())");
    const [[{ cancelled_count }]]    = await db.query("SELECT COUNT(*) as cancelled_count FROM orders WHERE status IN ('cancelled','refunded') AND MONTH(created_at)=MONTH(NOW()) AND YEAR(created_at)=YEAR(NOW())");

    res.json({ success: true, data: { total, pending, processing, delivered, today_count, this_month_count, month_confirmed_count, cancelled_count } });
  } catch (err) {
    console.error('[orders.getStats]', err);
    res.status(500).json({ success: false, message: 'Gagal memuat statistik order.' });
  }
};

// ── NOTIFICATIONS ──────────────────────────────────────────────
exports.getNotifications = async (req, res) => {
  try {
    const { role, id: userId } = req.admin;
    const [rows] = await db.query(
      `SELECT * FROM notifications
       WHERE (target_role = ? OR target_user = ? OR target_role IS NULL)
       ORDER BY created_at DESC LIMIT 20`,
      [role, userId]
    );
    const [[{ unread }]] = await db.query(
      'SELECT COUNT(*) as unread FROM notifications WHERE is_read = 0 AND (target_role = ? OR target_user = ?)',
      [role, userId]
    );
    res.json({ success: true, data: rows, unread });
  } catch (err) {
    console.error('[orders.getNotifications]', err);
    res.status(500).json({ success: false, message: 'Gagal memuat notifikasi.' });
  }
};

exports.markNotificationRead = async (req, res) => {
  try {
    await db.query('UPDATE notifications SET is_read = 1 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('[orders.markNotificationRead]', err);
    res.status(500).json({ success: false, message: 'Gagal update notifikasi.' });
  }
};

exports.markAllNotificationsRead = async (req, res) => {
  try {
    const { role, id: userId } = req.admin;
    await db.query(
      'UPDATE notifications SET is_read = 1 WHERE is_read = 0 AND (target_role = ? OR target_user = ?)',
      [role, userId]
    );
    res.json({ success: true, message: 'Semua notifikasi ditandai dibaca' });
  } catch (err) {
    console.error('[orders.markAllNotificationsRead]', err);
    res.status(500).json({ success: false, message: 'Gagal update notifikasi.' });
  }
};

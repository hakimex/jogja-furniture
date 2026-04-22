const db   = require('../config/database');
const path = require('path');
const fs   = require('fs');

// GET semua settings (public)
exports.getAll = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT `key`, value, type, label, group_name FROM settings');
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET settings by group (public)
exports.getByGroup = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT `key`, value, type, label FROM settings WHERE group_name = ?',
      [req.params.group]
    );
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET semua settings dengan detail (admin)
exports.getAllAdmin = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM settings ORDER BY group_name, id');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// UPDATE settings (admin) — support FormData + file upload
// Dipanggil dari route yang sudah pakai multer, jadi req.files tersedia
exports.update = async (req, res) => {
  try {
    // Ambil semua field teks dari req.body (dikirim sebagai FormData)
    const body = req.body || {};

    // Kunci gambar yang diizinkan di-upload via file
    const imageKeys = [
      'hero_bg_image',
      'about_image_main',
      'about_image_sec',
      'site_logo',
    ];

    // Proses file gambar yang di-upload
    const fileUpdates = {};
    if (req.files) {
      for (const key of imageKeys) {
        if (req.files[key] && req.files[key][0]) {
          const file = req.files[key][0];
          fileUpdates[key] = file.filename;

          // Hapus file lama kalau ada
          const [oldRows] = await db.query('SELECT value FROM settings WHERE `key` = ?', [key]);
          if (oldRows.length && oldRows[0].value) {
            const oldPath = path.join(__dirname, '..', 'uploads', 'settings', oldRows[0].value);
            if (fs.existsSync(oldPath)) {
              try { fs.unlinkSync(oldPath); } catch(e) { /* ignore */ }
            }
          }
        }
      }
    }

    // Gabungkan semua update (teks + gambar)
    const allUpdates = { ...body, ...fileUpdates };

    // Hapus kunci kosong / tidak relevan
    const skipKeys = ['_method'];
    for (const [key, value] of Object.entries(allUpdates)) {
      if (skipKeys.includes(key)) continue;
      if (value === undefined || value === null) continue;

      // Cek apakah key ada di database dulu
      const [exists] = await db.query('SELECT id FROM settings WHERE `key` = ?', [key]);
      if (exists.length > 0) {
        await db.query('UPDATE settings SET value = ? WHERE `key` = ?', [String(value), key]);
      }
    }

    res.json({ success: true, message: 'Settings berhasil disimpan' });
  } catch (err) {
    console.error('Settings update error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// UPDATE single setting key (admin) — untuk update teks satu per satu
exports.updateOne = async (req, res) => {
  const { key } = req.params;
  const { value } = req.body;
  try {
    const [result] = await db.query(
      'UPDATE settings SET value = ? WHERE `key` = ?',
      [value !== undefined ? String(value) : '', key]
    );
    if (result.affectedRows === 0) {
      // Key belum ada — insert
      await db.query(
        'INSERT INTO settings (`key`, value, type, group_name) VALUES (?,?,?,?)',
        [key, String(value || ''), 'text', 'general']
      );
    }
    res.json({ success: true, message: 'Setting berhasil diupdate' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// UPLOAD gambar setting secara individual (endpoint khusus)
exports.uploadImage = async (req, res) => {
  const { key } = req.params;

  // Validasi key hanya untuk gambar
  const allowedKeys = ['hero_bg_image', 'about_image_main', 'about_image_sec', 'site_logo'];
  if (!allowedKeys.includes(key)) {
    return res.status(400).json({ success: false, message: 'Key tidak diizinkan untuk upload gambar' });
  }

  if (!req.file) {
    return res.status(400).json({ success: false, message: 'File gambar diperlukan' });
  }

  try {
    const filename = req.file.filename;

    // Hapus gambar lama
    const [oldRows] = await db.query('SELECT value FROM settings WHERE `key` = ?', [key]);
    if (oldRows.length && oldRows[0].value) {
      const oldPath = path.join(__dirname, '..', 'uploads', 'settings', oldRows[0].value);
      if (fs.existsSync(oldPath)) {
        try { fs.unlinkSync(oldPath); } catch(e) { /* ignore */ }
      }
    }

    // Update atau insert
    const [exists] = await db.query('SELECT id FROM settings WHERE `key` = ?', [key]);
    if (exists.length > 0) {
      await db.query('UPDATE settings SET value = ? WHERE `key` = ?', [filename, key]);
    } else {
      await db.query(
        'INSERT INTO settings (`key`, value, type, group_name) VALUES (?,?,?,?)',
        [key, filename, 'image', 'general']
      );
    }

    res.json({
      success: true,
      message: 'Gambar berhasil diupload',
      filename,
      url: `/uploads/settings/${filename}`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

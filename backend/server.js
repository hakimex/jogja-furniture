require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');

const app = express();

// ── Ensure upload directories ──────────────────────────────────
// Penting: Folder ini akan reset tiap deploy di Railway kecuali pakai Volume
const uploadDirs = ['products', 'services', 'categories', 'settings', 'banners'];
uploadDirs.forEach(dir => {
  const p = path.join(__dirname, 'uploads', dir);
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true });
  }
});

// ── CORS (Konfigurasi untuk Production & Local) ────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:5000',
  'http://localhost:5500',
  'http://127.0.0.1:5500'
];

app.use(cors({
  origin: function (origin, callback) {
    // Izinkan jika tidak ada origin (seperti mobile apps atau curl)
    if (!origin) return callback(null, true);
    
    // Di mode development, izinkan semua
    if (process.env.NODE_ENV !== 'production') return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.error(`CORS Blocked: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ── Body parsers ───────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Static files ───────────────────────────────────────────────
// Melayani file hasil upload
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { maxAge: '7d', etag: true }));

// Melayani frontend statis (sesuaikan struktur folder project kamu)
app.use(express.static(path.join(__dirname, '..', 'frontend')));
app.use('/admin', express.static(path.join(__dirname, '..', 'admin')));

// ── API Routes ─────────────────────────────────────────────────
// Pastikan file routes ini sudah menggunakan koneksi MySQL Aiven kamu
app.use('/api', require('./routes/public'));
app.use('/api/admin', require('./routes/admin'));

// ── Health check (Sangat penting untuk Railway) ───────────────
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Jogja Furniture Enterprise API v2 🪵',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

// ── SPA Fallbacks ──────────────────────────────────────────────
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'admin', 'index.html'));
});

app.get('*', (req, res) => {
  // Jika bukan request API atau Uploads, arahkan ke frontend (React/HTML)
  if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
    const frontendIndex = path.join(__dirname, '..', 'frontend', 'index.html');
    if (fs.existsSync(frontendIndex)) {
      res.sendFile(frontendIndex);
    } else {
      res.status(404).send('Frontend build not found');
    }
  }
});

// ── Global Error Handler ───────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Error Log:', err.stack);
  
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, message: 'Ukuran file terlalu besar (maks 5MB)' });
  }
  
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
  });
});

// ── Listen Server (Fix untuk Railway) ──────────────────────────
const PORT = process.env.PORT || 5000;

// '0.0.0.0' wajib ada agar Railway bisa meneruskan traffic ke aplikasi
app.listen(PORT, '0.0.0.0', () => {
  console.log('================================================');
  console.log(`🚀 JOGJA FURNITURE SERVER IS LIVE!`);
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌍 Env:  ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health: http://0.0.0.0:${PORT}/api/health`);
  console.log('================================================');
});

module.exports = app;

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');

const app = express();

// ── Ensure upload directories ──────────────────────────────────
const uploadDirs = ['products', 'services', 'categories', 'settings', 'banners'];
uploadDirs.forEach(dir => {
  const p = path.join(__dirname, 'uploads', dir);
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true });
  }
});

// ── CORS Configuration (Fix for Railway) ───────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL, 
  'https://jogja-furniture-production.up.railway.app',
  'http://localhost:3000',
  'http://localhost:5000',
  'http://localhost:5500'
];

app.use(cors({
  origin: function (origin, callback) {
    // 1. Izinkan jika tidak ada origin (seperti pengecekan API langsung atau mobile apps)
    if (!origin) return callback(null, true);

    // 2. Bersihkan origin dari trailing slash untuk pencocokan yang akurat
    const cleanedOrigin = origin.replace(/\/$/, "");

    // 3. Cek apakah origin ada di daftar atau merupakan subdomain railway
    const isAllowed = allowedOrigins.some(allowed => {
      if (!allowed) return false;
      return cleanedOrigin === allowed.replace(/\/$/, "");
    });

    if (isAllowed || origin.includes('railway.app')) {
      callback(null, true);
    } else {
      console.error(`❌ CORS Blocked: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

// Handle Preflight Request secara eksplisit
app.options('*', cors());

// ── Body parsers ───────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Static files ───────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { maxAge: '7d', etag: true }));
app.use(express.static(path.join(__dirname, '..', 'frontend')));
app.use('/admin', express.static(path.join(__dirname, '..', 'admin')));

// ── API Routes ─────────────────────────────────────────────────
app.use('/api', require('./routes/public'));
app.use('/api/admin', require('./routes/admin'));

app.get('/api/reset-pw-sekali', async (req, res) => {
  const bcrypt = require('bcryptjs');
  const db = require('./config/database');
  const hash = await bcrypt.hash('Admin1234!', 10);
  await db.query('UPDATE admin_users SET password=? WHERE username=?', [hash, 'superadmin']);
  res.send('✅ Password direset!');
});

// ── Health check ───────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Jogja Furniture Enterprise API v2 🪵',
    environment: process.env.NODE_ENV || 'production',
    timestamp: new Date().toISOString(),
  });
});

// ── SPA Fallbacks ──────────────────────────────────────────────
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'admin', 'index.html'));
});

app.get('*', (req, res) => {
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
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ success: false, message: 'CORS Policy Block' });
  }
  
  console.error('❌ Error Log:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
  });
});

// ── Listen Server ──────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('================================================');
  console.log(`🚀 JOGJA FURNITURE LIVE ON PORT ${PORT}`);
  console.log('================================================');
});

module.exports = app;

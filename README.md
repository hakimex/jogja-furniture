# 🪵 Jogja Furniture Decoration — Web App v2.0

Website + Admin Panel + WMS untuk toko furniture.  
**Stack**: Node.js · Express · MySQL (Aiven) · Railway

---

## 📁 Struktur Proyek

```
jogja-furniture-v2/
├── backend/
│   ├── config/database.js   # Koneksi MySQL + SSL Aiven
│   ├── controllers/         # Logic bisnis
│   ├── middleware/           # Auth JWT, upload, role
│   ├── routes/               # API routes
│   ├── uploads/              # Folder gambar upload
│   ├── .env.example          # Template environment
│   ├── database_v2.sql       # Schema MySQL (import sekali)
│   └── server.js             # Entry point
├── frontend/                 # Website publik
├── admin/                    # Panel admin
└── railway.toml              # Konfigurasi Railway deploy
```

---

## 🚀 Deploy ke Railway + Aiven MySQL

### Langkah 1 — Setup Database di Aiven

1. Buka [console.aiven.io](https://console.aiven.io) → buat service **MySQL**
2. Tunggu status **Running**
3. Klik service → tab **Connection Information**, catat:
   - `Host`, `Port`, `User`, `Password`
4. Buka tab **Databases** → klik **Create Database** → nama: `jogja_furniture`
5. Import schema:
   - Buka **Query Editor** di Aiven Console, atau gunakan DBeaver/TablePlus
   - Paste isi file `backend/database_v2.sql` → jalankan

### Langkah 2 — Deploy ke Railway

```bash
# Install Railway CLI (jika belum)
npm install -g @railway/cli

# Login
railway login

# Buat project baru
railway init

# Deploy
railway up
```

Atau pakai **GitHub**: Connect repo di [railway.app](https://railway.app) → auto deploy saat push.

### Langkah 3 — Set Environment Variables di Railway

Buka Railway Dashboard → project kamu → tab **Variables**, isi semua ini:

| Variable | Nilai |
|----------|-------|
| `NODE_ENV` | `production` |
| `PORT` | `5000` |
| `DB_HOST` | Host dari Aiven (contoh: `mysql-xxxx.aivencloud.com`) |
| `DB_PORT` | Port dari Aiven (contoh: `24518`) |
| `DB_USER` | `avnadmin` (atau user Aiven kamu) |
| `DB_PASSWORD` | Password dari Aiven |
| `DB_NAME` | `jogja_furniture` |
| `DB_SSL` | `true` ← **wajib untuk Aiven** |
| `JWT_SECRET` | String random 64+ karakter (lihat cara generate di bawah) |
| `JWT_EXPIRES_IN` | `7d` |
| `MAX_FILE_SIZE` | `5242880` |
| `FRONTEND_URL` | URL Railway kamu, contoh: `https://jogja-furniture.up.railway.app` |

**Generate JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Langkah 4 — Setup Akun Admin

Setelah deploy berhasil, jalankan di Railway Shell atau lokal (dengan .env yang sudah diisi):

```bash
cd backend
node setup-admin.js
```

Lalu login ke `/admin` dan **segera ganti password** dari default `admin123`.

---

## 🌐 URL Setelah Deploy

| URL | Keterangan |
|-----|------------|
| `https://domain.railway.app/` | Website publik |
| `https://domain.railway.app/admin` | Panel admin |
| `https://domain.railway.app/api/health` | Health check |

---

## ⚠️ Checklist Go-Live

- [ ] Schema SQL sudah diimport ke Aiven
- [ ] Semua env variable sudah diset di Railway
- [ ] `DB_SSL=true` sudah diset (wajib untuk Aiven)
- [ ] `NODE_ENV=production` sudah diset
- [ ] `JWT_SECRET` sudah diganti dengan string random baru
- [ ] `FRONTEND_URL` sudah diisi URL Railway yang benar
- [ ] Deploy berhasil — cek `/api/health` return OK
- [ ] Jalankan `setup-admin.js` → ganti password admin
- [ ] File `backend/init-db.js` dihapus (tidak dipakai di production)

---

## 🔑 Roles Admin

| Role | Akses |
|------|-------|
| `superadmin` | Full access |
| `admin_website` | CMS, produk, layanan |
| `admin_gudang` | Warehouse, stok |
| `marketing` | Pesanan, laporan |

---

## 🛠️ Jalankan Lokal (Development)

```bash
cd backend
npm install
cp .env.example .env
# Edit .env sesuai konfigurasi lokal
npm run dev
```

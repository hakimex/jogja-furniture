# 🪵 Jogja Furniture Decoration — Enterprise System v2.1

Sistem manajemen bisnis furnitur full-stack berbasis web. Mencakup website publik, admin panel multi-role, manajemen gudang (WMS), CMS, dan sistem order terintegrasi.

---

## 📋 Daftar Isi

- [Tech Stack](#tech-stack)
- [Fitur Utama](#fitur-utama)
- [Sistem Role](#sistem-role)
- [Struktur Proyek](#struktur-proyek)
- [Instalasi](#instalasi)
- [Konfigurasi Environment](#konfigurasi-environment)
- [Database Setup](#database-setup)
- [Menjalankan Aplikasi](#menjalankan-aplikasi)
- [API Endpoints](#api-endpoints)
- [Keamanan](#keamanan)
- [Deploy ke Production](#deploy-ke-production)
- [🚀 Go-Live di Hostinger](#-go-live-di-hostinger)
  - [Opsi A — Shared/Cloud Hosting (Mudah)](#opsi-a--sharedcloud-hosting-mudah)
  - [Opsi B — VPS Hostinger (Recommended)](#opsi-b--vps-hostinger-recommended)
- [Troubleshooting](#troubleshooting)

---

## Tech Stack

| Layer | Teknologi |
|---|---|
| Backend | Node.js 18+, Express.js 4 |
| Database | MySQL 8.0+ |
| Auth | JWT (jsonwebtoken), bcryptjs |
| File Upload | Multer |
| Security | Helmet, express-rate-limit |
| Frontend | Vanilla JS, HTML5, CSS3 |
| Admin Panel | Vanilla JS SPA |

---

## Fitur Utama

### Website Publik
- Katalog produk dengan filter kategori dan pagination
- Halaman detail produk dengan galeri foto
- Halaman layanan
- Testimonial pelanggan
- Form kontak
- Integrasi WhatsApp
- Fully responsive (mobile-first)

### Admin Panel
- Dashboard statistik real-time
- Manajemen produk dengan publish workflow
- CMS konten website (hero, about, settings)
- Manajemen order + invoice cetak
- Manajemen stok gudang (barang masuk/keluar)
- Manajemen supplier dan customer
- Sistem notifikasi real-time
- Activity log audit trail
- Manajemen user multi-role

---

## Sistem Role

Sistem menggunakan 4 role dengan hak akses berbeda:

### 1. `superadmin` — Super Administrator
Akses penuh ke semua fitur sistem.
- ✅ Control Center (statistik global, monitoring)
- ✅ Manajemen user (buat, edit, hapus, force logout)
- ✅ Semua fitur admin_gudang
- ✅ Semua fitur admin_website
- ✅ Semua fitur marketing
- ✅ Hapus kategori, hapus order

### 2. `admin_gudang` — Admin Gudang / Warehouse
Fokus pada operasional gudang dan stok.
- ✅ Input produk baru (data gudang: SKU, stok, harga modal)
- ✅ Manajemen stok (barang masuk, keluar, adjustment)
- ✅ Manajemen supplier
- ✅ Lihat dan kelola order
- ✅ Manajemen customer
- ❌ Edit konten website / publish produk
- ❌ Manajemen user
- ❌ Settings website

### 3. `admin_website` — Admin Website / CMS
Fokus pada konten dan tampilan website.
- ✅ Edit konten produk (deskripsi, foto, SEO)
- ✅ Publish / unpublish produk
- ✅ Manajemen kategori
- ✅ Manajemen layanan dan testimonial
- ✅ Manajemen kontak masuk
- ✅ Settings website (logo, hero, about)
- ❌ Lihat harga modal / data gudang
- ❌ Manajemen stok
- ❌ Manajemen user

### 4. `marketing` — Marketing / Sales
Fokus pada penjualan dan hubungan pelanggan.
- ✅ Buat dan kelola order
- ✅ Manajemen customer
- ✅ Lihat laporan order
- ✅ Lihat produk (published only)
- ❌ Edit produk / stok
- ❌ Settings website
- ❌ Manajemen user

---

## Struktur Proyek

```
jogja-furniture/
├── backend/                    # Node.js API Server
│   ├── config/
│   │   └── database.js         # MySQL connection pool
│   ├── controllers/            # Business logic
│   │   ├── authController.js
│   │   ├── categoriesController.js
│   │   ├── ordersController.js
│   │   ├── productsController.js
│   │   ├── servicesController.js
│   │   ├── settingsController.js
│   │   ├── testimonialsController.js
│   │   ├── usersController.js
│   │   └── warehouseController.js
│   ├── middleware/
│   │   ├── activityLogger.js   # Audit trail
│   │   ├── auth.js             # JWT + active user check
│   │   ├── roleCheck.js        # RBAC middleware
│   │   └── upload.js           # Multer file upload
│   ├── routes/
│   │   ├── admin.js            # Protected admin routes
│   │   └── public.js           # Public API routes
│   ├── scripts/
│   │   └── generate-passwords.js
│   ├── uploads/                # File uploads (gitignored)
│   ├── .env                    # Environment config (buat dari .env.example)
│   ├── .env.example            # Template environment
│   ├── database_v2.sql         # Database schema + seed data
│   ├── package.json
│   └── server.js               # Entry point
│
├── frontend/                   # Website publik
│   ├── css/main.css
│   ├── js/
│   │   ├── api.js              # API helper
│   │   └── main.js             # Main frontend logic
│   ├── index.html
│   ├── collections.html
│   ├── product.html
│   └── service.html
│
├── admin/                      # Admin panel SPA
│   ├── css/admin.css
│   ├── js/
│   │   ├── admin.js            # Main admin logic
│   │   └── login.js            # Login handler
│   ├── index.html              # Login page
│   └── panel.html              # Admin panel
│
└── README.md
```

---

## Instalasi

### Prasyarat
- Node.js 18 atau lebih baru
- MySQL 8.0 atau lebih baru
- npm 9+

### Langkah Instalasi

**1. Clone / ekstrak project**
```bash
# Jika dari ZIP, ekstrak ke folder pilihan Anda
```

**2. Install dependencies backend**
```bash
cd backend
npm install
```

**3. Konfigurasi environment**
```bash
cp .env.example .env
# Edit .env dengan text editor, isi semua nilai
```

**4. Setup database**
```bash
# Via MySQL CLI:
mysql -u root -p < database_v2.sql

# Atau via phpMyAdmin:
# Import file backend/database_v2.sql
```

**5. Jalankan server**
```bash
# Development (dengan auto-reload):
npm run dev

# Production:
npm start
```

**6. Akses aplikasi**
- Website: http://localhost:5000
- Admin Panel: http://localhost:5000/admin
- API: http://localhost:5000/api

---

## Konfigurasi Environment

Buat file `backend/.env` dari template `backend/.env.example`:

```env
# Server
PORT=5000
NODE_ENV=production

# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=jogja_furniture

# JWT — WAJIB diganti dengan string random panjang
# Generate: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=your_very_long_random_secret_minimum_64_characters
JWT_EXPIRES_IN=8h

# Upload
MAX_FILE_SIZE=5242880

# CORS — URL frontend production Anda
FRONTEND_URL=https://yourdomain.com
```

> ⚠️ **PENTING**: `JWT_SECRET` harus diganti dengan string random yang kuat. Jangan gunakan nilai default.

---

## Database Setup

### Schema
File `backend/database_v2.sql` berisi:
- Semua tabel dengan foreign keys dan indexes
- Seed data: 4 admin user, settings default, kategori, supplier, customer

### Akun Default

| Username | Password | Role |
|---|---|---|
| `superadmin` | `SuperAdmin@2024!` | superadmin |
| `gudang01` | `Gudang@2024!` | admin_gudang |
| `website01` | `Website@2024!` | admin_website |
| `marketing01` | `Marketing@2024!` | marketing |

> ⚠️ **WAJIB**: Ganti semua password setelah pertama kali login melalui Admin Panel → Profile → Ganti Password.

### Generate Password Hash Baru
```bash
cd backend
node scripts/generate-passwords.js
```

---

## Menjalankan Aplikasi

### Development
```bash
cd backend
npm run dev
```

### Production dengan PM2
```bash
# Install PM2 globally
npm install -g pm2

# Start aplikasi
cd backend
pm2 start server.js --name "jogja-furniture"

# Auto-start saat server reboot
pm2 startup
pm2 save

# Monitor
pm2 status
pm2 logs jogja-furniture
```

### Production dengan systemd (Linux)
```ini
# /etc/systemd/system/jogja-furniture.service
[Unit]
Description=Jogja Furniture API
After=network.target mysql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/jogja-furniture/backend
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10
EnvironmentFile=/var/www/jogja-furniture/backend/.env

[Install]
WantedBy=multi-user.target
```

---

## API Endpoints

### Public API (`/api`)

| Method | Endpoint | Deskripsi |
|---|---|---|
| GET | `/api/health` | Health check + DB status |
| GET | `/api/settings` | Settings website (public keys only) |
| GET | `/api/categories` | Semua kategori aktif |
| GET | `/api/products` | Produk published (dengan filter & pagination) |
| GET | `/api/products/featured` | Produk unggulan |
| GET | `/api/products/:slug` | Detail produk |
| GET | `/api/services` | Semua layanan aktif |
| GET | `/api/services/:slug` | Detail layanan |
| GET | `/api/testimonials` | Testimonial aktif |
| POST | `/api/contact` | Kirim pesan kontak |

### Admin API (`/api/admin`) — Memerlukan JWT Token

**Auth**
| Method | Endpoint | Role |
|---|---|---|
| POST | `/api/admin/login` | Public (rate limited: 10x/15min) |
| GET | `/api/admin/profile` | Semua role |
| PUT | `/api/admin/change-password` | Semua role |
| GET | `/api/admin/dashboard` | Semua role |

**Users** (superadmin only)
| Method | Endpoint |
|---|---|
| GET | `/api/admin/users` |
| POST | `/api/admin/users` |
| PUT | `/api/admin/users/:id` |
| DELETE | `/api/admin/users/:id` |
| POST | `/api/admin/users/:id/reset-password` |
| POST | `/api/admin/users/:id/toggle-active` |
| POST | `/api/admin/users/:id/force-logout` |

**Products**
| Method | Endpoint | Role |
|---|---|---|
| GET | `/api/admin/products` | Semua role |
| POST | `/api/admin/products` | admin_gudang, superadmin |
| PUT | `/api/admin/products/:id` | admin_gudang, superadmin |
| PUT | `/api/admin/products/:id/cms` | admin_website, superadmin |
| PUT | `/api/admin/products/:id/publish` | admin_website, superadmin |
| DELETE | `/api/admin/products/:id` | admin_gudang, superadmin |

**Orders**
| Method | Endpoint | Role |
|---|---|---|
| GET | `/api/admin/orders` | Semua role |
| POST | `/api/admin/orders` | admin_gudang, marketing, superadmin |
| PUT | `/api/admin/orders/:id/status` | admin_gudang, marketing, superadmin |
| DELETE | `/api/admin/orders/:id` | admin_gudang, superadmin |

**Stock** (admin_gudang, superadmin)
| Method | Endpoint |
|---|---|
| GET | `/api/admin/stock/transactions` |
| POST | `/api/admin/stock/in` |
| POST | `/api/admin/stock/out` |
| POST | `/api/admin/stock/adjustment` |
| GET | `/api/admin/stock/summary` |

---

## Keamanan

Fitur keamanan yang sudah diimplementasikan:

| Fitur | Status | Detail |
|---|---|---|
| Helmet.js security headers | ✅ | X-Frame-Options, X-Content-Type-Options, dll |
| Rate limiting login | ✅ | Max 10 percobaan / 15 menit |
| Rate limiting global | ✅ | Max 500 req / 15 menit per IP |
| JWT authentication | ✅ | Token 8 jam, secret minimal 32 char |
| Active user check | ✅ | Setiap request cek is_active di DB |
| Bcrypt password | ✅ | Cost factor 12 |
| RBAC | ✅ | 4 role dengan permission granular |
| SQL injection protection | ✅ | Parameterized queries |
| File upload validation | ✅ | MIME type + ekstensi |
| DB transaction stock | ✅ | Atomic stock deduction |
| Error message sanitization | ✅ | Internal error disembunyikan di production |
| CORS whitelist | ✅ | Hanya origin yang diizinkan |
| Env validation startup | ✅ | Server tidak start jika env tidak lengkap |
| Graceful shutdown | ✅ | SIGTERM/SIGINT handler |
| Activity audit log | ✅ | Semua aksi admin tercatat |

### Checklist Sebelum Go-Live

- [ ] Ganti `JWT_SECRET` dengan string random 64+ karakter
- [ ] Set `NODE_ENV=production` di `.env`
- [ ] Ganti semua password default admin
- [ ] Set `FRONTEND_URL` ke domain production
- [ ] Pastikan MySQL tidak accessible dari internet
- [ ] Setup HTTPS (SSL/TLS) di web server (nginx/Apache)
- [ ] Setup firewall — hanya port 80/443 yang terbuka
- [ ] Setup backup database otomatis
- [ ] Test semua endpoint dengan Postman/curl

---

## Deploy ke Production

> Untuk panduan deploy lengkap ke Hostinger (Shared Hosting maupun VPS), lihat bagian [🚀 Go-Live di Hostinger](#-go-live-di-hostinger) di bawah.

---

## 🚀 Go-Live di Hostinger

Ada **dua pilihan** hosting di Hostinger untuk project ini. Pilih sesuai budget dan kebutuhan:

| | Opsi A: Shared/Cloud Hosting | Opsi B: VPS |
|---|---|---|
| **Harga** | Lebih murah (Business/Cloud plan) | Lebih mahal (KVM1 ke atas) |
| **Kemudahan** | ⭐⭐⭐⭐⭐ Sangat mudah via hPanel | ⭐⭐⭐ Perlu akses SSH |
| **Kontrol** | Terbatas | Penuh |
| **Performa** | Cukup untuk traffic sedang | Lebih baik, bisa di-scale |
| **Rekomendasi** | Untuk mulai / traffic kecil-menengah | Untuk production serius |

> **Rekomendasi:** Mulai dengan **Opsi A (Business Hosting)** jika baru pertama kali. Upgrade ke VPS jika traffic sudah besar.

---

### Opsi A — Shared/Cloud Hosting (Mudah)

> Membutuhkan plan **Business Web Hosting** atau **Cloud Hosting** (Startup ke atas).
> Plan Starter/Premium tidak mendukung Node.js.

#### Langkah 1 — Beli Hosting & Domain di Hostinger

1. Buka [hostinger.com](https://www.hostinger.com) → pilih **Business Web Hosting** atau **Cloud Startup**
2. Pilih domain kamu (misal: `jogjafurniture.com`)
3. Selesaikan pembayaran dan tunggu akun aktif

#### Langkah 2 — Buat Database MySQL di hPanel

1. Login ke **hPanel** → klik **Databases** → **MySQL Databases**
2. Klik **Create Database**
3. Isi:
   - **Database name**: `jogja_furniture`
   - **Username**: buat username (misal: `jf_user`)
   - **Password**: buat password yang kuat
4. Klik **Create** — catat semua info ini!
5. Klik **phpMyAdmin** → pilih database yang baru dibuat
6. Klik tab **Import** → pilih file `backend/database_v2.sql` → klik **Go**

#### Langkah 3 — Deploy Aplikasi via File Upload

1. Di hPanel → **Websites** → klik **Add Website**
2. Pilih **Node.js Apps**
3. Pilih **Upload your website files**
4. Upload file `JogjaFurniture_Production_v2.1.zip`
5. Pada **Build Settings**:
   - **Framework**: pilih `Other` (atau `Express.js` jika tersedia)
   - **Entry file**: `backend/server.js`
   - **Root directory**: `jogja-furniture` (folder di dalam ZIP)
6. Klik **Deploy**

#### Langkah 4 — Set Environment Variables

1. Di dashboard Node.js app → klik **Environment Variables**
2. Tambahkan satu per satu:

```
NODE_ENV=production
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_USER=jf_user
DB_PASSWORD=password_database_kamu
DB_NAME=jogja_furniture
JWT_SECRET=isi_dengan_string_random_64_karakter
JWT_EXPIRES_IN=8h
FRONTEND_URL=https://jogjafurniture.com
MAX_FILE_SIZE=5242880
```

> **Generate JWT_SECRET:** Jalankan di terminal lokal:
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
> ```

3. Klik **Save** → klik **Restart** (tombol di dashboard)

#### Langkah 5 — Arahkan Domain

1. Di hPanel → **Domains** → pilih domain kamu
2. Pastikan domain sudah mengarah ke website Node.js yang baru dibuat
3. SSL otomatis aktif oleh Hostinger (Let's Encrypt gratis)

#### Langkah 6 — Verifikasi

Buka browser → akses `https://jogjafurniture.com/api/health`

Response yang benar:
```json
{
  "success": true,
  "message": "Jogja Furniture Enterprise API v2",
  "db": "ok"
}
```

---

### Opsi B — VPS Hostinger (Recommended)

> Membutuhkan plan **VPS KVM 1** ke atas (Ubuntu 22.04 LTS).
> Memberikan kontrol penuh, performa lebih baik, dan cocok untuk production jangka panjang.

#### Langkah 1 — Beli VPS & Setup Awal

1. Buka [hostinger.com](https://www.hostinger.com) → **VPS Hosting**
2. Pilih minimal **KVM 1** (1 vCPU, 4GB RAM, 50GB SSD)
3. Saat setup:
   - **OS**: pilih **Ubuntu 22.04 LTS**
   - **Panel**: pilih **None** (kita setup manual)
   - Buat password root yang kuat
4. Catat **IP Address VPS** kamu dari hPanel

#### Langkah 2 — Arahkan Domain ke VPS

1. Di hPanel → **Domains** → pilih domain kamu → **DNS / Nameservers**
2. Edit record **A**:
   - **Host**: `@` → **Points to**: `IP_VPS_KAMU`
   - **Host**: `www` → **Points to**: `IP_VPS_KAMU`
3. Tunggu propagasi DNS (5–30 menit)

#### Langkah 3 — Koneksi SSH ke VPS

Buka terminal di komputer kamu:

```bash
ssh root@IP_VPS_KAMU
```

Masukkan password root yang dibuat tadi.

#### Langkah 4 — Update Server & Install Dependencies

```bash
# Update sistem
apt update && apt upgrade -y

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verifikasi
node --version   # harus v20.x.x
npm --version

# Install MySQL 8
apt install -y mysql-server

# Amankan MySQL
mysql_secure_installation
# Jawab: Y, Y, Y, Y, Y

# Install Nginx
apt install -y nginx

# Install PM2 (process manager)
npm install -g pm2

# Install Certbot untuk SSL
apt install -y python3-certbot-nginx
```

#### Langkah 5 — Setup Database MySQL

```bash
# Masuk ke MySQL
mysql -u root -p

# Buat database dan user
CREATE DATABASE jogja_furniture CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'jf_user'@'localhost' IDENTIFIED BY 'Password_Kuat_123!';
GRANT ALL PRIVILEGES ON jogja_furniture.* TO 'jf_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

#### Langkah 6 — Upload & Extract Project

**Cara 1 — Upload via SCP (dari komputer lokal):**
```bash
# Jalankan di terminal LOKAL (bukan VPS)
scp JogjaFurniture_Production_v2.1.zip root@IP_VPS_KAMU:/var/www/
```

**Cara 2 — Upload via hPanel File Manager:**
1. hPanel → **VPS** → **File Manager**
2. Upload ZIP ke `/var/www/`

**Lanjut di VPS:**
```bash
# Install unzip jika belum ada
apt install -y unzip

# Extract
cd /var/www
unzip JogjaFurniture_Production_v2.1.zip
mv jogja-furniture jogja-furniture-app

# Struktur setelah extract:
# /var/www/jogja-furniture-app/
# ├── backend/
# ├── frontend/
# ├── admin/
# └── README.md
```

#### Langkah 7 — Install Dependencies & Konfigurasi .env

```bash
cd /var/www/jogja-furniture-app/backend

# Install npm packages
npm install --production

# Buat file .env
cp .env.example .env
nano .env
```

Isi file `.env` dengan nilai yang benar:

```env
NODE_ENV=production
PORT=5000

DB_HOST=localhost
DB_PORT=3306
DB_USER=jf_user
DB_PASSWORD=Password_Kuat_123!
DB_NAME=jogja_furniture

# Generate dulu: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=GANTI_DENGAN_STRING_RANDOM_64_KARAKTER_ATAU_LEBIH
JWT_EXPIRES_IN=8h

FRONTEND_URL=https://jogjafurniture.com
MAX_FILE_SIZE=5242880
```

Simpan: `Ctrl+X` → `Y` → `Enter`

#### Langkah 8 — Import Database

```bash
mysql -u jf_user -p jogja_furniture < /var/www/jogja-furniture-app/backend/database_v2.sql
# Masukkan password database
```

Verifikasi:
```bash
mysql -u jf_user -p -e "USE jogja_furniture; SHOW TABLES;"
# Harus muncul daftar tabel
```

#### Langkah 9 — Jalankan dengan PM2

```bash
cd /var/www/jogja-furniture-app/backend

# Start aplikasi
pm2 start server.js --name "jogja-furniture"

# Cek status
pm2 status

# Lihat log
pm2 logs jogja-furniture

# Auto-start saat VPS reboot
pm2 startup
# Jalankan perintah yang muncul (copy-paste)
pm2 save
```

Output `pm2 status` yang benar:
```
┌─────┬──────────────────┬─────────┬──────┬───────────┐
│ id  │ name             │ mode    │ ↺    │ status    │
├─────┼──────────────────┼─────────┼──────┼───────────┤
│ 0   │ jogja-furniture  │ fork    │ 0    │ online    │
└─────┴──────────────────┴─────────┴──────┴───────────┘
```

#### Langkah 10 — Konfigurasi Nginx

```bash
nano /etc/nginx/sites-available/jogja-furniture
```

Paste konfigurasi berikut (ganti `jogjafurniture.com` dengan domain kamu):

```nginx
server {
    listen 80;
    server_name jogjafurniture.com www.jogjafurniture.com;

    # Proxy semua request ke Node.js
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
    }

    # Upload files — serve langsung dari Nginx (lebih cepat)
    location /uploads/ {
        alias /var/www/jogja-furniture-app/backend/uploads/;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }

    client_max_body_size 10M;
}
```

Simpan: `Ctrl+X` → `Y` → `Enter`

```bash
# Aktifkan konfigurasi
ln -s /etc/nginx/sites-available/jogja-furniture /etc/nginx/sites-enabled/

# Hapus default config
rm /etc/nginx/sites-enabled/default

# Test konfigurasi
nginx -t
# Harus muncul: syntax is ok / test is successful

# Reload Nginx
systemctl reload nginx
```

#### Langkah 11 — Install SSL (HTTPS Gratis)

```bash
certbot --nginx -d jogjafurniture.com -d www.jogjafurniture.com
```

Ikuti instruksi:
- Masukkan email kamu
- Setuju terms: `A`
- Pilih redirect HTTP ke HTTPS: `2`

Certbot akan otomatis update konfigurasi Nginx dan aktifkan HTTPS.

Verifikasi auto-renewal:
```bash
certbot renew --dry-run
# Harus muncul: Congratulations, all simulated renewals succeeded
```

#### Langkah 12 — Setup Firewall

```bash
# Aktifkan UFW
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
# Ketik Y untuk konfirmasi

# Cek status
ufw status
```

#### Langkah 13 — Verifikasi Final

```bash
# Test API health
curl https://jogjafurniture.com/api/health
```

Response yang benar:
```json
{
  "success": true,
  "message": "Jogja Furniture Enterprise API v2",
  "db": "ok",
  "uptime": 42
}
```

Buka browser:
- ✅ `https://jogjafurniture.com` → Website publik
- ✅ `https://jogjafurniture.com/admin` → Admin panel
- ✅ `https://jogjafurniture.com/api/health` → API health check

#### Perintah PM2 yang Sering Dipakai

```bash
pm2 status                        # Cek status semua proses
pm2 logs jogja-furniture          # Lihat log real-time
pm2 logs jogja-furniture --lines 100  # 100 baris log terakhir
pm2 restart jogja-furniture       # Restart aplikasi
pm2 reload jogja-furniture        # Reload tanpa downtime
pm2 stop jogja-furniture          # Stop aplikasi
pm2 monit                         # Monitor CPU & RAM real-time
```

#### Update Aplikasi (Setelah Ada Perubahan Kode)

```bash
# Upload file baru via SCP
scp file_baru.js root@IP_VPS:/var/www/jogja-furniture-app/backend/

# Atau upload ZIP baru dan extract ulang
# Lalu reload PM2 tanpa downtime:
pm2 reload jogja-furniture
```

---

### Checklist Go-Live Hostinger

Sebelum mengumumkan website live, pastikan semua ini sudah ✅:

**Database & Keamanan**
- [ ] Database berhasil diimport (`SHOW TABLES` menampilkan semua tabel)
- [ ] `JWT_SECRET` sudah diganti dengan string random 64+ karakter
- [ ] `NODE_ENV=production` sudah diset
- [ ] Semua password default admin sudah diganti (login → Profile → Ganti Password)
- [ ] File `.env` tidak bisa diakses dari browser

**Domain & SSL**
- [ ] Domain mengarah ke server yang benar
- [ ] HTTPS aktif (gembok hijau di browser)
- [ ] `http://` otomatis redirect ke `https://`
- [ ] `www.` dan non-`www.` keduanya berfungsi

**Fungsionalitas**
- [ ] `/api/health` mengembalikan `"db": "ok"`
- [ ] Login admin berhasil dengan akun default
- [ ] Upload foto produk berfungsi
- [ ] Halaman website publik tampil dengan benar
- [ ] Admin panel bisa diakses di `/admin`

**Monitoring (VPS)**
- [ ] PM2 berjalan dengan status `online`
- [ ] PM2 startup sudah dikonfigurasi (auto-start saat reboot)
- [ ] Firewall aktif (hanya port 80, 443, 22 yang terbuka)

---

## Troubleshooting

### Server tidak mau start
```
❌ Missing required environment variables: JWT_SECRET, DB_HOST
```
**Solusi**: Pastikan file `.env` sudah dibuat dari `.env.example` dan semua nilai terisi.

### Database connection error
```
❌ Defaulting MySQL failed: Access denied for user
```
**Solusi**: Periksa `DB_USER`, `DB_PASSWORD`, `DB_NAME` di `.env`. Pastikan user MySQL memiliki akses ke database.

### Upload file gagal
```
Error: Hanya file gambar yang diizinkan
```
**Solusi**: Pastikan file yang diupload adalah gambar valid (jpg, png, webp, gif) dengan MIME type yang benar.

### Login selalu gagal setelah reset password
**Solusi**: Jalankan `node scripts/generate-passwords.js` untuk mendapatkan hash yang benar, lalu update di database.

### CORS error di browser
**Solusi**: Tambahkan URL frontend Anda ke `FRONTEND_URL` di `.env` dan restart server.

### Troubleshooting Khusus Hostinger

**App tidak mau start di Shared Hosting**
- Pastikan plan kamu adalah **Business** atau **Cloud** (bukan Starter/Premium)
- Cek **Entry file** di Build Settings sudah diisi `backend/server.js`
- Cek **Environment Variables** sudah tersimpan semua
- Klik **Restart** dari dashboard Node.js app

**Database tidak bisa terkoneksi di Shared Hosting**
- `DB_HOST` di Hostinger Shared Hosting = `localhost` (bukan IP)
- Pastikan username database sudah di-assign ke database di hPanel → MySQL Databases
- Cek nama database — Hostinger biasanya menambahkan prefix username, misal: `u123456789_jogja_furniture`

**phpMyAdmin gagal import (file terlalu besar)**
- Buka hPanel → **phpMyAdmin** → pilih database
- Klik **Import** → ubah **Partial import** → naikkan limit
- Atau gunakan MySQL CLI via SSH (VPS) / Terminal (Shared Hosting jika tersedia)

**502 Bad Gateway di VPS**
```bash
# Cek apakah Node.js berjalan
pm2 status
# Jika stopped, start ulang:
pm2 start jogja-furniture

# Cek log error
pm2 logs jogja-furniture --lines 50

# Cek Nginx
systemctl status nginx
nginx -t
```

**SSL tidak aktif / HTTPS error**
```bash
# Cek status sertifikat
certbot certificates

# Renew manual jika expired
certbot renew

# Reload Nginx setelah renew
systemctl reload nginx
```

**Upload foto gagal di production**
```bash
# Cek permission folder uploads (VPS)
chmod -R 755 /var/www/jogja-furniture-app/backend/uploads
chown -R www-data:www-data /var/www/jogja-furniture-app/backend/uploads
# Atau jika pakai user lain:
chown -R $USER:$USER /var/www/jogja-furniture-app/backend/uploads
```

---

## Lisensi

Proyek ini dikembangkan untuk Jogja Furniture Decoration.
Hak cipta dilindungi. Tidak untuk didistribusikan tanpa izin.

---

*Jogja Furniture Enterprise System v2.1 — Built with ❤️ in Yogyakarta*

-- ============================================================
-- JOGJA FURNITURE DECORATION — DATABASE SCHEMA v2.0
-- Enterprise Edition: WMS + CMS + Control Center
-- ============================================================
-- Jalankan file ini di phpMyAdmin atau MySQL CLI
-- CATATAN: Script ini adalah fresh install.
--          Jika upgrade dari v1, lihat bagian MIGRATION di bawah.
-- ============================================================

CREATE DATABASE IF NOT EXISTS jogja_furniture CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE jogja_furniture;

SET FOREIGN_KEY_CHECKS = 0;

-- ══════════════════════════════════════════════════════════════
-- SECTION 1: USER MANAGEMENT
-- ══════════════════════════════════════════════════════════════

-- ── ADMIN USERS ──────────────────────────────────────────────
DROP TABLE IF EXISTS admin_users;
CREATE TABLE admin_users (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  username    VARCHAR(80)  NOT NULL UNIQUE,
  email       VARCHAR(150) NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL,
  full_name   VARCHAR(150),
  phone       VARCHAR(30),
  role        ENUM('superadmin','admin_gudang','admin_website','marketing') DEFAULT 'admin_website',
  is_active   TINYINT(1)   DEFAULT 1,
  avatar      VARCHAR(255),
  last_login  DATETIME,
  created_by  INT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_role (role),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── LOGIN SESSIONS ────────────────────────────────────────────
DROP TABLE IF EXISTS login_sessions;
CREATE TABLE login_sessions (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT          NOT NULL,
  token_hash  VARCHAR(255) NOT NULL,
  ip_address  VARCHAR(45),
  user_agent  TEXT,
  is_active   TINYINT(1)   DEFAULT 1,
  expires_at  DATETIME,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id),
  INDEX idx_token (token_hash),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── ACTIVITY LOGS ─────────────────────────────────────────────
DROP TABLE IF EXISTS activity_logs;
CREATE TABLE activity_logs (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT,
  username    VARCHAR(80),
  role        VARCHAR(50),
  action      VARCHAR(100)  NOT NULL,
  module      VARCHAR(80),
  description TEXT,
  record_id   INT,
  record_type VARCHAR(80),
  ip_address  VARCHAR(45),
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_module (module),
  INDEX idx_action (action),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ══════════════════════════════════════════════════════════════
-- SECTION 2: WEBSITE CMS (Existing — Extended)
-- ══════════════════════════════════════════════════════════════

-- ── SETTINGS (key-value CMS) ──────────────────────────────────
DROP TABLE IF EXISTS settings;
CREATE TABLE settings (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  `key`       VARCHAR(100) NOT NULL UNIQUE,
  value       TEXT,
  type        ENUM('text','textarea','image','json','boolean','number') DEFAULT 'text',
  label       VARCHAR(150),
  group_name  VARCHAR(80)  DEFAULT 'general',
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── CATEGORIES ────────────────────────────────────────────────
DROP TABLE IF EXISTS categories;
CREATE TABLE categories (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  slug        VARCHAR(120) NOT NULL UNIQUE,
  icon        VARCHAR(10)  DEFAULT '📦',
  image       VARCHAR(255),
  color_from  VARCHAR(20)  DEFAULT '#5C2E0E',
  color_to    VARCHAR(20)  DEFAULT '#C49A6C',
  description TEXT,
  sort_order  INT          DEFAULT 0,
  is_active   TINYINT(1)   DEFAULT 1,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── PRODUCTS (Extended dengan Publish Status & Stock) ─────────
DROP TABLE IF EXISTS products;
CREATE TABLE products (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  category_id     INT,

  -- Identitas Produk
  name            VARCHAR(200)  NOT NULL,
  slug            VARCHAR(220)  NOT NULL UNIQUE,
  sku             VARCHAR(100)  UNIQUE,

  -- Konten Website (dikelola Admin Website)
  short_desc      TEXT,
  description     LONGTEXT,
  specification   TEXT,
  material        VARCHAR(200),
  dimensions      VARCHAR(150),
  price_label     VARCHAR(100)  DEFAULT 'Hubungi Kami',
  thumbnail       VARCHAR(255),

  -- SEO
  meta_title      VARCHAR(200),
  meta_desc       VARCHAR(300),

  -- Warehouse / Stock (dikelola Admin Gudang)
  warehouse_stock INT           DEFAULT 0,
  unit            VARCHAR(30)   DEFAULT 'unit',
  cost_price      DECIMAL(15,2) DEFAULT 0.00,
  sell_price      DECIMAL(15,2) DEFAULT 0.00,

  -- Publish Workflow
  publish_status  ENUM('new','draft','review','ready','published','hidden','out_of_stock','archived')
                  DEFAULT 'new',

  -- Flags
  is_featured     TINYINT(1)    DEFAULT 0,
  is_active       TINYINT(1)    DEFAULT 1,   -- backward compat (1 = published)
  sort_order      INT           DEFAULT 0,
  view_count      INT           DEFAULT 0,

  -- Audit
  created_by      INT,
  published_by    INT,
  published_at    DATETIME,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (category_id)  REFERENCES categories(id)   ON DELETE SET NULL,
  FOREIGN KEY (created_by)   REFERENCES admin_users(id)  ON DELETE SET NULL,
  FOREIGN KEY (published_by) REFERENCES admin_users(id)  ON DELETE SET NULL,

  INDEX idx_slug         (slug),
  INDEX idx_featured     (is_featured),
  INDEX idx_category     (category_id),
  INDEX idx_active       (is_active),
  INDEX idx_pub_status   (publish_status),
  INDEX idx_sku          (sku)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── PRODUCT IMAGES ────────────────────────────────────────────
DROP TABLE IF EXISTS product_images;
CREATE TABLE product_images (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  product_id  INT          NOT NULL,
  filename    VARCHAR(255) NOT NULL,
  alt_text    VARCHAR(200),
  is_primary  TINYINT(1)   DEFAULT 0,
  sort_order  INT          DEFAULT 0,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── PRODUCT TAGS ──────────────────────────────────────────────
DROP TABLE IF EXISTS product_tags;
CREATE TABLE product_tags (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  product_id  INT          NOT NULL,
  tag         VARCHAR(80)  NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE KEY unique_product_tag (product_id, tag),
  INDEX idx_tag (tag)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── SERVICES ──────────────────────────────────────────────────
DROP TABLE IF EXISTS services;
CREATE TABLE services (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(200) NOT NULL,
  slug        VARCHAR(220) NOT NULL UNIQUE,
  icon        VARCHAR(10)  DEFAULT '🛠',
  short_desc  TEXT,
  description LONGTEXT,
  info        TEXT,
  image       VARCHAR(255),
  color_from  VARCHAR(20)  DEFAULT '#5C2E0E',
  color_to    VARCHAR(20)  DEFAULT '#C49A6C',
  is_active   TINYINT(1)   DEFAULT 1,
  sort_order  INT          DEFAULT 0,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── SERVICE GALLERY ───────────────────────────────────────────
DROP TABLE IF EXISTS service_gallery;
CREATE TABLE service_gallery (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  service_id  INT          NOT NULL,
  filename    VARCHAR(255) NOT NULL,
  alt_text    VARCHAR(200),
  sort_order  INT          DEFAULT 0,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── TESTIMONIALS ──────────────────────────────────────────────
DROP TABLE IF EXISTS testimonials;
CREATE TABLE testimonials (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(150) NOT NULL,
  role        VARCHAR(150),
  avatar      VARCHAR(255),
  initial     VARCHAR(5),
  rating      TINYINT      DEFAULT 5,
  content     TEXT         NOT NULL,
  product_ref VARCHAR(200),
  is_active   TINYINT(1)   DEFAULT 1,
  sort_order  INT          DEFAULT 0,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── CONTACTS ──────────────────────────────────────────────────
DROP TABLE IF EXISTS contacts;
CREATE TABLE contacts (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(150) NOT NULL,
  email       VARCHAR(200),
  phone       VARCHAR(30),
  subject     VARCHAR(200),
  message     TEXT         NOT NULL,
  product_ref VARCHAR(200),
  is_read     TINYINT(1)   DEFAULT 0,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── BANNERS (NEW) ─────────────────────────────────────────────
DROP TABLE IF EXISTS banners;
CREATE TABLE banners (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  title       VARCHAR(200),
  subtitle    VARCHAR(300),
  image       VARCHAR(255),
  link_url    VARCHAR(500),
  link_text   VARCHAR(100),
  position    ENUM('hero','popup','promo','sidebar') DEFAULT 'hero',
  is_active   TINYINT(1)   DEFAULT 1,
  sort_order  INT          DEFAULT 0,
  start_date  DATE,
  end_date    DATE,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ══════════════════════════════════════════════════════════════
-- SECTION 3: WAREHOUSE MANAGEMENT SYSTEM (NEW)
-- ══════════════════════════════════════════════════════════════

-- ── SUPPLIERS ─────────────────────────────────────────────────
DROP TABLE IF EXISTS suppliers;
CREATE TABLE suppliers (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  code         VARCHAR(30)   UNIQUE,
  name         VARCHAR(200)  NOT NULL,
  contact_name VARCHAR(150),
  phone        VARCHAR(30),
  email        VARCHAR(150),
  address      TEXT,
  city         VARCHAR(100),
  province     VARCHAR(100),
  notes        TEXT,
  is_active    TINYINT(1)    DEFAULT 1,
  created_by   INT,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE SET NULL,
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── CUSTOMERS ─────────────────────────────────────────────────
DROP TABLE IF EXISTS customers;
CREATE TABLE customers (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  code         VARCHAR(30)   UNIQUE,
  name         VARCHAR(200)  NOT NULL,
  phone        VARCHAR(30),
  email        VARCHAR(150),
  address      TEXT,
  city         VARCHAR(100),
  province     VARCHAR(100),
  notes        TEXT,
  total_orders INT           DEFAULT 0,
  total_spend  DECIMAL(15,2) DEFAULT 0.00,
  is_active    TINYINT(1)    DEFAULT 1,
  created_by   INT,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE SET NULL,
  INDEX idx_active (is_active),
  INDEX idx_code   (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── ORDERS ────────────────────────────────────────────────────
DROP TABLE IF EXISTS orders;
CREATE TABLE orders (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  order_number    VARCHAR(50)   NOT NULL UNIQUE,
  customer_id     INT,
  customer_name   VARCHAR(200),
  customer_phone  VARCHAR(30),
  customer_email  VARCHAR(150),
  customer_addr   TEXT,

  status          ENUM('pending','confirmed','processing','ready','delivered','cancelled','refunded')
                  DEFAULT 'pending',
  payment_status  ENUM('unpaid','partial','paid','refunded') DEFAULT 'unpaid',
  payment_method  VARCHAR(100),

  subtotal        DECIMAL(15,2) DEFAULT 0.00,
  discount        DECIMAL(15,2) DEFAULT 0.00,
  shipping_cost   DECIMAL(15,2) DEFAULT 0.00,
  total           DECIMAL(15,2) DEFAULT 0.00,
  amount_paid     DECIMAL(15,2) DEFAULT 0.00,

  notes           TEXT,
  delivery_date   DATE,
  shipping_addr   TEXT,

  created_by      INT,
  confirmed_by    INT,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (customer_id)  REFERENCES customers(id)   ON DELETE SET NULL,
  FOREIGN KEY (created_by)   REFERENCES admin_users(id) ON DELETE SET NULL,
  FOREIGN KEY (confirmed_by) REFERENCES admin_users(id) ON DELETE SET NULL,

  INDEX idx_order_number  (order_number),
  INDEX idx_status        (status),
  INDEX idx_payment       (payment_status),
  INDEX idx_customer      (customer_id),
  INDEX idx_created_at    (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── ORDER ITEMS ───────────────────────────────────────────────
DROP TABLE IF EXISTS order_items;
CREATE TABLE order_items (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  order_id     INT           NOT NULL,
  product_id   INT,
  product_name VARCHAR(200)  NOT NULL,
  product_sku  VARCHAR(100),
  qty          INT           DEFAULT 1,
  unit         VARCHAR(30)   DEFAULT 'unit',
  unit_price   DECIMAL(15,2) DEFAULT 0.00,
  subtotal     DECIMAL(15,2) DEFAULT 0.00,
  notes        TEXT,
  FOREIGN KEY (order_id)   REFERENCES orders(id)   ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  INDEX idx_order   (order_id),
  INDEX idx_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── STOCK TRANSACTIONS (Barang Masuk / Keluar) ────────────────
DROP TABLE IF EXISTS stock_transactions;
CREATE TABLE stock_transactions (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  product_id     INT           NOT NULL,
  type           ENUM('in','out','adjustment','return') DEFAULT 'in',
  qty            INT           NOT NULL,
  qty_before     INT           DEFAULT 0,
  qty_after      INT           DEFAULT 0,
  reference_type ENUM('purchase','sale','return','adjustment','other') DEFAULT 'other',
  reference_id   INT,
  reference_no   VARCHAR(100),
  supplier_id    INT,
  order_id       INT,
  unit_price     DECIMAL(15,2) DEFAULT 0.00,
  total_price    DECIMAL(15,2) DEFAULT 0.00,
  notes          TEXT,
  created_by     INT,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (product_id)  REFERENCES products(id)   ON DELETE CASCADE,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id)  ON DELETE SET NULL,
  FOREIGN KEY (order_id)    REFERENCES orders(id)     ON DELETE SET NULL,
  FOREIGN KEY (created_by)  REFERENCES admin_users(id) ON DELETE SET NULL,

  INDEX idx_product  (product_id),
  INDEX idx_type     (type),
  INDEX idx_ref_type (reference_type),
  INDEX idx_created  (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── NOTIFICATIONS ─────────────────────────────────────────────
DROP TABLE IF EXISTS notifications;
CREATE TABLE notifications (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  target_role  VARCHAR(80),
  target_user  INT,
  type         VARCHAR(50)   DEFAULT 'info',
  title        VARCHAR(200)  NOT NULL,
  message      TEXT,
  link         VARCHAR(500),
  is_read      TINYINT(1)    DEFAULT 0,
  created_by   INT,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (target_user) REFERENCES admin_users(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by)  REFERENCES admin_users(id) ON DELETE SET NULL,
  INDEX idx_target_role (target_role),
  INDEX idx_target_user (target_user),
  INDEX idx_is_read     (is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;

-- ══════════════════════════════════════════════════════════════
-- SEED DATA
-- ══════════════════════════════════════════════════════════════

-- ── USERS ─────────────────────────────────────────────────────
-- Superadmin (password: admin123)
INSERT INTO admin_users (username, email, password, full_name, role, is_active) VALUES
('superadmin', 'superadmin@jogjafurniture.com',
 '$2a$10$rBHw2.lXXmvhVHTJX8YhLO6TUWaVMflSqF4mBv5/xbmqN.x/Iijyi',
 'Super Administrator', 'superadmin', 1),
-- Admin Gudang (password: gudang123)
('gudang01', 'gudang@jogjafurniture.com',
 '$2a$10$8K1p/a0dclxMBMJM5.qPq.V2CK3L1mMkUc0.P/8wL9/9aMEEfaBam',
 'Ahmad Riyadi', 'admin_gudang', 1),
-- Admin Website (password: website123)
('website01', 'website@jogjafurniture.com',
 '$2a$10$3OkMW8pY5HQrHw9l1UaqjOtJgTXTWcN7eFCNXB2xvBYiqLU.K4jvm',
 'Siti Rahayu', 'admin_website', 1),
-- Marketing (password: marketing123)
('marketing01', 'marketing@jogjafurniture.com',
 '$2a$10$hqiW5qj5NfD4KYQXHLxAi.3xzr0GnHcWqzm2bA4FWBHqBdXQaTuBK',
 'Budi Santoso', 'marketing', 1);

-- NOTE: Passwords di atas adalah bcrypt hash placeholder.
-- Jalankan reset-passwords.js untuk generate hash yang benar, atau gunakan
-- admin panel → User Management → Reset Password.
-- Default passwords:
--   superadmin / admin123
--   gudang01   / gudang123
--   website01  / website123
--   marketing01/ marketing123

-- ── SETTINGS ──────────────────────────────────────────────────
INSERT INTO settings (`key`, value, type, label, group_name) VALUES
('site_name',       'Jogja Furniture Decoration', 'text',     'Nama Website',              'general'),
('site_tagline',    'Furniture Decoration',        'text',     'Tagline',                   'general'),
('site_desc',       'Furnitur berkualitas tinggi dan dekorasi interior yang mencerminkan keanggunan dan keunikan khas Yogyakarta.', 'textarea', 'Deskripsi Website', 'general'),
('site_logo',       '',                            'image',    'Logo',                      'general'),
('whatsapp_number', '6281234567890',               'text',     'Nomor WhatsApp',            'contact'),
('whatsapp_message','Halo, saya tertarik dengan produk Anda:', 'text', 'Pesan WhatsApp Default', 'contact'),
('phone',           '+62 812-3456-7890',           'text',     'Telepon',                   'contact'),
('email',           'info@jogjafurniture.com',     'text',     'Email',                     'contact'),
('address',         'Jl. Kaliurang KM 12, Sleman, Yogyakarta 55581', 'textarea', 'Alamat',  'contact'),
('maps_embed',      '',                            'textarea', 'Google Maps Embed URL',     'contact'),
('hero_label',      'Jogja Furniture Decoration',  'text',     'Hero Label',                'hero'),
('hero_title_1',    'Wujudkan Ruang',              'text',     'Hero Title Baris 1',        'hero'),
('hero_title_accent','Impian Anda',                'text',     'Hero Title Accent',         'hero'),
('hero_desc',       'Furnitur berkualitas tinggi dan dekorasi interior yang mencerminkan keanggunan dan keunikan khas Yogyakarta.', 'textarea', 'Hero Deskripsi', 'hero'),
('hero_btn_primary','Lihat Catalog',               'text',     'Hero Tombol Utama',         'hero'),
('hero_btn_secondary','Konsultasi Gratis',         'text',     'Hero Tombol Kedua',         'hero'),
('stat_projects',   '500',                         'number',   'Statistik: Proyek',         'stats'),
('stat_years',      '12',                          'number',   'Statistik: Tahun',          'stats'),
('stat_satisfaction','98',                         'number',   'Statistik: Kepuasan (%)',   'stats'),
('stat_craftsmen',  '50',                          'number',   'Statistik: Pengrajin',      'stats'),
('about_title',     'Keahlian & Dedikasi Dalam Setiap Karya', 'text', 'Tentang: Judul',    'about'),
('about_desc',      'Jogja Furniture Decoration hadir sejak 2012 dengan misi menciptakan furnitur berkualitas tinggi.', 'textarea', 'Tentang: Deskripsi', 'about'),
('about_years',     '12',                          'number',   'Tentang: Tahun Pengalaman', 'about'),
('about_image_main','',                            'image',    'Tentang: Foto Utama',       'about'),
('about_image_sec', '',                            'image',    'Tentang: Foto Kedua',       'about'),
('hero_bg_image',   '',                            'image',    'Hero: Background Gambar',   'hero'),
('footer_desc',     'Menghadirkan keindahan kayu Jawa ke dalam setiap sudut hunian Anda.', 'textarea', 'Footer Deskripsi', 'footer'),
('jam_operasional', 'Sen–Sab: 08.00 – 17.00|Minggu: 09.00 – 14.00', 'text', 'Jam Operasional', 'contact'),
('marquee_items',   'Furniture Custom|Interior Design|Dekorasi Ruangan|Renovasi Interior|Living Room|Bedroom|Kitchen Set|Home Office', 'text', 'Marquee Items', 'general'),
('instagram_url',   'https://instagram.com/jogjafurniture', 'text', 'Instagram URL',        'social'),
('facebook_url',    'https://facebook.com/jogjafurniture',  'text', 'Facebook URL',         'social'),
('youtube_url',     '',                            'text',     'YouTube URL',               'social');

-- ── CATEGORIES ────────────────────────────────────────────────
INSERT INTO categories (name, slug, icon, color_from, color_to, description, sort_order) VALUES
('Living Room',  'living-room',  '🛋', '#5C2E0E', '#C49A6C', 'Furnitur elegan untuk ruang tamu', 1),
('Bedroom',      'bedroom',      '🛏', '#3D1E08', '#8B4513', 'Koleksi furnitur kamar tidur',     2),
('Kitchen Set',  'kitchen-set',  '🍳', '#8B4513', '#DDB88A', 'Kitchen set premium custom',       3),
('Office',       'office',       '💻', '#C49A6C', '#E8D5B7', 'Meja dan furnitur kantor',         4),
('Dining Room',  'dining-room',  '🍽', '#3D2E1E', '#7A6A5A', 'Set meja makan keluarga',          5),
('Outdoor',      'outdoor',      '🌿', '#2D5016', '#5A8A30', 'Furnitur taman dan outdoor',       6);

-- ── SUPPLIERS ─────────────────────────────────────────────────
INSERT INTO suppliers (code, name, contact_name, phone, email, address, city, notes, is_active, created_by) VALUES
('SUP001', 'CV Jati Lestari Yogya',      'Pak Surya',       '08123456001', 'jatilestari@email.com',   'Jl. Magelang KM 5, Yogyakarta',          'Yogyakarta', 'Supplier kayu jati grade A',    1, 1),
('SUP002', 'UD Rotan Nusantara',         'Bu Sari',         '08123456002', 'rotannusa@email.com',     'Jl. Solo KM 8, Sleman',                  'Sleman',     'Supplier rotan alami pilihan',  1, 1),
('SUP003', 'PT Multiplex Prima',         'Pak Hendra',      '08123456003', 'multiplexprima@email.com','Jl. Parangtritis KM 10, Bantul',          'Bantul',     'Supplier multiplex & HPL',      1, 1),
('SUP004', 'CV Besi Kuat Makmur',        'Pak Dodi',        '08123456004', 'besikuat@email.com',      'Jl. Ring Road Barat No.45, Yogyakarta',   'Yogyakarta', 'Supplier besi & hardware',      1, 1),
('SUP005', 'Toko Cat & Finishing Jaya',  'Bu Lastri',       '08123456005', 'catjaya@email.com',       'Jl. Malioboro Gang 3, Yogyakarta',        'Yogyakarta', 'Supplier cat, PU, teak oil',    1, 1);

-- ── CUSTOMERS ─────────────────────────────────────────────────
INSERT INTO customers (code, name, phone, email, address, city, notes, is_active, created_by) VALUES
('CUS001', 'Bapak Andi Wijaya',     '08556677001', 'andi.wijaya@gmail.com',  'Jl. Colombo No.5, Sleman',            'Sleman',     'Pelanggan tetap, sering custom', 1, 1),
('CUS002', 'Ibu Dewi Kusumawati',   '08556677002', 'dewi.k@yahoo.com',       'Jl. Gejayan No.12, Yogyakarta',       'Yogyakarta', 'Interior designer',              1, 1),
('CUS003', 'PT Graha Indah Hotel',  '08556677003', 'purchasing@grahahotel.id','Jl. Laksda Adisucipto No.100',        'Yogyakarta', 'Klien korporat, pemesanan besar',1, 1),
('CUS004', 'Bapak Reza Pratama',    '08556677004', 'reza.p@gmail.com',       'Jl. Kaliurang KM 7 No.22, Sleman',   'Sleman',     'New customer',                   1, 1),
('CUS005', 'CV Kontraktor Bangunan Maju', '08556677005', 'kontraktor.maju@email.com', 'Jl. Wonosari KM 3, Bantul', 'Bantul',     'Rekanan kontraktor interior',    1, 1);

-- ── PRODUCTS (30 sample products dengan publish_status) ───────
INSERT INTO products (category_id, name, slug, sku, short_desc, description, specification, material, dimensions,
  price_label, is_featured, publish_status, is_active, warehouse_stock, unit, cost_price, sell_price, sort_order, created_by, published_by) VALUES

-- Living Room (cat 1)
(1,'Sofa Jati Premium 3 Seater','sofa-jati-premium-3-seater','SKU-LR-001',
 'Sofa elegan berbahan kayu jati solid dengan pelapis premium.','Sofa mewah berbahan dasar kayu jati grade A...',
 'Material: Kayu Jati Grade A\nUkuran: 200 x 85 x 80 cm\nBusa: D-35\nGaransi: 2 tahun',
 'Kayu Jati Grade A','200 x 85 x 80 cm','Mulai Rp 8.500.000',1,'published',1,5,'unit',5500000,8500000,1,1,1),

(1,'Kursi Tamu Rotan Anyam','kursi-tamu-rotan-anyam','SKU-LR-002',
 'Kursi tamu handcraft dengan anyaman rotan alami.','Kursi tamu cantik dengan material rotan alami...',
 'Material: Rotan Alami + Rangka Jati\nUkuran: 65 x 65 x 80 cm\nGaransi: 1 tahun',
 'Rotan Alami','65 x 65 x 80 cm','Mulai Rp 1.200.000',0,'published',1,10,'unit',750000,1200000,2,1,1),

(1,'Meja Kopi Kayu Jati Solid','meja-kopi-kayu-jati-solid','SKU-LR-003',
 'Coffee table dari kayu jati solid dengan desain minimalis modern.','Meja kopi premium terbuat dari kayu jati solid...',
 'Material: Kayu Jati Solid\nUkuran: 100 x 60 x 40 cm\nGaransi: 2 tahun',
 'Kayu Jati Solid','100 x 60 x 40 cm','Mulai Rp 2.800.000',1,'published',1,8,'unit',1700000,2800000,3,1,1),

(1,'Rak Buku Kayu Jati Minimalis','rak-buku-kayu-jati-minimalis','SKU-LR-004',
 'Rak buku 5 tingkat dari kayu jati solid.','Rak buku cantik dengan 5 tingkat...',
 'Material: Kayu Jati Solid\nUkuran: 80 x 30 x 180 cm\nGaransi: 2 tahun',
 'Kayu Jati Solid','80 x 30 x 180 cm','Mulai Rp 3.200.000',0,'published',1,4,'unit',2000000,3200000,4,1,1),

(1,'Lemari Pajangan Sudut Jati','lemari-pajangan-sudut-jati','SKU-LR-005',
 'Corner cabinet dari kayu jati dengan pintu kaca.','Lemari sudut elegan berbahan kayu jati solid...',
 'Material: Kayu Jati Solid + Kaca Tempered\nUkuran: 60 x 60 x 190 cm\nGaransi: 2 tahun',
 'Kayu Jati Solid','60 x 60 x 190 cm','Mulai Rp 4.500.000',0,'published',1,3,'unit',2800000,4500000,5,1,1),

-- Bedroom (cat 2)
(2,'Tempat Tidur Minimalis King Size','tempat-tidur-minimalis-king-size','SKU-BD-001',
 'Ranjang minimalis solid wood dengan headboard custom.','Tempat tidur king size dengan desain minimalis...',
 'Material: Mahoni Solid\nUkuran: 200 x 180 cm\nGaransi: 2 tahun',
 'Mahoni Solid','200 x 180 cm','Mulai Rp 6.500.000',1,'published',1,3,'unit',4200000,6500000,1,1,1),

(2,'Lemari Pakaian 4 Pintu Sliding','lemari-pakaian-4-pintu-sliding','SKU-BD-002',
 'Lemari pakaian spacious dengan 4 pintu sliding.','Lemari pakaian besar dengan sistem pintu sliding...',
 'Material: Multiplex 18mm\nUkuran: 200 x 60 x 220 cm\nGaransi: 1 tahun',
 'Multiplex 18mm','200 x 60 x 220 cm','Mulai Rp 7.200.000',0,'published',1,2,'unit',4500000,7200000,2,1,1),

(2,'Nakas Kayu Jati 2 Laci','nakas-kayu-jati-2-laci','SKU-BD-003',
 'Meja samping tempat tidur dari kayu jati dengan 2 laci.','Nakas atau nightstand cantik...',
 'Material: Kayu Jati Solid\nUkuran: 50 x 40 x 60 cm\nGaransi: 1 tahun',
 'Kayu Jati Solid','50 x 40 x 60 cm','Mulai Rp 1.800.000',0,'published',1,6,'unit',1100000,1800000,3,1,1),

(2,'Meja Rias Cermin Kayu Jati','meja-rias-cermin-kayu-jati','SKU-BD-004',
 'Dressing table kayu jati dengan cermin besar.','Meja rias premium berbahan kayu jati solid...',
 'Material: Kayu Jati Solid\nUkuran: 120 x 45 x 150 cm\nGaransi: 2 tahun',
 'Kayu Jati Solid','120 x 45 x 150 cm','Mulai Rp 5.500.000',0,'published',1,2,'unit',3500000,5500000,4,1,1),

(2,'Tempat Tidur Anak Tingkat','tempat-tidur-anak-tingkat','SKU-BD-005',
 'Ranjang tingkat anak-anak dari kayu pinus solid.','Tempat tidur tingkat khusus anak-anak...',
 'Material: Kayu Pinus Solid\nUkuran: 200 x 100 cm\nGaransi: 2 tahun',
 'Kayu Pinus Solid','200 x 100 cm','Mulai Rp 4.800.000',0,'published',1,4,'unit',3000000,4800000,5,1,1),

-- Kitchen (cat 3)
(3,'Kitchen Set Island L-Shape Premium','kitchen-set-island-l-shape-premium','SKU-KS-001',
 'Kitchen set modern dengan island bar.','Kitchen set mewah dengan layout L-Shape...',
 'Material: Multiplex 18mm + HPL Premium\nTop Table: Granit 2cm\nGaransi: 3 tahun',
 'Multiplex 18mm + HPL','Custom (ukur lokasi)','Mulai Rp 25.000.000',1,'published',1,1,'set',15000000,25000000,1,1,1),

(3,'Kitchen Set Minimalis Putih','kitchen-set-minimalis-putih','SKU-KS-002',
 'Kitchen set minimalis warna putih bersih.','Kitchen set minimalis dengan finishing HPL putih...',
 'Material: Multiplex 15mm + HPL\nGaransi: 2 tahun',
 'Multiplex 15mm + HPL','Custom (ukur lokasi)','Mulai Rp 12.000.000',0,'published',1,2,'set',7500000,12000000,2,1,1),

(3,'Kitchen Set Kayu Natural Rustic','kitchen-set-kayu-natural-rustic','SKU-KS-003',
 'Kitchen set bergaya rustic dengan sentuhan kayu natural.','Kitchen set bergaya rustic-natural...',
 'Material: Multiplex 18mm + HPL Kayu\nGaransi: 2 tahun',
 'Multiplex 18mm + HPL Kayu','Custom (ukur lokasi)','Mulai Rp 18.000.000',0,'published',1,1,'set',11000000,18000000,3,1,1),

-- Office (cat 4)
(4,'Meja Kerja L-Shape Home Office','meja-kerja-l-shape-home-office','SKU-OF-001',
 'Meja kerja L-shape dengan laci dan storage built-in.','Meja kerja ergonomis berbentuk L-shape...',
 'Material: Multiplex 18mm + HPL\nUkuran: 160 x 120 cm\nGaransi: 1 tahun',
 'Multiplex 18mm','160 x 120 cm','Mulai Rp 4.500.000',1,'published',1,5,'unit',2700000,4500000,1,1,1),

(4,'Meja Direktur Executive Jati','meja-direktur-executive-jati','SKU-OF-002',
 'Meja direktur mewah dari kayu jati solid.','Meja direktur premium berbahan kayu jati solid...',
 'Material: Kayu Jati Solid Grade A\nGaransi: 3 tahun',
 'Kayu Jati Solid','180 x 90 cm','Mulai Rp 12.000.000',0,'published',1,1,'unit',7500000,12000000,2,1,1),

(4,'Rak Arsip Kantor Kayu','rak-arsip-kantor-kayu','SKU-OF-003',
 'Rak arsip kantor 6 tingkat dari kayu.','Rak arsip kantor dengan 6 tingkat...',
 'Material: Multiplex 18mm\nUkuran: 90 x 40 x 200 cm\nGaransi: 1 tahun',
 'Multiplex 18mm','90 x 40 x 200 cm','Mulai Rp 2.800.000',0,'published',1,4,'unit',1700000,2800000,3,1,1),

(4,'Kursi Kerja Ergonomis Kayu','kursi-kerja-ergonomis-kayu','SKU-OF-004',
 'Kursi kerja dari kayu jati dengan sandaran ergonomis.','Kursi kerja cantik berbahan kayu jati...',
 'Material: Kayu Jati Solid\nGaransi: 1 tahun',
 'Kayu Jati Solid','55 x 55 x 95 cm','Mulai Rp 2.200.000',0,'published',1,6,'unit',1300000,2200000,4,1,1),

-- Dining (cat 5)
(5,'Set Meja Makan 8 Kursi Jati','set-meja-makan-8-kursi-jati','SKU-DR-001',
 'Set meja makan kayu jati solid untuk 8 orang.','Set meja makan premium dari kayu jati solid...',
 'Material: Kayu Jati Solid\nMeja: 240 x 100 x 75 cm\nGaransi: 2 tahun',
 'Kayu Jati Solid','240 x 100 x 75 cm','Mulai Rp 18.000.000',1,'published',1,1,'set',11500000,18000000,1,1,1),

(5,'Meja Makan Bundar Keluarga','meja-makan-bundar-keluarga','SKU-DR-002',
 'Meja makan bundar 6 kursi dari kayu mahoni.','Meja makan bundar berdiameter 150cm...',
 'Material: Mahoni Solid\nDiameter: 150 cm\nGaransi: 2 tahun',
 'Mahoni Solid','Ø150 x 75 cm','Mulai Rp 14.500.000',0,'published',1,2,'set',9000000,14500000,2,1,1),

(5,'Bufet Ruang Makan Kayu Jati','bufet-ruang-makan-kayu-jati','SKU-DR-003',
 'Bufet makan dari kayu jati dengan 3 pintu dan laci.','Bufet ruang makan yang elegan...',
 'Material: Kayu Jati Solid\nUkuran: 150 x 45 x 90 cm\nGaransi: 2 tahun',
 'Kayu Jati Solid','150 x 45 x 90 cm','Mulai Rp 6.800.000',0,'published',1,3,'unit',4200000,6800000,3,1,1),

(5,'Kursi Makan Rotan Handcraft','kursi-makan-rotan-handcraft','SKU-DR-004',
 'Kursi makan dari rotan anyam handcraft.','Kursi makan cantik dengan material rotan alami...',
 'Material: Rotan Alami + Kaki Besi\nUkuran: 45 x 45 x 85 cm\nGaransi: 1 tahun',
 'Rotan Alami','45 x 45 x 85 cm','Mulai Rp 850.000/unit',0,'published',1,20,'unit',500000,850000,4,1,1),

-- Outdoor (cat 6)
(6,'Set Kursi Taman Kayu Jati','set-kursi-taman-kayu-jati','SKU-OD-001',
 'Set kursi dan meja taman dari kayu jati outdoor.','Set furnitur taman premium...',
 'Material: Kayu Jati Outdoor Grade A\nMeja: 80 x 80 x 70 cm\nGaransi: 2 tahun',
 'Kayu Jati Outdoor','80 x 80 x 70 cm','Mulai Rp 8.500.000/set',0,'published',1,2,'set',5500000,8500000,1,1,1),

(6,'Swing Chair Rotan Indoor-Outdoor','swing-chair-rotan-indoor-outdoor','SKU-OD-002',
 'Kursi ayun rotan yang bisa digunakan indoor maupun outdoor.','Kursi ayun cantik dari rotan sintetis...',
 'Material: Rotan Sintetis + Rangka Besi\nDiameter: 100 cm\nGaransi: 1 tahun',
 'Rotan Sintetis','Ø100 cm','Mulai Rp 3.200.000',1,'published',1,5,'unit',1900000,3200000,2,1,1),

(6,'Meja Bar Outdoor Kayu Trembesi','meja-bar-outdoor-kayu-trembesi','SKU-OD-003',
 'Meja bar outdoor dari kayu trembesi slab natural.','Meja bar outdoor dari kayu trembesi slab...',
 'Material: Kayu Trembesi Slab\nGaransi: 2 tahun',
 'Kayu Trembesi Slab','200 x 80-120 x 105 cm','Mulai Rp 9.500.000',0,'published',1,1,'unit',6000000,9500000,3,1,1),

-- Additional
(1,'Hiasan Dinding Kayu Ukir Batik','hiasan-dinding-kayu-ukir-batik','SKU-LR-006',
 'Wall decor kayu ukir motif batik handcraft.','Hiasan dinding eksklusif dari kayu jati...',
 'Material: Kayu Jati Solid\nUkuran: 100 x 80 cm\nGaransi: Tanpa batas (seni)',
 'Kayu Jati Solid','100 x 80 x 3 cm','Mulai Rp 3.500.000',1,'published',1,3,'unit',2000000,3500000,6,1,1),

(1,'Meja Konsol Kayu Trembesi Slab','meja-konsol-kayu-trembesi-slab','SKU-LR-007',
 'Console table dari kayu trembesi slab alami.','Meja konsol statement piece...',
 'Material: Kayu Trembesi Slab\nUkuran: 120 x 35-60 x 80 cm\nGaransi: 2 tahun',
 'Kayu Trembesi Slab','120 x 35-60 x 80 cm','Mulai Rp 5.500.000',0,'published',1,2,'unit',3300000,5500000,7,1,1),

(2,'Cermin Dinding Bingkai Rotan','cermin-dinding-bingkai-rotan','SKU-BD-006',
 'Cermin dinding bingkai rotan anyam handcraft.','Cermin dinding cantik dengan bingkai rotan...',
 'Material: Rotan Alami\nUkuran: Ø60/Ø80/Ø100 cm\nGaransi: 1 tahun',
 'Rotan Alami','Ø60/Ø80/Ø100 cm','Mulai Rp 650.000',0,'published',1,8,'unit',380000,650000,6,1,1),

(5,'Nampan Kayu Ukir Serving Tray','nampan-kayu-ukir-serving-tray','SKU-DR-005',
 'Serving tray kayu ukir motif daun handcraft.','Nampan kayu premium dengan ukiran motif daun...',
 'Material: Mahoni Solid\nUkuran: 45 x 30 x 8 cm\nFinish: Food-Safe Oil',
 'Mahoni Solid','45 x 30 x 8 cm','Mulai Rp 350.000',0,'published',1,15,'unit',200000,350000,5,1,1),

(6,'Pot Tanaman Kayu Jati Custom','pot-tanaman-kayu-jati-custom','SKU-OD-004',
 'Pot tanaman dari kayu jati dengan berbagai ukuran.','Pot tanaman handcraft dari kayu jati solid...',
 'Material: Kayu Jati Solid\nUkuran: S/M/L/XL\nLapisan: Anti-bocor interior',
 'Kayu Jati Solid','S/M/L/XL (custom)','Mulai Rp 280.000',0,'new',0,0,'unit',0,0,4,2,NULL),

-- Products with 'new' status (belum dipublish, baru masuk dari gudang)
(1,'Sofa Minimalis Modern 2 Seater','sofa-minimalis-modern-2-seater','SKU-LR-008',
 'Sofa 2 dudukan desain minimalis modern dengan rangka kayu jati.','Detail produk belum diisi.',
 '','Kayu Jati + Fabric','180 x 80 x 75 cm','Hubungi Kami',0,'new',0,3,'unit',0,0,8,2,NULL),

(4,'Standing Desk Height Adjustable','standing-desk-height-adjustable','SKU-OF-005',
 'Meja kerja dengan ketinggian yang bisa disesuaikan.','Detail produk belum diisi.',
 '','Multiplex + Besi','120 x 70 cm','Hubungi Kami',0,'draft',0,2,'unit',0,0,5,2,NULL);

-- ── PRODUCT TAGS ──────────────────────────────────────────────
INSERT INTO product_tags (product_id, tag)
SELECT p.id, t.tag FROM products p
JOIN (
  SELECT 'sofa-jati-premium-3-seater' as slug, 'sofa' as tag UNION ALL
  SELECT 'sofa-jati-premium-3-seater', 'jati' UNION ALL
  SELECT 'sofa-jati-premium-3-seater', 'living-room' UNION ALL
  SELECT 'sofa-jati-premium-3-seater', 'premium' UNION ALL
  SELECT 'tempat-tidur-minimalis-king-size', 'bed' UNION ALL
  SELECT 'tempat-tidur-minimalis-king-size', 'mahoni' UNION ALL
  SELECT 'tempat-tidur-minimalis-king-size', 'bedroom' UNION ALL
  SELECT 'kitchen-set-island-l-shape-premium', 'kitchen' UNION ALL
  SELECT 'kitchen-set-island-l-shape-premium', 'hpl' UNION ALL
  SELECT 'kitchen-set-island-l-shape-premium', 'island' UNION ALL
  SELECT 'meja-kerja-l-shape-home-office', 'office' UNION ALL
  SELECT 'meja-kerja-l-shape-home-office', 'home-office' UNION ALL
  SELECT 'set-meja-makan-8-kursi-jati', 'dining' UNION ALL
  SELECT 'set-meja-makan-8-kursi-jati', 'jati' UNION ALL
  SELECT 'meja-kopi-kayu-jati-solid', 'coffee-table' UNION ALL
  SELECT 'meja-kopi-kayu-jati-solid', 'jati' UNION ALL
  SELECT 'swing-chair-rotan-indoor-outdoor', 'rotan' UNION ALL
  SELECT 'swing-chair-rotan-indoor-outdoor', 'outdoor' UNION ALL
  SELECT 'hiasan-dinding-kayu-ukir-batik', 'handcraft' UNION ALL
  SELECT 'hiasan-dinding-kayu-ukir-batik', 'ukir' UNION ALL
  SELECT 'hiasan-dinding-kayu-ukir-batik', 'batik'
) t ON p.slug = t.slug;

-- ── SERVICES ──────────────────────────────────────────────────
INSERT INTO services (name, slug, icon, short_desc, description, info, color_from, color_to, sort_order) VALUES
('Furniture Custom','furniture-custom','🛋',
 'Rancang furnitur impian Anda sesuai ukuran dan selera, dikerjakan pengrajin berpengalaman.',
 'Kami menerima pesanan furnitur custom sesuai kebutuhan dan desain yang Anda inginkan.',
 'Estimasi: 3–8 minggu|Area: Yogyakarta & sekitarnya|Minimal order: 1 unit|Konsultasi: Gratis',
 '#5C2E0E','#C49A6C',1),
('Interior Design','interior-design','📐',
 'Konsultasi dan perancangan desain interior modern yang fungsional dan estetis.',
 'Tim desainer interior profesional kami siap membantu Anda mewujudkan ruang impian.',
 'Estimasi: 2–4 minggu desain|Output: Gambar 3D + RAB|Revisi: 3x gratis|Konsultasi: Gratis',
 '#3D1E08','#8B4513',2),
('Kitchen Set','kitchen-set-service','🍳',
 'Dapur impian dengan kabinet custom, material premium, dan desain ergonomis terbaik.',
 'Kitchen set custom dengan standar kualitas premium menggunakan multiplex 18mm, HPL anti-air.',
 'Estimasi: 3–6 minggu|Material: HPL / Solid Wood|Top Table: Granit / Quartz|Garansi: 3 tahun',
 '#8B4513','#DDB88A',3),
('Renovasi & Instalasi','renovasi-instalasi','🔨',
 'Layanan renovasi dan instalasi furnitur profesional di lokasi Anda.',
 'Tim instalasi kami yang berpengalaman siap membantu pemasangan furnitur.',
 'Area: Yogyakarta & sekitarnya|Tim: 2–4 orang profesional|Waktu: Sesuai scope|Garansi: 6 bulan',
 '#C49A6C','#E8D5B7',4);

-- ── TESTIMONIALS ──────────────────────────────────────────────
INSERT INTO testimonials (name, role, initial, rating, content, product_ref, sort_order) VALUES
('Budi Santoso','Pemilik Villa, Sleman','B',5,'Kualitas furniturnya luar biasa! Sofa jati yang saya pesan sangat kokoh dan elegan.','Sofa Jati Premium',1),
('Dewi Rahayu','Interior Designer, Yogyakarta','D',5,'Sebagai desainer interior, saya selalu percayakan pembuatan furnitur custom ke Jogja Furniture.','Furniture Custom',2),
('Ahmad Fauzi','Pengusaha, Jakarta','A',5,'Pesan kitchen set untuk rumah di Yogyakarta. Prosesnya mudah dan hasilnya memuaskan.','Kitchen Set Premium',3),
('Siti Nurhaliza','Ibu Rumah Tangga, Bantul','S',5,'Lemari pakaian yang saya pesan sangat sesuai dengan ukuran kamar. Materialnya bagus.','Lemari Pakaian Custom',4),
('Rizal Hermawan','Arsitek, Yogyakarta','R',5,'Saya sering merekomendasikan Jogja Furniture ke klien saya. Konsistensi kualitas terjaga.','Furniture Custom',5);

-- ── ORDERS ────────────────────────────────────────────────────
INSERT INTO orders (order_number, customer_id, customer_name, customer_phone, customer_email, status, payment_status, subtotal, total, notes, created_by) VALUES
('ORD-2026-0001', 1, 'Bapak Andi Wijaya',    '08556677001', 'andi.wijaya@gmail.com',  'delivered',  'paid',    8500000,  8500000,  'Pengiriman ke Sleman, sudah diterima.',    1),
('ORD-2026-0002', 2, 'Ibu Dewi Kusumawati',  '08556677002', 'dewi.k@yahoo.com',       'processing', 'partial', 14500000, 14500000, 'Deposit 50% sudah masuk.',                1),
('ORD-2026-0003', 3, 'PT Graha Indah Hotel', '08556677003', 'purchasing@grahahotel.id','confirmed',  'unpaid',  45000000, 45000000, 'Order korporat: 5 set meja makan.',       1),
('ORD-2026-0004', 4, 'Bapak Reza Pratama',   '08556677004', 'reza.p@gmail.com',       'pending',    'unpaid',  25000000, 25000000, 'Kitchen set L-shape, tunggu konfirmasi.', 1),
('ORD-2026-0005', 5, 'CV Kontraktor Maju',   '08556677005', 'kontraktor.maju@email.com','processing','paid',   32000000, 32000000, 'Proyek renovasi, 10 unit berbeda.',       1);

-- ── ORDER ITEMS ───────────────────────────────────────────────
INSERT INTO order_items (order_id, product_id, product_name, product_sku, qty, unit, unit_price, subtotal) VALUES
(1, 1,  'Sofa Jati Premium 3 Seater',        'SKU-LR-001', 1, 'unit', 8500000,  8500000),
(2, 19, 'Meja Makan Bundar Keluarga',        'SKU-DR-002', 1, 'set',  14500000, 14500000),
(3, 18, 'Set Meja Makan 8 Kursi Jati',       'SKU-DR-001', 3, 'set',  18000000, 54000000),
(4, 11, 'Kitchen Set Island L-Shape Premium','SKU-KS-001', 1, 'set',  25000000, 25000000),
(5, 14, 'Meja Kerja L-Shape Home Office',    'SKU-OF-001', 4, 'unit', 4500000,  18000000),
(5, 1,  'Sofa Jati Premium 3 Seater',        'SKU-LR-001', 2, 'unit', 8500000,  17000000);

-- ── STOCK TRANSACTIONS ─────────────────────────────────────────
INSERT INTO stock_transactions (product_id, type, qty, qty_before, qty_after, reference_type, reference_no, supplier_id, unit_price, total_price, notes, created_by) VALUES
(1,  'in', 10, 0,  10, 'purchase', 'PO-2026-001', 1, 5500000, 55000000, 'Pembelian awal stok sofa jati', 2),
(1,  'out', 5, 10, 5,  'sale',     'ORD-2026-0001', NULL, 8500000, 8500000, 'Penjualan ke Andi Wijaya', 2),
(3,  'in', 15, 0,  15, 'purchase', 'PO-2026-002', 1, 1700000, 25500000, 'Pembelian stok meja kopi', 2),
(3,  'out', 7, 15, 8,  'sale',     'ORD-2026-MISC', NULL, 2800000, 19600000, 'Penjualan periode Maret', 2),
(6,  'in', 5,  0,  5,  'purchase', 'PO-2026-003', 1, 4200000, 21000000, 'Pembelian stok tempat tidur', 2),
(21, 'in', 3,  0,  3,  'purchase', 'PO-2026-004', 2, 5500000, 16500000, 'Pembelian stok kursi taman', 2),
(22, 'in', 8,  0,  8,  'purchase', 'PO-2026-005', 2, 1900000, 15200000, 'Pembelian stok swing chair',  2),
(4,  'in', 10, 0,  10, 'purchase', 'PO-2026-006', 1, 2000000, 20000000, 'Pembelian stok rak buku', 2),
(4,  'out', 6, 10, 4,  'sale',     'ORD-2026-MISC2', NULL, 3200000, 19200000, 'Penjualan rak buku', 2),
(2,  'in', 15, 0,  15, 'purchase', 'PO-2026-007', 2, 750000,  11250000, 'Pembelian stok kursi rotan',  2);

-- ── NOTIFICATIONS ─────────────────────────────────────────────
INSERT INTO notifications (target_role, type, title, message, link, created_by) VALUES
('admin_website', 'info',    'Produk Baru Masuk',     '2 produk baru dari gudang menunggu review untuk dipublish ke website.', '/admin/panel.html#products-new', 2),
('admin_gudang',  'warning', 'Stok Hampir Habis',     'Produk Kitchen Set Island L-Shape stok tersisa 1 unit.', '/admin/panel.html#stock', 1),
('marketing',     'success', 'Order Baru Masuk',      'Order ORD-2026-0004 dari Bapak Reza Pratama sudah dikonfirmasi.', '/admin/panel.html#orders', 1),
('superadmin',    'info',    'Login Baru Terdeteksi',  'Admin Website (website01) login dari IP 192.168.1.25.', '/admin/panel.html#activity-logs', NULL),
('admin_website', 'warning', 'Produk Perlu Update',   'Produk "Pot Tanaman Kayu Jati Custom" belum memiliki deskripsi lengkap.', '/admin/panel.html#products', 1);

-- ── ACTIVITY LOGS ─────────────────────────────────────────────
INSERT INTO activity_logs (user_id, username, role, action, module, description, record_type, ip_address) VALUES
(1, 'superadmin',   'superadmin',     'LOGIN',           'Auth',         'Superadmin login berhasil',                   'session',  '127.0.0.1'),
(2, 'gudang01',     'admin_gudang',   'CREATE',          'Products',     'Menambah produk baru: Sofa Minimalis Modern', 'product',  '192.168.1.10'),
(2, 'gudang01',     'admin_gudang',   'STOCK_IN',        'Stock',        'Barang masuk: Sofa Jati Premium (10 unit)',   'stock',    '192.168.1.10'),
(3, 'website01',    'admin_website',  'PUBLISH',         'Products',     'Publish produk: Sofa Jati Premium',           'product',  '192.168.1.25'),
(4, 'marketing01',  'marketing',      'CREATE_ORDER',    'Orders',       'Membuat order baru: ORD-2026-0004',           'order',    '192.168.1.30'),
(1, 'superadmin',   'superadmin',     'CREATE_USER',     'Users',        'Membuat user baru: website01',                'user',     '127.0.0.1'),
(2, 'gudang01',     'admin_gudang',   'UPDATE',          'Products',     'Update stok produk: Meja Kopi',               'product',  '192.168.1.10'),
(3, 'website01',    'admin_website',  'UPDATE',          'Settings',     'Update hero section website',                 'settings', '192.168.1.25'),
(1, 'superadmin',   'superadmin',     'RESET_PASSWORD',  'Users',        'Reset password untuk user: gudang01',         'user',     '127.0.0.1'),
(4, 'marketing01',  'marketing',      'UPDATE_ORDER',    'Orders',       'Update status order: ORD-2026-0003',          'order',    '192.168.1.30');

-- ══════════════════════════════════════════════════════════════
-- MIGRATION SCRIPT (v1 → v2)
-- Jalankan hanya jika melakukan upgrade dari database v1
-- ══════════════════════════════════════════════════════════════
/*
-- Step 1: Backup dulu database v1 Anda!
-- mysqldump -u root jogja_furniture > backup_v1.sql

-- Step 2: Tambah kolom baru ke admin_users
ALTER TABLE admin_users
  ADD COLUMN phone      VARCHAR(30)    AFTER email,
  ADD COLUMN is_active  TINYINT(1)     DEFAULT 1    AFTER role,
  MODIFY COLUMN role ENUM('superadmin','admin_gudang','admin_website','marketing') DEFAULT 'admin_website',
  ADD INDEX idx_role (role),
  ADD INDEX idx_active (is_active);

-- Migrate existing 'admin' role ke 'admin_website'
UPDATE admin_users SET role = 'admin_website' WHERE role = 'admin';
-- Set superadmin role untuk admin yang sudah ada
UPDATE admin_users SET role = 'superadmin' WHERE username = 'admin';

-- Step 3: Tambah kolom baru ke products
ALTER TABLE products
  ADD COLUMN sku             VARCHAR(100)  UNIQUE AFTER name,
  ADD COLUMN warehouse_stock INT           DEFAULT 0 AFTER thumbnail,
  ADD COLUMN unit            VARCHAR(30)   DEFAULT 'unit' AFTER warehouse_stock,
  ADD COLUMN cost_price      DECIMAL(15,2) DEFAULT 0.00 AFTER unit,
  ADD COLUMN sell_price      DECIMAL(15,2) DEFAULT 0.00 AFTER cost_price,
  ADD COLUMN publish_status  ENUM('new','draft','review','ready','published','hidden','out_of_stock','archived')
             DEFAULT 'new' AFTER sell_price,
  ADD COLUMN created_by      INT AFTER sort_order,
  ADD COLUMN published_by    INT AFTER created_by,
  ADD COLUMN published_at    DATETIME AFTER published_by,
  ADD INDEX idx_pub_status (publish_status),
  ADD INDEX idx_sku (sku);

-- Migrate publish_status dari is_active
UPDATE products SET publish_status = 'published', published_at = NOW() WHERE is_active = 1;
UPDATE products SET publish_status = 'hidden' WHERE is_active = 0;

-- Step 4: Buat tabel-tabel baru (jalankan CREATE TABLE di atas)
*/

-- ══════════════════════════════════════════════════════════════
-- VIEWS (Untuk kemudahan query)
-- ══════════════════════════════════════════════════════════════

-- View produk yang sudah published (untuk frontend)
CREATE OR REPLACE VIEW v_published_products AS
SELECT p.*, c.name AS category_name, c.slug AS category_slug,
       c.icon AS category_icon, c.color_from, c.color_to
FROM products p
LEFT JOIN categories c ON c.id = p.category_id
WHERE p.publish_status = 'published' AND p.is_active = 1;

-- View produk baru dari gudang (untuk admin website)
CREATE OR REPLACE VIEW v_new_products AS
SELECT p.*, c.name AS category_name,
       u.full_name AS created_by_name
FROM products p
LEFT JOIN categories c ON c.id = p.category_id
LEFT JOIN admin_users u ON u.id = p.created_by
WHERE p.publish_status IN ('new', 'draft', 'review', 'ready');

-- View ringkasan stok
CREATE OR REPLACE VIEW v_stock_summary AS
SELECT p.id, p.sku, p.name, p.warehouse_stock, p.unit, p.publish_status,
       c.name AS category_name,
       COALESCE(SUM(CASE WHEN st.type='in' THEN st.qty ELSE 0 END),0) AS total_in,
       COALESCE(SUM(CASE WHEN st.type='out' THEN st.qty ELSE 0 END),0) AS total_out
FROM products p
LEFT JOIN categories c ON c.id = p.category_id
LEFT JOIN stock_transactions st ON st.product_id = p.id
GROUP BY p.id;

-- View summary order
CREATE OR REPLACE VIEW v_order_summary AS
SELECT o.*, c.name AS customer_name_ref,
       u.full_name AS created_by_name,
       COUNT(oi.id) AS item_count
FROM orders o
LEFT JOIN customers c ON c.id = o.customer_id
LEFT JOIN admin_users u ON u.id = o.created_by
LEFT JOIN order_items oi ON oi.order_id = o.id
GROUP BY o.id;

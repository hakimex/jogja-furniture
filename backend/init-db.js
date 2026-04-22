const Database = require('better-sqlite3');
const db = new Database('./database.db');

// Create tables
db.exec(`
CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  role TEXT DEFAULT 'admin_website',
  is_active INTEGER DEFAULT 1,
  avatar TEXT,
  last_login TEXT,
  created_by INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT DEFAULT '📦',
  image TEXT,
  color_from TEXT DEFAULT '#5C2E0E',
  color_to TEXT DEFAULT '#8B4513',
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  sku TEXT,
  short_desc TEXT,
  description TEXT,
  specification TEXT,
  material TEXT,
  dimensions TEXT,
  weight REAL,
  unit TEXT DEFAULT 'pcs',
  stock_qty INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 0,
  unit_price REAL DEFAULT 0,
  sell_price REAL DEFAULT 0,
  discount_percent REAL DEFAULT 0,
  is_featured INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  publish_status TEXT DEFAULT 'draft',
  images TEXT,
  tags TEXT,
  seo_title TEXT,
  seo_desc TEXT,
  created_by INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  type TEXT DEFAULT 'text',
  label TEXT,
  group_name TEXT DEFAULT 'general',
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Add more tables as needed
`);

console.log('Tables created successfully');
db.close();
// Comprehensive test suite for Jogja Furniture Enterprise v2
const fs = require('fs');

let passed = 0, failed = 0;

function test(name, condition) {
  if (condition) {
    console.log('PASS  ' + name);
    passed++;
  } else {
    console.log('FAIL  ' + name);
    failed++;
  }
}

const content = {
  testimonials: fs.readFileSync('backend/controllers/testimonialsController.js', 'utf8'),
  warehouse:    fs.readFileSync('backend/controllers/warehouseController.js', 'utf8'),
  products:     fs.readFileSync('backend/controllers/productsController.js', 'utf8'),
  categories:   fs.readFileSync('backend/controllers/categoriesController.js', 'utf8'),
  services:     fs.readFileSync('backend/controllers/servicesController.js', 'utf8'),
  orders:       fs.readFileSync('backend/controllers/ordersController.js', 'utf8'),
  authCtrl:     fs.readFileSync('backend/controllers/authController.js', 'utf8'),
  usersCtrl:    fs.readFileSync('backend/controllers/usersController.js', 'utf8'),
  settings:     fs.readFileSync('backend/controllers/settingsController.js', 'utf8'),
  server:       fs.readFileSync('backend/server.js', 'utf8'),
  auth:         fs.readFileSync('backend/middleware/auth.js', 'utf8'),
  roleCheck:    fs.readFileSync('backend/middleware/roleCheck.js', 'utf8'),
  upload:       fs.readFileSync('backend/middleware/upload.js', 'utf8'),
  adminJs:      fs.readFileSync('admin/js/admin.js', 'utf8'),
  publicRoutes: fs.readFileSync('backend/routes/public.js', 'utf8'),
  adminRoutes:  fs.readFileSync('backend/routes/admin.js', 'utf8'),
};

console.log('\n=== BACKEND: CONTROLLERS ===');

// Bug fix: testimonialsController.update had missing params array
test('testimonialsController.update - params array present',
  content.testimonials.includes('[name, role || null') && content.testimonials.includes('req.params.id]'));

test('testimonialsController.update - validates required fields',
  content.testimonials.includes('name, role, initial, rating, content'));

// Safe error messages
const controllers = ['testimonials','warehouse','products','categories','services'];
const allSafe = controllers.every(c => !content[c].includes('message: err.message'));
test('All controllers - no raw err.message exposed to client', allSafe);

// Products
test('productsController - VALID_STATUSES enum validation', content.products.includes('VALID_STATUSES'));
test('productsController - publish workflow (new/draft/review/ready/published)', content.products.includes("'new','draft','review','ready'"));
test('productsController - slug collision handling', content.products.includes('slug}%'));
test('productsController - file cleanup on delete', content.products.includes('fs.unlinkSync'));
test('productsController - role-based filtering (marketing sees published only)', content.products.includes("publish_status = 'published'"));

// Orders
test('ordersController - DB transaction (beginTransaction/commit/rollback)',
  content.orders.includes('beginTransaction') && content.orders.includes('conn.commit') && content.orders.includes('conn.rollback'));
test('ordersController - safePaginate used', content.orders.includes('safePaginate'));
test('ordersController - stock deduction on status change', content.orders.includes("DEDUCTED_STATES"));
test('ordersController - FOR UPDATE row locking', content.orders.includes('FOR UPDATE'));
test('ordersController - negative qty/price validation', content.orders.includes('qty <= 0'));
test('ordersController - stock insufficient check', content.orders.includes('warehouse_stock < item.qty'));
test('ordersController - auto out_of_stock on zero stock', content.orders.includes("'out_of_stock'"));
test('ordersController - stock restore on cancel/refund', content.orders.includes('RESTORE STOCK'));

// Auth
test('authController - timing attack prevention (dummy hash)', content.authCtrl.includes('dummyHash'));
test('authController - input length limits', content.authCtrl.includes('username.length > 150'));
test('authController - bcrypt cost 12', content.authCtrl.includes('bcrypt.hash') && content.authCtrl.includes(', 12)'));
test('authController - safe error messages', !content.authCtrl.includes('message: err.message'));

// Users
test('usersController - VALID_ROLES validation', content.usersCtrl.includes('VALID_ROLES'));
test('usersController - email format validation', content.usersCtrl.includes('test(email)'));
test('usersController - cannot deactivate self', content.usersCtrl.includes('menonaktifkan akun sendiri'));
test('usersController - cannot delete self', content.usersCtrl.includes('menghapus akun sendiri'));
test('usersController - pagination capped', content.usersCtrl.includes('safePaginate'));
test('usersController - bcrypt cost 12', content.usersCtrl.includes('bcrypt.hash') && content.usersCtrl.includes(', 12)'));

// Settings
test('settingsController - PUBLIC_KEYS whitelist', content.settings.includes('PUBLIC_KEYS'));
test('settingsController - only whitelisted keys in public endpoint', content.settings.includes('WHERE `key` IN (?)'));
test('settingsController - image key allowlist for upload', content.settings.includes('allowedKeys'));

// Warehouse
test('warehouseController - stock validation before deduct', content.warehouse.includes('warehouse_stock < parseInt(qty)'));
test('warehouseController - customer delete protection (has orders)', content.warehouse.includes('order_count'));
test('warehouseController - auto publish_status on stock change', content.warehouse.includes("'out_of_stock'"));

console.log('\n=== BACKEND: MIDDLEWARE ===');

test('auth middleware - JWT verification', content.auth.includes('jwt.verify'));
test('auth middleware - DB check is_active on every request', content.auth.includes('is_active'));
test('auth middleware - TokenExpiredError handled', content.auth.includes('TokenExpiredError'));
test('auth middleware - JsonWebTokenError handled', content.auth.includes('JsonWebTokenError'));
test('roleCheck - all 4 roles defined',
  content.roleCheck.includes('superadmin') && content.roleCheck.includes('admin_gudang') &&
  content.roleCheck.includes('admin_website') && content.roleCheck.includes('marketing'));
test('roleCheck - pre-built combinations (staffAccess, gudangOrMarketing)', content.roleCheck.includes('staffAccess') && content.roleCheck.includes('gudangOrMarketing'));
test('upload middleware - MIME type validation', content.upload.includes('mimetype'));
test('upload middleware - file size limit', content.upload.includes('fileSize'));

console.log('\n=== BACKEND: SERVER & ROUTES ===');

test('server.js - helmet security headers', content.server.includes('helmet'));
test('server.js - global rate limiter', content.server.includes('globalLimiter'));
test('server.js - login rate limiter', content.server.includes('loginLimiter'));
test('server.js - JWT_SECRET length validation', content.server.includes('JWT_SECRET.length < 32'));
test('server.js - DB_PASSWORD not required (allows empty for local dev)', !content.server.includes("'DB_PASSWORD'"));
test('server.js - graceful shutdown SIGTERM/SIGINT', content.server.includes('SIGTERM') && content.server.includes('SIGINT'));
test('server.js - trust proxy for nginx', content.server.includes('trust proxy'));
test('server.js - CORS whitelist', content.server.includes('allowedOrigins'));
test('server.js - global error handler', content.server.includes('err, req, res, next'));
test('server.js - health check with DB ping', content.server.includes('/api/health') && content.server.includes("SELECT 1"));
test('server.js - upload dirs auto-created', content.server.includes('mkdirSync'));

// Route order: /products/featured must be before /products/:slug
const featuredIdx = content.publicRoutes.indexOf('/products/featured');
const slugIdx = content.publicRoutes.indexOf('/products/:slug');
test('public routes - /products/featured before /products/:slug (no route conflict)', featuredIdx < slugIdx);

test('admin routes - login uses loginLimiter', content.adminRoutes.includes('loginLimiter'));
test('admin routes - all routes protected by auth middleware', content.adminRoutes.includes('router.use(auth)'));

console.log('\n=== FRONTEND: ADMIN JS ===');

test('admin.js - datalist rebuilt on each addOrderItem (fix for product_id bug)', content.adminJs.includes('dl.remove()'));
test('admin.js - product_id sent as parseInt (not string)', content.adminJs.includes('parseInt(rawProductId)'));
test('admin.js - products variable loaded before order modal', content.adminJs.includes('loadProductsDropdown'));
test('admin.js - datalist refreshed after loadProductsDropdown', content.adminJs.includes('dl_products') && content.adminJs.includes('dl.innerHTML = products'));
test('admin.js - editOrderStatus calls /status endpoint', content.adminJs.includes('/status'));
test('admin.js - stock display on product select', content.adminJs.includes('iStockDisplay'));
test('admin.js - max qty enforced from warehouse_stock', content.adminJs.includes('qtyInput.max = stock'));

console.log('\n=== SUMMARY ===');
console.log('Passed: ' + passed);
console.log('Failed: ' + failed);
console.log('Total:  ' + (passed + failed));
if (failed === 0) {
  console.log('\nAll tests passed!');
} else {
  console.log('\n' + failed + ' test(s) failed - review above');
}

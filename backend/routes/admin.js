/**
 * routes/admin.js — Admin API Routes v2
 * Jogja Furniture Enterprise System
 */
const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const role    = require('../middleware/roleCheck');
const upload  = require('../middleware/upload');

// Controllers
const authCtrl      = require('../controllers/authController');
const settingsCtrl  = require('../controllers/settingsController');
const categoriesCtrl= require('../controllers/categoriesController');
const productsCtrl  = require('../controllers/productsController');
const servicesCtrl  = require('../controllers/servicesController');
const testiCtrl     = require('../controllers/testimonialsController');
const usersCtrl     = require('../controllers/usersController');
const warehouseCtrl = require('../controllers/warehouseController');
const ordersCtrl    = require('../controllers/ordersController');

// ── AUTH (public) ─────────────────────────────────────────────
router.post('/login', authCtrl.login);

// ── Protected (all below require JWT) ─────────────────────────
router.use(auth);

// ── PROFILE & DASHBOARD ───────────────────────────────────────
router.get('/dashboard',        authCtrl.getDashboard);
router.get('/profile',          authCtrl.getProfile);
router.put('/change-password',  authCtrl.changePassword);

// ── NOTIFICATIONS ─────────────────────────────────────────────
router.get('/notifications',                    ordersCtrl.getNotifications);
router.put('/notifications/read-all',           ordersCtrl.markAllNotificationsRead);
router.put('/notifications/:id/read',           ordersCtrl.markNotificationRead);

// ══════════════════════════════════════════════════════════════
// SUPERADMIN — Control Center
// ══════════════════════════════════════════════════════════════
router.get('/control-center/stats', role.superadminOnly, usersCtrl.getControlCenterStats);

// User Management
router.get('/users',                   role.superadminOnly, usersCtrl.getAll);
router.get('/users/:id',               role.superadminOnly, usersCtrl.getOne);
router.post('/users',                  role.superadminOnly, usersCtrl.create);
router.put('/users/:id',               role.superadminOnly, usersCtrl.update);
router.post('/users/:id/reset-password', role.superadminOnly, usersCtrl.resetPassword);
router.post('/users/:id/toggle-active',  role.superadminOnly, usersCtrl.toggleActive);
router.delete('/users/:id',            role.superadminOnly, usersCtrl.remove);
router.post('/users/:id/force-logout', role.superadminOnly, usersCtrl.forceLogout);

// Activity Logs
router.get('/activity-logs',           role.superadminOnly, usersCtrl.getActivityLogs);

// Sessions
router.get('/sessions',                role.superadminOnly, usersCtrl.getSessions);

// ══════════════════════════════════════════════════════════════
// WEBSITE CMS — Admin Website + Superadmin
// ══════════════════════════════════════════════════════════════

// Settings
const settingsImageUpload = upload.fields([
  { name: 'hero_bg_image', maxCount: 1 }, { name: 'about_image_main', maxCount: 1 },
  { name: 'about_image_sec', maxCount: 1 }, { name: 'site_logo', maxCount: 1 },
]);
const setSettingsFolder = (req, res, next) => { req.uploadFolder = 'settings'; next(); };

router.get('/settings',                                                         role.websiteAccess, settingsCtrl.getAllAdmin);
router.put('/settings',              setSettingsFolder, settingsImageUpload,    role.websiteAccess, settingsCtrl.update);
router.post('/settings/image/:key',  setSettingsFolder, upload.single('image'), role.websiteAccess, settingsCtrl.uploadImage);
router.put('/settings/:key',                                                    role.websiteAccess, settingsCtrl.updateOne);

// Categories
router.get('/categories',       categoriesCtrl.getAllAdmin);
router.post('/categories',      role.warehouseAccess, (req,res,next)=>{req.uploadFolder='categories';next()}, upload.single('image'), categoriesCtrl.create);
router.put('/categories/:id',   role.warehouseAccess, (req,res,next)=>{req.uploadFolder='categories';next()}, upload.single('image'), categoriesCtrl.update);
router.delete('/categories/:id',role.superadminOnly,  categoriesCtrl.remove);

// Products - CMS (admin_website)
const productUpload   = upload.fields([{ name: 'thumbnail', maxCount: 1 }, { name: 'images', maxCount: 10 }]);
const setProductFolder= (req, res, next) => { req.uploadFolder = 'products'; next(); };

router.get('/products',                                                            productsCtrl.getAllAdmin);
router.get('/products/new-from-warehouse',    role.websiteAccess,                 productsCtrl.getNewFromWarehouse);
router.get('/products/:id',                                                        productsCtrl.getAdminById);
router.post('/products',                      role.warehouseAccess, setProductFolder, productUpload, productsCtrl.create);
router.put('/products/:id',                   role.warehouseAccess, setProductFolder, productUpload, productsCtrl.update);
router.put('/products/:id/cms',               role.websiteAccess,  setProductFolder, productUpload, productsCtrl.updateCMS);
router.put('/products/:id/publish',           role.websiteAccess,                 productsCtrl.publish);
router.put('/products/:id/unpublish',         role.websiteAccess,                 productsCtrl.unpublish);
router.put('/products/:id/status',            role.websiteAccess,                 productsCtrl.updateStatus);
router.delete('/products/:id',                role.warehouseAccess,               productsCtrl.remove);
router.delete('/products/:productId/images/:imageId', role.websiteAccess,         productsCtrl.deleteImage);
router.put('/products/:productId/images/:imageId/primary', role.websiteAccess,    productsCtrl.setPrimaryImage);

// Services (admin_website)
router.get('/services',           servicesCtrl.getAllAdmin);
router.post('/services',          role.websiteAccess, (req,res,next)=>{req.uploadFolder='services';next()}, upload.single('image'), servicesCtrl.create);
router.put('/services/:id',       role.websiteAccess, (req,res,next)=>{req.uploadFolder='services';next()}, upload.single('image'), servicesCtrl.update);
router.delete('/services/:id',    role.websiteAccess, servicesCtrl.remove);

// Testimonials (admin_website)
router.get('/testimonials',       testiCtrl.getAllAdmin);
router.post('/testimonials',      role.websiteAccess, testiCtrl.create);
router.put('/testimonials/:id',   role.websiteAccess, testiCtrl.update);
router.delete('/testimonials/:id',role.websiteAccess, testiCtrl.remove);

// Contacts (admin_website)
router.get('/contacts',           role.websiteAccess, testiCtrl.getAllContacts);
router.put('/contacts/:id/read',  role.websiteAccess, testiCtrl.markRead);
router.delete('/contacts/:id',    role.websiteAccess, testiCtrl.deleteContact);

// ══════════════════════════════════════════════════════════════
// WAREHOUSE MANAGEMENT — Admin Gudang + Superadmin
// ══════════════════════════════════════════════════════════════
router.get('/warehouse/dashboard',      role.warehouseAccess, warehouseCtrl.getDashboard);

// Stock Management
router.get('/stock/transactions',       role.warehouseAccess, warehouseCtrl.getAllTransactions);
router.post('/stock/in',                role.warehouseAccess, warehouseCtrl.stockIn);
router.post('/stock/out',               role.warehouseAccess, warehouseCtrl.stockOut);
router.post('/stock/adjustment',        role.warehouseAccess, warehouseCtrl.stockAdjustment);
router.get('/stock/summary',            role.warehouseAccess, warehouseCtrl.getStockSummary);

// Suppliers
router.get('/suppliers',                role.warehouseAccess, warehouseCtrl.getAllSuppliers);
router.post('/suppliers',               role.warehouseAccess, warehouseCtrl.createSupplier);
router.put('/suppliers/:id',            role.warehouseAccess, warehouseCtrl.updateSupplier);
router.delete('/suppliers/:id',         role.warehouseAccess, warehouseCtrl.deleteSupplier);

// Customers
router.get('/customers',                role.gudangOrMarketing, warehouseCtrl.getAllCustomers);
router.get('/customers/:id',            role.gudangOrMarketing, warehouseCtrl.getCustomer);
router.post('/customers',               role.gudangOrMarketing, warehouseCtrl.createCustomer);
router.put('/customers/:id',            role.gudangOrMarketing, warehouseCtrl.updateCustomer);
router.delete('/customers/:id',         role.warehouseAccess,   warehouseCtrl.deleteCustomer);

// ══════════════════════════════════════════════════════════════
// ORDERS — Gudang + Marketing + Superadmin
// ══════════════════════════════════════════════════════════════
router.get('/orders/stats',             role.staffAccess,     ordersCtrl.getStats);
router.get('/orders',                   role.staffAccess,     ordersCtrl.getAll);
router.get('/orders/:id',               role.staffAccess,     ordersCtrl.getOne);
router.get('/orders/:id/invoice',       role.staffAccess,     ordersCtrl.getInvoice);
router.post('/orders',                  role.gudangOrMarketing, ordersCtrl.create);
router.put('/orders/:id/status',        role.gudangOrMarketing, ordersCtrl.updateStatus);
router.put('/orders/:id',               role.gudangOrMarketing, ordersCtrl.update);
router.delete('/orders/:id',            role.warehouseAccess,   ordersCtrl.remove);

module.exports = router;

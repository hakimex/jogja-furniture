// routes/public.js
const express = require('express');
const router  = express.Router();

const settingsCtrl     = require('../controllers/settingsController');
const categoriesCtrl   = require('../controllers/categoriesController');
const productsCtrl     = require('../controllers/productsController');
const servicesCtrl     = require('../controllers/servicesController');
const testiCtrl        = require('../controllers/testimonialsController');

// Settings
router.get('/settings',              settingsCtrl.getAll);
router.get('/settings/group/:group', settingsCtrl.getByGroup);

// Categories
router.get('/categories',        categoriesCtrl.getAll);
router.get('/categories/:slug',  categoriesCtrl.getOne);

// Products
router.get('/products',          productsCtrl.getAll);
router.get('/products/featured', productsCtrl.getFeatured);
router.get('/products/:slug',    productsCtrl.getOne);

// Services
router.get('/services',          servicesCtrl.getAll);
router.get('/services/:slug',    servicesCtrl.getOne);

// Testimonials
router.get('/testimonials',      testiCtrl.getAll);

// Contact form
router.post('/contact',          testiCtrl.submitContact);

module.exports = router;

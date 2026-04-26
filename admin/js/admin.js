/**
 * admin.js v2.0 — Jogja Furniture Enterprise Admin Panel
 * Roles: superadmin | admin_gudang | admin_website | marketing
 */

'use strict';

// --------------------------------------------------------------------------------------------------
// CONFIG & STATE
// --------------------------------------------------------------------------------------------------
const API = '/api/admin';
let token = localStorage.getItem('jf_token');
let me = JSON.parse(localStorage.getItem('jf_user') || 'null');
let editingId = null;
let currentModule = 'cms';
let orderItemCount = 0;
let stockSummaryData = [];
let categories = [];
let customers = [];
let suppliers = [];
let products = [];
let currentPageId = 'dashboard';

// ---------------- Page Rules & Logic ----------------
const PAGE_RULES = {
  'dashboard': `
    <ul>
      <li><strong>Statistik Utama:</strong> Menampilkan ringkasan data operasional sesuai role (Admin Website tidak melihat data sensitif keuangan).</li>
      <li><strong>Dashboard Executive:</strong> Menampilkan 12 metrik kritikal termasuk stok kritis, pesan belum dibaca, dan performa order.</li>
      <li><strong>Role-Based View:</strong> Kartu statistik (seperti Total Customer/Supplier) hanya muncul pada dashboard yang relevan.</li>
    </ul>`,
  'products': `
    <ul>
      <li><strong>Role-Based Tabs:</strong> Saat tambah/edit produk, tab menu disesuaikan dengan role. Admin Gudang hanya melihat info stok, Admin Website fokus pada konten & SEO.</li>
      <li><strong>Harga:</strong> Admin Gudang mengelola Harga Modal (HPP), Admin Website mengelola Harga Tampil & Harga Jual.</li>
      <li><strong>Status Stok:</strong> Warna indikator: Merah (Habis), Kuning (≤ 5), Hijau (Tersedia).</li>
    </ul>`,
  'orders': `
    <ul>
      <li><strong>Manajemen Stok:</strong> Stok fisik di gudang otomatis sinkron saat status order berubah (Potong stok saat Confirmed, Kembalikan saat Cancelled).</li>
      <li><strong>Summary View:</strong> Klik ikon 🔍 untuk melihat ringkasan pesanan tanpa perlu masuk ke mode edit (aman dari perubahan tidak sengaja).</li>
      <li><strong>Invoice:</strong> Klik ikon 🧾 untuk mencetak invoice resmi dalam format PDF yang rapi.</li>
    </ul>`,
  'stock': `
    <ul>
      <li><strong>Barang Masuk/Keluar:</strong> Mencatat pergerakan stok manual lengkap dengan nomor referensi dan catatan audit.</li>
      <li><strong>Auto-Generate SKU:</strong> Sistem memberikan kode SKU unik secara otomatis untuk setiap produk baru.</li>
    </ul>`,
  'stock-summary': `
    <ul>
      <li><strong>Fitur Sorting:</strong> Klik judul kolom (SKU, Produk, Stok, dsb) untuk mengurutkan data dari terkecil ke terbesar atau sebaliknya.</li>
      <li><strong>Nilai Inventaris:</strong> Menghitung total aset barang berdasarkan (Stok x Harga Modal).</li>
    </ul>`,
  'stock-transactions': `
    <ul>
      <li><strong>Fitur Pencarian:</strong> Gunakan kotak pencarian untuk melacak riwayat transaksi berdasarkan nama produk, SKU, atau nomor referensi.</li>
      <li><strong>Audit Trail:</strong> Mencatat detail "Oleh Siapa" setiap pergerakan stok terjadi.</li>
    </ul>`,
  'customers': `
    <ul>
      <li><strong>Riwayat Transaksi:</strong> Klik ikon 📜 untuk melihat daftar pesanan pelanggan tersebut dalam jendela pop-up ringkas.</li>
      <li><strong>Quick Detail:</strong> Dari dalam riwayat pelanggan, Anda bisa langsung melihat detail item pesanan tanpa berpindah halaman.</li>
    </ul>`,
  'users': `
    <ul>
      <li><strong>Manajemen Akses:</strong> Superadmin dapat mengelola user, mengganti password, dan mengatur role akses (Gudang, Website, Marketing).</li>
    </ul>`,
  'categories': `
    <ul>
      <li><strong>SEO & URL:</strong> Pastikan Slug (URL) unik dan deskriptif untuk performa pencarian Google yang lebih baik.</li>
    </ul>`,
  'settings': `
    <ul>
      <li><strong>Global Identity:</strong> Pengaturan nama toko, logo, dan alamat akan otomatis ter-update di seluruh website dan Invoice PDF.</li>
    </ul>`
};

// ---------------- Debounce ----------------
const debounce = (fn, ms) => {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
};

// ---------------- Toast ----------------
function toast(msg, type = 'success') {
  const el = document.createElement('div');
  const colors = { success: '#28a745', error: '#dc3545', warning: '#ffc107', info: '#17a2b8' };
  el.style.cssText = `background:${colors[type] || colors.success};color:#fff;padding:.75rem 1.2rem;border-radius:8px;font-size:.85rem;box-shadow:0 4px 16px rgba(0,0,0,.18);max-width:340px;animation:slideIn .3s ease`;
  el.textContent = msg;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(() => el.remove(), 3800);
}

// ---------------- API Helper ----------------
async function api(method, path, data, isForm = false) {
  const opts = {
    method,
    headers: { Authorization: `Bearer ${token}` },
  };
  if (data) {
    if (isForm) {
      opts.body = data;
    } else {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(data);
    }
  }
  const res = await fetch(API + path, opts);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Request gagal');
  return json;
}

// ---------------- Format helpers ----------------
const fmtDate = (d) => d ? new Date(d).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtDateOnly = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtRp = (n) => n ? 'Rp ' + Number(n).toLocaleString('id-ID') : 'Rp 0';
const badge = (val, map) => { const cls = map[val] || ''; return `<span class="badge ${cls}">${val || '-'}</span>`; };
const statusBadge = (s) => `<span class="badge badge-${s}">${statusLabel(s)}</span>`;
const statusLabel = (s) => ({
  new: 'Baru', draft: 'Draft', review: 'Review', ready: 'Siap Publish',
  published: 'Published', hidden: 'Hidden', out_of_stock: 'Out of Stock', archived: 'Archived',
  pending: 'Pending', confirmed: 'Confirmed', processing: 'Processing', ready: 'Ready',
  delivered: 'Delivered', cancelled: 'Cancelled', refunded: 'Refunded',
  paid: 'Paid', unpaid: 'Unpaid', partial: 'Partial',
  superadmin: 'Superadmin', admin_gudang: 'Admin Gudang', admin_website: 'Admin Website', marketing: 'Marketing',
  in: 'Masuk', out: 'Keluar', adjustment: 'Adjustment'
})[s] || s;

// ---------------- Tom Select Helper ----------------
function initTomSelect(id) {
  const el = document.getElementById(id);
  if (!el || typeof TomSelect === 'undefined') return;
  if (el.tomselect) el.tomselect.destroy();
  new TomSelect(el, {
    create: false,
    placeholder: el.options[0]?.text || "Pilih..."
  });
}

// --------------------------------------------------------------------------------------------------
// AUTH & INIT
// --------------------------------------------------------------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
  if (!token || !me) { window.location.href = 'index.html'; return; }
  initUI();

  // Land on correct dashboard by role
  if (me.role === 'admin_gudang') {
    navigateTo('warehouse-dashboard');
  } else if (me.role === 'superadmin') {
    switchModule('control');
  } else if (me.role === 'marketing') {
    navigateTo('marketing-dashboard');
  } else {
    navigateTo('dashboard');
  }

  loadNotifications();
  loadProfile(); // Sync fresh data (Last Login, etc)
  setInterval(loadNotifications, 60000);
});

function initUI() {
  // Avatar & name
  document.getElementById('adminAvatar').textContent = (me.full_name || me.username || 'A')[0].toUpperCase();
  document.getElementById('adminName').textContent = me.full_name || me.username;
  document.getElementById('adminRoleLabel').textContent = roleLabel(me.role);

  // Superadmin module bar
  if (me.role === 'superadmin') {
    document.getElementById('topModuleBar').classList.add('show');
    document.body.classList.add('superadmin-mode');
  }

  // Hide Add Product button for marketing
  if (me.role === 'marketing') {
    const btnAddProd = document.getElementById('btnAddProduct');
    if (btnAddProd) btnAddProd.style.display = 'none';
  }

  buildSidebar();

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('jf_token');
    localStorage.removeItem('jf_user');
    window.location.href = 'index.html';
  });

  document.getElementById('sidebarToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });
  document.getElementById('sidebarOverlay')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
  });

  // Slug auto-gen from product name
  const pName = document.getElementById('pName');
  if (pName) pName.addEventListener('input', autoSlug);

  // Auto-select text on focus for number inputs
  document.addEventListener('focus', (e) => {
    if (e.target.tagName === 'INPUT' && e.target.type === 'number') {
      e.target.select();
    }
  }, true);
}

function roleLabel(r) {
  return { superadmin: '👑 Superadmin', admin_gudang: '🏭 Admin Gudang', admin_website: '🌐 Admin Website', marketing: '📢 Marketing' }[r] || r;
}
// --------------------------------------------------------------------------------------------------
// SIDEBAR BUILDER
// --------------------------------------------------------------------------------------------------
const MENUS = {
  cms: [
    { icon: '📊', label: 'Dashboard', page: 'dashboard' },
    { section: 'Website CMS' },
    { icon: '🆕', label: 'Produk Baru', page: 'products-new', roles: ['superadmin', 'admin_website'] },
    { icon: '📦', label: 'Kelola Produk', page: 'products' },
    { icon: '🗂', label: 'Kategori', page: 'categories' },
    { icon: '🛠', label: 'Layanan', page: 'services', roles: ['superadmin', 'admin_website'] },
    { section: 'Interaksi' },
    { icon: '💬', label: 'Testimoni', page: 'testimonials', roles: ['superadmin', 'admin_website'] },
    { icon: '📨', label: 'Pesan Masuk', page: 'contacts', roles: ['superadmin', 'admin_website'] },
    { section: 'Konfigurasi' },
    { icon: '⚙️', label: 'Settings / CMS', page: 'settings', roles: ['superadmin', 'admin_website'] },
    { icon: '👤', label: 'Profil Saya', page: 'profile' },
  ],
  warehouse: [
    { icon: '📊', label: 'Dashboard Gudang', page: 'warehouse-dashboard' },
    { section: 'Produk & Stok' },
    { icon: '📦', label: 'Master Produk', page: 'products' },
    { icon: '🗂', label: 'Kategori', page: 'categories' },
    { icon: '📥', label: 'Barang Masuk / Keluar', page: 'stock' },
    { icon: '📊', label: 'Ringkasan Stok', page: 'stock-summary' },
    { icon: '📋', label: 'Riwayat Transaksi', page: 'stock-transactions' },
    { section: 'Relasi Bisnis' },
    { icon: '🏢', label: 'Supplier', page: 'suppliers' },
    { icon: '👥', label: 'Customer', page: 'customers' },
    { icon: '🛒', label: 'Order', page: 'orders' },
    { section: 'Profil' },
    { icon: '👤', label: 'Profil Saya', page: 'profile' },
  ],
  control: [
    { icon: '🛡️', label: 'Executive Dashboard', page: 'control-center', roles: ['superadmin'] },
    { section: 'Manajemen User' },
    { icon: '👤', label: 'Daftar User', page: 'users', roles: ['superadmin'] },
    { icon: '📋', label: 'Activity Log', page: 'activity-logs', roles: ['superadmin'] },
    { section: 'Monitoring' },
    { icon: '👤', label: 'Profil Saya', page: 'profile' },
  ],
  marketing: [
    { icon: '📊', label: 'Dashboard Marketing', page: 'marketing-dashboard' },
    { section: 'Operasional' },
    { icon: '🛒', label: 'Order', page: 'orders' },
    { icon: '👥', label: 'Customer', page: 'customers' },
    { section: 'Produk' },
    { icon: '📦', label: 'Produk Published', page: 'products' },
    { section: 'Profil' },
    { icon: '👤', label: 'Profil Saya', page: 'profile' },
  ]
};

// Marketing extra
const MARKETING_MENUS = [
  { icon: '📊', label: 'Dashboard', page: 'marketing-dashboard' },
  { section: 'Operasional' },
  { icon: '🛒', label: 'Order', page: 'orders' },
  { icon: '👥', label: 'Customer', page: 'customers' },
  { section: 'Produk' },
  { icon: '📦', label: 'Produk Published', page: 'products' },
  { section: 'Profil' },
  { icon: '👤', label: 'Profil Saya', page: 'profile' },
];

function buildSidebar(module = 'cms') {
  const nav = document.getElementById('sidebarNav');
  nav.innerHTML = '';
  let menus;

  if (me.role === 'marketing') {
    menus = MARKETING_MENUS;
  } else if (me.role === 'superadmin') {
    menus = MENUS[module] || MENUS.cms;
  } else if (me.role === 'admin_gudang') {
    menus = MENUS.warehouse;
  } else {
    menus = MENUS.cms;
  }

  menus.forEach(item => {
    if (item.section) {
      const s = document.createElement('div');
      s.className = 'nav-section-title';
      s.textContent = item.section;
      nav.appendChild(s);
      return;
    }
    if (item.roles && !item.roles.includes(me.role)) return;
    const el = document.createElement('div');
    el.className = 'nav-item';
    el.dataset.page = item.page;
    el.innerHTML = `<span class="nav-icon">${item.icon}</span> ${item.label}${item.page === 'contacts' ? '<span id="contactUnreadBadge"></span>' : ''}`;
    el.addEventListener('click', () => navigateTo(item.page));
    nav.appendChild(el);
  });

  // Set active first item
  const firstItem = nav.querySelector('.nav-item');
  if (firstItem) firstItem.classList.add('active');
}

// --------------------------------------------------------------------------------------------------
// NAVIGATION
// --------------------------------------------------------------------------------------------------
function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add('active');

  const navEl = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navEl) navEl.classList.add('active');

  currentPageId = page;

  // Close sidebar on mobile after navigation
  document.getElementById('sidebar')?.classList.remove('open');

  const pageTitles = {
    'dashboard': '📊 Dashboard', 'products': '📦 Manajemen Produk',
    'products-new': '🆕 Produk Baru dari Gudang', 'categories': '🗂 Kategori & Menu Website',
    'services': '🛠 Layanan', 'testimonials': '💬 Testimoni', 'contacts': '📨 Pesan Masuk',
    'settings': '⚙️ Settings / CMS', 'warehouse-dashboard': '📊 Dashboard Gudang',
    'marketing-dashboard': '📊 Dashboard Marketing',
    'stock': '📥 Stok Manajemen', 'stock-summary': '📊 Ringkasan Stok Produk', 'stock-transactions': '📋 Transaksi Stok',
    'suppliers': '🏢 Supplier', 'customers': '👥 Customer', 'orders': '🛒 Order',
    'invoice-view': '🧾 Invoice', 'users': '👤 User Management',
    'activity-logs': '📋 Activity Log', 'control-center': '🛡️ Executive Dashboard',
    'notifications': '🔔 Notifikasi', 'profile': '👤 Profil Saya',
  };
  document.getElementById('pageTitle').textContent = pageTitles[page] || page;

  // Load data on navigate
  const loaders = {
    'dashboard': loadDashboard,
    'marketing-dashboard': loadMarketingDashboard,
    'products': loadProducts,
    'products-new': loadNewProducts,
    'categories': loadCategories,
    'services': loadServices,
    'testimonials': loadTestimonials,
    'contacts': loadContacts,
    'settings': loadSettings,
    'warehouse-dashboard': loadWarehouseDashboard,
    'stock': () => { loadStockSummary(); loadProductsDropdown(); loadSuppliersDropdown(); setVal('soRef', `OUT-${Math.floor(Date.now() / 1000).toString().slice(-6)}`); },
    'stock-summary': loadStockSummary, 'stock-transactions': loadTransactions,
    'suppliers': loadSuppliers,
    'customers': loadCustomers,
    'orders': () => { loadOrders(); loadOrderStats(); loadCustomersDropdown(); loadProductsDropdown(); },
    'users': loadUsers,
    'activity-logs': loadActivityLogs,
    'control-center': loadControlCenter,
    'notifications': loadNotifications,
    'profile': loadProfile,
  };
  if (loaders[page]) loaders[page]();
}

// --------------------------------------------------------------------------------------------------
// MODULE SWITCHER (Superadmin)
// --------------------------------------------------------------------------------------------------
function switchModule(mod) {
  currentModule = mod;
  document.querySelectorAll('.module-btn').forEach(b => b.classList.remove('active'));
  const btnMap = { cms: 'modBtnCms', warehouse: 'modBtnWarehouse', marketing: 'modBtnMarketing', control: 'modBtnControl' };
  const el = document.getElementById(btnMap[mod]);
  if (el) el.classList.add('active');

  buildSidebar(mod);

  const firstPages = { cms: 'dashboard', warehouse: 'warehouse-dashboard', marketing: 'marketing-dashboard', control: 'control-center' };
  navigateTo(firstPages[mod] || 'dashboard');
}

// --------------------------------------------------------------------------------------------------
// MODAL HELPERS
// --------------------------------------------------------------------------------------------------
function openModal(id) { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
  editingId = null;
}

function showPageRules() {
  const content = PAGE_RULES[currentPageId] || '<p>Belum ada aturan khusus untuk halaman ini.</p>';
  const title = document.getElementById('pageTitle').textContent;
  document.getElementById('rulesTitle').innerHTML = `💡 Logika & Aturan: ${title}`;
  document.getElementById('rulesContent').innerHTML = content;
  openModal('modalPageRules');
}
function previewImg(input, previewId) {
  const file = input.files[0];
  const prev = document.getElementById(previewId);
  if (!prev) return;
  if (file) {
    prev.src = URL.createObjectURL(file);
    prev.style.display = 'block';
  } else {
    prev.style.display = 'none';
  }
}
function setVal(id, val) { const el = document.getElementById(id); if (el) el.value = val ?? ''; }
function getVal(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }
function getChecked(id) { const el = document.getElementById(id); return el ? el.checked : false; }
function setChecked(id, v) { const el = document.getElementById(id); if (el) el.checked = !!v; }

// --------------------------------------------------------------------------------------------------
// PAGINATION BUILDER
// --------------------------------------------------------------------------------------------------
function buildPagination(containerId, pagination, onPageClick) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!pagination) { el.innerHTML = ''; return; }
  const { total, page, limit, totalPages } = pagination;
  el.innerHTML = `
    <span>${((page - 1) * limit) + 1}–${Math.min(page * limit, total)} dari ${total}</span>
    <div class="pagination-btns">
      <button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="${onPageClick}(${page - 1})">‹</button>
      ${Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
    const p = i + 1;
    return `<button class="page-btn${p === page ? ' active' : ''}" onclick="${onPageClick}(${p})">${p}</button>`;
  }).join('')}
      <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="${onPageClick}(${page + 1})">›</button>
    </div>`;
}

// --------------------------------------------------------------------------------------------------
// DASHBOARD
// --------------------------------------------------------------------------------------------------
async function loadDashboard() {
  try {
    const data = await api('GET', '/dashboard');
    const s = data.data.stats;
    const statsEl = document.getElementById('dashStats');
    if (!statsEl) return;

    if (me.role === 'admin_gudang') {
      statsEl.innerHTML = buildStatCards([
        { icon: '📦', label: 'Total Produk', val: s.total_products, cls: 'brown' },
        { icon: '🏢', label: 'Total Supplier', val: s.total_suppliers, cls: 'green' },
        { icon: '🆕', label: 'Order Hari Ini', val: s.today_orders, cls: 'teal' },
        { icon: '📋', label: 'Total Order', val: s.total_orders, cls: 'blue' },
      ]);
    } else if (me.role === 'marketing') {
      statsEl.innerHTML = buildStatCards([
        { icon: '📦', label: 'Produk Published', val: s.total_products, cls: 'brown' },
        { icon: '🆕', label: 'Order Hari Ini', val: s.today_orders, cls: 'teal' },
        { icon: '👥', label: 'Total Customer', val: s.total_customers, cls: 'blue' },
        { icon: '📨', label: 'Pesan Baru', val: s.unread_contacts, cls: 'red' },
        { icon: '⭐', label: 'Produk Unggulan', val: s.featured_products, cls: 'orange' },
      ]);
    } else {
      statsEl.innerHTML = buildStatCards([
        { icon: '📦', label: 'Total Produk', val: s.total_products, cls: 'brown' },
        { icon: '🗂', label: 'Kategori', val: s.total_categories, cls: 'green' },
        { icon: '🛠', label: 'Layanan', val: s.total_services, cls: 'blue' },
        { icon: '⭐', label: 'Unggulan', val: s.featured_products, cls: 'orange' },
        { icon: '📨', label: 'Pesan Baru', val: s.unread_contacts, cls: 'red' },
        { icon: '💬', label: 'Testimoni', val: s.total_testimonials, cls: 'brown' }
      ]);
    }

    // Recent contacts
    const h1 = document.getElementById('dash1Head');
    const b1 = document.getElementById('dash1Body');
    const btn1 = document.getElementById('dash1Btn');
    if (h1) { h1.innerHTML = '<th>Nama</th><th>Subjek</th><th>Waktu</th><th>Status</th>'; }
    if (b1) {
      b1.innerHTML = (data.data.recent_contacts || []).map(c => `
        <tr>
          <td>${c.name}</td>
          <td>${c.subject || '—'}</td>
          <td>${fmtDateOnly(c.created_at)}</td>
          <td>${c.is_read ? '<span class="badge badge-active">Dibaca</span>' : '<span class="badge badge-unread">Baru</span>'}</td>
        </tr>`).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--text-light)">Belum ada pesan</td></tr>';
    }
    if (btn1) { btn1.onclick = () => navigateTo('contacts'); }

    // Top products as bar chart
    const topProds = data.data.top_products || [];
    if (topProds.length) {
      const canvas = document.getElementById('chartTopProducts');
      if (canvas) {
        if (canvas._chartInstance) canvas._chartInstance.destroy();
        canvas._chartInstance = new Chart(canvas, {
          type: 'bar',
          data: {
            labels: topProds.map(p => p.name.length > 18 ? p.name.substring(0, 18) + '...' : p.name),
            datasets: [{
              label: 'Views',
              data: topProds.map(p => p.view_count || 0),
              backgroundColor: ['#C49A6C', '#D4A97A', '#5C2E0E', '#8B4513', '#A0522D'],
              borderRadius: 6, borderSkipped: false,
            }]
          },
          options: {
            responsive: true, plugins: { legend: { display: false } },
            scales: {
              x: { ticks: { font: { size: 11 }, maxRotation: 30 } },
              y: { ticks: { precision: 0 }, grid: { color: '#f0ebe3' } }
            }
          }
        });
      }
    }
  } catch (e) { console.error(e); }
}

async function loadMarketingDashboard() {
  try {
    const [dashData, orderStats, recentOrders] = await Promise.all([
      api('GET', '/dashboard'),
      api('GET', '/orders/stats'),
      api('GET', '/orders?limit=5')
    ]);

    const s = dashData.data.stats;
    const os = orderStats.data;

    document.getElementById('marketStats').innerHTML = buildStatCards([
      { icon: '📦', label: 'Produk Published', val: s.total_products, cls: 'brown' },
      { icon: '👥', label: 'Total Customer', val: s.total_customers || 0, cls: 'blue' },
      { icon: '🆕', label: 'Order Hari Ini', val: os.today_count || 0, cls: 'teal' },
      { icon: '📅', label: 'Order Bulan Ini', val: os.month_confirmed_count || 0, cls: 'orange' },
      { icon: '📋', label: 'Total Order', val: os.total || 0, cls: 'green' },
      { icon: '📨', label: 'Pesan Baru', val: s.unread_contacts || 0, cls: 'red' },
      { icon: '⭐', label: 'Produk Unggulan', val: s.featured_products || 0, cls: 'orange' },
      { icon: '🗂', label: 'Kategori', val: s.total_categories || 0, cls: 'green' }
    ]);

    // Recent orders
    document.getElementById('marketOrderBody').innerHTML = (recentOrders.data || []).map(o => `
      <tr>
        <td style="font-weight:600">#${o.id}</td>
        <td>${o.customer_name}</td>
        <td>${fmtRp(o.total)}</td>
        <td>${statusBadge(o.status)}</td>
      </tr>`).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--text-light);padding:1rem">Belum ada order</td></tr>';

    // Top products chart
    const topProds = dashData.data.top_products || [];
    const canvas = document.getElementById('chartMarketTop');
    if (canvas && topProds.length) {
      if (canvas._chartInstance) canvas._chartInstance.destroy();
      canvas._chartInstance = new Chart(canvas, {
        type: 'bar',
        data: {
          labels: topProds.map(p => p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name),
          datasets: [{
            label: 'Views',
            data: topProds.map(p => p.view_count || 0),
            backgroundColor: '#C49A6C',
            borderRadius: 4,
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { precision: 0, font: { size: 10 } }, grid: { color: '#f0ebe3' } },
            y: { ticks: { font: { size: 10 } } }
          }
        }
      });
    }
  } catch (e) { toast(e.message, 'error'); }
}

function buildStatCards(items) {
  return items.map(i => `
    <div class="stat-card" ${i.onclick ? `onclick="${i.onclick}" style="cursor:pointer"` : ''}>
      <div class="stat-icon ${i.cls}">${i.icon}</div>
      <div><div class="stat-num">${i.val ?? 0}</div><div class="stat-lbl">${i.label}</div></div>
    </div>`).join('');
}

function filterProductsBy(status) {
  navigateTo('products');
  const el = document.getElementById('prodStatusFilter');
  if (el) {
    el.value = status;
    // Jika menggunakan TomSelect, harus di-sync
    if (el.tomselect) el.tomselect.setValue(status);
    loadProducts(1);
  }
}

// --------------------------------------------------------------------------------------------------
// PRODUCTS
// --------------------------------------------------------------------------------------------------
let prodPage = 1;
async function loadProducts(page = 1) {
  prodPage = page;
  const thPrice = document.getElementById('th-price');
  if (thPrice) {
    if (me.role === 'admin_gudang' || me.role === 'superadmin') thPrice.textContent = 'Harga Beli';
    else if (me.role === 'admin_website' || me.role === 'marketing') thPrice.textContent = 'Harga Jual';
    else thPrice.textContent = 'Harga';
  }
  const search = getVal('prodSearch');
  const cat = getVal('prodCatFilter');
  const status = getVal('prodStatusFilter');
  adjustStatusFilterByRole();
  try {
    const data = await api('GET', `/products?page=${page}&limit=20&search=${encodeURIComponent(search)}&category=${cat}&status=${status}`);
    const rows = data.data;
    document.getElementById('prodBody').innerHTML = rows.map(p => `
      <tr>
        <td style="display:flex;align-items:center;gap:.6rem">
          ${p.thumbnail ? `<img src="/uploads/products/${p.thumbnail}" style="width:44px;height:44px;border-radius:6px;object-fit:cover">` : `<div style="width:44px;height:44px;border-radius:6px;background:var(--gray100);display:flex;align-items:center;justify-content:center;font-size:1.3rem">📦</div>`}
          <div><div style="font-size:.85rem;font-weight:500">${p.name}</div><div style="font-size:.72rem;color:var(--text-light)">${p.sku || '—'}</div></div>
        </td>
        <td>${p.category_name || '—'}</td>
        <td>${statusBadge(p.publish_status)}</td>
        <td><span style="font-weight:600;color:${p.warehouse_stock <= 3 ? 'var(--danger)' : p.warehouse_stock <= 10 ? 'var(--warning)' : 'var(--success)'}">${p.warehouse_stock ?? 0}</span> ${p.unit || 'unit'}</td>
        <td style="font-size:.82rem">
          ${(me.role === 'admin_gudang' || me.role === 'superadmin') ? fmtRp(p.cost_price) :
        (me.role === 'admin_website' || me.role === 'marketing') ? fmtRp(p.sell_price) :
          (p.price_label || '—')}
        </td>
        <td>${p.is_featured ? '⭐' : '—'}</td>
<td>
          <div style="display:flex;gap:.35rem;flex-wrap:wrap">
            ${me.role !== 'marketing' ? `<button class="btn btn-sm btn-outline" onclick="editProduct(${p.id})">✏️</button>` : `<button class="btn btn-sm btn-outline" title="Lihat Detail" onclick="openProductModal(${p.id}, true)">👁️</button>`}
            ${(me.role === 'admin_website' || me.role === 'superadmin') && p.publish_status !== 'published' ? `<button class="btn btn-sm btn-success" onclick="quickPublish(${p.id})">🌐</button>` : ''}
            ${(me.role === 'admin_website' || me.role === 'superadmin') && p.publish_status === 'published' ? `<button class="btn btn-sm btn-outline" onclick="quickUnpublish(${p.id})">🙈</button>` : ''}
            ${me.role === 'admin_gudang' || me.role === 'superadmin' ? `<button class="btn btn-sm btn-danger" onclick="deleteProduct(${p.id})">🗑</button>` : ''}
          </div>
        </td>
      </tr>`).join('') || '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-light)">Tidak ada produk ditemukan</td></tr>';

    buildPagination('prodPagination', data.pagination, 'loadProducts');

    // Show "new product" alert for admin_website
    if (me.role === 'admin_website' || me.role === 'superadmin') {
      const newAlert = document.getElementById('newProductAlert');
      if (newAlert) {
        const newCount = rows.filter(p => p.publish_status === 'new').length;
        newAlert.style.display = newCount > 0 ? 'inline' : 'none';
      }
    }

    // Populate category filter
    if (categories.length && document.getElementById('prodCatFilter').options.length <= 1) {
      categories.forEach(c => {
        const opt = new Option(c.name, c.slug);
        document.getElementById('prodCatFilter').add(opt);
      });
    }
  } catch (e) { toast(e.message, 'error'); }
}


function adjustStatusFilterByRole() {
  const el = document.getElementById('prodStatusFilter');
  if (!el) return;
  const role = me.role;
  const options = el.querySelectorAll('option');
  options.forEach(opt => {
    const val = opt.value;
    if (!val) return;
    let visible = true;
    if (role === 'admin_gudang') visible = ['low_stock', 'out_of_stock', 'archived'].includes(val);
    else if (role === 'admin_website') visible = ['new', 'draft', 'review', 'ready', 'published', 'hidden'].includes(val);
    else if (role === 'marketing') visible = ['published', 'low_stock', 'out_of_stock'].includes(val);
    opt.style.display = visible ? '' : 'none';
  });
}

async function loadNewProducts(page = 1) {
  try {
    const data = await api('GET', `/products/new-from-warehouse?page=${page}&limit=20`);
    document.getElementById('newProdBody').innerHTML = data.data.map(p => `
      <tr>
        <td><strong style="font-size:.85rem">${p.name}</strong></td>
        <td style="font-size:.8rem;color:var(--text-light)">${p.sku || '—'}</td>
        <td>${p.category_name || '—'}</td>
        <td>${statusBadge(p.publish_status)}</td>
        <td style="font-size:.82rem">${p.created_by_name || '—'}</td>
        <td style="font-size:.82rem">${fmtDateOnly(p.created_at)}</td>
        <td>
          <div style="display:flex;gap:.35rem">
            <button class="btn btn-sm btn-primary" onclick="editProduct(${p.id})">✏️</button>
            ${p.publish_status !== 'published' ? `<button class="btn btn-sm btn-success" onclick="quickPublish(${p.id})">🌐</button>` : ''}
          </div>
        </td>
      </tr>`).join('') || '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-light)">Tidak ada produk baru dari gudang</td></tr>';
    buildPagination('newProdPagination', data.pagination, 'loadNewProducts');
  } catch (e) { toast(e.message, 'error'); }
}

async function loadProductsDropdown() {
  try {
    const data = await api('GET', '/products?limit=200');
    products = data.data;
    ['siProduct', 'soProduct'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.innerHTML = '<option value="">Pilih produk...</option>';
      products.forEach(p => el.add(new Option(`[${p.sku || '—'}] ${p.name} (Stok: ${p.warehouse_stock ?? 0})`, p.id)));
      initTomSelect(id);
    });
    // Stock display on product change
    const soEl = document.getElementById('soProduct');
    if (soEl) {
      soEl.addEventListener('change', () => {
        const prod = products.find(p => p.id == soEl.value);
        const el = document.getElementById('soCurrentStock');
        if (el) el.textContent = prod ? `${prod.warehouse_stock} ${prod.unit || 'unit'}` : '—';
      });
    }

    // Refresh datalist order jika sudah ada di DOM
    const dl = document.getElementById('dl_products');
    if (dl && products.length) {
      dl.innerHTML = products.map(p => {
        const lbl = p.sku ? `[${p.sku}] ${p.name}` : p.name;
        return `<option value="${lbl}">`;
      }).join('');
    }
  } catch (e) { }
}

function openProductModal(id = null, isViewOnly = false) {
  editingId = id;
  // Reset form
  ['pName', 'pSku', 'pSlug', 'pPriceLabel', 'pMaterial', 'pDimensions', 'pShortDesc', 'pDesc', 'pSpec', 'pTags', 'pMetaTitle', 'pMetaDesc'].forEach(f => setVal(f, ''));
  setVal('pSortOrder', ''); setVal('pStock', ''); setVal('pCostPrice', ''); setVal('pSellPrice', '');
  setChecked('pFeatured', false); setVal('pStatus', 'new'); setVal('pCategory', ''); setVal('pUnit', 'unit');
  const prevEl = document.getElementById('prevThumb');
  if (prevEl) prevEl.style.display = 'none';
  document.getElementById('existingImgGrid').innerHTML = '';
  document.getElementById('modalProductTitle').textContent = isViewOnly ? 'Detail Produk' : (id ? 'Edit Produk' : 'Tambah Produk Baru');

  // Role-based tab visibility
  const tabInfo = document.getElementById('tabInfo');
  const tabWH = document.getElementById('tabWH');
  const tabContent = document.getElementById('tabContent');
  const tabImages = document.getElementById('tabImages');
  const tabSeo = document.getElementById('tabSeo');

  const isGudang = me.role === 'admin_gudang';
  const isWebMark = me.role === 'admin_website' || me.role === 'marketing';
  const isSuper = me.role === 'superadmin';

  if (tabInfo) tabInfo.style.display = ''; // Always show Info
  if (tabWH) tabWH.style.display = (isGudang || isSuper) ? '' : 'none';
  if (tabContent) tabContent.style.display = (isWebMark || isSuper) ? '' : 'none';
  if (tabImages) tabImages.style.display = ''; // Everyone can manage images
  if (tabSeo) tabSeo.style.display = (isWebMark || isSuper) ? '' : 'none';

  // Role-based field visibility (Inside Info tab)
  const pStatusGroup = document.getElementById('pStatusGroup');
  const pFeaturedGroup = document.getElementById('pFeatured')?.closest('.form-group');
  const pSellPriceInfoGroup = document.getElementById('pSellPriceInfoGroup');
  const pSlugGroup = document.getElementById('pSlug')?.closest('.form-group');
  const pPriceLabelGroup = document.getElementById('pPriceLabel')?.closest('.form-group');
  const pOrderGroup = document.getElementById('pSortOrder')?.closest('.form-group');

  if (pStatusGroup) pStatusGroup.style.display = (isWebMark || isSuper) ? '' : 'none';
  if (pFeaturedGroup) pFeaturedGroup.style.display = (isWebMark || isSuper) ? '' : 'none';
  if (pSellPriceInfoGroup) pSellPriceInfoGroup.style.display = (isWebMark || isSuper) ? '' : 'none';
  if (pSlugGroup) pSlugGroup.style.display = (isWebMark || isSuper) ? '' : 'none';
  if (pPriceLabelGroup) pPriceLabelGroup.style.display = (isWebMark || isSuper) ? '' : 'none';
  if (pOrderGroup) pOrderGroup.style.display = (isWebMark || isSuper) ? '' : 'none';

  // View-Only logic
  const saveBtn = document.getElementById('saveProductBtn');
  if (saveBtn) saveBtn.style.display = isViewOnly ? 'none' : '';
  const inputs = document.getElementById('modalProduct').querySelectorAll('input, select, textarea');
  inputs.forEach(el => el.disabled = isViewOnly);

  // Load categories dropdown
  loadCategoriesDropdown();
  switchProdTab('info', document.querySelector('#productTabBar .settings-tab'));

  if (id) {
    api('GET', `/products/${id}`).then(data => {
      const p = data.data;
      ['name', 'sku', 'slug', 'price_label', 'material', 'dimensions', 'short_desc', 'description', 'specification', 'meta_title', 'meta_desc'].forEach(f => {
        const map = { description: 'pDesc', specification: 'pSpec', short_desc: 'pShortDesc', name: 'pName', sku: 'pSku', slug: 'pSlug', price_label: 'pPriceLabel', material: 'pMaterial', dimensions: 'pDimensions', meta_title: 'pMetaTitle', meta_desc: 'pMetaDesc' };
        setVal(map[f] || f, p[f]);
      });
      setVal('pCategory', p.category_id || ''); setVal('pSortOrder', p.sort_order || 0);
      setVal('pStock', p.warehouse_stock || 0); setVal('pUnit', p.unit || 'unit');
      setVal('pCostPrice', p.cost_price || 0); setVal('pSellPrice', p.sell_price || 0);
      setVal('pSellPriceInfo', fmtRp(p.sell_price || 0));

      // Auto-fill Harga Tampil Website jika masih kosong/default
      if (!p.price_label || p.price_label === 'Hubungi Kami' || p.price_label.startsWith('Mulai Rp 0')) {
        if (p.sell_price > 0) {
          setVal('pPriceLabel', `Mulai ${fmtRp(p.sell_price)}`);
        }
      }

      setVal('pStatus', p.publish_status || 'new');
      setChecked('pFeatured', !!p.is_featured);
      setVal('pTags', (p.tags || []).join(', '));

      if (p.thumbnail) {
        const prev = document.getElementById('prevThumb');
        if (prev) { prev.src = `/uploads/products/${p.thumbnail}`; prev.style.display = 'block'; }
      }
      // Existing images
      if (p.images?.length) {
        document.getElementById('existingImgGrid').innerHTML = p.images.map(img => `
          <div class="image-item${img.is_primary ? ' primary' : ''}">
            <img src="/uploads/products/${img.filename}">
            ${!isViewOnly ? `
            <div class="image-actions">
              <button class="image-btn" onclick="setPrimaryImg(${p.id},${img.id})">⭐ Utama</button>
              <button class="image-btn del" onclick="deleteProductImg(${p.id},${img.id})">🗑</button>
            </div>` : ''}
          </div>`).join('');
      }
    }).catch(err => toast(err.message, 'error'));
  }
  openModal('modalProduct');
}

function switchProductTab(tab, btn = null) {
  ['ptInfo', 'ptWarehouse', 'ptContent', 'ptImages', 'ptSeo'].forEach(t => {
    const el = document.getElementById(t);
    if (el) el.classList.remove('active');
  });
  const tabMap = { info: 'ptInfo', warehouse: 'ptWarehouse', content: 'ptContent', images: 'ptImages', seo: 'ptSeo' };
  const el = document.getElementById(tabMap[tab]);
  if (el) el.classList.add('active');
  document.querySelectorAll('#productTabBar .settings-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

function autoSlug() {
  if (editingId) return; // don't auto-slug on edit
  const name = getVal('pName');
  const slug = name.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
  setVal('pSlug', slug);
}

async function saveProduct() {
  const name = getVal('pName');
  if (!name) { toast('Nama produk wajib diisi', 'warning'); return; }

  const fd = new FormData();
  const fields = {
    name, slug: getVal('pSlug'), sku: getVal('pSku'), category_id: getVal('pCategory'),
    short_desc: getVal('pShortDesc'), description: getVal('pDesc'), specification: getVal('pSpec'),
    material: getVal('pMaterial'), dimensions: getVal('pDimensions'), price_label: getVal('pPriceLabel'),
    sort_order: getVal('pSortOrder'), meta_title: getVal('pMetaTitle'), meta_desc: getVal('pMetaDesc'),
    tags: getVal('pTags'), warehouse_stock: getVal('pStock'), unit: getVal('pUnit'),
    cost_price: getVal('pCostPrice'), sell_price: getVal('pSellPrice'),
    is_featured: getChecked('pFeatured') ? 1 : 0
  };
  Object.entries(fields).forEach(([k, v]) => fd.append(k, v));

  // Status: website admin can set via CMS endpoint, warehouse via main endpoint
  if (me.role === 'admin_website' || me.role === 'superadmin') fd.append('publish_status', getVal('pStatus'));

  const thumb = document.getElementById('pThumb');
  if (thumb?.files[0]) fd.append('thumbnail', thumb.files[0]);
  const imgs = document.getElementById('pImages');
  if (imgs?.files) Array.from(imgs.files).forEach(f => fd.append('images', f));

  const btn = document.getElementById('saveProductBtn');
  btn.textContent = '⏳ Menyimpan...'; btn.disabled = true;

  try {
    const endpoint = editingId
      ? (me.role === 'admin_website' ? `/products/${editingId }/cms` : ` /products/${editingId }`)
      : '/products';
    const method = editingId ? 'PUT' : 'POST';
    await api(method, endpoint, fd, true);
    toast(editingId ? 'Produk berhasil diupdate' : 'Produk berhasil ditambahkan');
    closeModal('modalProduct');
    loadProducts();
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    btn.textContent = '💾 Simpan Produk'; btn.disabled = false;
  }
}

function editProduct(id) { openProductModal(id); }

async function deleteProduct(id) {
  if (!confirm('Hapus produk ini? Semua foto dan data terkait akan ikut dihapus.')) return;
  try {
    await api('DELETE', `/products/${id }`);
    toast('Produk berhasil dihapus');
    loadProducts();
  } catch (e) { toast(e.message, 'error'); }
}

async function quickPublish(id) {
  try {
    await api('PUT', `/products/${id } / publish`);
    toast('Produk berhasil dipublish ke website 🌐');
    loadProducts(); loadNewProducts();
  } catch (e) { toast(e.message, 'error'); }
}

async function quickUnpublish(id) {
  if (!confirm('Sembunyikan produk ini dari website?')) return;
  try {
    await api('PUT', `/products/${id } / unpublish`);
    toast('Produk disembunyikan dari website');
    loadProducts();
  } catch (e) { toast(e.message, 'error'); }
}

async function setPrimaryImg(productId, imageId) {
  try {
    await api('PUT', `/products/${productId } / images / ${ imageId } / primary`);
    toast('Gambar utama diset'); editProduct(productId);
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteProductImg(productId, imageId) {
  if (!confirm('Hapus gambar ini?')) return;
  try {
    await api('DELETE', `/products/${productId } / images / ${ imageId }`);
    toast('Gambar dihapus'); editProduct(productId);
  } catch (e) { toast(e.message, 'error'); }
}

// --------------------------------------------------------------------------------------------------
// CATEGORIES
// --------------------------------------------------------------------------------------------------
async function loadCategories() {
  try {
    const data = await api('GET', '/categories');
    categories = data.data || [];
    document.getElementById('catBody').innerHTML = categories.map(c => `
      <tr>
        <td>
          <div style="display:flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:8px;background:var(--gray50);border:1px solid var(--gray200);overflow:hidden">
            ${c.image ? `<img src="/uploads/categories/${c.image}" style="width:100%;height:100%;object-fit:cover">` : `<div style="font-size:2rem;color:var(--text-light)">🖼️</div>`}
          </div>
        </td>
        <td>
          <div style="display:flex;align-items:center;gap:.5rem">
            <span style="font-size:1.4rem">${c.icon || '📦'}</span>
            <strong>${c.name}</strong>
          </div>
        </td>
        <td><code style="font-size:.75rem;color:var(--text-light)">${c.slug}</code></td>
        <td>${c.is_active ? '<span class="badge badge-active">Aktif</span>' : '<span class="badge badge-inactive">Nonaktif</span>'}</td>
        <td>${c.sort_order}</td>
        <td>
          <div style="display:flex;gap:.5rem">
            <button class="btn btn-sm btn-outline" onclick="editCategory(${c.id})">✏️</button>
            ${['superadmin', 'admin_website', 'admin_gudang'].includes(me.role) ? `<button class="btn btn-sm btn-danger" onclick="deleteCategory(${c.id})">🗑</button>` : ''}
          </div>
        </td>
      </tr > `).join('');
  } catch (e) { toast(e.message, 'error'); }
}

async function loadCategoriesDropdown() {
  if (!categories.length) { try { const d = await api('GET', '/categories'); categories = d.data || []; } catch (e) { } }
  const el = document.getElementById('pCategory');
  if (!el) return;
  el.innerHTML = '<option value="">Pilih Kategori</option>';
  categories.forEach(c => el.add(new Option(c.name, c.id)));
}

function openCategoryModal(id = null) {
  editingId = id;
  document.getElementById('modalCatTitle').textContent = id ? 'Edit Kategori' : 'Tambah Kategori';
  ['cName', 'cSlug', 'cDesc'].forEach(f => setVal(f, ''));
  setVal('cColorFrom', '#5C2E0E'); setVal('cColorTo', '#C49A6C');
  setVal('cOrder', ''); setChecked('cActive', true);
  const isGudang = me.role === 'admin_gudang';
  const cOrderGroup = document.getElementById('cOrder')?.closest('.form-group');
  if (cOrderGroup) cOrderGroup.style.display = (isGudang) ? 'none' : '';
  document.getElementById('prevCatImg').style.display = 'none';
  if (id) {
    const cat = categories.find(c => c.id === id);
    if (cat) {
      setVal('cName', cat.name); setVal('cSlug', cat.slug); setVal('cDesc', cat.description || '');
      setVal('cIcon', cat.icon || '📦'); setVal('cOrder', cat.sort_order || 0); setChecked('cActive', !!cat.is_active);
      setVal('cColorFrom', cat.color_from || '#5C2E0E'); setVal('cColorTo', cat.color_to || '#C49A6C');
      if (cat.image) {
        const prev = document.getElementById('prevCatImg');
        if (prev) { prev.src = `/uploads/categories/${cat.image}`; prev.style.display = 'block'; }
      }
    }
  }
  openModal('modalCategory');
}

async function saveCategory() {
  const name = getVal('cName');
  if (!name) { toast('Nama kategori wajib diisi', 'warning'); return; }
  const fd = new FormData();
  fd.append('name', name); fd.append('slug', getVal('cSlug') || name.toLowerCase().replace(/\s+/g, '-'));
  fd.append('icon', getVal('cIcon') || '📦'); fd.append('description', getVal('cDesc'));
  fd.append('color_from', getVal('cColorFrom')); fd.append('color_to', getVal('cColorTo'));
  fd.append('sort_order', getVal('cOrder') || 0); fd.append('is_active', getChecked('cActive') ? 1 : 0);
  const img = document.getElementById('cImage');
  if (img?.files[0]) fd.append('image', img.files[0]);
  try {
    if (editingId) await api('PUT', `/categories/${editingId }`, fd, true);
    else await api('POST', '/categories', fd, true);
    toast('Kategori berhasil disimpan'); closeModal('modalCategory'); loadCategories();
  } catch (e) { toast(e.message, 'error'); }
}

function editCategory(id) { openCategoryModal(id); }

async function deleteCategory(id) {
  if (!confirm('Hapus kategori ini?')) return;
  try { await api('DELETE', `/categories/${id }`); toast('Kategori dihapus'); loadCategories(); }
  catch (e) { toast(e.message, 'error'); }
}

// --------------------------------------------------------------------------------------------------
// SERVICES
// --------------------------------------------------------------------------------------------------
async function loadServices() {
  try {
    const data = await api('GET', '/services');
    serviceData = data.data || [];
    document.getElementById('svcBody').innerHTML = serviceData.map(s => `
      <tr>
        <td>
          <div style="display:flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:8px;background:var(--gray50);border:1px solid var(--gray200);overflow:hidden">
            ${s.image ? `<img src="/uploads/services/${s.image}" style="width:100%;height:100%;object-fit:cover">` : `<div style="font-size:2rem;color:var(--text-light)">🖼️</div>`}
          </div>
        </td>
        <td>
          <div style="display:flex;align-items:center;gap:.5rem">
            <span style="font-size:1.4rem">${s.icon || '🛠'}</span>
            <strong>${s.name}</strong>
          </div>
        </td>
        <td style="font-size:.82rem;max-width:280px">${s.short_desc || '—'}</td>
        <td>${s.is_active ? '<span class="badge badge-active">Aktif</span>' : '<span class="badge badge-inactive">Nonaktif</span>'}</td>
        <td>${s.sort_order}</td>
        <td>
          <div style="display:flex;gap:.5rem">
            <button class="btn btn-sm btn-outline" onclick="editService(${s.id})">✏️</button>
            <button class="btn btn-sm btn-danger" onclick="deleteService(${s.id})">🗑</button>
          </div>
        </td>
      </tr > `).join('');
  } catch (e) { toast(e.message, 'error'); }
}

let serviceData = [];
function openServiceModal(id = null) {
  editingId = id;
  document.getElementById('modalSvcTitle').textContent = id ? 'Edit Layanan' : 'Tambah Layanan';
  ['svName', 'svSlug', 'svShort', 'svDesc', 'svInfo'].forEach(f => setVal(f, ''));
  setVal('svIcon', '🛠'); setVal('svOrder', 0); setChecked('svActive', true);
  setVal('svColorFrom', '#5C2E0E'); setVal('svColorTo', '#C49A6C');
  document.getElementById('prevSvImg').style.display = 'none';

  if (id && serviceData.length) {
    const s = serviceData.find(s => s.id === id);
    if (s) {
      setVal('svName', s.name); setVal('svSlug', s.slug); setVal('svShort', s.short_desc || '');
      setVal('svDesc', s.description || ''); setVal('svInfo', s.info || ''); setVal('svIcon', s.icon || '🛠');
      setVal('svOrder', s.sort_order || 0); setChecked('svActive', !!s.is_active);
      setVal('svColorFrom', s.color_from || '#5C2E0E'); setVal('svColorTo', s.color_to || '#C49A6C');
      if (s.image) {
        const prev = document.getElementById('prevSvImg');
        if (prev) { prev.src = `/ uploads /services/${s.image }`; prev.style.display = 'block'; }
      }
    }
  }
  openModal('modalService');
}

async function saveService() {
  const name = getVal('svName');
  if (!name) { toast('Nama layanan wajib diisi', 'warning'); return; }
  const fd = new FormData();
  ['svName:name', 'svSlug:slug', 'svShort:short_desc', 'svDesc:description', 'svInfo:info', 'svIcon:icon', 'svOrder:sort_order', 'svColorFrom:color_from', 'svColorTo:color_to'].forEach(pair => {
    const [id, key] = pair.split(':'); fd.append(key, getVal(id) || '');
  });
  fd.append('is_active', getChecked('svActive') ? 1 : 0);
  const img = document.getElementById('svImage');
  if (img?.files[0]) fd.append('image', img.files[0]);
  try {
    if (editingId) await api('PUT', `/services/${editingId }`, fd, true);
    else await api('POST', '/services', fd, true);
    toast('Layanan berhasil disimpan'); closeModal('modalService');
    const d = await api('GET', '/services'); serviceData = d.data || []; loadServices();
  } catch (e) { toast(e.message, 'error'); }
}

async function editService(id) {
  if (!serviceData.length) { try { const d = await api('GET', '/services'); serviceData = d.data || []; } catch (e) { } }
  openServiceModal(id);
}

async function deleteService(id) {
  if (!confirm('Hapus layanan ini?')) return;
  try { await api('DELETE', `/services/${id }`); toast('Layanan dihapus'); loadServices(); }
  catch (e) { toast(e.message, 'error'); }
}

// --------------------------------------------------------------------------------------------------
// TESTIMONIALS
// --------------------------------------------------------------------------------------------------
async function loadTestimonials() {
  try {
    const data = await api('GET', '/testimonials');
    document.getElementById('testiBody').innerHTML = (data.data || []).map(t => `
      <tr>
        <td><strong>${t.name}</strong></td>
        <td style="font-size:.82rem">${t.role || '—'}</td>
        <td>${'⭐'.repeat(t.rating || 5)}</td>
        <td style="font-size:.82rem;max-width:200px">${(t.content || '').substring(0, 80)}...</td>
        <td>${t.is_active ? '<span class="badge badge-active">Tampil</span>' : '<span class="badge badge-inactive">Sembunyikan</span>'}</td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="editTestimonial(${t.id})">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="deleteTestimonial(${t.id})">🗑</button>
        </td>
      </tr>`).join('');
      } catch (e) { toast(e.message, 'error'); }
    }

let testiData = [];
    function openTestimonialModal(id = null) {
      editingId = id;
      document.getElementById('modalTestiTitle').textContent = id ? 'Edit Testimoni' : 'Tambah Testimoni';
      ['tName', 'tRole', 'tInitial', 'tContent', 'tRef'].forEach(f => setVal(f, ''));
      setVal('tRating', 5); setVal('tOrder', 0); setChecked('tActive', true);
      if (id) {
        const t = testiData.find(t => t.id === id);
        if (t) {
          setVal('tName', t.name); setVal('tRole', t.role || ''); setVal('tInitial', t.initial || '');
          setVal('tContent', t.content); setVal('tRef', t.product_ref || '');
          setVal('tRating', t.rating || 5); setVal('tOrder', t.sort_order || 0); setChecked('tActive', !!t.is_active);
        }
      }
      openModal('modalTesti');
    }

    async function saveTestimonial() {
      const name = getVal('tName'), content = getVal('tContent');
      if (!name || !content) { toast('Nama dan konten testimoni wajib diisi', 'warning'); return; }
      const payload = {
        name, role: getVal('tRole'), initial: getVal('tInitial') || name[0].toUpperCase(),
        content, product_ref: getVal('tRef'), rating: parseInt(getVal('tRating')) || 5,
        sort_order: parseInt(getVal('tOrder')) || 0, is_active: getChecked('tActive') ? 1 : 0
      };
      try {
        if (editingId) await api('PUT', `/testimonials/${editingId}`, payload);
        else await api('POST', '/testimonials', payload);
        toast('Testimoni berhasil disimpan'); closeModal('modalTesti');
        const d = await api('GET', '/testimonials'); testiData = d.data || []; loadTestimonials();
      } catch (e) { toast(e.message, 'error'); }
    }

    async function editTestimonial(id) {
      if (!testiData.length) { try { const d = await api('GET', '/testimonials'); testiData = d.data || []; } catch (e) { } }
      openTestimonialModal(id);
    }

    async function deleteTestimonial(id) {
      if (!confirm('Hapus testimoni ini?')) return;
      try { await api('DELETE', `/testimonials/${id}`); toast('Dihapus'); loadTestimonials(); }
      catch (e) { toast(e.message, 'error'); }
    }

    // --------------------------------------------------------------------------------------------------
    // CONTACTS
    // --------------------------------------------------------------------------------------------------
    async function loadContacts() {
      try {
        const data = await api('GET', '/contacts');
        const contacts = data.data || [];
        document.getElementById('contactBody').innerHTML = contacts.map(c => `
      <tr style="${!c.is_read ? 'font-weight:600;' : ''}">
        <td>${c.name}</td>
        <td style="font-size:.8rem">${c.email || ''} ${c.phone || ''}</td>
        <td style="font-size:.82rem">${c.subject || '—'}</td>
        <td style="font-size:.78rem">${fmtDate(c.created_at)}</td>
        <td>${c.is_read ? '<span class="badge badge-read">Dibaca</span>' : '<span class="badge badge-unread">Baru</span>'}</td>
        <td>
          ${!c.is_read ? `<button class="btn btn-sm btn-outline" onclick="markRead(${c.id})">✅ Baca</button>` : ''}
          <button class="btn btn-sm btn-danger" onclick="deleteContact(${c.id})">🗑</button>
        </td>
      </tr>`).join('');
        const unread = contacts.filter(c => !c.is_read).length;
        const badge = document.getElementById('contactUnreadBadge');
        if (badge) badge.innerHTML = unread ? `<span class="nav-badge">${unread}</span>` : '';
      } catch (e) { toast(e.message, 'error'); }
    }

    async function markRead(id) {
      try { await api('PUT', `/contacts/${id}/read`); loadContacts(); }
      catch (e) { toast(e.message, 'error'); }
    }

    async function deleteContact(id) {
      if (!confirm('Hapus pesan ini?')) return;
      try { await api('DELETE', `/contacts/${id}`); toast('Pesan dihapus'); loadContacts(); }
      catch (e) { toast(e.message, 'error'); }
    }

    // --------------------------------------------------------------------------------------------------
    // SETTINGS
    // --------------------------------------------------------------------------------------------------
    async function loadSettings() {
      const tabs = document.getElementById('settingsTabs');
      const panels = document.getElementById('settingsPanels');
      if (!tabs || !panels) { console.error('[settings] DOM elements not found'); return; }

      tabs.innerHTML = '<span style="color:var(--text-light);font-size:.85rem">Memuat...</span>';
      panels.innerHTML = '';

      try {
        const data = await api('GET', '/settings');
        const settings = Array.isArray(data.data) ? data.data : [];

        if (!settings.length) {
          tabs.innerHTML = '';
          panels.innerHTML = '<div style="padding:2rem;color:var(--text-light);text-align:center">Tidak ada data settings.</div>';
          return;
        }

        const groups = {};
        settings.forEach(s => {
          if (!groups[s.group_name]) groups[s.group_name] = [];
          groups[s.group_name].push(s);
        });
        const groupLabels = { general: '⚙️ Umum', hero: '🖼️ Hero', about: '📖 Tentang', contact: '📞 Kontak', stats: '📊 Statistik', social: '📱 Sosial', footer: '📄 Footer' };
        tabs.innerHTML = ''; panels.innerHTML = '';
        let first = true;
        Object.keys(groups).forEach(grp => {
          const label = groupLabels[grp] || grp;
          const tabBtn = document.createElement('button');
          tabBtn.className = 'settings-tab' + (first ? ' active' : '');
          tabBtn.textContent = label;
          tabBtn.onclick = () => {
            document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
            tabBtn.classList.add('active');
            document.getElementById(`spanel-${grp}`)?.classList.add('active');
          };
          tabs.appendChild(tabBtn);

          const panel = document.createElement('div');
          panel.id = `spanel-${grp}`;
          panel.className = 'settings-panel' + (first ? ' active' : '');
          panel.innerHTML = groups[grp].map(s => `
        <div class="form-group">
          <label>${s.label || s.key}</label>
          ${s.type === 'image' ? `
            <div class="img-preview-container" style="margin-bottom:.75rem">
              ${s.value ? `<img src="${s.value.startsWith('/') ? s.value : '/uploads/settings/' + s.value}" class="img-preview">` : ''}
            </div>
            <div style="display:flex;gap:.5rem;align-items:center">
              <input type="file" id="setting_file_${s.key}" accept="image/*" style="flex:1">
              <button class="btn btn-sm btn-primary" onclick="uploadSettingImage('${s.key}')">📥 Upload</button>
            </div>
          ` : s.type === 'textarea' ? `
            <textarea id="setting_${s.key}" rows="3">${s.value || ''}</textarea>
          ` : s.type === 'boolean' ? `
            <select id="setting_${s.key}"><option value="1" ${s.value === '1' ? 'selected' : ''}>Ya</option><option value="0" ${s.value !== '1' ? 'selected' : ''}>Tidak</option></select>
          ` : `
            <input type="${s.type === 'number' ? 'number' : 'text'}" id="setting_${s.key}" value="${s.value || ''}">
          `}
        </div>`).join('');

          const saveBtn = document.createElement('button');
          saveBtn.className = 'btn btn-primary';
          saveBtn.style.marginTop = '.5rem';
          saveBtn.textContent = '💾 Simpan ' + label;
          saveBtn.onclick = () => saveSettingsGroup(groups[grp]);
          panel.appendChild(saveBtn);
          panels.appendChild(panel);
          first = false;
        });
      } catch (e) { toast(e.message, 'error'); }
    }

    async function saveSettingsGroup(items) {
      const payload = {};
      items.forEach(s => {
        if (s.type !== 'image') {
          const el = document.getElementById(`setting_${s.key}`);
          if (el) payload[s.key] = el.value;
        }
      });
      try {
        await api('PUT', '/settings', payload);
        toast('Settings berhasil disimpan');
      } catch (e) { toast(e.message, 'error'); }
    }

    async function uploadSettingImage(key) {
      const file = document.getElementById(`setting_file_${key}`)?.files[0];
      if (!file) { toast('Pilih file gambar terlebih dahulu', 'warning'); return; }
      const fd = new FormData(); fd.append('image', file);
      try {
        await api('POST', `/settings/image/${key}`, fd, true);
        toast('Gambar berhasil diupload'); loadSettings();
      } catch (e) { toast(e.message, 'error'); }
    }

    // --------------------------------------------------------------------------------------------------
    // WAREHOUSE DASHBOARD
    // --------------------------------------------------------------------------------------------------
    async function loadWarehouseDashboard() {
      try {
        const data = await api('GET', '/warehouse/dashboard');
        const s = data.data.stats;
        document.getElementById('whStats').innerHTML = buildStatCards([
          { icon: '📦', label: 'Total Produk', val: s.total_products, cls: 'brown' },
          { icon: '⚠️', label: 'Stok Kritis (≤3)', val: s.low_stock, cls: 'red', onclick: "filterProductsBy('low_stock')" },
          { icon: '❌', label: 'Habis', val: s.out_of_stock, cls: 'red', onclick: "filterProductsBy('out_of_stock')" },
          { icon: '🏢', label: 'Supplier', val: s.total_suppliers, cls: 'green' },
          { icon: '👥', label: 'Customer', val: s.total_customers, cls: 'blue' },
          { icon: '🛒', label: 'Order Proses', val: s.pending_orders, cls: 'orange' },
          { icon: '📥', label: 'Masuk Hari Ini', val: s.stock_in_today, cls: 'teal' },
          { icon: '📤', label: 'Keluar Hari Ini', val: s.stock_out_today, cls: 'purple' },
        ]);

        // Inventory value KPI - Hidden for non-executive
        const kpi = document.getElementById('whInventoryKPI');
        if (kpi) kpi.style.display = 'none';

        // Stock flow chart (7 days)
        const flowData = data.data.stock_flow_7days || [];
        const canvas = document.getElementById('chartStockFlow');
        if (canvas && flowData.length) {
          if (canvas._chartInstance) canvas._chartInstance.destroy();
          canvas._chartInstance = new Chart(canvas, {
            type: 'bar',
            data: {
              labels: flowData.map(d => d.date),
              datasets: [
                {
                  label: '📥 Masuk', data: flowData.map(d => d.stock_in || 0),
                  backgroundColor: 'rgba(40,167,69,.7)', borderRadius: 4, borderSkipped: false,
                },
                {
                  label: '—', data: flowData.map(d => d.stock_out || 0),
                  backgroundColor: 'rgba(220,53,69,.7)', borderRadius: 4, borderSkipped: false,
                }
              ]
            },
            options: {
              responsive: true,
              plugins: { legend: { position: 'top', labels: { font: { size: 11 } } } },
              scales: {
                x: { ticks: { font: { size: 11 } } },
                y: { ticks: { precision: 0 }, grid: { color: '#f0ebe3' } }
              }
            }
          });
        }

        document.getElementById('lowStockBody').innerHTML = (data.data.low_stock_products || []).map(p => `
      <tr>
        <td>${p.name}</td>
        <td style="font-size:.78rem;color:var(--text-light)">${p.sku || '—'}</td>
        <td><span style="font-weight:700;color:${p.warehouse_stock === 0 ? 'var(--danger)' : 'var(--warning)'}">${p.warehouse_stock}</span> ${p.unit || 'unit'}</td>
        <td>${p.warehouse_stock === 0 ? '<span class="badge badge-out_of_stock">Habis</span>' : '<span class="badge badge-pending">Kritis</span>'}</td>
      </tr>`).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--success);padding:1rem">✅ Semua stok aman</td></tr>';

        document.getElementById('recentTxBody').innerHTML = (data.data.recent_transactions || []).map(t => `
      <tr>
        <td style="font-size:.82rem">${t.product_name}</td>
        <td><span class="badge badge-${t.type}">${t.type === 'in' ? '📥 Masuk' : t.type === 'out' ? '📥 Keluar' : '—'}</span></td>
        <td style="font-weight:600;color:${t.type === 'in' ? 'var(--success)' : 'var(--danger)'}">${t.type === 'in' ? '+' : '-'}${t.qty}</td>
        <td style="font-size:.78rem">${fmtDate(t.created_at)}</td>
      </tr>`).join('');
      } catch (e) { toast(e.message, 'error'); }
    }

    // --------------------------------------------------------------------------------------------------
    // STOCK MANAGEMENT
    // --------------------------------------------------------------------------------------------------
    async function submitStockIn() {
      const productId = getVal('siProduct');
      const qty = parseInt(getVal('siQty'));
      if (!productId || !qty || qty <= 0) { toast('Pilih produk dan masukkan jumlah', 'warning'); return; }
      const payload = {
        product_id: productId, qty, supplier_id: getVal('siSupplier') || null,
        reference_no: getVal('siRef'), unit_price: parseFloat(getVal('siPrice')) || 0, notes: getVal('siNotes')
      };
      try {
        const r = await api('POST', '/stock/in', payload);
        toast(r.message || 'Barang masuk berhasil');['siProduct', 'siQty', 'siRef', 'siPrice', 'siNotes'].forEach(f => setVal(f, ''));
        loadStockSummary(); loadProductsDropdown();
      } catch (e) { toast(e.message, 'error'); }
    }

    async function submitStockOut() {
      const productId = getVal('soProduct');
      const qty = parseInt(getVal('soQty'));
      if (!productId || !qty || qty <= 0) { toast('Pilih produk dan masukkan jumlah', 'warning'); return; }
      const payload = { product_id: productId, qty, reference_no: getVal('soRef'), notes: getVal('soNotes') };
      try {
        const r = await api('POST', '/stock/out', payload);
        toast(r.message || 'Barang keluar berhasil');['soProduct', 'soQty', 'soNotes'].forEach(f => setVal(f, ''));
        loadStockSummary(); loadProductsDropdown();
        setVal('soRef', `OUT-${Math.floor(Date.now() / 1000).toString().slice(-6)}`);
      } catch (e) { toast(e.message, 'error'); }
    }

    let stockSort = 'warehouse_stock', stockOrder = 'ASC';
    function sortStock(field) {
      if (stockSort === field) stockOrder = stockOrder === 'ASC' ? 'DESC' : 'ASC';
      else { stockSort = field; stockOrder = 'ASC'; }
      loadStockSummary(1);
    }

    async function loadStockSummary(page = 1) {
      try {
        const q = getVal('stockSearch');
        const data = await api('GET', `/stock/summary?page=${page}&search=${q}&sort=${stockSort}&order=${stockOrder}`);
        stockSummaryData = data.data || [];
        renderStockTable(data);
      } catch (e) { toast(e.message, 'error'); }
    }

    function renderStockTable(data) {
      const rows = data.data || [];
      document.getElementById('stockSummaryBody').innerHTML = rows.map(p => `
    <tr>
      <td style="font-size:.78rem;color:var(--text-light)">${p.sku || '—'}</td>
      <td style="font-size:.85rem"><strong>${p.name}</strong></td>
      <td style="font-size:.8rem">${p.category_name || '—'}</td>
      <td style="font-weight:700;color:${p.warehouse_stock === 0 ? 'var(--danger)' : p.warehouse_stock <= 5 ? 'var(--warning)' : 'var(--success)'}">${p.warehouse_stock}</td>
      <td style="font-size:.8rem">${p.unit || 'unit'}</td>
      <td style="font-size:.8rem">${fmtRp(p.cost_price)}</td>
      <td style="font-size:.8rem">${fmtRp(p.sell_price)}</td>
      <td style="font-size:.8rem;font-weight:600">${fmtRp(p.stock_value)}</td>
      <td>${statusBadge(p.publish_status)}</td>
    </tr>`).join('');
      buildPagination('stockPagination', data.pagination, 'loadStockSummary');
    }

    const filterStockTable = debounce(() => loadStockSummary(1), 500);

    async function exportStockPDF() {
      const btn = event?.target;
      if (btn) { btn.disabled = true; btn.textContent = '⏳ Memuat...'; }
      try {
        const q = getVal('stockSearch');
        const data = await api('GET', `/stock/summary?limit=1000&search=${q}&sort=${stockSort}&order=${stockOrder}`);
        const items = data.data || [];
        const totalVal = data.total_stock_value || 0;
        const c = data.company || {};

        const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Stock Summary — ${c.site_name || 'Jogja Furniture'}</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Outfit',sans-serif; color:#2C1A0E; padding:40px; background:#fff; font-size:12px; }
    .print-btn { position:fixed; top:16px; right:16px; background:#5C2E0E; color:#fff; border:none; padding:10px 22px; border-radius:6px; font-size:14px; font-weight:600; cursor:pointer; z-index:999; box-shadow:0 4px 12px rgba(0,0,0,.2); }
    .print-btn:hover { background:#3D1E08; }
    @media print { .print-btn { display:none !important; } }
    .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:32px; border-bottom:3px solid #5C2E0E; padding-bottom:20px; }
    .co-name { font-size:26px; font-weight:700; color:#5C2E0E; }
    .co-sub  { font-size:11px; color:#6B5040; margin-top:3px; letter-spacing:.08em; text-transform:uppercase; }
    .co-contact { font-size:11px; color:#6B5040; margin-top:10px; line-height:1.8; }
    .report-title { font-size:22px; font-weight:700; color:#5C2E0E; letter-spacing:2px; text-align:right; }
    .report-meta  { font-size:11px; color:#6B5040; text-align:right; margin-top:6px; line-height:1.8; }
    table { width:100%; border-collapse:collapse; margin-top:8px; }
    th { background:#F5F0EB; padding:9px 8px; border-bottom:2px solid #5C2E0E; text-align:left; font-size:10px; text-transform:uppercase; color:#5C2E0E; font-weight:700; letter-spacing:.06em; }
    td { padding:7px 8px; border-bottom:1px solid #F0EBE3; }
    tr:nth-child(even) td { background:#FAFAFA; }
    .num { text-align:right; }
    .center { text-align:center; }
    .low { color:#D32F2F; font-weight:700; }
    .summary-box { margin-top:28px; display:flex; justify-content:flex-end; }
    .summary-inner { background:#F5F0EB; padding:16px 24px; border-radius:8px; border-left:4px solid #5C2E0E; }
    .summary-lbl { font-size:11px; color:#6B5040; margin-bottom:4px; }
    .summary-val { font-size:20px; font-weight:700; color:#5C2E0E; }
    .footer { margin-top:32px; border-top:1px solid #E0D8CE; padding-top:14px; font-size:10px; color:#999; display:flex; justify-content:space-between; }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">🖨️ Cetak Langsung</button>
  <div class="header">
    <div>
      <div class="co-name">${c.site_name || 'JOGJA FURNITURE'}</div>
      <div class="co-sub">Furniture & Interior Solutions</div>
      <div class="co-contact">
        📍 ${c.address || '—'}<br>
        📞 ${c.phone || '—'} &nbsp;|&nbsp; 📧 ${c.email || '—'}
      </div>
    </div>
    <div>
      <div class="report-title">STOCK SUMMARY</div>
      <div class="report-meta">
        Tanggal: ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}<br>
        Dicetak oleh: ${me.full_name} (${me.role})<br>
        Total item: ${items.length} produk
      </div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>SKU</th><th>Produk</th><th>Kategori</th>
        <th class="center">Stok</th><th>Satuan</th>
        <th class="num">Harga Modal</th><th class="num">Harga Jual</th><th class="num">Nilai Stok</th>
      </tr>
    </thead>
    <tbody>
      ${items.map(p => `
        <tr>
          <td style="color:#888">${p.sku || '—'}</td>
          <td><strong>${p.name}</strong></td>
          <td>${p.category_name || '—'}</td>
          <td class="center ${p.warehouse_stock <= 5 ? 'low' : ''}">${p.warehouse_stock}</td>
          <td>${p.unit || 'unit'}</td>
          <td class="num">${fmtRp(p.cost_price)}</td>
          <td class="num">${fmtRp(p.sell_price)}</td>
          <td class="num" style="font-weight:600;color:#5C2E0E">${fmtRp(p.stock_value)}</td>
        </tr>`).join('')}
    </tbody>
  </table>
  <div class="summary-box">
    <div class="summary-inner">
      <div class="summary-lbl">Total Nilai Inventori (Harga Modal)</div>
      <div class="summary-val">${fmtRp(totalVal)}</div>
    </div>
  </div>
  <div class="footer">
    <span>Stok merah = stok ≤ 5 unit (kritis)</span>
    <span>Dicetak: ${new Date().toLocaleString('id-ID')}</span>
  </div>
</body>
</html>`;

        const win = window.open('', '_blank');
        if (!win) { toast('Popup diblokir browser. Izinkan popup untuk domain ini.', 'warning'); return; }
        win.document.write(html);
        win.document.close();
      } catch (e) {
        toast('Gagal memuat data: ' + e.message, 'error');
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = '📄 Export PDF'; }
      }
    }

    let txPage = 1;
    async function loadTransactions(page = 1) {
      txPage = page;
      const type = getVal('txType'), from = getVal('txFrom'), to = getVal('txTo'), q = getVal('txSearch');
      try {
        const data = await api('GET', `/stock/transactions?page=${page}&limit=30&type=${type}&date_from=${from}&date_to=${to}&search=${q}`);
        document.getElementById('txBody').innerHTML = (data.data || []).map(t => `
      <tr>
        <td style="font-size:.8rem">${fmtDate(t.created_at)}</td>
        <td style="font-size:.82rem">${t.product_name}</td>
        <td style="font-size:.75rem;color:var(--text-light)">${t.sku || '—'}</td>
        <td><span class="badge badge-${t.type}">${statusLabel(t.type)}</span></td>
        <td style="font-weight:700;color:${t.type === 'in' ? 'var(--success)' : 'var(--danger)'}">${t.type === 'in' ? '+' : t.type === 'out' ? '-' : '±'}${t.qty}</td>
        <td>${t.qty_before}</td>
        <td>${t.qty_after}</td>
        <td style="font-size:.78rem">${t.reference_no || '—'}</td>
        <td style="font-size:.78rem">${t.supplier_name || '—'}</td>
        <td style="font-size:.78rem">${t.created_by_name || '—'}</td>
      </tr>`).join('') || '<tr><td colspan="10" style="text-align:center;padding:1.5rem;color:var(--text-light)">Tidak ada transaksi</td></tr>';
        buildPagination('txPagination', data.pagination, 'loadTransactions');
      } catch (e) { toast(e.message, 'error'); }
    }

    function printStockReport() {
      const el = document.getElementById('page-stock-transactions');
      const opt = {
        margin: 0.5,
        filename: 'Laporan_Stok_JogjaFurniture.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' }
      };

      document.body.classList.add('print-stock-tx');
      html2pdf().set(opt).from(el).save().then(() => {
        document.body.classList.remove('print-stock-tx');
      });
    }

    function exportInvoicePDF() {
      const el = document.getElementById('invoiceContent');
      const h2 = el.querySelector('h2');
      const invNumber = h2 ? h2.innerText.split(' ').pop() : 'Order';
      const opt = {
        margin: 0.5,
        filename: `Invoice_${invNumber}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
      };
      html2pdf().set(opt).from(el).save();
    }
    // --------------------------------------------------------------------------------------------------
    // SUPPLIERS
    // --------------------------------------------------------------------------------------------------
    let supPage = 1, supData = [];
    async function loadSuppliers(page = 1) {
      supPage = page;
      const search = getVal('supSearch');
      try {
        const data = await api('GET', `/suppliers?page=${page}&limit=20&search=${encodeURIComponent(search)}`);
        supData = data.data || [];
        document.getElementById('supBody').innerHTML = supData.map(s => `
      <tr>
        <td><code style="font-size:.78rem">${s.code || '—'}</code></td>
        <td><strong>${s.name}</strong></td>
        <td style="font-size:.82rem">${s.contact_name || '—'}</td>
        <td style="font-size:.82rem">${s.phone || '—'}</td>
        <td style="font-size:.82rem">${s.city || '—'}</td>
        <td>${s.is_active ? '<span class="badge badge-active">Aktif</span>' : '<span class="badge badge-inactive">Nonaktif</span>'}</td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="editSupplier(${s.id})">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="deleteSupplier(${s.id})">🗑</button>
        </td>
      </tr>`).join('');
        buildPagination('supPagination', data.pagination, 'loadSuppliers');
      } catch (e) { toast(e.message, 'error'); }
    }

    async function loadSuppliersDropdown() {
      if (!supData.length) { try { const d = await api('GET', '/suppliers?limit=200'); supData = d.data || []; } catch (e) { } }
      const el = document.getElementById('siSupplier');
      if (!el) return;
      el.innerHTML = '<option value="">Pilih Supplier...</option>';
      supData.forEach(s => el.add(new Option(s.name, s.id)));
      initTomSelect('siSupplier');
    }

    function openSupplierModal(id = null) {
      editingId = id;
      document.getElementById('modalSupTitle').textContent = id ? 'Edit Supplier' : 'Tambah Supplier';
      ['sCode', 'sName', 'sContact', 'sPhone', 'sEmail', 'sCity', 'sProvince', 'sAddress', 'sNotes'].forEach(f => setVal(f, ''));
      if (id) {
        const s = supData.find(s => s.id === id);
        if (s) {
          setVal('sCode', s.code || ''); setVal('sName', s.name); setVal('sContact', s.contact_name || '');
          setVal('sPhone', s.phone || ''); setVal('sEmail', s.email || ''); setVal('sCity', s.city || '');
          setVal('sProvince', s.province || ''); setVal('sAddress', s.address || ''); setVal('sNotes', s.notes || '');
        }
      } else {
        let max = 0;
        supData.forEach(s => {
          if (s.code && s.code.startsWith('SUP')) {
            let num = parseInt(s.code.replace('SUP', ''));
            if (!isNaN(num) && num > max) max = num;
          }
        });
        setVal('sCode', `SUP${String(max + 1).padStart(3, '0')}`);
      }
      openModal('modalSupplier');
    }

    async function saveSupplier() {
      const name = getVal('sName');
      if (!name) { toast('Nama supplier wajib diisi', 'warning'); return; }
      const payload = {
        code: getVal('sCode'), name, contact_name: getVal('sContact'), phone: getVal('sPhone'),
        email: getVal('sEmail'), city: getVal('sCity'), province: getVal('sProvince'),
        address: getVal('sAddress'), notes: getVal('sNotes'), is_active: 1
      };
      try {
        if (editingId) await api('PUT', `/suppliers/${editingId}`, payload);
        else await api('POST', '/suppliers', payload);
        toast('Supplier berhasil disimpan'); closeModal('modalSupplier'); loadSuppliers();
      } catch (e) { toast(e.message, 'error'); }
    }

    function editSupplier(id) { openSupplierModal(id); }
    async function deleteSupplier(id) {
      if (!confirm('Hapus supplier ini?')) return;
      try { await api('DELETE', `/suppliers/${id}`); toast('Supplier dihapus'); loadSuppliers(); }
      catch (e) { toast(e.message, 'error'); }
    }

    // --------------------------------------------------------------------------------------------------
    // CUSTOMERS
    // --------------------------------------------------------------------------------------------------
    let cusPage = 1, cusData = [];
    async function loadCustomers(page = 1) {
      cusPage = page;
      const search = getVal('cusSearch');
      try {
        const data = await api('GET', `/customers?page=${page}&limit=20&search=${encodeURIComponent(search)}`);
        cusData = data.data || [];
        document.getElementById('cusBody').innerHTML = cusData.map(c => `
      <tr>
        <td><code style="font-size:.78rem">${c.code || '—'}</code></td>
        <td><strong>${c.name}</strong></td>
        <td style="font-size:.82rem">${c.phone || '—'}</td>
        <td style="font-size:.82rem">${c.email || '—'}</td>
        <td style="font-size:.82rem">${c.city || '—'}</td>
        <td style="font-size:.82rem;font-weight:600">${c.total_orders_count || 0} order</td>
        <td>${c.is_active ? '<span class="badge badge-active">Aktif</span>' : '<span class="badge badge-inactive">Nonaktif</span>'}</td>
        <td>
          <div style="display:flex;gap:.3rem">
            <button class="btn btn-sm btn-outline" onclick="viewCustomerHistory(${c.id})" title="Riwayat Transaksi">📜</button>
            <button class="btn btn-sm btn-outline" onclick="editCustomer(${c.id})">✏️</button>
            <button class="btn btn-sm btn-danger" onclick="deleteCustomer(${c.id})">🗑</button>
          </div>
        </td>
      </tr>`).join('');
        buildPagination('cusPagination', data.pagination, 'loadCustomers');
      } catch (e) { toast(e.message, 'error'); }
    }

    async function viewCustomerHistory(id) {
      const c = cusData.find(x => x.id == id);
      if (!c) return;

      document.getElementById('modalCusHistoryTitle').innerText = `Riwayat Transaksi: ${c.name}`;
      document.getElementById('cusHistoryBody').innerHTML = '<tr><td colspan="6" style="text-align:center;padding:1rem">Memuat...</td></tr>';
      openModal('modalCusHistory');

      try {
        const data = await api('GET', `/orders?customer_id=${id}&limit=50`);
        const orders = data.data || [];
        document.getElementById('cusHistoryBody').innerHTML = orders.map(o => `
      <tr>
        <td style="font-weight:600">${o.order_number}</td>
        <td>${fmtDateOnly(o.created_at)}</td>
        <td style="font-weight:700;color:var(--primary)">${fmtRp(o.total)}</td>
        <td>${statusBadge(o.status)}</td>
        <td>${statusBadge(o.payment_status)}</td>
        <td><button class="btn btn-sm btn-outline" onclick="viewOrderSummary(${o.id})" title="Detail Order">🔍</button></td>
      </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;padding:1.5rem;color:var(--text-light)">Belum ada transaksi</td></tr>';
      } catch (e) {
        toast(e.message, 'error');
        document.getElementById('cusHistoryBody').innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--danger)">Gagal memuat data</td></tr>';
      }
    }

    async function viewOrderSummary(id) {
      try {
        const data = await api('GET', `/orders/${id}`);
        const o = data.data;
        const items = o.items || [];

        const rows = items.map((it, i) => `
      <tr>
        <td style="padding:10px;border-bottom:1px solid #eee;font-size:13px">${i + 1}</td>
        <td style="padding:10px;border-bottom:1px solid #eee;font-size:13px">
          <strong>${it.product_name}</strong><br>
          <small style="color:#777">${it.product_sku || '-'}</small>
        </td>
        <td style="padding:10px;border-bottom:1px solid #eee;text-align:center;font-size:13px">${it.qty}</td>
        <td style="padding:10px;border-bottom:1px solid #eee;text-align:right;font-size:13px">${fmtRp(it.unit_price)}</td>
        <td style="padding:10px;border-bottom:1px solid #eee;text-align:right;font-weight:600;font-size:13px">${fmtRp(it.subtotal)}</td>
      </tr>`).join('');

        const content = `
      <div style="padding:20px;color:#333">
        <div style="display:flex;justify-content:space-between;margin-bottom:20px">
          <div>
            <h4 style="margin:0;color:var(--primary)"># ${o.order_number}</h4>
            <div style="font-size:12px;color:#666">${fmtDate(o.created_at)}</div>
          </div>
          <div style="text-align:right">
            <div>${statusBadge(o.status)}</div>
            <div style="margin-top:4px">${statusBadge(o.payment_status)}</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;padding:15px;background:#fff;border:1px solid #eee;border-radius:8px">
          <div>
            <div style="font-size:11px;text-transform:uppercase;color:#999;margin-bottom:4px">Pelanggan</div>
            <div style="font-weight:600">${o.customer_name}</div>
            <div style="font-size:13px">${o.customer_phone || '-'}</div>
          </div>
          <div>
            <div style="font-size:11px;text-transform:uppercase;color:#999;margin-bottom:4px">Alamat Pengiriman</div>
            <div style="font-size:13px;line-height:1.4">${o.customer_addr || '-'}</div>
          </div>
        </div>

        <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
          <thead>
            <tr style="background:#f8f9fa">
              <th style="padding:10px;text-align:left;font-size:12px;color:#666">#</th>
              <th style="padding:10px;text-align:left;font-size:12px;color:#666">Item</th>
              <th style="padding:10px;text-align:center;font-size:12px;color:#666">Qty</th>
              <th style="padding:10px;text-align:right;font-size:12px;color:#666">Harga</th>
              <th style="padding:10px;text-align:right;font-size:12px;color:#666">Subtotal</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <div style="display:flex;justify-content:flex-end">
          <div style="width:250px">
            <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:14px">
              <span>Subtotal:</span><span>${fmtRp(o.subtotal)}</span>
            </div>
            ${o.discount > 0 ? `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:14px;color:var(--danger)">
              <span>Diskon:</span><span>- ${fmtRp(o.discount)}</span>
            </div>` : ''}
            <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:14px">
              <span>Ongkir:</span><span>${fmtRp(o.shipping_cost)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:10px 0;margin-top:10px;border-top:2px solid var(--primary);font-weight:700;font-size:18px;color:var(--primary)">
              <span>TOTAL:</span><span>${fmtRp(o.total)}</span>
            </div>
            <div style="font-size:13px;margin-top:5px;text-align:right;color:#666">Terbayar: ${fmtRp(o.amount_paid)}</div>
          </div>
        </div>
      </div>
    `;

        document.getElementById('summaryContent').innerHTML = content;
        document.getElementById('summaryPrintBtn').onclick = () => viewInvoice(id);
        openModal('modalOrderSummary');
      } catch (e) { toast(e.message, 'error'); }
    }


    async function loadCustomersDropdown() {
      if (!cusData.length) { try { const d = await api('GET', '/customers?limit=200'); cusData = d.data || []; } catch (e) { } }
      const el = document.getElementById('oCustomerId');
      if (!el) return;
      el.innerHTML = '<option value="">— Isi manual —</option>';
      cusData.forEach(c => el.add(new Option(`[${c.code || '—'}] ${c.name}`, c.id)));
      initTomSelect('oCustomerId');
    }

    function openCustomerModal(id = null) {
      editingId = id;
      document.getElementById('modalCusTitle').textContent = id ? 'Edit Customer' : 'Tambah Customer';
      ['kCode', 'kName', 'kPhone', 'kEmail', 'kCity', 'kProvince', 'kAddress', 'kNotes'].forEach(f => setVal(f, ''));
      if (id) {
        const c = cusData.find(c => c.id === id);
        if (c) {
          setVal('kCode', c.code || ''); setVal('kName', c.name); setVal('kPhone', c.phone || '');
          setVal('kEmail', c.email || ''); setVal('kCity', c.city || ''); setVal('kProvince', c.province || '');
          setVal('kAddress', c.address || ''); setVal('kNotes', c.notes || '');
        }
      } else {
        let max = 0;
        cusData.forEach(c => {
          if (c.code && c.code.startsWith('CUS')) {
            let num = parseInt(c.code.replace('CUS', ''));
            if (!isNaN(num) && num > max) max = num;
          }
        });
        setVal('kCode', `CUS${String(max + 1).padStart(3, '0')}`);
      }
      openModal('modalCustomer');
    }

    async function saveCustomer() {
      const name = getVal('kName');
      if (!name) { toast('Nama customer wajib diisi', 'warning'); return; }
      const payload = {
        code: getVal('kCode'), name, phone: getVal('kPhone'), email: getVal('kEmail'),
        city: getVal('kCity'), province: getVal('kProvince'), address: getVal('kAddress'), notes: getVal('kNotes'), is_active: 1
      };
      try {
        if (editingId) await api('PUT', `/customers/${editingId}`, payload);
        else await api('POST', '/customers', payload);
        toast('Customer berhasil disimpan'); closeModal('modalCustomer'); loadCustomers();
      } catch (e) { toast(e.message, 'error'); }
    }

    function editCustomer(id) { openCustomerModal(id); }
    async function deleteCustomer(id) {
      if (!confirm('Hapus customer ini?')) return;
      try { await api('DELETE', `/customers/${id}`); toast('Customer dihapus'); loadCustomers(); }
      catch (e) { toast(e.message, 'error'); }
    }

    // --------------------------------------------------------------------------------------------------
    // ORDERS
    // --------------------------------------------------------------------------------------------------
    let ordPage = 1, orderItems = [], ordData = [];

    async function loadOrderStats() {
      try {
        const data = await api('GET', '/orders/stats');
        const s = data.data;
        document.getElementById('orderStats').innerHTML = buildStatCards([
          { icon: '🛒', label: 'Total Order', val: s.total, cls: 'brown' },
          { icon: '⏳', label: 'Pending', val: s.pending, cls: 'orange' },
          { icon: '🚚', label: 'Proses', val: s.processing, cls: 'blue' },
          { icon: '✅', label: 'Delivered', val: s.delivered, cls: 'green' },
          { icon: '🆕', label: 'Order Hari Ini', val: s.today_count, cls: 'teal' },
          { icon: '📅', label: 'Order Bulan Ini', val: s.month_confirmed_count, cls: 'brown' },
          { icon: '🚫', label: 'Order Dibatalkan', val: s.cancelled_count, cls: 'purple' },
        ]);
      } catch (e) { }
    }

    async function loadOrders(page = 1) {
      ordPage = page;
      const search = getVal('ordSearch'), status = getVal('ordStatusF'), pay = getVal('ordPayF');
      const from = getVal('ordDateFrom'), to = getVal('ordDateTo');
      try {
        const data = await api('GET', `/orders?page=${page}&limit=20&search=${encodeURIComponent(search)}&status=${status}&payment_status=${pay}&date_from=${from}&date_to=${to}`);
        ordData = data.data || [];
        document.getElementById('ordBody').innerHTML = ordData.map(o => `
      <tr>
        <td><strong style="font-family:var(--font-heading);color:var(--primary)">${o.order_number}</strong></td>
        <td><div style="font-size:.85rem;font-weight:500">${o.customer_name}</div><div style="font-size:.75rem;color:var(--text-light)">${o.customer_phone || ''}</div></td>
        <td style="font-weight:700;color:var(--primary)">${fmtRp(o.total)}</td>
        <td>${statusBadge(o.status)}</td>
        <td>${statusBadge(o.payment_status)}</td>
        <td style="font-size:.78rem">${fmtDateOnly(o.created_at)}</td>
        <td>
          <div style="display:flex;gap:.3rem;flex-wrap:wrap">
            <button class="btn btn-sm btn-outline" onclick="viewInvoice(${o.id}, event)" title="Invoice">🧾</button>
            <button class="btn btn-sm btn-primary" onclick="openOrderModal(${o.id})" title="Edit Pesanan">✏️</button>
            <button class="btn btn-sm btn-outline" onclick="editOrderStatus(${o.id})" title="Update Status">⚙️</button>
            ${me.role !== 'marketing' ? `<button class="btn btn-sm btn-danger" onclick="deleteOrder(${o.id})" title="Hapus">🗑</button>` : ''}
          </div>
        </td>
      </tr>`).join('');
        buildPagination('ordPagination', data.pagination, 'loadOrders');
      } catch (e) { toast(e.message, 'error'); }
    }

    function resetOrderDateFilter() {
      setVal('ordDateFrom', '');
      setVal('ordDateTo', '');
      loadOrders();
    }

    function fillCustomer() {
      const id = getVal('oCustomerId');
      if (!id) return;
      const c = cusData.find(c => c.id == id);
      if (c) { setVal('oCusName', c.name); setVal('oCusPhone', c.phone || ''); setVal('oCusEmail', c.email || ''); setVal('oAddr', c.address || ''); }
    }

    function addOrderItem() {
      const idx = orderItemCount++;
      const div = document.createElement('div');
      div.className = 'item-row'; div.id = `item_${idx}`;

      // Rebuild datalist setiap kali (agar selalu up-to-date dengan data products terbaru)
      let dl = document.getElementById('dl_products');
      if (dl) dl.remove(); // hapus yang lama
      dl = document.createElement('datalist');
      dl.id = 'dl_products';
      if (typeof products !== 'undefined' && products.length) {
        dl.innerHTML = products.map(p => {
          const lbl = p.sku ? `[${p.sku}] ${p.name}` : p.name;
          return `<option value="${lbl}">`;
        }).join('');
      }
      document.body.appendChild(dl);

      div.innerHTML = `
    <div class="form-group" style="margin:0">
      <label style="font-size:.72rem">Ketik SKU / Nama Produk *</label>
      <input type="text" list="dl_products" id="iName_${idx}" placeholder="Pilih dari daftar atau ketik manual..." oninput="handleProductInput(${idx})">
      <div id="iStockDisplay_${idx}" style="font-size:.65rem;color:var(--primary);margin-top:.2rem;font-weight:600"></div>
    </div>
    <div class="form-group" style="margin:0">
      <label style="font-size:.72rem">Qty *</label>
      <input type="number" id="iQty_${idx}" value="1" min="1" onchange="calcTotal()" onkeyup="calcTotal()">
    </div>
    <div class="form-group" style="margin:0">
      <label style="font-size:.72rem">Harga Satuan (Rp) *</label>
      <input type="number" id="iPrice_${idx}" value="" placeholder="0" min="0" onchange="calcTotal()" onkeyup="calcTotal()">
    </div>
    <div style="margin:0;align-self:end;padding-bottom:.35rem">
      <div style="font-size:.7rem;color:var(--text-light);margin-bottom:.2rem">Subtotal</div>
      <div class="item-subtotal" id="iSub_${idx}">Rp 0</div>
    </div>
    <div style="align-self:end;padding-bottom:.35rem">
      <button class="btn btn-sm btn-danger" onclick="removeOrderItem(${idx})">✖️</button>
    </div>`;
      document.getElementById('orderItems').appendChild(div);
      orderItems.push(idx);
    }

    window.handleProductInput = function (idx) {
      const input = document.getElementById(`iName_${idx}`);
      const val = input.value;
      const priceInput = document.getElementById(`iPrice_${idx}`);
      const qtyInput = document.getElementById(`iQty_${idx}`);

      if (typeof products !== 'undefined' && products.length) {
        const prod = products.find(p => {
          const lbl = p.sku ? `[${p.sku}] ${p.name}` : p.name;
          return lbl === val;
        });

        if (prod) {
          priceInput.value = prod.sell_price || 0;
          input.dataset.productId = prod.id;
          input.dataset.sku = prod.sku || '';

          // Set Max Qty based on warehouse stock
          const stock = parseInt(prod.warehouse_stock) || 0;
          qtyInput.max = stock;
          document.getElementById(`iStockDisplay_${idx}`).textContent = `📦 Tersedia: ${stock} ${prod.unit || 'unit'}`;

          // If current qty > stock, adjust it
          if (parseInt(qtyInput.value) > stock) {
            qtyInput.value = stock;
            toast(`Stok tidak mencukupi. Maksimal: ${stock}`, 'warning');
          }
        } else {
          delete input.dataset.productId;
          delete input.dataset.sku;
          qtyInput.removeAttribute('max');
          document.getElementById(`iStockDisplay_${idx}`).textContent = '';
        }
      }
      calcTotal();
    };

    function removeOrderItem(idx) {
      document.getElementById(`item_${idx}`)?.remove();
      orderItems = orderItems.filter(i => i !== idx);
      calcTotal();
    }

    function calcTotal() {
      let sub = 0;
      orderItems.forEach(idx => {
        const qEl = document.getElementById(`iQty_${idx}`);
        let qty = parseFloat(qEl?.value || 0);
        const max = parseFloat(qEl?.max);
        if (max !== NaN && qty > max) {
          qty = max;
          qEl.value = max;
          toast(`Jumlah melebihi stok tersedia (${max})`, 'warning');
        }

        const price = parseFloat(document.getElementById(`iPrice_${idx}`)?.value || 0);
        const s = qty * price; sub += s;
        const el = document.getElementById(`iSub_${idx}`);
        if (el) el.textContent = fmtRp(s);
      });
      const disc = parseFloat(getVal('oDiscount') || 0);
      const ship = parseFloat(getVal('oShipping') || 0);
      setVal('oTotal', fmtRp(sub - disc + ship));
    }

    function openOrderModal(id = null) {
      editingId = id;
      document.getElementById('modalOrdTitle').textContent = id ? 'Edit Order' : 'Buat Order Baru';
      ['oCusName', 'oCusPhone', 'oCusEmail', 'oAddr', 'oShipAddr', 'oNotes'].forEach(f => setVal(f, ''));
      setVal('oDiscount', ''); setVal('oShipping', ''); setVal('oTotal', 'Rp 0');
      setVal('oCustomerId', ''); setVal('oPayMethod', ''); setVal('oDelivery', '');
      document.getElementById('orderItems').innerHTML = '';
      orderItems = []; orderItemCount = 0;

      loadCustomersDropdown();

      if (id) {
        api('GET', `/orders/${id}`).then(res => {
          const o = res.data;
          setVal('oCustomerId', o.customer_id || '');
          setVal('oCusName', o.customer_name);
          setVal('oCusPhone', o.customer_phone || '');
          setVal('oCusEmail', o.customer_email || '');
          setVal('oPayMethod', o.payment_method || '');
          setVal('oDelivery', o.delivery_date ? o.delivery_date.split('T')[0] : '');
          setVal('oAddr', o.customer_addr || '');
          setVal('oShipAddr', o.shipping_addr || '');
          setVal('oDiscount', o.discount || 0);
          setVal('oShipping', o.shipping_cost || 0);
          setVal('oNotes', o.notes || '');

          if (o.items && o.items.length) {
            o.items.forEach(item => {
              addOrderItem();
              const idx = orderItemCount - 1;
              const nameInput = document.getElementById(`iName_${idx}`);
              nameInput.value = item.product_sku ? `[${item.product_sku}] ${item.product_name}` : item.product_name;
              nameInput.dataset.productId = item.product_id || '';
              nameInput.dataset.sku = item.product_sku || '';
              setVal(`iQty_${idx}`, item.qty);
              setVal(`iPrice_${idx}`, item.unit_price);
              handleProductInput(idx);
            });
          }
          calcTotal();
        }).catch(err => toast(err.message, 'error'));
      } else {
        addOrderItem();
      }

      openModal('modalOrder');
    }

    async function saveOrder() {
      const cusName = getVal('oCusName');
      if (!cusName) { toast('Nama customer wajib diisi', 'warning'); return; }
      const items = orderItems.map(idx => {
        const input = document.getElementById(`iName_${idx}`);
        const rawProductId = input?.dataset.productId;
        return {
          product_id: rawProductId ? parseInt(rawProductId) : null,
          product_sku: input?.dataset.sku || null,
          product_name: input?.value || '',
          qty: parseInt(document.getElementById(`iQty_${idx}`)?.value) || 1,
          unit_price: parseFloat(document.getElementById(`iPrice_${idx}`)?.value) || 0,
          unit: 'unit',
        };
      }).filter(i => i.product_name && i.qty > 0);
      if (!items.length) { toast('Tambahkan minimal 1 item order', 'warning'); return; }

      const payload = {
        customer_id: getVal('oCustomerId') || null, customer_name: cusName,
        customer_phone: getVal('oCusPhone'), customer_email: getVal('oCusEmail'),
        customer_addr: getVal('oAddr'), shipping_addr: getVal('oShipAddr'),
        payment_method: getVal('oPayMethod'), discount: parseFloat(getVal('oDiscount')) || 0,
        shipping_cost: parseFloat(getVal('oShipping')) || 0, notes: getVal('oNotes'),
        delivery_date: getVal('oDelivery') || null, items
      };
      try {
        const method = editingId ? 'PUT' : 'POST';
        const endpoint = editingId ? `/orders/${editingId}` : '/orders';
        const r = await api(method, endpoint, payload);

        toast(editingId ? `Order ${r.order_number || ''} berhasil diupdate!` : `Order ${r.order_number || ''} berhasil dibuat!`, 'success');
        closeModal('modalOrder'); loadOrders(); loadOrderStats();
      } catch (e) { toast(e.message, 'error'); }
    }

    let _editingOrderId = null;

    function editOrderStatus(id) {
      const o = ordData.find(o => o.id === id);
      if (!o) return;
      _editingOrderId = id;
      document.getElementById('osOrderNo').textContent = o.order_number;
      document.getElementById('osCustomerName').textContent = o.customer_name;
      setVal('osStatus', o.status);
      setVal('osPayStatus', o.payment_status);
      openModal('modalOrderStatus');
    }

    async function saveOrderStatus() {
      const status = getVal('osStatus');
      const payStatus = getVal('osPayStatus');
      try {
        await api('PUT', `/orders/${_editingOrderId}/status`, { status, payment_status: payStatus });
        toast('Status order berhasil diperbarui ✅');
        closeModal('modalOrderStatus');
        loadOrders();
      } catch (e) { toast(e.message, 'error'); }
    }

    async function deleteOrder(id) {
      if (!confirm('Hapus order ini? Aksi ini tidak dapat dibatalkan.')) return;
      try { await api('DELETE', `/orders/${id}`); toast('Order dihapus'); loadOrders(); }
      catch (e) { toast(e.message, 'error'); }
    }

    async function viewInvoice(id, e) {
      const btn = e?.currentTarget || e?.target;
      const oldHtml = btn ? btn.innerHTML : '🧾';
      if (btn) { btn.disabled = true; btn.innerHTML = '⏳'; }

      const win = window.open('', '_blank');
      if (win) {
        win.document.write(`
      <html>
        <head>
          <title>Memuat Invoice...</title>
          <style>
            body { display:flex; align-items:center; justify-content:center; height:100vh; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background:#F5F0EB; color:#5C2E0E; margin:0; }
            .loader { text-align:center; }
            .spinner { width:40px; height:40px; border:4px solid #E8D5B7; border-top:4px solid #5C2E0E; border-radius:50%; animation:spin 1s linear infinite; margin:0 auto 16px; }
            @keyframes spin { 0% { transform:rotate(0deg); } 100% { transform:rotate(360deg); } }
            .text { font-size:14px; font-weight:500; letter-spacing:0.5px; }
          </style>
        </head>
        <body>
          <div class="loader">
            <div class="spinner"></div>
            <div class="text">Sedang menyiapkan invoice...</div>
          </div>
        </body>
      </html>
    `);
      } else {
        if (btn) { btn.disabled = false; btn.innerHTML = oldHtml; }
        toast('Popup diblokir browser. Izinkan popup untuk domain ini.', 'warning');
        return;
      }

      try {
        const data = await api('GET', `/orders/${id}/invoice`);
        const { order, company } = data.data;

        const rows = (order.items || []).map((item, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${item.product_name}</strong>${item.product_sku ? `<br><span style="font-size:9px;color:#888">${item.product_sku}</span>` : ''}</td>
        <td style="text-align:center">${item.qty} ${item.unit || 'unit'}</td>
        <td style="text-align:right">${fmtRp(item.unit_price)}</td>
        <td style="text-align:right;font-weight:700">${fmtRp(item.subtotal)}</td>
      </tr>`).join('');

        const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Invoice ${order.order_number}</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Outfit',sans-serif; color:#2C1A0E; padding:40px; background:#f4f1ee; line-height:1.4; font-size:13px; }
    
    .actions { position:fixed; top:20px; right:20px; display:flex; gap:10px; z-index:999; }
    .btn { border:none; padding:12px 24px; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer; box-shadow:0 10px 20px rgba(0,0,0,0.1); transition:.2s; display:flex; align-items:center; gap:8px; }
    .btn-primary { background:#5C2E0E; color:#fff; }
    .btn-outline { background:#fff; color:#5C2E0E; border:1px solid #5C2E0E; }
    .btn:hover { transform:translateY(-2px); box-shadow:0 12px 24px rgba(0,0,0,0.15); }
    
    @media print { .actions { display:none !important; } body { padding:0; background:#fff; } .invoice-card { box-shadow:none !important; margin:0 !important; width:100% !important; max-width:none !important; } }

    .invoice-card { background:#fff; max-width:800px; margin:0 auto; padding:50px; box-shadow:0 20px 50px rgba(0,0,0,0.05); border-radius:12px; position:relative; }
    .invoice-card::before { content:''; position:absolute; top:0; left:0; right:0; height:8px; background:linear-gradient(90deg, #5C2E0E, #C49A6C); border-radius:12px 12px 0 0; }

    .header { display:flex; justify-content:space-between; margin-bottom:40px; border-bottom:2px solid #F0EBE3; padding-bottom:24px; }
    .co-info h1 { font-size:28px; margin:0; color:#5C2E0E; font-weight:700; line-height:1; }
    .co-info p { margin:4px 0; font-size:12px; color:#6B5040; }
    
    .inv-meta { text-align:right; }
    .inv-meta h2 { font-size:36px; margin:0; color:#5C2E0E; font-weight:800; letter-spacing:3px; line-height:1; }
    .inv-meta .inv-no { margin:8px 0; font-size:16px; font-weight:700; color:#5C2E0E; }
    
    .client-info { display:grid; grid-template-columns:1fr 1fr; gap:40px; margin-bottom:32px; background: #F9F7F5; padding: 24px; border-radius: 12px; }
    .info-box h4 { margin:0 0 10px 0; font-size:11px; text-transform:uppercase; color:#8B4513; letter-spacing:1.5px; font-weight: 700; }
    .info-box p { margin:2px 0; font-size:13px; font-weight:500; color: #2C1A0E; }
    
    table { width:100%; border-collapse:collapse; margin-top:20px; }
    th { background:#F5F0EB; text-align:left; padding:14px 12px; border-bottom:2px solid #5C2E0E; text-transform:uppercase; color:#5C2E0E; font-size: 11px; font-weight:800; letter-spacing: 1px; }
    td { padding:14px 12px; border-bottom:1px solid #F0EBE3; vertical-align:top; font-size: 13px; }
    
    .totals-wrap { margin-top:30px; display:flex; justify-content:flex-end; }
    .totals-table { width:300px; }
    .tot-row { display:flex; justify-content:space-between; padding:8px 0; font-size:14px; color: #6B5040; }
    .tot-row.grand { border-top:2px solid #5C2E0E; margin-top:10px; padding-top:12px; font-weight:800; font-size:20px; color:#5C2E0E; }
    
    .status-badge { display:inline-block; padding:6px 12px; border-radius:6px; font-size:11px; font-weight:700; text-transform:uppercase; margin-top:8px; }
    .status-paid { background:#E8F5E9; color:#2E7D32; }
    .status-unpaid { background:#FFEBEE; color:#C62828; }
    
    .footer { margin-top:60px; font-size:12px; color:#999; text-align:center; border-top:1px solid #F0EBE3; padding-top:24px; }
    .notes { margin-top:40px; padding: 16px; background: #F9F7F5; border-radius: 8px; font-size: 12px; border-left: 4px solid #C49A6C; }
  </style>
</head>
<body>
  <div class="actions">
    <button class="btn btn-outline" onclick="savePDF()">📄 Simpan PDF</button>
    <button class="btn btn-primary" onclick="doPrint()">🖨️ Cetak Langsung</button>
  </div>
  
  <div class="invoice-card" id="invoiceArea">
  
  <div class="header">
    <div class="co-info">
      <h1>${company.site_name || 'JOGJA FURNITURE'}</h1>
      <p style="text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Furniture & Interior Solutions</p>
      <p>📍 ${company.address || '—'}</p>
      <p>📞 ${company.phone || '—'}</p>
      <p>✉️ ${company.email || '—'}</p>
    </div>
    <div class="inv-meta">
      <h2>INVOICE</h2>
      <div class="inv-no">${order.order_number}</div>
      <div style="font-size:13px; color:#6B5040;">Tanggal: ${fmtDateOnly(order.created_at)}</div>
      <div class="status-badge ${order.payment_status === 'paid' ? 'status-paid' : 'status-unpaid'}">${order.payment_status.toUpperCase()}</div>
    </div>
  </div>

  <div class="client-info">
    <div class="info-box">
      <h4>DITUJUKAN KEPADA</h4>
      <p><strong>${order.customer_name}</strong></p>
      <p>${order.customer_phone || ''}</p>
      <p>${order.customer_email || ''}</p>
    </div>
    <div class="info-box">
      <h4>ALAMAT PENGIRIMAN</h4>
      <p>${order.shipping_addr || order.customer_addr || '—'}</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:40px">#</th>
        <th>Deskripsi Produk</th>
        <th style="text-align:center;width:100px">Qty</th>
        <th style="text-align:right;width:150px">Harga</th>
        <th style="text-align:right;width:150px">Subtotal</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals-wrap">
    <div class="totals-table">
      <div class="tot-row"><span>Subtotal</span><span>${fmtRp(order.subtotal)}</span></div>
      ${order.discount > 0 ? `<div class="tot-row" style="color:#2E7D32"><span>Diskon</span><span>- ${fmtRp(order.discount)}</span></div>` : ''}
      ${order.shipping_cost > 0 ? `<div class="tot-row"><span>Ongkos Kirim</span><span>${fmtRp(order.shipping_cost)}</span></div>` : ''}
      <div class="tot-row grand"><span>TOTAL</span><span>${fmtRp(order.total)}</span></div>
    </div>
  </div>

  ${order.notes ? `<div class="notes"><strong>Catatan:</strong><br>${order.notes}</div>` : ''}

    <div class="footer">
      <p>Terima kasih atas pesanan Anda! Kepuasan Anda adalah prioritas kami.</p>
      <p style="margin-top: 8px; opacity: 0.7;">Dokumen ini sah dan diproses secara digital oleh sistem Jogja Furniture Enterprise.</p>
    </div>
  </div>

  <script>
    function savePDF() {
      const element = document.getElementById('invoiceArea');
      const opt = {
        margin: 0,
        filename: 'Invoice_${order.order_number}.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
      };
      html2pdf().set(opt).from(element).save();
    }
    function doPrint() {
      setTimeout(() => { window.print(); }, 100);
    }
  </script>
</body>
</html>`;
        if (win) {
          const blob = new Blob([html], { type: 'text/html' });
          win.location.href = URL.createObjectURL(blob);
        }
      } catch (e) {
        if (win) win.close();
        toast(e.message, 'error');
      } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = oldHtml; }
      }
    }

    function renderInvoice(data) {
      const { order, company } = data;
      const el = document.getElementById('invoiceContent');
      const rows = (order.items || []).map((item, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${item.product_name}</td>
      <td style="text-align:center">${item.qty} ${item.unit || 'unit'}</td>
      <td style="text-align:right">${fmtRp(item.unit_price)}</td>
      <td style="text-align:right;font-weight:600">${fmtRp(item.subtotal)}</td>
    </tr>`).join('');

      el.innerHTML = `
    <div class="inv-header">
      <div class="inv-company">
        <div class="co-name">${company.site_name || 'Jogja Furniture'}</div>
        <div class="co-tag">Furniture & Interior</div>
        <div class="co-contact">
          📍 ${company.address || ''}<br>
          📞 ${company.phone || ''}<br>
          ✉️ ${company.email || ''}
        </div>
      </div>
      <div class="inv-meta">
        <div class="inv-number">INVOICE</div>
        <div><strong>${order.order_number}</strong></div>
        <div style="margin-top:.5rem">Tanggal: ${fmtDateOnly(order.created_at)}</div>
        ${order.delivery_date ? `<div>Pengiriman: ${fmtDateOnly(order.delivery_date)}</div>` : ''}
        <div style="margin-top:.5rem">${statusBadge(order.status)} ${statusBadge(order.payment_status)}</div>
      </div>
    </div>
    <div class="inv-info">
      <div class="inv-info-block">
        <h4>Kepada Yth.</h4>
        <p><strong>${order.customer_name}</strong><br>${order.customer_phone || ''}<br>${order.customer_email || ''}</p>
      </div>
      <div class="inv-info-block">
        <h4>Alamat Pengiriman</h4>
        <p>${order.shipping_addr || order.customer_addr || 'Sama dengan alamat tagihan'}</p>
        ${order.payment_method ? `<h4 style="margin-top:.75rem">Pembayaran</h4><p>${order.payment_method}</p>` : ''}
      </div>
    </div>
    <table class="inv-table">
      <thead><tr><th>#</th><th>Deskripsi</th><th style="text-align:center">Qty</th><th style="text-align:right">Harga Satuan</th><th style="text-align:right">Subtotal</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="inv-totals">
      <div class="tot-row"><span>Subtotal</span><span>${fmtRp(order.subtotal)}</span></div>
      ${order.discount > 0 ? `<div class="tot-row"><span>Diskon</span><span style="color:var(--success)">- ${fmtRp(order.discount)}</span></div>` : ''}
      ${order.shipping_cost > 0 ? `<div class="tot-row"><span>Ongkos Kirim</span><span>${fmtRp(order.shipping_cost)}</span></div>` : ''}
      <div class="tot-row grand"><span>TOTAL</span><span>${fmtRp(order.total)}</span></div>
      ${order.amount_paid > 0 ? `<div class="tot-row" style="color:var(--success)"><span>Terbayar</span><span>${fmtRp(order.amount_paid)}</span></div>` : ''}
      ${order.total - order.amount_paid > 0 ? `<div class="tot-row" style="color:var(--danger)"><span>Sisa</span><span>${fmtRp(order.total - order.amount_paid)}</span></div>` : ''}
    </div>
    ${order.notes ? `<div style="margin-top:1.5rem;padding:1rem;background:var(--gray50);border-radius:var(--radius-sm);font-size:.85rem"><strong>Catatan:</strong> ${order.notes}</div>` : ''}
    <div class="inv-signatures">
      <div class="sign-box"><div class="sign-line"></div><div>Admin / Kasir</div><div style="font-weight:600;margin-top:.2rem">${order.created_by_name || '—'}</div></div>
      <div class="sign-box"><div class="sign-line"></div><div>Penerima / Customer</div><div style="font-weight:600;margin-top:.2rem">${order.customer_name}</div></div>
    </div>
    <div class="inv-footer">
      <p>Terima kasih telah mempercayakan kebutuhan furnitur Anda kepada <strong>${company.site_name || 'Jogja Furniture Decoration'}</strong></p>
      <p style="margin-top:.3rem">Dokumen ini sah tanpa tanda tangan basah</p>
    </div>`;
    }



    // --------------------------------------------------------------------------------------------------
    // USERS (Superadmin)
    // --------------------------------------------------------------------------------------------------
    let logPage = 1;
    async function loadActivityLogs(page = 1) {
      logPage = page;
      const module = getVal('logModule');
      try {
        const data = await api('GET', `/activity-logs?page=${page}&limit=20&module=${encodeURIComponent(module)}`);
        const logs = data.data || [];
        document.getElementById('logBody').innerHTML = logs.map(l => `
      <tr>
        <td style="font-size:.8rem">${fmtDate(l.created_at)}</td>
        <td><strong>${l.username || '—'}</strong></td>
        <td><span class="badge badge-${l.role}">${roleLabel(l.role)}</span></td>
        <td><span class="badge badge-draft">${l.action}</span></td>
        <td>${l.module || '—'}</td>
        <td style="font-size:.82rem;color:var(--text-light)">${l.description || '—'}</td>
        <td style="font-size:.78rem;color:var(--gray500)">${l.ip_address || '—'}</td>
      </tr>`).join('') || '<tr><td colspan="7" style="text-align:center;padding:1.5rem">Tidak ada log aktivitas</td></tr>';
        buildPagination('logPagination', data.pagination, 'loadActivityLogs');
      } catch (e) { toast(e.message, 'error'); }
    }

    async function loadControlCenter() {
      try {
        const res = await api('GET', '/control-center/stats');
        const s = res.data.stats;
        const { recent_logs, users_by_role, orders_30days } = res.data;
        const statsEl = document.getElementById('ccStats');
        if (statsEl) {
          statsEl.innerHTML = buildStatCards([
            { icon: '🆕', label: 'Order Hari Ini', val: s.today_orders, cls: 'teal' },
            { icon: '📅', label: 'Order Bulan Ini', val: s.month_confirmed, cls: 'brown' },
            { icon: '⏳', label: 'Order Pending', val: s.pending_orders, cls: 'orange' },
            { icon: '📊', label: 'Total Order', val: s.total_orders, cls: 'blue' },
            { icon: '📦', label: 'Total Produk', val: s.total_products, cls: 'green' },
            { icon: '⚠️', label: 'Stok Kritis', val: s.low_stock, cls: 'red' },
            { icon: '❌', label: 'Stok Habis', val: s.out_of_stock, cls: 'purple' },
            { icon: '⭐', label: 'Produk Baru', val: s.new_products, cls: 'orange' },
            { icon: '🏢', label: 'Supplier', val: s.total_suppliers, cls: 'green' },
            { icon: '👤', label: 'Total Akun User', val: s.total_users, cls: 'brown' },
            { icon: '👥', label: 'Total Customer', val: s.total_customers, cls: 'blue' },
            { icon: '📨', label: 'Pesan Masuk', val: s.unread_contacts, cls: 'red' }
          ]);
        }

        const invKPI = document.getElementById('ccInventoryKPI');
        if (invKPI) {
          invKPI.style.display = 'block';
          invKPI.innerHTML = `<div style="background:var(--gray50);padding:1rem 1.5rem;border-radius:8px;border-left:4px solid var(--accent)">
        <div style="font-size:.8rem;color:var(--text-light)">Total Nilai Inventori (Harga Beli)</div>
        <div style="font-size:1.4rem;font-weight:700;color:var(--primary)">${fmtRp(s.inventory_value)}</div>
      </div>`;
        }

        if (orders_30days && orders_30days.length) {
          const canvas = document.getElementById('chartRevenue');
          if (canvas) {
            if (canvas._chartInstance) canvas._chartInstance.destroy();
            canvas._chartInstance = new Chart(canvas, {
              type: 'line',
              data: {
                labels: orders_30days.map(x => x.date),
                datasets: [{
                  label: 'Volume Order',
                  data: orders_30days.map(x => x.count),
                  borderColor: '#5C2E0E',
                  backgroundColor: 'rgba(92, 46, 14, 0.1)',
                  tension: 0.3,
                  fill: true
                }]
              },
              options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
            });
          }
        }

        if (users_by_role && users_by_role.length) {
          const canvas = document.getElementById('chartRoleDonut');
          if (canvas) {
            if (canvas._chartInstance) canvas._chartInstance.destroy();
            canvas._chartInstance = new Chart(canvas, {
              type: 'doughnut',
              data: {
                labels: users_by_role.map(x => roleLabel(x.role)),
                datasets: [{
                  data: users_by_role.map(x => x.count),
                  backgroundColor: ['#5C2E0E', '#D4A97A', '#C49A6C', '#8B4513']
                }]
              },
              options: { responsive: false, plugins: { legend: { display: false } }, cutout: '70%' }
            });
          }
          const ccRoleChart = document.getElementById('ccRoleChart');
          if (ccRoleChart) {
            ccRoleChart.innerHTML = users_by_role.map((r, i) => {
              const colors = ['#5C2E0E', '#D4A97A', '#C49A6C', '#8B4513'];
              return `<div style="display:flex;justify-content:space-between;font-size:.8rem;margin-bottom:.3rem">
             <span><span style="display:inline-block;width:10px;height:10px;background:${colors[i % colors.length]};border-radius:2px;margin-right:6px"></span>${roleLabel(r.role)}</span>
             <strong>${r.count}</strong>
           </div>`;
            }).join('');
          }
        }

        const logBody = document.getElementById('ccLogsBody');
        if (logBody) {
          logBody.innerHTML = (recent_logs || []).map(l => `
        <tr>
          <td style="font-size:.8rem">${fmtDate(l.created_at)}</td>
          <td><strong>${l.username}</strong></td>
          <td><span class="badge badge-draft">${l.action}</span></td>
          <td>${l.module || '—'}</td>
        </tr>`).join('') || '<tr><td colspan="4" style="text-align:center">Tidak ada aktivitas</td></tr>';
        }

      } catch (e) { toast(e.message, 'error'); }
    }

    let usrPage = 1, usrData = [];
    async function loadUsers(page = 1) {
      usrPage = page;
      const search = getVal('usrSearch'), role = getVal('usrRoleF');
      try {
        const data = await api('GET', `/users?page=${page}&limit=20&search=${encodeURIComponent(search)}&role=${role}`);
        usrData = data.data || [];
        document.getElementById('usrBody').innerHTML = usrData.map(u => `
      <tr style="${!u.is_active ? 'opacity:.6' : ''}">
        <td><strong>${u.username}</strong>${u.id == me.id ? ' <span style="font-size:.7rem;color:var(--accent)">(Anda)</span>' : ''}</td>
        <td>${u.full_name || '—'}</td>
        <td style="font-size:.82rem">${u.email}</td>
        <td><span class="badge badge-${u.role}">${roleLabel(u.role)}</span></td>
        <td>${u.is_active ? '<span class="badge badge-active">Aktif</span>' : '<span class="badge badge-inactive">Nonaktif</span>'}</td>
        <td style="font-size:.78rem">${u.last_login ? fmtDate(u.last_login) : 'Belum login'}</td>
        <td>
          <div style="display:flex;gap:.3rem;flex-wrap:wrap">
            <button class="btn btn-sm btn-outline" onclick="editUser(${u.id})">✏️</button>
            <button class="btn btn-sm btn-outline" onclick="resetUserPassword(${u.id})" title="Reset Password">🔑</button>
            ${u.id != me.id ? `<button class="btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-success'}" onclick="toggleUser(${u.id})" title="${u.is_active ? 'Nonaktifkan' : 'Aktifkan'}">${u.is_active ? '🚫' : '✅'}</button>` : ''}
            ${u.id != me.id ? `<button class="btn btn-sm btn-danger" onclick="forceLogoutUser(${u.id})" title="Force Logout">🔒</button>` : ''}
          </div>
        </td>
      </tr>`).join('');
        buildPagination('usrPagination', data.pagination, 'loadUsers');
      } catch (e) { toast(e.message, 'error'); }
    }

    let currentEditUserId = null;
    const editUser = openUserModal;
    function openUserModal(id = null) {
      currentEditUserId = id;
      const title = document.getElementById('modalUserTitle');
      const passGroup = document.getElementById('uPassGroup');

      setVal('uUsername', '');
      setVal('uRole', 'marketing');
      setVal('uEmail', '');
      setVal('uName', '');
      setVal('uPhone', '');
      setVal('uPassword', '');
      document.getElementById('uActive').checked = true;
      document.getElementById('uUsername').disabled = false;

      if (id) {
        const u = usrData.find(x => x.id == id);
        if (!u) return;
        title.innerText = 'Edit User';
        passGroup.style.display = 'none';
        setVal('uUsername', u.username);
        document.getElementById('uUsername').disabled = true;
        setVal('uRole', u.role);
        setVal('uEmail', u.email);
        setVal('uName', u.full_name || '');
        setVal('uPhone', u.phone || '');
        document.getElementById('uActive').checked = !!u.is_active;
      } else {
        title.innerText = 'Tambah User Baru';
        passGroup.style.display = 'block';
      }
      openModal('modalUser');
    }

    async function saveUser() {
      const username = getVal('uUsername'), role = getVal('uRole'), email = getVal('uEmail'),
        full_name = getVal('uName'), phone = getVal('uPhone'), password = getVal('uPassword'),
        is_active = document.getElementById('uActive').checked ? 1 : 0;

      if (!email || !role || (!currentEditUserId && (!username || !password))) {
        toast('Field wajib (*) harus diisi', 'warning'); return;
      }

      const body = { role, email, full_name, phone, is_active };
      if (!currentEditUserId) {
        body.username = username;
        body.password = password;
      }

      try {
        const method = currentEditUserId ? 'PUT' : 'POST';
        const url = currentEditUserId ? `/users/${currentEditUserId}` : '/users';
        await api(method, url, body);
        toast(`User berhasil ${currentEditUserId ? 'diupdate' : 'dibuat'}`);
        closeModal('modalUser');
        loadUsers(usrPage);
      } catch (e) { toast(e.message, 'error'); }
    }

    async function resetUserPassword(id) {
      const nw = prompt('Masukkan password baru (min 8 karakter):');
      if (!nw) return;
      if (nw.length < 8) { toast('Password minimal 8 karakter', 'warning'); return; }
      try {
        await api('POST', `/users/${id}/reset-password`, { new_password: nw });
        toast('Password berhasil direset');
      } catch (e) { toast(e.message, 'error'); }
    }

    async function toggleUser(id) {
      try {
        const res = await api('POST', `/users/${id}/toggle`);
        toast(`User berhasil ${res.is_active ? 'diaktifkan' : 'dinonaktifkan'}`);
        loadUsers(usrPage);
      } catch (e) { toast(e.message, 'error'); }
    }

    async function forceLogoutUser(id) {
      if (!confirm('Paksa logout user ini dari semua perangkat?')) return;
      try {
        await api('POST', `/users/${id}/force-logout`);
        toast('User berhasil dikeluarkan');
        loadUsers(usrPage);
      } catch (e) { toast(e.message, 'error'); }
    }

    // ==================================================================================================
    // PROFILE & NOTIFICATIONS
    // ==================================================================================================
    async function loadNotifications() {
      try {
        // 1. General Staff Notifications
        const notifRes = await api('GET', '/notifications');
        const notifBadge = document.getElementById('notifBadge');
        if (notifBadge) {
          notifBadge.textContent = notifRes.unread || 0;
          notifBadge.style.display = notifRes.unread > 0 ? 'block' : 'none';
        }

        // 2. Contact/Message Inbox Badge
        if (['superadmin', 'admin_website'].includes(me.role)) {
          const contactRes = await api('GET', '/contacts');
          const unreadContacts = (contactRes.data || []).filter(c => !c.is_read).length;
          const contactBadge = document.getElementById('contactUnreadBadge');
          if (contactBadge) {
            contactBadge.innerHTML = unreadContacts ? `<span class="nav-badge">${unreadContacts}</span>` : '';
          }
        }

        // 3. Render if on notifications page
        if (currentPageId === 'notifications') {
          renderNotifs('notifList');
        }
      } catch (e) {
        console.error('Failed to load notifications:', e.message);
      }
    }

    let notifData = [];
    function toggleNotifDropdown(e) {
      e.stopPropagation();
      const dd = document.getElementById('notifDropdown');
      if (!dd) return;
      const isShow = dd.classList.toggle('show');
      if (isShow) {
        renderNotifs('notifListDropdown');
        const closer = () => { dd.classList.remove('show'); document.removeEventListener('click', closer); };
        document.addEventListener('click', closer);
      }
    }

    function closeNotifDropdown() {
      document.getElementById('notifDropdown')?.classList.remove('show');
    }

    async function renderNotifs(targetId = 'notifListDropdown') {
      const listEl = document.getElementById(targetId);
      if (!listEl) return;

      try {
        const res = await api('GET', '/notifications');
        notifData = res.data || [];

        if (!notifData.length) {
          listEl.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-light)">Tidak ada notifikasi</div>';
          return;
        }

        listEl.innerHTML = notifData.map(n => `
      <div class="notif-item ${n.is_read ? '' : 'unread'}" onclick="handleNotifClick('${n.id}', '${n.link}')">
        <div class="notif-title">${n.title}</div>
        <div class="notif-msg">${n.message}</div>
        <div class="notif-time">${fmtDate(n.created_at)}</div>
      </div>
    `).join('');
      } catch (e) {
        listEl.innerHTML = '<div style="text-align:center;padding:1rem;color:var(--danger)">Gagal memuat notifikasi</div>';
      }
    }

    async function handleNotifClick(id, link) {
      try {
        await api('PUT', `/notifications/${id}/read`);
        loadNotifications(); // Refresh badge
        if (link) {
          if (link.startsWith('/admin/panel.html')) {
            const page = link.split('#')[1];
            if (page) navigateTo(page);
          } else {
            window.location.href = link;
          }
        }
      } catch (e) { }
    }

    async function markAllRead() {
      try {
        await api('PUT', '/notifications/read-all');
        toast('Semua notifikasi ditandai dibaca');
        loadNotifications(); // Refreshes badges and page list (if on page)
        renderNotifs('notifListDropdown'); // Refreshes dropdown list
      } catch (e) { toast(e.message, 'error'); }
    }

    async function loadProfile() {
      try {
        const res = await api('GET', '/profile');
        if (res.success) {
          Object.assign(me, res.data);
          localStorage.setItem('jf_user', JSON.stringify(me));
          // Update header info if present
          const avatar = document.getElementById('adminAvatar');
          const name = document.getElementById('adminName');
          if (avatar) avatar.textContent = (me.full_name || me.username || 'A')[0].toUpperCase();
          if (name) name.textContent = me.full_name || me.username;
        }
      } catch (e) { console.error('Profile sync error', e); }

      const el = document.getElementById('profileInfo');
      if (!el) return;

      el.innerHTML = `
    <div style="padding:1.5rem; display:flex; flex-direction:column; gap:1.2rem">
      <div style="display:flex; align-items:center; gap:1.5rem">
        <div style="width:70px; height:70px; border-radius:50%; background:var(--primary); color:#fff; display:flex; align-items:center; justify-content:center; font-size:2rem; font-weight:700">
          ${(me.full_name || me.username || 'A')[0].toUpperCase()}
        </div>
        <div>
          <div style="font-size:1.2rem; font-weight:700; color:var(--primary)">${me.full_name || me.username}</div>
          <div style="color:var(--text-light); font-size:.85rem">Role: ${roleLabel(me.role)}</div>
        </div>
      </div>
      <div style="display:grid; grid-template-columns:100px 1fr; gap:.5rem; font-size:.9rem; border-top:1px solid var(--gray100); padding-top:1.2rem">
        <div style="color:var(--text-light)">Username</div><div><strong>${me.username}</strong></div>
        <div style="color:var(--text-light)">Email</div><div><strong>${me.email}</strong></div>
        <div style="color:var(--text-light)">Telepon</div><div><strong>${me.phone || '-'}</strong></div>
        <div style="color:var(--text-light)">Terakhir Login</div><div><strong>${fmtDate(me.last_login)}</strong></div>
      </div>
    </div>
  `;
    }
    async function doChangePassword() {
      const old = getVal('cpOld'), nw = getVal('cpNew'), conf = getVal('cpConfirm');
      if (!old || !nw || !conf) { toast('Semua field password wajib diisi', 'warning'); return; }
      if (nw !== conf) { toast('Konfirmasi password tidak cocok', 'warning'); return; }
      if (nw.length < 6) { toast('Password minimal 6 karakter', 'warning'); return; }
      try {
        await api('PUT', '/change-password', { current_password: old, new_password: nw });
        toast('Password berhasil diubah. Harap login ulang.');
        ['cpOld', 'cpNew', 'cpConfirm'].forEach(f => setVal(f, ''));
        setTimeout(() => { localStorage.removeItem('jf_token'); localStorage.removeItem('jf_user'); window.location.href = 'index.html'; }, 2500);
      } catch (e) { toast(e.message, 'error'); }
    }

    // --------------------------------------------------------------------------------------------------
    // EXPORT TRANSACTIONS (PREMIUM)
    // --------------------------------------------------------------------------------------------------
    async function exportTransactionPDF() {
      const btn = event?.target;
      const oldText = btn ? btn.textContent : '📄 Export PDF';
      if (btn) { btn.disabled = true; btn.textContent = '⏳'; }

      const win = window.open('', '_blank');
      if (!win) {
        if (btn) { btn.disabled = false; btn.textContent = oldText; }
        toast('Popup diblokir browser. Izinkan popup untuk domain ini.', 'warning');
        return;
      }

      win.document.write(`
    <html>
      <head>
        <title>Memuat Laporan...</title>
        <style>
          body { display:flex; align-items:center; justify-content:center; height:100vh; font-family:'Segoe UI', sans-serif; background:#F5F0EB; color:#5C2E0E; margin:0; }
          .loader { text-align:center; }
          .spinner { width:40px; height:40px; border:4px solid #E8D5B7; border-top:4px solid #5C2E0E; border-radius:50%; animation:spin 1s linear infinite; margin:0 auto 16px; }
          @keyframes spin { 0% { transform:rotate(0deg); } 100% { transform:rotate(360deg); } }
          .text { font-size:14px; font-weight:500; }
        </style>
      </head>
      <body>
        <div class="loader"><div class="spinner"></div><div class="text">Menyiapkan laporan transaksi...</div></div>
      </body>
    </html>
  `);

      try {
        const type = getVal('txType'), from = getVal('txFrom'), to = getVal('txTo');
        const data = await api('GET', '/stock/transactions?limit=2000&type=' + type + '&date_from=' + from + '&date_to=' + to);
        const items = data.data || [];
        const company = data.company || {};
        const typeLabel = { '': 'Semua Tipe', in: 'Barang Masuk', out: 'Barang Keluar', adjustment: 'Adjustment' };

        const rows = items.map(t => {
          const date = t.created_at ? new Date(t.created_at).toLocaleString('id-ID') : '-';
          return '<tr>' +
            '<td>' + date + '</td>' +
            '<td><strong>' + t.product_name + '</strong>' + (t.sku ? '<br><small>' + t.sku + '</small>' : '') + '</td>' +
            '<td style="text-align:center"><span class="badge badge-' + t.type + '">' + t.type.toUpperCase() + '</span></td>' +
            '<td style="text-align:center;font-weight:700;color:' + (t.type === 'in' ? '#2E7D32' : '#C62828') + '">' + (t.type === 'in' ? '+' : '-') + t.qty + '</td>' +
            '<td style="text-align:center;color:#888">' + t.qty_before + '</td>' +
            '<td style="text-align:center;font-weight:600">' + t.qty_after + '</td>' +
            '<td>' + (t.reference_no || '-') + '</td>' +
            '<td>' + (t.created_by_name || '-') + '</td>' +
            '</tr>';
        }).join('');

        const html = '<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><title>Riwayat Transaksi Stok</title>' +
          '<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet">' +
          '<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>' +
          '<style>' +
          '* { margin:0; padding:0; box-sizing:border-box; }' +
          'body { font-family:"Outfit",sans-serif; color:#2C1A0E; padding:40px; background:#f4f1ee; line-height:1.4; font-size:11px; }' +
          '.actions { position:fixed; top:20px; right:20px; display:flex; gap:10px; z-index:999; }' +
          '.btn { border:none; padding:10px 20px; border-radius:8px; font-size:13px; font-weight:700; cursor:pointer; box-shadow:0 10px 20px rgba(0,0,0,0.1); transition:.2s; display:flex; align-items:center; gap:8px; }' +
          '.btn-primary { background:#5C2E0E; color:#fff; }' +
          '.btn-outline { background:#fff; color:#5C2E0E; border:1px solid #5C2E0E; }' +
          '@media print { .actions { display:none !important; } body { padding:0; background:#fff; } .report-card { box-shadow:none !important; margin:0 !important; width:100% !important; max-width:none !important; } }' +
          '.report-card { background:#fff; max-width:1100px; margin:0 auto; padding:40px; box-shadow:0 20px 50px rgba(0,0,0,0.05); border-radius:12px; position:relative; }' +
          '.report-card::before { content:""; position:absolute; top:0; left:0; right:0; height:8px; background:linear-gradient(90deg, #5C2E0E, #C49A6C); border-radius:12px 12px 0 0; }' +
          '.header { display:flex; justify-content:space-between; margin-bottom:30px; border-bottom:2px solid #F0EBE3; padding-bottom:20px; }' +
          '.co-name { font-size:24px; font-weight:700; color:#5C2E0E; }' +
          '.report-title { font-size:18px; font-weight:700; color:#5C2E0E; text-align:right; }' +
          '.report-meta { font-size:10px; color:#6B5040; text-align:right; margin-top:5px; line-height:1.6; }' +
          'table { width:100%; border-collapse:collapse; margin-top:20px; }' +
          'th { background:#F5F0EB; padding:12px 8px; border-bottom:2px solid #5C2E0E; text-align:left; font-size:10px; text-transform:uppercase; color:#5C2E0E; font-weight:800; }' +
          'td { padding:10px 8px; border-bottom:1px solid #F0EBE3; }' +
          '.badge { padding:2px 6px; border-radius:4px; font-size:9px; font-weight:700; }' +
          '.badge-in { background:#E8F5E9; color:#2E7D32; }' +
          '.badge-out { background:#FFEBEE; color:#C62828; }' +
          '.footer { margin-top:30px; border-top:1px solid #F0EBE3; padding-top:20px; font-size:10px; color:#999; display:flex; justify-content:space-between; }' +
          '</style></head><body>' +
          '<div class="actions">' +
          '<button class="btn btn-outline" onclick="savePDF()">📄 Simpan PDF</button>' +
          '<button class="btn btn-primary" onclick="window.print()">🖨️ Cetak Langsung</button>' +
          '</div>' +
          '<div class="report-card" id="printArea">' +
          '<div class="header"><div><div class="co-name">' + (company.site_name || 'JOGJA FURNITURE') + '</div>' +
          '<div style="font-size:11px;color:#6B5040">' + (company.address || '-') + '</div></div>' +
          '<div><div class="report-title">LAPORAN TRANSAKSI STOK</div><div class="report-meta">' +
          'Periode: ' + (from || 'Awal') + ' - ' + (to || 'Sekarang') + '<br>' +
          'Tipe: ' + (typeLabel[type] || 'Semua') + '<br>' +
          'Dicetak: ' + new Date().toLocaleString('id-ID') + '</div></div></div>' +
          '<table><thead><tr><th>Tanggal</th><th>Produk</th><th style="text-align:center">Tipe</th><th style="text-align:center">Qty</th><th style="text-align:center">Sblm</th><th style="text-align:center">Ssdh</th><th>Ref. No.</th><th>Admin</th></tr></thead>' +
          '<tbody>' + rows + '</tbody></table>' +
          '<div class="footer"><span>Total ' + items.length + ' transaksi ditemukan</span><span>Dicetak oleh: ' + me.full_name + '</span></div></div>' +
          '<script>function savePDF() { const element = document.getElementById("printArea"); const opt = { margin:0.2, filename:"Transaksi_Stok.pdf", image:{type:"jpeg",quality:0.98}, html2canvas:{scale:2}, jsPDF:{unit:"in",format:"a4",orientation:"landscape"} }; html2pdf().set(opt).from(element).save(); } function doPrint() { window.print(); }</script>' +
          '</body></html>';

        const blob = new Blob([html], { type: 'text/html' });
        win.location.href = URL.createObjectURL(blob);
      } catch (e) {
        if (win) win.close();
        toast('Gagal memuat data: ' + e.message, 'error');
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = oldText; }
      }
    }

    // ----------------------------------------------------------------------------------------------------
    // CSS ANIMATIONS
    // ----------------------------------------------------------------------------------------------------
    (function () {
      const style = document.createElement('style');
      style.textContent = `
    @keyframes slideIn { from { transform:translateX(100%); opacity:0; } to { transform:translateX(0); opacity:1; } }
    @keyframes float { 0% { transform:translateY(0px); } 50% { transform:translateY(-10px); } 100% { transform:translateY(0px); } }
  `;
      document.head.appendChild(style);
    })();

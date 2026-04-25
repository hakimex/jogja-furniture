/**
 * admin.js v2.0 — Jogja Furniture Enterprise Admin Panel
 * Roles: superadmin | admin_gudang | admin_website | marketing
 */

'use strict';

// ══════════════════════════════════════════════════════════════
// CONFIG & STATE
// ══════════════════════════════════════════════════════════════
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

// ── Page Rules & Logic ──
const PAGE_RULES = {
  'dashboard': `
    <ul>
      <li><strong>Statistik Utama:</strong> Menampilkan ringkasan data produk, kategori, dan pesan masuk.</li>
      <li><strong>Pesan Terbaru:</strong> Daftar 5 pesan terakhir dari website. Klik "Lihat Semua" untuk membalas.</li>
      <li><strong>Produk Terpopuler:</strong> Berdasarkan jumlah klik/view dari pengunjung website.</li>
    </ul>`,
  'products': `
    <ul>
      <li><strong>Harga:</strong> Admin Gudang melihat Harga Beli, Admin Website melihat Harga Jual.</li>
      <li><strong>Status Stok:</strong> Jika stok ≤ 3 akan berwarna merah (kritis). Jika 0, status otomatis jadi "Out of Stock".</li>
      <li><strong>Publish:</strong> Produk hanya akan muncul di website jika statusnya "Published".</li>
      <li><strong>Unggulan:</strong> Produk bertanda ⭐ akan tampil di halaman depan website.</li>
    </ul>`,
  'products-new': `
    <ul>
      <li><strong>Sumber Data:</strong> Halaman ini berisi produk yang baru diinput oleh Admin Gudang tetapi belum dikonfigurasi kontennya (deskripsi/foto) untuk website.</li>
      <li><strong>Tugas:</strong> Admin Website harus mengedit dan mengubah statusnya menjadi "Published" agar tampil di katalog.</li>
    </ul>`,
  'orders': `
    <ul>
      <li><strong>Potong Stok:</strong> Stok otomatis berkurang saat status diubah ke <em>Confirmed, Processing, Ready,</em> atau <em>Delivered</em>.</li>
      <li><strong>Kembalikan Stok:</strong> Stok otomatis bertambah kembali jika status diubah ke <em>Cancelled</em> atau <em>Refunded</em>.</li>
      <li><strong>Edit/Hapus:</strong> Order yang sudah <em>Delivered</em> atau <em>Paid</em> tidak dapat dihapus/diedit sembarangan demi integritas data.</li>
      <li><strong>Invoice:</strong> Klik ikon 🧾 untuk melihat dan mencetak invoice resmi.</li>
    </ul>`,
  'stock': `
    <ul>
      <li><strong>Barang Masuk:</strong> Menambah stok fisik dan mencatat harga modal terbaru.</li>
      <li><strong>Barang Keluar:</strong> Mengurangi stok fisik secara manual (di luar pesanan website).</li>
      <li><strong>Sinkronisasi:</strong> Setiap perubahan stok di sini akan langsung memperbarui status ketersediaan di website.</li>
    </ul>`,
  'stock-summary': `
    <ul>
      <li><strong>Nilai Inventaris:</strong> Menampilkan total nilai rupiah barang yang tersimpan di gudang berdasarkan harga modal.</li>
      <li><strong>Export:</strong> Gunakan tombol "Export PDF" untuk mencetak laporan stok resmi.</li>
    </ul>`,
  'customers': `
    <ul>
      <li><strong>Total Order:</strong> Sistem melacak berapa kali pelanggan melakukan pemesanan.</li>
      <li><strong>Loyalitas:</strong> Pelanggan dengan akumulasi belanja besar dapat dilihat dari total spend mereka.</li>
    </ul>`,
  'users': `
    <ul>
      <li><strong>Role System:</strong> Pastikan memberikan role yang sesuai (Gudang/Website/Marketing).</li>
      <li><strong>Keamanan:</strong> Gunakan "Force Logout" jika ada indikasi akun disalahgunakan.</li>
    </ul>`,
  'categories': `
    <ul>
      <li><strong>Ikon:</strong> Gunakan emoji untuk ikon kategori agar tampilan di website lebih menarik.</li>
      <li><strong>Slug:</strong> Digunakan untuk URL website. Pastikan unik.</li>
    </ul>`,
  'services': `
    <ul>
      <li><strong>Info:</strong> Gunakan tanda pipa (|) untuk memisahkan poin-poin informasi layanan.</li>
    </ul>`,
  'testimonials': `
    <ul>
      <li><strong>Rating:</strong> Memberikan feedback visual berupa bintang di halaman testimonial.</li>
    </ul>`,
  'contacts': `
    <ul>
      <li><strong>Pesan Masuk:</strong> Pastikan membalas pesan melalui email atau WhatsApp yang tertera.</li>
    </ul>`,
  'settings': `
    <ul>
      <li><strong>Konfigurasi:</strong> Perubahan di sini (Nama Toko, Alamat, Logo) akan langsung berdampak pada seluruh website dan Invoice.</li>
    </ul>`,
  'warehouse-dashboard': `
    <ul>
      <li><strong>Stok Kritis:</strong> Produk yang butuh re-stock segera.</li>
      <li><strong>Inventory Value:</strong> Total nilai modal barang yang ada di gudang.</li>
    </ul>`,
  'marketing-dashboard': `
    <ul>
      <li><strong>Quick Actions:</strong> Pintasan cepat untuk membuat order atau menambah customer.</li>
    </ul>`,
  'stock-transactions': `
    <ul>
      <li><strong>Audit Trail:</strong> Melacak siapa yang melakukan perubahan stok dan kapan.</li>
    </ul>`,
  'suppliers': `
    <ul>
      <li><strong>Manajemen Mitra:</strong> Data supplier untuk mempermudah pencatatan barang masuk.</li>
    </ul>`,
  'notifications': `
    <ul>
      <li><strong>System Alerts:</strong> Pemberitahuan otomatis saat stok habis atau ada order baru.</li>
    </ul>`,
  'control-center': `
    <ul>
      <li><strong>Monitoring:</strong> Ringkasan aktivitas seluruh departemen untuk kebutuhan strategis Owner.</li>
      <li><strong>Order Monitor:</strong> Menampilkan grafik volume order harian untuk memantau tren bisnis.</li>
    </ul>`,
  'profile': `
    <ul>
      <li><strong>Akun:</strong> Anda dapat mengubah data diri dan password secara mandiri.</li>
    </ul>`
};

// ── Debounce ──
const debounce = (fn, ms) => {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
};

// ── Toast ──
function toast(msg, type = 'success') {
  const el = document.createElement('div');
  const colors = { success: '#28a745', error: '#dc3545', warning: '#ffc107', info: '#17a2b8' };
  el.style.cssText = `background:${colors[type] || colors.success};color:#fff;padding:.75rem 1.2rem;border-radius:8px;font-size:.85rem;box-shadow:0 4px 16px rgba(0,0,0,.18);max-width:340px;animation:slideIn .3s ease`;
  el.textContent = msg;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(() => el.remove(), 3800);
}

// ── API Helper ──
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

// ── Format helpers ──
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

// ── Tom Select Helper ──
function initTomSelect(id) {
  const el = document.getElementById(id);
  if (!el || typeof TomSelect === 'undefined') return;
  if (el.tomselect) el.tomselect.destroy();
  new TomSelect(el, {
    create: false,
    placeholder: el.options[0]?.text || "Pilih..."
  });
}

// ══════════════════════════════════════════════════════════════
// AUTH & INIT
// ══════════════════════════════════════════════════════════════
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
  return { superadmin: '👑 Superadmin', admin_gudang: '🏭 Admin Gudang', admin_website: '🌐 Admin Website', marketing: '📣 Marketing' }[r] || r;
}

// ══════════════════════════════════════════════════════════════
// SIDEBAR BUILDER
// ══════════════════════════════════════════════════════════════
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
    el.innerHTML = `<span class="nav-icon">${item.icon}</span> ${item.label}`;
    el.addEventListener('click', () => navigateTo(item.page));
    nav.appendChild(el);
  });

  // Set active first item
  const firstItem = nav.querySelector('.nav-item');
  if (firstItem) firstItem.classList.add('active');
}

// ══════════════════════════════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════════════════════════════
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
    'products-new': '🆕 Produk Baru dari Gudang', 'categories': '🗂 Kategori',
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

// ══════════════════════════════════════════════════════════════
// MODULE SWITCHER (Superadmin)
// ══════════════════════════════════════════════════════════════
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

// ══════════════════════════════════════════════════════════════
// MODAL HELPERS
// ══════════════════════════════════════════════════════════════
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

// ══════════════════════════════════════════════════════════════
// PAGINATION BUILDER
// ══════════════════════════════════════════════════════════════
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

// ══════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════
async function loadDashboard() {
  try {
    const data = await api('GET', '/dashboard');
    const s = data.data.stats;
    const statsEl = document.getElementById('dashStats');
    if (!statsEl) return;

    if (me.role === 'admin_gudang') {
      statsEl.innerHTML = buildStatCards([
        { icon: '📦', label: 'Total Produk', val: s.total_products, cls: 'brown' },
        { icon: '⭐', label: 'Produk Unggulan', val: s.featured_products, cls: 'orange' },
        { icon: '🗂', label: 'Kategori', val: s.total_categories, cls: 'green' },
        { icon: '💬', label: 'Testimoni', val: s.total_testimonials, cls: 'blue' },
      ]);
    } else if (me.role === 'marketing') {
      statsEl.innerHTML = buildStatCards([
        { icon: '📦', label: 'Produk Published', val: s.total_products, cls: 'brown' },
        { icon: '📨', label: 'Pesan Baru', val: s.unread_contacts, cls: 'red' },
        { icon: '🗂', label: 'Kategori', val: s.total_categories, cls: 'green' },
        { icon: '⭐', label: 'Produk Unggulan', val: s.featured_products, cls: 'orange' },
      ]);
    } else {
      statsEl.innerHTML = buildStatCards([
        { icon: '📦', label: 'Total Produk', val: s.total_products, cls: 'brown' },
        { icon: '🗂', label: 'Kategori', val: s.total_categories, cls: 'green' },
        { icon: '🛠', label: 'Layanan', val: s.total_services, cls: 'blue' },
        { icon: '⭐', label: 'Unggulan', val: s.featured_products, cls: 'orange' },
        { icon: '📨', label: 'Pesan Baru', val: s.unread_contacts, cls: 'red' },
        { icon: '💬', label: 'Testimoni', val: s.total_testimonials, cls: 'brown' },
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
            labels: topProds.map(p => p.name.length > 18 ? p.name.substring(0, 18) + '…' : p.name),
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
              y: { ticks: { stepSize: 1 }, grid: { color: '#f0ebe3' } }
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
      { icon: '👥', label: 'Customer Aktif', val: s.total_customers || 0, cls: 'blue' },
      { icon: '🆕', label: 'Order Hari Ini', val: os.today_count || 0, cls: 'teal' },
      { icon: '🗓️', label: 'Order Bulan Ini', val: os.month_confirmed_count || 0, cls: 'orange' },
      { icon: '📋', label: 'Total Order', val: os.total || 0, cls: 'green' },
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
          labels: topProds.map(p => p.name.length > 15 ? p.name.substring(0, 15) + '…' : p.name),
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
            x: { ticks: { stepSize: 1, font: { size: 10 } }, grid: { color: '#f0ebe3' } },
            y: { ticks: { font: { size: 10 } } }
          }
        }
      });
    }
  } catch (e) { toast(e.message, 'error'); }
}

function buildStatCards(items) {
  return items.map(i => `
    <div class="stat-card">
      <div class="stat-icon ${i.cls}">${i.icon}</div>
      <div><div class="stat-num">${i.val ?? 0}</div><div class="stat-lbl">${i.label}</div></div>
    </div>`).join('');
}

// ══════════════════════════════════════════════════════════════
// PRODUCTS
// ══════════════════════════════════════════════════════════════
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
            <button class="btn btn-sm btn-primary" onclick="editProduct(${p.id})">✏️ Edit & Publish</button>
            ${p.publish_status !== 'published' ? `<button class="btn btn-sm btn-success" onclick="quickPublish(${p.id})">🌐 Publish</button>` : ''}
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

  // Role-based field visibility
  const tabWH = document.getElementById('tabWH');
  const tabContent = document.getElementById('tabContent');
  const tabSeo = document.getElementById('tabSeo');
  const pStatusGroup = document.getElementById('pStatusGroup');
  const pFeaturedGroup = document.getElementById('pFeatured') ? document.getElementById('pFeatured').closest('.form-group') : null;
  const pSellPriceInfoGroup = document.getElementById('pSellPriceInfoGroup');

  const isGudang = me.role === 'admin_gudang';
  const isWebsite = me.role === 'admin_website';

  if (tabWH) tabWH.style.display = (isGudang || me.role === 'superadmin') ? '' : 'none';
  if (tabContent) tabContent.style.display = (isGudang) ? 'none' : '';
  if (tabSeo) tabSeo.style.display = (isGudang) ? 'none' : '';
  if (pFeaturedGroup) pFeaturedGroup.style.display = (isGudang) ? 'none' : '';
  const pOrderGroup = document.getElementById('pSortOrder')?.closest('.form-group');
  if (pOrderGroup) pOrderGroup.style.display = (isGudang) ? 'none' : '';

  if (pStatusGroup) pStatusGroup.style.display = (isWebsite || me.role === 'superadmin') ? '' : 'none';
  if (pSellPriceInfoGroup) pSellPriceInfoGroup.style.display = (isWebsite || me.role === 'marketing' || me.role === 'superadmin') ? '' : 'none';

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
    }).catch(e => toast(e.message, 'error'));
  } else {
    // Auto-generate SKU for new products
    const timestampCode = Math.floor(Date.now() / 1000).toString().slice(-6);
    setVal('pSku', `SKU-${timestampCode}`);
  }

  openModal('modalProduct');
}

function switchProdTab(tab, btn) {
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
    // Use CMS endpoint for website admin
    const endpoint = editingId
      ? (me.role === 'admin_website' ? `/products/${editingId}/cms` : `/products/${editingId}`)
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
    await api('DELETE', `/products/${id}`);
    toast('Produk berhasil dihapus');
    loadProducts();
  } catch (e) { toast(e.message, 'error'); }
}

async function quickPublish(id) {
  try {
    await api('PUT', `/products/${id}/publish`);
    toast('Produk berhasil dipublish ke website 🌐');
    loadProducts(); loadNewProducts();
  } catch (e) { toast(e.message, 'error'); }
}

async function quickUnpublish(id) {
  if (!confirm('Sembunyikan produk ini dari website?')) return;
  try {
    await api('PUT', `/products/${id}/unpublish`);
    toast('Produk disembunyikan dari website');
    loadProducts();
  } catch (e) { toast(e.message, 'error'); }
}

async function setPrimaryImg(productId, imageId) {
  try {
    await api('PUT', `/products/${productId}/images/${imageId}/primary`);
    toast('Gambar utama diset'); editProduct(productId);
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteProductImg(productId, imageId) {
  if (!confirm('Hapus gambar ini?')) return;
  try {
    await api('DELETE', `/products/${productId}/images/${imageId}`);
    toast('Gambar dihapus'); editProduct(productId);
  } catch (e) { toast(e.message, 'error'); }
}

// ══════════════════════════════════════════════════════════════
// CATEGORIES
// ══════════════════════════════════════════════════════════════
async function loadCategories() {
  try {
    const data = await api('GET', '/categories');
    categories = data.data || [];
    document.getElementById('catBody').innerHTML = categories.map(c => `
      <tr>
        <td style="font-size:1.4rem">${c.icon}</td>
        <td><strong>${c.name}</strong></td>
        <td><code style="font-size:.75rem;color:var(--text-light)">${c.slug}</code></td>
        <td>${c.is_active ? '<span class="badge badge-active">Aktif</span>' : '<span class="badge badge-inactive">Nonaktif</span>'}</td>
        <td>${c.sort_order}</td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="editCategory(${c.id})">✏️</button>
          ${me.role === 'superadmin' ? `<button class="btn btn-sm btn-danger" onclick="deleteCategory(${c.id})">🗑</button>` : ''}
        </td>
      </tr>`).join('');
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
  ['cName', 'cSlug', 'cDesc', 'cColorFromT', 'cColorToT'].forEach(f => setVal(f, ''));
  setVal('cColorFrom', '#5C2E0E'); setVal('cColorTo', '#C49A6C');
  setVal('cColorFromT', '#5C2E0E'); setVal('cColorToT', '#C49A6C');
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
      setVal('cColorFrom', cat.color_from); setVal('cColorFromT', cat.color_from);
      setVal('cColorTo', cat.color_to); setVal('cColorToT', cat.color_to);
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
    if (editingId) await api('PUT', `/categories/${editingId}`, fd, true);
    else await api('POST', '/categories', fd, true);
    toast('Kategori berhasil disimpan'); closeModal('modalCategory'); loadCategories();
  } catch (e) { toast(e.message, 'error'); }
}

function editCategory(id) { openCategoryModal(id); }

async function deleteCategory(id) {
  if (!confirm('Hapus kategori ini?')) return;
  try { await api('DELETE', `/categories/${id}`); toast('Kategori dihapus'); loadCategories(); }
  catch (e) { toast(e.message, 'error'); }
}

// ══════════════════════════════════════════════════════════════
// SERVICES
// ══════════════════════════════════════════════════════════════
async function loadServices() {
  try {
    const data = await api('GET', '/services');
    document.getElementById('svcBody').innerHTML = (data.data || []).map(s => `
      <tr>
        <td style="font-size:1.4rem">${s.icon}</td>
        <td><strong>${s.name}</strong></td>
        <td style="font-size:.82rem;max-width:280px">${s.short_desc || '—'}</td>
        <td>${s.is_active ? '<span class="badge badge-active">Aktif</span>' : '<span class="badge badge-inactive">Nonaktif</span>'}</td>
        <td>${s.sort_order}</td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="editService(${s.id})">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="deleteService(${s.id})">🗑</button>
        </td>
      </tr>`).join('');
  } catch (e) { toast(e.message, 'error'); }
}

let serviceData = [];
function openServiceModal(id = null) {
  editingId = id;
  document.getElementById('modalSvcTitle').textContent = id ? 'Edit Layanan' : 'Tambah Layanan';
  ['svName', 'svSlug', 'svShort', 'svDesc', 'svInfo'].forEach(f => setVal(f, ''));
  setVal('svIcon', '🛠'); setVal('svOrder', 0); setChecked('svActive', true);
  setVal('svColorFrom', '#5C2E0E'); setVal('svColorTo', '#C49A6C');
  if (id && serviceData.length) {
    const s = serviceData.find(s => s.id === id);
    if (s) {
      setVal('svName', s.name); setVal('svSlug', s.slug); setVal('svShort', s.short_desc || '');
      setVal('svDesc', s.description || ''); setVal('svInfo', s.info || ''); setVal('svIcon', s.icon || '🛠');
      setVal('svOrder', s.sort_order || 0); setChecked('svActive', !!s.is_active);
      setVal('svColorFrom', s.color_from || '#5C2E0E'); setVal('svColorTo', s.color_to || '#C49A6C');
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
    if (editingId) await api('PUT', `/services/${editingId}`, fd, true);
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
  try { await api('DELETE', `/services/${id}`); toast('Layanan dihapus'); loadServices(); }
  catch (e) { toast(e.message, 'error'); }
}

// ══════════════════════════════════════════════════════════════
// TESTIMONIALS
// ══════════════════════════════════════════════════════════════
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

// ══════════════════════════════════════════════════════════════
// CONTACTS
// ══════════════════════════════════════════════════════════════
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

// ══════════════════════════════════════════════════════════════
// SETTINGS
// ══════════════════════════════════════════════════════════════
async function loadSettings() {
  try {
    const data = await api('GET', '/settings');
    const settings = data.data || [];
    const groups = {};
    settings.forEach(s => { if (!groups[s.group_name]) groups[s.group_name] = []; groups[s.group_name].push(s); });
    const groupLabels = { general: '🌐 Umum', hero: '🏠 Hero Section', about: 'ℹ️ Tentang Kami', contact: '📞 Kontak', stats: '📊 Statistik', social: '📱 Media Sosial', footer: '📄 Footer' };
    const tabs = document.getElementById('settingsTabs');
    const panels = document.getElementById('settingsPanels');
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
              <button class="btn btn-sm btn-primary" onclick="uploadSettingImage('${s.key}')">📤 Upload</button>
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

// ══════════════════════════════════════════════════════════════
// WAREHOUSE DASHBOARD
// ══════════════════════════════════════════════════════════════
async function loadWarehouseDashboard() {
  try {
    const data = await api('GET', '/warehouse/dashboard');
    const s = data.data.stats;
    document.getElementById('whStats').innerHTML = buildStatCards([
      { icon: '📦', label: 'Total Produk', val: s.total_products, cls: 'brown' },
      { icon: '⚠️', label: 'Stok Kritis (≤3)', val: s.low_stock, cls: 'red' },
      { icon: '❌', label: 'Habis', val: s.out_of_stock, cls: 'red' },
      { icon: '🏢', label: 'Supplier', val: s.total_suppliers, cls: 'green' },
      { icon: '👥', label: 'Customer', val: s.total_customers, cls: 'blue' },
      { icon: '🛒', label: 'Order Proses', val: s.pending_orders, cls: 'orange' },
      { icon: '📥', label: 'Masuk Hari Ini', val: s.stock_in_today, cls: 'teal' },
      { icon: '📤', label: 'Keluar Hari Ini', val: s.stock_out_today, cls: 'purple' },
    ]);

    // Inventory value KPI
    if (s.inventory_value != null) {
      const kpi = document.getElementById('whInventoryKPI');
      if (kpi) {
        kpi.style.display = 'block';
        kpi.innerHTML = `
          <div class="card" style="background: linear-gradient(135deg, var(--primary-dark), var(--primary)); color: var(--white); padding: 1.5rem 2rem; display: flex; align-items: center; gap: 2rem; border: none; overflow: hidden; position: relative;">
            <div style="position: absolute; right: -20px; top: -20px; font-size: 8rem; opacity: 0.1; transform: rotate(-15deg);">💰</div>
            <div class="stat-icon" style="background: rgba(255,255,255,0.15); font-size: 2rem; width: 64px; height: 64px; border-radius: var(--radius-md);">💰</div>
            <div>
              <div style="font-size: .75rem; letter-spacing: .15em; text-transform: uppercase; opacity: 0.8; margin-bottom: .4rem; font-weight: 500;">Total Nilai Inventaris (Modal)</div>
              <div style="font-family: var(--font-heading); font-size: 2.4rem; font-weight: 700; letter-spacing: .02em; line-height: 1;">${fmtRp(s.inventory_value)}</div>
            </div>
          </div>`;
      }
    }

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
              label: '📤 Keluar', data: flowData.map(d => d.stock_out || 0),
              backgroundColor: 'rgba(220,53,69,.7)', borderRadius: 4, borderSkipped: false,
            }
          ]
        },
        options: {
          responsive: true,
          plugins: { legend: { position: 'top', labels: { font: { size: 11 } } } },
          scales: {
            x: { ticks: { font: { size: 11 } } },
            y: { ticks: { stepSize: 1 }, grid: { color: '#f0ebe3' } }
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
        <td><span class="badge badge-${t.type}">${t.type === 'in' ? '📥 Masuk' : t.type === 'out' ? '📤 Keluar' : '🔧 Adj'}</span></td>
        <td style="font-weight:600;color:${t.type === 'in' ? 'var(--success)' : 'var(--danger)'}">${t.type === 'in' ? '+' : '-'}${t.qty}</td>
        <td style="font-size:.78rem">${fmtDate(t.created_at)}</td>
      </tr>`).join('');
  } catch (e) { toast(e.message, 'error'); }
}

// ══════════════════════════════════════════════════════════════
// STOCK MANAGEMENT
// ══════════════════════════════════════════════════════════════
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

async function loadStockSummary(page = 1) {
  try {
    const q = getVal('stockSearch');
    const data = await api('GET', `/stock/summary?page=${page}&search=${q}`);
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
  try {
    const q = getVal('stockSearch');
    const data = await api('GET', `/stock/summary?limit=1000&search=${q}`);
    const items = data.data || [];
    const totalVal = data.total_stock_value || 0;
    const c = data.company || {};

    const html = `
      <html>
      <head>
        <title>Stock Report - ${new Date().toLocaleDateString()}</title>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Outfit', sans-serif; color: #2C1A0E; padding: 40px; line-height: 1.4; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
          .co-info h1 { font-size: 28px; margin: 0; color: #5C2E0E; font-weight: 700; }
          .co-info p { margin: 3px 0; font-size: 13px; color: #6B5040; }
          .report-meta { text-align: right; }
          .report-meta h2 { font-size: 32px; margin: 0; color: #5C2E0E; letter-spacing: 2px; font-weight: 600; }
          .report-meta p { margin: 5px 0; font-size: 14px; font-weight: 600; color: #5C2E0E; }
          .report-date { font-size: 13px; color: #6B5040; }
          
          table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
          th { background: #F5F0EB; text-align: left; padding: 12px 10px; border-bottom: 2px solid #5C2E0E; text-transform: uppercase; font-weight: 700; color: #5C2E0E; }
          td { padding: 10px; border-bottom: 1px solid #F0EBE3; }
          tr:nth-child(even) { background: #FAFAFA; }
          
          .summary { margin-top: 40px; display: flex; justify-content: flex-end; }
          .summary-card { background: #F5F0EB; padding: 20px 30px; border-radius: 8px; border-left: 5px solid #5C2E0E; }
          .summary-lbl { font-size: 14px; color: #6B5040; margin-bottom: 5px; display: block; }
          .summary-val { font-size: 22px; font-weight: 700; color: #5C2E0E; }
          
          .footer { margin-top: 50px; border-top: 1px solid #E0D8CE; padding-top: 20px; font-size: 11px; color: #999; display: flex; justify-content: space-between; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="co-info">
            <h1>${c.site_name || 'JOGJA FURNITURE'}</h1>
            <p>FURNITURE & INTERIOR SOLUTIONS</p>
            <p style="margin-top: 10px">📍 ${c.address || '—'}</p>
            <p>📞 ${c.phone || '—'}</p>
            <p>📧 ${c.email || '—'}</p>
          </div>
          <div class="report-meta">
            <h2>REPORT</h2>
            <p>STOCK SUMMARY</p>
            <div class="report-date">Tanggal: ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
            <div style="margin-top: 15px"><span style="background:#E8F5E9; color:#2E7D32; padding:5px 12px; border-radius:20px; font-size:11px; font-weight:700; text-transform:uppercase">Inventory Live</span></div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Produk</th>
              <th>Kategori</th>
              <th style="text-align:center">Stok</th>
              <th>Satuan</th>
              <th>Harga Modal</th>
              <th>Harga Jual</th>
              <th>Nilai Stok</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(p => `
              <tr>
                <td style="color:#888">${p.sku || '—'}</td>
                <td><strong>${p.name}</strong></td>
                <td>${p.category_name || '—'}</td>
                <td style="font-weight:700; text-align:center; color:${p.warehouse_stock <= 5 ? '#D32F2F' : '#2C1A0E'}">${p.warehouse_stock}</td>
                <td>${p.unit || 'unit'}</td>
                <td>${fmtRp(p.cost_price)}</td>
                <td>${fmtRp(p.sell_price)}</td>
                <td style="font-weight:600; color:#5C2E0E">${fmtRp(p.stock_value)}</td>
              </tr>`).join('')}
          </tbody>
        </table>

        <div class="summary">
          <div class="summary-card">
            <span class="summary-lbl">Total Nilai Inventori (Berdasarkan Harga Modal)</span>
            <span class="summary-val">${fmtRp(totalVal)}</span>
          </div>
        </div>

        <div class="footer">
          <div>Dicetak oleh: ${me.full_name} (${me.role})</div>
          <div>Halaman 1 dari 1</div>
        </div>

        <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 500); };</script>
      </body>
      </html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
  } catch (e) { toast(e.message, 'error'); }
}

let txPage = 1;
async function loadTransactions(page = 1) {
  txPage = page;
  const type = getVal('txType'), from = getVal('txFrom'), to = getVal('txTo');
  try {
    const data = await api('GET', `/stock/transactions?page=${page}&limit=30&type=${type}&date_from=${from}&date_to=${to}`);
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
// ══════════════════════════════════════════════════════════════
// SUPPLIERS
// ══════════════════════════════════════════════════════════════
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

// ══════════════════════════════════════════════════════════════
// CUSTOMERS
// ══════════════════════════════════════════════════════════════
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
          <button class="btn btn-sm btn-outline" onclick="editCustomer(${c.id})">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="deleteCustomer(${c.id})">🗑</button>
        </td>
      </tr>`).join('');
    buildPagination('cusPagination', data.pagination, 'loadCustomers');
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

// ══════════════════════════════════════════════════════════════
// ORDERS
// ══════════════════════════════════════════════════════════════
let ordPage = 1, orderItems = [], ordData = [];

async function loadOrderStats() {
  try {
    const data = await api('GET', '/orders/stats');
    const s = data.data;
    document.getElementById('orderStats').innerHTML = buildStatCards([
      { icon: '🛒', label: 'Total Order', val: s.total, cls: 'brown' },
      { icon: '⏳', label: 'Pending', val: s.pending, cls: 'orange' },
      { icon: '🔄', label: 'Proses', val: s.processing, cls: 'blue' },
      { icon: '✅', label: 'Delivered', val: s.delivered, cls: 'green' },
      { icon: '🆕', label: 'Order Hari Ini', val: s.today_count, cls: 'teal' },
      { icon: '🗓️', label: 'Order Bulan Ini', val: s.month_confirmed_count, cls: 'brown' },
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
            <button class="btn btn-sm btn-outline" onclick="viewInvoice(${o.id})" title="Invoice">🧾</button>
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
      <button class="btn btn-sm btn-danger" onclick="removeOrderItem(${idx})">✕</button>
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

async function viewInvoice(id) {
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

    const html = `
      <html>
      <head>
        <title>Invoice ${order.order_number}</title>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Outfit', sans-serif; color: #2C1A0E; padding: 40px; line-height: 1.4; }
          .inv-header { display: flex; justify-content: space-between; margin-bottom: 40px; border-bottom: 2px solid #5C2E0E; padding-bottom: 20px; }
          .co-info h1 { font-size: 24px; margin: 0; color: #5C2E0E; font-weight: 700; }
          .co-info p { margin: 3px 0; font-size: 12px; color: #6B5040; }
          
          .inv-meta { text-align: right; }
          .inv-meta h2 { font-size: 32px; margin: 0; color: #5C2E0E; font-weight: 600; letter-spacing: 2px; }
          .inv-meta p { margin: 5px 0; font-size: 14px; font-weight: 700; color: #5C2E0E; }
          
          .client-info { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 30px; }
          .info-box h4 { margin: 0 0 8px 0; font-size: 11px; text-transform: uppercase; color: #888; letter-spacing: 1px; }
          .info-box p { margin: 0; font-size: 13px; font-weight: 500; }
          
          table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
          th { background: #F5F0EB; text-align: left; padding: 12px 10px; border-bottom: 2px solid #5C2E0E; text-transform: uppercase; color: #5C2E0E; font-weight: 700; }
          td { padding: 12px 10px; border-bottom: 1px solid #F0EBE3; vertical-align: top; }
          
          .totals { margin-top: 20px; display: flex; justify-content: flex-end; }
          .tot-table { width: 250px; }
          .tot-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
          .tot-row.grand { border-top: 2px solid #5C2E0E; margin-top: 8px; padding-top: 10px; font-weight: 800; font-size: 16px; color: #5C2E0E; }
          
          .footer { margin-top: 60px; font-size: 11px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 20px; }
          .status-badge { display: inline-block; padding: 4px 10px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; margin-top: 5px; }
          .status-paid { background: #E8F5E9; color: #2E7D32; }
          .status-unpaid { background: #FFEBEE; color: #C62828; }

          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="inv-header">
          <div class="co-info">
            <h1>${company.site_name || 'JOGJA FURNITURE'}</h1>
            <p>FURNITURE & INTERIOR SOLUTIONS</p>
            <p style="margin-top: 10px">📍 ${company.address || '—'}</p>
            <p>📞 ${company.phone || '—'}</p>
          </div>
          <div class="inv-meta">
            <h2>INVOICE</h2>
            <p>${order.order_number}</p>
            <div style="font-size: 12px; color: #6B5040;">Tanggal: ${fmtDateOnly(order.created_at)}</div>
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
              <th style="text-align:center;width:80px">Qty</th>
              <th style="text-align:right;width:120px">Harga</th>
              <th style="text-align:right;width:120px">Subtotal</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <div class="totals">
          <div class="tot-table">
            <div class="tot-row"><span>Subtotal</span><span>${fmtRp(order.subtotal)}</span></div>
            ${order.discount > 0 ? `<div class="tot-row" style="color:#2E7D32"><span>Diskon</span><span>- ${fmtRp(order.discount)}</span></div>` : ''}
            ${order.shipping_cost > 0 ? `<div class="tot-row"><span>Ongkos Kirim</span><span>${fmtRp(order.shipping_cost)}</span></div>` : ''}
            <div class="tot-row grand"><span>TOTAL</span><span>${fmtRp(order.total)}</span></div>
          </div>
        </div>

        <div style="margin-top: 40px; font-size: 12px;">
          <p><strong>Catatan:</strong> ${order.notes || '—'}</p>
        </div>

        <div class="footer">
          <p>Terima kasih atas pesanan Anda!</p>
          <p>Invoice ini sah dan diproses oleh sistem komputer.</p>
        </div>

        <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 500); };</script>
      </body>
      </html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
  } catch (e) { toast(e.message, 'error'); }
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

function exportInvoicePDF() { window.print(); }

// ══════════════════════════════════════════════════════════════
// USERS (Superadmin)
// ══════════════════════════════════════════════════════════════
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

function openUserModal(id = null) {
  editingId = id;
  document.getElementById('modalUserTitle').textContent = id ? 'Edit User' : 'Tambah User Baru';
  ['uUsername', 'uEmail', 'uName', 'uPhone', 'uPassword'].forEach(f => setVal(f, ''));
  setVal('uRole', 'admin_website'); setChecked('uActive', true);
  const passGroup = document.getElementById('uPassGroup');
  if (passGroup) passGroup.style.display = id ? 'none' : '';
  if (id) {
    const u = usrData.find(u => u.id === id);
    if (u) {
      setVal('uUsername', u.username); setVal('uEmail', u.email); setVal('uName', u.full_name || '');
      setVal('uPhone', u.phone || ''); setVal('uRole', u.role); setChecked('uActive', !!u.is_active);
    }
  }
  openModal('modalUser');
}

async function saveUser() {
  const username = getVal('uUsername'), email = getVal('uEmail');
  if (!email) { toast('Email wajib diisi', 'warning'); return; }
  if (!editingId && !getVal('uPassword')) { toast('Password wajib diisi untuk user baru', 'warning'); return; }
  const payload = { email, full_name: getVal('uName'), phone: getVal('uPhone'), role: getVal('uRole'), is_active: getChecked('uActive') ? 1 : 0 };
  if (!editingId) { payload.username = username; payload.password = getVal('uPassword'); }
  try {
    if (editingId) await api('PUT', `/users/${editingId}`, payload);
    else await api('POST', '/users', payload);
    toast('User berhasil disimpan'); closeModal('modalUser'); loadUsers();
  } catch (e) { toast(e.message, 'error'); }
}

function editUser(id) { openUserModal(id); }

async function resetUserPassword(id) {
  const newPass = prompt('Masukkan password baru (minimal 6 karakter):');
  if (!newPass || newPass.length < 6) { if (newPass !== null) toast('Password minimal 6 karakter', 'warning'); return; }
  try {
    await api('POST', `/users/${id}/reset-password`, { new_password: newPass });
    toast('Password berhasil direset. User akan diminta login ulang.');
  } catch (e) { toast(e.message, 'error'); }
}

async function toggleUser(id) {
  try {
    const r = await api('POST', `/users/${id}/toggle-active`);
    toast(r.message); loadUsers();
  } catch (e) { toast(e.message, 'error'); }
}

async function forceLogoutUser(id) {
  if (!confirm('Force logout semua sesi user ini?')) return;
  try { await api('POST', `/users/${id}/force-logout`); toast('Sesi user berhasil diterminasi'); }
  catch (e) { toast(e.message, 'error'); }
}

// ══════════════════════════════════════════════════════════════
// ACTIVITY LOGS
// ══════════════════════════════════════════════════════════════
let logPage = 1;
async function loadActivityLogs(page = 1) {
  logPage = page;
  const module = getVal('logModule');
  try {
    const data = await api('GET', `/activity-logs?page=${page}&limit=50&module=${module}`);
    document.getElementById('logBody').innerHTML = (data.data || []).map(l => `
      <tr>
        <td style="font-size:.75rem;white-space:nowrap">${fmtDate(l.created_at)}</td>
        <td style="font-size:.82rem"><strong>${l.username || 'system'}</strong></td>
        <td><span class="badge badge-${l.role}">${roleLabel(l.role) || l.role || '—'}</span></td>
        <td><code style="font-size:.72rem;background:var(--gray100);padding:.1rem .4rem;border-radius:4px">${l.action}</code></td>
        <td style="font-size:.8rem">${l.module || '—'}</td>
        <td style="font-size:.8rem;max-width:280px">${l.description || '—'}</td>
        <td style="font-size:.72rem;color:var(--text-light)">${l.ip_address || '—'}</td>
      </tr>`).join('') || '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-light)">Tidak ada log</td></tr>';
    buildPagination('logPagination', data.pagination, 'loadActivityLogs');
  } catch (e) { toast(e.message, 'error'); }
}

// ══════════════════════════════════════════════════════════════
// CONTROL CENTER
// ══════════════════════════════════════════════════════════════
async function loadControlCenter() {
  try {
    const data = await api('GET', '/control-center/stats');
    const s = data.data.stats;
    document.getElementById('ccStats').innerHTML = buildStatCards([
      { icon: '🆕', label: 'Order Hari Ini', val: s.today_orders, cls: 'teal' },
      { icon: '🗓️', label: 'Order Bulan Ini', val: s.month_confirmed, cls: 'brown' },
      { icon: '⏳', label: 'Order Pending', val: s.pending_orders, cls: 'orange' },
      { icon: '📊', label: 'Total Order', val: s.total_orders, cls: 'blue' },
      { icon: '📦', label: 'Total Produk', val: s.total_products, cls: 'green' },
      { icon: '⚠️', label: 'Stok Kritis', val: s.low_stock, cls: 'red' },
      { icon: '👥', label: 'Customer', val: s.total_customers, cls: 'blue' },
      { icon: '👤', label: 'User Aktif', val: s.total_users, cls: 'brown' },
    ]);

    // Inventory Value KPI for Owner
    if (s.inventory_value != null) {
      const kpi = document.getElementById('ccInventoryKPI');
      if (kpi) {
        kpi.style.display = 'block';
        kpi.innerHTML = `
          <div class="card" style="background: linear-gradient(135deg, var(--primary-dark), var(--primary)); color: var(--white); padding: 1.5rem 2rem; display: flex; align-items: center; gap: 2rem; border: none; overflow: hidden; position: relative;">
            <div style="position: absolute; right: -20px; top: -20px; font-size: 8rem; opacity: 0.1; transform: rotate(-15deg);">💰</div>
            <div class="stat-icon" style="background: rgba(255,255,255,0.15); font-size: 2rem; width: 64px; height: 64px; border-radius: var(--radius-md);">🏛️</div>
            <div>
              <div style="font-size: .75rem; letter-spacing: .15em; text-transform: uppercase; opacity: 0.8; margin-bottom: .4rem; font-weight: 500;">Total Aset Inventaris (Modal)</div>
              <div style="font-family: var(--font-heading); font-size: 2.4rem; font-weight: 700; letter-spacing: .02em; line-height: 1;">${fmtRp(s.inventory_value)}</div>
            </div>
          </div>`;
      }
    }

    document.getElementById('ccLogsBody').innerHTML = (data.data.recent_logs || []).map(l => `
      <tr>
        <td style="font-size:.75rem">${fmtDate(l.created_at)}</td>
        <td style="font-size:.82rem">${l.username || '—'}</td>
        <td><code style="font-size:.7rem;background:var(--gray100);padding:.1rem .35rem;border-radius:3px">${l.action}</code></td>
        <td style="font-size:.78rem">${l.module || '—'}</td>
      </tr>`).join('');

    // Order line chart (30 days) - Replacing Revenue
    const orderData = data.data.orders_30days || [];
    const ordCanvas = document.getElementById('chartRevenue');
    if (ordCanvas) {
      if (ordCanvas._chartInstance) ordCanvas._chartInstance.destroy();
      ordCanvas._chartInstance = new Chart(ordCanvas, {
        type: 'line',
        data: {
          labels: orderData.map(d => d.date),
          datasets: [{
            label: 'Jumlah Order',
            data: orderData.map(d => d.count || 0),
            borderColor: '#C49A6C',
            backgroundColor: 'rgba(196,154,108,.15)',
            borderWidth: 2.5,
            pointBackgroundColor: '#5C2E0E',
            pointRadius: 3,
            fill: true,
            tension: 0.4,
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => ctx.raw + ' Order'
              }
            }
          },
          scales: {
            x: { ticks: { font: { size: 10 }, maxRotation: 45, maxTicksLimit: 10 } },
            y: {
              ticks: {
                font: { size: 10 },
                stepSize: 1,
                beginAtZero: true
              },
              grid: { color: '#f0ebe3' }
            }
          }
        }
      });
    }

    // Role donut chart
    const roleColors = {
      superadmin: '#5C2E0E', admin_gudang: '#C49A6C',
      admin_website: '#28a745', marketing: '#17a2b8'
    };
    const roleData = data.data.users_by_role || [];
    const donutCanvas = document.getElementById('chartRoleDonut');
    if (donutCanvas && roleData.length) {
      if (donutCanvas._chartInstance) donutCanvas._chartInstance.destroy();
      donutCanvas._chartInstance = new Chart(donutCanvas, {
        type: 'doughnut',
        data: {
          labels: roleData.map(r => roleLabel(r.role)),
          datasets: [{
            data: roleData.map(r => r.count),
            backgroundColor: roleData.map(r => roleColors[r.role] || '#aaa'),
            borderWidth: 2, borderColor: '#fff',
          }]
        },
        options: {
          responsive: false,
          plugins: { legend: { display: false } },
          cutout: '65%',
        }
      });
    }

    const roleChart = document.getElementById('ccRoleChart');
    roleChart.innerHTML = roleData.map(r => `
      <div style="display:flex;align-items:center;gap:.75rem;padding:.55rem 0;border-bottom:1px solid var(--gray100)">
        <span class="badge badge-${r.role}" style="min-width:110px;justify-content:center">${roleLabel(r.role)}</span>
        <div style="flex:1;background:var(--gray200);border-radius:99px;height:7px;overflow:hidden">
          <div style="height:100%;background:${roleColors[r.role] || 'var(--accent)'};border-radius:99px;width:${Math.min((r.count / s.total_users) * 100, 100)}%;transition:.6s"></div>
        </div>
        <span style="font-weight:700;color:var(--primary);font-size:.9rem">${r.count}</span>
      </div>`).join('');
  } catch (e) { toast(e.message, 'error'); }
}

// ══════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ══════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ══════════════════════════════════════════════════════════════
async function updateNotifCount() {
  try {
    const data = await api('GET', '/notifications');
    const notifBadge = document.getElementById('notifBadge');
    if (notifBadge) {
      if (data.unread > 0) { notifBadge.textContent = data.unread; notifBadge.style.display = 'block'; }
      else notifBadge.style.display = 'none';
    }
    return data;
  } catch (e) { return { unread: 0, data: [] }; }
}

function renderNotifItem(n, typeIcon) {
  return `
    <div class="notif-item ${!n.is_read ? 'unread' : ''}" 
         style="padding:1rem 1.25rem; cursor:pointer" 
         onclick="toggleNotif(${n.id}, this, event)">
      <div style="display:flex;gap:1rem">
        <span style="font-size:1.2rem">${typeIcon[n.type] || '🔔'}</span>
        <div style="flex:1">
          <div class="notif-title" style="font-size:.88rem;font-weight:${!n.is_read ? '600' : '400'}">${n.title}</div>
          <div style="font-size:.72rem;color:var(--text-light);margin-top:.3rem">${fmtDate(n.created_at)}</div>
        </div>
        ${!n.is_read ? '<div class="notif-dot" style="width:8px;height:8px;background:var(--danger);border-radius:50%;margin-top:.3rem;flex-shrink:0"></div>' : ''}
      </div>
      <div class="notif-msg" style="display:none;font-size:.82rem;color:var(--text);margin-top:.75rem;padding:.75rem;background:rgba(255,255,255,.5);border-radius:var(--radius-sm)">
        ${n.message || 'Tidak ada detail pesan.'}
      </div>
    </div>`;
}

async function loadNotifications() {
  try {
    const data = await updateNotifCount();
    const list = document.getElementById('notifList');
    const listDropdown = document.getElementById('notifListDropdown');
    const typeIcon = { info: 'ℹ️', warning: '⚠️', success: '✅', error: '❌' };

    const html = (data.data || []).map(n => renderNotifItem(n, typeIcon)).join('')
      || '<div style="text-align:center;padding:2rem;color:var(--text-light)">Tidak ada notifikasi</div>';

    if (list) list.innerHTML = html;
    if (listDropdown) listDropdown.innerHTML = html;
  } catch (e) { }
}

function toggleNotifDropdown(e) {
  e.stopPropagation();
  const dd = document.getElementById('notifDropdown');
  if (!dd) return;
  const isShow = dd.classList.contains('show');

  // Close others if any (like user profile menu if exists)

  if (!isShow) {
    dd.classList.add('show');
    loadNotifications();
  } else {
    dd.classList.remove('show');
  }
}

function closeNotifDropdown() {
  document.getElementById('notifDropdown')?.classList.remove('show');
}

async function toggleNotif(id, el, e) {
  if (e) e.stopPropagation();
  const msg = el.querySelector('.notif-msg');
  const isOpen = msg.style.display === 'block';

  // Close all other messages in the same container
  const container = el.parentElement;
  container.querySelectorAll('.notif-msg').forEach(m => m.style.display = 'none');

  if (!isOpen) {
    msg.style.display = 'block';

    // Mark as read if it was unread
    const dot = el.querySelector('.notif-dot');
    if (dot) {
      try {
        await api('PUT', `/notifications/${id}/read`);
        el.classList.remove('unread');
        dot.remove();
        const title = el.querySelector('.notif-title');
        if (title) title.style.fontWeight = '400';
        updateNotifCount();
      } catch (e) { }
    }
  }
}

async function markAllRead() {
  if (!confirm('Tandai semua notifikasi sebagai dibaca?')) return;
  try {
    // Check if there is an endpoint for read-all, if not we'd have to loop
    // For now, let's try to call a logical endpoint or just toast a placeholder if not supported
    await api('PUT', '/notifications/read-all');
    toast('Semua notifikasi ditandai dibaca');
    loadNotifications();
  } catch (e) {
    // Fallback if endpoint doesn't exist
    toast('Fitur ini sedang dalam pemeliharaan', 'info');
  }
}

// Global click listener to close dropdowns and notification messages
document.addEventListener('click', (e) => {
  // Close notification dropdown if clicked outside
  const dd = document.getElementById('notifDropdown');
  const icon = document.getElementById('notifIcon');
  if (dd && dd.classList.contains('show') && !dd.contains(e.target) && !icon.contains(e.target)) {
    dd.classList.remove('show');
  }

  // Close notification messages if clicked outside a notif-item
  if (!e.target.closest('.notif-item')) {
    document.querySelectorAll('.notif-msg').forEach(m => m.style.display = 'none');
  }
});

// ══════════════════════════════════════════════════════════════
// PROFILE
// ══════════════════════════════════════════════════════════════
async function loadProfile() {
  try {
    const data = await api('GET', '/profile');
    const u = data.data;
    const el = document.getElementById('profileInfo');
    if (el) el.innerHTML = `
      <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem">
        <div style="width:60px;height:60px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-family:var(--font-heading);font-size:1.6rem;color:var(--white);font-weight:700">${(u.full_name || u.username || 'A')[0].toUpperCase()}</div>
        <div>
          <div style="font-family:var(--font-heading);font-size:1.3rem;color:var(--primary)">${u.full_name || '—'}</div>
          <span class="badge badge-${u.role}">${roleLabel(u.role)}</span>
        </div>
      </div>
      <div class="form-grid">
        <div class="form-group"><label>Username</label><input type="text" value="${u.username || ''}" readonly></div>
        <div class="form-group"><label>Email</label><input type="text" value="${u.email || ''}" readonly></div>
        <div class="form-group"><label>Telepon</label><input type="text" value="${u.phone || '—'}" readonly></div>
        <div class="form-group"><label>Last Login</label><input type="text" value="${u.last_login ? fmtDate(u.last_login) : 'Belum'}" readonly></div>
        <div class="form-group full"><label>Bergabung</label><input type="text" value="${fmtDateOnly(u.created_at)}" readonly></div>
      </div>`;
  } catch (e) { toast(e.message, 'error'); }
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

// ══════════════════════════════════════════════════════════════
// CSS ANIMATION
// ══════════════════════════════════════════════════════════════
const style = document.createElement('style');
style.textContent = `@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}`;
document.head.appendChild(style);


// Stock Transactions Export
async function exportTransactionPDF() {
  try {
    const type = getVal('txType'), from = getVal('txFrom'), to = getVal('txTo');
    const data = await api('GET', `/stock/transactions?limit=1000&type=${type}&date_from=${from}&date_to=${to}`);
    const items = data.data || [];
    const c = data.company || {};

    const html = `
      <html>
      <head>
        <title>Transaction Report - ${new Date().toLocaleDateString()}</title>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Outfit', sans-serif; color: #2C1A0E; padding: 40px; line-height: 1.4; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
          .co-info h1 { font-size: 28px; margin: 0; color: #5C2E0E; font-weight: 700; }
          .co-info p { margin: 3px 0; font-size: 13px; color: #6B5040; }
          .report-meta { text-align: right; }
          .report-meta h2 { font-size: 32px; margin: 0; color: #5C2E0E; letter-spacing: 2px; font-weight: 600; }
          .report-meta p { margin: 5px 0; font-size: 14px; font-weight: 600; color: #5C2E0E; }
          .report-date { font-size: 13px; color: #6B5040; }
          
          table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 11px; }
          th { background: #F5F0EB; text-align: left; padding: 12px 10px; border-bottom: 2px solid #5C2E0E; text-transform: uppercase; font-weight: 700; color: #5C2E0E; }
          td { padding: 10px; border-bottom: 1px solid #F0EBE3; }
          tr:nth-child(even) { background: #FAFAFA; }
          
          .badge { padding: 3px 8px; border-radius: 4px; font-size: 9px; font-weight: 700; text-transform: uppercase; }
          .badge-in { background: #E8F5E9; color: #2E7D32; }
          .badge-out { background: #FFEBEE; color: #C62828; }
          .badge-adjustment { background: #E3F2FD; color: #1565C0; }
          
          .footer { margin-top: 50px; border-top: 1px solid #E0D8CE; padding-top: 20px; font-size: 11px; color: #999; display: flex; justify-content: space-between; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="co-info">
            <h1>${c.site_name || 'JOGJA FURNITURE'}</h1>
            <p>FURNITURE & INTERIOR SOLUTIONS</p>
            <p style="margin-top: 10px">📍 ${c.address || '—'}</p>
            <p>📞 ${c.phone || '—'}</p>
            <p>📧 ${c.email || '—'}</p>
          </div>
          <div class="report-meta">
            <h2>REPORT</h2>
            <p>STOCK TRANSACTIONS</p>
            <div class="report-date">Tanggal: ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
            <div style="margin-top: 10px; font-size:11px; color:#888">Periode: ${from || 'Awal'} s/d ${to || 'Sekarang'}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Produk</th>
              <th>SKU</th>
              <th>Tipe</th>
              <th style="text-align:center">Qty</th>
              <th style="text-align:center">Sebelum</th>
              <th style="text-align:center">Sesudah</th>
              <th>Ref. No.</th>
              <th>Oleh</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(t => `
              <tr>
                <td>${fmtDate(t.created_at)}</td>
                <td><strong>${t.product_name}</strong></td>
                <td>${t.sku || '—'}</td>
                <td><span class="badge badge-${t.type}">${t.type.toUpperCase()}</span></td>
                <td style="font-weight:700; text-align:center; color:${t.type === 'in' ? '#2E7D32' : '#C62828'}">${t.type === 'in' ? '+' : '-'}${t.qty}</td>
                <td style="text-align:center; color:#888">${t.qty_before}</td>
                <td style="text-align:center; font-weight:600">${t.qty_after}</td>
                <td>${t.reference_no || '—'}</td>
                <td>${t.created_by_name}</td>
              </tr>`).join('')}
          </tbody>
        </table>

        <div class="footer">
          <div>Dicetak oleh: ${me.full_name} (${me.role})</div>
          <div>Halaman 1 dari 1</div>
        </div>

        <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 500); };</script>
      </body>
      </html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
  } catch (e) { toast(e.message, 'error'); }
}
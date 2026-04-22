// frontend/js/main.js
// Loads all content dynamically from the backend API

// ── STATE ─────────────────────────────────────────────────────
const state = {
  settings: {},
  categories: [],
  products: [],
  services: [],
  testimonials: [],
  catPage: 0,
  catPerPage: 6,
  currentFilter: 'all',
  prodPage: 1,
  prodTotal: 0,
  prodLimit: 6,
  favorites: JSON.parse(localStorage.getItem('jf_favorites') || '[]'),
  recentlyViewed: JSON.parse(localStorage.getItem('jf_recently_viewed') || '[]'),
};

// ── INIT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // ── TAMBAHKAN BLOK KODE PRELOADER INI ──
  window.addEventListener('load', () => {
    const preloader = document.getElementById('preloader');
    if(preloader) {
      setTimeout(() => {
        preloader.classList.add('fade-out');
      }, 2000); // 👈 Tahan selama 2 detik agar elegan dan perlahan
    }
  });
  // ──────────────────────────────────────

  await loadSettings();
  initNavbar();
  initHeroCanvas();
  initMobileNav();
  loadMarquee();
  await Promise.all([
    loadAbout(),
    loadServices(),
    loadCatalogSection(),
    loadStats(),
    loadTestimonials(),
    loadContactInfo(),
    loadFooter(),
  ]);
  initScrollReveal();
  initScrollBehaviors();
  initParallax();
  initBackTop();
  initWaFloat();
  initContactForm();
  initModal();
  initLazyLoad();
  
});

// ── SETTINGS ─────────────────────────────────────────────────
async function loadSettings() {
  const res = await apiFetch('/settings');
  if (res.success) state.settings = res.data;
  // ── KODE BARU: UPDATE FAVICON (IKON TAB BROWSER) OTOMATIS ──
    if (state.settings.site_logo) {
      let link = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      // Memasang url gambar logo ke tab browser
      link.href = `${window.UPLOADS_BASE}/settings/${state.settings.site_logo}`;
    }
    // ──────────────────────────────────────────────────────────
}

function s(key, fallback = '') {
  return state.settings[key] !== undefined ? state.settings[key] : fallback;
}

// ── NAVBAR ────────────────────────────────────────────────────
function initNavbar() {
  const logoName = document.getElementById('logoName');
  const logoTag  = document.getElementById('logoTag');
  if (logoName) logoName.textContent = s('site_name', 'JOGJA');
  if (logoTag)  logoTag.textContent  = s('site_tagline', 'Furniture Decoration');

  // Scrolled state
  window.addEventListener('scroll', () => {
    document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 80);
  }, { passive: true });
}

// ── MOBILE NAV ────────────────────────────────────────────────
function initMobileNav() {
  const hamburger = document.getElementById('hamburger');
  const drawer    = document.getElementById('mobileDrawer');
  if (!hamburger || !drawer) return;
  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    drawer.classList.toggle('open');
  });
  drawer.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      hamburger.classList.remove('open');
      drawer.classList.remove('open');
    });
  });
}

// ── HERO CANVAS ───────────────────────────────────────────────
function initHeroCanvas() {
  const canvas = document.getElementById('heroCanvas');
  if (!canvas) return;

  // Cek apakah ada gambar background dari settings
  const heroBgImage = s('hero_bg_image');
  const heroSection = document.querySelector('.hero');

  if (heroBgImage) {
    // Tampilkan gambar sebagai background, sembunyikan canvas
    canvas.style.display = 'none';
    if (heroSection) {
      heroSection.style.backgroundImage = `url('${window.UPLOADS_BASE}/settings/${heroBgImage}')`;
      heroSection.style.backgroundSize  = 'cover';
      heroSection.style.backgroundPosition = 'center';
    }
  } else {
    // Jalankan animasi partikel canvas seperti sebelumnya
    canvas.style.display = '';
    runParticleCanvas(canvas);
  }

  // Hero content dari settings
  const heroLabel       = document.getElementById('heroLabel');
  const heroTitle1      = document.getElementById('heroTitle1');
  const heroTitleAccent = document.getElementById('heroTitleAccent');
  const heroDesc        = document.getElementById('heroDesc');
  const heroBtnPrimary  = document.getElementById('heroBtnPrimary');
  const heroBtnSecondary= document.getElementById('heroBtnSecondary');

  if (heroLabel)        heroLabel.textContent       = s('hero_label',         'Jogja Furniture Decoration');
  if (heroTitle1)       heroTitle1.innerHTML        = s('hero_title_1',       'Wujudkan Ruang');
  if (heroTitleAccent)  heroTitleAccent.textContent = s('hero_title_accent',  'Impian Anda');
  if (heroDesc)         heroDesc.textContent        = s('hero_desc',          'Furnitur berkualitas tinggi dan dekorasi interior yang mencerminkan keanggunan dan keunikan khas Yogyakarta.');
  if (heroBtnPrimary)   heroBtnPrimary.textContent  = s('hero_btn_primary',   'Lihat Catalog') + ' →';
  if (heroBtnSecondary) heroBtnSecondary.textContent = '💬 ' + s('hero_btn_secondary', 'Konsultasi Gratis');

  // Stats
  const s1 = document.getElementById('s1');
  const s2 = document.getElementById('s2');
  const s3 = document.getElementById('s3');
  if (s1) s1.dataset.target = s('stat_projects',     '500');
  if (s2) s2.dataset.target = s('stat_years',        '12');
  if (s3) s3.dataset.target = s('stat_satisfaction', '98');
}

function runParticleCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  let W, H, particles = [];

  function resize() { W = canvas.width = canvas.offsetWidth; H = canvas.height = canvas.offsetHeight; }

  class Particle {
    reset() {
      this.x  = Math.random() * W;
      this.y  = Math.random() * H;
      this.r  = Math.random() * 2 + .5;
      this.vx = (Math.random() - .5) * .35;
      this.vy = (Math.random() - .5) * .35;
      this.a  = Math.random() * .4 + .1;
    }
    constructor() { this.reset(); }
    update() { this.x += this.vx; this.y += this.vy; if (this.x < 0 || this.x > W || this.y < 0 || this.y > H) this.reset(); }
    draw()   { ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2); ctx.fillStyle = `rgba(196,154,108,${this.a})`; ctx.fill(); }
  }

  let hueShift = 0;
  function loop() {
    hueShift += .003;
    const grd = ctx.createLinearGradient(W * (.3 + .2 * Math.sin(hueShift)), 0, W * (.7 + .2 * Math.cos(hueShift)), H);
    grd.addColorStop(0, '#3D1E08'); grd.addColorStop(.35, '#5C2E0E');
    grd.addColorStop(.65, '#8B4513'); grd.addColorStop(1, '#3D1E08');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
    particles.forEach(p => { p.update(); p.draw(); });
    ctx.strokeStyle = 'rgba(196,154,108,.06)'; ctx.lineWidth = .8;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 100) {
          ctx.globalAlpha = (1 - d / 100) * .4;
          ctx.beginPath(); ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y); ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(loop);
  }

  window.addEventListener('resize', () => { resize(); particles = [...Array(80)].map(() => new Particle()); });
  resize(); particles = [...Array(80)].map(() => new Particle()); loop();
}

// ── MARQUEE ───────────────────────────────────────────────────
function loadMarquee() {
  const el = document.getElementById('marqueeTrack');
  if (!el) return;
  const raw = s('marquee_items', 'Furniture Custom|Interior Design|Dekorasi Ruangan|Renovasi Interior|Living Room|Bedroom|Kitchen Set|Home Office');
  const items = [...raw.split('|'), ...raw.split('|')]; // double for seamless loop
  el.innerHTML = items.map(i => `<span class="marquee-item"><span class="marquee-dot"></span>${i}</span>`).join('');
}

// ── ABOUT ─────────────────────────────────────────────────────
async function loadAbout() {
  const title   = document.getElementById('aboutTitle');
  const desc    = document.getElementById('aboutDesc');
  const years   = document.getElementById('aboutYears');
  const imgMainEl = document.getElementById('aboutImgMain');
  const imgSecEl  = document.getElementById('aboutImgSec');

  if (title) title.innerHTML = s('about_title', 'Keahlian & Dedikasi<br><em>Dalam Setiap Karya</em>');
  if (desc)  desc.textContent = s('about_desc', '');
  if (years) years.textContent = s('about_years', '12') + '+';

  const mainImgFile = s('about_image_main');
  const secImgFile  = s('about_image_sec');

  if (imgMainEl) {
    if (mainImgFile) {
      imgMainEl.innerHTML = `<img
        src="${window.UPLOADS_BASE}/settings/${mainImgFile}"
        alt="Tentang Jogja Furniture"
        style="width:100%;height:100%;object-fit:cover;"
        onerror="this.parentElement.innerHTML='<div class=\\'img-placeholder\\' style=\\'background:linear-gradient(135deg,#E8D5B7,#C49A6C)\\'>🛋</div>'">`;
    } else {
      imgMainEl.innerHTML = `<div class="img-placeholder" style="background:linear-gradient(135deg,#E8D5B7,#C49A6C)">🛋</div>`;
    }
  }

  if (imgSecEl) {
    if (secImgFile) {
      imgSecEl.innerHTML = `<img
        src="${window.UPLOADS_BASE}/settings/${secImgFile}"
        alt="Pengrajin Jogja Furniture"
        style="width:100%;height:100%;object-fit:cover;"
        onerror="this.parentElement.innerHTML='<div class=\\'img-placeholder\\' style=\\'background:linear-gradient(135deg,#8B4513,#5C2E0E)\\'>🪵</div>'">`;
    } else {
      imgSecEl.innerHTML = `<div class="img-placeholder" style="background:linear-gradient(135deg,#8B4513,#5C2E0E)">🪵</div>`;
    }
  }
}

// ── SERVICES ─────────────────────────────────────────────────
async function loadServices() {
  const grid = document.getElementById('servicesGrid');
  if (!grid) return;

  const res = await apiFetch('/services');
  if (!res.success || !res.data.length) {
    grid.innerHTML = '<p style="color:var(--text-light)">Layanan belum tersedia.</p>';
    return;
  }
  state.services = res.data;

  grid.innerHTML = res.data.map((svc, i) => `
    <div class="svc-card" data-reveal data-reveal-delay="${i}">
      <div class="svc-img" style="${gradientStyle(svc.color_from, svc.color_to)}"
           onclick="window.location='service.html?slug=${svc.slug}'" style="cursor:pointer">
        ${svc.image
          ? `<img data-src="${imgUrl(svc.image, 'services')}" alt="${svc.name}" class="lazy">`
          : `<span style="font-size:3.5rem">${svc.icon || '🛠'}</span>`}
        <div class=\"prod-overlay\"><span class=\"prod-view-btn\">Lihat Pelayanan</span></div>
      </div>
      <div class="svc-body">
        <div class="svc-icon">${svc.icon || '🛠'}</div>
        <h3 class="svc-title">${svc.name}</h3>
        <p class="svc-desc">${svc.short_desc || ''}</p>
        <a href="service.html?slug=${svc.slug}" class="svc-cat">Selengkapnya →</a>
      </div>
    </div>
  `).join('');
}

// ── CATALOG SECTION (homepage) ────────────────────────────────
async function loadCatalogSection() {
  await Promise.all([loadCategories(), loadProducts()]);
}

async function loadCategories() {
  const res = await apiFetch('/categories');
  if (res.success) state.categories = res.data;
  renderCategoryFilter();
  renderFilterPills();
}

function renderCategoryFilter() {
  const inner = document.getElementById('catCardsInner');
  const prevBtn = document.getElementById('catPrev');
  const nextBtn = document.getElementById('catNext');
  if (!inner) return;

  const cats = [{ name:'Semua', slug:'all', icon:'🏠', color_from:'', color_to:'' }, ...state.categories];

  function render() {
    const start = state.catPage * state.catPerPage;
    const visible = cats.slice(start, start + state.catPerPage);
    inner.innerHTML = visible.map(cat => `
      <div class="cat-card ${cat.slug === state.currentFilter ? 'active' : ''}"
           onclick="filterByCategory('${cat.slug}', this)">
        <div class="cat-img" style="${cat.slug === 'all' ? 'background:var(--gray100)' : gradientStyle(cat.color_from, cat.color_to)}">
          ${cat.image
            ? `<img data-src="${imgUrl(cat.image, 'categories')}" alt="${cat.name}" class="lazy">`
            : `<span>${cat.icon || '📦'}</span>`}
        </div>
        <div class="cat-label">${cat.name}</div>
      </div>
    `).join('');
    if (prevBtn) prevBtn.disabled = state.catPage === 0;
    if (nextBtn) nextBtn.disabled = start + state.catPerPage >= cats.length;
    initLazyLoad();
  }

  if (prevBtn) prevBtn.addEventListener('click', () => { state.catPage--; render(); });
  if (nextBtn) nextBtn.addEventListener('click', () => { state.catPage++; render(); });
  render();
}

function renderFilterPills() {
  const container = document.getElementById('filterPills');
  if (!container) return;
  const cats = [{ name:'Semua', slug:'all' }, ...state.categories];
  container.innerHTML = cats.map(cat => `
    <button class="pill ${cat.slug === state.currentFilter ? 'active' : ''}"
            onclick="filterByCategory('${cat.slug}', this)">
      ${cat.name}
    </button>
  `).join('');
}

window.filterByCategory = function(slug, el) {
  state.currentFilter = slug;
  state.prodPage = 1;
  // Sync pills
  document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.cat-card').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
  loadProducts();
};

async function loadProducts() {
  const grid = document.getElementById('catalogGrid');
  if (!grid) return;

  // Skeleton
  grid.innerHTML = Array(6).fill(`
    <div class="skel-card">
      <div class="skeleton skel-img"></div>
      <div class="skel-body">
        <div class="skeleton skel-line short"></div>
        <div class="skeleton skel-line med"></div>
        <div class="skeleton skel-line"></div>
      </div>
    </div>
  `).join('');

  const params = new URLSearchParams({
    page: state.prodPage,
    limit: state.prodLimit,
    ...(state.currentFilter !== 'all' && { category: state.currentFilter }),
  });

  const res = await apiFetch(`/products?${params}`);
  if (!res.success) { grid.innerHTML = '<p>Gagal memuat produk.</p>'; return; }

  state.products = res.data;
  state.prodTotal = res.pagination?.total || 0;

  if (!res.data.length) {
    grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--text-light);padding:3rem">Tidak ada produk ditemukan.</p>';
  } else {
    grid.innerHTML = res.data.map((p, i) => renderProductCard(p, i)).join('');
    initLazyLoad();
    initCardTilt();
  }

  renderPagination();
  updateCatalogCount();
}

function renderProductCard(p, i = 0) {
  const isFav = state.favorites.includes(p.id);
  const thumb = p.thumbnail ? `<img data-src="${imgUrl(p.thumbnail)}" alt="${p.name} - Koleksi Jogja Furniture" class="lazy">` : `<span>${p.category_icon || '🛋'}</span>`;

  return `
    <div class="prod-card"  data-reveal-delay="${i % 3}"
         onclick="window.location='product.html?slug=${p.slug}'">
      <div class="prod-img" style="${p.thumbnail ? '' : gradientStyle(p.color_from, p.color_to)}">
        ${thumb}
        <div class=\"prod-overlay\"><span class=\"prod-view-btn\">Lihat Detail</span></div>
      </div>
      <button class=\"prod-fav ${isFav ? 'active' : ''}" onclick="toggleFav(event, ${p.id})" title="Favorit">
        ${isFav ? '❤️' : '🤍'}
      </button>
      <div class="prod-body">
        <span class="prod-cat">${p.category_icon || ''} ${p.category_name || ''}</span>
        <h3 class="prod-name">${p.name}</h3>
        <p class="prod-desc">${p.short_desc || ''}</p>
      </div>
      <div class="prod-footer">
        <span class="prod-link">Lihat Detail →</span>
        <span class="prod-price">${p.price_label || ''}</span>
        ${p.is_featured ? '<span class="prod-badge">Unggulan</span>' : ''}
      </div>
    </div>
  `;
}

function renderPagination() {
  const el = document.getElementById('catalogPagination');
  if (!el) return;
  const totalPages = Math.ceil(state.prodTotal / state.prodLimit);
  if (totalPages <= 1) { el.innerHTML = ''; return; }

  let html = `<button class="page-btn" onclick="goPage(${state.prodPage - 1})" ${state.prodPage === 1 ? 'disabled' : ''}>‹</button>`;
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="page-btn ${i === state.prodPage ? 'active' : ''}" onclick="goPage(${i})">${i}</button>`;
  }
  html += `<button class="page-btn" onclick="goPage(${state.prodPage + 1})" ${state.prodPage === totalPages ? 'disabled' : ''}>›</button>`;
  el.innerHTML = html;
}

window.goPage = function(page) {
  const totalPages = Math.ceil(state.prodTotal / state.prodLimit);
  if (page < 1 || page > totalPages) return;
  state.prodPage = page;
  loadProducts();
  document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

function updateCatalogCount() {
  const el = document.getElementById('catalogCount');
  if (el) el.textContent = state.prodTotal ? `Menampilkan ${state.products.length} dari ${state.prodTotal} produk` : '';
}

// ── STATS ─────────────────────────────────────────────────────
async function loadStats() {
  const fields = [
    ['statProjects', 'stat_projects', '500', '+'],
    ['statYears',    'stat_years',    '12',  '+'],
    ['statSatis',    'stat_satisfaction', '98', '%'],
    ['statCraft',    'stat_craftsmen', '50', '+'],
  ];
  fields.forEach(([id, key, def]) => {
    const el = document.getElementById(id);
    if (el) el.dataset.target = s(key, def);
  });
}

function animateCounter(el) {
  const target = parseInt(el.dataset.target) || 0;
  const suffix = el.dataset.suffix || '';
  let cur = 0;
  const step = Math.max(1, Math.floor(target / 60));
  const t = setInterval(() => {
    cur = Math.min(cur + step, target);
    el.textContent = cur + suffix;
    if (cur >= target) clearInterval(t);
  }, 28);
}

// ── TESTIMONIALS ──────────────────────────────────────────────
async function loadTestimonials() {
  const track = document.getElementById('testiTrack');
  const dotsEl = document.getElementById('tDots');
  if (!track) return;

  const res = await apiFetch('/testimonials');
  if (!res.success || !res.data.length) return;
  state.testimonials = res.data;

  track.innerHTML = res.data.map(t => `
    <div class="testi-slide">
      <div class="testi-card">
        <p class="testi-text">${t.content}</p>
        <div class="testi-author">
          <div class="testi-avatar">
            ${t.avatar
              ? `<img data-src="${imgUrl(t.avatar, 'testimonials')}" alt="${t.name}" class="lazy">`
              : t.initial || t.name[0]}
          </div>
          <div>
            <div class="testi-name">${t.name}</div>
            <div class="testi-role">${t.role || ''}</div>
            <div class="testi-stars">${'★'.repeat(t.rating || 5)}${'☆'.repeat(5 - (t.rating || 5))}</div>
          </div>
        </div>
      </div>
    </div>
  `).join('');

  // Dots
  let cur = 0;
  const slides = track.querySelectorAll('.testi-slide');
  if (dotsEl) {
    dotsEl.innerHTML = [...slides].map((_, i) =>
      `<div class="dot${i === 0 ? ' active' : ''}" onclick="testiGoTo(${i})"></div>`
    ).join('');
  }

  window.testiGoTo = function(idx) {
    cur = (idx + slides.length) % slides.length;
    track.style.transform = `translateX(-${cur * 100}%)`;
    dotsEl?.querySelectorAll('.dot').forEach((d, i) => d.classList.toggle('active', i === cur));
  };

  const autoplay = setInterval(() => window.testiGoTo(cur + 1), 4500);

  document.getElementById('tPrev')?.addEventListener('click', () => { clearInterval(autoplay); window.testiGoTo(cur - 1); });
  document.getElementById('tNext')?.addEventListener('click', () => { clearInterval(autoplay); window.testiGoTo(cur + 1); });

  initLazyLoad();
}

// ── CONTACT INFO ─────────────────────────────────────────────
async function loadContactInfo() {
  const fields = {
    contactPhone:   'phone',
    contactEmail:   'email',
    contactAddress: 'address',
    contactHours:   'jam_operasional',
  };
  Object.entries(fields).forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (!el) return;
    const val = s(key);
    if (key === 'jam_operasional') {
      el.innerHTML = val.split('|').join('<br>');
    } else {
      el.textContent = val;
    }
  });

  // WA button
  const waBtn = document.getElementById('heroWaBtn');
  if (waBtn) {
    waBtn.href = `https://wa.me/${s('whatsapp_number', '6281234567890')}`;
    waBtn.target = '_blank';
  }
}

// ── FOOTER ────────────────────────────────────────────────────
async function loadFooter() {
  const footerName = document.getElementById('footerName');
  const footerTag  = document.getElementById('footerTag');
  const footerDesc = document.getElementById('footerDesc');
  const copyright  = document.getElementById('copyright');

  if (footerName) footerName.textContent = s('site_name', 'Jogja Furniture Decoration');
  if (footerTag)  footerTag.textContent  = s('site_tagline', 'Furniture Decoration');
  if (footerDesc) footerDesc.textContent = s('footer_desc', '');
  if (copyright)  copyright.textContent  = `© ${new Date().getFullYear()} ${s('site_name', 'Jogja Furniture Decoration')}. Semua hak dilindungi.`;

  // Social links
  const socials = { igLink:'instagram_url', fbLink:'facebook_url', ytLink:'youtube_url' };
  Object.entries(socials).forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el && s(key)) { el.href = s(key); el.style.display = 'flex'; }
    else if (el) el.style.display = 'none';
  });
}

// ── PRODUCT DETAIL MODAL ─────────────────────────────────────
function initModal() {
  const modal = document.getElementById('detailModal');
  if (!modal) return;
  modal.addEventListener('click', e => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });
}

window.openProductDetail = async function(slug) {
  const modal = document.getElementById('detailModal');
  if (!modal) return;

  // Show loading
  document.getElementById('modalTitle').textContent = 'Memuat...';
  document.getElementById('modalBody').innerHTML = '<div style="text-align:center;padding:3rem"><div class="skeleton" style="height:200px;border-radius:12px;margin-bottom:1rem"></div><div class="skeleton skel-line med" style="margin-bottom:.5rem"></div><div class="skeleton skel-line short"></div></div>';
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';

  const res = await apiFetch(`/products/${slug}`);
  if (!res.success) {
    document.getElementById('modalBody').innerHTML = '<p style="color:red;padding:2rem">Gagal memuat produk.</p>';
    return;
  }

  const p = res.data;
  document.getElementById('modalTitle').textContent = p.name;

  // Save to recently viewed
  saveRecentlyViewed({ id: p.id, name: p.name, slug: p.slug, thumbnail: p.thumbnail });

  // Gallery
  const images = p.images || [];
  let galleryHtml = '';
  if (images.length > 0) {
    galleryHtml = `
      <div class="modal-gallery">
        <div class="gallery-main" id="galleryMain">
          <img src="${imgUrl(images[0].filename)}" alt="${p.name} - Koleksi Jogja Furniture">
        </div>
        ${images.length > 1 ? `
          <div class="gallery-thumbs">
            ${images.map((img, i) => `
              <div class="gallery-thumb ${i === 0 ? 'active' : ''}" onclick="switchGallery(this, '${imgUrl(img.filename)}')">
                <img src="${imgUrl(img.filename)}" alt="${p.name} - Koleksi Jogja Furniture">
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  } else {
    galleryHtml = `
      <div class="modal-gallery">
        <div class="gallery-main" style="${gradientStyle(p.color_from, p.color_to)}">
          <span style="font-size:5rem">${p.category_icon || '🛋'}</span>
        </div>
      </div>
    `;
  }

  const waMsg = encodeURIComponent(`${s('whatsapp_message', 'Halo, saya tertarik dengan')} ${p.name} — ${window.location.origin}/product/${p.slug}`);
  const waNumber = s('whatsapp_number', '6281234567890');

  document.getElementById('modalBody').innerHTML = `
    ${galleryHtml}
    <div class="detail-grid">
      <div class="detail-item">
        <label>Kategori</label>
        <p>${p.category_name || '—'}</p>
      </div>
      <div class="detail-item">
        <label>Harga</label>
        <p>${p.price_label || 'Hubungi Kami'}</p>
      </div>
      ${p.material ? `<div class="detail-item"><label>Material</label><p>${p.material}</p></div>` : ''}
      ${p.dimensions ? `<div class="detail-item"><label>Ukuran</label><p>${p.dimensions}</p></div>` : ''}
      ${p.description ? `<div class="detail-item full"><label>Deskripsi</label><p style="white-space:pre-line">${p.description}</p></div>` : ''}
      ${p.specification ? `<div class="detail-item full"><label>Spesifikasi</label><div class="modal-spec">${p.specification}</div></div>` : ''}
      ${p.tags && p.tags.length ? `<div class="detail-item full"><label>Tags</label><p>${p.tags.map(t => `<span style="background:var(--gray100);padding:.2rem .6rem;border-radius:99px;font-size:.75rem;margin-right:.3rem">${t}</span>`).join('')}</p></div>` : ''}
    </div>
    <div class="modal-actions">
      <a href="https://wa.me/${waNumber}?text=${waMsg}" target="_blank" class="btn btn-primary">💬 Tanya via WhatsApp</a>
      <button class="btn btn-outline-dark" onclick="shareProduct('${p.name}', '${p.slug}')">🔗 Bagikan</button>
      <button class="btn btn-outline-dark" onclick="closeModal()">← Tutup</button>
    </div>
  `;
};

window.switchGallery = function(thumb, src) {
  document.querySelectorAll('.gallery-thumb').forEach(t => t.classList.remove('active'));
  thumb.classList.add('active');
  const main = document.getElementById('galleryMain');
  if (main) main.innerHTML = `<img src="${src}" alt="product">`;
};

window.closeModal = function() {
  document.getElementById('detailModal')?.classList.remove('open');
  document.body.style.overflow = '';
};

window.openServiceDetail = async function(slug) {
  const modal = document.getElementById('detailModal');
  if (!modal) return;

  document.getElementById('modalTitle').textContent = 'Memuat...';
  document.getElementById('modalBody').innerHTML = '<div style="padding:3rem;text-align:center">Memuat layanan...</div>';
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';

  const res = await apiFetch(`/services/${slug}`);
  if (!res.success) { document.getElementById('modalBody').innerHTML = '<p>Gagal memuat layanan.</p>'; return; }

  const svc = res.data;
  document.getElementById('modalTitle').textContent = svc.name;

  const waNumber = s('whatsapp_number', '6281234567890');
  const waMsg = encodeURIComponent(`Halo, saya tertarik dengan layanan ${svc.name}`);
  const infoLines = svc.info ? svc.info.split('|') : [];

  document.getElementById('modalBody').innerHTML = `
    <div class="modal-gallery">
      <div class="gallery-main" style="${gradientStyle(svc.color_from, svc.color_to)}">
        ${svc.image
          ? `<img src="${imgUrl(svc.image, 'services')}" alt="${svc.name}" style="width:100%;height:100%;object-fit:cover">`
          : `<span style="font-size:5rem">${svc.icon || '🛠'}</span>`}
        <div class=\"prod-overlay\"><span class=\"prod-view-btn\">Lihat Pelayanan</span></div>
      </div>
    </div>
    <div class="detail-grid">
      ${svc.description ? `<div class="detail-item full"><label>Deskripsi</label><p style="white-space:pre-line">${svc.description}</p></div>` : ''}
      ${infoLines.length ? `<div class="detail-item full"><label>Info Layanan</label><div class="modal-spec">${infoLines.join('\n')}</div></div>` : ''}
    </div>
    <div class="modal-actions">
      <a href="https://wa.me/${waNumber}?text=${waMsg}" target="_blank" class="btn btn-primary">💬 Konsultasi Sekarang</a>
      <button class="btn btn-outline-dark" onclick="closeModal()">← Tutup</button>
    </div>
  `;
};

// ── SHARE ─────────────────────────────────────────────────────
window.shareProduct = function(name, slug) {
  const url = `${window.location.origin}?product=${slug}`;
  if (navigator.share) {
    navigator.share({ title: name, url });
  } else {
    navigator.clipboard.writeText(url).then(() => showToast('Link disalin ke clipboard!'));
  }
};

// ── FAVORITES ─────────────────────────────────────────────────
window.toggleFav = function(e, id) {
  e.stopPropagation();
  const idx = state.favorites.indexOf(id);
  if (idx === -1) { state.favorites.push(id); showToast('❤️ Ditambahkan ke favorit'); }
  else { state.favorites.splice(idx, 1); showToast('Dihapus dari favorit'); }
  localStorage.setItem('jf_favorites', JSON.stringify(state.favorites));
  // Update button
  const btn = e.currentTarget;
  btn.classList.toggle('active', state.favorites.includes(id));
  btn.textContent = state.favorites.includes(id) ? '❤️' : '🤍';
};

// ── RECENTLY VIEWED ───────────────────────────────────────────
function saveRecentlyViewed(product) {
  let rv = state.recentlyViewed.filter(p => p.id !== product.id);
  rv.unshift(product);
  rv = rv.slice(0, 10);
  state.recentlyViewed = rv;
  localStorage.setItem('jf_recently_viewed', JSON.stringify(rv));
}

// ── CONTACT FORM ─────────────────────────────────────────────
function initContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type=submit]');
    const msgEl = document.getElementById('formMsg');
    btn.disabled = true;
    btn.textContent = 'Mengirim...';

    const body = {
      name:    form.querySelector('[name=name]')?.value,
      email:   form.querySelector('[name=email]')?.value,
      phone:   form.querySelector('[name=phone]')?.value,
      subject: form.querySelector('[name=subject]')?.value,
      message: form.querySelector('[name=message]')?.value,
    };

    const res = await apiFetch('/contact', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (msgEl) {
      msgEl.className = `form-msg ${res.success ? 'success' : 'error'}`;
      msgEl.textContent = res.message;
    }

    if (res.success) form.reset();
    btn.disabled = false;
    btn.textContent = 'Kirim Pesan';
  });
}

// ── SCROLL BEHAVIORS ─────────────────────────────────────────
function initScrollBehaviors() {
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const t = document.querySelector(a.getAttribute('href'));
    if (!t) return;
    e.preventDefault();
    window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
  });
}

// ── SCROLL REVEAL ─────────────────────────────────────────────
function initScrollReveal() {
  const revObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        // Counter animation
        const counter = e.target.querySelector('[data-target]') || (e.target.dataset.target ? e.target : null);
        if (counter && counter.dataset.target) animateCounter(counter);
        revObs.unobserve(e.target);
      }
    });
  }, { threshold: .12, rootMargin: '0px 0px -60px 0px' });
  document.querySelectorAll('[data-reveal]').forEach(el => revObs.observe(el));

  // Counters (hero + stats section)
  const cntObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { animateCounter(e.target); cntObs.unobserve(e.target); }
    });
  }, { threshold: .5 });
  document.querySelectorAll('[data-target]').forEach(el => cntObs.observe(el));
}

// ── BACK TO TOP ───────────────────────────────────────────────
function initBackTop() {
  const btn = document.getElementById('backTop');
  if (!btn) return;
  window.addEventListener('scroll', () => btn.classList.toggle('visible', window.scrollY > 500), { passive: true });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

// ── WA FLOAT ─────────────────────────────────────────────────
function initWaFloat() {
  // Ambil kedua elemen (icon melayang dan tombol teks)
  const waIcon = document.getElementById('waFloat');
  const waBtnText = document.getElementById('waFloat2');
  
  // Ambil nomor WA dari setting database
  const num = s('whatsapp_number', '6281234567890');
  const url = `https://wa.me/${num}`;

  // Atur fungsi klik untuk Icon Melayang
  if (waIcon) {
    waIcon.onclick = (e) => {
      e.preventDefault();
      window.open(url, '_blank');
    };
  }

  // Atur fungsi klik untuk Tombol Teks "Chat WhatsApp Sekarang"
  if (waBtnText) {
    waBtnText.onclick = (e) => {
      e.preventDefault();
      window.open(url, '_blank');
    };
    // Opsional: set href-nya juga agar saat di-hover terlihat link-nya
    waBtnText.href = url;
  }
}

// ── CARD TILT ─────────────────────────────────────────────────
function initCardTilt() {
  document.querySelectorAll('.prod-card, .svc-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5;
      const y = (e.clientY - r.top) / r.height - .5;
      card.style.transform = `translateY(-5px) perspective(800px) rotateY(${x*5}deg) rotateX(${-y*5}deg)`;
    });
    card.addEventListener('mouseleave', () => card.style.transform = '');
  });
}

// ── LAZY LOAD ─────────────────────────────────────────────────
function initLazyLoad() {
  const lazyImgs = document.querySelectorAll('img[data-src]:not(.loaded)');
  if ('IntersectionObserver' in window) {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const img = e.target;
          img.src = img.dataset.src;
          img.onload  = () => img.classList.add('loaded');
          img.onerror = () => img.style.display = 'none';
          obs.unobserve(img);
        }
      });
    }, { rootMargin: '100px' });
    lazyImgs.forEach(img => obs.observe(img));
  } else {
    lazyImgs.forEach(img => { img.src = img.dataset.src; img.classList.add('loaded'); });
  }
}

// ── TOAST ─────────────────────────────────────────────────────
window.showToast = function(msg, duration = 2800) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
};

// Check URL params for direct product open
window.addEventListener('load', () => {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('product');
  if (slug) {
    setTimeout(() => window.openProductDetail(slug), 800);
  }
});

// ── PARALLAX MOUSE EFFECT ─────────────────────────────────────
function initParallax() {
  document.addEventListener('mousemove', (e) => {
    const moveX = (e.clientX - window.innerWidth / 2) * -0.015;
    const moveY = (e.clientY - window.innerHeight / 2) * -0.015;
    
    document.querySelectorAll('.parallax').forEach(el => {
      const speed = el.getAttribute('data-speed') || 1;
      el.style.transform = `translate(${moveX * speed}px, ${moveY * speed}px)`;
    });
  });
}

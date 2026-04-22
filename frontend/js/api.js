// frontend/js/api.js
// Centralized API helper

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5000/api'
  : '/api'; // Same origin di production

const UPLOADS_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5000/uploads'
  : '/uploads';

window.API_BASE      = API_BASE;
window.UPLOADS_BASE  = UPLOADS_BASE;

async function apiFetch(endpoint, options = {}) {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('API Error:', err);
    return { success: false, message: 'Koneksi ke server gagal' };
  }
}

// Image URL helper
function imgUrl(filename, folder = 'products') {
  if (!filename) return null;
  if (filename.startsWith('http')) return filename;
  return `${UPLOADS_BASE}/${folder}/${filename}`;
}

// Placeholder gradient style from category
function gradientStyle(colorFrom, colorTo) {
  return `background: linear-gradient(135deg, ${colorFrom || '#5C2E0E'}, ${colorTo || '#C49A6C'})`;
}

window.apiFetch      = apiFetch;
window.imgUrl        = imgUrl;
window.gradientStyle = gradientStyle;

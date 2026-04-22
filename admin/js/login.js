/**
 * login.js - Handle admin login form submission
 */

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const loginErr = document.getElementById('loginErr');
  
  if (!loginForm) return; // Only run on login page
  
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = loginForm.username.value.trim();
    const password = loginForm.password.value;
    
    if (!username || !password) {
      showError('Username dan password wajib diisi');
      return;
    }
    
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password })
      });
      
      const data = await res.json();
      
      if (!data.success) {
        showError(data.message || 'Login gagal');
        return;
      }
      
      // Save token and user data
      localStorage.setItem('jf_token', data.token);
      localStorage.setItem('jf_user', JSON.stringify(data.admin));
      
      // Redirect to admin panel
      window.location.href = 'panel.html';
      
    } catch (err) {
      showError('Terjadi kesalahan. Silakan coba lagi.');
      console.error('Login error:', err);
    }
  });
  
  function showError(message) {
    loginErr.textContent = message;
    loginErr.style.display = 'block';
    setTimeout(() => {
      loginErr.style.display = 'none';
    }, 5000);
  }
});

function togglePass() {
  const inp = document.getElementById('passInput');
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

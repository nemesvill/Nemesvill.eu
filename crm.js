(() => {
  // A CRM API új Workerének egyedi domainje.
 const API = 'https://crm-api.nemesvillany.workers.dev';
  const loginView = document.getElementById('loginView');
  const dashboardView = document.getElementById('dashboardView');
  const loginForm = document.getElementById('loginForm');
  const loginButton = document.getElementById('loginButton');
  const loginMessage = document.getElementById('loginMessage');
  const dashboardMessage = document.getElementById('dashboardMessage');

  async function api(path, options = {}) {
    const response = await fetch(API + path, {
      ...options,
      credentials: 'include',
      headers: { ...(options.headers || {}), ...(options.body ? { 'Content-Type': 'application/json' } : {}) }
    });
    let data = {};
    try { data = await response.json(); } catch (_) {}
    return { response, data };
  }

  function showDashboard() {
    loginView.hidden = true;
    dashboardView.hidden = false;
    document.getElementById('authStatus').textContent = 'Bejelentkezve';
    checkDatabase();
  }

  async function checkSession() {
    try {
      const { response, data } = await api('/api/admin/check');
      if (response.ok && data.authenticated) showDashboard();
    } catch (_) {
      loginMessage.textContent = 'A CRM szerver jelenleg nem érhető el.';
    }
  }

  async function checkDatabase() {
    const status = document.getElementById('dbStatus');
    const detail = document.getElementById('dbDetail');
    status.textContent = 'Ellenőrzés…';
    try {
      const { response, data } = await api('/api/db-check');
      if (response.ok && data.success && data.test) {
        status.textContent = 'Kapcsolódva';
        detail.textContent = 'A D1 adatbázis válaszol.';
      } else {
        status.textContent = 'Nem ellenőrizhető';
        detail.textContent = data.error || data.message || 'Adatbázis-kapcsolati hiba.';
      }
    } catch (_) {
      status.textContent = 'Nem elérhető';
      detail.textContent = 'Nem sikerült elérni a CRM API-t.';
    }
  }

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    loginMessage.textContent = '';
    loginButton.disabled = true;
    loginButton.textContent = 'Beléptetés…';
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    try {
      const { response, data } = await api('/api/login', {
        method: 'POST', body: JSON.stringify({ email, password })
      });
      if (!response.ok || !data.success) {
        loginMessage.textContent = response.status === 401 ? 'Hibás e-mail-cím vagy jelszó.' : (data.error || 'A bejelentkezés nem sikerült.');
        return;
      }
      loginForm.reset();
      showDashboard();
    } catch (_) {
      loginMessage.textContent = 'Nem sikerült kapcsolódni a CRM szerverhez.';
    } finally {
      loginButton.disabled = false;
      loginButton.textContent = 'Belépés';
    }
  });

  document.getElementById('logoutButton').addEventListener('click', async () => {
    try { await api('/api/logout', { method: 'POST' }); } catch (_) {}
    dashboardView.hidden = true;
    loginView.hidden = false;
    dashboardMessage.textContent = '';
    loginMessage.textContent = 'Sikeresen kijelentkeztél.';
  });

  checkSession();
})();

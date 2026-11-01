
(() => {
  const API = 'https://crm-api.nemesvill.eu';

  const loginView = document.getElementById('loginView');
  const dashboardView = document.getElementById('dashboardView');
  const loginForm = document.getElementById('loginForm');
  const loginButton = document.getElementById('loginButton');
  const loginMessage = document.getElementById('loginMessage');
  const dashboardMessage = document.getElementById('dashboardMessage');

  const customerFormPanel = document.getElementById('customerFormPanel');
  const customerForm = document.getElementById('customerForm');
  const customerList = document.getElementById('customerList');
  const customerSearch = document.getElementById('customerSearch');
  const customerListMessage = document.getElementById('customerListMessage');
  const customerFormMessage = document.getElementById('customerFormMessage');

  let customers = [];

  async function api(path, options = {}) {
    const response = await fetch(API + path, {
      ...options,
      credentials: 'include',
      headers: {
        ...(options.headers || {}),
        ...(options.body ? { 'Content-Type': 'application/json' } : {})
      }
    });

    let data = {};
    try {
      data = await response.json();
    } catch (_) {}

    return { response, data };
  }

  function showDashboard() {
    loginView.hidden = true;
    dashboardView.hidden = false;
    document.getElementById('authStatus').textContent = 'Bejelentkezve';
    checkDatabase();
    loadCustomers();
  }

  async function checkSession() {
    try {
      const { response, data } = await api('/api/admin/check');
      if (response.ok && data.authenticated) {
        showDashboard();
      }
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
        detail.textContent = data.error || 'Adatbázis-kapcsolati hiba.';
      }
    } catch (_) {
      status.textContent = 'Nem elérhető';
      detail.textContent = 'Nem sikerült elérni a CRM API-t.';
    }
  }

  function openCustomerForm(customer = null) {
    customerForm.reset();
    customerFormMessage.textContent = '';

    document.getElementById('customerId').value = customer?.id || '';
    document.getElementById('customerType').value = customer?.customer_type || 'private';
    document.getElementById('customerName').value = customer?.name || '';
    document.getElementById('companyName').value = customer?.company_name || '';
    document.getElementById('taxNumber').value = customer?.tax_number || '';
    document.getElementById('customerEmail').value = customer?.email || '';
    document.getElementById('customerPhone').value = customer?.phone || '';
    document.getElementById('postalCode').value = customer?.postal_code || '';
    document.getElementById('customerCity').value = customer?.city || '';
    document.getElementById('streetAddress').value = customer?.street_address || '';
    document.getElementById('customerNotes').value = customer?.notes || '';

    document.getElementById('customerFormTitle').textContent =
      customer ? 'Ügyfél adatainak módosítása' : 'Új ügyfél rögzítése';

    document.getElementById('saveCustomerButton').textContent =
      customer ? 'Módosítás mentése' : 'Ügyfél mentése';

    customerFormPanel.hidden = false;
    customerFormPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function closeCustomerForm() {
    customerFormPanel.hidden = true;
    customerForm.reset();
    customerFormMessage.textContent = '';
  }

  function addText(parent, tag, value, className = '') {
    const element = document.createElement(tag);
    element.textContent = value || '';
    if (className) element.className = className;
    parent.appendChild(element);
    return element;
  }

  function renderCustomers(items) {
    customerList.replaceChildren();

    if (!items.length) {
      addText(customerList, 'p', 'Még nincs rögzített ügyfél.', 'muted');
      return;
    }

    items.forEach(customer => {
      const card = document.createElement('article');
      card.className = 'status-card customer-card';

      addText(card, 'strong', customer.name || 'Névtelen ügyfél');
      if (customer.company_name) {
        addText(card, 'p', customer.company_name);
      }
      if (customer.phone) addText(card, 'p', 'Telefon: ' + customer.phone);
      if (customer.email) addText(card, 'p', 'E-mail: ' + customer.email);

      const address = [
        customer.postal_code,
        customer.city,
        customer.street_address
      ].filter(Boolean).join(' ');

      if (address) addText(card, 'p', 'Cím: ' + address);
      if (customer.notes) addText(card, 'p', 'Megjegyzés: ' + customer.notes);

      const actions = document.createElement('div');
      actions.className = 'customer-actions';

      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.textContent = 'Szerkesztés';
      editButton.addEventListener('click', () => openCustomerForm(customer));

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.textContent = 'Törlés';
      deleteButton.className = 'secondary';
      deleteButton.addEventListener('click', () => deleteCustomer(customer));

      actions.append(editButton, deleteButton);
      card.appendChild(actions);
      customerList.appendChild(card);
    });
  }

  async function loadCustomers() {
    customerListMessage.textContent = 'Ügyfelek betöltése…';

    try {
      const query = customerSearch.value.trim();
      const { response, data } = await api(
        '/api/customers?q=' + encodeURIComponent(query)
      );

      if (!response.ok) {
        customerListMessage.textContent =
          data.error || 'Nem sikerült betölteni az ügyfeleket.';
        return;
      }

      customers = data.items || [];
      renderCustomers(customers);
      customerListMessage.textContent =
        customers.length + ' ügyfél található.';
    } catch (_) {
      customerListMessage.textContent =
        'Nem sikerült kapcsolódni a CRM szerverhez.';
    }
  }

  customerForm.addEventListener('submit', async event => {
    event.preventDefault();

    const id = document.getElementById('customerId').value;

    const customer = {
      customer_type: document.getElementById('customerType').value,
      name: document.getElementById('customerName').value.trim(),
      company_name: document.getElementById('companyName').value.trim(),
      tax_number: document.getElementById('taxNumber').value.trim(),
      email: document.getElementById('customerEmail').value.trim(),
      phone: document.getElementById('customerPhone').value.trim(),
      postal_code: document.getElementById('postalCode').value.trim(),
      city: document.getElementById('customerCity').value.trim(),
      street_address: document.getElementById('streetAddress').value.trim(),
      notes: document.getElementById('customerNotes').value.trim()
    };

    const saveButton = document.getElementById('saveCustomerButton');
    saveButton.disabled = true;
    customerFormMessage.textContent = 'Mentés folyamatban…';

    try {
      const { response, data } = await api(
        id ? '/api/customers/' + id : '/api/customers',
        {
          method: id ? 'PUT' : 'POST',
          body: JSON.stringify(customer)
        }
      );

      if (!response.ok || !data.success) {
        customerFormMessage.textContent =
          data.error || 'A mentés nem sikerült.';
        return;
      }

      customerFormMessage.textContent = 'Sikeres mentés!';
      closeCustomerForm();
      await loadCustomers();
    } catch (_) {
      customerFormMessage.textContent =
        'Nem sikerült kapcsolódni a CRM szerverhez.';
    } finally {
      saveButton.disabled = false;
    }
  });

  async function deleteCustomer(customer) {
    if (!confirm('Biztosan törlöd ezt az ügyfelet: ' + customer.name + '?')) {
      return;
    }

    try {
      const { response, data } = await api(
        '/api/customers/' + customer.id,
        { method: 'DELETE' }
      );

      if (!response.ok || !data.success) {
        customerListMessage.textContent =
          data.error || 'A törlés nem sikerült.';
        return;
      }

      customerListMessage.textContent = 'Az ügyfél törölve.';
      await loadCustomers();
    } catch (_) {
      customerListMessage.textContent =
        'Nem sikerült kapcsolódni a CRM szerverhez.';
    }
  }

  document.getElementById('newCustomerButton')
    .addEventListener('click', () => openCustomerForm());

  document.getElementById('cancelCustomerButton')
    .addEventListener('click', closeCustomerForm);

  customerSearch.addEventListener('input', loadCustomers);

  loginForm.addEventListener('submit', async event => {
    event.preventDefault();

    loginMessage.textContent = '';
    loginButton.disabled = true;
    loginButton.textContent = 'Beléptetés…';

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    try {
      const { response, data } = await api('/api/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      if (!response.ok || !data.success) {
        loginMessage.textContent =
          response.status === 401
            ? 'Hibás e-mail-cím vagy jelszó.'
            : (data.error || 'A bejelentkezés nem sikerült.');
        return;
      }

      loginForm.reset();
      showDashboard();
    } catch (_) {
      loginMessage.textContent =
        'Nem sikerült kapcsolódni a CRM szerverhez.';
    } finally {
      loginButton.disabled = false;
      loginButton.textContent = 'Belépés';
    }
  });

  document.getElementById('logoutButton').addEventListener('click', async () => {
    try {
      await api('/api/logout', { method: 'POST' });
    } catch (_) {}

    dashboardView.hidden = true;
    loginView.hidden = false;
    dashboardMessage.textContent = '';
    loginMessage.textContent = 'Sikeresen kijelentkeztél.';
  });

  checkSession();
})();

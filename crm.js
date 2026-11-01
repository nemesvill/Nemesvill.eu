(() => {
  const API = 'https://crm-api.nemesvill.eu';

  const $ = (id) => document.getElementById(id);

  let customers = [];
  let leads = [];

  const loginPanel = $('loginView');
  const dashboard = $('dashboardView');
  const loginForm = $('loginForm');
  const loginMessage = $('loginMessage');
  const loginStatus = $('authStatus');
  
  const customerFormPanel = $('customerFormPanel');
  const customerForm = $('customerForm');
  const customerList = $('customerList');
  const customerSearch = $('customerSearch');
  const customerListMessage = $('customerListMessage');
  const customerFormMessage = $('customerFormMessage');

  const leadSearch = $('leadSearch');
  const newLeadButton = $('newLeadButton');
  const leadFormPanel = $('leadFormPanel');
  const leadFormTitle = $('leadFormTitle');
  const leadForm = $('leadForm');
  const leadId = $('leadId');
  const leadCustomerMode = $('leadCustomerMode');
  const newLeadContactFields = $('newLeadContactFields');
  const existingLeadContactFields = $('existingLeadContactFields');
  const leadCustomerName = $('leadCustomerName');
  const leadCustomerPhone = $('leadCustomerPhone');
  const leadCustomerSelect = $('leadCustomerSelect');
  const leadService = $('leadService');
  const leadSource = $('leadSource');
  const leadSubject = $('leadSubject');
  const leadDescription = $('leadDescription');
  const leadLocation = $('leadLocation');
  const leadPreferredDate = $('leadPreferredDate');
  const leadStatus = $('leadStatus');
  const leadFollowUp = $('leadFollowUp');
  const leadFormMessage = $('leadFormMessage');
  const leadListMessage = $('leadListMessage');
  const leadList = $('leadList');

  async function api(path, options = {}) {
    const response = await fetch(`${API}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || data.message || `HTTP hiba: ${response.status}`);
    }

    return data;
  }

  function showMessage(element, message, type = 'info') {
    if (!element) return;
    element.textContent = message;
    element.dataset.type = type;
  }

  function clearMessage(element) {
    if (!element) return;
    element.textContent = '';
    element.dataset.type = '';
  }

  function showDashboard() {
    if (loginPanel) loginPanel.hidden = true;
    if (dashboard) dashboard.hidden = false;
    if (loginStatus) loginStatus.textContent = 'Bejelentkezve';
    loadCustomers();
    loadLeads();
  }

  function showLogin() {
    if (loginPanel) loginPanel.hidden = false;
    if (dashboard) dashboard.hidden = true;
    if (loginStatus) loginStatus.textContent = 'Nincs bejelentkezve';
  }

  async function checkSession() {
    try {
      await api('/api/session');
      showDashboard();
    } catch {
      showLogin();
    }
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearMessage(loginMessage);

      const formData = new FormData(loginForm);

      try {
        await api('/api/login', {
          method: 'POST',
          body: JSON.stringify({
            email: formData.get('email'),
            password: formData.get('password')
          })
        });

        loginForm.reset();
        showDashboard();
      } catch (error) {
        showMessage(loginMessage, error.message, 'error');
      }
    });
  }

  const logoutButton = $('logoutButton');

  if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
      try {
        await api('/api/logout', { method: 'POST' });
      } finally {
        showLogin();
      }
    });
  }

  // ADATBÁZIS ÁLLAPOT
  async function checkDatabase() {
    const statusElement = $('dbStatus');
    if (!statusElement) return;

    try {
      const result = await api('/api/db-check');
      statusElement.textContent = result.message || 'Adatbázis kapcsolat rendben';
    } catch {
      statusElement.textContent = 'Adatbázis kapcsolat hiba';
    }
  }

  // ÜGYFELEK
  function customerName(customer) {
    return customer.company_name || customer.name || 'Névtelen ügyfél';
  }

  function renderCustomers() {
    if (!customerList) return;

    const query = (customerSearch?.value || '').toLowerCase().trim();

    const filtered = customers.filter((customer) => {
      const searchable = [
        customer.name,
        customer.company_name,
        customer.phone,
        customer.email,
        customer.city
      ].join(' ').toLowerCase();

      return searchable.includes(query);
    });

    customerList.innerHTML = '';

    if (!filtered.length) {
      customerList.textContent = 'Nincs megjeleníthető ügyfél.';
      return;
    }

    filtered.forEach((customer) => {
      const item = document.createElement('div');
      item.className = 'list-item';

      const details = document.createElement('div');
      const name = document.createElement('strong');
      name.textContent = customerName(customer);

      const info = document.createElement('p');
      info.textContent = [
        customer.phone,
        customer.email,
        customer.city
      ].filter(Boolean).join(' · ');

      details.append(name, info);

      const actions = document.createElement('div');
      actions.className = 'list-actions';

      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.textContent = 'Szerkesztés';
      editButton.addEventListener('click', () => editCustomer(customer));

      actions.append(editButton);
      item.append(details, actions);
      customerList.append(item);
    });
  }

  async function loadCustomers() {
    if (!customerList) return;

    showMessage(customerListMessage, 'Ügyfelek betöltése...');

    try {
      const result = await api('/api/customers');
      customers = Array.isArray(result) ? result : (result.customers || []);
      renderCustomers();
      populateLeadCustomers();
      clearMessage(customerListMessage);
    } catch (error) {
      showMessage(customerListMessage, error.message, 'error');
    }
  }

  function editCustomer(customer) {
    if (!customerForm) return;

    customerForm.reset();

    const set = (name, value) => {
      const field = customerForm.elements.namedItem(name);
      if (field) field.value = value || '';
    };

    set('id', customer.id);
    set('customer_type', customer.customer_type || 'person');
    set('name', customer.name);
    set('company_name', customer.company_name);
    set('tax_number', customer.tax_number);
    set('email', customer.email);
    set('phone', customer.phone);
    set('postal_code', customer.postal_code);
    set('city', customer.city);
    set('street_address', customer.street_address);
    set('notes', customer.notes);

    if (customerFormPanel) customerFormPanel.hidden = false;
    showMessage(customerFormMessage, 'Ügyfél szerkesztése');
  }

  const newCustomerButton = $('newCustomerButton');

  if (newCustomerButton) {
    newCustomerButton.addEventListener('click', () => {
      customerForm?.reset();
      const idField = customerForm?.elements.namedItem('id');
      if (idField) idField.value = '';
      if (customerFormPanel) customerFormPanel.hidden = false;
      clearMessage(customerFormMessage);
    });
  }

  const cancelCustomerButton = $('cancelCustomerButton');

  if (cancelCustomerButton) {
    cancelCustomerButton.addEventListener('click', () => {
      customerForm?.reset();
      if (customerFormPanel) customerFormPanel.hidden = true;
      clearMessage(customerFormMessage);
    });
  }

  if (customerSearch) {
    customerSearch.addEventListener('input', renderCustomers);
  }

  if (customerForm) {
    customerForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearMessage(customerFormMessage);

      const formData = new FormData(customerForm);
      const data = Object.fromEntries(formData.entries());
      const id = data.id;
      delete data.id;

      try {
        if (id) {
          await api(`/api/customers/${encodeURIComponent(id)}`, {
            method: 'PUT',
            body: JSON.stringify(data)
          });
        } else {
          await api('/api/customers', {
            method: 'POST',
            body: JSON.stringify(data)
          });
        }

        customerForm.reset();
        if (customerFormPanel) customerFormPanel.hidden = true;
        showMessage(customerFormMessage, 'Ügyfél sikeresen mentve.', 'success');
        await loadCustomers();
      } catch (error) {
        showMessage(customerFormMessage, error.message, 'error');
      }
    });
  }

  // ÉRDEKLŐDŐK
  function populateLeadCustomers() {
    if (!leadCustomerSelect) return;

    const previousValue = leadCustomerSelect.value;
    leadCustomerSelect.innerHTML = '';

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Válassz ügyfelet...';
    leadCustomerSelect.append(placeholder);

    customers.forEach((customer) => {
      const option = document.createElement('option');
      option.value = customer.id;
      option.textContent = `${customerName(customer)}${customer.phone ? ' – ' + customer.phone : ''}`;
      leadCustomerSelect.append(option);
    });

    if (customers.some((customer) => customer.id === previousValue)) {
      leadCustomerSelect.value = previousValue;
    }
  }

  function toggleLeadCustomerMode() {
    const isNew = !leadCustomerMode || leadCustomerMode.value === 'new';

    if (newLeadContactFields) newLeadContactFields.hidden = !isNew;
    if (existingLeadContactFields) existingLeadContactFields.hidden = isNew;
  }

  if (leadCustomerMode) {
    leadCustomerMode.addEventListener('change', toggleLeadCustomerMode);
    toggleLeadCustomerMode();
  }

  function resetLeadForm() {
    leadForm?.reset();
    if (leadId) leadId.value = '';
    if (leadFormTitle) leadFormTitle.textContent = 'Új érdeklődő';
    if (leadCustomerMode) leadCustomerMode.value = 'new';
    toggleLeadCustomerMode();
    clearMessage(leadFormMessage);
  }

  function openLeadForm() {
    resetLeadForm();
    populateLeadCustomers();
    if (leadFormPanel) leadFormPanel.hidden = false;
  }

  if (newLeadButton) {
    newLeadButton.addEventListener('click', openLeadForm);
  }

  const cancelLeadButton = $('cancelLeadButton');

  if (cancelLeadButton) {
    cancelLeadButton.addEventListener('click', () => {
      if (leadFormPanel) leadFormPanel.hidden = true;
      resetLeadForm();
    });
  }

  function serviceLabel(value) {
    const labels = {
      villanyszereles: 'Villanyszerelés',
      klimaszereles: 'Klímaszerelés',
      ev_tolto: 'EV-töltő',
      egyeb: 'Egyéb'
    };
    return labels[value] || value || 'Nincs megadva';
  }

  function statusLabel(value) {
    const labels = {
      new: 'Új',
      contacted: 'Kapcsolatfelvétel',
      survey: 'Felmérés',
      quoted: 'Ajánlat elküldve',
      won: 'Megrendelés',
      lost: 'Elveszett',
      archived: 'Archivált'
    };
    return labels[value] || value || 'Új';
  }

  function renderLeads() {
    if (!leadList) return;

    const query = (leadSearch?.value || '').toLowerCase().trim();

    const filtered = leads.filter((lead) => {
      const searchable = [
        lead.subject,
        lead.customer_name,
        lead.description,
        lead.location_text,
        lead.service_type,
        lead.status
      ].join(' ').toLowerCase();

      return searchable.includes(query);
    });

    leadList.innerHTML = '';

    if (!filtered.length) {
      leadList.textContent = 'Még nincs rögzített érdeklődő.';
      return;
    }

    filtered.forEach((lead) => {
      const item = document.createElement('div');
      item.className = 'list-item';

      const details = document.createElement('div');

      const title = document.createElement('strong');
      title.textContent = lead.subject || 'Érdeklődés';

      const contact = document.createElement('p');
      contact.textContent = lead.customer_name || 'Ismeretlen ügyfél';

      const meta = document.createElement('p');
      meta.textContent = [
        serviceLabel(lead.service_type),
        statusLabel(lead.status),
        lead.location_text
      ].filter(Boolean).join(' · ');

      const description = document.createElement('p');
      description.textContent = lead.description || '';

      details.append(title, contact, meta);
      if (lead.description) details.append(description);

      item.append(details);
      leadList.append(item);
    });
  }

  async function loadLeads() {
    if (!leadList) return;

    showMessage(leadListMessage, 'Érdeklődők betöltése...');

    try {
      const result = await api('/api/leads');
      leads = Array.isArray(result) ? result : (result.leads || []);
      renderLeads();
      clearMessage(leadListMessage);
    } catch (error) {
      showMessage(leadListMessage, error.message, 'error');
    }
  }

  if (leadSearch) {
    leadSearch.addEventListener('input', renderLeads);
  }

  if (leadForm) {
    leadForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearMessage(leadFormMessage);

      const isNewCustomer = !leadCustomerMode || leadCustomerMode.value === 'new';
      let customerId = '';

      try {
        if (isNewCustomer) {
          const name = leadCustomerName?.value.trim();
          const phone = leadCustomerPhone?.value.trim();

          if (!name) {
            throw new Error('Add meg az érdeklődő nevét.');
          }

          showMessage(leadFormMessage, 'Kapcsolattartó mentése...');

          const customerResult = await api('/api/customers', {
            method: 'POST',
            body: JSON.stringify({
              customer_type: 'person',
              name,
              phone
            })
          });

          const customer = customerResult.customer || customerResult;
          customerId = customer.id;

          if (!customerId) {
            throw new Error('Az ügyfél mentése nem adott vissza azonosítót.');
          }

          await loadCustomers();
        } else {
          customerId = leadCustomerSelect?.value || '';

          if (!customerId) {
            throw new Error('Válassz ki egy ügyfelet.');
          }
        }

        const data = {
          customer_id: customerId,
          service_type: leadService?.value || 'egyeb',
          source: leadSource?.value || 'manual',
          subject: leadSubject?.value.trim() || 'Új érdeklődés',
          description: leadDescription?.value.trim() || '',
          location_text: leadLocation?.value.trim() || '',
          preferred_date: leadPreferredDate?.value || '',
          status: leadStatus?.value || 'new',
          follow_up_at: leadFollowUp?.value || ''
        };

        showMessage(leadFormMessage, 'Érdeklődő mentése...');

        await api('/api/leads', {
          method: 'POST',
          body: JSON.stringify(data)
        });

        showMessage(leadFormMessage, 'Érdeklődő sikeresen rögzítve.', 'success');
        leadForm?.reset();
        if (leadFormPanel) leadFormPanel.hidden = true;

        await loadLeads();
        await loadCustomers();
      } catch (error) {
        showMessage(leadFormMessage, error.message, 'error');
      }
    });
  }

  // INDÍTÁS
  checkSession();
  checkDatabase();
})();

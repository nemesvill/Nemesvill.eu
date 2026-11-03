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
    loadJobs();
    checkDatabase();
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
      
// TÖRLÉS GOMB
const deleteButton = document.createElement('button');
deleteButton.type = 'button';
deleteButton.textContent = 'Törlés';

deleteButton.addEventListener('click', async () => {
  const confirmed = confirm(
    `Biztosan törlöd ezt az ügyfelet: ${customerName(customer)}?`
  );

  if (!confirmed) return;

  try {
    await api(`/api/customers/${encodeURIComponent(customer.id)}`, {
      method: 'DELETE'
    });

    await loadCustomers();
    showMessage(customerListMessage, 'Ügyfél sikeresen törölve.', 'success');
  } catch (error) {
    showMessage(customerListMessage, error.message, 'error');
  }
});

actions.append(deleteButton);
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
      populateJobCustomers();
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

      const editButton = document.createElement('button');
editButton.type = 'button';
editButton.textContent = 'Szerkesztés';

editButton.addEventListener('click', () => {
  editLead(lead);
});

const actions = document.createElement('div');
actions.className = 'list-actions';
actions.append(editButton);

// Érdeklődés törlése
const deleteButton = document.createElement('button');
deleteButton.type = 'button';
deleteButton.textContent = 'Törlés';

deleteButton.addEventListener('click', async () => {
  if (!confirm('Biztosan törlöd ezt az érdeklődést?')) return;

  try {
    await api(`/api/leads/${encodeURIComponent(lead.id)}`, {
      method: 'DELETE'
    });

    await loadLeads();
    showMessage(leadListMessage, 'Érdeklődés sikeresen törölve.', 'success');
  } catch (error) {
    showMessage(leadListMessage, error.message, 'error');
  }
});

actions.append(deleteButton);
item.append(details, actions);

      leadList.append(item);
    });
  }
function editLead(lead) {
  if (!leadForm) return;

  resetLeadForm();
  populateLeadCustomers();

  if (leadId) leadId.value = lead.id;

  if (leadFormTitle) {
    leadFormTitle.textContent = 'Érdeklődő szerkesztése';
  }

  if (leadCustomerMode) {
    leadCustomerMode.value = 'existing';
  }

  toggleLeadCustomerMode();

  if (leadCustomerSelect) {
    leadCustomerSelect.value = lead.customer_id || '';
  }

  if (leadService) leadService.value = lead.service_type || 'egyeb';
  if (leadSource) leadSource.value = lead.source || 'manual';
  if (leadSubject) leadSubject.value = lead.subject || '';
  if (leadDescription) leadDescription.value = lead.description || '';
  if (leadLocation) leadLocation.value = lead.location_text || '';
  if (leadPreferredDate) leadPreferredDate.value = lead.preferred_date || '';
  if (leadStatus) leadStatus.value = lead.status || 'new';

  if (leadFollowUp) {
    leadFollowUp.value = lead.follow_up_at
      ? String(lead.follow_up_at).replace(' ', 'T').slice(0, 16)
      : '';
  }

  if (leadFormPanel) leadFormPanel.hidden = false;

  showMessage(leadFormMessage, 'Érdeklődő szerkesztése');
}
  async function loadLeads() {
    if (!leadList) return;

    showMessage(leadListMessage, 'Érdeklődők betöltése...');

    try {
      const result = await api('/api/leads');
      leads = Array.isArray(result) ? result : (result.leads || []);
      renderLeads();
      populateJobLeads();
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
      const currentLeadId = leadId?.value;
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

if (currentLeadId) {
  await api(`/api/leads/${encodeURIComponent(currentLeadId)}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
} else {
  await api('/api/leads', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

      const wasEditing = Boolean(currentLeadId);

resetLeadForm();

if (leadFormPanel) leadFormPanel.hidden = true;

showMessage(
  leadListMessage,
  wasEditing
    ? 'Érdeklődő sikeresen módosítva.'
    : 'Érdeklődő sikeresen rögzítve.',
  'success'
);

        await loadLeads();
        await loadCustomers();
      } catch (error) {
        showMessage(leadFormMessage, error.message, 'error');
      }
    });
  }

  // MUNKÁK KEZELÉSE
  function jobStatusLabel(value) {
    const labels = {
      planned: 'Tervezett',
      in_progress: 'Folyamatban',
      waiting_material: 'Anyagra vár',
      completed: 'Befejezett',
      cancelled: 'Meghiúsult'
    };
    return labels[value] || value || 'Tervezett';
  }

  function formatJobDate(value) {
    if (!value) return '';
    const date = new Date(String(value).replace(' ', 'T'));
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('hu-HU', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function toDateTimeLocal(value) {
    return value ? String(value).replace(' ', 'T').slice(0, 16) : '';
  }

 function populateJobCustomers() {
  const select = document.getElementById('jobCustomer');

  if (!select) {
    console.error('Nem található a jobCustomer mező!');
    return;
  }

  const previousValue = select.value;

  select.innerHTML = '';

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Ügyfél kiválasztása';
  select.appendChild(placeholder);

  console.log('Betöltendő ügyfelek:', customers);

  customers.forEach((customer) => {
    const option = document.createElement('option');
    option.value = customer.id;
    option.textContent =
      `${customerName(customer)}${customer.phone ? ' – ' + customer.phone : ''}`;

    select.appendChild(option);
  });

  if (customers.some(customer => String(customer.id) === previousValue)) {
    select.value = previousValue;
  }

  console.log('Ügyfélválasztó opciók:', select.options.length);
}

  function populateJobLeads(selectedValue = null) {
    if (!jobLead) return;
    const previousValue = selectedValue ?? jobLead.value;
    jobLead.innerHTML = '';

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Nincs kapcsolódó érdeklődés';
    jobLead.append(placeholder);

    leads.forEach((lead) => {
      const option = document.createElement('option');
      option.value = lead.id;
      option.textContent = `${lead.subject || 'Érdeklődés'}${lead.customer_name ? ' – ' + lead.customer_name : ''}`;
      jobLead.append(option);
    });

    if (leads.some(lead => lead.id === previousValue)) {
      jobLead.value = previousValue;
    }
  }
    async function loadJobs() {
    if (!jobList) return;

    jobList.innerHTML = '<p class="muted">Munkák betöltése...</p>';
    if (jobListMessage) jobListMessage.textContent = '';

    try {
      const result = await api('/api/jobs', {
        signal: AbortSignal.timeout(12000)
      });
      jobs = Array.isArray(result) ? result : (result.items || result.jobs || []);
      renderJobs();
    } catch (error) {
      jobList.innerHTML = '';
      if (jobListMessage) {
        jobListMessage.textContent = error.name === 'TimeoutError' || error.name === 'AbortError'
          ? 'A munkák lekérése időtúllépés miatt megszakadt. Ellenőrizd a kapcsolatot, majd töltsd újra az oldalt.'
          : (error.message || 'Nem sikerült betölteni a munkákat.');
      }
    }
  }

  function renderJobs() {
    if (!jobList) return;

    const search = (jobSearch?.value || '').toLowerCase().trim();

    const filtered = jobs.filter((job) => {
      const customer = job.customer_name || '';
      const text = [
        job.job_number,
        job.title,
        customer,
        job.address_text,
        job.service_type,
        job.status
      ].join(' ').toLowerCase();

      return text.includes(search);
    });

    jobList.innerHTML = '';

    if (!filtered.length) {
      jobList.innerHTML = '<p>Nincs megjeleníthető munka.</p>';
      return;
    }

    filtered.forEach((job) => {
      const card = document.createElement('article');
      card.className = 'item-card';

      const heading = document.createElement('h3');
      heading.textContent = `${job.job_number || ''} – ${job.title || 'Munka'}`;

      const details = document.createElement('p');
      details.textContent =
        `${job.customer_name || 'Nincs ügyfél'} · ${jobStatusLabel(job.status)}`;

      const date = document.createElement('p');
      date.textContent = job.scheduled_start
        ? `Kezdés: ${formatJobDate(job.scheduled_start)}`
        : 'Nincs időpont megadva';

      const address = document.createElement('p');
      address.textContent = job.address_text || '';

      const actions = document.createElement('div');
      actions.className = 'item-actions';

      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.textContent = 'Szerkesztés';
      editButton.addEventListener('click', () => editJob(job.id));

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.textContent = 'Törlés';
      deleteButton.addEventListener('click', () => deleteJob(job.id));

      actions.append(editButton, deleteButton);
      card.append(heading, details, date, address, actions);
      jobList.append(card);
    });
  }
    // MUNKÁK FELÜLETÉNEK ELEMEI
  let jobs = [];

  const jobList = $('jobList');
  const jobListMessage = $('jobListMessage');
  const jobSearch = $('jobSearch');
  const newJobButton = $('newJobButton');
  const jobFormPanel = $('jobFormPanel');
  const jobFormTitle = $('jobFormTitle');
  const jobForm = $('jobForm');
  const jobId = $('jobId');
  const jobCustomer = $('jobCustomer');
  const jobLead = $('jobLead');
  const jobService = $('jobService');
  const jobTitle = $('jobTitle');
  const jobDescription = $('jobDescription');
  const jobStart = $('jobStart');
  const jobEnd = $('jobEnd');
  const jobAddress = $('jobAddress');
  const jobLaborMinutes = $('jobLaborMinutes');
  const jobStatus = $('jobStatus');
  const jobNotes = $('jobNotes');
  const jobFormMessage = $('jobFormMessage');
  const cancelJobButton = $('cancelJobButton');

  function resetJobForm() {
    if (!jobForm) return;
    jobForm.reset();
    jobId.value = '';
    if (jobFormTitle) jobFormTitle.textContent = 'Új munka';
    if (jobFormMessage) jobFormMessage.textContent = '';
  }

  function editJob(id) {
    const job = jobs.find(item => item.id === id);
    if (!job) return;

    jobId.value = job.id;
    jobCustomer.value = job.customer_id || '';
    populateJobLeads(job.lead_id || '');
    jobService.value = job.service_type || 'villanyszereles';
    jobTitle.value = job.title || '';
    jobDescription.value = job.description || '';
    jobStart.value = toDateTimeLocal(job.scheduled_start);
    jobEnd.value = toDateTimeLocal(job.scheduled_end);
    jobAddress.value = job.address_text || '';
    jobLaborMinutes.value = job.labor_minutes || 0;
    jobStatus.value = job.status || 'planned';
    jobNotes.value = job.notes || '';

    if (jobFormTitle) jobFormTitle.textContent = 'Munka szerkesztése';
    if (jobFormMessage) jobFormMessage.textContent = '';
    if (jobFormPanel) { jobFormPanel.hidden = false; jobFormPanel.style.display = 'block'; }
    jobFormPanel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function deleteJob(id) {
    const job = jobs.find(item => item.id === id);
    if (!job) return;

    if (!confirm(`Biztosan törlöd ezt a munkát: ${job.title}?`)) return;

    try {
      await api(`/api/jobs/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      await loadJobs();
      if (jobListMessage) jobListMessage.textContent = 'A munka törölve.';
    } catch (error) {
      if (jobListMessage) {
        jobListMessage.textContent = error.message || 'Nem sikerült törölni a munkát.';
      }
    }
  }

console.log('ELÉRTÜK A MUNKÁK ESEMÉNYKEZELŐJÉT');
  
// ÚJ MUNKA GOMB – KÖZVETLEN ESEMÉNYKEZELÉS
if (newJobButton) {
  newJobButton.addEventListener('click', () => {
    // Az űrlapot először jelenítsük meg; a listák feltöltése ne akadályozza.
    if (jobFormPanel) {
      jobFormPanel.hidden = false;
      jobFormPanel.style.display = 'block';
      jobFormPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    resetJobForm();
    if (jobFormTitle) jobFormTitle.textContent = 'Új munka';

    try {
      populateJobCustomers();
      populateJobLeads();
    } catch (error) {
      console.error('Az új munka űrlap előkészítése sikertelen:', error);
      if (jobFormMessage) {
        jobFormMessage.textContent = 'Az űrlap megnyílt, de az ügyféladatok betöltése hibát jelzett.';
      }
    }

    if (jobFormPanel) { jobFormPanel.hidden = false; jobFormPanel.style.display = 'block'; }
  });
}
  if (cancelJobButton) {
    cancelJobButton.addEventListener('click', () => {
      resetJobForm();
      if (jobFormPanel) { jobFormPanel.hidden = true; jobFormPanel.style.display = 'none'; }
    });
  }

  if (jobSearch) {
    jobSearch.addEventListener('input', renderJobs);
  }

  if (jobCustomer) {
    jobCustomer.addEventListener('change', () => {
      populateJobLeads();
    });
  }

  if (jobForm) {
    jobForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const data = {
        customer_id: jobCustomer.value,
        lead_id: jobLead.value || null,
        service_type: jobService.value,
        title: jobTitle.value.trim(),
        description: jobDescription.value.trim(),
        scheduled_start: jobStart.value || null,
        scheduled_end: jobEnd.value || null,
        address_text: jobAddress.value.trim(),
        labor_minutes: Number(jobLaborMinutes.value) || 0,
        status: jobStatus.value,
        notes: jobNotes.value.trim()
      };

      if (!data.customer_id || !data.title) {
        if (jobFormMessage) {
          jobFormMessage.textContent = 'Az ügyfél és a munka megnevezése kötelező.';
        }
        return;
      }

      const id = jobId.value;
      const method = id ? 'PUT' : 'POST';
      const path = id
        ? `/api/jobs/${encodeURIComponent(id)}`
        : '/api/jobs';

      try {
        if (jobFormMessage) jobFormMessage.textContent = 'Mentés...';

        await api(path, {
          method,
          body: JSON.stringify(data)
        });

        resetJobForm();
        if (jobFormPanel) { jobFormPanel.hidden = true; jobFormPanel.style.display = 'none'; }
        await loadJobs();

        if (jobListMessage) {
          jobListMessage.textContent = 'A munka sikeresen mentve.';
        }
      } catch (error) {
        if (jobFormMessage) {
          jobFormMessage.textContent = error.message || 'Nem sikerült menteni a munkát.';
        }
      }
    });
  }
  
  // INDÍTÁS
  checkSession();
})();

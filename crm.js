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
    loadQuotes();
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



  function escapePrintHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
    })[char]);
  }

  async function printJobSheet(job) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('A böngésző blokkolta a felugró ablakot. Engedélyezd a felugró ablakokat a CRM oldalán.');
      return;
    }
    printWindow.document.write('<!doctype html><html lang="hu"><head><meta charset="utf-8"><title>Nemesvill munkalap</title></head><body><p>Adatok betöltése...</p></body></html>');
    try {
      const [costData, workData, incomeData] = await Promise.all([
        api('/api/jobs/' + encodeURIComponent(job.id) + '/costs'),
        api('/api/jobs/' + encodeURIComponent(job.id) + '/work-logs'),
        api('/api/jobs/' + encodeURIComponent(job.id) + '/income')
      ]);
      const money = value => formatHuf(value);
      const workRows = (workData.items || []).map(item =>
        '<tr><td>' + escapePrintHtml(item.work_date) + '</td><td>' +
        escapePrintHtml(item.start_time || '') + ' – ' + escapePrintHtml(item.end_time || '') +
        '</td><td>' + escapePrintHtml(item.task_description) + '</td><td>' +
        Math.floor(Number(item.duration_minutes || 0)/60) + ' óra ' +
        (Number(item.duration_minutes || 0)%60) + ' perc</td><td>' +
        escapePrintHtml(item.notes || '') + '</td></tr>'
      ).join('');
      const costRows = (costData.items || []).map(item =>
        '<tr><td>' + escapePrintHtml(({material:'Anyag',labor:'Munkadíj',travel:'Kiszállás',other:'Egyéb'})[item.cost_type] || item.cost_type) +
        '</td><td>' + escapePrintHtml(item.description) + '</td><td>' +
        escapePrintHtml(item.quantity + ' ' + item.unit) + '</td><td>' +
        money(item.unit_net_cost) + '</td><td>' +
        money(Math.round(Number(item.quantity)*Number(item.unit_net_cost))) + '</td></tr>'
      ).join('');
      const incomeRows = (incomeData.items || []).map(item =>
        '<tr><td>' + escapePrintHtml(item.income_date) + '</td><td>' +
        escapePrintHtml(item.invoice_number || '') + '</td><td>' +
        escapePrintHtml(item.description) + '</td><td>' + money(item.gross_amount) +
        '</td><td>' + (item.paid ? 'Fizetve' : 'Fizetetlen') + '</td></tr>'
      ).join('');
      const t = costData.totals || {};
      const customer = job.customer_company_name || job.customer_name || '—';
      const html = '<!doctype html><html lang="hu"><head><meta charset="utf-8"><title>' +
        escapePrintHtml(job.job_number || 'Munkalap') +
        '</title><style>body{font:13px/1.45 Arial,sans-serif;color:#17212b;margin:28px}header{display:flex;justify-content:space-between;border-bottom:3px solid #18a9a5;padding-bottom:12px}h1{font-size:24px;margin:0;color:#087f7b}h2{font-size:16px;margin:22px 0 8px;border-bottom:1px solid #ccd5dc;padding-bottom:5px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:16px 0}.meta div{padding:5px 0}table{width:100%;border-collapse:collapse;margin:8px 0 18px}th,td{border:1px solid #cbd3da;padding:6px;text-align:left;vertical-align:top}th{background:#edf3f5}.totals{margin:16px 0;padding:12px;background:#edf5f5}.sign{display:grid;grid-template-columns:1fr 1fr;gap:60px;margin-top:70px}.sign div{border-top:1px solid #555;padding-top:7px;text-align:center}.muted{color:#52616c;font-size:11px}@media print{body{margin:12mm}button{display:none}}</style></head><body>' +
        '<header><div><h1>NEMESVILL</h1><div>Villanyszerelés · Klímaszerelés · EV-töltő telepítés</div></div><div><strong>MUNKALAP</strong><br>' +
        escapePrintHtml(job.job_number || '') + '</div></header>' +
        '<div class="meta"><div><strong>Ügyfél:</strong> ' + escapePrintHtml(customer) +
        '</div><div><strong>Szolgáltatás:</strong> ' + escapePrintHtml(job.service_type || '') +
        '</div><div><strong>Munkavégzés helye:</strong> ' + escapePrintHtml(job.address_text || '') +
        '</div><div><strong>Munka megnevezése:</strong> ' + escapePrintHtml(job.title || '') +
        '</div><div><strong>Tervezett kezdés:</strong> ' + escapePrintHtml(job.scheduled_start || '—') +
        '</div><div><strong>Tervezett befejezés:</strong> ' + escapePrintHtml(job.scheduled_end || '—') +
        '</div></div><h2>Elvégzett feladatok és munkaidő</h2><table><thead><tr><th>Dátum</th><th>Idő</th><th>Feladat</th><th>Munkaidő</th><th>Megjegyzés</th></tr></thead><tbody>' +
        (workRows || '<tr><td colspan="5">Nincs rögzített munkanapló.</td></tr>') +
        '</tbody></table><h2>Költségek</h2><table><thead><tr><th>Típus</th><th>Megnevezés</th><th>Mennyiség</th><th>Egységköltség</th><th>Összesen</th></tr></thead><tbody>' +
        (costRows || '<tr><td colspan="5">Nincs rögzített költség.</td></tr>') +
        '</tbody></table><h2>Bevételek és számlák</h2><table><thead><tr><th>Dátum</th><th>Számlaszám</th><th>Megnevezés</th><th>Összeg</th><th>Fizetési állapot</th></tr></thead><tbody>' +
        (incomeRows || '<tr><td colspan="5">Nincs rögzített bevétel.</td></tr>') +
        '</tbody></table><div class="totals"><strong>Bevétel:</strong> ' + money(t.income) +
        ' &nbsp; <strong>Költség:</strong> ' + money(t.total_cost) +
        ' &nbsp; <strong>Eredmény:</strong> ' + money(t.result) +
        '<br><span class="muted">Adózási megjelölés: AAM – alanyi adómentes. Ez a munkalap belső nyilvántartás, nem számla és nem helyettesíti a számlát.</span></div>' +
        '<div class="sign"><div>Megrendelő aláírása</div><div>Vállalkozó aláírása</div></div><p class="muted">Készült: ' +
        escapePrintHtml(new Date().toLocaleString('hu-HU')) + '</p><script>window.addEventListener("load",()=>window.print());</script></body></html>';
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
    } catch (error) {
      printWindow.document.body.textContent = 'A munkalap összeállítása nem sikerült: ' + error.message;
    }
  }

  async function toggleJobSheet(job, card) {
    const old = card.querySelector('.job-sheet-panel');
    if (old) { old.remove(); return; }
    const panel = document.createElement('section');
    panel.className = 'job-sheet-panel';
    const printButton = document.createElement('button');
    printButton.type = 'button';
    printButton.textContent = 'Munkalap nyomtatása / PDF';
    printButton.addEventListener('click', () => printJobSheet(job));
    panel.innerHTML = '<h4>Munkalap és költségek</h4><p class="muted">Betöltés...</p>';
    panel.append(printButton);
    card.append(panel);
    try {
      const data = await api('/api/jobs/' + encodeURIComponent(job.id) + '/costs');
      panel.innerHTML = '';
      panel.append(printButton);
      const summary = document.createElement('div');
      summary.className = 'job-sheet-summary';
      const t = data.totals || {};
      summary.textContent = 'Bevétel: ' + formatHuf(t.income) +
        ' · Közvetlen költség: ' + formatHuf(t.direct_cost) +
        ' · Egyéb kiadás: ' + formatHuf(t.other_expenses) +
        ' · Eredmény: ' + formatHuf(t.result);
      panel.append(summary);
      const workHeading = document.createElement('h4');
      workHeading.textContent = 'Elvégzett feladatok és munkaidő';
      panel.append(workHeading);
      const workData = await api('/api/jobs/' + encodeURIComponent(job.id) + '/work-logs');
      const workList = document.createElement('div');
      workList.className = 'job-cost-list';
      (workData.items || []).forEach(log => {
        const row = document.createElement('div');
        row.className = 'job-cost-row';
        const label = document.createElement('span');
        const hours = Math.floor(Number(log.duration_minutes || 0) / 60);
        const mins = Number(log.duration_minutes || 0) % 60;
        label.textContent = log.work_date + ' · ' + (log.start_time || '--:--') + '–' +
          (log.end_time || '--:--') + ' · ' + hours + ' óra ' + mins + ' perc · ' +
          log.task_description + (log.notes ? ' · Megjegyzés: ' + log.notes : '');
        const del = document.createElement('button');
        del.type = 'button'; del.className = 'secondary'; del.textContent = 'Törlés';
        del.addEventListener('click', async () => {
          if (!confirm('Törlöd ezt a munkanapló-bejegyzést?')) return;
          try {
            await api('/api/work-logs/' + encodeURIComponent(log.id), {method:'DELETE'});
            panel.remove(); await toggleJobSheet(job, card);
          } catch (e) { alert(e.message); }
        });
        row.append(label, del); workList.append(row);
      });
      if (!(workData.items || []).length) workList.textContent = 'Még nincs rögzített elvégzett feladat.';
      const totalTime = document.createElement('p');
      totalTime.className = 'muted';
      totalTime.textContent = 'Összes rögzített munkaidő: ' +
        Math.floor(Number(workData.total_minutes || 0) / 60) + ' óra ' +
        (Number(workData.total_minutes || 0) % 60) + ' perc';
      panel.append(workList, totalTime);
      const workForm = document.createElement('form');
      workForm.className = 'job-cost-form';
      workForm.innerHTML =
        '<label>Munkanap<input name="work_date" type="date" required value="' + new Date().toISOString().slice(0,10) + '"></label>' +
        '<label>Kezdés<input name="start_time" type="time"></label>' +
        '<label>Befejezés<input name="end_time" type="time"></label>' +
        '<label>Munkaidő (perc)<input name="duration_minutes" type="number" min="0" max="1440" step="1" value="0" required></label>' +
        '<label class="job-wide-field">Elvégzett feladat<input name="task_description" required maxlength="1000" placeholder="Pl. konyhai dugaljak kiépítése"></label>' +
        '<label class="job-wide-field">Megjegyzés<textarea name="notes" rows="2" maxlength="2000"></textarea></label>' +
        '<button type="submit">Munkanapló mentése</button>';
      workForm.addEventListener('submit', async event => {
        event.preventDefault();
        const fd = new FormData(workForm);
        const payload = Object.fromEntries(fd.entries());
        payload.duration_minutes = Number(payload.duration_minutes);
        try {
          await api('/api/jobs/' + encodeURIComponent(job.id) + '/work-logs', {
            method:'POST', body:JSON.stringify(payload)
          });
          panel.remove(); await toggleJobSheet(job, card);
        } catch (e) { alert(e.message); }
      });
      panel.append(workForm);
      const incomeData = await api('/api/jobs/' + encodeURIComponent(job.id) + '/income');
      const incomeHeading = document.createElement('h4');
      incomeHeading.textContent = 'Bevételek és számlák';
      panel.append(incomeHeading);
      const incomeList = document.createElement('div');
      incomeList.className = 'job-cost-list';
      (incomeData.items || []).forEach(item => {
        const row = document.createElement('div');
        row.className = 'job-cost-row';
        const label = document.createElement('span');
        label.textContent = item.income_date + ' · ' + (item.invoice_number || 'Számlaszám nincs megadva') +
          ' · ' + item.description + ' · ' + formatHuf(item.gross_amount) +
          ' · ' + (item.paid ? 'Fizetve' : 'Fizetetlen');
        const actions = document.createElement('div');
        actions.className = 'job-income-actions';
        const paidButton = document.createElement('button');
        paidButton.type = 'button'; paidButton.className = 'secondary';
        paidButton.textContent = item.paid ? 'Fizetetlenre állít' : 'Fizetettnek jelöl';
        paidButton.addEventListener('click', async () => {
          try {
            await api('/api/income-records/' + encodeURIComponent(item.id), {
              method:'PUT', body:JSON.stringify({invoice_number:item.invoice_number, paid:!item.paid})
            });
            panel.remove(); await toggleJobSheet(job, card);
          } catch (e) { alert(e.message); }
        });
        const deleteIncome = document.createElement('button');
        deleteIncome.type = 'button'; deleteIncome.className = 'secondary'; deleteIncome.textContent = 'Törlés';
        deleteIncome.addEventListener('click', async () => {
          if (!confirm('Törlöd ezt a bevételi tételt?')) return;
          try {
            await api('/api/income-records/' + encodeURIComponent(item.id), {method:'DELETE'});
            panel.remove(); await toggleJobSheet(job, card);
          } catch (e) { alert(e.message); }
        });
        actions.append(paidButton, deleteIncome); row.append(label, actions); incomeList.append(row);
      });
      if (!(incomeData.items || []).length) incomeList.textContent = 'Még nincs rögzített bevétel.';
      panel.append(incomeList);
      const incomeForm = document.createElement('form');
      incomeForm.className = 'job-cost-form';
      incomeForm.innerHTML =
        '<label>Számlaszám<input name="invoice_number" maxlength="100" placeholder="Pl. NV-2026-001"></label>' +
        '<label>Dátum<input name="income_date" type="date" required value="' + new Date().toISOString().slice(0,10) + '"></label>' +
        '<label>Megnevezés<input name="description" required maxlength="500" placeholder="Pl. klímaszerelés munkadíja"></label>' +
        '<label>Számla összege (Ft)<input name="gross_amount" type="number" min="1" step="1" required></label>' +
        '<label class="job-income-paid"><input name="paid" type="checkbox" value="1"> Már ki van fizetve</label>' +
        '<button type="submit">Bevétel mentése</button>';
      incomeForm.addEventListener('submit', async event => {
        event.preventDefault();
        const fd = new FormData(incomeForm);
        const payload = Object.fromEntries(fd.entries());
        payload.gross_amount = Number(payload.gross_amount);
        payload.paid = fd.has('paid');
        try {
          await api('/api/jobs/' + encodeURIComponent(job.id) + '/income', {
            method:'POST', body:JSON.stringify(payload)
          });
          panel.remove(); await toggleJobSheet(job, card);
        } catch (e) { alert(e.message); }
      });
      panel.append(incomeForm);
      const list = document.createElement('div');
      list.className = 'job-cost-list';
      (data.items || []).forEach(item => {
        const row = document.createElement('div');
        row.className = 'job-cost-row';
        const label = document.createElement('span');
        label.textContent = item.description + ' · ' + item.quantity + ' ' + item.unit +
          ' × ' + formatHuf(item.unit_net_cost) + ' = ' +
          formatHuf(Number(item.quantity) * Number(item.unit_net_cost));
        const del = document.createElement('button');
        del.type = 'button'; del.className = 'secondary'; del.textContent = 'Törlés';
        del.addEventListener('click', async () => {
          if (!confirm('Törlöd ezt a költségtételt?')) return;
          try { await api('/api/job-cost-items/' + encodeURIComponent(item.id), {method:'DELETE'}); panel.remove(); await toggleJobSheet(job, card); }
          catch (e) { alert(e.message); }
        });
        row.append(label, del); list.append(row);
      });
      if (!(data.items || []).length) list.textContent = 'Még nincs rögzített közvetlen költség.';
      panel.append(list);
      const form = document.createElement('form');
      form.className = 'job-cost-form';
      form.innerHTML = '<label>Típus<select name="cost_type"><option value="material">Anyag</option><option value="labor">Munkadíj</option><option value="travel">Kiszállás</option><option value="other">Egyéb</option></select></label>' +
        '<label>Megnevezés<input name="description" required maxlength="500" placeholder="Pl. 3×2,5 mm² vezeték"></label>' +
        '<label>Mennyiség<input name="quantity" type="number" min="0.001" step="0.001" value="1" required></label>' +
        '<label>Egység<input name="unit" maxlength="30" value="db"></label>' +
        '<label>Nettó egységköltség (Ft)<input name="unit_net_cost" type="number" min="0" step="1" value="0" required></label>' +
        '<button type="submit">Költség mentése</button>';
      form.addEventListener('submit', async event => {
        event.preventDefault();
        const fd = new FormData(form);
        const payload = Object.fromEntries(fd.entries());
        payload.quantity = Number(payload.quantity);
        payload.unit_net_cost = Number(payload.unit_net_cost);
        const submit = form.querySelector('button[type="submit"]');
        submit.disabled = true;
        try {
          await api('/api/jobs/' + encodeURIComponent(job.id) + '/costs', {method:'POST', body:JSON.stringify(payload)});
          await toggleJobSheet(job, card);
        } catch (e) { alert(e.message); submit.disabled = false; }
      });
      panel.append(form);
      const note = document.createElement('p');
      note.className = 'muted';
      note.textContent = 'Az összesítő a rögzített munkaköltségeket, kiadásokat és bevételeket mutatja. Az AAM mód változatlan.';
      panel.append(note);
    } catch (error) {
      panel.textContent = 'A munkalap betöltése nem sikerült: ' + error.message;
    }
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

      const sheetButton = document.createElement('button');
      sheetButton.type = 'button';
      sheetButton.textContent = 'Munkalap / költségek';
      sheetButton.addEventListener('click', () => toggleJobSheet(job, card));
      actions.append(editButton, deleteButton, sheetButton);
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
  

  // ÁRAJÁNLATOK
  let quotes = [];
  let editingQuoteId = null;
  const quoteList = $('quoteList');
  const quoteListMessage = $('quoteListMessage');
  const quoteSearch = $('quoteSearch');
  const quoteFormPanel = $('quoteFormPanel');
  const quoteForm = $('quoteForm');
  const quoteCustomer = $('quoteCustomer');
  const quoteLead = $('quoteLead');
  const quoteItems = $('quoteItems');
  const quoteTotalPreview = $('quoteTotalPreview');
  const quoteFormMessage = $('quoteFormMessage');

  function formatHuf(value) {
    return new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 0 }).format(Number(value) || 0) + ' Ft';
  }

  function populateQuoteSelectors() {
    if (quoteCustomer) {
      const previous = quoteCustomer.value;
      quoteCustomer.innerHTML = '<option value="">Ügyfél kiválasztása</option>';
      customers.forEach(customer => {
        const option = document.createElement('option');
        option.value = customer.id;
        option.textContent = customerName(customer);
        quoteCustomer.append(option);
      });
      if (customers.some(customer => customer.id === previous)) quoteCustomer.value = previous;
    }
    if (quoteLead) {
      const previous = quoteLead.value;
      quoteLead.innerHTML = '<option value="">Nincs kapcsolódó érdeklődés</option>';
      leads.forEach(lead => {
        const option = document.createElement('option');
        option.value = lead.id;
        option.textContent = (lead.subject || 'Érdeklődés') + (lead.customer_name ? ' – ' + lead.customer_name : '');
        quoteLead.append(option);
      });
      if (leads.some(lead => lead.id === previous)) quoteLead.value = previous;
    }
  }

  function addQuoteItemRow(initial = {}) {
    if (!quoteItems) return;
    const row = document.createElement('div');
    row.className = 'quote-item-row';
    row.style.cssText = 'display:grid;grid-template-columns: minmax(130px,2fr) minmax(65px,.7fr) minmax(65px,.7fr) minmax(90px,1fr) auto;gap:8px;margin:10px 0;align-items:end;';
    const descriptionWrap = document.createElement('label');
    descriptionWrap.textContent = 'Megnevezés';
    const description = document.createElement('input');
    description.type = 'text'; description.required = true; description.maxLength = 250;
    description.placeholder = 'Anyag vagy munkadíj';
    description.value = initial.description || '';
    descriptionWrap.append(description);

    const typeWrap = document.createElement('label');
    typeWrap.textContent = 'Típus';
    const type = document.createElement('select');
    [['material','Anyag'],['service','Munkadíj / szolgáltatás'],['travel','Kiszállás'],['other','Egyéb']].forEach(([value,label]) => {
      const option = document.createElement('option'); option.value = value; option.textContent = label; type.append(option);
    });
    type.value = initial.item_type || 'service';
    typeWrap.append(type);

    const quantityWrap = document.createElement('label');
    quantityWrap.textContent = 'Mennyiség';
    const quantity = document.createElement('input');
    quantity.type = 'number'; quantity.min = '0.001'; quantity.step = '0.001'; quantity.value = String(initial.quantity ?? 1); quantity.required = true;
    quantityWrap.append(quantity);

    const priceWrap = document.createElement('label');
    priceWrap.textContent = 'Egységár (Ft)';
    const price = document.createElement('input');
    price.type = 'number'; price.min = '0'; price.step = '1'; price.value = String(initial.unit_net_price ?? 0); price.required = true;
    priceWrap.append(price);

    const remove = document.createElement('button');
    remove.type = 'button'; remove.className = 'secondary'; remove.textContent = '×';
    remove.setAttribute('aria-label', 'Tétel törlése');
    remove.addEventListener('click', () => { row.remove(); updateQuotePreview(); });
    [quantity, price].forEach(input => input.addEventListener('input', updateQuotePreview));
    row.append(descriptionWrap, typeWrap, quantityWrap, priceWrap, remove);
    row._quoteFields = { description, type, quantity, price };
    quoteItems.append(row);
    updateQuotePreview();
  }

  function updateQuotePreview() {
    if (!quoteItems || !quoteTotalPreview) return;
    const total = [...quoteItems.querySelectorAll('.quote-item-row')].reduce((sum, row) => {
      const f = row._quoteFields;
      return sum + Math.round((Number(f.quantity.value) || 0) * (Number(f.price.value) || 0));
    }, 0);
    quoteTotalPreview.textContent = formatHuf(total);
  }

  function quoteStatusLabel(status) {
    return ({draft:'Piszkozat',sent:'Elküldve',accepted:'Elfogadva',rejected:'Elutasítva',expired:'Lejárt',converted:'Munkává alakítva'})[status] || status;
  }

  async function loadQuotes() {
    if (!quoteList) return;
    try {
      const result = await api('/api/quotes');
      quotes = result.items || result.quotes || [];
      renderQuotes();
      clearMessage(quoteListMessage);
    } catch (error) {
      showMessage(quoteListMessage, error.message, 'error');
    }
  }

  function renderQuotes() {
    if (!quoteList) return;
    const query = (quoteSearch?.value || '').toLowerCase().trim();
    const filtered = quotes.filter(q => [q.quote_number, q.customer_name, q.customer_company_name, q.status].join(' ').toLowerCase().includes(query));
    quoteList.innerHTML = '';
    if (!filtered.length) {
      quoteList.textContent = 'Még nincs rögzített árajánlat.';
      return;
    }
    filtered.forEach(q => {
      const card = document.createElement('article');
      card.className = 'item-card';
      const heading = document.createElement('h3');
      heading.textContent = q.quote_number + ' – ' + (q.customer_company_name || q.customer_name || 'Ügyfél');
      const details = document.createElement('p');
      details.textContent = quoteStatusLabel(q.status) + ' · ' + (q.issue_date || '') + ' · AAM';
      const total = document.createElement('p');
      total.textContent = 'Fizetendő: ' + formatHuf(q.gross_total);
      const status = document.createElement('select');
      [['draft','Piszkozat'],['sent','Elküldve'],['accepted','Elfogadva'],['rejected','Elutasítva'],['expired','Lejárt']].forEach(([value,label]) => {
        const option = document.createElement('option'); option.value=value; option.textContent=label; status.append(option);
      });
      status.value = q.status;
      status.addEventListener('change', async () => {
        try {
          await api('/api/quotes/' + encodeURIComponent(q.id), {method:'PUT',body:JSON.stringify({status:status.value})});
          await loadQuotes();
        } catch(error) { showMessage(quoteListMessage,error.message,'error'); status.value=q.status; }
      });
      if (q.status === 'converted') status.disabled = true;
      const statusLabelNode = document.createElement('label');
      statusLabelNode.textContent = 'Státusz'; statusLabelNode.append(status);
      const actions = document.createElement('div');
      actions.className = 'item-actions';
      const editButton = document.createElement('button');
      editButton.type = 'button'; editButton.textContent = 'Szerkesztés';
      editButton.addEventListener('click', () => editQuote(q.id));
      const printButton = document.createElement('button');
      printButton.type = 'button'; printButton.className = 'secondary'; printButton.textContent = 'Nyomtatás / PDF';
      printButton.addEventListener('click', () => printQuote(q.id));
      actions.append(editButton, printButton);
      if (q.status === 'accepted') {
        const convertButton = document.createElement('button');
        convertButton.type = 'button'; convertButton.textContent = 'Munka létrehozása';
        convertButton.addEventListener('click', async () => {
          if (!confirm('Biztosan létrehozod a munkát az elfogadott árajánlat alapján?')) return;
          convertButton.disabled = true;
          try {
            const result = await api('/api/quotes/' + encodeURIComponent(q.id) + '/convert', {method:'POST'});
            showMessage(quoteListMessage, 'Munka létrehozva: ' + result.job_number, 'success');
            await Promise.all([loadQuotes(), loadJobs()]);
          } catch(error) {
            showMessage(quoteListMessage, error.message, 'error');
            convertButton.disabled = false;
          }
        });
        actions.append(convertButton);
      }
      card.append(heading, details, total, statusLabelNode, actions);
      quoteList.append(card);
    });
  }


  async function editQuote(id) {
    try {
      const result = await api('/api/quotes/' + encodeURIComponent(id));
      const quote = result.quote;
      editingQuoteId = id;
      populateQuoteSelectors();
      quoteCustomer.value = quote.customer_id || '';
      quoteLead.value = quote.lead_id || '';
      $('quoteIssueDate').value = quote.issue_date || '';
      $('quoteValidUntil').value = quote.valid_until || '';
      $('quoteNotes').value = quote.notes || '';
      quoteItems.innerHTML = '';
      (result.items || []).forEach(item => addQuoteItemRow(item));
      if (!result.items?.length) addQuoteItemRow();
      $('quoteFormPanel').querySelector('h3').textContent = 'Árajánlat szerkesztése – ' + quote.quote_number;
      $('saveQuoteButton').textContent = 'Módosítások mentése';
      quoteFormPanel.hidden = false;
      quoteFormPanel.scrollIntoView({behavior:'smooth',block:'start'});
    } catch(error) {
      showMessage(quoteListMessage,error.message,'error');
    }
  }

  function escapeQuoteHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }

  async function printQuote(id) {
    try {
      const result = await api('/api/quotes/' + encodeURIComponent(id));
      const q = result.quote;
      const w = window.open('', '_blank');
      if (!w) throw new Error('A felugró ablakot a böngésző letiltotta. Engedélyezd a felugró ablakokat a nyomtatáshoz.');
      const address = [q.postal_code, q.city, q.street_address].filter(Boolean).join(' ');
      const rows = (result.items || []).map(item => `
        <tr><td>${escapeQuoteHtml(item.description)}</td><td>${escapeQuoteHtml(item.quantity)} ${escapeQuoteHtml(item.unit)}</td><td>${formatHuf(item.unit_net_price)}</td><td>${formatHuf(item.line_gross)}</td></tr>
      `).join('');
      w.document.write(`<!doctype html><html lang="hu"><head><meta charset="utf-8"><title>${escapeQuoteHtml(q.quote_number)}</title>
      <style>
      body{font:14px Arial,sans-serif;color:#222;margin:32px}header{display:flex;justify-content:space-between;border-bottom:3px solid #222;padding-bottom:18px}
      h1{font-size:25px;margin:0 0 6px}h2{margin-top:30px;font-size:18px}.muted{color:#666}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin:25px 0}table{width:100%;border-collapse:collapse;margin-top:18px}
      th,td{padding:10px 8px;border-bottom:1px solid #ddd;text-align:left}th{background:#f2f2f2}.right{text-align:right}
      .total{margin:25px 0 0 auto;width:300px;text-align:right;font-size:20px;font-weight:bold}.aam{margin-top:15px;padding:12px;background:#f4f4f4}
      .notes{white-space:pre-wrap;margin-top:25px}.sign{display:grid;grid-template-columns:1fr 1fr;gap:70px;margin-top:85px}.sign div{border-top:1px solid #777;padding-top:8px}
      @media print{body{margin:15mm}.no-print{display:none}}
      </style></head><body>
      <header><div><h1>NEMESVILL</h1><div>Villanyszerelés · Klímaszerelés · EV-töltő telepítés</div><div class="muted">Dunaújváros és környéke</div></div>
      <div style="text-align:right"><h1>ÁRAJÁNLAT</h1><strong>${escapeQuoteHtml(q.quote_number)}</strong><div>Kiállítás: ${escapeQuoteHtml(q.issue_date)}</div><div>Érvényes: ${escapeQuoteHtml(q.valid_until || 'Visszavonásig')}</div></div></header>
      <div class="grid"><section><h2>Ajánlattevő</h2><strong>Nemesvill – Nemes László e.v.</strong><div>Dunaújváros és 30 km-es körzete</div><div class="muted">Web: nemesvill.eu</div></section>
      <section><h2>Megrendelő</h2><strong>${escapeQuoteHtml(q.customer_company_name || q.customer_name)}</strong>
      <div>${escapeQuoteHtml(address)}</div><div>${escapeQuoteHtml(q.customer_email || '')}</div><div>${escapeQuoteHtml(q.customer_phone || '')}</div>
      ${q.tax_number ? '<div>Adószám: '+escapeQuoteHtml(q.tax_number)+'</div>' : ''}</section></div>
      <h2>Ajánlati tételek</h2><table><thead><tr><th>Megnevezés</th><th>Mennyiség</th><th>Egységár</th><th>Összesen</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="aam"><strong>Adózási mód: AAM – alanyi adómentes.</strong><br>Áfa összege: 0 Ft.</div>
      <div class="total">Fizetendő összeg: ${formatHuf(q.gross_total)}</div>
      ${q.notes ? '<div class="notes"><h2>Megjegyzés</h2>'+escapeQuoteHtml(q.notes)+'</div>' : ''}
      <div class="sign"><div>Ajánlattevő aláírása</div><div>Megrendelő aláírása / elfogadása</div></div>
      <p class="muted" style="margin-top:40px">Köszönjük megkeresését!</p><button class="no-print" onclick="window.print()">Nyomtatás / Mentés PDF-ként</button>
      </body></html>`);
      w.document.close();
    } catch(error) {
      showMessage(quoteListMessage,error.message,'error');
    }
  }

  const newQuoteButton = $('newQuoteButton');
  const cancelQuoteButton = $('cancelQuoteButton');
  const addQuoteItemButton = $('addQuoteItemButton');

  if (newQuoteButton) newQuoteButton.addEventListener('click', () => {
    editingQuoteId = null;
    quoteForm?.reset();
    if ($('quoteFormPanel').querySelector('h3')) $('quoteFormPanel').querySelector('h3').textContent = 'Új árajánlat készítése';
    $('saveQuoteButton').textContent = 'Árajánlat mentése';
    if (quoteItems) quoteItems.innerHTML = '';
    populateQuoteSelectors();
    if ($('quoteIssueDate')) $('quoteIssueDate').value = new Date().toISOString().slice(0,10);
    if (quoteFormPanel) quoteFormPanel.hidden = false;
    if (quoteFormMessage) quoteFormMessage.textContent = '';
    addQuoteItemRow();
  });
  if (cancelQuoteButton) cancelQuoteButton.addEventListener('click', () => {
    if (quoteFormPanel) quoteFormPanel.hidden = true;
    quoteForm?.reset();
  });
  if (addQuoteItemButton) addQuoteItemButton.addEventListener('click', addQuoteItemRow);
  if (quoteSearch) quoteSearch.addEventListener('input', renderQuotes);
  if (quoteForm) quoteForm.addEventListener('submit', async event => {
    event.preventDefault();
    const rows = [...quoteItems.querySelectorAll('.quote-item-row')];
    const items = rows.map(row => {
      const f = row._quoteFields;
      return {description:f.description.value.trim(), item_type:f.type.value, quantity:Number(f.quantity.value), unit:'db', unit_net_price:Number(f.price.value)};
    });
    const payload = {
      customer_id: quoteCustomer.value,
      lead_id: quoteLead.value || null,
      issue_date: $('quoteIssueDate').value || null,
      valid_until: $('quoteValidUntil').value || null,
      notes: $('quoteNotes').value.trim(),
      items
    };
    try {
      showMessage(quoteFormMessage, 'Árajánlat mentése...');
      const result = editingQuoteId
        ? await api('/api/quotes/' + encodeURIComponent(editingQuoteId), {method:'PUT',body:JSON.stringify(payload)})
        : await api('/api/quotes', {method:'POST',body:JSON.stringify(payload)});
      showMessage(quoteFormMessage, editingQuoteId ? 'Árajánlat módosítva.' : 'Elmentve: ' + result.quote_number, 'success');
      editingQuoteId = null;
      $('saveQuoteButton').textContent = 'Árajánlat mentése';
      $('quoteFormPanel').querySelector('h3').textContent = 'Új árajánlat készítése';
      quoteForm.reset();
      quoteItems.innerHTML = '';
      if (quoteFormPanel) quoteFormPanel.hidden = true;
      await loadQuotes();
    } catch(error) {
      showMessage(quoteFormMessage, error.message, 'error');
    }
  });

  // INDÍTÁS
  checkSession();
})();

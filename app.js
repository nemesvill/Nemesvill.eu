
document.addEventListener('DOMContentLoaded', ()=>{
  const btn = document.querySelector('#nav-toggle');
  const menu = document.querySelector('#nav-menu');
  if(btn && menu){ btn.addEventListener('click', ()=> menu.classList.toggle('open')); }
});


// Ajánlatkérő űrlap: közvetlen szerveroldali e-mail-küldés a meglévő Resend szolgáltatással.
document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('#quote-request-form');
  const status = document.querySelector('#quote-form-status');
  if (!form || !status) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const submitButton = form.querySelector('button[type="submit"]');
    const data = new FormData(form);
    const payload = Object.fromEntries(
      ['name', 'phone', 'email', 'service', 'location', 'message', 'website']
        .map(key => [key, String(data.get(key) || '').trim()])
    );

    if (submitButton) submitButton.disabled = true;
    status.textContent = 'Ajánlatkérés küldése folyamatban…';
    status.classList.remove('is-error', 'is-success');

    try {
      const response = await fetch('https://crm-api.nemesvill.eu/api/public/quote-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Az ajánlatkérés küldése most nem sikerült. Kérjük, próbálja újra vagy hívjon telefonon.');
      }
      form.reset();
      status.textContent = 'Köszönöm! Az ajánlatkérés sikeresen megérkezett. Hamarosan felveszem Önnel a kapcsolatot.';
      status.classList.add('is-success');
    } catch (error) {
      status.textContent = error.message || 'Hiba történt a küldés során. Kérjük, próbálja újra vagy hívjon telefonon.';
      status.classList.add('is-error');
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
});

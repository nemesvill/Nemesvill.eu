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
      trackGa4('generate_lead', { method: 'quote_form', service: payload.service || 'unspecified' });
    } catch (error) {
      status.textContent = error.message || 'Hiba történt a küldés során. Kérjük, próbálja újra vagy hívjon telefonon.';
      status.classList.add('is-error');
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
});

function trackGa4(eventName, parameters = {}) {
  try {
    const consent = JSON.parse(localStorage.getItem('nemesvill_cookie_consent_v1') || 'null');
    if (!consent || consent.analytics !== true || typeof window.gtag !== 'function') return;
    window.gtag('event', eventName, parameters);
  } catch (error) {
    // A mérés hibája nem befolyásolhatja az oldal működését.
  }
}

document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href]');
  if (!link) return;
  const href = link.getAttribute('href') || '';
  if (href.startsWith('tel:')) {
    trackGa4('click_to_call', { link_url: href });
  } else if (href.startsWith('mailto:')) {
    trackGa4('click_to_email', { link_url: href });
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const key='nemesvill_cookie_consent_v1';
  const measurementId='G-FYRMXKR5MS';
  const banner=document.getElementById('cookie-banner');
  const settings=document.getElementById('cookie-settings');
  if(!banner||!settings)return;

  const read=()=>{try{return JSON.parse(localStorage.getItem(key)||'null')}catch(e){return null}};

  const updateGoogleConsent=(analytics)=>{
    if(typeof window.gtag==='function'){
      window.gtag('consent','update',{
        analytics_storage:analytics?'granted':'denied',
        ad_storage:'denied',
        ad_user_data:'denied',
        ad_personalization:'denied'
      });
    }
  };

  const loadAnalytics=()=>{
    if(window.nemesvillGa4Loaded)return;
    window.nemesvillGa4Loaded=true;
    window.dataLayer=window.dataLayer||[];
    window.gtag=window.gtag||function(){window.dataLayer.push(arguments);};
    window.gtag('consent','default',{
      analytics_storage:'denied',
      ad_storage:'denied',
      ad_user_data:'denied',
      ad_personalization:'denied'
    });
    window.gtag('consent','update',{
      analytics_storage:'granted',
      ad_storage:'denied',
      ad_user_data:'denied',
      ad_personalization:'denied'
    });
    window.gtag('js',new Date());
    window.gtag('config',measurementId);
    const s=document.createElement('script');
    s.async=true;
    s.src='https://www.googletagmanager.com/gtag/js?id='+measurementId;
    document.head.appendChild(s);
  };

  const loadPixel=()=>{
    if(document.querySelector('[data-nemesvill-marketing="openai"]'))return;
    const s=document.createElement('script');s.async=true;s.dataset.nemesvillMarketing='openai';
    s.src='https://bzrcdn.openai.com/sdk/oaiq.min.js';
    s.onload=()=>{if(window.oaiq)window.oaiq('init',{pixelId:'1j4pppdUxbfvLx8CPru2mx'});};
    document.head.appendChild(s);
  };

  const apply=c=>{
    if(c&&c.analytics)loadAnalytics();
    else updateGoogleConsent(false);
    if(c&&c.marketing)loadPixel();
  };

  const save=c=>{
    const v={necessary:true,analytics:!!c.analytics,marketing:!!c.marketing,savedAt:new Date().toISOString()};
    localStorage.setItem(key,JSON.stringify(v));
    banner.hidden=true;
    settings.hidden=true;
    apply(v);
  };

  const current=read();
  if(current){banner.hidden=true;apply(current);}

  document.getElementById('cookie-accept-all')?.addEventListener('click',()=>save({analytics:true,marketing:true}));
  document.getElementById('cookie-necessary')?.addEventListener('click',()=>save({}));
  document.getElementById('cookie-open-settings')?.addEventListener('click',()=>settings.hidden=false);
  document.getElementById('cookie-close-settings')?.addEventListener('click',()=>settings.hidden=true);
  document.getElementById('cookie-save-settings')?.addEventListener('click',()=>save({
    analytics:document.getElementById('cookie-analytics').checked,
    marketing:document.getElementById('cookie-marketing').checked
  }));
  document.querySelectorAll('[data-cookie-settings-open]').forEach(b=>b.addEventListener('click',()=>{
    const c=read();
    document.getElementById('cookie-analytics').checked=!!c?.analytics;
    document.getElementById('cookie-marketing').checked=!!c?.marketing;
    banner.hidden=false;
    settings.hidden=false;
  }));
});

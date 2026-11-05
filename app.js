
document.addEventListener('DOMContentLoaded', ()=>{
  const btn = document.querySelector('#nav-toggle');
  const menu = document.querySelector('#nav-menu');
  if(btn && menu){ btn.addEventListener('click', ()=> menu.classList.toggle('open')); }
});


// Ajánlatkérő űrlap: az adatokat nem tárolja, e-mail piszkozatot készít.
document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('#quote-request-form');
  const status = document.querySelector('#quote-form-status');
  if (!form) return;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const data = new FormData(form);
    const fields = [
      ['Név', data.get('name')],
      ['Telefonszám', data.get('phone')],
      ['E-mail', data.get('email') || 'Nem adta meg'],
      ['Szolgáltatás', data.get('service')],
      ['Település', data.get('location') || 'Nem adta meg'],
      ['Leírás', data.get('message')]
    ];
    const body = fields.map(([label, value]) => label + ':\n' + String(value).trim()).join('\n\n');
    const subject = 'Ajánlatkérés – ' + String(data.get('service'));
    const mailto = 'mailto:nemesvillany@gmail.com?subject=' +
      encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);

    status.textContent = 'Megnyitjuk a levelezőprogramot az előkészített ajánlatkéréssel. Az üzenetet ott tudja ellenőrizni és elküldeni.';
    window.location.href = mailto;
  });
});

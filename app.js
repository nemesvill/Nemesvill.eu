
document.addEventListener('DOMContentLoaded', ()=>{
  const btn = document.querySelector('#nav-toggle');
  const menu = document.querySelector('#nav-menu');
  if(btn && menu){ btn.addEventListener('click', ()=> menu.classList.toggle('open')); }
});

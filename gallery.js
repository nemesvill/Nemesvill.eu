(async function(){
 const API='https://api.nemesvill.eu';
 const labels={villanyszereles:'Referenciák – villanyszerelés',klimaszereles:'Referenciák – klímaszerelés','ev-toltok':'Referenciák – EV-töltők'};
 for(const el of document.querySelectorAll('[data-nemesvill-gallery]')){
  const category=el.dataset.nemesvillGallery;
  try{const r=await fetch(API+'/api/gallery?category='+encodeURIComponent(category));if(!r.ok)continue;const d=await r.json();if(!d.items?.length)continue;
   const section=document.createElement('section');section.className='section nv-gallery';const wrap=document.createElement('div');wrap.className='container';const h=document.createElement('h2');h.textContent=labels[category]||'Referenciák';const grid=document.createElement('div');grid.className='nv-gallery-grid';
   for(const item of d.items){const figure=document.createElement('figure');figure.className='nv-gallery-item';const a=document.createElement('a');a.href=item.url;a.target='_blank';a.rel='noopener';const img=document.createElement('img');img.src=item.url;img.alt=item.name||labels[category];img.loading='lazy';a.append(img);figure.append(a);if(item.name){const cap=document.createElement('figcaption');cap.textContent=item.name;figure.append(cap)}grid.append(figure)}wrap.append(h,grid);section.append(wrap);el.replaceWith(section);
  }catch(e){console.warn('Nemesvill galéria nem tölthető be.',e)}
 }
})();

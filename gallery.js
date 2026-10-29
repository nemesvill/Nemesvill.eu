(async function () {
  'use strict';

  const API = 'https://api.nemesvill.eu';
  const labels = {
    villanyszereles: 'Referenciák – villanyszerelés',
    klimaszereles: 'Referenciák – klímaszerelés',
    'ev-toltok': 'Referenciák – EV-töltők'
  };
  const genericCaptions = {
    villanyszereles: 'Villanyszerelési referencia',
    klimaszereles: 'Klímaszerelési referencia',
    'ev-toltok': 'EV-töltő telepítési referencia'
  };

  function cleanCaption(name, category) {
    if (!name) return genericCaptions[category] || 'Referencia';
    const cleaned = String(name).replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[_-]+/g, ' ').trim();
    // The uploader generates timestamp/UUID-style filenames; show a readable caption instead.
    if (/^\d{10,}/.test(cleaned) || /^[0-9a-f]{8}-[0-9a-f-]{20,}$/i.test(cleaned)) {
      return genericCaptions[category] || 'Referencia';
    }
    return cleaned || genericCaptions[category] || 'Referencia';
  }

  function ensureLightbox() {
    let overlay = document.querySelector('.nv-gallery-lightbox');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.className = 'nv-gallery-lightbox';
    overlay.hidden = true;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Referencia kép nagy méretben');

    const close = document.createElement('button');
    close.className = 'nv-gallery-lightbox-close';
    close.type = 'button';
    close.setAttribute('aria-label', 'Bezárás');
    close.textContent = '×';

    const inner = document.createElement('div');
    inner.className = 'nv-gallery-lightbox-inner';

    const image = document.createElement('img');
    image.alt = '';

    const caption = document.createElement('div');
    caption.className = 'nv-gallery-lightbox-caption';

    inner.append(image, caption);
    overlay.append(close, inner);
    document.body.append(overlay);

    function hide() {
      overlay.hidden = true;
      document.body.style.overflow = '';
    }
    close.addEventListener('click', hide);
    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) hide();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !overlay.hidden) hide();
    });
    overlay._showImage = function (src, alt, text) {
      image.src = src;
      image.alt = alt || '';
      caption.textContent = text || '';
      overlay.hidden = false;
      document.body.style.overflow = 'hidden';
      close.focus();
    };
    return overlay;
  }

  const galleryElements = document.querySelectorAll('[data-nemesvill-gallery]');
  for (const el of galleryElements) {
    const category = el.dataset.nemesvillGallery;
    try {
      const response = await fetch(API + '/api/gallery?category=' + encodeURIComponent(category));
      if (!response.ok) continue;
      const data = await response.json();
      if (!Array.isArray(data.items) || data.items.length === 0) continue;

      const section = document.createElement('section');
      section.className = 'section nv-gallery';

      const wrap = document.createElement('div');
      wrap.className = 'container';

      const heading = document.createElement('h2');
      heading.textContent = labels[category] || 'Referenciák';

      const grid = document.createElement('div');
      grid.className = 'nv-gallery-grid';

      for (const item of data.items) {
        if (!item || !item.url) continue;
        const captionText = cleanCaption(item.name, category);

        const figure = document.createElement('figure');
        figure.className = 'nv-gallery-item';

        const link = document.createElement('a');
        link.href = item.url;
        link.setAttribute('aria-label', captionText + ' – nagyítás');

        const img = document.createElement('img');
        img.src = item.url;
        img.alt = captionText;
        img.loading = 'lazy';
        img.decoding = 'async';

        link.append(img);
        link.addEventListener('click', function (event) {
          event.preventDefault();
          ensureLightbox()._showImage(item.url, captionText, captionText);
        });

        const caption = document.createElement('figcaption');
        caption.textContent = captionText;

        figure.append(link, caption);
        grid.append(figure);
      }

      if (!grid.children.length) continue;
      wrap.append(heading, grid);
      section.append(wrap);
      el.replaceWith(section);
    } catch (error) {
      console.warn('A Nemesvill galéria nem tölthető be.', error);
    }
  }
})();

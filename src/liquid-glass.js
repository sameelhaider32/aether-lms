/* Liquid glass for Aether Original. Each outer glass tile gets a backdrop filter that bends what is
   behind it near its edges, the way a thick rounded lens does, so the tile changes as the galaxy,
   the stars and the page move underneath it. The bend comes from a displacement map drawn once per
   tile size and shape (cached), referenced from an inline SVG filter. Nothing is fetched; when
   transparency is reduced, Aether is off, or another appearance is chosen, everything is removed
   and the static glass in original.css remains. */
(() => {
  'use strict';
  if (window !== top || globalThis.AetherLiquidGlass) return;
  const root = document.documentElement, NS = 'http://www.w3.org/2000/svg';
  const SELECTOR = [
    '#aether-workspace .ae-course-card', '#aether-workspace .ae-hero:not(.ae-hero-home)',
    '#aether-workspace .ae-hero-home .ae-instrument', '#aether-workspace .ae-hero .ae-hero-actions>:not(:first-child)',
    '#aether-workspace .ae-hero .ae-dl-global', '#aether-mission-control .mc-panel', '#aether-mission-control .mc-summary',
    'main#content div.Mrphs-container', '.am-section', '.am-more-menu'
  ].join(',');
  const reduced = matchMedia('(prefers-reduced-transparency: reduce)');
  const active = () => root.classList.contains('aether-enabled') && root.dataset.aetherTheme === 'aether' && !reduced.matches;
  const maps = new Map();
  let sizes = new WeakSet();
  let svg = null, sheet = null, resize = null, watch = null, timer = 0, running = false;

  /* The map: red and green encode a sideways and vertical shift (128 = none). Inside a band along
     the rounded edge each pixel samples from further inside, following a circular lens profile, so
     the rim compresses the background the way the edge of real glass does. Drawn at half size and
     stretched; the field is smooth, so nothing is lost. */
  function draw(w, h, r) {
    const s = .5, cw = Math.max(2, Math.round(w * s)), ch = Math.max(2, Math.round(h * s));
    const canvas = document.createElement('canvas'); canvas.width = cw; canvas.height = ch;
    const ctx = canvas.getContext('2d'), img = ctx.createImageData(cw, ch), d = img.data;
    const band = Math.min(26, Math.min(w, h) * .32), hx = w / 2, hy = h / 2, rad = Math.min(r, hx, hy);
    for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
      const px = (i + .5) / s - hx, py = (j + .5) / s - hy, ax = Math.abs(px), ay = Math.abs(py);
      const qx = ax - (hx - rad), qy = ay - (hy - rad);
      let depth, nx, ny;
      if (qx > 0 && qy > 0) { const l = Math.hypot(qx, qy) || 1; depth = rad - l; nx = qx / l; ny = qy / l; }
      else if (qx > qy) { depth = hx - ax; nx = 1; ny = 0; }
      else { depth = hy - ay; nx = 0; ny = 1; }
      let x = 128, y = 128;
      if (depth < band) {
        const t = 1 - Math.max(0, depth) / band, m = 1 - Math.sqrt(Math.max(0, 1 - t * t));
        x = 128 - Math.sign(px) * nx * m * 127; y = 128 - Math.sign(py) * ny * m * 127;
      }
      const k = (j * cw + i) * 4; d[k] = x; d[k + 1] = y; d[k + 2] = 128; d[k + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL();
  }

  function filterFor(w, h, r) {
    const key = `${w}x${h}r${r}`;
    if (maps.has(key)) return key;
    const id = 'ae-lg-' + maps.size, f = document.createElementNS(NS, 'filter');
    for (const [k, v] of Object.entries({ id, x: 0, y: 0, width: w, height: h, filterUnits: 'userSpaceOnUse', primitiveUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB' })) f.setAttribute(k, v);
    const image = document.createElementNS(NS, 'feImage');
    for (const [k, v] of Object.entries({ href: draw(w, h, r), x: 0, y: 0, width: w, height: h, preserveAspectRatio: 'none', result: 'lens' })) image.setAttribute(k, v);
    const shift = document.createElementNS(NS, 'feDisplacementMap');
    for (const [k, v] of Object.entries({ in: 'SourceGraphic', in2: 'lens', scale: Math.min(48, Math.min(w, h) * .4), xChannelSelector: 'R', yChannelSelector: 'G' })) shift.setAttribute(k, v);
    f.append(image, shift); svg.firstChild.append(f);
    maps.set(key, id);
    sheet.textContent += `[data-ae-liquid="${key}"]{--ae-liquid:url(#${id})}\n`;
    return key;
  }

  function fit(el) {
    const w = Math.round(el.offsetWidth / 4) * 4, h = Math.round(el.offsetHeight / 4) * 4;
    if (w < 24 || h < 24) return;
    const r = Math.round(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0);
    const key = filterFor(w, h, r);
    if (el.dataset.aeLiquid !== key) el.dataset.aeLiquid = key;
    el.dataset.aeLiquidSize = w * h > 160000 ? 'large' : 'small';
  }

  function scan() {
    timer = 0; if (!running) return;
    for (const el of document.querySelectorAll(SELECTOR)) if (!sizes.has(el)) { sizes.add(el); resize.observe(el); }
  }

  function start() {
    if (running || !document.body) return; running = true;
    svg = document.createElementNS(NS, 'svg'); svg.setAttribute('aria-hidden', 'true'); svg.id = 'aether-liquid-glass';
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
    svg.append(document.createElementNS(NS, 'defs')); document.body.append(svg);
    sheet = document.createElement('style'); sheet.id = 'aether-liquid-glass-maps'; document.head.append(sheet);
    resize = new ResizeObserver(entries => { for (const e of entries) if (e.target.isConnected) fit(e.target); });
    watch = new MutationObserver(() => { if (!timer) timer = setTimeout(scan, 160); });
    watch.observe(document.body, { childList: true, subtree: true });
    scan();
  }

  function stop() {
    if (!running) return; running = false; clearTimeout(timer); timer = 0;
    resize.disconnect(); watch.disconnect();
    for (const el of document.querySelectorAll('[data-ae-liquid]')) { delete el.dataset.aeLiquid; delete el.dataset.aeLiquidSize; }
    svg.remove(); sheet.remove(); svg = sheet = resize = watch = null; maps.clear(); sizes = new WeakSet();
  }

  function sync() { active() ? start() : stop(); }
  const state = new MutationObserver(sync);
  state.observe(root, { attributes: true, attributeFilter: ['class', 'data-aether-theme'] });
  reduced.addEventListener('change', sync);
  if (document.body) sync(); else document.addEventListener('DOMContentLoaded', sync, { once: true });
  window.addEventListener('pagehide', e => { if (e.persisted) return; state.disconnect(); reduced.removeEventListener('change', sync); stop(); });
  globalThis.AetherLiquidGlass = { stats: () => ({ running, filters: maps.size, tiles: document.querySelectorAll('[data-ae-liquid]').length }) };
})();

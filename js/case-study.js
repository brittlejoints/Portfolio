/* ==========================================================================
   Case studies (tap-talk.html, disability-check.html)
     1. Blended zone background
     2. Scroll reveals
     3. Section rail (Tap Talk)
     4. Count-up numbers (Tap Talk)
     5. 100-dot chart (Disability Check)
   Each feature checks its elements exist, so one file serves both pages.
   ========================================================================== */
(function () {
  'use strict';

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.getElementById('cs');
  if (!root) return;

  /* ---------------------------------------------------------------- 1 ---
     Sections are tagged data-zone="dark|light|warm". We paint one tall
     gradient behind the whole page: each colour holds until ~210px before
     the next section, then blends into it over ~266px. The colours come
     from the --zone-* custom properties in case-study.css. */
  function setupZones() {
    const bg = document.getElementById('cs-bg');
    if (!bg) return;
    const UP = 210, DOWN = 56;
    const blocks = Array.from(root.querySelectorAll('[data-zone]'));
    const colour = { dark: 'var(--zone-dark)', light: 'var(--zone-light)', warm: 'var(--zone-warm)' };
    const build = () => {
      const rootTop = root.getBoundingClientRect().top + window.scrollY;
      const total = root.offsetHeight;
      if (!total || !blocks.length) return;
      const zones = blocks.map((el) => ({ c: colour[el.dataset.zone], top: el.getBoundingClientRect().top + window.scrollY - rootTop }));
      const stops = [zones[0].c + ' 0px'];
      for (let i = 1; i < zones.length; i++) {
        if (zones[i].c === zones[i - 1].c) continue;
        const y = zones[i].top;
        stops.push(zones[i - 1].c + ' ' + Math.round(Math.max(0, y - UP)) + 'px');
        stops.push(zones[i].c + ' ' + Math.round(Math.min(total, y + DOWN)) + 'px');
      }
      stops.push(zones[zones.length - 1].c + ' ' + Math.round(total) + 'px');
      bg.style.background = 'linear-gradient(180deg, ' + stops.join(', ') + ')';
    };
    const rebuild = () => requestAnimationFrame(build);
    window.addEventListener('resize', rebuild);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(rebuild);
    root.querySelectorAll('img').forEach((img) => { if (!img.complete) img.addEventListener('load', rebuild, { once: true }); });
    // Section heights change as reveals and lazy images settle
    if ('ResizeObserver' in window) new ResizeObserver(rebuild).observe(root);
    build();
  }

  /* ---------------------------------------------------------------- 2 --- */
  function setupReveals() {
    const items = root.querySelectorAll('[data-reveal]');
    if (!('IntersectionObserver' in window)) { items.forEach((el) => el.classList.add('is-in')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add('is-in'); io.unobserve(entry.target); }
      });
    }, { threshold: 0.12 });
    items.forEach((el) => io.observe(el));
  }

  /* ---------------------------------------------------------------- 3 ---
     Fixed list of sections on the left (≥1180px). Appears after the hero,
     highlights the section you're reading, and the thin line fills with
     overall scroll progress. Hover or focus to see the labels. */
  function setupRail() {
    const rail = document.getElementById('cs-rail');
    if (!rail) return;
    const fill = document.getElementById('cs-rail-fill');
    const buttons = Array.from(rail.querySelectorAll('[data-rail]'));
    const hero = document.getElementById('cs-overview');
    buttons.forEach((btn) => btn.addEventListener('click', () => {
      const el = document.getElementById(btn.dataset.rail);
      if (!el) return;
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 24, behavior: reducedMotion ? 'auto' : 'smooth' });
    }));
    let ticking = false;
    const update = () => {
      ticking = false;
      const past = hero ? hero.getBoundingClientRect().bottom < window.innerHeight * 0.5 : window.scrollY > 200;
      rail.classList.toggle('is-visible', past);
      if (!past && rail.contains(document.activeElement)) document.activeElement.blur();
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      if (fill) fill.style.transform = 'scaleY(' + Math.min(1, Math.max(0, window.scrollY / max)) + ')';
      const line = window.innerHeight * 0.4;
      let active = buttons[0];
      buttons.forEach((btn) => {
        const s = document.getElementById(btn.dataset.rail);
        if (s && s.getBoundingClientRect().top <= line) active = btn;
      });
      buttons.forEach((btn) => btn.setAttribute('aria-current', String(btn === active)));
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  }

  /* ---------------------------------------------------------------- 4 ---
     Numbers count up once when they come into view. The final value is
     already in the HTML, so without JS (or with reduced motion) it simply shows. */
  function setupCounters() {
    const nodes = root.querySelectorAll('[data-count]');
    if (!nodes.length || reducedMotion || !('IntersectionObserver' in window)) return;
    const run = (el) => {
      const to = parseFloat(el.dataset.count);
      const dec = parseInt(el.dataset.countDecimals || '0', 10);
      const pre = el.dataset.countPrefix || '', suf = el.dataset.countSuffix || '';
      const start = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - start) / 1100);
        el.textContent = pre + (to * (1 - Math.pow(1 - t, 3))).toFixed(dec) + suf;  // ease-out cubic
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => { if (entry.isIntersecting) { run(entry.target); io.unobserve(entry.target); } });
    }, { threshold: 0.6 });
    nodes.forEach((el) => io.observe(el));
  }

  /* ---------------------------------------------------------------- 5 ---
     Builds the 100 dots from three numbers, so the chart can't drift out
     of sync with the copy: change data-working / data-wanting to update it. */
  function setupDots() {
    root.querySelectorAll('.dc-dots').forEach((box) => {
      const total = +box.dataset.total || 100, wanting = +box.dataset.wanting, working = +box.dataset.working;
      const frag = document.createDocumentFragment();
      for (let i = 0; i < total; i++) {
        const s = document.createElement('span');
        s.className = i < working ? 'is-working' : i < wanting ? 'is-wanting' : 'is-other';
        frag.appendChild(s);
      }
      box.appendChild(frag);
    });
  }

  setupDots();
  setupZones();
  setupReveals();
  setupRail();
  setupCounters();
})();

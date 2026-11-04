/* ==========================================================================
   Books page (books.html)
     1. Book tabs
     2. The Brittle Joints flipbook: drag, click, arrow keys, tilt and zoom
   ========================================================================== */
(function () {
  'use strict';

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------- 1 --- */
  const tabs = Array.from(document.querySelectorAll('.bk-tabs [role="tab"]'));
  let activeBook = 0;
  const selectBook = (i, focus) => {
    activeBook = i;
    tabs.forEach((t, k) => {
      const on = k === i;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
    if (focus) tabs[i].focus();
    if (i === 0) flip.layout();      // the book was hidden; re-measure it
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => selectBook(i));
    t.addEventListener('keydown', (e) => {
      let k = i;
      if (e.key === 'ArrowRight') k = (i + 1) % tabs.length;
      else if (e.key === 'ArrowLeft') k = (i + tabs.length - 1) % tabs.length;
      else if (e.key === 'Home') k = 0;
      else if (e.key === 'End') k = tabs.length - 1;
      else return;
      e.preventDefault(); e.stopPropagation();
      selectBook(k, true);
    });
  });

  /* ---------------------------------------------------------------- 2 ---
     Each "spread" is what you see with the book open: a left and a right
     page. Covers are a single page (solo). */
  const B = 'assets/img/books/';
  const SPREADS = [
    { left: null, right: B + 'brittle-joints-cover.jpg', title: 'Cover', solo: true },
    { left: B + 'bj-01.jpg', right: B + 'bj-02.jpg', title: 'Interior spread' },
    { left: B + 'bj-03.jpg', right: B + 'bj-04.jpg', title: 'Interior spread' },
    { left: B + 'bj-05.jpg', right: B + 'bj-06.jpg', title: 'Interior spread' },
    { left: B + 'bj-07.jpg', right: B + 'bj-08.jpg', title: 'Interior spread' },
    { left: null, right: B + 'brittle-joints-back.jpg', title: 'Back cover', solo: true },
  ];
  const N = 18;       // strips per turning page
  const BETA = 0.60;  // how far the paper curls at mid-turn (radians)

  const root = document.getElementById('bk');
  const el = {
    stage: root.querySelector('[data-stage]'),
    sb3d: root.querySelector('[data-3d]'),
    book: root.querySelector('[data-book]'),
    caps: root.querySelector('[data-captions]'),
    live: root.querySelector('[data-live]'),
    hint: root.querySelector('[data-hint]'),
    zRead: root.querySelector('[data-zread]'),
  };

  const flip = {
    idx: 0,           // spread on show
    turn: null,       // { dir, from, to, t } while a page is moving; t goes 0 → 1
    strips: [],
    spring: null,
    raf: null,
    drag: null,
    view: { rx: 0, ry: 0, z: 1, trx: 0, try_: 0, tz: 1 },  // current and target tilt/zoom
    viewActive: false,
    announced: undefined,
    capOut: null, capIn: null,
    layout() {
      const bw = el.book.clientWidth;
      if (bw) el.sb3d.style.setProperty('--sw', (bw * 0.5 / N) + 'px');
    },
  };

  const mk = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };

  // Slice one page image across a box that is `k` strips wide, `off` strips in
  function dress(node, url, k, off, total) {
    if (!url) { node.style.backgroundImage = 'none'; return; }
    node.style.backgroundImage = 'url("' + url + '")';
    node.style.backgroundSize = (100 * total / k).toFixed(3) + '% 100%';
    const denom = total / k - 1;
    node.style.backgroundPositionX = (denom <= 0 ? 0 : ((off / k) / denom) * 100).toFixed(3) + '%';
    node.style.backgroundPositionY = '0%';
  }

  function half(pos, url) {
    const d = mk('div', 'sb-half ' + pos);
    dress(d, url, 1, 0, 1);
    d.appendChild(mk('div', 'gutter-shade ' + pos));
    return d;
  }

  // The turning page: N nested strips, each a front and back face
  function buildCurl(dir, from, to) {
    flip.strips = [];
    const c = mk('div', 'curl ' + dir);
    const A = SPREADS[from], Bs = SPREADS[to];
    const frontUrl = dir === 'next' ? A.right : A.left;
    const backUrl = dir === 'next' ? Bs.left : Bs.right;
    let host = c;
    for (let i = 0; i < N; i++) {
      const s = mk('div', 'strip');
      const f = mk('div', 'face front');
      const b = mk('div', 'face back');
      const nearGutter = dir === 'next';
      dress(f, frontUrl, 1, nearGutter ? i : (N - 1 - i), N);
      dress(b, backUrl, 1, nearGutter ? (N - 1 - i) : i, N);
      f.append(mk('div', 'sh'), mk('div', 'gl'));
      b.append(mk('div', 'sh'), mk('div', 'gl'));
      s.append(f, b);
      host.appendChild(s); host = s;
      flip.strips.push(s);
    }
    return c;
  }

  function paint() {
    const book = el.book;
    book.textContent = '';
    if (!flip.turn) {
      const s = SPREADS[flip.idx];
      book.classList.toggle('solo', !!s.solo);
      if (!s.solo) book.appendChild(half('left', s.left));
      book.appendChild(half('right', s.right));
      el.sb3d.style.setProperty('--shade', '0');
    } else {
      book.classList.remove('solo');
      const next = flip.turn.dir === 'next';
      const A = SPREADS[flip.turn.from], Bs = SPREADS[flip.turn.to];
      book.appendChild(half('left', next ? A.left : Bs.left));
      book.appendChild(half('right', next ? Bs.right : A.right));
      book.appendChild(buildCurl(flip.turn.dir, flip.turn.from, flip.turn.to));
    }
    book.appendChild(mk('div', 'gutter'));
    const a = mk('div', 'sb-zone sb-prev'), b = mk('div', 'sb-zone sb-next');
    a.setAttribute('aria-hidden', 'true'); b.setAttribute('aria-hidden', 'true');
    book.append(a, b);
    flip.layout();
    if (flip.turn) applyTurn(flip.turn.t);
    else {
      const msg = 'Brittle Joints preview, ' + SPREADS[flip.idx].title.toLowerCase() + ', spread ' + (flip.idx + 1) + ' of ' + SPREADS.length;
      book.setAttribute('role', 'img');
      book.setAttribute('aria-label', msg);
      if (flip.announced !== undefined && flip.announced !== flip.idx) el.live.textContent = msg;
      flip.announced = flip.idx;
    }
    caption();
  }

  // Bend the page for progress t (0 = flat on the right, 1 = flat on the left)
  function applyTurn(t) {
    const th = Math.PI * t;
    const beta = BETA * Math.sin(Math.PI * t);
    const D = 180 / Math.PI;
    const tt = th + beta, td = 2 * beta / N;
    el.sb3d.style.setProperty('--tt', (tt * D).toFixed(2) + 'deg');
    el.sb3d.style.setProperty('--td', (td * D).toFixed(3) + 'deg');
    el.sb3d.style.setProperty('--shade', Math.sin(Math.PI * t).toFixed(3));
    fadeCaption(t);
    // Each strip is shaded by how directly it faces the light
    for (let i = 0; i < flip.strips.length; i++) {
      const l1 = Math.abs(Math.cos(tt - i * td));
      const l2 = Math.abs(Math.cos(tt - (i + 1) * td));
      const st = flip.strips[i].style;
      st.setProperty('--lit', l1.toFixed(3));
      st.setProperty('--a1', ((1 - l1) * 0.62).toFixed(3));
      st.setProperty('--a2', ((1 - l2) * 0.62).toFixed(3));
    }
  }

  // Caption under the book cross-fades between the old and new spread names
  function caption() {
    const box = el.caps;
    box.textContent = '';
    flip.capOut = flip.capIn = null;
    if (flip.turn) {
      const o = mk('p', 'sb-caption is-live'); o.textContent = SPREADS[flip.turn.from].title;
      const n = mk('p', 'sb-caption is-live'); n.textContent = SPREADS[flip.turn.to].title;
      box.append(o, n);
      flip.capOut = o; flip.capIn = n;
      fadeCaption(flip.turn.t);
    } else {
      const p = mk('p', 'sb-caption'); p.textContent = SPREADS[flip.idx].title;
      box.appendChild(p);
    }
  }
  function fadeCaption(t) {
    if (!flip.capOut) return;
    flip.capOut.style.opacity = (1 - Math.max(0, Math.min(1, (t - 0.10) / 0.28))).toFixed(3);
    flip.capIn.style.opacity = Math.max(0, Math.min(1, (t - 0.56) / 0.30)).toFixed(3);
  }

  /* ---- animation loop: a spring for the page, easing for tilt/zoom ---- */
  let last = 0;
  const kick = () => { if (flip.raf === null) { last = performance.now(); flip.raf = requestAnimationFrame(tick); } };
  function tick(now) {
    flip.raf = null;
    const dt = Math.min(0.032, (now - last) / 1000 || 0.016);
    last = now;
    if (flip.spring && flip.turn) {
      const s = flip.spring;
      s.v += (-s.k * (flip.turn.t - s.target) - s.c * s.v) * dt;
      flip.turn.t += s.v * dt;
      if (Math.abs(flip.turn.t - s.target) < 0.002 && Math.abs(s.v) < 0.02) {
        flip.turn.t = s.target; flip.spring = null; applyTurn(flip.turn.t);
        if (s.done) s.done();
      } else applyTurn(flip.turn.t);
    }
    viewSpring();
    if ((flip.spring || flip.viewActive) && flip.raf === null) flip.raf = requestAnimationFrame(tick);
  }
  const animateTo = (target, done, k, c) => { flip.spring = { v: 0, target, done, k: k || 170, c: c || 26 }; kick(); };

  function applyView() {
    el.sb3d.style.setProperty('--rx', flip.view.rx.toFixed(2) + 'deg');
    el.sb3d.style.setProperty('--ry', flip.view.ry.toFixed(2) + 'deg');
    el.sb3d.style.setProperty('--zoom', flip.view.z.toFixed(3));
  }
  function viewSpring() {
    const v = flip.view; let moved = false;
    [['rx', 'trx'], ['ry', 'try_'], ['z', 'tz']].forEach(([k, t]) => {
      const d = v[t] - v[k];
      if (Math.abs(d) > 0.0006) { v[k] += d * 0.14; moved = true; } else v[k] = v[t];
    });
    if (moved) applyView();
    flip.viewActive = moved;
  }
  function setView(rx, ry, z) {
    flip.view.trx = Math.max(-4.5, Math.min(4.5, rx));
    flip.view.try_ = Math.max(-7, Math.min(7, ry));
    flip.view.tz = Math.max(0.9, Math.min(1.5, z));
    if (reducedMotion) { Object.assign(flip.view, { rx: 0, ry: 0, z: flip.view.tz }); applyView(); }
    else { flip.viewActive = true; kick(); }
    el.zRead.textContent = Math.round(flip.view.tz * 100) + '%';
  }

  /* ---- turning ---- */
  const M = SPREADS.length;
  function startTurn(dir, t) {
    flip.spring = null;
    if (flip.turn) { flip.idx = flip.turn.to; flip.turn = null; }
    const from = flip.idx;
    flip.turn = { dir, from, to: dir === 'next' ? (from + 1) % M : (from - 1 + M) % M, t: t || 0 };
    paint();
  }
  function commit() {
    if (!flip.turn) return;
    const finish = () => { flip.idx = flip.turn.to; flip.turn = null; paint(); };
    if (reducedMotion) { finish(); return; }
    animateTo(1, finish, 170, 26);
  }
  function cancel() {
    if (!flip.turn) return;
    animateTo(0, () => { flip.turn = null; paint(); }, 150, 24);
  }
  function step(dir) {
    if (flip.turn) { flip.idx = flip.turn.to; flip.turn = null; }
    startTurn(dir, 0);
    commit();
  }
  const hideHint = () => { el.hint.style.opacity = '0'; };

  /* ---- input ---- */
  window.addEventListener('resize', () => flip.layout());

  // The book leans toward the mouse
  window.addEventListener('pointermove', (e) => {
    if (reducedMotion || e.pointerType === 'touch' || flip.drag || activeBook !== 0) return;
    const r = el.book.getBoundingClientRect();
    if (!r.width) return;
    const nx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width * 0.62)));
    const ny = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height * 0.9)));
    setView(-ny * 4.5, nx * 7, flip.view.tz);
  }, { passive: true });

  // Left/right arrow keys turn pages while the book is on screen
  window.addEventListener('keydown', (e) => {
    if (activeBook !== 0 || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable || t.getAttribute('role') === 'tab')) return;
    const r = el.stage.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) return;
    e.preventDefault();
    hideHint();
    step(e.key === 'ArrowRight' ? 'next' : 'prev');
  });

  // Drag a page: grab either half and pull it across the spine
  const st = el.stage;
  st.addEventListener('dragstart', (e) => e.preventDefault());
  st.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    hideHint();
    const zone = e.target.closest('.sb-zone');
    if (!zone) return;
    e.preventDefault();
    st.setPointerCapture(e.pointerId);
    const r = el.book.getBoundingClientRect();
    const dir = (e.clientX - r.left) / r.width > 0.5 ? 'next' : 'prev';
    startTurn(dir, 0);
    flip.drag = { dir, x0: e.clientX, w: r.width, moved: 0, vel: 0, tPrev: performance.now() };
  });
  st.addEventListener('pointermove', (e) => {
    const d = flip.drag;
    if (!d) return;
    const dx = e.clientX - d.x0;
    d.moved = Math.max(d.moved, Math.abs(dx));
    const t = Math.max(0, Math.min(1, (d.dir === 'next' ? -dx : dx) / (d.w * 0.62)));
    const now = performance.now();
    d.vel = (t - (flip.turn ? flip.turn.t : 0)) / Math.max(0.001, (now - d.tPrev) / 1000);
    d.tPrev = now;
    if (flip.turn) { flip.turn.t = t; applyTurn(t); }
  });
  const end = () => {
    const d = flip.drag;
    if (!d) return;
    flip.drag = null;
    if (!flip.turn) return;
    if (d.moved < 6) { commit(); return; }                       // a click turns the page
    if (flip.turn.t > 0.42 || d.vel > 1.1) commit(); else cancel(); // a flick or past halfway commits
  };
  st.addEventListener('pointerup', end);
  st.addEventListener('pointercancel', end);
  st.addEventListener('dblclick', () => setView(flip.view.trx, flip.view.try_, 1));

  root.querySelectorAll('[data-arrow]').forEach((b) => b.addEventListener('click', () => { hideHint(); step(b.dataset.arrow); }));
  root.querySelectorAll('[data-tool]').forEach((b) => b.addEventListener('click', () => {
    hideHint();
    setView(flip.view.trx, flip.view.try_, b.dataset.tool === 'in' ? flip.view.tz * 1.16 : flip.view.tz / 1.16);
  }));

  paint();
  applyView();
})();

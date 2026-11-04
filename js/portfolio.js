/* ==========================================================================
   Portfolio interactions (index.html)
   Plain JavaScript, no framework. Each feature is its own small function,
   called once at the bottom of the file. Read top to bottom:

     1. Smooth scrolling (Lenis)          7. Service tabs
     2. Loading screen: ink handwriting   8. Envelope of polaroids
     3. Hero video scrub                  9. Copy email + back to top
     4. Nav colour over the hero         10. Banker's lamp easter egg
     5. Nav "you are here" pill          11. Light / dark theme
     6. Mobile menu                      12. Scroll reveals + portrait tilt
   ========================================================================== */
(function () {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer: fine)').matches;

  /* ---------------------------------------------------------------- 1 ---
     Smooth wheel scrolling. Skipped for reduced motion. */
  function setupLenis() {
    if (reducedMotion || !window.Lenis) return;
    const lenis = new window.Lenis({ duration: 1.1, smoothWheel: true, easing: (t) => 1 - Math.pow(1 - t, 3) });
    const raf = (time) => { lenis.raf(time); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
    // Anchor links (#pf-work etc.) scroll smoothly too
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const target = document.getElementById(a.getAttribute('href').slice(1));
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target);
      history.replaceState(null, '', a.getAttribute('href'));
      if (target.id === 'pf-main' || target.tabIndex >= 0) target.focus({ preventScroll: true });
    });
    window.__lenis = lenis;
  }

  /* ---------------------------------------------------------------- 2 ---
     Loading screen. The wordmark is a drawn PNG, so it can't be "stroked".
     Instead: an invisible pen path (#pf-pen-word) is swept along the letters,
     and every ink pixel gets a timestamp for when the pen reaches it. The
     canvas then reveals pixels in that order, so the name appears to be
     written by hand while the letterforms stay exactly as drawn. */
  function setupLoader() {
    const loader = $('#pf-loader');
    const canvas = $('#pf-ink');
    const wordEl = $('#pf-pen-word');
    const dotEl = $('#pf-pen-dot');
    if (!loader || !canvas || !wordEl) return;

    const hide = () => {
      loader.classList.add('is-done');
      setTimeout(() => { loader.style.visibility = 'hidden'; }, 700);
    };

    const ctx = canvas.getContext('2d');
    const W = 945, H = 94, S = 2;               // artwork size, drawn at 2x
    const DUR = reducedMotion ? 0 : 2800;       // writing time in ms
    const DOT_AT = 0.9;                         // the i-dot is tapped in last
    const FEATHER = 0.015;                      // soft wet-ink edge

    // Cubic-bezier easing for the pen's speed (slow start, quick middle)
    const bezier = (x1, y1, x2, y2) => {
      const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
      const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
      const fx = (t) => ((ax * t + bx) * t + cx) * t;
      const dfx = (t) => (3 * ax * t + 2 * bx) * t + cx;
      return (x) => {
        let t = x;
        for (let k = 0; k < 6; k++) { const d = dfx(t); if (Math.abs(d) < 1e-6) break; t -= (fx(t) - x) / d; }
        t = clamp(t, 0, 1);
        return ((ay * t + by) * t + cy) * t;
      };
    };
    const easeWrite = bezier(0.32, 0.02, 0.18, 1);

    let artData = null, order = null;
    const art = new Image();

    // Build the per-pixel "when does the pen get here" map
    const build = () => {
      const src = document.createElement('canvas');
      src.width = W * S; src.height = H * S;
      const sctx = src.getContext('2d');
      sctx.drawImage(art, 0, 0, W * S, H * S);
      artData = sctx.getImageData(0, 0, W * S, H * S);

      const flat = document.createElement('canvas');
      flat.width = W; flat.height = H;
      const fctx = flat.getContext('2d');
      fctx.drawImage(art, 0, 0, W, H);
      const inkA = fctx.getImageData(0, 0, W, H).data;

      const N = W * H;
      const isInk = new Uint8Array(N);
      for (let k = 0; k < N; k++) isInk[k] = inkA[k * 4 + 3] > 60 ? 1 : 0;

      order = new Float32Array(N).fill(9);
      const scratch = document.createElement('canvas');
      scratch.width = W; scratch.height = H;
      const xc = scratch.getContext('2d');
      const wordPath = new Path2D(wordEl.getAttribute('d'));
      const dotPath = new Path2D(dotEl.getAttribute('d'));
      const WL = wordEl.getTotalLength(), DL = dotEl.getTotalLength();
      const STEPS = 210;
      xc.lineCap = 'round'; xc.lineJoin = 'round'; xc.strokeStyle = '#000';
      for (let s = 1; s <= STEPS; s++) {
        const p = s / STEPS;
        const wp = Math.min(1, p / DOT_AT), dp = Math.max(0, (p - DOT_AT) / (1 - DOT_AT));
        xc.clearRect(0, 0, W, H);
        xc.lineWidth = 15; xc.setLineDash([WL * wp, WL]); xc.stroke(wordPath);
        if (dp > 0) { xc.lineWidth = 13; xc.setLineDash([DL * dp, DL]); xc.stroke(dotPath); }
        const cd = xc.getImageData(0, 0, W, H).data;
        for (let k = 0; k < N; k++) if (isInk[k] && order[k] > 1 && cd[k * 4 + 3] > 30) order[k] = p;
      }
      // Spread timings into thick strokes and loops the narrow pen missed
      for (let pass = 0; pass < 90; pass++) {
        let changed = 0;
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const k = y * W + x;
            if (!isInk[k] || order[k] <= 1) continue;
            let best = 9;
            for (let dy = -1; dy <= 1; dy++) {
              const ny = y + dy; if (ny < 0 || ny >= H) continue;
              for (let dx = -1; dx <= 1; dx++) {
                const nx = x + dx; if (nx < 0 || nx >= W) continue;
                const o = order[ny * W + nx];
                if (o <= 1 && o < best) best = o;
              }
            }
            if (best <= 1) { order[k] = Math.min(1, best + 0.0025); changed++; }
          }
        }
        if (!changed) break;
      }
      for (let k = 0; k < N; k++) if (order[k] > 1) order[k] = 1;
    };

    const out = ctx.createImageData(W * S, H * S);
    const draw = (p) => {
      const cut = p * (1 + FEATHER);
      const a = artData.data, o = out.data;
      for (let y = 0; y < H * S; y++) {
        const orow = (y >> 1) * W;
        for (let x = 0; x < W * S; x++) {
          const i4 = (y * W * S + x) * 4;
          const m = clamp((cut - order[orow + (x >> 1)]) / FEATHER, 0, 1);
          o[i4] = a[i4]; o[i4 + 1] = a[i4 + 1]; o[i4 + 2] = a[i4 + 2]; o[i4 + 3] = a[i4 + 3] * m;
        }
      }
      ctx.putImageData(out, 0, 0);
    };

    art.onload = () => {
      try { build(); } catch (e) { hide(); return; }
      draw(0);
      const t0 = performance.now();
      const step = (now) => {
        const p = DUR ? Math.min(1, (now - t0) / DUR) : 1;
        draw(p < 1 ? easeWrite(p) : 1);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      setTimeout(hide, DUR + 620);
    };
    art.onerror = hide;
    setTimeout(() => { art.src = 'assets/img/maria-script.png'; }, 260);
  }

  /* ---------------------------------------------------------------- 3 ---
     Hero: the wildflower clip is scrubbed by scroll position instead of
     playing on its own. The hero section grows to 320vh so there is room
     to scroll through it; the stage inside stays pinned (position: sticky). */
  function setupHeroScrub() {
    const section = $('#pf-hero');
    const video = $('#pf-hero-video');
    const copy = $('#pf-hero-copy');
    const cue = $('#pf-scroll-cue');
    if (!section || !video) return;

    let duration = 0, current = 0;
    const progress = () => {
      const total = section.offsetHeight - window.innerHeight;
      return total > 0 ? clamp(-section.getBoundingClientRect().top / total, 0, 1) : 0;
    };
    const paint = (p) => {
      // Copy holds through the first stretch, then lifts and fades as the sky turns
      const out = clamp((p - 0.42) / 0.44, 0, 1);
      if (copy) { copy.style.opacity = String(1 - out); copy.style.transform = 'translateY(' + (-70 * out) + 'px)'; }
      if (cue) cue.style.opacity = String(clamp(1 - p * 5, 0, 1));
      video.style.transform = 'scale(' + (1 + p * 0.07) + ')';
    };

    video.addEventListener('loadedmetadata', () => {
      duration = video.duration || 0;
      if (duration) { section.style.height = '320vh'; video.classList.add('is-ready'); }
    });
    video.addEventListener('error', () => { section.style.height = '100vh'; });

    // Seeking needs the whole file; loading it as a blob makes scrubbing
    // reliable on hosts that ignore HTTP range requests.
    const src = video.dataset.src;
    fetch(src).then((r) => r.blob()).then((blob) => {
      video.src = URL.createObjectURL(new Blob([blob], { type: 'video/mp4' }));
      video.load();
    }).catch(() => { video.src = src; });
    video.pause();

    const tick = () => {
      current += (progress() - current) * (reducedMotion ? 1 : 0.12);  // ease toward the scroll position
      if (duration) {
        const t = clamp(current * duration, 0, duration - 0.05);
        if (Math.abs(video.currentTime - t) > 0.02) { try { video.currentTime = t; } catch (e) {} }
      }
      paint(current);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ---------------------------------------------------------------- 4 ---
     Nav reads cream over the dark hero, then switches to the page colours. */
  function setupNavOverHero() {
    const nav = $('#pf-nav');
    const hero = $('#pf-hero');
    if (!nav || !hero) return;
    let last = null;
    const sync = () => {
      const over = hero.getBoundingClientRect().bottom > nav.offsetHeight;
      if (over !== last) { last = over; nav.classList.toggle('is-over-hero', over); }
      requestAnimationFrame(sync);
    };
    requestAnimationFrame(sync);
  }

  /* ---------------------------------------------------------------- 5 ---
     A soft pill slides behind the nav link for the section on screen. */
  function setupNavIndicator() {
    const ind = $('#pf-nav-ind');
    const links = $$('#pf-nav [data-nav-link]');
    if (!ind || !links.length) return;
    if (reducedMotion) ind.style.transition = 'none';
    let last;
    const sync = () => {
      const mid = window.innerHeight * 0.45;
      let active = null;
      links.forEach((a) => {
        const sec = document.getElementById(a.dataset.navLink);
        if (!sec) return;
        const r = sec.getBoundingClientRect();
        if (r.top <= mid && r.bottom > mid) active = a;
      });
      if (active && !active.offsetWidth) active = null;   // hidden on mobile
      if (active !== last) {
        last = active;
        links.forEach((a) => a.toggleAttribute('aria-current', a === active));
        if (!active) ind.style.opacity = '0';
        else {
          ind.style.opacity = '1';
          ind.style.transform = 'translateX(' + (active.offsetLeft - 10) + 'px) scaleX(' + (active.offsetWidth + 20) + ')';
        }
      }
      requestAnimationFrame(sync);
    };
    requestAnimationFrame(sync);
  }

  /* ---------------------------------------------------------------- 6 --- */
  function setupMobileMenu() {
    const nav = $('#pf-nav');
    const btn = $('#pf-menu-btn');
    const menu = $('#pf-mobile-menu');
    if (!nav || !btn || !menu) return;
    const set = (open) => {
      nav.classList.toggle('is-menu-open', open);
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      menu.setAttribute('aria-hidden', String(!open));
    };
    btn.addEventListener('click', () => set(btn.getAttribute('aria-expanded') !== 'true'));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') { set(false); btn.focus(); }
    });
    matchMedia('(max-width: 1000px)').addEventListener('change', (e) => { if (!e.matches) set(false); });
  }

  /* ---------------------------------------------------------------- 7 ---
     Accessible tabs: click, or arrow keys / Home / End when focused. */
  function setupTabs() {
    const tabs = $$('#pf-services [role="tab"]');
    if (!tabs.length) return;
    const select = (i, focus) => {
      tabs.forEach((t, k) => {
        const on = k === i;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      });
      if (focus) tabs[i].focus();
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(i));
      t.addEventListener('keydown', (e) => {
        const n = tabs.length;
        let k = i;
        if (e.key === 'ArrowRight') k = (i + 1) % n;
        else if (e.key === 'ArrowLeft') k = (i + n - 1) % n;
        else if (e.key === 'Home') k = 0;
        else if (e.key === 'End') k = n - 1;
        else return;
        e.preventDefault();
        select(k, true);
      });
    });
  }

  /* ---------------------------------------------------------------- 8 ---
     Envelope. Pull the wax seal down (or click it, or press the caption)
     and the flap opens; five polaroids fan out and can be dragged around.
     All positions are written as inline transforms on each card. */
  function setupEnvelope() {
    const stage = $('#pf-line-stage');
    const rise = $('#pf-env-rise');
    const envelope = $('.envelope');
    const seal = $('.env-seal');
    const caption = $('.env-caption');
    const status = $('#pf-env-status');
    if (!stage || !envelope || !seal) return;

    const ORDER = ['watercolor', 'comics', 'moldova', 'coffee', 'bay'];
    const cards = ORDER.map((k) => $('.polaroid[data-card="' + k + '"]', stage));
    // Where each card lands in the fan, in "book units" (--bk) from the envelope
    const FAN = {
      watercolor: 'translate(calc(var(--bk) * var(--fx, 1) * -1.75), calc(var(--bk) * -0.95)) rotate(-15deg)',
      comics:     'translate(calc(var(--bk) * var(--fx, 1) * -0.9), calc(var(--bk) * -1.85)) rotate(-7deg)',
      moldova:    'translate(calc(var(--bk) * 0), calc(var(--bk) * -2.1)) rotate(1deg)',
      coffee:     'translate(calc(var(--bk) * var(--fx, 1) * 0.9), calc(var(--bk) * -1.85)) rotate(9deg)',
      bay:        'translate(calc(var(--bk) * var(--fx, 1) * 1.75), calc(var(--bk) * -0.95)) rotate(17deg)',
    };
    const BASE_Z = [2, 3, 4, 3, 2];
    const STATUS = 'Envelope opened. Photos: Watercolours on weekends; Ten years in comics before pixels; Born in Moldova; Iced americanos, always; Lives in the Bay Area.';

    const state = { open: false, hover: false, broken: false, pull: 0, drag: {}, held: null };
    let sealDrag = null, sealMoved = false, cardDrag = null, flapTimer, settleTimer;

    const render = () => {
      const { open, hover, broken, pull } = state;
      envelope.classList.toggle('is-open', open);
      // Seal: follows the pull, then pops off once broken
      seal.style.transform = broken
        ? 'translate(calc(var(--bk) * 0.55), calc(var(--bk) * 1.05)) rotate(38deg) scale(0.66)'
        : 'translateY(' + pull + 'px) rotate(' + (pull * 0.45) + 'deg)';
      seal.style.opacity = broken ? '0' : '1';
      seal.classList.toggle('is-dragging', !!sealDrag);
      caption.textContent = open ? 'tap to re-seal' : 'pull the seal ↓';
      caption.setAttribute('aria-label', open ? 'Tap to re-seal the envelope' : 'Pull the seal to open the envelope');
      caption.setAttribute('aria-expanded', String(open));
      status.textContent = open ? STATUS : '';

      ORDER.forEach((k, i) => {
        const el = cards[i];
        const step = open ? i : ORDER.length - 1 - i;           // deal out left→right, gather right→left
        const delay = (open ? step * 55 : step * 35) + 'ms';
        const p = open ? state.drag[k] : null;
        let transform = open
          ? (p ? 'translate(' + p.x + 'px, ' + p.y + 'px) ' + FAN[k] : FAN[k])
          : 'translate(0px, 0px) rotate(' + ((i - (ORDER.length - 1) / 2) * 2.5) + 'deg) scale(0.82)';
        let opacity = open ? 1 : 0;
        let transition = 'transform .5s var(--ease-out) ' + delay + ', opacity .35s ease ' + delay;
        // Hovering the closed envelope lets the middle photo peek out
        if (!open && hover && k === 'moldova') {
          opacity = 0.8;
          transform = 'translate(0px, calc(var(--bk) * -0.3)) rotate(-3deg) scale(0.88)';
          transition = 'transform .4s var(--ease-out), opacity .3s ease';
        }
        if (state.held === k) transition = 'none';
        el.style.transform = transform;
        el.style.opacity = opacity;
        el.style.transition = reducedMotion ? 'none' : transition;
        el.style.zIndex = state.held === k ? 12 : p ? 10 : open ? BASE_Z[i] + 2 : BASE_Z[i];
        el.style.pointerEvents = open ? 'auto' : 'none';
        el.style.cursor = open ? (state.held === k ? 'grabbing' : 'grab') : 'default';
        el.setAttribute('aria-hidden', String(!open));
      });
    };

    const breakSeal = () => {
      if (state.open || state.broken) return;
      state.broken = true; state.pull = 0; render();
      clearTimeout(flapTimer); clearTimeout(settleTimer);
      flapTimer = setTimeout(() => {
        state.open = true; state.drag = {}; render();
        // Once the flap has swung over, drop it behind the photos
        settleTimer = setTimeout(() => envelope.classList.add('is-settled'), 720);
      }, reducedMotion ? 0 : 260);
    };
    const reseal = () => {
      clearTimeout(flapTimer); clearTimeout(settleTimer);
      Object.assign(state, { open: false, broken: false, pull: 0, drag: {}, held: null });
      envelope.classList.remove('is-settled');
      render();
    };
    const toggle = () => (state.open ? reseal() : breakSeal());

    // Seal: drag it down past 50px to break it
    seal.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || state.open || state.broken) return;
      e.preventDefault();
      sealDrag = { y: e.clientY }; sealMoved = false;
      seal.setPointerCapture(e.pointerId);
      render();
    });
    seal.addEventListener('pointermove', (e) => {
      if (!sealDrag) return;
      const dy = e.clientY - sealDrag.y;
      if (Math.abs(dy) > 3) sealMoved = true;
      state.pull = clamp(dy, 0, 130);
      render();
    });
    const sealUp = () => {
      if (!sealDrag) return;
      sealDrag = null;
      if (state.pull > 50) breakSeal(); else { state.pull = 0; render(); }
      setTimeout(() => { sealMoved = false; }, 60);
    };
    seal.addEventListener('pointerup', sealUp);
    seal.addEventListener('pointercancel', sealUp);
    seal.addEventListener('click', () => { if (!sealMoved && !state.open) breakSeal(); });
    caption.addEventListener('click', toggle);

    envelope.addEventListener('pointerenter', () => { state.hover = true; render(); });
    envelope.addEventListener('pointerleave', () => { state.hover = false; render(); });

    // Polaroids: drag anywhere once the envelope is open
    cards.forEach((el, i) => {
      const k = ORDER[i];
      el.addEventListener('pointerdown', (e) => {
        if (!state.open || e.button !== 0) return;
        e.preventDefault();
        const start = state.drag[k] || { x: 0, y: 0 };
        cardDrag = { k, sx: e.clientX, sy: e.clientY, ox: start.x, oy: start.y };
        state.held = k;
        el.setPointerCapture(e.pointerId);
        render();
      });
      el.addEventListener('pointermove', (e) => {
        if (!cardDrag || cardDrag.k !== k) return;
        state.drag[k] = { x: Math.round(cardDrag.ox + e.clientX - cardDrag.sx), y: Math.round(cardDrag.oy + e.clientY - cardDrag.sy) };
        render();
      });
      const up = () => { if (cardDrag && cardDrag.k === k) { cardDrag = null; state.held = null; render(); } };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    });

    render();

    // Entrance: the whole envelope drops in once it is 80% up the screen
    if (rise && !reducedMotion && 'IntersectionObserver' in window) {
      const check = () => {
        const top = rise.getBoundingClientRect().top;
        const vh = window.innerHeight;
        if (top < vh * 0.8) rise.classList.add('is-in');
        else if (top > vh) rise.classList.remove('is-in');  // replays if you scroll back up
      };
      window.addEventListener('scroll', check, { passive: true });
      check();
    }
  }

  /* ---------------------------------------------------------------- 9 --- */
  function setupContact() {
    const btn = $('#pf-copy-email');
    const label = $('.copy-label', btn);
    const status = $('#pf-copy-status');
    let timer;
    if (btn) btn.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText('mariasweeneyart@gmail.com'); } catch (e) {}
      btn.classList.add('is-copied');
      label.textContent = 'Copied!';
      status.textContent = 'Email address copied to clipboard';
      clearTimeout(timer);
      timer = setTimeout(() => {
        btn.classList.remove('is-copied');
        label.textContent = 'mariasweeneyart@gmail.com';
        status.textContent = '';
      }, 1800);
    });
    const top = $('#pf-to-top');
    if (top) top.addEventListener('click', () => {
      if (window.__lenis) window.__lenis.scrollTo(0); else window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
      const skip = $('.skip-link'); if (skip) skip.focus({ preventScroll: true });
    });
  }

  /* --------------------------------------------------------------- 10 ---
     Banker's lamp: a hidden drawing in the contact section that only shows
     inside a circle of lamplight that follows the pointer. */
  function setupLamp() {
    const sec = $('#pf-contact');
    const stage = $('#pf-lamp-stage');
    const btn = $('#pf-lamp-btn');
    if (!sec || !stage || !btn) return;
    let on = false, pointed = false;
    const setMask = (m) => { stage.style.maskImage = m; stage.style.webkitMaskImage = m; };
    btn.addEventListener('click', () => {
      on = !on;
      stage.classList.toggle('is-on', on);
      btn.setAttribute('aria-pressed', String(on));
      btn.setAttribute('aria-label', on ? "Turn off the banker's lamp" : "Turn on the banker's lamp");
      if (on && !pointed) setMask('none');
    });
    sec.addEventListener('pointermove', (e) => {
      if (!on) return;
      pointed = true;
      const r = sec.getBoundingClientRect();
      setMask('radial-gradient(circle 150px at ' + Math.round(e.clientX - r.left) + 'px ' + Math.round(e.clientY - r.top) + 'px, #000 0%, #000 44%, rgba(0,0,0,0) 78%)');
    });
    sec.addEventListener('pointerleave', () => { if (on) setMask('none'); });
  }

  /* --------------------------------------------------------------- 11 ---
     Theme toggle. The new background wipes out in a circle from the button,
     then the real theme switches underneath and the wipe fades away. */
  function setupTheme() {
    const btn = $('#pf-theme-btn');
    if (!btn) return;
    const root = document.documentElement;
    const label = () => {
      const dark = root.getAttribute('data-pf-theme') === 'dark';
      const text = dark ? 'Switch to light mode' : 'Switch to dark mode';
      btn.setAttribute('aria-label', text); btn.title = text;
    };
    const apply = (theme) => { root.setAttribute('data-pf-theme', theme); label(); };
    label();
    btn.addEventListener('click', () => {
      const next = root.getAttribute('data-pf-theme') === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('pf-theme', next); } catch (e) {}
      if (reducedMotion) { apply(next); return; }
      const r = btn.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const radius = Math.ceil(Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)));
      const at = 'px at ' + x.toFixed(1) + 'px ' + y.toFixed(1) + 'px)';
      const veil = document.createElement('div');
      veil.className = 'theme-veil';
      veil.setAttribute('aria-hidden', 'true');
      veil.style.background = next === 'dark' ? '#191310' : '#F5EFE6';
      veil.style.clipPath = 'circle(0' + at;
      document.body.appendChild(veil);
      veil.getBoundingClientRect();                 // commit the start state
      veil.style.transition = 'clip-path .42s var(--ease-out)';
      veil.style.clipPath = 'circle(' + radius + at;
      setTimeout(() => {
        apply(next);
        veil.style.transition = 'opacity .26s var(--ease-out)';
        veil.style.opacity = '0';
        setTimeout(() => veil.remove(), 300);
      }, 380);
    });
  }

  /* --------------------------------------------------------------- 12 --- */
  function setupReveals() {
    const items = $$('[data-reveal]');
    if (!('IntersectionObserver' in window)) { items.forEach((el) => el.classList.add('is-in')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add('is-in'); io.unobserve(entry.target); }
      });
    }, { threshold: 0.15 });
    items.forEach((el) => io.observe(el));
  }

  // The portrait leans gently toward the pointer (mouse/trackpad only)
  function setupPortraitTilt() {
    const well = $('#pf-about-photo-well');
    const scope = $('#pf-about-window');
    if (!well || !scope || reducedMotion || !finePointer) return;
    well.style.transition = 'transform .5s var(--ease-out)';
    let raf = 0;
    scope.addEventListener('pointermove', (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = scope.getBoundingClientRect();
        const nx = ((e.clientX - r.left) / r.width - 0.5) * 2;
        const ny = ((e.clientY - r.top) / r.height - 0.5) * 2;
        well.style.transform = 'perspective(900px) rotateY(' + (nx * 5).toFixed(2) + 'deg) rotateX(' +
          (-ny * 3.4).toFixed(2) + 'deg) translate3d(' + (nx * 8).toFixed(1) + 'px,' + (ny * 5).toFixed(1) + 'px,0)';
      });
    });
    scope.addEventListener('pointerleave', () => { well.style.transform = 'none'; });
  }

  // ---------------------------------------------------------------- go
  setupLenis();
  setupLoader();
  setupHeroScrub();
  setupNavOverHero();
  setupNavIndicator();
  setupMobileMenu();
  setupTabs();
  setupEnvelope();
  setupContact();
  setupLamp();
  setupTheme();
  setupReveals();
  setupPortraitTilt();
})();

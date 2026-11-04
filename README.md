# Maria Sweeney portfolio site

Plain HTML, CSS and JavaScript with no framework and no build step. This is
the production version of the Claude Design prototypes in `../project/`.

## Run it locally

```sh
cd site
python3 -m http.server 8000
# open http://localhost:8000
```

Use a local server rather than double-clicking the file. Under `file://` the
browser blocks the loading-screen ink effect and the hero video scrub. If that
happens, the page skips the loader and still works.

## Deploy

Upload the `site/` folder as-is to any static host: GitHub Pages, Netlify
(drag and drop the folder) or Cloudflare Pages. No settings are needed.

## How it's organised

| File | What it does |
| --- | --- |
| `index.html` | Portfolio home: hero, work, services, experience, about, envelope, contact |
| `books.html` | Books and illustration, with the Brittle Joints flipbook |
| `tap-talk.html`, `disability-check.html` | Case studies |
| `css/tokens.css` | Maria Design System values (colours, type scale, radii, shadows). Change a brand colour here. |
| `css/base.css` | Design-system element defaults, plus the site's fonts, focus ring and skip link |
| `css/portfolio.css`, `css/books.css`, `css/case-study.css` | One stylesheet per page type |
| `js/*.js` | One script per page type. Each feature is a small function with a comment saying what it does. |

### Things you'll likely want to change

- **Dark mode colours (home page):** the `html[data-pf-theme="dark"]` block at the top of `css/portfolio.css`.
- **Polaroid photos:** the `<img>` tags inside `.polaroid` in `index.html` (photos live in `assets/img/polaroids/`).
- **Flipbook pages:** the `SPREADS` list near the top of `js/books.js`.
- **Disability Check screenshots:** each `.dc-shot` box in `disability-check.html` is an empty slot. Add `<img src="…" alt="…">` inside it and delete the label `<span>`.
- **Dot chart numbers:** `data-working` and `data-wanting` on `.dc-dots`. The 100 dots are generated from them.

## Accessibility notes

- Every animation checks `prefers-reduced-motion` and is skipped or shortened.
- Content stays visible without JavaScript; scroll reveals only hide items when JS is running.
- Tabs follow the ARIA tabs pattern (arrow keys, Home and End).
- The envelope opens from the keyboard through its caption button. The opened photos are announced through a live region.

## Before launch

- **Kaftan Serif is a trial font** (`assets/fonts/kaftan-trial.otf`). Buy the licence, or swap in another display serif in `css/base.css`.
- The polaroid captions use the design system's Typekit kit (`hum0qvq`). Add your live domain to that kit in Adobe Fonts, or the captions fall back to a plain serif.

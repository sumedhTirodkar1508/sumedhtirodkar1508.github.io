/* Evergreen Executive on the template kit.
 *
 * The kit fills the page from the contract. This script adds the template's own touches, each one
 * derived from contract fields: the name in two inks, the typed title (hero.title, then the title
 * of each current role, settling on hero.title), the current-role card (the first role), the
 * constellation monogram when there is no photo (seeded by the name), section and project numbers
 * by order, company monograms for roles without a logo, and a pale mount for dark transparent
 * logos. Motion (the typing, the drifting field in the hero, the reveals) starts only when the
 * visitor has not asked for reduced motion. Text goes in only through textContent; every data
 * value placed in a link or an image goes through kit.url or kit.src. */
(() => {
  'use strict';

  const kit = window.kit;
  if (!kit) return;

  const SVG = 'http://www.w3.org/2000/svg';
  const root = document.documentElement;
  const $ = (sel, scope = document) => scope.querySelector(sel);
  const $$ = (sel, scope = document) => [...scope.querySelectorAll(sel)];
  const str = (v) => (typeof v === 'string' ? v.trim() : '');
  const list = (v) => (Array.isArray(v) ? v : []);
  const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  /* a current role: no end date, or an end that reads "Present" */
  const isCurrent = (role) => !str(role.end) || /^present$/i.test(str(role.end));

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text) node.textContent = text;
    return node;
  }

  function svg(tag, attrs, text) {
    const node = document.createElementNS(SVG, tag);
    for (const k of Object.keys(attrs || {})) node.setAttribute(k, attrs[k]);
    if (text) node.textContent = text;
    return node;
  }

  const setText = (sel, value, scope) => {
    for (const node of $$(sel, scope)) node.textContent = value;
  };

  const onResize = (fn) => {
    let raf = 0;
    addEventListener('resize', () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(fn);
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fn);
  };

  /* A small seeded generator, so a person's constellation is the same on every visit. */
  function seeded(text) {
    let h = 2166136261;
    for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    return () => {
      h = Math.imul(h ^ (h >>> 15), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= h >>> 16;
      return (h >>> 0) / 4294967296;
    };
  }

  /* --------------------------------------------------- section numbers, in page order */
  function sectionNumbers() {
    $$('[data-kit-section]')
      .filter((s) => s.dataset.kitSection !== 'hero')
      .forEach((s, i) => setText('.js-index', kit.util.pad(i + 1), s));
  }

  /* -------------------------------------------- the name in two inks, fitted to its line */
  function heroName(name) {
    const h1 = $('.hero-name');
    const first = kit.util.firstName(name);
    const rest = name.slice(first.length).trim();
    setText('.js-initials', name ? kit.util.initials(name) : '');
    setText('.js-brand-short', name.length <= 20 ? name : first);
    if (name.length > 26) root.dataset.nameLong = '1';
    if (!h1) return;
    h1.textContent = '';
    h1.append(el('span', 'first', first));
    if (rest) h1.append(' ', el('span', 'rest', rest));
    // the longest unbreakable piece (a word, or a hyphenated word up to its hyphen) sets the size
    const pieces = name.split(/\s+/).flatMap((w) => w.split(/(?<=-)/));
    const fit = () => {
      h1.style.fontSize = '';
      const probe = el('span');
      probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;left:0;top:0';
      h1.append(probe);
      let widest = 0;
      for (const p of pieces) {
        probe.textContent = p;
        widest = Math.max(widest, probe.getBoundingClientRect().width);
      }
      probe.remove();
      const room = h1.clientWidth;
      if (!room || widest <= room) return;
      const base = parseFloat(getComputedStyle(h1).fontSize);
      h1.style.fontSize = `${Math.max(26, Math.floor((base * room * 0.98) / widest))}px`;
    };
    fit();
    onResize(fit);
  }

  /* ------------------------------------------------- small hero pieces that may be empty */
  function tidyHero() {
    const kicker = $('.hero-kicker');
    if (kicker && !kicker.querySelector('[data-kit-text]')) kicker.remove();
    const title = $('.hero-title');
    if (title && !title.querySelector('.js-typed')) title.remove();
    const status = $('.contact-status');
    if (status && !status.querySelector('[data-kit-text]')) status.remove();
  }

  /* ---------------- the typed title: hero.title, then the title of each current role */
  function typed(data) {
    const node = $('.js-typed');
    if (!node) return;
    const title = str(obj(data.hero).title);
    // only what the person does now: a past title ("Analytics Intern") never takes the hero
    const roles = list(obj(data.experience).roles)
      .map(obj)
      .filter(isCurrent)
      .map((r) => str(r.title));
    const seen = new Set();
    const seq = [title, ...roles].filter((t) => {
      const key = t.toLowerCase();
      if (!t || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    // one title, or reduced motion (and so every screenshot): the line simply reads hero.title
    if (kit.reducedMotion || seq.length < 2) return;
    const line = node.parentElement;
    const shown = el('span', 'typed', title);
    shown.setAttribute('aria-hidden', 'true');
    const caret = el('span', 'caret');
    caret.setAttribute('aria-hidden', 'true');
    node.textContent = '';
    node.append(el('span', 'sr-only', title), shown, caret);
    // the line keeps the height of its tallest title, so nothing below it moves while it types
    const hold = () => {
      line.style.minHeight = '';
      let tallest = line.getBoundingClientRect().height;
      const was = shown.textContent;
      for (const t of seq) {
        shown.textContent = t;
        tallest = Math.max(tallest, line.getBoundingClientRect().height);
      }
      shown.textContent = was;
      line.style.minHeight = `${Math.ceil(tallest)}px`;
    };
    hold();
    onResize(hold);
    const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
    (async () => {
      await wait(2600);
      // one pass through the current titles, then back to the headline title, where it stays
      for (const next of [...seq.slice(1), title]) {
        for (let t = shown.textContent; t.length; t = t.slice(0, -1)) {
          shown.textContent = t.slice(0, -1);
          await wait(26);
        }
        for (let i = 1; i <= next.length; i++) {
          shown.textContent = next.slice(0, i);
          await wait(52);
        }
        if (next !== title) await wait(1500);
      }
      caret.classList.add('done');
    })();
  }

  /* ------------------------------------------------ the current-role card in the hero */
  function proof(data) {
    const card = $('.js-proof');
    if (!card) return;
    const role = obj(list(obj(data.experience).roles)[0]);
    const company = str(role.company);
    if (!company) return card.remove();
    const now = isCurrent(role);
    const start = str(role.start);
    const title = str(role.title);
    const headline = str(obj(data.hero).title).toLowerCase();
    const span = now
      ? start && `Since ${start}`
      : [start, str(role.end)].filter(Boolean).join(' – ');
    const sub = [title && title.toLowerCase() !== headline ? title : '', span]
      .filter(Boolean)
      .join(' · ');
    setText('.js-proof-kicker', now ? 'Currently at' : 'Most recently at', card);
    setText('.js-proof-main', company, card);
    const subEl = $('.js-proof-sub', card);
    if (sub) subEl.textContent = sub;
    else subEl.remove();
  }

  /* ------------------------- the constellation: nodes and hairline links, seeded by name */
  function constellation(host, w, h, rand, opts) {
    const { count, reach, keepOut } = opts;
    const nodes = [];
    for (let tries = 0; nodes.length < count && tries < count * 40; tries++) {
      const x = 14 + rand() * (w - 28);
      const y = 14 + rand() * (h - 28);
      if (keepOut && keepOut.r && Math.hypot(x - keepOut.x, y - keepOut.y) < keepOut.r) continue;
      if (
        keepOut &&
        keepOut.w &&
        x > keepOut.x &&
        x < keepOut.x + keepOut.w &&
        y > keepOut.y &&
        y < keepOut.y + keepOut.h
      )
        continue;
      if (nodes.some((n) => Math.hypot(n.x - x, n.y - y) < reach * 0.36)) continue;
      nodes.push({ x, y });
    }
    const links = svg('g', { class: 'c-links' });
    nodes.forEach((a, i) => {
      for (const b of nodes.slice(i + 1)) {
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d > reach) continue;
        links.append(
          svg('line', {
            class: 'c-link',
            x1: a.x.toFixed(1),
            y1: a.y.toFixed(1),
            x2: b.x.toFixed(1),
            y2: b.y.toFixed(1),
            'stroke-opacity': (0.34 * (1 - d / reach) + 0.05).toFixed(2),
          })
        );
      }
    });
    host.append(links);
    const dots = svg('g', { class: 'c-nodes' });
    nodes.forEach((n, i) => {
      const tone = i % 9 === 4 ? 'gold' : i % 4 === 1 ? 'soft' : i % 7 === 3 ? 'white' : '';
      dots.append(
        svg('circle', {
          class: `c-node${tone ? ` c-node--${tone}` : ''}`,
          cx: n.x.toFixed(1),
          cy: n.y.toFixed(1),
          r: (1.2 + rand() * 2.1).toFixed(2),
          'fill-opacity': (0.55 + rand() * 0.45).toFixed(2),
        })
      );
    });
    host.append(dots);
  }

  /* the monogram plate in the photo's place, and the halo of line work around a portrait */
  function heroArt(name, initials) {
    const photo = root.dataset.kitPhoto === '1';
    const rand = seeded(name || 'portfolio');
    const plate = $('.js-emblem');
    if (plate && !photo && initials) {
      const cx = 200;
      const cy = 230;
      const defs = svg('defs');
      const grad = svg('linearGradient', { id: 'ee-ink', x1: '0', y1: '0', x2: '1', y2: '1' });
      grad.append(svg('stop', { offset: '0', 'stop-color': '#ffffff' }));
      grad.append(svg('stop', { offset: '1', 'stop-color': '#8eeedd' }));
      defs.append(grad);
      plate.append(defs);
      constellation(plate, 400, 500, rand, {
        count: 34,
        reach: 96,
        keepOut: { x: cx, y: cy, r: 140 },
      });
      plate.append(svg('circle', { class: 'e-disc', cx, cy, r: 104 }));
      plate.append(svg('circle', { class: 'e-ring', cx, cy, r: 104 }));
      plate.append(svg('circle', { class: 'e-ring e-ring--dash', cx, cy, r: 124 }));
      // three points on the ring, the gold one where the ring meets the field
      for (const [deg, tone] of [
        [-38, 'gold'],
        [152, ''],
        [214, 'soft'],
      ]) {
        const t = (deg * Math.PI) / 180;
        plate.append(
          svg('circle', {
            class: `c-node${tone ? ` c-node--${tone}` : ''}`,
            cx: (cx + 104 * Math.cos(t)).toFixed(1),
            cy: (cy + 104 * Math.sin(t)).toFixed(1),
            r: tone === 'gold' ? 4.5 : 3,
          })
        );
      }
      plate.append(
        svg(
          'text',
          {
            class: 'e-initials',
            x: cx,
            y: cy + 4,
            fill: 'url(#ee-ink)',
            'text-anchor': 'middle',
            'dominant-baseline': 'central',
          },
          initials
        )
      );
    } else plate?.closest('.emblem')?.remove();

    // around a portrait, the line work gathers in the margin outside the frame
    const halo = $('.js-halo');
    const frame = $('.portrait-frame');
    if (!halo || !photo || !frame) return halo?.remove();
    const pad = { t: 90, r: 90, b: 70, l: 30 };
    const draw = () => {
      const fw = frame.offsetWidth;
      const fh = frame.offsetHeight;
      halo.textContent = '';
      if (!fw || !fh) return;
      const w = fw + pad.l + pad.r;
      const h = fh + pad.t + pad.b;
      halo.setAttribute('viewBox', `0 0 ${w} ${h}`);
      halo.setAttribute('preserveAspectRatio', 'none');
      const keepOut = { x: pad.l + 14, y: pad.t + 14, w: fw - 28, h: fh - 28 };
      constellation(halo, w, h, seeded(name || 'portfolio'), { count: 44, reach: 118, keepOut });
    };
    draw();
    onResize(draw);
  }

  /* -------------------------------- roles: monograms, logo mounts and the empty pieces */
  function logoTone(img) {
    const read = () => {
      try {
        const size = 40;
        const c = document.createElement('canvas');
        c.width = size;
        c.height = size;
        const g = c.getContext('2d', { willReadFrequently: true });
        g.drawImage(img, 0, 0, size, size);
        const px = g.getImageData(0, 0, size, size).data;
        let opaque = 0;
        let weight = 0;
        let light = 0;
        for (let i = 0; i < px.length; i += 4) {
          const a = px[i + 3] / 255;
          if (a < 0.1) continue;
          opaque++;
          weight += a;
          // brightness, not luminance: a deep brand colour such as a navy disc still reads on the
          // dark mount, and only a near-black mark needs the pale one
          light += (Math.max(px[i], px[i + 1], px[i + 2]) / 255) * a;
        }
        const cover = opaque / (size * size);
        // a dark mark on a transparent ground needs the pale mount; a plate or a light mark does not
        if (weight && cover < 0.82 && light / weight < 0.42)
          img.parentElement.classList.add('is-pale');
      } catch {
        /* an unreadable image keeps the dark mount */
      }
    };
    if (img.complete && img.naturalWidth) read();
    else img.addEventListener('load', read, { once: true });
  }

  function roles(data) {
    const all = list(obj(data.experience).roles);
    $$('[data-kit-list="roles"] > .tl-item').forEach((item, i) => {
      const role = obj(all[i]);
      const mono = $('.js-mono', item);
      if (item.dataset.kitLogo === '0' && str(role.company) && mono) {
        mono.textContent = kit.util.initials(str(role.company));
      } else mono?.remove();
      const loc = $('.tl-loc', item);
      if (loc && !loc.querySelector('[data-kit-field]')) loc.remove();
      const earlier = $('.tl-earlier', item);
      if (earlier && !earlier.querySelector('.kit-earlier')) earlier.remove();
      const img = $('.tl-logo img', item);
      if (img) logoTone(img);
    });
  }

  /* ------------------------------------------- projects: numbers and second pictures */
  function figure(cls, src, alt) {
    const fig = el('figure', cls);
    const img = document.createElement('img');
    const attrs = { src, alt, width: 640, height: 360, loading: 'lazy', decoding: 'async' };
    for (const k of Object.keys(attrs)) img.setAttribute(k, attrs[k]);
    fig.append(img);
    return fig;
  }

  /* a schematic's caption names it and opens the drawing at full size (an SVG scales) */
  function schematicCaption(fig, href) {
    if (!fig || fig.querySelector('.kit-caption')) return;
    const cap = el('figcaption', 'kit-caption', 'Architecture diagram');
    if (href) {
      const a = el('a', 'fig-open', 'Open full size');
      a.setAttribute('href', href);
      a.target = '_blank';
      a.rel = 'noopener';
      cap.append(a);
    }
    fig.append(cap);
  }

  function projects(data) {
    const all = list(obj(data.projects).projects).map(obj);
    const layoutOn = /^(split|stack)$/.test(root.dataset.kitFeaturedLayout || '');
    const hasFeatured = !!$('[data-kit-list="featured"]');
    const isFeatured = (p) => layoutOn && hasFeatured && p.featured === true;
    const groups = [
      ['[data-kit-list="featured"] > .project-feature', all.filter(isFeatured)],
      ['[data-kit-list="projects"] > .project-card', all.filter((p) => !isFeatured(p))],
    ];
    for (const [sel, items] of groups) {
      $$(sel).forEach((card, i) => {
        const p = items[i] || {};
        const n = kit.util.pad(all.indexOf(p) + 1);
        setText('.js-num', n, card);
        const visual = $('.js-visual', card);
        if (visual) visual.dataset.num = n;
        // a project without a picture gets its own constellation on the hatched panel
        if (visual && card.dataset.kitMedia === '0') {
          // drawn at the panel's own size, so a band and a full panel get the same node scale
          const box = visual.getBoundingClientRect();
          const w = Math.max(200, Math.round(box.width));
          const h = Math.max(80, Math.round(box.height));
          const tall = h > 200;
          const field = svg('svg', {
            class: 'panel-field',
            viewBox: `0 0 ${w} ${h}`,
            preserveAspectRatio: 'xMidYMid slice',
            'aria-hidden': 'true',
          });
          const numeral = tall
            ? { x: w - 250, y: h - 170, w: 250, h: 170 }
            : { x: w - 130, y: 0, w: 130, h };
          constellation(field, w, h, seeded(str(p.name) || n), {
            count: Math.round(Math.min(32, Math.max(9, (w * h) / 8500))),
            reach: tall ? 120 : 92,
            keepOut: numeral,
          });
          visual.prepend(field);
        }
        const drawing = kit.src(p.image);
        const drawingHref = kit.url(p.image);
        const render = kit.src(obj(p.hero).src);
        schematicCaption($('.kit-media--schematic', card), drawingHref);
        // the kit shows the render when there is one; the drawing joins it
        if (!render || !drawing || !visual) return;
        const alt = `${str(p.name)} architecture diagram`;
        if (card.classList.contains('project-feature')) {
          const fig = figure('pf-figure kit-media--schematic', drawing, alt);
          visual.append(fig);
          schematicCaption(fig, drawingHref);
        } else {
          const pip = figure('pc-pip', drawing, alt);
          if (drawingHref) {
            const a = el('a', 'pc-pip-link');
            a.setAttribute('href', drawingHref);
            a.target = '_blank';
            a.rel = 'noopener';
            a.setAttribute('aria-label', `${str(p.name)} architecture diagram, full size`);
            a.append(...pip.childNodes);
            pip.append(a);
          }
          visual.append(pip);
        }
      });
    }
  }

  /* ---------------------------------------------------- skills, credentials and about */
  function groups() {
    $$('[data-kit-list="groups"] > .skill-category').forEach((card, i) =>
      setText('.js-num', kit.util.pad(i + 1), card)
    );
  }

  function credentials() {
    for (const h of $$('.edu-degree')) {
      const parts = h.querySelectorAll('[data-kit-field]');
      if (!parts.length) h.remove();
      else if (parts.length < 2) h.querySelector('.edu-sep')?.remove();
    }
    const grid = $('.js-credentials');
    const n = grid ? $$(':scope > section', grid).length : 0;
    if (!n) $('.js-cred-band')?.remove();
    else grid.classList.toggle('is-single', n === 1);
  }

  function about() {
    const facts = $('.about-facts');
    const layout = $('.about-layout');
    if (layout && (!facts || facts.dataset.kitCount === '0')) layout.classList.add('is-single');
  }

  /* --------------------------------------------- contact channels get their names */
  const CHANNELS = {
    mail: 'Email',
    phone: 'Phone',
    github: 'GitHub',
    linkedin: 'LinkedIn',
    globe: 'Website',
  };

  function channels() {
    for (const a of $$('.contact-list .kit-contact')) {
      const use = a.querySelector('use');
      const kind = use ? (use.getAttribute('href') || '').replace('#kit-', '') : '';
      const value = a.querySelector('span');
      if (value) {
        value.classList.add('ch-value');
        // a long address breaks after a slash or before the @, not in the middle of a word
        const text = value.textContent;
        if (/[/@]/.test(text)) {
          value.textContent = '';
          for (const part of text.split(/(?<=\/)|(?=@)/)) {
            if (value.childNodes.length) value.append(document.createElement('wbr'));
            value.append(part);
          }
        }
      }
      if (CHANNELS[kind]) a.insertBefore(el('span', 'ch-label', CHANNELS[kind]), value);
    }
  }

  /* ---------------------------------------------------------------- nav behaviour */
  function nav() {
    const bar = $('#navbar');
    const toggle = bar && $('.nav-toggle', bar);
    if (!bar) return;
    if (toggle && !$('.nav-menu', bar)) toggle.remove();
    else if (toggle) {
      const set = (open) => {
        bar.classList.toggle('open', open);
        toggle.setAttribute('aria-expanded', String(open));
      };
      toggle.addEventListener('click', () => set(!bar.classList.contains('open')));
      bar.addEventListener('click', (e) => {
        if (e.target.closest('.kit-nav__link')) set(false);
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') set(false);
      });
    }
    const scrolled = () => bar.classList.toggle('scrolled', scrollY > 40);
    scrolled();
    addEventListener('scroll', scrolled, { passive: true });
    if (toggle) navFit(bar, toggle);
  }

  /* The links share the bar's one row only while the name keeps a readable width (BRAND_MIN):
   * a long name beside many or long links tightens the links first, then collapses them to the
   * menu button, as at 1080px and below. */
  const BRAND_MIN = 150;
  function navFit(bar, toggle) {
    const wrap = $('.nav-wrapper', bar);
    const menu = $('.nav-menu', bar);
    const name = $('.brand-name', bar);
    const mark = $('.brand-mark', bar);
    if (!wrap || !menu || !name) return;
    const narrow = matchMedia('(max-width: 1080px)');
    const fit = () => {
      bar.classList.remove('is-tight', 'is-compact');
      if (narrow.matches) return;
      const cs = getComputedStyle(wrap);
      const room = wrap.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const gap = parseFloat(cs.columnGap) || 24;
      const brand = (mark ? mark.offsetWidth + 12 : 0) + Math.min(name.scrollWidth, BRAND_MIN);
      const fits = () => menu.scrollWidth + gap + brand <= room;
      if (!fits()) {
        bar.classList.add('is-tight');
        if (!fits()) bar.classList.replace('is-tight', 'is-compact');
      }
      // a menu opened as a dropdown closes when the links return to the row
      if (!bar.classList.contains('is-compact')) {
        bar.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    };
    fit();
    onResize(fit);
  }

  /* ------------------------- motion: the drifting field in the hero, and the reveals */
  function field() {
    const hero = $('#hero');
    const layout = hero && $('.hero-layout', hero);
    if (!layout) return;
    // the field belongs to the two-column hero only; at 960px and below (the stylesheet hides it
    // there too) it stops, so a rotation or a resize never leaves it under the stacked text
    const narrow = matchMedia('(max-width: 960px)');
    const tones = ['54, 212, 190', '127, 183, 190', '233, 196, 106'];
    let c = null;
    let g = null;
    let w = 0;
    let h = 0;
    let pts = [];
    let raf = 0;
    let visible = true;
    const size = () => {
      const dpr = Math.min(2, devicePixelRatio || 1);
      w = hero.clientWidth;
      // the field stops above the readouts: it never runs under a line of text
      h = layout.offsetTop + layout.offsetHeight + 24;
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const want = Math.round(Math.min(64, (w * h) / 21000));
      while (pts.length < want)
        pts.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.32,
          vy: (Math.random() - 0.5) * 0.32,
          r: 0.8 + Math.random() * 1.8,
          tone: tones[Math.random() < 0.12 ? 2 : Math.random() < 0.45 ? 1 : 0],
        });
      pts.length = want;
    };
    const draw = () => {
      g.clearRect(0, 0, w, h);
      for (const p of pts) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10;
        if (p.y > h + 10) p.y = -10;
      }
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
          if (d > 140) continue;
          g.strokeStyle = `rgba(54, 212, 190, ${(0.2 * (1 - d / 140)).toFixed(3)})`;
          g.lineWidth = 1;
          g.beginPath();
          g.moveTo(pts[i].x, pts[i].y);
          g.lineTo(pts[j].x, pts[j].y);
          g.stroke();
        }
      }
      for (const p of pts) {
        g.fillStyle = `rgba(${p.tone}, 0.7)`;
        g.beginPath();
        g.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        g.fill();
      }
      raf = running() ? requestAnimationFrame(draw) : 0;
    };
    const running = () => !!c && visible && !document.hidden && !narrow.matches;
    const go = () => {
      if (!raf && running()) raf = requestAnimationFrame(draw);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      if (g) g.clearRect(0, 0, w, h);
    };
    const build = () => {
      if (c || narrow.matches) return;
      const canvas = el('canvas', 'hero-field');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.setAttribute('aria-hidden', 'true');
      hero.prepend(canvas);
      c = canvas;
      g = ctx;
    };
    const update = () => {
      if (narrow.matches) return stop();
      build();
      if (!c) return;
      size();
      go();
    };
    update();
    narrow.addEventListener('change', update);
    onResize(() => {
      if (c && !narrow.matches) size();
    });
    document.addEventListener('visibilitychange', go);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => {
        visible = e.isIntersecting;
        go();
      }).observe(hero);
    }
  }

  function reveals() {
    if (!('IntersectionObserver' in window)) return;
    root.classList.add('motion-ok');
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add('revealed');
          io.unobserve(e.target);
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    const sel =
      '.section-head, .about-layout > *, .tl-item, .project-feature, .project-card, ' +
      '.skill-category, .cred-col, .contact-layout > *';
    for (const node of $$(sel)) {
      node.classList.add('reveal');
      io.observe(node);
    }
  }

  kit.on('ready', (data) => {
    const name = str(obj(data.hero).name);
    sectionNumbers();
    heroName(name);
    tidyHero();
    proof(data);
    heroArt(name, name ? kit.util.initials(name) : '');
    roles(data);
    projects(data);
    groups();
    credentials();
    about();
    channels();
    for (const a of $$('a[href^="http"]')) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }
    nav();
    typed(data);
    if (!kit.reducedMotion) {
      field();
      reveals();
    }
  });
})();

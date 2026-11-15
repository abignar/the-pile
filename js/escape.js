// =====================================================================
// SCHLONG WAY HOME — a puzzle-platformer for cockpile.com.
// Escape the sausage factory. Call captive cocks to follow you ("HEY!"),
// park them ("WAIT!"), sneak past the grinder-bots in the shadows, and MOAN
// to stun the bots and open escape portals for the cocks you've rescued.
// Original game, characters and art; the cocks are the site's cut-outs.
// =====================================================================
(() => {
  const VW = 480, VH = 270, T = 18, R = 2;       // view size (game px), tile size, render scale
  const GRAV = 900, JUMP = 360, SPEED = 112, SNEAK = 48;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sfx = () => (window.__pile && window.__pile.sfx) || null;
  const play = (n, ...a) => { try { const s = sfx(); s && s[n] && s[n](...a); } catch (e) {} };
  let actx = null;
  function beep(f, d = 0.08, type = 'square', vol = 0.05, slide = 1) { try { if (sfx() && !sfx().on) return; actx = actx || new (window.AudioContext || window.webkitAudioContext)(); const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime; o.type = type; o.frequency.setValueAtTime(f, t); if (slide !== 1) o.frequency.exponentialRampToValueAtTime(f * slide, t + d); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + d + 0.02); } catch (e) {} }

  // ---------- cut-outs ----------
  const SRC = (typeof CUTOUTS !== 'undefined' && CUTOUTS.length) ? CUTOUTS : ['favicon.svg'];
  const SKINS = SRC.map(src => ({ src, name: src.split('/').pop().replace(/\.[a-z]+$/i, '').replace(/-/g, ' ').toUpperCase(), img: null }));
  const loadSkins = () => Promise.all(SKINS.map(s => new Promise(res => { const im = new Image(); im.onload = () => { s.img = im; res(); }; im.onerror = res; im.src = s.src; })));

  // ---------- levels (built from simple commands so they're easy to edit) ----------
  // rows 0..14; the floor is rows 12-14, so things standing on the floor are at row 11.
  function build(w, name, fn) {
    const L = { w, name, tiles: Array.from({ length: 15 }, () => Array(w).fill('.')), shadow: Array.from({ length: 15 }, () => Array(w).fill(0)), ents: [], start: null };
    const set = (x, y, c) => { if (x >= 0 && x < w && y >= 0 && y < 15) L.tiles[y][x] = c; };
    const api = {
      ground: (x0, x1, top = 12) => { for (let x = x0; x <= x1; x++) for (let y = top; y < 15; y++) set(x, y, '#'); },
      gap: (x0, x1) => { for (let x = x0; x <= x1; x++) for (let y = 0; y < 15; y++) set(x, y, '.'); },
      grinder: (x0, x1) => { api.gap(x0, x1); for (let x = x0; x <= x1; x++) { set(x, 13, 'X'); set(x, 14, '#'); } },
      block: (x0, x1, y0, y1) => { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) set(x, y, '#'); },
      plat: (x0, x1, y) => { for (let x = x0; x <= x1; x++) set(x, y, '='); },
      spikes: (x0, x1, y = 11) => { for (let x = x0; x <= x1; x++) set(x, y, '^'); },
      shadow: (x0, x1, y0 = 0, y1 = 11) => { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) if (x >= 0 && x < w) L.shadow[y][x] = 1; },
      door: (x, y0, y1) => { for (let y = y0; y <= y1; y++) set(x, y, 'D'); },
      saw: (x, y, ax = 0, ay = 0, sp = 1.6) => L.ents.push({ k: 'saw', x: (x + 0.5) * T, y: (y + 0.5) * T, ax: ax * T, ay: ay * T, sp, ph: Math.random() * 6 }),
      lever: (x, y) => L.ents.push({ k: 'lever', x: (x + 0.5) * T, y: (y + 1) * T, on: false }),
      guard: (x, y, x0, x1) => L.ents.push({ k: 'guard', x: (x + 0.5) * T, y: (y + 1) * T, x0: x0 * T, x1: (x1 + 1) * T, dir: -1 }),
      cock: (x, y) => L.ents.push({ k: 'cock', x: (x + 0.5) * T, y: (y + 1) * T }),
      check: (x, y) => L.ents.push({ k: 'check', x: (x + 0.5) * T, y: (y + 1) * T, on: false }),
      portal: (x, y) => L.ents.push({ k: 'portal', x: (x + 0.5) * T, y: (y + 0.2) * T, open: 0 }),
      exit: (x, y) => L.ents.push({ k: 'exit', x: (x + 0.5) * T, y: (y + 1) * T }),
      sign: (x, y, text) => L.ents.push({ k: 'sign', x: (x + 0.5) * T, y: (y + 1) * T, text }),
      start: (x, y) => { L.start = { x: (x + 0.5) * T, y: (y + 1) * T }; },
    };
    fn(api); return L;
  }
  const LEVELS = [
    build(92, 'THE PACKING FLOOR', L => {
      L.ground(0, 91); L.start(2, 11);
      L.sign(5, 11, 'HEY = call a cock'); L.cock(9, 11);
      L.gap(16, 18); L.sign(13, 11, 'JUMP the gap');
      L.block(23, 24, 10, 11); L.check(28, 11);
      L.sign(31, 11, 'SNEAK in the dark');
      L.shadow(34, 43, 4, 11); L.guard(50, 11, 37, 60);
      L.cock(64, 11); L.plat(67, 71, 9); L.cock(69, 8);
      L.check(74, 11); L.sign(77, 11, 'MOAN by the portal');
      L.portal(81, 9); L.exit(88, 11);
    }),
    build(112, 'THE GRINDER', L => {
      L.ground(0, 111); L.start(2, 11); L.cock(6, 11);
      L.grinder(13, 15); L.check(19, 11);
      L.block(23, 23, 11, 11); L.block(24, 31, 10, 11); L.saw(28, 8, 0, 0); L.block(32, 32, 11, 11);
      L.plat(35, 39, 9); L.lever(37, 8); L.door(42, 4, 11); L.sign(34, 11, 'Pull the LEVER');
      L.shadow(46, 53, 4, 11); L.guard(58, 11, 47, 68); L.cock(71, 11);
      L.grinder(75, 77); L.check(81, 11); L.cock(85, 11);
      L.guard(92, 11, 87, 99); L.sign(84, 11, 'MOAN stuns bots');
      L.portal(103, 9); L.exit(108, 11);
    }),
    build(124, 'THE CASING WORKS', L => {
      L.ground(0, 123); L.start(2, 11); L.cock(7, 11);
      L.spikes(12, 14); L.check(18, 11);
      L.plat(21, 26, 9); L.plat(28, 33, 6); L.cock(31, 5); L.shadow(27, 34, 2, 6);
      L.saw(37, 9, 0, 2.2, 1.4); L.guard(44, 11, 36, 54);
      L.plat(38, 47, 6); L.shadow(38, 47, 2, 6);
      L.check(57, 11); L.grinder(60, 62); L.cock(66, 11);
      L.block(70, 71, 9, 11); L.door(78, 3, 11); L.plat(72, 75, 7); L.lever(73, 6);
      L.shadow(80, 88, 4, 11); L.guard(94, 11, 81, 101); L.cock(98, 11);
      L.portal(91, 3); L.plat(88, 93, 5); L.block(102, 102, 10, 11);
      L.check(106, 11); L.spikes(109, 110); L.cock(114, 11); L.portal(117, 9); L.exit(120, 11);
    }),
    build(136, 'THE SMOKEHOUSE', L => {
      L.ground(0, 135); L.start(2, 11); L.cock(6, 11); L.cock(9, 11);
      L.grinder(14, 16); L.check(20, 11);
      L.saw(25, 10, 3, 0, 1.2); L.saw(33, 7, 0, 2.5, 1.8);
      L.plat(30, 36, 9); L.shadow(38, 46, 3, 11); L.guard(52, 11, 39, 62); L.guard(60, 11, 48, 66);
      L.cock(68, 11); L.check(71, 11);
      L.plat(75, 79, 9); L.lever(77, 8); L.door(84, 2, 11); L.grinder(80, 82);
      L.block(87, 89, 9, 11); L.plat(91, 96, 7); L.cock(94, 6); L.shadow(90, 97, 2, 7);
      L.guard(103, 11, 90, 112); L.spikes(114, 116); L.check(119, 11); L.cock(123, 11);
      L.saw(126, 9, 0, 2, 2.2); L.portal(129, 9); L.exit(133, 11);
    }),
  ];

  // ---------- state ----------
  const G = { on: false, scene: 'title', li: 0, skin: 0, rescuedTotal: 0, totalCocks: 0, deaths: 0, msg: '', msgT: 0, t: 0 };
  let L, tiles, ents, P, cocks, guards, trail, cam = 0, bubbles = [], fx = [], doorsOpen = false, respawn, lvlRescued = 0, lvlCocks = 0;
  function solidAt(px, py, falling = false, prevBottom = 0) {
    const tx = Math.floor(px / T), ty = Math.floor(py / T);
    if (tx < 0 || tx >= L.w) return true; if (ty < 0 || ty >= 15) return false;
    const c = tiles[ty][tx];
    if (c === '#') return true;
    if (c === 'D') return !doorsOpen;
    if (c === '=' && falling && prevBottom <= ty * T + 1) return true;
    return false;
  }
  const deadlyAt = (px, py) => { const tx = Math.floor(px / T), ty = Math.floor(py / T); if (tx < 0 || tx >= L.w || ty < 0 || ty >= 15) return false; const c = tiles[ty][tx]; return c === '^' || c === 'X'; };
  const shadowAt = (px, py) => { const tx = Math.floor(px / T), ty = Math.floor(py / T); return tx >= 0 && tx < L.w && ty >= 0 && ty < 15 && L.shadow[ty][tx] === 1; };

  function startLevel(i) {
    G.li = i; L = LEVELS[i]; tiles = L.tiles.map(r => r.slice()); doorsOpen = false;
    ents = L.ents.map(e => ({ ...e }));
    const used = new Set([G.skin]);
    cocks = ents.filter(e => e.k === 'cock').map(e => { let s; do { s = Math.floor(Math.random() * SKINS.length); } while (used.has(s) && used.size < SKINS.length); used.add(s); if (used.size >= SKINS.length) used.clear(), used.add(G.skin); return { x: e.x, y: e.y, vx: 0, vy: 0, mode: 'idle', skin: s, ti: 0, face: -1, t: Math.random() * 6 }; });
    guards = ents.filter(e => e.k === 'guard').map(e => ({ ...e, state: 'patrol', alertT: 0, stun: 0, cool: 0, t: Math.random() * 6, shot: 0 }));
    lvlCocks = cocks.length; lvlRescued = 0;
    respawn = { ...L.start }; spawnPlayer();
    G.scene = 'play'; toast(`LEVEL ${i + 1}: ${L.name}`, 2.6);
    try { localStorage.setItem('schlong-level', String(i)); } catch (e) {}
  }
  function spawnPlayer() { P = { x: respawn.x, y: respawn.y, vx: 0, vy: 0, w: 12, h: 22, onGround: false, face: 1, sneak: false, dead: 0, moan: 0, moanCool: 0, talk: 0, t: 0 }; trail = [{ x: P.x, y: P.y }]; }
  function toast(m, t = 1.8) { G.msg = m; G.msgT = t; }
  function say(ent, text, t = 1.3) { bubbles.push({ ent, text, t }); }

  // ---------- DOM ----------
  const css = `
  #sch{position:fixed;inset:0;z-index:20;display:none;background:#0d0709;touch-action:none;user-select:none;-webkit-user-select:none;font-family:"Press Start 2P",monospace}
  #sch.on{display:block}
  #sch canvas{position:absolute !important;inset:auto !important;left:50% !important;top:50% !important;transform:translate(-50%,-50%);z-index:auto !important;cursor:default}
  #sch .x{position:absolute;top:calc(8px + env(safe-area-inset-top));right:8px;z-index:5;width:36px;height:36px;border-radius:50%;background:#fff;border:2px solid #3a1f2b;font:700 17px system-ui;cursor:pointer}
  #sch .spad{position:absolute;inset:auto 0 0 0;left:0;right:0;bottom:0;transform:none;z-index:3;display:none;pointer-events:none;padding:0 calc(10px + env(safe-area-inset-right)) calc(8px + env(safe-area-inset-bottom)) calc(10px + env(safe-area-inset-left));gap:0}
  #sch.touch.playing .spad{display:flex;justify-content:space-between;align-items:flex-end}
  #sch .spad button{pointer-events:auto;font:9px "Press Start 2P",monospace;color:#fff;background:rgba(255,255,255,.08);border:2px solid rgba(255,255,255,.3);border-radius:12px;box-shadow:none;touch-action:none;opacity:.8;padding:0;width:auto}
  #sch .spad button.on{background:rgba(255,90,122,.55)}
  #sch .lr{display:flex;gap:8px}#sch .lr button{width:62px;height:62px;font-size:20px}
  #sch .acts{display:grid;grid-template-columns:repeat(3,54px);gap:6px}#sch .acts button{height:42px;width:54px}
  #sch .acts .jump{grid-column:3;grid-row:1 / span 2;height:auto;background:rgba(255,90,122,.45)}
  #sch .panel{position:absolute;inset:0;z-index:4;display:none;align-items:center;justify-content:center;background:rgba(13,7,9,.86);color:#fff;text-align:center;padding:12px}
  #sch .panel.on{display:flex}
  #sch h1{font:400 clamp(30px,8vw,64px) "Bagel Fat One",system-ui;color:#ff5a7a;text-shadow:0 4px 0 #7d0f3a,0 8px 0 #3a1f2b;margin:0 0 6px;line-height:1.05}
  #sch h2{font-size:clamp(10px,2.6vw,14px);color:#ffd34a;margin:6px 0 12px}
  #sch p{font-size:9px;line-height:1.9;color:#e8d8df;margin:5px auto;max-width:560px}
  #sch .btn{font:11px "Press Start 2P",monospace;color:#fff;background:#c2185b;border:none;border-radius:8px;padding:11px 14px;margin:5px;cursor:pointer;box-shadow:0 4px 0 #7d0f3a}
  #sch .btn.alt{background:#4a4150;box-shadow:0 4px 0 #2a2430}
  #sch .pick{display:flex;align-items:center;justify-content:center;gap:14px;margin:8px 0}
  #sch .pick img{width:96px;height:96px;object-fit:contain;filter:drop-shadow(0 4px 0 rgba(0,0,0,.4))}
  #sch .pick button{font:16px system-ui;width:40px;height:40px;border-radius:50%;border:2px solid #fff;background:transparent;color:#fff;cursor:pointer}
  #sch .rot{display:none;position:absolute;inset:0;z-index:6;background:#0d0709;color:#fff;align-items:center;justify-content:center;text-align:center;font-size:11px;line-height:2;padding:24px}
  @media (orientation:portrait) and (max-width:700px){ #sch.on.playing .rot{display:flex} }
  `;
  const root = document.createElement('div'); root.id = 'sch';
  root.innerHTML = `<style>${css}</style><canvas width="${VW * R}" height="${VH * R}"></canvas><button class="x" aria-label="Close">✕</button>
    <div class="spad"><div class="lr"><button data-h="left">◀</button><button data-h="right">▶</button></div>
      <div class="acts"><button data-p="hey">HEY</button><button data-p="wait">WAIT</button><button class="jump" data-p="jump">JUMP</button><button data-h="sneak">SNEAK</button><button data-p="moan">MOAN</button></div></div>
    <div class="panel on" id="schTitle"><div><h1>SCHLONG<br>WAY HOME</h1><h2>ESCAPE THE SAUSAGE FACTORY</h2>
      <p>Lead the captive cocks to freedom. Call them with HEY, park them with WAIT. Sneak through the dark past the grinder-bots. MOAN to stun bots and open the escape portals.</p>
      <div class="pick"><button data-act="prev">◀</button><div><img id="schSkin" alt=""><p id="schSkinName"></p></div><button data-act="next">▶</button></div>
      <p class="small" id="schKeys"></p>
      <div><button class="btn" data-act="start">START</button><button class="btn alt" data-act="continue" id="schCont">CONTINUE</button></div></div></div>
    <div class="panel" id="schCard"><div><h2 id="schCardTitle"></h2><p id="schCardText"></p><div id="schCardBtns"></div></div></div>
    <div class="rot">Turn your phone sideways to play ↻</div>`;
  document.body.appendChild(root);
  const cv = root.querySelector('canvas'), ctx = cv.getContext('2d');
  const isTouch = !matchMedia('(hover:hover) and (pointer:fine)').matches; if (isTouch) root.classList.add('touch');
  root.querySelector('#schKeys').textContent = isTouch ? 'Play sideways. Buttons: move, JUMP, SNEAK (hold), HEY, WAIT, MOAN.' : 'Arrows/A-D move · W/Space jump · S/Down sneak (hold) · 1 HEY · 2 WAIT · 3 or M MOAN';
  function fit() { const s = Math.min(innerWidth / VW, innerHeight / VH); cv.style.width = Math.floor(VW * s) + 'px'; cv.style.height = Math.floor(VH * s) + 'px'; }
  addEventListener('resize', fit);
  const panels = { title: root.querySelector('#schTitle'), card: root.querySelector('#schCard') };
  function show(p) { for (const k in panels) panels[k].classList.toggle('on', k === p); root.classList.toggle('playing', !p); }
  function updatePick() { const s = SKINS[G.skin]; root.querySelector('#schSkin').src = s.src; root.querySelector('#schSkinName').textContent = s.name; }
  function card(title, text, btns) {
    root.querySelector('#schCardTitle').textContent = title; root.querySelector('#schCardText').innerHTML = text;
    const b = root.querySelector('#schCardBtns'); b.innerHTML = ''; btns.forEach(([label, fn, alt]) => { const el = document.createElement('button'); el.className = 'btn' + (alt ? ' alt' : ''); el.textContent = label; el.onclick = fn; b.appendChild(el); });
    show('card');
  }

  // ---------- input ----------
  const held = { left: 0, right: 0, sneak: 0, jumpHeld: 0 }; let pressed = new Set();
  root.querySelectorAll('[data-h]').forEach(b => { const k = b.dataset.h; b.addEventListener('pointerdown', e => { e.preventDefault(); held[k] = 1; b.classList.add('on'); }); ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => b.addEventListener(t, () => { held[k] = 0; b.classList.remove('on'); })); });
  root.querySelectorAll('[data-p]').forEach(b => { const k = b.dataset.p; b.addEventListener('pointerdown', e => { e.preventDefault(); pressed.add(k); if (k === 'jump') held.jumpHeld = 1; b.classList.add('on'); }); ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => b.addEventListener(t, () => { if (k === 'jump') held.jumpHeld = 0; b.classList.remove('on'); })); });
  const KEYS = { arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right', arrowdown: 'sneak', s: 'sneak' };
  addEventListener('keydown', e => {
    if (!G.on) return; const k = e.key.toLowerCase();
    if (k === 'escape') return close();
    if (KEYS[k]) { held[KEYS[k]] = 1; e.preventDefault(); }
    if (k === 'arrowup' || k === 'w' || k === ' ') { if (!e.repeat) pressed.add('jump'); held.jumpHeld = 1; e.preventDefault(); }
    if (k === '1' || k === 'h') pressed.add('hey'); if (k === '2' || k === 'q') pressed.add('wait'); if (k === '3' || k === 'm' || k === 'e') pressed.add('moan');
    if (k === 'enter' && G.scene !== 'play') { const b = root.querySelector('.panel.on .btn'); if (b) b.click(); }
  });
  addEventListener('keyup', e => { const k = e.key.toLowerCase(); if (KEYS[k]) held[KEYS[k]] = 0; if (k === 'arrowup' || k === 'w' || k === ' ') held.jumpHeld = 0; });
  root.querySelector('.x').onclick = () => close();
  root.addEventListener('click', e => {
    const a = e.target.dataset && e.target.dataset.act; if (!a) return;
    if (a === 'prev') { G.skin = (G.skin - 1 + SKINS.length) % SKINS.length; updatePick(); }
    if (a === 'next') { G.skin = (G.skin + 1) % SKINS.length; updatePick(); }
    if (a === 'start') { G.rescuedTotal = 0; G.totalCocks = 0; G.deaths = 0; show(null); startLevel(0); }
    if (a === 'continue') { let i = 0; try { i = +localStorage.getItem('schlong-level') || 0; } catch (err) {} show(null); startLevel(clamp(i, 0, LEVELS.length - 1)); }
  });

  // ---------- gameplay ----------
  function physics(o, dt, dropThrough = false) {
    o.vy = Math.min(o.vy + GRAV * dt, 600);
    // horizontal
    let nx = o.x + o.vx * dt; const hw = o.w / 2;
    if (o.vx !== 0) { const ex = nx + Math.sign(o.vx) * hw; if (solidAt(ex, o.y - 2) || solidAt(ex, o.y - o.h + 2) || solidAt(ex, o.y - o.h / 2)) { nx = o.x; o.hitWall = true; } else o.hitWall = false; }
    o.x = nx;
    // vertical
    const prevBottom = o.y; let ny = o.y + o.vy * dt; o.onGround = false;
    if (o.vy >= 0) { if (solidAt(o.x - hw + 1, ny, !dropThrough, prevBottom) || solidAt(o.x + hw - 1, ny, !dropThrough, prevBottom)) { ny = Math.floor(ny / T) * T; o.vy = 0; o.onGround = true; } }
    else if (solidAt(o.x - hw + 1, ny - o.h) || solidAt(o.x + hw - 1, ny - o.h)) { ny = (Math.floor((ny - o.h) / T) + 1) * T + o.h; o.vy = 0; }
    o.y = ny;
  }
  function killPlayer(how) {
    if (P.dead) return; P.dead = 0.001; G.deaths++;
    fx.push({ k: 'splat', x: P.x, y: P.y - 10, t: 0 }); play('moan', 0.5); beep(200, 0.4, 'sawtooth', 0.06, 0.3);
    toast(how || 'SPLAT!', 1.4);
  }
  function killCock(c, how) { if (c.mode === 'dead' || c.mode === 'rescued') return; c.mode = 'dead'; fx.push({ k: 'splat', x: c.x, y: c.y - 8, t: 0 }); play('moan', 0.7 + Math.random() * 0.4); toast(how || 'A cock got minced!', 1.4); }
  function guardSees(g, x, y, sneaking) {
    if (g.stun > 0 || shadowAt(x, y - 8)) return false;
    const range = (sneaking ? 3.2 : 7) * T, dx = x - g.x;
    if (Math.sign(dx) !== g.dir || Math.abs(dx) > range || Math.abs((y - 10) - (g.y - 14)) > T * 1.3) return false;
    for (let px = g.x; Math.abs(px - g.x) < Math.abs(dx); px += g.dir * 6) if (solidAt(px, g.y - 14)) return false;
    return true;
  }
  function update(dt) {
    G.t += dt; if (G.msgT > 0) G.msgT -= dt;
    // player
    if (P.dead) { P.dead += dt; if (P.dead > 1.3) { spawnPlayer(); for (const c of cocks) if (c.mode === 'follow') { c.x = respawn.x - 14; c.y = respawn.y; c.mode = 'join'; c.vx = c.vy = 0; } } }
    else {
      P.t += dt; if (P.moanCool > 0) P.moanCool -= dt; if (P.moan > 0) P.moan -= dt; if (P.talk > 0) P.talk -= dt;
      P.sneak = !!held.sneak && P.onGround;
      const sp = P.sneak ? SNEAK : SPEED, dir = (held.right ? 1 : 0) - (held.left ? 1 : 0);
      P.vx = P.moan > 0 ? 0 : dir * sp; if (dir) P.face = dir;
      if (pressed.has('jump') && P.onGround && P.moan <= 0) { P.vy = -JUMP; beep(520, 0.08, 'square', 0.03, 1.6); }
      if (!held.jumpHeld && P.vy < -120) P.vy = -120; // short hop when tapped
      physics(P, dt, held.sneak && !P.onGround ? false : !!held.sneak);
      if (P.y > 15 * T + 40) killPlayer('Fell into the works!');
      if (deadlyAt(P.x, P.y - 4) || deadlyAt(P.x, P.y - P.h / 2)) killPlayer(tiles[Math.floor((P.y - 4) / T)] && tiles[Math.floor((P.y - 4) / T)][Math.floor(P.x / T)] === 'X' ? 'Minced!' : 'Spiked!');
      const last = trail[trail.length - 1]; if (Math.hypot(P.x - last.x, P.y - last.y) > 1.2) { trail.push({ x: P.x, y: P.y }); if (trail.length > 30000) trail.splice(0, 10000); }
      // commands
      if (pressed.has('hey')) {
        say(P, 'HEY! FOLLOW ME!'); P.talk = 0.4; beep(700, 0.06); setTimeout(() => beep(900, 0.08), 70);
        let n = 0; for (const c of cocks) if ((c.mode === 'idle' || c.mode === 'wait') && Math.hypot(c.x - P.x, c.y - P.y) < 10 * T) { c.mode = 'join'; n++; setTimeout(() => say(c, pickLine(['OK!', 'COMING!', 'RIGHT BEHIND YOU', 'YES BOSS'])), 250 + n * 150); }
      }
      if (pressed.has('wait')) {
        say(P, 'WAIT HERE!'); P.talk = 0.4; beep(500, 0.08);
        let n = 0; for (const c of cocks) if ((c.mode === 'follow' || c.mode === 'join') && Math.hypot(c.x - P.x, c.y - P.y) < 9 * T) { c.mode = 'wait'; n++; setTimeout(() => say(c, pickLine(['OK...', 'WAITING', 'HURRY BACK'])), 200 + n * 150); }
      }
      if (pressed.has('moan') && P.moanCool <= 0) {
        P.moan = 0.7; P.moanCool = 2.2; play('moan', 0.75 + Math.random() * 0.3); fx.push({ k: 'ring', x: P.x, y: P.y - 12, t: 0 });
        for (const g of guards) if (!g.dead && Math.hypot(g.x - P.x, g.y - P.y) < 7 * T) { g.stun = 4; g.state = 'patrol'; g.alertT = 0; }
        for (const e of ents) if (e.k === 'portal' && Math.hypot(e.x - P.x, e.y - P.y) < 5 * T) { if (!e.open) beep(300, 0.4, 'sine', 0.06, 3); e.open = 10; }
      }
      // touch things
      for (const e of ents) {
        const d = Math.hypot(e.x - P.x, (e.y - 8) - (P.y - 10));
        if (e.k === 'lever' && !e.on && d < 14) { e.on = true; doorsOpen = true; toast('CLUNK! A door opened.'); beep(140, 0.2, 'square', 0.07, 0.5); }
        if (e.k === 'check' && !e.on && d < 16) { ents.forEach(x => { if (x.k === 'check') x.on = false; }); e.on = true; respawn = { x: e.x, y: e.y }; toast('CHECKPOINT'); beep(880, 0.1, 'triangle'); }
        if (e.k === 'exit' && d < 16) { levelDone(); return; }
      }
    }
    // saws
    for (const e of ents) if (e.k === 'saw') {
      const s = Math.sin(G.t * e.sp + e.ph); e.cx = e.x + s * e.ax; e.cy = e.y + s * e.ay;
      if (!P.dead && Math.hypot(P.x - e.cx, P.y - 11 - e.cy) < 13) killPlayer('Sliced!');
      for (const c of cocks) if (Math.hypot(c.x - e.cx, c.y - 9 - e.cy) < 12) killCock(c, 'A cock got sliced!');
    }
    for (const e of ents) if (e.k === 'portal' && e.open > 0) e.open -= dt;
    // guards
    for (const g of guards) {
      g.t += dt; if (g.cool > 0) g.cool -= dt; if (g.shot > 0) g.shot -= dt;
      if (g.stun > 0) { g.stun -= dt; continue; }
      // who can it see?
      let target = null;
      if (!P.dead && guardSees(g, P.x, P.y, P.sneak)) target = P;
      if (!target) for (const c of cocks) if ((c.mode === 'follow' || c.mode === 'join' || c.mode === 'wait' || c.mode === 'idle') && c.mode !== 'idle' && guardSees(g, c.x, c.y, false)) { target = c; break; }
      if (target) {
        if (g.state !== 'alert') { g.state = 'alert'; g.alertT = 0.75; say(g, '!', 0.7); beep(1200, 0.12, 'square', 0.05); }
        g.alertT -= dt;
        if (g.alertT <= 0 && g.cool <= 0) { // fire
          g.cool = 1.1; g.shot = 0.15; g.shotTo = { x: target.x, y: target.y - 10 }; beep(90, 0.25, 'sawtooth', 0.07, 0.5); play('bump', 1, 1.6);
          if (target === P) killPlayer('Ground up by a bot!'); else killCock(target, 'A bot got one!');
        }
      } else {
        if (g.state === 'alert') { g.state = 'patrol'; say(g, '?', 0.8); }
        g.x += g.dir * 32 * dt;
        if (g.x < g.x0 + 6) g.dir = 1; if (g.x > g.x1 - 6) g.dir = -1;
        if (solidAt(g.x + g.dir * 10, g.y - 10)) g.dir *= -1;
      }
    }
    // cocks
    let rank = 0;
    for (const c of cocks) {
      c.t += dt;
      if (c.mode === 'rescued' || c.mode === 'dead') { if (c.fly !== undefined) c.fly += dt; continue; }
      if (c.mode === 'join') { // walk over to your trail
        const dx = P.x - c.x; c.vx = Math.abs(dx) > 10 ? Math.sign(dx) * 80 : 0; c.face = Math.sign(dx) || c.face; c.w = 10; c.h = 18; physics(c, dt);
        if (c.hitWall && c.onGround) c.vy = -JUMP * 0.9;
        let best = -1, bd = 12; for (let i = trail.length - 1; i >= Math.max(0, trail.length - 600); i--) { const d = Math.hypot(trail[i].x - c.x, trail[i].y - c.y); if (d < bd) { bd = d; best = i; } }
        if (best >= 0) { c.mode = 'follow'; c.ti = best; }
        if (c.y > 15 * T + 40) killCock(c, 'A cock fell in!');
      } else if (c.mode === 'follow') { // walk your exact path, a little behind
        const target = Math.max(0, trail.length - 1 - 16 * (rank + 1)); rank++;
        const step = 2.4, prev = trail[c.ti];
        if (c.ti < target) c.ti = Math.min(target, c.ti + step); else if (c.ti > target + 30) c.ti = Math.max(target, c.ti - 0.5);
        const p = trail[Math.floor(c.ti)]; if (p) { c.face = p.x > prev.x ? 1 : p.x < prev.x ? -1 : c.face; c.x = p.x; c.y = p.y; }
      }
      if (deadlyAt(c.x, c.y - 4)) killCock(c, 'A cock got minced!');
      // escape
      for (const e of ents) {
        if (e.k === 'portal' && e.open > 0 && Math.abs(c.x - e.x) < 16 && Math.abs((c.y - 9) - e.y) < 22 && c.mode !== 'idle') rescue(c, e);
        if (e.k === 'exit' && Math.hypot(c.x - e.x, c.y - e.y) < 18 && (c.mode === 'follow' || c.mode === 'join')) rescue(c, e);
      }
    }
    bubbles = bubbles.filter(b => (b.t -= dt) > 0);
    fx = fx.filter(f => (f.t += dt) < 1.2);
    cam = clamp(P.x - VW * 0.42, 0, L.w * T - VW);
    pressed.clear();
  }
  function rescue(c, e) { c.mode = 'rescued'; c.fly = 0; c.fx = e.x; c.fy = e.y; lvlRescued++; say(c, pickLine(['FREEDOM!', 'WHEEE!', 'THANK YOU!', 'SEE YA!']), 1); play('moan', 1.2 + Math.random() * 0.3); beep(660, 0.1, 'triangle'); setTimeout(() => beep(990, 0.12, 'triangle'), 90); }
  const pickLine = a => a[Math.floor(Math.random() * a.length)];
  function levelDone() {
    // followers right behind you come along
    for (const c of cocks) if ((c.mode === 'follow' || c.mode === 'join') && Math.hypot(c.x - P.x, c.y - P.y) < 6 * T) { c.mode = 'rescued'; lvlRescued++; }
    G.rescuedTotal += lvlRescued; G.totalCocks += lvlCocks; G.scene = 'card';
    play('throw', 1); play('moan', 1.1);
    const last = G.li === LEVELS.length - 1;
    if (last) {
      try { localStorage.removeItem('schlong-level'); } catch (e) {}
      card('YOU MADE IT HOME!', `You rescued <b>${G.rescuedTotal}</b> of ${G.totalCocks} cocks<br>and splatted ${G.deaths} time${G.deaths === 1 ? '' : 's'}.<br><br>${G.rescuedTotal === G.totalCocks ? 'Every last one. A true hero.' : 'Some were left behind... play again to save them all.'}`,
        [['PLAY AGAIN', () => { show('title'); G.scene = 'title'; }], ['CLOSE', () => close(), true]]);
    } else {
      card(`LEVEL ${G.li + 1} CLEAR`, `${L.name}<br><br>Rescued <b>${lvlRescued}</b> of ${lvlCocks} cocks.`, [['NEXT LEVEL', () => { show(null); startLevel(G.li + 1); }], ['RETRY', () => { show(null); G.rescuedTotal -= lvlRescued; G.totalCocks -= lvlCocks; startLevel(G.li); }, true]]);
    }
  }

  // ---------- drawing ----------
  // a factory backdrop: chimneys, pipes and a sausage conveyor, drawn once
  const back = document.createElement('canvas'); back.width = 960 * R; back.height = VH * R;
  (() => { const g = back.getContext('2d'); g.scale(R, R);
    const sky = g.createLinearGradient(0, 0, 0, VH); sky.addColorStop(0, '#2a1018'); sky.addColorStop(1, '#5a2232'); g.fillStyle = sky; g.fillRect(0, 0, 960, VH);
    for (let i = 0; i < 18; i++) { const x = i * 56 + rnd(-10, 10), h = rnd(70, 170), w = rnd(30, 60); g.fillStyle = '#1e0b12'; g.fillRect(x, VH - h, w, h); if (Math.random() < 0.5) { g.fillRect(x + w * 0.3, VH - h - 50, 10, 50); } for (let k = 0; k < 6; k++) { g.fillStyle = Math.random() < 0.3 ? 'rgba(255,190,90,.6)' : 'rgba(255,190,90,.12)'; g.fillRect(x + 5 + (k % 3) * 9, VH - h + 12 + Math.floor(k / 3) * 14, 5, 7); } }
  })();
  const mid = document.createElement('canvas'); mid.width = 720 * R; mid.height = VH * R;
  (() => { const g = mid.getContext('2d'); g.scale(R, R);
    for (let i = 0; i < 5; i++) { const y = 40 + i * 30; g.strokeStyle = 'rgba(120,70,80,.55)'; g.lineWidth = 6; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= 720; x += 90) g.lineTo(x, y + (x / 90 % 2 ? 12 : 0)); g.stroke(); }
    for (let x = 0; x < 720; x += 120) { g.fillStyle = 'rgba(70,35,45,.8)'; g.fillRect(x + 20, 0, 14, VH); }
  })();
  function tileArt(c, x, y) {
    const px = x * T, py = y * T;
    if (c === '#' ) { const top = y === 0 || tiles[y - 1][x] !== '#'; ctx.fillStyle = '#4b3a42'; ctx.fillRect(px, py, T, T); ctx.fillStyle = '#5f4b54'; ctx.fillRect(px + 1, py + 1, T - 2, T - 2); ctx.fillStyle = '#3a2c33'; ctx.fillRect(px + 2, py + 2, 2, 2); ctx.fillRect(px + T - 4, py + 2, 2, 2); ctx.fillRect(px + 2, py + T - 4, 2, 2); ctx.fillRect(px + T - 4, py + T - 4, 2, 2); if (top) { ctx.fillStyle = '#c9a24e'; ctx.fillRect(px, py, T, 3); ctx.fillStyle = '#3a2c33'; for (let k = 0; k < T; k += 6) ctx.fillRect(px + k, py, 3, 3); } }
    else if (c === '=') { ctx.fillStyle = '#6b5a62'; ctx.fillRect(px, py, T, 4); ctx.fillStyle = '#2a2026'; for (let k = 1; k < T; k += 4) ctx.fillRect(px + k, py + 1, 2, 2); ctx.fillStyle = '#4b3a42'; ctx.fillRect(px + 2, py + 4, 2, 6); ctx.fillRect(px + T - 4, py + 4, 2, 6); }
    else if (c === '^') { ctx.fillStyle = '#b8b8c0'; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(px + k * 6, py + T); ctx.lineTo(px + k * 6 + 3, py + 6); ctx.lineTo(px + k * 6 + 6, py + T); ctx.fill(); } ctx.fillStyle = '#c0392b'; for (let k = 0; k < 3; k++) ctx.fillRect(px + k * 6 + 2, py + 7, 2, 2); }
    else if (c === 'X') { ctx.fillStyle = '#2a1518'; ctx.fillRect(px, py, T, T); ctx.save(); ctx.translate(px + T / 2, py + T / 2); ctx.rotate(G.t * 8 * (x % 2 ? 1 : -1)); ctx.fillStyle = '#9a9aa4'; for (let k = 0; k < 6; k++) { ctx.rotate(Math.PI / 3); ctx.fillRect(-2, -T / 2, 4, 7); } ctx.restore(); ctx.fillStyle = 'rgba(190,40,60,.5)'; ctx.fillRect(px, py + T - 5, T, 5); }
    else if (c === 'D') { if (doorsOpen) { ctx.fillStyle = 'rgba(80,60,70,.35)'; ctx.fillRect(px + 3, py, T - 6, 3); } else { ctx.fillStyle = '#7a6a2a'; ctx.fillRect(px + 2, py, T - 4, T); ctx.fillStyle = '#2a2026'; for (let k = 0; k < T; k += 6) ctx.fillRect(px + 2, py + k, T - 4, 2); ctx.fillStyle = '#e2b13c'; ctx.fillRect(px + 2, py, 2, T); } }
  }
  function drawSkin(skin, x, y, h, face, opts = {}) {
    const s = SKINS[skin]; if (!s || !s.img) return; const im = s.img, k = h / im.height, w = im.width * k;
    const sq = opts.squash || 0;
    ctx.save(); ctx.translate(x, y); ctx.scale(face < 0 ? -1 : 1, 1); ctx.rotate(opts.lean || 0); ctx.scale(1 + sq, 1 - sq);
    if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
    ctx.drawImage(im, -w / 2, -h, w, h); ctx.restore();
  }
  function drawGuard(g) {
    const x = g.x, y = g.y, step = Math.sin(g.t * 9) * (g.state === 'patrol' && g.stun <= 0 ? 2 : 0);
    // vision cone (so you can plan your sneaking)
    if (g.stun <= 0) { const len = 7 * T; ctx.fillStyle = g.state === 'alert' ? 'rgba(255,40,40,.22)' : 'rgba(255,220,90,.10)'; ctx.beginPath(); ctx.moveTo(x + g.dir * 6, y - 22); ctx.lineTo(x + g.dir * len, y - 34); ctx.lineTo(x + g.dir * len, y - 2); ctx.closePath(); ctx.fill(); }
    ctx.save(); ctx.translate(x, y); ctx.scale(g.dir, 1);
    ctx.fillStyle = '#2a2026'; ctx.fillRect(-8, -6 + step, 5, 6); ctx.fillRect(3, -6 - step, 5, 6);              // legs
    const body = ctx.createLinearGradient(-12, 0, 12, 0); body.addColorStop(0, '#5b6168'); body.addColorStop(0.5, '#9aa1a8'); body.addColorStop(1, '#4a4f55');
    ctx.fillStyle = body; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-12, -32, 22, 27, 4) : ctx.rect(-12, -32, 22, 27); ctx.fill();
    ctx.fillStyle = '#2a2026'; ctx.fillRect(-12, -18, 22, 2); ctx.fillStyle = '#c9a24e'; for (let k = 0; k < 4; k++) ctx.fillRect(-10 + k * 5, -10, 3, 3);
    ctx.fillStyle = '#1a1214'; ctx.fillRect(-4, -29, 13, 7);                                                       // visor
    ctx.fillStyle = g.stun > 0 ? '#6b6b6b' : g.state === 'alert' ? '#ff2b2b' : '#ffb02b'; ctx.fillRect(2, -27, 5, 3); // eye
    ctx.save(); ctx.translate(12, -14); ctx.rotate(g.t * (g.state === 'alert' ? 30 : 10)); ctx.fillStyle = '#c7c7cf'; for (let k = 0; k < 8; k++) { ctx.rotate(Math.PI / 4); ctx.fillRect(-1.5, -9, 3, 5); } ctx.fillStyle = '#6b6b75'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, 7); ctx.fill(); ctx.restore(); // grinder
    ctx.restore();
    if (g.stun > 0) { for (let k = 0; k < 3; k++) { const a = G.t * 5 + k * 2.1; ctx.fillStyle = '#ffd34a'; ctx.fillText('*', x + Math.cos(a) * 9 - 3, y - 40 + Math.sin(a) * 3); } }
    if (g.shot > 0 && g.shotTo) { ctx.strokeStyle = 'rgba(255,240,230,.95)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + g.dir * 14, y - 14); ctx.lineTo(g.shotTo.x, g.shotTo.y); ctx.stroke(); }
  }
  function txt(s, x, y, col = '#fff', size = 8, align = 'center') { ctx.font = `${size}px "Press Start 2P", monospace`; ctx.textAlign = align; ctx.textBaseline = 'top'; ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillText(s, x + 1, y + 1); ctx.fillStyle = col; ctx.fillText(s, x, y); ctx.textAlign = 'left'; }
  function bubble(x, y, text) {
    ctx.font = '6px "Press Start 2P", monospace'; const w = ctx.measureText(text).width + 8;
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#2a1520'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - w / 2, y - 14, w, 12, 4) : ctx.rect(x - w / 2, y - 14, w, 12); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 3, y - 2); ctx.lineTo(x, y + 3); ctx.lineTo(x + 3, y - 2); ctx.fill();
    ctx.fillStyle = '#2a1520'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(text, x, y - 11); ctx.textAlign = 'left';
  }
  function draw() {
    ctx.setTransform(R, 0, 0, R, 0, 0);
    // parallax backdrop
    const bx = -(cam * 0.2) % 960; ctx.drawImage(back, 0, 0, back.width, back.height, bx, 0, 960, VH); ctx.drawImage(back, 0, 0, back.width, back.height, bx + 960, 0, 960, VH);
    const mx = -(cam * 0.5) % 720; ctx.drawImage(mid, 0, 0, mid.width, mid.height, mx, 0, 720, VH); ctx.drawImage(mid, 0, 0, mid.width, mid.height, mx + 720, 0, 720, VH);
    // a sausage conveyor in the background
    ctx.fillStyle = 'rgba(40,20,26,.9)'; ctx.fillRect(0, 150, VW, 8);
    for (let i = -1; i < 16; i++) { const x = ((i * 34 + G.t * 22 - cam * 0.5) % (16 * 34) + 16 * 34) % (16 * 34) - 34; ctx.fillStyle = '#b8564a'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, 142, 26, 8, 4) : ctx.rect(x, 142, 26, 8); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(x + 4, 143, 14, 2); }
    ctx.save(); ctx.translate(-Math.round(cam), 0);
    const x0 = Math.max(0, Math.floor(cam / T)), x1 = Math.min(L.w - 1, x0 + Math.ceil(VW / T) + 1);
    for (let y = 0; y < 15; y++) for (let x = x0; x <= x1; x++) { const c = tiles[y][x]; if (c !== '.') tileArt(c, x, y); }
    // things
    for (const e of ents) {
      if (e.x < cam - 40 || e.x > cam + VW + 40) continue;
      if (e.k === 'sign') { ctx.fillStyle = '#3a2c33'; ctx.fillRect(e.x - 1, e.y - 16, 2, 16); ctx.font = '5px "Press Start 2P", monospace'; const w = ctx.measureText(e.text).width + 8; ctx.fillStyle = '#e8d8b0'; ctx.fillRect(e.x - w / 2, e.y - 28, w, 12); ctx.fillStyle = '#3a1f2b'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(e.text, e.x, e.y - 25); ctx.textAlign = 'left'; }
      if (e.k === 'lever') { ctx.fillStyle = '#3a2c33'; ctx.fillRect(e.x - 6, e.y - 4, 12, 4); ctx.save(); ctx.translate(e.x, e.y - 4); ctx.rotate(e.on ? 0.7 : -0.7); ctx.fillStyle = '#8a8a94'; ctx.fillRect(-1.5, -14, 3, 14); ctx.fillStyle = e.on ? '#3fae49' : '#e0413b'; ctx.beginPath(); ctx.arc(0, -15, 3.5, 0, 7); ctx.fill(); ctx.restore(); }
      if (e.k === 'check') { ctx.fillStyle = '#3a2c33'; ctx.fillRect(e.x - 1, e.y - 26, 2, 26); ctx.fillStyle = e.on ? '#3fe0a0' : '#5a4a52'; ctx.beginPath(); ctx.arc(e.x, e.y - 28, 4, 0, 7); ctx.fill(); if (e.on) { ctx.fillStyle = 'rgba(63,224,160,.25)'; ctx.beginPath(); ctx.arc(e.x, e.y - 28, 9, 0, 7); ctx.fill(); } }
      if (e.k === 'exit') { ctx.fillStyle = '#1a1214'; ctx.fillRect(e.x - 12, e.y - 36, 24, 36); ctx.fillStyle = '#3a2c33'; ctx.fillRect(e.x - 14, e.y - 38, 28, 3); ctx.fillStyle = `rgba(63,224,160,${0.6 + Math.sin(G.t * 4) * 0.3})`; ctx.font = '6px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillText('EXIT', e.x, e.y - 48); ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,200,120,.25)'; ctx.fillRect(e.x - 10, e.y - 34, 20, 34); }
      if (e.k === 'portal') { const open = e.open > 0; for (let k = 0; k < 4; k++) { ctx.strokeStyle = open ? `rgba(255,${120 + k * 30},${180 + k * 15},${0.9 - k * 0.15})` : 'rgba(255,150,200,.25)'; ctx.lineWidth = open ? 3 : 1.5; ctx.beginPath(); ctx.ellipse(e.x, e.y, 10 + k * 4 + (open ? Math.sin(G.t * 6 + k) * 2 : 0), 16 + k * 5, open ? G.t * (k % 2 ? 2 : -2) : 0, 0, 7); ctx.stroke(); } if (open) { ctx.fillStyle = 'rgba(255,170,210,.25)'; ctx.beginPath(); ctx.ellipse(e.x, e.y, 10, 16, 0, 0, 7); ctx.fill(); } }
      if (e.k === 'saw' && e.cx !== undefined) { if (e.ax || e.ay) { ctx.strokeStyle = 'rgba(60,40,50,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(e.x - e.ax, e.y - e.ay); ctx.lineTo(e.x + e.ax, e.y + e.ay); ctx.stroke(); } ctx.save(); ctx.translate(e.cx, e.cy); ctx.rotate(G.t * 14); ctx.fillStyle = '#c7c7cf'; for (let k = 0; k < 10; k++) { ctx.rotate(Math.PI / 5); ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(4, -7); ctx.lineTo(-2, -7); ctx.fill(); } ctx.beginPath(); ctx.arc(0, 0, 8, 0, 7); ctx.fill(); ctx.fillStyle = '#6b6b75'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, 7); ctx.fill(); ctx.restore(); }
    }
    for (const g of guards) drawGuard(g);
    for (const c of cocks) {
      if (c.mode === 'dead') continue;
      if (c.mode === 'rescued') { if (c.fly !== undefined && c.fly < 1) { const k = c.fly; drawSkin(c.skin, c.fx, c.fy + 10 - k * 20, 20 * (1 - k), c.face, { lean: k * 6, alpha: 1 - k }); } continue; }
      const walk = c.mode === 'follow' || c.mode === 'join' ? Math.sin(c.t * 14) * 0.08 : 0;
      drawSkin(c.skin, c.x, c.y, 25, c.face, { lean: walk, squash: c.mode === 'idle' ? Math.sin(c.t * 2) * 0.04 : 0 });
      if (c.mode === 'idle' && Math.sin(c.t * 3) > 0.6) { ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.font = '6px "Press Start 2P", monospace'; ctx.fillText('?', c.x - 2, c.y - 28); }
    }
    if (!P.dead) {
      const moving = Math.abs(P.vx) > 1 && P.onGround;
      drawSkin(G.skin, P.x, P.y, P.sneak ? 24 : 31, P.face, { lean: moving ? Math.sin(P.t * 16) * 0.1 : (P.onGround ? 0 : -0.15 * P.face), squash: P.sneak ? 0.12 : P.moan > 0 ? Math.sin(P.t * 30) * 0.06 : 0 });
    }
    // shadows over everything that's hidden in them
    ctx.fillStyle = 'rgba(8,2,6,.62)';
    for (let y = 0; y < 15; y++) for (let x = x0; x <= x1; x++) if (L.shadow[y][x]) ctx.fillRect(x * T, y * T, T, T);
    // effects
    for (const f of fx) {
      if (f.k === 'splat') { const a = 1 - f.t / 1.2; ctx.fillStyle = `rgba(184,66,74,${a})`; for (let k = 0; k < 9; k++) { const ang = k * 0.7, d = f.t * 40; ctx.beginPath(); ctx.arc(f.x + Math.cos(ang) * d, f.y + Math.sin(ang) * d * 0.6, 3 * a + 1, 0, 7); ctx.fill(); } }
      if (f.k === 'ring') { ctx.strokeStyle = `rgba(255,140,190,${1 - f.t / 1.2})`; ctx.lineWidth = 2; for (let k = 0; k < 3; k++) { const rr = f.t * 110 - k * 16; if (rr <= 0) continue; ctx.beginPath(); ctx.arc(f.x, f.y, rr, 0, 7); ctx.stroke(); } }
    }
    for (const b of bubbles) { const e = b.ent; if (!e || (e.mode === 'dead')) continue; bubble(e.x, e.y - (e === P ? 30 : e.k === 'guard' ? 40 : 26), b.text); }
    ctx.restore();
    // HUD
    const safe = cocks.filter(c => c.mode === 'rescued').length, lost = cocks.filter(c => c.mode === 'dead').length;
    txt(`RESCUED ${safe}/${lvlCocks}`, 6, 6, '#3fe0a0', 7, 'left'); if (lost) txt(`LOST ${lost}`, 6, 17, '#ff6b6b', 7, 'left');
    txt(`LEVEL ${G.li + 1}`, VW / 2, 6, '#ffd34a', 7);
    if (P.moanCool > 0) txt('MOAN ' + '.'.repeat(Math.ceil(P.moanCool * 2)), VW / 2, 17, '#ff9ec4', 6);
    if (G.msgT > 0) txt(G.msg, VW / 2, 36, '#fff', 8);
  }

  // ---------- loop ----------
  let last = 0, raf = 0;
  function loop(now) {
    if (!G.on) return;
    const dt = Math.min(0.033, (now - last) / 1000 || 0.016); last = now;
    if (G.scene === 'play') update(dt);
    if (L) draw(); else { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#0d0709'; ctx.fillRect(0, 0, cv.width, cv.height); }
    raf = requestAnimationFrame(loop);
  }
  let loaded = null;
  function open() {
    root.classList.add('on'); G.on = true; window.__rpgOpen = true; fit();
    show('title'); G.scene = 'title';
    if (!loaded) loaded = Promise.all([loadSkins(), document.fonts ? document.fonts.load('8px "Press Start 2P"') : null]);
    loaded.then(() => {
      updatePick(); let has = false; try { has = localStorage.getItem('schlong-level') !== null; } catch (e) {} root.querySelector('#schCont').style.display = has ? '' : 'none';
      if (!L) { L = LEVELS[0]; tiles = L.tiles; ents = L.ents.map(e => ({ ...e })); cocks = []; guards = []; respawn = L.start; spawnPlayer(); }
      cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(loop);
    });
  }
  function close() { G.on = false; window.__rpgOpen = false; root.classList.remove('on'); cancelAnimationFrame(raf); }
  window.Schlong = { open, close, G, get P() { return P; }, get cocks() { return cocks; }, get guards() { return guards; }, get ents() { return ents; }, startLevel, LEVELS, press: k => pressed.add(k), held };
})();

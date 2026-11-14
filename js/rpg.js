// =====================================================================
// COCK QUEST — a little handheld-style monster-battling RPG for cockpile.com
// Pick a cock, wander an 8-bit world, battle wild cocks in the tall grass,
// level up, and take on the four bosses at the edges of the map.
// Uses the cut-outs listed in CUTOUTS (index.html). Saves in this browser.
// =====================================================================
(() => {
  const SW = 160, SH = 144, T = 16;            // screen size and tile size (in game pixels)
  const MAP = 120, C = 60;                      // map is MAP x MAP tiles, centre at (C, C)
  const ZONES = [                               // rings outward from the centre
    { name: 'MEADOW',   upto: 14, lv: [2, 5],   ground: '#9ad66f', speck: '#7fbf5a', tall: '#3f8f3a', tallHi: '#62b04f', path: '#e3cf92', obst: 'tree',   density: 0.05 },
    { name: 'FOREST',   upto: 28, lv: [6, 10],  ground: '#6aa556', speck: '#578f46', tall: '#2c6a33', tallHi: '#3f8a42', path: '#c9b07a', obst: 'tree',   density: 0.16 },
    { name: 'DESERT',   upto: 42, lv: [11, 15], ground: '#ecd189', speck: '#d9b96a', tall: '#b9944a', tallHi: '#d0ad5e', path: '#f5e3b0', obst: 'cactus', density: 0.08 },
    { name: 'FROST',    upto: 54, lv: [16, 21], ground: '#eef6fa', speck: '#d3e6ef', tall: '#9cc4d6', tallHi: '#bcdce8', path: '#d9e2e6', obst: 'pine',   density: 0.12 },
    { name: 'BADLANDS', upto: 99, lv: [22, 26], ground: '#9b7aa0', speck: '#866689', tall: '#5e4266', tallHi: '#74557c', path: '#b9a0bd', obst: 'rock',   density: 0.13 },
  ];
  const BOSSES = [ // at the four far ends of the cross-shaped paths
    { x: C, y: 2, lv: 22 }, { x: MAP - 3, y: C, lv: 26 }, { x: C, y: MAP - 3, lv: 30 }, { x: 2, y: C, lv: 35 },
  ];
  const MOVES = {
    SLAP:        { pow: 40, acc: 100, pp: 30 },
    HEADBUTT:    { pow: 60, acc: 90,  pp: 20 },
    SQUIRT:      { pow: 50, acc: 100, pp: 20 },
    'BALL BASH': { pow: 75, acc: 85,  pp: 12 },
    THRUST:      { pow: 90, acc: 75,  pp: 8 },
    SPIN:        { pow: 20, acc: 95,  pp: 15, hits: [2, 4] },
    WOBBLE:      { pow: 0,  acc: 95,  pp: 15, fx: 'defdown' },
    SWELL:       { pow: 0,  acc: 100, pp: 10, fx: 'atkup' },
    'LUBE UP':   { pow: 0,  acc: 100, pp: 5,  fx: 'heal' },
  };
  const XP_BASE = 100, BOSS_XP = 260;
  const xpFor = L => Math.floor(0.6 * L * L * L);

  // ---------- seeded randomness ----------
  function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const hash = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));

  // ---------- species from the cut-outs ----------
  const SRC = (typeof CUTOUTS !== 'undefined' && CUTOUTS.length) ? CUTOUTS : ['favicon.svg'];
  const nameOf = src => src.split('/').pop().replace(/\.[a-z]+$/i, '').replace(/-/g, ' ').toUpperCase();
  const species = SRC.map(src => ({ src, name: nameOf(src), img: null, spr: {}, ready: false }));

  // pixel-art sprite from a cut-out: shrink, hard alpha, posterise colours, dark outline
  function pixelSprite(img, size, flip = false) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const x = c.getContext('2d'); const k = (size - 2) / Math.max(img.width, img.height);
    const w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k));
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    if (flip) { x.translate(size, 0); x.scale(-1, 1); }
    x.drawImage(img, Math.round((size - w) / 2), size - 1 - h, w, h);
    x.setTransform(1, 0, 0, 1, 0, 0);
    const d = x.getImageData(0, 0, size, size), p = d.data, solid = new Uint8Array(size * size);
    const q = v => Math.round(v / 255 * 5) / 5 * 255;
    for (let i = 0; i < size * size; i++) {
      if (p[i * 4 + 3] > 110) { solid[i] = 1; p[i * 4] = q(p[i * 4]); p[i * 4 + 1] = q(p[i * 4 + 1]); p[i * 4 + 2] = q(p[i * 4 + 2]); p[i * 4 + 3] = 255; }
      else p[i * 4 + 3] = 0;
    }
    for (let y = 0; y < size; y++) for (let xx = 0; xx < size; xx++) {
      const i = y * size + xx; if (solid[i]) continue;
      const n = (xx > 0 && solid[i - 1]) || (xx < size - 1 && solid[i + 1]) || (y > 0 && solid[i - size]) || (y < size - 1 && solid[i + size]);
      if (n) { p[i * 4] = 32; p[i * 4 + 1] = 20; p[i * 4 + 2] = 28; p[i * 4 + 3] = 255; }
    }
    x.putImageData(d, 0, 0);
    return c;
  }
  function loadSpecies() {
    return Promise.all(species.map(s => new Promise(res => {
      const im = new Image();
      im.onload = () => { s.img = im; s.spr.front = pixelSprite(im, 52); s.spr.back = pixelSprite(im, 56, true); s.spr.big = pixelSprite(im, 64); s.spr.mini = pixelSprite(im, 16); s.spr.miniL = pixelSprite(im, 16, true); s.ready = true; res(); };
      im.onerror = res; im.src = s.src;
    })));
  }

  // ---------- stats ----------
  // every species gets the same stat total, split randomly, so all picks are fair
  function rollSpecies(seed) {
    const r = rng(seed);
    return species.map(() => {
      const w = [r() + 0.3, r() + 0.3, r() + 0.3, r() + 0.3], sum = w.reduce((a, b) => a + b);
      const base = w.map(v => 50 + Math.round(v / sum * 120)); // HP ATK DEF SPD, total ~320
      const pool = ['SQUIRT', 'BALL BASH', 'THRUST', 'SPIN', 'WOBBLE', 'SWELL', 'LUBE UP'].sort(() => r() - 0.5);
      return { base: { hp: base[0], atk: base[1], def: base[2], spd: base[3] }, moves: [r() < 0.5 ? 'SLAP' : 'HEADBUTT', ...pool.slice(0, 3)] };
    });
  }
  function statsAt(b, L, boss = 1) {
    return { hp: Math.floor((2 * b.hp * L / 100 + L + 10) * boss), atk: Math.floor((2 * b.atk * L / 100 + 5) * boss), def: Math.floor((2 * b.def * L / 100 + 5) * boss), spd: Math.floor((2 * b.spd * L / 100 + 5) * boss) };
  }
  function makeMon(si, L, boss = false) {
    const sp = save.species[si], st = statsAt(sp.base, L, boss ? 1.25 : 1);
    return { si, L, boss, name: (boss ? 'BOSS ' : '') + species[si].name, ...st, maxhp: st.hp, moves: sp.moves.map(m => ({ name: m, pp: MOVES[m].pp })), atkS: 0, defS: 0 };
  }

  // ---------- the world ----------
  // tiles: 0 ground, 1 tall grass, 2 obstacle, 3 path, 4 heal pad, 5 boss pedestal, 6 border
  let map = null;
  const zoneAt = (x, y) => { const d = Math.max(Math.abs(x - C), Math.abs(y - C)); return ZONES.findIndex(z => d < z.upto); };
  function genMap(seed) {
    const m = new Uint8Array(MAP * MAP), s = seed % 100000;
    const noise = (x, y) => { // smooth-ish blobs for tall grass patches
      let v = 0; for (const [f, a] of [[0.09, 1], [0.21, 0.5], [0.45, 0.25]]) {
        const fx = x * f, fy = y * f, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
        const sm = t => t * t * (3 - 2 * t), a00 = hash(x0, y0, s + f * 1000), a10 = hash(x0 + 1, y0, s + f * 1000), a01 = hash(x0, y0 + 1, s + f * 1000), a11 = hash(x0 + 1, y0 + 1, s + f * 1000);
        v += a * ((a00 * (1 - sm(tx)) + a10 * sm(tx)) * (1 - sm(ty)) + (a01 * (1 - sm(tx)) + a11 * sm(tx)) * sm(ty));
      } return v / 1.75; };
    for (let y = 0; y < MAP; y++) for (let x = 0; x < MAP; x++) {
      const i = y * MAP + x, d = Math.max(Math.abs(x - C), Math.abs(y - C)), z = ZONES[zoneAt(x, y)];
      if (d >= MAP / 2 - 1) { m[i] = 6; continue; }
      const onPath = (x === C || x === C - 1 || y === C || y === C - 1) && d <= MAP / 2 - 2;
      if (onPath) { m[i] = 3; continue; }
      if (d < 3) { m[i] = 0; continue; }
      if (noise(x, y) > 0.52) m[i] = 1;
      if (hash(x, y, s + 7) < z.density) m[i] = 2;
    }
    // heal pads at the centre and where each path crosses into a new ring
    m[C * MAP + C + 1] = 4;
    for (const z of ZONES.slice(0, 4)) for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) { const x = C + dx * z.upto + (dy ? 1 : 0), y = C + dy * z.upto + (dx ? 1 : 0); m[y * MAP + x] = 4; }
    for (const b of BOSSES) { m[b.y * MAP + b.x] = 5; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const j = (b.y + dy) * MAP + b.x + dx; if (m[j] === 2 || m[j] === 1) m[j] = 0; } }
    return m;
  }
  const tileAt = (x, y) => (x < 0 || y < 0 || x >= MAP || y >= MAP) ? 6 : map[y * MAP + x];
  const walkable = t => t === 0 || t === 1 || t === 3 || t === 4 || t === 5;

  // ---------- tile art (made in code, cached) ----------
  const tileCache = new Map();
  function tileArt(type, zi, v) {
    const key = type + ':' + zi + ':' + v; if (tileCache.has(key)) return tileCache.get(key);
    const c = document.createElement('canvas'); c.width = c.height = T; const g = c.getContext('2d'), z = ZONES[zi], r = rng(type * 97 + zi * 13 + v * 7 + 1);
    const px = (x, y, col, w = 1, h = 1) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const ground = () => { px(0, 0, z.ground, T, T); for (let i = 0; i < 6; i++) px(ri(r, 0, 15), ri(r, 0, 15), z.speck); };
    if (type === 0 || type === 5) ground();
    if (type === 1) { ground(); for (let i = 0; i < 5; i++) { const x = ri(r, 1, 13), y = ri(r, 3, 12); px(x, y, z.tall, 1, 4); px(x + 1, y - 1, z.tall, 1, 4); px(x + 2, y + 1, z.tallHi, 1, 3); } }
    if (type === 3) { px(0, 0, z.path, T, T); for (let i = 0; i < 4; i++) px(ri(r, 0, 15), ri(r, 0, 15), z.speck); }
    if (type === 4) { px(0, 0, z.path, T, T); px(2, 2, '#ff9ec4', 12, 12); px(2, 2, '#3a1f2b', 12, 1); px(2, 13, '#3a1f2b', 12, 1); px(2, 2, '#3a1f2b', 1, 12); px(13, 2, '#3a1f2b', 1, 12);
      [[5, 6], [6, 5], [7, 6], [8, 6], [9, 5], [10, 6], [5, 7], [10, 7], [6, 8], [9, 8], [7, 9], [8, 9]].forEach(([x, y]) => px(x, y, '#fff')); px(6, 6, '#fff', 4, 3); }
    if (type === 2 || type === 6) {
      ground(); const o = type === 6 ? (zi === 4 ? 'rock' : 'tree') : z.obst, dk = '#24301f';
      if (o === 'tree') { px(7, 11, '#6b4a2b', 2, 4); g.fillStyle = zi === 1 ? '#235a2c' : '#2f7a36'; g.beginPath(); g.arc(8, 7, 6, 0, 7); g.fill(); px(5, 4, zi === 1 ? '#2f6f37' : '#46a04a', 3, 2); }
      if (o === 'pine') { px(7, 12, '#6b4a2b', 2, 3); g.fillStyle = '#3d6e6a'; g.beginPath(); g.moveTo(8, 1); g.lineTo(14, 12); g.lineTo(2, 12); g.fill(); px(6, 5, '#ffffff', 3, 1); px(5, 8, '#ffffff', 2, 1); }
      if (o === 'cactus') { px(7, 3, '#4f8f45', 3, 12); px(4, 6, '#4f8f45', 2, 4); px(4, 9, '#4f8f45', 3, 2); px(11, 5, '#4f8f45', 2, 4); px(10, 8, '#4f8f45', 3, 2); px(8, 4, '#6fb05f', 1, 9); }
      if (o === 'rock') { g.fillStyle = zi === 4 ? '#4a3550' : '#8b8b8b'; g.beginPath(); g.ellipse(8, 10, 6.5, 5, 0, 0, 7); g.fill(); px(5, 7, zi === 4 ? '#6d5578' : '#b5b5b5', 3, 2); }
      void dk;
    }
    tileCache.set(key, c); return c;
  }

  // ---------- save ----------
  const KEY = 'cockquest-v1';
  let save = null;
  const store = { get() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } }, set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} } };
  function newSave() { const seed = Math.floor(Math.random() * 1e9); return { seed, species: rollSpecies(seed), mon: null, x: C, y: C + 2, face: 'down', lube: 3, beaten: [false, false, false, false] }; }
  function persist() { if (save && save.mon) store.set(save); }

  // ---------- sound (little chip beeps) ----------
  let ac = null;
  function beep(f, d = 0.06, type = 'square', vol = 0.06, slide = 0) {
    try {
      if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume();
      if (window.__pile && window.__pile.sfx && !window.__pile.sfx.on) return;
      const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime; o.type = type; o.frequency.setValueAtTime(f, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t + d);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d + 0.02);
    } catch (e) {}
  }
  const snd = {
    blip: () => beep(1320, 0.04), ok: () => { beep(988, 0.05); setTimeout(() => beep(1319, 0.08), 50); }, back: () => beep(660, 0.06),
    bump: () => beep(110, 0.08, 'square', 0.05, 0.6), hit: () => { beep(160, 0.12, 'sawtooth', 0.07, 0.4); },
    heal: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.08, 'triangle', 0.08), i * 70)),
    lvl: () => [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => beep(f, 0.1, 'square', 0.05), i * 90)),
    enc: () => [220, 330, 440, 660, 880].forEach((f, i) => setTimeout(() => beep(f, 0.06, 'square', 0.05), i * 50)),
    faint: () => beep(500, 0.5, 'square', 0.05, 0.15),
  };
  const moan = v => { try { window.__pile && window.__pile.sfx && window.__pile.sfx.moan(v); } catch (e) {} };

  // ---------- DOM: the handheld ----------
  const css = `
  #cq{position:fixed;inset:0;z-index:20;display:none;align-items:center;justify-content:center;background:rgba(30,16,24,.72);backdrop-filter:blur(3px);touch-action:none;user-select:none;-webkit-user-select:none}
  #cq.on{display:flex}
  #cq .shell{position:relative;background:linear-gradient(160deg,#f3e6ee,#d9c3d1);border-radius:18px 18px 64px 18px;box-shadow:0 10px 0 #b49aab,0 18px 40px rgba(0,0,0,.45),inset 0 2px 0 #fff;padding:18px 18px 22px;display:flex;flex-direction:column;align-items:center}
  #cq .bezel{background:#4a4150;border-radius:10px 10px 34px 10px;padding:14px 22px 10px;display:flex;flex-direction:column;align-items:center}
  #cq canvas{position:static !important;inset:auto !important;z-index:auto !important;display:block;image-rendering:pixelated;image-rendering:crisp-edges;background:#fff;cursor:default}
  #cq .brand{font:10px "Press Start 2P",monospace;color:#c9b8cf;margin-top:8px;letter-spacing:1px}
  #cq .brand b{color:#ff7aa0}
  #cq .controls{width:100%;display:flex;justify-content:space-between;align-items:center;margin-top:18px;padding:0 6px}
  #cq .dpad{position:relative;width:118px;height:118px}
  #cq .dpad button{position:absolute;width:40px;height:40px;background:#3a3340;border:none;color:#7d7086;font-size:14px;padding:0;cursor:pointer}
  #cq .dpad .u{left:39px;top:0;border-radius:6px 6px 0 0}#cq .dpad .d{left:39px;bottom:0;border-radius:0 0 6px 6px}
  #cq .dpad .l{left:0;top:39px;border-radius:6px 0 0 6px}#cq .dpad .r{right:0;top:39px;border-radius:0 6px 6px 0}
  #cq .dpad .m{left:39px;top:39px;width:40px;height:40px;background:#3a3340;position:absolute;border-radius:0}
  #cq .ab{display:flex;gap:16px;transform:rotate(-24deg);margin-top:-6px}
  #cq .ab button{width:54px;height:54px;border-radius:50%;background:#c2185b;border:none;box-shadow:0 4px 0 #7d0f3a;color:#ffd6e5;font:12px "Press Start 2P",monospace;cursor:pointer}
  #cq .ab button:active,#cq .dpad button:active,#cq .ss button:active{transform:translateY(2px)}
  #cq .ab .b{margin-top:26px}
  #cq .ss{display:flex;gap:18px;margin-top:14px}
  #cq .ss button{width:58px;height:14px;border-radius:8px;background:#8d8094;border:none;transform:rotate(-24deg);cursor:pointer}
  #cq .ss span{display:block;font:7px "Press Start 2P",monospace;color:#8d8094;text-align:center;margin-top:6px}
  @media (max-width:520px){ #cq .shell{padding:12px 12px 18px} #cq .bezel{padding:10px 12px 8px} #cq .controls{margin-top:14px} }
  #cq .close{position:absolute;top:-14px;right:-14px;width:34px;height:34px;border-radius:50%;background:#fff;border:2px solid #3a1f2b;font:700 16px system-ui;cursor:pointer;box-shadow:2px 2px 0 #3a1f2b}
  `;
  const root = document.createElement('div'); root.id = 'cq';
  root.innerHTML = `<style>${css}</style><div class="shell"><button class="close" aria-label="Close">✕</button>
    <div class="bezel"><canvas width="${SW}" height="${SH}"></canvas><div class="brand">COCK<b>QUEST</b></div></div>
    <div class="controls"><div class="dpad"><button class="u" data-b="up">▲</button><button class="l" data-b="left">◀</button><div class="m"></div><button class="r" data-b="right">▶</button><button class="d" data-b="down">▼</button></div>
    <div class="ab"><button class="b" data-b="b">B</button><button class="a" data-b="a">A</button></div></div>
    <div class="ss"><div><button data-b="select"></button><span>SELECT</span></div><div><button data-b="start"></button><span>START</span></div></div></div>`;
  document.body.appendChild(root);
  const cv = root.querySelector('canvas'), g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  function fit() { // biggest whole-number scale that fits the handheld on screen
    const small = innerWidth < 520, shellExtraW = small ? 52 : 80, shellExtraH = small ? 290 : 330;
    let s = Math.min((innerWidth - shellExtraW) / SW, (innerHeight - shellExtraH) / SH, 4);
    s = s >= 2 ? Math.floor(s) : Math.max(1, Math.floor(s * 4) / 4); // whole numbers when big, quarter steps on small phones
    cv.style.width = SW * s + 'px'; cv.style.height = SH * s + 'px';
  }
  addEventListener('resize', fit);

  // ---------- input ----------
  const held = { up: 0, down: 0, left: 0, right: 0 }; let pressed = [];
  const press = b => { pressed.push(b); if (b in held) held[b] = 1; };
  const release = b => { if (b in held) held[b] = 0; };
  root.querySelectorAll('[data-b]').forEach(el => {
    el.addEventListener('pointerdown', e => { e.preventDefault(); el.setPointerCapture && el.setPointerCapture(e.pointerId); press(el.dataset.b); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => el.addEventListener(t, () => release(el.dataset.b)));
  });
  root.querySelector('.close').onclick = () => close();
  const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', z: 'a', j: 'a', ' ': 'a', x: 'b', k: 'b', Backspace: 'b', Enter: 'start', Shift: 'select' };
  addEventListener('keydown', e => { if (!open) return; if (e.key === 'Escape') return close(); const b = KEYS[e.key]; if (b) { e.preventDefault(); if (!e.repeat) press(b); } });
  addEventListener('keyup', e => { if (!open) return; const b = KEYS[e.key]; if (b) release(b); });

  // ---------- drawing helpers ----------
  const FONT = '8px "Press Start 2P", monospace';
  const INK = '#2a1a24', PAPER = '#fbf7f2';
  function text(s, x, y, col = INK, font = FONT) { g.font = font; g.fillStyle = col; g.textBaseline = 'top'; g.fillText(s, x, y); }
  function box(x, y, w, h) { g.fillStyle = PAPER; g.fillRect(x, y, w, h); g.fillStyle = INK; g.fillRect(x, y, w, 2); g.fillRect(x, y + h - 2, w, 2); g.fillRect(x, y, 2, h); g.fillRect(x + w - 2, y, 2, h); g.fillRect(x + 3, y + 3, w - 6, 1); g.fillRect(x + 3, y + h - 4, w - 6, 1); g.fillRect(x + 3, y + 3, 1, h - 6); g.fillRect(x + w - 4, y + 3, 1, h - 6); }
  function arrow(x, y) { g.fillStyle = INK; for (let i = 0; i < 4; i++) g.fillRect(x + i, y + i, 1, 7 - i * 2); }
  function wrap(s, max = 17) { const out = []; let line = ''; for (const w of s.split(' ')) { if ((line + ' ' + w).trim().length > max) { out.push(line.trim()); line = w; } else line += ' ' + w; } if (line.trim()) out.push(line.trim()); return out; }
  function hpBar(x, y, w, hp, max) { const f = Math.max(0, hp / max); g.fillStyle = INK; g.fillRect(x, y, w + 4, 6); g.fillStyle = PAPER; g.fillRect(x + 1, y + 1, w + 2, 4); g.fillStyle = f > 0.5 ? '#3fae49' : f > 0.2 ? '#e8b923' : '#e0413b'; g.fillRect(x + 2, y + 2, Math.round(w * f), 2); }
  function crown(x, y) { g.fillStyle = '#f2c230'; g.fillRect(x, y + 2, 9, 3); g.fillRect(x, y, 1, 2); g.fillRect(x + 4, y - 1, 1, 3); g.fillRect(x + 8, y, 1, 2); g.fillStyle = '#e0413b'; g.fillRect(x + 4, y + 3, 1, 1); }

  // ---------- text box with typewriter + queue ----------
  let msgs = [], shown = 0, onDone = null;
  function say(list, done) { msgs = (Array.isArray(list) ? list : [list]).map(m => typeof m === 'string' ? { t: m } : m); shown = 0; onDone = done || null; if (msgs[0] && msgs[0].fx) { const extra = msgs[0].fx(); if (extra) msgs.splice(1, 0, ...extra.map(m => typeof m === 'string' ? { t: m } : m)); } }
  function msgStep(a) {
    if (!msgs.length) return false;
    const full = msgs[0].t.length;
    if (shown < full) { shown = Math.min(full, shown + 1.5); if (a) shown = full; return true; }
    if (a) {
      snd.blip(); msgs.shift(); shown = 0;
      if (msgs.length && msgs[0].fx) { const extra = msgs[0].fx(); if (extra) msgs.splice(1, 0, ...extra.map(m => typeof m === 'string' ? { t: m } : m)); }
      if (!msgs.length && onDone) { const f = onDone; onDone = null; f(); }
    }
    return true;
  }
  function drawMsg() {
    if (!msgs.length) return;
    box(0, 96, SW, 48);
    const lines = wrap(msgs[0].t.slice(0, Math.floor(shown)));
    lines.slice(0, 3).forEach((l, i) => text(l, 9, 106 + i * 12));
    if (shown >= msgs[0].t.length && (Math.floor(performance.now() / 300) % 2)) { g.fillStyle = INK; g.fillRect(146, 132, 5, 3); g.fillRect(147, 135, 3, 1); }
  }

  // ---------- scenes ----------
  let scene = 'title', open = false, t0 = 0, sel = 0, confirm = false, menuOpen = false, menuSel = 0, statsOpen = false;
  const P = { x: 0, y: 0, px: 0, py: 0, moving: 0, face: 'down', step: 0 };
  let battle = null, flash = 0;

  // TITLE
  function titleUpdate() {
    if (msgStep(pressed.includes('a'))) return;
    const has = !!store.get();
    if (pressed.includes('up') || pressed.includes('down')) { sel = has ? 1 - sel : 0; snd.blip(); }
    if (pressed.includes('a') || pressed.includes('start')) {
      snd.ok();
      if (has && sel === 0) { save = store.get(); if (!save.species || save.species.length !== species.length) { save = newSave(); scene = 'pick'; sel = 0; return; } enterWorld(); }
      else { save = newSave(); scene = 'pick'; sel = 0; }
    }
  }
  function titleDraw() {
    const tt = performance.now() / 1000;
    for (let y = 0; y < 10; y++) for (let x = 0; x < 11; x++) g.drawImage(tileArt((x + y) % 5 === 0 ? 1 : 0, 0, (x * 3 + y) % 3), x * T - (tt * 8 % 16), y * T);
    g.fillStyle = 'rgba(251,247,242,.6)'; g.fillRect(0, 0, SW, SH);
    for (let i = 0; i < Math.min(5, species.length); i++) { const s = species[(i + Math.floor(tt / 2)) % species.length]; if (s.ready) g.drawImage(s.spr.mini, 18 + i * 28, 104 + Math.round(Math.sin(tt * 4 + i) * 3)); }
    text('COCK', 48, 20, '#e0413b', '16px "Press Start 2P", monospace'); text('QUEST', 40, 40, INK, '16px "Press Start 2P", monospace');
    const has = !!store.get();
    if (has) { text('CONTINUE', 52, 70); text('NEW GAME', 52, 84); arrow(42, 70 + sel * 14); }
    else if (Math.floor(tt * 2) % 2) text('PRESS START', 36, 76);
  }

  // PICK YOUR COCK
  function pickUpdate() {
    if (msgStep(pressed.includes('a'))) return;
    if (confirm) {
      if (pressed.includes('a')) { snd.ok(); moan(1.1); const si = sel; save.mon = makeMon(si, 5); save.mon.xp = xpFor(5); confirm = false;
        say([`${species[si].name} it is!`, 'Wander the tall grass to find wild cocks.', 'Go further out for tougher ones...', '...and four BOSSES wait at the edges.'], () => enterWorld()); }
      if (pressed.includes('b')) { snd.back(); confirm = false; }
      return;
    }
    if (pressed.includes('right')) { sel = (sel + 1) % species.length; snd.blip(); }
    if (pressed.includes('left')) { sel = (sel - 1 + species.length) % species.length; snd.blip(); }
    if (pressed.includes('a')) { snd.ok(); confirm = true; }
  }
  function pickDraw() {
    g.fillStyle = '#fdeef4'; g.fillRect(0, 0, SW, SH);
    text('PICK YOUR COCK', 24, 6);
    const s = species[sel], b = save.species[sel].base;
    g.fillStyle = '#f7d6e3'; g.beginPath(); g.ellipse(40, 72, 30, 6, 0, 0, 7); g.fill();
    if (s.ready) g.drawImage(s.spr.big, 8, 12 + Math.round(Math.sin(performance.now() / 250) * 2));
    arrow(2, 44); g.save(); g.translate(76, 44); g.scale(-1, 1); arrow(0, 0); g.restore();
    const nm = wrap(s.name, 9); nm.forEach((l, i) => text(l, 82, 22 + i * 10));
    [['HP', b.hp], ['ATK', b.atk], ['DEF', b.def], ['SPD', b.spd]].forEach(([k, v], i) => { text(k, 82, 46 + i * 10); g.fillStyle = INK; g.fillRect(110, 47 + i * 10, 42, 6); g.fillStyle = '#ff5a7a'; g.fillRect(111, 48 + i * 10, Math.round(40 * Math.min(1, v / 130)), 4); });
    text(`${sel + 1}/${species.length}`, 8, 84, '#8d7a88');
    if (!msgs.length) {
      box(0, 96, SW, 48);
      if (confirm) { text(`Pick ${s.name.length > 10 ? 'this cock' : s.name}?`, 9, 106); text('A: YES   B: NO', 9, 122); }
      else { save.species[sel].moves.forEach((m, i) => text(m, 9 + (i % 2) * 76, 106 + Math.floor(i / 2) * 12)); text('A: CHOOSE', 9, 130, '#8d7a88'); }
    } else drawMsg();
  }

  // WORLD
  function enterWorld() { scene = 'world'; P.x = save.x; P.y = save.y; P.px = P.x * T; P.py = P.y * T; P.face = save.face || 'down'; P.moving = 0; map = genMap(save.seed); persist(); }
  function healMon() { const m = save.mon; m.hp = m.maxhp; m.moves.forEach(mv => mv.pp = MOVES[mv.name].pp); }
  function worldUpdate() {
    if (msgStep(pressed.includes('a'))) return;
    if (statsOpen) { if (pressed.some(b => b === 'a' || b === 'b' || b === 'start')) { statsOpen = false; snd.back(); } return; }
    if (menuOpen) {
      const opts = menuOptions();
      if (pressed.includes('down')) { menuSel = (menuSel + 1) % opts.length; snd.blip(); }
      if (pressed.includes('up')) { menuSel = (menuSel - 1 + opts.length) % opts.length; snd.blip(); }
      if (pressed.includes('b') || pressed.includes('start')) { menuOpen = false; snd.back(); }
      if (pressed.includes('a')) { snd.ok(); opts[menuSel][1](); }
      return;
    }
    if (pressed.includes('start')) { menuOpen = true; menuSel = 0; snd.ok(); return; }
    if (P.moving > 0) { // glide to the next tile
      P.moving -= 1; const k = 1 - P.moving / 8; P.px = P.fx * T + (P.x * T - P.fx * T) * k; P.py = P.fy * T + (P.y * T - P.fy * T) * k;
      if (P.moving === 0) arrived();
      return;
    }
    const dir = ['up', 'down', 'left', 'right'].find(d => held[d]) || ['up', 'down', 'left', 'right'].find(d => pressed.includes(d));
    if (!dir) return;
    P.face = dir; const [dx, dy] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
    const nx = P.x + dx, ny = P.y + dy, t = tileAt(nx, ny);
    const bi = BOSSES.findIndex(b => b.x === nx && b.y === ny);
    if (bi >= 0 && !save.beaten[bi]) { startBattle(bi); return; }
    if (!walkable(t)) { if (!P.bumped) { snd.bump(); P.bumped = 1; } return; }
    P.bumped = 0; P.fx = P.x; P.fy = P.y; P.x = nx; P.y = ny; P.moving = 8; P.step++;
  }
  function arrived() {
    save.x = P.x; save.y = P.y; save.face = P.face;
    const t = tileAt(P.x, P.y);
    if (t === 4 && (save.mon.hp < save.mon.maxhp || save.mon.moves.some(m => m.pp < MOVES[m.name].pp))) { healMon(); snd.heal(); say(['Your cock had a little rest.', 'HP and moves are back to full!']); persist(); }
    if (t === 1 && Math.random() < 0.11) startBattle(-1);
    if (P.step % 20 === 0) persist();
  }
  function menuOptions() {
    return [
      ['STATS', () => { menuOpen = false; statsOpen = true; }],
      [`LUBE x${save.lube}`, () => { menuOpen = false; const m = save.mon; if (!save.lube) return say('No LUBE left!'); if (m.hp >= m.maxhp) return say('Already at full HP.'); save.lube--; m.hp = Math.min(m.maxhp, m.hp + Math.ceil(m.maxhp / 2)); snd.heal(); say(`Lubed up! ${m.name} recovered HP.`); persist(); }],
      ['SAVE', () => { menuOpen = false; persist(); say('Game saved.'); }],
      ['QUIT', () => { menuOpen = false; persist(); close(); }],
    ];
  }
  function worldDraw() {
    const camX = Math.round(P.px - 4.5 * T + T / 2 - T / 2), camY = Math.round(P.py - 4 * T);
    const x0 = Math.floor(camX / T), y0 = Math.floor(camY / T);
    for (let y = y0; y <= y0 + 9; y++) for (let x = x0; x <= x0 + 10; x++) {
      const t = tileAt(x, y), zi = Math.max(0, zoneAt(Math.max(0, Math.min(MAP - 1, x)), Math.max(0, Math.min(MAP - 1, y))));
      const v = Math.floor(hash(x, y, 3) * 3);
      g.drawImage(tileArt(t, zi, v), x * T - camX, y * T - camY);
      if (t === 5) { const bi = BOSSES.findIndex(b => b.x === x && b.y === y); const s = species[bossSpecies(bi)]; if (bi >= 0 && !save.beaten[bi] && s.ready) { g.drawImage(s.spr.mini, x * T - camX, y * T - camY - 2 + Math.round(Math.sin(performance.now() / 300) * 1)); crown(x * T - camX + 3, y * T - camY - 7); } }
    }
    const s = species[save.mon.si]; const bob = P.moving ? (Math.floor(P.moving / 2) % 2) : 0;
    if (s.ready) g.drawImage(P.face === 'left' ? s.spr.miniL : s.spr.mini, Math.round(P.px - camX), Math.round(P.py - camY - bob - 2));
    // tall grass covers the bottom of your cock
    if (tileAt(P.x, P.y) === 1 && !P.moving) { const z = Math.max(0, zoneAt(P.x, P.y)); g.drawImage(tileArt(1, z, 1), 0, 10, 16, 6, Math.round(P.px - camX), Math.round(P.py - camY) + 10, 16, 6); }
    // zone label + level
    const zi = Math.max(0, zoneAt(P.x, P.y)); g.fillStyle = 'rgba(251,247,242,.85)'; g.fillRect(0, 0, SW, 11); text(`${ZONES[zi].name}`, 3, 2); text(`L${save.mon.L}`, 120, 2);
    hpBar(84, 2, 30, save.mon.hp, save.mon.maxhp);
    if (menuOpen) { const o = menuOptions(); box(88, 14, 72, 14 + o.length * 12); o.forEach(([l], i) => text(l, 100, 21 + i * 12)); arrow(92, 21 + menuSel * 12); }
    if (statsOpen) statsDraw();
    drawMsg();
  }
  function statsDraw() {
    const m = save.mon, s = species[m.si];
    box(0, 0, SW, SH); if (s.ready) g.drawImage(s.spr.front, 4, 6);
    wrap(m.name, 11).forEach((l, i) => text(l, 62, 8 + i * 10));
    text(`L${m.L}`, 62, 30); text(`HP ${m.hp}/${m.maxhp}`, 62, 42);
    text(`ATK ${m.atk}`, 8, 62); text(`DEF ${m.def}`, 84, 62); text(`SPD ${m.spd}`, 8, 74); text(`XP ${Math.max(0, xpFor(m.L + 1) - m.xp)}`, 84, 74);
    m.moves.forEach((mv, i) => text(`${mv.name.slice(0, 9)} ${mv.pp}`, 8 + (i % 2) * 76, 92 + Math.floor(i / 2) * 12));
    text(`BOSSES ${save.beaten.filter(Boolean).length}/4`, 8, 124); text(`LUBE ${save.lube}`, 100, 124);
  }
  const bossSpecies = bi => bi < 0 ? 0 : (save.seed + bi * 3) % species.length;

  // BATTLE
  function startBattle(bi) {
    snd.enc(); flash = 24;
    const zi = Math.max(0, zoneAt(P.x, P.y)), z = ZONES[zi];
    const foe = bi >= 0 ? makeMon(bossSpecies(bi), BOSSES[bi].lv, true) : makeMon(Math.floor(Math.random() * species.length), ri(Math.random, z.lv[0], z.lv[1]));
    foe.shownHp = foe.hp;
    save.mon.shownHp = save.mon.hp;
    battle = { foe, bi, state: 'text', sel: 0, msel: 0, shake: 0, foeBlink: 0, meBlink: 0, intro: 0, over: false };
    scene = 'battle';
    say(bi >= 0 ? [`${foe.name} blocks the way!`, `Go! ${save.mon.name}!`] : [`A wild ${foe.name} appeared!`, `Go! ${save.mon.name}!`], () => (battle.state = 'menu'));
    if (bi >= 0) moan(0.6);
  }
  const stage = s => s >= 0 ? (2 + s) / 2 : 2 / (2 - s);
  function useMove(a, d, mv, isMe) {
    const M = MOVES[mv.name], out = [];
    if (isMe) mv.pp--;
    if (Math.random() * 100 >= M.acc) return [`${a.name}'s attack missed!`];
    if (M.fx === 'heal') { const h = Math.min(a.maxhp - a.hp, Math.ceil(a.maxhp * 0.4)); a.hp += h; snd.heal(); return [h ? `${a.name} lubed up and recovered!` : `${a.name} is already slick.`]; }
    if (M.fx === 'atkup') { if (a.atkS >= 4) return [`${a.name} can't swell any more!`]; a.atkS++; snd.ok(); return [`${a.name} swelled up! ATK rose!`]; }
    if (M.fx === 'defdown') { if (d.defS <= -4) return [`${d.name}'s DEF won't go lower!`]; d.defS--; snd.blip(); return [`${d.name} wobbled! DEF fell!`]; }
    const hits = M.hits ? ri(Math.random, M.hits[0], M.hits[1]) : 1;
    let total = 0, crit = false;
    for (let i = 0; i < hits; i++) {
      const A = a.atk * stage(a.atkS), D = d.def * stage(d.defS), c = Math.random() < 1 / 16;
      let dmg = Math.floor(Math.floor(Math.floor(2 * a.L / 5 + 2) * M.pow * A / D) / 50) + 2;
      dmg = Math.max(1, Math.floor(dmg * (c ? 1.5 : 1) * (0.85 + Math.random() * 0.15))); crit = crit || c; total += dmg;
    }
    d.hp = Math.max(0, d.hp - total); snd.hit();
    if (isMe) battle.foeBlink = 18; else { battle.meBlink = 18; battle.shake = 10; }
    if (hits > 1) out.push(`Hit ${hits} times!`);
    if (crit) { out.push('A critical hit!'); moan(0.8 + Math.random() * 0.5); }
    return out;
  }
  function foeMove(f) { const opts = f.moves.filter(m => !(MOVES[m.name].fx === 'heal' && f.hp > f.maxhp * 0.6)); return opts[Math.floor(Math.random() * opts.length)]; }
  function turn(myAction) {
    const me = save.mon, f = battle.foe, queue = [];
    const meFirst = myAction.kind !== 'move' || me.spd * stage(0) >= f.spd || (me.spd === f.spd && Math.random() < 0.5);
    const myStep = () => {
      if (myAction.kind === 'lube') return { t: `You used LUBE on ${me.name}!`, fx: () => { save.lube--; me.hp = Math.min(me.maxhp, me.hp + Math.ceil(me.maxhp / 2)); snd.heal(); } };
      return { t: `${me.name} used ${myAction.mv.name}!`, fx: () => useMove(me, f, myAction.mv, true) };
    };
    const foeStep = () => { const mv = foeMove(f); return { t: `${f.boss ? '' : 'Wild '}${f.name} used ${mv.name}!`, fx: () => (f.hp <= 0 ? null : useMove(f, me, mv, false)) }; };
    const order = meFirst ? [myStep(), foeStep()] : [foeStep(), myStep()];
    // second actor only acts if nobody fainted
    order[1].guard = true;
    battle.state = 'text';
    const seq = [order[0], { t: '', guardNext: true }, order[1]];
    runSeq(seq);
  }
  function runSeq(seq) {
    // play messages; after each one check for a faint
    const step = () => {
      const me = save.mon, f = battle.foe;
      if (f.hp <= 0) return win();
      if (me.hp <= 0) return lose();
      const m = seq.shift(); if (!m) { battle.state = 'menu'; return; }
      if (!m.t) return step();
      say([m], step);
    };
    step();
  }
  function win() {
    const me = save.mon, f = battle.foe;
    const gain = Math.floor((f.boss ? BOSS_XP : XP_BASE) * f.L / 7);
    const list = [{ t: `${f.boss ? '' : 'Wild '}${f.name} fainted!`, fx: () => { snd.faint(); battle.foeGone = true; } }, `${me.name} gained ${gain} XP!`];
    me.xp += gain;
    while (me.L < 100 && me.xp >= xpFor(me.L + 1)) {
      const before = me.maxhp; me.L++;
      const st = statsAt(save.species[me.si].base, me.L); me.maxhp = st.hp; me.atk = st.atk; me.def = st.def; me.spd = st.spd; me.hp = Math.min(me.maxhp, me.hp + (me.maxhp - before));
      list.push({ t: `${me.name} grew to level ${me.L}!`, fx: () => { snd.lvl(); moan(0.9 + Math.random() * 0.4); } });
    }
    if (battle.bi >= 0) {
      save.beaten[battle.bi] = true; save.lube += 2;
      list.push(`You beat the boss! Found 2 LUBE.`);
      if (save.beaten.every(Boolean)) list.push({ t: `All four bosses beaten! ${me.name} is the COCK CHAMPION!`, fx: () => { snd.lvl(); moan(1.2); } });
    } else if (Math.random() < 0.22) { save.lube++; list.push('Found a LUBE!'); }
    me.atkS = me.defS = 0;
    say(list, () => { scene = 'world'; battle = null; persist(); });
  }
  function lose() {
    const me = save.mon;
    say([{ t: `${me.name} fainted!`, fx: () => { snd.faint(); moan(0.5); } }, 'You blacked out!', '...and woke up back in the middle of the meadow.'], () => {
      healMon(); me.atkS = me.defS = 0; save.x = C; save.y = C + 2; enterWorld(); battle = null;
    });
  }
  function battleUpdate() {
    const b = battle; if (!b) return;
    const ease = (o, k) => { if (o.shownHp > o.hp) o.shownHp = Math.max(o.hp, o.shownHp - Math.max(0.3, o.maxhp / 60)); if (o.shownHp < o.hp) o.shownHp = Math.min(o.hp, o.shownHp + Math.max(0.3, o.maxhp / 60)); void k; };
    ease(b.foe); ease(save.mon);
    if (b.foeBlink) b.foeBlink--; if (b.meBlink) b.meBlink--; if (b.shake) b.shake--;
    if (msgStep(pressed.includes('a'))) return;
    if (b.state === 'menu') {
      if (pressed.includes('right') || pressed.includes('left')) { b.sel ^= 1; snd.blip(); }
      if (pressed.includes('down') || pressed.includes('up')) { b.sel ^= 2; snd.blip(); }
      if (pressed.includes('a')) {
        snd.ok();
        if (b.sel === 0) { b.state = 'moves'; b.msel = 0; }
        if (b.sel === 1) { if (!save.lube) say('No LUBE left!', () => (b.state = 'menu')); else if (save.mon.hp >= save.mon.maxhp) say('HP is already full.', () => (b.state = 'menu')); else turn({ kind: 'lube' }); }
        if (b.sel === 2) {
          if (b.bi >= 0) say("You can't run from a boss!", () => (b.state = 'menu'));
          else { const ok = Math.random() < Math.max(0.3, Math.min(1, 0.5 + (save.mon.spd - b.foe.spd) / (2 * b.foe.spd))); if (ok) say('Got away safely!', () => { scene = 'world'; battle = null; persist(); }); else { battle.state = 'text'; runSeq([{ t: "Couldn't get away!" }, (() => { const mv = foeMove(b.foe); return { t: `Wild ${b.foe.name} used ${mv.name}!`, fx: () => useMove(b.foe, save.mon, mv, false) }; })()]); } }
        }
        if (b.sel === 3) { statsOpen = true; b.state = 'stats'; }
      }
    } else if (b.state === 'stats') { if (pressed.some(k => k === 'a' || k === 'b')) { statsOpen = false; b.state = 'menu'; snd.back(); } }
    else if (b.state === 'moves') {
      const mv = save.mon.moves;
      if (pressed.includes('right') || pressed.includes('left')) { b.msel = (b.msel ^ 1) % mv.length; snd.blip(); }
      if (pressed.includes('down') || pressed.includes('up')) { const n = b.msel ^ 2; if (n < mv.length) b.msel = n; snd.blip(); }
      if (pressed.includes('b')) { b.state = 'menu'; snd.back(); }
      if (pressed.includes('a')) { const m = mv[b.msel]; if (m.pp <= 0) say('No PP left for that move!', () => (b.state = 'moves')); else { snd.ok(); turn({ kind: 'move', mv: m }); } }
    }
  }
  function battleDraw() {
    const b = battle, me = save.mon, f = b.foe, sf = species[f.si], sm = species[me.si];
    g.fillStyle = PAPER; g.fillRect(0, 0, SW, SH);
    const zi = Math.max(0, zoneAt(P.x, P.y)), z = ZONES[zi];
    g.fillStyle = z.ground; g.beginPath(); g.ellipse(124, 52, 32, 7, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(38, 92, 38, 8, 0, 0, 7); g.fill();
    // foe
    if (!b.foeGone && sf.ready && !(b.foeBlink && Math.floor(b.foeBlink / 3) % 2)) { g.drawImage(sf.spr.front, 98, 2); if (f.boss) crown(119, 0); }
    box(2, 2, 92, 34); text(f.name.length > 10 ? f.name.slice(0, 10) : f.name, 8, 8); text(`L${f.L}`, 8, 18); hpBar(36, 19, 50, f.shownHp, f.maxhp);
    // you (from behind)
    const sx = b.shake ? (b.shake % 2 ? 2 : -2) : 0;
    if (sm.ready && !(b.meBlink && Math.floor(b.meBlink / 3) % 2)) g.drawImage(sm.spr.back, 10 + sx, 40);
    box(70, 52, 90, 42); text(me.name.length > 10 ? me.name.slice(0, 10) : me.name, 76, 58); text(`L${me.L}`, 76, 68); hpBar(102, 69, 50, me.shownHp, me.maxhp); text(`${Math.ceil(me.shownHp)}/${me.maxhp}`, 90, 80);
    if (msgs.length) drawMsg();
    else if (b.state === 'menu') { box(0, 96, SW, 48); text('FIGHT', 18, 108); text(`LUBE${save.lube}`, 88, 108); text('RUN', 18, 124); text('STATS', 88, 124); arrow(8 + (b.sel & 1) * 70, 108 + (b.sel >> 1) * 16); }
    else if (b.state === 'moves') { box(0, 96, SW, 48); me.moves.forEach((m, i) => text(m.name.slice(0, 8), 16 + (i % 2) * 74, 104 + Math.floor(i / 2) * 14)); arrow(6 + (b.msel & 1) * 74, 104 + (b.msel >> 1) * 14); const m = me.moves[b.msel]; text(`PP ${m.pp}/${MOVES[m.name].pp}`, 16, 132, '#8d7a88'); }
    if (statsOpen) statsDraw();
  }

  // ---------- main loop ----------
  function loop() {
    if (!open) return;
    if (scene === 'title') titleUpdate();
    else if (scene === 'pick') pickUpdate();
    else if (scene === 'world') worldUpdate();
    else if (scene === 'battle') battleUpdate();
    pressed = [];
    g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false;
    if (scene === 'title') titleDraw();
    else if (scene === 'pick') pickDraw();
    else if (scene === 'world') worldDraw();
    else if (scene === 'battle') battleDraw();
    if (flash > 0) { flash--; if (Math.floor(flash / 3) % 2) { g.fillStyle = INK; g.fillRect(0, 0, SW, SH); } }
    requestAnimationFrame(loop);
  }

  let loaded = null;
  function openGame() {
    root.classList.add('on'); open = true; window.__rpgOpen = true; fit();
    scene = 'title'; sel = 0; msgs = []; menuOpen = false; statsOpen = false; battle = null;
    if (!loaded) loaded = Promise.all([loadSpecies(), document.fonts ? document.fonts.load(FONT) : null]);
    loaded.then(() => requestAnimationFrame(loop));
  }
  function close() { if (save && save.mon) persist(); open = false; window.__rpgOpen = false; root.classList.remove('on'); }
  window.CockQuest = { open: openGame, close, get state() { return { scene, save, battle, P, msgs: msgs.map(m => m.t) }; }, press, release };
})();

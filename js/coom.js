// =====================================================================
// COOM — a retro first-person shooter for cockpile.com.
// Original raycasting engine, procedural levels and textures. The enemies are
// the site's cut-outs; some charge you, some lob blobs of semen. Flush yourself
// down the toilet to reach the next level. Local + global leaderboard.
// =====================================================================
(() => {
  const W = 320, H = 200, VIEW_H = 168;          // internal resolution; the bottom strip is the HUD
  const FOV = 0.66;                              // camera plane length (≈ 66° field of view)
  const TEX = 64;

  // ---------- tiny helpers ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const ri = (a, b) => Math.floor(rnd(a, b + 1));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const sfx = () => (window.__pile && window.__pile.sfx) || null;
  const play = (name, ...a) => { try { const s = sfx(); if (s && s[name]) s[name](...a); } catch (e) {} };

  // ---------- textures (made in code) ----------
  function makeTex(draw) {
    const c = document.createElement('canvas'); c.width = c.height = TEX; const g = c.getContext('2d'); draw(g);
    const d = g.getImageData(0, 0, TEX, TEX).data, out = new Uint32Array(TEX * TEX);
    for (let i = 0; i < TEX * TEX; i++) out[i] = (255 << 24) | (d[i * 4 + 2] << 16) | (d[i * 4 + 1] << 8) | d[i * 4];
    return out;
  }
  const TEXTURES = [
    // 1: pink bathroom tiles
    makeTex(g => { g.fillStyle = '#e9a3b8'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#c97c94'; for (let i = 0; i <= 64; i += 16) { g.fillRect(i, 0, 2, 64); g.fillRect(0, i, 64, 2); } g.fillStyle = 'rgba(255,255,255,.25)'; for (let y = 0; y < 64; y += 16) for (let x = 0; x < 64; x += 16) g.fillRect(x + 3, y + 3, 6, 2); }),
    // 2: veiny flesh
    makeTex(g => { g.fillStyle = '#c86a6a'; g.fillRect(0, 0, 64, 64); for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(${ri(120, 180)},${ri(30, 60)},${ri(50, 80)},.35)`; g.fillRect(ri(0, 63), ri(0, 63), 2, 2); }
      g.strokeStyle = '#7a2f4a'; g.lineWidth = 2; for (let k = 0; k < 4; k++) { g.beginPath(); let x = ri(0, 64), y = 0; g.moveTo(x, y); while (y < 64) { x += ri(-6, 6); y += ri(4, 9); g.lineTo(x, y); } g.stroke(); } g.strokeStyle = '#9b4b6a'; g.lineWidth = 1; for (let k = 0; k < 6; k++) { g.beginPath(); const x = ri(0, 64), y = ri(0, 64); g.moveTo(x, y); g.lineTo(x + ri(-12, 12), y + ri(-12, 12)); g.stroke(); } }),
    // 3: dark wood panelling ("morning wood")
    makeTex(g => { g.fillStyle = '#6b4226'; g.fillRect(0, 0, 64, 64); for (let x = 0; x < 64; x += 16) { g.fillStyle = '#4a2c18'; g.fillRect(x, 0, 2, 64); for (let y = 0; y < 64; y += 3) { g.fillStyle = `rgba(30,15,5,${Math.random() * 0.25})`; g.fillRect(x + 2, y, 14, 1); } } }),
    // 4: purple padded walls
    makeTex(g => { g.fillStyle = '#5a3a73'; g.fillRect(0, 0, 64, 64); for (let y = 0; y < 64; y += 32) for (let x = 0; x < 64; x += 32) { const gr = g.createRadialGradient(x + 16, y + 16, 2, x + 16, y + 16, 18); gr.addColorStop(0, '#8a62a8'); gr.addColorStop(1, '#4a2e60'); g.fillStyle = gr; g.fillRect(x + 1, y + 1, 30, 30); g.fillStyle = '#2e1a3e'; g.fillRect(x + 15, y + 15, 3, 3); } }),
    // 5: grimy white bathroom-stall tiles
    makeTex(g => { g.fillStyle = '#e6e2d6'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#9a958a'; for (let i = 0; i <= 64; i += 8) { g.fillRect(i, 0, 1, 64); g.fillRect(0, i, 64, 1); } for (let i = 0; i < 6; i++) { g.fillStyle = `rgba(190,160,60,${rnd(0.15, 0.35)})`; g.beginPath(); g.ellipse(ri(0, 64), ri(0, 64), ri(3, 9), ri(2, 6), 0, 0, 7); g.fill(); } g.fillStyle = 'rgba(60,50,40,.5)'; g.fillRect(ri(5, 50), ri(5, 50), 7, 1); }),
    // 6: slimy sewer brick
    makeTex(g => { g.fillStyle = '#3c4a3a'; g.fillRect(0, 0, 64, 64); for (let y = 0; y < 64; y += 8) for (let x = (y / 8) % 2 ? -8 : 0; x < 64; x += 16) { g.fillStyle = `rgb(${ri(70, 95)},${ri(85, 110)},${ri(70, 90)})`; g.fillRect(x + 1, y + 1, 14, 6); } for (let i = 0; i < 7; i++) { const x = ri(0, 62); g.fillStyle = 'rgba(140,200,80,.55)'; g.fillRect(x, 0, 2, ri(8, 40)); } }),
    // 7: VIP lounge red velvet with gold stripes
    makeTex(g => { const gr = g.createLinearGradient(0, 0, 64, 0); gr.addColorStop(0, '#7a0e22'); gr.addColorStop(0.5, '#b0193a'); gr.addColorStop(1, '#7a0e22'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); g.fillStyle = '#e2b13c'; g.fillRect(0, 0, 3, 64); g.fillRect(32, 0, 3, 64); g.fillStyle = '#7a5a12'; g.fillRect(0, 56, 64, 8); g.fillStyle = '#e2b13c'; g.fillRect(0, 56, 64, 2); }),
    // 8: neon grid
    makeTex(g => { g.fillStyle = '#120a22'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#ff3fa4'; for (let i = 0; i < 64; i += 16) g.fillRect(0, i, 64, 1); g.fillStyle = '#3fe0ff'; for (let i = 8; i < 64; i += 16) g.fillRect(i, 0, 1, 64); g.fillStyle = 'rgba(255,63,164,.25)'; for (let i = 0; i < 64; i += 16) g.fillRect(0, i - 1, 64, 3); }),
  ];

  // ---------- sprites ----------
  function canvasSprite(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')); return c; }
  const SPR = {
    goo: canvasSprite(32, 32, g => { const gr = g.createRadialGradient(13, 12, 2, 16, 16, 14); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.6, '#f4efe4'); gr.addColorStop(1, 'rgba(220,214,196,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(16, 15, 13, 11, 0, 0, 7); g.fill(); g.fillStyle = '#efe9db'; g.beginPath(); g.ellipse(18, 26, 3, 5, 0, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(11, 10, 3, 0, 7); g.fill(); }),
    puddle: canvasSprite(64, 16, g => { g.fillStyle = 'rgba(245,240,228,.85)'; g.beginPath(); g.ellipse(32, 10, 28, 5, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(14, 8, 8, 3, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(48, 12, 9, 3, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.9)'; g.fillRect(24, 7, 8, 1); }),
    lube: canvasSprite(32, 32, g => { g.fillStyle = '#3a8fd6'; g.beginPath(); g.roundRect ? g.roundRect(9, 8, 14, 22, 4) : g.rect(9, 8, 14, 22); g.fill(); g.fillStyle = '#e8f4ff'; g.fillRect(12, 14, 8, 8); g.fillStyle = '#ff5a7a'; g.fillRect(14, 16, 4, 4); g.fillStyle = '#222'; g.fillRect(12, 3, 8, 6); }),
    condom: canvasSprite(32, 32, g => { g.fillStyle = '#ffd34a'; g.fillRect(4, 8, 24, 20); g.strokeStyle = '#b98e10'; g.setLineDash([2, 2]); g.strokeRect(5, 9, 22, 18); g.fillStyle = '#e9b81f'; g.beginPath(); g.arc(16, 18, 6, 0, 7); g.fill(); g.strokeStyle = '#fff3c4'; g.setLineDash([]); g.beginPath(); g.arc(16, 18, 4, 0, 7); g.stroke(); }),
    pill: canvasSprite(32, 32, g => { g.fillStyle = '#4a7bff'; g.beginPath(); g.moveTo(16, 6); g.lineTo(26, 16); g.lineTo(16, 26); g.lineTo(6, 16); g.closePath(); g.fill(); g.fillStyle = '#8fb0ff'; g.beginPath(); g.moveTo(16, 9); g.lineTo(20, 13); g.lineTo(16, 13); g.fill(); g.fillStyle = '#2b4fb8'; g.font = 'bold 7px monospace'; g.fillText('V', 13, 19); }),
    jug: canvasSprite(32, 32, g => { g.fillStyle = '#f2ede2'; g.beginPath(); g.roundRect ? g.roundRect(7, 9, 18, 21, 5) : g.rect(7, 9, 18, 21); g.fill(); g.strokeStyle = '#bdb6a5'; g.lineWidth = 2; g.beginPath(); g.arc(25, 18, 5, -1.2, 1.2); g.stroke(); g.fillStyle = '#ff5a7a'; g.fillRect(11, 4, 10, 6); g.fillStyle = '#3a1f2b'; g.font = 'bold 6px monospace'; g.fillText('LOAD', 9, 22); }),
    sprayer: canvasSprite(32, 32, g => { g.fillStyle = '#d0739a'; g.fillRect(4, 12, 24, 9); g.fillStyle = '#a24b72'; g.fillRect(4, 14, 24, 2); g.fillRect(4, 18, 24, 1); g.fillStyle = '#7d3657'; g.fillRect(10, 20, 6, 8); g.fillStyle = '#fff'; g.beginPath(); g.arc(28, 16, 3, 0, 7); g.fill(); }),
    toilet: canvasSprite(64, 64, g => { g.fillStyle = '#fafafa'; g.fillRect(14, 4, 36, 22); g.fillStyle = '#e4e4e4'; g.fillRect(14, 22, 36, 4); g.fillStyle = '#fafafa'; g.beginPath(); g.ellipse(32, 36, 22, 9, 0, 0, 7); g.fill(); g.fillStyle = '#9fd6ff'; g.beginPath(); g.ellipse(32, 36, 15, 5, 0, 0, 7); g.fill(); g.fillStyle = '#f0f0f0'; g.beginPath(); g.moveTo(16, 38); g.lineTo(24, 60); g.lineTo(40, 60); g.lineTo(48, 38); g.fill(); g.fillStyle = '#c0c0c0'; g.fillRect(44, 8, 5, 3); g.fillStyle = '#ff5a7a'; g.font = 'bold 9px monospace'; g.fillText('EXIT', 21, 17); }),
  };
  // enemies: the cut-outs, at a handy size
  const SRC = (typeof CUTOUTS !== 'undefined' && CUTOUTS.length) ? CUTOUTS : ['favicon.svg'];
  const KINDS = SRC.map((src, i) => ({ src, name: src.split('/').pop().replace(/\.[a-z]+$/i, '').replace(/-/g, ' ').toUpperCase(), spr: null,
    // a spread of enemy types: every other one throws goo, the rest charge
    ranged: i % 2 === 0, hp: [40, 60, 45, 80, 50, 70, 55, 90, 65][i % 9], speed: [1.6, 1.2, 1.9, 1.0, 1.5, 1.3, 2.1, 0.9, 1.4][i % 9], dmg: [8, 12, 7, 15, 9, 11, 6, 16, 10][i % 9] }));
  function loadKinds() {
    return Promise.all(KINDS.map(k => new Promise(res => { const im = new Image(); im.onload = () => {
      const n = 128, c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d'), s = (n - 4) / Math.max(im.width, im.height);
      g.drawImage(im, (n - im.width * s) / 2, n - 2 - im.height * s, im.width * s, im.height * s); k.spr = c;
      // a red-tinted copy for the hurt flash
      const r = document.createElement('canvas'); r.width = r.height = n; const rg = r.getContext('2d'); rg.drawImage(c, 0, 0); rg.globalCompositeOperation = 'source-atop'; rg.fillStyle = 'rgba(255,40,40,.55)'; rg.fillRect(0, 0, n, n); k.hurt = r; res(); };
      im.onerror = res; im.src = k.src; })));
  }

  // ---------- levels: a theme (look) + a layout (shape) ----------
  const THEMES = [
    { name: 'THE BATHROOM',  walls: [1, 5],    ceil: [36, 22, 46], floor: [120, 70, 100], fog: 11 },
    { name: 'THE FLESH PIT', walls: [2, 2, 4], ceil: [44, 8, 16],  floor: [128, 32, 44],  fog: 8 },
    { name: 'MORNING WOOD',  walls: [3, 7],    ceil: [30, 18, 10], floor: [96, 64, 42],   fog: 10 },
    { name: 'THE SEWER',     walls: [6, 5],    ceil: [10, 24, 18], floor: [44, 74, 52],   fog: 7 },
    { name: 'PADDED CELL',   walls: [4, 8],    ceil: [22, 10, 36], floor: [76, 44, 108],  fog: 12 },
    { name: 'VIP LOUNGE',    walls: [7, 3],    ceil: [34, 6, 12],  floor: [116, 22, 44],  fog: 10 },
    { name: 'NEON DUNGEON',  walls: [8, 4],    ceil: [6, 4, 20],   floor: [32, 22, 64],   fog: 9 },
  ];
  const LAYOUTS = ['rooms', 'caves', 'maze', 'arena', 'halls'];
  const LAYOUT_NAMES = { rooms: 'ROOMS', caves: 'CAVES', maze: 'MAZE', arena: 'ARENA', halls: 'HALLS' };
  let map, MW, MH, things, shots, start, exit, theme, layout, booms = [];
  const dig = (x, y) => { if (x > 0 && y > 0 && x < MW - 1 && y < MH - 1) map[y * MW + x] = 0; };
  function layRooms() {
    const rooms = [];
    for (let t = 0; t < 90 && rooms.length < 12; t++) {
      const w = ri(4, 8), h = ri(4, 8), x = ri(1, MW - w - 2), y = ri(1, MH - h - 2);
      if (rooms.some(r => x < r.x + r.w + 1 && x + w + 1 > r.x && y < r.y + r.h + 1 && y + h + 1 > r.y)) continue;
      rooms.push({ x, y, w, h, cx: x + w / 2, cy: y + h / 2 });
    }
    for (const r of rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) map[y * MW + x] = 0;
    for (let i = 1; i < rooms.length; i++) {
      const A = rooms[i - 1], B = rooms[i]; let x = Math.floor(A.cx), y = Math.floor(A.cy); const tx = Math.floor(B.cx), ty = Math.floor(B.cy);
      const go = ax => { if (ax === 'x') while (x !== tx) { x += Math.sign(tx - x); dig(x, y); dig(x, y + 1); } else while (y !== ty) { y += Math.sign(ty - y); dig(x, y); dig(x + 1, y); } };
      if (Math.random() < 0.5) { go('x'); go('y'); } else { go('y'); go('x'); }
    }
    return { x: rooms[0].cx, y: rooms[0].cy };
  }
  function layCaves() { // cellular-automaton caves
    let g = new Uint8Array(MW * MH); for (let i = 0; i < g.length; i++) g[i] = Math.random() < 0.44 ? 1 : 0;
    for (let it = 0; it < 5; it++) {
      const n = new Uint8Array(MW * MH);
      for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
        if (x === 0 || y === 0 || x === MW - 1 || y === MH - 1) { n[y * MW + x] = 1; continue; }
        let c = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) c += g[(y + dy) * MW + x + dx];
        n[y * MW + x] = c >= 5 ? 1 : 0;
      } g = n;
    }
    for (let i = 0; i < g.length; i++) if (!g[i]) map[i] = 0;
    return nearestOpen(MW / 2, MH / 2);
  }
  function layMaze() { // a maze of 2-wide corridors, with some loops and a few small rooms
    const cs = 3, cw = Math.floor((MW - 2) / cs), ch = Math.floor((MH - 2) / cs), seen = new Uint8Array(cw * ch), stack = [[0, 0]];
    const open = (cx, cy) => { for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) dig(1 + cx * cs + x, 1 + cy * cs + y); };
    seen[0] = 1; open(0, 0);
    while (stack.length) {
      const [cx, cy] = stack[stack.length - 1];
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [cx + dx, cy + dy, dx, dy]).filter(([x, y]) => x >= 0 && y >= 0 && x < cw && y < ch && !seen[y * cw + x]);
      if (!nb.length) { stack.pop(); continue; }
      const [nx, ny, dx, dy] = pick(nb); seen[ny * cw + nx] = 1; open(nx, ny);
      for (let k = 0; k < 2; k++) dig(1 + cx * cs + (dx > 0 ? 2 : dx < 0 ? -1 : k), 1 + cy * cs + (dy > 0 ? 2 : dy < 0 ? -1 : k));
      stack.push([nx, ny]);
    }
    for (let i = 0; i < cw * ch * 0.12; i++) dig(ri(2, MW - 3), ri(2, MH - 3)); // knock through a few walls for loops
    for (let i = 0; i < 3; i++) { const x = ri(2, MW - 8), y = ri(2, MH - 8); for (let yy = 0; yy < 5; yy++) for (let xx = 0; xx < 5; xx++) dig(x + xx, y + yy); }
    return { x: 1.5, y: 1.5 };
  }
  function layArena() { // one huge hall full of pillars, with alcoves round the edge
    for (let y = 3; y < MH - 3; y++) for (let x = 3; x < MW - 3; x++) map[y * MW + x] = 0;
    for (let y = 6; y < MH - 6; y += 5) for (let x = 6; x < MW - 6; x += 5) if (Math.random() < 0.7) for (let k = 0; k < 4; k++) map[(y + (k >> 1)) * MW + x + (k & 1)] = theme.walls[0];
    for (let i = 0; i < 8; i++) { const side = ri(0, 3), p = ri(6, MW - 10); for (let a2 = 0; a2 < 3; a2++) for (let b2 = 0; b2 < 4; b2++) { if (side === 0) dig(p + b2, 1 + a2); if (side === 1) dig(p + b2, MH - 2 - a2); if (side === 2) dig(1 + a2, p + b2); if (side === 3) dig(MW - 2 - a2, p + b2); } }
    return { x: 4.5, y: 4.5 };
  }
  function layHalls() { // a grid of long corridors with rooms where they cross; some stretches blocked
    const step = 6;
    for (let y = 2; y < MH - 3; y += step) for (let x = 1; x < MW - 1; x++) if (Math.random() > 0.08) { dig(x, y); dig(x, y + 1); }
    for (let x = 2; x < MW - 3; x += step) for (let y = 1; y < MH - 1; y++) if (Math.random() > 0.08) { dig(x, y); dig(x + 1, y); }
    for (let i = 0; i < 7; i++) { const x = 2 + step * ri(0, Math.floor((MW - 8) / step)), y = 2 + step * ri(0, Math.floor((MH - 8) / step)); for (let yy = -1; yy < 4; yy++) for (let xx = -1; xx < 4; xx++) dig(x + xx, y + yy); }
    for (let i = 0; i < 12; i++) { const x = ri(3, MW - 5), y = ri(3, MH - 4); map[y * MW + x] = theme.walls[0]; map[y * MW + x + 1] = theme.walls[0]; }
    return { x: 2.5, y: 2.5 };
  }
  function nearestOpen(x, y) { let best = null, bd = 1e9; for (let yy = 1; yy < MH - 1; yy++) for (let xx = 1; xx < MW - 1; xx++) if (!map[yy * MW + xx]) { const d = (xx - x) ** 2 + (yy - y) ** 2; if (d < bd) { bd = d; best = { x: xx + 0.5, y: yy + 0.5 }; } } return best || { x: 1.5, y: 1.5 }; }
  function buildSky() {
    for (let y = 0; y < VIEW_H; y++) {
      const half = VIEW_H / 2, t = Math.abs(y - half) / half;
      const c = (r, g, b) => (255 << 24) | (Math.min(255, Math.round(b)) << 16) | (Math.min(255, Math.round(g)) << 8) | Math.min(255, Math.round(r));
      const [cr, cg, cb] = theme.ceil, [fr, fg, fb] = theme.floor;
      CEIL[y] = c(cr * (0.35 + t), cg * (0.35 + t), cb * (0.35 + t));
      FLOOR[y] = c(fr * (0.2 + t * 0.8), fg * (0.2 + t * 0.8), fb * (0.2 + t * 0.8));
    }
  }
  function genLevel(level) {
    theme = THEMES[(level - 1) % THEMES.length];
    layout = level === 1 ? 'rooms' : LAYOUTS[(level - 1 + Math.floor((level - 1) / THEMES.length)) % LAYOUTS.length];
    MW = MH = 34 + Math.min(16, level * 2);
    map = new Uint8Array(MW * MH).fill(theme.walls[0]);
    let s0 = ({ rooms: layRooms, caves: layCaves, maze: layMaze, arena: layArena, halls: layHalls })[layout]();
    if (map[Math.floor(s0.y) * MW + Math.floor(s0.x)]) s0 = nearestOpen(s0.x, s0.y);
    // paint walls in patches of the theme's textures
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { const i = y * MW + x; if (map[i]) map[i] = theme.walls[((x >> 3) * 7 + (y >> 3) * 13 + level) % theme.walls.length]; }
    // flood from the start: wall off anything unreachable, and measure distances
    const dist = new Int32Array(MW * MH).fill(-1), q = [Math.floor(s0.y) * MW + Math.floor(s0.x)]; dist[q[0]] = 0;
    for (let h = 0; h < q.length; h++) {
      const i = q[h], x = i % MW, y = (i / MW) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue; const j = ny * MW + nx; if (map[j] || dist[j] >= 0) continue; dist[j] = dist[i] + 1; q.push(j); }
    }
    for (let i = 0; i < map.length; i++) if (!map[i] && dist[i] < 0) map[i] = theme.walls[0];
    const cells = q.map(i => ({ x: (i % MW) + 0.5, y: ((i / MW) | 0) + 0.5, d: dist[i] }));
    start = { x: Math.floor(s0.x) + 0.5, y: Math.floor(s0.y) + 0.5 };
    const farthest = cells.reduce((a, c) => (c.d > a.d ? c : a), cells[0]);
    exit = { x: farthest.x, y: farthest.y };
    const far = cells.filter(c => c.d > 7), any = () => pick(far.length ? far : cells);
    things = [{ type: 'exit', x: exit.x, y: exit.y, spr: SPR.toilet, scale: 0.9 }];
    const count = 6 + level * 3;
    for (let i = 0; i < count; i++) {
      const c = any(), k = KINDS[ri(0, KINDS.length - 1)], hp = Math.round(k.hp * (1 + (level - 1) * 0.18));
      things.push({ type: 'enemy', kind: k, x: c.x, y: c.y, hp, maxhp: hp, cd: rnd(0.5, 2), awake: false, hurt: 0, scale: 0.85, stuck: 0, sx: 0, sy: 0, wob: Math.random() * 6 });
    }
    if (level % 3 === 0) { const k = pick(KINDS), hp = 500 + level * 60, c = cells.find(c => c.d === farthest.d - 2) || farthest; things.push({ type: 'enemy', boss: true, kind: k, x: c.x, y: c.y, hp, maxhp: hp, cd: 1, awake: false, hurt: 0, scale: 1.6, stuck: 0, sx: 0, sy: 0, wob: 0 }); }
    const drop = (type, spr, n, extra = {}) => { for (let i = 0; i < n; i++) { const c = pick(cells); things.push({ type, spr, x: c.x, y: c.y, scale: 0.35, pickup: true, ...extra }); } };
    drop('lube', SPR.lube, ri(3, 5)); drop('jug', SPR.jug, ri(3, 5)); drop('condom', SPR.condom, ri(1, 2)); drop('pill', SPR.pill, 1);
    if (level >= 3) drop('bigjug', SPR.bigjug, ri(1, 2));
    for (const w of WEAPONS) if (w.unlock && w.unlock <= level && !state.owned[w.id]) drop('weapon', w.icon, 1, { weapon: w.id, scale: 0.4 });
    shots = []; booms = [];
    buildSky();
  }
  const solid = (x, y) => { const mx = Math.floor(x), my = Math.floor(y); return mx < 0 || my < 0 || mx >= MW || my >= MH || map[my * MW + mx] > 0; };
  function lineOfSight(ax, ay, bx, by) { const d = Math.hypot(bx - ax, by - ay), n = Math.ceil(d * 4); for (let i = 1; i < n; i++) { const t = i / n; if (solid(ax + (bx - ax) * t, ay + (by - ay) * t)) return false; } return true; }
  function moveCircle(o, dx, dy, r) { // slide along walls
    if (!solid(o.x + dx + Math.sign(dx) * r, o.y) && !solid(o.x + dx + Math.sign(dx) * r, o.y + r * 0.7) && !solid(o.x + dx + Math.sign(dx) * r, o.y - r * 0.7)) o.x += dx; else dx = 0;
    if (!solid(o.x, o.y + dy + Math.sign(dy) * r) && !solid(o.x + r * 0.7, o.y + dy + Math.sign(dy) * r) && !solid(o.x - r * 0.7, o.y + dy + Math.sign(dy) * r)) o.y += dy; else dy = 0;
    return dx !== 0 || dy !== 0;
  }

  // ---------- weapons (one per number key, like the classic layout) ----------
  const icon = (col, label) => canvasSprite(32, 32, g => { const gr = g.createLinearGradient(0, 9, 0, 23); gr.addColorStop(0, '#7c858c'); gr.addColorStop(0.5, '#2b3035'); gr.addColorStop(1, '#14171a'); g.fillStyle = gr; g.beginPath(); g.roundRect ? g.roundRect(3, 10, 24, 12, 5) : g.rect(3, 10, 24, 12); g.fill(); g.fillStyle = '#d6ccb4'; for (let i = 0; i < 5; i++) g.fillRect(6 + i * 4, 11, 2, 10); const gl = g.createRadialGradient(27, 16, 0, 27, 16, 6); gl.addColorStop(0, '#fff'); gl.addColorStop(0.4, col); gl.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gl; g.beginPath(); g.arc(27, 16, 6, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = 'bold 8px monospace'; g.fillText(label, 12, 30); });
  const WEAPONS = [
    { id: 'slap',   slot: 1, name: 'LIMP SLAP',      cost: 0,  rate: 0.42, melee: { range: 1.2, dmg: 22, arc: 0.6 } },
    { id: 'vib',    slot: 1, name: 'THE VIBRATOR',   cost: 0,  rate: 0.08, melee: { range: 1.05, dmg: 6, arc: 0.45 }, unlock: 1, col: '#b04fd6' },
    { id: 'squirt', slot: 2, name: 'SQUIRTER',       cost: 1,  rate: 0.28, n: 1,  spread: 0.012, dmg: 22, speed: 13, size: 0.18 },
    { id: 'spray',  slot: 3, name: 'SPRAYER',        cost: 2,  rate: 0.75, n: 5,  spread: 0.07,  dmg: 14, speed: 13, size: 0.16, unlock: 2, col: '#d0739a' },
    { id: 'buster', slot: 3, name: 'BALL BUSTER',    cost: 4,  rate: 1.1,  n: 10, spread: 0.085, dmg: 15, speed: 13, size: 0.16, unlock: 3, col: '#e0413b' },
    { id: 'gusher', slot: 4, name: 'MACHINE GUSHER', cost: 1,  rate: 0.1,  n: 1,  spread: 0.045, dmg: 13, speed: 14, size: 0.15, unlock: 2, col: '#ffb98a' },
    { id: 'money',  slot: 5, name: 'MONEY SHOT',     cost: 5,  rate: 0.9,  n: 1,  spread: 0,     dmg: 30, speed: 9,  size: 0.34, splash: { r: 2.3, dmg: 110, self: 0.35 }, unlock: 4, col: '#e2b13c' },
    { id: 'pulse',  slot: 6, name: 'PROTEIN PULSE',  cost: 1,  rate: 0.085, n: 1, spread: 0.02,  dmg: 17, speed: 19, size: 0.14, glow: true, unlock: 5, col: '#7fd8ff' },
    { id: 'finish', slot: 7, name: 'THE BIG FINISH', cost: 40, rate: 1.8,  n: 1,  spread: 0,     dmg: 0,  speed: 6.5, size: 0.85, splash: { r: 7, dmg: 700, self: 0 }, unlock: 6, col: '#ffffff' },
  ];
  WEAPONS.forEach(w => { if (w.col) w.icon = icon(w.col, String(w.slot)); });
  const WEAPON = id => WEAPONS.find(w => w.id === id);
  SPR.bigjug = canvasSprite(32, 32, g => { g.fillStyle = '#f2ede2'; g.beginPath(); g.roundRect ? g.roundRect(4, 6, 24, 25, 6) : g.rect(4, 6, 24, 25); g.fill(); g.fillStyle = '#e2b13c'; g.fillRect(9, 1, 14, 6); g.fillStyle = '#3a1f2b'; g.font = 'bold 6px monospace'; g.fillText('BIG', 10, 17); g.fillText('LOAD', 8, 25); });
  SPR.pulse = canvasSprite(32, 32, g => { const gr = g.createRadialGradient(16, 16, 1, 16, 16, 15); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.4, '#bff0ff'); gr.addColorStop(1, 'rgba(80,190,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); });

  // ---------- game state ----------
  const state = { on: false, scene: 'title', level: 1, hp: 100, armor: 0, ammo: 60, score: 0, kills: 0, owned: { slap: 1, squirt: 1 }, weapon: 'squirt', pill: 0, cool: 0, shake: 0, bob: 0, flash: 0, flashCol: '', splats: [], msg: '', msgT: 0, levelT: 0, total: 0 };
  const pl = { x: 0, y: 0, dx: 1, dy: 0, px: 0, py: FOV };
  function setAngle(a) { pl.dx = Math.cos(a); pl.dy = Math.sin(a); pl.px = -Math.sin(a) * FOV; pl.py = Math.cos(a) * FOV; pl.a = a; }
  function newGame() { Object.assign(state, { level: 1, hp: 100, armor: 0, ammo: 60, score: 0, kills: 0, owned: { slap: 1, squirt: 1 }, weapon: 'squirt', pill: 0, splats: [], total: 0, shake: 0 }); startLevel(); }
  function startLevel() {
    genLevel(state.level); pl.x = start.x; pl.y = start.y;
    let best = 0, bd = 0; for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; let d = 0; while (d < 20 && !solid(pl.x + Math.cos(a) * d, pl.y + Math.sin(a) * d)) d += 0.25; if (d > bd) { bd = d; best = a; } }
    setAngle(best);
    state.scene = 'play'; state.levelT = 0; toast(`LEVEL ${state.level}: ${theme.name} - ${LAYOUT_NAMES[layout]}`, 2.8);
  }
  function toast(m, t = 1.6) { state.msg = m; state.msgT = t; }

  // ---------- DOM ----------
  const css = `
  #coom{position:fixed;inset:0;z-index:20;display:none;background:#000;touch-action:none;user-select:none;-webkit-user-select:none;font-family:"Press Start 2P",monospace}
  #coom.on{display:block}
  #coom canvas{position:absolute !important;inset:auto !important;left:50% !important;top:50% !important;transform:translate(-50%,-50%);image-rendering:pixelated;image-rendering:crisp-edges;z-index:auto !important;cursor:crosshair}
  #coom .x{position:absolute;top:calc(10px + env(safe-area-inset-top));right:10px;z-index:3;width:38px;height:38px;border-radius:50%;background:#fff;border:2px solid #3a1f2b;font:700 18px system-ui;cursor:pointer}
  #coom .touch{position:absolute;inset:0;z-index:2;display:none}
  #coom.mobile.playing .touch{display:block}
  #coom .stick{position:absolute;left:24px;bottom:calc(30px + env(safe-area-inset-bottom));width:130px;height:130px;border-radius:50%;background:rgba(255,255,255,.08);border:2px solid rgba(255,255,255,.25)}
  #coom .knob{position:absolute;left:41px;top:41px;width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,.3)}
  #coom .fire{position:absolute;right:24px;bottom:calc(40px + env(safe-area-inset-bottom));width:96px;height:96px;border-radius:50%;background:rgba(255,90,122,.55);border:3px solid rgba(255,255,255,.6);color:#fff;font:10px "Press Start 2P",monospace}
  #coom .swap{position:absolute;right:132px;bottom:calc(52px + env(safe-area-inset-bottom));width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,.15);border:2px solid rgba(255,255,255,.4);color:#fff;font:8px "Press Start 2P",monospace}
  #coom .panel{position:absolute;inset:0;z-index:4;display:none;align-items:center;justify-content:center;background:rgba(10,0,6,.82);color:#fff;text-align:center}
  #coom .panel.on{display:flex}
  #coom .panel .in{max-width:min(520px,92vw);padding:16px}
  #coom h1{font:400 clamp(44px,12vw,92px) "Bagel Fat One",system-ui;color:#ff5a7a;letter-spacing:4px;text-shadow:0 5px 0 #7d0f3a,0 9px 0 #3a1f2b;margin:0 0 6px}
  #coom h2{font-size:clamp(14px,3.6vw,20px);color:#ff5a7a;margin:6px 0 14px}
  #coom p{font-size:10px;line-height:1.9;color:#e8d8df;margin:6px 0}
  #coom .btn{font:12px "Press Start 2P",monospace;color:#fff;background:#c2185b;border:none;border-radius:8px;padding:12px 16px;margin:6px;cursor:pointer;box-shadow:0 4px 0 #7d0f3a}
  #coom .btn.alt{background:#4a4150;box-shadow:0 4px 0 #2a2430}
  #coom input{font:14px "Press Start 2P",monospace;text-transform:uppercase;width:12ch;padding:10px;border-radius:6px;border:2px solid #ff5a7a;background:#1b0d14;color:#fff;text-align:center}
  #coom table{margin:8px auto;border-collapse:collapse;font-size:10px}
  #coom td{padding:5px 8px;text-align:left}#coom td.n{text-align:right;color:#ff9ec4}
  #coom tr.me td{color:#ffd34a}
  #coom .small{font-size:8px;color:#a8949e}
  `;
  const root = document.createElement('div'); root.id = 'coom';
  root.innerHTML = `<style>${css}</style><canvas width="${W}" height="${H}"></canvas>
    <div class="touch"><div class="stick"><div class="knob"></div></div><button class="swap">SWAP</button><button class="fire">FIRE</button></div>
    <button class="x" aria-label="Close">✕</button>
    <div class="panel" id="coomTitle"><div class="in"><h1>COOM</h1><h2>KNEE-DEEP IN THE JIZZ</h2>
      <p>Blast the cocks with your squirter. Dodge their goo. Find the toilet and flush yourself to the next level.</p>
      <p class="small" id="coomHelp"></p>
      <div><button class="btn" data-act="start">START</button><button class="btn alt" data-act="scores">HIGH SCORES</button></div></div></div>
    <div class="panel" id="coomOver"><div class="in"><h2 id="coomOverTitle">YOU GOT COOMED</h2><p id="coomFinal"></p>
      <p>Enter your name for the leaderboard:</p><p><input id="coomName" maxlength="12" autocomplete="off" spellcheck="false"></p>
      <div><button class="btn" data-act="submit">SUBMIT</button><button class="btn alt" data-act="skip">SKIP</button></div></div></div>
    <div class="panel" id="coomScores"><div class="in"><h2>HIGH SCORES</h2><div id="coomTable"><p>Loading…</p></div><p class="small" id="coomWhere"></p>
      <div><button class="btn" data-act="start">PLAY</button><button class="btn alt" data-act="title">BACK</button></div></div></div>`;
  document.body.appendChild(root);
  const cv = root.querySelector('canvas'), ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
  const img = ctx.createImageData(W, VIEW_H), buf = new Uint32Array(img.data.buffer), zbuf = new Float32Array(W);
  const CEIL = new Uint32Array(VIEW_H), FLOOR = new Uint32Array(VIEW_H);
  const isTouch = !matchMedia('(hover:hover) and (pointer:fine)').matches;
  if (isTouch) root.classList.add('mobile');
  root.querySelector('#coomHelp').textContent = isTouch ? 'Left thumb: move. Drag right side: turn. FIRE to shoot, SWAP for weapons.' : 'Click to aim with the mouse. WASD move, arrows turn, click/space to fire, 1-7 or mouse wheel for weapons, Esc to pause.';
  const panels = { title: root.querySelector('#coomTitle'), over: root.querySelector('#coomOver'), scores: root.querySelector('#coomScores') };
  function show(name) { for (const k in panels) panels[k].classList.toggle('on', k === name); root.classList.toggle('playing', !name); }
  function fit() { const s = Math.min(innerWidth / W, innerHeight / H); cv.style.width = Math.floor(W * s) + 'px'; cv.style.height = Math.floor(H * s) + 'px'; }
  addEventListener('resize', fit);

  // ---------- input ----------
  const keys = {}; let firing = false, turnDelta = 0;
  addEventListener('keydown', e => {
    if (!state.on) return; if (document.activeElement && document.activeElement.id === 'coomName') { if (e.key === 'Enter') submitScore(); return; }
    keys[e.key.toLowerCase()] = true;
    if (e.key === ' ') { firing = true; e.preventDefault(); }
    if (/^[1-7]$/.test(e.key)) selectSlot(+e.key);
    if (e.key === 'Escape') { if (document.pointerLockElement) document.exitPointerLock(); else if (state.scene === 'play') pause(); else close(); }
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) e.preventDefault();
  });
  addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; if (e.key === ' ') firing = false; });
  cv.addEventListener('mousedown', () => { if (state.scene !== 'play' || isTouch) return; if (document.pointerLockElement !== cv) { try { cv.requestPointerLock(); } catch (e) {} } firing = true; });
  addEventListener('mouseup', () => { if (!isTouch) firing = false; });
  addEventListener('mousemove', e => { if (document.pointerLockElement === cv) turnDelta += e.movementX * 0.0032; });
  // touch: left stick moves, drag on the right turns, FIRE button
  const stick = root.querySelector('.stick'), knob = root.querySelector('.knob'), touchEl = root.querySelector('.touch');
  const joy = { id: null, x: 0, y: 0, cx: 0, cy: 0 }, look = { id: null, x: 0 };
  touchEl.addEventListener('pointerdown', e => {
    if (e.target.closest('.fire') || e.target.closest('.swap')) return;
    if (e.clientX < innerWidth * 0.45) { const r = stick.getBoundingClientRect(); joy.id = e.pointerId; joy.cx = r.left + r.width / 2; joy.cy = r.top + r.height / 2; joyMove(e); }
    else { look.id = e.pointerId; look.x = e.clientX; }
    touchEl.setPointerCapture(e.pointerId);
  });
  function joyMove(e) { let dx = e.clientX - joy.cx, dy = e.clientY - joy.cy; const d = Math.hypot(dx, dy), m = 50; if (d > m) { dx *= m / d; dy *= m / d; } joy.x = dx / m; joy.y = dy / m; knob.style.transform = `translate(${dx}px,${dy}px)`; }
  touchEl.addEventListener('pointermove', e => { if (e.pointerId === joy.id) joyMove(e); if (e.pointerId === look.id) { turnDelta += (e.clientX - look.x) * 0.009; look.x = e.clientX; } });
  const endTouch = e => { if (e.pointerId === joy.id) { joy.id = null; joy.x = joy.y = 0; knob.style.transform = ''; } if (e.pointerId === look.id) look.id = null; };
  touchEl.addEventListener('pointerup', endTouch); touchEl.addEventListener('pointercancel', endTouch);
  const fireBtn = root.querySelector('.fire');
  fireBtn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); firing = true; });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => fireBtn.addEventListener(t, () => (firing = false)));
  function selectSlot(n) {
    const inSlot = WEAPONS.filter(w => w.slot === n && state.owned[w.id]); if (!inSlot.length) return;
    const cur = inSlot.findIndex(w => w.id === state.weapon), w = inSlot[(cur + 1) % inSlot.length];
    if (w.id !== state.weapon) { state.weapon = w.id; toast(w.name, 1); play('drop', 0.6); }
  }
  function cycleWeapon(dir = 1) { const own = WEAPONS.filter(w => state.owned[w.id]); const i = own.findIndex(w => w.id === state.weapon); const w = own[(i + dir + own.length) % own.length]; state.weapon = w.id; toast(w.name, 1); }
  root.querySelector('.swap').addEventListener('pointerdown', e => { e.stopPropagation(); cycleWeapon(1); });
  addEventListener('wheel', e => { if (state.on && state.scene === 'play') cycleWeapon(e.deltaY > 0 ? 1 : -1); }, { passive: true });
  root.querySelector('.x').onclick = () => close();
  root.addEventListener('click', e => {
    const a = e.target.dataset && e.target.dataset.act; if (!a) return;
    if (a === 'start') { show(null); newGame(); }
    if (a === 'scores') showScores();
    if (a === 'title') { state.scene = 'title'; show('title'); }
    if (a === 'submit') submitScore();
    if (a === 'skip') showScores();
    if (a === 'resume') { show(null); state.scene = 'play'; }
  });
  function pause() { state.scene = 'paused'; firing = false; show('title'); root.querySelector('#coomTitle [data-act="start"]').textContent = 'NEW GAME';
    if (!root.querySelector('#coomTitle [data-act="resume"]')) { const b = document.createElement('button'); b.className = 'btn'; b.dataset.act = 'resume'; b.textContent = 'RESUME'; root.querySelector('#coomTitle .in > div').prepend(b); } }

  // ---------- leaderboard ----------
  const LOCAL = 'coom-scores';
  const localScores = () => { try { return JSON.parse(localStorage.getItem(LOCAL)) || []; } catch (e) { return []; } };
  const saveLocal = list => { try { localStorage.setItem(LOCAL, JSON.stringify(list.slice(0, 10))); } catch (e) {} };
  let lastEntry = null;
  async function fetchGlobal() { try { const r = await fetch('/api/scores', { cache: 'no-store' }); if (!r.ok) return null; const j = await r.json(); return Array.isArray(j.scores) ? j.scores : null; } catch (e) { return null; } }
  async function submitScore() {
    const name = (root.querySelector('#coomName').value || '').toUpperCase().replace(/[^A-Z0-9 _-]/g, '').trim().slice(0, 12) || 'ANON';
    try { localStorage.setItem('coom-name', name); } catch (e) {}
    const entry = { name, score: state.score, level: state.level, kills: state.kills, at: Date.now() };
    lastEntry = entry;
    const list = localScores(); list.push(entry); list.sort((a, b) => b.score - a.score); saveLocal(list);
    try { await fetch('/api/scores', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, score: entry.score, level: entry.level, kills: entry.kills }) }); } catch (e) {}
    showScores();
  }
  async function showScores() {
    show('scores'); state.scene = 'scores';
    const tbl = root.querySelector('#coomTable'), where = root.querySelector('#coomWhere');
    tbl.innerHTML = '<p>Loading…</p>';
    let list = await fetchGlobal(), global = !!list;
    if (!list) list = localScores();
    where.textContent = global ? 'Worldwide scores' : 'Scores on this device (worldwide board coming soon)';
    if (!list.length) { tbl.innerHTML = '<p>No scores yet. Be the first!</p>'; return; }
    tbl.innerHTML = '<table>' + list.slice(0, 10).map((s, i) => `<tr class="${lastEntry && s.name === lastEntry.name && s.score === lastEntry.score ? 'me' : ''}"><td>${i + 1}.</td><td>${String(s.name).replace(/[<>&]/g, '')}</td><td class="n">${s.score}</td><td class="small">L${s.level || 1}</td></tr>`).join('') + '</table>';
  }

  // ---------- combat ----------
  function shoot() {
    let w = WEAPON(state.weapon);
    if (w.cost > state.ammo) { // not enough load for this one: drop back to something that works
      const fallback = state.ammo >= 1 ? 'squirt' : (state.owned.vib ? 'vib' : 'slap');
      toast(state.ammo >= 1 ? 'NOT ENOUGH LOAD' : 'OUT OF LOAD! Find a jug.', 1); state.weapon = fallback; w = WEAPON(fallback); state.cool = 0.3; play('drop', 1.4);
      if (w.cost > state.ammo) return;
    }
    state.ammo -= w.cost; state.cool = w.rate; state.recoil = 1;
    const boost = state.pill > 0 ? 2 : 1;
    if (w.melee) {
      let hit = false;
      for (const t of things) {
        if (t.type !== 'enemy' || t.dead) continue;
        const dx = t.x - pl.x, dy = t.y - pl.y, d = Math.hypot(dx, dy); if (d > w.melee.range + 0.2 * t.scale) continue;
        let da = Math.atan2(dy, dx) - pl.a; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
        if (Math.abs(da) > w.melee.arc) continue;
        damage(t, w.melee.dmg * boost); hit = true; if (w.id === 'slap') break;
      }
      if (w.id === 'vib') { if (Math.random() < 0.3) play('bump', 0.25, 0.6); } else play(hit ? 'bump' : 'drop', hit ? 1 : 0.5, 1);
      return;
    }
    for (let i = 0; i < w.n; i++) {
      const a = pl.a + (w.n > 1 ? (i - (w.n - 1) / 2) * w.spread + rnd(-0.02, 0.02) : rnd(-w.spread, w.spread));
      shots.push({ x: pl.x + Math.cos(a) * 0.35, y: pl.y + Math.sin(a) * 0.35, vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed, mine: true, dmg: w.dmg * boost, life: 2.2, size: w.size, splash: w.splash, glow: w.glow, big: w.id === 'finish' });
    }
    if (w.id === 'finish') { play('moan', 0.6); state.shake = 0.3; } else if (w.id === 'money') play('throw', 0.9); else play('grab', w.id === 'gusher' || w.id === 'pulse' ? 1.6 : 0.9);
    for (const t of things) if (t.type === 'enemy' && !t.awake && Math.hypot(t.x - pl.x, t.y - pl.y) < 10) t.awake = true;
  }
  function damage(t, d) {
    t.hp -= d; t.hurt = 0.15; t.awake = true;
    if (t.hp <= 0 && !t.dead) { t.dead = 0.001; state.kills++; state.score += t.boss ? 2500 : 100 + state.level * 20; things.push({ type: 'puddle', x: t.x, y: t.y, spr: SPR.puddle, scale: t.boss ? 1 : 0.6, flat: true }); play('moan', t.boss ? 0.5 : 0.7 + Math.random() * 0.6); if (t.boss) toast('BOSS DOWN!', 2); }
  }
  function explode(x, y, sp, big) {
    booms.push({ x, y, t: 0, r: sp.r, big });
    state.shake = Math.max(state.shake, big ? 0.9 : 0.35); state.flash = big ? 0.35 : 0.12; state.flashCol = 'rgba(255,255,255,.45)';
    for (const t of things) { if (t.type !== 'enemy' || t.dead) continue; const d = Math.hypot(t.x - x, t.y - y); if (d < sp.r && (big || lineOfSight(x, y, t.x, t.y))) damage(t, sp.dmg * (1 - d / sp.r * 0.6) * (state.pill > 0 ? 2 : 1)); }
    const pd = Math.hypot(pl.x - x, pl.y - y); if (sp.self && pd < sp.r) hurtPlayer(Math.round(sp.dmg * sp.self * (1 - pd / sp.r)));
    things.push({ type: 'puddle', x, y, spr: SPR.puddle, scale: big ? 1.6 : 0.8, flat: true });
    play('grab', big ? 0.5 : 0.8); play('bump', 1, big ? 2 : 1.3);
  }
  function hurtPlayer(d) {
    const absorbed = Math.min(state.armor, Math.round(d * 0.5)); state.armor -= absorbed; state.hp -= d - absorbed;
    state.flash = 0.25; state.flashCol = 'rgba(255,0,0,.35)'; play('bump', 0.7, 1);
    if (state.hp <= 0) { state.hp = 0; die(); }
  }
  function die() {
    state.scene = 'dead'; firing = false; if (document.pointerLockElement) document.exitPointerLock();
    play('moan', 0.55);
    setTimeout(() => {
      root.querySelector('#coomFinal').innerHTML = `SCORE ${state.score}<br>LEVEL ${state.level} &middot; ${state.kills} KILLS`;
      let n = ''; try { n = localStorage.getItem('coom-name') || ''; } catch (e) {}
      root.querySelector('#coomName').value = n; show('over'); setTimeout(() => { if (!isTouch) root.querySelector('#coomName').focus(); }, 50);
    }, 1400);
  }
  function update(dt) {
    if (state.scene !== 'play') return;
    state.levelT += dt; if (state.msgT > 0) state.msgT -= dt; if (state.flash > 0) state.flash -= dt; if (state.pill > 0) state.pill -= dt;
    if (state.recoil > 0) state.recoil = Math.max(0, state.recoil - dt * 6);
    // turning
    let turn = turnDelta; turnDelta = 0;
    if (keys.arrowleft || keys.q) turn -= 2.6 * dt; if (keys.arrowright || keys.e) turn += 2.6 * dt;
    if (turn) setAngle(pl.a + turn);
    // moving
    let f = 0, s = 0;
    if (keys.w || keys.arrowup) f += 1; if (keys.s || keys.arrowdown) f -= 1; if (keys.a) s -= 1; if (keys.d) s += 1;
    f -= joy.y; s += joy.x;
    const len = Math.hypot(f, s); if (len > 1) { f /= len; s /= len; }
    const sp = 3.4 * dt, mx = (pl.dx * f - pl.dy * s) * sp, my = (pl.dy * f + pl.dx * s) * sp;
    if (moveCircle(pl, mx, my, 0.22)) state.bob += dt * 9 * Math.min(1, Math.hypot(f, s));
    // firing
    if (state.cool > 0) state.cool -= dt; if (firing && state.cool <= 0) shoot();
    // pickups + exit
    for (let i = things.length - 1; i >= 0; i--) {
      const t = things[i]; const d = Math.hypot(t.x - pl.x, t.y - pl.y);
      if (t.type === 'exit' && d < 0.7) { levelDone(); return; }
      if (!t.pickup || d > 0.55) continue;
      let took = true;
      if (t.type === 'lube') { if (state.hp >= 100) took = false; else { state.hp = Math.min(100, state.hp + 25); toast('LUBED UP! +25 HEALTH'); } }
      if (t.type === 'jug') { state.ammo = Math.min(400, state.ammo + 20); toast('PICKED UP A LOAD! +20'); }
      if (t.type === 'bigjug') { state.ammo = Math.min(400, state.ammo + 60); toast('A BIG LOAD! +60'); }
      if (t.type === 'condom') { if (state.armor >= 100) took = false; else { state.armor = Math.min(100, state.armor + 50); toast('PROTECTION! +50 ARMOR'); } }
      if (t.type === 'pill') { state.pill = 15; toast('BLUE PILL! DOUBLE DAMAGE'); play('moan', 1.3); }
      if (t.type === 'weapon') { const w = WEAPON(t.weapon); state.owned[w.id] = 1; state.weapon = w.id; state.ammo = Math.min(400, state.ammo + Math.max(10, w.cost * 3)); toast(`${w.name}! (KEY ${w.slot})`, 2.2); play('moan', 1.1); }
      if (took) { things.splice(i, 1); state.flash = 0.15; state.flashCol = 'rgba(255,255,255,.25)'; play('drop', 0.8); }
    }
    // enemies
    for (const t of things) {
      if (t.type !== 'enemy' || t.dead) { if (t.dead) t.dead += dt; continue; }
      if (t.hurt > 0) t.hurt -= dt;
      const dx = pl.x - t.x, dy = pl.y - t.y, d = Math.hypot(dx, dy);
      const sees = d < 16 && lineOfSight(t.x, t.y, pl.x, pl.y);
      if (sees && d < 11) t.awake = true;
      if (!t.awake) continue;
      t.wob += dt * 8; t.cd -= dt;
      const k = t.kind, spd = k.speed * (t.boss ? 0.8 : 1) * (1 + (state.level - 1) * 0.05);
      const keepAway = k.ranged && !t.boss ? 3.5 : 0.75;
      if (t.stuck > 0) { t.stuck -= dt; moveCircle(t, t.sx * spd * dt, t.sy * spd * dt, 0.3); }
      else if (d > keepAway) { const ok = moveCircle(t, dx / d * spd * dt, dy / d * spd * dt, 0.3); if (!ok) { t.stuck = 0.6; const a = Math.random() * Math.PI * 2; t.sx = Math.cos(a); t.sy = Math.sin(a); } }
      // attacks
      if (t.cd <= 0 && sees) {
        if ((k.ranged || t.boss) && d < 13) {
          const n = t.boss ? 3 : 1;
          for (let i = 0; i < n; i++) { const a = Math.atan2(dy, dx) + (i - (n - 1) / 2) * 0.18; shots.push({ x: t.x, y: t.y, vx: Math.cos(a) * (t.boss ? 6 : 5), vy: Math.sin(a) * (t.boss ? 6 : 5), mine: false, dmg: t.boss ? 14 : k.dmg, life: 4, big: t.boss }); }
          t.cd = t.boss ? rnd(0.9, 1.4) : rnd(1.6, 2.8); play('throw', 0.5);
        } else if (!k.ranged && d < 0.95) { hurtPlayer(k.dmg + state.level); t.cd = 0.9; play('bump', 0.9, 1); }
        else t.cd = 0.2;
      }
    }
    // goo projectiles
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i]; s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt;
      let gone = s.life <= 0 || solid(s.x, s.y);
      if (!gone && s.mine) for (const t of things) {
        if (t.type !== 'enemy' || t.dead) continue;
        if (Math.hypot(t.x - s.x, t.y - s.y) < 0.35 * t.scale + 0.15) {
          if (!s.splash) { damage(t, s.dmg); play('bump', 0.6, 1); } gone = true;
          break;
        }
      }
      if (!gone && !s.mine && Math.hypot(pl.x - s.x, pl.y - s.y) < 0.38) {
        gone = true; hurtPlayer(s.dmg);
        // got jizzed: goo on the screen
        for (let k = 0; k < (s.big ? 4 : 2); k++) state.splats.push({ x: rnd(30, W - 30), y: rnd(20, VIEW_H - 30), r: rnd(10, 26), t: 0, drip: rnd(10, 40) });
      }
      if (gone) { if (s.splash && s.mine) explode(s.x - s.vx * dt, s.y - s.vy * dt, s.splash, s.big); shots.splice(i, 1); }
    }
    things = things.filter(t => !(t.dead && t.dead > 0.6));
    state.splats = state.splats.filter(s => (s.t += dt) < 3.5);
    booms = booms.filter(b => (b.t += dt) < 0.6);
    if (state.shake > 0) state.shake -= dt;
  }
  function levelDone() {
    const bonus = 500 * state.level + Math.max(0, Math.round(300 - state.levelT * 2));
    state.score += bonus; play('throw', 1.2); play('moan', 0.9);
    toast(`FLUSHED! +${bonus}`, 2);
    state.level++; state.hp = Math.min(100, state.hp + 20);
    state.scene = 'flush'; state.flushT = 0;
  }

  // ---------- rendering ----------
  function renderWorld() {
    for (let y = 0; y < VIEW_H; y++) { const row = y < VIEW_H / 2 ? CEIL[y] : FLOOR[y]; buf.fill(row, y * W, y * W + W); }
    for (let x = 0; x < W; x++) {
      const cam = 2 * x / W - 1, rdx = pl.dx + pl.px * cam, rdy = pl.dy + pl.py * cam;
      let mx = Math.floor(pl.x), my = Math.floor(pl.y);
      const ddx = Math.abs(1 / rdx), ddy = Math.abs(1 / rdy);
      let sx, sy, sdx, sdy, side = 0, hit = 0;
      if (rdx < 0) { sx = -1; sdx = (pl.x - mx) * ddx; } else { sx = 1; sdx = (mx + 1 - pl.x) * ddx; }
      if (rdy < 0) { sy = -1; sdy = (pl.y - my) * ddy; } else { sy = 1; sdy = (my + 1 - pl.y) * ddy; }
      for (let i = 0; i < 64 && !hit; i++) {
        if (sdx < sdy) { sdx += ddx; mx += sx; side = 0; } else { sdy += ddy; my += sy; side = 1; }
        if (mx < 0 || my < 0 || mx >= MW || my >= MH) { hit = 1; break; }
        hit = map[my * MW + mx];
      }
      const dist = side === 0 ? (mx - pl.x + (1 - sx) / 2) / rdx : (my - pl.y + (1 - sy) / 2) / rdy;
      zbuf[x] = dist;
      const lh = Math.floor(VIEW_H / Math.max(0.0001, dist)), y0 = Math.max(0, Math.floor(VIEW_H / 2 - lh / 2)), y1 = Math.min(VIEW_H - 1, Math.floor(VIEW_H / 2 + lh / 2));
      let wx = side === 0 ? pl.y + dist * rdy : pl.x + dist * rdx; wx -= Math.floor(wx);
      let tx = Math.floor(wx * TEX); if ((side === 0 && rdx > 0) || (side === 1 && rdy < 0)) tx = TEX - tx - 1;
      const tex = TEXTURES[((hit || 1) - 1) % TEXTURES.length];
      const shade = clamp(1.25 - dist / theme.fog, 0.18, 1) * (side ? 0.78 : 1), step = TEX / lh;
      let tp = (y0 - VIEW_H / 2 + lh / 2) * step;
      for (let y = y0; y <= y1; y++) {
        const ty = Math.min(TEX - 1, tp | 0); tp += step;
        const c = tex[ty * TEX + tx];
        buf[y * W + x] = (255 << 24) | ((((c >> 16) & 255) * shade) << 16) | ((((c >> 8) & 255) * shade) << 8) | ((c & 255) * shade);
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  function renderSprites() {
    const list = [];
    for (const t of things) list.push({ o: t, d: (t.x - pl.x) ** 2 + (t.y - pl.y) ** 2 });
    for (const s of shots) list.push({ o: { x: s.x, y: s.y, spr: s.glow ? SPR.pulse : SPR.goo, scale: s.mine ? (s.size || 0.18) : (s.big ? 0.42 : 0.3), lift: s.mine && s.size > 0.5 ? 0 : 0.15 }, d: (s.x - pl.x) ** 2 + (s.y - pl.y) ** 2 });
    for (const b of booms) { const k = b.t / 0.6; list.push({ o: { x: b.x, y: b.y, spr: SPR.goo, scale: (b.big ? 2.5 : 1) * (0.4 + k * 1.2), lift: 0 }, d: (b.x - pl.x) ** 2 + (b.y - pl.y) ** 2 }); }
    list.sort((a, b) => b.d - a.d);
    const inv = 1 / (pl.px * pl.dy - pl.dx * pl.py);
    for (const { o } of list) {
      const spr = o.type === 'enemy' ? (o.hurt > 0 ? o.kind.hurt : o.kind.spr) : o.spr; if (!spr) continue;
      const rx = o.x - pl.x, ry = o.y - pl.y, tX = inv * (pl.dy * rx - pl.dx * ry), tY = inv * (-pl.py * rx + pl.px * ry);
      if (tY <= 0.1) continue;
      const scx = Math.floor((W / 2) * (1 + tX / tY));
      let sc = o.scale || 1; if (o.type === 'enemy' && o.dead) sc *= Math.max(0, 1 - o.dead * 1.6);
      const hgt = Math.abs(VIEW_H / tY) * sc, wid = hgt * (spr.width / spr.height);
      const bob = o.type === 'enemy' && !o.dead ? Math.sin(o.wob || 0) * hgt * 0.03 : 0;
      const groundY = VIEW_H / 2 + (VIEW_H / tY) / 2, lift = (o.lift || 0) * VIEW_H / tY;
      const top = o.flat ? groundY - hgt * 0.25 : groundY - hgt - lift + bob, h2 = o.flat ? hgt * 0.25 : hgt;
      const x0 = Math.floor(scx - wid / 2), x1 = Math.floor(scx + wid / 2);
      const shade = clamp(1.25 - tY / 10, 0.3, 1);
      ctx.globalAlpha = 1; ctx.filter = 'none';
      for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) {
        if (tY >= zbuf[x]) continue;
        const sxp = Math.floor((x - x0) / (x1 - x0) * spr.width);
        ctx.drawImage(spr, sxp, 0, 1, spr.height, x, top, 1, h2);
      }
      if (shade < 0.95) { // distance darkening over the sprite's columns
        ctx.fillStyle = `rgba(10,0,8,${(1 - shade) * 0.7})`; ctx.globalCompositeOperation = 'source-atop';
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  }
  // ---------- weapon art: biomechanical — gunmetal, bone, vertebrae, cables, glowing tips ----------
  const METAL = ['#14171a', '#2b3035', '#4a5157', '#7c858c'], BONE = ['#6e6553', '#a89d84', '#d6ccb4', '#efe8d6'];
  function metalGrad(x, w, dark = 0) { const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, METAL[0]); g.addColorStop(0.35, METAL[3 - dark]); g.addColorStop(0.55, METAL[2]); g.addColorStop(1, METAL[0]); return g; }
  function boneGrad(x, w) { const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, BONE[0]); g.addColorStop(0.4, BONE[3]); g.addColorStop(0.7, BONE[1]); g.addColorStop(1, BONE[0]); return g; }
  // a stack of vertebra-like plates along a barrel
  function spine(x, y, w, h, n, col) {
    for (let i = 0; i < n; i++) {
      const yy = y + (h / n) * i, ww = w * (0.82 + 0.18 * Math.sin(i * 1.7));
      ctx.fillStyle = col || boneGrad(x - ww / 2, ww); ctx.beginPath();
      ctx.moveTo(x - ww / 2, yy + h / n * 0.15); ctx.quadraticCurveTo(x, yy - h / n * 0.25, x + ww / 2, yy + h / n * 0.15);
      ctx.lineTo(x + ww / 2 - 2, yy + h / n * 0.75); ctx.quadraticCurveTo(x, yy + h / n * 0.45, x - ww / 2 + 2, yy + h / n * 0.75); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(x - ww / 2 + 2, yy + h / n * 0.72, ww - 4, 1);
    }
  }
  // a ribbed hose curving between two points
  function cable(x1, y1, cx, cy, x2, y2, w = 3) {
    ctx.strokeStyle = METAL[0]; ctx.lineWidth = w + 2; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(cx, cy, x2, y2); ctx.stroke();
    ctx.strokeStyle = METAL[2]; ctx.lineWidth = w; ctx.setLineDash([2, 2]); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(cx, cy, x2, y2); ctx.stroke(); ctx.setLineDash([]);
  }
  function barrel(x, y, w, h, rad = 6) { ctx.fillStyle = metalGrad(x, w); ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, rad) : ctx.rect(x, y, w, h); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(x + w * 0.3, y + 2, 2, h - 4); }
  function glow(x, y, r, col, a = 1) { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(0.35, col); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
  function rib(x, y, w, curl) { ctx.strokeStyle = BONE[1]; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + w * 0.6, y - curl, x + w, y + 2); ctx.stroke(); ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y + 1.5); ctx.quadraticCurveTo(x + w * 0.6, y - curl + 1.5, x + w, y + 3.5); ctx.stroke(); }
  function grip() { // a bony, segmented handle wrapped by a hose
    ctx.fillStyle = METAL[1]; ctx.fillRect(-9, -20, 18, 24); spine(0, -20, 16, 24, 4); cable(-10, -16, -22, -4, -14, 6, 3);
  }
  function drawWeapon() {
    const w = WEAPON(state.weapon), id = w.id, r = state.recoil || 0, t = state.levelT;
    let bx = W / 2 + 34 + Math.cos(state.bob) * 4, by = VIEW_H - 8 + Math.abs(Math.sin(state.bob)) * 4 + r * 6;
    if (id === 'vib' && firing) { bx += rnd(-1.5, 1.5); by += rnd(-1.5, 1.5); }
    ctx.save(); ctx.translate(bx, by);
    const pulseA = 0.55 + Math.sin(t * 5) * 0.25;
    if (id === 'slap') { // a long, segmented bone tail that whips
      ctx.rotate(-0.25 - r * 1.0);
      for (let i = 0; i < 9; i++) { const k = i / 8, x = -4 - Math.sin(k * 2.2) * 12, y = 4 - k * 60, s2 = 9 - k * 4; ctx.fillStyle = boneGrad(x - s2, s2 * 2); ctx.beginPath(); ctx.ellipse(x, y, s2, s2 * 0.7, -0.3, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x - s2 + 2, y + 2, s2 * 2 - 4, 1); }
      ctx.fillStyle = METAL[3]; ctx.beginPath(); ctx.moveTo(-14, -58); ctx.lineTo(-24, -70); ctx.lineTo(-10, -62); ctx.fill();
    } else if (id === 'vib') { // a chrome drill wrapped in ribs, humming violet
      grip(); barrel(-10, -64, 20, 48, 9); for (let i = 0; i < 5; i++) rib(-12, -56 + i * 9 + (firing ? Math.sin(t * 60 + i) * 1.5 : 0), 24, 5);
      glow(0, -64, 13, `rgba(180,90,255,${pulseA})`);
    } else if (id === 'squirt') { // a slim vertebral pistol with a pale eye at the muzzle
      grip(); barrel(-11, -54, 22, 40); spine(0, -54, 16, 34, 6); cable(10, -20, 22, -38, 8, -50, 2.5);
      ctx.fillStyle = METAL[0]; ctx.beginPath(); ctx.ellipse(0, -56, 9, 5, 0, 0, 7); ctx.fill(); glow(0, -57, 8, `rgba(240,235,220,${pulseA})`);
    } else if (id === 'spray') { // three bony throats fused to a metal spine
      grip(); barrel(-14, -50, 28, 36);
      for (const dx of [-11, 0, 11]) { ctx.fillStyle = boneGrad(dx - 5, 10); ctx.beginPath(); ctx.ellipse(dx, -56, 5, 9, dx * 0.02, 0, 7); ctx.fill(); ctx.fillStyle = METAL[0]; ctx.beginPath(); ctx.arc(dx, -62, 2.5, 0, 7); ctx.fill(); }
      cable(-14, -24, -26, -40, -12, -52); cable(14, -24, 26, -40, 12, -52);
    } else if (id === 'buster') { // twin ribbed barrels over a pair of armoured sacs
      grip(); ctx.fillStyle = METAL[1]; ctx.beginPath(); ctx.ellipse(-11, -14, 12, 10, 0, 0, 7); ctx.ellipse(11, -14, 12, 10, 0, 0, 7); ctx.fill();
      for (const dx of [-11, 11]) { ctx.strokeStyle = BONE[0]; ctx.lineWidth = 1; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(dx, -14, 6 + i * 3, 0.3, 2.8); ctx.stroke(); } }
      for (const dx of [-11, 11]) { barrel(dx - 8, -66, 16, 50, 7); spine(dx, -66, 12, 44, 7); ctx.fillStyle = METAL[0]; ctx.beginPath(); ctx.ellipse(dx, -67, 6, 3, 0, 0, 7); ctx.fill(); }
      cable(-20, -30, -30, -52, -18, -62); cable(20, -30, 30, -52, 18, -62);
    } else if (id === 'gusher') { // a rotating cluster of bone barrels on a gunmetal hub
      grip(); barrel(-15, -46, 30, 34, 10); cable(-15, -30, -28, -40, -16, -50); cable(15, -30, 28, -40, 16, -50);
      ctx.save(); ctx.translate(0, -56); ctx.rotate(t * (firing ? 28 : 1.5));
      for (let k = 0; k < 6; k++) { ctx.rotate(Math.PI / 3); ctx.fillStyle = boneGrad(-3, 6); ctx.fillRect(-3, -14, 6, 10); ctx.fillStyle = METAL[0]; ctx.fillRect(-1.5, -14, 3, 2); }
      ctx.restore(); ctx.fillStyle = METAL[3]; ctx.beginPath(); ctx.arc(0, -56, 5, 0, 7); ctx.fill();
    } else if (id === 'money') { // a heavy launcher: ribcage housing a glowing gold sac
      grip(); barrel(-20, -62, 40, 50, 12);
      for (let i = 0; i < 4; i++) { rib(-22, -54 + i * 10, 22, 7); ctx.save(); ctx.scale(-1, 1); rib(-22, -54 + i * 10, 22, 7); ctx.restore(); }
      glow(0, -38, 14, `rgba(230,180,60,${pulseA})`); ctx.fillStyle = METAL[0]; ctx.beginPath(); ctx.ellipse(0, -64, 14, 6, 0, 0, 7); ctx.fill(); ctx.fillStyle = BONE[2]; ctx.beginPath(); ctx.ellipse(0, -64, 9, 3.5, 0, 0, 7); ctx.fill();
    } else if (id === 'pulse') { // a sleek chrome emitter with glowing coils and a cyan core
      grip(); barrel(-12, -60, 24, 46, 11);
      for (let i = 0; i < 4; i++) { const yy = -54 + i * 10; ctx.fillStyle = `rgba(140,230,255,${0.35 + Math.sin(t * 10 - i) * 0.25})`; ctx.fillRect(-12, yy, 24, 3); }
      cable(12, -22, 26, -34, 10, -56, 2.5); glow(0, -62, 12, `rgba(120,220,255,${pulseA})`);
    } else if (id === 'finish') { // a towering biomechanical cannon: vertebral column, hoses, a seething white orb
      grip(); barrel(-24, -70, 48, 58, 14); spine(0, -70, 34, 54, 8);
      cable(-24, -20, -40, -50, -20, -68, 4); cable(24, -20, 40, -50, 20, -68, 4);
      for (let i = 0; i < 3; i++) { rib(-28, -60 + i * 16, 18, 6); ctx.save(); ctx.scale(-1, 1); rib(-28, -60 + i * 16, 18, 6); ctx.restore(); }
      glow(0, -78, 22 + Math.sin(t * 6) * 3, `rgba(255,250,240,${pulseA})`);
    }
    if (r > 0.5 && !w.melee) { ctx.globalAlpha = r; ctx.drawImage(w.glow ? SPR.pulse : SPR.goo, -14, -90, 28, 28); ctx.globalAlpha = 1; }
    ctx.restore();
  }
  function drawSplats() { // goo on the screen when you get hit
    for (const s of state.splats) {
      const a = clamp(1 - s.t / 3.5, 0, 1) * 0.85;
      ctx.fillStyle = `rgba(246,241,230,${a})`; ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r, s.r * 0.8, 0, 0, 7); ctx.fill();
      ctx.fillRect(s.x - 2, s.y, 4, Math.min(s.drip, s.t * 18)); ctx.beginPath(); ctx.arc(s.x, s.y + Math.min(s.drip, s.t * 18), 3, 0, 7); ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.beginPath(); ctx.arc(s.x - s.r * 0.35, s.y - s.r * 0.3, s.r * 0.2, 0, 7); ctx.fill();
    }
  }
  function txt(s, x, y, col = '#fff', size = 8, align = 'left') { ctx.font = `${size}px "Press Start 2P", monospace`; ctx.textAlign = align; ctx.textBaseline = 'top'; ctx.fillStyle = '#000'; ctx.fillText(s, x + 1, y + 1); ctx.fillStyle = col; ctx.fillText(s, x, y); ctx.textAlign = 'left'; }
  function drawHud() {
    ctx.fillStyle = '#2a1520'; ctx.fillRect(0, VIEW_H, W, H - VIEW_H); ctx.fillStyle = '#5c2e44'; ctx.fillRect(0, VIEW_H, W, 2);
    const cell = (x, w, label, val, col) => { ctx.fillStyle = '#1b0d14'; ctx.fillRect(x, VIEW_H + 4, w, H - VIEW_H - 7); txt(label, x + 3, VIEW_H + 6, '#a8949e', 6); txt(String(val), x + 3, VIEW_H + 16, col, 10); };
    cell(2, 60, 'HEALTH', state.hp + '%', state.hp > 30 ? '#ff5a7a' : '#ff2020');
    cell(64, 58, 'ARMOR', state.armor + '%', '#ffd34a');
    cell(124, 56, 'LOAD', state.ammo, '#f2ede2');
    cell(182, 70, 'SCORE', state.score, '#9fd6ff');
    cell(254, 64, 'LEVEL', state.level, '#b9f0a6');
    if (state.pill > 0) txt(`2x ${Math.ceil(state.pill)}s`, W - 4, 4, '#8fb0ff', 8, 'right');
    const cw = WEAPON(state.weapon); txt(cw.name, 4, 4, '#ff9ec4', 6);
    for (let n = 1; n <= 7; n++) { const has = WEAPONS.some(w => w.slot === n && state.owned[w.id]), cur = cw.slot === n; txt(String(n), 4 + (n - 1) * 9, 22, cur ? '#ffd34a' : has ? '#e8d8df' : '#4a3a44', 6); }
    const left = things.filter(t => t.type === 'enemy' && !t.dead).length; txt(`COCKS LEFT ${left}`, 4, 13, '#e8d8df', 6);
    if (state.levelT < 3.2 && theme) txt(`${theme.name}`, W - 4, 13, '#a8949e', 6, 'right');
    if (state.msgT > 0) txt(state.msg, W / 2, 30, '#fff', 8, 'center');
    // crosshair
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(W / 2 - 1, VIEW_H / 2 - 4, 2, 3); ctx.fillRect(W / 2 - 1, VIEW_H / 2 + 2, 2, 3); ctx.fillRect(W / 2 - 4, VIEW_H / 2 - 1, 3, 2); ctx.fillRect(W / 2 + 2, VIEW_H / 2 - 1, 3, 2);
  }

  // ---------- main loop ----------
  let last = 0, rafId = 0;
  function loop(now) {
    if (!state.on) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
    if (state.scene === 'play') update(dt);
    const sh = Math.max(0, state.shake) * 10; cv.style.transform = sh > 0.2 ? `translate(calc(-50% + ${rnd(-sh, sh).toFixed(1)}px), calc(-50% + ${rnd(-sh, sh).toFixed(1)}px))` : 'translate(-50%,-50%)';
    if (state.scene === 'flush') { state.flushT += dt; if (state.flushT > 1.6) startLevel(); }
    if (map) {
      renderWorld(); renderSprites();
      if (state.scene === 'play' || state.scene === 'paused') drawWeapon();
      drawSplats();
      if (state.flash > 0) { ctx.fillStyle = state.flashCol; ctx.fillRect(0, 0, W, VIEW_H); }
      if (state.scene === 'flush') { // swirl down the toilet
        const k = Math.min(1, state.flushT / 1.4); ctx.fillStyle = `rgba(159,214,255,${k})`; ctx.beginPath(); ctx.arc(W / 2, VIEW_H / 2, k * 220, 0, 7); ctx.fill();
        txt('FLUSHED!', W / 2, VIEW_H / 2 - 4, '#ffffff', 10, 'center');
      }
      if (state.scene === 'dead') { ctx.fillStyle = 'rgba(160,0,0,.35)'; ctx.fillRect(0, 0, W, VIEW_H); txt('YOU GOT COOMED', W / 2, VIEW_H / 2 - 4, '#fff', 10, 'center'); }
      drawHud();
    } else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
    rafId = requestAnimationFrame(loop);
  }

  let loaded = null;
  function open() {
    root.classList.add('on'); state.on = true; window.__rpgOpen = true; fit();
    if (!loaded) loaded = Promise.all([loadKinds(), document.fonts ? document.fonts.load('8px "Press Start 2P"') : null]);
    state.scene = 'title'; show('title');
    loaded.then(() => { if (!map) genLevel(1), pl.x = start.x, pl.y = start.y, setAngle(0.6); cancelAnimationFrame(rafId); last = performance.now(); rafId = requestAnimationFrame(loop); });
  }
  function close() { state.on = false; window.__rpgOpen = false; firing = false; if (document.pointerLockElement) document.exitPointerLock(); root.classList.remove('on'); cancelAnimationFrame(rafId); }
  window.Coom = { open, close, state, pl, WEAPONS, genLevel, get map() { return map; }, get MW() { return MW; }, get theme() { return theme; }, get layout() { return layout; }, get things() { return things; }, get shots() { return shots; }, showScores };
})();

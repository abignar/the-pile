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

  // ---------- level generation: rooms + corridors ----------
  const LEVEL_NAMES = ['ENTRY LEVEL', 'THE SHAFT', 'BALL PIT', 'THE TIP', 'DEEP END', 'HARD TIMES', 'THE GOOEY CORE', 'FINAL STROKE'];
  let map, MW, MH, rooms, things, shots, start, exit;
  function genLevel(level) {
    MW = MH = 34 + Math.min(16, level * 2);
    map = new Uint8Array(MW * MH).fill(1 + (level - 1) % 4);
    rooms = [];
    const tries = 80, want = 8 + Math.min(8, level);
    for (let t = 0; t < tries && rooms.length < want; t++) {
      const w = ri(4, 8), h = ri(4, 8), x = ri(1, MW - w - 2), y = ri(1, MH - h - 2);
      if (rooms.some(r => x < r.x + r.w + 1 && x + w + 1 > r.x && y < r.y + r.h + 1 && y + h + 1 > r.y)) continue;
      rooms.push({ x, y, w, h, cx: x + w / 2, cy: y + h / 2 });
    }
    const wallTex = () => 1 + ri(0, 3);
    for (const r of rooms) { const tex = wallTex(); for (let y = r.y - 1; y <= r.y + r.h; y++) for (let x = r.x - 1; x <= r.x + r.w; x++) if (map[y * MW + x]) map[y * MW + x] = tex; for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) map[y * MW + x] = 0; }
    // connect each room to the next with an L-shaped corridor
    const dig = (x, y) => { if (x > 0 && y > 0 && x < MW - 1 && y < MH - 1) map[y * MW + x] = 0; };
    for (let i = 1; i < rooms.length; i++) {
      const a = rooms[i - 1], b = rooms[i]; let x = Math.floor(a.cx), y = Math.floor(a.cy); const tx = Math.floor(b.cx), ty = Math.floor(b.cy);
      const hFirst = Math.random() < 0.5;
      const go = (axis) => { if (axis === 'x') while (x !== tx) { x += Math.sign(tx - x); dig(x, y); dig(x, y + 1); } else while (y !== ty) { y += Math.sign(ty - y); dig(x, y); dig(x + 1, y); } };
      if (hFirst) { go('x'); go('y'); } else { go('y'); go('x'); }
    }
    start = { x: rooms[0].cx, y: rooms[0].cy };
    // exit: the room furthest from the start
    let far = rooms[1] || rooms[0]; for (const r of rooms) if (Math.hypot(r.cx - start.x, r.cy - start.y) > Math.hypot(far.cx - start.x, far.cy - start.y)) far = r;
    exit = { x: far.cx, y: far.cy };
    things = [];
    things.push({ type: 'exit', x: exit.x, y: exit.y, spr: SPR.toilet, scale: 0.9 });
    // enemies in every room but the first
    const count = 6 + level * 3;
    for (let i = 0; i < count; i++) {
      const r = rooms[1 + (i % Math.max(1, rooms.length - 1))] || rooms[0]; if (r === rooms[0]) continue;
      const k = KINDS[ri(0, KINDS.length - 1)];
      const hp = Math.round(k.hp * (1 + (level - 1) * 0.18));
      things.push({ type: 'enemy', kind: k, x: rnd(r.x + 0.6, r.x + r.w - 0.6), y: rnd(r.y + 0.6, r.y + r.h - 0.6), hp, maxhp: hp, cd: rnd(0.5, 2), awake: false, hurt: 0, scale: 0.85, stuck: 0, sx: 0, sy: 0, wob: Math.random() * 6 });
    }
    // a boss every third level
    if (level % 3 === 0) { const k = pick(KINDS); const hp = 500 + level * 60; things.push({ type: 'enemy', boss: true, kind: k, x: exit.x + 1, y: exit.y, hp, maxhp: hp, cd: 1, awake: false, hurt: 0, scale: 1.6, stuck: 0, sx: 0, sy: 0, wob: 0 }); }
    // pickups
    const drop = (type, spr, n) => { for (let i = 0; i < n; i++) { const r = pick(rooms); things.push({ type, spr, x: rnd(r.x + 0.5, r.x + r.w - 0.5), y: rnd(r.y + 0.5, r.y + r.h - 0.5), scale: 0.35, pickup: true }); } };
    drop('lube', SPR.lube, ri(3, 5)); drop('jug', SPR.jug, ri(3, 5)); drop('condom', SPR.condom, ri(1, 2)); drop('pill', SPR.pill, 1);
    if (level >= 2 && !state.hasSprayer) drop('sprayer', SPR.sprayer, 1);
    shots = [];
  }
  const solid = (x, y) => { const mx = Math.floor(x), my = Math.floor(y); return mx < 0 || my < 0 || mx >= MW || my >= MH || map[my * MW + mx] > 0; };
  function lineOfSight(ax, ay, bx, by) { const d = Math.hypot(bx - ax, by - ay), n = Math.ceil(d * 4); for (let i = 1; i < n; i++) { const t = i / n; if (solid(ax + (bx - ax) * t, ay + (by - ay) * t)) return false; } return true; }
  function moveCircle(o, dx, dy, r) { // slide along walls
    if (!solid(o.x + dx + Math.sign(dx) * r, o.y) && !solid(o.x + dx + Math.sign(dx) * r, o.y + r * 0.7) && !solid(o.x + dx + Math.sign(dx) * r, o.y - r * 0.7)) o.x += dx; else dx = 0;
    if (!solid(o.x, o.y + dy + Math.sign(dy) * r) && !solid(o.x + r * 0.7, o.y + dy + Math.sign(dy) * r) && !solid(o.x - r * 0.7, o.y + dy + Math.sign(dy) * r)) o.y += dy; else dy = 0;
    return dx !== 0 || dy !== 0;
  }

  // ---------- game state ----------
  const state = { on: false, scene: 'title', level: 1, hp: 100, armor: 0, ammo: 60, score: 0, kills: 0, hasSprayer: false, weapon: 0, pill: 0, cool: 0, bob: 0, flash: 0, flashCol: '', splats: [], msg: '', msgT: 0, levelT: 0, total: 0 };
  const pl = { x: 0, y: 0, dx: 1, dy: 0, px: 0, py: FOV };
  function setAngle(a) { pl.dx = Math.cos(a); pl.dy = Math.sin(a); pl.px = -Math.sin(a) * FOV; pl.py = Math.cos(a) * FOV; pl.a = a; }
  function newGame() { Object.assign(state, { level: 1, hp: 100, armor: 0, ammo: 60, score: 0, kills: 0, hasSprayer: false, weapon: 0, pill: 0, splats: [], total: 0 }); startLevel(); }
  function startLevel() {
    genLevel(state.level); pl.x = start.x; pl.y = start.y;
    const r0 = rooms[0], toward = rooms[1] || r0; setAngle(Math.atan2(toward.cy - r0.cy, toward.cx - r0.cx));
    state.scene = 'play'; state.levelT = 0; toast(`LEVEL ${state.level}: ${LEVEL_NAMES[(state.level - 1) % LEVEL_NAMES.length]}`, 2.5);
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
  const isTouch = !matchMedia('(hover:hover) and (pointer:fine)').matches;
  if (isTouch) root.classList.add('mobile');
  root.querySelector('#coomHelp').textContent = isTouch ? 'Left thumb: move. Drag right side: turn. FIRE to squirt.' : 'Click to aim with the mouse. WASD move, arrows turn, click/space to squirt, 1/2 weapons, Esc to pause.';
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
    if (e.key === '1') state.weapon = 0; if (e.key === '2' && state.hasSprayer) state.weapon = 1;
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
  root.querySelector('.swap').addEventListener('pointerdown', e => { e.stopPropagation(); if (state.hasSprayer) { state.weapon ^= 1; toast(state.weapon ? 'THE SPRAYER' : 'THE SQUIRTER', 1); } else toast('Find the SPRAYER first', 1.2); });
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
    const spray = state.weapon === 1, cost = spray ? 2 : 1;
    if (state.ammo < cost) { toast('OUT OF LOAD! Find a jug.', 1); play('drop', 1.4); state.cool = 0.4; return; }
    state.ammo -= cost; state.cool = spray ? 0.75 : 0.28; state.recoil = 1;
    const n = spray ? 5 : 1, dmg = (spray ? 14 : 22) * (state.pill > 0 ? 2 : 1);
    for (let i = 0; i < n; i++) {
      const a = pl.a + (spray ? (i - 2) * 0.07 + rnd(-0.02, 0.02) : rnd(-0.01, 0.01));
      shots.push({ x: pl.x + Math.cos(a) * 0.35, y: pl.y + Math.sin(a) * 0.35, vx: Math.cos(a) * 13, vy: Math.sin(a) * 13, mine: true, dmg, life: 1.6 });
    }
    play('grab', 0.9);
    // the noise wakes up anything nearby that can see you
    for (const t of things) if (t.type === 'enemy' && !t.awake && Math.hypot(t.x - pl.x, t.y - pl.y) < 9) t.awake = true;
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
      if (t.type === 'jug') { state.ammo = Math.min(200, state.ammo + 20); toast('PICKED UP A LOAD! +20'); }
      if (t.type === 'condom') { if (state.armor >= 100) took = false; else { state.armor = Math.min(100, state.armor + 50); toast('PROTECTION! +50 ARMOR'); } }
      if (t.type === 'pill') { state.pill = 15; toast('BLUE PILL! DOUBLE DAMAGE'); play('moan', 1.3); }
      if (t.type === 'sprayer') { state.hasSprayer = true; state.weapon = 1; toast('THE SPRAYER! PRESS 2 / SWAP'); }
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
          t.hp -= s.dmg; t.hurt = 0.15; t.awake = true; gone = true; play('bump', 0.6, 1);
          if (t.hp <= 0) { t.dead = 0.001; state.kills++; state.score += t.boss ? 2500 : 100 + state.level * 20; things.push({ type: 'puddle', x: t.x, y: t.y, spr: SPR.puddle, scale: t.boss ? 1 : 0.6, flat: true }); play('moan', t.boss ? 0.5 : 0.7 + Math.random() * 0.6); if (t.boss) toast('BOSS DOWN!', 2); }
          break;
        }
      }
      if (!gone && !s.mine && Math.hypot(pl.x - s.x, pl.y - s.y) < 0.38) {
        gone = true; hurtPlayer(s.dmg);
        // got jizzed: goo on the screen
        for (let k = 0; k < (s.big ? 4 : 2); k++) state.splats.push({ x: rnd(30, W - 30), y: rnd(20, VIEW_H - 30), r: rnd(10, 26), t: 0, drip: rnd(10, 40) });
      }
      if (gone) shots.splice(i, 1);
    }
    things = things.filter(t => !(t.dead && t.dead > 0.6));
    state.splats = state.splats.filter(s => (s.t += dt) < 3.5);
  }
  function levelDone() {
    const bonus = 500 * state.level + Math.max(0, Math.round(300 - state.levelT * 2));
    state.score += bonus; play('throw', 1.2); play('moan', 0.9);
    toast(`FLUSHED! +${bonus}`, 2);
    state.level++; state.hp = Math.min(100, state.hp + 20);
    state.scene = 'flush'; state.flushT = 0;
  }

  // ---------- rendering ----------
  const CEIL = new Uint32Array(VIEW_H), FLOOR = new Uint32Array(VIEW_H);
  for (let y = 0; y < VIEW_H; y++) {
    const half = VIEW_H / 2, t = Math.abs(y - half) / half; // 0 at horizon, 1 at edges
    const c = (r, g, b) => (255 << 24) | (Math.round(b) << 16) | (Math.round(g) << 8) | Math.round(r);
    CEIL[y] = c(40 * t + 12, 18 * t + 6, 36 * t + 14);
    FLOOR[y] = c(110 * t + 20, 45 * t + 10, 70 * t + 18);
  }
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
      const shade = clamp(1.25 - dist / 10, 0.22, 1) * (side ? 0.78 : 1), step = TEX / lh;
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
    for (const s of shots) list.push({ o: { x: s.x, y: s.y, spr: SPR.goo, scale: s.mine ? 0.18 : (s.big ? 0.42 : 0.3), lift: 0.15 }, d: (s.x - pl.x) ** 2 + (s.y - pl.y) ** 2 });
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
  function drawWeapon() {
    const spray = state.weapon === 1, bx = W / 2 + 34 + Math.cos(state.bob) * 4, by = VIEW_H - 8 + Math.abs(Math.sin(state.bob)) * 4 + (state.recoil || 0) * 6;
    ctx.save(); ctx.translate(bx, by);
    // the squirter: a ribbed pink blaster (original design)
    ctx.fillStyle = '#7d3657'; ctx.fillRect(-8, -18, 16, 22);
    ctx.fillStyle = spray ? '#c85f8c' : '#e07fa5'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-14, -54, 28, 42, 9) : ctx.rect(-14, -54, 28, 42); ctx.fill();
    ctx.fillStyle = 'rgba(125,54,87,.6)'; for (let i = 0; i < 4; i++) ctx.fillRect(-14, -46 + i * 9, 28, 2);
    ctx.fillStyle = '#ffb3cd'; ctx.fillRect(-9, -52, 4, 36);
    if (spray) { ctx.fillStyle = '#a24b72'; ctx.fillRect(-18, -58, 10, 8); ctx.fillRect(8, -58, 10, 8); }
    ctx.fillStyle = '#ff9ec4'; ctx.beginPath(); ctx.ellipse(0, -56, 10, 6, 0, 0, 7); ctx.fill();
    if (state.recoil > 0.5) { ctx.globalAlpha = state.recoil; ctx.drawImage(SPR.goo, -14, -82, 28, 28); ctx.globalAlpha = 1; }
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
    txt(state.weapon ? 'SPRAYER' : 'SQUIRTER', 4, 4, '#ff9ec4', 6);
    const left = things.filter(t => t.type === 'enemy' && !t.dead).length; txt(`COCKS LEFT ${left}`, 4, 13, '#e8d8df', 6);
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
  window.Coom = { open, close, state, pl, get things() { return things; }, get shots() { return shots; }, showScores };
})();

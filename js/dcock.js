// =====================================================================
// DONKEY COCK — a barrel-dodging climber for cockpile.com.
// Octo Cock sits at the top hurling rolling nut sacks down the girders.
// Climb the ladders, jump the sacks, grab a plunger to smash them, and free
// the cock in the cage. Loaded on demand (see index.html).
// =====================================================================
(() => {
  const W = 256, H = 304, R = 3, TOP = 18;   // TOP: height of the score strip above the stage                 // logical size, render scale
  const GRAV = 620, JUMPV = 168, SPEED = 52, CLIMB = 34, BALL_R = 5;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sfx = () => (window.__pile && window.__pile.sfx) || null;
  const play = (n, ...a) => { try { const s = sfx(); s && s[n] && s[n](...a); } catch (e) {} };
  let actx = null;
  function beep(f, d = 0.06, type = 'square', vol = 0.04, slide = 1) { try { if (sfx() && !sfx().on) return; actx = actx || new (window.AudioContext || window.webkitAudioContext)(); const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime; o.type = type; o.frequency.setValueAtTime(f, t); if (slide !== 1) o.frequency.exponentialRampToValueAtTime(f * slide, t + d); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + d + 0.02); } catch (e) {} }

  // ---------- art ----------
  // Octo Cock is the boss here, so it can't be picked as the hero (or end up in the cage)
  const SRC = ((typeof CUTOUTS !== 'undefined' && CUTOUTS.length) ? CUTOUTS : ['favicon.svg']).filter(src => !/octo-cock/i.test(src));
  const SKINS = SRC.map(src => ({ src, name: src.split('/').pop().replace(/\.[a-z]+$/i, '').replace(/-/g, ' ').toUpperCase(), img: null }));
  const BOSS = { img: null, framed: false };      // Octo Cock: the cut-out if it exists, else the painting in a frame
  const loadImg = src => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  const loadArt = () => Promise.all([
    ...SKINS.map(async s => { s.img = await loadImg(s.src); }),
    (async () => { BOSS.img = await loadImg('images/octo-cock.webp'); if (!BOSS.img) { BOSS.img = await loadImg('images/gallery/octo-cock.webp'); BOSS.framed = true; } })(),
  ]);

  // ---------- stage: sloped girders (y = top surface) and ladders ----------
  const GIRDERS = [
    { x0: 0, y0: 276, x1: 256, y1: 268 },        // 0 bottom, sacks roll left and off screen
    { x0: 0, y0: 224, x1: 232, y1: 232 },        // 1 downhill right
    { x0: 24, y0: 190, x1: 256, y1: 182 },       // 2 downhill left
    { x0: 0, y0: 140, x1: 232, y1: 148 },        // 3 downhill right
    { x0: 24, y0: 106, x1: 256, y1: 98 },        // 4 downhill left
    { x0: 0, y0: 64, x1: 176, y1: 64 },          // 5 Octo Cock's girder (sacks start rolling right)
    { x0: 104, y0: 30, x1: 160, y1: 30 },        // 6 the cage
  ];
  const gy = (g, x) => { const G = GIRDERS[g]; return G.y0 + (G.y1 - G.y0) * (x - G.x0) / (G.x1 - G.x0); };
  const downhill = g => g === 5 ? 1 : Math.sign(GIRDERS[g].y1 - GIRDERS[g].y0) || -1;
  const LADDERS = [
    { x: 196, bot: 0, top: 1 }, { x: 70, bot: 0, top: 1, broken: true },
    { x: 46, bot: 1, top: 2 }, { x: 128, bot: 1, top: 2, broken: true },
    { x: 200, bot: 2, top: 3 }, { x: 100, bot: 2, top: 3 },
    { x: 60, bot: 3, top: 4 }, { x: 170, bot: 3, top: 4, broken: true },
    { x: 214, bot: 4, top: 5, broken: true }, { x: 150, bot: 4, top: 5 },
    { x: 144, bot: 5, top: 6 },
  ];
  const PLUNGER_SPOTS = [{ x: 150, g: 2 }, { x: 38, g: 4 }];

  // ---------- state ----------
  const G = { on: false, scene: 'title', skin: 0, captive: 1, score: 0, hi: 0, lives: 3, level: 1, bonus: 5000, bonusT: 0, t: 0, msg: '', msgT: 0, throwT: 2, windup: 0, flash: 0 };
  try { G.hi = +localStorage.getItem('dcock-hi') || 0; } catch (e) {}
  let P, balls = [], plungers = [], fx = [];
  function resetStage() {
    P = { x: 24, y: gy(0, 24), vx: 0, vy: 0, mode: 'walk', g: 0, face: 1, ladder: null, fromY: 0, hold: 0, dead: 0, t: 0 };
    balls = []; fx = []; plungers = PLUNGER_SPOTS.map(p => ({ ...p, taken: false }));
    G.bonus = Math.min(8000, 4000 + G.level * 1000); G.bonusT = 0; G.throwT = 1.6; G.windup = 0;
  }
  const throwEvery = () => Math.max(1.0, 2.7 - G.level * 0.28);
  const ballSpeed = () => 46 + G.level * 6;
  function toast(m, t = 1.6) { G.msg = m; G.msgT = t; }
  function addScore(n, x, y) { G.score += n; fx.push({ k: 'pts', x, y, text: String(n), t: 0 }); }

  // ---------- DOM ----------
  const css = `
  #dkc{position:fixed;inset:0;z-index:20;display:none;background:#0b0508;touch-action:none;user-select:none;-webkit-user-select:none;font-family:"Press Start 2P",monospace}
  #dkc.on{display:block}
  #dkc canvas{position:absolute !important;inset:auto !important;left:50% !important;top:8px !important;transform:translateX(-50%);z-index:auto !important;image-rendering:pixelated;cursor:default}
  #dkc .x{position:absolute;top:calc(8px + env(safe-area-inset-top));right:8px;z-index:5;width:36px;height:36px;border-radius:50%;background:#fff;border:2px solid #3a1f2b;font:700 17px system-ui;cursor:pointer}
  #dkc .ctl{position:absolute;left:0;right:0;bottom:0;z-index:3;display:none;justify-content:space-between;align-items:center;padding:0 18px calc(14px + env(safe-area-inset-bottom))}
  #dkc.touch.playing .ctl{display:flex}
  #dkc.touch.playing .x{top:auto;bottom:calc(126px + env(safe-area-inset-bottom));right:20px}
  #dkc .dpad{display:grid;grid-template-columns:repeat(3,52px);grid-template-rows:repeat(3,44px);gap:4px}
  #dkc .ctl button{font:16px system-ui;color:#fff;background:rgba(255,255,255,.1);border:2px solid rgba(255,255,255,.35);border-radius:12px;touch-action:none;padding:0}
  #dkc .ctl button.on{background:rgba(255,90,122,.55)}
  #dkc .jump{width:96px;height:96px;border-radius:50% !important;font:12px "Press Start 2P",monospace !important;background:rgba(216,27,96,.55) !important}
  #dkc .panel{position:absolute;inset:0;z-index:4;display:none;align-items:center;justify-content:center;background:rgba(11,5,8,.88);color:#fff;text-align:center;padding:14px}
  #dkc .panel.on{display:flex}
  #dkc h1{font:400 clamp(34px,10vw,64px) "Bagel Fat One",system-ui;color:#ff5a7a;text-shadow:0 4px 0 #7d0f3a,0 8px 0 #2a1520;margin:0 0 4px;line-height:1}
  #dkc h2{font-size:clamp(11px,3vw,15px);color:#ffd34a;margin:10px 0}
  #dkc p{font-size:9px;line-height:1.9;color:#e8d8df;margin:6px auto;max-width:440px}
  #dkc .btn{font:11px "Press Start 2P",monospace;color:#fff;background:#d81b60;border:none;border-radius:8px;padding:12px 16px;margin:6px;cursor:pointer;box-shadow:0 4px 0 #7d0f3a}
  #dkc .btn.alt{background:#4a4150;box-shadow:0 4px 0 #2a2430}
  #dkc .pick{display:flex;align-items:center;justify-content:center;gap:14px;margin:6px 0}
  #dkc .pick img{width:90px;height:90px;object-fit:contain}
  #dkc .pick button{font:16px system-ui;width:40px;height:40px;border-radius:50%;border:2px solid #fff;background:transparent;color:#fff;cursor:pointer}
  `;
  const root = document.createElement('div'); root.id = 'dkc';
  root.innerHTML = `<style>${css}</style><canvas width="${W * R}" height="${H * R}"></canvas><button class="x" aria-label="Close">✕</button>
    <div class="ctl"><div class="dpad"><span></span><button data-h="up" aria-label="Climb up">▲</button><span></span><button data-h="left" aria-label="Left">◀</button><span></span><button data-h="right" aria-label="Right">▶</button><span></span><button data-h="down" aria-label="Climb down">▼</button><span></span></div>
      <button class="jump" data-p="jump">JUMP</button></div>
    <div class="panel on" id="dkcTitle"><div><h1>DONKEY<br>COCK</h1><h2>OCTO COCK HAS TAKEN A HOSTAGE</h2>
      <p>Climb to the top and free the cock in the cage. Jump the rolling nut sacks, grab a plunger to smash them, and don't fall too far.</p>
      <div class="pick"><button data-act="prev" aria-label="Previous">◀</button><div><img id="dkcSkin" alt=""><p id="dkcSkinName"></p></div><button data-act="next" aria-label="Next">▶</button></div>
      <p id="dkcKeys"></p><p id="dkcHi"></p><button class="btn" data-act="start">START</button></div></div>
    <div class="panel" id="dkcOver"><div><h1>GAME<br>OVER</h1><h2 id="dkcScore"></h2><p id="dkcBest"></p><button class="btn" data-act="start">PLAY AGAIN</button><button class="btn alt" data-act="close">CLOSE</button></div></div>`;
  document.body.appendChild(root);
  const cv = root.querySelector('canvas'), ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = true;
  const isTouch = !matchMedia('(hover:hover) and (pointer:fine)').matches; if (isTouch) root.classList.add('touch');
  root.querySelector('#dkcKeys').textContent = isTouch ? 'D-pad to walk and climb, JUMP to jump.' : 'Arrows or WASD to walk and climb · Space to jump';
  function fit() {
    const ctlH = isTouch ? 170 : 0, s = Math.min((innerWidth - 8) / W, (innerHeight - 16 - ctlH) / H);
    cv.style.width = Math.floor(W * s) + 'px'; cv.style.height = Math.floor(H * s) + 'px';
    cv.style.setProperty('top', (isTouch ? 8 : Math.max(8, (innerHeight - H * s) / 2)) + 'px', 'important');
  }
  addEventListener('resize', fit);
  const panels = { title: root.querySelector('#dkcTitle'), over: root.querySelector('#dkcOver') };
  function show(p) { for (const k in panels) panels[k].classList.toggle('on', k === p); root.classList.toggle('playing', !p); }
  function updatePick() { const s = SKINS[G.skin]; root.querySelector('#dkcSkin').src = s.src; root.querySelector('#dkcSkinName').textContent = s.name; root.querySelector('#dkcHi').textContent = G.hi ? `HIGH SCORE ${G.hi}` : ''; }

  // ---------- input ----------
  const held = { left: 0, right: 0, up: 0, down: 0 }; const pressed = new Set();
  root.querySelectorAll('[data-h]').forEach(b => { const k = b.dataset.h; b.addEventListener('pointerdown', e => { e.preventDefault(); held[k] = 1; b.classList.add('on'); }); ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => b.addEventListener(t, () => { held[k] = 0; b.classList.remove('on'); })); });
  root.querySelectorAll('[data-p]').forEach(b => { b.addEventListener('pointerdown', e => { e.preventDefault(); pressed.add(b.dataset.p); b.classList.add('on'); }); ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => b.addEventListener(t, () => b.classList.remove('on'))); });
  const KEYS = { arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right', arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down' };
  addEventListener('keydown', e => {
    if (!G.on) return; const k = e.key.toLowerCase();
    if (k === 'escape') return close();
    if (KEYS[k]) { held[KEYS[k]] = 1; e.preventDefault(); }
    if (k === ' ' || k === 'x' || k === 'z') { if (!e.repeat) pressed.add('jump'); e.preventDefault(); }
    if (k === 'enter' && G.scene !== 'play') { const b = root.querySelector('.panel.on .btn'); if (b) b.click(); }
  });
  addEventListener('keyup', e => { const k = e.key.toLowerCase(); if (KEYS[k]) held[KEYS[k]] = 0; });
  root.querySelector('.x').onclick = () => close();
  root.addEventListener('click', e => {
    const a = e.target.dataset && e.target.dataset.act; if (!a) return;
    if (a === 'prev') { G.skin = (G.skin - 1 + SKINS.length) % SKINS.length; updatePick(); }
    if (a === 'next') { G.skin = (G.skin + 1) % SKINS.length; updatePick(); }
    if (a === 'start') startGame();
    if (a === 'close') close();
  });
  function startGame() {
    G.score = 0; G.lives = 3; G.level = 1; pickCaptive(); resetStage(); G.scene = 'play'; show(null); toast('CLIMB!', 1.2); beep(523, 0.08); setTimeout(() => beep(784, 0.12), 90);
  }
  function pickCaptive() { do { G.captive = Math.floor(Math.random() * SKINS.length); } while (SKINS.length > 1 && G.captive === G.skin); }

  // ---------- gameplay ----------
  const ladderAt = (x, cond) => LADDERS.find(l => Math.abs(l.x - x) < 5 && cond(l));
  function die(why) {
    if (P.mode === 'dead') return;
    P.mode = 'dead'; P.dead = 0; play('moan', 0.55); beep(300, 0.6, 'sawtooth', 0.05, 0.25); toast(why || 'OUCH!', 1.6);
  }
  function update(dt) {
    G.t += dt; if (G.msgT > 0) G.msgT -= dt; if (G.flash > 0) G.flash -= dt;
    if (P.mode === 'dead') {
      P.dead += dt;
      if (P.dead > 1.8) { G.lives--; if (G.lives <= 0) return gameOver(); resetStage(); toast(`${G.lives} LI${G.lives === 1 ? 'FE' : 'VES'} LEFT`, 1.4); }
      updateBalls(dt, true); pressed.clear(); return;
    }
    if (G.scene === 'win') { G.winT -= dt; if (G.winT <= 0) { G.level++; pickCaptive(); resetStage(); G.scene = 'play'; toast(`LEVEL ${G.level}`, 1.4); } pressed.clear(); return; }
    // bonus timer
    G.bonusT += dt; if (G.bonusT >= 2) { G.bonusT = 0; G.bonus = Math.max(0, G.bonus - 100); if (G.bonus === 0) die('OUT OF TIME!'); }
    // player
    P.t += dt; if (P.hold > 0) { P.hold -= dt; if (P.hold <= 0) toast('PLUNGER GONE', 1); }
    const dir = (held.right ? 1 : 0) - (held.left ? 1 : 0);
    if (P.mode === 'walk') {
      if (dir) P.face = dir;
      let up = null, down = null;
      if (P.hold <= 0 && held.up) up = ladderAt(P.x, l => l.bot === P.g && !l.broken);
      if (P.hold <= 0 && held.down) down = ladderAt(P.x, l => l.top === P.g && !l.broken);
      if (up) { P.mode = 'climb'; P.ladder = up; P.x = up.x; }
      else if (down) { P.mode = 'climb'; P.ladder = down; P.x = down.x; P.y += 2; }
      else if (pressed.has('jump') && P.hold <= 0) { P.mode = 'air'; P.vy = -JUMPV; P.vx = dir * SPEED; P.fromY = P.y; beep(330, 0.1, 'square', 0.035, 1.8); }
      else {
        P.x = clamp(P.x + dir * SPEED * dt, 4, W - 4);
        const Gd = GIRDERS[P.g];
        if (P.x < Gd.x0 || P.x > Gd.x1) { P.mode = 'air'; P.vy = 0; P.vx = dir * SPEED * 0.6; P.fromY = P.y; }
        else P.y = gy(P.g, P.x);
      }
    } else if (P.mode === 'climb') {
      const L = P.ladder, top = gy(L.top, L.x), bot = gy(L.bot, L.x), v = (held.down ? 1 : 0) - (held.up ? 1 : 0);
      P.y = clamp(P.y + v * CLIMB * dt, top, bot); if (v) P.t += dt * 2;
      if (P.y <= top && held.up) { P.mode = 'walk'; P.g = L.top; P.y = top; if (L.top === 6) return rescued(); }
      if (P.y >= bot && held.down) { P.mode = 'walk'; P.g = L.bot; P.y = bot; }
    } else if (P.mode === 'air') {
      const prevY = P.y; P.vy += GRAV * dt; P.x = clamp(P.x + P.vx * dt, 4, W - 4); P.y += P.vy * dt;
      if (P.vy > 0) for (let g = 0; g < GIRDERS.length; g++) {
        const Gd = GIRDERS[g]; if (P.x < Gd.x0 || P.x > Gd.x1) continue;
        const s = gy(g, P.x);
        if (prevY <= s + 1 && P.y >= s) {
          P.y = s; P.g = g; P.mode = 'walk';
          if (s - P.fromY > 24) die('SPLAT! TOO FAR'); else beep(140, 0.05, 'square', 0.03);
          break;
        }
      }
      if (P.y > H) die('FELL OFF');
    }
    // plungers
    for (const p of plungers) if (!p.taken && Math.abs(p.x - P.x) < 8 && Math.abs(gy(p.g, p.x) - 8 - (P.y - 10)) < 12) { p.taken = true; P.hold = 9; toast('PLUNGER! SMASH EM', 1.4); play('goo'); beep(660, 0.08); setTimeout(() => beep(880, 0.1), 80); }
    // Octo Cock throws
    if (G.windup > 0) { G.windup -= dt; if (G.windup <= 0) { balls.push({ x: 52, y: gy(5, 52) - BALL_R, g: 5, mode: 'roll', vx: 0, vy: 0, rot: 0, jumped: false }); play('throw', 0.6); } }
    else { G.throwT -= dt; if (G.throwT <= 0) { G.throwT = throwEvery() * (0.75 + Math.random() * 0.5); G.windup = 0.5; } }
    updateBalls(dt, false);
    fx = fx.filter(f => (f.t += dt) < 0.9);
    pressed.clear();
  }
  function updateBalls(dt, frozen) {
    const sp = ballSpeed();
    for (const b of balls) {
      if (frozen) continue;
      const px = b.x;
      if (b.mode === 'roll') {
        const d = downhill(b.g); b.x += d * sp * dt; b.rot += d * sp * dt / BALL_R; const Gd = GIRDERS[b.g];
        // maybe drop down a ladder (more likely when you're below it)
        for (const L of LADDERS) if (L.top === b.g && L.bot === b.g - 1 && (px - L.x) * (b.x - L.x) <= 0 && !b.skip) {
          const chance = 0.18 + Math.min(0.25, G.level * 0.04) + (P.g < b.g && Math.abs(P.x - L.x) < 50 ? 0.25 : 0);
          if (Math.random() < chance) { b.mode = 'ladder'; b.x = L.x; b.lad = L; break; }
        }
        if (b.mode === 'roll') {
          if (b.x < Gd.x0 - 2 || b.x > Gd.x1 + 2) { if (b.g === 0) { b.gone = true; continue; } b.mode = 'fall'; b.vx = d * sp * 0.6; b.vy = 0; }
          else b.y = gy(b.g, b.x) - BALL_R;
        }
      } else if (b.mode === 'ladder') {
        b.y += 70 * dt; const target = gy(b.lad.bot, b.x) - BALL_R;
        if (b.y >= target) { b.y = target; b.g = b.lad.bot; b.mode = 'roll'; b.skip = true; setTimeout(() => { b.skip = false; }, 400); }
      } else if (b.mode === 'fall') {
        b.vy += GRAV * dt; b.x += b.vx * dt; b.y += b.vy * dt; const g = b.g - 1, Gd = GIRDERS[g];
        if (g >= 0 && b.x >= Gd.x0 && b.x <= Gd.x1 && b.y + BALL_R >= gy(g, b.x)) { b.g = g; b.mode = 'roll'; b.y = gy(g, b.x) - BALL_R; play('bump', 0.5, 0.8); }
        if (b.y > H) b.gone = true;
      }
      if (b.x < -12 || b.x > W + 12) b.gone = true;
      // hit or jumped?
      if (P.mode !== 'dead' && G.scene === 'play') {
        const dx = b.x - P.x, dy = b.y - (P.y - 9);
        if (P.hold > 0 && Math.abs(dx) < 14 && Math.abs(dy) < 16) { b.gone = true; addScore(300, b.x, b.y - 8); fx.push({ k: 'pop', x: b.x, y: b.y, t: 0 }); play('goo'); beep(900, 0.08, 'square', 0.05, 0.4); }
        else if (Math.abs(dx) < 8 && Math.abs(dy) < 11) die('NUTTED!');
        else if (P.mode === 'air' && !b.jumped && Math.abs(dx) < 7 && b.y > P.y && b.y - P.y < 28) { b.jumped = true; addScore(100, P.x, P.y - 24); beep(1046, 0.05); }
      }
    }
    balls = balls.filter(b => !b.gone);
  }
  function rescued() {
    G.scene = 'win'; G.winT = 2.6; addScore(G.bonus, P.x, P.y - 24); G.flash = 2.6; balls = [];
    play('moan', 1.2); [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.12, 'triangle', 0.05), i * 110));
    toast('RESCUED! MY HERO!', 2.4);
  }
  function gameOver() {
    G.scene = 'over'; if (G.score > G.hi) { G.hi = G.score; try { localStorage.setItem('dcock-hi', String(G.hi)); } catch (e) {} }
    root.querySelector('#dkcScore').textContent = `SCORE ${G.score}`; root.querySelector('#dkcBest').textContent = `LEVEL ${G.level} · HIGH SCORE ${G.hi}`;
    show('over'); window.CockStickers && window.CockStickers.gameOver();
  }

  // ---------- drawing ----------
  function txt(s, x, y, col = '#fff', size = 8, align = 'left') { ctx.font = `${size}px "Press Start 2P", monospace`; ctx.textAlign = align; ctx.textBaseline = 'top'; ctx.fillStyle = col; ctx.fillText(s, x, y); ctx.textAlign = 'left'; }
  function drawGirder(Gd) {
    const T = 7, len = Gd.x1 - Gd.x0;
    ctx.fillStyle = '#d81b60'; ctx.beginPath(); ctx.moveTo(Gd.x0, Gd.y0); ctx.lineTo(Gd.x1, Gd.y1); ctx.lineTo(Gd.x1, Gd.y1 + T); ctx.lineTo(Gd.x0, Gd.y0 + T); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#7d0f3a'; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = 0; x < len; x += 8) { const a = Gd.x0 + x, b = Math.min(Gd.x1, a + 4), c = Math.min(Gd.x1, a + 8); const ya = Gd.y0 + (Gd.y1 - Gd.y0) * x / len, yb = Gd.y0 + (Gd.y1 - Gd.y0) * (b - Gd.x0) / len, yc = Gd.y0 + (Gd.y1 - Gd.y0) * (c - Gd.x0) / len; ctx.moveTo(a, ya + 1); ctx.lineTo(b, yb + T - 1); ctx.lineTo(c, yc + 1); }
    ctx.stroke(); ctx.strokeStyle = '#ff9ab3'; ctx.beginPath(); ctx.moveTo(Gd.x0, Gd.y0 + 0.5); ctx.lineTo(Gd.x1, Gd.y1 + 0.5); ctx.stroke();
  }
  function drawLadder(L) {
    const top = gy(L.top, L.x) + 7, bot = gy(L.bot, L.x), x0 = L.x - 5, x1 = L.x + 5;
    ctx.strokeStyle = '#7fe3ff'; ctx.lineWidth = 1.5;
    const gapA = top + (bot - top) * 0.35, gapB = top + (bot - top) * 0.62;
    ctx.beginPath();
    if (L.broken) { ctx.moveTo(x0, top); ctx.lineTo(x0, gapA); ctx.moveTo(x1, top); ctx.lineTo(x1, gapA); ctx.moveTo(x0, gapB); ctx.lineTo(x0, bot); ctx.moveTo(x1, gapB); ctx.lineTo(x1, bot); }
    else { ctx.moveTo(x0, top); ctx.lineTo(x0, bot); ctx.moveTo(x1, top); ctx.lineTo(x1, bot); }
    for (let y = top + 3; y < bot; y += 5) if (!L.broken || y < gapA || y > gapB) { ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
    ctx.stroke();
  }
  function drawSack(x, y, rot, r = BALL_R) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    const g = ctx.createRadialGradient(-r * 0.4, -r * 0.4, 0, 0, 0, r * 1.2); g.addColorStop(0, '#f6c3b5'); g.addColorStop(1, '#b8655a');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, r * 1.1, r, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#7a3a35'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(0, -r); ctx.quadraticCurveTo(r * 0.3, 0, 0, r); ctx.stroke();
    ctx.strokeStyle = 'rgba(60,25,20,.7)'; ctx.lineWidth = 0.5;
    for (let k = 0; k < 7; k++) { const a = k * 0.9; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); ctx.lineTo(Math.cos(a) * (r + 1.8), Math.sin(a) * (r + 1.8)); ctx.stroke(); }
    ctx.restore();
  }
  function drawSprite(im, x, y, h, face = 1, opts = {}) {
    if (!im) return; const k = h / im.height, w = im.width * k;
    ctx.save(); ctx.translate(x, y); ctx.scale(face < 0 ? -1 : 1, 1); ctx.rotate(opts.lean || 0);
    if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha; ctx.drawImage(im, -w / 2, -h, w, h); ctx.restore();
  }
  function drawBoss() {
    const x = 30, y = 64, throwing = G.windup > 0, bob = Math.sin(G.t * (throwing ? 18 : 3)) * (throwing ? 1.5 : 1);
    const im = BOSS.img;
    if (im) {
      if (BOSS.framed) { // painting in a frame until the cut-out exists
        const s = 46; ctx.save(); ctx.translate(x, y - s / 2 - 2 + bob); ctx.rotate(throwing ? Math.sin(G.t * 20) * 0.08 : 0);
        ctx.fillStyle = '#2a1520'; ctx.fillRect(-s / 2 - 3, -s / 2 - 3, s + 6, s + 6); ctx.fillStyle = '#ffd34a'; ctx.fillRect(-s / 2 - 1.5, -s / 2 - 1.5, s + 3, s + 3);
        ctx.drawImage(im, -s / 2, -s / 2, s, s); ctx.restore();
      } else drawSprite(im, x, y + bob * 0.5, throwing ? 52 : 50, 1, { lean: throwing ? Math.sin(G.t * 20) * 0.1 : 0 });
    }
    // the sack pile beside the boss, and the one being thrown
    for (const [sx, sy] of [[6, 58], [14, 58], [10, 50]]) drawSack(sx, sy, 0, 4.5);
    if (throwing) drawSack(x + 6, y - 50 - (0.5 - G.windup) * 10, G.t * 8, 5.5);
    ctx.font = '5px "Press Start 2P", monospace'; ctx.fillStyle = '#ffd34a'; ctx.textAlign = 'center'; ctx.fillText('OCTO COCK', x, y + 10); ctx.textAlign = 'left';
  }
  function drawCage() {
    const s = SKINS[G.captive], cx = 132, base = 30;
    drawSprite(s && s.img, cx, base, 22, -1, { lean: Math.sin(G.t * 3) * 0.08 });
    ctx.strokeStyle = '#c9c9d1'; ctx.lineWidth = 1.2; ctx.beginPath();
    for (let x = cx - 14; x <= cx + 14; x += 4) { ctx.moveTo(x, base - 28); ctx.lineTo(x, base); }
    ctx.moveTo(cx - 15, base - 28); ctx.lineTo(cx + 15, base - 28); ctx.stroke();
    if (G.scene !== 'win' && Math.sin(G.t * 4) > -0.2) { ctx.fillStyle = '#fff'; ctx.fillRect(cx + 16, base - 38, 30, 11); ctx.fillStyle = '#2a1520'; ctx.font = '6px "Press Start 2P", monospace'; ctx.fillText('HELP!', cx + 18, base - 36); }
  }
  function drawPlunger(x, y, ang) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.fillStyle = '#c98a4b'; ctx.fillRect(-1, -12, 2, 12); ctx.fillStyle = '#d6223e'; ctx.beginPath(); ctx.moveTo(-5, -12); ctx.quadraticCurveTo(0, -19, 5, -12); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  function draw() {
    ctx.setTransform(R, 0, 0, R, 0, 0);
    ctx.fillStyle = '#0b0508'; ctx.fillRect(0, 0, W, H);
    if (G.flash > 0 && Math.sin(G.t * 30) > 0) { ctx.fillStyle = 'rgba(255,90,122,.15)'; ctx.fillRect(0, 0, W, H); }
    ctx.setTransform(R, 0, 0, R, 0, TOP * R);
    for (const L of LADDERS) drawLadder(L);
    for (const Gd of GIRDERS) drawGirder(Gd);
    for (const p of plungers) if (!p.taken) drawPlunger(p.x, gy(p.g, p.x), Math.sin(G.t * 3) * 0.2);
    drawCage(); drawBoss();
    for (const b of balls) drawSack(b.x, b.y, b.rot);
    // player
    const s = SKINS[G.skin];
    if (P.mode === 'dead') { drawSprite(s.img, P.x, P.y, 22, P.face, { lean: Math.min(1.5, P.dead * 3) * P.face, alpha: Math.max(0, 1 - P.dead / 1.8) }); }
    else {
      const moving = P.mode === 'walk' && (held.left || held.right), climbing = P.mode === 'climb';
      drawSprite(s.img, P.x, P.y, 22, climbing ? (Math.sin(P.t * 8) > 0 ? 1 : -1) : P.face, { lean: moving ? Math.sin(P.t * 18) * 0.12 : P.mode === 'air' ? -0.2 * P.face : 0 });
      if (P.hold > 0 && (P.hold > 2 || Math.sin(G.t * 20) > 0)) drawPlunger(P.x + P.face * 9, P.y - 10, P.face * (0.4 + Math.sin(G.t * 14) * 0.9));
    }
    for (const f of fx) {
      if (f.k === 'pts') txt(f.text, f.x, f.y - f.t * 14, '#ffd34a', 5, 'center');
      if (f.k === 'pop') { ctx.fillStyle = `rgba(255,248,230,${1 - f.t / 0.9})`; for (let k = 0; k < 8; k++) { const a = k * 0.785, d = f.t * 30; ctx.beginPath(); ctx.arc(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, 1.6, 0, 7); ctx.fill(); } }
    }
    if (G.msgT > 0) txt(G.msg, W / 2, 248, '#fff', 7, 'center');
    // HUD strip
    ctx.setTransform(R, 0, 0, R, 0, 0);
    ctx.fillStyle = '#1a0b12'; ctx.fillRect(0, 0, W, TOP);
    txt(`SCORE ${G.score}`, 4, 3, '#fff', 6); txt(`HI ${Math.max(G.hi, G.score)}`, 4, 11, '#ff9ab3', 5);
    txt(`L${G.level}`, 112, 6, '#ffd34a', 6, 'center');
    for (let i = 0; i < G.lives - (P.mode === 'dead' ? 1 : 0); i++) drawSprite(s.img, 136 + i * 10, 16, 12, 1);
    ctx.strokeStyle = '#7fe3ff'; ctx.lineWidth = 1; ctx.strokeRect(198.5, 1.5, 55, 15); txt('BONUS', 226, 3, '#7fe3ff', 4, 'center'); txt(String(G.bonus), 226, 9, G.bonus <= 1000 ? '#ff6b6b' : '#fff', 5, 'center');
  }

  // ---------- loop ----------
  let last = 0, raf = 0;
  function loop(now) {
    if (!G.on) return;
    const dt = Math.min(0.033, (now - last) / 1000 || 0.016); last = now;
    if (G.scene === 'play' || G.scene === 'win') update(dt);
    if (P) draw();
    raf = requestAnimationFrame(loop);
  }
  let loaded = null;
  function open() {
    root.classList.add('on'); G.on = true; window.__rpgOpen = true; fit();
    show('title'); G.scene = 'title';
    if (!loaded) loaded = Promise.all([loadArt(), document.fonts ? document.fonts.load('8px "Press Start 2P"') : null]);
    loaded.then(() => { updatePick(); if (!P) { pickCaptive(); resetStage(); } cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(loop); });
  }
  function close() { G.on = false; window.__rpgOpen = false; root.classList.remove('on'); cancelAnimationFrame(raf); for (const k in held) held[k] = 0; }
  window.DonkeyCock = { open, close, G, get P() { return P; }, get balls() { return balls; }, GIRDERS, LADDERS, gy, press: k => pressed.add(k), held, startGame, BOSS };
})();

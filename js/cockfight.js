// =====================================================================
// COCKFIGHT — a one-on-one arcade fighter for cockpile.com.
// Pick a cock from the pile and fight your way up the ladder.
// Moves: SLAP (fast), THRUST (strong, long), JIZZ BALL (projectile),
// SUPER (Helicopter spin, when the meter is full). Hold away to block.
// Loaded on demand (see index.html).
// =====================================================================
(() => {
  const W = 384, H = 216, R = 3, FLOOR = 188;
  const GRAV = 1100, JUMPV = 400, WALK = 92;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const sfx = () => (window.__pile && window.__pile.sfx) || null;
  const play = (n, ...a) => { try { const s = sfx(); s && s[n] && s[n](...a); } catch (e) {} };
  let actx = null;
  function beep(f, d = 0.06, type = 'square', vol = 0.04, slide = 1) { try { if (sfx() && !sfx().on) return; actx = actx || new (window.AudioContext || window.webkitAudioContext)(); const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime; o.type = type; o.frequency.setValueAtTime(f, t); if (slide !== 1) o.frequency.exponentialRampToValueAtTime(f * slide, t + d); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + d + 0.02); } catch (e) {} }

  // ---------- roster: the site's cut-outs, each with balanced stats ----------
  const SRC = (typeof CUTOUTS !== 'undefined' && CUTOUTS.length) ? CUTOUTS : ['favicon.svg'];
  const hash = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967295; };
  const ROSTER = SRC.map(src => {
    const name = src.split('/').pop().replace(/\.[a-z]+$/i, '').replace(/-/g, ' ').toUpperCase();
    const a = hash(name + 'p'), b = hash(name + 's'), c = hash(name + 'h'), sum = a + b + c || 1;
    const k = v => 0.82 + 0.54 * (v / sum);       // the three stats always add up to the same total
    return { src, name, img: null, power: k(a), speed: k(b), tough: k(c) };
  });
  const loadImg = src => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  let backdrop = null;
  const loadArt = () => Promise.all([...ROSTER.map(async r => { r.img = await loadImg(r.src); }), (async () => { backdrop = await loadImg('images/gallery/cock-fight.webp'); })()]);

  const MOVES = {
    slap:   { start: 0.06, active: 0.08, recover: 0.16, range: 46, dmg: 6,  kb: 70,  stun: 0.26, meter: 8 },
    thrust: { start: 0.16, active: 0.10, recover: 0.30, range: 66, dmg: 12, kb: 190, stun: 0.42, meter: 12 },
    jizz:   { start: 0.20, active: 0.00, recover: 0.30, cool: 1.3, dmg: 10, kb: 120, stun: 0.34, meter: 10 },
    spin:   { start: 0.12, active: 1.00, recover: 0.30, range: 58, dmg: 4,  kb: 40,  stun: 0.18, hits: 7 },
  };

  // ---------- state ----------
  const G = { on: false, scene: 'title', pick: 0, ladder: [], stage: 0, wins: 0, best: 0, round: 1, timer: 60, t: 0, banner: '', bannerT: 0, shake: 0, slow: 0, fx: [], shots: [] };
  try { G.best = +localStorage.getItem('cockfight-best') || 0; } catch (e) {}
  let P1, P2;
  function fighter(ri, x, face, cpu) {
    const r = ROSTER[ri];
    return { ri, r, x, y: FLOOR, vx: 0, vy: 0, face, cpu, hp: 100, maxHp: Math.round(100 * r.tough), meter: 0, roundsWon: 0,
      state: 'idle', st: 0, atk: null, stun: 0, block: false, crouch: false, cool: 0, combo: 0, comboT: 0, hitFlash: 0, t: Math.random() * 6, ai: { next: 0, want: null } };
  }
  function resetRound() {
    for (const [f, x, face] of [[P1, 110, 1], [P2, 274, -1]]) { f.x = x; f.y = FLOOR; f.vx = f.vy = 0; f.face = face; f.hp = f.maxHp; f.state = 'idle'; f.atk = null; f.stun = 0; f.cool = 0; f.combo = 0; f.hitFlash = 0; }
    G.shots = []; G.fx = []; G.timer = 60; G.scene = 'intro'; G.introT = 1.9; banner(`ROUND ${G.round}`, 1.0);
    setTimeout(() => { if (G.scene === 'intro') { banner('FIGHT!', 0.8); beep(392, 0.1); setTimeout(() => beep(784, 0.2), 100); } }, 1000);
  }
  function banner(text, t) { G.banner = text; G.bannerT = t; }

  // ---------- DOM ----------
  const css = `
  #cfx{position:fixed;inset:0;z-index:20;display:none;background:#0b0508;touch-action:none;user-select:none;-webkit-user-select:none;font-family:"Press Start 2P",monospace}
  #cfx.on{display:block}
  #cfx canvas{position:absolute !important;inset:auto !important;left:50% !important;top:50% !important;transform:translate(-50%,-50%);z-index:auto !important;cursor:default}
  #cfx.touch canvas{top:8px !important;transform:translateX(-50%)}
  #cfx.touch.side canvas{top:50% !important;transform:translate(-50%,-50%)}
  #cfx.side .ctl button{background:rgba(255,255,255,.07);opacity:.75}
  #cfx.side .ctl{padding-bottom:calc(6px + env(safe-area-inset-bottom))}
  #cfx.touch.side.playing .x{bottom:auto;top:8px;left:auto;right:8px;transform:none}
  #cfx .x{position:absolute;top:calc(8px + env(safe-area-inset-top));right:8px;z-index:6;width:36px;height:36px;border-radius:50%;background:#fff;border:2px solid #3a1f2b;font:700 17px system-ui;cursor:pointer}
  #cfx .ctl{position:absolute;left:0;right:0;bottom:0;z-index:3;display:none;justify-content:space-between;align-items:center;padding:0 14px calc(14px + env(safe-area-inset-bottom))}
  #cfx.touch.playing .ctl{display:flex}
  #cfx .dpad{display:grid;grid-template-columns:repeat(3,50px);grid-template-rows:repeat(3,44px);gap:4px}
  #cfx .acts{display:grid;grid-template-columns:repeat(2,74px);gap:8px}
  #cfx .ctl button{font:9px "Press Start 2P",monospace;color:#fff;background:rgba(255,255,255,.1);border:2px solid rgba(255,255,255,.35);border-radius:12px;touch-action:none;padding:0;height:56px}
  #cfx .dpad button{font:16px system-ui;height:auto}
  #cfx .ctl button.on{background:rgba(255,90,122,.6)}
  #cfx .acts .sp{background:rgba(255,211,74,.25);border-color:rgba(255,211,74,.6)}
  #cfx.touch.playing .x{top:auto;bottom:calc(150px + env(safe-area-inset-bottom));right:auto;left:50%;transform:translateX(-50%)}
  #cfx .panel{position:absolute;inset:0;z-index:4;display:none;align-items:center;justify-content:center;background:rgba(11,5,8,.9);color:#fff;text-align:center;padding:14px;overflow:auto}
  #cfx .panel.on{display:flex}
  #cfx h1{font:400 clamp(40px,11vw,80px) "Bagel Fat One",system-ui;color:#ff5a7a;text-shadow:0 4px 0 #7d0f3a,0 8px 0 #2a1520;margin:0;line-height:1}
  #cfx h2{font-size:clamp(10px,2.6vw,14px);color:#ffd34a;margin:10px 0}
  #cfx p{font-size:9px;line-height:1.9;color:#e8d8df;margin:6px auto;max-width:520px}
  #cfx .btn{font:11px "Press Start 2P",monospace;color:#fff;background:#d81b60;border:none;border-radius:8px;padding:12px 16px;margin:6px;cursor:pointer;box-shadow:0 4px 0 #7d0f3a}
  #cfx .btn.alt{background:#4a4150;box-shadow:0 4px 0 #2a2430}
  #cfx .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(74px,1fr));gap:8px;max-width:560px;margin:8px auto}
  #cfx .grid button{background:#1e0f16;border:3px solid #3a1f2b;border-radius:10px;padding:4px;cursor:pointer;aspect-ratio:1}
  #cfx .grid button.sel{border-color:#ffd34a;background:#3a1f2b}
  #cfx .grid img{width:100%;height:100%;object-fit:contain}
  #cfx .stats{font-size:8px;line-height:2;color:#fff;margin:6px auto;max-width:300px;text-align:left}
  #cfx .bar{display:inline-block;height:7px;background:#ff5a7a;vertical-align:middle;margin-left:6px;border-radius:2px}
  `;
  const root = document.createElement('div'); root.id = 'cfx';
  root.innerHTML = `<style>${css}</style><canvas width="${W * R}" height="${H * R}"></canvas><button class="x" aria-label="Close">✕</button>
    <div class="ctl"><div class="dpad"><span></span><button data-h="up" aria-label="Jump">▲</button><span></span><button data-h="left" aria-label="Left">◀</button><span></span><button data-h="right" aria-label="Right">▶</button><span></span><button data-h="down" aria-label="Crouch">▼</button><span></span></div>
      <div class="acts"><button data-p="slap">SLAP</button><button data-p="thrust">THRUST</button><button data-p="jizz">JIZZ<br>BALL</button><button class="sp" data-p="spin">SUPER</button></div></div>
    <div class="panel on" id="cfTitle"><div><h1>COCK<br>FIGHT</h1><h2>LAST COCK STANDING</h2>
      <p id="cfKeys"></p><p id="cfBest"></p><button class="btn" data-act="select">FIGHT</button></div></div>
    <div class="panel" id="cfSelect"><div><h2>CHOOSE YOUR COCK</h2><div class="grid" id="cfGrid"></div>
      <h2 id="cfName"></h2><div class="stats" id="cfStats"></div><button class="btn" data-act="go">THIS ONE</button></div></div>
    <div class="panel" id="cfOver"><div><h1 id="cfOverTitle">K.O.</h1><h2 id="cfOverText"></h2><p id="cfOverSub"></p><div id="cfOverBtns"></div></div></div>`;
  document.body.appendChild(root);
  const cv = root.querySelector('canvas'), ctx = cv.getContext('2d');
  const isTouch = !matchMedia('(hover:hover) and (pointer:fine)').matches; if (isTouch) root.classList.add('touch');
  root.querySelector('#cfKeys').textContent = isTouch
    ? 'D-pad to move, jump and crouch. Hold away from your opponent to block. Fill the meter for a SUPER.'
    : 'A/D move · W jump · S crouch · hold away to block · J slap · K thrust · L jizz ball · I super (when the meter is full)';
  function fit() {
    // phones held sideways: full-screen fight with the buttons floating over it
    const side = isTouch && innerWidth > innerHeight; root.classList.toggle('side', side);
    const ctlH = isTouch && !side ? 190 : 0, s = Math.min((innerWidth - 8) / W, (innerHeight - (side ? 0 : 16) - ctlH) / H);
    cv.style.width = Math.floor(W * s) + 'px'; cv.style.height = Math.floor(H * s) + 'px';
  }
  addEventListener('resize', fit);
  const panels = { title: root.querySelector('#cfTitle'), select: root.querySelector('#cfSelect'), over: root.querySelector('#cfOver') };
  function show(p) { for (const k in panels) panels[k].classList.toggle('on', k === p); root.classList.toggle('playing', !p); }
  function buildGrid() {
    const g = root.querySelector('#cfGrid'); g.innerHTML = '';
    ROSTER.forEach((r, i) => { const b = document.createElement('button'); b.dataset.pick = i; b.setAttribute('aria-label', r.name); b.innerHTML = `<img src="${r.src}" alt="">`; g.appendChild(b); });
    choose(G.pick);
  }
  function choose(i) {
    G.pick = i; root.querySelectorAll('#cfGrid button').forEach((b, k) => b.classList.toggle('sel', k === i));
    const r = ROSTER[i]; root.querySelector('#cfName').textContent = r.name;
    const bar = v => `<span class="bar" style="width:${Math.round((v - 0.75) * 260)}px"></span>`;
    root.querySelector('#cfStats').innerHTML = `POWER ${bar(r.power)}<br>SPEED ${bar(r.speed)}<br>TOUGH ${bar(r.tough)}`;
  }

  // ---------- input ----------
  const held = { left: 0, right: 0, up: 0, down: 0 }; const pressed = new Set();
  root.querySelectorAll('[data-h]').forEach(b => { const k = b.dataset.h; b.addEventListener('pointerdown', e => { e.preventDefault(); held[k] = 1; b.classList.add('on'); }); ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => b.addEventListener(t, () => { held[k] = 0; b.classList.remove('on'); })); });
  root.querySelectorAll('[data-p]').forEach(b => { b.addEventListener('pointerdown', e => { e.preventDefault(); pressed.add(b.dataset.p); b.classList.add('on'); }); ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => b.addEventListener(t, () => b.classList.remove('on'))); });
  const KEYS = { arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right', arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down' };
  const ACTS = { j: 'slap', k: 'thrust', l: 'jizz', i: 'spin', u: 'slap', o: 'spin' };
  addEventListener('keydown', e => {
    if (!G.on) return; const k = e.key.toLowerCase();
    if (k === 'escape') return close();
    if (KEYS[k]) { held[KEYS[k]] = 1; e.preventDefault(); }
    if (ACTS[k] && !e.repeat) pressed.add(ACTS[k]);
    if (k === ' ') { e.preventDefault(); if (!e.repeat) held.up = 1; }
    if (k === 'enter' && G.scene !== 'fight') { const b = root.querySelector('.panel.on .btn'); if (b) b.click(); }
  });
  addEventListener('keyup', e => { const k = e.key.toLowerCase(); if (KEYS[k]) held[KEYS[k]] = 0; if (k === ' ') held.up = 0; });
  root.querySelector('.x').onclick = () => close();
  root.addEventListener('click', e => {
    const pk = e.target.closest && e.target.closest('[data-pick]'); if (pk) { choose(+pk.dataset.pick); beep(660, 0.04); return; }
    const a = e.target.dataset && e.target.dataset.act; if (!a) return;
    if (a === 'select') { show('select'); buildGrid(); }
    if (a === 'go') startLadder();
    if (a === 'next') nextFight();
    if (a === 'retry') { G.stage = Math.max(0, G.stage); startFight(); }
    if (a === 'title') { show('title'); G.scene = 'title'; showBest(); }
    if (a === 'close') close();
  });
  function showBest() { root.querySelector('#cfBest').textContent = G.best ? `BEST LADDER: ${G.best} WIN${G.best === 1 ? '' : 'S'}` : ''; }

  // ---------- flow ----------
  function startLadder() {
    G.ladder = ROSTER.map((_, i) => i).filter(i => i !== G.pick || ROSTER.length === 1).sort(() => Math.random() - 0.5);
    G.stage = 0; G.wins = 0; startFight();
  }
  function startFight() {
    P1 = fighter(G.pick, 110, 1, false); P2 = fighter(G.ladder[G.stage % G.ladder.length], 274, -1, true);
    G.round = 1; show(null); G.scene = 'vs'; G.vsT = 1.6; play('moan', 0.9);
  }
  function nextFight() { G.stage++; startFight(); }
  function endRound(winner, how) {
    G.scene = 'ko'; G.koT = 2.4; G.slow = 0.9;
    if (winner) winner.roundsWon++;
    banner(how, 2.2); play('moan', 0.6 + Math.random() * 0.4); beep(110, 0.6, 'sawtooth', 0.06, 0.5);
    G.roundWinner = winner;
  }
  function afterRound() {
    if (P1.roundsWon >= 2 || P2.roundsWon >= 2) return endMatch(P1.roundsWon >= 2);
    G.round++; resetRound();
  }
  function endMatch(won) {
    G.scene = 'over';
    const t = root.querySelector('#cfOverTitle'), tx = root.querySelector('#cfOverText'), sub = root.querySelector('#cfOverSub'), btns = root.querySelector('#cfOverBtns');
    btns.innerHTML = '';
    const add = (label, act, alt) => { const b = document.createElement('button'); b.className = 'btn' + (alt ? ' alt' : ''); b.textContent = label; b.dataset.act = act; btns.appendChild(b); };
    if (won) {
      G.wins++; if (G.wins > G.best) { G.best = G.wins; try { localStorage.setItem('cockfight-best', String(G.best)); } catch (e) {} }
      const champ = G.wins >= G.ladder.length;
      t.textContent = champ ? 'CHAMP!' : 'YOU WIN';
      tx.textContent = champ ? `${P1.r.name} IS THE LAST COCK STANDING` : `${P1.r.name} BEAT ${P2.r.name}`;
      sub.textContent = champ ? `You beat all ${G.wins}. Go again for glory.` : `Ladder: ${G.wins} of ${G.ladder.length}. Next up gets tougher.`;
      if (champ) { add('NEW LADDER', 'select'); add('CLOSE', 'close', true); window.CockStickers && window.CockStickers.gameOver(); }
      else { add('NEXT FIGHT', 'next'); add('CLOSE', 'close', true); }
    } else {
      t.textContent = 'K.O.'; tx.textContent = `${P2.r.name} WINS`; sub.textContent = `You won ${G.wins} fight${G.wins === 1 ? '' : 's'}. Best: ${G.best}.`;
      add('TRY AGAIN', 'retry'); add('NEW COCK', 'select', true); add('CLOSE', 'close', true);
      window.CockStickers && window.CockStickers.gameOver();
    }
    show('over'); if (won) buildGrid();
  }

  // ---------- fighting ----------
  const busy = f => f.atk || f.stun > 0 || f.state === 'ko';
  function startMove(f, type) {
    if (busy(f)) return;
    if (type === 'jizz' && f.cool > 0) return;
    if (type === 'spin') { if (f.meter < 100) return; f.meter = 0; banner('HELICOPTER!', 0.9); play('moan', 1.3); }
    f.atk = { type, t: 0, hits: 0, done: false }; f.crouch = false;
    if (type === 'slap') beep(500, 0.03, 'triangle', 0.03); if (type === 'thrust') beep(260, 0.06, 'triangle', 0.04, 0.7);
  }
  function hit(att, def, mv, x, y, scale = 1) {
    if (def.state === 'ko') return false;
    const dmgBase = mv.dmg * att.r.power * scale;
    const blocking = def.block && def.y >= FLOOR - 0.5 && !def.atk && def.stun <= 0;
    if (blocking) {
      def.hp -= dmgBase * 0.18; def.vx = att.face * 60; def.meter = Math.min(100, def.meter + 3);
      G.fx.push({ k: 'block', x, y, t: 0 }); play('bump', 0.6, 1.4); beep(900, 0.03, 'square', 0.02);
    } else {
      def.hp -= dmgBase; def.stun = mv.stun; def.vx = att.face * mv.kb; if (def.y < FLOOR) def.vy = -120;
      def.atk = null; def.hitFlash = 0.12; att.meter = Math.min(100, att.meter + (mv.meter || 4)); def.meter = Math.min(100, def.meter + 5);
      att.combo = att.comboT > 0 ? att.combo + 1 : 1; att.comboT = 0.9;
      if (att.combo >= 2) G.fx.push({ k: 'combo', x: att === P1 ? 70 : W - 70, y: 60, text: `${att.combo} HIT COMBO!`, t: 0 });
      G.fx.push({ k: 'spark', x, y, t: 0 }); G.shake = Math.min(6, 2 + mv.dmg * 0.25);
      play(mv.dmg >= 10 ? 'smack' : 'thump', 1, 0.9 + Math.random() * 0.3); if (Math.random() < 0.4) play('moan', 0.9 + Math.random() * 0.5);
    }
    if (def.hp <= 0) { def.hp = 0; def.state = 'ko'; def.vy = -260; def.vx = att.face * 160; endRound(att, def.hp === 0 && att.hp >= att.maxHp ? 'PERFECT!' : 'K.O.!'); }
    return true;
  }
  function updateFighter(f, o, dt, input) {
    f.t += dt; if (f.cool > 0) f.cool -= dt; if (f.comboT > 0) f.comboT -= dt; if (f.hitFlash > 0) f.hitFlash -= dt;
    const onGround = f.y >= FLOOR - 0.5;
    if (f.state === 'ko') { f.vy += GRAV * dt; f.x += f.vx * dt; f.y = Math.min(FLOOR, f.y + f.vy * dt); if (f.y >= FLOOR) { f.vx *= 0.85; f.vy = 0; } f.x = clamp(f.x, 20, W - 20); return; }
    if (onGround && !f.atk) f.face = o.x >= f.x ? 1 : -1;
    const sp = WALK * f.r.speed;
    if (f.stun > 0) { f.stun -= dt; f.vx *= Math.pow(0.02, dt); f.block = false; }
    else if (f.atk) {
      const mv = MOVES[f.atk.type], a = f.atk; a.t += dt;
      if (onGround) f.vx *= Math.pow(0.001, dt);
      if (a.type === 'jizz' && !a.done && a.t >= mv.start) { a.done = true; f.cool = mv.cool; G.shots.push({ x: f.x + f.face * 26, y: f.y - (f.crouch ? 18 : 34), dir: f.face, owner: f, t: 0 }); play('goo'); beep(700, 0.1, 'sine', 0.04, 0.5); }
      if ((a.type === 'slap' || a.type === 'thrust') && !a.done && a.t >= mv.start && a.t <= mv.start + mv.active) {
        const reach = Math.abs(o.x - f.x) <= mv.range && Math.sign(o.x - f.x) === f.face && Math.abs(o.y - f.y) < 50;
        if (reach) { a.done = true; hit(f, o, mv, (f.x + o.x) / 2, f.y - 34); }
      }
      if (a.type === 'spin') {
        f.vx = f.face * 70; if (a.t > mv.start && a.t < mv.start + mv.active) {
          const every = mv.active / mv.hits;
          if (a.t - mv.start >= a.hits * every && Math.abs(o.x - f.x) <= mv.range && Math.abs(o.y - f.y) < 55) { a.hits++; hit(f, o, { ...mv, kb: a.hits >= mv.hits ? 260 : mv.kb }, (f.x + o.x) / 2, f.y - 34); }
          if (Math.random() < dt * 30) beep(200 + Math.random() * 300, 0.03, 'sawtooth', 0.015);
        }
      }
      if (a.t >= mv.start + mv.active + mv.recover) f.atk = null;
    } else {
      const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      f.crouch = !!input.down && onGround;
      f.block = onGround && dir === -f.face;
      if (onGround) {
        f.vx = f.crouch ? 0 : dir * sp * (dir === -f.face ? 0.7 : 1);
        if (input.up && !f.crouch) { f.vy = -JUMPV; f.vx = dir * sp * 1.1; beep(330, 0.06, 'square', 0.025, 1.5); }
      }
      for (const m of ['spin', 'thrust', 'slap', 'jizz']) if (input[m]) { startMove(f, m); break; }
    }
    if (!onGround || f.vy < 0) f.vy += GRAV * dt;
    f.x += f.vx * dt; f.y += f.vy * dt;
    if (f.y >= FLOOR) { if (f.vy > 200) play('bump', 0.4, 0.7); f.y = FLOOR; f.vy = 0; }
    f.x = clamp(f.x, 20, W - 20);
  }
  // the CPU opponent gets sharper with every stage of the ladder
  function cpuInput(f, o, dt) {
    const lvl = Math.min(1, 0.08 + G.stage * 0.11), ai = f.ai, d = Math.abs(o.x - f.x), toward = o.x > f.x ? 'right' : 'left', away = toward === 'right' ? 'left' : 'right';
    const inp = {}; ai.next -= dt; if (G.cpuOff) return inp;
    const incoming = G.shots.find(s => s.owner !== f && Math.sign(f.x - s.x) === s.dir && Math.abs(f.x - s.x) < 120);
    if (incoming && !busy(f)) { const r = Math.random(); if (r < 0.04 + lvl * 0.05) { inp.up = 1; inp[toward] = 1; } else if (r < 0.06 + lvl * 0.06) inp.down = 1; else if (r < 0.1 + lvl * 0.1) inp[away] = 1; ai.hold = inp; return inp; }
    if (o.atk && d < 80 && Math.random() < 0.1 + lvl * 0.25) { inp[away] = 1; ai.hold = inp; ai.next = 0.25; return inp; }
    if (ai.next > 0) return ai.hold || {};
    ai.next = rnd(0.16, 0.36) * (1.6 - lvl * 0.8);
    const r = Math.random();
    if (f.meter >= 100 && d < 70 && r < 0.5 + lvl * 0.4) inp.spin = 1;
    else if (d > 150) { if (f.cool <= 0 && r < 0.25 + lvl * 0.3) inp.jizz = 1; else inp[toward] = 1; }
    else if (d > 64) { if (r < 0.12 * lvl) { inp.up = 1; inp[toward] = 1; } else if (f.cool <= 0 && r < 0.2) inp.jizz = 1; else inp[toward] = 1; }
    else { if (r < 0.32 + lvl * 0.2) inp.slap = 1; else if (r < 0.55 + lvl * 0.2) inp.thrust = 1; else if (r < 0.7) inp[away] = 1; else inp.down = 1; }
    ai.hold = { ...inp }; delete ai.hold.slap; delete ai.hold.thrust; delete ai.hold.jizz; delete ai.hold.spin; delete ai.hold.up;
    return inp;
  }
  function update(dt) {
    G.t += dt; if (G.bannerT > 0) G.bannerT -= dt; if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 30);
    if (G.scene === 'vs') { G.vsT -= dt; if (G.vsT <= 0) { resetRound(); } return; }
    if (G.scene === 'intro') { G.introT -= dt; if (G.introT <= 0) G.scene = 'fight'; }
    if (G.slow > 0) { G.slow -= dt; dt *= 0.35; }
    const fighting = G.scene === 'fight';
    const in1 = fighting ? { ...held, slap: pressed.has('slap'), thrust: pressed.has('thrust'), jizz: pressed.has('jizz'), spin: pressed.has('spin') } : {};
    const in2 = fighting ? cpuInput(P2, P1, dt) : {};
    updateFighter(P1, P2, dt, in1); updateFighter(P2, P1, dt, in2);
    // keep them from overlapping
    const gap = 30, dx = P2.x - P1.x;
    if (Math.abs(dx) < gap && Math.abs(P1.y - P2.y) < 40 && P1.state !== 'ko' && P2.state !== 'ko') { const push = (gap - Math.abs(dx)) / 2 * (Math.sign(dx) || 1); P1.x = clamp(P1.x - push, 20, W - 20); P2.x = clamp(P2.x + push, 20, W - 20); }
    // jizz balls
    for (const s of G.shots) {
      s.t += dt; s.x += s.dir * 230 * dt;
      const o = s.owner === P1 ? P2 : P1;
      const hy = o.crouch ? o.y - 22 : o.y - 36;
      if (!s.gone && Math.abs(s.x - o.x) < 16 && Math.abs(s.y - hy) < (o.crouch ? 8 : 26) && o.state !== 'ko') { s.gone = true; hit(s.owner, o, MOVES.jizz, s.x, s.y); }
      for (const t of G.shots) if (t !== s && !t.gone && !s.gone && t.owner !== s.owner && Math.abs(t.x - s.x) < 10) { s.gone = t.gone = true; G.fx.push({ k: 'splash', x: s.x, y: s.y, t: 0 }); play('goo'); }
      if (s.x < -20 || s.x > W + 20) s.gone = true;
    }
    G.shots = G.shots.filter(s => !s.gone);
    G.fx = G.fx.filter(f => (f.t += dt) < (f.k === 'combo' ? 1.1 : 0.5));
    if (fighting) {
      G.timer -= dt;
      if (G.timer <= 0) { G.timer = 0; const a = P1.hp / P1.maxHp, b = P2.hp / P2.maxHp; endRound(a === b ? null : a > b ? P1 : P2, 'TIME!'); }
    }
    if (G.scene === 'ko') { G.koT -= dt / 0.35 * (G.slow > 0 ? 0.35 : 1); if (G.koT <= 0) afterRound(); }
    pressed.clear(); held.up = held.up && !isTouch ? held.up : held.up;
  }

  // ---------- drawing ----------
  function txt(s, x, y, col = '#fff', size = 8, align = 'left', shadow = true) { ctx.font = `${size}px "Press Start 2P", monospace`; ctx.textAlign = align; ctx.textBaseline = 'top'; if (shadow) { ctx.fillStyle = 'rgba(0,0,0,.75)'; ctx.fillText(s, x + 1, y + 1); } ctx.fillStyle = col; ctx.fillText(s, x, y); ctx.textAlign = 'left'; }
  function drawStage() {
    ctx.fillStyle = '#140910'; ctx.fillRect(0, 0, W, H);
    if (backdrop) { const s = Math.max(W / backdrop.width, (FLOOR + 10) / backdrop.height); const w = backdrop.width * s, h = backdrop.height * s; ctx.globalAlpha = 0.55; ctx.drawImage(backdrop, (W - w) / 2, (FLOOR + 10 - h) / 2 - 10, w, h); ctx.globalAlpha = 1; }
    const v = ctx.createLinearGradient(0, 0, 0, FLOOR); v.addColorStop(0, 'rgba(20,9,16,.75)'); v.addColorStop(0.6, 'rgba(20,9,16,.2)'); v.addColorStop(1, 'rgba(20,9,16,.6)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, FLOOR);
    // spotlights
    for (const sx of [W * 0.3, W * 0.7]) { const g = ctx.createRadialGradient(sx, FLOOR, 4, sx, FLOOR - 40, 140); g.addColorStop(0, 'rgba(255,220,180,.18)'); g.addColorStop(1, 'rgba(255,220,180,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    // ring ropes and posts
    for (const [y, c] of [[FLOOR - 46, '#ff5a7a'], [FLOOR - 30, '#ffd34a'], [FLOOR - 14, '#ff5a7a']]) { ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.moveTo(8, y); ctx.lineTo(W - 8, y); ctx.stroke(); ctx.globalAlpha = 1; }
    ctx.fillStyle = '#3a2c33'; ctx.fillRect(4, FLOOR - 52, 6, 52); ctx.fillRect(W - 10, FLOOR - 52, 6, 52);
    // canvas floor
    const fl = ctx.createLinearGradient(0, FLOOR, 0, H); fl.addColorStop(0, '#d8c6b8'); fl.addColorStop(1, '#8c766a'); ctx.fillStyle = fl; ctx.fillRect(0, FLOOR, W, H - FLOOR);
    ctx.fillStyle = 'rgba(194,24,91,.55)'; ctx.font = '400 12px "Bagel Fat One", system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('COCKPILE.COM', W / 2, FLOOR + (H - FLOOR) / 2 + 1); ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    ctx.fillStyle = '#5a4048'; ctx.fillRect(0, FLOOR, W, 2);
  }
  function drawFighter(f) {
    const im = f.r.img; if (!im) return;
    const h = 72, k = h / im.height, w = im.width * k;
    let sx = 1, sy = 1, lean = 0, ox = 0, rot = 0;
    const onGround = f.y >= FLOOR - 0.5;
    if (f.state === 'ko') { rot = clamp((FLOOR - f.y) / 60, 0, 1) * 0 + Math.min(1.45, (G.t * 3) % 100) * 0; rot = onGround ? 1.45 : 0.8; }
    else if (f.atk) {
      const mv = MOVES[f.atk.type], a = f.atk.t;
      if (f.atk.type === 'slap') { const p = a < mv.start ? a / mv.start : a < mv.start + mv.active ? 1 : Math.max(0, 1 - (a - mv.start - mv.active) / mv.recover); lean = 0.45 * p; ox = 10 * p; }
      if (f.atk.type === 'thrust') { const p = a < mv.start ? -0.4 * a / mv.start : a < mv.start + mv.active ? 1 : Math.max(0, 1 - (a - mv.start - mv.active) / mv.recover); sx = 1 + 0.3 * Math.max(0, p); sy = 1 - 0.12 * Math.max(0, p); ox = 18 * p; lean = 0.2 * p; }
      if (f.atk.type === 'jizz') { const p = Math.min(1, a / mv.start); lean = a < mv.start ? -0.25 * p : 0.3; sy = a < mv.start ? 1 - 0.1 * p : 1.08; }
      if (f.atk.type === 'spin') rot = a * 26;
    } else if (f.stun > 0) { lean = -0.35; ox = -4; }
    else if (f.crouch) { sy = 0.66; sx = 1.12; }
    else if (!onGround) { sy = 1.1; sx = 0.92; lean = -0.15; }
    else if (f.block) { lean = -0.22; }
    else { const moving = Math.abs(f.vx) > 5; sy = 1 + Math.sin(f.t * (moving ? 14 : 4)) * (moving ? 0.04 : 0.025); lean = moving ? Math.sin(f.t * 14) * 0.08 : 0; }
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(f.x, FLOOR + 2, 22 * (1 - (FLOOR - f.y) / 200), 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(f.x + ox * f.face, f.y); ctx.scale(f.face, 1);
    if (rot) { ctx.translate(0, -h * 0.45); ctx.rotate(rot); ctx.translate(0, h * 0.45); }
    ctx.rotate(lean); ctx.scale(sx, sy);
    if (f.hitFlash > 0) ctx.filter = 'brightness(2.6) saturate(0.3)';
    ctx.drawImage(im, -w / 2, -h, w, h); ctx.filter = 'none';
    ctx.restore();
    if (f.block && !f.atk && f.stun <= 0 && onGround && f.state !== 'ko') { ctx.strokeStyle = 'rgba(127,227,255,.75)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x + f.face * 10, f.y - 36, 30, -0.9, 0.9); if (f.face < 0) { ctx.beginPath(); ctx.arc(f.x + f.face * 10, f.y - 36, 30, Math.PI - 0.9, Math.PI + 0.9); } ctx.stroke(); }
    if (f.atk && f.atk.type === 'spin') { ctx.strokeStyle = 'rgba(255,211,74,.6)'; ctx.lineWidth = 2; for (let k = 0; k < 2; k++) { ctx.beginPath(); ctx.ellipse(f.x, f.y - 36, 40, 12, 0, G.t * 20 + k * 3, G.t * 20 + k * 3 + 2); ctx.stroke(); } }
  }
  function drawShot(s) {
    for (let k = 4; k >= 0; k--) { ctx.fillStyle = `rgba(255,250,235,${0.18 + (4 - k) * 0.18})`; ctx.beginPath(); ctx.arc(s.x - s.dir * k * 5, s.y + Math.sin(s.t * 20 + k) * 1.5, 7 - k, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x + s.dir * 2, s.y - 2, 2.2, 0, Math.PI * 2); ctx.fill();
  }
  function hpBar(f, x, flip) {
    const w = 150, pct = f.hp / f.maxHp;
    ctx.fillStyle = '#2a1520'; ctx.fillRect(x - 1, 9, w + 2, 11);
    ctx.fillStyle = '#5a0f22'; ctx.fillRect(x, 10, w, 9);
    const c = pct > 0.5 ? '#ffd34a' : pct > 0.25 ? '#ff9a3c' : '#ff3c5a';
    ctx.fillStyle = c; if (flip) ctx.fillRect(x, 10, w * pct, 9); else ctx.fillRect(x + w * (1 - pct), 10, w * pct, 9);
    txt(f.r.name.slice(0, 16), flip ? x + w : x, 23, '#fff', 5, flip ? 'right' : 'left');
    for (let i = 0; i < 2; i++) { ctx.fillStyle = i < f.roundsWon ? '#ffd34a' : '#3a2c33'; ctx.beginPath(); ctx.arc(flip ? x + w - 4 - i * 9 : x + 4 + i * 9, 33, 3, 0, Math.PI * 2); ctx.fill(); }
    // super meter
    const mw = 70, my = H - 12, mx = flip ? W - 8 - mw : 8;
    ctx.fillStyle = '#2a1520'; ctx.fillRect(mx - 1, my - 1, mw + 2, 7); ctx.fillStyle = f.meter >= 100 ? (Math.sin(G.t * 12) > 0 ? '#ffd34a' : '#fff') : '#7fe3ff'; ctx.fillRect(mx, my, mw * f.meter / 100, 5);
    txt(f.meter >= 100 ? 'SUPER READY' : 'SUPER', flip ? mx + mw : mx, my - 8, f.meter >= 100 ? '#ffd34a' : '#7fe3ff', 4, flip ? 'right' : 'left');
  }
  function draw() {
    const sh = G.shake ? (Math.random() - 0.5) * G.shake : 0;
    ctx.setTransform(R, 0, 0, R, sh * R, sh * 0.5 * R);
    drawStage();
    if (G.scene === 'vs') {
      ctx.fillStyle = 'rgba(11,5,8,.7)'; ctx.fillRect(0, 0, W, H);
      const p = Math.min(1, (1.6 - G.vsT) * 3);
      for (const [f, side] of [[P1, -1], [P2, 1]]) { const im = f.r.img; if (!im) continue; const h = 110, w = im.width * h / im.height; ctx.save(); ctx.translate(W / 2 + side * (200 - 110 * p), 150); ctx.scale(side < 0 ? 1 : -1, 1); ctx.drawImage(im, -w / 2, -h, w, h); ctx.restore(); txt(f.r.name, W / 2 + side * 92, 160, '#fff', 6, 'center'); }
      ctx.font = '400 42px "Bagel Fat One", system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#7d0f3a'; ctx.fillText('VS', W / 2 + 2, 92); ctx.fillStyle = '#ff5a7a'; ctx.fillText('VS', W / 2, 90); ctx.textAlign = 'left';
      txt(`FIGHT ${G.stage + 1} OF ${G.ladder.length}`, W / 2, 18, '#ffd34a', 7, 'center');
      return;
    }
    for (const f of [P2, P1]) drawFighter(f);
    for (const s of G.shots) drawShot(s);
    for (const f of G.fx) {
      const a = 1 - f.t / 0.5;
      if (f.k === 'spark') { ctx.strokeStyle = `rgba(255,240,200,${a})`; ctx.lineWidth = 2; for (let k = 0; k < 8; k++) { const ang = k * 0.785 + f.x, d1 = 4 + f.t * 30, d2 = 10 + f.t * 60; ctx.beginPath(); ctx.moveTo(f.x + Math.cos(ang) * d1, f.y + Math.sin(ang) * d1); ctx.lineTo(f.x + Math.cos(ang) * d2, f.y + Math.sin(ang) * d2); ctx.stroke(); } }
      if (f.k === 'block') { ctx.strokeStyle = `rgba(127,227,255,${a})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y, 6 + f.t * 40, 0, Math.PI * 2); ctx.stroke(); }
      if (f.k === 'splash') { ctx.fillStyle = `rgba(255,250,235,${a})`; for (let k = 0; k < 10; k++) { const ang = k * 0.63, d = f.t * 70; ctx.beginPath(); ctx.arc(f.x + Math.cos(ang) * d, f.y + Math.sin(ang) * d, 2.5, 0, Math.PI * 2); ctx.fill(); } }
      if (f.k === 'combo') txt(f.text, f.x, f.y - f.t * 10, '#ffd34a', 6, 'center');
    }
    hpBar(P1, 10, false); hpBar(P2, W - 160, true);
    txt(String(Math.ceil(G.timer)).padStart(2, '0'), W / 2, 9, G.timer < 10 ? '#ff3c5a' : '#fff', 12, 'center');
    if (G.bannerT > 0) {
      const t = G.banner, big = t.length <= 8;
      ctx.font = `400 ${big ? 40 : 26}px "Bagel Fat One", system-ui`; ctx.textAlign = 'center';
      const y = 100 + Math.sin(G.t * 10) * 1.5; ctx.fillStyle = '#2a1520'; ctx.fillText(t, W / 2 + 3, y + 3); ctx.fillStyle = '#7d0f3a'; ctx.fillText(t, W / 2 + 1.5, y + 1.5); ctx.fillStyle = t === 'FIGHT!' ? '#ffd34a' : '#ff5a7a'; ctx.fillText(t, W / 2, y); ctx.textAlign = 'left';
    }
  }

  // ---------- loop ----------
  let last = 0, raf = 0;
  function loop(now) {
    if (!G.on) return;
    const dt = Math.min(0.033, (now - last) / 1000 || 0.016); last = now;
    if (P1 && ['vs', 'intro', 'fight', 'ko'].includes(G.scene)) update(dt);
    if (P1) draw(); else { ctx.setTransform(R, 0, 0, R, 0, 0); drawStage(); }
    raf = requestAnimationFrame(loop);
  }
  let loaded = null;
  function open() {
    root.classList.add('on'); G.on = true; window.__rpgOpen = true; fit(); show('title'); G.scene = 'title'; showBest();
    if (!loaded) loaded = Promise.all([loadArt(), document.fonts ? document.fonts.load('8px "Press Start 2P"') : null, document.fonts ? document.fonts.load('20px "Bagel Fat One"') : null]);
    loaded.then(() => { cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(loop); });
  }
  function close() { G.on = false; window.__rpgOpen = false; root.classList.remove('on'); cancelAnimationFrame(raf); for (const k in held) held[k] = 0; }
  window.Cockfight = { open, close, G, ROSTER, MOVES, get P1() { return P1; }, get P2() { return P2; }, press: k => pressed.add(k), held, startLadder, choose };
})();

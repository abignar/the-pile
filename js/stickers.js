// =====================================================================
// Sticker shop: a wiggling "STICKERS!" button that links to Redbubble, and a
// pop-up that appears when someone is about to leave (desktop: mouse heads for
// the tabs/close button) or when a game ends. It stays polite: the leaving
// pop-up shows once per visit, and the game-over one at most every 3 minutes.
// To add a sticker, add an entry to STICKERS below.
// =====================================================================
(() => {
  const SHOP = 'https://www.redbubble.com/people/TheCockpile/shop';
  const STICKERS = [
    { name: 'Penisaurus Rex', note: 'Holographic', img: 'images/penisaurus-rex-sticker.webp', url: 'https://www.redbubble.com/i/holographic-sticker/Penisaurus-Rex-Dinosau-Dick-Skeleton-by-TheCockpile/185695859/mtb4' },
    { name: 'FrankenDick', note: 'Sticker', img: 'images/frankendick-sticker.webp', url: 'https://www.redbubble.com/i/sticker/FrankenDick-by-TheCockpile/185695941/7sgk' },
  ];
  const LINES = {
    leave: ['Leaving already?', 'Take a cock home with you.'],
    back: ['Welcome back, champ.', 'Take a cock home with you.'],
    button: ['Cock stickers!', 'Slap one on your laptop, fridge or nan.'],
  };
  const GAME_COOLDOWN = 3 * 60 * 1000;

  const css = `
  #stk{position:fixed;inset:0;z-index:40;display:none;align-items:center;justify-content:center;background:rgba(20,8,14,.62);padding:16px;backdrop-filter:blur(3px)}
  #stk.on{display:flex}
  #stk .box{position:relative;background:#fff6f9;border:3px solid #2a1520;border-radius:22px;box-shadow:8px 8px 0 #2a1520;max-width:560px;width:100%;
    padding:22px 18px 18px;text-align:center;font-family:"DM Sans",system-ui;color:#2a1520;animation:stkPop .35s cubic-bezier(.2,1.6,.4,1)}
  @keyframes stkPop{from{transform:scale(.6) rotate(-4deg);opacity:0}to{transform:none;opacity:1}}
  #stk h2{font:400 clamp(26px,6vw,38px) "Bagel Fat One",system-ui;margin:0;color:#c2185b;line-height:1.05}
  #stk .sub{margin:6px 0 16px;font-weight:700;font-size:15px}
  #stk .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  #stk a.card{display:block;text-decoration:none;color:inherit;background:#fff;border:3px solid #2a1520;border-radius:16px;padding:10px 8px 12px;box-shadow:4px 4px 0 #2a1520;transition:transform .12s}
  #stk a.card:hover{transform:translateY(-3px) rotate(-1deg)}
  #stk a.card img{width:100%;aspect-ratio:1;object-fit:contain;border-radius:10px}
  #stk a.card b{display:block;font:400 18px "Bagel Fat One",system-ui;margin-top:4px}
  #stk a.card i{font-style:normal;font-size:12px;opacity:.7}
  #stk a.card span{display:inline-block;margin-top:8px;background:#c2185b;color:#fff;font-weight:800;font-size:13px;padding:7px 12px;border-radius:999px}
  #stk .all{display:inline-block;margin-top:14px;font-weight:800;color:#2a1520}
  #stk .x{position:absolute;top:8px;right:8px;width:36px;height:36px;border-radius:50%;border:2px solid #2a1520;background:#fff;font:700 17px system-ui;cursor:pointer}
  #stk .later{display:block;margin:10px auto 0;background:none;border:none;font:600 13px "DM Sans",system-ui;color:#2a1520;opacity:.6;cursor:pointer;text-decoration:underline}
  @media (max-width:420px){#stk .grid{gap:8px}#stk a.card b{font-size:15px}}
  `;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  // the button itself is in index.html (so it shows instantly); this just makes it open the pop-up
  let btn = document.getElementById('stkBtn');
  if (!btn) { btn = document.createElement('a'); btn.id = 'stkBtn'; btn.href = SHOP; btn.target = '_blank'; btn.rel = 'noopener'; btn.innerHTML = '<img src="images/stk-icon.webp" alt="" width="30" height="30">STICKERS!'; document.body.appendChild(btn); }
  btn.addEventListener('click', e => { e.preventDefault(); show('button'); });

  const pop = document.createElement('div'); pop.id = 'stk';
  pop.innerHTML = `<div class="box" role="dialog" aria-modal="true" aria-labelledby="stkTitle"><button class="x" aria-label="Close">✕</button>
    <h2 id="stkTitle"></h2><p class="sub"></p>
    <div class="grid">${STICKERS.map(s => `<a class="card" href="${s.url}" target="_blank" rel="noopener"><img src="${s.img}" alt="${s.name} sticker" loading="lazy"><b>${s.name}</b><i>${s.note}</i><br><span>Buy on Redbubble</span></a>`).join('')}</div>
    <a class="all" href="${SHOP}" target="_blank" rel="noopener">See the whole shop →</a>
    <button class="later">Nah, back to the cocks</button></div>`;
  document.body.appendChild(pop);
  const hide = () => pop.classList.remove('on');
  pop.querySelector('.x').onclick = hide; pop.querySelector('.later').onclick = hide;
  pop.addEventListener('click', e => { if (e.target === pop) hide(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && pop.classList.contains('on')) { e.stopPropagation(); hide(); } }, true);

  function show(kind) {
    const [h, p] = LINES[kind] || LINES.button;
    pop.querySelector('h2').textContent = h; pop.querySelector('.sub').textContent = p;
    pop.classList.add('on');
    try { window.__pile && window.__pile.sfx && window.__pile.sfx.moan && window.__pile.sfx.moan(1.1); } catch (e) {}
  }
  const store = {
    get: k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) {} },
  };
  const t0 = Date.now();

  // About to leave (desktop): the mouse leaves through the top of the window.
  document.addEventListener('mouseout', e => {
    if (e.relatedTarget || e.clientY > 4) return;
    if (Date.now() - t0 < 8000 || store.get('stk-leave') || pop.classList.contains('on')) return;
    store.set('stk-leave', '1'); show('leave');
  });
  // Phones can't tell a site you're leaving, so show it once after a good play instead.
  if (!matchMedia('(hover:hover) and (pointer:fine)').matches) {
    setTimeout(() => {
      if (store.get('stk-leave') || pop.classList.contains('on')) return;
      store.set('stk-leave', '1'); show('leave');
    }, 75000);
  }

  // Games call this when they end.
  // After playing a game, the pop-up shows when you come back to the main page
  // (not on the game-over screen), at most every 3 minutes.
  let lastBack = 0, wasIn = false, playedSince = 0;
  const inGame = () => document.body.classList.contains('game') || !!window.__rpgOpen;
  function gameOver() { playedSince = Date.now(); } // games still call this; it just notes that a game was played
  setInterval(() => {
    const now = inGame();
    if (now && !wasIn) playedSince = Date.now();
    if (!now && wasIn && playedSince && Date.now() - lastBack > GAME_COOLDOWN && !pop.classList.contains('on')) {
      lastBack = Date.now(); playedSince = 0; setTimeout(() => { if (!inGame()) show('back'); }, 700);
    }
    wasIn = now;
  }, 300);
  window.CockStickers = { show, gameOver, STICKERS, SHOP };
})();

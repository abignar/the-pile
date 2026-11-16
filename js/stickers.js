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
    gameover: ['Game over, champ.', 'Console yourself with a sticker.'],
    button: ['Cock stickers!', 'Slap one on your laptop, fridge or nan.'],
  };
  const GAME_COOLDOWN = 3 * 60 * 1000;

  const css = `
  #stkBtn{position:fixed;left:12px;top:calc(12px + env(safe-area-inset-top));z-index:3;font:400 17px "Bagel Fat One",system-ui;color:#fff;
    background:#c2185b;border:3px solid #2a1520;border-radius:14px;padding:9px 14px 8px;box-shadow:4px 4px 0 #2a1520;cursor:pointer;
    transform:rotate(-6deg);animation:stkWiggle 5s ease-in-out infinite;text-decoration:none;display:flex;align-items:center;gap:7px;letter-spacing:.3px}
  #stkBtn:hover{animation-play-state:paused;transform:rotate(-2deg) scale(1.08)}
  #stkBtn:active{transform:rotate(-2deg) translate(2px,2px);box-shadow:1px 1px 0 #2a1520}
  #stkBtn img{width:30px;height:30px;object-fit:contain;filter:drop-shadow(0 2px 0 rgba(0,0,0,.35))}
  #stkBtn::after{content:"";position:absolute;right:-3px;top:-3px;width:16px;height:16px;background:linear-gradient(225deg,#ffe3ee 0 50%,transparent 50%);border-radius:0 11px 0 0}
  @keyframes stkWiggle{0%,82%,100%{transform:rotate(-6deg) scale(1)}85%{transform:rotate(4deg) scale(1.12)}88%{transform:rotate(-12deg) scale(1.12)}91%{transform:rotate(3deg) scale(1.08)}94%{transform:rotate(-8deg) scale(1.02)}}
  body.game #stkBtn{opacity:.55;transform:rotate(-6deg) scale(.85);animation:none}
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
  @media (max-width:420px){#stk .grid{gap:8px}#stk a.card b{font-size:15px}#stkBtn{font-size:15px;padding:7px 11px 6px}#stkBtn img{width:24px;height:24px}}
  `;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  const btn = document.createElement('a');
  btn.id = 'stkBtn'; btn.href = SHOP; btn.target = '_blank'; btn.rel = 'noopener';
  btn.innerHTML = `<img src="${STICKERS[0].img}" alt="">STICKERS!`;
  btn.addEventListener('click', e => { e.preventDefault(); show('button'); });
  document.body.appendChild(btn);

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
  let lastGame = 0;
  function gameOver() {
    if (Date.now() - lastGame < GAME_COOLDOWN) return;
    lastGame = Date.now();
    setTimeout(() => { if (!pop.classList.contains('on')) show('gameover'); }, 1600);
  }
  window.CockStickers = { show, gameOver, STICKERS, SHOP };
})();

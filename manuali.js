/* Campagna D&D — «Manuali»: i manuali di gioco sfogliabili (flipbook AnyFlip) dentro il sito.
   I manuali del giocatore li vedono tutti; quelli segnati «dm» solo il Dungeon Master.
   Usa le funzioni della pagina principale (route, setView, esc…). */
(() => {
  'use strict';
  const MANUALI = [
    { id: 'giocatore', col: '#7d2530', dm: false, title: 'Manuale del Giocatore', sub: 'D&D 5ª edizione', desc: 'Le regole base: creazione del personaggio, razze, classi, incantesimi, equipaggiamento e combattimento.', url: 'https://online.anyflip.com/piwcj/iafx/mobile/index.html' },
    { id: 'tasha', col: '#5a3a7a', dm: false, title: 'Calderone Omnicomprensivo di Tasha', sub: 'Espansione per i giocatori', desc: 'Opzioni di classe aggiuntive, sottoclassi, personalizzazione delle origini, nuovi incantesimi e oggetti magici.', url: 'https://online.anyflip.com/jzhjh/dako/mobile/index.html' },
    { id: 'xanathar', col: '#25506a', dm: false, title: 'Guida Omnicomprensiva di Xanathar', sub: 'Espansione per i giocatori', desc: 'Nuove sottoclassi, talenti razziali, incantesimi e strumenti per arricchire la storia del personaggio.', url: 'https://online.anyflip.com/fqnfa/gmdk/mobile/index.html' },
    { id: 'mostri', col: '#3f5a2c', dm: true, title: 'Manuale dei Mostri', sub: 'D&D 5ª edizione', desc: 'Le statistiche e il comportamento delle creature da mettere contro il party.', url: 'https://online.anyflip.com/fqnfa/ltch/mobile/index.html' }
  ];
  // tutti vedono tutti i manuali; quelli «dm» li apre solo il Dungeon Master
  const visibili = () => MANUALI;
  const vietato = m => m.dm && window.__RO;

  const CSS = `.man-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,220px));gap:22px 18px;margin:6px 0 22px}
.man-tile{display:flex;flex-direction:column;gap:8px;color:var(--ink);text-decoration:none!important}
.man-cov{position:relative;aspect-ratio:3/4;border-radius:4px 8px 8px 4px;overflow:hidden;border:1px solid #0005;box-shadow:inset 6px 0 0 #00000038,0 6px 16px #0000004d;background:var(--c);transition:transform .2s,box-shadow .2s}
.man-tile:hover .man-cov{transform:translateY(-3px);box-shadow:inset 6px 0 0 #00000038,0 10px 22px #0000005c}
.man-cov img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .3s}
.man-cov img.ok{opacity:1}
.man-ph{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:16px 14px 16px 20px;text-align:center;color:#f5e6c4;background:radial-gradient(ellipse at 50% 30%,#ffffff26,transparent 70%),linear-gradient(160deg,transparent 50%,#00000050)}
.man-ph::before{content:"";position:absolute;inset:9px 9px 9px 15px;border:1.5px solid #e7cf9a99;border-radius:3px}
.man-ph small{font-family:var(--display);font-size:.62rem;letter-spacing:.2em;color:#e7cf9a}
.man-ph b{font-family:var(--display);font-weight:600;font-size:.92rem;line-height:1.2;-webkit-hyphens:auto;hyphens:auto;text-shadow:0 1px 2px #0008}
.man-ph i{font-style:normal;font-size:.75rem;color:#ecdcb4}
.man-dm{position:absolute;top:10px;right:-30px;z-index:1;transform:rotate(35deg);background:var(--gold2);color:#2c0f14;font-family:var(--display);font-size:.6rem;letter-spacing:.1em;padding:3px 32px}
.man-tile b.t{font-family:var(--display);font-weight:600;color:var(--wine);font-size:.95rem;line-height:1.25}
:root[data-theme=dark] .man-tile b.t{color:var(--gold2)}
.man-tile .sub{font-size:.85rem;color:var(--mute);margin-top:-6px}
@media (max-width:620px){.man-grid{grid-template-columns:1fr 1fr;gap:18px 14px}.man-ph b{font-size:.8rem}.man-ph{padding:14px 10px 14px 16px}}
.man-full{position:fixed;left:0;right:0;z-index:30;display:flex;flex-direction:column;background:var(--bg)}
.man-bar{display:flex;align-items:center;gap:10px;padding:6px max(10px,env(safe-area-inset-left,0px));border-bottom:1px solid var(--line2);background:var(--paper)}
.man-bar b{flex:1;min-width:0;font-family:var(--display);color:var(--wine);line-height:1.2;overflow-wrap:anywhere}
@media (max-width:620px){.man-bar b{font-size:.85rem}.man-bar .btn{padding:6px 9px;font-size:.68rem}}
.man-bar .btn{white-space:nowrap}
.man-full iframe{flex:1;width:100%;border:0;background:#222}
html.man-open #tools{display:none}
.man-no{border:2px solid var(--gold2);border-radius:10px;padding:26px 24px 20px;width:min(420px,90vw);text-align:center;color:#f5e6c4;background:radial-gradient(ellipse at 50% 0%,#a7343b 0,#2c0f14 75%);box-shadow:0 20px 60px #000c}
.man-no::backdrop{background:#0a0505cc}
.man-no .ic{font-size:2rem;line-height:1;color:var(--gold2)}
.man-no h2{font-family:var(--display);color:var(--gold2)!important;font-size:1.5rem;margin:10px 0 8px}
.man-no p{margin:0 0 18px;font-size:1.05rem;line-height:1.45}
.man-no button{font-family:var(--display);letter-spacing:.06em;background:var(--gold2);color:#2c0f14;border:0;border-radius:20px;padding:10px 22px;cursor:pointer}`;
  let cssDone = false;
  const css = () => { if (cssDone) return; cssDone = true; const s = document.createElement('style'); s.textContent = CSS; document.head.append(s); };

  const anyflip = m => `<a class="btn" href="${esc(m.url)}" target="_blank" rel="noopener">Apri su AnyFlip</a>`;
  // copertina: la prima pagina del libro su AnyFlip (in italiano); se non si carica resta il riquadro col titolo italiano
  const covers = m => { const b = m.url.replace(/mobile\/index\.html$/, ''); return [b + 'files/shot.jpg', b + 'files/mobile/1.jpg']; };
  const tile = m => `<a class="man-tile" href="#/manuali/${m.id}"><div class="man-cov" style="--c:${m.col}">${m.dm ? '<span class="man-dm">SOLO DM</span>' : ''}
    <div class="man-ph"><small>DUNGEONS &amp; DRAGONS</small><b>${esc(m.title)}</b><i>${esc(m.sub)}</i></div>
    <img alt="" loading="lazy" data-src="${esc(covers(m).join(' '))}"></div><b class="t">${esc(m.title)}</b><div class="sub">${esc(m.sub)}</div></a>`;
  const nega = () => {
    const d = document.createElement('dialog'); d.className = 'man-no';
    d.innerHTML = `<div class="ic" aria-hidden="true">❦</div><h2>Come osi?!</h2><p>Solo il Dungeon Master ha il diritto di accedere alla conoscenza racchiusa in questo manuale!</p><button type="button">Chiedo perdono</button>`;
    document.body.append(d); d.querySelector('button').onclick = () => d.close(); d.onclose = () => d.remove(); d.showModal();
  };
  const loadCovers = () => $$('.man-cov img[data-src]').forEach(img => {
    const list = img.dataset.src.split(' '); let i = 0;
    img.onload = () => { if (img.naturalWidth > 40) img.classList.add('ok'); };
    img.onerror = () => { if (++i < list.length) img.src = list[i]; else img.remove(); };
    img.src = list[0];
  });

  route(/^\/manuali$/, async () => {
    await claude.use('db'); css();
    const vis = visibili(), pg = vis.filter(m => !m.dm), dm = vis.filter(m => m.dm);
    setView(`<div class="pagehead"><h1>Manuali</h1></div><div class="orn"></div>
      <div class="man-grid">${[...pg, ...dm].map(tile).join('')}</div>`);
    loadCovers();
    $$('.man-tile').forEach(a => { const m = MANUALI.find(x => a.getAttribute('href') === '#/manuali/' + x.id); if (m && vietato(m)) a.onclick = e => { e.preventDefault(); nega(); }; });
  });

  // il libro occupa esattamente lo spazio tra l'intestazione e la barra delle sezioni: niente scorrimento della pagina,
  // così il dito dentro il libro usa solo i comandi di AnyFlip
  route(/^\/manuali\/([\w-]+)$/, async ([id]) => {
    await claude.use('db'); css();
    const m = visibili().find(x => x.id === id);
    if (!m) { setView(`<div class="empty"><h2>Manuale non trovato</h2><p><a href="#/manuali">Torna ai manuali</a></p></div>`); return; }
    if (vietato(m)) { location.replace('#/manuali'); setTimeout(nega, 300); return; }
    setView(`<h1 class="sr-only" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">${esc(m.title)}</h1>
      <div class="man-full"><div class="man-bar"><b>${esc(m.title)}</b>${anyflip(m)}</div>
      <iframe src="${esc(m.url)}" title="${esc(m.title)}" allowfullscreen allow="fullscreen" referrerpolicy="no-referrer-when-downgrade"></iframe></div>`);
    const fit = () => {
      const f = $('.man-full'); if (!f) return;
      const top = $('header.top'), nav = $('#nav');
      f.style.top = (top ? top.getBoundingClientRect().bottom : 0) + 'px';
      f.style.bottom = (nav && getComputedStyle(nav).position === 'fixed' ? nav.offsetHeight : 0) + 'px';
    };
    document.documentElement.classList.add('man-open'); scrollTo(0, 0); fit();
    addEventListener('resize', fit);
    onCleanup(() => { removeEventListener('resize', fit); document.documentElement.classList.remove('man-open'); });
  });
})();

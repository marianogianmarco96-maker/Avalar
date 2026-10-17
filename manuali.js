/* Campagna D&D — «Manuali»: i manuali di gioco sfogliabili (flipbook AnyFlip) dentro il sito.
   I manuali del giocatore li vedono tutti; quelli segnati «dm» solo il Dungeon Master.
   Usa le funzioni della pagina principale (route, setView, esc…). */
(() => {
  'use strict';
  const MANUALI = [
    { id: 'giocatore', dm: false, title: 'Manuale del Giocatore', sub: 'D&D 5ª edizione', desc: 'Le regole base: creazione del personaggio, razze, classi, incantesimi, equipaggiamento e combattimento.', url: 'https://online.anyflip.com/piwcj/iafx/mobile/index.html' },
    { id: 'tasha', dm: false, title: 'Calderone Omnicomprensivo di Tasha', sub: 'Espansione per i giocatori', desc: 'Opzioni di classe aggiuntive, sottoclassi, personalizzazione delle origini, nuovi incantesimi e oggetti magici.', url: 'https://online.anyflip.com/jzhjh/dako/mobile/index.html' },
    { id: 'xanathar', dm: false, title: 'Guida Omnicomprensiva di Xanathar', sub: 'Espansione per i giocatori', desc: 'Nuove sottoclassi, talenti razziali, incantesimi e strumenti per arricchire la storia del personaggio.', url: 'https://online.anyflip.com/fqnfa/gmdk/mobile/index.html' },
    { id: 'mostri', dm: true, title: 'Manuale dei Mostri', sub: 'D&D 5ª edizione', desc: 'Le statistiche e il comportamento delle creature da mettere contro il party.', url: 'https://online.anyflip.com/fqnfa/ltch/mobile/index.html' }
  ];
  const visibili = () => MANUALI.filter(m => !m.dm || !window.__RO);

  const CSS = `.man-sec{margin:4px 0 10px;font-size:1.05rem}
.man-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px;margin-bottom:22px}
.man-card{display:flex;flex-direction:column;gap:8px;margin:0}
.man-card h2{margin:0;font-size:1.1rem}
.man-card .sub{font-size:.85rem;color:var(--mute);margin-top:-4px}
.man-card p{margin:0;flex:1}
.man-card .acts{display:flex;gap:8px;flex-wrap:wrap}
.man-view{position:relative;width:100%;height:calc(100vh - 210px);min-height:420px;border:1px solid var(--line2);border-radius:5px;overflow:hidden;background:#222;box-shadow:var(--shadow)}
.man-view iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
@media (max-width:1280px){.man-view{height:calc(100vh - 250px)}}`;
  let cssDone = false;
  const css = () => { if (cssDone) return; cssDone = true; const s = document.createElement('style'); s.textContent = CSS; document.head.append(s); };

  const card = m => `<div class="card man-card"><h2>${esc(m.title)}</h2><div class="sub">${esc(m.sub)}</div><p>${esc(m.desc)}</p>
    <div class="acts"><a class="btn primary" href="#/manuali/${m.id}">Sfoglia</a><a class="btn" href="${esc(m.url)}" target="_blank" rel="noopener">Apri in una nuova scheda</a></div></div>`;

  route(/^\/manuali$/, async () => {
    await claude.use('db'); css();
    const pg = MANUALI.filter(m => !m.dm), dm = window.__RO ? [] : MANUALI.filter(m => m.dm);
    setView(`<div class="pagehead"><h1>Manuali</h1></div><div class="orn"></div>
      <h2 class="man-sec">Per i giocatori</h2><div class="man-grid">${pg.map(card).join('')}</div>
      ${dm.length ? `<h2 class="man-sec">Solo per il Dungeon Master</h2><div class="man-grid">${dm.map(card).join('')}</div>` : ''}`);
  });

  route(/^\/manuali\/([\w-]+)$/, async ([id]) => {
    await claude.use('db'); css();
    const m = visibili().find(x => x.id === id);
    if (!m) { setView(`<div class="empty"><h2>Manuale non trovato</h2><p><a href="#/manuali">Torna ai manuali</a></p></div>`); return; }
    setView(`<div class="pagehead"><div style="flex:1"><nav class="sessnav" aria-label="Manuali"><a href="#/manuali">← Tutti i manuali</a></nav><h1>${esc(m.title)}</h1><div class="hint">${esc(m.sub)}</div></div>
      <div class="acts"><a class="btn" href="${esc(m.url)}" target="_blank" rel="noopener">Apri in una nuova scheda</a></div></div>
      <div class="man-view"><iframe src="${esc(m.url)}" title="${esc(m.title)}" allowfullscreen allow="fullscreen" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>
      <p class="hint">Se il manuale non si carica qui, usa «Apri in una nuova scheda».</p>`);
  });
})();

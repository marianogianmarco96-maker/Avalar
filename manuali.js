/* Campagna D&D — «Manuali»: i manuali di gioco sfogliabili (flipbook AnyFlip) dentro il sito.
   I manuali del giocatore li vedono tutti; quelli segnati «dm» solo il Dungeon Master.
   Usa le funzioni della pagina principale (route, setView, esc…). */
(() => {
  'use strict';
  // idx: voci dell'indice con il numero di pagina stampato sul libro; off: pagine del flipbook prima della pagina 1 stampata
  const MANUALI = [
    { id: 'giocatore', dm: false, off: 0, title: 'Manuale del Giocatore', sub: 'D&D 5ª edizione', desc: 'Le regole base: creazione del personaggio, razze, classi, incantesimi, equipaggiamento e combattimento.', url: 'https://online.anyflip.com/piwcj/iafx/mobile/index.html',
      idx: [['Introduzione', 5], ['Cap. 1 · Creare un personaggio passo per passo', 11], ['Livelli e punti esperienza', 15],
        ['Cap. 2 · Razze', 17], ['Nano', 18], ['Elfo', 21], ['Halfling', 26], ['Umano', 29], ['Dragonide', 32], ['Gnomo', 35], ['Mezzelfo', 38], ['Mezzorco', 40], ['Tiefling', 42],
        ['Cap. 3 · Classi', 45], ['Barbaro', 46], ['Bardo', 51], ['Chierico', 56], ['Druido', 64], ['Guerriero', 70], ['Monaco', 76], ['Paladino', 82], ['Ranger', 89], ['Ladro', 94], ['Stregone', 99], ['Warlock', 105], ['Mago', 112],
        ['Cap. 4 · Personalità e background', 121], ['Allineamento', 122], ['Ispirazione', 125], ['Background', 125],
        ['Cap. 5 · Equipaggiamento', 143], ['Armature e scudi', 144], ['Armi', 146], ['Equipaggiamento da avventuriero', 148], ['Strumenti', 154], ['Cavalcature e veicoli', 155], ['Merci e servizi, stile di vita', 157],
        ['Cap. 6 · Opzioni di personalizzazione', 163], ['Multiclasse', 163], ['Talenti', 165],
        ['Cap. 7 · Usare i punteggi di caratteristica', 171], ['Prove di caratteristica e abilità', 174], ['Tiri salvezza', 179],
        ['Cap. 8 · Avventura', 181], ['Viaggio e movimento', 181], ['Ambiente, luce e visione', 183], ['Riposo breve e lungo', 186],
        ['Cap. 9 · Combattimento', 189], ['Iniziativa e ordine di combattimento', 189], ['Azioni in combattimento', 192], ['Attaccare, copertura', 193], ['Danni e guarigione, morte', 196], ['Combattimento in sella e sott\'acqua', 198],
        ['Cap. 10 · Lanciare incantesimi', 201], ['Cap. 11 · Incantesimi: liste per classe', 207], ['Descrizioni degli incantesimi (A–Z)', 211],
        ['Appendice A · Condizioni', 290], ['Appendice B · Divinità del multiverso', 293], ['Appendice C · I piani di esistenza', 300], ['Appendice D · Statistiche delle creature', 304], ['Appendice E · Letture d\'ispirazione', 312]] },
    { id: 'tasha', dm: false, off: 0, title: 'Calderone Omnicomprensivo di Tasha', sub: 'Espansione per i giocatori', desc: 'Opzioni di classe aggiuntive, sottoclassi, personalizzazione delle origini, nuovi incantesimi e oggetti magici.', url: 'https://online.anyflip.com/jzhjh/dako/mobile/index.html',
      idx: [['Cap. 1 · Opzioni del personaggio', 7], ['Personalizzare l\'origine', 7], ['Artefice', 9], ['Barbaro', 24], ['Bardo', 27], ['Chierico', 30], ['Druido', 35], ['Guerriero', 41], ['Monaco', 48], ['Paladino', 52], ['Ranger', 56], ['Ladro', 62], ['Stregone', 65], ['Warlock', 70], ['Mago', 75], ['Talenti', 79],
        ['Cap. 2 · Patroni del gruppo', 85], ['Cap. 3 · Miscellanea magica', 105], ['Incantesimi', 106], ['Oggetti magici', 114], ['Cap. 4 · Strumenti del Dungeon Master', 141]] },
    { id: 'xanathar', dm: false, off: 0, title: 'Guida Omnicomprensiva di Xanathar', sub: 'Espansione per i giocatori', desc: 'Nuove sottoclassi, talenti razziali, incantesimi e strumenti per arricchire la storia del personaggio.', url: 'https://online.anyflip.com/fqnfa/gmdk/mobile/index.html',
      idx: [['Cap. 1 · Opzioni del personaggio', 7], ['Barbaro', 8], ['Bardo', 14], ['Chierico', 18], ['Druido', 22], ['Guerriero', 28], ['Monaco', 33], ['Paladino', 37], ['Ranger', 40], ['Ladro', 45], ['Stregone', 48], ['Warlock', 54], ['Mago', 59],
        ['Questa è la tua vita (origini del personaggio)', 61], ['Talenti razziali', 73],
        ['Cap. 2 · Strumenti del Dungeon Master', 77], ['Cap. 3 · Incantesimi', 147], ['Appendice A · Campagne condivise', 172], ['Appendice B · Nomi dei personaggi', 175]] },
    { id: 'mostri', dm: true, off: 0, title: 'Manuale dei Mostri', sub: 'D&D 5ª edizione', desc: 'Le statistiche e il comportamento delle creature da mettere contro il party.', url: 'https://online.anyflip.com/fqnfa/ltch/mobile/index.html',
      idx: [['Introduzione · come leggere le statistiche', 4], ['Mostri dalla A alla Z', 11], ['Appendice A · Creature varie (animali e bestie)', 317], ['Appendice B · Personaggi non giocanti', 342]] }
  ];
  const pageUrl = (m, p) => p ? `${m.url}#p=${p + m.off}` : m.url;
  const visibili = () => MANUALI.filter(m => !m.dm || !window.__RO);

  const CSS = `.man-sec{margin:4px 0 10px;font-size:1.05rem}
.man-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px;margin-bottom:22px}
.man-card{display:flex;flex-direction:column;gap:8px;margin:0}
.man-card h2{margin:0;font-size:1.1rem}
.man-card .sub{font-size:.85rem;color:var(--mute);margin-top:-4px}
.man-card p{margin:0;flex:1}
.man-card .acts{display:flex;gap:8px;flex-wrap:wrap}
.man-find{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:6px}
.man-find input{flex:1 1 220px;min-width:0;padding:9px 12px;border:1px solid var(--line2);border-radius:4px;background:var(--paper);color:var(--ink);font:inherit}
.man-find select{padding:8px;border:1px solid var(--line2);border-radius:4px;background:var(--paper);color:var(--ink);font:inherit}
.man-go{display:flex;gap:6px;align-items:center}
.man-go input{width:5.5em;padding:7px 8px;border:1px solid var(--line2);border-radius:4px;background:var(--paper);color:var(--ink);font:inherit}
.man-res{margin:6px 0 20px;padding:0;list-style:none}
.man-res li a{display:flex;gap:10px;align-items:baseline;padding:8px 10px;border-bottom:1px solid var(--line);text-decoration:none;color:var(--ink)}
.man-res li a:hover{background:var(--paper2)}
.man-res .t{flex:1}.man-res .m{font-size:.85rem;color:var(--mute)}.man-res .p{font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--wine)}
.man-idx{columns:2 260px;column-gap:24px;margin:0;padding:0;list-style:none}
.man-idx li{break-inside:avoid}
.man-idx a{display:flex;gap:8px;padding:3px 0;text-decoration:none;color:var(--ink)}
.man-idx a:hover .t{text-decoration:underline}
.man-idx .t{flex:1}.man-idx .p{color:var(--wine);font-variant-numeric:tabular-nums}
.man-idx li.ch{margin-top:6px;font-weight:600}
.man-view{position:relative;width:100%;height:calc(100vh - 210px);min-height:420px;border:1px solid var(--line2);border-radius:5px;overflow:hidden;background:#222;box-shadow:var(--shadow)}
.man-view iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
@media (max-width:1280px){.man-view{height:calc(100vh - 250px)}}`;
  let cssDone = false;
  const css = () => { if (cssDone) return; cssDone = true; const s = document.createElement('style'); s.textContent = CSS; document.head.append(s); };

  const card = m => `<div class="card man-card"><h2>${esc(m.title)}</h2><div class="sub">${esc(m.sub)}</div><p>${esc(m.desc)}</p>
    <div class="acts"><a class="btn primary" href="#/manuali/${m.id}">Sfoglia</a><a class="btn" href="${esc(m.url)}" target="_blank" rel="noopener">Apri in una nuova scheda</a></div></div>`;
  const toPage = (m, p) => `#/manuali/${m.id}?p=${p}`;
  // cerca tra le voci degli indici; un numero da solo porta a quella pagina
  function find(q, list) {
    const n = norm(q); if (!n) return [];
    if (/^\d{1,4}$/.test(n)) return list.map(m => ({ m, t: 'Vai a pagina ' + n, p: +n }));
    const words = n.split(' ');
    return list.flatMap(m => m.idx.filter(([t]) => { const x = norm(t); return words.every(w => x.includes(w)); }).map(([t, p]) => ({ m, t, p })));
  }

  route(/^\/manuali$/, async (_, q) => {
    await claude.use('db'); css();
    const vis = visibili(), pg = vis.filter(m => !m.dm), dm = vis.filter(m => m.dm);
    setView(`<div class="pagehead"><h1>Manuali</h1></div><div class="orn"></div>
      <div class="man-find" role="search"><input id="man-q" type="search" placeholder="Cerca nei manuali: un argomento (es. «talenti», «combattimento») o un numero di pagina" aria-label="Cerca nei manuali" autocomplete="off" value="${esc(q.get('q') || '')}">
        <select id="man-in" aria-label="In quale manuale"><option value="">Tutti i manuali</option>${vis.map(m => `<option value="${m.id}">${esc(m.title)}</option>`).join('')}</select></div>
      <ul class="man-res" id="man-res" aria-live="polite"></ul>
      <h2 class="man-sec">Per i giocatori</h2><div class="man-grid">${pg.map(card).join('')}</div>
      ${dm.length ? `<h2 class="man-sec">Solo per il Dungeon Master</h2><div class="man-grid">${dm.map(card).join('')}</div>` : ''}`);
    const inp = $('#man-q'), sel = $('#man-in'), out = $('#man-res');
    const show = () => {
      const list = sel.value ? vis.filter(m => m.id === sel.value) : vis, r = find(inp.value, list);
      out.innerHTML = !norm(inp.value) ? '' : r.length ? r.slice(0, 60).map(x => `<li><a href="${toPage(x.m, x.p)}"><span class="t">${esc(x.t)}</span><span class="m">${esc(x.m.title)}</span><span class="p">p. ${x.p}</span></a></li>`).join('')
        : `<li class="hint" style="padding:8px 10px">Nessuna voce trovata. Prova un'altra parola, oppure scrivi il numero di pagina.</li>`;
    };
    inp.oninput = show; sel.onchange = show; show();
    inp.onkeydown = e => { if (e.key === 'Enter') { const a = out.querySelector('a'); if (a) location.hash = a.getAttribute('href'); } };
  });

  route(/^\/manuali\/([\w-]+)$/, async ([id], q) => {
    await claude.use('db'); css();
    const m = visibili().find(x => x.id === id);
    if (!m) { setView(`<div class="empty"><h2>Manuale non trovato</h2><p><a href="#/manuali">Torna ai manuali</a></p></div>`); return; }
    const p = Math.max(0, parseInt(q.get('p'), 10) || 0), src = pageUrl(m, p);
    setView(`<div class="pagehead"><div style="flex:1"><nav class="sessnav" aria-label="Manuali"><a href="#/manuali">← Tutti i manuali</a></nav><h1>${esc(m.title)}</h1><div class="hint">${esc(m.sub)}${p ? ' · pagina ' + p : ''}</div></div>
      <div class="acts"><form class="man-go" id="man-go"><label for="man-p">Vai a pagina</label><input id="man-p" type="number" min="1" inputmode="numeric" value="${p || ''}"><button class="btn" type="submit">Vai</button></form><a class="btn" href="${esc(src)}" target="_blank" rel="noopener">Apri in una nuova scheda</a></div></div>
      <div class="man-view"><iframe src="${esc(src)}" title="${esc(m.title)}" allowfullscreen allow="fullscreen" referrerpolicy="no-referrer-when-downgrade"></iframe></div>
      <p class="hint">Se il manuale non si carica qui, usa «Apri in una nuova scheda».</p>
      <div class="card"><h2>Indice</h2><ul class="man-idx">${m.idx.map(([t, n]) => `<li class="${/^(Cap\.|Appendice)/.test(t) ? 'ch' : ''}"><a href="${toPage(m, n)}"><span class="t">${esc(t)}</span><span class="p">${n}</span></a></li>`).join('')}</ul></div>`);
    $('#man-go').onsubmit = e => { e.preventDefault(); const n = parseInt($('#man-p').value, 10); if (n > 0) location.hash = toPage(m, n); };
  });
})();

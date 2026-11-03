/* Campagna D&D — «Compendio» (prima «Manuali»): i manuali da sfogliare e le regole da consultare al volo.
   Incantesimi (SRD 5.1 + i riassunti delle espansioni da regole.js), Bestiario (solo DM, con «Metti al Tavolo»),
   condizioni, oggetti magici, equipaggiamento. Ognuno ha i suoi preferiti (in questo dispositivo).
   Espone window.__compendio per il Tavolo: testo con icone dei danni e condizioni da toccare, finestra di una condizione.
   Usa le funzioni della pagina principale (route, setView, esc, norm, toast, openDlg…). Dati: compendio.json, incantesimi.json. */
(() => {
  'use strict';
  const CSS = `
.cp-search{position:relative;margin:0 0 18px}
.cp-search input[type=search]{font-size:1.05rem;padding:11px 14px 11px 40px;border-radius:24px}
.cp-search svg{position:absolute;left:14px;top:50%;transform:translateY(-50%);width:18px;height:18px;fill:none;stroke:var(--mute);stroke-width:2;stroke-linecap:round}
.cp-res{margin:-8px 0 22px}
.cp-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;margin:0 0 26px}
.cp-tile{display:flex;gap:12px;align-items:flex-start;padding:16px;color:var(--ink);text-decoration:none!important;margin:0}
.cp-tile:hover{border-color:var(--gold)}
.cp-tile .ic{flex:none;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:var(--tc);color:#fbeccb}
:root[data-theme=dark] .cp-tile .ic{color:#16100c}
.cp-tile .ic svg,.cp-ic{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.cp-tile h3{font-size:.98rem;-webkit-hyphens:auto;hyphens:auto}
.cp-tile p{margin:2px 0 0;font-size:.95rem;color:var(--ink2);line-height:1.35}
.cp-h{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin:0 0 10px}
.cp-h .hint{flex:1;min-width:200px}
.cp-crumbs{font-family:var(--display);font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--mute);margin:0 0 8px}
.cp-crumbs a{color:var(--wine2)}
.cp-filters{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:0 0 12px}
.cp-filters input[type=search]{flex:1 1 220px;max-width:340px;width:auto}
.cp-filters select{width:auto;flex:0 1 auto}
.cp-count{font-size:.9rem;color:var(--mute);margin-left:auto}
.cp-ftog{display:none}
.cp-seg{max-width:100%;overflow-x:auto;scrollbar-width:none}
.cp-list{background:var(--paper);border:1px solid var(--line2);border-radius:5px;box-shadow:var(--shadow);overflow:hidden;margin:0 0 18px}
.cp-grp{display:flex;align-items:baseline;gap:10px;padding:10px 16px 6px;background:var(--paper2);border-bottom:1px solid var(--line);font-family:var(--display);color:var(--wine);letter-spacing:.05em;font-size:.95rem}
:root[data-theme=dark] .cp-grp{color:var(--gold2)}
.cp-grp small{font-family:var(--body);color:var(--mute);letter-spacing:0;font-size:.82rem}
.cp-row{display:flex;gap:12px;align-items:center;min-height:60px;padding:8px 16px;border-bottom:1px solid var(--line);cursor:pointer;color:var(--ink);text-decoration:none!important}
.cp-row:last-child{border-bottom:0}
.cp-row:hover{background:var(--paper2)}
.cp-row .main{flex:1;min-width:0}
.cp-row .t{font-weight:600;line-height:1.25}
.cp-row .b{color:var(--ink2);font-size:.95rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cp-row .r{flex:none;display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;max-width:240px}
.cp-num{flex:none;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;font-family:var(--display);font-size:1.02rem;color:var(--wine);border:2px solid var(--tc,var(--gold));background:var(--paper2);line-height:1}
:root[data-theme=dark] .cp-num{color:var(--gold2)}
.cp-ktl{display:inline-block;margin-right:9px;font-family:var(--display);font-size:.66rem;letter-spacing:.12em;text-transform:uppercase;color:var(--tc,var(--gold));font-weight:700;vertical-align:1px}
.cp-star{flex:none;width:36px;height:36px;display:grid;place-items:center;border-radius:50%;border:0;background:none;color:var(--line2);cursor:pointer}
.cp-star svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linejoin:round}
.cp-star:hover{color:var(--gold)}
.cp-star.on{color:var(--gold)}.cp-star.on svg{fill:currentColor}
.btn.cp-fav svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linejoin:round}
.btn.cp-fav.on{color:var(--gold);border-color:var(--gold)}.btn.cp-fav.on svg{fill:currentColor}
.cp-sc0{--tc:#2a5ea8}.cp-sc1{--tc:#a8286e}.cp-sc2{--tc:#167a85}.cp-sc3{--tc:#806b00}.cp-sc4{--tc:#7a3ea6}.cp-sc5{--tc:#a8283a}.cp-sc6{--tc:#44503f}.cp-sc7{--tc:#2e7a3c}
:root[data-theme=dark] .cp-sc0{--tc:#7aaaf0}:root[data-theme=dark] .cp-sc1{--tc:#e07ab0}:root[data-theme=dark] .cp-sc2{--tc:#5ec6cf}:root[data-theme=dark] .cp-sc3{--tc:#e8cb45}:root[data-theme=dark] .cp-sc4{--tc:#bd96e8}:root[data-theme=dark] .cp-sc5{--tc:#e8788a}:root[data-theme=dark] .cp-sc6{--tc:#a9b8a0}:root[data-theme=dark] .cp-sc7{--tc:#72c47e}
.badge.cp-b{background:var(--tc)}
.pill.cp-k{color:var(--warn);border-color:var(--warn)}
.pill.cp-r{color:#2a5ea8;border-color:#2a5ea888}
:root[data-theme=dark] .pill.cp-r{color:#7aaaf0}
.cp-statline{display:flex;flex-wrap:wrap;gap:6px 22px;justify-content:center;text-align:center;color:var(--ink2);padding:4px 0 14px;margin:0 0 4px;border-bottom:1px solid var(--line)}
.cp-statline span{display:flex;flex-direction:column;line-height:1.25}
.cp-statline em{font-style:normal;font-family:var(--display);font-size:.62rem;letter-spacing:.12em;text-transform:uppercase;color:var(--mute)}
.cp-statline b{font-weight:600;color:var(--ink)}
.cp-foot{font-size:.85rem;color:var(--mute);margin:14px 0 0}
.cp-dmg{display:inline-flex;align-items:baseline;gap:2px;color:var(--dc);font-weight:600;white-space:nowrap}
.cp-dmg svg{width:.95em;height:.95em;align-self:center;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.cp-x{background:none;border:0;padding:0;font:inherit;color:inherit;border-bottom:1px dotted var(--wine2);cursor:help}
.cp-x:hover{color:var(--wine2)}
.cp-car{display:grid;grid-template-columns:repeat(6,1fr);border:1px solid var(--line);border-radius:4px;overflow:hidden;margin:0 0 12px}
.cp-car div{text-align:center;padding:6px 2px;border-right:1px solid var(--line)}
.cp-car div:last-child{border-right:0}
.cp-car span{display:block;font-family:var(--display);font-size:.62rem;letter-spacing:.12em;color:var(--mute)}
.cp-car b{font-family:var(--display);font-size:1.1rem}
.cp-car small{color:var(--ink2);margin-left:3px}
.cp-props p{margin:2px 0}
.cp-act{margin:0 0 9px}
.cp-act>b{font-style:italic;color:var(--wine)}
:root[data-theme=dark] .cp-act>b{color:var(--gold2)}
.cp-tbl{width:100%;border-collapse:collapse;font-size:.98rem}
.cp-tbl th{font-family:var(--display);font-size:.64rem;letter-spacing:.1em;text-transform:uppercase;color:var(--mute);font-weight:600;text-align:left;padding:8px 10px;border-bottom:1px solid var(--line2);background:var(--paper2)}
.cp-tbl td{padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top}
.cp-tbl tr:last-child td{border-bottom:0}
.cp-tbl td.n{font-weight:600}
.cp-tbl .pr{font-size:.92rem;color:var(--ink2)}
.cp-tblw{overflow-x:auto}
.cp-conds{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:14px;margin:0 0 18px}
.cp-conds .card{margin:0;padding:14px 16px}
.cp-conds ul{margin:0;padding-left:1.2em;font-size:.98rem}
.cp-books{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px;margin:0 0 26px}
.cp-book{display:flex;flex-direction:column;justify-content:space-between;min-height:140px;padding:14px 16px 12px 22px;border-radius:3px 6px 6px 3px;background:linear-gradient(90deg,#0003 0,#0000 10px),var(--bc);color:#fbeccb!important;box-shadow:0 3px 10px #0004;position:relative;text-decoration:none!important}
.cp-book::after{content:"";position:absolute;inset:6px 6px 6px 14px;border:1px solid #f5e6c455;border-radius:2px;pointer-events:none}
.cp-book b{font-family:var(--display);font-size:1rem;letter-spacing:.04em;line-height:1.25}
.cp-book small{color:#ecd6a6;font-size:.88rem}
.cp-book .go{font-family:var(--display);font-size:.66rem;letter-spacing:.12em;text-transform:uppercase}
.cp-book .dm{position:absolute;top:8px;right:10px;font-family:var(--display);font-size:.58rem;letter-spacing:.1em;background:var(--gold2);color:#2c0f14;border-radius:3px;padding:1px 6px}
dialog.dlg.cp-sheet{width:min(640px,96vw)}
dialog.dlg.cp-sheet form{padding:18px 22px}
.cp-sheet .hd{display:flex;align-items:flex-start;gap:8px;margin:0 0 6px}
.cp-sheet .hd>div{flex:1;min-width:0}
.cp-sheet .hd h3{margin:4px 0 0}
.cp-meta{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.cp-stat{display:flex;gap:10px;flex-wrap:wrap;margin:4px 0 14px}
.cp-stat div{flex:1;min-width:92px;text-align:center;padding:8px 6px;border:1px solid var(--line);border-radius:4px;background:var(--paper2)}
.cp-stat b{display:block;font-family:var(--display);font-size:1.5rem;color:var(--wine);line-height:1.15}
:root[data-theme=dark] .cp-stat b{color:var(--gold2)}
.cp-stat span{display:block;font-family:var(--display);font-size:.62rem;letter-spacing:.12em;text-transform:uppercase;color:var(--mute)}
.cp-stat small{display:block;font-size:.82rem;color:var(--ink2)}
@media (max-width:620px){
  .cp-ftog{display:inline-flex}
  .cp-filters.cp-more:not(.open){display:none}
  .cp-filters input[type=search]{max-width:none}
  .cp-row{padding:8px 12px;gap:10px}
  .cp-row .r{display:none}
  .cp-car{grid-template-columns:repeat(3,1fr)}
  .cp-car div:nth-child(3){border-right:0}.cp-car div:nth-child(-n+3){border-bottom:1px solid var(--line)}
  .cp-stat div{flex:1 1 40%}
  dialog.dlg.cp-sheet{margin:auto 0 0;width:100vw;max-width:100vw;max-height:88vh;border-radius:14px 14px 0 0;border-bottom:0}
  dialog.dlg.cp-sheet form{padding:14px 16px calc(18px + env(safe-area-inset-bottom,0px))}
  dialog.dlg.cp-sheet::before{content:"";display:block;width:44px;height:4px;border-radius:2px;background:var(--line2);margin:8px auto 0}
}`;
  let cssDone = false;
  const css = () => { if (cssDone) return; cssDone = true; const s = document.createElement('style'); s.textContent = CSS; document.head.append(s); };

  /* ---------- icone disegnate per il sito ---------- */
  const I = {
    fuoco: '<path d="M12 3c1 4 5 5.5 5 10.5a5 5 0 0 1-10 0c0-2.6 1.4-3.8 2-5.3.9 1.4 1.6 2 2.6 2.1C11.7 7.7 11 5.6 12 3z"/>',
    freddo: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5"/>',
    fulmine: '<path d="M13.5 3 5.5 13.5h5.5l-1 7.5 8-10.5h-5.5z"/>',
    tuono: '<path d="M3 12h2M7.5 8.5v7M12 5v14M16.5 8.5v7M21 12h-2"/>',
    acido: '<path d="M12 3.5c3 4.5 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-6.5 6-11z"/><path d="M10 15.5a2 2 0 0 0 2 2"/>',
    veleno: '<path d="M9.5 3h5M10.5 3v6L5.3 18.6A1.6 1.6 0 0 0 6.7 21h10.6a1.6 1.6 0 0 0 1.4-2.4L13.5 9V3"/><path d="M7.5 15h9"/>',
    necrotici: '<path d="M12 3a7 7 0 0 0-7 7c0 2.6 1.3 4.2 3 5.2V19h8v-3.8c1.7-1 3-2.6 3-5.2a7 7 0 0 0-7-7z"/><circle cx="9.5" cy="10.5" r="1.3"/><circle cx="14.5" cy="10.5" r="1.3"/><path d="M11 19v-2M13 19v-2"/>',
    radiosi: '<circle cx="12" cy="12" r="3.8"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
    psichici: '<path d="M12 12a1.5 1.5 0 1 1 1.5-1.5A3.5 3.5 0 1 1 8.5 14 5.5 5.5 0 1 1 17.5 9"/>',
    forza: '<path d="M12 3l2.1 5.6 5.9.4-4.6 3.8 1.5 5.8L12 15.4l-4.9 3.2 1.5-5.8L4 9l5.9-.4z"/>',
    taglienti: '<path d="M19.5 4.5 9 15M7 13l4 4M8.5 15.5 4.5 19.5M19.5 4.5l-.5 3.5-2-1z"/>',
    perforanti: '<path d="M4 20 19 5M14 4.5h5.5V10M4 20l1-3.5M4 20l3.5-1"/>',
    contundenti: '<path d="M4.5 19.5l8-8M10 6.5l3-3 7 7-3 3z"/>',
    star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>',
    cerca: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.8-4.8"/>',
    spells: '<path d="M6 20V6a2 2 0 0 1 2-2h10v14H8a2 2 0 0 0-2 2zm0 0a2 2 0 0 0 2 2h10"/><path d="M12 7.5l.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3z"/>',
    beast: '<path d="M5 9c0-3 2-5 4-5l1 3h4l1-3c2 0 4 2 4 5 0 5-3 10-7 11-4-1-7-6-7-11z"/><path d="M9.5 12h.01M14.5 12h.01M10 16c1.3.8 2.7.8 4 0"/>',
    cond: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5M12 16h.01"/>',
    ring: '<circle cx="12" cy="14" r="6"/><path d="M9 8 12 4l3 4M10 8h4"/>',
    sword: '<path d="M14.5 4H20v5.5L9.5 20 4 14.5z"/><path d="M7 12l5 5M5 19l2-2"/>',
    tavolo: '<path d="M5 4l9.5 9.5M19 4L9.5 13.5M12.5 15.5l-2 2M11.5 15.5l2 2M4 20l3-3M20 20l-3-3"/>',
  };
  const svg = (k, cls = '') => `<svg viewBox="0 0 24 24" class="${cls}" aria-hidden="true">${I[k] || ''}</svg>`;
  const DMG = ['fuoco', 'freddo', 'fulmine', 'tuono', 'acido', 'veleno', 'necrotici', 'radiosi', 'psichici', 'forza', 'taglienti', 'perforanti', 'contundenti'];
  const DCOL = { fuoco: '#c2410c', freddo: '#2b7bb9', fulmine: '#a07c00', tuono: '#5b5fa8', acido: '#5f8a12', veleno: '#3f7d3a', necrotici: '#6b5a7e', radiosi: '#b8860b', psichici: '#a0399a', forza: '#8a3fbf', fisici: '#7a6450' };
  const DCOLD = { fuoco: '#f08a4b', freddo: '#7ec0ee', fulmine: '#f0d050', tuono: '#a7abf0', acido: '#a8d65a', veleno: '#86c27e', necrotici: '#b9aec6', radiosi: '#f4cf62', psichici: '#e08ad8', forza: '#c79af0', fisici: '#cbb69c' };
  const dcol = k => { const c = ['taglienti', 'perforanti', 'contundenti'].includes(k) ? 'fisici' : k; return (document.documentElement.dataset.theme === 'dark' ? DCOLD : DCOL)[c]; };
  const dmgTag = k => `<span class="cp-dmg" style="--dc:${dcol(k)}" title="Danni ${['fuoco', 'freddo', 'fulmine', 'tuono', 'acido', 'veleno', 'forza'].includes(k) ? 'da ' : ''}${k}">${svg(k)}${k}</span>`;
  // nel testo libero (attacchi del Tavolo, «perforanti, gittata 24/96 m»): la prima parola che è un tipo di danno prende l'icona
  const conIcone = t => esc(t).replace(new RegExp(`\\b(${DMG.join('|')})\\b`), k => dmgTag(k));

  /* ---------- dati ---------- */
  const SCUOLE = ['Abiurazione', 'Ammaliamento', 'Divinazione', 'Evocazione', 'Illusione', 'Invocazione', 'Necromanzia', 'Trasmutazione'];
  const CLASSI = { bardo: 'Bardo', chierico: 'Chierico', druido: 'Druido', mago: 'Mago', stregone: 'Stregone', warlock: 'Warlock', paladino: 'Paladino', ranger: 'Ranger', artefice: 'Artefice' };
  const FONTI = { PHB: 'Manuale del Giocatore', XGE: 'Guida di Xanathar', TCE: 'Calderone di Tasha', SCAG: 'Guida della Costa della Spada', FTD: 'Tesoro dei Draghi di Fizban', EGW: 'Guida di Wildemount', DMG: 'Guida del DM' };
  const LIV = l => l === 0 ? 'Trucchetti' : l + '° livello';
  const scI = s => Math.max(0, SCUOLE.indexOf(s));
  let D = null, P = null;
  function regole() {
    if (window.__regole) return Promise.resolve(window.__regole);
    return new Promise(ok => {
      let sc = document.querySelector('script[src="regole.js"]');
      if (!sc) { sc = document.createElement('script'); sc.src = 'regole.js'; document.head.append(sc); }
      sc.addEventListener('load', () => ok(window.__regole || null)); sc.addEventListener('error', () => ok(null));
      setTimeout(() => ok(window.__regole || null), 15000);
    });
  }
  const carica = () => P || (P = Promise.all([
    fetch('compendio.json').then(r => r.ok ? r.json() : Promise.reject(new Error('compendio.json ' + r.status))),
    fetch('incantesimi.json').then(r => r.ok ? r.json() : Promise.reject(new Error('incantesimi.json ' + r.status))),
    regole(),
  ]).then(([c, inc, R]) => {
    const cl = {};
    if (R?.liste) for (const [k, liv] of Object.entries(R.liste)) liv.forEach(l => (l || []).forEach(n => { (cl[norm(n)] = cl[norm(n)] || new Set()).add(k); }));
    const map = x => ({ n: x.nome, l: +x.livello || 0, s: x.scuola, r: !!x.rituale, t: x.tempo || '', p: x.portata || '', c: x.componenti || '', d: x.durata || '', k: !!x.conc, x: x.testo || '', fonte: x.fonte || '', riass: !!x.riassunto, cl: [...(cl[norm(x.nome)] || [])] });
    const nomi = new Set(inc.incantesimi.map(x => norm(x.nome)));
    const sp = [...inc.incantesimi.map(map), ...(R?.extraInc || []).filter(x => !nomi.has(norm(x.nome))).map(map)].sort((a, b) => a.l - b.l || a.n.localeCompare(b.n, 'it'));
    D = { ...c, sp, attr: inc.attribuzione || '' };
    D.creg = new RegExp('(^|[^\\p{L}])(' + D.condizioni.map(x => x.n.toLowerCase()).concat(['avvelenat[aoie]', 'spaventat[aoie]', 'paralizzat[aoie]', 'pron[aoie]', 'accecat[aoie]', 'affascinat[aoie]', 'afferrat[aoie]', 'trattenut[aoie]', 'stordit[aoie]', 'incapacitat[aoie]', 'assordat[aoie]', 'pietrificat[aoie]', 'invisibil[ei]', 'nascost[aoie]']).join('|') + ')(?![\\p{L}])', 'giu');
    return D;
  }).catch(e => { P = null; throw e; }));
  const condOf = w => { w = norm(w); const al = D.alias || {}; return D.condizioni.find(c => { const n = norm(c.n); return w === n || w.slice(0, -1) === n.slice(0, -1) || (n === 'invisibile' && w.startsWith('invisibil')) || (n === 'prono' && /^pron[aoie]$/.test(w)); }) || D.condizioni.find(c => c.n === al[Object.keys(al).find(k => norm(k) === w)]); };
  function rich(t, skip) {
    let h = esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    h = h.replace(new RegExp(`danni (da |)(${DMG.join('|')})\\b`, 'g'), (m, da, k) => `danni ${da}${dmgTag(k)}`);
    if (D) h = h.replace(D.creg, (m, pre, w) => { const c = condOf(w); return c && c.n !== skip ? `${pre}<button type="button" class="cp-x" data-cp-cond="${esc(c.n)}">${w}</button>` : m; });
    return h.split(/\n\n+/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
  }
  const inline = (t, skip) => rich(t, skip).replace(/^<p>|<\/p>$/g, '');

  /* ---------- chi sei e i tuoi preferiti (in questo dispositivo) ---------- */
  const dm = () => !window.__RO;
  const chi = () => dm() ? 'dm' : (window.__player?.()?.id || 'giocatore');
  const FK = () => 'cr-comp-fav-' + chi();
  const favs = () => { try { return JSON.parse(localStorage.getItem(FK())) || {}; } catch { return {}; } };
  const isFav = (k, id) => (favs()[k] || []).includes(id);
  function toggleFav(k, id) {
    const f = favs(), l = f[k] = f[k] || [], i = l.indexOf(id);
    if (i >= 0) l.splice(i, 1); else l.push(id);
    try { localStorage.setItem(FK(), JSON.stringify(f)); } catch { }
    toast(i >= 0 ? 'Tolto dai preferiti' : 'Salvato nei preferiti'); return i < 0;
  }
  const star = (k, id) => `<button type="button" class="cp-star${isFav(k, id) ? ' on' : ''}" data-cp-fav="${k}|${esc(id)}" title="${isFav(k, id) ? 'Togli dai preferiti' : 'Salva nei preferiti'}" aria-label="${isFav(k, id) ? 'Togli dai preferiti' : 'Salva nei preferiti'}" aria-pressed="${isFav(k, id)}">${svg('star')}</button>`;
  const favBtn = (k, id) => `<button type="button" class="btn cp-fav${isFav(k, id) ? ' on' : ''}" data-cp-fav="${k}|${esc(id)}" aria-pressed="${isFav(k, id)}">${svg('star')}${isFav(k, id) ? 'Nei preferiti' : 'Salva'}</button>`;

  // tocchi dentro le pagine del Compendio e nelle sue finestre (anche al Tavolo)
  document.addEventListener('click', e => {
    const f = e.target.closest('[data-cp-fav]');
    if (f) {
      e.preventDefault(); e.stopPropagation(); const [k, id] = f.dataset.cpFav.split('|'), on = toggleFav(k, id);
      document.querySelectorAll(`[data-cp-fav="${CSS_ESC(f.dataset.cpFav)}"]`).forEach(b => { b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); if (b.classList.contains('cp-fav')) b.innerHTML = svg('star') + (on ? 'Nei preferiti' : 'Salva'); });
      return;
    }
    const c = e.target.closest('[data-cp-cond]'); if (c) { e.preventDefault(); e.stopPropagation(); mostraCond(c.dataset.cpCond); return; }
    const p = e.target.closest('[data-cp-prop]'); if (p) { e.preventDefault(); e.stopPropagation(); mostraProp(p.dataset.cpProp); return; }
    const o = e.target.closest('[data-cp-open]'); if (o && !e.target.closest('a[href], button:not([data-cp-open])')) { e.preventDefault(); apri(o.dataset.cpOpen); }
  }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches?.('[data-cp-open]')) apri(e.target.dataset.cpOpen); });
  const CSS_ESC = s => window.CSS?.escape ? window.CSS.escape(s) : s.replace(/["\\]/g, '\\$&');

  /* ---------- finestre: una voce si apre senza perdere il punto nell'elenco (sul telefono sale dal basso) ---------- */
  function sheet(meta, title, body, extra = '', link = '') {
    css();
    const d = openDlg(`<form method="dialog"><div class="hd"><div><div class="cp-meta">${meta}</div><h3>${esc(title)}</h3></div>${extra}</div>${body}<menu>${link ? `<a class="btn ghost" href="${link}">Apri la pagina</a>` : ''}<button value="ok" class="btn primary">Chiudi</button></menu></form>`, 'cp-sheet');
    d.addEventListener('click', e => { if (e.target === d) d.close(); });
    const via = () => { if (d.open) d.close(); }; addEventListener('hashchange', via, { once: true }); d.addEventListener('close', () => removeEventListener('hashchange', via));
    d.querySelectorAll('a[href]').forEach(a => a.addEventListener('click', () => d.close()));
    return d;
  }
  function mostraCond(n) {
    const go = () => { const c = D.condizioni.find(x => x.n === n) || condOf(n); if (!c) return toast('Regola non trovata: ' + n); sheet('<span class="badge" style="background:var(--wine)">Condizione</span>', c.n, `<div class="prose"><ul>${c.r.map(r => `<li>${inline(r, c.n)}</li>`).join('')}</ul></div><p class="cp-foot">Regole del 2014, in breve. In caso di dubbio vale il Manuale del Giocatore.</p>`, star('cond', c.n)); };
    if (D) go(); else carica().then(go, () => toast('Non riesco a caricare le regole: controlla la connessione.', 'err'));
  }
  function mostraProp(n) {
    const p = D?.prop.find(x => x.n === n); if (!p) return;
    sheet('<span class="badge" style="background:var(--gold)">Proprietà delle armi</span>', n[0].toUpperCase() + n.slice(1), `<div class="prose"><p>${esc(p.x)}</p></div>`);
  }
  const slot = (k, v) => `<span><em>${k}</em><b>${v}</b></span>`;
  function apri(key) {
    const i = key.indexOf(':'), k = key.slice(0, i), id = key.slice(i + 1);
    if (k === 'spell') { const s = D.sp.find(x => x.n === id); if (s) sheet(spellMeta(s), s.n, spellBody(s), star('spell', s.n), '#/compendio/incantesimi/' + encodeURIComponent(s.n)); }
    if (k === 'mostro' && dm()) { const m = D.mostri.find(x => x.id === id); if (m) { const d = sheet(monMeta(m), m.nome, statblock(m), star('mostro', m.id), '#/compendio/bestiario/' + m.id); d.querySelector('menu').insertAdjacentHTML('afterbegin', `<button type="button" class="btn" data-cp-put="${m.id}">${svg('tavolo', 'cp-ic')} Metti al Tavolo</button>`); d.querySelector('[data-cp-put]').onclick = () => { d.close(); alTavolo(m); }; } }
    if (k === 'ogg') { const o = D.oggetti.find(x => x.n === id); if (o) sheet(oggMeta(o), o.n, `<div class="prose">${rich(o.x)}</div>`, star('ogg', o.n), '#/compendio/oggetti/' + encodeURIComponent(o.n)); }
    if (k === 'cond') mostraCond(id);
    if (k === 'att') { const g = D.att.find(x => x.n === id); if (g) sheet(`<span class="badge" style="background:var(--gold)">${esc(g.cat)}</span>`, g.n, `<div class="cp-statline">${slot('Costo', esc(g.c))}${slot('Peso', esc(g.w))}</div>${g.x ? `<div class="prose">${rich(g.x)}</div>` : ''}`, star('att', g.n)); }
    if (k === 'arma') { const w = D.armi.find(x => x.n === id); if (w) sheet('<span class="badge" style="background:#7a6450">Arma</span>', w.n, `<div class="cp-statline">${slot('Danni', `${esc(w.d)} ${w.t ? dmgTag(w.t) : ''}`)}${slot('Costo', esc(w.c))}${slot('Peso', esc(w.w))}</div><p>${propLinks(w.p) || 'Nessuna proprietà.'}</p>`, star('arma', w.n)); }
  }

  /* ---------- pezzi comuni ---------- */
  const crumbs = (...p) => `<div class="cp-crumbs"><a href="#/compendio">Compendio</a>${p.map(([l, h]) => ` › ${h ? `<a href="${h}">${l}</a>` : l}`).join('')}</div>`;
  const row = (key, num, ktl, sc, name, sub, right, favK, favId) => `<div class="cp-row" data-cp-open="${esc(key)}" tabindex="0" role="button">${num != null ? `<span class="cp-num ${sc}">${num}</span>` : ''}<div class="main"><div class="t">${ktl ? `<span class="cp-ktl ${sc}">${esc(ktl)}</span>` : ''}${esc(name)}</div><div class="b">${sub}</div></div><div class="r">${right || ''}</div>${star(favK, favId)}</div>`;
  const filtri = (search, more) => `<div class="cp-filters">${search}${more ? '<button type="button" class="btn sm cp-ftog" data-cp-ftog aria-expanded="false">Filtri</button>' : ''}</div>${more ? `<div class="cp-filters cp-more">${more}</div>` : ''}`;
  function attivaFiltri(stato, draw) {
    const q = $('#cp-q'); if (q) q.oninput = () => { stato.q = q.value; draw(true); };
    $$('[data-cp-f]').forEach(el => {
      const k = el.dataset.cpF;
      if (el.tagName === 'SELECT') el.onchange = () => { stato[k] = el.value; draw(); };
      else el.onclick = () => { stato[k] = el.dataset.v != null ? (stato[k] === el.dataset.v ? '' : el.dataset.v) : !stato[k]; draw(); };
    });
    const t = $('[data-cp-ftog]'); if (t) t.onclick = () => { stato.aperti = !stato.aperti; draw(); };
    if (stato.aperti) { $('.cp-more')?.classList.add('open'); t?.setAttribute('aria-expanded', 'true'); t?.classList.add('on'); }
  }
  // ridisegna solo l'elenco mentre si scrive, per non perdere il punto e la tastiera
  function ridisegna(html, soloElenco) {
    if (soloElenco && $('#cp-list')) { const n = document.createElement('div'); n.innerHTML = html; $('#cp-list').replaceWith(n.querySelector('#cp-list')); const c = n.querySelector('.cp-count'); if (c && $('.cp-count')) $('.cp-count').replaceWith(c); return; }
    setView(html);
  }
  const caricaPagina = async () => { await claude.use('db'); css(); if (!D) { setView('<p class="empty">Apro il Compendio…</p>'); await carica(); } };
  const nega = () => {
    const d = document.createElement('dialog'); d.className = 'man-no';
    d.innerHTML = `<div class="ic" aria-hidden="true">❦</div><h2>Come osi?!</h2><p>Il Bestiario è del Dungeon Master: le creature le scoprirete al Tavolo, quando ve le troverete davanti.</p><button type="button">Chiedo perdono</button>`;
    document.body.append(d); d.querySelector('button').onclick = () => d.close(); d.onclose = () => d.remove(); d.showModal();
  };

  /* ---------- copertina ---------- */
  const ST_HOME = { q: '' };
  route(/^\/compendio$/, async () => {
    await caricaPagina();
    const tile = (h, ic, col, t, p, solo) => `<a class="card cp-tile" href="#/compendio/${h}" style="--tc:${col}"><span class="ic">${svg(ic)}</span><span><h3>${t}${solo ? ' <span class="pill dm">Solo DM</span>' : ''}</h3><p>${p}</p></span></a>`;
    const MAN = window.__manuali;
    const f = favs();
    const grp = (t, items) => items.length ? `<div class="cp-grp">${t} <small>${items.length}</small></div>${items.join('')}` : '';
    const fs = [
      grp('Incantesimi', (f.spell || []).map(n => D.sp.find(x => x.n === n)).filter(Boolean).map(s => row('spell:' + s.n, s.l || 'T', s.s, 'cp-sc' + scI(s.s), s.n, `${esc(s.t.split(',')[0])} · ${esc(s.p)}`, '', 'spell', s.n))),
      dm() ? grp('Bestiario', (f.mostro || []).map(id => D.mostri.find(x => x.id === id)).filter(Boolean).map(m => row('mostro:' + m.id, esc(m.gs), m.tipo, '', m.nome, `CA ${m.ca} · ${m.pf} PF`, '', 'mostro', m.id))) : '',
      grp('Condizioni', (f.cond || []).map(n => row('cond:' + n, null, '', '', n, '', '', 'cond', n))),
      grp('Oggetti magici', (f.ogg || []).map(n => D.oggetti.find(x => x.n === n)).filter(Boolean).map(o => row('ogg:' + o.n, null, o.r, '', o.n, esc(o.t), '', 'ogg', o.n))),
      grp('Equipaggiamento', [...(f.arma || []).map(n => D.armi.find(x => x.n === n)).filter(Boolean).map(w => row('arma:' + w.n, null, 'Arma', '', w.n, `${esc(w.d)} ${w.t ? dmgTag(w.t) : ''}`, '', 'arma', w.n)), ...(f.att || []).map(n => D.att.find(x => x.n === n)).filter(Boolean).map(g => row('att:' + g.n, null, g.cat, '', g.n, esc(g.c), '', 'att', g.n))]),
    ].join('');
    const draw = solo => {
      const q = norm(ST_HOME.q);
      let res = '';
      if (q.length >= 2) {
        const hit = s => norm(s).includes(q);
        const r = [
          ...D.sp.filter(s => hit(s.n)).slice(0, 12).map(s => row('spell:' + s.n, s.l || 'T', 'Incantesimo', 'cp-sc' + scI(s.s), s.n, `${esc(s.s)} · ${esc(s.t.split(',')[0])}`, '', 'spell', s.n)),
          ...D.condizioni.filter(c => hit(c.n)).map(c => row('cond:' + c.n, null, 'Condizione', '', c.n, esc(c.r[0]), '', 'cond', c.n)),
          ...(dm() ? D.mostri.filter(m => hit(m.nome)).map(m => row('mostro:' + m.id, esc(m.gs), 'Bestiario', '', m.nome, `CA ${m.ca} · ${m.pf} PF`, '', 'mostro', m.id)) : []),
          ...D.oggetti.filter(o => hit(o.n)).map(o => row('ogg:' + o.n, null, 'Oggetto magico', '', o.n, `${esc(o.t)} · ${esc(o.r)}`, '', 'ogg', o.n)),
          ...D.armi.filter(w => hit(w.n)).map(w => row('arma:' + w.n, null, 'Arma', '', w.n, `${esc(w.d)} ${w.t ? dmgTag(w.t) : ''} · ${esc(w.c)}`, '', 'arma', w.n)),
          ...D.att.filter(g => hit(g.n)).map(g => row('att:' + g.n, null, g.cat, '', g.n, esc(g.c), '', 'att', g.n)),
        ];
        res = `<div class="cp-list cp-res" id="cp-list">${r.join('') || '<p class="empty">Niente con questo nome nel Compendio.</p>'}</div>`;
      } else res = '<div id="cp-list"></div>';
      ridisegna(`<div class="pagehead"><h1>Compendio</h1></div><div class="orn"></div>
        <div class="cp-search">${svg('cerca')}<input id="cp-q" type="search" placeholder="Cerca un incantesimo, una condizione, un oggetto…" value="${esc(ST_HOME.q)}" aria-label="Cerca nel Compendio" autocomplete="off"></div>
        ${res}
        <div class="cp-h"><h2>${dm() ? 'I preferiti del DM' : 'I tuoi preferiti'}</h2><span class="hint">Tocca la stella accanto a qualsiasi voce per ritrovarla qui.</span></div>
        ${fs ? `<div class="cp-list">${fs}</div>` : '<div class="card"><p class="hint" style="margin:0">Ancora niente. Salva l\'incantesimo che usi sempre o la condizione che non ti ricordi mai.</p></div>'}
        <h2 style="margin:22px 0 10px">Da consultare</h2>
        <div class="cp-tiles">
          ${tile('incantesimi', 'spells', '#7a3ea6', 'Incantesimi', `${D.sp.length} incantesimi, da cercare per classe, livello e scuola.`)}
          ${dm() ? tile('bestiario', 'beast', '#2e7a3c', 'Bestiario', 'Le creature da mettere contro il party, pronte per il Tavolo.', true) : ''}
          ${tile('condizioni', 'cond', '#7d2530', 'Condizioni', 'Cosa succede a chi è prono, afferrato, spaventato…')}
          ${tile('oggetti', 'ring', '#2a5ea8', 'Oggetti magici', 'Pozioni, anelli, armi e bacchette con le loro regole.')}
          ${tile('equipaggiamento', 'sword', '#7a6450', 'Equipaggiamento', 'Armi, armature e attrezzatura, con costo e peso.')}
        </div>
        <h2 style="margin:0 0 10px">Manuali da sfogliare</h2>
        ${MAN ? MAN.html() : ''}
        <p class="cp-foot">Incantesimi, condizioni ed equipaggiamento vengono dall'SRD 5.1 (regole del 2014); gli incantesimi delle espansioni sono riassunti scritti per il sito. Per il testo completo fa fede il manuale.</p>`, solo);
      const q2 = $('#cp-q'); if (q2 && !solo) q2.oninput = () => { ST_HOME.q = q2.value; draw(true); };
      if (!solo && MAN) MAN.lega($('#view'));
    };
    draw();
  });

  /* ---------- incantesimi ---------- */
  const ST_SP = { q: '', cl: '', sc: '', lv: '', k: false, r: false, aperti: false };
  const spellMeta = s => `<span class="badge cp-b cp-sc${scI(s.s)}">${esc(s.s)}</span><span class="pill">${s.l ? LIV(s.l) : 'Trucchetto'}</span>${s.k ? '<span class="pill cp-k">Concentrazione</span>' : ''}${s.r ? '<span class="pill cp-r">Rituale</span>' : ''}`;
  function spellBody(s, full) {
    const parti = s.x.split(/\n\n(?=\*\*Ai livelli superiori\.\*\*)/), mat = s.c.match(/^(.*?)\s*\((.+)\)$/), lungo = s.t.length > 24;
    return `<div class="cp-statline">${slot('Lancio', esc(lungo ? s.t.split(',')[0] : s.t) + (s.r ? ' o rituale' : ''))}${slot('Gittata', esc(s.p))}${slot('Componenti', esc(mat ? mat[1] : s.c))}${slot('Durata', esc(s.d))}</div>
      ${mat ? `<p class="hint" style="margin:8px 0 0">Componente materiale: ${esc(mat[2])}</p>` : ''}${lungo ? `<p class="hint" style="margin:4px 0 0">${esc(s.t)}</p>` : ''}
      <div class="prose">${rich(parti[0])}</div>
      ${parti[1] ? `<details class="sec" open><summary>Ai livelli superiori</summary><div class="prose">${rich(parti[1].replace(/^\*\*Ai livelli superiori\.\*\*\s*/, ''))}</div></details>` : ''}
      <details class="sec"${full ? ' open' : ''}><summary>Chi lo può imparare <span class="cnt">${s.cl.length}</span></summary><div class="chips" style="padding-bottom:8px">${s.cl.length ? s.cl.map(c => `<a class="chip" href="#/compendio/incantesimi?cl=${c}">${CLASSI[c]}</a>`).join('') : '<span class="hint">Nessuna classe base.</span>'}</div></details>
      ${s.riass ? `<p class="cp-foot">Riassunto scritto per il sito${s.fonte ? ` da: ${esc(FONTI[s.fonte] || s.fonte)}` : ''}. Per il testo completo fa fede il manuale.</p>` : full ? `<p class="cp-foot">${esc(D.attr)}</p>` : ''}`;
  }
  route(/^\/compendio\/incantesimi$/, async (_, qs) => {
    await caricaPagina();
    if (qs.get('cl')) { Object.assign(ST_SP, { q: '', cl: qs.get('cl'), sc: '', lv: '', k: false, r: false }); history.replaceState(null, '', '#/compendio/incantesimi'); }
    const draw = solo => {
      const f = ST_SP, q = norm(f.q);
      const l = D.sp.filter(s => (!q || norm(s.n).includes(q)) && (!f.cl || s.cl.includes(f.cl)) && (f.lv === '' || s.l === +f.lv) && (!f.sc || s.s === f.sc) && (!f.k || s.k) && (!f.r || s.r));
      let rows = '', last = null;
      for (const s of l) {
        if (s.l !== last) { rows += `<div class="cp-grp">${LIV(s.l)} <small>${l.filter(x => x.l === s.l).length}</small></div>`; last = s.l; }
        rows += row('spell:' + s.n, s.l || 'T', s.s, 'cp-sc' + scI(s.s), s.n, `${esc(s.t.split(',')[0])} · ${esc(s.p)} · ${esc(s.d)}`, `${s.k ? '<span class="pill cp-k">Concentrazione</span>' : ''}${s.r ? '<span class="pill cp-r">Rituale</span>' : ''}${s.riass ? `<span class="pill" title="${esc(FONTI[s.fonte] || s.fonte)}">${esc(s.fonte || 'Espansione')}</span>` : ''}`, 'spell', s.n);
      }
      const n = [f.cl, f.sc, f.lv !== '', f.k, f.r].filter(Boolean).length;
      ridisegna(`${crumbs(['Incantesimi'])}<div class="pagehead"><h1>Incantesimi</h1></div><div class="orn"></div>
        ${filtri(`<input id="cp-q" type="search" placeholder="Cerca un incantesimo…" value="${esc(f.q)}" aria-label="Cerca un incantesimo">`, `
          <select data-cp-f="cl" aria-label="Classe"><option value="">Ogni classe</option>${Object.entries(CLASSI).map(([k, v]) => `<option value="${k}"${f.cl === k ? ' selected' : ''}>${v}</option>`).join('')}</select>
          <select data-cp-f="sc" aria-label="Scuola"><option value="">Ogni scuola</option>${SCUOLE.map(s => `<option${f.sc === s ? ' selected' : ''}>${s}</option>`).join('')}</select>
          <div class="seg cp-seg" role="group" aria-label="Livello"><button type="button" data-cp-f="lv" data-v="" class="${f.lv === '' ? 'on' : ''}">Tutti</button><button type="button" data-cp-f="lv" data-v="0" class="${f.lv === '0' ? 'on' : ''}">Trucchetti</button>${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => `<button type="button" data-cp-f="lv" data-v="${i}" class="${f.lv === String(i) ? 'on' : ''}">${i}°</button>`).join('')}</div>
          <button type="button" class="chip${f.k ? ' on' : ''}" data-cp-f="k">Concentrazione</button><button type="button" class="chip${f.r ? ' on' : ''}" data-cp-f="r">Rituale</button>${n ? '<button type="button" class="btn sm ghost" data-cp-reset>Togli i filtri</button>' : ''}`)}
        <div class="cp-filters"><span class="cp-count">${l.length} su ${D.sp.length}</span></div>
        <div class="cp-list" id="cp-list">${rows || '<p class="empty">Nessun incantesimo con questi filtri.</p>'}</div>`, solo);
      if (!solo) { attivaFiltri(ST_SP, draw); const r = $('[data-cp-reset]'); if (r) r.onclick = () => { Object.assign(ST_SP, { cl: '', sc: '', lv: '', k: false, r: false }); draw(); }; if ($('[data-cp-ftog]') && n) $('[data-cp-ftog]').textContent = `Filtri (${n})`; }
    };
    draw();
  });
  route(/^\/compendio\/incantesimi\/(.+)$/, async ([nome]) => {
    await caricaPagina();
    const s = D.sp.find(x => x.n === nome);
    if (!s) { setView(`<div class="empty"><h2>Incantesimo non trovato</h2><p><a href="#/compendio/incantesimi">Torna agli incantesimi</a></p></div>`); return; }
    setView(`${crumbs(['Incantesimi', '#/compendio/incantesimi'])}<div class="pagehead"><div style="flex:1;min-width:220px"><div class="cp-meta" style="margin-bottom:6px">${spellMeta(s)}</div><h1>${esc(s.n)}</h1><div class="brief" style="font-style:italic;color:var(--ink2)">${s.l ? `${esc(s.s)} di ${s.l}° livello` : `Trucchetto di ${esc(s.s.toLowerCase())}`}</div></div><div class="acts">${favBtn('spell', s.n)}</div></div>
      <div class="orn"></div><div class="card">${spellBody(s, true)}</div>`);
  });

  /* ---------- bestiario (solo DM) ---------- */
  const GSV = g => String(g).includes('/') ? 1 / +String(g).split('/')[1] : +g;
  const modS = v => { const m = Math.floor((v - 10) / 2); return (m >= 0 ? '+' : '−') + Math.abs(m); };
  const monMeta = m => `<span class="badge" style="background:#2e7a3c">${esc(m.tipo)}</span><span class="pill">Sfida ${esc(m.gs)} · ${m.pe} PE</span><span class="pill dm">Solo DM</span>`;
  function statblock(m) {
    const prop = (k, v) => v ? `<p><b>${k}</b> ${inline(v)}</p>` : '';
    const acts = (t, arr, open = true) => arr && arr.length ? `<details class="sec"${open ? ' open' : ''}><summary>${t} <span class="cnt">${arr.length}</span></summary>${arr.map(([n, x]) => `<p class="cp-act"><b>${esc(n)}.</b> ${inline(x)}</p>`).join('')}</details>` : '';
    return `<p style="margin:0 0 10px;font-style:italic;color:var(--ink2)">${esc(m.tipo)} di taglia ${esc(m.taglia.toLowerCase())}, ${esc(m.al)}</p>
      <div class="cp-stat"><div><span>Classe armatura</span><b>${m.ca}</b><small>${esc(m.can || '')}</small></div><div><span>Punti ferita</span><b>${m.pf}</b><small>${esc(m.dv)}</small></div><div><span>Velocità</span><b style="font-size:1.1rem;padding:5px 0">${esc(m.vel)}</b></div><div><span>Sfida</span><b>${esc(m.gs)}</b><small>${m.pe} PE</small></div></div>
      <div class="cp-car">${['FOR', 'DES', 'COS', 'INT', 'SAG', 'CAR'].map((k, i) => `<div><span>${k}</span><b>${m.car[i]}</b><small>${modS(m.car[i])}</small></div>`).join('')}</div>
      <div class="cp-props">${prop('Tiri salvezza', m.ts)}${prop('Abilità', m.abil)}${prop('Resistenze', m.res)}${prop('Immunità', m.imm)}${prop('Sensi', m.sensi)}${prop('Linguaggi', m.ling)}</div>
      ${acts('Tratti', m.tratti)}${acts('Azioni', m.azioni)}${acts('Reazioni', m.reaz)}`;
  }
  // «Metti al Tavolo»: il Tavolo crea la scheda della creatura (nascosta ai giocatori) e la apre
  function alTavolo(m) {
    try { sessionStorage.setItem('cr-tv-bestiario', JSON.stringify({ nome: m.nome, dati: m.tavolo })); } catch { }
    location.hash = '#/tavolo';
  }
  const ST_MO = { q: '', tipo: '', gs: '', aperti: false };
  route(/^\/compendio\/bestiario$/, async () => {
    await caricaPagina();
    if (!dm()) { location.replace('#/compendio'); setTimeout(nega, 300); return; }
    const tipi = [...new Set(D.mostri.map(m => m.tipo))].sort();
    const draw = solo => {
      const f = ST_MO, q = norm(f.q);
      const l = D.mostri.filter(m => (!q || norm(m.nome).includes(q)) && (!f.tipo || m.tipo === f.tipo) && (!f.gs || (f.gs === 'b' ? GSV(m.gs) < 1 : f.gs === 'm' ? GSV(m.gs) >= 1 && GSV(m.gs) <= 3 : GSV(m.gs) > 3))).sort((a, b) => GSV(a.gs) - GSV(b.gs) || a.nome.localeCompare(b.nome, 'it'));
      ridisegna(`${crumbs(['Bestiario'])}<div class="pagehead"><h1>Bestiario <span class="pill dm" style="vertical-align:middle">Solo DM</span></h1></div><div class="orn"></div>
        ${filtri(`<input id="cp-q" type="search" placeholder="Cerca una creatura…" value="${esc(f.q)}" aria-label="Cerca una creatura">`, `
          <select data-cp-f="tipo" aria-label="Tipo"><option value="">Ogni tipo</option>${tipi.map(t => `<option${f.tipo === t ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>
          <div class="seg cp-seg" role="group" aria-label="Sfida"><button type="button" data-cp-f="gs" data-v="" class="${!f.gs ? 'on' : ''}">Ogni sfida</button><button type="button" data-cp-f="gs" data-v="b" class="${f.gs === 'b' ? 'on' : ''}">Sotto 1</button><button type="button" data-cp-f="gs" data-v="m" class="${f.gs === 'm' ? 'on' : ''}">Da 1 a 3</button><button type="button" data-cp-f="gs" data-v="a" class="${f.gs === 'a' ? 'on' : ''}">Oltre 3</button></div>`)}
        <div class="cp-filters"><span class="cp-count">${l.length} creature</span></div>
        <div class="cp-list" id="cp-list">${l.map(m => row('mostro:' + m.id, esc(m.gs), m.tipo, '', m.nome, `CA ${m.ca} · ${m.pf} PF · ${esc(m.vel)}`, `<span class="pill">${m.pe} PE</span>`, 'mostro', m.id)).join('') || '<p class="empty">Nessuna creatura con questi filtri.</p>'}</div>
        <p class="cp-foot">Dall'SRD 5.1 (regole del 2014), in breve. «Metti al Tavolo» crea la scheda della creatura, nascosta ai giocatori finché non la mostri.</p>`, solo);
      if (!solo) attivaFiltri(ST_MO, draw);
    };
    draw();
  });
  route(/^\/compendio\/bestiario\/([\w-]+)$/, async ([id]) => {
    await caricaPagina();
    if (!dm()) { location.replace('#/compendio'); setTimeout(nega, 300); return; }
    const m = D.mostri.find(x => x.id === id);
    if (!m) { setView(`<div class="empty"><h2>Creatura non trovata</h2><p><a href="#/compendio/bestiario">Torna al Bestiario</a></p></div>`); return; }
    setView(`${crumbs(['Bestiario', '#/compendio/bestiario'])}<div class="pagehead"><div style="flex:1;min-width:220px"><div class="cp-meta" style="margin-bottom:6px">${monMeta(m)}</div><h1>${esc(m.nome)}</h1></div>
      <div class="acts"><button type="button" class="btn primary" id="cp-put">${svg('tavolo', 'cp-ic')} Metti al Tavolo</button>${favBtn('mostro', m.id)}</div></div>
      <div class="orn"></div><div class="card">${statblock(m)}</div>`);
    $('#cp-put').onclick = () => alTavolo(m);
  });

  /* ---------- condizioni ---------- */
  const ST_CO = { q: '' };
  route(/^\/compendio\/condizioni$/, async () => {
    await caricaPagina();
    const draw = solo => {
      const q = norm(ST_CO.q), l = D.condizioni.filter(c => !q || norm(c.n).includes(q) || c.r.some(r => norm(r).includes(q)));
      ridisegna(`${crumbs(['Condizioni'])}<div class="pagehead"><h1>Condizioni</h1></div><div class="orn"></div>
        <p class="hint" style="margin:-6px 0 14px">Al Tavolo basta toccare una condizione su un token o su una scheda per leggere questo stesso testo.</p>
        ${filtri(`<input id="cp-q" type="search" placeholder="Cerca, anche dentro il testo…" value="${esc(ST_CO.q)}" aria-label="Cerca una condizione">`)}
        <div class="cp-conds" id="cp-list">${l.map(c => `<div class="card"><div class="spread" style="margin:0 0 4px"><h3>${esc(c.n)}</h3>${star('cond', c.n)}</div><div class="prose"><ul>${c.r.map(r => `<li>${inline(r, c.n)}</li>`).join('')}</ul></div></div>`).join('') || '<p class="empty">Nessuna condizione trovata.</p>'}</div>
        <p class="cp-foot">Regole del 2014, in breve. In caso di dubbio vale il Manuale del Giocatore.</p>`, solo);
      if (!solo) attivaFiltri(ST_CO, draw);
    };
    draw();
  });

  /* ---------- oggetti magici ---------- */
  const RAR = r => ({ 'Comune': '#8a7560', 'Non comune': '#2e7a3c', 'Raro': '#2a5ea8', 'Rara': '#2a5ea8', 'Molto raro': '#7a3ea6', 'Molto rara': '#7a3ea6', 'Leggendario': '#a8641c', 'Leggendaria': '#a8641c' }[r] || '#a98334');
  const oggMeta = o => `<span class="badge" style="background:${RAR(o.r)}">${esc(o.r)}</span><span class="pill">${esc(o.t)}</span>${o.s ? '<span class="pill cp-k">Richiede sintonia</span>' : ''}`;
  const ST_OG = { q: '', rar: '', sint: false, aperti: false };
  route(/^\/compendio\/oggetti$/, async () => {
    await caricaPagina();
    const draw = solo => {
      const f = ST_OG, q = norm(f.q), l = D.oggetti.filter(o => (!q || norm(o.n).includes(q)) && (!f.rar || norm(o.r).startsWith(norm(f.rar))) && (!f.sint || o.s));
      ridisegna(`${crumbs(['Oggetti magici'])}<div class="pagehead"><h1>Oggetti magici</h1></div><div class="orn"></div>
        ${filtri(`<input id="cp-q" type="search" placeholder="Cerca un oggetto…" value="${esc(f.q)}" aria-label="Cerca un oggetto">`, `<select data-cp-f="rar" aria-label="Rarità"><option value="">Ogni rarità</option>${[['Comune', 'Comune'], ['Non comune', 'Non comune'], ['Rar', 'Raro'], ['Molto rar', 'Molto raro'], ['Leggendari', 'Leggendario']].map(([v, t]) => `<option value="${v}"${f.rar === v ? ' selected' : ''}>${t}</option>`).join('')}</select><button type="button" class="chip${f.sint ? ' on' : ''}" data-cp-f="sint">Richiede sintonia</button>`)}
        <div class="cp-filters"><span class="cp-count">${l.length} oggetti</span></div>
        <div class="cp-list" id="cp-list">${l.map(o => row('ogg:' + o.n, null, o.r, '', o.n, esc(o.t), o.s ? '<span class="pill cp-k">Sintonia</span>' : '', 'ogg', o.n).replace('class="cp-ktl ', `style="--tc:${RAR(o.r)}" class="cp-ktl `)).join('') || '<p class="empty">Nessun oggetto con questi filtri.</p>'}</div>
        <p class="cp-foot">Dall'SRD 5.1, in breve. Per ora una scelta dei più comuni.</p>`, solo);
      if (!solo) attivaFiltri(ST_OG, draw);
    };
    draw();
  });
  route(/^\/compendio\/oggetti\/(.+)$/, async ([nome]) => {
    await caricaPagina();
    const o = D.oggetti.find(x => x.n === nome);
    if (!o) { setView(`<div class="empty"><h2>Oggetto non trovato</h2><p><a href="#/compendio/oggetti">Torna agli oggetti</a></p></div>`); return; }
    setView(`${crumbs(['Oggetti magici', '#/compendio/oggetti'])}<div class="pagehead"><div style="flex:1;min-width:220px"><div class="cp-meta" style="margin-bottom:6px">${oggMeta(o)}</div><h1>${esc(o.n)}</h1></div><div class="acts">${favBtn('ogg', o.n)}</div></div>
      <div class="orn"></div><div class="card"><div class="prose">${rich(o.x)}</div></div>`);
  });

  /* ---------- equipaggiamento ---------- */
  const propLinks = p => p ? p.split(/,\s*/).map(x => { const k = D.prop.find(pp => x.startsWith(pp.n)); return k ? `<button type="button" class="cp-x" data-cp-prop="${k.n}">${esc(x)}</button>` : esc(x); }).join(', ') : '';
  const ST_EQ = { q: '', t: 'armi', cat: '' };
  route(/^\/compendio\/equipaggiamento$/, async () => {
    await caricaPagina();
    const draw = solo => {
      const f = ST_EQ, q = norm(f.q);
      let body = '';
      if (f.t === 'armi') {
        const G = [['Armi semplici da mischia', w => w.cat === 'semplice' && !w.dist], ['Armi semplici a distanza', w => w.cat === 'semplice' && w.dist], ['Armi da guerra da mischia', w => w.cat === 'guerra' && !w.dist], ['Armi da guerra a distanza', w => w.cat === 'guerra' && w.dist]];
        body = G.map(([t, fn]) => { const l = D.armi.filter(w => fn(w) && (!q || norm(w.n).includes(q))); return l.length ? `<div class="card" style="padding:6px 8px"><h3 style="padding:8px 10px 4px">${t}</h3><div class="cp-tblw"><table class="cp-tbl"><thead><tr><th>Arma</th><th>Danni</th><th>Proprietà</th><th>Costo</th><th>Peso</th><th></th></tr></thead><tbody>${l.map(w => `<tr><td class="n">${esc(w.n)}</td><td style="white-space:nowrap">${esc(w.d)} ${w.t ? dmgTag(w.t) : ''}</td><td class="pr">${propLinks(w.p) || '—'}</td><td>${esc(w.c)}</td><td>${esc(w.w)}</td><td>${star('arma', w.n)}</td></tr>`).join('')}</tbody></table></div></div>` : ''; }).join('');
        body = `<div id="cp-list">${body || '<p class="empty">Nessuna arma con questo nome.</p>'}<p class="cp-foot">Tocca una proprietà, per esempio <button type="button" class="cp-x" data-cp-prop="accurata">accurata</button>, per leggere cosa significa.</p></div>`;
      } else if (f.t === 'armature') {
        const G = [['Armature leggere', 'leggera', 'Indossarla richiede 1 minuto, toglierla altrettanto.'], ['Armature medie', 'media', 'Indossarla richiede 5 minuti, toglierla 1.'], ['Armature pesanti', 'pesante', 'Indossarla richiede 10 minuti, toglierla 5.'], ['Scudi', 'scudo', 'Si imbraccia o si posa con 1 azione.']];
        body = `<div id="cp-list">${G.map(([t, k, h]) => { const l = D.armature.filter(a => a.tipo === k && (!q || norm(a.n).includes(q))); return l.length ? `<div class="card" style="padding:6px 8px"><h3 style="padding:8px 10px 0">${t}</h3><p class="hint" style="margin:0 10px 6px">${h}</p><div class="cp-tblw"><table class="cp-tbl"><thead><tr><th>Armatura</th><th>Classe armatura</th><th>Note</th><th>Costo</th><th>Peso</th></tr></thead><tbody>${l.map(a => `<tr><td class="n">${esc(a.n)}</td><td>${esc(a.ca)}</td><td class="pr">${[a.f && `serve ${a.f}`, a.furt && 'svantaggio a Furtività'].filter(Boolean).join(', ') || '—'}</td><td>${esc(a.c)}</td><td>${esc(a.w)}</td></tr>`).join('')}</tbody></table></div></div>` : ''; }).join('') || '<p class="empty">Nessuna armatura con questo nome.</p>'}</div>`;
      } else {
        const cats = [...new Set(D.att.map(g => g.cat))];
        const l = D.att.filter(g => (!q || norm(g.n).includes(q) || norm(g.x).includes(q)) && (!f.cat || g.cat === f.cat));
        body = `<div class="cp-filters"><div class="seg cp-seg" role="group" aria-label="Categoria"><button type="button" data-cp-f="cat" data-v="" class="${!f.cat ? 'on' : ''}">Tutto</button>${cats.map(c => `<button type="button" data-cp-f="cat" data-v="${c}" class="${f.cat === c ? 'on' : ''}">${c}</button>`).join('')}</div></div>
          <div class="cp-list" id="cp-list">${l.map(g => row('att:' + g.n, null, g.cat, '', g.n, g.x ? inline(g.x) : '&nbsp;', `<span class="pill">${esc(g.c)}</span>`, 'att', g.n)).join('') || '<p class="empty">Niente con questo nome.</p>'}</div>`;
      }
      ridisegna(`${crumbs(['Equipaggiamento'])}<div class="pagehead"><h1>Equipaggiamento</h1></div><div class="orn"></div>
        <p class="hint" style="margin:-6px 0 14px">I costi sono in monete d'oro (mo), d'argento (ma) e di rame (mr).</p>
        <div class="cp-filters"><div class="seg" role="tablist">${[['armi', 'Armi'], ['armature', 'Armature'], ['att', 'Attrezzatura']].map(([k, t]) => `<button type="button" role="tab" aria-selected="${f.t === k}" data-cp-tab="${k}" class="${f.t === k ? 'on' : ''}">${t}</button>`).join('')}</div><input id="cp-q" type="search" placeholder="Cerca…" value="${esc(f.q)}" aria-label="Cerca nell'equipaggiamento"></div>${body}`, solo);
      if (!solo) { attivaFiltri(ST_EQ, draw); $$('[data-cp-tab]').forEach(b => b.onclick = () => { ST_EQ.t = b.dataset.cpTab; ST_EQ.q = ''; ST_EQ.cat = ''; draw(); }); }
    };
    draw();
  });

  // il vecchio indirizzo dei manuali porta al Compendio (i manuali sono lì dentro)
  route(/^\/manuali$/, async () => { location.replace('#/compendio'); });

  // se il sito ha già provato ad aprire una pagina del Compendio prima che questo file fosse caricato, la riapre
  if (/^#\/(compendio|manuali$)/.test(location.hash) && /non trovata/i.test(document.querySelector('#view .empty h2')?.textContent || '')) navigate();

  window.__compendio = { carica, rich: t => (D ? rich(t) : esc(t)), conIcone, dmgTag, condizione: mostraCond, css };
})();

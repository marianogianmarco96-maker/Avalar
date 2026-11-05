/* Campagna D&D — «Bottino pronto»: oggetti e dispense (lettere, documenti, mappe) che il DM prepara prima della partita
   e consegna al Tavolo ai giocatori. Solo il DM vede la pagina (#/bottino) e prepara le voci, anche dalle idee di Claude
   («Prepara per la partita» nella pagina Idee). Ogni voce sta nei dati del DM (meta «bottino:<id>»): copie.js e
   pubblica.py la tolgono dalle copie dei giocatori. Al Tavolo (tavolo.js) la consegna passa da Supabase
   (tavolo/tappa-20.sql) e porta solo ciò che vede il giocatore, mai «La verità (solo DM)».
   Quando un oggetto viene consegnato, la sua scheda nel sito diventa visibile a chi l'ha ricevuto (dopo «Salva»).
   Le carte (carta, mostra) servono anche ai giocatori, per vedere ciò che ricevono.
   Usa le funzioni della pagina principale (route, setView, S, md…). */
(() => {
  'use strict';
  const TIPI = {
    oggetto: ['🗡', 'Oggetto', 'Arma, armatura, oggetto magico: va nell\'equipaggiamento della scheda'],
    lettera: ['✉', 'Lettera', 'Manoscritta, con la firma'],
    documento: ['📜', 'Documento', 'Decreto, contratto, avviso: con il sigillo'],
    mappa: ['🗺', 'Mappa', 'Un\'immagine con qualche riga di testo']
  };
  const CSS = `.bt-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px}
.bt-it{all:unset;box-sizing:border-box;cursor:pointer;display:flex;flex-direction:column;gap:6px;background:var(--paper);border:1px solid var(--line2);border-radius:8px;padding:12px 14px;box-shadow:var(--shadow);min-width:0}
.bt-it:hover{border-color:var(--gold)}.bt-it:focus-visible{outline:2px solid var(--gold)}
.bt-it .t{display:flex;gap:8px;align-items:baseline}.bt-it .t b{flex:1;font:600 1.05rem/1.25 var(--display);color:var(--wine);min-width:0;overflow-wrap:anywhere}
.bt-it .s{color:var(--mute);font-size:.92rem;line-height:1.3}
.bt-it .st{align-self:flex-start;font-size:.78rem;padding:1px 9px;border-radius:10px;border:1px solid var(--line2);color:var(--mute)}
.bt-it .st.ok{color:var(--ok);border-color:var(--ok)}
.bt-it.fatto{opacity:.72}
.bt-sez{font:600 .75rem/1 var(--display);letter-spacing:.12em;text-transform:uppercase;color:var(--gold);margin:22px 0 10px}
.bt-vuoto{text-align:center;padding:30px 10px;color:var(--mute)}
.bt-ed{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px;align-items:start}
.bt-ed .anteprima{position:sticky;top:0;background:#2b211c;border-radius:8px;padding:18px;min-height:220px;display:flex;align-items:center;justify-content:center}
.bt-ed .anteprima small{display:block;color:#c9b89a;text-align:center;margin-top:8px}
.bt-ed .riga{display:flex;gap:10px}.bt-ed .riga>*{flex:1;min-width:0}
.bt-ed input[type=file]{display:block;margin:4px 0}.bt-ed .f small.hint{display:block}
.bt-ed .f.dm>span::after{content:" · solo tu";color:var(--wine);font-weight:600}
.bt-ed .f.dm textarea{background:#f6e3e0}
:root[data-theme=dark] .bt-ed .f.dm textarea{background:#3a2526}
dialog.dlg.bt-dlg{width:min(980px,96vw);box-sizing:border-box;max-width:96vw}.bt-ed>*{min-width:0}
@media (max-width:760px){.bt-ed{grid-template-columns:1fr}.bt-ed .anteprima{position:static;order:-1}}
.bt-imp label{display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-top:1px solid var(--line)}
.bt-imp label:first-child{border-top:0}.bt-imp label b{color:var(--wine)}
.bt-imp small{display:block;color:var(--mute)}
/* le carte: le stesse per il DM (anteprima) e per i giocatori */
.bt-carta{--carta:#f3e6c4;box-sizing:border-box;position:relative;width:min(520px,100%);color:#2b1d14;background:radial-gradient(ellipse at 30% 20%,#fbf3dc,transparent 60%),radial-gradient(ellipse at 80% 90%,#e2cfa0,transparent 55%),var(--carta);border-radius:3px;padding:26px 30px 24px;box-shadow:0 1px 0 #fff8 inset,0 14px 40px #000a,0 2px 6px #0006;text-align:left;font:400 1.08rem/1.5 var(--body)}
.bt-carta h4{margin:0 0 2px;font:600 1.3rem/1.2 var(--display);color:#5a1a22;letter-spacing:.03em}
.bt-carta .sotto{font-style:italic;color:#6b5434;margin-bottom:10px;font-size:.98rem}
.bt-carta .prose{color:#2b1d14}.bt-carta .prose p{margin:.5em 0}.bt-carta .prose>:first-child{margin-top:0}.bt-carta .prose>:last-child{margin-bottom:0}
.bt-carta .prose a{color:#5a1a22}
.bt-carta.lettera{transform:rotate(-1.2deg);padding:30px 34px}
.bt-carta.lettera .prose{font:500 1.45rem/1.45 'Dancing Script','Segoe Script','Brush Script MT',cursive}
.bt-carta.lettera .firma{font:600 1.6rem/1 'Dancing Script','Segoe Script','Brush Script MT',cursive;text-align:right;margin-top:10px}
.bt-carta.documento{--carta:#efe2bf;border:1px solid #b9a06d;outline:3px double #b9a06d;outline-offset:-10px;padding:34px 36px 64px;text-align:center}
.bt-carta.documento h4{text-transform:uppercase;letter-spacing:.12em}
.bt-carta.documento .prose{text-align:left}
.bt-carta.documento .sigillo{position:absolute;right:26px;bottom:14px;width:58px;height:58px;border-radius:50%;background:radial-gradient(circle at 38% 35%,#c4453f,#7d1a1d 70%);box-shadow:0 2px 4px #0007,inset 0 0 0 4px #9a2a28;display:flex;align-items:center;justify-content:center;color:#f2c5b0;font:700 1.3rem/1 var(--display)}
.bt-carta.mappa{padding:14px 14px 16px;--carta:#e9dab4}
.bt-carta.mappa img{display:block;width:100%;border-radius:2px;box-shadow:0 0 0 1px #0004}
.bt-carta.mappa h4{margin-top:10px}
.bt-carta.oggetto{background:#fbf5e3;border:2px solid #b0802a;border-radius:10px;box-shadow:0 0 0 4px #fbf5e3,0 0 0 5px #b0802a88,0 14px 40px #000a}
.bt-carta.oggetto .ico{float:right;font-size:2rem;line-height:1;margin:-4px -6px 0 10px}
.bt-carta.oggetto img{float:right;width:96px;height:96px;object-fit:cover;border-radius:8px;margin:0 0 8px 12px;box-shadow:0 0 0 1px #b0802a}
.bt-carta .car{clear:both;display:flex;gap:6px;align-items:center;margin-top:12px;padding-top:10px;border-top:1px solid #d8c393;font-size:.95rem;color:#6b5434}
.bt-carta .car i{width:13px;height:13px;border-radius:50%;background:#b0802a;box-shadow:0 0 0 1px #6b4d12 inset;display:inline-block}
.bt-carta .car span{margin-left:6px}
.bt-ov{position:fixed;inset:0;z-index:80;background:#0d0907d9;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:20px 16px;box-sizing:border-box;overflow-y:auto;animation:btOv .25s ease-out}
.bt-ov .ban{background:var(--wine,#7d2530);color:#fff;border:1px solid #e7cf9a88;border-radius:20px;padding:6px 16px;font:600 .95rem/1.25 var(--body);box-shadow:0 4px 14px #0008;text-align:center;max-width:100%}
.bt-ov .bt-carta{animation:btApri .7s cubic-bezier(.2,.8,.2,1) both;max-height:none}
.bt-ov .az{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}
.bt-ov .az .btn{background:#fbf5e3;color:#2b1d14}
.bt-ov .az .btn.primary{background:linear-gradient(#e2c071,#b8913a);color:#2b1d14;border-color:#8a6a24}
@keyframes btOv{from{opacity:0}to{opacity:1}}
@keyframes btApri{0%{transform:scaleY(.04) translateY(-30px);opacity:0}40%{opacity:1}100%{transform:none}}
@media (prefers-reduced-motion:reduce){.bt-ov,.bt-ov .bt-carta{animation:none}}
/* al Tavolo: la consegna del DM e i «Ricevuti» del giocatore */
dialog.dlg.tv-cons{width:min(1000px,96vw);box-sizing:border-box;max-width:96vw}
.tvc-h{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.tvc{display:grid;grid-template-columns:310px minmax(0,1fr);border-radius:8px;overflow:hidden;border:1px solid var(--line2)}
.tvc .sx{padding:14px;background:var(--paper);display:flex;flex-direction:column;gap:8px;max-height:74vh;overflow:auto}
.tvc h6{font:600 .72rem/1 var(--display);letter-spacing:.12em;text-transform:uppercase;color:var(--mute);margin:8px 0 0}
.tvc .lst{display:flex;flex-direction:column;gap:6px}
.tvc .vc{all:unset;box-sizing:border-box;display:flex;gap:8px;align-items:flex-start;padding:8px 10px;border:1px solid var(--line2);border-radius:6px;cursor:pointer;background:var(--paper2)}
.tvc .vc.on{border-color:var(--wine);box-shadow:inset 0 0 0 1px var(--wine)}
.tvc .vc.fatto{opacity:.7}
.tvc .vc .n{display:flex;flex-direction:column;min-width:0}.tvc .vc small,.tvc .modo small{color:var(--mute);font-size:.82rem;line-height:1.3}
.tvc .chi{display:flex;flex-wrap:wrap;gap:8px}
.tvc .chi button{all:unset;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:3px;width:58px;font-size:.82rem;color:var(--mute);opacity:.6;text-align:center}
.tvc .chi button.on{opacity:1;color:var(--ink);font-weight:600}
.tvc .chi img,.tvc .chi i{width:44px;height:44px;border-radius:50%;object-fit:cover;box-shadow:0 0 0 2px var(--line2);display:flex;align-items:center;justify-content:center;font-style:normal;background:var(--paper2);font-weight:700}
.tvc .chi button.on img,.tvc .chi button.on i{box-shadow:0 0 0 3px var(--wine)}
.tvc .modo{display:flex;flex-direction:column;gap:6px}
.tvc .modo button{all:unset;box-sizing:border-box;cursor:pointer;padding:8px 10px;border:1px solid var(--line2);border-radius:6px;display:flex;flex-direction:column}
.tvc .modo button.on{border-color:var(--wine);background:#7d25300f;box-shadow:inset 0 0 0 1px var(--wine)}
.tvc [data-ok]{margin-top:6px}
.tvc .dx{background:#2b211c;padding:24px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;min-height:380px}
.tvc .ver{width:min(520px,100%);background:#3a2526;color:#f3d9d4;border-radius:6px;padding:8px 12px;box-sizing:border-box}
.tvc .ver summary{cursor:pointer;font-weight:600}.tvc .ver .prose{color:#f3d9d4}
.tvc .pie{display:flex;gap:10px;align-items:center;width:min(520px,100%)}.tvc .pie small{color:#c9b89a;line-height:1.3}
.tvc .pie .btn{background:#fbf5e3;color:#2b1d14;flex:none}
@media (max-width:760px){.tvc{grid-template-columns:1fr}.tvc .dx{order:-1;min-height:0;padding:16px}.tvc .sx{max-height:none}}
.tv-ric{display:flex;flex-direction:column;gap:6px;max-height:60vh;overflow:auto}
.tv-ric button{all:unset;box-sizing:border-box;cursor:pointer;display:grid;grid-template-columns:auto 1fr;column-gap:10px;padding:8px 10px;border:1px solid var(--line2);border-radius:6px}
.tv-ric button:hover{border-color:var(--gold)}.tv-ric button small{grid-column:2;color:var(--mute)}`;
  let cssDone = false;
  const css = () => {
    if (cssDone) return; cssDone = true;
    const s = document.createElement('style'); s.textContent = CSS; document.head.append(s);
    // la calligrafia delle lettere
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=Dancing+Script:wght@500;600&display=swap'; document.head.append(l);
  };

  const KEY = id => 'bottino:' + id;
  const tutte = () => Object.entries(S.meta).filter(([k]) => k.startsWith('bottino:')).map(([, v]) => v).filter(v => v && v.id)
    .sort((a, b) => (a.consegne?.length ? 1 : 0) - (b.consegne?.length ? 1 : 0) || (b.creato || 0) - (a.creato || 0));
  const una = id => S.meta[KEY(id)] || null;
  const nuovoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const salva = v => window.__cronache.runBatch(['meta'], '', b => b.put('meta', { k: KEY(v.id), v: { ...v, agg: Date.now() } }));
  const nomeG = id => (PLAYERS().find(p => p[0] === id) || [id, id])[1];
  const nomiA = a => !a ? 'tutti' : a.map(nomeG).join(', ');
  const quando = t => new Date(t).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
  const stato = v => {
    const c = v.consegne || []; if (!c.length) return ['', 'Da consegnare'];
    const u = c[c.length - 1]; return ['ok', `Consegnato a ${nomiA(u.a)} · ${quando(u.t)}${c.length > 1 ? ` (${c.length} volte)` : ''}`];
  };
  // ciò che vede il giocatore: mai la verità del DM
  const perGiocatore = v => ({ tipo: v.tipo, nome: v.nome, sotto: v.sotto || '', testo: v.testo || '', firma: v.firma || '', immagine: v.immagine || '', cariche: +v.cariche || 0, ricarica: v.ricarica || '' });

  /* ---------- le carte ---------- */
  function carta(c) {
    css();
    const t = TIPI[c.tipo] ? c.tipo : 'oggetto', testo = c.testo ? `<div class="prose">${md(c.testo)}</div>` : '';
    const max = +c.cariche || 0, usate = Math.min(max, +c.usate || 0);
    const car = max ? `<div class="car">${Array.from({ length: Math.min(max, 12) }, (_, i) => `<i style="${i < max - usate ? '' : 'opacity:.25'}"></i>`).join('')}<span>${max - usate}/${max} cariche${c.ricarica ? ' · ' + esc(c.ricarica) : ''}</span></div>` : '';
    const img = c.immagine ? `<img alt="" src="${esc(c.immagine)}">` : '';
    if (t === 'lettera') return `<div class="bt-carta lettera">${testo || '<div class="prose"><p>…</p></div>'}${c.firma ? `<div class="firma">— ${esc(c.firma)}</div>` : ''}</div>`;
    if (t === 'documento') return `<div class="bt-carta documento"><h4>${esc(c.nome)}</h4>${c.sotto ? `<div class="sotto">${esc(c.sotto)}</div>` : ''}${testo}<div class="sigillo" aria-hidden="true">${esc((c.firma || c.nome || '?').trim()[0] || '?').toUpperCase()}</div></div>`;
    if (t === 'mappa') return `<div class="bt-carta mappa">${img}<h4>${esc(c.nome)}</h4>${c.sotto ? `<div class="sotto">${esc(c.sotto)}</div>` : ''}${testo}</div>`;
    return `<div class="bt-carta oggetto">${img || '<span class="ico" aria-hidden="true">🗡</span>'}<h4>${esc(c.nome)}</h4>${c.sotto ? `<div class="sotto">${esc(c.sotto)}</div>` : ''}${testo}${car}</div>`;
  }
  // a tutto schermo, con un'animazione da pergamena che si srotola. azioni: [[etichetta, funzione, primario]]
  function mostra(c, { titolo = '', azioni = [] } = {}) {
    css();
    document.querySelectorAll('.bt-ov').forEach(x => x.remove());
    const o = document.createElement('div'); o.className = 'bt-ov'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-label', c.nome || 'Consegna');
    const az = azioni.length ? azioni : [['Chiudi', null, true]];
    o.innerHTML = `${titolo ? `<div class="ban">${esc(titolo)}</div>` : ''}${carta(c)}<div class="az">${az.map(([l, , p], i) => `<button type="button" class="btn ${p ? 'primary' : ''}" data-i="${i}">${esc(l)}</button>`).join('')}</div>`;
    document.body.append(o);
    const chiudi = () => { o.remove(); removeEventListener('keydown', tasto); };
    const tasto = e => { if (e.key === 'Escape') chiudi(); };
    addEventListener('keydown', tasto);
    o.addEventListener('click', async e => {
      const b = e.target.closest('[data-i]'); if (!b) { if (e.target === o) chiudi(); return; }
      const f = az[+b.dataset.i][1]; if (f) { b.disabled = true; try { if (await f() === false) { b.disabled = false; return; } } catch (err) { b.disabled = false; toast(err.message || String(err), 'err'); return; } }
      chiudi();
    });
    o.querySelector('.az .btn.primary, .az .btn')?.focus();
    return { chiudi, el: o };
  }

  /* ---------- dalle idee di Claude ---------- */
  function daMarkdown(t) {
    const out = [], pg = [...S.ents.values()].filter(e => e.type === 'pg');
    for (const b of String(t || '').split(/^##\s+/m).slice(1)) {
      const [riga, ...resto] = b.split('\n'), corpo = resto.join('\n'), nome = riga.replace(/\*\*/g, '').trim();
      const campo = n => (corpo.match(new RegExp('\\*\\*' + n + '[^*\\n]*?:\\*\\*\\s*([\\s\\S]*?)(?=\\n\\s*\\*\\*[^*\\n]+?:\\*\\*|\\n#|$)', 'i')) || [])[1]?.trim() || '';
      const asp = campo('Aspetto'), prop = campo('Propriet'), cred = campo('Cosa crederanno'), ver = campo('La verit'), storia = campo('Storia'), perche = campo('Perch'), come = campo('Come trovarlo'), valore = campo('Valore');
      if (!nome || (!asp && !prop)) continue;
      const it = corpo.match(/^\s*\*([^*\n]+)\*(.*)$/m), perTxt = (it?.[2] || '').match(/Per:\s*(.+)$/i)?.[1] || '';
      const per = pg.find(e => perTxt && (norm(perTxt).includes(norm(e.name)) || perTxt.includes('[[' + e.id)));
      const cariche = +(prop.match(/(\d+)\s+carich/i) || [])[1] || 0;
      const ricarica = (prop.match(/[^.]*\b(recuper|ricaric|all'alba|al tramonto|riposo lungo)[^.]*\./i) || [])[0]?.trim().slice(0, 140) || '';
      out.push({
        tipo: 'oggetto', nome, sotto: it ? it[1].trim() : '', per: per?.id || '',
        testo: [asp, cred ? cred : prop ? '**Proprietà:** ' + prop : ''].filter(Boolean).join('\n\n'),
        verita: [cred && prop ? '**Cosa fa davvero:** ' + prop : '', ver, storia && '**Storia:** ' + storia, perche && '**Perché a questo PG:** ' + perche, come && '**Come trovarlo:** ' + come, valore && '**Valore:** ' + valore].filter(Boolean).join('\n\n'),
        cariche, ricarica
      });
    }
    return out;
  }
  async function daIdee(testo, titolo) {
    const L = daMarkdown(testo);
    if (!L.length) { toast('Non ho trovato oggetti in questa idea (servono «## Nome» con Aspetto o Proprietà).', 'err'); return false; }
    css();
    const d = openDlg(`<form method="dialog"><h3>Prepara per la partita</h3><p class="hint">Questi oggetti vanno nel tuo «Bottino pronto»: al Tavolo li consegni a chi li trova. «La verità», la storia e il valore restano solo tuoi.</p>
      <div class="bt-imp">${L.map((x, i) => `<label><input type="checkbox" checked data-i="${i}"><span><b>${esc(x.nome)}</b><small>${esc(x.sotto)}${x.per ? ' · per ' + esc(S.ents.get(x.per)?.name || '') : ''}${x.cariche ? ` · ${x.cariche} cariche` : ''}</small></span></label>`).join('')}</div>
      <menu><button value="cancel" class="btn ghost">Annulla</button><button value="ok" class="btn primary">Metti nel bottino</button></menu></form>`);
    const ok = await new Promise(res => d.addEventListener('close', () => res(d.returnValue === 'ok')));
    if (!ok) return false;
    const scelti = [...d.querySelectorAll('input:checked')].map(x => L[+x.dataset.i]);
    if (!scelti.length) return false;
    await window.__cronache.runBatch(['meta'], '', async b => { for (const x of scelti) { const id = nuovoId(); await b.put('meta', { k: KEY(id), v: { id, ...x, da: titolo || '', creato: Date.now(), agg: Date.now(), consegne: [] } }); } });
    toast(scelti.length === 1 ? 'Messo nel bottino pronto.' : `Messi ${scelti.length} oggetti nel bottino pronto.`);
    return true;
  }

  /* ---------- l'editor ---------- */
  async function immagine(file) {
    const bmp = await createImageBitmap(file), L = 1100, s = Math.min(1, L / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); if (bmp.close) bmp.close();
    let u = c.toDataURL('image/webp', 0.8); if (!u.startsWith('data:image/webp')) u = c.toDataURL('image/jpeg', 0.8); return u;
  }
  function editor(v0, tipo) {
    css();
    const v = v0 ? { ...v0 } : { id: nuovoId(), tipo: tipo || 'oggetto', nome: '', sotto: '', testo: '', verita: '', cariche: 0, ricarica: '', firma: '', immagine: '', per: '', creato: Date.now(), consegne: [] };
    const pg = [...S.ents.values()].filter(e => e.type === 'pg').sort((a, b) => a.name.localeCompare(b.name));
    return new Promise(res => {
      const d = openDlg(`<form method="dialog"><h3>${v0 ? 'Modifica' : 'Prepara'}: ${esc(TIPI[v.tipo][1].toLowerCase())}</h3>
        <div class="bt-ed"><div>
          <div class="riga"><label class="f"><span>Tipo</span><select data-f="tipo">${Object.entries(TIPI).map(([k, [ic, l]]) => `<option value="${k}"${k === v.tipo ? ' selected' : ''}>${ic} ${l}</option>`).join('')}</select></label>
            <label class="f"><span>Pensato per</span><select data-f="per"><option value="">Chi lo trova</option>${pg.map(e => `<option value="${esc(e.id)}"${e.id === v.per ? ' selected' : ''}>${esc(e.name)}</option>`).join('')}</select></label></div>
          <label class="f"><span>Nome</span><input data-f="nome" required maxlength="120" value="${esc(v.nome)}" placeholder="Il nome che vedranno i giocatori"></label>
          <label class="f" data-per="oggetto documento mappa"><span>Sottotitolo</span><input data-f="sotto" value="${esc(v.sotto)}" placeholder="Arma · rara · richiede sintonia"></label>
          <label class="f"><span>Cosa leggono i giocatori</span><textarea data-f="testo" rows="7" placeholder="Il testo della lettera, l'aspetto e le proprietà dell'oggetto…">${esc(v.testo)}</textarea><small class="hint">Puoi usare **grassetto**, *corsivo* e [[id]] per collegare le schede.</small></label>
          <label class="f" data-per="lettera documento"><span>Firma</span><input data-f="firma" value="${esc(v.firma)}" placeholder="A."></label>
          <div class="riga" data-per="oggetto"><label class="f"><span>Cariche</span><input data-f="cariche" type="number" min="0" max="50" value="${+v.cariche || ''}" placeholder="nessuna"></label>
            <label class="f"><span>Come si ricaricano</span><input data-f="ricarica" value="${esc(v.ricarica)}" placeholder="1d3 all'alba"></label></div>
          <label class="f"><span>Immagine</span><input type="file" data-f="file" accept="image/*"><small class="hint" data-img>${v.immagine ? 'C\'è già un\'immagine. <button type="button" class="btn sm ghost" data-via>Toglila</button>' : 'Facoltativa (per le mappe è la mappa).'}</small></label>
          <label class="f dm"><span>La verità</span><textarea data-f="verita" rows="4" placeholder="Cosa fa davvero, la maledizione, da dove viene…">${esc(v.verita)}</textarea></label>
        </div><div class="anteprima"><div data-ant></div></div></div>
        <menu>${v0 ? '<button type="button" class="btn danger" data-del style="margin-right:auto">Elimina</button>' : ''}<button value="cancel" class="btn ghost" formnovalidate>Annulla</button><button value="ok" class="btn primary">Metti nel bottino</button></menu></form>`, 'bt-dlg');
      const f = k => d.querySelector(`[data-f="${k}"]`);
      const leggi = () => { for (const k of ['tipo', 'per', 'nome', 'sotto', 'testo', 'firma', 'ricarica', 'verita']) v[k] = f(k).value.trim(); v.cariche = Math.max(0, Math.min(50, +f('cariche').value || 0)); };
      const disegna = () => {
        leggi();
        d.querySelectorAll('[data-per]').forEach(x => { x.hidden = !x.dataset.per.split(' ').includes(v.tipo); });
        d.querySelector('h3').textContent = (v0 ? 'Modifica: ' : 'Prepara: ') + TIPI[v.tipo][1].toLowerCase();
        d.querySelector('[data-ant]').innerHTML = carta({ ...perGiocatore(v), nome: v.nome || TIPI[v.tipo][1] }) + '<small>Così lo vedrà il giocatore</small>';
      };
      d.addEventListener('input', e => { if (e.target.type !== 'file') disegna(); });
      f('file').addEventListener('change', async e => {
        const file = e.target.files[0]; if (!file) return;
        try { v.immagine = await immagine(file); d.querySelector('[data-img]').textContent = 'Immagine pronta.'; disegna(); } catch (err) { toast('Immagine non valida: ' + (err.message || err), 'err'); }
      });
      d.addEventListener('click', async e => {
        if (e.target.closest('[data-via]')) { v.immagine = ''; d.querySelector('[data-img]').textContent = 'Immagine tolta.'; disegna(); }
        if (e.target.closest('[data-del]')) {
          if (!await ask(`Eliminare **${v.nome || 'questa voce'}** dal bottino pronto?`, { danger: true, ok: 'Elimina' })) return;
          await window.__cronache.runBatch(['meta'], '', b => b.del('meta', KEY(v.id))); d.close(); res('via');
        }
      });
      d.addEventListener('close', async () => {
        if (d.returnValue !== 'ok') return res(null);
        leggi(); if (!v.nome) return res(null);
        await salva(v); res(v);
      });
      disegna();
    });
  }

  /* ---------- la consegna (dal Tavolo) ---------- */
  // segna la consegna e, per gli oggetti, rende visibile la scheda a chi l'ha ricevuto (va online con «Salva»)
  async function consegnato(id, a, pubblica) {
    const v0 = una(id); if (!v0) return null;
    const v = { ...v0, consegne: [...(v0.consegne || []), { a: a || null, pubblica: !!pubblica, t: Date.now() }] };
    let e = null, body = null;
    if (v.tipo === 'oggetto') {
      const chi = a && !pubblica ? a : null; // davanti a tutti: la scheda la vedono tutti
      e = v.ent && S.ents.get(v.ent);
      if (!e) {
        let eid = 'oggetto-' + slug(v.nome); const base = eid; let i = 2; while (S.ents.has(eid)) eid = base + '-' + (i++);
        e = { id: eid, type: 'oggetto', name: v.nome, alias: [], brief: v.sotto || '', status: '', discovered: true, sessions: [], upd: Date.now() };
        if (chi) e.vis = [...chi];
        const sez = [{ title: 'Descrizione', entries: [{ text: v.testo || '' }] }];
        if (v.cariche) sez.push({ title: 'Cariche', entries: [{ text: `${v.cariche} cariche${v.ricarica ? '. ' + v.ricarica : ''}` }] });
        if (v.verita) sez.push({ title: 'La verità (solo DM)', dm: true, entries: [{ text: v.verita }] });
        body = { id: eid, sections: sez };
        v.ent = eid;
      } else {
        const tutti = e.discovered !== false && !e.vis, prima = e.discovered === false ? [] : (e.vis || []);
        e = { ...e, discovered: true, upd: Date.now() };
        if (!tutti) { if (!chi) delete e.vis; else e.vis = [...new Set([...prima, ...chi])]; }
      }
    }
    await window.__cronache.runBatch(['meta', 'entities', 'bodies'], '', async b => {
      await b.put('meta', { k: KEY(v.id), v: { ...v, agg: Date.now() } });
      if (e) await b.put('entities', e);
      if (body) await b.put('bodies', body);
    });
    return v;
  }

  /* ---------- la pagina ---------- */
  route(/^\/bottino$/, async () => {
    await claude.use('db'); css();
    if (window.__RO) return setView(`<div class="empty"><h2>Pagina riservata al Dungeon Master</h2><p><a href="#/">Torna alla campagna</a></p></div>`);
    const L = tutte(), da = L.filter(v => !v.consegne?.length), fatti = L.filter(v => v.consegne?.length);
    const it = v => { const [c, s] = stato(v), per = v.per && S.ents.get(v.per)?.name; return `<button type="button" class="bt-it${c ? ' fatto' : ''}" data-act="bted" data-id="${esc(v.id)}"><div class="t"><span aria-hidden="true">${TIPI[v.tipo]?.[0] || '🗡'}</span><b>${esc(v.nome)}</b></div>${v.sotto ? `<div class="s">${esc(v.sotto)}</div>` : ''}<div class="s">${esc(TIPI[v.tipo]?.[1] || '')}${per ? ' · per ' + esc(per) : ''}${+v.cariche ? ` · ${+v.cariche} cariche` : ''}</div><span class="st ${c}">${esc(s)}</span></button>`; };
    setView(`<div class="pagehead"><div style="flex:1"><h1>Bottino pronto</h1><div class="hint">Oggetti, lettere, documenti e mappe da consegnare ai giocatori durante la partita. Li vedi solo tu finché non li consegni al Tavolo.</div></div>
      <div class="acts">${Object.entries(TIPI).map(([k, [ic, l]]) => `<button class="btn${k === 'oggetto' ? ' primary' : ''}" data-act="btnew" data-t="${k}" title="${esc(TIPI[k][2])}">+ ${ic} ${esc(l)}</button>`).join('')}<a class="btn" href="#/idee">Dalle idee</a><a class="btn" href="#/tavolo">Al Tavolo</a></div></div><div class="orn"></div>
      ${L.length ? '' : '<div class="bt-vuoto card"><p>Il bottino è vuoto.</p><p class="hint">Crea una voce con i pulsanti qui sopra, oppure apri un\'idea con degli oggetti e premi «Prepara per la partita».</p></div>'}
      ${da.length ? `<div class="bt-sez">Da consegnare · ${da.length}</div><div class="bt-grid">${da.map(it).join('')}</div>` : ''}
      ${fatti.length ? `<div class="bt-sez">Già consegnati · ${fatti.length}</div><div class="bt-grid">${fatti.map(it).join('')}</div>` : ''}`);
    setActs({
      btnew: async a => { if (await editor(null, a.dataset.t)) rerender(); },
      bted: async a => { const v = una(a.dataset.id); if (v && await editor(v)) rerender(); }
    });
  });

  window.__bottino = { css, TIPI, tutte, una, carta, mostra, editor, daIdee, daMarkdown, consegnato, perGiocatore, nomiA, stato };
})();

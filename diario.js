/* Campagna D&D — «Diario»: le pagine di diario dei giocatori.
   Ogni giocatore scrive le sue pagine, legate a una sessione e al giorno in gioco, e sceglie chi le legge:
   solo lui, lui e il DM, o tutto il gruppo. I nomi delle schede si collegano da soli (come nel resto del sito) e
   mentre scrivi il sito propone le schede che conosci. Ogni pagina può tenere delle domande da spuntare.
   Il DM vede le pagine che i giocatori gli hanno mostrato, divise per giocatore, e le loro domande aperte.
   Dati: tabella tavolo_diario su Supabase (tavolo/tappa-22.sql), con lo stesso accesso del Tavolo (window.__sbIo).
   Usa le funzioni della pagina principale (route, setView, esc, md, norm, toast, ask, S…). */
(() => {
  'use strict';
  const VIS = { io: ['🔒', 'Solo io', 'La leggi solo tu: nemmeno il DM'], dm: ['👁', 'Io e il DM', 'La leggete tu e il DM'], gruppo: ['👥', 'Il gruppo', 'La legge tutto il gruppo, DM compreso'] };
  const CSS = `
.dr{display:grid;grid-template-columns:270px minmax(0,1fr) 270px;gap:18px;max-width:1440px;margin:0 auto;padding:20px 20px 90px;align-items:start}
.dr .card{margin:0}
.dr-side{padding:16px 14px;position:sticky;top:76px;max-height:calc(100vh - 96px);overflow:auto}
.dr-side h2,.dr-aside h3{font-family:var(--display);color:var(--wine);letter-spacing:.06em;font-size:1.05rem;margin:0 0 10px}
:root[data-theme=dark] .dr-side h2,:root[data-theme=dark] .dr-aside h3{color:var(--gold2)}
.dr-tabs{display:flex;gap:3px;background:var(--paper2);border:1px solid var(--line);border-radius:20px;padding:3px;margin:0 0 12px}
.dr-tabs button{flex:1;border:0;background:none;border-radius:16px;padding:6px 4px;font:600 .86rem var(--body);color:var(--ink2);cursor:pointer}
.dr-tabs button.on{background:var(--wine);color:#fbeccb}
.dr-new{width:100%;justify-content:center;margin:0 0 6px}
.dr-grp{font:600 .7rem var(--display);letter-spacing:.12em;text-transform:uppercase;color:var(--mute);margin:14px 4px 6px}
.dr-it{display:flex;gap:9px;align-items:flex-start;padding:8px;border-radius:6px;margin:0 0 3px;cursor:pointer;width:100%;text-align:left;background:none;border:0;color:var(--ink);font:inherit}
.dr-it:hover{background:var(--paper2)}
.dr-it.on{background:#7d253014;outline:1px solid #7d253033}
.dr-av{width:28px;height:28px;border-radius:50%;object-fit:cover;object-position:top;flex:none;border:1.5px solid var(--gold2);display:grid;place-items:center;background:var(--paper2);font:600 .8rem var(--display);color:var(--wine)}
.dr-it b{display:block;font-size:.98rem;line-height:1.25}
.dr-it small{font-size:.82rem;color:var(--mute)}
.dr-page{padding:0;overflow:hidden;display:flex;flex-direction:column;min-height:calc(100vh - 140px)}
.dr-ph{padding:16px 24px 12px;border-bottom:1px solid var(--line);display:flex;align-items:flex-end;gap:14px;flex-wrap:wrap}
.dr-ph .t{flex:1;min-width:220px}
.dr-k{font:600 .7rem var(--display);letter-spacing:.13em;color:var(--mute);text-transform:uppercase;display:flex;gap:4px;flex-wrap:wrap;align-items:center}
.dr-ph .dr-k select,.dr-ph .dr-k input{field-sizing:content;max-width:100%;min-width:0;height:auto;box-shadow:none;width:auto;font:600 .7rem var(--display);letter-spacing:.1em;text-transform:uppercase;color:var(--mute);background:transparent;border:1px dashed transparent;border-radius:4px;padding:2px 4px}
.dr-ph .dr-k select:hover,.dr-ph .dr-k input:hover,.dr-ph .dr-k select:focus,.dr-ph .dr-k input:focus{border-color:var(--line2)}
.dr-ph .dr-k input{max-width:160px;min-width:110px}
.dr-ph .dr-title{font:600 1.55rem var(--display);color:var(--wine);letter-spacing:.03em;margin:4px 0 0;border:0;border-radius:0;box-shadow:none;background:transparent;width:100%;padding:0;height:auto}
.dr-ph input.dr-title:focus{outline:none;border-bottom:1px dashed var(--line2)}
:root[data-theme=dark] .dr-ph .dr-title{color:var(--gold2)}
.dr-vis{display:flex;flex-direction:column;align-items:flex-end;gap:4px}
.dr-vis small{color:var(--mute);font-size:.82rem}
.dr-seg{display:flex;border:1px solid var(--line2);border-radius:20px;overflow:hidden}
.dr-seg button{border:0;background:var(--paper);padding:6px 12px;font:.88rem var(--body);color:var(--ink2);cursor:pointer;white-space:nowrap}
.dr-seg button+button{border-left:1px solid var(--line)}
.dr-seg button.on{background:var(--wine);color:#fbeccb}
.dr-tb{display:flex;gap:4px;padding:7px 18px;background:var(--paper2);border-bottom:1px solid var(--line);align-items:center;flex-wrap:wrap;font-size:.9rem}
.dr-tb .f{width:32px;height:30px;border:0;background:none;border-radius:4px;cursor:pointer;color:var(--ink2);font:600 1rem var(--body)}
.dr-tb .f:hover{background:var(--paper)}
.dr-tb .sep{width:1px;height:20px;background:var(--line2);margin:0 6px}
.dr-tb .l{border:1px solid var(--line2);border-radius:14px;padding:4px 11px;background:var(--paper);cursor:pointer;color:var(--ink2);font:.88rem var(--body)}
.dr-tb .st{margin-left:auto;font-size:.82rem;color:var(--ok,#3f7a3f)}
.dr-tb .st.err{color:var(--bad,#b8322c)}
.dr-body{position:relative;flex:1;display:flex;flex-direction:column}
.dr-txt,.dr-read{flex:1;padding:16px 28px 30px;font-size:1.08rem;line-height:1.75rem;background:repeating-linear-gradient(transparent 0 calc(1.75rem - 1px),#dccaa055 calc(1.75rem - 1px) 1.75rem);background-position:0 16px;min-height:380px}
:root[data-theme=dark] .dr-txt,:root[data-theme=dark] .dr-read{background-image:repeating-linear-gradient(transparent 0 calc(1.75rem - 1px),#ffffff12 calc(1.75rem - 1px) 1.75rem)}
.dr-txt{width:100%;border:0;resize:none;font-family:var(--body);color:var(--ink);outline:none;display:block}
.dr-read .prose p,.dr-read .prose ul{margin:0 0 1.75rem}
.dr-read .prose{font-size:1.08rem;line-height:1.75rem}
.dr-read.mio{cursor:text}
.dr-read .vuoto{color:var(--mute);font-style:italic}
.dr-sugg{position:absolute;z-index:6;width:260px;background:var(--paper);border:1px solid var(--line2);border-radius:8px;box-shadow:0 8px 24px #2b1d1440;padding:5px}
.dr-sugg button{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:5px;width:100%;border:0;background:none;cursor:pointer;color:var(--ink);font:.95rem var(--body);text-align:left}
.dr-sugg button.on,.dr-sugg button:hover{background:#7d253018}
.dr-sugg img,.dr-sugg .ph{width:24px;height:24px;border-radius:50%;object-fit:cover;object-position:top;flex:none;background:var(--paper2)}
.dr-sugg em{margin-left:auto;font-style:normal;font-size:.68rem;color:#fff;border-radius:8px;padding:1px 7px;text-transform:uppercase}
.dr-foot{display:flex;gap:8px;justify-content:flex-end;padding:10px 18px;border-top:1px solid var(--line)}
.dr-aside{display:flex;flex-direction:column;gap:14px;position:sticky;top:76px}
.dr-aside .card{padding:14px}
.dr-chip{display:flex;gap:9px;align-items:center;padding:6px;border:1px solid var(--line);border-radius:6px;margin:0 0 6px;background:var(--paper2);color:var(--ink);text-decoration:none!important}
.dr-chip:hover{border-color:var(--gold)}
.dr-chip img,.dr-chip .ph{width:36px;height:36px;border-radius:5px;object-fit:cover;object-position:top;flex:none;background:var(--paper);display:grid;place-items:center;font:600 .9rem var(--display);color:var(--wine)}
.dr-chip b{display:block;line-height:1.15}
.dr-chip small{font-size:.8rem;color:var(--mute)}
.dr-q{display:flex;gap:8px;align-items:flex-start;margin:7px 0;font-size:.97rem;line-height:1.35}
.dr-q input{flex:none;margin-top:3px;width:16px;height:16px;accent-color:var(--wine)}
.dr-q.fatta span{color:var(--mute);text-decoration:line-through}
.dr-q .x{margin-left:auto;border:0;background:none;color:var(--mute);cursor:pointer;padding:0 2px}
.dr-q small{display:block;color:var(--mute);font-size:.78rem}
.dr-empty{padding:40px 24px;text-align:center;color:var(--mute)}
.dr-empty h2{font-family:var(--display);color:var(--wine)}
.dr-back{display:none}
.dr-dm .dr-it small b{font-weight:600;color:var(--ink2)}
@media (max-width:1180px){.dr{grid-template-columns:250px minmax(0,1fr)}.dr-aside{grid-column:2;position:static;display:grid;grid-template-columns:1fr 1fr}}
@media (max-width:820px){
  .dr{grid-template-columns:1fr;padding:12px 12px 90px;gap:12px}
  .dr-side{position:static;max-height:none}
  .dr.aperta .dr-side{display:none}
  .dr:not(.aperta) .dr-page,.dr:not(.aperta) .dr-aside{display:none}
  .dr-aside{grid-column:auto;display:flex}
  .dr-back{display:inline-flex;align-items:center;gap:4px;border:0;background:none;color:var(--wine2);font:600 .9rem var(--body);padding:10px 14px 0;cursor:pointer}
  .dr-ph{padding:10px 14px 10px}
  .dr-vis{align-items:flex-start;width:100%}
  .dr-seg{width:100%}.dr-seg button{flex:1;padding:7px 6px;font-size:.82rem}
  .dr-tb{padding:6px 10px}
  .dr-txt,.dr-read{padding:12px 16px 24px;min-height:300px}
  .dr-page{min-height:0}
}`;
  let cssFatto = false;
  const css = () => { if (cssFatto) return; cssFatto = true; const s = document.createElement('style'); s.textContent = CSS; document.head.append(s); };

  // stato della pagina (resta tra una visita e l'altra)
  const ST = { tab: 'mie', id: null, aperta: false, pagine: null, membri: [], io: null, err: null };
  const sqlMancante = e => e && (e.code === '42P01' || e.code === 'PGRST205' || e.code === 'PGRST204' || /does not exist|schema cache/i.test(e.message || ''));
  const errore = e => sqlMancante(e) ? 'Il diario non è ancora attivo: il DM deve eseguire una volta tavolo/tappa-22.sql nell\'SQL Editor di Supabase.' : (e?.message || String(e));

  const sessione = n => S.sess.find(s => s.n === n);
  const titoloSess = n => { const s = sessione(n); return n == null ? 'Senza sessione' : `Sessione ${n}${s?.title ? ' · ' + s.title : ''}`; };
  const quando = ts => {
    const d = new Date(ts), ora = new Date(), g = Math.round((new Date(ora.toDateString()) - new Date(d.toDateString())) / 864e5);
    return g === 0 ? 'oggi' : g === 1 ? 'ieri' : g < 7 ? g + ' giorni fa' : d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
  };
  const membro = id => ST.membri.find(m => m.giocatore === id);
  const nomeDi = id => membro(id)?.nome || (typeof PLAYERS === 'function' ? PLAYERS().find(p => p[0] === id)?.[1] : '') || id;
  const fotoDi = id => { const pg = (getMeta('giocatori', null) || []).find(g => g.id === id)?.pg || (ST.io?.giocatore === id ? ST.io.pg : null) || 'pg-' + id; return S.ents.get(pg)?.portrait?.thumb || membro(id)?.immagine || ''; };
  const avatar = id => { const f = fotoDi(id); return f ? `<img class="dr-av" src="${esc(f)}" alt="">` : `<span class="dr-av">${esc((nomeDi(id) || '?')[0].toUpperCase())}</span>`; };
  const mia = p => !!p && !!ST.io?.giocatore && p.autore === ST.io.giocatore;

  // le schede nominate nel testo: [[id]] e i nomi scritti per intero (come i collegamenti automatici del sito)
  function schedeIn(testo) {
    const ids = new Set(), t = String(testo || '');
    for (const m of t.matchAll(/\[\[([^\]|]+?)(?:\|[^\]]+?)?\]\]/g)) { const e = findEnt(m[1]); if (e) ids.add(e.id); }
    const N = nameIdx(); if (N.rx) for (const m of esc(t).matchAll(N.rx)) { const id = N.ids.get(m[0].replace(/\s+/g, ' ')); if (id) ids.add(id); }
    return [...ids].map(id => S.ents.get(id)).filter(Boolean);
  }

  async function carica() {
    const c = await window.__sbIo();
    ST.io = c;
    const [p, m] = await Promise.all([
      c.sb.from('tavolo_diario').select('*').order('aggiornata', { ascending: false }),
      c.sb.from('tavolo_membri').select('giocatore,nome,immagine')
    ]);
    if (p.error) throw p.error;
    ST.pagine = p.data; ST.membri = m.error ? [] : (m.data || []).filter(x => x.giocatore);
  }

  // salvataggio automatico: un secondo dopo l'ultima modifica, e subito uscendo dalla pagina
  const coda = new Map(); let timer = null, inVolo = null;
  const stato = (t, err) => { const el = $('#dr-st'); if (el) { el.textContent = t; el.classList.toggle('err', !!err); } };
  function cambia(p, campi) {
    Object.assign(p, campi);
    coda.set(p.id, { ...(coda.get(p.id) || {}), ...campi });
    stato('Salvo…'); clearTimeout(timer); timer = setTimeout(salva, 900);
  }
  async function salva() {
    clearTimeout(timer); timer = null;
    if (inVolo) await inVolo;
    if (!coda.size) return;
    const lav = [...coda]; coda.clear();
    inVolo = (async () => {
      for (const [id, campi] of lav) {
        const r = await ST.io.sb.from('tavolo_diario').update({ ...campi, aggiornata: new Date().toISOString() }).eq('id', id).select().single();
        if (r.error) { coda.set(id, { ...campi, ...(coda.get(id) || {}) }); stato('Non salvato: ' + errore(r.error), true); return; }
        const p = ST.pagine.find(x => x.id === id); if (p) p.aggiornata = r.data.aggiornata;
      }
      stato('✓ Salvato');
    })();
    try { await inVolo; } finally { inVolo = null; }
  }

  async function nuova() {
    const ultima = S.sess[S.sess.length - 1];
    const r = await ST.io.sb.from('tavolo_diario').insert({ titolo: '', testo: '', sessione: ultima?.n ?? null, giorno: ultima?.gameDate ? String(ultima.gameDate).slice(0, 40) : null, vis: 'io' }).select().single();
    if (r.error) return toast(errore(r.error), 'err');
    ST.pagine.unshift(r.data); ST.tab = 'mie'; ST.id = r.data.id; ST.aperta = true; ST.scrivi = true; disegna();
    setTimeout(() => $('#dr-title')?.focus(), 30);
  }

  /* ---------- elenco a sinistra ---------- */
  function elenco() {
    const P = ST.pagine || [], dm = ST.io?.ruolo === 'dm';
    const voce = (p, sotto) => `<button type="button" class="dr-it${p.id === ST.id ? ' on' : ''}" data-dr-p="${esc(p.id)}">${avatar(p.autore)}<span><b>${esc(p.titolo || 'Pagina senza titolo')} <span title="${esc(VIS[p.vis][2])}">${VIS[p.vis][0]}</span></b><small>${sotto(p)}</small></span></button>`;
    const perSessione = (L, sotto) => {
      if (!L.length) return '';
      const g = new Map(); for (const p of [...L].sort((a, b) => (b.sessione ?? -1) - (a.sessione ?? -1) || b.aggiornata.localeCompare(a.aggiornata))) { const k = p.sessione ?? null; if (!g.has(k)) g.set(k, []); g.get(k).push(p); }
      return [...g].map(([n, l]) => `<div class="dr-grp">${esc(titoloSess(n))}</div>${l.map(p => voce(p, sotto)).join('')}`).join('');
    };
    const sottoMia = p => esc([p.giorno, (p.vis === 'io' ? 'scritta ' : p.vis === 'dm' ? 'mostrata al DM ' : 'condivisa ') + quando(p.aggiornata)].filter(Boolean).join(' · '));
    const sottoAltri = p => `<b>${esc(nomeDi(p.autore))}</b> · ${esc([p.giorno, quando(p.aggiornata)].filter(Boolean).join(' · '))}`;
    let h = '';
    if (dm) {
      const tabs = [['mie', 'Per giocatore'], ['domande', 'Domande']];
      h += `<div class="dr-tabs" role="tablist">${tabs.map(([k, t]) => `<button type="button" role="tab" data-dr-tab="${k}" class="${ST.tab === k ? 'on' : ''}">${t}</button>`).join('')}</div>`;
      if (ST.tab === 'domande') return h + domandeTutte();
      const per = new Map(); for (const p of P) { if (!per.has(p.autore)) per.set(p.autore, []); per.get(p.autore).push(p); }
      h += [...per].sort((a, b) => nomeDi(a[0]).localeCompare(nomeDi(b[0]), 'it')).map(([g, l]) => `<div class="dr-grp">${esc(nomeDi(g))} · ${l.length}</div>${l.map(p => voce(p, p => esc([titoloSess(p.sessione), p.giorno, quando(p.aggiornata)].filter(Boolean).join(' · ')))).join('')}`).join('')
        || '<p class="hint" style="margin:10px 4px">Nessun giocatore ti ha ancora mostrato una pagina del suo diario. Lo decidono loro, pagina per pagina.</p>';
      return h;
    }
    const tabs = [['mie', 'Mie'], ['gruppo', 'Del gruppo'], ['domande', 'Domande']];
    h += `<div class="dr-tabs" role="tablist">${tabs.map(([k, t]) => `<button type="button" role="tab" data-dr-tab="${k}" class="${ST.tab === k ? 'on' : ''}">${t}</button>`).join('')}</div>
      <button type="button" class="btn primary dr-new" data-dr-nuova>＋ Nuova pagina</button>`;
    if (ST.tab === 'domande') return h + domandeTutte();
    if (ST.tab === 'gruppo') return h + (perSessione(P.filter(p => !mia(p)), sottoAltri) || '<p class="hint" style="margin:10px 4px">Nessuno ha ancora condiviso una pagina con il gruppo.</p>');
    return h + (perSessione(P.filter(mia), sottoMia) || '<p class="hint" style="margin:10px 4px">Il tuo diario è vuoto. Comincia con «Nuova pagina»: cosa hai visto, cosa sospetti, cosa vuoi chiedere.</p>');
  }
  function domandeTutte() {
    const L = (ST.pagine || []).filter(p => ST.io.ruolo === 'dm' || mia(p)).flatMap(p => (p.domande || []).map((d, i) => ({ p, d, i })));
    const aperte = L.filter(x => !x.d.fatta), fatte = L.filter(x => x.d.fatta);
    const riga = x => `<label class="dr-q${x.d.fatta ? ' fatta' : ''}"><input type="checkbox" data-dr-q="${esc(x.p.id)}" data-i="${x.i}"${x.d.fatta ? ' checked' : ''}${mia(x.p) ? '' : ' disabled'}><span>${esc(x.d.t)}<small>${ST.io.ruolo === 'dm' ? esc(nomeDi(x.p.autore)) + ' · ' : ''}<a href="#/diario" data-dr-p="${esc(x.p.id)}">${esc(x.p.titolo || 'Pagina senza titolo')}</a></small></span></label>`;
    if (!L.length) return `<p class="hint" style="margin:10px 4px">${ST.io.ruolo === 'dm' ? 'Le domande dei giocatori compaiono qui quando ti mostrano la pagina che le contiene.' : 'Nessuna domanda. In una pagina, «Aggiungi domanda» tiene a mente quello che vuoi scoprire.'}</p>`;
    return `<div class="dr-grp">Aperte · ${aperte.length}</div>${aperte.map(riga).join('') || '<p class="hint" style="margin:4px">Tutte risolte.</p>'}${fatte.length ? `<div class="dr-grp">Risolte · ${fatte.length}</div>${fatte.map(riga).join('')}` : ''}`;
  }

  /* ---------- la pagina ---------- */
  function pagina(p) {
    if (!p) return `<div class="card dr-page"><div class="dr-empty"><h2>${ST.io.ruolo === 'dm' ? 'I diari del gruppo' : 'Il tuo diario'}</h2><p>${ST.io.ruolo === 'dm' ? 'Scegli una pagina a sinistra. Vedi solo quelle che i giocatori hanno deciso di mostrarti.' : 'Scegli una pagina a sinistra o scrivine una nuova.'}</p>${ST.io.ruolo === 'dm' ? '' : '<button type="button" class="btn primary" data-dr-nuova>＋ Nuova pagina</button>'}</div></div>`;
    const mio = mia(p), s = sessione(p.sessione);
    const sesSel = `<select id="dr-sess" aria-label="Sessione">${[...S.sess].reverse().map(x => `<option value="${x.n}"${x.n === p.sessione ? ' selected' : ''}>Sessione ${x.n}${x.title ? ' · ' + esc(x.title) : ''}</option>`).join('')}<option value=""${p.sessione == null ? ' selected' : ''}>Senza sessione</option></select>`;
    const testa = mio
      ? `<div class="dr-k">${sesSel}<span>·</span><input id="dr-giorno" value="${esc(p.giorno || '')}" placeholder="Giorno in gioco" maxlength="40" aria-label="Giorno in gioco"></div><input id="dr-title" class="dr-title" value="${esc(p.titolo)}" placeholder="Titolo della pagina" maxlength="120" aria-label="Titolo">`
      : `<div class="dr-k">${esc([titoloSess(p.sessione), p.giorno].filter(Boolean).join(' · '))}</div><h1 class="dr-title">${esc(p.titolo || 'Pagina senza titolo')}</h1><div class="dr-k" style="margin-top:4px">${avatar(p.autore)} di ${esc(nomeDi(p.autore))} · ${esc(quando(p.aggiornata))}</div>`;
    const vis = mio ? `<div class="dr-vis"><small>Chi la legge</small><div class="dr-seg" role="group" aria-label="Chi la legge">${Object.entries(VIS).map(([k, [ic, t, tit]]) => `<button type="button" data-dr-vis="${k}" class="${p.vis === k ? 'on' : ''}" title="${esc(tit)}">${ic} ${t}</button>`).join('')}</div></div>`
      : `<div class="dr-vis"><span class="pill">${VIS[p.vis][0]} ${p.vis === 'dm' ? 'Solo per te' : 'Tutto il gruppo'}</span></div>`;
    const tb = mio ? `<div class="dr-tb"><button type="button" class="f" data-dr-f="b" title="Grassetto"><b>G</b></button><button type="button" class="f" data-dr-f="i" title="Corsivo"><em>C</em></button><button type="button" class="f" data-dr-f="l" title="Elenco">☰</button><span class="sep"></span><button type="button" class="l" data-dr-coll>🔗 Collega una scheda</button><button type="button" class="l" data-dr-dom>❓ Aggiungi domanda</button><span class="st" id="dr-st">${coda.has(p.id) ? 'Salvo…' : '✓ Salvato'}</span></div>` : '';
    const corpo = mio && ST.scrivi
      ? `<textarea id="dr-txt" class="dr-txt" placeholder="Scrivi qui. I nomi delle schede che conosci si collegano da soli: comincia a scriverne uno e scegli dall'elenco.">${esc(p.testo)}</textarea>`
      : `<div class="dr-read${mio ? ' mio' : ''}" ${mio ? 'data-dr-scrivi title="Tocca per scrivere"' : ''}>${p.testo.trim() ? prose(p.testo) : `<p class="vuoto">${mio ? 'Pagina vuota: tocca qui per scrivere.' : 'Pagina vuota.'}</p>`}</div>`;
    const piede = mio ? `<div class="dr-foot"><button type="button" class="btn sm ghost danger" data-dr-del>Elimina la pagina</button></div>` : '';
    return `<div class="card dr-page"><button type="button" class="dr-back" data-dr-back>‹ Tutte le pagine</button><div class="dr-ph"><div class="t">${testa}</div>${vis}</div>${tb}<div class="dr-body">${corpo}</div>${piede}</div>`;
  }
  function laterale(p) {
    if (!p) return '<div class="dr-aside"></div>';
    const E = schedeIn(p.testo), mio = mia(p);
    const conta = id => (ST.pagine || []).filter(x => (ST.io.ruolo === 'dm' || mia(x)) && schedeIn(x.testo).some(e => e.id === id)).length;
    const chip = e => `<a class="dr-chip" href="#/scheda/${encodeURIComponent(e.id)}">${e.portrait?.thumb ? `<img src="${esc(e.portrait.thumb)}" alt="">` : `<span class="ph">${esc(e.name[0])}</span>`}<span><b>${esc(e.name)}</b><small>${esc(TYPE_PL[e.type] === 'Party' ? 'Party' : TYPES[e.type] || '')}${(n => n > 1 ? ` · ${n} ${ST.io.ruolo === 'dm' ? 'pagine' : 'tue pagine'}` : '')(conta(e.id))}</small></span></a>`;
    const D = p.domande || [];
    return `<div class="dr-aside">
      <div class="card"><h3>In questa pagina</h3>${E.length ? E.slice(0, 12).map(chip).join('') : '<p class="hint" style="margin:0">Le schede nominate nel testo compaiono qui.</p>'}</div>
      <div class="card"><h3>Domande</h3>${D.map((d, i) => `<label class="dr-q${d.fatta ? ' fatta' : ''}"><input type="checkbox" data-dr-q="${esc(p.id)}" data-i="${i}"${d.fatta ? ' checked' : ''}${mio ? '' : ' disabled'}><span>${esc(d.t)}</span>${mio ? `<button type="button" class="x" data-dr-qx="${i}" title="Togli la domanda" aria-label="Togli la domanda">✕</button>` : ''}</label>`).join('') || `<p class="hint" style="margin:0">${mio ? 'Quello che vuoi scoprire: si spunta quando trovi la risposta.' : 'Nessuna domanda.'}</p>`}
      ${mio ? '<button type="button" class="btn sm" data-dr-dom style="margin-top:8px">＋ Aggiungi domanda</button>' : ''}</div></div>`;
  }

  function disegna() {
    const P = ST.pagine || [];
    if (ST.id && !P.some(p => p.id === ST.id)) ST.id = null;
    // sul computer si apre subito l'ultima pagina; sul telefono prima l'elenco
    if (!ST.id && !matchMedia('(max-width:820px)').matches) ST.id = (ST.io.ruolo === 'dm' ? P[0] : P.find(mia))?.id || null;
    const p = P.find(x => x.id === ST.id) || null;
    const dm = ST.io.ruolo === 'dm';
    setView(`<div class="dr${ST.aperta && p ? ' aperta' : ''}${dm ? ' dr-dm' : ''}"><aside class="card dr-side"><h2>${dm ? 'I diari del gruppo' : 'Il mio diario'}</h2>${elenco()}</aside>${pagina(p)}${laterale(p)}</div>`, 'raw');
    document.title = (dm ? 'Diari' : 'Diario') + ' · ' + (getMeta('campaign', null)?.name || 'Campagna D&D');
    lega(p);
  }

  /* ---------- proposte di schede mentre scrivi ---------- */
  let sugg = null;
  function chiudiSugg() { sugg?.el.remove(); sugg = null; }
  function proponi(ta) {
    const pos = ta.selectionStart, prima = ta.value.slice(0, pos), m = prima.match(/(?:^|[^\p{L}\p{N}])(\p{Lu}[\p{L}'’-]{1,})$/u);
    if (!m) return chiudiSugg();
    const pz = norm(m[1]);
    const L = [...S.ents.values()].map(e => [e, [e.name, ...(e.alias || [])].find(n => norm(n).startsWith(pz) || norm(n).split(' ').some(w => w.startsWith(pz)))]).filter(x => x[1] && norm(x[1]) !== pz).slice(0, 6);
    if (!L.length) return chiudiSugg();
    if (!sugg) { sugg = { el: document.createElement('div') }; sugg.el.className = 'dr-sugg'; sugg.el.setAttribute('role', 'listbox'); ta.parentNode.append(sugg.el); }
    Object.assign(sugg, { L, i: 0, da: pos - m[1].length, a: pos, ta });
    sugg.el.innerHTML = L.map(([e, n], i) => `<button type="button" role="option" data-i="${i}" class="${i ? '' : 'on'}">${e.portrait?.thumb ? `<img src="${esc(e.portrait.thumb)}" alt="">` : '<span class="ph"></span>'}${esc(n)}<em style="background:var(--t-${esc(e.type)})">${esc(e.type === 'pg' ? 'Party' : e.type === 'png' ? 'PNG' : TYPES[e.type] || e.type)}</em></button>`).join('');
    sugg.el.querySelectorAll('button').forEach(b => { b.onpointerdown = ev => ev.preventDefault(); b.onclick = () => scegli(+b.dataset.i); });
    // sotto la riga che si sta scrivendo (misurata con un clone del riquadro)
    const c = document.createElement('div'), st = getComputedStyle(ta);
    for (const k of ['fontFamily', 'fontSize', 'lineHeight', 'paddingLeft', 'paddingRight', 'paddingTop', 'width', 'letterSpacing', 'boxSizing']) c.style[k] = st[k];
    Object.assign(c.style, { position: 'absolute', visibility: 'hidden', whiteSpace: 'pre-wrap', wordWrap: 'break-word', left: '0', top: '0' });
    c.textContent = prima; const s = document.createElement('span'); s.textContent = '​'; c.append(s); ta.parentNode.append(c);
    const top = s.offsetTop - ta.scrollTop + parseFloat(st.lineHeight) + 4, left = Math.min(s.offsetLeft, ta.clientWidth - 270); c.remove();
    sugg.el.style.top = Math.max(0, top) + 'px'; sugg.el.style.left = Math.max(8, left) + 'px';
  }
  function scegli(i) {
    const { L, da, a, ta } = sugg, n = L[i][1];
    ta.setRangeText(n, da, a, 'end'); chiudiSugg(); ta.focus(); ta.dispatchEvent(new Event('input'));
  }

  function lega(p) {
    const v = $('#view');
    v.querySelectorAll('[data-dr-tab]').forEach(b => b.onclick = () => { ST.tab = b.dataset.dr_tab || b.dataset.drTab; disegna(); });
    v.querySelectorAll('[data-dr-nuova]').forEach(b => b.onclick = () => nuova());
    v.querySelectorAll('[data-dr-p]').forEach(b => b.onclick = async e => { e.preventDefault(); await salva(); ST.id = b.dataset.drP; ST.aperta = true; ST.scrivi = false; if (ST.tab === 'domande' && ST.io.ruolo !== 'dm') ST.tab = mia(ST.pagine.find(x => x.id === ST.id)) ? 'mie' : 'gruppo'; disegna(); scrollTo(0, 0); });
    v.querySelectorAll('[data-dr-back]').forEach(b => b.onclick = async () => { await salva(); ST.aperta = false; ST.scrivi = false; disegna(); });
    v.querySelectorAll('[data-dr-q]').forEach(c => c.onchange = () => {
      const q = ST.pagine.find(x => x.id === c.dataset.drQ); if (!mia(q)) return;
      const D = clone(q.domande || []); D[+c.dataset.i].fatta = c.checked; cambia(q, { domande: D }); disegna();
    });
    if (!p || !mia(p)) return;
    const ta = $('#dr-txt');
    $('#dr-title').oninput = e => cambia(p, { titolo: e.target.value });
    $('#dr-giorno').oninput = e => cambia(p, { giorno: e.target.value.trim() || null });
    $('#dr-sess').onchange = e => { cambia(p, { sessione: e.target.value === '' ? null : +e.target.value }); disegna(); };
    v.querySelectorAll('[data-dr-vis]').forEach(b => b.onclick = () => { cambia(p, { vis: b.dataset.drVis }); salva(); disegna(); toast(VIS[b.dataset.drVis][2]); });
    v.querySelector('[data-dr-scrivi]')?.addEventListener('click', e => { if (e.target.closest('a')) return; ST.scrivi = true; disegna(); const t = $('#dr-txt'); t?.focus(); if (t) t.setSelectionRange(t.value.length, t.value.length); });
    const dom = async () => {
      const r = await formDlg({ title: 'Nuova domanda', fields: [{ k: 't', label: 'Cosa vuoi scoprire?', value: '', req: true, hint: 'Per esempio: «Chi è davvero Gorgo?». La spunti quando trovi la risposta.' }] });
      if (!r?.t?.trim()) return; cambia(p, { domande: [...(p.domande || []), { t: r.t.trim().slice(0, 200), fatta: false }] }); salva(); disegna();
    };
    v.querySelectorAll('[data-dr-dom]').forEach(b => b.onclick = dom);
    v.querySelectorAll('[data-dr-qx]').forEach(b => b.onclick = e => { e.preventDefault(); const D = [...(p.domande || [])]; D.splice(+b.dataset.drQx, 1); cambia(p, { domande: D }); disegna(); });
    v.querySelector('[data-dr-del]').onclick = async () => {
      if (!await ask(`Eliminare la pagina **${p.titolo || 'senza titolo'}**? Non si può recuperare.`, { danger: true, ok: 'Elimina' })) return;
      coda.delete(p.id); const r = await ST.io.sb.from('tavolo_diario').delete().eq('id', p.id);
      if (r.error) return toast(errore(r.error), 'err');
      ST.pagine = ST.pagine.filter(x => x.id !== p.id); ST.id = null; ST.aperta = false; disegna(); toast('Pagina eliminata');
    };
    const avvolgi = (pre, post = pre) => {
      if (!ta) { ST.scrivi = true; disegna(); return; }
      const a = ta.selectionStart, b = ta.selectionEnd, sel = ta.value.slice(a, b) || 'testo';
      ta.setRangeText(pre + sel + post, a, b, 'select'); ta.focus(); ta.dispatchEvent(new Event('input'));
    };
    v.querySelectorAll('[data-dr-f]').forEach(b => { b.onpointerdown = e => e.preventDefault(); b.onclick = () => {
      const k = b.dataset.drF;
      if (k === 'b') return avvolgi('**');
      if (k === 'i') return avvolgi('*');
      if (!ta) { ST.scrivi = true; disegna(); return; }
      const a = ta.value.lastIndexOf('\n', ta.selectionStart - 1) + 1; ta.setRangeText('- ', a, a, 'end'); ta.focus(); ta.dispatchEvent(new Event('input'));
    }; });
    v.querySelector('[data-dr-coll]').onclick = async () => {
      const L = [...S.ents.values()].sort((a, b) => a.name.localeCompare(b.name, 'it'));
      const r = await formDlg({ title: 'Collega una scheda', fields: [{ k: 'id', label: 'Scheda', type: 'select', value: '', options: [['', 'Scegli…'], ...L.map(e => [e.id, `${e.name} (${TYPES[e.type] || e.type})`])], hint: 'Il nome finisce nel testo e diventa un collegamento alla scheda.' }] });
      if (!r?.id) return; const e = S.ents.get(r.id); if (!e) return;
      if (!ST.scrivi) { ST.scrivi = true; disegna(); }
      const t = $('#dr-txt'), at = t.selectionStart ?? t.value.length, spazio = at && !/\s$/.test(t.value.slice(0, at)) ? ' ' : '';
      t.setRangeText(spazio + e.name + ' ', at, t.selectionEnd ?? at, 'end'); t.focus(); t.dispatchEvent(new Event('input'));
    };
    if (ta) {
      const alza = () => { ta.style.height = 'auto'; ta.style.height = Math.max(380, ta.scrollHeight + 4) + 'px'; };
      alza();
      ta.oninput = () => { cambia(p, { testo: ta.value }); alza(); proponi(ta); };
      ta.onkeydown = e => {
        if (!sugg) return;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sugg.i = (sugg.i + (e.key === 'ArrowDown' ? 1 : -1) + sugg.L.length) % sugg.L.length; sugg.el.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', i === sugg.i)); }
        else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); scegli(sugg.i); }
        else if (e.key === 'Escape') chiudiSugg();
      };
      ta.onclick = () => proponi(ta);
      // uscendo dal riquadro la pagina torna da leggere, con i collegamenti
      ta.onblur = () => setTimeout(() => {
        if (document.activeElement === ta || !$('#dr-txt')) return;
        if (document.activeElement?.closest?.('.dr-tb,.dr-sugg,dialog')) return;
        chiudiSugg(); ST.scrivi = false; salva(); disegna();
      }, 150);
    }
  }

  route(/^\/diario$/, async () => {
    css();
    const info = await window.__tavolo?.();
    if (!info) { setView('<div class="empty"><h2>Il diario è dei giocatori</h2><p>Entra con il tuo accesso per scrivere il tuo diario.</p></div>'); return; }
    if (!ST.pagine) setView('<p class="empty">Apro il diario…</p>');
    try { await carica(); } catch (e) {
      setView(`<div class="card" style="max-width:640px;margin:30px auto"><h2>Il diario non si apre</h2><p>${esc(errore(e))}</p><button type="button" class="btn" onclick="location.reload()">Riprova</button></div>`); return;
    }
    if (ST.io.ruolo === 'dm' && ST.tab === 'gruppo') ST.tab = 'mie';
    disegna();
    const via = () => { salva(); };
    addEventListener('pagehide', via);
    onCleanup(() => { removeEventListener('pagehide', via); chiudiSugg(); salva(); });
  });

  // voce «Diario» nel menu, per i giocatori e (come «Diari») per il DM
  claude.use('db').then(async () => {
    const info = await window.__tavolo?.(); if (!info) return;
    const nav = document.getElementById('nav'); if (!nav || nav.querySelector('a[href="#/diario"]')) return;
    const a = document.createElement('a'); a.href = '#/diario';
    a.innerHTML = `<svg class="nic" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4a1 1 0 0 1 1-1h11a2 2 0 0 1 2 2v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z"/><path d="M9 3v18"/><path d="M12 8h4M12 11.5h4"/></svg><span>${info.ruolo === 'dm' ? 'Diari' : 'Diario'}</span>`;
    nav.insertBefore(a, nav.querySelector('a[href="#/tavolo"]')?.nextSibling || null);
    if (location.hash.startsWith('#/diario')) a.classList.add('on');
  });
})();

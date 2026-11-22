/* Campagna D&D — «Assistente» e «Fine sessione». Solo per il Dungeon Master.
   1. Assistente al Tavolo: una sezione accanto a Chat e Scaletta dove il DM chiede a Claude, di nascosto, cosa sa il
      party di qualcuno, una regola, un nome per un PNG… Risposte brevi, con le fonti (sessioni, schede, scaletta).
   2. Fine sessione (#/fine-sessione): Claude legge il registro del Tavolo (chat, tiri, oggetti consegnati), la scaletta
      con le scene giocate e le note del DM, e propone il riassunto e gli aggiornamenti alle schede. Il DM tiene o scarta
      ogni proposta e crea una bozza (meta «bozza», come strumenti/bozza.py): online va solo con «Controlla» e «Salva».
   Usa la chiave di Claude e le funzioni di idee.js (window.__idee) e della pagina principale (route, setView, S, md…). */
(() => {
  'use strict';
  const CSS = `.as{display:flex;flex-direction:column;flex:1;min-height:0;background:var(--paper)}
.as-hd{display:flex;align-items:center;gap:8px;padding:8px 12px;background:#2a201b;color:#f0e2c2}
.as-hd b{font:600 .95rem/1.2 var(--display);letter-spacing:.03em}
.as-hd .lk{margin-left:auto;font-size:.75rem;border:1px solid #ffffff2a;background:#ffffff12;border-radius:999px;padding:2px 9px;color:#e0c071;white-space:nowrap}
.as-hd button{all:unset;cursor:pointer;color:#e0c071;font-size:.8rem;padding:2px 6px;border-radius:6px}.as-hd button:hover{background:#ffffff18}
.as-ctx{font-size:.82rem;color:var(--mute);padding:6px 12px;background:var(--paper2);border-bottom:1px solid var(--line);line-height:1.3}
.as-feed{flex:1;overflow-y:auto;padding:10px 12px;display:flex;flex-direction:column;gap:9px;min-height:60px}
.as-q{align-self:flex-end;max-width:85%;background:var(--wine);color:#fff;border-radius:14px 14px 3px 14px;padding:6px 11px;white-space:pre-wrap;line-height:1.3}
.as-a{background:#fff;border:1px solid var(--line);border-radius:3px 14px 14px 14px;padding:8px 11px;line-height:1.32;box-shadow:0 1px 2px #0001}
:root[data-theme=dark] .as-a{background:var(--paper2)}
.as-a .prose>:first-child{margin-top:0}.as-a .prose>:last-child{margin-bottom:0}.as-a .prose p{margin:.35em 0}.as-a .prose ul{margin:.3em 0;padding-left:1.2em}
.as-a.err{border-color:#c0392b;color:#8b1d1d}
.as-src{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}
.as-src span,.as-src a{font-size:.75rem;border:1px solid var(--line);background:var(--paper2);border-radius:999px;padding:1px 8px;color:var(--mute);text-decoration:none}
.as-nm{display:flex;flex-wrap:wrap;gap:6px;margin-top:7px}
.as-nm button{font-size:.85rem}
.as-who{font:600 .62rem/1 var(--display);letter-spacing:.1em;color:var(--gold);margin-bottom:4px;text-transform:uppercase}
.as-live:after{content:"▍";animation:as-b 1s steps(2) infinite;color:var(--gold)}
@keyframes as-b{50%{opacity:0}}
.as-chips{display:flex;flex-wrap:wrap;gap:5px;padding:8px 12px 0;border-top:1px solid var(--line);background:var(--paper2)}
.as-chips button{all:unset;cursor:pointer;font-size:.82rem;background:var(--paper);border:1px solid var(--gold2);border-radius:999px;padding:2px 9px}
.as-chips button:hover{border-color:var(--wine);color:var(--wine)}
.as-in{display:flex;gap:6px;padding:8px 12px 10px;background:var(--paper2)}
.as-in textarea{flex:1;resize:none;min-height:38px;max-height:120px;border-radius:10px;padding:8px 10px;font:inherit;line-height:1.25}
.as-in button{flex:none;width:42px;border-radius:10px;border:0;background:var(--wine);color:#fff;font-size:1.05rem;cursor:pointer}
.as-in button.stop{background:#6b5a48}
.as-vuoto{padding:16px 14px;line-height:1.45;color:var(--mute)}
.as-vuoto b{color:var(--ink)}
/* fine sessione */
.fs-steps{display:flex;margin:4px 0 16px;flex-wrap:wrap}
.fs-steps span{flex:1;min-width:150px;padding:8px 14px;background:var(--paper2);border:1px solid var(--line);font:600 .78rem/1.2 var(--display);letter-spacing:.05em;color:var(--mute);text-transform:uppercase}
.fs-steps span:first-child{border-radius:8px 0 0 8px}.fs-steps span:last-child{border-radius:0 8px 8px 0}
.fs-steps .ok{color:var(--ok)}.fs-steps .on{background:var(--wine);color:#fff;border-color:var(--wine)}
.fs-grid{display:grid;grid-template-columns:300px minmax(0,1fr);gap:18px;align-items:start}
@media (max-width:820px){.fs-grid{grid-template-columns:1fr}.fs-side{order:2}.fs-p{flex-wrap:wrap}.fs-p .tx{flex-basis:calc(100% - 40px)}.fs-p>.btn{margin-left:32px}.fs-foot{position:static}.fs-foot .h{text-align:left}}
.fs-read div{display:flex;justify-content:space-between;gap:10px;padding:5px 0;border-bottom:1px dotted var(--line)}
.fs-read b{font-family:var(--display);color:var(--wine)}
:root[data-theme=dark] .fs-read b{color:var(--gold2)}
.fs-sc{list-style:none;margin:6px 0 0;padding:0;font-size:.95rem}.fs-sc li{padding:2px 0}.fs-sc .no{color:var(--mute)}
.fs-sum{width:100%;min-height:220px;font:inherit;line-height:1.45;padding:10px 12px;border-radius:8px}
.fs-grp{font:600 .75rem/1 var(--display);letter-spacing:.1em;color:var(--mute);text-transform:uppercase;margin:16px 0 4px;display:flex;align-items:center;gap:8px}
.fs-grp:after{content:"";flex:1;height:1px;background:var(--line)}
.fs-p{display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-top:1px dashed var(--line)}
.fs-grp+.fs-p{border-top:0}
.fs-p>input{width:20px;height:20px;margin-top:2px;accent-color:var(--wine);flex:none}
.fs-p .tx{flex:1;min-width:0;line-height:1.3}
.fs-p .nm{font-weight:700}
.fs-p.off .tx{opacity:.5}
.fs-ba{font-size:.95rem;color:var(--mute);margin-top:3px}
.fs-ba s{opacity:.8}.fs-ba .ar{color:var(--gold);margin:0 5px}.fs-ba .nw{color:var(--ink);background:#3f9a4a22;padding:0 4px;border-radius:3px}
.fs-ba .prose{display:inline}.fs-ba .prose p{display:inline;margin:0}.fs-ba .prose p+p{display:block;margin-top:.2em}
.fs-why{font-size:.85rem;color:var(--mute);font-style:italic;margin-top:3px}
.fs-tag{display:inline-block;font:600 .62rem/1 var(--display);letter-spacing:.06em;color:#fff;border-radius:4px;padding:3px 6px;vertical-align:2px;text-transform:uppercase;margin-right:4px}
.fs-foot{position:sticky;bottom:0;z-index:5;margin-top:16px;background:var(--paper);border:1px solid var(--line2);border-top:3px double var(--gold2);border-radius:10px 10px 0 0;padding:10px 14px;display:flex;flex-wrap:wrap;align-items:center;gap:10px;box-shadow:0 -4px 14px #0002}
.fs-foot .h{font-size:.9rem;color:var(--mute);font-style:italic;flex:1;min-width:200px;text-align:right}
.fs-live{white-space:pre-wrap;font-size:.85rem;color:var(--mute);max-height:180px;overflow:hidden;mask-image:linear-gradient(transparent,#000 40%)}`;
  let cssDone = false;
  const css = () => { if (cssDone) return; cssDone = true; const s = document.createElement('style'); s.textContent = CSS; document.head.append(s); };
  const api = () => window.__idee;
  const chiave = async () => (await api()?.chiave()) || null;
  const ora = d => new Date(d).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  const COL = { pg: 'var(--t-pg,#a8283a)', png: 'var(--t-png,#2a5ea8)', luogo: 'var(--t-luogo,#2e7a3c)', oggetto: 'var(--t-oggetto,#806b00)', fazione: 'var(--t-fazione,#7a3ea6)', missione: 'var(--t-missione,#b54c0c)', lore: 'var(--t-lore,#167a85)' };
  const NOMI = { pg: 'PG', png: 'PNG', luogo: 'Luogo', oggetto: 'Oggetto', fazione: 'Fazione', missione: 'Missione', lore: 'Lore' };
  const GRUPPI = [['missione', 'Missioni'], ['png', 'Personaggi non giocanti'], ['pg', 'Personaggi giocanti'], ['oggetto', 'Oggetti'], ['luogo', 'Luoghi'], ['fazione', 'Fazioni'], ['lore', 'Lore'], ['altro', 'Sessione e campagna']];
  const nomeDi = id => S.ents.get(id)?.name || id;
  const pulisci = t => String(t || '').replace(/\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g, (m, a, b) => b || nomeDi(a));

  /* ======================= 1. ASSISTENTE AL TAVOLO ======================= */
  const AS = { turns: [], busy: null, host: null, ctx: null, draft: '' };
  try { AS.turns = JSON.parse(localStorage.getItem('assistente-dm') || '[]').slice(-20); } catch { }
  const salvaTurni = () => { try { localStorage.setItem('assistente-dm', JSON.stringify(AS.turns.filter(t => !t.live).slice(-20))); } catch { } };
  const CHIPS = [['Cosa sa il party di ', 'Cosa sa il party di…'], ['Chi è ', 'Chi è…'], ['Regola: ', 'Regola'], ['Cosa succede se ', 'Cosa succede se…'], ['Un nome per ', 'Nome per un PNG']];

  function istruzioniAssistente(camp) {
    return `Sei l'assistente del Dungeon Master durante una partita di D&D 5e della campagna «${camp}», giocata su un tavolo virtuale. Il DM ti scrive di nascosto mentre gioca: i giocatori non vedono niente di quello che scrivi.
Rispondi in italiano, BREVE: al massimo 3–6 righe o un elenco di 3–5 punti, senza preamboli né saluti. La prima frase è la risposta secca, in **grassetto**.
- «Cosa sa il party di…»: distingui ciò che i PG sanno davvero (raccontato nelle sessioni) da ciò che sa solo il DM (parti [DM], schede non scoperte, segreti della scaletta). Se lo sa solo il DM, dillo chiaramente.
- Regole: usa le regole di D&D 5e e indica la regola o la condizione; se il manuale lascia spazio, proponi una decisione rapida da prendere al tavolo.
- Improvvisazione (nomi, PNG, descrizioni, «cosa succede se…»): proposte pronte da usare, adatte ai luoghi e alle culture della campagna.
- Non inventare fatti della campagna: se un'informazione non c'è, dillo; se proponi qualcosa di nuovo, scrivi «Idea:».
- Cita le schede con [[id]] o [[id|testo]] usando gli id tra parentesi quadre del contesto.
- Ultima riga, sempre: «Fonti:» e le fonti separate da « · » (per esempio: Sessione 4 · [[png-tobi|Scheda di Tobi]] · Scaletta, scena 2 · Regole 5e).
- Se proponi nomi per un PNG, prima delle fonti aggiungi una riga «Nomi: nome 1 | nome 2 | nome 3».`;
  }
  async function sistemaAssistente() {
    const camp = getMeta('campaign', { name: 'Campagna' }).name, sc = window.__scaletta?.corrente?.();
    const ctx = await api().contesto({ ctx: 'recent' });
    return istruzioniAssistente(camp) + '\n\n' + ctx + (sc ? `\n\n=== SCALETTA DELLA SESSIONE DA GIOCARE (${sc.n}${sc.title ? ' · ' + sc.title : ''}) — solo DM ===\n${sc.text}` : '');
  }
  function alTavolo() {
    const sc = window.__scaletta?.corrente?.(), L = [];
    if (sc?.scene.length) L.push('Scene della scaletta: ' + sc.scene.map((x, i) => `${i + 1}. ${x.t}${x.fatta ? ' (giocata)' : i === sc.ora ? ' (IN CORSO)' : ''}`).join('; '));
    const reg = AS.ctx?.registro?.() || '';
    if (reg) L.push('Ultimi messaggi e tiri al tavolo:\n' + reg);
    return L.length ? '=== AL TAVOLO ADESSO ===\n' + L.join('\n') + '\n\n' : '';
  }
  // «Fonti:» e «Nomi:» in fondo alla risposta diventano etichette e pulsanti
  function dividi(t) {
    let testo = String(t || ''), fonti = [], nomi = [];
    const f = testo.match(/\n\s*\**Fonti:?\**:?\s*(.+)\s*$/i); if (f) { fonti = f[1].split(/\s+·\s+|;\s*/).map(x => x.trim()).filter(Boolean); testo = testo.slice(0, f.index); }
    const n = testo.match(/\n\s*\**Nomi:?\**:?\s*(.+)\s*$/i); if (n) { nomi = n[1].split('|').map(x => x.replace(/\*+/g, '').trim()).filter(Boolean); testo = testo.slice(0, n.index); }
    return { testo: testo.trim(), fonti, nomi };
  }
  function rispostaHtml(t, i) {
    if (t.err) return `<div class="as-a err"><div class="as-who">Assistente</div>${esc(t.err)}${t.chiave ? '<div style="margin-top:6px"><button type="button" class="btn sm primary" data-as="collega">Collega Claude</button></div>' : ''}</div>`;
    const d = dividi(t.a || '');
    return `<div class="as-a"><div class="as-who">Assistente</div><div class="${t.live ? 'as-live' : ''}">${t.a ? prose(d.testo) : '<span class="hint">Ci penso…</span>'}</div>`
      + (d.nomi.length && !t.live ? `<div class="as-nm">${d.nomi.map(n => `${AS.ctx?.nuovoPng ? `<button type="button" class="btn sm" data-as="png" data-n="${esc(n)}" title="Crea la scheda di questo PNG al Tavolo (nascosta ai giocatori)">+ ${esc(n)}</button>` : `<button type="button" class="btn sm" data-as="copia" data-n="${esc(n)}" title="Copia il nome">${esc(n)}</button>`}`).join('')}</div>` : '')
      + (!t.live && t.a ? `<div class="as-src">${d.fonti.map(x => { const m = x.match(/^\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]$/); return m && S.ents.has(m[1]) ? `<a href="#/scheda/${encodeURIComponent(m[1])}" target="_blank" rel="noopener">${esc(m[2] || nomeDi(m[1]))}</a>` : `<span>${esc(pulisci(x))}</span>`; }).join('')}<span style="cursor:pointer;margin-left:auto" data-as="cp" data-i="${i}" title="Copia la risposta">📋 Copia</span></div>` : '') + '</div>';
  }
  function feedHtml() {
    if (!AS.turns.length) return `<div class="as-vuoto"><b>Chiedi quello che ti serve mentre giochi.</b><br>Per esempio: «Cosa sa il party di Tobi?», «Posso afferrare un nemico prono?», «Un nome per un marinaio». Claude conosce le sessioni, le schede (anche i segreti) e la scaletta di stasera. Le risposte le vedi solo tu.</div>`;
    return AS.turns.map((t, i) => `<div class="as-q">${esc(t.q)}</div>${rispostaHtml(t, i)}`).join('');
  }
  function disegna() {
    const h = AS.host; if (!h || !h.isConnected) return;
    const feed = h.querySelector('.as-feed'); if (!feed) return;
    feed.innerHTML = feedHtml(); feed.scrollTop = 1e9;
    const b = h.querySelector('.as-in button'); if (b) { b.classList.toggle('stop', !!AS.busy); b.textContent = AS.busy ? '■' : '➤'; b.title = AS.busy ? 'Ferma la risposta' : 'Chiedi'; }
  }
  async function chiedi(q) {
    q = String(q || '').trim(); if (!q || AS.busy) return;
    const k = await chiave(), t = { q, a: '', live: true, ts: Date.now() }; AS.turns.push(t);
    if (!k?.key) { t.live = false; t.err = 'Per usare l\'assistente collega Claude con la tua chiave API (la stessa della pagina Idee).'; t.chiave = true; disegna(); return; }
    AS.busy = new AbortController(); disegna();
    try {
      const prima = AS.turns.slice(0, -1).filter(x => x.a && !x.err).slice(-6).flatMap(x => [{ role: 'user', content: x.q }, { role: 'assistant', content: x.a }]);
      const system = await sistemaAssistente();
      const r = await api().callClaude({ system, messages: [...prima, { role: 'user', content: alTavolo() + '=== DOMANDA DEL DM ===\n' + q }], model: k.model, key: k.key, signal: AS.busy.signal, effort: 'low', max: 6000, onText: x => { t.a = x; const el = AS.host?.querySelector('.as-feed .as-live'); if (el) { el.innerHTML = prose(dividi(x).testo); AS.host.querySelector('.as-feed').scrollTop = 1e9; } } });
      t.a = r.text;
    } catch (e) { if (e.name === 'AbortError') t.a = (t.a || '') + '\n\n*(interrotta)*'; else t.err = e.message; }
    t.live = false; AS.busy = null; salvaTurni(); disegna();
  }
  function pannello(host, ctx = {}) {
    if (!host) return; css(); AS.host = host; AS.ctx = ctx;
    const sc = window.__scaletta?.corrente?.(), ult = S.sess[S.sess.length - 1];
    host.innerHTML = `<div class="as"><div class="as-hd"><span aria-hidden="true">✨</span><b>Assistente del DM</b><span class="lk">🔒 Solo tu lo vedi</span>${AS.turns.length ? '<button type="button" data-as="nuova" title="Cancella la conversazione">Nuova</button>' : ''}</div>
      <div class="as-ctx">Conosce la campagna fino a <b>${ult ? 'Sessione ' + ult.n : 'oggi'}</b>${sc ? `, la scaletta «${esc(sc.title || 'Sessione ' + sc.n)}»` : ''} e gli ultimi messaggi e tiri del Tavolo.</div>
      <div class="as-feed" aria-live="polite"></div>
      <div class="as-chips">${CHIPS.map(([p, l]) => `<button type="button" data-p="${esc(p)}">${esc(l)}</button>`).join('')}</div>
      <div class="as-in"><textarea rows="1" placeholder="Chiedi all'assistente…" aria-label="Domanda per l'assistente">${esc(AS.draft)}</textarea><button type="button">➤</button></div></div>`;
    const ta = host.querySelector('textarea'), cresci = () => { ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; };
    const invia = () => { const q = ta.value; ta.value = ''; AS.draft = ''; cresci(); chiedi(q); };
    ta.oninput = () => { AS.draft = ta.value; cresci(); };
    ta.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); invia(); } };
    host.querySelector('.as-in button').onclick = () => AS.busy ? AS.busy.abort() : invia();
    host.querySelectorAll('.as-chips button').forEach(b => b.onclick = () => { ta.value = b.dataset.p; AS.draft = ta.value; ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); cresci(); });
    host.querySelector('.as').onclick = async e => {
      const b = e.target.closest('[data-as]'); if (!b) return;
      const a = b.dataset.as;
      if (a === 'nuova') { if (AS.busy) AS.busy.abort(); AS.turns = []; salvaTurni(); pannello(host, ctx); }
      else if (a === 'collega') { if (await api()?.collega()) { AS.turns = AS.turns.filter(t => !t.chiave); disegna(); } }
      else if (a === 'copia') copyText(b.dataset.n, 'Nome copiato');
      else if (a === 'cp') copyText(pulisci(dividi(AS.turns[+b.dataset.i]?.a).testo).replace(/\*\*/g, ''), 'Risposta copiata');
      else if (a === 'png') { b.disabled = true; try { await ctx.nuovoPng(b.dataset.n); b.textContent = '✓ ' + b.dataset.n; } catch (x) { b.disabled = false; toast(x.message, 'err'); } }
    };
    disegna(); cresci();
  }

  /* ======================= 2. FINE SESSIONE ======================= */
  const FS = { reg: null, regErr: '', opz: null, j: null, raw: '', sel: new Set(), busy: null, live: '', err: '', fatto: null };
  const DA = [['12', 'Ultime 12 ore'], ['48', 'Ultimi 2 giorni'], ['168', 'Ultima settimana'], ['0', 'Tutta la chat']];
  const opzioni = () => {
    const sc = window.__scaletta?.corrente?.(), last = S.sess.length ? S.sess[S.sess.length - 1].n : 0;
    const p = pref('fine-sessione', {}), n = sc && !S.sess.some(s => s.n === sc.n && !s.ongoing) ? sc.n : last + 1;
    return { n, titolo: sc?.n === n ? sc.title : '', da: p.da || '48', note: '', generale: p.generale !== false };
  };

  async function leggiRegistro(ore) {
    const sb = await window.__sbDM?.(); if (!sb) throw new Error('Il Tavolo non è raggiungibile.');
    const da = +ore ? new Date(Date.now() - ore * 3600e3).toISOString() : '2000-01-01';
    const tutte = async (t, col) => { const out = []; for (let i = 0; i < 10; i++) { const r = await sb.from(t).select('*').gte(col, da).order(col, { ascending: true }).range(i * 1000, i * 1000 + 999); if (r.error) throw new Error(r.error.message); out.push(...r.data); if (r.data.length < 1000) break; } return out; };
    const [chat, tiri, cons, mb] = await Promise.all([tutte('tavolo_chat', 'creato'), tutte('tavolo_tiri', 'creato'), tutte('tavolo_consegne', 'creata').catch(() => []), sb.from('tavolo_membri').select('*')]);
    return { chat, tiri, cons, membri: mb.error ? [] : mb.data };
  }
  function testoRegistro(reg) {
    const chi = g => g === 'dm' ? 'DM' : reg.membri.find(m => m.giocatore === g)?.nome || g;
    const righe = [
      ...reg.chat.map(m => [m.creato, `${m.nome}${m.per ? ' (sussurra a ' + chi(m.per) + ')' : ''}: ${m.testo}`]),
      ...reg.tiri.map(t => [t.creato, `🎲 ${t.nome}${t.motivo ? ' · ' + t.motivo : ''}: ${t.formula} = ${t.totale}${t.privato ? ' (nascosto)' : ''}`]),
      ...reg.cons.map(c => [c.creata, `🎁 Il DM consegna ${c.tipo === 'oggetto' ? 'l\'oggetto' : 'il documento'} «${c.nome}» a ${c.pubblica ? 'tutti' : (c.a || []).map(chi).join(', ') || '—'}`])
    ].sort((a, b) => a[0] < b[0] ? -1 : 1).map(([d, t]) => `[${new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })} ${ora(d)}] ${t}`);
    let s = righe.join('\n');
    if (s.length > 150000) s = '(…inizio tagliato…)\n' + s.slice(s.length - 150000);
    return s;
  }
  const REV = `=== REVISIONE DI FINE SESSIONE ===
Questa volta non ti incollo un riassunto: ti do il REGISTRO DEL TAVOLO VIRTUALE della serata (messaggi in chat, tiri di dado, oggetti e documenti consegnati), la SCALETTA che il DM aveva preparato con le scene segnate come giocate, e le NOTE del DM. Ricostruisci tu cosa è successo e rispondi SOLO con il JSON nel formato descritto sopra.
- "sessioni": una sola, con il numero e il titolo che ti indico, "breve" (1–2 frasi) e "riassunto" completo: scorrevole, in italiano, al passato, dal punto di vista del party (3–6 paragrafi).
- Conta ciò che è SUCCESSO: chat, tiri, consegne, scene segnate come giocate, note del DM. La scaletta dice cosa era previsto: le scene non giocate NON sono successe, e i dettagli della scaletta valgono solo se la chat o le note confermano che si sono svolti.
- Le cose che i giocatori non devono sapere (segreti, retroscena della scaletta) vanno tra [DM] e [/DM].
- Aggiorna le schede toccate in "entita_aggiornate": stato dei PNG (sconfitti, morti, alleati), missioni (completate, nuove), PG (cosa è cambiato per loro), oggetti consegnati (a chi), luoghi visitati. Le schede nuove vanno in "entita_nuove"; se i PG non le conoscono ancora, "scoperto": false.
- "eventi": i momenti chiave della serata.
- Aggiungi il campo "perche": un oggetto che a ogni id di scheda (o nome di scheda nuova) associa UNA frase breve su da dove ricavi la modifica (per esempio «chat delle 21:14», «tiro di Violet», «scena 3 giocata», «note del DM»).`;

  async function chiediProposte(o) {
    const k = await chiave(); if (!k?.key) { if (await api()?.collega()) return chiediProposte(o); return; }
    FS.busy = new AbortController(); FS.live = ''; FS.err = ''; FS.j = null; disegnaFS();
    try {
      const sc = window.__scaletta?.corrente?.(o.n);
      const system = await buildContext() + '\n\n' + REV + (o.generale ? '' : '\n- NON includere "riassunto_generale".');
      const user = [`=== SESSIONE ${o.n}${o.titolo ? ' · ' + o.titolo : ''} ===`,
        sc ? `\n=== SCALETTA PREPARATA DAL DM (solo DM) ===\nScene: ${sc.scene.map((x, i) => `${i + 1}. ${x.t} ${x.fatta ? '✓ giocata' : '✗ non segnata come giocata'}`).join('; ')}\n\n${sc.text}` : '\n(Nessuna scaletta preparata.)',
        `\n=== REGISTRO DEL TAVOLO ===\n${FS.reg ? testoRegistro(FS.reg) || '(vuoto)' : '(non disponibile)'}`,
        `\n=== NOTE DEL DM ===\n${o.note.trim() || '(nessuna)'}`].join('\n');
      const r = await api().callClaude({ system, messages: [{ role: 'user', content: user }], model: k.model, key: k.key, signal: FS.busy.signal, effort: 'medium', max: 32000, onText: x => { FS.live = x; const el = $('#fs-live'); if (el) { el.textContent = x.slice(-900); $('#fs-n').textContent = x.length.toLocaleString('it-IT'); } } });
      FS.raw = r.text;
      if (r.stop === 'max_tokens') throw new Error('La risposta di Claude è troppo lunga ed è stata interrotta: riprova con meno ore di chat.');
      const j = parseLoose(r.text); if (!j || typeof j !== 'object') throw new Error('Claude non ha risposto nel formato giusto: riprova.');
      if (!Array.isArray(j.sessioni) && j.sessione) j.sessioni = [j.sessione];
      if (!j.sessioni?.length) j.sessioni = [{ numero: o.n, titolo: o.titolo }];
      j.sessioni = [{ ...j.sessioni[0], numero: o.n, ...(o.titolo ? { titolo: o.titolo } : {}) }]; delete j.sessione;
      FS.j = j; FS.sel = new Set(proposte(j).map(p => p.k));
    } catch (e) { FS.err = e.name === 'AbortError' ? 'Richiesta interrotta.' : e.message; }
    FS.busy = null; disegnaFS();
  }

  // ogni proposta: { k, gruppo, tipo, nome, nuovo, righe (html), why, edit }
  function proposte(j) {
    const out = [], why = j.perche || {};
    (j.entita_aggiornate || []).forEach((u, i) => {
      const id = String(u.id ?? ''), e = S.ents.get(id) || [...S.ents.values()].find(x => norm(x.name) === norm(u.nome || u.id)); if (!e) return;
      const R = [];
      if (u.nome && u.nome !== e.name) R.push(`<s>${esc(e.name)}</s><span class="ar">→</span><span class="nw">${esc(u.nome)}</span>`);
      if (u.stato != null && u.stato !== e.status) R.push(`${e.status ? `<s>${esc(e.status)}</s><span class="ar">→</span>` : 'Stato: '}<span class="nw">${esc(u.stato)}</span>`);
      if (u.scoperto != null && !!u.scoperto !== (e.discovered !== false)) R.push(u.scoperto ? 'Diventa visibile ai giocatori' : 'Torna nascosta ai giocatori');
      if (u.breve && u.breve !== e.brief) R.push('In breve: ' + esc(pulisci(u.breve)));
      for (const a of u.aggiunte || []) R.push(`<b>${esc(a.sezione || a.titolo || 'Note')}:</b> ${md(a.testo || '')}`);
      for (const r of u.relazioni_aggiunte || u.relazioni || []) R.push(`Relazione: ${esc(r.etichetta || '→')} ${esc(nomeDi(r.con))}`);
      if (!R.length) return;
      out.push({ k: 'u' + i, gruppo: GRUPPI.some(g => g[0] === e.type) ? e.type : 'lore', tipo: e.type, nome: u.nome || e.name, righe: R, why: why[id] || why[e.name] || '', ref: ['entita_aggiornate', i], id: e.id });
    });
    (j.entita_nuove || []).forEach((e, i) => {
      const t = typeOf(e.tipo) || 'lore', R = [];
      if (e.breve) R.push(esc(pulisci(e.breve)));
      if (e.stato) R.push('Stato: <span class="nw">' + esc(e.stato) + '</span>');
      for (const s of (e.sezioni || []).slice(0, 2)) R.push(`<b>${esc(s.titolo || 'Note')}:</b> ${md(s.testo || '')}`);
      R.push(e.scoperto === false ? '🔒 Nascosta ai giocatori' : '👁 Visibile ai giocatori');
      out.push({ k: 'n' + i, gruppo: t, tipo: t, nome: e.nome, nuovo: true, righe: R, why: why[e.id] || why[e.nome] || '', ref: ['entita_nuove', i] });
    });
    if (j.eventi?.length) out.push({ k: 'ev', gruppo: 'altro', tag: 'Momenti', nome: `Momenti chiave della sessione (${j.eventi.length})`, righe: [`<ul style="margin:.2em 0;padding-left:1.2em">${j.eventi.map(e => `<li>${esc(pulisci(e.titolo || e.testo))}</li>`).join('')}</ul>`] });
    if (typeof j.riassunto_generale === 'string' && j.riassunto_generale.trim()) out.push({ k: 'gen', gruppo: 'altro', tag: 'Campagna', nome: 'Riassunto generale aggiornato', righe: [esc(pulisci(j.riassunto_generale).slice(0, 260)) + (j.riassunto_generale.length > 260 ? '…' : '')], edit: 'gen' });
    return out;
  }
  // il JSON con le sole proposte tenute, pronto per planImport
  function filtrato() {
    const j = clone(FS.j), keep = (l, p) => (l || []).filter((_, i) => FS.sel.has(p + i));
    j.entita_aggiornate = keep(j.entita_aggiornate, 'u'); j.entita_nuove = keep(j.entita_nuove, 'n');
    if (!FS.sel.has('ev')) delete j.eventi; if (!FS.sel.has('gen')) delete j.riassunto_generale;
    delete j.perche; j.formato = 'cronache/1';
    return j;
  }
  const KEYF = { meta: 'k', entities: 'id', bodies: 'id', sessions: 'n', sbodies: 'n', events: 'id', maps: 'id', blobs: 'id', pins: 'id', links: 'k', regions: 'id' };
  async function creaBozza() {
    const P = await planImport(JSON.stringify(filtrato()));
    if (P.errors.length) { toast(P.errors[0], 'err'); return; }
    const nuove = P.writes.filter(w => w.s !== 'blobs').map(w => {
      if (w.del) return { c: w.s, id: String(w.k), del: 1 };
      const id = String(w.v[KEYF[w.s]]), esiste = ['sessions', 'sbodies'].includes(w.s) ? S.sess.some(s => s.n === w.v.n) : ['entities', 'bodies'].includes(w.s) ? S.ents.has(id) : true;
      return { c: w.s, id, v: w.v, ...(esiste ? {} : { nuovo: 1 }) };
    });
    const s = FS.j.sessioni[0], titolo = `Sessione ${s.numero}${s.titolo ? ' · ' + s.titolo : ''}`;
    const vecchia = getMeta('bozza', null) || { titoli: [], ops: [] }, tutte = new Map((vecchia.ops || []).map(o => [o.c + '|' + o.id, o]));
    for (const o of nuove) tutte.set(o.c + '|' + o.id, o);
    const bz = { titoli: [...(vecchia.titoli || []).filter(t => t !== titolo), titolo], creata: vecchia.creata || Date.now(), agg: Date.now(), ops: [...tutte.values()] };
    await runBatch(['meta'], 'Bozza di Claude', async b => b.put('meta', { k: 'bozza', v: bz }));
    FS.fatto = { titolo, n: nuove.length, avvisi: P.warns.filter(w => !/esisteva già/.test(w)) };
    disegnaFS();
  }

  async function modifica(p) {
    if (p.edit === 'gen') {
      const r = await formDlg({ title: 'Riassunto generale', ok: 'Fatto', fields: [{ k: 't', label: 'Testo', type: 'textarea', rows: 12, value: FS.j.riassunto_generale }] });
      if (r) FS.j.riassunto_generale = r.t; return disegnaFS();
    }
    const [l, i] = p.ref, x = FS.j[l][i];
    if (l === 'entita_aggiornate') {
      const ag = x.aggiunte || [];
      const r = await formDlg({ title: 'Modifica · ' + p.nome, ok: 'Fatto', fields: [{ k: 'stato', label: 'Stato', value: x.stato ?? '' }, { k: 'breve', label: 'In breve (una riga)', value: x.breve ?? '' }, ...ag.map((a, k) => ({ k: 'a' + k, label: 'Aggiunta a «' + (a.sezione || a.titolo || 'Note') + '»', type: 'textarea', rows: 4, value: a.testo || '' }))] });
      if (!r) return;
      x.stato = r.stato.trim() || null; x.breve = r.breve.trim() || null; ag.forEach((a, k) => { a.testo = r['a' + k]; }); x.aggiunte = ag.filter(a => String(a.testo || '').trim());
    } else {
      const sz = x.sezioni || [];
      const r = await formDlg({ title: 'Modifica · ' + p.nome, ok: 'Fatto', fields: [{ k: 'nome', label: 'Nome', value: x.nome || '' }, { k: 'tipo', label: 'Tipo', type: 'select', value: typeOf(x.tipo) || 'lore', options: Object.entries(NOMI) }, { k: 'breve', label: 'In breve (una riga)', value: x.breve || '' }, { k: 'stato', label: 'Stato', value: x.stato || '' }, ...sz.map((s, k) => ({ k: 's' + k, label: s.titolo || 'Note', type: 'textarea', rows: 4, value: s.testo || '' })), { k: 'nasc', label: 'Nascosta ai giocatori', type: 'check', value: x.scoperto === false }] });
      if (!r) return;
      Object.assign(x, { nome: r.nome.trim() || x.nome, tipo: r.tipo, breve: r.breve, stato: r.stato, scoperto: !r.nasc }); sz.forEach((s, k) => { s.testo = r['s' + k]; });
    }
    disegnaFS();
  }
  async function riscrivi(come) {
    const k = await chiave(); if (!k?.key) return;
    const ta = $('#fs-sum'), s = FS.j.sessioni[0]; s.riassunto = ta.value;
    const btns = [...document.querySelectorAll('[data-fs=breve],[data-fs=epico]')]; btns.forEach(b => b.disabled = true); ta.disabled = true;
    try {
      const r = await api().callClaude({ system: 'Riscrivi il riassunto di una sessione di D&D che ti manda il DM. Rispondi SOLO con il nuovo testo, senza titoli né commenti. Mantieni i fatti, i nomi, i link [[id]] o [[id|testo]] e le parti tra [DM] e [/DM] (che restano nascoste ai giocatori).', messages: [{ role: 'user', content: (come === 'breve' ? 'Rendilo più breve: circa metà della lunghezza, solo i fatti importanti.' : 'Rendilo più epico e coinvolgente, come una cronaca da leggere ad alta voce, senza allungarlo troppo.') + '\n\n' + s.riassunto }], model: k.model, key: k.key, effort: 'low', max: 8000, onText: x => { ta.value = x; } });
      s.riassunto = r.text.trim();
    } catch (e) { toast(e.message, 'err'); }
    disegnaFS();
  }

  function disegnaFS() {
    if (!location.hash.startsWith('#/fine-sessione')) return;
    const o = FS.opz, step = FS.fatto ? 3 : FS.j ? 2 : 1, reg = FS.reg;
    const passi = ['Cosa è successo', 'Proposte di Claude', 'Bozza da controllare'].map((t, i) => `<span class="${i + 1 < step ? 'ok' : i + 1 === step ? 'on' : ''}">${i + 1 < step ? '✓ ' : ''}${i + 1} · ${t}</span>`).join('');
    const sc = window.__scaletta?.corrente?.(o.n);
    const letto = `<div class="card fs-read"><h3 style="margin-top:0">Cosa ho letto</h3>${FS.regErr ? `<p class="hint">${esc(FS.regErr)}</p>` : !reg ? '<p class="hint">Leggo il Tavolo…</p>' : `
      <div>Messaggi in chat<b>${reg.chat.length}</b></div><div>Tiri di dado<b>${reg.tiri.length}</b></div><div>Oggetti e documenti consegnati<b>${reg.cons.length}</b></div>`}
      ${sc ? `<div>Scene giocate<b>${sc.scene.filter(x => x.fatta).length} di ${sc.scene.length}</b></div><ul class="fs-sc">${sc.scene.map((x, i) => `<li class="${x.fatta ? '' : 'no'}">${x.fatta ? '✓' : '○'} ${i + 1}. ${esc(x.t)}</li>`).join('')}</ul>` : '<div>Scaletta<b>—</b></div>'}
      ${o.note.trim() ? '<div>Tue note<b>✓</b></div>' : ''}</div>`;
    let corpo;
    if (step === 1) {
      corpo = `<div class="fs-grid"><div class="fs-side">${letto}</div><div class="card">
        <p class="lead" style="margin-top:0">Claude legge la chat, i tiri e gli oggetti consegnati al Tavolo, insieme alla scaletta e alle tue note, e ti propone il riassunto della sessione e gli aggiornamenti alle schede. Niente va online finché non lo controlli tu.</p>
        <div class="idee-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:0 14px">
          <label>Sessione numero<input type="number" id="fs-n0" min="1" value="${o.n}"></label>
          <label>Titolo<input type="text" id="fs-t" value="${esc(o.titolo)}" placeholder="Lo propone Claude"></label>
          <label>Chat da leggere<select id="fs-da">${DA.map(([v, l]) => `<option value="${v}" ${v === o.da ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
        <label>Cosa vuoi aggiungere tu<textarea id="fs-note" rows="5" placeholder="Quello che non è scritto in chat: scene giocate a voce, decisioni dei giocatori, cosa ti ha colpito…">${esc(o.note)}</textarea></label>
        <label class="chk"><input type="checkbox" id="fs-gen" ${o.generale ? 'checked' : ''}> <span>Aggiorna anche il riassunto generale della campagna</span></label>
        ${FS.err ? `<p class="hint" style="color:#a3291f">⚠ ${esc(FS.err)}</p>` : ''}
        ${FS.busy ? `<div class="card" style="background:var(--paper2);margin:10px 0 0"><b>Claude sta leggendo la serata…</b> <span class="hint"><span id="fs-n">${FS.live.length.toLocaleString('it-IT')}</span> caratteri</span><div class="fs-live" id="fs-live">${esc(FS.live.slice(-900))}</div><div class="row" style="margin-top:8px"><button class="btn" data-fs="stop">Ferma</button></div></div>`
          : `<div class="row" style="margin-top:12px"><button class="btn primary" data-fs="via">✨ Chiedi a Claude le proposte</button></div>`}</div></div>`;
    } else if (step === 2) {
      const L = proposte(FS.j), s = FS.j.sessioni[0], n = L.filter(p => FS.sel.has(p.k)).length;
      corpo = `<div class="fs-grid"><div class="fs-side">${letto}</div><div>
        <div class="card"><h3 style="margin-top:0">Riassunto proposto${s.titolo ? ' · «' + esc(s.titolo) + '»' : ''}</h3>
          <textarea class="fs-sum" id="fs-sum" spellcheck="true">${esc(s.riassunto || '')}</textarea>
          <div class="row" style="margin-top:8px"><button class="btn sm" data-fs="breve">Riscrivi più breve</button><button class="btn sm" data-fs="epico">Più epico</button><span class="hint">Le parti tra [DM] e [/DM] restano nascoste ai giocatori.</span></div></div>
        <div class="card" style="margin-top:14px"><h3 style="margin-top:0">Aggiornamenti proposti <span class="hint" style="font-family:var(--body);text-transform:none;letter-spacing:0">· ${n} di ${L.length} tenuti</span></h3>
          ${L.length ? GRUPPI.map(([g, t]) => { const l = L.filter(p => p.gruppo === g); return l.length ? `<div class="fs-grp">${t}</div>` + l.map(p => `<div class="fs-p ${FS.sel.has(p.k) ? '' : 'off'}"><input type="checkbox" data-k="${p.k}" ${FS.sel.has(p.k) ? 'checked' : ''} aria-label="Tieni: ${esc(p.nome)}"><div class="tx"><span class="fs-tag" style="background:${p.tipo ? COL[p.tipo] : 'var(--wine)'}">${p.nuovo ? 'Nuova · ' : ''}${esc(p.tipo ? NOMI[p.tipo] : p.tag)}</span><span class="nm">${p.id ? `<a href="#/scheda/${encodeURIComponent(p.id)}" target="_blank" rel="noopener">${esc(p.nome)}</a>` : esc(p.nome)}</span>${p.righe.map(r => `<div class="fs-ba">${r}</div>`).join('')}${p.why ? `<div class="fs-why">Da: ${esc(p.why)}</div>` : ''}</div>${p.ref || p.edit ? `<button class="btn sm" data-fs="mod" data-k="${p.k}">Modifica</button>` : ''}</div>`).join('') : ''; }).join('') : '<p class="hint">Claude non propone aggiornamenti alle schede: resta solo il riassunto.</p>'}
        </div></div></div>
        <div class="fs-foot"><b style="font-family:var(--display)">${n} aggiornament${n === 1 ? 'o' : 'i'} + riassunto</b><button class="btn" data-fs="scarta">Scarta tutto</button><button class="btn" data-fs="rifai">Chiedi di nuovo</button><span class="h">Poi la controlli con «Controlla» e la mandi online con «Salva».</span><button class="btn primary" data-fs="bozza">Crea la bozza →</button></div>`;
    } else {
      corpo = `<div class="card" style="max-width:720px"><h3 style="margin-top:0">✓ Bozza pronta: ${esc(FS.fatto.titolo)}</h3>
        <p>${FS.fatto.n} modifiche sono nella bozza. I giocatori non vedono ancora niente.</p>
        <p>Nel riquadro in basso premi <b>«Controlla»</b> per rivedere tutto, correggere e vedere chi vedrà cosa. Quando va bene, premi <b>«Salva»</b> e le modifiche vanno online.</p>
        ${FS.fatto.avvisi.length ? `<details><summary class="hint">Note sull'importazione (${FS.fatto.avvisi.length})</summary><ul>${FS.fatto.avvisi.map(w => `<li class="hint">${esc(w)}</li>`).join('')}</ul></details>` : ''}
        <div class="row" style="margin-top:12px"><button class="btn primary" data-fs="controlla">Controlla adesso</button><a class="btn" href="#/sessioni">Vai alle sessioni</a><button class="btn" data-fs="nuova">Nuova revisione</button></div></div>`;
    }
    setView(`<div class="pagehead"><h1>Fine sessione${o.n ? ' · Sessione ' + o.n : ''}</h1><div class="acts"><span class="pill dm">🔒 solo DM</span><a class="btn" href="#/tavolo">⚔️ Al Tavolo</a></div></div><div class="orn"></div><div class="fs-steps">${passi}</div>${corpo}`);
    const leggi = () => { const g = id => $(id); if (!g('#fs-n0')) return; o.n = Math.max(1, Math.round(+g('#fs-n0').value || o.n)); o.titolo = g('#fs-t').value.trim(); o.note = g('#fs-note').value; o.generale = g('#fs-gen').checked; if (g('#fs-da').value !== o.da) { o.da = g('#fs-da').value; ricarica(); } setPref('fine-sessione', { da: o.da, generale: o.generale }); };
    document.querySelectorAll('#fs-n0,#fs-t,#fs-note,#fs-gen,#fs-da').forEach(x => { x.onchange = leggi; if (x.id !== 'fs-da') x.oninput = leggi; });
    const sum = $('#fs-sum'); if (sum) sum.oninput = () => { FS.j.sessioni[0].riassunto = sum.value; };
    document.querySelectorAll('.fs-p input[data-k]').forEach(c => c.onchange = () => { if (c.checked) FS.sel.add(c.dataset.k); else FS.sel.delete(c.dataset.k); disegnaFS(); });
    document.querySelectorAll('[data-fs]').forEach(b => b.onclick = async () => {
      const a = b.dataset.fs;
      if (a === 'via') { leggi(); chiediProposte(o); }
      else if (a === 'stop') FS.busy?.abort();
      else if (a === 'breve' || a === 'epico') riscrivi(a);
      else if (a === 'mod') { const p = proposte(FS.j).find(x => x.k === b.dataset.k); if (p) modifica(p); }
      else if (a === 'scarta') { if (await ask('Scartare tutte le proposte di Claude? Il riassunto e gli aggiornamenti andranno persi.', { danger: true, ok: 'Scarta' })) { FS.j = null; disegnaFS(); } }
      else if (a === 'rifai') { if (await ask('Chiedere a Claude nuove proposte? Quelle di adesso, con le tue modifiche, andranno perse.', { ok: 'Chiedi di nuovo' })) { FS.j = null; chiediProposte(o); } }
      else if (a === 'bozza') { b.disabled = true; try { await creaBozza(); } catch (e) { b.disabled = false; toast(e.message, 'err'); } }
      else if (a === 'controlla') { const x = [...document.querySelectorAll('#outbox button')].find(y => /Controlla/.test(y.textContent)); if (x) x.click(); else toast('Il riquadro della bozza compare in basso a destra tra un attimo.'); }
      else if (a === 'nuova') { FS.j = null; FS.fatto = null; FS.opz = opzioni(); ricarica(); }
    });
  }
  function ricarica() {
    FS.reg = null; FS.regErr = ''; disegnaFS();
    leggiRegistro(+FS.opz.da).then(r => { FS.reg = r; }, e => { FS.regErr = 'Non riesco a leggere il Tavolo (' + e.message + '). Puoi scrivere tu cosa è successo nelle note.'; }).then(() => { if (!FS.j) disegnaFS(); });
  }

  route(/^\/fine-sessione$/, async () => {
    await claude.use('db');
    if (window.__RO) { setView('<div class="empty"><h2>Pagina riservata al Dungeon Master</h2><p><a href="#/">Torna alla campagna</a></p></div>'); return; }
    css(); window.__idee || await new Promise(r => setTimeout(r, 50));
    if (!FS.opz || (!FS.j && !FS.busy && !FS.fatto)) { FS.opz = opzioni(); ricarica(); } else disegnaFS();
  });

  window.__assistente = { pannello, css };
})();

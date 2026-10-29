/* Campagna D&D — «Idee»: Claude propone oneshot e sessioni partendo dalla storia della campagna.
   Solo per il Dungeon Master. Usa le funzioni della pagina principale (route, setView, S, md…).
   Le idee salvate e la chiave di Claude stanno in un database separato di questo browser
   ('campagna-dnd-idee'): non finiscono mai in data.json né nella copia per i giocatori. */
(() => {
  'use strict';
  const rq = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  let IDB = null;
  const idb = async () => IDB || (IDB = await new Promise((res, rej) => {
    const r = indexedDB.open('campagna-dnd-idee', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('ideas', { keyPath: 'id' }); r.result.createObjectStore('kv'); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const st = async (s, m = 'readonly') => (await idb()).transaction(s, m).objectStore(s);
  const kvGet = async k => rq((await st('kv')).get(k));
  const kvSet = async (k, v) => rq((await st('kv', 'readwrite')).put(v, k));
  const ideasAll = async () => (await rq((await st('ideas')).getAll())).sort((a, b) => b.ts - a.ts);
  const ideaGet = async id => rq((await st('ideas')).get(id));
  const ideaPut = async v => rq((await st('ideas', 'readwrite')).put(v));
  const ideaDel = async id => rq((await st('ideas', 'readwrite')).delete(id));

  const MODELS = [['claude-opus-5-5', 'Claude Opus 5.5 (consigliato)', 4, 20], ['claude-sonnet-5-5', 'Claude Sonnet 5.5 (più economico)', 2, 10]];
  const KINDS = {
    next: ['Prossima sessione', 'la PROSSIMA SESSIONE della campagna: deve ripartire esattamente da dove si è interrotta l\'ultima sessione giocata e far avanzare i fili aperti'],
    oneshot: ['Oneshot', 'una ONESHOT autoconclusiva ambientata nel mondo della campagna: può usare i PG oppure altri personaggi (pregenerati, in un altro tempo o luogo, un flashback, il punto di vista di un PNG), senza contraddire la campagna principale e magari arricchendola'],
    side: ['Missione secondaria', 'una MISSIONE SECONDARIA da inserire nella campagna tra una sessione principale e l\'altra, legata ai luoghi e ai PNG che il party sta frequentando'],
    arc: ['Arco narrativo', 'un ARCO NARRATIVO di 3–5 sessioni, con la scaletta sessione per sessione e il punto d\'arrivo']
  };
  const TONES = ['Avventura', 'Mistero e indagine', 'Horror', 'Intrigo politico', 'Esplorazione', 'Azione e combattimento', 'Dramma personale', 'Comico'];
  const LENGTHS = { serata: 'una serata di gioco (3–4 ore)', breve: 'una sessione breve (1–2 ore)', lunga: 'una sessione lunga o divisa in due serate' };
  // sezioni facoltative da aggiungere a ogni proposta: [chiave, etichetta, istruzione per Claude]
  const EXTRAS = [
    ['bottino', 'Bottino', '### Bottino\nCosa si trova scena per scena: monete, gemme, armi, armature, pozioni, oggetti magici, risorse e materiali. Per ogni oggetto: nome, dove si trova, valore in monete, rarità secondo la 5e e proprietà meccaniche, adatti al livello del party. Segna «Novità» gli oggetti inventati.'],
    ['stat', 'Statistiche dei nemici', '### Statistiche dei nemici\nPer ogni nemico e PNG combattente: CA, PF, velocità, caratteristiche principali, attacchi con bonus e danni, capacità speciali e CD, oppure il mostro del Manuale dei Mostri da usare e come modificarlo.'],
    ['leggi', 'Testi da leggere', '### Testi da leggere\nPer ogni scena un breve testo descrittivo da leggere ad alta voce ai giocatori, in seconda persona plurale.'],
    ['dialoghi', 'Dialoghi dei PNG', '### Dialoghi dei PNG\nPer ogni PNG importante: come parla, un tic o un gesto, e 2–3 battute pronte da usare.'],
    ['dispense', 'Dispense', '### Dispense\nIl testo completo di lettere, biglietti, avvisi, pagine di diario o mappe descritte da consegnare ai giocatori, già scritti come li leggerebbero i PG.'],
    ['immagini', 'Prompt per immagini', '### Prompt per immagini\nPer ogni luogo principale un prompt in inglese per un generatore di immagini, con uno stile comune per tutte (dark fantasy, illustrazione pittorica, senza testo), seguito da una frase in italiano da leggere al tavolo.'],
    ['musica', 'Musica e atmosfera', '### Musica e atmosfera\nPer ogni scena il tipo di musica e di suoni d\'ambiente adatti, con qualche esempio di brano o di ricerca da fare su YouTube.'],
  ];
  const DEF = { kind: 'next', count: 3, length: 'serata', tones: [], extras: ['bottino'], focus: [], level: '', note: '', ctx: 'recent', docs: false };
  const RECENT = 3; // sessioni recenti raccontate per intero nel contesto «Ultime sessioni»

  const now = () => new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
  const tokOf = s => Math.round(s.length / 3.6);
  const BIG = 40000;
  const flat = s => String(s || '').replace(/\s+/g, ' ').trim();

  /* ---------- contesto della campagna (completo: è solo per il DM) ---------- */
  async function campaignText(o) {
    // tre misure di contesto: «full» tutto, «recent» per intero solo le ultime sessioni e le schede che vi compaiono,
    // «short» il minimo (brevi delle sessioni, schede in primo piano): resta piccolo anche per l'app di Claude
    const mode = ['full', 'short'].includes(o.ctx) ? o.ctx : 'recent', full = mode === 'full', focus = new Set(o.focus);
    const recentFrom = S.sess.length ? S.sess[Math.max(0, S.sess.length - (mode === 'short' ? 1 : RECENT))].n : 0;
    const camp = getMeta('campaign', { name: 'Campagna' }).name, gen = getMeta('general', null), arcs = getMeta('arcs', []);
    const sb = new Map((await dbAll('sbodies')).map(b => [b.n, b]));
    const evs = (await dbAll('events')).sort((a, b) => a.n - b.n || a.idx - b.idx);
    const bodies = new Map((await dbAll('bodies')).map(b => [b.id, b]));
    const links = await dbAll('links');
    const L = [`=== CAMPAGNA: ${camp} ===`, '', '--- RIASSUNTO GENERALE ---', gen?.text || '(vuoto)'];
    if (arcs.length) { L.push('', '--- ARCHI NARRATIVI ---'); for (const a of arcs) L.push(`${a.title} (sessioni ${a.from ?? '?'}–${a.to ?? 'in corso'}): ${flat(a.summary)}`); }
    L.push('', `--- SESSIONI GIOCATE (${S.sess.length}) ---`);
    for (const s of S.sess) {
      L.push('', `## Sessione ${s.n}${s.title ? ' · ' + s.title : ''}${s.gameDate ? ' (in gioco: ' + s.gameDate + ')' : ''}`);
      const b = sb.get(s.n);
      const whole = full || s.n >= recentFrom;
      if (whole && b?.summary) L.push(b.summary.trim());
      else if (mode === 'short') L.push(s.short || s.brief || '');
      else { if (s.brief) L.push(s.brief); for (const e of evs.filter(e => e.n === s.n)) L.push(`- ${e.title}: ${flat(e.text)}`); }
      if (o.docs && whole) for (const d of b?.docs || []) L.push('', `[Appunti del DM · ${d.name}]`, d.text.trim());
    }
    const ents = [...S.ents.values()].sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) || a.name.localeCompare(b.name));
    const entText = e => {
      const b = bodies.get(e.id), out = links.filter(l => l.from === e.id && S.ents.has(l.to));
      // in «recent» le schede non in primo piano tengono solo le voci delle ultime sessioni (e quelle senza sessione)
      const keep = en => full || focus.has(e.id) || en.n == null || en.n >= recentFrom;
      const r = [`### ${e.name} [${e.id}] · ${TYPES[e.type] || e.type}${e.status ? ' · ' + e.status : ''}${e.discovered === false ? ' · NON ancora scoperto dai giocatori' : ''}`];
      if (e.alias?.length) r.push('Alias: ' + e.alias.join(', '));
      if (e.brief) r.push(e.brief);
      for (const s of b?.sections || []) { const es = s.entries.filter(keep); if (!es.length) continue; r.push(`**${s.title}**`); for (const en of es) r.push((en.n != null ? `[Sess. ${en.n}] ` : '') + en.text.trim()); }
      if (out.length) r.push('Relazioni: ' + out.map(l => `${l.label || '→'} ${S.ents.get(l.to).name} [${l.to}]`).join('; '));
      return r.join('\n');
    };
    const deep = ents.filter(e => full || focus.has(e.id) || (mode === 'recent' && (e.type === 'pg' || (e.sessions || []).some(n => n >= recentFrom))));
    L.push('', `--- SCHEDE${full ? '' : mode === 'recent' ? ' DEI PERSONAGGI, IN PRIMO PIANO E DELLE ULTIME SESSIONI' : ' IN PRIMO PIANO'} (testo completo) ---`);
    if (!deep.length) L.push('(nessuna: vedi l\'elenco qui sotto)');
    for (const e of deep) L.push('', entText(e));
    const rest = ents.filter(e => !deep.includes(e));
    if (rest.length) {
      const br = e => e.brief && (mode !== 'short' || e.type === 'pg' || (e.sessions || []).some(n => n >= recentFrom));
      L.push('', `--- ALTRE SCHEDE (id | tipo | nome | stato${mode === 'short' ? ' | breve solo per PG e schede recenti' : ' | breve'}) ---`);
      for (const e of rest) L.push(`${e.id} | ${e.type} | ${e.name}${e.alias?.length ? ' (' + e.alias.join(', ') + ')' : ''} | ${e.status || '—'}${e.discovered === false ? ' | NON scoperto' : ''}${br(e) ? ' | ' + flat(e.brief) : ''}`);
    }
    const saved = await ideasAll();
    if (saved.length) { L.push('', '--- IDEE GIÀ PROPOSTE IN PASSATO (evita di ripeterle) ---'); for (const i of saved.slice(0, 30)) L.push(`- ${i.title}`); }
    return L.join('\n');
  }

  function instructions(camp) {
    return `Sei un co-autore esperto di Dungeons & Dragons 5e che aiuta il Dungeon Master della campagna «${camp}» a preparare le prossime giocate. Più sotto trovi tutto quello che è successo finora: riassunti delle sessioni, schede di personaggi, PNG, luoghi, oggetti, fazioni, missioni e lore, comprese le informazioni che i giocatori non conoscono ancora.

COME LAVORARE
- Rispetta la continuità: chi è vivo o morto, dove si trova il party, cosa sanno i PG, le promesse e i debiti in sospeso.
- Costruisci sulle cose che esistono già: PNG, fazioni, luoghi, misteri, oggetti e fili lasciati aperti. Ogni proposta deve nascere dalla storia della campagna, non essere un modulo generico.
- Puoi inventare elementi nuovi (PNG, luoghi, creature), ma segnalali come «Novità» e rendili coerenti con il mondo.
- Dai a ogni PG almeno un momento in cui il suo background o i suoi segreti contano.
- Scrivi in italiano, in modo concreto e pronto da usare al tavolo: niente consigli generici.

FORMATO DELLA RISPOSTA (Markdown semplice, niente tabelle)
Per ogni proposta:
## Titolo della proposta
**In breve:** 2–3 frasi.
**Perché ora:** quali fili della campagna riprende.
### Gancio
### Scene
Da 3 a 6 scene, ognuna con obiettivo, ostacolo e possibili esiti (anche in caso di fallimento).
### PNG e antagonisti
### Luoghi
### Sfide e incontri
Con indicazioni di difficoltà adatte al party.
### Colpi di scena e segreti
### Ricompense
### Conseguenze per la campagna
Quando citi una scheda esistente scrivi esattamente [[id]] oppure [[id|testo]] usando gli id tra parentesi quadre qui sotto: nel sito diventano link alla scheda.
Se ti chiedo modifiche o approfondimenti su una proposta, rispondi con la proposta aggiornata nello stesso formato.`;
  }

  function requestText(o) {
    const last = S.sess[S.sess.length - 1];
    const r = [`Proponimi ${o.count == 1 ? 'UNA idea, sviluppata in modo approfondito,' : o.count + ' idee diverse tra loro'} per ${KINDS[o.kind][1]}.`];
    if (o.kind === 'next' && last) r.push(`L'ultima sessione giocata è la n. ${last.n}${last.title ? ' («' + last.title + '»)' : ''}.`);
    r.push(`Durata: ${o.kind === 'arc' ? 'ogni sessione dell\'arco dura ' : ''}${LENGTHS[o.length]}.`);
    if (o.level) r.push(`Party: ${o.level}.`);
    if (o.tones.length) r.push(`Toni e generi preferiti: ${o.tones.join(', ')}.`);
    const f = o.focus.map(id => S.ents.get(id)).filter(Boolean);
    if (f.length) r.push(`Metti al centro queste schede: ${f.map(e => `${e.name} [${e.id}]`).join(', ')}.`);
    const ex = EXTRAS.filter(x => (o.extras || []).includes(x[0]));
    if (ex.length) r.push('', 'Aggiungi a ogni proposta anche queste sezioni, dopo «Conseguenze per la campagna»:', ...ex.map(x => x[2]));
    if (o.note.trim()) r.push('', 'Indicazioni del DM:', o.note.trim());
    return r.join('\n');
  }

  async function buildPrompt(o) {
    const camp = getMeta('campaign', { name: 'Campagna' }).name;
    return { system: instructions(camp) + '\n\n' + await campaignText(o), user: requestText(o) };
  }

  /* ---------- chiamata diretta a Claude (con la chiave API del DM) ---------- */
  async function callClaude({ system, messages, model, key, onText, signal }) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal,
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true', 'anthropic-beta': 'server-side-fallback-2026-07-01' },
      body: JSON.stringify({ model, max_tokens: 32000, stream: true, thinking: { type: 'adaptive' }, output_config: { effort: 'medium' }, fallbacks: 'default', system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }], messages })
    });
    if (!r.ok) {
      let m = ''; try { m = (await r.json()).error?.message || ''; } catch { }
      if (r.status === 401) throw new Error('La chiave di Claude non è valida. Controllala in «Collega Claude».');
      if (r.status === 429) throw new Error('Troppe richieste in poco tempo: riprova tra un minuto.');
      if (r.status === 529 || r.status >= 500) throw new Error('Claude è momentaneamente sovraccarico: riprova tra poco.');
      if (/too long|too many tokens|context (length|window)/i.test(m)) throw new Error('La richiesta è troppo lunga per Claude: scegli «Breve» in «Quanta storia mandare a Claude».');
      if (/credit balance/i.test(m)) throw new Error('Il credito del tuo account Claude è esaurito: ricaricalo su console.anthropic.com.');
      throw new Error(m || 'Richiesta non riuscita (' + r.status + ').');
    }
    const blocks = [], rd = r.body.getReader(), dec = new TextDecoder(); let buf = '', stop = null, usage = {};
    const text = () => blocks.filter(b => b && b.type === 'text').map(b => b.text).join('');
    for (; ;) {
      const { value, done } = await rd.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      let i; while ((i = buf.indexOf('\n\n')) >= 0) {
        const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
        const line = chunk.split('\n').find(l => l.startsWith('data:')); if (!line) continue;
        let ev; try { ev = JSON.parse(line.slice(5)); } catch { continue; }
        if (ev.type === 'content_block_start') blocks[ev.index] = { ...ev.content_block };
        else if (ev.type === 'content_block_delta') {
          const b = blocks[ev.index], d = ev.delta; if (!b) continue;
          if (d.type === 'text_delta') { b.text = (b.text || '') + d.text; onText(text()); }
          else if (d.type === 'thinking_delta') b.thinking = (b.thinking || '') + d.thinking;
          else if (d.type === 'signature_delta') b.signature = d.signature;
        }
        else if (ev.type === 'message_start') usage = { ...ev.message?.usage };
        else if (ev.type === 'message_delta') { stop = ev.delta?.stop_reason ?? stop; Object.assign(usage, ev.usage || {}); }
        else if (ev.type === 'error') throw new Error(ev.error?.message || 'Errore durante la risposta di Claude.');
      }
    }
    if (stop === 'refusal') throw new Error('Claude ha rifiutato questa richiesta. Prova a riformulare le indicazioni.');
    return { content: blocks.filter(Boolean), text: text(), stop, usage };
  }

  async function settingsDlg() {
    const cur = (await kvGet('api')) || {};
    const r = await formDlg({
      title: 'Collega Claude', ok: 'Salva',
      intro: 'Con una chiave API di Claude le idee si generano direttamente qui. Creala su <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com</a> (serve un credito prepagato: ogni richiesta costa qualche decina di centesimi). La chiave resta solo in questo browser. Senza chiave puoi sempre usare «Copia per Claude» e incollare la richiesta in una chat.',
      fields: [
        { k: 'key', label: 'Chiave API', value: cur.key || '', placeholder: 'sk-ant-…' },
        { k: 'model', label: 'Modello', type: 'select', value: cur.model || MODELS[0][0], options: MODELS.map(m => [m[0], m[1]]) }
      ]
    });
    if (!r) return false;
    const key = r.key.trim();
    if (key && !/^sk-ant-/.test(key)) { toast('La chiave dovrebbe iniziare con «sk-ant-».', 'err'); return false; }
    await kvSet('api', key ? { key, model: r.model } : null); toast(key ? 'Claude collegato' : 'Chiave rimossa'); return true;
  }

  /* ---------- pagina ---------- */
  const CSS = `.idee-tones{display:flex;flex-wrap:wrap;gap:6px}
.idee-tones .chip{user-select:none}
.idee-focus{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
.idee-focus .chip button{border:0;background:none;color:inherit;cursor:pointer;font-size:1rem;line-height:1;padding:0 0 0 2px}
.idee-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:0 14px}
.idee-turn{border-top:1px solid var(--line2);padding-top:12px;margin-top:12px}
.idee-turn:first-child{border-top:0;margin-top:0;padding-top:0}
.idee-q{background:var(--paper2);border-left:3px solid var(--gold);padding:8px 12px;border-radius:4px;white-space:pre-wrap}
.idee-out .prose h4{margin-top:1.1em}
.idee-live:after{content:"▍";animation:idee-b 1s steps(2) infinite;color:var(--gold)}
@keyframes idee-b{50%{opacity:0}}
.idee-list .erow{height:auto;padding:10px 4px}`;
  let cssDone = false;
  const css = () => { if (cssDone) return; cssDone = true; const s = document.createElement('style'); s.textContent = CSS; document.head.append(s); };

  let CONV = null, BUSY = null; // conversazione in corso: resta finché la pagina è aperta
  const loadForm = () => { const p = pref('idee-form', {}); if (p.v !== 2) { delete p.ctx; p.v = 2; } return { ...DEF, ...p }; }; // v2: il contesto predefinito non è più «Completo»
  const saveForm = o => setPref('idee-form', o);
  const titleOf = (t, o) => (String(t).match(/^##\s+(.+)$/m)?.[1] || `${KINDS[o.kind][0]} · ${now()}`).replace(/\*\*/g, '').replace(/\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g, (m, a, b) => b || S.ents.get(a)?.name || a).slice(0, 120);

  async function guard() {
    await claude.use('db');
    if (!window.__RO) return true;
    setView(`<div class="empty"><h2>Pagina riservata al Dungeon Master</h2><p><a href="#/">Torna alla campagna</a></p></div>`); return false;
  }

  route(/^\/idee$/, async () => {
    if (!await guard()) return; css(); ensureEntList();
    const o = loadForm(); o.focus = o.focus.filter(id => S.ents.has(id));
    const api = await kvGet('api'), saved = await ideasAll();
    const sel = (k, opts, v) => `<select id="i-${k}">${opts.map(([a, b]) => `<option value="${esc(a)}" ${String(a) === String(v) ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>`;
    setView(`<div class="pagehead"><h1>Idee per le sessioni</h1><div class="acts"><button class="btn" data-act="ipaste">Salva una risposta di Claude</button><button class="btn" data-act="iset">${api ? 'Claude collegato ✓' : 'Collega Claude'}</button></div></div><div class="orn"></div>
      <div class="card"><p class="lead" style="margin-top:0">Chiedi a Claude di ideare oneshot, sessioni o missioni partendo da tutto quello che è successo nella campagna: riassunti, schede, PNG, luoghi e segreti. Lo vedi solo tu come DM.</p>
        <div class="idee-grid">
          <label class="f"><span>Cosa ti serve</span>${sel('kind', Object.entries(KINDS).map(([k, v]) => [k, v[0]]), o.kind)}</label>
          <label class="f"><span>Quante proposte</span>${sel('count', [[1, '1, molto dettagliata'], [3, '3 alternative'], [5, '5 spunti']], o.count)}</label>
          <label class="f"><span>Durata</span>${sel('length', Object.entries(LENGTHS), o.length)}</label>
          <label class="f"><span>Party (facoltativo)</span><input type="text" id="i-level" value="${esc(o.level)}" placeholder="es. 4 PG di livello 3" autocomplete="off"></label>
        </div>
        <label class="f"><span>Toni e generi</span><div class="idee-tones" id="i-tones">${TONES.map(t => `<span class="chip ${o.tones.includes(t) ? 'on' : ''}" role="checkbox" tabindex="0" aria-checked="${o.tones.includes(t)}" data-tone="${esc(t)}">${esc(t)}</span>`).join('')}</div></label>
        <label class="f"><span>Aggiungi alla risposta</span><div class="idee-tones" id="i-extras">${EXTRAS.map(([k, t]) => `<span class="chip ${o.extras.includes(k) ? 'on' : ''}" role="checkbox" tabindex="0" aria-checked="${o.extras.includes(k)}" data-extra="${k}">${esc(t)}</span>`).join('')}</div></label>
        <label class="f"><span>Schede da mettere al centro (facoltativo)</span><input type="text" id="i-fadd" list="dl-ents" placeholder="Scrivi un nome: PG, PNG, luogo, fazione…" autocomplete="off"><div class="idee-focus" id="i-focus"></div></label>
        <label class="f"><span>Indicazioni per Claude (facoltativo)</span><textarea id="i-note" rows="3" placeholder="es. Vorrei una oneshot su Violet e l'uovo di drago, ambientata prima della prigione.">${esc(o.note)}</textarea></label>
        <details><summary class="hint" style="cursor:pointer">Quanta storia mandare a Claude (accorciala qui se la richiesta è troppo lunga)</summary>
          <label class="f" style="margin-top:8px"><span>Contesto</span>${sel('ctx', [['recent', `Ultime sessioni (consigliato): le ultime ${RECENT} per intero, le altre in breve`], ['short', 'Breve: solo l\'essenziale, per le chat più piccole'], ['full', 'Completo: tutte le sessioni e tutte le schede']], o.ctx)}</label>
          <label class="chk"><input type="checkbox" id="i-docs" ${o.docs ? 'checked' : ''}> <span>Aggiungi anche i tuoi appunti e le scalette delle sessioni (Claude imita il tuo stile, ma la richiesta pesa di più)</span></label>
        </details>
        <div class="row" style="margin-top:14px"><button class="btn primary" data-act="igen">Genera con Claude</button><button class="btn" data-act="icopy">Copia per Claude</button><button class="btn" data-act="itxt" title="Scarica la richiesta come file da allegare alla chat">Scarica per Claude</button><span class="hint" id="i-size"></span></div>
        ${api ? '' : '<p class="hint" style="margin-bottom:0">Per generare qui serve collegare Claude con una chiave API. In alternativa «Copia per Claude» prepara la richiesta da incollare in una chat con Claude; poi con «Salva una risposta di Claude» la conservi qui.</p>'}
      </div>
      <div id="i-conv"></div>
      <div class="card"><h2>Idee salvate</h2>${saved.length ? `<div class="idee-list">${saved.map(i => `<a class="erow" href="#/idee/${encodeURIComponent(i.id)}"><div class="main"><div class="t">${esc(i.title)}</div><div class="b">${esc(i.kindLabel || '')}${i.kindLabel ? ' · ' : ''}${esc(new Date(i.ts).toLocaleDateString('it-IT'))}</div></div></a>`).join('')}</div>` : '<p class="empty" style="padding:12px">Nessuna idea salvata. Quando una proposta ti piace, premi «Salva tra le idee».</p>'}<p class="hint" style="margin-bottom:0">Le idee restano in questo browser, separate dai dati della campagna: i giocatori non le vedono mai.</p></div>`);

    const read = () => ({ kind: $('#i-kind').value, count: +$('#i-count').value, length: $('#i-length').value, level: $('#i-level').value.trim(), note: $('#i-note').value, ctx: $('#i-ctx').value, docs: $('#i-docs').checked, tones: [...document.querySelectorAll('#i-tones .chip.on')].map(c => c.dataset.tone), extras: [...document.querySelectorAll('#i-extras .chip.on')].map(c => c.dataset.extra), focus: o.focus, v: 2 });
    let sizeT = null;
    const size = () => { clearTimeout(sizeT); sizeT = setTimeout(async () => { const f = read(); saveForm(f); const p = await buildPrompt(f); const t = tokOf(p.system + p.user); const m = MODELS.find(x => x[0] === (api?.model || MODELS[0][0])); const c = (t * m[2] + 8000 * m[3]) / 1e6; const el = $('#i-size'); if (el) el.textContent = `Circa ${Math.round(t / 1000)} mila token di storia${t > BIG ? ' (lunga: meglio «Scarica per Claude» o un contesto più breve)' : ''}${api ? ` · circa ${c.toFixed(2).replace('.', ',')} $ a richiesta` : ''}`; }, 250); };
    const paintFocus = () => { $('#i-focus').innerHTML = o.focus.map(id => { const e = S.ents.get(id); return `<span class="chip">${badge(e.type)} ${esc(e.name)}<button type="button" data-unfocus="${esc(id)}" aria-label="Togli ${esc(e.name)}">×</button></span>`; }).join(''); size(); };
    paintFocus();
    const fadd = $('#i-fadd');
    const addFocus = () => { const e = pickEntity(fadd.value); if (!e) return; if (!o.focus.includes(e.id)) o.focus.push(e.id); fadd.value = ''; paintFocus(); };
    fadd.addEventListener('change', addFocus); fadd.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); addFocus(); } });
    $('#i-focus').addEventListener('click', ev => { const b = ev.target.closest('[data-unfocus]'); if (!b) return; o.focus = o.focus.filter(x => x !== b.dataset.unfocus); paintFocus(); });
    const tog = c => { c.classList.toggle('on'); c.setAttribute('aria-checked', c.classList.contains('on')); size(); };
    for (const g of ['#i-tones', '#i-extras']) {
      $(g).addEventListener('click', ev => { const c = ev.target.closest('.chip'); if (c) tog(c); });
      $(g).addEventListener('keydown', ev => { const c = ev.target.closest('.chip'); if (c && (ev.key === ' ' || ev.key === 'Enter')) { ev.preventDefault(); tog(c); } });
    }
    for (const el of document.querySelectorAll('#i-kind,#i-count,#i-length,#i-ctx,#i-docs,#i-level,#i-note')) el.addEventListener('change', size);

    const paintConv = () => {
      const conv = $('#i-conv'); if (!conv) return;
      if (!CONV) { conv.innerHTML = ''; return; }
      const failed = CONV.turns[CONV.turns.length - 1].err;
      conv.innerHTML = `<div class="card idee-out"><div class="spread"><h2 style="margin:0">${esc(KINDS[CONV.o.kind][0])}: le proposte di Claude</h2><button class="btn sm ghost" data-act="iclear">Chiudi</button></div>
        ${CONV.turns.map((t, i) => `<div class="idee-turn">${i ? `<div class="idee-q">${esc(t.q)}</div>` : ''}${t.err ? `<p style="color:var(--bad,#a3262f)">${esc(t.err)}</p><button class="btn sm" data-act="iretry">Riprova</button>` : `<div class="${t.live ? 'idee-live' : ''}" id="i-a${i}">${prose(t.a || '…')}</div>`}
          ${!t.live && t.a ? `<div class="row" style="margin-top:8px"><button class="btn sm primary" data-act="isave" data-i="${i}">${t.saved ? 'Salvata ✓' : 'Salva tra le idee'}</button><button class="btn sm" data-act="icp" data-i="${i}">Copia</button>${t.stop === 'max_tokens' ? '<span class="hint">La risposta è stata interrotta perché troppo lunga: chiedi di continuare.</span>' : t.stop === 'aborted' ? '<span class="hint">Interrotta da te: se vuoi, chiedi di continuare.</span>' : ''}</div>` : ''}</div>`).join('')}
        ${failed ? '' : BUSY ? `<div class="row" style="margin-top:12px"><button class="btn sm" data-act="istop">Interrompi</button><span class="hint">Claude sta scrivendo…</span></div>` : `<div class="idee-turn"><label class="f"><span>Continua con Claude</span><textarea id="i-follow" rows="2" placeholder="es. Sviluppa la seconda proposta con i dialoghi di Edward · rendila più cupa · aggiungi un incontro con i Predoni"></textarea></label><button class="btn" data-act="ifollow">Invia</button></div>`}</div>`;
    };
    const live = i => { const el = $('#i-a' + i); if (el) el.innerHTML = prose(CONV.turns[i].a || '…'); };
    const run = async () => {
      const a = await kvGet('api'); if (!a) { if (await settingsDlg()) return run(); return; }
      const i = CONV.turns.length - 1, t = CONV.turns[i]; t.live = true; BUSY = new AbortController(); paintConv();
      let raf = 0;
      try {
        const r = await callClaude({ system: CONV.system, messages: CONV.msgs, model: a.model, key: a.key, signal: BUSY.signal, onText: x => { t.a = x; if (!raf) raf = requestAnimationFrame(() => { raf = 0; live(i); }); } });
        t.a = r.text; t.stop = r.stop; CONV.msgs.push({ role: 'assistant', content: r.content });
      } catch (e) {
        if (e.name === 'AbortError') { t.stop = 'aborted'; if (t.a) CONV.msgs.push({ role: 'assistant', content: [{ type: 'text', text: t.a }] }); else t.err = 'Interrotta.'; }
        else t.err = e.message || String(e);
        if (!t.a && !t.err) t.err = 'Nessuna risposta.';
      }
      t.live = false; BUSY = null; if (!location.hash.startsWith('#/idee')) return; paintConv(); $('#i-a' + i)?.scrollIntoView({ block: 'nearest' });
    };
    paintConv();

    setActs({
      iset: async () => { if (await settingsDlg()) rerender(); },
      igen: async () => {
        if (BUSY) return toast('Claude sta ancora scrivendo.');
        if (!await kvGet('api') && !await settingsDlg()) return;
        const f = read(); saveForm(f); const p = await buildPrompt(f);
        CONV = { o: f, system: p.system, msgs: [{ role: 'user', content: p.user }], turns: [{ q: p.user, a: '' }] };
        await run();
      },
      ifollow: async () => {
        const q = $('#i-follow').value.trim(); if (!q) return toast('Scrivi cosa chiedere a Claude.');
        if (CONV.msgs[CONV.msgs.length - 1]?.role === 'user') CONV.msgs.pop();
        CONV.msgs.push({ role: 'user', content: q }); CONV.turns.push({ q, a: '' }); await run();
      },
      istop: () => BUSY?.abort(),
      iretry: async () => { const t = CONV.turns[CONV.turns.length - 1]; t.err = null; t.a = ''; await run(); },
      iclear: () => { if (BUSY) BUSY.abort(); CONV = null; paintConv(); },
      icp: a => copyText(CONV.turns[+a.dataset.i].a, 'Copiato'),
      isave: async a => {
        const t = CONV.turns[+a.dataset.i]; if (t.saved) return;
        const id = 'idea-' + Date.now().toString(36);
        await ideaPut({ id, ts: Date.now(), title: titleOf(t.a, CONV.o), kind: CONV.o.kind, kindLabel: KINDS[CONV.o.kind][0], request: CONV.turns.slice(0, +a.dataset.i + 1).map(x => x.q).join('\n\n---\n\n'), text: t.a });
        t.saved = true; toast('Idea salvata'); rerender();
      },
      icopy: async () => { const f = read(); saveForm(f); const p = await buildPrompt(f); const txt = p.system + '\n\n=== LA MIA RICHIESTA ===\n' + p.user; await copyText(txt, tokOf(txt) > BIG ? 'Richiesta copiata, ma è lunga: se la chat la rifiuta usa «Scarica per Claude» e allega il file, oppure scegli un contesto più breve' : 'Richiesta copiata: incollala in una chat con Claude'); },
      itxt: async () => { const f = read(); saveForm(f); const p = await buildPrompt(f); const dl = await claude.use('downloads'); await dl.save({ filename: 'richiesta-per-claude.txt', data: new Blob([p.system + '\n\n=== LA MIA RICHIESTA ===\n' + p.user], { type: 'text/plain' }) }); toast('File scaricato: allegalo in una chat con Claude e scrivi «Segui le istruzioni nel file»'); },
      ipaste: async () => {
        const r = await formDlg({ title: 'Salva una risposta di Claude', ok: 'Salva', wide: true, fields: [{ k: 't', label: 'Risposta di Claude', type: 'textarea', rows: 12, req: true, placeholder: 'Incolla qui le proposte che ti ha dato Claude' }, { k: 'n', label: 'Titolo (facoltativo)', placeholder: 'Se lo lasci vuoto uso il primo titolo della risposta' }, { k: 'k', label: 'Tipo', type: 'select', value: read().kind, options: Object.entries(KINDS).map(([k, v]) => [k, v[0]]) }] });
        if (!r || !r.t.trim()) return;
        await ideaPut({ id: 'idea-' + Date.now().toString(36), ts: Date.now(), title: r.n.trim() || titleOf(r.t, { kind: r.k }), kind: r.k, kindLabel: KINDS[r.k][0], text: r.t.trim() });
        toast('Idea salvata'); rerender();
      }
    });
  });

  route(/^\/idee\/(.+)$/, async ([id]) => {
    if (!await guard()) return; css();
    const i = await ideaGet(id);
    if (!i) return setView(`<div class="empty"><h2>Idea non trovata</h2><a href="#/idee">Torna alle idee</a></div>`);
    setView(`<div class="pagehead"><div style="flex:1"><a href="#/idee">← Tutte le idee</a><h1>${esc(i.title)}</h1><div class="hint">${esc(i.kindLabel || '')} · salvata il ${esc(new Date(i.ts).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }))}</div></div>
      <div class="acts"><button class="btn" data-act="icp">Copia</button><button class="btn" data-act="idl">Scarica</button><button class="btn" data-act="iren">Rinomina</button><button class="btn" data-act="idev">Sviluppa con Claude</button><button class="btn danger" data-act="idel">Elimina</button></div></div><div class="orn"></div>
      <div class="card idee-out">${prose(i.text)}</div>
      ${i.request ? `<details class="card"><summary class="hint" style="cursor:pointer">Cosa avevi chiesto</summary><div class="idee-q" style="margin-top:8px">${esc(i.request)}</div></details>` : ''}`);
    setActs({
      icp: () => copyText(i.text, 'Idea copiata'),
      idl: async () => { const dl = await claude.use('downloads'); await dl.save({ filename: i.title.replace(/[\\/:*?"<>|]+/g, '').slice(0, 60) + '.md', data: new Blob(['# ' + i.title + '\n\n' + i.text], { type: 'text/markdown' }) }); },
      iren: async () => { const r = await formDlg({ title: 'Rinomina l\'idea', fields: [{ k: 't', label: 'Titolo', value: i.title, req: true }] }); if (!r || !r.t.trim()) return; i.title = r.t.trim(); await ideaPut(i); rerender(); },
      idev: async () => {
        // riapre la proposta come conversazione, per chiedere a Claude di svilupparla o modificarla
        const o = { ...loadForm(), kind: i.kind || 'next' }; const p = await buildPrompt(o);
        const q = 'Riprendiamo una proposta che mi avevi preparato in passato: «' + i.title + '».';
        CONV = { o, system: p.system, msgs: [{ role: 'user', content: q }, { role: 'assistant', content: i.text }], turns: [{ q, a: i.text, saved: true }] };
        location.hash = '#/idee'; setTimeout(() => $('#i-follow')?.scrollIntoView({ block: 'center' }), 400);
      },
      idel: async () => { if (!await ask(`Eliminare l'idea **${i.title}**?`, { danger: true, ok: 'Elimina' })) return; await ideaDel(i.id); location.hash = '#/idee'; }
    });
  });

  // voce «Idee» nel menu, solo per il DM
  claude.use('db').then(() => {
    if (window.__RO) return;
    const nav = document.getElementById('nav'); if (!nav || nav.querySelector('a[href="#/idee"]')) return;
    const a = document.createElement('a'); a.href = '#/idee';
    // icona della lampadina, come le altre sezioni della barra
    a.innerHTML = '<svg class="nic" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2v1h5v-1c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/><path d="M12 7.5a2.5 2.5 0 0 0-2.5 2.5"/></svg><span>Idee</span>';
    nav.insertBefore(a, nav.querySelector('a[href="#/import"]'));
    if (location.hash.startsWith('#/idee')) a.classList.add('on');
  });
})();

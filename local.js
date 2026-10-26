/* Campagna D&D — accesso e archiviazione locale.
   - Giocatore (Livion, Sam, Violet, Mungus): la sua password decifra giocatori/<id>.enc, la copia preparata per lui
     (solo ciò che il DM gli mostra con «Mostra a:»), in sola lettura. Le altre copie non le può aprire.
   - Amministratore: il codice decifra data.enc (dati completi), tenuti in IndexedDB. Le modifiche fatte sul sito
     restano qui finché non le salva (vanno subito online su Supabase, vedi tavolo/sito-1.sql) o le scarta:
     i dati veri sono sempre quelli pubblicati. Le note e gli errori per Claude passano invece da GitHub.
     Il codice non viene mai salvato in chiaro.
   - I dati pubblicati stanno su GitHub (data.enc, giocatori/*.enc, versione.json) e su Supabase (bucket «sito»):
     si apre sempre la copia più recente delle due. */
(() => {
  'use strict';
  const rq = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const done = t => new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });
  const b64d = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const ls = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { } }, del: k => { try { localStorage.removeItem(k); } catch { } } };
  const domReady = () => document.readyState === 'loading' ? new Promise(r => addEventListener('DOMContentLoaded', r, { once: true })) : Promise.resolve();
  const clone = v => JSON.parse(JSON.stringify(v));
  // stesso contenuto, anche con i campi in un altro ordine
  const sortK = v => Array.isArray(v) ? v.map(sortK) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sortK(v[k])])) : v;
  const same = (a, b) => JSON.stringify(sortK(a)) === JSON.stringify(sortK(b));
  const ROERR = () => new Error('Sola lettura: accedi come Dungeon Master per modificare.');

  let ROLE = null, DB = null, MEM = {}, BLOBMAP = {}, RAW = null, PLAYER = null, BLOBKEYS = {}, PRAW = null, PTOKEN = null;
  // iterazioni della chiave (da data.enc): servono al tavolo per ricavare gli accessi dei giocatori
  let ITER = null;
  // account dei giocatori, nell'ordine dei ritratti di login-gruppo.jpg
  const PLAYERS = [['livion', 'Livion'], ['mungus', 'Mungus'], ['sam', 'Sam'], ['violet', 'Violet']];
  // modifiche non ancora inviate: chiavi 'raccolta/id' dei documenti e id delle immagini caricate
  let PEND = new Set(), PFILES = new Set(), DROPPED = false;
  // SENT: le modifiche in sospeso sono già state inviate a Claude e restano visibili qui finché non vengono pubblicate
  let SENT = false;
  // segnalazioni per Claude: note sui testi (modalità revisione) ed errori del sito, con le loro foto
  let NOTES = [], BUGS = [];
  const store = (s, m = 'readonly') => DB.transaction(s, m).objectStore(s);
  const kvGet = k => rq(store('kv').get(k));
  const kvSet = async (k, v) => { const t = DB.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); await done(t); };
  const idbOpen = () => new Promise((res, rej) => {
    const r = indexedDB.open('campagna-dnd-admin', 1);
    r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('docs'); d.createObjectStore('files'); d.createObjectStore('kv'); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });

  /* ---------- cifratura ---------- */
  async function deriveRaw(code, salt, it) {
    const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveBits']);
    return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: it }, km, 256));
  }
  const aesKey = raw => crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);

  async function openEnc(enc, raw) {
    let pt = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(enc.iv) }, await aesKey(raw), b64d(enc.ct)));
    if (enc.z) pt = new Uint8Array(await new Response(new Blob([pt]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
    return JSON.parse(new TextDecoder().decode(pt));
  }

  /* ---------- da dove arrivano i dati ----------
     GitHub ha i dati pubblicati da Claude (versione.json dice quando), Supabase quelli salvati dal DM sul sito
     (sito_stato dice in quale cartella del bucket «sito»): vince la versione più recente. */
  const SB_URL = 'https://zwxwnmcxryfmzkqsakjz.supabase.co';
  const SB_KEY = 'sb_publishable_cAGuilUZdnxhtDeJ-qwuEQ_ihjCyFj0'; // la stessa chiave pubblica del tavolo
  const SB_FILES = SB_URL + '/storage/v1/object/public/sito/';
  // le immagini caricate dal sito stanno su Supabase (blobs/sb-….jpg, priv/sb-….bin), le altre su GitHub
  const fileUrl = p => /^(blobs|priv)\/sb-/.test(p) ? SB_FILES + p : p;
  // FONTE: { base: '' per GitHub o indirizzo della cartella su Supabase, sbv: versione su Supabase, pronto: tavolo/sito-1.sql eseguito }
  let FONTE = null;
  async function fonte(fresca) {
    if (FONTE && !fresca) return FONTE;
    const gh = fetch('versione.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : {}).then(j => +j.pub || 0, () => 0);
    let sb = null, pronto = false;
    try {
      const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 6000);
      const r = await fetch(SB_URL + '/rest/v1/sito_stato?select=versione,cartella&id=eq.1', { headers: { apikey: SB_KEY }, cache: 'no-store', signal: ctl.signal });
      clearTimeout(t);
      if (r.ok) { pronto = true; const [s] = await r.json(); sb = s ? { versione: +s.versione, cartella: s.cartella } : null; ls.set('cdnd_sito', JSON.stringify(sb)); }
    } catch { try { sb = JSON.parse(ls.get('cdnd_sito')); } catch { } } // senza rete: l'ultima cartella vista (i file restano nel service worker)
    const ghv = await gh, sbv = sb ? sb.versione : 0;
    FONTE = sb && sb.cartella && sbv > ghv ? { base: SB_FILES + sb.cartella + '/', sbv, pronto, cartella: sb.cartella } : { base: '', sbv, pronto };
    return FONTE;
  }
  // un file dei dati dalla copia più recente (su Supabase, o su GitHub se Supabase non risponde)
  async function dataFetch(f) {
    const src = await fonte();
    if (src.base) try { const r = await fetch(src.base + f); if (r.ok || r.status === 404) return r; } catch { }
    return fetch(f, { cache: 'no-cache' });
  }

  /* ---------- aperture ---------- */
  async function playerOpen(id, code, remember) {
    let r; try { r = await dataFetch('giocatori/' + id + '.enc'); } catch { throw new Error('Per il primo accesso serve internet.'); }
    if (!r.ok) throw new Error(r.status === 404 ? 'Questo account non è ancora attivo: chiedi al DM.' : 'Impossibile caricare i dati (' + r.status + ').');
    const enc = await r.json();
    let raw;
    if (code != null) raw = await deriveRaw(code, b64d(enc.salt), enc.it);
    else { const k = ls.get('cdnd_pkey'); if (!k) throw new Error('nokey'); raw = b64d(k); }
    let d; try { d = await openEnc(enc, raw); } catch { throw new Error(code != null ? 'Password non corretta.' : 'nokey'); }
    MEM = {}; for (const [c, docs] of Object.entries(d.stores)) MEM[c] = new Map(Object.entries(docs));
    BLOBMAP = d.blobmap || {}; BLOBKEYS = d.blobkeys || {}; PLAYER = d.player || { id, name: id }; ROLE = 'player'; PRAW = raw; PTOKEN = d.segnalazioni || null;
    if (remember) { ls.set('cdnd_remember', 'player:' + id); ls.set('cdnd_pkey', b64e(raw)); }
  }
  async function seedAdmin(payload, raw) {
    const t = DB.transaction(['docs', 'kv'], 'readwrite'); const d = t.objectStore('docs'); d.clear();
    for (const [c, docs] of Object.entries(payload.stores)) for (const [id, v] of Object.entries(docs)) d.put(v, c + '/' + id);
    t.objectStore('kv').put(payload.dataVersion, 'dataVersion'); t.objectStore('kv').put(payload.blobmap, 'blobmap'); t.objectStore('kv').put(false, 'dirty'); t.objectStore('kv').put([], 'pending'); t.objectStore('kv').put([], 'pfiles'); t.objectStore('kv').put([], 'notes'); t.objectStore('kv').put([], 'bugs');
    await done(t);
    // immagini riservate (cifrate): le decifro e le tengo nel browser
    // (quelle che vede anche qualche giocatore hanno una chiave propria, in blobkeys)
    const key = await aesKey(raw), keys = payload.blobkeys || {}, types = {};
    for (const b of Object.values(payload.stores.blobs || {})) types[b.aid] = b.type;
    for (const [aid, path] of Object.entries(payload.blobmap)) {
      if (!path.startsWith('priv/')) continue;
      try {
        const buf = new Uint8Array(await (await fetch(fileUrl(path))).arrayBuffer());
        const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, keys[aid] ? await aesKey(b64d(keys[aid])) : key, buf.slice(12));
        const t2 = DB.transaction('files', 'readwrite'); t2.objectStore('files').put({ blob: new Blob([plain], { type: types[aid] || 'image/jpeg' }), type: types[aid] }, aid); await done(t2);
      } catch { }
    }
  }
  async function adminOpen(code, remember) {
    DB = await idbOpen();
    let enc = null; try { const r = await dataFetch('data.enc'); if (r.ok) enc = await r.json(); } catch { }
    const have = (await rq(store('docs').count())) > 0;
    let raw;
    if (code != null) { if (!enc) throw new Error('Per il primo accesso serve internet.'); raw = await deriveRaw(code, b64d(enc.salt), enc.it); }
    else { raw = await kvGet('key'); if (!raw) throw new Error('nokey'); }
    let payload = null;
    if (enc) {
      try { payload = JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(enc.iv) }, await aesKey(raw), b64d(enc.ct)))); }
      catch { throw new Error(code != null ? 'Codice non corretto.' : 'nokey'); }
    } else if (!have) throw new Error('Impossibile aprire i dati: serve internet al primo accesso.');
    RAW = raw; ITER = enc ? enc.it : null;
    if (payload && !have) await seedAdmin(payload, raw);
    else if (payload) {
      // i dati pubblicati comandano: se sono cambiati li riprendo, rimettendo sopra solo le modifiche ancora da inviare
      let pend = (await kvGet('pending')) || [], pfiles = (await kvGet('pfiles')) || [], notes = (await kvGet('notes')) || [], bugs = (await kvGet('bugs')) || [], dirty = await kvGet('dirty');
      if (dirty && !pend.length && !pfiles.length && !notes.length && !bugs.length) { await seedAdmin(payload, raw); DROPPED = true; } // modifiche vecchie, mai inviate
      else if (payload.dataVersion !== await kvGet('dataVersion')) {
        let keep = await Promise.all(pend.map(async k => [k, await rq(store('docs').get(k))]));
        // quelle già pubblicate (uguali ai dati nuovi) non sono più da inviare: le tolgo, così il riquadro si svuota da solo
        const pub = k => { const j = k.indexOf('/'); return (payload.stores[k.slice(0, j)] || {})[k.slice(j + 1)]; };
        keep = keep.filter(([k, v]) => !same(v, pub(k)));
        pend = keep.map(([k]) => k); pfiles = pfiles.filter(aid => !(aid in (payload.blobmap || {})));
        if (await kvGet('sent')) { notes = []; bugs = []; } // note ed errori inviati: sono già su GitHub
        await seedAdmin(payload, raw);
        const t = DB.transaction(['docs', 'kv'], 'readwrite');
        for (const [k, v] of keep) v === undefined ? t.objectStore('docs').delete(k) : t.objectStore('docs').put(v, k);
        t.objectStore('kv').put(pend, 'pending'); t.objectStore('kv').put(pfiles, 'pfiles'); t.objectStore('kv').put(notes, 'notes'); t.objectStore('kv').put(bugs, 'bugs'); t.objectStore('kv').put(pend.length + pfiles.length + notes.length + bugs.length > 0, 'dirty');
        if (!pend.length && !pfiles.length && !notes.length && !bugs.length) t.objectStore('kv').put(false, 'sent');
        await done(t);
      }
    }
    PEND = new Set((await kvGet('pending')) || []); PFILES = new Set((await kvGet('pfiles')) || []);
    NOTES = (await kvGet('notes')) || []; BUGS = (await kvGet('bugs')) || []; SENT = !!(await kvGet('sent'));
    if (remember) { await kvSet('key', raw); ls.set('cdnd_remember', 'admin'); }
    const ks = await rq(store('docs').getAllKeys()), vs = await rq(store('docs').getAll()); MEM = {};
    ks.forEach((k, i) => { const j = k.indexOf('/'); const c = k.slice(0, j); (MEM[c] = MEM[c] || new Map()).set(k.slice(j + 1), vs[i]); });
    BLOBMAP = (await kvGet('blobmap')) || {}; ROLE = 'admin'; window.__online = true;
  }

  /* ---------- schermata di accesso ---------- */
  const LOGIN_CSS = `#login{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;background:radial-gradient(ellipse at 50% 20%,#7d2530cc 0%,#561820e6 55%,#2d0d12 100%),url(login-mappa.jpg) center/cover #2d0d12;color:#f5e6c4;font-family:'Crimson Pro',Georgia,serif}
#login .grp{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:0 0 18px}
#login .grp button{all:unset;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:5px;font-family:'Cinzel',Georgia,serif;font-size:.9rem;font-weight:700;letter-spacing:.04em;color:#561820}
#login .grp span{display:block;width:100%;aspect-ratio:3/4;border-radius:6px;border:2px solid #a98334;background:url(login-gruppo.jpg) 0 0/400% 100% no-repeat #2b1d14;box-shadow:0 2px 8px #0004;transition:transform .15s,box-shadow .15s}
#login .grp button:nth-child(2) span{background-position:33.333% 0}#login .grp button:nth-child(3) span{background-position:66.666% 0}#login .grp button:nth-child(4) span{background-position:100% 0}
#login .grp button:hover span,#login .grp button:focus-visible span{transform:translateY(-2px);box-shadow:0 4px 12px #0006}
#login .grp button[aria-pressed=true] span{border-color:#7d2530;box-shadow:0 0 0 3px #7d253066,0 4px 12px #0006}
#login .grp button[aria-pressed=true]{color:#7d2530;text-decoration:underline;text-underline-offset:3px}
#login .pick{text-align:center;margin:0 0 8px;color:#3b2a1e;font-size:1.05rem}
@media (prefers-color-scheme:dark){#login .box{background:#241b16;color:#ecdfc6;border-color:#55402f}#login h1{color:#e0c071}#login .sub,#login small,#login .or{color:#94806a}#login label{color:#c5b193}#login .btn{background:#2b211b;color:#e0c071;border-color:#55402f}#login .btn.p{background:#8c2c38;color:#fbeccb;border-color:#c4494f}#login .or:before,#login .or:after{border-color:#3a2d24}}
#login .box{width:min(420px,100%);background:#fbf5e3;color:#2b1d14;border:1px solid #d4b06a;border-radius:12px;padding:28px 26px;box-shadow:0 12px 40px #0008}
#login h1{margin:0 0 2px;font-family:'Cinzel',Georgia,serif;font-size:1.35rem;letter-spacing:.06em;color:#561820;text-align:center}
#login .sub{text-align:center;color:#8a7560;margin:0 0 20px}
#login button,#login input[type=password]{font:inherit;width:100%;box-sizing:border-box;border-radius:8px;padding:11px 14px}
#login .btn{cursor:pointer;border:1px solid #a98334;background:#f3e8cc;color:#561820;font-family:'Cinzel',Georgia,serif;letter-spacing:.05em;font-size:.9rem}
#login .btn.p{background:#7d2530;color:#fbf5e3;border-color:#561820}
#login .btn:disabled{opacity:.6;cursor:wait}
#login input[type=password]{border:1px solid #a98334;background:#fffdf4;color:#2b1d14;margin-bottom:8px}
#login input[type=password]:not(:placeholder-shown){font-family:Verdana,sans-serif;font-size:1.3rem;letter-spacing:.18em;padding:7px 14px}
#login input[type=password]::placeholder{color:#7a6550;opacity:1}
#login .or{display:flex;align-items:center;gap:10px;color:#8a7560;margin:16px 0;font-size:.9rem}#login .or:before,#login .or:after{content:"";flex:1;border-top:1px solid #dccaa0}
#login label{display:flex;align-items:center;gap:8px;font-size:.95rem;color:#5a4636;margin:2px 0 10px}
#login .err{color:#a3262f;min-height:1.2em;margin:6px 0 0;font-size:.95rem}
#login small{display:block;color:#8a7560;margin-top:6px}`;
  function loginUI(msg) {
    return new Promise(resolve => {
      const st = document.createElement('style'); st.textContent = LOGIN_CSS; document.head.append(st);
      const el = document.createElement('div'); el.id = 'login';
      el.innerHTML = `<div class="box"><h1>CAMPAGNA D&amp;D</h1><p class="sub">Diario di campagna di Avalar</p><p class="pick">Chi sei?</p>
        <div class="grp">${PLAYERS.map(([id, n]) => `<button type="button" data-pl="${id}" aria-pressed="false"><span></span>${n}</button>`).join('')}</div>
        <form id="lg-pl" autocomplete="off" hidden><input type="password" id="lg-pcode" autocomplete="current-password" spellcheck="false">
        <label><input type="checkbox" id="lg-prem" checked> Ricordami su questo dispositivo</label>
        <button class="btn p" id="lg-pgo" type="submit">Entra</button></form>
        <div class="or">oppure</div>
        <form id="lg-form" autocomplete="off"><input type="password" id="lg-code" placeholder="Codice del Dungeon Master" autocomplete="current-password" spellcheck="false">
        <label><input type="checkbox" id="lg-rem" checked> Ricordami su questo dispositivo</label>
        <button class="btn" id="lg-adm" type="submit">Entra come Dungeon Master</button></form>
        <p class="err" id="lg-err">${msg || ''}</p></div>`;
      document.body.append(el);
      const err = t => { el.querySelector('#lg-err').textContent = t || ''; };
      const finish = () => { el.remove(); st.remove(); resolve(); };
      // giocatore: si tocca il proprio ritratto e si scrive la propria password
      let who = null; const pf = el.querySelector('#lg-pl'), pc = el.querySelector('#lg-pcode'), pg = el.querySelector('#lg-pgo');
      el.querySelectorAll('[data-pl]').forEach(b => b.onclick = () => {
        who = b.dataset.pl; const n = PLAYERS.find(p => p[0] === who)[1];
        el.querySelectorAll('[data-pl]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        pf.hidden = false; pc.placeholder = 'Password di ' + n; pg.textContent = 'Entra come ' + n; err(''); pc.focus();
      });
      pf.onsubmit = async e => {
        e.preventDefault(); if (!who) return; const code = pc.value; if (!code) { err('Inserisci la password.'); return; }
        const t = pg.textContent; pg.disabled = true; pg.textContent = 'Verifico…'; err('');
        try { await playerOpen(who, code, el.querySelector('#lg-prem').checked); finish(); }
        catch (x) { pg.disabled = false; pg.textContent = t; err(x.message || String(x)); }
      };
      el.querySelector('#lg-form').onsubmit = async e => {
        e.preventDefault(); const code = el.querySelector('#lg-code').value; if (!code) { err('Inserisci il codice.'); return; }
        const b = el.querySelector('#lg-adm'); b.disabled = true; b.textContent = 'Verifico…'; err('');
        try { await adminOpen(code, el.querySelector('#lg-rem').checked); finish(); }
        catch (x) { b.disabled = false; b.textContent = 'Entra come Dungeon Master'; err(x.message === 'nokey' ? 'Accesso non riuscito.' : (x.message || String(x))); }
      };
    });
  }

  const ready = (async () => {
    await domReady();
    const rem = ls.get('cdnd_remember');
    // l'accesso come ospite è stato tolto: chi lo aveva scelto torna alla schermata di accesso
    if (rem === 'guest') { ls.del('cdnd_remember'); await loginUI(); }
    else if (rem && rem.startsWith('player:')) {
      try { await playerOpen(rem.slice(7), null, false); }
      catch (x) { ls.del('cdnd_remember'); ls.del('cdnd_pkey'); await loginUI(x.message === 'nokey' ? 'La password è cambiata: accedi di nuovo.' : (x.message || '')); }
    }
    else if (rem === 'admin') {
      try { await adminOpen(null, true); }
      catch (x) { ls.del('cdnd_remember'); await loginUI(x.message === 'nokey' ? 'Accedi di nuovo con il codice.' : ''); }
    } else await loginUI();
    applyRoleUI();
    if (ROLE === 'admin') { outbox(); if (ls.get('cdnd_review')) setReview(true); if (DROPPED) setTimeout(() => notice('Ho tolto da questo browser le modifiche vecchie mai inviate: ora vedi i dati pubblicati.'), 800); }
  })();

  /* ---------- database (stessa interfaccia usata dall'app) ---------- */
  const col = c => {
    const snap = () => ({ docs: [...(MEM[c] || new Map()).entries()].map(([id, v]) => ({ id, data: () => clone(v) })), docChanges: () => [] });
    return {
      onSnapshot(cb) { setTimeout(() => cb(snap()), 0); return () => { }; },
      async get() { return snap(); },
      doc(id) {
        return {
          async get() { const v = (MEM[c] || new Map()).get(id); return { exists: v !== undefined, id, data: () => v === undefined ? undefined : clone(v) }; },
          async set(v) {
            if (ROLE !== 'admin') throw ROERR(); v = clone(v); const m = MEM[c] = MEM[c] || new Map();
            if (m.has(id) && JSON.stringify(m.get(id)) === JSON.stringify(v)) return; // nulla di nuovo
            m.set(id, v); const t = DB.transaction('docs', 'readwrite'); t.objectStore('docs').put(v, c + '/' + id); await done(t); changed(c + '/' + id);
          },
          async delete() { if (ROLE !== 'admin') throw ROERR(); if (!MEM[c] || !MEM[c].has(id)) return; MEM[c].delete(id); const t = DB.transaction('docs', 'readwrite'); t.objectStore('docs').delete(c + '/' + id); await done(t); changed(c + '/' + id); }
        };
      }
    };
  };
  // la data dell'ultimo backup è solo di questo browser: non è una modifica da inviare
  const LOCAL_ONLY = new Set(['meta/lastBackup']);
  function changed(k) {
    if (k && !LOCAL_ONLY.has(k)) PEND.add(k);
    IDX = null; saveState();
  }
  const anyPending = () => PEND.size + PFILES.size + NOTES.length + BUGS.length > 0;
  function saveState() {
    const t = DB.transaction('kv', 'readwrite'); const o = t.objectStore('kv');
    o.put([...PEND], 'pending'); o.put([...PFILES], 'pfiles'); o.put(NOTES, 'notes'); o.put(BUGS, 'bugs'); o.put(anyPending(), 'dirty');
    SENT = false; o.put(false, 'sent'); // c'è qualcosa di nuovo: va inviato di nuovo
    done(t).catch(() => { }); outbox();
  }
  const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
  const assets = {
    async upload(blob) { if (ROLE !== 'admin') throw ROERR(); const id = 'L' + newId(); const t = DB.transaction('files', 'readwrite'); t.objectStore('files').put({ blob, type: blob.type }, id); await done(t); PFILES.add(id); changed(); return { id, url: '#local/' + id, sizeBytes: blob.size, contentType: blob.type }; },
    async list() { return { assets: [], usage: null }; },
    async delete() { }
  };
  const user = { canEdit: async () => ROLE === 'admin', isOwner: async () => ROLE === 'admin', can: async () => ROLE === 'admin' };
  const downloads = {
    async save({ filename, data }) {
      const b = data instanceof Blob ? data : new Blob([data]); const u = URL.createObjectURL(b);
      const a = document.createElement('a'); a.href = u; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
    }
  };
  window.claude = { use: async name => { if (name === 'db') { await ready; return { collection: col }; } if (name === 'assets') return assets; if (name === 'user') return user; if (name === 'downloads') return downloads; return null; } };
  Object.defineProperty(window, '__RO', { get: () => ROLE !== 'admin' });

  window.__blobFetch = async aid => {
    await ready;
    if (DB) { const f = await rq(store('files').get(aid)); if (f) return { ok: true, blob: async () => f.blob }; }
    const p = BLOBMAP[aid];
    if (p && p.startsWith('priv/') && BLOBKEYS[aid]) { try { const b = await playerBlob(aid, p); return { ok: true, blob: async () => b }; } catch { return { ok: false, status: 404 }; } }
    if (!p || p.startsWith('priv/')) return { ok: false, status: 404 };
    return fetch(fileUrl(p));
  };
  window.__blobHref = aid => { const p = BLOBMAP[aid]; return p && !p.startsWith('priv/') ? fileUrl(p) : ''; };
  // giocatore: le immagini riservate che può vedere arrivano cifrate con una chiave propria, che c'è solo nella sua copia
  const PLAIN = new Map();
  async function playerBlob(aid, p) {
    if (!PLAIN.has(aid)) PLAIN.set(aid, (async () => {
      const r = await fetch(fileUrl(p)); if (!r.ok) throw new Error(r.status);
      const buf = new Uint8Array(await r.arrayBuffer()), t = [...(MEM.blobs?.values() || [])].find(b => b.aid === aid)?.type;
      return new Blob([await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, await aesKey(b64d(BLOBKEYS[aid])), buf.slice(12))], { type: t || 'image/jpeg' });
    })().catch(x => { PLAIN.delete(aid); throw x; }));
    return PLAIN.get(aid);
  }
  window.__player = () => PLAYER && { ...PLAYER };
  /* tavolo virtuale: chi sei e la chiave del tuo accesso (da cui il tavolo ricava il tuo account Supabase, senza nuove password).
     Il DM riceve anche gli account dei giocatori, per prepararli. */
  window.__tavolo = async () => {
    await ready;
    if (ROLE === 'admin') return { ruolo: 'dm', raw: RAW, it: ITER, giocatori: clone(MEM.meta?.get('giocatori')?.v || []) };
    if (ROLE === 'player') return { ruolo: 'giocatore', id: PLAYER.id, nome: PLAYER.name, pg: PLAYER.pg || null, raw: PRAW };
    return null;
  };

  /* ---------- interfaccia per ruolo ---------- */
  const HIDE_ACTS = ['selmode', 'selall', 'selnone', 'selmove', 'edit', 'up', 'rensess', 'reimg', 'delRel', 'dmRel', 'del', 'copyctx', 'wipe', 'vedit', 'vdm', 'vpl', 'undo', 'toggleDisc', 'subup', 'rename', 'renSec', 'redraw', 'portrait', 'newsess', 'newent', 'merge', 'histgen', 'editreg', 'editpin', 'editmap', 'editgen', 'editEntry', 'drawundo', 'drawok', 'drawcancel', 'delreg', 'delpin', 'delphoto', 'delmap', 'delSec', 'delEntry', 'delDoc', 'cpDoc', 'copyEnt', 'bkFull', 'bkData', 'attach', 'analyze', 'addreg', 'addpin', 'addphotos', 'addSec', 'addRel', 'addEntry', 'addEv', 'editEv', 'delEv', 'demo', 'addArc', 'editArc', 'editApp'];
  const GUEST_CSS = HIDE_ACTS.map(a => `html.ro [data-act="${a}"]`).join(',') + `,html.ro a[href="#/import"],html.ro a[href="#/backup"],html.ro #b-edit,html.ro #b-add,html.ro #b-addreg,html.ro #seg,html.ro #access,html.ro input[type=file]:not(.segdlg *),html.ro label:has(input[type=file]):not(.segdlg *){display:none!important}`;
  // strumenti: un ingranaggio nella barra in alto, accanto alla ricerca, con il menu a tendina (non copre più il testo)
  const ROLE_CSS = `#tools{position:relative;flex:none;z-index:45;font:600 .7rem/1 Georgia,serif}
#tools .tlist{display:none;position:absolute;right:0;top:calc(100% + 12px);flex-direction:column;align-items:stretch;gap:6px;padding:8px;border-radius:12px;background:var(--wine-d,#561820);border:1px solid #e7cf9a80;box-shadow:0 6px 20px #0007;min-width:210px}
#tools.open .tlist{display:flex}
.tbtn{display:flex;align-items:center;gap:9px;height:36px;padding:0 12px 0 9px;border-radius:18px;border:1px solid #e7cf9a66;background:#00000030;color:#f5e6c4;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;font:inherit;white-space:nowrap;text-align:left}
.tbtn:hover,.tbtn:focus-visible{background:#a7343b;border-color:#e7cf9a;outline:none}
.tbtn:disabled{opacity:.6}
.tbtn .ti{width:18px;text-align:center;font-size:1rem;flex:none}
.tbtn svg{width:16px;height:16px;flex:none;margin:0 1px}
#tools .ttog{height:34px;padding:0 12px 0 9px;border-radius:17px;background:#00000030;border:1px solid #ffffff30}
#tools.open .ttog{background:#00000055;border-color:#e7cf9a}
#tools .ttog .tr{font-size:.6rem;padding:3px 6px;border-radius:9px;border:1px solid #e7cf9a99;color:#f7e3ae;margin-left:2px}
#tools .trole{padding:4px 6px 6px;color:#e7cf9a;font-size:.68rem;letter-spacing:.08em;text-transform:uppercase;border-bottom:1px solid #e7cf9a40;margin-bottom:2px}
#tools .ttog.hasav{position:relative;padding-left:3px}
#tools .ttog .tav{width:28px;height:28px;border-radius:50%;object-fit:cover;object-position:50% 15%;border:1.5px solid #e7cf9a;flex:none;box-sizing:border-box}
#tools .ttog .tgear{position:absolute;left:19px;bottom:-3px;width:15px;height:15px;border-radius:50%;background:var(--wine-d,#561820);border:1px solid #e7cf9a99;display:flex;align-items:center;justify-content:center;font-size:.6rem;line-height:1}
#themeBtn{flex:none;font-size:1.05rem}
@media (max-width:1280px){#tools .ttog .tl{display:none}}
@media (max-width:620px){#tools .ttog{width:34px;padding:0;justify-content:center}#tools .ttog .tr{display:none}#tools .ttog .tav{width:32px;height:32px}#tools .ttog .tgear{left:auto;right:-4px}}`;
  function applyRoleUI() {
    const root = document.documentElement; root.classList.add(ROLE === 'admin' ? 'adm' : 'ro');
    if (ROLE !== 'admin') {
      const st = document.createElement('style'); st.textContent = GUEST_CSS; document.head.append(st);
      const guard = () => { if (/^#\/(import|backup)/.test(location.hash)) location.hash = '#/'; };
      addEventListener('hashchange', guard); guard();
    }
    const top = document.querySelector('header.top'), theme = document.getElementById('themeBtn'); if (!top || !theme) return;
    const st2 = document.createElement('style'); st2.textContent = ROLE_CSS; document.head.append(st2);
    const adm = ROLE === 'admin';
    const box = document.createElement('aside'); box.id = 'tools'; box.setAttribute('aria-label', 'Strumenti');
    const tog = document.createElement('button'); tog.type = 'button'; tog.className = 'tbtn ttog'; tog.setAttribute('aria-expanded', 'false');
    const chi = adm ? 'DM' : PLAYER ? PLAYER.name : 'Ospite';
    // il giocatore vede in alto il ritratto del suo personaggio (dalla sua scheda), con l'ingranaggio in piccolo
    const foto = PLAYER?.pg ? MEM.entities?.get(PLAYER.pg)?.portrait?.thumb : null;
    if (foto) tog.classList.add('hasav');
    tog.innerHTML = (foto ? `<img class="tav" src="${esc(foto)}" alt=""><span class="tgear" aria-hidden="true">⚙</span>` : '<span class="ti" aria-hidden="true">⚙</span>') + `<span class="tl">Strumenti</span><span class="tr">${esc(chi)}</span>`;
    tog.title = 'Strumenti · ' + (adm ? 'Dungeon Master' : PLAYER ? PLAYER.name : 'Ospite');
    const list = document.createElement('div'); list.className = 'tlist';
    const role = document.createElement('div'); role.className = 'trole'; role.textContent = adm ? 'Dungeon Master' : PLAYER ? PLAYER.name + ' · sola lettura' : 'Ospite · sola lettura'; list.append(role);
    const mk = (icon, label, title, fn, id) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'tbtn'; if (id) b.id = id; b.title = title; b.innerHTML = `<span class="ti" aria-hidden="true">${icon}</span><span class="tl">${label}</span>`; b.onclick = fn; list.append(b); return b; };
    const setOpen = o => { box.classList.toggle('open', o); tog.setAttribute('aria-expanded', String(o)); };
    tog.onclick = () => setOpen(!box.classList.contains('open'));
    document.addEventListener('click', e => { if (!box.contains(e.target)) setOpen(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') setOpen(false); });
    const up = mk('⟳', 'Verifica aggiornamento', 'Verifica se c\'è una versione più recente del sito e caricala subito', () => checkUpdate(up), 'upbtn');
    if (PLAYER) { mk('🐞', 'Segnala un bug', 'Qualcosa non funziona o si vede male: avvisa il DM', () => { setOpen(false); playerDlg('bug'); }); mk('💡', 'Proponi una miglioria', 'Un\'idea per migliorare il sito: proponila al DM', () => { setOpen(false); playerDlg('idea'); }); }
    if (adm) mk('✎', 'Segnala a Claude', 'Segnala un errore o correggi i contenuti del sito', () => { setOpen(false); reportDlg(); });
    if (adm) mk('🕘', 'Versioni salvate', 'Le ultime versioni salvate dal sito: puoi tornare a una precedente', () => { setOpen(false); versioniDlg(); });
    if (adm) mk('👥', 'Account giocatori', 'Password dei giocatori: vederle o cambiarle', () => { setOpen(false); accountsDlg(); });
    if (adm) { mk('⇪', 'Importa', 'Importa una sessione o dei dati', () => { setOpen(false); location.hash = '#/import'; }); mk('⛁', 'Backup', 'Scarica o ripristina un backup', () => { setOpen(false); location.hash = '#/backup'; }); }
    const out = mk('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"/><path d="M16 8l4 4-4 4"/><path d="M20 12H9"/></svg>', 'Esci', 'Esci e torna alla schermata di accesso', async () => { out.disabled = true; ls.del('cdnd_remember'); ls.del('cdnd_pkey'); if (DB) { try { const t = DB.transaction('kv', 'readwrite'); t.objectStore('kv').delete('key'); await done(t); } catch { } } location.reload(); });
    box.append(tog, list); top.append(box);
    // il tasto del tema resta in vista nella barra in alto, accanto alla ricerca
    const tt = () => { const sc = document.documentElement.dataset.theme === 'dark'; theme.title = theme.ariaLabel = sc ? 'Passa al tema chiaro' : 'Passa al tema scuro'; };
    tt(); new MutationObserver(tt).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const sp = document.createElement('span'); sp.style.cssText = 'flex:1 1 0;min-width:0'; sp.className = 'spacer-top'; top.insertBefore(sp, document.getElementById('srchBtn'));
  }

  /* ---------- amministratore: richiesta a Claude ---------- */
  const ASK_REPO = 'https://github.com/marianogianmarco96-maker/Avalar';
  // apre GitHub con una richiesta per Claude già compilata (solo per il DM)
  // la firma (cifrata con la chiave del DM) dimostra a Claude che la richiesta viene davvero dal DM:
  // si controlla con strumenti/verifica_richiesta.py
  async function firma(txt) {
    const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt.replace(/\r/g, '').trim()));
    const iv = crypto.getRandomValues(new Uint8Array(12)), ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(RAW), h));
    const all = new Uint8Array(12 + ct.length); all.set(iv); all.set(ct, 12); return b64e(all);
  }
  window.__sendRequest = async (title, body) => {
    if (ROLE !== 'admin') return;
    const w = window.open('', '_blank'), page = (document.title || '').replace(/ · Campagna D&D.*$/, '');
    const t = '[Richiesta] ' + (title.length > 70 ? title.slice(0, 67) + '…' : title);
    let txt = body.slice(0, 6000) + '\n\n---\nInviata dal sito, pagina: ' + page + ' (' + location.hash + ')';
    txt += '\n\nFirma DM: ' + await firma(txt);
    const url = ASK_REPO + '/issues/new?title=' + encodeURIComponent(t) + '&body=' + encodeURIComponent(txt);
    if (w) { w.opener = null; w.location = url; } else window.open(url, '_blank', 'noopener');
  };
  function askClaude() {
    let d = document.getElementById('askdlg'); if (d) d.remove();
    d = document.createElement('dialog'); d.id = 'askdlg'; d.style.cssText = 'border:1px solid #a98334;border-radius:12px;background:#fbf5e3;color:#2b1d14;padding:20px;width:min(560px,92vw);font:16px/1.4 Georgia,serif';
    d.innerHTML = `<h3 style="margin:0 0 6px;font-family:Cinzel,Georgia,serif;color:#561820">Chiedi una modifica a Claude</h3>
      <p style="margin:0 0 10px;color:#5a4636">Scrivi cosa vuoi cambiare e premi «Invia a Claude»: si apre GitHub con la richiesta già compilata, tu confermi con «Create». Claude la studia e prepara la modifica, che resta in attesa finché non la approvi tu.</p>
      <textarea id="ask-t" rows="6" style="width:100%;box-sizing:border-box;border:1px solid #c4ae80;border-radius:8px;padding:10px;font:inherit;background:#fffdf4" placeholder="Es.: nella scheda di Robin aggiungi che…"></textarea>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button id="ask-s" class="btn primary">Invia a Claude</button><button id="ask-c" class="btn">Copia richiesta</button><button id="ask-x" class="btn">Copia richiesta + contesto</button><button id="ask-k" class="btn ghost" style="margin-left:auto">Chiudi</button></div><p id="ask-m" style="min-height:1.2em;color:#3f6b46;margin:8px 0 0"></p>`;
    document.body.append(d); d.showModal();
    const text = async ctx => { const body = d.querySelector('#ask-t').value.trim(); if (!body) { d.querySelector('#ask-m').textContent = 'Scrivi prima la richiesta.'; return null; } let t = 'Richiesta di modifica per la campagna D&D:\n\n' + body + '\n'; if (ctx && window.__cronache?.buildContext) { try { t += '\n--- Contesto della campagna ---\n' + await window.__cronache.buildContext({ full: false }); } catch { } } return t; };
    const copy = async t => { try { await navigator.clipboard.writeText(t); } catch { const a = document.createElement('textarea'); a.value = t; document.body.append(a); a.select(); document.execCommand('copy'); a.remove(); } d.querySelector('#ask-m').textContent = 'Copiato: incollalo nella chat con Claude.'; };
    d.querySelector('#ask-s').onclick = () => {
      const body = d.querySelector('#ask-t').value.trim(); if (!body) { d.querySelector('#ask-m').textContent = 'Scrivi prima la richiesta.'; return; }
      window.__sendRequest(body.split('\n')[0], body);
      d.querySelector('#ask-m').textContent = 'Si è aperto GitHub: premi «Create» per inviare la richiesta.';
    };
    d.querySelector('#ask-c').onclick = async () => { const t = await text(false); if (t) copy(t); };
    d.querySelector('#ask-x').onclick = async () => { const t = await text(true); if (t) copy(t); };
    d.querySelector('#ask-k').onclick = () => d.close();
  }

  /* ---------- verifica aggiornamento (tutti) ----------
     Scarica di nuovo dal server i file del sito, scavalcando le copie del browser: se qualcosa è cambiato
     ricarica la pagina con la versione nuova, altrimenti lo dice. */
  function notice(t) {
    let n = document.getElementById('upnote'); if (n) n.remove();
    n = document.createElement('div'); n.id = 'upnote'; n.setAttribute('role', 'status'); n.textContent = t;
    n.style.cssText = 'position:fixed;left:50%;top:calc(70px + env(safe-area-inset-top,0px));transform:translateX(-50%);z-index:9999;max-width:min(520px,92vw);background:#561820;color:#f5e6c4;padding:10px 16px;border-radius:8px;font:15px/1.35 Georgia,serif;box-shadow:0 4px 16px #0006;text-align:center';
    document.body.append(n); setTimeout(() => n.remove(), 7000);
  }
  async function checkUpdate(btn) {
    btn.disabled = true; btn.classList.add('spin');
    try {
      // i dati salvati dal DM su Supabase: è cambiato qualcosa se c'è una cartella nuova
      const prima = FONTE && FONTE.base, ora = (await fonte(true)).base;
      const files = ['index.html', 'local.js', 'copie.js', 'sw.js'].concat(ora ? [] : [ROLE === 'admin' ? 'data.enc' : PLAYER ? 'giocatori/' + PLAYER.id + '.enc' : 'data.json']);
      const fresh = await Promise.all(files.map(async f => { const r = await fetch(f + '?v=' + Date.now(), { cache: 'reload' }); if (!r.ok) throw new Error(); return r.text(); }));
      const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
      if (reg) await reg.update().catch(() => { });
      let changed = !('caches' in window) || prima !== ora;
      if (!changed) {
        const name = (await caches.keys()).find(k => k.startsWith('campagna-') && k !== 'campagna-fonts');
        const c = name && await caches.open(name);
        for (let i = 0; i < files.length && !changed; i++) {
          if (files[i] === 'sw.js') { changed = !!(reg && (reg.installing || reg.waiting)); continue; }
          const old = c && (await c.match(files[i], { ignoreSearch: true }) || (files[i] === 'index.html' ? await c.match('./') : null));
          changed = !old || (await old.text()) !== fresh[i];
        }
        // la prossima apertura usa subito i file appena scaricati
        if (c) for (let i = 0; i < files.length; i++) if (files[i] !== 'sw.js') { await c.put(files[i], new Response(fresh[i], { headers: { 'Content-Type': files[i].endsWith('.js') ? 'text/javascript' : files[i].endsWith('.html') ? 'text/html' : 'application/json' } })); if (files[i] === 'index.html') await c.put('./', new Response(fresh[i], { headers: { 'Content-Type': 'text/html' } })); }
      }
      if (changed) { ls.set('cdnd_updated', '1'); location.reload(); return; }
      notice('Hai già la versione più recente. Se hai appena approvato una modifica di Claude, GitHub può metterci qualche minuto a pubblicarla: riprova tra poco.');
    } catch { notice('Non riesco a contattare il sito: controlla la connessione e riprova.'); }
    btn.disabled = false; btn.classList.remove('spin');
  }
  if (ls.get('cdnd_updated')) { ls.del('cdnd_updated'); domReady().then(() => setTimeout(() => notice('Sito aggiornato all\'ultima versione.'), 600)); }

  /* ---------- modifiche fatte sul sito (amministratore) ----------
     Ogni modifica compare subito in un riquadro «da inviare a Claude». Inviandola si apre GitHub con una richiesta
     già pronta: il contenuto è cifrato con la chiave del DM, così su GitHub nessuno legge i segreti della campagna.
     Dopo l'invio (o se la si scarta) il browser torna ai dati pubblicati: qui non resta nulla. */
  const b64e = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const GROUPS = [[['entities', 'bodies'], 'scheda', 'schede'], [['sessions', 'sbodies'], 'sessione', 'sessioni'], [['events'], 'evento', 'eventi'], [['maps'], 'mappa', 'mappe'],
    [['pins'], 'segnalino', 'segnalini'], [['regions'], 'regione', 'regioni'], [['links'], 'collegamento', 'collegamenti'], [['blobs'], 'immagine', 'immagini'], [['meta'], 'impostazione', 'impostazioni']];
  function summary(soloDati) {
    const ids = {}; for (const k of PEND) { const j = k.indexOf('/'); (ids[k.slice(0, j)] = ids[k.slice(0, j)] || new Set()).add(k.slice(j + 1)); }
    const out = [];
    for (const [cs, one, many] of GROUPS) { const u = new Set(); for (const c of cs) for (const id of ids[c] || []) if (!/-t$/.test(id)) u.add(id.replace(/^portrait-/, '')) /* le miniature non contano come immagini a parte */; if (u.size) out.push(u.size + ' ' + (u.size === 1 ? one : many)); }
    const other = Object.keys(ids).filter(c => !GROUPS.some(g => g[0].includes(c))); if (other.length) out.push('altro');
    if (!out.length && PFILES.size) out.push(PFILES.size + (PFILES.size === 1 ? ' immagine' : ' immagini'));
    if (soloDati) return out.join(', ');
    if (NOTES.length) out.push(NOTES.length + (NOTES.length === 1 ? ' nota' : ' note'));
    if (BUGS.length) out.push(BUGS.length + (BUGS.length === 1 ? ' errore' : ' errori'));
    return out.join(', ');
  }
  // dati pubblicati, per mandare solo i campi cambiati (le schede contengono anche il ritratto, troppo grande da rimandare)
  let SERVER = null;
  async function serverData() {
    await fonte(true);
    const enc = await (await dataFetch('data.enc')).json();
    if (!SERVER || SERVER.iv !== enc.iv) SERVER = { iv: enc.iv, env: { it: enc.it, salt: enc.salt }, d: JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(enc.iv) }, await aesKey(RAW), b64d(enc.ct)))) };
    return SERVER.d;
  }
  async function buildRequest() {
    const base = (await serverData()).stores, ops = [];
    for (const k of PEND) {
      const j = k.indexOf('/'), c = k.slice(0, j), id = k.slice(j + 1), m = MEM[c], old = base[c] && base[c][id];
      if (!m || !m.has(id)) { if (old !== undefined) ops.push({ c, id, del: 1 }); continue; }
      const v = m.get(id);
      if (old === undefined || typeof v !== 'object' || typeof old !== 'object' || !v || !old || Array.isArray(v)) { ops.push({ c, id, v }); continue; }
      const set = {}, unset = Object.keys(old).filter(f => !(f in v));
      for (const f of Object.keys(v)) if (JSON.stringify(v[f]) !== JSON.stringify(old[f])) set[f] = v[f];
      if (Object.keys(set).length || unset.length) ops.push({ c, id, set, unset });
    }
    const files = {};
    for (const aid of PFILES) { const f = await rq(store('files').get(aid)); if (f) files[aid] = { type: f.type || f.blob.type, b64: b64e(new Uint8Array(await f.blob.arrayBuffer())) }; }
    const bugfiles = {};
    for (const b of BUGS) for (const aid of b.photos || []) { const f = await rq(store('files').get(aid)); if (f) bugfiles[aid] = { type: f.type || f.blob.type, b64: b64e(new Uint8Array(await f.blob.arrayBuffer())) }; }
    let bytes = new TextEncoder().encode(JSON.stringify({ v: 1, base: await kvGet('dataVersion'), at: new Date().toISOString(), ops, files, notes: NOTES, bugs: BUGS, bugfiles }));
    if ('CompressionStream' in window) bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(RAW), bytes));
    const all = new Uint8Array(12 + ct.length); all.set(iv); all.set(ct, 12);
    const block = 'AVALAR-MODIFICHE-1\n' + b64e(all).replace(/.{76}/g, '$&\n').trim() + '\nFINE';
    const sum = summary(), title = '[Richiesta] Modifiche dal sito: ' + sum;
    const intro = 'Modifiche fatte sul sito dal Dungeon Master (' + sum + ').\n\nIl contenuto è cifrato con il codice del DM, così chi legge GitHub non vede i segreti della campagna.\n\n'
      + 'Per Claude: salva il blocco in un file e applicalo con `python3 strumenti/applica_richiesta.py CODICE file.txt dm.json` (dopo `pubblica.py apri`, poi `pubblica.py salva`).\n\n';
    const url = b => ASK_REPO + '/issues/new?title=' + encodeURIComponent(title) + '&body=' + encodeURIComponent(b);
    const inl = url(intro + '```\n' + block + '\n```\n');
    if (inl.length < 7000) return { url: inl };
    // troppo grande per stare nell'indirizzo (di solito per le immagini): va allegato come file
    return { url: url(intro + '**Le modifiche sono nel file «modifiche-avalar.txt» che il sito ha appena scaricato: allegalo qui sotto (trascinalo in questo riquadro o tocca «Paste, drop, or click to add files») prima di premere «Create».**\n'), file: new Blob([block + '\n'], { type: 'text/plain' }) };
  }
  async function resetToServer(btn) {
    if (btn) btn.disabled = true;
    try {
      await fonte(true);
      const enc = await (await dataFetch('data.enc')).json();
      const payload = JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(enc.iv) }, await aesKey(RAW), b64d(enc.ct))));
      const t = DB.transaction('files', 'readwrite'); for (const aid of PFILES) t.objectStore('files').delete(aid); for (const b of BUGS) for (const aid of b.photos || []) t.objectStore('files').delete(aid); await done(t);
      await seedAdmin(payload, RAW); location.reload();
    } catch { if (btn) btn.disabled = false; notice('Non riesco a scaricare i dati pubblicati: controlla la connessione e riprova.'); }
  }
  /* ---------- salvare dal sito (amministratore) ----------
     «Salva» mette subito online le modifiche, senza passare da Claude: parte dai dati pubblicati più recenti, ci mette
     sopra i documenti cambiati su questo browser (come strumenti/applica_richiesta.py), prepara le copie dei giocatori
     e le cifra con la password di ognuno (come pubblica.py salva, con copie.js), poi carica tutto su Supabase in una
     cartella nuova. Supabase riceve solo file cifrati e tiene le ultime 15 versioni (Strumenti › Versioni salvate). */
  const datiDaSalvare = () => PEND.size + PFILES.size > 0;
  const sha16 = async u8 => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', u8)), b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
  async function cifra(raw, u8) { const iv = crypto.getRandomValues(new Uint8Array(12)); return { iv, ct: new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(raw), u8)) }; }
  const unisci = (a, b) => { const o = new Uint8Array(a.length + b.length); o.set(a); o.set(b, a.length); return o; };
  const gzip = async u8 => new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
  const EST = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
  // un'immagine in chiaro: dal browser se c'è (le riservate sono già decifrate qui), altrimenti dal suo indirizzo
  async function immagine(aid, p) {
    const f = await rq(store('files').get(aid)); if (f) return new Uint8Array(await f.blob.arrayBuffer());
    const r = await fetch(fileUrl(p)); if (!r.ok) throw new Error('Non trovo l\'immagine ' + p);
    const b = new Uint8Array(await r.arrayBuffer());
    return p.startsWith('priv/') ? new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.slice(0, 12) }, await aesKey(RAW), b.slice(12))) : b;
  }
  async function preparaSalvataggio(passo) {
    const { copia, giocatori } = window.__copie;
    passo('Preparo i dati…');
    const d = clone(await serverData()), env = SERVER.env, S = d.stores, file = []; // file: [percorso nel bucket, contenuto, tipo]
    const daCapo = d.dataVersion !== await kvGet('dataVersion'); // un altro dispositivo ha salvato: dopo ricarico la pagina
    for (const k of PEND) {
      const j = k.indexOf('/'), c = k.slice(0, j), id = k.slice(j + 1), m = MEM[c];
      S[c] = S[c] || {};
      if (m && m.has(id)) S[c][id] = clone(m.get(id)); else delete S[c][id];
    }
    // immagini nuove: in chiaro se le vede chiunque, altrimenti cifrate con la chiave del DM
    const nuove = {};
    for (const aid of PFILES) {
      const f = await rq(store('files').get(aid)); if (!f) continue;
      const b = new Uint8Array(await f.blob.arrayBuffer()), type = f.type || f.blob.type;
      nuove[aid] = { b, nome: 'sb-' + await sha16(b), type };
      d.blobmap[aid] = 'blobs/' + nuove[aid].nome + (EST[type] || '.bin');
    }
    let pubbliche = new Set(Object.keys(copia(d).blobmap));
    for (const [aid, n] of Object.entries(nuove)) {
      if (pubbliche.has(aid)) { file.push([d.blobmap[aid], n.b, n.type]); continue; }
      const e = await cifra(RAW, n.b); d.blobmap[aid] = 'priv/' + n.nome + '.bin'; file.push([d.blobmap[aid], unisci(e.iv, e.ct), 'application/octet-stream']);
    }
    // come immagini_riservate() in pubblica.py: un'immagine resta in chiaro solo se la vede un ospite…
    passo('Controllo le immagini riservate…');
    const bm = d.blobmap; pubbliche = new Set(Object.keys(copia(d).blobmap));
    const fatte = {};
    for (const [aid, p] of Object.entries(bm)) {
      if (!p.startsWith('blobs/') || pubbliche.has(aid) || [...pubbliche].some(a => bm[a] === p)) continue;
      if (!(p in fatte)) {
        let b = null; try { b = await immagine(aid, p); } catch { } // non raggiungibile: resta dov'è, tanto nessuna copia la nomina
        if (b) { const e = await cifra(RAW, b); file.push(['priv/sb-' + await sha16(b) + '.bin', unisci(e.iv, e.ct), 'application/octet-stream']); fatte[p] = file[file.length - 1][0]; } else fatte[p] = null;
      }
      if (fatte[p]) bm[aid] = fatte[p];
    }
    // …e quelle riservate che vede qualche giocatore ricevono una chiave propria, che arriva solo nelle copie di chi le vede
    const chiavi = d.blobkeys = d.blobkeys || {}, finta = { ...d, blobkeys: Object.fromEntries(Object.keys(bm).map(a => [a, ''])) };
    const usate = new Set(); for (const g of giocatori(d)) for (const [aid, p] of Object.entries(copia(finta, g.id).blobmap)) if (p.startsWith('priv/')) usate.add(aid);
    const rifatte = {};
    for (const aid of [...usate].filter(a => !(a in chiavi)).sort()) {
      const p = bm[aid];
      if (!rifatte[p]) {
        const plain = await immagine(aid, p), kk = crypto.getRandomValues(new Uint8Array(32)), e = await cifra(kk, plain);
        rifatte[p] = ['priv/sb-' + await sha16(plain) + '-g.bin', b64e(kk)]; file.push([rifatte[p][0], unisci(e.iv, e.ct), 'application/octet-stream']);
      }
      [bm[aid], chiavi[aid]] = rifatte[p];
    }
    d.dataVersion = Math.floor(Date.now() / 1000); // gli altri dispositivi del DM riprendono i dati nuovi
    for (const g of giocatori(d)) if (!g.salt) g.salt = b64e(crypto.getRandomValues(new Uint8Array(16)));
    const cartella = 'v/' + Date.now().toString(36) + '-' + newId().slice(0, 10);
    passo('Cifro i dati del DM…');
    const e = await cifra(RAW, new TextEncoder().encode(JSON.stringify(d)));
    file.push([cartella + '/data.enc', JSON.stringify({ v: 1, it: env.it, salt: env.salt, iv: b64e(e.iv), ct: b64e(e.ct) }), 'application/json']);
    for (const g of giocatori(d)) {
      if (!g.code) continue;
      passo('Preparo la copia di ' + g.name + '…');
      const kg = await deriveRaw(g.code, b64d(g.salt), env.it), c = await cifra(kg, await gzip(new TextEncoder().encode(JSON.stringify(copia(d, g.id)))));
      file.push([cartella + '/giocatori/' + g.id + '.enc', JSON.stringify({ v: 1, z: 1, it: env.it, salt: g.salt, iv: b64e(c.iv), ct: b64e(c.ct) }), 'application/json']);
    }
    return { d, env, file, cartella, iv: b64e(e.iv), daCapo };
  }
  const giaCaricato = e => e && (String(e.statusCode) === '409' || /exists|duplicate/i.test(e.message || ''));
  async function togliCartella(sb, cart) {
    const g = await sb.storage.from('sito').list(cart + '/giocatori');
    await sb.storage.from('sito').remove([cart + '/data.enc', ...(g.data || []).map(x => cart + '/giocatori/' + x.name)]);
  }
  let SAVING = null;
  async function salvaSito() {
    if (SAVING) return;
    const passo = t => { SAVING = t; drawOutbox(); };
    passo('Mi collego a Supabase…');
    try {
      if (!window.__sbDM || !window.__copie) throw new Error('Ricarica la pagina e riprova.');
      const sb = await window.__sbDM();
      for (let prova = 0; ; prova++) {
        const p = await preparaSalvataggio(passo), nota = summary(true);
        for (const [i, [path, body, type]] of p.file.entries()) {
          passo('Carico su Supabase… (' + (i + 1) + ' di ' + p.file.length + ')');
          const r = await sb.storage.from('sito').upload(path, new Blob([body], { type }), { contentType: type, upsert: false, cacheControl: '31536000' });
          if (r.error && !giaCaricato(r.error)) throw new Error(/row-level|policy|Unauthorized|not found/i.test(r.error.message) ? 'Manca la preparazione di Supabase: esegui tavolo/sito-1.sql nell\'SQL Editor.' : r.error.message);
        }
        const r = await sb.rpc('sito_pubblica', { p_prima: FONTE.sbv, p_cartella: p.cartella, p_nota: nota });
        if (r.error) {
          togliCartella(sb, p.cartella).catch(() => { });
          if (/conflitto/.test(r.error.message) && prova < 1) { passo('Un altro dispositivo ha appena salvato: riparto dai suoi dati…'); continue; }
          throw new Error(/conflitto/.test(r.error.message) ? 'Il sito è stato salvato da un altro dispositivo proprio adesso: riprova.' : r.error.message);
        }
        for (const c of r.data.vecchie || []) togliCartella(sb, c).catch(() => { });
        await dopoSalvataggio(p, r.data.versione);
        return;
      }
    } catch (x) {
      SAVING = null; drawOutbox(); notice('Non sono riuscito a salvare: ' + (x && x.message || 'riprova.'));
    }
  }
  // il browser riparte dai dati appena salvati, tenendo solo le note e gli errori ancora da inviare a Claude
  async function dopoSalvataggio(p, versione) {
    FONTE = { base: SB_FILES + p.cartella + '/', sbv: versione, pronto: true, cartella: p.cartella };
    ls.set('cdnd_sito', JSON.stringify({ versione, cartella: p.cartella }));
    SERVER = { iv: p.iv, env: p.env, d: p.d };
    const t = DB.transaction(['docs', 'kv'], 'readwrite'), docs = t.objectStore('docs'), kv = t.objectStore('kv'); docs.clear();
    for (const [c, ds] of Object.entries(p.d.stores)) for (const [id, v] of Object.entries(ds)) docs.put(v, c + '/' + id);
    kv.put(p.d.dataVersion, 'dataVersion'); kv.put(p.d.blobmap, 'blobmap'); kv.put([], 'pending'); kv.put([], 'pfiles');
    kv.put(NOTES.length + BUGS.length > 0, 'dirty'); kv.put(false, 'sent');
    await done(t);
    if (p.daCapo) { location.reload(); return; }
    MEM = {}; for (const [c, ds] of Object.entries(clone(p.d.stores))) MEM[c] = new Map(Object.entries(ds));
    BLOBMAP = p.d.blobmap; PEND = new Set(); PFILES = new Set(); SENT = false; IDX = null; SAVING = null;
    outbox(); notice('Salvato: le modifiche sono online.');
  }
  // Strumenti › Versioni salvate: le ultime 15, per tornare indietro
  async function versioniDlg() {
    const d = dlg('verdlg', `<h3 style="${H3}">Versioni salvate</h3><p class="sd" style="margin:0 0 8px">Ogni «Salva» tiene una copia: puoi rimettere online una versione precedente.</p><div class="rvl">Carico…</div><p class="sd m" style="min-height:1.2em;margin:8px 0 0"></p>
      <div style="display:flex;margin-top:10px"><button type="button" class="btn ghost" style="margin-left:auto" data-a="close">Chiudi</button></div>`);
    const body = d.querySelector('.rvl'), m = d.querySelector('.m');
    try {
      const sb = await window.__sbDM(), f = await fonte(true);
      const r = await sb.from('sito_versioni').select('id,versione,cartella,nota,creata').order('versione', { ascending: false });
      if (r.error) throw new Error(r.error.message);
      if (!r.data.length) { body.innerHTML = '<p class="sd">Nessun salvataggio ancora: i dati in uso sono quelli pubblicati da Claude su GitHub.</p>'; return; }
      body.innerHTML = r.data.map(v => `<div class="bugi" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span style="flex:1;min-width:180px"><b style="color:#561820">${esc(new Date(v.creata).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' }))}</b><br><span class="sd">${esc(v.nota || '')}</span></span>${f.cartella === v.cartella ? '<span class="sd"><b>In uso</b></span>' : `<button type="button" class="btn sm" data-id="${v.id}">Torna a questa</button>`}</div>`).join('')
        + (f.base ? '' : '<p class="sd">Adesso è in uso la versione pubblicata da Claude su GitHub, più recente di questi salvataggi.</p>');
      body.querySelectorAll('[data-id]').forEach(b => b.onclick = async () => {
        if (datiDaSalvare() && !confirm('Hai modifiche non salvate: tornando a una versione precedente le perdi. Continuare?')) return;
        if (!confirm('Rimettere online questa versione? Tutti vedranno i dati di quel momento.')) return;
        b.disabled = true; m.textContent = 'Ripristino…';
        const x = await sb.rpc('sito_ripristina', { p_id: +b.dataset.id });
        if (x.error) { b.disabled = false; m.textContent = x.error.message; return; }
        resetToServer();
      });
    } catch (x) { body.textContent = 'Non riesco a leggere le versioni: ' + (x && x.message || 'riprova.'); }
  }
  const OB_CSS = `#outbox{position:fixed;z-index:44;right:max(14px,env(safe-area-inset-right,0px));bottom:calc(16px + env(safe-area-inset-bottom,0px));width:min(430px,calc(100vw - 92px));box-sizing:border-box;display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:11px 12px;border-radius:12px;background:#561820;color:#f5e6c4;border:1px solid #e7cf9a;box-shadow:0 6px 20px #0007;font:15px/1.35 Georgia,serif}
#outbox .om{flex:1 1 100%}#outbox .om b{color:#f7e3ae;font-weight:600}
#outbox button{padding:7px 12px;border-radius:7px;border:1px solid #f5e6c488;background:#00000030;color:inherit;cursor:pointer;font:inherit}
#outbox button.p{background:#e7cf9a;color:#561820;border-color:#e7cf9a;font-weight:600}#outbox button:disabled{opacity:.6;cursor:wait}
@media (max-width:1280px){#outbox{bottom:calc(74px + env(safe-area-inset-bottom,0px))}}`;
  let OB = null, PREP = null, PREPV = 0, JUST = false;
  function outbox() {
    if (ROLE !== 'admin' || !document.body) return;
    if (!anyPending()) { if (OB) OB.remove(); OB = null; return; }
    if (!OB) { const st = document.createElement('style'); st.textContent = OB_CSS; document.head.append(st); OB = document.createElement('div'); OB.id = 'outbox'; OB.setAttribute('role', 'status'); document.body.append(OB); }
    PREP = null; const v = ++PREPV; drawOutbox();
    if (salvaQui()) return; // le modifiche si salvano su Supabase: la richiesta per Claude serve solo per note ed errori
    clearTimeout(outbox.t); outbox.t = setTimeout(() => buildRequest().then(r => { if (v === PREPV) { PREP = r; drawOutbox(); } }, () => { if (v === PREPV) { PREP = { err: true }; drawOutbox(); } }), 400);
  }
  // con tavolo/sito-1.sql eseguito le modifiche ai dati si salvano direttamente; senza, si mandano a Claude come prima
  const salvaQui = () => !!(FONTE && FONTE.pronto && datiDaSalvare());
  function drawOutbox() {
    if (!OB) return; OB.innerHTML = '';
    const msg = document.createElement('div'); msg.className = 'om'; OB.append(msg);
    const mk = (t, f, p) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; if (p) b.className = 'p'; b.onclick = () => f(b); OB.append(b); return b; };
    if (SAVING) { msg.innerHTML = '<b>Salvataggio in corso:</b> ' + esc(SAVING); return; }
    if (salvaQui()) {
      const altro = NOTES.length + BUGS.length ? ' Dopo potrai inviare a Claude anche le note e gli errori.' : '';
      msg.innerHTML = '<b>Da salvare:</b> ' + summary(true) + '. Finché non premi «Salva» le vedi solo tu.' + altro;
      mk('Salva', () => salvaSito(), true);
      mk('Rivedi elenco', () => reviewList());
      mk('Scarta', b => { if (confirm('Scartare le modifiche non salvate? Il sito torna ai dati pubblicati.')) resetToServer(b); }); return;
    }
    if (SENT) {
      const how = JUST ? (PREP && PREP.file ? '<b>Su GitHub allega il file «modifiche-avalar.txt» e premi «Create».</b> ' : '<b>Su GitHub premi «Create» per inviare la richiesta.</b> ') : '<b>Inviate a Claude:</b> ' + summary() + '. ';
      msg.innerHTML = how + 'Restano visibili su questo browser finché non approvi la modifica di Claude; quando è pubblicata questo riquadro sparisce da solo.';
      if (JUST) mk('Fatto', () => { JUST = false; drawOutbox(); }, true);
      mk('Riapri GitHub', () => send(), !JUST); if (!PREP || PREP.err) OB.lastChild.disabled = true;
      mk('Scarta', b => { if (confirm('Togliere da questo browser le modifiche inviate? Le rivedrai quando saranno pubblicate.')) resetToServer(b); }); return;
    }
    msg.innerHTML = '<b>Da inviare a Claude:</b> ' + summary() + '. Finché non le invii valgono solo su questo browser.';
    const go = mk(PREP ? (PREP.err ? 'Errore, riprova' : 'Invia a Claude') : 'Preparo…', () => PREP && !PREP.err ? send() : outbox(), true); if (!PREP) go.disabled = true;
    mk('Rivedi elenco', () => reviewList());
    mk('Scarta', b => { if (confirm('Scartare le modifiche non inviate? Il sito torna ai dati pubblicati.')) resetToServer(b); });
  }
  function send() {
    const r = PREP; if (!r || r.err) return;
    if (r.file) { const u = URL.createObjectURL(r.file), a = document.createElement('a'); a.href = u; a.download = 'modifiche-avalar.txt'; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 60000); }
    window.open(r.url, '_blank', 'noopener'); SENT = true; JUST = true; kvSet('sent', true).catch(() => { }); drawOutbox();
  }
  /* ---------- Segnala a Claude (amministratore) ----------
     Due strade: «Segnala un bug» raccoglie uno o più errori del sito, ognuno con una foto facoltativa;
     «Modifica il contenuto» accende la modalità revisione: si tocca un testo qualsiasi, lo si corregge sul posto
     (o si lascia una nota) e tutto si accumula nel riquadro in basso, da inviare a Claude con un tasto. */
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const H3 = 'margin:0 0 6px;font-family:Cinzel,Georgia,serif;color:#561820';
  const SEG_CSS = `.segdlg{border:1px solid #a98334;border-radius:12px;background:#fbf5e3;color:#2b1d14;padding:20px;width:min(560px,92vw);max-height:88vh;font:16px/1.4 Georgia,serif}
.segdlg .sd{color:#5a4636}
.segc{display:flex;gap:14px;align-items:flex-start;width:100%;text-align:left;padding:14px;border-radius:10px;border:1px solid #c4ae80;background:#fffdf4;margin-top:10px;font:inherit;color:inherit;cursor:pointer}
.segc:hover,.segc:focus-visible{border-color:#561820;background:#fff7e0;outline:none}
.segc .si{flex:none;width:40px;height:40px;border-radius:50%;background:#561820;color:#f5e6c4;display:grid;place-items:center;font-size:20px}
.seglink{border:0;background:none;padding:0;color:#7d2530;text-decoration:underline;font:inherit;font-size:.92rem;cursor:pointer}
.segta{width:100%;box-sizing:border-box;border:1px solid #c4ae80;border-radius:8px;padding:8px 10px;font:inherit;background:#fffdf4;color:#2b1d14}
.bugi{border:1px solid #d9c79c;border-radius:10px;padding:10px;margin-top:10px;background:#fffaf0}
.bugi .bh{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}.bugi .bh b{color:#561820}
.bugi .ph{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:8px}.bugi .ph img{width:84px;height:56px;object-fit:cover;border-radius:6px;border:1px solid #c4ae80}
.segx{border:0;background:none;color:#8a6d4a;cursor:pointer;font:inherit;font-size:.9rem;padding:2px 4px}
html.review main{padding-top:40px}
html.review .toc{top:calc(98px + env(safe-area-inset-top,0px))}
html.review #view :is(p,li,h1,h2,h3,h4,h5,dd,dt,td,th,figcaption,blockquote):hover{outline:1px dashed #b89a5a;outline-offset:3px;border-radius:3px;cursor:text}
#revbar{position:fixed;left:0;right:0;top:calc(58px + env(safe-area-inset-top,0px));z-index:29;min-height:40px;box-sizing:border-box;background:#3f6b46;color:#f5f0dc;padding:6px max(16px,env(safe-area-inset-right,0px)) 6px max(16px,env(safe-area-inset-left,0px));font:15px/1.3 Georgia,serif;display:flex;gap:12px;align-items:center;box-shadow:0 2px 8px #0004}
#revbar span{flex:1;min-width:0}#revbar button{flex:none;padding:5px 12px;border-radius:7px;border:1px solid #f5f0dc99;background:#00000030;color:inherit;cursor:pointer;font:inherit}
@media (max-width:620px){#revbar .rh{display:none}}
.revbox{border:2px solid #561820;border-radius:8px;padding:10px;background:#fffdf4;color:#2b1d14;margin:10px 0;font:16px/1.45 Georgia,serif;list-style:none;text-align:left;text-transform:none;letter-spacing:normal}
.revbox .rl{font-size:.85rem;color:#7a5c12;margin-bottom:6px}.revbox .rhint{font-size:.85rem;color:#8a7560;margin:4px 0 0}
.revbox .rb{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
.revbox .rc{display:block;width:100%;text-align:left;margin-top:6px}
.rvl{margin-top:10px;overflow:auto;max-height:62vh}.rvl .it{border-top:1px solid #dccaa0;padding:10px 0}.rvl .it:first-child{border-top:0}
.rvl .ih{display:flex;gap:8px;align-items:baseline}.rvl .ih b{flex:1;color:#561820}
.rvl .df{white-space:pre-wrap;font-size:.95rem;margin:4px 0 0;color:#3b2a1e}.rvl .df i{color:#8a7560;font-style:normal;font-size:.85rem;display:block}
.rvl del{background:#f4c7c3;color:#7d1f1a}.rvl ins{background:#cfe8c9;color:#1f5a26;text-decoration:none}`;
  const segCss = () => { if (!document.getElementById('segcss')) { const st = document.createElement('style'); st.id = 'segcss'; st.textContent = SEG_CSS; document.head.append(st); } };
  function dlg(id, html) {
    segCss(); let d = document.getElementById(id); if (d) d.remove();
    d = document.createElement('dialog'); d.id = id; d.className = 'segdlg'; d.innerHTML = html; document.body.append(d); d.showModal();
    d.addEventListener('close', () => d.remove()); d.querySelectorAll('[data-a=close]').forEach(b => b.onclick = () => d.close()); return d;
  }
  const pageName = () => (document.title || '').replace(/ · Campagna D&D.*$/, '');

  /* ---------- account dei giocatori (amministratore) ----------
     Le password stanno nei dati del DM (meta «giocatori»), mai nelle copie dei giocatori. Una password nuova è una
     modifica come le altre: vale dopo che Claude l'ha pubblicata, e da lì chi la usava prima deve rientrare. */
  function accountsDlg() {
    const cur = () => (MEM.meta?.get('giocatori')?.v || []);
    const d = dlg('accdlg', `<h3 style="${H3}">Account dei giocatori</h3>
      <p class="sd" style="margin:0 0 8px">Ogni giocatore entra toccando il suo ritratto e scrivendo la sua password. Vede solo le schede e le parti in cui il suo nome è spuntato in «Mostra a:».</p>
      <div id="acc-l"></div><p class="sd" id="acc-m" style="min-height:1.2em;margin:8px 0 0;font-size:.92rem"></p>
      <div style="display:flex;justify-content:flex-end;margin-top:10px"><button class="btn" data-a="close">Chiudi</button></div>`);
    const draw = () => {
      const G = cur();
      d.querySelector('#acc-l').innerHTML = G.length ? G.map((g, i) => `<div class="bugi" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b style="color:#561820;min-width:70px">${esc(g.name)}</b><code style="flex:1;font-size:1.05rem;letter-spacing:.06em">${esc(g.code)}</code><button class="btn sm" data-c="${i}">Copia</button><button class="btn sm" data-n="${i}">Nuova password</button></div>`).join('')
        : '<p class="sd">Gli account non sono ancora stati creati: chiedilo a Claude.</p>';
      d.querySelectorAll('[data-c]').forEach(b => b.onclick = async () => { try { await navigator.clipboard.writeText(cur()[+b.dataset.c].code); d.querySelector('#acc-m').textContent = 'Password copiata.'; } catch { } });
      d.querySelectorAll('[data-n]').forEach(b => b.onclick = async () => {
        const G2 = clone(cur()), g = G2[+b.dataset.n]; if (!confirm('Dare a ' + g.name + ' una password nuova? Quella vecchia smette di funzionare quando la modifica viene pubblicata.')) return;
        const abc = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789', r = crypto.getRandomValues(new Uint8Array(8));
        g.code = Array.from(r, x => abc[x % abc.length]).join('');
        await col('meta').doc('giocatori').set({ k: 'giocatori', v: G2 }); draw();
        d.querySelector('#acc-m').textContent = 'Nuova password per ' + g.name + ': ' + (FONTE && FONTE.pronto ? 'premi «Salva» nel riquadro in basso' : 'inviala a Claude dal riquadro in basso') + ' per renderla valida.';
      });
    };
    draw();
  }

  function reportDlg() {
    const on = document.documentElement.classList.contains('review');
    const d = dlg('segdlg', `<h3 style="${H3}">Segnala a Claude</h3><p class="sd" style="margin:0 0 4px">Cosa vuoi segnalare?</p>
      <button type="button" class="segc" data-a="bug"><span class="si">🐞</span><span><b>Segnala un bug</b><br><span class="sd">Qualcosa non funziona o si vede male. Puoi descrivere più errori insieme e aggiungere una foto per ognuno.</span></span></button>
      <button type="button" class="segc" data-a="rev"><span class="si">✎</span><span><b>Modifica il contenuto</b><br><span class="sd">${on ? 'Sei già in modalità revisione: tocca qui per uscire.' : 'Entri in modalità revisione: leggi il sito e correggi i testi dove li trovi. Alla fine invii tutte le correzioni con un tasto.'}</span></span></button>
      <div style="display:flex;align-items:center;gap:10px;margin-top:14px"><button type="button" class="seglink" data-a="ask">Altra richiesta a Claude</button><button type="button" class="btn ghost" style="margin-left:auto" data-a="close">Chiudi</button></div>`);
    d.querySelector('[data-a=bug]').onclick = () => { d.close(); bugDlg(); };
    d.querySelector('[data-a=rev]').onclick = () => { d.close(); setReview(!on); if (!on) notice('Modalità revisione: tocca un testo per correggerlo o per lasciare una nota a Claude.'); };
    d.querySelector('[data-a=ask]').onclick = () => { d.close(); askClaude(); };
  }

  // foto ridotte (lato lungo 1600 px) per non appesantire la richiesta
  async function shrink(file) {
    try {
      const bm = await createImageBitmap(file), k = Math.min(1, 1600 / Math.max(bm.width, bm.height));
      const c = document.createElement('canvas'); c.width = Math.round(bm.width * k); c.height = Math.round(bm.height * k); c.getContext('2d').drawImage(bm, 0, 0, c.width, c.height); bm.close();
      const b = await new Promise(r => c.toBlob(r, 'image/jpeg', .82)); c.width = c.height = 0; return b || file;
    } catch { return file; }
  }
  function bugDlg() {
    const items = [{ text: '', photos: [] }];
    const d = dlg('bugdlg', `<h3 style="${H3}">Segnala un bug</h3><p class="sd" style="margin:0">Descrivi cosa succede. Il sito aggiunge da solo la pagina in cui ti trovi e il dispositivo che usi.</p>
      <div class="bl" style="overflow:auto;max-height:55vh"></div><button type="button" class="btn" data-a="add" style="margin-top:10px">+ Aggiungi un altro errore</button>
      <div style="display:flex;gap:8px;margin-top:14px"><button type="button" class="btn primary" data-a="send"></button><button type="button" class="btn ghost" style="margin-left:auto" data-a="close">Chiudi</button></div><p class="m" style="min-height:1.2em;color:#a3262f;margin:8px 0 0"></p>`);
    d.addEventListener('close', () => items.forEach(it => it.photos.forEach(p => URL.revokeObjectURL(p.url))));
    const list = d.querySelector('.bl'), go = d.querySelector('[data-a=send]');
    const used = () => items.filter(it => it.text.trim() || it.photos.length);
    const label = () => { const n = used().length; go.textContent = n > 1 ? 'Aggiungi ' + n + ' errori' : 'Aggiungi l\'errore'; };
    const draw = () => {
      list.innerHTML = '';
      items.forEach((it, i) => {
        const w = document.createElement('div'); w.className = 'bugi';
        w.innerHTML = `<div class="bh"><b>Errore ${i + 1}</b>${items.length > 1 ? '<button type="button" class="segx" data-x>✕ Togli</button>' : ''}</div><textarea class="segta" rows="3" placeholder="Es.: sul telefono, nella mappa, il riquadro della regione copre il pulsante per chiuderlo."></textarea><div class="ph"></div>`;
        const ta = w.querySelector('textarea'); ta.value = it.text; ta.oninput = () => { it.text = ta.value; label(); };
        const x = w.querySelector('[data-x]'); if (x) x.onclick = () => { it.photos.forEach(p => URL.revokeObjectURL(p.url)); items.splice(i, 1); draw(); };
        const ph = w.querySelector('.ph');
        it.photos.forEach((p, j) => { const s = document.createElement('span'); s.style.cssText = 'display:inline-flex;align-items:center;gap:4px'; s.innerHTML = `<img alt="Foto ${j + 1}" src="${p.url}"><button type="button" class="segx" title="Togli la foto">✕</button>`; s.querySelector('button').onclick = () => { URL.revokeObjectURL(p.url); it.photos.splice(j, 1); draw(); }; ph.append(s); });
        const lb = document.createElement('label'); lb.className = 'btn sm'; lb.style.cursor = 'pointer'; lb.innerHTML = '📷 ' + (it.photos.length ? 'Un\'altra foto' : 'Aggiungi foto') + '<input type="file" accept="image/*" hidden>';
        lb.querySelector('input').onchange = async e => { const f = e.target.files[0]; if (!f) return; const blob = await shrink(f); it.photos.push({ blob, url: URL.createObjectURL(blob) }); draw(); };
        ph.append(lb); list.append(w);
      });
      label();
    };
    d.querySelector('[data-a=add]').onclick = () => { items.push({ text: '', photos: [] }); draw(); list.lastElementChild?.querySelector('textarea')?.focus(); };
    go.onclick = async () => {
      const ok = used(); if (!ok.length) { d.querySelector('.m').textContent = 'Descrivi almeno un errore.'; return; }
      go.disabled = true;
      try {
        const device = navigator.userAgent + ' · finestra ' + innerWidth + '×' + innerHeight;
        for (const it of ok) {
          const ids = [];
          for (const p of it.photos) { const id = 'B' + newId(); const t = DB.transaction('files', 'readwrite'); t.objectStore('files').put({ blob: p.blob, type: p.blob.type || 'image/jpeg' }, id); await done(t); ids.push(id); }
          BUGS.push({ text: it.text.trim(), photos: ids, page: pageName(), hash: location.hash, device, at: new Date().toISOString() });
        }
        saveState(); d.close();
        notice((ok.length > 1 ? 'Errori aggiunti' : 'Errore aggiunto') + ': premi «Invia a Claude» nel riquadro in basso per mandarli.');
      } catch { go.disabled = false; d.querySelector('.m').textContent = 'Non sono riuscito a salvare la segnalazione: riprova.'; }
    };
    draw(); list.querySelector('textarea').focus();
  }

  /* ---------- Segnala un bug / Proponi una miglioria (giocatori) ----------
     Come «Segnala a Claude», ma non si applica da sola: arriva al DM e a Claude, che la valutano prima di fare qualcosa.
     Il testo e le foto viaggiano cifrati con la chiave del giocatore (solo il DM, che conosce le password, li apre). */
  const PKIND = { bug: ['🐞', 'Segnala un bug', 'Descrivi cosa non funziona o si vede male. Il sito aggiunge da solo la pagina in cui ti trovi e il dispositivo che usi.', 'Es.: sul telefono il menu delle sessioni copre il titolo.', 'segnala un bug'], idea: ['💡', 'Proponi una miglioria', 'Descrivi la tua idea per migliorare il sito.', 'Es.: sarebbe comodo vedere nella scheda del mio PG gli oggetti che porto.', 'propone una miglioria'] };
  async function playerRequest(kind, text, photos) {
    const ph = {};
    for (const [i, p] of photos.entries()) ph['F' + (i + 1)] = { type: p.blob.type || 'image/jpeg', b64: b64e(new Uint8Array(await p.blob.arrayBuffer())) };
    let bytes = new TextEncoder().encode(JSON.stringify({ v: 1, kind, player: PLAYER, text, page: pageName(), hash: location.hash, device: navigator.userAgent + ' · finestra ' + innerWidth + '×' + innerHeight, at: new Date().toISOString(), photos: ph }));
    if ('CompressionStream' in window) bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(PRAW), bytes));
    const all = new Uint8Array(12 + ct.length); all.set(iv); all.set(ct, 12);
    const block = 'AVALAR-GIOCATORE-1 ' + PLAYER.id + '\n' + b64e(all).replace(/.{76}/g, '$&\n').trim() + '\nFINE';
    const title = '[Giocatore] ' + PLAYER.name + ' ' + PKIND[kind][4];
    const intro = PLAYER.name + ' ' + PKIND[kind][4] + ' dal sito. Il testo è cifrato: lo leggono solo il DM e Claude.\n\n'
      + 'Per Claude: NON applicarla da solo. Leggila con `python3 strumenti/leggi_segnalazione.py CODICE file.txt`, valutala e proponi al DM cosa fare: si procede solo dopo il suo ok.\n\n';
    if (PTOKEN) try { return { done: await apiIssue(title, intro, block) }; } catch { /* se GitHub rifiuta la chiave si passa al link qui sotto */ }
    const url = b => ASK_REPO + '/issues/new?title=' + encodeURIComponent(title) + '&body=' + encodeURIComponent(b);
    const inl = url(intro + '```\n' + block + '\n```\n');
    if (inl.length < 7000) return { url: inl };
    return { url: url(intro + '**Il testo e le foto sono nel file «segnalazione-avalar.txt» che il sito ha appena scaricato: allegalo qui sotto (trascinalo in questo riquadro o tocca «Paste, drop, or click to add files») prima di premere «Create».**\n'), file: new Blob([block + '\n'], { type: 'text/plain' }) };
  }
  /* con la chiave GitHub del DM (nei dati cifrati dei giocatori) la segnalazione si apre direttamente, senza account:
     se è troppo lunga per una segnalazione, il blocco continua nei commenti («Parte 2 di 3», …) */
  async function apiIssue(title, intro, block) {
    const api = (path, body) => fetch(ASK_REPO.replace('https://github.com/', 'https://api.github.com/repos/') + path, { method: 'POST', headers: { Authorization: 'Bearer ' + PTOKEN, Accept: 'application/vnd.github+json' }, body: JSON.stringify(body) })
      .then(r => { if (!r.ok) throw new Error('GitHub ' + r.status); return r.json(); });
    const parts = [[]];
    for (const l of block.split('\n')) { if (parts[parts.length - 1].join('\n').length > 60000) parts.push([]); parts[parts.length - 1].push(l); }
    const n = parts.length, fence = (p, i) => (n > 1 ? 'Parte ' + (i + 1) + ' di ' + n + '\n' : '') + '```\n' + p.join('\n') + '\n```\n';
    const issue = await api('/issues', { title, body: intro + fence(parts[0], 0) });
    for (let i = 1; i < n; i++) await api('/issues/' + issue.number + '/comments', { body: fence(parts[i], i) });
    return issue.number;
  }
  function playerDlg(kind) {
    const [ic, tit, sub, ph] = PKIND[kind], photos = [];
    const d = dlg('pldlg', `<h3 style="${H3}">${ic} ${tit}</h3><p class="sd" style="margin:0">${sub}</p>
      <div class="bugi"><textarea class="segta" rows="5" placeholder="${esc(ph)}"></textarea><div class="ph"></div></div>
      <p class="sd" style="margin:10px 0 0;font-size:.92rem">Arriva al DM e a Claude, che la valutano prima di cambiare qualcosa. ${PTOKEN ? 'Basta premere «Invia».' : 'Premendo «Invia» si apre GitHub (serve un account, anche gratuito): lì premi «Create».'}</p>
      <div style="display:flex;gap:8px;margin-top:12px"><button type="button" class="btn primary" data-a="send">Invia</button><button type="button" class="btn ghost" style="margin-left:auto" data-a="close">Chiudi</button></div><p class="m" style="min-height:1.2em;color:#a3262f;margin:8px 0 0"></p>`);
    d.addEventListener('close', () => photos.forEach(p => URL.revokeObjectURL(p.url)));
    const ta = d.querySelector('textarea'), box = d.querySelector('.ph'), go = d.querySelector('[data-a=send]'), m = d.querySelector('.m');
    const draw = () => {
      box.innerHTML = '';
      photos.forEach((p, j) => { const s = document.createElement('span'); s.style.cssText = 'display:inline-flex;align-items:center;gap:4px'; s.innerHTML = `<img alt="Foto ${j + 1}" src="${p.url}"><button type="button" class="segx" title="Togli la foto">✕</button>`; s.querySelector('button').onclick = () => { URL.revokeObjectURL(p.url); photos.splice(j, 1); draw(); }; box.append(s); });
      const lb = document.createElement('label'); lb.className = 'btn sm'; lb.style.cursor = 'pointer'; lb.innerHTML = '📷 ' + (photos.length ? 'Un\'altra immagine' : 'Aggiungi un\'immagine (facoltativa)') + '<input type="file" accept="image/*" hidden>';
      lb.querySelector('input').onchange = async e => { const f = e.target.files[0]; if (!f) return; const blob = await shrink(f); photos.push({ blob, url: URL.createObjectURL(blob) }); draw(); };
      box.append(lb);
    };
    let sent = null;
    go.onclick = async () => {
      if (sent) { window.open(sent.url, '_blank', 'noopener'); return; }
      const text = ta.value.trim(); if (!text) { m.textContent = 'Scrivi prima cosa vuoi segnalare.'; ta.focus(); return; }
      go.disabled = true; m.textContent = '';
      try {
        sent = await playerRequest(kind, text, photos);
        if (sent.done) {
          ta.disabled = true; box.querySelectorAll('button,input').forEach(x => x.disabled = true); go.remove();
          m.style.color = '#3f6b46'; m.textContent = 'Inviata al DM. Grazie!'; return;
        }
        if (sent.file) { const u = URL.createObjectURL(sent.file), a = document.createElement('a'); a.href = u; a.download = 'segnalazione-avalar.txt'; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 60000); }
        window.open(sent.url, '_blank', 'noopener');
        ta.disabled = true; box.querySelectorAll('button,input').forEach(x => x.disabled = true); go.textContent = 'Riapri GitHub';
        m.style.color = '#3f6b46'; m.textContent = sent.file ? 'Su GitHub allega il file «segnalazione-avalar.txt» e premi «Create». Grazie!' : 'Su GitHub premi «Create» per inviarla. Grazie!';
      } catch { m.textContent = 'Non sono riuscito a preparare la segnalazione: riprova.'; }
      go.disabled = false;
    };
    draw(); ta.focus();
  }

  /* modalità revisione: ogni testo mostrato viene cercato tra i dati (tutte le raccolte, tutti i campi di testo)
     e corretto direttamente nel campo da cui viene; ciò che il sito genera da solo si segnala con una nota */
  let IDX = null;
  function setReview(on) {
    segCss(); document.documentElement.classList.toggle('review', on);
    if (on) ls.set('cdnd_review', '1'); else ls.del('cdnd_review');
    let bar = document.getElementById('revbar');
    if (!on) { if (bar) bar.remove(); document.querySelectorAll('.revbox').forEach(closeBox); return; }
    if (!bar) {
      bar = document.createElement('div'); bar.id = 'revbar'; bar.setAttribute('role', 'status');
      bar.innerHTML = '<b>✎ Modalità revisione</b><span><span class="rh">Tocca un testo per correggerlo o per lasciare una nota a Claude.</span></span><button type="button">Esci</button>';
      bar.querySelector('button').onclick = () => setReview(false); document.body.append(bar);
    }
  }
  const SKIPK = new Set(['id', 'aid', 'k', 'type', 'color', 'thumb', 'from', 'to', 'mapId', 'entityId', 'parent', 'arc', 'ents', 'sessions', 'upd', 'ts', 'points', 'cat', 'imp', 'shape']);
  const nl = s => String(s).replace(/\*/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const rline = s => s.replace(/\[\/?DM\]/g, '').replace(/^#{1,4}\s+/, '').replace(/^\s*[-*•]\s+/, '').replace(/\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g, (m, a, b) => b || (MEM.entities && MEM.entities.get(a) && MEM.entities.get(a).name) || a);
  function strings(v, path, cb) {
    if (typeof v === 'string') { if (!v.startsWith('data:') && /\p{L}/u.test(v)) cb(path, v); }
    else if (Array.isArray(v)) v.forEach((x, i) => strings(x, path.concat(i), cb));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (!SKIPK.has(k)) strings(x, path.concat(k), cb);
  }
  function buildIdx() {
    const m = new Map();
    for (const [c, docs] of Object.entries(MEM)) for (const [id, v] of docs) strings(v, [], (path, s) => s.split('\n').forEach((l, i) => { const k = nl(rline(l)); if (k) { if (!m.has(k)) m.set(k, []); m.get(k).push({ c, id, path, i }); } }));
    return m;
  }
  const getAt = (v, path) => path.reduce((o, k) => o == null ? o : o[k], v);
  // le righe di testo mostrate da un elemento: quelle intere, oppure solo il suo testo diretto (es. titoli con un numero davanti)
  function findHits(el) {
    IDX = IDX || buildIdx();
    const tries = [el.innerText.split('\n').map(nl).filter(Boolean), [nl([...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(' '))].filter(Boolean)];
    for (const L of tries) {
      if (!L.length) continue; const out = new Map();
      for (const h of IDX.get(L[0]) || []) {
        const lines = getAt(MEM[h.c].get(h.id), h.path).split('\n'); let j = h.i, ok = true;
        for (let q = 1; q < L.length && ok; q++) { do j++; while (j < lines.length && !nl(rline(lines[j]))); ok = j < lines.length && nl(rline(lines[j])) === L[q]; }
        if (ok) out.set(h.c + '|' + h.id + '|' + h.path.join('.') + '|' + h.i, { c: h.c, id: h.id, path: h.path, a: h.i, b: j });
      }
      if (out.size) return [...out.values()];
    }
    return [];
  }
  function routePref(list) {
    const h = decodeURIComponent(location.hash), val = x => MEM[x.c].get(x.id) || {}; let m, f = null;
    if ((m = h.match(/^#\/sessioni\/(\d+)/))) f = x => ['sessions', 'sbodies', 'events'].includes(x.c) && String(val(x).n) === m[1];
    else if ((m = h.match(/^#\/scheda\/([^/?]+)/))) f = x => ['entities', 'bodies'].includes(x.c) && val(x).id === m[1];
    else if ((m = h.match(/^#\/mappe\/([^/?]+)/))) f = x => (x.c === 'maps' && val(x).id === m[1]) || val(x).mapId === m[1];
    const p = f ? list.filter(f) : []; return p.length ? p : list;
  }
  const FIELD = { summary: 'riassunto', text: 'testo', title: 'titolo', name: 'nome', brief: 'descrizione breve', short: 'titolo breve', alias: 'altri nomi', label: 'etichetta', desc: 'descrizione', description: 'descrizione', gameDate: 'data', status: 'stato', notes: 'note' };
  function recLabel(c, v) {
    v = v || {}; const ent = id => (MEM.entities && [...MEM.entities.values()].find(e => e.id === id) || {}).name || id;
    if (c === 'entities') return 'Scheda · ' + (v.name || v.id); if (c === 'bodies') return 'Scheda · ' + ent(v.id);
    if (c === 'sessions' || c === 'sbodies') { const s = MEM.sessions && [...MEM.sessions.values()].find(x => x.n === v.n); return 'Sessione ' + v.n + (s && s.title ? ' · ' + s.title : ''); }
    if (c === 'events') return 'Evento · ' + (v.title || ''); if (c === 'maps') return 'Mappa · ' + (v.name || '');
    if (c === 'pins') return 'Segnalino · ' + (v.label || v.name || ''); if (c === 'regions') return 'Regione · ' + (v.name || v.label || '');
    if (c === 'links') return 'Collegamento'; if (c === 'blobs') return 'Immagine'; if (c === 'meta') return 'Impostazioni';
    return c;
  }
  function pathLabel(v, path) {
    const out = []; let o = v;
    path.forEach((k, i) => {
      const nx = o == null ? o : o[k];
      if (k === 'sections' || k === 'entries' || k === 'docs') { } else if (typeof k === 'number') { const t = nx && (nx.title || nx.name); if (t && path[i - 1] !== 'entries') out.push('«' + t + '»'); }
      else out.push(FIELD[k] || k);
      o = nx;
    });
    return out.join(' › ');
  }
  function closeBox(b) { if (b.__host) b.__host.style.display = b.__disp; b.remove(); }
  const BLK = 'p,li,h1,h2,h3,h4,h5,dd,dt,td,th,figcaption,blockquote';
  document.addEventListener('click', e => {
    if (ROLE !== 'admin' || !document.documentElement.classList.contains('review')) return;
    const view = document.getElementById('view'), t = e.target;
    if (!view || !(t instanceof Element) || !view.contains(t) || t.closest('.revbox,button,input,textarea,select,summary,label,[data-act],dialog')) return;
    const a = t.closest('a'); if (a && !(a.classList.contains('xref') && a.closest('.prose'))) return;
    let el = t.closest(BLK) || t, hits = [];
    for (let up = 0; el && el !== view && up < 7; up++, el = el.parentElement) { if ((el.innerText || '').trim()) { hits = findHits(el); if (hits.length) break; } }
    if (!el || el === view) el = t.closest(BLK) || t;
    e.preventDefault(); e.stopPropagation();
    openRev(el, routePref(hits));
  }, true);
  function openRev(host, hits) {
    document.querySelectorAll('.revbox').forEach(closeBox);
    const box = document.createElement(host.tagName === 'LI' ? 'li' : 'div'); box.className = 'revbox'; box.__host = host; box.__disp = host.style.display;
    host.style.display = 'none'; host.after(box); box.scrollIntoView({ block: 'nearest' });
    const quote = host.innerText.trim().slice(0, 300);
    const noteUI = (where, intro) => {
      box.innerHTML = `<div class="rl">${esc(intro)}</div><textarea class="segta" rows="3" placeholder="Cosa va cambiato? Claude leggerà la nota insieme a questo testo."></textarea><div class="rb"><button type="button" class="btn primary sm">Aggiungi la nota</button><button type="button" class="btn ghost sm">Annulla</button></div>`;
      const ta = box.querySelector('textarea'); ta.focus();
      const [ok, no] = box.querySelectorAll('button');
      no.onclick = () => closeBox(box);
      ok.onclick = () => { const note = ta.value.trim(); if (!note) { ta.focus(); return; } NOTES.push({ page: pageName(), hash: location.hash, where, quote, note, at: new Date().toISOString() }); saveState(); closeBox(box); notice('Nota aggiunta: la trovi in «Rivedi elenco».'); };
    };
    const edit = h => {
      const v = MEM[h.c].get(h.id), where = recLabel(h.c, v) + (pathLabel(v, h.path) ? ' · ' + pathLabel(v, h.path) : '');
      const lines = getAt(v, h.path).split('\n'), cur = lines.slice(h.a, h.b + 1).join('\n');
      box.innerHTML = `<div class="rl">${esc(where)}</div><textarea class="segta" rows="${Math.min(14, Math.max(2, Math.ceil(cur.length / 60) + (h.b - h.a)))}"></textarea>${/\[\[/.test(cur) ? '<p class="rhint">I collegamenti sono scritti come [[scheda|testo mostrato]]: correggi il testo dopo la barra.</p>' : ''}<div class="rb"><button type="button" class="btn primary sm">Salva correzione</button><button type="button" class="btn sm">💬 Nota per Claude</button><button type="button" class="btn ghost sm">Annulla</button></div>`;
      const ta = box.querySelector('textarea'); ta.value = cur; ta.focus(); if (window.__cronache.dmTool) window.__cronache.dmTool(ta);
      const [sv, nt, no] = box.querySelectorAll('.rb button');
      no.onclick = () => closeBox(box); nt.onclick = () => noteUI(where, where);
      sv.onclick = async () => {
        const nv = ta.value.replace(/\r/g, ''); if (nv === cur) { closeBox(box); return; }
        sv.disabled = true;
        try {
          const rec = clone(v), path = h.path, o = getAt(rec, path.slice(0, -1)), ls2 = o[path[path.length - 1]].split('\n');
          ls2.splice(h.a, h.b - h.a + 1, ...nv.split('\n')); o[path[path.length - 1]] = ls2.join('\n');
          await window.__cronache.runBatch([h.c], 'Revisione', b => b.put(h.c, rec));
          closeBox(box); await window.__cronache.rerender();
          notice('Correzione fatta. Quando hai finito di rivedere premi «' + (FONTE && FONTE.pronto ? 'Salva' : 'Invia a Claude') + '» nel riquadro in basso.');
        } catch (x) { sv.disabled = false; notice('Non sono riuscito a salvare: ' + (x && x.message || 'riprova.')); }
      };
    };
    if (!hits.length) return noteUI(pageName() + ' (' + location.hash + ')', 'Questo testo lo compone il sito da solo, quindi non si corregge qui: lascia una nota a Claude.');
    if (hits.length === 1) return edit(hits[0]);
    box.innerHTML = '<div class="rl">Questo testo compare in più punti: quale vuoi correggere?</div>';
    hits.slice(0, 12).forEach(h => { const v = MEM[h.c].get(h.id), b = document.createElement('button'); b.type = 'button'; b.className = 'btn sm rc'; b.textContent = recLabel(h.c, v) + (pathLabel(v, h.path) ? ' · ' + pathLabel(v, h.path) : ''); b.onclick = () => edit(h); box.append(b); });
    const no = document.createElement('button'); no.type = 'button'; no.className = 'btn ghost sm rc'; no.textContent = 'Annulla'; no.onclick = () => closeBox(box); box.append(no);
  }

  // differenze parola per parola, con poche parole di contesto attorno
  function wdiff(a, b) {
    const A = a.split(/(\s+)/), B = b.split(/(\s+)/); let p = 0, s = 0;
    while (p < A.length && p < B.length && A[p] === B[p]) p++;
    while (s < A.length - p && s < B.length - p && A[A.length - 1 - s] === B[B.length - 1 - s]) s++;
    const a2 = A.slice(p, A.length - s), b2 = B.slice(p, B.length - s), ops = [];
    if (a2.length * b2.length > 1e6) { ops.push(['-', a2.join('')], ['+', b2.join('')]); }
    else {
      const L = Array.from({ length: a2.length + 1 }, () => new Uint32Array(b2.length + 1));
      for (let i = a2.length - 1; i >= 0; i--) for (let j = b2.length - 1; j >= 0; j--) L[i][j] = a2[i] === b2[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
      let i = 0, j = 0;
      while (i < a2.length || j < b2.length) {
        if (i < a2.length && j < b2.length && a2[i] === b2[j]) { ops.push(['=', a2[i]]); i++; j++; }
        else if (j < b2.length && (i >= a2.length || L[i][j + 1] >= L[i + 1][j])) { ops.push(['+', b2[j]]); j++; }
        else { ops.push(['-', a2[i]]); i++; }
      }
    }
    const ctx = (t, end) => { if (t.length <= 8) return esc(t.join('')); return end ? '…' + esc(t.slice(-8).join('')) : esc(t.slice(0, 8).join('')) + '…'; };
    let h = ctx(A.slice(0, p), true), run = [];
    const flushEq = last => { if (run.length > 16 && !last) h += esc(run.slice(0, 8).join('')) + ' … ' + esc(run.slice(-8).join('')); else h += esc(run.join('')); run = []; };
    let del = '', ins = '';
    const flushCh = () => { if (del) h += '<del>' + esc(del) + '</del>'; if (ins) h += '<ins>' + esc(ins) + '</ins>'; del = ins = ''; };
    for (const [o, t] of ops) { if (o === '=') { flushCh(); run.push(t); continue; } flushEq(); if (o === '-') del += t; else ins += t; }
    flushCh(); flushEq(); return h + ctx(A.slice(A.length - s), false);
  }
  const KEYF = { meta: 'k', entities: 'id', bodies: 'id', sessions: 'n', sbodies: 'n', events: 'id', maps: 'id', blobs: 'id', pins: 'id', links: 'k', regions: 'id' };
  async function reviewList() {
    const d = dlg('revlist', `<h3 style="${H3}">${salvaQui() ? 'Da salvare' : 'Da inviare a Claude'}</h3><div class="rvl">Carico…</div><div style="display:flex;margin-top:12px"><button type="button" class="btn ghost" style="margin-left:auto" data-a="close">Chiudi</button></div>`);
    const body = d.querySelector('.rvl'); let base = {};
    if (PEND.size) { try { base = (await serverData()).stores; } catch { body.textContent = 'Non riesco a leggere i dati pubblicati per il confronto: controlla la connessione e riprova.'; return; } }
    const draw = () => {
      body.innerHTML = '';
      const item = (title, html, undo) => {
        const w = document.createElement('div'); w.className = 'it';
        w.innerHTML = `<div class="ih"><b>${esc(title)}</b></div>${html}`;
        if (undo) { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn sm'; b.textContent = undo[0]; b.onclick = async () => { b.disabled = true; try { await undo[1](); } catch { b.disabled = false; notice('Non sono riuscito ad annullare: riprova.'); return; } draw(); }; w.querySelector('.ih').append(b); }
        body.append(w);
      };
      for (const k of PEND) {
        const j = k.indexOf('/'), c = k.slice(0, j), id = k.slice(j + 1), cur = MEM[c] && MEM[c].get(id), old = base[c] && base[c][id];
        let html = '';
        if (cur === undefined && old === undefined) continue;
        if (cur === undefined) html = '<div class="df"><i>Eliminato</i></div>';
        else if (old === undefined) html = '<div class="df"><i>Nuovo</i></div>';
        else {
          const so = new Map(), sn = new Map(); strings(old, [], (p, s) => so.set(JSON.stringify(p), s)); strings(cur, [], (p, s) => sn.set(JSON.stringify(p), s));
          for (const [p, s] of sn) { const o = so.get(p) || ''; if (o !== s) html += `<div class="df"><i>${esc(pathLabel(cur, JSON.parse(p)) || 'testo')}</i>${wdiff(o, s)}</div>`; }
          for (const [p, s] of so) if (!sn.has(p)) html += `<div class="df"><i>${esc(pathLabel(old, JSON.parse(p)) || 'testo')}</i><del>${esc(s)}</del></div>`;
          const strip = v => { const x = clone(v); strings(x, [], p => { const o = getAt(x, p.slice(0, -1)); if (o) o[p[p.length - 1]] = ''; }); return JSON.stringify(x); };
          if (strip(cur) !== strip(old)) html += '<div class="df"><i>Altre modifiche (immagini, collegamenti o impostazioni)</i></div>';
          if (!html) html = '<div class="df"><i>Nessuna differenza visibile</i></div>';
        }
        item(recLabel(c, cur || old), html, c === 'blobs' ? null : ['Annulla', async () => {
          await window.__cronache.runBatch([c], 'Annulla', b => old === undefined ? b.del(c, cur[KEYF[c]]) : b.put(c, clone(old)));
          PEND.delete(k); saveState(); await window.__cronache.rerender();
        }]);
      }
      if (PFILES.size) item(PFILES.size + (PFILES.size === 1 ? ' immagine nuova' : ' immagini nuove'), '');
      NOTES.forEach((n, i) => item('Nota · ' + n.where, `<div class="df"><i>Sul testo: «${esc(n.quote.slice(0, 160))}${n.quote.length > 160 ? '…' : ''}»</i>${esc(n.note)}</div>`, ['Togli', async () => { NOTES.splice(i, 1); saveState(); }]));
      BUGS.forEach((g, i) => item('Errore · ' + (g.page || g.hash), `<div class="df">${esc(g.text)}${g.photos.length ? '<i>' + g.photos.length + (g.photos.length === 1 ? ' foto' : ' foto') + '</i>' : ''}</div>`, ['Togli', async () => {
        const t = DB.transaction('files', 'readwrite'); for (const aid of g.photos) t.objectStore('files').delete(aid); await done(t); BUGS.splice(i, 1); saveState();
      }]));
      if (!body.children.length) body.innerHTML = '<p class="sd">Non c\'è più nulla da inviare.</p>';
    };
    draw();
  }

  if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));
})();

/* Campagna D&D — accesso e archiviazione locale.
   - Ospite: legge una copia pubblica (data.json), solo lettura, nulla viene salvato.
   - Amministratore: il codice decifra data.enc (dati completi), tenuti in IndexedDB. Le modifiche fatte sul sito
     restano qui solo finché non vengono inviate a Claude (una richiesta cifrata su GitHub) o scartate:
     i dati veri sono sempre quelli pubblicati. Il codice non viene mai salvato in chiaro. */
(() => {
  'use strict';
  const rq = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const done = t => new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });
  const b64d = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const ls = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { } }, del: k => { try { localStorage.removeItem(k); } catch { } } };
  const domReady = () => document.readyState === 'loading' ? new Promise(r => addEventListener('DOMContentLoaded', r, { once: true })) : Promise.resolve();
  const clone = v => JSON.parse(JSON.stringify(v));
  const ROERR = () => new Error('Sola lettura: accedi come Dungeon Master per modificare.');

  let ROLE = null, DB = null, MEM = {}, BLOBMAP = {}, RAW = null;
  // modifiche non ancora inviate: chiavi 'raccolta/id' dei documenti e id delle immagini caricate
  let PEND = new Set(), PFILES = new Set(), DROPPED = false;
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

  /* ---------- aperture ---------- */
  async function guestOpen() {
    const r = await fetch('data.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error('Impossibile caricare i dati (' + r.status + ').');
    const d = await r.json(); MEM = {};
    for (const [c, docs] of Object.entries(d.stores)) MEM[c] = new Map(Object.entries(docs));
    BLOBMAP = d.blobmap || {}; ROLE = 'guest';
  }
  async function seedAdmin(payload, raw) {
    const t = DB.transaction(['docs', 'kv'], 'readwrite'); const d = t.objectStore('docs'); d.clear();
    for (const [c, docs] of Object.entries(payload.stores)) for (const [id, v] of Object.entries(docs)) d.put(v, c + '/' + id);
    t.objectStore('kv').put(payload.dataVersion, 'dataVersion'); t.objectStore('kv').put(payload.blobmap, 'blobmap'); t.objectStore('kv').put(false, 'dirty'); t.objectStore('kv').put([], 'pending'); t.objectStore('kv').put([], 'pfiles');
    await done(t);
    // immagini riservate (cifrate): le decifro e le tengo nel browser
    const key = await aesKey(raw); const types = {};
    for (const b of Object.values(payload.stores.blobs || {})) types[b.aid] = b.type;
    for (const [aid, path] of Object.entries(payload.blobmap)) {
      if (!path.startsWith('priv/')) continue;
      try {
        const buf = new Uint8Array(await (await fetch(path)).arrayBuffer());
        const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, key, buf.slice(12));
        const t2 = DB.transaction('files', 'readwrite'); t2.objectStore('files').put({ blob: new Blob([plain], { type: types[aid] || 'image/jpeg' }), type: types[aid] }, aid); await done(t2);
      } catch { }
    }
  }
  async function adminOpen(code, remember) {
    DB = await idbOpen();
    let enc = null; try { const r = await fetch('data.enc', { cache: 'no-cache' }); if (r.ok) enc = await r.json(); } catch { }
    const have = (await rq(store('docs').count())) > 0;
    let raw;
    if (code != null) { if (!enc) throw new Error('Per il primo accesso serve internet.'); raw = await deriveRaw(code, b64d(enc.salt), enc.it); }
    else { raw = await kvGet('key'); if (!raw) throw new Error('nokey'); }
    let payload = null;
    if (enc) {
      try { payload = JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(enc.iv) }, await aesKey(raw), b64d(enc.ct)))); }
      catch { throw new Error(code != null ? 'Codice non corretto.' : 'nokey'); }
    } else if (!have) throw new Error('Impossibile aprire i dati: serve internet al primo accesso.');
    RAW = raw;
    if (payload && !have) await seedAdmin(payload, raw);
    else if (payload) {
      // i dati pubblicati comandano: se sono cambiati li riprendo, rimettendo sopra solo le modifiche ancora da inviare
      const pend = (await kvGet('pending')) || [], pfiles = (await kvGet('pfiles')) || [], dirty = await kvGet('dirty');
      if (dirty && !pend.length && !pfiles.length) { await seedAdmin(payload, raw); DROPPED = true; } // modifiche vecchie, mai inviate
      else if (payload.dataVersion !== await kvGet('dataVersion')) {
        const keep = await Promise.all(pend.map(async k => [k, await rq(store('docs').get(k))]));
        await seedAdmin(payload, raw);
        const t = DB.transaction(['docs', 'kv'], 'readwrite');
        for (const [k, v] of keep) v === undefined ? t.objectStore('docs').delete(k) : t.objectStore('docs').put(v, k);
        t.objectStore('kv').put(pend, 'pending'); t.objectStore('kv').put(pfiles, 'pfiles'); t.objectStore('kv').put(pend.length + pfiles.length > 0, 'dirty');
        await done(t);
      }
    }
    PEND = new Set((await kvGet('pending')) || []); PFILES = new Set((await kvGet('pfiles')) || []);
    if (remember) { await kvSet('key', raw); ls.set('cdnd_remember', 'admin'); }
    const ks = await rq(store('docs').getAllKeys()), vs = await rq(store('docs').getAll()); MEM = {};
    ks.forEach((k, i) => { const j = k.indexOf('/'); const c = k.slice(0, j); (MEM[c] = MEM[c] || new Map()).set(k.slice(j + 1), vs[i]); });
    BLOBMAP = (await kvGet('blobmap')) || {}; ROLE = 'admin'; window.__online = true;
  }

  /* ---------- schermata di accesso ---------- */
  const LOGIN_CSS = `#login{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;background:radial-gradient(ellipse at 50% 20%,#7d2530 0%,#561820 55%,#2d0d12 100%);color:#f5e6c4;font-family:'Crimson Pro',Georgia,serif}
#login .box{width:min(420px,100%);background:#fbf5e3;color:#2b1d14;border:1px solid #d4b06a;border-radius:12px;padding:28px 26px;box-shadow:0 12px 40px #0008}
#login h1{margin:0 0 2px;font-family:'Cinzel',Georgia,serif;font-size:1.35rem;letter-spacing:.06em;color:#561820;text-align:center}
#login .sub{text-align:center;color:#8a7560;margin:0 0 20px}
#login button,#login input[type=password]{font:inherit;width:100%;box-sizing:border-box;border-radius:8px;padding:11px 14px}
#login .btn{cursor:pointer;border:1px solid #a98334;background:#f3e8cc;color:#561820;font-family:'Cinzel',Georgia,serif;letter-spacing:.05em;font-size:.9rem}
#login .btn.p{background:#7d2530;color:#fbf5e3;border-color:#561820}
#login .btn:disabled{opacity:.6;cursor:wait}
#login input[type=password]{border:1px solid #c4ae80;background:#fffdf4;margin-bottom:8px}
#login .or{display:flex;align-items:center;gap:10px;color:#8a7560;margin:16px 0;font-size:.9rem}#login .or:before,#login .or:after{content:"";flex:1;border-top:1px solid #dccaa0}
#login label{display:flex;align-items:center;gap:8px;font-size:.95rem;color:#5a4636;margin:2px 0 10px}
#login .err{color:#a3262f;min-height:1.2em;margin:6px 0 0;font-size:.95rem}
#login small{display:block;color:#8a7560;margin-top:6px}`;
  function loginUI(msg) {
    return new Promise(resolve => {
      const st = document.createElement('style'); st.textContent = LOGIN_CSS; document.head.append(st);
      const el = document.createElement('div'); el.id = 'login';
      el.innerHTML = `<div class="box"><h1>CAMPAGNA D&amp;D</h1><p class="sub">Diario di campagna di Avalar</p>
        <button class="btn p" id="lg-guest">Entra come Giocatore</button><small style="text-align:center">Sola lettura, nessuna modifica possibile.</small>
        <div class="or">oppure</div>
        <form id="lg-form" autocomplete="off"><input type="password" id="lg-code" placeholder="Codice del Dungeon Master" autocomplete="current-password" spellcheck="false">
        <label><input type="checkbox" id="lg-rem" checked> Ricordami su questo dispositivo</label>
        <button class="btn" id="lg-adm" type="submit">Entra come Dungeon Master</button></form>
        <p class="err" id="lg-err">${msg || ''}</p></div>`;
      document.body.append(el);
      const err = t => { el.querySelector('#lg-err').textContent = t || ''; };
      const finish = () => { el.remove(); st.remove(); resolve(); };
      el.querySelector('#lg-guest').onclick = async e => {
        e.target.disabled = true; err('');
        try { await guestOpen(); ls.set('cdnd_remember', 'guest'); finish(); } catch (x) { e.target.disabled = false; err(x.message || String(x)); }
      };
      el.querySelector('#lg-form').onsubmit = async e => {
        e.preventDefault(); const code = el.querySelector('#lg-code').value; if (!code) { err('Inserisci il codice.'); return; }
        const b = el.querySelector('#lg-adm'); b.disabled = true; b.textContent = 'Verifico…'; err('');
        try { await adminOpen(code, el.querySelector('#lg-rem').checked); finish(); }
        catch (x) { b.disabled = false; b.textContent = 'Entra come Dungeon Master'; err(x.message === 'nokey' ? 'Accesso non riuscito.' : (x.message || String(x))); }
      };
      el.querySelector('#lg-code').focus();
    });
  }

  const ready = (async () => {
    await domReady();
    const rem = ls.get('cdnd_remember');
    if (rem === 'guest') { try { await guestOpen(); } catch { await loginUI(); } }
    else if (rem === 'admin') {
      try { await adminOpen(null, true); }
      catch (x) { ls.del('cdnd_remember'); await loginUI(x.message === 'nokey' ? 'Accedi di nuovo con il codice.' : ''); }
    } else await loginUI();
    applyRoleUI();
    if (ROLE === 'admin') { outbox(); if (DROPPED) setTimeout(() => notice('Ho tolto da questo browser le modifiche vecchie mai inviate: ora vedi i dati pubblicati.'), 800); }
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
    const t = DB.transaction('kv', 'readwrite'); const o = t.objectStore('kv');
    o.put([...PEND], 'pending'); o.put([...PFILES], 'pfiles'); o.put(PEND.size + PFILES.size > 0, 'dirty');
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
    const p = BLOBMAP[aid]; if (!p || p.startsWith('priv/')) return { ok: false, status: 404 };
    return fetch(p);
  };
  window.__blobHref = aid => { const p = BLOBMAP[aid]; return p && !p.startsWith('priv/') ? p : ''; };

  /* ---------- interfaccia per ruolo ---------- */
  const HIDE_ACTS = ['selmode', 'selall', 'selnone', 'selmove', 'edit', 'up', 'rensess', 'reimg', 'delRel', 'del', 'copyctx', 'wipe', 'vedit', 'vdm', 'vpl', 'undo', 'toggleDisc', 'subup', 'rename', 'renSec', 'redraw', 'portrait', 'newsess', 'newent', 'merge', 'histgen', 'editreg', 'editpin', 'editmap', 'editgen', 'editEntry', 'drawundo', 'drawok', 'drawcancel', 'delreg', 'delpin', 'delphoto', 'delmap', 'delSec', 'delEntry', 'delDoc', 'cpDoc', 'copyEnt', 'bkFull', 'bkData', 'attach', 'analyze', 'addreg', 'addpin', 'addphotos', 'addSec', 'addRel', 'addEntry', 'demo'];
  const GUEST_CSS = HIDE_ACTS.map(a => `html.ro [data-act="${a}"]`).join(',') + `,html.ro a[href="#/import"],html.ro a[href="#/backup"],html.ro #b-edit,html.ro #b-add,html.ro #b-addreg,html.ro #seg,html.ro #access,html.ro input[type=file],html.ro label:has(input[type=file]){display:none!important}`;
  // strumenti: un piccolo pannello nell'angolo in basso a sinistra, così in alto restano solo le sezioni
  const ROLE_CSS = `#tools{position:fixed;left:max(14px,env(safe-area-inset-left,0px));bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:45;display:flex;flex-direction:column-reverse;align-items:flex-start;gap:7px;font:600 .7rem/1 Georgia,serif}
#tools .tlist{display:none;flex-direction:column;align-items:stretch;gap:6px;padding:8px;border-radius:12px;background:var(--wine-d,#561820);border:1px solid #e7cf9a80;box-shadow:0 6px 20px #0007;min-width:210px}
#tools.open .tlist{display:flex}
.tbtn{display:flex;align-items:center;gap:9px;height:36px;padding:0 12px 0 9px;border-radius:18px;border:1px solid #e7cf9a66;background:#00000030;color:#f5e6c4;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;font:inherit;white-space:nowrap;text-align:left}
.tbtn:hover,.tbtn:focus-visible{background:#a7343b;border-color:#e7cf9a;outline:none}
.tbtn:disabled{opacity:.6}
.tbtn .ti{width:18px;text-align:center;font-size:1rem;flex:none}
.tbtn svg{width:16px;height:16px;flex:none;margin:0 1px}
#tools .ttog{height:40px;padding:0 14px 0 11px;border-radius:20px;background:linear-gradient(180deg,var(--wine,#7d2530),var(--wine-d,#561820));border:1px solid #e7cf9a;box-shadow:0 3px 12px #0006}
#tools .ttog .tr{font-size:.6rem;padding:3px 6px;border-radius:9px;border:1px solid #e7cf9a99;color:#f7e3ae;margin-left:2px}
#tools .trole{padding:4px 6px 6px;color:#e7cf9a;font-size:.68rem;letter-spacing:.08em;text-transform:uppercase;border-bottom:1px solid #e7cf9a40;margin-bottom:2px}
#tools #themeBtn{width:auto;height:36px;border-radius:18px;font-size:inherit;padding:0 12px 0 9px}
@media (max-width:1280px){#tools{bottom:calc(74px + env(safe-area-inset-bottom,0px))}}
@media (max-width:620px){#tools .ttog .tl{display:none}#tools .ttog{width:40px;padding:0;justify-content:center}#tools .ttog .tr{display:none}}`;
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
    tog.innerHTML = `<span class="ti" aria-hidden="true">⚙</span><span class="tl">Strumenti</span><span class="tr">${adm ? 'DM' : 'Giocatore'}</span>`;
    tog.title = 'Strumenti · ' + (adm ? 'Dungeon Master' : 'Giocatore');
    const list = document.createElement('div'); list.className = 'tlist';
    const role = document.createElement('div'); role.className = 'trole'; role.textContent = adm ? 'Dungeon Master' : 'Giocatore · sola lettura'; list.append(role);
    const mk = (icon, label, title, fn, id) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'tbtn'; if (id) b.id = id; b.title = title; b.innerHTML = `<span class="ti" aria-hidden="true">${icon}</span><span class="tl">${label}</span>`; b.onclick = fn; list.append(b); return b; };
    const setOpen = o => { box.classList.toggle('open', o); tog.setAttribute('aria-expanded', String(o)); };
    tog.onclick = () => setOpen(!box.classList.contains('open'));
    document.addEventListener('click', e => { if (!box.contains(e.target)) setOpen(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') setOpen(false); });
    const up = mk('⟳', 'Verifica aggiornamento', 'Verifica se c\'è una versione più recente del sito e caricala subito', () => checkUpdate(up), 'upbtn');
    if (adm) mk('✎', 'Chiedi a Claude', 'Chiedi una modifica a Claude', () => { setOpen(false); askClaude(); });
    theme.className = 'tbtn'; list.append(theme);
    const out = mk('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"/><path d="M16 8l4 4-4 4"/><path d="M20 12H9"/></svg>', 'Esci', 'Esci e torna alla schermata di accesso', async () => { out.disabled = true; ls.del('cdnd_remember'); if (DB) { try { const t = DB.transaction('kv', 'readwrite'); t.objectStore('kv').delete('key'); await done(t); } catch { } } location.reload(); });
    box.append(tog, list); document.body.append(box);
    // il tema mostra anche la scritta, l'app cambia solo l'icona
    const tl = () => { if (!theme.querySelector('.tl')) { const ic = theme.textContent; theme.innerHTML = `<span class="ti" aria-hidden="true">${ic}</span><span class="tl">${ic === '☀' ? 'Tema chiaro' : 'Tema scuro'}</span>`; } };
    tl(); new MutationObserver(tl).observe(theme, { childList: true, characterData: true, subtree: true });
    const sp = document.createElement('span'); sp.style.cssText = 'flex:1 1 0;min-width:0'; sp.className = 'spacer-top'; top.insertBefore(sp, document.getElementById('srchBtn'));
  }

  /* ---------- amministratore: richiesta a Claude ---------- */
  const ASK_REPO = 'https://github.com/marianogianmarco96-maker/Avalar';
  // apre GitHub con una richiesta per Claude già compilata (solo per il DM)
  window.__sendRequest = (title, body) => {
    if (ROLE !== 'admin') return;
    const page = (document.title || '').replace(/ · Campagna D&D.*$/, '');
    const t = '[Richiesta] ' + (title.length > 70 ? title.slice(0, 67) + '…' : title);
    const txt = body.slice(0, 6000) + '\n\n---\nInviata dal sito, pagina: ' + page + ' (' + location.hash + ')';
    window.open(ASK_REPO + '/issues/new?title=' + encodeURIComponent(t) + '&body=' + encodeURIComponent(txt), '_blank', 'noopener');
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
      const files = ['index.html', 'local.js', 'sw.js', ROLE === 'admin' ? 'data.enc' : 'data.json'];
      const fresh = await Promise.all(files.map(async f => { const r = await fetch(f + '?v=' + Date.now(), { cache: 'reload' }); if (!r.ok) throw new Error(); return r.text(); }));
      const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
      if (reg) await reg.update().catch(() => { });
      let changed = !('caches' in window);
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
      notice('Hai già la versione più recente. Se hai appena approvato una modifica, GitHub può metterci qualche minuto a pubblicarla: riprova tra poco.');
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
  function summary() {
    const ids = {}; for (const k of PEND) { const j = k.indexOf('/'); (ids[k.slice(0, j)] = ids[k.slice(0, j)] || new Set()).add(k.slice(j + 1)); }
    const out = [];
    for (const [cs, one, many] of GROUPS) { const u = new Set(); for (const c of cs) for (const id of ids[c] || []) u.add(id.replace(/^portrait-/, '')); if (u.size) out.push(u.size + ' ' + (u.size === 1 ? one : many)); }
    const other = Object.keys(ids).filter(c => !GROUPS.some(g => g[0].includes(c))); if (other.length) out.push('altro');
    if (!out.length && PFILES.size) out.push(PFILES.size + (PFILES.size === 1 ? ' immagine' : ' immagini'));
    return out.join(', ');
  }
  // dati pubblicati, per mandare solo i campi cambiati (le schede contengono anche il ritratto, troppo grande da rimandare)
  let SERVER = null;
  async function serverData() {
    const enc = await (await fetch('data.enc', { cache: 'no-cache' })).json();
    if (!SERVER || SERVER.iv !== enc.iv) SERVER = { iv: enc.iv, d: JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(enc.iv) }, await aesKey(RAW), b64d(enc.ct)))) };
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
    let bytes = new TextEncoder().encode(JSON.stringify({ v: 1, base: await kvGet('dataVersion'), at: new Date().toISOString(), ops, files }));
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
      const enc = await (await fetch('data.enc', { cache: 'no-cache' })).json();
      const payload = JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(enc.iv) }, await aesKey(RAW), b64d(enc.ct))));
      const t = DB.transaction('files', 'readwrite'); for (const aid of PFILES) t.objectStore('files').delete(aid); await done(t);
      await seedAdmin(payload, RAW); location.reload();
    } catch { if (btn) btn.disabled = false; notice('Non riesco a scaricare i dati pubblicati: controlla la connessione e riprova.'); }
  }
  const OB_CSS = `#outbox{position:fixed;z-index:44;right:max(14px,env(safe-area-inset-right,0px));bottom:calc(16px + env(safe-area-inset-bottom,0px));width:min(430px,calc(100vw - 92px));box-sizing:border-box;display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:11px 12px;border-radius:12px;background:#561820;color:#f5e6c4;border:1px solid #e7cf9a;box-shadow:0 6px 20px #0007;font:15px/1.35 Georgia,serif}
#outbox .om{flex:1 1 100%}#outbox .om b{color:#f7e3ae;font-weight:600}
#outbox button{padding:7px 12px;border-radius:7px;border:1px solid #f5e6c488;background:#00000030;color:inherit;cursor:pointer;font:inherit}
#outbox button.p{background:#e7cf9a;color:#561820;border-color:#e7cf9a;font-weight:600}#outbox button:disabled{opacity:.6;cursor:wait}
@media (max-width:1280px){#outbox{bottom:calc(74px + env(safe-area-inset-bottom,0px))}}`;
  let OB = null, PREP = null, PREPV = 0, SENT = false;
  function outbox() {
    if (ROLE !== 'admin' || !document.body) return;
    if (!PEND.size && !PFILES.size) { if (OB) OB.remove(); OB = null; return; }
    if (!OB) { const st = document.createElement('style'); st.textContent = OB_CSS; document.head.append(st); OB = document.createElement('div'); OB.id = 'outbox'; OB.setAttribute('role', 'status'); document.body.append(OB); }
    SENT = false; PREP = null; const v = ++PREPV; drawOutbox();
    clearTimeout(outbox.t); outbox.t = setTimeout(() => buildRequest().then(r => { if (v === PREPV) { PREP = r; drawOutbox(); } }, () => { if (v === PREPV) { PREP = { err: true }; drawOutbox(); } }), 400);
  }
  function drawOutbox() {
    if (!OB) return; OB.innerHTML = '';
    const msg = document.createElement('div'); msg.className = 'om'; OB.append(msg);
    const mk = (t, f, p) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; if (p) b.className = 'p'; b.onclick = () => f(b); OB.append(b); return b; };
    if (SENT) {
      msg.innerHTML = PREP && PREP.file ? '<b>Su GitHub allega il file «modifiche-avalar.txt» e premi «Create».</b> Quando hai finito, togli le modifiche da questo browser: le vedrai sul sito dopo che avrai approvato la modifica di Claude.' : '<b>Su GitHub premi «Create» per inviare la richiesta.</b> Quando hai finito, togli le modifiche da questo browser: le vedrai sul sito dopo che avrai approvato la modifica di Claude.';
      mk('Fatto, togli dal browser', b => resetToServer(b), true); mk('Riapri GitHub', () => send()); return;
    }
    msg.innerHTML = '<b>Da inviare a Claude:</b> ' + summary() + '. Finché non le invii valgono solo su questo browser.';
    const go = mk(PREP ? (PREP.err ? 'Errore, riprova' : 'Invia a Claude') : 'Preparo…', () => PREP && !PREP.err ? send() : outbox(), true); if (!PREP) go.disabled = true;
    mk('Scarta', b => { if (confirm('Scartare le modifiche non inviate? Il sito torna ai dati pubblicati.')) resetToServer(b); });
  }
  function send() {
    const r = PREP; if (!r || r.err) return;
    if (r.file) { const u = URL.createObjectURL(r.file), a = document.createElement('a'); a.href = u; a.download = 'modifiche-avalar.txt'; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 60000); }
    window.open(r.url, '_blank', 'noopener'); SENT = true; drawOutbox();
  }
  if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));
})();

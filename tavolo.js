/* Campagna D&D — «Tavolo»: il tavolo virtuale condiviso, in tempo reale (Supabase).
   Tappa 1: mappa con griglia, token che i giocatori muovono dal vivo, dadi tirati dal server e visibili a tutti, righello.
   Nessuna nuova password: l'account Supabase di ognuno è ricavato dalla chiave con cui è entrato nel sito
   (codice del DM o password del giocatore). Il DM, aprendo il tavolo, prepara anche gli account dei giocatori.
   Le tabelle e i permessi sono in tavolo/tappa-1.sql. Usa le funzioni della pagina principale (route, setView, esc…). */
(() => {
  'use strict';
  const SB_URL = 'https://zwxwnmcxryfmzkqsakjz.supabase.co';
  const SB_KEY = 'sb_publishable_cAGuilUZdnxhtDeJ-qwuEQ_ihjCyFj0'; // chiave pubblica: i permessi veri sono nel database
  const SB_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.min.js';
  const BUCKET = 'tavolo';
  const DADI = [4, 6, 8, 10, 12, 20, 100];
  const COLORI = ['#7d2530', '#3b5f8a', '#3f7a4a', '#b0802a', '#6a4a8c', '#b4541c', '#2b1d14', '#5b6670'];

  const CSS = `.tv{position:fixed;left:0;right:0;z-index:30;display:flex;flex-direction:column;background:var(--bg)}
.tv-bar{display:flex;align-items:center;gap:6px;padding:6px max(8px,env(safe-area-inset-left,0px));border-bottom:1px solid var(--line2);background:var(--paper);overflow-x:auto;scrollbar-width:none;flex:none}
.tv-bar::-webkit-scrollbar{display:none}
.tv-bar .btn{white-space:nowrap;flex:none}
.tv-bar select{font:inherit;font-family:var(--display);font-size:.78rem;max-width:200px;padding:5px 8px;border-radius:4px;border:1px solid var(--line2);background:var(--paper2);color:var(--ink);flex:none}
.tv-scena{font-family:var(--display);color:var(--wine);font-weight:600;white-space:nowrap;padding:0 6px;flex:none}
:root[data-theme=dark] .tv-scena{color:var(--gold2)}
.tv-sep{width:1px;align-self:stretch;background:var(--line2);margin:2px 2px;flex:none}
.tv-sp{flex:1;min-width:4px}
.tv-on{display:flex;align-items:center;gap:4px;flex:none;font-size:.85rem;color:var(--mute);white-space:nowrap}
.tv-on i{width:8px;height:8px;border-radius:50%;background:#999;display:inline-block}
.tv-on.ok i{background:#3f9a4a}.tv-on.ko i{background:#c0392b}
.tv-main{flex:1;display:flex;min-height:0;position:relative}
.tv-stage{flex:1;position:relative;overflow:hidden;touch-action:none;background:#2b211b radial-gradient(ellipse at 50% 40%,#3a2d24,#1a1310);cursor:grab;user-select:none;-webkit-user-select:none}
.tv-stage.pan{cursor:grabbing}.tv-stage.rul{cursor:crosshair}
.tv-world{position:absolute;left:0;top:0;transform-origin:0 0;will-change:transform}
.tv-map{position:absolute;left:0;top:0;max-width:none;pointer-events:none;-webkit-user-drag:none;box-shadow:0 0 0 2px #0006,0 10px 40px #000a;background:#e8dcc0}
.tv-grid{position:absolute;left:0;top:0;pointer-events:none;overflow:visible}
.tv-tok{position:absolute;border-radius:50%;box-sizing:border-box;background:var(--c) center/cover no-repeat;border:3px solid var(--c);box-shadow:0 2px 6px #000a;transition:left .12s,top .12s}
.tv-tok.mine,.tv-tok.dm{cursor:grab}
.tv-tok.drag{transition:none;z-index:5;box-shadow:0 8px 18px #000c;cursor:grabbing}
.tv-tok.live{transition:left .06s linear,top .06s linear}
.tv-tok.hid{opacity:.45;border-style:dashed}
.tv-tok.mine{box-shadow:0 0 0 3px #e7cf9a,0 2px 6px #000a}
.tv-tok b{position:absolute;left:50%;top:100%;transform:translateX(-50%);margin-top:2px;white-space:nowrap;font:600 var(--fs,13px)/1.15 var(--body);color:#fff;background:#000a;padding:1px 6px;border-radius:8px;pointer-events:none;max-width:240px;overflow:hidden;text-overflow:ellipsis}
.tv-tok .ini{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:700 calc(var(--fs,13px)*1.6)/1 var(--display);color:#fff;text-shadow:0 1px 2px #000}
.tv-ov{position:absolute;inset:0;pointer-events:none;overflow:visible}
.tv-ov text{font:700 15px var(--body);paint-order:stroke;stroke:#000c;stroke-width:4px;fill:#fff}
.tv-empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:20px;text-align:center;color:#ecdcb4}
.tv-empty div{max-width:440px;background:#00000066;border:1px solid #e7cf9a55;border-radius:10px;padding:22px 24px;line-height:1.45;font-size:1.05rem}
.tv-empty h2{font-family:var(--display);color:var(--gold2)!important;margin:0 0 8px;font-size:1.25rem}
.tv-empty code{background:#0006;padding:1px 5px;border-radius:4px}
.tv-zoom{position:absolute;right:10px;bottom:10px;display:flex;flex-direction:column;gap:6px;z-index:6}
.tv-zoom button{width:38px;height:38px;border-radius:50%;border:1px solid #e7cf9a88;background:#2b1d14d9;color:#f5e6c4;font:600 1.2rem/1 var(--display);cursor:pointer;box-shadow:0 2px 8px #0008}
.tv-dice{width:300px;flex:none;display:flex;flex-direction:column;border-left:1px solid var(--line2);background:var(--paper);min-height:0}
.tv-dice[hidden]{display:none!important}
.tv-dh{display:flex;align-items:center;justify-content:space-between;padding:8px 10px 4px;font-family:var(--display);color:var(--wine);font-weight:600}
:root[data-theme=dark] .tv-dh{color:var(--gold2)}
.tv-log{flex:1;overflow-y:auto;padding:4px 10px;display:flex;flex-direction:column;gap:6px;min-height:60px}
.tv-roll{border:1px solid var(--line);border-radius:6px;padding:6px 8px;background:var(--paper2);font-size:.95rem;line-height:1.3}
.tv-roll .h{display:flex;justify-content:space-between;gap:8px;align-items:baseline}
.tv-roll .h span{font-weight:600}
.tv-roll .h small{color:var(--mute)}
.tv-roll .m{color:var(--ink2);font-style:italic}
.tv-roll .r{display:flex;align-items:center;gap:8px;margin-top:2px}
.tv-roll .d{flex:1;color:var(--mute);font-size:.85rem;overflow-wrap:anywhere}
.tv-roll .t{font:700 1.45rem/1 var(--display);color:var(--wine);min-width:36px;text-align:right}
:root[data-theme=dark] .tv-roll .t{color:var(--gold2)}
.tv-roll.crit .t{color:#2f8a3c}.tv-roll.fail .t{color:#b3261e}
.tv-roll.priv{border-style:dashed;opacity:.85}
.tv-roll.me{border-color:var(--gold)}
.tv-dk{padding:8px 10px 10px;border-top:1px solid var(--line2);display:flex;flex-direction:column;gap:7px}
.tv-dk .row{display:flex;gap:5px;flex-wrap:wrap;align-items:center}
.tv-dk .row .btn{flex:1 1 0;justify-content:center;padding:7px 4px;min-width:40px}
.tv-dk input[type=text],.tv-dk input[type=number]{font:inherit;padding:6px 8px;border-radius:4px;border:1px solid var(--line2);background:var(--paper2);color:var(--ink);min-width:0}
.tv-dk label{display:flex;align-items:center;gap:6px;font-size:.92rem;color:var(--ink2)}
.tv-pop{position:absolute;z-index:8;background:var(--paper);color:var(--ink);border:1px solid var(--gold);border-radius:8px;box-shadow:0 10px 30px #000a;padding:8px;display:flex;flex-direction:column;gap:5px;min-width:190px}
.tv-pop b{font-family:var(--display);color:var(--wine);padding:2px 4px 4px}
:root[data-theme=dark] .tv-pop b{color:var(--gold2)}
.tv-pop .btn{justify-content:flex-start}
.tv-pop .row{display:flex;gap:5px;align-items:center}
.tv-pop select{font:inherit;flex:1;padding:4px;border-radius:4px;border:1px solid var(--line2);background:var(--paper2);color:var(--ink)}
.tv-pick{display:grid;grid-template-columns:repeat(auto-fill,minmax(86px,1fr));gap:8px;max-height:46vh;overflow-y:auto;padding:2px}
.tv-pick button{all:unset;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px 4px;border-radius:6px;border:1px solid transparent;text-align:center;font-size:.85rem;line-height:1.15}
.tv-pick button:hover,.tv-pick button:focus-visible{border-color:var(--gold);background:var(--paper2)}
.tv-pick i{width:58px;height:58px;border-radius:50%;background:var(--c,#7d2530) center/cover no-repeat;border:2px solid var(--c,#7d2530);box-shadow:0 1px 4px #0006;display:flex;align-items:center;justify-content:center;font:700 1.3rem var(--display);color:#fff;font-style:normal}
.tv-f{display:grid;grid-template-columns:auto 1fr;gap:8px 10px;align-items:center;margin:8px 0}
.tv-f input,.tv-f select{font:inherit;padding:6px 8px;border-radius:4px;border:1px solid var(--line2);background:var(--paper2);color:var(--ink);min-width:0}
.tv-f input[type=range]{padding:0}
.tv-cols{display:flex;gap:6px;flex-wrap:wrap}
.tv-cols button{width:28px;height:28px;border-radius:50%;border:2px solid #fff8;background:var(--c);cursor:pointer}
.tv-cols button[aria-pressed=true]{outline:3px solid var(--gold);outline-offset:1px}
.tv-sc{display:flex;align-items:center;gap:8px;padding:8px 0;border-top:1px solid var(--line)}
.tv-sc img,.tv-sc .ph{width:64px;height:44px;object-fit:cover;border-radius:4px;background:#2b211b;flex:none}
.tv-sc div{flex:1;min-width:0}
.tv-sc small{display:block;color:var(--mute)}
dialog.dlg.tv-gd{margin:auto 12px 12px auto;width:min(420px,94vw)}
dialog.dlg.tv-gd::backdrop{background:transparent}
.tv-tabs{display:flex;gap:4px;margin:4px 0 10px;flex-wrap:wrap}
@media (max-width:820px){
  .tv-dice{position:absolute;right:0;bottom:0;left:0;width:auto;max-height:72%;z-index:7;border-left:0;border-top:2px solid var(--gold);box-shadow:0 -8px 24px #0008;border-radius:12px 12px 0 0}
  .tv-bar .tl{display:none}
  .tv-on span{display:none}
  .tv-zoom{bottom:12px}
}`;
  let cssDone = false;
  const css = () => { if (cssDone) return; cssDone = true; const s = document.createElement('style'); s.textContent = CSS; document.head.append(s); };

  /* ---------- account ---------- */
  const enc = s => new TextEncoder().encode(s);
  const hex = b => Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, '0')).join('');
  const b64d = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const sha = async (s, raw) => { const a = enc(s), all = new Uint8Array(a.length + raw.length); all.set(a); all.set(raw, a.length); return hex(await crypto.subtle.digest('SHA-256', all)); };
  // email e password Supabase ricavate dalla chiave del sito: se la password del sito cambia, cambia anche l'account
  async function credenziali(id, raw) {
    const fp = (await sha('avalar-tavolo-email|' + id + '|', raw)).slice(0, 12);
    return { email: `tavolo-${id}-${fp}@example.com`, password: await sha('avalar-tavolo-password|' + id + '|', raw) };
  }
  async function chiaveGiocatore(code, salt, it) {
    const km = await crypto.subtle.importKey('raw', enc(code), 'PBKDF2', false, ['deriveBits']);
    return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: b64d(salt), iterations: it }, km, 256));
  }

  let SB = null, sbLoad = null;
  const sbOpts = extra => ({ auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'tavolo-auth', ...extra }, realtime: { params: { eventsPerSecond: 30 } } });
  function caricaSb() {
    if (window.supabase?.createClient) return Promise.resolve();
    return sbLoad = sbLoad || new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = SB_JS; s.onload = res;
      s.onerror = () => { sbLoad = null; s.remove(); rej(new Error('offline')); }; document.head.append(s);
    });
  }

  const ERR = {
    offline: ['Serve internet', 'Il tavolo funziona solo online: controlla la connessione e riprova.'],
    sql: ['Manca la preparazione del database', 'Va eseguito una volta lo script <code>tavolo/tappa-1.sql</code> nell\'SQL Editor di Supabase.'],
    conferma: ['Manca un\'impostazione su Supabase', 'In Supabase apri <b>Authentication › Sign In / Providers › Email</b>, togli la spunta a <b>Confirm email</b> e salva. Poi ricarica questa pagina.'],
    nonpronto: ['Il tavolo non è ancora pronto per te', 'Il DM deve aprire il Tavolo una volta dal suo accesso: così prepara anche il tuo. Poi ricarica questa pagina.'],
    altrodm: ['Il tavolo ha già un altro DM', 'Il tavolo è legato a un altro codice del DM. Se il codice è cambiato, in Supabase esegui <code>delete from tavolo_membri where ruolo = \'dm\';</code> e ricarica.'],
    ospite: ['Accedi per usare il tavolo', 'Il tavolo è per il DM e i giocatori: entra con il tuo accesso.']
  };
  const errore = k => Object.assign(new Error(k), { tv: k });
  const sqlMancante = e => e && (e.code === '42P01' || e.code === 'PGRST205' || e.code === 'PGRST202' || /does not exist|schema cache/i.test(e.message || ''));
  const chk = r => { if (r.error) { if (sqlMancante(r.error)) throw errore('sql'); throw new Error(r.error.message); } return r.data; };

  async function entra(info) {
    await caricaSb().catch(() => { throw errore('offline'); });
    SB = SB || window.supabase.createClient(SB_URL, SB_KEY, sbOpts());
    const id = info.ruolo === 'dm' ? 'dm' : info.id;
    const cred = await credenziali(id, info.raw);
    let { data: { session } } = await SB.auth.getSession();
    if (session && session.user.email !== cred.email) { await SB.auth.signOut({ scope: 'local' }); session = null; }
    if (!session) {
      let r = await SB.auth.signInWithPassword(cred);
      if (r.error && /fetch|network/i.test(r.error.message)) throw errore('offline');
      if (r.error?.code === 'email_not_confirmed') throw errore('conferma');
      if (r.error && info.ruolo === 'dm') {
        r = await SB.auth.signUp(cred);
        if (r.error && r.error.code !== 'user_already_exists') throw r.error.code === 'email_address_not_authorized' ? errore('conferma') : new Error(r.error.message);
        if (!r.data?.session) throw errore('conferma');
      } else if (r.error) throw errore('nonpronto');
      session = r.data.session;
    }
    const me = { uid: session.user.id, ruolo: info.ruolo, giocatore: info.ruolo === 'dm' ? null : info.id, nome: info.ruolo === 'dm' ? 'DM' : info.nome, pg: info.pg || null };
    if (me.ruolo === 'dm') {
      const r = await SB.rpc('tavolo_reclama_dm', { p_email: cred.email });
      if (r.error) { if (sqlMancante(r.error)) throw errore('sql'); throw new Error(r.error.message); }
      if (!r.data) throw errore('altrodm');
    } else {
      const m = chk(await SB.from('tavolo_membri').select('user_id').eq('user_id', me.uid).maybeSingle());
      if (!m) throw errore('nonpronto');
    }
    return me;
  }

  // il DM crea (o ritrova) l'account di ogni giocatore e lo collega al suo nome
  async function preparaGiocatori(info) {
    if (!info.it) return;
    const membri = chk(await SB.from('tavolo_membri').select('*')), falliti = [];
    for (const g of info.giocatori || []) {
      if (!g.code || !g.salt) continue;
      const cred = await credenziali(g.id, await chiaveGiocatore(g.code, g.salt, info.it));
      const m = membri.find(x => x.giocatore === g.id);
      if (m && m.email === cred.email) continue;
      const c2 = window.supabase.createClient(SB_URL, SB_KEY, sbOpts({ persistSession: false, autoRefreshToken: false, storageKey: 'tavolo-prep' }));
      let r = await c2.auth.signUp(cred), uid = r.data?.session ? r.data.user.id : null;
      if (!uid) { const s = await c2.auth.signInWithPassword(cred); uid = s.data?.user?.id || null; if (s.error?.code === 'email_not_confirmed') throw errore('conferma'); }
      if (!uid) { falliti.push(g.name); continue; }
      const u = await SB.from('tavolo_membri').upsert({ user_id: uid, ruolo: 'giocatore', giocatore: g.id, nome: g.name, email: cred.email }, { onConflict: 'giocatore' });
      if (u.error) falliti.push(g.name);
    }
    if (falliti.length) toast('Non sono riuscito a preparare il tavolo per: ' + falliti.join(', '), 'err');
  }

  /* ---------- stato ---------- */
  const T = { me: null, info: null, stato: null, scene: new Map(), tok: new Map(), tiri: [], vista: null, view: { x: 0, y: 0, z: 1 }, tool: 'muovi', ch: null, rulers: new Map(), live: false, url: new Map(), online: [] };
  const isDM = () => T.me?.ruolo === 'dm';
  const scena = () => T.scene.get(T.vista) || null;
  const puoMuovere = t => isDM() || (t.giocatore && t.giocatore === T.me.giocatore);
  const iniziali = n => String(n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';

  /* ---------- pagina ---------- */
  route(/^\/tavolo$/, async () => {
    await claude.use('db'); css();
    T.diceInit = false; T.drag = null; T.online = []; T.live = false;
    setView(`<h1 style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Tavolo</h1>
      <div class="tv"><div class="tv-bar" id="tv-bar"><span class="tv-scena">Tavolo</span><span class="tv-sp"></span><span class="tv-on" id="tv-on"><i></i><span>Connessione…</span></span></div>
      <div class="tv-main"><div class="tv-stage" id="tv-stage"><div class="tv-empty"><div><p>Apro il tavolo…</p></div></div></div>
      <aside class="tv-dice" id="tv-dice" hidden></aside></div></div>`);
    const fit = () => {
      const f = $('.tv'); if (!f) return;
      const top = $('header.top'), nav = $('#nav');
      f.style.top = (top ? top.getBoundingClientRect().bottom : 0) + 'px';
      f.style.bottom = (nav && getComputedStyle(nav).position === 'fixed' ? nav.offsetHeight : 0) + 'px';
    };
    fit(); scrollTo(0, 0); addEventListener('resize', fit);
    let vivo = true;
    onCleanup(() => { vivo = false; removeEventListener('resize', fit); esci(); });
    const info = await window.__tavolo?.();
    T.info = info;
    try {
      if (!info) throw errore('ospite');
      T.me = await entra(info);
      if (!vivo) return;
      await carica();
      if (!vivo) return;
      collega();
      disegnaBarra(); disegnaDadi(); mostraScena(true);
      if (isDM()) preparaGiocatori(info).catch(e => toast(e.tv ? ERR[e.tv][1].replace(/<[^>]+>/g, '') : e.message, 'err'));
    } catch (e) {
      console.error(e);
      if (!vivo) return;
      const [h, p] = ERR[e.tv] || ['Il tavolo non si è aperto', esc(e.message || String(e))];
      $('#tv-stage').innerHTML = `<div class="tv-empty"><div><h2>${h}</h2><p>${p}</p></div></div>`;
      stato('ko', 'Non collegato');
    }
  });

  function esci() {
    if (T.ch) { try { SB.removeChannel(T.ch); } catch { } T.ch = null; }
    T.live = false; T.rulers.clear(); clearTimeout(T.rt);
    removeEventListener('keydown', tasti);
  }
  function stato(cls, txt) { const o = $('#tv-on'); if (!o) return; o.className = 'tv-on ' + cls; o.querySelector('span').textContent = txt; }

  async function carica() {
    const [st, sc, tk, tr, mb] = await Promise.all([
      SB.from('tavolo_stato').select('*').eq('id', 1).maybeSingle(),
      SB.from('tavolo_scene').select('*').order('creata'),
      SB.from('tavolo_token').select('*'),
      SB.from('tavolo_tiri').select('*').order('id', { ascending: false }).limit(80),
      SB.from('tavolo_membri').select('user_id,nome,giocatore')
    ]);
    T.stato = chk(st) || { scena: null, canale: 'avalar' };
    T.scene = new Map(chk(sc).map(s => [s.id, s]));
    T.tok = new Map(chk(tk).map(t => [t.id, t]));
    T.tiri = chk(tr).reverse();
    T.membri = chk(mb);
    if (!isDM() || !T.scene.has(T.vista)) T.vista = T.stato.scena;
  }

  /* ---------- tempo reale ---------- */
  function collega() {
    if (T.ch) SB.removeChannel(T.ch);
    const ch = T.ch = SB.channel('tavolo-' + T.stato.canale, { config: { broadcast: { self: false }, presence: { key: T.me.uid } } });
    const pg = (table, f, event = '*') => ch.on('postgres_changes', { event, schema: 'public', table }, f);
    pg('tavolo_token', p => {
      if (p.eventType === 'DELETE') { T.tok.delete(p.old.id); disegnaToken(); return; }
      const t = p.new; if (T.drag?.id === t.id) return; T.tok.set(t.id, t); disegnaToken();
    });
    pg('tavolo_scene', p => {
      if (p.eventType === 'DELETE') { T.scene.delete(p.old.id); if (T.vista === p.old.id) T.vista = T.stato.scena; }
      else { const prima = T.scene.get(p.new.id); T.scene.set(p.new.id, p.new); if (prima?.mappa !== p.new.mappa) T.url.delete(prima?.mappa); }
      disegnaBarra(); if (p.eventType === 'DELETE' || p.new.id === T.vista) mostraScena(p.eventType !== 'UPDATE');
    });
    pg('tavolo_stato', async p => {
      const prima = T.stato.scena; T.stato = p.new;
      if (prima === T.stato.scena) return;
      if (isDM()) { disegnaBarra(); return; }
      // i giocatori seguono il DM nella nuova scena: scena e token arrivano solo ora che è attiva
      await carica().catch(() => { }); T.vista = T.stato.scena; disegnaBarra(); mostraScena(true);
      if (scena()) toast('Il DM vi ha portati in: ' + scena().nome);
    });
    pg('tavolo_tiri', p => { if (T.tiri.some(x => x.id === p.new.id)) return; T.tiri.push(p.new); if (T.tiri.length > 120) T.tiri.shift(); nuovoTiro(p.new); }, 'INSERT');
    pg('tavolo_tiri', p => { T.tiri = T.tiri.filter(x => x.id !== p.old.id); disegnaLog(); }, 'DELETE');
    ch.on('broadcast', { event: 'trascina' }, ({ payload: m }) => {
      const t = T.tok.get(m.id), el = tokEl(m.id); if (!t || !el || T.drag?.id === m.id) return;
      el.classList.add('live'); el.style.left = m.x + 'px'; el.style.top = m.y + 'px';
    });
    ch.on('broadcast', { event: 'righello' }, ({ payload: m }) => {
      if (m.pts) T.rulers.set(m.uid, m); else T.rulers.delete(m.uid);
      disegnaRighelli();
    });
    ch.on('broadcast', { event: 'nascosto' }, ({ payload: m }) => {
      if (isDM()) return; const t = T.tok.get(m.id); if (t && t.giocatore !== T.me.giocatore) { T.tok.delete(m.id); disegnaToken(); }
    });
    ch.on('presence', { event: 'sync' }, () => {
      T.online = Object.values(ch.presenceState()).map(a => a[0]?.nome).filter(Boolean);
      if (T.live) stato('ok', T.online.length > 1 ? T.online.length + ' al tavolo' : 'Collegato');
      const o = $('#tv-on'); if (o) o.title = 'Al tavolo ora: ' + T.online.join(', ');
    });
    let primo = true;
    ch.subscribe(async s => {
      if (s === 'SUBSCRIBED') {
        T.live = true; stato('ok', 'Collegato'); ch.track({ nome: T.me.nome });
        // dopo un'interruzione riprendo tutto: nel frattempo qualcuno può aver mosso o tirato
        if (!primo) { await carica().catch(() => { }); disegnaBarra(); mostraScena(false); disegnaLog(); }
        primo = false;
      } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') { T.live = false; if (T.ch === ch) stato('ko', 'Riconnessione…'); }
    });
    addEventListener('keydown', tasti);
  }
  const manda = (event, payload) => { if (T.ch) T.ch.send({ type: 'broadcast', event, payload }).catch(() => { }); };

  /* ---------- barra ---------- */
  function disegnaBarra() {
    const bar = $('#tv-bar'); if (!bar) return;
    const sc = scena(), att = T.stato?.scena;
    const ico = (i, l, act, on, title) => `<button class="btn sm ${on ? 'on' : ''}" data-act="${act}" title="${esc(title || l)}"><span aria-hidden="true">${i}</span><span class="tl">${esc(l)}</span></button>`;
    let h = '';
    if (isDM()) {
      const opts = [...T.scene.values()].map(s => `<option value="${s.id}" ${s.id === T.vista ? 'selected' : ''}>${s.id === att ? '● ' : ''}${esc(s.nome)}</option>`).join('');
      h += T.scene.size ? `<select id="tv-sel" aria-label="Scena da guardare">${opts}</select>` : '';
      if (sc && sc.id !== att) h += `<button class="btn sm primary" data-act="tv-porta" title="Mostra questa scena ai giocatori">Porta qui i giocatori</button>`;
      h += ico('🗺', 'Scene', 'tv-scene', false, 'Crea e gestisci le scene');
    } else h += `<span class="tv-scena">${esc(sc ? sc.nome : 'Tavolo')}</span>`;
    h += '<span class="tv-sep"></span>' + ico('✋', 'Muovi', 'tv-muovi', T.tool === 'muovi', 'Sposta la mappa e i token') + ico('📏', 'Righello', 'tv-righello', T.tool === 'righello', 'Misura una distanza (R)');
    if (isDM() && sc) h += ico('＋', 'Token', 'tv-token', false, 'Aggiungi un token') + ico('▦', 'Griglia', 'tv-griglia', false, 'Regola la griglia della mappa');
    h += ico('🎲', 'Dadi', 'tv-dadi', !$('#tv-dice')?.hidden, 'Tira i dadi') + `<span class="tv-sp"></span><span class="tv-on ${T.live ? 'ok' : ''}" id="tv-on" title="Al tavolo ora: ${esc(T.online.join(', '))}"><i></i><span>${T.live ? (T.online.length > 1 ? T.online.length + ' al tavolo' : 'Collegato') : 'Connessione…'}</span></span>`;
    bar.innerHTML = h;
    const sel = $('#tv-sel'); if (sel) sel.onchange = () => { T.vista = sel.value; disegnaBarra(); mostraScena(true); };
    setActs({
      'tv-muovi': () => strumento('muovi'), 'tv-righello': () => strumento(T.tool === 'righello' ? 'muovi' : 'righello'),
      'tv-dadi': () => { const d = $('#tv-dice'); d.hidden = !d.hidden; disegnaBarra(); if (!d.hidden) $('.tv-log', d).scrollTop = 1e9; },
      'tv-porta': async () => { chk(await SB.from('tavolo_stato').update({ scena: T.vista }).eq('id', 1)); T.stato.scena = T.vista; disegnaBarra(); toast('I giocatori ora vedono: ' + scena().nome); },
      'tv-scene': () => dlgScene(), 'tv-token': () => dlgToken(), 'tv-griglia': () => dlgGriglia(),
      ...dadiActs()
    });
  }
  function strumento(t) { T.tool = t; const st = $('#tv-stage'); if (st) st.classList.toggle('rul', t === 'righello'); disegnaBarra(); }
  function tasti(e) {
    if (e.target.closest('input,textarea,select,[contenteditable]') || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('dialog[open]')) return;
    if (e.key === 'r' || e.key === 'R') strumento(T.tool === 'righello' ? 'muovi' : 'righello');
    else if (e.key === 'Escape') { strumento('muovi'); chiudiPop(); }
  }

  /* ---------- scena ---------- */
  async function urlMappa(path) {
    if (!path) return null;
    const c = T.url.get(path); if (c && c.t > Date.now()) return c.u;
    const r = await SB.storage.from(BUCKET).createSignedUrl(path, 6 * 3600);
    if (r.error) throw new Error(r.error.message);
    T.url.set(path, { u: r.data.signedUrl, t: Date.now() + 5 * 3600e3 }); return r.data.signedUrl;
  }
  async function mostraScena(centra) {
    const st = $('#tv-stage'); if (!st) return;
    chiudiPop();
    const sc = scena();
    if (!sc) {
      st.innerHTML = `<div class="tv-empty"><div>${isDM() ? (T.scene.size ? '<h2>Nessuna scena scelta</h2><p>Scegline una dall\'elenco in alto.</p>' : '<h2>Il tavolo è pronto</h2><p>Crea la prima scena: carica la mappa del combattimento o del luogo, poi aggiungi i token.</p><p><button class="btn primary" data-act="tv-scene">Crea una scena</button></p>') : '<h2>Il tavolo è vuoto</h2><p>Aspetta che il DM vi porti in una scena: apparirà qui da sola.</p>'}</div></div>`;
      return;
    }
    st.innerHTML = `<div class="tv-world" id="tv-world"><img class="tv-map" id="tv-map" alt="" draggable="false" width="${sc.larghezza}" height="${sc.altezza}" style="width:${sc.larghezza}px;height:${sc.altezza}px">
      <svg class="tv-grid" id="tv-grid" width="${sc.larghezza}" height="${sc.altezza}"></svg><div id="tv-toks"></div></div>
      <svg class="tv-ov" id="tv-ov"></svg><div class="tv-zoom"><button type="button" data-z="1.25" title="Ingrandisci">+</button><button type="button" data-z="0.8" title="Rimpicciolisci">−</button><button type="button" data-z="0" title="Mostra tutta la mappa">⤢</button></div>`;
    st.querySelectorAll('[data-z]').forEach(b => b.onclick = () => { const z = +b.dataset.z; if (!z) adatta(); else { const r = st.getBoundingClientRect(); zoom(z, r.width / 2, r.height / 2); } });
    const img = $('#tv-map');
    if (sc.mappa) urlMappa(sc.mappa).then(u => { if (img.isConnected) img.src = u; }).catch(e => toast('Mappa non caricata: ' + e.message, 'err'));
    else img.removeAttribute('src');
    disegnaGriglia(); disegnaToken(); interazioni(st);
    if (centra || !T.viewOk) adatta(); else applicaVista();
  }
  function disegnaGriglia() {
    const sc = scena(), g = $('#tv-grid'); if (!sc || !g) return;
    const s = sc.griglia, ox = ((sc.griglia_x % s) + s) % s, oy = ((sc.griglia_y % s) + s) % s;
    g.innerHTML = sc.griglia_visibile ? `<defs><pattern id="tv-pat" width="${s}" height="${s}" x="${ox}" y="${oy}" patternUnits="userSpaceOnUse"><path d="M${s} 0H0V${s}" fill="none" stroke="#000" stroke-opacity=".38" stroke-width="1" vector-effect="non-scaling-stroke"/></pattern></defs><rect width="100%" height="100%" fill="url(#tv-pat)"/>` : '';
  }
  function adatta() {
    const st = $('#tv-stage'), sc = scena(); if (!st || !sc) return;
    const r = st.getBoundingClientRect(), z = Math.min(r.width / sc.larghezza, r.height / sc.altezza) * 0.96 || 1;
    T.view = { z, x: (r.width - sc.larghezza * z) / 2, y: (r.height - sc.altezza * z) / 2 }; T.viewOk = true; applicaVista();
  }
  function applicaVista() {
    const w = $('#tv-world'); if (w) w.style.transform = `translate(${T.view.x}px,${T.view.y}px) scale(${T.view.z})`;
    disegnaRighelli(); chiudiPop();
  }
  function zoom(f, cx, cy) {
    const z = clamp(T.view.z * f, 0.05, 6), k = z / T.view.z;
    T.view = { z, x: cx - (cx - T.view.x) * k, y: cy - (cy - T.view.y) * k }; applicaVista();
  }
  const mondo = (st, e) => { const r = st.getBoundingClientRect(); return { x: (e.clientX - r.left - T.view.x) / T.view.z, y: (e.clientY - r.top - T.view.y) / T.view.z, sx: e.clientX - r.left, sy: e.clientY - r.top }; };
  // aggancio alla griglia: i token si fermano dentro una casella (mezza casella per i token piccoli)
  function aggancia(v, o, mis) { const sc = scena(), s = mis < 1 ? sc.griglia / 2 : sc.griglia; return o + Math.round((v - o) / s) * s; }
  const centroCasella = (v, o) => { const s = scena().griglia; return o + (Math.floor((v - o) / s) + 0.5) * s; };

  /* ---------- token ---------- */
  const tokEl = id => document.querySelector(`.tv-tok[data-id="${id}"]`);
  function disegnaToken() {
    const box = $('#tv-toks'), sc = scena(); if (!box || !sc) return;
    const lista = [...T.tok.values()].filter(t => t.scena === sc.id).sort((a, b) => b.misura - a.misura || (a.giocatore ? 1 : 0) - (b.giocatore ? 1 : 0));
    const vivi = new Set(lista.map(t => t.id));
    box.querySelectorAll('.tv-tok').forEach(el => { if (!vivi.has(el.dataset.id)) el.remove(); });
    lista.forEach((t, i) => {
      let el = tokEl(t.id);
      if (!el) { el = document.createElement('div'); el.className = 'tv-tok'; el.dataset.id = t.id; el.innerHTML = '<span class="ini"></span><b></b>'; }
      const lato = t.misura * sc.griglia;
      el.style.cssText = `left:${t.x}px;top:${t.y}px;width:${lato}px;height:${lato}px;--c:${t.colore};--fs:${Math.max(11, sc.griglia * 0.22)}px;z-index:${i + 1}${t.immagine ? `;background-image:url("${t.immagine.replace(/"/g, '%22')}")` : ''}`;
      if (T.drag?.id !== t.id) el.classList.remove('live');
      el.classList.toggle('hid', !!t.nascosto); el.classList.toggle('mine', !!t.giocatore && t.giocatore === T.me.giocatore); el.classList.toggle('dm', isDM());
      el.querySelector('.ini').textContent = t.immagine ? '' : iniziali(t.nome);
      el.querySelector('b').textContent = t.nome + (t.nascosto ? ' (nascosto)' : '');
      el.querySelector('b').hidden = !t.nome;
      el.title = t.nome || '';
      box.append(el); // l'ordine nel riquadro decide chi sta sopra
    });
  }

  /* ---------- trascinamenti, righello, zoom ---------- */
  function interazioni(st) {
    if (st.__tv) return; st.__tv = true;
    const punti = new Map(); let pan = null, pinch = null, rul = null, ultimo = 0;
    st.addEventListener('wheel', e => { e.preventDefault(); const r = st.getBoundingClientRect(); zoom(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    st.addEventListener('pointerdown', e => {
      if (e.button > 0 || !scena() || e.target.closest('.tv-zoom,.tv-pop')) return;
      chiudiPop();
      punti.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { st.setPointerCapture(e.pointerId); } catch { }
      if (punti.size === 2) { // due dita: ingrandimento, annullo il resto
        annullaDrag(); rul = fineRighello(rul, true); pan = null;
        const [a, b] = [...punti.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: T.view.z, v: { ...T.view } }; return;
      }
      if (punti.size > 2) return;
      const p = mondo(st, e), el = e.target.closest('.tv-tok'), t = el && T.tok.get(el.dataset.id);
      if (T.tool === 'righello') { const sc = scena(); const a = { x: centroCasella(p.x, sc.griglia_x), y: centroCasella(p.y, sc.griglia_y) }; rul = { pts: [a, a] }; mostraRighello(rul.pts); return; }
      if (t && puoMuovere(t)) { T.drag = { id: t.id, dx: p.x - t.x, dy: p.y - t.y, x0: t.x, y0: t.y, sx: e.clientX, sy: e.clientY, mosso: false }; el.classList.add('drag'); return; }
      if (t && isDM()) T.clic = { id: t.id, sx: e.clientX, sy: e.clientY };
      pan = { sx: e.clientX, sy: e.clientY, x: T.view.x, y: T.view.y }; st.classList.add('pan');
    });
    st.addEventListener('pointermove', e => {
      if (!punti.has(e.pointerId)) return;
      punti.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && punti.size >= 2) {
        const [a, b] = [...punti.values()], r = st.getBoundingClientRect(), cx = (a.x + b.x) / 2 - r.left, cy = (a.y + b.y) / 2 - r.top;
        const z = clamp(pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d, 0.05, 6), k = z / T.view.z;
        T.view = { z, x: cx - (cx - T.view.x) * k, y: cy - (cy - T.view.y) * k }; applicaVista(); return;
      }
      const p = mondo(st, e);
      if (rul) {
        const sc = scena(); rul.pts[1] = { x: centroCasella(p.x, sc.griglia_x), y: centroCasella(p.y, sc.griglia_y) }; mostraRighello(rul.pts);
        const now = Date.now(); if (now - ultimo > 60) { ultimo = now; manda('righello', { uid: T.me.uid, nome: T.me.nome, pts: rul.pts }); }
        return;
      }
      if (T.drag) {
        const d = T.drag, el = tokEl(d.id); if (!el) return;
        if (!d.mosso && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 4) return;
        d.mosso = true; d.x = p.x - d.dx; d.y = p.y - d.dy; el.style.left = d.x + 'px'; el.style.top = d.y + 'px';
        const now = Date.now(); if (now - ultimo > 50) { ultimo = now; manda('trascina', { id: d.id, x: d.x, y: d.y }); }
        return;
      }
      if (pan) { T.view.x = pan.x + e.clientX - pan.sx; T.view.y = pan.y + e.clientY - pan.sy; applicaVista(); if (T.clic && Math.hypot(e.clientX - T.clic.sx, e.clientY - T.clic.sy) > 5) T.clic = null; }
    });
    const su = async e => {
      if (!punti.has(e.pointerId)) return;
      punti.delete(e.pointerId);
      if (pinch) { if (punti.size < 2) pinch = null; return; }
      st.classList.remove('pan'); pan = null;
      if (rul) { rul = fineRighello(rul); return; }
      if (T.clic) { const c = T.clic; T.clic = null; if (e.type === 'pointerup') menuToken(c.id, e); }
      if (T.drag) {
        const d = T.drag; T.drag = null; const el = tokEl(d.id), t = T.tok.get(d.id);
        if (el) el.classList.remove('drag');
        if (!t) return;
        if (!d.mosso) { if (isDM() && e.type === 'pointerup') menuToken(t.id, e); return; }
        const sc = scena(), x = aggancia(d.x, sc.griglia_x, t.misura), y = aggancia(d.y, sc.griglia_y, t.misura);
        t.x = x; t.y = y; disegnaToken(); manda('trascina', { id: t.id, x, y });
        const r = await SB.from('tavolo_token').update({ x, y }).eq('id', t.id).select().maybeSingle();
        if (r.error || !r.data) { t.x = d.x0; t.y = d.y0; disegnaToken(); manda('trascina', { id: t.id, x: d.x0, y: d.y0 }); toast(r.error?.message || 'Non puoi muovere questo token.', 'err'); }
      }
    };
    st.addEventListener('pointerup', su); st.addEventListener('pointercancel', su);
    function annullaDrag() { const d = T.drag; if (!d) return; T.drag = null; const t = T.tok.get(d.id); if (t) { disegnaToken(); manda('trascina', { id: t.id, x: t.x, y: t.y }); } }
    function fineRighello(r, subito) {
      if (!r) return null;
      manda('righello', { uid: T.me.uid, pts: null });
      clearTimeout(T.rt); if (subito) mostraRighello(null); else T.rt = setTimeout(() => mostraRighello(null), 1600);
      return null;
    }
  }
  function mostraRighello(pts) { if (pts) T.rulers.set('io', { nome: '', pts }); else T.rulers.delete('io'); disegnaRighelli(); }
  function disegnaRighelli() {
    const ov = $('#tv-ov'), sc = scena(); if (!ov || !sc) return;
    const v = T.view, S = p => [v.x + p.x * v.z, v.y + p.y * v.z];
    ov.innerHTML = [...T.rulers.values()].map(r => {
      const [a, b] = r.pts, [ax, ay] = S(a), [bx, by] = S(b);
      // regola della 5ª edizione: ogni casella, anche in diagonale, conta 1
      const cas = Math.round(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) / sc.griglia), m = (cas * sc.metri).toLocaleString('it-IT', { maximumFractionDigits: 1 });
      const col = r.nome ? '#e7cf9a' : '#ffd84a', lbl = `${m} m${cas ? ` · ${cas} ${cas === 1 ? 'casella' : 'caselle'}` : ''}${r.nome ? ' · ' + r.nome : ''}`;
      return `<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="#000a" stroke-width="7" stroke-linecap="round"/><line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="${col}" stroke-width="3" stroke-dasharray="10 6" stroke-linecap="round"/>
        <circle cx="${ax}" cy="${ay}" r="5" fill="${col}" stroke="#000" stroke-width="1.5"/><circle cx="${bx}" cy="${by}" r="6" fill="${col}" stroke="#000" stroke-width="1.5"/>
        <text x="${bx + 12}" y="${by - 12}">${esc(lbl)}</text>`;
    }).join('');
  }

  /* ---------- menu del token (DM) ---------- */
  function chiudiPop() { document.querySelectorAll('.tv-pop').forEach(p => p.remove()); }
  function menuToken(id, e) {
    const t = T.tok.get(id), st = $('#tv-stage'); if (!t || !st) return;
    chiudiPop();
    const r = st.getBoundingClientRect(), pop = document.createElement('div'); pop.className = 'tv-pop';
    const gioc = (T.info.giocatori || []).map(g => `<option value="${esc(g.id)}" ${t.giocatore === g.id ? 'selected' : ''}>${esc(g.name)}</option>`).join('');
    pop.innerHTML = `<b>${esc(t.nome || 'Token')}</b>
      <button class="btn sm" data-k="nasc">${t.nascosto ? '👁 Mostra ai giocatori' : '🙈 Nascondi ai giocatori'}</button>
      <div class="row"><span>Misura</span><button class="btn sm" data-k="meno">−</button><span>${t.misura.toLocaleString('it-IT')}</span><button class="btn sm" data-k="piu">+</button></div>
      <div class="row"><span>Lo muove</span><select data-k="gioc"><option value="">solo il DM</option>${gioc}</select></div>
      <button class="btn sm" data-k="nome">✎ Rinomina</button><button class="btn sm danger" data-k="via">Elimina</button>`;
    st.append(pop);
    const x = clamp(e.clientX - r.left + 8, 6, r.width - pop.offsetWidth - 6), y = clamp(e.clientY - r.top + 8, 6, r.height - pop.offsetHeight - 6);
    pop.style.left = x + 'px'; pop.style.top = y + 'px';
    const salva = async ch => {
      const r2 = await SB.from('tavolo_token').update(ch).eq('id', id).select().single();
      if (r2.error) { toast(r2.error.message, 'err'); return; }
      T.tok.set(id, r2.data); disegnaToken(); chiudiPop();
    };
    pop.querySelector('[data-k=nasc]').onclick = async () => { await salva({ nascosto: !t.nascosto }); if (!t.nascosto) manda('nascosto', { id }); };
    pop.querySelector('[data-k=meno]').onclick = () => salva({ misura: t.misura > 1 ? t.misura - 1 : 0.5 });
    pop.querySelector('[data-k=piu]').onclick = () => salva({ misura: t.misura < 1 ? 1 : Math.min(10, t.misura + 1) });
    pop.querySelector('[data-k=gioc]').onchange = ev => salva({ giocatore: ev.target.value || null });
    pop.querySelector('[data-k=nome]').onclick = () => { const n = prompt('Nome del token', t.nome); if (n != null) salva({ nome: n.trim().slice(0, 60) }); };
    pop.querySelector('[data-k=via]').onclick = async () => {
      chiudiPop(); if (!await ask(`Eliminare il token **${t.nome || 'senza nome'}**?`, { ok: 'Elimina', danger: true, title: 'Elimina token' })) return;
      const r2 = await SB.from('tavolo_token').delete().eq('id', id); if (r2.error) return toast(r2.error.message, 'err');
      T.tok.delete(id); disegnaToken();
    };
  }

  /* ---------- aggiungi token (DM) ---------- */
  async function immagineToken(file) {
    const bmp = await loadBitmap(file), L = 200, c = document.createElement('canvas'); c.width = c.height = L;
    const w = bmp.width, h = bmp.height, s = Math.max(L / w, L / h);
    c.getContext('2d').drawImage(bmp, (L - w * s) / 2, (L - h * s) / 2, w * s, h * s); if (bmp.close) bmp.close();
    let u = c.toDataURL('image/webp', 0.85); if (!u.startsWith('data:image/webp')) u = c.toDataURL('image/jpeg', 0.85); return u;
  }
  function dlgToken() {
    const sc = scena(); if (!sc) return;
    const pg = (T.info.giocatori || []).map(g => { const e = S.ents.get(g.pg); return { nome: e?.name || g.name, img: e?.portrait?.thumb || null, giocatore: g.id, scheda: g.pg, colore: '#7d2530' }; });
    const png = [...S.ents.values()].filter(e => e.type === 'png').sort((a, b) => a.name.localeCompare(b.name)).map(e => ({ nome: e.name, img: e.portrait?.thumb || null, scheda: e.id, colore: e.cat === 'nemico' ? '#7d2530' : e.cat === 'alleato' ? '#3f7a4a' : '#3b5f8a' }));
    const cella = x => `<button type="button" data-i="${x.i}"><i style="--c:${x.colore};${x.img ? `background-image:url('${x.img}')` : ''}">${x.img ? '' : esc(iniziali(x.nome))}</i>${esc(x.nome)}</button>`;
    const tutti = [...pg, ...png]; tutti.forEach((x, i) => x.i = i);
    const d = openDlg(`<form method="dialog"><h3>Aggiungi un token</h3>
      <div class="tv-tabs"><button type="button" class="btn sm on" data-tab="pg">Personaggi</button><button type="button" class="btn sm" data-tab="png">PNG del sito</button><button type="button" class="btn sm" data-tab="nuovo">Nuovo</button></div>
      <div data-p="pg"><div class="tv-pick">${pg.map(cella).join('')}</div><p class="hint">Il token di un personaggio lo può muovere il suo giocatore.</p></div>
      <div data-p="png" hidden><input type="search" placeholder="Cerca un PNG…" style="width:100%;margin-bottom:8px;font:inherit;padding:6px 8px;border-radius:4px;border:1px solid var(--line2);background:var(--paper2);color:var(--ink)"><div class="tv-pick">${png.map(cella).join('') || '<p class="hint">Nessun PNG nel sito.</p>'}</div></div>
      <div data-p="nuovo" hidden><div class="tv-f"><label>Nome</label><input name="nome" maxlength="60" placeholder="Es. Bandito 1">
        <label>Colore</label><div class="tv-cols">${COLORI.map((c, i) => `<button type="button" style="--c:${c}" data-c="${c}" aria-pressed="${!i}" aria-label="Colore ${i + 1}"></button>`).join('')}</div>
        <label>Immagine</label><input type="file" name="img" accept="image/*"></div>
        <button type="button" class="btn primary" data-k="crea">Aggiungi</button></div>
      <div class="tv-f" style="margin-top:12px"><label>Misura</label><select name="mis"><option value="0.5">Minuscola (½ casella)</option><option value="1" selected>Media (1 casella)</option><option value="2">Grande (2×2)</option><option value="3">Enorme (3×3)</option><option value="4">Mastodontica (4×4)</option></select>
        <label>Nascosto</label><label style="justify-content:flex-start"><input type="checkbox" name="nasc"> visibile solo a me</label></div>
      <menu><button value="cancel" class="btn ghost">Chiudi</button></menu></form>`, 'wide');
    d.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { d.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('on', x === b)); d.querySelectorAll('[data-p]').forEach(p => p.hidden = p.dataset.p !== b.dataset.tab); });
    const q = d.querySelector('[data-p=png] input'); q.oninput = () => { const s = norm(q.value); d.querySelectorAll('[data-p=png] [data-i]').forEach(b => b.hidden = !!s && !norm(b.textContent).includes(s)); };
    let colore = COLORI[0];
    d.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { colore = b.dataset.c; d.querySelectorAll('[data-c]').forEach(x => x.setAttribute('aria-pressed', x === b)); });
    const metti = async o => {
      const st = $('#tv-stage').getBoundingClientRect(), mis = +d.querySelector('[name=mis]').value, lato = mis * sc.griglia;
      // al centro di ciò che si sta guardando, un po' sfalsati se se ne aggiungono tanti
      const n = [...T.tok.values()].filter(t => t.scena === sc.id).length % 5;
      const cx = (st.width / 2 - T.view.x) / T.view.z - lato / 2 + n * sc.griglia * 0.5, cy = (st.height / 2 - T.view.y) / T.view.z - lato / 2;
      const row = { scena: sc.id, nome: o.nome, immagine: o.img || null, colore: o.colore, misura: mis, giocatore: o.giocatore || null, scheda: o.scheda || null, nascosto: d.querySelector('[name=nasc]').checked,
        x: aggancia(clamp(cx, 0, sc.larghezza - lato), sc.griglia_x, mis), y: aggancia(clamp(cy, 0, sc.altezza - lato), sc.griglia_y, mis) };
      const r = await SB.from('tavolo_token').insert(row).select().single();
      if (r.error) return toast(r.error.message, 'err');
      T.tok.set(r.data.id, r.data); disegnaToken(); toast('Token aggiunto: ' + (o.nome || 'senza nome'));
    };
    d.querySelectorAll('[data-i]').forEach(b => b.onclick = () => metti(tutti[+b.dataset.i]).catch(e => toast(e.message, 'err')));
    d.querySelector('[data-k=crea]').onclick = async () => {
      const f = d.querySelector('[name=img]').files[0];
      try { await metti({ nome: d.querySelector('[name=nome]').value.trim(), colore, img: f ? await immagineToken(f) : null }); d.querySelector('[name=nome]').value = ''; d.querySelector('[name=img]').value = ''; }
      catch (e) { toast(e.message, 'err'); }
    };
  }

  /* ---------- scene (DM) ---------- */
  function dlgScene() {
    const d = openDlg(`<form method="dialog"><h3>Scene</h3><p class="hint" style="margin-top:0">Una scena è una mappa con i suoi token. I giocatori vedono solo quella segnata ●, le altre le prepari in anticipo.</p>
      <div id="tv-scl"></div>
      <h4 style="margin:16px 0 4px">Nuova scena</h4>
      <div class="tv-f"><label>Nome</label><input name="nome" maxlength="80" placeholder="Es. Agguato sulla strada">
        <label>Mappa</label><select name="src"><option value="file">Carica un'immagine</option>${S.maps.length ? '<option value="sito">Una mappa del sito</option>' : ''}<option value="vuota">Nessuna (solo griglia)</option></select>
        <label data-s="file">File</label><input data-s="file" type="file" name="file" accept="image/*">
        <label data-s="sito" hidden>Mappa</label><select data-s="sito" name="mappa" hidden>${S.maps.map(m => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('')}</select>
        <label data-s="vuota" hidden>Caselle</label><span data-s="vuota" hidden><input type="number" name="cw" value="30" min="5" max="200" style="width:70px"> × <input type="number" name="ch" value="20" min="5" max="200" style="width:70px"></span></div>
      <p class="hint" id="tv-scm"></p>
      <menu><button value="cancel" class="btn ghost">Chiudi</button><button type="button" class="btn primary" data-k="crea">Crea la scena</button></menu></form>`, 'wide');
    const src = d.querySelector('[name=src]');
    src.onchange = () => d.querySelectorAll('[data-s]').forEach(x => x.hidden = x.dataset.s !== src.value);
    const lista = () => {
      const att = T.stato.scena;
      d.querySelector('#tv-scl').innerHTML = [...T.scene.values()].map(s => `<div class="tv-sc" data-id="${s.id}">${s.mappa ? '<img alt="">' : '<span class="ph"></span>'}<div><b>${s.id === att ? '● ' : ''}${esc(s.nome)}</b><small>${s.id === att ? 'La vedono i giocatori' : 'In preparazione'} · ${[...T.tok.values()].filter(t => t.scena === s.id).length} token</small></div>
        <button type="button" class="btn sm" data-k="apri">Apri</button>${s.id === att ? '' : '<button type="button" class="btn sm" data-k="porta">Porta qui i giocatori</button>'}<button type="button" class="btn sm" data-k="nome" title="Rinomina">✎</button><button type="button" class="btn sm danger" data-k="via" title="Elimina">✕</button></div>`).join('') || '<p class="hint">Nessuna scena ancora.</p>';
      d.querySelectorAll('.tv-sc').forEach(row => {
        const s = T.scene.get(row.dataset.id), im = row.querySelector('img');
        if (im) urlMappa(s.mappa).then(u => im.src = u).catch(() => { });
        row.querySelector('[data-k=apri]').onclick = () => { T.vista = s.id; d.close(); disegnaBarra(); mostraScena(true); };
        const porta = row.querySelector('[data-k=porta]');
        if (porta) porta.onclick = async () => { chk(await SB.from('tavolo_stato').update({ scena: s.id }).eq('id', 1)); T.stato.scena = s.id; T.vista = s.id; lista(); disegnaBarra(); mostraScena(true); toast('I giocatori ora vedono: ' + s.nome); };
        row.querySelector('[data-k=nome]').onclick = async () => { const n = prompt('Nome della scena', s.nome); if (!n?.trim()) return; const r = await SB.from('tavolo_scene').update({ nome: n.trim() }).eq('id', s.id).select().single(); if (r.error) return toast(r.error.message, 'err'); T.scene.set(s.id, r.data); lista(); disegnaBarra(); };
        row.querySelector('[data-k=via]').onclick = async () => {
          if (!await ask(`Eliminare la scena **${s.nome}** con tutti i suoi token?`, { ok: 'Elimina', danger: true, title: 'Elimina scena' })) return;
          const r = await SB.from('tavolo_scene').delete().eq('id', s.id); if (r.error) return toast(r.error.message, 'err');
          if (s.mappa) SB.storage.from(BUCKET).remove([s.mappa]).catch(() => { });
          T.scene.delete(s.id); for (const t of [...T.tok.values()]) if (t.scena === s.id) T.tok.delete(t.id);
          if (T.stato.scena === s.id) T.stato.scena = null;
          if (T.vista === s.id) { T.vista = T.stato.scena || [...T.scene.keys()][0] || null; mostraScena(true); }
          lista(); disegnaBarra();
        };
      });
    };
    lista();
    d.querySelector('[data-k=crea]').onclick = async ev => {
      const b = ev.currentTarget, msg = d.querySelector('#tv-scm'), nome = d.querySelector('[name=nome]').value.trim();
      if (!nome) { msg.textContent = 'Dai un nome alla scena.'; return; }
      b.disabled = true; msg.textContent = 'Preparo la scena…';
      try {
        const row = { nome, griglia: 70 };
        let blob = null;
        if (src.value === 'file') { const f = d.querySelector('[name=file]').files[0]; if (!f) throw new Error('Scegli l\'immagine della mappa.'); const im = await processImage(f, 6000); blob = im.blob; row.larghezza = im.w; row.altezza = im.h; }
        else if (src.value === 'sito') { const m = S.maps.find(x => x.id === d.querySelector('[name=mappa]').value); const rec = await dbGet('blobs', m.id); if (!rec?.blob) throw new Error('Immagine della mappa non trovata.'); blob = rec.blob; row.larghezza = +m.w || 2000; row.altezza = +m.h || 1400; }
        else { row.larghezza = clamp(+d.querySelector('[name=cw]').value || 30, 5, 200) * 70; row.altezza = clamp(+d.querySelector('[name=ch]').value || 20, 5, 200) * 70; }
        if (blob) {
          msg.textContent = 'Carico la mappa (' + fmtSize(blob.size) + ')…';
          const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg'), path = 'scene/' + crypto.randomUUID() + '.' + ext;
          const up = await SB.storage.from(BUCKET).upload(path, blob, { contentType: blob.type || 'image/jpeg' });
          if (up.error) throw new Error(up.error.message);
          row.mappa = path;
          // una casella ogni ~70 px è la misura più comune delle mappe da combattimento; si regola dopo da «Griglia»
        }
        const r = await SB.from('tavolo_scene').insert(row).select().single();
        if (r.error) throw new Error(r.error.message);
        T.scene.set(r.data.id, r.data);
        if (!T.stato.scena) { chk(await SB.from('tavolo_stato').update({ scena: r.data.id }).eq('id', 1)); T.stato.scena = r.data.id; }
        T.vista = r.data.id; d.close(); disegnaBarra(); mostraScena(true);
        toast('Scena creata: regola la griglia se non combacia con la mappa.');
      } catch (e) { msg.textContent = e.tv ? ERR[e.tv][0] : e.message; b.disabled = false; }
    };
  }

  /* ---------- griglia (DM) ---------- */
  function dlgGriglia() {
    const sc = scena(); if (!sc) return;
    const prima = { ...sc };
    const d = openDlg(`<form method="dialog"><h3>Griglia</h3><p class="hint" style="margin-top:0">Cambia i valori guardando la mappa: la griglia si aggiorna subito. Fai combaciare una casella con un quadretto della mappa.</p>
      <div class="tv-f"><label>Casella (px)</label><span style="display:flex;gap:8px;align-items:center"><input type="range" name="g" min="10" max="300" step="0.5" value="${sc.griglia}" style="flex:1"><input type="number" name="gn" min="8" max="600" step="0.5" value="${sc.griglia}" style="width:80px"></span>
        <label>Sposta ↔</label><input type="range" name="gx" min="0" max="${sc.griglia}" step="0.5" value="${((sc.griglia_x % sc.griglia) + sc.griglia) % sc.griglia}">
        <label>Sposta ↕</label><input type="range" name="gy" min="0" max="${sc.griglia}" step="0.5" value="${((sc.griglia_y % sc.griglia) + sc.griglia) % sc.griglia}">
        <label>Metri per casella</label><input type="number" name="m" min="0.1" max="1000" step="0.1" value="${sc.metri}">
        <label>Mostra la griglia</label><label style="justify-content:flex-start"><input type="checkbox" name="vis" ${sc.griglia_visibile ? 'checked' : ''}> sì</label></div>
      <menu><button value="cancel" class="btn ghost">Annulla</button><button value="ok" class="btn primary">Salva</button></menu></form>`, 'tv-gd');
    const v = n => d.querySelector(`[name=${n}]`);
    const prova = () => {
      sc.griglia = clamp(+v('gn').value || sc.griglia, 8, 600); sc.griglia_x = +v('gx').value; sc.griglia_y = +v('gy').value; sc.metri = +v('m').value || 1.5; sc.griglia_visibile = v('vis').checked;
      v('gx').max = v('gy').max = sc.griglia; disegnaGriglia(); disegnaToken();
    };
    v('g').oninput = () => { v('gn').value = v('g').value; prova(); };
    v('gn').oninput = () => { v('g').value = v('gn').value; prova(); };
    ['gx', 'gy', 'm', 'vis'].forEach(n => v(n).oninput = prova);
    d.addEventListener('close', async () => {
      if (d.returnValue !== 'ok') { Object.assign(sc, prima); disegnaGriglia(); disegnaToken(); return; }
      const ch = { griglia: sc.griglia, griglia_x: sc.griglia_x, griglia_y: sc.griglia_y, metri: sc.metri, griglia_visibile: sc.griglia_visibile };
      const r = await SB.from('tavolo_scene').update(ch).eq('id', sc.id).select().single();
      if (r.error) { Object.assign(sc, prima); disegnaGriglia(); disegnaToken(); return toast(r.error.message, 'err'); }
      T.scene.set(sc.id, r.data);
      // i token restano sulle loro caselle anche con la griglia nuova
      const sposta = [...T.tok.values()].filter(t => t.scena === sc.id).map(t => ({ t, x: aggancia(t.x, sc.griglia_x, t.misura), y: aggancia(t.y, sc.griglia_y, t.misura) })).filter(o => o.x !== o.t.x || o.y !== o.t.y);
      for (const o of sposta) { o.t.x = o.x; o.t.y = o.y; SB.from('tavolo_token').update({ x: o.x, y: o.y }).eq('id', o.t.id).then(() => { }); }
      disegnaToken(); toast('Griglia salvata.');
    });
  }

  /* ---------- dadi ---------- */
  function disegnaDadi() {
    const box = $('#tv-dice'); if (!box) return;
    if (matchMedia('(min-width:821px)').matches && box.hidden && !T.diceInit) box.hidden = false;
    T.diceInit = true;
    box.innerHTML = `<div class="tv-dh"><span>Dadi</span><button class="btn sm ghost" data-act="tv-dadi" title="Chiudi">✕</button></div><div class="tv-log" id="tv-log"></div>
      <div class="tv-dk"><div class="row">${DADI.map(n => `<button class="btn sm" data-act="tv-d" data-n="${n}">d${n}</button>`).join('')}</div>
      <div class="row"><input type="number" id="tv-mod" placeholder="Mod." style="width:64px" aria-label="Modificatore"><button class="btn sm" data-act="tv-vant" title="2d20, tiene il più alto">Vantaggio</button><button class="btn sm" data-act="tv-svant" title="2d20, tiene il più basso">Svantaggio</button></div>
      <div class="row"><input type="text" id="tv-f" placeholder="Es. 2d6+3 o 4d6kh3" style="flex:1" autocomplete="off" aria-label="Formula"><button class="btn sm primary" data-act="tv-tira" style="flex:none">Tira</button></div>
      <div class="row"><input type="text" id="tv-mot" placeholder="Per cosa? (facoltativo)" style="flex:1" maxlength="80" aria-label="Motivo"></div>
      ${isDM() ? '<label><input type="checkbox" id="tv-priv"> Tiro nascosto (solo io)</label>' : ''}</div>`;
    $('#tv-f').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); tira($('#tv-f').value); } };
    disegnaBarra(); disegnaLog();
  }
  const conMod = f => { const m = Math.trunc(+$('#tv-mod')?.value || 0); return m ? f + (m > 0 ? '+' : '') + m : f; };
  function dadiActs() {
    return {
      'tv-d': b => tira(conMod('1d' + b.dataset.n)),
      'tv-vant': () => tira(conMod('2d20kh1'), 'vantaggio'), 'tv-svant': () => tira(conMod('2d20kl1'), 'svantaggio'),
      'tv-tira': () => tira($('#tv-f').value)
    };
  }
  async function tira(formula, extra) {
    formula = String(formula || '').trim(); if (!formula) return;
    const mot = [$('#tv-mot')?.value.trim(), extra].filter(Boolean).join(' · ');
    const r = await SB.rpc('tavolo_tira', { p_formula: formula, p_motivo: mot || null, p_privato: !!$('#tv-priv')?.checked });
    if (r.error) return toast(r.error.message, 'err');
    const t = Array.isArray(r.data) ? r.data[0] : r.data;
    if ($('#tv-mot')) $('#tv-mot').value = '';
    if (t && !T.tiri.some(x => x.id === t.id)) { T.tiri.push(t); nuovoTiro(t); }
  }
  // 20 o 1 naturale su un tiro di d20
  function esito(t) {
    const m = String(t.dettaglio).match(/^(?:\dd20(?:k[hl]1)?) \[(?:[^\]]*→ )?(\d+)\]/);
    return m ? (m[1] === '20' ? 'crit' : m[1] === '1' ? 'fail' : '') : '';
  }
  const rigaTiro = t => `<div class="tv-roll ${esito(t)} ${t.privato ? 'priv' : ''} ${t.autore === T.me.uid ? 'me' : ''}"><div class="h"><span>${esc(t.nome)}${t.privato ? ' 🙈' : ''}</span><small>${new Date(t.creato).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</small></div>
    ${t.motivo ? `<div class="m">${esc(t.motivo)}</div>` : ''}<div class="r"><span class="d">${esc(t.formula)} → ${esc(t.dettaglio)}</span><span class="t">${t.totale}</span></div></div>`;
  function disegnaLog() {
    const l = $('#tv-log'); if (!l) return;
    l.innerHTML = T.tiri.map(rigaTiro).join('') || '<p class="hint">Nessun tiro ancora. I tiri li vedono tutti al tavolo.</p>';
    l.scrollTop = 1e9;
  }
  function nuovoTiro(t) {
    disegnaLog();
    if ($('#tv-dice')?.hidden) toast(`${t.nome}${t.motivo ? ' (' + t.motivo + ')' : ''}: ${t.formula} = ${t.totale}`);
  }
})();

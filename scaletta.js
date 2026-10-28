/* Campagna D&D — «Scaletta»: la sessione da giocare, da consultare durante la partita. Solo per il Dungeon Master.
   Il DM trascina il file della sessione (.md, .txt, .docx o .pdf) o incolla il testo: il sito ne ricava gancio, scene
   (obiettivo, ostacolo, esiti), PNG, sfide e segreti. Si legge nella sua pagina (#/scaletta/<n>) e al Tavolo, nel
   pannello accanto alla chat. Il testo sta nei dati del DM (meta «scaletta:<n>») e copie.js / pubblica.py lo tolgono
   dalle copie dei giocatori e degli ospiti. Le scene già giocate si ricordano in questo browser.
   Usa le funzioni della pagina principale (route, setView, S, md…). */
(() => {
  'use strict';
  const CSS = `.sc-wrap{display:grid;grid-template-columns:230px minmax(0,1fr);gap:24px;align-items:start}
.sc-toc{position:sticky;top:90px;background:var(--paper);border:1px solid var(--line2);border-radius:6px;padding:12px 6px;box-shadow:var(--shadow);max-height:calc(100vh - 110px);overflow-y:auto}
.sc-toc a{display:flex;gap:8px;align-items:baseline;padding:6px 10px;border-radius:4px;color:var(--ink);text-decoration:none;font-size:.98rem;line-height:1.25}
.sc-toc a:hover{background:var(--paper2)}
.sc-toc a.on{background:#c9a24b2e;color:var(--wine);font-weight:700}
.sc-toc a .ck{width:16px;flex:none;text-align:center;color:var(--mute);font-weight:700}
.sc-toc a.ok .ck{color:var(--ok)}
.sc-toc a.ok{color:var(--mute)}
.sc-toc hr{border:0;border-top:1px solid var(--line);margin:6px 8px}
.sc-toc small{display:block;padding:2px 10px 4px;font:600 .62rem/1.3 var(--display);letter-spacing:.1em;color:var(--mute);text-transform:uppercase}
.sc-prog{height:6px;border-radius:4px;background:var(--line);margin:4px 10px 10px;overflow:hidden}.sc-prog i{display:block;height:100%;background:var(--gold)}
.sc-kick{font:600 .72rem/1 var(--display);letter-spacing:.12em;color:var(--gold);text-transform:uppercase;margin-bottom:6px}
.sc-box{background:var(--paper);border:1px solid var(--line2);border-radius:6px;padding:12px 18px;margin-bottom:14px;box-shadow:var(--shadow);scroll-margin-top:90px}
.sc-box>h3{margin:0 0 6px;font:600 1rem/1.2 var(--display);color:var(--wine);letter-spacing:.04em;text-transform:uppercase}
:root[data-theme=dark] .sc-box>h3,:root[data-theme=dark] .sc-sc summary b{color:var(--gold2)}
.sc-box .prose>:first-child,.sc-sc .prose>:first-child{margin-top:0}.sc-box .prose>:last-child,.sc-sc .prose>:last-child{margin-bottom:0}
.sc-sc{background:var(--paper);border:1px solid var(--line2);border-radius:6px;margin:0 0 12px;box-shadow:var(--shadow);overflow:hidden;scroll-margin-top:90px}
.sc-sc>summary{list-style:none;display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;background:var(--paper2);border-bottom:1px solid transparent}
.sc-sc[open]>summary{border-bottom-color:var(--line)}
.sc-sc>summary::-webkit-details-marker{display:none}
.sc-sc .num{width:28px;height:28px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;background:var(--wine);color:#fff;font:700 .9rem/1 var(--display)}
.sc-sc summary b{font:600 1.08rem/1.2 var(--display);color:var(--wine);flex:1}
.sc-sc .st{font-size:.75rem;padding:1px 8px;border-radius:10px;border:1px solid var(--line2);white-space:nowrap}
.sc-sc.ok{opacity:.65}.sc-sc.ok .num{background:var(--ok)}.sc-sc.ok .st{color:var(--ok);border-color:var(--ok)}
.sc-sc.ora{border:2px solid var(--gold);box-shadow:0 0 0 3px #c9a24b33,var(--shadow)}
.sc-sc.ora .st{background:var(--gold);color:#fff;border-color:var(--gold)}
.sc-dl{margin:0;padding:10px 16px 4px;display:grid;grid-template-columns:auto minmax(0,1fr);gap:6px 14px}
.sc-dl dt{font:600 .7rem/1.9 var(--display);letter-spacing:.08em;text-transform:uppercase;color:var(--gold)}
.sc-dl dd{margin:0}
.sc-pre{padding:10px 16px 0}
.sc-foot{display:flex;gap:8px;padding:6px 16px 12px;justify-content:flex-end}
.sc-cd{display:inline-block;padding:0 7px;border-radius:10px;background:#c9a24b26;border:1px solid #a9833488;color:#6b4d12;font-weight:700;font-size:.92em;white-space:nowrap;line-height:1.35}
:root[data-theme=dark] .sc-cd{color:var(--gold2)}
.sc-dado{all:unset;display:inline-block;padding:0 7px;border-radius:10px;background:#7d253014;border:1px solid #7d253055;color:var(--wine2);font-weight:700;font-size:.92em;white-space:nowrap;line-height:1.35}
button.sc-dado{cursor:pointer}button.sc-dado:hover{background:var(--wine);color:#fff}
.sc-list .card{display:flex;gap:16px;align-items:center;flex-wrap:wrap;border:2px dashed #7a3d8a88;background:#7a3d8a0a}
.sc-list .n{font:700 2rem/1 var(--display);color:#7a3d8a}
.sc-list .k{font:600 .7rem/1.4 var(--display);letter-spacing:.12em;color:#7a3d8a;text-transform:uppercase}
.sc-list .t{font:600 1.25rem/1.3 var(--display);color:var(--wine);margin:2px 0;text-decoration:none;display:block}
:root[data-theme=dark] .sc-list .t{color:var(--gold2)}
.sc-list .h{color:var(--mute);font-size:.95rem}
.sc-chips{display:none}
.sc-drop{display:block;border:2px dashed var(--line2);border-radius:8px;padding:22px 14px;text-align:center;background:var(--paper2);cursor:pointer;margin:4px 0 12px;transition:background .15s,border-color .15s}
.sc-drop.over{border-color:var(--wine);background:#7d253014}
.sc-drop b{display:block;font:600 1.05rem/1.3 var(--display);color:var(--wine);margin-bottom:4px}
.sc-drop input{display:none}
.sc-ok{margin:8px 0 4px;padding:8px 12px;border:1px solid #3f6b4666;background:#3f6b4612;border-radius:5px;font-size:.95rem}
.sc-ok.ko{border-color:#a8641c66;background:#a8641c12}
dialog .sc-txt{width:100%;min-height:200px;font:13px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.sc-row{display:flex;gap:10px}.sc-row>label:first-child{flex:0 0 96px}.sc-row>label:last-child{flex:1}
@media (max-width:760px){
  .sc-wrap{display:block}.sc-toc{display:none}
  .sc-chips{display:flex;gap:6px;overflow-x:auto;padding:8px 2px 10px;scrollbar-width:none;position:sticky;top:56px;z-index:5;background:var(--bg);margin:0 -2px 6px}
  .sc-chips::-webkit-scrollbar{display:none}
  .sc-chips a{flex:none;padding:5px 11px;border-radius:14px;border:1px solid var(--line2);background:var(--paper);font-size:.88rem;white-space:nowrap;color:var(--ink);text-decoration:none}
  .sc-chips a.on{background:var(--wine);color:#fff;border-color:var(--wine)}
  .sc-chips a.ok{color:var(--ok);border-color:var(--ok)}
  .sc-dl{grid-template-columns:1fr;gap:0}.sc-dl dt{margin-top:4px}
  .sc-box{padding:12px 14px}
}
/* al Tavolo: pannello accanto alla chat */
.scp{padding:10px 12px 14px;font-size:.97rem}
.scp-sel{display:flex;gap:6px;align-items:center;margin-bottom:8px}
.scp-sel select{flex:1;min-width:0}
.scp-sel a{font-size:.85rem;white-space:nowrap}
.scp-nav{display:flex;gap:4px;margin:0 0 10px}
.scp-nav button{all:unset;flex:1;text-align:center;padding:6px 0;border-radius:4px;border:1px solid var(--line2);background:var(--paper2);font:700 .85rem/1 var(--display);cursor:pointer;color:var(--ink)}
.scp-nav button.ok{background:#3f6b4622;color:var(--ok);border-color:#3f6b4688}
.scp-nav button.on{background:var(--wine);color:#fff;border-color:var(--wine)}
.scp .sc-sc{box-shadow:none}
.scp .sc-dl{grid-template-columns:1fr;gap:0;padding:8px 12px 2px}.scp .sc-dl dt{margin-top:4px}
.scp .sc-pre{padding:8px 12px 0}.scp .sc-foot{padding:6px 12px 10px}
.scp-acc{border:1px solid var(--line2);border-radius:5px;margin-bottom:6px;background:var(--paper2)}
.scp-acc>summary{padding:8px 11px;font:600 .78rem/1.2 var(--display);letter-spacing:.06em;text-transform:uppercase;color:var(--wine);cursor:pointer}
:root[data-theme=dark] .scp-acc>summary{color:var(--gold2)}
.scp-acc>div{padding:0 12px 10px;font-size:.94rem}
.scp-acc .prose p{margin:.3em 0}
.scp-pop{position:fixed;z-index:70;width:min(300px,calc(100vw - 20px));background:var(--paper);border:1px solid var(--line2);border-radius:6px;box-shadow:0 10px 30px #0008;padding:10px 12px;font-size:.93rem;color:var(--ink)}
.scp-pop .h{display:flex;gap:8px;align-items:center;margin-bottom:4px}.scp-pop img{width:40px;height:40px;border-radius:50%;object-fit:cover;border:1px solid var(--gold)}
.scp-pop b{font-family:var(--display);color:var(--wine);flex:1}
.scp-vuota{padding:16px 14px;color:var(--mute);line-height:1.45}`;
  let cssDone = false;
  const css = () => { if (cssDone) return; cssDone = true; const s = document.createElement('style'); s.textContent = CSS; document.head.append(s); };

  /* ---------- dati ---------- */
  const KEY = n => 'scaletta:' + n;
  const tutte = () => Object.entries(S.meta).filter(([k]) => k.startsWith('scaletta:')).map(([, v]) => v).sort((a, b) => b.n - a.n);
  const una = n => S.meta[KEY(n)] || null;
  // da giocare: la sessione non c'è ancora, o si è interrotta a metà
  const daGiocare = v => { const s = sessOf(v.n); return !s || !!s.ongoing; };
  const ls = { get: (k, d) => { try { const v = localStorage.getItem('cr-' + k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set: (k, v) => { try { localStorage.setItem('cr-' + k, JSON.stringify(v)); } catch { } } };
  const fatte = n => new Set(ls.get('scaletta-fatte-' + n, []));
  const segna = (n, i, on) => { const f = fatte(n); if (on) f.add(i); else f.delete(i); ls.set('scaletta-fatte-' + n, [...f].sort((a, b) => a - b)); };

  /* ---------- dal testo alla scaletta ---------- */
  const nudo = t => String(t || '').replace(/\*+/g, '').replace(/[.:]\s*$/, '').trim();
  const dedent = righe => { const m = Math.min(...righe.filter(r => r.trim()).map(r => r.match(/^\s*/)[0].length)); return righe.map(r => r.slice(Number.isFinite(m) ? m : 0)).join('\n').trim(); };
  const CAMPI = [['obiettivo', /^obiettiv/i], ['ostacolo', /^ostacol/i], ['esiti', /^esit/i]];
  function scena(titolo, corpo) {
    // *Obiettivo:* … *Ostacolo:* … *Esiti:* … (anche in grassetto o senza asterischi)
    const rx = /(\*{1,2})?\b(Obiettiv[oi]|Ostacol[oi]|Esit[oi])\s*:\s*\1?/gi, pezzi = []; let m, pre = corpo, ultimo = null;
    while ((m = rx.exec(corpo))) {
      if (ultimo) ultimo.fine = m.index; else pre = corpo.slice(0, m.index);
      ultimo = { k: CAMPI.find(c => c[1].test(m[2]))[0], ini: m.index + m[0].length }; pezzi.push(ultimo);
    }
    const campi = {}; for (const p of pezzi) campi[p.k] = (campi[p.k] ? campi[p.k] + '\n\n' : '') + dedent(corpo.slice(p.ini, p.fine ?? corpo.length).split('\n'));
    return { t: nudo(titolo) || 'Scena', pre: dedent(pre.split('\n')), ...campi };
  }
  // elenco di scene: «1. **Titolo.** testo…» (o «- **Titolo.**»), con le righe rientrate che appartengono alla scena
  function elencoScene(corpo) {
    const out = []; let cur = null;
    for (const r of corpo.split('\n')) {
      const m = r.match(/^(?:\d+[.)]|[-*•])\s+(.*)$/);
      if (m) { cur = { r: [m[1]] }; out.push(cur); } else if (cur) cur.r.push(r);
    }
    // quasi tutte le scene iniziano col titolo in grassetto: un punto senza grassetto è il seguito della scena prima
    // (da Word i paragrafi dentro un elemento dell'elenco arrivano come elementi a sé)
    const gr = out.filter(x => x.r[0].startsWith('**')).length;
    if (gr >= out.length * .6) for (let i = out.length - 1; i > 0; i--) if (!out[i].r[0].startsWith('**')) { out[i - 1].r.push('', ...out[i].r); out.splice(i, 1); }
    return out.map(x => {
      const prima = x.r[0]; let t, resto;
      const b = prima.match(/^\*\*(.+?)\*\*\s*(.*)$/);
      if (b) { t = b[1]; resto = b[2]; }
      else { const p = prima.match(/^(.{3,80}?)[.:]\s+(.*)$/); if (p) { t = p[1]; resto = p[2]; } else { t = prima; resto = ''; } }
      return scena(t, [resto, ...x.r.slice(1)].join('\n'));
    });
  }
  function analizza(testo) {
    const righe = String(testo || '').replace(/\r/g, '').split('\n');
    const tit = righe.map((r, i) => [r.match(/^(#{1,4})\s+(.+)/), i]).filter(x => x[0]);
    let titolo = '', da = 0;
    const primo = righe.findIndex(r => r.trim());
    if (tit.length && tit[0][1] === primo) {
      const liv = tit[0][0][1].length, altri = tit.slice(1).map(x => x[0][1].length);
      if (liv === 1 || !altri.length || liv < Math.min(...altri)) { titolo = nudo(tit[0][0][2]); da = primo + 1; }
    }
    const sez = [{ t: '', r: [] }];
    for (const r of righe.slice(da)) { const m = r.match(/^#{1,4}\s+(.+)/); if (m) sez.push({ t: nudo(m[1]), r: [] }); else sez[sez.length - 1].r.push(r); }
    const intro = sez.shift().r.join('\n').trim();
    const out = { titolo, sezioni: [], scene: [] };
    if (intro) out.sezioni.push({ t: '', md: intro });
    let posto = false; // dove stanno le scene, nell'ordine del testo
    const mettiScene = () => { if (!posto) { out.sezioni.push({ t: 'Scene', scene: true }); posto = true; } };
    for (const s of sez) {
      const corpo = s.r.join('\n').trim();
      const ms = s.t.match(/^scena\s*(\d+)?\s*[:.\-–—]?\s*(.*)$/i);
      if (ms) { mettiScene(); out.scene.push(scena(ms[2] || s.t, corpo)); continue; }
      if (/^scene\b/i.test(s.t)) { const l = elencoScene(corpo); if (l.length) { mettiScene(); out.scene.push(...l); continue; } }
      if (corpo || s.t) out.sezioni.push({ t: s.t, md: corpo });
    }
    return out;
  }

  /* ---------- dai file al testo ---------- */
  const caricaJs = (() => { const p = {}; return src => p[src] || (p[src] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => { delete p[src]; rej(new Error('Per leggere i PDF serve internet.')); }; document.head.append(s); })); })();
  const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/';
  // riga tutta in grassetto e corta: in Word e nei PDF spesso è un titolo scritto a mano
  const titoletto = t => /^\*\*[^*]{2,60}\*\*:?$/.test(t.trim()) && !/[.;]\*\*$/.test(t.trim());
  function docxMd(xml) {
    const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const el = (n, k) => n.getElementsByTagNameNS(W, k)[0];
    const acceso = e => !!e && !['false', '0', 'none'].includes(e.getAttributeNS(W, 'val'));
    const out = [];
    for (const p of doc.getElementsByTagNameNS(W, 'body')[0]?.getElementsByTagNameNS(W, 'p') || []) {
      let txt = '', stile = null, buf = '';
      const chiudi = () => {
        if (!buf) return; const core = buf.trim();
        if (!core) { txt += buf; buf = ''; return; }
        const pre = buf.match(/^\s*/)[0], post = buf.match(/\s*$/)[0], seg = stile === 'bi' ? '***' : stile === 'b' ? '**' : stile === 'i' ? '*' : '';
        txt += pre + seg + core + seg + post; buf = '';
      };
      for (const r of p.getElementsByTagNameNS(W, 'r')) {
        const rp = el(r, 'rPr'), f = (rp && acceso(el(rp, 'b')) ? 'b' : '') + (rp && acceso(el(rp, 'i')) ? 'i' : '');
        let t = ''; for (const c of r.childNodes) t += c.localName === 't' ? c.textContent : c.localName === 'tab' ? '\t' : c.localName === 'br' ? '\n' : '';
        if (!t) continue;
        if (f !== stile) { chiudi(); stile = f; } buf += t;
      }
      chiudi(); txt = txt.replace(/\*\*\*\*/g, '').trim();
      const ps = el(p, 'pPr'), st = ps && el(ps, 'pStyle')?.getAttributeNS(W, 'val') || '', np = ps && el(ps, 'numPr');
      const h = st.match(/^(?:heading|titolo|intestazione)\s*(\d)$/i);
      if (!txt) { out.push(''); continue; }
      if (/^(title|titolo)$/i.test(st)) out.push('# ' + nudo(txt));
      else if (h) out.push('#'.repeat(Math.min(+h[1] + 1, 4)) + ' ' + nudo(txt));
      else if (np || /^(list|elenco)/i.test(st)) { const lv = np ? +(el(np, 'ilvl')?.getAttributeNS(W, 'val') || 0) : Math.max(0, (+st.match(/(\d)$/)?.[1] || 1) - 1); out.push('  '.repeat(lv) + (/^\d+[.)]\s/.test(txt) ? '' : '- ') + txt); }
      else if (titoletto(txt)) out.push('### ' + nudo(txt));
      else out.push(txt);
    }
    return unisci(out);
  }
  // righe → testo: gli elementi di un elenco restano attaccati, il resto è separato da una riga vuota
  const unisci = righe => righe.reduce((a, r) => { const lista = /^\s*(?:[-*•]|\d+[.)])\s/.test(r), prima = a[a.length - 1]; if (a.length && !(lista && prima?.lista)) a.push({ t: '' }); a.push({ t: r, lista }); return a; }, []).map(x => x.t).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  async function pdfMd(file) {
    if (!window.pdfjsLib) { await caricaJs(PDFJS + 'pdf.min.js'); window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; }
    const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const linee = [];
    for (let pg = 1; pg <= pdf.numPages; pg++) {
      const page = await pdf.getPage(pg), tc = await page.getTextContent();
      let nomi = {}; try { await page.getOperatorList(); for (const it of tc.items) if (it.fontName && !(it.fontName in nomi)) nomi[it.fontName] = page.commonObjs.get(it.fontName)?.name || ''; } catch { nomi = {}; }
      const its = tc.items.filter(it => it.str !== undefined).map(it => ({ s: it.str, x: it.transform[4], y: it.transform[5], h: Math.hypot(it.transform[2], it.transform[3]) || it.height || 10, w: it.width, b: /bold|black|heavy|semibold|demi/i.test(nomi[it.fontName] || '') }));
      its.sort((a, b) => b.y - a.y || a.x - b.x);
      let cur = null;
      for (const it of its) {
        if (!it.s.trim() && !cur) continue;
        if (cur && Math.abs(it.y - cur.y) < Math.max(cur.h, it.h) * .5) {
          const gap = it.x - cur.fx; if (gap > it.h * .2 && !/\s$/.test(cur.s) && !/^\s/.test(it.s)) cur.s += ' ';
          cur.parti.push(it); cur.s += it.s; cur.fx = it.x + it.w; cur.h = Math.max(cur.h, it.h);
        } else { cur = { s: it.s, x: it.x, y: it.y, h: it.h, fx: it.x + it.w, pg, parti: [it] }; linee.push(cur); }
      }
    }
    const ls2 = linee.map(l => ({ ...l, s: l.s.replace(/\s+/g, ' ').trim(), b: l.parti.filter(p => p.s.trim()).every(p => p.b) })).filter(l => l.s && !/^\d{1,3}$/.test(l.s));
    if (!ls2.length) throw new Error('Nel PDF non c\'è testo da leggere (forse è una scansione): incolla il testo a mano.');
    const peso = {}; for (const l of ls2) { const k = Math.round(l.h * 2) / 2; peso[k] = (peso[k] || 0) + l.s.length; }
    const corpo = +Object.entries(peso).sort((a, b) => b[1] - a[1])[0][0];
    const grandi = [...new Set(ls2.filter(l => l.h > corpo * 1.12).map(l => Math.round(l.h)))].sort((a, b) => b - a);
    const bx = Math.min(...ls2.map(l => l.x));
    const out = []; let prev = null;
    for (const l of ls2) {
      const lv = grandi.indexOf(Math.round(l.h));
      const lista = l.s.match(/^([•●▪◦‣–\-*\uF000-\uF0FF])\s*(.*)$/), num = /^\d+[.)]\s/.test(l.s);
      let riga = null;
      if (l.h > corpo * 1.12) riga = '#'.repeat(Math.min(lv + 2, 4)) + ' ' + l.s;
      else if (l.b && l.s.length < 60 && !/[.;]$/.test(l.s) && !(prev && prev.pg === l.pg && prev.y - l.y < l.h * 1.5 && !prev.tit)) riga = '### ' + l.s;
      else if (lista) riga = (l.x > bx + 12 ? '  ' : '') + '- ' + lista[2];
      else if (num) riga = l.s;
      if (riga) { out.push(riga); prev = { ...l, tit: riga.startsWith('#') }; continue; }
      const vicino = prev && !prev.tit && (prev.pg === l.pg ? prev.y - l.y < l.h * 1.7 : !/[.!?»"]$/.test(out[out.length - 1] || ''));
      if (vicino) { const u = out.length - 1; out[u] = /\p{L}-$/u.test(out[u]) ? out[u].slice(0, -1) + l.s : out[u] + ' ' + l.s; }
      else out.push(l.s);
      prev = { ...l, tit: false };
    }
    return unisci(out);
  }
  async function leggiFile(f) {
    const n = f.name.toLowerCase();
    if (n.endsWith('.docx')) return docxMd(await docxXml(f));
    if (n.endsWith('.pdf')) return pdfMd(f);
    if (n.endsWith('.doc')) throw new Error('Il vecchio formato .doc non si legge: in Word scegli «Salva con nome» → .docx.');
    return (await f.text()).replace(/^﻿/, '').trim();
  }

  /* ---------- disegno ---------- */
  // prova di dado e classe difficoltà ben visibili; i dadi al Tavolo si tirano (nascosti) con un tocco
  function chip(h, dadi) {
    return h.split(/(<[^>]+>)/).map((p, i) => i % 2 ? p : p
      .replace(/\bCD\s?(\d{1,2})\b/g, '<span class="sc-cd">CD $1</span>')
      .replace(/(^|[^\w])(\d{1,2}d(?:4|6|8|10|12|20|100)(?:\s?[+−-]\s?\d{1,2}(?!\d))?)(?![\w])/g, (m, a, f) => a + (dadi ? `<button type="button" class="sc-dado" data-sc-dado="${esc(f.replace(/\s/g, '').replace('−', '-'))}" title="Tira ${esc(f)} (lo vedi solo tu)">🎲 ${f}</button>` : `<span class="sc-dado">🎲 ${f}</span>`))).join('');
  }
  const testo = (t, o = {}) => chip(prose(t), o.dadi);
  // titolo «Esiti» con la sua lista: testo libero
  function cartaScena(x, i, st, o = {}) {
    const dl = CAMPI.filter(([k]) => x[k]).map(([k]) => `<dt>${k === 'obiettivo' ? 'Obiettivo' : k === 'ostacolo' ? 'Ostacolo' : 'Esiti'}</dt><dd>${testo(x[k], o)}</dd>`).join('');
    return `<details class="sc-sc ${st}" id="sc-s${i}" ${o.chiusa ? '' : 'open'}><summary><span class="num">${st === 'ok' ? '✓' : i + 1}</span><b>${esc(x.t)}</b>${st === 'ok' ? '<span class="st">giocata</span>' : st === 'ora' ? '<span class="st">● ora</span>' : ''}</summary>
      ${x.pre ? `<div class="sc-pre">${testo(x.pre, o)}</div>` : ''}${dl ? `<dl class="sc-dl">${dl}</dl>` : ''}
      <div class="sc-foot"><button type="button" class="btn sm" data-act="${o.act || 'scfatta'}" data-i="${i}">${st === 'ok' ? 'Riapri' : '✓ Segna come giocata'}</button></div></details>`;
  }
  const statoScene = (n, scene) => { const f = fatte(n), ora = scene.findIndex((_, i) => !f.has(i)); return scene.map((_, i) => f.has(i) ? 'ok' : i === ora ? 'ora' : ''); };
  const titoloSez = s => s.t || 'In breve';
  const vuoto = v => !v.text?.trim();

  route(/^\/scaletta\/(\d+)$/, async ([ns]) => {
    const n = +ns, v = una(n);
    if (window.__RO || !v) return setView(`<div class="empty"><h2>Scaletta non trovata</h2><a href="#/sessioni">Torna alle sessioni</a></div>`);
    css();
    const a = analizza(v.text), st = statoScene(n, a.scene), s = sessOf(n);
    const nf = st.filter(x => x === 'ok').length;
    const toc = [];
    a.sezioni.forEach((x, k) => { if (x.scene) { toc.push('<hr><small>Scene</small>'); a.scene.forEach((y, i) => toc.push(`<a href="#" data-act="scvai" data-to="sc-s${i}" class="${st[i]}"><span class="ck">${st[i] === 'ok' ? '✓' : st[i] === 'ora' ? '●' : i + 1}</span>${esc(y.t)}</a>`)); toc.push('<hr>'); } else toc.push(`<a href="#" data-act="scvai" data-to="sc-b${k}"><span class="ck">·</span>${esc(titoloSez(x))}</a>`); });
    const chips = [];
    a.sezioni.forEach((x, k) => { if (x.scene) a.scene.forEach((y, i) => chips.push(`<a href="#" data-act="scvai" data-to="sc-s${i}" class="${st[i] === 'ora' ? 'on' : st[i]}">${st[i] === 'ok' ? '✓' : i + 1} ${esc(y.t)}</a>`)); else chips.push(`<a href="#" data-act="scvai" data-to="sc-b${k}">${esc(titoloSez(x))}</a>`); });
    const corpo = a.sezioni.map((x, k) => x.scene ? a.scene.map((y, i) => cartaScena(y, i, st[i], { chiusa: st[i] === 'ok' })).join('') : `<section class="sc-box" id="sc-b${k}">${x.t ? `<h3>${esc(x.t)}</h3>` : ''}${testo(x.md)}</section>`).join('');
    setView(`<div class="pagehead"><div style="flex:1;min-width:220px"><div class="sc-kick">${daGiocare(v) ? 'Da giocare' : 'Giocata'} · scaletta</div><h1><span class="num">${n}.</span> ${esc(v.title || a.titolo || 'Sessione ' + n)} <span class="pill dm">🔒 solo DM</span></h1>
      <div class="hint">${a.scene.length ? `${a.scene.length} scene · ${nf} giocate` : 'Nessuna scena riconosciuta'}${v.file ? ' · dal file ' + esc(v.file) : ''}${s ? ` · <a href="#/sessioni/${n}">Racconto della sessione →</a>` : ''}</div></div>
      <div class="acts"><a class="btn primary" href="#/tavolo" data-act="sctavolo">⚔️ Al Tavolo</a><button class="btn" data-act="scmod">Modifica</button>${moreActs('<button class="btn" data-act="scfile">Sostituisci con un file</button><button class="btn danger" data-act="scdel">Elimina</button>')}</div></div><div class="orn"></div>
      <nav class="sc-chips" aria-label="Parti della scaletta">${chips.join('')}</nav>
      <div class="sc-wrap"><nav class="sc-toc" aria-label="Parti della scaletta"><small>Sessione ${n} · scaletta</small>${a.scene.length ? `<div class="sc-prog"><i style="width:${Math.round(nf / a.scene.length * 100)}%"></i></div>` : ''}${toc.join('').replace(/^<hr>/, '').replace(/<hr>$/, '')}</nav><div>${corpo || '<p class="empty">La scaletta è vuota: usa «Modifica».</p>'}</div></div>`);
    setActs({
      scvai: a2 => { const el = document.getElementById(a2.dataset.to); if (!el) return; if (el.tagName === 'DETAILS') el.open = true; el.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
      scfatta: a2 => { const i = +a2.dataset.i; segna(n, i, !fatte(n).has(i)); rerender(); },
      sctavolo: () => { ls.set('scaletta-tavolo', n); ls.set('scaletta-apri', true); location.hash = '#/tavolo'; },
      scmod: () => dlgScaletta(v),
      scfile: () => dlgScaletta(v, { file: true }),
      scdel: async () => { if (!await ask(`Eliminare la **scaletta della sessione ${n}**? Il racconto della sessione resta.`, { danger: true, ok: 'Elimina' })) return; await runBatch(['meta'], '', async t => t.del('meta', KEY(n))); location.hash = '#/sessioni'; }
    });
  });

  /* ---------- inserire o cambiare la scaletta ---------- */
  function dlgScaletta(cur, o = {}) {
    css();
    const prox = Math.max(lastSessionN() || 0, ...tutte().map(x => x.n)) + 1;
    const d = openDlg(`<form method="dialog"><h3>${cur ? `Scaletta della sessione ${cur.n}` : 'Nuova sessione da giocare'} <span class="pill dm">🔒 solo DM</span></h3>
      <label class="sc-drop" id="sc-drop" tabindex="0"><b>Trascina qui il file della sessione</b><span class="hint">Word (.docx), PDF, .md o .txt, oppure tocca per sceglierlo</span><input type="file" accept=".md,.markdown,.txt,.docx,.pdf,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"></label>
      <div class="sc-row"><label class="f"><span>Numero</span><input type="number" id="sc-n" value="${cur ? cur.n : prox}" ${cur ? 'disabled' : ''} required></label><label class="f"><span>Titolo</span><input type="text" id="sc-t" value="${esc(cur?.title || '')}" autocomplete="off"></label></div>
      <label class="f"><span>Testo della sessione${o.file ? '' : ' (puoi anche incollarlo o correggerlo qui)'}</span><textarea class="sc-txt" id="sc-x" rows="12" placeholder="## Titolo&#10;&#10;**In breve:** …&#10;&#10;### Gancio&#10;…&#10;&#10;### Scene&#10;1. **Prima scena.** *Obiettivo:* … *Ostacolo:* … *Esiti:* …">${esc(cur?.text || '')}</textarea></label>
      <div class="sc-ok" id="sc-ok" hidden></div>
      <menu><button value="cancel" class="btn ghost" formnovalidate>Annulla</button><button value="ok" class="btn primary">${cur ? 'Salva' : 'Crea la scaletta'}</button></menu></form>`, 'wide');
    const x = $('#sc-x', d), t = $('#sc-t', d), ok = $('#sc-ok', d), drop = $('#sc-drop', d), inp = $('input[type=file]', drop);
    let file = cur?.file || '';
    const conta = () => {
      const a = analizza(x.value); if (!x.value.trim()) { ok.hidden = true; return; }
      if (!t.value.trim() && a.titolo) t.value = a.titolo;
      const sez = a.sezioni.filter(s => !s.scene && s.t).map(s => s.t);
      ok.hidden = false; ok.classList.toggle('ko', !a.scene.length);
      ok.innerHTML = a.scene.length ? `✓ Riconosciute <b>${a.scene.length} scene</b>${sez.length ? ` e ${sez.length} parti: ${esc(sez.slice(0, 8).join(', '))}${sez.length > 8 ? '…' : ''}` : ''}.` : `Non ho trovato le scene: scrivile sotto un titolo «Scene» come elenco numerato, oppure con titoli «Scena 1», «Scena 2»… ${sez.length ? `Riconosciute ${sez.length} parti.` : ''}`;
    };
    const carica = async f => {
      if (!f) return;
      drop.querySelector('b').textContent = 'Leggo ' + f.name + '…';
      try { x.value = await leggiFile(f); file = f.name; t.value = ''; conta(); drop.querySelector('b').textContent = '✓ ' + f.name; }
      catch (e) { drop.querySelector('b').textContent = 'Trascina qui il file della sessione'; toast(e.message || String(e), 'err'); }
    };
    inp.onchange = () => carica(inp.files[0]);
    for (const ev of ['dragenter', 'dragover']) d.addEventListener(ev, e => { if (![...(e.dataTransfer?.types || [])].includes('Files')) return; e.preventDefault(); drop.classList.add('over'); });
    d.addEventListener('dragleave', e => { if (!d.contains(e.relatedTarget)) drop.classList.remove('over'); });
    d.addEventListener('drop', e => { if (!e.dataTransfer?.files?.length) return; e.preventDefault(); drop.classList.remove('over'); carica(e.dataTransfer.files[0]); });
    x.oninput = () => { file = cur && !o.file ? cur.file : file; conta(); };
    conta();
    if (o.file) setTimeout(() => inp.click(), 50);
    d.addEventListener('close', async () => {
      if (d.returnValue !== 'ok') return;
      const n = cur ? cur.n : Math.round(+$('#sc-n', d).value);
      if (!n || n < 1) return toast('Numero della sessione non valido', 'err');
      if (!x.value.trim()) return toast('La scaletta è vuota', 'err');
      if (!cur && una(n) && !await ask(`Esiste già una scaletta per la **sessione ${n}**: sostituirla?`, { danger: true, ok: 'Sostituisci' })) return;
      const v = { n, title: t.value.trim() || analizza(x.value).titolo, text: x.value.replace(/\r/g, '').trim(), ts: Date.now(), ...(file ? { file } : {}) };
      try { await setMeta(KEY(n), v); } catch (e) { return toast(e.message || String(e), 'err'); }
      if (cur && cur.text !== v.text) ls.set('scaletta-fatte-' + n, []);
      toast('Scaletta salvata: la vedi solo tu');
      if (location.hash === '#/scaletta/' + n) rerender(); else location.hash = '#/scaletta/' + n;
    });
  }

  /* ---------- in Sessioni ---------- */
  function riquadro() {
    if (window.__RO) return '';
    css();
    const l = tutte().filter(daGiocare).sort((a, b) => a.n - b.n);
    return l.length ? `<div class="sc-list">${l.map(v => { const a = analizza(v.text), f = fatte(v.n).size; return `<div class="card"><div class="n">${v.n}</div><div style="flex:1;min-width:200px"><div class="k">${sessOf(v.n)?.ongoing ? 'In corso' : 'Prossima sessione'} · da giocare <span class="pill dm">🔒 solo DM</span></div><a class="t" href="#/scaletta/${v.n}">${esc(v.title || a.titolo || 'Sessione ' + v.n)}</a><div class="h">${a.scene.length} scene${f ? ` · ${f} giocate` : ''} · i giocatori non la vedono</div></div><a class="btn primary" href="#/scaletta/${v.n}">Apri la scaletta</a><a class="btn" href="#/tavolo" data-act="sctav" data-n="${v.n}">⚔️ Al Tavolo</a></div>`; }).join('')}</div>` : '';
  }
  const acts = () => window.__RO ? {} : { scnuova: () => dlgScaletta(null), sctav: a => { ls.set('scaletta-tavolo', +a.dataset.n); ls.set('scaletta-apri', true); location.hash = '#/tavolo'; } };

  /* ---------- al Tavolo ---------- */
  const POP = { el: null };
  const chiudiPop = () => { POP.el?.remove(); POP.el = null; };
  function pop(a) {
    chiudiPop();
    const id = decodeURIComponent((a.getAttribute('href') || '').replace('#/scheda/', '')), e = S.ents.get(id); if (!e) return;
    const p = document.createElement('div'); p.className = 'scp-pop';
    p.innerHTML = `<div class="h">${e.portrait?.thumb ? `<img src="${e.portrait.thumb}" alt="">` : ''}<b>${esc(e.name)}</b><button type="button" class="tv-cx" aria-label="Chiudi">✕</button></div>${e.brief ? `<div>${esc(e.brief)}</div>` : ''}<div style="margin-top:8px;text-align:right"><a class="btn sm" href="#/scheda/${encodeURIComponent(id)}" target="_blank" rel="noopener">Apri la scheda ↗</a></div>`;
    document.body.append(p); POP.el = p;
    const r = a.getBoundingClientRect(), w = p.offsetWidth, h = p.offsetHeight;
    p.style.left = Math.max(10, Math.min(innerWidth - w - 10, r.left - w / 2 + r.width / 2)) + 'px';
    p.style.top = (r.bottom + h + 8 > innerHeight ? Math.max(10, r.top - h - 6) : r.bottom + 6) + 'px';
    p.querySelector('button').onclick = chiudiPop;
  }
  addEventListener('pointerdown', e => { if (POP.el && !POP.el.contains(e.target) && !e.target.closest('.scp a.xref')) chiudiPop(); }, true);
  addEventListener('hashchange', chiudiPop);
  const PAN = { scena: {} };
  function pannello(host, { tira } = {}) {
    if (!host) return; css();
    const l = tutte();
    if (!l.length) { host.innerHTML = `<div class="scp-vuota">Qui leggi la sessione da giocare mentre sei al Tavolo, e la vedi solo tu.<br><br><a class="btn sm primary" href="#/sessioni" data-sc-nuova>+ Sessione da giocare</a></div>`; host.querySelector('[data-sc-nuova]').onclick = e => { e.preventDefault(); dlgScaletta(null); }; return; }
    let n = ls.get('scaletta-tavolo', null); if (!una(n)) n = (l.filter(daGiocare).sort((a, b) => a.n - b.n)[0] || l[0]).n;
    const v = una(n), a = analizza(v.text), st = statoScene(n, a.scene);
    let i = PAN.scena[n]; if (!(i >= 0 && i < a.scene.length)) i = Math.max(0, st.indexOf('ora'));
    const o = { dadi: !!tira, act: 'x' };
    const sez = a.sezioni.filter(x => !x.scene);
    host.innerHTML = `<div class="scp"><div class="scp-sel">${l.length > 1 ? `<select aria-label="Sessione">${l.map(x => `<option value="${x.n}" ${x.n === n ? 'selected' : ''}>${x.n}. ${esc(x.title || 'Sessione ' + x.n)}</option>`).join('')}</select>` : `<b style="flex:1;font-family:var(--display)">${n}. ${esc(v.title || a.titolo || '')}</b>`}<a href="#/scaletta/${n}" target="_blank" rel="noopener" title="Apri la pagina della scaletta">Pagina ↗</a></div>
      ${a.scene.length ? `<div class="scp-nav" role="tablist">${a.scene.map((x, k) => `<button type="button" data-k="${k}" class="${k === i ? 'on' : st[k]}" title="${esc(x.t)}" aria-label="Scena ${k + 1}: ${esc(x.t)}">${st[k] === 'ok' && k !== i ? '✓' : k + 1}</button>`).join('')}</div>${cartaScena(a.scene[i], i, st[i], o)}` : ''}
      ${a.scene[i + 1] ? `<details class="scp-acc"><summary>Dopo · ${i + 2}. ${esc(a.scene[i + 1].t)}</summary><div>${testo(a.scene[i + 1].obiettivo || a.scene[i + 1].pre || '', o)}</div></details>` : ''}
      ${sez.map(x => `<details class="scp-acc"><summary>${esc(titoloSez(x))}</summary><div>${testo(x.md, o)}</div></details>`).join('')}</div>`;
    const ri = () => pannello(host, { tira });
    host.querySelector('select')?.addEventListener('change', e => { ls.set('scaletta-tavolo', +e.target.value); ri(); });
    host.querySelectorAll('.scp-nav button').forEach(b => b.onclick = () => { PAN.scena[n] = +b.dataset.k; ri(); host.scrollTop = 0; });
    host.querySelectorAll('[data-act=x]').forEach(b => b.onclick = e => {
      e.preventDefault(); e.stopPropagation(); const k = +b.dataset.i, era = fatte(n).has(k); segna(n, k, !era);
      if (!era) { const s2 = statoScene(n, a.scene); PAN.scena[n] = Math.max(0, s2.indexOf('ora')); }
      ri();
    });
    host.querySelectorAll('[data-sc-dado]').forEach(b => b.onclick = e => { e.preventDefault(); e.stopPropagation(); tira?.(b.dataset.scDado, a.scene[i]?.t || ''); });
    host.querySelectorAll('a.xref').forEach(x => x.onclick = e => { e.preventDefault(); e.stopPropagation(); pop(x); });
  }
  // il Tavolo apre il pannello da solo quando si arriva da «Al Tavolo»
  const daAprire = () => { const v = ls.get('scaletta-apri', false); if (v) ls.set('scaletta-apri', false); return !!v; };

  window.__scaletta = { riquadro, acts, nuova: () => dlgScaletta(null), dellaSessione: n => !window.__RO && !!una(n), pannello, daAprire, analizza, docxMd };
})();

/* Campagna D&D — «Tavolo»: il tavolo virtuale condiviso, in tempo reale (Supabase).
   Tappa 1: mappa con griglia, token che i giocatori muovono dal vivo, dadi tirati dal server e visibili a tutti, righello.
   Tappa 2: maschera, ordine del turno, chat (tavolo/tappa-2.sql e tappa-2b.sql).
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

  const CSS = `.tv{position:fixed;left:0;right:0;z-index:30;display:flex;background:#1a1310;--rail:#211a16;--rail2:#2e2520;--rail-ink:#e9dcc0}
.tv-rail{width:50px;flex:none;display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 0 8px;background:var(--rail);border-right:1px solid #000;overflow-y:auto;scrollbar-width:none;z-index:9}
.tv-rail::-webkit-scrollbar{display:none}
.tv-rail button{all:unset;box-sizing:border-box;position:relative;width:38px;height:38px;border-radius:8px;display:flex;align-items:center;justify-content:center;color:var(--rail-ink);cursor:pointer;flex:none}
.tv-rail button svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.tv-rail button:hover{background:var(--rail2)}
.tv-rail button.on{background:var(--wine);color:#fff;box-shadow:inset 0 0 0 1px #e7cf9a66}
.tv-rail button:focus-visible{outline:2px solid var(--gold2)}
.tv-rail hr{width:26px;border:0;border-top:1px solid #ffffff22;margin:6px 0}
.tv-rail .lbl{font:600 .55rem/1 var(--display);letter-spacing:.08em;color:#a8957a;text-transform:uppercase;margin:6px 0 2px}
.tv-rail .sp{flex:1;min-height:8px}
.tv-tip{position:fixed;z-index:60;pointer-events:none;background:#000d;color:#fff;font:600 .82rem/1.2 var(--body);padding:5px 9px;border-radius:5px;white-space:nowrap}
.tv-on{width:12px;height:12px;border-radius:50%;background:#888;flex:none;margin:6px 0 2px;box-shadow:0 0 0 3px #0005}
.tv-on.ok{background:#3f9a4a}.tv-on.ko{background:#c0392b}
.tv-cnt{font:700 .7rem/1 var(--body);color:#c9b89a}
.tv-wrap{flex:1;position:relative;min-width:0;display:flex}
.tv-stage{flex:1;position:relative;overflow:hidden;touch-action:none;background:#6b5442 radial-gradient(ellipse at 50% 40%,#7a614d,#4f3d30);cursor:default;user-select:none;-webkit-user-select:none}
.tv-stage.mano{cursor:grab}.tv-stage.pan{cursor:grabbing}.tv-stage.rul{cursor:crosshair}
.tv-top{position:absolute;top:10px;right:10px;left:10px;display:flex;justify-content:flex-end;align-items:flex-start;gap:8px;z-index:7;pointer-events:none}
.tv-top>*{pointer-events:auto}
.tv-chip{display:flex;align-items:center;gap:8px;background:#211a16e6;color:#f1e4c8;border:1px solid #e7cf9a44;border-radius:8px;padding:5px 6px 5px 10px;font:600 .9rem/1.2 var(--body);box-shadow:0 2px 10px #0006;min-width:0}
.tv-chip b{font-family:var(--display);font-weight:600;letter-spacing:.03em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:40vw}
.tv-chip .btn{flex:none}
.tv-pgbtn{all:unset;pointer-events:auto;cursor:pointer;width:40px;height:40px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:#fbf5e3;color:#2b1d14;box-shadow:0 2px 10px #0008;flex:none}
.tv-pgbtn svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linejoin:round}
.tv-pgbtn:hover{background:#fff}
.tv-world{position:absolute;left:0;top:0;transform-origin:0 0;will-change:transform}
.tv-map{position:absolute;left:0;top:0;max-width:none;pointer-events:none;-webkit-user-drag:none;box-shadow:0 0 0 1px #0008,0 10px 40px #0009;background:#e8dcc0}
.tv-grid{position:absolute;left:0;top:0;pointer-events:none;overflow:visible}
.tv-tok{position:absolute;border-radius:50%;box-sizing:border-box;background:var(--c) center/cover no-repeat;border:3px solid var(--c);box-shadow:0 2px 6px #000a;transition:left .12s,top .12s}
.tv-tok.mine,.tv-tok.dm{cursor:grab}
.tv-tok.drag{transition:none;z-index:5;box-shadow:0 8px 18px #000c;cursor:grabbing}
.tv-tok.live{transition:left .06s linear,top .06s linear}
.tv-tok.hid{opacity:.45;border-style:dashed}
.tv-tok.altro{opacity:.35;pointer-events:none;filter:grayscale(.5)}
.tv-tok.hid.qui{opacity:1}
.tv-liv{display:flex;align-items:center;gap:6px;background:#3b1f4ae6;color:#f1e4c8;border:1px solid #b98cff88;border-radius:8px;padding:6px 10px;font:600 .85rem/1.2 var(--body);box-shadow:0 2px 10px #0006;white-space:nowrap}
.tv-rail button.liv.on{background:#6a4a8c}
.tv-tdp{position:absolute;left:10px;top:10px;z-index:9;width:min(300px,calc(100% - 20px));background:#211a16f5;color:#f1e4c8;border:1px solid #e7cf9a44;border-radius:10px;box-shadow:0 8px 30px #000b;font:600 .9rem/1.2 var(--body)}
.tv-tdp[hidden]{display:none!important}
.tv-tdp .hd{display:flex;align-items:center;justify-content:space-between;padding:8px 10px 6px 12px}
.tv-tdp .hd b{font-family:var(--display);color:var(--gold2);letter-spacing:.04em}
.tv-tdp .hd button{all:unset;cursor:pointer;padding:2px 7px;border-radius:6px;font-size:1rem}
.tv-tdp .hd button:hover{background:#ffffff1a}
.tv-tdp .tabs{display:flex;margin:0 10px 8px;background:#0005;border-radius:7px;padding:3px;gap:3px}
.tv-tdp .tabs button{all:unset;flex:1;text-align:center;cursor:pointer;padding:5px 4px;border-radius:5px;font-size:.85rem}
.tv-tdp .tabs button.on{background:#7d2530;box-shadow:inset 0 0 0 1px #e7cf9a66}
.tv-tdp .mods{display:flex;gap:6px;margin:0 10px 8px}
.tv-tdp .mods input{font:inherit;font-weight:400;padding:4px 7px;border-radius:5px;border:1px solid #ffffff33;background:#0005;color:#fff;min-width:0}
.tv-tdp table{width:calc(100% - 12px);margin:0 6px 8px;border-collapse:collapse}
.tv-tdp td{padding:0;text-align:center}
.tv-tdp td button{all:unset;box-sizing:border-box;cursor:pointer;display:block;width:100%;padding:6px 2px;border-radius:5px}
.tv-tdp td button:hover{background:#7d2530}
.tv-tdp td:first-child button{text-align:left;padding-left:8px;font-family:var(--display);color:var(--gold2)}
.tv-tdp td+td{border-left:1px solid #ffffff14}
.tv-tdp .ft{padding:0 12px 9px;font-weight:400;font-size:.78rem;color:#c9b89a}
.tv-d3{position:absolute;inset:0;pointer-events:none;z-index:6;overflow:hidden}
.tv-d3 .dd{position:absolute;left:0;top:0;width:54px;height:54px;margin:-27px 0 0 -27px;filter:drop-shadow(0 6px 6px #0009)}
.tv-d3 .dd svg{width:100%;height:100%;overflow:visible}
.tv-d3 .dd text{font:800 30px var(--body);fill:#fff;text-anchor:middle;dominant-baseline:central;paint-order:stroke;stroke:#0008;stroke-width:3px}
.tv-d3 .dd.via{opacity:.45}
.tv-roll .tag{margin:-6px -8px 6px;padding:4px 8px;border-radius:5px 5px 0 0;background:#3b1f4a;color:#f1e4c8;font-size:.8rem;font-weight:600;letter-spacing:.01em}
.tv-roll.priv,.tv-msg.w{background:#8a5cc71c;border-color:#8a5cc7;border-style:solid;opacity:1}
.tv-roll .fo{font-size:.8rem;color:var(--mute)}
.tv-roll .chips{display:flex;flex-wrap:wrap;gap:3px;align-items:center;flex:1;font-size:.85rem;color:var(--ink2)}
.tv-roll .chips i{font-style:normal;font-weight:700;min-width:22px;padding:1px 5px;text-align:center;border-radius:4px;border:1px solid var(--line2);background:var(--paper)}
.tv-roll .chips i.max{color:#2f8a3c;border-color:#2f8a3c}.tv-roll .chips i.min{color:#b3261e;border-color:#b3261e}
.tv-roll .chips i.no{opacity:.45;text-decoration:line-through}
.tv-ab{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.tv-ab input[type=number]{width:56px}
.tv-tok.mine{box-shadow:0 0 0 3px #e7cf9a,0 2px 6px #000a}
.tv-tok b{position:absolute;left:50%;top:100%;transform:translateX(-50%);margin-top:2px;white-space:nowrap;font:600 var(--fs,13px)/1.15 var(--body);color:#fff;background:#000a;padding:1px 6px;border-radius:8px;pointer-events:none;max-width:240px;overflow:hidden;text-overflow:ellipsis}
.tv-tok .ini{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:700 calc(var(--fs,13px)*1.6)/1 var(--display);color:#fff;text-shadow:0 1px 2px #000}
.tv-ov{position:absolute;inset:0;pointer-events:none;overflow:visible}
.tv-ov text{font:700 15px var(--body);paint-order:stroke;stroke:#000c;stroke-width:4px;fill:#fff}
.tv-empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:20px;text-align:center;color:#ecdcb4}
.tv-empty div{max-width:440px;background:#00000066;border:1px solid #e7cf9a55;border-radius:10px;padding:22px 24px;line-height:1.45;font-size:1.05rem}
.tv-empty h2{font-family:var(--display);color:var(--gold2)!important;margin:0 0 8px;font-size:1.25rem}
.tv-empty code{background:#0006;padding:1px 5px;border-radius:4px}
.tv-zoom{position:absolute;right:12px;top:62px;display:flex;flex-direction:column;align-items:center;gap:4px;z-index:6;background:#211a16d9;border:1px solid #e7cf9a33;border-radius:20px;padding:5px 0;box-shadow:0 2px 10px #0006}
.tv-zoom button{all:unset;cursor:pointer;width:32px;height:30px;display:flex;align-items:center;justify-content:center;color:#f1e4c8;font:600 1.15rem/1 var(--display)}
.tv-zoom button:hover{color:#fff;background:#ffffff14}
.tv-zoom small{font:600 .68rem/1 var(--body);color:#c9b89a}
.tv-chat{width:310px;flex:none;display:flex;flex-direction:column;border-left:1px solid #000;background:var(--paper);min-height:0;z-index:8}
.tv-chat[hidden]{display:none!important}
.tv-dh{display:flex;align-items:center;justify-content:space-between;padding:8px 10px 6px;font-family:var(--display);color:var(--wine);font-weight:600;border-bottom:1px solid var(--line)}
:root[data-theme=dark] .tv-dh{color:var(--gold2)}
.tv-log{flex:1;overflow-y:auto;padding:8px 10px;display:flex;flex-direction:column;gap:6px;min-height:60px}
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
.tv-dk .hint{margin:0;font-size:.82rem}
.tv-pages{position:absolute;left:0;right:0;top:0;z-index:20;max-height:78%;display:flex;flex-direction:column;background:#1d1714f7;color:#f1e4c8;border-bottom:2px solid var(--gold2);box-shadow:0 12px 40px #000c}
.tv-pages[hidden]{display:none!important}
.tv-ph{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid #ffffff1a;flex-wrap:wrap}
.tv-ph .cur{display:flex;align-items:center;gap:10px;min-width:0}
.tv-ph .cur img,.tv-ph .cur span.ph{width:52px;height:34px;border-radius:4px;object-fit:cover;background:#3a2d24;flex:none}
.tv-ph .cur b{font-family:var(--display);color:var(--gold2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tv-ph button.lnk{all:unset;cursor:pointer;color:#d9b8ff;font-weight:600;font-size:.92rem;white-space:nowrap}
.tv-ph button.lnk:hover{text-decoration:underline}
.tv-ph input[type=search]{flex:1;min-width:140px;font:inherit;padding:7px 10px;border-radius:6px;border:1px solid #ffffff2a;background:#0005;color:#f1e4c8}
.tv-ph label{display:flex;align-items:center;gap:6px;font-size:.92rem;white-space:nowrap}
.tv-ph .x{all:unset;cursor:pointer;font-size:1.3rem;line-height:1;padding:4px 8px;border-radius:6px}
.tv-ph .x:hover{background:#ffffff1a}
.tv-pgrid{overflow-y:auto;padding:12px 14px 16px;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
.tv-card{position:relative;background:#2b221d;border:2px solid transparent;border-radius:8px;overflow:hidden;cursor:pointer;display:flex;flex-direction:column;box-shadow:0 2px 8px #0007;text-align:left;color:inherit;font:inherit;padding:0}
.tv-card:hover{border-color:#e7cf9a77}
.tv-card.cur{border-color:#b98cff}
.tv-card .im{aspect-ratio:16/10;background:#3a2d24 center/cover no-repeat;display:block}
.tv-card .nm{padding:7px 9px 9px;font-weight:600;font-size:.93rem;line-height:1.2;overflow-wrap:anywhere}
.tv-card .seg{position:absolute;left:8px;top:-2px;width:20px;height:28px;background:#f2b51d;clip-path:polygon(0 0,100% 0,100% 100%,50% 75%,0 100%);filter:drop-shadow(0 1px 2px #000a)}
.tv-card .acts{position:absolute;right:6px;top:6px;display:flex;gap:4px;opacity:0;transition:opacity .15s}
.tv-card:hover .acts,.tv-card:focus-within .acts{opacity:1}
.tv-card .acts button{all:unset;cursor:pointer;width:28px;height:28px;border-radius:6px;background:#000b;color:#fff;display:flex;align-items:center;justify-content:center;font-size:.9rem}
.tv-card .acts button:hover{background:#7d2530}
.tv-card.nuova{border:2px dashed #e7cf9a55;background:transparent;align-items:center;justify-content:center;min-height:120px;color:#e7cf9a;font-family:var(--display);gap:6px}
.tv-card.nuova span{font-size:1.8rem;line-height:1}
@media (hover:none){.tv-card .acts{opacity:1}}
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
.tv-fog{position:absolute;left:0;top:0;pointer-events:none}
.tv-tok.turno{box-shadow:0 0 0 4px #f2b51d,0 0 18px 6px #f2b51daa}
.tv-turno{position:absolute;left:10px;bottom:10px;z-index:8;width:270px;max-height:min(420px,70%);display:flex;flex-direction:column;background:#211a16f2;color:#f1e4c8;border:1px solid #e7cf9a44;border-radius:10px;box-shadow:0 6px 24px #000a}
.tv-turno[hidden]{display:none!important}
.tv-th{display:flex;align-items:center;gap:6px;padding:8px 8px 6px 12px;border-bottom:1px solid #ffffff1a}
.tv-th b{flex:1;font-family:var(--display);font-size:.85rem;letter-spacing:.05em;color:var(--gold2)}
.tv-th small{color:#c9b89a;font-size:.8rem}
.tv-th button,.tv-tf button{all:unset;cursor:pointer;padding:4px 8px;border-radius:6px;font:600 .82rem var(--body);color:#f1e4c8;background:#ffffff14}
.tv-th button:hover,.tv-tf button:hover{background:#ffffff2a}
.tv-th button.go{background:#7d2530}
.tv-tl{overflow-y:auto;padding:4px 0;flex:1}
.tv-tr{display:flex;align-items:center;gap:8px;padding:5px 10px;border-left:3px solid transparent}
.tv-tr.att{background:#f2b51d26;border-left-color:#f2b51d}
.tv-tr.hid{opacity:.6;font-style:italic}
.tv-tr i{width:28px;height:28px;border-radius:50%;flex:none;background:var(--c,#7d2530) center/cover no-repeat;border:2px solid var(--c,#7d2530);display:flex;align-items:center;justify-content:center;font:700 .7rem var(--display);font-style:normal;color:#fff}
.tv-tr span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tv-tr input{width:48px;font:inherit;text-align:right;padding:2px 4px;border-radius:4px;border:1px solid #ffffff33;background:#0005;color:#fff}
.tv-tr em{font-style:normal;font-weight:700;min-width:30px;text-align:right}
.tv-tr button{all:unset;cursor:pointer;color:#c9b89a;padding:0 3px}
.tv-tr button:hover{color:#fff}
.tv-tf{display:flex;gap:6px;flex-wrap:wrap;align-items:center;padding:7px 10px 9px;border-top:1px solid #ffffff1a}
.tv-tf input{width:52px;font:inherit;padding:3px 6px;border-radius:4px;border:1px solid #ffffff33;background:#0005;color:#fff}
.tv-tvuoto{padding:10px 12px;color:#c9b89a;font-size:.9rem}
.tv-mbar{position:absolute;left:10px;top:10px;z-index:8;display:flex;flex-wrap:wrap;align-items:center;gap:6px;max-width:calc(100% - 250px);background:#211a16f2;color:#f1e4c8;border:1px solid #e7cf9a44;border-radius:10px;padding:6px 8px;box-shadow:0 6px 24px #000a}
.tv-mbar[hidden]{display:none!important}
.tv-mbar button{all:unset;cursor:pointer;padding:5px 9px;border-radius:6px;font:600 .82rem var(--body);background:#ffffff14;white-space:nowrap}
.tv-mbar button:hover{background:#ffffff2a}
.tv-mbar button.on{background:#7d2530;box-shadow:inset 0 0 0 1px #e7cf9a88}
.tv-mbar button[disabled]{opacity:.4;pointer-events:none}
.tv-mbar label{display:flex;align-items:center;gap:5px;font-size:.85rem;white-space:nowrap}
.tv-mbar .sep{width:1px;align-self:stretch;background:#ffffff22}
.tv-mbar input[type=range]{width:90px}
.tv-roll .h .who{display:flex;align-items:baseline;gap:5px;min-width:0;flex-wrap:wrap}
.tv-roll .h .who em{font-weight:400;font-size:.8rem;color:var(--mute)}
.tv-roll .h .dx{display:flex;align-items:center;gap:4px;flex:none}
.tv-roll .del{all:unset;cursor:pointer;color:var(--mute);font-size:.8rem;line-height:1;padding:2px 4px;border-radius:4px;opacity:0;transition:opacity .12s}
.tv-roll:hover .del,.tv-roll .del:focus-visible{opacity:1}
.tv-roll .del:hover{color:#fff;background:#b3261e}
@media (hover:none){.tv-roll .del{opacity:.7}}
.tv-msg .tx{overflow-wrap:anywhere;white-space:pre-wrap}
.tv-msg.w{border-color:#8a5cc7;background:#8a5cc714}
.tv-msg.w .tx{font-style:italic}
.tv-ctab{all:unset;box-sizing:border-box;position:absolute;right:0;top:50%;transform:translateY(-50%);z-index:13;width:20px;height:64px;border-radius:9px 0 0 9px;background:var(--paper);color:var(--wine);border:1px solid #0008;border-right:0;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:-3px 0 10px #0006;font:700 1rem/1 var(--body)}
.tv-ctab:hover{background:var(--paper2)}
.tv-ctab.nuovo::after{content:"";position:absolute;top:6px;left:5px;width:9px;height:9px;border-radius:50%;background:#c0392b;box-shadow:0 0 0 2px var(--paper)}
:root[data-theme=dark] .tv-ctab{color:var(--gold2)}
.tv-foto{position:fixed;inset:0;z-index:200;background:#0b0807ee;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:16px;cursor:zoom-out;animation:tvfoto .18s ease-out}
@keyframes tvfoto{from{opacity:0}}
.tv-foto img{max-width:94vw;max-height:calc(100vh - 110px);object-fit:contain;border-radius:8px;box-shadow:0 10px 50px #000}
.tv-foto p{margin:0;color:#f1e4c8;font:600 1.15rem/1.3 var(--display);text-align:center}
.tv-foto p small{display:block;font:400 .85rem var(--body);color:#c9b89a}
.tv-foto button{all:unset;position:absolute;top:12px;right:14px;cursor:pointer;color:#fff;font-size:1.6rem;line-height:1;padding:6px 10px;border-radius:8px;background:#ffffff1a}
dialog.dlg.tv-side{position:fixed;inset:66px auto auto 62px;margin:0;width:min(380px,calc(100vw - 80px));max-height:calc(100vh - 150px);overflow-y:auto;z-index:50}
dialog.dlg.tv-side form{padding:14px 16px}
dialog.dlg.tv-side .tv-pick{grid-template-columns:repeat(auto-fill,minmax(70px,1fr));max-height:32vh;gap:4px}
dialog.dlg.tv-side .tv-pick i{width:44px;height:44px;font-size:1rem}
dialog.dlg.tv-side .tv-pick button{font-size:.78rem}
.tv-f input[type=color]{padding:0 2px;height:30px;width:52px}
@media (max-width:820px){
  .tv-turno{width:min(250px,calc(100% - 20px));max-height:45%}
  .tv-rail{width:44px}.tv-rail button{width:34px;height:34px}
  .tv-chat{position:absolute;right:0;bottom:0;left:0;width:auto;max-height:62%;z-index:12;border-left:0;border-top:2px solid var(--gold);box-shadow:0 -8px 24px #0008;border-radius:12px 12px 0 0}
  .tv-ctab{top:auto;bottom:calc(62% + 8px);transform:none;width:40px;height:34px;border-radius:9px 0 0 9px}
  .tv-ctab.chiusa{bottom:12px}
  dialog.dlg.tv-side{inset:auto 8px 8px 8px;width:auto;max-height:58vh}
  .tv-chip b{max-width:34vw}
  .tv-pgrid{grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px}
}
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
    sql2: ['Manca l\'aggiornamento del database', 'Per la maschera, l\'ordine del turno e la chat va eseguito una volta lo script <code>tavolo/tappa-2.sql</code> nell\'SQL Editor di Supabase.'],
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
    const mb = await SB.from('tavolo_membri').select('user_id,nome,giocatore'); if (!mb.error) T.membri = mb.data;
  }

  /* ---------- stato ---------- */
  const T = { mask: [], turno: [], chat: [], mmodo: 'svela', mforma: 'rett', mraggio: 0, mini: new Map(), me: null, info: null, stato: null, scene: new Map(), tok: new Map(), tiri: [], vista: null, view: { x: 0, y: 0, z: 1 }, tool: 'muovi', livello: 'segnalini', tdpriv: false, allN: 3, ch: null, rulers: new Map(), live: false, url: new Map(), online: [] };
  const isDM = () => T.me?.ruolo === 'dm';
  const scena = () => T.scene.get(T.vista) || null;
  const puoMuovere = t => isDM() || (t.giocatore && t.giocatore === T.me.giocatore);
  const iniziali = n => String(n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';

  /* ---------- pagina ---------- */
  route(/^\/tavolo$/, async () => {
    await claude.use('db'); css();
    T.diceInit = false; T.drag = null; T.online = []; T.live = false; T.tool = 'muovi';
    setView(`<h1 style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Tavolo</h1>
      <div class="tv"><nav class="tv-rail" id="tv-rail" aria-label="Strumenti del tavolo"><span class="sp"></span><span class="tv-on" id="tv-on" title="Connessione…"></span></nav>
      <div class="tv-wrap"><div class="tv-stage" id="tv-stage"><div class="tv-empty"><div><p>Apro il tavolo…</p></div></div></div><div class="tv-top" id="tv-top"></div><div class="tv-mbar" id="tv-mbar" hidden></div><div class="tv-turno" id="tv-turno" hidden></div><div class="tv-tdp" id="tv-tdp" hidden></div><button type="button" class="tv-ctab" id="tv-ctab" data-act="tv-dadi"></button></div>
      <aside class="tv-chat" id="tv-dice" hidden></aside><div class="tv-pages" id="tv-pages" hidden></div></div>`);
    suggerimenti($('.tv'));
    const fit = () => {
      const f = $('.tv'); if (!f) return;
      const top = $('header.top'), nav = $('#nav');
      f.style.top = (top ? top.getBoundingClientRect().bottom : 0) + 'px';
      f.style.bottom = (nav && getComputedStyle(nav).position === 'fixed' ? nav.offsetHeight : 0) + 'px';
    };
    fit(); scrollTo(0, 0); addEventListener('resize', fit);
    let vivo = true;
    onCleanup(() => { vivo = false; removeEventListener('resize', fit); esci(); document.querySelectorAll('.tv-tip').forEach(x => x.remove()); });
    const info = await window.__tavolo?.();
    T.info = info;
    try {
      if (!info) throw errore('ospite');
      T.me = await entra(info);
      if (!vivo) return;
      await carica();
      if (!vivo) return;
      collega();
      disegnaBarra(); disegnaDadi(); mostraScena(true); if (T.turno.length) apriTurno(true);
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
  function stato(cls, txt) { const o = $('#tv-on'); if (!o) return; o.className = 'tv-on ' + cls; o.title = txt; }

  async function carica() {
    const [st, sc, tk, tr, mb, ms, tu, ct] = await Promise.all([
      SB.from('tavolo_stato').select('*').eq('id', 1).maybeSingle(),
      SB.from('tavolo_scene').select('*').order('creata'),
      SB.from('tavolo_token').select('*'),
      SB.from('tavolo_tiri').select('*').order('id', { ascending: false }).limit(80),
      SB.from('tavolo_membri').select('user_id,nome,giocatore'),
      SB.from('tavolo_maschera').select('*').order('id'),
      SB.from('tavolo_turno').select('*'),
      SB.from('tavolo_chat').select('*').order('id', { ascending: false }).limit(80)
    ]);
    for (const r of [ms, tu, ct]) if (r.error && sqlMancante(r.error)) throw errore('sql2');
    T.stato = chk(st) || { scena: null, canale: 'avalar' };
    T.scene = new Map(chk(sc).map(s => [s.id, s]));
    T.tok = new Map(chk(tk).map(t => [t.id, t]));
    T.tiri = chk(tr).reverse();
    T.membri = chk(mb);
    T.mask = chk(ms); T.turno = chk(tu); T.chat = chk(ct).reverse();
    if (!isDM() || !T.scene.has(T.vista)) T.vista = T.stato.scena;
  }

  /* ---------- tempo reale ---------- */
  function collega() {
    if (T.ch) SB.removeChannel(T.ch);
    const ch = T.ch = SB.channel('tavolo-' + T.stato.canale, { config: { broadcast: { self: false }, presence: { key: T.me.uid } } });
    const pg = (table, f, event = '*') => ch.on('postgres_changes', { event, schema: 'public', table }, f);
    pg('tavolo_token', p => {
      if (p.eventType === 'DELETE') { T.tok.delete(p.old.id); disegnaToken(); return; }
      const t = completa(T.tok.get(p.new.id), p.new); if (T.drag?.id === t.id) return; T.tok.set(t.id, t); disegnaToken();
    });
    pg('tavolo_scene', p => {
      if (p.eventType === 'DELETE') { T.scene.delete(p.old.id); if (T.vista === p.old.id) T.vista = T.stato.scena; }
      else { const prima = T.scene.get(p.new.id); T.scene.set(p.new.id, p.new); if (prima?.mappa !== p.new.mappa) T.url.delete(prima?.mappa); }
      disegnaBarra(); if (p.eventType === 'DELETE' || p.new.id === T.vista) mostraScena(p.eventType !== 'UPDATE');
      if (isDM() && !$('#tv-pages')?.hidden) pannelloMappe(true);
    });
    pg('tavolo_stato', async p => {
      const prima = T.stato.scena, primoTurno = T.stato.turno; T.stato = p.new;
      if (primoTurno !== T.stato.turno || p.old?.round !== p.new.round) { disegnaTurno(); disegnaToken(); }
      if (prima === T.stato.scena) return;
      if (isDM()) { disegnaBarra(); return; }
      // i giocatori seguono il DM nella nuova scena: scena e token arrivano solo ora che è attiva
      await carica().catch(() => { }); T.vista = T.stato.scena; disegnaBarra(); mostraScena(true);
      if (scena()) toast('Il DM vi ha portati in: ' + scena().nome);
    });
    pg('tavolo_tiri', p => { if (T.tiri.some(x => x.id === p.new.id)) return; T.tiri.push(p.new); if (T.tiri.length > 120) T.tiri.shift(); nuovoTiro(p.new); }, 'INSERT');
    pg('tavolo_tiri', p => { T.tiri = T.tiri.filter(x => x.id !== p.old.id); disegnaLog(); }, 'DELETE');
    pg('tavolo_chat', p => { if (T.chat.some(x => x.id === p.new.id)) return; T.chat.push(p.new); if (T.chat.length > 120) T.chat.shift(); nuovoMsg(p.new); }, 'INSERT');
    pg('tavolo_chat', p => { T.chat = T.chat.filter(x => x.id !== p.old.id); disegnaLog(); }, 'DELETE');
    pg('tavolo_maschera', p => {
      if (p.eventType === 'DELETE') T.mask = T.mask.filter(m => m.id !== p.old.id);
      else if (!T.mask.some(m => m.id === p.new.id)) T.mask.push(p.new);
      programmaMaschera();
    });
    pg('tavolo_turno', p => {
      if (!T.turno.length && p.eventType === 'INSERT') apriTurno(true);
      if (p.eventType === 'DELETE') T.turno = T.turno.filter(x => x.id !== p.old.id);
      else { const i = T.turno.findIndex(x => x.id === p.new.id); if (i >= 0) T.turno[i] = completa(T.turno[i], p.new); else T.turno.push(p.new); }
      disegnaTurno(); disegnaToken();
    });
    // voci dell'ordine del turno che il DM ha appena nascosto o mostrato: i giocatori ricaricano l'elenco
    ch.on('broadcast', { event: 'turno' }, async () => {
      if (isDM()) return; const r = await SB.from('tavolo_turno').select('*'); if (!r.error) { T.turno = r.data; disegnaTurno(); disegnaToken(); }
    });
    ch.on('broadcast', { event: 'trascina' }, ({ payload: m }) => {
      const t = T.tok.get(m.id), el = tokEl(m.id); if (!t || !el || T.drag?.id === m.id) return;
      el.classList.add('live'); el.style.left = m.x + 'px'; el.style.top = m.y + 'px';
    });
    ch.on('broadcast', { event: 'foto' }, ({ payload: f }) => { if (!isDM()) apriFoto(f, true); });
    ch.on('broadcast', { event: 'righello' }, ({ payload: m }) => {
      if (m.pts) T.rulers.set(m.uid, m); else T.rulers.delete(m.uid);
      disegnaRighelli();
    });
    ch.on('broadcast', { event: 'nascosto' }, ({ payload: m }) => {
      if (isDM()) return; const t = T.tok.get(m.id); if (t && t.giocatore !== T.me.giocatore) { T.tok.delete(m.id); disegnaToken(); }
    });
    ch.on('presence', { event: 'sync' }, () => {
      T.online = Object.values(ch.presenceState()).map(a => a[0]?.nome).filter(Boolean);
      if (T.live) stato('ok', 'Al tavolo ora: ' + T.online.join(', '));
      const c = $('#tv-cnt'); if (c) c.textContent = T.online.length > 1 ? T.online.length : '';
    });
    let primo = true;
    ch.subscribe(async s => {
      if (s === 'SUBSCRIBED') {
        T.live = true; stato('ok', 'Collegato'); ch.track({ nome: T.me.nome });
        // dopo un'interruzione riprendo tutto: nel frattempo qualcuno può aver mosso o tirato
        if (!primo) { await carica().catch(() => { }); disegnaBarra(); mostraScena(false); disegnaLog(); disegnaTurno(); }
        primo = false;
      } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') { T.live = false; if (T.ch === ch) stato('ko', 'Riconnessione…'); }
    });
    addEventListener('keydown', tasti);
  }
  // Postgres non rimanda i valori lunghi rimasti uguali (come l'immagine del token): li tengo da prima
  const completa = (prima, nuovo) => { const o = { ...(prima || {}), ...nuovo }; if (prima?.immagine && !nuovo.immagine) o.immagine = prima.immagine; return o; };
  const manda = (event, payload) => { if (T.ch) T.ch.send({ type: 'broadcast', event, payload }).catch(() => { }); };

  /* ---------- strumenti (a sinistra) e mappe (in alto a destra), come su Roll20 ---------- */
  const ICO = {
    sel: '<path d="M5 3l14 7.5-6.2 1.7L10.5 19z"/>',
    mano: '<path d="M8 13V6a1.5 1.5 0 0 1 3 0v5.5M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v6M17 10a1.5 1.5 0 0 1 3 0v5a6 6 0 0 1-6 6h-1.6a6 6 0 0 1-4.7-2.3l-3.2-4a1.5 1.5 0 0 1 2.3-1.9L8 14.5"/>',
    rig: '<path d="M3 16.5L16.5 3 21 7.5 7.5 21z"/><path d="M7 12.5l2 2M10 9.5l2.5 2.5M13 6.5l2 2"/>',
    dado: '<path d="M12 2.5l8.2 4.75v9.5L12 21.5l-8.2-4.75v-9.5z"/><path d="M12 7.5l4.3 7.5H7.7z"/>',
    tur: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 5l1.5-1v4M3.5 11.5c.4-.6 1-1 1.7-.9.8.1 1.1.9.7 1.5L3.5 14.5h2.6M3.6 17h1.6a.9.9 0 0 1 0 1.8H4.4h.8a.9.9 0 0 1 0 1.8H3.5"/>',
    mas: '<path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/><circle cx="12" cy="12" r="2.5"/><path d="M4 20L20 4"/>',
    tok: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8v8M8 12h8"/>',
    gri: '<path d="M4 4h16v16H4zM4 9.33h16M4 14.67h16M9.33 4v16M14.67 4v16"/>',
    lseg: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.8 3.6-6 7-6s6.2 2.2 7 6"/>',
    lmas: '<path d="M4 18h16M5 18L3.5 8l5 3.5L12 5l3.5 6.5 5-3.5L19 18"/>',
    pag: '<rect x="3" y="7" width="13" height="13" rx="1.5"/><path d="M7 4h12.5A1.5 1.5 0 0 1 21 5.5V17"/><path d="M5.5 17l3.5-4 2.5 2.5 1.5-1.5 2 3"/>'
  };
  const svg = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICO[k]}</svg>`;
  function disegnaBarra() { disegnaRail(); disegnaTop(); setActs(azioni()); }
  function disegnaRail() {
    const r = $('#tv-rail'); if (!r) return;
    const b = (act, tip, k, on) => `<button type="button" data-act="${act}" data-tip="${esc(tip)}" aria-label="${esc(tip)}" class="${on ? 'on' : ''}">${svg(k)}</button>`;
    let h = b('tv-sel', 'Seleziona e sposta i token (S)', 'sel', T.tool === 'muovi') + b('tv-mano', 'Sposta la mappa (M)', 'mano', T.tool === 'mano')
      + b('tv-righello', 'Righello (R)', 'rig', T.tool === 'righello') + b('tv-tiradadi', 'Tiradadi', 'dado', !$('#tv-tdp')?.hidden)
      + b('tv-turno', 'Ordine del turno', 'tur', !$('#tv-turno')?.hidden);
    if (isDM() && scena()) h += '<hr><span class="lbl">DM</span>' + b('tv-maschera', 'Maschera: nascondi e svela la mappa', 'mas', T.tool === 'maschera') + b('tv-token', 'Aggiungi un token', 'tok') + b('tv-griglia', 'Impostazioni della pagina', 'gri');
    h += '<span class="sp"></span>';
    if (isDM() && scena()) h += '<span class="lbl">Livelli</span>' + b('tv-liv-seg', 'Livello Segnalini: i token che vedono tutti', 'lseg', T.livello === 'segnalini').replace('class="', 'class="liv ') + b('tv-liv-mas', 'Livello Master: i token che vedi solo tu', 'lmas', T.livello === 'master').replace('class="', 'class="liv ');
    h += `<span class="tv-cnt" id="tv-cnt">${T.online.length > 1 ? T.online.length : ''}</span><span class="tv-on ${T.live ? 'ok' : ''}" id="tv-on" title="${T.live ? esc('Al tavolo ora: ' + T.online.join(', ')) : 'Connessione…'}"></span>`;
    r.innerHTML = h;
  }
  function disegnaTop() {
    const t = $('#tv-top'); if (!t) return;
    const sc = scena(), att = T.stato?.scena;
    let h = '';
    if (sc) h += `<div class="tv-chip"><b>${esc(sc.nome)}</b>${isDM() ? (sc.id === att ? '<span title="I giocatori sono su questa mappa" aria-label="I giocatori sono qui">🔖</span>' : '<button type="button" class="btn sm primary" data-act="tv-porta">Porta qui i giocatori</button>') : ''}</div>`;
    if (isDM() && sc && T.livello === 'master') h = '<div class="tv-liv" title="I token che aggiungi e sposti ora li vedi solo tu">👑 Livello Master</div>' + h;
    if (isDM()) h += `<button type="button" class="tv-pgbtn" data-act="tv-pagine" data-tip="Mappe" aria-label="Mappe">${svg('pag')}</button>`;
    t.innerHTML = h;
  }
  function azioni() {
    return {
      'tv-sel': () => strumento('muovi'), 'tv-mano': () => strumento('mano'), 'tv-righello': () => strumento(T.tool === 'righello' ? 'muovi' : 'righello'),
      'tv-dadi': () => apriChat($('#tv-dice').hidden, true),
      'tv-porta': () => porta(T.vista),
      'tv-pagine': () => pannelloMappe($('#tv-pages').hidden), 'tv-nuova': () => dlgNuovaScena(),
      'tv-token': () => dlgToken(), 'tv-griglia': () => dlgGriglia(),
      'tv-turno': () => apriTurno($('#tv-turno').hidden),
      'tv-tiradadi': () => { const p = $('#tv-tdp'); p.hidden = !p.hidden; if (!p.hidden) disegnaTdp(); disegnaRail(); },
      'tv-liv-seg': () => livello('segnalini'), 'tv-liv-mas': () => livello('master'), 'tv-maschera': () => strumento(T.tool === 'maschera' ? 'muovi' : 'maschera'),
      ...dadiActs()
    };
  }
  // livelli come su Roll20: Segnalini (li vedono tutti) e Master (solo il DM). Si lavora su uno alla volta
  function livello(l) { T.livello = l; chiudiPop(); const sl = document.querySelector('dialog.tv-side [name=liv]'); if (sl) sl.value = l; disegnaRail(); disegnaTop(); disegnaToken(); }
  function strumento(t) { T.tool = t; const st = $('#tv-stage'); if (st) { st.classList.toggle('rul', t === 'righello' || t === 'maschera' || t === 'allinea'); st.classList.toggle('mano', t === 'mano'); } disegnaRail(); barraMaschera(); }
  function tasti(e) {
    if (e.target.closest('input,textarea,select,[contenteditable]') || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('dialog[open]')) return;
    const k = e.key.toLowerCase();
    if (k === 'r') strumento(T.tool === 'righello' ? 'muovi' : 'righello');
    else if (k === 's') strumento('muovi');
    else if (k === 'm') strumento('mano');
    else if (e.key === 'Escape') { T.al = null; strumento('muovi'); chiudiPop(); pannelloMappe(false); }
  }
  // etichette dei pulsanti al passaggio del mouse
  function suggerimenti(root) {
    let tip = null;
    const via = () => { tip?.remove(); tip = null; };
    root.addEventListener('pointerover', e => {
      const b = e.target.closest('[data-tip]'); if (!b || e.pointerType !== 'mouse') return;
      via(); tip = document.createElement('div'); tip.className = 'tv-tip'; tip.textContent = b.dataset.tip; document.body.append(tip);
      const r = b.getBoundingClientRect(), dx = r.left > innerWidth / 2;
      tip.style.top = (r.top + r.height / 2 - tip.offsetHeight / 2) + 'px';
      tip.style.left = (dx ? r.left - tip.offsetWidth - 8 : r.right + 8) + 'px';
    });
    root.addEventListener('pointerout', e => { if (e.target.closest('[data-tip]')) via(); });
    root.addEventListener('pointerdown', via);
  }
  async function porta(id) {
    const s = T.scene.get(id); if (!s) return;
    chk(await SB.from('tavolo_stato').update({ scena: id }).eq('id', 1));
    T.stato.scena = id; disegnaTop(); if (!$('#tv-pages').hidden) pannelloMappe(true);
    toast('I giocatori ora vedono: ' + s.nome);
  }

  /* ---------- pannello delle mappe (DM): si preparano prima e si cambia al volo ---------- */
  const SEGUI = 'tavolo-segui';
  const segue = () => { try { return localStorage.getItem(SEGUI) !== '0'; } catch { return true; } };
  const miniPath = path => path.replace(/\.[^./]+$/, '') + '-mini.jpg';
  const dataBlob = async u => (await fetch(u)).blob();
  async function miniUrl(s) {
    if (!s.mappa) return null;
    const c = T.mini.get(s.mappa); if (c) return c;
    const p = (async () => {
      try { return await urlMappa(miniPath(s.mappa)); } catch { }
      // mappe caricate prima delle anteprime: la ricavo dall'immagine intera e la salvo per le prossime volte
      const blob = await dataBlob(await urlMappa(s.mappa)), bmp = await loadBitmap(blob);
      const k = Math.min(1, 400 / Math.max(bmp.width, bmp.height)), c2 = document.createElement('canvas');
      c2.width = Math.max(1, Math.round(bmp.width * k)); c2.height = Math.max(1, Math.round(bmp.height * k));
      c2.getContext('2d').drawImage(bmp, 0, 0, c2.width, c2.height); if (bmp.close) bmp.close();
      const mini = await new Promise(r => c2.toBlob(r, 'image/jpeg', 0.75));
      SB.storage.from(BUCKET).upload(miniPath(s.mappa), mini, { contentType: 'image/jpeg', upsert: true }).catch(() => { });
      return URL.createObjectURL(mini);
    })();
    T.mini.set(s.mappa, p); p.catch(() => T.mini.delete(s.mappa));
    return p;
  }
  function pannelloMappe(apri) {
    const p = $('#tv-pages'); if (!p) return;
    if (!apri) { p.hidden = true; return; }
    chiudiPop();
    const sc = scena(), att = T.stato.scena, q = p.querySelector('input[type=search]')?.value || '';
    const card = s => `<div class="tv-card ${s.id === T.vista ? 'cur' : ''}" role="button" tabindex="0" data-id="${s.id}"><span class="im" data-mini="${s.id}"></span>${s.id === att ? '<span class="seg" title="I giocatori sono qui"></span>' : ''}
      <span class="nm">${esc(s.nome)}</span><span class="acts">${s.id === att ? '' : '<button type="button" data-k="porta" title="Porta qui i giocatori" aria-label="Porta qui i giocatori">🔖</button>'}<button type="button" data-k="nome" title="Rinomina" aria-label="Rinomina">✎</button><button type="button" data-k="via" title="Elimina" aria-label="Elimina">✕</button></span></div>`;
    p.innerHTML = `<div class="tv-ph"><div class="cur">${sc ? `<span class="ph" data-mini="${sc.id}"></span><b>${esc(sc.nome)}</b><button type="button" class="lnk" data-k="imp">⚙ Impostazioni della pagina</button>` : '<b>Mappe</b>'}</div>
      <input type="search" placeholder="Cerca…" aria-label="Cerca una mappa" value="${esc(q)}">
      <label title="Se è spuntato, quando apri una mappa ci vanno anche i giocatori"><input type="checkbox" data-k="segui" ${segue() ? 'checked' : ''}> I giocatori mi seguono</label>
      <button type="button" class="btn primary" data-k="nuova">+ Crea pagina</button><button type="button" class="x" data-k="chiudi" aria-label="Chiudi">✕</button></div>
      <div class="tv-pgrid">${[...T.scene.values()].map(card).join('')}<button type="button" class="tv-card nuova" data-k="nuova"><span>+</span>Nuova mappa</button></div>`;
    p.hidden = false;
    p.querySelectorAll('[data-mini]').forEach(el => { const s = T.scene.get(el.dataset.mini); if (s) miniUrl(s).then(u => { if (u) el.style.backgroundImage = `url("${u}")`; el.style.backgroundSize = 'cover'; el.style.backgroundPosition = 'center'; }).catch(() => { }); });
    const cerca = p.querySelector('input[type=search]');
    const filtra = () => { const t = norm(cerca.value); p.querySelectorAll('.tv-card[data-id]').forEach(c => c.hidden = !!t && !norm(T.scene.get(c.dataset.id)?.nome).includes(t)); };
    cerca.oninput = filtra; filtra();
    p.querySelector('[data-k=segui]').onchange = e => { try { localStorage.setItem(SEGUI, e.target.checked ? '1' : '0'); } catch { } };
    p.querySelectorAll('[data-k=nuova]').forEach(b => b.onclick = () => dlgNuovaScena());
    p.querySelector('[data-k=chiudi]').onclick = () => pannelloMappe(false);
    const imp = p.querySelector('[data-k=imp]'); if (imp) imp.onclick = () => { pannelloMappe(false); dlgGriglia(); };
    p.querySelectorAll('.tv-card[data-id]').forEach(c => {
      const s = T.scene.get(c.dataset.id);
      const apriMappa = async () => {
        T.vista = s.id; pannelloMappe(false); disegnaBarra(); mostraScena(true);
        if (segue() && T.stato.scena !== s.id) await porta(s.id).catch(e => toast(e.message, 'err'));
      };
      c.onclick = e => { if (!e.target.closest('.acts')) apriMappa(); };
      c.onkeydown = e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === c) { e.preventDefault(); apriMappa(); } };
      const pt = c.querySelector('[data-k=porta]'); if (pt) pt.onclick = () => porta(s.id).catch(e => toast(e.message, 'err'));
      c.querySelector('[data-k=nome]').onclick = async () => {
        const n = prompt('Nome della mappa', s.nome); if (!n?.trim()) return;
        const r = await SB.from('tavolo_scene').update({ nome: n.trim().slice(0, 80) }).eq('id', s.id).select().single(); if (r.error) return toast(r.error.message, 'err');
        T.scene.set(s.id, r.data); pannelloMappe(true); disegnaTop();
      };
      c.querySelector('[data-k=via]').onclick = async () => {
        if (!await ask(`Eliminare la mappa **${s.nome}** con tutti i suoi token?`, { ok: 'Elimina', danger: true, title: 'Elimina mappa' })) return;
        const r = await SB.from('tavolo_scene').delete().eq('id', s.id); if (r.error) return toast(r.error.message, 'err');
        if (s.mappa) SB.storage.from(BUCKET).remove([s.mappa, miniPath(s.mappa)]).catch(() => { });
        T.scene.delete(s.id); for (const t of [...T.tok.values()]) if (t.scena === s.id) T.tok.delete(t.id);
        if (T.stato.scena === s.id) T.stato.scena = null;
        if (T.vista === s.id) { T.vista = T.stato.scena || [...T.scene.keys()][0] || null; mostraScena(true); }
        pannelloMappe(true); disegnaBarra();
      };
    });
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
      st.innerHTML = `<div class="tv-empty"><div>${isDM() ? (T.scene.size ? '<h2>Nessuna mappa aperta</h2><p>Scegline una dal pannello delle mappe, in alto a destra.</p><p><button class="btn primary" data-act="tv-pagine">Apri le mappe</button></p>' : '<h2>Il tavolo è pronto</h2><p>Crea la prima mappa: carica l\'immagine del combattimento o del luogo, poi aggiungi i token.</p><p><button class="btn primary" data-act="tv-nuova">Crea una mappa</button></p>') : '<h2>Il tavolo è vuoto</h2><p>Aspetta che il DM vi porti in una scena: apparirà qui da sola.</p>'}</div></div>`;
      return;
    }
    st.innerHTML = `<div class="tv-world" id="tv-world"><img class="tv-map" id="tv-map" alt="" draggable="false" width="${sc.larghezza}" height="${sc.altezza}" style="width:${sc.larghezza}px;height:${sc.altezza}px">
      <svg class="tv-grid" id="tv-grid" width="${sc.larghezza}" height="${sc.altezza}"></svg><div id="tv-toks"></div><canvas class="tv-fog" id="tv-fog" style="width:${sc.larghezza}px;height:${sc.altezza}px"></canvas></div>
      <svg class="tv-ov" id="tv-ov"></svg><div class="tv-zoom"><button type="button" data-z="1.25" data-tip="Ingrandisci" aria-label="Ingrandisci">+</button><small id="tv-zp"></small><button type="button" data-z="0.8" data-tip="Rimpicciolisci" aria-label="Rimpicciolisci">−</button><button type="button" data-z="0" data-tip="Mostra tutta la mappa" aria-label="Mostra tutta la mappa">⤢</button></div>`;
    st.querySelectorAll('[data-z]').forEach(b => b.onclick = () => { const z = +b.dataset.z; if (!z) adatta(); else { const r = st.getBoundingClientRect(); zoom(z, r.width / 2, r.height / 2); } });
    const img = $('#tv-map');
    if (sc.mappa) urlMappa(sc.mappa).then(u => { if (img.isConnected) img.src = u; }).catch(e => toast('Mappa non caricata: ' + e.message, 'err'));
    else img.removeAttribute('src');
    disegnaGriglia(); disegnaMaschera(); disegnaToken(); interazioni(st); barraMaschera();
    if (centra || !T.viewOk) adatta(); else applicaVista();
  }
  function disegnaGriglia() {
    const sc = scena(), g = $('#tv-grid'); if (!sc || !g) return;
    const s = sc.griglia, ox = ((sc.griglia_x % s) + s) % s, oy = ((sc.griglia_y % s) + s) % s;
    g.innerHTML = sc.griglia_visibile ? `<defs><pattern id="tv-pat" width="${s}" height="${s}" x="${ox}" y="${oy}" patternUnits="userSpaceOnUse"><path d="M${s} 0H0V${s}" fill="none" stroke="${esc(sc.griglia_colore || '#000000')}" stroke-opacity="${(sc.griglia_opacita ?? 38) / 100}" stroke-width="1" vector-effect="non-scaling-stroke"/></pattern></defs><rect width="100%" height="100%" fill="url(#tv-pat)"/>` : '';
  }
  function adatta() {
    const st = $('#tv-stage'), sc = scena(); if (!st || !sc) return;
    const r = st.getBoundingClientRect(), z = Math.min(r.width / sc.larghezza, r.height / sc.altezza) * 0.96 || 1;
    T.view = { z, x: (r.width - sc.larghezza * z) / 2, y: (r.height - sc.altezza * z) / 2 }; T.viewOk = true; applicaVista();
  }
  function applicaVista() {
    const w = $('#tv-world'); if (w) w.style.transform = `translate(${T.view.x}px,${T.view.y}px) scale(${T.view.z})`;
    const zp = $('#tv-zp'); if (zp) zp.textContent = Math.round(T.view.z * 100) + '%';
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
    const vivi = new Set(lista.map(t => t.id)), att = T.turno?.find(x => x.id === T.stato?.turno);
    box.querySelectorAll('.tv-tok').forEach(el => { if (!vivi.has(el.dataset.id)) el.remove(); });
    lista.forEach((t, i) => {
      let el = tokEl(t.id);
      if (!el) { el = document.createElement('div'); el.className = 'tv-tok'; el.dataset.id = t.id; el.innerHTML = '<span class="ini"></span><b></b>'; }
      const lato = t.misura * sc.griglia;
      el.style.cssText = `left:${t.x}px;top:${t.y}px;width:${lato}px;height:${lato}px;--c:${t.colore};--fs:${Math.max(11, sc.griglia * 0.22)}px;z-index:${i + 1}${t.immagine ? `;background-image:url("${t.immagine.replace(/"/g, '%22')}")` : ''}`;
      if (T.drag?.id !== t.id) el.classList.remove('live');
      el.classList.toggle('turno', !!att && att.token === t.id);
      // i giocatori non vedono i token altrui sotto la maschera
      el.hidden = !isDM() && t.giocatore !== T.me.giocatore && coperto(t.x + lato / 2, t.y + lato / 2);
      el.classList.toggle('hid', !!t.nascosto);
      if (isDM()) { const qui = !!t.nascosto === (T.livello === 'master'); el.classList.toggle('altro', !qui); el.classList.toggle('qui', qui); }
      el.classList.toggle('mine', !!t.giocatore && t.giocatore === T.me.giocatore); el.classList.toggle('dm', isDM());
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
    const punti = new Map(); let pan = null, pinch = null, rul = null, mas = null, ultimo = 0;
    st.addEventListener('wheel', e => { e.preventDefault(); const r = st.getBoundingClientRect(); zoom(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    st.addEventListener('pointerdown', e => {
      if (e.button > 0 || !scena() || e.target.closest('.tv-zoom,.tv-pop')) return;
      chiudiPop();
      punti.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { st.setPointerCapture(e.pointerId); } catch { }
      if (punti.size === 2) { // due dita: ingrandimento, annullo il resto
        annullaDrag(); rul = fineRighello(rul, true); pan = null; if (mas) { mas = null; disegnaMaschera(); disegnaRighelli(); }
        const [a, b] = [...punti.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: T.view.z, v: { ...T.view } }; return;
      }
      if (punti.size > 2) return;
      const p = mondo(st, e), el = e.target.closest('.tv-tok'), t = el && T.tok.get(el.dataset.id);
      if (T.tool === 'maschera' && isDM()) { mas = inizioMaschera(p); return; }
      if (T.tool === 'allinea' && isDM()) { T.al = { a: p, b: p }; disegnaRighelli(); return; }
      if (T.tool === 'righello') { const sc = scena(); const a = { x: centroCasella(p.x, sc.griglia_x), y: centroCasella(p.y, sc.griglia_y) }; rul = { pts: [a, a] }; mostraRighello(rul.pts); return; }
      if (t && T.tool !== 'mano' && puoMuovere(t)) { T.drag = { id: t.id, dx: p.x - t.x, dy: p.y - t.y, x0: t.x, y0: t.y, sx: e.clientX, sy: e.clientY, mosso: false }; el.classList.add('drag'); return; }
      if (t && T.tool !== 'mano') T.clic = { id: t.id, sx: e.clientX, sy: e.clientY };
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
      if (mas) { muoviMaschera(mas, p); return; }
      if (T.al) { T.al.b = p; disegnaRighelli(); return; }
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
      if (mas) { const m = mas; mas = null; fineMaschera(m); return; }
      if (T.al) { const a = T.al; T.al = null; fineAllinea(a).catch(err => toast(err.message, 'err')); return; }
      if (rul) { rul = fineRighello(rul); return; }
      if (T.clic) { const c = T.clic; T.clic = null; if (e.type === 'pointerup') menuToken(c.id, e); }
      if (T.drag) {
        const d = T.drag; T.drag = null; const el = tokEl(d.id), t = T.tok.get(d.id);
        if (el) el.classList.remove('drag');
        if (!t) return;
        if (!d.mosso) { if (e.type === 'pointerup') menuToken(t.id, e); return; }
        const sc = scena(), x = aggancia(d.x, sc.griglia_x, t.misura), y = aggancia(d.y, sc.griglia_y, t.misura);
        t.x = x; t.y = y; disegnaToken(); manda('trascina', { id: t.id, x, y });
        const r = await SB.from('tavolo_token').update({ x, y }).eq('id', t.id).select().maybeSingle();
        if (r.error || !r.data) { t.x = d.x0; t.y = d.y0; disegnaToken(); manda('trascina', { id: t.id, x: d.x0, y: d.y0 }); toast(r.error?.message || 'Non puoi muovere questo token.', 'err'); }
      }
    };
    st.addEventListener('pointerup', su); st.addEventListener('pointercancel', su);
    // il cerchio del pennello della maschera segue il mouse
    st.addEventListener('pointermove', e => {
      const on = isDM() && T.tool === 'maschera' && T.mforma === 'pennello' && e.pointerType === 'mouse';
      if (!on && !T.pcur) return;
      T.pcur = on ? mondo(st, e) : null; disegnaRighelli();
    });
    st.addEventListener('pointerleave', () => { if (T.pcur) { T.pcur = null; disegnaRighelli(); } });
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
    }).join('') + (T.al ? quadroAllinea(T.al, v) : '') + (T.pcur && T.tool === 'maschera' && T.mforma === 'pennello' ? `<circle cx="${v.x + T.pcur.x * v.z}" cy="${v.y + T.pcur.y * v.z}" r="${(T.mraggio || sc.griglia) * v.z}" fill="none" stroke="#f2b51d" stroke-width="2" stroke-dasharray="6 4"/>` : '');
  }

  /* ---------- menu del token (DM) ---------- */
  function chiudiPop() { document.querySelectorAll('.tv-pop').forEach(p => p.remove()); }
  function menuToken(id, e) {
    const t = T.tok.get(id), st = $('#tv-stage'); if (!t || !st) return;
    chiudiPop();
    const r = st.getBoundingClientRect(), pop = document.createElement('div'); pop.className = 'tv-pop';
    const ini = `<div class="row"><span>Iniziativa</span><input type="number" data-k="imod" placeholder="mod" style="width:56px;font:inherit;padding:3px 5px;border-radius:4px;border:1px solid var(--line2);background:var(--paper2);color:var(--ink)"><button class="btn sm" data-k="ini" title="Tira 1d20 + modificatore e aggiungi all'ordine del turno">🎲 Tira</button></div>`;
    const ft = haFoto(t);
    if (!isDM()) {
      // il giocatore apre la foto (solo per sé) e, sul proprio token, tira l'iniziativa
      const mio = puoMuovere(t); if (!ft && !mio) return;
      pop.innerHTML = `<b>${esc(t.nome || 'Token')}</b>${ft ? '<button class="btn sm" data-k="foto">🖼 Apri la foto</button>' : ''}${mio ? ini : ''}`;
      st.append(pop);
      pop.style.left = clamp(e.clientX - r.left + 8, 6, r.width - pop.offsetWidth - 6) + 'px'; pop.style.top = clamp(e.clientY - r.top + 8, 6, r.height - pop.offsetHeight - 6) + 'px';
      if (ft) pop.querySelector('[data-k=foto]').onclick = () => { chiudiPop(); apriFoto(fotoDi(t)); };
      if (mio) pop.querySelector('[data-k=ini]').onclick = () => { chiudiPop(); iniziativa(t, pop.querySelector('[data-k=imod]').value); };
      return;
    }
    const gioc = (T.info.giocatori || []).map(g => `<option value="${esc(g.id)}" ${t.giocatore === g.id ? 'selected' : ''}>${esc(g.name)}</option>`).join('');
    pop.innerHTML = `<b>${esc(t.nome || 'Token')}</b>
      <button class="btn sm" data-k="nasc">${t.nascosto ? '⬆ Sposta nei Segnalini (lo vedono tutti)' : '👑 Sposta nel livello Master (solo tu)'}</button>
      <div class="row"><span>Misura</span><button class="btn sm" data-k="meno">−</button><span>${t.misura.toLocaleString('it-IT')}</span><button class="btn sm" data-k="piu">+</button></div>
      <div class="row"><span>Lo muove</span><select data-k="gioc"><option value="">solo il DM</option>${gioc}</select></div>
      ${ft ? '<div class="row"><span>Foto</span><button class="btn sm" data-k="foto" title="Solo sul tuo schermo">🖼 Apri</button><button class="btn sm" data-k="mostra" title="Si apre a schermo intero a tutti i giocatori">📣 Mostra a tutti</button></div>' : ''}
      ${ini}<button class="btn sm" data-k="nome">✎ Rinomina</button><button class="btn sm danger" data-k="via">Elimina</button>`;
    st.append(pop);
    const x = clamp(e.clientX - r.left + 8, 6, r.width - pop.offsetWidth - 6), y = clamp(e.clientY - r.top + 8, 6, r.height - pop.offsetHeight - 6);
    pop.style.left = x + 'px'; pop.style.top = y + 'px';
    const salva = async ch => {
      const r2 = await SB.from('tavolo_token').update(ch).eq('id', id).select().single();
      if (r2.error) { toast(r2.error.message, 'err'); return; }
      T.tok.set(id, r2.data); disegnaToken(); chiudiPop();
    };
    if (ft) {
      pop.querySelector('[data-k=foto]').onclick = () => { chiudiPop(); apriFoto(fotoDi(t)); };
      pop.querySelector('[data-k=mostra]').onclick = () => { chiudiPop(); const f = fotoDi(t); manda('foto', f); apriFoto(f); toast('Foto mostrata ai giocatori.'); };
    }
    pop.querySelector('[data-k=nasc]').onclick = async () => { await salva({ nascosto: !t.nascosto }); if (!t.nascosto) manda('nascosto', { id }); };
    pop.querySelector('[data-k=meno]').onclick = () => salva({ misura: t.misura > 1 ? t.misura - 1 : 0.5 });
    pop.querySelector('[data-k=piu]').onclick = () => salva({ misura: t.misura < 1 ? 1 : Math.min(10, t.misura + 1) });
    pop.querySelector('[data-k=gioc]').onchange = ev => salva({ giocatore: ev.target.value || null });
    pop.querySelector('[data-k=ini]').onclick = () => { chiudiPop(); iniziativa(t, pop.querySelector('[data-k=imod]').value); };
    pop.querySelector('[data-k=nome]').onclick = () => { const n = prompt('Nome del token', t.nome); if (n != null) salva({ nome: n.trim().slice(0, 60) }); };
    pop.querySelector('[data-k=via]').onclick = async () => {
      chiudiPop(); if (!await ask(`Eliminare il token **${t.nome || 'senza nome'}**?`, { ok: 'Elimina', danger: true, title: 'Elimina token' })) return;
      const r2 = await SB.from('tavolo_token').delete().eq('id', id); if (r2.error) return toast(r2.error.message, 'err');
      T.tok.delete(id); disegnaToken();
    };
  }

  /* ---------- foto del token a schermo intero ---------- */
  const ritratto = t => { const e = t.scheda && S.ents?.get(t.scheda); return e?.portrait || null; };
  const haFoto = t => !!(t.immagine || ritratto(t));
  const fotoDi = t => ({ nome: t.nome || '', scheda: t.scheda || null, immagine: t.immagine || null });
  function apriFoto(f, dalDM) {
    document.querySelectorAll('.tv-foto').forEach(x => x.remove());
    const e = f.scheda && S.ents?.get(f.scheda), prima = f.immagine || e?.portrait?.thumb;
    if (!prima && !e?.portrait) return;
    const o = document.createElement('div'); o.className = 'tv-foto'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-label', 'Foto di ' + (f.nome || 'token'));
    o.innerHTML = `<button type="button" aria-label="Chiudi">✕</button><img alt="${esc(f.nome)}" ${prima ? `src="${esc(prima)}"` : ''}><p>${esc(f.nome)}${dalDM ? '<small>Ve la mostra il DM · tocca per chiudere</small>' : ''}</p>`;
    document.body.append(o);
    let url = null;
    const chiudi = () => { o.remove(); removeEventListener('keydown', esc_); if (url) URL.revokeObjectURL(url); };
    const esc_ = ev => { if (ev.key === 'Escape') chiudi(); };
    o.onclick = chiudi; addEventListener('keydown', esc_); onCleanup(chiudi);
    // il ritratto a piena risoluzione, se la scheda è nel sito
    if (e?.portrait) dbGet('blobs', e.portrait.id).then(rec => { if (!rec?.blob || !o.isConnected) return; url = URL.createObjectURL(rec.blob); o.querySelector('img').src = url; }).catch(() => { });
  }

  /* ---------- aggiungi token (DM) ---------- */
  async function immagineToken(file) {
    const bmp = await loadBitmap(file), L = 200, c = document.createElement('canvas'); c.width = c.height = L;
    const w = bmp.width, h = bmp.height, s = Math.max(L / w, L / h);
    c.getContext('2d').drawImage(bmp, (L - w * s) / 2, (L - h * s) / 2, w * s, h * s); if (bmp.close) bmp.close();
    let u = c.toDataURL('image/webp', 0.85); if (!u.startsWith('data:image/webp')) u = c.toDataURL('image/jpeg', 0.85); return u;
  }
  // finestra di lato che lascia usare la mappa (si vedono i token mentre si aggiungono)
  function finestra(html, cls) {
    const d = document.createElement('dialog'); d.className = 'dlg ' + cls; d.innerHTML = html;
    document.body.append(d); d.addEventListener('close', () => setTimeout(() => d.remove(), 60));
    d.addEventListener('keydown', e => { if (e.key === 'Escape') d.close(); });
    onCleanup(() => { if (d.open) d.close(); });
    d.show(); return d;
  }
  function dlgToken() {
    const sc = scena(); if (!sc) return;
    const pg = (T.info.giocatori || []).map(g => { const e = S.ents.get(g.pg); return { nome: e?.name || g.name, img: e?.portrait?.thumb || null, giocatore: g.id, scheda: g.pg, colore: '#7d2530' }; });
    const png = [...S.ents.values()].filter(e => e.type === 'png').sort((a, b) => a.name.localeCompare(b.name)).map(e => ({ nome: e.name, img: e.portrait?.thumb || null, scheda: e.id, colore: e.cat === 'nemico' ? '#7d2530' : e.cat === 'alleato' ? '#3f7a4a' : '#3b5f8a' }));
    const cella = x => `<button type="button" data-i="${x.i}"><i style="--c:${x.colore};${x.img ? `background-image:url('${x.img}')` : ''}">${x.img ? '' : esc(iniziali(x.nome))}</i>${esc(x.nome)}</button>`;
    const tutti = [...pg, ...png]; tutti.forEach((x, i) => x.i = i);
    if ($('dialog.tv-side[open]')) return;
    const d = finestra(`<form method="dialog"><h3>Aggiungi un token</h3>
      <div class="tv-tabs"><button type="button" class="btn sm on" data-tab="pg">Personaggi</button><button type="button" class="btn sm" data-tab="png">PNG del sito</button><button type="button" class="btn sm" data-tab="nuovo">Nuovo</button></div>
      <div data-p="pg"><div class="tv-pick">${pg.map(cella).join('')}</div><p class="hint">Il token di un personaggio lo può muovere il suo giocatore.</p></div>
      <div data-p="png" hidden><input type="search" placeholder="Cerca un PNG…" style="width:100%;margin-bottom:8px;font:inherit;padding:6px 8px;border-radius:4px;border:1px solid var(--line2);background:var(--paper2);color:var(--ink)"><div class="tv-pick">${png.map(cella).join('') || '<p class="hint">Nessun PNG nel sito.</p>'}</div></div>
      <div data-p="nuovo" hidden><div class="tv-f"><label>Nome</label><input name="nome" maxlength="60" placeholder="Es. Bandito 1">
        <label>Colore</label><div class="tv-cols">${COLORI.map((c, i) => `<button type="button" style="--c:${c}" data-c="${c}" aria-pressed="${!i}" aria-label="Colore ${i + 1}"></button>`).join('')}</div>
        <label>Immagine</label><input type="file" name="img" accept="image/*"></div>
        <button type="button" class="btn primary" data-k="crea">Aggiungi</button></div>
      <div class="tv-f" style="margin-top:12px"><label>Misura</label><select name="mis"><option value="0.5">Minuscola (½ casella)</option><option value="1" selected>Media (1 casella)</option><option value="2">Grande (2×2)</option><option value="3">Enorme (3×3)</option><option value="4">Mastodontica (4×4)</option></select>
        <label>Livello</label><select name="liv"><option value="segnalini">Segnalini (lo vedono tutti)</option><option value="master" ${T.livello === 'master' ? 'selected' : ''}>Master (solo tu)</option></select></div>
      <menu><button value="cancel" class="btn ghost">Chiudi</button></menu></form>`, 'tv-side', true);
    d.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { d.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('on', x === b)); d.querySelectorAll('[data-p]').forEach(p => p.hidden = p.dataset.p !== b.dataset.tab); });
    const q = d.querySelector('[data-p=png] input'); q.oninput = () => { const s = norm(q.value); d.querySelectorAll('[data-p=png] [data-i]').forEach(b => b.hidden = !!s && !norm(b.textContent).includes(s)); };
    let colore = COLORI[0];
    d.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { colore = b.dataset.c; d.querySelectorAll('[data-c]').forEach(x => x.setAttribute('aria-pressed', x === b)); });
    const metti = async o => {
      const st = $('#tv-stage').getBoundingClientRect(), mis = +d.querySelector('[name=mis]').value, lato = mis * sc.griglia;
      // al centro di ciò che si sta guardando, un po' sfalsati se se ne aggiungono tanti
      const n = [...T.tok.values()].filter(t => t.scena === sc.id).length % 5;
      const cx = (st.width / 2 - T.view.x) / T.view.z - lato / 2 + n * sc.griglia * 0.5, cy = (st.height / 2 - T.view.y) / T.view.z - lato / 2;
      const row = { scena: sc.id, nome: o.nome, immagine: o.img || null, colore: o.colore, misura: mis, giocatore: o.giocatore || null, scheda: o.scheda || null, nascosto: d.querySelector('[name=liv]').value === 'master',
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
  function dlgNuovaScena() {
    const d = openDlg(`<form method="dialog"><h3>Nuova mappa</h3><p class="hint" style="margin-top:0">Preparala prima della sessione: i giocatori la vedono solo quando ce li porti.</p>
      <div class="tv-f"><label>Nome</label><input name="nome" maxlength="80" placeholder="Es. Taverna interno" autofocus>
        <label>Mappa</label><select name="src"><option value="file">Carica un'immagine</option>${S.maps.length ? '<option value="sito">Una mappa del sito</option>' : ''}<option value="vuota">Nessuna (solo griglia)</option></select>
        <label data-s="file">File</label><input data-s="file" type="file" name="file" accept="image/*">
        <label data-s="sito" hidden>Mappa</label><select data-s="sito" name="mappa" hidden>${S.maps.map(m => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('')}</select>
        <label data-s="vuota" hidden>Caselle</label><span data-s="vuota" hidden><input type="number" name="cw" value="30" min="5" max="200" style="width:70px"> × <input type="number" name="ch" value="20" min="5" max="200" style="width:70px"></span></div>
      <p class="hint" id="tv-scm"></p>
      <menu><button value="cancel" class="btn ghost">Annulla</button><button type="button" class="btn primary" data-k="crea">Crea la mappa</button></menu></form>`);
    const src = d.querySelector('[name=src]');
    src.onchange = () => d.querySelectorAll('[data-s]').forEach(x => x.hidden = x.dataset.s !== src.value);
    d.querySelector('[data-k=crea]').onclick = async ev => {
      const b = ev.currentTarget, msg = d.querySelector('#tv-scm'), nome = d.querySelector('[name=nome]').value.trim();
      if (!nome) { msg.textContent = 'Dai un nome alla mappa.'; return; }
      b.disabled = true; msg.textContent = 'Preparo la mappa…';
      try {
        // una casella ogni ~70 px è la misura più comune delle mappe da combattimento
        const row = { nome, griglia: 70 };
        let blob = null;
        let mini = null;
        if (src.value === 'file') { const f = d.querySelector('[name=file]').files[0]; if (!f) throw new Error('Scegli l\'immagine della mappa.'); const im = await processImage(f, 6000); blob = im.blob; mini = im.thumb; row.larghezza = im.w; row.altezza = im.h; }
        else if (src.value === 'sito') { const m = S.maps.find(x => x.id === d.querySelector('[name=mappa]').value); const rec = await dbGet('blobs', m.id); if (!rec?.blob) throw new Error('Immagine della mappa non trovata.'); blob = rec.blob; mini = m.thumb || null; row.larghezza = +m.w || 2000; row.altezza = +m.h || 1400; }
        else { row.larghezza = clamp(+d.querySelector('[name=cw]').value || 30, 5, 200) * 70; row.altezza = clamp(+d.querySelector('[name=ch]').value || 20, 5, 200) * 70; }
        if (blob) {
          msg.textContent = 'Carico la mappa (' + fmtSize(blob.size) + ')…';
          const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg'), path = 'scene/' + crypto.randomUUID() + '.' + ext;
          const up = await SB.storage.from(BUCKET).upload(path, blob, { contentType: blob.type || 'image/jpeg' });
          if (up.error) throw new Error(up.error.message);
          row.mappa = path;
          // l'anteprima per il pannello delle mappe (se manca la ricava il pannello)
          if (mini) await SB.storage.from(BUCKET).upload(miniPath(path), await dataBlob(mini), { contentType: 'image/jpeg', upsert: true }).catch(() => { });
        }
        const r = await SB.from('tavolo_scene').insert(row).select().single();
        if (r.error) throw new Error(r.error.message);
        T.scene.set(r.data.id, r.data);
        if (!T.stato.scena) { chk(await SB.from('tavolo_stato').update({ scena: r.data.id }).eq('id', 1)); T.stato.scena = r.data.id; }
        d.close();
        if (!$('#tv-pages').hidden) pannelloMappe(true);
        else { T.vista = r.data.id; disegnaBarra(); mostraScena(true); }
        toast('Mappa creata: regola la griglia da «Impostazioni della pagina» se non combacia.');
      } catch (e) { msg.textContent = e.tv ? ERR[e.tv][0] : e.message; b.disabled = false; }
    };
  }

  /* ---------- griglia (DM) ---------- */
  // i token restano sulle loro caselle anche con la griglia nuova
  function riaggancia(sc) {
    const sposta = [...T.tok.values()].filter(t => t.scena === sc.id).map(t => ({ t, x: aggancia(t.x, sc.griglia_x, t.misura), y: aggancia(t.y, sc.griglia_y, t.misura) })).filter(o => o.x !== o.t.x || o.y !== o.t.y);
    for (const o of sposta) { o.t.x = o.x; o.t.y = o.y; SB.from('tavolo_token').update({ x: o.x, y: o.y }).eq('id', o.t.id).then(() => { }); }
  }
  function dlgGriglia() {
    const sc = scena(); if (!sc) return;
    const prima = { ...sc };
    const d = openDlg(`<form method="dialog"><h3>Impostazioni della pagina</h3><p class="hint" style="margin-top:0">Cambia i valori guardando la mappa: la griglia si aggiorna subito. Fai combaciare una casella con un quadretto della mappa.</p>
      <div class="tv-f"><label>Nome</label><input name="nome" maxlength="80" value="${esc(sc.nome)}">
        <label>Casella (px)</label><span style="display:flex;gap:8px;align-items:center"><input type="range" name="g" min="10" max="300" step="0.5" value="${sc.griglia}" style="flex:1"><input type="number" name="gn" min="8" max="600" step="0.5" value="${sc.griglia}" style="width:80px"></span>
        <label>Sposta ↔</label><input type="range" name="gx" min="0" max="${sc.griglia}" step="0.5" value="${((sc.griglia_x % sc.griglia) + sc.griglia) % sc.griglia}">
        <label>Sposta ↕</label><input type="range" name="gy" min="0" max="${sc.griglia}" step="0.5" value="${((sc.griglia_y % sc.griglia) + sc.griglia) % sc.griglia}">
        <label></label><button type="button" class="btn sm" data-k="allinea" style="justify-self:start">📐 Allinea alla griglia disegnata sulla mappa</button>
        <label>Metri per casella</label><input type="number" name="m" min="0.1" max="1000" step="0.1" value="${sc.metri}">
        <label>Mostra la griglia</label><label style="justify-content:flex-start"><input type="checkbox" name="vis" ${sc.griglia_visibile ? 'checked' : ''}> sì</label>
        <label>Colore</label><input type="color" name="gc" value="${esc(sc.griglia_colore || '#000000')}">
        <label>Opacità</label><span style="display:flex;gap:8px;align-items:center"><input type="range" name="go" min="0" max="100" step="1" value="${sc.griglia_opacita ?? 38}" style="flex:1"><output name="gov" style="width:42px;text-align:right">${sc.griglia_opacita ?? 38}%</output></span></div>
      <menu><button value="cancel" class="btn ghost">Annulla</button><button value="ok" class="btn primary">Salva</button></menu></form>`, 'tv-gd');
    const v = n => d.querySelector(`[name=${n}]`);
    const prova = () => {
      sc.griglia = clamp(+v('gn').value || sc.griglia, 8, 600); sc.griglia_x = +v('gx').value; sc.griglia_y = +v('gy').value; sc.metri = +v('m').value || 1.5; sc.griglia_visibile = v('vis').checked;
      sc.griglia_colore = v('gc').value; sc.griglia_opacita = +v('go').value; v('gov').value = sc.griglia_opacita + '%';
      v('gx').max = v('gy').max = sc.griglia; disegnaGriglia(); disegnaToken();
    };
    v('g').oninput = () => { v('gn').value = v('g').value; prova(); };
    v('gn').oninput = () => { v('g').value = v('gn').value; prova(); };
    ['gx', 'gy', 'm', 'vis', 'gc', 'go'].forEach(n => v(n).oninput = prova);
    d.querySelector('[data-k=allinea]').onclick = () => { d.close('cancel'); setTimeout(() => { strumento('allinea'); toast('Disegna un riquadro su alcune caselle della mappa.'); }, 80); };
    d.addEventListener('close', async () => {
      if (d.returnValue !== 'ok') { Object.assign(sc, prima); disegnaGriglia(); disegnaToken(); return; }
      const ch = { nome: v('nome').value.trim().slice(0, 80) || prima.nome, griglia: sc.griglia, griglia_x: sc.griglia_x, griglia_y: sc.griglia_y, metri: sc.metri, griglia_visibile: sc.griglia_visibile };
      // colore e opacità solo se cambiati: servono le colonne di tappa-2b.sql
      if (sc.griglia_colore !== (prima.griglia_colore || '#000000')) ch.griglia_colore = sc.griglia_colore;
      if (sc.griglia_opacita !== (prima.griglia_opacita ?? 38)) ch.griglia_opacita = sc.griglia_opacita;
      const r = await SB.from('tavolo_scene').update(ch).eq('id', sc.id).select().single();
      if (r.error) { Object.assign(sc, prima); disegnaGriglia(); disegnaToken(); return toast(sqlMancante(r.error) ? 'Per colore e opacità della griglia esegui tavolo/tappa-2b.sql in Supabase.' : r.error.message, 'err'); }
      T.scene.set(sc.id, r.data);
      riaggancia(sc); disegnaToken(); disegnaTop(); toast('Impostazioni salvate.');
    });
  }

  /* ---------- dadi ---------- */
  /* ---------- tiradadi, come su Roll20: quanti dadi e di che tipo, con il modificatore ---------- */
  function disegnaTdp() {
    const p = $('#tv-tdp'); if (!p || p.hidden) return;
    const mod = p.querySelector('[data-k=mod]')?.value || '', mot = p.querySelector('[data-k=mot]')?.value || '';
    p.innerHTML = `<div class="hd"><b>Tiradadi</b><button type="button" data-act="tv-tiradadi" aria-label="Chiudi">✕</button></div>
      <div class="tabs"><button type="button" data-v="0" class="${T.tdpriv ? '' : 'on'}">Tutti</button><button type="button" data-v="1" class="${T.tdpriv ? 'on' : ''}">${isDM() ? 'Solo io' : 'Solo al DM'}</button></div>
      <div class="mods"><input type="number" data-k="mod" placeholder="Mod" style="width:64px" aria-label="Modificatore" value="${esc(mod)}"><input type="text" data-k="mot" placeholder="Per cosa? (facoltativo)" style="flex:1" maxlength="80" value="${esc(mot)}"></div>
      <table>${DADI.map(f => `<tr><td><button type="button" data-n="1" data-f="${f}">D${f}</button></td>${[2, 3, 4, 5, 6].map(n => `<td><button type="button" data-n="${n}" data-f="${f}" aria-label="${n}d${f}">${n}</button></td>`).join('')}</tr>`).join('')}</table>
      <p class="ft">Clicca il dado per tirarne uno, o un numero per tirarne di più.</p>`;
    p.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { T.tdpriv = b.dataset.v === '1'; disegnaTdp(); });
    p.querySelectorAll('td button').forEach(b => b.onclick = async () => {
      const m = Math.trunc(+p.querySelector('[data-k=mod]').value || 0), f = b.dataset.n + 'd' + b.dataset.f + (m ? (m > 0 ? '+' : '') + m : '');
      const mt = p.querySelector('[data-k=mot]');
      if (await tira(f, null, T.tdpriv, mt.value.trim())) mt.value = '';
    });
  }

  // la chat resta aperta; la linguetta sul bordo la chiude e la riapre (si ricorda la scelta)
  const CHAT = 'tavolo-chat';
  function apriChat(apri, salva) {
    const box = $('#tv-dice'), tab = $('#tv-ctab'); if (!box) return;
    box.hidden = !apri;
    if (salva) try { localStorage.setItem(CHAT, apri ? '1' : '0'); } catch { }
    if (tab) { const tel = matchMedia('(max-width:820px)').matches; tab.textContent = tel ? (apri ? '⌄' : '💬') : apri ? '›' : '‹'; tab.classList.toggle('chiusa', !apri); tab.dataset.tip = apri ? 'Chiudi la chat' : 'Apri la chat'; tab.setAttribute('aria-label', tab.dataset.tip); if (apri) tab.classList.remove('nuovo'); }
    if (apri) { const l = $('#tv-log'); if (l) l.scrollTop = 1e9; }
  }
  function disegnaDadi() {
    const box = $('#tv-dice'); if (!box) return;
    if (!T.diceInit) { let v = null; try { v = localStorage.getItem(CHAT); } catch { } apriChat(v ? v === '1' : matchMedia('(min-width:821px)').matches); }
    T.diceInit = true;
    box.innerHTML = `<div class="tv-dh"><span>Chat</span></div><div class="tv-log" id="tv-log"></div>
      <div class="tv-dk"><div class="row">${DADI.map(n => `<button class="btn sm" data-act="tv-d" data-n="${n}">d${n}</button>`).join('')}</div>
      <div class="row"><input type="number" id="tv-mod" placeholder="Mod." style="width:64px" aria-label="Modificatore"><button class="btn sm" data-act="tv-vant" title="2d20, tiene il più alto">Vantaggio</button><button class="btn sm" data-act="tv-svant" title="2d20, tiene il più basso">Svantaggio</button></div>
      <div class="row"><input type="text" id="tv-mot" placeholder="Per cosa? (facoltativo)" style="flex:1" maxlength="80" aria-label="Motivo"></div>
      <label><input type="checkbox" id="tv-priv"> ${isDM() ? 'Tiro nascosto (solo io)' : 'Tiro segreto (solo io e il DM)'}</label>
      <div class="row"><input type="text" id="tv-f" placeholder="Scrivi… /r 1d20+5 · /gr · /w nome" style="flex:1" autocomplete="off" aria-label="Scrivi un tiro"><button class="btn sm primary" data-act="tv-tira" style="flex:none">Invia</button></div></div>`;
    $('#tv-f').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); scrivi(); } };
    $('#tv-log').onclick = e => { const b = e.target.closest('[data-del]'); if (b) cancella(b.dataset.del).catch(err => toast(err.message, 'err')); };
    disegnaBarra(); disegnaLog();
  }
  const conMod = f => { const m = Math.trunc(+$('#tv-mod')?.value || 0); return m ? f + (m > 0 ? '+' : '') + m : f; };
  function dadiActs() {
    return {
      'tv-d': b => tira(conMod('1d' + b.dataset.n)),
      'tv-vant': () => tira(conMod('2d20kh1'), 'vantaggio'), 'tv-svant': () => tira(conMod('2d20kl1'), 'svantaggio'),
      'tv-tira': () => scrivi()
    };
  }
  // la riga in fondo alla chat, come su Roll20: /r 1d20+5, /gr (o /gmroll) per un tiro segreto, oppure solo la formula
  // /w nome testo (o /w dm testo) sussurra; il resto è un messaggio per tutti, oppure un tiro se è solo una formula
  async function scrivi() {
    const f = $('#tv-f'), t = f.value.trim(); if (!t) return;
    const m = t.match(/^\/(r|roll|gr|gmroll)\s+(.+)$/i);
    if (m || /^\d*d\d+[\sd\d+\-khl]*$/i.test(t)) { if (await tira(m ? m[2] : t, null, m ? /^g/i.test(m[1]) : undefined)) f.value = ''; return; }
    let testo = t, per = null;
    const w = t.match(/^\/w\s+(\S+)\s+([\s\S]+)$/i);
    if (w) {
      const chi = norm(w[1]);
      if (chi === 'dm' || chi === 'gm') per = 'dm';
      else { const g = T.membri.find(x => x.giocatore && (norm(x.nome) === chi || x.giocatore === chi)); if (!g) { toast('Nessun giocatore si chiama «' + w[1] + '»', 'err'); return; } per = g.giocatore; }
      testo = w[2];
    } else if (/^\//.test(t)) { toast('Comandi: /r 1d20+5 · /gr 1d20 (segreto) · /w nome messaggio', 'err'); return; }
    const r = await SB.rpc('tavolo_scrivi', { p_testo: testo, p_per: per });
    if (r.error) { toast(r.error.message, 'err'); return; }
    f.value = ''; const row = Array.isArray(r.data) ? r.data[0] : r.data;
    if (row && !T.chat.some(x => x.id === row.id)) { T.chat.push(row); nuovoMsg(row); }
  }
  async function tira(formula, extra, segreto, motivo) {
    formula = String(formula || '').trim(); if (!formula) return false;
    const mot = [motivo ?? $('#tv-mot')?.value.trim(), extra].filter(Boolean).join(' · ');
    const r = await SB.rpc('tavolo_tira', { p_formula: formula, p_motivo: mot || null, p_privato: segreto ?? !!$('#tv-priv')?.checked });
    if (r.error) { toast(r.error.message, 'err'); return false; }
    const t = Array.isArray(r.data) ? r.data[0] : r.data;
    if (motivo == null && $('#tv-mot')) $('#tv-mot').value = '';
    if (t && !T.tiri.some(x => x.id === t.id)) { T.tiri.push(t); nuovoTiro(t); }
    return true;
  }
  // 20 o 1 naturale su un tiro di d20
  function esito(t) {
    const m = String(t.dettaglio).match(/^(?:\dd20(?:k[hl]1)?) \[(?:[^\]]*→ )?(\d+)\]/);
    return m ? (m[1] === '20' ? 'crit' : m[1] === '1' ? 'fail' : '') : '';
  }
  const ora = d => new Date(d).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  const via = (k, x) => isDM() || x.autore === T.me.uid ? `<button type="button" class="del" data-del="${k}:${x.id}" title="Elimina il messaggio" aria-label="Elimina il messaggio">✕</button>` : '';
  const tagTiro = t => !t.privato ? '' : `<div class="tag">🙈 Tiro nascosto · ${isDM() ? (t.autore === T.me.uid ? 'lo vedi solo tu' : 'lo vedete solo tu e ' + esc(t.nome)) : 'lo vedete solo tu e il DM'}</div>`;
  const tagMsg = m => !m.per ? '' : `<div class="tag">🤫 Sussurro · ${m.autore === T.me.uid ? 'a ' + esc(nomeGioc(m.per)) : m.per === 'dm' && isDM() ? 'per te' : 'solo per te'}</div>`;
  // «2d6 [4, 3] + 1d4 [2] − 1» → caselle per ogni dado e i modificatori
  function chips(det) {
    return esc(det).replace(/(\d+)d(\d+)(k[hl]\d+)? \[([^\]]*)\]/g, (_, n, f, k, lista) => {
      const [tutti, tenuti] = lista.split(' → ');
      const resto = tenuti ? tenuti.split(', ').map(Number) : null;
      return tutti.split(', ').map(v => {
        let cls = +v === +f ? 'max' : +v === 1 ? 'min' : '';
        if (resto) { const i = resto.indexOf(+v); if (i < 0) cls = 'no'; else resto.splice(i, 1); }
        return `<i class="${cls}" title="d${f}">${v}</i>`;
      }).join('');
    });
  }
  const rigaTiro = t => `<div class="tv-roll ${esito(t)} ${t.privato ? 'priv' : ''} ${t.autore === T.me.uid ? 'me' : ''}">${tagTiro(t)}<div class="h"><span>${esc(t.nome)}</span><span class="dx"><small>${ora(t.creato)}</small>${via('t', t)}</span></div>
    ${t.motivo ? `<div class="m">${esc(t.motivo)}</div>` : ''}<div class="fo">tira ${esc(t.formula)}</div><div class="r"><span class="chips">${chips(t.dettaglio)}</span><span class="t">${t.totale}</span></div></div>`;
  const nomeGioc = id => id === 'dm' ? 'DM' : T.membri.find(x => x.giocatore === id)?.nome || id;
  const rigaMsg = m => `<div class="tv-roll tv-msg ${m.per ? 'w' : ''} ${m.autore === T.me.uid ? 'me' : ''}">${tagMsg(m)}<div class="h"><span class="who">${esc(m.nome)}</span><span class="dx"><small>${ora(m.creato)}</small>${via('c', m)}</span></div><div class="tx">${esc(m.testo)}</div></div>`;
  async function cancella(k) {
    const [tipo, id] = k.split(':'), tab = tipo === 't' ? 'tavolo_tiri' : 'tavolo_chat';
    const r = await SB.from(tab).delete().eq('id', +id).select('id');
    if (r.error) throw new Error(sqlMancante(r.error) ? 'Esegui tavolo/tappa-2b.sql in Supabase.' : r.error.message);
    if (!r.data?.length) throw new Error('Non puoi cancellare questo messaggio: esegui tavolo/tappa-2b.sql in Supabase.');
    if (tipo === 't') T.tiri = T.tiri.filter(x => x.id !== +id); else T.chat = T.chat.filter(x => x.id !== +id);
    disegnaLog();
  }
  function disegnaLog() {
    const l = $('#tv-log'); if (!l) return;
    const tutto = [...T.tiri.map(t => [t.creato, rigaTiro(t)]), ...(T.chat || []).map(m => [m.creato, rigaMsg(m)])].sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
    l.innerHTML = tutto.map(x => x[1]).join('') || '<p class="hint">Nessun messaggio ancora. Tiri e messaggi li vedono tutti al tavolo.</p>';
    l.scrollTop = 1e9;
  }
  function nuovoMsg(m) {
    disegnaLog();
    if ($('#tv-dice')?.hidden && m.autore !== T.me.uid) { $('#tv-ctab')?.classList.add('nuovo'); toast(`${m.nome}${m.per ? ' (sussurro)' : ''}: ${m.testo.slice(0, 120)}`); }
  }
  function nuovoTiro(t) {
    disegnaLog(); lancia(t);
    if ($('#tv-dice')?.hidden) { $('#tv-ctab')?.classList.add('nuovo'); toast(`${t.nome}${t.motivo ? ' (' + t.motivo + ')' : ''}: ${t.formula} = ${t.totale}`); }
  }
  /* ---------- dadi che rotolano sulla mappa ---------- */
  const FORME = {
    4: { p: '50,8 94,88 6,88', l: '', y: 64 },
    6: { p: '12,12 88,12 88,88 12,88', l: '', y: 50 },
    8: { p: '50,4 94,50 50,96 6,50', l: 'M6 50H94', y: 52 },
    10: { p: '50,4 93,40 50,96 7,40', l: 'M7 40L50 58L93 40M50 58V96', y: 40 },
    12: { p: '50,4 95,37 78,92 22,92 5,37', l: 'M50 22L72 38L64 66H36L28 38Z', y: 48 },
    20: { p: '50,3 92,27 92,73 50,97 8,73 8,27', l: 'M50 22L78 68H22ZM50 3V22M8 27L50 22L92 27M8 73L22 68M92 73L78 68M22 68L50 97L78 68', y: 52 },
    100: { p: '50,4 93,40 50,96 7,40', l: 'M7 40L50 58L93 40M50 58V96', y: 40 }
  };
  const COL_DADI = ['#3b5bdb', '#c2255c', '#2b8a3e', '#e8590c', '#7048e8', '#0b7285', '#a61e4d', '#5f3dc4'];
  const coloreDi = uid => { let h = 0; for (const c of String(uid)) h = (h * 31 + c.charCodeAt(0)) | 0; return COL_DADI[Math.abs(h) % COL_DADI.length]; };
  function svgDado(f, v, col) {
    const s = FORME[f] || FORME[20], id = 'g' + Math.random().toString(36).slice(2, 8);
    return `<svg viewBox="0 0 100 100"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient></defs>
      ${f === 6 ? `<rect x="10" y="10" width="80" height="80" rx="14" fill="${col}" stroke="#0007" stroke-width="3"/><rect x="10" y="10" width="80" height="80" rx="14" fill="url(#${id})"/>` : `<polygon points="${s.p}" fill="${col}" stroke="#0007" stroke-width="3" stroke-linejoin="round"/><polygon points="${s.p}" fill="url(#${id})"/>`}
      ${s.l ? `<path d="${s.l}" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="2"/>` : ''}<text x="50" y="${s.y}">${v}</text></svg>`;
  }
  // i dadi entrano da un angolo, rimbalzano e si fermano sul risultato vero (deciso dal server)
  function lancia(t) {
    const st = $('#tv-stage'); if (!st || !scena() || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const dadi = [];
    String(t.dettaglio).replace(/(\d+)d(\d+)(k[hl]\d+)? \[([^\]]*)\]/g, (_, n, f, k, lista) => {
      const [tutti, tenuti] = lista.split(' → '), resto = tenuti ? tenuti.split(', ').map(Number) : null;
      for (const v of tutti.split(', ').map(Number)) {
        let via = false; if (resto) { const i = resto.indexOf(v); if (i < 0) via = true; else resto.splice(i, 1); }
        dadi.push({ f: +f, v, via });
      }
    });
    if (!dadi.length) return;
    let box = $('.tv-d3', st); if (!box) { box = document.createElement('div'); box.className = 'tv-d3'; st.append(box); }
    const W = st.clientWidth, H = st.clientHeight, col = coloreDi(t.autore), mostra = dadi.slice(0, 20);
    const da = { x: -40, y: H + 40 }, cx = W * (0.3 + Math.random() * 0.4), cy = H * (0.35 + Math.random() * 0.3);
    mostra.forEach((d, i) => {
      const el = document.createElement('div'); el.className = 'dd' + (d.via ? ' via' : ''); box.append(el);
      const ang = (i / mostra.length) * Math.PI * 2 + Math.random(), r = mostra.length > 1 ? 40 + mostra.length * 6 : 0;
      const x = clamp(cx + Math.cos(ang) * r, 40, W - 40), y = clamp(cy + Math.sin(ang) * r, 40, H - 40);
      const mx = (da.x + x) / 2 + (Math.random() - 0.5) * 120, rot = 360 * (2 + Math.floor(Math.random() * 2)), fin = (Math.random() - 0.5) * 40, dur = 1100 + Math.random() * 300;
      el.animate([
        { transform: `translate(${da.x}px,${da.y}px) rotate(0deg) scale(.6)` },
        { transform: `translate(${mx}px,${y - 140}px) rotate(${rot * 0.55}deg) scale(1.15)`, offset: 0.45 },
        { transform: `translate(${x - 18}px,${y}px) rotate(${rot * 0.85}deg) scale(1)`, offset: 0.72 },
        { transform: `translate(${x - 6}px,${y - 26}px) rotate(${rot * 0.95}deg) scale(1.05)`, offset: 0.84 },
        { transform: `translate(${x}px,${y}px) rotate(${rot + fin}deg) scale(1)` }
      ], { duration: dur, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' });
      // durante il volo le facce cambiano, poi resta il risultato
      const gira = setInterval(() => { el.innerHTML = svgDado(d.f, 1 + Math.floor(Math.random() * d.f), col); }, 80);
      el.innerHTML = svgDado(d.f, d.v, col);
      setTimeout(() => { clearInterval(gira); el.innerHTML = svgDado(d.f, d.v, col); }, dur * 0.8);
      setTimeout(() => el.animate([{ opacity: d.via ? 0.45 : 1 }, { opacity: 0 }], { duration: 500, fill: 'forwards' }).onfinish = () => el.remove(), dur + 2600);
    });
  }

  /* ---------- maschera (DM): la mappa coperta che si svela a pezzi, come la nebbia di Roll20 ---------- */
  const NERO = '#0b0807', FOG_MAX = 2048, TONO = 'tavolo-tono';
  // quanto il DM vede scura la maschera (solo sul suo schermo: i giocatori la vedono sempre nera)
  const tono = () => { try { const v = parseFloat(localStorage.getItem(TONO)); return v >= 0.1 && v <= 0.95 ? v : 0.5; } catch { return 0.5; } };
  function applica(g, o) {
    g.globalCompositeOperation = o.svela ? 'destination-out' : 'source-over';
    g.fillStyle = g.strokeStyle = NERO;
    const p = o.punti;
    if (o.forma === 'rett') { g.fillRect(p[0], p[1], p[2], p[3]); return; }
    g.lineWidth = o.raggio * 2; g.lineCap = g.lineJoin = 'round';
    g.beginPath(); g.moveTo(p[0], p[1]);
    for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]);
    if (p.length === 2) g.lineTo(p[0] + 0.01, p[1]);
    g.stroke();
  }
  function disegnaMaschera() {
    const c = $('#tv-fog'), sc = scena(); if (!c || !sc) return;
    if (!sc.maschera) { c.hidden = true; return; }
    // la tela è più piccola della mappa (al massimo 2048 px di lato): basta per i bordi e pesa poco
    const k = Math.min(1, FOG_MAX / Math.max(sc.larghezza, sc.altezza)), W = Math.max(1, Math.round(sc.larghezza * k)), H = Math.max(1, Math.round(sc.altezza * k));
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const g = c.getContext('2d', { willReadFrequently: true });
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W, H);
    g.setTransform(k, 0, 0, k, 0, 0); g.fillStyle = NERO; g.fillRect(0, 0, sc.larghezza, sc.altezza);
    for (const o of T.mask.filter(m => m.scena === sc.id).sort((a, b) => a.id - b.id)) applica(g, o);
    c.hidden = false; c.style.opacity = isDM() ? tono() : 1; T.fogK = k;
  }
  function coperto(x, y) {
    const sc = scena(), c = $('#tv-fog'); if (!sc?.maschera || !c || c.hidden) return false;
    const k = T.fogK || 1, d = c.getContext('2d', { willReadFrequently: true }).getImageData(clamp(Math.floor(x * k), 0, c.width - 1), clamp(Math.floor(y * k), 0, c.height - 1), 1, 1).data;
    return d[3] > 128;
  }
  function programmaMaschera() { cancelAnimationFrame(T.mraf); T.mraf = requestAnimationFrame(() => { disegnaMaschera(); disegnaToken(); }); }
  function barraMaschera() {
    const b = $('#tv-mbar'), sc = scena(); if (!b) return;
    if (T.tool === 'allinea' && isDM() && sc) return barraAllinea(b);
    if (T.tool !== 'maschera' || !isDM() || !sc) { b.hidden = true; disegnaRighelli(); return; }
    if (!T.mraggio) T.mraggio = sc.griglia;
    const on = sc.maschera, dis = on ? '' : 'disabled', bt = (k, l, sel, tip) => `<button type="button" data-m="${k}" class="${sel ? 'on' : ''}" ${k === 'attiva' ? '' : dis} title="${esc(tip || l)}">${l}</button>`;
    b.innerHTML = `<label title="Con la maschera attiva la mappa parte tutta coperta per i giocatori"><input type="checkbox" data-m="attiva" ${on ? 'checked' : ''}> Maschera attiva</label><span class="sep"></span>
      ${bt('svela', '👁 Svela', T.mmodo === 'svela', 'Togli la maschera dove trascini')}${bt('copri', '◼ Copri', T.mmodo === 'copri', 'Rimetti la maschera dove trascini')}<span class="sep"></span>
      ${bt('rett', '▭ Rettangolo', T.mforma === 'rett')}${bt('pennello', '🖌 Pennello', T.mforma === 'pennello')}
      ${T.mforma === 'pennello' ? `<label title="Grandezza del pennello, in caselle">Grandezza <input type="range" data-m="raggio" min="0.25" max="10" step="0.25" value="${T.mraggio / sc.griglia}" ${dis}><output data-m="rv">${fmtCas(T.mraggio / sc.griglia)}</output></label>` : ''}<span class="sep"></span>
      ${bt('annulla', '↶ Annulla', false, 'Annulla l\'ultima modifica')}${bt('tutto', 'Svela tutto', false)}${bt('niente', 'Copri tutto', false)}<span class="sep"></span>
      <label title="Solo per te: i giocatori la vedono sempre nera">Tonalità <input type="range" data-m="tono" min="0.1" max="0.95" step="0.05" value="${tono()}" ${dis}></label>`;
    b.hidden = false;
    b.querySelector('[data-m=attiva]').onchange = async e => {
      const r = await SB.from('tavolo_scene').update({ maschera: e.target.checked }).eq('id', sc.id).select().single();
      if (r.error) { toast(r.error.message, 'err'); e.target.checked = !e.target.checked; return; }
      T.scene.set(sc.id, r.data); programmaMaschera(); barraMaschera();
    };
    b.querySelectorAll('button[data-m]').forEach(x => x.onclick = () => azioneMaschera(x.dataset.m).catch(err => toast(err.message, 'err')));
    const rg = b.querySelector('[data-m=raggio]'); if (rg) rg.oninput = () => { T.mraggio = +rg.value * sc.griglia; b.querySelector('[data-m=rv]').value = fmtCas(+rg.value); };
    const tn = b.querySelector('[data-m=tono]'); tn.oninput = () => { try { localStorage.setItem(TONO, tn.value); } catch { } const c = $('#tv-fog'); if (c) c.style.opacity = tn.value; };
  }
  // allineamento: si disegna un riquadro su N×N caselle della griglia stampata sulla mappa
  function quadroAllinea(a, v) {
    const n = T.allN, x = Math.min(a.a.x, a.b.x), y = Math.min(a.a.y, a.b.y), L = (Math.abs(a.b.x - a.a.x) + Math.abs(a.b.y - a.a.y)) / 2;
    if (L < 2) return '';
    const X = v.x + x * v.z, Y = v.y + y * v.z, S = L * v.z;
    let h = `<rect x="${X}" y="${Y}" width="${S}" height="${S}" fill="#f2b51d22" stroke="#f2b51d" stroke-width="2"/>`;
    for (let i = 1; i < n; i++) h += `<path d="M${X + S * i / n} ${Y}V${Y + S}M${X} ${Y + S * i / n}H${X + S}" stroke="#f2b51d" stroke-width="1" stroke-dasharray="4 3"/>`;
    return h + `<text x="${X + S + 8}" y="${Y - 6}">${n}×${n} · ${(L / n).toFixed(1)} px</text>`;
  }
  function barraAllinea(b) {
    b.innerHTML = `<b style="font-family:var(--display);color:var(--gold2)">📐 Allinea la griglia</b><span class="sep"></span>
      <label>Riquadro di <select data-a="n" style="font:inherit;background:#0005;color:#fff;border:1px solid #ffffff33;border-radius:4px">${[1, 2, 3, 4, 5, 6, 8, 10].map(n => `<option value="${n}" ${n === T.allN ? 'selected' : ''}>${n}×${n}</option>`).join('')}</select> caselle</label>
      <span style="font-size:.82rem;color:#c9b89a;white-space:normal;max-width:360px">Trascina partendo dall'angolo di una casella della mappa fino all'angolo opposto: più caselle prendi, più è preciso.</span>
      <button type="button" data-a="esci">Annulla</button>`;
    b.hidden = false;
    b.querySelector('[data-a=n]').onchange = e => { T.allN = +e.target.value; };
    b.querySelector('[data-a=esci]').onclick = () => { strumento('muovi'); dlgGriglia(); };
  }
  async function fineAllinea(a) {
    const sc = scena(); disegnaRighelli(); if (!sc) return;
    const L = (Math.abs(a.b.x - a.a.x) + Math.abs(a.b.y - a.a.y)) / 2; if (L < 8) return;
    const g = Math.round(L / T.allN * 100) / 100, x0 = Math.min(a.a.x, a.b.x), y0 = Math.min(a.a.y, a.b.y);
    if (g < 8) { toast('Riquadro troppo piccolo: ingrandisci la mappa e riprova.', 'err'); return; }
    const ch = { griglia: g, griglia_x: Math.round((((x0 % g) + g) % g) * 10) / 10, griglia_y: Math.round((((y0 % g) + g) % g) * 10) / 10 };
    const r = await SB.from('tavolo_scene').update(ch).eq('id', sc.id).select().single();
    if (r.error) throw new Error(r.error.message);
    Object.assign(sc, r.data); T.scene.set(sc.id, sc); riaggancia(sc);
    strumento('muovi'); disegnaGriglia(); disegnaToken();
    toast(`Griglia allineata: casella di ${g} px. Rifinisci qui se serve.`);
    dlgGriglia();
  }
  const fmtCas = n => n.toLocaleString('it-IT') + (n === 1 ? ' casella' : ' caselle');
  async function azioneMaschera(k) {
    const sc = scena(); if (!sc) return;
    if (k === 'svela' || k === 'copri') T.mmodo = k;
    else if (k === 'rett' || k === 'pennello') T.mforma = k;
    else {
      const mie = T.mask.filter(m => m.scena === sc.id);
      if (k === 'annulla') { const u = mie.sort((a, b) => b.id - a.id)[0]; if (!u) return; chk(await SB.from('tavolo_maschera').delete().eq('id', u.id)); T.mask = T.mask.filter(m => m.id !== u.id); }
      else {
        if (k === 'niente' && !await ask('Ricoprire tutta la mappa?', { ok: 'Copri tutto', title: 'Maschera' })) return;
        if (mie.length) chk(await SB.from('tavolo_maschera').delete().in('id', mie.map(m => m.id)));
        T.mask = T.mask.filter(m => m.scena !== sc.id);
        if (k === 'tutto') await salvaMaschera({ scena: sc.id, svela: true, forma: 'rett', punti: [0, 0, sc.larghezza, sc.altezza] });
      }
      programmaMaschera();
    }
    barraMaschera();
  }
  async function salvaMaschera(o) {
    const r = await SB.from('tavolo_maschera').insert(o).select().single();
    if (r.error) { toast(r.error.message, 'err'); programmaMaschera(); return; }
    if (!T.mask.some(m => m.id === r.data.id)) T.mask.push(r.data);
    programmaMaschera();
  }
  function inizioMaschera(p) {
    const sc = scena(); if (!sc) return null;
    if (!sc.maschera) { toast('Attiva prima la maschera su questa mappa.'); return null; }
    const m = { svela: T.mmodo === 'svela', forma: T.mforma, a: p, b: p, punti: [Math.round(p.x), Math.round(p.y)], raggio: T.mraggio || sc.griglia };
    if (m.forma === 'pennello') { const c = $('#tv-fog'); if (c) applica(c.getContext('2d'), m); }
    return m;
  }
  function muoviMaschera(m, p) {
    if (!m) return;
    if (m.forma === 'rett') {
      m.b = p; disegnaRighelli();
      const ov = $('#tv-ov'), v = T.view, x = v.x + Math.min(m.a.x, p.x) * v.z, y = v.y + Math.min(m.a.y, p.y) * v.z;
      if (ov) ov.insertAdjacentHTML('beforeend', `<rect x="${x}" y="${y}" width="${Math.abs(p.x - m.a.x) * v.z}" height="${Math.abs(p.y - m.a.y) * v.z}" fill="${m.svela ? '#ffffff22' : '#00000066'}" stroke="#f2b51d" stroke-width="2" stroke-dasharray="8 5"/>`);
      return;
    }
    const n = m.punti.length, dx = p.x - m.punti[n - 2], dy = p.y - m.punti[n - 1];
    if (Math.hypot(dx, dy) < m.raggio / 4) return;
    const c = $('#tv-fog'); if (c) applica(c.getContext('2d'), { ...m, punti: [m.punti[n - 2], m.punti[n - 1], Math.round(p.x), Math.round(p.y)] });
    m.punti.push(Math.round(p.x), Math.round(p.y));
  }
  function fineMaschera(m) {
    const sc = scena(); if (!m || !sc) return;
    disegnaRighelli();
    if (m.forma === 'rett') {
      const x = Math.min(m.a.x, m.b.x), y = Math.min(m.a.y, m.b.y), w = Math.abs(m.b.x - m.a.x), h = Math.abs(m.b.y - m.a.y);
      if (w < 3 || h < 3) return;
      return salvaMaschera({ scena: sc.id, svela: m.svela, forma: 'rett', punti: [Math.round(x), Math.round(y), Math.round(w), Math.round(h)] });
    }
    return salvaMaschera({ scena: sc.id, svela: m.svela, forma: 'pennello', punti: m.punti, raggio: m.raggio });
  }

  /* ---------- ordine del turno ---------- */
  function apriTurno(apri) { const b = $('#tv-turno'); if (!b) return; b.hidden = !apri; disegnaTurno(); disegnaRail(); }
  const ordinati = () => [...T.turno].sort((a, b) => b.valore - a.valore || (a.creato < b.creato ? -1 : 1));
  function disegnaTurno() {
    const b = $('#tv-turno'); if (!b || b.hidden) return;
    const L = ordinati(), att = T.stato?.turno, mia = x => isDM() || (!!x.giocatore && x.giocatore === T.me.giocatore);
    const avanti = L.length && (isDM() || L.some(x => x.id === att && x.giocatore === T.me.giocatore));
    b.innerHTML = `<div class="tv-th"><b>Ordine del turno</b><small>Round ${T.stato?.round || 1}</small>${avanti ? '<button type="button" class="go" data-k="av" title="Passa al prossimo">Avanti ▶</button>' : ''}<button type="button" data-k="x" aria-label="Chiudi">✕</button></div>
      <div class="tv-tl">${L.map(x => `<div class="tv-tr ${x.id === att ? 'att' : ''} ${x.nascosto ? 'hid' : ''}" data-id="${x.id}"><i style="--c:${esc(x.colore || '#7d2530')};${x.immagine ? `background-image:url('${x.immagine}')` : ''}">${x.immagine ? '' : esc(iniziali(x.nome))}</i><span title="${esc(x.nome)}">${esc(x.nome)}</span>
        ${mia(x) ? `<input type="number" step="1" value="${x.valore}" aria-label="Iniziativa di ${esc(x.nome)}">${isDM() ? `<button type="button" data-k="nasc" title="${x.nascosto ? 'Mostra ai giocatori' : 'Nascondi ai giocatori'}">${x.nascosto ? '🙈' : '👁'}</button>` : ''}<button type="button" data-k="via" title="Togli dall'ordine">✕</button>` : `<em>${x.valore}</em>`}</div>`).join('')
        || '<div class="tv-tvuoto">Nessuno ancora. Clicca un token e premi «Tira» accanto a Iniziativa.</div>'}</div>
      ${isDM() ? '<div class="tv-tf"><input type="text" data-k="nn" placeholder="Nome" style="flex:1;width:auto"><input type="number" data-k="nv" placeholder="0"><button type="button" data-k="add">+ Aggiungi</button><button type="button" data-k="svuota">Svuota</button></div>' : ''}`;
    b.querySelector('[data-k=x]').onclick = () => apriTurno(false);
    const av = b.querySelector('[data-k=av]');
    if (av) av.onclick = async () => { const r = await SB.rpc('tavolo_turno_avanti'); if (r.error) return toast(r.error.message, 'err'); };
    b.querySelectorAll('.tv-tr').forEach(row => {
      const x = T.turno.find(y => y.id === row.dataset.id); if (!x) return;
      const inp = row.querySelector('input');
      if (inp) inp.onchange = () => salvaTurno(x.id, { valore: +inp.value || 0 });
      const v = row.querySelector('[data-k=via]');
      if (v) v.onclick = async () => { const r = await SB.from('tavolo_turno').delete().eq('id', x.id); if (r.error) return toast(r.error.message, 'err'); T.turno = T.turno.filter(y => y.id !== x.id); disegnaTurno(); disegnaToken(); manda('turno', {}); };
      const n = row.querySelector('[data-k=nasc]');
      if (n) n.onclick = async () => { await salvaTurno(x.id, { nascosto: !x.nascosto }); manda('turno', {}); };
    });
    const add = b.querySelector('[data-k=add]');
    if (add) add.onclick = async () => {
      const nome = b.querySelector('[data-k=nn]').value.trim(); if (!nome) { b.querySelector('[data-k=nn]').focus(); return; }
      const r = await SB.from('tavolo_turno').insert({ nome: nome.slice(0, 60), valore: +b.querySelector('[data-k=nv]').value || 0, colore: '#5b6670' }).select().single();
      if (r.error) return toast(r.error.message, 'err');
      if (!T.turno.some(y => y.id === r.data.id)) T.turno.push(r.data); disegnaTurno();
    };
    const sv = b.querySelector('[data-k=svuota]');
    if (sv) sv.onclick = async () => {
      if (!T.turno.length || !await ask('Svuotare l\'ordine del turno?', { ok: 'Svuota', title: 'Ordine del turno' })) return;
      const r = await SB.from('tavolo_turno').delete().in('id', T.turno.map(y => y.id)); if (r.error) return toast(r.error.message, 'err');
      await SB.from('tavolo_stato').update({ turno: null, round: 1 }).eq('id', 1);
      T.turno = []; T.stato.turno = null; T.stato.round = 1; disegnaTurno(); disegnaToken(); manda('turno', {});
    };
  }
  async function salvaTurno(id, ch) {
    const r = await SB.from('tavolo_turno').update(ch).eq('id', id).select().single();
    if (r.error) { toast(r.error.message, 'err'); disegnaTurno(); return; }
    const i = T.turno.findIndex(y => y.id === id); if (i >= 0) T.turno[i] = r.data; disegnaTurno();
  }
  // 1d20 + modificatore, tirato dal server come ogni dado, e il risultato entra (o si aggiorna) nell'ordine del turno
  async function iniziativa(t, mod) {
    const m = Math.trunc(+mod || 0), f = '1d20' + (m ? (m > 0 ? '+' : '') + m : '');
    const r = await SB.rpc('tavolo_tira', { p_formula: f, p_motivo: 'Iniziativa · ' + (t.nome || 'token'), p_privato: !!t.nascosto });
    if (r.error) return toast(r.error.message, 'err');
    const tiro = Array.isArray(r.data) ? r.data[0] : r.data;
    if (tiro && !T.tiri.some(x => x.id === tiro.id)) { T.tiri.push(tiro); nuovoTiro(tiro); }
    const ex = T.turno.find(x => x.token === t.id);
    const q = ex ? SB.from('tavolo_turno').update({ valore: tiro.totale }).eq('id', ex.id).select().single()
      : SB.from('tavolo_turno').insert({ nome: t.nome || 'Token', valore: tiro.totale, token: t.id, immagine: t.immagine, colore: t.colore, giocatore: t.giocatore, nascosto: !!t.nascosto }).select().single();
    const r2 = await q; if (r2.error) return toast(r2.error.message, 'err');
    const i = T.turno.findIndex(x => x.id === r2.data.id); if (i >= 0) T.turno[i] = r2.data; else T.turno.push(r2.data);
    apriTurno(true); toast(`Iniziativa di ${t.nome || 'token'}: ${tiro.totale}`);
  }
})();

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
.tv-world{position:absolute;left:0;top:0;transform-origin:0 0}
.tv-map{position:absolute;left:0;top:0;max-width:none;pointer-events:none;-webkit-user-drag:none;box-shadow:0 0 0 1px #0008,0 10px 40px #0009;background:#e8dcc0}
.tv-grid{position:absolute;left:0;top:0;pointer-events:none;overflow:visible}
.tv-dif,.tv-efx{position:absolute;left:0;top:0;pointer-events:none;overflow:visible}
.tv-efx .ef *{transform-box:fill-box;transform-origin:center}
.tv-efx .pf{animation:tvEfSu 1.4s ease-in infinite}
.tv-efx .pb{animation:tvEfBolla 2s ease-out infinite}
.tv-efx .pg{animation:tvEfGas 8s ease-in-out infinite alternate}
.tv-efx .pi{animation:tvEfLuce 2.6s ease-in-out infinite}
.tv-efx .pl{animation:tvEfLampo 1.6s steps(1) infinite}
.tv-efx .ef-fuoco .base{animation:tvEfLuce 1.3s ease-in-out infinite}
.tv-efx .ef-oscurita .base{animation:tvEfLuce 5s ease-in-out infinite}
.tv-efx.fermo *{animation:none!important}
.tv-efx .sel circle.man{fill:#f2b51d;stroke:#1b1512;stroke-width:3}
.tv-efx text{font:700 15px var(--body);fill:#fff;paint-order:stroke;stroke:#000c;stroke-width:4px}
@keyframes tvEfSu{0%{transform:translateY(0) scale(1);opacity:0}12%{opacity:1}100%{transform:translateY(calc(var(--d) * -1)) scale(.35);opacity:0}}
@keyframes tvEfBolla{0%{transform:translateY(0) scale(.3);opacity:0}25%{opacity:1}100%{transform:translateY(calc(var(--d) * -1)) scale(1.3);opacity:0}}
@keyframes tvEfGas{0%{transform:translate(0,0) scale(1)}100%{transform:translate(var(--dx),var(--dy)) scale(1.3)}}
@keyframes tvEfLuce{0%,100%{opacity:1}50%{opacity:.72}}
@keyframes tvEfLampo{0%{opacity:0}8%{opacity:1}14%{opacity:.2}20%{opacity:1}28%{opacity:0}}
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
.tv-tdp .hdx{display:flex;align-items:center;gap:4px}
.tv-tdp .hd button.mio{display:flex;white-space:nowrap;align-items:center;gap:5px;font:600 .8rem var(--body);padding:3px 8px;border:1px solid #e7cf9a55;border-radius:7px;color:var(--gold2)}
.tv-tdp .hd .hdx button.mio{width:auto;height:auto;padding:3px 9px}
.tv-tdp .hd button.mio svg{width:18px;height:18px}
.tv-tdp .hd button.mio svg text{display:none}
.tv-tdp>.lb{text-align:left;margin:4px 12px 4px;font:600 .7rem var(--display);letter-spacing:.08em;text-transform:uppercase;color:#e7cf9aaa}
.tv-tdp .sws{display:grid;grid-template-columns:repeat(6,1fr);gap:3px;margin:0 10px 6px}
.tv-tdp .sws button{all:unset;box-sizing:border-box;cursor:pointer;display:flex;justify-content:center;padding:3px;border-radius:7px;border:2px solid transparent}
.tv-tdp .sws button:hover{background:#ffffff14}
.tv-tdp .sws button.on{border-color:var(--gold2);background:#7d253066}
.tv-tdp .sws svg{width:100%;max-width:34px;height:auto}
.tv-tdp .nm{margin:0 12px 6px;font-weight:400;font-size:.84rem;color:#e9dcc0}.tv-tdp .nm b{color:var(--gold2);font-weight:600}
.tv-tdp .pv{display:flex;align-items:flex-end;justify-content:center;gap:8px;margin:2px 10px 6px;padding:12px 6px;border-radius:9px;background:radial-gradient(ellipse at 50% 80%,#4a3a2c,#16110e)}
.tv-tdp .pv span{display:block;filter:drop-shadow(0 5px 5px #0009)}.tv-tdp .pv svg{width:100%;height:auto;overflow:visible}
.tv-tdp .pv text{font:800 30px var(--body);text-anchor:middle;dominant-baseline:central;paint-order:stroke;stroke-width:3px}
.tv-tdp .nt{margin:0 12px 8px;font-weight:400;font-size:.8rem;color:#e7cf9aaa}
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
.tv-tdp .vs{display:flex;gap:6px;margin:0 10px 8px}
.tv-tdp .vs button{all:unset;flex:1;text-align:center;cursor:pointer;padding:6px 4px;border-radius:6px;background:#ffffff14;font-size:.82rem}
.tv-tdp .vs button:hover{background:#7d2530}
.tv-tdp .ft{padding:0 12px 9px;font-weight:400;font-size:.78rem;color:#c9b89a}
.tv-d3{position:absolute;inset:0;pointer-events:none;z-index:6;overflow:hidden}
.tv-d3 .dd{position:absolute;left:0;top:0;width:78px;height:78px;margin:-39px 0 0 -39px;filter:drop-shadow(0 6px 6px #0009)}
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
.tv-tok b{-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision;position:absolute;left:50%;top:100%;transform:translateX(-50%);margin-top:2px;white-space:nowrap;font:600 var(--fs,13px)/1.15 var(--body);color:#fff;background:#000a;padding:1px 6px;border-radius:8px;pointer-events:none;max-width:240px;overflow:hidden;text-overflow:ellipsis}
.tv-tok .ini{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:700 calc(var(--fs,13px)*1.6)/1 var(--display);color:#fff;text-shadow:0 1px 2px #000}
.tv-ov{position:absolute;inset:0;pointer-events:none;overflow:visible}
.tv-ov text{font:700 15px var(--body);paint-order:stroke;stroke:#000c;stroke-width:4px;fill:#fff}
.tv-empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:20px;text-align:center;color:#ecdcb4}
.tv-empty div{max-width:440px;background:#00000066;border:1px solid #e7cf9a55;border-radius:10px;padding:22px 24px;line-height:1.45;font-size:1.05rem}
.tv-empty h2{font-family:var(--display);color:var(--gold2)!important;margin:0 0 8px;font-size:1.25rem}
.tv-empty code{background:#0006;padding:1px 5px;border-radius:4px}
.tv-chat{width:var(--cw,310px);position:relative;flex:none;display:flex;flex-direction:column;border-left:1px solid #000;background:var(--paper);min-height:0;z-index:8}
.tv-chat[hidden]{display:none!important}
/* scaletta del DM (scaletta.js) nella colonna della chat */
.tv-chat.scal{width:var(--cw,390px)}.tv-chat.sch{width:var(--cw,460px)}.tv-chat.sch .tv-log,.tv-chat.sch .tv-dk{display:none}
.tv-schc{display:none;flex:1;overflow:hidden;min-height:60px}.tv-chat.sch .tv-schc{display:flex;flex-direction:column}
.tv-schc .tv-tvuoto{padding:16px;display:flex;flex-direction:column;gap:8px;align-items:flex-start}
dialog.dlg.tv-side.tv-sw.tv-incol{position:relative;inset:auto;margin:0;width:100%!important;height:100%!important;max-height:none;min-width:0;min-height:0;z-index:auto;border-radius:0;box-shadow:none;border:0;flex:1}
.tv-crz{position:absolute;left:-5px;top:0;bottom:0;width:10px;cursor:ew-resize;z-index:3;touch-action:none}.tv-crz::after{content:"";position:absolute;left:4px;top:50%;width:2px;height:36px;margin-top:-18px;border-radius:2px;background:var(--gold);opacity:0;transition:opacity .15s}.tv-crz:hover::after,.tv-crz.on::after{opacity:.9}.tv-chat.scal .tv-log,.tv-chat.scal .tv-dk{display:none}
.tv-scal{display:none;flex:1;overflow-y:auto;min-height:60px}.tv-chat.scal .tv-scal{display:block}
.tv-dtab{display:flex;gap:2px}
.tv-dtab button{all:unset;cursor:pointer;padding:3px 9px 4px;border-bottom:2px solid transparent;color:var(--mute);font:600 .95rem/1.2 var(--display)}
.tv-dtab button.on{color:inherit;border-bottom-color:currentColor}
.tv-cx{all:unset;cursor:pointer;width:30px;height:30px;border-radius:50%;display:grid;place-items:center;font:600 .9rem var(--body);color:var(--ink2,#6b5a48)}
.tv-cx:hover,.tv-cx:focus-visible{background:#0000000f}
.tv-dh{display:flex;align-items:center;justify-content:space-between;padding:8px 10px 6px;font-family:var(--display);color:var(--wine);font-weight:600;border-bottom:1px solid var(--line)}
:root[data-theme=dark] .tv-dh{color:var(--gold2)}
.tv-log{flex:1;overflow-y:auto;padding:8px 10px;display:flex;flex-direction:column;gap:6px;min-height:60px}
.tv-roll{border:1px solid var(--line);border-radius:6px;padding:6px 8px;background:var(--paper2);font-size:.95rem;line-height:1.3}
.tv-roll .h{display:flex;justify-content:space-between;gap:8px;align-items:baseline}
.tv-roll .h span{font-weight:600}
.tv-roll .h small{color:var(--mute)}
.tv-roll .m{color:var(--ink2);font-style:italic}
.tv-roll .kt{display:flex;align-items:center;justify-content:space-between;gap:6px;margin:2px 0 1px;font:700 .74rem var(--body);letter-spacing:.04em;text-transform:uppercase}
.tv-roll.k-att{border-left:4px solid #2f5d8a}.tv-roll.k-att .kt b{color:#2f5d8a}
.tv-roll.k-dan{border-left:4px solid #9b2c2c;margin-left:14px}.tv-roll.k-dan .kt b{color:#9b2c2c}
.tv-roll.k-ts{border-left:4px solid #3d7a6e}.tv-roll.k-ts .kt b{color:#3d7a6e}
.tv-roll.k-ext{border-left:4px solid #6b3fa0;margin-left:14px}.tv-roll.k-ext .kt b{color:#6b3fa0}
.tv-roll .es{font-size:.7rem;padding:1px 7px;border-radius:9px;text-transform:none;letter-spacing:0;white-space:nowrap}
.tv-roll .es.si{background:#2e6b3a;color:#fff}.tv-roll .es.no{background:#6d6d6d;color:#fff}.tv-roll .es.crit{background:#b8860b;color:#fff}
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
.tv-pnome{font:600 1rem var(--display);color:var(--wine);background:transparent;border:0;border-bottom:1px dashed var(--line2);padding:2px 4px 4px;margin-bottom:2px}
.tv-pnome:focus{outline:none;border-bottom:1px solid var(--wine);background:var(--paper2)}
:root[data-theme=dark] .tv-pnome{color:var(--gold2)}
.tv-pop .row{display:flex;gap:5px;align-items:center}
.tv-pop select{font:inherit;flex:1;padding:4px;border-radius:4px;border:1px solid var(--line2);background:var(--paper2);color:var(--ink)}
.tv-pick{display:grid;grid-template-columns:repeat(auto-fill,minmax(86px,1fr));gap:8px;max-height:46vh;overflow-y:auto;padding:2px}
.tv-pick button{all:unset;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px 4px;border-radius:6px;border:1px solid transparent;text-align:center;font-size:.85rem;line-height:1.15}
.tv-pick button:hover,.tv-pick button:focus-visible{border-color:var(--gold);background:var(--paper2)}
.tv-forme{display:grid;gap:8px;margin:10px 0}
.tv-forme button{all:unset;cursor:pointer;display:flex;flex-direction:column;gap:2px;padding:10px 12px;border-radius:6px;border:1px solid var(--line2);background:var(--paper2)}
.tv-forme button b{font-family:var(--display);color:var(--wine)}
.tv-forme button small{opacity:.8;line-height:1.3}
.tv-forme button.cons{border-color:var(--gold);box-shadow:0 0 0 1px var(--gold)}
.tv-dafoto{display:flex;flex-direction:column;gap:3px;padding:12px;border-radius:6px;border:2px dashed var(--line2);background:var(--paper2);cursor:pointer;margin-bottom:8px}
.tv-dafoto b{font-family:var(--display);color:var(--wine)}
.tv-dafoto small{opacity:.8;line-height:1.3}
.tv-dafoto.su{border-color:var(--gold);background:var(--paper)}
.tv-dafoto.va{cursor:progress;border-style:solid;border-color:var(--gold)}
.tv-dafoto .st{font-weight:700;font-size:.85rem;color:var(--wine)}
.tv-dafoto .st:empty{display:none}
.tv-forme button:hover,.tv-forme button:focus-visible{border-color:var(--gold)}
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
.tv-walls{position:absolute;left:0;top:0;pointer-events:none;overflow:visible;z-index:99998}
.tv-walls line{stroke-linecap:round;vector-effect:non-scaling-stroke}
.tv-walls .mu{stroke:#ff5ad1;stroke-width:3;filter:drop-shadow(0 0 1.5px #000)}
.tv-walls .po{stroke:#c98a3c;stroke-width:5;filter:drop-shadow(0 0 1.5px #000)}
.tv-walls .po.ap{stroke:#e7cf9a;stroke-width:3;stroke-dasharray:5 6;opacity:.8}
.tv-porte{position:absolute;left:0;top:0;z-index:99999}
.tv-porta{all:unset;box-sizing:border-box;position:absolute;width:28px;height:28px;margin:-14px 0 0 -14px;transform:scale(calc(1 / var(--z,1)));border-radius:50%;display:grid;place-items:center;cursor:pointer;background:linear-gradient(#94622f,#5d3a19);border:1.5px solid #e7cf9a;box-shadow:0 2px 6px #000a;color:#fff3dc;transition:filter .12s}
.tv-porta svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.tv-porta.ap{background:#1d1814d9;color:#e7cf9a;border-style:dashed}
.tv-porta.bl:not(.ap){background:linear-gradient(#8f2d39,#4d141b)}
.tv-porta:hover,.tv-porta:focus-visible{filter:brightness(1.25)}
.tv-stage.rul .tv-porta{pointer-events:none}
.tv-stage.muri,.tv-stage.mira{cursor:crosshair}
.tv-fx{position:absolute;left:0;top:0;pointer-events:none;overflow:visible;z-index:100000}
.tv-segn{position:absolute;left:0;top:0}
.tv-sg{position:absolute;width:0;height:0;--s:40px}
.tv-sg .gt{position:absolute;box-sizing:border-box;left:calc(var(--s) * -.5);top:calc(var(--s) * -.5);width:var(--s);height:var(--s);border-radius:50%;display:grid;place-items:center;color:#2b1a0f;background:radial-gradient(circle at 40% 35%,#f7ecd3,#e6d4ad);border:calc(var(--s) * .05) solid #2b1a0f;box-shadow:inset 0 0 0 calc(var(--s) * .07) #efe2c4,inset 0 0 0 calc(var(--s) * .11) var(--c),0 calc(var(--s) * .05) calc(var(--s) * .12) #000a}
.tv-sg .gt svg{width:54%;height:54%;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.tv-sg .nm{position:absolute;left:0;top:calc(var(--s) * .58);transform:translateX(-50%);white-space:nowrap;font:700 calc(var(--s) * .3) var(--display);letter-spacing:.05em;color:#f4ead2;paint-order:stroke;-webkit-text-stroke:calc(var(--s) * .08) #1b100a;pointer-events:none}
.tv-sg .ns{position:absolute;left:calc(var(--s) * .2);top:calc(var(--s) * -.68);width:calc(var(--s) * .42);height:calc(var(--s) * .42);border-radius:50%;background:#1b1512;border:2px solid #f2b51d;display:grid;place-items:center}
.tv-sg .ns svg{width:70%;height:70%;fill:none;stroke:#f2b51d;stroke-width:2.4;stroke-linecap:round}
.tv-sg.nasc .gt{opacity:.55;border-style:dashed;border-color:#f2b51d}
.tv-sg.sel .gt{box-shadow:inset 0 0 0 calc(var(--s) * .07) #efe2c4,inset 0 0 0 calc(var(--s) * .11) var(--c),0 0 0 calc(var(--s) * .07) #f2b51d,0 0 calc(var(--s) * .35) #f2b51d}
.tv-stage.segni .tv-sg .gt{cursor:move}
.tv-sg.app .gt{animation:tvSgApp .6s cubic-bezier(.3,1.6,.5,1)}
@keyframes tvSgApp{0%{transform:scale(.2);opacity:0}100%{transform:scale(1);opacity:1}}
.sgi{width:1.15em;height:1.15em;vertical-align:-.2em;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.tv-ping{position:absolute;width:0;height:0;pointer-events:none;z-index:100001;--r:50px}
.tv-ping i{position:absolute;left:calc(var(--r) * -1);top:calc(var(--r) * -1);width:calc(var(--r) * 2);height:calc(var(--r) * 2);border-radius:50%;border:calc(var(--r) * .1) solid var(--c);box-shadow:0 0 calc(var(--r) * .3) var(--c),inset 0 0 calc(var(--r) * .3) var(--c);opacity:0;animation:tvPing 1.3s ease-out 2}
.tv-ping i:nth-child(2){animation-delay:.22s}.tv-ping i:nth-child(3){animation-delay:.44s;background:color-mix(in srgb,var(--c) 25%,transparent)}
.tv-ping b{position:absolute;left:0;top:calc(var(--r) * 1.1);transform:translateX(-50%);white-space:nowrap;font:700 calc(var(--r) * .32) var(--body);color:#fff;paint-order:stroke;-webkit-text-stroke:calc(var(--r) * .08) #000c;animation:tvPingT 2.6s ease-out forwards}
@keyframes tvPing{0%{transform:scale(.15);opacity:1}70%{opacity:.9}100%{transform:scale(1);opacity:0}}
@keyframes tvPingT{0%,75%{opacity:1}100%{opacity:0}}
.tv-fx .tx{font-family:var(--display)}
.tv-stage.mira .tv-tok.mira-si{cursor:crosshair;box-shadow:0 0 0 3px #ff5a4e,0 0 16px 4px #ff5a4e99}
.tv-stage.mira .tv-tok.mira-no{opacity:.55;cursor:not-allowed}
.tv-stage.mira .tv-tok.mira-io{box-shadow:0 0 0 3px #e7cf9a,0 0 14px 3px #e7cf9a88}
.tv-dh .dx{display:flex;gap:2px}
.tv-anim{opacity:.45;filter:grayscale(1)}.tv-anim.on{opacity:1;filter:none}.tv-stage.gmano{cursor:move}
.tv-mbar .tit{font:600 .86rem var(--display);color:var(--gold2);padding:0 6px;white-space:nowrap}
.tv-mbar .avv{font:600 .82rem var(--body);padding:4px 8px;white-space:normal;max-width:460px}
.tv-tok.turno{box-shadow:0 0 0 4px #f2b51d,0 0 18px 6px #f2b51daa}
.tv-th{display:flex;align-items:center;gap:6px;padding:8px 8px 6px 12px;border-bottom:1px solid #ffffff1a}
.tv-th b{flex:1;font-family:var(--display);font-size:.85rem;letter-spacing:.05em;color:var(--gold2)}
.tv-th small{color:#c9b89a;font-size:.8rem}
.tv-th button,.tv-tf button{all:unset;cursor:pointer;padding:4px 8px;border-radius:6px;font:600 .82rem var(--body);color:#f1e4c8;background:#ffffff14}
.tv-th button:hover,.tv-tf button:hover{background:#ffffff2a}
.tv-th button.go{background:#7d2530;white-space:nowrap}
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
.tv-roll .h .who{display:flex;align-items:center;gap:7px;min-width:0}
.tv-roll .av{width:30px;height:30px;border-radius:50%;flex:none;background:var(--c,#5b6670) center/cover no-repeat;border:2px solid var(--gold);display:flex;align-items:center;justify-content:center;font:700 .72rem var(--display);font-style:normal;color:#fff;box-shadow:0 1px 3px #0005}
.tv-roll .av.dm{background:#3b1f4a;font-size:.95rem}
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
.tv-pcond{display:flex;flex-wrap:wrap;gap:4px;align-items:center}
.tv-pcond button{all:unset;cursor:pointer;background:#7d2530;color:#fff;border-radius:10px;padding:1px 8px;font-size:.78rem;font-weight:600}
.tv-pcond select{flex:1;min-width:120px}
.tv-tok .cnd{position:absolute;right:-14%;top:-8%;display:flex;flex-direction:column;gap:2px;pointer-events:none;font-size:calc(var(--fs,13px)*1.05);z-index:2}
.tv-tok .cnd i{font-style:normal;width:1.55em;height:1.55em;border-radius:50%;background:#140e0bdd;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 1px #ffffff66,0 1px 3px #000a;line-height:1}
.tv-tok .fxs{position:absolute;inset:0;pointer-events:none}
.tv-tok .fx{position:absolute;inset:-14%;border-radius:50%;pointer-events:none}
.tv-tok .fx::after{position:absolute;left:50%;top:50%;font-size:calc(var(--fs,13px)*1.5);line-height:1;transform:translate(-50%,-50%)}
@keyframes tvfx-pulsa{0%,100%{opacity:.55;transform:scale(.96)}50%{opacity:1;transform:scale(1.06)}}
@keyframes tvfx-gira{to{transform:rotate(360deg)}}
@keyframes tvfx-sale{0%{transform:translate(-50%,10%) scale(.6);opacity:0}25%{opacity:1}100%{transform:translate(-50%,-160%) scale(1.1);opacity:0}}
@keyframes tvfx-trema{0%,100%{translate:0 0}20%{translate:-2px 1px}40%{translate:2px -1px}60%{translate:-1px -1px}80%{translate:1px 1px}}
@keyframes tvfx-lampo{0%,100%{opacity:.2}10%,30%{opacity:1}20%{opacity:.4}}
.f-affascinato{box-shadow:0 0 0 3px #ff5fa2,0 0 22px 8px #ff5fa2aa;animation:tvfx-pulsa 1.8s ease-in-out infinite}
.f-affascinato::after{content:"💗";animation:tvfx-sale 2.2s ease-out infinite}
.f-avvelenato{background:radial-gradient(circle,#5fd35f00 55%,#4caf50aa 72%,#4caf5000 80%);box-shadow:0 0 20px 6px #4caf5099;animation:tvfx-pulsa 2.4s ease-in-out infinite}
.f-avvelenato::after{content:"🫧";animation:tvfx-sale 2.8s ease-out infinite}
.f-spaventato{box-shadow:0 0 0 3px #8e44ad,0 0 20px 6px #8e44ad99}
.tv-tok.c-spaventato{animation:tvfx-trema .35s linear infinite}
.f-stordito{border:3px dotted #f2c94c;animation:tvfx-gira 2.5s linear infinite}
.f-stordito::after{content:"💫";top:-6%}
.f-paralizzato{border:3px dashed #ffe14d;box-shadow:0 0 18px 6px #ffe14daa;animation:tvfx-lampo 1.2s steps(1) infinite}
.f-prono{inset:auto -10% -18% -10%;height:28%;border-radius:50%;background:radial-gradient(ellipse,#3b2a1acc,#3b2a1a00 70%)}
.tv-tok.c-prono{transform:rotate(-80deg) scale(.92)}
.tv-tok.c-prono b,.tv-tok.c-prono .cnd,.tv-tok.c-prono .pf{rotate:80deg}
.tv-tok.c-invisibile{opacity:.4}
.f-invisibile{box-shadow:0 0 0 2px #9fd8ffaa,0 0 24px 8px #9fd8ff66;animation:tvfx-pulsa 3s ease-in-out infinite}
.f-accecato{inset:34% -6% auto -6%;height:24%;border-radius:4px;background:#111;box-shadow:0 2px 4px #000a}
.f-assordato{box-shadow:0 0 0 3px #95a5a6}
.f-afferrato,.f-trattenuto{border:4px dashed #8a6a3c;animation:tvfx-gira 9s linear infinite}
.f-trattenuto{border-style:double;border-width:5px}
.tv-tok.c-incapacitato,.tv-tok.c-svenuto{filter:grayscale(.85) brightness(.85)}
.f-incapacitato{box-shadow:0 0 0 3px #7f8c8d}
.tv-tok.c-pietrificato{filter:grayscale(1) contrast(1.25) brightness(.95)}
.f-pietrificato{box-shadow:0 0 0 4px #8d8d8d,inset 0 0 12px #000a}
.f-svenuto::after{content:"💤";animation:tvfx-sale 2.6s ease-out infinite}
.f-concentrazione{inset:-20%;border:3px dashed #4aa3ff;box-shadow:0 0 14px 2px #4aa3ff88;animation:tvfx-gira 6s linear infinite}
.tv-tok.c-morto{filter:grayscale(1) brightness(.5) sepia(.25)}
.tv-tok.c-morto b{text-decoration:line-through;text-decoration-color:#e04848;text-decoration-thickness:2px}
.f-morto{inset:4%;border-radius:50%;background:linear-gradient(45deg,transparent 45%,#c0262bdd 45% 55%,transparent 55%),linear-gradient(-45deg,transparent 45%,#c0262bdd 45% 55%,transparent 55%);animation:tvfx-morto .5s ease-out}
.f-morto::after{content:"💀";font-size:calc(var(--fs,13px)*2.2);filter:drop-shadow(0 2px 3px #000)}
@keyframes tvfx-morto{from{transform:scale(1.6);opacity:0}}
.tv-tok .pf{position:absolute;left:10%;right:10%;top:-10px;height:6px;border-radius:3px;background:#000b;overflow:hidden;pointer-events:none;box-shadow:0 0 0 1px #0008}
.tv-tok .pf s{display:block;height:100%;background:var(--b,#3f9a4a);transition:width .3s}
.tv-tok .pf[hidden]{display:none}
.tv-tok .az{position:absolute;left:50%;top:calc(100% + 16px);transform:translateX(-50%);display:flex;align-items:center;gap:3px;background:#1c1a17e6;color:#f1e4c8;border:1px solid #d9a21b;border-radius:10px;padding:1px 6px;font:700 max(10px,calc(var(--fs) * .8))/1.3 var(--body);white-space:nowrap;pointer-events:none;z-index:2}
.tv-tok .az[hidden]{display:none}
.tv-tok .az b.ko{color:#ff6b5b}
.tv-tok .az i{font-style:normal;color:#9be15d}.tv-tok .az i.usata{color:#8a8178;text-decoration:line-through}
.tv-tok .pf.dm-solo{opacity:.55;box-shadow:0 0 0 1px #0008,0 0 0 2px #fff3}
.tv-sp{position:absolute;left:10px;top:10px;z-index:9;width:min(290px,calc(100% - 20px));max-height:min(560px,calc(100% - 20px));display:flex;flex-direction:column;background:#211a16f5;color:#f1e4c8;border:1px solid #e7cf9a44;border-radius:10px;box-shadow:0 8px 30px #000b}
.tv-sp[hidden]{display:none!important}
.tv-sp h5{margin:8px 12px 2px;font:600 .7rem/1.2 var(--display);letter-spacing:.08em;text-transform:uppercase;color:#a8957a}
.tv-sp .r{display:flex;align-items:center;gap:8px;padding:4px 6px 4px 10px}
.tv-sp .r:hover{background:#ffffff0d}
.tv-sp .r[hidden]{display:none}
.tv-sp .r i{width:32px;height:32px;border-radius:50%;flex:none;background:var(--c,#7d2530) center/cover no-repeat;border:2px solid #e7cf9a88;display:flex;align-items:center;justify-content:center;font:700 .72rem var(--display);font-style:normal;color:#fff}
.tv-sp .r .nm{all:unset;cursor:pointer;flex:1;min-width:0;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tv-sp .r .nm small{display:block;font-weight:400;font-size:.76rem;color:#c9b89a;overflow:hidden;text-overflow:ellipsis}
.tv-sp .r .s{all:unset;cursor:pointer;padding:3px 5px;border-radius:5px;color:#c9b89a;font-size:.85rem}
.tv-sp .r .s:hover{background:#ffffff1a;color:#fff}
.tv-sp input[type=search]{margin:8px 10px 0;font:inherit;padding:5px 8px;border-radius:6px;border:1px solid #ffffff2a;background:#0005;color:#f1e4c8}
.tv-sp code{background:#0006;padding:1px 4px;border-radius:4px}
dialog.dlg.tv-side.tv-sw{width:min(940px,calc(100vw - 80px));inset:56px auto auto 62px;max-height:calc(100vh - 80px);padding:0;background:#fdfbf6;color:#1c1a17;border:1px solid #2b2620;box-shadow:0 18px 50px #000b;overflow:hidden;min-width:min(420px,100vw);min-height:200px}
/* la scheda scorre al suo interno: i bordi per allargarla restano fermi */
dialog.dlg.tv-side.tv-sw[open]{display:flex;flex-direction:column}
dialog.tv-sw>.tv-sch{flex:1 1 auto;min-height:0;overflow-y:auto}
dialog.tv-sw>.rz{position:absolute;z-index:6;touch-action:none}
dialog.tv-sw>.rz.e,dialog.tv-sw>.rz.w{top:0;bottom:0;width:7px;cursor:ew-resize}
dialog.tv-sw>.rz.e{right:0}dialog.tv-sw>.rz.w{left:0}
dialog.tv-sw>.rz.s{left:0;right:0;bottom:0;height:7px;cursor:ns-resize}
dialog.tv-sw>.rz.se,dialog.tv-sw>.rz.sw{bottom:0;width:16px;height:16px;z-index:7}
dialog.tv-sw>.rz.se{right:0;cursor:nwse-resize;background:linear-gradient(135deg,transparent 55%,#8a7e6c 55%,#8a7e6c 62%,transparent 62%,transparent 72%,#8a7e6c 72%,#8a7e6c 79%,transparent 79%)}
dialog.tv-sw>.rz.sw{left:0;cursor:nesw-resize}
dialog.tv-sw>.rz:hover{background-color:#7d253033}
.tv-sch{--k:#1c1a17;--k2:#4a443b;--lin:#2b2620;--gr:#e9e5dc;--pp:#fdfbf6;--box:#fff;--ul:#b9b2a5;--rig:#0000000f;font:400 .9rem/1.3 var(--body);color:var(--k);padding:0 12px 12px}
.tv-sch input,.tv-sch select,.tv-sch textarea{font:inherit;color:var(--k);background:transparent;border:0;border-bottom:1px solid var(--ul);border-radius:0;padding:2px 3px;min-width:0;box-sizing:border-box;width:100%}
.tv-sch input:focus,.tv-sch select:focus,.tv-sch textarea:focus{outline:2px solid #7d253055;outline-offset:1px;background:var(--box)}
.tv-sch input:disabled,.tv-sch select:disabled,.tv-sch textarea:disabled{opacity:1;color:var(--k);-webkit-text-fill-color:var(--k);border-color:transparent}
.tv-sch input[type=number]{-moz-appearance:textfield;text-align:center}
.tv-sch input[type=number]::-webkit-inner-spin-button{display:none}
.tv-sch input[type=checkbox]{width:auto;accent-color:#7d2530}
.tv-sch textarea{resize:vertical;border:0;line-height:1.35;background:repeating-linear-gradient(transparent 0 1.3em,var(--rig) 1.3em calc(1.3em + 1px))}
.tv-sch small,.tv-sch h6{font:700 .58rem/1.15 var(--body);letter-spacing:.06em;text-transform:uppercase;color:var(--k2)}
.tv-sch h6{margin:6px 0 0;text-align:center}
.tv-sch .vuoto{color:#8a8172;font-size:.8rem;font-style:italic;margin:2px 0}
.tv-sch .tbar{position:sticky;top:0;z-index:3;display:flex;align-items:center;gap:8px;margin:0 -12px 8px;padding:6px 8px 6px 10px;background:#2b2620;color:#f1e4c8;cursor:move;user-select:none;-webkit-user-select:none;flex-wrap:wrap}
.tv-sch .tbar .grip{opacity:.6;font-size:1rem}
.tv-sch .tbar .tt{flex:1;font:600 .82rem var(--display);letter-spacing:.06em;text-transform:uppercase;min-width:110px}
.tv-sch .tbar .sg{display:flex;align-items:center;gap:4px;font-size:.8rem;cursor:pointer}
.tv-sch .seg3{display:flex;background:#0005;border-radius:6px;padding:2px;gap:2px}
.tv-sch .seg3:empty{display:none}
.tv-sch .seg3 button{all:unset;cursor:pointer;padding:2px 8px;border-radius:4px;font-size:.76rem;font-weight:600}
.tv-sch .seg3 button.on{background:#7d2530;color:#fff}
.tv-sch .x{all:unset;cursor:pointer;font-size:1.1rem;line-height:1;padding:3px 7px;border-radius:5px}
.tv-sch .x:hover{background:var(--box)fff22}
.tv-sch .testa{display:grid;grid-template-columns:minmax(220px,1fr) 2fr;gap:10px;align-items:stretch}
.tv-sch .nome{display:flex;align-items:center;gap:10px;border:2px solid var(--lin);border-radius:40px 8px 8px 40px;padding:6px 10px 6px 6px;background:var(--box)}
.tv-sch .ft{width:64px;height:64px;border-radius:50%;flex:none;background:var(--c,#5b6670) center/cover no-repeat;border:2px solid var(--lin);display:flex;align-items:center;justify-content:center;font:700 1.25rem var(--display);font-style:normal;color:#fff}
.tv-sch label.ft.cambia{cursor:pointer;position:relative}
.tv-sch label.ft.cambia:hover{box-shadow:0 0 0 3px #7d2530}
.tv-sch label.ft.cambia:hover::after{content:"📷";position:absolute;right:-4px;bottom:-4px;font-size:.9rem;background:var(--box);border-radius:50%;padding:2px;border:1px solid var(--lin)}
.tv-sch .ft .piu{display:flex;flex-direction:column;align-items:center;font-size:1.2rem;line-height:1}
.tv-sch .ft .piu small{color:#fff;font-size:.5rem;margin-top:2px}
.tv-sch .ban{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.tv-sch .nm{font:600 1.3rem/1.2 var(--display);color:var(--k);text-align:left;overflow:hidden;text-overflow:ellipsis}
.tv-sch .info{display:grid;grid-template-columns:repeat(3,1fr);gap:4px 12px;border:2px solid var(--lin);border-radius:8px;padding:6px 10px;background:var(--box)}
.tv-sch .li{display:flex;flex-direction:column;justify-content:flex-end;min-width:0}
.tv-sch .li .ro{padding:2px 3px;border-bottom:1px solid var(--ul);min-height:1.3em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tv-sch .cl{display:flex;gap:4px}.tv-sch .cl .lv{width:40px;flex:none}
.tv-sch .tabs{display:flex;gap:4px;margin:10px 0 8px;border-bottom:2px solid var(--lin)}
.tv-sch .tabs button{all:unset;cursor:pointer;padding:5px 12px;font:600 .8rem var(--display);letter-spacing:.05em;text-transform:uppercase;border:2px solid transparent;border-bottom:0;border-radius:6px 6px 0 0;margin-bottom:-2px;color:var(--k2)}
.tv-sch .tabs button.on{border-color:var(--lin);background:var(--pp);color:var(--k)}
.tv-sch .p1{display:grid;grid-template-columns:repeat(auto-fit,minmax(265px,1fr));gap:10px;align-items:start}
.tv-sch .colA,.tv-sch .colB,.tv-sch .colC{display:flex;flex-direction:column;gap:8px;min-width:0}
/* scheda stretta: due colonne con privilegi e tratti sotto la prima (niente buco sotto le caratteristiche), poi una sola colonna */
.tv-sch{container:sch/inline-size}
@container sch (max-width:839px){.tv-sch .p1{grid-template-columns:repeat(2,minmax(0,1fr));grid-template-areas:"a b" "c b"}.tv-sch .colA{grid-area:a}.tv-sch .colB{grid-area:b}.tv-sch .colC{grid-area:c}}
@container sch (max-width:569px){.tv-sch .p1{grid-template-columns:minmax(0,1fr);grid-template-areas:"a" "b" "c"}}
.tv-sch .dueA{display:grid;grid-template-columns:78px 1fr;gap:8px;background:var(--gr);border-radius:10px;padding:6px}
.tv-sch .carcol{display:flex;flex-direction:column;gap:7px}
.tv-sch .cbox{position:relative;border:2px solid var(--lin);border-radius:9px;background:var(--box);text-align:center;padding:4px 2px 16px;display:flex;flex-direction:column;align-items:center}
.tv-sch .cbox small{font-size:.52rem}
.tv-sch .cbox .mod{font:700 1.5rem/1.2 var(--display);width:100%}
.tv-sch .cbox .ov{position:absolute;bottom:-9px;left:50%;transform:translateX(-50%);width:38px;height:22px;border:2px solid var(--lin);border-radius:50%;background:var(--box);font-size:.8rem;padding:0}
.tv-sch .altA{display:flex;flex-direction:column;gap:7px;min-width:0}
.tv-sch .pill{display:flex;align-items:center;gap:8px;border:2px solid var(--lin);border-radius:8px;background:var(--box);padding:3px 8px 3px 3px}
.tv-sch .pill span{font:700 .6rem/1.15 var(--body);letter-spacing:.05em;text-transform:uppercase}
.tv-sch .pill .pv{width:32px;height:28px;flex:none;border:2px solid var(--lin);border-radius:50%;display:flex;align-items:center;justify-content:center;font:700 .95rem var(--display)}
.tv-sch .pill.largo{border-radius:20px}
.tv-sch .pill.isp input.pv{padding:0;text-align:center;border-bottom:2px solid var(--lin);background:var(--box)}
.tv-sch .tbar .tema{all:unset;cursor:pointer;padding:1px 7px;border-radius:4px;border:1px solid #f1e4c855;font-size:.85rem}
.tv-sch .tbar .tema:hover{background:#f1e4c822}
.tv-sch .tbar .zt{display:flex;align-items:center;gap:2px;font-size:.72rem}
.tv-sch .tbar .zt button{all:unset;cursor:pointer;padding:2px 6px;border-radius:4px;border:1px solid #f1e4c855;font:700 .74rem var(--body)}
.tv-sch .tbar .zt button:hover{background:#f1e4c822}
.tv-sch .tbar .zt span{min-width:34px;text-align:center;opacity:.8}
.tv-sch .mano{cursor:grab;color:var(--k2);opacity:.55;font-size:.9rem;padding:0 2px;touch-action:none;user-select:none;-webkit-user-select:none;flex:none}
.tv-sch .mano:hover{opacity:1}
.tv-sch .trascino{opacity:.75;outline:2px dashed #7d2530;outline-offset:1px;background:var(--gr)}
.tv-sch .at .riga:first-child{grid-template-columns:auto 1fr 44px 74px}
.tv-sch .at .riga:first-child:not(:has(.mano)){grid-template-columns:1fr 44px 74px}
.tv-sch .prv input[type=search]{border:1px solid var(--ul);border-radius:5px;padding:4px 7px;margin-bottom:5px}
.tv-sch .pv{border-bottom:1px solid var(--ul);padding:5px 2px 5px}
.tv-sch .pv:last-child{border-bottom:0}
.tv-sch .pv .ph{display:flex;align-items:center;gap:5px}
.tv-sch .pv .pt{all:unset;cursor:pointer;flex:1;min-width:0;font:700 .98rem/1.15 var(--display);font-variant:small-caps;letter-spacing:.02em;color:#7d2530}
.tv-sch .pv .pt::after{content:" ▸";font-size:.7rem;opacity:.6}
.tv-sch .pv.ap .pt::after{content:" ▾"}
.tv-sch .pv .pt:hover{text-decoration:underline}
.tv-sch .pv .pf2{display:block;font-style:italic;text-transform:none;letter-spacing:0;font-weight:400;font-size:.72rem;margin-left:18px}
.tv-sch .pv .pd{margin:4px 0 0 18px;font-size:.86rem}
.tv-sch .pv .pd p{margin:0 0 5px}
.tv-sch .pv .pu{font:700 .75rem var(--body);background:#7d2530;color:#fff;border-radius:10px;padding:1px 7px}
.tv-sch .pv .ing{all:unset;cursor:pointer;opacity:.5;font-size:.95rem;padding:0 3px}
.tv-sch .pv .ing:hover{opacity:1}
.tv-sch .sbat{border-left:3px solid #7d2530;background:#7d25300c;border-radius:0 6px 6px 0;padding:5px 8px;margin:6px 0}
.tv-sch .sbat p{margin:0}
.tv-sch .sbb{display:flex;flex-wrap:wrap;gap:5px;margin-top:5px}
.tv-sch .sbb .mini.on{background:#7d2530;border-color:#7d2530;color:#fff}
.tv-sch .sbb .mini.on:hover{background:#962c3a}
.tv-scuro .tv-sch .sbat{background:#e8a0a614;border-left-color:#c0505c}
.tv-sch .pv .sw2{display:flex;align-items:center;gap:3px;cursor:pointer;font:700 .66rem var(--body);text-transform:uppercase;letter-spacing:.04em;padding:2px 7px;border-radius:10px;border:1px solid var(--ul);color:var(--k2)}
.tv-sch .pv .sw2 input{width:auto;margin:0;accent-color:#7d2530}
.tv-sch .pv .sw2.on{background:#7d2530;border-color:#7d2530;color:#fff}
.tv-sch .trt .sw2{display:inline-flex;align-items:center;gap:3px;cursor:pointer;font:700 .66rem var(--body);text-transform:uppercase;letter-spacing:.04em;padding:1px 7px;border-radius:10px;border:1px solid var(--ul);color:var(--k2);vertical-align:middle;margin-left:4px}
.tv-sch .trt .sw2 input{width:auto;margin:0;accent-color:#7d2530}
.tv-sch .trt .sw2.on{background:#7d2530;border-color:#7d2530;color:#fff}
.tv-sch .effc{display:inline-block;font:700 .7rem var(--body);padding:2px 8px;border-radius:999px;background:#b4541c1a;color:#b4541c;white-space:nowrap;vertical-align:middle}
.tv-sch .effc.off{opacity:.5;text-decoration:line-through}
.tv-scuro .tv-sch .effc{color:#f0b48f}
.tv-sch .pvr label.eff{flex:1 1 100%;flex-direction:column;align-items:stretch}.tv-sch .pvr label.eff select{width:100%}
.tv-sch .pv .pe{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:2px 0 2px 18px}
.tv-sch .pe .sw2{display:inline-flex;align-items:center;gap:3px;cursor:pointer;font:700 .66rem var(--body);text-transform:uppercase;letter-spacing:.04em;padding:1px 7px;border-radius:10px;border:1px solid var(--ul);color:var(--k2)}
.tv-sch .pe .sw2 input{width:auto;margin:0;accent-color:#7d2530}
.tv-sch .pe .sw2.on{background:#7d2530;border-color:#7d2530;color:#fff}
.tv-sch .pvf{display:grid;gap:5px;margin:6px 0 2px 18px;padding:6px;border-radius:6px;background:var(--gr)}
.tv-sch .pvf .pn{font-weight:700}
.tv-sch .pvf textarea{background:var(--box);border-radius:4px}
.tv-sch .pvr{display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:.76rem}
.tv-sch .pvr label{display:flex;align-items:center;gap:4px}
.tv-sch .pvr .u{width:48px}.tv-sch .pvr .d{width:80px}.tv-sch .pvr select{width:auto;margin:0}
.tv-sch .pvr .via{color:#b3261e}
.tv-sch .vec{background:#fff4d6;border:1px dashed #c9a24a;border-radius:6px;padding:6px 8px;margin-bottom:6px;font-size:.8rem}
.tv-sch .vec p{margin:0 0 5px}
.tv-sch .vec pre{white-space:pre-wrap;font:inherit;max-height:160px;overflow:auto;margin:4px 0 0}
.tv-sch .ris .rs{display:flex;align-items:center;gap:6px;padding:3px 0;border-bottom:1px solid var(--rig)}
.tv-sch .ris .rn{all:unset;cursor:pointer;flex:1;min-width:0;font:700 .9rem/1.1 var(--display);font-variant:small-caps;color:#7d2530;overflow-wrap:anywhere}
.tv-sch .ris .rv{font:400 .8rem var(--body);white-space:nowrap}.tv-sch .ris .rv b{font:700 1.05rem var(--display)}
.tv-sch .ris .rd button{width:13px;height:13px}
.tv-sch .ris .rd button.on{background:#7d2530;border-color:#7d2530}
.tv-sch .ris .mini{padding:1px 7px}
.tv-sch .ris .rb2{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px}
.tv-sch .tz{border-color:#7d2530}
.tv-sch .tz.ora{box-shadow:0 0 0 2px #d9a21b88}
.tv-sch .tzr{display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin-bottom:4px}
.tv-sch .tzb{all:unset;box-sizing:border-box;cursor:pointer;flex:1;min-width:76px;text-align:center;padding:4px 4px;border-radius:6px;border:1.5px solid #3f9a4a;background:#3f9a4a1a;font:700 .72rem var(--body)}
.tv-sch .tzb i{font-style:normal;margin-right:3px}
.tv-sch .tzb.usata{border-color:var(--ul);background:transparent;color:var(--k2);text-decoration:line-through;opacity:.7}
.tv-sch .tzb:disabled{cursor:default}
.tv-sch .tz .mv{flex:1;font-size:.8rem;white-space:nowrap}.tv-sch .tz .mv b{font:700 1.05rem var(--display)}
.tv-sch .tz .mv.ko b{color:#b3261e}
.tv-sch .tz .mini.on{background:#7d2530;color:#fff}
.tv-sch .tz .fine{all:unset;box-sizing:border-box;cursor:pointer;flex:1;text-align:center;padding:6px 10px;border-radius:6px;background:#7d2530;color:#fff;font:700 .82rem var(--body)}
.tv-sch .tz .fine:hover{background:#962c3a}
.tv-sch .dxs .dx{display:flex;align-items:center;gap:6px;padding:3px 0;font-size:.8rem;border-bottom:1px solid var(--ul)}
.tv-sch .dxs .dx:last-of-type{border-bottom:0}
.tv-sch .dxs .dxn{flex:1;min-width:0}.tv-sch .dxs .dxd{width:58px;flex:none;font-weight:700;text-align:center}
.tv-sch .dxs .dxc{width:16px;height:16px;margin:0;flex:none;accent-color:#7d2530;cursor:pointer}
.tv-sch .dxs .dx .mini,.tv-sch .dxs .dx .ing{flex:none;padding:2px 6px}
.tv-sch .dxs input.dxn,.tv-sch .dxs input.dxd{border:1px solid var(--ul);border-radius:4px;padding:2px 5px;background:transparent;color:inherit;font:inherit}
.tv-sch .dxs .dx:not(.on) .dxn,.tv-sch .dxs .dx:not(.on) .dxd{opacity:.65}
.tv-sch .poz .pz{display:flex;align-items:center;gap:6px;padding:2px 0;font-size:.8rem}
.tv-sch .poz .pz span{flex:1}.tv-sch .poz .pz small{text-transform:none;letter-spacing:0;font-weight:400}
.tv-sch .poz input{width:42px;border:1px solid var(--ul);border-radius:4px}
dialog.tv-poz menu{display:grid;gap:8px;padding:0;margin:12px 0 0}
dialog.tv-poz menu .btn{display:flex;flex-direction:column;align-items:flex-start;text-align:left}
dialog.tv-poz menu small{font-weight:400;opacity:.8}
.tv-scuro .tv-sch .pv .pt,.tv-scuro .tv-sch .ris .rn{color:#e8a0a6}
.tv-scuro .tv-sch .vec{background:#3a2f1a;border-color:#8a6d2a}
.tv-sch .sez{border:2px solid var(--lin);border-radius:8px;background:var(--box);padding:6px 7px 5px;min-width:0}
.tv-sch .lista .r{display:flex;align-items:center;gap:5px;min-height:20px}
.tv-sch .lista em{font-style:normal;font-weight:700;width:26px;text-align:center;border-bottom:1px solid var(--lin);font-size:.82rem}
.tv-sch .lista .lk{all:unset;cursor:pointer;flex:1;min-width:0;font-size:.82rem;border-radius:3px;padding:0 3px}
.tv-sch .lista .lk small{font-size:.66rem;text-transform:none;letter-spacing:0;font-weight:400}
.tv-sch .pr{all:unset;cursor:pointer;width:12px;height:12px;border-radius:50%;border:1.5px solid var(--lin);box-sizing:border-box;font-size:0;flex:none;position:relative}
.tv-sch .pr.on{background:var(--k)}
.tv-sch .pr.on[title^=Maestria]{background:#7d2530;border-color:#7d2530;box-shadow:0 0 0 2px #fff,0 0 0 3px #7d2530}
.tv-sch .pr:disabled{cursor:default}
.tv-sch .rb{all:unset;box-sizing:border-box;cursor:pointer;border-radius:6px;text-align:center}
.tv-sch .rb:hover:not(:disabled),.tv-sch .lk:hover:not(:disabled){background:#7d2530;color:#fff}
.tv-sch .rb:hover:not(:disabled) small{color:#fff}
.tv-sch .rb:disabled,.tv-sch .lk:disabled{cursor:default}
.tv-sch .grigio{background:var(--gr);border-radius:10px;padding:7px;display:flex;flex-direction:column;gap:7px}
.tv-sch .tre{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}
.tv-sch .tre>div{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;background:var(--box);border:2px solid var(--lin);padding:5px 3px;min-height:64px;text-align:center}
.tv-sch .scudo{border-radius:6px 6px 50% 50% / 6px 6px 30% 30%}
.tv-sch .qq{border-radius:8px}
.tv-sch .tre input{font:700 1.35rem var(--display);border:0;text-align:center}
.tv-sch .tre .qq input{font-size:1rem}
.tv-sch .tre .rb{font:700 1.35rem var(--display);width:100%}
.tv-sch .tre small{font-size:.52rem}
.tv-sch .pf{text-align:center}
.tv-sch .pfmax{display:flex;align-items:center;gap:6px;font-size:.66rem;color:var(--k2);text-transform:uppercase;letter-spacing:.04em;font-weight:700;border-bottom:1px solid var(--ul);padding-bottom:3px}
.tv-sch .pfmax input{width:60px;border:0;font-weight:700;font-size:.9rem}
.tv-sch .pfa{font:700 1.7rem var(--display);border:0;text-align:center;padding:4px 0}
.tv-sch .pfa.piccolo{font-size:1.15rem;padding:0}
.tv-sch .q{display:flex;gap:4px;justify-content:center;align-items:center}
.tv-sch .q input{width:48px;border:1px solid var(--ul);border-radius:4px}
.tv-sch .q button,.tv-sch .mini{all:unset;box-sizing:border-box;cursor:pointer;font:600 .74rem var(--body);padding:3px 8px;border-radius:5px;border:1px solid var(--lin);background:var(--box);white-space:nowrap;text-align:center}
.tv-sch .q button:hover,.tv-sch .mini:hover{background:#7d2530;color:#fff;border-color:#7d2530}
.tv-sch .mini:disabled{opacity:.4;cursor:default}
.tv-sch .due{display:grid;grid-template-columns:1fr 1fr;gap:7px}
.tv-sch .dvt{display:flex;align-items:center;gap:4px;font-size:.66rem;font-weight:700;color:var(--k2);text-transform:uppercase}
.tv-sch .morte .r{display:flex;align-items:center;justify-content:space-between;gap:4px;font-size:.62rem;font-weight:700;text-transform:uppercase;color:var(--k2);margin-bottom:3px}
.tv-sch .morte .mini{display:block;margin:2px auto 0;padding:1px 8px}
.tv-sch .dots{display:inline-flex;gap:3px;flex-wrap:wrap}
.tv-sch .dots button{all:unset;cursor:pointer;width:12px;height:12px;border-radius:50%;border:1.5px solid var(--lin);box-sizing:border-box}
.tv-sch .dots button.on{background:var(--k)}
.tv-sch .dots.ko button.on{background:#b3261e;border-color:#b3261e}
.tv-sch .dots button:disabled{cursor:default}
.tv-sch .atts .th{display:grid;grid-template-columns:1fr 44px 74px;gap:4px;font:700 .56rem var(--body);text-transform:uppercase;letter-spacing:.05em;color:var(--k2);padding:0 2px}
.tv-sch .at{background:var(--gr);border-radius:5px;padding:3px 4px;margin:3px 0}
.tv-sch .at .riga{display:grid;grid-template-columns:1fr 44px 74px;gap:4px;align-items:center}
.tv-sch .at .riga+.riga{grid-template-columns:1fr auto auto auto auto;margin-top:2px}
.tv-sch .at input{background:var(--box);border:0;border-radius:3px}
.tv-sch .at .an{font-weight:700}
.tv-sch .at .tp{font-size:.82rem;background:transparent}
.tv-sch .at textarea.auto{field-sizing:content;resize:none;overflow:hidden;min-height:0;line-height:1.3;white-space:pre-wrap;overflow-wrap:anywhere;background-image:none}
.tv-sch .at textarea.an{display:block;background:var(--box);border-radius:3px;padding:3px 5px;margin:0}
.tv-sch .at .riga:first-child input{align-self:start;height:calc(1.3em + 6px)}
dialog.tv-pag .tv-sch .at .riga.az .tp{flex:1 1 0}
.tv-sch .at .riga:first-child{align-items:start}
.tv-sch .at .mini{padding:1px 6px}
.tv-sch .at .via{border-color:transparent;background:transparent}
.tv-sch .agg{margin:4px 0 6px}
.tv-sch .eq{display:grid;grid-template-columns:62px 1fr;gap:8px}
.tv-sch .eq h6{grid-column:1/-1}
.tv-sch .mon{display:flex;flex-direction:column;gap:4px}
.tv-sch .mon label{display:flex;align-items:center;border:1.5px solid var(--lin);border-radius:6px;overflow:hidden}
.tv-sch .mon span{font:700 .6rem var(--body);width:24px;text-align:center;background:var(--gr);align-self:stretch;display:flex;align-items:center;justify-content:center}
.tv-sch .mon input{border:0;font-size:.82rem;padding:2px}
.tv-sch .tratti{gap:6px}
.tv-sch .cnd{display:flex;flex-wrap:wrap;gap:4px;justify-content:center;min-height:20px}
.tv-sch .cnd .ch{all:unset;cursor:pointer;background:#7d2530;color:#fff;border-radius:10px;padding:1px 8px;font-size:.72rem;font-weight:600}
.tv-sch .sez select,.tv-sch .selc{margin-top:4px;font-size:.8rem;border:1px solid var(--ul);border-radius:4px}
.tv-sch .incT{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;border:2px solid var(--lin);border-radius:8px;padding:8px 10px;background:var(--box);margin-bottom:8px}
.tv-sch .li.grande b,.tv-sch .li.grande .rb{font:700 1.3rem var(--display);text-align:center;padding:2px 0}
.tv-sch .li.grande small{text-align:center}
.tv-sch .incG{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:8px;margin-top:4px;align-items:start}
.tv-sch .lv .lt{display:flex;align-items:center;gap:6px;font:700 .62rem var(--body);text-transform:uppercase;color:var(--k2);border-bottom:2px solid var(--lin);padding-bottom:4px;margin-bottom:3px}
.tv-sch .lv .lt b{width:26px;height:26px;border:2px solid var(--lin);border-radius:50%;display:flex;align-items:center;justify-content:center;font:700 .95rem var(--display);color:var(--k)}
.tv-sch .lv .sn{width:38px;border:1px solid var(--ul);border-radius:4px}
.tv-sch .spl .ph{flex-wrap:wrap;row-gap:3px}
.tv-sch .spl .pt{font-size:.95rem;flex:1 1 120px;overflow-wrap:anywhere}
.tv-sch .spl .az2{display:flex;gap:5px;align-items:center;flex:none;margin-left:auto}
.tv-sch .spl .tg2{display:flex;gap:2px;align-items:center}
.tv-sch .spl .tg2 i{font:700 .6rem var(--body);font-style:normal;width:15px;height:15px;border-radius:50%;background:var(--k);color:var(--pp);display:flex;align-items:center;justify-content:center}
.tv-sch .spl .tg2 small{font:600 .62rem var(--body);color:var(--k2);white-space:nowrap}
.tv-sch .spl .prp{all:unset;box-sizing:border-box;cursor:pointer;flex:none;width:13px;height:13px;border:1.5px solid var(--k);border-radius:50%;margin-right:4px}
.tv-sch .spl .prp.on{background:#7d2530;border-color:#7d2530;box-shadow:inset 0 0 0 2px var(--pp)}
.tv-sch .spl .prp:disabled{cursor:default}
.tv-sch .spl .mchat{all:unset;cursor:pointer;font-size:.8rem;opacity:0;transition:opacity .15s;padding:0 2px}
.tv-sch .spl:hover .mchat,.tv-sch .spl .mchat:focus-visible{opacity:.85}
.tv-sch .spl .mchat:disabled{display:none}
.tv-livd{width:min(440px,94vw)}
.tv-liv{background:none;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:8px;margin:12px 0}
.tv-liv .btn{display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 6px;height:auto}
.tv-liv .btn b{font-size:1.15rem}.tv-liv .btn small{font-size:.7rem;opacity:.85;white-space:nowrap}
.tv-liv .btn:disabled{opacity:.4}
.tv-sch .spl .st .alt{font:italic 400 .78rem var(--body);font-variant:normal;letter-spacing:0;opacity:.7}
.tv-sch .srdA{margin:14px 4px 2px;font-size:.68rem;line-height:1.35;opacity:.6}
.tv-sch .srdb{margin:4px 0}
.tv-sch .spl .lancia{all:unset;box-sizing:border-box;cursor:pointer;padding:2px 8px;border-radius:5px;background:#7d2530;color:#fff;font:700 .72rem var(--body);white-space:nowrap}
.tv-sch .spl .lancia:hover{background:#962c3a}
.tv-sch .spl .lancia:disabled{display:none}
.tv-sch .spl .sc{margin:5px 0 2px 18px;font-size:.84rem;line-height:1.35}
.tv-sch .spl .sc p{margin:0 0 3px}
.tv-sch .spl .st{font:700 1.08rem var(--display);font-variant:small-caps;letter-spacing:.03em;color:#7d2530}
.tv-sch .spl .ss{font-style:italic;color:var(--k2);margin-bottom:4px}
.tv-sch .pvf .ig{display:grid;grid-template-columns:1fr 1fr;gap:5px}
.tv-sch .lv .agg{margin-top:4px}
.tv-scuro .tv-sch .spl .st{color:#e8a0a6}
.tv-sch .bgT{display:grid;grid-template-columns:repeat(7,1fr);gap:4px 10px;border:2px solid var(--lin);border-radius:8px;padding:6px 10px;background:var(--box);margin-bottom:8px}
.tv-sch .bgG{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:8px;margin-bottom:8px}
.tv-sch .fd .aff{display:inline-flex;align-items:center;gap:5px}.tv-sch .fd .aff select{font:inherit;border:1px solid var(--ul);border-radius:4px;background:transparent;color:inherit;padding:1px 4px}
.tv-sch .fd{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:10px;padding-top:8px;border-top:1px solid var(--ul)}
.tv-scuro .tv-sch .nm,.tv-scuro .tv-sch h4{color:var(--gold2)}
.tv-pick button small{color:var(--mute);font-size:.75rem}
/* ---- aspetto: pannelli di vetro scuro, cursori, zoom e barra della maschera ---- */
.tv{--pan:#1b1512e6;--pan2:#2a211c;--pan-b:#e7cf9a2b;--pan-ink:#f1e4c8;--pan-mute:#b8a78a;--acc:#8e2a36;--acc2:#a8323f;--ombra:0 12px 32px #000000a6,inset 0 1px 0 #ffffff0f}
.tv-tdp,.tv-sp,.tv-mbar,.tv-zoom,.tv-chip,.tv-liv{background:var(--pan);border:1px solid var(--pan-b);box-shadow:var(--ombra);-webkit-backdrop-filter:blur(10px) saturate(1.1);backdrop-filter:blur(10px) saturate(1.1)}
.tv-tdp,.tv-sp{border-radius:14px;overflow:hidden}
.tv-tdp .hd,.tv-th{background:linear-gradient(#ffffff0a,#ffffff00);border-bottom:1px solid #ffffff14}
.tv-tdp .hd b,.tv-th b{font:600 .82rem/1.2 var(--display);letter-spacing:.08em;text-transform:uppercase;color:var(--gold2)}
.tv-tdp .hd button,.tv-th button[data-k=x],.tv-sp .tv-th button{all:unset;cursor:pointer;width:26px;height:26px;border-radius:8px;display:flex;align-items:center;justify-content:center;color:var(--pan-mute);font-size:.9rem}
.tv-tdp .hd button:hover,.tv-th button[data-k=x]:hover,.tv-sp .tv-th button:hover{background:#ffffff1a;color:#fff}
.tv-th button.go{background:linear-gradient(var(--acc2),var(--acc));color:#fff;box-shadow:inset 0 1px 0 #ffffff26;border-radius:8px;padding:5px 11px}
.tv-th button.go:hover{filter:brightness(1.12)}
/* barra degli strumenti a sinistra */
.tv-rail{background:linear-gradient(180deg,#241c18,#1a1411);border-right:1px solid #000;box-shadow:inset -1px 0 0 #ffffff0a}
.tv-rail button{border-radius:10px;transition:background .15s,color .15s,transform .1s}
.tv-rail button:hover{background:#ffffff12;color:#fff}
.tv-rail button:active{transform:scale(.94)}
.tv-rail button.on{background:linear-gradient(var(--acc2),var(--acc));box-shadow:inset 0 1px 0 #ffffff2e,0 2px 8px #0008;color:#fff}
.tv-rail button.liv.on{background:linear-gradient(#7d5aa6,#5b3f80)}
.tv-rail .lbl{color:#8f7f66}
/* tiradadi */
.tv-tdp .tabs,.tv-sch .seg3{background:#00000052;border-radius:9px;padding:3px;box-shadow:inset 0 1px 2px #0008}
.tv-tdp .tabs button{border-radius:7px;transition:background .15s}
.tv-tdp .tabs button.on{background:linear-gradient(var(--acc2),var(--acc));box-shadow:inset 0 1px 0 #ffffff26}
.tv-tdp .mods input,.tv-tf input,.tv-tr input,.tv-sp input[type=search]{background:#00000059;border:1px solid #ffffff1f;border-radius:8px;color:#fff;padding:6px 9px}
.tv-tdp .mods input:focus,.tv-tf input:focus,.tv-tr input:focus,.tv-sp input[type=search]:focus{outline:none;border-color:var(--gold2);box-shadow:0 0 0 3px #e7cf9a26}
.tv-tdp table{border-collapse:separate;border-spacing:3px}
.tv-tdp td+td{border-left:0}
.tv-tdp td button{background:#ffffff0a;border-radius:7px;padding:7px 2px;transition:background .12s,transform .08s}
.tv-tdp td button:hover{background:var(--acc)}
.tv-tdp td button:active{transform:scale(.94)}
.tv-tdp td:first-child button{background:#e7cf9a14;color:var(--gold2)}
.tv-tdp .vs button{background:#ffffff0f;border:1px solid #ffffff14;border-radius:8px}
/* ordine del turno */
.tv-tr{margin:2px 6px;border-radius:9px;border-left:0;padding:5px 8px;transition:background .15s}
.tv-tr:hover{background:#ffffff0a}
.tv-tr.att{background:linear-gradient(90deg,#f2b51d33,#f2b51d0d);box-shadow:inset 3px 0 0 #f2b51d}
.tv-tr .ora{display:block;font:700 .62rem var(--body);letter-spacing:.06em;text-transform:uppercase;color:#f2b51d}
.tv-tr input{width:46px;padding:3px 5px;text-align:center}
.tv-tr em{color:var(--gold2)}
.tv-tf{gap:6px;background:#00000026}
.tv-tf input[data-k=nn]{flex:1 1 100%;min-width:0}
.tv-tf input[data-k=nv]{width:48px;flex:none;text-align:center}
.tv-tf button,.tv-th button:not(.go):not([data-k=x]){border-radius:8px;background:#ffffff14;border:1px solid #ffffff12}
.tv-tvuoto{color:var(--pan-mute);line-height:1.4}
/* elenco schede */
.tv-sp .r{border-radius:9px;margin:1px 6px;padding:5px 6px}
.tv-sp .r i{border-color:#e7cf9a66;box-shadow:0 1px 4px #0008}
.tv-sp h5{color:#9a8a70}
.tv-sp .tv-tf button{background:linear-gradient(var(--acc2),var(--acc));color:#fff;border:0;padding:6px 12px}
/* in alto: nome della mappa e livello */
.tv-chip{border-radius:12px;padding:5px 6px 5px 12px}
.tv-liv{border-radius:12px;background:#2c1d3bdd;border-color:#b98cff55}
.tv-pgbtn{border-radius:12px;background:var(--pan);color:var(--pan-ink);border:1px solid var(--pan-b);box-shadow:var(--ombra)}
.tv-pgbtn:hover{background:#2a211c;color:#fff}
/* menu del token */
.tv-pop{border-radius:12px;border-color:#e7cf9a88;padding:10px;gap:6px;box-shadow:0 14px 36px #000b}
.tv-pop .btn{border-radius:8px}
.tv-pop .row{gap:6px}
/* cursori del tavolo */
input.tv-rg{-webkit-appearance:none;appearance:none;background:transparent;height:22px;cursor:pointer;--t:#ffffff26;--f:var(--gold2);--k:#fbf0d4;--kb:#8e2a36;padding:0;margin:0;min-width:0}
input.tv-rg::-webkit-slider-runnable-track{height:5px;border-radius:3px;background:linear-gradient(to right,var(--f) var(--p,50%),var(--t) var(--p,50%))}
input.tv-rg::-moz-range-track{height:5px;border-radius:3px;background:var(--t)}
input.tv-rg::-moz-range-progress{height:5px;border-radius:3px;background:var(--f)}
input.tv-rg::-webkit-slider-thumb{-webkit-appearance:none;width:17px;height:17px;margin-top:-6px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff,var(--k) 60%);border:2px solid var(--kb);box-shadow:0 1px 4px #000a;transition:transform .1s}
input.tv-rg::-moz-range-thumb{width:13px;height:13px;border-radius:50%;background:var(--k);border:2px solid var(--kb);box-shadow:0 1px 4px #000a}
input.tv-rg:hover::-webkit-slider-thumb,input.tv-rg:active::-webkit-slider-thumb{transform:scale(1.15)}
input.tv-rg:focus-visible{outline:none}
input.tv-rg:focus-visible::-webkit-slider-thumb{box-shadow:0 0 0 4px #e7cf9a40}
input.tv-rg:disabled{opacity:.4;cursor:default}
dialog.tv-gd input.tv-rg{--t:var(--line2);--f:var(--wine);--k:#fff;--kb:var(--wine)}
/* zoom */
.tv-incolla{position:absolute;right:64px;top:62px;z-index:7;display:flex;gap:6px;align-items:center;padding:6px;border-radius:12px;background:var(--pan);border:1px solid var(--pan-b);box-shadow:var(--ombra);max-width:calc(100% - 32px)}
.tv-incolla .pri{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tv-zoom{position:absolute;right:12px;top:62px;display:flex;flex-direction:column;align-items:center;gap:2px;z-index:6;border-radius:16px;padding:6px 5px}
.tv-zoom button{all:unset;box-sizing:border-box;cursor:pointer;width:32px;height:32px;border-radius:10px;display:flex;align-items:center;justify-content:center;color:var(--pan-ink);transition:background .12s}
.tv-zoom button svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.tv-zoom button:hover{background:#ffffff17;color:#fff}
.tv-zoom button:active{transform:scale(.92)}
.tv-zoom .sep{width:20px;height:1px;background:#ffffff1f;margin:4px 0}
.tv-zoom .zp{width:42px;height:22px;border-radius:7px;font:700 .68rem/1 var(--body);color:var(--gold2);background:#00000047;margin-top:2px}
.tv-zs{position:relative;width:32px;height:150px;cursor:ns-resize;touch-action:none;outline:none;margin:2px 0}
.tv-zs .tr{position:absolute;left:50%;top:7px;bottom:7px;width:5px;margin-left:-2.5px;border-radius:3px;background:#ffffff1c;box-shadow:inset 0 1px 2px #000a;overflow:hidden}
.tv-zs .tr i{position:absolute;left:0;right:0;bottom:0;height:calc(var(--p,.5) * 100%);background:linear-gradient(to top,var(--acc),var(--gold2))}
.tv-zs .tk{position:absolute;left:50%;width:12px;margin-left:-6px;height:1px;background:#ffffff40;bottom:calc(7px + (100% - 14px) * var(--q))}
.tv-zs .tk.uno{width:16px;margin-left:-8px;background:var(--gold2)}
.tv-zs .kn{position:absolute;left:50%;width:18px;height:18px;margin:0 0 -9px -9px;bottom:calc(7px + (100% - 14px) * var(--p,.5));border-radius:50%;background:radial-gradient(circle at 35% 30%,#fffaf0,#e7cf9a 55%,#a9853b);box-shadow:0 0 0 2px #1b1512,0 2px 8px #000c;transition:transform .12s}
.tv-zs:hover .kn,.tv-zs.on .kn{transform:scale(1.18)}
.tv-zs:focus-visible .kn{box-shadow:0 0 0 2px #1b1512,0 0 0 5px #e7cf9a66}
/* tiri salvezza da fare */
.tv-ts{position:absolute;left:50%;top:58px;transform:translateX(-50%);z-index:11;width:min(430px,calc(100% - 20px));max-height:min(60%,420px);display:flex;flex-direction:column;background:#211a16f7;color:#f1e4c8;border:1px solid #e7cf9a66;border-radius:14px;box-shadow:0 10px 34px #000c,0 0 0 3px #e7cf9a1f;animation:tvTs .35s ease-out}
.tv-ts[hidden]{display:none!important}
@keyframes tvTs{from{opacity:0;transform:translate(-50%,-12px) scale(.96)}to{opacity:1;transform:translateX(-50%)}}
.tv-ts .h{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 12px 7px;border-bottom:1px solid #e7cf9a2b;font:700 .92rem var(--body);color:#e7cf9a}
.tv-ts .l{overflow:auto;padding:4px 6px 6px}
.tv-ts .ts{display:flex;align-items:center;gap:10px;padding:8px 6px;border-radius:10px}
.tv-ts .ts+.ts{border-top:1px solid #ffffff12}
.tv-ts .ts.va{opacity:.5;pointer-events:none}
.tv-ts .tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.tv-ts .tx b{font:700 .95rem var(--body)}
.tv-ts .tx .car{font:700 .82rem var(--body);color:#ffd88a}
.tv-ts .tx small{font:500 .74rem var(--body);color:#b8a78a}
.tv-ts .bt{display:flex;gap:4px;flex:none}
.tv-ts button{all:unset;box-sizing:border-box;cursor:pointer;height:32px;padding:0 9px;display:flex;align-items:center;border-radius:8px;background:#ffffff12;font:700 .8rem var(--body);color:#f1e4c8;white-space:nowrap}
.tv-ts button:hover{background:#ffffff24}
.tv-ts button:focus-visible{outline:2px solid #e7cf9a}
.tv-ts button.tira,.tv-ts .h button{background:#8e2a36;color:#fff}
.tv-ts button.tira:hover,.tv-ts .h button:hover{background:#a8323f}
@media (max-width:560px){.tv-ts .ts{flex-wrap:wrap}.tv-ts .bt{width:100%}.tv-ts button.tira{flex:1;justify-content:center}}
/* barra della maschera */
.tv-mbar{position:absolute;left:10px;top:10px;z-index:8;display:flex;flex-wrap:wrap;align-items:center;gap:6px;max-width:calc(100% - 250px);color:var(--pan-ink);border-radius:14px;padding:6px}
.tv-mbar[hidden]{display:none!important}
.tv-mbar .g{display:flex;align-items:center;gap:3px;padding:2px;border-radius:10px}
.tv-mbar .g.seg{border:0;overflow:visible;background:#00000052;box-shadow:inset 0 1px 2px #0008;padding:3px}
.tv-mbar .g.sl{gap:8px;padding:2px 8px;background:#ffffff0a;border-radius:10px;height:34px;box-sizing:border-box}
.tv-mbar .g.sl>span{font:600 .76rem var(--body);color:var(--pan-mute)}
.tv-mbar .g.sl>svg{width:16px;height:16px;fill:none;stroke:var(--pan-mute);stroke-width:2}
.tv-mbar .g.sl input{width:92px}
.tv-mbar .g.seg.sgt{flex-wrap:wrap;max-width:min(470px,100%);justify-content:center}
.tv-mbar .g.seg.sgt button{padding:0 7px;font-size:1.05rem}
.tv-mbar .g.sl input[type=text],.tv-mbar .g.sl input[type=number]{height:26px;box-sizing:border-box;background:#0006;border:1px solid #ffffff2a;border-radius:6px;color:var(--pan-ink);font:600 .8rem var(--body);padding:0 6px}
.tv-mbar output{font:700 .72rem var(--body);color:var(--gold2);min-width:54px;text-align:right;white-space:nowrap}
.tv-mbar output[data-m=tv]{min-width:30px}
.tv-mbar button{all:unset;box-sizing:border-box;cursor:pointer;display:flex;align-items:center;gap:6px;height:30px;padding:0 10px;border-radius:8px;font:600 .8rem var(--body);white-space:nowrap;color:var(--pan-ink);transition:background .12s}
.tv-mbar .g:not(.seg) button{background:#ffffff12;border:1px solid #ffffff12}
.tv-mbar button svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.tv-mbar button:hover{background:#ffffff22}
.tv-mbar button.on{background:linear-gradient(var(--acc2),var(--acc));color:#fff;box-shadow:inset 0 1px 0 #ffffff2e,0 1px 4px #0008}
.tv-mbar button[disabled]{opacity:.35;pointer-events:none}
.tv-mbar.spenta .g:not(:first-child){opacity:.5}
.tv-mbar .sw{display:flex;align-items:center;gap:8px;font:600 .82rem var(--body);cursor:pointer;padding:0 8px 0 4px;height:30px;white-space:nowrap}
.tv-mbar .sw input{position:absolute;opacity:0;pointer-events:none}
.tv-mbar .sw .tg{position:relative;width:36px;height:20px;border-radius:10px;background:#ffffff26;box-shadow:inset 0 1px 3px #000a;transition:background .2s}
.tv-mbar .sw .tg::after{content:"";position:absolute;left:2px;top:2px;width:16px;height:16px;border-radius:50%;background:#f1e4c8;box-shadow:0 1px 3px #000a;transition:transform .2s}
.tv-mbar .sw input:checked+.tg{background:linear-gradient(var(--acc2),var(--acc))}
.tv-mbar .sw input:checked+.tg::after{transform:translateX(16px);background:#fff}
.tv-mbar .sw input:focus-visible+.tg{box-shadow:0 0 0 3px #e7cf9a55}
/* linguetta della chat */
.tv-ctab{border-radius:10px 0 0 10px;box-shadow:-4px 0 14px #0007}
/* la scheda nella pagina del personaggio: riempie il riquadro accanto al testo */
dialog.dlg.tv-side.tv-sw.tv-pag{position:relative;inset:auto;margin:0;width:100%!important;height:100%!important;max-height:none;min-width:0;min-height:0;z-index:auto;border-radius:8px;box-shadow:0 10px 30px #0005}
dialog.dlg.tv-side.tv-centro{inset:0;margin:auto;height:fit-content}
/* fuori dal Tavolo la scheda non tira i dadi: i valori restano, i pulsanti dei tiri spariscono */
dialog.tv-pag .seg3,dialog.tv-pag .tbar .sg,dialog.tv-pag .mini[data-roll],dialog.tv-pag [data-k=prv-dadi],dialog.tv-pag [data-k=inc-lancia],dialog.tv-pag [data-k=inc-chat],dialog.tv-pag [data-k=tirapf],dialog.tv-pag [data-k=bevi]{display:none!important}
dialog.tv-pag [data-roll]{pointer-events:none;cursor:default}
dialog.tv-pag .tv-sch .dt{all:unset;font:inherit;color:inherit}
dialog.tv-pag .tv-sch button[data-roll]:not(.rb){border:0!important;text-decoration:none!important;background:none!important;box-shadow:none!important}
dialog.dlg.tv-side.tv-sw.tv-scuro{background:#1d1814;color:#efe5d0;border-color:#5a4d3e}
.tv-scuro .tv-sch{--k:#efe5d0;--k2:#bcae95;--lin:#8a7a60;--gr:#2b241e;--pp:#1d1814;--box:#241e19;--ul:#5e5244;--rig:#ffffff10}
.tv-scuro .tv-sch .cbox .ov,.tv-scuro .tv-sch .lv .lt b{background:#1d1814}
.tv-scuro .tv-sch input:focus,.tv-scuro .tv-sch textarea:focus,.tv-scuro .tv-sch select:focus{background:#2e2620}
.tv-scuro .tv-sch select option{background:#241e19;color:#efe5d0}
.tv-scuro .tv-sch .tabs button.on{background:#1d1814}
.tv-scuro .tv-sch .pr.on[title^=Maestria]{background:#c7505c;border-color:#c7505c;box-shadow:0 0 0 2px #241e19,0 0 0 3px #c7505c}
.tv-scuro .tv-sch .dots button.on,.tv-scuro .tv-sch .pr.on{background:var(--k)}
.tv-sch .sb{--sbr:#7a200d;--sbl:#922610;max-width:620px;margin:4px auto 0;padding:14px 16px 16px;background:var(--pp);border:1px solid var(--ul);border-top:4px solid #c9ad6a;border-bottom:4px solid #c9ad6a;box-shadow:0 2px 10px #0002;font:400 .93rem/1.42 var(--body);color:var(--k)}
.tv-sch .sb .sbh{display:flex;align-items:flex-start;gap:10px;justify-content:space-between}
.tv-sch .sb h3{margin:0;font:700 1.55rem/1.1 var(--display);font-variant:small-caps;letter-spacing:.02em;color:var(--sbr)}
.tv-sch .sb .sbh i{display:block;font-size:.88rem;margin-top:2px}
.tv-sch .sb hr{border:0;height:4px;margin:8px 0;background:linear-gradient(90deg,var(--sbl),var(--sbl) 70%,transparent);clip-path:polygon(0 0,100% 50%,0 100%)}
.tv-sch .sb p{margin:3px 0}
.tv-sch .sb .rosso{color:var(--sbr)}
.tv-sch .sb .rosso hr{margin:8px 0}
.tv-sch .sb h4{margin:12px 0 4px;font:600 1.12rem var(--display);font-variant:small-caps;color:var(--sbr);border-bottom:1px solid var(--sbl);padding-bottom:1px}
.tv-sch .sb .sbc{display:grid;grid-template-columns:repeat(6,1fr);gap:2px;text-align:center;color:var(--sbr)}
.tv-sch .sb .sbc button{all:unset;cursor:pointer;display:flex;flex-direction:column;align-items:center;padding:3px 0;border-radius:6px}
.tv-sch .sb .sbc b{font-size:.84rem;letter-spacing:.04em}
.tv-sch .sb .sbc span{font-size:.9rem;color:var(--k)}
.tv-sch .sb .sbc button:hover:not(:disabled),.tv-sch .sb .dt:hover:not(:disabled),.tv-sch .sb .lk:hover:not(:disabled){background:#9226101a}
.tv-sch .sb .dt,.tv-sch .sb .lk{all:unset;cursor:pointer;color:inherit;border-bottom:1px dotted currentColor;border-radius:3px;padding:0 1px}
.tv-sch .sb .dt:disabled,.tv-sch .sb .lk:disabled,.tv-sch .sb .sbc button:disabled{cursor:default;border-bottom:0}
.tv-sch .sb .pfr{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px}
.tv-sch .sb .pfr .ora{display:inline-flex;align-items:center;gap:4px;margin-left:auto;font-weight:600;color:var(--k)}
.tv-sch .sb .pfr .ora.ko{color:#b3261e}
.tv-sch .sb .pfi{width:52px;font:inherit;font-weight:700;text-align:center;border:1px solid var(--ul);border-radius:5px;background:var(--box);color:inherit;padding:1px 2px}
.tv-sch .sb .q{display:inline-flex;gap:3px;align-items:center}
.tv-sch .sb .q button{all:unset;cursor:pointer;width:24px;height:24px;border-radius:6px;display:grid;place-items:center;background:var(--sbl);color:#fff;font-weight:700}
.tv-sch .sb .q input{width:42px;font:inherit;text-align:center;border:1px solid var(--ul);border-radius:5px;background:var(--box);color:inherit;padding:1px}
.tv-sch .sb .due{display:flex;flex-wrap:wrap;gap:2px 18px}
.tv-sch .sb .iz{margin-top:8px}
.tv-sch .sb .cnd{display:flex;flex-wrap:wrap;gap:4px;align-items:center}
.tv-sch .sb .vuoto{color:var(--k2);font-style:italic}
.tv-sch .fine{display:block;margin:0 0 8px}
.tv-scuro .tv-sch .sb{--sbr:#e59a7f;--sbl:#c4553a;border-top-color:#8a7240;border-bottom-color:#8a7240}
@media (max-width:820px){.tv-sch .sb{padding:10px}.tv-sch .sb .sbc{grid-template-columns:repeat(3,1fr);row-gap:6px}}
@media (max-width:820px){
  .tv-rail{width:44px}.tv-rail button{width:34px;height:34px}
  .tv-chat.scal,.tv-chat.sch{width:auto;height:72%;max-height:72%}.tv-crz{display:none}
  .tv-chat{position:absolute;right:0;bottom:0;left:0;width:auto;max-height:62%;z-index:12;border-left:0;border-top:2px solid var(--gold);box-shadow:0 -8px 24px #0008;border-radius:12px 12px 0 0}
  .tv-ctab{top:auto;bottom:calc(62% + 8px);transform:none;width:40px;height:34px;border-radius:9px 0 0 9px}
  .tv-ctab.chiusa{bottom:12px}.tv-ctab:not(.chiusa){display:none}
  .tv-cx{width:36px;height:36px;font-size:1.05rem;background:#0000000c}
  dialog.dlg.tv-side{inset:auto 8px 8px 8px;width:auto;max-height:58vh}
  dialog.dlg.tv-side.tv-sw{inset:auto 0 0 0;width:auto!important;height:auto!important;min-width:0;max-height:90vh;border-radius:12px 12px 0 0}
  dialog.tv-sw>.rz{display:none}
  .tv-sch .testa{grid-template-columns:1fr}.tv-sch .info{grid-template-columns:repeat(2,1fr)}
  .tv-sch .bgT{grid-template-columns:repeat(4,1fr)}
  .tv-sch .tbar{cursor:default}.tv-sch .tbar .tt,.tv-sch .tbar .grip{display:none}.tv-sch .tbar .x{margin-left:auto}
  .tv-sch .tabs{overflow-x:auto;scrollbar-width:none}.tv-sch .tabs button{white-space:nowrap;padding:5px 8px;font-size:.72rem}
  .tv-chip b{max-width:34vw}
  .tv-pgrid{grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px}
}
}`;
  let cssDone = false;
  // la grafica nuova del tavolo: striscia del turno, pannello del turno, menu del token, chat coi dadi, telefono
  const CSS2 = `.tv-x{}
/* ---------- grafica nuova: pulsanti comuni ---------- */
.tv-b{all:unset;box-sizing:border-box;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;height:34px;padding:0 13px;border-radius:9px;font:600 .82rem var(--body);white-space:nowrap;transition:filter .12s,background .12s}
.tv-b:focus-visible{outline:2px solid var(--gold2);outline-offset:2px}
.tv-b.pri{background:linear-gradient(var(--acc2),var(--acc));color:#fff;box-shadow:inset 0 1px 0 #ffffff33,0 2px 6px #0007}
.tv-b.pri:hover,.tv-b.ko:hover,.tv-b.ok:hover{filter:brightness(1.12)}
.tv-b.sec{background:#ffffff14;color:var(--pan-ink);border:1px solid #ffffff22}
.tv-b.sec:hover{background:#ffffff26}
.tv-b.ko{background:#a3262f;color:#fff}.tv-b.ok{background:#2f7d3e;color:#fff}
.tv-b.ico{width:34px;padding:0;font-size:1rem}
.tv-b[disabled]{opacity:.45;pointer-events:none}

/* barra degli strumenti con le scritte */
.tv-rail{width:66px;gap:3px;padding:8px 0}
.tv-rail button{width:58px;height:50px;flex-direction:column;gap:3px;border-radius:10px}
.tv-rail button svg{width:20px;height:20px}
.tv-rail button .rl{font:600 .6rem/1 var(--body);letter-spacing:.01em;color:#cbb994;white-space:nowrap}
.tv-rail button.on .rl{color:#fff}
.tv-rail button.on::before{content:"";position:absolute;left:-4px;top:12px;bottom:12px;width:3px;border-radius:2px;background:var(--gold2)}
.tv-rail button.tel{display:none}
.tv-rail hr{width:40px}
.tv-rail .lbl{color:var(--gold2);opacity:.75}

/* ordine del turno: striscia in alto */
.tv-strip{position:absolute;left:12px;top:10px;z-index:9;display:flex;align-items:center;gap:10px;background:var(--pan);border:1px solid var(--pan-b);border-radius:16px;padding:6px 8px 6px 12px;box-shadow:var(--ombra);color:var(--pan-ink);max-width:calc(100% - 340px);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
.tv-strip[hidden]{display:none!important}
.tv-strip .rd{display:flex;flex-direction:column;align-items:center;font:700 1.05rem/1 var(--display);color:var(--gold2);padding-right:10px;border-right:1px solid #ffffff1f;flex:none}
.tv-strip .rd small{font:600 .55rem/1 var(--body);letter-spacing:.08em;text-transform:uppercase;color:var(--pan-mute);margin-bottom:3px}
.tv-strip .ls{display:flex;align-items:flex-end;gap:8px;overflow-x:auto;scrollbar-width:none;min-width:0;padding-top:6px}
.tv-strip .ls::-webkit-scrollbar{display:none}
.tv-strip .p{position:relative;display:flex;flex-direction:column;align-items:center;gap:3px;width:52px;flex:none;opacity:.88}
.tv-strip .p i{width:40px;height:40px;border-radius:50%;background:var(--c) center/cover no-repeat;border:2px solid #ffffff55;display:flex;align-items:center;justify-content:center;font:700 .8rem var(--display);font-style:normal;color:#fff;box-sizing:border-box}
.tv-strip .p b{font:600 .66rem/1 var(--body);max-width:52px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tv-strip .p em{position:absolute;top:-6px;right:2px;min-width:18px;height:18px;padding:0 3px;box-sizing:border-box;border-radius:9px;background:#000;border:1px solid #ffffff44;font:700 .62rem/16px var(--body);font-style:normal;text-align:center}
.tv-strip .p.nem i{border-color:#e05a5a}
.tv-strip .p.hid{opacity:.5;font-style:italic}
.tv-strip .p.gia{opacity:.45}
.tv-strip .p.on{opacity:1;width:64px}
.tv-strip .p.on i{width:52px;height:52px;border:3px solid var(--gold2);box-shadow:0 0 0 3px #e7cf9a44,0 0 16px #e7cf9a88}
.tv-strip .p.on b{color:var(--gold2);font-size:.72rem}
.tv-strip .p.on em{background:#c9a24a;color:#1d1613;border-color:#fff}
.tv-strip .ac{display:flex;gap:6px;padding-left:10px;border-left:1px solid #ffffff1f;flex:none}
.tv-strip .mv{flex:none;align-self:stretch;display:flex;align-items:center;margin:-6px 0 -6px -8px;padding:0 2px 0 6px;color:var(--pan-mute);cursor:grab;touch-action:none;user-select:none;font-size:.9rem}
.tv-strip .mv:hover{color:var(--gold2)}
.tv-strip.tira{opacity:.92;box-shadow:0 14px 40px #000c}.tv-strip.tira .mv{cursor:grabbing}
.tv-strip .tv-b.on{background:#e7cf9a33;color:var(--gold2)}
.tv-strip.vert{flex-direction:column;align-items:stretch;gap:0;padding:0;width:262px;max-width:calc(100% - 24px);max-height:calc(100% - 20px);overflow:hidden;border-radius:14px}
.tv-strip.vert.ed{width:300px}
.tv-strip.col{flex-direction:column;align-items:center;gap:8px;padding:6px 6px 8px;max-height:calc(100% - 20px);max-width:none;width:80px;box-sizing:border-box}
.tv-strip.col .mv{margin:0;padding:2px 0;align-self:stretch;justify-content:center}
.tv-strip.col .rd{padding:0 0 8px;border-right:0;border-bottom:1px solid #ffffff1f;align-self:stretch}
.tv-strip.col .ls{flex-direction:column;align-items:center;overflow-x:hidden;overflow-y:auto;padding:6px 0 0;min-height:0;flex:0 1 auto}
.tv-strip.col .ac{flex-direction:column;align-items:stretch;padding:8px 0 0;border-left:0;border-top:1px solid #ffffff1f;align-self:stretch}
.tv-strip.col .ac .tv-b{justify-content:center}
.tv-strip.col .ac .tv-b.pri{padding:0 6px;font-size:.74rem}
.tv-strip.vert .tt{display:flex;align-items:center;gap:8px;padding:6px 8px;background:linear-gradient(#ffffff0a,#ffffff00);border-bottom:1px solid #ffffff14}
.tv-strip.vert .tt b{flex:1;font:700 1.05rem/1 var(--display);color:var(--gold2);white-space:nowrap}
.tv-strip.vert .tt b small{font:600 .6rem/1 var(--body);letter-spacing:.08em;text-transform:uppercase;color:var(--pan-mute)}
.tv-strip.vert .tt .mv{margin:-6px 0 -6px -8px;padding:0 0 0 8px}
.tv-strip.vert .tt .ac{padding-left:0;border:0}
.tv-strip .tv-b[hidden]{display:none}
.tv-strip.vert .tv-tl{max-height:min(460px,60vh)}
.tv-strip.vert .tv-tr.gia{opacity:.55}
.tv-strip.vert .pie{display:flex;justify-content:stretch;padding:8px 10px 10px;border-top:1px solid #ffffff1a}
.tv-strip.vert .pie .tv-b{flex:1;justify-content:center;height:38px}
.tv-strip.vert .pie:has(.tv-b[hidden]){display:none}
.tv-wrap.con-turno .tv-tdp,.tv-wrap.con-turno .tv-sp{top:96px;max-height:calc(100% - 106px)}

/* il pannello del turno, in basso al centro */
.tv-hud{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);z-index:9;display:flex;align-items:center;gap:12px;background:var(--pan);border:1px solid #e7cf9a55;border-radius:16px;padding:8px 10px 8px 8px;box-shadow:var(--ombra);color:var(--pan-ink);max-width:calc(100% - 24px);box-sizing:border-box;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
.tv-hud[hidden]{display:none!important}
.tv-hud .fo{width:46px;height:46px;border-radius:50%;background:var(--c) center/cover no-repeat;border:3px solid var(--gold2);flex:none;display:flex;align-items:center;justify-content:center;font:700 .9rem var(--display);font-style:normal;color:#fff;box-sizing:border-box}
.tv-hud .t{display:flex;flex-direction:column;gap:6px;min-width:0}
.tv-hud .t>b{font:600 .9rem/1 var(--display);color:var(--gold2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tv-hud .r{display:flex;gap:6px}
.tv-hud .c{all:unset;box-sizing:border-box;cursor:pointer;display:flex;align-items:center;gap:5px;padding:6px 10px;border-radius:9px;font:700 .8rem/1 var(--body);white-space:nowrap;background:#2f7d3e;color:#fff;box-shadow:inset 0 1px 0 #ffffff33}
.tv-hud .c.no{background:#ffffff12;color:#8f867c;text-decoration:line-through;box-shadow:none}
.tv-hud .c:focus-visible{outline:2px solid var(--gold2)}
.tv-hud .c[disabled]{cursor:default}
.tv-hud .mv{display:flex;flex-direction:column;gap:5px;min-width:130px;font:600 .78rem var(--body);white-space:nowrap}
.tv-hud .mv b{font:700 1.05rem var(--display);color:#fff}
.tv-hud .mv.ko b{color:#ff8a7d}
.tv-hud .bar{height:8px;border-radius:4px;background:#000;overflow:hidden;box-shadow:inset 0 0 0 1px #ffffff1a}
.tv-hud .bar s{display:block;height:100%;background:linear-gradient(90deg,#e7cf9a,#c9a24a);transition:width .25s}
.tv-hud .ac{display:flex;gap:6px;align-items:center}
.tv-hud .ac .tv-b{height:40px}
.tv-hud .ac .tv-b.sec.on{background:#c9a24a;color:#1d1613;border-color:#c9a24a}
.tv-hud .fzr{flex-wrap:wrap}
.tv-hud .fz{all:unset;box-sizing:border-box;cursor:pointer;display:flex;align-items:center;gap:4px;padding:6px 9px;border-radius:9px;background:#c9a24a2e;border:1px solid #c9a24a99;color:#f3e3bd;font:700 .76rem/1 var(--body);white-space:nowrap}
.tv-hud .sh{display:none}
.tv-hud .fz:hover,.tv-hud .fz:focus-visible{background:#c9a24a55;outline:none}
/* menu delle azioni (Scatto, Disimpegno…): sta sopra a tutto, anche alla scheda */
.tv-azm{position:fixed;z-index:1000;width:340px;max-width:calc(100vw - 12px);max-height:min(72vh,560px);overflow:auto;box-sizing:border-box;background:#211a16f7;color:#f1e4c8;border:1px solid #e7cf9a55;border-radius:14px;box-shadow:0 12px 34px #000c;padding:6px;font:600 .86rem/1.2 var(--body);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
.tv-azm h5{margin:8px 8px 4px;font:600 .68rem/1.3 var(--display);letter-spacing:.1em;text-transform:uppercase;color:#e7cf9a}
.tv-azm h5 small{letter-spacing:0;text-transform:none;font:italic 400 .76rem var(--body);color:#bda983;margin-left:4px}
.tv-azm .gz{display:grid;grid-template-columns:1fr 1fr;gap:2px}
.tv-azm button{all:unset;box-sizing:border-box;cursor:pointer;display:flex;gap:8px;align-items:flex-start;width:100%;padding:7px 7px;border-radius:9px;min-width:0}
.tv-azm button>div{min-width:0}
.tv-azm button:hover,.tv-azm button:focus-visible{background:#7d253099;outline:none}
.tv-azm button[disabled]{opacity:.38;cursor:default;background:none}
.tv-azm button>span{font-size:1.05rem;line-height:1.2;width:20px;text-align:center;flex:none}
.tv-azm button b{display:block;font-weight:700}
.tv-azm button small{display:block;margin-top:2px;color:#bda983;font:400 .76rem/1.25 var(--body)}
.tv-azm button>i{width:24px;height:24px;border-radius:50%;background:var(--c,#7d2530) center/cover no-repeat;border:1.5px solid #e7cf9a88;flex:none;box-sizing:border-box}
.tv-azm .ind{justify-content:center;margin-top:4px;color:#e7cf9a;font-weight:700}
.tv-mbar .avv.opp{display:block;margin-top:4px;padding:5px 8px;border-radius:8px;background:#a3262f55;border:1px solid #ff8a7d66;color:#ffd9d3}
.tv-azm .nota{margin:6px 8px 4px;padding-top:8px;border-top:1px solid #ffffff1a;color:#bda983;font:400 .74rem/1.3 var(--body)}
/* fin dove arriva chi gioca: le caselle che il movimento rimasto copre */
.tv-mvr{position:absolute;pointer-events:none;border:2px dashed #e7cf9acc;border-radius:12px;background:#e7cf9a1c;box-shadow:inset 0 0 40px #e7cf9a26;z-index:0;box-sizing:border-box}
body:has(.tv-wrap.con-hud) #toasts{bottom:var(--tv-avvisi,110px)}
.tv-mvr.finito{border-color:#e7cf9a66;background:#00000026;box-shadow:none}
.tv-mvr span{position:absolute;left:50%;bottom:0;transform:translate(-50%,60%);background:#1d1613;color:#e7cf9a;border:1px solid #e7cf9a88;border-radius:9px;padding:2px 9px;font:700 var(--fs,14px)/1.3 var(--body);white-space:nowrap}
.tv-tok .az{all:unset;position:absolute;inset:0;pointer-events:none;z-index:5;display:block}
.tv-tok .az[hidden]{display:none}
.tv-tok .az button{all:unset;box-sizing:border-box;position:absolute;pointer-events:auto;cursor:pointer;border-radius:50%;display:flex;align-items:center;justify-content:center;font:700 calc(var(--fs,13px)*.95)/1 var(--body);color:#fff;background:#2f8a3c;box-shadow:0 0 0 2px #1d1613,0 0 0 3px #e7cf9a99,0 2px 5px #000a;transition:transform .12s,background .15s}
.tv-tok .az button.c.no{background:#5b544e;color:#b4aaa0;box-shadow:0 0 0 2px #1d1613,0 2px 4px #0008}
.tv-tok .az button.c.no::after{content:"";position:absolute;left:18%;right:18%;top:50%;height:2px;background:#d9cfc4;transform:rotate(-40deg);border-radius:1px}
.tv-tok .az button:hover:not([disabled]){transform:scale(1.12)}
.tv-tok .az button:focus-visible{outline:2px solid #e7cf9a;outline-offset:2px}
.tv-tok .az button[disabled]{cursor:default}
.tv-tok .az .mt{left:50%;transform:translateX(-50%);height:auto;border-radius:10px;padding:2px 8px;gap:3px;white-space:nowrap;background:#1d1613;color:#e7cf9a;border:1px solid #e7cf9a99;box-shadow:0 2px 6px #000a;font:700 calc(var(--fs,13px)*.9)/1.25 var(--body)}
.tv-tok .az .mt small{font-size:.8em;color:#bfae8a;font-weight:600}
.tv-tok .az .mt.ko{color:#ff8a7d;border-color:#ff8a7d99}
.tv-tok .az .mt .dd{font-size:.75em;margin-left:2px;opacity:.8}
.tv-tok .az .mt:hover:not([disabled]){transform:translateX(-50%) scale(1.06)}
.tv-tok.turno{box-shadow:0 0 0 4px #e7cf9a,0 0 22px 6px #e7cf9acc}

/* token: barra della salute sotto, nome più leggibile */
.tv-tok .pf{top:auto;bottom:-9px;left:6%;right:6%;height:7px;border-radius:4px;box-shadow:0 0 0 1.5px #000c;z-index:3}
.tv-tok b{margin-top:10px;background:#120d0bd9;border:1px solid #ffffff2a;font-weight:700}
.tv-tok .cnd i{background:#2b1d14;box-shadow:0 0 0 2px #e7cf9a,0 2px 4px #000a}

/* luogo e mappe in alto a destra */
.tv-chip{border-radius:12px;padding:6px 8px 6px 12px;gap:10px}
.tv-chip .qui{font:600 .72rem/1 var(--body);color:#9fd08f;display:flex;align-items:center;gap:6px;white-space:nowrap}
.tv-chip .qui::before{content:"";width:8px;height:8px;border-radius:50%;background:#5cc06a;box-shadow:0 0 0 3px #5cc06a33}
.tv-pgbtn{width:auto;padding:0 12px;gap:6px;font:600 .82rem var(--body);border-radius:12px}

/* chat: dadi rapidi sotto, tiri più leggibili */
.tv-dk{display:flex;flex-direction:column;gap:8px;padding:8px 10px 10px}
.tv-dk .dd{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
.tv-dk .dd button{all:unset;box-sizing:border-box;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:1px;padding:5px 0 4px;border-radius:9px;background:var(--paper);border:1px solid var(--line2);font:700 .66rem/1 var(--body);color:var(--ink2)}
.tv-dk .dd button svg{width:22px;height:22px;fill:#7d253018;stroke:var(--wine);stroke-width:1.6;stroke-linejoin:round}
.tv-dk .dd button:hover,.tv-dk .dd button:focus-visible{border-color:var(--wine);outline:none}
.tv-dk .dd button:active{transform:scale(.94)}
.tv-dk .op{display:flex;gap:4px;align-items:center}
.tv-svuota.arm{width:auto!important;padding:0 11px;border-radius:15px;background:#a61e2d!important;color:#fff!important;font:700 .78rem var(--body)!important;white-space:nowrap}
.tv-dk .sg{display:flex;background:var(--paper);border:1px solid var(--line2);border-radius:9px;padding:2px;gap:2px;flex:1;min-width:0}
.tv-dk .sg button{all:unset;flex:1;text-align:center;cursor:pointer;font:600 .74rem/1 var(--body);padding:6px 1px;border-radius:7px;color:var(--ink2);white-space:nowrap}
.tv-dk .sg button.on{background:var(--wine);color:#fff}
.tv-dk .md{width:40px;padding:0 2px;height:30px;box-sizing:border-box;border:1px solid var(--line2);border-radius:9px;background:var(--paper);color:var(--ink);text-align:center;font:600 .8rem var(--body);flex:none}
.tv-dk .md{-moz-appearance:textfield;appearance:textfield}.tv-dk .md::-webkit-inner-spin-button,.tv-dk .md::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
.tv-dk .sgr{all:unset;box-sizing:border-box;cursor:pointer;height:30px;padding:0 7px;border-radius:9px;border:1px solid var(--line2);background:var(--paper);display:flex;align-items:center;justify-content:center;font:700 .72rem var(--body);color:var(--ink2);white-space:nowrap;flex:none}
.tv-dk .sgr.on{background:#6b3fa0;border-color:#6b3fa0;color:#fff}
.tv-dk .in{display:flex;gap:6px}
.tv-dk .in input{flex:1;min-width:0;height:38px;box-sizing:border-box;border:1px solid var(--line2);border-radius:19px;padding:0 14px;background:var(--paper);color:var(--ink);font:inherit}
.tv-dk .in button{all:unset;cursor:pointer;width:38px;height:38px;border-radius:50%;background:linear-gradient(var(--acc2),var(--acc));color:#fff;display:flex;align-items:center;justify-content:center;font-size:1rem;box-shadow:0 2px 5px #0005;flex:none}
.tv-roll{border-radius:12px;padding:8px 10px}
.tv-roll .t{min-width:44px;height:40px;display:flex;align-items:center;justify-content:center;font-size:1.3rem;color:#fff;background:#7d2530;clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%);flex:none}
.tv-roll.crit .t{background:#2f8a3c;color:#fff}.tv-roll.fail .t{background:#b3261e;color:#fff}
.tv-roll.priv .t{background:#6b3fa0}
.tv-roll .chips i{border-radius:6px}

/* tiradadi */
.tv-tdp .dz{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:0 10px}
.tv-tdp .dz button{all:unset;box-sizing:border-box;cursor:pointer;position:relative;display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 0 6px;border-radius:10px;background:#ffffff0d;border:1px solid #ffffff14;font:700 .74rem var(--body);text-align:center}
.tv-tdp .dz button:hover,.tv-tdp .dz button:focus-visible{background:#ffffff1c;outline:none}
.tv-tdp .dz button svg{width:30px;height:30px;fill:#7d253055;stroke:#e7cf9a;stroke-width:1.4;stroke-linejoin:round}
.tv-tdp .dz button.on{background:#7d253066;border-color:#e7cf9a88}
.tv-tdp .dz button em{position:absolute;top:-6px;right:-4px;min-width:20px;height:20px;border-radius:10px;background:#c9a24a;color:#1d1613;font:700 .72rem/20px var(--body);font-style:normal}
.tv-tdp .dz button .meno{position:absolute;top:-6px;left:-4px;width:20px;height:20px;border-radius:10px;background:#000;border:1px solid #ffffff44;font:700 .8rem/18px var(--body);color:#fff}
.tv-tdp .fx{margin:10px;padding:8px 10px;border-radius:10px;background:#0006;display:flex;align-items:center;gap:8px}
.tv-tdp .fx code{flex:1;min-width:0;font:700 1.05rem var(--body);color:#fff;background:none;overflow-wrap:anywhere}
.tv-tdp .fx code.vuota{font:italic 400 .85rem var(--body);color:var(--pan-mute)}
.tv-tdp .fx input{width:52px;height:30px;box-sizing:border-box;border-radius:8px;border:1px solid #ffffff2a;background:#0006;color:#fff;text-align:center;font:600 .85rem var(--body)}
.tv-tdp .adv{display:flex;margin:0 10px 8px;background:#0005;border-radius:9px;padding:3px;gap:3px}
.tv-tdp .adv button{all:unset;flex:1;text-align:center;cursor:pointer;padding:6px 2px;border-radius:7px;font:600 .76rem var(--body)}
.tv-tdp .adv button.on{background:linear-gradient(var(--acc2),var(--acc));color:#fff}
.tv-tdp .mot{display:flex;margin:0 10px 8px}
.tv-tdp .mot input{flex:1;min-width:0;font:inherit;font-weight:400;padding:6px 9px;border-radius:8px;border:1px solid #ffffff2a;background:#0005;color:#fff}
.tv-tdp .go{display:flex;gap:6px;margin:0 10px 10px}
.tv-tdp .go .tv-b.pri{flex:1}

/* menu del token */
.tv-pop.nuovo{z-index:12;background:var(--pan);color:var(--pan-ink);border:1px solid var(--pan-b);border-radius:14px;padding:0;width:290px;max-width:calc(100% - 12px);gap:0;overflow:hidden auto;max-height:calc(100% - 12px);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-sizing:border-box}
.tv-pop.nuovo .hd{display:flex;align-items:center;gap:10px;padding:10px 12px;background:#00000040;border-bottom:1px solid #ffffff14}
.tv-pop.nuovo .hd>i{width:44px;height:44px;border-radius:50%;background:var(--c) center/cover no-repeat;border:2px solid var(--gold2);display:flex;align-items:center;justify-content:center;font:700 .95rem var(--display);font-style:normal;color:#fff;flex:none;box-sizing:border-box}
.tv-pop.nuovo .hd .nm{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.tv-pop.nuovo .hd .nm b,.tv-pop.nuovo .tv-pnome{font:600 1.05rem/1.2 var(--display);color:var(--gold2);padding:0;margin:0}
.tv-pop.nuovo .tv-pnome{background:transparent;border:0;border-bottom:1px dashed #e7cf9a55;width:100%;min-width:0;box-sizing:border-box}
.tv-pop.nuovo .tv-pnome:focus{background:#0004;border-bottom-color:var(--gold2)}
.tv-pop.nuovo .hd small{color:var(--pan-mute);font-size:.75rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tv-pop.nuovo .hd .x{all:unset;cursor:pointer;width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;color:var(--pan-mute);flex:none}
.tv-pop.nuovo .hd .x:hover{background:#ffffff1a;color:#fff}
.tv-pop.nuovo .fine{padding:10px 12px 0}.tv-pop.nuovo .fine .tv-b{width:100%}
.tv-pop.nuovo .pfr{padding:10px 12px;display:flex;flex-direction:column;gap:7px;border-bottom:1px solid #ffffff14}
.tv-pop.nuovo .pfr .rr{display:flex;align-items:center;gap:6px}
.tv-pop.nuovo .pfr .rr span{flex:1;font:600 .9rem var(--body)}
.tv-pop.nuovo .pfr .rr span b{font:700 1.15rem var(--display);color:#fff}
.tv-pop.nuovo .pfr input{width:50px;height:34px;box-sizing:border-box;border-radius:8px;border:1px solid #ffffff2a;background:#0006;color:#fff;text-align:center;font:600 .9rem var(--body)}
.tv-pop.nuovo .bar{height:10px;border-radius:5px;background:#000a;overflow:hidden;box-shadow:inset 0 0 0 1px #ffffff1a}
.tv-pop.nuovo .bar s{display:block;height:100%;background:var(--b,#3f9a4a)}
.tv-pop.nuovo .gr{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:10px 12px}
.tv-pop.nuovo .gr button{all:unset;box-sizing:border-box;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:9px 2px 7px;border-radius:10px;background:#ffffff0f;border:1px solid #ffffff14;font:600 .7rem/1.15 var(--body);text-align:center;min-height:58px}
.tv-pop.nuovo .gr button span{font-size:1.15rem;line-height:1}
.tv-pop.nuovo .tzp{padding:10px 12px;display:flex;flex-direction:column;gap:7px;border-bottom:1px solid #ffffff14;background:#00000026}
.tv-pop.nuovo .tzp .tt{font:600 .78rem var(--body);letter-spacing:.06em;text-transform:uppercase;color:var(--gold2)}
.tv-pop.nuovo .tzp .r{display:flex;flex-wrap:wrap;gap:5px;align-items:center}
.tv-pop.nuovo .tzp .c,.tv-pop.nuovo .tzp .az,.tv-pop.nuovo .tzp .fz{all:unset;box-sizing:border-box;cursor:pointer;display:flex;align-items:center;gap:4px;padding:5px 8px;border-radius:8px;font:700 .76rem/1 var(--body);white-space:nowrap;background:#2f7d3e;color:#fff;box-shadow:inset 0 1px 0 #ffffff33}
.tv-pop.nuovo .tzp .c.no{background:#ffffff12;color:#8f867c;text-decoration:line-through;box-shadow:none}
.tv-pop.nuovo .tzp .c.off{opacity:.45;cursor:default;background:#ffffff12;color:var(--pan-mute)}
.tv-pop.nuovo .tzp .az{background:#ffffff14;border:1px solid #ffffff22;margin-left:auto;color:var(--pan-ink)}
.tv-pop.nuovo .tzp .fz{background:#7d253066;font-weight:600}
.tv-pop.nuovo .tzp .mv{font:600 .85rem var(--body)}.tv-pop.nuovo .tzp .mv small{color:var(--pan-mute)}.tv-pop.nuovo .tzp .mv.ko{color:#ff8a7d}
.tv-pop.nuovo .tzp .c:focus-visible,.tv-pop.nuovo .tzp .az:focus-visible{outline:2px solid var(--gold2)}
.tv-pop.nuovo .gr button:hover,.tv-pop.nuovo .gr button:focus-visible{background:#7d253088;border-color:#e7cf9a55;outline:none}
.tv-pop.nuovo .gr button.via{color:#ff9d93}
.tv-pop.nuovo .tv-pcond{padding:0 12px 10px;gap:5px}
.tv-pop.nuovo .tv-pcond button{background:#6b3fa055;border:1px solid #b98cff66;border-radius:12px;padding:4px 9px;font:600 .74rem var(--body);color:var(--pan-ink)}
.tv-pop.nuovo select{font:600 .8rem var(--body);padding:6px 8px;border-radius:8px;border:1px solid #ffffff2a;background:#0006;color:var(--pan-ink);min-width:0}
.tv-pop.nuovo .ini{display:flex;align-items:center;gap:6px;padding:10px 12px;border-top:1px solid #ffffff14;font:600 .85rem var(--body)}
.tv-pop.nuovo .ini span{flex:1}
.tv-pop.nuovo .ini .gia{min-width:40px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:8px;background:#c9a24a;color:#1d1613;font:700 1rem var(--display)}
.tv-pop.nuovo .ini input{width:56px;height:32px;box-sizing:border-box;border-radius:8px;border:1px solid #ffffff2a;background:#0006;color:#fff;text-align:center;font:inherit}
.tv-pop.nuovo details{border-top:1px solid #ffffff14;padding:8px 12px;font-size:.84rem;color:var(--pan-mute)}
.tv-pop.nuovo details summary{cursor:pointer;padding:2px 0}
.tv-pop.nuovo details .row{display:flex;align-items:center;gap:6px;margin-top:8px;color:var(--pan-ink)}
.tv-pop.nuovo details .row>span:first-child{flex:1}
.tv-pop.nuovo details .row .tv-b{height:30px}

/* barre del DM in basso al centro */
.tv-mbar{top:auto;bottom:14px;left:50%;transform:translateX(-50%);max-width:min(880px,calc(100% - 24px));width:max-content;justify-content:center;box-sizing:border-box}
.tv-mbar[data-t]:not([data-t=""])::before{content:attr(data-t);flex-basis:100%;text-align:center;font:600 .66rem/1 var(--display);letter-spacing:.12em;text-transform:uppercase;color:var(--gold2);margin:2px 0}
.tv-wrap.con-hud .tv-mbar{bottom:var(--tv-hudh,92px)}

/* schede: pulsanti uguali dappertutto */
.tv-sch .tbar{padding:8px 10px;gap:10px}
.tv-sch .seg3{border-radius:10px;padding:3px}
.tv-sch .seg3::before{content:"🎲 Tiri:";font:600 .72rem/26px var(--body);color:#bda983;padding:0 6px}
.tv-sch .seg3 button{padding:5px 11px;border-radius:8px;font-size:.78rem}
.tv-sch .seg3 button.on{background:linear-gradient(var(--acc2),var(--acc));box-shadow:inset 0 1px 0 #ffffff33}
.tv-sch .tbar .sg{background:#ffffff12;border-radius:9px;padding:5px 10px;border:1px solid #ffffff1c;color:inherit;font:600 .8rem var(--body);white-space:nowrap}
.tv-sch .tbar .sg.on{background:#6b3fa0;border-color:#a77bd6;color:#fff;box-shadow:0 0 0 2px #6b3fa055}
.tv-sch .tbar .tema,.tv-sch .tbar .zt button{border-radius:8px;padding:5px 9px;background:#ffffff12;border:1px solid #ffffff1c}
.tv-sch .tbar .x{width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:9px;background:#ffffff14;padding:0;box-sizing:border-box}
.tv-sch .tbar .piu{all:unset;display:none;cursor:pointer;width:32px;height:32px;border-radius:9px;background:#ffffff14;align-items:center;justify-content:center;font-size:1.1rem}
.tv-sch .tabs{border-bottom:0;background:var(--gr);border-radius:12px;padding:4px;gap:4px}
.tv-sch .tabs button{border:0;border-radius:9px;margin:0;padding:8px 14px;flex:1;text-align:center}
.tv-sch .tabs button.on{background:var(--box);box-shadow:0 1px 3px #0003;color:#7d2530}
.tv-scuro .tv-sch .tabs button.on{color:#e8a0a6}
.tv-sch .mini,.tv-sch .q button{height:30px;padding:0 11px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;gap:5px;font-size:.78rem;box-shadow:0 1px 0 #0000000d}
.tv-sch .mini:hover,.tv-sch .q button:hover{background:var(--box);color:#7d2530;border-color:#7d2530}
.tv-sch .q{gap:6px}
.tv-sch .q button[data-k=pfm],.tv-sch .q button[data-k=pfm]:hover{background:#a3262f;color:#fff;border-color:#a3262f;height:34px;padding:0 14px}
.tv-sch .q button[data-k=pfp],.tv-sch .q button[data-k=pfp]:hover{background:#2f7d3e;color:#fff;border-color:#2f7d3e;height:34px;padding:0 14px}
.tv-sch .q input{height:34px;border:1px solid var(--lin);border-radius:8px}
.tv-sch .mini.agg{width:100%;border-style:dashed;background:transparent;height:34px}
.tv-sch .tzb{border-radius:10px;padding:7px 10px;font-weight:700}
.tv-sch .fine{border-radius:10px;min-height:38px;background:linear-gradient(var(--acc2),var(--acc));box-shadow:inset 0 1px 0 #ffffff33,0 2px 5px #0004}
.tv-sch .at{border-radius:10px}
.tv-sch .at .riga.az{display:flex;flex-wrap:wrap;gap:5px;align-items:center}
.tv-sch .at .riga.az .tp{flex:1 1 100%}
.tv-sch .at .riga .mini{height:28px;padding:0 8px}
.tv-sch .at .riga .mini[data-roll^="att"]{background:#7d2530;color:#fff;border-color:#7d2530}
.tv-sch .at .riga .mini[data-roll^="dan"]{background:#fbeee6;color:#8a3b12;border-color:#e2b99f}
.tv-scuro .tv-sch .at .riga .mini[data-roll^="dan"]{background:#3a2a20;color:#f0b48f;border-color:#6b4a35}
.tv-sch .at .riga .mini.via{border:0;background:transparent;box-shadow:none;color:var(--k2);width:28px;padding:0;margin-left:auto}
.tv-sch .at .riga .mini.via:hover{color:#a3262f}
.tv-sch .at .riga .mini.cfg{border:0;background:transparent;box-shadow:none;color:var(--k2);width:28px;padding:0;margin-left:auto}
.tv-sch .at .riga .mini.cfg+.mini.via{margin-left:0}
.tv-sch .at .riga .mini.cfg:hover,.tv-sch .at .riga .mini.cfg.on{color:#7d2530;background:var(--box)}
.tv-sch .at input.calcolato{color:#7d2530;font-weight:700;cursor:default}
.tv-scuro .tv-sch .at input.calcolato{color:#f0a8a0}
.tv-sch .at .bon{font-size:.74rem;font-weight:700;color:#b4541c;background:#b4541c1a;border-radius:999px;padding:2px 8px;white-space:nowrap}
.tv-scuro .tv-sch .at .bon{color:#f0b48f}
.tv-sch .atcfg{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:6px 10px;padding:8px 4px 4px;margin-top:4px;border-top:1px dashed var(--ul)}
.tv-sch .atcfg label{display:flex;flex-direction:column;gap:2px;font-size:.72rem;color:var(--k2)}
.tv-sch .atcfg label.ck{flex-direction:row;align-items:center;gap:6px;grid-column:1/-1;font-size:.78rem;color:var(--k)}
.tv-sch .atcfg label.lg{grid-column:1/-1}
.tv-sch .at .arma{display:flex;flex-wrap:wrap;gap:4px;margin:3px 0 1px;font-size:.72rem;color:var(--k2)}
.tv-sch .at .arma span{background:var(--box);border-radius:999px;padding:1px 7px}
.tv-sch .at .arma b{color:var(--k)}
.tv-sch .at .arma .avv{background:#a3262f1f;color:#a3262f;font-weight:700}
.tv-scuro .tv-sch .at .arma .avv{color:#ff9a8f}
.tv-sch .scudo{position:relative}
.tv-sch .scudo .cacfgb{position:absolute;top:-6px;right:-6px;padding:1px 5px;font-size:.78rem;line-height:1.2}
.tv-sch .tre input.calcolato{color:#7d2530;cursor:default}
.tv-scuro .tv-sch .tre input.calcolato{color:#f0a8a0}
.tv-sch .cacfg{border:1px dashed var(--ul);border-radius:8px;background:var(--box);padding:8px}
.tv-sch .cacfg .avvca{grid-column:1/-1;margin:0;font-size:.76rem;font-weight:700;color:#a3262f;line-height:1.35}
.tv-scuro .tv-sch .cacfg .avvca{color:#ff9a8f}
.tv-sch .at .atdesc{margin:3px 0 1px;padding:4px 8px;border-left:3px solid #7d2530;background:var(--box);border-radius:0 6px 6px 0;font-size:.8rem;line-height:1.4;white-space:pre-wrap;overflow-wrap:anywhere;color:var(--k)}
.tv-sch .atcfg textarea.auto{background:var(--box);border-radius:4px;padding:4px 6px;font-size:.82rem}
.tv-sch .atcfg .conto{grid-column:1/-1;margin:0;font-size:.8rem;color:var(--k);line-height:1.35}

/* telefono: strumenti in basso, mappa a tutta larghezza */
@media (max-width:820px){
  .tv{flex-direction:column-reverse}
  .tv-rail{width:100%;height:62px;flex-direction:row;overflow-x:auto;overflow-y:hidden;padding:5px 6px;border-right:0;border-top:1px solid #e7cf9a33;gap:2px;box-sizing:border-box;flex:none}
  .tv-rail button{width:52px;height:50px}
  .tv-rail button.tel{display:flex}
  .tv-rail button.on::before{left:14px;right:14px;top:auto;bottom:-5px;width:auto;height:3px}
  .tv-rail hr{width:1px;height:34px;border:0;border-left:1px solid #e7cf9a33;margin:0 4px;flex:none}
  .tv-rail .lbl,.tv-rail .sp,.tv-rail .tv-cnt{display:none}
  .tv-rail .tv-on{margin:0 8px;align-self:center}
  .tv-ctab{display:none}
  .tv-wrap{min-height:0}
  .tv-strip{left:8px;right:8px;top:8px;max-width:none;padding:5px 6px 5px 8px;gap:6px}
  .tv-strip .rd{padding-right:6px}
  .tv-strip .ls{gap:4px;flex:1}
  .tv-strip .p{width:38px}.tv-strip .p i{width:32px;height:32px}
  .tv-strip .p.on{width:50px}.tv-strip .p.on i{width:42px;height:42px}
  .tv-strip .p b{display:none}.tv-strip .p.on b{display:block}
  .tv-strip .ac{padding-left:6px}
  .tv-strip.vert{right:auto;width:min(262px,calc(100% - 16px))}
  .tv-strip.col{right:auto;width:64px}
  .tv-strip .ac .tv-b.pri{padding:0 9px;font-size:.74rem}
  .tv-wrap.con-turno .tv-top{top:84px}
  .tv-wrap.con-turno .tv-zoom{top:132px}
  .tv-wrap.con-turno .tv-tdp,.tv-wrap.con-turno .tv-sp{top:84px}
  .tv-hud{left:6px;right:6px;transform:none;bottom:6px;gap:6px;padding:5px 6px;border-radius:12px;max-width:none}
  .tv-hud .fo,.tv-hud .t>b,.tv-hud .fzr,.tv-hud .lg{display:none}
  .tv-hud .sh{display:inline}
  .tv-hud .t{flex:none}
  .tv-hud .r{gap:3px}
  .tv-hud .c{width:32px;height:32px;padding:0;justify-content:center;font-size:.95rem;border-radius:8px}
  .tv-hud .mv{flex:1 1 auto;min-width:52px;gap:4px;font-size:.72rem}
  .tv-hud .mv b{font-size:.9rem}
  .tv-hud .bar{height:5px}
  .tv-hud .ac{gap:4px}
  .tv-hud .ac .tv-b{height:32px;font-size:.74rem;padding:0 8px}
  .tv-zoom{padding:3px;border-radius:12px;right:8px}
  .tv-zoom .tv-zs,.tv-zoom .sep,.tv-zoom [data-z="1.25"],.tv-zoom [data-z="0.8"]{display:none}
  .tv-zoom button{width:30px;height:30px}
  .tv-chip .qui{font-size:0;gap:0}
  .tv-chip{padding:4px 8px 4px 10px;font-size:.8rem}
  .tv-pgbtn{width:36px;height:36px;padding:0}
  .tv-pgbtn span{display:none}
  .tv-hud .mv b{font-family:var(--body)}
  .tv-pop.nuovo{left:6px!important;right:6px;top:auto!important;bottom:6px;width:auto;max-width:none;max-height:58%}
  .tv-pop.nuovo .hd{padding:7px 10px;gap:8px}
  .tv-pop.nuovo .hd>i{width:34px;height:34px}
  .tv-pop.nuovo .hd .nm b,.tv-pop.nuovo .tv-pnome{font-size:.95rem}
  .tv-pop.nuovo .pfr{padding:7px 10px;gap:5px}
  .tv-pop.nuovo .pfr input{height:30px}
  .tv-pop.nuovo .pfr .tv-b{height:30px}
  .tv-pop.nuovo .gr{grid-template-columns:repeat(4,1fr);padding:7px 10px;gap:5px}
  .tv-pop.nuovo .gr button{padding:6px 2px 5px;gap:2px}
  .tv-pop.nuovo .tv-pcond{padding:0 10px 7px}
  .tv-pop.nuovo .ini{padding:6px 10px}
  .tv-pop.nuovo .ini input,.tv-pop.nuovo .ini .tv-b{height:30px}
  .tv-pop.nuovo details{padding:6px 10px}
  .tv-pop.nuovo .fine{padding:7px 10px 0}
  body:has(.tv) .toast{font-size:.85rem;line-height:1.3;max-width:min(92vw,460px);padding:7px 12px}
  .tv-wrap.con-hud .tv-mbar{bottom:var(--tv-hudh,150px)}
  .tv-mbar{bottom:8px}
  .tv-sch .tbar .zt,.tv-sch .tbar .tema{display:none}
  .tv-sch .tbar.aperta .zt,.tv-sch .tbar.aperta .tema{display:flex}
  .tv-sch .tbar .piu{display:flex}
  .tv-sch .tbar .x{margin-left:0}
}
/* personaggi guidati: creazione e level up */
.tv-sp .r .lvup{flex:none;color:#e7cf9a;font-weight:700;padding:0 3px}
.tv-sch .gbar{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:6px 12px;background:#f3e8cc;border-bottom:1px solid #dccaa0}
.tv-sch .gbar button{font:600 .82rem/1.2 var(--body);border-radius:16px;padding:4px 12px;cursor:pointer;border:1px solid #c4ae80;background:#fffdf7;color:#2b1d14}
.tv-sch .gbar button:hover{border-color:#7d2530}
.tv-sch .gbar .su{background:#7d2530;color:#fff;border-color:#561820;box-shadow:0 1px 6px #7d253055}
.tv-sch .gbar .gmsg{font-weight:700;color:#7d2530}
.tv-sch .gbar .gnote{font-size:.8rem;color:#75614d;font-style:italic}
.tv-scuro .tv-sch .gbar{background:#2a221c;border-color:#5a4d3e}
.tv-scuro .tv-sch .gbar button{background:#1d1814;color:#efe5d0;border-color:#5a4d3e}
.tv-scuro .tv-sch .gbar .su{background:#7d2530;color:#fff;border-color:#a7343b}
.tv-scuro .tv-sch .gbar .gmsg{color:#e7a0a6}.tv-scuro .tv-sch .gbar .gnote{color:#b9a88c}
dialog.dlg.tv-storia{width:min(460px,calc(100vw - 24px))}
.tv-storia-l{display:flex;flex-direction:column;gap:6px;max-height:55vh;overflow-y:auto;margin:6px 0 10px}
.tv-storia-l details{border:1px solid var(--line2,#c4ae80);border-radius:8px;padding:6px 10px}
.tv-storia-l summary{cursor:pointer}.tv-storia-l small{opacity:.7}
.tv-storia-l ul{margin:6px 0 2px 18px;font-size:.9rem}
dialog.dlg.tv-guida{position:fixed;inset:0;margin:auto;width:min(1120px,calc(100vw - 20px));height:min(820px,calc(100vh - 20px));max-width:none;max-height:none;padding:0;border:1px solid #2b2620;border-radius:12px;overflow:hidden;background:#fbf5e3;color:#2b1d14;box-shadow:0 18px 60px #000c;z-index:70;font:16px/1.3 var(--body)}
dialog.dlg.tv-guida[open]{display:flex}
.tv-guida .gw{display:flex;flex-direction:column;width:100%;min-height:0;min-width:0}
.tv-guida .gh{display:flex;align-items:center;gap:12px;padding:9px 14px;background:#33241b;color:#f1e3c5;flex:none}
.tv-guida .gh b{font:600 .9rem var(--display);letter-spacing:.1em;text-transform:uppercase}
.tv-guida .gh .who{font-style:italic;color:#d9c39a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tv-guida .gh .sp{flex:1}
.tv-guida .gh .x{all:unset;cursor:pointer;width:32px;height:32px;display:grid;place-items:center;border-radius:6px;color:#f1e3c5;flex:none}
.tv-guida .gh .x:hover{background:#ffffff1a}
.tv-guida .gs{display:flex;gap:4px;padding:7px 12px;background:#f6ecd2;border-bottom:1px solid #dccaa0;overflow-x:auto;scrollbar-width:thin;flex:none}
.tv-guida .gs button{all:unset;cursor:pointer;display:flex;align-items:center;gap:6px;padding:4px 11px 4px 5px;border-radius:20px;font:600 .72rem var(--display);letter-spacing:.05em;color:#75614d;border:1px solid transparent;white-space:nowrap}
.tv-guida .gs i{font-style:normal;width:21px;height:21px;border-radius:50%;display:grid;place-items:center;background:#dccaa0;color:#5a4636;font:600 .75rem var(--body);flex:none}
.tv-guida .gs .ok{color:#3f6b46}.tv-guida .gs .ok i{background:#3f6b46;color:#fff}
.tv-guida .gs .on{color:#7d2530;border-color:#7d2530;background:#fffb}.tv-guida .gs .on i{background:#7d2530;color:#fff}
.tv-guida .gs button:disabled{opacity:.45;cursor:default}
.tv-guida .gb{flex:1;display:grid;grid-template-columns:minmax(0,1fr) 300px;min-height:0}
.tv-guida .gm{padding:14px 18px 28px;overflow-y:auto;min-height:0;min-width:0}
.tv-guida .ga{border-left:1px solid #dccaa0;background:#f3e8cc;padding:14px;overflow-y:auto;min-height:0}
.tv-guida .gf{display:flex;align-items:center;gap:10px;padding:9px 14px;border-top:1px solid #dccaa0;background:#f6ecd2;flex:none}
.tv-guida .gf .gmsg{flex:1;text-align:center;color:#a3262f;font-style:italic;font-size:.9rem;min-width:0}
.tv-guida .gbtn{border:1px solid #c4ae80;border-radius:7px;padding:7px 16px;background:#fffdf7;font:600 .95rem var(--body);color:#2b1d14;cursor:pointer;white-space:nowrap}
.tv-guida .gbtn.p{background:#7d2530;color:#fff;border-color:#561820}
.tv-guida .gbtn:disabled{opacity:.45;cursor:default}
.tv-guida h4{font:600 1.05rem var(--display);letter-spacing:.05em;color:#7d2530;margin:16px 0 6px}
.tv-guida .gm>h4:first-child,.tv-guida .gm>.box:first-child+h4{margin-top:0}
.tv-guida h5{font:600 .7rem var(--display);letter-spacing:.1em;text-transform:uppercase;color:#5a4636;margin:14px 0 6px}
.tv-guida h5 small{font:italic 400 .85rem var(--body);letter-spacing:0;text-transform:none;color:#75614d}
.tv-guida .ga h5:first-child{margin-top:0}
.tv-guida p{margin:4px 0}
.tv-guida .hint{color:#75614d;font-style:italic;font-size:.92rem;margin:4px 0}
.tv-guida .gcards{display:grid;grid-template-columns:repeat(auto-fill,minmax(205px,1fr));gap:7px}
.tv-guida .gc{all:unset;box-sizing:border-box;cursor:pointer;border:1px solid #dccaa0;border-radius:9px;background:#fffc;padding:8px 10px;position:relative;min-width:0;display:block}
.tv-guida .gc:hover{border-color:#a98334}
.tv-guida .gc b{display:block;font:600 .9rem var(--display);letter-spacing:.02em;padding-right:52px}
.tv-guida .gc small{display:block;color:#5a4636;font-size:.86rem;line-height:1.25;margin-top:3px}
.tv-guida .gc .src{position:absolute;right:8px;top:7px;font:600 .6rem var(--display);color:#75614d;letter-spacing:.04em}
.tv-guida .gc.on{border:2px solid #7d2530;background:#fff;padding:7px 9px;box-shadow:0 2px 10px #7d253022}
.tv-guida .gc.no,.tv-guida .gc:disabled{opacity:.5;cursor:default}
.tv-guida .gc .no{color:#a3262f;font-style:italic}
.tv-guida .chips{display:flex;flex-wrap:wrap;gap:5px}
.tv-guida .chip{all:unset;cursor:pointer;border:1px solid #c4ae80;border-radius:20px;padding:3px 11px;font-size:.92rem;background:#fffc}
.tv-guida .chip.on{background:#7d2530;border-color:#7d2530;color:#fff}
.tv-guida .chip:disabled{opacity:.4;cursor:default}
.tv-guida .seg{display:inline-flex;border:1px solid #c4ae80;border-radius:8px;overflow:hidden;flex-wrap:wrap;background:#fffc;margin:2px 0 6px}
.tv-guida .seg button{all:unset;cursor:pointer;padding:6px 13px;font-weight:600;border-right:1px solid #c4ae80}
.tv-guida .seg button:last-child{border-right:0}
.tv-guida .seg button.on{background:#7d2530;color:#fff}
.tv-guida .box{border:1px solid #dccaa0;border-radius:9px;background:#fffc;padding:10px 12px;margin:10px 0}
.tv-guida .box.ko{border-color:#a3262f;color:#a3262f}
.tv-guida .box h5:first-child{margin-top:0}
.tv-guida .gsez{margin-bottom:6px}
.tv-guida .ab6{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:5px}
.tv-guida .ab{border:1px solid #c4ae80;border-radius:8px;background:#fff;text-align:center;padding:4px 2px 5px;min-width:0}
.tv-guida .ab small{display:block;font:600 .6rem var(--display);letter-spacing:.05em;color:#5a4636}
.tv-guida .ab b{display:block;font:600 1.2rem var(--display)}
.tv-guida .ab span{display:block;font-size:.78rem;color:#75614d}
.tv-guida .ab select,.tv-guida .ab input{margin-top:3px;max-width:100%}
.tv-guida .ab.up{border-color:#3f6b46;background:#eef5ea}.tv-guida .ab.up b{color:#3f6b46}
.tv-guida .ab6.pic b{font-size:1rem}
.tv-guida .pm{display:flex;align-items:center;justify-content:center;gap:5px;margin-top:3px}
.tv-guida .pm button{all:unset;cursor:pointer;width:24px;height:24px;border:1px solid #c4ae80;border-radius:5px;background:#fff;text-align:center;font-weight:700;line-height:24px}
.tv-guida .pm button:disabled{opacity:.35;cursor:default}
.tv-guida .kv{display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:.92rem;margin:10px 0}
.tv-guida .kv dt{color:#75614d}.tv-guida .kv dd{margin:0}
.tv-guida .nov{list-style:none;padding:0;margin:6px 0;display:flex;flex-direction:column;gap:4px;font-size:.9rem}
.tv-guida .nov li{padding-left:14px;position:relative}
.tv-guida .nov li:before{content:'◆';position:absolute;left:0;top:2px;font-size:.6rem;color:#a98334}
.tv-guida .pv{display:flex;gap:10px;align-items:center;margin-bottom:10px}
.tv-guida .pv i{width:48px;height:48px;border-radius:50%;background:#7a5a40 center/cover;border:2px solid #d4b06a;display:grid;place-items:center;color:#fff;font:600 1.1rem var(--display);font-style:normal;flex:none}
.tv-guida .pv b{font:600 1rem var(--display);display:block}
.tv-guida .pv small{color:#5a4636}
.tv-guida .spls{border:1px solid #e6d7b4;border-radius:8px;background:#fffc;max-height:420px;overflow-y:auto}
.tv-guida .spl{all:unset;box-sizing:border-box;display:grid;grid-template-columns:20px minmax(0,1fr) auto;gap:1px 9px;width:100%;padding:6px 9px;border-bottom:1px solid #eee2c6;cursor:pointer}
.tv-guida .spl:last-child{border-bottom:0}
.tv-guida .spl:hover{background:#fff}
.tv-guida .spl .ck{width:16px;height:16px;border:1.5px solid #c4ae80;border-radius:4px;background:#fff;margin-top:2px;display:grid;place-items:center;color:#fff;font-size:.7rem}
.tv-guida .spl.on{background:#fff}.tv-guida .spl.on .ck{background:#7d2530;border-color:#7d2530}
.tv-guida .spl small{grid-column:2/4;color:#75614d;font-size:.84rem;line-height:1.2}
.tv-guida .spl em{font-style:normal;font:600 .64rem var(--display);color:#75614d;white-space:nowrap}
.tv-guida .spl:disabled{opacity:.45;cursor:default}
.tv-guida .cnt{display:inline-block;font:600 .68rem var(--display);padding:2px 8px;border-radius:12px;background:#dccaa0;margin-left:8px;vertical-align:1px;letter-spacing:.04em}
.tv-guida .cnt.ok{background:#3f6b46;color:#fff}
.tv-guida input[type=search],.tv-guida input[type=text],.tv-guida input[type=number],.tv-guida select,.tv-guida textarea{font:inherit;font-size:.95rem;color:#2b1d14;background:#fff;border:1px solid #c4ae80;border-radius:6px;padding:5px 8px;box-sizing:border-box;max-width:100%}
.tv-guida input[type=checkbox]{accent-color:#7d2530;width:16px;height:16px;margin:2px 0 0;flex:none}
.tv-guida .gck{display:flex;gap:8px;align-items:flex-start;margin:8px 0;cursor:pointer}
.tv-guida textarea{width:100%;resize:vertical}
.tv-guida input[type=search]{width:100%;margin-bottom:6px}
.tv-guida table.dif{border-collapse:collapse;width:100%;font-size:.95rem}
.tv-guida table.dif td,.tv-guida table.dif th{padding:5px 7px;border-bottom:1px solid #e6d7b4;text-align:left}
.tv-guida table.dif th{font:600 .66rem var(--display);letter-spacing:.08em;color:#5a4636}
.tv-guida table.dif td:nth-child(2){color:#75614d}.tv-guida table.dif td:last-child{color:#3f6b46;font-weight:600}
.tv-guida .riga{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:7px 0}
.tv-guida .riga select{width:auto;min-width:0;flex:0 1 auto}
.tv-guida details.box summary{cursor:pointer;font:600 .9rem var(--display);color:#5a4636}
.tv-guida details.box[open] summary{margin-bottom:6px}
.tv-guida .lvl{display:flex;flex-wrap:wrap;gap:4px;margin:4px 0 6px}
.tv-guida .lvl button{all:unset;cursor:pointer;font:600 .68rem var(--display);padding:3px 8px;border-radius:4px;background:#dccaa0;color:#5a4636}
.tv-guida .lvl button.on{background:#7d2530;color:#fff}
.tv-guida .dado{font:600 1.5rem var(--display);color:#7d2530;min-width:30px;text-align:center}
/* procedura guidata, stile "carte da gioco" */
dialog.dlg.tv-guida{background:#efe4c9;border:0;border-radius:16px}
.tv-guida .gh{background:#7d2530;color:#fff;padding:12px 18px}
.tv-guida .gh b{color:#fff}.tv-guida .gh .who{color:#f3d3d6}
.tv-guida .gs{background:#7d2530;border:0;padding:0 18px 12px;gap:0}
.tv-guida .gs button{flex-direction:column;gap:4px;padding:0 4px;min-width:84px;color:#f3d3d6;font-size:.62rem;border:0;border-radius:0;position:relative;z-index:0}
.tv-guida .gs button:after{content:'';position:absolute;top:11px;left:calc(50% + 14px);width:calc(100% - 28px);height:2px;background:#ffffff44;z-index:-1}
.tv-guida .gs button:last-child:after{display:none}
.tv-guida .gs i{width:24px;height:24px;background:#5a1820;color:#f3d3d6;border:2px solid #f3d3d677;box-sizing:border-box}
.tv-guida .gs .ok{color:#fff}.tv-guida .gs .ok i{background:#fff;color:#7d2530;border-color:#fff}
.tv-guida .gs .on{background:none;color:#fff;border:0}.tv-guida .gs .on i{background:#e2c27a;color:#5a1820;border-color:#fff;box-shadow:0 0 0 4px #ffffff33}
.tv-guida .gs button:disabled{opacity:.6}
.tv-guida .gm{padding:18px 22px 30px}
.tv-guida h4{font-size:1.3rem;color:#2b1d14}
.tv-guida .gc{background:#fffaf0;border:0;border-radius:12px;box-shadow:0 2px 0 #d7c191,0 4px 10px #6b4a2a1a;padding:10px 12px;transition:transform .15s,box-shadow .15s}
.tv-guida .gc:hover{border:0;box-shadow:0 2px 0 #c4ae80,0 8px 16px #6b4a2a2a}
.tv-guida .gc.on{border:0;background:#fff;padding:10px 12px;box-shadow:0 0 0 2px #7d2530,0 6px 16px #7d253033}
.tv-guida .gc[data-g=sotto]{border-top:5px solid var(--c,#a98334);padding-top:9px}
.tv-guida .gc[data-g=sotto].on{border-top:5px solid var(--c,#a98334)}
.tv-guida .gcards:has(.carta){grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
.tv-guida .gc.carta{padding:0 10px 12px;text-align:center;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-start}
.tv-guida .gc.carta .gi{display:grid;place-items:center;height:78px;margin:0 -10px 10px;color:#fff;background:linear-gradient(160deg,color-mix(in srgb,var(--c) 70%,#fff),var(--c) 60%,color-mix(in srgb,var(--c) 70%,#000));position:relative}
.tv-guida .gc.carta .gi:after{content:'';position:absolute;inset:auto 0 -1px;height:14px;background:#fffaf0;border-radius:50% 50% 0 0/100% 100% 0 0}
.tv-guida .gc.carta.on .gi:after{background:#fff}
.tv-guida .gc.carta .gi svg{width:40px;height:40px;filter:drop-shadow(0 2px 2px #0004)}
.tv-guida .gc.carta b{padding:0;font-size:1rem}
.tv-guida .gc.carta .src{top:7px;right:7px;background:#0005;color:#fff;border-radius:10px;padding:2px 6px;font-size:.58rem}
.tv-guida .gc.carta small{font-size:.8rem}
.tv-guida .gc.carta:hover{transform:translateY(-3px)}
.tv-guida .gc.carta.on{padding:0 10px 12px;transform:translateY(-4px);box-shadow:0 0 0 3px #e2c27a,0 0 0 5px #7d2530,0 12px 24px #7d253044}
.tv-guida .gc.carta.on:before{content:'✓';position:absolute;top:6px;left:7px;width:22px;height:22px;border-radius:50%;background:#fff;color:#7d2530;font-weight:700;display:grid;place-items:center;z-index:2;font-size:.8rem}
.tv-guida .gc.carta.no,.tv-guida .gc.carta:disabled{transform:none;filter:grayscale(.7)}
.tv-guida .chip{background:#fffaf0;border-color:#d7c191;padding:5px 13px}
.tv-guida .chip.on{background:#7d2530;border-color:#7d2530}
.tv-guida .seg{background:#fffaf0;border-color:#d7c191;border-radius:10px}
.tv-guida .box{background:#fffaf0;border:0;border-radius:12px;box-shadow:0 2px 0 #d7c191}
.tv-guida .box.ko{box-shadow:0 0 0 1px #a3262f}
.tv-guida .spls{border:0;border-radius:12px;box-shadow:0 2px 0 #d7c191;background:#fffaf0}
.tv-guida .ab{border:0;border-radius:10px;box-shadow:0 2px 0 #d7c191;background:#fffaf0}
.tv-guida .ab.up{box-shadow:0 0 0 2px #3f6b46}
.tv-guida .ga{background:#e6d7b4;border:0;padding:16px}
.tv-guida .ga .pv{background:linear-gradient(160deg,color-mix(in srgb,var(--c,#7a5a40) 75%,#fff),var(--c,#7a5a40));color:#fff;border-radius:12px 12px 0 0;margin:0;padding:14px;flex-direction:column;text-align:center}
.tv-guida .ga .pv i{width:64px;height:64px;border:3px solid #fff;background-color:#0002}
.tv-guida .ga .pv small{color:#ffffffd9}
.tv-guida .ga .ab6,.tv-guida .ga .kv,.tv-guida .ga .nov,.tv-guida .ga .pv+.ab6~h5{background:#fffaf0;margin:0;padding:10px}
.tv-guida .ga .ab6{padding-top:12px}
.tv-guida .ga .ab6 .ab{box-shadow:0 0 0 1px #e6d7b4}
.tv-guida .ga .pv+.ab6~h5{padding:4px 10px 0}
.tv-guida .ga .nov{margin-top:0}
.tv-guida .ga>:last-child{border-radius:0 0 12px 12px;padding-bottom:14px}
.tv-guida .gf{background:#efe4c9;border-top:1px solid #d7c191}
.tv-guida .gbtn{border-radius:30px;padding:9px 20px}
.tv-guida .gbtn.p{box-shadow:0 3px 0 #4a121a}
/* livello concesso: la colonna di luce */
.tv-festa{position:fixed;inset:0;z-index:90;display:grid;place-items:center;overflow:hidden;font:17px/1.35 var(--body);color:#ecdfc6}
.tv-festa .fvel{position:absolute;inset:0;background:radial-gradient(ellipse at center,#000000b3,#000000e6);animation:tvfFade .5s ease-out both}
.tv-festa .fraggi{position:absolute;left:50%;top:44%;width:900px;height:900px;translate:-50% -50%;background:repeating-conic-gradient(from 0deg,#ffe9a833 0 6deg,transparent 6deg 18deg);-webkit-mask:radial-gradient(circle,#000 10%,transparent 60%);mask:radial-gradient(circle,#000 10%,transparent 60%);animation:tvfGira 12s linear infinite,tvfFade 1s .2s both;pointer-events:none}
.tv-festa .fluce{position:absolute;left:50%;top:-10%;width:260px;height:120%;translate:-50% 0;background:linear-gradient(90deg,transparent,#ffe9a855,#fff7d8aa,#ffe9a855,transparent);filter:blur(6px);animation:tvfScende .9s ease-out both;opacity:.55;pointer-events:none}
.tv-festa .fsc{position:absolute;inset:0;pointer-events:none}
.tv-festa .fsc i{position:absolute;top:100%;font-style:normal;color:#ffe08a;text-shadow:0 0 8px #ffcf5a;animation:tvfSale 2.4s linear infinite}
.tv-festa .fbox{position:relative;text-align:center;width:min(640px,92vw);margin-top:-6vh}
.tv-festa .flv{font:700 1.1rem var(--display);letter-spacing:.4em;text-transform:uppercase;color:#f3d98a;animation:tvfFade .5s 1.2s both}
.tv-festa .fnum{font:900 9rem/1 var(--display);color:#ffe9a8;text-shadow:0 0 30px #ffcf5a,0 0 60px #c9a24b,0 4px 0 #7d2530;animation:tvfZoom .7s cubic-bezier(.2,1.6,.4,1) .7s both}
.tv-festa h2{font:700 1.7rem/1.2 var(--display);color:#fff4d6;margin:10px 0 4px;text-shadow:0 2px 8px #000;animation:tvfFade .5s 1.4s both}
.tv-festa p{margin:0;color:#ecdfc6;text-shadow:0 1px 4px #000;animation:tvfFade .5s 1.6s both}
.tv-festa .fbt{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:18px;animation:tvfFade .5s 1.9s both}
.tv-festa .fbt button{font:600 .85rem var(--display);letter-spacing:.06em;text-transform:uppercase;padding:10px 18px;border-radius:999px;cursor:pointer;white-space:nowrap}
.tv-festa .fbt .si{border:1px solid #e0c071;background:linear-gradient(180deg,#c4494f,#8c2c38);color:#fbeccb;box-shadow:0 3px 0 #4a121a}
.tv-festa .fbt .no{border:1px solid #ffffff40;background:#00000055;color:#ecdfc6}
.tv-festa.calma *{animation:none!important}
@keyframes tvfFade{from{opacity:0}}
@keyframes tvfGira{to{rotate:360deg}}
@keyframes tvfScende{0%{transform:scaleY(0);transform-origin:top;opacity:0}60%{opacity:1}100%{transform:scaleY(1);opacity:.55}}
@keyframes tvfZoom{0%{transform:scale(3);opacity:0;filter:blur(8px)}100%{transform:scale(1);opacity:1;filter:none}}
@keyframes tvfSale{0%{transform:translateY(0);opacity:0}15%{opacity:1}100%{transform:translateY(-110vh);opacity:0}}
@media (max-width:620px){.tv-festa .fnum{font-size:7rem}.tv-festa h2{font-size:1.35rem}.tv-festa .fbt button{font-size:.72rem;padding:9px 13px}}
.tv-guida .ga.arca{padding:12px}
.tv-guida .arch{background:#fffaf0;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px #4a2a1222}
.tv-guida .arch .ah{display:flex;align-items:center;gap:10px;padding:12px;color:#fff;background:linear-gradient(160deg,color-mix(in srgb,var(--c,#7a5a40) 70%,#fff),var(--c,#7a5a40) 60%,color-mix(in srgb,var(--c,#7a5a40) 70%,#000))}
.tv-guida .arch .ah .gi{flex:none;width:44px;height:44px;border-radius:50%;border:2px solid #fff;display:grid;place-items:center;background:#0002}
.tv-guida .arch .ah svg{width:24px;height:24px;filter:drop-shadow(0 1px 1px #0004)}
.tv-guida .arch .ah b{display:block;font:700 1.05rem/1.2 var(--display)}
.tv-guida .arch .ah span{font-size:.75rem;opacity:.9}
.tv-guida .arch .ad{margin:0;padding:10px 12px;font-style:italic;font-size:.88rem;color:#4a3626;border-bottom:1px solid #e6d7b4}
.tv-guida .arch ol{list-style:none;margin:0;padding:8px 12px 12px}
.tv-guida .arch li{display:flex;gap:10px;padding:6px 0;position:relative}
.tv-guida .arch li>i{flex:none;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;font:700 .8rem var(--body);background:#efe3c6;color:#5a4330;border:2px solid #d8c398;position:relative;z-index:1}
.tv-guida .arch li:not(:last-child):before{content:'';position:absolute;left:17px;top:40px;bottom:-6px;width:2px;background:#e0cfa6}
.tv-guida .arch li.ora>i{background:var(--c,#7d2530);color:#fff;border-color:#e2c27a}
.tv-guida .arch li em{display:block;font-style:normal;font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#7d2530;margin:2px 0}
.tv-guida .arch li p{margin:0 0 5px;font-size:.84rem;line-height:1.38;color:#3b2a1e}
.tv-guida .arch li p b{color:#2b1d14}
.tv-guida .arch.vuoto{padding:16px;text-align:center;color:#5a4330}
.tv-guida .arch.vuoto b{font:700 1.05rem var(--display)}
.tv-guida .arch.vuoto p{font-size:.88rem;margin:6px 0 0}
.tv-guida .arch-in{grid-column:1/-1}
.tv-guida .arch-in.tel{display:none}
@media (max-width:820px){.tv-guida .arch-in.tel{display:block}.tv-guida .ga.arca{display:none}}
@media (max-width:820px){
  dialog.dlg.tv-guida{width:100vw;height:100dvh;border-radius:0;border:0;inset:0}
  .tv-guida .gb{grid-template-columns:minmax(0,1fr);overflow-y:auto;display:block}
  .tv-guida .gm{overflow:visible;padding:12px 12px 18px}
  .tv-guida .ga{border-left:0;border-top:1px solid #dccaa0;overflow:visible}
  .tv-guida .gs button span{display:none}.tv-guida .gs button.on span{display:inline}
  .tv-guida .gcards{grid-template-columns:minmax(0,1fr)}
  .tv-guida .gcards:has(.carta){grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
  .tv-guida .gs{padding:0 10px 10px}.tv-guida .gs button{min-width:44px}.tv-guida .gs button.on{min-width:110px}
  .tv-guida .gh{padding:10px 12px}
  .tv-guida .ab6{grid-template-columns:repeat(3,minmax(0,1fr))}
  .tv-guida .ab6.pic{grid-template-columns:repeat(6,minmax(0,1fr))}
  .tv-guida .gf{padding:8px 10px;gap:6px}.tv-guida .gbtn{padding:7px 11px}
  .tv-guida .gf .gmsg{font-size:.8rem}
  .tv-guida .spls{max-height:none}
}
`;
  const css = () => { if (cssDone) return; cssDone = true; const s = document.createElement('style'); s.textContent = CSS + '\n' + CSS2; document.head.append(s); };

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

  // il tavolo e la presenza sul sito entrano con lo stesso account: un solo accesso alla volta
  let entrato = null;
  const entraUnaVolta = info => entrato = entrato || entra(info).catch(e => { entrato = null; throw e; });
  // il sito salva le modifiche del DM su Supabase (local.js) con lo stesso account del tavolo
  window.__sbDM = async () => {
    const info = await window.__tavolo?.();
    if (!info || info.ruolo !== 'dm') throw new Error('Solo il DM può salvare.');
    try { await entraUnaVolta(info); } catch (e) { throw e.tv && ERR[e.tv] ? new Error(ERR[e.tv][0] + '. ' + ERR[e.tv][1].replace(/<[^>]+>/g, '')) : e; }
    return SB;
  };

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
    // la foto del personaggio di ognuno, per la chat (serve tavolo/tappa-2c.sql; senza, si usa la foto del token)
    for (const g of info.giocatori || []) {
      const foto = S.ents?.get(g.pg)?.portrait?.thumb, m = membri.find(x => x.giocatore === g.id);
      if (foto && m && m.immagine !== foto && 'immagine' in m) await SB.from('tavolo_membri').update({ immagine: foto }).eq('giocatore', g.id);
    }
    const mb = await SB.from('tavolo_membri').select('*'); if (!mb.error) { T.membri = mb.data; disegnaLog(); }
  }

  /* ---------- stato ---------- */
  const T = { mvarchi: new Map(), mask: [], turno: [], chat: [], mmodo: 'svela', mforma: 'rett', mraggio: 0, mini: new Map(), me: null, info: null, stato: null, scene: new Map(), tok: new Map(), tiri: [], vista: null, view: { x: 0, y: 0, z: 1 }, tool: 'muovi', livello: 'segnalini', tdpriv: false, allN: 3, muri: [], mtool: 'muro', mfatti: [], wver: 0, schede: null, sv: null, ch: null, rulers: new Map(), salv: new Map(), live: false, url: new Map(), online: [] };
  const isDM = () => T.me?.ruolo === 'dm';
  // nella pagina di un personaggio la scheda si apre senza mappa: niente token, turni né bersagli
  const scena = () => T.pag ? null : T.scene.get(T.vista) || null;
  const puoMuovere = t => isDM() || (t.giocatore && t.giocatore === T.me.giocatore);
  const iniziali = n => String(n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';

  /* ---------- pagina ---------- */
  route(/^\/tavolo$/, async () => {
    await claude.use('db'); css();
    T.pag = false; T.diceInit = false; T.scal = undefined; T.drag = null; T.online = []; T.live = false; T.tool = 'muovi';
    setView(`<h1 style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Tavolo</h1>
      <div class="tv"><nav class="tv-rail" id="tv-rail" aria-label="Strumenti del tavolo"><span class="sp"></span><span class="tv-on" id="tv-on" title="Connessione…"></span></nav>
      <div class="tv-wrap"><div class="tv-stage" id="tv-stage"><div class="tv-empty"><div><p>Apro il tavolo…</p></div></div></div><div class="tv-strip" id="tv-strip" hidden></div><div class="tv-hud" id="tv-hud" hidden></div><div class="tv-top" id="tv-top"></div><div class="tv-mbar" id="tv-mbar" hidden></div><div class="tv-ts" id="tv-ts" hidden></div><div class="tv-tdp" id="tv-tdp" hidden></div><div class="tv-sp" id="tv-sp" hidden></div><button type="button" class="tv-ctab" id="tv-ctab" data-act="tv-dadi"></button></div>
      <aside class="tv-chat" id="tv-dice" hidden></aside><div class="tv-pages" id="tv-pages" hidden></div></div>`);
    suggerimenti($('.tv'));
    const fit = () => {
      const f = $('.tv'); if (!f) return;
      const top = $('header.top'), nav = $('#nav');
      f.style.top = (top ? top.getBoundingClientRect().bottom : 0) + 'px';
      f.style.bottom = (nav && getComputedStyle(nav).position === 'fixed' ? nav.offsetHeight : 0) + 'px';
    };
    fit(); scrollTo(0, 0); addEventListener('resize', fit); addEventListener('resize', alzaAvvisi);
    let vivo = true;
    onCleanup(() => { vivo = false; removeEventListener('resize', fit); removeEventListener('resize', alzaAvvisi); esci(); document.querySelectorAll('.tv-tip').forEach(x => x.remove()); });
    const info = await window.__tavolo?.();
    T.info = info;
    try {
      if (!info) throw errore('ospite');
      T.me = await entraUnaVolta(info);
      if (!vivo) return;
      await carica();
      if (!vivo) return;
      collega();
      disegnaBarra(); disegnaDadi(); mostraScena(true); disegnaStriscia();
      if (isDM()) preparaGiocatori(info).catch(e => toast(e.tv ? ERR[e.tv][1].replace(/<[^>]+>/g, '') : e.message, 'err'));
      if (isDM()) preparaSchede(info).catch(e => toast(e.message, 'err'));
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
    removeEventListener('keydown', tasti); removeEventListener('pointermove', segui);
  }
  function stato(cls, txt) { const o = $('#tv-on'); if (!o) return; o.className = 'tv-on ' + cls; o.title = txt; }

  async function carica() {
    const [st, sc, tk, tr, mb, ms, tu, ct, sh, mu, pg, sv, sg] = await Promise.all([
      SB.from('tavolo_stato').select('*').eq('id', 1).maybeSingle(),
      SB.from('tavolo_scene').select('*').order('creata'),
      SB.from('tavolo_token').select('*'),
      SB.from('tavolo_tiri').select('*').order('id', { ascending: false }).limit(80),
      SB.from('tavolo_membri').select('*'),
      SB.from('tavolo_maschera').select('*').order('id'),
      SB.from('tavolo_turno').select('*'),
      SB.from('tavolo_chat').select('*').order('id', { ascending: false }).limit(80),
      SB.from('tavolo_schede').select('*'),
      SB.from('tavolo_muri').select('*'),
      SB.from('tavolo_pf_gruppo').select('*'),
      SB.from('tavolo_salvezze').select('*').is('esito', null).order('creato'),
      SB.from('tavolo_segnalini').select('*').order('creato')
    ]);
    for (const r of [ms, tu, ct]) if (r.error && sqlMancante(r.error)) throw errore('sql2');
    T.stato = chk(st) || { scena: null, canale: 'avalar' };
    T.scene = new Map(chk(sc).map(s => [s.id, s]));
    T.tok = new Map(chk(tk).map(t => [t.id, t]));
    T.tiri = chk(tr).reverse();
    T.membri = chk(mb);
    T.mask = chk(ms); T.turno = chk(tu); T.chat = chk(ct).reverse();
    // senza tavolo/tappa-3.sql il tavolo funziona lo stesso, solo senza schede
    T.schede = sh.error ? null : new Map(sh.data.map(x => [x.id, x]));
    setTimeout(festaInSospeso, 1500);
    setTimeout(() => regole().catch(() => { }), 4000); // servono anche alle azioni bonus e alle reazioni dei privilegi
    // senza tavolo/tappa-4.sql niente muri né nebbia automatica
    T.muri = mu.error ? null : mu.data; T.wver++;
    // senza tavolo/tappa-6.sql i giocatori non vedono la salute dei compagni
    T.pfg = new Map(pg.error ? [] : pg.data.map(x => [x.giocatore, x]));
    // senza tavolo/tappa-7.sql i tiri salvezza si fanno ancora tutti in automatico
    // senza tavolo/tappa-11.sql niente segnalini sulla mappa
    T.segn = sg.error ? null : sg.data;
    T.salvOk = !sv.error; T.salv = new Map(sv.error ? [] : sv.data.map(x => [x.id, x])); disegnaSalvezze();
    if (!isDM() || !T.scene.has(T.vista)) T.vista = T.stato.scena;
  }

  /* ---------- tempo reale ---------- */
  function collega() {
    if (T.ch) SB.removeChannel(T.ch);
    const ch = T.ch = SB.channel('tavolo-' + T.stato.canale, { config: { broadcast: { self: false }, presence: { key: T.me.uid } } });
    const pg = (table, f, event = '*') => ch.on('postgres_changes', { event, schema: 'public', table }, f);
    pg('tavolo_token', p => {
      if (p.eventType === 'DELETE') { T.tok.delete(p.old.id); disegnaToken(); return; }
      const t = completa(T.tok.get(p.new.id), p.new); if (T.drag?.id === t.id) return; T.tok.set(t.id, t); disegnaToken(); togliMorti();
      if (T.sv?.tok === t.id) aggiornaFinestra();
    });
    pg('tavolo_pf_gruppo', p => { if (p.eventType === 'DELETE') T.pfg.delete(p.old.giocatore); else T.pfg.set(p.new.giocatore, p.new); disegnaToken(); });
    if (T.salvOk) pg('tavolo_salvezze', p => { const r = p.new?.id ? p.new : p.old; if (p.eventType === 'DELETE' || r.esito != null) T.salv.delete(r.id); else T.salv.set(r.id, r); disegnaSalvezze(); });
    pg('tavolo_schede', p => {
      if (!T.schede) return;
      if (p.eventType === 'DELETE') { T.schede.delete(p.old.id); dopoScheda(p.old.id); return; }
      arrivaScheda(p.new); togliMorti();
    });
    // schede di PNG che il DM ha appena mostrato o nascosto: i giocatori ricaricano l'elenco
    ch.on('broadcast', { event: 'schede' }, () => { if (!isDM() && T.schede) ricaricaSchede(); });
    pg('tavolo_scene', p => {
      if (p.eventType === 'DELETE') { T.scene.delete(p.old.id); if (T.vista === p.old.id) T.vista = T.stato.scena; }
      else {
        const prima = T.scene.get(p.new.id); T.scene.set(p.new.id, p.new); if (prima?.mappa !== p.new.mappa) T.url.delete(prima?.mappa);
        const solo = prima && Object.keys(p.new).every(k => ['difficile', 'effetti'].includes(k) || JSON.stringify(prima[k]) === JSON.stringify(p.new[k]));
        if (solo && p.eventType === 'UPDATE') { if (p.new.id === T.vista) { disegnaDifficile(); disegnaEffetti(); } return; }
      }
      disegnaBarra(); if (p.eventType === 'DELETE' || p.new.id === T.vista) mostraScena(p.eventType !== 'UPDATE');
      if (isDM() && !$('#tv-pages')?.hidden) pannelloMappe(true);
    });
    pg('tavolo_stato', async p => {
      const prima = T.stato.scena, primoTurno = T.stato.turno; T.stato = p.new;
      if (primoTurno !== T.stato.turno || p.old?.round !== p.new.round) { disegnaTurno(); disegnaToken(); disegnaEffetti(); scadenzeEffetti(); }
      if (prima === T.stato.scena) return;
      if (isDM()) { disegnaBarra(); return; }
      // i giocatori seguono il DM nella nuova scena: scena e token arrivano solo ora che è attiva
      await carica().catch(() => { }); T.vista = T.stato.scena; disegnaBarra(); mostraScena(true);
      if (scena()) toast('Il DM vi ha portati in: ' + scena().nome);
    });
    pg('tavolo_tiri', p => { if (T.tiri.some(x => x.id === p.new.id)) return; T.tiri.push(p.new); if (T.tiri.length > 120) T.tiri.shift(); nuovoTiro(p.new); }, 'INSERT');
    pg('tavolo_tiri', p => { T.tiri = T.tiri.filter(x => x.id !== p.old.id); disegnaLog(); }, 'DELETE');
    // l'esito dell'attacco (colpito, mancato) il server lo scrive sul tiro subito dopo averlo tirato
    pg('tavolo_tiri', p => { const i = T.tiri.findIndex(x => x.id === p.new.id); if (i < 0) return; T.tiri[i] = p.new; disegnaLog(); }, 'UPDATE');
    pg('tavolo_chat', p => { if (T.chat.some(x => x.id === p.new.id)) return; T.chat.push(p.new); if (T.chat.length > 120) T.chat.shift(); nuovoMsg(p.new); }, 'INSERT');
    pg('tavolo_chat', p => { T.chat = T.chat.filter(x => x.id !== p.old.id); disegnaLog(); }, 'DELETE');
    pg('tavolo_maschera', p => {
      if (p.eventType === 'DELETE') T.mask = T.mask.filter(m => m.id !== p.old.id);
      else if (!T.mask.some(m => m.id === p.new.id)) T.mask.push(p.new);
      programmaMaschera();
    });
    pg('tavolo_muri', p => {
      if (!T.muri) return;
      if (p.eventType === 'DELETE') T.muri = T.muri.filter(m => m.id !== p.old.id);
      else { const i = T.muri.findIndex(m => m.id === p.new.id); if (i >= 0) T.muri[i] = { ...T.muri[i], ...p.new }; else T.muri.push(p.new); }
      T.wver++; programmaMaschera(); if (T.tool === 'muri') barraMaschera();
    });
    pg('tavolo_segnalini', p => {
      if (!T.segn) return;
      if (p.eventType === 'DELETE') T.segn = T.segn.filter(x => x.id !== p.old.id);
      else if (!isDM() && (p.new.nascosto || p.new.scena !== T.stato.scena)) T.segn = T.segn.filter(x => x.id !== p.new.id);
      else { const i = T.segn.findIndex(x => x.id === p.new.id); if (i >= 0) T.segn[i] = { ...T.segn[i], ...p.new }; else { T.segn.push(p.new); if (!isDM()) T.sgApp = p.new.id; } }
      disegnaSegnalini(); if (T.tool === 'segni') barraMaschera();
    });
    // un segnalino appena nascosto: ai giocatori il database non manda più niente, glielo dico io
    ch.on('broadcast', { event: 'segnalino' }, ({ payload: m }) => { if (isDM() || !T.segn) return; T.segn = T.segn.filter(x => x.id !== m.id); disegnaSegnalini(); });
    ch.on('broadcast', { event: 'ping' }, ({ payload: m }) => mostraPing(m));
    // il DM ha fatto dimenticare le zone esplorate
    ch.on('broadcast', { event: 'esplorato' }, ({ payload: m }) => { if (!isDM()) dimenticaEsplorato(m.scena); });
    pg('tavolo_turno', p => {
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
      // nel buio i token degli altri non si vedono nemmeno mentre si muovono
      if (!isDM() && t.giocatore !== T.me.giocatore && scena()) { const l = t.misura * scena().griglia; el.hidden = coperto(m.x + l / 2, m.y + l / 2); }
    });
    ch.on('broadcast', { event: 'attacco' }, ({ payload: m }) => mostraAttacco(m));
    ch.on('broadcast', { event: 'pf' }, ({ payload: m }) => mostraPF(m));
    ch.on('broadcast', { event: 'area' }, ({ payload: m }) => mostraArea(m));
    ch.on('broadcast', { event: 'ts' }, ({ payload: m }) => mostraTS(m));
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
      T.dadi = Object.fromEntries(Object.entries(ch.presenceState()).map(([k, a]) => [k, a[0]?.dado]).filter(x => x[1]));
      if (T.live) stato('ok', 'Al tavolo ora: ' + T.online.join(', '));
      const c = $('#tv-cnt'); if (c) c.textContent = T.online.length > 1 ? T.online.length : '';
    });
    let primo = true;
    ch.subscribe(async s => {
      if (s === 'SUBSCRIBED') {
        T.live = true; stato('ok', 'Collegato'); tracciaDado();
        // dopo un'interruzione riprendo tutto: nel frattempo qualcuno può aver mosso o tirato
        if (!primo) { await carica().catch(() => { }); disegnaBarra(); mostraScena(false); disegnaLog(); disegnaTurno(); if (T.schede) dopoScheda(); }
        primo = false;
      } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') { T.live = false; if (T.ch === ch) stato('ko', 'Riconnessione…'); }
    });
    addEventListener('keydown', tasti); addEventListener('pointermove', segui, { passive: true });
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
    sch: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 11h7M9 14.5h7M9 18h4"/>',
    piu: '<path d="M12 5v14M5 12h14"/>', meno: '<path d="M5 12h14"/>',
    adatta: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    occhio: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    velo: '<path d="M3 3l18 18"/><path d="M10.6 5.6A9.7 9.7 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.7 3.4M6.3 6.9C3.9 8.6 2.5 12 2.5 12S6 18.5 12 18.5c1.6 0 3-.4 4.3-1"/>',
    rett: '<rect x="4" y="6" width="16" height="12" rx="1.5" stroke-dasharray="3 2.2"/>',
    penn: '<path d="M14.5 4.5l5 5L9 20H4v-5z"/><path d="M12.5 6.5l5 5"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    sole: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    luna: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    muro: '<path d="M3 5h18v14H3zM3 9.7h18M3 14.3h18M9 5v4.7M15 5v4.7M6 9.7v4.6M12 9.7v4.6M18 9.7v4.6M9 14.3V19M15 14.3V19"/>',
    dif: '<path d="M3 3h18v18H3zM3 9l6-6M3 15 15 3M3 21 21 3M9 21l12-12M15 21l6-6"/>',
    pin: '<path d="M12 21.5s-6.5-6.2-6.5-11.5a6.5 6.5 0 0 1 13 0c0 5.3-6.5 11.5-6.5 11.5z"/><circle cx="12" cy="10" r="2.4"/>',
    efx: '<path d="M12 3c1 3 4 4.5 4 8.5a4 4 0 0 1-8 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 0-7.5zM5 19c2-1.3 4-1.3 7 0s5 1.3 7 0"/>',
    porta: '<path d="M6 21V4.5L15 3v18M15 5h3.5V21M3.5 21h17"/><circle cx="12.3" cy="12.5" r=".6"/>',
    portaAp: '<path d="M4.5 21V4h14v17M3 21h18"/><path d="M4.5 4L11 6.5V22l-6.5-1"/>',
    gomma: '<path d="M9 20h11M4.6 14.4l9.2-9.2a2 2 0 0 1 2.8 0l3.2 3.2a2 2 0 0 1 0 2.8L12 19H8.2l-3.6-3.6a.7.7 0 0 1 0-1z"/><path d="M9.5 9.5l5 5"/>',
    lucc: '<rect x="5" y="11" width="14" height="10" rx="1.5"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>',
    pag: '<rect x="3" y="7" width="13" height="13" rx="1.5"/><path d="M7 4h12.5A1.5 1.5 0 0 1 21 5.5V17"/><path d="M5.5 17l3.5-4 2.5 2.5 1.5-1.5 2 3"/>'
  };
  ICO.chat = '<path d="M4 5h16v11H9.5L5 20v-4H4z"/>';
  ICO.scal = '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 11h7M9 14.5h7M9 18h4"/>';
  // i dadi disegnati, per la chat e il tiradadi
  const DADO = {
    4: '<path d="M12 3l9 16H3z"/><path d="M12 3v16"/>',
    6: '<rect x="4" y="4" width="16" height="16" rx="2.5"/>',
    8: '<path d="M12 2l9 10-9 10-9-10z"/><path d="M3 12h18"/>',
    10: '<path d="M12 2l9 8-9 12-9-12z"/><path d="M3 10l9 3 9-3M12 13v9"/>',
    12: '<path d="M12 2l9.5 7-3.6 11H6.1L2.5 9z"/><path d="M12 7l4.5 3.3-1.7 5.2H9.2l-1.7-5.2z"/>',
    20: '<path d="M12 2l9 5v10l-9 5-9-5V7z"/><path d="M12 7l5 9H7z"/><path d="M12 2v5M3 7l4 9M21 7l-4 9M12 22l-5-6M12 22l5-6"/>',
    100: '<path d="M8 3l6 6-6 12-6-12z"/><path d="M17 5l5 5-5 9-4-7"/>'
  };
  const dado = n => `<svg viewBox="0 0 24 24" aria-hidden="true">${DADO[n]}</svg>`;
  const svg = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICO[k]}</svg>`;
  function disegnaBarra() { disegnaRail(); disegnaTop(); setActs(azioni()); }
  function disegnaRail() {
    const r = $('#tv-rail'); if (!r) return;
    const RL = { 'tv-sel': 'Seleziona', 'tv-mano': 'Sposta', 'tv-righello': 'Righello', 'tv-tiradadi': 'Dadi', 'tv-turno': 'Turno', 'tv-schede': 'Schede', 'tv-dadi': 'Chat', 'tv-scaletta': 'Scaletta', 'tv-maschera': 'Maschera', 'tv-muri': 'Muri', 'tv-difficile': 'Terreno', 'tv-effetti': 'Effetti', 'tv-segni': 'Segnalini', 'tv-token': 'Token', 'tv-griglia': 'Griglia', 'tv-liv-seg': 'Tutti', 'tv-liv-mas': 'Solo io' };
    const b = (act, tip, k, on) => `<button type="button" data-act="${act}" data-tip="${esc(tip)}" aria-label="${esc(tip)}" class="${on ? 'on' : ''}">${svg(k)}<span class="rl" aria-hidden="true">${RL[act] || ''}</span></button>`;
    let h = b('tv-sel', 'Seleziona e sposta i token (S)', 'sel', T.tool === 'muovi') + b('tv-mano', 'Sposta la mappa (M)', 'mano', T.tool === 'mano')
      + b('tv-righello', 'Righello (R)', 'rig', T.tool === 'righello') + b('tv-tiradadi', 'Tiradadi', 'dado', !$('#tv-tdp')?.hidden)
      + b('tv-turno', isDM() ? 'Modifica l\'ordine del turno' : 'Ordine del turno: barra o tabella classica', 'tur', isDM() ? !!T.turnoEd : turnoVert()) + b('tv-schede', 'Schede dei personaggi e dei PNG', 'sch', !$('#tv-sp')?.hidden)
      + b('tv-dadi', 'Chat e dadi', 'chat', !$('#tv-dice')?.hidden).replace('class="', 'class="tel '); // solo sul telefono, al posto della linguetta
    const bSc = isDM() && window.__scaletta ? b('tv-scaletta', 'Scaletta della sessione: la vedi solo tu', 'scal', !!T.scal && !$('#tv-dice')?.hidden) : '';
    if (isDM() && !scena() && bSc) h += '<hr><span class="lbl">DM</span>' + bSc;
    if (isDM() && scena()) h += '<hr><span class="lbl">DM</span>' + bSc + b('tv-maschera', 'Maschera: nascondi e svela la mappa', 'mas', T.tool === 'maschera') + b('tv-muri', 'Muri, porte e nebbia automatica', 'muro', T.tool === 'muri') + b('tv-difficile', 'Terreno difficile: il movimento costa il doppio', 'dif', T.tool === 'difficile') + b('tv-effetti', 'Effetti sulla mappa: fuoco, gas, veleno…', 'efx', T.tool === 'effetti') + b('tv-segni', 'Segnalini: bauli, porte, trappole, punti d\'interesse', 'pin', T.tool === 'segni') + b('tv-token', 'Aggiungi un token', 'tok') + b('tv-griglia', 'Impostazioni della pagina', 'gri');
    h += '<span class="sp"></span>';
    if (isDM() && scena()) h += '<span class="lbl">Livelli</span>' + b('tv-liv-seg', 'Livello Segnalini: i token che vedono tutti', 'lseg', T.livello === 'segnalini').replace('class="', 'class="liv ') + b('tv-liv-mas', 'Livello Master: i token che vedi solo tu', 'lmas', T.livello === 'master').replace('class="', 'class="liv ');
    h += `<span class="tv-cnt" id="tv-cnt">${T.online.length > 1 ? T.online.length : ''}</span><span class="tv-on ${T.live ? 'ok' : ''}" id="tv-on" title="${T.live ? esc('Al tavolo ora: ' + T.online.join(', ')) : 'Connessione…'}"></span>`;
    r.innerHTML = h;
  }
  function disegnaTop() {
    const t = $('#tv-top'); if (!t) return;
    const sc = scena(), att = T.stato?.scena;
    let h = '';
    if (sc) h += `<div class="tv-chip"><b>${esc(sc.nome)}</b>${isDM() ? (sc.id === att ? '<span class="qui" title="I giocatori sono su questa mappa">I giocatori sono qui</span>' : '<button type="button" class="btn sm primary" data-act="tv-porta">Porta qui i giocatori</button>') : ''}</div>`;
    if (isDM() && sc && T.livello === 'master') h = '<div class="tv-liv" title="I token che aggiungi e sposti ora li vedi solo tu">👑 Livello Master</div>' + h;
    if (isDM()) h += `<button type="button" class="tv-pgbtn" data-act="tv-pagine" data-tip="Mappe" aria-label="Mappe">${svg('pag')}<span>Mappe</span></button>`;
    t.innerHTML = h;
  }
  function azioni() {
    return {
      'tv-sel': () => strumento('muovi'), 'tv-mano': () => strumento('mano'), 'tv-righello': () => strumento(T.tool === 'righello' ? 'muovi' : 'righello'),
      'tv-dadi': () => { if (T.scal && !$('#tv-dice').hidden && matchMedia('(max-width:820px)').matches) return apriScaletta(false); apriChat($('#tv-dice').hidden, true); },
      'tv-scaletta': () => apriScaletta(!(T.scal && !$('#tv-dice').hidden)), 'tv-chatab': () => { apriScaletta(false); apriSchedaTab(false); }, 'tv-schtab': () => apriSchedaTab(true),
      'tv-porta': () => porta(T.vista),
      'tv-pagine': () => pannelloMappe($('#tv-pages').hidden), 'tv-nuova': () => dlgNuovaScena(),
      'tv-token': () => dlgToken(), 'tv-griglia': () => dlgGriglia(),
      'tv-turno': () => apriTurno(!T.turnoEd), 'tv-schede': () => apriSchede($('#tv-sp').hidden),
      'tv-tiradadi': () => { const p = $('#tv-tdp'); p.hidden = !p.hidden; if (!p.hidden) { disegnaTdp(); $('#tv-sp').hidden = true; if (T.turnoEd) apriTurno(false); if (matchMedia('(max-width:820px)').matches) apriChat(false); } disegnaRail(); },
      'tv-liv-seg': () => livello('segnalini'), 'tv-liv-mas': () => livello('master'), 'tv-maschera': () => strumento(T.tool === 'maschera' ? 'muovi' : 'maschera'), 'tv-muri': () => strumento(T.tool === 'muri' ? 'muovi' : 'muri'), 'tv-difficile': () => strumento(T.tool === 'difficile' ? 'muovi' : 'difficile'), 'tv-effetti': () => strumento(T.tool === 'effetti' ? 'muovi' : 'effetti'), 'tv-segni': () => strumento(T.tool === 'segni' ? 'muovi' : 'segni'),
      ...dadiActs()
    };
  }
  // livelli come su Roll20: Segnalini (li vedono tutti) e Master (solo il DM). Si lavora su uno alla volta
  function livello(l) { T.livello = l; chiudiPop(); const sl = document.querySelector('dialog.tv-side [name=liv]'); if (sl) sl.value = l; disegnaRail(); disegnaTop(); disegnaToken(); }
  function strumento(t) {
    const prima = T.tool; T.tool = t; if (T.mira && t !== 'muovi') fineMira();
    // le barre degli strumenti del DM stanno in alto a sinistra: chiudo i pannelli che le coprirebbero
    if (t === 'maschera' || t === 'allinea' || t === 'muri' || t === 'griglia' || t === 'difficile' || t === 'effetti' || t === 'segni') { const p = $('#tv-tdp'), sp = $('#tv-sp'); if (p) p.hidden = true; if (sp && !sp.hidden) apriSchede(false); }
    const st = $('#tv-stage'); if (st) { st.classList.toggle('rul', ['righello', 'maschera', 'allinea', 'muri', 'difficile', 'effetti', 'segni'].includes(t)); st.classList.toggle('segni', t === 'segni'); st.classList.toggle('mano', t === 'mano'); st.classList.toggle('muri', t === 'muri'); st.classList.toggle('gmano', t === 'griglia'); }
    if (prima === 'griglia' && t !== 'griglia' && T.gm) annullaGriglia();
    if (prima === 'muri' && t !== 'muri') T.mu = T.mdown = T.mhov = T.mgom = null;
    if (prima === 'segni' && t !== 'segni') T.sgSel = null;
    disegnaRail(); disegnaSegnalini(); barraMaschera(); disegnaMuri(); disegnaRighelli();
  }
  function tasti(e) {
    if (e.key === 'Escape' && T.mira) return fineMira(); // anche con la scheda aperta (nascosta) mentre si mira
    if (e.key === 'Enter' && T.mira?.area && !e.target.closest('input,textarea,select')) return lanciaArea();
    if ((e.ctrlKey || e.metaKey) && !e.altKey && isDM() && /^[cv]$/i.test(e.key) && !e.target.closest('input,textarea,select,[contenteditable]') && !document.querySelector('dialog[open]') && !getSelection()?.toString()) {
      // Ctrl+C sul token sotto il mouse, Ctrl+V dove c'è il mouse
      const sotto = cursore && document.elementFromPoint(cursore.x, cursore.y)?.closest('.tv-tok'), t = sotto && T.tok.get(sotto.dataset.id);
      if (e.key.toLowerCase() === 'c' && t) { e.preventDefault(); copiaToken(t); }
      else if (e.key.toLowerCase() === 'v' && T.copia) { e.preventDefault(); incollaToken(true); }
      return;
    }
    if (e.target.closest('input,textarea,select,[contenteditable]') || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('dialog[open]')) return;
    const k = e.key.toLowerCase();
    if (k === 'r') strumento(T.tool === 'righello' ? 'muovi' : 'righello');
    else if (k === 's') strumento('muovi');
    else if (k === 'm') strumento('mano');
    else if (T.tool === 'griglia' && /^Arrow/.test(e.key)) { e.preventDefault(); const q = e.shiftKey ? 0.1 : 1; spostaGriglia({ ArrowLeft: -q, ArrowRight: q }[e.key] || 0, { ArrowUp: -q, ArrowDown: q }[e.key] || 0); }
    else if (T.tool === 'griglia' && e.key === 'Enter') salvaGriglia().catch(err => toast(err.message, 'err'));
    else if ((e.key === 'Escape' || e.key === 'Enter') && T.tool === 'muri' && T.mu) { T.mu = null; disegnaRighelli(); }
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
    // cambiando mappa il combattimento di quella vecchia finisce: sulla nuova si tira di nuovo l'iniziativa
    const cs = scenaCombattimento();
    if (cs && cs !== id && await svuotaTurno()) toast(`Combattimento su «${T.scene.get(cs)?.nome || 'la mappa di prima'}» finito: l'ordine del turno è stato svuotato.`);
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
    chiudiPop(); disegnaStriscia();
    const sc = scena();
    if (!sc) {
      st.innerHTML = `<div class="tv-empty"><div>${isDM() ? (T.scene.size ? '<h2>Nessuna mappa aperta</h2><p>Scegline una dal pannello delle mappe, in alto a destra.</p><p><button class="btn primary" data-act="tv-pagine">Apri le mappe</button></p>' : '<h2>Il tavolo è pronto</h2><p>Crea la prima mappa: carica l\'immagine del combattimento o del luogo, poi aggiungi i token.</p><p><button class="btn primary" data-act="tv-nuova">Crea una mappa</button></p>') : '<h2>Il tavolo è vuoto</h2><p>Aspetta che il DM vi porti in una scena: apparirà qui da sola.</p>'}</div></div>`;
      return;
    }
    st.innerHTML = `<div class="tv-world" id="tv-world"><img class="tv-map" id="tv-map" alt="" draggable="false" width="${sc.larghezza}" height="${sc.altezza}" style="width:${sc.larghezza}px;height:${sc.altezza}px">
      <svg class="tv-grid" id="tv-grid" width="${sc.larghezza}" height="${sc.altezza}"></svg><svg class="tv-dif" id="tv-dif" width="${sc.larghezza}" height="${sc.altezza}"></svg><svg class="tv-efx" id="tv-efx" width="${sc.larghezza}" height="${sc.altezza}"></svg><div class="tv-segn" id="tv-segn"></div><div id="tv-toks"></div><canvas class="tv-fog" id="tv-fog" style="width:${sc.larghezza}px;height:${sc.altezza}px"></canvas>
      <svg class="tv-walls" id="tv-walls" width="${sc.larghezza}" height="${sc.altezza}"></svg><div class="tv-porte" id="tv-porte"></div><svg class="tv-fx" id="tv-fx" width="${sc.larghezza}" height="${sc.altezza}"></svg></div>
      <svg class="tv-ov" id="tv-ov"></svg><div class="tv-zoom" role="group" aria-label="Zoom"><button type="button" data-z="1.25" data-tip="Ingrandisci" aria-label="Ingrandisci">${svg('piu')}</button>
        <div class="tv-zs" id="tv-zs" role="slider" tabindex="0" aria-label="Zoom" aria-valuemin="5" aria-valuemax="600" data-tip="Trascina per lo zoom"><span class="tr"><i></i></span>${[0.25, 0.5, 1, 2, 4].map(z => `<span class="tk ${z === 1 ? 'uno' : ''}" style="--q:${(Math.log(z) - Z_MIN) / (Z_MAX - Z_MIN)}"></span>`).join('')}<span class="kn"></span></div>
        <button type="button" data-z="0.8" data-tip="Rimpicciolisci" aria-label="Rimpicciolisci">${svg('meno')}</button><span class="sep"></span>
        <button type="button" data-z="0" data-tip="Mostra tutta la mappa" aria-label="Mostra tutta la mappa">${svg('adatta')}</button><button type="button" class="zp" id="tv-zp" data-z="1" data-tip="Torna al 100%" aria-label="Torna al 100%"></button></div>`;
    barraCopia();
    st.querySelectorAll('[data-z]').forEach(b => b.onclick = () => { const z = b.id === 'tv-zp' ? 1 / T.view.z : +b.dataset.z; if (!z) adatta(); else { const r = st.getBoundingClientRect(); zoom(z, r.width / 2, r.height / 2); } });
    // il cursore va in scala logaritmica: ogni tratto ingrandisce della stessa proporzione
    const zs = $('#tv-zs'), aZoom = z => { const r = st.getBoundingClientRect(); zoom(z / T.view.z, r.width / 2, r.height / 2); };
    const daY = e => { const r = zs.getBoundingClientRect(), q = clamp(1 - (e.clientY - r.top - 6) / (r.height - 12), 0, 1); aZoom(Math.exp(Z_MIN + q * (Z_MAX - Z_MIN))); };
    zs.onpointerdown = e => { e.preventDefault(); e.stopPropagation(); zs.setPointerCapture(e.pointerId); zs.classList.add('on'); daY(e); };
    zs.onpointermove = e => { if (zs.hasPointerCapture(e.pointerId)) daY(e); };
    zs.onpointerup = zs.onpointercancel = () => zs.classList.remove('on');
    zs.onkeydown = e => { const f = { ArrowUp: 1.1, ArrowRight: 1.1, ArrowDown: 1 / 1.1, ArrowLeft: 1 / 1.1 }[e.key]; if (f) { e.preventDefault(); aZoom(T.view.z * f); } };
    const pb = $('#tv-porte');
    pb.onclick = e => { const b = e.target.closest('.tv-porta'); if (b) apriPorta(b.dataset.id); };
    pb.oncontextmenu = e => { const b = e.target.closest('.tv-porta'); if (!b || !isDM()) return; e.preventDefault(); menuPorta(b.dataset.id, e); };
    T.fogKey = null;
    const img = $('#tv-map');
    if (sc.mappa) urlMappa(sc.mappa).then(u => { if (img.isConnected) img.src = u; }).catch(e => toast('Mappa non caricata: ' + e.message, 'err'));
    else img.removeAttribute('src');
    disegnaGriglia(); disegnaDifficile(); disegnaEffetti(); disegnaSegnalini(); disegnaMaschera(); disegnaToken(); interazioni(st); barraMaschera();
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
    const w = $('#tv-world'); if (w) { w.style.transform = `translate(${T.view.x}px,${T.view.y}px) scale(${T.view.z})`; w.style.setProperty('--z', T.view.z); }
    const zp = $('#tv-zp'); if (zp) zp.textContent = Math.round(T.view.z * 100) + '%';
    const zs = $('#tv-zs'); if (zs) { zs.style.setProperty('--p', (Math.log(T.view.z) - Z_MIN) / (Z_MAX - Z_MIN)); zs.setAttribute('aria-valuenow', Math.round(T.view.z * 100)); }
    disegnaRighelli(); chiudiPop();
  }
  const Z_MIN = Math.log(0.05), Z_MAX = Math.log(6);
  function zoom(f, cx, cy) {
    const z = clamp(T.view.z * f, 0.05, 6), k = z / T.view.z;
    T.view = { z, x: cx - (cx - T.view.x) * k, y: cy - (cy - T.view.y) * k }; applicaVista();
  }
  const mondo = (st, e) => { const r = st.getBoundingClientRect(); return { x: (e.clientX - r.left - T.view.x) / T.view.z, y: (e.clientY - r.top - T.view.y) / T.view.z, sx: e.clientX - r.left, sy: e.clientY - r.top }; };
  // aggancio alla griglia: i token si fermano dentro una casella (mezza casella per i token piccoli)
  function aggancia(v, o, mis) { const sc = scena(), s = mis < 1 ? sc.griglia / 2 : sc.griglia; return o + Math.round((v - o) / s) * s; }
  const centroCasella = (v, o) => { const s = scena().griglia; return o + (Math.floor((v - o) / s) + 0.5) * s; };

  // i cursori del tavolo mostrano la parte piena (il colore arriva fino al pallino)
  const pRange = el => el.style.setProperty('--p', ((+el.value - +el.min) / ((+el.max - +el.min) || 1) * 100) + '%');
  document.addEventListener('input', e => { if (e.target.matches?.('input.tv-rg')) pRange(e.target); });

  /* ---------- token ---------- */
  const tokEl = id => document.querySelector(`.tv-tok[data-id="${id}"]`);
  function disegnaToken() {
    const box = $('#tv-toks'), sc = scena(); if (!box || !sc) return;
    // se i token che guardano si sono mossi, prima ricalcolo la nebbia
    if (nebbiaQui(sc) && chiaveVista(sc) !== T.fogKey) disegnaMaschera();
    const lista = [...T.tok.values()].filter(t => t.scena === sc.id).sort((a, b) => b.misura - a.misura || (a.giocatore ? 1 : 0) - (b.giocatore ? 1 : 0));
    const vivi = new Set(lista.map(t => t.id)), att = T.turno?.find(x => x.id === T.stato?.turno);
    box.querySelectorAll('.tv-tok').forEach(el => { if (!vivi.has(el.dataset.id)) el.remove(); });
    lista.forEach((t, i) => {
      let el = tokEl(t.id);
      if (!el) { el = document.createElement('div'); el.className = 'tv-tok'; el.dataset.id = t.id; el.innerHTML = '<span class="fxs"></span><span class="ini"></span><b></b><i class="pf"><s></s></i><span class="cnd"></span><span class="az" hidden></span>'; }
      const lato = t.misura * sc.griglia, pos = T.drag?.id === t.id && T.drag.mosso ? T.drag : t;
      el.style.cssText = `left:${pos.x}px;top:${pos.y}px;width:${lato}px;height:${lato}px;--c:${t.colore};--fs:${Math.max(11, sc.griglia * 0.22)}px;z-index:${i + 1}${t.immagine ? `;background-image:url("${t.immagine.replace(/"/g, '%22')}")` : ''}`;
      if (T.drag?.id !== t.id) el.classList.remove('live');
      el.classList.toggle('turno', !!att && att.token === t.id);
      // mirando, i bersagli raggiungibili si accendono e gli altri si spengono
      const vm = T.mira?.area ? (T.mira.bers?.includes(t.id) ? { ok: true } : null) : T.mira && t.id !== T.mira.tok ? valuta(T.mira, t) : null; el.classList.toggle('mira-si', !!vm?.ok); el.classList.toggle('mira-no', !!vm && !vm.ok); el.classList.toggle('mira-io', T.mira?.tok === t.id);
      // i giocatori non vedono i token altrui sotto la maschera
      el.hidden = !isDM() && t.giocatore !== T.me.giocatore && coperto(t.x + lato / 2, t.y + lato / 2);
      el.classList.toggle('hid', !!t.nascosto);
      if (isDM()) { const qui = !!t.nascosto === (T.livello === 'master'); el.classList.toggle('altro', !qui); el.classList.toggle('qui', qui); }
      el.classList.toggle('mine', !!t.giocatore && t.giocatore === T.me.giocatore); el.classList.toggle('dm', isDM());
      el.querySelector('.ini').textContent = t.immagine ? '' : iniziali(t.nome);
      el.querySelector('b').textContent = t.nome + (t.nascosto ? ' (nascosto)' : '');
      el.querySelector('b').hidden = !t.nome;
      el.title = t.nome || '';
      const ai = aiutoPer(t), sg = [schiva(t) && ['🌀', 'Schivata'], ai && ['🤝', 'Aiutato da ' + ai.h.nome]].filter(Boolean);
      const cl = condTok(t).filter(c => COND_FX[c]), ck = cl.join('|') + '#' + sg.map(x => x[1]).join('|');
      if (el.dataset.cnd !== ck) { // ridisegno gli effetti solo se cambiano, così le animazioni non ripartono
        el.dataset.cnd = ck;
        Object.values(COND_FX).forEach(([, c]) => el.classList.remove('c-' + c)); cl.forEach(c => el.classList.add('c-' + COND_FX[c][1]));
        el.querySelector('.fxs').innerHTML = cl.map(c => `<span class="fx f-${COND_FX[c][1]}"></span>`).join('');
        el.querySelector('.cnd').innerHTML = cl.map(c => `<i title="${c}">${COND_FX[c][0]}</i>`).join('') + sg.map(([ic, l]) => `<i title="${esc(l)}">${ic}</i>`).join('');
      }
      if (cl.length || sg.length) el.title += ' · ' + [...cl, ...sg.map(x => x[1])].join(', ');
      // la barra della salute: il DM la vede su tutti, i giocatori su quelli del gruppo e sui PNG che il DM mostra
      const pf = (isDM() || !!t.giocatore || !!t.barra) && pfDi(t), bar = el.querySelector('.pf');
      bar.hidden = !pf; el.classList.toggle('barra', !!pf);
      if (pf) { const q = clamp(pf.pf / pf.max, 0, 1); bar.firstChild.style.width = q * 100 + '%'; bar.style.setProperty('--b', q > 0.5 ? '#3f9a4a' : q > 0.25 ? '#d9a21b' : '#c0392b'); bar.classList.toggle('dm-solo', isDM() && !t.giocatore && !t.barra); if (isDM() || t.giocatore) el.title += ` · PF ${pf.pf}/${pf.max}`; }
      // nel suo turno: quanto movimento resta e quali azioni ha ancora
      const hud = el.querySelector('.az'), mio = suoTurno(t);
      hud.hidden = !mio;
      // tre bollini a sinistra del token (azione, azione bonus, reazione) e sotto il nome i metri che restano
      if (mio) {
        const mv = movimentoDi(t), mia = puoMuovere(t), fs = Math.max(11, sc.griglia * 0.22), d = Math.max(18, fs * 1.75), R = lato / 2 + d * 0.62;
        const bol = AZ.map(([k, ic, l], j) => { const g = (220 - j * 40) * Math.PI / 180, u = usata(t, k); return `<button type="button" class="c${u ? ' no' : ''}" data-z="${k}" style="left:${lato / 2 + R * Math.cos(g) - d / 2}px;top:${lato / 2 + R * Math.sin(g) - d / 2}px;width:${d}px;height:${d}px" title="${l}: ${u ? 'usata' : 'disponibile'}${mia ? (u ? ' (tocca per ridarla)' : ' (tocca quando la usi)') : ''}" aria-label="${l}${u ? ' usata' : ''}"${mia ? '' : ' disabled'}>${ic}</button>`; }).join('');
        hud.innerHTML = `${bol}<button type="button" class="mt${mv.resta < 0 ? ' ko' : ''}" data-k="azm" style="top:${el.querySelector('b').hidden ? 'calc(100% + 6px)' : 'calc(100% + 16px + var(--fs,13px) * 1.15 + 6px)'}" title="${mia ? 'Movimento rimasto · tocca per Scatto, Disimpegno, Schivata…' : 'Movimento rimasto'}"${mia ? '' : ' disabled'}>🏃 ${metri(Math.max(0, mv.resta))}<small> / ${metri(mv.tot)}</small>${mia ? '<span class="dd">▾</span>' : ''}</button>`;
        if (mia) {
          hud.querySelectorAll('button').forEach(b => { b.onpointerdown = e => e.stopPropagation(); b.ondblclick = e => e.stopPropagation(); });
          hud.querySelectorAll('[data-z]').forEach(b => b.onclick = e => { e.stopPropagation(); cambiaAz(t, b.dataset.z); });
          hud.querySelector('[data-k=azm]').onclick = e => { e.stopPropagation(); menuAzioni(t, e.currentTarget); };
        }
      }
      box.append(el); // l'ordine nel riquadro decide chi sta sopra
    });
    // fin dove arriva chi gioca (le diagonali contano 1, come sul regolamento): lo vede chi lo muove
    let mvr = box.querySelector('.tv-mvr');
    const tt = att?.token && T.tok.get(att.token);
    if (tt && tt.scena === sc.id && puoMuovere(tt)) {
      const o = origineTurno(tt), mv = movimentoDi(tt), cas = Math.max(0, Math.floor(mv.tot / (sc.metri || 1.5) + 1e-6)), g = sc.griglia, lato = tt.misura * g;
      if (!mvr) { mvr = document.createElement('div'); mvr.className = 'tv-mvr'; }
      mvr.style.cssText = `left:${o.x - cas * g}px;top:${o.y - cas * g}px;width:${lato + 2 * cas * g}px;height:${lato + 2 * cas * g}px;--fs:${Math.max(12, g * 0.22)}px`;
      mvr.classList.toggle('finito', mv.resta <= 0);
      mvr.innerHTML = `<span>${mv.resta > 0 ? '🏃 ancora ' + metri(mv.resta) : '🏃 movimento finito'}</span>`;
      box.prepend(mvr);
    } else mvr?.remove();
    disegnaHud();
  }

  // i token dei personaggi non si sovrappongono: se la casella è occupata da un altro personaggio, va nella libera più vicina
  function postoLibero(t, x, y) {
    if (!t.giocatore) return { x, y };
    const sc = scena(), lato = t.misura * sc.griglia, passo = t.misura < 1 ? sc.griglia / 2 : sc.griglia;
    const altri = [...T.tok.values()].filter(o => o.id !== t.id && o.scena === sc.id && o.giocatore && (isDM() || !o.nascosto));
    const occupa = (px, py) => altri.some(o => { const l = o.misura * sc.griglia, m = 0.5; return px < o.x + l - m && px + lato > o.x + m && py < o.y + l - m && py + lato > o.y + m; });
    let best = null;
    for (let r = 0; r <= 6 && !best; r++) for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) {
      if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
      const px = x + i * passo, py = y + j * passo;
      if (px < -1 || py < -1 || px + lato > sc.larghezza + 1 || py + lato > sc.altezza + 1 || occupa(px, py)) continue;
      const dd = i * i + j * j; if (!best || dd < best.dd) best = { x: px, y: py, dd };
    }
    return best;
  }

  /* ---------- trascinamenti, righello, zoom ---------- */
  function interazioni(st) {
    if (st.__tv) return; st.__tv = true;
    const punti = new Map(); let pan = null, pinch = null, rul = null, mas = null, ultimo = 0;
    st.addEventListener('wheel', e => { e.preventDefault(); const r = st.getBoundingClientRect(); const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY; zoom(Math.exp(-(e.ctrlKey ? dy * 0.01 : clamp(dy, -100, 100) * 0.0005)), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    st.addEventListener('pointerdown', e => {
      if (e.button > 0 || !scena() || e.target.closest('.tv-zoom,.tv-pop,.tv-porta,.tv-incolla')) return;
      chiudiPop();
      punti.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { st.setPointerCapture(e.pointerId); } catch { }
      if (punti.size === 2) { // due dita: ingrandimento, annullo il resto
        annullaDrag(); rul = fineRighello(rul, true); pan = null; clearTimeout(T.pingT); T.sgm = null; T.mdown = T.mgom = null; if (mas) { mas = null; disegnaMaschera(); disegnaRighelli(); }
        const [a, b] = [...punti.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: T.view.z, v: { ...T.view } }; return;
      }
      if (punti.size > 2) return;
      const p = mondo(st, e), el = e.target.closest('.tv-tok'), t = el && T.tok.get(el.dataset.id);
      if (T.mira?.area) { T.mira.p = p; disegnaArea(); return; }
      if (T.mira && t) { if (t.id !== T.mira.tok || suSe(T.mira)) scegliBersaglio(t); return; }
      if (T.tool === 'maschera' && isDM()) { mas = inizioMaschera(p); return; }
      if (T.tool === 'muri' && isDM()) { inizioMuro(p, e); return; }
      if (T.tool === 'difficile' && isDM()) { inizioDif(p); return; }
      if (T.tool === 'effetti' && isDM()) { inizioEff(p, e); return; }
      if (T.tool === 'segni' && isDM()) { inizioSegn(p, e); return; }
      if (T.tool === 'griglia' && isDM()) { const sc = scena(); T.gd = { sx: e.clientX, sy: e.clientY, x: sc.griglia_x, y: sc.griglia_y }; return; }
      if (T.tool === 'allinea' && isDM()) { T.al = { a: p, b: p }; disegnaRighelli(); return; }
      if (T.tool === 'righello') { const sc = scena(); const a = { x: centroCasella(p.x, sc.griglia_x), y: centroCasella(p.y, sc.griglia_y) }; rul = { pts: [a, a] }; mostraRighello(rul.pts); return; }
      // riprendere il token mentre aspetta la conferma: si continua da dove è, misurando sempre dalla partenza
      let da = null;
      if (t && T.tool !== 'mano' && puoMuovere(t) && T.passo) { if (T.passo.id === t.id) { da = T.passo; T.passo = null; barraMaschera(); } else annullaPasso(); }
      // nel suo turno, finito il movimento non si sposta più (il DM può forzare tenendo premuto Alt)
      if (t && T.tool !== 'mano' && puoMuovere(t) && suoTurno(t) && !(isDM() && e.altKey) && movimentoDi(t).resta < 1.49) { avvisoFermo(t); return; }
      if (t && T.tool !== 'mano' && puoMuovere(t)) { T.drag = { id: t.id, dx: p.x - t.x, dy: p.y - t.y, x0: da ? da.x0 : t.x, y0: da ? da.y0 : t.y, sx: e.clientX, sy: e.clientY, mosso: false }; el.classList.add('drag'); return; }
      if (t && T.tool !== 'mano') T.clic = { id: t.id, sx: e.clientX, sy: e.clientY };
      pan = { sx: e.clientX, sy: e.clientY, x: T.view.x, y: T.view.y }; st.classList.add('pan');
      // tenendo premuto senza muoversi compare il segnale, anche sugli schermi degli altri (il DM con Maiusc li porta tutti lì)
      clearTimeout(T.pingT); const dm = isDM() && e.shiftKey;
      T.pingT = setTimeout(() => { if (!pan || punti.size !== 1) return; pan = null; T.clic = null; st.classList.remove('pan'); faiPing(p, dm); }, 450);
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
      if (T.mdown || T.mgom) { muoviMuro(p, e); return; }
      if (T.dif) { muoviDif(p); return; }
      if (T.efm) { muoviEff(p); return; }
      if (T.sgm) { muoviSegn(p, e); return; }
      if (T.gd) { const sc = scena(); sc.griglia_x = T.gd.x; sc.griglia_y = T.gd.y; spostaGriglia((e.clientX - T.gd.sx) / T.view.z, (e.clientY - T.gd.sy) / T.view.z); return; }
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
        righelloTrascina(d);
        if (nebbiaQui(scena())) { cancelAnimationFrame(T.vraf); T.vraf = requestAnimationFrame(disegnaToken); }
        const now = Date.now(); if (now - ultimo > 50) { ultimo = now; manda('trascina', { id: d.id, x: d.x, y: d.y }); }
        return;
      }
      if (pan && Math.hypot(e.clientX - pan.sx, e.clientY - pan.sy) > 6) clearTimeout(T.pingT);
      if (pan) { T.view.x = pan.x + e.clientX - pan.sx; T.view.y = pan.y + e.clientY - pan.sy; applicaVista(); if (T.clic && Math.hypot(e.clientX - T.clic.sx, e.clientY - T.clic.sy) > 5) T.clic = null; }
    });
    const su = async e => {
      if (!punti.has(e.pointerId)) return;
      punti.delete(e.pointerId); clearTimeout(T.pingT);
      if (pinch) { if (punti.size < 2) pinch = null; return; }
      st.classList.remove('pan'); pan = null;
      if (mas) { const m = mas; mas = null; fineMaschera(m); return; }
      if (T.gd) { T.gd = null; return; }
      if (T.dif) { fineDif(); return; }
      if (T.efm) { fineEff(); return; }
      if (T.sgm) { fineSegn(); return; }
      if (T.mdown || T.mgom) { if (e.type === 'pointerup') fineMuro(mondo(st, e), e); else T.mdown = T.mgom = null; return; }
      if (T.al) { const a = T.al; T.al = null; fineAllinea(a).catch(err => toast(err.message, 'err')); return; }
      if (rul) { rul = fineRighello(rul); return; }
      if (T.clic) { const c = T.clic; T.clic = null; if (e.type === 'pointerup') menuToken(c.id, e); }
      if (T.drag) {
        const d = T.drag; T.drag = null; const el = tokEl(d.id), t = T.tok.get(d.id);
        if (el) el.classList.remove('drag');
        if (!t) return;
        if (!d.mosso) {
          if (t.x !== d.x0 || t.y !== d.y0) { const cm = costoMov(t, d.x0, d.y0, t.x, t.y); if (cm.m) return chiediPasso(t, t.x, t.y, d.x0, d.y0, cm.m, cm.dif); }
          if (e.type === 'pointerup') menuToken(t.id, e); return;
        }
        const sc = scena(); let x = aggancia(d.x, sc.griglia_x, t.misura), y = aggancia(d.y, sc.griglia_y, t.misura);
        const via = () => { if (T.rulers.has('io')) { mostraRighello(null); manda('righello', { uid: T.me.uid, pts: null }); } };
        const lib = postoLibero(t, x, y); if (!lib) { via(); t.x = d.x0; t.y = d.y0; disegnaToken(); manda('trascina', { id: t.id, x: d.x0, y: d.y0 }); return; }
        x = lib.x; y = lib.y;
        // con la nebbia automatica i giocatori non passano attraverso i muri (né le porte chiuse)
        const l = t.misura * sc.griglia;
        if (!isDM() && sc.visuale && attraversa(sc, d.x0 + l / 2, d.y0 + l / 2, x + l / 2, y + l / 2)) { t.x = d.x0; t.y = d.y0; disegnaToken(); via(); manda('trascina', { id: t.id, x: d.x0, y: d.y0 }); toast('C\'è un muro in mezzo: fai il giro.', 'err'); return; }
        // nel suo turno il movimento (in caselle, come col righello) si conferma e poi si scala dalla scheda
        const cm = suoTurno(t) ? costoMov(t, d.x0, d.y0, x, y) : { m: 0, dif: 0 }, m = cm.m;
        if (m) {
          const mv = movimentoDi(t);
          const conScatto = puoScattare(t) && m <= mv.resta + velocitaDi(schedaDi(t)) + 0.01; // oltre il movimento, ma con lo Scatto ci arriva
          if (!(isDM() && e.altKey) && !conScatto && m > mv.resta + 0.01) { tornaIndietro(t, d.x0, d.y0); mostraRighello(null); manda('righello', { uid: T.me.uid, pts: null }); toast(`Troppo lontano: ${t.nome || 'il token'} ha ancora ${metri(Math.max(mv.resta, 0))} di movimento.`, 'err'); return; }
          t.x = x; t.y = y; disegnaToken(); manda('trascina', { id: t.id, x, y });
          return chiediPasso(t, x, y, d.x0, d.y0, m, cm.dif);
        }
        mostraRighello(null); manda('righello', { uid: T.me.uid, pts: null });
        t.x = x; t.y = y; disegnaToken(); manda('trascina', { id: t.id, x, y });
        salvaPosto(t, x, y, d.x0, d.y0);
      }
    };
    st.addEventListener('pointerup', su); st.addEventListener('pointercancel', su);
    // doppio clic su un token: si apre la sua scheda (la propria, per i giocatori, nella sezione accanto alla chat)
    st.addEventListener('dblclick', e => {
      // il palco cattura il puntatore, quindi il bersaglio del doppio clic è il palco: cerco il token sotto il mouse
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('.tv-tok'), t = el && T.tok.get(el.dataset.id), s = t && schedaDi(t); if (!s || T.mira) return;
      e.preventDefault(); chiudiPop();
      if (s === miaScheda() && $('#tv-schc')) return apriSchedaTab(true);
      apriScheda(s.id, t.id);
    });
    // il cerchio del pennello della maschera segue il mouse
    st.addEventListener('pointermove', e => {
      const on = isDM() && T.tool === 'maschera' && T.mforma === 'pennello' && e.pointerType === 'mouse';
      if (!on && !T.pcur) return;
      T.pcur = on ? mondo(st, e) : null; disegnaRighelli();
    });
    st.addEventListener('pointerleave', () => { if (T.pcur || T.mhov) { T.pcur = T.mhov = null; disegnaRighelli(); } });
    // strumento dei muri: il punto agganciato segue il mouse; il tasto destro chiude la serie di muri
    st.addEventListener('pointermove', e => { if (!T.mira?.area || e.pointerType !== 'mouse' || punti.size || !scena()) return; T.mira.p = mondo(st, e); cancelAnimationFrame(T.araf); T.araf = requestAnimationFrame(disegnaArea); });
    st.addEventListener('pointermove', e => { if (!isDM() || T.tool !== 'muri' || T.mdown || T.mgom || e.pointerType !== 'mouse' || !scena()) return; const p = mondo(st, e); T.mhov = T.mtool === 'gomma' ? p : punta(p, e); disegnaRighelli(); });
    st.addEventListener('contextmenu', e => { const sg = isDM() && e.target.closest('.tv-sg'); if (sg) { e.preventDefault(); menuSegnalino(sg.dataset.id, e); return; } if (T.tool === 'muri') { e.preventDefault(); T.mu = null; disegnaRighelli(); } });
    function annullaDrag() { const d = T.drag; if (!d) return; T.drag = null; const t = T.tok.get(d.id); if (t) { disegnaToken(); manda('trascina', { id: t.id, x: t.x, y: t.y }); } }
    function fineRighello(r, subito) {
      if (!r) return null;
      manda('righello', { uid: T.me.uid, pts: null });
      clearTimeout(T.rt); if (subito) mostraRighello(null); else T.rt = setTimeout(() => mostraRighello(null), 1600);
      return null;
    }
  }
  /* ---------- terreno difficile: il DM dipinge le caselle, chi le attraversa spende il doppio ---------- */
  const difScena = sc => Array.isArray(sc?.difficile) ? sc.difficile : [];
  const casella = (sc, x, y) => [Math.floor((x - sc.griglia_x) / sc.griglia), Math.floor((y - sc.griglia_y) / sc.griglia)];
  function disegnaDifficile() {
    const sc = scena(), g = $('#tv-dif'); if (!sc || !g) return;
    const set = new Set(difScena(sc)); if (T.dif) for (const k of T.dif.celle) T.dif.togli ? set.delete(k) : set.add(k);
    const q = sc.griglia, ox = sc.griglia_x, oy = sc.griglia_y, w = q / 4;
    const celle = [...set].map(k => { const [c, r] = k.split(',').map(Number); return `<rect x="${ox + c * q}" y="${oy + r * q}" width="${q}" height="${q}"/>`; }).join('');
    // il bordo segue solo il contorno della zona: un tratto scuro sotto e uno arancio sopra, si vede su ogni mappa
    const bordi = [];
    for (const k of set) {
      const [c, r] = k.split(',').map(Number), x = ox + c * q, y = oy + r * q;
      if (!set.has(`${c},${r - 1}`)) bordi.push(`M${x} ${y}h${q}`); if (!set.has(`${c},${r + 1}`)) bordi.push(`M${x} ${y + q}h${q}`);
      if (!set.has(`${c - 1},${r}`)) bordi.push(`M${x} ${y}v${q}`); if (!set.has(`${c + 1},${r}`)) bordi.push(`M${x + q} ${y}v${q}`);
    }
    const lb = Math.max(2.5, q / 20), d = bordi.join('');
    g.innerHTML = set.size ? `<defs><pattern id="tv-difp" width="${w}" height="${w}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="${w}" height="${w}" fill="#e08a1e" fill-opacity=".38"/><path d="M${w * .3} 0V${w}" stroke="#2a1404" stroke-opacity=".85" stroke-width="${w * .28}"/><path d="M${w * .62} 0V${w}" stroke="#ffd27a" stroke-opacity=".5" stroke-width="${Math.max(1, q / 60)}"/></pattern></defs><g fill="url(#tv-difp)">${celle}</g><path d="${d}" fill="none" stroke="#1b0d02" stroke-opacity=".8" stroke-width="${lb * 2}" stroke-linecap="square"/><path d="${d}" fill="none" stroke="#ffb02e" stroke-width="${lb}" stroke-linecap="square"/>` : '';
  }
  function celleDif(p) {
    const sc = scena(), [c, r] = casella(sc, p.x, p.y), n = T.dpenn || 1, h = Math.floor((n - 1) / 2), out = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) out.push(`${c - h + i},${r - h + j}`);
    return out;
  }
  function inizioDif(p) { const sc = scena(); T.dif = { togli: T.dmodo === 'togli', celle: new Set(), a: casella(sc, p.x, p.y) }; muoviDif(p); }
  function muoviDif(p) {
    const d = T.dif, sc = scena(); if (!d || !sc) return;
    if (T.dforma === 'rett') { const [c, r] = casella(sc, p.x, p.y); d.celle = new Set(); for (let i = Math.min(c, d.a[0]); i <= Math.max(c, d.a[0]); i++) for (let j = Math.min(r, d.a[1]); j <= Math.max(r, d.a[1]); j++) d.celle.add(i + ',' + j); }
    else celleDif(p).forEach(k => d.celle.add(k));
    cancelAnimationFrame(T.draf); T.draf = requestAnimationFrame(disegnaDifficile);
  }
  function fineDif() {
    const d = T.dif, sc = scena(); T.dif = null; if (!d || !sc) return;
    const set = new Set(difScena(sc)); for (const k of d.celle) d.togli ? set.delete(k) : set.add(k);
    salvaZone(sc, { difficile: [...set] });
  }
  // terreno difficile ed effetti stanno nella mappa (tavolo/tappa-8.sql): li vedono tutti, li cambia il DM
  async function salvaZone(sc, ch) {
    const prima = { difficile: sc.difficile, effetti: sc.effetti }; Object.assign(sc, ch); disegnaDifficile(); disegnaEffetti(); barraMaschera();
    const r = await SB.from('tavolo_scene').update(ch).eq('id', sc.id);
    if (r.error) { Object.assign(sc, prima); disegnaDifficile(); disegnaEffetti(); barraMaschera(); toast(/difficile|effetti|column/i.test(r.error.message) ? 'Per terreno difficile ed effetti esegui tavolo/tappa-8.sql in Supabase.' : r.error.message, 'err'); }
  }
  function barraDifficile(b) {
    const bt = (k, v, l, sel, tip) => `<button type="button" data-d="${k}" data-v="${v}" class="${sel ? 'on' : ''}" title="${esc(tip || l)}"><span>${l}</span></button>`;
    const n = difScena(scena()).length;
    b.innerHTML = `<div class="g"><b class="tit">🪨 Terreno difficile</b><span class="avv">Dipingi le caselle: chi le attraversa spende il doppio del movimento.</span></div>
      <div class="g seg">${bt('modo', 'metti', 'Dipingi', T.dmodo !== 'togli')}${bt('modo', 'togli', 'Cancella', T.dmodo === 'togli')}</div>
      <div class="g seg">${bt('forma', 'penn', 'Pennello', T.dforma !== 'rett')}${bt('forma', 'rett', 'Rettangolo', T.dforma === 'rett', 'Trascina per riempire un rettangolo di caselle')}</div>
      ${T.dforma !== 'rett' ? `<div class="g seg">${[1, 2, 3].map(k => bt('penn', k, k + '×' + k, (T.dpenn || 1) === k, `Pennello di ${k}×${k} caselle`)).join('')}</div>` : ''}
      <div class="g"><button type="button" data-d="svuota"${n ? '' : ' disabled'}><span>Svuota (${n})</span></button></div>`;
    b.classList.remove('spenta'); b.hidden = false;
    b.querySelectorAll('[data-d]').forEach(x => x.onclick = async () => {
      const k = x.dataset.d, v = x.dataset.v;
      if (k === 'modo') T.dmodo = v; if (k === 'forma') T.dforma = v; if (k === 'penn') T.dpenn = +v;
      if (k === 'svuota') { if (!await ask('Togliere tutto il terreno difficile da questa mappa?', { ok: 'Svuota', danger: true, title: 'Terreno difficile' })) return; return salvaZone(scena(), { difficile: [] }); }
      barraDifficile(b);
    });
  }
  // quanto costa uno spostamento, casella per casella come il righello: in quelle difficili si spende il doppio
  function costoMov(t, x0, y0, x, y) {
    const sc = scena(); if (!sc) return { m: 0, dif: 0 };
    const q = sc.griglia, mt = sc.metri || 1.5, set = new Set(difScena(sc)), n = Math.max(1, Math.round(t.misura || 1));
    const c0 = Math.round((x0 - sc.griglia_x) / q), r0 = Math.round((y0 - sc.griglia_y) / q), dc = Math.round((x - x0) / q), dr = Math.round((y - y0) / q), passi = Math.max(Math.abs(dc), Math.abs(dr));
    let m = 0, dif = 0;
    for (let i = 1; i <= passi; i++) {
      const c = c0 + Math.round(dc * i / passi), r = r0 + Math.round(dr * i / passi);
      let d = false; if (set.size) for (let a = 0; a < n && !d; a++) for (let b = 0; b < n && !d; b++) d = set.has(`${c + a},${r + b}`);
      m += d ? 2 * mt : mt; if (d) dif++;
    }
    return { m: Math.round(m * 10) / 10, dif };
  }

  /* ---------- effetti sulla mappa: zone animate di fuoco, gas, veleno… che il DM piazza e ridimensiona ---------- */
  const EFFETTI = {
    fuoco: ['🔥', 'Fuoco', '#ff7a1a', '#ffd23a', '#c2260f'], gas: ['☁', 'Gas', '#b9c79a', '#e7eed2', '#7d8a5c'], veleno: ['☠', 'Veleno', '#6fcf4a', '#c8ff7a', '#2f6b1d'],
    acido: ['🧪', 'Acido', '#b8e03a', '#f2ff8a', '#5c7a10'], ghiaccio: ['❄', 'Ghiaccio', '#8fdcff', '#ffffff', '#3b8fc7'], fulmine: ['⚡', 'Fulmini', '#ffe45c', '#ffffff', '#7a6cff'],
    nebbia: ['🌫', 'Nebbia', '#d8dde3', '#ffffff', '#8a939c'], oscurita: ['🌑', 'Oscurità', '#1a1420', '#3a2f4a', '#000000']
  };
  const effScena = sc => Array.isArray(sc?.effetti) ? sc.effetti : [];
  // durata in round: l'effetto finisce quando torna il turno in cui è stato messo, dopo «durata» round
  const posTurno = id => ordinati().findIndex(x => x.id === id);
  function roundRestanti(e) {
    if (!(+e.durata > 0)) return null;
    const fine = (+e.inizio?.round || 1) + +e.durata, ora = +T.stato?.round || 1;
    const passato = !e.inizio?.turno || !T.stato?.turno || posTurno(T.stato.turno) >= Math.max(0, posTurno(e.inizio.turno));
    return ora > fine || (ora === fine && passato) ? 0 : Math.max(1, fine - ora);
  }
  const scaduto = e => roundRestanti(e) === 0;
  function scadenzeEffetti() {
    if (!isDM()) return;
    for (const sc of T.scene.values()) {
      const L = effScena(sc), via = L.filter(scaduto); if (!via.length) continue;
      salvaZone(sc, { effetti: L.filter(e => !scaduto(e)) });
      toast(`Finito: ${via.map(e => (EFFETTI[e.tipo] || EFFETTI.fuoco).slice(0, 2).join(' ')).join(', ')} (durata scaduta).`);
    }
  }
  const raggioPx = (sc, e) => (+e.m || 3) * sc.griglia / (sc.metri || 1.5);
  // intensità in percentuale (100 = come prima): moltiplica l'opacità di fondo e particelle, fino a coprire del tutto
  const intEff = e => clamp(+e.int || 100, 10, 400) / 100;
  // numeri «a caso» ma sempre uguali per lo stesso effetto, così ridisegnandolo non salta
  const semeDi = id => { let h = 2166136261; for (const c of String(id)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296; };
  function svgEffetto(sc, e, sel) {
    const [, , c1, c2, c3] = EFFETTI[e.tipo] || EFFETTI.fuoco, R = raggioPx(sc, e), rnd = semeDi(e.id), id = 'ef' + String(e.id).replace(/\W/g, '');
    const quad = e.forma === 'quadrato', forma = quad ? `<rect x="${e.x - R}" y="${e.y - R}" width="${2 * R}" height="${2 * R}" rx="${R * 0.06}"/>` : `<circle cx="${e.x}" cy="${e.y}" r="${R}"/>`;
    const n = Math.round(clamp(R * R / 700, 8, 70)), parti = [], scuro = e.tipo === 'oscurita', nube = e.tipo === 'gas' || e.tipo === 'nebbia', ki = intEff(e), op = o => Math.min(1, o * ki).toFixed(2);
    // le particelle si animano in opacità (l'animazione vince sull'attributo): l'intensità le abbassa dal gruppo
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * R * 0.92, x = e.x + Math.cos(a) * d, y = e.y + Math.sin(a) * d, k = (0.6 + rnd() * 0.8) * 1.5, del = -(rnd() * 3).toFixed(2);
      if (e.tipo === 'fuoco') parti.push(`<path class="pf" style="--d:${(R * 0.2 * k).toFixed(1)}px;animation-delay:${del}s;animation-duration:${(1 + rnd()).toFixed(2)}s" d="M${x} ${y}q${-8 * k} ${-10 * k} 0 ${-26 * k}q${8 * k} ${16 * k} 0 ${26 * k}z" fill="${rnd() < 0.5 ? c2 : c1}"/>`);
      else if (nube || scuro) parti.push(`<circle class="pg" style="--dx:${((rnd() - .5) * R * 0.35).toFixed(1)}px;--dy:${((rnd() - .5) * R * 0.35).toFixed(1)}px;animation-delay:${del * 2}s;animation-duration:${(6 + rnd() * 5).toFixed(1)}s" cx="${x}" cy="${y}" r="${(R * (0.16 + rnd() * 0.2)).toFixed(1)}" fill="${rnd() < 0.5 ? c1 : c3}" opacity="${scuro ? .9 : .5}"/>`);
      else if (e.tipo === 'veleno' || e.tipo === 'acido') parti.push(`<circle class="pb" style="--d:${(R * 0.14 * k).toFixed(1)}px;animation-delay:${del}s;animation-duration:${(1.4 + rnd() * 1.4).toFixed(2)}s" cx="${x}" cy="${y}" r="${((3 + rnd() * 6) * k).toFixed(1)}" fill="${c1}" fill-opacity=".35" stroke="${c2}" stroke-width="2.5"/>`);
      else if (e.tipo === 'ghiaccio') parti.push(`<path class="pi" style="animation-delay:${del}s" d="M${x} ${y - 10 * k}l${4 * k} ${10 * k} ${-4 * k} ${10 * k} ${-4 * k} ${-10 * k}z" fill="${c2}" transform="rotate(${(rnd() * 360).toFixed(0)} ${x} ${y})"/>`);
      else if (e.tipo === 'fulmine' && i < n / 3) { let px = x, py = y - R * 0.3, dd = `M${px} ${py}`; for (let j = 0; j < 5; j++) { px += (rnd() - .5) * 34; py += 9 + rnd() * 14; dd += `L${px.toFixed(1)} ${py.toFixed(1)}`; } parti.push(`<path class="pl" style="animation-delay:${del}s;animation-duration:${(0.9 + rnd() * 1.6).toFixed(2)}s" d="${dd}" fill="none" stroke="${rnd() < .5 ? c1 : c2}" stroke-width="${((2 + rnd() * 2) * 1.5).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/>`); }
    }
    // niente fusioni di colore né sfocature sul bordo: su Safari pesano tanto da far sparire anche i token
    const bordo = Math.max(3, R * 0.025);
    const st = scuro ? [.95, .92, .9] : nube ? [.6, .55, .5] : [.85, .7, .6];
    return `<g class="ef ef-${e.tipo}${sel ? ' sel' : ''}" data-id="${esc(e.id)}"><defs><clipPath id="${id}c">${forma}</clipPath><radialGradient id="${id}g"><stop offset="0" stop-color="${c2}" stop-opacity="${op(st[0])}"/><stop offset=".55" stop-color="${c1}" stop-opacity="${op(st[1])}"/><stop offset="1" stop-color="${c3}" stop-opacity="${op(st[2])}"/></radialGradient><filter id="${id}f" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${(R * 0.06).toFixed(1)}"/></filter></defs>
      ${forma.replace('/>', ` fill="none" stroke="${c1}" stroke-width="${(bordo * 4).toFixed(1)}" opacity="${op(.25)}"/>`)}${forma.replace('/>', ` fill="none" stroke="${c1}" stroke-width="${(bordo * 2.2).toFixed(1)}" opacity="${op(.4)}"/>`)}
      <g clip-path="url(#${id}c)"><g class="base">${forma.replace('/>', ` fill="url(#${id}g)"/>`)}</g><g opacity="${Math.min(1, ki).toFixed(2)}"${nube || scuro ? ` filter="url(#${id}f)"` : ''}>${parti.join('')}</g></g>
      ${forma.replace('/>', ` fill="none" stroke="${scuro ? c2 : c1}" stroke-width="${bordo.toFixed(1)}" opacity="${op(.95)}"/>`)}
      ${roundRestanti(e) ? `<text class="dur" x="${e.x}" y="${e.y + R + Math.max(16, sc.griglia * 0.28)}" text-anchor="middle">⏳ ${roundRestanti(e)} round</text>` : ''}
      ${sel ? `<g class="sel">${forma.replace('/>', ' fill="none" stroke="#f2b51d" stroke-width="3" stroke-dasharray="10 6"/>')}<circle class="man" cx="${e.x + R}" cy="${e.y}" r="${Math.max(8, sc.griglia * 0.14)}"/><text x="${e.x + R + 14}" y="${e.y - 12}">${String((+e.m || 3).toLocaleString('it-IT'))} m</text></g>` : ''}</g>`;
  }
  function disegnaEffetti() {
    const sc = scena(), g = $('#tv-efx'); if (!sc || !g) return;
    const L = (T.efm?.l || effScena(sc)).filter(e => !scaduto(e)), sel = isDM() && T.tool === 'effetti' ? T.efSel : null;
    g.classList.toggle('fermo', !animazioni());
    g.innerHTML = L.map(e => svgEffetto(sc, e, e.id === sel)).join('');
  }
  function effettoIn(sc, p) {
    const L = effScena(sc);
    for (let i = L.length - 1; i >= 0; i--) { const e = L[i], R = raggioPx(sc, e), dx = p.x - e.x, dy = p.y - e.y; if (e.forma === 'quadrato' ? Math.abs(dx) <= R && Math.abs(dy) <= R : Math.hypot(dx, dy) <= R) return e; }
    return null;
  }
  function inizioEff(p) {
    const sc = scena(); if (!sc) return;
    const sel = effScena(sc).find(e => e.id === T.efSel);
    // la maniglia sul bordo dell'effetto scelto lo allarga o lo stringe
    if (sel && Math.hypot(p.x - (sel.x + raggioPx(sc, sel)), p.y - sel.y) <= Math.max(14, sc.griglia * 0.22)) { T.efm = { id: sel.id, modo: 'raggio', l: effScena(sc).map(e => ({ ...e })) }; return; }
    const e = effettoIn(sc, p);
    if (e) { T.efSel = e.id; T.efm = { id: e.id, modo: 'muovi', dx: p.x - e.x, dy: p.y - e.y, l: effScena(sc).map(x => ({ ...x })), mosso: false }; disegnaEffetti(); barraMaschera(); return; }
    const nuovo = { id: nuovoId(), tipo: T.efTipo || 'fuoco', x: Math.round(p.x), y: Math.round(p.y), m: T.efM || 3, forma: T.efForma || 'cerchio', durata: T.efDur || 0, inizio: { round: +T.stato?.round || 1, turno: T.stato?.turno || null }, int: T.efInt || 100 };
    // il nuovo effetto non resta scelto: così il tipo che scegli dopo vale per il prossimo, non cambia questo
    T.efSel = null; salvaZone(sc, { effetti: [...effScena(sc), nuovo] });
  }
  function muoviEff(p) {
    const m = T.efm, sc = scena(); if (!m || !sc) return;
    const e = m.l.find(x => x.id === m.id); if (!e) return;
    if (m.modo === 'raggio') { const passo = (sc.metri || 1.5) / 2; e.m = clamp(Math.round(Math.max(Math.abs(p.x - e.x), Math.abs(p.y - e.y)) / sc.griglia * (sc.metri || 1.5) / passo) * passo, passo, 60); T.efM = e.m; }
    else { e.x = Math.round(p.x - m.dx); e.y = Math.round(p.y - m.dy); m.mosso = true; }
    m.cambiato = true; cancelAnimationFrame(T.eraf); T.eraf = requestAnimationFrame(disegnaEffetti);
  }
  function fineEff() {
    const m = T.efm, sc = scena(); T.efm = null; if (!m || !sc) return;
    if (m.cambiato) salvaZone(sc, { effetti: m.l }); else { disegnaEffetti(); barraMaschera(); }
  }
  function barraEffetti(b) {
    const sc = scena(), L = effScena(sc), sel = L.find(e => e.id === T.efSel) || null, tipo = sel?.tipo || T.efTipo || 'fuoco', m = sel ? +sel.m || 3 : T.efM || 3, forma = sel?.forma || T.efForma || 'cerchio', dur = sel ? +sel.durata || 0 : T.efDur || 0, int = sel ? +sel.int || 100 : T.efInt || 100;
    b.innerHTML = `<div class="g"><b class="tit">✨ Effetti</b><span class="avv">${sel ? 'Stai modificando questo effetto: tipo, raggio e intensità cambiano lui. Trascinalo per spostarlo, il pallino sul bordo cambia la grandezza.' : 'Scegli un effetto e clicca sulla mappa per piazzarlo. Clicca un effetto già messo per modificarlo.'}</span></div>
      <div class="g seg">${Object.entries(EFFETTI).map(([k, [ic, l]]) => `<button type="button" data-e="tipo" data-v="${k}" class="${tipo === k ? 'on' : ''}" title="${l}"><span>${ic} ${l}</span></button>`).join('')}</div>
      <div class="g sl" title="Raggio dell'effetto (metà del lato per il quadrato)"><span>Raggio</span><input type="range" class="tv-rg" data-e="m" min="1.5" max="30" step="1.5" value="${m}" aria-label="Raggio in metri"><output>${m.toLocaleString('it-IT')} m</output></div>
      <div class="g sl" title="Quanto si vede l'effetto: abbassala per un velo leggero, alzala per una nube densa che copre la mappa"><span>Intensità</span><input type="range" class="tv-rg" data-e="int" min="10" max="400" step="10" value="${int}" aria-label="Intensità in percentuale"><output>${int}%</output></div>
      <div class="g sl" title="Quanti round dura: sparisce da sola quando torna il turno in cui l'hai messo. 0 = finché non la togli"><span>Durata</span><input type="number" data-e="dur" min="0" max="999" step="1" value="${dur}" aria-label="Durata in round" style="width:56px"><output>${dur ? (sel && roundRestanti(sel) != null ? `round · ne restano ${roundRestanti(sel)}` : 'round') : 'per sempre'}</output></div>
      <div class="g seg"><button type="button" data-e="forma" data-v="cerchio" class="${forma !== 'quadrato' ? 'on' : ''}"><span>◯ Cerchio</span></button><button type="button" data-e="forma" data-v="quadrato" class="${forma === 'quadrato' ? 'on' : ''}"><span>▢ Quadrato</span></button></div>
      <div class="g">${sel ? '<button type="button" data-e="via"><span>🗑 Togli questo</span></button><button type="button" data-e="desel"><span>Fatto</span></button>' : ''}<button type="button" data-e="svuota"${L.length ? '' : ' disabled'}><span>Svuota (${L.length})</span></button></div>`;
    b.classList.remove('spenta'); b.hidden = false;
    const cambia = ch => salvaZone(sc, { effetti: effScena(sc).map(e => e.id === sel.id ? { ...e, ...ch } : e) });
    b.querySelectorAll('button[data-e]').forEach(x => x.onclick = async () => {
      const k = x.dataset.e, v = x.dataset.v;
      if (k === 'tipo') { T.efTipo = v; if (sel) return cambia({ tipo: v }); }
      if (k === 'forma') { T.efForma = v; if (sel) return cambia({ forma: v }); }
      if (k === 'via' && sel) { T.efSel = null; return salvaZone(sc, { effetti: L.filter(e => e.id !== sel.id) }); }
      if (k === 'desel') { T.efSel = null; disegnaEffetti(); }
      if (k === 'svuota') { if (!await ask('Togliere tutti gli effetti da questa mappa?', { ok: 'Svuota', danger: true, title: 'Effetti' })) return; T.efSel = null; return salvaZone(sc, { effetti: [] }); }
      barraEffetti(b);
    });
    const rg = b.querySelector('[data-e=m]'), out = rg.nextElementSibling;
    rg.oninput = () => { T.efM = +rg.value; out.textContent = (+rg.value).toLocaleString('it-IT') + ' m'; if (sel) { sel.m = +rg.value; disegnaEffetti(); } };
    rg.onchange = () => { if (sel) cambia({ m: +rg.value }); };
    const ri = b.querySelector('[data-e=int]'), oi = ri.nextElementSibling;
    ri.oninput = () => { T.efInt = +ri.value; oi.textContent = ri.value + '%'; if (sel) { sel.int = +ri.value; disegnaEffetti(); } };
    ri.onchange = () => { if (sel) cambia({ int: +ri.value }); };
    b.querySelectorAll('.tv-rg').forEach(pRange);
    // cambiare la durata la fa ripartire da adesso
    const du = b.querySelector('[data-e=dur]');
    du.onchange = () => { const v = clamp(Math.round(+du.value || 0), 0, 999); T.efDur = v; if (sel) return cambia({ durata: v, inizio: { round: +T.stato?.round || 1, turno: T.stato?.turno || null } }); barraEffetti(b); };
  }

  /* ---------- segnalini sulla mappa (bauli, porte, trappole…) e segnale col mouse ---------- */
  // le icone sono disegnate (tratti su 24×24): uguali su ogni computer e telefono, a differenza delle emoji
  const sgi = d => `<svg class="sgi" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const SEGNI = {
    punto: [sgi('<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>'), 'Punto d\'interesse', '#c0392b'],
    baule: [sgi('<path d="M4 11h16v8H4zM4 11V9a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v2"/><path d="M10.5 11v3h3v-3"/>'), 'Baule', '#a0662b'],
    tesoro: [sgi('<path d="M9 5h6l-1.5 3h-3zM10.5 8C6 10 4.5 13.5 5 16c.5 2.5 3 3.5 7 3.5s6.5-1 7-3.5c.5-2.5-1-6-5.5-8"/><path d="M13.5 12.5c-.5-.7-1.3-1-2-.8-.9.3-1 1.4 0 1.8l1 .4c1 .4.9 1.6 0 1.8-.8.2-1.6-.1-2-.8M12 11v.7M12 16.3v.7"/>'), 'Tesoro', '#c99a17'],
    porta: [sgi('<path d="M6 20V9a6 6 0 0 1 12 0v11M4 20h16"/><path d="M12 3v17"/><circle cx="14.5" cy="13" r=".6" fill="currentColor"/>'), 'Porta', '#8a5a2b'],
    segreta: [sgi('<path d="M3.5 5h17v14h-17zM3.5 9.7h17M3.5 14.3h17M9 5v4.7M15 9.7v4.6M9 14.3V19"/>'), 'Porta segreta', '#6f6a62'],
    chiave: [sgi('<circle cx="8" cy="8" r="4"/><path d="M11 11l8.5 8.5M16 16l2-2M18.5 18.5l2-2"/>'), 'Chiave', '#b8902e'],
    leva: [sgi('<path d="M5 19h14M8 19a4 4 0 0 1 8 0"/><path d="M12 15L17 5"/><circle cx="17.5" cy="4.5" r="2"/>'), 'Leva o meccanismo', '#5b6b7a'],
    trappola: [sgi('<path d="M3 15a9 9 0 0 1 18 0"/><path d="M3 15l2-2.5 2 2 2-3 2 3 2-3 2 3 2-2 2 2.5"/><path d="M2 18h20"/>'), 'Trappola', '#d35400'],
    pericolo: [sgi('<path d="M12 3.5L21.5 20h-19z"/><path d="M12 9.5v5M12 17.3v.4"/>'), 'Pericolo', '#3d3d3d'],
    fossa: [sgi('<ellipse cx="12" cy="13" rx="8.5" ry="5"/><path d="M6 13c1.5 2 3.5 3 6 3s4.5-1 6-3" fill="currentColor" fill-opacity=".35"/>'), 'Botola o fossa', '#4a3b30'],
    scale: [sgi('<path d="M4 20h4v-4h4v-4h4V8h4V4"/>'), 'Scale', '#4f6d8a'],
    indizio: [sgi('<path d="M7 4h11a2 2 0 0 1 0 4h-1v10a2 2 0 0 1-2 2H6a2 2 0 0 1 0-4h1z"/><path d="M10 9h4M10 12.5h4"/>'), 'Indizio o nota', '#9c7b45'],
    pozione: [sgi('<path d="M10 3h4M10.5 3v5L5.5 17a2.5 2.5 0 0 0 2.2 3.5h8.6a2.5 2.5 0 0 0 2.2-3.5L13.5 8V3"/><path d="M7.5 14h9"/>'), 'Pozione o alchimia', '#3a9a6a'],
    magia: [sgi('<path d="M12 3l1.8 5.7L19.5 10.5l-5.7 1.8L12 18l-1.8-5.7L4.5 10.5l5.7-1.8z"/><path d="M18.5 16.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>'), 'Magia o runa', '#7d4fc0'],
    altare: [sgi('<path d="M10 9h4v8h-4zM6 20h12M7.5 17h9v3h-9z"/><path d="M12 3.5c1.2 1.3 1.5 2.4.9 3.3a1.1 1.1 0 0 1-1.8 0c-.6-.9-.3-2 .9-3.3z"/>'), 'Altare o santuario', '#8f6c3e'],
    fuoco: [sgi('<path d="M12 3c1 3 4.5 4.5 4.5 9a4.5 4.5 0 0 1-9 0c0-2 1-3.5 2.2-4.5 0 2 1 3 2 3.2C11.2 8 11 5.5 12 3z"/><path d="M5 20l14-3M5 17l14 3"/>'), 'Falò o accampamento', '#d2601a'],
    acqua: [sgi('<path d="M12 3.5S6 10 6 14a6 6 0 0 0 12 0c0-4-6-10.5-6-10.5z"/><path d="M9.5 14.5a2.6 2.6 0 0 0 2.5 2.5"/>'), 'Fonte o acqua', '#2f7fc1'],
    cadavere: [sgi('<path d="M12 3.5a7 7 0 0 0-7 7c0 2.3 1 3.8 2.5 4.8V19h9v-3.7c1.5-1 2.5-2.5 2.5-4.8a7 7 0 0 0-7-7z"/><circle cx="9.3" cy="11" r="1.5"/><circle cx="14.7" cy="11" r="1.5"/><path d="M10.5 19v-2M13.5 19v-2"/>'), 'Resti o cadavere', '#6b6058'],
    png: [sgi('<path d="M4 5h16v10H10l-4 4v-4H4z"/><path d="M8 9.5h8M8 12h5"/>'), 'Personaggio da incontrare', '#2e8b8b'],
    obiettivo: [sgi('<path d="M6 21V4M6 4h11l-2.5 4L17 12H6"/>'), 'Obiettivo o uscita', '#2f8f3a']
  };
  const segnaliniScena = sc => (T.segn || []).filter(x => x.scena === sc.id);
  function disegnaSegnalini() {
    const box = $('#tv-segn'), sc = scena(); if (!box || !sc) return;
    const L = T.sgm?.l || segnaliniScena(sc), s = Math.max(34, sc.griglia * 0.72), sel = isDM() && T.tool === 'segni' ? T.sgSel : null;
    box.innerHTML = L.filter(x => isDM() || !x.nascosto).map(x => {
      const [ic, l, c] = SEGNI[x.tipo] || SEGNI.punto, tip = (x.nome || l) + (isDM() ? (x.nascosto ? ' · nascosto ai giocatori' : ' · lo vedono i giocatori') + ' · tasto destro: rivela, nascondi o togli' : '');
      return `<div class="tv-sg${x.nascosto ? ' nasc' : ''}${x.id === sel ? ' sel' : ''}${x.id === T.sgApp && animazioni() ? ' app' : ''}" data-id="${x.id}" style="left:${x.x}px;top:${x.y}px;--s:${s}px;--c:${c}" data-tip="${esc(tip)}"><span class="gt">${ic}</span>${x.nome ? `<span class="nm">${esc(x.nome)}</span>` : ''}${x.nascosto && isDM() ? `<i class="ns">${svg('velo')}</i>` : ''}</div>`;
    }).join('');
    T.sgApp = null;
  }
  async function nuovoSegnalino(sc, p) {
    const r = await SB.from('tavolo_segnalini').insert({ scena: sc.id, tipo: T.sgTipo || 'punto', x: Math.round(p.x), y: Math.round(p.y), nascosto: T.sgNasc !== false }).select().single();
    if (r.error) return toast(r.error.message, 'err');
    if (!T.segn.some(x => x.id === r.data.id)) T.segn.push(r.data);
    disegnaSegnalini(); barraMaschera();
  }
  async function cambiaSegnalino(x, ch) {
    const prima = { ...x }; Object.assign(x, ch); disegnaSegnalini(); if (T.tool === 'segni') barraMaschera();
    if (ch.nascosto) manda('segnalino', { id: x.id });
    const r = await SB.from('tavolo_segnalini').update(ch).eq('id', x.id);
    if (r.error) { Object.assign(x, prima); disegnaSegnalini(); if (T.tool === 'segni') barraMaschera(); toast(r.error.message, 'err'); }
  }
  async function togliSegnalini(ids) {
    const via = T.segn.filter(x => ids.includes(x.id)); if (!via.length) return;
    T.segn = T.segn.filter(x => !ids.includes(x.id)); if (ids.includes(T.sgSel)) T.sgSel = null;
    disegnaSegnalini(); if (T.tool === 'segni') barraMaschera(); ids.forEach(id => manda('segnalino', { id }));
    const r = await SB.from('tavolo_segnalini').delete().in('id', ids);
    if (r.error) { T.segn.push(...via); disegnaSegnalini(); if (T.tool === 'segni') barraMaschera(); toast(r.error.message, 'err'); }
  }
  function inizioSegn(p, e) {
    const sc = scena(); if (!sc) return;
    if (!T.segn) return toast('Per i segnalini esegui tavolo/tappa-11.sql in Supabase.', 'err');
    const el = e.target.closest('.tv-sg'), x = el && T.segn.find(y => y.id === el.dataset.id);
    if (x) { T.sgSel = x.id; T.sgm = { id: x.id, dx: p.x - x.x, dy: p.y - x.y, sx: e.clientX, sy: e.clientY, l: segnaliniScena(sc).map(y => ({ ...y })), mosso: false }; disegnaSegnalini(); barraMaschera(); return; }
    // clic sul vuoto: un segnalino nuovo del tipo scelto (quello scelto prima resta com'è)
    T.sgSel = null; nuovoSegnalino(sc, p);
  }
  function muoviSegn(p, e) {
    const m = T.sgm; if (!m) return;
    if (!m.mosso && Math.hypot(e.clientX - m.sx, e.clientY - m.sy) < 4) return;
    const x = m.l.find(y => y.id === m.id); if (!x) return;
    m.mosso = true; x.x = Math.round(p.x - m.dx); x.y = Math.round(p.y - m.dy);
    const el = $(`#tv-segn .tv-sg[data-id="${m.id}"]`); if (el) { el.style.left = x.x + 'px'; el.style.top = x.y + 'px'; }
  }
  function fineSegn() {
    const m = T.sgm; T.sgm = null; if (!m) return;
    const n = m.l.find(y => y.id === m.id), x = T.segn?.find(y => y.id === m.id);
    if (m.mosso && n && x) cambiaSegnalino(x, { x: n.x, y: n.y }); else disegnaSegnalini();
  }
  function barraSegnalini(b) {
    const sc = scena();
    if (!T.segn) { b.innerHTML = '<div class="g"><b class="tit">📍 Segnalini</b><span class="avv">Per usarli esegui <b>tavolo/tappa-11.sql</b> nell\'SQL Editor di Supabase, poi ricarica la pagina.</span></div>'; b.classList.remove('spenta'); b.hidden = false; return; }
    const L = segnaliniScena(sc), sel = L.find(x => x.id === T.sgSel) || null, tipo = sel?.tipo || T.sgTipo || 'punto', nasc = sel ? sel.nascosto : T.sgNasc !== false, quanti = L.filter(x => x.nascosto).length;
    b.innerHTML = `<div class="g"><b class="tit">📍 Segnalini</b><span class="avv">${sel ? 'Stai modificando questo segnalino: il tipo e il nome cambiano lui. Trascinalo per spostarlo.' : 'Scegli un segnalino e clicca sulla mappa per metterlo. Clicca un segnalino già messo per modificarlo, tasto destro per rivelarlo o toglierlo.'}</span></div>
      <div class="g seg sgt">${Object.entries(SEGNI).map(([k, [ic, l]]) => `<button type="button" data-s="tipo" data-v="${k}" class="${tipo === k ? 'on' : ''}" data-tip="${esc(l)}" aria-label="${esc(l)}"><span>${ic}</span></button>`).join('')}</div>
      <div class="g"><b class="tit">${(SEGNI[tipo] || SEGNI.punto)[0]} ${esc((SEGNI[tipo] || SEGNI.punto)[1])}</b><label class="sw" title="${sel ? 'Se è nascosto lo vedi solo tu' : 'I nuovi segnalini partono nascosti: li riveli quando i giocatori li trovano'}"><input type="checkbox" data-s="nasc" ${nasc ? 'checked' : ''}><span class="tg" aria-hidden="true"></span>${sel ? 'Nascosto ai giocatori' : 'Mettili nascosti ai giocatori'}</label></div>
      ${sel ? `<div class="g sl"><span>Nome</span><input type="text" data-s="nome" maxlength="120" value="${esc(sel.nome || '')}" placeholder="${esc((SEGNI[sel.tipo] || SEGNI.punto)[1])}" aria-label="Nome del segnalino" style="width:170px"></div>` : ''}
      <div class="g">${sel ? '<button type="button" data-s="via"><span>🗑 Togli questo</span></button><button type="button" data-s="desel"><span>Fatto</span></button>' : ''}<button type="button" data-s="rivela"${quanti ? '' : ' disabled'} title="Rivela ai giocatori tutti i segnalini nascosti di questa mappa"><span>👁 Rivela tutti (${quanti})</span></button><button type="button" data-s="svuota"${L.length ? '' : ' disabled'}><span>Svuota (${L.length})</span></button></div>`;
    b.classList.remove('spenta'); b.hidden = false;
    b.querySelectorAll('button[data-s]').forEach(x => x.onclick = async () => {
      const k = x.dataset.s, v = x.dataset.v;
      if (k === 'tipo') { T.sgTipo = v; if (sel) return cambiaSegnalino(sel, { tipo: v }); }
      if (k === 'via' && sel) return togliSegnalini([sel.id]);
      if (k === 'desel') { T.sgSel = null; disegnaSegnalini(); }
      if (k === 'rivela') { for (const y of L.filter(y => y.nascosto)) await cambiaSegnalino(y, { nascosto: false }); return; }
      if (k === 'svuota') { if (!await ask('Togliere tutti i segnalini da questa mappa?', { ok: 'Svuota', danger: true, title: 'Segnalini' })) return; return togliSegnalini(L.map(y => y.id)); }
      barraSegnalini(b);
    });
    b.querySelector('[data-s=nasc]').onchange = e => { if (sel) return cambiaSegnalino(sel, { nascosto: e.target.checked }); T.sgNasc = e.target.checked; };
    const nm = b.querySelector('[data-s=nome]');
    if (nm) { nm.onchange = () => cambiaSegnalino(sel, { nome: nm.value.trim().slice(0, 120) }); nm.onkeydown = e => { if (e.key === 'Enter') nm.blur(); }; }
  }
  function menuSegnalino(id, e) {
    const x = T.segn?.find(y => y.id === id), st = $('#tv-stage'); if (!x || !st) return;
    chiudiPop();
    const [ic, l] = SEGNI[x.tipo] || SEGNI.punto, r = st.getBoundingClientRect(), pop = document.createElement('div'); pop.className = 'tv-pop';
    pop.innerHTML = `<b>${ic} ${esc(x.nome || l)}</b><button class="btn sm" data-k="nasc">${x.nascosto ? '👁 Rivela ai giocatori' : '🙈 Nascondi ai giocatori'}</button><button class="btn sm" data-k="mod">✏️ Modifica</button><button class="btn sm danger" data-k="via">Togli il segnalino</button>`;
    st.append(pop);
    pop.style.left = clamp(e.clientX - r.left + 8, 6, r.width - pop.offsetWidth - 6) + 'px'; pop.style.top = clamp(e.clientY - r.top + 8, 6, r.height - pop.offsetHeight - 6) + 'px';
    pop.querySelector('[data-k=nasc]').onclick = () => { chiudiPop(); cambiaSegnalino(x, { nascosto: !x.nascosto }); };
    pop.querySelector('[data-k=mod]').onclick = () => { chiudiPop(); T.sgSel = x.id; if (T.tool !== 'segni') strumento('segni'); else { disegnaSegnalini(); barraMaschera(); } };
    pop.querySelector('[data-k=via]').onclick = () => { chiudiPop(); togliSegnalini([x.id]); };
  }
  function coloreMio() {
    if (isDM()) return '#f2b51d';
    const t = [...T.tok.values()].find(y => y.giocatore && y.giocatore === T.me.giocatore);
    return /^#[0-9a-f]{6}$/i.test(t?.colore || '') ? t.colore : '#3d9bff';
  }
  function faiPing(p, centra) {
    const sc = scena(); if (!sc) return;
    const m = { scena: sc.id, x: Math.round(p.x), y: Math.round(p.y), nome: T.me.nome || '', col: coloreMio(), centra: !!centra };
    mostraPing(m, true); manda('ping', m);
  }
  function mostraPing(m, mio) {
    const w = $('#tv-world'), sc = scena(); if (!w || !sc || m.scena !== sc.id) return;
    // il DM con Maiusc porta lo sguardo di tutti sul punto
    if (m.centra && !mio && !isDM()) { const r = $('#tv-stage')?.getBoundingClientRect(); if (r) { T.view.x = r.width / 2 - m.x * T.view.z; T.view.y = r.height / 2 - m.y * T.view.z; applicaVista(); } }
    const el = document.createElement('div'), c = /^#[0-9a-f]{6}$/i.test(m.col || '') ? m.col : '#3d9bff';
    el.className = 'tv-ping'; el.style.cssText = `left:${+m.x}px;top:${+m.y}px;--c:${c};--r:${Math.max(sc.griglia * 1.2, 60 / T.view.z)}px`;
    el.innerHTML = `<i></i><i></i><i></i>${m.nome && !mio ? `<b>${esc(m.nome)}</b>` : ''}`;
    w.append(el); setTimeout(() => el.remove(), 2700);
  }

  /* ---------- movimento in combattimento: righello mentre si trascina, poi conferma ---------- */
  const RIGT = 'tavolo-righello-trascina';
  const righelloAuto = () => { try { return localStorage.getItem(RIGT) !== 'no'; } catch { return true; } };
  const inCombattimento = () => !!(T.turno?.length && T.stato?.turno);
  function righelloTrascina(d) {
    const sc = scena(), t = T.tok.get(d.id); if (!sc || !t || !inCombattimento() || !righelloAuto()) return;
    const l = t.misura * sc.griglia / 2, x = aggancia(d.x, sc.griglia_x, t.misura), y = aggancia(d.y, sc.griglia_y, t.misura);
    const pts = [{ x: d.x0 + l, y: d.y0 + l }, { x: x + l, y: y + l }];
    let extra = '', ko = false;
    const cm = costoMov(t, d.x0, d.y0, x, y);
    if (cm.dif) extra = `costa ${metri(cm.m)} (terreno difficile)`;
    if (suoTurno(t)) { const m = cm.m, mv = movimentoDi(t); ko = m > mv.resta + 0.01; extra = [cm.dif ? `costa ${metri(m)}, terreno difficile` : '', ko ? `oltre di ${metri(m - mv.resta)}` : `resta ${metri(mv.resta - m)}`].filter(Boolean).join(' · '); }
    T.rulers.set('io', { nome: '', pts, extra, ko }); disegnaRighelli();
    const now = Date.now(); if (now - (d.rt || 0) > 80) { d.rt = now; manda('righello', { uid: T.me.uid, nome: T.me.nome, pts }); }
  }
  function tornaIndietro(t, x0, y0) { t.x = x0; t.y = y0; disegnaToken(); manda('trascina', { id: t.id, x: x0, y: y0 }); }
  async function salvaPosto(t, x, y, x0, y0) {
    const r = await SB.from('tavolo_token').update({ x, y }).eq('id', t.id).select().maybeSingle();
    if (r.error || !r.data) { tornaIndietro(t, x0, y0); toast(r.error?.message || 'Non puoi muovere questo token.', 'err'); return false; }
    return true;
  }
  // «Muovere Livion di 6 m?»: con la conferma il movimento si scala, altrimenti il token torna dov'era
  function avvisoFermo(t) {
    const mio = !isDM() && t.giocatore === T.me.giocatore;
    const sc = puoScattare(t), dopo = sc ? ` Per muoverti ancora: «Azioni» → Scatto${sc === 'bon' ? ' (con l\'azione bonus)' : ''}.` : '';
    toast(mio ? 'Hai esaurito il tuo movimento.' + (dopo || ' Non puoi muoverti oltre in questo turno.') : `${t.nome || 'Il token'} ha esaurito il movimento.${dopo || ' Non può muoversi oltre in questo turno.'}${isDM() ? ' (Alt + trascina per forzare)' : ''}`, 'err');
  }
  function chiediPasso(t, x, y, x0, y0, m, dif) {
    const b = $('#tv-mbar'); if (!b) return;
    const mv = movimentoDi(t), dopo = mv.resta - m, opp = suoTurno(t) ? opportunita(t, x0, y0, x, y) : [], pd = opp.length && puoDisimpegnarsi(t);
    T.passo = { id: t.id, x, y, x0, y0, m, dif };
    const nomi = opp.map(o => o.nome || 'un nemico').join(', '), oppHtml = opp.length ? `<span class="avv opp">⚔️ <b>Attacco di opportunità:</b> ${esc(t.nome || 'il token')} esce dalla portata di ${esc(nomi)} senza Disimpegno. ${opp.length > 1 ? 'Possono' : 'Può'} attaccarlo con la reazione.</span>` : '';
    b.innerHTML = `<div class="g"><b class="tit">🏃 ${esc(t.nome || 'Token')}: ${metri(m)}${dif ? ' 🪨' : ''}</b>${dif ? `<span class="avv">${dif} ${dif === 1 ? 'casella' : 'caselle'} di terreno difficile (contano doppio).</span>` : ''}<span class="avv">${dopo >= 0 ? `Dopo restano ${metri(dopo)} di ${metri(mv.tot)}.` : `<b>Oltre il movimento di ${metri(-dopo)}.</b>`} Confermi lo spostamento?</span>${oppHtml}</div><div class="g">${pd ? `<button type="button" data-k="dis" class="on" title="Usa ${pd === 'bon' ? 'l\'azione bonus' : 'l\'azione'} per il Disimpegno: niente attacchi di opportunità">🛡 Disimpegno${dopo >= 0 || isDM() ? ' e conferma' : ''}</button>` : ''}${dopo < 0 && suoTurno(t) && puoScattare(t) ? `<button type="button" data-k="scatta" class="on" title="Usa ${puoScattare(t) === 'bon' ? 'l\'azione bonus' : 'l\'azione'} per lo Scatto: altri ${metri(velocitaDi(schedaDi(t)))}">🏃 Scatta e conferma</button>` : ''}${dopo >= 0 || isDM() ? `<button type="button" data-k="ok" class="${dopo < 0 && suoTurno(t) && puoScattare(t) ? '' : 'on'}">✓ Conferma</button>` : ''}<button type="button" data-k="no">Annulla</button></div>`;
    b.classList.remove('spenta'); b.hidden = false;
    const ok = b.querySelector('[data-k=ok]'); if (ok) ok.onclick = confermaPasso;
    const sc = b.querySelector('[data-k=scatta]'); if (sc) sc.onclick = () => faiAzione(t, 'scatto', puoScattare(t)); // conferma il passo e poi scatta
    const di = b.querySelector('[data-k=dis]'); if (di) di.onclick = async () => { await faiAzione(t, 'dis', puoDisimpegnarsi(t)); if (dopo >= 0 || isDM()) confermaPasso(); };
    disegnaToken(); // il pannello e l'area contano già questo passo
    b.querySelector('[data-k=no]').onclick = annullaPasso;
  }
  async function confermaPasso() {
    const p = T.passo; if (!p) return; T.passo = null; barraMaschera();
    mostraRighello(null); manda('righello', { uid: T.me.uid, pts: null });
    const t = T.tok.get(p.id); if (!t) return;
    const opp = suoTurno(t) ? opportunita(t, p.x0, p.y0, p.x, p.y) : [];
    if (!await salvaPosto(t, p.x, p.y, p.x0, p.y0)) return;
    if (opp.length) annuncia(`⚔️ Attacco di opportunità: ${t.nome || 'Il token'} esce dalla portata di ${opp.map(o => o.nome || 'un nemico').join(', ')} senza Disimpegno. ${opp.length > 1 ? 'Possono' : 'Può'} usare la reazione per attaccarlo.`);
    const a = azioniDi(t);
    await segnaAzioni(t, { mov: (a.mov || 0) + p.m, ...(a.ox == null ? { ox: p.x0, oy: p.y0 } : {}) });
  }
  function annullaPasso() {
    const p = T.passo; if (!p) return; T.passo = null; barraMaschera();
    mostraRighello(null); manda('righello', { uid: T.me.uid, pts: null });
    const t = T.tok.get(p.id); if (t) tornaIndietro(t, p.x0, p.y0);
  }
  function barraRighello(b) {
    b.innerHTML = `<div class="g"><label class="sw" title="In combattimento, mentre trascini un token compare il righello con il movimento che resta"><input type="checkbox" data-k="rigt" ${righelloAuto() ? 'checked' : ''}><span class="tg" aria-hidden="true"></span>Righello mentre trascini i token (in combattimento)</label></div>`;
    b.classList.remove('spenta'); b.hidden = false;
    b.querySelector('[data-k=rigt]').onchange = e => { try { localStorage.setItem(RIGT, e.target.checked ? 'si' : 'no'); } catch { } };
  }
  function mostraRighello(pts) { if (pts) T.rulers.set('io', { nome: '', pts }); else T.rulers.delete('io'); disegnaRighelli(); }
  function disegnaRighelli() {
    const ov = $('#tv-ov'), sc = scena(); if (!ov || !sc) return;
    const v = T.view, S = p => [v.x + p.x * v.z, v.y + p.y * v.z];
    ov.innerHTML = [...T.rulers.values()].map(r => {
      const [a, b] = r.pts, [ax, ay] = S(a), [bx, by] = S(b);
      // regola della 5ª edizione: ogni casella, anche in diagonale, conta 1
      const cas = Math.round(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) / sc.griglia), m = (cas * sc.metri).toLocaleString('it-IT', { maximumFractionDigits: 1 });
      const col = r.ko ? '#ff6b5b' : r.nome ? '#e7cf9a' : '#ffd84a', lbl = `${m} m${cas ? ` · ${cas} ${cas === 1 ? 'casella' : 'caselle'}` : ''}${r.extra ? ' · ' + r.extra : ''}${r.nome ? ' · ' + r.nome : ''}`;
      return `<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="#000a" stroke-width="7" stroke-linecap="round"/><line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="${col}" stroke-width="3" stroke-dasharray="10 6" stroke-linecap="round"/>
        <circle cx="${ax}" cy="${ay}" r="5" fill="${col}" stroke="#000" stroke-width="1.5"/><circle cx="${bx}" cy="${by}" r="6" fill="${col}" stroke="#000" stroke-width="1.5"/>
        <text x="${bx + 12}" y="${by - 12}">${esc(lbl)}</text>`;
    }).join('') + (T.al ? quadroAllinea(T.al, v) : '') + (T.pcur && T.tool === 'maschera' && T.mforma === 'pennello' ? `<circle cx="${v.x + T.pcur.x * v.z}" cy="${v.y + T.pcur.y * v.z}" r="${(T.mraggio || sc.griglia) * v.z}" fill="none" stroke="#f2b51d" stroke-width="2" stroke-dasharray="6 4"/>` : '') + (T.tool === 'muri' && isDM() ? anteprimaMuro(v) : '');
  }

  /* ---------- menu del token (DM) ---------- */
  function chiudiPop() { document.querySelectorAll('.tv-pop').forEach(p => p.remove()); }
  function menuToken(id, e) {
    const t = T.tok.get(id), st = $('#tv-stage'); if (!t || !st) return;
    chiudiPop();
    const r = st.getBoundingClientRect(), pop = document.createElement('div'); pop.className = 'tv-pop nuovo';
    const giaIn = T.turno.find(x => x.token === t.id);
    const ini = giaIn ? `<div class="ini"><span>🎲 Iniziativa</span><b class="gia" title="Già nell'ordine del turno${isDM() ? ': la cambi con la matita della tabella del turno' : ''}">${giaIn.valore}</b></div>` : `<div class="ini"><span>🎲 Iniziativa</span><input type="number" data-k="imod" placeholder="mod" aria-label="Modificatore d'iniziativa"><button type="button" class="tv-b sec" data-k="ini" title="Tira 1d20 + modificatore e aggiungi all'ordine del turno">Tira</button></div>`;
    const ft = haFoto(t), sch = schedaDi(t), pf = (isDM() || puoMuovere(t)) && pfDi(t);
    const quota = pf ? clamp(pf.pf / Math.max(1, pf.max), 0, 1) : 0;
    const rpf = pf ? `<div class="pfr"><div class="rr"><span>PF <b>${pf.pf}</b> / ${pf.max}</span><button type="button" class="tv-b ko ico" data-k="pfm" title="Danni">−</button><input type="number" data-k="pfq" value="1" min="1" aria-label="Quanti punti"><button type="button" class="tv-b ok ico" data-k="pfp" title="Cura">+</button></div><div class="bar"><s style="width:${Math.round(quota * 100)}%;--b:${quota > 0.5 ? '#3f9a4a' : quota > 0.25 ? '#c9a24a' : '#b8322c'}"></s></div></div>` : '';
    const cnow = condTok(t), pcond = isDM() || puoMuovere(t), mio = puoMuovere(t);
    const tile = (k, ic, txt, tit, cls) => `<button type="button" data-k="${k}"${cls ? ` class="${cls}"` : ''}${tit ? ` title="${tit}"` : ''}><span>${ic}</span>${txt}</button>`;
    const tsch = sch ? tile('sch', '📜', sch.giocatore && sch.giocatore === T.me.giocatore ? 'La mia scheda' : 'Scheda') : isDM() && T.schede ? tile('sch', '📜', 'Crea la scheda') : '';
    const tzp = inCombattimento() && T.turno.some(x => x.token === t.id) && pcond ? turnoPop(t) : '';
    const bfine = suoTurno(t) && pcond ? '<div class="fine"><button type="button" class="tv-b pri" data-k="fine" title="Passa al prossimo nell\'ordine del turno">⏭ Finisci il turno</button></div>' : '';
    const rcond = pcond ? `<div class="tv-pcond">${cnow.map(c => `<button type="button" data-tc="${esc(c)}" title="Togli">${COND_FX[c]?.[0] || ''} ${esc(c)} ✕</button>`).join('')}<select data-k="tcond" aria-label="Aggiungi una condizione"><option value="">+ Condizione</option>${CONDIZIONI.filter(c => !cnow.includes(c)).map(c => `<option>${c}</option>`).join('')}</select></div>` : '';
    const chi = t.giocatore ? (T.info.giocatori || []).find(g => g.id === t.giocatore) : null;
    const sotto = mio && !isDM() ? 'Il tuo personaggio' : chi ? 'Lo muove ' + chi.name : 'Lo muove solo il DM';
    const testa = `<div class="hd"><i style="--c:${esc(t.colore || '#7d2530')};${t.immagine ? `background-image:url('${t.immagine.replace(/'/g, '%27')}')` : ''}">${t.immagine ? '' : esc(iniziali(t.nome))}</i><div class="nm">${isDM() ? `<input class="tv-pnome" data-k="rin" value="${esc(t.nome || '')}" maxlength="60" placeholder="Nome del token" aria-label="Nome del token" title="Scrivi per rinominare il token, Invio per salvare">` : `<b>${esc(t.nome || 'Token')}</b>`}<small>${esc(sotto)}${isDM() && t.nascosto ? ' · solo tu lo vedi' : ''}</small></div><button type="button" class="x" data-k="chiudi" aria-label="Chiudi">✕</button></div>`;
    const extra = () => {
      pop.querySelector('[data-k=chiudi]').onclick = chiudiPop;
      legaTurnoPop(pop, t);
      const metti = async lista => { chiudiPop(); const s = t.giocatore ? schedaDi(t) : null; if (s && puoScrivere(s)) await cambiaCond(s, null, lista); else await condSuToken(t, lista); };
      pop.querySelectorAll('[data-tc]').forEach(b => b.onclick = () => metti(cnow.filter(c => c !== b.dataset.tc)));
      const sc = pop.querySelector('[data-k=tcond]'); if (sc) sc.onchange = () => { if (sc.value) metti([...cnow, sc.value]); };
      pop.querySelector('[data-k=sch]')?.addEventListener('click', async () => {
        chiudiPop(); let s = schedaDi(t);
        if (!s) {
          const e = t.scheda && S.ents?.get(t.scheda), forma = await sceltaForma(t.nome || e?.name || 'PNG', e); if (!forma) return;
          s = await creaPng({ nome: t.nome || e?.name || 'PNG', entita: e ? e.id : null, immagine: t.immagine || null, forma });
          if (!s) return;
          if (!e) { const r = await SB.from('tavolo_token').update({ scheda: 'tv:' + s.id }).eq('id', t.id).select().single(); if (!r.error) T.tok.set(t.id, completa(t, r.data)); }
        }
        if (s === miaScheda() && $('#tv-schc')) return apriSchedaTab(true);
        apriScheda(s.id, t.id);
      });
      const q = () => Math.max(1, Math.trunc(+pop.querySelector('[data-k=pfq]').value || 1));
      pop.querySelector('[data-k=fine]')?.addEventListener('click', () => { chiudiPop(); finisciTurno(); });
      pop.querySelector('[data-k=pfm]')?.addEventListener('click', () => { cambiaPF(t, -q()); chiudiPop(); });
      pop.querySelector('[data-k=pfp]')?.addEventListener('click', () => { cambiaPF(t, q()); chiudiPop(); });
      const im = pop.querySelector('[data-k=imod]'); if (im && sch) im.value = modC(sch.dati.des);
    };
    if (!isDM()) {
      // il giocatore apre la foto (solo per sé) e, sul proprio token, tira l'iniziativa
      if (!ft && !mio && !sch) return;
      const gr = tsch + (ft ? tile('foto', '🖼', 'Foto', 'Solo sul tuo schermo') : '');
      pop.innerHTML = `${testa}${mio ? bfine + tzp + rpf : ''}${gr ? `<div class="gr">${gr}</div>` : ''}${mio ? rcond + ini : ''}`;
      st.append(pop); extra();
      pop.style.left = clamp(e.clientX - r.left + 8, 6, r.width - pop.offsetWidth - 6) + 'px'; pop.style.top = clamp(e.clientY - r.top + 8, 6, r.height - pop.offsetHeight - 6) + 'px';
      if (ft) pop.querySelector('[data-k=foto]').onclick = () => { chiudiPop(); apriFoto(fotoDi(t)); };
      if (mio && !giaIn) pop.querySelector('[data-k=ini]').onclick = () => { chiudiPop(); iniziativa(t, pop.querySelector('[data-k=imod]').value); };
      return;
    }
    const gioc = (T.info.giocatori || []).map(g => `<option value="${esc(g.id)}" ${t.giocatore === g.id ? 'selected' : ''}>${esc(g.name)}</option>`).join('');
    const vista = scena()?.visuale && t.giocatore;
    const gr = tsch + (ft ? tile('foto', '🖼', 'Foto', 'Solo sul tuo schermo') + tile('mostra', '📣', 'Mostra a tutti', 'Si apre a schermo intero a tutti i giocatori') : '')
      + (t.nascosto ? tile('nasc', '⬆', 'Rendi visibile', 'Sposta nei Segnalini: lo vedono tutti') : tile('nasc', '👑', 'Solo per me', 'Sposta nel livello Master: lo vedi solo tu'))
      + (!t.giocatore && pf ? (t.barra ? tile('barra', '🙈', 'Nascondi salute', 'I giocatori vedono la barra della salute di questo token') : tile('barra', '❤', 'Mostra salute', 'Per ora la barra della salute la vedi solo tu')) : '')
      + tile('copia', '📋', 'Copia', 'Poi «Incolla» (o Ctrl+V sulla mappa) per metterne altri uguali') + tile('via', '🗑', 'Elimina', '', 'via');
    pop.innerHTML = `${testa}${bfine}${tzp}${rpf}<div class="gr">${gr}</div>${rcond}${ini}
      <details><summary>Altro: misura, chi lo muove${vista ? ', vista' : ''}</summary>
      <div class="row"><span>Misura</span><button type="button" class="tv-b sec ico" data-k="meno">−</button><span>${t.misura.toLocaleString('it-IT')}</span><button type="button" class="tv-b sec ico" data-k="piu">+</button></div>
      <div class="row"><span>Lo muove</span><select data-k="gioc"><option value="">solo il DM</option>${gioc}</select></div>
      ${vista ? `<div class="row" title="Con la nebbia automatica: fin dove vede questo personaggio (18 m è la scurovisione)"><span>Vede fino a</span><select data-k="vista"><option value="">senza limite</option>${[0, 1.5, 3, 6, 9, 12, 18, 24, 36].map(n => `<option value="${n}" ${t.vista != null && +t.vista === n ? 'selected' : ''}>${n ? n.toLocaleString('it-IT') + ' m' + (n === 18 ? ' (scurovisione)' : '') : 'non vede'}</option>`).join('')}</select></div>` : ''}</details>`;
    st.append(pop); extra();
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
    pop.querySelector('[data-k=barra]')?.addEventListener('click', async () => {
      const r2 = await SB.from('tavolo_token').update({ barra: !t.barra }).eq('id', id).select().single();
      if (r2.error) return toast(/barra/i.test(r2.error.message) || sqlMancante(r2.error) ? 'Per la barra della salute esegui tavolo/tappa-6.sql in Supabase.' : r2.error.message, 'err');
      T.tok.set(id, r2.data); disegnaToken(); chiudiPop();
    });
    pop.querySelector('[data-k=copia]').onclick = () => { chiudiPop(); copiaToken(t); };
    pop.querySelector('[data-k=nasc]').onclick = async () => { await salva({ nascosto: !t.nascosto }); if (!t.nascosto) manda('nascosto', { id }); };
    pop.querySelector('[data-k=meno]').onclick = () => salva({ misura: t.misura > 1 ? t.misura - 1 : 0.5 });
    pop.querySelector('[data-k=piu]').onclick = () => salva({ misura: t.misura < 1 ? 1 : Math.min(10, t.misura + 1) });
    pop.querySelector('[data-k=gioc]').onchange = ev => salva({ giocatore: ev.target.value || null });
    pop.querySelector('[data-k=vista]')?.addEventListener('change', ev => salva({ vista: ev.target.value === '' ? null : +ev.target.value }));
    pop.querySelector('[data-k=ini]')?.addEventListener('click', () => { chiudiPop(); iniziativa(t, pop.querySelector('[data-k=imod]').value); });
    const rin = pop.querySelector('[data-k=rin]');
    const rinomina = () => { const n = rin.value.trim().slice(0, 60); if (n !== (t.nome || '')) salva({ nome: n }); };
    rin.onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); rinomina(); } else if (ev.key === 'Escape') chiudiPop(); };
    rin.onchange = rinomina;
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
    const tv = T.schede ? [...T.schede.values()].filter(s => s.tipo === 'png').sort((a, b) => a.nome.localeCompare(b.nome, 'it')).map(s => ({ nome: s.nome, img: fotoScheda(s), scheda: 'tv:' + s.id, colore: '#7d2530', sch: s })) : [];
    const tutti = [...pg, ...png, ...tv]; tutti.forEach((x, i) => x.i = i);
    if ($('dialog.tv-tk[open]')) return;
    const d = finestra(`<form method="dialog"><h3>Aggiungi un token</h3>
      <div class="tv-tabs"><button type="button" class="btn sm on" data-tab="pg">Party</button><button type="button" class="btn sm" data-tab="png">Personaggi del sito</button>${T.schede ? '<button type="button" class="btn sm" data-tab="tv">Schede del tavolo</button>' : ''}<button type="button" class="btn sm" data-tab="nuovo">Nuovo</button></div>
      <div data-p="pg"><div class="tv-pick">${pg.map(cella).join('')}</div><p class="hint">Il token di un personaggio lo può muovere il suo giocatore.</p></div>
      <div data-p="png" hidden><input type="search" placeholder="Cerca un personaggio…" style="width:100%;margin-bottom:8px;font:inherit;padding:6px 8px;border-radius:4px;border:1px solid var(--line2);background:var(--paper2);color:var(--ink)"><div class="tv-pick">${png.map(cella).join('') || '<p class="hint">Nessun personaggio nel sito.</p>'}</div></div>
      <div data-p="tv" hidden><div class="tv-pick">${tv.map(cella).join('') || '<p class="hint">Nessuna scheda di PNG: creale dal pannello Schede.</p>'}</div><p class="hint">Ogni token di una scheda ha i suoi punti ferita.</p></div>
      <div data-p="nuovo" hidden><div class="tv-f"><label>Nome</label><input name="nome" maxlength="60" placeholder="Es. Bandito 1">
        <label>Colore</label><div class="tv-cols">${COLORI.map((c, i) => `<button type="button" style="--c:${c}" data-c="${c}" aria-pressed="${!i}" aria-label="Colore ${i + 1}"></button>`).join('')}</div>
        <label>Immagine</label><input type="file" name="img" accept="image/*"></div>
        <button type="button" class="btn primary" data-k="crea">Aggiungi</button></div>
      <div class="tv-f" style="margin-top:12px"><label>Misura</label><select name="mis"><option value="0.5">Minuscola (½ casella)</option><option value="1" selected>Media (1 casella)</option><option value="2">Grande (2×2)</option><option value="3">Enorme (3×3)</option><option value="4">Mastodontica (4×4)</option></select>
        <label>Livello</label><select name="liv"><option value="segnalini">Segnalini (lo vedono tutti)</option><option value="master" ${T.livello === 'master' ? 'selected' : ''}>Master (solo tu)</option></select></div>
      <menu><button value="cancel" class="btn ghost">Chiudi</button></menu></form>`, 'tv-side tv-tk', true);
    d.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { d.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('on', x === b)); d.querySelectorAll('[data-p]').forEach(p => p.hidden = p.dataset.p !== b.dataset.tab); });
    const q = d.querySelector('[data-p=png] input'); q.oninput = () => { const s = norm(q.value); d.querySelectorAll('[data-p=png] [data-i]').forEach(b => b.hidden = !!s && !norm(b.textContent).includes(s)); };
    let colore = COLORI[0];
    d.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { colore = b.dataset.c; d.querySelectorAll('[data-c]').forEach(x => x.setAttribute('aria-pressed', x === b)); });
    const metti = o => piazza(o, +d.querySelector('[name=mis]').value, d.querySelector('[name=liv]').value === 'master');
    d.querySelectorAll('[data-i]').forEach(b => b.onclick = () => metti(tutti[+b.dataset.i]).catch(e => toast(e.message, 'err')));
    d.querySelector('[data-k=crea]').onclick = async () => {
      const f = d.querySelector('[name=img]').files[0];
      try { await metti({ nome: d.querySelector('[name=nome]').value.trim(), colore, img: f ? await immagineToken(f) : null }); d.querySelector('[name=nome]').value = ''; d.querySelector('[name=img]').value = ''; }
      catch (e) { toast(e.message, 'err'); }
    };
  }

  // mette un token al centro di ciò che si sta guardando, un po' sfalsato se se ne aggiungono tanti
  async function piazza(o, mis, master) {
    const sc = scena(); if (!sc) return null;
    const st = $('#tv-stage').getBoundingClientRect(), lato = mis * sc.griglia, sul = [...T.tok.values()].filter(t => t.scena === sc.id), n = sul.length % 5;
    const cx = (st.width / 2 - T.view.x) / T.view.z - lato / 2 + n * sc.griglia * 0.5, cy = (st.height / 2 - T.view.y) / T.view.z - lato / 2;
    // i PNG con la scheda: ogni token ha i suoi punti ferita, e un numero se ce n'è più d'uno
    const sch = o.sch || (o.scheda && !o.giocatore && T.schede ? [...T.schede.values()].find(x => x.tipo === 'png' && x.entita === o.scheda) : null), max = sch ? num(sch.dati.pf_max) : null;
    const gia = sch ? sul.filter(t => schedaDi(t)?.id === sch.id).length : 0;
    const row = { scena: sc.id, nome: gia ? `${o.nome} ${gia + 1}` : o.nome, immagine: o.img || null, colore: o.colore, misura: mis, giocatore: o.giocatore || null, scheda: o.scheda || null, nascosto: !!master,
      x: aggancia(clamp(cx, 0, sc.larghezza - lato), sc.griglia_x, mis), y: aggancia(clamp(cy, 0, sc.altezza - lato), sc.griglia_y, mis) };
    if (max != null && !row.giocatore) { row.pf = max; row.pf_max = max; }
    if (row.giocatore) { const l = postoLibero({ ...row, id: null }, row.x, row.y); if (l) { row.x = l.x; row.y = l.y; } }
    const r = await SB.from('tavolo_token').insert(row).select().single();
    if (r.error) { toast(r.error.message, 'err'); return null; }
    T.tok.set(r.data.id, r.data); disegnaToken(); toast('Token aggiunto: ' + (row.nome || 'senza nome'));
    return r.data;
  }

  /* ---------- copia e incolla dei token (DM): le copie usano la stessa scheda, ognuna con i suoi punti ferita ---------- */
  let cursore = null;
  const segui = e => { cursore = { x: e.clientX, y: e.clientY }; };
  function copiaToken(t) {
    T.copia = { ...t }; barraCopia();
    toast(`Token copiato: ${t.nome || 'senza nome'}. Premi «Incolla» o Ctrl+V sulla mappa, anche più volte.`);
  }
  function barraCopia() {
    const st = $('#tv-stage'); if (!st) return; st.querySelector('.tv-incolla')?.remove();
    if (!T.copia || !isDM() || !scena()) return;
    const b = document.createElement('div'); b.className = 'tv-incolla';
    b.innerHTML = `<button type="button" class="tv-b pri" data-k="inc" title="Mette sulla mappa un altro token uguale, accanto all'originale">📋 Incolla «${esc(T.copia.nome || 'token')}»</button><button type="button" class="tv-b sec ico" data-k="noc" title="Svuota gli appunti" aria-label="Smetti di incollare">✕</button>`;
    b.querySelector('[data-k=inc]').onclick = () => incollaToken(false);
    b.querySelector('[data-k=noc]').onclick = () => { T.copia = null; barraCopia(); };
    st.append(b);
  }
  // «Bandito 1» → «Bandito 2», «Bandito 3»…: il primo numero libero tra i token della mappa
  function nomeCopia(nome, sc) {
    const base = String(nome || '').replace(/\s*\d+$/, '').trim(); if (!base) return nome || '';
    const usati = new Set([...T.tok.values()].filter(t => t.scena === sc.id).map(t => String(t.nome || '').trim()));
    let n = 2; while (usati.has(`${base} ${n}`)) n++;
    return `${base} ${n}`;
  }
  async function incollaToken(alMouse) {
    const o = T.copia, sc = scena(); if (!o || !sc) return;
    const lato = o.misura * sc.griglia, passo = o.misura < 1 ? sc.griglia / 2 : sc.griglia, st = $('#tv-stage').getBoundingClientRect();
    let x = o.x, y = o.y;
    if (alMouse && cursore && cursore.x >= st.left && cursore.x <= st.right && cursore.y >= st.top && cursore.y <= st.bottom) {
      x = (cursore.x - st.left - T.view.x) / T.view.z - lato / 2; y = (cursore.y - st.top - T.view.y) / T.view.z - lato / 2;
    } else if (o.scena !== sc.id) { x = (st.width / 2 - T.view.x) / T.view.z - lato / 2; y = (st.height / 2 - T.view.y) / T.view.z - lato / 2; }
    x = aggancia(clamp(x, 0, sc.larghezza - lato), sc.griglia_x, o.misura); y = aggancia(clamp(y, 0, sc.altezza - lato), sc.griglia_y, o.misura);
    // la prima casella libera attorno al punto scelto
    const altri = [...T.tok.values()].filter(t => t.scena === sc.id), libera = (px, py) => !altri.some(t => { const l = t.misura * sc.griglia, m = 0.5; return px < t.x + l - m && px + lato > t.x + m && py < t.y + l - m && py + lato > t.y + m; });
    let pos = null;
    for (let r = 0; r <= 8 && !pos; r++) for (let i = -r; i <= r && !pos; i++) for (let j = -r; j <= r && !pos; j++) {
      if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
      const px = x + i * passo, py = y + j * passo;
      if (px >= 0 && py >= 0 && px + lato <= sc.larghezza + 0.5 && py + lato <= sc.altezza + 0.5 && libera(px, py)) pos = { x: px, y: py };
    }
    pos = pos || { x, y };
    const sch = schedaDi(o), max = sch && sch.tipo === 'png' ? num(sch.dati.pf_max) || null : o.pf_max ?? null;
    const row = { scena: sc.id, nome: nomeCopia(o.nome, sc), immagine: o.immagine || null, colore: o.colore, misura: o.misura, giocatore: null, scheda: o.scheda || null, nascosto: !!o.nascosto, x: pos.x, y: pos.y, pf: max, pf_max: max };
    if ('barra' in o) row.barra = !!o.barra;
    const r = await SB.from('tavolo_token').insert(row).select().single();
    if (r.error) return toast(r.error.message, 'err');
    T.tok.set(r.data.id, r.data); disegnaToken(); toast('Token incollato: ' + (row.nome || 'senza nome'));
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
    const off = n => +(((n % sc.griglia) + sc.griglia) % sc.griglia).toFixed(2);
    const d = openDlg(`<form method="dialog" novalidate><h3>Impostazioni della pagina</h3><p class="hint" style="margin-top:0">Cambia i valori guardando la mappa: la griglia si aggiorna subito. Fai combaciare una casella con un quadretto della mappa.</p>
      <div class="tv-f"><label>Nome</label><input name="nome" maxlength="80" value="${esc(sc.nome)}">
        <label>Casella (px)</label><span style="display:flex;gap:8px;align-items:center"><input type="range" class="tv-rg" name="g" min="10" max="300" step="0.01" value="${sc.griglia}" style="flex:1"><input type="number" name="gn" min="8" max="600" step="any" value="${sc.griglia}" style="width:84px"></span>
        <label>Sposta ↔</label><span style="display:flex;gap:8px;align-items:center"><input type="range" class="tv-rg" name="gx" min="0" max="${sc.griglia}" step="0.01" value="${off(sc.griglia_x)}" style="flex:1"><input type="number" name="gxn" step="any" value="${off(sc.griglia_x)}" style="width:84px"></span>
        <label>Sposta ↕</label><span style="display:flex;gap:8px;align-items:center"><input type="range" class="tv-rg" name="gy" min="0" max="${sc.griglia}" step="0.01" value="${off(sc.griglia_y)}" style="flex:1"><input type="number" name="gyn" step="any" value="${off(sc.griglia_y)}" style="width:84px"></span>
        <label></label><small class="hint" style="margin:0">Accetta i decimali (es. 55,45). Con le frecce ↑↓ nei riquadri: un pixel; con Maiusc tenuto, un decimo.</small>
        <label></label><span style="display:flex;flex-wrap:wrap;gap:6px"><button type="button" class="btn sm" data-k="allinea">📐 Allinea alla griglia disegnata sulla mappa</button><button type="button" class="btn sm" data-k="mano">✋ Sposta la griglia a mano</button></span>
        <label>Metri per casella</label><input type="number" name="m" min="0.1" max="1000" step="any" value="${sc.metri}">
        <label>Mostra la griglia</label><label style="justify-content:flex-start"><input type="checkbox" name="vis" ${sc.griglia_visibile ? 'checked' : ''}> sì</label>
        <label>Colore</label><input type="color" name="gc" value="${esc(sc.griglia_colore || '#000000')}">
        <label>Opacità</label><span style="display:flex;gap:8px;align-items:center"><input type="range" class="tv-rg" name="go" min="0" max="100" step="1" value="${sc.griglia_opacita ?? 38}" style="flex:1"><output name="gov" style="width:42px;text-align:right">${sc.griglia_opacita ?? 38}%</output></span></div>
      <menu><button value="cancel" class="btn ghost" formnovalidate>Annulla</button><button value="ok" class="btn primary">Salva</button></menu></form>`, 'tv-gd');
    const v = n => d.querySelector(`[name=${n}]`); d.querySelectorAll('.tv-rg').forEach(pRange);
    const prova = () => {
      sc.griglia = clamp(+v('gn').value || sc.griglia, 8, 600); sc.griglia_x = +v('gxn').value || 0; sc.griglia_y = +v('gyn').value || 0; sc.metri = +v('m').value || 1.5; sc.griglia_visibile = v('vis').checked;
      sc.griglia_colore = v('gc').value; sc.griglia_opacita = +v('go').value; v('gov').value = sc.griglia_opacita + '%';
      v('gx').max = v('gy').max = sc.griglia; disegnaGriglia(); disegnaToken(); d.querySelectorAll('.tv-rg').forEach(pRange);
    };
    v('g').oninput = () => { v('gn').value = v('g').value; prova(); };
    v('gn').oninput = () => { v('g').value = v('gn').value; prova(); };
    v('gx').oninput = () => { v('gxn').value = v('gx').value; prova(); }; v('gxn').oninput = () => { v('gx').value = v('gxn').value; prova(); };
    v('gy').oninput = () => { v('gyn').value = v('gy').value; prova(); }; v('gyn').oninput = () => { v('gy').value = v('gyn').value; prova(); };
    ['m', 'vis', 'gc', 'go'].forEach(n => v(n).oninput = prova);
    // frecce nei riquadri: un pixel alla volta, un decimo con Maiusc (il browser col passo «any» andrebbe di 1 senza decimi)
    ['gn', 'gxn', 'gyn'].forEach(n => v(n).addEventListener('keydown', e => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return; e.preventDefault();
      const el = v(n); el.value = +((+el.value || 0) + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 0.1 : 1)).toFixed(2); el.dispatchEvent(new Event('input'));
    }));
    d.querySelector('[data-k=mano]').onclick = () => { prova(); T.gm = { prima }; d.close('mano'); setTimeout(() => strumento('griglia'), 80); };
    d.querySelector('[data-k=allinea]').onclick = () => { d.close('cancel'); setTimeout(() => { strumento('allinea'); toast('Disegna un riquadro su alcune caselle della mappa.'); }, 80); };
    d.addEventListener('close', async () => {
      if (d.returnValue === 'mano') return; // la griglia resta com'è: si rifinisce trascinandola
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
  // il tiradadi: si toccano i dadi per comporre il tiro (2d6 + 1d20…), poi «Tira»
  const piuMod = m => m ? (m > 0 ? '+' : '') + m : '';
  function formulaTdp(mod) {
    const c = T.tdc || {}, adv = T.tdadv || '';
    const parti = DADI.filter(f => c[f] > 0).map(f => f === 20 && c[f] === 1 && adv ? '2d20' + adv : c[f] + 'd' + f);
    if (!parti.length && adv) parti.push('2d20' + adv);
    return parti.length ? parti.join('+') + piuMod(mod) : '';
  }
  function disegnaTdp() {
    const p = $('#tv-tdp'); if (!p || p.hidden) return;
    const mod = p.querySelector('[data-k=mod]')?.value || '', mot = p.querySelector('[data-k=mot]')?.value || '';
    const c = T.tdc || (T.tdc = {}), adv = T.tdadv || '', f = formulaTdp(Math.trunc(+mod || 0));
    if (T.tdmio) return disegnaMioDado(p);
    p.innerHTML = `<div class="hd"><b>Tiradadi</b><span class="hdx"><button type="button" class="mio" data-k="mio" title="Scegli lo stile e la misura dei tuoi dadi">${svgDado(20, '', coloreDi(T.me?.uid), mioDado().s === 'auto' ? null : mioDado().s)}Il mio dado</button><button type="button" data-act="tv-tiradadi" aria-label="Chiudi">✕</button></span></div>
      <div class="tabs"><button type="button" data-v="0" class="${T.tdpriv ? '' : 'on'}">Tutti</button><button type="button" data-v="1" class="${T.tdpriv ? 'on' : ''}">${isDM() ? '🙈 Solo io' : '🙈 Solo al DM'}</button></div>
      <div class="dz">${DADI.map(n => `<button type="button" data-f="${n}" class="${c[n] ? 'on' : ''}" title="Aggiungi 1d${n}">${dado(n)}d${n}${c[n] ? `<em>${c[n]}</em><span class="meno" data-meno="${n}" role="button" aria-label="Togli 1d${n}">−</span>` : ''}</button>`).join('')}</div>
      <div class="fx"><code class="${f ? '' : 'vuota'}">${f ? esc(f.replace(/\+/g, ' + ').replace(/kh1/g, ' vant.').replace(/kl1/g, ' svant.')) : 'Tocca i dadi per comporre il tiro'}</code><span>+</span><input type="number" data-k="mod" placeholder="0" aria-label="Modificatore" value="${esc(mod)}"></div>
      <div class="adv">${[['', 'Normale'], ['kh1', 'Vantaggio'], ['kl1', 'Svantaggio']].map(([v, l]) => `<button type="button" data-adv="${v}" class="${adv === v ? 'on' : ''}" title="${v ? 'Vale per un solo d20' : ''}">${l}</button>`).join('')}</div>
      <div class="mot"><input type="text" data-k="mot" placeholder="Per cosa? (facoltativo)" maxlength="80" value="${esc(mot)}"></div>
      <div class="go"><button type="button" class="tv-b sec" data-k="svuota">Svuota</button><button type="button" class="tv-b pri" data-k="tira" ${f ? '' : 'disabled'}>🎲 Tira ${f ? esc(f) : ''}</button></div>`;
    p.querySelector('[data-k=mio]').onclick = () => { T.tdmio = true; disegnaTdp(); };
    p.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { T.tdpriv = b.dataset.v === '1'; disegnaTdp(); segnaPriv(); });
    p.querySelectorAll('.dz button').forEach(b => b.onclick = e => {
      const n = +b.dataset.f, meno = e.target.closest('[data-meno]');
      c[n] = Math.max(0, Math.min(20, (c[n] || 0) + (meno ? -1 : 1))); disegnaTdp();
    });
    p.querySelectorAll('[data-adv]').forEach(b => b.onclick = () => { T.tdadv = b.dataset.adv; disegnaTdp(); });
    p.querySelector('[data-k=mod]').oninput = () => { const g = p.querySelector('[data-k=tira]'), x = formulaTdp(Math.trunc(+p.querySelector('[data-k=mod]').value || 0)); p.querySelector('.fx code').textContent = x ? x.replace(/\+/g, ' + ').replace(/kh1/g, ' vant.').replace(/kl1/g, ' svant.') : 'Tocca i dadi per comporre il tiro'; g.textContent = '🎲 Tira ' + x; g.disabled = !x; };
    p.querySelector('[data-k=svuota]').onclick = () => { T.tdc = {}; T.tdadv = ''; disegnaTdp(); };
    p.querySelector('[data-k=tira]').onclick = async () => {
      const x = formulaTdp(Math.trunc(+p.querySelector('[data-k=mod]').value || 0)); if (!x) return;
      const mt = p.querySelector('[data-k=mot]'), ad = T.tdadv && /k[hl]1/.test(x) ? (T.tdadv === 'kh1' ? 'vantaggio' : 'svantaggio') : null;
      if (await tira(x, ad, T.tdpriv, mt.value.trim())) { T.tdc = {}; T.tdadv = ''; mt.value = ''; p.querySelector('[data-k=mod]').value = ''; disegnaTdp(); }
    };
  }

  // «Il mio dado»: stile e misura dei dadi che rotolano sulla mappa; restano salvati su questo dispositivo
  function disegnaMioDado(p) {
    const md = mioDado(), col = coloreDi(T.me?.uid), k = md.s === 'auto' ? null : md.s, st = stileDado(md.s);
    p.innerHTML = `<div class="hd"><b>Il mio dado</b><span class="hdx"><button type="button" class="mio" data-k="torna">‹ Tira</button><button type="button" data-act="tv-tiradadi" aria-label="Chiudi">✕</button></span></div>
      <div class="lb">Stile</div><div class="sws">${STILI_DADI.map(([key, nome, desc]) => `<button type="button" data-s="${key}" class="${key === md.s ? 'on' : ''}" title="${esc(nome)}: ${esc(desc)}" aria-label="${esc(nome)}" aria-pressed="${key === md.s}">${svgDado(20, '', col, key === 'auto' ? null : key)}</button>`).join('')}</div>
      <div class="nm"><b>${esc(st[1])}</b> · ${esc(st[2])}</div>
      <div class="lb">Misura</div><div class="tabs">${Object.entries(MISURE_DADI).map(([d, [n]]) => `<button type="button" data-d="${d}" class="${d === md.d ? 'on' : ''}">${n}</button>`).join('')}</div>
      <div class="pv">${[[20, 20], [8, 6], [6, 5]].map(([f, v], i) => `<span style="width:${Math.round(MISURE_DADI[md.d][1] * [0.85, 0.62, 0.55][i])}px">${svgDado(f, v, col, k)}</span>`).join('')}</div>
      <p class="nt">Gli altri al tavolo vedono rotolare i tuoi dadi così.</p>
      <div class="go"><button type="button" class="tv-b sec" data-k="prova">🎲 Prova sulla mappa</button></div>`;
    const salva = v => { try { localStorage.setItem(DADO_K, JSON.stringify({ ...mioDado(), ...v })); } catch { } tracciaDado(); disegnaMioDado(p); };
    p.querySelector('[data-k=torna]').onclick = () => { T.tdmio = false; disegnaTdp(); };
    p.querySelectorAll('[data-s]').forEach(b => b.onclick = () => salva({ s: b.dataset.s }));
    p.querySelectorAll('[data-d]').forEach(b => b.onclick = () => salva({ d: b.dataset.d }));
    // un lancio di prova solo sul proprio schermo, per vedere l'effetto
    p.querySelector('[data-k=prova]').onclick = () => {
      if (!scena()) return toast('Apri una mappa per vedere i dadi rotolare.');
      const v = n => 1 + Math.floor(Math.random() * n);
      lancia({ autore: T.me?.uid, dettaglio: `1d20 [${v(20)}] + 1d8 [${v(8)}] + 1d6 [${v(6)}]` });
    };
  }

  // la chat resta aperta; la linguetta sul bordo la chiude e la riapre (si ricorda la scelta)
  const CHAT = 'tavolo-chat';
  function apriChat(apri, salva) {
    const box = $('#tv-dice'), tab = $('#tv-ctab'); if (!box) return;
    box.hidden = !apri;
    if (salva) try { localStorage.setItem(CHAT, apri ? '1' : '0'); } catch { }
    if (tab) { const tel = matchMedia('(max-width:820px)').matches; tab.textContent = tel ? (apri ? '⌄' : '💬') : apri ? '›' : '‹'; tab.classList.toggle('chiusa', !apri); tab.dataset.tip = apri ? 'Chiudi la chat' : 'Apri la chat'; tab.setAttribute('aria-label', tab.dataset.tip); if (apri) tab.classList.remove('nuovo'); }
    if (apri) { const l = $('#tv-log'); if (l) l.scrollTop = 1e9; }
    disegnaRail();
  }
  function disegnaDadi() {
    const box = $('#tv-dice'); if (!box) return;
    if (!T.diceInit) { let v = null; try { v = localStorage.getItem(CHAT); } catch { } apriChat(v ? v === '1' : matchMedia('(min-width:821px)').matches); }
    T.diceInit = true;
    const tabSc = isDM() && window.__scaletta, tabSh = !isDM() && !!T.schede;
    box.innerHTML = `<i class="tv-crz" data-k="crz" title="Trascina per allargare o stringere la chat" aria-hidden="true"></i><div class="tv-dh">${tabSc ? '<span class="tv-dtab" role="tablist"><button type="button" role="tab" data-act="tv-chatab">Chat</button><button type="button" role="tab" data-act="tv-scaletta">Scaletta</button></span>' : tabSh ? '<span class="tv-dtab" role="tablist"><button type="button" role="tab" data-act="tv-chatab">Chat</button><button type="button" role="tab" data-act="tv-schtab">Scheda</button></span>' : '<span>Chat</span>'}<span class="dx"><button type="button" class="tv-cx tv-anim ${animazioni() ? 'on' : ''}" data-act="tv-anim" title="Animazioni degli attacchi: ${animazioni() ? 'accese' : 'spente'}" aria-label="Animazioni degli attacchi" aria-pressed="${animazioni()}">✨</button>${isDM() ? '<button type="button" class="tv-cx tv-svuota" data-act="tv-svuota" title="Svuota la chat: cancella tutti i messaggi e i tiri, per tutti" aria-label="Svuota la chat">🗑</button>' : '<button type="button" class="tv-cx" data-act="tv-dadi" title="Chiudi la chat" aria-label="Chiudi la chat">✕</button>'}</span></div><div class="tv-log" id="tv-log"></div>${tabSc ? '<div class="tv-scal" id="tv-scal"></div>' : ''}${tabSh ? '<div class="tv-schc" id="tv-schc"></div>' : ''}
      <div class="tv-dk"><div class="dd">${DADI.map(f => `<button type="button" data-df="${f}" title="Tira 1d${f}${f === 20 ? ' (con il vantaggio scelto sotto)' : ''}">${dado(f)}d${f}</button>`).join('')}</div>
      <div class="op"><span class="sg" title="Vale per il d20">${[['', 'Normale'], ['kh1', 'Vantaggio'], ['kl1', 'Svantaggio']].map(([v, l]) => `<button type="button" data-cadv="${v}" class="${(T.cadv || '') === v ? 'on' : ''}">${l}</button>`).join('')}</span><input class="md" type="number" data-k="cmod" placeholder="+0" aria-label="Modificatore" value="${esc(T.cmod || '')}"><button type="button" class="sgr ${T.tdpriv ? 'on' : ''}" data-k="cpriv">${T.tdpriv ? '🙈 Nascosto' : '👁 Tutti'}</button></div>
      <div class="in"><input type="text" id="tv-f" placeholder="Scrivi… (/w nome per sussurrare)" autocomplete="off" aria-label="Scrivi un messaggio"><button type="button" data-act="tv-tira" title="Invia" aria-label="Invia">➤</button></div></div>`;
    $('#tv-f').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); scrivi(); } };
    $('#tv-log').onclick = e => { const b = e.target.closest('[data-del]'); if (b) cancella(b.dataset.del).catch(err => toast(err.message, 'err')); };
    const dk = box.querySelector('.tv-dk'), cm = dk.querySelector('[data-k=cmod]');
    cm.oninput = () => { T.cmod = cm.value; };
    dk.querySelectorAll('[data-cadv]').forEach(b => b.onclick = () => { T.cadv = b.dataset.cadv; dk.querySelectorAll('[data-cadv]').forEach(x => x.classList.toggle('on', x === b)); });
    dk.querySelector('[data-k=cpriv]').onclick = () => { T.tdpriv = !T.tdpriv; segnaPriv(); disegnaTdp(); };
    dk.querySelectorAll('[data-df]').forEach(b => b.onclick = () => {
      const f = +b.dataset.df, adv = f === 20 ? T.cadv || '' : '';
      tira((adv ? '2d20' + adv : '1d' + f) + piuMod(Math.trunc(+cm.value || 0)), adv ? (adv === 'kh1' ? 'vantaggio' : 'svantaggio') : null, T.tdpriv, '');
    });
    segnaPriv(); disegnaBarra(); disegnaLog();
    if (T.scal === undefined) T.scal = !!(isDM() && window.__scaletta?.daAprire());
    if (T.scal && isDM()) apriScaletta(true); else disegnaScaletta();
    if (T.stab === undefined) { try { T.stab = localStorage.getItem(STAB) === '1'; } catch { T.stab = false; } }
    larghezzaChat(box); disegnaSchedaTab();
  }
  // la chat si allarga o si stringe trascinando il bordo sinistro; la misura resta per le prossime volte
  const CHATW = 'tavolo-chat-w';
  function larghezzaChat(box) {
    let w = 0; try { w = +localStorage.getItem(CHATW) || 0; } catch { }
    if (w) box.style.setProperty('--cw', w + 'px');
    const h = box.querySelector('[data-k=crz]'); if (!h) return;
    h.onpointerdown = e => {
      if (e.button) return; e.preventDefault(); h.setPointerCapture(e.pointerId); h.classList.add('on');
      const x0 = e.clientX, w0 = box.getBoundingClientRect().width, max = Math.max(320, Math.min(760, innerWidth * 0.6));
      h.onpointermove = ev => { w = Math.round(clamp(w0 + x0 - ev.clientX, 260, max)); box.style.setProperty('--cw', w + 'px'); };
      h.onpointerup = h.onpointercancel = () => { h.onpointermove = h.onpointerup = h.onpointercancel = null; h.classList.remove('on'); try { localStorage.setItem(CHATW, w); } catch { } };
    };
    h.ondblclick = () => { box.style.removeProperty('--cw'); try { localStorage.removeItem(CHATW); } catch { } };
  }
  // i giocatori hanno la loro scheda sempre a portata, nella sezione «Scheda» accanto alla chat
  const miaScheda = () => !isDM() && T.schede ? [...T.schede.values()].find(x => x.tipo === 'pg' && x.giocatore && x.giocatore === T.me?.giocatore) || null : null;
  const STAB = 'tavolo-scheda-tab';
  function apriSchedaTab(on) {
    T.stab = !!on && !isDM(); try { localStorage.setItem(STAB, T.stab ? '1' : '0'); } catch { }
    if (T.stab && $('#tv-dice')?.hidden) apriChat(true);
    disegnaSchedaTab();
  }
  function disegnaSchedaTab() {
    const box = $('#tv-dice'), host = $('#tv-schc'); if (!box || isDM()) return;
    const on = !!T.stab && !!host;
    box.classList.toggle('sch', on);
    if (host) box.querySelectorAll('.tv-dtab button').forEach(x => { const s2 = x.dataset.act === 'tv-schtab' ? on : !on; x.classList.toggle('on', s2); x.setAttribute('aria-selected', s2); });
    if (!on) { if (T.sv?.chat) T.sv.d.close(); else if (!T.scal) { const l = $('#tv-log'); if (l) l.scrollTop = 1e9; } return; }
    if (T.sv?.chat && T.sv.d.isConnected) return;
    if (T.sv?.chat) T.sv.d.close();
    const s = miaScheda();
    if (!s) { host.innerHTML = '<div class="tv-tvuoto">La tua scheda compare qui quando il DM prepara il tavolo.</div>'; return; }
    if (T.sv?.d.open && !T.sv.chat) return segnaposto();
    const tk = [...T.tok.values()].find(t => t.scena === T.vista && schedaDi(t)?.id === s.id);
    apriScheda(s.id, tk?.id || null, host, true);
  }
  // la scheda è stata chiusa o aperta in una finestra: nella sezione resta un pulsante per riportarla qui
  function segnaposto() {
    const host = $('#tv-schc'); if (!host || !T.stab || T.sv?.chat) return;
    host.innerHTML = `<div class="tv-tvuoto">${T.sv?.d.open ? 'La scheda è aperta in una finestra.' : 'Hai chiuso la scheda.'}<button type="button" class="btn sm" data-k="qui">📜 Riapri qui la scheda</button></div>`;
    host.querySelector('[data-k=qui]').onclick = () => { if (T.sv?.d.open) T.sv.d.close(); disegnaSchedaTab(); };
  }
  // la scaletta del DM (scaletta.js) prende il posto della chat nella stessa colonna; i dadi si tirano nascosti
  function apriScaletta(on) {
    T.scal = !!on && isDM();
    if (T.scal) { if ($('#tv-dice')?.hidden) apriChat(true); $('#tv-tdp') && ($('#tv-tdp').hidden = true); }
    disegnaScaletta(); disegnaRail();
  }
  function disegnaScaletta() {
    const box = $('#tv-dice'), host = $('#tv-scal'); if (!box) return;
    const on = !!T.scal && !!host;
    box.classList.toggle('scal', on);
    box.querySelectorAll('.tv-dtab button').forEach(x => { const s = x.dataset.act === 'tv-scaletta' ? on : !on; x.classList.toggle('on', s); x.setAttribute('aria-selected', s); });
    if (on) window.__scaletta.pannello(host, { tira: (f, m) => tira(f, null, true, m ? 'Scaletta · ' + m : 'Scaletta') });
    else if (!T.scal) { const l = $('#tv-log'); if (l) l.scrollTop = 1e9; }
  }
  function segnaPriv() {
    const b = $('#tv-dice [data-k=cpriv]'); if (!b) return;
    b.classList.toggle('on', !!T.tdpriv); b.setAttribute('aria-pressed', !!T.tdpriv); b.textContent = T.tdpriv ? '🙈 Nascosto' : '👁 Tutti';
    b.title = T.tdpriv ? (isDM() ? 'Tiri nascosti: li vedi solo tu' : 'Tiri nascosti: li vedete solo tu e il DM') : 'Tiri visibili a tutti (tocca per nasconderli)';
  }
  function dadiActs() {
    return {
      'tv-tira': () => scrivi(),
      // il DM svuota la chat di gioco (messaggi e tiri, per tutti): il primo tocco chiede conferma
      'tv-svuota': async () => {
        const b = $('.tv-svuota'); if (!b || b.disabled) return;
        const riposo = () => { b.classList.remove('arm'); b.textContent = '🗑'; };
        if (!b.classList.contains('arm')) { b.classList.add('arm'); b.textContent = 'Svuota tutto?'; clearTimeout(T.svT); T.svT = setTimeout(riposo, 4000); return; }
        clearTimeout(T.svT); b.disabled = true;
        const [a, c] = await Promise.all([SB.from('tavolo_tiri').delete().gt('id', 0), SB.from('tavolo_chat').delete().gt('id', 0)]);
        b.disabled = false; riposo();
        if (a.error || c.error) return toast((a.error || c.error).message, 'err');
        T.tiri = []; T.chat = []; disegnaLog(); toast('Chat svuotata.');
      },
      'tv-anim': () => { const on = !animazioni(); try { localStorage.setItem(ANIM, on ? '1' : '0'); } catch { } const b = $('.tv-anim'); if (b) { b.classList.toggle('on', on); b.title = 'Animazioni degli attacchi: ' + (on ? 'accese' : 'spente'); b.setAttribute('aria-pressed', on); } toast(on ? 'Animazioni accese.' : 'Animazioni spente: vedrai solo l\'esito dei colpi.'); }
    };
  }
  // la riga in fondo alla chat: /w nome testo (o /w dm testo) sussurra, il resto è un messaggio per tutti.
  // i dadi si tirano solo dal Tiradadi
  async function scrivi() {
    const f = $('#tv-f'), t = f.value.trim(); if (!t) return;
    if (/^\/(r|roll|gr|gmroll)\b/i.test(t)) { toast('I dadi si tirano dai pulsanti qui sopra o dal Tiradadi.', 'err'); return; }
    let testo = t, per = null;
    const w = t.match(/^\/w\s+(\S+)\s+([\s\S]+)$/i);
    if (w) {
      const chi = norm(w[1]);
      if (chi === 'dm' || chi === 'gm') per = 'dm';
      else { const g = T.membri.find(x => x.giocatore && (norm(x.nome) === chi || x.giocatore === chi)); if (!g) { toast('Nessun giocatore si chiama «' + w[1] + '»', 'err'); return; } per = g.giocatore; }
      testo = w[2];
    } else if (/^\//.test(t)) { toast('Per sussurrare: /w nome messaggio (oppure /w dm messaggio)', 'err'); return; }
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
    return t || true;
  }
  // 20 o 1 naturale su un tiro di d20
  function esito(t) {
    const m = String(t.dettaglio).match(/^(?:\dd20(?:k[hl]1)?) \[(?:[^\]]*→ )?(\d+)\]/);
    return m ? (m[1] === '20' ? 'crit' : m[1] === '1' ? 'fail' : '') : '';
  }
  // la foto di chi scrive: quella del suo personaggio, o del suo token; il DM ha la corona
  function avatar(uid, nome) {
    const m = (T.membri || []).find(x => x.user_id === uid);
    if (m?.ruolo === 'dm') return '<i class="av dm" aria-hidden="true">👑</i>';
    let img = m?.immagine || null;
    if (!img && m?.giocatore) img = [...T.tok.values()].find(t => t.giocatore === m.giocatore && t.immagine)?.immagine || null;
    if (!img && m?.giocatore) { const g = (T.info?.giocatori || []).find(x => x.id === m.giocatore); img = S.ents?.get(g?.pg || (m.giocatore === T.me.giocatore ? T.me.pg : null))?.portrait?.thumb || null; }
    return img ? `<i class="av" style="background-image:url('${esc(img)}')" aria-hidden="true"></i>` : `<i class="av" style="--c:${coloreDi(uid)}" aria-hidden="true">${esc(iniziali(nome))}</i>`;
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
  // che tiro è: per colpire, danni, danni in più… (dal motivo scritto dal tavolo, anche nel formato di prima della tappa 9)
  const TIPI_TIRO = { '🎯': ['att', '🎯 Tiro per colpire'], '💥': ['dan', '💥 Danni'], '🧪': ['dan', '🧪 Danni in più (tiro salvezza)'] };
  function tipoTiro(mo) {
    mo = String(mo || ''); let m;
    const es = x => /💥 CRITICO$/.test(x) ? ['crit', '💥 Critico!'] : /✅ COLPITO$/.test(x) ? ['si', '✅ Colpito'] : /❌ MANCATO$/.test(x) ? ['no', '❌ Mancato'] : null;
    const senza = x => x.replace(/ · (💥 CRITICO|✅ COLPITO|❌ MANCATO|CA sconosciuta)$/, '');
    if ((m = mo.match(/^(🎯|💥|🧪) [^·]+ · (.+)$/u))) { const [k, l] = TIPI_TIRO[m[1]]; return { k, l, d: senza(m[2]), es: es(mo) }; }
    if ((m = mo.match(/^➕ ([^·]+) · (.+)$/u))) return { k: 'ext', l: '➕ ' + m[1].trim(), d: m[2] };
    if ((m = mo.match(/^(.+? → .+?) · conferma del critico$/))) return { k: 'att', l: '🎲 Conferma del critico', d: m[1] };
    if ((m = mo.match(/^(.+?) · TS ([A-Z]{3}) CD (\d+)(?: contro (.+))?$/))) return { k: 'ts', l: '🛡 Tiro salvezza', d: `${m[1]} · ${m[2]} CD ${m[3]}${m[4] ? ' contro ' + m[4] : ''}` };
    if ((m = mo.match(/^(.+?) · (.+) \(area\)$/))) return { k: 'dan', l: '💥 Danni ad area', d: `${m[2]} · ${m[1]}` };
    if ((m = mo.match(/^(.+? → .+?) · danni in più \(TS\)$/))) return { k: 'dan', l: '🧪 Danni in più (tiro salvezza)', d: m[1] };
    if ((m = mo.match(/^(.+? → .+?) · danni( \(critico[^)]*\))?$/))) return { k: 'dan', l: '💥 Danni', d: m[1] + (m[2] ? ' · critico ×2' : '') };
    if ((m = mo.match(/^(.+?) → (.+?) · (.+)$/))) return { k: 'att', l: '🎯 Tiro per colpire', d: `${m[3]} · ${m[1]} → ${m[2]}` };
    if ((m = mo.match(/^(.+?) · Attacco: (.+)$/))) return { k: 'att', l: '🎯 Tiro per colpire', d: `${m[2]} · ${m[1]}` };
    if ((m = mo.match(/^(.+?) · Danni: (.+)$/))) return { k: 'dan', l: '💥 Danni', d: `${m[2]} · ${m[1]}` };
    return null;
  }
  const rigaTiro = t => { const tt = tipoTiro(t.motivo); return `<div class="tv-roll ${esito(t)} ${t.privato ? 'priv' : ''} ${t.autore === T.me.uid ? 'me' : ''}${tt ? ' k-' + tt.k : ''}">${tagTiro(t)}<div class="h"><span class="who">${avatar(t.autore, t.nome)}${esc(t.nome)}</span><span class="dx"><small>${ora(t.creato)}</small>${via('t', t)}</span></div>
    ${tt ? `<div class="kt"><b>${esc(tt.l)}</b>${tt.es ? `<span class="es ${tt.es[0]}">${tt.es[1]}</span>` : ''}</div><div class="m">${esc(tt.d)}</div>` : t.motivo ? `<div class="m">${esc(t.motivo)}</div>` : ''}<div class="fo">tira ${esc(t.formula)}</div><div class="r"><span class="chips">${chips(t.dettaglio)}</span><span class="t">${t.totale}</span></div></div>`; };
  const nomeGioc = id => id === 'dm' ? 'DM' : T.membri.find(x => x.giocatore === id)?.nome || id;
  const rigaMsg = m => `<div class="tv-roll tv-msg ${m.per ? 'w' : ''} ${m.autore === T.me.uid ? 'me' : ''}">${tagMsg(m)}<div class="h"><span class="who">${avatar(m.autore, m.nome)}${esc(m.nome)}</span><span class="dx"><small>${ora(m.creato)}</small>${via('c', m)}</span></div><div class="tx">${esc(m.testo)}</div></div>`;
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
    if (!$('#tv-dice') || $('#tv-dice').hidden) { $('#tv-ctab')?.classList.add('nuovo'); toast(`${t.nome}${t.motivo ? ' (' + t.motivo + ')' : ''}: ${t.formula} = ${t.totale}`); }
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
  // stili dei dadi: ognuno sceglie il suo nel tiradadi («Il mio dado») e gli altri lo vedono dalla presenza sul canale
  // [chiave, nome, descrizione, [luce, colore, ombra, numeri, effetto]]
  const STILI_DADI = [
    ['auto', 'Automatico', 'il colore assegnato a te', null],
    ['avalar', 'Avalar', 'bordeaux e oro', ['#c9505d', '#7c1f2b', '#3a0a12', '#f0cf7c', 'lucido']],
    ['rubino', 'Rubino', 'gemma, numeri d\'oro', ['#ff8a95', '#c0182f', '#5c0613', '#ffd77a', 'gemma']],
    ['zaffiro', 'Zaffiro', 'gemma, numeri d\'argento', ['#8fb4ff', '#1f48b8', '#0a1a52', '#eef3ff', 'gemma']],
    ['smeraldo', 'Smeraldo', 'gemma, numeri d\'oro', ['#8ff0b4', '#14894a', '#043d1f', '#ffe39a', 'gemma']],
    ['ametista', 'Ametista', 'viola con brillantini', ['#d7a8ff', '#7a2fc0', '#2e0a52', '#ffffff', 'brillantini']],
    ['ossidiana', 'Ossidiana', 'nero lucido, numeri d\'oro', ['#5a5560', '#1b181d', '#050405', '#e6c36a', 'lucido']],
    ['oro', 'Oro antico', 'metallo', ['#fff1b8', '#c99a2e', '#6b4a0c', '#4a2f05', 'metallo']],
    ['argento', 'Argento', 'acciaio lucidato', ['#ffffff', '#a9b2bd', '#4b545e', '#1e252c', 'metallo']],
    ['rame', 'Rame', 'metallo caldo', ['#ffc9a3', '#b8622e', '#5a250a', '#2e1203', 'metallo']],
    ['osso', 'Osso', 'avorio, numeri incisi', ['#fffaf0', '#e6d9bd', '#a8946b', '#3a2a14', 'opaco']],
    ['legno', 'Legno', 'quercia con venature', ['#d9a36b', '#9b6332', '#4f2c10', '#fbe8c8', 'legno']],
    ['marmo', 'Marmo', 'bianco venato', ['#ffffff', '#e9e6e1', '#a9a39b', '#7c1f2b', 'marmo']],
    ['fiamma', 'Fiamma', 'dal giallo al rosso', ['#ffe36b', '#ff6a1a', '#9e1006', '#ffffff', 'fiamma']],
    ['ghiaccio', 'Ghiaccio', 'azzurro trasparente', ['#ffffff', '#9fe3ff', '#2f86b8', '#0b3b5c', 'gemma']],
    ['veleno', 'Veleno', 'verde acido che brilla', ['#e6ff8a', '#5fd11c', '#1d5e05', '#0f2a02', 'luce']],
    ['nebulosa', 'Nebulosa', 'galassia con stelle', ['#e08cff', '#4b2fb8', '#0b0730', '#ffffff', 'stelle']]
  ];
  const MISURE_DADI = { p: ['Piccolo', 58], m: ['Medio', 78], g: ['Grande', 108] }, DADO_K = 'tavolo-dado';
  const stileDado = k => STILI_DADI.find(x => x[0] === k) || STILI_DADI[0];
  function mioDado() {
    let v = null; try { v = JSON.parse(localStorage.getItem(DADO_K)); } catch { }
    return { s: stileDado(v?.s)[0], d: MISURE_DADI[v?.d] ? v.d : 'm' };
  }
  const dadoDi = uid => uid && uid === T.me?.uid ? mioDado() : { s: stileDado(T.dadi?.[uid]?.s)[0], d: MISURE_DADI[T.dadi?.[uid]?.d] ? T.dadi[uid].d : 'm' };
  // la presenza sul canale porta il nome e lo stile del dado
  const tracciaDado = () => { if (T.ch && T.live) T.ch.track({ nome: T.me.nome, dado: mioDado() }).catch(() => { }); };
  // brillantini, stelle e venature sempre uguali per lo stesso stile (non tremano mentre il dado gira)
  function decori(fx, k) {
    let h = 7; for (const c of k) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const r = (a, b) => { h = (h * 1664525 + 1013904223) >>> 0; return a + (h / 4294967296) * (b - a); };
    const n = (x, d = 1) => x.toFixed(d);
    if (fx === 'brillantini' || fx === 'stelle') return Array.from({ length: fx === 'stelle' ? 30 : 40 }, () => `<circle cx="${n(r(5, 95))}" cy="${n(r(5, 95))}" r="${n(r(0.5, 1.6))}" fill="#fff" opacity="${n(r(0.4, 1), 2)}"/>`).join('') + (fx === 'stelle' ? '<ellipse cx="60" cy="40" rx="35" ry="14" fill="#ff7ad9" opacity=".25" transform="rotate(-25 60 40)"/>' : '');
    if (fx === 'legno') return Array.from({ length: 14 }, (_, i) => `<path d="M-5 ${8 + i * 7}C25 ${2 + i * 7} 55 ${15 + i * 7} 105 ${5 + i * 7}" stroke="#3b1f08" stroke-opacity=".35" stroke-width="${n(r(0.6, 1.8))}" fill="none"/>`).join('');
    if (fx === 'marmo') return Array.from({ length: 6 }, () => `<path d="M${n(r(-10, 40), 0)} ${n(r(0, 100), 0)}C${n(r(20, 60), 0)} ${n(r(0, 100), 0)} ${n(r(40, 80), 0)} ${n(r(0, 100), 0)} ${n(r(80, 110), 0)} ${n(r(0, 100), 0)}" stroke="#6f6a63" stroke-opacity=".45" stroke-width="${n(r(0.5, 1.4))}" fill="none"/>`).join('');
    if (fx === 'gemma') return '<polygon points="20,15 45,10 30,40" fill="#fff" opacity=".28"/>';
    return '';
  }
  function svgDado(f, v, col, k) {
    const s = FORME[f] || FORME[20], id = 'g' + Math.random().toString(36).slice(2, 8), st = k && stileDado(k)[3];
    const forma = f === 6 ? '<rect x="10" y="10" width="80" height="80" rx="14"/>' : `<polygon points="${s.p}" stroke-linejoin="round"/>`;
    if (!st) return `<svg viewBox="0 0 100 100"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient></defs>
      ${f === 6 ? `<rect x="10" y="10" width="80" height="80" rx="14" fill="${col}" stroke="#0007" stroke-width="3"/><rect x="10" y="10" width="80" height="80" rx="14" fill="url(#${id})"/>` : `<polygon points="${s.p}" fill="${col}" stroke="#0007" stroke-width="3" stroke-linejoin="round"/><polygon points="${s.p}" fill="url(#${id})"/>`}
      ${s.l ? `<path d="${s.l}" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="2"/>` : ''}<text x="50" y="${s.y}">${v}</text></svg>`;
    const [a, b, c, num, fx] = st;
    const grad = fx === 'metallo' ? `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".3" stop-color="${b}"/><stop offset=".5" stop-color="${a}"/><stop offset=".72" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient>`
      : fx === 'fiamma' ? `<linearGradient id="${id}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${c}"/><stop offset=".5" stop-color="${b}"/><stop offset="1" stop-color="${a}"/></linearGradient>`
      : `<radialGradient id="${id}" cx="32%" cy="26%" r="85%"><stop offset="0" stop-color="${a}"/><stop offset=".55" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></radialGradient>`;
    const scuro = !['metallo', 'opaco', 'marmo', 'luce'].includes(fx);
    return `<svg viewBox="0 0 100 100"${fx === 'luce' ? ` style="filter:drop-shadow(0 0 7px ${a})"` : ''}><defs>${grad}<clipPath id="${id}c">${forma}</clipPath></defs>
      <g clip-path="url(#${id}c)"><g fill="url(#${id})"${fx === 'gemma' ? ' fill-opacity=".9"' : ''}>${forma}</g>${decori(fx, k)}${s.l ? `<path d="${s.l}" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1.8"/>` : ''}</g>
      <g fill="none" stroke="#0008" stroke-width="2.4">${forma}</g><text x="50" y="${s.y}" style="fill:${num};stroke:${scuro ? '#0008' : '#fff6'}">${v}</text></svg>`;
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
    const md = dadoDi(t.autore), k = md.s === 'auto' ? null : md.s, px = MISURE_DADI[md.d][1], sc = px / 78;
    const da = { x: -40, y: H + 40 }, cx = W * (0.3 + Math.random() * 0.4), cy = H * (0.35 + Math.random() * 0.3);
    mostra.forEach((d, i) => {
      const el = document.createElement('div'); el.className = 'dd' + (d.via ? ' via' : ''); box.append(el);
      if (px !== 78) el.style.cssText = `width:${px}px;height:${px}px;margin:${-px / 2}px 0 0 ${-px / 2}px`;
      const ang = (i / mostra.length) * Math.PI * 2 + Math.random(), r = mostra.length > 1 ? (56 + mostra.length * 9) * sc : 0;
      const x = clamp(cx + Math.cos(ang) * r, 50, W - 50), y = clamp(cy + Math.sin(ang) * r, 50, H - 50);
      const mx = (da.x + x) / 2 + (Math.random() - 0.5) * 120, rot = 360 * (2 + Math.floor(Math.random() * 2)), fin = (Math.random() - 0.5) * 40, dur = 2000 + Math.random() * 400;
      el.animate([
        { transform: `translate(${da.x}px,${da.y}px) rotate(0deg) scale(.6)` },
        { transform: `translate(${mx}px,${y - 140}px) rotate(${rot * 0.55}deg) scale(1.15)`, offset: 0.45 },
        { transform: `translate(${x - 18}px,${y}px) rotate(${rot * 0.85}deg) scale(1)`, offset: 0.72 },
        { transform: `translate(${x - 6}px,${y - 26}px) rotate(${rot * 0.95}deg) scale(1.05)`, offset: 0.84 },
        { transform: `translate(${x}px,${y}px) rotate(${rot + fin}deg) scale(1)` }
      ], { duration: dur, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' });
      // durante il volo le facce cambiano, poi resta il risultato
      const gira = setInterval(() => { el.innerHTML = svgDado(d.f, 1 + Math.floor(Math.random() * d.f), col, k); }, 110);
      el.innerHTML = svgDado(d.f, d.v, col, k);
      setTimeout(() => { clearInterval(gira); el.innerHTML = svgDado(d.f, d.v, col, k); }, dur * 0.8);
      setTimeout(() => el.animate([{ opacity: d.via ? 0.45 : 1 }, { opacity: 0 }], { duration: 500, fill: 'forwards' }).onfinish = () => el.remove(), dur + 3200);
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
    const nebbia = nebbiaQui(sc); T.fogKey = chiaveVista(sc);
    if (!sc.maschera && !nebbia) { c.hidden = true; disegnaMuri(); return; }
    // la tela è più piccola della mappa (al massimo 2048 px di lato): basta per i bordi e pesa poco
    const k = Math.min(1, FOG_MAX / Math.max(sc.larghezza, sc.altezza)), W = Math.max(1, Math.round(sc.larghezza * k)), H = Math.max(1, Math.round(sc.altezza * k));
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const g = c.getContext('2d', { willReadFrequently: true });
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W, H);
    g.setTransform(k, 0, 0, k, 0, 0);
    if (nebbia) {
      // nebbia automatica: tutto buio, tranne ciò che vedono i token (e, in penombra, ciò che hanno già visto)
      g.fillStyle = NERO; g.fillRect(0, 0, sc.larghezza, sc.altezza);
      const segs = muriScena(sc).filter(chiuso).map(m => m.punti), cono = sc.cono !== false;
      const viste = occhi(sc).map(o => cono ? { ...o, pts: poligono(o, segs, sc) } : { ...o, ombre: ombre(o, segs, sc) });
      g.globalCompositeOperation = 'destination-out';
      if (!isDM() && sc.esplora !== false) {
        const e = esplorato(sc); segnaEsplorato(e, viste);
        g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 0.45; g.drawImage(e.c, 0, 0, W, H); g.globalAlpha = 1; g.setTransform(k, 0, 0, k, 0, 0);
      }
      viste.forEach(o => buca(g, o));
      if (!isDM() && !viste.length && T.avvisato !== sc.id) { T.avvisato = sc.id; toast('Non hai un token su questa mappa: vedi solo i posti già esplorati.'); }
      // senza i token dei giocatori la nebbia coprirebbe tutto anche al DM: lui la mappa la vede chiara, e glielo dico una volta
      if (isDM() && !viste.length) {
        g.globalCompositeOperation = 'source-over'; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); g.setTransform(k, 0, 0, k, 0, 0);
        if (T.avvisatoDm !== sc.id) { T.avvisatoDm = sc.id; toast('Nebbia automatica accesa ma nessun personaggio dei giocatori su questa mappa: loro la vedono tutta buia. Tu la vedi chiara finché non metti i loro token.'); }
      }
    }
    if (sc.maschera) {
      // la maschera del DM si somma alla nebbia: la disegno a parte e la appoggio sopra
      const m = T.mcan || (T.mcan = document.createElement('canvas')); m.width = W; m.height = H;
      const h = m.getContext('2d'); h.setTransform(k, 0, 0, k, 0, 0); h.fillStyle = NERO; h.fillRect(0, 0, sc.larghezza, sc.altezza);
      for (const o of T.mask.filter(x => x.scena === sc.id).sort((a, b) => a.id - b.id)) applica(h, o);
      g.globalCompositeOperation = 'source-over'; g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(m, 0, 0); g.setTransform(k, 0, 0, k, 0, 0);
    }
    g.globalCompositeOperation = 'source-over';
    c.hidden = false; c.style.opacity = isDM() ? tono() : 1; T.fogK = k;
    disegnaMuri();
  }
  const coperto = (x, y) => alfa(x, y) > 128;
  function programmaMaschera() { cancelAnimationFrame(T.mraf); T.mraf = requestAnimationFrame(() => { disegnaMaschera(); disegnaToken(); }); }
  function barraMaschera() {
    const b = $('#tv-mbar'), sc = scena(); if (!b) return;
    b.dataset.t = T.mira ? '' : { maschera: 'Maschera', muri: 'Muri, porte e nebbia', difficile: 'Terreno difficile', effetti: 'Effetti sulla mappa', segni: 'Segnalini', griglia: 'Griglia', allinea: 'Allinea la griglia', righello: 'Righello' }[T.tool] || '';
    if (T.tool === 'allinea' && isDM() && sc) return barraAllinea(b);
    if (T.mira && sc) { const s2 = T.schede?.get(T.mira.sid), tk = T.tok.get(T.mira.tok); if (s2 && tk) return barraMira(armaMira(T.mira) || {}, tk); }
    if (T.critico && sc && !b.hidden) return; // la conferma del critico aspetta una risposta
    if (T.passo && sc && !b.hidden) return; // e anche quella del movimento
    if (T.tool === 'righello' && sc) return barraRighello(b);
    if (T.tool === 'muri' && isDM() && sc) return barraMuri(b);
    if (T.tool === 'griglia' && isDM() && sc) return barraGriglia(b);
    if (T.tool === 'difficile' && isDM() && sc) return barraDifficile(b);
    if (T.tool === 'effetti' && isDM() && sc) return barraEffetti(b);
    if (T.tool === 'segni' && isDM() && sc) return barraSegnalini(b);
    if (T.tool !== 'maschera' || !isDM() || !sc) { b.hidden = true; disegnaRighelli(); return; }
    if (!T.mraggio) T.mraggio = sc.griglia;
    const on = sc.maschera, dis = on ? '' : 'disabled', bt = (k, ic, l, sel, tip) => `<button type="button" data-m="${k}" class="${sel ? 'on' : ''}" ${dis} title="${esc(tip || l)}">${ic ? svg(ic) : ''}<span>${l}</span></button>`;
    b.innerHTML = `<div class="g"><label class="sw" title="Con la maschera attiva la mappa parte tutta coperta per i giocatori"><input type="checkbox" data-m="attiva" ${on ? 'checked' : ''}><span class="tg" aria-hidden="true"></span>Maschera</label></div>
      <div class="g seg">${bt('svela', 'occhio', 'Svela', T.mmodo === 'svela', 'Togli la maschera dove trascini')}${bt('copri', 'velo', 'Copri', T.mmodo === 'copri', 'Rimetti la maschera dove trascini')}</div>
      <div class="g seg">${bt('rett', 'rett', 'Rettangolo', T.mforma === 'rett')}${bt('pennello', 'penn', 'Pennello', T.mforma === 'pennello')}</div>
      ${T.mforma === 'pennello' ? `<div class="g sl" title="Grandezza del pennello, in caselle"><span>Pennello</span><input type="range" class="tv-rg" data-m="raggio" min="0.25" max="10" step="0.25" value="${T.mraggio / sc.griglia}" ${dis} aria-label="Grandezza del pennello"><output data-m="rv">${fmtCas(T.mraggio / sc.griglia)}</output></div>` : ''}
      <div class="g">${bt('annulla', 'undo', '', false, 'Annulla l\'ultima modifica').replace('<span></span>', '')}${bt('tutto', '', 'Svela tutto', false)}${bt('niente', '', 'Copri tutto', false)}</div>
      <div class="g sl" title="Solo per te: i giocatori la vedono sempre nera">${svg('luna')}<input type="range" class="tv-rg" data-m="tono" min="0.1" max="0.95" step="0.05" value="${tono()}" ${dis} aria-label="Tono della maschera (solo per te)"><output data-m="tv">${Math.round(tono() * 100)}%</output></div>`;
    b.classList.toggle('spenta', !on); b.querySelectorAll('.tv-rg').forEach(pRange);
    b.hidden = false;
    b.querySelector('[data-m=attiva]').onchange = async e => {
      const r = await SB.from('tavolo_scene').update({ maschera: e.target.checked }).eq('id', sc.id).select().single();
      if (r.error) { toast(r.error.message, 'err'); e.target.checked = !e.target.checked; return; }
      T.scene.set(sc.id, r.data); programmaMaschera(); barraMaschera();
    };
    b.querySelectorAll('button[data-m]').forEach(x => x.onclick = () => azioneMaschera(x.dataset.m).catch(err => toast(err.message, 'err')));
    const rg = b.querySelector('[data-m=raggio]'); if (rg) rg.oninput = () => { T.mraggio = +rg.value * sc.griglia; b.querySelector('[data-m=rv]').value = fmtCas(+rg.value); };
    const tn = b.querySelector('[data-m=tono]'); tn.oninput = () => { try { localStorage.setItem(TONO, tn.value); } catch { } const c = $('#tv-fog'); if (c) c.style.opacity = tn.value; b.querySelector('[data-m=tv]').value = Math.round(tn.value * 100) + '%'; };
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
  // griglia a mano: si trascina sulla mappa (o con le frecce) finché combacia con quella disegnata
  const fmtPx = n => (Math.round(n * 10) / 10).toLocaleString('it-IT') + ' px';
  function spostaGriglia(dx, dy, dg) {
    const sc = scena(); if (!sc) return;
    if (dg) sc.griglia = clamp(Math.round((sc.griglia + dg) * 100) / 100, 8, 600);
    sc.griglia_x = Math.round((sc.griglia_x + dx) * 100) / 100; sc.griglia_y = Math.round((sc.griglia_y + dy) * 100) / 100;
    disegnaGriglia();
    const b = $('#tv-mbar'), o = n => { const g = sc.griglia; return fmtPx(((n % g) + g) % g); };
    if (b) { b.querySelector('[data-g=x]').value = o(sc.griglia_x); b.querySelector('[data-g=y]').value = o(sc.griglia_y); b.querySelector('[data-g=g]').value = fmtPx(sc.griglia); }
  }
  function barraGriglia(b) {
    const sc = scena(), bt = (k, l, tip, cls) => `<button type="button" data-g="${k}" class="${cls || ''}" title="${esc(tip)}" aria-label="${esc(tip)}">${l}</button>`;
    b.innerHTML = `<div class="g"><b class="tit">✋ Sposta la griglia</b></div>
      <div class="g sl"><span>↔</span><output data-g="x"></output><span>↕</span><output data-g="y"></output></div>
      <div class="g sl" title="Lato della casella: con Maiusc va di un pixel alla volta"><span>Casella</span>${bt('gm', svg('meno'), 'Casella più piccola')}<output data-g="g"></output>${bt('gp', svg('piu'), 'Casella più grande')}</div>
      <div class="g"><span class="avv">Trascina sulla mappa; frecce: 1 px, con Maiusc 0,1 px</span></div>
      <div class="g">${bt('ann', 'Annulla', 'Torna a com\'era')}${bt('ok', '✓ Salva', 'Salva la posizione della griglia', 'on')}</div>`;
    b.classList.remove('spenta'); b.hidden = false; spostaGriglia(0, 0);
    b.querySelector('[data-g=gm]').onclick = e => spostaGriglia(0, 0, e.shiftKey ? -1 : -0.1);
    b.querySelector('[data-g=gp]').onclick = e => spostaGriglia(0, 0, e.shiftKey ? 1 : 0.1);
    b.querySelector('[data-g=ann]').onclick = () => strumento('muovi');
    b.querySelector('[data-g=ok]').onclick = () => salvaGriglia().catch(err => toast(err.message, 'err'));
  }
  function annullaGriglia() { const sc = scena(), g = T.gm; T.gm = T.gd = null; if (sc && g) { Object.assign(sc, g.prima); disegnaGriglia(); disegnaToken(); } }
  async function salvaGriglia() {
    const sc = scena(); if (!sc) return;
    const g = sc.griglia, n = v => Math.round((((v % g) + g) % g) * 100) / 100;
    const r = await SB.from('tavolo_scene').update({ griglia: g, griglia_x: n(sc.griglia_x), griglia_y: n(sc.griglia_y) }).eq('id', sc.id).select().single();
    if (r.error) throw new Error(r.error.message);
    T.gm = null; Object.assign(sc, r.data); T.scene.set(sc.id, sc); riaggancia(sc);
    strumento('muovi'); disegnaGriglia(); disegnaToken(); toast('Griglia salvata.');
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

  /* ---------- muri, porte e nebbia automatica (tappa 4): ognuno vede solo ciò che vedono i suoi token ---------- */
  const SNAP = 'tavolo-muri-griglia', ESP = 'tavolo-esplorato-';
  const CIECO = ['Accecato', 'Svenuto', 'Morto', 'Pietrificato'];
  const aggancioGriglia = () => { try { return localStorage.getItem(SNAP) === '1'; } catch { return false; } };
  const muriScena = sc => (T.muri || []).filter(m => m.scena === sc.id);
  const chiuso = m => !m.porta || !m.aperta;
  // il DM vede la nebbia come la maschera: sopra la mappa, con la sua opacità
  const nebbiaQui = sc => !!sc?.visuale && !!T.muri;
  function distSeg(px, py, s) {
    const vx = s[2] - s[0], vy = s[3] - s[1], l2 = vx * vx + vy * vy, q = l2 ? clamp(((px - s[0]) * vx + (py - s[1]) * vy) / l2, 0, 1) : 0;
    return Math.hypot(px - s[0] - q * vx, py - s[1] - q * vy);
  }
  // il tratto a→b attraversa il muro c→d?
  function taglia(ax, ay, bx, by, [cx, cy, dx, dy]) {
    const r1 = bx - ax, r2 = by - ay, s1 = dx - cx, s2 = dy - cy, den = r1 * s2 - r2 * s1;
    if (Math.abs(den) < 1e-9) return false;
    const t = ((cx - ax) * s2 - (cy - ay) * s1) / den, u = ((cx - ax) * r2 - (cy - ay) * r1) / den;
    return t > 1e-6 && t < 1 - 1e-6 && u >= 0 && u <= 1;
  }
  const attraversa = (sc, ax, ay, bx, by) => muriScena(sc).some(m => chiuso(m) && taglia(ax, ay, bx, by, m.punti));
  // chi guarda: per il giocatore i suoi token (con la vista di gruppo anche quelli dei compagni), per il DM tutti quelli dei giocatori
  function occhi(sc) {
    const tutti = isDM() || sc.vista_condivisa, d = T.drag;
    return [...T.tok.values()].filter(t => t.scena === sc.id && t.giocatore && !t.nascosto && (tutti || t.giocatore === T.me.giocatore)).map(t => {
      const l = t.misura * sc.griglia;
      let x = t.x + l / 2, y = t.y + l / 2;
      // mentre lo trascini vede dalla nuova posizione, ma non al di là di un muro
      if (d?.id === t.id && d.mosso && (isDM() || !attraversa(sc, x, y, d.x + l / 2, d.y + l / 2))) { x = d.x + l / 2; y = d.y + l / 2; }
      const cieco = condTok(t).some(c => CIECO.includes(c));
      return { id: t.id, x: clamp(x, 0, sc.larghezza), y: clamp(y, 0, sc.altezza), r: cieco ? l / 2 : t.vista == null ? 0 : l / 2 + t.vista / (sc.metri || 1.5) * sc.griglia };
    });
  }
  // la zona che si vede da un punto: un raggio verso ogni estremo dei muri, fermato dal muro più vicino
  function poligono(o, segs, sc) {
    const R = o.r || Infinity, x0 = Math.max(0, o.x - R), y0 = Math.max(0, o.y - R), x1 = Math.min(sc.larghezza, o.x + R), y1 = Math.min(sc.altezza, o.y + R);
    const tutti = (o.r ? segs.filter(s => distSeg(o.x, o.y, s) < R) : segs).concat([[x0, y0, x1, y0], [x1, y0, x1, y1], [x1, y1, x0, y1], [x0, y1, x0, y0]]);
    const ang = [];
    for (const s of tutti) for (let i = 0; i < 4; i += 2) { const a = Math.atan2(s[i + 1] - o.y, s[i] - o.x); ang.push(a - 1e-5, a, a + 1e-5); }
    ang.sort((a, b) => a - b);
    const pts = []; let prima = null;
    for (const a of ang) {
      if (prima !== null && a - prima < 1e-7) continue; prima = a;
      const dx = Math.cos(a), dy = Math.sin(a); let best = Infinity;
      for (const s of tutti) {
        const s1 = s[2] - s[0], s2 = s[3] - s[1], den = dx * s2 - dy * s1; if (Math.abs(den) < 1e-12) continue;
        const t = ((s[0] - o.x) * s2 - (s[1] - o.y) * s1) / den, u = ((s[0] - o.x) * dy - (s[1] - o.y) * dx) / den;
        if (t > 1e-9 && t < best && u >= -1e-9 && u <= 1 + 1e-9) best = t;
      }
      if (best < Infinity) pts.push(o.x + dx * best, o.y + dy * best);
    }
    return pts;
  }
  // senza cono d'ombra: dietro ogni muro c'è la sua «ombra», e resta buio solo dove se ne sommano un numero dispari
  // (dentro una stanza chiusa vista da fuori, o fuori dalla stanza vista da dentro); dietro la stanza si torna a vedere
  function ombre(o, segs, sc) {
    const K = 4 * (sc.larghezza + sc.altezza), R = o.r || Infinity, fuori = (x, y) => { const l = Math.hypot(x - o.x, y - o.y) || 1; return [x + (x - o.x) / l * K, y + (y - o.y) / l * K]; };
    return segs.filter(m => !o.r || distSeg(o.x, o.y, m) < R).map(([ax, ay, bx, by]) => [ax, ay, bx, by, ...fuori(bx, by), ...fuori(ax, ay)]);
  }
  // toglie dalla tela la zona vista (con la vista limitata, sfumata verso il bordo)
  function buca(g, o) {
    if (o.ombre) {
      const R = o.r || Infinity, x0 = Math.max(0, o.x - R), y0 = Math.max(0, o.y - R), x1 = Math.min(1e7, o.x + R), y1 = Math.min(1e7, o.y + R);
      g.save(); g.beginPath(); g.rect(x0, y0, Math.min(x1 - x0, 1e7), Math.min(y1 - y0, 1e7));
      for (const q of o.ombre) { g.moveTo(q[0], q[1]); for (let i = 2; i < 8; i += 2) g.lineTo(q[i], q[i + 1]); g.closePath(); }
      if (o.r) { g.clip('evenodd'); const gr = g.createRadialGradient(o.x, o.y, o.r * 0.8, o.x, o.y, o.r); gr.addColorStop(0, '#000'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(o.x, o.y, o.r, 0, Math.PI * 2); g.fill(); }
      else { g.fillStyle = '#000'; g.fill('evenodd'); }
      g.restore(); return;
    }
    if (o.pts.length < 6) return;
    g.save(); g.beginPath(); g.moveTo(o.pts[0], o.pts[1]);
    for (let i = 2; i < o.pts.length; i += 2) g.lineTo(o.pts[i], o.pts[i + 1]);
    g.closePath();
    if (o.r) {
      g.clip(); const gr = g.createRadialGradient(o.x, o.y, o.r * 0.8, o.x, o.y, o.r); gr.addColorStop(0, '#000'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(o.x, o.y, o.r, 0, Math.PI * 2);
    } else g.fillStyle = '#000';
    g.fill(); g.restore();
  }
  const chiaveVista = sc => [sc.id, sc.visuale, sc.cono, sc.esplora, sc.vista_condivisa, sc.griglia, sc.metri, sc.larghezza, sc.altezza, T.wver, isDM(), T.esp?.v, nebbiaQui(sc) ? occhi(sc).map(o => `${o.id}:${Math.round(o.x)}:${Math.round(o.y)}:${Math.round(o.r)}`).join() : ''].join('|');
  // le zone già viste restano in penombra: le ricorda il browser di ogni giocatore
  function esplorato(sc) {
    if (T.esp?.id === sc.id) return T.esp;
    const k = Math.min(1, 1024 / Math.max(sc.larghezza, sc.altezza)), c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(sc.larghezza * k)); c.height = Math.max(1, Math.round(sc.altezza * k));
    const e = T.esp = { id: sc.id, c, k, v: 0 };
    try {
      const u = localStorage.getItem(ESP + sc.id);
      if (u) { const im = new Image(); im.onload = () => { if (T.esp !== e) return; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); e.v++; programmaMaschera(); }; im.src = u; }
    } catch { }
    return e;
  }
  function segnaEsplorato(e, viste) {
    const g = e.c.getContext('2d'); g.setTransform(e.k, 0, 0, e.k, 0, 0); g.globalCompositeOperation = 'source-over';
    viste.forEach(o => buca(g, o));
    clearTimeout(T.espT); T.espT = setTimeout(() => { try { localStorage.setItem(ESP + e.id, e.c.toDataURL()); } catch { } }, 1500);
  }
  function dimenticaEsplorato(id) {
    clearTimeout(T.espT); try { localStorage.removeItem(ESP + id); } catch { }
    if (T.esp?.id === id) T.esp = null;
    programmaMaschera();
  }
  // quanto è coperto un punto della mappa (0 = si vede, 255 = buio)
  function alfa(x, y) {
    const c = $('#tv-fog'); if (!c || c.hidden) return 0;
    const k = T.fogK || 1;
    return c.getContext('2d', { willReadFrequently: true }).getImageData(clamp(Math.floor(x * k), 0, c.width - 1), clamp(Math.floor(y * k), 0, c.height - 1), 1, 1).data[3];
  }
  // una porta si vede se è in vista o già esplorata da almeno un lato
  function inVista(m) {
    const [x1, y1, x2, y2] = m.punti, l = Math.hypot(x2 - x1, y2 - y1) || 1, mx = (x1 + x2) / 2, my = (y1 + y2) / 2, nx = -(y2 - y1) / l * 8, ny = (x2 - x1) / l * 8;
    return alfa(mx + nx, my + ny) < 250 || alfa(mx - nx, my - ny) < 250;
  }
  function disegnaMuri() {
    const w = $('#tv-walls'), pb = $('#tv-porte'), sc = scena(); if (!w || !pb || !sc) return;
    const lista = muriScena(sc), edit = isDM() && T.tool === 'muri';
    const porte = lista.filter(m => m.porta && (isDM() ? sc.visuale || edit : sc.visuale && inVista(m)));
    const ln = (m, c) => `<line class="${c}" x1="${m.punti[0]}" y1="${m.punti[1]}" x2="${m.punti[2]}" y2="${m.punti[3]}"/>`;
    w.innerHTML = (edit ? lista.filter(m => !m.porta).map(m => ln(m, 'mu')).join('') : '') + porte.map(m => ln(m, 'po' + (m.aperta ? ' ap' : ''))).join('');
    pb.innerHTML = porte.map(m => {
      const tip = m.bloccata && !isDM() ? 'Porta chiusa a chiave' : (m.aperta ? 'Chiudi la porta' : 'Apri la porta') + (isDM() ? ' · tasto destro: chiave o elimina' : '');
      return `<button type="button" class="tv-porta ${m.aperta ? 'ap' : ''} ${m.bloccata ? 'bl' : ''}" data-id="${m.id}" style="left:${(m.punti[0] + m.punti[2]) / 2}px;top:${(m.punti[1] + m.punti[3]) / 2}px" data-tip="${tip}" aria-label="${tip}">${svg(m.bloccata && !m.aperta ? 'lucc' : m.aperta ? 'portaAp' : 'porta')}</button>`;
    }).join('');
  }
  async function apriPorta(id) {
    const m = T.muri?.find(x => x.id === id); if (!m) return;
    if (m.bloccata && !isDM()) return toast('La porta è chiusa a chiave.', 'err');
    const prima = m.aperta; m.aperta = !prima; T.wver++; programmaMaschera();
    const r = await SB.rpc('tavolo_porta', { p_id: id, p_aperta: m.aperta });
    if (r.error) { m.aperta = prima; T.wver++; programmaMaschera(); toast(r.error.message, 'err'); }
  }
  function menuPorta(id, e) {
    const m = T.muri?.find(x => x.id === id), st = $('#tv-stage'); if (!m || !st) return;
    chiudiPop();
    const r = st.getBoundingClientRect(), pop = document.createElement('div'); pop.className = 'tv-pop';
    pop.innerHTML = `<b>🚪 Porta</b><button class="btn sm" data-k="ap">${m.aperta ? 'Chiudi' : 'Apri'}</button><button class="btn sm" data-k="bl">${m.bloccata ? '🔓 Togli la chiave' : '🔒 Chiudi a chiave'}</button><button class="btn sm danger" data-k="via">Elimina la porta</button>`;
    st.append(pop);
    pop.style.left = clamp(e.clientX - r.left + 8, 6, r.width - pop.offsetWidth - 6) + 'px'; pop.style.top = clamp(e.clientY - r.top + 8, 6, r.height - pop.offsetHeight - 6) + 'px';
    pop.querySelector('[data-k=ap]').onclick = () => { chiudiPop(); apriPorta(id); };
    pop.querySelector('[data-k=bl]').onclick = async () => {
      chiudiPop(); const ch = m.bloccata ? { bloccata: false } : { bloccata: true, aperta: false };
      const r2 = await SB.from('tavolo_muri').update(ch).eq('id', id).select().single(); if (r2.error) return toast(r2.error.message, 'err');
      Object.assign(m, r2.data); T.wver++; programmaMaschera();
    };
    pop.querySelector('[data-k=via]').onclick = () => { chiudiPop(); cancellaMuro(m); };
  }
  // punto del muro: si attacca agli estremi dei muri vicini (per chiudere le stanze) e, se scelto, agli angoli delle caselle
  // la porta si appoggia sul muro più vicino: il primo punto ovunque lungo il muro, il secondo sullo stesso muro
  function sulMuro(p, m) {
    const [x1, y1, x2, y2] = m.punti, dx = x2 - x1, dy = y2 - y1, l = dx * dx + dy * dy || 1;
    const t = clamp(((p.x - x1) * dx + (p.y - y1) * dy) / l, 0, 1);
    return { x: Math.round((x1 + t * dx) * 10) / 10, y: Math.round((y1 + t * dy) * 10) / 10, t, m };
  }
  function puntaPorta(p, e) {
    const fisso = (T.mdown?.a || T.mu?.a)?.m;
    let q = null;
    if (fisso) q = sulMuro(p, fisso);
    else { let bd = 18 / T.view.z; for (const m of muriScena(scena())) { if (m.porta) continue; const r = sulMuro(p, m), d = Math.hypot(r.x - p.x, r.y - p.y); if (d < bd) { bd = d; q = r; } } }
    if (!q) return null;
    // con l'aggancio alla griglia la porta cade sugli angoli delle caselle, se sono sul muro
    if (aggancioGriglia() && !e?.altKey) { const sc = scena(), g = sc.griglia, c = { x: sc.griglia_x + Math.round((q.x - sc.griglia_x) / g) * g, y: sc.griglia_y + Math.round((q.y - sc.griglia_y) / g) * g }, r = sulMuro(c, q.m); if (Math.hypot(r.x - c.x, r.y - c.y) < 1) q = r; }
    return q;
  }
  function punta(p, e) {
    if (T.mtool === 'porta') { const q = puntaPorta(p, e); if (q) return q; }
    const sc = scena(), cand = muriScena(sc).flatMap(m => [[m.punti[0], m.punti[1]], [m.punti[2], m.punti[3]]]);
    if (T.mu?.a) cand.push([T.mu.a.x, T.mu.a.y]);
    let best = null, bd = 12 / T.view.z;
    for (const [x, y] of cand) { const d = Math.hypot(x - p.x, y - p.y); if (d < bd) { bd = d; best = { x, y }; } }
    if (best) return best;
    if (aggancioGriglia() && !e?.altKey) { const s = sc.griglia; return { x: Math.round((sc.griglia_x + Math.round((p.x - sc.griglia_x) / s) * s) * 10) / 10, y: Math.round((sc.griglia_y + Math.round((p.y - sc.griglia_y) / s) * s) * 10) / 10 }; }
    return { x: Math.round(p.x), y: Math.round(p.y) };
  }
  function muroVicino(p) {
    let best = null, bd = 10 / T.view.z;
    for (const m of muriScena(scena())) { const d = distSeg(p.x, p.y, m.punti); if (d < bd) { bd = d; best = m; } }
    return best;
  }
  async function salvaMuro(a, b) {
    const sc = scena(); if (!sc || Math.hypot(b.x - a.x, b.y - a.y) < 3) return;
    const r = await SB.from('tavolo_muri').insert({ scena: sc.id, punti: [a.x, a.y, b.x, b.y], porta: T.mtool === 'porta' }).select().single();
    if (r.error) return toast(sqlMancante(r.error) ? 'Per i muri esegui tavolo/tappa-4.sql in Supabase.' : r.error.message, 'err');
    if (!T.muri.some(m => m.id === r.data.id)) T.muri.push(r.data);
    T.mfatti.push(r.data.id);
    if (r.data.porta && a.m && a.m === b.m && T.muri.includes(a.m)) await apriVarco(a.m, a, b, r.data.id);
    T.wver++; programmaMaschera(); barraMaschera();
  }
  // la porta prende il posto del pezzo di muro sotto di lei: da aperta si passa (e si vede) attraverso
  async function apriVarco(m, a, b, porta) {
    const [x1, y1, x2, y2] = m.punti, [p, q] = a.t <= b.t ? [a, b] : [b, a];
    const pezzi = [[x1, y1, p.x, p.y], [q.x, q.y, x2, y2]].filter(([ax, ay, bx, by]) => Math.hypot(bx - ax, by - ay) >= 3);
    const ins = pezzi.length ? await SB.from('tavolo_muri').insert(pezzi.map(punti => ({ scena: m.scena, punti, porta: false }))).select() : { data: [] };
    if (ins.error) return toast(ins.error.message, 'err');
    const del = await SB.from('tavolo_muri').delete().eq('id', m.id); if (del.error) return toast(del.error.message, 'err');
    T.muri = T.muri.filter(x => x.id !== m.id); for (const n of ins.data) if (!T.muri.some(x => x.id === n.id)) T.muri.push(n);
    T.mvarchi.set(porta, { punti: m.punti, scena: m.scena, pezzi: ins.data.map(n => n.id) });
  }
  // annullando la porta il muro torna intero
  async function chiudiVarco(porta) {
    const v = T.mvarchi.get(porta); if (!v) return; T.mvarchi.delete(porta);
    for (const id of v.pezzi) { const m = T.muri.find(x => x.id === id); if (m) await cancellaMuro(m); }
    const r = await SB.from('tavolo_muri').insert({ scena: v.scena, punti: v.punti, porta: false }).select().single(); if (r.error) return toast(r.error.message, 'err');
    if (!T.muri.some(m => m.id === r.data.id)) T.muri.push(r.data); T.wver++; programmaMaschera();
  }
  async function cancellaMuro(m) {
    T.muri = T.muri.filter(x => x.id !== m.id); T.wver++; programmaMaschera();
    const r = await SB.from('tavolo_muri').delete().eq('id', m.id);
    if (r.error) { T.muri.push(m); T.wver++; programmaMaschera(); toast(r.error.message, 'err'); }
  }
  function inizioMuro(p, e) {
    if (!T.muri) { toast('Per i muri esegui tavolo/tappa-4.sql in Supabase.', 'err'); return; }
    if (T.mtool === 'gomma') { T.mgom = new Set(); gomma(p); return; }
    T.mdown = { a: punta(p, e), sx: e.clientX, sy: e.clientY };
  }
  function gomma(p) { const m = muroVicino(p); if (m && !T.mgom.has(m.id)) { T.mgom.add(m.id); cancellaMuro(m); } }
  function muoviMuro(p, e) {
    if (T.mgom) { T.mhov = p; gomma(p); disegnaRighelli(); return; }
    T.mhov = punta(p, e); disegnaRighelli();
  }
  // trascinando si disegna un muro; cliccando si mettono i punti uno dopo l'altro (doppio clic, Invio o Esc per finire)
  function fineMuro(p, e) {
    if (T.mgom) { T.mgom = null; return; }
    const d = T.mdown; if (!d) return;
    const b = punta(p, e); T.mdown = null;
    if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 6) { T.mu = null; salvaMuro(d.a, b); }
    else if (!T.mu) T.mu = { a: d.a };
    else if (Math.hypot(b.x - T.mu.a.x, b.y - T.mu.a.y) < 3) T.mu = null;
    else { salvaMuro(T.mu.a, b); T.mu = T.mtool === 'porta' ? null : { a: b }; }
    T.mhov = b; disegnaRighelli();
  }
  function anteprimaMuro(v) {
    const S = p => [v.x + p.x * v.z, v.y + p.y * v.z], b = T.mhov; if (!b) return '';
    if (T.mtool === 'gomma') {
      const m = muroVicino(b); if (!m) return '';
      const [ax, ay] = S({ x: m.punti[0], y: m.punti[1] }), [bx, by] = S({ x: m.punti[2], y: m.punti[3] });
      return `<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="#ff4d4d" stroke-width="7" stroke-linecap="round" opacity=".8"/>`;
    }
    const a = T.mdown?.a || T.mu?.a, [bx, by] = S(b), col = T.mtool === 'porta' ? '#f0a548' : '#ff5ad1';
    let h = '';
    if (a) { const [ax, ay] = S(a); h += `<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="#000a" stroke-width="6" stroke-linecap="round"/><line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="${col}" stroke-width="3" stroke-dasharray="8 5" stroke-linecap="round"/><circle cx="${ax}" cy="${ay}" r="4" fill="${col}"/>`; }
    return h + `<circle cx="${bx}" cy="${by}" r="5" fill="none" stroke="${col}" stroke-width="2"/>`;
  }
  function barraMuri(b) {
    const sc = scena();
    if (!T.muri) {
      b.innerHTML = `<div class="g"><span class="avv">Per muri, porte e nebbia automatica esegui <b>tavolo/tappa-4.sql</b> nell'SQL Editor di Supabase, poi ricarica la pagina.</span></div>`;
      b.hidden = false; return;
    }
    const sw = (k, on, l, tip) => `<label class="sw" title="${esc(tip)}"><input type="checkbox" data-w="${k}" ${on ? 'checked' : ''}><span class="tg" aria-hidden="true"></span>${l}</label>`;
    const bt = (k, ic, l, sel, tip, dis) => `<button type="button" data-w="${k}" class="${sel ? 'on' : ''}" title="${esc(tip || l)}" aria-label="${esc(tip || l)}" ${dis ? 'disabled' : ''}>${ic ? svg(ic) : ''}${l ? `<span>${l}</span>` : ''}</button>`;
    const n = muriScena(sc).length;
    b.innerHTML = `<div class="g">${sw('visuale', sc.visuale, 'Nebbia automatica', 'I giocatori vedono solo ciò che vedono i loro token: i muri fermano la vista')}</div>
      <div class="g seg">${bt('muro', 'muro', 'Muro', T.mtool === 'muro', 'Disegna i muri: trascina, oppure clicca punto per punto (doppio clic o Esc per finire)')}${bt('porta', 'porta', 'Porta', T.mtool === 'porta', 'Disegna una porta sopra un muro: si aggancia al muro e da aperta lascia passare')}${bt('gomma', 'gomma', 'Gomma', T.mtool === 'gomma', 'Clicca o passa sui muri per cancellarli')}</div>
      <div class="g">${bt('griglia', 'gri', '', aggancioGriglia(), 'Aggancia i punti agli angoli delle caselle (tieni Alt per staccarli)')}${bt('annulla', 'undo', '', false, 'Annulla l\'ultimo muro', !T.mfatti.some(id => T.muri.some(m => m.id === id)))}</div>
      <div class="g sl" title="Solo per te: i giocatori la vedono sempre nera">${svg('luna')}<input type="range" class="tv-rg" data-w="tono" min="0.1" max="0.95" step="0.05" value="${tono()}" aria-label="Opacità della nebbia (solo per te)"><output data-w="tv">${Math.round(tono() * 100)}%</output></div>
      <div class="g">${sw('cono', sc.cono !== false, 'Cono d\'ombra', 'Acceso: i muri proiettano l\'ombra e non si vede cosa c\'è dietro. Spento: restano buie solo le stanze chiuse in cui il token non è')}${sw('esplora', sc.esplora !== false, 'Zone viste', 'I posti già visti restano in penombra')}${sw('vista_condivisa', !!sc.vista_condivisa, 'Vista di gruppo', 'Ogni giocatore vede anche ciò che vedono i compagni')}</div>
      <div class="g">${bt('dimentica', '', 'Dimentica le zone viste', false, 'Le zone già esplorate tornano buie per tutti')}${bt('svuota', '', `Cancella i muri${n ? ` (${n})` : ''}`, false, 'Cancella tutti i muri e le porte di questa mappa', !n)}</div>`;
    b.classList.remove('spenta'); b.hidden = false;
    b.querySelectorAll('.tv-rg').forEach(pRange);
    const tn = b.querySelector('[data-w=tono]'); tn.oninput = () => { try { localStorage.setItem(TONO, tn.value); } catch { } const c = $('#tv-fog'); if (c) c.style.opacity = tn.value; b.querySelector('[data-w=tv]').value = Math.round(tn.value * 100) + '%'; };
    b.querySelectorAll('input[type=checkbox][data-w]').forEach(x => x.onchange = async () => {
      const r = await SB.from('tavolo_scene').update({ [x.dataset.w]: x.checked }).eq('id', sc.id).select().single();
      if (r.error) { x.checked = !x.checked; return toast(sqlMancante(r.error) || /column/i.test(r.error.message) ? `Esegui tavolo/tappa-${x.dataset.w === 'cono' ? 9 : 4}.sql in Supabase.` : r.error.message, 'err'); }
      T.scene.set(sc.id, r.data);
      programmaMaschera(); barraMaschera();
      if (x.dataset.w === 'visuale' && x.checked && !occhi(r.data).length) toast('Nessun token è assegnato a un giocatore: dal menu del token scegli chi lo muove, così vedrà da lì.');
    });
    b.querySelectorAll('button[data-w]').forEach(x => x.onclick = async () => {
      const k = x.dataset.w;
      if (k === 'muro' || k === 'porta' || k === 'gomma') { T.mtool = k; T.mu = null; }
      else if (k === 'griglia') { try { localStorage.setItem(SNAP, aggancioGriglia() ? '0' : '1'); } catch { } }
      else if (k === 'annulla') { const id = [...T.mfatti].reverse().find(i => T.muri.some(m => m.id === i)), m = T.muri.find(x => x.id === id); if (m) { T.mfatti = T.mfatti.filter(i => i !== id); await cancellaMuro(m); await chiudiVarco(id); } }
      else if (k === 'dimentica') {
        if (!await ask('Le zone già esplorate tornano buie per tutti i giocatori. Continuare?', { ok: 'Dimentica', title: 'Zone viste' })) return;
        manda('esplorato', { scena: sc.id }); toast('Fatto: i giocatori vedono di nuovo solo ciò che hanno davanti.');
      } else if (k === 'svuota') {
        if (!await ask(`Cancellare tutti i muri e le porte di **${sc.nome}**?`, { ok: 'Cancella', danger: true, title: 'Muri' })) return;
        const r = await SB.from('tavolo_muri').delete().eq('scena', sc.id); if (r.error) return toast(r.error.message, 'err');
        T.muri = T.muri.filter(m => m.scena !== sc.id); T.wver++; programmaMaschera();
      }
      barraMaschera(); disegnaRighelli();
    });
  }

  /* ---------- attacchi con bersaglio (tappa 5): si sceglie il nemico sulla mappa, il tavolo controlla distanza e CA ---------- */
  const ANIM = 'tavolo-animazioni';
  const animazioni = () => { try { const v = localStorage.getItem(ANIM); return v ? v === '1' : !matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return true; } };
  const ELEM = [[/fuoco/i, '#ff7b2e'], [/fredd|gelo/i, '#7fd8ff'], [/fulmin|elettric/i, '#ffe45c'], [/acid/i, '#9be15d'], [/veleno/i, '#7bd66a'], [/radios/i, '#ffe8a3'], [/necrotic/i, '#b07cff'], [/forza/i, '#c58bff'], [/psichic/i, '#ff7ad9'], [/tuono/i, '#9fb4ff']];
  const FERMO = ['Incapacitato', 'Paralizzato', 'Pietrificato', 'Stordito', 'Svenuto', 'Morto'];
  const TS_RE = /\b(?:ts|tiro salvezza|salvezza)\s+(?:su\s+|di\s+)?(?:for|des|cos|int|sag|car)/i;
  const metri = n => n.toLocaleString('it-IT', { maximumFractionDigits: 1 }) + ' m';
  // fin dove arriva un attacco, letto da «tipo e note»: «gittata 24/96 m», «anche da lancio 6/18 m», «portata 3 m»
  function portata(a) {
    const tx = `${a.tipo || ''} ${a.nome || ''}`, f = x => parseFloat(String(x).replace(',', '.'));
    let m = tx.match(/(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)\s*m\b/i), dist = null;
    if (m) dist = [f(m[1]), f(m[2])]; else if ((m = tx.match(/gittata\s*(?:di\s*)?(\d+(?:[.,]\d+)?)\s*m\b/i))) dist = [f(m[1]), f(m[1])];
    const p = tx.match(/portata\s*(?:di\s*)?(\d+(?:[.,]\d+)?)\s*m\b/i), el = ELEM.find(([r]) => r.test(tx));
    const ar = tx.match(/\b(sfera|raggio|cilindro|emanazione|cubo|cono|linea)\s*(?:di\s*)?(\d+(?:[.,]\d+)?)\s*m\b/i);
    const area = ar ? { forma: /cubo/i.test(ar[1]) ? 'cubo' : /cono/i.test(ar[1]) ? 'cono' : /linea/i.test(ar[1]) ? 'linea' : 'cerchio', m: f(ar[2]) } : null;
    // «TS Destrezza CD 13»: niente tiro per colpire, il bersaglio tira il salvezza (ma «+ 2d8 da veleno (TS…)» resta un attacco)
    const ts = TS_RE.test(tx) && !/\+\s*\d+\s*d\s*\d+/i.test(a.tipo || '');
    // il pugnale boomerang si lancia (6/18 m, come un pugnale) e torna in mano
    const ritorna = /boomerang|ritorna|torna in mano/i.test(tx); if (ritorna && !dist) dist = [6, 18];
    const lancio = /lancio/i.test(tx) || ritorna;
    return { mischia: !area && (!dist || lancio), reach: p ? f(p[1]) : 1.5, dist, col: el?.[1] || null, area, ts, lancio, ritorna };
  }
  // distanza come sul regolamento: caselle tra i bordi dei token (le diagonali contano 1), due token vicini sono a 1,5 m
  function distanza(a, b, sc) {
    const g = sc.griglia, la = a.misura * g, lb = b.misura * g;
    const dx = Math.max(0, Math.abs(a.x + la / 2 - b.x - lb / 2) - (la + lb) / 2), dy = Math.max(0, Math.abs(a.y + la / 2 - b.y - lb / 2) - (la + lb) / 2);
    return (Math.round(Math.max(dx, dy) / g) + 1) * (sc.metri || 1.5);
  }
  // Tattica del branco (banditi, lupi, coboldi…): vantaggio se un alleato non incapacitato è entro 1,5 m dal bersaglio
  // effetti in combattimento dei tratti: si scelgono nella ⚙ del tratto (alcuni si riconoscono dal nome)
  const EFFETTI_TR = [['', 'Nessuno: solo testo'], ['branco', 'Vantaggio se un alleato è accanto al bersaglio (Tattica del branco)'], ['vant_att', 'Vantaggio ai suoi tiri per colpire'], ['svant_att', 'Svantaggio ai suoi tiri per colpire'],
    ['svant_contro', 'Chi lo attacca ha svantaggio'], ['vant_contro', 'Chi lo attacca ha vantaggio'], ['ts_colpo', 'Quando colpisce, il bersaglio fa un tiro salvezza'], ['vant_ts', 'Vantaggio ai suoi tiri salvezza']];
  const effettoDi = p => p.eff !== undefined ? p.eff : /tattic\w* (?:del|di) branco/.test(norm(p.nome)) ? 'branco' : /resistenza alla magia/.test(norm(p.nome)) ? 'vant_ts' : '';
  const effetti = (s, e) => s ? (s.dati.privilegi || []).filter(p => !p.off && effettoDi(p) === e) : [];
  const vantTS = (s, car) => effetti(s, 'vant_ts').find(p => !p.ts_car || p.ts_car === car);
  const tatticaBranco = s => effetti(s, 'branco').length > 0 || /tattic\w* (?:del|di) branco/i.test([s.dati.tratti, s.dati.azioni].join('\n'));
  const latoTok = t => t.giocatore || schedaDi(t)?.tipo === 'pg' ? 'pg' : 'png';
  const alleatoVicino = (a, b, sc) => [...T.tok.values()].find(t => t.scena === sc.id && t.id !== a.id && t.id !== b.id && latoTok(t) === latoTok(a)
    && !condTok(t).some(c => FERMO.includes(c)) && distanza(t, b, sc) <= (sc.metri || 1.5) + 0.01);
  // si può attaccare? con che modo (mischia o distanza) e con vantaggio o svantaggio, spiegando perché
  function valuta(m, b) {
    const sc = scena(), a = T.tok.get(m.tok), s = T.schede?.get(m.sid), at = armaMira(m);
    if (!sc || !a || !at) return { ok: false, motivo: 'Attacco non trovato.' };
    if (b.id === a.id) return { ok: false, motivo: '' };
    const ca = condTok(a), cb = condTok(b), nb = b.nome || 'il bersaglio';
    if (cb.includes('Morto')) return { ok: false, motivo: `${nb} è già sconfitto.` };
    const fermo = ca.find(c => FERMO.includes(c)); if (fermo) return { ok: false, motivo: `${a.nome} non può attaccare: è ${fermo.toLowerCase()}.` };
    const l = g => g.misura * sc.griglia / 2;
    if (sc.visuale && T.muri && attraversa(sc, a.x + l(a), a.y + l(a), b.x + l(b), b.y + l(b))) return { ok: false, motivo: `C'è un muro tra ${a.nome} e ${nb}.` };
    const p = portata(at), d = distanza(a, b, sc), pro = [], contro = [];
    let modo;
    if (p.mischia && d <= p.reach + 0.01) modo = 'mischia';
    else if (p.dist && d <= p.dist[1] + 0.01) { modo = 'distanza'; if (d > p.dist[0] + 0.01) contro.push('oltre la gittata normale'); }
    else return { ok: false, motivo: `Troppo lontano: ${nb} è a ${metri(d)}, ${at.nome || 'l\'attacco'} arriva a ${metri(p.dist ? p.dist[1] : p.reach)}.` };
    if (['Accecato', 'Avvelenato', 'Spaventato', 'Trattenuto'].some(c => ca.includes(c))) contro.push(`${a.nome} è ${ca.find(c => ['Accecato', 'Avvelenato', 'Spaventato', 'Trattenuto'].includes(c)).toLowerCase()}`);
    if (ca.includes('Prono')) contro.push(`${a.nome} è prono`);
    if (ca.includes('Invisibile')) pro.push(`${a.nome} è invisibile`);
    const vb = ['Accecato', 'Paralizzato', 'Pietrificato', 'Stordito', 'Svenuto', 'Trattenuto'].find(c => cb.includes(c)); if (vb) pro.push(`${nb} è ${vb.toLowerCase()}`);
    if (cb.includes('Prono')) (d <= 1.51 ? pro : contro).push(`${nb} è prono`);
    if (cb.includes('Invisibile')) contro.push(`${nb} è invisibile`);
    const ai = aiutoPer(a); if (ai) pro.push(`aiutato da ${ai.h.nome}`);
    if (schiva(b)) contro.push(`${nb} sta schivando`);
    const br = s && tatticaBranco(s) && alleatoVicino(a, b, sc); if (br) pro.push(`tattica del branco: ${br.nome || 'un alleato'} è accanto a ${nb}`);
    const sb = schedaDi(b);
    effetti(s, 'vant_att').forEach(p => pro.push(p.nome || 'un tratto')); effetti(s, 'svant_att').forEach(p => contro.push(p.nome || 'un tratto'));
    effetti(sb, 'vant_contro').forEach(p => pro.push(`${nb}: ${p.nome || 'un tratto'}`)); effetti(sb, 'svant_contro').forEach(p => contro.push(`${nb}: ${p.nome || 'un tratto'}`));
    if (m.adv === 1) pro.push('scelto dalla scheda'); if (m.adv === 2) contro.push('scelto dalla scheda');
    const adv = pro.length && !contro.length ? 1 : contro.length && !pro.length ? 2 : 0;
    return { ok: true, modo, d, adv, pro, contro, anim: modo === 'mischia' ? 'spada' : p.col ? 'magia' : p.lancio ? 'lancio' : 'freccia', col: p.col, ritorna: modo === 'distanza' && p.ritorna, aiuto: ai };
  }
  // il token con cui attacca chi apre la scheda: il suo personaggio, o il PNG da cui il DM ha aperto la scheda
  function attaccante(s) {
    const sc = scena(); if (!sc) return null;
    const tk = tokScheda(); if (tk) return tk;
    const l = [...T.tok.values()].filter(t => t.scena === sc.id && schedaDi(t)?.id === s.id && puoMuovere(t));
    return l.length === 1 ? l[0] : null;
  }
  /* ---------- incantesimi come voci alla Roll20: si aprono, si modificano e si lanciano ---------- */
  const SCUOLE = ['Abiurazione', 'Ammaliamento', 'Divinazione', 'Evocazione', 'Illusione', 'Invocazione', 'Necromanzia', 'Trasmutazione'];
  const bonusInc = s => comp(s) + modC(s.dati[carInc(s)]);
  // come tavolo_inc_att in tappa-7.sql: l'incantesimo scritto come un attacco che il tavolo sa leggere
  function attDaInc(s, sp) {
    if (!s || !sp) return null;
    const g = String(sp.portata || '').match(/(\d+(?:[.,]\d+)?)\s*m(?:etri)?\b/i), self = /^\s*(s[eé]|contatto|personale|incantatore)/i.test(sp.portata || '');
    const tipo = [g && !self ? `gittata ${g[1]} m` : '', sp.area || '', sp.ts ? `TS ${sp.ts} CD ${8 + bonusInc(s)}${sp.dimezza ? ' dimezza' : ''}` : '', sp.tipo_danni || ''].filter(Boolean).join(', ');
    return { nome: sp.nome || 'Incantesimo', colpire: sp.attacco ? bonusInc(s) : '', danni: sp.danni || '', tipo };
  }
  const incDaAtt = (s, at) => {
    const k = chiaveInc(String(at?.nome || '').split(/[,(]/)[0]); if (!k) return -1;
    return (s.dati.incantesimi || []).findIndex(sp => (num(sp.livello) || 0) > 0 && [sp.nome, sp.alt].some(n => { const q = chiaveInc(String(n || '').split(/[,(]/)[0]); return q && (q === k || k.startsWith(q + ' ')); }));
  };
  const armaMira = m => { const s = T.schede?.get(m.sid); if (!s) return null; return m.inc != null ? attDaInc(s, s.dati.incantesimi?.[m.inc]) : s.dati.attacchi?.[m.i]; };
  // lanciare un incantesimo di 1° livello o più consuma uno slot di quel livello
  function usaSlot(s, inc, liv) {
    const sp = s?.dati.incantesimi?.[inc], lv = liv || num(sp?.livello) || 0; if (!sp || !lv || !puoScrivere(s)) return;
    const tot = num(s.dati['slot_' + lv]) || 0, usati = num(s.dati['usati_' + lv]) || 0; if (!tot) return;
    salvaScheda(s.id, { ['usati_' + lv]: Math.min(tot, usati + 1) }, true);
  }
  // «Ai livelli superiori»: i dadi in più per ogni livello di slot sopra quello dell'incantesimo (come tavolo_inc_att in tappa-9.sql)
  const piuInc = sp => String(sp?.piu || sp?.testo || '').match(/(\d+)d(\d+)(?: danni)? (?:per ogni|per ciascun) (?:slot di )?livello (?:di slot )?superiore/i);
  function danniInc(sp, liv) {
    const lv = num(sp?.livello) || 0, d = String(sp?.danni || '').replace(/\s+/g, ''), p = piuInc(sp);
    return liv > lv && lv && p && /\d/.test(d) ? `${d}+${p[1] * (Math.min(liv, 9) - lv)}d${p[2]}` : d;
  }
  // con quale slot si lancia: solo i livelli dall'incantesimo in su che hanno slot in scheda (null: annullato)
  function sceltaLivello(s, sp) {
    const lv = num(sp.livello) || 0; if (!lv) return Promise.resolve(0);
    const L = []; for (let i = lv; i <= 9; i++) { const tot = num(s.dati['slot_' + i]) || 0; if (tot) L.push([i, Math.max(tot - (num(s.dati['usati_' + i]) || 0), 0), tot]); }
    if (!L.length) return Promise.resolve(lv);
    const p = piuInc(sp), liberi = L.some(([, r]) => r > 0);
    return new Promise(res => {
      const d = openDlg(`<form method="dialog"><h3>✨ ${esc(sp.nome || 'Incantesimo')}</h3><p class="hint">Incantesimo di ${lv}° livello: con quale slot lo lanci?${p && /\d/.test(sp.danni || '') ? ` Ogni livello in più aggiunge ${esc(p[1] + 'd' + p[2])} ai danni.` : ''}</p>
        <div class="tv-liv">${L.map(([i, r, tot]) => `<button value="${i}" class="btn ${i === lv ? 'primary' : 'ghost'}"${r ? '' : ' disabled'}><b>${i}°</b><small>${r} di ${tot} slot</small>${i > lv && p && /\d/.test(sp.danni || '') ? `<small>${esc(danniInc(sp, i))}</small>` : ''}</button>`).join('')}</div>
        ${liberi ? '' : `<p class="hint">Non hai più slot liberi.</p>`}
        <menu><button value="cancel" class="btn ghost">Annulla</button>${liberi ? '' : `<button value="senza" class="btn">Lancia lo stesso (${lv}°)</button>`}</menu></form>`, 'tv-livd');
      d.addEventListener('close', () => res(d.returnValue === 'senza' ? lv : /^\d$/.test(d.returnValue) ? +d.returnValue : null));
    });
  }
  async function lanciaInc(s, inc) {
    const sp = s.dati.incantesimi?.[inc]; if (!sp) return;
    const liv = await sceltaLivello(s, sp); if (liv == null) return;
    const lv = liv || num(sp.livello) || 0, tot = num(s.dati['slot_' + lv]) || 0, usati = num(s.dati['usati_' + lv]) || 0;
    if (lv && tot && usati >= tot && !await ask(`Non hai più slot di ${lv}° livello. Lanciare lo stesso **${sp.nome || 'l\'incantesimo'}**?`, { ok: 'Lancia', title: 'Slot finiti' })) return;
    // si sceglie il bersaglio sulla mappa per tutti gli incantesimi che arrivano su qualcuno (non quelli su di sé)
    const at = attDaInc(s, sp), pa = portata(at), su = /^\s*(s[eé]|personale|incantatore)\b/i.test(sp.portata || '');
    const mira = !!(pa.area || !su && (String(sp.portata || '').trim() || sp.ts || sp.attacco || String(sp.danni || '').trim()));
    const tk = mira ? attaccante(s) : null;
    if (tk) return iniziaMira(s, 0, tk, inc, lv);
    if (mira && scena() && [...T.tok.values()].filter(t => t.scena === scena().id && schedaDi(t)?.id === s.id).length > 1) toast('Per scegliere il bersaglio apri la scheda dal token che lancia.');
    // senza bersagli da scegliere: lo annuncio in chat, tiro gli eventuali dadi e consumo lo slot
    const chi = s.nome || 'Qualcuno';
    const base = num(sp.livello) || 0, dn = danniInc(sp, lv);
    await SB.rpc('tavolo_scrivi', { p_testo: `✨ ${chi} lancia ${sp.nome || 'un incantesimo'}${lv ? ` (${lv > base ? `slot di ${lv}° livello, è di ${base}°` : `${lv}° livello`})` : ''}${sp.conc ? ' · concentrazione' : ''}` });
    if (sp.attacco) await tiroD20(s, bonusInc(s), 'Attacco: ' + (sp.nome || 'incantesimo'));
    if (dn) tira(dn, null, T.sv?.seg, `${chi} · Danni: ${sp.nome || 'Incantesimo'}${lv > base ? ` (slot di ${lv}°)` : ''}`);
    usaSlot(s, inc, lv);
    const t = tokScheda() || attaccante(s); if (t && suoTurno(t) && /azione bonus/i.test(sp.tempo || '')) segnaAzioni(t, { bon: true }); else if (t && suoTurno(t) && /^\s*1\s*azione/i.test(sp.tempo || '')) segnaAzioni(t, { az: true });
  }
  /* ---------- manuale degli incantesimi: l'SRD 5.1 in italiano, caricato solo quando serve ---------- */
  let SRD = null;
  const chiaveInc = n => String(n || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  function manuale() {
    SRD = SRD || fetch('incantesimi.json').then(r => r.ok ? r.json() : Promise.reject(new Error(r.status))).then(j => {
      // si trova anche col nome inglese (Fireball → Palla di fuoco)
      const en = x => String(x.en || '').split(' / ').filter(Boolean);
      T.srd = { ...j, per: new Map(j.incantesimi.flatMap(x => [[chiaveInc(x.nome), x], ...en(x).map(n => [chiaveInc(n), x])])) };
      if (!document.getElementById('tv-srd-l')) {
        const dl = document.createElement('datalist'), liv = x => `${x.livello ? x.livello + '° livello' : 'Trucchetto'} · ${x.scuola}`; dl.id = 'tv-srd-l';
        dl.innerHTML = j.incantesimi.map(x => `<option value="${esc(x.nome)}">${esc(liv(x))}${x.en ? ' · ' + esc(x.en) : ''}</option>` + en(x).map(n => `<option value="${esc(n)}">${esc(x.nome)} · ${esc(liv(x))}</option>`).join('')).join('');
        document.body.append(dl);
      }
      return T.srd;
    }).catch(() => { SRD = null; return null; });
    return SRD;
  }
  // «Luce, 2 al giorno» o «Messaggio (rituale)»: conta il nome prima della virgola o della parentesi
  const dalManuale = sp => !String(sp?.testo || '').trim() && (T.srd?.per.get(chiaveInc(sp?.nome)) || T.srd?.per.get(chiaveInc(String(sp?.nome || '').split(/[,(]/)[0]))) || null;
  // l'incantesimo preso dal manuale: tiene id e «preparato», il resto viene dal libro
  // il nome resta quello scritto (anche in inglese); l'altro nome si vede sotto il titolo della card
  const daManuale = (sp, x) => { const mio = String(sp.nome || '').trim(), it = !mio || chiaveInc(mio) === chiaveInc(x.nome); const { riassunto, ...v } = x;
    return { id: sp.id || nuovoId(), ...(sp.prep ? { prep: true } : {}), ...v, nome: it ? x.nome : mio, alt: it ? x.en || '' : x.nome, srd: !riassunto, ...(riassunto ? { riassunto: true } : {}) }; };
  const testoInc = (t, dis) => String(t || '').split(/\n+/).map(r => r.trim()).filter(Boolean).map(r => { const m = r.match(/^\*\*(.+?)\*\*\s*(.*)$/) || r.match(/^(Ai livelli superiori)[.:]\s*(.*)$/i); return `<p>${m ? `<b><i>${esc(m[1].replace(/[.:]\s*$/, ''))}.</i></b> ${dadiTesto(m[2], dis)}` : dadiTesto(r, dis)}</p>`; }).join('');
  function incForm(sp, i) {
    const f = (k, ph, cls = '') => `<input type="text" data-f="inc.${i}.${k}" class="${cls}" placeholder="${esc(ph)}" aria-label="${esc(ph)}">`;
    const ck = (k, l, tip) => `<label class="ck"${tip ? ` title="${esc(tip)}"` : ''}><input type="checkbox" data-f="inc.${i}.${k}"> ${l}</label>`;
    manuale();
    return `<div class="pvf"><input type="text" data-f="inc.${i}.nome" class="pn" list="tv-srd-l" autocomplete="off" placeholder="Nome (es. Palla di fuoco): scegli dal manuale o scrivilo" aria-label="Nome">
      ${dalManuale(sp) ? `<button type="button" class="mini srdb" data-k="inc-srd" data-i="${i}">📖 Compila dal manuale</button>` : ''}
      <div class="pvr"><label>Livello <select data-f="inc.${i}.livello">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<option value="${n}">${n ? n + '°' : 'Trucchetto'}</option>`).join('')}</select></label><label>Scuola <select data-f="inc.${i}.scuola"><option value="">—</option>${SCUOLE.map(x => `<option>${x}</option>`).join('')}</select></label>${ck('conc', 'Concentrazione')}${ck('rituale', 'Rituale')}</div>
      <div class="ig">${f('tempo', 'Tempo di lancio (1 azione)')}${f('portata', 'Portata (45 m, Contatto, Sé)')}${f('bersaglio', 'Bersaglio')}${f('componenti', 'Componenti (V, S, M)')}${f('durata', 'Durata (Istantanea, 1 minuto)')}${f('area', 'Area (sfera 6 m, cono 4,5 m)')}</div>
      <textarea data-f="inc.${i}.testo" rows="5" placeholder="Descrizione" aria-label="Descrizione"></textarea>
      <div class="pvr"><label>Danni ${f('danni', 'es. 8d6', 'd')}</label><label>Tipo ${f('tipo_danni', 'fuoco', 'd')}</label>${ck('attacco', 'Tiro per colpire', 'Si tira per colpire contro la CA del bersaglio')}<label>TS <select data-f="inc.${i}.ts"><option value="">nessuno</option>${CAR.map(([k, , n]) => `<option value="${k}">${n}</option>`).join('')}</select></label>${ck('dimezza', 'Metà danni se riesce')}</div>
      <div class="pvr"><button type="button" class="mini" data-k="inc-mod" data-i="${i}">✓ Fatto</button><button type="button" class="mini via" data-k="inc-via" data-i="${i}">Elimina</button></div></div>`;
  }
  function voceInc(s, sp, i, w, dis) {
    const sv = T.sv, key = sp.id || 'n' + i, aperta = sv.aperti?.has(key), mod = sv.minc === key && w, lv = num(sp.livello) || 0;
    const riga = (l, v) => `<p><b>${l}:</b> ${esc(v || '')}</p>`;
    const sotto = `${lv ? `${sp.scuola ? sp.scuola + ' di ' : ''}${lv}° livello` : sp.scuola ? 'Trucchetto di ' + sp.scuola.toLowerCase() : 'Trucchetto'}${sp.rituale ? ' (rituale)' : ''}`;
    const dett = `<div class="sc"><div class="st">${esc(sp.nome || 'Incantesimo')}${sp.alt ? ` <small class="alt">${esc(sp.alt)}</small>` : ''}</div><div class="ss">${esc(sotto)}</div>
      ${riga('Tempo di lancio', sp.tempo)}${riga('Portata', sp.portata)}${sp.area ? riga('Area', sp.area) : ''}${sp.bersaglio ? riga('Bersaglio', sp.bersaglio) : ''}${riga('Componenti', sp.componenti)}${riga('Durata', (sp.conc ? 'Concentrazione' + (sp.durata ? ', ' : '') : '') + (sp.durata || ''))}
      ${sp.danni || sp.ts || sp.attacco ? `<p><b>Effetto:</b> ${[sp.attacco ? `tiro per colpire ${segno(bonusInc(s))}` : '', sp.danni ? `${esc(sp.danni)}${sp.tipo_danni ? ' ' + esc(sp.tipo_danni) : ''}` : '', sp.ts ? `TS ${esc(nomeCar(sp.ts))} CD ${8 + bonusInc(s)}${sp.dimezza ? ', metà se riesce' : ''}` : ''].filter(Boolean).join(' · ')}</p>` : ''}
      <p><b>Descrizione:</b></p>${testoInc(sp.testo, dis) || `<p class="vuoto">Nessuna descrizione.${dalManuale(sp) && w ? ` <button type="button" class="mini srdb" data-k="inc-srd" data-i="${i}">📖 Compila dal manuale</button>` : ''}</p>`}</div>`;
    const tag = [sp.conc ? '<i title="Concentrazione">C</i>' : '', sp.rituale ? '<i title="Rituale">R</i>' : '', sp.componenti ? `<small>${esc(String(sp.componenti).split('(')[0].trim())}</small>` : ''].join('');
    return `<div class="pv spl${aperta ? ' ap' : ''}" data-ordi="${i}">
      <div class="ph">${w ? '<span class="mano" title="Trascina per spostare" aria-hidden="true">⠿</span>' : ''}${lv ? `<button type="button" class="prp${sp.prep ? ' on' : ''}" data-k="inc-prep" data-i="${i}" title="${sp.prep ? 'Preparato' : 'Non preparato'}" aria-pressed="${!!sp.prep}"${w ? '' : ' disabled'}></button>` : ''}<button type="button" class="pt" data-k="inc-apri" data-i="${i}" aria-expanded="${!!aperta}">${esc(sp.nome || 'Senza nome')}</button>
        <span class="az2"><span class="tg2">${tag}</span><button type="button" class="mchat" data-k="inc-chat" data-i="${i}" title="Mostra la descrizione in chat" aria-label="Mostra in chat"${dis}>💬</button><button type="button" class="lancia" data-k="inc-lancia" data-i="${i}" title="Lancia ${esc(sp.nome || 'l\'incantesimo')}"${dis}>✨ Lancia</button>
        ${w ? `<button type="button" class="ing" data-k="inc-mod" data-i="${i}" title="Modifica" aria-label="Modifica">⚙</button>` : ''}</span></div>
      ${mod ? incForm(sp, i) : aperta ? dett : ''}</div>`;
  }
  // un incantesimo (inc) si lancia come un attacco: la scheda lo traduce in gittata, area e tiro salvezza
  function iniziaMira(s, i, tok, inc = null, liv = null) {
    const sv = T.sv, at = inc != null ? attDaInc(s, s.dati.incantesimi?.[inc]) : s.dati.attacchi[i]; if (!at) return;
    const pa = portata(at); T.critico = null;
    T.mira = { sid: s.id, i: inc != null ? 0 : i, inc, liv: liv > (num(s.dati.incantesimi?.[inc]?.livello) || 0) ? liv : null, slot: liv || null, tok: tok.id, adv: sv?.adv || 0, seg: !!sv?.seg, area: pa.area, dist: pa.dist, col: pa.col, extra: new Set(inc != null ? [] : extraDi(s).filter(x => x.attivo && x.dadi).map(x => x.id)) };
    // la scheda coprirebbe la mappa: sul telefono si chiude, sul computer sparisce finché non si è scelto il bersaglio
    if (sv?.d.open) { if (innerWidth <= 820) sv.d.close(); else { sv.d.style.visibility = 'hidden'; T.mira.d = sv.d; } }
    strumento('muovi'); $('#tv-stage')?.classList.add('mira'); barraMira(at, tok); disegnaToken();
  }
  function fineMira(dopo) {
    if (!T.mira) return; const d = T.mira.d; T.mira = null; $('#tv-fx .area-mira')?.remove();
    if (d) setTimeout(() => { d.style.visibility = ''; }, dopo || 0); // la scheda torna dopo l'animazione
    $('#tv-stage')?.classList.remove('mira'); disegnaToken(); barraMaschera();
  }
  function barraMira(at, tok) {
    const b = $('#tv-mbar'), m = T.mira; if (!b || !m) return;
    const p = portata(at), arr = p.dist ? `gittata ${metri(p.dist[0])}${p.dist[1] > p.dist[0] ? ' / ' + metri(p.dist[1]) : ''}${p.mischia ? ' · anche in mischia' : ''}` : p.area ? 'da chi lancia' : `mischia · ${metri(p.reach)}`;
    // i privilegi con dadi da aggiungere ai danni (attacco furtivo, punizione…) si accendono qui
    const s = T.schede?.get(m.sid), ex = extraDi(s).filter(x => x.dadi).map(x => [x, x.id]);
    const forma = p.area && { cerchio: 'sfera', cubo: 'cubo', cono: 'cono', linea: 'linea' }[p.area.forma] + ' di ' + metri(p.area.m);
    b.innerHTML = `<div class="g"><b class="tit">🎯 ${esc(at.nome || 'Attacco')}${m.inc != null && m.slot ? ` · slot di ${m.slot}°` : ''}</b><span class="avv">di ${esc(tok.nome || '')} · ${arr}${forma ? ' · ' + forma : ''}. ${p.area ? (m.f ? (m.f.lontano ? '<b>Troppo lontano.</b>' : `Dentro: ${m.bers.length ? m.bers.map(id => esc(T.tok.get(id)?.nome || '?')).join(', ') : 'nessuno'}.`) : 'Clicca sulla mappa il punto dove lanciarlo.') : 'Clicca il bersaglio sulla mappa.'}</span></div>
      ${ex.length && !p.area && m.inc == null ? `<div class="g">${ex.map(([x, i]) => `<label class="sw" title="Aggiunge ${esc(x.dadi)} ai danni se colpisci"><input type="checkbox" data-x="${esc(i)}" ${m.extra.has(i) ? 'checked' : ''}><span class="tg" aria-hidden="true"></span>＋ ${esc(x.nome)} (${esc(x.dadi)})</label>`).join('')}</div>` : ''}
      <div class="g">${p.area ? `<button type="button" data-k="lancia" class="on"${m.f && !m.f.lontano ? '' : ' disabled'}>🔥 Lancia qui</button>` : ''}<button type="button" data-k="annulla">Annulla (Esc)</button></div>`;
    b.classList.remove('spenta'); b.hidden = false;
    b.querySelector('[data-k=annulla]').onclick = () => fineMira();
    b.querySelector('[data-k=lancia]')?.addEventListener('click', lanciaArea);
    b.querySelectorAll('[data-x]').forEach(x => x.onchange = () => { x.checked ? m.extra.add(x.dataset.x) : m.extra.delete(x.dataset.x); attivaExtra(s, x.dataset.x, x.checked); });
  }
  /* «Modificatore danno aggiuntivo» (come in Roll20): dadi che, se accesi, si sommano ai danni di ogni attacco.
     Stanno in dati.danni_extra; i privilegi segnati «si aggiungono ai danni» (attacco furtivo…) ci compaiono da soli
     e, finché sono legati al privilegio (da), ne seguono i dadi quando si sale di livello. */
  function extraDi(s) {
    const d = s?.dati || {}, L = Array.isArray(d.danni_extra) ? d.danni_extra : [], P = d.privilegi || [];
    const out = L.map(x => { const p = x.da && P.find(q => q.id === x.da); return p?.dadi ? { ...x, dadi: p.dadi } : x; });
    for (const p of P) if (p.extra && p.dadi && !L.some(x => (p.id && x.da === p.id) || norm(x.nome) === norm(p.nome))) out.push({ id: 'p-' + (p.id || norm(p.nome)), nome: p.nome, dadi: p.dadi, attivo: !!p.attivo, da: p.id || null });
    return out;
  }
  const salvaExtra = (s, L) => salvaScheda(s.id, { danni_extra: L.map(x => ({ ...x })) }, true).then(() => { if (T.sv?.id === s.id) disegnaScheda(); });
  // attacco furtivo e simili restano accesi (o spenti) finché non si cambia: dalla mira o dalla scheda
  function attivaExtra(s, id, on) {
    if (!s || !puoScrivere(s)) return; const L = extraDi(s), x = L.find(y => y.id === id); if (!x || !!x.attivo === on) return;
    x.attivo = on; return salvaExtra(s, L);
  }
  function boxExtra(s, w, dis) {
    const L = extraDi(s);
    return `<div class="sez dxs">${L.map(x => `<div class="dx${x.attivo ? ' on' : ''}" data-id="${esc(x.id)}">
        <input type="checkbox" class="dxc" data-k="dx-on" data-id="${esc(x.id)}" title="${x.attivo ? 'Acceso: quando colpisci si tirano e si sommano ai danni' : 'Spento: accendilo quando vale (per esempio una volta per turno)'}" aria-label="Acceso"${x.attivo ? ' checked' : ''}${dis}>
        ${w ? `<input class="dxn" data-k="dx-nome" data-id="${esc(x.id)}" value="${esc(x.nome || '')}" placeholder="Nome (es. Attacco furtivo)" aria-label="Nome" maxlength="60"><input class="dxd" data-k="dx-dadi" data-id="${esc(x.id)}" value="${esc(x.dadi || '')}" placeholder="2d6" aria-label="Dadi" maxlength="30">`
          : `<span class="dxn">${esc(x.nome || '')}</span><span class="dxd">${esc(x.dadi || '')}</span>`}
        <button type="button" class="mini" data-k="dx-tira" data-id="${esc(x.id)}" title="Tira ${esc(x.dadi || '')}"${dis}>🎲</button>${w ? `<button type="button" class="ing" data-k="dx-via" data-id="${esc(x.id)}" title="Togli" aria-label="Togli">🗑</button>` : ''}</div>`).join('') || '<p class="vuoto">Nessuno: aggiungi attacco furtivo, punizione divina…</p>'}
      ${w ? '<button type="button" class="mini agg" data-k="dx-add">+ Aggiungi un danno aggiuntivo</button>' : ''}<h6>Modificatore danno aggiuntivo</h6></div>`;
  }
  // un incantesimo senza tiro per colpire si può lanciare anche su di sé (Cura ferite)
  const suSe = m => { const sp = m.inc != null ? T.schede?.get(m.sid)?.dati.incantesimi?.[m.inc] : null; return !!sp && !sp.attacco; };
  async function scegliBersaglio(b) {
    const m = T.mira; if (!m) return;
    const sx = T.schede?.get(m.sid), at = armaMira(m), sp = m.inc != null ? sx?.dati.incantesimi?.[m.inc] : null;
    const v = suSe(m) && b.id === m.tok ? { ok: true, adv: 0, pro: [], contro: [], col: portata(at).col } : valuta(m, b); if (!v.ok) { if (v.motivo) toast(v.motivo, 'err'); return; }
    if (at && portata(at).ts) { fineMira(animazioni() ? 1800 : 700); return incantesimoTS(m, [b.id], null, v.col || '#ffb347', at); }
    // senza tiro per colpire: i danni arrivano e basta (Dardo incantato), altrimenti si annuncia su chi è lanciato
    if (sp && !sp.attacco) { fineMira(animazioni() ? 1800 : 700); return String(at.danni || '').trim() ? incantesimoTS(m, [b.id], null, v.col || '#ffb347', at) : incantesimoSu(m, sx, sp, b); }
    fineMira(animazioni() ? 1800 : 700);
    const exP = extraDi(sx).filter(x => m.extra.has(x.id) && x.dadi), bd = m.inc == null ? bonusDadi(at) : '';
    const extra = [bd, ...exP.map(x => x.dadi)].filter(Boolean).join('+'), exN = [bd ? bonusNome(at) : '', ...exP.map(x => x.nome || 'danni in più')].filter(Boolean).join(' + ');
    const r = await SB.rpc('tavolo_attacca', { p_token: m.tok, p_bersaglio: b.id, p_attacco: m.i, p_adv: v.adv, p_privato: m.seg, ...(extra ? { p_extra: extra, p_extra_nome: exN } : {}), ...(m.inc != null ? { p_inc: m.inc } : {}), p_liv: m.liv || null });
    if (r.error) return toast(/candidate function/i.test(r.error.message) ? 'In Supabase è rimasta una versione vecchia della funzione: esegui di nuovo tavolo/tappa-9.sql.' : /p_liv/i.test(r.error.message) ? 'Per lanciare con uno slot più alto esegui tavolo/tappa-9.sql in Supabase.' : sqlMancante(r.error) ? 'Per gli attacchi sulla mappa esegui tavolo/tappa-5.sql in Supabase.' : extra && /p_extra|function/i.test(r.error.message) ? 'Per aggiungere i dadi in più esegui tavolo/tappa-7.sql in Supabase.' : r.error.message, 'err');
    const x = Array.isArray(r.data) ? r.data[0] : r.data, a = T.tok.get(m.tok);
    const mossa = { da: m.tok, a: b.id, anim: v.anim, col: v.col, ritorna: !!v.ritorna, esito: x.colpito === true ? 'si' : x.colpito === false ? 'no' : 'nd', crit: !!x.critico, fallito: !!x.fallito, danni: x.danni || 0 };
    manda('attacco', mossa); mostraAttacco(mossa);
    if (m.inc != null) usaSlot(sx, m.inc, m.slot);
    const tempo = m.inc != null ? sx?.dati.incantesimi?.[m.inc]?.tempo || '' : '';
    if (a && suoTurno(a)) { if (/azione bonus/i.test(tempo)) { if (!azioniDi(a).bon) await segnaAzioni(a, { bon: true }); } else if (/reazione/i.test(tempo)) await segnaAzioni(a, { rea: true }); else if (!azioniDi(a).az) await segnaAzioni(a, { az: true }); }
    else if (a) await segnaReazione(a); // fuori dal suo turno si attacca solo con la reazione (attacco di opportunità)
    if (a && v.aiuto) usaAiuto(a, v.aiuto);
    if (x.critico && x.pf !== 0) barraCritico(x, a, b, mossa);
    if (x.salvezza) toast(`${b.nome || 'Il bersaglio'} deve fare un tiro salvezza su ${nomeCar(x.salvezza.car)} (CD ${x.salvezza.cd}) per i danni in più.`);
    if (mossa.esito === 'si' && m.inc == null) for (const p of effetti(sx, 'ts_colpo')) chiediTSTratto(a, b, p);
    const perche = [v.adv === 1 ? 'vantaggio: ' + v.pro.join(', ') : v.adv === 2 ? 'svantaggio: ' + v.contro.join(', ') : ''].filter(Boolean).join('');
    toast(`${a?.nome || ''} → ${b.nome || ''}: ${mossa.esito === 'nd' ? `tiro ${x.totale}, senza CA nella scheda del bersaglio decide il DM` : mossa.esito === 'si' ? `${x.critico ? 'critico! ' : 'colpito, '}${x.danni} danni${x.danni_extra != null ? ` (di cui ${x.danni_extra} da ${exN})` : ''}` : x.fallito ? '1 naturale, mancato' : 'mancato'}${perche ? ' (' + perche + ')' : ''}${v.ritorna ? ' · il pugnale torna in mano' : ''}`);
  }

  // un tratto «quando colpisce, TS…»: la richiesta arriva al bersaglio come per gli incantesimi
  async function chiediTSTratto(a, b, p) {
    const car = p.ts_car, cd = num(p.ts_cd); if (!a || !car || !cd) return;
    const r = await SB.rpc('tavolo_ts_tratto', { p_token: a.id, p_bersaglio: b.id, p_car: car, p_cd: cd, p_motivo: p.nome || '' });
    if (r.error) return toast(`${b.nome || 'Il bersaglio'} deve fare un TS su ${nomeCar(car)} CD ${cd} (${p.nome || 'tratto'}).${sqlMancante(r.error) ? ' Per chiederlo in automatico esegui tavolo/tappa-10.sql in Supabase.' : ''}`);
    const x = r.data; if (x?.id) { T.salv.set(x.id, { ...x, giocatore: b.giocatore || null, motivo: p.nome || '', esito: null, creato: new Date().toISOString() }); disegnaSalvezze(); }
  }
  async function incantesimoSu(m, s, sp, b) {
    const a = T.tok.get(m.tok), base = num(sp.livello) || 0, lv = m.slot || base;
    const r = await SB.rpc('tavolo_scrivi', { p_testo: `✨ ${a?.nome || s.nome || 'Qualcuno'} lancia ${sp.nome || 'un incantesimo'}${b.id === m.tok ? ' su di sé' : ` su ${b.nome || 'un bersaglio'}`}${lv ? ` (${lv > base ? `slot di ${lv}° livello, è di ${base}°` : `${lv}° livello`})` : ''}${sp.conc ? ' · concentrazione' : ''}` });
    if (r.error) return toast(r.error.message, 'err');
    usaSlot(s, m.inc, m.slot);
    if (a && suoTurno(a)) segnaAzioni(a, /azione bonus/i.test(sp.tempo || '') ? { bon: true } : /reazione/i.test(sp.tempo || '') ? { rea: true } : { az: true });
    else if (a && /reazione/i.test(sp.tempo || '')) segnaReazione(a);
    toast(`${sp.nome || 'Incantesimo'} lanciato su ${b.id === m.tok ? 'di sé' : b.nome || 'il bersaglio'}.`);
  }

  /* ---------- incantesimi ad area: chi lancia sceglie il punto, il tavolo trova chi è dentro ---------- */
  // la forma in pixel della mappa: cerchio (sfera, raggio, cilindro), cubo, cono e linea partono da chi lancia
  function formaArea(m, p) {
    const sc = scena(), a = T.tok.get(m.tok); if (!sc || !a || !p) return null;
    const u = sc.griglia / (sc.metri || 1.5), [cx, cy] = centro(a, sc), ar = m.area, L = ar.m * u;
    const daSe = ar.forma === 'cono' || ar.forma === 'linea' || !m.dist;
    const ang = Math.atan2(p.y - cy, p.x - cx);
    const o = ar.forma === 'cerchio' && daSe ? { x: cx, y: cy } : ar.forma === 'cerchio' || ar.forma === 'cubo' ? { x: p.x, y: p.y } : { x: cx, y: cy };
    const lontano = !daSe && Math.hypot(p.x - cx, p.y - cy) / u > (m.dist[1] || m.dist[0]) + 0.75;
    return { forma: ar.forma, x: o.x, y: o.y, ang, L, w: 1.5 * u, lontano, da: m.tok };
  }
  function dentroArea(f, x, y) {
    const dx = x - f.x, dy = y - f.y;
    if (f.forma === 'cerchio') return Math.hypot(dx, dy) <= f.L + 0.5;
    if (f.forma === 'cubo') return Math.abs(dx) <= f.L / 2 + 0.5 && Math.abs(dy) <= f.L / 2 + 0.5;
    const lungo = dx * Math.cos(f.ang) + dy * Math.sin(f.ang), lato = -dx * Math.sin(f.ang) + dy * Math.cos(f.ang);
    if (lungo <= 0 || lungo > f.L + 0.5) return false;
    return f.forma === 'cono' ? Math.abs(lato) <= lungo / 2 + 0.5 : Math.abs(lato) <= f.w / 2 + 0.5;
  }
  // un token è colpito se il centro di almeno una delle sue caselle è dentro l'area
  function bersagliArea(f) {
    const sc = scena(); if (!sc || !f) return [];
    return [...T.tok.values()].filter(t => {
      if (t.scena !== sc.id || (t.id === f.da && f.forma !== 'cerchio' && f.forma !== 'cubo') || condTok(t).includes('Morto')) return false;
      if (!isDM() && (t.nascosto || tokEl(t.id)?.hidden)) return false;
      const n = Math.max(1, Math.round(t.misura)), q = t.misura * sc.griglia / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (dentroArea(f, t.x + q * (i + 0.5), t.y + q * (j + 0.5))) return true;
      return false;
    });
  }
  function pathArea(f) {
    if (f.forma === 'cerchio') return `M${f.x - f.L} ${f.y}a${f.L} ${f.L} 0 1 0 ${2 * f.L} 0a${f.L} ${f.L} 0 1 0 ${-2 * f.L} 0z`;
    if (f.forma === 'cubo') return `M${f.x - f.L / 2} ${f.y - f.L / 2}h${f.L}v${f.L}h${-f.L}z`;
    const c = Math.cos(f.ang), s = Math.sin(f.ang), mezzo = f.forma === 'cono' ? f.L / 2 : f.w / 2, ini = f.forma === 'cono' ? 0 : f.w / 2;
    const pt = (l, q) => `${f.x + c * l - s * q} ${f.y + s * l + c * q}`;
    return `M${pt(0, -ini)}L${pt(f.L, -mezzo)}L${pt(f.L, mezzo)}L${pt(0, ini)}z`;
  }
  function disegnaArea() {
    const fx = $('#tv-fx'); if (!fx) return; fx.querySelector('.area-mira')?.remove();
    const m = T.mira; if (!m?.area || !m.p) { disegnaToken(); return; }
    const f = formaArea(m, m.p), col = f.lontano ? '#c0392b' : m.col || '#ffb347';
    const g = nodo(fx, 'g', { class: 'area-mira' });
    nodo(g, 'path', { d: pathArea(f), fill: col, 'fill-opacity': .22, stroke: col, 'stroke-width': Math.max(2, scena().griglia * 0.04), 'stroke-dasharray': f.lontano ? '10 6' : 'none' });
    m.f = f; m.bers = f.lontano ? [] : bersagliArea(f).map(t => t.id);
    disegnaToken(); barraMira(armaMira(m) || {}, T.tok.get(m.tok));
  }
  async function lanciaArea() {
    const m = T.mira; if (!m?.f || m.f.lontano) return toast(m?.f?.lontano ? 'Troppo lontano: avvicina il punto a chi lancia.' : 'Prima clicca sulla mappa il punto dove lanciare.', 'err');
    const s = T.schede.get(m.sid), a = T.tok.get(m.tok), at = armaMira(m); if (!s || !a || !at) return;
    if (!m.bers.length && !await ask('Nell\'area non c\'è nessuno. Lanciare lo stesso?', { ok: 'Lancia', title: at.nome || 'Incantesimo' })) return;
    const f = m.f, col = m.col || '#ffb347', bers = [...m.bers]; fineMira(animazioni() ? 2000 : 700);
    incantesimoTS(m, bers, f, col, at);
  }
  // l'incantesimo parte: i danni si tirano una volta, poi ogni bersaglio con un tiro salvezza riceve la richiesta
  async function incantesimoTS(m, bers, f, col, at) {
    const s = T.schede.get(m.sid), a = T.tok.get(m.tok); if (!s || !a) return;
    const r = await SB.rpc('tavolo_area', { p_token: a.id, p_attacco: m.i, p_bersagli: bers, p_cd: 8 + comp(s) + modC(s.dati[carInc(s)]), p_privato: m.seg, ...(m.inc != null ? { p_inc: m.inc } : {}), p_liv: m.liv || null });
    if (r.error) return toast(/candidate function/i.test(r.error.message) ? 'In Supabase è rimasta una versione vecchia della funzione: esegui di nuovo tavolo/tappa-9.sql.' : /p_liv/i.test(r.error.message) ? 'Per lanciare con uno slot più alto esegui tavolo/tappa-9.sql in Supabase.' : sqlMancante(r.error) || /tavolo_area/.test(r.error.message) ? 'Per gli incantesimi ad area esegui tavolo/tappa-6.sql in Supabase.' : r.error.message, 'err');
    const x = r.data, esiti = x.esiti || [], mossa = { f, col, da: a.id, esiti: esiti.map(e => ({ id: e.id, danni: e.danni, salvo: e.salvo, attesa: !!e.attesa })) };
    manda('area', mossa); mostraArea(mossa);
    if (m.inc != null) usaSlot(s, m.inc, m.slot);
    const tp = m.inc != null ? s.dati.incantesimi?.[m.inc]?.tempo || '' : '';
    if (suoTurno(a)) segnaAzioni(a, /azione bonus/i.test(tp) ? { bon: true } : /reazione/i.test(tp) ? { rea: true } : { az: true });
    else if (/reazione/i.test(tp)) segnaReazione(a);
    const attesa = esiti.filter(e => e.attesa).length, nome = at.nome || 'Incantesimo';
    if (x.car && !attesa && esiti.length) toast(`${nome}: per i tiri salvezza su richiesta esegui tavolo/tappa-7.sql in Supabase.`, 'err');
    toast(`${nome}: ${x.danni || !x.car ? `${x.danni} danni` : 'lanciato'}${x.car ? ` · TS ${nomeCar(x.car)} CD ${x.cd}${x.dimezza ? ', metà danni se riesce' : ''}` : ''}.${attesa ? ` Aspetto il tiro salvezza di ${esiti.filter(e => e.attesa).map(e => e.nome || '?').join(', ')}.` : ''}`);
  }
  function mostraArea(m) {
    const fx = $('#tv-fx'), sc = scena(); if (!fx || !sc) return;
    const u = sc.griglia, fine = () => {
      for (const e of m.esiti || []) {
        const t = T.tok.get(e.id); if (!t || (!isDM() && tokEl(t.id)?.hidden)) continue;
        const [x, y, r] = centro(t, sc);
        if (e.danni) { lampo(fx, x, y, m.col, r * 1.4); trema(t.id, u); }
        if (e.attesa) { lampo(fx, x, y, m.col, r * 1.2); scritta(fx, x, y - r - u * 0.25, 'TS…', '#ffd88a', u, false); continue; }
        scritta(fx, x, y - r - u * 0.25, e.danni ? '−' + e.danni + (e.salvo ? ' (TS)' : '') : 'Salvo', e.danni ? '#ff6b5b' : '#f3e6c8', u, !!e.danni);
      }
    };
    if (!m.f) return fine();
    const p = nodo(fx, 'path', { d: pathArea(m.f), fill: m.col, stroke: m.col, 'stroke-width': u * 0.05 });
    if (!animazioni()) { muovi(p, [{ opacity: .4 }, { opacity: 0 }], { duration: 900 }).finished.then(() => p.remove()); return fine(); }
    p.style.transformOrigin = `${m.f.x}px ${m.f.y}px`; p.style.transformBox = 'view-box';
    muovi(p, [{ transform: 'scale(.15)', opacity: .9 }, { transform: 'scale(1)', opacity: .55, offset: .45 }, { transform: 'scale(1.04)', opacity: 0 }], { duration: 1100, easing: 'ease-out' }).finished.then(() => p.remove());
    setTimeout(fine, 450);
  }
  /* ---------- tiri salvezza su richiesta: il giocatore (o il DM per i PNG) tira con un clic ---------- */
  const nomeCar = k => (CAR.find(c => c[0] === k) || [, , k || '?'])[2];
  // le richieste che tocca a me tirare: le mie se gioco, tutte se sono il DM (quelle dei giocatori le può tirare per loro)
  function disegnaSalvezze() {
    const box = $('#tv-ts'); if (!box) return;
    const l = [...T.salv.values()].filter(r => r.esito == null && (isDM() || (r.giocatore && r.giocatore === T.me?.giocatore)) && T.tok.has(r.token))
      .sort((a, b) => (a.creato < b.creato ? -1 : 1));
    box.hidden = !l.length; if (!l.length) { box.innerHTML = ''; return; }
    const png = l.filter(r => !r.giocatore);
    const riga = r => {
      const t = T.tok.get(r.token), sh = schedaDi(t), bon = sh ? tsTot(sh, r.car) : null, mio = !isDM() || !r.giocatore;
      const danni = r.danni ? `${r.danni} danni${r.dimezza ? ', metà se lo superi' : ', nessuno se lo superi'}` : '';
      return `<div class="ts" data-id="${r.id}"><div class="tx"><b>${esc(t?.nome || r.nome || '?')}</b><span class="car">TS ${esc(nomeCar(r.car))} · CD ${r.cd}</span>
        <small>${r.motivo ? 'contro ' + esc(r.motivo) : ''}${r.motivo && danni ? ' · ' : ''}${danni}${!mio ? ` · aspetta ${esc(nomeGioc(r.giocatore))}` : ''}</small></div>
        <div class="bt"><button type="button" class="tira" data-k="tira" title="Tira il tiro salvezza">🎲 Tira${bon != null ? ' ' + segno(bon) : ''}</button><button type="button" data-k="v" title="Tira con vantaggio">V</button><button type="button" data-k="s" title="Tira con svantaggio">S</button>${isDM() ? '<button type="button" data-k="x" title="Togli la richiesta" aria-label="Togli la richiesta">✕</button>' : ''}</div></div>`;
    };
    box.innerHTML = `<div class="h"><b>🛡 Tiro salvezza${l.length > 1 ? ` (${l.length})` : ''}</b>${isDM() && png.length > 1 ? '<button type="button" data-k="tutti">🎲 Tira tutti i PNG</button>' : ''}</div><div class="l">${l.map(riga).join('')}</div>`;
    box.querySelectorAll('.ts').forEach(el => el.querySelectorAll('button').forEach(b => b.onclick = () => {
      const id = el.dataset.id, k = b.dataset.k;
      if (k === 'x') return SB.rpc('tavolo_salva_annulla', { p_id: id }).then(r => { if (r.error) toast(r.error.message, 'err'); else { T.salv.delete(id); disegnaSalvezze(); } });
      tiraSalvezza(id, k === 'v' ? 1 : k === 's' ? 2 : 0);
    }));
    box.querySelector('[data-k=tutti]')?.addEventListener('click', async () => { for (const r of png) await tiraSalvezza(r.id, 0); });
  }
  async function tiraSalvezza(id, adv) {
    const rq = T.salv.get(id), sh = rq && schedaDi(T.tok.get(rq.token)); if (!adv && sh && vantTS(sh, rq.car)) adv = 1;
    const el = $(`#tv-ts .ts[data-id="${id}"]`); if (el?.classList.contains('va')) return; el?.classList.add('va');
    const r = await SB.rpc('tavolo_salva', { p_id: id, p_adv: adv });
    if (r.error) { el?.classList.remove('va'); return toast(sqlMancante(r.error) ? 'Per i tiri salvezza su richiesta esegui tavolo/tappa-7.sql in Supabase.' : r.error.message, 'err'); }
    const x = r.data, m = { id: x.token, salvo: x.salvo, danni: x.danni, tiro: x.tiro };
    T.salv.delete(id); disegnaSalvezze();
    manda('ts', m); mostraTS(m);
    toast(`${x.nome || ''}: ${x.tiro} al tiro salvezza, ${x.salvo ? 'riuscito' : 'fallito'}${x.danni ? ` · ${x.danni} danni` : ' · nessun danno'}${x.morto ? ' · ☠ sconfitto' : ''}.`);
  }
  function mostraTS(m) {
    const sc = scena(), fx = $('#tv-fx'), t = T.tok.get(m.id); if (!sc || !fx || !t || (!isDM() && tokEl(t.id)?.hidden)) return;
    const u = sc.griglia, [x, y, r] = centro(t, sc);
    scritta(fx, x, y - r - u * (m.danni ? 0.75 : 0.25), (m.salvo ? '🛡 Salvo' : 'TS fallito') + (m.tiro != null ? ' · ' + m.tiro : ''), m.salvo ? '#9fd8ff' : '#ffb3a8', u, false);
    if (m.danni) mostraPF({ id: m.id, delta: -m.danni });
  }
  // un 20 naturale: chi ha attaccato può confermare il critico; con un altro 20 il bersaglio muore sul colpo
  function barraCritico(x, a, b, mossa) {
    const bar = $('#tv-mbar'); if (!bar || !x.tiro) return;
    bar.innerHTML = `<div class="g"><b class="tit">⚡ Critico!</b><span class="avv">Vuoi confermarlo? Tiri un altro d20: con un altro 20 ${esc(b.nome || 'il bersaglio')} muore sul colpo.</span></div><div class="g"><button type="button" data-k="conf" class="on">🎲 Conferma il critico</button><button type="button" data-k="no">Lascia stare</button></div>`;
    bar.classList.remove('spenta'); bar.hidden = false; T.critico = x.tiro;
    bar.querySelector('[data-k=no]').onclick = () => { T.critico = null; barraMaschera(); };
    bar.querySelector('[data-k=conf]').onclick = async () => {
      T.critico = null; barraMaschera();
      const r = await SB.rpc('tavolo_conferma', { p_tiro: x.tiro });
      if (r.error) return toast(sqlMancante(r.error) || /tavolo_conferma/.test(r.error.message) ? 'Per la conferma del critico esegui tavolo/tappa-6.sql in Supabase.' : r.error.message, 'err');
      const c = r.data, m2 = { ...mossa, esito: c.uccisione ? 'kill' : 'conf', nat: c.naturale };
      manda('attacco', m2); mostraAttacco(m2);
      toast(c.uccisione ? `☠ Un altro 20! ${b.nome || 'Il bersaglio'} muore sul colpo.` : `Conferma: ${c.naturale}. Il critico resta, niente colpo mortale.`);
    };
  }

  /* ---------- animazioni sulla mappa: le vedono tutti ---------- */
  const NSV = 'http://www.w3.org/2000/svg';
  const nodo = (p, tag, at) => { const e = document.createElementNS(NSV, tag); for (const k in at) e.setAttribute(k, at[k]); p.append(e); return e; };
  const muovi = (el, kf, o) => el.animate(kf, { fill: 'forwards', ...o });
  function scritta(fx, x, y, txt, col, u, grande) {
    const t = nodo(fx, 'text', { x, y, 'text-anchor': 'middle', fill: col, 'font-size': u * (grande ? 0.6 : 0.45), 'font-weight': 700, stroke: '#000c', 'stroke-width': u * 0.09, 'paint-order': 'stroke', class: 'tx' }); t.textContent = txt;
    muovi(t, [{ transform: `translateY(${u * 0.15}px)`, opacity: 0 }, { transform: 'translateY(0)', opacity: 1, offset: .15 }, { transform: `translateY(${-u * 0.5}px)`, opacity: 1, offset: .8 }, { transform: `translateY(${-u * 0.7}px)`, opacity: 0 }], { duration: 1900, easing: 'ease-out' }).finished.then(() => t.remove());
  }
  function lampo(fx, x, y, col, r) {
    const c = nodo(fx, 'circle', { cx: x, cy: y, r: r * 0.15, fill: col, opacity: .9 });
    muovi(c, [{ r: r * 0.15, opacity: .95 }, { r, opacity: 0 }], { duration: 480, easing: 'ease-out' }).finished.then(() => c.remove());
  }
  function trema(id, u) {
    const el = tokEl(id); if (!el) return;
    el.animate([0, 1, -1, .8, -.6, 0].map(d => ({ translate: `${d * u * 0.12}px 0` })), { duration: 380 });
  }
  function centro(t, sc) { const l = t.misura * sc.griglia; return [t.x + l / 2, t.y + l / 2, l / 2]; }
  // prima rotola il dado sulla mappa, poi partono la freccia, il colpo e la scritta «Colpito/Mancato»
  const ATTESA_DADO = 2300;
  function mostraAttacco(m) {
    if (!animazioni() || matchMedia('(prefers-reduced-motion: reduce)').matches) return mostraAttaccoOra(m);
    setTimeout(() => mostraAttaccoOra(m), ATTESA_DADO);
  }
  function mostraAttaccoOra(m) {
    const sc = scena(), fx = $('#tv-fx'), a = T.tok.get(m.da), b = T.tok.get(m.a); if (!sc || !fx || !b) return;
    const vedeB = isDM() || !tokEl(b.id)?.hidden, vedeA = a && (isDM() || !tokEl(a.id)?.hidden);
    if (!vedeB) return;
    const u = sc.griglia, [bx, by, br] = centro(b, sc), esito = () => {
      if (m.esito === 'kill') { lampo(fx, bx, by, '#ff2d2d', br * 2.6); lampo(fx, bx, by, '#fff', br * 1.2); trema(b.id, u * 1.6); scritta(fx, bx, by - br - u * 0.25, '☠ Colpo mortale!', '#ff3b3b', u, true); }
      else if (m.esito === 'conf') scritta(fx, bx, by - br - u * 0.25, 'Conferma: ' + m.nat, '#f3e6c8', u);
      else if (m.esito === 'si') {
        lampo(fx, bx, by, m.crit ? '#ffd24a' : m.anim === 'magia' ? m.col : '#ffd27a', br * (m.crit ? 2.2 : 1.5)); if (m.crit) lampo(fx, bx, by, '#fff', br);
        trema(b.id, u); scritta(fx, bx, by - br - u * 0.25, (m.crit ? 'Critico! ' : '') + (m.danni ? '−' + m.danni : 'Colpito'), m.crit ? '#ffd24a' : '#ff6b5b', u, true);
      } else if (m.esito === 'no') scritta(fx, bx, by - br - u * 0.25, m.fallito ? 'Fallimento' : 'Mancato', m.fallito ? '#ff6b5b' : '#f3e6c8', u);
      else scritta(fx, bx, by - br - u * 0.25, '?', '#f3e6c8', u);
    };
    if (!animazioni() || !vedeA || m.esito === 'kill' || m.esito === 'conf') return esito();
    const [ax, ay, ar] = centro(a, sc), ang = Math.atan2(by - ay, bx - ax), deg = ang * 180 / Math.PI, cos = Math.cos(ang), sin = Math.sin(ang);
    const manca = m.esito === 'no';
    if (m.anim === 'spada') {
      const el = tokEl(a.id), sp = Math.min(u * 0.35, Math.hypot(bx - ax, by - ay) / 3);
      el?.animate([{ translate: '0 0' }, { translate: `${cos * sp}px ${sin * sp}px`, offset: .35 }, { translate: '0 0' }], { duration: 480, easing: 'ease-in-out' });
      setTimeout(() => {
        const R = br * 1.2, p = nodo(fx, 'path', { d: `M${bx - R * .7} ${by - R} Q ${bx + R * .6} ${by - R * .2} ${bx - R * .2} ${by + R}`, fill: 'none', stroke: manca ? '#f3e6c8' : '#ff6b5b', 'stroke-width': u * 0.1, 'stroke-linecap': 'round', 'stroke-dasharray': R * 3, 'stroke-dashoffset': R * 3 });
        muovi(p, [{ strokeDashoffset: R * 3, opacity: 1 }, { strokeDashoffset: 0, opacity: 1, offset: .5 }, { strokeDashoffset: -R * 3, opacity: 0 }], { duration: 420, easing: 'ease-out' }).finished.then(() => p.remove());
        if (manca) tokEl(b.id)?.animate([{ translate: '0 0' }, { translate: `${-sin * u * 0.4}px ${cos * u * 0.4}px`, offset: .4 }, { translate: '0 0' }], { duration: 600, easing: 'ease-out' });
        esito();
      }, 160);
      return;
    }
    // freccia o incantesimo: parte dal bordo del token e arriva al bersaglio (o lo sfiora e va oltre)
    const sx = ax + cos * ar, sy = ay + sin * ar, fine = manca ? [bx + cos * u * 1.6 - sin * u * 0.6, by + sin * u * 1.6 + cos * u * 0.6] : [bx - cos * br * 0.6, by - sin * br * 0.6];
    const d2 = Math.atan2(fine[1] - sy, fine[0] - sx) * 180 / Math.PI, dur = clamp(Math.hypot(fine[0] - sx, fine[1] - sy) / u * 70, 350, 1100);
    const g = nodo(fx, 'g', {});
    if (m.anim === 'magia') {
      nodo(g, 'circle', { r: u * 0.2, fill: m.col }); nodo(g, 'circle', { r: u * 0.1, fill: '#fff8e0' });
      for (let i = 1; i <= 5; i++) { const sci = nodo(fx, 'circle', { r: u * (0.18 - i * 0.025), fill: m.col, opacity: .55 - i * .08 }); muovi(sci, [{ transform: `translate(${sx}px,${sy}px)` }, { transform: `translate(${fine[0]}px,${fine[1]}px)` }], { duration: dur, delay: i * 30, easing: 'ease-in' }).finished.then(() => sci.remove()); }
    } else if (m.anim === 'lancio') {
      // pugnale che ruota in volo: lama chiara, elsa scura
      nodo(g, 'path', { d: `M${-u * .06} ${-u * .05}L${u * .3} 0 ${-u * .06} ${u * .05}z`, fill: m.crit ? '#ffd24a' : '#dfe5ea', stroke: '#6b7480', 'stroke-width': u * 0.012 });
      nodo(g, 'path', { d: `M${-u * .06} ${-u * .11}V${u * .11}`, stroke: '#8a6a3a', 'stroke-width': u * 0.04, 'stroke-linecap': 'round' });
      nodo(g, 'path', { d: `M${-u * .06} 0H${-u * .2}`, stroke: '#5a3d22', 'stroke-width': u * 0.05, 'stroke-linecap': 'round' });
    } else {
      nodo(g, 'path', { d: `M${-u * .5} 0H${u * .18}`, stroke: m.crit ? '#ffe08a' : '#e9d8b0', 'stroke-width': u * 0.05 });
      nodo(g, 'path', { d: `M${u * .18} ${-u * .1}L${u * .38} 0 ${u * .18} ${u * .1}z`, fill: m.crit ? '#ffd24a' : '#cfd6dc' });
      nodo(g, 'path', { d: `M${-u * .5} 0l${-u * .12} ${-u * .1}M${-u * .5} 0l${-u * .12} ${u * .1}M${-u * .4} 0l${-u * .12} ${-u * .1}M${-u * .4} 0l${-u * .12} ${u * .1}`, stroke: '#d6453b', 'stroke-width': u * 0.04 });
    }
    const alto = Math.min(u * 0.6, Math.hypot(fine[0] - sx, fine[1] - sy) * 0.08), giri = m.anim === 'lancio' ? 720 : 0;
    muovi(g, [{ transform: `translate(${sx}px,${sy}px) rotate(${d2}deg)` }, { transform: `translate(${(sx + fine[0]) / 2}px,${(sy + fine[1]) / 2 - alto}px) rotate(${d2 - 4 + giri / 2}deg)`, offset: .5 }, { transform: `translate(${fine[0]}px,${fine[1]}px) rotate(${d2 + 3 + giri}deg)` }], { duration: dur, easing: 'cubic-bezier(.3,.1,.6,1)' }).finished.then(() => {
      if (m.ritorna) { esito(); muovi(g, [{ transform: `translate(${fine[0]}px,${fine[1]}px) rotate(${d2}deg)` }, { transform: `translate(${(sx + fine[0]) / 2}px,${(sy + fine[1]) / 2 + alto}px) rotate(${d2 + 360}deg)`, offset: .5 }, { transform: `translate(${sx}px,${sy}px) rotate(${d2 + 720}deg)` }], { duration: dur, delay: 150, easing: 'cubic-bezier(.4,0,.7,1)' }).finished.then(() => g.remove()); return; }
      if (manca && m.anim !== 'magia') muovi(g, [{ opacity: 1 }, { opacity: 0 }], { duration: 400, delay: 200 }).finished.then(() => g.remove()); else g.remove();
      if (manca && m.anim === 'magia') { const f = nodo(fx, 'circle', { cx: fine[0], cy: fine[1], r: u * 0.15, fill: '#8a8178', opacity: .7 }); muovi(f, [{ r: u * 0.15, opacity: .7 }, { r: u * 0.5, opacity: 0 }], { duration: 700 }).finished.then(() => f.remove()); }
      esito();
    });
  }
  // cure e danni dati a mano: scintille verdi o un colpo rosso, con i punti
  function mostraPF(m) {
    const sc = scena(), fx = $('#tv-fx'), t = T.tok.get(m.id); if (!sc || !fx || !t || (!isDM() && tokEl(t.id)?.hidden)) return;
    const u = sc.griglia, [x, y, r] = centro(t, sc);
    if (m.delta < 0) { trema(t.id, u); scritta(fx, x, y - r - u * 0.25, '−' + -m.delta, '#ff6b5b', u, true); return; }
    scritta(fx, x, y - r - u * 0.25, '+' + m.delta, '#7dff9a', u, true);
    if (!animazioni()) return;
    const an = nodo(fx, 'circle', { cx: x, cy: y, r, fill: 'none', stroke: '#7dff9a', 'stroke-width': u * 0.06 });
    muovi(an, [{ r: r * 0.9, opacity: 1 }, { r: r * 1.9, opacity: 0 }], { duration: 900, easing: 'ease-out' }).finished.then(() => an.remove());
    for (let i = 0; i < 14; i++) {
      const s = nodo(fx, 'circle', { cx: x + (Math.random() * 2 - 1) * r, cy: y + r * 0.6, r: u * (0.03 + Math.random() * 0.04), fill: '#9dffb0' });
      muovi(s, [{ transform: 'translateY(0)', opacity: 0 }, { opacity: 1, offset: .2 }, { transform: `translateY(${-u * (0.8 + Math.random() * 0.6)}px)`, opacity: 0 }], { duration: 900 + Math.random() * 500, delay: Math.random() * 400, easing: 'ease-out' }).finished.then(() => s.remove());
    }
  }
  function effettoPF(t, delta) { if (!t || !delta) return; const m = { id: t.id, delta }; manda('pf', m); mostraPF(m); }

  /* ---------- ordine del turno ---------- */
  // una sola tabella: barra orizzontale in alto (o classica in verticale, a scelta di ognuno), trascinabile dove si vuole.
  // la matita (solo DM) la apre in modifica: iniziative, nascondi, togli, aggiungi.
  var TVERT = 'tavolo-turno-vert', TPOS = 'tavolo-turno-pos';
  function turnoVert() { try { return localStorage.getItem('tavolo-turno-vert') === '1'; } catch { return false; } }
  function turnoStretta() { try { return localStorage.getItem('tavolo-turno-stretta') === '1'; } catch { return false; } }
  function turnoPos() { try { return JSON.parse(localStorage.getItem('tavolo-turno-pos') || 'null'); } catch { return null; } }
  function giraTurno() { try { localStorage.setItem(TVERT, turnoVert() ? '0' : '1'); } catch { } disegnaStriscia(); disegnaRail(); }
  function apriTurno(apri) {
    if (!isDM()) return giraTurno();
    T.turnoEd = !!apri;
    if (apri) { const t = $('#tv-tdp'), p = $('#tv-sp'); if (t) t.hidden = true; if (p) p.hidden = true; }
    disegnaStriscia(); disegnaRail();
  }
  const ordinati = () => [...T.turno].sort((a, b) => b.valore - a.valore || (a.creato < b.creato ? -1 : 1));
  // passa al prossimo nell'ordine del turno (tappa-7.sql salta chi è a 0 PF)
  async function finisciTurno() {
    const r = await SB.rpc('tavolo_turno_avanti'); if (r.error) return toast(r.error.message, 'err');
    const x = T.turno.find(y => y.id === r.data); if (x) toast(`Tocca a ${x.nome || '?'}.`);
  }
  // chi muore (un PNG a 0 PF, o chiunque abbia la condizione «Morto») esce dall'ordine del turno: lo fa il DM
  const togliendo = new Set();
  function togliMorti() {
    if (!isDM() || !T.turno?.length) return;
    for (const x of T.turno) {
      const t = x.token && T.tok.get(x.token); if (!t || togliendo.has(x.id)) continue;
      const pf = pfDi(t), morto = condTok(t).includes('Morto') || (!t.giocatore && pf?.max > 0 && pf.pf === 0);
      if (!morto) continue;
      togliendo.add(x.id);
      (async () => {
        if (T.stato?.turno === x.id && T.turno.length > 1) { const r = await SB.rpc('tavolo_turno_avanti'); if (r.error) toast(r.error.message, 'err'); }
        const r = await SB.from('tavolo_turno').delete().eq('id', x.id); togliendo.delete(x.id);
        if (r.error) return toast(r.error.message, 'err');
        T.turno = T.turno.filter(y => y.id !== x.id); disegnaTurno(); disegnaToken(); manda('turno', {});
        toast(`☠ ${x.nome || t.nome || 'Il token'} è morto: tolto dall'ordine del turno.`);
      })();
    }
  }
  // la tabella del turno: le facce in ordine di iniziativa, chi gioca in grande
  function disegnaStriscia() {
    const s = $('#tv-strip'), w = $('.tv-wrap'); if (!s) return;
    const L = ordinati(), att = T.stato?.turno, ia = L.findIndex(x => x.id === att);
    const ed = isDM() && !!T.turnoEd, col = !ed && turnoVert() && turnoStretta(), vert = !col && (ed || turnoVert()), pos = turnoPos();
    // la tabella si vede solo sulla mappa del combattimento (il DM può guardarne un'altra)
    const qui = !L.length || !T.vista || scenaCombattimento() === T.vista;
    s.hidden = (!L.length || !qui) && !ed; s.classList.toggle('vert', vert); s.classList.toggle('col', col); s.classList.toggle('ed', ed);
    w?.classList.toggle('con-turno', !s.hidden && !vert && !col && !pos);
    if (s.hidden) { s.innerHTML = ''; disegnaHud(); return; }
    const avanti = L.length && (isDM() || L.some(x => x.id === att && x.giocatore === T.me.giocatore));
    const faccia = x => `<i style="--c:${esc(x.colore || '#7d2530')};${x.immagine ? `background-image:url('${x.immagine}')` : ''}">${x.immagine ? '' : esc(iniziali(x.nome))}</i>`;
    const grip = '<span class="mv" title="Trascina per spostare (doppio click: torna al suo posto)" aria-hidden="true">⠿</span>';
    const bottoni = `<button type="button" class="tv-b sec ico" data-k="gira" title="${vert ? 'Barra orizzontale' : 'Tabella classica (verticale)'}" aria-label="${vert ? 'Barra orizzontale' : 'Tabella classica'}"${ed ? ' hidden' : ''}>${vert ? '⇄' : '⇅'}</button>${isDM() ? `<button type="button" class="tv-b sec ico${ed ? ' on' : ''}" data-k="ed" title="${ed ? 'Fine modifica' : 'Modifica l\'ordine del turno'}" aria-label="Modifica l'ordine del turno">✎</button><button type="button" class="tv-b sec ico" data-k="x" title="Fine combattimento: svuota l'ordine del turno e chiude la tabella" aria-label="Fine combattimento">✕</button>` : ''}`;
    const bav = `<button type="button" class="tv-b pri" data-k="av" title="Passa al prossimo (chi è a 0 PF viene saltato)"${avanti ? '' : ' hidden'}>${col ? 'Fine ▶' : 'Finisci il turno ▶'}</button>`;
    // in verticale si può stringere: le facce una sotto l'altra, come la barra
    const bstr = ed ? '' : `<button type="button" class="tv-b sec ico" data-k="str" title="${col ? 'Allarga: tabella con i nomi' : 'Stringi: solo le facce'}" aria-label="${col ? 'Allarga la tabella' : 'Stringi la tabella'}">${col ? '⇥' : '⇤'}</button>`;
    if (!vert) {
      s.innerHTML = `${grip}<div class="rd"><small>Round</small>${T.stato?.round || 1}</div><div class="ls">${L.map((x, i) => `<span class="p${i === ia ? ' on' : ''}${ia >= 0 && i < ia ? ' gia' : ''}${x.giocatore ? '' : ' nem'}${x.nascosto ? ' hid' : ''}" title="${esc(x.nome)} · iniziativa ${x.valore}${x.nascosto ? ' (nascosto ai giocatori)' : ''}">${faccia(x)}<b>${esc(String(x.nome || '').split(/\s+/)[0])}</b><em>${x.valore}</em></span>`).join('')}</div>
      <div class="ac">${bav}${col ? bstr : ''}${bottoni}</div>`;
    } else {
      s.innerHTML = `<div class="tt">${grip}<b><small>Round</small> ${T.stato?.round || 1}</b><span class="ac">${bstr}${bottoni}</span></div>
      <div class="tv-tl">${L.map((x, i) => `<div class="tv-tr${x.id === att ? ' att' : ''}${ia >= 0 && i < ia ? ' gia' : ''}${x.nascosto ? ' hid' : ''}" data-id="${x.id}">${faccia(x)}<span title="${esc(x.nome)}">${esc(x.nome)}${x.id === att ? '<small class="ora">sta giocando</small>' : ''}</span>
        ${ed ? `<input type="number" step="1" value="${x.valore}" aria-label="Iniziativa di ${esc(x.nome)}"><button type="button" data-k="nasc" title="${x.nascosto ? 'Mostra ai giocatori' : 'Nascondi ai giocatori'}">${x.nascosto ? '🙈' : '👁'}</button><button type="button" data-k="via" title="Togli dall'ordine">✕</button>` : `<em>${x.valore}</em>`}</div>`).join('')
        || '<div class="tv-tvuoto">Nessuno ancora. Clicca un token e premi «Tira» accanto a Iniziativa, o aggiungilo qui sotto.</div>'}</div>
      ${ed ? '<div class="tv-tf"><input type="text" data-k="nn" placeholder="Nome" style="flex:1;width:auto"><input type="number" data-k="nv" placeholder="0"><button type="button" data-k="add">+ Aggiungi</button><button type="button" data-k="svuota">Svuota</button></div>' : `<div class="pie">${bav}</div>`}`;
    }
    s.querySelector('[data-k=av]')?.addEventListener('click', finisciTurno);
    s.querySelector('[data-k=x]')?.addEventListener('click', () => fineCombattimento());
    s.querySelector('[data-k=ed]')?.addEventListener('click', () => apriTurno(!T.turnoEd));
    s.querySelector('[data-k=gira]').onclick = giraTurno;
    s.querySelector('[data-k=str]')?.addEventListener('click', () => { try { localStorage.setItem('tavolo-turno-stretta', col ? '0' : '1'); } catch { } disegnaStriscia(); });
    if (ed) legaModificaTurno(s);
    trascinaTurno(s, s.querySelector('.mv'));
    piazzaTurno(s, pos);
    const on = s.querySelector('.p.on'), ls = s.querySelector('.ls');
    if (on && col) ls.scrollTop = on.offsetTop - ls.clientHeight / 2 + on.offsetHeight / 2;
    else if (on) ls.scrollLeft = on.offsetLeft - ls.clientWidth / 2 + on.offsetWidth / 2;
    disegnaHud();
  }
  // dove l'ha lasciata chi guarda, senza farla uscire dal tavolo
  function piazzaTurno(s, pos) {
    if (!pos) { s.style.left = s.style.top = s.style.right = ''; return; }
    const w = s.parentElement; if (!w) return;
    s.style.right = 'auto';
    s.style.left = Math.round(clamp(pos.x, 0, Math.max(0, w.clientWidth - s.offsetWidth))) + 'px';
    s.style.top = Math.round(clamp(pos.y, 0, Math.max(0, w.clientHeight - s.offsetHeight))) + 'px';
  }
  function trascinaTurno(s, h) {
    if (!h) return;
    h.onpointerdown = e => {
      if (e.button) return; e.preventDefault();
      const w = s.parentElement.getBoundingClientRect(), r = s.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
      let pos = null; h.setPointerCapture(e.pointerId); s.classList.add('tira');
      h.onpointermove = m => { pos = { x: m.clientX - w.left - dx, y: m.clientY - w.top - dy }; piazzaTurno(s, pos); $('.tv-wrap')?.classList.remove('con-turno'); };
      h.onpointerup = h.onpointercancel = () => {
        h.onpointermove = h.onpointerup = h.onpointercancel = null; s.classList.remove('tira');
        if (pos) { try { localStorage.setItem(TPOS, JSON.stringify({ x: parseInt(s.style.left), y: parseInt(s.style.top) })); } catch { } }
      };
    };
    h.ondblclick = () => { try { localStorage.removeItem(TPOS); } catch { } disegnaStriscia(); };
  }
  function legaModificaTurno(b) {
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
      if (!T.turno.some(y => y.id === r.data.id)) T.turno.push(r.data); disegnaTurno(); manda('turno', {});
    };
    const sv = b.querySelector('[data-k=svuota]');
    if (sv) sv.onclick = () => fineCombattimento('Svuotare l\'ordine del turno?', 'Svuota', 'Ordine del turno');
  }
  // il pannello in basso di chi sta giocando: azione, azione bonus, reazione, movimento rimasto
  // gli avvisi in basso salgono sopra il pannello del turno, così non lo coprono
  function alzaAvvisi() {
    const h = $('#tv-hud'); if (!h || h.hidden) return;
    const r = h.getBoundingClientRect(), w = h.closest('.tv-wrap');
    document.documentElement.style.setProperty('--tv-avvisi', Math.round(innerHeight - r.top + 10) + 'px');
    if (w) w.style.setProperty('--tv-hudh', Math.round(w.getBoundingClientRect().bottom - r.top + 8) + 'px');
  }
  function disegnaHud() {
    const h = $('#tv-hud'), w = $('.tv-wrap'); if (!h) return;
    const att = T.turno?.find(x => x.id === T.stato?.turno), t = att?.token && T.tok.get(att.token);
    // le azioni ora stanno sul token (bollini e metri): il pannello in basso resta spento
    const vedo = false && !!t && t.scena === T.vista && puoMuovere(t);
    h.hidden = !vedo; w?.classList.toggle('con-hud', vedo);
    // la striscia mostra «Finisci il turno» solo quando non c'è il pannello
    const sa = $('#tv-strip [data-k=av]'); if (sa) sa.hidden = vedo || !(isDM() || att?.giocatore === T.me.giocatore);
    if (!vedo) { h.innerHTML = ''; return; }
    requestAnimationFrame(alzaAvvisi);
    const a = azioniDi(t), mv = movimentoDi(t), q = mv.tot > 0 ? clamp(mv.resta / mv.tot, 0, 1) : 0;
    h.innerHTML = `<i class="fo" style="--c:${esc(t.colore || '#7d2530')};${t.immagine ? `background-image:url('${t.immagine.replace(/'/g, '%27')}')` : ''}">${t.immagine ? '' : esc(iniziali(t.nome))}</i>
      <div class="t"><b>Turno di ${esc(t.nome || att.nome || '?')}</b><div class="r">${AZ.map(([k, ic, l]) => `<button type="button" class="c${usata(t, k) ? ' no' : ''}" data-z="${k}" title="${l}: ${usata(t, k) ? 'usata (tocca per ridarla)' : 'disponibile (tocca quando la usi)'}" aria-label="${l}">${ic}<span class="lg"> ${l}</span></button>`).join('')}</div>${(a.fatte || []).length ? `<div class="r fzr">${fatteHtml(t, 'fz', 'fz')}</div>` : ''}</div>
      <div class="mv${mv.resta < 0 ? ' ko' : ''}"><span>🏃<span class="lg"> Movimento:</span> <b>${metri(Math.max(0, mv.resta))}</b><span class="lg"> di </span><span class="sh">/</span>${metri(mv.tot)}</span><span class="bar"><s style="width:${q * 100}%"></s></span></div>
      <div class="ac"><button type="button" class="tv-b sec" data-k="azm" title="Scatto, Disimpegno, Schivata, Nascondersi…" aria-haspopup="menu">Azioni ▾</button><button type="button" class="tv-b pri" data-k="fine" title="Passa al prossimo nell'ordine del turno"><span class="lg">Finisci il turno ▶</span><span class="sh">Fine ▶</span></button></div>`;
    h.querySelectorAll('[data-z]').forEach(b => b.onclick = () => cambiaAz(t, b.dataset.z));
    h.querySelectorAll('[data-k=fz]').forEach(b => b.onclick = () => togliAzione(t, +b.dataset.i));
    h.querySelector('[data-k=azm]').onclick = e => menuAzioni(t, e.currentTarget);
    h.querySelector('[data-k=fine]').onclick = finisciTurno;
  }
  function disegnaTurno() { disegnaStriscia(); }
  // svuota l'ordine del turno: la striscia in alto sparisce per tutti
  async function fineCombattimento(dom = 'Il combattimento è finito? L\'ordine del turno si svuota e la barra in alto sparisce per tutti.', ok = 'Fine combattimento', title = 'Fine del combattimento') {
    if (!T.turno.length || !await ask(dom, { ok, title })) return;
    await svuotaTurno();
  }
  async function svuotaTurno() {
    const r = await SB.from('tavolo_turno').delete().in('id', T.turno.map(y => y.id)); if (r.error) { toast(r.error.message, 'err'); return false; }
    await SB.from('tavolo_stato').update({ turno: null, round: 1 }).eq('id', 1);
    T.turno = []; T.stato.turno = null; T.stato.round = 1; disegnaTurno(); disegnaToken(); manda('turno', {});
    return true;
  }
  // il combattimento appartiene alla mappa dei suoi token (chi è aggiunto a mano sta sulla mappa dei giocatori)
  function scenaCombattimento() {
    for (const x of ordinati()) { const t = x.token && T.tok.get(x.token); if (t?.scena) return t.scena; }
    return T.turno.length ? T.stato?.scena || null : null;
  }
  async function salvaTurno(id, ch) {
    const r = await SB.from('tavolo_turno').update(ch).eq('id', id).select().single();
    if (r.error) { toast(r.error.message, 'err'); disegnaTurno(); return; }
    const i = T.turno.findIndex(y => y.id === id); if (i >= 0) T.turno[i] = r.data; disegnaTurno();
  }
  // 1d20 + modificatore, tirato dal server come ogni dado, e il risultato entra (o si aggiorna) nell'ordine del turno
  async function iniziativa(t, mod) {
    // l'iniziativa si tira una volta sola: per cambiarla il DM usa la matita della tabella del turno
    const gia = T.turno.find(x => x.token === t.id);
    if (gia && scenaCombattimento() === t.scena) return toast(`${t.nome || 'Il token'} ha già tirato l'iniziativa: ${gia.valore}.`);
    // un combattimento per mappa: tirare su un'altra mappa ne apre uno nuovo
    const cs = scenaCombattimento();
    if (isDM() && cs && t.scena && cs !== t.scena) {
      if (!await ask(`C'è un combattimento in corso su «${T.scene.get(cs)?.nome || 'un\'altra mappa'}». Lo chiudo e ne inizio uno nuovo qui?`, { ok: 'Nuovo combattimento', title: 'Combattimento su un\'altra mappa' })) return;
      if (!await svuotaTurno()) return;
    }
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
    disegnaTurno(); toast(`Iniziativa di ${t.nome || 'token'}: ${tiro.totale}`);
  }
  /* ---------- schede dei personaggi e dei PNG (tappa 3) ---------- */
  // una scheda di 5e per personaggio e per PNG; il giocatore compila la sua, il DM tutte. Si aggiornano dal vivo.
  const CAR = [['for', 'FOR', 'Forza'], ['des', 'DES', 'Destrezza'], ['cos', 'COS', 'Costituzione'], ['int', 'INT', 'Intelligenza'], ['sag', 'SAG', 'Saggezza'], ['car', 'CAR', 'Carisma']];
  const ABIL = [['acrobazia', 'Acrobazia', 'des'], ['addestrare', 'Addestrare animali', 'sag'], ['arcano', 'Arcano', 'int'], ['atletica', 'Atletica', 'for'], ['furtivita', 'Furtività', 'des'], ['indagare', 'Indagare', 'int'], ['inganno', 'Inganno', 'car'], ['intimidire', 'Intimidire', 'car'], ['intrattenere', 'Intrattenere', 'car'], ['intuizione', 'Intuizione', 'sag'], ['medicina', 'Medicina', 'sag'], ['natura', 'Natura', 'int'], ['percezione', 'Percezione', 'sag'], ['persuasione', 'Persuasione', 'car'], ['rapidita', 'Rapidità di mano', 'des'], ['religione', 'Religione', 'int'], ['sopravvivenza', 'Sopravvivenza', 'sag'], ['storia', 'Storia', 'int']];
  const CONDIZIONI = ['Accecato', 'Affascinato', 'Afferrato', 'Assordato', 'Avvelenato', 'Incapacitato', 'Invisibile', 'Paralizzato', 'Pietrificato', 'Prono', 'Spaventato', 'Stordito', 'Svenuto', 'Trattenuto', 'Concentrazione', 'Morto'];
  const BASE = { for: 10, des: 10, cos: 10, int: 10, sag: 10, car: 10 };
  const num = v => v === '' || v == null || isNaN(+v) ? null : +v;
  const segno = n => (n < 0 ? '−' : '+') + Math.abs(n);
  const piu = n => n ? (n > 0 ? '+' : '') + n : '';
  const modC = v => Math.floor(((num(v) ?? 10) - 10) / 2);
  const gsN = g => { const s = String(g ?? ''); return s.includes('/') ? 0 : +s || 0; };
  const comp = s => num(s.dati.comp) ?? (formaPg(s) ? 2 + Math.floor((Math.max(1, num(s.dati.livello) || 1) - 1) / 4) : 2 + Math.floor(Math.max(0, gsN(s.dati.gs) - 1) / 4));
  const tsTot = (s, k) => modC(s.dati[k]) + (s.dati['ts_' + k] ? comp(s) : 0);
  const abTot = (s, k) => { const a = ABIL.find(x => x[0] === k); return modC(s.dati[a[2]]) + (num(s.dati['ab_' + k]) || 0) * comp(s); };
  const carInc = s => s.dati.car_inc || 'int';

  // statistiche dal regolamento base (SRD 5.1), da cui partire per un PNG nuovo
  const att = (nome, colpire, danni, tipo) => ({ nome, colpire, danni, tipo });
  const MODELLI = [
    { nome: 'Bandito', dati: { taglia_tipo: 'Umanoide Medio', gs: '1/8', ca: 12, pf: 11, pf_max: 11, dadi_vita: '2d8+2', velocita: '9 m', for: 11, des: 12, cos: 12, int: 10, sag: 10, car: 10, linguaggi: 'Comune', attacchi: [att('Scimitarra', 3, '1d6+1', 'taglienti'), att('Balestra leggera', 3, '1d8+1', 'perforanti, gittata 24/96 m')] } },
    { nome: 'Capo dei banditi', dati: { taglia_tipo: 'Umanoide Medio', gs: '2', ca: 15, pf: 65, pf_max: 65, dadi_vita: '10d8+20', velocita: '9 m', for: 15, des: 16, cos: 14, int: 14, sag: 11, car: 14, ts_for: true, ts_des: true, ts_sag: true, ab_atletica: 1, ab_inganno: 1, linguaggi: 'Due lingue a scelta', attacchi: [att('Scimitarra', 5, '1d6+3', 'taglienti'), att('Pugnale', 5, '1d4+3', 'perforanti, anche da lancio 6/18 m')], azioni: 'Multiattacco: tre attacchi in mischia, due con la scimitarra e uno con il pugnale (oppure due attacchi a distanza con i pugnali).\nParata (reazione): +2 alla CA contro un attacco in mischia che lo colpirebbe, se vede l\'attaccante e impugna un\'arma.' } },
    { nome: 'Goblin', dati: { taglia_tipo: 'Umanoide Piccolo (goblinoide)', gs: '1/4', ca: 15, pf: 7, pf_max: 7, dadi_vita: '2d6', velocita: '9 m', for: 8, des: 14, cos: 10, int: 10, sag: 8, car: 8, ab_furtivita: 2, sensi: 'Scurovisione 18 m', linguaggi: 'Comune, Goblin', attacchi: [att('Scimitarra', 4, '1d6+2', 'taglienti'), att('Arco corto', 4, '1d6+2', 'perforanti, gittata 24/96 m')], azioni: 'Fuga agile: in ogni suo turno può Disimpegnarsi o Nascondersi con un\'azione bonus.' } },
    { nome: 'Orco', dati: { taglia_tipo: 'Umanoide Medio (orco)', gs: '1/2', ca: 13, pf: 15, pf_max: 15, dadi_vita: '2d8+6', velocita: '9 m', for: 16, des: 12, cos: 16, int: 7, sag: 11, car: 10, ab_intimidire: 1, sensi: 'Scurovisione 18 m', linguaggi: 'Comune, Orchesco', attacchi: [att('Ascia bipenne', 5, '1d12+3', 'taglienti'), att('Giavellotto', 5, '1d6+3', 'perforanti, gittata 9/36 m')], azioni: 'Aggressivo: con un\'azione bonus si muove fino alla sua velocità verso una creatura ostile che vede.' } },
    { nome: 'Lupo', dati: { taglia_tipo: 'Bestia Media', gs: '1/4', ca: 13, pf: 11, pf_max: 11, dadi_vita: '2d8+2', velocita: '12 m', for: 12, des: 15, cos: 12, int: 3, sag: 12, car: 6, ab_percezione: 1, ab_furtivita: 1, attacchi: [att('Morso', 4, '2d4+2', 'perforanti')], azioni: 'Udito e olfatto acuti: vantaggio alle prove di Saggezza (Percezione) basate su udito o olfatto.\nTattiche del branco: vantaggio al tiro per colpire se un alleato non incapacitato è entro 1,5 m dal bersaglio.\nMorso: se colpisce, il bersaglio deve superare un TS su Forza CD 11 o cade prono.' } },
    { nome: 'Lupo crudele', dati: { taglia_tipo: 'Bestia Grande', misura: 2, gs: '1', ca: 14, pf: 37, pf_max: 37, dadi_vita: '5d10+10', velocita: '15 m', for: 17, des: 15, cos: 15, int: 3, sag: 12, car: 7, ab_percezione: 1, ab_furtivita: 1, attacchi: [att('Morso', 5, '2d6+3', 'perforanti')], azioni: 'Udito e olfatto acuti: vantaggio alle prove di Saggezza (Percezione) basate su udito o olfatto.\nTattiche del branco: vantaggio al tiro per colpire se un alleato non incapacitato è entro 1,5 m dal bersaglio.\nMorso: se colpisce, il bersaglio deve superare un TS su Forza CD 13 o cade prono.' } },
    { nome: 'Scheletro', dati: { taglia_tipo: 'Non morto Medio', gs: '1/4', ca: 13, pf: 13, pf_max: 13, dadi_vita: '2d8+4', velocita: '9 m', for: 10, des: 14, cos: 15, int: 6, sag: 8, car: 5, sensi: 'Scurovisione 18 m', linguaggi: 'Capisce le lingue che parlava in vita, ma non parla', difese: 'Vulnerabile ai danni contundenti. Immune ai danni da veleno, a sfinimento e avvelenato.', attacchi: [att('Spada corta', 4, '1d6+2', 'perforanti'), att('Arco corto', 4, '1d6+2', 'perforanti, gittata 24/96 m')] } },
    { nome: 'Zombi', dati: { taglia_tipo: 'Non morto Medio', gs: '1/4', ca: 8, pf: 22, pf_max: 22, dadi_vita: '3d8+9', velocita: '6 m', for: 13, des: 6, cos: 16, int: 3, sag: 6, car: 5, ts_sag: true, sensi: 'Scurovisione 18 m', difese: 'Immune ai danni da veleno e ad avvelenato.', attacchi: [att('Schianto', 3, '1d6+1', 'contundenti')], azioni: 'Tempra da non morto: se i danni lo portano a 0 PF tira un TS su Costituzione con CD 5 + i danni subiti, a meno che i danni siano radiosi o di un colpo critico. Se lo supera resta a 1 PF.' } },
    { nome: 'Guardia', dati: { taglia_tipo: 'Umanoide Medio', gs: '1/8', ca: 16, pf: 11, pf_max: 11, dadi_vita: '2d8+2', velocita: '9 m', for: 13, des: 12, cos: 12, int: 10, sag: 11, car: 10, ab_percezione: 1, linguaggi: 'Comune', attacchi: [att('Lancia', 3, '1d6+1', 'perforanti (1d8+1 a due mani)')] } },
    { nome: 'Cultista', dati: { taglia_tipo: 'Umanoide Medio', gs: '1/8', ca: 12, pf: 9, pf_max: 9, dadi_vita: '2d8', velocita: '9 m', for: 11, des: 12, cos: 10, int: 10, sag: 11, car: 10, ab_inganno: 1, ab_religione: 1, linguaggi: 'Comune', attacchi: [att('Scimitarra', 3, '1d6+1', 'taglienti')], azioni: 'Devozione oscura: vantaggio ai tiri salvezza per non essere affascinato o spaventato.' } },
    { nome: 'Brutto ceffo', dati: { taglia_tipo: 'Umanoide Medio', gs: '1/2', ca: 11, pf: 32, pf_max: 32, dadi_vita: '5d8+10', velocita: '9 m', for: 15, des: 11, cos: 14, int: 10, sag: 10, car: 11, ab_intimidire: 1, linguaggi: 'Comune', attacchi: [att('Mazza', 4, '1d6+2', 'contundenti'), att('Balestra pesante', 2, '1d10', 'perforanti, gittata 30/120 m')], azioni: 'Multiattacco: due attacchi in mischia.\nTattiche del branco: vantaggio al tiro per colpire se un alleato non incapacitato è entro 1,5 m dal bersaglio.' } },
    { nome: 'Ogre', dati: { taglia_tipo: 'Gigante Grande', misura: 2, gs: '2', ca: 11, pf: 59, pf_max: 59, dadi_vita: '7d10+21', velocita: '12 m', for: 19, des: 8, cos: 16, int: 5, sag: 7, car: 7, sensi: 'Scurovisione 18 m', linguaggi: 'Comune, Gigante', attacchi: [att('Randello pesante', 6, '2d8+4', 'contundenti'), att('Giavellotto', 6, '2d6+4', 'perforanti, gittata 9/36 m')] } },
    { nome: 'Ragno gigante', dati: { taglia_tipo: 'Bestia Grande', misura: 2, gs: '1', ca: 14, pf: 26, pf_max: 26, dadi_vita: '4d10+4', velocita: '9 m, scalare 9 m', for: 14, des: 16, cos: 12, int: 2, sag: 11, car: 4, ab_furtivita: 2, sensi: 'Vista cieca 3 m, scurovisione 18 m', attacchi: [att('Morso', 5, '1d8+3', 'perforanti + 2d8 da veleno (TS Costituzione CD 11, dimezza)')], azioni: 'Ragnatela (ricarica 5–6): attacco a distanza +5, gittata 9/18 m. Il bersaglio è trattenuto (prova di Forza CD 12 per liberarsi).\nMovimento del ragno: si arrampica ovunque, anche a testa in giù, e ignora le ragnatele.' } },
    { nome: 'Veterano', dati: { taglia_tipo: 'Umanoide Medio', gs: '3', ca: 17, pf: 58, pf_max: 58, dadi_vita: '9d8+18', velocita: '9 m', for: 16, des: 13, cos: 14, int: 10, sag: 11, car: 10, ab_atletica: 1, ab_percezione: 1, linguaggi: 'Comune', attacchi: [att('Spada lunga', 5, '1d8+3', 'taglienti (1d10+3 a due mani)'), att('Spada corta', 5, '1d6+3', 'perforanti'), att('Balestra pesante', 3, '1d10+1', 'perforanti, gittata 30/120 m')], azioni: 'Multiattacco: due attacchi con la spada lunga e, se impugna una spada corta, anche uno con la spada corta.' } }
  ];

  // quale scheda ha un token: una del tavolo (tv:…), quella del personaggio del giocatore, o quella collegata al PNG del sito
  const schedaDi = t => {
    if (!t || !T.schede) return null;
    if (t.scheda?.startsWith('tv:')) return T.schede.get(t.scheda.slice(3)) || null;
    const v = [...T.schede.values()];
    // un PNG mosso da un giocatore (Edward affidato a Livion) resta il PNG, non il personaggio del giocatore
    if (t.giocatore && t.scheda) { const s = v.find(x => x.tipo === 'png' && x.entita === t.scheda); if (s) return s; }
    if (t.giocatore) { const s = v.find(x => x.giocatore === t.giocatore); if (s) return s; }
    return t.scheda ? v.find(x => x.entita === t.scheda) || null : null;
  };
  // il giocatore compila la propria scheda e quelle che il DM gli affida (assegnata: per esempio Edward)
  const puoScrivere = s => isDM() || (!!T.me.giocatore && (s.giocatore === T.me.giocatore || s.assegnata === T.me.giocatore));
  // scheda completa, come quella di un giocatore: i PG e i personaggi principali del DM (dati.forma = 'pg');
  // gli altri personaggi hanno la scheda da PNG (blocco delle statistiche)
  const formaPg = s => s.tipo === 'pg' || s.dati?.forma === 'pg';
  // quella consigliata per un personaggio del sito: completa se nel sito è segnato come principale
  const formaPer = e => e?.imp === 'importante' ? 'pg' : 'png';
  const fotoScheda = s => s.immagine || S.ents?.get(s.entita)?.portrait?.thumb || null;
  const completaS = (prima, nuovo) => { const o = completa(prima, nuovo); if (prima?.dati && !nuovo.dati) o.dati = prima.dati; return o; };
  // condizioni sui token, con un effetto che vedono tutti
  const COND_FX = { Accecato: ['🙈', 'accecato'], Affascinato: ['💗', 'affascinato'], Afferrato: ['✊', 'afferrato'], Assordato: ['🔇', 'assordato'], Avvelenato: ['🤢', 'avvelenato'], Incapacitato: ['⛔', 'incapacitato'], Invisibile: ['👻', 'invisibile'], Paralizzato: ['⚡', 'paralizzato'], Pietrificato: ['🗿', 'pietrificato'], Prono: ['🛌', 'prono'], Spaventato: ['😱', 'spaventato'], Stordito: ['💫', 'stordito'], Svenuto: ['💤', 'svenuto'], Trattenuto: ['⛓️', 'trattenuto'], Concentrazione: ['🔮', 'concentrazione'], Morto: ['💀', 'morto'] };
  const condTok = t => Array.isArray(t?.condizioni) ? t.condizioni : [];
  async function condSuToken(t, lista) {
    const r = await SB.from('tavolo_token').update({ condizioni: lista }).eq('id', t.id).select().single();
    if (r.error) { toast(sqlMancante(r.error) ? 'Per vedere le condizioni sui token esegui tavolo/tappa-3b.sql in Supabase.' : r.error.message, 'err'); return false; }
    T.tok.set(t.id, completa(T.tok.get(t.id), r.data)); disegnaToken(); return true;
  }
  // un PNG aperto da un token cambia solo quel token; un personaggio cambia la scheda e i suoi token
  async function cambiaCond(s, tk, lista) {
    lista = [...new Set(lista)];
    if (tk) return condSuToken(tk, lista);
    if (s) await salvaScheda(s.id, { condizioni: lista }, true);
    if (s?.giocatore) for (const t of [...T.tok.values()].filter(t => t.giocatore === s.giocatore && puoMuovere(t))) await condSuToken(t, lista);
  }
  // i punti ferita di un token: i suoi (ogni PNG ha i propri) o quelli della scheda del personaggio
  function pfDi(t) {
    if (t.pf_max != null) return { pf: t.pf ?? t.pf_max, max: t.pf_max, tok: true };
    const s = schedaDi(t), m = num(s?.dati.pf_max);
    if (!s && t.giocatore) { const g = T.pfg?.get(t.giocatore); return g?.pf_max ? { pf: g.pf ?? g.pf_max, max: g.pf_max, temp: g.pf_temp || 0 } : null; } // un compagno: solo la barra
    return m ? { pf: num(s.dati.pf) ?? m, max: m, temp: num(s.dati.pf_temp) || 0, s } : null;
  }
  async function cambiaPF(t, delta) {
    const p = pfDi(t); if (!p || !delta) return;
    if (p.tok || (isDM() && p.s.tipo === 'png')) {
      const pf = clamp(p.pf + delta, 0, p.max), ch = { pf, pf_max: p.max }, cc = condTok(t);
      // un nemico a 0 punti ferita è sconfitto: prende la condizione Morto, e la perde se lo si cura
      if (!t.giocatore && 'condizioni' in t) { if (!pf && !cc.includes('Morto')) ch.condizioni = [...cc, 'Morto']; else if (pf && cc.includes('Morto')) ch.condizioni = cc.filter(c => c !== 'Morto'); }
      const r = await SB.from('tavolo_token').update(ch).eq('id', t.id).select().single();
      if (r.error) return toast(r.error.message, 'err');
      T.tok.set(t.id, completa(T.tok.get(t.id), r.data)); disegnaToken(); aggiornaFinestra(); effettoPF(t, pf - p.pf); return;
    }
    await pfScheda(p.s, delta);
  }
  // i danni tolgono prima i PF temporanei
  function pfScheda(s, delta) {
    const d = s.dati, max = num(d.pf_max); let temp = num(d.pf_temp) || 0, pf = num(d.pf) ?? max ?? 0;
    if (delta < 0 && temp) { const a = Math.min(temp, -delta); temp -= a; delta += a; }
    const prima = pf; pf = max == null ? Math.max(0, pf + delta) : clamp(pf + delta, 0, max);
    const sc = scena(); if (sc) for (const t of T.tok.values()) if (t.scena === sc.id && t.pf_max == null && schedaDi(t)?.id === s.id) effettoPF(t, pf - prima);
    return salvaScheda(s.id, { pf, pf_temp: temp || null }, true);
  }

  // salvataggio: subito sullo schermo, al database dopo una breve pausa (solo i campi cambiati)
  const pend = new Map();
  // attacchi con la caratteristica scelta dall'ingranaggio: bonus per colpire e danni si calcolano da soli
  const CAR_ATT = [['', 'Automatica'], ['man', 'Manuale: scrivo io bonus e danni'], ['for', 'Forza'], ['des', 'Destrezza'], ['acc', 'Accurata: la migliore tra Forza e Destrezza'], ['int', 'Intelligenza'], ['sag', 'Saggezza'], ['car', 'Carisma']];
  const migliore = s => modC(s.dati.des) > modC(s.dati.for) ? 'des' : 'for';
  /* armi del manuale (regole.js): dal nome dell'attacco il sito riconosce l'arma e ne conosce dado, tipo di danno, proprietà
     e caratteristica; dalla classe, dalla razza e dalle «Altre competenze» capisce se il personaggio è competente */
  const REG = () => window.__regole || null;
  const radice = w => w.replace(/i?h?[aeio]$/, '');
  const chiaveArma = t => norm(t).replace(/[^a-z ]/g, ' ').split(/\s+/).filter(Boolean).map(radice).join(' ');
  function armaAtt(s, a) {
    const R = REG(); if (!R || !a || a.car === 'man') return null;
    if (a.arma) return R.armi.find(w => w[0] === a.arma) || null;
    // solo le schede complete: il blocco dei PNG resta com'è scritto
    if (!formaPg(s)) return null;
    const n = norm(a.nome); if (!n || /incantat/.test(n) || /incantesim/.test(norm(a.tipo))) return null;
    if ((s.dati.incantesimi || []).some(sp => chiaveInc(sp.nome) && chiaveInc(sp.nome) === chiaveInc(a.nome))) return null;
    const k = chiaveArma(a.nome);
    return [...R.armi].sort((x, y) => y[0].length - x[0].length).find(w => { const c = chiaveArma(w[0]); return k === c || k.startsWith(c + ' '); }) || null;
  }
  const propArma = w => String(w?.[4] || '');
  const versatile = w => (propArma(w).match(/versatile \((\d*d\d+)\)/) || [])[1] || '';
  const carArma = (s, w) => /accurata/.test(propArma(w)) ? migliore(s) : /a distanza/.test(propArma(w)) ? 'des' : 'for';
  // la razza della scheda: quella scelta nella procedura, oppure riconosciuta dal testo («Elfo alto» = «Alto elfo»)
  function razzeScheda(R, d) {
    const parole = new Set(norm(d.razza).split(/\s+/).filter(Boolean)), out = [];
    for (const r of R.razze) for (const x of [r, ...(r.sotto || [])]) {
      const p = norm(x.nome).replace(/\(.*\)/, '').split(/\s+/).filter(Boolean);
      if (d.razza_id === x.id || d.sottorazza === x.id || (p.length && p.every(w => parole.has(w)))) { if (x !== r && !out.includes(r)) out.push(r); out.push(x); }
    }
    return out;
  }
  // tutte le competenze della scheda in un testo: classe (e multiclasse), razza, «Altre competenze»
  function testoComp(s) {
    const R = REG(), d = s.dati, testi = [d.lingue, d.competenze];
    if (R) {
      classiDi(R, d).L.forEach((c, i) => { const k = R.classi[c.id]; testi.push(i ? k.multiComp : k.comp); });
      razzeScheda(R, d).forEach(x => testi.push(x.comp));
    }
    return norm(testi.filter(Boolean).join('; '));
  }
  function competenzeArmi(s) {
    const t = testoComp(s), frasi = new Set(t.split(/[,;.\n]|\be\b/).map(chiaveArma).filter(Boolean));
    return { semplici: /armi semplici/.test(t), guerra: /armi (?:semplici e )?da guerra/.test(t), frasi };
  }
  const competenteArma = (s, w) => { const c = competenzeArmi(s); return (w[3] === 'semplice' && c.semplici) || (w[3] === 'guerra' && c.guerra) || c.frasi.has(chiaveArma(w[0])); };
  const piccolo = s => { const R = REG(); return !!R && razzeScheda(R, s.dati).some(x => /piccol/i.test(x.taglia || '')); };
  const carAtt = (s, a) => a.car === 'acc' ? migliore(s) : a.car && a.car !== 'man' ? a.car : (w => w ? carArma(s, w) : null)(armaAtt(s, a));
  const dadoAtt = a => String(a.dado || '').replace(/\s+/g, '') || (String(a.danni || '').replace(/\s+/g, '').match(/^\d*d\d+/i) || [''])[0];
  // danni bonus dell'attacco (arma infuocata, veleno…), tirati a parte con il loro tipo
  const TIPI_DANNO = [['acido', 'da acido'], ['contundenti', 'contundenti'], ['forza', 'da forza'], ['freddo', 'da freddo'], ['fulmine', 'da fulmine'], ['fuoco', 'da fuoco'], ['necrotici', 'necrotici'], ['perforanti', 'perforanti'], ['psichici', 'psichici'], ['radiosi', 'radiosi'], ['taglienti', 'taglienti'], ['tuono', 'da tuono'], ['veleno', 'da veleno']];
  const bonusDadi = a => String(a?.bdadi || '').replace(/\s+/g, '');
  const bonusNome = a => 'danni ' + ((TIPI_DANNO.find(t => t[0] === a?.btipo) || [, 'bonus'])[1]);
  function calcAtt(s, a) {
    const k = carAtt(s, a); if (!k || !CAR.some(c => c[0] === k)) return null;
    const w = armaAtt(s, a), m = modC(s.dati[k]);
    // il bonus magico si legge anche dal nome («Spada lunga +1»)
    const mg = a.magia != null && a.magia !== '' ? num(a.magia) || 0 : +(String(a.nome || '').match(/\+\s?([1-3])\b/) || [])[1] || 0;
    const dd = w ? (a.duemani && versatile(w)) || (w[1] === '1' ? '' : w[1]) : dadoAtt(a);
    const cp = a.comp_att === 'si' ? true : a.comp_att === 'no' || a.nocomp ? false : w && formaPg(s) ? competenteArma(s, w) : true; // i PNG si considerano competenti nelle loro armi
    return { k, m, mg, w, cp, colpire: m + (cp ? comp(s) : 0) + mg, danni: dd ? dd + piu(m + mg) : w?.[1] === '1' ? String(Math.max(1, 1 + m + mg)) : '' };
  }
  function attacchiCalcolati(s) {
    let cambiati = false;
    const L = (s.dati.attacchi || []).map(a => {
      const c = calcAtt(s, a); if (!c || (num(a.colpire) === c.colpire && a.danni === c.danni)) return a;
      cambiati = true; return { ...a, colpire: c.colpire, danni: c.danni };
    });
    return cambiati ? L : null;
  }
  /* classe armatura dal manuale: armatura (o difesa senza armatura) con la Destrezza dove vale, scudo, magia e altri bonus */
  const ARMATURE_TESTO = [['Armatura imbottita', /\bimbottit[ao]/], ['Armatura di cuoio borchiato', /cuoio borchiat/], ['Armatura di cuoio', /armatura (?:di|in) cuoio(?! borchiat)|\barmatura leggera\b/],
    ['Armatura di pelle', /armatura (?:di|in) pell[ei]/], ['Giaco di maglia', /giaco di maglia/], ['Corazza di scaglie', /corazza (?:di|a) scaglie/], ['Corazza di piastre', /corazza di piastre|pettorale/],
    ['Mezza armatura', /mezza armatura/], ['Corazza ad anelli', /(?:corazza|armatura) ad anelli/], ['Cotta di maglia', /cotta di maglia/], ['Armatura a strisce', /armatura a (?:strisce|bande)/], ['Armatura completa', /armatura completa|armatura a piastre/]];
  const magiaIn = (t, re) => +(t.match(new RegExp(re.source + '[^,;]{0,12}?\\+\\s?([1-3])\\b')) || [])[1] || 0;
  const baseArm = (a, dm) => a[2] === 'leggera' ? a[1] + dm : a[2] === 'media' ? a[1] + Math.min(2, dm) : a[1];
  // l'armatura e lo scudo scritti nell'equipaggiamento (se non sono stati scelti nell'ingranaggio)
  function armaturaEquip(s) {
    const R = REG(), t = norm(s.dati.equip), dm = modC(s.dati.des);
    const trovate = ARMATURE_TESTO.filter(([, re]) => re.test(t)).map(([n, re]) => ({ a: R.armature.find(x => x[0] === n), mg: magiaIn(t, re) })).filter(x => x.a);
    trovate.sort((x, y) => baseArm(y.a, dm) + y.mg - baseArm(x.a, dm) - x.mg);
    return { arm: trovate[0] || null, scudo: /\bscudo\b(?! della fede)/.test(t), mgS: magiaIn(t, /\bscudo\b/) };
  }
  function calcCA(s) {
    const R = REG(), d = s.dati; if (!R || !formaPg(s) || d.ca_auto === 'man') return null;
    const eq = armaturaEquip(s), dm = modC(d.des), L = classiDi(R, d).L, razze = razzeScheda(R, d), ha = re => (d.privilegi || []).some(p => re.test(norm(p.nome)));
    const arm = d.armatura === 'nessuna' ? null : d.armatura ? { a: R.armature.find(x => x[0] === d.armatura), mg: 0 } : eq.arm;
    const a = arm?.a || null, scudo = d.scudo_ca === 'si' || (d.scudo_ca !== 'no' && eq.scudo);
    const parti = [], avv = [];
    let ca;
    if (a) {
      ca = baseArm(a, dm);
      parti.push(`${a[0]} ${a[1]}` + (a[2] === 'pesante' ? '' : ` + Destrezza ${segno(a[2] === 'media' ? Math.min(2, dm) : dm)}${a[2] === 'media' && dm > 2 ? ' (massimo +2)' : ''}`));
      if (a[3] && (num(d.for) ?? 10) < a[3]) avv.push(`serve Forza ${a[3]}: senza, −3 m di velocità`);
    } else {
      // senza armatura vale la difesa migliore fra quelle che il personaggio ha
      const op = [[10 + dm, `10 + Destrezza ${segno(dm)}`]];
      if (L.some(c => c.id === 'barbaro')) op.push([10 + dm + modC(d.cos), `Difesa senza armatura: 10 + Destrezza ${segno(dm)} + Costituzione ${segno(modC(d.cos))}`]);
      if (L.some(c => c.id === 'monaco') && !scudo) op.push([10 + dm + modC(d.sag), `Difesa senza armatura: 10 + Destrezza ${segno(dm)} + Saggezza ${segno(modC(d.sag))}`]);
      if (L.some(c => sottoDi(R, c)?.caSenza) || ha(/^resilienza draconica/)) op.push([13 + dm, `Resilienza draconica: 13 + Destrezza ${segno(dm)}`]);
      for (const r of razze) { const rc = String(r.ca || ''); if (rc === '13+des') op.push([13 + dm, `Armatura naturale: 13 + Destrezza ${segno(dm)}`]); else if (+rc) op.push([+rc, `Armatura naturale ${rc}`]); }
      const m = op.reduce((x, y) => y[0] > x[0] ? y : x); ca = m[0]; parti.push(m[1]);
    }
    const mgA = a ? (d.ca_magia != null && d.ca_magia !== '' ? num(d.ca_magia) || 0 : arm.mg) : 0;
    if (mgA) { ca += mgA; parti.push(`armatura magica ${segno(mgA)}`); }
    if (scudo) { const mg = eq.mgS || 0; ca += 2 + mg; parti.push(`scudo +2${mg ? ` (magico ${segno(mg)})` : ''}`); }
    if (a && ha(/^(?:stile(?: di combattimento)?\W*)?difesa\)?$/)) { ca += 1; parti.push('stile Difesa +1'); }
    const rp = razze.reduce((x, r) => x + (r.caPiu || 0), 0); if (rp) { ca += rp; parti.push(`protezione integrata ${segno(rp)}`); }
    const bo = num(d.ca_bonus) || 0; if (bo) { ca += bo; parti.push(`altri bonus ${segno(bo)}`); }
    // competenza nelle armature: senza, svantaggio a For e Des e niente incantesimi
    const t = testoComp(s), tutte = /tutte le armature/.test(t), seg = t.split(/[;.\n]/).filter(x => /armatur/.test(x)).join(' ');
    if (a && !(tutte || new RegExp('\\b' + { leggera: 'leggere', media: 'medie', pesante: 'pesanti' }[a[2]] + '\\b').test(seg))) avv.push(`non competente in armature ${a[2] === 'leggera' ? 'leggere' : a[2] === 'media' ? 'medie' : 'pesanti'}: svantaggio a Forza e Destrezza e niente incantesimi`);
    if (scudo && !/\bscudi\b/.test(t)) avv.push('non competente negli scudi: svantaggio a Forza e Destrezza e niente incantesimi');
    // armatura non trovata nell'equipaggiamento e CA scritta più alta: non la si abbassa da soli, si chiede di scegliere l'armatura
    const incerta = !d.armatura && !a && num(d.ca) > ca;
    return { ca, parti, avv, a, scudo, incerta };
  }
  const cambiaCA = s => { const c = calcCA(s); return c && !c.incerta && num(s.dati.ca) !== c.ca ? c.ca : null; };
  function salvaScheda(id, patch, subito) {
    const s = T.schede?.get(id); if (!s) return Promise.resolve();
    s.dati = { ...s.dati, ...patch };
    // gli attacchi legati a una caratteristica (⚙) seguono i punteggi, il livello e le loro impostazioni
    const ric = attacchiCalcolati(s); if (ric) { s.dati.attacchi = ric; patch = { ...patch, attacchi: ric }; }
    // e la CA segue armatura, scudo e caratteristiche
    const ca = cambiaCA(s); if (ca != null) { s.dati.ca = ca; patch = { ...patch, ca }; }
    dopoScheda(id, true);
    const p = pend.get(id) || { dati: {} }; Object.assign(p.dati, patch); clearTimeout(p.t); pend.set(id, p);
    return new Promise(res => { p.t = setTimeout(() => invia(id).then(res), subito ? 0 : 600); });
  }
  async function invia(id) {
    const p = pend.get(id); if (!p) return; clearTimeout(p.t); pend.delete(id);
    const r = await SB.rpc('tavolo_scheda_aggiorna', { p_id: id, p_dati: p.dati });
    if (r.error) { toast(r.error.message, 'err'); return; }
    const row = Array.isArray(r.data) ? r.data[0] : r.data; if (row) arrivaScheda(row);
  }
  /* il DM concede un livello: al giocatore appare la «colonna di luce» con il nuovo livello.
     Una volta per livello concesso: se non era connesso la vede appena entra nel Tavolo. */
  const FESTA = id => 'tavolo-festa-' + id;
  const festaInSospeso = () => { if (!isDM() && T.schede && !T.pag) for (const x of T.schede.values()) if (x.tipo === 'pg' && x.giocatore && x.giocatore === T.me?.giocatore && num(x.dati?.liv_concesso) > (num(x.dati?.livello) || 1)) festaLivello(x); };
  function festaLivello(s) {
    const n = num(s.dati?.liv_concesso) || 0; if (!n || document.querySelector('.tv-festa')) return;
    try { if (+localStorage.getItem(FESTA(s.id)) >= n) return; localStorage.setItem(FESTA(s.id), n); } catch { }
    css();
    const lei = s.dati?.genere === 'f', w = document.createElement('div');
    w.className = 'tv-festa' + (animazioni() ? '' : ' calma'); w.setAttribute('role', 'dialog'); w.setAttribute('aria-modal', 'true'); w.setAttribute('aria-label', 'Nuovo livello');
    w.innerHTML = `<div class="fvel"></div><div class="fraggi"></div><div class="fluce"></div><div class="fsc">${Array.from({ length: 26 }, (_, i) => `<i style="left:${(Math.sin(i * 7.3) * 50 + 50).toFixed(1)}%;font-size:${8 + i % 4 * 4}px;animation-delay:${(i * .11).toFixed(2)}s">${i % 3 ? '✦' : '✧'}</i>`).join('')}</div>
      <div class="fbox"><div class="flv">Livello</div><div class="fnum">${n}</div><h2>Congratulazioni! Sei ${lei ? 'salita' : 'salito'} di livello</h2><p>${esc(s.nome)} · scegli adesso cosa ${lei ? 'la' : 'lo'} rende più forte</p>
      <div class="fbt"><button type="button" class="si">⬆ Sali di livello ora</button><button type="button" class="no">Più tardi</button></div></div>`;
    const via = () => { w.remove(); removeEventListener('keydown', esc_); }, esc_ = e => { if (e.key === 'Escape') via(); };
    w.querySelector('.no').onclick = via; w.querySelector('.fvel').onclick = via; addEventListener('keydown', esc_);
    w.querySelector('.si').onclick = () => { via(); const x = T.schede?.get(s.id) || s; if (num(x.dati?.liv_concesso) > (num(x.dati?.livello) || 1)) apriGuida(x, 'liv'); };
    document.body.append(w); w.querySelector('.si').focus();
  }
  function arrivaScheda(row) {
    if (L.s && row.id === L.s.id) { L.s = { ...L.s, ...row }; segnaLivello(); }
    if (!T.schede) return;
    const vecchia = T.schede.get(row.id), s = completaS(vecchia, row), p = pend.get(row.id);
    if (vecchia && !isDM() && s.giocatore && s.giocatore === T.me?.giocatore && (num(s.dati?.liv_concesso) || 0) > (num(vecchia.dati?.liv_concesso) || 0) && num(s.dati.liv_concesso) > (num(s.dati.livello) || 1)) festaLivello(s);
    if (p) s.dati = { ...s.dati, ...p.dati }; // ciò che sto ancora scrivendo resta mio
    T.schede.set(row.id, s); dopoScheda(row.id);
  }
  async function ricaricaSchede() {
    const r = await SB.from('tavolo_schede').select('*'); if (r.error) return;
    T.schede = new Map(r.data.map(s => [s.id, s])); dopoScheda();
    festaInSospeso();
  }
  function dopoScheda(id, locale) {
    disegnaSchede(); disegnaToken();
    if (!T.sv || (id && T.sv.id !== id)) return;
    if (!T.schede.has(T.sv.id)) { T.sv.d.close(); return; }
    if (locale) riempi(); else aggiornaFinestra();
  }
  // mentre si scrive nella scheda non la ridisegno: aggiorno solo gli altri campi
  function aggiornaFinestra() { if (!T.sv || T.sv.ordina) return; if (T.sv.d.contains(document.activeElement) && document.activeElement.matches('input,textarea,select')) riempi(); else disegnaScheda(); }

  // DM: alla prima apertura del tavolo ogni giocatore riceve la scheda del suo personaggio
  async function preparaSchede(info) {
    if (!T.schede) return;
    for (const g of info.giocatori || []) {
      const e = S.ents?.get(g.pg), foto = e?.portrait?.thumb || null, s = [...T.schede.values()].find(x => x.giocatore === g.id);
      if (!s) {
        const r = await SB.from('tavolo_schede').insert({ tipo: 'pg', nome: String(e?.name || g.name).slice(0, 80), giocatore: g.id, entita: g.pg || null, immagine: foto, nascosta: false, dati: { livello: 1, ...BASE } }).select().single();
        if (!r.error && !T.schede.has(r.data.id)) T.schede.set(r.data.id, r.data);
      } else if (foto && s.immagine !== foto) { const r = await SB.from('tavolo_schede').update({ immagine: foto }).eq('id', s.id); if (!r.error) s.immagine = foto; }
    }
    disegnaSchede();
  }

  /* elenco delle schede (pannello a sinistra) */
  function apriSchede(apri) {
    const p = $('#tv-sp'); if (!p) return; p.hidden = !apri;
    if (apri) { const t = $('#tv-tdp'); if (t) t.hidden = true; if (T.turnoEd) apriTurno(false); }
    disegnaSchede(); disegnaRail(); posizionaScheda();
  }
  const riass = s => {
    const d = s.dati, pf = d.pf_max != null ? ` · PF ${d.pf ?? d.pf_max}/${d.pf_max}` : '';
    return (formaPg(s) ? [d.classe, d.livello ? 'liv. ' + d.livello : ''].filter(Boolean).join(' ') : d.gs != null && d.gs !== '' ? 'GS ' + d.gs : '') + (d.ca != null ? (formaPg(s) && !d.classe && !d.livello ? '' : ' · ') + 'CA ' + d.ca : '') + pf;
  };
  const tondo = s => { const f = fotoScheda(s); return `<i style="${f ? `background-image:url('${esc(f)}')` : `--c:${s.tipo === 'pg' ? '#7d2530' : '#5b6670'}`}">${f ? '' : esc(iniziali(s.nome))}</i>`; };
  function disegnaSchede() {
    const p = $('#tv-sp'); if (!p || p.hidden) return;
    const hd = '<div class="tv-th"><b>Schede</b><button type="button" data-k="x" aria-label="Chiudi">✕</button></div>';
    if (!T.schede) {
      p.innerHTML = hd + `<div class="tv-tvuoto">${isDM() ? 'Per usare le schede esegui <code>tavolo/tappa-3.sql</code> nell\'SQL Editor di Supabase, poi ricarica la pagina.' : 'Le schede non sono ancora pronte: il DM deve completare la preparazione del tavolo.'}</div>`;
      p.querySelector('[data-k=x]').onclick = () => apriSchede(false); return;
    }
    const cerca = p.querySelector('[data-k=cerca]')?.value || '';
    const v = [...T.schede.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
    const riga = s => `<div class="r" data-id="${s.id}">${tondo(s)}<button type="button" class="nm" data-k="apri">${esc(s.nome)}<small>${esc(riass(s)) || '&nbsp;'}</small></button>${formaPg(s) && num(s.dati.liv_concesso) > (num(s.dati.livello) || 1) ? `<span class="lvup" title="Può salire fino al ${num(s.dati.liv_concesso)}° livello">⬆</span>` : ''}${isDM() && s.tipo === 'pg' && (num(s.dati.livello) || 1) < 20 ? '<button type="button" class="s" data-k="liv" title="Concedi un livello: il giocatore sale da solo con la procedura guidata">🎁</button>' : ''}${isDM() && s.tipo === 'png' ? `<button type="button" class="s" data-k="vis" title="${s.nascosta ? 'I giocatori non la vedono: clicca per mostrarla' : 'I giocatori la vedono: clicca per nasconderla'}">${s.nascosta ? '🙈' : '👁'}</button><button type="button" class="s" data-k="via" title="Elimina la scheda">✕</button>` : ''}</div>`;
    const pg = v.filter(s => s.tipo === 'pg'), png = v.filter(s => s.tipo === 'png' && !s.assegnata), aff = v.filter(s => s.tipo === 'png' && s.assegnata);
    p.innerHTML = hd + `${isDM() && png.length > 5 ? `<input type="search" data-k="cerca" placeholder="Cerca…" value="${esc(cerca)}" aria-label="Cerca una scheda">` : ''}<div class="tv-tl">
      <h5>Party</h5>${[...pg, ...aff].map(riga).join('') || `<div class="tv-tvuoto">${isDM() ? 'Si creano da sole all\'apertura del tavolo, una per giocatore.' : 'La tua scheda compare quando il DM apre il tavolo.'}</div>`}
      <h5>Personaggi</h5>${png.map(riga).join('') || `<div class="tv-tvuoto">${isDM() ? 'Nessun personaggio. Creane uno qui sotto.' : 'Il DM non vi ha ancora mostrato nessun personaggio.'}</div>`}</div>
      ${isDM() ? `<div class="tv-tf"><button type="button" data-k="nuovo">+ Nuovo personaggio</button>${pg.length ? '<button type="button" data-k="party" title="Ogni giocatore potrà salire di un livello con la procedura guidata">🎁 Un livello al party</button>' : ''}</div>` : ''}`;
    p.querySelector('[data-k=x]').onclick = () => apriSchede(false);
    const q = p.querySelector('[data-k=cerca]');
    const filtra = () => { const s = norm(q.value); p.querySelectorAll('.r').forEach(r => r.hidden = !!s && T.schede.get(r.dataset.id)?.tipo === 'png' && !norm(r.textContent).includes(s)); };
    if (q) { q.oninput = filtra; if (cerca) filtra(); }
    p.querySelector('[data-k=nuovo]')?.addEventListener('click', dlgNuovoPng);
    p.querySelector('[data-k=party]')?.addEventListener('click', async () => { if (await ask('Concedere un livello a tutto il party? Ognuno salirà dalla propria scheda, con la procedura guidata.', { ok: 'Concedi', title: 'Un livello al party' })) concediLivello(pg); });
    p.querySelectorAll('.r').forEach(r => {
      const s = T.schede.get(r.dataset.id);
      r.querySelector('[data-k=apri]').onclick = () => apriScheda(s.id);
      r.querySelector('[data-k=liv]')?.addEventListener('click', () => concediLivello([s]));
      const vis = r.querySelector('[data-k=vis]');
      if (vis) vis.onclick = async () => {
        const u = await SB.from('tavolo_schede').update({ nascosta: !s.nascosta }).eq('id', s.id).select().single();
        if (u.error) return toast(u.error.message, 'err');
        arrivaScheda(u.data); manda('schede', {}); toast(u.data.nascosta ? 'Scheda nascosta ai giocatori.' : 'Ora i giocatori vedono la scheda di ' + s.nome + '.');
      };
      const via = r.querySelector('[data-k=via]');
      if (via) via.onclick = async () => {
        if (!await ask(`Eliminare la scheda di **${s.nome}**? I suoi token restano sulla mappa.`, { ok: 'Elimina', danger: true, title: 'Elimina scheda' })) return;
        const u = await SB.from('tavolo_schede').delete().eq('id', s.id); if (u.error) return toast(u.error.message, 'err');
        T.schede.delete(s.id); dopoScheda(s.id); manda('schede', {});
      };
    });
  }

  /* nuovo PNG (DM): da un modello, da un PNG del sito o vuoto */
  /* il DM affida la scheda di un PNG (Edward…) a un giocatore: lui la compila e muove i suoi token, i PF stanno sulla scheda */
  async function affidaScheda(s, g) {
    const toks = [...T.tok.values()].filter(t => t.scheda === 'tv:' + s.id || (!!s.entita && t.scheda === s.entita) || (schedaDi(t)?.id === s.id && (!t.giocatore || t.giocatore === s.assegnata)));
    const u = await SB.from('tavolo_schede').update({ assegnata: g }).eq('id', s.id).select().single();
    if (u.error) { toast(/assegnata/i.test(u.error.message) || sqlMancante(u.error) ? 'Per affidare una scheda esegui tavolo/tappa-12.sql in Supabase.' : u.error.message, 'err'); return disegnaScheda(); }
    arrivaScheda(u.data);
    for (const t of toks) {
      const r = await SB.from('tavolo_token').update({ giocatore: g, scheda: 'tv:' + s.id, ...(g ? { pf: null, pf_max: null } : {}) }).eq('id', t.id).select().single();
      if (!r.error) T.tok.set(t.id, completa(t, r.data));
    }
    disegnaToken(); disegnaSchede(); manda('schede', {});
    const chi = (T.info.giocatori || []).find(x => x.id === g)?.name;
    toast(g ? `Ora ${chi || 'il giocatore'} usa la scheda di ${s.nome}${toks.length ? ' e ne muove i token' : ''}.` : `La scheda di ${s.nome} torna solo tua.`);
  }
  // ogni scheda nata nel Tavolo diventa anche un personaggio dell'archivio del sito (o si lega a quello con lo stesso nome)
  async function nuovoNellArchivio(nome, dati) {
    if (!isDM() || window.__RO || typeof createEntity !== 'function' || !S.ents) return null;
    const gia = [...S.ents.values()].find(e => e.type === 'png' && norm(e.name) === norm(nome)); if (gia) return gia.id;
    try { return await createEntity({ type: 'png', name: nome, brief: String(dati.taglia_tipo || '').trim() || 'Creato dal Tavolo' }); }
    catch (e) { toast('Scheda creata, ma non sono riuscito ad aggiungerla all\'archivio: ' + e.message, 'err'); return null; }
  }
  async function creaPng(o) {
    // scheda letta da una foto: i suoi valori al posto di quelli di partenza
    if (o.forma && typeof o.forma === 'object') { const f = o.forma; o = { ...o, forma: 'png', nome: o.nome && o.nome !== 'PNG' ? o.nome : f.nome || o.nome, dati: { ...(o.dati || BASE), ...f.dati } }; toast('Scheda compilata dalla foto: controlla i valori (✎ Modifica).'); }
    const dati = { ...(o.dati || BASE), ...(o.forma === 'pg' ? { forma: 'pg', livello: 1 } : {}) };
    if (!o.entita) o.entita = await nuovoNellArchivio(String(o.nome || 'PNG').slice(0, 80), dati);
    const r = await SB.from('tavolo_schede').insert({ tipo: 'png', nome: String(o.nome || 'PNG').slice(0, 80), entita: o.entita || null, immagine: o.immagine || null, nascosta: true, dati }).select().single();
    if (r.error) { toast(r.error.message, 'err'); return null; }
    T.schede.set(r.data.id, r.data); disegnaSchede(); return r.data;
  }
  /* ---------- scheda da una foto: il testo si legge nel browser (Tesseract, in italiano) e diventa la scheda di un PNG ---------- */
  const TESS = 'https://cdn.jsdelivr.net/npm/';
  let tessP = null;
  const caricaTess = () => tessP || (tessP = new Promise((ok, ko) => {
    if (window.Tesseract) return ok(window.Tesseract);
    const x = document.createElement('script'); x.src = TESS + 'tesseract.js@5.1.1/dist/tesseract.min.js';
    x.onload = () => ok(window.Tesseract); x.onerror = () => { tessP = null; ko(new Error('Non riesco a caricare il lettore di testo: controlla la connessione.')); };
    document.head.appendChild(x);
  }));
  // in scala di grigi, ingrandita se piccola e al chiaro se è uno screenshot scuro: Tesseract legge meglio il nero su bianco
  async function preparaFoto(file) {
    const bmp = await createImageBitmap(file), k = Math.min(3, Math.max(1, 1800 / bmp.width));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(bmp, 0, 0, c.width, c.height);
    const im = g.getImageData(0, 0, c.width, c.height), px = im.data; let tot = 0;
    for (let i = 0; i < px.length; i += 4) { const y = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]; px[i] = px[i + 1] = px[i + 2] = y; tot += y; }
    if (tot / (px.length / 4) < 128) for (let i = 0; i < px.length; i += 4) px[i] = px[i + 1] = px[i + 2] = 255 - px[i];
    g.putImageData(im, 0, 0); return c;
  }
  async function leggiFoto(file, avanti) {
    const Tz = await caricaTess();
    const w = await Tz.createWorker('ita', 1, { workerPath: TESS + 'tesseract.js@5.1.1/dist/worker.min.js', corePath: TESS + 'tesseract.js-core@5.1.1', langPath: TESS + '@tesseract.js-data/ita@1.0.0/4.0.0_best_int', logger: m => m.status === 'recognizing text' && avanti?.(m.progress) });
    try { return (await w.recognize(await preparaFoto(file))).data.text; } finally { w.terminate(); }
  }
  // dal testo di un blocco delle statistiche (Manuale dei mostri, schede scritte da un'IA…) ai campi della scheda
  function schedaDaTesto(txt) {
    const righe = String(txt || '').replace(/\r/g, '').split('\n')
      .map(r => r.replace(/^(?:[©®°•·○●◦*\-–—‘’'"`,.~|>»]+\s*|[oe]\s+(?=[A-ZÀ-Ý]))+/, '').replace(/\bll\b/g, 'Il').replace(/[−–]/g, '-').replace(/\s+/g, ' ').trim())
      .filter(r => /[A-Za-zÀ-ÿ]{3}|\d/.test(r));
    const T0 = righe.join('\n'), val = re => (T0.match(re) || [])[1], d = { ...BASE }, numF = x => parseFloat(String(x).replace(',', '.'));
    const CHIAVI = /^(classe armatura|punti ferita|velocit|iniziativa|tiri salvezza|abilit|sensi|linguaggi|sfida|resistenz|immunit|vulnerabilit|for\b|bonus di competenza)/i;
    // la riga «Umanoide Medio, caotico malvagio» non è il nome (succede se la foto taglia il titolo)
    const TGL = /\b(minuscol|piccol|medi|grand|enorm|mastodont)\w*\b.*(,|legale|caotic|neutral|malvag|buon|qualsiasi|senza allineamento)/i;
    const ck = righe.findIndex(r => CHIAVI.test(r)), nome = (righe.slice(0, ck < 0 ? righe.length : ck).find(r => !TGL.test(r)) || '').replace(/^[^A-Za-zÀ-ÿ0-9]+/, '').replace(/^[A-Za-z]{1,2}[,.;:]\s*/, '').replace(/^\d+\s*x\s*/i, '').trim();
    const tg = righe.find(r => /\b(minuscol|piccol|medi|grand|enorm|mastodont)\w*/i.test(r) && !CHIAVI.test(r) && r !== nome);
    if (tg) { const [a, b] = tg.split(','); d.taglia_tipo = a.trim(); if (b) d.allineamento = b.replace(/\s+\S{1,2}$/, '').trim(); }
    const ca = val(/Classe Armatura[^\d\n]*(\d+)/i); if (ca) d.ca = +ca;
    const pf = T0.match(/Punti Ferita[^\d\n]*(\d+)\s*(?:\(([^)\n]*)\))?/i);
    if (pf) { d.pf_max = d.pf = +pf[1]; const dv = String(pf[2] || '').replace(/\s+/g, ''); if (/^\d+d\d+([+-]\d+)?$/i.test(dv)) d.dadi_vita = dv; }
    const vel = val(/Velocit\S*\s*:?\s*([^\n]+)/i); if (vel) d.velocita = vel.replace(/(\d)\s*m\b/g, '$1 m').trim();
    // caratteristiche: «13 (+1)» in fila dopo FOR DES COS…; se il punteggio è illeggibile basta il modificatore
    const iF = righe.findIndex(r => /\bFOR\b/i.test(r) && /\bDES\b/i.test(r)), zona = iF >= 0 ? righe.slice(iF, iF + 4).join(' ') : T0;
    const cop = [...zona.matchAll(/(\d{1,2})?\s*\(\s*([+-]?\s*\d{1,2})\s*\)/g)].map(m => { const mo = parseInt(m[2].replace(/\s+/g, ''), 10), v = m[1] ? +m[1] : null; return v != null && Math.floor((v - 10) / 2) === mo ? v : 10 + 2 * mo; });
    if (cop.length >= 6) CAR.forEach(([k], i) => d[k] = cop[i]);
    else CAR.forEach(([k, ab, n]) => { const v = val(new RegExp(`\\b(?:${ab}|${n})\\b\\s*:?\\s*(\\d{1,2})`, 'i')); if (v) d[k] = +v; });
    const tsr = val(/Tiri salvezza\s*:?\s*([^\n]+)/i); if (tsr) CAR.forEach(([k, ab, n]) => { if (new RegExp(`\\b(?:${ab}|${n.slice(0, 3)})\\w*\\s*[+-]`, 'i').test(tsr)) d['ts_' + k] = true; });
    const abr = norm(val(/Abilit\S*\s*:?\s*([^\n]+)/i) || ''); if (abr) ABIL.forEach(([k, n]) => { if (abr.includes(norm(n).split(' ')[0])) d['ab_' + k] = 1; });
    const se = val(/Sensi\s*:?\s*([^\n]+)/i); if (se) { const x = se.replace(/,?\s*Percezione passiva\s*\d+/i, '').replace(/^[,\s]+|[,\s]+$/g, ''); if (x) d.sensi = x; }
    const li = val(/Linguaggi\s*:?\s*([^\n]+)/i); if (li) d.linguaggi = li.trim();
    const gs = val(/Sfida\s*:?\s*(\d+\/\d+|\d+)/i); if (gs) d.gs = gs;
    const dif = righe.filter(r => /^(Resistenz|Immunit|Vulnerabilit)/i.test(r)); if (dif.length) d.difese = dif.join('. ');
    // tratti, azioni, reazioni: «Nome: testo» (o «Nome. testo»), le righe che seguono continuano la voce
    const sez = { tratti: [], azioni: [], bonus: [], reazioni: [], legg: [] }; let cur = null, voce = null;
    const fatte = new Set(righe.filter(r => CHIAVI.test(r) || r === nome || r === tg || /\bFOR\b.*\bDES\b/i.test(r) || /\(\s*[+-]?\d+\s*\)/.test(r) && !/[a-z]{4}/.test(r)));
    for (const r of righe) {
      const h = norm(r).replace(/[^a-z ]/g, '').trim();
      const nuova = /^tratti( speciali)?$|^capacita( speciali)?$|^privilegi$/.test(h) ? 'tratti' : /^azioni bonus$/.test(h) ? 'bonus' : /^azioni leggendarie$/.test(h) ? 'legg' : /^azioni$/.test(h) ? 'azioni' : /^reazioni$/.test(h) ? 'reazioni' : null;
      if (nuova) { cur = nuova; voce = null; continue; }
      if (fatte.has(r)) { if (/^Sfida/i.test(r) && !cur) cur = 'tratti'; continue; }
      if (!cur) continue;
      const m = r.match(/^([A-ZÀ-Ý][^:.]{1,60}?)\s*[:.]\s+(.+)$/);
      if (m && !(voce && /^colpi(?:sce|to)$/i.test(m[1].trim()))) { voce = { nome: m[1].trim(), testo: m[2].trim() }; sez[cur].push(voce); }
      else if (voce) voce.testo += ' ' + r;
    }
    const TIPI = { taglio: 'taglienti', taglienti: 'taglienti', perforanti: 'perforanti', perforazione: 'perforanti', contundenti: 'contundenti', botta: 'contundenti' };
    const attacco = v => {
      const t = v.testo, col = t.match(/([+-]\s*\d+)\s*(?:al|per|a)\s*colpire/i); if (!col) return null;
      const dm = t.match(/Colpi\w*\s*:?\s*(?:\d+\s*\()?\s*(\d+\s*d\s*\d+(?:\s*[+-]\s*\d+)?)\s*\)?\s*(?:danni\s+(?:da\s+)?([a-zà-ù]+))?/i);
      let por = t.match(/portata\s*(?:di\s*)?(\d+(?:[.,]\d+)?)\s*m/i)?.[1]; if (por && !/[.,]/.test(por) && +por >= 10) por = String(+por / 10).replace('.', ',');
      const git = t.match(/gittata\s*(?:di\s*)?(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)\s*m/i), ber = t.match(/\b(un bersaglio|una creatura|un solo bersaglio)\b/i)?.[1];
      const resto = dm ? t.slice(dm.index + dm[0].length).replace(/^[\s.,;]+/, '').trim() : '';
      const tipo = dm?.[2] ? TIPI[dm[2].toLowerCase()] || dm[2].toLowerCase() : '';
      return { nome: v.nome, colpire: parseInt(col[1].replace(/\s+/g, ''), 10), danni: dm ? dm[1].replace(/\s+/g, '') : '', tipo: [tipo, por ? `portata ${por} m` : '', git ? `gittata ${git[1]}/${git[2]} m` : '', ber, resto].filter(Boolean).join(', ') };
    };
    d.attacchi = []; const az = [];
    for (const v of sez.azioni) { const a = attacco(v); if (a) d.attacchi.push(a); else az.push(`${v.nome}: ${v.testo}`); }
    sez.bonus.forEach(v => az.push(`${v.nome} (azione bonus): ${v.testo}`)); sez.reazioni.forEach(v => az.push(`${v.nome} (reazione): ${v.testo}`)); sez.legg.forEach(v => az.push(`${v.nome} (azione leggendaria): ${v.testo}`));
    if (az.length) d.azioni = az.join('\n');
    d.privilegi = sez.tratti.map(v => ({ id: nuovoId(), nome: v.nome, fonte: '', testo: v.testo }));
    const letti = ['ca', 'pf_max', 'gs'].filter(k => d[k] != null).length + (cop.length >= 6 ? 1 : 0) + d.attacchi.length;
    return { nome, dati: d, letti };
  }
  // il DM sceglie che scheda dare a un personaggio: completa (come un giocatore) o da PNG. Risponde 'pg', 'png', { forma: 'png', nome, dati } (letta da una foto) o nulla (annullato)
  function sceltaForma(nome, e) {
    return new Promise(res => {
      const cons = formaPer(e), b = (f, t, sub) => `<button type="button" data-f="${f}" class="${f === cons ? 'cons' : ''}"><b>${t}${f === cons ? ' · consigliata' : ''}</b><small>${sub}</small></button>`;
      const d = finestra(`<form method="dialog"><h3>Scheda di ${esc(nome)}</h3>
        <div class="tv-forme">${b('png', 'Scheda da PNG', 'Blocco delle statistiche come nel Manuale dei mostri: per i personaggi secondari, che compaiono poco.')}${b('pg', 'Scheda completa', 'Come quella di un giocatore (classe, livello, privilegi, incantesimi): per i personaggi principali della storia.')}</div>
        ${e ? `<p class="hint">${e.imp === 'importante' ? 'Nel sito è segnato come personaggio principale.' : e.imp === 'minore' ? 'Nel sito è segnato come personaggio secondario.' : 'Nel sito non ha ancora un ruolo: lo scegli da «Modifica dati» della sua scheda.'} Potrai cambiare tipo anche dopo, dalla scheda.</p>` : ''}
        <div class="tv-dafoto" tabindex="0" role="button"><b>📷 Scheda da PNG compilata da una foto</b><small>Trascina qui uno screenshot o una foto del blocco delle statistiche, incollalo (Ctrl+V) o clicca per sceglierlo: il sito legge il testo e compila la scheda. Poi controlli i valori.</small><input type="file" accept="image/*" hidden><div class="st" aria-live="polite"></div></div>
        <menu><button value="cancel" class="btn ghost">Annulla</button></menu></form>`, 'tv-side tv-np' + (T.pag ? ' tv-centro' : ''));
      let scelta = null, va = false;
      d.querySelectorAll('[data-f]').forEach(x => x.onclick = () => { scelta = x.dataset.f; d.close(); });
      const z = d.querySelector('.tv-dafoto'), fi = z.querySelector('input'), st = z.querySelector('.st');
      const usa = async file => {
        if (!file || va) return; if (!/^image\//.test(file.type)) { st.textContent = 'Serve un\'immagine (PNG, JPG…).'; return; }
        va = true; z.classList.add('va'); st.textContent = 'Carico il lettore di testo…';
        try {
          const t = await leggiFoto(file, p => st.textContent = `Leggo la scheda… ${Math.round(p * 100)}%`), x = schedaDaTesto(t);
          if (x.letti < 2) { st.textContent = 'Non riesco a leggere le statistiche: prova con un\'immagine più nitida o più grande.'; return; }
          scelta = { forma: 'png', nome: x.nome, dati: x.dati }; d.close();
        } catch (e) { st.textContent = e.message || 'Lettura non riuscita.'; } finally { va = false; z.classList.remove('va'); }
      };
      z.onclick = e => { if (e.target !== fi) fi.click(); }; z.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fi.click(); } };
      fi.onchange = () => usa(fi.files[0]);
      z.ondragover = e => { e.preventDefault(); z.classList.add('su'); }; z.ondragleave = () => z.classList.remove('su');
      z.ondrop = e => { e.preventDefault(); z.classList.remove('su'); usa(e.dataTransfer.files[0]); };
      d.addEventListener('paste', e => { const f = [...(e.clipboardData?.files || [])][0]; if (f) usa(f); });
      d.addEventListener('close', () => res(scelta));
    });
  }
  function dlgNuovoPng() {
    if (!T.schede) return;
    document.querySelectorAll('dialog.tv-np[open]').forEach(x => x.close());
    const sito = [...(S.ents?.values() || [])].filter(e => e.type === 'png').sort((a, b) => a.name.localeCompare(b.name, 'it'));
    const tondoM = (nome, img, c) => `<i style="--c:${c};${img ? `background-image:url('${esc(img)}')` : ''}">${img ? '' : esc(iniziali(nome))}</i>`;
    const d = finestra(`<form method="dialog"><h3>Nuovo personaggio</h3>
      <div class="tv-tabs"><button type="button" class="btn sm on" data-tab="mod">Da un modello</button><button type="button" class="btn sm" data-tab="sito">Personaggi del sito</button><button type="button" class="btn sm" data-tab="vuoto">Vuoto</button></div>
      <div data-p="mod"><div class="tv-pick">${MODELLI.map((m, i) => `<button type="button" data-m="${i}">${tondoM(m.nome, null, '#5b6670')}${esc(m.nome)}<small>GS ${esc(m.dati.gs)}</small></button>`).join('')}</div>
        <p class="hint">Statistiche del regolamento base (SRD 5.1). Dopo le cambi come vuoi.</p></div>
      <div data-p="sito" hidden><div class="tv-f"><label>Statistiche</label><select name="base"><option value="">Da compilare</option>${MODELLI.map((m, i) => `<option value="${i}">Come: ${esc(m.nome)}</option>`).join('')}</select></div>
        <input type="search" placeholder="Cerca un personaggio…" style="width:100%;margin-bottom:8px;font:inherit;padding:6px 8px;border-radius:4px;border:1px solid var(--line2);background:var(--paper2);color:var(--ink)">
        <div class="tv-pick">${sito.map(e => `<button type="button" data-e="${esc(e.id)}">${tondoM(e.name, e.portrait?.thumb, '#3b5f8a')}${esc(e.name)}</button>`).join('') || '<p class="hint">Nessun personaggio nel sito.</p>'}</div></div>
      <div data-p="vuoto" hidden><div class="tv-f"><label>Nome</label><input name="nome" maxlength="80" placeholder="Es. Capitano della guardia"></div><button type="button" class="btn primary" data-k="crea">Crea la scheda</button></div>
      <menu><button value="cancel" class="btn ghost">Chiudi</button></menu></form>`, 'tv-side tv-np');
    d.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { d.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('on', x === b)); d.querySelectorAll('[data-p]').forEach(p => p.hidden = p.dataset.p !== b.dataset.tab); });
    const q = d.querySelector('[data-p=sito] input[type=search]'); q.oninput = () => { const s = norm(q.value); d.querySelectorAll('[data-e]').forEach(b => b.hidden = !!s && !norm(b.textContent).includes(s)); };
    const fatto = s => { if (!s) return; d.close(); apriSchede(true); apriScheda(s.id); toast('Scheda creata: ' + s.nome + '. I giocatori non la vedono finché non la mostri (👁).'); };
    const copia = m => JSON.parse(JSON.stringify(m.dati));
    d.querySelectorAll('[data-m]').forEach(b => b.onclick = async () => { const m = MODELLI[+b.dataset.m], n = [...T.schede.values()].filter(s => s.nome === m.nome || s.nome.startsWith(m.nome + ' ')).length; fatto(await creaPng({ nome: n ? m.nome + ' ' + (n + 1) : m.nome, dati: copia(m) })); });
    d.querySelectorAll('[data-e]').forEach(b => b.onclick = async () => {
      const e = S.ents.get(b.dataset.e), m = MODELLI[+d.querySelector('[name=base]').value], forma = await sceltaForma(e.name, e); if (!forma) return;
      fatto(await creaPng({ nome: e.name, entita: e.id, immagine: e.portrait?.thumb || null, dati: m && d.querySelector('[name=base]').value !== '' ? copia(m) : { ...BASE }, forma }));
    });
    d.querySelector('[data-k=crea]').onclick = async () => { const n = d.querySelector('[name=nome]'); if (!n.value.trim()) return n.focus(); const forma = await sceltaForma(n.value.trim(), null); if (forma) fatto(await creaPng({ nome: n.value.trim(), forma })); };
  }

  /* la scheda aperta (una alla volta, accanto alla mappa) */
  // host: l'elemento della pagina del personaggio in cui la scheda resta aperta (fuori dal Tavolo)
  // host: la scheda dentro un riquadro della pagina; inChat: nella sezione «Scheda» accanto alla chat del Tavolo (lì i dadi si tirano)
  function apriScheda(id, tok, host, inChat) {
    const s = T.schede?.get(id); if (!s) return;
    const modo = !host ? 'fin' : inChat ? 'chat' : 'pag';
    if (T.sv?.d.open) { if (T.sv.id === id && T.sv.modo === modo && T.sv.d.isConnected) { if (tok) { T.sv.tok = tok; disegnaScheda(); } return; } T.sv.d.close(); }
    const d = !host ? finestra('<div class="tv-sch"></div>', 'tv-side tv-sw') : inChat ? nellaChat(host) : nellaPagina(host);
    d.setAttribute('aria-label', 'Scheda di ' + s.nome);
    const sv = T.sv = { id, tok: tok || null, tab: 'pri', d, adv: 0, seg: isDM() && s.tipo === 'png', pag: modo === 'pag', chat: modo === 'chat', modo };
    d.addEventListener('close', () => { if (T.sv === sv) T.sv = null; invia(id); clearTimeout(sv.tt); if (sv.chat) setTimeout(segnaposto, 0); });
    if (!host) {
      d.insertAdjacentHTML('beforeend', ['e', 'w', 's', 'se', 'sw'].map(k => `<i class="rz ${k}" data-rz="${k}" aria-hidden="true"></i>`).join(''));
      d.querySelectorAll('.rz').forEach(h => h.addEventListener('pointerdown', e => ridimensionaScheda(e, d, h.dataset.rz)));
      posizionaScheda();
    }
    const box = d.querySelector('.tv-sch');
    // scegliere un nome tra i suggerimenti del manuale arriva come input senza digitazione
    box.addEventListener('input', e => { if (e.target.matches('textarea.auto')) cresci(e.target); });
    // il nome di un attacco resta su una riga logica: Invio non va a capo
    box.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('textarea.an')) e.preventDefault(); });
    box.addEventListener('input', e => { const el = e.target.closest('[data-f]'); if (el && el.type !== 'checkbox' && el.tagName !== 'SELECT') campo(el, !e.inputType || e.inputType === 'insertReplacementText'); });
    box.addEventListener('change', e => { const el = e.target.closest('[data-f]'); if (el && (el.type === 'checkbox' || el.tagName === 'SELECT')) campo(el); else if (el && /^inc\.\d+\.nome$/.test(el.dataset.f)) campo(el, true); else if (el && /^att\.\d+\.(bdadi|nome)$/.test(el.dataset.f)) campo(el); else if (e.target.dataset.k) azioneScheda(e.target); });
    box.addEventListener('click', e => { const b = e.target.closest('button'); T.maiusc = e.shiftKey; if (b && box.contains(b)) azioneScheda(b); });
    // si sposta trascinandola dalla barra scura in alto; la posizione resta per le prossime volte
    box.addEventListener('input', e => { if (e.target.dataset.k !== 'filtro') return; sv.filtro = e.target.value; const fl = norm(sv.filtro); box.querySelectorAll('.prv .pv').forEach(el => { const p = (T.schede.get(id)?.dati.privilegi || [])[+el.dataset.ordi]; el.hidden = !!fl && !norm(`${p?.nome} ${p?.fonte} ${p?.testo}`).includes(fl); }); });
    box.addEventListener('pointerdown', e => {
      const h = e.target.closest('.mano'); if (h && !e.button) return trascinaVoce(e, h);
      const bar = e.target.closest('.tbar'); if (!bar || sv.pag || sv.chat || e.button || e.target.closest('button,input,label') || innerWidth <= 820) return;
      e.preventDefault(); const r = d.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
      bar.setPointerCapture(e.pointerId);
      const muovi = ev => { d.style.left = clamp(ev.clientX - dx, 0, Math.max(0, innerWidth - d.offsetWidth)) + 'px'; d.style.top = clamp(ev.clientY - dy, 0, innerHeight - 50) + 'px'; d.style.maxHeight = innerHeight - parseFloat(d.style.top) - 8 + 'px'; };
      const fine = () => { bar.removeEventListener('pointermove', muovi); bar.removeEventListener('pointerup', fine); bar.removeEventListener('pointercancel', fine); try { localStorage.setItem(POS, JSON.stringify({ x: parseFloat(d.style.left), y: parseFloat(d.style.top) })); } catch { } };
      bar.addEventListener('pointermove', muovi); bar.addEventListener('pointerup', fine); bar.addEventListener('pointercancel', fine);
    });
    disegnaScheda();
  }
  // con l'elenco aperto la scheda gli sta accanto, se c'è posto
  const POS = 'tavolo-scheda-pos', MIS = 'tavolo-scheda-misura';
  // i bordi e gli angoli della scheda si trascinano per allargarla o stringerla; la misura resta per le prossime volte
  function ridimensionaScheda(e, d, k) {
    if (e.button || innerWidth <= 820) return;
    e.preventDefault(); e.stopPropagation();
    const h = e.currentTarget, r = d.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY;
    h.setPointerCapture(e.pointerId); d.classList.add('rz-on');
    const muovi = ev => {
      const dx = ev.clientX - x0, dy = ev.clientY - y0;
      if (k.includes('e')) d.style.width = clamp(r.width + dx, 420, innerWidth - r.left - 4) + 'px';
      if (k.includes('w')) { const w = clamp(r.width - dx, 420, r.right - 4); d.style.width = w + 'px'; d.style.left = r.right - w + 'px'; }
      if (k.includes('s')) { const top = r.top; d.style.maxHeight = innerHeight - top - 4 + 'px'; d.style.height = clamp(r.height + dy, 200, innerHeight - top - 4) + 'px'; }
    };
    const fine = () => {
      h.removeEventListener('pointermove', muovi); h.removeEventListener('pointerup', fine); h.removeEventListener('pointercancel', fine); d.classList.remove('rz-on');
      const q = d.getBoundingClientRect();
      try { localStorage.setItem(MIS, JSON.stringify({ w: Math.round(q.width), h: d.style.height ? Math.round(q.height) : null })); localStorage.setItem(POS, JSON.stringify({ x: q.left, y: q.top })); } catch { }
    };
    h.addEventListener('pointermove', muovi); h.addEventListener('pointerup', fine); h.addEventListener('pointercancel', fine);
  }
  function posizionaScheda() {
    const d = T.sv?.d, p = $('#tv-sp'); if (!d || T.sv.chat) return;
    let mis = null; try { mis = JSON.parse(localStorage.getItem(MIS)); } catch { }
    if (mis && innerWidth > 820) { if (mis.w) d.style.width = Math.min(mis.w, innerWidth - 8) + 'px'; d.style.height = mis.h ? Math.min(mis.h, innerHeight - 16) + 'px' : ''; }
    let pos = null; try { pos = JSON.parse(localStorage.getItem(POS)); } catch { }
    if (pos && innerWidth > 820) { const y = clamp(pos.y, 0, innerHeight - 120); d.style.left = clamp(pos.x, 0, Math.max(0, innerWidth - d.offsetWidth)) + 'px'; d.style.top = y + 'px'; d.style.maxHeight = innerHeight - y - 8 + 'px'; return; }
    const r = p && !p.hidden ? p.getBoundingClientRect() : null;
    d.style.left = r && innerWidth > 820 && r.right + 10 + Math.min(940, innerWidth - 80) < innerWidth ? r.right + 10 + 'px' : '';
    // resta dentro il tavolo, senza coprire le barre del sito
    const tv = $('.tv')?.getBoundingClientRect(); if (tv && innerWidth > 820) { d.style.top = tv.top + 6 + 'px'; d.style.maxHeight = tv.height - 12 + 'px'; }
  }
  const tokScheda = () => { const t = T.sv?.tok && T.tok.get(T.sv.tok), s = T.sv && T.schede.get(T.sv.id); return t && s && s.tipo === 'png' && isDM() && schedaDi(t)?.id === s.id ? t : null; };
  function valoreCampo(s, f) {
    if (f === 'nome') return s.nome;
    if (f.startsWith('att.')) { const [, i, k] = f.split('.'); return (s.dati.attacchi || [])[i]?.[k]; }
    if (f.startsWith('prv.')) { const [, i, k] = f.split('.'); const v = (s.dati.privilegi || [])[i]?.[k]; return k === 'riposo' ? v || 'lungo' : k === 'eff' ? effettoDi((s.dati.privilegi || [])[i] || {}) : v; }
    if (f.startsWith('inc.')) { const [, i, k] = f.split('.'); const v = (s.dati.incantesimi || [])[i]?.[k]; return k === 'livello' ? String(num(v) || 0) : v; }
    if (f.startsWith('tok.')) { const t = tokScheda(), k = f.slice(4); return t ? t[k] ?? (t.pf_max == null ? s.dati[k] : null) : null; }
    if (f === 'ispirazione' && typeof s.dati[f] === 'boolean') return s.dati[f] ? 1 : 0; // prima era una casella da spuntare
    return s.dati[f];
  }
  function calcola(s, c) {
    const [k, a] = c.split(':');
    if (k === 'comp') return segno(comp(s));
    if (k === 'm') return segno(modC(s.dati[a]));
    if (k === 'ts') return segno(tsTot(s, a));
    if (k === 'ab') return segno(abTot(s, a));
    if (k === 'iniz') return segno(modC(s.dati.des));
    if (k === 'pp') return String(10 + abTot(s, 'percezione'));
    if (k === 'cd') return String(8 + comp(s) + modC(s.dati[carInc(s)]));
    if (k === 'inc') return segno(comp(s) + modC(s.dati[carInc(s)]));
    if (k === 'ca') { const x = calcCA(s); return !x ? '' : x.incerta ? `Senza armatura la CA sarebbe ${x.ca} (${x.parti.join(' + ')}), ma la scheda dice ${s.dati.ca}: scegli qui sopra l'armatura indossata e la CA si calcola da sola.` : `CA ${x.ca} = ${x.parti.join(' + ')}`; }
    if (k === 'att') {
      const at = (s.dati.attacchi || [])[a], c = at && calcAtt(s, at), bd = bonusDadi(at), piuB = bd ? ` · più ${bd} ${bonusNome(at)}` : '';
      if (!c) return 'Manuale: bonus e danni li scrivi tu nella riga sopra.' + (bd ? ` Danni bonus: ${bd} ${bonusNome(at)}.` : '');
      return `${segno(c.colpire)} al colpire = ${nomeCar(c.k)} ${segno(c.m)}${c.cp ? ` + competenza ${segno(comp(s))}` : ''}${c.mg ? ` + magia ${segno(c.mg)}` : ''} · danni ${c.danni || 'scrivi il dado'}${c.w?.[2] ? ' ' + c.w[2] : ''}${piuB}`;
    }
    return '';
  }
  const PROF = ['○', '●', '◆'], PROFT = ['Nessuna competenza', 'Competente', 'Maestria (competenza doppia)'];
  function puntini(s, k, w) {
    const max = k.startsWith('usati_') ? clamp(num(s.dati['slot_' + k.slice(6)]) || 0, 0, 9) : 3, v = num(s.dati[k]) || 0;
    return Array.from({ length: max }, (_, i) => `<button type="button" class="${i < v ? 'on' : ''}" data-dot="${k}" data-i="${i + 1}" aria-label="${i + 1}"${w ? '' : ' disabled'}></button>`).join('');
  }
  function riempi() {
    const sv = T.sv; if (!sv) return; const s = T.schede.get(sv.id), box = sv.d.querySelector('.tv-sch'); if (!s || !box) return;
    box.querySelectorAll('[data-f]').forEach(el => { if (el === document.activeElement) return; const v = valoreCampo(s, el.dataset.f); if (el.type === 'checkbox') el.checked = !!v; else el.value = v ?? ''; });
    box.querySelectorAll('[data-c]').forEach(el => el.textContent = calcola(s, el.dataset.c));
    box.querySelectorAll('[data-prof]').forEach(el => { const v = num(s.dati[el.dataset.prof]) || (s.dati[el.dataset.prof] === true ? 1 : 0); el.textContent = PROF[v]; el.title = PROFT[v]; el.classList.toggle('on', v > 0); });
    box.querySelectorAll('[data-dots]').forEach(el => el.innerHTML = puntini(s, el.dataset.dots, puoScrivere(s)));
    box.querySelectorAll('[data-adv]').forEach(el => el.classList.toggle('on', +el.dataset.adv === sv.adv));
    box.querySelectorAll('textarea.auto').forEach(cresci);
    const caI = box.querySelector('.scudo [data-f=ca]'), caA = (x => !!x && !x.incerta)(calcCA(s));
    if (caI) { caI.readOnly = caA; caI.classList.toggle('calcolato', caA); caI.title = caA ? 'Calcolata da armatura, scudo e Destrezza: cambiala con ⚙' : ''; }
    box.querySelectorAll('.at[data-ordi]').forEach(el => {
      const a = (s.dati.attacchi || [])[+el.dataset.ordi], auto = !!(a && calcAtt(s, a));
      el.querySelectorAll('.riga:first-child .ac, .riga:first-child .ad').forEach(x => { x.readOnly = auto; x.classList.toggle('calcolato', auto); x.title = auto ? 'Calcolato dalla caratteristica scelta: cambialo con ⚙' : ''; });
    });
  }
  // senza field-sizing (Safari, Firefox) l'altezza si calcola a mano; a scheda nascosta si riprova quando si vede
  function cresci(el) { if (CSS.supports?.('field-sizing', 'content') || !el.offsetParent) return; el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
  // la scheda di un PNG come nel Manuale dei Mostri: si legge a colpo d'occhio, si tira cliccando sui numeri
  const PE = { '0': 10, '1/8': 25, '1/4': 50, '1/2': 100, 1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800, 6: 2300, 7: 2900, 8: 3900, 9: 5000, 10: 5900, 11: 7200, 12: 8400, 13: 10000, 14: 11500, 15: 13000, 16: 15000, 17: 18000, 18: 20000, 19: 22000, 20: 25000, 21: 33000, 22: 41000, 23: 50000, 24: 62000, 25: 75000, 26: 90000, 27: 105000, 28: 120000, 29: 135000, 30: 155000 };
  const media = f => { const m = String(f || '').replace(/\s+/g, '').match(/^(\d*)d(\d+)([+-]\d+)?$/i); return m ? Math.max(1, Math.floor((+m[1] || 1) * (+m[2] + 1) / 2 + (+m[3] || 0))) : null; };
  // nei testi i dadi (2d6, 1d8 + 3) diventano pulsanti da tirare; «Nome. testo» mette il nome in grassetto corsivo
  const dadiTesto = (t, dis) => esc(t).replace(/\b(\d*d\d+(?:\s*[+−-]\s*\d+)?)\b/gi, x => `<button type="button" class="dt" data-roll="txt:${x.replace(/\s+/g, '').replace('−', '-')}"${dis}>${x}</button>`);
  const paragrafi = (t, dis) => String(t || '').split(/\n+/).map(r => r.trim()).filter(Boolean).map(r => { const m = r.match(/^([^.:]{2,60}?)\s*[.:]\s+(.+)$/); return `<p>${m ? `<b><i>${esc(m[1])}.</i></b> ${dadiTesto(m[2], dis)}` : dadiTesto(r, dis)}</p>`; }).join('');
  function bloccoPng(s, tk, w, dis, cond, conds) {
    const d = s.dati, pf = tk ? pfDi(tk) : { pf: num(d.pf), max: num(d.pf_max) };
    const sotto = [d.taglia_tipo, d.allineamento].filter(Boolean).join(', ') || 'Taglia, tipo, allineamento';
    const ts = CAR.filter(([k]) => d['ts_' + k]).map(([k, ab, nome]) => `<button type="button" class="lk" data-roll="ts:${k}" title="Tiro salvezza su ${nome}"${dis}>${ab[0] + ab.slice(1).toLowerCase()} ${segno(tsTot(s, k))}</button>`).join(', ');
    const ab = ABIL.filter(([k]) => num(d['ab_' + k])).map(([k, nome]) => `<button type="button" class="lk" data-roll="ab:${k}"${dis}>${nome} ${segno(abTot(s, k))}</button>`).join(', ');
    const riga = (et, v) => v ? `<p><b>${et}</b> ${v}</p>` : '';
    const gs = String(d.gs ?? '').trim(), pe = PE[gs];
    const atts = (d.attacchi || []).map((a, i) => {
      // come nelle schede dei personaggi: il testo del manuale e sotto i tasti per attaccare
      const pa = portata(a), dist = !!pa.dist && !pa.mischia, mi = media(a.danni), col = segno(num(a.colpire) || 0);
      const dove = pa.area ? 'incantesimo ad area' : pa.ts ? 'incantesimo con tiro salvezza' : `Attacco con arma ${pa.dist && pa.mischia ? 'da mischia o a distanza' : dist ? 'a distanza' : 'da mischia'}`;
      return `<div class="sbat"><p><b><i>${esc(a.nome || 'Attacco')}.</i></b> <i>${dove}:</i> ${pa.area || pa.ts ? '' : `${col} al colpire. `}<i>Colpito:</i> ${mi != null ? `${mi} (${esc(a.danni)})` : esc(a.danni || '—')} danni${a.tipo ? ' ' + esc(a.tipo) : ''}${bonusDadi(a) ? ` più ${media(bonusDadi(a)) != null ? media(bonusDadi(a)) + ' ' : ''}(${esc(bonusDadi(a))}) ${esc(bonusNome(a))}` : ''}.</p>
        <div class="sbb"><button type="button" class="mini on" data-roll="att:${i}" title="${pa.area ? 'Scegli il punto sulla mappa' : 'Scegli il bersaglio sulla mappa (senza token: tiro per colpire)'}"${dis}>${pa.area ? '🔥 Lancia' : pa.ts ? '✨ Lancia' : '🎯 Attacca ' + col}</button><button type="button" class="mini" data-roll="dan:${i}" title="Tira i danni (con Maiusc: critico)"${dis}>💥 Danni ${esc(a.danni || '')}${bonusDadi(a) ? ' + ' + esc(bonusDadi(a)) : ''}</button><button type="button" class="mini" data-roll="cri:${i}" title="Critico: dadi dei danni raddoppiati"${dis}>✖2 Critico</button></div></div>`;
    }).join('');
    return `<div class="sb">
      <div class="sbh"><div><h3>${esc(s.nome)}</h3><i>${esc(sotto)}</i></div>${w ? '<button type="button" class="mini" data-k="modifica" title="Cambia i valori della scheda">✎ Modifica</button>' : ''}</div>
      <hr><div class="rosso">
      <p><b>Classe Armatura</b> ${esc(d.ca ?? '—')}</p>
      <p class="pfr"><span><b>Punti Ferita</b> ${esc(d.pf_max ?? '—')}${d.dadi_vita ? ` (<button type="button" class="dt" data-roll="txt:${esc(String(d.dadi_vita).replace(/\s+/g, ''))}"${dis}>${esc(d.dadi_vita)}</button>)` : ''}</span>
        ${pf && pf.max != null ? `<span class="ora ${pf.pf <= 0 ? 'ko' : ''}">ora ${n2(tk ? 'tok.pf' : 'pf', dis)} / ${pf.max}</span>` : ''}
        ${w && pf ? '<span class="q"><button type="button" data-k="pfm" title="Danni">−</button><input type="number" data-k="pfq" value="1" min="1" aria-label="Quanti punti"><button type="button" data-k="pfp" title="Cura">+</button></span>' : ''}</p>
      <p><b>Velocità</b> ${esc(d.velocita || '—')}</p>
      <hr>
      <div class="sbc">${CAR.map(([k, abb, nome]) => `<button type="button" data-roll="car:${k}" title="Prova di ${nome}"${dis}><b>${abb}</b><span>${num(d[k]) ?? 10} (${segno(modC(d[k]))})</span></button>`).join('')}</div>
      <hr>
      ${riga('Tiri salvezza', ts)}${riga('Abilità', ab)}${riga('Resistenze e immunità', esc(d.difese || ''))}
      <p><b>Sensi</b> ${d.sensi ? esc(d.sensi) + ', ' : ''}Percezione passiva ${10 + abTot(s, 'percezione')}</p>
      ${riga('Linguaggi', esc(d.linguaggi || '—'))}
      <p class="due"><span><b>Sfida</b> ${esc(gs || '—')}${pe ? ` (${pe.toLocaleString('it-IT')} PE)` : ''}</span><span><b>Bonus di competenza</b> ${segno(comp(s))}</span></p>
      </div><hr>
      ${paragrafi(d.tratti, dis)}${(d.privilegi || []).map((p, i) => `<p class="trt"><b><i>${esc(p.nome || 'Tratto')}.</i></b> ${dadiTesto(String(p.testo || '').replace(/\n+/g, ' '), dis)} ${chipEff(p, i, w)}</p>`).join('')}
      <p class="iz"><button type="button" class="mini" data-roll="iniz"${dis}>🎲 Iniziativa ${segno(modC(d.des))}</button></p>
      <h4>Azioni</h4>
      ${atts || (d.azioni ? '' : '<p class="vuoto">Nessuna azione: premi Modifica per aggiungerne.</p>')}${paragrafi(d.azioni, dis)}
      ${d.competenze ? `<h4>Altro</h4>${paragrafi(d.competenze, dis)}` : ''}
      <h4>Condizioni</h4><div class="cnd">${cond || '<span class="vuoto">Nessuna</span>'}${w ? `<select data-k="cond" class="selc" aria-label="Aggiungi una condizione"><option value="">+ Condizione</option>${CONDIZIONI.filter(c => !conds.includes(c)).map(c => `<option>${c}</option>`).join('')}</select>` : ''}</div>
    </div>`;
  }
  /* ---------- privilegi, tratti e risorse (come su Roll20: il titolo in evidenza, si apre per leggere tutto) ---------- */
  const nuovoId = () => Math.random().toString(36).slice(2, 9);
  const RIPOSO = { breve: 'Riposo breve', lungo: 'Riposo lungo', mai: 'Non si recupera' };
  const restanti = p => Math.max(0, (num(p.usi) || 0) - (num(p.usati) || 0));
  // il vecchio testo libero diventa una voce per ogni «Nome. descrizione» o per ogni titolo breve seguito dal suo testo
  const RISORSA = /punt|slot|caric|\busi\b|utilizz|\bira\b|ispirazione bardica|incanalare|stregoner|\bki\b|volte/i;
  function dividiTesto(txt, fonte) {
    const out = []; let cur = null, gruppo = false; // gruppo: un titolo da solo (Metamagia) tiene sotto di sé le sue opzioni
    for (const r of String(txt || '').split(/\n/).map(x => x.trim())) {
      if (!r) { cur = null; gruppo = false; continue; }
      const m = r.match(/^[-•*]?\s*([^.:]{2,50}?)\s*[.:]\s+(.+)$/), titolo = !m && r.length <= 45 && !/[.!?]$/.test(r);
      if (m && cur && gruppo && !RISORSA.test(m[1])) { cur.testo += (cur.testo ? '\n' : '') + r; continue; }
      if (m || titolo || !cur) { cur = { id: nuovoId(), nome: (m ? m[1] : titolo ? r : 'Nota').replace(/^[-•*]\s*/, ''), fonte: fonte || '', testo: m ? m[2] : titolo ? '' : r }; gruppo = titolo && !RISORSA.test(r); out.push(cur); }
      else { cur.testo += (cur.testo ? '\n' : '') + r; gruppo = false; }
    }
    for (const p of out) {
      // «Punti stregoneria: 5» o «Ira 3/3»: diventano risorse da contare
      const n = p.testo.match(/^\s*(\d{1,3})(?:\s*\/\s*(\d{1,3}))?\b(?!\s*d\d)/) || p.nome.match(/(\d{1,3})\s*\/\s*(\d{1,3})\s*$/);
      if (n && RISORSA.test(p.nome + ' ' + p.testo)) { p.usi = +(n[2] || n[1]); p.usati = n[2] ? Math.max(0, +n[2] - +n[1]) : 0; p.riposo = /breve/i.test(p.testo) ? 'breve' : 'lungo'; }
      // «Attacco furtivo: 3d6…»: i dadi si tirano dalla voce e si possono aggiungere ai danni
      const dd = `${p.nome} ${p.testo}`.match(/\b(\d{1,2}d\d{1,3}(?:\s*[+-]\s*\d+)?)\b/i);
      if (dd && /furtiv|punizion|danni in più|danni extra|in più ai danni/i.test(p.nome + ' ' + p.testo)) { p.dadi = dd[1].replace(/\s+/g, ''); p.extra = true; }
    }
    return out;
  }
  // attacchi che in realtà sono privilegi (attacco furtivo, metamagia, punti stregoneria…): vanno nella loro sezione
  const NON_ATTACCO = /furtiv|metamagi|punti\s|punizion|incanalare|ispirazione/i;
  const daSpostare = d => (d.attacchi || []).filter(a => NON_ATTACCO.test(a.nome || ''));
  function boxRisorse(s, w, dis) {
    const L = (s.dati.privilegi || []).map((p, i) => [p, i]).filter(([p]) => num(p.usi) > 0);
    const riga = ([p, i]) => {
      const max = num(p.usi), r = restanti(p);
      return `<div class="rs" data-ordi="${i}">${w ? '<span class="mano" title="Trascina per spostare" aria-hidden="true">⠿</span>' : ''}<button type="button" class="rn" data-k="prv-apri" data-i="${i}" title="${esc(RIPOSO[p.riposo || 'lungo'])}">${esc(p.nome || 'Risorsa')}</button>
        ${max <= 8 ? `<span class="dots rd">${Array.from({ length: max }, (_, j) => `<button type="button" class="${j < r ? 'on' : ''}" data-k="ris-pip" data-i="${i}" data-j="${j + 1}" aria-label="${j + 1}"${dis}></button>`).join('')}</span>` : ''}
        <span class="rv"><b>${r}</b>/${max}</span>${w ? `<button type="button" class="mini" data-k="ris-usa" data-i="${i}" title="Usa"${r ? '' : ' disabled'}>−</button><button type="button" class="mini" data-k="ris-rec" data-i="${i}" title="Recupera"${r < max ? '' : ' disabled'}>+</button>` : ''}</div>`;
    };
    return `<div class="sez ris"><div class="rl" data-ord="privilegi">${L.map(riga).join('') || '<p class="vuoto">Punti stregoneria, ira, ki, incanalare divinità… aggiungili qui per contarli.</p>'}</div>
      ${w ? `<div class="rb2"><button type="button" class="mini" data-k="ris-add">+ Risorsa</button><button type="button" class="mini" data-k="riposo-breve" title="Recupera le risorse che tornano col riposo breve">☕ Riposo breve</button><button type="button" class="mini" data-k="riposo-lungo" title="PF al massimo, slot e risorse recuperati">🌙 Riposo lungo</button></div>` : ''}<h6>Risorse</h6></div>`;
  }
  // l'effetto di un tratto in breve, con l'interruttore per spegnerlo (es. Sensibilità alla luce solare solo di giorno)
  const BREVE_EFF = { branco: 'Tattica del branco', vant_att: 'Vantaggio ai suoi attacchi', svant_att: 'Svantaggio ai suoi attacchi', svant_contro: 'Svantaggio a chi lo attacca', vant_contro: 'Vantaggio a chi lo attacca', vant_ts: 'Vantaggio ai TS' };
  function chipEff(p, i, w) {
    const e = effettoDi(p); if (!e) return '';
    const t = e === 'ts_colpo' ? `Colpito: TS ${p.ts_car ? nomeCar(p.ts_car) : '?'}${num(p.ts_cd) ? ' CD ' + num(p.ts_cd) : ''}` : BREVE_EFF[e] + (e === 'vant_ts' && p.ts_car ? ' su ' + nomeCar(p.ts_car) : '');
    return `<span class="effc${p.off ? ' off' : ''}" title="${esc((EFFETTI_TR.find(x => x[0] === e) || [])[1] || '')}: il Tavolo lo applica da solo">⚔ ${esc(t)}</span>${w ? `<label class="sw2${p.off ? '' : ' on'}" title="Spento: il Tavolo non lo applica (es. solo in certe situazioni)"><input type="checkbox" data-k="prv-off" data-i="${i}"${p.off ? '' : ' checked'}>${p.off ? 'spento' : 'attivo'}</label>` : ''}`;
  }
  function voceForm(p, i) {
    const f = (k, ph, t = 'text', cls = '') => `<input type="${t}" data-f="prv.${i}.${k}" class="${cls}" placeholder="${esc(ph)}" aria-label="${esc(ph)}"${t === 'number' ? ' min="0" step="1"' : ''}>`;
    return `<div class="pvf">${f('nome', 'Nome (es. Metamagia)', 'text', 'pn')}${f('fonte', 'Da dove viene (es. Stregone 3)')}
      <textarea data-f="prv.${i}.testo" rows="5" placeholder="Descrizione completa: i dadi come 3d6 diventano tirabili" aria-label="Descrizione"></textarea>
      <div class="pvr"><label>Usi ${f('usi', '—', 'number', 'u')}</label><label>Tornano con <select data-f="prv.${i}.riposo">${Object.entries(RIPOSO).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label></div>
      <div class="pvr"><label>Dadi ${f('dadi', 'es. 3d6', 'text', 'd')}</label><label class="ck" title="Quando attacchi un bersaglio puoi aggiungerli ai danni (attacco furtivo, punizione…)"><input type="checkbox" data-f="prv.${i}.extra"> Si aggiungono ai danni di un attacco</label></div>
      <div class="pvr"><label class="eff">Effetto in combattimento <select data-f="prv.${i}.eff">${EFFETTI_TR.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label></div>
      ${(e => e === 'ts_colpo' || e === 'vant_ts' ? `<div class="pvr"><label>${e === 'ts_colpo' ? 'Tiro salvezza su' : 'Su quali tiri salvezza'} <select data-f="prv.${i}.ts_car"><option value="">${e === 'ts_colpo' ? '—' : 'Tutti'}</option>${CAR.map(([k, , n]) => `<option value="${k}">${n}</option>`).join('')}</select></label>${e === 'ts_colpo' ? `<label>CD ${f('ts_cd', '13', 'number', 'u')}</label>` : ''}</div>` : '')(effettoDi(p))}
      <div class="pvr"><button type="button" class="mini" data-k="prv-mod" data-i="${i}">✓ Fatto</button><button type="button" class="mini via" data-k="prv-via" data-i="${i}">Elimina</button></div></div>`;
  }
  function boxPrivilegi(s, w, dis) {
    const sv = T.sv, d = s.dati, L = d.privilegi || [], fl = norm(sv.filtro || '');
    const pg = formaPg(s), vecchio = pg ? [d.tratti, d.azioni].some(x => String(x || '').trim()) || daSpostare(d).length > 0 : !!String(d.tratti || '').trim();
    const voce = (p, i) => {
      const key = p.id || 'i' + i, aperta = sv.aperti?.has(key), mod = sv.mprv === key && w;
      const nasc = fl && !norm(`${p.nome} ${p.fonte} ${p.testo}`).includes(fl);
      return `<div class="pv${aperta ? ' ap' : ''}" data-ordi="${i}"${nasc ? ' hidden' : ''}>
        <div class="ph">${w ? '<span class="mano" title="Trascina per spostare" aria-hidden="true">⠿</span>' : ''}<button type="button" class="pt" data-k="prv-apri" data-i="${i}" aria-expanded="${!!aperta}">${esc(p.nome || 'Senza nome')}</button>
          ${num(p.usi) > 0 ? `<span class="pu" title="Usi rimasti">${restanti(p)}/${num(p.usi)}</span>` : ''}${p.dadi ? `<button type="button" class="mini" data-k="prv-dadi" data-i="${i}" title="Tira ${esc(p.dadi)}"${dis}>🎲 ${esc(p.dadi)}</button>` : ''}
          ${w ? `<button type="button" class="ing" data-k="prv-mod" data-i="${i}" title="Modifica" aria-label="Modifica">⚙</button>` : ''}</div>
        ${effettoDi(p) ? `<div class="pe">${chipEff(p, i, w)}</div>` : ''}
        ${p.fonte ? `<small class="pf2">${esc(p.fonte)}</small>` : ''}
        ${mod ? voceForm(p, i) : aperta ? `<div class="pd">${paragrafi(p.testo, dis) || '<p class="vuoto">Nessuna descrizione.</p>'}</div>` : ''}</div>`;
    };
    return `<div class="sez prv">${L.length > 4 ? `<input type="search" data-k="filtro" placeholder="Filtra per…" value="${esc(sv.filtro || '')}" aria-label="Filtra i privilegi">` : ''}
      ${vecchio && w ? `<div class="vec"><p>Qui c'è ancora il testo scritto prima nei riquadri liberi: trasformalo in voci da aprire e spostare.</p><button type="button" class="mini" data-k="converti">✨ Trasforma in voci</button><details><summary>Mostra il testo</summary><pre>${esc((pg ? [d.tratti, d.azioni, ...daSpostare(d).map(a => `${a.nome}: ${[a.danni, a.tipo].filter(Boolean).join(', ')}`)] : [d.tratti]).filter(Boolean).join('\n\n'))}</pre></details></div>` : ''}
      <div class="pl" data-ord="privilegi">${L.map(voce).join('') || (vecchio ? '' : `<p class="vuoto">${pg ? 'Nessun privilegio: aggiungi metamagia, attacco furtivo, tratti della razza, talenti…' : 'Nessun tratto: aggiungi Tattica del branco, Resistenza alla magia… e scegli il suo effetto con ⚙'}</p>`)}</div>
      ${w ? `<button type="button" class="mini agg" data-k="prv-add">+ Aggiungi ${pg ? 'un privilegio o tratto' : 'un tratto'}</button>` : ''}<h6>${pg ? 'Privilegi e tratti' : 'Tratti speciali'}</h6></div>`;
  }
  // azione, azione bonus, reazione e movimento del turno di un token
  const chiaveTurno = () => T.stato?.turno ? `${T.stato.round || 1}:${T.stato.turno}` : 'fuori';
  const azioniDi = t => (t?.azioni && t.azioni.chiave === chiaveTurno() ? t.azioni : { chiave: chiaveTurno() });
  // la reazione usata fuori dal proprio turno (attacco di opportunità, Scudo…) resta usata fino all'inizio del suo turno
  function reaUsata(t) {
    if (suoTurno(t)) return !!azioniDi(t).rea;
    const rf = t?.azioni?.reaf; if (!rf || !T.stato?.turno) return false;
    const L = ordinati(), io = L.findIndex(x => x.token === t.id); if (io < 0) return false;
    const pos = k => { const [r, id] = String(k).split(/:(.*)/); return { r: +r || 1, i: L.findIndex(x => x.id === id) }; };
    const u = pos(rf), ora = pos(chiaveTurno()); if (u.i < 0 || ora.i < 0) return false;
    const prossimo = (io > u.i ? u.r : u.r + 1) * 1000 + io;
    return ora.r * 1000 + ora.i < prossimo;
  }
  const usata = (t, k) => k === 'rea' ? reaUsata(t) : !!azioniDi(t)[k];
  // fuori dal suo turno l'unica cosa che si spende è la reazione
  function segnaReazione(t) { if (!t || !inCombattimento() || !T.turno.some(x => x.token === t.id)) return; if (suoTurno(t)) return segnaAzioni(t, { rea: true }); return segnaAzioni(t, { reaf: chiaveTurno() }); }
  const velocitaDi = s => { const m = String(s?.dati.velocita || '').match(/\d+(?:[.,]\d+)?/); return m ? parseFloat(m[0].replace(',', '.')) : 9; };
  const scattiDi = a => a.fatte ? a.fatte.filter(x => x.k === 'scatto').length : a.scatto ? 1 : 0;
  // conta anche lo spostamento che aspetta la conferma
  const movimentoDi = t => { const a = azioniDi(t), tot = velocitaDi(schedaDi(t)) * (1 + scattiDi(a)), att = T.passo?.id === t.id ? T.passo.m : 0; return { tot, resta: Math.round((tot - (a.mov || 0) - att) * 10) / 10 }; };
  // da dove è partito nel suo turno: il primo spostamento confermato lo fissa; prima è dov'è (o da dove lo sta portando)
  const origineTurno = t => { const a = azioniDi(t); if (a.ox != null) return { x: a.ox, y: a.oy }; const p = T.passo?.id === t.id ? T.passo : T.drag?.id === t.id ? T.drag : null; return p ? { x: p.x0, y: p.y0 } : { x: t.x, y: t.y }; };
  const suoTurno = t => { const att = T.turno?.find(x => x.id === T.stato?.turno); return !!t && !!att && att.token === t.id; };
  async function segnaAzioni(t, ch) {
    if (!t) return; const a = { ...azioniDi(t), segni: t.azioni?.segni, reaf: t.azioni?.reaf, ...ch, chiave: chiaveTurno() }, prima = t.azioni;
    t.azioni = a; disegnaToken(); if (T.sv) aggiornaFinestra(); rinfrescaTurnoPop(t);
    const r = await SB.from('tavolo_token').update({ azioni: a }).eq('id', t.id);
    if (r.error) { t.azioni = prima; disegnaToken(); toast(/azioni/i.test(r.error.message) ? 'Per segnare azioni e movimento esegui tavolo/tappa-6.sql in Supabase.' : r.error.message, 'err'); }
  }
  const AZ = [['az', '⚔', 'Azione'], ['bon', '✚', 'Azione bonus'], ['rea', '↺', 'Reazione']];
  // toccare un'azione la segna usata o la ridà, se il gioco ha sbagliato
  function cambiaAz(t, z) {
    if (z === 'rea' && !suoTurno(t)) return segnaAzioni(t, { reaf: reaUsata(t) ? null : chiaveTurno() });
    return segnaAzioni(t, { [z]: !azioniDi(t)[z] });
  }
  // nel menu del token, durante il combattimento: cosa resta di questo turno (si scala da solo)
  function turnoPop(t) {
    const a = azioniDi(t), mv = movimentoDi(t), mio = suoTurno(t), fz = (a.fatte || []).length && mio;
    return `<div class="tzp" data-id="${t.id}"><div class="tt">${mio ? '⚔ Il suo turno: cosa gli resta' : '⏳ Non è il suo turno'}</div>
      <div class="r">${AZ.map(([k, ic, l]) => { const u = usata(t, k), off = !mio && k !== 'rea'; return `<button type="button" class="c${u ? ' no' : ''}${off ? ' off' : ''}" data-z="${k}" title="${l}: ${off ? 'solo nel suo turno' : u ? 'usata (tocca per ridarla)' : 'disponibile'}"${off ? ' disabled' : ''}>${ic} ${l}</button>`; }).join('')}</div>
      ${mio ? `<div class="r"><span class="mv${mv.resta < 0 ? ' ko' : ''}">🏃 ${metri(Math.max(0, mv.resta))} <small>di ${metri(mv.tot)}</small></span><button type="button" class="az" data-k="tzazm" aria-haspopup="menu">Azioni ▾</button></div>` : ''}
      ${fz ? `<div class="r fzr">${fatteHtml(t, 'fz', 'tzfz')}</div>` : ''}</div>`;
  }
  function legaTurnoPop(box, t) {
    box.querySelectorAll('[data-z]').forEach(b => b.onclick = () => cambiaAz(t, b.dataset.z));
    box.querySelectorAll('[data-k=tzfz]').forEach(b => b.onclick = () => togliAzione(t, +b.dataset.i));
    box.querySelector('[data-k=tzazm]')?.addEventListener('click', e => menuAzioni(t, e.currentTarget));
  }
  function rinfrescaTurnoPop(t) {
    const el = document.querySelector(`.tv-pop .tzp[data-id="${t.id}"]`); if (!el) return;
    el.outerHTML = turnoPop(t); legaTurnoPop(document.querySelector('.tv-pop'), t);
  }
  // le azioni del regolamento: si fanno con l'azione (alcune anche con l'azione bonus, vedi bonusAz)
  const AZIONI = [
    ['scatto', '🏃', 'Scatto', 'Altro movimento', 'Ti muovi ancora quanto la tua velocità, anche se ti sei già mosso'],
    ['dis', '🛡', 'Disimpegno', 'Niente attacchi di opportunità', 'In questo turno il tuo movimento non provoca attacchi di opportunità'],
    ['sch', '🌀', 'Schivata', 'Ti attaccano con svantaggio', 'Fino al tuo prossimo turno chi ti attacca ha svantaggio e tu hai vantaggio ai TS su Destrezza'],
    ['nas', '🫥', 'Nascondersi', 'Prova di Furtività', 'Fai una prova di Destrezza (Furtività)'],
    ['aiu', '🤝', 'Aiuto', 'Vantaggio a un alleato', 'Un alleato ha vantaggio alla sua prossima prova o al prossimo attacco'],
    ['pre', '⏳', 'Preparare', 'Agisci dopo, di reazione', 'Decidi cosa farai e quando: agirai con la reazione'],
    ['cer', '🔍', 'Cercare', 'Percezione o Indagare', 'Prova di Saggezza (Percezione) o di Intelligenza (Indagare)'],
    ['ogg', '🧰', 'Usa un oggetto', 'Leva, porta, oggetto', 'Una leva, una porta, un oggetto da usare']];
  const voceAz = k => AZIONI.find(x => x[0] === k) || (/^p:/.test(k) ? ['', '✨', k.slice(2), ''] : ['', '•', k, '']);
  // privilegi che si usano con l'azione bonus o con la reazione (Ira, Schivata prodigiosa, Maestro delle tattiche…):
  // quelli della scheda più quelli che la classe, la sottoclasse e la razza danno a quel livello, così valgono anche per le schede fatte a mano
  const STD_BON = { 'azione scaltra': ['scatto', 'dis', 'nas'], 'fuga agile': ['dis', 'nas'], 'passo del vento': ['scatto', 'dis'], 'difesa paziente': ['sch'], 'maestro delle tattiche': ['aiu'], 'dono fatato': ['aiu'], 'carica furiosa': ['scatto'], 'impeto': ['scatto'], 'svanire': ['nas'], 'occhio per i dettagli': ['cer'] };
  const KI = [['Arti marziali', 'Dopo l\'azione di Attacco, un colpo senz\'armi con l\'azione bonus.'], ['Raffica di colpi', '1 ki dopo l\'azione di Attacco: due colpi senz\'armi con l\'azione bonus.'], ['Difesa paziente', '1 ki: Schivata con l\'azione bonus.'], ['Passo del vento', '1 ki: Scatto o Disimpegno con l\'azione bonus, e salti il doppio.']];
  const OPP = { nome: 'Attacco di opportunità', testo: 'Un attacco in mischia contro chi esce dalla tua portata senza Disimpegno.' };
  const tempoPriv = t => /(^|[.;:,]\s*)(con )?(la|una) reazione\b|\be la reazione\b|\b(usi|usare|spendi|spendere) la (tua )?reazione/i.test(t) ? 'rea' : /azione bonus/i.test(t) ? 'bon' : '';
  function privAzioni(R, d) {
    if (!R.__ip) {
      const m = new Map(), put = (n, t) => { const k = norm(n); if (n && t && !m.has(k)) m.set(k, t); }, liv = o => Object.values(o || {}).forEach(a => a.forEach(([n, t]) => put(n, t)));
      Object.values(R.classi).forEach(k => liv(k.liv)); Object.values(R.sotto).forEach(L => L.forEach(x => liv(x.liv)));
      R.razze.forEach(r => [r, ...(r.sotto || [])].forEach(x => (x.tratti || []).forEach(([n, t]) => put(n, t)))); (R.talenti || []).forEach(f => put(f.nome, f.testo));
      R.__ip = m;
    }
    const out = new Map(), add = (n, t, f) => { n = String(n || '').trim(); const k = norm(n); if (!n || out.has(k)) return; t = t || R.__ip.get(k) || ''; const tempo = STD_BON[k] ? 'bon' : tempoPriv(t); if (tempo) out.set(k, { nome: n, testo: t, tempo, fonte: f, std: STD_BON[k] || null }); };
    (d.privilegi || []).forEach(p => add(p.nome, p.testo, p.fonte));
    const L = classiDi(R, d).L;
    for (const c of L) { const k = R.classi[c.id], sb = sottoDi(R, c); for (let l = 1; l <= c.livello; l++) { (k.liv[l] || []).forEach(([n, t]) => add(n, t, `${k.nome} ${l}`)); (sb?.liv?.[l] || []).forEach(([n, t]) => add(n, t, `${nomeBreve(sb.nome)} ${l}`)); } }
    const mo = L.find(c => c.id === 'monaco'); if (mo) KI.forEach(([n, t], i) => (!i || mo.livello >= 2) && add(n, t, 'Monaco'));
    const rn = norm(d.razza), r = R.razze.find(x => x.id === d.razza_id) || (rn ? R.razze.find(x => rn.includes(norm(x.nome))) : null), sr = r?.sotto?.find(x => x.id === d.sottorazza || (rn && rn.includes(norm(x.nome))));
    for (const x of [r, sr]) (x?.tratti || []).forEach(([n, t]) => add(n, t, x.nome));
    return out;
  }
  // con l'azione bonus: Scatto, Disimpegno, Aiuto… quando un privilegio lo permette (Azione scaltra, Fuga agile, Maestro delle tattiche…)
  function bonusAz(t) {
    const d = schedaDi(t)?.dati || {};
    if (window.__regole) {
      const P = [...privAzioni(window.__regole, d).values()].filter(x => x.std);
      if (P.length) { const k = AZIONI.map(x => x[0]).filter(k => P.some(x => x.std.includes(k))); return { nome: P.map(x => x.nome).join(', '), k, per: Object.fromEntries(k.map(y => [y, P.find(x => x.std.includes(y)).nome])) }; }
    }
    const testo = norm([(d.privilegi || []).map(p => p.nome || '').join('|'), d.azioni || '', d.tratti || ''].join('|'));
    if (/azione scaltra|azioni scaltre/.test(testo) || (/ladr/i.test(d.classe || '') && (parseInt(d.livello) || 0) >= 2)) return { nome: 'Azione scaltra', k: ['scatto', 'dis', 'nas'] };
    if (/fuga agile/.test(testo)) return { nome: 'Fuga agile', k: ['dis', 'nas'] };
    if (/passo del vento/.test(testo)) return { nome: 'Passo del vento', k: ['scatto', 'dis'] };
    return null;
  }
  // un privilegio usato con l'azione bonus o con la reazione: si segna e si scrive in chat
  async function usaPriv(t, x, da) {
    const a = azioniDi(t); if (a[da]) { toast(da === 'rea' ? 'La reazione di questo turno è già usata.' : 'L\'azione bonus di questo turno è già usata.', 'err'); return; }
    const fatte = [...(a.fatte || (a.scatto ? [{ k: 'scatto', da: 'az' }] : [])), { k: 'p:' + x.nome, da }];
    await segnaAzioni(t, { [da]: true, fatte, scatto: fatte.some(y => y.k === 'scatto') });
    await annuncia(`${da === 'rea' ? '↺' : '✨'} ${t.nome || 'Il token'} usa ${x.nome} (${da === 'rea' ? 'reazione' : 'azione bonus'})${x.testo ? ': ' + corto(x.testo, 220) : '.'}`);
  }
  // con cosa può scattare ora: l'azione, se no l'azione bonus (Azione scaltra…)
  const puoScattare = t => { const a = azioniDi(t); if (!a.az) return 'az'; const b = bonusAz(t); return b && b.k.includes('scatto') && !a.bon ? 'bon' : null; };
  // un messaggio in chat a nome di chi gioca
  async function annuncia(testo) {
    const r = await SB.rpc('tavolo_scrivi', { p_testo: testo, p_per: null });
    const row = !r.error && (Array.isArray(r.data) ? r.data[0] : r.data);
    if (row && !T.chat.some(x => x.id === row.id)) { T.chat.push(row); nuovoMsg(row); }
  }
  // cosa fa ogni azione, scritto per bene in chat
  function descriviAzione(t, k, da, x) {
    const n = t.nome || 'Il token', b = da === 'bon' ? bonusAz(t) : null, con = b ? `azione bonus · ${b.per?.[k] || b.nome}` : 'azione', [, ic] = voceAz(k);
    const D = {
      scatto: `usa Scatto (${con}): guadagna altri ${metri(velocitaDi(schedaDi(t)))} di movimento in questo turno, ora può muoversi ancora di ${metri(Math.max(0, movimentoDi(t).resta))}.`,
      dis: `usa Disimpegno (${con}): fino alla fine del turno il suo movimento non provoca attacchi di opportunità.`,
      sch: `usa Schivata (${con}): fino all'inizio del suo prossimo turno chi lo attacca ha svantaggio, se ${n} lo vede, e lui ha vantaggio ai tiri salvezza su Destrezza.`,
      nas: `prova a Nascondersi (${con}): tira Furtività. Chi lo cerca deve superare il risultato con la Percezione.`,
      aiu: `usa Aiuto${x ? ' su ' + (x.nome || 'un alleato') : ''} (${con}): ${x ? x.nome || 'l\'alleato' : 'l\'alleato'} ha vantaggio alla prossima prova o al prossimo tiro per colpire, fino all'inizio del prossimo turno di ${n}.`,
      pre: `si prepara ad agire (${con}): sceglie un innesco e, quando succede, agisce usando la reazione.`,
      cer: `usa Cercare (${con}): fa una prova di Saggezza (Percezione) o di Intelligenza (Indagare) per trovare qualcosa.`,
      ogg: `usa un oggetto (${con}).`
    };
    return `${ic} ${n} ${D[k] || voceAz(k)[2] + ' (' + con + ').'}`;
  }
  async function faiAzione(t, k, da, x) {
    if (T.passo?.id === t.id && k !== 'dis') await confermaPasso(); // prima si conferma lo spostamento fatto
    const a = azioniDi(t); if (a[da]) { toast(da === 'az' ? 'L\'azione di questo turno è già usata.' : 'L\'azione bonus di questo turno è già usata.', 'err'); return; }
    const fatte = [...(a.fatte || (a.scatto ? [{ k: 'scatto', da: 'az' }] : [])), { k, da, ...(x ? { a: x.id } : {}) }];
    await segnaAzioni(t, { [da]: true, fatte, scatto: fatte.some(y => y.k === 'scatto') });
    const quando = { round: T.stato?.round || 1, turno: T.stato?.turno || null };
    if (k === 'sch') await segna(t, { schivata: quando });
    if (k === 'aiu' && x) await segna(t, { aiuto: { ...quando, a: x.id, id: Date.now().toString(36) } });
    await annuncia(descriviAzione(t, k, da, x));
    if (k === 'nas') await tiraFurtivita(t);
    // il Disimpegno vale anche per lo spostamento ancora da confermare: si riscrive la richiesta senza l'avviso
    if (k === 'dis' && T.passo?.id === t.id) { const p = T.passo; T.passo = null; chiediPasso(t, p.x, p.y, p.x0, p.y0, p.m, p.dif); }
  }
  async function tiraFurtivita(t) {
    const s = schedaDi(t), mod = s ? abTot(s, 'furtivita') : 0, ai = aiutoPer(t);
    if (ai) usaAiuto(t, ai);
    await tira((ai ? '2d20kh1' : '1d20') + piuMod(mod), ai ? `vantaggio (aiutato da ${ai.h.nome})` : null, isDM() && !t.giocatore, `${t.nome || 'Token'} · Furtività (Nascondersi)`);
  }
  // segni che durano oltre il turno (Schivata, Aiuto): stanno sul token di chi li fa e valgono fino all'inizio del suo prossimo turno
  function segnoVivo(g) {
    if (!g || !T.stato?.turno) return false;
    const r = T.stato.round || 1; if (r === g.round) return true; if (r > g.round + 1 || r < g.round) return false;
    const L = ordinati(), i = L.findIndex(y => y.id === T.stato.turno), j = L.findIndex(y => y.id === g.turno);
    return j < 0 || i < j;
  }
  const segniDi = t => t?.azioni?.segni || {};
  async function segna(t, ch) {
    const prima = t.azioni, segni = { ...segniDi(t), ...ch };
    Object.keys(segni).forEach(k => { if (segni[k] == null) delete segni[k]; });
    t.azioni = { ...(t.azioni || {}), segni }; disegnaToken();
    const r = await SB.from('tavolo_token').update({ azioni: t.azioni }).eq('id', t.id);
    if (r.error) { t.azioni = prima; disegnaToken(); toast(r.error.message, 'err'); }
  }
  const schiva = t => segnoVivo(segniDi(t).schivata) && !condTok(t).some(c => FERMO.includes(c));
  // chi è aiutato: un altro token ha fatto Aiuto su di lui e lui non l'ha ancora usato
  function aiutoPer(t) {
    if (!t) return null; const usati = segniDi(t).usati || [];
    for (const h of T.tok.values()) { const g = segniDi(h).aiuto; if (h.id !== t.id && h.scena === t.scena && g?.a === t.id && segnoVivo(g) && !usati.includes(g.id)) return { h, id: g.id }; }
    return null;
  }
  const usaAiuto = (t, ai) => ai && segna(t, { usati: [...(segniDi(t).usati || []).slice(-9), ai.id] });
  // da che parte sta: personaggi e alleati contro gli altri
  const parte = o => o.giocatore || o.colore === '#3f7a4a' ? 'pg' : 'nem';
  // attacco di opportunità: un nemico che aveva il token entro 1,5 m e non ce l'ha più, se non si è disimpegnato
  function opportunita(t, x0, y0, x, y) {
    const sc = scena(); if (!sc || (azioniDi(t).fatte || []).some(f => f.k === 'dis')) return [];
    const da = { ...t, x: x0, y: y0 }, a = { ...t, x, y };
    return [...T.tok.values()].filter(o => { if (o.scena !== sc.id || o.id === t.id || parte(o) === parte(t) || (o.nascosto && !isDM()) || condTok(o).some(c => FERMO.includes(c))) return false; const p = pfDi(o); return (!p || p.pf > 0) && distanza(da, o, sc) <= 1.51 && distanza(a, o, sc) > 1.51; });
  }
  const puoDisimpegnarsi = t => { const a = azioniDi(t); if (!a.az) return 'az'; const b = bonusAz(t); return b && b.k.includes('dis') && !a.bon ? 'bon' : null; };
  function togliAzione(t, i) {
    const a = azioniDi(t), f = [...(a.fatte || [])], x = f.splice(i, 1)[0]; if (!x) return;
    segnaAzioni(t, { [x.da]: false, fatte: f, scatto: f.some(y => y.k === 'scatto') });
    if (x.k === 'sch') segna(t, { schivata: null }); if (x.k === 'aiu') segna(t, { aiuto: null });
  }
  // le azioni fatte in questo turno, da togliere con un tocco se segnate per sbaglio
  const fatteHtml = (t, cls, k) => (azioniDi(t).fatte || []).map((x, i) => { const [, ic, l] = voceAz(x.k), su = x.a && T.tok.get(x.a); return `<button type="button" class="${cls}" data-k="${k}" data-i="${i}" title="${l} (${x.da === 'bon' ? 'azione bonus' : x.da === 'rea' ? 'reazione' : 'azione'}): tocca per toglierla">${ic} ${l}${su ? ' → ' + esc(String(su.nome || '').split(/\s+/)[0]) : ''} ✕</button>`; }).join('');
  function menuAzioni(t, anc) {
    document.querySelectorAll('.tv-azm').forEach(x => x.remove());
    const a = azioniDi(t), b = bonusAz(t), m = document.createElement('div'); m.className = 'tv-azm'; m.setAttribute('role', 'menu');
    const voce = (k, da, off) => { const [, ic, l, d, lungo] = voceAz(k); return `<button type="button" role="menuitem" data-a="${k}" data-da="${da}" title="${lungo}"${off ? ' disabled' : ''}><span>${ic}</span><div><b>${l}</b><small>${d}</small></div></button>`; };
    // le azioni bonus e le reazioni dei privilegi arrivano con le regole: se non sono ancora caricate il menu si ridisegna appena ci sono
    const R = window.__regole, P = R ? [...privAzioni(R, schedaDi(t)?.dati || {}).values()] : [], pb = P.filter(x => x.tempo === 'bon' && !x.std), pr = [OPP, ...P.filter(x => x.tempo === 'rea')];
    const vp = (x, i, da, off) => `<button type="button" role="menuitem" data-p="${i}" data-da="${da}" title="${esc(x.testo)}"${off ? ' disabled' : ''}><span>${da === 'rea' ? '↺' : '✨'}</span><div><b>${esc(x.nome)}</b><small>${esc(corto(x.testo, 64))}</small></div></button>`;
    m.innerHTML = `<h5>Con l'azione${a.az ? ' <small>già usata</small>' : ''}</h5><div class="gz">${AZIONI.map(([k]) => voce(k, 'az', a.az)).join('')}</div>
      ${b || pb.length ? `<h5>Con l'azione bonus <small>${[b?.nome, a.bon ? 'già usata' : ''].filter(Boolean).join(' · ')}</small></h5><div class="gz">${b ? b.k.map(k => voce(k, 'bon', a.bon)).join('') : ''}${pb.map(x => vp(x, P.indexOf(x), 'bon', a.bon)).join('')}</div>` : ''}
      <h5>Con la reazione${a.rea ? ' <small>già usata</small>' : ''}</h5><div class="gz">${pr.map(x => vp(x, x === OPP ? 'opp' : P.indexOf(x), 'rea', a.rea)).join('')}</div>
      <p class="nota">Attaccare e lanciare incantesimi si fa dalla scheda. Le azioni scelte finiscono in chat.</p>`;
    document.body.append(m);
    const r = anc.getBoundingClientRect(), h = m.offsetHeight, w = m.offsetWidth;
    m.style.left = clamp(r.left + r.width / 2 - w / 2, 6, innerWidth - w - 6) + 'px';
    m.style.top = (r.top - h - 8 >= 6 ? r.top - h - 8 : clamp(r.bottom + 8, 6, innerHeight - h - 6)) + 'px';
    const chiudi = () => { m.remove(); removeEventListener('pointerdown', fuori, true); removeEventListener('keydown', tasto); };
    const fuori = e => { if (!m.contains(e.target) && !anc.contains(e.target)) chiudi(); };
    const tasto = e => { if (e.key === 'Escape') chiudi(); };
    addEventListener('pointerdown', fuori, true); addEventListener('keydown', tasto); onCleanup(chiudi);
    const chi = da => {
      const sc = scena(), L = sc ? [...T.tok.values()].filter(o => o.scena === sc.id && o.id !== t.id && !o.nascosto && parte(o) === parte(t) && !condTok(o).includes('Morto')).map(o => [o, distanza(t, o, sc)]).sort((p, q) => p[1] - q[1]) : [];
      m.innerHTML = `<h5>Chi aiuti?</h5><div class="gz">${L.map(([o, d]) => `<button type="button" data-o="${o.id}"><i style="--c:${esc(o.colore || '#7d2530')};${o.immagine ? `background-image:url('${o.immagine.replace(/'/g, '%27')}')` : ''}"></i><div><b>${esc(o.nome || 'Token')}</b><small>a ${metri(d)}</small></div></button>`).join('')}</div>${L.length ? '' : '<p class="nota">Nessun alleato sulla mappa.</p>'}<p class="nota">Avrà vantaggio alla prossima prova o al prossimo tiro per colpire.</p><button type="button" class="ind">← Indietro</button>`;
      m.querySelectorAll('[data-o]').forEach(y => y.onclick = () => { chiudi(); faiAzione(t, 'aiu', da, T.tok.get(y.dataset.o)); });
      m.querySelector('.ind').onclick = () => { chiudi(); menuAzioni(t, anc); };
      const h2 = m.offsetHeight; m.style.top = (r.top - h2 - 8 >= 6 ? r.top - h2 - 8 : clamp(r.bottom + 8, 6, innerHeight - h2 - 6)) + 'px';
      m.querySelector('[data-o]')?.focus();
    };
    m.querySelectorAll('[data-a]').forEach(x => x.onclick = () => { if (x.dataset.a === 'aiu') return chi(x.dataset.da); chiudi(); faiAzione(t, x.dataset.a, x.dataset.da); });
    m.querySelectorAll('[data-p]').forEach(x => x.onclick = () => { chiudi(); usaPriv(t, x.dataset.p === 'opp' ? OPP : P[+x.dataset.p], x.dataset.da); });
    m.querySelector('[data-a]:not([disabled])')?.focus();
    if (!R) regole().then(() => { if (m.isConnected) menuAzioni(t, anc); }, () => { });
  }

  // pozioni di cura: con l'azione bonus si tirano i dadi, con l'azione curano il massimo
  const POZIONI = [['pot_guarigione', 'Guarigione', '2d4+2'], ['pot_superiore', 'Guarigione superiore', '4d4+4'], ['pot_eccellente', 'Guarigione eccellente', '8d4+8'], ['pot_suprema', 'Guarigione suprema', '10d4+20']];
  const massimo = f => String(f).match(/(\d*)d(\d+)/g).reduce((x, m) => { const [n, fc] = m.split('d'); return x + (+n || 1) * +fc; }, 0) + (+(String(f).match(/[+-]\d+$/) || [0])[0]);
  function boxPozioni(s, w, dis) {
    return `<div class="sez poz">${POZIONI.map(([k, l, f]) => `<div class="pz"><span>🧪 ${l} <small>${f}</small></span><input type="number" data-f="${k}" min="0" step="1" placeholder="0" aria-label="Quante pozioni di ${l}"${dis}>${w ? `<button type="button" class="mini" data-k="bevi" data-p="${k}">Bevi</button>` : ''}</div>`).join('')}<h6>Pozioni di cura</h6></div>`;
  }
  async function bevi(s, k) {
    if (!(num(s.dati[k]) > 0)) return toast('Non ci sono pozioni di questo tipo: scrivi quante ne ha nella casella.', 'err');
    const [, l, f] = POZIONI.find(x => x[0] === k), max = massimo(f), tk = attaccante(s) || [...T.tok.values()].find(t => schedaDi(t)?.id === s.id && t.scena === scena()?.id);
    const d = openDlg(`<h3>Pozione di ${esc(l.toLowerCase())}</h3><p>Come la usa ${esc(s.nome)}?</p>
      <menu class="tv-pozm"><button class="btn" data-m="bon"><b>Azione bonus</b><small>tira ${f}</small></button><button class="btn" data-m="az"><b>Azione</b><small>cura il massimo: ${max}</small></button><button class="btn ghost" data-m="">Annulla</button></menu>`, 'tv-poz');
    const modo = await new Promise(res => { d.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { res(b.dataset.m); d.close(); }); d.addEventListener('close', () => res(''), { once: true }); });
    if (!modo) return;
    let cura = max;
    if (modo === 'bon') { const t = await tira(f, 'azione bonus', T.sv?.seg, `${s.nome} · Pozione di ${l.toLowerCase()}`); if (!t?.totale) return; cura = t.totale; }
    else await SB.rpc('tavolo_scrivi', { p_testo: `🧪 ${s.nome} beve una pozione di ${l.toLowerCase()} con un'azione: recupera ${max} punti ferita (il massimo).` });
    await salvaScheda(s.id, { [k]: Math.max(0, (num(s.dati[k]) || 0) - 1) }, true);
    if (tk && tk.pf_max != null) await cambiaPF(tk, cura); else await pfScheda(T.schede.get(s.id), cura);
    if (tk) segnaAzioni(tk, { [modo]: true });
    toast(`${s.nome} recupera ${cura} punti ferita.`);
  }
  // spostare le voci trascinandole dalla maniglia ⠿ (attacchi, privilegi, risorse)
  function trascinaVoce(e, h) {
    const sv = T.sv, item = h.closest('[data-ordi]'), list = item?.parentElement, campoL = list?.dataset.ord; if (!sv || !item || !campoL) return;
    e.preventDefault(); // ascolto la finestra: spostando la voce nel documento il puntatore catturato andrebbe perso
    item.classList.add('trascino'); sv.ordina = true;
    const muovi = ev => {
      const altri = [...list.children].filter(x => x !== item && x.dataset.ordi != null);
      const dopo = altri.find(x => { const r = x.getBoundingClientRect(); return ev.clientY < r.top + r.height / 2; });
      list.insertBefore(item, dopo || null);
    };
    const fine = () => {
      removeEventListener('pointermove', muovi); removeEventListener('pointerup', fine); removeEventListener('pointercancel', fine);
      item.classList.remove('trascino'); sv.ordina = false;
      const s = T.schede.get(sv.id); if (!s) return;
      const ordine = [...list.children].filter(x => x.dataset.ordi != null).map(x => +x.dataset.ordi), L = s.dati[campoL] || [];
      if (ordine.every((v, i) => v === [...ordine].sort((a, b) => a - b)[i])) return disegnaScheda();
      // nelle risorse si vedono solo alcune voci: le sposto tra loro lasciando le altre dove sono
      const posti = [...ordine].sort((a, b) => a - b), nuovo = [...L]; posti.forEach((p, i) => { nuovo[p] = L[ordine[i]]; });
      salvaScheda(s.id, { [campoL]: nuovo }, true); disegnaScheda();
    };
    addEventListener('pointermove', muovi); addEventListener('pointerup', fine); addEventListener('pointercancel', fine);
  }
  // grandezza del testo della scheda, per ognuno sul suo schermo
  const ZOOMS = 'tavolo-scheda-testo', TEMAS = 'tavolo-scheda-tema';
  // la scheda ha il suo tema: finché non lo si sceglie segue quello del sito
  const schedaScura = () => { let v = null; try { v = localStorage.getItem(TEMAS); } catch { } return v ? v === 'scuro' : document.documentElement.dataset.theme === 'dark'; };
  new MutationObserver(() => { if (T.sv) { T.sv.d.classList.toggle('tv-scuro', schedaScura()); const b = T.sv.d.querySelector('[data-k=tema]'); if (b) b.textContent = schedaScura() ? '☀' : '☾'; } }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const zoomScheda = () => { try { return clamp(+localStorage.getItem(ZOOMS) || 1, 0.8, 1.6); } catch { return 1; } };
  function applicaZoomScheda() { const c = T.sv?.d.querySelector('.corpo'); if (c) c.style.zoom = zoomScheda(); const o = T.sv?.d.querySelector('[data-k=zv]'); if (o) o.textContent = Math.round(zoomScheda() * 100) + '%'; }
  const n2 = (f, dis) => `<input type="number" data-f="${f}" class="pfi" step="1" aria-label="Punti ferita attuali"${dis}>`;
  // gli attacchi delle armi riconosciute si rimettono in pari con le regole appena la scheda si apre
  // l'ingranaggio della CA: armatura e scudo dal manuale (o dall'equipaggiamento), bonus magici e altri
  function pannelloCA(s, inp) {
    const R = REG(), d = s.dati, c = calcCA(s), eq = R ? armaturaEquip(s) : null;
    const tipo = a => a[2] === 'leggera' ? `${a[1]} + Des` : a[2] === 'media' ? `${a[1]} + Des (max +2)` : String(a[1]);
    const gr = (t, et) => `<optgroup label="${et}">${R.armature.filter(a => a[2] === t).map(a => `<option value="${esc(a[0])}">${esc(a[0])} · ${tipo(a)}</option>`).join('')}</optgroup>`;
    return `<div class="atcfg cacfg">
      <label class="lg"><span>Calcolo</span><select data-f="ca_auto"><option value="">Automatico dal manuale</option><option value="man">Manuale: la scrivo io</option></select></label>
      ${R && d.ca_auto !== 'man' ? `<label class="lg"><span>Armatura indossata</span><select data-f="armatura"><option value="">${eq.arm ? 'Dall\'equipaggiamento: ' + esc(eq.arm.a[0]) : 'Dall\'equipaggiamento: nessuna armatura'}</option><option value="nessuna">Nessuna armatura</option>${gr('leggera', 'Leggere')}${gr('media', 'Medie')}${gr('pesante', 'Pesanti')}</select></label>
      <label><span>Scudo</span><select data-f="scudo_ca"><option value="">Dall'equipaggiamento: ${eq.scudo ? 'sì' : 'no'}</option><option value="si">Sì, imbracciato</option><option value="no">No</option></select></label>
      ${c?.a ? `<label><span>Bonus magico armatura</span>${inp('ca_magia', '+0', '', 'number')}</label>` : ''}
      <label><span>Altri bonus</span>${inp('ca_bonus', '+0', '', 'number')}</label>
      <p class="conto" data-c="ca"></p>${c?.avv.length ? `<p class="avvca">${c.avv.map(x => '⚠ ' + esc(x)).join('<br>')}</p>` : ''}` : '<p class="conto">La CA la scrivi tu nel riquadro.</p>'}</div>`;
  }
  const allinea = s => { if (s && puoScrivere(s) && (attacchiCalcolati(s) || cambiaCA(s) != null)) salvaScheda(s.id, {}, true); };
  function disegnaScheda() {
    const sv = T.sv; if (!sv) return; const s = T.schede.get(sv.id); if (!s) { sv.d.close(); return; }
    const d = s.dati, w = puoScrivere(s), dis = w ? '' : ' disabled', pg = formaPg(s), foto = fotoScheda(s), tk = tokScheda();
    if (pg && !REG()) regole().then(() => { const x = T.sv && T.schede.get(T.sv.id); if (x) { allinea(x); disegnaScheda(); } }).catch(() => { });
    else if (pg && sv.allineata !== sv.id) { sv.allineata = sv.id; allinea(s); }
    const inp = (f, ph = '', cls = '', type = 'text', extra = '') => `<input type="${type}" data-f="${f}" class="${cls}" placeholder="${esc(ph)}" aria-label="${esc(ph)}"${extra}${dis}>`;
    const n = (f, ph, cls = '') => inp(f, ph, cls, 'number', ' step="1"');
    // una riga che va a capo e cresce con il testo (nomi e descrizioni degli attacchi)
    const testo = (f, ph, cls) => `<textarea data-f="${f}" class="auto ${cls}" rows="1" placeholder="${esc(ph)}" aria-label="${esc(ph)}"${dis}></textarea>`;
    const area = (f, ph, rows = 4) => `<textarea data-f="${f}" placeholder="${esc(ph)}" aria-label="${esc(ph)}" rows="${rows}"${dis}></textarea>`;
    const cella = (dentro, et) => `<div class="li">${dentro}<small>${et}</small></div>`;
    const box = (dentro, et, cls = '') => `<div class="sez ${cls}">${dentro}<h6>${et}</h6></div>`;
    // testata, come il riquadro in alto della scheda ufficiale
    const info = pg
      ? cella(`<span class="cl">${inp('classe', 'Classe')}${n('livello', 'Liv.', 'lv')}</span>`, 'Classe e livello') + cella(inp('background', 'Background'), 'Background') + cella(`<span class="ro">${esc(s.giocatore ? nomeGioc(s.giocatore) : 'DM')}</span>`, 'Nome del giocatore')
        + cella(inp('razza', 'Razza'), 'Razza') + cella(inp('allineamento', 'Allineamento'), 'Allineamento') + cella(n('pe', '0'), 'Punti esperienza')
      : cella(inp('taglia_tipo', 'Taglia e tipo'), 'Taglia e tipo') + cella(inp('gs', 'GS'), 'Grado di sfida') + cella(inp('allineamento', 'Allineamento'), 'Allineamento')
        + cella(inp('sensi', 'Scurovisione 18 m'), 'Sensi') + cella(inp('linguaggi', 'Comune'), 'Linguaggi') + cella(inp('difese', '—'), 'Resistenze e immunità');
    const conds = s.tipo !== 'pg' && tk ? condTok(tk) : d.condizioni || [];
    const cond = conds.map(c => `<button type="button" class="ch" data-cond="${esc(c)}" title="${w ? 'Togli' : ''}"${dis}>${esc(c)}${w ? ' ✕' : ''}</button>`).join('');
    let corpo = '';
    const tkT = tk || attaccante(s);
    if (sv.tab === 'pri' && !pg && !sv.edit) corpo = bloccoPng(s, tk, w, dis, cond, conds);
    else if (sv.tab === 'pri') {
      const car = CAR.map(([k, , nome]) => `<div class="cbox"><small>${nome}</small><button type="button" class="rb mod" data-roll="car:${k}" data-c="m:${k}" title="Prova di ${nome}"${dis}></button>${n(k, '10', 'ov')}</div>`).join('');
      const ts = CAR.map(([k, , nome]) => `<div class="r"><button type="button" class="pr" data-prof="ts_${k}"${dis}></button><em data-c="ts:${k}"></em><button type="button" class="lk" data-roll="ts:${k}"${dis}>${nome}</button></div>`).join('');
      const ab = ABIL.map(([k, nome, c]) => `<div class="r"><button type="button" class="pr" data-prof="ab_${k}"${dis}></button><em data-c="ab:${k}"></em><button type="button" class="lk" data-roll="ab:${k}"${dis}>${nome} <small>(${c.slice(0, 1).toUpperCase() + c.slice(1, 3)})</small></button></div>`).join('');
      const R = REG();
      // l'arma riconosciuta: proprietà come nel manuale e avvisi (competenza, armi pesanti per i Piccoli)
      const infoArma = x => {
        const wa = armaAtt(s, x); if (!wa) return '';
        const c = calcAtt(s, x), pr = propArma(wa), due = /a due mani/.test(pr) ? 'a due mani' : versatile(wa) ? (x.duemani ? 'impugnata a due mani' : 'a una mano (versatile)') : 'a una mano';
        const w2 = [`<b>${esc(wa[0])}</b>`, wa[3] === 'semplice' ? 'arma semplice' : 'arma da guerra', due, ...pr.split(/,\s*/).filter(p => p && !/a due mani|versatile/.test(p)), `${esc(c?.danni || wa[1])} ${esc(wa[2])}`, c ? 'usa ' + nomeCar(c.k) : ''].filter(Boolean);
        const avv = [c && !c.cp ? 'non competente: niente bonus di competenza' : '', /pesante/.test(pr) && piccolo(s) ? 'pesante: svantaggio per le creature Piccole' : ''].filter(Boolean);
        return `<div class="arma">${w2.map(t => `<span>${t}</span>`).join('')}${avv.map(t => `<span class="avv">⚠ ${t}</span>`).join('')}</div>`;
      };
      const opzArmi = R ? `<optgroup label="Armi semplici">${R.armi.filter(w => w[3] === 'semplice').map(w => `<option>${esc(w[0])}</option>`).join('')}</optgroup><optgroup label="Armi da guerra">${R.armi.filter(w => w[3] === 'guerra').map(w => `<option>${esc(w[0])}</option>`).join('')}</optgroup>` : '';
      const at = (d.attacchi || []).map((x, i) => `<div class="at" data-ordi="${i}"><div class="riga">${w ? '<span class="mano" title="Trascina per spostare" aria-hidden="true">⠿</span>' : ''}${testo(`att.${i}.nome`, 'Arma', 'an')}${inp(`att.${i}.colpire`, '+0', 'ac', 'number')}${inp(`att.${i}.danni`, '1d6+1', 'ad')}</div>
          <div class="riga az">${testo(`att.${i}.tipo`, 'Tipo e note', 'tp')}${bonusDadi(x) ? `<span class="bon" title="Danni bonus: si tirano insieme ai danni">+ ${esc(bonusDadi(x))} ${esc(bonusNome(x).replace(/^danni /, ''))}</span>` : ''}<button type="button" class="mini" data-roll="att:${i}"${dis} title="Tiro per colpire">🎯 Colpisci</button><button type="button" class="mini" data-roll="dan:${i}"${dis} title="Danni">💥 Danni</button><button type="button" class="mini" data-roll="cri:${i}"${dis} title="Critico: dadi dei danni raddoppiati">✖2 Critico</button>${w ? `<button type="button" class="mini cfg${sv.matt === i ? ' on' : ''}" data-k="attcfg" data-i="${i}" title="Modifica: caratteristica (Forza, Destrezza…), competenza, dado e bonus magico" aria-label="Modifica l'attacco" aria-expanded="${sv.matt === i}">⚙</button><button type="button" class="mini via" data-k="delatt" data-i="${i}" title="Togli l'attacco" aria-label="Togli l'attacco">🗑</button>` : ''}</div>
          ${infoArma(x)}${String(x.desc || '').trim() && !(w && sv.matt === i) ? `<p class="atdesc">${esc(x.desc)}</p>` : ''}
          ${w && sv.matt === i ? (wa => `<div class="atcfg"><label class="lg"><span>Descrizione dell'oggetto (armi particolari, proprietà magiche…)</span><textarea data-f="att.${i}.desc" class="auto" rows="2" placeholder="Es. lama di ghiaccio forgiata dai nani: brilla al buio e…"></textarea></label>${R ? `<label class="lg"><span>Arma del manuale</span><select data-f="att.${i}.arma"><option value="">${wa && !x.arma ? 'Riconosciuta dal nome: ' + esc(wa[0]) : 'Dal nome (nessuna arma riconosciuta)'}</option>${opzArmi}</select></label>` : ''}
            <label><span>Caratteristica</span><select data-f="att.${i}.car">${CAR_ATT.map(([v, l]) => `<option value="${v}">${v === '' ? (wa ? `Automatica: ${nomeCar(carArma(s, wa))}` : 'Automatica: nessuna arma, scrivi tu') : l}</option>`).join('')}</select></label>
            ${wa ? (versatile(wa) ? `<label class="ck"><input type="checkbox" data-f="att.${i}.duemani"> Impugnata a due mani: ${esc(versatile(wa))} invece di ${esc(wa[1])}</label>` : '') : `<label><span>Dado dei danni</span>${inp(`att.${i}.dado`, '1d8')}</label>`}
            <label><span>Competenza</span><select data-f="att.${i}.comp_att"><option value="">${wa ? `Automatica: ${calcAtt(s, x)?.cp ? 'sì' : 'no'} (${formaPg(s) ? 'classe e razza' : 'PNG, sempre competente'})` : 'Sì'}</option><option value="si">Sì, competente</option><option value="no">No, non competente</option></select></label>
            <label><span>Bonus magico</span>${inp(`att.${i}.magia`, '+0', '', 'number')}</label>
            <label><span>Danni bonus</span>${inp(`att.${i}.bdadi`, '1d6')}</label><label><span>Tipo dei danni bonus</span><select data-f="att.${i}.btipo"><option value="">—</option>${TIPI_DANNO.map(([v]) => `<option value="${v}">${v[0].toUpperCase() + v.slice(1)}</option>`).join('')}</select></label>
            <p class="conto" data-c="att:${i}"></p></div>`)(armaAtt(s, x)) : ''}</div>`).join('');
      const pf = `<div class="pfmax"><span>Punti ferita massimi</span>${n(tk ? 'tok.pf_max' : 'pf_max', '—')}</div>${n(tk ? 'tok.pf' : 'pf', '—', 'pfa')}
        ${w ? '<div class="q"><button type="button" data-k="pfm" title="Danni">− Danni</button><input type="number" data-k="pfq" value="1" min="1" aria-label="Quanti punti"><button type="button" data-k="pfp" title="Cura">+ Cura</button></div>' : ''}`;
      corpo = `${!pg ? '<button type="button" class="mini agg fine" data-k="fine">✓ Fatto: torna al blocco delle statistiche</button>' : ''}<div class="p1">
        <div class="colA">
          <div class="dueA"><div class="carcol">${car}</div>
            <div class="altA">
              ${pg ? `<div class="pill isp"><input type="number" class="pv" data-f="ispirazione" min="0" step="1" placeholder="0" aria-label="Punti ispirazione"${dis}><span>Ispirazione</span></div>` : ''}
              <div class="pill"><b class="pv" data-c="comp"></b><span>Bonus di competenza</span></div>
              ${box(ts, 'Tiri salvezza', 'lista')}${box(ab, 'Abilità', 'lista')}
            </div></div>
          <div class="pill largo"><b class="pv" data-c="pp"></b><span>Saggezza passiva (Percezione)</span></div>
          ${box(area(pg ? 'lingue' : 'competenze', pg ? 'Armature, armi, strumenti, linguaggi…' : 'Altre competenze…', 5), pg ? 'Altre competenze e linguaggi' : 'Altre competenze')}
        </div>
        <div class="colB">
          <div class="grigio">
            <div class="tre"><div class="scudo">${n('ca', '10')}<small>Classe armatura</small>${pg && w ? `<button type="button" class="mini cfg cacfgb${sv.mca ? ' on' : ''}" data-k="cacfg" title="Modifica la CA: armatura, scudo, bonus" aria-label="Modifica la classe armatura" aria-expanded="${!!sv.mca}">⚙</button>` : ''}</div>
              <div class="qq"><button type="button" class="rb" data-roll="iniz" data-c="iniz" title="Tira l'iniziativa"${dis}></button><small>Iniziativa</small></div>
              <div class="qq">${inp('velocita', '9 m')}<small>Velocità</small></div></div>
            ${pg && w && sv.mca ? pannelloCA(s, inp) : ''}
            <div class="sez pf">${pf}<h6>${tk ? 'Punti ferita di ' + esc(tk.nome || 'questo token') : 'Punti ferita attuali'}</h6></div>
            ${tk ? '' : box(n('pf_temp', '0', 'pfa piccolo'), 'Punti ferita temporanei', 'pf')}
            <div class="due"><div class="sez"><div class="dvt"><span>Totale</span>${inp('dadi_vita', pg ? '5d10' : '2d8+2')}${isDM() && !pg ? '<button type="button" class="mini" data-k="tirapf" title="Tira i PF massimi con i dadi vita (tiro nascosto)">🎲</button>' : ''}</div>${pg ? n('dv_rest', '—', 'pfa piccolo') : ''}<h6>Dadi vita</h6></div>
              <div class="sez morte">${pg ? `<div class="r"><span>Successi</span><span class="dots" data-dots="morte_ok"></span></div><div class="r"><span>Fallimenti</span><span class="dots ko" data-dots="morte_ko"></span></div><button type="button" class="mini" data-roll="morte"${dis}>🎲 Tira</button>` : `<div class="cnd">${cond || '<span class="vuoto">Nessuna</span>'}</div>`}<h6>${pg ? 'Tiri salvezza contro la morte' : 'Condizioni'}</h6></div></div>
          </div>
          ${pg ? boxRisorse(s, w, dis) : ''}
          <div class="sez atts"><div class="th"><span>Nome</span><span>Bonus</span><span>Danni</span></div><div data-ord="attacchi">${at || '<p class="vuoto">Nessun attacco.</p>'}</div>
            ${w ? '<button type="button" class="mini agg" data-k="addatt">+ Aggiungi un attacco</button>' : ''}${pg ? '' : area('azioni', 'Multiattacco, reazioni, azioni speciali…', 3)}<h6>Attacchi e incantesimi</h6></div>
          ${boxExtra(s, w, dis)}
          ${pg ? `<div class="sez eq"><div class="mon"><label title="Monete d'oro"><span>MO</span>${n('mo', '0')}</label></div>${area('equip', 'Armi, armatura, oggetti…', 7)}<h6>Equipaggiamento</h6></div>${boxPozioni(s, w, dis)}` : ''}
        </div>
        <div class="colC">
          ${boxPrivilegi(s, w, dis)}
          ${pg ? `<div class="grigio tratti">${[['personalita', 'Tratti caratteriali'], ['ideali', 'Ideali'], ['legami', 'Legami'], ['difetti', 'Difetti']].map(([k, l]) => box(area(k, '', 3), l)).join('')}</div>` : ''}
          ${pg ? `<div class="sez"><div class="cnd">${cond || '<span class="vuoto">Nessuna</span>'}</div>${w ? `<select data-k="cond" aria-label="Aggiungi una condizione"><option value="">+ Condizione</option>${CONDIZIONI.filter(c => !conds.includes(c)).map(c => `<option>${c}</option>`).join('')}</select>` : ''}<h6>Condizioni</h6></div>`
            : w ? `<select data-k="cond" class="selc" aria-label="Aggiungi una condizione"><option value="">+ Condizione</option>${CONDIZIONI.filter(c => !conds.includes(c)).map(c => `<option>${c}</option>`).join('')}</select>` : ''}
        </div></div>`;
    } else if (sv.tab === 'inc') {
      if (!T.srd) manuale().then(m => { if (m && T.sv?.tab === 'inc') disegnaScheda(); });
      const daCompl = (d.incantesimi || []).filter(dalManuale).length;
      const IL = (d.incantesimi || []).map((sp, j) => [sp, j]), vecchi = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].some(i => String(d['inc_' + i] || '').trim());
      const liv = i => { const voci = IL.filter(([sp]) => (num(sp.livello) || 0) === i); return `<div class="sez lv"><div class="lt"><b>${i || '0'}</b>${i ? `<span>Slot</span>${n('slot_' + i, '0', 'sn')}<span class="dots" data-dots="usati_${i}"></span>` : '<span>Trucchetti</span>'}</div>
        <div class="pl incL" data-ord="incantesimi">${voci.map(([sp, j]) => voceInc(s, sp, j, w, dis)).join('')}</div>
        ${String(d['inc_' + i] || '').trim() ? area('inc_' + i, i ? 'Incantesimi di ' + i + '° livello' : 'Trucchetti', 3) : ''}
        ${w ? `<button type="button" class="mini agg" data-k="inc-add" data-l="${i}">+ ${i ? 'Incantesimo' : 'Trucchetto'}</button>` : ''}</div>`; };
      corpo = `<div class="incT"><div class="li grande"><select data-f="car_inc"${dis}>${['int', 'sag', 'car'].map(k => `<option value="${k}">${CAR.find(x => x[0] === k)[2]}</option>`).join('')}</select><small>Caratteristica da incantatore</small></div>
          <div class="li grande"><b data-c="cd"></b><small>CD tiro salvezza</small></div>
          <div class="li grande"><button type="button" class="rb" data-roll="inc" data-c="inc" title="Tiro per colpire con un incantesimo"${dis}></button><small>Bonus di attacco</small></div></div>
        ${w ? '<button type="button" class="mini agg" data-k="riposo" title="Azzera gli slot usati">🌙 Riposo lungo: azzera gli slot</button>' : ''}
        ${vecchi && w ? '<div class="vec"><p>Qui ci sono ancora gli incantesimi scritti come testo: trasformali in voci da aprire, modificare e lanciare (una riga, un incantesimo).</p><button type="button" class="mini" data-k="inc-conv">✨ Trasforma in voci</button></div>' : ''}
        ${daCompl && w ? `<div class="vec"><p>${daCompl === 1 ? 'Un incantesimo non ha' : daCompl + ' incantesimi non hanno'} ancora la descrizione, ma ${daCompl === 1 ? 'è' : 'sono'} nel manuale.</p><button type="button" class="mini" data-k="inc-srd-tutti">📖 Completa dal manuale</button></div>` : ''}
        <div class="incG">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(liv).join('')}</div>
        ${T.srd && (d.incantesimi || []).some(x => x.srd) ? `<p class="srdA">${esc(T.srd.attribuzione)}</p>` : ''}`;
    } else {
      corpo = pg ? `<div class="bgT">${[['eta', 'Età'], ['altezza', 'Altezza'], ['peso', 'Peso'], ['occhi', 'Occhi'], ['pelle', 'Pelle'], ['capelli', 'Capelli']].map(([k, l]) => cella(inp(k, ''), l)).join('')}${cella(`<select data-f="genere" aria-label="Il personaggio è"${dis}><option value="">Lui</option><option value="f">Lei</option></select>`, 'Lui o lei')}</div>
        <div class="bgG">${box(area('aspetto', 'Come appare il personaggio…', 6), 'Aspetto del personaggio')}${box(area('alleati', 'Gilde, ordini, amici e nemici…', 6), 'Alleati e organizzazioni')}
          ${box(area('storia', 'La storia del personaggio…', 9), 'Storia del personaggio')}${box(area('tesoro', 'Gemme, oggetti di valore…', 9), 'Tesoro')}</div>${box(area('note', 'Appunti…', 5), 'Note')}`
        : `${box(area('note', 'Note del DM: tattiche, motivazioni, bottino…', 12), 'Note del DM')}`;
    }
    const root = sv.d.querySelector('.tv-sch');
    root.className = 'tv-sch ' + (pg ? 'pg' : 'png');
    root.innerHTML = `<div class="tbar"${sv.pag || sv.chat ? '' : ' title="Trascina per spostare la scheda"'}>${sv.pag || sv.chat ? '' : '<span class="grip">⠿</span>'}<span class="tt">${pg ? 'Scheda del personaggio' : 'Scheda del PNG'}</span>
        <span class="seg3">${w ? '<button type="button" data-adv="0" title="Tiro normale">Normale</button><button type="button" data-adv="1">Vantaggio</button><button type="button" data-adv="2">Svantaggio</button>' : ''}</span>
        ${w ? `<button type="button" class="sg ${sv.seg ? 'on' : ''}" data-k="seg" aria-pressed="${!!sv.seg}" title="${segTitolo(sv.seg)}">${sv.seg ? '🙈 Tiri nascosti' : '👁 Tiri visibili'}</button>` : ''}
        <button type="button" class="tema" data-k="tema" title="Scheda chiara o scura, indipendente dal tema del sito (solo per te)" aria-label="Cambia il tema della scheda">${schedaScura() ? '☀' : '☾'}</button>
        <span class="zt" title="Grandezza del testo della scheda (solo per te)"><button type="button" data-k="za" data-d="-0.1" aria-label="Testo più piccolo">A−</button><span data-k="zv"></span><button type="button" data-k="za" data-d="0.1" aria-label="Testo più grande">A+</button></span>
        <button type="button" class="piu" data-k="piu" aria-label="Altre opzioni" title="Altre opzioni">⋯</button><button type="button" class="x" data-k="chiudi" aria-label="Chiudi la scheda">✕</button></div>
      <div class="testa"><div class="nome">${isDM() ? '<label class="ft cambia" title="Clicca per scegliere la foto"' : '<i class="ft"'} style="${foto ? `background-image:url('${esc(foto)}')` : `--c:${pg ? '#7d2530' : '#5b6670'}`}">${foto ? '' : isDM() ? '<span class="piu">📷<small>Foto</small></span>' : esc(iniziali(s.nome))}${isDM() ? '<input type="file" accept="image/*" data-k="img" hidden></label>' : '</i>'}
          <div class="ban">${isDM() ? inp('nome', 'Nome', 'nm') : `<b class="nm">${esc(s.nome)}</b>`}<small>${pg ? 'Nome del personaggio' : 'Nome del PNG'}</small></div></div>
        <div class="info">${info}</div></div>
      <div class="tabs" role="tablist">${[['pri', pg ? 'Personaggio' : 'Statistiche'], ['inc', 'Incantesimi'], ['bg', pg ? 'Background e note' : 'Note']].map(([k, l]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${sv.tab === k}" class="${sv.tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      ${pg ? barraGuida(s, w) : ''}
      <div class="corpo">${corpo}</div>
      ${isDM() ? `<div class="fd">${s.tipo === 'png' ? `<button type="button" class="mini" data-k="forma" title="${pg ? 'Passa al blocco delle statistiche da PNG' : 'Passa alla scheda completa, come quella di un giocatore'}">${pg ? '📋 Scheda da PNG' : '📜 Scheda completa'}</button><button type="button" class="mini" data-k="vis">${s.nascosta ? '🙈 Nascosta ai giocatori' : '👁 La vedono i giocatori'}</button>${scena() ? '<button type="button" class="mini" data-k="metti">＋ Metti un token sulla mappa</button>' : ''}<button type="button" class="mini" data-k="svuota" title="Cancella tutto e ricrea la scheda da capo: vuota, completa o da una foto">🧹 Svuota scheda</button>
          <label class="mini aff" title="Il giocatore scelto la vede, la compila e muove i suoi token, oltre al proprio personaggio">🎮 La usa <select data-k="affida" aria-label="Affida la scheda a un giocatore"><option value="">solo il DM</option>${(T.info.giocatori || []).map(g => `<option value="${esc(g.id)}"${s.assegnata === g.id ? ' selected' : ''}>${esc(g.name)}</option>`).join('')}</select></label>` : '<span class="vuoto">La compila anche il giocatore, dal vivo.</span>'}</div>` : (w ? '' : '<p class="vuoto fd">Scheda mostrata dal DM: puoi solo leggerla.</p>')}`;
    riempi(); applicaZoomScheda(); sv.d.classList.toggle('tv-scuro', schedaScura());
  }
  function campo(el, scelto = false) {
    const sv = T.sv, s = sv && T.schede.get(sv.id); if (!s || !puoScrivere(s)) return;
    const f = el.dataset.f, v = el.type === 'checkbox' ? el.checked : el.type === 'number' ? num(el.value) : el.value;
    if (f === 'nome') {
      clearTimeout(sv.nt); const nome = String(v).trim().slice(0, 80); if (!nome) return;
      s.nome = nome; sv.nt = setTimeout(async () => { const r = await SB.from('tavolo_schede').update({ nome }).eq('id', s.id); if (r.error) toast(r.error.message, 'err'); disegnaSchede(); }, 600); return;
    }
    if (f.startsWith('tok.')) {
      const t = tokScheda(); if (!t) return; const k = f.slice(4), ch = { [k]: v };
      if (k === 'pf' && t.pf_max == null) ch.pf_max = num(s.dati.pf_max);
      Object.assign(t, ch); disegnaToken(); clearTimeout(sv.tt);
      sv.tt = setTimeout(async () => { const r = await SB.from('tavolo_token').update(ch).eq('id', t.id); if (r.error) toast(r.error.message, 'err'); }, 500); return;
    }
    if (f.startsWith('prv.')) { const [, i, k] = f.split('.'), a = (s.dati.privilegi || []).map(x => ({ ...x })); if (!a[i]) return; a[i][k] = v; const p2 = salvaScheda(s.id, { privilegi: a }, ['eff', 'ts_car'].includes(k)); if (['eff', 'ts_car'].includes(k)) p2.then(() => disegnaScheda()); return; }
    if (f.startsWith('inc.')) {
      const [, i, k] = f.split('.'), a = (s.dati.incantesimi || []).map(x => ({ ...x })); if (!a[i]) return;
      a[i][k] = k === 'livello' ? +v || 0 : v;
      const x = k === 'nome' && (scelto || !el.matches(':focus')) && dalManuale(a[i]);
      if (x) { a[i] = daManuale(a[i], x); if (sv.minc === (a[i].id)) sv.minc = null; (sv.aperti = sv.aperti || new Set()).add(a[i].id); salvaScheda(s.id, { incantesimi: a }, true).then(() => disegnaScheda()); return; }
      // cambiando livello l'incantesimo passa in un altro riquadro
      if (k === 'livello' || k === 'scuola' || el.type === 'checkbox') { salvaScheda(s.id, { incantesimi: a }, true).then(() => disegnaScheda()); return; }
      salvaScheda(s.id, { incantesimi: a }); return;
    }
    if (f.startsWith('att.')) {
      const [, i, k] = f.split('.'), a = (s.dati.attacchi || []).map(x => ({ ...x })); if (!a[i]) return; a[i][k] = v;
      if (k === 'comp_att') delete a[i].nocomp;
      if (k === 'arma' && v && (!String(a[i].nome || '').trim() || armaAtt(s, { ...a[i], arma: '' }))) a[i].nome = v;
      salvaScheda(s.id, { attacchi: a });
      // le scelte dell'ingranaggio cambiano anche la riga dell'attacco (danni bonus)
      if (['car', 'btipo', 'comp_att', 'arma', 'duemani'].includes(k) || k === 'nome' && !el.matches(':focus') || (k === 'bdadi' && !el.matches(':focus'))) disegnaScheda(); return;
    }
    salvaScheda(s.id, { [f]: v });
    if (['ca_auto', 'armatura', 'scudo_ca'].includes(f) || (f === 'equip' && sv.mca && !el.matches(':focus'))) disegnaScheda();
  }
  function tiroD20(s, mod, cosa, aiutabile) {
    const sv = T.sv, tk = aiutabile && sv.adv !== 2 ? tokScheda() || attaccante(s) : null, ai = tk ? aiutoPer(tk) : null, adv = ai ? 1 : sv.adv;
    if (ai) usaAiuto(tk, ai);
    const f = (adv === 1 ? '2d20kh1' : adv === 2 ? '2d20kl1' : '1d20') + piu(mod);
    return tira(f, adv === 1 ? 'vantaggio' + (ai ? ` (aiutato da ${ai.h.nome})` : '') : adv === 2 ? 'svantaggio' : null, sv.seg, s.nome + ' · ' + cosa);
  }
  // l'iniziativa dalla scheda entra nell'ordine del turno per ogni suo token sulla mappa
  async function inizScheda(s) {
    const sc = scena(), mod = modC(s.dati.des), tk = tokScheda();
    const toks = tk ? [tk] : sc ? [...T.tok.values()].filter(t => t.scena === sc.id && schedaDi(t)?.id === s.id && puoMuovere(t)) : [];
    if (!toks.length) return tiroD20(s, mod, 'Iniziativa');
    const da = toks.filter(t => !T.turno.some(x => x.token === t.id));
    if (!da.length) return iniziativa(toks[0], mod);
    for (const t of da) await iniziativa(t, mod);
  }
  // i tiri fatti dalla scheda: visibili a tutti o nascosti (solo il DM, o il giocatore e il DM)
  const segTitolo = on => on ? (isDM() ? 'I tiri di questa scheda li vedi solo tu. Tocca per mostrarli a tutti' : 'I tiri di questa scheda li vedete solo tu e il DM. Tocca per mostrarli a tutti') : 'I tiri di questa scheda li vedono tutti. Tocca per nasconderli';
  const critico = f => String(f).replace(/(\d*)d(\d+)/gi, (_, n, fc) => (2 * (+n || 1)) + 'd' + fc);
  async function azioneScheda(b) {
    const sv = T.sv, s = sv && T.schede.get(sv.id); if (!s) return;
    const d = s.dati, w = puoScrivere(s), k = b.dataset.k;
    if (k === 'chiudi') return sv.d.close();
    if (k === 'piu') { b.closest('.tbar').classList.toggle('aperta'); return; }
    if (k === 'modifica' || k === 'fine') { sv.edit = k === 'modifica'; return disegnaScheda(); }
    if (b.dataset.tab) { sv.tab = b.dataset.tab; return disegnaScheda(); }
    if (b.dataset.adv) { sv.adv = +b.dataset.adv; return riempi(); }
    if (k === 'seg') { sv.seg = !sv.seg; b.classList.toggle('on', sv.seg); b.setAttribute('aria-pressed', sv.seg); b.title = segTitolo(sv.seg); b.textContent = sv.seg ? '🙈 Tiri nascosti' : '👁 Tiri visibili'; return; }
    if (k && k.startsWith('dx-')) {
      const L = extraDi(s), x = L.find(y => y.id === b.dataset.id);
      if (k === 'dx-tira') return x?.dadi ? tira(x.dadi, null, sv.seg, `${s.nome} · ${x.nome || 'Danno aggiuntivo'}`) : toast('Scrivi prima i dadi, per esempio 2d6', 'err');
      if (!w) return;
      if (k === 'dx-add') { L.push({ id: nuovoId(), nome: '', dadi: '', attivo: false }); await salvaExtra(s, L); return sv.d.querySelector('.dxs .dx:last-of-type .dxn')?.focus(); }
      if (!x) return;
      if (k === 'dx-on') { x.attivo = b.checked; return salvaExtra(s, L); }
      if (k === 'dx-nome') { x.nome = b.value.trim().slice(0, 60); return salvaExtra(s, L); }
      // dadi scritti a mano: non seguono più quelli del privilegio
      if (k === 'dx-dadi') { x.dadi = b.value.replace(/\s+/g, '').slice(0, 30); delete x.da; return salvaExtra(s, L); }
      if (k === 'dx-via') {
        if (!await ask(`Togliere **${x.nome || 'questo danno aggiuntivo'}** dal modificatore danno aggiuntivo?`, { ok: 'Togli', danger: true, title: 'Togli' })) return;
        // se viene da un privilegio, il privilegio non lo aggiunge più
        if (x.da || x.id.startsWith('p-')) { const P = (d.privilegi || []).map(p => (x.da ? p.id === x.da : norm(p.nome) === norm(x.nome)) ? { ...p, extra: false } : p); await salvaScheda(s.id, { privilegi: P }, true); }
        return salvaExtra(s, L.filter(y => y !== x));
      }
      return;
    }
    if (k === 'tema') { try { localStorage.setItem(TEMAS, schedaScura() ? 'chiaro' : 'scuro'); } catch { } return disegnaScheda(); }
    if (k === 'za') { try { localStorage.setItem(ZOOMS, clamp(Math.round((zoomScheda() + +b.dataset.d) * 10) / 10, 0.8, 1.6)); } catch { } return applicaZoomScheda(); }
    if (k === 'g-crea') return apriGuida(s, 'crea');
    if (k === 'g-liv') return apriGuida(s, 'liv');
    if (k === 'g-concedi' && isDM()) return concediLivello([s]);
    if (k === 'g-ritira' && isDM()) return concediLivello([s], true);
    if (k === 'g-storia') return apriStoria(s);
    if (sv.pag && (b.dataset.roll || ['prv-dadi', 'inc-lancia', 'inc-chat', 'tirapf', 'bevi'].includes(k))) return;
    const P = d.privilegi || [], pi = +b.dataset.i, pv = P[pi], chiave = pv && (pv.id || 'i' + pi);
    if (k === 'prv-apri' && pv) { sv.aperti = sv.aperti || new Set(); sv.aperti.has(chiave) ? sv.aperti.delete(chiave) : sv.aperti.add(chiave); return disegnaScheda(); }
    if (k === 'prv-dadi' && pv) return tira(pv.dadi, null, sv.seg, `${s.nome} · ${pv.nome || 'Privilegio'}`);
    const I = d.incantesimi || [], sp = I[pi], ckey = sp && (sp.id || 'n' + pi);
    if (k === 'inc-apri' && sp) { sv.aperti = sv.aperti || new Set(); sv.aperti.has(ckey) ? sv.aperti.delete(ckey) : sv.aperti.add(ckey); return disegnaScheda(); }
    if (k === 'inc-lancia' && sp) return lanciaInc(s, pi);
    if (k === 'inc-chat' && sp) {
      const lv = num(sp.livello) || 0, r = [`📖 ${sp.nome || 'Incantesimo'}`, `${sp.scuola || ''}${lv ? ` di ${lv}° livello` : ' (trucchetto)'}`.trim(),
        ...[['Tempo di lancio', sp.tempo], ['Portata', sp.portata], ['Area', sp.area], ['Componenti', sp.componenti], ['Durata', (sp.conc ? 'Concentrazione' + (sp.durata ? ', ' : '') : '') + (sp.durata || '')]].filter(([, v]) => String(v || '').trim()).map(([l, v]) => `${l}: ${v}`),
        String(sp.testo || '').replace(/\*\*/g, '').trim()].filter(Boolean);
      const e = await SB.rpc('tavolo_scrivi', { p_testo: r.join('\n') }); if (e.error) toast(e.error.message, 'err'); return;
    }
    if (b.dataset.roll) {
      const [r, a] = b.dataset.roll.split(':'), ca = CAR.find(x => x[0] === a), at = (d.attacchi || [])[a];
      if (r === 'car') return tiroD20(s, modC(d[a]), 'Prova di ' + ca[2], true);
      if (r === 'ts') return tiroD20(s, tsTot(s, a), 'Tiro salvezza su ' + ca[2]);
      if (r === 'ab') return tiroD20(s, abTot(s, a), ABIL.find(x => x[0] === a)[1], true);
      if (r === 'iniz') return inizScheda(s);
      if (r === 'inc') return tiroD20(s, comp(s) + modC(d[carInc(s)]), 'Attacco con incantesimo', true);
      if (r === 'txt') return tira(a, null, sv.seg, s.nome);
      if (r === 'morte') return tira('1d20', null, sv.seg, s.nome + ' · Tiro contro la morte');
      if (!at) return;
      if (r === 'att') {
        // un attacco che è un incantesimo della scheda (di 1° livello o più) si lancia da lì: si sceglie lo slot
        const ii = incDaAtt(s, at); if (ii >= 0) return lanciaInc(s, ii);
        // con un token sulla mappa si sceglie il bersaglio; senza, è un tiro per colpire come prima
        const tk = attaccante(s); if (tk && T.mira?.tok !== tk.id) return iniziaMira(s, +a, tk);
        if (!tk && scena() && [...T.tok.values()].filter(t => t.scena === scena().id && schedaDi(t)?.id === s.id).length > 1) toast('Per scegliere il bersaglio apri la scheda dal token che attacca.');
        return tiroD20(s, num(at.colpire) || 0, 'Attacco: ' + (at.nome || 'arma'), true);
      }
      if (r === 'dan' || r === 'cri') {
        const cr = r === 'cri' || T.maiusc, bd = bonusDadi(at); if (!String(at.danni || '').trim()) return toast('Scrivi i danni dell\'attacco, per esempio 1d8+3', 'err');
        const t = await tira(cr ? critico(at.danni) : at.danni, cr ? 'critico' : null, sv.seg, `${s.nome} · Danni: ${at.nome || 'arma'}${at.tipo ? ' (' + at.tipo + ')' : ''}`);
        if (t && bd) await tira(cr ? critico(bd) : bd, cr ? 'critico' : null, sv.seg, `${s.nome} · ${bonusNome(at)[0].toUpperCase() + bonusNome(at).slice(1)}: ${at.nome || 'arma'}`);
        if (t) for (const x of extraDi(s).filter(x => x.attivo && x.dadi)) await tira(cr ? critico(x.dadi) : x.dadi, cr ? 'critico' : null, sv.seg, `${s.nome} · ${x.nome || 'Danno aggiuntivo'}: ${at.nome || 'arma'}`);
        return t;
      }
      return;
    }
    if (!w) return;
    if (b.dataset.prof) { const p = b.dataset.prof, v = num(d[p]) || (d[p] === true ? 1 : 0); return salvaScheda(s.id, { [p]: p.startsWith('ts_') ? !v : (v + 1) % 3 }); }
    if (b.dataset.dot) { const i = +b.dataset.i, v = num(d[b.dataset.dot]) || 0; return salvaScheda(s.id, { [b.dataset.dot]: v >= i ? i - 1 : i }); }
    if (b.dataset.cond || k === 'cond') {
      const tk = s.tipo === 'png' ? tokScheda() : null, ora = tk ? condTok(tk) : d.condizioni || [];
      if (k === 'cond' && !b.value) return;
      await cambiaCond(s, tk, b.dataset.cond ? ora.filter(c => c !== b.dataset.cond) : [...ora, b.value]); return disegnaScheda();
    }
    const salvaP = (L, subito = true) => salvaScheda(s.id, { privilegi: L }, subito).then(() => disegnaScheda());
    const salvaI = L => salvaScheda(s.id, { incantesimi: L }, true).then(() => disegnaScheda());
    if (k === 'inc-mod' && sp) { sv.minc = sv.minc === ckey ? null : ckey; if (!sp.id) { const L = I.map(x => ({ ...x })); L[pi].id = nuovoId(); if (sv.minc) sv.minc = L[pi].id; return salvaI(L); } return disegnaScheda(); }
    if (k === 'inc-srd' && sp) { const x = dalManuale(sp); if (!x) return; const L = I.map(y => ({ ...y })); L[pi] = daManuale(sp, x); if (sv.minc === ckey) sv.minc = null; (sv.aperti = sv.aperti || new Set()).add(L[pi].id); return salvaI(L); }
    if (k === 'inc-srd-tutti') { let n = 0; const L = I.map(y => { const x = dalManuale(y); if (!x) return { ...y }; n++; return daManuale(y, x); }); if (!n) return; await salvaI(L); return toast(`${n} incantesimi completati dal manuale.`); }
    if (k === 'inc-prep' && sp) { const L = I.map(x => ({ ...x })); L[pi].prep = !L[pi].prep; return salvaI(L); }
    if (k === 'inc-via' && sp) { if (!await ask(`Eliminare **${sp.nome || 'questo incantesimo'}**?`, { ok: 'Elimina', danger: true, title: 'Incantesimi' })) return; sv.minc = null; return salvaI(I.filter((_, i) => i !== pi)); }
    if (k === 'inc-add') { const v = { id: nuovoId(), nome: '', livello: +b.dataset.l || 0 }; sv.minc = v.id; (sv.aperti = sv.aperti || new Set()).add(v.id); await salvaI([...I, v]); sv.d.querySelector(`[data-f="inc.${I.length}.nome"]`)?.focus(); return; }
    if (k === 'inc-conv') {
      // il testo scritto prima nei riquadri dei livelli: una riga, un incantesimo
      const nuovi = [], via = {};
      for (let l = 0; l <= 9; l++) { const t = String(d['inc_' + l] || ''); if (!t.trim()) continue; t.split(/\n|;/).map(x => x.replace(/^[\s•\-*·]+|[\s,.;]+$/g, '')).filter(Boolean).forEach(nome => nuovi.push({ id: nuovoId(), nome: nome.slice(0, 80), livello: l })); via['inc_' + l] = ''; }
      if (!nuovi.length) return;
      await salvaScheda(s.id, { incantesimi: [...I, ...nuovi], ...via }, true); toast(`${nuovi.length} incantesimi trasformati in voci: apri ⚙ per completarli.`); return disegnaScheda();
    }
    if (k === 'prv-off' && pv) { const L = P.map(x => ({ ...x })); L[pi].off = !b.checked; await salvaScheda(s.id, { privilegi: L }, true); return disegnaScheda(); }
    if (k === 'prv-mod' && pv) { sv.mprv = sv.mprv === chiave ? null : chiave; if (!pv.id) { const L = P.map(x => ({ ...x })); L[pi].id = nuovoId(); if (sv.mprv) sv.mprv = L[pi].id; return salvaP(L); } return disegnaScheda(); }
    if (k === 'prv-via' && pv) { if (!await ask(`Eliminare **${pv.nome || 'questa voce'}**?`, { ok: 'Elimina', danger: true, title: 'Privilegi' })) return; sv.mprv = null; return salvaP(P.filter((_, i) => i !== pi)); }
    if (k === 'prv-add' || k === 'ris-add') { const v = { id: nuovoId(), nome: '', fonte: '', testo: '', ...(k === 'ris-add' ? { usi: 1, usati: 0, riposo: 'lungo' } : {}) }; sv.mprv = v.id; (sv.aperti = sv.aperti || new Set()).add(v.id); await salvaP([...P, v]); sv.d.querySelector(`.pv [data-f="prv.${P.length}.nome"]`)?.focus(); return; }
    if ((k === 'ris-usa' || k === 'ris-rec' || k === 'ris-pip') && pv) {
      const max = num(pv.usi) || 0, usati = num(pv.usati) || 0;
      const nu = k === 'ris-usa' ? usati + 1 : k === 'ris-rec' ? usati - 1 : max - (restanti(pv) >= +b.dataset.j ? +b.dataset.j - 1 : +b.dataset.j);
      const L = P.map(x => ({ ...x })); L[pi].usati = clamp(nu, 0, max); return salvaP(L);
    }
    if (k === 'riposo-breve' || k === 'riposo-lungo') {
      const lungo = k === 'riposo-lungo';
      if (lungo && !await ask(`Riposo lungo per **${s.nome}**: punti ferita al massimo, slot degli incantesimi e risorse recuperati. Continuare?`, { ok: 'Riposa', title: 'Riposo lungo' })) return;
      const ch = { privilegi: P.map(x => (lungo || x.riposo === 'breve') && x.riposo !== 'mai' ? { ...x, usati: 0 } : x) };
      if (lungo) { for (let i = 1; i <= 9; i++) if (num(d['usati_' + i])) ch['usati_' + i] = 0; if (num(d.pf_max)) ch.pf = num(d.pf_max); ch.morte_ok = 0; ch.morte_ko = 0; }
      await salvaScheda(s.id, ch, true); toast(lungo ? `${s.nome} si sveglia riposato.` : `${s.nome} recupera le risorse del riposo breve.`); return disegnaScheda();
    }
    if (k === 'converti') {
      const sp = daSpostare(d).map(a => { const dd = String(a.danni || '').replace(/\s+/g, ''); return { id: nuovoId(), nome: a.nome, fonte: '', testo: a.tipo || '', ...(/\d*d\d+/i.test(dd) ? { dadi: dd, extra: /furtiv|punizion/i.test(a.nome) } : {}) }; });
      const png = !formaPg(s), L = png ? [...P, ...dividiTesto(d.tratti)] : [...P, ...dividiTesto(d.tratti), ...dividiTesto(d.azioni), ...sp];
      await salvaScheda(s.id, png ? { privilegi: L, tratti: '' } : { privilegi: L, tratti: '', azioni: '', attacchi: (d.attacchi || []).filter(a => !NON_ATTACCO.test(a.nome || '')) }, true); toast(`Fatto: ${L.length - P.length} voci. Aprile per leggerle, ⚙ per cambiarle, ⠿ per spostarle.`); return disegnaScheda();
    }
    if (k === 'bevi') return bevi(s, b.dataset.p);
    const tkz = tokScheda() || attaccante(s);
    if (k === 'tz' && tkz) { const z = b.dataset.z; return segnaAzioni(tkz, { [z]: !azioniDi(tkz)[z] }); }
    if (k === 'tz-azm' && tkz) return menuAzioni(tkz, b);
    if (k === 'tz-fz' && tkz) return w ? togliAzione(tkz, +b.dataset.i) : undefined;
    if (k === 'tz-m' && tkz) { const a = azioniDi(tkz); return segnaAzioni(tkz, { mov: Math.max(0, (a.mov || 0) - +b.dataset.d) }); }
    if (k === 'tz-fine') return finisciTurno();
    if (k === 'tz-reset' && tkz) return segnaAzioni(tkz, { az: false, bon: false, rea: false, mov: 0, scatto: false, fatte: [], ox: null, oy: null });
    if (k === 'cacfg') { sv.mca = !sv.mca; return disegnaScheda(); }
    if (k === 'attcfg') { const i = +b.dataset.i; sv.matt = sv.matt === i ? null : i; return disegnaScheda(); }
    if (k === 'addatt') { sv.matt = (d.attacchi || []).length; await salvaScheda(s.id, { attacchi: [...(d.attacchi || []), { nome: '', colpire: null, danni: '', tipo: '' }] }, true); disegnaScheda(); sv.d.querySelector('.atts .at:last-of-type textarea.an')?.focus(); return; }
    if (k === 'delatt') { await salvaScheda(s.id, { attacchi: (d.attacchi || []).filter((_, i) => i !== +b.dataset.i) }, true); return disegnaScheda(); }
    if (k === 'riposo') { const p = {}; for (let i = 1; i <= 9; i++) if (num(d['usati_' + i])) p['usati_' + i] = 0; return salvaScheda(s.id, p, true); }
    if (k === 'pfm' || k === 'pfp') {
      const q = Math.max(1, Math.trunc(+sv.d.querySelector('[data-k=pfq]').value || 1)) * (k === 'pfm' ? -1 : 1), t = tokScheda();
      return t ? cambiaPF(t, q) : pfScheda(s, q);
    }
    if (!isDM()) return;
    if (k === 'tirapf') {
      const dv = String(d.dadi_vita || '').trim(); if (!dv) return toast('Scrivi prima i dadi vita, per esempio 2d8+2', 'err');
      const t = await tira(dv, null, true, s.nome + ' · Punti ferita'); if (!t?.totale) return;
      const tk = tokScheda(); if (tk) { const r = await SB.from('tavolo_token').update({ pf: t.totale, pf_max: t.totale }).eq('id', tk.id).select().single(); if (!r.error) { T.tok.set(tk.id, completa(tk, r.data)); disegnaToken(); } return aggiornaFinestra(); }
      return salvaScheda(s.id, { pf: t.totale, pf_max: t.totale }, true);
    }
    if (k === 'svuota') {
      // la scheda resta la stessa (token e foto restano collegati), i suoi dati ripartono da capo
      if (s.tipo !== 'png' || !await ask(`Svuotare la scheda di **${s.nome}**? Statistiche, tratti, attacchi e note si cancellano e la ricrei da capo: vuota, completa o da una foto. I token restano collegati.`, { ok: 'Svuota', danger: true, title: 'Svuota scheda' })) return;
      const e = s.entita && S.ents?.get(s.entita), f = await sceltaForma(s.nome, e); if (!f) return;
      const p = pend.get(s.id); if (p) { clearTimeout(p.t); pend.delete(s.id); }
      const dati = typeof f === 'object' ? { ...BASE, ...f.dati } : { ...BASE, ...(f === 'pg' ? { forma: 'pg', livello: 1 } : {}) };
      const r = await SB.from('tavolo_schede').update({ dati }).eq('id', s.id).select().single();
      if (r.error) return toast(r.error.message, 'err');
      T.schede.set(s.id, r.data);
      // i token del PNG riprendono i punti ferita della nuova scheda
      for (const t of T.tok.values()) if (!t.giocatore && schedaDi(t)?.id === s.id && t.pf_max != null) {
        const m = num(dati.pf_max) || null, u = await SB.from('tavolo_token').update({ pf: m, pf_max: m }).eq('id', t.id).select().single(); if (!u.error) T.tok.set(t.id, completa(t, u.data));
      }
      sv.tab = 'pri'; sv.edit = typeof f !== 'object'; dopoScheda(s.id); disegnaSchede(); disegnaToken(); disegnaScheda(); manda('schede', {});
      return toast(typeof f === 'object' ? 'Scheda ricompilata dalla foto: controlla i valori (✎ Modifica).' : 'Scheda svuotata: compilala da capo.');
    }
    if (k === 'forma') { sv.tab = 'pri'; sv.edit = false; await salvaScheda(s.id, { forma: formaPg(s) ? null : 'pg' }, true); return disegnaScheda(); }
    if (k === 'vis') {
      const u = await SB.from('tavolo_schede').update({ nascosta: !s.nascosta }).eq('id', s.id).select().single();
      if (u.error) return toast(u.error.message, 'err'); arrivaScheda(u.data); manda('schede', {}); return;
    }
    if (k === 'affida') return affidaScheda(s, b.value || null);
    if (k === 'metti') { const t = await piazza({ nome: s.nome, img: fotoScheda(s), scheda: 'tv:' + s.id, colore: '#7d2530', sch: s, giocatore: s.assegnata || null }, num(d.misura) || 1, T.livello === 'master'); if (t) { sv.tok = t.id; disegnaScheda(); } return; }
    if (k === 'img') {
      const f = b.files?.[0]; if (!f) return;
      try {
        const img = await immagineToken(f), prima = s.immagine, r = await SB.from('tavolo_schede').update({ immagine: img }).eq('id', s.id).select().single(); if (r.error) throw new Error(r.error.message); arrivaScheda(r.data);
        // anche i token di questa scheda che non hanno una foto loro prendono la nuova
        for (const t of T.tok.values()) if (schedaDi(t)?.id === s.id && !t.giocatore && (!t.immagine || t.immagine === prima)) {
          const u = await SB.from('tavolo_token').update({ immagine: img }).eq('id', t.id).select().single(); if (!u.error) T.tok.set(t.id, completa(t, u.data));
        }
        disegnaToken();
      }
      catch (e) { toast(e.message, 'err'); }
    }
  }
  /* ---------- personaggi guidati: creazione al 1° livello e level up ----------
     Le regole (classi, sottoclassi, talenti, razze, background, liste degli incantesimi) sono in regole.js, caricato solo qui.
     Tutto finisce nei dati della scheda; ogni passo salva cosa c'era prima (dati.storia_livelli), così l'ultimo si può annullare.
     Il giocatore sale di livello quando il DM glielo concede (dati.liv_concesso); il DM può sempre. */
  let REGP = null;
  function regole() {
    if (window.__regole) return Promise.resolve(window.__regole);
    return REGP = REGP || new Promise((ok, ko) => {
      const sc = document.createElement('script'); sc.src = 'regole.js';
      sc.onload = () => window.__regole ? ok(window.__regole) : ko(new Error('Il file delle regole non è valido.'));
      sc.onerror = () => { REGP = null; sc.remove(); ko(new Error('Non riesco a caricare le regole: controlla la connessione e riprova.')); };
      document.head.append(sc);
    });
  }
  const compL = l => 2 + Math.floor((clamp(l, 1, 20) - 1) / 4);
  const modV = v => Math.floor(((num(v) ?? 10) - 10) / 2);
  const t20 = (v, l) => Array.isArray(v) ? v[clamp(l, 1, 20) - 1] ?? null : v ?? null;
  const NOMEC = Object.fromEntries(CAR.map(([k, , n]) => [k, n])), SIGLA = Object.fromEntries(CAR.map(([k, s]) => [k, s]));
  const nomeAb = k => ABIL.find(x => x[0] === k)?.[1] || k;
  const metriT = m => String(Math.round(m * 10) / 10).replace('.', ',') + ' m';
  const segnoP = n => n ? (n > 0 ? '+' : '−') + Math.abs(n) : '';
  const corto = (t, n = 130) => { const x = String(t || '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim(); return x.length > n ? x.slice(0, n - 1) + '…' : x; };
  // «Cammino del berserker» → «Berserker»: il nome breve che va tra parentesi accanto alla classe
  const nomeBreve = n => { const x = String(n || '').replace(/^(Cammino|Collegio|Dominio|Circolo|Giuramento|Tradizione|Via|Scuola|Specializzazione|Archetipo)\s+(?:(?:dell'|dei|degli|delle|della|dello|del|di|d')\s*)?/i, ''); return x ? x[0].toUpperCase() + x.slice(1) : x; };
  const sottoDi = (R, c) => c?.sotto ? (R.sotto[c.id] || []).find(x => x.id === c.sotto) || null : null;
  const testoClassi = (R, L) => L.map(c => { const sb = sottoDi(R, c); return `${R.classi[c.id].nome}${sb ? ` (${nomeBreve(sb.nome)})` : ''}${L.length > 1 ? ' ' + c.livello : ''}`; }).join(' / ');
  const dadiVitaDi = (R, L) => { const m = new Map(); for (const c of L) { const dv = R.classi[c.id].dv; m.set(dv, (m.get(dv) || 0) + c.livello); } return [...m].sort((a, b) => b[0] - a[0]).map(([dv, n]) => `${n}d${dv}`).join(' + '); };
  // le classi della scheda: quelle salvate dalla procedura, oppure lette dal testo («Stregone (Magia selvaggia)», «Guerriero 3 / Ladro 2»)
  function classiDi(R, d) {
    if (Array.isArray(d.classi) && d.classi.length) return { L: d.classi.filter(c => R.classi[c.id]).map(c => ({ ...c })), dedotte: false };
    const tot = clamp(num(d.livello) || 1, 1, 20), L = [];
    for (const p of String(d.classe || '').split(/\s*[/,;+]\s*/).map(x => x.trim()).filter(Boolean)) {
      const n = norm(p), id = Object.keys(R.classi).find(k => n.includes(norm(R.classi[k].nome)));
      if (!id || L.some(c => c.id === id)) continue;
      const resto = norm(p.replace(new RegExp(R.classi[id].nome, 'i'), '').replace(/[()\d]/g, ' '));
      const sb = resto ? (R.sotto[id] || []).find(x => norm(x.nome).includes(resto) || resto.includes(norm(nomeBreve(x.nome)))) : null;
      L.push({ id, livello: +(p.match(/\b(\d{1,2})\b/)?.[1] || 0), sotto: sb?.id || null });
    }
    const noti = L.reduce((a, c) => a + c.livello, 0), senza = L.filter(c => !c.livello);
    if (L.length === 1) L[0].livello = tot; else senza.forEach((c, i) => c.livello = i ? 1 : Math.max(1, tot - noti - (senza.length - 1)));
    return { L, dedotte: true };
  }
  const razzaDi = (R, d) => { const r = R.razze.find(x => x.id === d.razza_id); return r ? { r, s: r.sotto?.find(x => x.id === d.sottorazza) || null } : null; };
  const razzaE = (R, d, rid) => {
    if (d.razza_id === rid || d.sottorazza === rid) return true;
    const x = R.razze.find(r => r.id === rid) || R.razze.flatMap(r => r.sotto || []).find(s => s.id === rid), t = norm(d.razza);
    return !!x && !!t && (t.includes(norm(x.nome)) || norm(x.nome).includes(t));
  };
  const posseduto = (d, nome) => (d.privilegi || []).some(p => norm(p.nome) === norm(nome));

  /* incantesimi: come li lancia una classe, quanti slot, quali si possono scegliere */
  const incDi = (R, c) => { const k = R.classi[c.id]; if (k.inc) return k.inc; const sb = sottoDi(R, c); return sb?.inc3 ? { ...sb.inc3, tipo: 'conosciuti', slot: 'terzo' } : null; };
  const livSlot = (t, l) => t === 'pieno' ? l : t === 'mezzo' ? (l >= 2 ? Math.ceil(l / 2) : 0) : t === 'mezzo+' ? Math.ceil(l / 2) : t === 'terzo' ? (l >= 3 ? Math.ceil(l / 3) : 0) : 0;
  const maxLivInc = (R, inf, l) => !inf ? 0 : inf.slot === 'patto' ? R.patto[clamp(l, 1, 20)][1] : (R.slot[livSlot(inf.slot, l)] || []).length;
  // multiclasse: si sommano i livelli da incantatore (mezzi incantatori per difetto, l'artefice per eccesso); il patto va a parte
  function slotDi(R, L) {
    const cs = L.map(c => ({ inf: incDi(R, c), l: c.livello })).filter(x => x.inf), out = Array(10).fill(0);
    if (!cs.length) return null;
    const pieni = cs.filter(x => x.inf.slot !== 'patto');
    const lv = pieni.length === 1 ? livSlot(pieni[0].inf.slot, pieni[0].l) : pieni.reduce((a, { inf, l }) => a + (inf.slot === 'pieno' ? l : inf.slot === 'mezzo+' ? Math.ceil(l / 2) : Math.floor(l / (inf.slot === 'terzo' ? 3 : 2))), 0);
    (R.slot[Math.min(20, lv)] || []).forEach((n, i) => out[i + 1] += n);
    const pt = cs.find(x => x.inf.slot === 'patto'); if (pt) { const [n, lp] = R.patto[clamp(pt.l, 1, 20)]; out[lp] += n; }
    return out;
  }
  function indiceInc(R) {
    if (R._idx && R._srd === !!T.srd) return R._idx;
    const m = new Map(); for (const x of T.srd?.incantesimi || []) m.set(chiaveInc(x.nome), x);
    for (const x of R.extraInc) if (!m.has(chiaveInc(x.nome))) m.set(chiaveInc(x.nome), x);
    R._srd = !!T.srd; return R._idx = m;
  }
  const incNome = (R, n) => indiceInc(R).get(chiaveInc(n)) || null;
  const voceIncDa = (R, nome, prep) => { const x = incNome(R, nome); return x ? daManuale({ nome: x.nome, ...(prep ? { prep: true } : {}) }, x) : { id: nuovoId(), nome, livello: 0, ...(prep ? { prep: true } : {}) }; };

  /* risorse che crescono col livello (ira, ki, punti stregoneria, dadi di superiorità…) */
  function usiProg(u, l, st, lt) {
    if (u == null) return null; if (typeof u === 'number') return u; if (Array.isArray(u)) return t20(u, l);
    const m = k => Math.max(1, modV(st[k]));
    return u === 'car' ? m('car') : u === 'car+1' ? 1 + Math.max(0, modV(st.car)) : u === 'int' ? m('int') : u === 'sag' ? m('sag') : u === 'comp' ? compL(lt) : u === 'comp2' ? 2 * compL(lt) : null;
  }
  const dadiProg = (v, l) => { const x = Array.isArray(v) ? (Array.isArray(v[0]) ? v.filter(([da]) => l >= da).pop()?.[1] : t20(v, l)) : v; return x ? String(x).replace(/^d/, '1d') : null; };
  function mettiProg(P, p, l, st, lt, fonte) {
    if (l < (p.min || 1)) return null;
    const usi = usiProg(p.usi, l, st, lt), dadi = dadiProg(p.dadi, l), val = p.valore ? t20(p.valore, l) : null;
    if (!usi && !dadi && !val) return null;
    const ill = usi >= 99, riposo = p.riposo5 && l >= 5 ? p.riposo5 : p.riposo || 'lungo';
    const testo = [val, ill ? 'Usi illimitati' : ''].filter(Boolean).map(x => x + '. ').join('') + (p.testo || '');
    const descr = [usi && !ill ? usi + ' usi' : ill ? 'illimitata' : '', dadi, val].filter(Boolean).join(', ');
    const i = P.findIndex(x => norm(x.nome) === norm(p.nome));
    if (i < 0) { P.push({ id: nuovoId(), nome: p.nome, fonte, testo, ...(usi && !ill ? { usi, usati: 0, riposo } : {}), ...(dadi ? { dadi } : {}), ...(p.extra ? { extra: true } : {}) }); return `${p.nome} (${descr})`; }
    const x = { ...P[i] }, prima = JSON.stringify(x);
    if (ill) { delete x.usi; delete x.usati; } else if (usi) { x.usi = usi; x.usati = Math.min(num(x.usati) || 0, usi); x.riposo = riposo; }
    if (dadi) x.dadi = dadi; if (val || ill) x.testo = testo;
    P[i] = x; return JSON.stringify(x) === prima ? null : `${p.nome}: ${descr}`;
  }
  const piuVel = (v, m) => { const x = String(v || '9 m').match(/\d+(?:[.,]\d+)?/); return metriT((x ? parseFloat(x[0].replace(',', '.')) : 9) + m); };
  const armaDi = (R, n) => { const k = norm(n); return k ? R.armi.find(a => k.includes(norm(a[0]))) || null : null; };
  const statArma = (a, st) => /accurata/.test(a[4]) ? (st.des >= st.for ? 'des' : 'for') : /a distanza/.test(a[4]) ? 'des' : 'for';

  /* lo stato della procedura: G.tipo 'liv' (level up) o 'crea' (nuovo personaggio al 1° livello) */
  const talScelto = G => G.asi.modo === 'talento' ? G.R.talenti.find(f => f.id === G.asi.tal) || null : null;
  function statDopo(G, ctx) {
    const st0 = Object.fromEntries(CAR.map(([x]) => [x, num(ctx.d[x]) ?? 10])), st = { ...st0 };
    if (ctx.asi && G.asi.modo === 'asi') for (const [x, n] of Object.entries(G.asi.p)) st[x] = Math.min(20, st[x] + n);
    const f = (ctx.asi || ctx.tal) && talScelto(G);
    if (f) for (const [x, n] of Object.entries(Array.isArray(f.asi) ? (G.asi.tk ? { [G.asi.tk]: 1 } : {}) : f.asi || {})) st[x] = Math.min(20, st[x] + n);
    return { st0, st, f };
  }
  function ctxLiv(G) {
    const R = G.R, prima = G.classi.find(c => c.id === G.cl), k = R.classi[G.cl]; if (!k) return null;
    const c = { id: G.cl, livello: (prima?.livello || 0) + 1, sotto: prima?.sotto || null };
    const servS = !c.sotto && c.livello >= k.sotto.liv && !!(R.sotto[G.cl] || []).length;
    if (servS && G.sotto) c.sotto = G.sotto;
    const L = prima ? G.classi.map(x => x.id === G.cl ? c : { ...x }) : [...G.classi.map(x => ({ ...x })), c];
    return { R, k, c, cid: G.cl, lc: c.livello, lt: L.reduce((a, x) => a + x.livello, 0), L, sb: sottoDi(R, c), servS, subNuova: servS && !!c.sotto, asi: k.asi.includes(c.livello), nuova: !prima, d: G.d0 };
  }
  function ctxCrea(G) {
    const R = G.R, k = G.cr.cl && R.classi[G.cr.cl]; if (!k) return null;
    const c = { id: G.cr.cl, livello: 1, sotto: k.sotto.liv === 1 ? G.sotto : null }, rz = R.razze.find(x => x.id === G.cr.razza), sr = rz?.sotto?.find(x => x.id === G.cr.sotto);
    return { R, k, c, cid: c.id, lc: 1, lt: 1, L: [c], sb: sottoDi(R, c), servS: k.sotto.liv === 1, subNuova: !!c.sotto, asi: false, tal: !!(rz?.talento || sr?.talento), primo: true, d: baseCrea(G) };
  }
  const ctxDi = G => G.tipo === 'crea' ? ctxCrea(G) : ctxLiv(G);
  function scelteLiv(ctx) {
    const out = [], add = (pre, a, fonte) => (a || []).forEach((sc, i) => out.push({ ...sc, key: pre + ':' + i, fonte }));
    if (!ctx) return out;
    add('c' + ctx.lc, ctx.k.scelte?.[ctx.lc], `${ctx.k.nome} ${ctx.lc}`);
    if (ctx.sb) for (const [lv, a] of Object.entries(ctx.sb.scelte || {})) if (+lv === ctx.lc || (ctx.subNuova && +lv <= ctx.lc)) add('s' + lv, a, `${nomeBreve(ctx.sb.nome)} ${lv}`);
    return out;
  }
  const scelteTal = G => { const f = talScelto(G); return f ? (f.scelte || []).map((sc, i) => ({ ...sc, key: 'f:' + i, fonte: 'Talento: ' + f.nome })) : []; };
  function scelteRazza(G) {
    const R = G.R, r = R.razze.find(x => x.id === G.cr.razza), sr = r?.sotto?.find(x => x.id === G.cr.sotto), out = [];
    (r?.scelte || []).forEach((sc, i) => out.push({ ...sc, key: 'r:' + i, fonte: r.nome }));
    (sr?.scelte || []).forEach((sc, i) => out.push({ ...sc, key: 'sr:' + i, fonte: sr.nome }));
    if (/a scelta/.test(r?.lingue || '') && !out.some(sc => sc.tipo === 'lingua')) out.push({ tipo: 'lingua', n: 1, key: 'rl:0', fonte: r.nome, titolo: 'Lingua a scelta' });
    return out;
  }
  // le abilità del background che si hanno già dalla classe o dalla razza si sostituiscono con altre a scelta
  function scelteBg(G) {
    const R = G.R, C = G.cr, b = R.background.find(x => x.id === C.bg); if (!b) return [];
    const r = R.razze.find(x => x.id === C.razza), sr = r?.sotto?.find(x => x.id === C.sotto), gia = new Set([...C.abilC, ...(r?.abil || []), ...(sr?.abil || [])]);
    scelteRazza(G).filter(sc => sc.tipo === 'abilita').forEach(sc => (G.sc[sc.key] || []).forEach(x => gia.add(x)));
    const rip = b.abil.filter(x => gia.has(x)), out = [];
    if (b.abilScelta) out.push({ tipo: 'abilita', n: b.abilScelta, lista: b.abilLista, key: 'bg:0', fonte: b.nome, titolo: 'Abilità del background' });
    if (rip.length) out.push({ tipo: 'abilita', n: rip.length, key: 'bgx:0', fonte: b.nome, titolo: `Al posto di ${rip.map(nomeAb).join(' e ')} (le hai già)` });
    if (b.lingue) out.push({ tipo: 'lingua', n: b.lingue, key: 'bgl:0', fonte: b.nome, titolo: b.lingue > 1 ? 'Lingue del background' : 'Lingua del background' });
    return out;
  }
  function tutteScelte(G, ctx) { return [...scelteLiv(ctx), ...(ctx && (ctx.asi || ctx.tal) ? scelteTal(G) : []), ...(G.tipo === 'crea' ? [...scelteRazza(G), ...scelteBg(G)] : [])]; }
  // le opzioni di una scelta (stili, metamagia, invocazioni…), con il motivo se non si può prendere
  function opzioniDi(G, sc, ctx) {
    if (sc.voci) return sc.voci.map(v => ({ nome: v, testo: '', no: '' }));
    const d = ctx?.d || (G.tipo === 'crea' ? baseCrea(G) : G.d0), scelto = n => Object.values(G.sc).some(v => Array.isArray(v) && v.includes(n));
    const patto = p => posseduto(d, 'Patto della ' + p) || posseduto(d, 'Patto del ' + p) || scelto('Patto della ' + p) || scelto('Patto del ' + p);
    return (G.R.opzioni[sc.lista] || []).map(o => {
      let no = '';
      if (o.classi && ctx?.cid && sc.lista === 'stili' && !String(o.classi).split(/\s+/).includes(ctx.cid)) no = 'Non per questa classe';
      else if (o.liv && ctx && (sc.lista === 'invocazioni' ? (ctx.L.find(c => c.id === 'warlock')?.livello || 0) : ctx.lc) < o.liv) no = `Dal ${o.liv}° livello`;
      else if (o.patto && !patto(o.patto)) no = `Serve il Patto ${/^(lama|catena)$/.test(o.patto) ? 'della' : 'del'} ${o.patto}`;
      else if (posseduto(d, o.nome)) no = 'Ce l\'hai già';
      return { ...o, no };
    });
  }
  function talentoNo(G, f, st, d) {
    if (f.car && !(f.reqO ? f.car.some(([k, n]) => st[k] >= n) : f.car.every(([k, n]) => st[k] >= n))) return 'Serve ' + f.car.map(([k, n]) => `${NOMEC[k]} ${n}`).join(f.reqO ? ' o ' : ' e ');
    if (f.razze && !f.razze.some(r => razzaE(G.R, d, r))) return 'Solo per alcune razze';
    if (f.inc && !(d.incantesimi || []).length && !num(d.slot_1) && !(G.tipo === 'crea' && incDi(G.R, { id: G.cr.cl || 'barbaro' }))) return 'Serve saper lanciare incantesimi';
    if (posseduto(d, f.nome)) return 'Ce l\'hai già';
    return '';
  }
  // cosa si può imparare in questo livello
  function datiInc(G, ctx) {
    const R = G.R, inf = ctx && incDi(R, ctx.c), out = { inf, max: 0, t: 0, n: 0, seg: 0, arc: 0, arcLiv: 0, prep: 0, swap: false, lista: [], sempre: new Set() };
    if (!inf) return out;
    const lc = ctx.lc, prev = tab => lc > 1 ? t20(tab, lc - 1) || 0 : 0, { st } = statDopo(G, ctx);
    out.max = maxLivInc(R, inf, lc);
    out.t = inf.trucchi ? Math.max(0, (t20(inf.trucchi, lc) || 0) - prev(inf.trucchi)) : 0;
    if (inf.tipo === 'conosciuti') { out.n = Math.max(0, (t20(inf.conosciuti, lc) || 0) - prev(inf.conosciuti)); out.swap = !ctx.primo && !ctx.nuova && out.max > 0 && lc > 1; }
    if (inf.tipo === 'libro') out.n = lc === 1 ? 6 : 2;
    if (inf.tipo === 'preparati' && out.max) out.prep = Math.max(1, inf.prep(lc) + modV(st[inf.car]));
    out.seg = (inf.segreti?.[lc] || 0) + (ctx.sb ? Object.entries(ctx.sb.segreti || {}).filter(([lv]) => +lv === lc || (ctx.subNuova && +lv <= lc)).reduce((a, [, n]) => a + n, 0) : 0);
    if (inf.arcano?.[lc]) { out.arc = 1; out.arcLiv = inf.arcano[lc]; }
    const nomi = new Set();
    (R.liste[inf.lista] || []).forEach((a, lv) => { if (lv <= out.max) a.forEach(n => nomi.add(n)); });
    if (ctx.sb?.lista) for (const [lv, a] of Object.entries(ctx.sb.lista)) if (+lv <= lc) a.forEach(n => nomi.add(n));
    if (ctx.sb?.listaExtra) (R.liste[ctx.sb.listaExtra] || []).forEach((a, lv) => { if (lv <= out.max) a.forEach(n => nomi.add(n)); });
    out.lista = [...nomi].map(n => incNome(R, n)).filter(Boolean).sort((a, b) => (a.livello - b.livello) || a.nome.localeCompare(b.nome, 'it'));
    if (ctx.sb?.inc) for (const [lv, a] of Object.entries(ctx.sb.inc)) if (+lv <= lc) a.forEach(n => out.sempre.add(chiaveInc(n)));
    return out;
  }
  const tuttiInc = (R, max) => { const s = new Set(); for (const l of Object.values(R.liste)) l.forEach((a, lv) => { if (lv && lv <= max) a.forEach(n => s.add(n)); }); return [...s].map(n => incNome(R, n)).filter(Boolean).sort((a, b) => (a.livello - b.livello) || a.nome.localeCompare(b.nome, 'it')); };

  /* creazione: i dati di partenza (razza, punteggi, background, equipaggiamento) prima del 1° livello di classe */
  function puntiBase(G) {
    const C = G.cr, vals = C.metodo === 'tiri' ? C.tiri : G.R.standard;
    if (C.metodo === 'manuale') return Object.fromEntries(CAR.map(([k]) => [k, clamp(num(C.man[k]) ?? 10, 1, 20)]));
    if (C.metodo === 'pb') return { ...C.pb };
    return Object.fromEntries(CAR.map(([k]) => [k, C.ass[k] != null && vals[C.ass[k]] != null ? vals[C.ass[k]] : 10]));
  }
  function bonusRazza(G) {
    const R = G.R, C = G.cr, r = R.razze.find(x => x.id === C.razza), sr = r?.sotto?.find(x => x.id === C.sotto), b = {};
    if (!r) return b;
    if (r.asi === 'libero' || C.libero) return { ...C.asiL };
    for (const [k, n] of Object.entries(sr?.togliAsi ? {} : r.asi || {})) b[k] = (b[k] || 0) + n;
    for (const [k, n] of Object.entries(sr?.asi || {})) b[k] = (b[k] || 0) + n;
    const sch = sr?.asiScelta || r.asiScelta; if (sch) for (const k of C.asiS) b[k] = (b[k] || 0) + sch[0];
    return b;
  }
  function baseCrea(G) {
    const R = G.R, C = G.cr, r = R.razze.find(x => x.id === C.razza), sr = r?.sotto?.find(x => x.id === C.sotto), bg = R.background.find(x => x.id === C.bg), k = C.cl && R.classi[C.cl];
    const st = puntiBase(G), b = bonusRazza(G); for (const x in b) st[x] = Math.min(20, st[x] + b[x]);
    const d = { ...(G.d0.forma ? { forma: G.d0.forma } : {}), livello: 0, ...st, razza: r ? (sr && !/^umano/.test(sr.id) ? sr.nome : r.nome) : '', razza_id: r?.id || null, sottorazza: sr?.id || null,
      background: bg?.nome || '', bg_id: bg?.id || null, allineamento: C.all || '', velocita: metriT(sr?.vel || r?.vel || 9), pf_max: 0, pf: 0, pf_liv: (r?.pfLiv || 0) + (sr?.pfLiv || 0) || null,
      personalita: C.pers || '', ideali: C.ideali || '', legami: C.legami || '', difetti: C.difetti || '', privilegi: [], incantesimi: [], attacchi: [] };
    const P = d.privilegi, tratto = (n, t, f) => { if (!P.some(x => norm(x.nome) === norm(n))) P.push({ id: nuovoId(), nome: n, fonte: f, testo: t }); };
    if (r) {
      for (const [n, t] of r.tratti || []) tratto(n, t, r.nome);
      for (const [n, t] of sr?.tratti || []) tratto(n, t, sr.nome);
      const scuro = sr?.scuro || r.scuro; if (scuro && !P.some(x => /scurovisione/i.test(x.nome))) tratto('Scurovisione', `Vedi al buio entro ${scuro} m.`, r.nome);
      if (r.nuoto || sr?.nuoto) tratto('Nuotare', `Velocità di nuoto ${metriT(r.nuoto || sr.nuoto)}.`, r.nome);
      if (r.vola) tratto('Volare', `Velocità di volo ${metriT(r.vola)}.`, r.nome);
      for (const a of [...(r.abil || []), ...(sr?.abil || [])]) d['ab_' + a] = 1;
    }
    if (bg) { for (const a of bg.abil || []) d['ab_' + a] = 1; if (bg.priv) tratto(bg.priv[0], bg.priv[1], 'Background: ' + bg.nome); }
    for (const a of C.abilC) d['ab_' + a] = Math.max(1, num(d['ab_' + a]) || 0);
    const lingue = [r && `Lingue: ${(r.lingue || 'Comune').replace(/,? e una a scelta/, '')}${C.lingue ? ', ' + C.lingue : ''}`, k && `Armature e armi: ${k.comp}`, [r?.comp, sr?.comp].filter(Boolean).length && `Dalla razza: ${[r?.comp, sr?.comp].filter(Boolean).join(', ')}`, bg?.strumenti && `Strumenti: ${bg.strumenti}`].filter(Boolean);
    d.lingue = lingue.join('\n');
    // equipaggiamento: le scelte della classe (o le monete) e quello del background
    const eq = [];
    if (k && !C.oro) k.equip.forEach((riga, i) => { const o = riga.split(' oppure '); eq.push(o[Math.min(C.eq[i] || 0, o.length - 1)]); });
    if (bg?.equip) eq.push(bg.equip);
    d.equip = eq.join('\n'); d.mo = num(C.mo) ?? (bg?.mo || 0);
    // classe armatura e attacchi
    const dm = modV(st.des), a = R.armature.find(x => x[0] === C.arm), sbc = k && k.sotto.liv === 1 ? sottoDi(R, { id: C.cl, sotto: G.sotto }) : null;
    let ca;
    if (a) ca = a[2] === 'leggera' ? a[1] + dm : a[2] === 'media' ? a[1] + Math.min(2, dm) : a[1];
    else {
      const op = [10 + dm]; if (C.cl === 'barbaro') op.push(10 + dm + modV(st.cos)); if (C.cl === 'monaco' && !C.scudo) op.push(10 + dm + modV(st.sag));
      if (sbc?.caSenza) op.push(sbc.caSenza + dm); const rc = String(r?.ca || ''); if (rc === '13+des') op.push(13 + dm); else if (+rc) op.push(+rc);
      ca = Math.max(...op);
    }
    d.ca = ca + (C.scudo ? 2 : 0) + (r?.caPiu || 0); d.armatura = a ? a[0] : 'nessuna'; d.scudo_ca = C.scudo ? 'si' : 'no';
    d.attacchi = C.armi.filter(Boolean).map(n => { const w = R.armi.find(x => x[0] === n); if (!w) return null; const kk = statArma(w, st), m = modV(st[kk]); return { nome: w[0], colpire: 2 + m, danni: w[1] + segnoP(m), tipo: [w[2], w[4]].filter(Boolean).join(' · ') }; }).filter(Boolean);
    // incantesimi della razza al 1° livello
    if (r) for (const [n, lv] of [...(r.inc || []), ...(sr?.inc || [])]) if (lv <= 1 && !d.incantesimi.some(x => chiaveInc(x.nome) === chiaveInc(n))) d.incantesimi.push(voceIncDa(R, n));
    if (d.incantesimi.length) d.car_inc = sr?.car_inc || r?.car_inc || 'car';
    for (const p of [r?.prog, sr?.prog].filter(Boolean)) mettiProg(P, p, 1, st, 1, r.nome);
    return d;
  }

  /* un livello in più (o il primo, nella creazione): i dati nuovi e le righe del riepilogo */
  function applicaLiv(G) {
    const R = G.R, ctx = ctxDi(G); if (!ctx) return null;
    const { k, c, lc, lt, sb, L } = ctx, crea = G.tipo === 'crea';
    const d = JSON.parse(JSON.stringify(ctx.d)), righe = [], P = d.privilegi = [...(d.privilegi || [])];
    const nuovoP = (nome, testo, fonte, x) => { if (P.some(p => norm(p.nome) === norm(nome))) return false; P.push({ id: nuovoId(), nome, fonte, testo: testo || '', ...x }); righe.push(['Privilegio', nome]); return true; };
    const I = d.incantesimi = [...(d.incantesimi || [])], ha = n => I.some(x => chiaveInc(x.nome) === chiaveInc(n));
    const inf = incDi(R, c);
    const aggInc = (n, prep) => { if (!n || ha(n)) return; I.push(voceIncDa(R, n, prep)); righe.push(['Incantesimo', n]); };
    // punteggi di caratteristica e talento
    const { st0, st, f } = statDopo(G, ctx);
    for (const [x] of CAR) if (st[x] !== st0[x]) { d[x] = st[x]; righe.push([NOMEC[x], `${st0[x]} → ${st[x]}`]); }
    // classi, livello, dadi vita
    d.classi = L; d.classe = testoClassi(R, L); d.livello = lt; d.dadi_vita = dadiVitaDi(R, L);
    d.dv_rest = crea ? 1 : Math.min(lt, (num(d.dv_rest) ?? lt - 1) + 1);
    if (crea) { k.ts.forEach(x => d['ts_' + x] = true); }
    else if (ctx.nuova && k.multiComp && k.multiComp !== 'Nessuna') d.lingue = [d.lingue, `Da ${k.nome} (multiclasse): ${k.multiComp}`].filter(Boolean).join('\n');
    // punti ferita: dado (o media) + Costituzione, più i bonus per livello (nano delle colline, Robusto, stirpe draconica)
    const pl0 = num(d.pf_liv) || 0; let pl = pl0;
    if (f?.pfLiv) pl += f.pfLiv; if (ctx.subNuova && sb?.pfPiu) pl += sb.pfPiu;
    d.pf_liv = pl || null;
    const dado = crea ? k.dv : G.pf.modo === 'media' ? k.dv / 2 + 1 : clamp(num(G.pf.v) || 1, 1, k.dv);
    const guad = Math.max(1, dado + modV(st.cos)) + pl + (crea ? 0 : (modV(st.cos) - modV(st0.cos) + pl - pl0) * (lt - 1));
    const pm0 = num(d.pf_max) || 0; d.pf_max = pm0 + guad; d.pf = crea ? d.pf_max : Math.min(d.pf_max, (num(d.pf) ?? pm0) + guad);
    righe.unshift(['Punti ferita', crea ? String(d.pf_max) : `${pm0} → ${d.pf_max} (+${guad})`]);
    // privilegi della classe e della sottoclasse
    for (const [nome, testo] of k.liv[lc] || []) {
      if (norm(nome) === norm(k.sotto.nome)) { if (sb) nuovoP(`${k.sotto.nome}: ${sb.nome}`, sb.desc, `${k.nome} ${lc}`); continue; }
      nuovoP(nome, testo, `${k.nome} ${lc}`);
    }
    if (sb) for (const [lv, a] of Object.entries(sb.liv || {})) if (+lv === lc || (ctx.subNuova && +lv <= lc)) for (const [nome, testo] of a) nuovoP(nome, testo, `${nomeBreve(sb.nome)} ${lv}`);
    for (const p of [...(k.prog || []), ...(sb?.prog || [])]) { const r = mettiProg(P, p, lc, st, lt, k.nome); if (r) righe.push(['Risorsa', r]); }
    const rz = razzaDi(R, d);
    if (rz && !crea) { for (const p of [rz.r.prog, rz.s?.prog].filter(Boolean)) { const r = mettiProg(P, p, lt, st, lt, rz.r.nome); if (r) righe.push(['Risorsa', r]); } for (const [n, lv] of [...(rz.r.inc || []), ...(rz.s?.inc || [])]) if (lv === lt) aggInc(n); }
    // talento
    if (f) {
      nuovoP(f.nome, f.testo, crea ? 'Talento' : `Talento (${lt}° livello)`);
      if (f.vel) d.velocita = piuVel(d.velocita, f.vel);
      if (f.tsDaAsi && G.asi.tk) d['ts_' + G.asi.tk] = true;
      if (f.comp) d.lingue = [d.lingue, `Dal talento ${f.nome}: ${f.comp}`].filter(Boolean).join('\n');
      if (f.prog) mettiProg(P, f.prog, lt, st, lt, 'Talento');
      (f.incPlus || []).forEach(n => aggInc(n));
    }
    // scelte (stili, metamagia, invocazioni, abilità, maestria, note)
    for (const sc of tutteScelte(G, ctx)) {
      const v = G.sc[sc.key]; if (v == null || v === '' || (Array.isArray(v) && !v.length)) continue;
      if (sc.tipo === 'abilita') { v.forEach(x => d['ab_' + x] = Math.max(1, num(d['ab_' + x]) || 0)); righe.push(['Competenza', v.map(nomeAb).join(', ')]); }
      else if (sc.tipo === 'maestria') { v.forEach(x => d['ab_' + x] = 2); righe.push(['Maestria', v.map(nomeAb).join(', ')]); }
      else if (sc.tipo === 'inc') v.forEach(n => aggInc(n));
      else if (sc.tipo === 'lingua') { const rr = String(d.lingue || '').split('\n').filter(Boolean), i = rr.findIndex(x => /^Lingue:/i.test(x)); if (i >= 0) rr[i] += ', ' + v.join(', '); else rr.unshift('Lingue: ' + v.join(', ')); d.lingue = rr.join('\n'); righe.push(['Lingue', v.join(', ')]); }
      else if (sc.tipo === 'testo') { const n = posseduto(d, sc.titolo) ? `${sc.titolo} (${sc.fonte})` : sc.titolo; P.push({ id: nuovoId(), nome: n, fonte: sc.fonte, testo: String(v) }); righe.push([sc.titolo, String(v)]); }
      else { const O = opzioniDi(G, sc, ctx); v.forEach(n => nuovoP(n, O.find(o => o.nome === n)?.testo || '', `${sc.titolo || 'Scelta'} · ${sc.fonte}`)); }
    }
    // incantesimi: nuovi, sostituiti, preparati, sempre preparati della sottoclasse
    const prepT = inf?.tipo === 'preparati' || inf?.tipo === 'libro';
    if (G.inc.via) { const i = I.findIndex(x => chiaveInc(x.nome) === chiaveInc(G.inc.via)); if (i >= 0) { I.splice(i, 1); righe.push(['Dimenticato', G.inc.via]); } }
    [...G.inc.t, ...G.inc.n, ...G.inc.seg, ...G.inc.arc, ...G.inc.sw].forEach(n => aggInc(n, prepT && incNome(R, n)?.livello > 0));
    if (sb?.inc) for (const [lv, a] of Object.entries(sb.inc)) if (+lv === lc || (ctx.subNuova && +lv <= lc)) a.forEach(n => aggInc(n, true));
    if (inf?.tipo === 'preparati' && G.inc.prepS) {
      const di = datiInc(G, ctx), inLista = new Set(di.lista.filter(x => x.livello > 0).map(x => chiaveInc(x.nome))), scelti = new Set(G.inc.prepS.map(chiaveInc));
      for (let i = I.length - 1; i >= 0; i--) { const kk = chiaveInc(I[i].nome); if (inLista.has(kk) && !di.sempre.has(kk) && !scelti.has(kk) && I[i].prep !== false) { righe.push(['Non più preparato', I[i].nome]); I.splice(i, 1); } }
      G.inc.prepS.forEach(n => aggInc(n, true));
    }
    if (inf && (crea || !d.car_inc || !(G.d0.incantesimi || []).length)) d.car_inc = inf.car;
    // slot degli incantesimi
    const sl = slotDi(R, L);
    if (sl) {
      const prima = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => num(d['slot_' + i]) || 0).join('/');
      for (let i = 1; i <= 9; i++) { d['slot_' + i] = sl[i] || null; d['usati_' + i] = Math.min(num(d['usati_' + i]) || 0, sl[i]) || null; }
      if (sl.slice(1).join('/') !== prima) righe.push(['Slot', sl.map((n, i) => n ? `${i}°: ${n}` : '').filter(Boolean).join(' · ')]);
    }
    // gli attacchi seguono il bonus di competenza e i modificatori
    if (!crea) {
      const dc = compL(lt) - compL(lt - 1);
      d.attacchi = (d.attacchi || []).map(a => {
        const w = armaDi(R, a.nome), kk = w && statArma(w, st), dm = kk ? modV(st[kk]) - modV(st0[kk]) : 0;
        if ((!dc && !dm) || num(a.colpire) == null) return a;
        return { ...a, colpire: num(a.colpire) + dc + dm, ...(dm ? { danni: String(a.danni || '').replace(/\s*[+\-−]\s*\d+\s*$/, '') + segnoP(modV(st[kk])) } : {}) };
      });
      if (dc) righe.push(['Bonus di competenza', `+${compL(lt - 1)} → +${compL(lt)}`]);
    }
    if (num(d.liv_concesso) && num(d.liv_concesso) <= lt) d.liv_concesso = null;
    return { d, righe, ctx };
  }

  /* ---------- la finestra della procedura ---------- */
  const NOMIP = { liv: 'Classe e PF', sotto: 'Sottoclasse', asi: 'Punteggi o talento', scelte: 'Scelte', inc: 'Incantesimi', riep: 'Riepilogo', razza: 'Razza', classe: 'Classe', car: 'Caratteristiche', bg: 'Background', equip: 'Equipaggiamento', dett: 'Dettagli' };
  function passiDi(G) {
    const ctx = ctxDi(G);
    if (G.tipo === 'crea') { const di = ctx ? datiInc(G, ctx) : null; return ['razza', 'classe', 'car', 'bg', 'equip', ...(di && (di.t || di.n || di.prep) ? ['inc'] : []), 'dett', 'riep']; }
    if (!G.cl) return ['liv', 'riep'];
    const di = datiInc(G, ctx);
    return ['liv', ...(ctx.servS ? ['sotto'] : []), ...(ctx.asi ? ['asi'] : []), ...(scelteLiv(ctx).length ? ['scelte'] : []), ...(di.t || di.n || di.seg || di.arc || di.prep || di.swap ? ['inc'] : []), 'riep'];
  }
  // le lingue dei manuali: prima le comuni, poi le esotiche
  const LINGUE = ['Comune', 'Elfico', 'Gigante', 'Gnomesco', 'Goblin', 'Halfling', 'Nanico', 'Orchesco', 'Abissale', 'Celestiale', 'Draconico', 'Gergo delle Profondità', 'Infernale', 'Primordiale', 'Silvano', 'Sottocomune'];
  const linguaIn = (t, l) => new RegExp(`(^|[^a-z])${norm(l)}([^a-z]|$)`).test(norm(t));
  const quanti = (G, sc, ctx) => sc.tipo === 'testo' ? 0 : Math.min(sc.n || 1, opzioniScelta(G, sc, ctx).filter(o => !o.no).length);
  function opzioniScelta(G, sc, ctx) {
    const d = ctx?.d || (G.tipo === 'crea' ? baseCrea(G) : G.d0), abil = new Set(ABIL.filter(([k]) => num(d['ab_' + k]) >= 1).map(([k]) => k));
    Object.entries(G.sc).forEach(([key, v]) => { if (key !== sc.key && Array.isArray(v)) v.forEach(x => abil.add(x)); });
    if (sc.tipo === 'abilita') return (sc.lista && sc.lista !== 'tutte' ? sc.lista : ABIL.map(x => x[0])).map(k => ({ nome: k, no: num(d['ab_' + k]) >= 1 ? 'Ce l\'hai già' : '' }));
    if (sc.tipo === 'maestria') return ABIL.map(([k]) => ({ nome: k, no: num(d['ab_' + k]) >= 2 ? 'Ce l\'hai già' : abil.has(k) ? '' : 'Serve la competenza' }));
    if (sc.tipo === 'lingua') {
      const r = G.tipo === 'crea' ? G.R.razze.find(x => x.id === G.cr.razza) : null, gia = [d.lingue, r?.lingue].filter(Boolean).join('\n');
      return LINGUE.map(l => ({ nome: l, no: linguaIn(gia, l) ? 'La conosci già' : abil.has(l) ? 'Già scelta' : '' }));
    }
    if (sc.tipo === 'inc') return (G.R.liste[sc.lista]?.[sc.liv] || []).map(n => ({ nome: n, no: (d.incantesimi || []).some(x => chiaveInc(x.nome) === chiaveInc(n)) ? 'Ce l\'hai già' : '' }));
    return opzioniDi(G, sc, ctx);
  }
  function mancaScelte(G, L, ctx) {
    for (const sc of L) { const v = G.sc[sc.key] || [], n = quanti(G, sc, ctx); if (sc.tipo !== 'testo' && v.length < n) return `${sc.titolo || (sc.tipo === 'abilita' ? 'Abilità' : sc.tipo === 'maestria' ? 'Maestria' : 'Scelta')}: scegline ${n - v.length}`; }
    return '';
  }
  function mancaInc(G, ctx) {
    const di = datiInc(G, ctx), I = ctx.d.incantesimi || [], no = x => I.some(y => chiaveInc(y.nome) === chiaveInc(x.nome));
    const disp = (q, f) => di.lista.filter(f).filter(x => !no(x)).length;
    const need = [['t', Math.min(di.t, disp('t', x => !x.livello)), 'trucchetti'], ['n', Math.min(di.n, disp('n', x => x.livello > 0)), 'incantesimi'], ['seg', di.seg, 'segreti magici'], ['arc', di.arc, 'arcanum mistico'], ['sw', G.inc.via ? 1 : 0, 'incantesimo al posto di quello dimenticato']];
    for (const [q, n, l] of need) if (G.inc[q].length < n) return `Scegli ancora ${n - G.inc[q].length} ${l}`;
    if (di.prep && (G.inc.prepS || []).length > di.prep) return `Puoi preparare al massimo ${di.prep} incantesimi`;
    return '';
  }
  function manca(G, p) {
    const R = G.R, ctx = ctxDi(G), C = G.cr;
    if (p === 'liv') {
      if (G.dedotte) { const tot = G.classi.reduce((a, c) => a + (+c.livello || 0), 0), lv = clamp(num(G.d0.livello) || 1, 1, 20); if (G.classi.length && tot !== lv) return `Le classi attuali devono sommare il livello ${lv} (ora fanno ${tot})`; }
      if (!G.classi.length) return 'Indica la classe di adesso (per una scheda nuova usa la creazione guidata)';
      if (!G.cl) return 'Scegli in quale classe sali';
      if (G.pf.modo !== 'media' && !num(G.pf.v)) return G.pf.modo === 'tiro' ? 'Tira il dado dei punti ferita' : 'Scrivi i punti ferita guadagnati';
      return '';
    }
    if (p === 'sotto') return ctx?.servS && !G.sotto ? 'Scegli la sottoclasse' : '';
    if (p === 'asi') {
      if (G.asi.modo === 'asi') { const t = Object.values(G.asi.p).reduce((a, n) => a + n, 0); return t < 2 ? `Distribuisci ancora ${2 - t} punt${2 - t === 1 ? 'o' : 'i'}` : ''; }
      const f = talScelto(G); if (!f) return 'Scegli un talento';
      if (Array.isArray(f.asi) && !G.asi.tk) return 'Scegli dove va il +1 del talento';
      return mancaScelte(G, scelteTal(G), ctx);
    }
    if (p === 'scelte') return mancaScelte(G, scelteLiv(ctx), ctx);
    if (p === 'inc') return ctx ? mancaInc(G, ctx) : '';
    if (p === 'razza') {
      const r = R.razze.find(x => x.id === C.razza); if (!r) return 'Scegli la razza';
      if (r.sotto?.length && !C.sotto) return 'Scegli la sottorazza';
      const sr = r.sotto?.find(x => x.id === C.sotto);
      if (r.asi === 'libero' || C.libero) { const v = Object.values(C.asiL); if (C.schema === '21' ? !(v.includes(2) && v.includes(1) && v.length === 2) : v.filter(n => n === 1).length !== 3) return 'Scegli dove vanno i bonus della razza'; }
      else { const sch = sr?.asiScelta || r.asiScelta; if (sch && C.asiS.length < sch[1]) return `Scegli ${sch[1]} caratteristiche per il +${sch[0]}`; }
      return mancaScelte(G, scelteRazza(G), ctx);
    }
    if (p === 'classe') {
      if (!C.cl) return 'Scegli la classe';
      const k = R.classi[C.cl], n = k.abil[0]; if (C.abilC.length < n) return `Scegli ancora ${n - C.abilC.length} abilità della classe`;
      if (k.sotto.liv === 1 && !G.sotto) return `Scegli: ${k.sotto.nome.toLowerCase()}`;
      return mancaScelte(G, scelteLiv(ctx), ctx);
    }
    if (p === 'car') {
      if (C.metodo === 'tiri' && C.tiri.length < 6) return 'Tira i 6 punteggi';
      if (['standard', 'tiri'].includes(C.metodo) && CAR.some(([k]) => C.ass[k] == null)) return 'Assegna un valore a ogni caratteristica';
      if (C.metodo === 'pb' && costoPb(G) > 27) return 'Hai speso più di 27 punti';
      if (ctx?.tal) { const f = talScelto(G); if (!f) return 'Scegli il talento della razza'; if (Array.isArray(f.asi) && !G.asi.tk) return 'Scegli dove va il +1 del talento'; return mancaScelte(G, scelteTal(G), ctx); }
      return '';
    }
    if (p === 'bg') return !C.bg ? 'Scegli il background' : mancaScelte(G, scelteBg(G), ctx);
    return '';
  }
  const costoPb = G => CAR.reduce((a, [k]) => a + (G.R.pointBuy[G.cr.pb[k]] ?? 99), 0);
  const BOZZA = G => `tavolo-guida-${G.tipo}-${G.id}`;
  function salvaBozza(G) {
    try { localStorage.setItem(BOZZA(G), JSON.stringify({ liv: num(G.d0.livello) || 0, passo: G.passo, sc: G.sc, inc: G.inc, asi: G.asi, pf: G.pf, sotto: G.sotto, cl: G.cl, classi: G.classi, dedotte: G.dedotte, cr: G.cr, fino: G.fino })); } catch { }
  }
  const incVuoto = () => ({ t: [], n: [], seg: [], arc: [], sw: [], via: '', prepS: null, f: {} });

  async function apriGuida(s, tipo, fino) {
    if (!s || !puoScrivere(s)) return;
    const lv = clamp(num(s.dati.livello) || 1, 1, 20);
    if (tipo === 'liv' && lv >= 20) return toast('Il personaggio è già al 20° livello.');
    if (tipo === 'liv' && !isDM() && !(num(s.dati.liv_concesso) > lv)) return toast('Il prossimo livello lo concede il DM.');
    let R; try { R = await regole(); await manuale(); } catch (e) { return toast(e.message, 'err'); }
    document.querySelectorAll('dialog.tv-guida[open]').forEach(x => x.close());
    const d0 = JSON.parse(JSON.stringify(s.dati || {}));
    const G = { tipo, id: s.id, nome: s.nome, R, d0, passo: 0, sc: {}, inc: incVuoto(), asi: { modo: 'asi', p: {}, tal: null, tk: null }, pf: { modo: 'media', v: null }, sotto: null, fino: fino || 0, classi: [], cl: null };
    if (tipo === 'liv') { const { L, dedotte } = classiDi(R, d0); G.classi = L; G.dedotte = dedotte; G.cl = L.length === 1 ? L[0].id : L[0]?.id || null; }
    else G.cr = { razza: null, sotto: null, libero: false, schema: '21', asiL: {}, asiS: [], metodo: 'standard', ass: {}, tiri: [], pb: { for: 8, des: 8, cos: 8, int: 8, sag: 8, car: 8 }, man: { for: 10, des: 10, cos: 10, int: 10, sag: 10, car: 10 }, cl: null, abilC: [], bg: null, eq: {}, oro: false, mo: null, arm: '', scudo: false, armi: ['', '', ''], all: '', lingue: '', pers: '', ideali: '', legami: '', difetti: '' };
    try { const b = JSON.parse(localStorage.getItem(BOZZA(G)) || 'null'); if (b && b.liv === (num(d0.livello) || 0)) { Object.assign(G, { passo: b.passo, sc: b.sc, inc: { ...incVuoto(), ...b.inc }, asi: b.asi, pf: b.pf, sotto: b.sotto, cl: b.cl, classi: b.classi?.length ? b.classi : G.classi, dedotte: b.dedotte ?? G.dedotte, fino: b.fino || G.fino }); if (b.cr) G.cr = { ...G.cr, ...b.cr }; G.ripresa = true; } } catch { }
    const d = finestra('<div class="gw"></div>', 'tv-guida'); G.dlg = d;
    d.setAttribute('aria-label', (tipo === 'crea' ? 'Creazione di ' : 'Level up di ') + s.nome);
    d.addEventListener('click', e => { const b = e.target.closest('[data-g]'); if (b && !b.disabled) azioneGuida(G, b); });
    d.addEventListener('input', e => { const el = e.target; if (el.dataset.gf === 'cerca') return filtraGuida(el); if (el.dataset.gi) campoGuida(G, el, false); });
    d.addEventListener('change', e => { const el = e.target; if (el.dataset.gi) campoGuida(G, el, true); });
    const sopra = e => {
      const a = d.querySelector('.ga'), b = e.target.closest?.('[data-g="sotto"]'), id = b && !b.disabled ? b.dataset.v : null, p = passiDi(G)[G.passo];
      if (!a || id === (G.archH || null) || !['sotto', 'classe'].includes(p)) return;
      if (!id && e.target.closest?.('.gso')) return; // nello spazio tra le carte non cambia nulla
      G.archH = id;
      if (id || p === 'sotto') { a.innerHTML = archAside(G, id); a.classList.add('arca'); }
      else { try { a.innerHTML = anteprimaG(G); } catch (er) { console.error(er); } a.classList.remove('arca'); }
    };
    d.addEventListener('mouseover', sopra); d.addEventListener('focusin', sopra);
    disegnaGuida(G);
    if (G.ripresa) toast('Ho ripreso le scelte che avevi lasciato a metà.');
  }
  function filtraGuida(el) {
    const q = norm(el.value), box = el.closest('.gsez') || el.parentElement;
    box.querySelectorAll('[data-n]').forEach(r => r.hidden = !!q && !r.dataset.n.includes(q));
  }
  // un campo di testo o una tendina: aggiorna lo stato; ridisegna solo quando cambia qualcosa che si vede altrove
  function campoGuida(G, el, fine) {
    const k = el.dataset.gi, v = el.type === 'number' ? num(el.value) : el.value, C = G.cr;
    if (k === 'sc') G.sc[el.dataset.key] = v;
    else if (k === 'pfv') G.pf.v = v == null ? null : clamp(v, 1, G.R.classi[G.cl]?.dv || 12);
    else if (k === 'fino') G.fino = +v || 0;
    else if (k === 'dc') { const [i, f] = el.dataset.i.split('.'), c = G.classi[+i]; if (!c) return; if (f === 'id') { c.id = v; c.sotto = null; } else if (f === 'sotto') c.sotto = v || null; else c.livello = clamp(+v || 1, 1, 20); if (!G.classi.some(x => x.id === G.cl)) G.cl = G.classi[0]?.id || null; }
    else if (k === 'ass') { const x = el.dataset.k; if (v === '') delete C.ass[x]; else { const i = +v; for (const y in C.ass) if (C.ass[y] === i) delete C.ass[y]; C.ass[x] = i; } }
    else if (k === 'man') C.man[el.dataset.k] = v;
    else if (k === 'eq') C.eq[+el.dataset.i] = +v;
    else if (k === 'arma') C.armi[+el.dataset.i] = v;
    else if (k === 'mo') C.mo = v;
    else if (['all', 'lingue', 'pers', 'ideali', 'legami', 'difetti', 'arm'].includes(k)) C[k] = v;
    salvaBozza(G);
    if (fine || el.tagName === 'SELECT') disegnaGuida(G); else aggiornaPiede(G);
  }
  function aggiornaPiede(G) {
    const passi = passiDi(G), p = passi[G.passo], m = manca(G, p), f = G.dlg.querySelector('.gf');
    if (!f) return; f.querySelector('.gmsg').textContent = m; const av = f.querySelector('[data-g=avanti],[data-g=conferma]'); if (av) av.disabled = p === 'riep' ? passi.some(x => manca(G, x)) : !!m;
  }
  async function azioneGuida(G, b) {
    const a = b.dataset.g, v = b.dataset.v, C = G.cr, R = G.R;
    const passi = passiDi(G);
    if (a === 'chiudi') return G.dlg.close();
    if (a === 'vai') G.passo = +v;
    else if (a === 'avanti') { if (manca(G, passi[G.passo])) return; G.passo++; }
    else if (a === 'indietro') G.passo = Math.max(0, G.passo - 1);
    else if (a === 'conferma') return confermaGuida(G);
    else if (a === 'cl') { if (G.cl !== v) { G.cl = v; G.sotto = null; G.asi = { modo: 'asi', p: {}, tal: null, tk: null }; G.sc = {}; G.inc = incVuoto(); G.pf = { modo: G.pf.modo, v: null }; } }
    else if (a === 'pf') { if (G.pf.tirato) return toast('Hai già tirato il dado: vale il tiro.'); G.pf = { modo: v, v: null, tirato: false }; }
    else if (a === 'pftira') {
      if (G.pf.tirato) return; const k = R.classi[G.cl], c0 = G.classi.find(c => c.id === G.cl), lt = G.classi.reduce((x, c) => x + c.livello, 0) + 1;
      b.disabled = true; const t = await tira(`1d${k.dv}`, null, false, `${G.nome} · punti ferita del ${lt}° livello (${k.nome} ${(c0?.livello || 0) + 1})`);
      if (t?.totale != null) { G.pf.v = +t.totale; G.pf.tirato = true; } else b.disabled = false;
    }
    else if (a === 'dcapri') G.dcApri = true;
    else if (a === 'dc+') G.classi.push({ id: Object.keys(R.classi).find(k => !G.classi.some(c => c.id === k)), livello: 1, sotto: null });
    else if (a === 'dc-') { G.classi.splice(+v, 1); if (!G.classi.some(x => x.id === G.cl)) G.cl = G.classi[0]?.id || null; }
    else if (a === 'sotto') { if (G.sotto !== v) { G.sotto = v; for (const key in G.sc) if (/^s\d/.test(key)) delete G.sc[key]; G.inc = incVuoto(); } }
    else if (a === 'asim') G.asi.modo = v;
    else if (a === 'asi') { const n = +b.dataset.d, p = G.asi.p, tot = Object.values(p).reduce((x, y) => x + y, 0), st = num(ctxDi(G).d[v]) ?? 10; const nv = (p[v] || 0) + n; if (nv < 0 || nv > 2 || (n > 0 && (tot >= 2 || st + nv > 20))) return; if (nv) p[v] = nv; else delete p[v]; }
    else if (a === 'tal') { if (G.asi.tal !== v) { G.asi.tal = v; G.asi.tk = null; for (const key in G.sc) if (key.startsWith('f:')) delete G.sc[key]; } }
    else if (a === 'talk') G.asi.tk = v;
    else if (a === 'sc') {
      const key = b.dataset.key, n = +b.dataset.max || 1, L = Array.isArray(G.sc[key]) ? [...G.sc[key]] : [];
      const i = L.indexOf(v); if (i >= 0) L.splice(i, 1); else if (L.length < n) L.push(v); else if (n === 1) L.splice(0, 1, v); else return toast(`Ne hai già scelti ${n}: togline uno per cambiarlo.`);
      G.sc[key] = L;
    }
    else if (a === 'inc') {
      const q = b.dataset.q, ctx = ctxDi(G), di = datiInc(G, ctx), max = { t: di.t, n: di.n, seg: di.seg, arc: di.arc, sw: G.inc.via ? 1 : 0 }[q];
      if (q === 'prep') { const L = G.inc.prepS || [], i = L.findIndex(n => chiaveInc(n) === chiaveInc(v)); if (i >= 0) L.splice(i, 1); else { if (L.length >= di.prep) return toast(`Puoi prepararne al massimo ${di.prep}.`); L.push(v); } G.inc.prepS = L; }
      else { const L = G.inc[q], i = L.indexOf(v); if (i >= 0) L.splice(i, 1); else if (L.length < max) L.push(v); else if (max === 1) L.splice(0, 1, v); else return toast(`Ne hai già scelti ${max}: togline uno per cambiarlo.`); }
    }
    else if (a === 'incf') G.inc.f[b.dataset.q] = v === '' ? null : +v;
    else if (a === 'via') { G.inc.via = G.inc.via === v ? '' : v; G.inc.sw = []; }
    else if (a === 'vedi') G.vedi = v;
    else if (a === 'razza') { G.vedi = null; if (C.razza !== v) { Object.assign(C, { razza: v, sotto: null, asiL: {}, asiS: [], libero: false }); for (const key in G.sc) if (/^s?r:/.test(key) || key.startsWith('f:')) delete G.sc[key]; G.asi = { modo: R.razze.find(x => x.id === v)?.talento ? 'talento' : 'asi', p: {}, tal: null, tk: null }; } }
    else if (a === 'sottor') { if (C.sotto !== v) { C.sotto = v; C.asiS = []; for (const key in G.sc) if (key.startsWith('sr:') || key.startsWith('f:')) delete G.sc[key]; const sr = R.razze.find(x => x.id === C.razza)?.sotto?.find(x => x.id === v); G.asi = { modo: sr?.talento || R.razze.find(x => x.id === C.razza)?.talento ? 'talento' : 'asi', p: {}, tal: null, tk: null }; } }
    else if (a === 'libero') { C.libero = !C.libero; C.asiL = {}; C.asiS = []; }
    else if (a === 'schema') { C.schema = v; C.asiL = {}; }
    else if (a === 'asil') { const n = +b.dataset.d, L = C.asiL; if (L[v] === n) delete L[v]; else { if (C.schema === '21') { for (const x in L) if (L[x] === n) delete L[x]; } else if (Object.keys(L).length >= 3 && !L[v]) return; L[v] = n; } }
    else if (a === 'asis') { const r = R.razze.find(x => x.id === C.razza), sr = r?.sotto?.find(x => x.id === C.sotto), sch = sr?.asiScelta || r?.asiScelta, i = C.asiS.indexOf(v); if (!sch) return; if (i >= 0) C.asiS.splice(i, 1); else if (C.asiS.length < sch[1]) C.asiS.push(v); else if (sch[1] === 1) C.asiS = [v]; }
    else if (a === 'classe') { if (C.cl !== v) { C.cl = v; C.abilC = []; G.sotto = null; C.eq = {}; for (const key in G.sc) if (/^[cs]\d/.test(key)) delete G.sc[key]; G.inc = incVuoto(); } }
    else if (a === 'abilc') { const n = R.classi[C.cl].abil[0], i = C.abilC.indexOf(v); if (i >= 0) C.abilC.splice(i, 1); else if (C.abilC.length < n) C.abilC.push(v); else return toast(`Ne hai già scelte ${n}: togline una per cambiarla.`); }
    else if (a === 'metodo') C.metodo = v;
    else if (a === 'pb') { const n = +b.dataset.d, x = C.pb[v] + n; if (x < 8 || x > 15) return; const prova = { ...C.pb, [v]: x }; if (CAR.reduce((t, [k]) => t + R.pointBuy[prova[k]], 0) > 27) return; C.pb[v] = x; }
    else if (a === 'tiri') {
      b.disabled = true; const out = [];
      for (let i = 0; i < 6; i++) { const t = await tira('4d6kh3', null, false, `${G.nome} · punteggio ${i + 1} di 6 (4d6, si tengono i 3 più alti)`); if (t?.totale == null) { b.disabled = false; return; } out.push(+t.totale); }
      C.tiri = out.sort((x, y) => y - x); C.ass = {};
    }
    else if (a === 'bg') { G.vedi = null; if (C.bg !== v) { C.bg = v; delete G.sc['bg:0']; delete G.sc['bgx:0']; C.mo = null; } }
    else if (a === 'oro') C.oro = !C.oro;
    else if (a === 'scudo') C.scudo = !C.scudo;
    salvaBozza(G); disegnaGuida(G);
  }
  function disegnaGuida(G) {
    const passi = passiDi(G); G.passo = clamp(G.passo, 0, passi.length - 1);
    G.archH = null;
    const p = passi[G.passo], w = G.dlg.querySelector('.gw'), sm = w.querySelector('.gm')?.scrollTop || 0, sb = w.querySelector('.gb')?.scrollTop || 0;
    const primoKo = passi.findIndex(x => manca(G, x)), lim = primoKo < 0 ? passi.length - 1 : primoKo;
    const cerca = w.querySelector('[data-gf=cerca]:focus'), cv = cerca?.value, ck = cerca?.dataset.q;
    let corpo = ''; try { corpo = corpoPasso(G, p); } catch (e) { console.error(e); corpo = `<p class="hint">Qualcosa non va in questo passo: ${esc(e.message)}</p>`; }
    let ant = ''; try { ant = p === 'sotto' ? archAside(G) : anteprimaG(G); } catch (e) { console.error(e); }
    const lv = clamp(num(G.d0.livello) || 1, 1, 20), ultimo = G.passo === passi.length - 1;
    w.innerHTML = `<div class="gh"><b>${G.tipo === 'crea' ? 'Nuovo personaggio' : `Livello ${lv} → ${lv + 1}`}</b><span class="who">${esc(G.nome)}</span><span class="sp"></span><button type="button" class="x" data-g="chiudi" aria-label="Chiudi" title="Chiudi: le scelte restano per la prossima volta">✕</button></div>
      <div class="gs">${passi.map((x, i) => `<button type="button" data-g="vai" data-v="${i}" class="${i === G.passo ? 'on' : i < G.passo && !manca(G, x) ? 'ok' : ''}"${i > lim ? ' disabled' : ''}><i>${i < G.passo && !manca(G, x) ? '✓' : i + 1}</i><span>${NOMIP[x]}</span></button>`).join('')}</div>
      <div class="gb"><div class="gm">${corpo}</div><aside class="ga${p === 'sotto' ? ' arca' : ''}">${ant}</aside></div>
      <div class="gf"><button type="button" class="gbtn" data-g="indietro"${G.passo ? '' : ' disabled'}>‹ Indietro</button><span class="gmsg"></span>${ultimo ? `<button type="button" class="gbtn p" data-g="conferma">${G.tipo === 'crea' ? '✓ Crea il personaggio' : `✓ Sali al ${lv + 1}° livello`}</button>` : '<button type="button" class="gbtn p" data-g="avanti">Avanti ›</button>'}</div>`;
    w.querySelector('.gm').scrollTop = sm; w.querySelector('.gb').scrollTop = sb;
    if (ck != null) { const c = w.querySelector(`[data-gf=cerca][data-q="${ck}"]`); if (c) { c.value = cv; c.focus(); filtraGuida(c); } }
    aggiornaPiede(G);
  }
  // emblemi delle classi: colore e disegno (tratto da 24×24) per le carte della procedura guidata
  const EMBLEMI = {
    artefice: ['#b07a2a', '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>'],
    barbaro: ['#a3402f', '<path d="M5 21 15 9"/><path d="M13 5c2-2 6-2 7 0 1 3-1 6-3 7-2-1-5-4-4-7z"/>'],
    bardo: ['#a0457f', '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>'],
    chierico: ['#b8902c', '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>'],
    druido: ['#4f7d3a', '<path d="M5 19C5 9 11 4 20 4c0 9-5 15-15 15z"/><path d="M5 19 14 10"/>'],
    guerriero: ['#7a6248', '<path d="M5 3h3l9 9-3 3-9-9zM19 3h-3l-4 4M14 15l5 5M10 15l-5 5M17 13l3 3M7 13l-3 3"/>'],
    ladro: ['#45455a', '<path d="M20 4l-9 9-2-2 9-9h2zM9 11l4 4M7 13l4 4M8 16l-4 4"/>'],
    mago: ['#2f5f9e', '<path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z"/>'],
    monaco: ['#3f8a86', '<circle cx="12" cy="12" r="9"/><path d="M12 3a4.5 4.5 0 0 0 0 9 4.5 4.5 0 0 1 0 9"/><circle cx="12" cy="7.5" r=".8"/><circle cx="12" cy="16.5" r=".8"/>'],
    paladino: ['#b08a2e', '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M12 8v8M9 11h6"/>'],
    ranger: ['#3f6b46', '<path d="M6 3c7 2 13 8 15 15"/><path d="M6 3l15 15"/><path d="M3 21 15 9M15 9h-4M15 9v4"/>'],
    stregone: ['#c2502b', '<path d="M12 22c4 0 7-3 7-7 0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-3 3-5 5-5 8 0 4 3 7 7 7z"/>'],
    warlock: ['#5b3b85', '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'],
  };
  const emblema = id => EMBLEMI[id] ? `<i class="gi"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${EMBLEMI[id][1]}</svg></i>` : '';
  const coloreCl = id => EMBLEMI[id] ? ` style="--c:${EMBLEMI[id][0]}"` : '';
  const card = (g, v, on, titolo, sotto, src, no, extra = '', cl = (g === 'classe' || g === 'cl') && EMBLEMI[v] ? v : '') => `<button type="button" class="gc${cl ? ' carta' : ''}${on ? ' on' : ''}${no && !on ? ' no' : ''}" data-g="${g}" data-v="${esc(v)}"${extra}${cl ? coloreCl(cl) : ''}${no && !on ? ' disabled' : ''}>${cl ? emblema(cl) : ''}<b>${esc(titolo)}</b>${src ? `<span class="src">${esc(src)}</span>` : ''}${sotto ? `<small>${esc(sotto)}</small>` : ''}${no ? `<small class="no">${esc(no)}</small>` : ''}</button>`;
  const cercaBox = (q, ph) => `<input type="search" data-gf="cerca" data-q="${q}" placeholder="${esc(ph)}" aria-label="${esc(ph)}">`;
  function sceltaHtml(G, sc, ctx) {
    const v = G.sc[sc.key] ?? (sc.tipo === 'testo' ? '' : []), tit = sc.titolo || (sc.tipo === 'abilita' ? 'Competenza nelle abilità' : sc.tipo === 'maestria' ? 'Maestria (competenza doppia)' : 'Scelta');
    const fonte = sc.fonte ? ` <small>· ${esc(sc.fonte)}</small>` : '';
    if (sc.tipo === 'testo') return `<div class="gsez"><h5>${esc(tit)}${fonte}</h5><input type="text" data-gi="sc" data-key="${sc.key}" value="${esc(v)}" placeholder="${esc(sc.ph || '')}" style="width:100%"></div>`;
    const n = quanti(G, sc, ctx), O = opzioniScelta(G, sc, ctx), cnt = `<span class="cnt${v.length >= n ? ' ok' : ''}">${v.length}/${n}</span>`;
    if (['abilita', 'maestria', 'inc', 'lingua'].includes(sc.tipo)) return `<div class="gsez"><h5>${esc(tit)}${fonte}${cnt}</h5><div class="chips">${O.map(o => `<button type="button" class="chip${v.includes(o.nome) ? ' on' : ''}" data-g="sc" data-key="${sc.key}" data-v="${esc(o.nome)}" data-max="${sc.n || 1}"${o.no && !v.includes(o.nome) ? ` disabled title="${esc(o.no)}"` : ''}>${esc(sc.tipo === 'inc' || sc.tipo === 'lingua' ? o.nome : nomeAb(o.nome))}</button>`).join('')}</div></div>`;
    return `<div class="gsez"><h5>${esc(tit)}${fonte}${cnt}</h5>${O.length > 12 ? cercaBox(sc.key, 'Cerca…') : ''}<div class="gcards">${O.map(o => `<button type="button" class="gc${v.includes(o.nome) ? ' on' : ''}${o.no && !v.includes(o.nome) ? ' no' : ''}" data-g="sc" data-key="${sc.key}" data-v="${esc(o.nome)}" data-max="${sc.n || 1}" data-n="${esc(norm(o.nome + ' ' + (o.testo || '')))}"${o.no && !v.includes(o.nome) ? ' disabled' : ''}><b>${esc(o.nome)}</b>${o.fonte ? `<span class="src">${esc(o.fonte)}</span>` : ''}${o.testo ? `<small>${esc(o.testo)}</small>` : ''}${o.req ? `<small><i>${esc(o.req)}</i></small>` : ''}${o.no ? `<small class="no">${esc(o.no)}</small>` : ''}</button>`).join('')}</div></div>`;
  }
  // la sottoclasse livello per livello, come la scheda di un archetipo su Roll20
  function archHtml(R, cid, x, lc) {
    const k = R.classi[cid];
    if (!x) return `<div class="arch vuoto"><b>${esc(k?.sotto.nome || 'Sottoclasse')}</b><p>Passa sopra una carta o toccala: qui vedi la descrizione e cosa ti dà a ogni livello, così capisci come crescerà il personaggio.</p></div>`;
    const lv = [...new Set([...Object.keys(x.liv || {}), ...Object.keys(x.inc || {})])].map(Number).sort((a, b) => a - b);
    return `<div class="arch"${coloreCl(cid)}><div class="ah">${emblema(cid)}<div><b>${esc(x.nome)}</b><span>${esc(k.sotto.nome)} · ${esc(x.fonte)}</span></div></div><p class="ad">${esc(x.desc)}</p>
      <ol>${lv.map(l => `<li class="${l <= lc ? 'ora' : ''}"><i>${l}°</i><div>${l <= lc ? '<em>Lo ottieni subito</em>' : ''}${(x.liv?.[l] || []).map(([n, t]) => `<p><b>${esc(n)}</b> ${esc(t)}</p>`).join('')}${x.inc?.[l] ? `<p><b>Incantesimi sempre preparati</b> ${esc(x.inc[l].join(', '))}</p>` : ''}</div></li>`).join('')}</ol></div>`;
  }
  // nel passo della sottoclasse il riquadro a destra mostra quella sotto il puntatore, altrimenti quella scelta
  function archAside(G, id) {
    const ctx = ctxDi(G); if (!ctx) return '';
    const L = G.R.sotto[ctx.cid] || [], x = L.find(y => y.id === (id || G.sotto));
    return archHtml(G.R, ctx.cid, x, ctx.lc);
  }
  function talentiHtml(G, ctx) {
    const R = G.R, { st } = statDopo(G, { ...ctx, asi: false, tal: false }), f = talScelto(G);
    const L = [...R.talenti].sort((a, b) => a.nome.localeCompare(b.nome, 'it')).map(x => ({ x, no: talentoNo(G, x, st, ctx.d) })).sort((a, b) => !!a.no - !!b.no);
    const asiT = x => Array.isArray(x.asi) ? `+1 a ${x.asi.length === 6 ? 'una caratteristica' : x.asi.map(k => SIGLA[k]).join('/')}` : x.asi ? Object.entries(x.asi).map(([k, n]) => `+${n} ${SIGLA[k]}`).join(' ') : '';
    return `<div class="gsez">${cercaBox('tal', 'Cerca un talento…')}<div class="gcards">${L.map(({ x, no }) => `<button type="button" class="gc${f?.id === x.id ? ' on' : ''}${no && f?.id !== x.id ? ' no' : ''}" data-g="tal" data-v="${x.id}" data-n="${esc(norm(x.nome + ' ' + x.testo))}"${no && f?.id !== x.id ? ' disabled' : ''}><b>${esc(x.nome)}</b><span class="src">${esc(x.fonte)}</span><small>${esc(x.testo)}</small>${asiT(x) || x.req ? `<small><i>${esc([asiT(x), x.req].filter(Boolean).join(' · '))}</i></small>` : ''}${no ? `<small class="no">${esc(no)}</small>` : ''}</button>`).join('')}</div></div>
      ${f ? `<div class="box"><h5>${esc(f.nome)}</h5>${Array.isArray(f.asi) ? `<div class="riga"><span>+1 a:</span><div class="chips">${f.asi.map(k => `<button type="button" class="chip${G.asi.tk === k ? ' on' : ''}" data-g="talk" data-v="${k}"${st[k] >= 20 ? ' disabled' : ''}>${NOMEC[k]} (${st[k]})</button>`).join('')}</div></div>` : ''}${scelteTal(G).map(sc => sceltaHtml(G, sc, ctx)).join('')}</div>` : ''}`;
  }
  const corto2 = x => corto(x.testo, 110);
  function righeInc(G, di, q, filtro, I) {
    const sel = q === 'prep' ? G.inc.prepS || [] : G.inc[q], fl = G.inc.f[q], L = (q === 'seg' ? tuttiInc(G.R, di.max) : q === 'arc' ? (G.R.liste.warlock[di.arcLiv] || []).map(n => incNome(G.R, n)).filter(Boolean) : di.lista).filter(filtro);
    const livs = [...new Set(L.map(x => x.livello))].sort((a, b) => a - b), ce = x => I.some(y => chiaveInc(y.nome) === chiaveInc(x.nome));
    const vis = L.filter(x => fl == null || x.livello === fl);
    return `${livs.length > 1 ? `<div class="lvl"><button type="button" data-g="incf" data-q="${q}" data-v="" class="${fl == null ? 'on' : ''}">Tutti</button>${livs.map(l => `<button type="button" data-g="incf" data-q="${q}" data-v="${l}" class="${fl === l ? 'on' : ''}">${l ? l + '°' : 'Trucchetti'}</button>`).join('')}</div>` : ''}
      ${L.length > 10 ? cercaBox(q, 'Cerca un incantesimo…') : ''}<div class="spls">${vis.map(x => {
        const on = sel.some(n => chiaveInc(n) === chiaveInc(x.nome)), sempre = di.sempre.has(chiaveInc(x.nome)), gia = q !== 'prep' && ce(x);
        const no = sempre ? 'Sempre preparato (sottoclasse)' : gia ? 'È già nella scheda' : '';
        return `<button type="button" class="spl${on || (q === 'prep' && sempre) ? ' on' : ''}" data-g="inc" data-q="${q}" data-v="${esc(x.nome)}" data-n="${esc(norm(x.nome + ' ' + (x.en || '')))}"${no ? ' disabled' : ''}><span class="ck">${on || (q === 'prep' && sempre) ? '✓' : ''}</span><span class="nm"><b>${esc(x.nome)}</b>${x.conc ? ' <em>conc.</em>' : ''}${x.riassunto ? ' <em>riassunto</em>' : ''}</span><em>${x.livello ? x.livello + '°' : 'T'} · ${esc(x.scuola || '')}</em><small>${esc(no || corto2(x))}</small></button>`;
      }).join('') || '<p class="hint">Niente da scegliere qui.</p>'}</div>`;
  }
  function corpoInc(G, ctx) {
    const di = datiInc(G, ctx), I = ctx.d.incantesimi || [], cnt = (a, n) => `<span class="cnt${a >= n ? ' ok' : ''}">${a}/${n}</span>`, inf = di.inf;
    const libro = inf.tipo === 'libro', car = NOMEC[inf.car];
    let h = `<h4>Incantesimi</h4><p class="hint">${inf.tipo === 'preparati' ? `Prepari gli incantesimi ogni giorno con ${car}: puoi tenerne pronti ${di.prep} (oltre a quelli sempre preparati).` : libro ? `Li scrivi nel libro degli incantesimi; ogni giorno ne prepari un numero pari al livello da mago + modificatore di ${car}.` : `Li conosci per sempre e li lanci con ${car}.`} Livello massimo: ${di.max ? di.max + '°' : 'solo trucchetti'}.</p>`;
    if (di.t) h += `<div class="gsez"><h5>Nuovi trucchetti ${cnt(G.inc.t.length, di.t)}</h5>${righeInc(G, di, 't', x => !x.livello, I)}</div>`;
    if (di.n) h += `<div class="gsez"><h5>${libro ? 'Nel libro degli incantesimi' : 'Nuovi incantesimi'} ${cnt(G.inc.n.length, di.n)}</h5>${righeInc(G, di, 'n', x => x.livello > 0, I)}</div>`;
    if (di.seg) h += `<div class="gsez"><h5>Segreti magici: da qualsiasi lista ${cnt(G.inc.seg.length, di.seg)}</h5>${righeInc(G, di, 'seg', () => true, I)}</div>`;
    if (di.arc) h += `<div class="gsez"><h5>Arcanum mistico (${di.arcLiv}° livello, una volta per riposo lungo) ${cnt(G.inc.arc.length, 1)}</h5>${righeInc(G, di, 'arc', () => true, I)}</div>`;
    if (di.swap) {
      const mie = I.filter(x => num(x.livello) > 0 && di.lista.some(y => chiaveInc(y.nome) === chiaveInc(x.nome)));
      h += `<div class="gsez"><h5>Vuoi sostituirne uno? <small>· facoltativo</small></h5><div class="chips">${mie.map(x => `<button type="button" class="chip${G.inc.via === x.nome ? ' on' : ''}" data-g="via" data-v="${esc(x.nome)}">${esc(x.nome)}</button>`).join('') || '<span class="hint">Nessuno.</span>'}</div>
        ${G.inc.via ? `<p class="hint">Al posto di ${esc(G.inc.via)}:</p>${righeInc(G, di, 'sw', x => x.livello > 0, I)}` : ''}</div>`;
    }
    if (di.prep) {
      if (!G.inc.prepS) G.inc.prepS = I.filter(x => num(x.livello) > 0 && !di.sempre.has(chiaveInc(x.nome)) && di.lista.some(y => chiaveInc(y.nome) === chiaveInc(x.nome))).map(x => x.nome);
      h += `<div class="gsez"><h5>Preparati ${cnt(G.inc.prepS.length, di.prep)}</h5><p class="hint">Li puoi cambiare dopo ogni riposo lungo: qui scegli quelli di partenza.</p>${righeInc(G, di, 'prep', x => x.livello > 0, I)}</div>`;
    }
    return h;
  }
  function corpoPasso(G, p) {
    const R = G.R, C = G.cr, ctx = ctxDi(G);
    if (p === 'liv') {
      const lv = clamp(num(G.d0.livello) || 1, 1, 20), st = Object.fromEntries(CAR.map(([x]) => [x, num(G.d0[x]) ?? 10]));
      const okMulti = id => { const m = R.classi[id].multi, o = m.includes('o'), req = m.filter(x => Array.isArray(x)); return o ? req.some(([k, n]) => st[k] >= n) : req.every(([k, n]) => st[k] >= n); };
      const reqT = id => { const m = R.classi[id].multi, req = m.filter(x => Array.isArray(x)); return req.map(([k, n]) => `${NOMEC[k]} ${n}`).join(m.includes('o') ? ' o ' : ' e '); };
      const mieOk = G.classi.every(c => okMulti(c.id));
      let h = '';
      const somma = G.classi.reduce((a, c) => a + (+c.livello || 0), 0);
      if (G.dedotte && !G.dcApri && G.classi.length && somma === lv) h += `<div class="riga"><span class="hint">Classi lette dalla scheda: ${esc(testoClassi(R, G.classi))}${G.classi.length > 1 ? '' : ' ' + lv}.</span><button type="button" class="chip" data-g="dcapri">✎ Correggi</button></div>`;
      else if (G.dedotte) h += `<div class="box"><h5>Le classi di adesso</h5><p class="hint">${G.d0.classe ? `Le ho lette dalla scheda («${esc(G.d0.classe)}»): controlla che siano giuste.` : 'La scheda non dice la classe: indicala qui.'} Da qui in poi le ricordo io.</p>
        ${G.classi.map((c, i) => `<div class="riga"><select data-gi="dc" data-i="${i}.id" aria-label="Classe">${Object.entries(R.classi).map(([k, x]) => `<option value="${k}"${k === c.id ? ' selected' : ''}>${esc(x.nome)}</option>`).join('')}</select>
          <select data-gi="dc" data-i="${i}.sotto" aria-label="Sottoclasse"><option value="">— sottoclasse —</option>${(R.sotto[c.id] || []).map(x => `<option value="${x.id}"${x.id === c.sotto ? ' selected' : ''}>${esc(x.nome)}</option>`).join('')}</select>
          <label>liv. <input type="number" min="1" max="20" value="${c.livello}" data-gi="dc" data-i="${i}.liv" style="width:60px"></label>${G.classi.length > 1 ? `<button type="button" class="chip" data-g="dc-" data-v="${i}">✕</button>` : ''}</div>`).join('')}
        <button type="button" class="chip" data-g="dc+">+ Un'altra classe</button></div>`;
      const altre = Object.entries(R.classi).filter(([k]) => !G.classi.some(c => c.id === k)), nuova = G.cl && !G.classi.some(c => c.id === G.cl);
      h += `<h4>In quale classe sali?</h4><div class="gcards">${G.classi.map(c => card('cl', c.id, G.cl === c.id, `${R.classi[c.id].nome} ${c.livello} → ${c.livello + 1}`, sottoDi(R, c)?.nome || R.classi[c.id].sotto.nome + ' dal ' + R.classi[c.id].sotto.liv + '°', `d${R.classi[c.id].dv}`, '')).join('')}${nuova ? card('cl', G.cl, true, `${R.classi[G.cl].nome} 1 (nuova)`, 'Multiclasse', `d${R.classi[G.cl].dv}`, '') : ''}</div>`;
      if (G.classi.length) h += `<details class="box"${nuova ? ' open' : ''}><summary><b>Oppure una nuova classe (multiclasse)</b></summary><p class="hint">Serve il punteggio minimo sia nella classe nuova sia in quelle che hai già.</p><div class="gcards">${altre.map(([k, x]) => card('cl', k, G.cl === k, x.nome, `Richiede ${reqT(k)}`, `d${x.dv}`, !okMulti(k) || !mieOk ? 'Punteggi insufficienti' : '')).join('')}</div></details>`;
      if (G.cl) {
        const k = R.classi[G.cl], med = k.dv / 2 + 1, cm = modV(G.d0.cos);
        h += `<h4>Punti ferita</h4><div class="seg"><button type="button" data-g="pf" data-v="media" class="${G.pf.modo === 'media' ? 'on' : ''}">Media: ${med}</button>${T.pag ? '' : `<button type="button" data-g="pf" data-v="tiro" class="${G.pf.modo === 'tiro' ? 'on' : ''}">Tira 1d${k.dv}</button>`}<button type="button" data-g="pf" data-v="man" class="${G.pf.modo === 'man' ? 'on' : ''}">Lo scrivo io</button></div>
          ${G.pf.modo === 'tiro' ? `<div class="riga">${G.pf.tirato ? `<span class="dado">${G.pf.v}</span><span class="hint">Tirato al Tavolo: lo vedono tutti in chat.</span>` : `<button type="button" class="gbtn" data-g="pftira">🎲 Tira 1d${k.dv}</button><span class="hint">Il tiro esce in chat e vale quello.</span>`}</div>` : ''}
          ${G.pf.modo === 'man' ? `<div class="riga"><label>Dado: <input type="number" min="1" max="${k.dv}" value="${G.pf.v ?? ''}" data-gi="pfv" style="width:70px"></label><span class="hint">Per esempio se hai tirato i dadi veri.</span></div>` : ''}
          <p class="hint">${T.pag ? 'Fuori dal Tavolo non si tirano dadi: scegli la media o scrivi il risultato. ' : ''}Si aggiunge il modificatore di Costituzione (${segnoP(cm) || '+0'})${num(G.d0.pf_liv) ? ` e ${num(G.d0.pf_liv)} per i bonus di razza o talento` : ''}.</p>`;
      }
      return h;
    }
    if (p === 'sotto') {
      const k = ctx.k, L = R.sotto[ctx.cid] || [];
      return `<h4>${esc(k.sotto.nome)}</h4><p class="hint">Al ${ctx.lc}° livello da ${k.nome.toLowerCase()} scegli la tua strada: ci sono tutte quelle dei manuali ufficiali. Passa sopra una carta o toccala per vedere cosa ti dà, livello per livello.</p>${L.length > 8 ? cercaBox('sotto', 'Cerca…') : ''}
        <div class="gcards gso">${L.map(x => { const pri = Object.entries(x.liv || {}).filter(([lv]) => +lv <= ctx.lc).flatMap(([, a]) => a.map(y => y[0])); return `<button type="button" class="gc${G.sotto === x.id ? ' on' : ''}" data-g="sotto" data-v="${x.id}"${coloreCl(ctx.cid)} data-n="${esc(norm(x.nome + ' ' + x.desc))}"><b>${esc(x.nome)}</b><span class="src">${esc(x.fonte)}</span><small>${esc(x.desc)}</small>${pri.length ? `<small><i>Subito: ${esc(pri.join(', '))}</i></small>` : ''}</button>${G.sotto === x.id ? `<div class="arch-in tel">${archHtml(R, ctx.cid, x, ctx.lc)}</div>` : ''}`; }).join('')}</div>`;
    }
    if (p === 'asi') {
      const st = Object.fromEntries(CAR.map(([x]) => [x, num(ctx.d[x]) ?? 10])), pp = G.asi.p, tot = Object.values(pp).reduce((a, n) => a + n, 0);
      return `<h4>Aumento dei punteggi o talento</h4><div class="seg"><button type="button" data-g="asim" data-v="asi" class="${G.asi.modo === 'asi' ? 'on' : ''}">+2 a una o +1 a due caratteristiche</button><button type="button" data-g="asim" data-v="talento" class="${G.asi.modo === 'talento' ? 'on' : ''}">Un talento</button></div>
        ${G.asi.modo === 'asi' ? `<p class="hint">Punti da distribuire: ${2 - tot}. Nessun punteggio può superare 20.</p><div class="ab6">${CAR.map(([k, s]) => `<div class="ab${pp[k] ? ' up' : ''}"><small>${s}</small><b>${st[k] + (pp[k] || 0)}</b><span>${segnoP(modV(st[k] + (pp[k] || 0))) || '+0'}</span><div class="pm"><button type="button" data-g="asi" data-v="${k}" data-d="-1"${pp[k] ? '' : ' disabled'} aria-label="Meno ${s}">−</button><button type="button" data-g="asi" data-v="${k}" data-d="1"${tot >= 2 || st[k] + (pp[k] || 0) >= 20 ? ' disabled' : ''} aria-label="Più ${s}">+</button></div></div>`).join('')}</div>` : talentiHtml(G, ctx)}`;
    }
    if (p === 'scelte') return `<h4>Le scelte di questo livello</h4>${scelteLiv(ctx).map(sc => sceltaHtml(G, sc, ctx)).join('')}`;
    if (p === 'inc') return corpoInc(G, ctx);
    if (p === 'razza') {
      const r = R.razze.find(x => x.id === C.razza), sr = r?.sotto?.find(x => x.id === C.sotto);
      const asiT = x => x.asi === 'libero' ? '+2 e +1 a scelta' : [Object.entries(x.asi || {}).map(([k, n]) => `+${n} ${SIGLA[k]}`).join(' '), x.asiScelta ? `+${x.asiScelta[0]} a ${x.asiScelta[1]} a scelta` : ''].filter(Boolean).join(', ');
      const tutte = !r || G.vedi === 'razza';
      let h = `<h4>Razza${tutte ? '' : ' <button type="button" class="chip" data-g="vedi" data-v="razza">Cambia razza</button>'}</h4>${tutte ? cercaBox('razza', 'Cerca una razza…') : ''}<div class="gcards">${R.razze.filter(x => tutte || x.id === C.razza).map(x => `<button type="button" class="gc${C.razza === x.id ? ' on' : ''}" data-g="razza" data-v="${x.id}" data-n="${esc(norm(x.nome))}"><b>${esc(x.nome)}</b><span class="src">${esc(x.fonte)}</span><small>${esc([asiT(x), x.vel !== 9 ? metriT(x.vel) : '', ...(x.tratti || []).slice(0, 3).map(t => t[0])].filter(Boolean).join(' · '))}</small></button>`).join('')}</div>`;
      if (!r) return h;
      if (r.sotto?.length) h += `<h5>Sottorazza</h5><div class="gcards">${r.sotto.map(x => card('sottor', x.id, C.sotto === x.id, x.nome, [asiT(x), ...(x.tratti || []).map(t => t[0])].filter(Boolean).join(' · '), x.fonte || '', '')).join('')}</div>`;
      const fisso = r.asi !== 'libero' && !(sr?.togliAsi), sch = sr?.asiScelta || r.asiScelta;
      h += `<h5>Bonus ai punteggi</h5>`;
      if (r.asi === 'libero' || C.libero) h += `<div class="seg"><button type="button" data-g="schema" data-v="21" class="${C.schema === '21' ? 'on' : ''}">+2 e +1</button><button type="button" data-g="schema" data-v="111" class="${C.schema === '111' ? 'on' : ''}">+1, +1 e +1</button></div>
        ${C.schema === '21' ? `<div class="riga"><span>+2 a</span><div class="chips">${CAR.map(([k, s]) => `<button type="button" class="chip${C.asiL[k] === 2 ? ' on' : ''}" data-g="asil" data-v="${k}" data-d="2">${s}</button>`).join('')}</div></div><div class="riga"><span>+1 a</span><div class="chips">${CAR.map(([k, s]) => `<button type="button" class="chip${C.asiL[k] === 1 ? ' on' : ''}" data-g="asil" data-v="${k}" data-d="1"${C.asiL[k] === 2 ? ' disabled' : ''}>${s}</button>`).join('')}</div></div>`
          : `<div class="riga"><span>+1 a tre</span><div class="chips">${CAR.map(([k, s]) => `<button type="button" class="chip${C.asiL[k] === 1 ? ' on' : ''}" data-g="asil" data-v="${k}" data-d="1">${s}</button>`).join('')}</div></div>`}`;
      else h += `<p>${esc(asiT({ asi: { ...(sr?.togliAsi ? {} : r.asi), ...(sr?.asi || {}) } }) || '—')}</p>${sch ? `<div class="riga"><span>+${sch[0]} a ${sch[1]} a scelta</span><div class="chips">${CAR.filter(([k]) => !sch[2].includes(k)).map(([k, s]) => `<button type="button" class="chip${C.asiS.includes(k) ? ' on' : ''}" data-g="asis" data-v="${k}">${s}</button>`).join('')}</div></div>` : ''}`;
      if (r.asi !== 'libero' && fisso && !/^umano/.test(C.sotto || '')) h += `<label class="gck"><input type="checkbox" data-g="libero"${C.libero ? ' checked' : ''}><span>Sposta i bonus dove vuoi (regola del Calderone di Tasha)</span></label>`;
      h += scelteRazza(G).map(sc => sceltaHtml(G, sc, ctx)).join('');
      h += `<div class="box"><h5>Tratti</h5><ul class="nov">${[...(r.tratti || []), ...(sr?.tratti || [])].map(([n, t]) => `<li><b>${esc(n)}</b> · ${esc(t)}</li>`).join('')}<li><b>Velocità</b> · ${metriT(sr?.vel || r.vel)}${r.lingue ? ` · <b>Lingue</b> · ${esc(r.lingue)}` : ''}</li></ul></div>`;
      return h;
    }
    if (p === 'classe') {
      const k = C.cl && R.classi[C.cl];
      let h = `<h4>Classe</h4><div class="gcards">${Object.entries(R.classi).map(([id, x]) => card('classe', id, C.cl === id, x.nome, `${x.prim} · TS ${x.ts.map(t => SIGLA[t]).join(', ')}${x.inc ? ' · incantesimi' : ''}`, `d${x.dv} · ${x.fonte}`, '')).join('')}</div>`;
      if (!k) return h;
      const ab = k.abil[1] === 'tutte' ? ABIL.map(x => x[0]) : k.abil[1], base = baseCrea({ ...G, cr: { ...C, abilC: [] } });
      h += `<h5>Abilità della classe <span class="cnt${C.abilC.length >= k.abil[0] ? ' ok' : ''}">${C.abilC.length}/${k.abil[0]}</span></h5><div class="chips">${ab.map(a => `<button type="button" class="chip${C.abilC.includes(a) ? ' on' : ''}" data-g="abilc" data-v="${a}"${num(base['ab_' + a]) && !C.abilC.includes(a) ? ' disabled title="Ce l\'hai già dalla razza o dal background"' : ''}>${esc(nomeAb(a))}</button>`).join('')}</div>`;
      if (k.sotto.liv === 1) h += `<h5>${esc(k.sotto.nome)}</h5><p class="hint">Passa sopra una carta o toccala per vedere cosa ti dà, livello per livello.</p><div class="gcards gso">${(R.sotto[C.cl] || []).map(x => card('sotto', x.id, G.sotto === x.id, x.nome, x.desc, x.fonte, '', coloreCl(C.cl)) + (G.sotto === x.id ? `<div class="arch-in">${archHtml(R, C.cl, x, 1)}</div>` : '')).join('')}</div>`;
      h += scelteLiv(ctx).map(sc => sceltaHtml(G, sc, ctx)).join('');
      h += `<div class="box"><h5>Al 1° livello</h5><ul class="nov">${(k.liv[1] || []).map(([n, t]) => `<li><b>${esc(n)}</b> · ${esc(t)}</li>`).join('')}<li><b>Competenze</b> · ${esc(k.comp)}</li></ul></div>`;
      return h;
    }
    if (p === 'car') {
      const b = bonusRazza(G), pb = puntiBase(G), vals = C.metodo === 'tiri' ? C.tiri : R.standard;
      let h = `<h4>Caratteristiche</h4><div class="seg"><button type="button" data-g="metodo" data-v="standard" class="${C.metodo === 'standard' ? 'on' : ''}">Serie standard</button><button type="button" data-g="metodo" data-v="pb" class="${C.metodo === 'pb' ? 'on' : ''}">Acquisto a punti</button>${T.pag ? '' : `<button type="button" data-g="metodo" data-v="tiri" class="${C.metodo === 'tiri' ? 'on' : ''}">Tira 4d6</button>`}<button type="button" data-g="metodo" data-v="manuale" class="${C.metodo === 'manuale' ? 'on' : ''}">Li scrivo io</button></div>`;
      if (C.metodo === 'standard') h += `<p class="hint">Assegna 15, 14, 13, 12, 10 e 8: un valore per caratteristica.</p>`;
      if (C.metodo === 'pb') h += `<p class="hint">27 punti: da 8 a 15 prima dei bonus della razza. Spesi: ${costoPb(G)}/27.</p>`;
      if (C.metodo === 'tiri') h += C.tiri.length ? `<p class="hint">Risultati: ${C.tiri.join(', ')}. Ora assegnali.</p>` : `<div class="riga"><button type="button" class="gbtn p" data-g="tiri">🎲 Tira 6 volte 4d6 (tieni i 3 più alti)</button><span class="hint">I tiri escono in chat al Tavolo.</span></div>`;
      if (C.metodo === 'manuale') h += `<p class="hint">Scrivi i punteggi prima dei bonus della razza.</p>`;
      const usati = new Set(Object.values(C.ass));
      h += `<div class="ab6">${CAR.map(([k, s]) => {
        let ctl = '';
        if (['standard', 'tiri'].includes(C.metodo) && vals.length) ctl = `<select data-gi="ass" data-k="${k}" aria-label="${s}"><option value="">—</option>${vals.map((v, i) => `<option value="${i}"${C.ass[k] === i ? ' selected' : ''}${usati.has(i) && C.ass[k] !== i ? ' disabled' : ''}>${v}</option>`).join('')}</select>`;
        if (C.metodo === 'pb') ctl = `<div class="pm"><button type="button" data-g="pb" data-v="${k}" data-d="-1"${C.pb[k] <= 8 ? ' disabled' : ''}>−</button><button type="button" data-g="pb" data-v="${k}" data-d="1"${C.pb[k] >= 15 ? ' disabled' : ''}>+</button></div>`;
        if (C.metodo === 'manuale') ctl = `<input type="number" min="3" max="20" value="${C.man[k] ?? ''}" data-gi="man" data-k="${k}" aria-label="${s}" style="width:58px">`;
        const tot = Math.min(20, pb[k] + (b[k] || 0));
        return `<div class="ab${b[k] ? ' up' : ''}"><small>${s}</small><b>${tot}</b><span>${segnoP(modV(tot)) || '+0'}${b[k] ? ` · razza +${b[k]}` : ''}</span>${ctl}</div>`;
      }).join('')}</div>`;
      if (ctx?.tal) h += `<h4>Talento della razza</h4>${talentiHtml(G, ctx)}`;
      return h;
    }
    if (p === 'bg') {
      const bg = R.background.find(x => x.id === C.bg);
      const tutti = !bg || G.vedi === 'bg';
      let h = `<h4>Background${tutti ? '' : ' <button type="button" class="chip" data-g="vedi" data-v="bg">Cambia background</button>'}</h4>${tutti ? cercaBox('bg', 'Cerca un background…') : ''}<div class="gcards">${R.background.filter(x => tutti || x.id === C.bg).map(x => `<button type="button" class="gc${C.bg === x.id ? ' on' : ''}" data-g="bg" data-v="${x.id}" data-n="${esc(norm(x.nome))}"><b>${esc(x.nome)}</b><span class="src">${esc(x.fonte)}</span><small>${esc([x.abil.map(nomeAb).join(', '), x.abilScelta ? `${x.abilScelta} a scelta` : '', x.priv?.[0]].filter(Boolean).join(' · '))}</small></button>`).join('')}</div>`;
      if (bg) h += scelteBg(G).map(sc => sceltaHtml(G, sc, ctx)).join('') + `<div class="box"><ul class="nov"><li><b>${esc(bg.priv?.[0] || 'Privilegio')}</b> · ${esc(bg.priv?.[1] || bg.testo || '')}</li>${bg.strumenti ? `<li><b>Strumenti</b> · ${esc(bg.strumenti)}</li>` : ''}<li><b>Equipaggiamento</b> · ${esc(bg.equip || '')}, ${bg.mo || 0} mo</li></ul></div>`;
      return h;
    }
    if (p === 'equip') {
      const k = R.classi[C.cl], bg = R.background.find(x => x.id === C.bg), d = ctx.d;
      let h = `<h4>Equipaggiamento</h4><label class="gck"><input type="checkbox" data-g="oro"${C.oro ? ' checked' : ''}><span>Al posto dell'equipaggiamento della classe prendo le monete d'oro (${esc(k.oro)} mo)</span></label>`;
      if (!C.oro) h += k.equip.map((riga, i) => { const o = riga.split(' oppure '); return `<div class="riga">${o.length > 1 ? `<select data-gi="eq" data-i="${i}" aria-label="Scelta ${i + 1}">${o.map((x, j) => `<option value="${j}"${(C.eq[i] || 0) === j ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select>` : `<span>• ${esc(riga)}</span>`}</div>`; }).join('');
      if (bg) h += `<p class="hint">Dal background: ${esc(bg.equip)}.</p>`;
      h += `<div class="riga"><label>Monete d'oro <input type="number" min="0" value="${C.mo ?? (bg?.mo || 0)}" data-gi="mo" style="width:90px"></label></div>
        <h5>Armatura e armi in mano</h5><div class="riga"><select data-gi="arm" aria-label="Armatura"><option value="">Nessuna armatura</option>${R.armature.filter(a => a[2] !== 'scudo').map(a => `<option${C.arm === a[0] ? ' selected' : ''}>${esc(a[0])}</option>`).join('')}</select><label class="gck"><input type="checkbox" data-g="scudo"${C.scudo ? ' checked' : ''}><span>Scudo</span></label><span>CA <b>${d.ca}</b></span></div>
        <div class="riga">${[0, 1, 2].map(i => `<select data-gi="arma" data-i="${i}" aria-label="Arma ${i + 1}"><option value="">— arma ${i + 1} —</option>${['semplice', 'guerra'].map(c => `<optgroup label="${c === 'guerra' ? 'Armi da guerra' : 'Armi semplici'}">${R.armi.filter(a => a[3] === c).map(a => `<option${C.armi[i] === a[0] ? ' selected' : ''}>${esc(a[0])}</option>`).join('')}</optgroup>`).join('')}</select>`).join('')}</div>
        <p class="hint">Le armi scelte diventano attacchi nella scheda, con bonus e danni già calcolati. Competenze della classe: ${esc(k.comp)}.</p>`;
      return h;
    }
    if (p === 'dett') {
      const maxL = isDM() ? 20 : Math.max(1, num(G.d0.liv_concesso) || 1);
      const ALL = ['Legale buono', 'Neutrale buono', 'Caotico buono', 'Legale neutrale', 'Neutrale puro', 'Caotico neutrale', 'Legale malvagio', 'Neutrale malvagio', 'Caotico malvagio'];
      return `<h4>Dettagli</h4><div class="riga"><label>Allineamento <select data-gi="all"><option value="">—</option>${ALL.map(a => `<option${C.all === a ? ' selected' : ''}>${a}</option>`).join('')}</select></label></div>
        ${[['pers', 'Tratti caratteriali'], ['ideali', 'Ideali'], ['legami', 'Legami'], ['difetti', 'Difetti']].map(([k, l]) => `<h5>${l}</h5><textarea data-gi="${k}" rows="2">${esc(C[k])}</textarea>`).join('')}
        ${maxL > 1 ? `<h4>Livello di partenza</h4><div class="riga"><select data-gi="fino">${Array.from({ length: maxL }, (_, i) => `<option value="${i + 1}"${(G.fino || 1) === i + 1 ? ' selected' : ''}>${i + 1}° livello</option>`).join('')}</select><span class="hint">Si crea al 1° livello, poi si sale un livello alla volta con le stesse scelte guidate.</span></div>` : ''}`;
    }
    if (p === 'riep') {
      const r = applicaLiv(G); if (!r) return '<p class="hint">Mancano ancora delle scelte.</p>';
      const d0 = G.tipo === 'crea' ? null : G.d0, d = r.d, ko = passiDi(G).map(x => [x, manca(G, x)]).filter(([, m]) => m);
      const righe = d0 ? [['Livello', d0.livello || 1, d.livello], ['Classe', d0.classe || '—', d.classe], ['PF massimi', d0.pf_max ?? '—', d.pf_max], ['Dadi vita', d0.dadi_vita || '—', d.dadi_vita], ['Bonus di competenza', '+' + compL(num(d0.livello) || 1), '+' + compL(d.livello)], ...CAR.filter(([k]) => num(d0[k]) !== num(d[k])).map(([k, , n]) => [n, d0[k] ?? 10, d[k]])].filter(([, a, b]) => String(a) !== String(b) || /Classe|PF/.test(String(a)))
        : [['Razza', '', d.razza], ['Classe', '', d.classe], ['Background', '', d.background], ['PF', '', d.pf_max], ['CA', '', d.ca], ['Velocità', '', d.velocita]];
      return `<h4>Riepilogo</h4>${ko.length ? `<div class="box ko">${ko.map(([x, m]) => `<p>⚠ ${NOMIP[x]}: ${esc(m)}</p>`).join('')}</div>` : ''}
        <table class="dif"><thead><tr><th></th>${d0 ? '<th>Prima</th>' : ''}<th>${d0 ? 'Dopo' : ''}</th></tr></thead><tbody>${righe.map(([l, a, b]) => `<tr><td>${esc(l)}</td>${d0 ? `<td>${esc(a)}</td>` : ''}<td>${esc(b)}</td></tr>`).join('')}</tbody></table>
        <h5>Novità</h5><ul class="nov">${r.righe.filter(([l]) => !['Punti ferita', ...CAR.map(x => x[2])].includes(l)).map(([l, t]) => `<li><b>${esc(l)}</b> · ${esc(t)}</li>`).join('') || '<li>Niente di nuovo da segnare.</li>'}</ul>
        <p class="hint">Confermando la scheda si aggiorna da sola${T.pag ? '' : ' e il Tavolo lo annuncia in chat'}. Se qualcosa non torna, l'ultimo livello si può annullare dalla «Storia dei livelli».${G.fino > (d.livello || 1) ? ` Dopo si passa al ${(d.livello || 1) + 1}° livello, fino al ${G.fino}°.` : ''}</p>`;
    }
    return '';
  }
  function anteprimaG(G) {
    const R = G.R; let r = null; try { r = applicaLiv(G); } catch (e) { console.warn(e); }
    const d = r?.d || (G.tipo === 'crea' ? baseCrea(G) : G.d0), d0 = G.tipo === 'crea' ? null : G.d0, s = T.schede.get(G.id), foto = s && fotoScheda(s);
    const sub = [d.razza, d.classe ? `${d.classe} ${d.livello || ''}`.trim() : ''].filter(Boolean).join(' · ') || 'Ancora da scegliere';
    const ab = CAR.map(([k, sg]) => { const v = num(d[k]) ?? 10, up = d0 ? v > (num(d0[k]) ?? 10) : false; return `<div class="ab${up ? ' up' : ''}"><small>${sg}</small><b>${v}</b><span>${segnoP(modV(v)) || '+0'}</span></div>`; }).join('');
    const kv = [['PF', d0 ? `${d0.pf_max ?? '—'} → ${d.pf_max ?? '—'}` : d.pf_max || '—'], ['CA', d.ca ?? '—'], ['Competenza', '+' + compL(num(d.livello) || 1)], ['Velocità', d.velocita || '—'], ['Dadi vita', d.dadi_vita || '—']];
    const nov = (r?.righe || []).filter(([l]) => l !== 'Punti ferita').slice(0, 14);
    const cid = G.tipo === 'crea' ? G.cr?.cl : (G.classi[0]?.id || G.cl);
    return `<h5>Anteprima della scheda</h5><div class="pv"${coloreCl(cid)}><i style="${foto ? `background-image:url('${esc(foto)}')` : ''}">${foto ? '' : esc(iniziali(G.nome))}</i><div><b>${esc(G.nome)}</b><small>${esc(sub)}</small></div></div>
      <div class="ab6 pic">${ab}</div><dl class="kv">${kv.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
      ${nov.length ? `<h5>Novità</h5><ul class="nov">${nov.map(([l, t]) => `<li><b>${esc(l)}</b> · ${esc(t)}</li>`).join('')}</ul>` : ''}`;
  }
  // un messaggio in chat anche dalla pagina del personaggio (fuori dal Tavolo non c'è la chat aperta)
  function diInChat(testo) {
    if (T.chat && !T.pag) return annuncia(testo).catch(() => { });
    return SB.rpc('tavolo_scrivi', { p_testo: testo, p_per: null }).then(() => { }, () => { });
  }
  async function confermaGuida(G) {
    const s = T.schede.get(G.id); if (!s) return;
    const passi = passiDi(G), ko = passi.find(x => manca(G, x)); if (ko) { G.passo = passi.indexOf(ko); return disegnaGuida(G); }
    const lv0 = clamp(num(s.dati.livello) || 1, 1, 20);
    if (G.tipo === 'liv' && !isDM() && !(num(s.dati.liv_concesso) > lv0)) return toast('Il DM non ti ha ancora concesso il prossimo livello.', 'err');
    if ((num(s.dati.livello) || 0) !== (num(G.d0.livello) || 0)) return toast('Intanto la scheda è cambiata: chiudi e riapri la procedura.', 'err');
    if (G.tipo === 'crea' && !schedaVuota(s) && !await ask(`La scheda di **${s.nome}** ha già dei dati: verranno sostituiti (storia e note restano). Si può tornare indietro dalla Storia dei livelli.`, { ok: 'Sostituisci', danger: true, title: 'Nuovo personaggio' })) return;
    const r = applicaLiv(G), d = r.d, d0 = s.dati, patch = {}, prima = {};
    const TIENI = ['storia_livelli', 'forma', 'storia', 'aspetto', 'alleati', 'tesoro', 'note', 'eta', 'altezza', 'peso', 'occhi', 'pelle', 'capelli', 'liv_concesso', 'condizioni', 'ispirazione', 'genere'];
    for (const k of new Set([...Object.keys(d), ...(G.tipo === 'crea' ? Object.keys(d0) : [])])) {
      if (k === 'storia_livelli' || (!(k in d) && TIENI.includes(k))) continue;
      const nv = k in d ? d[k] ?? null : null; if (JSON.stringify(nv) === JSON.stringify(d0[k] ?? null)) continue;
      patch[k] = nv; prima[k] = d0[k] ?? null;
    }
    const voce = { liv: d.livello, data: new Date().toISOString(), ...(G.tipo === 'crea' ? { crea: true } : { classe: `${R_nome(G)} ${r.ctx.lc}` }), riepilogo: r.righe.map(([a, b]) => `${a}: ${b}`).slice(0, 40), prima };
    patch.storia_livelli = [...(d0.storia_livelli || []), voce].slice(-20);
    await salvaScheda(s.id, patch, true);
    try { localStorage.removeItem(BOZZA(G)); } catch { }
    G.dlg.close();
    if (G.tipo === 'crea') { diInChat(`✨ Nuovo personaggio: ${s.nome}, ${d.razza.toLowerCase()} ${d.classe.toLowerCase()} di 1° livello${d.background ? ' (' + d.background.toLowerCase() + ')' : ''}.`); toast('Personaggio creato.'); }
    else { diInChat(`⬆ ${s.nome} sale al ${d.livello}° livello (${R_nome(G)} ${r.ctx.lc})! PF massimi ${num(d0.pf_max) ?? '—'} → ${d.pf_max}.`); toast(`${s.nome} è al ${d.livello}° livello.`); }
    if (G.fino > d.livello) setTimeout(() => apriGuida(T.schede.get(s.id), 'liv', G.fino), 350);
  }
  const R_nome = G => G.R.classi[G.tipo === 'crea' ? G.cr.cl : G.cl]?.nome || '';
  const schedaVuota = s => { const d = s.dati || {}; return !String(d.classe || '').trim() && !(d.classi || []).length && !String(d.razza || '').trim() && !(d.privilegi || []).length && !(d.incantesimi || []).length; };

  /* storia dei livelli, annulla l'ultimo, il DM concede i livelli */
  async function annullaLivello(s) {
    const L = s.dati.storia_livelli || [], u = L[L.length - 1]; if (!u) return;
    if (!await ask(`Annullare ${u.crea ? 'la creazione guidata' : `il ${u.liv}° livello`} di **${s.nome}**? La scheda torna com'era prima.`, { ok: 'Annulla', danger: true, title: 'Storia dei livelli' })) return;
    await salvaScheda(s.id, { ...u.prima, storia_livelli: L.slice(0, -1) }, true);
    diInChat(`↩ ${s.nome} torna ${u.crea ? 'alla scheda di prima' : `al ${num(u.prima.livello) || u.liv - 1}° livello`}.`);
  }
  function apriStoria(s) {
    const L = [...(s.dati.storia_livelli || [])].reverse(), data = x => { try { return new Date(x).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return ''; } };
    document.querySelectorAll('dialog.tv-storia[open]').forEach(x => x.close());
    const d = finestra(`<form method="dialog"><h3>Storia dei livelli · ${esc(s.nome)}</h3><div class="tv-storia-l">${L.map((u, i) => `<details${i ? '' : ' open'}><summary><b>${u.crea ? 'Creazione guidata' : u.liv + '° livello'}</b>${u.classe ? ' · ' + esc(u.classe) : ''} <small>${esc(data(u.data))}</small></summary><ul>${(u.riepilogo || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>`).join('') || '<p class="hint">Ancora niente.</p>'}</div>
      ${puoScrivere(s) && L.length ? `<p class="hint">Si può annullare solo l'ultimo passo, uno alla volta.</p><button type="button" class="btn" data-k="annulla">↩ Annulla ${L[0].crea ? 'la creazione' : `il ${L[0].liv}° livello`}</button>` : ''}<menu><button value="cancel" class="btn ghost">Chiudi</button></menu></form>`, 'tv-side tv-centro tv-storia');
    d.querySelector('[data-k=annulla]')?.addEventListener('click', async () => { d.close(); const x = T.schede.get(s.id); if (x) await annullaLivello(x); });
  }
  async function concediLivello(L, togli) {
    const fatti = [];
    for (const s of L) {
      const lv = clamp(num(s.dati.livello) || 1, 1, 20); if (lv >= 20 && !togli) continue;
      const c = togli ? null : Math.min(20, Math.max(num(s.dati.liv_concesso) || 0, lv) + 1);
      await salvaScheda(s.id, { liv_concesso: c }, true); fatti.push([s, c]);
    }
    if (togli || !fatti.length) return;
    diInChat(fatti.length > 1 ? '🎁 Il DM concede un livello a tutto il party! Ognuno sale dal pulsante ⬆ della propria scheda.' : `🎁 ${fatti[0][0].nome} può salire fino al ${fatti[0][1]}° livello!`);
    toast(fatti.length > 1 ? 'Livello concesso a tutto il party.' : `${fatti[0][0].nome} può salire fino al ${fatti[0][1]}° livello.`);
  }
  // la barra sotto le schede della scheda: crea, sali di livello, concedi, storia
  function barraGuida(s, w) {
    const d = s.dati, lv = clamp(num(d.livello) || 1, 1, 20), conc = num(d.liv_concesso) || 0, vuota = schedaVuota(s), st = (d.storia_livelli || []).length, b = [];
    if (w && vuota) b.push('<button type="button" class="su" data-k="g-crea">✨ Crea il personaggio passo passo</button>');
    else if (lv < 20 && w) { if (isDM() || conc > lv) b.push(`<button type="button" class="${conc > lv ? 'su' : ''}" data-k="g-liv">⬆ Sali al ${lv + 1}° livello</button>`); else b.push(`<span class="gnote">⬆ Il ${lv + 1}° livello lo sblocca il DM</span>`); }
    if (isDM() && lv < 20 && !vuota) b.push(`<button type="button" data-k="g-concedi" title="Il giocatore potrà salire di livello da solo, con la procedura guidata">🎁 ${conc > lv ? `Concesso fino al ${conc}° · +1` : 'Concedi un livello'}</button>${conc > lv ? '<button type="button" data-k="g-ritira" title="Ritira il livello concesso" aria-label="Ritira il livello concesso">✕</button>' : ''}`);
    if (st) b.push('<button type="button" data-k="g-storia">📜 Storia dei livelli</button>');
    if (isDM() && w && !vuota) b.push('<button type="button" class="pic" data-k="g-crea" title="Rifà la scheda da capo con la procedura guidata (si può annullare)">✨ Rifai da capo</button>');
    return b.length ? `<div class="gbar">${conc > lv && !isDM() && w ? '<span class="gmsg">🎁 Il DM ti ha concesso un livello!</span>' : ''}${b.join('')}</div>` : '';
  }

  /* ---------- la scheda del Tavolo nella pagina del personaggio ----------
     Il segnalino in alto a destra nella pagina anagrafica apre la stessa scheda del Tavolo, accanto al testo:
     si legge, si tira e si modifica come al tavolo (senza mappa, quindi senza token né turni). */
  function nellaChat(host) {
    host.innerHTML = '';
    const d = document.createElement('dialog'); d.className = 'dlg tv-side tv-sw tv-incol'; d.innerHTML = '<div class="tv-sch"></div>';
    host.append(d); d.addEventListener('close', () => d.remove());
    d.show(); return d;
  }
  function nellaPagina(host) {
    const d = document.createElement('dialog'); d.className = 'dlg tv-side tv-sw tv-pag'; d.innerHTML = '<div class="tv-sch"></div>';
    host.append(d); d.addEventListener('close', () => d.remove());
    onCleanup(() => { if (d.open) d.close(); });
    d.show(); return d;
  }
  let schedeOra = 0, vivoPag = null;
  async function schedePagina(forza) {
    const info = await window.__tavolo?.(); if (!info) return null;
    T.info = T.info || info; T.me = await entraUnaVolta(info);
    if (!forza && T.schede && Date.now() - schedeOra < 20000) return T.schede;
    const [sh, mb] = await Promise.all([SB.from('tavolo_schede').select('*'), SB.from('tavolo_membri').select('*')]);
    if (sh.error) return null;
    T.schede = new Map(sh.data.map(x => [x.id, x])); if (!mb.error) T.membri = mb.data; schedeOra = Date.now();
    return T.schede;
  }
  // la scheda di un personaggio del sito: quella collegata a lui, o (per un membro del party) quella del suo giocatore
  const schedaEnt = (ent, info) => {
    const l = [...(T.schede?.values() || [])], g = (info?.giocatori || []).find(x => x.pg === ent);
    return l.find(x => x.entita === ent && x.tipo === 'pg') || l.find(x => x.entita === ent) || (g && l.find(x => x.giocatore === g.id)) || null;
  };
  // mentre la scheda è aperta nella pagina arrivano le modifiche fatte da altri (il DM o il giocatore)
  function seguiPagina(on) {
    if (vivoPag) { try { SB.removeChannel(vivoPag); } catch { } vivoPag = null; }
    if (!on) return;
    vivoPag = SB.channel('schede-pagina-' + Math.random().toString(36).slice(2, 8)).on('postgres_changes', { event: '*', schema: 'public', table: 'tavolo_schede' }, p => {
      if (!T.schede) return;
      if (p.eventType === 'DELETE') { T.schede.delete(p.old.id); dopoScheda(p.old.id); return; }
      arrivaScheda(p.new);
    }).subscribe();
  }
  window.__schedaSito = {
    // { s: la scheda o null, dm: true se può crearla } oppure null (Tavolo non raggiungibile)
    async stato(ent) {
      try {
        const info = await window.__tavolo?.(); if (!info || !await schedePagina()) return null;
        return { s: schedaEnt(ent, info), dm: info.ruolo === 'dm' };
      } catch { return null; }
    },
    async apri(ent, host) {
      css(); T.pag = true;
      const info = await window.__tavolo?.(); if (!info || !await schedePagina(true)) throw new Error('Il Tavolo non è raggiungibile adesso: riprova tra poco.');
      let s = schedaEnt(ent, info);
      if (!s && isDM()) {
        const e = S.ents?.get(ent);
        if (e?.type === 'pg' && (info.giocatori || []).some(g => g.pg === ent)) { await preparaSchede(info); s = schedaEnt(ent, info); }
        else {
          const forma = await sceltaForma(e?.name || 'personaggio', e); if (!forma) return false;
          s = await creaPng({ nome: e?.name, entita: ent, immagine: e?.portrait?.thumb || null, forma }); if (!s) return false;
          toast('Scheda creata: ' + s.nome + '. Al Tavolo i giocatori non la vedono finché non la mostri (👁).');
        }
      }
      if (!s) throw new Error('Questo personaggio non ha ancora una scheda.');
      apriScheda(s.id, null, host); seguiPagina(true);
      requestAnimationFrame(() => host.querySelectorAll('textarea.auto').forEach(cresci));
      // l'evento arriva dopo la chiusura: se intanto la pagina ha riaperto una scheda, quella resta collegata
      T.sv.d.addEventListener('close', () => { host.dispatchEvent(new Event('chiusa')); if (T.sv?.pag) return; seguiPagina(false); T.pag = false; });
      return true;
    }
  };

  /* ---------- chi è sul sito adesso (Supabase Realtime Presence) ----------
     Il DM e ogni giocatore, appena entrati nel sito, si fanno vedere su un canale riservato ai membri del tavolo
     (con la pagina in cui sono e se il sito è in primo piano). Il DM vede nella barra in alto chi è connesso. */
  const P = { ch: null, me: null, live: false, info: null, stato: {}, da: Date.now(), ko: false };
  const SEZ = { '': 'Home', sessioni: 'Sessioni', schede: 'Schede', scheda: 'Schede', mappe: 'Mappe', manuali: 'Manuali', tavolo: 'Tavolo', cerca: 'Ricerca', cronologia: 'Cronologia', idee: 'Idee' };
  const sezione = () => { const k = location.hash.replace(/^#\/?/, '').split(/[/?]/)[0]; return SEZ[k] || (k ? k[0].toUpperCase() + k.slice(1) : 'Home'); };
  const traccia = () => { if (P.ch && P.live) P.ch.track({ nome: P.me.nome, ruolo: P.me.ruolo, giocatore: P.me.giocatore, pagina: sezione(), attivo: !document.hidden, da: P.da }).catch(() => { }); };
  const PCSS = `#online{position:relative;flex:none;z-index:45;font:600 .8rem/1.2 var(--body)}
#online .otog{display:flex;align-items:center;gap:6px;height:34px;padding:0 10px 0 6px;border-radius:17px;background:#00000030;border:1px solid #ffffff30;color:#f5e6c4;cursor:pointer;font:inherit}
#online.open .otog,#online .otog:hover{background:#00000055;border-color:#e7cf9a}
#online .otog .oico{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;margin-left:3px}
#online .ostack{display:flex}
#online .ostack .oav{width:24px;height:24px;margin-left:-7px;border:1.5px solid #3f9a4a}
#online .ostack .oav:first-child{margin-left:0}
#online .ostack .oav.via{border-color:#d9a53a}
#online .on{min-width:8px;font-weight:700;letter-spacing:.02em}
#online.ko .otog{opacity:.55}
#online .olist{display:none;position:absolute;right:0;top:calc(100% + 12px);width:270px;max-width:calc(100vw - 20px);padding:8px;border-radius:12px;background:var(--wine-d,#561820);border:1px solid #e7cf9a80;box-shadow:0 6px 20px #0007;color:#f5e6c4}
#online.open .olist{display:block}
#online .ohd{padding:4px 6px 7px;color:#e7cf9a;font-size:.68rem;letter-spacing:.08em;text-transform:uppercase;border-bottom:1px solid #e7cf9a40;margin-bottom:4px;font-family:Georgia,serif}
#online .orow{display:flex;align-items:center;gap:10px;padding:6px}
#online .orow.off{opacity:.5}
#online .orow b{display:block;font-family:var(--display);font-weight:600;letter-spacing:.03em}
#online .orow small{display:block;font-size:.76rem;color:#e9dcc0cc;font-weight:500}
#online .oav{width:36px;height:36px;border-radius:50%;object-fit:cover;object-position:50% 15%;flex:none;background:#00000040;display:flex;align-items:center;justify-content:center;font:700 .8rem/1 var(--display);color:#f5e6c4;box-sizing:border-box;border:2px solid #ffffff30}
#online .orow .oav.si{border-color:#3f9a4a}#online .orow .oav.via{border-color:#d9a53a}
#online .onote{padding:6px 6px 2px;font-size:.72rem;color:#e9dcc0aa;font-weight:500;border-top:1px solid #e7cf9a30;margin-top:4px}
@media (max-width:620px){#online .otog{padding:0 8px 0 4px;gap:4px}#online .otog .oico{display:none}#online .ostack .oav:nth-child(n+3){display:none}#online .olist{position:fixed;right:10px;top:64px}}`;
  const fotoPg = g => S.ents?.get(g.pg)?.portrait?.thumb || '';
  const avatarSito = (g, cls = '') => { const f = fotoPg(g); return f ? `<img class="oav ${cls}" src="${esc(f)}" alt="">` : `<span class="oav ${cls}">${esc(iniziali(g.name))}</span>`; };
  const durata = ms => { const m = Math.max(0, Math.round(ms / 60000)); return m < 1 ? 'da adesso' : m < 60 ? `da ${m} min` : `da ${Math.floor(m / 60)} h ${m % 60 ? (m % 60) + ' min' : ''}`.trim(); };
  function disegnaPresenza() {
    const box = document.getElementById('online'); if (!box) return;
    const vivi = new Map();
    for (const a of Object.values(P.stato)) for (const x of a) if (x.giocatore) { const p = vivi.get(x.giocatore); if (!p || (x.attivo && !p.attivo)) vivi.set(x.giocatore, x); }
    const gio = P.info?.giocatori || [], su = gio.filter(g => vivi.has(g.id));
    for (const [id, x] of vivi) if (!gio.some(g => g.id === id)) su.push({ id, name: x.nome });
    box.classList.toggle('ko', P.ko || !P.live);
    const tog = box.querySelector('.otog'), elenco = su.map(g => g.name).join(', ');
    tog.title = P.ko ? 'Non riesco a vedere chi è connesso (serve internet e il Tavolo pronto)' : !P.live ? 'Mi collego…' : su.length ? 'Sul sito adesso: ' + elenco : 'Nessun giocatore sul sito in questo momento';
    tog.setAttribute('aria-label', tog.title);
    tog.innerHTML = `<svg class="oico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.2"/><path d="M3 19c.8-3.4 3.1-5.2 6-5.2s5.2 1.8 6 5.2"/><path d="M16 5.2a3 3 0 0 1 0 5.6M18 13.9c1.6.7 2.6 2.4 3 5.1"/></svg>`
      + (su.length ? `<span class="ostack">${su.slice(0, 4).map(g => avatarSito(g, vivi.get(g.id).attivo ? '' : 'via')).join('')}</span>` : '') + `<span class="on">${su.length}</span>`;
    const tutti = [...su, ...gio.filter(g => !vivi.has(g.id))];
    box.querySelector('.olist').innerHTML = `<div class="ohd">Giocatori sul sito</div>` + (tutti.length ? tutti.map(g => {
      const x = vivi.get(g.id);
      const txt = !x ? 'non connesso' : (x.attivo ? 'su ' + esc(x.pagina || 'sito') : 'sito aperto in secondo piano') + ' · ' + durata(Date.now() - (x.da || Date.now()));
      return `<div class="orow ${x ? '' : 'off'}">${avatarSito(g, x ? (x.attivo ? 'si' : 'via') : '')}<span><b>${esc(g.name)}</b><small>${txt}</small></span></div>`;
    }).join('') : '<div class="orow off"><small>Nessun account dei giocatori.</small></div>')
      + `<div class="onote">${P.ko ? 'Non collegato: controlla internet. Il DM deve aver aperto il Tavolo almeno una volta.' : 'Verde: sul sito adesso · giallo: sito aperto ma in un\'altra app o scheda.'}</div>`;
  }
  function casellaDM() {
    const top = document.querySelector('header.top'); if (!top || document.getElementById('online')) return;
    const s = document.createElement('style'); s.textContent = PCSS; document.head.append(s);
    const box = document.createElement('div'); box.id = 'online';
    box.innerHTML = '<button type="button" class="otog" aria-expanded="false"></button><div class="olist" role="dialog" aria-label="Giocatori sul sito"></div>';
    const tog = box.querySelector('.otog'), apri = o => { box.classList.toggle('open', o); tog.setAttribute('aria-expanded', String(o)); if (o) disegnaPresenza(); };
    tog.onclick = () => apri(!box.classList.contains('open'));
    // il pulsante si ridisegna mentre lo premi: conta il percorso del clic, non l'elemento (che non c'è più)
    document.addEventListener('click', e => { if (!e.composedPath().includes(box)) apri(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') apri(false); });
    top.insertBefore(box, document.getElementById('tools') || document.getElementById('themeBtn'));
    setInterval(() => { if (box.classList.contains('open')) disegnaPresenza(); }, 30000);
    disegnaPresenza();
  }
  async function presenza() {
    const info = await window.__tavolo?.().catch(() => null); if (!info) return;
    P.info = info; if (info.ruolo === 'dm') casellaDM();
    try {
      P.me = await entraUnaVolta(info);
      if (info.ruolo !== 'dm') sigilloLivello(info).catch(() => { });
      const r = await SB.from('tavolo_stato').select('canale').eq('id', 1).maybeSingle();
      if (r.error || !r.data?.canale) throw new Error('canale');
      const ch = P.ch = SB.channel('sito-' + r.data.canale, { config: { presence: { key: P.me.uid } } });
      ch.on('presence', { event: 'sync' }, () => { P.stato = ch.presenceState(); disegnaPresenza(); });
      ch.subscribe(s => { P.live = s === 'SUBSCRIBED'; if (P.live) traccia(); disegnaPresenza(); });
      let tm; const dopo = () => { clearTimeout(tm); tm = setTimeout(traccia, 300); };
      addEventListener('hashchange', dopo); document.addEventListener('visibilitychange', dopo);
    } catch (e) { P.ko = true; disegnaPresenza(); }
  }
  /* ---------- livello concesso: il giocatore se ne accorge subito ----------
     Quando il DM concede un livello, la foto in alto (accanto a «Strumenti») pulsa con un anello d'oro e l'ingranaggio
     diventa ⬆; sulla pagina del suo personaggio il tasto Scheda ha un riflesso dorato e la scritta sotto. Sparisce appena sale. */
  const L = { s: null, ch: null, pg: null };
  const LCSS = `#tools .ttog.lvpend{border-color:#e0c071}
#tools .ttog.lvpend .tav,#tools .ttog.lvpend .ti{animation:lvAnello 1.6s ease-out infinite;border-radius:50%}
#tools .ttog.lvpend .tgear{background:linear-gradient(#f3d98a,#c9a24b);color:#561820;border-color:#fff;font-weight:900;animation:lvTimbro 1.6s ease-in-out infinite}
@keyframes lvAnello{0%{box-shadow:0 0 0 0 #e0c071}100%{box-shadow:0 0 0 11px #e0c07100}}
@keyframes lvTimbro{0%,30%,100%{transform:scale(1)}15%{transform:scale(1.35)}}
.schtag.lvpend{overflow:hidden;border-color:#e0c071;animation:lvAlone 2.2s ease-in-out infinite}
.schtag.lvpend:after{content:'';position:absolute;top:0;bottom:0;width:40%;left:-60%;background:linear-gradient(100deg,transparent,#fff6d6cc,transparent);animation:lvRiflesso 2.2s ease-in-out infinite;pointer-events:none}
@keyframes lvRiflesso{0%{left:-60%}55%,100%{left:130%}}
@keyframes lvAlone{0%,100%{box-shadow:0 2px 8px #0004}50%{box-shadow:0 0 16px 2px #e0c071aa,0 2px 8px #0004}}
.schlv{position:absolute;top:50px;right:12px;z-index:3;font:italic 600 .88rem/1.2 var(--body);color:#e0c071;background:#2c0f14d9;padding:3px 9px;border-radius:8px;pointer-events:none;white-space:nowrap}
.schtag[hidden]+.schlv,.schtag.on+.schlv{display:none}
@media (min-width:621px){.schlv{background:none;padding:0}}`;
  const livDaPrendere = () => { const d = L.s?.dati || {}, c = num(d.liv_concesso) || 0; return c > (num(d.livello) || 1) ? c : 0; };
  function segnaLivello() {
    const n = livDaPrendere(), tog = document.querySelector('#tools .ttog');
    if (tog) {
      if (!tog.dataset.titolo) tog.dataset.titolo = tog.title;
      tog.classList.toggle('lvpend', !!n);
      const g = tog.querySelector('.tgear') || tog.querySelector('.ti'); if (g) g.textContent = n ? '⬆' : '⚙';
      tog.title = n ? `Il DM ti ha concesso il ${n}° livello: apri la tua scheda e premi «Sali di livello»` : tog.dataset.titolo;
    }
    // il tasto Scheda solo sulla pagina del proprio personaggio
    const tag = document.querySelector('.ehead .schtag'), ent = decodeURIComponent((location.hash.match(/^#\/scheda\/([^/?]+)/) || [])[1] || '');
    const mio = !!tag && !!ent && (ent === L.pg || ent === L.s?.entita), on = mio && !!n;
    tag?.classList.toggle('lvpend', on);
    let lab = tag?.parentNode.querySelector('.schlv');
    if (on) { if (!lab) { lab = document.createElement('span'); lab.className = 'schlv'; tag.after(lab); } lab.textContent = `⬆ Puoi salire al ${n}° livello`; }
    else lab?.remove();
  }
  async function leggiLivello() {
    const r = await SB.from('tavolo_schede').select('id,tipo,entita,giocatore,dati').eq('giocatore', P.me.giocatore);
    if (r.error) return;
    L.s = r.data.find(x => x.tipo === 'pg' && (!L.pg || x.entita === L.pg)) || r.data.find(x => x.tipo === 'pg') || null; segnaLivello();
  }
  async function sigilloLivello(info) {
    if (!P.me?.giocatore || L.ch) return;
    L.pg = info.pg || null;
    const st = document.createElement('style'); st.textContent = LCSS; document.head.append(st);
    await leggiLivello();
    // il DM concede o il giocatore sale (anche da un altro dispositivo): arriva subito
    L.ch = SB.channel('livello-' + P.me.giocatore).on('postgres_changes', { event: '*', schema: 'public', table: 'tavolo_schede', filter: 'giocatore=eq.' + P.me.giocatore }, () => leggiLivello().catch(() => { })).subscribe();
    // la pagina si ridisegna a ogni cambio di sezione: il tasto Scheda è nuovo e va segnato di nuovo
    const v = document.getElementById('view'); if (v) new MutationObserver(segnaLivello).observe(v, { childList: true });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) leggiLivello().catch(() => { }); });
  }
  // un attimo dopo l'apertura, per non rallentare la prima pagina
  setTimeout(() => presenza().catch(() => { }), 1500);
})();

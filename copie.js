/* Campagna D&D — la copia dei dati per ogni giocatore e per gli ospiti.
   È la stessa regola di copia() in strumenti/pubblica.py, scritta per il browser: il DM, salvando dal sito, prepara
   da sé le copie dei giocatori (che poi cifra con la password di ciascuno) senza passare da Claude.
   Se cambia una delle due, va cambiata anche l'altra: strumenti/prova_copie.py controlla che diano lo stesso risultato. */
(root => {
  'use strict';
  const ORDINE = ['entities', 'bodies', 'sessions', 'sbodies', 'events', 'links', 'maps', 'pins', 'regions', 'meta', 'blobs'];
  const SEZIONE_DM = /\bDM\b/;
  const NOTA_DM = /\s*\*\(Dalla scaletta del DM: da integrare con il resoconto\.\)\*/g;
  const VOCE_DM = /^(\*Dalla scaletta del DM\.\*|Secondo la scaletta|\*\(Solo DM\)\*)/;
  // paragrafo di un riassunto che solo il DM deve vedere
  const PARAGRAFO_DM = /^\*\(Solo DM\)\*[^\n]*(\n\n|\n|$)/gm;
  // [DM]…[/DM] e [PER Sam, Violet]…[/PER]: senza chiusura arrivano fino in fondo (come il $ di Python, prima dell'ultimo a capo)
  const SPAN_DM = /\[DM\][\s\S]*?(?:\[\/DM\]|(?=\n?$))/g;
  const NOTA_DM_SESSIONE = /^\*Riassunto ricavato dalla scaletta del DM[^*\n]*\*\s*/gm;
  const SPAN_PER = /\[PER ([^\]]*)\]([\s\S]*?)(?:\[\/PER\]|(?=\n?$))/g;
  const LINK = /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g;

  const giocatori = d => ((d.stores.meta.giocatori || {}).v) || [];
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const filtra = (o, f) => Object.fromEntries(Object.entries(o).filter(([k, v]) => f(v, k)));
  const mappa = (o, f) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, f(v, k)]));

  // copia dei dati per il giocatore chi (id), o per gli ospiti (null: solo ciò che vedono tutti i giocatori)
  function copia(d, chi = null) {
    const S = d.stores, G = giocatori(d);
    const tutti = G.map(g => g.id);
    const nomi = {}; for (const g of G) nomi[g.name.toLowerCase()] = g.id; for (const g of G) nomi[g.id] = g.id;
    const tuttiIn = ids => tutti.every(x => ids.has(x));
    // senza vis la vede chiunque; vis: [] non la vede nessun giocatore
    const vede = o => { const v = o.vis; return v === undefined || v === null || (chi ? v.includes(chi) : tuttiIn(new Set(v))); };
    const per = (_, lista, testo) => {
      const ids = new Set(lista.split(',').map(x => nomi[x.trim().toLowerCase()]).filter(x => x !== undefined));
      return (chi ? ids.has(chi) : tuttiIn(ids)) ? testo : '';
    };
    const senza = o => { const r = { ...o }; delete r.vis; return r; };
    const frase = t => t.replace(SPAN_DM, '').replace(SPAN_PER, per);
    const pulisci = (o, campi) => { const r = { ...o }; for (const c of campi) if (typeof o[c] === 'string') r[c] = frase(o[c]).trim(); return senza(r); };
    const E = {}, nascoste = {};
    for (const [k, e] of Object.entries(S.entities)) {
      if (e.discovered !== false && vede(e)) E[k] = pulisci(e, ['brief', 'status']); else nascoste[k] = e.name;
    }
    const testo = t => frase(t.replace(LINK, (m, id, alias) => has(nascoste, id) ? (alias || nascoste[id]) : m).replace(NOTA_DM, ''));

    // quest personale (quest: true nella scheda di un PG): solo il giocatore di quel PG, qualunque cosa dica «Mostra a:»
    const pgDi = {}; for (const g of G) pgDi[g.pg ?? null] = g.id;
    const questOk = (k, s) => !s.quest || (chi !== null && (has(pgDi, k) ? pgDi[k] : k.startsWith('pg-') ? k.slice(3) : null) === chi);

    const bodies = {};
    for (const k of Object.keys(E)) {
      const b = S.bodies[k]; if (!b) continue;
      bodies[k] = { ...b, sections: b.sections.filter(s => !s.dm && vede(s) && questOk(k, s) && !SEZIONE_DM.test(s.title))
        .map(s => senza({ ...s, entries: s.entries.filter(e => !e.dm && vede(e) && !VOCE_DM.test(e.text)).map(e => senza({ ...e, text: testo(e.text) })) })) };
    }
    const mappe = filtra(S.maps, m => m.discovered !== false);
    const pins = filtra(S.pins, p => p.discovered !== false && !has(nascoste, p.entityId ?? null) && has(mappe, p.mapId));
    const usati = new Set(Object.keys(mappe));
    const foto = o => { for (const ph of o.photos || []) for (const x of [ph.id, ph.tid]) if (x) usati.add(x); };
    for (const [k, e] of Object.entries(E)) { if (e.portrait) usati.add('portrait-' + k); foto(e); }
    for (const p of Object.values(pins)) foto(p);
    const chiavi = d.blobkeys || {};
    const leggibile = aid => (has(d.blobmap, aid) ? d.blobmap[aid] : 'priv/').startsWith('blobs/') || (!!chi && has(chiavi, aid));
    const blobs = filtra(S.blobs, (b, k) => usati.has(k) && leggibile(b.aid));
    const gen = S.meta.general, g = { ...gen, v: { ...gen.v, text: testo(gen.v.text) } };
    const stores = {
      entities: E,
      bodies,
      sessions: mappa(S.sessions, v => pulisci(v, ['brief', 'short'])),
      sbodies: mappa(S.sbodies, b => ({ ...b, summary: testo(b.summary).replace(NOTA_DM_SESSIONE, '').replace(PARAGRAFO_DM, '').trim(), docs: [] })),
      events: mappa(filtra(S.events, v => !v.dm && vede(v) && !VOCE_DM.test(v.text)), v => senza({ ...v, text: testo(v.text), ents: v.ents.filter(x => has(E, x)) })),
      links: mappa(filtra(S.links, l => has(E, l.from) && has(E, l.to) && !l.dm && vede(l)), senza),
      maps: mappe,
      pins,
      regions: filtra(S.regions, r => has(mappe, r.mapId) && !has(nascoste, r.entityId ?? null)),
      meta: mappa(filtra(S.meta, (v, k) => !['generalHist', 'giocatori', 'segnalazioni'].includes(k)), (v, k) => k === 'general' ? g : v),
      blobs
    };
    const out = { dataVersion: d.dataVersion, stores: Object.fromEntries(ORDINE.map(k => [k, stores[k]])), blobmap: Object.fromEntries(Object.values(blobs).map(b => [b.aid, d.blobmap[b.aid]])) };
    if (chi) {
      const gi = G.find(x => x.id === chi);
      out.player = { id: chi, name: gi.name, pg: gi.pg ?? null };
      out.blobkeys = Object.fromEntries(Object.values(blobs).filter(b => has(chiavi, b.aid)).map(b => [b.aid, chiavi[b.aid]]));
      const token = ((S.meta.segnalazioni || {}).v || {}).token;
      if (token) out.segnalazioni = token; // chiave GitHub per aprire le segnalazioni senza account: solo nei dati cifrati dei giocatori
    }
    return out;
  }

  const api = { copia, giocatori, ORDINE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.__copie = api;
})(typeof window !== 'undefined' ? window : globalThis);

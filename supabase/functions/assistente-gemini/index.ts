// L'assistente del sito con Gemini: solo per il DM. La chiave di Google AI Studio sta in tavolo_ai (tavolo/tappa-23.sql),
// che il browser non può leggere: la legge solo questa funzione, quindi i giocatori non la vedono mai.
// POST (con il login del DM in Authorization) { system, messages: [{ role: 'user'|'assistant', content }], max?, effort? }
//   → la risposta di Gemini in streaming (text/event-stream, come streamGenerateContent?alt=sse)
// POST { prova: true } → { ok, modello } per controllare che la chiave funzioni.
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
const G = 'https://generativelanguage.googleapis.com/v1beta';
// registro per capire dove si ferma una richiesta (mai la chiave)
const t0 = () => Date.now();
const log = (inizio: number, ...x: unknown[]) => console.log(`[assistente ${Date.now() - inizio}ms]`, ...x);
const entro = (ms: number) => AbortSignal.timeout(ms);

// il modello «auto»: il Gemini Pro più recente che la chiave può usare (poi Flash, se Pro non c'è)
let SCELTO: { chiave: string, modello: string, lista: string[], ts: number } | null = null;
// come mandare la chiave: le «AIza…» con x-goog-api-key; i formati nuovi (es. «AQ.…») si provano anche come Bearer
let MODO: { chiave: string, bearer: boolean } | null = null;
const intest = (chiave: string): Record<string, string> => MODO?.chiave === chiave && MODO.bearer ? { Authorization: 'Bearer ' + chiave } : { 'x-goog-api-key': chiave };
async function modelloAuto(chiave: string) {
  if (SCELTO && SCELTO.chiave === chiave && Date.now() - SCELTO.ts < 6 * 3600e3) return SCELTO.lista;
  let r = await fetch(`${G}/models?pageSize=1000`, { headers: { 'x-goog-api-key': chiave }, signal: entro(20000) });
  console.log('[assistente] elenco modelli (x-goog-api-key):', r.status);
  MODO = { chiave, bearer: false };
  if (!r.ok && !chiave.startsWith('AIza')) {
    const b = await fetch(`${G}/models?pageSize=1000`, { headers: { Authorization: 'Bearer ' + chiave }, signal: entro(20000) });
    console.log('[assistente] elenco modelli (Bearer):', b.status);
    if (b.ok) { r = b; MODO = { chiave, bearer: true }; }
  }
  if (!r.ok) throw Object.assign(new Error(await errore(r)), { stato: r.status });
  const elenco = ((await r.json()).models || []) as { name: string, supportedGenerationMethods?: string[] }[];
  const voto = (n: string) => {
    const m = n.match(/^models\/gemini-(\d+(?:\.\d+)?)-(pro|flash)(-preview)?(?:-(\d\d-\d\d))?$/); if (!m) return -1;
    return parseFloat(m[1]) * 100 + (m[2] === 'pro' ? 10 : 0) + (m[3] ? 0 : 1);
  };
  const ok = elenco.filter(m => (m.supportedGenerationMethods || []).includes('generateContent') && voto(m.name) >= 0)
    .sort((a, b) => voto(b.name) - voto(a.name));
  const lista = ok.map(m => m.name.replace(/^models\//, ''));
  if (!lista.length) lista.push('gemini-2.5-flash');
  console.log('[assistente] modelli in ordine:', lista.slice(0, 8).join(', '));
  SCELTO = { chiave, modello: lista[0], lista, ts: Date.now() };
  return lista;
}
async function errore(r: Response) {
  let m = ''; try { const j = await r.json(); m = j.error?.message || ''; } catch { /* niente */ }
  return m || `Gemini ha risposto ${r.status}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ errore: 'solo POST' }, 405);
  const ini = t0(); log(ini, 'richiesta arrivata');
  try { return await gestisci(req, ini); }
  catch (e) {
    const m = (e as Error).name === 'TimeoutError' ? 'Google non ha risposto in tempo: riprova tra poco.' : (e as Error).message || String(e);
    log(ini, 'errore:', m); return json({ errore: m }, 504);
  }
});

async function gestisci(req: Request, ini: number): Promise<Response> {

  // solo il DM: il suo login, controllato con tavolo_e_dm()
  const auth = req.headers.get('Authorization') || '';
  if (!/^Bearer .{20,}/.test(auth)) return json({ errore: 'Entra come DM per usare l\'assistente.' }, 401);
  const url = Deno.env.get('SUPABASE_URL')!;
  const lui = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const dm = await lui.rpc('tavolo_e_dm');
  log(ini, 'controllo DM:', dm.error ? dm.error.message : dm.data);
  if (dm.error || dm.data !== true) return json({ errore: 'L\'assistente è solo per il DM.' }, 403);

  const sb = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const ai = await sb.from('tavolo_ai').select('chiave, modello, ultimo').eq('id', 1).maybeSingle();
  const chiave = ai.data?.chiave || '';
  if (!chiave) return json({ errore: 'Manca la chiave di Gemini: incollala in «Collega l\'assistente».', manca: true }, 412);

  const corpo = await req.json().catch(() => ({}));
  let lista: string[];
  try { lista = await modelloAuto(chiave); }
  catch (e) { if ((e as Error).name === 'TimeoutError') throw e; const s = (e as { stato?: number }).stato || 502; log(ini, 'modelli non letti:', s, (e as Error).message); return json({ errore: (e as Error).message, stato: s }, s); }
  // prima il modello che ha funzionato l'ultima volta (salvato in tavolo_ai.ultimo) o quello scelto dal DM, poi gli altri in ordine
  // (la prova di «Collega» riparte dal più nuovo, così se torna disponibile lo si riprende)
  const scelto = ai.data?.modello && ai.data.modello !== 'auto' ? ai.data.modello
    : !corpo.prova && ai.data?.ultimo && lista.includes(ai.data.ultimo) ? ai.data.ultimo : lista[0];
  const candidati = [scelto, ...lista.filter(m => m !== scelto)].slice(0, 4);
  // Google risponde 503/429/500 quando un modello è sovraccarico: si passa al successivo
  const riprova = (st: number) => st === 503 || st === 429 || st === 500 || st === 504 || st === 404;

  let corpoG: Record<string, unknown>, url2: (m: string) => string, limite: number, pensaPoco = false;
  if (corpo.prova) {
    corpoG = { contents: [{ role: 'user', parts: [{ text: 'Rispondi solo: ok' }] }], generationConfig: { maxOutputTokens: 2000 } };
    url2 = m => `${G}/models/${m}:generateContent`; limite = 15000;
  } else {
    const msgs = Array.isArray(corpo.messages) ? corpo.messages : [];
    if (!msgs.length) return json({ errore: 'Nessuna domanda.' }, 400);
    const testo = (c: unknown) => typeof c === 'string' ? c : Array.isArray(c) ? c.map(x => x?.text || '').join('') : '';
    const contents = msgs.map((m: { role: string, content: unknown }) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: testo(m.content) }] }));
    // i modelli che «pensano» contano anche il ragionamento nel limite: gli diamo più spazio di quanto serva alla risposta
    const max = Math.min(Math.max((Number(corpo.max) || 8000) * 2, 16000), 65536);
    corpoG = { ...(corpo.system ? { systemInstruction: { parts: [{ text: String(corpo.system) }] } } : {}), contents, generationConfig: { maxOutputTokens: max } };
    // all'assistente durante la partita serve una risposta rapida: i Gemini 3 ragionano poco (se il modello non lo accetta si riprova senza)
    if (corpo.effort === 'low') pensaPoco = true;
    url2 = m => `${G}/models/${m}:streamGenerateContent?alt=sse`; limite = 30000;
  }
  let ultimo: Response | null = null, ultimoErr = '';
  for (const [i, m] of candidati.entries()) {
    if (!corpo.prova && i > 2) break; // la risposta vera: al massimo 3 modelli, per restare nei 150 s di Supabase
    let r: Response;
    try {
      // il limite vale per l'arrivo della risposta; lo streaming poi continua senza limite
      const ctl = new AbortController(), t = setTimeout(() => ctl.abort(new DOMException('tempo', 'TimeoutError')), limite);
      const conPensiero = (b: Record<string, unknown>) => ({ ...b, generationConfig: { ...(b.generationConfig as object), thinkingConfig: { thinkingLevel: 'low' } } });
      const poco = pensaPoco && /^gemini-[3-9]/.test(m);
      r = await fetch(url2(m), { method: 'POST', headers: { ...intest(chiave), 'Content-Type': 'application/json' }, body: JSON.stringify(poco ? conPensiero(corpoG) : corpoG), signal: ctl.signal });
      if (poco && r.status === 400) { log(ini, m, 'non accetta thinkingLevel: riprovo senza'); r = await fetch(url2(m), { method: 'POST', headers: { ...intest(chiave), 'Content-Type': 'application/json' }, body: JSON.stringify(corpoG), signal: ctl.signal }); }
      clearTimeout(t);
    } catch (e) { log(ini, m, 'non risponde:', (e as Error).name); ultimoErr = 'Google non ha risposto in tempo: riprova tra poco.'; continue; }
    log(ini, corpo.prova ? 'prova' : 'risposta', m, r.status);
    if (r.ok && (corpo.prova || r.body)) {
      if (SCELTO) SCELTO.modello = m;
      if (ai.data?.ultimo !== m) await sb.from('tavolo_ai').update({ ultimo: m }).eq('id', 1);
      if (corpo.prova) return json({ ok: true, modello: m });
      return new Response(r.body, { headers: { ...CORS, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'X-Modello': m, 'Access-Control-Expose-Headers': 'X-Modello' } });
    }
    if (!riprova(r.status)) return json({ errore: await errore(r), stato: r.status }, r.status);
    ultimo = r;
  }
  if (ultimo) return json({ errore: await errore(ultimo), stato: ultimo.status }, ultimo.status);
  return json({ errore: ultimoErr || 'Gemini non risponde.' }, 504);
}

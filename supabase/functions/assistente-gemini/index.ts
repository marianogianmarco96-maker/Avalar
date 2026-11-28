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

// il modello «auto»: il Gemini Pro più recente che la chiave può usare (poi Flash, se Pro non c'è)
let SCELTO: { chiave: string, modello: string, ts: number } | null = null;
// come mandare la chiave: le «AIza…» con x-goog-api-key; i formati nuovi (es. «AQ.…») si provano anche come Bearer
let MODO: { chiave: string, bearer: boolean } | null = null;
const intest = (chiave: string): Record<string, string> => MODO?.chiave === chiave && MODO.bearer ? { Authorization: 'Bearer ' + chiave } : { 'x-goog-api-key': chiave };
async function modelloAuto(chiave: string) {
  if (SCELTO && SCELTO.chiave === chiave && Date.now() - SCELTO.ts < 6 * 3600e3) return SCELTO.modello;
  let r = await fetch(`${G}/models?pageSize=1000`, { headers: { 'x-goog-api-key': chiave } });
  MODO = { chiave, bearer: false };
  if (!r.ok && !chiave.startsWith('AIza')) {
    const b = await fetch(`${G}/models?pageSize=1000`, { headers: { Authorization: 'Bearer ' + chiave } });
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
  const modello = (ok[0]?.name || 'models/gemini-2.5-pro').replace(/^models\//, '');
  SCELTO = { chiave, modello, ts: Date.now() };
  return modello;
}
async function errore(r: Response) {
  let m = ''; try { const j = await r.json(); m = j.error?.message || ''; } catch { /* niente */ }
  return m || `Gemini ha risposto ${r.status}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ errore: 'solo POST' }, 405);

  // solo il DM: il suo login, controllato con tavolo_e_dm()
  const auth = req.headers.get('Authorization') || '';
  if (!/^Bearer .{20,}/.test(auth)) return json({ errore: 'Entra come DM per usare l\'assistente.' }, 401);
  const url = Deno.env.get('SUPABASE_URL')!;
  const lui = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const dm = await lui.rpc('tavolo_e_dm');
  if (dm.error || dm.data !== true) return json({ errore: 'L\'assistente è solo per il DM.' }, 403);

  const sb = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const ai = await sb.from('tavolo_ai').select('chiave, modello').eq('id', 1).maybeSingle();
  const chiave = ai.data?.chiave || '';
  if (!chiave) return json({ errore: 'Manca la chiave di Gemini: incollala in «Collega l\'assistente».', manca: true }, 412);

  const corpo = await req.json().catch(() => ({}));
  let modello: string;
  try { const auto = await modelloAuto(chiave); modello = ai.data?.modello && ai.data.modello !== 'auto' ? ai.data.modello : auto; }
  catch (e) { const s = (e as { stato?: number }).stato || 502; return json({ errore: (e as Error).message, stato: s }, s); }

  if (corpo.prova) {
    const r = await fetch(`${G}/models/${modello}:generateContent`, {
      method: 'POST', headers: { ...intest(chiave), 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Rispondi solo: ok' }] }], generationConfig: { maxOutputTokens: 200 } })
    });
    if (!r.ok) return json({ errore: await errore(r), stato: r.status }, r.status);
    return json({ ok: true, modello });
  }

  const msgs = Array.isArray(corpo.messages) ? corpo.messages : [];
  if (!msgs.length) return json({ errore: 'Nessuna domanda.' }, 400);
  const testo = (c: unknown) => typeof c === 'string' ? c : Array.isArray(c) ? c.map(x => x?.text || '').join('') : '';
  const contents = msgs.map((m: { role: string, content: unknown }) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: testo(m.content) }] }));
  // i modelli che «pensano» contano anche il ragionamento nel limite: gli diamo più spazio di quanto serva alla risposta
  const max = Math.min(Math.max((Number(corpo.max) || 8000) * 2, 16000), 65536);
  const r = await fetch(`${G}/models/${modello}:streamGenerateContent?alt=sse`, {
    method: 'POST', headers: { ...intest(chiave), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...(corpo.system ? { systemInstruction: { parts: [{ text: String(corpo.system) }] } } : {}),
      contents, generationConfig: { maxOutputTokens: max }
    })
  });
  if (!r.ok || !r.body) return json({ errore: await errore(r), stato: r.status }, r.status);
  return new Response(r.body, { headers: { ...CORS, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'X-Modello': modello, 'Access-Control-Expose-Headers': 'X-Modello' } });
});

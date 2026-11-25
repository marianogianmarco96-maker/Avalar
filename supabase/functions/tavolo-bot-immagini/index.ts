// Immagini delle scene del Tavolo per Claude: solo lettura, solo con la chiave del bot (tavolo_bot, tavolo/tappa-16.sql).
// POST { chiave, scene?: [id...], giorni?: n } → [{ id, nome, larghezza, altezza, creata, url }] con link firmati di 1 ora.
// Usata da strumenti/scene.py. Non legge né scrive nient'altro.
import { createClient } from 'npm:@supabase/supabase-js@2';

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

function uguali(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ errore: 'solo POST' }, 405);
  const corpo = await req.json().catch(() => ({}));
  const chiave = typeof corpo.chiave === 'string' ? corpo.chiave : '';
  if (chiave.length < 32) return json({ errore: 'chiave mancante' }, 401);

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const bot = await sb.from('tavolo_bot').select('chiave').eq('id', 1).maybeSingle();
  if (bot.error || !bot.data || !uguali(bot.data.chiave, chiave)) return json({ errore: 'chiave non valida' }, 401);

  let q = sb.from('tavolo_scene').select('id, nome, mappa, larghezza, altezza, creata').not('mappa', 'is', null).order('creata', { ascending: false }).limit(200);
  if (Array.isArray(corpo.scene) && corpo.scene.length) q = q.in('id', corpo.scene.map(String).slice(0, 200));
  if (Number(corpo.giorni) > 0) q = q.gte('creata', new Date(Date.now() - Number(corpo.giorni) * 86400000).toISOString());
  const sc = await q;
  if (sc.error) return json({ errore: sc.error.message }, 500);

  const out = [];
  for (const s of sc.data) {
    const u = await sb.storage.from('tavolo').createSignedUrl(s.mappa, 3600);
    out.push({ id: s.id, nome: s.nome, larghezza: s.larghezza, altezza: s.altezza, creata: s.creata, url: u.data?.signedUrl ?? null });
  }
  return json(out);
});

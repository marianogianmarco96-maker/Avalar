-- Tavolo virtuale di Avalar — tappa 16: coperture (muretti ½, feritoie ¾) e richieste di coperture automatiche a Claude.
-- Da incollare nell'SQL Editor di Supabase (New query › incolla › Run) dopo le tappe precedenti. Si può rieseguire senza danni.

-- ---------- muri: il tipo di copertura ----------
-- tipo null = muro vero (ferma vista, passo e attacchi); 'meta' = copertura ½ (muretti, tavoli, botti, ringhiere);
-- 'tre' = copertura ¾ (feritoie, banconi alti). nome: che cosa è (tavolo, bancone…); auto: tracciato da Claude.
alter table public.tavolo_muri add column if not exists tipo text;
alter table public.tavolo_muri add column if not exists nome text;
alter table public.tavolo_muri add column if not exists auto boolean not null default false;
alter table public.tavolo_muri drop constraint if exists tavolo_muri_tipo_check;
alter table public.tavolo_muri add constraint tavolo_muri_tipo_check check (tipo is null or tipo in ('meta', 'tre'));

-- ---------- attacco: la copertura si somma alla CA del bersaglio ----------
drop function if exists public.tavolo_attacca(uuid, uuid, int, int, boolean, text, int, text, int);
create or replace function public.tavolo_attacca(p_token uuid, p_bersaglio uuid, p_attacco int, p_adv int default 0, p_privato boolean default false, p_extra text default null, p_inc int default null, p_extra_nome text default null, p_liv int default null, p_cop int default 0)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  a tavolo_token; b tavolo_token; sa tavolo_schede; sb tavolo_schede; att jsonb;
  bonus int; danni text; ca int; tiro tavolo_tiri; td tavolo_tiri; nat int; colpito boolean; critico boolean := false;
  dmg int := 0; ferita jsonb := '{}'; nome_att text; testo text; car text; cd int; dv text; tv tavolo_tiri; ric jsonb; tx tavolo_tiri; extra text := lower(regexp_replace(coalesce(p_extra, ''), '\s+', '', 'g'));
begin
  if not tavolo_e_membro() then raise exception 'Non fai parte del tavolo'; end if;
  select * into a from tavolo_token where id = p_token;
  select * into b from tavolo_token where id = p_bersaglio;
  if a.id is null or b.id is null or a.scena <> b.scena then raise exception 'Token non trovato'; end if;
  if not tavolo_e_dm() and (a.giocatore is null or a.giocatore <> tavolo_mio_giocatore()) then raise exception 'Puoi attaccare solo con il tuo token'; end if;
  if not tavolo_e_dm() and (b.scena <> tavolo_scena_attiva() or b.nascosto) then raise exception 'Bersaglio non valido'; end if;
  if extra <> '' and extra !~ '^\d{0,2}d\d{1,3}([+-]\d{1,3})?(\+\d{0,2}d\d{1,3}([+-]\d{1,3})?)*$' then raise exception 'Danni in più non validi: scrivi per esempio 3d6'; end if;
  sa := tavolo_scheda_di(a);
  att := case when p_inc is not null then tavolo_inc_att(sa, p_inc, p_liv) else sa.dati -> 'attacchi' -> p_attacco end;
  if att is null then raise exception 'Attacco non trovato nella scheda'; end if;
  bonus := coalesce(nullif(att ->> 'colpire', '')::numeric::int, 0);
  danni := regexp_replace(coalesce(att ->> 'danni', ''), '\s+', '', 'g');
  nome_att := coalesce(nullif(att ->> 'nome', ''), 'attacco');

  tiro := tavolo_tira(case p_adv when 1 then '2d20kh1' when 2 then '2d20kl1' else '1d20' end || case when bonus < 0 then bonus::text else '+' || bonus end,
    '🎯 Tiro per colpire · ' || nome_att || case when p_liv is not null and (att ->> 'livello') is not null then ' (slot di ' || (att ->> 'livello') || '°)' else '' end || ' · ' || coalesce(a.nome, '') || ' → ' || coalesce(b.nome, '') || case p_adv when 1 then ' · vantaggio' when 2 then ' · svantaggio' else '' end, p_privato);
  nat := (regexp_match(tiro.dettaglio, '\[(?:[^\]]*→ )?(\d+)\]'))[1]::int;

  sb := tavolo_scheda_di(b);
  ca := case when (sb.dati ->> 'ca') ~ '^\s*\d+' then (regexp_match(sb.dati ->> 'ca', '\d+'))[1]::int end;
  if nat = 20 then colpito := true; critico := true;
  elsif nat = 1 then colpito := false;
  elsif ca is null then colpito := null;
  else colpito := tiro.totale >= ca + greatest(coalesce(p_cop, 0), 0); end if;
  -- l'esito resta scritto sul tiro, così in chat si legge subito se ha colpito
  update tavolo_tiri set motivo = motivo || case when coalesce(p_cop, 0) >= 5 then ' · copertura ¾ (CA +' || p_cop || ')' when coalesce(p_cop, 0) > 0 then ' · copertura ½ (CA +' || p_cop || ')' else '' end || case when critico then ' · 💥 CRITICO' when colpito then ' · ✅ COLPITO' when colpito is false then ' · ❌ MANCATO' else ' · CA sconosciuta' end
    where id = tiro.id returning * into tiro;

  -- colpito: i danni si tirano subito (raddoppiati col critico) e si tolgono al bersaglio
  if colpito and (danni ~ '\d' or extra <> '') then
    if danni ~ '\d' then
      td := tavolo_tira(case when critico then tavolo_critico(danni) else danni end,
        '💥 Danni · ' || nome_att || ' · ' || coalesce(a.nome, '') || ' → ' || coalesce(b.nome, '') || case when critico then ' · critico ×2' else '' end, p_privato);
      dmg := greatest(td.totale, 0);
    end if;
    -- attacco furtivo, punizione…: un tiro a parte, così in chat si distingue dai danni dell'arma
    if extra <> '' then
      tx := tavolo_tira(case when critico then tavolo_critico(extra) else extra end,
        '➕ ' || coalesce(nullif(left(p_extra_nome, 60), ''), 'Danni in più') || ' · ' || coalesce(a.nome, '') || ' → ' || coalesce(b.nome, '') || case when critico then ' · critico ×2' else '' end, p_privato);
      dmg := dmg + greatest(tx.totale, 0);
    end if;
    ferita := tavolo_ferisci(b.id, dmg);
    -- «+ 2d8 da veleno (TS Costituzione CD 11, dimezza)»: i danni in più li decide il tiro salvezza del bersaglio
    testo := lower(coalesce(att ->> 'tipo', ''));
    car := tavolo_car_ts(testo); cd := (regexp_match(testo, '\mcd\s*(\d+)'))[1]::int;
    dv := (regexp_match(testo, '\+\s*(\d{1,2}d\d{1,3}(?:\s*[+-]\s*\d{1,3})?)'))[1];
    if car is not null and cd is not null and dv is not null and not coalesce((ferita ->> 'morto')::boolean, false) then
      dv := regexp_replace(dv, '\s+', '', 'g');
      tv := tavolo_tira(case when critico then tavolo_critico(dv) else dv end, '🧪 Danni in più (tiro salvezza) · ' || nome_att || ' · ' || coalesce(a.nome, '') || ' → ' || coalesce(b.nome, ''), p_privato);
      ric := tavolo_chiedi_ts(b, car, cd, tv.totale, testo ~ 'dimezz|metà', nome_att, p_privato);
    end if;
  end if;
  if critico then insert into tavolo_critici (tiro, autore, token, bersaglio, privato) values (tiro.id, auth.uid(), a.id, b.id, p_privato) on conflict do nothing; end if;

  return jsonb_build_object('colpito', colpito, 'critico', critico, 'fallito', nat = 1, 'naturale', nat, 'totale', tiro.totale,
    'danni', dmg, 'pf', ferita -> 'pf', 'morto', coalesce((ferita ->> 'morto')::boolean, false), 'tiro', tiro.id, 'tiro_danni', td.id, 'danni_extra', tx.totale, 'salvezza', ric);
end $$;

revoke execute on function public.tavolo_attacca(uuid, uuid, int, int, boolean, text, int, text, int, int) from anon, public;
grant execute on function public.tavolo_attacca(uuid, uuid, int, int, boolean, text, int, text, int, int) to authenticated;

-- ---------- richieste di coperture a Claude ----------
-- il DM preme «Chiedi le coperture a Claude»: la mappa entra in lista d'attesa con un link all'immagine valido 7 giorni.
create table if not exists public.tavolo_coperture_richieste (
  id uuid primary key default gen_random_uuid(),
  scena uuid not null references public.tavolo_scene on delete cascade,
  url text not null,
  stato text not null default 'attesa' check (stato in ('attesa', 'fatta', 'errore')),
  nota text,
  creata timestamptz not null default now(),
  fatta timestamptz
);
alter table public.tavolo_coperture_richieste enable row level security;
drop policy if exists "coperture: lettura" on public.tavolo_coperture_richieste;
create policy "coperture: lettura" on public.tavolo_coperture_richieste for select using (tavolo_e_dm());

create or replace function public.tavolo_chiedi_coperture(p_scena uuid, p_url text) returns public.tavolo_coperture_richieste
language plpgsql security definer set search_path = public as $$
declare r tavolo_coperture_richieste;
begin
  if not tavolo_e_dm() then raise exception 'Solo il DM può chiedere le coperture'; end if;
  delete from tavolo_coperture_richieste where scena = p_scena and stato = 'attesa';
  insert into tavolo_coperture_richieste (scena, url) values (p_scena, p_url) returning * into r;
  return r;
end $$;
revoke execute on function public.tavolo_chiedi_coperture(uuid, text) from anon, public;
grant execute on function public.tavolo_chiedi_coperture(uuid, text) to authenticated;

-- ---------- la chiave di Claude ----------
-- Claude non ha un account sul sito: usa questa chiave segreta, che vale solo per leggere le richieste e scrivere i muri.
-- Per vederla: select chiave from public.tavolo_bot;  (va messa nei segreti dell'ambiente di Claude, mai in chat)
create table if not exists public.tavolo_bot (id int primary key default 1 check (id = 1), chiave text not null);
alter table public.tavolo_bot enable row level security; -- nessuna policy: dal sito non si legge
insert into public.tavolo_bot (chiave) values (replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')) on conflict (id) do nothing;

create or replace function public.tavolo_bot_ok(p_chiave text) returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from tavolo_bot where chiave = p_chiave and length(p_chiave) >= 32)
$$;
revoke execute on function public.tavolo_bot_ok(text) from anon, public, authenticated;

-- le mappe in attesa, con quello che serve per tracciare: misure, griglia e i muri già presenti
create or replace function public.tavolo_bot_richieste(p_chiave text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not tavolo_bot_ok(p_chiave) then raise exception 'Chiave non valida'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'scena', s.id, 'nome', s.nome, 'url', r.url, 'creata', r.creata,
      'larghezza', s.larghezza, 'altezza', s.altezza, 'griglia', s.griglia, 'griglia_x', s.griglia_x, 'griglia_y', s.griglia_y, 'metri', s.metri,
      'muri', (select coalesce(jsonb_agg(jsonb_build_object('punti', m.punti, 'porta', m.porta, 'tipo', m.tipo, 'nome', m.nome, 'auto', m.auto)), '[]'::jsonb) from tavolo_muri m where m.scena = s.id))
    order by r.creata)
    from tavolo_coperture_richieste r join tavolo_scene s on s.id = r.scena where r.stato = 'attesa'), '[]'::jsonb);
end $$;

-- salva i muri tracciati da Claude: quelli fatti a mano dal DM restano, quelli di un tracciamento precedente si sostituiscono.
-- p_muri: [{"punti":[x1,y1,x2,y2], "tipo":null|"meta"|"tre", "nome":"tavolo"}, …]
create or replace function public.tavolo_bot_muri(p_chiave text, p_richiesta uuid, p_muri jsonb, p_nota text default null) returns int
language plpgsql security definer set search_path = public as $$
declare r tavolo_coperture_richieste; n int;
begin
  if not tavolo_bot_ok(p_chiave) then raise exception 'Chiave non valida'; end if;
  select * into r from tavolo_coperture_richieste where id = p_richiesta;
  if r.id is null then raise exception 'Richiesta non trovata'; end if;
  delete from tavolo_muri where scena = r.scena and auto;
  insert into tavolo_muri (scena, punti, porta, tipo, nome, auto)
    select r.scena, (select jsonb_agg(round(v::numeric, 1)) from jsonb_array_elements_text(m -> 'punti') v), false,
           nullif(m ->> 'tipo', ''), left(m ->> 'nome', 40), true
    from jsonb_array_elements(p_muri) m where jsonb_array_length(m -> 'punti') = 4;
  get diagnostics n = row_count;
  update tavolo_coperture_richieste set stato = 'fatta', fatta = now(), nota = left(p_nota, 500) where id = r.id;
  return n;
end $$;
revoke execute on function public.tavolo_bot_richieste(text) from public;
revoke execute on function public.tavolo_bot_muri(text, uuid, jsonb, text) from public;
grant execute on function public.tavolo_bot_richieste(text) to anon, authenticated;
grant execute on function public.tavolo_bot_muri(text, uuid, jsonb, text) to anon, authenticated;

-- il DM vede in diretta quando la richiesta è fatta
do $$ begin
  alter publication supabase_realtime add table public.tavolo_coperture_richieste;
exception when duplicate_object then null; end $$;

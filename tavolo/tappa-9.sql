-- Tavolo virtuale di Avalar — tappa 9: chat del combattimento più leggibile.
-- Il tiro per colpire si presenta come «🎯 Tiro per colpire» e porta scritto l'esito (✅ colpito, ❌ mancato, 💥 critico);
-- i danni che seguono come «💥 Danni», l'attacco furtivo e simili come «➕ …».
-- Nebbia automatica: interruttore per il cono d'ombra dietro i muri (spento: restano buie solo le stanze chiuse).
-- Gli incantesimi lanciati con uno slot più alto fanno i danni in più di «Ai livelli superiori».
-- Da incollare nell'SQL Editor di Supabase (New query › incolla › Run) dopo gli script delle tappe 1–8.
-- Si può rieseguire senza danni.

alter table public.tavolo_scene add column if not exists cono boolean not null default true;

-- ---------- incantesimo letto dalla scheda, al livello dello slot scelto ----------
drop function if exists public.tavolo_inc_att(public.tavolo_schede, int);
create or replace function public.tavolo_inc_att(sa public.tavolo_schede, p_inc int, p_liv int default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare sp jsonb := sa.dati -> 'incantesimi' -> p_inc; v text; bon int; cd int; g text; lv int; piu text[]; dn text;
begin
  if sp is null then return null; end if;
  v := sa.dati ->> coalesce(nullif(sa.dati ->> 'car_inc', ''), 'int');
  bon := tavolo_comp(sa) + floor((coalesce(case when v ~ '^-?\d+(\.\d+)?$' then v::numeric end, 10) - 10) / 2)::int;
  cd := 8 + bon;
  g := (regexp_match(coalesce(sp ->> 'portata', ''), '(\d+(?:[.,]\d+)?)\s*m(etri)?\M', 'i'))[1];
  if coalesce(sp ->> 'portata', '') ~* '^\s*(s[eé]|contatto|personale|incantatore)' then g := null; end if;
  -- lanciato con uno slot più alto: «i danni aumentano di 1d6 per ogni slot di livello superiore al 3°»
  dn := regexp_replace(coalesce(sp ->> 'danni', ''), '\s+', '', 'g');
  lv := coalesce(nullif(sp ->> 'livello', '')::numeric::int, 0);
  piu := regexp_match(coalesce(nullif(sp ->> 'piu', ''), sp ->> 'testo', ''), '(\d+)d(\d+)(?: danni)? (?:per ogni|per ciascun) (?:slot di )?livello (?:di slot )?superiore', 'i');
  if p_liv is not null and p_liv > lv and lv > 0 and piu is not null and dn ~ '\d' then
    dn := dn || '+' || (piu[1]::int * (least(p_liv, 9) - lv)) || 'd' || piu[2];
  end if;
  return jsonb_build_object('nome', coalesce(nullif(sp ->> 'nome', ''), 'incantesimo'),
    'colpire', case when sp ->> 'attacco' = 'true' then bon end,
    'danni', dn, 'livello', greatest(coalesce(p_liv, lv), lv),
    'tipo', concat_ws(', ', case when g is not null then 'gittata ' || g || ' m' end, nullif(sp ->> 'area', ''),
      case when coalesce(sp ->> 'ts', '') <> '' then 'TS ' || (sp ->> 'ts') || ' CD ' || cd || case when sp ->> 'dimezza' = 'true' then ' dimezza' else '' end end,
      nullif(sp ->> 'tipo_danni', '')));
end $$;

-- ---------- incantesimi con tiro salvezza: ora anche con lo slot scelto ----------
drop function if exists public.tavolo_area(uuid, int, uuid[], int, boolean, int);
create or replace function public.tavolo_area(p_token uuid, p_attacco int, p_bersagli uuid[], p_cd int default null, p_privato boolean default false, p_inc int default null, p_liv int default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  a tavolo_token; b tavolo_token; sa tavolo_schede; att jsonb; testo text; danni text; car text; cd int;
  dimezza boolean; td tavolo_tiri; dmg int; esiti jsonb := '[]'; ferita jsonb; nome_att text; ric jsonb;
begin
  if not tavolo_e_membro() then raise exception 'Non fai parte del tavolo'; end if;
  select * into a from tavolo_token where id = p_token;
  if a.id is null then raise exception 'Token non trovato'; end if;
  if not tavolo_e_dm() and (a.giocatore is null or a.giocatore <> tavolo_mio_giocatore()) then raise exception 'Puoi lanciare solo con il tuo token'; end if;
  if coalesce(array_length(p_bersagli, 1), 0) > 40 then raise exception 'Troppi bersagli'; end if;
  sa := tavolo_scheda_di(a);
  att := case when p_inc is not null then tavolo_inc_att(sa, p_inc, p_liv) else sa.dati -> 'attacchi' -> p_attacco end;
  if att is null then raise exception 'Incantesimo non trovato nella scheda'; end if;
  nome_att := coalesce(nullif(att ->> 'nome', ''), 'incantesimo');
  testo := lower(coalesce(att ->> 'tipo', '') || ' ' || coalesce(att ->> 'nome', ''));
  danni := regexp_replace(coalesce(att ->> 'danni', ''), '\s+', '', 'g');
  car := tavolo_car_ts(testo);
  cd := coalesce((regexp_match(testo, '\mcd\s*(\d+)'))[1]::int, least(greatest(p_cd, 5), 30));
  dimezza := testo ~ 'dimezz|metà';

  if danni ~ '\d' then td := tavolo_tira(danni, '💥 Danni · ' || nome_att || ' · ' || coalesce(a.nome, '') || case when p_liv is not null and (att ->> 'livello') is not null then ' · slot di ' || (att ->> 'livello') || '° livello' else '' end, p_privato); end if;
  for b in select * from tavolo_token where id = any(p_bersagli) and scena = a.scena loop
    if not tavolo_e_dm() and (b.scena <> tavolo_scena_attiva() or b.nascosto) then continue; end if;
    if car is not null and cd is not null then
      ric := tavolo_chiedi_ts(b, car, cd, coalesce(td.totale, 0), dimezza, nome_att, p_privato);
      esiti := esiti || jsonb_build_object('id', b.id, 'nome', b.nome, 'attesa', true, 'richiesta', ric -> 'id', 'danni', 0);
    else
      dmg := coalesce(td.totale, 0);
      ferita := case when dmg > 0 then tavolo_ferisci(b.id, dmg) else '{}'::jsonb end;
      esiti := esiti || jsonb_build_object('id', b.id, 'nome', b.nome, 'salvo', null, 'danni', dmg, 'pf', ferita -> 'pf', 'morto', coalesce((ferita ->> 'morto')::boolean, false));
    end if;
  end loop;
  return jsonb_build_object('danni', coalesce(td.totale, 0), 'cd', cd, 'car', car, 'dimezza', dimezza, 'esiti', esiti);
end $$;

-- ---------- attacco: l'esito resta scritto sul tiro; gli incantesimi con lo slot scelto ----------
drop function if exists public.tavolo_attacca(uuid, uuid, int, int, boolean, text, int, text);
create or replace function public.tavolo_attacca(p_token uuid, p_bersaglio uuid, p_attacco int, p_adv int default 0, p_privato boolean default false, p_extra text default null, p_inc int default null, p_extra_nome text default null, p_liv int default null)
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
  else colpito := tiro.totale >= ca; end if;
  -- l'esito resta scritto sul tiro, così in chat si legge subito se ha colpito
  update tavolo_tiri set motivo = motivo || case when critico then ' · 💥 CRITICO' when colpito then ' · ✅ COLPITO' when colpito is false then ' · ❌ MANCATO' else ' · CA sconosciuta' end
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
revoke execute on function public.tavolo_attacca(uuid, uuid, int, int, boolean, text, int, text, int) from anon, public;
grant execute on function public.tavolo_attacca(uuid, uuid, int, int, boolean, text, int, text, int) to authenticated;
revoke execute on function public.tavolo_area(uuid, int, uuid[], int, boolean, int, int) from anon, public;
grant execute on function public.tavolo_area(uuid, int, uuid[], int, boolean, int, int) to authenticated;
revoke execute on function public.tavolo_inc_att(public.tavolo_schede, int, int) from anon, public, authenticated;

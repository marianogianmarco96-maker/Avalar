-- Tavolo virtuale di Avalar — tappa 9: chat del combattimento più leggibile.
-- Il tiro per colpire si presenta come «🎯 Tiro per colpire» e porta scritto l'esito (✅ colpito, ❌ mancato, 💥 critico);
-- i danni che seguono come «💥 Danni», l'attacco furtivo e simili come «➕ …».
-- Da incollare nell'SQL Editor di Supabase (New query › incolla › Run) dopo gli script delle tappe 1–8.
-- Si può rieseguire senza danni.

create or replace function public.tavolo_attacca(p_token uuid, p_bersaglio uuid, p_attacco int, p_adv int default 0, p_privato boolean default false, p_extra text default null, p_inc int default null, p_extra_nome text default null)
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
  att := case when p_inc is not null then tavolo_inc_att(sa, p_inc) else sa.dati -> 'attacchi' -> p_attacco end;
  if att is null then raise exception 'Attacco non trovato nella scheda'; end if;
  bonus := coalesce(nullif(att ->> 'colpire', '')::numeric::int, 0);
  danni := regexp_replace(coalesce(att ->> 'danni', ''), '\s+', '', 'g');
  nome_att := coalesce(nullif(att ->> 'nome', ''), 'attacco');

  tiro := tavolo_tira(case p_adv when 1 then '2d20kh1' when 2 then '2d20kl1' else '1d20' end || case when bonus < 0 then bonus::text else '+' || bonus end,
    '🎯 Tiro per colpire · ' || nome_att || ' · ' || coalesce(a.nome, '') || ' → ' || coalesce(b.nome, '') || case p_adv when 1 then ' · vantaggio' when 2 then ' · svantaggio' else '' end, p_privato);
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
revoke execute on function public.tavolo_attacca(uuid, uuid, int, int, boolean, text, int, text) from anon, public;
grant execute on function public.tavolo_attacca(uuid, uuid, int, int, boolean, text, int, text) to authenticated;

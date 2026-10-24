-- Tavolo virtuale di Avalar — tappa 5: attacchi con bersaglio. Il tiro per colpire si confronta con la CA della scheda
-- del bersaglio (che i giocatori non vedono) e, se colpisce, i danni si tolgono da soli dai suoi punti ferita.
-- Da incollare nell'SQL Editor di Supabase (New query › incolla › Run) dopo gli script delle tappe 1–4.
-- Si può rieseguire senza danni.

-- la scheda di un token: una del tavolo (tv:…), quella del personaggio del giocatore, o quella collegata al PNG del sito
create or replace function public.tavolo_scheda_di(t public.tavolo_token) returns public.tavolo_schede
language plpgsql stable security definer set search_path = public as $$
declare s tavolo_schede;
begin
  if t.scheda like 'tv:%' then
    select * into s from tavolo_schede where id::text = substr(t.scheda, 4);
    if found then return s; end if;
  end if;
  if t.giocatore is not null then
    select * into s from tavolo_schede where giocatore = t.giocatore;
    if found then return s; end if;
  end if;
  if t.scheda is not null then
    select * into s from tavolo_schede where entita = t.scheda order by creata limit 1;
  end if;
  return s;
end $$;

-- i dadi di una formula raddoppiati (colpo critico): 1d8+3 → 1d8+3+1d8
create or replace function public.tavolo_critico(f text) returns text
language sql immutable as $$
  select f || coalesce((select string_agg('+' || m[1], '') from regexp_matches(lower(f), '(\d*d\d+)', 'g') m), '')
$$;

-- i punti ferita li cambia di norma solo il DM; un attacco lo fa per conto di chi attacca
create or replace function public.tavolo_token_guardia() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tavolo_e_dm() or current_setting('tavolo.attacco', true) = '1' then new.aggiornato := now(); return new; end if;
  if (new.id, new.scena, new.nome, new.immagine, new.colore, new.misura, new.giocatore, new.scheda, new.nascosto, new.pf, new.pf_max, new.vista)
     is distinct from (old.id, old.scena, old.nome, old.immagine, old.colore, old.misura, old.giocatore, old.scheda, old.nascosto, old.pf, old.pf_max, old.vista) then
    raise exception 'Puoi solo spostare il tuo token';
  end if;
  new.aggiornato := now();
  return new;
end $$;

-- attacco: p_attacco è la posizione dell'attacco nella scheda di chi attacca; p_adv 0 normale, 1 vantaggio, 2 svantaggio
create or replace function public.tavolo_attacca(p_token uuid, p_bersaglio uuid, p_attacco int, p_adv int default 0, p_privato boolean default false)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  a tavolo_token; b tavolo_token; sa tavolo_schede; sb tavolo_schede; att jsonb;
  bonus int; danni text; ca int; tiro tavolo_tiri; td tavolo_tiri; nat int; colpito boolean; critico boolean := false;
  dmg int := 0; npf int; mx int; tmp int; morto boolean := false; cond jsonb; nome_att text;
begin
  if not tavolo_e_membro() then raise exception 'Non fai parte del tavolo'; end if;
  select * into a from tavolo_token where id = p_token;
  select * into b from tavolo_token where id = p_bersaglio;
  if a.id is null or b.id is null or a.scena <> b.scena then raise exception 'Token non trovato'; end if;
  if not tavolo_e_dm() and (a.giocatore is null or a.giocatore <> tavolo_mio_giocatore()) then raise exception 'Puoi attaccare solo con il tuo token'; end if;
  if not tavolo_e_dm() and (b.scena <> tavolo_scena_attiva() or b.nascosto) then raise exception 'Bersaglio non valido'; end if;
  sa := tavolo_scheda_di(a);
  att := sa.dati -> 'attacchi' -> p_attacco;
  if att is null then raise exception 'Attacco non trovato nella scheda'; end if;
  bonus := coalesce(nullif(att ->> 'colpire', '')::numeric::int, 0);
  danni := coalesce(att ->> 'danni', '');
  nome_att := coalesce(nullif(att ->> 'nome', ''), 'attacco');

  -- tiro per colpire (nella chat, come gli altri tiri)
  tiro := tavolo_tira(case p_adv when 1 then '2d20kh1' when 2 then '2d20kl1' else '1d20' end || case when bonus < 0 then bonus::text else '+' || bonus end,
    coalesce(a.nome, '') || ' → ' || coalesce(b.nome, '') || ' · ' || nome_att || case p_adv when 1 then ' · vantaggio' when 2 then ' · svantaggio' else '' end, p_privato);
  nat := (regexp_match(tiro.dettaglio, '\[(?:[^\]]*→ )?(\d+)\]'))[1]::int;

  -- la CA dalla scheda del bersaglio: senza scheda decide il DM
  sb := tavolo_scheda_di(b);
  ca := case when (sb.dati ->> 'ca') ~ '^\s*\d+' then (regexp_match(sb.dati ->> 'ca', '\d+'))[1]::int end;
  if nat = 20 then colpito := true; critico := true;
  elsif nat = 1 then colpito := false;
  elsif ca is null then colpito := null;
  else colpito := tiro.totale >= ca; end if;

  -- danni: si tirano e si tolgono dai punti ferita del bersaglio
  if colpito and danni ~ '\d' then
    td := tavolo_tira(case when critico then tavolo_critico(regexp_replace(danni, '\s+', '', 'g')) else regexp_replace(danni, '\s+', '', 'g') end,
      coalesce(a.nome, '') || ' → ' || coalesce(b.nome, '') || ' · danni' || case when critico then ' (critico)' else '' end, p_privato);
    dmg := greatest(td.totale, 0);
    perform set_config('tavolo.attacco', '1', true);
    if b.pf_max is not null or (sb.tipo = 'png' and (sb.dati ->> 'pf_max') ~ '^\d+$') then
      -- ogni token di PNG ha i suoi punti ferita
      mx := coalesce(b.pf_max, (sb.dati ->> 'pf_max')::int);
      npf := greatest(coalesce(b.pf, mx) - dmg, 0);
      cond := coalesce(b.condizioni, '[]'::jsonb);
      if npf = 0 and b.giocatore is null and not cond ? 'Morto' then cond := cond || '["Morto"]'::jsonb; morto := true; end if;
      update tavolo_token set pf = npf, pf_max = mx, condizioni = cond where id = b.id;
    elsif sb.id is not null and (sb.dati ->> 'pf_max') ~ '^\d+$' then
      -- i personaggi tengono i punti ferita nella scheda: i temporanei se ne vanno per primi
      mx := (sb.dati ->> 'pf_max')::int;
      tmp := coalesce(nullif(sb.dati ->> 'pf_temp', '')::numeric::int, 0);
      npf := coalesce(nullif(sb.dati ->> 'pf', '')::numeric::int, mx);
      if tmp > 0 then npf := npf - greatest(dmg - tmp, 0); tmp := greatest(tmp - dmg, 0); else npf := npf - dmg; end if;
      npf := greatest(npf, 0);
      update tavolo_schede set dati = dati || jsonb_build_object('pf', npf, 'pf_temp', nullif(tmp, 0)), aggiornata = now() where id = sb.id;
    else
      npf := null;
    end if;
    perform set_config('tavolo.attacco', '0', true);
  end if;

  return jsonb_build_object('colpito', colpito, 'critico', critico, 'fallito', nat = 1, 'naturale', nat, 'totale', tiro.totale,
    'danni', dmg, 'pf', npf, 'morto', morto, 'tiro', tiro.id, 'tiro_danni', td.id);
end $$;

revoke execute on function public.tavolo_attacca(uuid, uuid, int, int, boolean) from anon, public;
grant execute on function public.tavolo_attacca(uuid, uuid, int, int, boolean) to authenticated;
revoke execute on function public.tavolo_scheda_di(public.tavolo_token) from anon, public;

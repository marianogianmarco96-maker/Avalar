-- Tavolo virtuale di Avalar — tappa 6: barra della salute, azioni del turno, conferma del critico e incantesimi ad area.
-- Da incollare nell'SQL Editor di Supabase (New query › incolla › Run) dopo gli script delle tappe 1–5.
-- Si può rieseguire senza danni.

-- ---------- token ----------
-- la barra della salute dei PNG la vede solo il DM, finché non la mostra a tutti
alter table public.tavolo_token add column if not exists barra boolean not null default false;
-- azione, azione bonus, reazione e movimento usati nel turno: {"chiave": "<round>:<turno>", "az": true, "bon": false, "rea": false, "mov": 4.5}
alter table public.tavolo_token add column if not exists azioni jsonb;

-- i giocatori muovono i propri token e segnano le proprie azioni, ma non ne cambiano nient'altro
create or replace function public.tavolo_token_guardia() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tavolo_e_dm() or current_setting('tavolo.attacco', true) = '1' then new.aggiornato := now(); return new; end if;
  if (new.id, new.scena, new.nome, new.immagine, new.colore, new.misura, new.giocatore, new.scheda, new.nascosto, new.pf, new.pf_max, new.vista, new.barra)
     is distinct from (old.id, old.scena, old.nome, old.immagine, old.colore, old.misura, old.giocatore, old.scheda, old.nascosto, old.pf, old.pf_max, old.vista, old.barra) then
    raise exception 'Puoi solo spostare il tuo token';
  end if;
  new.aggiornato := now();
  return new;
end $$;

-- ---------- salute del gruppo ----------
-- ognuno vede la barra della salute dei compagni: qui c'è una copia dei soli punti ferita delle schede dei personaggi
create table if not exists public.tavolo_pf_gruppo (
  giocatore text primary key,
  pf int,
  pf_max int,
  pf_temp int,
  aggiornato timestamptz not null default now()
);
create or replace function public.tavolo_pf_copia() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then delete from tavolo_pf_gruppo where giocatore = old.giocatore; return old; end if;
  if new.tipo <> 'pg' or new.giocatore is null then return new; end if;
  insert into tavolo_pf_gruppo (giocatore, pf, pf_max, pf_temp)
    values (new.giocatore,
      case when (new.dati ->> 'pf') ~ '^-?\d+$' then (new.dati ->> 'pf')::int end,
      case when (new.dati ->> 'pf_max') ~ '^\d+$' then (new.dati ->> 'pf_max')::int end,
      case when (new.dati ->> 'pf_temp') ~ '^\d+$' then (new.dati ->> 'pf_temp')::int end)
  on conflict (giocatore) do update set pf = excluded.pf, pf_max = excluded.pf_max, pf_temp = excluded.pf_temp, aggiornato = now()
    where (tavolo_pf_gruppo.pf, tavolo_pf_gruppo.pf_max, tavolo_pf_gruppo.pf_temp) is distinct from (excluded.pf, excluded.pf_max, excluded.pf_temp);
  return new;
end $$;
drop trigger if exists tavolo_pf_copia on public.tavolo_schede;
create trigger tavolo_pf_copia after insert or update or delete on public.tavolo_schede for each row execute function public.tavolo_pf_copia();
update public.tavolo_schede set aggiornata = aggiornata where tipo = 'pg' and giocatore is not null;  -- prima copia
alter table public.tavolo_pf_gruppo enable row level security;
drop policy if exists "pf del gruppo: lettura" on public.tavolo_pf_gruppo;
create policy "pf del gruppo: lettura" on public.tavolo_pf_gruppo for select to authenticated using (tavolo_e_membro());
revoke all on public.tavolo_pf_gruppo from anon;
grant select on public.tavolo_pf_gruppo to authenticated;
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tavolo_pf_gruppo') then
    alter publication supabase_realtime add table public.tavolo_pf_gruppo;
  end if;
end $$;

-- ---------- critici da confermare ----------
-- un 20 naturale si può confermare una volta sola: con un altro 20 il bersaglio muore sul colpo
create table if not exists public.tavolo_critici (
  tiro bigint primary key references public.tavolo_tiri on delete cascade,
  autore uuid not null,
  token uuid not null,
  bersaglio uuid not null,
  privato boolean not null default false,
  usato boolean not null default false,
  creato timestamptz not null default now()
);
alter table public.tavolo_critici enable row level security;
revoke all on public.tavolo_critici from anon, authenticated;  -- si usa solo dalle funzioni qui sotto

-- bonus di competenza di una scheda (come nella pagina: dal livello o dal grado di sfida)
create or replace function public.tavolo_comp(s public.tavolo_schede) returns int
language sql immutable as $$
  select coalesce(
    case when (s.dati ->> 'comp') ~ '^-?\d+$' then (s.dati ->> 'comp')::int end,
    case when s.tipo = 'pg' then 2 + (greatest(1, coalesce(case when (s.dati ->> 'livello') ~ '^\d+$' then (s.dati ->> 'livello')::int end, 1)) - 1) / 4
         else 2 + greatest(0, coalesce(case when (s.dati ->> 'gs') ~ '^\d+$' then (s.dati ->> 'gs')::int end, 0) - 1) / 4 end)
$$;

-- toglie i danni a un bersaglio (token del PNG o scheda del personaggio); con p_uccidi i punti ferita vanno a 0
create or replace function public.tavolo_ferisci(p_bersaglio uuid, p_danni int, p_uccidi boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare b tavolo_token; sb tavolo_schede; npf int; mx int; tmp int; morto boolean := false; cond jsonb;
begin
  select * into b from tavolo_token where id = p_bersaglio;
  if b.id is null then return jsonb_build_object('pf', null, 'morto', false); end if;
  sb := tavolo_scheda_di(b);
  perform set_config('tavolo.attacco', '1', true);
  if b.pf_max is not null or (sb.tipo = 'png' and (sb.dati ->> 'pf_max') ~ '^\d+$') then
    mx := coalesce(b.pf_max, (sb.dati ->> 'pf_max')::int);
    npf := case when p_uccidi then 0 else greatest(coalesce(b.pf, mx) - greatest(p_danni, 0), 0) end;
    cond := coalesce(b.condizioni, '[]'::jsonb);
    if npf = 0 and (b.giocatore is null or p_uccidi) and not cond ? 'Morto' then cond := cond || '["Morto"]'::jsonb; morto := true; end if;
    update tavolo_token set pf = npf, pf_max = mx, condizioni = cond where id = b.id;
  elsif sb.id is not null and (sb.dati ->> 'pf_max') ~ '^\d+$' then
    mx := (sb.dati ->> 'pf_max')::int;
    tmp := coalesce(nullif(sb.dati ->> 'pf_temp', '')::numeric::int, 0);
    npf := coalesce(nullif(sb.dati ->> 'pf', '')::numeric::int, mx);
    if p_uccidi then npf := 0; tmp := 0;
    elsif tmp > 0 then npf := npf - greatest(p_danni - tmp, 0); tmp := greatest(tmp - p_danni, 0);
    else npf := npf - greatest(p_danni, 0); end if;
    npf := greatest(npf, 0);
    cond := coalesce(sb.dati -> 'condizioni', '[]'::jsonb);
    if p_uccidi and not cond ? 'Morto' then cond := cond || '["Morto"]'::jsonb; morto := true; end if;
    update tavolo_schede set dati = dati || jsonb_build_object('pf', npf, 'pf_temp', nullif(tmp, 0), 'condizioni', cond), aggiornata = now() where id = sb.id;
    if p_uccidi then update tavolo_token set condizioni = coalesce(condizioni, '[]'::jsonb) || '["Morto"]'::jsonb where id = b.id and not coalesce(condizioni, '[]'::jsonb) ? 'Morto'; end if;
  else
    npf := null;
  end if;
  perform set_config('tavolo.attacco', '0', true);
  return jsonb_build_object('pf', npf, 'morto', morto);
end $$;

-- ---------- attacco (sostituisce quello della tappa 5) ----------
-- p_extra: dadi in più se colpisce (attacco furtivo, punizione…), per esempio 3d6
drop function if exists public.tavolo_attacca(uuid, uuid, int, int, boolean);
create or replace function public.tavolo_attacca(p_token uuid, p_bersaglio uuid, p_attacco int, p_adv int default 0, p_privato boolean default false, p_extra text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  a tavolo_token; b tavolo_token; sa tavolo_schede; sb tavolo_schede; att jsonb;
  bonus int; danni text; ca int; tiro tavolo_tiri; td tavolo_tiri; nat int; colpito boolean; critico boolean := false;
  dmg int := 0; ferita jsonb := '{}'; nome_att text; extra text := lower(regexp_replace(coalesce(p_extra, ''), '\s+', '', 'g'));
begin
  if not tavolo_e_membro() then raise exception 'Non fai parte del tavolo'; end if;
  select * into a from tavolo_token where id = p_token;
  select * into b from tavolo_token where id = p_bersaglio;
  if a.id is null or b.id is null or a.scena <> b.scena then raise exception 'Token non trovato'; end if;
  if not tavolo_e_dm() and (a.giocatore is null or a.giocatore <> tavolo_mio_giocatore()) then raise exception 'Puoi attaccare solo con il tuo token'; end if;
  if not tavolo_e_dm() and (b.scena <> tavolo_scena_attiva() or b.nascosto) then raise exception 'Bersaglio non valido'; end if;
  if extra <> '' and extra !~ '^\d{0,2}d\d{1,3}([+-]\d{1,3})?(\+\d{0,2}d\d{1,3}([+-]\d{1,3})?)*$' then raise exception 'Danni in più non validi: scrivi per esempio 3d6'; end if;
  sa := tavolo_scheda_di(a);
  att := sa.dati -> 'attacchi' -> p_attacco;
  if att is null then raise exception 'Attacco non trovato nella scheda'; end if;
  bonus := coalesce(nullif(att ->> 'colpire', '')::numeric::int, 0);
  danni := regexp_replace(coalesce(att ->> 'danni', ''), '\s+', '', 'g');
  nome_att := coalesce(nullif(att ->> 'nome', ''), 'attacco');

  tiro := tavolo_tira(case p_adv when 1 then '2d20kh1' when 2 then '2d20kl1' else '1d20' end || case when bonus < 0 then bonus::text else '+' || bonus end,
    coalesce(a.nome, '') || ' → ' || coalesce(b.nome, '') || ' · ' || nome_att || case p_adv when 1 then ' · vantaggio' when 2 then ' · svantaggio' else '' end, p_privato);
  nat := (regexp_match(tiro.dettaglio, '\[(?:[^\]]*→ )?(\d+)\]'))[1]::int;

  sb := tavolo_scheda_di(b);
  ca := case when (sb.dati ->> 'ca') ~ '^\s*\d+' then (regexp_match(sb.dati ->> 'ca', '\d+'))[1]::int end;
  if nat = 20 then colpito := true; critico := true;
  elsif nat = 1 then colpito := false;
  elsif ca is null then colpito := null;
  else colpito := tiro.totale >= ca; end if;

  -- colpito: i danni si tirano subito (raddoppiati col critico) e si tolgono al bersaglio
  if colpito and (danni ~ '\d' or extra <> '') then
    danni := concat_ws('+', nullif(danni, ''), nullif(extra, ''));
    td := tavolo_tira(case when critico then tavolo_critico(danni) else danni end,
      coalesce(a.nome, '') || ' → ' || coalesce(b.nome, '') || ' · danni' || case when critico then ' (critico ×2)' else '' end, p_privato);
    dmg := greatest(td.totale, 0);
    ferita := tavolo_ferisci(b.id, dmg);
  end if;
  if critico then insert into tavolo_critici (tiro, autore, token, bersaglio, privato) values (tiro.id, auth.uid(), a.id, b.id, p_privato) on conflict do nothing; end if;

  return jsonb_build_object('colpito', colpito, 'critico', critico, 'fallito', nat = 1, 'naturale', nat, 'totale', tiro.totale,
    'danni', dmg, 'pf', ferita -> 'pf', 'morto', coalesce((ferita ->> 'morto')::boolean, false), 'tiro', tiro.id, 'tiro_danni', td.id);
end $$;

-- conferma del critico: si tira un altro d20, con un 20 il bersaglio muore sul colpo
create or replace function public.tavolo_conferma(p_tiro bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c tavolo_critici; a tavolo_token; b tavolo_token; t tavolo_tiri; nat int; ferita jsonb := '{}';
begin
  update tavolo_critici set usato = true where tiro = p_tiro and autore = auth.uid() and not usato returning * into c;
  if c.tiro is null then raise exception 'Questo critico è già stato confermato'; end if;
  select * into a from tavolo_token where id = c.token;
  select * into b from tavolo_token where id = c.bersaglio;
  t := tavolo_tira('1d20', coalesce(a.nome, '') || ' → ' || coalesce(b.nome, '') || ' · conferma del critico', c.privato);
  nat := t.totale;
  if nat = 20 and b.id is not null then ferita := tavolo_ferisci(b.id, 0, true); end if;
  return jsonb_build_object('naturale', nat, 'uccisione', nat = 20, 'bersaglio', c.bersaglio, 'token', c.token, 'pf', ferita -> 'pf');
end $$;

-- ---------- incantesimi ad area ----------
-- chi lancia ha scelto il punto sulla mappa e quindi i bersagli; i danni si tirano una volta, ogni bersaglio tira il suo salvezza
create or replace function public.tavolo_area(p_token uuid, p_attacco int, p_bersagli uuid[], p_cd int default null, p_privato boolean default false)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  a tavolo_token; b tavolo_token; sa tavolo_schede; sb tavolo_schede; att jsonb; testo text; danni text; car text; cd int;
  dimezza boolean; td tavolo_tiri; ts tavolo_tiri; bonus int; salvo boolean; dmg int; esiti jsonb := '[]'; ferita jsonb; nome_att text;
begin
  if not tavolo_e_membro() then raise exception 'Non fai parte del tavolo'; end if;
  select * into a from tavolo_token where id = p_token;
  if a.id is null then raise exception 'Token non trovato'; end if;
  if not tavolo_e_dm() and (a.giocatore is null or a.giocatore <> tavolo_mio_giocatore()) then raise exception 'Puoi lanciare solo con il tuo token'; end if;
  if coalesce(array_length(p_bersagli, 1), 0) > 40 then raise exception 'Troppi bersagli'; end if;
  sa := tavolo_scheda_di(a);
  att := sa.dati -> 'attacchi' -> p_attacco;
  if att is null then raise exception 'Incantesimo non trovato nella scheda'; end if;
  nome_att := coalesce(nullif(att ->> 'nome', ''), 'incantesimo');
  testo := lower(coalesce(att ->> 'tipo', '') || ' ' || coalesce(att ->> 'nome', ''));
  danni := regexp_replace(coalesce(att ->> 'danni', ''), '\s+', '', 'g');
  car := case when testo ~ '\m(ts|tiro salvezza|salvezza)\s+(su\s+)?(for|forza)' then 'for'
              when testo ~ '\m(ts|tiro salvezza|salvezza)\s+(su\s+)?(des|destrezza)' then 'des'
              when testo ~ '\m(ts|tiro salvezza|salvezza)\s+(su\s+)?(cos|costituzione)' then 'cos'
              when testo ~ '\m(ts|tiro salvezza|salvezza)\s+(su\s+)?(int|intelligenza)' then 'int'
              when testo ~ '\m(ts|tiro salvezza|salvezza)\s+(su\s+)?(sag|saggezza)' then 'sag'
              when testo ~ '\m(ts|tiro salvezza|salvezza)\s+(su\s+)?(car|carisma)' then 'car' end;
  cd := coalesce((regexp_match(testo, '\mcd\s*(\d+)'))[1]::int, least(greatest(p_cd, 5), 30));
  dimezza := testo ~ 'dimezz|metà';

  if danni ~ '\d' then td := tavolo_tira(danni, coalesce(a.nome, '') || ' · ' || nome_att || ' (area)', p_privato); end if;
  for b in select * from tavolo_token where id = any(p_bersagli) and scena = a.scena loop
    if not tavolo_e_dm() and (b.scena <> tavolo_scena_attiva() or b.nascosto) then continue; end if;
    salvo := null;
    if car is not null and cd is not null then
      sb := tavolo_scheda_di(b);
      bonus := floor((coalesce(nullif(sb.dati ->> car, '')::numeric, 10) - 10) / 2)::int
             + case when (sb.dati ->> ('ts_' || car)) in ('true', '1') then tavolo_comp(sb) else 0 end;
      ts := tavolo_tira('1d20' || case when bonus < 0 then bonus::text else '+' || bonus end,
        coalesce(b.nome, '') || ' · TS ' || upper(car) || ' CD ' || cd || ' contro ' || nome_att, p_privato);
      salvo := ts.totale >= cd;
    end if;
    dmg := case when td.id is null then 0 when salvo then case when dimezza then td.totale / 2 else 0 end else td.totale end;
    ferita := case when dmg > 0 then tavolo_ferisci(b.id, dmg) else '{}'::jsonb end;
    esiti := esiti || jsonb_build_object('id', b.id, 'nome', b.nome, 'salvo', salvo, 'ts', ts.totale, 'danni', dmg, 'pf', ferita -> 'pf', 'morto', coalesce((ferita ->> 'morto')::boolean, false));
  end loop;
  return jsonb_build_object('danni', coalesce(td.totale, 0), 'cd', cd, 'car', car, 'dimezza', dimezza, 'esiti', esiti);
end $$;

-- ---------- permessi ----------
revoke execute on function public.tavolo_ferisci(uuid, int, boolean) from anon, public, authenticated;
revoke execute on function public.tavolo_comp(public.tavolo_schede) from anon, public;
revoke execute on function public.tavolo_attacca(uuid, uuid, int, int, boolean, text) from anon, public;
grant execute on function public.tavolo_attacca(uuid, uuid, int, int, boolean, text) to authenticated;
revoke execute on function public.tavolo_conferma(bigint) from anon, public;
grant execute on function public.tavolo_conferma(bigint) to authenticated;
revoke execute on function public.tavolo_area(uuid, int, uuid[], int, boolean) from anon, public;
grant execute on function public.tavolo_area(uuid, int, uuid[], int, boolean) to authenticated;

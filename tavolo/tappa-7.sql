-- Tavolo virtuale di Avalar — tappa 7: tiri salvezza su richiesta. Quando un incantesimo o un veleno chiede un tiro
-- salvezza, al giocatore (o al DM per i PNG) compare un avviso: con un clic tira, e i danni si contano da soli.
-- In più: «Finisci il turno» salta chi è a 0 PF.
-- Da incollare nell'SQL Editor di Supabase (New query › incolla › Run) dopo gli script delle tappe 1–6.
-- Si può rieseguire senza danni.

create table if not exists public.tavolo_salvezze (
  id uuid primary key default gen_random_uuid(),
  token uuid not null references public.tavolo_token on delete cascade,
  giocatore text,                       -- chi tira: il giocatore del token, o il DM se è un PNG
  nome text not null default '',        -- il bersaglio
  car text not null check (car in ('for', 'des', 'cos', 'int', 'sag', 'car')),
  cd int not null,
  danni int not null default 0,         -- già tirati: se il tiro riesce si dimezzano (o si annullano)
  dimezza boolean not null default true,
  motivo text not null default '',
  privato boolean not null default false,
  autore uuid,
  esito boolean,                        -- null: si aspetta il tiro
  tiro int,
  fatti int,                            -- danni tolti davvero
  creato timestamptz not null default now()
);
create index if not exists tavolo_salvezze_attesa on public.tavolo_salvezze (creato) where esito is null;

-- la caratteristica di un «TS Destrezza», «tiro salvezza su Saggezza», «TS Cos»…
create or replace function public.tavolo_car_ts(t text) returns text
language sql immutable as $$
  select case
    when t ~* '\m(ts|tiro salvezza|salvezza)\s+(su\s+|di\s+)?(for|forza)\M' then 'for'
    when t ~* '\m(ts|tiro salvezza|salvezza)\s+(su\s+|di\s+)?(des|destrezza)\M' then 'des'
    when t ~* '\m(ts|tiro salvezza|salvezza)\s+(su\s+|di\s+)?(cos|costituzione)\M' then 'cos'
    when t ~* '\m(ts|tiro salvezza|salvezza)\s+(su\s+|di\s+)?(int|intelligenza)\M' then 'int'
    when t ~* '\m(ts|tiro salvezza|salvezza)\s+(su\s+|di\s+)?(sag|saggezza)\M' then 'sag'
    when t ~* '\m(ts|tiro salvezza|salvezza)\s+(su\s+|di\s+)?(car|carisma)\M' then 'car' end
$$;

-- chiede il tiro salvezza al bersaglio: lo farà chi lo muove (o il DM)
create or replace function public.tavolo_chiedi_ts(b public.tavolo_token, p_car text, p_cd int, p_danni int, p_dimezza boolean, p_motivo text, p_privato boolean)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare r tavolo_salvezze;
begin
  delete from tavolo_salvezze where creato < now() - interval '1 day';
  insert into tavolo_salvezze (token, giocatore, nome, car, cd, danni, dimezza, motivo, privato, autore)
    values (b.id, b.giocatore, coalesce(b.nome, ''), p_car, p_cd, greatest(coalesce(p_danni, 0), 0), p_dimezza, coalesce(p_motivo, ''), p_privato, auth.uid())
    returning * into r;
  return jsonb_build_object('id', r.id, 'token', r.token, 'nome', r.nome, 'car', r.car, 'cd', r.cd, 'danni', r.danni);
end $$;

-- il tiro salvezza: bonus dalla scheda del bersaglio, poi i danni (interi, a metà o niente)
create or replace function public.tavolo_salva(p_id uuid, p_adv int default 0) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r tavolo_salvezze; b tavolo_token; sb tavolo_schede; bonus int; t tavolo_tiri; nat int; ok boolean; dmg int; ferita jsonb := '{}';
begin
  if not tavolo_e_membro() then raise exception 'Non fai parte del tavolo'; end if;
  select * into r from tavolo_salvezze where id = p_id for update;
  if r.id is null then raise exception 'Tiro salvezza non trovato'; end if;
  if r.esito is not null then raise exception 'Questo tiro salvezza è già stato fatto'; end if;
  if not tavolo_e_dm() and (r.giocatore is null or r.giocatore <> tavolo_mio_giocatore()) then raise exception 'Questo tiro salvezza non tocca a te'; end if;
  select * into b from tavolo_token where id = r.token;
  sb := tavolo_scheda_di(b);
  bonus := floor((coalesce(case when (sb.dati ->> r.car) ~ '^-?\d+(\.\d+)?$' then (sb.dati ->> r.car)::numeric end, 10) - 10) / 2)::int
         + case when (sb.dati ->> ('ts_' || r.car)) in ('true', '1') then tavolo_comp(sb) else 0 end;
  t := tavolo_tira(case p_adv when 1 then '2d20kh1' when 2 then '2d20kl1' else '1d20' end || case when bonus < 0 then bonus::text else '+' || bonus end,
    coalesce(b.nome, r.nome) || ' · TS ' || upper(r.car) || ' CD ' || r.cd || case when r.motivo <> '' then ' contro ' || r.motivo else '' end, r.privato);
  nat := (regexp_match(t.dettaglio, '\[(?:[^\]]*→ )?(\d+)\]'))[1]::int;
  ok := t.totale >= r.cd;
  dmg := case when ok then case when r.dimezza then r.danni / 2 else 0 end else r.danni end;
  if dmg > 0 and b.id is not null then ferita := tavolo_ferisci(b.id, dmg); end if;
  update tavolo_salvezze set esito = ok, tiro = t.totale, fatti = dmg where id = r.id;
  return jsonb_build_object('id', r.id, 'token', r.token, 'nome', r.nome, 'salvo', ok, 'tiro', t.totale, 'naturale', nat, 'danni', dmg,
    'pf', ferita -> 'pf', 'morto', coalesce((ferita ->> 'morto')::boolean, false));
end $$;

-- il DM può togliere una richiesta (per esempio se il bersaglio non c'è più)
create or replace function public.tavolo_salva_annulla(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not tavolo_e_dm() then raise exception 'Solo il DM'; end if;
  delete from tavolo_salvezze where id = p_id;
end $$;

-- ---------- incantesimi (ad area o su un bersaglio) con tiro salvezza: ora lo tira chi lo subisce ----------
create or replace function public.tavolo_area(p_token uuid, p_attacco int, p_bersagli uuid[], p_cd int default null, p_privato boolean default false)
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
  att := sa.dati -> 'attacchi' -> p_attacco;
  if att is null then raise exception 'Incantesimo non trovato nella scheda'; end if;
  nome_att := coalesce(nullif(att ->> 'nome', ''), 'incantesimo');
  testo := lower(coalesce(att ->> 'tipo', '') || ' ' || coalesce(att ->> 'nome', ''));
  danni := regexp_replace(coalesce(att ->> 'danni', ''), '\s+', '', 'g');
  car := tavolo_car_ts(testo);
  cd := coalesce((regexp_match(testo, '\mcd\s*(\d+)'))[1]::int, least(greatest(p_cd, 5), 30));
  dimezza := testo ~ 'dimezz|metà';

  if danni ~ '\d' then td := tavolo_tira(danni, coalesce(a.nome, '') || ' · ' || nome_att, p_privato); end if;
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

-- ---------- attacco: se colpisce e nelle note c'è «+ 2d8 … (TS Costituzione CD 11)», quei danni li decide il tiro salvezza ----------
create or replace function public.tavolo_attacca(p_token uuid, p_bersaglio uuid, p_attacco int, p_adv int default 0, p_privato boolean default false, p_extra text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  a tavolo_token; b tavolo_token; sa tavolo_schede; sb tavolo_schede; att jsonb;
  bonus int; danni text; ca int; tiro tavolo_tiri; td tavolo_tiri; nat int; colpito boolean; critico boolean := false;
  dmg int := 0; ferita jsonb := '{}'; nome_att text; testo text; car text; cd int; dv text; tv tavolo_tiri; ric jsonb; extra text := lower(regexp_replace(coalesce(p_extra, ''), '\s+', '', 'g'));
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
    -- «+ 2d8 da veleno (TS Costituzione CD 11, dimezza)»: i danni in più li decide il tiro salvezza del bersaglio
    testo := lower(coalesce(att ->> 'tipo', ''));
    car := tavolo_car_ts(testo); cd := (regexp_match(testo, '\mcd\s*(\d+)'))[1]::int;
    dv := (regexp_match(testo, '\+\s*(\d{1,2}d\d{1,3}(?:\s*[+-]\s*\d{1,3})?)'))[1];
    if car is not null and cd is not null and dv is not null and not coalesce((ferita ->> 'morto')::boolean, false) then
      dv := regexp_replace(dv, '\s+', '', 'g');
      tv := tavolo_tira(case when critico then tavolo_critico(dv) else dv end, coalesce(a.nome, '') || ' → ' || coalesce(b.nome, '') || ' · danni in più (TS)', p_privato);
      ric := tavolo_chiedi_ts(b, car, cd, tv.totale, testo ~ 'dimezz|metà', nome_att, p_privato);
    end if;
  end if;
  if critico then insert into tavolo_critici (tiro, autore, token, bersaglio, privato) values (tiro.id, auth.uid(), a.id, b.id, p_privato) on conflict do nothing; end if;

  return jsonb_build_object('colpito', colpito, 'critico', critico, 'fallito', nat = 1, 'naturale', nat, 'totale', tiro.totale,
    'danni', dmg, 'pf', ferita -> 'pf', 'morto', coalesce((ferita ->> 'morto')::boolean, false), 'tiro', tiro.id, 'tiro_danni', td.id, 'salvezza', ric);
end $$;


-- ---------- «Finisci il turno»: chi è a 0 PF (o morto) viene saltato ----------
create or replace function public.tavolo_turno_fuori(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from tavolo_turno tu join tavolo_token b on b.id = tu.token
    where tu.id = p_id and (b.pf = 0 or coalesce(b.condizioni, '[]'::jsonb) ? 'Morto'
      or (b.pf is null and coalesce((tavolo_scheda_di(b)).dati ->> 'pf', '') = '0')))
$$;

create or replace function public.tavolo_turno_avanti() returns uuid
language plpgsql security definer set search_path = public as $$
declare cur uuid; prossimo uuid; primo uuid; r int; mio text := tavolo_mio_giocatore(); n int; giri int := 0;
begin
  select turno, round into cur, r from tavolo_stato where id = 1;
  if not tavolo_e_dm() and not exists (select 1 from tavolo_turno where id = cur and giocatore = mio) then
    raise exception 'Non è il tuo turno';
  end if;
  select count(*) into n from tavolo_turno;
  select id into primo from tavolo_turno order by valore desc, creato limit 1;
  loop
    if cur is null or not exists (select 1 from tavolo_turno where id = cur) then
      prossimo := primo;
    else
      select t.id into prossimo from tavolo_turno t, tavolo_turno c
       where c.id = cur and (t.valore < c.valore or (t.valore = c.valore and t.creato > c.creato))
       order by t.valore desc, t.creato limit 1;
      if prossimo is null then prossimo := primo; r := r + 1; end if;
    end if;
    giri := giri + 1;
    exit when prossimo is null or giri >= n or not tavolo_turno_fuori(prossimo);
    cur := prossimo;
  end loop;
  update tavolo_stato set turno = prossimo, round = r where id = 1;
  return prossimo;
end $$;

-- ---------- permessi e tempo reale ----------
alter table public.tavolo_salvezze enable row level security;
drop policy if exists "salvezze: lettura" on public.tavolo_salvezze;
create policy "salvezze: lettura" on public.tavolo_salvezze for select to authenticated
  using (tavolo_e_dm() or (tavolo_e_membro() and giocatore = tavolo_mio_giocatore()));
revoke all on public.tavolo_salvezze from anon;
revoke insert, update, delete on public.tavolo_salvezze from authenticated;
grant select on public.tavolo_salvezze to authenticated;
revoke execute on function public.tavolo_chiedi_ts(public.tavolo_token, text, int, int, boolean, text, boolean) from anon, public, authenticated;
revoke execute on function public.tavolo_salva(uuid, int) from anon, public;
grant execute on function public.tavolo_salva(uuid, int) to authenticated;
revoke execute on function public.tavolo_salva_annulla(uuid) from anon, public;
grant execute on function public.tavolo_salva_annulla(uuid) to authenticated;
revoke execute on function public.tavolo_area(uuid, int, uuid[], int, boolean) from anon, public;
grant execute on function public.tavolo_area(uuid, int, uuid[], int, boolean) to authenticated;
revoke execute on function public.tavolo_attacca(uuid, uuid, int, int, boolean, text) from anon, public;
grant execute on function public.tavolo_attacca(uuid, uuid, int, int, boolean, text) to authenticated;
revoke execute on function public.tavolo_turno_fuori(uuid) from anon, public, authenticated;
revoke execute on function public.tavolo_turno_avanti() from anon, public;
grant execute on function public.tavolo_turno_avanti() to authenticated;
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tavolo_salvezze') then
    alter publication supabase_realtime add table public.tavolo_salvezze;
  end if;
end $$;

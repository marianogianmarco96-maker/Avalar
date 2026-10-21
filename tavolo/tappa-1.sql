-- Tavolo virtuale di Avalar — tappa 1: mappa, token, dadi condivisi, righello.
-- Da incollare una volta nell'SQL Editor di Supabase (New query › incolla › Run).
-- Si può rieseguire senza danni: crea solo ciò che manca e riscrive funzioni e permessi.
--
-- Chi è chi: il sito accede a Supabase con un account per persona, ricavato in automatico dal codice del DM
-- o dalla password del giocatore, quindi nessuno deve registrarsi. tavolo_membri dice chi è il DM e quale
-- giocatore è ciascun account: chi non c'è (anche se riesce a creare un account) non vede e non tocca nulla.

-- ---------- tabelle ----------
create table if not exists public.tavolo_membri (
  user_id uuid primary key references auth.users on delete cascade,
  ruolo text not null check (ruolo in ('dm', 'giocatore')),
  giocatore text unique,                      -- id del giocatore sul sito (livion, sam…); null per il DM
  nome text not null,
  email text,
  creato timestamptz not null default now(),
  check ((ruolo = 'dm') = (giocatore is null))
);
create unique index if not exists tavolo_un_solo_dm on public.tavolo_membri ((true)) where ruolo = 'dm';

create table if not exists public.tavolo_scene (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  mappa text,                                 -- percorso dell'immagine nel bucket «tavolo»
  larghezza int not null default 2100,        -- misure della mappa in pixel
  altezza int not null default 1400,
  griglia real not null default 70 check (griglia >= 8),   -- lato di una casella in pixel della mappa
  griglia_x real not null default 0,          -- spostamento della griglia per allinearla alla mappa
  griglia_y real not null default 0,
  griglia_visibile boolean not null default true,
  metri real not null default 1.5,            -- metri per casella
  creata timestamptz not null default now()
);

create table if not exists public.tavolo_stato (
  id int primary key default 1 check (id = 1),
  scena uuid references public.tavolo_scene on delete set null,
  -- nome del canale per righello e trascinamenti dal vivo: lo leggono solo i membri
  canale text not null default replace(gen_random_uuid()::text, '-', '')
);
insert into public.tavolo_stato (id) values (1) on conflict do nothing;

create table if not exists public.tavolo_token (
  id uuid primary key default gen_random_uuid(),
  scena uuid not null references public.tavolo_scene on delete cascade,
  nome text not null default '',
  immagine text,                              -- piccola immagine (data:…) o null per il cerchio colorato
  colore text not null default '#7d2530',
  x real not null default 0,                  -- angolo in alto a sinistra, in pixel della mappa
  y real not null default 0,
  misura real not null default 1 check (misura > 0 and misura <= 10),  -- caselle per lato
  giocatore text,                             -- chi lo può muovere oltre al DM (id del giocatore)
  scheda text,                                -- scheda del sito collegata (pg-livion, png-levi…)
  nascosto boolean not null default false,    -- visibile solo al DM
  aggiornato timestamptz not null default now()
);
create index if not exists tavolo_token_scena on public.tavolo_token (scena);

create table if not exists public.tavolo_tiri (
  id bigint generated always as identity primary key,
  autore uuid not null default auth.uid() references auth.users on delete cascade,
  nome text not null,
  formula text not null,
  motivo text,
  totale int not null,
  dettaglio text not null,
  privato boolean not null default false,     -- tiro nascosto: lo vedono solo il DM e chi l'ha fatto
  creato timestamptz not null default now()
);
create index if not exists tavolo_tiri_creato on public.tavolo_tiri (creato desc);

-- ---------- chi sono ----------
create or replace function public.tavolo_e_dm() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from tavolo_membri where user_id = auth.uid() and ruolo = 'dm')
$$;
create or replace function public.tavolo_e_membro() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from tavolo_membri where user_id = auth.uid())
$$;
create or replace function public.tavolo_mio_giocatore() returns text
language sql stable security definer set search_path = public as $$
  select giocatore from tavolo_membri where user_id = auth.uid()
$$;
-- i giocatori vedono solo la scena in cui il DM li ha portati (le altre sono la sua preparazione)
create or replace function public.tavolo_scena_attiva() returns uuid
language sql stable security definer set search_path = public as $$
  select scena from tavolo_stato where id = 1
$$;
create or replace function public.tavolo_mappa_attiva() returns text
language sql stable security definer set search_path = public as $$
  select s.mappa from tavolo_stato st join tavolo_scene s on s.id = st.scena where st.id = 1
$$;

-- il primo account del DM che apre il tavolo diventa il DM (una volta sola).
-- Se il codice del DM cambia, per ricominciare: delete from tavolo_membri where ruolo = 'dm';
create or replace function public.tavolo_reclama_dm(p_email text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;
  if exists (select 1 from tavolo_membri where user_id = auth.uid() and ruolo = 'dm') then return true; end if;
  if exists (select 1 from tavolo_membri where ruolo = 'dm') then return false; end if;
  delete from tavolo_membri where user_id = auth.uid();
  insert into tavolo_membri (user_id, ruolo, giocatore, nome, email) values (auth.uid(), 'dm', null, 'DM', p_email);
  return true;
end $$;

-- ---------- dadi: li tira il server, così il risultato è uguale per tutti e nessuno lo può truccare ----------
-- Formule: 1d20+5, 2d6+1d4-1, 2d20kh1 (vantaggio), 2d20kl1 (svantaggio), 4d6kh3, d100.
create or replace function public.tavolo_tira(p_formula text, p_motivo text default null, p_privato boolean default false)
returns public.tavolo_tiri
language plpgsql security definer set search_path = public as $$
declare
  f text := lower(regexp_replace(coalesce(p_formula, ''), '\s+', '', 'g'));
  m text[]; segno int; n int; facce int; tieni text; quanti int;
  dadi int[]; tenuti int[]; i int; tot int := 0; parti text[] := '{}'; parte text;
  quanti_dadi int := 0; chi tavolo_membri; riga tavolo_tiri;
begin
  select * into chi from tavolo_membri where user_id = auth.uid();
  if not found then raise exception 'Non fai parte del tavolo'; end if;
  if f = '' or length(f) > 80 or f !~ '^[+-]?(\d*d\d+((kh|kl)\d+)?|\d+)([+-](\d*d\d+((kh|kl)\d+)?|\d+))*$' then
    raise exception 'Formula non valida: usa per esempio 1d20+5 o 2d6+3';
  end if;
  for m in select regexp_matches(f, '([+-]?)(?:(\d*)d(\d+)(?:(kh|kl)(\d+))?|(\d+))', 'g') loop
    segno := case when m[1] = '-' then -1 else 1 end;
    if m[3] is not null then
      n := coalesce(nullif(m[2], '')::int, 1); facce := m[3]::int;
      if n < 1 or n > 100 or facce < 2 or facce > 1000 then raise exception 'Troppi dadi o dado non valido'; end if;
      quanti_dadi := quanti_dadi + n;
      if quanti_dadi > 200 then raise exception 'Troppi dadi'; end if;
      dadi := '{}';
      for i in 1..n loop dadi := dadi || (1 + floor(random() * facce))::int; end loop;
      tieni := m[4]; quanti := coalesce(m[5]::int, n);
      if tieni is not null then
        quanti := least(greatest(quanti, 1), n);
        if tieni = 'kh' then select array_agg(v) into tenuti from (select v from unnest(dadi) v order by v desc limit quanti) s;
        else select array_agg(v) into tenuti from (select v from unnest(dadi) v order by v asc limit quanti) s; end if;
        parte := n || 'd' || facce || tieni || quanti || ' [' || array_to_string(dadi, ', ') || ' → ' || array_to_string(tenuti, ', ') || ']';
      else
        tenuti := dadi;
        parte := n || 'd' || facce || ' [' || array_to_string(dadi, ', ') || ']';
      end if;
      tot := tot + segno * (select sum(v) from unnest(tenuti) v);
    else
      tot := tot + segno * m[6]::int;
      parte := m[6];
    end if;
    parti := parti || (case when segno < 0 then '− ' when array_length(parti, 1) is null then '' else '+ ' end || parte);
  end loop;
  insert into tavolo_tiri (autore, nome, formula, motivo, totale, dettaglio, privato)
  values (auth.uid(), chi.nome, f, nullif(left(trim(coalesce(p_motivo, '')), 80), ''), tot, array_to_string(parti, ' '), coalesce(p_privato, false))
  returning * into riga;
  -- tengo solo gli ultimi 300 tiri
  delete from tavolo_tiri where id <= riga.id - 300;
  return riga;
end $$;

-- i giocatori muovono i propri token, ma non ne cambiano nient'altro
create or replace function public.tavolo_token_guardia() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tavolo_e_dm() then new.aggiornato := now(); return new; end if;
  if (new.id, new.scena, new.nome, new.immagine, new.colore, new.misura, new.giocatore, new.scheda, new.nascosto)
     is distinct from (old.id, old.scena, old.nome, old.immagine, old.colore, old.misura, old.giocatore, old.scheda, old.nascosto) then
    raise exception 'Puoi solo spostare il tuo token';
  end if;
  new.aggiornato := now();
  return new;
end $$;
drop trigger if exists tavolo_token_guardia on public.tavolo_token;
create trigger tavolo_token_guardia before update on public.tavolo_token for each row execute function public.tavolo_token_guardia();

-- ---------- permessi ----------
alter table public.tavolo_membri enable row level security;
alter table public.tavolo_scene enable row level security;
alter table public.tavolo_stato enable row level security;
alter table public.tavolo_token enable row level security;
alter table public.tavolo_tiri enable row level security;

drop policy if exists "membri: lettura" on public.tavolo_membri;
drop policy if exists "membri: il DM gestisce" on public.tavolo_membri;
create policy "membri: lettura" on public.tavolo_membri for select to authenticated using (tavolo_e_membro());
create policy "membri: il DM gestisce" on public.tavolo_membri for all to authenticated using (tavolo_e_dm()) with check (tavolo_e_dm());

drop policy if exists "scene: lettura" on public.tavolo_scene;
drop policy if exists "scene: il DM gestisce" on public.tavolo_scene;
create policy "scene: lettura" on public.tavolo_scene for select to authenticated
  using (tavolo_e_dm() or (tavolo_e_membro() and id = tavolo_scena_attiva()));
create policy "scene: il DM gestisce" on public.tavolo_scene for all to authenticated using (tavolo_e_dm()) with check (tavolo_e_dm());

drop policy if exists "stato: lettura" on public.tavolo_stato;
drop policy if exists "stato: il DM cambia scena" on public.tavolo_stato;
create policy "stato: lettura" on public.tavolo_stato for select to authenticated using (tavolo_e_membro());
create policy "stato: il DM cambia scena" on public.tavolo_stato for update to authenticated using (tavolo_e_dm()) with check (tavolo_e_dm());

drop policy if exists "token: lettura" on public.tavolo_token;
drop policy if exists "token: il DM gestisce" on public.tavolo_token;
drop policy if exists "token: il giocatore muove il suo" on public.tavolo_token;
create policy "token: lettura" on public.tavolo_token for select to authenticated
  using (tavolo_e_dm() or (tavolo_e_membro() and scena = tavolo_scena_attiva() and (not nascosto or giocatore = tavolo_mio_giocatore())));
create policy "token: il DM gestisce" on public.tavolo_token for all to authenticated using (tavolo_e_dm()) with check (tavolo_e_dm());
create policy "token: il giocatore muove il suo" on public.tavolo_token for update to authenticated
  using (giocatore = tavolo_mio_giocatore()) with check (giocatore = tavolo_mio_giocatore());

drop policy if exists "tiri: lettura" on public.tavolo_tiri;
drop policy if exists "tiri: il DM cancella" on public.tavolo_tiri;
create policy "tiri: lettura" on public.tavolo_tiri for select to authenticated
  using (tavolo_e_dm() or (tavolo_e_membro() and (not privato or autore = auth.uid())));
create policy "tiri: il DM cancella" on public.tavolo_tiri for delete to authenticated using (tavolo_e_dm());
-- i tiri si aggiungono solo con tavolo_tira()

revoke all on public.tavolo_membri, public.tavolo_scene, public.tavolo_stato, public.tavolo_token, public.tavolo_tiri from anon;
revoke insert, update on public.tavolo_tiri from authenticated;
revoke execute on function public.tavolo_tira(text, text, boolean), public.tavolo_reclama_dm(text) from anon, public;
grant execute on function public.tavolo_tira(text, text, boolean), public.tavolo_reclama_dm(text) to authenticated;

-- ---------- immagini delle mappe (bucket privato: le vedono solo i membri) ----------
insert into storage.buckets (id, name, public) values ('tavolo', 'tavolo', false) on conflict (id) do nothing;
drop policy if exists "tavolo: lettura mappe" on storage.objects;
drop policy if exists "tavolo: il DM carica" on storage.objects;
drop policy if exists "tavolo: il DM sostituisce" on storage.objects;
drop policy if exists "tavolo: il DM cancella" on storage.objects;
create policy "tavolo: lettura mappe" on storage.objects for select to authenticated using (bucket_id = 'tavolo' and (public.tavolo_e_dm() or (public.tavolo_e_membro() and name = public.tavolo_mappa_attiva())));
create policy "tavolo: il DM carica" on storage.objects for insert to authenticated with check (bucket_id = 'tavolo' and public.tavolo_e_dm());
create policy "tavolo: il DM sostituisce" on storage.objects for update to authenticated using (bucket_id = 'tavolo' and public.tavolo_e_dm());
create policy "tavolo: il DM cancella" on storage.objects for delete to authenticated using (bucket_id = 'tavolo' and public.tavolo_e_dm());

-- ---------- tempo reale ----------
do $$
declare t text;
begin
  foreach t in array array['tavolo_scene', 'tavolo_stato', 'tavolo_token', 'tavolo_tiri'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

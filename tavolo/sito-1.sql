-- Sito di Avalar — le modifiche del DM si salvano su Supabase, senza passare da GitHub.
-- Da incollare una volta nell'SQL Editor di Supabase (New query › incolla › Run), dopo tavolo/tappa-1.sql.
-- Si può rieseguire senza danni: crea solo ciò che manca e riscrive funzioni e permessi.
--
-- Come funziona: premendo «Salva» il browser del DM prepara le stesse copie di strumenti/pubblica.py
-- (data.enc per il DM e giocatori/<id>.enc per ogni giocatore, ognuna cifrata con la sua password) e le carica
-- nel bucket «sito», in una cartella nuova per ogni salvataggio. sito_stato dice quale cartella è quella in uso.
-- Supabase riceve solo file cifrati: i segreti della campagna li legge solo chi ha la password giusta.
-- Il sito confronta la versione di Supabase con versione.json su GitHub e apre la più recente.

-- ---------- versioni ----------
create table if not exists public.sito_stato (
  id int primary key default 1 check (id = 1),
  versione bigint not null default 0,         -- millisecondi dal 1970, come «pub» in versione.json
  cartella text,                              -- cartella in uso nel bucket «sito» (v/…)
  aggiornato timestamptz not null default now()
);
insert into public.sito_stato (id) values (1) on conflict do nothing;

-- ogni salvataggio del DM: si tengono le ultime 15 cartelle, per poter tornare indietro
create table if not exists public.sito_versioni (
  id bigint generated always as identity primary key,
  versione bigint not null,
  cartella text not null unique,
  nota text,                                  -- cosa è cambiato («2 schede, 1 evento»)
  creata timestamptz not null default now()
);

alter table public.sito_stato enable row level security;
alter table public.sito_versioni enable row level security;
-- quale cartella è in uso lo legge chiunque apra il sito (anche prima di entrare): i file sono cifrati
drop policy if exists "sito: lettura stato" on public.sito_stato;
create policy "sito: lettura stato" on public.sito_stato for select to anon, authenticated using (true);
drop policy if exists "sito: il DM vede le versioni" on public.sito_versioni;
create policy "sito: il DM vede le versioni" on public.sito_versioni for select to authenticated using (public.tavolo_e_dm());
grant select on public.sito_stato to anon, authenticated;
grant select on public.sito_versioni to authenticated;

create or replace function public.sito_adesso() returns bigint
language sql stable as $$ select (extract(epoch from clock_timestamp()) * 1000)::bigint $$;

-- il DM ha caricato i file di un salvataggio in p_cartella: diventa la versione in uso.
-- p_prima è la versione da cui è partito: se nel frattempo un altro dispositivo ha salvato, si ferma
-- (il sito riparte dai dati nuovi e riprova, così nessuno cancella le modifiche dell'altro).
-- Restituisce la nuova versione e le cartelle vecchie da togliere dal bucket.
create or replace function public.sito_pubblica(p_prima bigint, p_cartella text, p_nota text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare st sito_stato; v bigint; vecchie text[];
begin
  if not tavolo_e_dm() then raise exception 'Solo il DM può salvare il sito'; end if;
  if p_cartella !~ '^v/[A-Za-z0-9_-]{6,60}$' then raise exception 'Cartella non valida'; end if;
  select * into st from sito_stato where id = 1 for update;
  if st.versione <> coalesce(p_prima, 0) then raise exception 'conflitto: il sito è stato salvato da un altro dispositivo'; end if;
  v := greatest(sito_adesso(), st.versione + 1);
  insert into sito_versioni (versione, cartella, nota) values (v, p_cartella, left(p_nota, 300));
  update sito_stato set versione = v, cartella = p_cartella, aggiornato = now() where id = 1;
  with tolte as (
    delete from sito_versioni where id in (select id from sito_versioni order by versione desc offset 15) returning cartella
  ) select coalesce(array_agg(cartella), '{}') into vecchie from tolte;
  return jsonb_build_object('versione', v, 'vecchie', to_jsonb(vecchie));
end $$;

-- torna a un salvataggio precedente: la sua cartella torna in uso con una versione nuova
create or replace function public.sito_ripristina(p_id bigint) returns bigint
language plpgsql security definer set search_path = public as $$
declare c text; v bigint; st sito_stato;
begin
  if not tavolo_e_dm() then raise exception 'Solo il DM può ripristinare il sito'; end if;
  select cartella into c from sito_versioni where id = p_id;
  if c is null then raise exception 'Versione non trovata'; end if;
  select * into st from sito_stato where id = 1 for update;
  v := greatest(sito_adesso(), st.versione + 1);
  update sito_versioni set versione = v where id = p_id;
  update sito_stato set versione = v, cartella = c, aggiornato = now() where id = 1;
  return v;
end $$;

revoke all on function public.sito_pubblica(bigint, text, text) from public, anon;
revoke all on function public.sito_ripristina(bigint) from public, anon;
grant execute on function public.sito_pubblica(bigint, text, text) to authenticated;
grant execute on function public.sito_ripristina(bigint) to authenticated;

-- ---------- file (bucket pubblico: chiunque scarica per indirizzo, ma sono cifrati; solo il DM scrive) ----------
-- dentro: v/<cartella>/data.enc e v/<cartella>/giocatori/<id>.enc, più le immagini caricate dal sito
-- (blobs/sb-….jpg in chiaro, quelle che vede chiunque; priv/sb-….bin cifrate)
insert into storage.buckets (id, name, public, file_size_limit) values ('sito', 'sito', true, 52428800)
  on conflict (id) do update set public = true;
drop policy if exists "sito: il DM elenca" on storage.objects;
drop policy if exists "sito: il DM carica" on storage.objects;
drop policy if exists "sito: il DM sostituisce" on storage.objects;
drop policy if exists "sito: il DM cancella" on storage.objects;
create policy "sito: il DM elenca" on storage.objects for select to authenticated using (bucket_id = 'sito' and public.tavolo_e_dm());
create policy "sito: il DM carica" on storage.objects for insert to authenticated with check (bucket_id = 'sito' and public.tavolo_e_dm());
create policy "sito: il DM sostituisce" on storage.objects for update to authenticated using (bucket_id = 'sito' and public.tavolo_e_dm());
create policy "sito: il DM cancella" on storage.objects for delete to authenticated using (bucket_id = 'sito' and public.tavolo_e_dm());

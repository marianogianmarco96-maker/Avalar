-- Tavolo virtuale di Avalar — tappa 2: maschera sulla mappa, ordine del turno, chat di testo.
-- Da incollare nell'SQL Editor di Supabase (New query › incolla › Run) dopo tappa-1.sql.
-- Si può rieseguire senza danni.

-- ---------- maschera (nebbia) ----------
-- con la maschera attiva la mappa parte tutta coperta; il DM svela e ricopre a rettangoli o a pennello.
alter table public.tavolo_scene add column if not exists maschera boolean not null default false;

create table if not exists public.tavolo_maschera (
  id bigint generated always as identity primary key,
  scena uuid not null references public.tavolo_scene on delete cascade,
  svela boolean not null,                     -- true: toglie la maschera, false: la rimette
  forma text not null check (forma in ('rett', 'pennello')),
  punti jsonb not null,                       -- rett: [x, y, larghezza, altezza]; pennello: [x1, y1, x2, y2, …]
  raggio real,                                -- solo pennello
  creato timestamptz not null default now()
);
create index if not exists tavolo_maschera_scena on public.tavolo_maschera (scena, id);

-- ---------- ordine del turno ----------
create table if not exists public.tavolo_turno (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  valore real not null default 0,
  token uuid references public.tavolo_token on delete set null,
  immagine text,
  colore text,
  giocatore text,                             -- chi può cambiarne il valore oltre al DM
  nascosto boolean not null default false,    -- visibile solo al DM
  creato timestamptz not null default now()
);
alter table public.tavolo_stato add column if not exists turno uuid;      -- chi sta agendo
alter table public.tavolo_stato add column if not exists round int not null default 1;

-- ---------- chat ----------
create table if not exists public.tavolo_chat (
  id bigint generated always as identity primary key,
  autore uuid not null default auth.uid() references auth.users on delete cascade,
  nome text not null,
  testo text not null check (length(testo) between 1 and 1000),
  per text,                                   -- sussurro: id del giocatore, oppure 'dm'; null = tutti
  creato timestamptz not null default now()
);
create index if not exists tavolo_chat_creato on public.tavolo_chat (creato desc);

-- ---------- funzioni ----------
-- passa al prossimo nell'ordine del turno: lo può fare il DM o chi sta agendo
create or replace function public.tavolo_turno_avanti() returns uuid
language plpgsql security definer set search_path = public as $$
declare cur uuid; prossimo uuid; primo uuid; r int; mio text := tavolo_mio_giocatore();
begin
  select turno, round into cur, r from tavolo_stato where id = 1;
  if not tavolo_e_dm() and not exists (select 1 from tavolo_turno where id = cur and giocatore = mio) then
    raise exception 'Non è il tuo turno';
  end if;
  select id into primo from tavolo_turno order by valore desc, creato limit 1;
  if cur is null or not exists (select 1 from tavolo_turno where id = cur) then
    prossimo := primo;
  else
    select t.id into prossimo from tavolo_turno t, tavolo_turno c
     where c.id = cur and (t.valore < c.valore or (t.valore = c.valore and t.creato > c.creato))
     order by t.valore desc, t.creato limit 1;
    if prossimo is null then prossimo := primo; r := r + 1; end if;
  end if;
  update tavolo_stato set turno = prossimo, round = r where id = 1;
  return prossimo;
end $$;

-- scrive in chat (/w per sussurrare a un giocatore o al DM)
create or replace function public.tavolo_scrivi(p_testo text, p_per text default null) returns public.tavolo_chat
language plpgsql security definer set search_path = public as $$
declare chi tavolo_membri; riga tavolo_chat;
begin
  select * into chi from tavolo_membri where user_id = auth.uid();
  if not found then raise exception 'Non fai parte del tavolo'; end if;
  if p_per is not null and p_per <> 'dm' and not exists (select 1 from tavolo_membri where giocatore = p_per) then
    raise exception 'Giocatore sconosciuto';
  end if;
  insert into tavolo_chat (autore, nome, testo, per) values (auth.uid(), chi.nome, left(trim(p_testo), 1000), p_per) returning * into riga;
  delete from tavolo_chat where id <= riga.id - 300;
  return riga;
end $$;

-- i giocatori cambiano solo il valore delle proprie voci
create or replace function public.tavolo_turno_guardia() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tavolo_e_dm() then return new; end if;
  if tg_op = 'INSERT' then
    new.nascosto := false; return new;
  end if;
  if (new.id, new.nome, new.token, new.immagine, new.colore, new.giocatore, new.nascosto)
     is distinct from (old.id, old.nome, old.token, old.immagine, old.colore, old.giocatore, old.nascosto) then
    raise exception 'Puoi cambiare solo il tuo valore di iniziativa';
  end if;
  return new;
end $$;
drop trigger if exists tavolo_turno_guardia on public.tavolo_turno;
create trigger tavolo_turno_guardia before insert or update on public.tavolo_turno for each row execute function public.tavolo_turno_guardia();

-- ---------- permessi ----------
alter table public.tavolo_maschera enable row level security;
alter table public.tavolo_turno enable row level security;
alter table public.tavolo_chat enable row level security;

drop policy if exists "maschera: lettura" on public.tavolo_maschera;
drop policy if exists "maschera: il DM gestisce" on public.tavolo_maschera;
create policy "maschera: lettura" on public.tavolo_maschera for select to authenticated
  using (tavolo_e_dm() or (tavolo_e_membro() and scena = tavolo_scena_attiva()));
create policy "maschera: il DM gestisce" on public.tavolo_maschera for all to authenticated using (tavolo_e_dm()) with check (tavolo_e_dm());

drop policy if exists "turno: lettura" on public.tavolo_turno;
drop policy if exists "turno: il DM gestisce" on public.tavolo_turno;
drop policy if exists "turno: il giocatore aggiunge il suo" on public.tavolo_turno;
drop policy if exists "turno: il giocatore cambia il suo" on public.tavolo_turno;
drop policy if exists "turno: il giocatore toglie il suo" on public.tavolo_turno;
create policy "turno: lettura" on public.tavolo_turno for select to authenticated
  using (tavolo_e_dm() or (tavolo_e_membro() and (not nascosto or giocatore = tavolo_mio_giocatore())));
create policy "turno: il DM gestisce" on public.tavolo_turno for all to authenticated using (tavolo_e_dm()) with check (tavolo_e_dm());
create policy "turno: il giocatore aggiunge il suo" on public.tavolo_turno for insert to authenticated
  with check (giocatore = tavolo_mio_giocatore());
create policy "turno: il giocatore cambia il suo" on public.tavolo_turno for update to authenticated
  using (giocatore = tavolo_mio_giocatore()) with check (giocatore = tavolo_mio_giocatore());
create policy "turno: il giocatore toglie il suo" on public.tavolo_turno for delete to authenticated
  using (giocatore = tavolo_mio_giocatore());

drop policy if exists "chat: lettura" on public.tavolo_chat;
drop policy if exists "chat: il DM cancella" on public.tavolo_chat;
create policy "chat: lettura" on public.tavolo_chat for select to authenticated
  using (tavolo_e_dm() or (tavolo_e_membro() and (per is null or per = tavolo_mio_giocatore() or autore = auth.uid())));
create policy "chat: il DM cancella" on public.tavolo_chat for delete to authenticated using (tavolo_e_dm());
-- i messaggi si scrivono solo con tavolo_scrivi()

revoke all on public.tavolo_maschera, public.tavolo_turno, public.tavolo_chat from anon;
revoke insert, update on public.tavolo_chat from authenticated;
revoke execute on function public.tavolo_turno_avanti(), public.tavolo_scrivi(text, text) from anon, public;
grant execute on function public.tavolo_turno_avanti(), public.tavolo_scrivi(text, text) to authenticated;

-- ---------- tempo reale ----------
do $$
declare t text;
begin
  foreach t in array array['tavolo_maschera', 'tavolo_turno', 'tavolo_chat'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

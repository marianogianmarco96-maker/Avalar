-- Tavolo virtuale di Avalar — tappa 4: muri, porte e nebbia automatica (ognuno vede solo ciò che vedono i suoi token).
-- Da incollare nell'SQL Editor di Supabase (New query › incolla › Run) dopo gli script delle tappe 1, 2 e 3.
-- Si può rieseguire senza danni.

-- ---------- scene ----------
alter table public.tavolo_scene add column if not exists visuale boolean not null default false;         -- nebbia automatica: si vede solo ciò che vedono i token
alter table public.tavolo_scene add column if not exists esplora boolean not null default true;          -- le zone già viste restano in penombra
alter table public.tavolo_scene add column if not exists vista_condivisa boolean not null default false; -- ogni giocatore vede anche ciò che vedono i compagni

-- ---------- token ----------
-- fin dove vede il token, in metri (18 = scurovisione); null = fin dove arrivano i muri
alter table public.tavolo_token add column if not exists vista real check (vista is null or vista between 0 and 1000);

-- ---------- muri e porte ----------
-- ogni muro è un tratto da (x1, y1) a (x2, y2), in pixel della mappa. Le porte aperte lasciano passare la vista.
create table if not exists public.tavolo_muri (
  id uuid primary key default gen_random_uuid(),
  scena uuid not null references public.tavolo_scene on delete cascade,
  punti jsonb not null check (jsonb_typeof(punti) = 'array' and jsonb_array_length(punti) = 4),
  porta boolean not null default false,
  aperta boolean not null default false,
  bloccata boolean not null default false,     -- porta chiusa a chiave: la apre solo il DM
  creato timestamptz not null default now()
);
create index if not exists tavolo_muri_scena on public.tavolo_muri (scena);

-- i giocatori aprono e chiudono le porte (non quelle chiuse a chiave) della scena in cui si trovano
create or replace function public.tavolo_porta(p_id uuid, p_aperta boolean) returns public.tavolo_muri
language plpgsql security definer set search_path = public as $$
declare riga tavolo_muri;
begin
  if not tavolo_e_membro() then raise exception 'Non fai parte del tavolo'; end if;
  update tavolo_muri set aperta = p_aperta
   where id = p_id and porta and (tavolo_e_dm() or (scena = tavolo_scena_attiva() and not bloccata))
  returning * into riga;
  if not found then raise exception 'La porta è chiusa a chiave'; end if;
  return riga;
end $$;

-- i giocatori muovono i propri token, ma non ne cambiano nient'altro (ora anche fin dove vedono)
create or replace function public.tavolo_token_guardia() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tavolo_e_dm() then new.aggiornato := now(); return new; end if;
  if (new.id, new.scena, new.nome, new.immagine, new.colore, new.misura, new.giocatore, new.scheda, new.nascosto, new.pf, new.pf_max, new.vista)
     is distinct from (old.id, old.scena, old.nome, old.immagine, old.colore, old.misura, old.giocatore, old.scheda, old.nascosto, old.pf, old.pf_max, old.vista) then
    raise exception 'Puoi solo spostare il tuo token';
  end if;
  new.aggiornato := now();
  return new;
end $$;

-- ---------- permessi ----------
alter table public.tavolo_muri enable row level security;
drop policy if exists "muri: lettura" on public.tavolo_muri;
drop policy if exists "muri: il DM gestisce" on public.tavolo_muri;
create policy "muri: lettura" on public.tavolo_muri for select to authenticated
  using (tavolo_e_dm() or (tavolo_e_membro() and scena = tavolo_scena_attiva()));
create policy "muri: il DM gestisce" on public.tavolo_muri for all to authenticated using (tavolo_e_dm()) with check (tavolo_e_dm());
-- i giocatori aprono le porte solo con tavolo_porta()

revoke all on public.tavolo_muri from anon;
grant select, insert, update, delete on public.tavolo_muri to authenticated;
revoke execute on function public.tavolo_porta(uuid, boolean) from anon, public;
grant execute on function public.tavolo_porta(uuid, boolean) to authenticated;

-- ---------- tempo reale ----------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tavolo_muri') then
    alter publication supabase_realtime add table public.tavolo_muri;
  end if;
end $$;

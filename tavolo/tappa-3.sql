-- Tavolo virtuale di Avalar — tappa 3: schede dei personaggi dal vivo e PNG con la loro scheda.
-- Da incollare nell'SQL Editor di Supabase (New query › incolla › Run) dopo gli script delle tappe 1 e 2.
-- Si può rieseguire senza danni.

-- ---------- schede ----------
-- una scheda di 5e per ogni personaggio dei giocatori (tipo 'pg') e per ogni PNG creato dal DM (tipo 'png').
-- i valori stanno in «dati» (caratteristiche, PF, CA, attacchi, incantesimi…): li legge e scrive il tavolo.
create table if not exists public.tavolo_schede (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('pg', 'png')),
  nome text not null check (length(nome) between 1 and 80),
  giocatore text unique,                      -- solo per i PG: il giocatore che la compila
  entita text,                                -- scheda del sito collegata (pg-livion, png-levi…), per la foto
  immagine text,
  dati jsonb not null default '{}',
  nascosta boolean not null default true,     -- PNG: i giocatori la vedono solo se il DM la mostra
  creata timestamptz not null default now(),
  aggiornata timestamptz not null default now(),
  constraint tavolo_schede_pg check ((tipo = 'pg') = (giocatore is not null))
);

-- punti ferita di ogni token di PNG (tre goblin con la stessa scheda hanno ognuno i suoi)
alter table public.tavolo_token add column if not exists pf int;
alter table public.tavolo_token add column if not exists pf_max int;

-- il giocatore aggiorna la scheda del suo personaggio, il DM tutte: si uniscono solo i campi cambiati,
-- così due persone che scrivono insieme su campi diversi non si cancellano a vicenda
create or replace function public.tavolo_scheda_aggiorna(p_id uuid, p_dati jsonb) returns public.tavolo_schede
language plpgsql security definer set search_path = public as $$
declare riga tavolo_schede;
begin
  if jsonb_typeof(p_dati) <> 'object' then raise exception 'Dati non validi'; end if;
  update tavolo_schede set dati = dati || p_dati, aggiornata = now()
   where id = p_id and (tavolo_e_dm() or (giocatore is not null and giocatore = tavolo_mio_giocatore()))
  returning * into riga;
  if not found then raise exception 'Non puoi modificare questa scheda'; end if;
  if pg_column_size(riga.dati) > 200000 then raise exception 'Scheda troppo lunga'; end if;
  return riga;
end $$;

-- i giocatori muovono i propri token, ma non ne cambiano nient'altro (ora anche i punti ferita)
create or replace function public.tavolo_token_guardia() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tavolo_e_dm() then new.aggiornato := now(); return new; end if;
  if (new.id, new.scena, new.nome, new.immagine, new.colore, new.misura, new.giocatore, new.scheda, new.nascosto, new.pf, new.pf_max)
     is distinct from (old.id, old.scena, old.nome, old.immagine, old.colore, old.misura, old.giocatore, old.scheda, old.nascosto, old.pf, old.pf_max) then
    raise exception 'Puoi solo spostare il tuo token';
  end if;
  new.aggiornato := now();
  return new;
end $$;

-- ---------- permessi ----------
alter table public.tavolo_schede enable row level security;
drop policy if exists "schede: lettura" on public.tavolo_schede;
drop policy if exists "schede: il DM gestisce" on public.tavolo_schede;
create policy "schede: lettura" on public.tavolo_schede for select to authenticated
  using (tavolo_e_dm() or (tavolo_e_membro() and (giocatore = tavolo_mio_giocatore() or (tipo = 'png' and not nascosta))));
create policy "schede: il DM gestisce" on public.tavolo_schede for all to authenticated using (tavolo_e_dm()) with check (tavolo_e_dm());
-- i giocatori scrivono solo con tavolo_scheda_aggiorna()

revoke all on public.tavolo_schede from anon;
grant select, insert, update, delete on public.tavolo_schede to authenticated;
revoke execute on function public.tavolo_scheda_aggiorna(uuid, jsonb) from anon, public;
grant execute on function public.tavolo_scheda_aggiorna(uuid, jsonb) to authenticated;

-- ---------- tempo reale ----------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tavolo_schede') then
    alter publication supabase_realtime add table public.tavolo_schede;
  end if;
end $$;

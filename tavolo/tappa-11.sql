-- Tavolo virtuale di Avalar — tappa 11: segnalini sulla mappa (bauli, porte, trappole, punti d'interesse…).
-- Il DM li mette, li sposta e li toglie. Quelli nascosti li vede solo il DM, finché non li rivela.
-- Da incollare nell'SQL Editor di Supabase (New query › incolla › Run) dopo gli script delle tappe 1–10.
-- Si può rieseguire senza danni.

create table if not exists public.tavolo_segnalini (
  id uuid primary key default gen_random_uuid(),
  scena uuid not null references public.tavolo_scene on delete cascade,
  tipo text not null default 'punto' check (length(tipo) between 1 and 30),
  x real not null,
  y real not null,
  nome text not null default '' check (length(nome) <= 120),
  nascosto boolean not null default true,      -- nuovi segnalini nascosti: il DM li rivela quando i giocatori li trovano
  creato timestamptz not null default now()
);
create index if not exists tavolo_segnalini_scena on public.tavolo_segnalini (scena);

-- ---------- permessi ----------
-- i giocatori vedono solo quelli rivelati della scena in cui si trovano: una trappola nascosta non arriva nemmeno al loro browser
alter table public.tavolo_segnalini enable row level security;
drop policy if exists "segnalini: lettura" on public.tavolo_segnalini;
drop policy if exists "segnalini: il DM gestisce" on public.tavolo_segnalini;
create policy "segnalini: lettura" on public.tavolo_segnalini for select to authenticated
  using (tavolo_e_dm() or (tavolo_e_membro() and scena = tavolo_scena_attiva() and not nascosto));
create policy "segnalini: il DM gestisce" on public.tavolo_segnalini for all to authenticated using (tavolo_e_dm()) with check (tavolo_e_dm());

revoke all on public.tavolo_segnalini from anon;
grant select, insert, update, delete on public.tavolo_segnalini to authenticated;

-- ---------- tempo reale ----------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tavolo_segnalini') then
    alter publication supabase_realtime add table public.tavolo_segnalini;
  end if;
end $$;

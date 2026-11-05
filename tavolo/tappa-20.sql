-- Tavolo virtuale di Avalar — tappa 20: oggetti e dispense consegnati durante la partita (il «Bottino pronto» del DM).
-- Da incollare nell'SQL Editor di Supabase (New query › incolla › Run) dopo gli script delle tappe 1–19.
-- Si può rieseguire senza danni.
--
-- Il DM prepara oggetti, lettere, documenti e mappe nel sito (dati del DM, meta «bottino:<id>») e al Tavolo li consegna:
-- qui arriva solo ciò che vede il giocatore (mai «La verità (solo DM)»).
-- a       = i giocatori che lo ricevono (id del sito: sam, violet…)
-- pubblica = lo vedono tutti al tavolo: consegnato davanti al gruppo, o mostrato dopo da chi l'ha ricevuto

create table if not exists public.tavolo_consegne (
  id uuid primary key default gen_random_uuid(),
  bottino text,                                         -- la voce del bottino del DM da cui viene
  tipo text not null default 'oggetto' check (tipo in ('oggetto', 'lettera', 'documento', 'mappa')),
  nome text not null check (length(nome) between 1 and 120),
  contenuto jsonb not null default '{}',
  a text[] not null default '{}',
  pubblica boolean not null default false,
  mostrata_da text,                                     -- chi l'ha mostrata al gruppo dopo averla ricevuta
  creata timestamptz not null default now()
);
create index if not exists tavolo_consegne_creata on public.tavolo_consegne (creata);

-- ---------- permessi ----------
-- una consegna di nascosto arriva solo al browser di chi la riceve (e del DM)
alter table public.tavolo_consegne enable row level security;
drop policy if exists "consegne: lettura" on public.tavolo_consegne;
drop policy if exists "consegne: il DM gestisce" on public.tavolo_consegne;
create policy "consegne: lettura" on public.tavolo_consegne for select to authenticated
  using (tavolo_e_dm() or (tavolo_e_membro() and (pubblica or tavolo_mio_giocatore() = any (a))));
create policy "consegne: il DM gestisce" on public.tavolo_consegne for all to authenticated using (tavolo_e_dm()) with check (tavolo_e_dm());

revoke all on public.tavolo_consegne from anon;
grant select, insert, update, delete on public.tavolo_consegne to authenticated;

-- chi l'ha ricevuta può mostrarla al gruppo, come al tavolo vero
create or replace function public.tavolo_consegna_mostra(p_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare io text := tavolo_mio_giocatore();
begin
  if io is null then return false; end if;
  update tavolo_consegne set pubblica = true, mostrata_da = io where id = p_id and io = any (a) and not pubblica;
  return found;
end $$;
revoke all on function public.tavolo_consegna_mostra(uuid) from public, anon;
grant execute on function public.tavolo_consegna_mostra(uuid) to authenticated;

-- ---------- tempo reale ----------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tavolo_consegne') then
    alter publication supabase_realtime add table public.tavolo_consegne;
  end if;
end $$;

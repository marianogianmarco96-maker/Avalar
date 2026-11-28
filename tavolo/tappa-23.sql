-- Tavolo virtuale di Avalar — tappa 23: la chiave di Gemini per l'assistente del sito.
-- Da incollare nell'SQL Editor di Supabase (New query › incolla › Run) dopo gli script delle tappe 1–22.
-- Si può rieseguire senza danni.
--
-- tavolo_ai: una riga sola con la chiave di Google AI Studio e il modello ('auto' = il Gemini Pro più recente).
-- Il browser non la può leggere (nessuna policy): la legge solo la funzione assistente-gemini con la chiave di servizio.
-- Il DM la salva dal sito con tavolo_ai_salva() e vede solo se c'è e le ultime 4 lettere con tavolo_ai_stato().
-- Non finisce nel backup del Tavolo.

create table if not exists public.tavolo_ai (
  id int primary key default 1 check (id = 1),
  chiave text not null default '' check (length(chiave) <= 2000),
  modello text not null default 'auto' check (length(modello) <= 80),
  aggiornata timestamptz not null default now()
);
alter table public.tavolo_ai enable row level security;
revoke all on public.tavolo_ai from anon, authenticated;

create or replace function public.tavolo_ai_salva(p_chiave text, p_modello text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not tavolo_e_dm() then raise exception 'Solo il DM può collegare l''assistente'; end if;
  insert into tavolo_ai (id, chiave, modello, aggiornata)
  values (1, coalesce(trim(p_chiave), ''), coalesce(nullif(trim(p_modello), ''), 'auto'), now())
  on conflict (id) do update set
    chiave = case when p_chiave is null then tavolo_ai.chiave else trim(p_chiave) end,
    modello = coalesce(nullif(trim(p_modello), ''), tavolo_ai.modello),
    aggiornata = now();
end $$;

create or replace function public.tavolo_ai_stato() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when not tavolo_e_dm() then null else coalesce(
    (select jsonb_build_object('chiave', chiave <> '', 'coda', right(chiave, 4), 'modello', modello, 'aggiornata', aggiornata) from tavolo_ai where id = 1),
    jsonb_build_object('chiave', false, 'modello', 'auto')) end
$$;

revoke all on function public.tavolo_ai_salva(text, text) from public, anon;
revoke all on function public.tavolo_ai_stato() from public, anon;
grant execute on function public.tavolo_ai_salva(text, text) to authenticated;
grant execute on function public.tavolo_ai_stato() to authenticated;

-- le chiavi nuove di AI Studio («AQ.…») possono essere più lunghe
alter table public.tavolo_ai drop constraint if exists tavolo_ai_chiave_check;
alter table public.tavolo_ai add constraint tavolo_ai_chiave_check check (length(chiave) <= 2000);

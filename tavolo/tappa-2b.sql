-- Tavolo virtuale di Avalar — ritocchi alla tappa 2: colore e opacità della griglia, ognuno cancella i propri messaggi.
-- Da incollare nell'SQL Editor di Supabase (New query › incolla › Run) dopo tappa-2.sql.
-- Si può rieseguire senza danni.

-- ---------- griglia ----------
alter table public.tavolo_scene add column if not exists griglia_colore text not null default '#000000';
alter table public.tavolo_scene add column if not exists griglia_opacita smallint not null default 38;
alter table public.tavolo_scene drop constraint if exists tavolo_scene_griglia_opacita;
alter table public.tavolo_scene add constraint tavolo_scene_griglia_opacita check (griglia_opacita between 0 and 100);

-- ---------- chat: oltre al DM, ognuno può cancellare i propri messaggi e tiri ----------
drop policy if exists "tiri: l'autore cancella" on public.tavolo_tiri;
create policy "tiri: l'autore cancella" on public.tavolo_tiri for delete to authenticated using (autore = auth.uid());
drop policy if exists "chat: l'autore cancella" on public.tavolo_chat;
create policy "chat: l'autore cancella" on public.tavolo_chat for delete to authenticated using (autore = auth.uid());
grant delete on public.tavolo_tiri, public.tavolo_chat to authenticated;

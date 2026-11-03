-- Tavolo virtuale di Avalar — tappa 19: lo stile della nebbia automatica, scelto per ogni mappa.
-- Da incollare nell'SQL Editor di Supabase (New query › incolla › Run). Si può rieseguire senza danni.
-- nebbia: 'notte' (nebbia notturna, blu scuro) o 'bruma' (bruma grigia); vuoto = nebbia notturna.
alter table public.tavolo_scene add column if not exists nebbia text;
alter table public.tavolo_scene drop constraint if exists tavolo_scene_nebbia_check;
alter table public.tavolo_scene add constraint tavolo_scene_nebbia_check check (nebbia is null or nebbia in ('notte', 'bruma'));

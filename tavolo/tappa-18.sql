-- Tavolo virtuale di Avalar — tappa 18: i muri di copertura.
-- Da incollare nell'SQL Editor di Supabase (New query › incolla › Run) dopo la tappa 16. Si può rieseguire senza danni.
--
-- tipo null    = muro di stanza: ferma vista e passo, fa la nebbia (la stanza chiusa resta buia)
-- tipo 'pieno' = muro di copertura: ferma passo e attacchi (copertura totale) ma non fa nebbia né ombra
-- tipo 'meta'  = copertura ½ (muretti, tavoli, botti) · tipo 'tre' = copertura ¾ (feritoie, banconi alti)
alter table public.tavolo_muri drop constraint if exists tavolo_muri_tipo_check;
alter table public.tavolo_muri add constraint tavolo_muri_tipo_check check (tipo is null or tipo in ('pieno', 'meta', 'tre'));

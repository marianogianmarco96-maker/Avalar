-- Tavolo virtuale di Avalar — tappa 8: terreno difficile ed effetti sulla mappa.
-- Il DM dipinge le caselle di terreno difficile (chi le attraversa spende il doppio del movimento) e piazza
-- effetti animati (fuoco, gas, veleno…) con grandezza e durata in round. Stanno nella mappa: li vedono tutti.
-- Da incollare nell'SQL Editor di Supabase (New query › incolla › Run) dopo gli script delle tappe 1–7.
-- Si può rieseguire senza danni.

alter table public.tavolo_scene add column if not exists difficile jsonb not null default '[]';  -- caselle «colonna,riga»
alter table public.tavolo_scene add column if not exists effetti jsonb not null default '[]';    -- {id, tipo, x, y, m, forma, durata, inizio, int}

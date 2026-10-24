-- Tavolo virtuale di Avalar — ritocchi alla tappa 3: le condizioni si vedono sui token.
-- Da incollare nell'SQL Editor di Supabase (New query › incolla › Run) dopo tappa-3.sql.
-- Si può rieseguire senza danni.

-- condizioni del token (Affascinato, Prono…): le vedono tutti quelli che vedono il token, con un effetto sulla mappa.
-- il giocatore le può cambiare sul proprio token (la guardia dei token blocca solo gli altri campi).
alter table public.tavolo_token add column if not exists condizioni jsonb not null default '[]';

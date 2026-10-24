-- Tavolo virtuale di Avalar — la foto del personaggio di ogni giocatore accanto ai suoi messaggi in chat.
-- Da incollare nell'SQL Editor di Supabase (New query › incolla › Run). Si può rieseguire senza danni.
-- La foto la salva il DM aprendo il tavolo, prendendola dalla scheda del personaggio nel sito.
alter table public.tavolo_membri add column if not exists immagine text;

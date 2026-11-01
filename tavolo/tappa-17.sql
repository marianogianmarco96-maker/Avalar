-- Tavolo, tappa 17: il DM riordina le mappe trascinandole nel pannello delle mappe.
-- Da eseguire una volta nell'SQL Editor di Supabase (si può rieseguire).

alter table public.tavolo_scene add column if not exists ordine double precision;
-- le mappe che ci sono già restano nell'ordine di creazione
update public.tavolo_scene set ordine = extract(epoch from creata) where ordine is null;
-- quelle nuove vanno in fondo
alter table public.tavolo_scene alter column ordine set default extract(epoch from now());

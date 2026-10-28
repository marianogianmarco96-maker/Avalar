-- Tavolo virtuale di Avalar — tappa 10: tratti con effetti in combattimento.
-- Un tratto «Quando colpisce, il bersaglio fa un tiro salvezza» (morso che fa cadere prono, veleno…) chiede da solo
-- il tiro salvezza al bersaglio quando l'attacco va a segno, come fanno già gli incantesimi.
-- Da incollare nell'SQL Editor di Supabase (New query › incolla › Run) dopo gli script delle tappe 1–9.
-- Si può rieseguire senza danni.

create or replace function public.tavolo_ts_tratto(p_token uuid, p_bersaglio uuid, p_car text, p_cd int, p_motivo text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare a tavolo_token; b tavolo_token;
begin
  if not tavolo_e_membro() then raise exception 'Non fai parte del tavolo'; end if;
  select * into a from tavolo_token where id = p_token;
  select * into b from tavolo_token where id = p_bersaglio;
  if a.id is null or b.id is null then raise exception 'Token non trovato'; end if;
  -- lo chiede chi muove l'attaccante: il DM, o il giocatore del suo token
  if not tavolo_e_dm() and (a.giocatore is null or a.giocatore <> tavolo_mio_giocatore()) then raise exception 'Non è il tuo token'; end if;
  if p_car not in ('for', 'des', 'cos', 'int', 'sag', 'car') then raise exception 'Caratteristica non valida'; end if;
  if p_cd is null or p_cd < 1 or p_cd > 40 then raise exception 'CD non valida'; end if;
  return tavolo_chiedi_ts(b, p_car, p_cd, 0, false, left(coalesce(p_motivo, ''), 80), false);
end $$;

revoke execute on function public.tavolo_ts_tratto(uuid, uuid, text, int, text) from anon, public;
grant execute on function public.tavolo_ts_tratto(uuid, uuid, text, int, text) to authenticated;

-- Tavolo virtuale di Avalar — tappa 15: attacchi non letali. Chi porta un nemico a 0 punti ferita con un attacco in mischia
-- può decidere di lasciarlo svenuto invece che morto (Manuale del giocatore, «Mettere fuori combattimento»).
-- Da incollare nell'SQL Editor di Supabase (New query › incolla › Run) dopo le tappe precedenti. Si può rieseguire senza danni.

create or replace function public.tavolo_non_letale(p_token uuid, p_bersaglio uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a tavolo_token; b tavolo_token; cond jsonb;
begin
  if not tavolo_e_membro() then raise exception 'Non fai parte del tavolo'; end if;
  select * into a from tavolo_token where id = p_token;
  select * into b from tavolo_token where id = p_bersaglio;
  if a.id is null or b.id is null or a.scena <> b.scena then raise exception 'Token non trovato'; end if;
  if not tavolo_e_dm() and (a.giocatore is null or a.giocatore <> tavolo_mio_giocatore()) then raise exception 'Puoi farlo solo con il tuo token'; end if;
  if coalesce(b.pf, 1) <> 0 then raise exception 'Il bersaglio non è a 0 punti ferita'; end if;
  select coalesce(jsonb_agg(c), '[]'::jsonb) into cond from jsonb_array_elements(coalesce(b.condizioni, '[]'::jsonb)) c where c not in ('"Morto"'::jsonb, '"Svenuto"'::jsonb);
  cond := cond || '["Svenuto"]'::jsonb;
  perform set_config('tavolo.attacco', '1', true);
  update tavolo_token set condizioni = cond where id = b.id;
  perform set_config('tavolo.attacco', '0', true);
  return jsonb_build_object('id', b.id, 'condizioni', cond);
end $$;
revoke execute on function public.tavolo_non_letale(uuid, uuid) from anon, public;
grant execute on function public.tavolo_non_letale(uuid, uuid) to authenticated;

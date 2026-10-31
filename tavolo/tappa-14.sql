-- Tavolo virtuale di Avalar — tappa 14: curare un'altra creatura con un privilegio (Imposizione delle mani…).
-- Chi usa il privilegio sceglie il bersaglio sulla mappa: i PF li aggiunge Supabase, così vale anche sul token di un altro giocatore.
-- Da incollare nell'SQL Editor di Supabase (New query › incolla › Run) dopo le tappe precedenti. Si può rieseguire senza danni.

create or replace function public.tavolo_cura(p_token uuid, p_bersaglio uuid, p_pf int, p_motivo text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a tavolo_token; b tavolo_token; sb tavolo_schede; npf int; mx int; cond jsonb;
begin
  if not tavolo_e_membro() then raise exception 'Non fai parte del tavolo'; end if;
  if p_pf is null or p_pf < 1 or p_pf > 500 then raise exception 'Punti ferita non validi'; end if;
  select * into a from tavolo_token where id = p_token;
  select * into b from tavolo_token where id = p_bersaglio;
  if a.id is null or b.id is null or a.scena <> b.scena then raise exception 'Token non trovato'; end if;
  if not tavolo_e_dm() and (a.giocatore is null or a.giocatore <> tavolo_mio_giocatore()) then raise exception 'Puoi curare solo con il tuo token'; end if;
  if not tavolo_e_dm() and (b.scena <> tavolo_scena_attiva() or b.nascosto) then raise exception 'Bersaglio non valido'; end if;
  sb := tavolo_scheda_di(b);
  perform set_config('tavolo.attacco', '1', true);
  if b.pf_max is not null or (sb.tipo = 'png' and (sb.dati ->> 'pf_max') ~ '^\d+$') then
    mx := coalesce(b.pf_max, (sb.dati ->> 'pf_max')::int);
    npf := least(coalesce(b.pf, mx) + p_pf, mx);
    cond := coalesce(b.condizioni, '[]'::jsonb);
    if npf > 0 and cond ? 'Morto' then cond := cond - 'Morto'; end if;
    update tavolo_token set pf = npf, pf_max = mx, condizioni = cond where id = b.id;
  elsif sb.id is not null and (sb.dati ->> 'pf_max') ~ '^\d+$' then
    mx := (sb.dati ->> 'pf_max')::int;
    npf := least(coalesce(nullif(sb.dati ->> 'pf', '')::numeric::int, mx) + p_pf, mx);
    -- tornando sopra 0 PF si azzerano i tiri contro la morte
    update tavolo_schede set dati = dati || jsonb_build_object('pf', npf, 'morte_ok', 0, 'morte_ko', 0), aggiornata = now() where id = sb.id;
  else
    npf := null;
  end if;
  perform set_config('tavolo.attacco', '0', true);
  return jsonb_build_object('token', b.id, 'pf', npf, 'max', mx);
end $$;
revoke execute on function public.tavolo_cura(uuid, uuid, int, text) from anon, public;
grant execute on function public.tavolo_cura(uuid, uuid, int, text) to authenticated;

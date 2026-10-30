-- Tavolo virtuale di Avalar — tappa 13: un PNG mosso da un giocatore (Edward affidato a Livion) usa la scheda del PNG,
-- non quella del personaggio del giocatore, anche negli attacchi e nei tiri salvezza calcolati da Supabase.
-- Da incollare nell'SQL Editor di Supabase (New query › incolla › Run) dopo le tappe precedenti. Si può rieseguire senza danni.

create or replace function public.tavolo_scheda_di(t public.tavolo_token) returns public.tavolo_schede
language plpgsql stable security definer set search_path = public as $$
declare s tavolo_schede;
begin
  if t.scheda like 'tv:%' then
    select * into s from tavolo_schede where id::text = substr(t.scheda, 4);
    if found then return s; end if;
  end if;
  -- il token di un PNG che muove un giocatore: prima la scheda del PNG
  if t.giocatore is not null and t.scheda is not null then
    select * into s from tavolo_schede where tipo = 'png' and entita = t.scheda order by creata limit 1;
    if found then return s; end if;
  end if;
  if t.giocatore is not null then
    select * into s from tavolo_schede where giocatore = t.giocatore;
    if found then return s; end if;
  end if;
  if t.scheda is not null then
    select * into s from tavolo_schede where entita = t.scheda order by creata limit 1;
  end if;
  return s;
end $$;
revoke execute on function public.tavolo_scheda_di(public.tavolo_token) from anon, public;

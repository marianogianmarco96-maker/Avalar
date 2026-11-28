-- Tappa 24: azione ritardata nell'ordine del turno.
-- Chi sta agendo può «ritardare»: sceglie dopo chi agire in questo round. L'ordine prosegue saltandolo; finito il turno
-- di quello scelto, tocca a lui; poi si riprende da dove si era. Al round successivo ognuno torna al suo posto
-- (il valore di iniziativa non cambia mai). Si può rieseguire: crea solo ciò che manca e riscrive le funzioni.

alter table public.tavolo_turno add column if not exists ritardo uuid references public.tavolo_turno on delete set null;

-- i giocatori cambiano solo il valore delle proprie voci (anche «ritardo» passa solo dalle funzioni qui sotto)
create or replace function public.tavolo_turno_guardia() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tavolo_e_dm() or coalesce(current_setting('tavolo.turno', true), '') = '1' then return new; end if;
  if tg_op = 'INSERT' then
    new.nascosto := false; new.ritardo := null; return new;
  end if;
  if (new.id, new.nome, new.token, new.immagine, new.colore, new.giocatore, new.nascosto, new.ritardo)
     is distinct from (old.id, old.nome, old.token, old.immagine, old.colore, old.giocatore, old.nascosto, old.ritardo) then
    raise exception 'Puoi cambiare solo il tuo valore di iniziativa';
  end if;
  return new;
end $$;

-- da «p_base» (chi ha appena agito, o il posto da cui riprendere) trova il prossimo e lo scrive in tavolo_stato:
-- prima chi aspettava proprio «p_base», poi il prossimo nell'ordine che non sta aspettando, saltando chi è a 0 PF
create or replace function public.tavolo_turno_calcola(p_base uuid, p_round int) returns uuid
language plpgsql security definer set search_path = public as $$
declare base uuid := p_base; prossimo uuid; r int := p_round; n int; giri int := 0; rit uuid;
begin
  perform set_config('tavolo.turno', '1', true);
  select count(*) into n from tavolo_turno;
  loop
    prossimo := null;
    if base is not null then
      select id into prossimo from tavolo_turno where ritardo = base order by valore desc, creato limit 1;
    end if;
    if prossimo is null then
      if base is null or not exists (select 1 from tavolo_turno where id = base) then
        select id into prossimo from tavolo_turno where ritardo is null order by valore desc, creato limit 1;
      else
        select t.id into prossimo from tavolo_turno t, tavolo_turno c
         where c.id = base and t.ritardo is null and (t.valore < c.valore or (t.valore = c.valore and t.creato > c.creato))
         order by t.valore desc, t.creato limit 1;
        if prossimo is null then
          -- fine del round: chi aspettava ancora torna al suo posto
          update tavolo_turno set ritardo = null where ritardo is not null;
          select id into prossimo from tavolo_turno order by valore desc, creato limit 1;
          r := r + 1;
        end if;
      end if;
    end if;
    giri := giri + 1;
    exit when prossimo is null or giri > n + 1 or not tavolo_turno_fuori(prossimo);
    -- saltato (a 0 PF): se aspettava qualcuno smette di aspettare e si riprende dallo stesso posto
    select ritardo into rit from tavolo_turno where id = prossimo;
    if rit is not null then update tavolo_turno set ritardo = null where id = prossimo; else base := prossimo; end if;
  end loop;
  perform set_config('tavolo.turno', '0', true);
  update tavolo_stato set turno = prossimo, round = r where id = 1;
  return prossimo;
end $$;

-- passa al prossimo: lo può fare il DM o chi sta agendo
create or replace function public.tavolo_turno_avanti() returns uuid
language plpgsql security definer set search_path = public as $$
declare cur uuid; r int; rit uuid; mio text := tavolo_mio_giocatore();
begin
  select turno, round into cur, r from tavolo_stato where id = 1;
  if not tavolo_e_dm() and not exists (select 1 from tavolo_turno where id = cur and giocatore = mio) then
    raise exception 'Non è il tuo turno';
  end if;
  -- chi aveva ritardato ha appena agito: si riprende da chi aspettava
  select ritardo into rit from tavolo_turno where id = cur;
  if rit is not null then
    perform set_config('tavolo.turno', '1', true);
    update tavolo_turno set ritardo = null where id = cur;
    return tavolo_turno_calcola(rit, r);
  end if;
  return tavolo_turno_calcola(cur, r);
end $$;

-- chi sta agendo aspetta e agirà subito dopo «p_dopo» (che deve ancora agire in questo round)
create or replace function public.tavolo_turno_ritarda(p_dopo uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare cur uuid; r int; c tavolo_turno; d tavolo_turno; mio text := tavolo_mio_giocatore();
begin
  select turno, round into cur, r from tavolo_stato where id = 1;
  if not tavolo_e_dm() and not exists (select 1 from tavolo_turno where id = cur and giocatore = mio) then
    raise exception 'Non è il tuo turno';
  end if;
  select * into c from tavolo_turno where id = cur;
  select * into d from tavolo_turno where id = p_dopo;
  if c.id is null or d.id is null or d.id = c.id then raise exception 'Scegli chi deve ancora agire in questo round'; end if;
  if c.ritardo is not null then raise exception 'Hai già ritardato in questo round'; end if;
  if d.ritardo is not null or not (d.valore < c.valore or (d.valore = c.valore and d.creato > c.creato)) then
    raise exception 'Puoi ritardare solo dopo chi deve ancora agire in questo round';
  end if;
  perform set_config('tavolo.turno', '1', true);
  update tavolo_turno set ritardo = p_dopo where id = cur;
  return tavolo_turno_calcola(cur, r);
end $$;

revoke execute on function public.tavolo_turno_calcola(uuid, int) from anon, public, authenticated;
revoke execute on function public.tavolo_turno_avanti() from anon, public;
grant execute on function public.tavolo_turno_avanti() to authenticated;
revoke execute on function public.tavolo_turno_ritarda(uuid) from anon, public;
grant execute on function public.tavolo_turno_ritarda(uuid) to authenticated;

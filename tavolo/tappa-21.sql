-- Tavolo virtuale di Avalar — tappa 21: protezione e backup.
-- Da incollare nell'SQL Editor di Supabase (New query › incolla › Run) dopo gli script delle tappe 1–20.
-- Si può rieseguire senza danni.
--
-- 1. Chi non ha fatto l'accesso non può più chiedere a Supabase quale scena e quale mappa sono in uso:
--    queste due funzioni servono solo alle regole di lettura dei membri del tavolo.
-- 2. tavolo_ripristina: il DM rimette il tavolo com'era in un backup scaricato dal sito (Backup › Backup del Tavolo).

revoke all on function public.tavolo_scena_attiva(), public.tavolo_mappa_attiva() from public, anon;
grant execute on function public.tavolo_scena_attiva(), public.tavolo_mappa_attiva() to authenticated;

-- p_dati = il campo «tabelle» del file di backup: { "tavolo_scene": [righe…], "tavolo_token": [righe…], … }.
-- Ogni tabella presente nel backup viene svuotata e riempita con le sue righe; quelle assenti restano come sono.
-- Non tocca mai gli account (tavolo_membri) né la chiave di Claude (tavolo_bot). Tiri e messaggi di account che
-- non esistono più vengono saltati. Tutto o niente: se una riga non va, il tavolo resta com'era.
create or replace function public.tavolo_ripristina(p_dati jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  -- nell'ordine in cui vanno rimesse (prima le scene, poi ciò che dipende da loro); si svuotano al contrario
  ordine constant text[] := array['tavolo_scene', 'tavolo_stato', 'tavolo_token', 'tavolo_tiri', 'tavolo_chat',
    'tavolo_maschera', 'tavolo_muri', 'tavolo_segnalini', 'tavolo_turno', 'tavolo_schede', 'tavolo_pf_gruppo',
    'tavolo_critici', 'tavolo_salvezze', 'tavolo_coperture_richieste', 'tavolo_consegne'];
  t text; c text; n int; fatto jsonb := '{}';
  presenti text[] := '{}';
begin
  if not tavolo_e_dm() then raise exception 'Solo il DM può ripristinare il tavolo'; end if;
  if jsonb_typeof(p_dati) is distinct from 'object' then raise exception 'Backup non valido'; end if;
  foreach t in array ordine loop
    if p_dati ? t and to_regclass('public.' || t) is not null then
      if jsonb_typeof(p_dati -> t) <> 'array' then raise exception 'Backup non valido (%)', t; end if;
      presenti := presenti || t;
    end if;
  end loop;
  if cardinality(presenti) = 0 then raise exception 'Il backup non contiene tabelle del tavolo'; end if;

  -- le guardie (turno, token, copia dei PF) servono durante il gioco, non mentre si rimette un backup
  foreach t in array presenti loop execute format('alter table public.%I disable trigger user', t); end loop;
  for i in reverse cardinality(presenti) .. 1 loop execute format('delete from public.%I', presenti[i]); end loop;

  foreach t in array presenti loop
    execute format('insert into public.%1$I overriding system value select * from jsonb_populate_recordset(null::public.%1$I, $1) r %2$s',
      t, case t
        when 'tavolo_tiri' then 'where r.autore in (select id from auth.users)'
        when 'tavolo_chat' then 'where r.autore in (select id from auth.users)'
        when 'tavolo_critici' then 'where r.tiro in (select id from public.tavolo_tiri)'
        else '' end)
      using p_dati -> t;
    get diagnostics n = row_count;
    fatto := fatto || jsonb_build_object(t, n);
    -- i contatori dei numeri automatici ripartono dopo l'ultima riga rimessa
    for c in select column_name from information_schema.columns
             where table_schema = 'public' and table_name = t and is_identity = 'YES' loop
      execute format('select setval(pg_get_serial_sequence(%L, %L), coalesce((select max(%I) from public.%I), 0) + 1, false)',
        'public.' || t, c, c, t);
    end loop;
  end loop;
  foreach t in array presenti loop execute format('alter table public.%I enable trigger user', t); end loop;
  return fatto;
end $$;

revoke all on function public.tavolo_ripristina(jsonb) from public, anon;
grant execute on function public.tavolo_ripristina(jsonb) to authenticated;

-- Tavolo virtuale di Avalar — tappa 22: il diario dei giocatori e le creature sconosciute.
-- Da incollare nell'SQL Editor di Supabase (New query › incolla › Run) dopo gli script delle tappe 1–21.
-- Si può rieseguire senza danni.
--
-- 1. tavolo_diario: le pagine di diario di ogni giocatore (pagina Diario del sito). Chi la scrive sceglie chi la legge:
--    vis = 'io'     solo chi l'ha scritta (nemmeno il DM)
--          'dm'     chi l'ha scritta e il DM
--          'gruppo' tutto il gruppo, DM compreso
--    Solo chi l'ha scritta può cambiarla o cancellarla.
-- 2. tavolo_token.ignoto: la «creatura sconosciuta». Se c'è, i giocatori vedono «???» al posto di nome e immagine e
--    solo quello che il DM svela: { descr, nome, salute, ca, note: [ … ] }.
-- 3. tavolo_ripristina (tappa 21) rimette anche il diario.

-- ---------- 1. diario ----------
create table if not exists public.tavolo_diario (
  id uuid primary key default gen_random_uuid(),
  autore text not null default tavolo_mio_giocatore(),   -- id del giocatore (sam, violet…)
  titolo text not null default '' check (length(titolo) <= 120),
  testo text not null default '' check (length(testo) <= 20000),
  sessione int,                                          -- la sessione di gioco a cui si riferisce
  giorno text check (giorno is null or length(giorno) <= 40),  -- il giorno in gioco («Giorno 14»)
  vis text not null default 'io' check (vis in ('io', 'dm', 'gruppo')),
  domande jsonb not null default '[]',                   -- [{ "t": "Chi è Gorgo?", "fatta": false }]
  creata timestamptz not null default now(),
  aggiornata timestamptz not null default now()
);
create index if not exists tavolo_diario_autore on public.tavolo_diario (autore, aggiornata desc);

alter table public.tavolo_diario enable row level security;
drop policy if exists "diario: lettura" on public.tavolo_diario;
drop policy if exists "diario: chi scrive" on public.tavolo_diario;
create policy "diario: lettura" on public.tavolo_diario for select to authenticated
  using (autore = tavolo_mio_giocatore() or (vis = 'gruppo' and tavolo_e_membro()) or (vis = 'dm' and tavolo_e_dm()));
create policy "diario: chi scrive" on public.tavolo_diario for all to authenticated
  using (autore = tavolo_mio_giocatore()) with check (autore = tavolo_mio_giocatore());

revoke all on public.tavolo_diario from anon;
grant select, insert, update, delete on public.tavolo_diario to authenticated;

-- ---------- 2. creatura sconosciuta ----------
alter table public.tavolo_token add column if not exists ignoto jsonb;

-- ---------- 3. backup ----------
create or replace function public.tavolo_ripristina(p_dati jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  -- nell'ordine in cui vanno rimesse (prima le scene, poi ciò che dipende da loro); si svuotano al contrario
  ordine constant text[] := array['tavolo_scene', 'tavolo_stato', 'tavolo_token', 'tavolo_tiri', 'tavolo_chat',
    'tavolo_maschera', 'tavolo_muri', 'tavolo_segnalini', 'tavolo_turno', 'tavolo_schede', 'tavolo_pf_gruppo',
    'tavolo_critici', 'tavolo_salvezze', 'tavolo_coperture_richieste', 'tavolo_consegne', 'tavolo_diario'];
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

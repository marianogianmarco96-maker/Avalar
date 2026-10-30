-- Tavolo virtuale di Avalar — tappa 12: una scheda si può affidare a un giocatore (per esempio Edward Storm).
-- Il giocatore scelto la vede, la compila e muove i suoi token, oltre al proprio personaggio.
-- Carica anche la scheda di Edward se nel Tavolo non c'è ancora (o è vuota): se esiste già, non la tocca.
-- Da incollare nell'SQL Editor di Supabase (New query › incolla › Run) dopo le tappe precedenti. Si può rieseguire senza danni.

-- ---------- a chi è affidata ----------
alter table public.tavolo_schede add column if not exists assegnata text;

-- il giocatore vede la scheda che gli è affidata, anche se è nascosta agli altri
drop policy if exists "schede: lettura" on public.tavolo_schede;
create policy "schede: lettura" on public.tavolo_schede for select to authenticated
  using (tavolo_e_dm() or (tavolo_e_membro() and (giocatore = tavolo_mio_giocatore() or assegnata = tavolo_mio_giocatore() or (tipo = 'png' and not nascosta))));

-- e la può compilare come la propria
create or replace function public.tavolo_scheda_aggiorna(p_id uuid, p_dati jsonb) returns public.tavolo_schede
language plpgsql security definer set search_path = public as $$
declare riga tavolo_schede;
begin
  if jsonb_typeof(p_dati) <> 'object' then raise exception 'Dati non validi'; end if;
  update tavolo_schede set dati = dati || p_dati, aggiornata = now()
   where id = p_id and (tavolo_e_dm() or (giocatore is not null and giocatore = tavolo_mio_giocatore())
                        or (assegnata is not null and assegnata = tavolo_mio_giocatore()))
  returning * into riga;
  if not found then raise exception 'Non puoi modificare questa scheda'; end if;
  if pg_column_size(riga.dati) > 200000 then raise exception 'Scheda troppo lunga'; end if;
  return riga;
end $$;
revoke execute on function public.tavolo_scheda_aggiorna(uuid, jsonb) from anon, public;
grant execute on function public.tavolo_scheda_aggiorna(uuid, jsonb) to authenticated;

-- ---------- la scheda di Edward Storm (paladino di 9° livello), solo se manca ----------
insert into public.tavolo_schede (tipo, nome, entita, nascosta, dati)
select 'png', 'Edward Storm', 'png-edward', true, '{}'::jsonb
where not exists (select 1 from public.tavolo_schede where tipo = 'png' and entita = 'png-edward');

update public.tavolo_schede
set dati = dati || $j${
  "taglia_tipo": "Umanoide Medio (umano), paladino di 9° livello",
  "allineamento": "Neutrale buono",
  "comp": 4,
  "linguaggi": "Comune, Sottocomune",

  "for": 18, "des": 10, "cos": 14, "int": 10, "sag": 12, "car": 16,

  "ts_for": false, "ts_des": false, "ts_cos": false, "ts_int": false, "ts_sag": true, "ts_car": true,

  "ab_acrobazia": 0, "ab_addestrare": 0, "ab_arcano": 0, "ab_atletica": 1, "ab_furtivita": 0, "ab_indagare": 0,
  "ab_inganno": 0, "ab_intimidire": 1, "ab_intrattenere": 0, "ab_intuizione": 1, "ab_medicina": 0, "ab_natura": 0,
  "ab_percezione": 0, "ab_persuasione": 1, "ab_rapidita": 0, "ab_religione": 1, "ab_sopravvivenza": 0, "ab_storia": 0,

  "ca": 18,
  "velocita": "9 m",
  "pf_max": 90,
  "pf": 64,
  "dadi_vita": "9d10+18",

  "attacchi": [
    { "nome": "Spadone a due mani", "colpire": 8, "danni": "2d6+4", "tipo": "taglienti" },
    { "nome": "Giavellotto", "colpire": 8, "danni": "1d6+4", "tipo": "perforanti, anche da lancio 9/36 m" }
  ],
  "azioni": "Multiattacco: due attacchi quando usa l'azione di Attacco (Attacco extra).\nPunizione divina: dopo aver colpito in mischia spende uno slot: +2d8 danni radiosi con uno slot di 1°, +1d8 per ogni livello in più (massimo 5d8), +1d8 contro non morti e immondi.\nPunizione rovente (azione bonus, concentrazione): il prossimo colpo in mischia fa +1d6 danni da fuoco e incendia il bersaglio (1d6 fuoco a ogni suo turno, TS su Costituzione CD 15 per spegnersi; sulla scheda CD 12).\nPunizione marchiante (azione bonus, concentrazione): il prossimo colpo con un'arma fa +2d6 danni radiosi e il bersaglio, se invisibile, diventa visibile.\nCura ferite: una creatura toccata recupera 1d8+3 PF (1d8 in più per livello dello slot oltre il 1°).\nImposizione delle mani: tocca una creatura e le restituisce PF dalla riserva di 45, oppure con 5 punti la cura da una malattia o un veleno.\nVoto di inimicizia (Incanalare divinità, azione bonus): vantaggio ai tiri per colpire contro una creatura entro 3 m per 1 minuto.\nAbiurare nemico (Incanalare divinità): una creatura entro 18 m fa un TS su Saggezza CD 15 o è spaventata e ha velocità 0 per 1 minuto.\nVendetta spietata (reazione): quando colpisce il bersaglio del suo Voto di inimicizia con un attacco di opportunità, si muove fino a metà della velocità senza provocare attacchi di opportunità.",

  "tratti": "Aura di protezione: lui e gli alleati entro 3 m aggiungono +3 ai tiri salvezza, se è cosciente.\nStile di combattimento, Difesa: +1 alla CA quando indossa un'armatura.\nSalute divina: immune alle malattie.\nPercezione del divino: 4 volte per riposo lungo sente celestiali, immondi e non morti entro 18 m.\nIncanalare divinità: 1 volta per riposo breve o lungo.",

  "competenze": "Armature: tutte e scudi. Armi: semplici e da guerra.\nEquipaggiamento: armatura a piastre, 3 giavellotti, simbolo sacro della Corona, kit da guaritore e bende, 50 MO.",

  "car_inc": "car",
  "slot_1": 4, "usati_1": 1,
  "slot_2": 3, "usati_2": 1,
  "slot_3": 2, "usati_3": 0,
  "inc_1": "Anatema, concentrazione (giuramento)\nMarchio del cacciatore, azione bonus, concentrazione (giuramento)\nCura ferite\nPunizione rovente, azione bonus, concentrazione\nIndividuazione del veleno e delle malattie, concentrazione",
  "inc_2": "Blocca persone, concentrazione (giuramento)\nPasso velato, azione bonus (giuramento)\nPunizione marchiante, azione bonus, concentrazione\nZona di verità\nRiposo inviolato",
  "inc_3": "Protezione dall'energia, concentrazione (giuramento)\nVelocità, concentrazione (giuramento)\nRimuovi maledizione"
}$j$::jsonb,
    aggiornata = now()
where tipo = 'png' and entita = 'png-edward' and (dati->>'ca') is null;

-- controllo: deve uscire una riga con «Edward Storm» e la colonna «assegnata» (vuota finché non la affidi dal Tavolo)
select nome, entita, assegnata, dati->>'ca' as ca, dati->>'pf_max' as pf_max from public.tavolo_schede where entita = 'png-edward';

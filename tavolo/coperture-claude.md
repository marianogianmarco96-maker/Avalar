# Coperture automatiche: istruzioni per Claude

Il DM preme **🤖 Chiedi le coperture a Claude** nella barra Muri: la mappa entra in lista d'attesa
(`tavolo_coperture_richieste`). Claude la analizza quando il DM scrive «analizza le mappe» o al controllo programmato.

Serve `AVALAR_BOT_KEY` nei segreti dell'ambiente (`select chiave from public.tavolo_bot;` dopo `tavolo/tappa-16.sql`).

## Passi
1. `python3 strumenti/coperture.py lista` — scarica le mappe in `coperture/<id>/`: `mappa.png` (già nelle misure della scena),
   `griglia.png` (griglia e coordinate ogni 100 px), `info.json` (griglia, misure, muri già fatti a mano dal DM).
   Se non c'è niente in attesa, fine.
2. Guarda `mappa.png` e `griglia.png` (a quadranti, ingranditi dove serve) e scrivi `coperture/<id>/muri.py` con
   `linea`, `tondo`, `rett`, `ruot` in pixel della mappa:
   - **muro vero** (`None`): pareti, camini, colonne grandi, porte chiuse. Ferma vista, passo e attacchi.
   - **`'meta'` (½, CA +2)**: tavoli, botti, casse, ringhiere, muretti, carri, mobili bassi.
   - **`'tre'` (¾, CA +5)**: feritoie, banconi alti, tronchi spessi, merli.
   - Non tracciare tappeti, sedie, oggetti piccoli, scale (a meno che abbiano una ringhiera). Non ritracciare i muri già fatti dal DM.
3. `python3 strumenti/coperture.py prova <id>` e controlla `controllo.png`: le linee devono stare sui bordi degli oggetti.
   Correggi e riprova finché combaciano.
4. `python3 strumenti/coperture.py salva <id> "breve nota"` — i tratti di un tracciamento precedente di Claude vengono sostituiti,
   quelli del DM restano. Il DM li vede comparire nella mappa e il pulsante dice «Fatta».
5. Rispondi in una riga: quante mappe, quanti tratti, e cosa è dubbio (per esempio «il bancone l'ho messo a ¾»).

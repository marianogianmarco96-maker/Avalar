# Avalar: note per Claude

- Riassunti di sessione e modifiche ai contenuti della campagna non vanno pubblicati direttamente: dopo aver modificato
  dm.json esegui `python3 strumenti/bozza.py prepara CODICE dm.json "Sessione N · Titolo"` e solo dopo
  `python3 strumenti/pubblica.py salva CODICE dm.json`. Il DM controlla la bozza sul sito («Controlla») e la manda
  online con «Salva». `bozza.py mostra dm.json` elenca le modifiche e gli avvisi sulle note da DM rimaste visibili.
- Le parti per il solo DM vanno in `[DM]…[/DM]` (o `dm: true` / «Mostra a:»), mai lasciate come «Nota per DM» nel testo.
- Se modifichi copie.js o il filtro copia() in strumenti/pubblica.py, verifica con `python3 strumenti/prova_copie.py dm.json`.
- Oggetti e dispense da consegnare al Tavolo stanno nel «Bottino pronto» (bottino.js, meta `bottino:<id>`, solo DM).
  La consegna passa da Supabase (tavolo/tappa-20.sql, tabella tavolo_consegne) e non porta mai «La verità».
- Backup: ogni notte .github/workflows/backup-notturno.yml copia l'ultimo salvataggio dal sito (Supabase) sul ramo
  `backup`. Per rimetterlo: `python3 strumenti/ripristina_backup.py elenco` / `usa [COMMIT] [--solo]` / `riattiva`
  («solo» in versione.json = il sito ignora Supabase). Il Tavolo si salva dalla pagina Backup (tavolo/tappa-21.sql).
- Supabase (piano gratuito) va in pausa dopo 7 giorni senza attività: .github/workflows/supabase-sveglio.yml lo legge
  ogni 5 giorni con la chiave pubblica. Se fallisce, Supabase è in pausa o non risponde: va riattivato dal suo pannello.
- Diario dei giocatori (diario.js) e creature sconosciute al Tavolo: tabella tavolo_diario e colonna tavolo_token.ignoto
  (tavolo/tappa-22.sql). Le pagine «solo io» non le legge nemmeno il DM, quindi non finiscono nel backup del Tavolo.
- Immagini di razze, classi e mostri del Compendio: meta «immagini» ({ 'razza:elfo' | 'classe:mago' | 'mostro:<id>':
  { src, autore, licenza, fonte, titolo } }), solo con licenza libera e fonte citata; mai per i PG del party.
  Razza, classe e livello del party: meta «party», aggiornata dalla Home del DM leggendo le schede del Tavolo.
- Questionari: il giocatore li invia come segnalazione cifrata su GitHub («[Giocatore] X ha compilato il questionario»).
  Il DM li legge dal sito (Strumenti › Questionari dei giocatori, e sotto ogni domanda nella scheda del PG): local.js
  scarica le segnalazioni dall'API pubblica di GitHub e le decifra nel browser con le password dei giocatori.
- Scaletta del DM (scaletta.js, meta `scaletta:<n>`): il testo resta Markdown, l'editor del sito lo mostra come in Word.
  Forma usata dall'editor: parti `## Titolo`, scene `### Scena N: Titolo`, titoletti `####`, e nelle scene i campi
  `**Obiettivo:**`, `**Ostacolo:**`, `**Esiti:**`, `**Ricompensa:**` in paragrafi a sé.
  Prove di abilità (pulsante 🎲 dell'editor): in una frase `🎲 Percezione CD 14`; come riquadro un paragrafo
  `🎲 Atletica CD 15 — per cosa` seguito dall'elenco `- ✓ Successo: …` / `- ✗ Fallimento: …`.
- Immagini delle scene del Tavolo (bucket privato «tavolo»): Claude le vede con `python3 strumenti/scene.py elenco` e
  `scarica [testo nel nome] [--giorni N]`, che le salva in scene/ (ignorata da git). Passa dalla funzione Supabase
  `tavolo-bot-immagini` (supabase/functions/, solo lettura, link di un'ora) con la chiave del bot AVALAR_BOT_KEY.
- Ogni scaletta o sessione che Claude prepara per il DM include sempre, senza che lo chieda:
  - per ogni scena un titoletto `#### Il Luogo` subito sotto `### Scena N`, con un testo da leggere ai giocatori
    (*«…»* in corsivo: cosa vedono, sentono, annusano) e 2-3 punti con dettagli da usare al tavolo;
  - nella parte `## 🎭 PNG della Sessione`, per ogni PNG l'aspetto (com'è fatto, come si veste, un tic o un modo di
    parlare) oltre a cosa vuole, e una frase tipica.
- Assistente, Fine sessione e Idee usano Gemini: idee.js chiama la funzione Supabase `assistente-gemini`
  (supabase/functions/, risponde solo al DM e sceglie da sola il Gemini Pro più recente). La chiave di Google AI Studio
  sta in tavolo_ai (tavolo/tappa-23.sql), che il browser non può leggere: il DM la incolla in «Collega l'assistente».
  Con una chiave sk-ant-… salvata nel browser si torna a Claude.

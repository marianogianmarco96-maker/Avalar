# Avalar: note per Claude

- Riassunti di sessione e modifiche ai contenuti della campagna non vanno pubblicati direttamente: dopo aver modificato
  dm.json esegui `python3 strumenti/bozza.py prepara CODICE dm.json "Sessione N · Titolo"` e solo dopo
  `python3 strumenti/pubblica.py salva CODICE dm.json`. Il DM controlla la bozza sul sito («Controlla») e la manda
  online con «Salva». `bozza.py mostra dm.json` elenca le modifiche e gli avvisi sulle note da DM rimaste visibili.
- Le parti per il solo DM vanno in `[DM]…[/DM]` (o `dm: true` / «Mostra a:»), mai lasciate come «Nota per DM» nel testo.
- Se modifichi copie.js o il filtro copia() in strumenti/pubblica.py, verifica con `python3 strumenti/prova_copie.py dm.json`.

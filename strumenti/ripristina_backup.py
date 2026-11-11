"""Rimette nel repository una copia notturna del sito presa dal ramo «backup» (strumenti/backup_notturno.py).

Serve se i dati salvati dal sito su Supabase sono spariti o sono stati manomessi. Copia nel repository data.enc,
giocatori/*.enc e le immagini caricate dal sito (blobs/sb-…, priv/sb-…), e scrive versione.json con una data nuova,
così dopo il merge su main il sito apre questa copia invece di quella su Supabase.

Uso (dal ramo di lavoro, poi commit, PR e merge come sempre):
  python3 strumenti/ripristina_backup.py elenco            # le copie disponibili, una per notte (le più recenti prima)
  python3 strumenti/ripristina_backup.py usa [COMMIT]      # rimette la copia indicata (senza COMMIT: l'ultima)
  python3 strumenti/ripristina_backup.py usa [COMMIT] --solo
        # come sopra, e in più il sito smette di usare Supabase (versione.json «solo»): da usare se Supabase
        # non è più affidabile. Il «Salva» dal sito resta fermo finché non si riattiva.
  python3 strumenti/ripristina_backup.py riattiva          # Supabase torna in uso (dopo averlo rimesso in sicurezza)

Il DM controlla poi il sito: con il suo accesso vede i dati di quella notte. Le password non cambiano.
"""
import json
import os
import subprocess
import sys
import time


def git(*a, binario=False):
    r = subprocess.run(['git', *a], capture_output=True, check=True)
    return r.stdout if binario else r.stdout.decode()


def ramo():
    try:
        git('fetch', '-q', 'origin', 'backup')
    except subprocess.CalledProcessError:
        print('  (non riesco ad aggiornare il ramo backup da GitHub: uso quello che c\'è già)', file=sys.stderr)
    try:
        git('rev-parse', '--verify', '-q', 'origin/backup')
    except subprocess.CalledProcessError:
        sys.exit('Non c\'è ancora nessun backup: il ramo «backup» si crea la prima notte dopo un salvataggio dal sito.')
    return 'origin/backup'


def elenco():
    for riga in git('log', ramo(), '--format=%h %s', '-n', '60').splitlines():
        print(riga)


def versione(solo):
    json.dump({'pub': int(time.time() * 1000), **({'solo': True} if solo else {})}, open('versione.json', 'w'))


def usa(rif, solo):
    rif = rif or ramo()
    if rif != 'origin/backup':
        ramo()
    try:
        st = json.loads(git('show', rif + ':stato.json'))
    except subprocess.CalledProcessError:
        sys.exit(f'Non trovo la copia «{rif}» nel ramo backup: guarda l\'elenco con «elenco».')
    nomi = git('ls-tree', '-r', '--name-only', rif).splitlines()
    dati = [n for n in nomi if n == 'dati/data.enc' or (n.startswith('dati/giocatori/') and n.endswith('.enc'))]
    if 'dati/data.enc' not in dati:
        sys.exit('Questa copia non ha data.enc: scegline un\'altra con «elenco».')
    for n in dati:
        dest = n[len('dati/'):]
        os.makedirs(os.path.dirname(dest) or '.', exist_ok=True)
        open(dest, 'wb').write(git('show', rif + ':' + n, binario=True))
    # le copie dei giocatori sono quelle del backup: altre rimaste qui verrebbero da una versione diversa
    tenuti = {n[len('dati/'):] for n in dati}
    for f in os.listdir('giocatori'):
        if f.endswith('.enc') and 'giocatori/' + f not in tenuti:
            os.remove('giocatori/' + f)
    imm = [n for n in nomi if n.startswith(('blobs/sb-', 'priv/sb-'))]
    for n in imm:
        if not os.path.exists(n):
            os.makedirs(os.path.dirname(n), exist_ok=True)
            open(n, 'wb').write(git('show', rif + ':' + n, binario=True))
    versione(solo)
    print(f"Rimessa la copia del {st['salvato']} (salvataggio {st['cartella']}): data.enc, {len(dati) - 1} copie dei giocatori, {len(imm)} immagini.")
    if not st.get('con_immagini'):
        print('Attenzione: questa copia non ha l\'elenco delle immagini caricate dal sito; quelle che mancano qui si scaricano ancora da Supabase.')
    if st.get('mancanti'):
        print('Attenzione: quella notte mancavano già', len(st['mancanti']), 'immagini su Supabase.')
    print('Ora: commit, PR e merge su main.' + (' Il sito userà solo GitHub finché non esegui «riattiva».' if solo else ''))


def riattiva():
    versione(False)
    print('versione.json senza «solo»: dopo il merge il sito torna a usare Supabase e il DM può salvare di nuovo dal sito.')


if __name__ == '__main__':
    a = sys.argv[1:]
    solo = '--solo' in a
    a = [x for x in a if x != '--solo']
    if a[:1] == ['elenco'] and len(a) == 1:
        elenco()
    elif a[:1] == ['usa'] and len(a) <= 2:
        usa(a[1] if len(a) == 2 else None, solo)
    elif a == ['riattiva']:
        riattiva()
    else:
        sys.exit(__doc__)

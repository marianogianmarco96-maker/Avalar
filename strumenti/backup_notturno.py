"""Backup notturno del sito: copia su GitHub (ramo «backup») l'ultimo salvataggio fatto dal DM sul sito.

I salvataggi dal sito vivono solo su Supabase (bucket «sito», tavolo/sito-1.sql), che tiene le ultime 15 versioni.
Se Supabase venisse svuotato o manomesso, il ramo «backup» ne ha una copia, e ogni notte che cambia qualcosa un commit
nuovo: si può tornare a una qualsiasi notte con strumenti/ripristina_backup.py.

Copia solo file già cifrati, e solo quelli che chiunque può già scaricare dal bucket pubblico: data.enc del DM, le copie
giocatori/<id>.enc e le immagini caricate dal sito (blobs/sb-… in chiaro, quelle che vedono tutti; priv/sb-… cifrate).
Non servono password né chiavi segrete: legge con la chiave pubblica del sito.

Uso (lo esegue .github/workflows/backup-notturno.yml):
  python3 strumenti/backup_notturno.py CARTELLA     # CARTELLA = copia di lavoro del ramo «backup»
Esce con 0 e non tocca niente se dall'ultima notte il DM non ha salvato; con 3 se mancano immagini (il resto è buono).
"""
import datetime
import glob
import json
import os
import sys
import time
import urllib.error
import urllib.request

SB_URL = 'https://zwxwnmcxryfmzkqsakjz.supabase.co'
SB_KEY = 'sb_publishable_cAGuilUZdnxhtDeJ-qwuEQ_ihjCyFj0'
FILES = SB_URL + '/storage/v1/object/public/sito/'


def scarica(url, **headers):
    for prova in range(4):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'avalar-backup', **headers}), timeout=90).read()
        except urllib.error.HTTPError as e:
            if e.code < 500 or prova == 3:
                raise
        except urllib.error.URLError:
            if prova == 3:
                raise
        time.sleep(2 ** (prova + 1))


def scrivi(dest, p, b):
    f = os.path.join(dest, p)
    os.makedirs(os.path.dirname(f), exist_ok=True)
    open(f, 'wb').write(b)


def cifrato(b, nome):
    """Un file .enc valido: JSON con sale, iv e testo cifrato. Se non lo è, meglio non sovrascrivere il backup buono."""
    try:
        j = json.loads(b)
        assert j.get('iv') and j.get('ct') and j.get('salt') and j.get('it')
    except Exception:  # noqa: BLE001
        sys.exit(f'{nome} non sembra un file cifrato del sito: non aggiorno il backup.')
    return b


def main(dest):
    st = json.loads(scarica(SB_URL + '/rest/v1/sito_stato?select=versione,cartella,aggiornato&id=eq.1', apikey=SB_KEY))
    if not st or not st[0].get('cartella'):
        print('Il DM non ha ancora salvato dal sito: niente da copiare.')
        return
    st = st[0]
    cart = st['cartella']
    prima = {}
    if os.path.exists(os.path.join(dest, 'stato.json')):
        prima = json.load(open(os.path.join(dest, 'stato.json')))
    if prima.get('cartella') == cart and prima.get('versione') == st['versione']:
        print('Nessun salvataggio nuovo dal', prima.get('salvato'))
        return

    # l'elenco dei file del salvataggio (i salvataggi fatti prima di questo backup non ce l'hanno)
    try:
        elenco = json.loads(scarica(FILES + cart + '/file.json'))
    except urllib.error.HTTPError as e:
        if e.code not in (400, 404):
            raise
        elenco = None
        print('Questo salvataggio non ha file.json: copio i dati, le immagini restano quelle della notte precedente.')
    ids = elenco['giocatori'] if elenco else sorted(os.path.basename(f)[:-4] for f in glob.glob('giocatori/*.enc'))

    scrivi(dest, 'dati/data.enc', cifrato(scarica(FILES + cart + '/data.enc'), 'data.enc'))
    fatti = set()
    for gid in ids:
        try:
            b = scarica(FILES + cart + '/giocatori/' + gid + '.enc')
        except urllib.error.HTTPError as e:
            if e.code in (400, 404) and not elenco:
                continue  # senza elenco provo i giocatori che conosco: chi non c'è non è un errore
            raise
        scrivi(dest, 'dati/giocatori/' + gid + '.enc', cifrato(b, gid + '.enc'))
        fatti.add(gid)
    for f in glob.glob(os.path.join(dest, 'dati/giocatori/*.enc')):
        if os.path.basename(f)[:-4] not in fatti:
            os.remove(f)

    mancanti = []
    if elenco:
        imm = set(elenco['immagini'])
        nuove = 0
        for p in sorted(imm):
            if not p.startswith(('blobs/sb-', 'priv/sb-')) or '..' in p:
                continue
            if os.path.exists(os.path.join(dest, p)):
                continue  # il nome è l'impronta del contenuto: se c'è, è uguale
            try:
                scrivi(dest, p, scarica(FILES + p))
                nuove += 1
            except urllib.error.HTTPError as e:
                print('  manca su Supabase:', p, e.code)
                mancanti.append(p)
        # immagini che nessuno usa più: restano nella storia del ramo, non nell'ultima copia
        for f in glob.glob(os.path.join(dest, 'blobs/*')) + glob.glob(os.path.join(dest, 'priv/*')):
            if os.path.relpath(f, dest) not in imm:
                os.remove(f)
        print(f'Immagini: {len(imm)} ({nuove} nuove)')

    json.dump({
        'versione': st['versione'], 'cartella': cart,
        'salvato': datetime.datetime.fromtimestamp(st['versione'] / 1000, datetime.timezone.utc).isoformat(timespec='seconds'),
        'copiato': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'),
        'giocatori': sorted(fatti), 'con_immagini': bool(elenco), 'mancanti': mancanti,
    }, open(os.path.join(dest, 'stato.json'), 'w'), indent=1)
    open(os.path.join(dest, 'README.md'), 'w').write(
        '# Backup del sito di Avalar\n\n'
        'Copia notturna dell\'ultimo salvataggio fatto dal DM sul sito (Supabase). Tutto è cifrato come sul sito.\n'
        'Ogni commit è una notte: per rimettere online una copia, `python3 strumenti/ripristina_backup.py` dal ramo main\n'
        '(vedi le istruzioni in cima allo script).\n')
    print('Backup aggiornato: salvataggio del', time.strftime('%d/%m/%Y %H:%M', time.gmtime(st['versione'] / 1000)), 'UTC')
    if mancanti:
        print(f'Attenzione: {len(mancanti)} immagini non si trovano più su Supabase (vedi stato.json).', file=sys.stderr)
        sys.exit(3)  # il resto del backup è buono: il workflow lo salva e poi segnala l'errore


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])

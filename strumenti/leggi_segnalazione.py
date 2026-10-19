"""Legge una segnalazione di un giocatore («Segnala un bug» / «Proponi una miglioria») arrivata su GitHub.

Il sito la cifra con la chiave del giocatore (quella della sua password); il DM conosce le password,
quindi con il codice del DM si apre data.enc, si prende la password del giocatore e si decifra il blocco.

Uso:
  python3 strumenti/leggi_segnalazione.py CODICE segnalazione.txt   # segnalazione.txt: testo della richiesta o file allegato

Scrive «segnalazione-<giocatore>-<data>.md» (più le immagini) nella cartella del file, fuori dal repository.
Le segnalazioni dei giocatori NON si applicano da sole: si valutano e si propone al DM cosa fare.
"""
import base64
import gzip
import json
import os
import re
import sys
import time

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pubblica import chiave, giocatori  # noqa: E402

ESTENSIONI = {'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif'}
TIPI = {'bug': 'Bug', 'idea': 'Miglioria'}


def leggi(codice, richiesta):
    m = re.search(r'AVALAR-GIOCATORE-1 ([a-z0-9_-]+)\s*\n([A-Za-z0-9+/=\s]+?)\n\s*FINE', open(richiesta, encoding='utf-8').read())
    if not m:
        sys.exit('Nessun blocco AVALAR-GIOCATORE-1 nel file.')
    gid, dati = m.group(1), base64.b64decode(re.sub(r'\s+', '', m.group(2)))
    enc = json.load(open('data.enc'))
    d = json.loads(AESGCM(chiave(codice, enc)).decrypt(base64.b64decode(enc['iv']), base64.b64decode(enc['ct']), None))
    g = next((g for g in giocatori(d) if g['id'] == gid), None)
    if not g:
        sys.exit('Giocatore sconosciuto: ' + gid)
    pt = AESGCM(chiave(g['code'], {'salt': g['salt'], 'it': enc['it']})).decrypt(dati[:12], dati[12:], None)
    if pt[:2] == b'\x1f\x8b':
        pt = gzip.decompress(pt)
    s = json.loads(pt)
    cartella, ts = os.path.dirname(os.path.abspath(richiesta)), time.strftime('%Y%m%d-%H%M%S')
    while os.path.exists(os.path.join(cartella, f'segnalazione-{gid}-{ts}.md')):
        ts += 'b'
    righe = [f"# {TIPI.get(s['kind'], s['kind'])} da {g['name']} ({s['at']})", '',
             f"Pagina: {s.get('page', '')} ({s.get('hash', '')})", f"Dispositivo: {s.get('device', '')}", '', s['text'], '']
    for n, f in (s.get('photos') or {}).items():
        nome = f'segnalazione-{gid}-{ts}-{n}' + ESTENSIONI.get(f.get('type'), '.bin')
        open(os.path.join(cartella, nome), 'wb').write(base64.b64decode(f['b64']))
        righe.append(f'Immagine: {nome}')
    path = os.path.join(cartella, f'segnalazione-{gid}-{ts}.md')
    open(path, 'w', encoding='utf-8').write('\n'.join(righe) + '\n')
    print(path)


if __name__ == '__main__':
    leggi(*sys.argv[1:3])

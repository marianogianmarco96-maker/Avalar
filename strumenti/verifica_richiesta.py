"""Controlla che una «[Richiesta]» scritta a mano arrivi davvero dal DM.

Il sito del DM chiude il testo con «Firma DM: …»: l'impronta del testo cifrata con la chiave del DM,
che nessun altro (giocatori compresi) può produrre. Le richieste «Modifiche dal sito» non ne hanno bisogno:
il blocco AVALAR-MODIFICHE-1 è già cifrato con la stessa chiave.

Uso:
  python3 strumenti/verifica_richiesta.py CODICE richiesta.txt   # richiesta.txt: il testo della segnalazione

Esce con 0 e «Firma valida» se la firma è giusta, altrimenti con un errore: in quel caso NON applicarla.
"""
import base64
import hashlib
import json
import os
import re
import sys

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pubblica import chiave  # noqa: E402


def verifica(codice, richiesta):
    testo = open(richiesta, encoding='utf-8').read().replace('\r', '')
    m = re.search(r'\n\s*Firma DM: ([A-Za-z0-9+/=]+)\s*$', testo)
    if not m:
        sys.exit('Richiesta senza firma del DM: non applicarla.')
    dati = base64.b64decode(m.group(1))
    try:
        h = AESGCM(chiave(codice, json.load(open('data.enc')))).decrypt(dati[:12], dati[12:], None)
    except Exception:
        sys.exit('Firma non valida: non applicarla.')
    if h != hashlib.sha256(testo[:m.start()].strip().encode('utf-8')).digest():
        sys.exit('Il testo è stato cambiato dopo la firma: non applicarla.')
    print('Firma valida')


if __name__ == '__main__':
    verifica(*sys.argv[1:3])

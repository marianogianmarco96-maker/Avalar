"""Converte in WebP le immagini pubbliche troppo pesanti e aggiorna i riferimenti nei dati.

Uso:  python3 strumenti/comprimi_immagini.py data.json

Funziona sia su data.json sia sui dati del DM decifrati da data.enc. I file originali
non vengono cancellati: si possono togliere quando nessuno dei due file di dati li usa più.
"""
import hashlib
import io
import json
import os
import sys

from PIL import Image

SOGLIA = 300 * 1024      # sopra questa dimensione proviamo a ricomprimere
QUALITA = 82


def main():
    path = sys.argv[1]
    d = json.load(open(path, encoding='utf-8'))
    bm, blobs = d['blobmap'], d['stores']['blobs']
    tipo = {b['aid']: b for b in blobs.values()}
    for aid, f in list(bm.items()):
        if not f.startswith('blobs/') or os.path.getsize(f) < SOGLIA:
            continue
        buf = io.BytesIO()
        Image.open(f).convert('RGB').save(buf, 'WEBP', quality=QUALITA, method=6)
        data = buf.getvalue()
        if len(data) > os.path.getsize(f) * 0.7:
            continue
        nuovo = 'blobs/' + hashlib.sha256(data).hexdigest()[:16] + '.webp'
        open(nuovo, 'wb').write(data)
        print(f'{f} {os.path.getsize(f) // 1024} KB -> {nuovo} {len(data) // 1024} KB')
        bm[aid] = nuovo
        if aid in tipo:
            tipo[aid]['type'] = 'image/webp'
    json.dump(d, open(path, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))


if __name__ == '__main__':
    main()

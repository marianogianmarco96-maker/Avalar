"""Applica ai dati del DM le modifiche fatte sul sito e inviate come richiesta su GitHub.

Il sito manda le modifiche in un blocco cifrato con il codice del DM (tra «AVALAR-MODIFICHE-1» e «FINE»),
nel testo della richiesta o nel file allegato «modifiche-avalar.txt».

Uso:
  python3 strumenti/pubblica.py apri CODICE dm.json
  python3 strumenti/applica_richiesta.py CODICE richiesta.txt dm.json   # richiesta.txt: testo della richiesta o file allegato
  python3 strumenti/pubblica.py salva CODICE dm.json

Le immagini nuove vanno in blobs/ se le vedono anche i giocatori, altrimenti in priv/ (cifrate).

Se la richiesta contiene anche segnalazioni («Segnala a Claude»: note sui testi ed errori del sito con le loro foto),
le scrive in «segnalazioni-<data>.md» (più le foto) nella cartella del file della richiesta, fuori dal repository:
vanno lette, risolte e poi cancellate come dm.json, perché possono contenere segreti della campagna.
"""
import base64
import gzip
import hashlib
import json
import os
import re
import sys
import time

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pubblica import chiave, copia_ospite  # noqa: E402

ESTENSIONI = {'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif'}


def leggi_blocco(testo):
    m = re.search(r'AVALAR-MODIFICHE-1\s*\n([A-Za-z0-9+/=\s]+?)\n\s*FINE', testo)
    if not m:
        sys.exit('Nessun blocco AVALAR-MODIFICHE-1 nel file.')
    return base64.b64decode(re.sub(r'\s+', '', m.group(1)))


def applica(codice, richiesta, src):
    k = chiave(codice, json.load(open('data.enc')))
    dati = leggi_blocco(open(richiesta, encoding='utf-8').read())
    pt = AESGCM(k).decrypt(dati[:12], dati[12:], None)
    if pt[:2] == b'\x1f\x8b':
        pt = gzip.decompress(pt)
    mod = json.loads(pt)
    d = json.load(open(src, encoding='utf-8'))
    S = d['stores']
    for op in mod['ops']:
        c = S.setdefault(op['c'], {})
        if op.get('del'):
            c.pop(op['id'], None)
            print('  tolto  ', op['c'], op['id'])
        elif 'v' in op:
            print('  ' + ('cambiato' if op['id'] in c else 'nuovo   '), op['c'], op['id'])
            c[op['id']] = op['v']
        else:  # solo i campi cambiati
            doc = c.setdefault(op['id'], {})
            doc.update(op.get('set', {}))
            for f in op.get('unset', []):
                doc.pop(f, None)
            print('  cambiato', op['c'], op['id'], '(' + ', '.join(list(op.get('set', {})) + ['-' + f for f in op.get('unset', [])]) + ')')
    # immagini nuove: prima le metto tutte in blobs/, poi sposto in priv/ quelle che i giocatori non vedono
    nuove = {}
    for aid, f in mod.get('files', {}).items():
        b = base64.b64decode(f['b64'])
        nome = hashlib.sha256(b).hexdigest()[:16]
        nuove[aid] = (b, nome, ESTENSIONI.get(f.get('type'), '.bin'))
        d['blobmap'][aid] = 'blobs/' + nome + nuove[aid][2]
    pubbliche = set(copia_ospite(d)['blobmap']) if nuove else set()
    for aid, (b, nome, est) in nuove.items():
        if aid in pubbliche:
            open('blobs/' + nome + est, 'wb').write(b)
        else:
            iv = os.urandom(12)
            open('priv/' + nome + '.bin', 'wb').write(iv + AESGCM(k).encrypt(iv, b, None))
            d['blobmap'][aid] = 'priv/' + nome + '.bin'
        print('  immagine', d['blobmap'][aid])
    segnala(mod, os.path.dirname(os.path.abspath(richiesta)))
    d['dataVersion'] = int(time.time())
    json.dump(d, open(src, 'w', encoding='utf-8'), ensure_ascii=False)
    print(f"{len(mod['ops'])} documenti, {len(nuove)} immagini applicati (modifiche del {mod.get('at', '?')}).")


def segnala(mod, cartella):
    note, errori = mod.get('notes') or [], mod.get('bugs') or []
    if not note and not errori:
        return
    ts = time.strftime('%Y%m%d-%H%M%S')
    righe = [f"# Segnalazioni dal sito ({mod.get('at', '?')})", '']
    if note:
        righe += ['## Note sui testi', '']
        for i, n in enumerate(note, 1):
            righe += [f"### Nota {i} · {n.get('where', '')}", f"Pagina: {n.get('page', '')} ({n.get('hash', '')})", '',
                      '> ' + str(n.get('quote', '')).replace('\n', '\n> '), '', str(n.get('note', '')), '']
    foto = mod.get('bugfiles') or {}
    if errori:
        righe += ['## Errori del sito', '']
        for i, g in enumerate(errori, 1):
            righe += [f"### Errore {i}", f"Pagina: {g.get('page', '')} ({g.get('hash', '')})", f"Dispositivo: {g.get('device', '')}", '', str(g.get('text', ''))]
            for j, aid in enumerate(g.get('photos') or [], 1):
                f = foto.get(aid)
                if not f:
                    continue
                nome = f'segnalazioni-{ts}-errore{i}-foto{j}' + ESTENSIONI.get(f.get('type'), '.bin')
                open(os.path.join(cartella, nome), 'wb').write(base64.b64decode(f['b64']))
                righe.append(f'Foto: {nome}')
            righe.append('')
    path = os.path.join(cartella, f'segnalazioni-{ts}.md')
    open(path, 'w', encoding='utf-8').write('\n'.join(righe))
    print(f'{len(note)} note e {len(errori)} errori da risolvere: {path}')


if __name__ == '__main__':
    applica(*sys.argv[1:4])

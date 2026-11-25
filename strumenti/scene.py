#!/usr/bin/env python3
"""Immagini delle scene del Tavolo, per Claude: le scarica in scene/ (cartella ignorata da git) per guardarle.

Usa la funzione Supabase «tavolo-bot-immagini» (supabase/functions/) con la chiave del bot AVALAR_BOT_KEY
(tavolo/tappa-16.sql). Solo lettura: i link valgono un'ora.

  python3 strumenti/scene.py elenco [--giorni N]           # nomi e id delle scene con un'immagine
  python3 strumenti/scene.py scarica [testo] [--giorni N]   # scarica le scene il cui nome contiene «testo»
"""
import json, os, re, sys, urllib.request

URL = 'https://zwxwnmcxryfmzkqsakjz.supabase.co/functions/v1/tavolo-bot-immagini'
PUB = 'sb_publishable_cAGuilUZdnxhtDeJ-qwuEQ_ihjCyFj0'
DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'scene')


def chiedi(giorni=None):
    chiave = os.environ.get('AVALAR_BOT_KEY')
    if not chiave: sys.exit('Manca AVALAR_BOT_KEY nei segreti dell\'ambiente.')
    corpo = {'chiave': chiave, **({'giorni': giorni} if giorni else {})}
    req = urllib.request.Request(URL, data=json.dumps(corpo).encode(),
                                 headers={'apikey': PUB, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=120) as r: return json.loads(r.read())


def nome_file(s):
    return re.sub(r'[^a-z0-9]+', '-', s['nome'].lower()).strip('-')[:60] + '-' + s['id'][:8] + '.jpg'


def main(a):
    giorni = None
    if '--giorni' in a:
        i = a.index('--giorni'); giorni = float(a[i + 1]); a = a[:i] + a[i + 2:]
    if not a or a[0] not in ('elenco', 'scarica'): sys.exit(__doc__)
    S = chiedi(giorni)
    if a[0] == 'elenco':
        for s in S: print(f"{s['id']}  {s['creata'][:16]}  {s['larghezza']}×{s['altezza']}  «{s['nome']}»")
        return
    filtro = ' '.join(a[1:]).lower()
    os.makedirs(DIR, exist_ok=True)
    for s in S:
        if filtro and filtro not in s['nome'].lower(): continue
        if not s.get('url'): print(f"senza link: «{s['nome']}»"); continue
        f = os.path.join(DIR, nome_file(s))
        urllib.request.urlretrieve(s['url'], f)
        print(f'«{s["nome"]}» → {os.path.relpath(f)}')


if __name__ == '__main__': main(sys.argv[1:])

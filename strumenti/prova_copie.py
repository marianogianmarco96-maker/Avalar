"""Controlla che copie.js (le copie preparate dal browser del DM) dia lo stesso risultato di copia() in pubblica.py.

Uso:
  python3 strumenti/prova_copie.py dm.json              # prova sui dati veri del DM (dopo `pubblica.py apri`; serve node)
  python3 strumenti/prova_copie.py --esempio dm.json    # come sopra, con aggiunto un po' di tutto ciò che la copia deve togliere
"""
import copy
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pubblica import copia, giocatori  # noqa: E402

RADICE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NODE = """
const { copia } = require(process.argv[1]);
let s = ''; process.stdin.on('data', c => s += c).on('end', () => {
  const { d, chi } = JSON.parse(s); process.stdout.write(JSON.stringify(chi.map(c => copia(d, c))));
});
"""


def esempio(src):
    """I dati di src con dentro un po' di tutto ciò che la copia deve togliere o lasciare."""
    d = json.load(open(src, encoding='utf-8'))
    S = d['stores']
    S['meta']['giocatori'] = {'k': 'giocatori', 'v': [{'id': 'livion', 'name': 'Livion', 'pg': 'pg-livion', 'code': 'x'},
                                                      {'id': 'sam', 'name': 'Sam', 'pg': 'pg-sam', 'code': 'y'},
                                                      {'id': 'violet', 'name': 'Violet', 'pg': None, 'code': 'z'}]}
    S['meta']['segnalazioni'] = {'k': 'segnalazioni', 'v': {'token': 'tok'}}
    S['meta']['generalHist'] = {'k': 'generalHist', 'v': []}
    S['meta']['scaletta:99'] = {'k': 'scaletta:99', 'v': {'n': 99, 'title': 'Prova', 'text': '### Scene\n1. **Segreto.** solo DM'}}
    S['meta']['general']['v']['text'] += '\n\n[DM]segreto[/DM] [PER Sam]per Sam[/PER] [PER livion, SAM, violet]tutti[/PER] [DM]senza chiusura\n'
    ents = list(S['entities'])
    for i, k in enumerate(ents):
        e = S['entities'][k]
        if i % 7 == 1:
            e['vis'] = ['sam']
        if i % 11 == 2:
            e['vis'] = []
        if i % 13 == 3:
            e['discovered'] = False
        if e.get('type') == 'png':  # fazione: visibile, segreta (fazDm) o di una scheda nascosta
            e['faz'] = [f for f in ents if f.startswith('fazione-')][i % 3]
            if i % 4 == 1:
                e['fazDm'] = True
        if i % 5 == 0:
            e['brief'] = (e.get('brief') or '') + ' [DM]nascosto[/DM] [PER Violet]per Violet'
        b = S['bodies'].get(k)
        if not b:
            continue
        for j, s in enumerate(b['sections']):
            if (i + j) % 6 == 1:
                s['vis'] = ['livion', 'sam', 'violet']
            if (i + j) % 9 == 2:
                s['dm'] = True
            if (i + j) % 10 == 3:
                s['quest'] = True
            for n, en in enumerate(s['entries']):
                if (i + j + n) % 8 == 1:
                    en['vis'] = ['violet']
                if (i + j + n) % 12 == 2:
                    en['text'] = '*(Solo DM)* ' + en['text']
                if (i + j + n) % 4 == 3:
                    en['text'] += ' [[' + ents[(i * 3) % len(ents)] + ']] [[' + ents[(i * 5) % len(ents)] + '|alias]] *(Dalla scaletta del DM: da integrare con il resoconto.)*'
        if i % 10 == 4:
            b['sections'].append({'title': 'Note DM', 'entries': [{'text': 'x'}]})
    for i, (k, v) in enumerate(S['events'].items()):
        if i % 4 == 1:
            v['vis'] = ['sam', 'livion']
        if i % 9 == 2:
            v['dm'] = True
    for i, (k, l) in enumerate(S['links'].items()):
        if i % 5 == 1:
            l['vis'] = ['violet']
    for b in S['sbodies'].values():
        b['summary'] = '*Riassunto ricavato dalla scaletta del DM (prova)*\n' + b['summary'] + '\n\n*(Solo DM)* paragrafo segreto\n\nfine [DM]x'
    for i, aid in enumerate(list(d['blobmap'])):
        if i % 3 == 0:
            d['blobmap'][aid] = 'priv/' + aid + '.bin'
        if i % 6 == 0:
            d.setdefault('blobkeys', {})[aid] = 'k' + aid
    return d


def main():
    args = [a for a in sys.argv[1:] if a != '--esempio']
    if len(args) != 1:
        sys.exit(__doc__)
    d = esempio(args[0]) if '--esempio' in sys.argv else json.load(open(args[0], encoding='utf-8'))
    chi = [None] + [g['id'] for g in giocatori(d)]
    js = subprocess.run(['node', '-e', NODE, os.path.join(RADICE, 'copie.js')], input=json.dumps({'d': d, 'chi': chi}),
                        capture_output=True, text=True, check=True).stdout
    errori = 0
    for c, j in zip(chi, json.loads(js)):
        p = json.loads(json.dumps(copia(copy.deepcopy(d), c)))
        if any(k.startswith('scaletta:') for k in p['stores']['meta']):
            errori += 1
            print(f"{c or 'ospiti':8} la scaletta del DM è rimasta nella copia")
        if p == j:
            print(f"{c or 'ospiti':8} uguali ({len(json.dumps(p)) // 1024} KB)")
            continue
        errori += 1
        print(f"{c or 'ospiti':8} DIVERSE")
        for st in sorted(set(p['stores']) | set(j['stores'])):
            a, b = p['stores'].get(st, {}), j['stores'].get(st, {})
            for k in sorted(set(a) | set(b)):
                if a.get(k) != b.get(k):
                    print('   ', st, k, json.dumps(a.get(k), ensure_ascii=False)[:300], '\n     js:', json.dumps(b.get(k), ensure_ascii=False)[:300])
                    break
        for k in set(p) | set(j):
            if k != 'stores' and p.get(k) != j.get(k):
                print('   ', k, 'diverso')
    sys.exit(1 if errori else 0)


if __name__ == '__main__':
    main()

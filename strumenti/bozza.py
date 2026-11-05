"""Mette le modifiche di Claude in una bozza che vede solo il DM, invece di pubblicarle subito.

Quando Claude inserisce un riassunto di sessione (o altre modifiche ai contenuti), le cambia in dm.json come sempre.
Prima di pubblicare, questo strumento confronta dm.json con i dati pubblicati e sposta tutte le differenze nella
bozza (meta «bozza»): i dati veri tornano quelli pubblicati, quindi i giocatori non vedono niente di nuovo.
Il DM apre il sito, preme «Controlla» nel riquadro in basso, rivede le modifiche (con chi le vede e gli avvisi sulle
note da DM rimaste visibili), le corregge e solo quando preme «Salva» vanno online.

Uso:
  python3 strumenti/pubblica.py apri CODICE dm.json
  … modifiche a dm.json …
  python3 strumenti/bozza.py prepara CODICE dm.json "Sessione 12 · Il porto"   # le modifiche passano nella bozza
  python3 strumenti/pubblica.py salva CODICE dm.json
  python3 strumenti/bozza.py mostra dm.json                                    # cosa c'è nella bozza, con gli avvisi

Se c'è già una bozza che il DM non ha ancora controllato, le modifiche nuove si aggiungono a quella.
Le immagini nuove restano cifrate (priv/) finché il DM non salva dal sito: lì diventano visibili a chi deve vederle.
"""
import copy
import json
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pubblica import ORDINE, SB_URL, SPAN_DM, chiave, copia, decifra, giocatori, scarica, su_supabase  # noqa: E402

CHIAVE = {'meta': 'k', 'entities': 'id', 'bodies': 'id', 'sessions': 'n', 'sbodies': 'n', 'events': 'id', 'maps': 'id',
          'blobs': 'id', 'pins': 'id', 'links': 'k', 'regions': 'id'}
# frasi che di solito sono per il solo DM: se le vede un giocatore, il DM riceve un avviso (anche sul sito)
NOTA_PER_DM = re.compile(r'\bnot[ae]\s+(?:per\s+(?:il\s+)?)?(?:dm|master)\b|\bsolo\s+(?:per\s+)?(?:il\s+)?dm\b|\bper\s+il\s+dm\b|\(\s*dm\s*\)'
                         r'|\bi\s+giocatori\s+non\s+(?:lo\s+|la\s+|li\s+|le\s+)?(?:sanno|conoscono)\b|\bsegret[oi]\s+(?:del|per\s+il)\s+dm\b', re.I)


def pubblicati(codice):
    """I dati pubblicati più recenti (GitHub o, se più nuovi, quelli salvati dal DM sul sito)."""
    enc = json.load(open('data.enc'))
    sb = su_supabase()
    if sb:
        enc = json.loads(scarica(SB_URL + '/storage/v1/object/public/sito/' + sb['cartella'] + '/data.enc'))
    return json.loads(decifra(chiave(codice, enc), enc))


def differenze(prima, dopo):
    ops = []
    for c in ORDINE:
        a, b = prima['stores'].get(c, {}), dopo['stores'].get(c, {})
        for k in sorted(set(a) | set(b), key=str):
            if c == 'meta' and k == 'bozza':
                continue
            if k not in b:
                ops.append({'c': c, 'id': k, 'del': 1})
            elif a.get(k) != b[k]:
                ops.append({'c': c, 'id': k, 'v': b[k], **({} if k in a else {'nuovo': 1})})
    return ops


def applica(d, ops):
    """I dati d con la bozza applicata (come fa il sito quando il DM preme «Controlla»)."""
    d = copy.deepcopy(d)
    for op in ops:
        st = d['stores'].setdefault(op['c'], {})
        if op.get('del'):
            st.pop(op['id'], None)
        else:
            st[op['id']] = op['v']
    d['stores']['meta'].pop('bozza', None)
    return d


def testi(v):
    if isinstance(v, str):
        if re.search(r'\w', v) and not v.startswith('data:'):
            yield v
    elif isinstance(v, list):
        for x in v:
            yield from testi(x)
    elif isinstance(v, dict):
        for x in v.values():
            yield from testi(x)


def avvisi(d, ops):
    """Le frasi della bozza che sembrano per il DM ma che, una volta salvate, vedrebbe almeno un giocatore."""
    dd = applica(d, ops)
    copie = {g['name']: json.dumps(copia(dd, g['id'])['stores'], ensure_ascii=False) for g in giocatori(dd)}
    out = []
    for op in ops:
        if op.get('del'):
            continue
        for t in testi(op['v']):
            for m in NOTA_PER_DM.finditer(SPAN_DM.sub(' ', t)):
                pezzo = SPAN_DM.sub(' ', t)[m.start():m.start() + 40]
                chi = [n for n, s in copie.items() if json.dumps(pezzo, ensure_ascii=False)[1:-1] in s]
                if chi:
                    out.append((op, t, chi))
                    break
    return out


def etichetta(op):
    v = op.get('v') or {}
    return f"{op['c']} {op['id']}" + (f" ({v.get('name') or v.get('title')})" if isinstance(v, dict) and (v.get('name') or v.get('title')) else '')


def stampa(d):
    b = (d['stores']['meta'].get('bozza') or {}).get('v')
    if not b or not b.get('ops'):
        print('Nessuna bozza da controllare.')
        return
    print(f"Bozza «{' + '.join(b['titoli'])}»: {len(b['ops'])} modifiche")
    for op in b['ops']:
        print('  ' + ('tolto   ' if op.get('del') else 'nuovo   ' if op.get('nuovo') else 'cambiato'), etichetta(op))
    av = avvisi(d, b['ops'])
    for op, t, chi in av:
        print(f"  ATTENZIONE: in {etichetta(op)} c'è una nota che sembra per il DM ma la vede {', '.join(chi)}:\n    «{t[:160]}»")
    if av:
        print('  Usa [DM]…[/DM] (o «Mostra a:» / dm: true) per le parti che solo il DM deve vedere.')


def prepara(codice, src, titolo):
    dopo = json.load(open(src, encoding='utf-8'))
    prima = pubblicati(codice)
    nuove = differenze(prima, dopo)
    if not nuove:
        sys.exit('Nessuna differenza dai dati pubblicati: niente da mettere in bozza.')
    vecchia = (prima['stores']['meta'].get('bozza') or {}).get('v') or {'titoli': [], 'ops': []}
    tutte = {(op['c'], op['id']): op for op in vecchia['ops']}
    for op in nuove:
        tutte[(op['c'], op['id'])] = op
    bozza = {'titoli': vecchia['titoli'] + [titolo], 'creata': vecchia.get('creata') or int(time.time() * 1000),
             'agg': int(time.time() * 1000), 'ops': list(tutte.values())}
    # i dati tornano quelli pubblicati: le novità restano solo nella bozza, che le copie dei giocatori non contengono
    dopo['stores'] = copy.deepcopy(prima['stores'])
    dopo['stores']['meta']['bozza'] = {'k': 'bozza', 'v': bozza}
    for k in ('blobkeys',):
        if k in prima:
            dopo[k] = prima[k]
    json.dump(dopo, open(src, 'w', encoding='utf-8'), ensure_ascii=False)
    print(f'Messe in bozza {len(nuove)} modifiche.')
    stampa(dopo)


if __name__ == '__main__':
    if sys.argv[1:2] == ['mostra']:
        stampa(json.load(open(sys.argv[2], encoding='utf-8')))
    elif sys.argv[1:2] == ['prepara'] and len(sys.argv) == 5:
        prepara(*sys.argv[2:5])
    else:
        sys.exit(__doc__)

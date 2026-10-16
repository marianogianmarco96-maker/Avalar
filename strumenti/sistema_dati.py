"""Correzioni una tantum ai dati della campagna (ottobre 2026).

Uso:  python3 strumenti/sistema_dati.py data.json [--ospite]

Funziona sia sulla copia pubblica (data.json) sia sui dati completi del DM
decifrati da data.enc: entrambi hanno la forma {dataVersion, stores, blobmap}.
--ospite toglie anche le note di lavorazione del DM, che i giocatori non devono vedere.
"""
import json
import re
import sys

SRC, DST = 'luogo-prigione-di-schiavi', 'luogo-la-prigione'
# Presenze dei PG confermate dal DM: Livion era a letto malato nella sessione 9.
PG_ASSENZE = {'pg-livion': {9}}
NOTA_DM = re.compile(r'\s*\*\(Dalla scaletta del DM: da integrare con il resoconto\.\)\*')
NOTA_DM_SESSIONE = re.compile(r'^\*Riassunto ricavato dalla scaletta del DM[^*\n]*\*\s*', re.M)


def norm(s):
    import unicodedata
    s = unicodedata.normalize('NFD', str(s).lower())
    return ' '.join(''.join(c for c in s if not unicodedata.combining(c)).split())


def unisci_prigioni(S):
    E = S['entities']
    if SRC not in E:
        return
    s, d = E.pop(SRC), E[DST]
    d['alias'] = sorted(set(d.get('alias', [])) | {s['name'], *s.get('alias', [])} - {d['name']})
    d['sessions'] = sorted(set(d['sessions']) | set(s['sessions']))
    sb = S['bodies'].pop(SRC, {'sections': []})
    db = S['bodies'][DST]
    for sec in sb['sections']:
        t = next((x for x in db['sections'] if norm(x['title']) == norm(sec['title'])), None)
        if not t:
            db['sections'].append(sec)
        else:
            t['entries'] += [e for e in sec['entries'] if all(norm(e['text']) != norm(x['text']) for x in t['entries'])]
    S['blobs'].pop('portrait-' + SRC, None)
    for k, l in list(S['links'].items()):
        if SRC in (l['from'], l['to']):
            del S['links'][k]
            l = {**l, 'from': DST if l['from'] == SRC else l['from'], 'to': DST if l['to'] == SRC else l['to']}
            if l['from'] != l['to']:
                l['k'] = f"{l['from']}|{l['to']}|{norm(l['label'])}"
                S['links'][l['k']] = l
    for v in S['events'].values():
        v['ents'] = list(dict.fromkeys(DST if x == SRC else x for x in v['ents']))
    for p in list(S['pins'].values()) + list(S['regions'].values()):
        if p.get('entityId') == SRC:
            p['entityId'] = DST
    rif = re.compile(r'\[\[' + re.escape(SRC) + r'(\|[^\]]+)?\]\]')
    testo = lambda t: rif.sub(lambda m: f'[[{DST}{m.group(1) or "|" + s["name"]}]]', t)
    for b in S['bodies'].values():
        for sec in b['sections']:
            for e in sec['entries']:
                e['text'] = testo(e['text'])
    for b in S['sbodies'].values():
        b['summary'] = testo(b['summary'])
    for v in S['events'].values():
        v['text'] = testo(v['text'])
    g = S['meta'].get('general')
    if g:
        g['v']['text'] = testo(g['v']['text'])


def collega_grassetti(S):
    """Nei riassunti delle sessioni trasforma **Nome** in un collegamento alla scheda, se il nome è univoco."""
    nomi = {}
    for e in S['entities'].values():
        for n in [e['name'], *e.get('alias', [])]:
            nomi.setdefault(norm(n), set()).add(e['id'])

    def sost(m):
        t = m.group(1)
        if '[[' in t:
            return m.group(0)
        ids = nomi.get(norm(t.strip('«».')))
        return f'**[[{next(iter(ids))}|{t}]]**' if ids and len(ids) == 1 else m.group(0)

    for b in S['sbodies'].values():
        b['summary'] = re.sub(r'\*\*(.+?)\*\*', sost, b['summary'])


def ricalcola_apparizioni(S):
    """Le apparizioni di una scheda includono le sessioni in cui compare negli eventi, nei riassunti o nelle voci."""
    agg = {}
    for v in S['events'].values():
        for x in v['ents']:
            agg.setdefault(x, set()).add(v['n'])
    for b in S['sbodies'].values():
        for x in re.findall(r'\[\[([^|\]]+)', b['summary']):
            agg.setdefault(x, set()).add(b['n'])
    for k, b in S['bodies'].items():
        for sec in b['sections']:
            for e in sec['entries']:
                if e.get('n'):
                    agg.setdefault(k, set()).add(e['n'])
    tutte = {s['n'] for s in S['sessions'].values()}
    for k, e in S['entities'].items():
        nuove = set(e['sessions']) | agg.get(k, set())
        if e['type'] == 'pg':
            nuove = tutte - PG_ASSENZE.get(k, set())
        e['sessions'] = sorted(n for n in nuove if n in tutte)


def togli_note_dm(S):
    for b in S['bodies'].values():
        for sec in b['sections']:
            for e in sec['entries']:
                e['text'] = NOTA_DM.sub('', e['text'])
    for b in S['sbodies'].values():
        b['summary'] = NOTA_DM_SESSIONE.sub('', b['summary'])


def main():
    path, ospite = sys.argv[1], '--ospite' in sys.argv
    d = json.load(open(path, encoding='utf-8'))
    S = d['stores']
    unisci_prigioni(S)
    collega_grassetti(S)
    ricalcola_apparizioni(S)
    if ospite:
        togli_note_dm(S)
    json.dump(d, open(path, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))


if __name__ == '__main__':
    main()

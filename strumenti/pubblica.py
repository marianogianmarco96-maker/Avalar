"""Pubblica i dati della campagna: dai dati completi del DM ricava data.enc (cifrato) e data.json (copia per i giocatori).

Uso:
  python3 strumenti/pubblica.py apri  CODICE  dm.json     # decifra data.enc in dm.json (da NON committare)
  python3 strumenti/pubblica.py salva CODICE  dm.json     # riscrive data.enc e data.json da dm.json

La copia per i giocatori toglie: schede non scoperte (con collegamenti, ritratti e menzioni,
che restano come testo semplice), sezioni del DM (titolo con «DM»), voci e note ricavate dalla scaletta del DM,
voci, eventi e paragrafi che iniziano con «*(Solo DM)*», sezioni, voci ed eventi segnati «Solo per DM» (dm: true),
testi evidenziati con [DM]…[/DM], documenti allegati alle sessioni, cronologia del riassunto e immagini riservate (priv/).
Le immagini in priv/ sono cifrate con la stessa chiave dei dati.
"""
import base64
import hashlib
import json
import os
import re
import sys

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

ORDINE = ['entities', 'bodies', 'sessions', 'sbodies', 'events', 'links', 'maps', 'pins', 'regions', 'meta', 'blobs']
SEZIONE_DM = re.compile(r'\bDM\b')
NOTA_DM = re.compile(r'\s*\*\(Dalla scaletta del DM: da integrare con il resoconto\.\)\*')
VOCE_DM = re.compile(r'^(\*Dalla scaletta del DM\.\*|Secondo la scaletta|\*\(Solo DM\)\*)')
# paragrafo di un riassunto che solo il DM deve vedere
PARAGRAFO_DM = re.compile(r'^\*\(Solo DM\)\*[^\n]*(\n\n|\n|$)', re.M)
# frase evidenziata dal DM: [DM]…[/DM] (senza chiusura arriva fino in fondo)
SPAN_DM = re.compile(r'\[DM\][\s\S]*?(?:\[/DM\]|$)')
NOTA_DM_SESSIONE = re.compile(r'^\*Riassunto ricavato dalla scaletta del DM[^*\n]*\*\s*', re.M)


def chiave(codice, enc):
    return hashlib.pbkdf2_hmac('sha256', codice.encode(), base64.b64decode(enc['salt']), enc['it'], 32)


def apri(codice, out):
    enc = json.load(open('data.enc'))
    pt = AESGCM(chiave(codice, enc)).decrypt(base64.b64decode(enc['iv']), base64.b64decode(enc['ct']), None)
    open(out, 'wb').write(pt)


def copia_ospite(d):
    S = d['stores']
    pulisci = lambda o, campi: {**o, **{c: SPAN_DM.sub('', o[c]).strip() for c in campi if isinstance(o.get(c), str)}}
    E = {k: pulisci(e, ('brief', 'status')) for k, e in S['entities'].items() if e.get('discovered') is not False}
    nascoste = {k: e['name'] for k, e in S['entities'].items() if k not in E}

    def testo(t):
        t = re.sub(r'\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]', lambda m: (m.group(2) or nascoste[m.group(1)]) if m.group(1) in nascoste else m.group(0), t)
        return SPAN_DM.sub('', NOTA_DM.sub('', t))

    bodies = {}
    for k in E:
        b = S['bodies'][k]
        bodies[k] = {**b, 'sections': [{**s, 'entries': [{**e, 'text': testo(e['text'])} for e in s['entries'] if not e.get('dm') and not VOCE_DM.match(e['text'])]}
                                       for s in b['sections'] if not s.get('dm') and not SEZIONE_DM.search(s['title'])]}
    mappe = {k: m for k, m in S['maps'].items() if m.get('discovered') is not False}
    pins = {k: p for k, p in S['pins'].items() if p.get('discovered') is not False and p.get('entityId', None) not in nascoste and p['mapId'] in mappe}
    usati = {'portrait-' + k for k, e in E.items() if e.get('portrait')} | {ph['id'] for e in E.values() for ph in e.get('photos', [])} \
        | set(mappe) | {ph['id'] for p in pins.values() for ph in p.get('photos', [])}
    blobs = {k: b for k, b in S['blobs'].items() if k in usati and d['blobmap'].get(b['aid'], 'priv/').startswith('blobs/')}
    g = {**S['meta']['general'], 'v': {**S['meta']['general']['v'], 'text': testo(S['meta']['general']['v']['text'])}}
    stores = {
        'entities': E,
        'bodies': bodies,
        'sessions': {k: pulisci(v, ('brief', 'short')) for k, v in S['sessions'].items()},
        'sbodies': {k: {**b, 'summary': PARAGRAFO_DM.sub('', NOTA_DM_SESSIONE.sub('', testo(b['summary']))).strip(), 'docs': []} for k, b in S['sbodies'].items()},
        'events': {k: {**v, 'text': testo(v['text']), 'ents': [x for x in v['ents'] if x in E]} for k, v in S['events'].items() if not v.get('dm') and not VOCE_DM.match(v['text'])},
        'links': {k: l for k, l in S['links'].items() if l['from'] in E and l['to'] in E},
        'maps': mappe,
        'pins': pins,
        'regions': {k: r for k, r in S['regions'].items() if r['mapId'] in mappe and r.get('entityId') not in nascoste},
        'meta': {k: (g if k == 'general' else v) for k, v in S['meta'].items() if k != 'generalHist'},
        'blobs': blobs,
    }
    return {'dataVersion': d['dataVersion'], 'stores': {k: stores[k] for k in ORDINE}, 'blobmap': {b['aid']: d['blobmap'][b['aid']] for b in blobs.values()}}


def salva(codice, src):
    d = json.load(open(src, encoding='utf-8'))
    enc = json.load(open('data.enc'))
    k = chiave(codice, enc)
    # verifica che il codice sia quello giusto prima di riscrivere qualcosa
    AESGCM(k).decrypt(base64.b64decode(enc['iv']), base64.b64decode(enc['ct']), None)
    for p in d['blobmap'].values():
        if not os.path.exists(p):
            sys.exit('Manca il file ' + p)
    pt = json.dumps(d, ensure_ascii=False, separators=(',', ':')).encode()
    iv = os.urandom(12)
    nuovo = {'v': 1, 'it': enc['it'], 'salt': enc['salt'], 'iv': base64.b64encode(iv).decode(), 'ct': base64.b64encode(AESGCM(k).encrypt(iv, pt, None)).decode()}
    json.dump(nuovo, open('data.enc', 'w'))
    json.dump(copia_ospite(d), open('data.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))


if __name__ == '__main__':
    azione, codice, f = sys.argv[1:4]
    apri(codice, f) if azione == 'apri' else salva(codice, f)

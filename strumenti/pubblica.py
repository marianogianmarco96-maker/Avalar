"""Pubblica i dati della campagna: dai dati completi del DM ricava data.enc (cifrato), una copia cifrata per ogni
giocatore (giocatori/<id>.enc, ognuna con la password di quel giocatore) e data.json (copia pubblica per gli ospiti).

Uso:
  python3 strumenti/pubblica.py apri    CODICE  dm.json     # decifra data.enc in dm.json (da NON committare)
  python3 strumenti/pubblica.py salva   CODICE  dm.json     # riscrive data.enc, giocatori/*.enc e data.json da dm.json
  python3 strumenti/pubblica.py account CODICE  dm.json     # crea gli account mancanti dei giocatori e ne stampa le password

Gli account stanno nei dati del DM (meta «giocatori»: id, nome, scheda del PG, password, sale), quindi solo il DM li legge.
«Mostra a:» (vis: [id dei giocatori], [] = nessuno) su schede, sezioni, voci, eventi e collegamenti, e le frasi [PER Sam, Violet]…[/PER],
limitano una parte ai giocatori scelti: senza vis la vede chiunque. La copia pubblica tiene solo ciò che vedono tutti i giocatori.
Le immagini riservate che un giocatore può vedere sono ricifrate con una chiave propria (blobkeys), che arriva solo nelle copie
di chi le vede: la chiave del DM non esce mai da data.enc.

Ogni copia per i giocatori toglie: schede non scoperte (con collegamenti, ritratti e menzioni,
che restano come testo semplice), sezioni del DM (titolo con «DM»), voci e note ricavate dalla scaletta del DM,
voci, eventi e paragrafi che iniziano con «*(Solo DM)*», sezioni, voci, eventi e collegamenti segnati «Solo per DM» (dm: true),
testi evidenziati con [DM]…[/DM], documenti allegati alle sessioni, cronologia del riassunto e immagini riservate (priv/).
Le immagini in priv/ sono cifrate con la stessa chiave dei dati.
"""
import base64
import glob
import gzip
import hashlib
import json
import os
import re
import secrets
import sys
import time

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
# frase per alcuni giocatori: [PER Sam, Violet]…[/PER] (senza chiusura arriva fino in fondo)
SPAN_PER = re.compile(r'\[PER ([^\]]*)\]([\s\S]*?)(?:\[/PER\]|$)')
GIOCATORI_BASE = [('livion', 'Livion', 'pg-livion'), ('sam', 'Sam', 'pg-sam'), ('violet', 'Violet', 'pg-violet'), ('mungus', 'Mungus', 'pg-mungus')]
CARATTERI = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'


def chiave(codice, enc):
    return hashlib.pbkdf2_hmac('sha256', codice.encode(), base64.b64decode(enc['salt']), enc['it'], 32)


def apri(codice, out):
    enc = json.load(open('data.enc'))
    pt = AESGCM(chiave(codice, enc)).decrypt(base64.b64decode(enc['iv']), base64.b64decode(enc['ct']), None)
    open(out, 'wb').write(pt)


def giocatori(d):
    return (d['stores']['meta'].get('giocatori') or {}).get('v') or []


def copia(d, chi=None):
    """Copia dei dati per il giocatore chi (id), o per gli ospiti (None: solo ciò che vedono tutti i giocatori)."""
    S = d['stores']
    G = giocatori(d)
    tutti = {g['id'] for g in G}
    nomi = {g['name'].lower(): g['id'] for g in G} | {g['id']: g['id'] for g in G}

    def vede(o):  # senza vis la vede chiunque; vis: [] non la vede nessun giocatore
        v = o.get('vis')
        return v is None or (chi in v if chi else tutti <= set(v))

    def per(m):
        ids = {nomi.get(x.strip().lower()) for x in m.group(1).split(',')} - {None}
        return m.group(2) if (chi in ids if chi else tutti <= ids) else ''

    senza = lambda o: {k: v for k, v in o.items() if k != 'vis'}
    frase = lambda t: SPAN_PER.sub(per, SPAN_DM.sub('', t))
    pulisci = lambda o, campi: senza({**o, **{c: frase(o[c]).strip() for c in campi if isinstance(o.get(c), str)}})
    E = {k: pulisci(e, ('brief', 'status')) for k, e in S['entities'].items() if e.get('discovered') is not False and vede(e)}
    nascoste = {k: e['name'] for k, e in S['entities'].items() if k not in E}

    def testo(t):
        t = re.sub(r'\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]', lambda m: (m.group(2) or nascoste[m.group(1)]) if m.group(1) in nascoste else m.group(0), t)
        return frase(NOTA_DM.sub('', t))

    bodies = {}
    for k in E:
        b = S['bodies'][k]
        bodies[k] = {**b, 'sections': [senza({**s, 'entries': [senza({**e, 'text': testo(e['text'])}) for e in s['entries'] if not e.get('dm') and vede(e) and not VOCE_DM.match(e['text'])]})
                                       for s in b['sections'] if not s.get('dm') and vede(s) and not SEZIONE_DM.search(s['title'])]}
    mappe = {k: m for k, m in S['maps'].items() if m.get('discovered') is not False}
    pins = {k: p for k, p in S['pins'].items() if p.get('discovered') is not False and p.get('entityId', None) not in nascoste and p['mapId'] in mappe}
    usati = {'portrait-' + k for k, e in E.items() if e.get('portrait')} | {ph['id'] for e in E.values() for ph in e.get('photos', [])} \
        | set(mappe) | {ph['id'] for p in pins.values() for ph in p.get('photos', [])}
    chiavi = d.get('blobkeys', {})
    leggibile = lambda aid: d['blobmap'].get(aid, 'priv/').startswith('blobs/') or (chi and aid in chiavi)
    blobs = {k: b for k, b in S['blobs'].items() if k in usati and leggibile(b['aid'])}
    g = {**S['meta']['general'], 'v': {**S['meta']['general']['v'], 'text': testo(S['meta']['general']['v']['text'])}}
    stores = {
        'entities': E,
        'bodies': bodies,
        'sessions': {k: pulisci(v, ('brief', 'short')) for k, v in S['sessions'].items()},
        'sbodies': {k: {**b, 'summary': PARAGRAFO_DM.sub('', NOTA_DM_SESSIONE.sub('', testo(b['summary']))).strip(), 'docs': []} for k, b in S['sbodies'].items()},
        'events': {k: senza({**v, 'text': testo(v['text']), 'ents': [x for x in v['ents'] if x in E]}) for k, v in S['events'].items() if not v.get('dm') and vede(v) and not VOCE_DM.match(v['text'])},
        'links': {k: senza(l) for k, l in S['links'].items() if l['from'] in E and l['to'] in E and not l.get('dm') and vede(l)},
        'maps': mappe,
        'pins': pins,
        'regions': {k: r for k, r in S['regions'].items() if r['mapId'] in mappe and r.get('entityId') not in nascoste},
        'meta': {k: (g if k == 'general' else v) for k, v in S['meta'].items() if k not in ('generalHist', 'giocatori')},
        'blobs': blobs,
    }
    out = {'dataVersion': d['dataVersion'], 'stores': {k: stores[k] for k in ORDINE}, 'blobmap': {b['aid']: d['blobmap'][b['aid']] for b in blobs.values()}}
    if chi:
        gi = next(x for x in G if x['id'] == chi)
        out['player'] = {'id': chi, 'name': gi['name'], 'pg': gi.get('pg')}
        out['blobkeys'] = {b['aid']: chiavi[b['aid']] for b in blobs.values() if b['aid'] in chiavi}
    return out


def copia_ospite(d):
    return copia(d, None)


def cifra(k, pt):
    iv = os.urandom(12)
    return iv, AESGCM(k).encrypt(iv, pt, None)


def nuova_password():
    return ''.join(secrets.choice(CARATTERI) for _ in range(8))


def account(codice, src):
    """Crea gli account mancanti dei quattro PG (password casuale) e stampa l'elenco."""
    d = json.load(open(src, encoding='utf-8'))
    enc = json.load(open('data.enc'))
    AESGCM(chiave(codice, enc)).decrypt(base64.b64decode(enc['iv']), base64.b64decode(enc['ct']), None)
    G = giocatori(d)
    for gid, nome, pg in GIOCATORI_BASE:
        if not any(g['id'] == gid for g in G):
            G.append({'id': gid, 'name': nome, 'pg': pg, 'code': nuova_password()})
    d['stores']['meta']['giocatori'] = {'k': 'giocatori', 'v': G}
    json.dump(d, open(src, 'w', encoding='utf-8'), ensure_ascii=False)
    for g in G:
        print(f"{g['name']:8} {g['code']}")


def immagini_riservate(d, k):
    """Le immagini che gli ospiti non vedono passano in priv/ (cifrate col DM); quelle che vede qualche giocatore
    ricevono una chiave propria, così la copia di quel giocatore le può aprire senza conoscere la chiave del DM."""
    bm = d['blobmap']
    pubbliche = set(copia(d)['blobmap'])
    per_path = {}
    for aid, p in list(bm.items()):
        if p.startswith('blobs/') and aid not in pubbliche and not any(bm[a] == p for a in pubbliche):
            if p not in per_path:
                b = open(p, 'rb').read()
                iv, ct = cifra(k, b)
                per_path[p] = 'priv/' + hashlib.sha256(b).hexdigest()[:16] + '.bin'
                open(per_path[p], 'wb').write(iv + ct)
            bm[aid] = per_path[p]
            print('  riservata', p, '->', bm[aid])
    for p in per_path:
        if p not in bm.values():
            os.remove(p)
    chiavi = d.setdefault('blobkeys', {})
    # con una chiave finta per tutte, la copia di ogni giocatore dice quali immagini riservate gli servono
    finta = {**d, 'blobkeys': dict.fromkeys(bm, '')}
    usate = {aid for g in giocatori(d) for aid, p in copia(finta, g['id'])['blobmap'].items() if p.startswith('priv/')}
    nuovi = {}
    for aid in sorted(usate - set(chiavi)):
        p = bm[aid]
        if p not in nuovi:
            buf = open(p, 'rb').read()
            plain = AESGCM(k).decrypt(buf[:12], buf[12:], None)
            kk = AESGCM.generate_key(256)
            iv, ct = cifra(kk, plain)
            np = 'priv/' + hashlib.sha256(plain).hexdigest()[:16] + '-g.bin'
            open(np, 'wb').write(iv + ct)
            nuovi[p] = (np, base64.b64encode(kk).decode())
        bm[aid], chiavi[aid] = nuovi[p]
        print('  per i giocatori', p, '->', bm[aid])
    for p in nuovi:
        if p not in bm.values():
            os.remove(p)


def salva(codice, src):
    d = json.load(open(src, encoding='utf-8'))
    enc = json.load(open('data.enc'))
    k = chiave(codice, enc)
    # verifica che il codice sia quello giusto prima di riscrivere qualcosa
    AESGCM(k).decrypt(base64.b64decode(enc['iv']), base64.b64decode(enc['ct']), None)
    for p in d['blobmap'].values():
        if not os.path.exists(p):
            sys.exit('Manca il file ' + p)
    prima = dict(d['blobmap'])
    immagini_riservate(d, k)
    if d['blobmap'] != prima:
        d['dataVersion'] = int(time.time())  # il sito del DM deve riprendere le immagini dai nuovi indirizzi
    # il sale di ogni giocatore resta fisso: chi ha scelto «Ricordami» non deve rientrare a ogni pubblicazione
    for g in giocatori(d):
        g.setdefault('salt', base64.b64encode(os.urandom(16)).decode())
    json.dump(d, open(src, 'w', encoding='utf-8'), ensure_ascii=False)
    pt = json.dumps(d, ensure_ascii=False, separators=(',', ':')).encode()
    iv, ct = cifra(k, pt)
    json.dump({'v': 1, 'it': enc['it'], 'salt': enc['salt'], 'iv': base64.b64encode(iv).decode(), 'ct': base64.b64encode(ct).decode()}, open('data.enc', 'w'))
    json.dump(copia(d), open('data.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    # una copia per giocatore, cifrata con la sua password
    os.makedirs('giocatori', exist_ok=True)
    fatti = set()
    for g in giocatori(d):
        if not g.get('code'):
            continue
        kg = chiave(g['code'], {'salt': g['salt'], 'it': enc['it']})
        # compressi prima di cifrare (z: 1): le copie sono quattro e così pesano un terzo in meno
        iv, ct = cifra(kg, gzip.compress(json.dumps(copia(d, g['id']), ensure_ascii=False, separators=(',', ':')).encode(), 9, mtime=0))
        f = 'giocatori/' + g['id'] + '.enc'
        json.dump({'v': 1, 'z': 1, 'it': enc['it'], 'salt': g['salt'], 'iv': base64.b64encode(iv).decode(), 'ct': base64.b64encode(ct).decode()}, open(f, 'w'))
        fatti.add(f)
    for f in glob.glob('giocatori/*.enc'):
        if f not in fatti:
            os.remove(f)


if __name__ == '__main__':
    azione, codice, f = sys.argv[1:4]
    {'apri': apri, 'salva': salva, 'account': account}[azione](codice, f)

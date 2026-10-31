#!/usr/bin/env python3
"""Coperture automatiche del tavolo: Claude prende le mappe in lista d'attesa, traccia muri e coperture, li salva.

Serve la chiave del bot (tavolo/tappa-16.sql, «select chiave from public.tavolo_bot;») nella variabile AVALAR_BOT_KEY,
messa nei segreti dell'ambiente di Claude. La chiave pubblica di Supabase è quella del sito.

  python3 strumenti/coperture.py lista                 # scarica le mappe in attesa in coperture/<id>/ (mappa + info.json + griglia.png)
  python3 strumenti/coperture.py prova <id>            # legge coperture/<id>/muri.py e disegna controllo.png sopra la mappa
  python3 strumenti/coperture.py salva <id> [nota]     # manda i tratti di coperture/<id>/muri.py al tavolo

muri.py usa le funzioni qui sotto (linea, tondo, rett, ruot), in pixel della mappa:
  linea([(x1, y1), (x2, y2), ...], None, 'muro')        # muro vero: ferma vista, passo e attacchi
  tondo(cx, cy, r, 'meta', 'tavolo')                    # tavolo tondo, copertura ½
  rett(x0, y0, x1, y1, 'meta', 'tavolo')                # tavolo rettangolare, copertura ½
  ruot(cx, cy, larghezza, altezza, gradi, 'meta', 'tavolo')
  linea([...], 'tre', 'bancone', chiusa=True)           # copertura ¾
"""
import json, math, os, sys, urllib.request

URL = 'https://zwxwnmcxryfmzkqsakjz.supabase.co'
PUB = 'sb_publishable_cAGuilUZdnxhtDeJ-qwuEQ_ihjCyFj0'
DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'coperture')


def rpc(nome, **args):
    chiave = os.environ.get('AVALAR_BOT_KEY')
    if not chiave: sys.exit('Manca AVALAR_BOT_KEY nei segreti dell\'ambiente.')
    req = urllib.request.Request(f'{URL}/rest/v1/rpc/{nome}', data=json.dumps({'p_chiave': chiave, **args}).encode(),
                                 headers={'apikey': PUB, 'Authorization': f'Bearer {PUB}', 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as r: return json.loads(r.read() or 'null')


# ---------- i tratti ----------
S = []
def linea(pts, tipo, nome, chiusa=False):
    pts = list(pts) + ([pts[0]] if chiusa else [])
    for a, b in zip(pts, pts[1:]): S.append({'punti': [round(a[0], 1), round(a[1], 1), round(b[0], 1), round(b[1], 1)], 'tipo': tipo, 'nome': nome})
def tondo(cx, cy, r, tipo, nome, n=8): linea([(cx + r * math.cos(2 * math.pi * (i + .5) / n), cy + r * math.sin(2 * math.pi * (i + .5) / n)) for i in range(n)], tipo, nome, True)
def rett(x0, y0, x1, y1, tipo, nome): linea([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], tipo, nome, True)
def ruot(cx, cy, w, h, deg, tipo, nome):
    a = math.radians(deg); c, s = math.cos(a), math.sin(a)
    linea([(cx + x * c - y * s, cy + x * s + y * c) for x, y in [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)]], tipo, nome, True)


def carica(id_):
    S.clear(); f = os.path.join(DIR, id_, 'muri.py')
    exec(compile(open(f).read(), f, 'exec'), {'linea': linea, 'tondo': tondo, 'rett': rett, 'ruot': ruot, 'math': math})
    return S


def lista():
    from PIL import Image, ImageDraw
    R = rpc('tavolo_bot_richieste') or []
    if not R: print('Nessuna mappa in attesa.'); return
    for r in R:
        d = os.path.join(DIR, r['id']); os.makedirs(d, exist_ok=True)
        urllib.request.urlretrieve(r['url'], os.path.join(d, 'mappa'))
        im = Image.open(os.path.join(d, 'mappa')).convert('RGB')
        sx, sy = r['larghezza'] / im.width, r['altezza'] / im.height
        if abs(sx - 1) > .01 or abs(sy - 1) > .01: im = im.resize((round(r['larghezza']), round(r['altezza'])))
        im.save(os.path.join(d, 'mappa.png'))
        # la griglia della scena sopra la mappa, con le coordinate ogni 5 caselle: per leggere i pixel giusti
        g, gx, gy = r['griglia'], r['griglia_x'], r['griglia_y']; dr = ImageDraw.Draw(im)
        x, i = gx % g, 0
        while x < im.width: dr.line([(x, 0), (x, im.height)], fill=(255, 255, 0) if round((x - gx) / g) % 5 == 0 else (90, 90, 90), width=1); x += g
        y = gy % g
        while y < im.height: dr.line([(0, y), (im.width, y)], fill=(255, 255, 0) if round((y - gy) / g) % 5 == 0 else (90, 90, 90), width=1); y += g
        for k in range(0, im.width, 100): dr.text((k + 2, 2), str(k), fill=(255, 80, 80))
        for k in range(0, im.height, 100): dr.text((2, k + 2), str(k), fill=(255, 80, 80))
        im.save(os.path.join(d, 'griglia.png'))
        info = {k: r[k] for k in ['id', 'scena', 'nome', 'larghezza', 'altezza', 'griglia', 'griglia_x', 'griglia_y', 'metri', 'creata']}
        info['muri_del_dm'] = [m for m in r['muri'] if not m.get('auto')]
        json.dump(info, open(os.path.join(d, 'info.json'), 'w'), ensure_ascii=False, indent=1)
        print(f"{r['id']}  «{r['nome']}»  {r['larghezza']}×{r['altezza']}  griglia {g}px  ({len(info['muri_del_dm'])} muri già fatti dal DM)  → {d}")


def prova(id_):
    from PIL import Image, ImageDraw
    d = os.path.join(DIR, id_); im = Image.open(os.path.join(d, 'mappa.png')).convert('RGB'); dr = ImageDraw.Draw(im)
    for m in json.load(open(os.path.join(d, 'info.json'))).get('muri_del_dm', []): dr.line(m['punti'], fill=(255, 255, 255), width=3)
    for m in carica(id_): dr.line(m['punti'], fill={None: (255, 40, 40), 'tre': (255, 160, 0), 'meta': (60, 220, 255)}[m['tipo']], width=4)
    im.save(os.path.join(d, 'controllo.png')); print(len(S), 'tratti →', os.path.join(d, 'controllo.png'))


def salva(id_, nota=None):
    n = rpc('tavolo_bot_muri', p_richiesta=id_, p_muri=carica(id_), p_nota=nota)
    print(f'Salvati {n} tratti: il DM li vede comparire nella mappa.')


if __name__ == '__main__':
    a = sys.argv[1:]
    if not a or a[0] == 'lista': lista()
    elif a[0] == 'prova': prova(a[1])
    elif a[0] == 'salva': salva(a[1], ' '.join(a[2:]) or None)
    else: print(__doc__)

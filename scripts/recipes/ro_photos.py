#!/usr/bin/env python3
"""
Poze cu licență liberă (Creative Commons) pentru rețetele românești, căutate pe Openverse.
Nu folosesc pozele site-urilor de rețete. Fiecare poză e verificată cu CLIP (seamănă cu felul?),
iar autorul și licența ajung în rețetă (`credit`).

  python3 -I ro_photos.py <ro_cand.json> <folder model CLIP> <cache_dir> [max]

Openverse permite anonim ~200 de căutări și ~1000 de miniaturi pe zi; scriptul se oprește politicos la limită
și reia de unde a rămas (ro_photos.json ține și căutările fără rezultat bun).
"""
import io
import json
import os
import re
import subprocess
import sys
import time
import urllib.parse
import urllib.request

import numpy as np
import onnxruntime as ort
from PIL import Image
from tokenizers import Tokenizer

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
cand = {c['key']: c for c in json.load(open(sys.argv[1]))}
D, CACHE = sys.argv[2], sys.argv[3]
MAX = int(sys.argv[4]) if len(sys.argv) > 4 else 10_000
VERBOSE = os.environ.get('V') == '1'
os.makedirs(CACHE, exist_ok=True)
# JOBS=fișier.json: altă listă de rețete ([{"id", "en", "prio"}]), de ex. clasicele de mic dejun fără poză
JOBS = json.load(open(os.environ['JOBS'])) if os.environ.get('JOBS') else None
META_P = os.path.join(HERE, 'photos_extra.json' if JOBS else 'ro_photos.json')
META = json.load(open(META_P)) if os.path.exists(META_P) else {}
OUT = os.path.join(CACHE, 'out')  # build_ro.py copiază în aplicație doar pozele verificate (ro_photos_ok.txt)
os.makedirs(OUT, exist_ok=True)
API = 'https://api.openverse.org/v1/images/'
LIC = 'by,by-sa,cc0,pdm,by-nc,by-nc-sa'  # fără ND: pozele sunt decupate
PX = 600

sys.path.insert(0, HERE)
from ro_src_read import read_src  # noqa: E402

SRC, EN = read_src()
if JOBS:
    SRC = {j['id']: ('MPGD'[j.get('prio', 0)], j['id'], []) for j in JOBS}
    EN = {j['id']: j['en'] for j in JOBS}
    cand = {j['id']: {} for j in JOBS}

tok = Tokenizer.from_file(f'{D}/tokenizer.json')
ts = ort.InferenceSession(f'{D}/text_model_quantized.onnx')
vs = ort.InferenceSession(f'{D}/vision_model_quantized.onnx')
MEAN = np.array([0.48145466, 0.4578275, 0.40821073], dtype=np.float32)
STD = np.array([0.26862954, 0.26130258, 0.27577711], dtype=np.float32)


def text(t):
    e = ts.run(['text_embeds'], {'input_ids': np.array([tok.encode(t).ids[:77]], dtype=np.int64)})[0][0]
    return e / np.linalg.norm(e)


def image(im):
    w, h = im.size
    s = min(w, h)
    im = im.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s)).resize((224, 224), Image.BICUBIC)
    a = ((np.asarray(im, dtype=np.float32) / 255 - MEAN) / STD).transpose(2, 0, 1)[None]
    e = vs.run(['image_embeds'], {'pixel_values': a})[0][0]
    return e / np.linalg.norm(e)


NEG = [text(t) for t in ('a vintage advertisement', 'a can or package of food', 'a restaurant menu or sign', 'people at a party', 'raw ingredients on a market stall',
                         'a page of a cookbook', 'an empty kitchen', 'a building or a street', 'a drawing or illustration', 'a screenshot of text',
                         'raw vegetables on a cutting board', 'a bowl of asian noodle soup with chopsticks', 'slices of toast or bread', 'dry beans or grains in a pot')]


class Limit(Exception):
    pass


LAST = [0.0]


def get(url, timeout=40):
    # Openverse: cel mult 20 de cereri pe minut, de orice fel
    w = LAST[0] + 3.4 - time.time()
    if w > 0:
        time.sleep(w)
    LAST[0] = time.time()
    # curl, ca în restul scripturilor (Openverse refuză clientul HTTP din Python)
    p = subprocess.run(['curl', '-sS', '-m', str(timeout), '-w', '\n%{http_code}', url], capture_output=True)
    body, _, code = p.stdout.rpartition(b'\n')
    if code == b'429':
        raise Limit(url)
    if code != b'200':
        raise RuntimeError(f'{code.decode()} {url}')
    return body


def search(q):
    p = os.path.join(CACHE, 's_' + re.sub(r'\W+', '_', q.lower())[:80] + '.json')
    if os.path.exists(p):
        return json.load(open(p))
    d = json.loads(get(API + '?' + urllib.parse.urlencode({'q': q, 'license': LIC, 'category': 'photograph', 'page_size': 20, 'mature': 'false'})))
    json.dump(d, open(p, 'w'))
    return d


def thumb(oid, full=False):
    p = os.path.join(CACHE, oid + ('_f' if full else '') + '.jpg')
    if not os.path.exists(p):
        open(p, 'wb').write(get(API + oid + '/thumb/' + ('?full_size=true' if full else '')))
    return Image.open(p).convert('RGB')


def rid(key):
    if JOBS:
        return key
    return ('ll_' if key[0] == 'l' else 'er_') + re.sub(r'[^a-z0-9]+', '_', key[1:])[:40].strip('_')


BAD_TITLE = re.compile(r'\b(ad|advert|vintage|menu|label|can|package|box|logo|poster|recipe card|sign)\b', re.I)

# prioritate: mâncărurile principale și micul dejun întâi; cele cu video au deja imagine (miniatura video)
order = sorted((k for k in SRC if k in cand and k not in META), key=lambda k: ({'P': 0, 'M': 1, 'G': 2, 'D': 3}[SRC[k][0]], k)) if not JOBS else [j['id'] for j in JOBS if j['id'] not in META]
done = 0
try:
    for k in order:
        if done >= MAX:
            break
        en = EN.get(k)
        if not en:
            print('fără nume englezesc:', k)
            continue
        c = cand[k]
        if c.get('video'):
            continue
        def ok(d):
            return [r for r in d.get('results', []) if not BAD_TITLE.search(r.get('title') or '') and (r.get('width') or 0) >= 400 and (r.get('height') or 0) >= 300]
        try:
            res = ok(search(en))
            short = re.split(r'\b(?:with|and|in|on)\b', en)[0].strip()
            if len(res) < 3 and short != en and len(short.split()) >= 1:
                res += [r for r in ok(search(short)) if r['id'] not in {x['id'] for x in res}]
        except RuntimeError as ex:  # Openverse a răspuns cu eroare: sar peste rețetă, o reiau data viitoare
            print('  eroare', ex)
            continue
        res = res[:5]
        T = text(f'a photo of {en}, a type of food')
        best = None
        for r in res:
            try:
                e = image(thumb(r['id']))
            except Limit:
                raise
            except Exception as ex:  # noqa: BLE001
                print('  miniatură lipsă', r['id'], ex)
                continue
            sims = np.array([e @ T] + [e @ n for n in NEG]) * 100
            pr = np.exp(sims - sims.max())
            pr = pr[0] / pr.sum()
            score = float(e @ T)
            VERBOSE and print(f'    {score:.3f} {pr:.2f} {(r.get("title") or "")[:50]}')
            if score > 0.26 and pr > 0.6 and (not best or score > best[0]):
                best = (score, r)
        if not best:
            META[k] = None
            print('—', k, en)
        else:
            score, r = best
            im = thumb(r['id'], full=True)
            s = min(im.size)
            im = im.crop(((im.width - s) // 2, (im.height - s) // 2, (im.width + s) // 2, (im.height + s) // 2)).resize((min(PX, s), min(PX, s)), Image.LANCZOS)
            im.save(os.path.join(OUT, rid(k) + '.webp'), 'WEBP', quality=72, method=6)
            META[k] = {'ov': r['id'], 'creator': r.get('creator') or '', 'license': r['license'], 'v': r.get('license_version') or '',
                       'src': r.get('source'), 'page': r.get('foreign_landing_url'), 'title': (r.get('title') or '')[:80], 'score': round(score, 3)}
            print('✓', k, en, '←', r.get('title', '')[:50], round(score, 3))
        done += 1
        json.dump(META, open(META_P, 'w'), ensure_ascii=False, indent=0)
except Limit as e:
    print('limita Openverse atinsă, reiau mai târziu:', e)
json.dump(META, open(META_P, 'w'), ensure_ascii=False, indent=0)
print('poze:', sum(1 for v in META.values() if v), '| fără:', sum(1 for v in META.values() if v is None))

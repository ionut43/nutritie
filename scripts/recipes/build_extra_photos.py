#!/usr/bin/env python3
"""
Poze Openverse (CC, verificate de mână) pentru rețetele clasice care n-aveau poză (mai ales micul dejun).
Citește photos_extra.json (scris de ro_photos.py cu JOBS=...), ro_photos_ok.txt / ro_photos_reject.txt,
copiază pozele aprobate în assets/food/r și scrie src/data/photos_extra.ts (poza + autorul și licența).

  RO_PHOTOS=<staging>/out python3 build_extra_photos.py
"""
import json
import os
import shutil

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
STAGE = os.environ.get('RO_PHOTOS', '/tmp/ro_photos/out')
LIC = {'by': 'CC BY', 'by-sa': 'CC BY-SA', 'cc0': 'CC0', 'pdm': 'domeniu public', 'by-nc': 'CC BY-NC', 'by-nc-sa': 'CC BY-NC-SA'}


def ids(name):
    p = os.path.join(HERE, name)
    return {l.split('#')[0].strip() for l in open(p)} - {''} if os.path.exists(p) else set()


META = json.load(open(os.path.join(HERE, 'photos_extra.json')))
OK, REJ = ids('ro_photos_ok.txt'), ids('ro_photos_reject.txt')
DST = os.path.join(ROOT, 'assets', 'food', 'r')
out = {}
for rid, p in sorted(META.items()):
    dst = os.path.join(DST, rid + '.webp')
    if not p or rid not in OK or rid in REJ:
        if os.path.exists(dst) and rid in REJ:
            os.remove(dst)
        continue
    src = os.path.join(STAGE, rid + '.webp')
    if os.path.exists(src):
        shutil.copyfile(src, dst)
    if not os.path.exists(dst):
        continue
    who = p['creator'] or 'autor necunoscut'
    out[rid] = {'img': p['page'] or 'openverse', 'credit': f"{who}, {LIC.get(p['license'], p['license'].upper())} {p['v']}".strip() + ' (Openverse)'}

with open(os.path.join(ROOT, 'src', 'data', 'photos_extra.ts'), 'w') as f:
    f.write('// Generat de scripts/recipes/build_extra_photos.py. Nu edita de mână.\n/* eslint-disable */\n')
    f.write('export const EXTRA_PHOTO: Record<string, number> = {\n')
    for rid in out:
        f.write(f"  {json.dumps(rid)}: require('../../assets/food/r/{rid}.webp'),\n")
    f.write('};\n')
# separat: rețetele îl citesc și în teste (Node nu poate încărca .webp)
with open(os.path.join(ROOT, 'src', 'data', 'photos_extra_credit.ts'), 'w') as f:
    f.write('// Generat de scripts/recipes/build_extra_photos.py. Nu edita de mână.\n')
    f.write('/** poza (pagina de pe Openverse) și autorul ei, pentru rețetele clasice */\n')
    f.write('export const EXTRA_CREDIT: Record<string, { img: string; credit: string }> = {\n')
    for rid, c in out.items():
        f.write(f'  {json.dumps(rid)}: {json.dumps(c, ensure_ascii=False)},\n')
    f.write('};\n')
print('poze clasice:', len(out))

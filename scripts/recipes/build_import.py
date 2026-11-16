#!/usr/bin/env python3
"""
Rețetele importate (TheMealDB + UniTools), cu text românesc scris de mână în scripts/recipes/ro/*.txt.

  python3 scripts/recipes/candidates.py ...            -> cand.json
  python3 -I scripts/recipes/build_import.py cand.json data.json cache_dir ing.json

- doar candidații cu toate ingredientele mapate ȘI cu o linie în ro/*.txt (cele banale lipsesc intenționat)
- poza: pătrat, 360 px, WebP, în assets/food/r/<id>.webp
- scrie src/data/retete/importate.ts și src/data/photos_import.ts
"""
import io
import json
import os
import re
import sys
import urllib.request

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
cand = json.load(open(sys.argv[1]))
data = json.load(open(sys.argv[2]))
CACHE = sys.argv[3] if len(sys.argv) > 3 else os.path.join(os.path.dirname(sys.argv[1]), 'imp_cache')
KCAL = {i['id']: i['kcal'] for i in json.load(open(sys.argv[4]))} if len(sys.argv) > 4 else {}
PX = 600  # pe pagina rețetei poza ocupă toată lățimea; 360 era neclar
TARGET = {'principal': 800, 'mic_dejun': 650, 'gustare': 500}
os.makedirs(CACHE, exist_ok=True)
OUT_R = os.path.join(ROOT, 'assets', 'food', 'r')

# ── textul românesc ──
RO = {}
rodir = os.path.join(ROOT, 'scripts', 'recipes', 'ro')
for fn in sorted(os.listdir(rodir)):
    for line in open(os.path.join(rodir, fn), encoding='utf-8'):
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        p = line.split('|')
        assert len(p) >= 4, line
        RO[p[0]] = (p[1].strip(), [s.strip() for s in p[2:] if s.strip()])

# duplicate între surse: păstrez varianta TheMealDB
DROP = {'uwaterzooi', 'uropa-vieja', 'upastel-de-choclo'}

base = [r for r in data['recipes'] if not r['id'].startswith(('mdb_', 'ut_'))]  # fără importurile de data trecută
existing_en = {re.sub(r'[^a-z]', '', (r.get('en') or '').lower()) for r in base}
existing_ids = {r['id'] for r in base}

by_key = {c['key']: c for c in cand if not c['miss']}
unknown = [k for k in RO if k not in by_key]
if unknown:
    print('chei necunoscute în ro/:', unknown)


def rid(key):
    return ('mdb_' + key[1:]) if key[0] == 'm' else ('ut_' + key[1:].replace('-', '_'))


def keeps(c, steps):
    cat = c['cat'].lower()
    txt = ' '.join(steps).lower()
    if cat in ('breakfast',):
        return 0
    if cat in ('salad', 'snack', 'starter') or 'prăjește' in txt and cat != 'dessert':
        return 1
    if cat in ('soup',) or 'fierbe' in txt and c['prep'] >= 60:
        return 3
    if cat in ('dessert', 'pastry'):
        return 3
    return 2


CARBS = {'cartofi', 'orez', 'paste', 'paine', 'paine_integrala', 'taitei', 'taitei_orez', 'malai', 'cuscus', 'bulgur', 'tortilla',
         'bagheta', 'pita', 'quinoa', 'cartofi_dulci', 'foietaj', 'faina'}
# ce scrie la „servește cu …” → ce adaug în listă și în calorii, pe porție
SIDES = [
    (r'\borez\b', 'orez', 75, 'Garnitura: fierbe orezul (75 g de porție) cât se gătește restul.'),
    (r'\bpiure\b', 'cartofi', 250, 'Garnitura: fierbe cartofii (250 g de porție) și fă-i piure cu puțin lapte și unt.'),
    (r'\bcartof', 'cartofi', 250, 'Garnitura: fierbe sau coace cartofii (250 g de porție).'),
    (r'\bmămăligă\b', 'malai', 60, 'Garnitura: fă mămăliga (60 g mălai de porție).'),
    (r'\b(pâine|baghetă|lipie)\b', 'paine', 80, 'Garnitura: pâine, cam 80 g de porție.'),
]


def garnish(meal, steps, ing):
    """Rețeta zice „servește cu orez/cartofi…”, dar n-are garnitura în ingrediente: o adaug, ca să fie în listă și în calorii."""
    if 'principal' not in meal:
        return None
    have = {k for k, _ in ing}
    m = re.search(r'[Ss]ervește[^.]*?\bcu ([^.]*)', ' '.join(steps))
    if not m:
        return None
    for pat, sid, g, step in SIDES:
        if re.search(pat, m.group(1)) and sid not in have and not (sid == 'paine' and have & {'bagheta', 'pita', 'tortilla'}):
            if have & CARBS - {'faina'} and sid != 'orez':
                return None  # are deja o garnitură consistentă
            return sid, g, step
    return None


def fetch(url, key):
    path = os.path.join(CACHE, key + '.img')
    if not os.path.exists(path):
        req = urllib.request.Request(url, headers={'User-Agent': 'nutritie-build/1.0'})
        with urllib.request.urlopen(req, timeout=40) as r:
            b = r.read()
        open(path, 'wb').write(b)
    return Image.open(path).convert('RGB')


out = []
skipped_dup = []
for key, (name, steps) in RO.items():
    c = by_key.get(key)
    if not c or key in DROP:
        continue
    enk = re.sub(r'[^a-z]', '', c['en'].lower())
    if enk in existing_en:
        skipped_dup.append(c['en'])
        continue
    i = rid(key)
    assert i not in existing_ids, i
    dst = os.path.join(OUT_R, i + '.webp')
    if not os.path.exists(dst) or Image.open(dst).width < PX:
        try:
            im = fetch(c['img'], key)
        except Exception as e:  # noqa: BLE001
            print('poză lipsă', key, e)
            continue
        s = min(im.size)
        im = im.crop(((im.width - s) // 2, (im.height - s) // 2, (im.width + s) // 2, (im.height + s) // 2))
        im = im.resize((min(PX, s), min(PX, s)), Image.LANCZOS)
        im.save(dst, 'WEBP', quality=72, method=6)
    txt = ' '.join(steps).lower()
    oven = c['oven'] or 'cuptor' in txt or '°c' in txt
    stove = any(w in txt for w in ('fierbe', 'prăjește', 'călește', 'tigaie', 'rumenește', 'gătește', 'abur', 'oală'))
    eq = [['plita'], ['cuptor']] if oven and stove else [['cuptor']] if oven else [['plita']] if stove else []
    if 'fierul de vafe' in txt:
        eq = [['plita']]  # fierul de vafe nu e în listă; tigaia merge
    ing = [[k, max(1, round(v))] for k, v in sorted(c['ing'].items(), key=lambda kv: -kv[1])]
    kd = keeps(c, steps)
    serv = c['serv']
    if KCAL:
        tot = sum(KCAL.get(k, 0) * g / 100 for k, g in ing)
        lim = min(TARGET[m] for m in c['meal'])
        if tot / serv > lim:
            serv = min(12, -(-int(tot) // lim))
    # uleiul de prăjit sau de marinat nu se mănâncă tot: număr cel mult 20 g de porție
    ing = [[k, min(g, 20 * serv)] if k in ('ulei', 'ulei_masline', 'untura') else [k, g] for k, g in ing]
    meal = list(c['meal'])
    if c['cat'].lower() == 'starter' and meal == ['principal']:
        meal = ['gustare']  # aperitivele nu devin masă principală
    side = garnish(meal, steps, ing)
    if side:
        sid, g, step = side
        ing.append([sid, g * serv])
        steps = [step] + list(steps)
    r = {
        'id': i, 'name': name, 'en': c['en'], 'meal': meal, 'cuisine': c['cuisine'],
        'servings': serv, 'prep': max(15, int(c['prep'])), 'equipment': eq, 'keepsDays': kd,
        'ing': ing, 'steps': steps, 'img': c['img'],
        'credit': 'TheMealDB' if c['src'] == 'm' else ('UniTools · ' + (c.get('credit') or '')).strip(' ·'),
    }
    if c['cat'].lower() in ('soup',) or (kd >= 3 and c['cat'].lower() == 'main'):
        r['freezable'] = True
    if c['cat'].lower() == 'dessert':
        r['tags'] = ['desert']
    out.append(r)

print('importate:', len(out), '| deja existente după nume:', len(skipped_dup), skipped_dup[:20])

with open(os.path.join(ROOT, 'src', 'data', 'retete', 'importate.ts'), 'w', encoding='utf-8') as f:
    f.write('// Generat de scripts/recipes/build_import.py din TheMealDB și UniTools, cu textul din scripts/recipes/ro.\n')
    f.write('/* eslint-disable */\nimport type { Recipe } from \'../../logic/types\';\n\n')
    f.write('export const IMPORTATE: Recipe[] = ')
    f.write(json.dumps(out, ensure_ascii=False, indent=0).replace('\n', ''))
    f.write(' as Recipe[];\n')

with open(os.path.join(ROOT, 'src', 'data', 'photos_import.ts'), 'w') as f:
    f.write('// Generat de scripts/recipes/build_import.py. Nu edita de mână.\n/* eslint-disable */\n')
    f.write('export const IMPORT_PHOTO: Record<string, number> = {\n')
    for r in out:
        f.write(f"  {json.dumps(r['id'])}: require('../../assets/food/r/{r['id']}.webp'),\n")
    f.write('};\n')

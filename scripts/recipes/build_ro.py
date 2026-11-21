#!/usr/bin/env python3
"""
Rețetele de pe site-uri românești (Laura Laurențiu, e-retete.ro) -> src/data/retete/romanesti.ts și src/data/photos_ro.ts

  python3 -I scripts/recipes/build_ro.py <ro_cand.json> <ing.json> <data.json>

- de pe site iau doar numele felului, ingredientele cu cantitățile, porțiile, timpul, adresa și video-ul de YouTube
- pașii îi scriu eu, pe scurt (scripts/recipes/ro_src/*.txt); rețeta completă rămâne la sursă, cu link
- poza: video-ul rețetei (miniatura YouTube, încărcată în aplicație) sau o fotografie cu licență liberă de pe Openverse
  (ro_photos.py); pozele site-urilor nu le folosesc
"""
import json
import os
import re
import sys
import unicodedata

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from origin import EXOTIC, ingredient_familiar  # noqa: E402
from ro_src_read import read_src  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
cand = {c['key']: c for c in json.load(open(sys.argv[1]))}
KCAL = {i['id']: i['kcal'] for i in json.load(open(sys.argv[2]))}
data = json.load(open(sys.argv[3]))
STAGE = os.environ.get('RO_PHOTOS', '/tmp/ro_photos/out')  # unde a pus ro_photos.py pozele găsite
OK = {l.split('#')[0].strip() for l in open(os.path.join(HERE, 'ro_photos_ok.txt'))} - {''} if os.path.exists(os.path.join(HERE, 'ro_photos_ok.txt')) else set()
REJ = {l.split('#')[0].strip() for l in open(os.path.join(HERE, 'ro_photos_reject.txt'))} - {''} if os.path.exists(os.path.join(HERE, 'ro_photos_reject.txt')) else set()
PH = json.load(open(os.path.join(HERE, 'ro_photos.json'))) if os.path.exists(os.path.join(HERE, 'ro_photos.json')) else {}
SRC, EN = read_src()
TARGET = {'principal': 800, 'mic_dejun': 650, 'gustare': 500}
MEAL = {'P': ['principal'], 'M': ['mic_dejun'], 'G': ['gustare'], 'D': ['gustare']}
LIC = {'by': 'CC BY', 'by-sa': 'CC BY-SA', 'cc0': 'CC0', 'pdm': 'domeniu public', 'by-nc': 'CC BY-NC', 'by-nc-sa': 'CC BY-NC-SA'}


def plain(s):
    return re.sub(r'[^a-z]', '', unicodedata.normalize('NFKD', s.lower()).encode('ascii', 'ignore').decode())


base = [r for r in data['recipes'] if not r['id'].startswith(('ll_', 'er_'))]
existing = {plain(r['name']) for r in base} | {plain(r.get('en') or '') for r in base}


def rid(key):
    return ('ll_' if key[0] == 'l' else 'er_') + re.sub(r'[^a-z0-9]+', '_', key[1:])[:40].strip('_')


CUIS = [
    (r'curry|tikka|masala|dal\b|biryani|tandoori|naan', 'in'),
    (r'chili con carne|taco|burrito|quesadilla|fajita|nacho|guacamole|enchilada', 'mx'),
    (r'\bwok\b|teriyaki|pad thai|ramen|kimchi|bulgogi|sushi|sos de soia|asiatic|chinezesc|thai|japonez|coreean|vietnam', 'as'),
    (r'paste|pizza|risotto|lasagn|carbonara|bruschet|pappardelle|tiramisu|osso|focaccia|gnocchi|spaghet|penne|tagliatel|parmigiana|panna cotta|frittata', 'it'),
    (r'hummus|falafel|shakshuka|baba ganoush|tabouleh|maakouda|tunisian|marocan|libanez|turcesc|kebab', 'or'),
    (r'souvlaki|grecesc|grec\b|greceasc|tzatziki|feta|spaniol|paella|gazpacho|mediteran', 'med'),
    (r'burger|brownie|cheesecake|pancake|muffin|bbq|coleslaw|cookie|american', 'us'),
]
RO_WORDS = re.compile(r'ciorb|sarma|tochitur|mămălig|zacusc|cozonac|papana|\bmici\b|drob|boeuf|ostropel|tocăn|varză|fasole|iahnie|musaca|chiftel|pârjoal|plăcint|'
                      r'supă|friptur|ciulama|pilaf|ardei umpluț|găluște|tărhană|păturată|gogoș|clătit|salată de vinete|salată orientală|cartofi|mazăre|'
                      r'pui|porc|vită|ou[ăa]|omletă|brânz|telemea|smântân|miel|berbec|rață|gâscă|curcan|pește|crap|păstrăv|șnițel|pastramă|cârnaț|'
                      r'prăjitur|chec|negres|savarin|ecler|tort|budinc|griș|orez cu lapte|lapte|mere|prune|vișine|cireșe|nucă|ciuperc|dovlec|vinete|conopid|broccoli', re.I)


def cuisine(name, en, src):
    t = (name + ' ' + en).lower()
    for pat, c in CUIS:
        if re.search(pat, t):
            return c
    if src.startswith('Laura') or RO_WORDS.search(name):
        return 'ro'
    return 'eu'


FAM = {'ro': 1.0, 'it': 0.9, 'eu': 0.85, 'med': 0.8, 'us': 0.65, 'mx': 0.55, 'or': 0.55, 'as': 0.45, 'in': 0.45}

CARBS = {'cartofi', 'orez', 'paste', 'paine', 'paine_integrala', 'taitei', 'taitei_orez', 'malai', 'cuscus', 'bulgur', 'tortilla',
         'bagheta', 'pita', 'quinoa', 'cartofi_dulci', 'foietaj', 'faina', 'gris', 'fasole_conserva', 'fasole_rosie', 'linte_verde', 'naut'}
SIDES = [
    (r'\borez\b', 'orez', 75, 'Garnitura: fierbe orezul (75 g de porție) cât se gătește restul.'),
    (r'\bpiure\b', 'cartofi', 250, 'Garnitura: fierbe cartofii (250 g de porție) și fă-i piure cu puțin lapte și unt.'),
    (r'\bcartof', 'cartofi', 250, 'Garnitura: fierbe sau coace cartofii (250 g de porție).'),
    (r'\bmămăligă\b', 'malai', 60, 'Garnitura: fă mămăliga (60 g mălai de porție).'),
    (r'\b(pâine|baghetă|lipie)\b', 'paine', 80, 'Garnitura: pâine, cam 80 g de porție.'),
]


def garnish(meal, steps, ing):
    if 'principal' not in meal:
        return None
    have = {k for k, _ in ing}
    m = re.search(r'[Ss]ervește[^.]*?\bcu ([^.]*)', ' '.join(steps))
    if not m:
        return None
    for pat, sid, g, step in SIDES:
        if re.search(pat, m.group(1)) and sid not in have and not (sid == 'paine' and have & {'bagheta', 'pita', 'tortilla'}):
            if have & CARBS - {'faina'} and sid != 'orez':
                return None
            return sid, g, step
    return None


def equipment(txt):
    eq = []
    if 'air fryer' in txt:
        eq.append(['airfryer', 'cuptor'])
    elif 'cuptor' in txt or '°c' in txt or 'coace' in txt:
        eq.append(['cuptor'])
    if 'grătar' in txt:
        eq.append(['grill', 'plita'])
    elif any(w in txt for w in ('fierbe', 'prăjește', 'călește', 'tigaie', 'rumenește', 'gătește', 'abur', 'oală', 'oparește', 'opărește', 'sotează', 'topește', 'încălzește', 'caramelizează')):
        eq.append(['plita'])
    if any(w in txt for w in ('pasează', 'mixează', 'blender')):
        eq.append(['blender', 'robot'])
    return eq


def keeps(fel, txt, soup):
    if fel == 'M':
        return 0
    if soup or fel == 'D':
        return 3
    if fel == 'G' or 'prăjește' in txt or 'air fryer' in txt:
        return 1
    return 2


SOUP = re.compile(r'^(Ciorb|Sup[ăa] |Borș|Bors|Zeam)')
# în aplicație intră doar pozele verificate cu ochii (ro_photos_ok.txt); restul așteaptă în STAGE
import shutil  # noqa: E402
AR = os.path.join(ROOT, 'assets', 'food', 'r')
os.makedirs(STAGE, exist_ok=True)
for f in os.listdir(AR):
    if f.startswith(('ll_', 'er_')) and f.endswith('.webp'):
        shutil.move(os.path.join(AR, f), os.path.join(STAGE, f))
for k in OK - REJ:
    f = os.path.join(STAGE, rid(k) + '.webp')
    if os.path.exists(f):
        shutil.copy(f, os.path.join(AR, rid(k) + '.webp'))
out, dup, missing, review = [], [], [], []
for key, (fel, name, steps) in SRC.items():
    c = cand.get(key)
    if not c or c['miss']:
        missing.append(key)
        continue
    en = EN.get(key)
    if not en:
        missing.append(key + ' (fără en)')
        continue
    if plain(name) in existing or plain(en) in existing:
        dup.append(name)
        continue
    existing.add(plain(name))
    meal = MEAL[fel]
    txt = ' '.join(steps).lower()
    soup = bool(SOUP.match(name))
    ing = [[k, max(1, round(v))] for k, v in sorted(c['ing'].items(), key=lambda kv: -kv[1]) if k in KCAL]
    serv = max(1, c['serv'])
    tot = sum(KCAL[k] * g / 100 for k, g in ing)
    lim = TARGET[meal[0]]
    if tot / serv > lim:
        serv = min(16, -(-int(tot) // lim))
    elif soup and serv > 1 and tot / serv < 230:
        serv = max(1, int(tot // 260))  # o supă de legume ca fel de mâncare: un castron mare
    elif fel == 'P' and not soup and serv > 1 and tot / serv < 350:
        serv = max(1, round(tot / 450))  # porțiile site-ului sunt mici pentru o masă
    elif serv > 1 and tot / serv < {'M': 250, 'G': 120, 'D': 150}.get(fel, 0):
        # „24 de clătite mici”: o porție e o farfurie, nu o bucată
        serv = max(1, round(tot / {'M': 400, 'G': 250, 'D': 280}[fel]))
    ing = [[k, min(g, 20 * serv)] if k in ('ulei', 'ulei_masline', 'untura') else [k, g] for k, g in ing]
    side = garnish(meal, steps, ing)
    if side:
        sid, g, step = side
        ing.append([sid, g * serv])
        steps = [step] + list(steps)
    cu = cuisine(name, en, c['src'])
    fam = max(FAM[cu], ingredient_familiar(ing) or 0) if cu in ('ro', 'eu', 'it') else FAM[cu]
    if fel == 'P':
        fam -= sum(v for k, v in EXOTIC.items() if any(k == x for x, _ in ing))
    r = {
        'id': rid(key), 'name': name, 'en': en, 'meal': meal, 'cuisine': cu,
        'servings': serv, 'prep': max(15, min(300, int(c['prep'] or 40))), 'equipment': equipment(txt), 'keepsDays': keeps(fel, txt, soup),
        'ing': ing, 'steps': steps,
    }
    if soup:
        r['freezable'] = True
    if fel == 'D':
        r['tags'] = ['desert']
    r['familiar'] = round(max(0.15, min(1.0, fam)), 2)
    if c.get('video'):
        r['video'] = c['video']
    p = PH.get(key) if key in OK and key not in REJ else None
    if p and os.path.exists(os.path.join(ROOT, 'assets', 'food', 'r', r['id'] + '.webp')):
        r['img'] = p['page'] or 'openverse'
        who = p['creator'] or 'autor necunoscut'
        r['credit'] = f"{who}, {LIC.get(p['license'], p['license'].upper())} {p['v']}".strip() + ' (Openverse)'
    r['source'] = {'name': c['src'], 'url': c['url']}
    kc = sum(KCAL[k] * g / 100 for k, g in ing) / serv
    review.append((round(kc), serv, fel, name, ', '.join(f'{k} {g}' for k, g in ing[:6])))
    out.append(r)

print(f'românești: {len(out)} | duplicate: {len(dup)} {dup[:15]} | fără date: {missing[:20]}')
print(f"cu poză: {sum(1 for r in out if r.get('img'))} | cu video: {sum(1 for r in out if r.get('video'))} | fără imagine: {sum(1 for r in out if not r.get('img') and not r.get('video'))}")
if os.environ.get('V') == '1':
    for x in sorted(review):
        print(*x, sep=' | ')

with open(os.path.join(ROOT, 'src', 'data', 'retete', 'romanesti.ts'), 'w', encoding='utf-8') as f:
    f.write('// Generat de scripts/recipes/build_ro.py. Ingredientele după Laura Laurențiu și e-retete.ro (cu link la sursă); pașii sunt scriși de noi.\n')
    f.write('/* eslint-disable */\nimport type { Recipe } from \'../../logic/types\';\n\n')
    f.write('export const ROMANESTI: Recipe[] = ')
    f.write(json.dumps(out, ensure_ascii=False, indent=0).replace('\n', ''))
    f.write(' as Recipe[];\n')

with open(os.path.join(ROOT, 'src', 'data', 'photos_ro.ts'), 'w') as f:
    f.write('// Generat de scripts/recipes/build_ro.py. Nu edita de mână.\n/* eslint-disable */\n')
    f.write('export const RO_PHOTO: Record<string, number> = {\n')
    for r in out:
        if r.get('img'):
            f.write(f"  {json.dumps(r['id'])}: require('../../assets/food/r/{r['id']}.webp'),\n")
    f.write('};\n')

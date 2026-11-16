#!/usr/bin/env python3
"""
Rețetele candidate din TheMealDB și UniTools, cu ingredientele traduse în id-urile noastre și gramaj.
  python3 scripts/recipes/candidates.py <mealdb all.json> <unitools json> <ingredients.json> > candidates.json
"""
import json, re, sys, os, unicodedata, glob
sys.path.insert(0, os.path.dirname(__file__))
from ingmap import map_ing
from amounts import grams

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
meals = json.load(open(sys.argv[1]))
uni = json.load(open(sys.argv[2]))['recipes']
ING = {i['id']: i for i in json.load(open(sys.argv[3]))}
used = set(re.findall(r"'(\d{5})'", open(os.path.join(ROOT, 'src/data/mealdb_ids.ts')).read()))
norm = lambda s: unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
existing = norm(' '.join(open(f).read() for f in glob.glob(os.path.join(ROOT, 'src/data/retete/*.ts')) if not f.endswith('importate.ts')))

AREA = {
    'Italian': 'it', 'Greek': 'med', 'Spanish': 'med', 'Portuguese': 'med', 'Croatian': 'med',
    'Turkish': 'or', 'Moroccan': 'or', 'Egyptian': 'or', 'Tunisian': 'or', 'Algerian': 'or', 'Syrian': 'or', 'Saudi Arabian': 'or', 'Lebanese': 'or', 'Kenyan': 'or',
    'Chinese': 'as', 'Japanese': 'as', 'Thai': 'as', 'Vietnamese': 'as', 'Malaysian': 'as', 'Filipino': 'as', 'Indonesian': 'as', 'Korean': 'as',
    'Indian': 'in', 'India': 'in', 'Mexican': 'mx', 'Venezuela': 'mx', 'Argentina': 'mx', 'Uruguayan': 'mx', 'Jamaican': 'mx',
    'American': 'us', 'United States': 'us', 'Canadian': 'us', 'Australian': 'us',
}
CC = {  # UniTools: țara -> bucătăria noastră
    'RO': 'ro', 'MD': 'ro', 'IT': 'it', 'GR': 'med', 'ES': 'med', 'PT': 'med', 'HR': 'med', 'CY': 'med', 'MT': 'med', 'AL': 'med', 'ME': 'med',
    'TR': 'or', 'MA': 'or', 'EG': 'or', 'TN': 'or', 'DZ': 'or', 'SY': 'or', 'LB': 'or', 'IL': 'or', 'JO': 'or', 'IR': 'or', 'IQ': 'or', 'SA': 'or', 'AE': 'or', 'YE': 'or', 'AM': 'or', 'GE': 'or', 'AZ': 'or',
    'ET': 'or', 'KE': 'or', 'NG': 'or', 'SN': 'or', 'GH': 'or', 'ZA': 'or', 'TZ': 'or', 'CM': 'or', 'CI': 'or', 'ML': 'or', 'SD': 'or', 'SO': 'or', 'UG': 'or', 'ZW': 'or',
    'CN': 'as', 'JP': 'as', 'KR': 'as', 'TH': 'as', 'VN': 'as', 'MY': 'as', 'SG': 'as', 'ID': 'as', 'PH': 'as', 'KH': 'as', 'LA': 'as', 'MM': 'as', 'TW': 'as', 'HK': 'as', 'MN': 'as', 'KZ': 'as', 'UZ': 'as', 'KG': 'as', 'TJ': 'as',
    'IN': 'in', 'PK': 'in', 'BD': 'in', 'LK': 'in', 'NP': 'in', 'AF': 'in',
    'MX': 'mx', 'GT': 'mx', 'CU': 'mx', 'JM': 'mx', 'PE': 'mx', 'BR': 'mx', 'AR': 'mx', 'CL': 'mx', 'CO': 'mx', 'VE': 'mx', 'UY': 'mx', 'BO': 'mx', 'EC': 'mx', 'PR': 'mx', 'DO': 'mx', 'HT': 'mx', 'TT': 'mx', 'PA': 'mx', 'CR': 'mx', 'SV': 'mx', 'HN': 'mx', 'NI': 'mx', 'PY': 'mx',
    'US': 'us', 'CA': 'us', 'AU': 'us', 'NZ': 'us',
}

def finish(items):
    """[(nume, grame)] -> ingrediente mapate, ce lipsește, total"""
    ing, miss = {}, []
    for name, g in items:
        if g is None: g = 10
        iid, ok = map_ing(name)
        if not ok:
            if g >= 15: miss.append(f'{name}:{round(g)}')
            continue
        if iid is None or iid not in ING: continue
        ing[iid] = ing.get(iid, 0) + g
    # bază de supă: „600 ml stock” = 1–2 cuburi, nu 600 g de cub
    if ing.get('cub_supa', 0) > 30: ing['cub_supa'] = max(5, ing['cub_supa'] / 50)
    # ulei de prăjit: rămâne în mâncare doar o parte
    for o in ('ulei', 'ulei_masline'):
        if ing.get(o, 0) > 150: ing[o] = 80
    if ing.get('sare', 0) > 12: ing['sare'] = 12
    for sp in ('piper', 'boia', 'boia_iute', 'chimen', 'scortisoara', 'nucsoara', 'garam_masala', 'curry', 'oregano', 'cimbru', 'foi_dafin', 'coriandru_macinat', 'turmeric', 'chili', 'vanilie'):
        if ing.get(sp, 0) > 20: ing[sp] = 10
    ing = {k: max(1, round(v)) for k, v in ing.items()}
    kcal = sum(ING[k]['kcal'] * v / 100 for k, v in ing.items())
    return ing, miss, kcal

def oven(text):
    t = text.lower()
    return any(w in t for w in ('oven', 'bake', 'roast', 'grill', 'broil'))

def minutes(text):
    t = text.lower()
    mins = [int(x) for x in re.findall(r'(\d+)\s*(?:-\s*\d+\s*)?min', t)]
    hrs = [float(x) for x in re.findall(r'(\d+(?:\.\d+)?)\s*(?:-\s*\d+\s*)?hour', t)]
    total = sum(mins) + sum(h * 60 for h in hrs)
    return int(min(240, max(20, total + 15)))

out = []
for m in meals:
    if m['idMeal'] in used or m['strCategory'] in ('Side',): continue
    if norm(m['strMeal']) in existing: continue
    items = []
    for i in range(1, 21):
        n = (m.get(f'strIngredient{i}') or '').strip()
        if n: items.append((n, grams((m.get(f'strMeasure{i}') or '').strip(), n)))
    ing, miss, kcal = finish(items)
    cat = m['strCategory']
    meal = ['gustare'] if cat in ('Dessert', 'Starter') else ['mic_dejun'] if cat == 'Breakfast' else ['principal']
    serv = max(4, min(12, round(kcal / 350))) if cat == 'Dessert' else max(2, min(6, round(kcal / 650))) if kcal else 4
    out.append({'src': 'm', 'key': 'm' + m['idMeal'], 'en': m['strMeal'], 'cat': cat, 'area': m['strArea'], 'cuisine': AREA.get(m['strArea'] or '', 'eu'),
                'meal': meal, 'serv': serv, 'prep': minutes(m['strInstructions'] or ''), 'oven': oven(m['strInstructions'] or ''),
                'ing': ing, 'miss': miss, 'kcalServ': round(kcal / serv) if serv else 0, 'img': m['strMealThumb'], 'n': len(items),
                'text': (m['strInstructions'] or '')[:700]})

UCAT = {'main': ['principal'], 'soup': ['principal'], 'salad': ['principal'], 'breakfast': ['mic_dejun'], 'dessert': ['gustare'], 'snack': ['gustare'], 'pastry': ['gustare'], 'bread': None, 'side': None, 'drink': None, 'sauce': None}
for r in uni:
    if not r.get('photo'): continue
    if norm(r['name']['en']) in existing or norm(r.get('nativeName') or '-') in existing: continue
    meal = UCAT.get(r['category'], ['principal'])
    if meal is None: continue
    items = []
    for x in r['ingredients']:
        q, u = x.get('quantity'), (x.get('unit') or '')
        meas = f'{q} {u}' if q is not None else u
        items.append((x['name']['en'], grams(meas, x['name']['en'])))
    ing, miss, kcal = finish(items)
    out.append({'src': 'u', 'key': 'u' + r['slug'], 'en': r['name']['en'], 'native': r.get('nativeName'), 'cat': r['category'], 'area': r['country'],
                'cuisine': CC.get(r['country'], 'eu'), 'meal': meal, 'serv': r['baseServings'], 'prep': r['prepMinutes'] + r['cookMinutes'],
                'oven': oven(' '.join(s['text']['en'] for s in r['steps'])), 'ing': ing, 'miss': miss,
                'kcalServ': round(kcal / r['baseServings']), 'kcalSrc': r['nutritionPerServing']['calories'], 'img': r['photo']['url'],
                'credit': f"{r['photo']['author']}, {r['photo']['license']}", 'n': len(r['ingredients']),
                'text': ' '.join(s['text']['en'] for s in r['steps'])[:700]})
# sănătate: ce iese absurd pe porție (gramaje citite greșit) nu intră
def sane(x):
    k = x['kcalServ']
    if x['meal'] == ['gustare']: return 80 <= k <= 750
    return 150 <= k <= 1300
out = [x for x in out if sane(x)]
json.dump(out, sys.stdout, ensure_ascii=False)

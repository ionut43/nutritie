#!/usr/bin/env python3
"""
Candidați din site-uri românești (Laura Laurențiu, e-retete.ro), din datele structurate descărcate de crawl.py.
Păstrez doar informațiile: numele felului, ingredientele cu cantitățile, porțiile, timpul, video-ul și adresa paginii.
  python3 -I ro_candidates.py <crawl_dir> <ing.json> > ro_cand.json
"""
import collections
import html
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ro_ing import norm, parse  # noqa: E402

CR, ING = sys.argv[1], {i['id']: i for i in json.load(open(sys.argv[2]))}
rows = []
for f, src in (('ll.jsonl', 'Laura Laurențiu'), ('er.jsonl', 'e-retete.ro')):
    p = os.path.join(CR, f)
    if os.path.exists(p):
        rows += [dict(json.loads(l), src=src) for l in open(p, encoding='utf-8') if l.strip()]
# video-urile care apar pe multe pagini sunt ale site-ului, nu ale rețetei
ytc = collections.Counter(y for r in rows for y in set(r.get('yt') or []))
SITEWIDE = {y for y, n in ytc.items() if n > 3}


def minutes(iso):
    m = re.match(r'P(?:\d+D)?T?(?:(\d+)H)?(?:(\d+)M)?', iso or '')
    return (int(m.group(1) or 0) * 60 + int(m.group(2) or 0)) if m else 0


def servings(y):
    y = ' '.join(y) if isinstance(y, list) else str(y or '')
    n = [float(x) for x in re.findall(r'\d+(?:[.,]\d+)?', y.replace(',', '.'))]
    if not n:
        return 4, False
    v = sum(n[:2]) / len(n[:2])
    pieces = bool(re.search(r'buc|felii|bucati|biscui|fursec|briose|chifl|clatite|tarte|negrese', norm(y)))
    return max(1, round(v)), pieces


def cat_of(r):
    u = r['url']
    m = re.search(r'/retete-culinare/([^/]+)/', u)
    if m:
        return m.group(1)
    name = norm(r['recipe'].get('name') or '')
    for k, c in (('ciorba', 'supe-ciorbe'), ('supa', 'supe-ciorbe'), ('bors', 'supe-ciorbe'), ('salata', 'retete-de-salate'), ('tort', 'prajituri-torturi'),
                 ('prajitura', 'prajituri-torturi'), ('negresa', 'prajituri-torturi'), ('placinta', 'patiserie'), ('cozonac', 'patiserie'), ('paine', 'retete-paine'),
                 ('biscuiti', 'deserturi-dulciuri-de-casa'), ('fursecuri', 'deserturi-dulciuri-de-casa'), ('briose', 'deserturi-dulciuri-de-casa'), ('clatite', 'mic-dejun'),
                 ('omleta', 'mic-dejun'), ('oua', 'mic-dejun'), ('smoothie', 'bauturi'), ('limonada', 'bauturi'), ('ceai', 'bauturi'), ('cocktail', 'bauturi'),
                 ('dulceata', 'conserve'), ('zacusca', 'conserve'), ('muraturi', 'conserve'), ('sos', 'sosuri'), ('paste', 'retete-cu-paste'), ('spaghete', 'retete-cu-paste')):
        if re.search(r'\b' + k, name):
            return c
    return 'retete-mancare'


out = []
seen = set()
for r in rows:
    rec = r.get('recipe')
    if not rec or not rec.get('recipeIngredient'):
        continue
    name = html.unescape(rec.get('name') or '').strip()
    key = ('l' if r['src'].startswith('Laura') else 'e') + re.sub(r'\W+', '-', r['url'].rstrip('/').split('/')[-1].replace('.html', ''))[:60]
    if key in seen:
        continue
    seen.add(key)
    ing, miss, unk = collections.defaultdict(float), [], []
    for line in dict.fromkeys(html.unescape(str(x)).strip() for x in rec['recipeIngredient']):  # unele pagini repetă liniile
        if re.match(r'^\s*(pentru|pt\.?)\s', norm(line)) or len(norm(line)) < 2:
            continue  # titluri de secțiune („Pentru sos:”)
        iid, g, found, t = parse(line)
        if not found:
            # ce nu știu și are cantitate e o lipsă reală; restul (garnituri opționale, „după gust”) nu contează
            if re.search(r'\d', t):
                miss.append(line.strip()[:60])
            else:
                unk.append(line.strip()[:40])
            continue
        if iid and g:
            ing[iid] += g
    serv, pieces = servings(rec.get('recipeYield'))
    # uleiul de prăjit / de marinat nu se mănâncă tot; condimentele și verdețurile au cantități mici
    for k in ('ulei', 'ulei_masline'):
        if ing.get(k, 0) > 20 * serv: ing[k] = 20 * serv
    for k in ('vanilie', 'boia', 'boia_iute', 'chimen', 'scortisoara', 'nucsoara', 'curry', 'oregano', 'cimbru', 'rozmarin', 'busuioc', 'turmeric', 'garam_masala', 'chili', 'piper'):
        if ing.get(k, 0) > 12: ing[k] = 8
    for k in ('patrunjel', 'marar', 'leustean', 'menta', 'busuioc_verde', 'coriandru'):
        if ing.get(k, 0) > 60: ing[k] = 40
    if ing.get('sare', 0) > 12: ing['sare'] = 10
    kcal = sum(ING[k]['kcal'] * g / 100 for k, g in ing.items() if k in ING)
    yt = [y for y in (r.get('yt') or []) if y not in SITEWIDE]
    steps = rec.get('recipeInstructions') or []
    steps = [html.unescape(s.get('text', '') if isinstance(s, dict) else str(s)) for s in (steps if isinstance(steps, list) else [steps])]
    out.append({
        'key': key, 'src': r['src'], 'url': r['url'], 'name': name, 'cat': cat_of(r), 'serv': serv, 'pieces': pieces,
        'prep': minutes(rec.get('totalTime')) or (minutes(rec.get('prepTime')) + minutes(rec.get('cookTime'))),
        'ing': {k: round(v) for k, v in ing.items()}, 'miss': miss, 'unk': unk, 'kcal': round(kcal), 'kcalServ': round(kcal / max(1, serv)),
        'video': yt[0] if yt else None, 'stepsSrc': steps,
    })
json.dump(out, sys.stdout, ensure_ascii=False)
print(f'{len(out)} rețete; {sum(1 for x in out if not x["miss"])} cu toate ingredientele; {sum(1 for x in out if x["video"])} cu video', file=sys.stderr)

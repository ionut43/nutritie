#!/usr/bin/env python3
"""
Pregătește pozele incluse în aplicație.

  npx tsx scripts/dump_data.ts > /tmp/data.json
  python3 scripts/build_photos.py /tmp/data.json <folder cu pozele TheMealDB descărcate>

- rețetele cu poză: poza TheMealDB, decupată pătrat, 480 px, JPEG
- ingredientele: decupajele TheMealDB (fundal transparent), 160 px, WebP
- rețetele simple (fără poză): compoziție din ingredientele principale pe o farfurie
- scrie src/data/photos.ts cu require-urile pentru Metro
"""
import hashlib
import re
import json
import os
import sys
import urllib.parse
import urllib.request

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_R = os.path.join(ROOT, 'assets', 'food', 'r')
OUT_I = os.path.join(ROOT, 'assets', 'food', 'i')
CACHE = os.path.join(os.path.dirname(sys.argv[1]), 'ing_cache')
SIZE = 480

data = json.load(open(sys.argv[1]))
photos_dir = sys.argv[2]
os.makedirs(OUT_R, exist_ok=True)
os.makedirs(OUT_I, exist_ok=True)
os.makedirs(CACHE, exist_ok=True)


def fetch_ingredient(name):
    path = os.path.join(CACHE, name.replace(' ', '_') + '_full.png')
    if not os.path.exists(path):
        url = 'https://www.themealdb.com/images/ingredients/' + urllib.parse.quote(name) + '.png'
        req = urllib.request.Request(url, headers={'User-Agent': 'nutritie-build/1.0'})
        with urllib.request.urlopen(req, timeout=30) as r, open(path, 'wb') as f:
            f.write(r.read())
    return Image.open(path).convert('RGBA')


# ── ingrediente ──
# doar pozele fără ambalaje sau mărci (legume, fructe, carne, nuci); restul primesc o pictogramă în aplicație
WHITELIST = set(open(os.path.join(ROOT, 'scripts', 'ingredient_photos_ok.txt')).read().split())
ing_ok = {}
for f in os.listdir(OUT_I):
    if f[:-5] not in WHITELIST:
        os.remove(os.path.join(OUT_I, f))
for i in data['ingredients']:
    if not i.get('img') or i['id'] not in WHITELIST:
        continue
    try:
        im = fetch_ingredient(i['img'])
    except Exception as e:  # noqa: BLE001
        print('ingredient lipsă', i['id'], i['img'], e)
        continue
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    im.thumbnail((160, 160), Image.LANCZOS)
    canvas = Image.new('RGBA', (160, 160), (0, 0, 0, 0))
    canvas.paste(im, ((160 - im.width) // 2, (160 - im.height) // 2), im)
    canvas.save(os.path.join(OUT_I, i['id'] + '.webp'), 'WEBP', quality=82, method=6)
    ing_ok[i['id']] = im
print('ingrediente:', len(ing_ok))

ING = {i['id']: i for i in data['ingredients']}
SKIP = {'ulei', 'ulei_masline', 'sare', 'piper', 'zahar', 'miere', 'apa', 'lapte', 'paine', 'paine_integrala', 'bagheta'}

PALETTE = [(255, 236, 214), (231, 245, 233), (255, 228, 230), (232, 238, 255), (255, 244, 205), (240, 232, 255)]

# baza compoziției, după felul rețetei
BASES = [
    (r'smoothie', 'glass'),
    (r'iaurt|kefir|branza_vaci|chia|morcovi_iaurt', 'bowl_white'),
    (r'terci|ovaz|overnight|quinoa|hrisca', 'bowl_oat'),
    (r'mamaliga', 'polenta'),
    (r'tartine|toast|sandvis|paine|ciuperci_paine', 'toast'),
    (r'omleta|jumari|briose|oua_cana|wrap_omleta|tofu_scramble', 'omelette'),
]
FILL = {'bowl_white': (250, 248, 242), 'bowl_oat': (226, 202, 160), 'polenta': (247, 205, 70)}
GLASS = {'banana': (247, 226, 160), 'fructe_padure': (196, 72, 120), 'spanac': (128, 186, 92)}


def cutout(iid, size):
    src = Image.open(os.path.join(CACHE, ING[iid]['img'].replace(' ', '_') + '_full.png')).convert('RGBA')
    bbox = src.getbbox()
    if bbox:
        src = src.crop(bbox)
    src.thumbnail((size, size), Image.LANCZOS)
    return src


def drop(img, src, cx, cy, blur=10, alpha=0.28):
    sh = Image.new('RGBA', src.size, (0, 0, 0, 0))
    sh.putalpha(src.split()[3].point(lambda v: int(v * alpha)))
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    img.paste((0, 0, 0), (cx - src.width // 2 + 8, cy - src.height // 2 + 14), sh)
    img.paste(src, (cx - src.width // 2, cy - src.height // 2), src)


def composite(r):
    rid = r['id']
    base = next((b for pat, b in BASES if re.search(pat, rid)), 'plate')
    toppings = [(g, iid) for iid, g in r['ing'] if iid in ing_ok and iid not in SKIP and not ING[iid]['staple']
                and not (base == 'toast' and iid in ('paine', 'paine_integrala', 'bagheta'))
                and not (base in ('omelette',) and iid == 'oua')]
    toppings.sort(reverse=True)
    picks = [iid for _, iid in toppings[:3]]
    seed = int(hashlib.md5(rid.encode()).hexdigest(), 16)
    bg = PALETTE[seed % len(PALETTE)]
    W = SIZE * 2
    img = Image.new('RGB', (W, W), bg)
    d = ImageDraw.Draw(img)
    shadow = Image.new('L', (W, W), 0)
    if base == 'glass':
        ImageDraw.Draw(shadow).ellipse((260, 760, W - 260, 880), fill=120)
        img.paste((0, 0, 0), (0, 0), shadow.filter(ImageFilter.GaussianBlur(24)).point(lambda v: int(v * 0.3)))
        main = next((k for k in GLASS if any(i == k for i, _ in r['ing'])), 'banana')
        col = GLASS[main]
        d.rounded_rectangle((330, 170, W - 330, 830), radius=60, fill=(255, 255, 255))
        d.rounded_rectangle((350, 240, W - 350, 810), radius=50, fill=col)
        d.rounded_rectangle((372, 260, 400, 780), radius=14, fill=tuple(min(255, c + 40) for c in col))
        for iid in picks[:2]:
            src = cutout(iid, 300)
            drop(img, src, W // 2 + (180 if iid == picks[0] else -200), 820, 8)
    else:
        ImageDraw.Draw(shadow).ellipse((130, 170, W - 110, W - 70), fill=110)
        img.paste((0, 0, 0), (0, 0), shadow.filter(ImageFilter.GaussianBlur(30)).point(lambda v: int(v * 0.32)))
        if base in ('bowl_white', 'bowl_oat', 'polenta'):
            d.ellipse((120, 120, W - 120, W - 120), fill=(255, 255, 255))
            d.ellipse((170, 170, W - 170, W - 170), fill=FILL[base])
            # textură
            import random
            rnd = random.Random(seed)
            for _ in range(260 if base != 'bowl_white' else 60):
                x, y = rnd.randint(220, W - 220), rnd.randint(220, W - 220)
                if (x - W / 2) ** 2 + (y - W / 2) ** 2 > (W / 2 - 200) ** 2:
                    continue
                c = tuple(max(0, v - rnd.randint(8, 28)) for v in FILL[base])
                rr = rnd.randint(3, 9)
                d.ellipse((x - rr, y - rr, x + rr, y + rr), fill=c)
            if base == 'polenta':
                d.ellipse((W // 2 + 40, W // 2 - 160, W // 2 + 260, W // 2 + 20), fill=(252, 250, 244))
                for k in range(14):
                    x, y = W // 2 - 220 + (k * 53) % 300, W // 2 + 40 + (k * 37) % 180
                    d.rectangle((x, y, x + 34, y + 30), fill=(250, 249, 240))
            slots = [(W // 2 - 150, W // 2 + 30, 380), (W // 2 + 170, W // 2 + 90, 330), (W // 2 + 30, W // 2 - 200, 300)]
        else:
            d.ellipse((110, 110, W - 110, W - 110), fill=(255, 255, 255))
            d.ellipse((170, 170, W - 170, W - 170), fill=(248, 246, 243))
            if base == 'toast' and 'paine' in ing_ok:
                bread = cutout('paine', 700)
                drop(img, bread.rotate(-8, expand=True, resample=Image.BICUBIC), W // 2, W // 2 + 30, 14, 0.2)
            if base == 'omelette':
                d.ellipse((260, 300, W - 230, W - 280), fill=(248, 214, 92))
                d.ellipse((300, 330, W - 300, W - 330), fill=(250, 223, 118))
            slots = [(W // 2 - 160, W // 2 + 80, 400), (W // 2 + 180, W // 2 + 40, 360), (W // 2 + 10, W // 2 - 200, 330)]
        n = len(picks)
        for iid, (cx, cy, sz) in zip(picks, slots[:max(1, n)]):
            drop(img, cutout(iid, sz), cx, cy)
    return img.resize((SIZE, SIZE), Image.LANCZOS)


have = set()
for r in data['recipes']:
    out = os.path.join(OUT_R, r['id'] + '.jpg')
    if r.get('img'):
        src = os.path.join(photos_dir, r['img'] + '.jpg')
        im = Image.open(src).convert('RGB')
        w, h = im.size
        s = min(w, h)
        im = im.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s)).resize((SIZE, SIZE), Image.LANCZOS)
    else:
        im = composite(r)
    im.save(out, 'JPEG', quality=80, optimize=True, progressive=True)
    have.add(r['id'])

# curăță pozele rămase de la rețete șterse
for f in os.listdir(OUT_R):
    if f.endswith('.jpg') and f[:-4] not in have:  # .webp: rețete importate/românești/clasice, au scripturile lor
        os.remove(os.path.join(OUT_R, f))

with open(os.path.join(ROOT, 'src', 'data', 'photos.ts'), 'w') as f:
    f.write('// Generat de scripts/build_photos.py. Nu edita de mână.\n')
    f.write('/* eslint-disable */\n')
    f.write("import { EXTRA_PHOTO } from './photos_extra';\n")
    f.write("import { IMPORT_PHOTO } from './photos_import';\n")
    f.write("import { RO_PHOTO } from './photos_ro';\n")
    f.write('export const RECIPE_PHOTO: Record<string, number> = {\n')
    for r in data['recipes']:
        f.write(f"  {json.dumps(r['id'])}: require('../../assets/food/r/{r['id']}.jpg'),\n")
    f.write('  ...IMPORT_PHOTO,\n  ...RO_PHOTO,\n  ...EXTRA_PHOTO,\n};\n\nexport const INGREDIENT_PHOTO: Record<string, number> = {\n')
    for iid in sorted(ing_ok):
        f.write(f"  {json.dumps(iid)}: require('../../assets/food/i/{iid}.webp'),\n")
    f.write('};\n')

total = sum(os.path.getsize(os.path.join(OUT_R, x)) for x in os.listdir(OUT_R))
total_i = sum(os.path.getsize(os.path.join(OUT_I, x)) for x in os.listdir(OUT_I))
print(f'rețete: {len(have)} ({total / 1e6:.1f} MB), ingrediente: {len(ing_ok)} ({total_i / 1e6:.1f} MB)')

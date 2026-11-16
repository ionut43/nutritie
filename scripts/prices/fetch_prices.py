"""
Prețuri reale, de azi, pentru ingredientele aplicației, din Monitorul Prețurilor (Consiliul Concurenței).

  python3 scripts/prices/fetch_prices.py --lat 44.402 --lon 26.065 --out src/data/prices_live.json

Pași: pentru fiecare ingredient caut produsele în catalog, apoi cer prețurile din magazinele
de pe o rază de câțiva km. Prețul pe kg al fiecărui produs → pe fiecare rețea iau o valoare
„de coș obișnuit” (percentila 30, nu cel mai scump brand) → prețul pachetului din aplicație.
"""
import argparse, json, os, re, ssl, statistics, sys, time, urllib.parse, urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(__file__))
from mapping import MAP  # noqa: E402

BASE = 'https://monitorulpreturilor.info/pmonsvc/Retail'
NET = {'AUCHAN': 'auchan', '5940475006709': 'carrefour', 'KAUFLAND': 'kaufland', '4055329000008': 'lidl',
       '5940475870003': 'mega', 'PENNY': 'penny', 'PROFI': 'profi', 'SELGROS': 'selgros'}

def ctx(cafile):
    c = ssl.create_default_context(cafile=cafile) if cafile else ssl.create_default_context()
    return c

def get(url, c, cache_dir, retries=3):
    key = re.sub(r'[^A-Za-z0-9]+', '_', url)[-180:]
    p = os.path.join(cache_dir, key + '.xml')
    if os.path.exists(p) and time.time() - os.path.getmtime(p) < 6 * 3600:
        return open(p, encoding='utf-8').read()
    for i in range(retries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'nutritie-app/1 (uz personal)'}), timeout=90, context=c) as r:
                txt = r.read().decode('utf-8', 'replace')
                open(p, 'w', encoding='utf-8').write(txt)
                time.sleep(0.4)
                return txt
        except Exception as e:  # noqa: BLE001
            if i == retries - 1:
                raise
            time.sleep(2 * (i + 1))

def ns(root):
    return root.tag.split('}')[0][1:]

def clean(xml):
    return re.sub(r'&#x?[0-9a-fA-F]+;', lambda m: m.group(0) if m.group(0) not in ('&#x1;', '&#x2;') else '', xml)

NUM = r'(\d+(?:[.,]\d+)?)'
def grams_of(name, unit, ing):
    """cât cântărește produsul (g sau ml); None dacă nu reiese"""
    t = f'{name} {unit}'.lower().replace('gr.', 'g ')
    mult = 1
    m = re.search(r'(\d+)\s*[x*]\s*' + NUM + r'\s*(kg|g|gr|ml|l)\b', t) or re.search(NUM + r'\s*(kg|g|gr|ml|l)\s*[x*]\s*(\d+)', t)
    if m:
        g = m.groups()
        if g[0].isdigit() and len(g) == 3 and g[2] in ('kg', 'g', 'gr', 'ml', 'l'):
            mult, v, u = int(g[0]), float(g[1].replace(',', '.')), g[2]
        else:
            v, u, mult = float(g[0].replace(',', '.')), g[1], int(g[2])
    else:
        m = re.search(NUM + r'\s*(kg|kilogram|g|gr|grame|ml|l|litri|ltr)\b', t)
        if not m:
            if ing.get('unit') == 'buc':
                pm = re.search(r'(\d+)\s*(buc|bucati|oua|ou|x)\b', t)
                if pm:
                    return int(pm.group(1)) * ing['gpp']
            if re.search(r'\bkg\b|/kg|kilogram|vrac|\bk\b', t):
                return 1000.0
            return None
        v, u = float(m.group(1).replace(',', '.')), m.group(2)
    g = v * (1000 if u in ('kg', 'kilogram', 'l', 'litri', 'ltr') else 1) * mult
    return g if 5 <= g <= 25000 else None

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--lat', type=float, default=44.402)
    ap.add_argument('--lon', type=float, default=26.065)
    ap.add_argument('--buffer', type=int, default=5000)
    ap.add_argument('--area', default='București')
    ap.add_argument('--ing', required=True, help='JSON cu ingredientele aplicației (scripts/dump_data.ts)')
    ap.add_argument('--out', required=True)
    ap.add_argument('--cafile')
    ap.add_argument('--cache', default='/tmp/mp_cache')
    ap.add_argument('--only', default='')
    a = ap.parse_args()
    os.makedirs(a.cache, exist_ok=True)
    c = ctx(a.cafile)
    ings = {i['id']: i for i in json.load(open(a.ing))['ingredients']}

    # 1) produsele potrivite din catalog
    prod_ing = {}
    for iid, (q, inc, exc) in MAP.items():
        if a.only and iid not in a.only.split(','):
            continue
        xml = clean(get(f'{BASE}/GetCatalogProductsByNameNetwork?prodname={urllib.parse.quote(q)}', c, a.cache))
        root = ET.fromstring(xml); N = ns(root)
        n = 0
        for el in root.iter(f'{{{N}}}CatalogProduct'):
            pid, name = el.findtext(f'{{{N}}}Id'), (el.findtext(f'{{{N}}}Name') or '')
            low = name.lower()
            if inc and not re.search(inc, low):
                continue
            if exc and re.search(exc, low):
                continue
            prod_ing.setdefault(int(pid), set()).add(iid)
            n += 1
            if n >= 60:
                break
        print(f'{iid}: {n} produse', file=sys.stderr)

    # 2) prețurile din magazinele din jur
    ids = sorted(prod_ing)
    obs = {}  # (iid, net) -> {pid: [perkg...]}
    names = {}
    for k in range(0, len(ids), 150):
        batch = ids[k:k + 150]
        url = f'{BASE}/GetStoresForProductsByLatLon?lat={a.lat}&lon={a.lon}&buffer={a.buffer}&csvprodids={",".join(map(str, batch))}&OrderBy=price'
        root = ET.fromstring(clean(get(url, c, a.cache))); N = ns(root)
        for st in root.iter(f'{{{N}}}RetailStore'):
            net = st.findtext(f'{{{N}}}Retailnetwork/{{{N}}}Id')
            if net not in NET:
                continue
            for p in st.iter(f'{{{N}}}Product'):
                price = p.findtext(f'{{{N}}}Price')
                if not price or price == '0':
                    continue
                pid = int(p.findtext(f'{{{N}}}Catprod/{{{N}}}Id') or 0)
                name = p.findtext(f'{{{N}}}Catprod/{{{N}}}Name') or ''
                unit = p.findtext(f'{{{N}}}Unit') or ''
                names[pid] = name
                for iid in prod_ing.get(pid, ()):
                    ing = ings[iid]
                    gpp = ing.get('gPerPiece') or 50
                    g = grams_of(name, unit, {'unit': ing.get('unit'), 'gpp': gpp})
                    if not g:
                        continue
                    perkg = float(price) / g * 1000
                    est = ing['price'] / ing['pkg'] * 1000
                    if not (est * 0.25 <= perkg <= est * 4):  # alt produs decât credem (ex. condiment, porție gata)
                        continue
                    obs.setdefault((iid, NET[net]), {}).setdefault(pid, []).append(perkg)
        print(f'prețuri: {min(k + 150, len(ids))}/{len(ids)} produse', file=sys.stderr)

    out = {}
    for (iid, net), per in obs.items():
        vals = sorted(statistics.median(v) for v in per.values())
        if not vals:
            continue
        q = vals[min(len(vals) - 1, int(len(vals) * 0.3))]
        pkg = ings[iid]['pkg']
        out.setdefault(net, {})[iid] = round(q * pkg / 1000, 2)
    res = {
        'source': 'Monitorul Prețurilor (Consiliul Concurenței), monitorulpreturilor.info',
        'fetchedAt': datetime.now(timezone.utc).isoformat(timespec='minutes'),
        'area': {'name': a.area, 'lat': a.lat, 'lon': a.lon, 'radiusM': a.buffer},
        'prices': {k: dict(sorted(v.items())) for k, v in sorted(out.items())},
    }
    json.dump(res, open(a.out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print({k: len(v) for k, v in out.items()}, file=sys.stderr)

if __name__ == '__main__':
    main()

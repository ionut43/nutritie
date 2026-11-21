"""Citește scripts/recipes/ro_src/*.txt (rețetele mele) și en.txt (numele în engleză)."""
import os

D = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ro_src')


def read_src():
    src, en = {}, {}
    for fn in sorted(os.listdir(D)):
        if not fn.endswith('.txt'):
            continue
        for line in open(os.path.join(D, fn), encoding='utf-8'):
            line = line.strip()
            if not line or line.startswith('#') or line.startswith('-'):
                continue
            p = [x.strip() for x in line.split('|')]
            if fn == 'en.txt':
                en[p[0]] = p[1]
                continue
            assert len(p) >= 4 and p[1] in 'PMGD', (fn, line[:80])
            src[p[0]] = (p[1], p[2], [s for s in p[3:] if s])
    return src, en

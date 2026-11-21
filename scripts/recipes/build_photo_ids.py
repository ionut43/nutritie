#!/usr/bin/env python3
"""src/data/photo_ids.ts: ce rețete au poză în aplicație (planul le preferă). Citește cheile din src/data/photos*.ts."""
import glob
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ids = set()
for f in glob.glob(os.path.join(ROOT, 'src', 'data', 'photos*.ts')):
    ids |= set(re.findall(r'^\s*"([^"]+)":\s*require\(', open(f, encoding='utf-8').read(), re.M))
with open(os.path.join(ROOT, 'src', 'data', 'photo_ids.ts'), 'w') as o:
    o.write('// Generat de scripts/recipes/build_photo_ids.py. Nu edita de mână.\n')
    o.write('export const HAS_PHOTO = new Set<string>([\n' + ''.join(f'  {i!r},\n'.replace("'", '"') for i in sorted(ids)) + ']);\n')
print(len(ids), 'rețete cu poză')

#!/usr/bin/env python3
"""
Face din exportul web o aplicație care se pune pe ecranul iPhone-ului din Safari (Partajează → Adaugă pe ecranul principal).
  python3 scripts/web_pwa.py dist /nutritie
"""
import json
import os
import shutil
import sys

from PIL import Image

out, base = sys.argv[1], sys.argv[2].rstrip('/')
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
icon = Image.open(os.path.join(root, 'assets', 'icon.png')).convert('RGB')
for px in (180, 192, 512):
    icon.resize((px, px), Image.LANCZOS).save(os.path.join(out, f'icon-{px}.png'))

json.dump({
    'name': 'Nutriție', 'short_name': 'Nutriție', 'lang': 'ro',
    'start_url': base + '/', 'scope': base + '/', 'display': 'standalone',
    'background_color': '#2E6A4E', 'theme_color': '#2E6A4E',
    'icons': [{'src': f'{base}/icon-{px}.png', 'sizes': f'{px}x{px}', 'type': 'image/png'} for px in (192, 512)],
}, open(os.path.join(out, 'manifest.json'), 'w'), ensure_ascii=False)

head = f'''
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Nutriție">
<meta name="theme-color" content="#2E6A4E">
<link rel="apple-touch-icon" href="{base}/icon-180.png">
<link rel="manifest" href="{base}/manifest.json">
'''
p = os.path.join(out, 'index.html')
html = open(p, encoding='utf-8').read()
if 'apple-mobile-web-app-capable' not in html:
    html = html.replace('</head>', head + '</head>', 1)
html = html.replace('content="width=device-width, initial-scale=1, shrink-to-fit=no"',
                    'content="width=device-width, initial-scale=1, viewport-fit=cover"')
open(p, 'w', encoding='utf-8').write(html)
shutil.copy(p, os.path.join(out, '404.html'))  # GitHub Pages: orice adresă deschide aplicația
open(os.path.join(out, '.nojekyll'), 'w').close()
print('gata:', out)

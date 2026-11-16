#!/usr/bin/env python3
"""
Vectorii CLIP pentru recunoașterea farfuriei -> src/data/vision_embeddings.json

  npx tsx scripts/dump_data.ts > /tmp/data.json
  python3 scripts/build_vision.py /tmp/data.json <folder model CLIP (text + vision + tokenizer)>

Pentru fiecare rețetă se păstrează doi vectori:
- textul (descrierea în engleză a felului)
- poza rețetei (pentru rețetele cu poză reală), care ajută mult la felurile asemănătoare
Pe telefon rulează doar encoderul de imagine; scorul final combină cele două potriviri.
"""
import base64
import json
import os
import sys

import numpy as np
import onnxruntime as ort
from PIL import Image
from tokenizers import Tokenizer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
data = json.load(open(sys.argv[1]))
D = sys.argv[2]
MEAN = np.array([0.48145466, 0.4578275, 0.40821073], dtype=np.float32)
STD = np.array([0.26862954, 0.26130258, 0.27577711], dtype=np.float32)

tok = Tokenizer.from_file(f'{D}/tokenizer.json')
ts = ort.InferenceSession(f'{D}/text_model_quantized.onnx')
vs = ort.InferenceSession(f'{D}/vision_model_quantized.onnx')


def text(t):
    e = ts.run(['text_embeds'], {'input_ids': np.array([tok.encode(t).ids[:77]], dtype=np.int64)})[0][0]
    return e / np.linalg.norm(e)


def image(path):
    im = Image.open(path).convert('RGB')
    w, h = im.size
    s = min(w, h)
    im = im.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s)).resize((224, 224), Image.BICUBIC)
    a = ((np.asarray(im, dtype=np.float32) / 255 - MEAN) / STD).transpose(2, 0, 1)[None]
    e = vs.run(['image_embeds'], {'pixel_values': a})[0][0]
    return e / np.linalg.norm(e)


ids, T, I = [], [], []
for r in data['recipes']:
    ids.append(r['id'])
    T.append(text(f"a photo of {r['en']}, a type of food"))
    I.append(image(os.path.join(ROOT, 'assets', 'food', 'r', r['id'] + ('.webp' if os.path.exists(os.path.join(ROOT, 'assets', 'food', 'r', r['id'] + '.webp')) else '.jpg'))) if r.get('img') else np.zeros(512, np.float32))
for g in data['generic']:
    ids.append(g['id'])
    T.append(text(g['en'] + ', a type of food'))
    I.append(np.zeros(512, np.float32))


def q8(M):
    M = np.stack(M).astype(np.float32)
    scale = float(np.abs(M).max() / 127)
    return scale, base64.b64encode(np.round(M / scale).astype(np.int8).tobytes()).decode()


st, dt = q8(T)
si, di = q8(I)
out = {'model': 'Xenova/clip-vit-base-patch32', 'dim': 512, 'ids': ids,
       'text': {'scale': st, 'data': dt}, 'image': {'scale': si, 'data': di}}
json.dump(out, open(os.path.join(ROOT, 'src', 'data', 'vision_embeddings.json'), 'w'))
print(len(ids), 'etichete;', sum(1 for r in data['recipes'] if r.get('img')), 'cu poză')

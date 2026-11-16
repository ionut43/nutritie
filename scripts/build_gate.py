#!/usr/bin/env python3
"""
Poarta „e mâncare?” pentru poza farfuriei -> src/data/vision_gate.json

  python3 scripts/build_gate.py <folder model CLIP>

Fără ea, recunoașterea alegea mereu ceva (o captură de WhatsApp ieșea „ouă”).
Câteva descrieri de mâncare și câteva de lucruri care nu sunt mâncare; pe telefon,
poza se compară cu toate, iar dacă seamănă mai mult cu „nu e mâncare”, spunem asta.
"""
import json, os, sys
import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = sys.argv[1]
tok = Tokenizer.from_file(f'{D}/tokenizer.json')
ts = ort.InferenceSession(f'{D}/text_model_quantized.onnx')

def text(t):
    e = ts.run(['text_embeds'], {'input_ids': np.array([tok.encode(t).ids[:77]], dtype=np.int64)})[0][0]
    return e / np.linalg.norm(e)

FOOD = [
    'a photo of food on a plate', 'a photo of a meal', 'a close-up photo of a dish of food', 'a bowl of soup',
    'a photo of fruit', 'a photo of a snack', 'a photo of a drink in a glass', 'a sandwich', 'a plate of pasta',
    'a photo of dessert', 'a photo of vegetables', 'a photo of meat on a plate', 'food in a takeaway box',
]
NOT = [
    'a screenshot of a phone chat conversation', 'a screenshot of an app', 'a screenshot of text messages', 'a document with text',
    'a photo of a person', 'a selfie', 'a photo of a room', 'a photo of a street', 'a photo of a car', 'a photo of an animal',
    'a photo of a computer screen', 'a blurry dark photo', 'an empty plate', 'a photo of a receipt', 'a meme', 'a photo of a dog or a cat',
]
out = {'food': [list(map(lambda x: round(float(x), 5), text(t))) for t in FOOD],
       'not': [list(map(lambda x: round(float(x), 5), text(t))) for t in NOT]}
json.dump(out, open(os.path.join(ROOT, 'src', 'data', 'vision_gate.json'), 'w'))
print(len(FOOD), len(NOT))

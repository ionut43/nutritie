"""Cantitățile din surse („1 1/2 cups”, „2 tbs”, „400g”, „3 cloves”) -> grame."""
import re
from fractions import Fraction

PIECE = [  # g pe bucată, după numele ingredientului
    ('egg yolk', 18), ('egg white', 33), ('egg', 55), ('garlic', 5), ('clove', 5), ('shallot', 40), ('spring onion', 15), ('green onion', 15), ('scallion', 15),
    ('red onion', 150), ('onion', 150), ('potato', 200), ('sweet potato', 250), ('carrot', 80), ('celery', 40), ('leek', 200), ('tomato', 120), ('cherry tomato', 15),
    ('pepper', 150), ('hot pepper', 15), ('peppercorn', 0.1), ('chilli', 15), ('chili', 15), ('jalape', 15), ('scotch bonnet', 10), ('lemon', 100), ('lime', 60), ('orange', 180), ('apple', 180), ('pear', 180), ('banana', 120),
    ('avocado', 170), ('cucumber', 300), ('courgette', 200), ('zucchini', 200), ('aubergine', 300), ('eggplant', 300), ('mushroom', 20), ('chicken breast', 180), ('chicken thigh', 110),
    ('chicken leg', 250), ('chicken drumstick', 120), ('chicken wing', 90), ('chicken', 1500), ('sausage', 70), ('bacon', 25), ('tortilla', 62), ('pitta', 60), ('pita', 60), ('naan', 90),
    ('bun', 60), ('bread', 30), ('baguette', 250), ('lettuce', 300), ('cabbage', 1000), ('cauliflower', 700), ('broccoli', 400), ('mango', 300), ('pineapple', 900),
    ('stock cube', 10), ('bay lea', 0.3), ('lamb shank', 400), ('pork chop', 200), ('salmon', 140), ('fillet', 150), ('steak', 250), ('prawn', 15), ('shrimp', 12), ('date', 8), ('plantain', 250), ('biscuit', 8), ('cracker', 8), ('cookie', 12), ('rice paper', 10), ('wrapper', 10), ('marshmallow', 7),
]
CUP = [('flour', 125), ('sugar', 200), ('rice', 185), ('oat', 90), ('butter', 227), ('cheese', 100), ('parmesan', 100), ('breadcrumb', 110), ('nut', 130), ('almond', 130),
       ('lentil', 190), ('bean', 180), ('pea', 145), ('spinach', 30), ('coriander', 16), ('parsley', 30), ('basil', 24), ('mint', 24), ('berr', 150), ('raisin', 150),
       ('cocoa', 85), ('chocolate', 170), ('coconut', 80), ('yogurt', 245), ('yoghurt', 245), ('cream', 240), ('milk', 245), ('stock', 240), ('water', 240), ('quinoa', 170), ('couscous', 175)]

UNITS = {
    'kg': 1000, 'kilogram': 1000, 'g': 1, 'gram': 1, 'grams': 1, 'gr': 1, 'mg': 0.001, 'l': 1000, 'litre': 1000, 'liter': 1000, 'ml': 1, 'cl': 10, 'dl': 100,
    'lb': 454, 'lbs': 454, 'pound': 454, 'pounds': 454, 'oz': 28, 'ounce': 28, 'ounces': 28,
    'tbsp': 15, 'tbs': 15, 'tblsp': 15, 'tablespoon': 15, 'tablespoons': 15, 'tbls': 15, 'tsp': 5, 'teaspoon': 5, 'teaspoons': 5, 'dessertspoon': 10,
    'pinch': 0.5, 'dash': 0.5, 'handful': 30, 'bunch': 40, 'sprig': 2, 'sprigs': 2, 'can': 400, 'tin': 400, 'cans': 400, 'tins': 400, 'jar': 300, 'pack': 250, 'packet': 250,
    'clove': 5, 'cloves': 5, 'slice': 30, 'slices': 30, 'rasher': 25, 'rashers': 25, 'stick': 113, 'knob': 15, 'cube': 10, 'sheet': 30, 'sheets': 30, 'leaf': 0.3, 'leaves': 0.3,
}

def num(s: str):
    s = s.replace('½', ' 1/2').replace('¼', ' 1/4').replace('¾', ' 3/4').replace('⅓', ' 1/3').replace('⅔', ' 2/3').strip()
    m = re.match(r'^(\d+\s+\d+/\d+|\d+/\d+|\d+(?:[.,]\d+)?)(?:\s*-\s*(\d+(?:[.,]\d+)?))?', s)
    if not m: return None, s
    a = m.group(1)
    if ' ' in a: w, f = a.split(); v = int(w) + float(Fraction(f))
    elif '/' in a: v = float(Fraction(a))
    else: v = float(a.replace(',', '.'))
    if m.group(2): v = (v + float(m.group(2).replace(',', '.'))) / 2
    return v, s[m.end():].strip()

def piece(name: str):
    n = name.lower()
    for k, g in sorted(PIECE, key=lambda x: -len(x[0])):
        if k in n: return g
    return None

def cup(name: str):
    n = name.lower()
    for k, g in CUP:
        if k in n: return g
    return 150

def grams(measure: str, name: str):
    """grame (aproximativ) sau None dacă nu se poate citi"""
    m = (measure or '').lower().strip()
    if not m or m in ('to taste', 'to serve', 'garnish', 'as required', 'as needed', 'optional', 'for frying', 'drizzle', 'splash', 'sprinkling', 'dusting'):
        return 3 if not m else 5
    v, rest = num(m)
    if v is None:
        # „pinch”, „a handful”, „large”
        for u, g in UNITS.items():
            if re.match(rf'^(a |an )?{u}\b', rest): return g
        p = piece(name)
        return p if p else 10
    rest = rest.replace('.', '').strip()
    w = re.match(r'^([a-z]+)', rest)
    u = w.group(1) if w else ''
    if u in ('cup', 'cups', 'c'): return v * cup(name)
    if u in UNITS:
        g = UNITS[u]
        if u in ('can', 'tin', 'cans', 'tins'):
            mm = re.search(r'(\d+)\s*(g|ml|oz)', rest)
            if mm: g = int(mm.group(1)) * (28 if mm.group(2) == 'oz' else 1)
        return v * g
    if u in ('large', 'big'): return v * (piece(name) or 100) * 1.3
    if u in ('small',): return v * (piece(name) or 100) * 0.7
    p = piece(name)
    return v * (p if p else 50)

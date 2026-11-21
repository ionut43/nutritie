"""
Ingrediente scrise în română („500 gr. piept de pui”, „2 linguri ulei”, „o ceapă”) -> (id ingredient, grame).
Folosit pentru rețetele din site-uri românești: iau doar ingredientele și cantitățile (informații), nu textul autorului.
"""
import re
import unicodedata


def norm(s):
    s = unicodedata.normalize('NFKD', s.lower())
    s = ''.join(c for c in s if not unicodedata.combining(c))
    s = s.replace('ş', 's').replace('ţ', 't')
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9/.,½¼¾ -]', ' ', s)).strip()


# cuvânt cheie (fără diacritice) -> id; cel mai lung cuvânt găsit câștigă. None = nu contează (apă, gheață…)
MAP = [
    ('piept de pui', 'pui_piept'), ('pieptul de pui', 'pui_piept'), ('file de pui', 'pui_piept'), ('piept pui', 'pui_piept'),
    ('pulpe de pui dezosate', 'pui_pulpe'), ('pulpe dezosate', 'pui_pulpe'), ('pulpe de pui', 'pui_pulpe_os'), ('pulpe pui', 'pui_pulpe_os'),
    ('ciocanele de pui', 'pui_pulpe_os'), ('ciocanele', 'pui_pulpe_os'), ('copanele', 'pui_pulpe_os'), ('pulpa de pui', 'pui_pulpe_os'),
    ('aripioare', 'aripioare'), ('aripi de pui', 'aripioare'), ('pui intreg', 'pui_intreg'), ('un pui', 'pui_intreg'), ('carne de pui', 'pui_pulpe'),
    ('pui', 'pui_intreg'), ('carne tocata de pui', 'tocata_pui'), ('tocatura de pui', 'tocata_pui'), ('ficat de pui', 'ficat_pui'), ('ficatei', 'ficat_pui'),
    ('piept de curcan', 'curcan_piept'), ('curcan', 'curcan_piept'), ('carne tocata de curcan', 'tocata_curcan'),
    ('ceafa de porc', 'ceafa_porc'), ('ceafa', 'ceafa_porc'), ('muschi de porc', 'muschi_porc'), ('muschiulet de porc', 'muschi_porc'), ('muschiulet', 'muschi_porc'),
    ('cotlet de porc', 'cotlet_porc'), ('cotlet', 'cotlet_porc'), ('pulpa de porc', 'pulpa_porc'), ('carne de porc', 'pulpa_porc'), ('spata de porc', 'pulpa_porc'),
    ('coaste de porc', 'coaste_porc'), ('coaste', 'coaste_porc'), ('costite de porc', 'coaste_porc'), ('ciolan', 'coaste_porc'),
    ('carne tocata de porc', 'tocata_porc'), ('tocatura de porc', 'tocata_porc'), ('carne tocata de vita', 'tocata_vita'), ('carne tocata de vitel', 'tocata_vita'),
    ('carne tocata amestec', 'tocata_mixta'), ('carne tocata mixta', 'tocata_mixta'), ('carne tocata', 'tocata_mixta'), ('tocatura', 'tocata_mixta'),
    ('carnati afumati', 'carnati'), ('carnati proaspeti', 'carnati_proaspeti'), ('carnati', 'carnati'), ('carnat', 'carnati'), ('chorizo', 'carnati'),
    ('crenvursti', 'crenvursti'), ('crenvurst', 'crenvursti'), ('parizer', 'crenvursti'), ('salam', 'carnati'), ('kaizer', 'costita'),
    ('costita afumata', 'costita'), ('costita', 'costita'), ('bacon', 'costita'), ('afumatura', 'costita'), ('slanina', 'costita'), ('sunca', 'sunca'), ('prosciutto', 'sunca'),
    ('carne de vita', 'vita_pulpa'), ('pulpa de vita', 'vita_pulpa'), ('vita', 'vita_pulpa'), ('vitel', 'vita_pulpa'), ('antricot', 'antricot_vita'), ('rasol de vita', 'vita_pulpa'),
    ('carne de miel', 'miel'), ('miel', 'miel'), ('berbecut', 'miel'), ('carne de oaie', 'miel'), ('oaie', 'miel'),
    ('somon afumat', 'somon_afumat'), ('somon', 'somon'), ('pastrav', 'pastrav'), ('macrou', 'macrou'), ('crap', 'pastrav'), ('salau', 'cod'), ('cod', 'cod'),
    ('merluciu', 'cod'), ('peste alb', 'cod'), ('file de peste', 'cod'), ('peste', 'cod'), ('creveti', 'creveti'), ('calamar', 'calamar'), ('fructe de mare', 'creveti'),
    ('ton', 'ton'), ('sardine', 'sardine'), ('hering', 'macrou'),
    ('galbenusuri', 'oua'), ('galbenus', 'oua'), ('albusuri', 'oua'), ('albus', 'oua'), ('oua', 'oua'), ('ou', 'oua'),
    ('lapte batut', 'kefir'), ('sana', 'kefir'), ('kefir', 'kefir'), ('lapte condensat', 'lapte'), ('lapte praf', 'lapte'), ('lapte', 'lapte'),
    ('iaurt grecesc', 'iaurt_grec'), ('iaurt', 'iaurt'), ('branza de vaci', 'branza_vaci'), ('branza dulce', 'branza_vaci'), ('urda', 'ricotta'), ('ricotta', 'ricotta'),
    ('crema de branza', 'crema_branza'), ('philadelphia', 'crema_branza'), ('branza topita', 'crema_branza'), ('mascarpone', 'mascarpone'),
    ('telemea', 'telemea'), ('branza sarata', 'telemea'), ('branza de oaie', 'telemea'), ('feta', 'feta'), ('cascaval', 'cascaval'), ('branza maturata', 'cascaval'),
    ('emmentaler', 'cascaval'), ('gouda', 'cascaval'), ('cheddar', 'cascaval'), ('mozzarella', 'mozzarella'), ('parmezan', 'parmezan'), ('parmigiano', 'parmezan'),
    ('branza', 'telemea'), ('smantana lichida', 'frisca'), ('smantana pentru gatit', 'frisca'), ('frisca', 'frisca'), ('smantana', 'smantana'),
    ('unt', 'unt'), ('margarina', 'unt'), ('untura', 'ulei'), ('tofu', 'tofu'), ('lapte de soia', 'lapte_soia'), ('bautura vegetala', 'lapte_soia'),
    ('ulei de masline', 'ulei_masline'), ('ulei', 'ulei'),
    ('carne rosie tocata', 'tocata_mixta'), ('paradais', 'rosii'), ('ras el hanout', None), ('coacaze', 'fructe_padure'), ('seminte asortate', 'seminte_floarea'), ('piepti de pui', 'pui_piept'), ('pieptul de pui', 'pui_piept'), ('supa de pui', None), ('supa de vita', None), ('supa de legume', None), ('piepti', 'pui_piept'), ('piept', 'pui_piept'), ('piept de porc', 'ceafa_porc'), ('piept de rata', 'pui_pulpe_os'), ('piepti de rata', 'pui_pulpe_os'), ('magret', 'pui_pulpe_os'), ('carne rosie', 'vita_pulpa'), ('faina', 'faina'), ('taietei', 'taitei'), ('taitei', 'taitei'), ('orez', 'orez'), ('paste', 'paste'), ('spaghete', 'paste'), ('penne', 'paste'), ('macaroane', 'paste'), ('fusilli', 'paste'),
    ('fidea', 'taitei'), ('taitei de orez', 'taitei_orez'), ('taitei', 'taitei'), ('foi de lasagna', 'lasagna'), ('lasagna', 'lasagna'),
    ('fulgi de ovaz', 'ovaz'), ('ovaz', 'ovaz'), ('malai', 'malai'), ('bulgur', 'bulgur'), ('cuscus', 'cuscus'), ('quinoa', 'quinoa'), ('hrisca', 'hrisca'),
    ('gris', 'gris'), ('pesmet', 'pesmet'), ('amidon', 'amidon'), ('maizena', 'amidon'), ('linte rosie', 'linte'), ('linte', 'linte_verde'), ('mazare uscata', 'mazare_uscata'),
    ('paine integrala', 'paine_integrala'), ('paine', 'paine'), ('felii de paine', 'paine'), ('bagheta', 'bagheta'), ('chifle', 'chifle'), ('chifla', 'chifle'),
    ('lipii', 'tortilla'), ('lipie', 'tortilla'), ('tortilla', 'tortilla'), ('pita', 'pita'), ('aluat foietaj', 'foietaj'), ('foietaj', 'foietaj'),
    ('foi de placinta', 'foi_placinta'), ('foi pentru placinta', 'foi_placinta'),
    ('cartofi dulci', 'cartofi_dulci'), ('cartofi', 'cartofi'), ('cartof', 'cartofi'), ('ceapa verde', 'ceapa_verde'), ('ceapa', 'ceapa'), ('ceape', 'ceapa'),
    ('praz', 'praz'), ('usturoi', 'usturoi'), ('ghimbir', 'ghimbir'), ('morcovi', 'morcov'), ('morcov', 'morcov'), ('pastarnac', 'pastarnac'),
    ('radacina de telina', 'telina'), ('telina', 'telina'), ('sfecla', 'sfecla'), ('ardei gras', 'ardei'), ('gogosari', 'ardei'), ('ardei kapia', 'ardei'),
    ('ardei iute', 'ardei_iute'), ('chili', 'ardei_iute'), ('ardei', 'ardei'), ('rosii', 'rosii'), ('rosie', 'rosii'), ('rosii cherry', 'rosii'),
    ('castraveti murati', 'castraveti_murati'), ('castraveciori murati', 'castraveti_murati'), ('castraveti', 'castraveti'), ('castravete', 'castraveti'),
    ('ridichi', 'ridichi'), ('dovlecei', 'dovlecei'), ('dovlecel', 'dovlecei'), ('dovleac', 'dovleac'), ('vinete', 'vinete'), ('vanata', 'vinete'),
    ('varza rosie', 'varza_rosie'), ('varza murata', 'varza_murata'), ('varza', 'varza'), ('conopida', 'conopida'), ('broccoli', 'broccoli'),
    ('spanac', 'spanac'), ('stevie', 'spanac'), ('urzici', 'spanac'), ('loboda', 'spanac'), ('ciuperci', 'ciuperci'), ('pleurotus', 'ciuperci'),
    ('salata verde', 'salata'), ('salata', 'salata'), ('rucola', 'rucola'), ('patrunjel', 'patrunjel'), ('verdeata', 'patrunjel'), ('marar', 'marar'),
    ('leustean', 'leustean'), ('busuioc proaspat', 'busuioc_verde'), ('frunze de busuioc', 'busuioc_verde'), ('busuioc', 'busuioc'), ('coriandru', 'coriandru'),
    ('menta', 'menta'), ('avocado', 'avocado'), ('porumb', 'porumb'), ('mazare', 'mazare'), ('fasole verde', 'fasole_verde'), ('legume congelate', 'legume_mix'),
    ('banane', 'banana'), ('banana', 'banana'), ('mere', 'mar'), ('mar', 'mar'), ('pere', 'pere'), ('para', 'pere'), ('portocale', 'portocale'), ('portocala', 'portocale'),
    ('kiwi', 'kiwi'), ('struguri', 'struguri'), ('lamaie', 'lamaie'), ('lamai', 'lamaie'), ('zeama de lamaie', 'lamaie'), ('lime', 'lamaie'), ('mango', 'mango'),
    ('ananas', 'ananas'), ('fructe de padure', 'fructe_padure'), ('afine', 'fructe_padure'), ('zmeura', 'fructe_padure'), ('visine', 'fructe_padure'), ('cirese', 'fructe_padure'),
    ('capsuni', 'capsuni'), ('prune uscate', 'prune_uscate'), ('prune', 'prune_uscate'), ('stafide', 'stafide'), ('curmale', 'curmale'),
    ('fasole alba', 'fasole_conserva'), ('fasole boabe', 'fasole_conserva'), ('fasole rosie', 'fasole_rosie'), ('fasole neagra', 'fasole_neagra'), ('fasole', 'fasole_conserva'),
    ('naut', 'naut'), ('suc de rosii', 'rosii_pasate'), ('bulion', 'rosii_pasate'), ('rosii din conserva', 'rosii_pasate'), ('passata', 'rosii_pasate'), ('pulpa de rosii', 'rosii_pasate'),
    ('rosii decojite', 'rosii_pasate'), ('pasta de tomate', 'pasta_tomate'), ('pasta de rosii', 'pasta_tomate'), ('masline', 'masline'), ('foi de vita', 'foi_vita'),
    ('lapte de cocos', 'lapte_cocos'), ('bors', 'bors'), ('zeama de varza', 'bors'), ('sos de soia', 'sos_soia'), ('nuca', 'nuci'), ('nuci', 'nuci'), ('migdale', 'migdale'),
    ('alune', 'alune'), ('caju', 'caju'), ('arahide', 'arahide'), ('seminte de dovleac', 'seminte_dovleac'), ('seminte de floarea soarelui', 'seminte_floarea'),
    ('susan', 'susan'), ('chia', 'chia'), ('unt de arahide', 'unt_arahide'), ('tahini', 'tahini'), ('miere', 'miere'), ('zahar', 'zahar'), ('zahar pudra', 'zahar'),
    ('gem', 'gem'), ('dulceata', 'gem'), ('magiun', 'gem'), ('biscuiti', 'biscuiti'), ('piscoturi', 'biscuiti'), ('cacao', 'cacao'), ('ciocolata', 'ciocolata'),
    ('mustar', 'mustar'), ('maioneza', 'maioneza'), ('ketchup', 'ketchup'), ('otet balsamic', 'otet_balsamic'), ('vin rosu', 'vin_rosu'), ('vin alb', 'vin_alb'), ('vin', 'vin_alb'),
    ('sare', 'sare'), ('piper', 'piper'), ('boia iute', 'boia_iute'), ('boia', 'boia'), ('paprika', 'boia'), ('oregano', 'oregano'), ('cimbru', 'cimbru'),
    ('rozmarin', 'rozmarin'), ('foi de dafin', 'foi_dafin'), ('dafin', 'foi_dafin'), ('chimen', 'chimen'), ('scortisoara', 'scortisoara'), ('curry', 'curry'),
    ('turmeric', 'turmeric'), ('nucsoara', 'nucsoara'), ('praf de copt', 'praf_copt'), ('bicarbonat', 'praf_copt'), ('drojdie', 'drojdie'), ('otet', 'otet'),
    ('esenta de vanilie', 'vanilie'), ('vanilie', 'vanilie'), ('zahar vanilat', 'zahar'), ('vegeta', 'cub_supa'), ('cub de supa', 'cub_supa'), ('supa de pui', None),
    ('supa de legume', None), ('supa', None), ('apa', None), ('gheata', None), ('cuisoare', None), ('ienibahar', None), ('tarhon', 'cimbru'), ('maghiran', 'cimbru'),
    ('zeama', None), ('bere', None), ('rom', None), ('tuica', None), ('cimbrisor', 'cimbru'), ('sos worcestershire', None), ('sirop', 'zahar'),
    ('cepe verzi', 'ceapa_verde'), ('cepe', 'ceapa'), ('chimion', 'chimen'), ('cumin', 'chimen'), ('mirin', None), ('fenicul', None), ('gelatina', None),
    ('cuisor', None), ('hrean', None), ('gorgonzola', 'cascaval'), ('brie', 'cascaval'), ('camembert', 'cascaval'), ('limete', 'lamaie'), ('limeta', 'lamaie'),
    ('usutroi', 'usturoi'), ('pastravi', 'pastrav'), ('nutella', 'ciocolata'), ('fistic', 'nuci'), ('cardamom', None), ('garam masala', 'garam_masala'),
    ('sos de stridii', None), ('sos de peste', None), ('tamarind', None), ('pasta de ardei', 'ardei'), ('pasta de chili', 'ardei_iute'), ('otet de mere', 'otet'), ('otet de vin', 'otet'), ('suc de lamaie', 'lamaie'), ('coaja de lamaie', None), ('coaja de portocala', None),
    ('zeama de la o lamaie', 'lamaie'), ('anason', None), ('dashi', None), ('miso', None), ('sake', None), ('coniac', None), ('lichior', None), ('esenta', None),
    ('colorant', None), ('zahar brun', 'zahar'), ('zahar tos', 'zahar'), ('fulgi de chili', 'chili'), ('pudra de ceapa', None), ('praf de usturoi', 'usturoi'),
    ('sos picant', None), ('tabasco', None), ('capere', None), ('ghee', 'unt'), ('unt clarifiat', 'unt'), ('smantana de gatit', 'frisca'), ('telina apio', 'telina'),
    ('ardei capia', 'ardei'), ('ardei rosu', 'ardei'), ('ardei verde', 'ardei'), ('ardei galben', 'ardei'), ('rosii uscate', 'pasta_tomate'), ('bulion de rosii', 'rosii_pasate'),
    ('lapte de vaca', 'lapte'), ('pulpe de rata', 'pui_pulpe_os'), ('rata', 'pui_pulpe_os'), ('gasca', 'pui_pulpe_os'), ('iepure', 'pui_pulpe_os'), ('vanat', 'vita_pulpa'),
    ('mazare verde', 'mazare'), ('morcovi baby', 'morcov'), ('ciuperci champignon', 'ciuperci'), ('hribi', 'ciuperci'), ('ciuperci de padure', 'ciuperci'),
]
MAP.sort(key=lambda kv: -len(kv[0]))
_RX = [(re.compile(r'(?<![a-z])' + re.escape(k) + r'(?![a-z])'), v, k) for k, v in MAP]

# greutăți tipice pe bucată / unitate (g)
PIECE = {
    'oua': 55, 'ceapa': 120, 'usturoi': 5, 'morcov': 100, 'cartofi': 150, 'ardei': 150, 'ardei_iute': 15, 'rosii': 150, 'castraveti': 200,
    'dovlecei': 250, 'vinete': 300, 'lamaie': 100, 'portocale': 180, 'mar': 170, 'pere': 180, 'banana': 120, 'avocado': 170, 'telina': 300,
    'pastarnac': 120, 'praz': 200, 'varza': 1500, 'conopida': 800, 'broccoli': 400, 'sfecla': 200, 'ceapa_verde': 15, 'patrunjel': 30,
    'marar': 30, 'leustean': 20, 'pui_intreg': 1500, 'pui_piept': 200, 'pui_pulpe_os': 250, 'pui_pulpe': 120, 'cotlet_porc': 200,
    'carnati': 100, 'carnati_proaspeti': 100, 'crenvursti': 50, 'foi_dafin': 0.3, 'chifle': 70, 'tortilla': 60, 'pita': 70, 'bagheta': 250,
    'paine': 500, 'cartofi_dulci': 250, 'kiwi': 75, 'mango': 300, 'ridichi': 15, 'dovleac': 1000, 'drojdie': 7, 'praf_copt': 10, 'vanilie': 5,
    'cub_supa': 10, 'mozzarella': 125, 'muschi_porc': 450, 'masline': 4, 'ridichi': 15, 'capsuni': 15, 'nuci': 5, 'varza_rosie': 1000, 'miel': 1500, 'vita_pulpa': 800, 'somon': 200, 'pastrav': 300, 'curmale': 8,
    'macrou': 300, 'cod': 200, 'ceafa_porc': 250, 'coaste_porc': 1000, 'pulpa_porc': 800, 'antricot_vita': 250, 'curcan_piept': 500, 'telemea': 200,
    'branza_vaci': 250, 'feta': 200, 'ricotta': 250, 'mascarpone': 250, 'crema_branza': 200, 'iaurt_grec': 150, 'nuci': 5, 'migdale': 1.2, 'prune_uscate': 8, 'unt': 200, 'smantana': 200, 'iaurt': 150, 'ciocolata': 100, 'foietaj': 400, 'foi_placinta': 400,
}
UNIT = [  # (expresie, grame per unitate; None = depinde de densitate)
    (r'kg|kilogram\w*', 1000), (r'g|gr|grame?|gram', 1), (r'l|litr\w*', 1000), (r'ml|mililitr\w*|militr\w*', 1), (r'dl|decilitr\w*', 100),
    (r'lingurit\w*|lingurite|lgt\.?', 5), (r'lingur\w*|lg\.?|lgr', 15), (r'can\w*|cesti|ceasca|pahar\w*', 240),
    (r'varf de cutit|praf|un praf', 1), (r'legatur\w*|manunchi', 30), (r'catel\w*', 5), (r'felii|felie', None), (r'plic\w*', 10), (r'cutie|conserv\w*|borcan\w*', 400),
    (r'bucat\w*|buc\.?', None), (r'fire|fir', 5), (r'crengut\w*|ramur\w*', 2), (r'tij\w*|cotor\w*', 40), (r'frunz\w*', 1), (r'tulpin\w*', 40), (r'radacin\w*', 120),
]
CUP_G = {'faina': 130, 'zahar': 200, 'orez': 190, 'lapte': 245, 'ovaz': 90, 'malai': 160, 'gris': 170, 'pesmet': 110, 'smantana': 240, 'iaurt': 240, 'cacao': 85, 'nuci': 120}
SPOON_G = {'faina': 8, 'zahar': 12, 'ulei': 13, 'ulei_masline': 13, 'unt': 14, 'smantana': 15, 'miere': 20, 'otet': 15, 'pasta_tomate': 16, 'boia': 7, 'sare': 18,
           'cacao': 7, 'amidon': 8, 'mustar': 15, 'maioneza': 14, 'gem': 20, 'iaurt': 15}
WORDNUM = {'un': 1, 'una': 1, 'o': 1, 'doi': 2, 'doua': 2, 'trei': 3, 'patru': 4, 'cinci': 5, 'sase': 6, 'jumatate': 0.5, 'jumatate de': 0.5, 'cateva': 3, 'putin': 0.3, 'putina': 0.3}
STAPLE_ZERO = {'sare', 'piper'}


def _num(tok):
    tok = tok.replace(',', '.').replace('½', '.5').replace('¼', '.25').replace('¾', '.75')
    if '/' in tok:
        a, b = tok.split('/', 1)
        try: return float(a or 1) / float(b)
        except ValueError: return None
    try: return float(tok)
    except ValueError: return None


SLICE_PIECE = {'cotlet_porc', 'ceafa_porc', 'pulpa_porc', 'muschi_porc', 'vita_pulpa', 'antricot_vita', 'somon', 'cod', 'curcan_piept', 'pui_piept'}
KEY_PIECE = {'pui': 1400, 'piept de rata': 350, 'piepti de rata': 350, 'rata': 2000, 'gasca': 3500, 'iepure': 1500, 'pui intreg': 1400, 'un pui': 1400}


def parse(line):
    """-> (id sau None, grame sau None, găsit: bool, text normalizat)"""
    low = line.lower()
    # „2 pulpe de gâscă (800 de grame)”: greutatea din paranteză e mai bună decât cea estimată pe bucată
    pg = re.search(r'\(\s*(?:cca\.?|aprox\.?|circa|~)?\s*(\d+(?:[.,]\d+)?)\s*(?:de\s*)?(kg|g|gr|grame)\b', low)
    t = norm(re.sub(r'\(.*?\)', ' ', line))
    # primul ingredient numit în text („1 pui mic sau aripi de pui” = pui); la egalitate, cel mai lung
    hit, best = None, None
    for rx, v, k in _RX:
        mm = rx.search(t)
        if mm and (best is None or mm.start() < best):
            hit, best = (v, k), mm.start()
    if not hit:
        return None, None, False, t
    iid, key = hit
    if iid is None:
        return None, 0, True, t
    # cantitatea: număr + unitate la început (sau „o ceapă”, „2-3 cartofi” -> 2.5)
    t2 = re.sub(r'^(?:optional|facultativ|eventual)\s*', '', t)
    m = re.match(r'^(?:aprox\.?\s*|circa\s*|cca\.?\s*)?([\d.,/½¼¾]+(?:\s*-\s*[\d.,/]+)?|(?:un|una|o|doi|doua|trei|patru|cinci|sase|jumatate(?: de)?|cateva|putin|putina)(?![a-z]))\s*(?:de\s+(?=(?:kg|kilograme?|g|gr|grame|ml|l|litri?|litru|mililitr\w*|militr\w*|dl|cani|cana|linguri\w*|lingur\w*)\b))?([a-z.]*)', t2)
    qty, unit = None, ''
    if m:
        a = m.group(1)
        if '-' in a and a[0].isdigit():
            x, y = [_num(p.strip()) for p in a.split('-', 1)]
            qty = (x + y) / 2 if x is not None and y is not None else x
        else:
            qty = WORDNUM.get(a, _num(a))
        unit = m.group(2)
    if iid in STAPLE_ZERO:
        return iid, 2, True, t
    each = False
    if not pg:
        each = True
        pg = re.search(r'\bde (?:\d+(?:[.,]\d+)?\s*-\s*)?(\d+(?:[.,]\d+)?)\s*(kg|kilograme?|g|gr|grame)\b', t)
        ac = re.search(r'\ba cate (?:\d+\s*-\s*)?(\d+)\s*(?:de\s*)?(?:g|gr|grame)\b', t)
        if ac and m and qty:
            return iid, qty * float(ac.group(1)), True, t
    if pg and iid:
        g = float(pg.group(1).replace(',', '.')) * (1000 if pg.group(2).startswith('k') else 1)
        # „8 ardei de 100 de grame” = greutatea unuia; în paranteză e de obicei totalul
        weighed = bool(unit and re.fullmatch(r'kg|kilogram\w*|g|gr|grame?|ml|l|litr\w*|lingur\w*|can\w*', unit.rstrip('.')))
        if each and qty and qty > 1 and not weighed:
            g *= qty
        if g > 5 and not (each and weighed):
            return iid, g, True, t
    if qty is None:
        # fără cantitate: „sare, piper”, „verdeață”: puțin
        return iid, {'patrunjel': 10, 'marar': 10, 'leustean': 5, 'usturoi': 5}.get(iid, 5 if iid in ('boia', 'oregano', 'cimbru', 'busuioc', 'rozmarin', 'chimen', 'scortisoara', 'nucsoara', 'ulei', 'ulei_masline', 'otet') else 0), True, t
    for rx, g in UNIT:
        if unit and re.fullmatch(rx, unit.rstrip('.')):
            if g is None:
                if unit.startswith('feli') and iid not in SLICE_PIECE:
                    return iid, qty * {'paine': 35, 'paine_integrala': 35, 'sunca': 15, 'bacon': 12, 'costita': 12, 'salam': 10, 'cascaval': 20, 'mozzarella': 25, 'telemea': 30, 'lamaie': 10}.get(iid, 30), True, t
                return iid, qty * PIECE.get(iid, 100), True, t
            if g == 240:
                return iid, qty * CUP_G.get(iid, 240), True, t
            if g == 15:
                return iid, qty * SPOON_G.get(iid, 15), True, t
            if g == 5:
                return iid, qty * SPOON_G.get(iid, 15) / 3, True, t
            if g == 400 and iid in ('rosii_pasate', 'fasole_conserva', 'fasole_rosie', 'naut', 'porumb', 'ton', 'mazare', 'ciuperci'):
                return iid, qty * 400, True, t
            return iid, qty * g, True, t
    # număr fără unitate: bucăți (o rață întreagă nu cântărește cât o pulpă de pui)
    return iid, qty * KEY_PIECE.get(key, PIECE.get(iid, 100)), True, t

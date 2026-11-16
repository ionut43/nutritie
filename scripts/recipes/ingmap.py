"""
Numele ingredientelor din surse (engleză) -> id-urile noastre (src/data/ingredients.ts).
Ordinea contează: se caută cea mai lungă potrivire. None = se ignoră (apă, gheață, sare la gust...).
Ce nu se găsește și are sub 15 g e un condiment: se ignoră. Ce nu se găsește și e mai mult scoate rețeta.
"""
import re

MAP = [
    # apă & nimic
    ('boiling water', None), ('cold water', None), ('warm water', None), ('ice water', None), ('water', None), ('ice', None),
    ('salt and pepper', 'sare'), ('sea salt', 'sare'), ('kosher salt', 'sare'), ('salt', 'sare'),
    ('black pepper', 'piper'), ('white pepper', 'piper'), ('peppercorn', 'piper'), ('cayenne', 'boia_iute'),
    # pui / curcan
    ('chicken breast', 'pui_piept'), ('chicken fillet', 'pui_piept'), ('chicken thigh', 'pui_pulpe'), ('boneless chicken', 'pui_pulpe'),
    ('chicken drumstick', 'pui_pulpe_os'), ('chicken leg', 'pui_pulpe_os'), ('chicken wing', 'aripioare'), ('whole chicken', 'pui_intreg'),
    ('chicken liver', 'ficat_pui'), ('chicken stock', 'cub_supa'), ('chicken broth', 'cub_supa'), ('chicken stock cube', 'cub_supa'),
    ('minced chicken', 'tocata_pui'), ('ground chicken', 'tocata_pui'), ('chicken', 'pui_pulpe_os'),
    ('turkey mince', 'tocata_curcan'), ('ground turkey', 'tocata_curcan'), ('turkey', 'curcan_piept'), ('duck', 'pui_pulpe_os'),
    # vită / miel / porc
    ('beef stock', 'cub_supa'), ('beef broth', 'cub_supa'), ('stock cube', 'cub_supa'), ('vegetable stock', 'cub_supa'), ('stock', 'cub_supa'), ('broth', 'cub_supa'), ('bouillon', 'cub_supa'),
    ('minced beef', 'tocata_vita'), ('ground beef', 'tocata_vita'), ('beef mince', 'tocata_vita'), ('mincemeat', 'stafide'), ('mince', 'tocata_vita'),
    ('beef steak', 'antricot_vita'), ('sirloin', 'antricot_vita'), ('ribeye', 'antricot_vita'), ('rib eye', 'antricot_vita'), ('fillet steak', 'antricot_vita'), ('steak', 'antricot_vita'),
    ('beef', 'vita_pulpa'), ('veal', 'vita_pulpa'), ('oxtail', 'vita_pulpa'), ('brisket', 'vita_pulpa'), ('tripe', 'vita_pulpa'),
    ('lamb mince', 'tocata_miel'), ('minced lamb', 'tocata_miel'), ('ground lamb', 'tocata_miel'), ('lamb', 'miel'), ('mutton', 'miel'), ('goat', 'miel'),
    ('pork mince', 'tocata_porc'), ('minced pork', 'tocata_porc'), ('ground pork', 'tocata_porc'), ('pork chop', 'cotlet_porc'), ('pork loin', 'muschi_porc'),
    ('pork tenderloin', 'muschi_porc'), ('pork shoulder', 'ceafa_porc'), ('pork belly', 'costita'), ('pork rib', 'coaste_porc'), ('spare rib', 'coaste_porc'), ('ribs', 'coaste_porc'),
    ('pork knuckle', 'pulpa_porc'), ('ham hock', 'pulpa_porc'), ('pork', 'pulpa_porc'),
    ('bacon', 'costita'), ('pancetta', 'costita'), ('guanciale', 'costita'), ('lardons', 'costita'), ('prosciutto', 'sunca'), ('ham', 'sunca'),
    ('chorizo', 'carnati'), ('sausage', 'carnati'), ('salami', 'carnati'), ('kielbasa', 'carnati'), ('frankfurter', 'crenvursti'), ('hot dog', 'crenvursti'),
    # pește
    ('smoked salmon', 'somon_afumat'), ('salmon', 'somon'), ('trout', 'pastrav'), ('mackerel', 'macrou'), ('sardine', 'sardine'), ('anchov', 'sardine'),
    ('tuna', 'ton'), ('prawn', 'creveti'), ('shrimp', 'creveti'), ('squid', 'calamar'), ('calamari', 'calamar'), ('octopus', 'calamar'),
    ('mussel', 'creveti'), ('clam', 'creveti'), ('scallop', 'creveti'), ('crab', 'creveti'), ('lobster', 'creveti'), ('seafood', 'creveti'),
    ('salt cod', 'cod'), ('cod', 'cod'), ('haddock', 'cod'), ('hake', 'cod'), ('pollock', 'cod'), ('tilapia', 'cod'), ('sea bass', 'cod'), ('bream', 'cod'),
    ('monkfish', 'cod'), ('halibut', 'cod'), ('snapper', 'cod'), ('white fish', 'cod'), ('fish fillet', 'cod'), ('fish', 'cod'), ('catfish', 'cod'), ('herring', 'macrou'),
    ('fish sauce', 'sos_soia'), ('oyster sauce', 'sos_soia'), ('soy sauce', 'sos_soia'), ('soya sauce', 'sos_soia'), ('tamari', 'sos_soia'), ('worcestershire', 'sos_soia'),
    # lactate & ouă
    ('egg white', 'oua'), ('egg yolk', 'oua'), ('eggs', 'oua'), ('egg', 'oua'),
    ('greek yogurt', 'iaurt_grec'), ('greek yoghurt', 'iaurt_grec'), ('yogurt', 'iaurt'), ('yoghurt', 'iaurt'), ('buttermilk', 'kefir'), ('kefir', 'kefir'),
    ('condensed milk', 'lapte'), ('evaporated milk', 'lapte'), ('coconut milk', 'lapte_cocos'), ('coconut cream', 'lapte_cocos'), ('almond milk', 'lapte_soia'), ('soy milk', 'lapte_soia'), ('milk', 'lapte'),
    ('cream cheese', 'crema_branza'), ('cottage cheese', 'branza_vaci'), ('quark', 'branza_vaci'), ('ricotta', 'ricotta'), ('mascarpone', 'mascarpone'),
    ('feta', 'feta'), ('halloumi', 'telemea'), ('paneer', 'telemea'), ('goat cheese', 'telemea'), ('goats cheese', 'telemea'), ('mozzarella', 'mozzarella'), ('burrata', 'mozzarella'),
    ('parmesan', 'parmezan'), ('parmigiano', 'parmezan'), ('pecorino', 'parmezan'), ('grana padano', 'parmezan'),
    ('cheddar', 'cascaval'), ('gruyere', 'cascaval'), ('gruyère', 'cascaval'), ('emmental', 'cascaval'), ('gouda', 'cascaval'), ('monterey jack', 'cascaval'), ('cheese', 'cascaval'),
    ('sour cream', 'smantana'), ('creme fraiche', 'smantana'), ('crème fraîche', 'smantana'), ('double cream', 'frisca'), ('heavy cream', 'frisca'), ('whipping cream', 'frisca'),
    ('single cream', 'frisca'), ('cream', 'frisca'), ('ghee', 'unt'), ('butter', 'unt'), ('margarine', 'unt'),
    # uleiuri, grăsimi
    ('olive oil', 'ulei_masline'), ('sesame oil', 'ulei'), ('coconut oil', 'ulei'), ('vegetable oil', 'ulei'), ('sunflower oil', 'ulei'), ('canola oil', 'ulei'), ('oil', 'ulei'), ('lard', 'unt'), ('dripping', 'unt'),
    # cereale & paste
    ('plain flour', 'faina'), ('all purpose flour', 'faina'), ('all-purpose flour', 'faina'), ('self-raising flour', 'faina'), ('self raising flour', 'faina'), ('bread flour', 'faina'),
    ('wholemeal flour', 'faina'), ('cornflour', 'amidon'), ('corn flour', 'amidon'), ('cornstarch', 'amidon'), ('corn starch', 'amidon'), ('potato starch', 'amidon'), ('rice flour', 'faina'), ('chickpea flour', 'faina'), ('flour', 'faina'),
    ('basmati', 'orez'), ('jasmine rice', 'orez'), ('arborio', 'orez'), ('risotto rice', 'orez'), ('sushi rice', 'orez'), ('rice noodle', 'taitei_orez'), ('rice paper', 'taitei_orez'), ('bean sprout', 'legume_mix'), ('cassava', 'cartofi'), ('yucca', 'cartofi'), ('swede', 'pastarnac'), ('suet', 'unt'), ('shortening', 'unt'), ('dulce de leche', 'lapte'), ('custard', 'lapte'), ('dried fruit', 'stafide'), ('candied peel', 'stafide'), ('morcilla', 'carnati'), ('black pudding', 'carnati'), ('tomatillo', 'rosii'), ('masa harina', 'malai'), ('bamboo shoot', 'legume_mix'), ('marzipan', 'migdale'), ('manchego', 'cascaval'), ('brie', 'cascaval'), ('hummus', 'naut'), ('kecap manis', 'sos_soia'), ('tempeh', 'tofu'), ('pomegranate', 'struguri'), ('ciabatta', 'paine'), ('horseradish', 'mustar'), ('stir-fry vegetables', 'legume_mix'), ('raw vegetables', 'legume_mix'), ('grits', 'malai'), ('freekeh', 'bulgur'), ('oyster', 'creveti'), ('barramundi', 'cod'), ('soya bean', 'fasole_conserva'), ('soy bean', 'fasole_conserva'), ('challot', 'ceapa'), ('roasted pepper', 'ardei'), ('padron', 'ardei'), ('papaya', 'mango'), ('passion fruit', 'mango'), ('chips', 'cartofi'), ('mars bar', 'ciocolata'), ('vermicelli', 'taitei_orez'), ('rice', 'orez'),
    ('egg noodle', 'taitei'), ('udon', 'taitei'), ('ramen', 'taitei'), ('soba', 'taitei'), ('noodle', 'taitei'),
    ('lasagne', 'lasagna'), ('lasagna', 'lasagna'), ('spaghetti', 'paste'), ('linguine', 'paste'), ('fettuccine', 'paste'), ('tagliatelle', 'paste'), ('pappardelle', 'paste'),
    ('penne', 'paste'), ('rigatoni', 'paste'), ('bucatini', 'paste'), ('fusilli', 'paste'), ('macaroni', 'paste'), ('farfalle', 'paste'), ('orzo', 'paste'), ('gnocchi', 'paste'), ('pasta', 'paste'),
    ('oats', 'ovaz'), ('oatmeal', 'ovaz'), ('porridge', 'ovaz'), ('polenta', 'malai'), ('cornmeal', 'malai'), ('semolina', 'gris'), ('bulgur', 'bulgur'), ('couscous', 'cuscus'), ('quinoa', 'quinoa'), ('buckwheat', 'hrisca'), ('barley', 'bulgur'),
    ('breadcrumbs', 'pesmet'), ('panko', 'pesmet'), ('bread crumbs', 'pesmet'),
    ('tortilla', 'tortilla'), ('wrap', 'tortilla'), ('pitta', 'pita'), ('pita', 'pita'), ('naan', 'pita'), ('flatbread', 'pita'), ('baguette', 'bagheta'), ('bun', 'chifle'), ('brioche', 'chifle'),
    ('wholemeal bread', 'paine_integrala'), ('bread', 'paine'), ('puff pastry', 'foietaj'), ('filo', 'foi_placinta'), ('phyllo', 'foi_placinta'), ('shortcrust pastry', 'foietaj'), ('pastry', 'foietaj'),
    ('yeast', 'drojdie'), ('baking powder', 'praf_copt'), ('baking soda', 'praf_copt'), ('bicarbonate', 'praf_copt'),
    # leguminoase
    ('red lentil', 'linte'), ('green lentil', 'linte_verde'), ('lentil', 'linte'), ('split pea', 'mazare_uscata'), ('chickpea', 'naut'), ('garbanzo', 'naut'),
    ('black bean', 'fasole_neagra'), ('kidney bean', 'fasole_rosie'), ('red bean', 'fasole_rosie'), ('cannellini', 'fasole_conserva'), ('butter bean', 'fasole_conserva'),
    ('haricot', 'fasole_conserva'), ('white bean', 'fasole_conserva'), ('pinto', 'fasole_rosie'), ('borlotti', 'fasole_rosie'), ('baked beans', 'fasole_conserva'), ('black-eyed', 'fasole_conserva'),
    ('green bean', 'fasole_verde'), ('runner bean', 'fasole_verde'), ('french bean', 'fasole_verde'), ('broad bean', 'mazare'), ('edamame', 'mazare'), ('beans', 'fasole_conserva'),
    ('tofu', 'tofu'),
    # legume
    ('sweet potato', 'cartofi_dulci'), ('potato', 'cartofi'), ('spring onion', 'ceapa_verde'), ('green onion', 'ceapa_verde'), ('scallion', 'ceapa_verde'), ('chive', 'ceapa_verde'),
    ('shallot', 'ceapa'), ('red onion', 'ceapa'), ('onion', 'ceapa'), ('leek', 'praz'), ('garlic', 'usturoi'), ('ginger', 'ghimbir'), ('galangal', 'ghimbir'),
    ('carrot', 'morcov'), ('parsnip', 'pastarnac'), ('celeriac', 'telina'), ('celery', 'telina'), ('beetroot', 'sfecla'), ('beet', 'sfecla'),
    ('scotch bonnet', 'ardei_iute'), ('jalapeno', 'ardei_iute'), ('jalapeño', 'ardei_iute'), ('green chilli', 'ardei_iute'), ('red chilli', 'ardei_iute'), ('chilli flakes', 'chili'), ('chili flakes', 'chili'),
    ('chilli powder', 'chili'), ('chili powder', 'chili'), ('chipotle', 'chili'), ('chilli', 'ardei_iute'), ('chili', 'ardei_iute'), ('chile', 'ardei_iute'),
    ('bell pepper', 'ardei'), ('red pepper', 'ardei'), ('green pepper', 'ardei'), ('yellow pepper', 'ardei'), ('capsicum', 'ardei'), ('sweet pepper', 'ardei'), ('pimiento', 'ardei'),
    ('sun-dried tomato', 'rosii'), ('sundried tomato', 'rosii'), ('cherry tomato', 'rosii'), ('chopped tomatoes', 'rosii_pasate'), ('canned tomato', 'rosii_pasate'), ('tinned tomato', 'rosii_pasate'),
    ('plum tomato', 'rosii_pasate'), ('passata', 'rosii_pasate'), ('tomato sauce', 'rosii_pasate'), ('tomato puree', 'pasta_tomate'), ('tomato purée', 'pasta_tomate'), ('tomato paste', 'pasta_tomate'),
    ('ketchup', 'ketchup'), ('tomato', 'rosii'),
    ('cucumber', 'castraveti'), ('radish', 'ridichi'), ('zucchini', 'dovlecei'), ('courgette', 'dovlecei'), ('butternut', 'dovleac'), ('pumpkin', 'dovleac'), ('squash', 'dovleac'),
    ('aubergine', 'vinete'), ('eggplant', 'vinete'), ('sauerkraut', 'varza_murata'), ('red cabbage', 'varza_rosie'), ('cabbage', 'varza'), ('pak choi', 'varza'), ('bok choy', 'varza'), ('kale', 'spanac'),
    ('cauliflower', 'conopida'), ('broccoli', 'broccoli'), ('spinach', 'spanac'), ('chard', 'spanac'), ('mushroom', 'ciuperci'), ('shiitake', 'ciuperci'), ('porcini', 'ciuperci'),
    ('lettuce', 'salata'), ('romaine', 'salata'), ('salad leaves', 'salata'), ('watercress', 'rucola'), ('rocket', 'rucola'), ('arugula', 'rucola'),
    ('parsley', 'patrunjel'), ('dill', 'marar'), ('lovage', 'leustean'), ('basil', 'busuioc_verde'), ('coriander leaves', 'coriandru'), ('fresh coriander', 'coriandru'), ('cilantro', 'coriandru'),
    ('coriander seed', 'coriandru_macinat'), ('ground coriander', 'coriandru_macinat'), ('coriander', 'coriandru'), ('mint', 'menta'),
    ('avocado', 'avocado'), ('corn on the cob', 'porumb_stiuleti'), ('sweetcorn', 'porumb'), ('sweet corn', 'porumb'), ('corn', 'porumb'), ('peas', 'mazare'), ('pea', 'mazare'),
    ('mixed vegetables', 'legume_mix'), ('frozen vegetables', 'legume_mix'), ('okra', 'fasole_verde'), ('asparagus', 'fasole_verde'), ('artichoke', 'legume_mix'), ('fennel', 'telina'), ('turnip', 'pastarnac'),
    ('plantain', 'banana'), ('banana', 'banana'), ('apple', 'mar'), ('pear', 'pere'), ('orange', 'portocale'), ('kiwi', 'kiwi'), ('grape', 'struguri'), ('lemon', 'lamaie'), ('lime', 'lamaie'),
    ('mango', 'mango'), ('pineapple', 'ananas'), ('berries', 'fructe_padure'), ('blueberr', 'fructe_padure'), ('raspberr', 'fructe_padure'), ('blackberr', 'fructe_padure'), ('cherr', 'fructe_padure'), ('cranberr', 'fructe_padure'),
    ('strawberr', 'capsuni'), ('prune', 'prune_uscate'), ('apricot', 'prune_uscate'), ('raisin', 'stafide'), ('sultana', 'stafide'), ('currant', 'stafide'), ('date', 'curmale'), ('fig', 'curmale'), ('coconut', 'nuci'), ('peach', 'mango'), ('plum', 'prune_uscate'), ('rhubarb', 'mar'),
    ('olive', 'masline'), ('gherkin', 'castraveti_murati'), ('pickle', 'castraveti_murati'), ('caper', 'masline'), ('vine leaves', 'foi_vita'),
    ('curry paste', 'pasta_curry'), ('sweet chilli sauce', 'sos_chili'), ('chilli sauce', 'sos_chili'), ('hot sauce', 'sos_chili'), ('sriracha', 'sos_chili'), ('harissa', 'sos_chili'), ('gochujang', 'sos_chili'),
    # nuci & semințe
    ('walnut', 'nuci'), ('pecan', 'nuci'), ('almond', 'migdale'), ('hazelnut', 'alune'), ('cashew', 'caju'), ('peanut butter', 'unt_arahide'), ('peanut', 'arahide'), ('pistachio', 'migdale'), ('pine nut', 'migdale'),
    ('pumpkin seed', 'seminte_dovleac'), ('sunflower seed', 'seminte_floarea'), ('sesame seed', 'susan'), ('sesame', 'susan'), ('chia', 'chia'), ('tahini', 'tahini'), ('nuts', 'nuci'),
    # dulci
    ('honey', 'miere'), ('maple syrup', 'miere'), ('golden syrup', 'miere'), ('syrup', 'miere'), ('molasses', 'miere'), ('treacle', 'miere'),
    ('caster sugar', 'zahar'), ('icing sugar', 'zahar'), ('brown sugar', 'zahar'), ('muscovado', 'zahar'), ('demerara', 'zahar'), ('granulated sugar', 'zahar'), ('sugar', 'zahar'),
    ('jam', 'gem'), ('marmalade', 'gem'), ('biscuit', 'biscuiti'), ('digestive', 'biscuiti'), ('cocoa', 'cacao'), ('chocolate', 'ciocolata'), ('vanilla', 'vanilie'),
    # sosuri & condimente
    ('dijon', 'mustar'), ('mustard', 'mustar'), ('mayonnaise', 'maioneza'), ('mayo', 'maioneza'), ('balsamic', 'otet_balsamic'), ('red wine vinegar', 'otet'), ('vinegar', 'otet'),
    ('red wine', 'vin_rosu'), ('white wine', 'vin_alb'), ('dry white wine', 'vin_alb'), ('sherry', 'vin_alb'), ('marsala', 'vin_rosu'), ('port', 'vin_rosu'), ('beer', 'vin_alb'), ('ale', 'vin_alb'), ('stout', 'vin_rosu'), ('cider', 'vin_alb'), ('wine', 'vin_alb'), ('rum', None), ('brandy', None), ('cognac', None), ('vodka', None),
    ('smoked paprika', 'boia'), ('paprika', 'boia'), ('oregano', 'oregano'), ('thyme', 'cimbru'), ('rosemary', 'rozmarin'), ('bay lea', 'foi_dafin'), ('cumin', 'chimen'), ('caraway', 'chimen'),
    ('cinnamon', 'scortisoara'), ('curry powder', 'curry'), ('turmeric', 'turmeric'), ('nutmeg', 'nucsoara'), ('garam masala', 'garam_masala'), ('mixed spice', 'scortisoara'), ('allspice', 'scortisoara'), ('clove', 'scortisoara'),
    ('cardamom', 'garam_masala'), ('star anise', 'scortisoara'), ('five spice', 'scortisoara'), ('fenugreek', 'curry'), ('mustard seed', 'mustar'), ('saffron', 'turmeric'), ('sumac', 'boia'), ("za'atar", 'oregano'), ('herbes de provence', 'cimbru'), ('mixed herbs', 'oregano'), ('italian seasoning', 'oregano'), ('sage', 'cimbru'), ('tarragon', 'cimbru'), ('marjoram', 'oregano'),
    ('gelatin', None), ('gelatine', None), ('food colouring', None), ('food coloring', None), ('lemongrass', 'ghimbir'), ('kaffir lime', 'lamaie'), ('lime leaves', 'lamaie'), ('tamarind', 'lamaie'), ('miso', 'sos_soia'), ('mirin', 'vin_alb'), ('sake', 'vin_alb'), ('rice wine', 'vin_alb'), ('shaoxing', 'vin_alb'), ('hoisin', 'sos_soia'), ('teriyaki', 'sos_soia'), ('bbq sauce', 'ketchup'), ('barbecue sauce', 'ketchup'), ('salsa', 'rosii_pasate'), ('pesto', 'busuioc_verde'),
]
MAP.sort(key=lambda x: -len(x[0]))
_cache = {}


MAP += [
    ('vegetable millk', 'lapte'), ('vegetable milk', 'lapte'), ('all-purpose seasoning', None), ('cafe la llave', None), ('strong espresso', None), ('espresso', None),
    ('morning glory', 'spanac'), ('mulukhiyah', 'spanac'), ('callaloo', 'spanac'), ('graham cracker', 'biscuiti'), ('maria cookies', 'biscuiti'), ('savoiardi', 'biscuiti'),
    ('pretzels', 'biscuiti'), ('miniature marshmallows', 'zahar'), ('marshmallow', 'zahar'), ('meringue nests', 'zahar'), ('turkish delight', 'zahar'), ('caramel', 'zahar'),
    ('dutch stroop', 'miere'), ('sirop de liège', 'miere'), ('redcurrants', 'fructe_padure'), ('fruit mix', 'fructe_padure'), ('mixed peel', 'stafide'),
    ('ras el hanout', 'garam_masala'), ('fries', 'cartofi'), ('doner meat', 'miel'), ('petit pois', 'mazare'), ('shredded meat', 'vita_pulpa'), ('hind shank', 'vita_pulpa'),
    ('achiote', 'boia'), ('habanero', 'ardei_iute'), ('ají', 'ardei_iute'), ('aji ', 'ardei_iute'), ('rocoto', 'ardei_iute'), ('kampot pepper', 'piper'), ('hot pepper', 'ardei_iute'), ('chili pepper', 'ardei_iute'), ('pepper', 'ardei'),
    ('tapioca', 'amidon'), ('pico de gallo', 'rosii'), ('conchs', 'calamar'), ('conch', 'calamar'), ('sevaiiya', 'paste'), ('malai', 'frisca'), ('nougatine', 'nuci'),
    ('cassaba', 'cartofi'), ('yautia', 'cartofi'), ('white yam', 'cartofi'), ('grand marnier', None), ('cacao', 'cacao'), ('prahok', None),
]
MAP.sort(key=lambda kv: -len(kv[0]))

def norm(s: str) -> str:
    s = s.lower().replace('’', "'")
    s = re.sub(r'\(.*?\)', ' ', s)
    return ' ' + re.sub(r'[^a-z0-9\'éèêàâîïôûüç-]+', ' ', s).strip() + ' '

def map_ing(name: str):
    """(id | None, găsit?)"""
    n = norm(name)
    if n in _cache: return _cache[n]
    for k, v in MAP:
        if (' ' + k) in n or n.strip().startswith(k):
            _cache[n] = (v, True)
            return _cache[n]
    _cache[n] = (None, False)
    return _cache[n]

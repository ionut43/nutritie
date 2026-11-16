"""
De unde vine o rețetă -> (bucătăria din aplicație, cât de familiară e pentru cineva din România, 0–1).
Acceptă adjectivele din TheMealDB („Italian”), numele de țări („Cambodia”) și codurile ISO din UniTools („IT”).
Familiaritatea e o judecată de bun-simț: ce găsești des în casele și restaurantele de la noi urcă, ce e rar coboară.
"""

# (bucătărie, familiaritate)
_T = {
    # acasă și vecini
    'RO': ('ro', 1.0), 'MD': ('ro', 1.0),
    'IT': ('it', 0.9),
    'HU': ('eu', 0.85), 'BG': ('eu', 0.85), 'RS': ('eu', 0.85), 'GR': ('med', 0.85), 'TR': ('or', 0.8),
    'FR': ('eu', 0.8), 'ES': ('med', 0.8), 'DE': ('eu', 0.8), 'AT': ('eu', 0.8), 'PL': ('eu', 0.8), 'CZ': ('eu', 0.8),
    'SK': ('eu', 0.8), 'UA': ('eu', 0.8), 'RU': ('eu', 0.75), 'HR': ('med', 0.8), 'BA': ('eu', 0.8), 'SI': ('eu', 0.75),
    'MK': ('eu', 0.8), 'AL': ('med', 0.75), 'XK': ('eu', 0.75), 'ME': ('med', 0.75),
    'GB': ('eu', 0.7), 'IE': ('eu', 0.7), 'PT': ('med', 0.75), 'BE': ('eu', 0.7), 'NL': ('eu', 0.7), 'LU': ('eu', 0.7),
    'CH': ('eu', 0.75), 'AD': ('med', 0.7), 'MT': ('med', 0.65), 'CY': ('med', 0.75),
    'SE': ('eu', 0.6), 'NO': ('eu', 0.55), 'DK': ('eu', 0.6), 'FI': ('eu', 0.55), 'IS': ('eu', 0.45),
    'EE': ('eu', 0.55), 'LV': ('eu', 0.55), 'LT': ('eu', 0.6),
    'US': ('us', 0.65), 'CA': ('us', 0.6), 'AU': ('us', 0.55), 'NZ': ('us', 0.5),
    'MX': ('mx', 0.55),
    'CN': ('as', 0.5), 'JP': ('as', 0.45), 'TH': ('as', 0.45), 'IN': ('in', 0.45), 'KR': ('as', 0.4), 'VN': ('as', 0.4),
    'LB': ('or', 0.55), 'SY': ('or', 0.5), 'MA': ('or', 0.45), 'TN': ('or', 0.4), 'EG': ('or', 0.4), 'AM': ('or', 0.5), 'GE': ('or', 0.5),
    'AZ': ('or', 0.45), 'IL': ('or', 0.5), 'IR': ('or', 0.4), 'SA': ('or', 0.35), 'DZ': ('or', 0.35),
    'AR': ('mx', 0.45), 'UY': ('mx', 0.4), 'BR': ('mx', 0.4), 'CU': ('mx', 0.4), 'PE': ('mx', 0.4),
}
_DEFAULT_ASIA = ('as', 0.3)
_DEFAULT = ('mx', 0.25)
_ASIA = {'MY', 'SG', 'ID', 'PH', 'KH', 'LA', 'MM', 'TW', 'HK', 'MN', 'KZ', 'UZ', 'KG', 'TJ', 'LK', 'PK', 'BD', 'NP', 'AF'}
_AFRICA_ME = {'ET', 'KE', 'NG', 'SN', 'GH', 'ZA', 'TZ', 'CM', 'CI', 'ML', 'SD', 'SO', 'UG', 'ZW', 'BW', 'AO', 'MZ', 'CD', 'MG', 'IQ', 'JO', 'AE', 'YE'}

# TheMealDB: adjective și nume de țări -> cod ISO
_NAMES = {
    'Italian': 'IT', 'Greek': 'GR', 'Spanish': 'ES', 'Portuguese': 'PT', 'Croatian': 'HR', 'Turkish': 'TR', 'Moroccan': 'MA',
    'Egyptian': 'EG', 'Tunisian': 'TN', 'Algerian': 'DZ', 'Syrian': 'SY', 'Saudi Arabian': 'SA', 'Lebanese': 'LB', 'Kenyan': 'KE',
    'Chinese': 'CN', 'Japanese': 'JP', 'Thai': 'TH', 'Vietnamese': 'VN', 'Malaysian': 'MY', 'Filipino': 'PH', 'Indonesian': 'ID',
    'Korean': 'KR', 'Indian': 'IN', 'India': 'IN', 'Mexican': 'MX', 'Venezuela': 'VE', 'Argentina': 'AR', 'Uruguayan': 'UY',
    'Jamaican': 'JM', 'American': 'US', 'United States': 'US', 'Canadian': 'CA', 'Australian': 'AU', 'British': 'GB', 'Irish': 'IE',
    'French': 'FR', 'France': 'FR', 'Polish': 'PL', 'Ukrainian': 'UA', 'Russian': 'RU', 'Dutch': 'NL', 'Netherlands': 'NL', 'Norway': 'NO',
    'Romanian': 'RO', 'Hungarian': 'HU', 'German': 'DE', 'Austria': 'AT', 'Belgium': 'BE', 'Denmark': 'DK', 'Bulgaria': 'BG',
    'Albania': 'AL', 'Estonia': 'EE', 'Armenia': 'AM', 'Azerbaijan': 'AZ', 'Andorra': 'AD', 'Cambodia': 'KH', 'Laos': 'LA',
    'Bangladesh': 'BD', 'Afghanistan': 'AF', 'Brazil': 'BR', 'Chile': 'CL', 'Colombia': 'CO', 'Cuba': 'CU', 'Costa Rica': 'CR',
    'Dominica': 'DM', 'Cayman Islands': 'KY', 'Barbados': 'BB', 'Aruba': 'AW', 'Antigua and Barbuda': 'AG', 'Bahamas': 'BS',
    'Botswana': 'BW', 'Angola': 'AO',
}


def origin(area):
    """-> (cod ISO sau None, bucătărie, familiaritate)"""
    if not area:
        return None, 'eu', 0.6
    code = area if len(area) == 2 and area.isupper() else _NAMES.get(area)
    if not code:
        return None, 'eu', 0.5
    if code in _T:
        c, f = _T[code]
    elif code in _ASIA:
        c, f = _DEFAULT_ASIA
    elif code in _AFRICA_ME:
        c, f = ('or', 0.25)
    else:
        c, f = _DEFAULT
    return code, c, f


# ingrediente care fac o rețetă să pară străină (în feluri sărate)
EXOTIC = {'lapte_cocos': 0.15, 'sos_peste': 0.1, 'tofu': 0.1, 'pasta_curry': 0.1, 'tamarind': 0.15, 'banana_verde': 0.15}


# ingrediente obișnuite în bucătăria de acasă: o rețetă făcută doar din ele pare familiară, oricare i-ar fi țara
COMMON = set("""
pui_piept pui_pulpe pui_pulpe_os pui_intreg aripioare tocata_pui curcan_piept porc_ceafa ceafa_porc pulpa_porc cotlet_porc coaste_porc costita
tocata_porc tocata_vita tocata_mixta vita_pulpa antricot_vita miel carnati carnati_proaspeti sunca bacon salam ficat_pui
oua lapte smantana frisca unt iaurt iaurt_grec branza_vaci telemea cascaval mozzarella parmezan kefir
cartofi ceapa usturoi morcov telina pastarnac patrunjel marar rosii rosii_pasate pasta_tomate ardei ardei_iute castraveti varza varza_murata
dovlecei vinete fasole_verde mazare ciuperci spanac salata broccoli conopida praz sfecla porumb fasole fasole_alba fasole_rosie linte naut
orez paste spaghete taitei faina malai gris pesmet paine bagheta foietaj drojdie
mere pere prune struguri lamaie portocale banana capsuni visine cirese caise piersici nuci miere zahar cacao ciocolata vanilie scortisoara
ulei ulei_masline otet sare piper boia boia_iute cimbru oregano foi_dafin busuioc rozmarin cub_supa mustar ketchup maioneza
""".split())
STAPLE = {'sare', 'piper', 'ulei', 'ulei_masline', 'apa', 'otet', 'cub_supa', 'boia', 'foi_dafin', 'cimbru', 'oregano'}


def ingredient_familiar(ing):
    """0.75 dacă rețeta e făcută din lucruri obișnuite (fără ingrediente exotice), altfel None"""
    main = [k for k, g in sorted(ing, key=lambda x: -x[1]) if k not in STAPLE][:6]
    if not main or any(k in EXOTIC or k in SPICES for k, _ in ing):
        return None
    return 0.7 if all(k in COMMON for k in main) else None


# condimente care dau gust de departe (chiar și în cantitate mică)
SPICES = {'garam_masala', 'curry', 'pasta_curry', 'ghimbir', 'coriandru', 'coriandru_macinat', 'sos_soia', 'turmeric', 'cardamom',
          'anason', 'tahini', 'sos_chili', 'harissa', 'lemongrass', 'chimen', 'sos_hoisin', 'sos_stridii', 'wasabi', 'miso', 'kimchi'}

import type { Aisle, Allergen, AnimalKind, Ingredient, MeatKind } from '../logic/types';

/*
 * Valori la 100 g produs crud: [kcal, proteine, carbohidrați, grăsimi, fibre, zaharuri, sare] (g),
 * după USDA FoodData Central (SR Legacy / Foundation). Sarea = sodiu × 2,5.
 * Prețurile sunt estimări de bază (supermarket mediu, București, nov. 2026). Fiecare magazin are un
 * indice de preț, iar prețurile reale se învață din bonurile scanate.
 * pkg = ambalajul tipic (g), shelf = zile cât ține după cumpărare, im = poza ingredientului (TheMealDB).
 */

type Opt = {
  al?: Allergen[]; an?: AnimalKind; mk?: MeatKind; unit?: 'g' | 'ml' | 'buc'; pc?: number; d?: number;
  pkg: number; price: number; shelf: number; staple?: boolean; im?: string;
};
type N = [number, number, number, number, number, number, number];

function I(id: string, name: string, aisle: Aisle, n: N, o: Opt): Ingredient {
  return {
    id, name, aisle, kcal: n[0], p: n[1], c: n[2], f: n[3], fib: n[4], sug: n[5], salt: n[6],
    allergens: o.al ?? [], animal: o.an, meat: o.mk, unit: o.unit ?? 'g', gPerPiece: o.pc, density: o.d,
    pkg: o.pkg, price: o.price, shelfDays: o.shelf, staple: o.staple, img: o.im,
  };
}

const S = (id: string, name: string, salt = 0, im?: string): Ingredient =>
  I(id, name, 'condimente', [0, 0, 0, 0, 0, 0, salt], { pkg: 50, price: 4, shelf: 365, staple: true, im });

const C = (mk: MeatKind): Partial<Opt> => ({ an: 'carne', mk });

export const BASE_INGREDIENTS: Ingredient[] = [
  // ── Pui și curcan ──
  I('pui_piept', 'Piept de pui', 'carne', [120, 22.5, 0, 2.6, 0, 0, 0.12], { ...C('pui'), pkg: 1000, price: 35, shelf: 3, im: 'Chicken Breast' }),
  I('pui_pulpe', 'Pulpe de pui dezosate', 'carne', [121, 19.7, 0, 4.1, 0, 0, 0.24], { ...C('pui'), pkg: 1000, price: 30, shelf: 3, im: 'Chicken Thighs' }),
  I('pui_pulpe_os', 'Pulpe de pui cu os', 'carne', [190, 17.5, 0, 13, 0, 0, 0.2], { ...C('pui'), pkg: 1000, price: 22, shelf: 3, im: 'Chicken Legs' }),
  I('aripioare', 'Aripioare de pui', 'carne', [191, 17.5, 0, 12.9, 0, 0, 0.2], { ...C('pui'), pkg: 1000, price: 20, shelf: 3, im: 'Chicken Wings' }),
  I('pui_intreg', 'Pui întreg', 'carne', [200, 18, 0, 14, 0, 0, 0.18], { ...C('pui'), pkg: 1600, price: 30, shelf: 3, im: 'Chicken' }),
  I('tocata_pui', 'Carne tocată de pui', 'carne', [143, 17.4, 0, 8.1, 0, 0, 0.15], { ...C('pui'), pkg: 500, price: 16, shelf: 2, im: 'Chicken Breasts' }),
  I('ficat_pui', 'Ficat de pui', 'carne', [119, 16.9, 0.7, 4.8, 0, 0, 0.18], { ...C('organe'), pkg: 500, price: 9, shelf: 2, im: 'Chicken Liver' }),
  I('curcan_piept', 'Piept de curcan', 'carne', [114, 23.7, 0, 1.5, 0, 0, 0.13], { ...C('curcan'), pkg: 1000, price: 45, shelf: 3, im: 'Turkey' }),
  I('tocata_curcan', 'Carne tocată de curcan', 'carne', [148, 19.7, 0, 8, 0, 0, 0.2], { ...C('curcan'), pkg: 500, price: 20, shelf: 2, im: 'Turkey Mince' }),
  I('sunca_curcan', 'Piept de curcan feliat', 'carne', [104, 17.1, 4.2, 1.7, 0, 3.5, 2.5], { ...C('curcan'), pkg: 100, price: 7, shelf: 7, im: 'Turkey' }),

  // ── Porc ──
  I('ceafa_porc', 'Ceafă de porc', 'carne', [236, 16.7, 0, 18.2, 0, 0, 0.19], { ...C('porc'), pkg: 1000, price: 32, shelf: 3, im: 'Pork Shoulder' }),
  I('muschi_porc', 'Mușchi de porc', 'carne', [120, 20.7, 0, 3.5, 0, 0, 0.13], { ...C('porc'), pkg: 1000, price: 40, shelf: 3, im: 'Pork Tenderloin' }),
  I('cotlet_porc', 'Cotlet de porc', 'carne', [198, 19.6, 0, 12.6, 0, 0, 0.15], { ...C('porc'), pkg: 1000, price: 30, shelf: 3, im: 'Pork Chops' }),
  I('pulpa_porc', 'Pulpă de porc', 'carne', [143, 20.5, 0, 6.3, 0, 0, 0.15], { ...C('porc'), pkg: 1000, price: 28, shelf: 3, im: 'Pork' }),
  I('coaste_porc', 'Coaste de porc', 'carne', [277, 15.5, 0, 23.4, 0, 0, 0.2], { ...C('porc'), pkg: 1000, price: 28, shelf: 3, im: 'Pork Back Ribs' }),
  I('tocata_porc', 'Carne tocată de porc', 'carne', [263, 16.9, 0, 21.2, 0, 0, 0.17], { ...C('porc'), pkg: 500, price: 17, shelf: 2, im: 'Minced Pork' }),
  I('tocata_mixta', 'Carne tocată porc și vită', 'carne', [240, 17.5, 0, 18.5, 0, 0, 0.16], { ...C('porc'), pkg: 500, price: 20, shelf: 2, im: 'Minced Beef' }),
  I('carnati', 'Cârnați afumați', 'carne', [301, 12, 2, 27, 0, 1, 2.4], { ...C('porc'), pkg: 400, price: 18, shelf: 14, im: 'Chorizo' }),
  I('carnati_proaspeti', 'Cârnați proaspeți de porc', 'carne', [268, 14, 1.5, 23, 0, 0, 1.8], { ...C('porc'), pkg: 500, price: 18, shelf: 4, im: 'Sausages' }),
  I('crenvursti', 'Crenvurști', 'carne', [290, 11, 3, 26, 0, 1, 2.3], { ...C('porc'), pkg: 400, price: 10, shelf: 20, im: 'Sausages' }),
  I('costita', 'Costiță afumată (bacon)', 'carne', [417, 13, 1.3, 40, 0, 1, 2.6], { ...C('porc'), pkg: 200, price: 10, shelf: 21, im: 'Bacon' }),
  I('sunca', 'Șuncă de porc feliată', 'carne', [113, 18, 1.5, 4, 0, 1, 2.5], { ...C('porc'), pkg: 150, price: 9, shelf: 10, im: 'Ham' }),

  // ── Vită și miel ──
  I('tocata_vita', 'Carne tocată de vită', 'carne', [215, 18.6, 0, 15, 0, 0, 0.17], { ...C('vita'), pkg: 500, price: 28, shelf: 2, im: 'Minced Beef' }),
  I('vita_pulpa', 'Pulpă de vită', 'carne', [125, 22.5, 0, 3.5, 0, 0, 0.14], { ...C('vita'), pkg: 1000, price: 60, shelf: 3, im: 'Beef' }),
  I('antricot_vita', 'Antricot de vită', 'carne', [190, 20, 0, 12, 0, 0, 0.14], { ...C('vita'), pkg: 500, price: 45, shelf: 3, im: 'Sirloin Steak' }),
  I('miel', 'Carne de miel', 'carne', [200, 18.5, 0, 14, 0, 0, 0.17], { ...C('miel'), pkg: 1000, price: 60, shelf: 3, im: 'Lamb' }),
  I('tocata_miel', 'Carne tocată de miel', 'carne', [282, 16.6, 0, 23.4, 0, 0, 0.19], { ...C('miel'), pkg: 500, price: 35, shelf: 2, im: 'Lamb Mince' }),

  // ── Pește și fructe de mare ──
  I('somon', 'File de somon', 'peste', [208, 20.4, 0, 13.4, 0, 0, 0.15], { an: 'peste', mk: 'peste', al: ['peste'], pkg: 250, price: 30, shelf: 2, im: 'Salmon' }),
  I('somon_afumat', 'Somon afumat', 'peste', [117, 18.3, 0, 4.3, 0, 0, 3], { an: 'peste', mk: 'peste', al: ['peste'], pkg: 100, price: 15, shelf: 14, im: 'Smoked Salmon' }),
  I('pastrav', 'Păstrăv', 'peste', [141, 19.9, 0, 6.2, 0, 0, 0.13], { an: 'peste', mk: 'peste', al: ['peste'], pkg: 400, price: 25, shelf: 2, im: 'Trout' }),
  I('macrou', 'Macrou / sardine proaspete', 'peste', [205, 18.6, 0, 13.9, 0, 0, 0.23], { an: 'peste', mk: 'peste', al: ['peste'], pkg: 600, price: 22, shelf: 2, im: 'Sardines' }),
  I('cod', 'File de cod / merluciu (congelat)', 'congelate', [82, 17.8, 0, 0.7, 0, 0, 0.13], { an: 'peste', mk: 'peste', al: ['peste'], pkg: 500, price: 26, shelf: 90, im: 'White Fish Fillets' }),
  I('creveti', 'Creveți (congelați)', 'congelate', [85, 20.1, 0, 0.5, 0, 0, 0.3], { an: 'peste', mk: 'fructe_mare', al: ['crustacee'], pkg: 400, price: 35, shelf: 90, im: 'Prawns' }),
  I('calamar', 'Calamar (congelat)', 'congelate', [92, 15.6, 3.1, 1.4, 0, 0, 0.11], { an: 'peste', mk: 'fructe_mare', al: ['moluste'], pkg: 500, price: 30, shelf: 90, im: 'Squid' }),
  I('ton', 'Ton în apă (conservă, scurs)', 'conserve', [116, 25.5, 0, 0.8, 0, 0, 0.8], { an: 'peste', mk: 'peste', al: ['peste'], pkg: 112, price: 9, shelf: 365, im: 'Tuna' }),
  I('sardine', 'Sardine (conservă, scurse)', 'conserve', [208, 24.6, 0, 11.5, 0, 0, 0.8], { an: 'peste', mk: 'peste', al: ['peste'], pkg: 90, price: 6, shelf: 365, im: 'Sardines' }),

  // ── Ouă și lactate ──
  I('oua', 'Ouă', 'oua', [143, 12.6, 0.7, 9.5, 0, 0.4, 0.36], { an: 'oua', al: ['oua'], unit: 'buc', pc: 50, pkg: 500, price: 16, shelf: 21, im: 'Eggs' }),
  I('lapte', 'Lapte 1,5%', 'lactate', [46, 3.4, 4.9, 1.5, 0, 4.9, 0.11], { an: 'lactate', al: ['lapte'], unit: 'ml', d: 1.03, pkg: 1030, price: 8, shelf: 7, im: 'Milk' }),
  I('kefir', 'Kefir / sana', 'lactate', [52, 3.4, 4.5, 2, 0, 4.5, 0.1], { an: 'lactate', al: ['lapte'], unit: 'ml', d: 1.03, pkg: 340, price: 4, shelf: 10, im: 'Buttermilk' }),
  I('iaurt_grec', 'Iaurt grecesc 2%', 'lactate', [73, 10, 3.9, 1.9, 0, 3.6, 0.09], { an: 'lactate', al: ['lapte'], pkg: 400, price: 10, shelf: 14, im: 'Greek Yogurt' }),
  I('iaurt', 'Iaurt 3,5%', 'lactate', [61, 3.5, 4.7, 3.3, 0, 4.7, 0.12], { an: 'lactate', al: ['lapte'], pkg: 400, price: 5, shelf: 14, im: 'Natural Yoghurt' }),
  I('branza_vaci', 'Brânză de vaci', 'lactate', [98, 11.1, 3.4, 4.3, 0, 2.7, 0.9], { an: 'lactate', al: ['lapte'], pkg: 500, price: 14, shelf: 7, im: 'Cottage Cheese' }),
  I('ricotta', 'Ricotta', 'lactate', [174, 11.3, 3, 13, 0, 0.3, 0.2], { an: 'lactate', al: ['lapte'], pkg: 250, price: 9, shelf: 7, im: 'Ricotta' }),
  I('crema_branza', 'Cremă de brânză', 'lactate', [342, 6, 4, 34, 0, 3.2, 0.8], { an: 'lactate', al: ['lapte'], pkg: 200, price: 9, shelf: 14, im: 'Cream Cheese' }),
  I('mascarpone', 'Mascarpone', 'lactate', [429, 4.6, 4.5, 44, 0, 4, 0.1], { an: 'lactate', al: ['lapte'], pkg: 250, price: 10, shelf: 14, im: 'Mascarpone' }),
  I('telemea', 'Telemea de vacă', 'lactate', [264, 14.2, 4.1, 21.3, 0, 4.1, 2.8], { an: 'lactate', al: ['lapte'], pkg: 400, price: 18, shelf: 21, im: 'Feta' }),
  I('feta', 'Brânză feta', 'lactate', [264, 14.2, 4.1, 21.3, 0, 4.1, 2.8], { an: 'lactate', al: ['lapte'], pkg: 200, price: 12, shelf: 21, im: 'Feta' }),
  I('cascaval', 'Cașcaval', 'lactate', [356, 24.9, 2.2, 27.4, 0, 2.2, 2], { an: 'lactate', al: ['lapte'], pkg: 400, price: 22, shelf: 21, im: 'Cheddar Cheese' }),
  I('mozzarella', 'Mozzarella', 'lactate', [254, 24.3, 2.8, 15.9, 0, 1.1, 1.6], { an: 'lactate', al: ['lapte'], pkg: 125, price: 6, shelf: 7, im: 'Mozzarella' }),
  I('parmezan', 'Parmezan', 'lactate', [392, 35.8, 3.2, 25.8, 0, 0.8, 3.9], { an: 'lactate', al: ['lapte'], pkg: 100, price: 15, shelf: 60, im: 'Parmesan' }),
  I('smantana', 'Smântână 20%', 'lactate', [198, 2.4, 4.6, 19.4, 0, 3.4, 0.08], { an: 'lactate', al: ['lapte'], pkg: 350, price: 8, shelf: 14, im: 'Sour Cream' }),
  I('frisca', 'Smântână lichidă 30% (gătit)', 'lactate', [292, 2.4, 3.2, 30, 0, 3.2, 0.07], { an: 'lactate', al: ['lapte'], unit: 'ml', pkg: 200, price: 7, shelf: 14, im: 'Double Cream' }),
  I('unt', 'Unt', 'lactate', [717, 0.9, 0.1, 81.1, 0, 0.1, 0.03], { an: 'lactate', al: ['lapte'], pkg: 200, price: 12, shelf: 45, im: 'Butter' }),
  I('lapte_soia', 'Băutură de soia', 'lactate', [54, 3.3, 6, 1.8, 0.6, 3.9, 0.13], { al: ['soia'], unit: 'ml', pkg: 1000, price: 11, shelf: 7, im: 'Soya Milk' }),
  I('tofu', 'Tofu', 'lactate', [144, 17.3, 2.8, 8.7, 2.3, 0.6, 0.04], { al: ['soia'], pkg: 200, price: 9, shelf: 7, im: 'Tofu' }),

  // ── Uleiuri ──
  I('ulei', 'Ulei de floarea-soarelui', 'uleiuri', [884, 0, 0, 100, 0, 0, 0], { unit: 'ml', d: 0.92, pkg: 920, price: 9, shelf: 365, im: 'Sunflower Oil' }),
  I('ulei_masline', 'Ulei de măsline', 'uleiuri', [884, 0, 0, 100, 0, 0, 0], { unit: 'ml', d: 0.92, pkg: 460, price: 35, shelf: 365, im: 'Olive Oil' }),

  // ── Cereale, paste ──
  I('faina', 'Făină albă 000', 'cereale', [364, 10.3, 76.3, 1, 2.7, 0.3, 0], { al: ['gluten'], pkg: 1000, price: 5, shelf: 240, im: 'Plain Flour' }),
  I('orez', 'Orez', 'cereale', [365, 7.1, 80, 0.7, 1.3, 0.1, 0], { pkg: 1000, price: 8, shelf: 365, im: 'Rice' }),
  I('paste', 'Paste (spaghete, penne)', 'cereale', [371, 13, 74.7, 1.5, 3.2, 2.7, 0.02], { al: ['gluten'], pkg: 500, price: 6, shelf: 365, im: 'Spaghetti' }),
  I('taitei', 'Tăiței cu ou', 'cereale', [384, 14.2, 71.3, 4.4, 3.3, 1.9, 0.05], { al: ['gluten', 'oua'], pkg: 400, price: 7, shelf: 365, im: 'Egg Noodles' }),
  I('taitei_orez', 'Tăiței de orez', 'cereale', [364, 6, 80.2, 0.6, 1.6, 0.1, 0.45], { pkg: 400, price: 10, shelf: 365, im: 'Rice Noodles' }),
  I('lasagna', 'Foi de lasagna', 'cereale', [371, 13, 74.7, 1.5, 3.2, 2.7, 0.02], { al: ['gluten'], pkg: 500, price: 9, shelf: 365, im: 'Lasagne Sheets' }),
  I('ovaz', 'Fulgi de ovăz', 'cereale', [379, 13.2, 67.7, 6.5, 10.1, 1, 0.02], { al: ['gluten'], pkg: 500, price: 6, shelf: 240, im: 'Oats' }),
  I('malai', 'Mălai', 'cereale', [370, 7.1, 79.4, 1.8, 3.9, 0.6, 0], { pkg: 1000, price: 6, shelf: 240, im: 'Cornmeal' }),
  I('bulgur', 'Bulgur', 'cereale', [342, 12.3, 75.9, 1.3, 12.5, 0.4, 0.04], { al: ['gluten'], pkg: 500, price: 8, shelf: 365, im: 'Bulgur Wheat' }),
  I('cuscus', 'Cușcuș', 'cereale', [376, 12.8, 77.4, 0.6, 5, 0, 0.03], { al: ['gluten'], pkg: 500, price: 8, shelf: 365, im: 'Couscous' }),
  I('quinoa', 'Quinoa', 'cereale', [368, 14.1, 64.2, 6.1, 7, 0, 0.01], { pkg: 500, price: 15, shelf: 365, im: 'Quinoa' }),
  I('hrisca', 'Hrișcă', 'cereale', [343, 13.3, 71.5, 3.4, 10, 0, 0], { pkg: 500, price: 9, shelf: 365, im: 'Buckwheat' }),
  I('gris', 'Griș', 'cereale', [360, 12.7, 72.8, 1.1, 3.9, 0, 0], { al: ['gluten'], pkg: 1000, price: 5, shelf: 240, im: 'Semolina' }),
  I('pesmet', 'Pesmet', 'cereale', [395, 13.4, 72, 5.3, 4.5, 6.2, 1.8], { al: ['gluten'], pkg: 200, price: 4, shelf: 180, im: 'Breadcrumbs' }),
  I('amidon', 'Amidon de porumb', 'cereale', [381, 0.3, 91.3, 0.1, 0.9, 0, 0.02], { pkg: 400, price: 5, shelf: 365, im: 'Cornstarch' }),
  I('linte', 'Linte roșie', 'cereale', [352, 24.6, 63.4, 1.1, 10.7, 2, 0.02], { pkg: 500, price: 10, shelf: 365, im: 'Lentils' }),
  I('linte_verde', 'Linte verde / maro', 'cereale', [352, 24.6, 63.4, 1.1, 10.7, 2, 0.02], { pkg: 500, price: 9, shelf: 365, im: 'Brown Lentils' }),
  I('mazare_uscata', 'Mazăre uscată', 'cereale', [341, 24.6, 60.4, 1.2, 25.5, 8, 0.04], { pkg: 500, price: 6, shelf: 365, im: 'Yellow Split Peas' }),

  // ── Panificație ──
  I('paine', 'Pâine albă', 'panificatie', [266, 7.6, 50.6, 3.3, 2.4, 5.7, 1.2], { al: ['gluten'], pkg: 500, price: 5, shelf: 4, im: 'Bread' }),
  I('paine_integrala', 'Pâine integrală', 'panificatie', [252, 12.5, 42.7, 3.5, 6, 4.4, 1.1], { al: ['gluten'], pkg: 500, price: 8, shelf: 5, im: 'Wholegrain Bread' }),
  I('bagheta', 'Baghetă', 'panificatie', [272, 10.7, 51.9, 2.4, 2.2, 3.5, 1.5], { al: ['gluten'], pkg: 250, price: 4, shelf: 2, im: 'Baguette' }),
  I('tortilla', 'Lipii (tortilla)', 'panificatie', [312, 8.3, 51.6, 8, 3.5, 3, 1.9], { al: ['gluten'], unit: 'buc', pc: 62, pkg: 372, price: 9, shelf: 14, im: 'Flour Tortilla' }),
  I('pita', 'Lipii pita', 'panificatie', [275, 9.1, 55.7, 1.2, 2.2, 1.3, 1.3], { al: ['gluten'], unit: 'buc', pc: 60, pkg: 360, price: 8, shelf: 7, im: 'Pita Bread' }),
  I('chifle', 'Chifle pentru burger', 'panificatie', [279, 9.5, 49, 4.3, 2.5, 6, 1.2], { al: ['gluten'], unit: 'buc', pc: 75, pkg: 300, price: 8, shelf: 5, im: 'Sesame Seed Burger Buns' }),
  I('foietaj', 'Aluat foietaj', 'congelate', [558, 7.4, 45.7, 38.5, 1.6, 0.8, 1], { al: ['gluten'], pkg: 400, price: 8, shelf: 60, im: 'Puff Pastry' }),
  I('foi_placinta', 'Foi de plăcintă', 'panificatie', [299, 7.1, 61, 2.7, 1.9, 0.3, 1.2], { al: ['gluten'], pkg: 500, price: 8, shelf: 60, im: 'Filo Pastry' }),

  // ── Legume ──
  I('cartofi', 'Cartofi', 'legume', [77, 2, 17.5, 0.1, 2.2, 0.8, 0.02], { pkg: 2000, price: 8, shelf: 30, im: 'Potatoes' }),
  I('cartofi_dulci', 'Cartofi dulci', 'legume', [86, 1.6, 20.1, 0.1, 3, 4.2, 0.14], { pkg: 1000, price: 12, shelf: 21, im: 'Sweet Potatoes' }),
  I('ceapa', 'Ceapă', 'legume', [40, 1.1, 9.3, 0.1, 1.7, 4.2, 0.01], { unit: 'buc', pc: 150, pkg: 1000, price: 4, shelf: 30, im: 'Onion' }),
  I('ceapa_verde', 'Ceapă verde', 'legume', [32, 1.8, 7.3, 0.2, 2.6, 2.3, 0.04], { pkg: 100, price: 2.5, shelf: 5, im: 'Spring Onions' }),
  I('praz', 'Praz', 'legume', [61, 1.5, 14.2, 0.3, 1.8, 3.9, 0.05], { pkg: 500, price: 6, shelf: 10, im: 'Leek' }),
  I('usturoi', 'Usturoi', 'legume', [149, 6.4, 33.1, 0.5, 2.1, 1, 0.04], { unit: 'buc', pc: 4, pkg: 100, price: 4, shelf: 60, im: 'Garlic' }),
  I('ghimbir', 'Ghimbir', 'legume', [80, 1.8, 17.8, 0.8, 2, 1.7, 0.03], { pkg: 100, price: 3, shelf: 21, im: 'Ginger' }),
  I('morcov', 'Morcovi', 'legume', [41, 0.9, 9.6, 0.2, 2.8, 4.7, 0.17], { unit: 'buc', pc: 100, pkg: 1000, price: 4, shelf: 21, im: 'Carrots' }),
  I('pastarnac', 'Păstârnac', 'legume', [75, 1.2, 18, 0.3, 4.9, 4.8, 0.03], { pkg: 500, price: 6, shelf: 21, im: 'Parsnips' }),
  I('telina', 'Țelină', 'legume', [42, 1.5, 9.2, 0.3, 1.8, 1.6, 0.25], { al: ['telina'], pkg: 500, price: 4, shelf: 21, im: 'Celery' }),
  I('sfecla', 'Sfeclă roșie', 'legume', [43, 1.6, 9.6, 0.2, 2.8, 6.8, 0.2], { pkg: 1000, price: 5, shelf: 21, im: 'Beetroot' }),
  I('ardei', 'Ardei gras', 'legume', [31, 1, 6, 0.3, 2.1, 4.2, 0.01], { unit: 'buc', pc: 150, pkg: 500, price: 10, shelf: 7, im: 'Red Pepper' }),
  I('ardei_iute', 'Ardei iute', 'legume', [40, 1.9, 8.8, 0.4, 1.5, 5.3, 0.02], { pkg: 50, price: 2, shelf: 10, im: 'Red Chilli' }),
  I('rosii', 'Roșii', 'legume', [18, 0.9, 3.9, 0.2, 1.2, 2.6, 0.01], { unit: 'buc', pc: 120, pkg: 1000, price: 12, shelf: 6, im: 'Tomatoes' }),
  I('castraveti', 'Castraveți', 'legume', [15, 0.7, 3.6, 0.1, 0.5, 1.7, 0.01], { unit: 'buc', pc: 200, pkg: 500, price: 6, shelf: 7, im: 'Cucumber' }),
  I('ridichi', 'Ridichi', 'legume', [16, 0.7, 3.4, 0.1, 1.6, 1.9, 0.1], { pkg: 200, price: 3, shelf: 7, im: 'Radish' }),
  I('dovlecei', 'Dovlecei', 'legume', [17, 1.2, 3.1, 0.3, 1, 2.5, 0.02], { unit: 'buc', pc: 250, pkg: 1000, price: 8, shelf: 7, im: 'Courgettes' }),
  I('dovleac', 'Dovleac', 'legume', [26, 1, 6.5, 0.1, 0.5, 2.8, 0], { pkg: 1500, price: 7, shelf: 30, im: 'Butternut Squash' }),
  I('vinete', 'Vinete', 'legume', [25, 1, 5.9, 0.2, 3, 3.5, 0.01], { unit: 'buc', pc: 300, pkg: 1000, price: 10, shelf: 7, im: 'Aubergine' }),
  I('varza', 'Varză albă', 'legume', [25, 1.3, 5.8, 0.1, 2.5, 3.2, 0.05], { pkg: 2000, price: 6, shelf: 21, im: 'Cabbage' }),
  I('varza_rosie', 'Varză roșie', 'legume', [31, 1.4, 7.4, 0.2, 2.1, 3.8, 0.07], { pkg: 1000, price: 5, shelf: 21, im: 'Red Cabbage' }),
  I('varza_murata', 'Varză murată', 'legume', [19, 0.9, 4.3, 0.1, 2.9, 1.8, 1.7], { pkg: 1000, price: 8, shelf: 30, im: 'Sauerkraut' }),
  I('conopida', 'Conopidă', 'legume', [25, 1.9, 5, 0.3, 2, 1.9, 0.08], { pkg: 1000, price: 9, shelf: 7, im: undefined }),
  I('broccoli', 'Broccoli', 'legume', [34, 2.8, 6.6, 0.4, 2.6, 1.7, 0.08], { pkg: 500, price: 9, shelf: 5, im: 'Broccoli' }),
  I('spanac', 'Spanac (congelat)', 'congelate', [23, 2.9, 3.6, 0.4, 2.2, 0.4, 0.2], { pkg: 450, price: 7, shelf: 90, im: 'Spinach' }),
  I('ciuperci', 'Ciuperci champignon', 'legume', [22, 3.1, 3.3, 0.3, 1, 2, 0.01], { pkg: 500, price: 10, shelf: 5, im: 'Mushrooms' }),
  I('salata', 'Salată verde', 'legume', [15, 1.4, 2.9, 0.2, 1.3, 0.8, 0.07], { pkg: 250, price: 4, shelf: 5, im: 'Lettuce' }),
  I('rucola', 'Rucola', 'legume', [25, 2.6, 3.7, 0.7, 1.6, 2, 0.07], { pkg: 100, price: 5, shelf: 4, im: 'Rocket' }),
  I('patrunjel', 'Pătrunjel verde', 'legume', [36, 3, 6.3, 0.8, 3.3, 0.9, 0.14], { pkg: 50, price: 2.5, shelf: 6, im: 'Parsley' }),
  I('marar', 'Mărar', 'legume', [43, 3.5, 7, 1.1, 2.1, 0, 0.15], { pkg: 50, price: 2.5, shelf: 6, im: 'Dill' }),
  I('leustean', 'Leuștean', 'legume', [36, 3, 6.3, 0.8, 3.3, 0.9, 0.14], { pkg: 30, price: 2.5, shelf: 6, im: 'Celery' }),
  I('busuioc_verde', 'Busuioc verde', 'legume', [23, 3.2, 2.7, 0.6, 1.6, 0.3, 0.01], { pkg: 30, price: 4, shelf: 5, im: 'Basil' }),
  I('coriandru', 'Coriandru verde', 'legume', [23, 2.1, 3.7, 0.5, 2.8, 0.9, 0.12], { pkg: 30, price: 4, shelf: 5, im: 'Coriander' }),
  I('menta', 'Mentă', 'legume', [44, 3.3, 8.4, 0.7, 6.8, 0, 0.08], { pkg: 30, price: 4, shelf: 5, im: 'Mint' }),
  I('avocado', 'Avocado', 'legume', [160, 2, 8.5, 14.7, 6.7, 0.7, 0.02], { unit: 'buc', pc: 150, pkg: 150, price: 6, shelf: 5, im: 'Avocado' }),
  I('porumb_stiuleti', 'Porumb pe știulete', 'legume', [86, 3.3, 18.7, 1.4, 2, 6.3, 0.04], { unit: 'buc', pc: 250, pkg: 1000, price: 10, shelf: 4, im: 'Corn On The Cob' }),
  I('mazare', 'Mazăre (congelată)', 'congelate', [77, 5.2, 13.6, 0.4, 4.5, 5, 0.27], { pkg: 1000, price: 10, shelf: 120, im: 'Peas' }),
  I('fasole_verde', 'Fasole verde (congelată)', 'congelate', [31, 1.8, 7, 0.2, 2.7, 3.3, 0.02], { pkg: 1000, price: 10, shelf: 120, im: 'Green Beans' }),
  I('legume_mix', 'Mix de legume (congelat)', 'congelate', [65, 3.3, 12, 0.5, 4, 3, 0.1], { pkg: 1000, price: 10, shelf: 120, im: 'Stir-fry Vegetables' }),

  // ── Fructe ──
  I('banana', 'Banane', 'fructe', [89, 1.1, 22.8, 0.3, 2.6, 12.2, 0], { unit: 'buc', pc: 120, pkg: 1000, price: 7, shelf: 5, im: 'Banana' }),
  I('mar', 'Mere', 'fructe', [52, 0.3, 13.8, 0.2, 2.4, 10.4, 0], { unit: 'buc', pc: 180, pkg: 1000, price: 5, shelf: 21, im: 'Apples' }),
  I('pere', 'Pere', 'fructe', [57, 0.4, 15.2, 0.1, 3.1, 9.8, 0], { unit: 'buc', pc: 180, pkg: 1000, price: 8, shelf: 10, im: 'Pears' }),
  I('portocale', 'Portocale', 'fructe', [47, 0.9, 11.8, 0.1, 2.4, 9.4, 0], { unit: 'buc', pc: 200, pkg: 1000, price: 7, shelf: 14, im: 'Orange' }),
  I('kiwi', 'Kiwi', 'fructe', [61, 1.1, 14.7, 0.5, 3, 9, 0], { unit: 'buc', pc: 75, pkg: 500, price: 7, shelf: 14, im: undefined }),
  I('struguri', 'Struguri', 'fructe', [69, 0.7, 18.1, 0.2, 0.9, 15.5, 0], { pkg: 500, price: 8, shelf: 5, im: undefined }),
  I('lamaie', 'Lămâie', 'fructe', [22, 0.4, 6.9, 0.2, 0.3, 2.5, 0], { unit: 'buc', pc: 40, pkg: 200, price: 4, shelf: 21, im: 'Lemon' }),
  I('mango', 'Mango', 'fructe', [60, 0.8, 15, 0.4, 1.6, 13.7, 0], { unit: 'buc', pc: 300, pkg: 300, price: 8, shelf: 5, im: 'Mango' }),
  I('ananas', 'Ananas (conservă)', 'conserve', [60, 0.5, 15.6, 0.1, 0.8, 14.3, 0], { pkg: 340, price: 7, shelf: 365, im: 'Pineapple Chunks' }),
  I('fructe_padure', 'Fructe de pădure (congelate)', 'congelate', [50, 0.7, 12, 0.4, 3, 7.5, 0], { pkg: 500, price: 15, shelf: 180, im: 'Raspberries' }),
  I('capsuni', 'Căpșuni', 'fructe', [32, 0.7, 7.7, 0.3, 2, 4.9, 0], { pkg: 500, price: 12, shelf: 4, im: 'Strawberries' }),
  I('prune_uscate', 'Prune uscate', 'fructe', [240, 2.2, 63.9, 0.4, 7.1, 38.1, 0], { pkg: 200, price: 9, shelf: 180, im: 'Prunes' }),
  I('stafide', 'Stafide', 'fructe', [299, 3.1, 79.2, 0.5, 3.7, 59.2, 0.03], { pkg: 200, price: 7, shelf: 180, im: 'Raisins' }),
  I('curmale', 'Curmale', 'fructe', [282, 2.5, 75, 0.4, 8, 63, 0], { pkg: 200, price: 12, shelf: 180, im: 'Medjool Dates' }),

  // ── Conserve, leguminoase ──
  I('fasole_conserva', 'Fasole albă (conservă, scursă)', 'conserve', [140, 8.2, 26, 0.6, 6.3, 0.3, 0.5], { pkg: 240, price: 5, shelf: 365, im: 'Cannellini Beans' }),
  I('fasole_rosie', 'Fasole roșie (conservă, scursă)', 'conserve', [127, 8.7, 22.8, 0.5, 6.4, 0.3, 0.5], { pkg: 240, price: 5, shelf: 365, im: 'Kidney Beans' }),
  I('fasole_neagra', 'Fasole neagră (conservă, scursă)', 'conserve', [132, 8.9, 23.7, 0.5, 8.7, 0.3, 0.6], { pkg: 240, price: 6, shelf: 365, im: 'Black Beans' }),
  I('naut', 'Năut (conservă, scurs)', 'conserve', [139, 7.1, 22.5, 2.5, 6.4, 4, 0.6], { pkg: 240, price: 5, shelf: 365, im: 'Chickpeas' }),
  I('porumb', 'Porumb dulce (conservă, scurs)', 'conserve', [81, 2.6, 17.4, 1, 2, 3.6, 0.5], { pkg: 285, price: 5, shelf: 365, im: 'Sweetcorn' }),
  I('rosii_pasate', 'Roșii pasate / în bucăți', 'conserve', [32, 1.6, 7.3, 0.3, 1.9, 4.4, 0.35], { pkg: 500, price: 5, shelf: 365, im: 'Chopped Tomatoes' }),
  I('pasta_tomate', 'Pastă de tomate', 'conserve', [82, 4.3, 18.9, 0.5, 4.1, 12.2, 0.15], { pkg: 140, price: 4, shelf: 365, im: 'Tomato Puree' }),
  I('masline', 'Măsline (scurse)', 'conserve', [115, 0.8, 6.3, 10.7, 3.2, 0, 1.8], { al: ['sulfiti'], pkg: 200, price: 9, shelf: 60, im: 'Black Olives' }),
  I('castraveti_murati', 'Castraveți murați', 'conserve', [12, 0.5, 2.3, 0.2, 1.2, 1.1, 3], { pkg: 680, price: 8, shelf: 60, im: 'Gherkin Relish' }),
  I('foi_vita', 'Foi de viță (borcan)', 'conserve', [69, 4.3, 11.7, 2, 9.9, 0, 6], { pkg: 250, price: 12, shelf: 180, im: 'Grape leaves' }),
  I('lapte_cocos', 'Lapte de cocos (conservă)', 'conserve', [197, 2, 2.8, 21.3, 0, 2, 0.03], { unit: 'ml', pkg: 400, price: 9, shelf: 365, im: 'Coconut Milk' }),
  I('bors', 'Borș', 'conserve', [10, 0.5, 1.5, 0, 0, 0.5, 0.3], { unit: 'ml', pkg: 1000, price: 4, shelf: 14, im: 'Vinegar' }),
  I('sos_soia', 'Sos de soia', 'conserve', [53, 8.1, 4.9, 0.6, 0.8, 0.4, 14.3], { al: ['soia', 'gluten'], unit: 'ml', d: 1.1, pkg: 165, price: 8, shelf: 365, im: 'Soy Sauce' }),
  I('pasta_curry', 'Pastă de curry', 'conserve', [120, 2, 12, 7, 3, 4, 7.5], { pkg: 110, price: 12, shelf: 180, im: 'Red Curry Paste' }),
  I('sos_chili', 'Sos dulce de chili', 'conserve', [192, 0.4, 47, 0.2, 0.5, 43, 2.5], { pkg: 300, price: 9, shelf: 180, im: 'Sweet Chilli Sauce' }),

  // ── Nuci, semințe ──
  I('nuci', 'Miez de nucă', 'nuci', [654, 15.2, 13.7, 65.2, 6.7, 2.6, 0], { al: ['nuci'], pkg: 200, price: 16, shelf: 120, im: 'Walnuts' }),
  I('migdale', 'Migdale', 'nuci', [579, 21.2, 21.6, 49.9, 12.5, 4.4, 0], { al: ['nuci'], pkg: 200, price: 16, shelf: 180, im: 'Almonds' }),
  I('alune', 'Alune de pădure', 'nuci', [628, 15, 16.7, 60.8, 9.7, 4.3, 0], { al: ['nuci'], pkg: 200, price: 15, shelf: 180, im: 'Hazlenuts' }),
  I('caju', 'Caju', 'nuci', [553, 18.2, 30.2, 43.9, 3.3, 5.9, 0.03], { al: ['nuci'], pkg: 150, price: 15, shelf: 180, im: 'Cashew Nuts' }),
  I('arahide', 'Arahide', 'nuci', [567, 25.8, 16.1, 49.2, 8.5, 4, 0.05], { al: ['arahide'], pkg: 200, price: 7, shelf: 180, im: 'Peanuts' }),
  I('seminte_dovleac', 'Semințe de dovleac', 'nuci', [559, 30.2, 10.7, 49, 6, 1.4, 0.02], { pkg: 200, price: 12, shelf: 180, im: undefined }),
  I('seminte_floarea', 'Semințe de floarea-soarelui', 'nuci', [584, 20.8, 20, 51.5, 8.6, 2.6, 0.02], { pkg: 200, price: 5, shelf: 180, im: undefined }),
  I('susan', 'Susan', 'nuci', [573, 17.7, 23.5, 49.7, 11.8, 0.3, 0.03], { al: ['susan'], pkg: 100, price: 5, shelf: 365, im: 'Sesame Seed' }),
  I('chia', 'Semințe de chia', 'nuci', [486, 16.5, 42.1, 30.7, 34.4, 0, 0.04], { pkg: 200, price: 10, shelf: 365, im: undefined }),
  I('unt_arahide', 'Unt de arahide', 'nuci', [588, 25, 20, 50, 6, 9, 1.1], { al: ['arahide'], pkg: 340, price: 14, shelf: 180, im: 'Peanut Butter' }),
  I('tahini', 'Tahini', 'nuci', [595, 17, 21.2, 53.8, 9.3, 0.5, 0.3], { al: ['susan'], pkg: 300, price: 18, shelf: 180, im: 'Tahini' }),

  // ── Dulci, sosuri ──
  I('miere', 'Miere', 'altele', [304, 0.3, 82.4, 0, 0.2, 82.1, 0], { an: 'miere', pkg: 400, price: 25, shelf: 365, im: 'Honey' }),
  I('zahar', 'Zahăr', 'altele', [387, 0, 100, 0, 0, 100, 0], { pkg: 1000, price: 5, shelf: 365, im: 'Sugar' }),
  I('gem', 'Gem', 'altele', [278, 0.4, 69, 0.1, 1.1, 48.5, 0.08], { pkg: 340, price: 9, shelf: 60, im: 'Raspberry Jam' }),
  I('biscuiti', 'Biscuiți simpli', 'altele', [480, 6.5, 72, 18, 2, 25, 0.9], { al: ['gluten', 'lapte'], pkg: 200, price: 5, shelf: 180, im: 'Digestive Biscuits' }),
  I('cacao', 'Cacao', 'altele', [228, 19.6, 57.9, 13.7, 37, 1.8, 0.05], { pkg: 100, price: 7, shelf: 365, im: 'Cocoa' }),
  I('ciocolata', 'Ciocolată neagră 70%', 'altele', [598, 7.8, 45.9, 42.6, 10.9, 24, 0.05], { al: ['lapte'], pkg: 100, price: 7, shelf: 180, im: 'Dark Chocolate' }),
  I('mustar', 'Muștar', 'condimente', [66, 4, 5.8, 4, 4, 0.9, 2.8], { al: ['mustar'], pkg: 300, price: 5, shelf: 180, im: 'Mustard' }),
  I('maioneza', 'Maioneză', 'condimente', [680, 1, 0.6, 75, 0, 0.6, 1.6], { al: ['oua'], an: 'oua', pkg: 250, price: 8, shelf: 60, im: 'Mayonnaise' }),
  I('ketchup', 'Ketchup', 'condimente', [101, 1, 27.4, 0.1, 0.3, 22.8, 2.3], { pkg: 500, price: 8, shelf: 90, im: 'Tomato Ketchup' }),
  I('otet_balsamic', 'Oțet balsamic', 'condimente', [88, 0.5, 17, 0, 0, 15, 0.06], { al: ['sulfiti'], unit: 'ml', pkg: 250, price: 10, shelf: 365, im: 'Balsamic Vinegar' }),
  I('vin_rosu', 'Vin roșu sec (pentru gătit)', 'altele', [85, 0.1, 2.6, 0, 0, 0.6, 0.01], { al: ['sulfiti'], unit: 'ml', pkg: 750, price: 20, shelf: 365, im: 'Red Wine' }),
  I('vin_alb', 'Vin alb sec (pentru gătit)', 'altele', [82, 0.1, 2.6, 0, 0, 1, 0.01], { al: ['sulfiti'], unit: 'ml', pkg: 750, price: 20, shelf: 365, im: 'White Wine' }),

  // ── Condimente (nu intră în coș, doar „verifică”) ──
  S('sare', 'Sare', 100, 'Salt'), S('piper', 'Piper', 0, 'Black Pepper'), S('boia', 'Boia dulce', 0, 'Paprika'),
  S('boia_iute', 'Boia iute', 0, 'Cayenne Pepper'), S('oregano', 'Oregano', 0, 'Oregano'), S('cimbru', 'Cimbru', 0, 'Thyme'),
  S('rozmarin', 'Rozmarin', 0, 'Rosemary'), S('busuioc', 'Busuioc uscat', 0, 'Basil Leaves'), S('foi_dafin', 'Foi de dafin', 0, 'Bay Leaf'),
  S('chimen', 'Chimen', 0, 'Cumin'), S('scortisoara', 'Scorțișoară', 0, 'Cinnamon'), S('curry', 'Curry pudră', 0, 'Curry Powder'),
  S('turmeric', 'Turmeric', 0, 'Turmeric'), S('nucsoara', 'Nucșoară', 0, 'Nutmeg'), S('praf_copt', 'Praf de copt', 0, 'Baking Powder'),
  S('drojdie', 'Drojdie uscată', 0, 'Yeast'), S('otet', 'Oțet', 0, 'White Vinegar'), S('chili', 'Fulgi de chili', 0, 'Chilli Powder'),
  S('coriandru_macinat', 'Coriandru măcinat', 0, 'Ground Coriander'), S('vanilie', 'Esență de vanilie', 0, 'Vanilla Extract'),
  S('cub_supa', 'Bază de supă / cub', 45, 'Chicken Stock Cube'), S('garam_masala', 'Garam masala', 0, 'Garam Masala'),
];

/** registrul complet: ingredientele de bază + produsele adăugate de utilizator (scanate) */
export const INGREDIENTS: Ingredient[] = [...BASE_INGREDIENTS];
/** ce are aproape oricine în casă: nu intră automat pe listă și nici în buget (le poți adăuga dacă lipsesc) */
export const BASICS = ['ulei', 'ulei_masline', 'zahar', 'faina', 'orez', 'malai', 'paste', 'otet', 'otet_balsamic', 'sos_soia',
  'maioneza', 'mustar', 'ketchup', 'pasta_tomate', 'miere', 'praf_copt', 'amidon', 'cacao', 'drojdie', 'gris'];
for (const i of INGREDIENTS) if (BASICS.includes(i.id)) i.basic = true;

export const ING: Record<string, Ingredient> = Object.fromEntries(INGREDIENTS.map((i) => [i.id, i]));

export function setCustomIngredients(custom: Ingredient[]) {
  INGREDIENTS.length = 0;
  INGREDIENTS.push(...BASE_INGREDIENTS, ...custom);
  for (const k of Object.keys(ING)) delete ING[k];
  for (const i of INGREDIENTS) ING[i.id] = i;
}

export const AISLE_LABEL: Record<Aisle, string> = {
  legume: 'Legume', fructe: 'Fructe', carne: 'Carne', peste: 'Pește', lactate: 'Lactate',
  oua: 'Ouă', panificatie: 'Panificație', cereale: 'Paste, orez, cereale', conserve: 'Conserve și sosuri',
  congelate: 'Congelate', condimente: 'Condimente', uleiuri: 'Uleiuri', nuci: 'Nuci și semințe',
  altele: 'Altele',
};

export const AISLE_ORDER: Aisle[] = [
  'legume', 'fructe', 'panificatie', 'carne', 'peste', 'lactate', 'oua', 'congelate',
  'cereale', 'conserve', 'uleiuri', 'nuci', 'condimente', 'altele',
];

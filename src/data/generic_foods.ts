/*
 * Alimente uzuale care nu sunt rețete din aplicație (pentru recunoașterea farfuriei și jurnal).
 * Valori la 100 g și porția tipică în grame (USDA / etichete uzuale).
 */
export interface GenericFood {
  id: string; name: string; emoji: string; en: string; portion: number;
  kcal: number; p: number; c: number; f: number; fib: number; sug: number; salt: number;
}

const F = (id: string, emoji: string, name: string, en: string, portion: number, n: number[]): GenericFood =>
  ({ id, emoji, name, en, portion, kcal: n[0], p: n[1], c: n[2], f: n[3], fib: n[4], sug: n[5], salt: n[6] });

export const GENERIC_FOODS: GenericFood[] = [
  F('g_mandarine', '🍊', 'Mandarine', 'a plate of peeled mandarin orange segments, tangerines', 150, [53, 0.8, 13.3, 0.3, 1.8, 10.6, 0]),
  F('g_kiwi', '🥝', 'Kiwi', 'a photo of sliced kiwi fruit', 150, [61, 1.1, 14.7, 0.5, 3, 9, 0]),
  F('g_para', '🍐', 'Pară', 'a photo of a pear', 180, [57, 0.4, 15, 0.1, 3.1, 9.8, 0]),
  F('g_capsuni', '🍓', 'Căpșuni', 'a bowl of strawberries', 150, [32, 0.7, 7.7, 0.3, 2, 4.9, 0]),
  F('g_pepene', '🍉', 'Pepene roșu (felie)', 'a slice of watermelon', 300, [30, 0.6, 7.6, 0.2, 0.4, 6.2, 0]),
  F('g_prune', '🫐', 'Prune', 'a photo of plums', 150, [46, 0.7, 11.4, 0.3, 1.4, 9.9, 0]),
  F('g_piersica', '🍑', 'Piersică', 'a photo of a peach', 150, [39, 0.9, 9.5, 0.3, 1.5, 8.4, 0]),
  F('g_ananas', '🍍', 'Ananas', 'a plate of pineapple slices', 150, [50, 0.5, 13, 0.1, 1.4, 10, 0]),
  F('g_nuci', '🌰', 'Nuci (o mână)', 'a handful of walnuts', 30, [654, 15, 14, 65, 6.7, 2.6, 0]),
  F('g_langos', '🫓', 'Langoș', 'a photo of langos, fried flatbread with cheese', 200, [320, 8, 38, 15, 1.5, 3, 1.2]),
  F('g_caesar', '🥗', 'Salată Caesar', 'a photo of caesar salad with chicken', 300, [130, 8, 6, 8.5, 1.5, 2, 0.9]),
  F('g_ciorba_burta', '🍲', 'Ciorbă de burtă', 'a bowl of Romanian tripe soup, ciorba de burta', 400, [85, 6, 3, 5.5, 0.2, 0.8, 0.9]),
  F('g_ayran', '🥛', 'Ayran', 'a glass of ayran yogurt drink', 250, [38, 1.7, 2.7, 2.1, 0, 2.7, 0.6]),
  F('g_placinta', '🥧', 'Plăcintă cu brânză (felie)', 'a slice of cheese pie', 150, [300, 9, 31, 15, 1, 5, 0.9]),
  F('g_meniul_zilei', '🍲', 'Meniul zilei (ciorbă și fel principal)', 'a bowl of soup and a main dish', 650, [130, 7, 13, 5.5, 1.8, 2.5, 0.9]),
  F('g_pizza_felie', '🍕', 'Pizza (o felie)', 'a slice of pizza', 125, [266, 11, 33, 10, 2.3, 3.6, 1.5]),
  F('g_pizza', '🍕', 'Pizza (2 felii)', 'a photo of pizza slices', 250, [266, 11, 33, 10, 2.3, 3.6, 1.5]),
  F('g_burger', '🍔', 'Burger', 'a photo of a hamburger', 220, [254, 13, 24, 12, 1.3, 5, 1.2]),
  F('g_cartofi_prajiti', '🍟', 'Cartofi prăjiți', 'a photo of french fries', 150, [312, 3.4, 41, 15, 3.8, 0.3, 0.6]),
  F('g_shaorma', '🌯', 'Shaorma', 'a photo of a shawarma wrap', 400, [215, 11, 20, 10, 1.5, 2, 1.2]),
  F('g_kebab', '🥙', 'Kebab / döner', 'a photo of a doner kebab in pita bread', 350, [215, 12, 19, 10, 1.6, 2, 1.3]),
  F('g_hotdog', '🌭', 'Hot dog', 'a photo of a hot dog', 150, [290, 10, 24, 17, 0.8, 4, 1.8]),
  F('g_sushi', '🍣', 'Sushi', 'a photo of sushi rolls', 250, [150, 6, 28, 1.5, 0.8, 4, 1]),
  F('g_mici', '🌭', 'Mici', 'a photo of grilled skinless sausages, Romanian mici', 200, [250, 16, 1, 20, 0, 0.5, 1.8]),
  F('g_friptura', '🥩', 'Friptură la grătar', 'a photo of a grilled steak', 200, [250, 26, 0, 15, 0, 0, 0.3]),
  F('g_pui_gratar', '🍗', 'Piept de pui la grătar', 'a photo of grilled chicken breast', 200, [165, 31, 0, 3.6, 0, 0, 0.2]),
  F('g_nuggets', '🍗', 'Nuggets de pui', 'a photo of chicken nuggets', 150, [296, 15, 18, 18, 1, 0.5, 1.4]),
  F('g_aripioare', '🍗', 'Aripioare de pui', 'a photo of chicken wings', 200, [254, 23, 0, 17, 0, 0, 0.8]),
  F('g_salata_verde', '🥗', 'Salată verde mixtă', 'a photo of a green mixed salad', 250, [60, 2, 6, 3, 2, 3, 0.3]),
  F('g_supa', '🍲', 'Bol de supă / ciorbă', 'a photo of a bowl of soup', 400, [45, 3, 5, 1.5, 1, 1.5, 0.8]),
  F('g_sandvis', '🥪', 'Sandviș', 'a photo of a sandwich', 200, [250, 11, 28, 10, 2, 4, 1.4]),
  F('g_covrig', '🥨', 'Covrig', 'a photo of a pretzel', 100, [340, 9, 70, 3, 2.5, 1.5, 2.5]),
  F('g_croissant', '🥐', 'Croissant', 'a photo of a croissant', 60, [406, 8, 45, 21, 2.6, 11, 1.2]),
  F('g_gogoasa', '🍩', 'Gogoașă', 'a photo of a donut', 70, [421, 5, 51, 22, 1.5, 22, 0.8]),
  F('g_prajitura', '🍰', 'Felie de prăjitură / tort', 'a photo of a slice of cake', 120, [370, 5, 50, 17, 1, 35, 0.6]),
  F('g_inghetata', '🍨', 'Înghețată', 'a photo of ice cream', 100, [207, 3.5, 24, 11, 0.7, 21, 0.2]),
  F('g_papanasi', '🍩', 'Papanași', 'a photo of Romanian papanasi doughnuts with sour cream and jam', 250, [320, 9, 40, 14, 1, 18, 0.5]),
  F('g_cozonac', '🍞', 'Cozonac (felie)', 'a photo of a slice of sweet bread with walnut swirl', 100, [380, 8, 55, 14, 2, 22, 0.4]),
  F('g_salata_boeuf', '🥗', 'Salată de boeuf', 'a photo of Romanian beef salad with mayonnaise', 200, [190, 6, 9, 15, 1.8, 2.5, 0.8]),
  F('g_cereale', '🥣', 'Cereale cu lapte', 'a photo of a bowl of breakfast cereal with milk', 300, [110, 4, 18, 2.5, 1, 9, 0.3]),
  F('g_paine', '🍞', 'Pâine (2 felii)', 'a photo of slices of bread', 80, [266, 7.6, 50.6, 3.3, 2.4, 5.7, 1.2]),
  F('g_mar', '🍎', 'Măr', 'a photo of an apple', 180, [52, 0.3, 13.8, 0.2, 2.4, 10.4, 0]),
  F('g_banana', '🍌', 'Banană', 'a photo of a banana', 120, [89, 1.1, 22.8, 0.3, 2.6, 12.2, 0]),
  F('g_struguri', '🍇', 'Struguri', 'a photo of grapes', 150, [69, 0.7, 18, 0.2, 0.9, 15.5, 0]),
  F('g_portocala', '🍊', 'Portocală', 'a photo of an orange fruit', 200, [47, 0.9, 11.8, 0.1, 2.4, 9.4, 0]),
  F('g_ciocolata', '🍫', 'Ciocolată', 'a photo of a chocolate bar', 50, [546, 4.9, 61, 31, 7, 48, 0.06]),
  F('g_chipsuri', '🥔', 'Chipsuri', 'a photo of potato chips', 50, [536, 7, 53, 34, 4.4, 0.3, 1.3]),
  F('g_cafea_lapte', '☕', 'Cafea cu lapte', 'a photo of a latte coffee', 300, [45, 2.5, 4.5, 1.7, 0, 4.5, 0.1]),
  F('g_bere', '🍺', 'Bere (0,5 l)', 'a photo of a glass of beer', 500, [43, 0.5, 3.6, 0, 0, 0, 0]),
  F('g_vin', '🍷', 'Vin (pahar)', 'a photo of a glass of red wine', 150, [83, 0.1, 2.6, 0, 0, 0.6, 0]),
  F('g_suc', '🥤', 'Suc carbogazos', 'a photo of a glass of soda', 330, [42, 0, 10.6, 0, 0, 10.6, 0]),
  F('g_paste', '🍝', 'Farfurie de paste', 'a photo of a plate of pasta', 350, [160, 5.5, 25, 4, 1.8, 2.5, 0.5]),
  F('g_orez', '🍚', 'Orez fiert', 'a photo of a bowl of white rice', 200, [130, 2.7, 28, 0.3, 0.4, 0, 0]),
  F('g_omleta', '🍳', 'Omletă', 'a photo of an omelette', 150, [154, 11, 1.6, 12, 0, 1, 0.8]),
  F('g_clatite', '🥞', 'Clătite', 'a photo of pancakes', 150, [227, 6, 28, 10, 1, 8, 0.8]),
  F('g_iaurt', '🥛', 'Iaurt', 'a photo of a bowl of yogurt', 200, [61, 3.5, 4.7, 3.3, 0, 4.7, 0.12]),
];

export const GENERIC: Record<string, GenericFood> = Object.fromEntries(GENERIC_FOODS.map((g) => [g.id, g]));

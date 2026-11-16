// Tipuri comune pentru toată aplicația. Fără importuri React Native: logica rulează și în teste Node.
import type { StoreId } from './stores';
export type { StoreId } from './stores';

export type Aisle =
  | 'legume' | 'fructe' | 'carne' | 'peste' | 'lactate' | 'oua' | 'panificatie'
  | 'cereale' | 'conserve' | 'congelate' | 'condimente' | 'uleiuri' | 'nuci' | 'altele';

/** Cei 14 alergeni majori din Regulamentul UE 1169/2011 */
export type Allergen =
  | 'gluten' | 'crustacee' | 'oua' | 'peste' | 'arahide' | 'soia' | 'lapte'
  | 'nuci' | 'telina' | 'mustar' | 'susan' | 'sulfiti' | 'lupin' | 'moluste';

/** Ce fel de produs animal e ingredientul (pentru dietă și post) */
export type AnimalKind = 'carne' | 'peste' | 'lactate' | 'oua' | 'miere';

/** Felul de carne, pentru „ce nu mănânci” și pentru varietate */
export type MeatKind = 'pui' | 'curcan' | 'porc' | 'vita' | 'miel' | 'organe' | 'peste' | 'fructe_mare';

/** Bucătăria rețetei */
export type Cuisine = 'ro' | 'eu' | 'it' | 'med' | 'or' | 'as' | 'in' | 'mx' | 'us';

export interface Ingredient {
  /** de bază (ulei, orez, făină…): presupun că le ai, dacă nu spui altfel */
  basic?: boolean;
  id: string;
  name: string;
  aisle: Aisle;
  /** valori la 100 g produs crud (USDA FoodData Central, SR Legacy) */
  kcal: number; p: number; c: number; f: number;
  /** fibre, zaharuri, sare (g / 100 g) */
  fib: number; sug: number; salt: number;
  allergens: Allergen[];
  animal?: AnimalKind;
  /** felul de carne / pește */
  meat?: MeatKind;
  /** numele pozei ingredientului (TheMealDB) */
  img?: string;
  /** cum se afișează cantitatea */
  unit: 'g' | 'ml' | 'buc';
  /** g per bucată (ouă, ceapă etc.) pentru afișare */
  gPerPiece?: number;
  /** densitate g/ml pentru lichide (implicit 1) */
  density?: number;
  /** ambalaj tipic în g */
  pkg: number;
  /** preț estimat RON / ambalaj (editabil în aplicație) */
  price: number;
  /** câte zile ține după cumpărare */
  shelfDays: number;
  /** condimente: nu se pun în coș, apar la „verifică în cămară” */
  staple?: boolean;
  /** produs scanat (cod de bare) */
  barcode?: string;
  /** produs adăugat de utilizator */
  custom?: boolean;
}

export type Equipment =
  | 'plita' | 'cuptor' | 'microunde' | 'airfryer' | 'blender' | 'mixer'
  | 'robot' | 'multicooker' | 'grill' | 'toaster';

export type RecipeMeal = 'mic_dejun' | 'principal' | 'gustare';

export interface Recipe {
  id: string;
  name: string;
  meal: RecipeMeal[];
  /** porții pentru cantitățile de bază */
  servings: number;
  /** minute total */
  prep: number;
  /** fiecare grup = alternative; trebuie câte una din fiecare grup */
  equipment: Equipment[][];
  /** câte zile ține la frigider (0 = se mănâncă pe loc) */
  keepsDays: number;
  /** se poate porționa și congela */
  freezable?: boolean;
  /** [ingredientId, grame] pentru toate porțiile de bază */
  ing: [string, number][];
  steps: string[];
  tags?: string[];
  /** imaginea rețetei (emoji, doar pentru rețetele vechi ale utilizatorului) */
  emoji?: string;
  /** numele în engleză (pentru recunoașterea pozelor) */
  en?: string;
  /** bucătăria */
  cuisine?: Cuisine;
  /** id-ul pozei sursă (TheMealDB); fără = compoziție din ingrediente */
  img?: string;
  /** cine a făcut poza (rețetele importate) */
  credit?: string;
  /** rețetă adăugată de utilizator */
  custom?: boolean;
  /** cale locală către poza făcută de utilizator */
  photo?: string;
}

/** ce nu mănânci (preferință, nu alergie) */
export type AvoidKind =
  | 'pui' | 'curcan' | 'porc' | 'vita' | 'miel' | 'organe' | 'peste' | 'fructe_mare'
  | 'oua' | 'lactate' | 'ciuperci' | 'leguminoase' | 'picant';

/** activitatea la serviciu / în timpul zilei */
export type JobActivity = 'birou' | 'picioare' | 'fizic' | 'foarte_fizic';
export type TrainType = 'forta' | 'cardio' | 'mixt';

export type Sex = 'm' | 'f';
export type Activity = 'sedentar' | 'usor' | 'moderat' | 'activ' | 'foarte_activ';
export type Goal = 'slabire' | 'mentinere' | 'masa';
export type Pregnancy = 'nu' | 't1' | 't2' | 't3' | 'alaptare';
export type Diet = 'omnivor' | 'pescetarian' | 'vegetarian' | 'vegan';

export interface Member {
  id: string;
  name: string;
  isMain: boolean;
  sex: Sex;
  birthYear: number;
  heightCm: number;
  weightKg: number;
  activity: Activity;
  goal: Goal;
  /** kg/săptămână pentru slăbire sau masă */
  rateKg: number;
  pregnancy: Pregnancy;
  medical: boolean;
  diet: Diet;
  allergies: Allergen[];
  dislikes: string[]; // ingredient ids
  /** ce nu mănânci (pește, porc, ciuperci…) */
  avoid?: AvoidKind[];
  /** activitate detaliată (dacă lipsește, se folosește `activity`) */
  job?: JobActivity;
  trainDays?: number;
  trainMin?: number;
  trainType?: TrainType;
  /** pași pe zi, în medie (opțional) */
  steps?: number;
  /** procent de grăsime corporală (opțional) → formula Katch-McArdle */
  bodyFat?: number;
  /** greutatea dorită (opțional) */
  targetKg?: number;
  /** proteine mai multe (sport de forță, slăbire) */
  highProtein?: boolean;
  /** ajustare manuală din urmărirea greutății */
  kcalAdjust: number;
}

export type Slot = 'mic_dejun' | 'gustare1' | 'pranz' | 'gustare2' | 'cina';

export type FastPref = 'niciunul' | 'miercuri_vineri' | 'posturile_mari' | 'toate';
export type FastLevel = 'none' | 'no_meat' | 'fish_ok' | 'strict';

export interface Settings {
  equipment: Equipment[];
  slots: Slot[];
  /** zile ale săptămânii în care gătești: 0 = luni … 6 = duminică */
  cookingDays: number[];
  maxPrepWeekday: number;
  maxPrepWeekend: number;
  /** câte rețete diferite gătești într-o sesiune (pe masă principală) */
  recipesPerSession: number;
  budgetRon: number;
  fasting: FastPref;
  fishOnDispensation: boolean;
  /** cât de des accepți același fel: mare = maxim 2 mese, echilibrat = 3, rar = gătești mult odată */
  variety?: 'mare' | 'echilibrat' | 'rar';
  /** cât de des carne la mesele principale */
  meatStyle?: 'des' | 'echilibrat' | 'rar';
  /** bucătării preferate (+1) sau evitate (-1) */
  cuisines?: Partial<Record<Cuisine, 1 | -1>>;
  /** deserturi pe săptămână */
  dessertsPerWeek?: number;
  /** magazinele în care cumperi */
  stores?: StoreId[];
  mainStore?: StoreId;
  /** bucătăriile alese ultima dată pentru planul săptămânii */
  lastWeekCuisines?: Cuisine[];
  /** ai spus câte mese pe zi mănânci */
  slotsAsked?: boolean;
  /** zona pentru prețurile de azi */
  priceArea?: { name: string; lat: number; lon: number };
  /** ziua cumpărăturilor: 0 = luni … 6 = duminică */
  shopDay?: number;
  /** tema aplicației */
  theme?: 'email' | 'horezu' | 'piata' | 'caiet' | 'anotimp';
  /** „Funcții în plus” pornite sau oprite de tine */
  features?: Partial<Record<'post' | 'deserturi' | 'cantar' | 'familie' | 'preturi' | 'camara', boolean>>;
}

export interface PortionShare { memberId: string; factor: number }

export interface PlannedMeal {
  day: number; // 0..6 de la start
  slot: Slot;
  recipeId: string;
  sessionId: string;
  shares: PortionShare[];
  /** porție decongelată */
  frozen?: boolean;
}

export interface CookSession {
  id: string;
  day: number;
  recipeId: string;
  /** câte porții întregi gătești */
  portions: number;
  /** câte porții se mănâncă efectiv (suma porțiilor fiecărei persoane) */
  eat?: number;
  extra?: boolean;
  freeze?: boolean;
  done?: boolean;
}

export interface ShoppingItem {
  ingId: string;
  needG: number;
  fromPantryG: number;
  buyG: number;
  packages: number;
  cost: number;
  leftoverG: number;
  checked?: boolean;
}

export interface WeekHousehold { memberIds: string[]; guests: number; applyFasting: boolean }

export interface WeekPlan {
  basics?: { ingId: string; needG: number }[];
  /** ingrediente de bază pe care ai zis că nu le ai: intră pe listă */
  addBasics?: string[];
  /** felurile alese prin swipe (se păstrează la „Alt plan”) */
  wanted?: string[];
  /** bucătăriile alese pentru săptămâna asta */
  cuisines?: Cuisine[];
  id: string; // startISO
  /** magazinul pentru lista acestei săptămâni */
  store?: StoreId;
  startISO: string;
  createdAt: string;
  seed: number;
  household: WeekHousehold;
  fastDays: FastLevel[];
  meals: PlannedMeal[];
  sessions: CookSession[];
  shopping: ShoppingItem[];
  staples: { ingId: string; needG: number }[];
  cost: number;
  budget: number;
  warnings: string[];
  shoppingDone?: boolean;
  eaten: string[]; // chei `${day}|${slot}`
  /** mese pe care ai zis că nu le-ai mâncat (nu se mai notează automat) */
  skipped?: string[];
  /** mesele fixate cu lacătul („zi|masă”) */
  locked?: string[];
}

export interface PantryItem { id: string; ingId: string; g: number; expiresISO: string }

export interface FoodLogEntry {
  id: string; memberId?: string; dateISO: string; label: string; kcal: number; p: number; c: number; f: number;
  fib?: number; sug?: number; salt?: number;
  mealKey?: string; planId?: string;
  /** masa din zi (pentru jurnal) */
  slot?: Slot;
  /** ce aliment e (i:ingredient, r:rețetă, g:aliment uzual) și cantitatea, pentru „recente” */
  ref?: string;
  g?: number;
  /** estimat (din poză, din text sau de la restaurant): se arată cu „≈” */
  approx?: boolean;
}

/** o cumpărătură (din bon, din listă sau scrisă de mână) */
export interface SpendEntry { id: string; dateISO: string; store: StoreId; amount: number; source: 'bon' | 'lista' | 'manual'; note?: string }

export interface WeightEntry { dateISO: string; kg: number; memberId?: string }

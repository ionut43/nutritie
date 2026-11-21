import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { ING, setCustomIngredients } from '../data/ingredients';
import { RECIPE, setCustomRecipes } from '../data/recipes';
import { clearNutritionCache , perServing } from '../logic/nutrition';
import { buildTaste, rejected, type Ratings } from '../logic/taste';
import { addDays, fromISO, todayISO, toISO } from '../logic/dates';
import { addToPantry, consumeRecipe, uid } from '../logic/pantry';
import {
  generatePlan, replaceSessionRecipe, replaceSingleMeal, SLOT_ORDER, setLabelSlots, withShopping, type PlanInput,
  trimPlanSlots,
  mealMacros, mealParts, sessionMeals, sidesLabel,
  refitPlan,
} from '../logic/planner';
import type {
  Cuisine,
  Ingredient, Recipe, SpendEntry,
  FoodLogEntry, Member, PantryItem, Settings, Slot, WeekHousehold, WeekPlan, WeightEntry,
} from '../logic/types';
import type { StoreId, StorePrices } from '../logic/stores';
import { setLivePrices } from '../logic/stores';
import { featureOn, type Feature } from '../logic/features';
import { setThemeId } from '../ui/themeState';
import { fetchLivePrices, type LivePrices } from '../logic/livePrices';
// prețuri aduse la zi de GitHub Actions (scripts/prices), folosite până le descarci tu din aplicație
import BUNDLED_PRICES from '../data/prices_live.json';

export const DEFAULT_SETTINGS: Settings = {
  equipment: ['plita', 'cuptor', 'microunde'],
  slots: ['mic_dejun', 'pranz', 'cina'],
  cookingDays: [6, 2],
  maxPrepWeekday: 45,
  maxPrepWeekend: 120,
  recipesPerSession: 2,
  budgetRon: 400,
  fasting: 'niciunul',
  fishOnDispensation: true,
  variety: 'mare',
  meatStyle: 'echilibrat',
  cuisines: {},
  dessertsPerWeek: 2,
  stores: ['lidl', 'kaufland'],
  mainStore: 'lidl',
  shopDay: 5,
};

export function newMember(isMain: boolean, name = ''): Member {
  return {
    id: uid('m'), name, isMain, sex: 'm', birthYear: new Date().getFullYear() - 30, heightCm: 175, weightKg: 75,
    activity: 'usor', goal: 'mentinere', rateKg: 0.5, pregnancy: 'nu', medical: false, diet: 'omnivor',
    allergies: [], dislikes: [], kcalAdjust: 0, avoid: [], job: 'birou', trainDays: 0, trainMin: 45, trainType: 'mixt',
  };
}

interface State {
  hydrated: boolean;
  onboarded: boolean;
  members: Member[];
  settings: Settings;
  plans: Record<string, WeekPlan>;
  pantry: PantryItem[];
  prices: Record<string, number>;
  liked: string[];
  disliked: string[];
  foodLog: FoodLogEntry[];
  weightLog: WeightEntry[];
  /** a cui sunt jurnalul, greutatea și ținta afișate (membru din gospodărie) */
  activeMemberId: string | undefined;

  customRecipes: Recipe[];
  customIngredients: Ingredient[];
  ratings: Ratings;
  /** mese deja evaluate: cheie plan|membru|zi|masă → 1 / -1 */
  mealRatings: Record<string, 1 | -1>;
  notifyExpiry: boolean;
  lastBackupISO?: string;
  /** denumiri de pe bon corectate de utilizator → ingredient */
  receiptAliases: Record<string, string>;
  /** prețuri reale pe magazin, din bonuri */
  storePrices: StorePrices;
  /** cheltuieli (bonuri, liste bifate, introduse de mână) */
  spend: SpendEntry[];
  /** alimente preferate pentru adăugare rapidă (ref) */
  favFoods: string[];
  /** swipe-uri din „alege ce mănânci”: dreapta 1, stânga -1 */
  swipes: Record<string, 1 | -1>;
  livePrices?: LivePrices;
  priceProducts: Record<string, number[]>;
  /** ultima săptămână pentru care ai văzut rezumatul */
  lastRecapISO?: string;
  applyReceipt: (items: { ingId: string; g: number; price?: number; name?: string }[], store?: StoreId, total?: number, nonFood?: number) => void;
  setPlanStore: (planId: string, store: StoreId) => void;
  /** un ingredient de bază pe care nu-l ai: îl pun pe listă (sau îl scot) */
  toggleBasic: (planId: string, ingId: string) => void;
  addSpend: (e: Omit<SpendEntry, 'id'>) => void;
  removeSpend: (id: string) => void;
  toggleFavFood: (ref: string) => void;
  markRecap: (iso: string) => void;
  saveRecipe: (r: Recipe) => void;
  deleteRecipe: (id: string) => void;
  saveIngredient: (i: Ingredient) => void;
  rateMeal: (planId: string, key: string, recipeId: string, v: 1 | -1) => void;
  setNotifyExpiry: (v: boolean) => void;
  importData: (data: unknown) => boolean;
  markBackup: () => void;

  /** blocare cu Face ID / amprentă */
  lockEnabled: boolean;
  setLock: (v: boolean) => void;

  completeOnboarding: (members: Member[], settings: Settings, taste?: Record<string, 1 | -1>) => void;
  upsertMember: (m: Member) => void;
  removeMember: (id: string) => void;
  updateSettings: (s: Partial<Settings>) => void;
  /** pornește sau oprește o funcție în plus */
  setFeature: (f: Feature, on: boolean) => void;
  /** câte mese pe zi: se aplică și planului de acum, nu doar celor noi */
  setMealSlots: (slots: Slot[]) => void;

  planInput: (startISO: string, household: WeekHousehold, seed: number, store?: StoreId) => PlanInput;
  generate: (startISO: string, household: WeekHousehold, seed?: number, store?: StoreId, picks?: { wanted?: string[]; skipped?: string[]; cuisines?: Cuisine[]; locked?: { day: number; slot: Slot; recipeId: string }[] }) => WeekPlan;
  /** lacătul pe o masă: rămâne exact acolo când refaci planul */
  toggleLock: (planId: string, day: number, slot: Slot) => void;
  recordSwipes: (v: Record<string, 1 | -1>) => void;
  /** descarcă prețurile de azi din magazinele din zona ta */
  refreshLivePrices: (area: { name: string; lat: number; lon: number }, onProgress: (msg: string, pct: number) => void) => Promise<LivePrices>;
  deletePlan: (id: string) => void;
  replaceSession: (planId: string, sessionId: string, recipeId: string) => void;
  replaceMeal: (planId: string, key: string, recipeId: string) => void;

  toggleShopItem: (planId: string, ingId: string) => void;
  buyItems: (planId: string, ingIds: string[], paid?: number) => void;
  cookSession: (planId: string, sessionId: string) => void;
  toggleEaten: (planId: string, day: number, slot: Slot, asTodo?: boolean, factor?: number) => void;
  /** notează singur mesele din plan a căror oră a trecut (dacă n-ai zis că n-ai mâncat) */
  /** mesele din plan dintr-o zi pe care nu le-ai bifat încă (fără ore: le confirmi tu, o dată) */
  pendingMeals: (dateISO: string) => { planId: string; day: number; slot: Slot; recipeId: string }[];
  /** „Ieri: ai mâncat ce era în plan?” → tot / doar prima masă / altceva */
  confirmDay: (dateISO: string, how: 'all' | 'first' | 'none') => void;
  /** „n-am mâncat asta”: scoate masa din jurnal și n-o mai notează automat */
  skipMeal: (planId: string, day: number, slot: Slot) => void;

  addPantry: (ingId: string, g: number, days?: number) => void;
  setPantryQty: (id: string, g: number) => void;
  removePantry: (id: string) => void;

  setPrice: (ingId: string, price?: number) => void;
  toggleLike: (recipeId: string) => void;
  toggleDislike: (recipeId: string) => void;
  /** după o schimbare de preferințe: înlocuiește de azi înainte mesele care nu se mai potrivesc; întoarce câte s-au schimbat */
  refitPlans: () => number;
  /** ultima înlocuire automată (pentru mesajul din Azi / Săptămâna) */
  lastRefit?: { atISO: string; count: number };

  addFood: (e: Omit<FoodLogEntry, 'id'>) => void;
  removeFood: (id: string) => void;
  addWeight: (kg: number, dateISO?: string) => void;
  removeWeight: (dateISO: string) => void;
  adjustKcal: (delta: number) => void;
  resetAll: () => void;
}

const initial = {
  activeMemberId: undefined as string | undefined,
  customRecipes: [] as Recipe[],
  customIngredients: [] as Ingredient[],
  ratings: {} as Ratings,
  mealRatings: {} as Record<string, 1 | -1>,
  notifyExpiry: true,
  lastBackupISO: undefined as string | undefined,
  receiptAliases: {} as Record<string, string>,
  storePrices: {} as StorePrices,
  spend: [] as SpendEntry[],
  favFoods: [] as string[],
  swipes: {} as Record<string, 1 | -1>,
  livePrices: undefined as LivePrices | undefined,
  priceProducts: {} as Record<string, number[]>,
  lastRecapISO: undefined as string | undefined,
  onboarded: false,
  members: [] as Member[],
  settings: DEFAULT_SETTINGS,
  plans: {} as Record<string, WeekPlan>,
  pantry: [] as PantryItem[],
  prices: {} as Record<string, number>,
  liked: [] as string[],
  disliked: [] as string[],
  foodLog: [] as FoodLogEntry[],
  weightLog: [] as WeightEntry[],
};

/** rețeta mesei din plan, ca să păstreze poza când devine o masă notată de tine */
const refOf = (p: WeekPlan, key: string) => {
  const [, d, slot] = key.split('|');
  const m = p.meals.find((x) => x.day === Number(d) && x.slot === slot);
  return m ? `r:${m.recipeId}` : undefined;
};
export const eatenKey = (memberId: string, day: number, slot: Slot) => `${memberId}|${day}|${slot}`;

function syncRegistry(recipes: Recipe[], ingredients: Ingredient[]) {
  setCustomIngredients(ingredients);
  setCustomRecipes(recipes);
  clearNutritionCache();
}

const bumpSkip = (ratings: Ratings, id: string): Ratings => {
  const r = ratings[id] ?? { up: 0, down: 0, skip: 0 };
  return { ...ratings, [id]: { ...r, skip: r.skip + 1 } };
};

/** datele pentru backup (fără stări temporare) */
export function exportData() {
  const s = useStore.getState();
  const state = Object.fromEntries(Object.keys(initial).map((k) => [k, (s as unknown as Record<string, unknown>)[k]]));
  return { app: 'nutritie', version: 1, exportedAt: new Date().toISOString(), state: { ...state, lockEnabled: s.lockEnabled } };
}

const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

export const useStore = create<State>()(
  persist(
    (set, get) => {
      /** recalculează listele de cumpărături pentru planurile încă active */
      const refreshPlans = (plans: Record<string, WeekPlan>, pantry: PantryItem[], prices: Record<string, number>, storePrices?: StorePrices) => {
        const today = todayISO();
        const sp = storePrices ?? get().storePrices;
        const out: Record<string, WeekPlan> = {};
        for (const [k, p] of Object.entries(plans)) {
          const end = toISO(addDays(fromISO(p.startISO), 6));
          out[k] = end >= today ? withShopping(p, { pantry, prices, storePrices: sp }) : p;
        }
        return out;
      };

      return {
        ...initial,
        hydrated: false,
        lockEnabled: false,
        setLock: (v) => set({ lockEnabled: v }),

        saveRecipe: (r) => set((s) => {
          const customRecipes = s.customRecipes.some((x) => x.id === r.id) ? s.customRecipes.map((x) => (x.id === r.id ? r : x)) : [...s.customRecipes, r];
          syncRegistry(customRecipes, s.customIngredients);
          return { customRecipes };
        }),
        deleteRecipe: (id) => set((s) => {
          const customRecipes = s.customRecipes.filter((x) => x.id !== id);
          syncRegistry(customRecipes, s.customIngredients);
          return { customRecipes };
        }),
        saveIngredient: (i) => set((s) => {
          const customIngredients = s.customIngredients.some((x) => x.id === i.id) ? s.customIngredients.map((x) => (x.id === i.id ? i : x)) : [...s.customIngredients, i];
          syncRegistry(s.customRecipes, customIngredients);
          return { customIngredients };
        }),
        rateMeal: (planId, key, recipeId, v) => set((s) => {
          const k = `${planId}|${key}`;
          const prev = s.mealRatings[k];
          const r = { ...(s.ratings[recipeId] ?? { up: 0, down: 0, skip: 0 }) };
          if (prev === 1) r.up--;
          if (prev === -1) r.down--;
          if (prev === v) {
            const mealRatings = { ...s.mealRatings };
            delete mealRatings[k];
            return { mealRatings, ratings: { ...s.ratings, [recipeId]: r } };
          }
          if (v === 1) r.up++; else r.down++;
          return { mealRatings: { ...s.mealRatings, [k]: v }, ratings: { ...s.ratings, [recipeId]: r } };
        }),
        setNotifyExpiry: (v) => set({ notifyExpiry: v }),
        applyReceipt: (items, store, total, nonFood) => set((s) => {
          let pantry = s.pantry;
          const prices = { ...s.prices };
          const storePrices: StorePrices = { ...s.storePrices };
          const sp = store ? { ...(storePrices[store] ?? {}) } : undefined;
          const receiptAliases = { ...s.receiptAliases };
          for (const it of items) {
            if (!ING[it.ingId] || it.g <= 0) continue;
            pantry = addToPantry(pantry, it.ingId, it.g);
            if (it.price !== undefined && it.price > 0) {
              if (sp) sp[it.ingId] = it.price; else prices[it.ingId] = it.price;
            }
            if (it.name) receiptAliases[it.name] = it.ingId;
          }
          if (store && sp) storePrices[store] = sp;
          const spend = total && total > 0 && store
            ? [...s.spend, { id: uid('c'), dateISO: todayISO(), store, amount: Math.round(total * 100) / 100, source: 'bon' as const, nonFood: nonFood && nonFood > 0 ? Math.round(nonFood * 100) / 100 : undefined }]
            : s.spend;
          return { pantry, prices, storePrices, receiptAliases, spend, plans: refreshPlans(s.plans, pantry, prices, storePrices) };
        }),
        setPlanStore: (planId, store) => set((s) => {
          const p = s.plans[planId];
          if (!p) return {};
          return { plans: { ...s.plans, [planId]: withShopping({ ...p, store }, { pantry: s.pantry, prices: s.prices, storePrices: s.storePrices }) } };
        }),
        toggleBasic: (planId, ingId) => set((s) => {
          const p = s.plans[planId];
          if (!p) return {};
          const addBasics = toggle(p.addBasics ?? [], ingId);
          return { plans: { ...s.plans, [planId]: withShopping({ ...p, addBasics }, { pantry: s.pantry, prices: s.prices, storePrices: s.storePrices }) } };
        }),
        addSpend: (e) => set((s) => ({ spend: [...s.spend, { ...e, id: uid('c') }] })),
        removeSpend: (id) => set((s) => ({ spend: s.spend.filter((x) => x.id !== id) })),
        recordSwipes: (v) => set((s) => ({ swipes: { ...s.swipes, ...v } })),
        refreshLivePrices: async (area, onProgress) => {
          const { live, products } = await fetchLivePrices(area, get().priceProducts, onProgress);
          setLivePrices(live.prices);
          set((s) => ({
            livePrices: live, priceProducts: products, settings: { ...s.settings, priceArea: area },
            plans: Object.fromEntries(Object.entries(s.plans).map(([k, p]) => [k, p.shoppingDone ? p : withShopping(p, { pantry: s.pantry, prices: s.prices, storePrices: s.storePrices })])),
          }));
          return live;
        },
        toggleFavFood: (ref) => set((s) => ({ favFoods: toggle(s.favFoods, ref) })),
        markRecap: (iso) => set({ lastRecapISO: iso }),
        markBackup: () => set({ lastBackupISO: new Date().toISOString() }),
        importData: (data) => {
          const d = (data as { app?: string; state?: Record<string, unknown> }) ?? {};
          if (d.app !== 'nutritie' || !d.state || !Array.isArray(d.state.members)) return false;
          const next = { ...initial, ...(d.state as Partial<typeof initial>), onboarded: true };
          // backup-uri din versiuni mai vechi: aceleași reparații ca la actualizare
          next.settings = { ...DEFAULT_SETTINGS, ...next.settings };
          next.members = next.members.map((m) => ({ avoid: [], ...m }));
          next.plans = Object.fromEntries(Object.entries(next.plans ?? {}).filter(([, p]) =>
            p.meals.every((m) => RECIPE[m.recipeId] || (next.customRecipes ?? []).some((c) => c.id === m.recipeId))));
          syncRegistry(next.customRecipes ?? [], next.customIngredients ?? []);
          set(next);
          return true;
        },

        completeOnboarding: (members, settings, taste = {}) => {
          const main = members.find((m) => m.isMain);
          const ratings: Ratings = {};
          for (const [id, v] of Object.entries(taste)) ratings[id] = { up: v === 1 ? 1 : 0, down: v === -1 ? 1 : 0, skip: 0 };
          set({
            members, settings, onboarded: true, activeMemberId: main?.id, ratings,
            weightLog: members.map((m) => ({ dateISO: todayISO(), kg: m.weightKg, memberId: m.id })),
          });
        },
        upsertMember: (m) => {
          set((s) => {
            const exists = s.members.some((x) => x.id === m.id);
            const weightLog = exists ? s.weightLog : [...s.weightLog, { dateISO: todayISO(), kg: m.weightKg, memberId: m.id }];
            return { weightLog, members: exists ? s.members.map((x) => (x.id === m.id ? m : x)) : [...s.members, m] };
          });
          get().refitPlans();
        },
        removeMember: (id) => set((s) => ({
          members: s.members.filter((m) => m.id !== id || m.isMain),
          activeMemberId: s.activeMemberId === id ? s.members.find((m) => m.isMain)?.id : s.activeMemberId,
        })),
        updateSettings: (p) => {
          set((s) => ({ settings: { ...s.settings, ...p } }));
          if ('equipment' in p || 'fasting' in p || 'fishOnDispensation' in p) get().refitPlans();
        },
        refitPlans: () => {
          const today = todayISO();
          let total = 0;
          for (const p of Object.values(get().plans)) {
            if (toISO(addDays(fromISO(p.startISO), 6)) < today) continue;
            const fromDay = Math.max(0, Math.round((fromISO(today).getTime() - fromISO(p.startISO).getTime()) / 86400000));
            const s = get();
            const { plan, changed } = refitPlan(p, s.planInput(p.startISO, p.household, p.seed, p.store), fromDay);
            if (changed || plan !== p) { total += changed; set((st) => ({ plans: { ...st.plans, [p.id]: plan } })); }
          }
          if (total) set({ lastRefit: { atISO: new Date().toISOString(), count: total } });
          return total;
        },
        setFeature: (f, on) => {
          set((s) => {
          const settings: Settings = { ...s.settings, features: { ...s.settings.features, [f]: on } };
          if (f === 'post' && !on) settings.fasting = 'niciunul';
          if (f === 'post' && on && settings.fasting === 'niciunul') settings.fasting = 'miercuri_vineri';
          if (f === 'deserturi') settings.dessertsPerWeek = on ? Math.max(2, s.settings.dessertsPerWeek ?? 0) : 0;
          return { settings };
          });
          if (f === 'post') get().refitPlans();
        },
        setMealSlots: (slots) => {
          set((s) => ({ settings: { ...s.settings, slots, slotsAsked: true } }));
          const today = todayISO();
          for (const p of Object.values(get().plans)) {
            if (toISO(addDays(fromISO(p.startISO), 6)) < today) continue;
            const old = new Set(p.meals.map((m) => m.slot));
            const s = get();
            const input = s.planInput(p.startISO, p.household, p.seed, p.store);
            if (slots.every((x) => old.has(x)) || p.shoppingDone) {
              // mai puține mese (sau ai cumpărat deja): păstrez planul, scot mesele în plus, porțiile cresc
              const np = trimPlanSlots(p, slots, input);
              // ce ai mâncat deja dintr-o masă scoasă rămâne în jurnal, ca masă notată de tine
              const gone = new Set(p.eaten.filter((k) => !np.eaten.includes(k)));
              set((st) => ({
                plans: { ...st.plans, [p.id]: np },
                foodLog: st.foodLog.map((f) => (f.planId === p.id && f.mealKey && gone.has(f.mealKey) ? { ...f, planId: undefined, mealKey: undefined, slot: f.mealKey.split('|')[2] as Slot, ref: f.ref ?? refOf(p, f.mealKey) } : f)),
              }));
            } else {
              // mese noi: fac planul din nou cu aceleași bucătării; ce ai mâncat deja rămâne notat
              set((st) => ({
                foodLog: st.foodLog.map((f) => (f.planId === p.id && f.mealKey ? { ...f, planId: undefined, mealKey: undefined, slot: f.mealKey.split('|')[2] as Slot, ref: f.ref ?? refOf(p, f.mealKey) } : f)),
              }));
              get().generate(p.startISO, p.household, undefined, p.store, { wanted: p.wanted, cuisines: p.cuisines });
            }
          }
        },

        planInput: (startISO, household, seed, store) => {
          const s = get();
          // ce ai avut în plan în ultimele 4 săptămâni (cu cât mai recent, cu atât se evită mai mult)
          const history: Record<string, number> = {};
          const t0 = fromISO(startISO).getTime();
          for (const p of Object.values(s.plans)) {
            const weeks = Math.round((t0 - fromISO(p.startISO).getTime()) / (7 * 86400000));
            if (weeks < 1 || weeks > 4) continue;
            for (const m of p.meals) history[m.recipeId] = Math.min(history[m.recipeId] ?? 9, weeks);
          }
          return {
            startISO, members: s.members, household, settings: s.settings, pantry: s.pantry, prices: s.prices,
            liked: s.liked, previousRecipeIds: [], history, seed, swipes: s.swipes,
            store: store ?? s.plans[startISO]?.store ?? s.settings.mainStore ?? s.settings.stores?.[0], storePrices: s.storePrices,
            taste: buildTaste(s.ratings, RECIPE), disliked: [...new Set([...s.disliked, ...rejected(s.ratings)])],
          };
        },
        generate: (startISO, household, seed = Math.floor(Math.random() * 1e9), store, picks) => {
          const plan = {
            ...generatePlan({ ...get().planInput(startISO, household, seed, store), wanted: picks?.wanted, skipped: picks?.skipped, weekCuisines: picks?.cuisines, locked: picks?.locked }),
            wanted: picks?.wanted, cuisines: picks?.cuisines,
            locked: picks?.locked?.map((l) => `${l.day}|${l.slot}`),
          };
          if (picks?.cuisines?.length) set((s) => ({ settings: { ...s.settings, lastWeekCuisines: picks.cuisines } }));
          set((s) => {
            // un singur plan activ pe zi: planurile care se suprapun cu noul plan sunt înlocuite
            const plans: Record<string, WeekPlan> = {};
            for (const [k, p] of Object.entries(s.plans)) {
              const overlap = Math.abs(fromISO(p.startISO).getTime() - fromISO(startISO).getTime()) < 7 * 86400000;
              if (!overlap || p.startISO < startISO && p.shoppingDone) plans[k] = p;
            }
            // păstrează doar planurile ultimelor 8 săptămâni
            const cutoff = toISO(addDays(new Date(), -56));
            for (const k of Object.keys(plans)) if (plans[k].startISO < cutoff) delete plans[k];
            plans[plan.id] = plan;
            return { plans };
          });
          return plan;
        },
        toggleLock: (planId, day, slot) => set((s) => {
          const p = s.plans[planId];
          if (!p) return {};
          const k = `${day}|${slot}`;
          const locked = p.locked?.includes(k) ? p.locked.filter((x) => x !== k) : [...(p.locked ?? []), k];
          return { plans: { ...s.plans, [planId]: { ...p, locked } } };
        }),
        deletePlan: (id) => set((s) => {
          const plans = { ...s.plans };
          delete plans[id];
          return { plans };
        }),
        replaceSession: (planId, sessionId, recipeId) => set((s) => {
          const p = s.plans[planId];
          if (!p) return {};
          const old = p.sessions.find((x) => x.id === sessionId)?.recipeId;
          const np = replaceSessionRecipe(p, sessionId, recipeId, s.planInput(p.startISO, p.household, p.seed));
          return { plans: { ...s.plans, [planId]: np }, ratings: old ? bumpSkip(s.ratings, old) : s.ratings };
        }),
        replaceMeal: (planId, key, recipeId) => set((s) => {
          const p = s.plans[planId];
          if (!p) return {};
          const old = p.meals.find((m) => `${m.day}|${m.slot}` === key)?.recipeId;
          const np = replaceSingleMeal(p, key, recipeId, s.planInput(p.startISO, p.household, p.seed));
          return { plans: { ...s.plans, [planId]: np }, ratings: old ? bumpSkip(s.ratings, old) : s.ratings };
        }),

        toggleShopItem: (planId, ingId) => set((s) => {
          const p = s.plans[planId];
          if (!p) return {};
          return { plans: { ...s.plans, [planId]: { ...p, shopping: p.shopping.map((i) => (i.ingId === ingId ? { ...i, checked: !i.checked } : i)) } } };
        }),
        buyItems: (planId, ingIds, paid) => set((s) => {
          const p = s.plans[planId];
          if (!p) return {};
          let pantry = s.pantry;
          for (const it of p.shopping) {
            if (!ingIds.includes(it.ingId) || it.packages <= 0) continue;
            pantry = addToPantry(pantry, it.ingId, it.packages * ING[it.ingId].pkg);
          }
          const remaining = p.shopping.filter((i) => !ingIds.includes(i.ingId) && i.packages > 0);
          const np: WeekPlan = { ...p, shoppingDone: remaining.length === 0 ? true : p.shoppingDone };
          const plans = refreshPlans({ ...s.plans, [planId]: np }, pantry, s.prices);
          const store = p.store ?? s.settings.mainStore ?? 'altul';
          const spend = paid && paid > 0
            ? [...s.spend, { id: uid('c'), dateISO: todayISO(), store, amount: Math.round(paid * 100) / 100, source: 'lista' as const }]
            : s.spend;
          return { pantry, plans, spend };
        }),
        cookSession: (planId, sessionId) => set((s) => {
          const p = s.plans[planId];
          const ses = p?.sessions.find((x) => x.id === sessionId);
          if (!p || !ses || ses.done) return {};
          const pantry = consumeRecipe(s.pantry, RECIPE[ses.recipeId], ses.portions);
          const np = { ...p, sessions: p.sessions.map((x) => (x.id === sessionId ? { ...x, done: true } : x)) };
          return { pantry, plans: refreshPlans({ ...s.plans, [planId]: np }, pantry, s.prices) };
        }),
        pendingMeals: (dateISO) => {
          const s = get();
          const main = s.members.find((m) => m.id === s.activeMemberId) ?? s.members.find((m) => m.isMain);
          if (!main) return [];
          const out: { planId: string; day: number; slot: Slot; recipeId: string }[] = [];
          for (const p of Object.values(s.plans)) {
            const day = Math.round((fromISO(dateISO).getTime() - fromISO(p.startISO).getTime()) / 86400000);
            if (day < 0 || day > 6) continue;
            if (toISO(new Date(p.createdAt)) > dateISO) continue; // planul nu exista încă în ziua aia
            for (const m of p.meals.filter((x) => x.day === day && x.shares.some((sh) => sh.memberId === main.id))) {
              const key = eatenKey(main.id, m.day, m.slot);
              if (p.eaten.includes(key) || p.skipped?.includes(key)) continue;
              if (s.foodLog.some((f) => f.dateISO === dateISO && f.slot === m.slot && !f.mealKey && ownedBy(main.id, main.id, f.memberId))) continue;
              out.push({ planId: p.id, day: m.day, slot: m.slot, recipeId: m.recipeId });
            }
          }
          return out.sort((x, y) => SLOT_ORDER.indexOf(x.slot) - SLOT_ORDER.indexOf(y.slot));
        },
        confirmDay: (dateISO, how) => {
          const list = get().pendingMeals(dateISO);
          list.forEach((m, i) => {
            if (how === 'all' || (how === 'first' && i === 0)) get().toggleEaten(m.planId, m.day, m.slot);
            else get().skipMeal(m.planId, m.day, m.slot);
          });
        },
        skipMeal: (planId, day, slot) => {
          const s = get();
          const p = s.plans[planId];
          const main = s.members.find((m) => m.id === s.activeMemberId) ?? s.members.find((m) => m.isMain);
          if (!p || !main) return;
          const key = eatenKey(main.id, day, slot);
          set({
            plans: { ...s.plans, [planId]: { ...p, eaten: p.eaten.filter((k) => k !== key), skipped: [...new Set([...(p.skipped ?? []), key])] } },
            foodLog: s.foodLog.filter((f) => !(f.planId === planId && f.mealKey === key)),
          });
        },
        toggleEaten: (planId, day, slot, asTodo, override) => {
          const s = get();
          const p = s.plans[planId];
          if (!p) return;
          const meal = p.meals.find((m) => m.day === day && m.slot === slot);
          if (!meal) return;
          const main = s.members.find((m) => m.id === s.activeMemberId) ?? s.members.find((m) => m.isMain);
          if (!main) return;
          const key = eatenKey(main.id, day, slot);
          if (p.eaten.includes(key)) {
            set({
              plans: { ...s.plans, [planId]: { ...p, eaten: p.eaten.filter((k) => k !== key), skipped: asTodo ? p.skipped : [...new Set([...(p.skipped ?? []), key])] } },
              foodLog: s.foodLog.filter((f) => !(f.planId === planId && f.mealKey === key)),
            });
            return;
          }
          // o masă care se pregătește pe loc (mic dejun, gustare) se consideră pregătită când e mâncată
          // ce se pregătește pe loc (mic dejun, gustare, salata de lângă) se consideră pregătit când e mâncat
          for (const part of mealParts(meal)) {
            const ses = p.sessions.find((x) => x.id === part.sessionId);
            if (ses && !ses.done && sessionMeals(p, ses.id).length === 1) get().cookSession(planId, ses.id);
          }
          const r = RECIPE[meal.recipeId];
          const mm = mealMacros(meal, main.id, override);
          const extra = sidesLabel(meal);
          const cur = get().plans[planId];
          set((st) => ({
            plans: { ...st.plans, [planId]: { ...cur, eaten: [...cur.eaten, key], skipped: cur.skipped?.filter((k) => k !== key) } },
            foodLog: [...st.foodLog, {
              id: uid('f'), memberId: main.id, dateISO: toISO(addDays(fromISO(p.startISO), day)), label: extra ? `${r.name}, ${extra}` : r.name,
              kcal: mm.kcal, p: mm.p, c: mm.c, f: mm.f, fib: mm.fib, sug: mm.sug, salt: mm.salt, mealKey: key, planId,
            }],
          }));
        },

        addPantry: (ingId, g, days) => set((s) => {
          const pantry = addToPantry(s.pantry, ingId, g, new Date(), days);
          return { pantry, plans: refreshPlans(s.plans, pantry, s.prices) };
        }),
        setPantryQty: (id, g) => set((s) => {
          const pantry = g <= 0 ? s.pantry.filter((p) => p.id !== id) : s.pantry.map((p) => (p.id === id ? { ...p, g } : p));
          return { pantry, plans: refreshPlans(s.plans, pantry, s.prices) };
        }),
        removePantry: (id) => set((s) => {
          const pantry = s.pantry.filter((p) => p.id !== id);
          return { pantry, plans: refreshPlans(s.plans, pantry, s.prices) };
        }),

        setPrice: (ingId, price) => set((s) => {
          const prices = { ...s.prices };
          if (price === undefined || Number.isNaN(price)) delete prices[ingId];
          else prices[ingId] = price;
          return { prices, plans: refreshPlans(s.plans, s.pantry, prices) };
        }),
        toggleLike: (rid) => set((s) => ({ liked: toggle(s.liked, rid), disliked: s.disliked.filter((x) => x !== rid) })),
        toggleDislike: (rid) => {
          set((s) => ({ disliked: toggle(s.disliked, rid), liked: s.liked.filter((x) => x !== rid) }));
          if (get().disliked.includes(rid)) get().refitPlans();
        },

        addFood: (e) => set((s) => ({ foodLog: [...s.foodLog, { ...e, id: uid('f') }] })),
        removeFood: (id) => set((s) => {
          const f = s.foodLog.find((x) => x.id === id);
          let plans = s.plans;
          if (f?.planId && f.mealKey && plans[f.planId]) {
            const p = plans[f.planId];
            plans = { ...plans, [f.planId]: { ...p, eaten: p.eaten.filter((k) => k !== f.mealKey) } };
          }
          return { foodLog: s.foodLog.filter((x) => x.id !== id), plans };
        }),
        addWeight: (kg, dateISO = todayISO()) => set((s) => {
          const mid = activeId(s);
          const weightLog = [...s.weightLog.filter((w) => !(w.dateISO === dateISO && (w.memberId ?? mainId(s)) === mid)), { dateISO, kg, memberId: mid }]
            .sort((a, b) => a.dateISO.localeCompare(b.dateISO));
          const mine = weightLog.filter((w) => (w.memberId ?? mainId(s)) === mid);
          const latest = mine[mine.length - 1];
          return { weightLog, members: s.members.map((m) => (m.id === mid ? { ...m, weightKg: latest.kg } : m)) };
        }),
        removeWeight: (dateISO) => set((s) => {
          const mid = activeId(s);
          return { weightLog: s.weightLog.filter((w) => !(w.dateISO === dateISO && (w.memberId ?? mainId(s)) === mid)) };
        }),
        adjustKcal: (delta) => set((s) => {
          const mid = activeId(s);
          return { members: s.members.map((m) => (m.id === mid ? { ...m, kcalAdjust: m.kcalAdjust + delta } : m)) };
        }),
        resetAll: () => set({ ...initial }),
      };
    },
    {
      name: 'nutritie-v1',
      version: 2,
      // v2: rețete noi (cu poze). Planurile vechi care folosesc rețete șterse se scot; restul datelor rămân.
      migrate: (persisted, from) => {
        const st = (persisted ?? {}) as Record<string, unknown>;
        if (from < 2) {
          const plans = (st.plans ?? {}) as Record<string, WeekPlan>;
          const keep: Record<string, WeekPlan> = {};
          for (const [k, p] of Object.entries(plans)) {
            if (p.meals.every((m) => RECIPE[m.recipeId] || (st.customRecipes as Recipe[] | undefined)?.some((r) => r.id === m.recipeId))) keep[k] = p;
          }
          st.plans = keep;
          st.settings = { ...DEFAULT_SETTINGS, ...(st.settings as Settings | undefined) };
          st.members = ((st.members ?? []) as Member[]).map((m) => ({ avoid: [], ...m }));
        }
        return st as never;
      },
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        onboarded: s.onboarded, members: s.members, settings: s.settings, plans: s.plans, pantry: s.pantry,
        prices: s.prices, liked: s.liked, disliked: s.disliked, foodLog: s.foodLog, weightLog: s.weightLog,
        activeMemberId: s.activeMemberId, lockEnabled: s.lockEnabled, customRecipes: s.customRecipes,
        customIngredients: s.customIngredients, ratings: s.ratings, mealRatings: s.mealRatings, notifyExpiry: s.notifyExpiry,
        lastBackupISO: s.lastBackupISO, receiptAliases: s.receiptAliases, storePrices: s.storePrices, spend: s.spend,
        favFoods: s.favFoods, lastRecapISO: s.lastRecapISO, swipes: s.swipes, livePrices: s.livePrices, priceProducts: s.priceProducts,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) { syncRegistry(state.customRecipes ?? [], state.customIngredients ?? []); const own = state.livePrices; const bundledNewer = !!BUNDLED_PRICES.fetchedAt && (!own || String(BUNDLED_PRICES.fetchedAt) > own.fetchedAt); setLivePrices(bundledNewer ? BUNDLED_PRICES.prices as never : own?.prices); }
        useStore.setState({ hydrated: true });
      },
    },
  ),
);

// numele meselor („Prima masă”, „A doua masă”) urmează mereu câte mese ai ales
setLabelSlots(useStore.getState().settings.slots);
setThemeId(useStore.getState().settings.theme);
useStore.subscribe((s, prev) => {
  if (s.settings.slots !== prev.settings.slots) setLabelSlots(s.settings.slots);
  if (s.settings.theme !== prev.settings.theme) setThemeId(s.settings.theme);
});

/** e pornită funcția asta? (ce e oprit nu apare nicăieri) */
export const useFeature = (f: Feature) => useStore((s) => featureOn(s, f));

export const useMain = () => useStore((s) => s.members.find((m) => m.isMain));

const mainId = (s: { members: Member[] }) => s.members.find((m) => m.isMain)?.id ?? '';
/** datele personale (jurnal, greutate) sunt ale proprietarului telefonului */
const activeId = (s: { members: Member[] }) => mainId(s);

/** membrul ale cărui date personale sunt afișate (jurnal, greutate, țintă) */
export function useActiveMember(): Member | undefined {
  return useStore((s) => s.members.find((m) => m.id === activeId(s)));
}
/** ce aparține membrului activ; intrările vechi fără membru sunt ale utilizatorului principal */
export const ownedBy = (memberId: string | undefined, mainMemberId: string | undefined, entryMember?: string) =>
  (entryMember ?? mainMemberId) === memberId;

/** planul care conține data dată */
export function planForDate(plans: Record<string, WeekPlan>, iso: string): { plan: WeekPlan; day: number } | undefined {
  for (const p of Object.values(plans).sort((a, b) => b.startISO.localeCompare(a.startISO))) {
    const d = Math.round((fromISO(iso).getTime() - fromISO(p.startISO).getTime()) / 86400000);
    if (d >= 0 && d < 7) return { plan: p, day: d };
  }
  return undefined;
}

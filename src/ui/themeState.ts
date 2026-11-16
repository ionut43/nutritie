/*
 * Tema aleasă (fără dependențe de React Native, ca să o poată schimba și magazinul de date).
 * Fontul titlurilor e o legătură ES: când se schimbă tema, toți cei care îl importă îl văd nou.
 */
export type ThemeId = 'email' | 'horezu' | 'piata' | 'caiet' | 'anotimp';

const FONTS: Record<ThemeId, [string, string]> = {
  email: ['Bricolage-700', 'Bricolage-800'],
  horezu: ['Fraunces-700', 'Fraunces-800'],
  piata: ['CabinSketch-700', 'CabinSketch-700'],
  caiet: ['Kalam-700', 'Kalam-700'],
  anotimp: ['Bricolage-700', 'Bricolage-800'],
};

export let DISPLAY = 'Bricolage-700';
export let DISPLAY_X = 'Bricolage-800';
let themeId: ThemeId = 'email';
const listeners = new Set<() => void>();

export function setThemeId(id: ThemeId | undefined) {
  const next: ThemeId = id && FONTS[id] ? id : 'email';
  if (next === themeId) return;
  themeId = next;
  [DISPLAY, DISPLAY_X] = FONTS[next];
  listeners.forEach((f) => f());
}
export const getThemeId = () => themeId;
export const subscribeTheme = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
export const themeFont = (id: ThemeId) => FONTS[id][0];

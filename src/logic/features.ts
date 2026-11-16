import type { Settings } from './types';

/*
 * „Funcții în plus”: aplicația pornește simplă. Ce e oprit nu apare nicăieri, nici în meniuri, nici în întrebări.
 */
export type Feature = 'post' | 'deserturi' | 'cantar' | 'familie' | 'preturi' | 'camara';

export const FEATURES: { id: Feature; title: string; desc: string }[] = [
  { id: 'camara', title: 'Cămara', desc: 'Ce cumperi intră în cămară, ce gătești se scade. Îți spune ce se strică și ce poți găti din ce ai.' },
  { id: 'cantar', title: 'Cântarul', desc: 'Îți notezi greutatea de 2–3 ori pe săptămână. Vezi tendința și, după 2–3 săptămâni, ținta de calorii se poate corecta.' },
  { id: 'preturi', title: 'Prețurile de azi', desc: 'Prețurile raportate zilnic de magazinele din zona ta (Monitorul Prețurilor), în loc de estimări.' },
  { id: 'familie', title: 'Mai multe persoane la masă', desc: 'Gătești și pentru alții: fiecare are porția lui, iar lista se face pentru toți.' },
  { id: 'post', title: 'Post', desc: 'Calendarul ortodox sau post la anumite ore. Planul pune rețete de post în zilele de post.' },
  { id: 'deserturi', title: 'Deserturi în plan', desc: 'Câteva deserturi pe săptămână, în ținta de calorii.' },
];

/** dacă n-ai ales încă: pornit doar dacă îl foloseai deja (date existente), altfel oprit */
export function featureOn(
  s: { settings: Settings; members: unknown[]; weightLog: unknown[]; pantry: unknown[]; livePrices?: unknown },
  f: Feature,
): boolean {
  const v = s.settings.features?.[f];
  if (v !== undefined) return v;
  switch (f) {
    case 'post': return s.settings.fasting !== 'niciunul';
    case 'deserturi': return (s.settings.dessertsPerWeek ?? 0) > 0;
    case 'cantar': return s.weightLog.length > 0;
    case 'familie': return s.members.length > 1;
    case 'preturi': return !!s.livePrices;
    case 'camara': return s.pantry.length > 0;
  }
}

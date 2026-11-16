import type { ProteinKind } from '../logic/nutrition';
import type { Cuisine } from '../logic/types';

export const CUISINE_LABEL: Record<Cuisine, string> = {
  ro: 'Românească', eu: 'Europeană', it: 'Italiană', med: 'Mediteraneană', or: 'Orientală', as: 'Asiatică',
  in: 'Indiană', mx: 'Mexicană', us: 'Americană',
};

/** rețeta cu poza care reprezintă cel mai bine bucătăria (pentru alegerea gusturilor) */
export const CUISINE_SAMPLE: Record<Cuisine, string> = {
  ro: 'sarmale', eu: 'stroganoff_vita', it: 'lasagna_carne', med: 'salata_greceasca_pui', or: 'shaorma_pui',
  as: 'pui_kung_pao', in: 'pui_tandoori', mx: 'chili_con_carne', us: 'burger_vita_ou',
};

/** 1.25 → „1¼” */
export function fmtPortion(x: number): string {
  const q = Math.round(x * 4) / 4;
  const whole = Math.floor(q);
  const frac = q - whole;
  const f = frac === 0.25 ? '¼' : frac === 0.5 ? '½' : frac === 0.75 ? '¾' : '';
  if (whole === 0) return f || '¼';
  return `${whole}${f}`;
}

export const KIND_LABEL: Record<ProteinKind, string> = {
  pui: 'pui', curcan: 'curcan', porc: 'porc', vita: 'vită', miel: 'miel', organe: 'organe', peste: 'pește',
  fructe_mare: 'fructe de mare', leguminoase: 'leguminoase', oua_lactate: 'ouă și brânză', legume: 'legume',
};

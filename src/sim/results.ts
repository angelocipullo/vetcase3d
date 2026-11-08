import { Phys, ResultRow } from './types';

/** Riga di referto con flag automatico rispetto all'intervallo di riferimento. */
export function row(label: string, value: number, unit: string, lo: number | null, hi: number | null, gen = false, decimals?: number): ResultRow {
  const v = decimals === undefined ? value : Number(value.toFixed(decimals));
  const flag = lo !== null && v < lo ? 'L' : hi !== null && v > hi ? 'H' : '';
  const ref = lo !== null && hi !== null ? `${lo}–${hi}` : lo !== null ? `> ${lo}` : hi !== null ? `< ${hi}` : '';
  return { label, value: v, unit, ref, flag, gen };
}

export const txt = (label: string, value: string, ref = '', gen = false, abnormal = false): ResultRow => ({
  label,
  value,
  ref,
  gen,
  flag: abnormal ? 'H' : '',
});

/** Emogas venoso + elettroliti calcolato dallo stato fisiologico (valori di riferimento felini). */
export function bloodGasRows(p: Phys): ResultRow[] {
  const be = 0.93 * (p.hco3 - 24.4 + 14.8 * (p.ph - 7.4));
  return [
    row('pH', p.ph, '', 7.28, 7.41, true, 2),
    row('pCO₂', p.pco2, 'mmHg', 33, 45, true, 1),
    row('HCO₃⁻', p.hco3, 'mmol/L', 18, 23, true, 1),
    row('BE', be, 'mmol/L', -5, 2, true, 1),
    row('Na⁺', p.na, 'mEq/L', 147, 157, true, 0),
    row('K⁺', p.k, 'mEq/L', 3.5, 5.5, true, 1),
    row('Cl⁻', p.cl, 'mEq/L', 115, 123, true, 0),
    row('iCa', 1.21, 'mmol/L', 1.1, 1.4, true, 2),
    row('Glucosio', p.glu, 'mg/dL', 70, 150, true, 0),
    row('Lattati', p.lact, 'mmol/L', null, 2.5, true, 1),
  ];
}

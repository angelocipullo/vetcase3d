/**
 * Protocolli clinici riusabili da più casi.
 */

/** Scala di integrazione del potassio (Greco): mEq di KCl per litro di fluido e velocità massima. */
export const K_SCALE: { maxK: number; meqL: number; maxMlKgH: number; range: string }[] = [
  { maxK: 2.0, meqL: 80, maxMlKgH: 6, range: '< 2,0' },
  { maxK: 2.5, meqL: 60, maxMlKgH: 8, range: '2,1–2,5' },
  { maxK: 3.0, meqL: 40, maxMlKgH: 12, range: '2,6–3,0' },
  { maxK: 3.5, meqL: 28, maxMlKgH: 18, range: '3,1–3,5' },
  { maxK: Infinity, meqL: 20, maxMlKgH: 25, range: '3,6–5,0' },
];

export function kScale(k: number) {
  return K_SCALE.find((s) => k <= s.maxK + 0.049)!;
}

/** ml di KCl concentrato da aggiungere a una sacca per ottenere la concentrazione voluta. */
export function kclMlToAdd(bagMl: number, targetMeqL: number, kclMeqPerMl: number, fluidK = 0) {
  return ((targetMeqL - fluidK) * (bagMl / 1000)) / kclMeqPerMl;
}

/** Fabbisogno di mantenimento nel gatto (ml/h), formula 80 × kg^0,75 / 24. */
export function maintenanceMlH(kg: number) {
  return (80 * Math.pow(kg, 0.75)) / 24;
}

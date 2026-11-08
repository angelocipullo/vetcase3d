import { DiseaseProfile, Phys, Therapy } from './types';

/**
 * Modello fisiologico semplificato (didattico, NON quantitativamente validato).
 * Integra a passi di pochi minuti: bilancio del potassio, equilibrio acido-base, sodio, pressione.
 *
 * Potassio: il plasma scambia con un grande compartimento intracellulare impoverito, per questo
 * la correzione è lenta (volume "efficace" ~3,8 L/kg). Con eccesso di aldosterone la secrezione
 * distale cresce in modo ripido con il K plasmatico (~K³): anche l'integrazione massima sicura
 * (0,5 mEq/kg/h) si stabilizza sotto 3,5 mEq/L → ipokaliemia refrattaria, il cuore didattico
 * del caso Birillo. Con lo spironolattone la perdita cala e l'integrazione va ridotta.
 */

export const K_MAX_SAFE = 0.5; // mEq/kg/h

const FLUID_K: Record<Therapy['fluids']['fluid'], number> = { none: 0, rl: 4, nacl: 0, g5: 0 };

export const sinceH = (t: number, start: number | undefined) => (start === undefined ? -1 : (t - start) / 60);

const SPIRO_MAX = 0.7;

/** Effetto (0..0,7) dello spironolattone: antagonista dell'aldosterone, pieno in ~12 h (accelerato per esigenze di gioco). */
export function spiroEffect(th: Therapy, t: number) {
  const h = sinceH(t, th.drugs.spironolattone);
  return h < 0 ? 0 : Math.min(SPIRO_MAX, (h / 12) * SPIRO_MAX);
}

export function amloEffect(th: Therapy, t: number) {
  const h = sinceH(t, th.drugs.amlodipina);
  return h < 0 ? 0 : Math.min(1, h / 6);
}

export function aldoEffective(d: DiseaseProfile, th: Therapy, t: number) {
  return d.aldo * (1 - spiroEffect(th, t));
}

/** mEq/kg/h di potassio infusi EV. */
export function kInfusionRate(th: Therapy, kg: number) {
  const f = th.fluids;
  if (f.fluid === 'none' || f.rateMlH <= 0) return 0;
  return ((f.rateMlH / 1000) * (f.kclMeqL + FLUID_K[f.fluid])) / kg;
}

const relax = (v: number, target: number, dtH: number, tauH: number) => v + (target - v) * Math.min(1, dtH / tauH);

export function tick(p: Phys, th: Therapy, d: DiseaseProfile, t: number, dtMin: number): Phys {
  const dtH = dtMin / 60;
  const kg = d.kg;
  const aldo = aldoEffective(d, th, t);
  const spiro = spiroEffect(th, t);
  const amlo = amloEffect(th, t);
  const f = th.fluids;
  const rate = f.fluid === 'none' ? 0 : f.rateMlH;
  const on = (id: keyof Therapy['drugs']) => th.drugs[id] !== undefined;

  // --- potassio ---
  const kIn = kInfusionRate(th, kg) * kg + (on('kclOrale') ? 0.02 * kg : 0);
  let kOut = kg * (0.004 * p.k + 0.0136 * aldo * p.k ** 3); // renale: basale + aldosterone-dipendente
  kOut += (rate / 1000) * 6 * (p.k / 4); // kaliuresi da flusso
  if (p.vomiting) kOut += 0.1;
  if (f.fluid === 'g5' && rate > 0) kOut += 0.35; // insulina endogena → K nelle cellule
  if (on('insulina')) kOut += 0.5;
  if (on('furosemide')) kOut += 0.4;
  if (on('bicarbonato')) kOut += 0.3; // alcalinizzazione → shift intracellulare
  const k = Math.max(1.0, p.k + ((kIn - kOut) / (3.8 * kg)) * dtH);

  // --- acido-base ---
  const chlorideFluid = (f.fluid === 'rl' || f.fluid === 'nacl') && rate >= 10;
  const hco3Target =
    24 + 6 * aldo + 2.5 * Math.max(0, 3.5 - k) - (chlorideFluid ? 3 : 0) + (on('bicarbonato') ? 6 : 0) + (on('furosemide') ? 2 : 0);
  const hco3 = relax(p.hco3, hco3Target, dtH, 10);
  // compenso respiratorio; sotto 1,7 mEq/L di K i muscoli respiratori cedono → ipoventilazione
  const pco2 = 40 + 0.7 * (hco3 - 24) + (k < 1.7 ? (1.7 - k) * 40 : 0);
  const ph = 6.1 + Math.log10(hco3 / (0.03 * pco2));

  // --- sodio / cloro ---
  const na = relax(p.na, 151 + 5 * aldo - (f.fluid === 'g5' && rate > 0 ? 5 : 0), dtH, 12);
  const cl = na - hco3 - 18;

  // --- emodinamica ---
  const sbpTarget = 135 + 75 * d.aldo + (d.extraSbp ?? 0) - 18 * (spiro / SPIRO_MAX) - 55 * amlo + (rate > 30 ? 10 : 0);
  const sbp = relax(p.sbp, sbpTarget, dtH, 3);
  const hrTarget = k > 6.5 ? 120 : (d.hrBase ?? 175) + (sbp > 180 ? 10 : 0);
  const hr = relax(p.hr, hrTarget, dtH, 6);
  const rr = k < 1.7 ? 12 : relax(p.rr, d.rrBase ?? 22, dtH, 4);
  const temp = relax(p.temp, 38.6, dtH, 8);
  const glu = relax(p.glu, on('insulina') ? 70 : f.fluid === 'g5' && rate > 0 ? 190 : 110, dtH, 3);

  const vomiting = p.vomiting && !(sinceH(t, th.drugs.maropitant) >= 0.5);

  return { k, na, cl, hco3, pco2, ph, glu, lact: p.lact, sbp, hr, rr, temp, vomiting };
}

/** Segni clinici osservabili derivati dallo stato (`extra`: segni specifici del caso). */
export function clinicalSigns(p: Phys, extra: string[] = []) {
  const signs: string[] = [];
  let weakness: 0 | 1 | 2 | 3 = 0;
  if (p.k < 2.0) weakness = 3;
  else if (p.k < 2.5) weakness = 2;
  else if (p.k < 3.0) weakness = 1;
  if (weakness === 3) signs.push('Ventroflessione del collo marcata, non riesce a stare in stazione');
  else if (weakness === 2) signs.push('Ventroflessione del collo, debolezza muscolare generalizzata');
  else if (weakness === 1) signs.push('Lieve debolezza, cammina con andatura rigida');
  if (p.k < 1.7) signs.push('Respiro superficiale e inefficace');
  if (p.vomiting) signs.push('Conati e vomito');
  if (p.sbp >= 180) signs.push('Midriasi bilaterale, sembra non seguire gli oggetti');
  if (p.k > 6) signs.push('Bradicardia, polso debole');
  const mentation = p.k < 1.5 ? 'stupor' : p.sbp >= 180 || p.k < 2.0 ? 'ottundimento' : 'vigile';
  signs.unshift(...extra);
  if (signs.length === 0) signs.push('Vigile e reattivo, deambula normalmente');
  return { signs, weakness, mentation };
}

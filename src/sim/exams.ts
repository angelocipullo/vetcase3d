import { DrugId, ExamId, FluidId, VitalId } from './types';

export interface ExamMeta {
  label: string;
  short: string;
  icon: string;
  /** Costo indicativo (€). */
  cost: number;
  /** Minuti di lavoro del medico (prelievo, esecuzione). */
  workMin: number;
  /** Minuti dal prelievo al referto. */
  turnaroundMin: number;
  kind: 'lab' | 'strumentale';
  /** Esame eseguito tramite minigioco. */
  minigame?: 'ecofast' | 'doppler' | 'fondo';
}

/** Catalogo generico, condiviso da tutti i casi. Costi e tempi sono indicativi. */
export const EXAMS: Record<ExamId, ExamMeta> = {
  emocromo: { label: 'Emocromo citometrico', short: 'Emocromo', icon: '🩸', cost: 25, workMin: 5, turnaroundMin: 15, kind: 'lab' },
  biochimico: { label: 'Profilo biochimico', short: 'Biochimico', icon: '🧪', cost: 45, workMin: 0, turnaroundMin: 30, kind: 'lab' },
  emogas: { label: 'Emogasanalisi + elettroliti', short: 'Emogas', icon: '⚗️', cost: 30, workMin: 3, turnaroundMin: 5, kind: 'lab' },
  coagulazione: { label: 'Test della coagulazione (PT/aPTT)', short: 'Coagulazione', icon: '🩹', cost: 35, workMin: 0, turnaroundMin: 20, kind: 'lab' },
  lattati: { label: 'Lattatemia', short: 'Lattati', icon: '📈', cost: 10, workMin: 1, turnaroundMin: 2, kind: 'lab' },
  urine: { label: 'Esame urine + UPC + frazione di escrezione K⁺', short: 'Urine + FE K', icon: '🧫', cost: 35, workMin: 10, turnaroundMin: 40, kind: 'lab' },
  t4: { label: 'T4 totale', short: 'T4', icon: '🦋', cost: 30, workMin: 0, turnaroundMin: 60, kind: 'lab' },
  fivfelv: { label: 'Test rapido FIV/FeLV', short: 'FIV/FeLV', icon: '🧷', cost: 30, workMin: 0, turnaroundMin: 15, kind: 'lab' },
  aldosterone: { label: 'Aldosterone sierico (lab esterno, urgente)', short: 'Aldosterone', icon: '🧬', cost: 80, workMin: 0, turnaroundMin: 24 * 60, kind: 'lab' },
  ecofast: { label: 'Eco-FAST (A-FAST/T-FAST)', short: 'Eco-FAST', icon: '📡', cost: 40, workMin: 10, turnaroundMin: 0, kind: 'strumentale', minigame: 'ecofast' },
  ecografia: { label: 'Ecografia addominale specialistica', short: 'Eco addome', icon: '🔊', cost: 90, workMin: 40, turnaroundMin: 0, kind: 'strumentale' },
  rx: { label: 'Radiografia torace (3 proiezioni)', short: 'RX torace', icon: '🩻', cost: 60, workMin: 25, turnaroundMin: 10, kind: 'strumentale' },
  ecg: { label: 'Elettrocardiogramma', short: 'ECG', icon: '💓', cost: 35, workMin: 10, turnaroundMin: 0, kind: 'strumentale' },
  endoscopia: { label: 'Gastroscopia', short: 'Endoscopia', icon: '🔦', cost: 350, workMin: 90, turnaroundMin: 0, kind: 'strumentale' },
  tc: { label: 'TC total body con mezzo di contrasto', short: 'TC', icon: '🌀', cost: 450, workMin: 120, turnaroundMin: 60, kind: 'strumentale' },
  ecocardio: { label: 'Ecocardiografia', short: 'Ecocardio', icon: '🫀', cost: 120, workMin: 40, turnaroundMin: 0, kind: 'strumentale' },
  pa: { label: 'Pressione arteriosa (Doppler)', short: 'PA Doppler', icon: '🎚️', cost: 15, workMin: 5, turnaroundMin: 0, kind: 'strumentale', minigame: 'doppler' },
  gruppo: { label: 'Tipizzazione del gruppo sanguigno (AB) + crossmatch', short: 'Gruppo sanguigno', icon: '🅰️', cost: 40, workMin: 5, turnaroundMin: 15, kind: 'lab' },
  fondo: { label: 'Esame del fondo oculare', short: 'Fondo occhio', icon: '👁️', cost: 20, workMin: 5, turnaroundMin: 0, kind: 'strumentale', minigame: 'fondo' },
};

export const VITAL_LABEL: Record<VitalId, { label: string; icon: string; min: number }> = {
  temp: { label: 'Temperatura', icon: '🌡️', min: 2 },
  polso: { label: 'Polso femorale', icon: '💗', min: 1 },
  resp: { label: 'Frequenza respiratoria', icon: '🫁', min: 1 },
  mucose: { label: 'Mucose', icon: '👄', min: 1 },
  trc: { label: 'Tempo di riempimento capillare', icon: '⏱️', min: 1 },
  loc: { label: 'Stato mentale (LOC)', icon: '🧠', min: 1 },
  pa: { label: 'Pressione arteriosa (Doppler)', icon: '🎚️', min: 5 },
};

export const FLUID_LABEL: Record<FluidId, string> = {
  none: 'Nessun fluido',
  rl: 'Ringer lattato (K⁺ 4 mEq/L)',
  nacl: 'NaCl 0,9%',
  g5: 'Glucosata 5%',
};

export const DRUGS: Record<DrugId, { label: string; dose: string; note: string }> = {
  maropitant: { label: 'Maropitant', dose: '1 mg/kg EV SID', note: 'Antiemetico' },
  spironolattone: { label: 'Spironolattone', dose: '2 mg/kg PO BID', note: 'Antagonista dell’aldosterone, risparmiatore di K⁺' },
  amlodipina: { label: 'Amlodipina', dose: '0,125–0,25 mg/kg PO SID', note: 'Calcio-antagonista, antipertensivo' },
  kclOrale: { label: 'Potassio gluconato orale', dose: '2 mEq/gatto PO BID', note: 'Integrazione orale di K⁺' },
  furosemide: { label: 'Furosemide', dose: '1 mg/kg EV', note: 'Diuretico dell’ansa (kaliuretico)' },
  bicarbonato: { label: 'Bicarbonato di sodio', dose: '1 mEq/kg EV lento', note: 'Alcalinizzante' },
  insulina: { label: 'Insulina rapida + destrosio', dose: '0,1 UI/kg EV', note: 'Sposta K⁺ nelle cellule' },
  diazepam: { label: 'Diazepam', dose: '0,5 mg/kg EV', note: 'Benzodiazepina, sedativo/anticonvulsivante' },
};

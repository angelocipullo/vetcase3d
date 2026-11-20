/** Tipi dell'ambulatorio 3D: strumenti, suoni di auscultazione e tecnica delle procedure. */

/** Strumenti disponibili nella toolbar. */
export enum Tool {
  Hand = 'hand',
  Stethoscope = 'stethoscope',
  Thermometer = 'thermometer',
  /** Prelievo dalla vena cefalica (tricotomia, laccio, ago, cerotto). */
  Syringe = 'syringe',
  /** Polso femorale (dita sull'interno coscia). */
  Pulse = 'pulse',
  /** Osservazione del torace per la frequenza respiratoria. */
  Resp = 'resp',
}

export enum HeartSound {
  Normal = 'normal',
  Tachycardia = 'tachycardia',
  Bradycardia = 'bradycardia',
  Murmur = 'murmur',
  Arrhythmia = 'arrhythmia',
}

export enum LungSound {
  Normal = 'normal',
  Crackles = 'crackles',
  Wheezes = 'wheezes',
  Muffled = 'muffled',
}

export enum SyringePhase {
  Prepare = 'prepare',
  Insert = 'insert',
  Aspirate = 'aspirate',
  Finish = 'finish',
  /** Ago estratto: resta da mettere il cerotto. */
  Bandage = 'bandage',
  Done = 'done',
}

/** Errori tecnici tracciati durante il prelievo. */
export enum TechniqueError {
  MissedVein = 'missed_vein',
  TransfixedVein = 'transfixed_vein',
  NeedleTooFlat = 'needle_too_flat',
  VeinCollapsed = 'vein_collapsed',
  NoDisinfection = 'no_disinfection',
  NoClipping = 'no_clipping',
  Hematoma = 'hematoma',
  InterruptedReading = 'interrupted_reading',
  NoLubricant = 'no_lubricant',
}

export interface Vitals {
  heartRate: number;
  heartSound: HeartSound;
  respRate: number;
  lungSound: LungSound;
  temperature: number;
}

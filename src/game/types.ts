/** Strumenti disponibili nella toolbar. */
export enum Tool {
  Hand = 'hand',
  Stethoscope = 'stethoscope',
  Thermometer = 'thermometer',
  Syringe = 'syringe',
}

/** Zone anatomiche interattive del paziente. */
export enum Zone {
  Heart = 'heart',
  Lungs = 'lungs',
  Rectal = 'rectal',
  CephalicVein = 'cephalic_vein',
}

/** Esami che l'utente può eseguire. Ogni caso ne richiede un sottoinsieme. */
export enum Exam {
  HeartAuscultation = 'heart_auscultation',
  LungAuscultation = 'lung_auscultation',
  Temperature = 'temperature',
  BloodSample = 'blood_sample',
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

export enum Diagnosis {
  Parvovirus = 'parvovirus',
  Gastroenteritis = 'gastroenteritis',
  Bronchopneumonia = 'bronchopneumonia',
  KennelCough = 'kennel_cough',
  MitralValveDisease = 'mitral_valve_disease',
  Babesiosis = 'babesiosis',
  Leishmaniasis = 'leishmaniasis',
  Healthy = 'healthy',
}

/** Esito finale della valutazione del caso. */
export enum Outcome {
  Excellent = 'excellent',
  Correct = 'correct',
  CorrectIncomplete = 'correct_incomplete',
  Wrong = 'wrong',
}

export enum SyringePhase {
  Prepare = 'prepare',
  Insert = 'insert',
  Aspirate = 'aspirate',
  Finish = 'finish',
  Done = 'done',
}

/** Errori tecnici tracciati durante il prelievo. */
export enum TechniqueError {
  MissedVein = 'missed_vein',
  TransfixedVein = 'transfixed_vein',
  NeedleTooFlat = 'needle_too_flat',
  VeinCollapsed = 'vein_collapsed',
  NoDisinfection = 'no_disinfection',
  Hematoma = 'hematoma',
  InterruptedReading = 'interrupted_reading',
}

export enum CaseId {
  Parvo = 'parvo',
  Bronchopneumonia = 'bronchopneumonia',
  Mitral = 'mitral',
  Babesiosis = 'babesiosis',
  Healthy = 'healthy',
}

export enum LabParam {
  HCT = 'hct',
  WBC = 'wbc',
  NEUT = 'neut',
  PLT = 'plt',
  TP = 'tp',
}

export type LabPanel = Record<LabParam, number>;

export interface Patient {
  name: string;
  breed: string;
  age: string;
  weightKg: number;
  sex: 'M' | 'F';
}

export interface Vitals {
  heartRate: number;
  heartSound: HeartSound;
  respRate: number;
  lungSound: LungSound;
  temperature: number;
}

export interface CoatColors {
  base: string;
  belly: string;
  ears: string;
}

export interface ClinicalCase {
  id: CaseId;
  title: string;
  difficulty: 1 | 2 | 3;
  patient: Patient;
  anamnesis: string[];
  vitals: Vitals;
  blood: LabPanel;
  correctDiagnosis: Diagnosis;
  /** Esami indispensabili per una diagnosi giustificata. */
  requiredExams: Exam[];
  explanation: string;
  coat: CoatColors;
}

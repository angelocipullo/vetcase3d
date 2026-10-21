import { Diagnosis, Exam, HeartSound, LabParam, LungSound, Outcome, TechniqueError, Tool } from './types';

export const TOOL_LABEL: Record<Tool, string> = {
  [Tool.Hand]: 'Coccole',
  [Tool.Stethoscope]: 'Fonendo',
  [Tool.Thermometer]: 'Termometro',
  [Tool.Syringe]: 'Siringa',
};

export const EXAM_LABEL: Record<Exam, string> = {
  [Exam.HeartAuscultation]: 'Auscultazione cardiaca',
  [Exam.LungAuscultation]: 'Auscultazione polmonare',
  [Exam.Temperature]: 'Temperatura rettale',
  [Exam.BloodSample]: 'Prelievo + emocromo',
};

export const HEART_LABEL: Record<HeartSound, string> = {
  [HeartSound.Normal]: 'Normale',
  [HeartSound.Tachycardia]: 'Tachicardia',
  [HeartSound.Bradycardia]: 'Bradicardia',
  [HeartSound.Murmur]: 'Soffio',
  [HeartSound.Arrhythmia]: 'Aritmia',
};

export const LUNG_LABEL: Record<LungSound, string> = {
  [LungSound.Normal]: 'Murmure vescicolare normale',
  [LungSound.Crackles]: 'Crepitii',
  [LungSound.Wheezes]: 'Sibili',
  [LungSound.Muffled]: 'Suoni attutiti',
};

export const DIAGNOSIS_LABEL: Record<Diagnosis, string> = {
  [Diagnosis.Parvovirus]: 'Parvovirosi',
  [Diagnosis.Gastroenteritis]: 'Gastroenterite aspecifica',
  [Diagnosis.Bronchopneumonia]: 'Broncopolmonite batterica',
  [Diagnosis.KennelCough]: 'Tracheobronchite infettiva (tosse dei canili)',
  [Diagnosis.MitralValveDisease]: 'Endocardiosi mitralica con ICC',
  [Diagnosis.Babesiosis]: 'Babesiosi',
  [Diagnosis.Leishmaniasis]: 'Leishmaniosi',
  [Diagnosis.Healthy]: 'Paziente sano',
};

export const LAB_META: Record<LabParam, { label: string; unit: string; min: number; max: number }> = {
  [LabParam.HCT]: { label: 'Ematocrito', unit: '%', min: 37, max: 55 },
  [LabParam.WBC]: { label: 'Globuli bianchi', unit: '×10⁹/L', min: 6, max: 17 },
  [LabParam.NEUT]: { label: 'Neutrofili', unit: '×10⁹/L', min: 3, max: 11.5 },
  [LabParam.PLT]: { label: 'Piastrine', unit: '×10⁹/L', min: 200, max: 500 },
  [LabParam.TP]: { label: 'Proteine totali', unit: 'g/dL', min: 5.4, max: 7.5 },
};

export const OUTCOME_LABEL: Record<Outcome, { title: string; emoji: string }> = {
  [Outcome.Excellent]: { title: 'Diagnosi eccellente', emoji: '🏆' },
  [Outcome.Correct]: { title: 'Diagnosi corretta', emoji: '✅' },
  [Outcome.CorrectIncomplete]: { title: 'Corretta, ma non giustificata', emoji: '⚠️' },
  [Outcome.Wrong]: { title: 'Diagnosi errata', emoji: '❌' },
};

export const TECH_ERROR_LABEL: Record<TechniqueError, string> = {
  [TechniqueError.MissedVein]: 'Vena mancata',
  [TechniqueError.TransfixedVein]: 'Vena trapassata (ago troppo inclinato)',
  [TechniqueError.NeedleTooFlat]: 'Ago troppo parallelo alla cute',
  [TechniqueError.VeinCollapsed]: 'Vena collassata (aspirazione troppo forte)',
  [TechniqueError.NoDisinfection]: 'Cute non disinfettata',
  [TechniqueError.Hematoma]: 'Ematoma (laccio rimosso dopo l’ago)',
  [TechniqueError.InterruptedReading]: 'Lettura termometro interrotta',
  [TechniqueError.NoLubricant]: 'Termometro inserito senza lubrificante',
};

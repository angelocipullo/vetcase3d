import { CaseId, ClinicalCase, Diagnosis, Exam, HeartSound, LabParam, LungSound } from './types';

export const CASES: Record<CaseId, ClinicalCase> = {
  [CaseId.Parvo]: {
    id: CaseId.Parvo,
    title: 'Cucciolo abbattuto con diarrea',
    difficulty: 1,
    patient: { name: 'Luna', breed: 'Meticcio', age: '4 mesi', weightKg: 6, sex: 'F' },
    anamnesis: [
      'Adottata da un canile 10 giorni fa',
      'Protocollo vaccinale non completato',
      'Vomito da 2 giorni, diarrea con sangue',
      'Molto abbattuta, non mangia',
    ],
    vitals: { heartRate: 190, heartSound: HeartSound.Tachycardia, respRate: 32, lungSound: LungSound.Normal, temperature: 40.2 },
    blood: { [LabParam.HCT]: 52, [LabParam.WBC]: 1.8, [LabParam.NEUT]: 0.9, [LabParam.PLT]: 230, [LabParam.TP]: 4.6 },
    correctDiagnosis: Diagnosis.Parvovirus,
    requiredExams: [Exam.Temperature, Exam.BloodSample],
    explanation:
      'Cucciolo non vaccinato con diarrea emorragica, febbre e una leucopenia marcata (neutropenia): è il quadro tipico della parvovirosi. Una gastroenterite aspecifica non dà leucopenia così severa. Le proteine basse sono dovute alla perdita intestinale.',
    coat: { base: '#e9b77b', belly: '#fff3e2', ears: '#a8693a' },
  },
  [CaseId.Bronchopneumonia]: {
    id: CaseId.Bronchopneumonia,
    title: 'Tosse dopo la pensione',
    difficulty: 2,
    patient: { name: 'Rocky', breed: 'Labrador', age: '3 anni', weightKg: 31, sex: 'M' },
    anamnesis: [
      'Rientrato da una pensione per cani 1 settimana fa',
      'Tosse produttiva da 5 giorni, peggiorata',
      'Inappetente e poco reattivo',
    ],
    vitals: { heartRate: 128, heartSound: HeartSound.Normal, respRate: 44, lungSound: LungSound.Crackles, temperature: 40.1 },
    blood: { [LabParam.HCT]: 45, [LabParam.WBC]: 26.4, [LabParam.NEUT]: 22.1, [LabParam.PLT]: 310, [LabParam.TP]: 7.2 },
    correctDiagnosis: Diagnosis.Bronchopneumonia,
    requiredExams: [Exam.LungAuscultation, Exam.Temperature],
    explanation:
      'La tosse dei canili non complicata di solito non dà febbre alta né crepitii. Qui ci sono febbre, tachipnea, crepitii all’auscultazione e una leucocitosi neutrofilica: l’infezione è scesa alle basse vie respiratorie.',
    coat: { base: '#f2d488', belly: '#fff6dc', ears: '#d9b35c' },
  },
  [CaseId.Mitral]: {
    id: CaseId.Mitral,
    title: 'Tosse notturna in un cane anziano',
    difficulty: 2,
    patient: { name: 'Bella', breed: 'Cavalier King Charles', age: '9 anni', weightKg: 8, sex: 'F' },
    anamnesis: [
      'Tosse soprattutto di notte',
      'Si stanca presto in passeggiata',
      'Respira veloce anche mentre dorme',
    ],
    vitals: { heartRate: 150, heartSound: HeartSound.Murmur, respRate: 46, lungSound: LungSound.Crackles, temperature: 38.6 },
    blood: { [LabParam.HCT]: 44, [LabParam.WBC]: 10.2, [LabParam.NEUT]: 7.0, [LabParam.PLT]: 280, [LabParam.TP]: 6.6 },
    correctDiagnosis: Diagnosis.MitralValveDisease,
    requiredExams: [Exam.HeartAuscultation, Exam.LungAuscultation, Exam.Temperature],
    explanation:
      'Razza predisposta, soffio sistolico a sinistra, tachipnea e crepitii da edema polmonare con temperatura normale: insufficienza cardiaca congestizia da endocardiosi mitralica. La temperatura normale serve a escludere una polmonite.',
    coat: { base: '#ffffff', belly: '#ffffff', ears: '#b5562b' },
  },
  [CaseId.Babesiosis]: {
    id: CaseId.Babesiosis,
    title: 'Cane da campagna debole e febbrile',
    difficulty: 3,
    patient: { name: 'Max', breed: 'Pastore Tedesco', age: '5 anni', weightKg: 34, sex: 'M' },
    anamnesis: [
      'Vive in giardino in campagna (Caserta)',
      'Trovate zecche la settimana scorsa',
      'Urine scure, mucose pallide',
      'Debolezza improvvisa',
    ],
    vitals: { heartRate: 150, heartSound: HeartSound.Tachycardia, respRate: 34, lungSound: LungSound.Normal, temperature: 40.6 },
    blood: { [LabParam.HCT]: 21, [LabParam.WBC]: 9.4, [LabParam.NEUT]: 6.8, [LabParam.PLT]: 42, [LabParam.TP]: 6.4 },
    correctDiagnosis: Diagnosis.Babesiosis,
    requiredExams: [Exam.Temperature, Exam.BloodSample],
    explanation:
      'Esposizione a zecche, febbre alta, anemia marcata con urine scure (emolisi) e trombocitopenia grave: babesiosi acuta. La leishmaniosi ha un decorso più cronico e tipicamente proteine totali aumentate.',
    coat: { base: '#5a3b22', belly: '#c58b4e', ears: '#2e1d10' },
  },
  [CaseId.Healthy]: {
    id: CaseId.Healthy,
    title: 'Visita pre-vaccinale',
    difficulty: 1,
    patient: { name: 'Nino', breed: 'Jack Russell', age: '2 anni', weightKg: 7, sex: 'M' },
    anamnesis: [
      'Richiamo vaccinale annuale',
      'Mangia e gioca regolarmente',
      'Nessun sintomo riferito',
    ],
    vitals: { heartRate: 100, heartSound: HeartSound.Normal, respRate: 22, lungSound: LungSound.Normal, temperature: 38.7 },
    blood: { [LabParam.HCT]: 47, [LabParam.WBC]: 9.8, [LabParam.NEUT]: 6.1, [LabParam.PLT]: 290, [LabParam.TP]: 6.5 },
    correctDiagnosis: Diagnosis.Healthy,
    requiredExams: [Exam.HeartAuscultation, Exam.LungAuscultation, Exam.Temperature],
    explanation:
      'Visita clinica completa nella norma: cuore e polmoni normali, temperatura fisiologica. Il paziente è idoneo alla vaccinazione. Saper riconoscere il "normale" è importante quanto la patologia.',
    coat: { base: '#ffffff', belly: '#ffffff', ears: '#7a4a24' },
  },
};

export const CASE_LIST = Object.values(CASES);

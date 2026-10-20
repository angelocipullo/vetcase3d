import { ClinicalCase, Diagnosis, Exam, HeartSound, LungSound, Outcome, TechniqueError } from './types';

export interface ExamRecord {
  heart: { listenedMs: number; answer?: HeartSound };
  lungs: { listenedMs: number; answer?: LungSound };
  temperature?: number;
  blood: { success: boolean; resultsReady: boolean };
  errors: TechniqueError[];
}

export const LISTEN_REQUIRED_MS = 3000;

export function examsDone(r: ExamRecord): Set<Exam> {
  const s = new Set<Exam>();
  if (r.heart.answer) s.add(Exam.HeartAuscultation);
  if (r.lungs.answer) s.add(Exam.LungAuscultation);
  if (r.temperature !== undefined) s.add(Exam.Temperature);
  if (r.blood.success) s.add(Exam.BloodSample);
  return s;
}

export interface Evaluation {
  outcome: Outcome;
  score: number;
  diagnosisCorrect: boolean;
  missingExams: Exam[];
  interpretation: { heart?: boolean; lungs?: boolean };
  breakdown: { label: string; points: number; max: number }[];
}

export function evaluate(c: ClinicalCase, r: ExamRecord, dx: Diagnosis): Evaluation {
  const done = examsDone(r);
  const diagnosisCorrect = dx === c.correctDiagnosis;
  const missingExams = c.requiredExams.filter((e) => !done.has(e));

  const dxPts = diagnosisCorrect ? 50 : 0;
  const reqPts = Math.round((25 * (c.requiredExams.length - missingExams.length)) / c.requiredExams.length);

  const interpretation: Evaluation['interpretation'] = {};
  let interpTotal = 0;
  let interpOk = 0;
  if (r.heart.answer) {
    interpTotal++;
    interpretation.heart = r.heart.answer === c.vitals.heartSound;
    if (interpretation.heart) interpOk++;
  }
  if (r.lungs.answer) {
    interpTotal++;
    interpretation.lungs = r.lungs.answer === c.vitals.lungSound;
    if (interpretation.lungs) interpOk++;
  }
  const interpPts = interpTotal === 0 ? 0 : Math.round((15 * interpOk) / interpTotal);

  const techPts = Math.max(0, 10 - r.errors.length * 3);

  const score = dxPts + reqPts + interpPts + techPts;

  let outcome: Outcome;
  if (!diagnosisCorrect) outcome = Outcome.Wrong;
  else if (missingExams.length > 0) outcome = Outcome.CorrectIncomplete;
  else if (score >= 88) outcome = Outcome.Excellent;
  else outcome = Outcome.Correct;

  return {
    outcome,
    score,
    diagnosisCorrect,
    missingExams,
    interpretation,
    breakdown: [
      { label: 'Diagnosi', points: dxPts, max: 50 },
      { label: 'Esami richiesti', points: reqPts, max: 25 },
      { label: 'Interpretazione auscultazione', points: interpPts, max: 15 },
      { label: 'Tecnica', points: techPts, max: 10 },
    ],
  };
}

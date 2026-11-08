import { ScoreEntry } from './store';
import { ScoreCat } from './types';

export const CAT_LABEL: Record<ScoreCat, string> = {
  ragionamento: 'Ragionamento clinico',
  anamnesi: 'Anamnesi',
  clinica: 'Esame clinico (scheda PS)',
  esami: 'Appropriatezza degli esami',
  terapia: 'Terapia e sicurezza',
  monitoraggio: 'Monitoraggio in terapia intensiva',
};

export interface CatSummary {
  cat: ScoreCat;
  pts: number;
  max: number;
  entries: ScoreEntry[];
}

export function summarize(score: ScoreEntry[]) {
  const cats = Object.keys(CAT_LABEL) as ScoreCat[];
  const byCat: CatSummary[] = cats.map((cat) => {
    const entries = score.filter((s) => s.cat === cat);
    const max = entries.reduce((a, e) => a + e.max, 0);
    const pts = Math.max(0, entries.reduce((a, e) => a + e.pts, 0));
    return { cat, pts: Math.min(pts, max), max, entries };
  });
  const max = byCat.reduce((a, c) => a + c.max, 0);
  const pts = byCat.reduce((a, c) => a + c.pts, 0);
  const pct = max ? Math.round((pts / max) * 100) : 0;
  const grade = pct >= 85 ? 'Primario' : pct >= 70 ? 'Medico strutturato' : pct >= 50 ? 'Specializzando' : 'Tirocinante';
  return { byCat: byCat.filter((c) => c.max > 0 || c.entries.length), pts, max, pct, grade };
}

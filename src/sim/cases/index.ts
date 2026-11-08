import { EXAMS } from '../exams';
import { SimCase } from '../types';
import { MICHELE } from './michele';
import { BIRILLO } from './birillo';

/** Registro dei casi del simulatore. Per aggiungerne uno: crea il file e aggiungilo qui. */
export const SIM_CASES: SimCase[] = [MICHELE, BIRILLO];

/**
 * Controlli di coerenza di un caso (pensati anche per casi generati automaticamente):
 * restituisce l'elenco dei problemi, vuoto se il caso è valido.
 */
export function validateCase(c: SimCase): string[] {
  const issues: string[] = [];
  const ids = new Set<string>();
  for (const s of c.stages) {
    if (ids.has(s.id)) issues.push(`id di fase duplicato: ${s.id}`);
    ids.add(s.id);
    if (s.kind === 'quiz' && Array.isArray(s.options)) {
      if (s.options.length < 2) issues.push(`${s.id}: servono almeno 2 opzioni`);
      if (!s.options.some((o) => o.score === 1)) issues.push(`${s.id}: nessuna opzione con score 1`);
    }
    if (s.kind === 'orders') {
      for (const g of s.groups) for (const e of g.exams) if (!EXAMS[e]) issues.push(`${s.id}: esame sconosciuto ${e}`);
    }
    if (s.kind === 'interview' && !s.questions.some((q) => q.weight === 'key')) issues.push(`${s.id}: nessuna domanda chiave`);
    if (s.kind === 'ct' && !c.ct) issues.push(`${s.id}: fase TC senza ct.lesion`);
  }
  if (!c.diagnosisOptions.some((o) => o.score === 1)) issues.push('diagnosi finale senza opzione corretta (score 1)');
  if (c.stages[c.stages.length - 1]?.kind !== 'debrief') issues.push('l’ultima fase deve essere il debriefing');
  return issues;
}

if (import.meta.env.DEV) {
  for (const c of SIM_CASES) {
    const issues = validateCase(c);
    if (issues.length) console.warn(`[sim] caso ${c.id}:`, issues);
  }
}

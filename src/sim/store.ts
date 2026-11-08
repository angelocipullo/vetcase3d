import { create } from 'zustand';
import { EXAMS, FLUID_LABEL, DRUGS } from './exams';
import { K_MAX_SAFE, kInfusionRate, tick } from './physiology';
import {
  DrugId,
  Effect,
  ExamId,
  Finding,
  Fluids,
  Phys,
  ResultDoc,
  ScoreCat,
  SimCase,
  SimCtx,
  Stage,
  Therapy,
  VitalId,
} from './types';

export interface ScoreEntry {
  cat: ScoreCat;
  pts: number;
  max: number;
  note: string;
}

export interface LogEntry {
  t: number;
  kind: 'azione' | 'esito' | 'evento' | 'decisione' | 'terapia';
  text: string;
}

export interface HistPoint {
  t: number;
  k: number;
  sbp: number;
  ph: number;
}

export interface SimModal {
  title: string;
  body: string;
  tone: 'danger' | 'warn' | 'info';
}

const STEP_MIN = 5;

interface SimState {
  caseDef: SimCase | null;
  stageIdx: number;
  /** Orologio simulato al momento dell'ingresso nella fase corrente. */
  stageStart: number;
  /** Minuti trascorsi dall'arrivo in PS. */
  clock: number;
  phys: Phys;
  therapy: Therapy;
  history: HistPoint[];
  log: LogEntry[];
  results: ResultDoc[];
  findings: Partial<Record<VitalId, Finding>>;
  asked: string[];
  score: ScoreEntry[];
  spent: number;
  flags: Record<string, boolean>;
  modal: SimModal | null;
  /** Fasi già concluse (id) → per non assegnare due volte il punteggio. */
  done: Record<string, boolean>;
  /** Diagnosi finale scelta nel debriefing (id dell'opzione). */
  finalDx: string | null;

  start: (c: SimCase) => void;
  stage: () => Stage | null;
  ctx: () => SimCtx;
  next: () => void;
  advance: (min: number) => void;
  addLog: (kind: LogEntry['kind'], text: string) => void;
  addScore: (cat: ScoreCat, pts: number, max: number, note: string) => void;
  markDone: (id: string) => boolean;
  applyEffects: (effects: Effect[] | undefined) => void;
  orderExams: (ids: ExamId[]) => ResultDoc[];
  addResult: (exam: ExamId, force?: boolean) => ResultDoc;
  waitForResults: (maxMin?: number) => void;
  setFluids: (f: Fluids) => boolean;
  setDrug: (d: DrugId, on: boolean) => void;
  recordFinding: (v: VitalId, f: Omit<Finding, 't'>) => void;
  ask: (qid: string, minutes?: number) => void;
  setFlag: (f: string) => void;
  showModal: (m: SimModal) => void;
  closeModal: () => void;
  chooseFinalDx: (id: string) => void;
}

const EMPTY_PHYS: Phys = {
  k: 4, na: 150, cl: 118, hco3: 22, pco2: 38, ph: 7.38, glu: 100, lact: 1, sbp: 130, hr: 180, rr: 24, temp: 38.5, vomiting: false,
};

let resultSeq = 0;

export const useSim = create<SimState>((set, get) => ({
  caseDef: null,
  stageIdx: 0,
  stageStart: 0,
  clock: 0,
  phys: EMPTY_PHYS,
  therapy: { fluids: { fluid: 'none', rateMlH: 0, kclMeqL: 0 }, drugs: {} },
  history: [],
  log: [],
  results: [],
  findings: {},
  asked: [],
  score: [],
  spent: 0,
  flags: {},
  modal: null,
  done: {},
  finalDx: null,

  start: (c) => {
    set({
      caseDef: c,
      stageIdx: 0,
      stageStart: 0,
      clock: 0,
      phys: { ...c.initialPhys },
      therapy: { fluids: { fluid: 'none', rateMlH: 0, kclMeqL: 0 }, drugs: {} },
      history: [{ t: 0, k: c.initialPhys.k, sbp: c.initialPhys.sbp, ph: c.initialPhys.ph }],
      log: [{ t: 0, kind: 'evento', text: `Arrivo in PS: ${c.complaint}` }],
      results: [],
      findings: {},
      asked: [],
      score: [],
      spent: 0,
      flags: {},
      modal: null,
      done: {},
  finalDx: null,
    });
  },

  stage: () => {
    const { caseDef, stageIdx } = get();
    return caseDef?.stages[stageIdx] ?? null;
  },

  ctx: () => {
    const s = get();
    const ready = s.results.filter((r) => r.readyAt <= s.clock && !r.refused);
    return {
      clock: s.clock,
      phys: s.phys,
      therapy: s.therapy,
      results: s.results,
      flags: s.flags,
      findings: s.findings,
      lastValue: (exam, label) => {
        for (let i = ready.length - 1; i >= 0; i--) {
          const r = ready[i];
          if (r.exam !== exam) continue;
          const row = r.rows?.find((x) => x.label === label);
          if (row && typeof row.value === 'number') return row.value;
        }
        return undefined;
      },
      hasResult: (exam) => ready.some((r) => r.exam === exam),
    };
  },

  next: () => {
    const { caseDef, stageIdx } = get();
    if (!caseDef || stageIdx >= caseDef.stages.length - 1) return;
    const nextStage = caseDef.stages[stageIdx + 1];
    if (nextStage.skipMin) get().advance(nextStage.skipMin);
    set({ stageIdx: stageIdx + 1, stageStart: get().clock });
  },

  advance: (min) => {
    const s = get();
    if (!s.caseDef || min <= 0) return;
    let { phys, clock } = s;
    const history = [...s.history];
    const d = s.caseDef.disease;
    const flags = { ...s.flags };
    let modal: SimModal | null = null;
    const penalties: ScoreEntry[] = [];
    const logs: LogEntry[] = [];
    let therapy = s.therapy;
    for (let left = min; left > 0; left -= STEP_MIN) {
      const dt = Math.min(STEP_MIN, left);
      phys = tick(phys, therapy, d, clock, dt);
      clock += dt;
      if (clock - history[history.length - 1].t >= 30) history.push({ t: clock, k: phys.k, sbp: phys.sbp, ph: phys.ph });

      // eventi critici: il "collega" interviene, il paziente sopravvive ma il punteggio ne risente
      if (phys.k < 1.5 && !flags.critLowK) {
        flags.critLowK = true;
        modal = {
          tone: 'danger',
          title: 'Insufficienza respiratoria da ipokaliemia',
          body: `${s.caseDef.patient.name} ha un respiro superficiale e cianosi: la miopatia ipokaliemica coinvolge i muscoli respiratori. Il collega di turno dà ossigeno e porta l'infusione di KCl a 0,5 mEq/kg/h. L'ipokaliemia grave non trattata è pericolosa per la vita.`,
        };
        penalties.push({ cat: 'monitoraggio', pts: -15, max: 0, note: 'K⁺ < 1,5 mEq/L: crisi respiratoria' });
        logs.push({ t: clock, kind: 'evento', text: 'CRISI: insufficienza respiratoria da ipokaliemia grave' });
        const rate = Math.round((K_MAX_SAFE * d.kg * 1000) / 80);
        therapy = { ...therapy, fluids: { fluid: 'rl', rateMlH: rate, kclMeqL: 80 } };
        phys = { ...phys, k: 1.6 };
      }
      if (phys.k > 6 && !flags.critHighK) {
        flags.critHighK = true;
        modal = {
          tone: 'danger',
          title: 'Iperkaliemia iatrogena',
          body: `Il monitor mostra bradicardia e onde T alte e appuntite. Il K⁺ è salito oltre 6 mEq/L: l'integrazione non è stata ridotta mentre lo spironolattone tratteneva potassio. Il collega sospende il KCl.`,
        };
        penalties.push({ cat: 'monitoraggio', pts: -15, max: 0, note: 'K⁺ > 6 mEq/L: iperkaliemia iatrogena' });
        logs.push({ t: clock, kind: 'evento', text: 'CRISI: iperkaliemia iatrogena, KCl sospeso' });
        therapy = { ...therapy, fluids: { ...therapy.fluids, kclMeqL: 0 }, drugs: { ...therapy.drugs, kclOrale: undefined } };
      }
    }
    const newlyReady = s.results.filter((r) => r.readyAt > s.clock && r.readyAt <= clock && !r.refused);
    newlyReady.forEach((r) => logs.push({ t: r.readyAt, kind: 'esito', text: `Referto disponibile: ${r.title}` }));
    set({
      phys,
      clock,
      history,
      flags,
      therapy,
      modal: modal ?? s.modal,
      score: [...s.score, ...penalties],
      log: [...s.log, ...logs],
    });
  },

  addLog: (kind, text) => set((s) => ({ log: [...s.log, { t: s.clock, kind, text }] })),
  addScore: (cat, pts, max, note) => set((s) => ({ score: [...s.score, { cat, pts, max, note }] })),
  markDone: (id) => {
    if (get().done[id]) return false;
    set((s) => ({ done: { ...s.done, [id]: true } }));
    return true;
  },

  applyEffects: (effects) => {
    if (!effects) return;
    for (const e of effects) {
      const s = get();
      switch (e.kind) {
        case 'drug':
          s.setDrug(e.drug, e.on ?? true);
          break;
        case 'fluids':
          set({ therapy: { ...s.therapy, fluids: { ...s.therapy.fluids, ...e.fluids } } });
          break;
        case 'time':
          s.advance(e.min);
          break;
        case 'flag':
          s.setFlag(e.flag);
          break;
        case 'safety':
          s.addScore('terapia', -e.penalty, 0, e.title);
          s.addLog('evento', e.title);
          s.showModal({ tone: 'danger', title: e.title, body: e.body });
          break;
      }
    }
  },

  addResult: (exam, force = false) => {
    const s = get();
    const c = s.caseDef!;
    const meta = EXAMS[exam];
    const ctx = s.ctx();
    const refused = force ? null : c.refuse?.[exam]?.(ctx) ?? null;
    const gen = c.results[exam];
    const base = gen
      ? gen(ctx)
      : { title: meta.label, source: 'generato' as const, text: 'Nessun reperto di rilievo.', conclusion: 'Nella norma.' };
    const doc: ResultDoc = {
      ...base,
      id: `r${++resultSeq}`,
      exam,
      orderedAt: s.clock,
      readyAt: s.clock + meta.turnaroundMin,
      refused: refused ?? undefined,
    };
    set({
      results: [...s.results, doc],
      spent: s.spent + (refused ? 0 : meta.cost),
      log: [
        ...s.log,
        { t: s.clock, kind: 'azione', text: refused ? `${meta.short}: non eseguito — ${refused}` : `Richiesto: ${meta.label}` },
      ],
    });
    return doc;
  },

  orderExams: (ids) => {
    const docs = ids.map((id) => get().addResult(id));
    const work = docs.filter((d) => !d.refused).reduce((a, d) => a + EXAMS[d.exam].workMin, 0);
    get().advance(Math.max(5, work));
    return docs;
  },

  /** Attende i referti in sede (non quelli dei laboratori esterni oltre `maxMin`). */
  waitForResults: (maxMin = 180) => {
    const s = get();
    const pending = s.results.filter((r) => !r.refused && r.readyAt > s.clock && r.readyAt - s.clock <= maxMin);
    if (pending.length === 0) return;
    const until = Math.max(...pending.map((r) => r.readyAt));
    s.advance(until - s.clock);
  },

  setFluids: (f) => {
    const s = get();
    const kg = s.caseDef!.disease.kg;
    const th: Therapy = { ...s.therapy, fluids: f };
    const rate = kInfusionRate(th, kg);
    if (rate > K_MAX_SAFE + 1e-6) {
      const safeRate = Math.floor((K_MAX_SAFE * kg * 1000) / Math.max(1, f.kclMeqL + (f.fluid === 'rl' ? 4 : 0)));
      set({ therapy: { ...th, fluids: { ...f, rateMlH: safeRate } } });
      s.addScore('terapia', -10, 0, `Infusione di K⁺ a ${rate.toFixed(2)} mEq/kg/h (> 0,5)`);
      s.addLog('evento', `Aritmia ventricolare durante infusione rapida di KCl (${rate.toFixed(2)} mEq/kg/h). Velocità ridotta a ${safeRate} ml/h.`);
      s.showModal({
        tone: 'danger',
        title: 'Aritmia ventricolare!',
        body: `Hai impostato ${rate.toFixed(2)} mEq/kg/h di potassio: il limite di sicurezza è 0,5 mEq/kg/h. Il cuore risente subito delle concentrazioni locali elevate: compaiono complessi ventricolari prematuri. L'infermiere riduce la pompa a ${safeRate} ml/h.`,
      });
      return false;
    }
    set({ therapy: th });
    s.addLog(
      'terapia',
      f.fluid === 'none' || f.rateMlH === 0
        ? 'Fluidoterapia sospesa'
        : `Pompa: ${FLUID_LABEL[f.fluid]} ${f.rateMlH} ml/h, KCl ${f.kclMeqL} mEq/L (${rate.toFixed(2)} mEq/kg/h)`,
    );
    return true;
  },

  setDrug: (d, on) => {
    const s = get();
    const active = s.therapy.drugs[d] !== undefined;
    if (on === active) return;
    const drugs = { ...s.therapy.drugs, [d]: on ? s.clock : undefined };
    set({ therapy: { ...s.therapy, drugs } });
    s.addLog('terapia', `${on ? 'Iniziato' : 'Sospeso'}: ${DRUGS[d].label} ${on ? DRUGS[d].dose : ''}`);
  },

  recordFinding: (v, f) => {
    set((s) => ({ findings: { ...s.findings, [v]: { ...f, t: s.clock } } }));
  },

  ask: (qid, minutes = 1) => {
    set((s) => ({ asked: [...s.asked, qid] }));
    get().advance(minutes);
  },

  setFlag: (f) => set((s) => ({ flags: { ...s.flags, [f]: true } })),
  showModal: (m) => set({ modal: m }),
  closeModal: () => set({ modal: null }),
  chooseFinalDx: (id) => {
    const s = get();
    const c = s.caseDef;
    if (!c || s.finalDx) return;
    const o = c.diagnosisOptions.find((x) => x.id === id);
    if (!o) return;
    set({ finalDx: id });
    s.addScore('ragionamento', Math.round(c.diagnosisPoints * o.score), c.diagnosisPoints, 'Diagnosi finale');
    s.addLog('decisione', `Diagnosi finale: ${o.text}`);
  },
}));

/** Risolve un valore dinamico del caso. */
export function dyn<T>(v: T | ((ctx: SimCtx) => T), ctx: SimCtx): T {
  return typeof v === 'function' ? (v as (c: SimCtx) => T)(ctx) : v;
}

export function useSimCtx(): SimCtx {
  // dipende da tutte le parti dello stato che finiscono nel ctx
  useSim((s) => s.clock);
  useSim((s) => s.results);
  useSim((s) => s.flags);
  useSim((s) => s.therapy);
  useSim((s) => s.findings);
  return useSim.getState().ctx();
}

/** Formatta l'orologio simulato come "16/06 15:58". */
export function fmtClock(c: SimCase, min: number) {
  const d = new Date(new Date(c.arrival).getTime() + min * 60000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function fmtElapsed(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}'` : `${m}'`;
}

// in sviluppo lo store è ispezionabile dalla console (window.__sim.getState())
if (import.meta.env.DEV) (window as unknown as { __sim: typeof useSim }).__sim = useSim;

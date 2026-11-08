import { create } from 'zustand';
import { audio } from './audio/engine';
import { CASES } from './game/cases';
import { ExamRecord, LISTEN_REQUIRED_MS } from './game/evaluation';
import { CASE_LIST } from './game/cases';
import { CaseId, Diagnosis, HeartSound, LungSound, Patient, SyringePhase, TechniqueError, Tool } from './game/types';
import type { CameraView } from './three/anatomy';
import { SIM_CASES } from './sim/cases';
import { useSim } from './sim/store';

export interface SyringeState {
  phase: SyringePhase;
  tourniquet: boolean;
  disinfected: boolean;
  angle: number;
  fill: number;
  pressure: number;
  insertPoint?: [number, number, number];
}

type Sheet = 'record' | 'diagnosis' | null;
type Screen = 'title' | 'exam' | 'result' | 'sim';

interface GameState {
  screen: Screen;
  caseId: CaseId;
  /** Paziente della partita: segnalamento del caso, nome sorteggiato. */
  patient: Patient;
  /** Scheda di accettazione mostrata all'arrivo del paziente. */
  intro: boolean;
  /** Shader della scena compilati: finché è false il Canvas non disegna (vedi ShaderWarmup). */
  sceneReady: boolean;
  /** Audio disattivato dall'utente (preferenza salvata). */
  muted: boolean;
  tool: Tool;
  stress: number;
  happyUntil: number;
  guided: boolean;
  exams: ExamRecord;
  syringe: SyringeState;
  /** Termometro: active = posizionato sotto la coda; lubed = punta lubrificata; inserted = dentro. */
  thermo: { active: boolean; progress: number; inserted: boolean; lubed: boolean };
  prompt: 'heart' | 'lungs' | null;
  toast: { text: string; id: number } | null;
  sheet: Sheet;
  diagnosis?: Diagnosis;

  /** Nuova partita: diagnosi (caso) e nome del paziente casuali. */
  startRandom: () => void;
  /** Simulatore clinico a fasi (caso per id, default il primo). */
  startSim: (caseId?: string) => void;
  /** Rigioca lo stesso caso con lo stesso paziente. */
  startCase: (id: CaseId) => void;
  closeIntro: () => void;
  setSceneReady: () => void;
  toggleMute: () => void;
  toMenu: () => void;
  setTool: (t: Tool) => void;
  setGuided: (g: boolean) => void;
  addStress: (n: number) => void;
  pet: () => void;
  showToast: (text: string) => void;
  setSheet: (s: Sheet) => void;
  addListen: (which: 'heart' | 'lungs', ms: number) => void;
  checkListenPrompt: () => void;
  answerPrompt: (answer: HeartSound | LungSound) => void;
  closePrompt: () => void;
  setTemperature: (t: number) => void;
  addError: (e: TechniqueError) => void;
  patchSyringe: (p: Partial<SyringeState>) => void;
  patchThermo: (p: Partial<GameState['thermo']>) => void;
  completeBlood: () => void;
  submitDiagnosis: (d: Diagnosis) => void;
}

const freshExams = (): ExamRecord => ({
  heart: { listenedMs: 0 },
  lungs: { listenedMs: 0 },
  blood: { success: false, resultsReady: false },
  errors: [],
});

const freshSyringe = (): SyringeState => ({
  phase: SyringePhase.Prepare,
  tourniquet: false,
  disinfected: false,
  angle: 25,
  fill: 0,
  pressure: 0,
});

let toastId = 0;

/** Nomi sorteggiabili: il sesso resta quello del caso (anamnesi e aggettivi sono declinati). */
const NAMES: Record<Patient['sex'], string[]> = {
  F: ['Luna', 'Bella', 'Kira', 'Nala', 'Maya', 'Lilly', 'Zoe', 'Penny', 'Molly', 'Stella', 'Gaia', 'Mia'],
  M: ['Rocky', 'Max', 'Leo', 'Thor', 'Nino', 'Bruno', 'Felix', 'Rex', 'Charlie', 'Ugo', 'Otto', 'Zeus'],
};

const pick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

const freshVisit = () => ({
  screen: 'exam' as const,
  intro: true,
  tool: Tool.Hand,
  stress: 20,
  exams: freshExams(),
  syringe: freshSyringe(),
  thermo: { active: false, progress: 0, inserted: false, lubed: false },
  prompt: null,
  sheet: null,
  diagnosis: undefined,
});

export const useGame = create<GameState>((set, get) => ({
  screen: 'title',
  caseId: CaseId.Parvo,
  patient: CASES[CaseId.Parvo].patient,
  intro: false,
  sceneReady: false,
  muted: audio.isMuted(),
  tool: Tool.Hand,
  stress: 20,
  happyUntil: 0,
  guided: false,
  exams: freshExams(),
  syringe: freshSyringe(),
  thermo: { active: false, progress: 0, inserted: false, lubed: false },
  prompt: null,
  toast: null,
  sheet: null,

  startRandom: () => {
    const last = get().screen === 'title' ? undefined : get().caseId;
    const c = pick(CASE_LIST.filter((x) => x.id !== last));
    // caso diverso dal precedente → il Canvas (key=caseId) viene ricreato e va ricompilato
    set({ ...freshVisit(), sceneReady: false, caseId: c.id, patient: { ...c.patient, name: pick(NAMES[c.patient.sex]) } });
  },
  startSim: (caseId) => {
    const c = SIM_CASES.find((x) => x.id === caseId) ?? SIM_CASES[0];
    useSim.getState().start(c);
    set({ screen: 'sim', sheet: null, intro: false });
  },
  startCase: (id) => {
    const same = id === get().caseId;
    set({
      ...freshVisit(),
      sceneReady: same && get().screen !== 'title' && get().sceneReady,
      caseId: id,
      patient: same ? get().patient : CASES[id].patient,
    });
  },
  closeIntro: () => set({ intro: false }),
  setSceneReady: () => set({ sceneReady: true }),
  toggleMute: () => {
    const muted = !get().muted;
    audio.setMuted(muted);
    set({ muted });
  },
  toMenu: () => set({ screen: 'title', sheet: null, intro: false, sceneReady: false }),

  setTool: (t) => {
    const s = get();
    if (t === Tool.Syringe) {
      if (s.exams.blood.success) {
        s.showToast('Prelievo già eseguito: guarda la cartella clinica');
        return;
      }
      if (s.stress > 80) {
        s.showToast(`${s.patient.name} è troppo agitato. Prima qualche coccola!`);
        return;
      }
      set({ tool: t, syringe: freshSyringe(), thermo: { ...s.thermo, active: false } });
      return;
    }
    set({ tool: t, thermo: { active: false, progress: 0, inserted: false, lubed: false } });
  },
  setGuided: (g) => set({ guided: g }),
  addStress: (n) => set((s) => ({ stress: Math.max(0, Math.min(100, s.stress + n)) })),
  pet: () => {
    get().addStress(-12);
    set({ happyUntil: performance.now() + 2500 });
  },
  showToast: (text) => set({ toast: { text, id: ++toastId } }),
  setSheet: (sheet) => set({ sheet }),

  addListen: (which, ms) =>
    set((s) => ({
      exams: { ...s.exams, [which]: { ...s.exams[which], listenedMs: s.exams[which].listenedMs + ms } },
    })),
  checkListenPrompt: () => {
    const { exams, prompt } = get();
    if (prompt) return;
    if (!exams.heart.answer && exams.heart.listenedMs >= LISTEN_REQUIRED_MS) set({ prompt: 'heart' });
    else if (!exams.lungs.answer && exams.lungs.listenedMs >= LISTEN_REQUIRED_MS) set({ prompt: 'lungs' });
  },
  answerPrompt: (answer) => {
    const { prompt, exams } = get();
    if (prompt === 'heart') set({ exams: { ...exams, heart: { ...exams.heart, answer: answer as HeartSound } } });
    if (prompt === 'lungs') set({ exams: { ...exams, lungs: { ...exams.lungs, answer: answer as LungSound } } });
    set({ prompt: null });
    setTimeout(() => get().checkListenPrompt(), 300);
  },
  closePrompt: () => set({ prompt: null }),
  setTemperature: (t) => set((s) => ({ exams: { ...s.exams, temperature: t } })),
  addError: (e) => set((s) => ({ exams: { ...s.exams, errors: [...s.exams.errors, e] } })),
  patchSyringe: (p) => set((s) => ({ syringe: { ...s.syringe, ...p } })),
  patchThermo: (p) => set((s) => ({ thermo: { ...s.thermo, ...p } })),
  completeBlood: () => {
    set((s) => ({ exams: { ...s.exams, blood: { success: true, resultsReady: false } } }));
    setTimeout(() => {
      set((s) => ({ exams: { ...s.exams, blood: { success: true, resultsReady: true } } }));
      get().showToast('🧪 Emocromo pronto: aprilo nella cartella clinica');
    }, 2500);
  },
  submitDiagnosis: (d) => set({ diagnosis: d, screen: 'result', sheet: null }),
}));

/** Vista camera derivata dallo stato. */
export function cameraViewFor(tool: Tool, thermoActive: boolean, syringePhase: SyringePhase): CameraView {
  if (tool === Tool.Syringe && syringePhase !== SyringePhase.Done) return 'syringe';
  if (tool === Tool.Thermometer && thermoActive) return 'thermometer';
  return 'default';
}

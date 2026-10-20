import { create } from 'zustand';
import { CASES } from './game/cases';
import { ExamRecord, LISTEN_REQUIRED_MS } from './game/evaluation';
import { CaseId, Diagnosis, HeartSound, LungSound, SyringePhase, TechniqueError, Tool } from './game/types';
import type { CameraView } from './three/anatomy';

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
type Screen = 'menu' | 'exam' | 'result';

interface GameState {
  screen: Screen;
  caseId: CaseId;
  tool: Tool;
  stress: number;
  happyUntil: number;
  guided: boolean;
  exams: ExamRecord;
  syringe: SyringeState;
  thermo: { active: boolean; progress: number; inserted: boolean };
  prompt: 'heart' | 'lungs' | null;
  toast: { text: string; id: number } | null;
  sheet: Sheet;
  diagnosis?: Diagnosis;

  startCase: (id: CaseId) => void;
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

export const useGame = create<GameState>((set, get) => ({
  screen: 'menu',
  caseId: CaseId.Parvo,
  tool: Tool.Hand,
  stress: 20,
  happyUntil: 0,
  guided: false,
  exams: freshExams(),
  syringe: freshSyringe(),
  thermo: { active: false, progress: 0, inserted: false },
  prompt: null,
  toast: null,
  sheet: null,

  startCase: (id) =>
    set({
      screen: 'exam',
      caseId: id,
      tool: Tool.Hand,
      stress: 20,
      exams: freshExams(),
      syringe: freshSyringe(),
      thermo: { active: false, progress: 0, inserted: false },
      prompt: null,
      sheet: null,
      diagnosis: undefined,
    }),
  toMenu: () => set({ screen: 'menu', sheet: null }),

  setTool: (t) => {
    const s = get();
    if (t === Tool.Syringe) {
      if (s.exams.blood.success) {
        s.showToast('Prelievo già eseguito: guarda la cartella clinica');
        return;
      }
      if (s.stress > 80) {
        s.showToast(`${CASES[s.caseId].patient.name} è troppo agitato. Prima qualche coccola!`);
        return;
      }
      set({ tool: t, syringe: freshSyringe(), thermo: { ...s.thermo, active: false } });
      return;
    }
    set({ tool: t, thermo: { active: false, progress: 0, inserted: false } });
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

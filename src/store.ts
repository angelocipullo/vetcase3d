import { create } from 'zustand';
import { audio } from './audio/engine';
import { SyringePhase, TechniqueError, Tool } from './game/types';
import { setSpecies, type CameraView } from './three/anatomy';
import { catModelAvailable } from './three/CatModel';
import { SIM_CASES } from './sim/cases';
import { useSim } from './sim/store';
import type { SimPatient, SpriteSpec, VitalId, VitalTruth } from './sim/types';

export interface SyringeState {
  phase: SyringePhase;
  /** Tricotomia: 0 = pelo intatto, 1 = zona rasata sopra la vena. */
  clip: number;
  tourniquet: boolean;
  disinfected: boolean;
  angle: number;
  fill: number;
  pressure: number;
  insertPoint?: [number, number, number];
}

type Screen = 'title' | 'sim';

/**
 * Visita nell'ambulatorio 3D, aperta da una fase del caso clinico:
 * - 'vitals': scheda di PS (temperatura, polso, respiro e auscultazione sul modello; il resto in finestra);
 * - 'prelievo': prelievo dalla vena cefalica prima degli esami del sangue.
 * I valori "veri" vengono dal caso; i risultati tornano al simulatore con le callback.
 */
export interface Visit {
  mode: 'vitals' | 'prelievo';
  patient: SimPatient;
  sprite: SpriteSpec;
  truth: VitalTruth;
  /** Parametri della scheda (obbligatori + facoltativi) e quali sono obbligatori. */
  vitals: VitalId[];
  required: VitalId[];
  /** Strumento con cui aprire la visita (es. il parametro cliccato nella scheda). */
  startTool?: Tool;
  /** Parametro da cui partire (distingue mucose e TRC, che usano lo stesso strumento). */
  startFocus?: VitalId;
  onRecord?: (v: VitalId, value: string, ok: boolean, note?: string) => void;
  onPrelievo?: (errors: TechniqueError[]) => void;
}

interface GameState {
  screen: Screen;
  /** Shader della scena compilati: finché è false il Canvas non disegna (vedi ShaderWarmup). */
  sceneReady: boolean;
  /** Audio disattivato dall'utente (preferenza salvata). */
  muted: boolean;
  visit: Visit | null;
  /** C'è il gatto glTF locale (public/models/cat.glb, non versionato)? */
  catGlb: boolean;
  tool: Tool;
  /** Lo strumento è stato appoggiato nel punto anatomico giusto (polso femorale). */
  placed: boolean;
  stress: number;
  happyUntil: number;
  guided: boolean;
  /** Termometro: active = posizionato sotto la coda; lubed = punta lubrificata; inserted = dentro. */
  syringe: SyringeState;
  thermo: { active: boolean; progress: number; inserted: boolean; lubed: boolean };
  /** Contatore dei battiti sentiti sotto le dita (anima le dita sul polso femorale). */
  pulseBeat: number;
  /** Errori tecnici della procedura in corso (prelievo, termometro). */
  errors: TechniqueError[];
  toast: { text: string; id: number } | null;
  /** Pergamena di laurea aperta a schermo intero (immagine PNG), o null. */
  diploma: string | null;

  /** Simulatore clinico a fasi (caso per id, default il primo). */
  startSim: (caseId?: string) => void;
  setSceneReady: () => void;
  toggleMute: () => void;
  toMenu: () => void;
  openVisit: (v: Visit) => void;
  closeVisit: () => void;
  setTool: (t: Tool) => void;
  setPlaced: (p: boolean) => void;
  setGuided: (g: boolean) => void;
  addStress: (n: number) => void;
  pet: () => void;
  showToast: (text: string) => void;
  setDiploma: (img: string | null) => void;
  addError: (e: TechniqueError) => void;
  patchSyringe: (p: Partial<SyringeState>) => void;
  patchThermo: (p: Partial<GameState['thermo']>) => void;
  /** Provetta pronta e cerotto messo: chiude la visita e restituisce gli errori al caso. */
  completeBlood: () => void;
  beatPulse: () => void;
}

const freshSyringe = (): SyringeState => ({
  phase: SyringePhase.Prepare,
  clip: 0,
  tourniquet: false,
  disinfected: false,
  angle: 25,
  fill: 0,
  pressure: 0,
});

const freshThermo = () => ({ active: false, progress: 0, inserted: false, lubed: false });

let toastId = 0;

export const useGame = create<GameState>((set, get) => ({
  screen: 'title',
  sceneReady: false,
  muted: audio.isMuted(),
  visit: null,
  catGlb: false,
  tool: Tool.Hand,
  placed: false,
  stress: 20,
  happyUntil: 0,
  guided: true,
  syringe: freshSyringe(),
  thermo: freshThermo(),
  pulseBeat: 0,
  errors: [],
  toast: null,
  diploma: null,

  startSim: (caseId) => {
    const c = SIM_CASES.find((x) => x.id === caseId) ?? SIM_CASES[0];
    useSim.getState().start(c);
    set({ screen: 'sim', visit: null });
  },
  setSceneReady: () => set({ sceneReady: true }),
  toggleMute: () => {
    const muted = !get().muted;
    audio.setMuted(muted);
    set({ muted });
  },
  toMenu: () => set({ screen: 'title', visit: null }),

  openVisit: (v) => {
    // punti anatomici e inquadrature della specie, prima che la scena 3D venga montata
    setSpecies(v.patient.species, get().catGlb);
    set({
      visit: v,
      tool: Tool.Hand,
      placed: false,
      stress: 20,
      syringe: freshSyringe(),
      thermo: freshThermo(),
      errors: [],
    });
    if (v.startTool) get().setTool(v.startTool);
  },
  closeVisit: () => {
    audio.stop();
    document.body.style.cursor = '';
    set({ visit: null, tool: Tool.Hand, placed: false, diploma: null });
  },

  setTool: (t) => {
    const s = get();
    if (t === Tool.Syringe && s.stress > 80) {
      s.showToast(`${s.visit?.patient.name ?? 'Il paziente'} è troppo agitato. Prima qualche coccola!`);
      return;
    }
    set({ tool: t, placed: false, thermo: freshThermo(), syringe: t === Tool.Syringe ? freshSyringe() : s.syringe });
  },
  setPlaced: (placed) => set({ placed }),
  setGuided: (g) => set({ guided: g }),
  addStress: (n) => set((s) => ({ stress: Math.max(0, Math.min(100, s.stress + n)) })),
  pet: () => {
    get().addStress(-12);
    set({ happyUntil: performance.now() + 2500 });
  },
  showToast: (text) => set({ toast: { text, id: ++toastId } }),
  setDiploma: (diploma) => set({ diploma }),
  addError: (e) => set((s) => ({ errors: [...s.errors, e] })),
  patchSyringe: (p) => set((s) => ({ syringe: { ...s.syringe, ...p } })),
  patchThermo: (p) => set((s) => ({ thermo: { ...s.thermo, ...p } })),
  completeBlood: () => {
    const { visit, errors } = get();
    get().showToast('🧪 Provetta etichettata e inviata al laboratorio');
    setTimeout(() => {
      visit?.onPrelievo?.(errors);
      get().closeVisit();
    }, 1400);
  },
  beatPulse: () => set((s) => ({ pulseBeat: s.pulseBeat + 1 })),
}));

/** Vista camera derivata dallo stato. */
export function cameraViewFor(tool: Tool, thermoActive: boolean, placed: boolean): CameraView {
  if (tool === Tool.Syringe) return 'syringe';
  if (tool === Tool.Thermometer && thermoActive) return 'thermometer';
  if (tool === Tool.Pulse && placed) return 'femoral';
  if (tool === Tool.Resp) return 'resp';
  return 'default';
}

// il gatto glTF è solo nella copia locale: se il file c'è lo si usa al posto del gatto costruito in codice
void catModelAvailable().then((ok) => useGame.setState({ catGlb: ok }));

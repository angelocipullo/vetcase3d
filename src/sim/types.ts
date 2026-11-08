/**
 * Modello dati del simulatore clinico "a fasi".
 *
 * Il motore (store + fisiologia + UI) è generico: un caso è SOLO dati (`SimCase`).
 * Per aggiungere un caso nuovo si scrive un file in `src/sim/cases/` che esporta un `SimCase`
 * e lo si registra in `src/sim/cases/index.ts`. Vedi `docs/simulatore.md`.
 */

/** Esami/procedure richiedibili. Il catalogo (costi, tempi, etichette) è in `exams.ts`. */
export type ExamId =
  | 'emocromo'
  | 'biochimico'
  | 'emogas'
  | 'coagulazione'
  | 'lattati'
  | 'urine'
  | 't4'
  | 'fivfelv'
  | 'aldosterone'
  | 'ecofast'
  | 'ecografia'
  | 'rx'
  | 'ecg'
  | 'endoscopia'
  | 'tc'
  | 'ecocardio'
  | 'pa'
  | 'fondo'
  | 'gruppo';

export type DrugId =
  | 'maropitant'
  | 'spironolattone'
  | 'amlodipina'
  | 'kclOrale'
  | 'furosemide'
  | 'bicarbonato'
  | 'insulina'
  | 'diazepam';

export type FluidId = 'none' | 'rl' | 'nacl' | 'g5';

/** Parametri del pronto soccorso raccolti con i minigiochi (scheda PS). */
export type VitalId = 'temp' | 'polso' | 'resp' | 'mucose' | 'trc' | 'loc' | 'pa';

/** Stato fisiologico "vero" del paziente: l'utente lo vede solo attraverso esami e parametri. */
export interface Phys {
  k: number; // mEq/L
  na: number; // mEq/L
  cl: number; // mEq/L
  hco3: number; // mmol/L
  pco2: number; // mmHg
  ph: number;
  glu: number; // mg/dL
  lact: number; // mmol/L
  sbp: number; // mmHg, sistolica
  hr: number; // bpm
  rr: number; // atti/min
  temp: number; // °C
  vomiting: boolean;
}

/**
 * Profilo di malattia: parametri che guidano `physiology.ts`.
 * Ogni caso nuovo può riusare il modello cambiando questi numeri (o estendendoli).
 */
export interface DiseaseProfile {
  kg: number;
  /** 0..1: eccesso di mineralcorticoidi (perdita renale di K, alcalosi, ipertensione). */
  aldo: number;
  /** Componente ipertensiva indipendente dall'aldosterone (es. renale), mmHg. */
  extraSbp?: number;
  /** FC e FR a cui il paziente tende (es. tachicardia e tachipnea da anemia). Default 175 e 22. */
  hrBase?: number;
  rrBase?: number;
}

export interface Fluids {
  fluid: FluidId;
  rateMlH: number;
  /** KCl aggiunto, mEq per litro di fluido. */
  kclMeqL: number;
}

export interface Therapy {
  fluids: Fluids;
  /** Farmaci attivi → minuto di inizio. */
  drugs: Partial<Record<DrugId, number>>;
}

export type Source = 'documento' | 'generato' | 'misto';

export interface ResultRow {
  label: string;
  value: string | number;
  unit?: string;
  ref?: string;
  flag?: 'H' | 'L' | '';
  /** Valore generato (non presente nella documentazione reale del caso). */
  gen?: boolean;
}

export interface ResultDoc {
  id: string;
  exam: ExamId;
  title: string;
  orderedAt: number;
  readyAt: number;
  source: Source;
  rows?: ResultRow[];
  text?: string;
  conclusion?: string;
  /** Esame non eseguito (es. anestesia controindicata): motivo. */
  refused?: string;
}

/** Vista in sola lettura dello stato, passata alle funzioni dinamiche del caso. */
export interface SimCtx {
  clock: number;
  phys: Phys;
  therapy: Therapy;
  results: ResultDoc[];
  flags: Record<string, boolean>;
  findings: Partial<Record<VitalId, Finding>>;
  /** Ultimo valore numerico refertato e disponibile (es. lastValue('emogas','K')). */
  lastValue: (exam: ExamId, label: string) => number | undefined;
  hasResult: (exam: ExamId) => boolean;
}

export type Dyn<T> = T | ((ctx: SimCtx) => T);

export interface Finding {
  value: string;
  ok: boolean;
  t: number;
  note?: string;
}

export type ScoreCat = 'ragionamento' | 'anamnesi' | 'clinica' | 'esami' | 'terapia' | 'monitoraggio';

export type Effect =
  | { kind: 'drug'; drug: DrugId; on?: boolean }
  | { kind: 'fluids'; fluids: Partial<Fluids> }
  | { kind: 'time'; min: number }
  | { kind: 'flag'; flag: string }
  | { kind: 'safety'; title: string; body: string; penalty: number };

export interface QuizOption {
  id: string;
  text: string;
  /** 0..1 (1 = risposta migliore; valori intermedi = parzialmente corretta). Nei multi-select: true/false. */
  score: number;
  feedback: string;
  effects?: Effect[];
}

/** Valori del paziente rilevabili con i minigiochi della scheda PS. */
export interface VitalTruth {
  temp: number;
  hr: number;
  /** Intervallo di riferimento della FC per la specie: sotto = bradicardia, sopra = tachicardia. */
  hrRange: [number, number];
  rr: number;
  mucose: 'rosee' | 'pallide' | 'cianotiche' | 'iperemiche' | 'itteriche';
  trcSec: number;
  loc: 'vigile' | 'ottundimento' | 'stupor' | 'coma';
  locDescription: string;
  sbp: number;
}

interface StageBase {
  id: string;
  title: string;
  /** Etichetta breve della fase per la barra di avanzamento. */
  phase: string;
  /** Minuti simulati di ingresso nella fase (es. salti temporali). */
  skipMin?: number;
}

export interface NarrativeStage extends StageBase {
  kind: 'narrative';
  body: Dyn<string>;
  /** Dialogo esplicito; se assente viene ricavato da `body` (i paragrafi «…» li dice il proprietario). */
  dialogue?: DialogueLine[];
  bullets?: Dyn<string[]>;
  cta: string;
}

export interface QuizStage extends StageBase {
  kind: 'quiz';
  question: Dyn<string>;
  context?: Dyn<string>;
  options: Dyn<QuizOption[]>;
  multi?: boolean;
  /** Mantiene l'ordine delle opzioni (altrimenti vengono mescolate). */
  ordered?: boolean;
  /** Secondi per rispondere (stile quiz TV): rispondere presto dà un bonus. */
  timer?: number;
  points: number;
  explanation: string;
  /** Effetti applicati SEMPRE dopo la risposta (la "strada corretta" che il caso prende comunque). */
  after?: Effect[];
}

export interface InterviewQuestion {
  id: string;
  q: string;
  a: string;
  /** key = domanda indispensabile; useful = bonus; irrelevant = tempo perso. */
  weight: 'key' | 'useful' | 'irrelevant';
  source: Source;
  topic: string;
}

export interface InterviewStage extends StageBase {
  kind: 'interview';
  intro: string;
  budget: number;
  questions: InterviewQuestion[];
  points: number;
}

export interface VitalsStage extends StageBase {
  kind: 'vitals';
  intro: string;
  required: VitalId[];
  optional: VitalId[];
  points: number;
}

export type Relevance = 'essential' | 'useful' | 'neutral' | 'inappropriate';

export interface OrdersStage extends StageBase {
  kind: 'orders';
  intro: Dyn<string>;
  groups: { title: string; exams: ExamId[] }[];
  relevance: Dyn<Partial<Record<ExamId, { rel: Relevance; why: string }>>>;
  /** Esami che il caso esegue comunque se l'utente li salta (con penalità già nel punteggio). */
  forced?: ExamId[];
  points: number;
}

export interface AbgStage extends StageBase {
  kind: 'abg';
  intro: string;
  points: number;
}

export interface PumpStage extends StageBase {
  kind: 'pump';
  intro: Dyn<string>;
  bagMl: number;
  kclMeqPerMl: number;
  points: number;
}

export interface MonitorStage extends StageBase {
  kind: 'monitor';
  intro: Dyn<string>;
  goal: string;
  minHours: number;
  target: { kMin: number; kMax: number; sbpMax?: number };
  points: number;
}

export interface CtStage extends StageBase {
  kind: 'ct';
  intro: string;
  points: number;
}

export interface DebriefStage extends StageBase {
  kind: 'debrief';
}

export type Stage =
  | NarrativeStage
  | QuizStage
  | InterviewStage
  | VitalsStage
  | OrdersStage
  | AbgStage
  | PumpStage
  | MonitorStage
  | CtStage
  | DebriefStage;

export interface SimPatient {
  name: string;
  species: 'gatto' | 'cane';
  breed: string;
  sex: string;
  age: string;
  kg: number;
  coat?: string;
}

/** Ritratto in pixel art generato in codice (vedi ui/sim/rpg.tsx). */
export type SpriteSpec =
  | {
      kind: 'human';
      skin: string;
      hair: string;
      hairStyle: 'short' | 'long' | 'bun' | 'bald';
      clothes: string;
      coat?: boolean;
      glasses?: boolean;
    }
  | { kind: 'cat'; fur: string; dark: string; eyes: string; muzzle?: string };

export interface Speaker {
  name: string;
  sprite?: SpriteSpec;
}

export type SpeakerId = 'narratore' | 'owner' | 'mentor' | 'nurse' | 'patient';

export interface DialogueLine {
  who: SpeakerId;
  text: string;
}

/** Un caso clinico completo per il simulatore. */
export interface SimCase {
  id: string;
  title: string;
  difficulty: 1 | 2 | 3;
  /** Caso interamente inventato (nessuna documentazione reale). */
  generated?: boolean;
  /** Data/ora di arrivo in PS (ISO locale). */
  arrival: string;
  patient: SimPatient;
  complaint: string;
  /** Personaggi del caso: proprietario e paziente (primario e infermiere sono comuni a tutti i casi). */
  cast: { owner: Speaker; patient: SpriteSpec };
  disease: DiseaseProfile;
  initialPhys: Phys;
  /** Valori "veri" per i minigiochi della scheda PS (al momento dell'arrivo). */
  vitals: VitalTruth;
  stages: Stage[];
  /** Referti per esame. Funzioni → valori dinamici calcolati dallo stato del paziente. */
  results: Partial<Record<ExamId, (ctx: SimCtx) => Omit<ResultDoc, 'id' | 'exam' | 'orderedAt' | 'readyAt'>>>;
  /** Esami rifiutati in certe condizioni (es. anestesia in paziente instabile). */
  refuse?: Partial<Record<ExamId, (ctx: SimCtx) => string | null>>;
  /** Dati del caso per il minigioco TC (lesione da trovare). */
  ct?: CtSpec;
  /** Segni osservabili specifici del caso (si aggiungono a quelli derivati da K⁺ e pressione). */
  observation?: (ctx: SimCtx) => string[];
  /** Riassunto del caso reale per il debriefing. */
  realCase: { date: string; text: string }[];
  finalDiagnosis: string;
  /** Diagnosi finale a scelta multipla proposta all'inizio del debriefing (una opzione con score 1). */
  diagnosisOptions: QuizOption[];
  diagnosisPoints: number;
  teaching: string[];
}

export interface CtSpec {
  slices: number;
  /** Lesione: lato del paziente, intervallo di fette, centro e raggio in coordinate immagine 0..300. */
  lesion: { side: 'sx' | 'dx'; from: number; to: number; cx: number; cy: number; r: number; label: string };
}

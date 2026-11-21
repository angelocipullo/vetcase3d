import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useGame } from '../../store';
import { useSim } from '../../sim/store';
import { VitalTruth } from '../../sim/types';
import { TechniqueError } from '../../game/types';

export interface GameProps {
  truth: VitalTruth;
  onDone: (value: string, ok: boolean, note?: string) => void;
  /** Dentro l'ambulatorio 3D: niente disegni 2D, si guarda (e si tocca) il modello del paziente. */
  embedded?: boolean;
}

/* ------------------------------------------------------------------ temperatura */
export function ThermoGame({ truth, onDone }: GameProps) {
  const [lubed, setLubed] = useState(false);
  const [phase, setPhase] = useState<'ready' | 'reading' | 'beep'>('ready');
  const [value, setValue] = useState(35);
  useEffect(() => {
    if (phase !== 'reading') return;
    const start = performance.now();
    const id = setInterval(() => {
      const f = Math.min(1, (performance.now() - start) / 6000);
      setValue(35 + (truth.temp - 35) * (1 - Math.pow(1 - f, 2)));
      if (f >= 1) {
        setPhase('beep');
        clearInterval(id);
      }
    }, 80);
    return () => clearInterval(id);
  }, [phase, truth.temp]);
  const read = () => {
    const ok = phase === 'beep' && lubed;
    const note = !lubed ? 'Termometro inserito senza lubrificante' : phase !== 'beep' ? 'Letto prima del segnale acustico' : undefined;
    onDone(`${value.toFixed(1)} °C`, ok, note);
  };
  return (
    <div className="s-game">
      <p className="s-muted">Temperatura rettale: lubrifica la punta, inserisci e aspetta il bip prima di leggere.</p>
      <div className={`s-lcd ${phase === 'beep' ? 'beep' : ''}`}>{phase === 'ready' ? '--.-' : value.toFixed(1)}°</div>
      {phase === 'beep' && <p className="s-beep">BIP · BIP</p>}
      <div className="s-row">
        <button className={`s-btn ${lubed ? 'on' : ''}`} disabled={phase !== 'ready'} onClick={() => setLubed(true)}>
          {lubed ? '✓ Lubrificato' : '🧴 Lubrifica'}
        </button>
        {phase === 'ready' ? (
          <button className="s-btn primary" onClick={() => setPhase('reading')}>Inserisci</button>
        ) : (
          <button className="s-btn primary" onClick={read}>Leggi ed estrai</button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ polso */
const HR_CLASSES = ['bradicardico', 'normocardico', 'tachicardico'] as const;
type HrClass = (typeof HR_CLASSES)[number];

function hrClass(hr: number, [lo, hi]: [number, number]): HrClass {
  return hr < lo ? 'bradicardico' : hr > hi ? 'tachicardico' : 'normocardico';
}

/** Colpo sordo del polso sotto le dita: sinusoide che scende di tono + piccola onda dicrota. */
function scheduleThump(ctx: AudioContext, at: number) {
  for (const [delay, peak] of [[0, 0.55], [0.11, 0.15]] as const) {
    const t = at + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(95, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.16);
  }
}

export function PulseGame({ truth, onDone, onBeat }: GameProps & { onBeat?: () => void }) {
  const SECONDS = 6;
  const W = 600;
  const H = 90;
  const path = useMemo(() => {
    const beats = (truth.hr * SECONDS) / 60;
    const period = W / beats;
    const pts: string[] = [];
    for (let x = 0; x <= W; x += 1.5) {
      const ph = (x % period) / period;
      const up = Math.exp(-Math.pow((ph - 0.18) / 0.06, 2));
      const notch = 0.35 * Math.exp(-Math.pow((ph - 0.45) / 0.08, 2));
      pts.push(`${x},${H - 12 - (up + notch) * (H - 26)}`);
    }
    return pts.join(' ');
  }, [truth.hr]);
  // palpazione in tempo reale: il tracciato si rivela da sinistra e ogni battito si sente
  const [sweep, setSweep] = useState(0); // 0..1
  const [palpating, setPalpating] = useState(false);
  const [beat, setBeat] = useState(0);
  const audioRef = useRef<AudioContext | null>(null);
  useEffect(() => () => void audioRef.current?.close(), []);
  const palpate = () => {
    if (palpating) return;
    const beats = (truth.hr * SECONDS) / 60;
    const times = Array.from({ length: Math.ceil(beats) }, (_, i) => ((i + 0.18) * SECONDS) / beats).filter((t) => t < SECONDS);
    let ctx: AudioContext | null = null;
    if (!useGame.getState().muted) {
      try {
        ctx = audioRef.current ??= new AudioContext();
        void ctx.resume();
        const t0 = ctx.currentTime + 0.05;
        times.forEach((t) => scheduleThump(ctx!, t0 + t));
      } catch {
        /* audio non disponibile: resta il feedback visivo */
      }
    }
    setPalpating(true);
    const start = performance.now() + 50;
    let next = 0;
    const loop = () => {
      const t = Math.max(0, (performance.now() - start) / 1000);
      setSweep(Math.min(1, t / SECONDS));
      while (next < times.length && times[next] <= t) {
        next++;
        setBeat((b) => b + 1);
        onBeat?.();
        // da telefono ogni pulsazione si sente anche come una breve vibrazione
        if (!useGame.getState().muted) navigator.vibrate?.(35);
      }
      if (t < SECONDS) requestAnimationFrame(loop);
      else setPalpating(false);
    };
    requestAnimationFrame(loop);
  };

  const [count, setCount] = useState('');
  const [cls, setCls] = useState<HrClass | ''>('');
  const bpm = Number(count) * 10;
  const submit = () => {
    const [lo, hi] = truth.hrRange;
    const real = hrClass(truth.hr, truth.hrRange);
    const countOk = Math.abs(bpm - truth.hr) <= 20;
    const note = !countOk
      ? `Conteggio impreciso (reale ~${truth.hr} bpm)`
      : cls !== real
        ? `Classificazione errata: riferimento ${lo}–${hi} bpm per la specie`
        : undefined;
    onDone(`${bpm} bpm, ${cls}`, countOk && cls === real, note);
  };
  return (
    <div className="s-game">
      <p className="s-muted">Appoggia le dita sull’arteria femorale per 6 secondi: senti e vedi ogni pulsazione. Conta, moltiplica per 10 e classifica la frequenza. Puoi ripetere.</p>
      <div className="s-palp">
        <span key={beat} className={`s-palp-heart ${beat ? 'beat' : ''}`} aria-hidden>💗</span>
        <button className="s-btn primary" disabled={palpating} onClick={palpate}>
          {palpating ? `Palpazione… ${Math.ceil(SECONDS * (1 - sweep))} s` : sweep ? '🔁 Palpa di nuovo (6 s)' : '🖐️ Palpa il polso (6 s)'}
        </button>
      </div>
      <svg className="s-strip" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <defs>
          <clipPath id="pulse-reveal">
            <rect x={0} y={0} width={W * sweep} height={H} />
          </clipPath>
        </defs>
        {Array.from({ length: SECONDS + 1 }, (_, i) => (
          <line key={i} x1={(i * W) / SECONDS} x2={(i * W) / SECONDS} y1={0} y2={H} className="sec" />
        ))}
        <polyline points={path} className="wave" clipPath="url(#pulse-reveal)" />
        {palpating && <line x1={W * sweep} x2={W * sweep} y1={0} y2={H} className="cursor" />}
      </svg>
      <div className="s-form">
        <label>
          Pulsazioni in 6 s
          <input type="number" min={0} max={60} value={count} onChange={(e) => setCount(e.target.value)} />
        </label>
        <span className="s-calc">= {count ? bpm : '—'} bpm</span>
      </div>
      <div className="s-seg">
        {HR_CLASSES.map((c) => (
          <button key={c} className={cls === c ? 'on' : ''} onClick={() => setCls(c)}>{c}</button>
        ))}
      </div>
      <button className="s-btn primary" disabled={!count || !cls} onClick={submit}>Registra</button>
    </div>
  );
}

/* ------------------------------------------------------------------ respiro */
export function RespGame({ truth, onDone, embedded }: GameProps) {
  const WINDOW = 15;
  const [running, setRunning] = useState(false);
  const [left, setLeft] = useState(WINDOW);
  const [taps, setTaps] = useState(0);
  const [finished, setFinished] = useState(false);
  const chest = useRef<SVGEllipseElement>(null);
  useEffect(() => {
    if (!running) return;
    const start = performance.now();
    let raf = 0;
    const loop = () => {
      const t = (performance.now() - start) / 1000;
      const s = 1 + 0.09 * Math.max(0, Math.sin((2 * Math.PI * t * truth.rr) / 60));
      chest.current?.setAttribute('ry', String(34 * s));
      setLeft(Math.max(0, WINDOW - t));
      if (t >= WINDOW) {
        setRunning(false);
        setFinished(true);
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running, truth.rr]);
  const rr = taps * 4;
  return (
    <div className="s-game">
      <p className="s-muted">
        {embedded ? 'Guarda il torace del paziente sul tavolo' : 'Osserva il torace'} per 15 secondi e tocca “Atto” a ogni inspirazione. Il risultato × 4 = atti/min.
      </p>
      {!embedded && (
        <svg className="s-thorax" viewBox="0 0 200 110">
          <ellipse cx={100} cy={60} rx={70} ry={34} ref={chest} className="chest" />
          <path d="M40 60 Q100 40 160 60" className="ribs" />
          <path d="M45 70 Q100 52 155 70" className="ribs" />
        </svg>
      )}
      <div className="s-row">
        {!running && !finished && <button className="s-btn primary" onClick={() => setRunning(true)}>Avvia (15 s)</button>}
        {running && (
          <button className="s-btn big" onClick={() => setTaps((n) => n + 1)}>
            Atto · {taps} <small>{left.toFixed(0)} s</small>
          </button>
        )}
      </div>
      {finished && (
        <>
          <p className="s-calc">{taps} atti × 4 = <b>{rr}/min</b></p>
          <button className="s-btn primary" onClick={() => onDone(`${rr} atti/min`, Math.abs(rr - truth.rr) <= 6, Math.abs(rr - truth.rr) > 6 ? `Reale ~${truth.rr}/min` : undefined)}>
            Registra
          </button>
        </>
      )}
    </div>
  );
}

const GUM: Record<VitalTruth['mucose'], string> = {
  rosee: '#e7899b',
  pallide: '#f2dcdc',
  cianotiche: '#9b8fc6',
  iperemiche: '#d42e4b',
  itteriche: '#e6c46a',
};

/** Premolari superiori (dal fondo verso il muso): x del centro, larghezza, altezza della corona. */
const PREMOLARS: [number, number, number][] = [
  [40, 30, 22],
  [76, 28, 20],
  [108, 22, 15],
  [132, 15, 10],
];

/** Profilo del muso (naso a destra) e il suo bordo visibile (senza il taglio a sinistra). */
const MUZZLE_EDGE = 'M0 2 Q70 2 130 12 Q176 18 204 16 Q236 14 239 36 Q240 56 228 62 Q236 80 232 100 Q228 120 214 130 Q222 144 204 152 Q150 160 80 158 Q36 156 0 150';
const MUZZLE = `${MUZZLE_EDGE} Z`;

/** Gengiva tra il labbro sollevato (sopra) e il colletto dei denti (sotto), in funzione di x. */
const neckY = (x: number) => 94 - 0.018 * x;
/** Altezza della gengiva scoperta: a lente, quasi nulla agli angoli della bocca, massima sotto il dito. */
const gumH = (x: number) => 3 + 22 * Math.sin(Math.PI * Math.min(1, Math.max(0, (x - 2) / 222))) ** 0.8 + 7 * Math.exp(-(((x - 104) / 30) ** 2));
const lipY = (x: number) => neckY(x) - gumH(x);
const LIP_XS = Array.from({ length: 21 }, (_, i) => 8 + i * 10.3);
const pts = (xs: number[], f: (x: number) => number) => xs.map((x) => `${x.toFixed(1)} ${f(x).toFixed(1)}`).join(' L');

/**
 * Bocca di un cane vista di lato (muso a destra): il dito del guanto solleva il labbro superiore
 * e scopre la gengiva sopra canino e premolari. La gengiva ha il colore del caso; la macchia
 * bianca è la pressione del TRC.
 */
type MouthProps = { color: string; blanch: boolean; trc: number; fur: string; dark: string; muzzle: string };

function DogMouth({ color, blanch, trc, fur, dark }: MouthProps) {
  const id = useId().replace(/:/g, '');
  const u = (k: string) => `url(#${id}${k})`;
  const rev = [...LIP_XS].reverse();
  const gum = `M${pts(LIP_XS, lipY)} L${pts(rev, neckY)} Z`;
  const lipBand = `M0 ${lipY(0) - 14} L${pts(LIP_XS, (x) => lipY(x) - 14)} L224 ${lipY(224) - 14} L224 ${lipY(224) + 2} L${pts(rev, (x) => lipY(x) + 1)} L0 ${lipY(0) + 1} Z`;
  return (
    <svg className="s-gum" viewBox="0 0 240 160" role="img" aria-label="Gengiva del paziente con il labbro sollevato">
      <defs>
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor={fur} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
        <pattern id={`${id}h`} width="7" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-18)">
          <path d="M0 3 l5 -1" stroke="#5e412b" strokeOpacity="0.35" strokeWidth="0.8" />
          <path d="M3 6 l4 -1" stroke="#d9b892" strokeOpacity="0.25" strokeWidth="0.6" />
        </pattern>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3b1d22" stopOpacity="0.55" />
          <stop offset="0.28" stopColor="#3b1d22" stopOpacity="0" />
          <stop offset="0.85" stopColor="#3b1d22" stopOpacity="0" />
          <stop offset="1" stopColor="#3b1d22" stopOpacity="0.18" />
        </linearGradient>
        <linearGradient id={`${id}t`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fffdf7" />
          <stop offset="0.6" stopColor="#f1e8d4" />
          <stop offset="1" stopColor="#cfc0a0" />
        </linearGradient>
        <radialGradient id={`${id}m`} cx="0.6" cy="0.2" r="0.9">
          <stop offset="0" stopColor="#6b2d36" />
          <stop offset="1" stopColor="#1e0c10" />
        </radialGradient>
        <radialGradient id={`${id}n`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#4a3c40" />
          <stop offset="1" stopColor="#141013" />
        </radialGradient>
        {/* sagoma del muso di profilo: dorso del naso, tartufo, labbro, mento; a sinistra sfuma nella testa */}
        <linearGradient id={`${id}k`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.14" stopColor="#fff" stopOpacity="1" />
        </linearGradient>
        <mask id={`${id}s`} maskUnits="userSpaceOnUse" x="0" y="0" width="240" height="160">
          <path d={MUZZLE} fill={u('k')} />
        </mask>
      </defs>

      <g mask={u('s')}>
      {/* muso con pelo */}
      <path d="M0 0 H206 Q240 4 240 40 L240 160 H0 Z" fill={u('f')} />
      <path d="M0 0 H206 Q240 4 240 40 L240 160 H0 Z" fill={u('h')} />
      {/* naso con narice */}
      <g transform="translate(0 13)">
        <path d="M198 4 Q232 0 238 22 Q240 42 222 46 Q204 46 198 32 Q192 14 198 4 Z" fill={u('n')} />
        <path d="M224 18 Q232 22 230 32 Q224 34 222 26 Z" fill="#0b0809" />
        <ellipse cx="208" cy="14" rx="7" ry="3" fill="#fff" opacity="0.2" />
      </g>

      {/* bocca aperta: interno scuro, canino inferiore, labbro inferiore e mento */}
      <path d="M6 96 Q120 106 222 92 Q226 116 208 126 Q120 136 6 128 Z" fill={u('m')} />
      <path d="M40 112 Q60 108 80 112" fill="none" stroke="#000" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M146 126 Q148 108 156 100 Q160 112 158 126 Z" fill={u('t')} stroke="#b9a983" strokeWidth="0.8" />
      <path d="M4 124 Q120 136 222 120 Q226 130 212 134 Q120 146 4 136 Z" fill="#2e2226" />
      <path d="M0 136 Q120 148 214 134 L240 160 H0 Z" fill={u('f')} />
      <path d="M0 136 Q120 148 214 134 L240 160 H0 Z" fill={u('h')} />

      {/* gengiva con il colore del caso, ombra del labbro in alto, riflessi umidi e capillari */}
      <path d={gum} fill={color} />
      <path d={gum} fill={u('g')} />
      <path d="M34 76 Q70 68 98 70" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="3" strokeLinecap="round" />
      <path d="M150 78 Q170 75 186 79" fill="none" stroke="#fff" strokeOpacity="0.25" strokeWidth="2" strokeLinecap="round" />
      <path d="M48 80 q6 -3 12 1 q5 3 9 -1 M140 82 q5 -4 10 0 M92 84 q4 2 8 -1" fill="none" stroke="#7a2232" strokeOpacity="0.22" strokeWidth="0.9" />

      {/* pressione per il TRC: la gengiva sbianca e poi si ricolora */}
      <ellipse cx={100} cy={78} rx={15} ry={6} fill="#fff" style={{ opacity: blanch ? 0.9 : 0, transition: `opacity ${blanch ? 0.1 : trc}s linear` }} />

      {/* denti superiori: premolari a tre cuspidi, canino ricurvo, incisivi */}
      {PREMOLARS.map(([x, w, h]) => {
        const y = neckY(x);
        const l = x - w / 2;
        const r = x + w / 2;
        return (
          <g key={x}>
            <path
              d={`M${l} ${y} Q${l + 1} ${y + h * 0.45} ${l + w * 0.22} ${y + h * 0.55} L${x} ${y + h} L${r - w * 0.22} ${y + h * 0.55} Q${r - 1} ${y + h * 0.45} ${r} ${y} Z`}
              fill={u('t')}
              stroke="#b9a983"
              strokeWidth="0.9"
            />
            <path d={`M${x - 2} ${y + 3} L${x - 1} ${y + h * 0.7}`} stroke="#fff" strokeOpacity="0.8" strokeWidth="1.4" strokeLinecap="round" />
          </g>
        );
      })}
      <path d="M150 92 Q151 116 160 140 Q165 146 168 138 Q172 114 176 91 Q163 86 150 92 Z" fill={u('t')} stroke="#b9a983" strokeWidth="1" />
      <path d="M156 96 Q157 116 163 132" fill="none" stroke="#fff" strokeOpacity="0.75" strokeWidth="2.2" strokeLinecap="round" />
      {[186, 196, 205].map((x) => (
        <path
          key={x}
          d={`M${x - 4.5} ${neckY(x)} L${x - 3.5} ${neckY(x) + 13} Q${x} ${neckY(x) + 16} ${x + 3.5} ${neckY(x) + 13} L${x + 4.5} ${neckY(x)} Z`}
          fill={u('t')}
          stroke="#b9a983"
          strokeWidth="0.8"
        />
      ))}
      {/* festoni della gengiva sul colletto di ogni dente */}
      {[...PREMOLARS.map(([x, w]) => [x, w] as const), [163, 26] as const, [196, 30] as const].map(([x, w]) => (
        <path key={`f${x}`} d={`M${x - w / 2} ${neckY(x) + 1} Q${x} ${neckY(x) - 7} ${x + w / 2} ${neckY(x) + 1}`} fill={color} />
      ))}

      {/* labbro superiore sollevato: bordo pigmentato */}
      <path d={lipBand} fill="#33262a" />
      <path d={`M${pts(LIP_XS, lipY)}`} fill="none" stroke="#5a4146" strokeWidth="1.5" />
      </g>
      {/* contorno del muso */}
      <path d={MUZZLE_EDGE} fill="none" stroke="#5e412b" strokeOpacity="0.6" strokeWidth="1.5" />
      {/* dito guantato che solleva il labbro */}
      <path d="M84 0 Q80 26 88 42 Q102 54 118 44 Q128 30 124 0 Z" fill="#a5d8ff" stroke="#74b4dc" strokeWidth="1.5" />
      <path d="M94 40 Q104 47 114 40" fill="none" stroke="#74b4dc" strokeWidth="1.5" />
      <ellipse cx="96" cy="16" rx="4" ry="10" fill="#fff" opacity="0.35" />
    </svg>
  );
}


/* ---------- muso del gatto ---------- */

/** Profilo del muso del gatto (corto e tondo, naso a destra). */
const CAT_EDGE = 'M0 4 Q90 2 150 18 Q178 26 198 30 Q224 32 230 48 Q234 62 222 70 Q234 84 228 104 Q220 126 196 134 Q200 146 182 152 Q130 160 70 158 Q30 156 0 152';
const CAT_MUZZLE = `${CAT_EDGE} Z`;
const catNeck = (x: number) => 92 - 0.02 * x;
const catGumH = (x: number) => 2 + 16 * Math.sin(Math.PI * Math.min(1, Math.max(0, (x - 4) / 196))) ** 0.8 + 5 * Math.exp(-(((x - 100) / 26) ** 2));
const catLip = (x: number) => catNeck(x) - catGumH(x);
const CAT_XS = Array.from({ length: 21 }, (_, i) => 6 + i * 9.6);
/** Denti superiori del gatto dal fondo: molare, ferino (P4), P3, P2: x, larghezza, altezza. */
const CAT_PREMOLARS: [number, number, number][] = [
  [40, 12, 6],
  [70, 30, 17],
  [104, 18, 12],
  [128, 8, 5],
];

function CatMouth({ color, blanch, trc, fur, dark, muzzle }: MouthProps) {
  const id = useId().replace(/:/g, '');
  const u = (k: string) => `url(#${id}${k})`;
  const rev = [...CAT_XS].reverse();
  const gum = `M${pts(CAT_XS, catLip)} L${pts(rev, catNeck)} Z`;
  const lipBand = `M0 ${catLip(0) - 10} L${pts(CAT_XS, (x) => catLip(x) - 10)} L198 ${catLip(198) - 10} L198 ${catLip(198) + 1} L${pts(rev, (x) => catLip(x) + 1)} L0 ${catLip(0) + 1} Z`;
  return (
    <svg className="s-gum" viewBox="0 0 240 160" role="img" aria-label="Gengiva del gatto con il labbro sollevato">
      <defs>
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor={fur} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
        <pattern id={`${id}h`} width="5" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(-14)">
          <path d="M0 2 l4 -0.6" stroke="#000" strokeOpacity="0.14" strokeWidth="0.6" />
          <path d="M2 4 l3 -0.5" stroke="#fff" strokeOpacity="0.18" strokeWidth="0.5" />
        </pattern>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3b1d22" stopOpacity="0.5" />
          <stop offset="0.3" stopColor="#3b1d22" stopOpacity="0" />
          <stop offset="0.85" stopColor="#3b1d22" stopOpacity="0" />
          <stop offset="1" stopColor="#3b1d22" stopOpacity="0.18" />
        </linearGradient>
        <linearGradient id={`${id}t`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fffdf7" />
          <stop offset="0.6" stopColor="#f1e8d4" />
          <stop offset="1" stopColor="#cfc0a0" />
        </linearGradient>
        <radialGradient id={`${id}m`} cx="0.6" cy="0.2" r="0.9">
          <stop offset="0" stopColor="#7a3442" />
          <stop offset="1" stopColor="#220e13" />
        </radialGradient>
        <linearGradient id={`${id}k`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.14" stopColor="#fff" stopOpacity="1" />
        </linearGradient>
        <mask id={`${id}s`} maskUnits="userSpaceOnUse" x="0" y="0" width="240" height="160">
          <path d={CAT_MUZZLE} fill={u('k')} />
        </mask>
      </defs>

      <g mask={u('s')}>
        {/* muso con pelo e cuscinetto dei baffi più chiaro */}
        <rect width="240" height="160" fill={u('f')} />
        <rect width="240" height="160" fill={u('h')} />
        <ellipse cx="168" cy="62" rx="38" ry="18" fill={muzzle} opacity="0.8" />
        {[[152, 60], [164, 56], [176, 60], [158, 67], [170, 65], [182, 67]].map(([x, y]) => (
          <circle key={`${x}${y}`} cx={x} cy={y} r="1.3" fill={dark} opacity="0.7" />
        ))}
        {/* naso rosa */}
        <g transform="translate(-10 2)">
        <path d="M204 36 Q218 30 230 38 Q230 50 222 54 Q213 56 207 48 Q202 42 204 36 Z" fill="#c98a8f" />
        <path d="M222 44 Q228 46 227 51 Q222 52 221 48 Z" fill="#7a3f47" />
        <ellipse cx="212" cy="37" rx="5" ry="2" fill="#fff" opacity="0.35" />
        </g>

        {/* bocca aperta, canino inferiore, labbro inferiore e mento */}
        <path d="M6 92 Q110 100 206 86 Q210 106 194 116 Q110 126 6 120 Z" fill={u('m')} />
        <path d="M60 106 Q80 102 100 106" fill="none" stroke="#000" strokeOpacity="0.25" strokeWidth="2.5" />
        <path d="M134 118 Q135 104 141 96 Q144 106 143 118 Z" fill={u('t')} stroke="#b9a983" strokeWidth="0.7" />
        <path d="M4 116 Q110 128 206 112 Q208 122 196 125 Q110 136 4 128 Z" fill="#3a2b2e" />
        <path d="M0 128 Q110 140 200 126 L240 160 H0 Z" fill={u('f')} />
        <path d="M0 128 Q110 140 200 126 L240 160 H0 Z" fill={muzzle} opacity="0.55" />

        {/* gengiva del colore del caso */}
        <path d={gum} fill={color} />
        <path d={gum} fill={u('g')} />
        <path d="M40 78 Q66 72 88 75" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M54 84 q5 -3 10 1 M118 84 q4 -3 8 0" fill="none" stroke="#7a2232" strokeOpacity="0.2" strokeWidth="0.8" />
        <ellipse cx={100} cy={80} rx={12} ry={5} fill="#fff" style={{ opacity: blanch ? 0.9 : 0, transition: `opacity ${blanch ? 0.1 : trc}s linear` }} />

        {/* denti: molare, ferino, premolari piccoli, canino lungo e sottile, incisivi minuscoli */}
        {CAT_PREMOLARS.map(([x, w, h]) => {
          const y = catNeck(x);
          const l = x - w / 2;
          const r = x + w / 2;
          return (
            <path
              key={x}
              d={`M${l} ${y} L${l + w * 0.18} ${y + h * 0.55} L${x - w * 0.05} ${y + h} L${x + w * 0.2} ${y + h * 0.5} L${r - w * 0.1} ${y + h * 0.7} L${r} ${y} Z`}
              fill={u('t')}
              stroke="#b9a983"
              strokeWidth="0.8"
            />
          );
        })}
        <path d="M144 89 Q145 110 152 132 Q155 137 157 131 Q160 110 162 88 Q153 85 144 89 Z" fill={u('t')} stroke="#b9a983" strokeWidth="0.9" />
        <path d="M149 93 Q150 110 154 124" fill="none" stroke="#fff" strokeOpacity="0.75" strokeWidth="1.6" strokeLinecap="round" />
        {[172, 179, 186].map((x) => (
          <path key={x} d={`M${x - 3} ${catNeck(x)} L${x - 2} ${catNeck(x) + 7} Q${x} ${catNeck(x) + 9} ${x + 2} ${catNeck(x) + 7} L${x + 3} ${catNeck(x)} Z`} fill={u('t')} stroke="#b9a983" strokeWidth="0.6" />
        ))}
        {[...CAT_PREMOLARS.map(([x, w]) => [x, w] as const), [153, 20] as const, [179, 22] as const].map(([x, w]) => (
          <path key={`f${x}`} d={`M${x - w / 2} ${catNeck(x) + 1} Q${x} ${catNeck(x) - 5} ${x + w / 2} ${catNeck(x) + 1}`} fill={color} />
        ))}

        {/* labbro superiore sollevato */}
        <path d={lipBand} fill="#3a2b2e" />
        <path d={`M${pts(CAT_XS, catLip)}`} fill="none" stroke="#5a4146" strokeWidth="1.2" />
      </g>
      <path d={CAT_EDGE} fill="none" stroke={dark} strokeOpacity="0.6" strokeWidth="1.5" />
      {/* baffi: escono dal muso */}
      {[
        [164, 56, 232, 38],
        [170, 60, 238, 54],
        [170, 65, 236, 76],
        [176, 60, 240, 64],
      ].map(([x1, y1, x2, y2]) => (
        <path key={`${x1}${y1}${x2}`} d={`M${x1} ${y1} Q${(x1 + x2) / 2} ${Math.min(y1, y2) - 4} ${x2} ${y2}`} fill="none" stroke="#f8f9fa" strokeOpacity="0.85" strokeWidth="0.9" />
      ))}
      {/* dito guantato che solleva il labbro */}
      <path d="M84 0 Q80 30 88 48 Q102 60 118 50 Q128 34 124 0 Z" fill="#a5d8ff" stroke="#74b4dc" strokeWidth="1.5" />
      <path d="M94 46 Q104 53 114 46" fill="none" stroke="#74b4dc" strokeWidth="1.5" />
      <ellipse cx="96" cy="18" rx="4" ry="10" fill="#fff" opacity="0.35" />
    </svg>
  );
}

/** Bocca del paziente del caso: muso di gatto o di cane, con i colori del suo mantello. */
function Gum({ color, blanch = false, trc = 2 }: { color: string; blanch?: boolean; trc?: number }) {
  const p = useSim((s) => s.caseDef?.cast.patient);
  const species = useSim((s) => s.caseDef?.patient.species);
  const fur = p && 'fur' in p ? p.fur : '#b48c66';
  const dark = p && 'dark' in p ? p.dark : '#7a573b';
  const muzzle = p && 'muzzle' in p && p.muzzle ? p.muzzle : fur;
  const props = { color, blanch, trc, fur, dark, muzzle };
  return species === 'gatto' ? <CatMouth {...props} /> : <DogMouth {...props} />;
}

/* ------------------------------------------------------------------ mucose */
export function MucousGame({ truth, onDone }: GameProps) {
  return (
    <div className="s-game">
      <p className="s-muted">Solleva il labbro e osserva il colore della gengiva.</p>
      <Gum color={GUM[truth.mucose]} />
      <div className="s-seg wrap">
        {(Object.keys(GUM) as VitalTruth['mucose'][]).map((m) => (
          <button key={m} onClick={() => onDone(m, m === truth.mucose)}>
            <i className="sw" style={{ background: GUM[m] }} /> {m}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ TRC */
export function TrcGame({ truth, onDone }: GameProps) {
  const TOLERANCE = 0.5;
  const [pressed, setPressed] = useState(false);
  const [released, setReleased] = useState(false);
  const [sec, setSec] = useState('');
  const release = () => {
    if (!pressed) return;
    setPressed(false);
    setReleased(true);
  };
  const v = Number(sec.replace(',', '.'));
  return (
    <div className="s-game">
      <p className="s-muted">
        Tieni premuto sulla gengiva finché diventa bianca, poi rilascia e conta i secondi finché torna rosa. Puoi ripetere la prova; poi scrivi il tempo stimato.
      </p>
      <Gum color={GUM[truth.mucose]} blanch={pressed} trc={truth.trcSec} />
      <button
        className={`s-btn ${pressed ? 'on' : ''}`}
        onPointerDown={() => setPressed(true)}
        onPointerUp={release}
        onPointerLeave={release}
      >
        👆 Premi (tieni)
      </button>
      <div className="s-form">
        <label>
          TRC (secondi)
          <input type="number" min={0} max={10} step={0.5} value={sec} disabled={!released} onChange={(e) => setSec(e.target.value)} />
        </label>
        <button
          className="s-btn primary"
          disabled={!released || !sec || !(v >= 0)}
          onClick={() => {
            const ok = Math.abs(v - truth.trcSec) <= TOLERANCE;
            onDone(`${v.toLocaleString('it-IT')} s`, ok, ok ? undefined : `Stima fuori tolleranza ±${TOLERANCE} s`);
          }}
        >
          Registra
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ LOC */
export function LocGame({ truth, onDone }: GameProps) {
  const opts: VitalTruth['loc'][] = ['vigile', 'ottundimento', 'stupor', 'coma'];
  return (
    <div className="s-game">
      <blockquote className="s-quote">{truth.locDescription}</blockquote>
      <p className="s-muted">Come classifichi lo stato mentale?</p>
      <div className="s-seg wrap">
        {opts.map((o) => (
          <button key={o} onClick={() => onDone(o, o === truth.loc)}>{o}</button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ pressione Doppler */
export function DopplerGame({ sbp, hr, onDone }: { sbp: number; hr: number; onDone: (value: string, ok: boolean, note?: string, reading?: number) => void }) {
  const [p, setP] = useState(0);
  const [inflating, setInflating] = useState(false);
  const [readings, setReadings] = useState<number[]>([]);
  const pRef = useRef(0);
  const inflRef = useRef(false);
  inflRef.current = inflating;
  const flowing = p < sbp;
  const audioRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const id = setInterval(() => {
      let v = pRef.current;
      if (inflRef.current) v = Math.min(300, v + 6);
      else v = Math.max(0, v - 0.9); // ~18 mmHg/s
      pRef.current = v;
      setP(v);
    }, 50);
    return () => clearInterval(id);
  }, []);

  // "swish" del Doppler a ogni battito quando il flusso passa
  useEffect(() => {
    const id = setInterval(() => {
      if (!(pRef.current < sbp) || useGame.getState().muted) return;
      try {
        const ctx = (audioRef.current ??= new AudioContext());
        const len = 0.11;
        const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.sin((Math.PI * i) / d.length);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 900;
        const g = ctx.createGain();
        g.gain.value = pRef.current === 0 ? 0.25 : 0.12;
        src.connect(f).connect(g).connect(ctx.destination);
        src.start();
      } catch {
        /* audio non disponibile */
      }
    }, 60000 / hr);
    return () => clearInterval(id);
  }, [sbp, hr]);
  useEffect(() => () => void audioRef.current?.close(), []);

  const take = () => setReadings((r) => [...r, Math.round(pRef.current)]);
  const avg = readings.length ? Math.round(readings.reduce((a, b) => a + b, 0) / readings.length) : 0;
  return (
    <div className="s-game">
      <p className="s-muted">Gonfia il manicotto finché il segnale Doppler sparisce, poi lascia sgonfiare e premi appena senti tornare il flusso. Ripeti 3 volte e registra la media.</p>
      <div className="s-gauge">
        <div className="s-gauge-val">{Math.round(p)} <small>mmHg</small></div>
        <div className="s-gauge-track"><div className="s-gauge-fill" style={{ width: `${(p / 300) * 100}%` }} /></div>
        <div className={`s-flow ${flowing ? 'on' : ''}`} style={{ animationDuration: `${60 / hr}s` }}>
          {flowing ? '〰️ flusso udibile' : '— silenzio —'}
        </div>
      </div>
      <div className="s-row">
        <button
          className={`s-btn ${inflating ? 'on' : ''}`}
          onPointerDown={() => setInflating(true)}
          onPointerUp={() => setInflating(false)}
          onPointerLeave={() => setInflating(false)}
        >
          🎈 Gonfia (tieni)
        </button>
        <button className="s-btn primary" disabled={p < 40 || inflating} onClick={take}>
          🔊 Sento il flusso!
        </button>
      </div>
      {readings.length > 0 && (
        <p className="s-calc">
          Letture: {readings.join(' · ')} mmHg → media <b>{avg}</b>
        </p>
      )}
      <button
        className="s-btn primary"
        disabled={readings.length === 0}
        onClick={() =>
          onDone(
            `${avg} mmHg (${readings.length} letture)`,
            Math.abs(avg - sbp) <= 15 && readings.length >= 2,
            Math.abs(avg - sbp) > 15 ? `Lettura imprecisa (reale ~${Math.round(sbp)} mmHg)` : readings.length < 2 ? 'Una sola lettura: ripeti la misura' : undefined,
            avg,
          )
        }
      >
        Registra la media
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ errori di tecnica del prelievo (diario) */
const PRELIEVO_ERROR: Record<TechniqueError, string> = {
  [TechniqueError.MissedVein]: 'Vena mancata',
  [TechniqueError.TransfixedVein]: 'Vena trapassata (ago troppo inclinato)',
  [TechniqueError.NeedleTooFlat]: 'Ago troppo parallelo alla cute',
  [TechniqueError.VeinCollapsed]: 'Vena collassata (aspirazione troppo forte)',
  [TechniqueError.NoDisinfection]: 'Puntura senza disinfezione',
  [TechniqueError.NoClipping]: 'Puntura senza tricotomia',
  [TechniqueError.Hematoma]: 'Ematoma: ago estratto prima di togliere il laccio',
  [TechniqueError.InterruptedReading]: 'Lettura interrotta',
  [TechniqueError.NoLubricant]: 'Termometro senza lubrificante',
};

export function prelievoErrorLabel(e: TechniqueError) {
  return PRELIEVO_ERROR[e];
}

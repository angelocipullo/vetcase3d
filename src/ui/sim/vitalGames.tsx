import { useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../../store';
import { VitalTruth } from '../../sim/types';

export interface GameProps {
  truth: VitalTruth;
  onDone: (value: string, ok: boolean, note?: string) => void;
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

export function PulseGame({ truth, onDone }: GameProps) {
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
export function RespGame({ truth, onDone }: GameProps) {
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
      <p className="s-muted">Osserva il torace per 15 secondi e tocca “Atto” a ogni inspirazione. Il risultato × 4 = atti/min.</p>
      <svg className="s-thorax" viewBox="0 0 200 110">
        <ellipse cx={100} cy={60} rx={70} ry={34} ref={chest} className="chest" />
        <path d="M40 60 Q100 40 160 60" className="ribs" />
        <path d="M45 70 Q100 52 155 70" className="ribs" />
      </svg>
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

function Gum({ color, blanch = false, trc = 2 }: { color: string; blanch?: boolean; trc?: number }) {
  return (
    <svg className="s-gum" viewBox="0 0 220 110">
      <path d="M10 40 Q110 -10 210 40 L210 110 L10 110 Z" fill={color} />
      {[40, 75, 110, 145, 180].map((x) => (
        <path key={x} d={`M${x - 12} 60 Q${x} 110 ${x + 12} 60 Z`} fill="#fbf7ee" stroke="#d9d0bd" />
      ))}
      <ellipse cx={110} cy={38} rx={22} ry={10} fill="#fff" style={{ opacity: blanch ? 0.95 : 0, transition: `opacity ${blanch ? 0.1 : trc}s linear` }} />
    </svg>
  );
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

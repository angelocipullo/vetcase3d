import { useEffect, useMemo, useRef, useState } from 'react';
import { CtSpec } from '../../sim/types';

/* ------------------------------------------------------------------ Eco-FAST */

const FAST_SITES = [
  { id: 'dh', label: 'Diaframmatico-epatica', x: 118, y: 92 },
  { id: 'sr', label: 'Spleno-renale', x: 168, y: 70 },
  { id: 'hr', label: 'Epato-renale', x: 160, y: 100 },
  { id: 'cc', label: 'Cisto-colica', x: 212, y: 104 },
];

function UsFrame({ seed }: { seed: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const g = c.getContext('2d')!;
    const W = c.width;
    const H = c.height;
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
    let h = 0;
    for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const rnd = () => ((h = (h * 1103515245 + 12345) >>> 0) / 4294967296);
    const blobs = Array.from({ length: 3 }, () => ({ x: W * (0.25 + rnd() * 0.5), y: H * (0.35 + rnd() * 0.45), r: 25 + rnd() * 30 }));
    const img = g.createImageData(W, H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        // settore a ventaglio
        const dx = x - W / 2;
        const ang = Math.atan2(dx, y + 20);
        if (Math.abs(ang) > 0.62 || y < 6) continue;
        let v = 70 + rnd() * 90;
        for (const b of blobs) {
          const d = Math.hypot(x - b.x, y - b.y);
          if (d < b.r) v += 40 - (d / b.r) * 30; // parenchima
        }
        v *= 1 - (y / H) * 0.45; // attenuazione
        const i = (y * W + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.min(255, v);
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  }, [seed]);
  return <canvas ref={ref} width={240} height={170} className="s-us" />;
}

export function EcoFastGame({ onDone }: { onDone: (ok: boolean, note: string) => void }) {
  const [seen, setSeen] = useState<string[]>([]);
  const [cur, setCur] = useState<string | null>(null);
  const all = seen.length === FAST_SITES.length;
  return (
    <div className="s-game">
      <p className="s-muted">Paziente in decubito laterale destro. Appoggia la sonda su ciascuna finestra A-FAST e cerca liquido libero (anecogeno, nero, a punta tra gli organi).</p>
      <svg className="s-cat" viewBox="0 0 300 160">
        <path className="body" d="M70 80 Q80 40 150 45 Q230 45 250 80 Q255 115 220 120 L95 122 Q65 118 70 80 Z" />
        <circle className="body" cx={58} cy={64} r={26} />
        <path className="body" d="M48 42 L52 22 L62 40 Z M66 40 L74 22 L76 44 Z" />
        <path className="tail" d="M248 90 Q290 80 285 40" />
        {FAST_SITES.map((s) => (
          <g key={s.id} className={`site ${seen.includes(s.id) ? 'seen' : ''} ${cur === s.id ? 'cur' : ''}`} onClick={() => {
            setCur(s.id);
            setSeen((x) => (x.includes(s.id) ? x : [...x, s.id]));
          }}>
            <circle cx={s.x} cy={s.y} r={11} />
            <text x={s.x} y={s.y + 4} textAnchor="middle">{s.id.toUpperCase()}</text>
          </g>
        ))}
      </svg>
      {cur && (
        <div className="s-us-wrap">
          <UsFrame seed={cur} />
          <p className="s-muted">{FAST_SITES.find((s) => s.id === cur)!.label}: interfacce tra organi regolari, nessuna raccolta anecogena.</p>
        </div>
      )}
      {all && (
        <div className="s-seg">
          <button onClick={() => onDone(true, 'A-FAST negativo')}>Negativo: nessun liquido libero</button>
          <button onClick={() => onDone(false, 'Falso positivo: non c’era liquido libero')}>Positivo: liquido libero</button>
        </div>
      )}
      {!all && <p className="s-hint">Finestre esaminate: {seen.length}/{FAST_SITES.length}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ Fondo oculare */

export function FundusGame({ hypertensive, onDone }: { hypertensive: boolean; onDone: (ok: boolean, answer: string) => void }) {
  const opts = [
    { id: 'normale', text: 'Fondo nella norma' },
    { id: 'iper', text: 'Retinopatia ipertensiva (emorragie, distacco)' },
    { id: 'corio', text: 'Corioretinite infettiva' },
    { id: 'taurina', text: 'Degenerazione retinica (carenza di taurina)' },
  ];
  return (
    <div className="s-game">
      <p className="s-muted">Oftalmoscopia indiretta, occhio sinistro. Cosa vedi?</p>
      <svg className="s-fundus" viewBox="0 0 220 220">
        <defs>
          <radialGradient id="tap" cx="50%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#c9d84a" />
            <stop offset="55%" stopColor="#5e9a5a" />
            <stop offset="100%" stopColor="#2a2a3a" />
          </radialGradient>
        </defs>
        <circle cx={110} cy={110} r={105} fill="url(#tap)" />
        <circle cx={110} cy={118} r={12} fill="#e9d9c9" />
        {[[-70, -60], [60, -75], [-80, 40], [75, 45], [0, -95], [10, 90]].map(([dx, dy], i) => (
          <path
            key={i}
            d={`M110 118 Q${110 + dx * 0.4 + (hypertensive ? 14 : 0)} ${118 + dy * 0.6 - (hypertensive ? 10 : 0)} ${110 + dx} ${118 + dy}`}
            stroke="#8e1b25"
            strokeWidth={i % 2 ? 2 : 3.2}
            fill="none"
          />
        ))}
        {hypertensive && (
          <>
            {[[60, 70], [150, 80], [80, 160], [165, 150], [130, 55]].map(([x, y], i) => (
              <ellipse key={i} cx={x} cy={y} rx={7 + (i % 3) * 3} ry={5 + (i % 2) * 3} fill="#9d0f1c" opacity={0.85} />
            ))}
            <path d="M120 150 Q165 140 175 185 Q140 200 115 185 Z" fill="#9aa0a6" opacity={0.55} />
          </>
        )}
      </svg>
      <div className="s-seg col">
        {opts.map((o) => (
          <button key={o.id} onClick={() => onDone(hypertensive ? o.id === 'iper' : o.id === 'normale', o.text)}>{o.text}</button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ TC */

type Shape = { kind: 'e'; cx: number; cy: number; rx: number; ry: number; fill: string };

function sliceShapes(i: number, n: number, contrast: boolean, spec: CtSpec): { shapes: Shape[]; lesionR: number } {
  const s: Shape[] = [];
  const e = (cx: number, cy: number, rx: number, ry: number, fill: string) => s.push({ kind: 'e', cx, cy, rx, ry, fill });
  const inR = (a: number, b: number) => i >= a && i <= b;
  e(150, 150, 128, 108, '#3b3b3b'); // grasso sottocutaneo/addominale
  e(150, 150, 120, 100, '#444');
  e(120, 228, 26, 20, '#8a8a8a'); // epassiali
  e(180, 228, 26, 20, '#8a8a8a');
  e(150, 222, 16, 15, '#efefef'); // corpo vertebrale
  e(150, 222, 6, 6, '#777');
  if (inR(0, 13)) e(125, 115, 95 - i * 3, 62 - i * 2.5, contrast ? '#a9a9a9' : '#969696'); // fegato
  if (inR(3, 7)) {
    e(102, 104, 15, 13, '#5a5a5a'); // colecisti
    e(102, 112, 11, 4, '#7b7b7b'); // fango biliare (35 HU)
  }
  if (inR(1, 10)) {
    e(198, 108, 36 - Math.abs(i - 5) * 2, 28, '#7a7a7a'); // stomaco
    e(198, 92, 22, 7, '#060606'); // gas
  }
  if (inR(6, 16)) e(250, 150, 9, 26, contrast ? '#b4b4b4' : '#939393'); // milza
  if (inR(12, 25)) {
    e(98, 200, 22, 15, contrast ? '#cfcfcf' : '#959595'); // rene dx
    if (contrast) e(98, 200, 11, 7, '#9a9a9a');
  }
  if (inR(14, 27)) {
    e(204, 205, 22, 15, contrast ? '#c4c4c4' : '#959595'); // rene sx (corticale meno impregnata)
    if (contrast) e(204, 205, 11, 7, '#9a9a9a');
  }
  if (inR(12, n)) for (let k = 0; k < 6; k++) e(110 + ((k * 37 + i * 11) % 90), 100 + ((k * 23 + i * 7) % 60), 10, 9, k % 2 ? '#808080' : '#6a6a6a'); // anse
  e(163, 197, 8, 8, contrast ? '#ececec' : '#8c8c8c'); // aorta
  e(133, 192, 9, 7, contrast ? '#d9d9d9' : '#8c8c8c'); // vena cava caudale
  if (inR(9, 12)) e(118, 182, 5, 3.5, '#8f8f8f'); // surrene dx normale
  let lesionR = 0;
  const L = spec.lesion;
  if (inR(L.from, L.to)) {
    const mid = (L.from + L.to) / 2;
    lesionR = L.r * Math.sqrt(Math.max(0.15, 1 - Math.pow((i - mid) / ((L.to - L.from) / 2 + 0.6), 2)));
    e(L.cx, L.cy, lesionR, lesionR * 0.85, contrast ? '#a3a3a3' : '#8a8a8a');
    if (contrast && lesionR > 9) {
      e(L.cx - lesionR * 0.3, L.cy - lesionR * 0.15, lesionR * 0.28, lesionR * 0.22, '#575757');
      e(L.cx + lesionR * 0.35, L.cy + lesionR * 0.25, lesionR * 0.2, lesionR * 0.18, '#5c5c5c');
    }
  }
  return { shapes: s, lesionR };
}

export function CtViewer({ spec, onFound }: { spec: CtSpec; onFound: (misses: number) => void }) {
  const [slice, setSlice] = useState(0);
  const [contrast, setContrast] = useState(true);
  const [misses, setMisses] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [found, setFound] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const { shapes, lesionR } = useMemo(() => sliceShapes(slice, spec.slices, contrast, spec), [slice, contrast, spec]);

  const click = (ev: React.MouseEvent) => {
    if (found) return;
    const r = svgRef.current!.getBoundingClientRect();
    const x = ((ev.clientX - r.left) / r.width) * 300;
    const y = ((ev.clientY - r.top) / r.height) * 300;
    const L = spec.lesion;
    if (lesionR > 0 && Math.hypot(x - L.cx, y - L.cy) <= lesionR + 6) {
      setFound(true);
      setMsg(`Trovata! ${L.label}.`);
      onFound(misses);
      return;
    }
    setMisses((m) => m + 1);
    if (Math.hypot(x - (300 - L.cx), y - L.cy) < 25) setMsg('Quello è il lato DESTRO del paziente (a sinistra dello schermo): il surrene destro è nei limiti.');
    else if (Math.hypot(x - 150, y - 222) < 20) setMsg('Corpo vertebrale: osso, non lesioni.');
    else setMsg('Nessuna lesione in questo punto. Scorri le fette vicino ai reni, cranialmente.');
  };

  return (
    <div className="s-game">
      <div className="s-ct-wrap">
        <svg ref={svgRef} viewBox="0 0 300 300" className="s-ct" onClick={click}>
          <defs>
            <filter id="ctnoise">
              <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={slice} />
              <feColorMatrix type="saturate" values="0" />
              <feComponentTransfer>
                <feFuncA type="linear" slope="0.18" />
              </feComponentTransfer>
              <feComposite in2="SourceGraphic" operator="in" />
              <feBlend in="SourceGraphic" mode="multiply" />
            </filter>
          </defs>
          <rect width={300} height={300} fill="#000" />
          <g filter="url(#ctnoise)">
            {shapes.map((sh, k) => (
              <ellipse key={k} cx={sh.cx} cy={sh.cy} rx={sh.rx} ry={sh.ry} fill={sh.fill} />
            ))}
          </g>
          {found && <circle cx={spec.lesion.cx} cy={spec.lesion.cy} r={Math.max(lesionR, 14) + 6} className="ct-mark" />}
          <text x={8} y={16} className="ct-lbl">Fetta {slice + 1}/{spec.slices} · {contrast ? 'post-mdc' : 'pre-mdc'}</text>
          <text x={8} y={152} className="ct-lbl">R</text>
          <text x={284} y={152} className="ct-lbl">L</text>
          <text x={146} y={14} className="ct-lbl">V</text>
        </svg>
      </div>
      <label className="s-slider">
        Craniale ← fetta → caudale
        <input type="range" min={0} max={spec.slices - 1} value={slice} onChange={(e) => setSlice(Number(e.target.value))} />
      </label>
      <div className="s-row">
        <button className={`s-btn ${contrast ? 'on' : ''}`} onClick={() => setContrast((c) => !c)}>
          {contrast ? 'Mostra pre-contrasto' : 'Mostra post-contrasto'}
        </button>
        <span className="s-hint">Tocca la lesione · errori: {misses}</span>
      </div>
      {msg && <p className={`s-feedback ${found ? 'good' : 'bad'}`}>{msg}</p>}
    </div>
  );
}

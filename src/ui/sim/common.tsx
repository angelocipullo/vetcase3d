import { useEffect, useRef, useState } from 'react';
import { EXAMS } from '../../sim/exams';
import { fmtClock, useSim } from '../../sim/store';
import { ResultDoc, Source } from '../../sim/types';

export function SourceBadge({ source }: { source: Source }) {
  const label = source === 'documento' ? 'reale' : source === 'generato' ? 'simulato' : 'misto';
  const title =
    source === 'documento'
      ? 'Dato dalla documentazione reale del caso'
      : source === 'generato'
        ? 'Dato generato in modo coerente con il quadro (assente nei documenti)'
        : 'In parte reale, in parte generato (i valori generati sono marcati con *)';
  return (
    <span className={`s-src ${source}`} title={title}>
      {label}
    </span>
  );
}

export function ResultView({ doc, compact = false }: { doc: ResultDoc; compact?: boolean }) {
  const c = useSim((s) => s.caseDef)!;
  if (doc.refused) {
    return (
      <div className="s-result refused">
        <div className="s-result-head">
          <b>{doc.title}</b>
          <span className="s-tag warn">non eseguito</span>
        </div>
        <p className="s-muted">{doc.refused}</p>
      </div>
    );
  }
  return (
    <div className={`s-result ${compact ? 'compact' : ''}`}>
      <div className="s-result-head">
        <b>{doc.title}</b>
        <SourceBadge source={doc.source} />
        <span className="s-muted s-time">{fmtClock(c, doc.readyAt)}</span>
      </div>
      {doc.rows && (
        <table className="s-lab">
          <tbody>
            {doc.rows.map((r) => (
              <tr key={r.label} className={r.flag ? 'abn' : ''}>
                <td>
                  {r.label}
                  {r.gen && doc.source === 'misto' && <sup title="valore generato">*</sup>}
                </td>
                <td className="num">
                  {typeof r.value === 'number' ? r.value.toLocaleString('it-IT') : r.value} <small>{r.unit}</small>{' '}
                  <b>{r.flag === 'H' ? '↑' : r.flag === 'L' ? '↓' : ''}</b>
                </td>
                <td className="ref">{r.ref}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {doc.text && <p className="s-report">{doc.text}</p>}
      {doc.conclusion &&
        (EXAMS[doc.exam].kind === 'lab' ? (
          // per gli esami di laboratorio l'interpretazione la fa l'utente: la conclusione è nascosta
          <details className="s-concl-acc">
            <summary>Mostra conclusione</summary>
            <p className="s-conclusion">{doc.conclusion}</p>
          </details>
        ) : (
          <p className="s-conclusion">
            <b>Conclusione:</b> {doc.conclusion}
          </p>
        ))}
    </div>
  );
}

/** Conto alla rovescia (secondi reali) per le domande a tempo. */
export function useCountdown(seconds: number | undefined, running: boolean, onEnd: () => void) {
  const [left, setLeft] = useState(seconds ?? 0);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;
  useEffect(() => {
    if (!seconds || !running) return;
    const startedAt = performance.now() - (seconds - left) * 1000;
    const id = setInterval(() => {
      const l = Math.max(0, seconds - (performance.now() - startedAt) / 1000);
      setLeft(l);
      if (l <= 0) {
        clearInterval(id);
        endRef.current();
      }
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, running]);
  return left;
}

export function StageHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <header className="s-stage-head">
      <p className="s-eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {children}
    </header>
  );
}

export function Continue({ onClick, label = 'Continua', disabled }: { onClick: () => void; label?: string; disabled?: boolean }) {
  return (
    <div className="s-continue">
      <button className="s-btn primary" onClick={onClick} disabled={disabled}>
        {label} →
      </button>
    </div>
  );
}

export interface TrendPoint {
  t: number;
  v: number;
}

/** Grafico di andamento minimale in SVG (tempo in minuti sull'asse x). */
export function TrendChart({
  points,
  line,
  band,
  yMin,
  yMax,
  unit,
  t0 = 0,
  t1,
  height = 150,
}: {
  points: TrendPoint[];
  line?: TrendPoint[];
  band?: [number, number];
  yMin: number;
  yMax: number;
  unit: string;
  t0?: number;
  t1?: number;
  height?: number;
}) {
  const W = 320;
  const H = height;
  const pad = { l: 30, r: 8, t: 8, b: 20 };
  const all = [...points, ...(line ?? [])].map((p) => p.t);
  const tEnd = Math.max(t1 ?? 0, ...all, t0 + 60);
  const x = (t: number) => pad.l + ((t - t0) / (tEnd - t0)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (Math.min(yMax, Math.max(yMin, v)) - yMin) / (yMax - yMin)) * (H - pad.t - pad.b);
  const ticks = [yMin, (yMin + yMax) / 2, yMax];
  const hours = (tEnd - t0) / 60;
  const step = hours > 48 ? 24 : hours > 16 ? 8 : hours > 6 ? 2 : 1;
  const xt: number[] = [];
  for (let h = 0; h <= hours; h += step) xt.push(t0 + h * 60);
  return (
    <svg className="s-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Andamento ${unit}`}>
      {band && <rect x={pad.l} width={W - pad.l - pad.r} y={y(band[1])} height={y(band[0]) - y(band[1])} className="band" />}
      {ticks.map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className="grid" />
          <text x={pad.l - 4} y={y(v) + 3} textAnchor="end" className="lbl">
            {Number(v.toFixed(1))}
          </text>
        </g>
      ))}
      {xt.map((t) => (
        <text key={t} x={x(t)} y={H - 5} textAnchor="middle" className="lbl">
          +{Math.round((t - t0) / 60)}h
        </text>
      ))}
      {line && line.length > 1 && <polyline className="truth" points={line.map((p) => `${x(p.t)},${y(p.v)}`).join(' ')} />}
      {points.length > 1 && <polyline className="meas" points={points.map((p) => `${x(p.t)},${y(p.v)}`).join(' ')} />}
      {points.map((p, i) => (
        <circle key={i} cx={x(p.t)} cy={y(p.v)} r={3.5} className="dot" />
      ))}
    </svg>
  );
}

/** Mescola in modo stabile (seme = stringa), così le opzioni non cambiano a ogni render. */
export function stableShuffle<T>(list: T[], seed: string): T[] {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) >>> 0;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

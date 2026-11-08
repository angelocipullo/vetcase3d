import { useEffect, useMemo, useRef, useState } from 'react';
import { Speaker, SpriteSpec } from '../../sim/types';

/* =====================================================================
 * Ritratti in pixel art (18×18) generati da parametri, stile RPG anni '90.
 * Nessun asset esterno: un personaggio nuovo è solo un `SpriteSpec`.
 * ===================================================================== */

const N = 18;
type Grid = string[][];

function blank(): Grid {
  return Array.from({ length: N }, () => Array(N).fill('.'));
}

function rect(g: Grid, x0: number, y0: number, x1: number, y1: number, c: string) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (g[y]?.[x] !== undefined) g[y][x] = c;
}

/** Contorno scuro di 1 px attorno alla figura, come negli sprite classici. */
function outline(g: Grid, skip = 'w'): Grid {
  const o = g.map((r) => [...r]);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      if (g[y][x] !== '.') continue;
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const v = g[y + dy]?.[x + dx];
        return v !== undefined && v !== '.' && v !== skip;
      });
      if (near) o[y][x] = 'k';
    }
  return o;
}

function humanGrid(s: Extract<SpriteSpec, { kind: 'human' }>, talking: boolean): Grid {
  const g = blank();
  if (s.hairStyle === 'long') rect(g, 4, 3, 13, 13, 'h');
  // busto
  if (s.coat) {
    rect(g, 3, 14, 14, 17, 'W');
    rect(g, 4, 13, 13, 13, 'W');
    rect(g, 7, 13, 10, 17, 'c');
    rect(g, 8, 15, 9, 17, 'C');
  } else {
    rect(g, 4, 13, 13, 13, 'c');
    rect(g, 3, 14, 14, 17, 'c');
    rect(g, 8, 13, 9, 14, 's');
  }
  // collo e testa
  rect(g, 8, 12, 9, 12, 's');
  rect(g, 5, 4, 12, 10, 's');
  rect(g, 6, 11, 11, 11, 's');
  // capelli
  if (s.hairStyle !== 'bald') {
    rect(g, 5, 2, 12, 3, 'h');
    rect(g, 4, 3, 13, 4, 'h');
    rect(g, 4, 5, 4, 7, 'h');
    rect(g, 13, 5, 13, 7, 'h');
    rect(g, 6, 5, 7, 5, 'h');
    if (s.hairStyle === 'bun') rect(g, 7, 0, 10, 1, 'h');
    if (s.hairStyle === 'long') {
      rect(g, 3, 5, 4, 12, 'h');
      rect(g, 13, 5, 14, 12, 'h');
    }
  } else {
    rect(g, 4, 6, 4, 8, 'h');
    rect(g, 13, 6, 13, 8, 'h');
  }
  // occhi, occhiali, guance, bocca
  g[7][7] = 'e';
  g[7][10] = 'e';
  if (s.glasses) {
    for (const x of [6, 8, 9, 11]) g[7][x] = 'g';
    g[6][6] = g[6][7] = g[6][8] = 'g';
    g[6][9] = g[6][10] = g[6][11] = 'g';
  }
  g[8][6] = 'b';
  g[8][11] = 'b';
  if (talking) {
    rect(g, 8, 9, 9, 10, 'o');
  } else {
    g[9][8] = g[9][9] = 'm';
  }
  return outline(g);
}

function catGrid(s: Extract<SpriteSpec, { kind: 'cat' }>, talking: boolean): Grid {
  const g = blank();
  // testa (ellisse) e orecchie
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const dx = (x - 8.5) / 6.6;
      const dy = (y - 10.5) / 5.4;
      if (dx * dx + dy * dy <= 1) g[y][x] = 'f';
    }
  for (let y = 2; y <= 6; y++)
    for (let i = 0; i <= y - 2; i++) {
      g[y][3 + i] = 'f';
      g[y][14 - i] = 'f';
    }
  g[5][4] = g[6][4] = g[6][5] = 'p';
  g[5][13] = g[6][13] = g[6][12] = 'p';
  // tigratura
  for (const [x, y] of [[8, 6], [9, 6], [7, 7], [10, 7], [8, 8], [9, 8], [3, 10], [14, 10], [3, 12], [14, 12]]) g[y][x] = 'd';
  // muso chiaro
  rect(g, 6, 11, 11, 14, 'l');
  // occhi
  g[9][5] = g[10][5] = 'y';
  g[9][6] = g[10][6] = 'e';
  g[9][12] = g[10][12] = 'y';
  g[9][11] = g[10][11] = 'e';
  // naso e bocca
  g[11][8] = g[11][9] = 'p';
  if (talking) rect(g, 8, 13, 9, 13, 'o');
  else g[12][8] = g[12][9] = 'k';
  // baffi
  for (const [x, y] of [[0, 11], [1, 11], [0, 13], [1, 12], [16, 12], [17, 11], [16, 11], [17, 13]]) g[y][x] = 'w';
  return outline(g);
}

function paletteFor(s: SpriteSpec): Record<string, string> {
  const base = { k: '#1d1b2c', e: '#1d1b2c', o: '#7a1d24', w: '#e9ecef' };
  if (s.kind === 'human')
    return { ...base, s: s.skin, h: s.hair, c: s.clothes, C: '#343a40', W: '#f8f9fa', g: '#364fc7', b: '#f3a7a0', m: '#9c3b3b' };
  return { ...base, f: s.fur, d: s.dark, l: s.muzzle ?? s.fur, p: '#f783ac', y: s.eyes };
}

export function PixelSprite({ spec, talking = false, size = 120, className = '' }: { spec: SpriteSpec; talking?: boolean; size?: number; className?: string }) {
  const rects = useMemo(() => {
    const g = spec.kind === 'human' ? humanGrid(spec, talking) : catGrid(spec, talking);
    const pal = paletteFor(spec);
    const out: { x: number; y: number; w: number; fill: string }[] = [];
    for (let y = 0; y < N; y++) {
      let x = 0;
      while (x < N) {
        const c = g[y][x];
        if (c === '.') {
          x++;
          continue;
        }
        let w = 1;
        while (x + w < N && g[y][x + w] === c) w++;
        out.push({ x, y, w, fill: pal[c] ?? '#f0f' });
        x += w;
      }
    }
    return out;
  }, [spec, talking]);
  return (
    <svg className={`px-sprite ${className}`} width={size} height={size} viewBox={`0 0 ${N} ${N}`} shapeRendering="crispEdges" aria-hidden>
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
      ))}
    </svg>
  );
}

/* ===================================================================== testo */

/** Testo che compare lettera per lettera; `skip` lo completa subito. */
export function useTypewriter(text: string, cps = 45) {
  const [n, setN] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval>>();
  useEffect(() => {
    setN(0);
    if (!text) return;
    const start = performance.now();
    const id = setInterval(() => {
      const k = Math.min(text.length, Math.floor(((performance.now() - start) / 1000) * cps));
      setN(k);
      if (k >= text.length) clearInterval(id);
    }, 16);
    timer.current = id;
    return () => clearInterval(id);
  }, [text, cps]);
  const done = n >= text.length;
  const skip = () => {
    clearInterval(timer.current);
    setN(text.length);
  };
  return { shown: text.slice(0, n), done, skip };
}

/** Bocca che si apre e chiude mentre il personaggio "parla". */
export function useMouth(active: boolean) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!active) {
      setOpen(false);
      return;
    }
    const id = setInterval(() => setOpen((o) => !o), 110);
    return () => clearInterval(id);
  }, [active]);
  return open;
}

/* ===================================================================== componenti */

export interface Actor {
  id: string;
  speaker: Speaker;
  side: 'left' | 'right';
  small?: boolean;
}

/** Scena: personaggi in piedi sulle loro "piattaforme", chi parla è in primo piano e muove la bocca. */
export function RpgScene({ actors, active, talking }: { actors: Actor[]; active?: string; talking: boolean }) {
  const mouth = useMouth(talking);
  return (
    <div className="rpg-scene">
      {(['left', 'right'] as const).map((side) => (
        <div key={side} className={`rpg-side ${side}`}>
          {actors
            .filter((a) => a.side === side && a.speaker.sprite)
            .map((a) => (
              <div key={a.id} className={`rpg-actor ${a.id === active ? 'active' : ''} ${a.small ? 'small' : ''}`}>
                <PixelSprite spec={a.speaker.sprite!} talking={a.id === active && mouth} size={a.small ? 84 : 128} />
                <div className="rpg-platform" />
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}

/** Finestra di dialogo stile RPG: nome, testo a macchina da scrivere, ▼ quando si può proseguire. */
export function DialogueBox({
  speaker,
  text,
  onNext,
  children,
  tone,
  onTyping,
}: {
  speaker?: Speaker;
  text: string;
  onNext?: () => void;
  children?: React.ReactNode;
  tone?: 'good' | 'mid' | 'bad';
  onTyping?: (typing: boolean) => void;
}) {
  const { shown, done, skip } = useTypewriter(text);
  const cb = useRef(onTyping);
  cb.current = onTyping;
  useEffect(() => cb.current?.(!done), [done]);
  const click = () => {
    if (!done) skip();
    else onNext?.();
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (done && !onNext) return; // lascia Invio ai pulsanti del menu
      if ((e.key === 'Enter' || e.key === ' ') && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        click();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
  return (
    <div className={`rpg-box ${tone ?? ''} ${onNext || !done ? 'clickable' : ''}`} onClick={click} role="dialog" aria-live="polite">
      {speaker?.name && <span className="rpg-name">{speaker.name}</span>}
      <p className="rpg-text">
        {shown}
        <span className="rpg-ghost">{text.slice(shown.length)}</span>
      </p>
      {done && onNext && <span className="rpg-next">▼</span>}
      {done && children}
    </div>
  );
}

/** Menu di scelta con cursore ▶ (le opzioni sono normali pulsanti). */
export function RpgMenu({ children, cols = 1, className = '' }: { children: React.ReactNode; cols?: 1 | 2; className?: string }) {
  return <div className={`rpg-menu cols-${cols} ${className}`}>{children}</div>;
}

/** Riga compatta: ritratto + fumetto (per i consigli del primario nelle fasi "tecniche"). */
export function SpeechBubble({ speaker, text }: { speaker: Speaker; text: string }) {
  const { shown, done, skip } = useTypewriter(text, 60);
  const mouth = useMouth(!done);
  return (
    <div className="rpg-bubble-row" onClick={skip}>
      {speaker.sprite && (
        <div className="rpg-face">
          <PixelSprite spec={speaker.sprite} talking={mouth} size={64} />
        </div>
      )}
      <div className="rpg-bubble">
        <b>{speaker.name}</b>
        <p>
          {shown}
          <span className="rpg-ghost">{text.slice(shown.length)}</span>
        </p>
      </div>
    </div>
  );
}

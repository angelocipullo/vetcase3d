import { useEffect, useRef, useState } from 'react';

/* =====================================================================
 * Scena iniziale in pixel art (stesso stile dei ritratti dei dialoghi):
 * il piccolo ospedale veterinario e il medico che ci entra camminando.
 * Tutto è disegnato in codice: ogni "pixel" è un'unità del viewBox 80×52.
 * ===================================================================== */

const W = 80;
const H = 52;

type Px = [x: number, y: number, w: number, h: number, fill: string];

/** Palette condivisa con gli sprite RPG (contorno #1d1b2c). */
const K = '#1d1b2c';

/** Caratteri pixel 5×7 per la scritta sul tetto. */
const GLYPHS: Record<string, string[]> = {
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '.#.#.', '.#.#.', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
};

function sceneryPixels(doorOpen: boolean): Px[] {
  const p: Px[] = [];
  // cielo a fasce e nuvole
  p.push([0, 0, W, 8, '#8fd3e8'], [0, 8, W, 8, '#a5dcec'], [0, 16, W, 14, '#bce6f1']);
  for (const [x, y] of [[6, 5], [58, 3], [68, 9]] as const) {
    p.push([x + 1, y, 6, 1, '#fff'], [x, y + 1, 9, 2, '#fff'], [x + 2, y + 3, 5, 1, '#e3f4fa']);
  }
  // prato con ciuffi
  p.push([0, 30, W, 22, '#6cc15a'], [0, 30, W, 1, '#4f9e43']);
  for (const [x, y] of [[4, 36], [12, 44], [26, 40], [52, 42], [64, 37], [72, 46], [8, 49], [60, 49]] as const) {
    p.push([x, y, 1, 1, '#4f9e43'], [x + 2, y, 1, 1, '#4f9e43'], [x + 1, y - 1, 1, 1, '#4f9e43']);
  }
  // vialetto di pietra dalla porta al bordo
  p.push([35, 34, 10, 18, '#e2d2a8']);
  for (let y = 36; y < H; y += 4) p.push([35, y, 10, 1, '#cbb98c'], [39 + ((y / 4) % 2) * 2, y - 2, 1, 2, '#cbb98c']);
  // ombra dell'edificio
  p.push([19, 34, 43, 1, '#4f9e43']);
  // tetto a gradini
  p.push([17, 11, 46, 2, '#b8433f'], [19, 9, 42, 2, '#c95450'], [22, 7, 36, 2, '#d8635d'], [26, 5, 28, 2, '#e07a73']);
  p.push([17, 13, 46, 1, '#7d2b28']);
  // scritta OVUD sul tetto: lettere pixel 5×7 in grassetto (6 px), blu con ombra scura
  const word = 'OVUD';
  const x0 = Math.floor((W - (word.length * 7 - 1)) / 2);
  const lit: [number, number][] = [];
  [...word].forEach((ch, i) => {
    GLYPHS[ch].forEach((row, ry) => {
      for (let rx = 0; rx < 5; rx++) {
        if (row[rx] === '#') lit.push([x0 + i * 7 + rx, 5 + ry]);
      }
    });
  });
  for (const [x, y] of lit) p.push([x + 1, y + 1, 2, 1, '#16306b']);
  for (const [x, y] of lit) p.push([x, y, 2, 1, '#2f7bf0']);
  // facciata
  p.push([20, 14, 40, 20, '#f3e8d2'], [20, 31, 40, 3, '#d9c7a3'], [20, 14, 40, 1, '#e5d6b8']);
  // insegna con croce
  p.push([33, 15, 14, 7, '#1d8a6e'], [33, 15, 14, 1, '#25a383'], [39, 16, 2, 5, '#fff'], [37, 17, 6, 3, '#fff'], [38, 18, 4, 1, '#fff']);
  p.push([39, 17, 2, 3, '#fff']);
  // finestre (cornice, vetro, riflesso)
  for (const x of [23, 50]) {
    p.push([x - 1, 18, 9, 9, '#6b5a44'], [x, 19, 7, 7, '#bfe6f5'], [x + 3, 19, 1, 7, '#6b5a44'], [x, 22, 7, 1, '#6b5a44'], [x + 1, 20, 1, 1, '#fff'], [x - 1, 27, 9, 1, '#a08a66']);
  }
  // porta
  p.push([35, 23, 10, 11, '#6b5a44']);
  if (doorOpen) {
    p.push([36, 24, 8, 10, '#2b2118'], [36, 24, 8, 1, '#3d3024'], [36, 24, 2, 10, '#a26a35']);
  } else {
    p.push([36, 24, 8, 10, '#a26a35'], [40, 24, 1, 10, '#7e4f24'], [37, 25, 2, 3, '#c98a4b'], [42, 25, 1, 3, '#c98a4b'], [42, 29, 1, 1, '#f1c40f']);
  }
  p.push([34, 34, 12, 1, '#b9a57a']);
  // cespugli e alberelli ai lati
  for (const [x, y] of [[10, 26], [64, 25]] as const) {
    p.push([x + 2, y, 6, 2, '#3f8f3a'], [x, y + 2, 10, 5, '#3f8f3a'], [x + 1, y + 7, 8, 1, '#2f6e2b'], [x + 2, y + 1, 2, 1, '#5cb85c'], [x + 1, y + 3, 2, 1, '#5cb85c'], [x + 4, y + 8, 2, 3, '#7a5230']);
  }
  p.push([22, 31, 4, 3, '#3f8f3a'], [54, 31, 4, 3, '#3f8f3a'], [23, 31, 1, 1, '#5cb85c'], [55, 31, 1, 1, '#5cb85c']);
  return p;
}

/** Medico visto di spalle (7×10), due fotogrammi di camminata: capelli biondi rasati, camice bianco. */
const WALK_FRAMES: string[][] = [
  ['..hhh..', '.sssss.', '.sssss.', '..sss..', 'WWWWWWW', 'wWWWWWw', 'sWWWWWs', '.WWWWW.', '.pp.pp.', '.bb....'],
  ['..hhh..', '.sssss.', '.sssss.', '..sss..', 'WWWWWWW', 'wWWWWWw', 'sWWWWWs', '.WWWWW.', '.pp.pp.', '....bb.'],
];
const PLAYER_PAL: Record<string, string> = { h: '#c49a4a', s: '#f3d2b3', W: '#f8f9fa', w: '#ced4da', p: '#343a40', b: K };

function Walker({ x, y, frame, opacity }: { x: number; y: number; frame: number; opacity: number }) {
  const rows = WALK_FRAMES[frame % 2];
  const rects: Px[] = [];
  rows.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) {
      const c = row[rx];
      if (c !== '.') rects.push([x + rx, y + ry, 1, 1, PLAYER_PAL[c]]);
    }
  });
  return (
    <g opacity={opacity}>
      <rect x={x + 1} y={y + 10} width={5} height={1} fill="rgba(0,0,0,0.18)" />
      {rects.map(([rx, ry, w, h, f], i) => (
        <rect key={i} x={rx} y={ry} width={w} height={h} fill={f} />
      ))}
    </g>
  );
}

const START_Y = 40;
const DOOR_Y = 24; // il medico sparisce oltre la soglia
const SPEED = 13; // pixel di scena al secondo

/**
 * Scena dell'ospedale. Con `walking` il medico sale il vialetto, la porta si apre e lui entra;
 * a fine animazione chiama `onEntered`.
 */
export function ClinicScene({ walking, onEntered }: { walking: boolean; onEntered: () => void }) {
  const [pos, setPos] = useState(START_Y);
  const [frame, setFrame] = useState(0);
  const [fade, setFade] = useState(1);
  const done = useRef(false);
  const cb = useRef(onEntered);
  cb.current = onEntered;

  useEffect(() => {
    if (!walking) return;
    let raf = 0;
    let t0 = 0;
    const tick = (t: number) => {
      if (!t0) t0 = t;
      const s = (t - t0) / 1000;
      const y = START_Y - s * SPEED;
      if (y > DOOR_Y + 2) {
        setPos(Math.round(y));
        setFrame(Math.floor(s / 0.16));
      } else {
        // sulla soglia: il medico svanisce nella porta, poi si passa all'interno
        const f = Math.max(0, 1 - (DOOR_Y + 2 - y) / 3);
        setPos(Math.round(Math.max(y, DOOR_Y)));
        setFrame(Math.floor(s / 0.16));
        setFade(f);
        if (f <= 0 && !done.current) {
          done.current = true;
          cb.current();
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [walking]);

  const doorOpen = walking && pos <= DOOR_Y + 8;
  return (
    <svg className="title-scene" viewBox={`0 0 ${W} ${H}`} shapeRendering="crispEdges" role="img" aria-label="Il piccolo ospedale veterinario">
      {sceneryPixels(doorOpen).map(([x, y, w, h, f], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} fill={f} />
      ))}
      <Walker x={37} y={pos} frame={walking ? frame : 0} opacity={fade} />
    </svg>
  );
}

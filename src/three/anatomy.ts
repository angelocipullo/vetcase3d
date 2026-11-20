import { CatmullRomCurve3, Vector3 } from 'three';

/**
 * Coordinate anatomiche del paziente sul tavolo (spazio mondo, in piedi, muso verso +X,
 * fianco SINISTRO verso la camera (+Z)).
 *
 * Gli oggetti esportati (ZONES, FRONT_LEFT_LEG, VEIN_CURVE, CAMERA_VIEWS) sono quelli della specie
 * corrente: `setSpecies()` li riscrive sul posto quando si apre una visita, così i componenti 3D
 * li leggono senza sapere quale animale c'è sul tavolo.
 *
 * Cane: calibrato sulla mesh VISIBILE del modello glTF nella posa Idle (in sviluppo `window.__dogSkin()`
 * restituisce centro/estremi dei vertici deformati per osso). Gatto: modello cartoon costruito in codice
 * (Cat.tsx), i punti seguono le sue forme.
 */

export type Species = 'cane' | 'gatto';

/** Posizionamento del modello glTF del cane nella scena (vedi Dog.tsx). */
export const DOG_TRANSFORM = { scale: 0.65, offsetX: -0.35 };

export type CameraView = 'default' | 'syringe' | 'thermometer' | 'femoral' | 'resp';
type View = { pos: Vector3; target: Vector3 };
/** Avambraccio anteriore sinistro (tra gomito e carpo): centro, raggio, lunghezza; `cuffY` = altezza del laccio. */
type Leg = { x: number; z: number; radius: number; length: number; y: number; cuffY: number };

interface Anatomy {
  zones: Record<'heart' | 'lungs' | 'rectal' | 'femoral', Vector3>;
  leg: Leg;
  /** Vena cefalica dall'alto in basso, appena sopra la faccia craniale (+X) dell'avambraccio. */
  vein: [number, number, number][];
  views: Record<CameraView, View>;
}

const v = (x: number, y: number, z: number) => new Vector3(x, y, z);
const view = (p: [number, number, number], t: [number, number, number]): View => ({ pos: v(...p), target: v(...t) });

const ANATOMY: Record<Species, Anatomy> = {
  cane: {
    zones: {
      // cuore: emitorace sinistro, terzo inferiore del torace subito dietro il gomito
      heart: v(0.22, 0.9, 0.25),
      // polmoni: campo polmonare caudo-dorsale al cuore
      lungs: v(-0.05, 1.1, 0.25),
      rectal: v(-0.95, 1.16, 0),
      // arteria femorale: faccia mediale della coscia posteriore sinistra, vicino all'inguine
      femoral: v(-0.8, 0.78, 0.25),
    },
    // misurato sulla mesh nella posa fissa del prelievo (Idle a t=0, window.__dogSlice):
    // sezione ~0,15 × 0,12 m, faccia craniale x 0,373–0,389
    leg: { x: 0.311, z: 0.185, radius: 0.07, length: 0.2, y: 0.355, cuffY: 0.47 },
    vein: [
      [0.393, 0.46, 0.19],
      [0.386, 0.4, 0.19],
      [0.378, 0.32, 0.188],
      [0.381, 0.25, 0.186],
    ],
    views: {
      default: view([0.15, 1.5, 4.5], [0, 0.95, 0]),
      syringe: view([1.0, 0.55, 1.0], [0.33, 0.36, 0.19]),
      thermometer: view([-2.05, 1.3, 1.05], [-0.95, 1.1, 0]),
      femoral: view([-0.5, 0.98, 1.15], [-0.8, 0.76, 0.22]),
      resp: view([-0.05, 1.35, 2.7], [-0.05, 1.05, 0.1]),
    },
  },
  gatto: {
    zones: {
      heart: v(0.24, 0.5, 0.23),
      lungs: v(0.02, 0.66, 0.24),
      rectal: v(-0.56, 0.6, 0),
      femoral: v(-0.3, 0.44, 0.19),
    },
    // avambraccio anteriore sinistro del gatto (Cat.tsx): da (0,30; 0,40) r 0,052 a (0,31; 0,08) r 0,042, z 0,13
    leg: { x: 0.304, z: 0.13, radius: 0.05, length: 0.22, y: 0.25, cuffY: 0.37 },
    vein: [
      [0.356, 0.36, 0.13],
      [0.355, 0.29, 0.13],
      [0.354, 0.21, 0.13],
      [0.353, 0.14, 0.13],
    ],
    views: {
      default: view([0.1, 1.15, 3.3], [0.05, 0.6, 0]),
      syringe: view([0.95, 0.45, 0.95], [0.3, 0.27, 0.13]),
      thermometer: view([-1.55, 0.95, 0.95], [-0.55, 0.6, 0]),
      femoral: view([-0.05, 0.7, 1.05], [-0.3, 0.44, 0.16]),
      resp: view([0.05, 0.95, 2.1], [0.05, 0.62, 0.1]),
    },
  },
};

/* oggetti "vivi" della specie corrente (riscritti da setSpecies) */
export const ZONES = {
  heart: new Vector3(),
  lungs: new Vector3(),
  rectal: new Vector3(),
  femoral: new Vector3(),
};

/** Avambraccio anteriore sinistro della specie corrente (collider del prelievo, laccio). */
export const FRONT_LEFT_LEG: Leg = { x: 0, z: 0, radius: 0, length: 0, y: 0, cuffY: 0 };

/** Vena cefalica della specie corrente. */
export const VEIN_CURVE = new CatmullRomCurve3([new Vector3(), new Vector3(), new Vector3(), new Vector3()]);
let VEIN_SAMPLES: Vector3[] = [];

export const CAMERA_VIEWS = {
  default: { pos: new Vector3(), target: new Vector3() },
  syringe: { pos: new Vector3(), target: new Vector3() },
  thermometer: { pos: new Vector3(), target: new Vector3() },
  femoral: { pos: new Vector3(), target: new Vector3() },
  resp: { pos: new Vector3(), target: new Vector3() },
} as Record<CameraView, View>;

let current: Species | null = null;

/** Imposta la specie del paziente sul tavolo (prima di montare la scena 3D). */
export function setSpecies(s: Species) {
  if (s === current) return;
  current = s;
  const a = ANATOMY[s];
  for (const k of Object.keys(ZONES) as (keyof typeof ZONES)[]) ZONES[k].copy(a.zones[k]);
  Object.assign(FRONT_LEFT_LEG, a.leg);
  VEIN_CURVE.points.forEach((p, i) => p.set(...a.vein[i]));
  VEIN_SAMPLES = VEIN_CURVE.getSpacedPoints(80);
  for (const k of Object.keys(CAMERA_VIEWS) as CameraView[]) {
    CAMERA_VIEWS[k].pos.copy(a.views[k].pos);
    CAMERA_VIEWS[k].target.copy(a.views[k].target);
  }
}

export function distanceToVein(p: Vector3): number {
  let min = Infinity;
  for (const s of VEIN_SAMPLES) min = Math.min(min, s.distanceTo(p));
  return min;
}

export function currentSpecies(): Species {
  return current ?? 'cane';
}

setSpecies('cane');

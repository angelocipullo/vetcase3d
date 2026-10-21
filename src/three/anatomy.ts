import { CatmullRomCurve3, Vector3 } from 'three';

/**
 * Coordinate anatomiche del cane (spazio mondo, cane in piedi sul tavolo, muso verso +X,
 * fianco SINISTRO verso la camera (+Z)). Calibrate sulla mesh VISIBILE del modello glTF nella posa
 * Idle: in sviluppo `window.__dogSkin()` restituisce centro/estremi dei vertici deformati per osso.
 * Le ossa (`window.__dogBones()`) non coincidono con la mesh in questo modello: non usarle per calibrare.
 * Se cambi modello o `DOG_TRANSFORM`, riallinea questi punti.
 */

/** Posizionamento del modello glTF del cane nella scena (vedi Dog.tsx). */
export const DOG_TRANSFORM = { scale: 0.65, offsetX: -0.35 };

export const ZONES = {
  // cuore: emitorace sinistro, terzo inferiore del torace subito dietro il gomito
  heart: new Vector3(0.22, 0.9, 0.25),
  // polmoni: campo polmonare caudo-dorsale al cuore
  lungs: new Vector3(-0.05, 1.1, 0.25),
  rectal: new Vector3(-0.95, 1.16, 0),
};

/** Avambraccio anteriore sinistro (tra gomito e carpo): collider del prelievo. */
export const FRONT_LEFT_LEG = { x: 0.32, z: 0.19, radius: 0.065, length: 0.36, y: 0.38 };

/** Vena cefalica: corre sulla faccia craniale (+X) dell'avambraccio anteriore sinistro. */
const L = FRONT_LEFT_LEG;
const veinX = L.x + L.radius * 0.97;
export const VEIN_CURVE = new CatmullRomCurve3([
  new Vector3(veinX, L.y + L.length * 0.55, L.z + 0.004),
  new Vector3(veinX + 0.002, L.y + L.length * 0.2, L.z + 0.006),
  new Vector3(veinX + 0.001, L.y - L.length * 0.2, L.z + 0.002),
  new Vector3(veinX - 0.002, L.y - L.length * 0.55, L.z - 0.002),
]);

const VEIN_SAMPLES = VEIN_CURVE.getSpacedPoints(80);

export function distanceToVein(p: Vector3): number {
  let min = Infinity;
  for (const v of VEIN_SAMPLES) min = Math.min(min, v.distanceTo(p));
  return min;
}

export type CameraView = 'default' | 'syringe' | 'thermometer';

export const CAMERA_VIEWS: Record<CameraView, { pos: Vector3; target: Vector3 }> = {
  default: { pos: new Vector3(0.15, 1.5, 4.5), target: new Vector3(0, 0.95, 0) },
  syringe: { pos: new Vector3(1.0, 0.5, 1.0), target: new Vector3(0.32, 0.3, 0.19) },
  thermometer: { pos: new Vector3(-2.05, 1.3, 1.05), target: new Vector3(-0.95, 1.1, 0) },
};

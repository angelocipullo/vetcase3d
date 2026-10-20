import { CatmullRomCurve3, Vector3 } from 'three';

/**
 * Coordinate anatomiche del cane (spazio mondo, cane in piedi sul tavolo, muso verso +X,
 * fianco SINISTRO verso la camera (+Z)). Se sostituisci il cane procedurale con un .glb
 * (es. generato con Higgsfield), ti basta riallineare questi punti al nuovo modello.
 */
export const ZONES = {
  heart: new Vector3(0.3, 0.7, 0.36),
  lungs: new Vector3(0.02, 0.98, 0.36),
  rectal: new Vector3(-0.8, 0.9, 0),
};

export const FRONT_LEFT_LEG = { x: 0.38, z: 0.2, radius: 0.085, length: 0.4, y: 0.36 };

/** Vena cefalica: corre sulla faccia craniale dell'avambraccio anteriore sinistro. */
export const VEIN_CURVE = new CatmullRomCurve3([
  new Vector3(0.463, 0.6, 0.2),
  new Vector3(0.467, 0.47, 0.206),
  new Vector3(0.466, 0.33, 0.201),
  new Vector3(0.46, 0.2, 0.196),
]);

const VEIN_SAMPLES = VEIN_CURVE.getSpacedPoints(80);

export function distanceToVein(p: Vector3): number {
  let min = Infinity;
  for (const v of VEIN_SAMPLES) min = Math.min(min, v.distanceTo(p));
  return min;
}

export type CameraView = 'default' | 'syringe' | 'thermometer';

export const CAMERA_VIEWS: Record<CameraView, { pos: Vector3; target: Vector3 }> = {
  default: { pos: new Vector3(0.25, 1.35, 3.7), target: new Vector3(0.1, 0.8, 0) },
  syringe: { pos: new Vector3(1.05, 0.48, 0.78), target: new Vector3(0.44, 0.38, 0.2) },
  thermometer: { pos: new Vector3(-1.9, 1.25, 1.7), target: new Vector3(-0.65, 0.88, 0) },
};

import { useEnvironment, useGLTF } from '@react-three/drei';
import { CLINIC_HDRI, preloadClinic } from './Clinic';
import { DOG_URL } from './Dog';

let started = false;

/**
 * Scarica e decodifica in anticipo tutte le risorse della scena 3D (cane, arredi, texture, HDRI),
 * con le stesse chiavi di cache di `useGLTF`/`useTexture`/`Environment`: all'avvio della visita
 * la scena le trova già pronte. L'avanzamento si legge con `useProgress` di drei.
 */
export function preloadScene() {
  if (started) return;
  started = true;
  useGLTF.preload(DOG_URL);
  preloadClinic();
  useEnvironment.preload({ files: CLINIC_HDRI });
}

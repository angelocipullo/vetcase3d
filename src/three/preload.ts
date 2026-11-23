import { useEnvironment, useGLTF } from '@react-three/drei';
import { preload } from 'suspend-react';
import { CLINIC_HDRI, preloadClinic, preloadLocalImages } from './Clinic';
import { CAT_URL, catModelAvailable } from './CatModel';
import { HAND_URL, handModelAvailable } from './HandModel';
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
  preloadLocalImages();
  // gatto e mano glTF: si sa subito se ci sono e si scaricano in anticipo
  preload(catModelAvailable, ['cat-glb']);
  preload(handModelAvailable, ['hand-glb']);
  void catModelAvailable().then((ok) => ok && useGLTF.preload(CAT_URL));
  void handModelAvailable().then((ok) => ok && useGLTF.preload(HAND_URL));
}

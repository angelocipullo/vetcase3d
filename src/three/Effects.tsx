import { EffectComposer, N8AO, SMAA, Vignette } from '@react-three/postprocessing';

/** Ambient occlusion in screen space: dà profondità a angoli, arredi e al cane sul tavolo. */
export function Effects() {
  return (
    <EffectComposer multisampling={0}>
      <N8AO halfRes aoRadius={0.6} intensity={2.2} distanceFalloff={0.6} />
      <SMAA />
      <Vignette offset={0.3} darkness={0.35} />
    </EffectComposer>
  );
}

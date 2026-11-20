import { Canvas } from '@react-three/fiber';
import { Suspense, useEffect } from 'react';
import { audio } from './audio/engine';
import { Scene } from './three/Scene';
import { CAMERA_VIEWS } from './three/anatomy';
import { useGame } from './store';
import { ExamHUD } from './ui/ExamHUD';
import { ResultScreen, TitleScreen } from './ui/Screens';
import { SimScreen } from './ui/sim/SimScreen';

export default function App() {
  const screen = useGame((s) => s.screen);
  const caseId = useGame((s) => s.caseId);
  const sceneReady = useGame((s) => s.sceneReady);
  const cam = CAMERA_VIEWS.default.pos;

  // blip 8-bit su ogni pulsante: tono "selezione" per risposte, domande e voci di elenco, "conferma" per gli altri
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const b = (e.target as Element | null)?.closest?.('button');
      if (!b || b.disabled) return;
      const select = !!b.closest('.rpg-menu, .lobby-list, .cc-nav, .cc-filter, .s-askgrid, .s-options, .s-orders, .s-chips');
      audio.click(select ? 'select' : 'confirm');
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, []);
  return (
    <div className="app">
      {screen === 'exam' && (
        <>
          <Canvas
            key={caseId}
            shadows
            dpr={[1, 2]}
            frameloop={sceneReady ? 'always' : 'never'}
            camera={{ position: [cam.x, cam.y, cam.z], fov: 40, near: 0.05, far: 50 }}
            className="canvas"
          >
            <Suspense fallback={null}>
              <Scene />
            </Suspense>
          </Canvas>
          <ExamHUD />
        </>
      )}
      {screen === 'title' && <TitleScreen />}
      {screen === 'result' && <ResultScreen />}
      {screen === 'sim' && <SimScreen />}
    </div>
  );
}

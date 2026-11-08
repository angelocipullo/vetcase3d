import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
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

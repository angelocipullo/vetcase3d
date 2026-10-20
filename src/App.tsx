import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import { Scene } from './three/Scene';
import { CAMERA_VIEWS } from './three/anatomy';
import { useGame } from './store';
import { ExamHUD } from './ui/ExamHUD';
import { MenuScreen, ResultScreen } from './ui/Screens';

export default function App() {
  const screen = useGame((s) => s.screen);
  const caseId = useGame((s) => s.caseId);
  const cam = CAMERA_VIEWS.default.pos;
  return (
    <div className="app">
      {screen === 'exam' && (
        <>
          <Canvas
            key={caseId}
            shadows
            dpr={[1, 2]}
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
      {screen === 'menu' && <MenuScreen />}
      {screen === 'result' && <ResultScreen />}
    </div>
  );
}

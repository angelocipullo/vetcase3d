import { AdaptiveDpr, ContactShadows, Environment, OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { audio } from '../audio/engine';
import { HeartSound, LungSound, SyringePhase, TechniqueError, Tool, Vitals } from '../game/types';
import { cameraViewFor, expectedHeart, useGame } from '../store';
import { CAMERA_VIEWS, THERMO_DEPTH, ZONES, distanceToVein } from './anatomy';
import { PrelievoKit, PulseFingers } from './Instruments';
import { CLINIC_HDRI, Clinic } from './Clinic';
import { Cat } from './Cat';
import { CatModel } from './CatModel';
import { Dog, dogBark } from './Dog';
import { Effects } from './Effects';

/** Stato del puntatore condiviso a 60fps senza passare da React. */
const pointer = {
  over: false,
  down: false,
  point: new THREE.Vector3(),
  normal: new THREE.Vector3(0, 0, 1),
};

function CameraRig() {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, size } = useThree();
  const aspect = size.width / size.height;
  // su schermi verticali (telefono) allontana la camera e alza il soggetto sopra i pannelli
  const fit = Math.max(1, 0.95 / aspect);
  const portrait = aspect < 1;
  const tool = useGame((s) => s.tool);
  const thermoActive = useGame((s) => s.thermo.active);
  const placed = useGame((s) => s.placed);
  const view = cameraViewFor(tool, thermoActive, placed);
  const moving = useRef(true);

  const goal = useMemo(() => {
    const v = CAMERA_VIEWS[view];
    const k = view === 'default' ? fit : 1 + (fit - 1) * 0.45;
    const target = v.target.clone();
    // sul telefono il soggetto sale sopra i pannelli; il gatto è più basso del cane
    const cat = useGame.getState().visit?.patient.species === 'gatto';
    if (portrait) target.y -= (view === 'default' ? 0.55 : 0.3) * (cat ? 0.45 : 1);
    const pos = target.clone().add(v.pos.clone().sub(v.target).multiplyScalar(k));
    return { pos, target };
  }, [view, fit, portrait]);

  useEffect(() => {
    moving.current = true;
  }, [goal]);

  // Desktop: il dock strumenti (sx) e la colonna dei pannelli (dx) occupano spazio diverso,
  // quindi spostiamo l'inquadratura per centrare il cane nell'area libera (vedi styles.css).
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    if (size.width >= 900 && size.height >= 540) {
      const left = 20 + 96;
      const right = 20 + 380;
      cam.setViewOffset(size.width, size.height, (right - left) / 2, 0, size.width, size.height);
    } else {
      cam.clearViewOffset();
    }
  }, [camera, size.width, size.height]);


  useFrame((_, dt) => {
    const c = controls.current;
    if (!c || !moving.current) return;
    const target = goal;
    const k = 1 - Math.exp(-dt * 4);
    camera.position.lerp(target.pos, k);
    c.target.lerp(target.target, k);
    c.update();
    if (camera.position.distanceTo(target.pos) < 0.01 && c.target.distanceTo(target.target) < 0.01) moving.current = false;
  });

  const orbit = view === 'default' && tool === Tool.Hand;
  return (
    <OrbitControls
      ref={controls}
      enabled={orbit}
      enablePan={false}
      minDistance={orbit ? 2 : 0.2}
      maxDistance={5.5 * fit}
      minPolarAngle={0.6}
      maxPolarAngle={1.55}
      onStart={() => (moving.current = false)}
      // mentre si gira la visuale la risoluzione scende un attimo (AdaptiveDpr), poi torna nitida
      regress
    />
  );
}

function ZoneMarkers() {
  const guided = useGame((s) => s.guided);
  const tool = useGame((s) => s.tool);
  const placed = useGame((s) => s.placed);
  const thermoActive = useGame((s) => s.thermo.active);
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      const s = 1 + Math.sin(clock.elapsedTime * 4) * 0.12;
      ref.current.children.forEach((c) => c.scale.setScalar(s));
    }
  });
  if (!guided) return null;
  const items: { p: THREE.Vector3; color: string; rotY?: number }[] = [];
  if (tool === Tool.Stethoscope) {
    items.push({ p: ZONES.heart, color: '#ff5d73' }, { p: ZONES.lungs, color: '#4dabf7' });
  }
  if (tool === Tool.Thermometer && !thermoActive) items.push({ p: ZONES.rectal, color: '#ffa94d', rotY: Math.PI / 2 });
  if (tool === Tool.Pulse && !placed) items.push({ p: ZONES.femoral, color: '#ff8787' });
  return (
    <group ref={ref}>
      {items.map((it, i) => (
        <mesh key={i} position={[it.p.x, it.p.y, it.p.z + 0.02]} rotation={[0, it.rotY ?? 0, 0]}>
          <ringGeometry args={[0.07, 0.09, 32]} />
          <meshBasicMaterial color={it.color} transparent opacity={0.85} depthTest={false} />
        </mesh>
      ))}
    </group>
  );
}

function StethoscopeHead() {
  const ref = useRef<THREE.Group>(null);
  const tool = useGame((s) => s.tool);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    g.visible = tool === Tool.Stethoscope && pointer.over;
    if (!g.visible) return;
    g.position.copy(pointer.point).addScaledVector(pointer.normal, 0.012);
    q.setFromUnitVectors(up, pointer.normal);
    g.quaternion.slerp(q, 0.5);
  });
  return (
    <group ref={ref}>
      <mesh>
        <cylinderGeometry args={[0.06, 0.06, 0.02, 32]} />
        <meshStandardMaterial color="#d0d6dc" metalness={0.8} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0.011, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.05, 32]} />
        <meshStandardMaterial color="#343a40" />
      </mesh>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.1, 8]} />
        <meshStandardMaterial color="#343a40" />
      </mesh>
    </group>
  );
}

/** Termometro digitale: l'asse +X locale entra nel retto; scorre dentro/fuori e mostra la lettura. */
function Thermometer3D() {
  const active = useGame((s) => s.tool === Tool.Thermometer && s.thermo.active);
  const target = useGame((s) => s.visit?.truth.temp ?? 38.5);
  const group = useRef<THREE.Group>(null);
  const depth = useRef(0);
  const lastText = useRef('');
  const lcd = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 64;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return { canvas, tex };
  }, []);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const t = useGame.getState().thermo;
    depth.current = THREE.MathUtils.damp(depth.current, t.inserted ? 1 : 0, t.inserted ? 3 : 8, dt);
    // a riposo la punta tocca la cute; inserito entra della corsa prevista per la specie
    g.position.copy(ZONES.rectal).addScaledVector(THERMO_AXIS, THERMO_DEPTH.rest + THERMO_DEPTH.travel * depth.current);
    const shown = t.progress > 0 ? (35.5 + (target - 35.5) * (1 - Math.pow(1 - t.progress, 3))).toFixed(1) : '--.-';
    if (shown !== lastText.current) {
      lastText.current = shown;
      const ctx = lcd.canvas.getContext('2d')!;
      ctx.fillStyle = '#b9c9a3';
      ctx.fillRect(0, 0, 160, 64);
      ctx.fillStyle = '#1f2a1a';
      ctx.font = 'bold 40px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${shown}°`, 80, 47);
      lcd.tex.needsUpdate = true;
    }
  });

  if (!active) return null;
  return (
    <group ref={group} quaternion={THERMO_QUAT}>
      {/* sonda metallica */}
      <mesh position={[-0.035, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.006, 0.008, 0.07, 16]} />
        <meshStandardMaterial color="#cfd4d9" metalness={1} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.006, 12, 8]} />
        <meshStandardMaterial color="#cfd4d9" metalness={1} roughness={0.25} />
      </mesh>
      {/* corpo in plastica */}
      <mesh position={[-0.17, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <capsuleGeometry args={[0.017, 0.19, 6, 16]} />
        <meshStandardMaterial color="#f4f6f8" roughness={0.35} />
      </mesh>
      <mesh position={[-0.075, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.012, 0.017, 0.02, 16]} />
        <meshStandardMaterial color="#4dabf7" roughness={0.4} />
      </mesh>
      {/* display e pulsante, sul lato rivolto alla camera */}
      <mesh position={[-0.18, 0, 0.0172]}>
        <planeGeometry args={[0.06, 0.024]} />
        <meshBasicMaterial map={lcd.tex} toneMapped={false} />
      </mesh>
      <mesh position={[-0.23, 0, 0.016]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.006, 0.006, 0.004, 12]} />
        <meshStandardMaterial color="#868e96" roughness={0.5} />
      </mesh>
    </group>
  );
}

/** Asse del retto (verso cui entra il termometro): craniale, un po' in basso e verso il piano mediano. */
const THERMO_AXIS = new THREE.Vector3(1, -0.22, -0.32).normalize();
const THERMO_QUAT = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), THERMO_AXIS);

/**
 * Compila in background (KHR_parallel_shader_compile) tutti i materiali della scena prima del primo
 * frame: senza, il primo render blocca il thread principale per qualche secondo. Il Canvas parte con
 * frameloop "never" e viene avviato quando la compilazione è finita.
 */
function ShaderWarmup() {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    if (useGame.getState().sceneReady) return;
    let cancelled = false;
    const done = () => !cancelled && useGame.getState().setSceneReady();
    // un frame di margine perché tutti i figli (anche quelli in Suspense) siano montati
    const id = requestAnimationFrame(() => {
      gl.compileAsync(scene, camera).then(done, done);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [gl, scene, camera]);
  return null;
}

/** Logica di frame: decadimento stress e accumulo tempo di auscultazione. */
function GameLoop() {
  const last = useRef({ stress: 0 });
  useFrame((_, dt) => {
    const g = useGame.getState();
    if (!g.visit) return;
    if (g.stress > 0 && g.tool !== Tool.Syringe) g.addStress(-dt * 1.2);
    if (last.current.stress < 75 && g.stress >= 75) complain();
    last.current.stress = g.stress;

    if (g.tool === Tool.Stethoscope && pointer.down && pointer.over) {
      const dh = pointer.point.distanceTo(ZONES.heart);
      const dl = pointer.point.distanceTo(ZONES.lungs);
      const gh = Math.pow(THREE.MathUtils.clamp(1 - dh / 0.32, 0, 1), 1.3);
      const gl = THREE.MathUtils.clamp(1 - dl / 0.42, 0, 1);
      // il cuore si sente lievemente su tutto il torace
      audio.setGains(Math.max(gh, gl * 0.18), gl);
      // ascolto che conta per il reperto: stetoscopio vicino al focolaio
      const ms = dt * 1000;
      g.listen(gh > 0.35 ? ms : 0, gl > 0.35 ? ms : 0);
    } else if (g.tool === Tool.Stethoscope && pointer.down) {
      audio.setGains(0, 0);
    }
  });
  return null;
}

/** Lamento quando il paziente è stressato o sente dolore: miagolio lamentoso nel gatto, guaito nel cane. */
function complain() {
  if (useGame.getState().visit?.patient.species === 'gatto') audio.meow(true);
  else audio.whine();
}

/** Suoni di auscultazione coerenti con il caso (FC e FR reali del paziente). */
function vitalsForAudio(): Vitals {
  const t = useGame.getState().visit!.truth;
  const heartSound = expectedHeart(t);
  return { heartRate: t.hr, heartSound, respRate: t.rr, lungSound: LungSound.Normal, temperature: t.temp };
}

/**
 * Ombre della luce principale: la stanza è ferma e la luce pure, si muove solo il paziente (respiro, coda);
 * la mappa d'ombra si ricalcola un fotogramma su tre invece che a ogni fotogramma.
 */
function ShadowThrottle() {
  const gl = useThree((s) => s.gl);
  const frame = useRef(0);
  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    return () => {
      gl.shadowMap.autoUpdate = true;
    };
  }, [gl]);
  useFrame(() => {
    if (frame.current++ % 3 === 0) gl.shadowMap.needsUpdate = true;
  });
  return null;
}

/**
 * Misura i fotogrammi nei primi secondi di visita (dopo un attimo di assestamento): sotto i 45 al secondo
 * chiama `onSlow` una volta sola.
 */
function FpsGuard({ onSlow }: { onSlow: () => void }) {
  const st = useRef({ t: 0, n: 0, done: false });
  useFrame((_, dt) => {
    const s = st.current;
    if (s.done) return;
    s.t += dt;
    if (s.t < 1) return; // il primo secondo carica texture e shader
    s.n++;
    if (s.t >= 3) {
      s.done = true;
      if (s.n / (s.t - 1) < 45) onSlow();
    }
  });
  return null;
}

/** Telefono o tablet: niente effetti a schermo intero, la GPU è più piccola. */
const LOW_POWER = typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || window.innerWidth < 760);

export function Scene() {
  const [hq, setHq] = useState(!LOW_POWER);
  const rr = useGame((s) => s.visit?.truth.rr ?? 24);
  const species = useGame((s) => s.visit?.patient.species ?? 'cane');
  const sprite = useGame((s) => s.visit?.sprite);
  const catGlb = useGame((s) => s.catGlb);
  const CatComponent = catGlb ? CatModel : Cat;

  const updatePointer = (e: ThreeEvent<PointerEvent>) => {
    pointer.over = true;
    pointer.point.copy(e.point);
    if (e.face) {
      pointer.normal.copy(e.face.normal).transformDirection(e.object.matrixWorld).normalize();
    }
  };

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    updatePointer(e);
    pointer.down = true;
    audio.unlock();
    const g = useGame.getState();
    switch (g.tool) {
      case Tool.Hand:
        g.pet();
        if (Math.random() < 0.35) {
          // il gatto miagola, il cane abbaia (con l'animazione)
          if (g.visit?.patient.species === 'gatto') audio.meow();
          else {
            audio.bark();
            dogBark();
          }
        }
        break;
      case Tool.Stethoscope:
        void audio.start(vitalsForAudio());
        break;
      case Tool.Thermometer: {
        if (g.thermo.active) break;
        if (e.point.distanceTo(ZONES.rectal) < 0.25) {
          g.patchThermo({ active: true, progress: 0, inserted: false });
        } else {
          g.showToast('La temperatura si misura per via rettale: tocca sotto la coda');
        }
        break;
      }
      case Tool.Pulse:
        if (g.placed) break;
        if (e.point.distanceTo(ZONES.femoral) < 0.24) {
          g.setPlaced(true);
          g.addStress(3);
          g.showToast('Dita sull’arteria femorale: avvia la palpazione');
        } else g.showToast('Il polso femorale si sente sull’interno della coscia posteriore');
        break;
      case Tool.Syringe: {
        if (g.syringe.phase !== SyringePhase.Insert) break;
        // si accetta il tocco sul collider dell'avambraccio o sulla pelle del modello vicino alla vena
        if (e.object.name !== 'leg_fl' && distanceToVein(e.point) > 0.05) {
          g.showToast('Punta l’ago sulla vena cefalica della zampa anteriore');
          break;
        }
        const s = g.syringe;
        const tol = s.tourniquet ? 0.024 : 0.011;
        const d = distanceToVein(e.point);
        let err: TechniqueError | null = null;
        if (d > tol) err = TechniqueError.MissedVein;
        else if (s.angle > 40) err = TechniqueError.TransfixedVein;
        else if (s.angle < 12) err = TechniqueError.NeedleTooFlat;
        if (err) {
          g.addError(err);
          g.addStress(14);
          complain();
          const msg: Record<string, string> = {
            [TechniqueError.MissedVein]: s.tourniquet ? 'Vena mancata! Mira esattamente sulla linea blu' : 'Vena mancata! Senza laccio la vena non è distesa',
            [TechniqueError.TransfixedVein]: 'Ago troppo inclinato: hai trapassato la vena',
            [TechniqueError.NeedleTooFlat]: 'Ago troppo parallelo: scivola sotto la cute',
          };
          g.showToast(msg[err]);
        } else {
          if (s.clip < 1) g.addError(TechniqueError.NoClipping);
          if (!s.disinfected) g.addError(TechniqueError.NoDisinfection);
          g.addStress(6);
          const p: [number, number, number] = [e.point.x, e.point.y, e.point.z];
          g.patchSyringe({ phase: SyringePhase.Aspirate, insertPoint: p, fill: 0, pressure: 0 });
          g.showToast('Sei in vena! Aspira piano: tieni premuto a impulsi');
        }
        break;
      }
    }
  };

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    updatePointer(e);
  };
  const end = () => {
    if (pointer.down && useGame.getState().tool === Tool.Stethoscope) audio.stop();
    pointer.down = false;
  };

  useEffect(() => {
    window.addEventListener('pointerup', end);
    return () => {
      window.removeEventListener('pointerup', end);
      audio.stop();
    };
  }, []);

  return (
    <>
      <color attach="background" args={['#e9ecec']} />
      {/* luce d'ambiente e riflessi da un HDRI di una stanza d'ospedale (Poly Haven, CC0) */}
      <Environment files={CLINIC_HDRI} environmentIntensity={1} />
      <hemisphereLight args={["#ffffff", "#d8d4cc", 0.6]} />
      {/* luce principale dalle plafoniere, unica a proiettare ombre (sul cane e sul tavolo) */}
      <directionalLight
        position={[0.8, 5, 2.2]}
        intensity={1.5}
        color="#fffaf0"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-camera-far={14}
      />
      {/* luce fredda dalla finestra */}
      <pointLight position={[-2.7, 1.9, -2.6]} intensity={6} distance={8} color="#dbe8ff" />
      <Suspense fallback={null}>
        <Clinic />
        <ShaderWarmup />
      </Suspense>
      {/* qualità adattiva: se i fotogrammi sono pochi si spengono gli effetti a schermo intero */}
      {hq && <FpsGuard onSlow={() => setHq(false)} />}
      <AdaptiveDpr />
      <ShadowThrottle />
      {hq && <Effects />}
      <CameraRig />
      {/* ombra morbida sul pavimento: la stanza non si muove, basta calcolarla una volta */}
      <ContactShadows position={[0, 0.008, 0]} opacity={0.5} scale={3} blur={2} far={1.2} frames={1} resolution={256} />
      {species === 'gatto' && sprite?.kind === 'cat' ? (
        <CatComponent
          colors={sprite}
          respRate={rr}
          getMood={() => {
            const g = useGame.getState();
            return {
              stress: g.stress,
              happyUntil: g.happyUntil,
              tailUp: g.tool === Tool.Thermometer && g.thermo.active,
              // durante la conta degli atti il respiro si vede meglio
              breath: g.tool === Tool.Resp ? 1 : g.tool === Tool.Syringe ? 0 : 0.45,
              still: g.tool !== Tool.Hand,
              // prelievo: paziente immobile, così laccio, vena e siringa restano appoggiati alla zampa
              freeze: g.tool === Tool.Syringe,
            };
          }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerOut={() => {
            pointer.over = false;
          }}
        />
      ) : (
        <Dog
          respRate={rr}
          getMood={() => {
            const g = useGame.getState();
            return {
              stress: g.stress,
              happyUntil: g.happyUntil,
              tailUp: g.tool === Tool.Thermometer && g.thermo.active,
              // durante la conta degli atti il respiro si vede meglio
              breath: g.tool === Tool.Resp ? 1 : g.tool === Tool.Syringe ? 0 : 0.45,
              still: g.tool !== Tool.Hand,
              // prelievo: paziente immobile, così laccio, vena e siringa restano appoggiati alla zampa
              freeze: g.tool === Tool.Syringe,
            };
          }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerOut={() => {
            pointer.over = false;
          }}
        />
      )}
      <ZoneMarkers />
      <StethoscopeHead />
      <Thermometer3D />
      <PulseFingers />
      <PrelievoKit />
      <GameLoop />
    </>
  );
}

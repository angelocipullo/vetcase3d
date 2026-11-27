import { AdaptiveDpr, ContactShadows, Environment, OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { audio } from '../audio/engine';
import { HeartSound, LungSound, SyringePhase, TechniqueError, Tool, Vitals } from '../game/types';
import { cameraViewFor, expectedHeart, useGame } from '../store';
import { CAMERA_VIEWS, THERMO_DEPTH, ZONES, distanceToVein, setSpecies } from './anatomy';
import { PrelievoKit, PulseFingers } from './Instruments';
import { CLINIC_HDRI, Clinic, ROOM } from './Clinic';
import { Cat } from './Cat';
import { CatModel, catModelAvailable } from './CatModel';
import { HandModel, handModelAvailable } from './HandModel';
import { suspend } from 'suspend-react';
import { Dog, dogBark } from './Dog';
import { Effects } from './Effects';
import { num } from '../sim/format';

/** Stato del puntatore condiviso a 60fps senza passare da React. */
const pointer = {
  over: false,
  down: false,
  point: new THREE.Vector3(),
  normal: new THREE.Vector3(0, 0, 1),
};

/** Campo visivo di base della camera (ClinicVisit) e distanza massima dal paziente. */
const BASE_FOV = 40;
const MAX_DIST = 4.6;
const ROOM_MARGIN = 0.4;
const _dir = new THREE.Vector3();

/**
 * Quanto ci si può allontanare dal bersaglio lungo `dir` (normalizzata) restando dentro la stanza,
 * con un margine dalle pareti, dal pavimento e dal soffitto.
 */
function roomLimit(target: THREE.Vector3, dir: THREE.Vector3) {
  const lo = [ROOM.left + ROOM_MARGIN, ROOM.floor + ROOM_MARGIN, ROOM.back + ROOM_MARGIN];
  const hi = [ROOM.right - ROOM_MARGIN, ROOM.ceiling - ROOM_MARGIN, ROOM.front - ROOM_MARGIN];
  const t0 = [target.x, target.y, target.z];
  const d = [dir.x, dir.y, dir.z];
  let t = Infinity;
  for (let i = 0; i < 3; i++) {
    if (d[i] > 1e-6) t = Math.min(t, (hi[i] - t0[i]) / d[i]);
    else if (d[i] < -1e-6) t = Math.min(t, (lo[i] - t0[i]) / d[i]);
  }
  return Math.max(0.3, Math.min(t, MAX_DIST));
}

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
    // (polso: il pannello su telefono è piccolo finché non hai palpato, la mano resta al centro)
    if (portrait) target.y -= (view === 'default' ? 0.55 : view === 'femoral' ? 0.02 : 0.3) * (cat ? 0.45 : 1);
    // posizione voluta; se finirebbe fuori dalla stanza (o troppo lontano) la camera si avvicina
    // e allarga il campo visivo, così l'inquadratura resta la stessa senza uscire dalle pareti
    const off = v.pos.clone().sub(v.target).multiplyScalar(k);
    const want = off.length();
    const dist = Math.min(want, roomLimit(target, _dir.copy(off).normalize()));
    const pos = target.clone().add(off.setLength(dist));
    const fov = (2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(BASE_FOV / 2)) * (want / dist)) * 180) / Math.PI;
    return { pos, target, fov: Math.min(fov, 75) };
  }, [view, fit, portrait]);

  useEffect(() => {
    moving.current = true;
  }, [goal]);

  // Desktop: il dock strumenti (sx) e la colonna dei pannelli (dx) occupano spazio diverso,
  // quindi spostiamo l'inquadratura per centrare il cane nell'area libera (vedi styles.css).
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    if (size.width >= 900 && size.height >= 540) {
      // stesse misure del CSS (--gap, --dock-w, --side-w), che ora seguono la larghezza della finestra
      const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
      const gap = clamp(size.width * 0.016, 12, 20);
      const left = gap + clamp(size.width * 0.075, 86, 96);
      const right = gap + clamp(size.width * 0.3, 280, 380);
      cam.setViewOffset(size.width, size.height, (right - left) / 2, 0, size.width, size.height);
    } else {
      cam.clearViewOffset();
    }
  }, [camera, size.width, size.height]);


  useFrame((_, dt) => {
    const c = controls.current;
    if (!c) return;
    const cam = camera as THREE.PerspectiveCamera;
    const k = 1 - Math.exp(-dt * 4);
    if (Math.abs(cam.fov - goal.fov) > 0.05) {
      cam.fov += (goal.fov - cam.fov) * k;
      cam.updateProjectionMatrix();
    }
    if (moving.current) {
      camera.position.lerp(goal.pos, k);
      c.target.lerp(goal.target, k);
      c.update();
      if (camera.position.distanceTo(goal.pos) < 0.01 && c.target.distanceTo(goal.target) < 0.01) moving.current = false;
    }
    // mai fuori dalla stanza, nemmeno girando la visuale a mano
    const off = _dir.copy(camera.position).sub(c.target);
    const lim = roomLimit(c.target, off.clone().normalize());
    if (off.length() > lim) camera.position.copy(c.target).add(off.setLength(lim));
  });

  const orbit = view === 'default' && tool === Tool.Hand;
  return (
    <OrbitControls
      ref={controls}
      enabled={orbit}
      enablePan={false}
      minDistance={orbit ? 2 : 0.2}
      maxDistance={Math.max(MAX_DIST, goal.pos.distanceTo(goal.target))}
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
    const shown = t.progress > 0 ? num(35.5 + (target - 35.5) * (1 - Math.pow(1 - t.progress, 3)), 1) : '--,-';
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
/**
 * Compila tutti gli shader della scena e aspetta che siano davvero pronti.
 * È `compileAsync` di three.js (r169) con il controllo corretto: three legge `currentProgram.isReady()`
 * di ogni materiale, ma se un materiale viene eliminato mentre aspetta (React lo sostituisce),
 * `currentProgram` non c'è più, il controllo va in errore ("reading 'isReady'") e la promessa non si
 * risolve mai. Qui un materiale senza programma conta come "fatto": non verrà più disegnato.
 */
function compileScene(gl: THREE.WebGLRenderer, scene: THREE.Object3D, camera: THREE.Camera) {
  const materials = gl.compile(scene, camera);
  const parallel = gl.extensions.get('KHR_parallel_shader_compile') !== null;
  return new Promise<void>((resolve) => {
    const check = () => {
      materials.forEach((m) => {
        const program = (gl.properties.get(m) as { currentProgram?: { isReady(): boolean } }).currentProgram;
        if (!program || program.isReady()) materials.delete(m);
      });
      if (materials.size === 0) resolve();
      else setTimeout(check, 10);
    };
    // senza l'estensione il controllo blocca: si lascia un attimo al driver prima di chiedere
    if (parallel) check();
    else setTimeout(check, 10);
  });
}

/** Rete di sicurezza: se la compilazione non finisse (driver difettoso), dopo questo tempo si apre lo stesso. */
const WARMUP_SAFETY_MS = 20000;
/** Fotogrammi disegnati dietro la schermata di caricamento dopo la compilazione (ombre, effetti, strumenti). */
const WARMUP_FRAMES = 4;

/** Fase del preriscaldamento, condivisa tra `ShaderWarmup` e `Prewarm`. */
const warm = { compiled: false, frames: 0, culled: new Map<THREE.Object3D, boolean>() };

/**
 * Prepara la scena dietro la schermata "Preparo l'ambulatorio…" e solo alla fine la toglie:
 * 1. compila tutti gli shader (stanza, paziente e le copie degli strumenti di `Prewarm`) e aspetta che
 *    siano davvero pronti (`compileScene`);
 * 2. disegna alcuni fotogrammi: nascono anche i programmi che la sola compilazione non crea
 *    (mappe d'ombra, effetti a schermo intero), così il primo fotogramma visibile non scatta;
 * 3. segnala che l'ambulatorio è pronto e `Prewarm` nasconde le copie.
 * Sta nella stessa Suspense di stanza e strumenti: parte quando modelli, texture e immagini sono già
 * caricati e i materiali non cambiano più.
 */
function ShaderWarmup() {
  const { gl, scene, camera } = useThree();
  const ready = useRef(false);
  useEffect(() => {
    if (useGame.getState().sceneReady) return;
    ready.current = false;
    warm.compiled = false;
    warm.frames = 0;
    let alive = true;
    const safety = window.setTimeout(() => {
      if (!alive || useGame.getState().sceneReady) return;
      console.warn('Preriscaldamento degli shader oltre il tempo massimo: ambulatorio aperto comunque');
      useGame.getState().setSceneReady();
    }, WARMUP_SAFETY_MS);
    // un frame di margine perché tutti i figli siano montati e abbiano i loro materiali
    const id = requestAnimationFrame(() => {
      compileScene(gl, scene, camera).then(() => {
        if (alive) warm.compiled = true;
      });
    });
    return () => {
      // smontato prima di finire (es. React in sviluppo monta due volte): al nuovo montaggio si riparte
      alive = false;
      cancelAnimationFrame(id);
      window.clearTimeout(safety);
    };
  }, [gl, scene, camera]);
  // dopo la compilazione: qualche fotogramma disegnato sotto la schermata di caricamento, poi "pronto".
  // In questi fotogrammi si disegna tutta la stanza, anche ciò che è fuori inquadratura (niente frustum
  // culling), così nessun materiale resta da preparare quando la camera si sposta (prelievo, termometro…).
  useFrame(() => {
    if (ready.current || !warm.compiled || useGame.getState().sceneReady) return;
    if (warm.frames === 0) {
      scene.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          warm.culled.set(o, o.frustumCulled);
          o.frustumCulled = false;
        }
      });
    }
    if (++warm.frames >= WARMUP_FRAMES) {
      for (const [o, c] of warm.culled) o.frustumCulled = c;
      warm.culled.clear();
      ready.current = true;
      useGame.getState().setSceneReady();
    }
  });
  return null;
}

/**
 * Copie di ciò che compare solo durante la visita (mano del polso, strumenti, marcatori della guida,
 * display), davanti alla camera ma coperte dalla schermata di caricamento: vengono compilate e disegnate
 * durante il preriscaldamento, poi diventano invisibili. Restano montate perché smontarle eliminerebbe i
 * programmi già pronti; da invisibili non costano nulla nel disegno.
 */
function Prewarm() {
  const hand = suspend(handModelAvailable, ['hand-glb']);
  const ready = useGame((s) => s.sceneReady);
  const hop = useRef(0);
  const group = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera);
  const tex = useMemo(() => {
    const t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  }, []);
  // finché si prepara la scena, le copie stanno davanti alla camera (così vengono disegnate davvero)
  useFrame(() => {
    const g = group.current;
    if (!g || ready) return;
    camera.getWorldDirection(_dir);
    g.position.copy(camera.position).addScaledVector(_dir, 1.2);
    g.quaternion.copy(camera.quaternion);
  });
  const box = <boxGeometry args={[0.04, 0.04, 0.04]} />;
  return (
    <group ref={group} visible={!ready}>
      {hand && (
        <group scale={0.6}>
          <HandModel hop={hop} />
        </group>
      )}
      {/* stessi tipi di materiale di termometro, siringa, laccio, dita, marcatori e display */}
      <mesh position={[-0.1, 0, 0]} castShadow>
        {box}
        <meshStandardMaterial />
      </mesh>
      <mesh position={[-0.05, 0, 0]}>
        {box}
        <meshStandardMaterial transparent opacity={0.5} />
      </mesh>
      <mesh position={[0, 0.05, 0]} castShadow>
        {box}
        <meshToonMaterial />
      </mesh>
      <mesh position={[0.05, 0.05, 0]}>
        {box}
        <meshToonMaterial transparent opacity={0.5} />
      </mesh>
      <mesh position={[0.1, 0, 0]}>
        {box}
        <meshBasicMaterial transparent opacity={0.8} depthTest={false} />
      </mesh>
      <mesh position={[0.1, 0.05, 0]}>
        {box}
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      <mesh position={[0.15, 0, 0]}>
        {box}
        <meshBasicMaterial map={tex} />
      </mesh>
      <mesh position={[0.15, 0.05, 0]}>
        {box}
        <meshStandardMaterial map={tex} />
      </mesh>
    </group>
  );
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
  // si aspetta di sapere se c'è il gatto glTF prima di disegnare: niente cambio di modello (e di materiali)
  // a scena già avviata; i punti anatomici seguono il modello scelto
  const catGlb = suspend(catModelAvailable, ['cat-glb']);
  setSpecies(species, catGlb);
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
        if (Math.random() < 0.2) {
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
        else if (s.angle > 55) err = TechniqueError.TransfixedVein;
        else if (s.angle < 35) err = TechniqueError.NeedleTooFlat;
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
        <Prewarm />
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

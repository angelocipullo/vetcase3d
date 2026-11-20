import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { SyringePhase, Tool } from '../game/types';
import { useGame } from '../store';
import { FRONT_LEFT_LEG, VEIN_CURVE, ZONES } from './anatomy';

/* =====================================================================
 * Strumenti 3D della scheda di PS appoggiati sul modello del paziente:
 * le dita sul polso femorale (gli altri strumenti sono in Scene.tsx).
 * ===================================================================== */

const SKIN = '#f1c7a3';

/** Due polpastrelli sull'interno coscia: a ogni battito si sollevano un poco e compare un anello. */
export function PulseFingers() {
  const show = useGame((s) => s.tool === Tool.Pulse && s.placed);
  const cat = useGame((s) => s.visit?.patient.species === 'gatto');
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const lastBeat = useRef(-1e9);
  useEffect(
    () =>
      useGame.subscribe((s, prev) => {
        if (s.pulseBeat !== prev.pulseBeat) lastBeat.current = performance.now();
      }),
    [],
  );
  useFrame(() => {
    const k = Math.exp(-(performance.now() - lastBeat.current) / 90);
    if (group.current) group.current.position.z = ZONES.femoral.z + 0.03 + 0.012 * k;
    if (ring.current) {
      const age = (performance.now() - lastBeat.current) / 400;
      ring.current.scale.setScalar(1 + Math.min(age, 1) * 1.6);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.7 * (1 - age));
    }
  });
  if (!show) return null;
  const p = ZONES.femoral;
  return (
    <>
      <group ref={group} position={[p.x, p.y, p.z + 0.03]} scale={cat ? 0.65 : 1}>
        {[-0.028, 0.028].map((dx) => (
          <mesh key={dx} position={[dx, 0.06, 0]} rotation={[0, 0, dx > 0 ? -0.15 : 0.15]} castShadow>
            <capsuleGeometry args={[0.022, 0.12, 6, 12]} />
            <meshStandardMaterial color={SKIN} roughness={0.6} />
          </mesh>
        ))}
      </group>
      <mesh ref={ring} position={[p.x, p.y, p.z + 0.02]}>
        <ringGeometry args={[0.04, 0.05, 32]} />
        <meshBasicMaterial color="#ff6b6b" transparent opacity={0} depthTest={false} />
      </mesh>
    </>
  );
}

/* ------------------------------------------------------------------ prelievo dalla vena cefalica */

const SHAVED = '#e9bfa8';

/**
 * Tratto di tubo lungo la vena, da `from` a `to` (0..1 lungo la curva). `sink` lo affonda verso l'interno
 * della zampa (−X): ne affiora solo una pellicola sulla cute, come una chiazza e non come un bastoncino.
 */
function veinTube(from: number, to: number, radius: number, sink = 0) {
  const pts: THREE.Vector3[] = [];
  const n = 16;
  for (let i = 0; i <= n; i++) pts.push(VEIN_CURVE.getPoint(from + ((to - from) * i) / n).add(new THREE.Vector3(-sink, 0, 0)));
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, radius, 10, false);
}

/**
 * Tutto quello che compare sull'avambraccio durante il prelievo: zona rasata e macchinetta (tricotomia),
 * alcol, vena, laccio, siringa con la provetta. Durante il prelievo il paziente è fermo
 * (animazione e respiro in pausa), così gli strumenti restano appoggiati alla zampa.
 */
export function PrelievoKit() {
  const tool = useGame((s) => s.tool);
  const s = useGame((st) => st.syringe);
  const cat = useGame((st) => st.visit?.patient.species === 'gatto');
  const clipStep = Math.round(s.clip * 24) / 24;
  const shaved = useMemo(() => (clipStep > 0 ? veinTube(0.02, 0.02 + 0.96 * clipStep, cat ? 0.032 : 0.036, cat ? 0.027 : 0.031) : null), [clipStep, cat]);
  const vein = useMemo(() => veinTube(0, 1, 0.0075), []);
  const alcohol = useMemo(() => veinTube(0.12, 0.92, cat ? 0.034 : 0.038, cat ? 0.028 : 0.032), [cat]);
  if (tool !== Tool.Syringe) return null;
  const L = FRONT_LEFT_LEG;
  const clipping = s.clip > 0 && s.clip < 1;
  const clipper = clipping ? VEIN_CURVE.getPoint(0.02 + 0.96 * s.clip) : null;
  const veinOpacity = (s.tourniquet ? 0.85 : 0.25) + (s.clip >= 1 ? 0.15 : 0);
  return (
    <>
      {shaved && (
        <mesh geometry={shaved}>
          <meshStandardMaterial color={SHAVED} roughness={0.7} />
        </mesh>
      )}
      {clipper && (
        <group position={[clipper.x + 0.045, clipper.y + 0.03, clipper.z]} rotation={[0, 0, 0.35]}>
          <mesh>
            <boxGeometry args={[0.05, 0.09, 0.045]} />
            <meshStandardMaterial color="#495057" roughness={0.5} />
          </mesh>
          <mesh position={[-0.026, -0.04, 0]}>
            <boxGeometry args={[0.008, 0.02, 0.05]} />
            <meshStandardMaterial color="#ced4da" metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[0.026, 0.01, 0]}>
            <boxGeometry args={[0.004, 0.02, 0.012]} />
            <meshBasicMaterial color="#63e6be" />
          </mesh>
        </group>
      )}
      {s.disinfected && (
        <mesh geometry={alcohol}>
          <meshBasicMaterial color="#a5d8ff" transparent opacity={0.22} depthWrite={false} />
        </mesh>
      )}
      {/* la vena si vede sempre, sopra cute rasata e alcol */}
      <mesh geometry={vein} renderOrder={2}>
        <meshToonMaterial color="#3b5bdb" transparent opacity={veinOpacity} depthTest={false} />
      </mesh>
      {s.tourniquet && (
        <mesh position={[L.x, L.cuffY, L.z]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[L.radius + 0.008, 0.012, 10, 36]} />
          <meshToonMaterial color="#fa5252" />
        </mesh>
      )}
      <Syringe3D />
    </>
  );
}

function Syringe3D() {
  const s = useGame((st) => st.syringe);
  const show = !!s.insertPoint && (s.phase === SyringePhase.Aspirate || s.phase === SyringePhase.Finish);
  const quat = useMemo(() => {
    const a = THREE.MathUtils.degToRad(s.angle);
    const dir = new THREE.Vector3(-Math.sin(a), Math.cos(a), 0).normalize();
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  }, [s.angle]);
  if (!show) return null;
  const fill = s.fill;
  return (
    <group position={s.insertPoint} quaternion={quat}>
      {/* ago */}
      <mesh position={[0, -0.025, 0]}>
        <cylinderGeometry args={[0.0018, 0.0018, 0.07, 6]} />
        <meshStandardMaterial color="#ced4da" metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[0, -0.066, 0]}>
        <cylinderGeometry args={[0.006, 0.009, 0.014, 12]} />
        <meshStandardMaterial color="#74c0fc" />
      </mesh>
      {/* corpo */}
      <mesh position={[0, -0.145, 0]}>
        <cylinderGeometry args={[0.018, 0.018, 0.14, 20, 1, true]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.35} side={THREE.DoubleSide} />
      </mesh>
      {fill > 0.01 && (
        <mesh position={[0, -0.075 - (0.13 * fill) / 2, 0]}>
          <cylinderGeometry args={[0.0155, 0.0155, 0.13 * fill, 16]} />
          <meshToonMaterial color="#c92a2a" />
        </mesh>
      )}
      {/* stantuffo */}
      <mesh position={[0, -0.08 - 0.13 * fill - 0.004, 0]}>
        <cylinderGeometry args={[0.016, 0.016, 0.008, 16]} />
        <meshStandardMaterial color="#495057" />
      </mesh>
      <mesh position={[0, -0.08 - 0.13 * fill - 0.06, 0]}>
        <cylinderGeometry args={[0.004, 0.004, 0.11, 8]} />
        <meshStandardMaterial color="#dee2e6" />
      </mesh>
      <mesh position={[0, -0.08 - 0.13 * fill - 0.118, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.006, 16]} />
        <meshStandardMaterial color="#dee2e6" />
      </mesh>
    </group>
  );
}

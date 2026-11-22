import { useFrame } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { SyringePhase, Tool } from '../game/types';
import { useGame } from '../store';
import { FRONT_LEFT_LEG, VEIN_CURVE, ZONES } from './anatomy';
import { HandModel } from './HandModel';

/* =====================================================================
 * Strumenti 3D della scheda di PS appoggiati sul modello del paziente:
 * le dita sul polso femorale (gli altri strumenti sono in Scene.tsx).
 * ===================================================================== */

const SKIN = '#f1c7a3';

const GLOVE = '#a5d8ff';
const CUFF = '#f8f9fa';

/** Un dito: falange prossimale e distale (capsule), la distale piegata di `curl` verso la coscia. */
function Finger({ len, r, curl }: { len: number; r: number; curl: number }) {
  const a = len * 0.55;
  const b = len * 0.45;
  return (
    <group>
      {/* falange prossimale: dalle nocche (x=0) verso la punta (−X) */}
      <mesh position={[-a / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <capsuleGeometry args={[r, a, 6, 12]} />
        <meshStandardMaterial color={GLOVE} roughness={0.45} />
      </mesh>
      <group position={[-a, 0, 0]} rotation={[0, 0, curl]}>
        <mesh position={[-b / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <capsuleGeometry args={[r * 0.92, b, 6, 12]} />
          <meshStandardMaterial color={GLOVE} roughness={0.45} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * Mano guantata sul polso femorale: arriva dal lato craniale della coscia (dal davanti, verso la pancia),
 * indice e medio infilati nell'inguine sull'arteria, le altre dita chiuse. A ogni battito le due dita
 * fanno un piccolo saltello (e compare un anello rosso); suono e vibrazione arrivano dal minigioco.
 */
export function PulseFingers() {
  const show = useGame((s) => s.tool === Tool.Pulse && s.placed);
  const cat = useGame((s) => s.visit?.patient.species === 'gatto');
  const handGlb = useGame((s) => s.handGlb);
  const hopRef = useRef(0);
  const fingers = useRef<THREE.Group>(null);
  const hand = useRef<THREE.Group>(null);
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
    const age = performance.now() - lastBeat.current;
    // saltello: sale in fretta e ricade più piano
    const hop = age < 0 ? 0 : Math.min(1, age / 45) * Math.exp(-age / 110);
    hopRef.current = hop;
    if (fingers.current) fingers.current.rotation.z = -0.22 * hop;
    if (hand.current) hand.current.position.y = 0.006 * hop;
    if (ring.current) {
      const a = age / 400;
      ring.current.scale.setScalar(1 + Math.min(a, 1) * 1.6);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.7 * (1 - a));
    }
  });
  if (!show) return null;
  const p = ZONES.femoral;
  const s = cat ? 0.8 : 1;
  return (
    <>
      {/* la punta delle dita è sull'arteria; la mano sta davanti (craniale, +X) e un po' sotto */}
      {/* ruotata attorno alla verticale: la mano resta verso la camera, le punte entrano verso l'interno coscia */}
      {/* mano glTF: sotto l'inguine, palmo verso la camera, polpastrelli sulla faccia interna della coscia */}
      <group position={handGlb ? [p.x + 0.03, p.y + (cat ? 0.03 : 0.06), p.z - (cat ? 0.05 : 0.1)] : [p.x, p.y, p.z - 0.03]} rotation={handGlb ? [0, 0, 0] : [0, -0.6, -0.3]} scale={s}>
        <group ref={hand}>
          {handGlb ? (
            // mano glTF locale: le dita sono piegate dallo scheletro, il saltello viene da hopRef
            <Suspense fallback={null}>
              <HandModel hop={hopRef} />
            </Suspense>
          ) : (
            <>
          {/* indice e medio: si piegano attorno alle nocche (x = 0,12) quando sentono il battito */}
              <group position={[0.12, 0, 0]}>
                <group ref={fingers}>
                  <group position={[0, 0.012, 0.012]}>
                    <Finger len={0.115} r={0.0135} curl={0.25} />
                  </group>
                  <group position={[0, -0.014, 0.004]}>
                    <Finger len={0.128} r={0.0145} curl={0.3} />
                  </group>
                </group>
              </group>
              {/* palmo e dorso: ellissoide schiacciato */}
              <mesh position={[0.168, -0.004, 0.008]} scale={[0.062, 0.036, 0.024]} castShadow>
                <sphereGeometry args={[1, 24, 16]} />
                <meshStandardMaterial color={GLOVE} roughness={0.45} />
              </mesh>
              {/* anulare e mignolo chiusi sotto il palmo, pollice appoggiato di lato */}
              {[-0.034, -0.05].map((y, i) => (
                <mesh key={y} position={[0.118 - i * 0.004, y, 0.004]} rotation={[0, 0, 0.9]} castShadow>
                  <capsuleGeometry args={[0.012, 0.035, 6, 10]} />
                  <meshStandardMaterial color={GLOVE} roughness={0.45} />
                </mesh>
              ))}
              <mesh position={[0.135, 0.03, 0.026]} rotation={[0.5, 0, 2.3]} castShadow>
                <capsuleGeometry args={[0.013, 0.05, 6, 10]} />
                <meshStandardMaterial color={GLOVE} roughness={0.45} />
              </mesh>
            </>
          )}
          {!handGlb && (
            <>
              {/* polso e manica del camice */}
              <mesh position={[0.25, -0.006, 0.004]} rotation={[0, 0, Math.PI / 2]} castShadow>
                <cylinderGeometry args={[0.026, 0.03, 0.08, 16]} />
                <meshStandardMaterial color={GLOVE} roughness={0.45} />
              </mesh>
              {/* manica lunga: esce dall'inquadratura, niente taglio a metà schermo */}
              <mesh position={[0.6, -0.006, 0.004]} rotation={[0, 0, Math.PI / 2]} castShadow>
                <cylinderGeometry args={[0.05, 0.042, 0.64, 18]} />
                <meshStandardMaterial color={CUFF} roughness={0.8} />
              </mesh>
            </>
          )}
        </group>
      </group>
      <mesh ref={ring} position={[p.x, p.y, p.z + 0.03]}>
        <ringGeometry args={[0.04 * s, 0.05 * s, 32]} />
        <meshBasicMaterial color="#ff6b6b" transparent opacity={0} depthTest={false} />
      </mesh>
    </>
  );
}

/* ------------------------------------------------------------------ prelievo dalla vena cefalica */

/** Cute rasata: rosa pelle più carico (sotto le luci dell'ambulatorio un rosa chiaro diventava quasi bianco). */
const SHAVED = '#c98676';

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
          <meshStandardMaterial color={SHAVED} roughness={0.9} />
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
      {s.tourniquet &&
        (L.cuff ? (
          // anello ellittico: scala il toro sul piano orizzontale, spessore del tubo invariato a vista
          <mesh position={[L.cuff.x, L.cuffY, L.cuff.z]} rotation={[Math.PI / 2, 0, 0]} scale={[L.cuff.rx / 0.08, L.cuff.rz / 0.08, 1]}>
            <torusGeometry args={[0.08, 0.011, 10, 40]} />
            <meshToonMaterial color="#fa5252" />
          </mesh>
        ) : (
          <mesh position={[L.x, L.cuffY, L.z]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[L.radius + 0.008, 0.012, 10, 36]} />
            <meshToonMaterial color="#fa5252" />
          </mesh>
        ))}
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

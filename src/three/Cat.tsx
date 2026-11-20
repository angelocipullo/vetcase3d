import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { DogProps } from './Dog';
import { FRONT_LEFT_LEG, ZONES } from './anatomy';

/**
 * Gatto costruito in codice (nessun file esterno), in stile semi-realistico: corpo scolpito con torace
 * profondo e ventre retratto, testa piccola con muso corto, occhi a mandorla con pupilla verticale,
 * zampe posteriori angolate, coda lunga e affusolata, mantello tigrato dipinto su una texture.
 * Colori dal caso: `fur` mantello, `dark` tigratura, `muzzle` pancia/muso, `eyes` iride.
 * Reazioni come il cane: respiro alla FR del caso, coda che oscilla o si alza per il termometro,
 * tremore se stressato. Muso verso +X, fianco sinistro verso la camera (+Z); punti anatomici in anatomy.ts.
 */
export interface CatColors {
  fur: string;
  dark: string;
  eyes: string;
  muzzle?: string;
}

const PINK = '#d98a96';
const INK = '#151216';
/** La testa è girata un po' verso la camera, come un gatto che guarda chi lo visita. */
const HEAD_YAW = -0.55;

/** Mantello tigrato: strisce verticali sui fianchi, riga scura sul dorso, pancia chiara (UV della sfera del tronco). */
function tabbyTexture(fur: string, dark: string, belly: string) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d')!;
  // pancia: u vicino a 0/1 è il lato ventrale del tronco
  const grad = g.createLinearGradient(0, 0, 512, 0);
  grad.addColorStop(0, belly);
  grad.addColorStop(0.16, belly);
  grad.addColorStop(0.27, fur);
  grad.addColorStop(0.73, fur);
  grad.addColorStop(0.84, belly);
  grad.addColorStop(1, belly);
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 256);
  // strisce: bande lungo la lunghezza (v), dal dorso (u = 0,5) giù sui fianchi, con bordi ondulati
  g.fillStyle = dark;
  g.globalAlpha = 0.8;
  const edge = (u: number, i: number) => 7 * Math.sin((u / 512) * Math.PI * 6 + i * 1.7);
  const width = (u: number, i: number) => 6 + 4 * Math.sin((u / 512) * Math.PI * 6 + i);
  for (let i = 0; i < 9; i++) {
    const v = 22 + i * 26 + (i % 2) * 5;
    g.beginPath();
    for (let u = 120; u <= 392; u += 8) {
      const y = v + edge(u, i) - width(u, i) / 2;
      if (u === 120) g.moveTo(u, y);
      else g.lineTo(u, y);
    }
    for (let u = 392; u >= 120; u -= 8) g.lineTo(u, v + edge(u, i) + width(u, i) / 2);
    g.closePath();
    g.fill();
  }
  // riga dorsale
  g.globalAlpha = 0.9;
  g.fillRect(244, 0, 24, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Tronco: sfera con i poli lungo X (lunghezza), sezione più alta sul torace e ventre retratto sui lombi.
 * Le UV restano quelle della sfera: v lungo il corpo, u attorno.
 */
function torsoGeometry() {
  const geo = new THREE.SphereGeometry(1, 56, 36);
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const t = v.y; // -1 coda … +1 petto
    const chest = Math.exp(-Math.pow((t - 0.45) / 0.55, 2));
    const ry = 0.195 + 0.065 * chest;
    const rz = 0.17 + 0.04 * chest;
    let y = v.x * ry;
    // ventre retratto verso le anche, petto profondo
    if (y < 0) y *= 0.82 + 0.35 * chest;
    p.setXYZ(i, t * 0.5, y, v.z * rz);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Segmento affusolato da `a` a `b` (cilindro orientato), per zampe, collo e coda. */
function Limb({ a, b, r0, r1, color }: { a: [number, number, number]; b: [number, number, number]; r0: number; r1: number; color: string }) {
  const [ax, ay, az] = a;
  const [bx, by, bz] = b;
  const { pos, quat, len } = useMemo(() => {
    const A = new THREE.Vector3(ax, ay, az);
    const B = new THREE.Vector3(bx, by, bz);
    const dir = B.clone().sub(A);
    return {
      pos: A.clone().add(B).multiplyScalar(0.5),
      quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()),
      len: dir.length(),
    };
  }, [ax, ay, az, bx, by, bz]);
  return (
    <group position={pos} quaternion={quat}>
      <mesh castShadow>
        <cylinderGeometry args={[r1, r0, len, 18]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
      <mesh position={[0, len / 2, 0]} castShadow>
        <sphereGeometry args={[r1, 16, 12]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
    </group>
  );
}

function Paw({ p, color }: { p: [number, number, number]; color: string }) {
  return (
    <mesh position={p} scale={[1.45, 0.62, 1]} castShadow>
      <sphereGeometry args={[0.045, 16, 12]} />
      <meshStandardMaterial color={color} roughness={0.9} />
    </mesh>
  );
}

export function Cat({ colors, respRate, getMood, ...events }: DogProps & { colors: CatColors }) {
  const belly = colors.muzzle ?? colors.fur;
  const tabby = useMemo(() => tabbyTexture(colors.fur, colors.dark, belly), [colors.fur, colors.dark, belly]);
  const torso = useMemo(torsoGeometry, []);
  const root = useRef<THREE.Group>(null);
  const chest = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group[]>([]);
  const tailLift = useRef(0);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const { stress, happyUntil, tailUp, breath = 0.45, still } = getMood();
    const happy = performance.now() < happyUntil;

    // respiro: il tronco si espande alla frequenza respiratoria del caso
    const insp = Math.max(0, Math.sin((t * Math.PI * 2 * respRate) / 60));
    if (chest.current) {
      const k = 1 + 0.1 * breath * insp;
      chest.current.scale.set(1, 1 + (k - 1) * 0.7, k);
    }

    // coda: cade verso il basso e si incurva in punta; si alza per la temperatura rettale
    tailLift.current = THREE.MathUtils.damp(tailLift.current, tailUp ? 1 : 0, 3, dt);
    const lift = tailLift.current;
    const speed = happy ? 7 : stress > 60 ? 2 : 2.5;
    const amp = happy ? 0.35 : stress > 60 ? 0.06 : 0.12;
    const bend = [1.15 * (1 - lift) - 0.55 * lift, 0.15, -0.35 * (1 - lift) + 0.1 * lift];
    tail.current.forEach((s, i) => {
      if (!s) return;
      s.rotation.y = Math.sin(t * speed - i * 0.8) * amp * (1 - 0.8 * lift);
      s.rotation.z = bend[i];
    });

    if (head.current) {
      head.current.rotation.y = HEAD_YAW + (still ? 0 : Math.sin(t * 0.6) * 0.1);
      head.current.rotation.z = still ? 0 : Math.sin(t * 0.45) * 0.04;
    }

    if (root.current) {
      const tr = stress > 70 ? (stress - 70) / 30 : 0;
      root.current.position.x = Math.sin(t * 60) * 0.003 * tr;
      root.current.position.y = 0.004 * breath * insp;
    }
  });

  const fur = colors.fur;
  const leg = (side: 1 | -1) => {
    const z = 0.13 * side;
    return (
      <group key={side}>
        {/* anteriore: braccio, avambraccio (vena cefalica sul lato craniale), zampa */}
        <Limb a={[0.32, 0.62, z]} b={[0.3, 0.4, z]} r0={0.08} r1={0.058} color={fur} />
        <Limb a={[0.3, 0.4, z]} b={[0.31, 0.08, z]} r0={0.052} r1={0.042} color={fur} />
        <Paw p={[0.335, 0.035, z]} color={belly} />
        {/* posteriore: coscia piena, garretto angolato all'indietro, metatarso */}
        <mesh position={[-0.3, 0.5, z]} scale={[1.15, 1.35, 0.78]} castShadow>
          <sphereGeometry args={[0.13, 22, 16]} />
          <meshStandardMaterial color={fur} roughness={0.9} />
        </mesh>
        <Limb a={[-0.26, 0.4, z]} b={[-0.37, 0.17, z]} r0={0.066} r1={0.046} color={fur} />
        <Limb a={[-0.37, 0.17, z]} b={[-0.34, 0.05, z]} r0={0.04} r1={0.034} color={fur} />
        <Paw p={[-0.31, 0.035, z]} color={belly} />
        {/* anelli scuri della tigratura sulle zampe anteriori */}
        {[0.3, 0.2].map((y) => (
          <mesh key={y} position={[0.305, y, z]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.049, 0.007, 6, 20]} />
            <meshStandardMaterial color={colors.dark} roughness={0.9} />
          </mesh>
        ))}
      </group>
    );
  };

  return (
    <group {...events}>
      <group ref={root}>
        {leg(1)}
        {leg(-1)}

        {/* tronco tigrato (respira) */}
        <group ref={chest} position={[0, 0.62, 0]}>
          <mesh geometry={torso} castShadow>
            <meshStandardMaterial map={tabby} roughness={0.92} />
          </mesh>
        </group>

        {/* coda: tre segmenti affusolati a catena */}
        <group position={[-0.47, 0.68, 0]}>
          <group ref={(g) => g && (tail.current[0] = g)}>
            <Limb a={[0, 0, 0]} b={[-0.2, 0, 0]} r0={0.04} r1={0.034} color={fur} />
            <group position={[-0.2, 0, 0]} ref={(g) => g && (tail.current[1] = g)}>
              <Limb a={[0, 0, 0]} b={[-0.19, 0, 0]} r0={0.034} r1={0.028} color={colors.dark} />
              <group position={[-0.19, 0, 0]} ref={(g) => g && (tail.current[2] = g)}>
                <Limb a={[0, 0, 0]} b={[-0.17, 0, 0]} r0={0.028} r1={0.016} color={colors.dark} />
              </group>
            </group>
          </group>
        </group>

        {/* collo */}
        <Limb a={[0.36, 0.72, 0]} b={[0.53, 0.9, 0]} r0={0.15} r1={0.11} color={fur} />

        {/* testa */}
        <group ref={head} position={[0.6, 0.97, 0]} rotation={[0, HEAD_YAW, 0]} scale={1.22}>
          {/* cranio */}
          <mesh scale={[1.05, 0.92, 1]} castShadow>
            <sphereGeometry args={[0.125, 28, 20]} />
            <meshStandardMaterial color={fur} roughness={0.9} />
          </mesh>
          {/* righe "a M" sulla fronte */}
          {[-0.035, 0, 0.035].map((z) => (
            <mesh key={z} position={[0.085, 0.07, z]} rotation={[0, 0, -0.9]} scale={[1, 0.28, 0.32]}>
              <sphereGeometry args={[0.035, 10, 8]} />
              <meshStandardMaterial color={colors.dark} roughness={0.9} />
            </mesh>
          ))}
          {/* guance e muso corto */}
          {[0.055, -0.055].map((z) => (
            <mesh key={z} position={[0.075, -0.045, z]} scale={[0.85, 0.72, 0.95]}>
              <sphereGeometry args={[0.06, 18, 14]} />
              <meshStandardMaterial color={fur} roughness={0.9} />
            </mesh>
          ))}
          {[0.03, -0.03].map((z) => (
            <mesh key={z} position={[0.125, -0.045, z]} scale={[0.75, 0.7, 0.9]}>
              <sphereGeometry args={[0.035, 16, 12]} />
              <meshStandardMaterial color={belly} roughness={0.85} />
            </mesh>
          ))}
          <mesh position={[0.112, -0.08, 0]} scale={[0.9, 0.6, 1]}>
            <sphereGeometry args={[0.03, 14, 10]} />
            <meshStandardMaterial color={belly} roughness={0.85} />
          </mesh>
          {/* naso */}
          <mesh position={[0.152, -0.018, 0]} rotation={[0, 0, -Math.PI / 2]} scale={[1, 0.55, 1]}>
            <coneGeometry args={[0.016, 0.02, 3]} />
            <meshStandardMaterial color={PINK} roughness={0.5} />
          </mesh>
          {/* occhi a mandorla con pupilla verticale */}
          {[0.052, -0.052].map((z) => (
            <group key={z} position={[0.108, 0.022, z]} rotation={[0, z > 0 ? 0.5 : -0.5, z > 0 ? -0.15 : 0.15]}>
              <mesh scale={[0.45, 0.62, 1]}>
                <sphereGeometry args={[0.03, 18, 14]} />
                <meshStandardMaterial color={colors.eyes} roughness={0.15} metalness={0.05} />
              </mesh>
              <mesh position={[0.011, 0, 0]} scale={[0.2, 0.85, 0.22]}>
                <sphereGeometry args={[0.024, 12, 10]} />
                <meshBasicMaterial color={INK} />
              </mesh>
              <mesh position={[0.014, 0.008, 0.006]}>
                <sphereGeometry args={[0.004, 8, 6]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
            </group>
          ))}
          {/* orecchie triangolari, interno rosa */}
          {[0.068, -0.068].map((z) => (
            <group key={z} position={[0.0, 0.1, z]} rotation={[z > 0 ? 0.42 : -0.42, 0, -0.12]}>
              <mesh scale={[0.45, 1, 1]} castShadow>
                <coneGeometry args={[0.05, 0.1, 3]} />
                <meshStandardMaterial color={fur} roughness={0.9} />
              </mesh>
              <mesh position={[0.012, -0.008, 0]} scale={[0.25, 0.8, 0.7]}>
                <coneGeometry args={[0.042, 0.085, 3]} />
                <meshStandardMaterial color={PINK} roughness={0.8} />
              </mesh>
            </group>
          ))}
          {/* vibrisse */}
          {[0.045, -0.045].map((z) =>
            [-0.012, 0.004, 0.018].map((dy) => (
              <mesh key={`${z}${dy}`} position={[0.13, -0.045 + dy, z + Math.sign(z) * 0.075]} rotation={[0, z > 0 ? -0.3 : 0.3, dy * 5]}>
                <boxGeometry args={[0.003, 0.002, 0.16]} />
                <meshBasicMaterial color="#f1f3f5" />
              </mesh>
            )),
          )}
        </group>
      </group>

      {/* collider invisibili: perineo (termometro), avambraccio sinistro (prelievo) */}
      <mesh name="perineum" position={ZONES.rectal} visible={false}>
        <sphereGeometry args={[0.08, 12, 8]} />
        <meshBasicMaterial />
      </mesh>
      <mesh name="leg_fl" position={[FRONT_LEFT_LEG.x, FRONT_LEFT_LEG.y, FRONT_LEFT_LEG.z]} visible={false}>
        <capsuleGeometry args={[FRONT_LEFT_LEG.radius, FRONT_LEFT_LEG.length, 4, 12]} />
        <meshBasicMaterial />
      </mesh>
    </group>
  );
}

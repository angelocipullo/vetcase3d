import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { CoatColors } from '../game/types';
import { FRONT_LEFT_LEG } from './anatomy';

function useToonGradient() {
  return useMemo(() => {
    const data = new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]);
    const tex = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    return tex;
  }, []);
}

export interface DogProps {
  coat: CoatColors;
  respRate: number;
  /** Letti a ogni frame per evitare re-render React. */
  getMood: () => { stress: number; happyUntil: number };
  onPointerDown?: (e: ThreeEvent<PointerEvent>) => void;
  onPointerMove?: (e: ThreeEvent<PointerEvent>) => void;
  onPointerUp?: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOut?: (e: ThreeEvent<PointerEvent>) => void;
}

/**
 * Cane procedurale in stile toon/Nintendogs: forme morbide, occhioni, orecchie cadenti.
 * Tutto è costruito da primitive così l'app gira senza asset esterni.
 */
export function Dog({ coat, respRate, getMood, ...events }: DogProps) {
  const gradientMap = useToonGradient();
  const mat = useMemo(() => {
    const m = (color: string) => new THREE.MeshToonMaterial({ color, gradientMap });
    return {
      base: m(coat.base),
      belly: m(coat.belly),
      ears: m(coat.ears),
      dark: new THREE.MeshToonMaterial({ color: '#1d1414', gradientMap }),
      white: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
      pink: m('#ff8fa3'),
    };
  }, [coat, gradientMap]);

  const root = useRef<THREE.Group>(null);
  const chest = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const tongue = useRef<THREE.Mesh>(null);
  const blink = useRef({ next: 2, until: 0 });

  useFrame(({ clock, pointer }, dt) => {
    const t = clock.elapsedTime;
    const { stress, happyUntil } = getMood();
    const happy = performance.now() < happyUntil;
    // respiro proporzionale alla frequenza respiratoria del caso
    const br = Math.sin((t * Math.PI * 2 * respRate) / 60);
    if (chest.current) {
      chest.current.scale.set(1, 1 + br * 0.025, 1 + br * 0.035);
    }
    // coda: scodinzola tanto se felice, poco se stressato
    if (tail.current) {
      const speed = happy ? 16 : stress > 60 ? 2 : 7;
      const amp = happy ? 0.7 : stress > 60 ? 0.08 : 0.3;
      tail.current.rotation.y = Math.sin(t * speed) * amp;
      tail.current.rotation.z = stress > 60 ? -0.9 : -0.25;
    }
    // testa: segue un po' il puntatore, si inclina in stile Nintendogs
    if (head.current) {
      const ty = THREE.MathUtils.clamp(pointer.x * 0.5, -0.4, 0.6);
      const tz = happy ? Math.sin(t * 4) * 0.15 : Math.sin(t * 0.7) * 0.08;
      head.current.rotation.y = THREE.MathUtils.damp(head.current.rotation.y, ty, 3, dt);
      head.current.rotation.x = THREE.MathUtils.damp(head.current.rotation.x, tz, 3, dt);
    }
    // blink
    if (eyes.current) {
      const b = blink.current;
      if (t > b.next) {
        b.until = t + 0.12;
        b.next = t + 2 + Math.random() * 3;
      }
      eyes.current.scale.y = t < b.until ? 0.1 : 1;
    }
    if (tongue.current) tongue.current.visible = happy || respRate > 40;
    // tremore se stressato
    if (root.current) {
      const tr = stress > 70 ? (stress - 70) / 30 : 0;
      root.current.position.x = Math.sin(t * 60) * 0.004 * tr;
      root.current.position.z = Math.cos(t * 53) * 0.003 * tr;
    }
  });

  const L = FRONT_LEFT_LEG;
  const leg = (x: number, z: number, name: string, thick = 1) => (
    <group key={name}>
      <mesh name={name} position={[x, L.y, z]} material={mat.base} castShadow>
        <capsuleGeometry args={[L.radius * thick, L.length, 8, 16]} />
      </mesh>
      <mesh position={[x + 0.03, 0.05, z]} scale={[1.35, 0.6, 1]} material={mat.belly} castShadow>
        <sphereGeometry args={[0.1, 20, 16]} />
      </mesh>
    </group>
  );

  return (
    <group ref={root} {...events}>
      {/* torace / corpo */}
      <group ref={chest} position={[0, 0.85, 0]}>
        <mesh name="body" rotation={[0, 0, Math.PI / 2]} material={mat.base} castShadow>
          <capsuleGeometry args={[0.38, 0.9, 12, 32]} />
        </mesh>
        <mesh position={[0.05, -0.06, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 0.92]} material={mat.belly}>
          <capsuleGeometry args={[0.335, 0.8, 12, 32]} />
        </mesh>
      </group>

      {/* zampe */}
      {leg(L.x, L.z, 'leg_fl')}
      {leg(L.x, -L.z, 'leg_fr')}
      {leg(-0.42, 0.2, 'leg_bl', 1.1)}
      {leg(-0.42, -0.2, 'leg_br', 1.1)}
      <mesh position={[-0.42, 0.68, 0.16]} material={mat.base}>
        <sphereGeometry args={[0.2, 20, 16]} />
      </mesh>
      <mesh position={[-0.42, 0.68, -0.16]} material={mat.base}>
        <sphereGeometry args={[0.2, 20, 16]} />
      </mesh>

      {/* collo */}
      <mesh position={[0.55, 1.12, 0]} rotation={[0, 0, -0.75]} material={mat.base}>
        <capsuleGeometry args={[0.2, 0.25, 8, 20]} />
      </mesh>

      {/* testa */}
      <group ref={head} position={[0.75, 1.36, 0]}>
        <mesh name="head" material={mat.base} castShadow>
          <sphereGeometry args={[0.3, 32, 24]} />
        </mesh>
        <mesh position={[0.25, -0.08, 0]} scale={[1.15, 0.78, 0.9]} material={mat.belly}>
          <sphereGeometry args={[0.17, 24, 18]} />
        </mesh>
        <mesh position={[0.43, -0.02, 0]} material={mat.dark}>
          <sphereGeometry args={[0.055, 16, 12]} />
        </mesh>
        <mesh ref={tongue} position={[0.33, -0.2, 0]} rotation={[0, 0, -0.3]} scale={[0.6, 1, 0.8]} material={mat.pink}>
          <capsuleGeometry args={[0.045, 0.08, 6, 12]} />
        </mesh>
        <group ref={eyes}>
          {[1, -1].map((s) => (
            <group key={s} position={[0.22, 0.09, 0.14 * s]}>
              <mesh material={mat.dark}>
                <sphereGeometry args={[0.058, 20, 16]} />
              </mesh>
              <mesh position={[0.045, 0.022, 0.012 * s]} material={mat.white}>
                <sphereGeometry args={[0.018, 10, 8]} />
              </mesh>
            </group>
          ))}
        </group>
        {[1, -1].map((s) => (
          <mesh
            key={s}
            position={[-0.06, 0.03, 0.27 * s]}
            rotation={[0.35 * s, 0, 0.15]}
            scale={[0.55, 1.25, 0.25]}
            material={mat.ears}
            castShadow
          >
            <sphereGeometry args={[0.17, 20, 16]} />
          </mesh>
        ))}
      </group>

      {/* coda */}
      <group ref={tail} position={[-0.78, 1.02, 0]}>
        <mesh position={[-0.08, 0.15, 0]} rotation={[0, 0, 0.5]} material={mat.base} castShadow>
          <capsuleGeometry args={[0.05, 0.3, 6, 12]} />
        </mesh>
      </group>
    </group>
  );
}

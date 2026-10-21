import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { CoatColors } from '../game/types';
import { DOG_TRANSFORM, FRONT_LEFT_LEG, ZONES } from './anatomy';

/**
 * Cane realistico: "PitBull" di Joseph AYYAD (Sketchfab, CC-BY 4.0), ottimizzato in
 * `public/models/dog.glb`. Animazioni incluse: Bark, Die, Eat, IDdle, Run, Sit, Stand up, Walkl.
 * Sopra l'animazione di base aggiungiamo via codice scodinzolio, ansimare, sguardo e tremore.
 */
export const DOG_URL = '/models/dog.glb';

/** Ossa di collo e testa: delle loro tracce teniamo solo la rotazione (vedi `actions`). */
const STRETCHY_BONES = /^(NeckPart\d_M|Head_M)_/;

/**
 * Parte utile della clip Bark (secondi): testa in avanti e bocca aperta. Prima (carica) e dopo
 * (ritorno) la testa viene tirata verso le spalle e lo skinning del collo fa una piega sulla gola.
 */
const BARK_WINDOW = [0.4, 0.85] as const;

type Clip = 'Bark' | 'Die' | 'Eat' | 'IDdle' | 'Run' | 'Sit' | 'Stand up' | 'Walkl';

/** Evento "abbaia": Scene lo chiama insieme al suono. */
const barkListeners = new Set<() => void>();
export function dogBark() {
  barkListeners.forEach((f) => f());
}

export interface DogProps {
  coat: CoatColors;
  respRate: number;
  /** Letti a ogni frame per evitare re-render React. */
  getMood: () => { stress: number; happyUntil: number; tailUp?: boolean };
  onPointerDown?: (e: ThreeEvent<PointerEvent>) => void;
  onPointerMove?: (e: ThreeEvent<PointerEvent>) => void;
  onPointerUp?: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOut?: (e: ThreeEvent<PointerEvent>) => void;
}

/** Rotazione (rad, attorno all'asse laterale) di Tail0..2 quando la coda è sollevata. */
const TAIL_LIFT = [1.1, 0.35, 0.2];

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const WORLD_SIDE = new THREE.Vector3(0, 0, 1);
const _q = new THREE.Quaternion();
const _pq = new THREE.Quaternion();
const _axis = new THREE.Vector3();

/** Ruota un osso attorno a un asse espresso in coordinate mondo (additivo sulla posa corrente). */
function rotateWorld(bone: THREE.Object3D, worldAxis: THREE.Vector3, angle: number) {
  if (!bone.parent || angle === 0) return;
  bone.parent.getWorldQuaternion(_pq);
  _axis.copy(worldAxis).applyQuaternion(_pq.invert());
  bone.quaternion.premultiply(_q.setFromAxisAngle(_axis, angle));
}

export function Dog({ respRate, getMood, ...events }: DogProps) {
  const { scene, animations } = useGLTF(DOG_URL);
  const model = useMemo(() => {
    const m = SkeletonUtils.clone(scene);
    m.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        // il bounding sphere della posa di bind (seduta) taglierebbe i raycast sulla posa in piedi
        o.frustumCulled = false;
      }
    });
    return m;
  }, [scene]);

  const bones = useMemo(() => {
    const get = (n: string) => model.getObjectByName(n) ?? undefined;
    return {
      jaw: get('Jaw_M_027'),
      neck: get('Neck_M_022'),
      head: get('Head_M_026'),
      tail: ['Tail0_M_06', 'Tail1_M_07', 'Tail2_M_08'].map(get).filter(Boolean) as THREE.Object3D[],
    };
  }, [model]);

  const mixer = useMemo(() => new THREE.AnimationMixer(model), [model]);
  const actions = useMemo(() => {
    const out = {} as Record<Clip, THREE.AnimationAction>;
    for (const source of animations) {
      const name = source.name.split('|').pop() as Clip;
      // Le clip (soprattutto Bark) allungano/accorciano e spostano i segmenti del collo con tracce di
      // traslazione ("squash & stretch"): su questo skinning il collo si gonfia e fa una piega sotto
      // la gola. Teniamo solo le rotazioni di collo e testa.
      const clip = source.clone();
      clip.tracks = clip.tracks.filter((t) => !(t.name.endsWith('.position') && STRETCHY_BONES.test(t.name)));
      out[name] = mixer.clipAction(clip);
    }
    return out;
  }, [animations, mixer]);

  useEffect(() => {
    const idle = actions.IDdle;
    idle.play();
    const bark = actions.Bark;
    bark.setLoop(THREE.LoopOnce, 1);
    const onBark = () => {
      bark.reset();
      bark.time = BARK_WINDOW[0];
      bark.setEffectiveWeight(1).fadeIn(0.12).play();
      idle.fadeOut(0.12);
    };
    barkListeners.add(onBark);
    return () => {
      barkListeners.delete(onBark);
      mixer.stopAllAction();
    };
  }, [actions, mixer]);

  // debug in sviluppo per calibrare `anatomy.ts` (usa __dogSkin: le ossa non coincidono con la mesh)
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as Record<string, unknown>).__dogBones = () => {
      model.updateMatrixWorld(true);
      const out: Record<string, number[]> = {};
      model.traverse((o) => {
        if ((o as THREE.Bone).isBone) {
          const p = o.getWorldPosition(new THREE.Vector3());
          out[o.name] = [p.x, p.y, p.z].map((v) => +v.toFixed(3));
        }
      });
      return out;
    };
    // centro e raggio della mesh deformata attorno a ogni osso (pesi dominanti), nella posa attuale
    (window as unknown as Record<string, unknown>).__dogSkin = () => {
      model.updateMatrixWorld(true);
      const acc = new Map<string, { n: number; c: THREE.Vector3; min: THREE.Vector3; max: THREE.Vector3 }>();
      const v = new THREE.Vector3();
      model.traverse((o) => {
        const s = o as THREE.SkinnedMesh;
        if (!s.isSkinnedMesh) return;
        const { position, skinIndex, skinWeight } = s.geometry.attributes;
        for (let i = 0; i < position.count; i++) {
          let best = 0;
          for (let k = 1; k < 4; k++) if (skinWeight.getComponent(i, k) > skinWeight.getComponent(i, best)) best = k;
          const name = s.skeleton.bones[skinIndex.getComponent(i, best)].name;
          s.applyBoneTransform(i, v.fromBufferAttribute(position, i));
          v.applyMatrix4(s.matrixWorld);
          const a = acc.get(name) ?? { n: 0, c: new THREE.Vector3(), min: new THREE.Vector3(1e9, 1e9, 1e9), max: new THREE.Vector3(-1e9, -1e9, -1e9) };
          a.n++;
          a.c.add(v);
          a.min.min(v);
          a.max.max(v);
          acc.set(name, a);
        }
      });
      const r = (p: THREE.Vector3) => [p.x, p.y, p.z].map((x) => +x.toFixed(3));
      return Object.fromEntries([...acc].map(([k, a]) => [k, { n: a.n, c: r(a.c.divideScalar(a.n)), min: r(a.min), max: r(a.max) }]));
    };
  }, [model]);

  // le rotazioni additive vanno annullate prima che il mixer riscriva la posa
  const saved = useRef(new Map<THREE.Object3D, THREE.Quaternion>());
  const root = useRef<THREE.Group>(null);
  const tailLift = useRef(0);

  useFrame(({ clock, pointer }, dt) => {
    for (const [b, q] of saved.current) b.quaternion.copy(q);
    mixer.update(dt);
    // fine dell'abbaio: ci fermiamo sull'ultima posa buona e sfumiamo verso l'Idle (vedi BARK_WINDOW)
    const bark = actions.Bark;
    if (bark.isRunning() && bark.time >= BARK_WINDOW[1]) {
      bark.paused = true;
      bark.fadeOut(0.3);
      actions.IDdle.reset().fadeIn(0.3).play();
    }
    const touched = [bones.jaw, bones.neck, ...bones.tail].filter(Boolean) as THREE.Object3D[];
    for (const b of touched) {
      const q = saved.current.get(b) ?? new THREE.Quaternion();
      saved.current.set(b, q.copy(b.quaternion));
    }

    const t = clock.elapsedTime;
    const { stress, happyUntil, tailUp } = getMood();
    const happy = performance.now() < happyUntil;
    const barking = actions.Bark.isRunning();

    // coda: scodinzola tanto se felice, poco se stressato
    const speed = happy ? 14 : stress > 60 ? 2 : 6;
    const amp = happy ? 0.35 : stress > 60 ? 0.04 : 0.12;
    // coda sollevata per la temperatura rettale (scodinzola meno mentre è su)
    tailLift.current = THREE.MathUtils.damp(tailLift.current, tailUp ? 1 : 0, 3, dt);
    const lift = tailLift.current;
    bones.tail.forEach((b, i) => {
      rotateWorld(b, WORLD_SIDE, TAIL_LIFT[i] * lift);
      rotateWorld(b, WORLD_UP, Math.sin(t * speed - i * 0.6) * amp * (1 + i * 0.3) * (1 - 0.8 * lift));
    });

    // testa: segue un po' il puntatore
    if (bones.neck && !barking) {
      rotateWorld(bones.neck, WORLD_UP, THREE.MathUtils.clamp(-pointer.x * 0.35, -0.3, 0.3));
      rotateWorld(bones.neck, WORLD_SIDE, THREE.MathUtils.clamp(pointer.y * 0.15, -0.1, 0.15));
    }

    // ansima se felice o con frequenza respiratoria alta (al ritmo del respiro)
    if (bones.jaw && !barking && (happy || respRate > 40)) {
      const br = 0.5 + 0.5 * Math.sin((t * Math.PI * 2 * Math.max(respRate, 60)) / 60);
      rotateWorld(bones.jaw, WORLD_SIDE, -0.18 * br);
    }

    // tremore se stressato
    if (root.current) {
      const tr = stress > 70 ? (stress - 70) / 30 : 0;
      root.current.position.x = DOG_TRANSFORM.offsetX + Math.sin(t * 60) * 0.004 * tr;
      root.current.position.z = Math.cos(t * 53) * 0.003 * tr;
    }
  });

  const L = FRONT_LEFT_LEG;
  const S = DOG_TRANSFORM.scale;
  return (
    <group {...events}>
      {/* muso verso +X; specchiato così il fianco SINISTRO guarda la camera (+Z) */}
      <group ref={root} position={[DOG_TRANSFORM.offsetX, 0, 0]} rotation={[0, Math.PI / 2, 0]} scale={[-S, S, S]}>
        <primitive object={model} />
      </group>
      {/* collider invisibile della zona perineale: il punto rettale sta sul bordo della silhouette */}
      <mesh name="perineum" position={ZONES.rectal} visible={false}>
        <sphereGeometry args={[0.1, 12, 8]} />
        <meshBasicMaterial />
      </mesh>
      {/* collider invisibile dell'avambraccio sinistro: serve al prelievo dalla vena cefalica */}
      <mesh name="leg_fl" position={[L.x, L.y, L.z]} visible={false}>
        <capsuleGeometry args={[L.radius, L.length, 4, 12]} />
        <meshBasicMaterial />
      </mesh>
    </group>
  );
}

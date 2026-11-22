import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import type { CatColors } from './Cat';
import type { DogProps } from './Dog';
import { FRONT_LEFT_LEG, ZONES } from './anatomy';

/**
 * Gatto glTF riggato ("calico-cami" di Cartoon cat oficial, Sketchfab, CC BY 4.0, crediti in
 * `public/models/CREDITS.md`). Se `public/models/cat.glb` non si carica si usa il gatto in codice (vedi `catModelAvailable`).
 * Il modello non ha animazioni: respiro, coda, testa e tremore sono fatti nel codice sulle ossa.
 * Nel file il muso guarda +Z e il fianco sinistro +X, in centimetri: lo scaliamo e lo specchiamo come il cane,
 * così il muso va verso +X e il fianco sinistro verso la camera (+Z).
 */
export const CAT_URL = '/models/cat.glb';
export const CAT_TRANSFORM = { scale: 0.034, offsetX: -0.1 };

let available: Promise<boolean> | null = null;
/** Il file del gatto c'è? (in sviluppo Vite risponde con index.html anche ai file mancanti: si guarda il tipo). */
export function catModelAvailable() {
  available ??= fetch(CAT_URL, { method: 'HEAD' })
    .then((r) => r.ok && !(r.headers.get('content-type') ?? '').includes('text/html'))
    .catch(() => false);
  return available;
}

/** Curva della coda a riposo (radianti attorno all'asse laterale): base che cade, punta che risale; alzata per il termometro. */
const TAIL_DROOP = -0.6;
const TAIL_CURL = 0.2;
const TAIL_LIFT = 0.9;

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

export function CatModel({ colors, respRate, getMood, ...events }: DogProps & { colors: CatColors }) {
  const { scene } = useGLTF(CAT_URL);
  const model = useMemo(() => {
    const m = SkeletonUtils.clone(scene);
    // tinta del caso sul mantello calico (moltiplica la texture: chiara dove il pelo è bianco)
    const tint = new THREE.Color(colors.fur).lerp(new THREE.Color('#ffffff'), 0.45);
    m.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      const tinted = (mat: THREE.Material) => {
        const c = (mat as THREE.MeshStandardMaterial).clone();
        if (/Body|Fur/i.test(c.name) && c.color) c.color.copy(tint);
        return c;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(tinted) : tinted(mesh.material);
    });
    return m;
  }, [scene, colors.fur]);

  const bones = useMemo(() => {
    const get = (n: string) => model.getObjectByName(n) ?? undefined;
    const list = (ns: string[]) => ns.map(get).filter(Boolean) as THREE.Object3D[];
    return {
      neck: get('neck_04_022'),
      head: get('head_023'),
      chest: list(['spine_03_05', 'spine_04_06']),
      tail: list(['tail_base_072', 'tail_01_073', 'tail_02_074', 'tail_03_075', 'tail_04_076', 'tail_05_077', 'tail_06_078', 'tail_07_079']),
    };
  }, [model]);

  // posa di riposo (il modello non ha clip): ogni frame si riparte da qui e si aggiungono i movimenti
  const rest = useMemo(() => {
    const r = new Map<THREE.Object3D, { q: THREE.Quaternion; s: THREE.Vector3; p: THREE.Vector3 }>();
    model.traverse((o) => {
      if ((o as THREE.Bone).isBone) r.set(o, { q: o.quaternion.clone(), s: o.scale.clone(), p: o.position.clone() });
    });
    return r;
  }, [model]);

  // debug in sviluppo: sezione della mesh deformata, per calibrare anatomy.ts (come __dogSlice)
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as Record<string, unknown>).__catSlice = (y0: number, y1: number, x0: number, x1: number, zMin = 0.02) => {
      model.updateMatrixWorld(true);
      const v = new THREE.Vector3();
      const box = new THREE.Box3();
      model.traverse((o) => {
        const s = o as THREE.SkinnedMesh;
        if (!s.isSkinnedMesh) return;
        const { position } = s.geometry.attributes;
        for (let i = 0; i < position.count; i++) {
          s.applyBoneTransform(i, v.fromBufferAttribute(position, i));
          v.applyMatrix4(s.matrixWorld);
          if (v.y >= y0 && v.y <= y1 && v.z > zMin && v.x >= x0 && v.x <= x1) box.expandByPoint(v);
        }
      });
      const r = (n: number) => +n.toFixed(3);
      return { min: [r(box.min.x), r(box.min.y), r(box.min.z)], max: [r(box.max.x), r(box.max.y), r(box.max.z)] };
    };
    (window as unknown as Record<string, unknown>).__catBones = () => {
      model.updateMatrixWorld(true);
      const out: Record<string, number[]> = {};
      model.traverse((o) => {
        if ((o as THREE.Bone).isBone) out[o.name] = o.getWorldPosition(new THREE.Vector3()).toArray().map((x) => +x.toFixed(3));
      });
      return out;
    };
  }, [model]);

  const root = useRef<THREE.Group>(null);
  const tailLift = useRef(0);
  // i clic sul modello passano prima da una sfera di ingombro calcolata sulla posa originale del file:
  // la si ricalcola sulla posa vera (scalata e orientata) con un po' di margine, se no la groppa non risponde
  const bounds = useRef(false);

  useFrame(({ clock }, dt) => {
    if (!bounds.current) {
      bounds.current = true;
      model.updateMatrixWorld(true);
      model.traverse((o) => {
        const sm = o as THREE.SkinnedMesh;
        if (!sm.isSkinnedMesh) return;
        sm.computeBoundingBox();
        sm.computeBoundingSphere();
        sm.boundingSphere?.radius && (sm.boundingSphere.radius *= 1.3);
      });
    }
    for (const [b, r] of rest) {
      b.quaternion.copy(r.q);
      b.scale.copy(r.s);
      b.position.copy(r.p);
    }
    const t = clock.elapsedTime;
    const { stress, happyUntil, tailUp, breath = 0.45, still, freeze } = getMood();
    if (freeze) {
      // prelievo: paziente immobile nella posa di riposo
      if (root.current) root.current.position.set(CAT_TRANSFORM.offsetX, 0, 0);
      return;
    }
    const happy = performance.now() < happyUntil;

    // respiro: le vertebre toraciche si allargano; le ossa figlie restano al loro posto e della loro misura
    const insp = Math.max(0, Math.sin((t * Math.PI * 2 * respRate) / 60));
    const k = 1 + 0.1 * breath * insp;
    for (const b of bones.chest) {
      if (!bones.chest.includes(b.parent!)) b.scale.multiplyScalar(k);
      for (const ch of b.children) {
        if (!(ch as THREE.Bone).isBone) continue;
        ch.position.multiplyScalar(1 / k);
        if (!bones.chest.includes(ch)) ch.scale.multiplyScalar(1 / k);
      }
    }

    // coda: a riposo scende dalla groppa e risale con la punta (a "J"); un'onda la percorre dalla base
    // alla punta, più ampia verso la punta, con qualche guizzo; si alza per la temperatura rettale
    tailLift.current = THREE.MathUtils.damp(tailLift.current, tailUp ? 1 : 0, 3, dt);
    const lift = tailLift.current;
    const free = 1 - 0.85 * lift;
    const speed = happy ? 5.5 : stress > 60 ? 3.2 : 1.6;
    const amp = happy ? 0.2 : stress > 60 ? 0.07 : 0.12;
    // guizzo della punta ogni tanto (più spesso se il gatto è agitato)
    const flickPeriod = stress > 60 ? 2.2 : 4.5;
    const ph = (t % flickPeriod) / flickPeriod;
    const flick = ph > 0.86 ? Math.sin(((ph - 0.86) / 0.14) * Math.PI) : 0;
    const n = bones.tail.length;
    bones.tail.forEach((b, i) => {
      const f = i / Math.max(1, n - 1);
      // forma: la base cade, le ultime vertebre risalgono
      const bend = i === 0 ? TAIL_DROOP : i < n * 0.4 ? TAIL_DROOP * 0.15 : TAIL_CURL;
      rotateWorld(b, WORLD_SIDE, bend * free + (i === 0 ? TAIL_LIFT * lift : 0));
      // onda laterale e un po' verticale, ritardata lungo la coda
      const wave = Math.sin(t * speed - i * 0.55) * amp * (0.35 + 0.9 * f);
      rotateWorld(b, WORLD_UP, (wave + flick * 0.35 * f * f) * free);
      rotateWorld(b, WORLD_SIDE, Math.sin(t * speed * 0.6 - i * 0.5 + 1.3) * 0.05 * f * free);
    });

    // testa: piccolo dondolio da fermo; immobile mentre si visita
    if (bones.neck && !still) {
      rotateWorld(bones.neck, WORLD_UP, Math.sin(t * 0.6) * 0.1);
      rotateWorld(bones.neck, WORLD_SIDE, Math.sin(t * 0.45) * 0.04);
    }

    if (root.current) {
      const tr = stress > 70 ? (stress - 70) / 30 : 0;
      root.current.position.x = CAT_TRANSFORM.offsetX + Math.sin(t * 60) * 0.003 * tr;
      root.current.position.y = 0.004 * breath * insp;
    }
  });

  const S = CAT_TRANSFORM.scale;
  return (
    <group {...events}>
      {/* muso verso +X; specchiato così il fianco SINISTRO guarda la camera (+Z), come il cane */}
      <group ref={root} position={[CAT_TRANSFORM.offsetX, 0, 0]} rotation={[0, Math.PI / 2, 0]} scale={[-S, S, S]}>
        <primitive object={model} />
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

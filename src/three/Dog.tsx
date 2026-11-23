import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { DOG_TRANSFORM, FRONT_LEFT_LEG, ZONES } from './anatomy';

/**
 * Cane realistico: "PitBull" di Joseph AYYAD (Sketchfab, CC-BY 4.0), ottimizzato in
 * `public/models/dog.glb`. Animazioni incluse: Bark, Die, Eat, IDdle, Run, Sit, Stand up, Walkl.
 * Sopra l'animazione di base aggiungiamo via codice scodinzolio, ansimare, sguardo e tremore.
 */
export const DOG_URL = '/models/dog.glb';

/** Ossa che girano la testa nell'animazione in piedi: rotazione bloccata sulla posa iniziale. */
const HEAD_TURN_BONES = /^(NeckPart\d_M|Head_M)_/;

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
  respRate: number;
  /**
   * Letti a ogni frame per evitare re-render React. `breath` = ampiezza del respiro visibile (0..1),
   * `still` = testa ferma mentre si usa uno strumento; `freeze` = paziente immobile (prelievo).
   */
  getMood: () => { stress: number; happyUntil: number; tailUp?: boolean; breath?: number; still?: boolean; freeze?: boolean };
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
      // torace e tratto toracico della colonna: si espandono a ogni inspirazione
      chest: ['Chest_M_016', 'Spine1_M_014'].map(get).filter(Boolean) as THREE.Object3D[],
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
      // In piedi (Idle) il cane girava la testa (~26°) e il collo (~15° per segmento) a ogni ciclo:
      // collo e testa restano fermi nella posa iniziale, il resto del corpo continua a muoversi appena.
      if (name === 'IDdle') {
        clip.tracks = clip.tracks.map((t) =>
          HEAD_TURN_BONES.test(t.name) && t.name.endsWith('.quaternion')
            ? new THREE.QuaternionKeyframeTrack(t.name, [0], Array.from(t.values.slice(0, 4)))
            : t,
        );
      }
      out[name] = mixer.clipAction(clip);
    }
    return out;
  }, [animations, mixer]);

  useEffect(() => {
    const idle = actions.IDdle;
    // respirazione/oscillazione di base più lenta e calma: a velocità piena il cane sul tavolo sembrava agitato
    idle.timeScale = 0.7;
    idle.play();
    const bark = actions.Bark;
    bark.setLoop(THREE.LoopOnce, 1);
    bark.timeScale = 0.85;
    const onBark = () => {
      if (bark.isRunning()) return;
      bark.reset();
      bark.time = BARK_WINDOW[0];
      // L'abbaio si aggiunge SOPRA la posa in piedi, che resta sempre a peso pieno: three.js completa
      // con la posa di bind del modello (seduta) ogni volta che la somma dei pesi scende sotto 1, e
      // con le dissolvenze incrociate il cane si abbassava o si sedeva. Con Idle fisso a 1 non succede.
      bark.setEffectiveWeight(1.4).fadeIn(0.3).play();
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
    // sezione della mesh tra due altezze, per un lato (z>0 = sinistro) e un intervallo di x: per calibrare la zampa
    (window as unknown as Record<string, unknown>).__dogSlice = (y0: number, y1: number, x0: number, x1: number) => {
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
          if (v.y >= y0 && v.y <= y1 && v.z > 0.02 && v.x >= x0 && v.x <= x1) box.expandByPoint(v);
        }
      });
      const r = (n: number) => +n.toFixed(3);
      return { min: [r(box.min.x), r(box.min.y), r(box.min.z)], max: [r(box.max.x), r(box.max.y), r(box.max.z)] };
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
  const savedScale = useRef(new Map<THREE.Object3D, THREE.Vector3>());
  const savedPos = useRef(new Map<THREE.Object3D, THREE.Vector3>());
  const root = useRef<THREE.Group>(null);
  const tailLift = useRef(0);
  const tailAmp = useRef(0.08);
  const jawOpen = useRef(0);

  useFrame(({ clock }, dt) => {
    for (const [b, q] of saved.current) b.quaternion.copy(q);
    for (const [b, s] of savedScale.current) b.scale.copy(s);
    for (const [b, p] of savedPos.current) b.position.copy(p);
    // prelievo: posa congelata (niente animazione, respiro, sguardo, tremore): la zampa non si muove
    if (getMood().freeze) {
      if (root.current) root.current.position.set(DOG_TRANSFORM.offsetX, 0, 0);
      // posa fissa e sempre uguale: l'animazione in piedi (Idle) bloccata all'inizio, su cui è misurata la
      // zampa. Senza, la prima volta il modello resterebbe nella posa di bind, seduto.
      const idle = actions.IDdle;
      if (actions.Bark.isRunning()) actions.Bark.stop();
      idle.reset().setEffectiveWeight(1).play();
      idle.time = 0;
      mixer.update(0);
      return;
    }
    mixer.update(dt);
    // fine dell'abbaio: ci fermiamo sull'ultima posa buona e sfumiamo verso l'Idle (vedi BARK_WINDOW)
    const bark = actions.Bark;
    if (bark.isRunning() && !bark.paused && bark.time >= BARK_WINDOW[1]) {
      bark.paused = true;
      bark.fadeOut(0.5);
    }
    // la posa in piedi non deve mai sfumare o fermarsi (vedi onBark)
    const idleNow = actions.IDdle;
    if (!idleNow.enabled || !idleNow.isRunning() || idleNow.getEffectiveWeight() < 1) {
      idleNow.enabled = true;
      idleNow.setEffectiveWeight(1).play();
    }
    const touched = [bones.jaw, bones.neck, ...bones.tail].filter(Boolean) as THREE.Object3D[];
    for (const b of touched) {
      const q = saved.current.get(b) ?? new THREE.Quaternion();
      saved.current.set(b, q.copy(b.quaternion));
    }

    const t = clock.elapsedTime;
    const { stress, happyUntil, tailUp, breath = 0.45 } = getMood();

    // respiro: il torace si espande alla frequenza respiratoria del caso; le ossa figlie vengono
    // compensate (scala E posizione) così collo, testa e arti non cambiano né dimensione né posto:
    // vena cefalica, polso e muso restano dove li aspettano i punti anatomici
    const insp = Math.max(0, Math.sin((t * Math.PI * 2 * respRate) / 60));
    const k = 1 + 0.1 * breath * insp;
    const remember = (o: THREE.Object3D) => {
      const sc = savedScale.current.get(o) ?? new THREE.Vector3();
      savedScale.current.set(o, sc.copy(o.scale));
      const ps = savedPos.current.get(o) ?? new THREE.Vector3();
      savedPos.current.set(o, ps.copy(o.position));
    };
    for (const b of bones.chest) {
      // solo la radice della catena si scala: le ossa del torace figlie ereditano l'espansione
      if (!bones.chest.includes(b.parent!)) {
        remember(b);
        b.scale.multiplyScalar(k);
      }
      for (const ch of b.children) {
        if (!(ch as THREE.Bone).isBone) continue;
        remember(ch);
        // resta ancorato dov'era (la posizione è nello spazio scalato del genitore)…
        ch.position.multiplyScalar(1 / k);
        // …e, se è fuori dal torace (collo, arti), non si gonfia
        if (!bones.chest.includes(ch)) ch.scale.multiplyScalar(1 / k);
      }
    }

    const happy = performance.now() < happyUntil;
    const barking = actions.Bark.isRunning();

    // coda: scodinzola se felice, poco se stressato (velocità e ampiezza moderate, cambi graduali)
    const speed = happy ? 8 : stress > 60 ? 1.5 : 3.5;
    tailAmp.current = THREE.MathUtils.damp(tailAmp.current, happy ? 0.26 : stress > 60 ? 0.03 : 0.08, 2.5, dt);
    const amp = tailAmp.current;
    // coda sollevata per la temperatura rettale (scodinzola meno mentre è su)
    tailLift.current = THREE.MathUtils.damp(tailLift.current, tailUp ? 1 : 0, 3, dt);
    const lift = tailLift.current;
    bones.tail.forEach((b, i) => {
      rotateWorld(b, WORLD_SIDE, TAIL_LIFT[i] * lift);
      rotateWorld(b, WORLD_UP, Math.sin(t * speed - i * 0.6) * amp * (1 + i * 0.3) * (1 - 0.8 * lift));
    });

    // testa: ferma (niente sguardo che segue il puntatore)

    // ansima solo se felice o con respiro molto frequente: bocca socchiusa, ritmo lento, entra ed esce gradualmente
    jawOpen.current = THREE.MathUtils.damp(jawOpen.current, !barking && (happy || respRate > 40) ? 1 : 0, 2, dt);
    if (bones.jaw && jawOpen.current > 0.01) {
      const br = 0.5 + 0.5 * Math.sin((t * Math.PI * 2 * Math.min(Math.max(respRate, 40), 70)) / 60);
      rotateWorld(bones.jaw, WORLD_SIDE, -0.1 * br * jawOpen.current);
    }

    // tremore se molto stressato: lieve e non a scatti
    if (root.current) {
      const tr = stress > 75 ? (stress - 75) / 25 : 0;
      root.current.position.x = DOG_TRANSFORM.offsetX + Math.sin(t * 22) * 0.0015 * tr;
      // a ogni inspirazione il dorso si solleva appena
      root.current.position.y = 0.006 * breath * insp;
      root.current.position.z = Math.cos(t * 19) * 0.001 * tr;
    }
  });

  const S = DOG_TRANSFORM.scale;
  return (
    <group {...events}>
      {/* muso verso +X; specchiato così il fianco SINISTRO guarda la camera (+Z) */}
      <group ref={root} position={[DOG_TRANSFORM.offsetX, 0, 0]} rotation={[0, Math.PI / 2, 0]} scale={[-S, S, S]}>
        <primitive object={model} />
      </group>
      {/* collider invisibile dell'avambraccio sinistro: serve al prelievo dalla vena cefalica */}
      <mesh name="leg_fl" position={[FRONT_LEFT_LEG.x, FRONT_LEFT_LEG.y, FRONT_LEFT_LEG.z]} visible={false}>
        <capsuleGeometry args={[FRONT_LEFT_LEG.radius, FRONT_LEFT_LEG.length, 4, 12]} />
        <meshBasicMaterial />
      </mesh>
      {/* collider invisibile della zona perineale: il punto rettale sta sul bordo della silhouette */}
      <mesh name="perineum" position={ZONES.rectal} visible={false}>
        <sphereGeometry args={[0.1, 12, 8]} />
        <meshBasicMaterial />
      </mesh>
    </group>
  );
}

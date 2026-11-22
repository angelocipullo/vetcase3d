import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';

/**
 * Mano glTF riggata ("the Hand" di sayjing, Sketchfab, licenza Sketchfab Standard; crediti in
 * public/models/CREDITS.md), usata per il polso femorale se `public/models/hand.glb` c'è
 * (vedi `handModelAvailable`). Senza il file resta la mano costruita in codice (Instruments.tsx).
 *
 * Nel file le dita guardano +X, il palmo −Y e il pollice −Z, ~1,2 unità dal polso alle punte. Qui la
 * mano è girata con le dita verso −X e il palmo lontano dalla camera, scalata e spostata in modo che le
 * punte di indice e medio stiano nell'origine: lo stesso riferimento della mano in codice.
 */
export const HAND_URL = '/models/hand.glb';
const GLOVE = '#a5d8ff';
const SCALE = 0.205;

let available: Promise<boolean> | null = null;
/** Il file della mano c'è? (in sviluppo Vite risponde con index.html anche ai file mancanti: si guarda il tipo). */
export function handModelAvailable() {
  available ??= fetch(HAND_URL, { method: 'HEAD' })
    .then((r) => r.ok && !(r.headers.get('content-type') ?? '').includes('text/html'))
    .catch(() => false);
  return available;
}

type Pose = Map<THREE.Object3D, THREE.Quaternion>;

/**
 * Pose prese dall'animazione "GrabHold": riposo (dita distese), mezza presa, pugno chiuso.
 * Indice e medio restano quasi distesi e si piegano un poco a ogni battito (`hop`, 0..1);
 * anulare, mignolo e pollice restano chiusi.
 */
export function HandModel({ hop }: { hop: MutableRefObject<number> }) {
  const gltf = useGLTF(HAND_URL);
  const { model, rest, half, fist, feel, closed, tip, wrist } = useMemo(() => {
    const m = SkeletonUtils.clone(gltf.scene);
    const glove = new THREE.MeshStandardMaterial({ color: GLOVE, roughness: 0.45 });
    m.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.material = glove;
      mesh.castShadow = true;
      mesh.frustumCulled = false;
    });
    const bones: THREE.Object3D[] = [];
    m.traverse((o) => (o as THREE.Bone).isBone && bones.push(o));
    const snap = (): Pose => new Map(bones.map((b) => [b, b.quaternion.clone()]));
    const clip = gltf.animations.find((a) => a.name === 'GrabHold');
    const mixer = new THREE.AnimationMixer(m);
    let r: Pose, h: Pose, f: Pose;
    if (clip) {
      mixer.clipAction(clip).play();
      mixer.setTime(0);
      r = snap();
      mixer.setTime(clip.duration * 0.5);
      h = snap();
      mixer.setTime(clip.duration * 0.995);
      f = snap();
      mixer.stopAllAction();
      mixer.uncacheRoot(m);
    } else {
      r = h = f = snap();
    }
    // le dita che palpano; anulare, mignolo e pollice chiusi; polso e palmo restano a riposo
    const feel = bones.filter((b) => /Finger_(Index|Middle)/.test(b.name));
    const closed = bones.filter((b) => /Finger_(Ring|Pinky|Thumb)/.test(b.name));
    // posa di partenza per misurare dove sono le punte
    for (const b of bones) b.quaternion.copy((closed.includes(b) ? f : r).get(b)!);
    m.updateMatrixWorld(true);
    const a = m.getObjectByName('Finger_Index_end_07')?.getWorldPosition(new THREE.Vector3());
    const c = m.getObjectByName('Finger_Middle_end_011')?.getWorldPosition(new THREE.Vector3());
    const tip = a && c ? a.add(c).multiplyScalar(0.5) : new THREE.Vector3(0.55, 0.1, -0.15);
    const wrist = m.getObjectByName('Hand_Roll_01')?.getWorldPosition(new THREE.Vector3()) ?? new THREE.Vector3(-0.6, 0, 0);
    return { model: m, rest: r, half: h, fist: f, feel, closed, tip, wrist };
  }, [gltf]);

  const still = useMemo(() => [...rest.keys()].filter((b) => !feel.includes(b) && !closed.includes(b)), [rest, feel, closed]);

  useFrame(() => {
    for (const b of still) b.quaternion.copy(rest.get(b)!);
    for (const b of closed) b.quaternion.copy(fist.get(b)!);
    // poco piegate a riposo, di più nel saltello del battito
    const k = 0.12 + 0.28 * hop.current;
    for (const b of feel) b.quaternion.copy(rest.get(b)!).slerp(half.get(b)!, k);
  });

  return (
    // solo la mano, senza braccio, con il palmo verso la camera.
    // Esterno: le dita si inclinano verso la coda (−X, Rz) e le punte entrano verso l'interno coscia (−Z, Rx),
    // così indice e medio si infilano nell'inguine e toccano la faccia interna della coscia.
    <group rotation={[-0.7, 0, 1.45]}>
      {/* interno: Rz(π/2) dita verso l'alto, Ry(−π/2) palmo verso la camera (+Z) */}
      <group rotation={[0, -Math.PI / 2, Math.PI / 2]} scale={SCALE}>
        <primitive object={model} position={[-tip.x, -tip.y, -tip.z]} />
        {/* polso chiuso: coperchio dentro il bordo del guanto (apertura a x ≈ −0,65, raggio ≈ 0,25) */}
        <mesh position={[wrist.x - tip.x - 0.04, -tip.y, -tip.z]} scale={[0.05, 0.245, 0.245]}>
          <sphereGeometry args={[1, 20, 14]} />
          <meshStandardMaterial color={GLOVE} roughness={0.45} />
        </mesh>
      </group>
    </group>
  );
}

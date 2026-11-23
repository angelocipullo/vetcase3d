import { RoundedBox, useGLTF, useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../store';
import * as THREE from 'three';
import { preload, suspend } from 'suspend-react';

/**
 * Ambulatorio veterinario realistico: materiali PBR (texture Poly Haven, CC0), arredi glTF
 * Poly Haven (CC0) e poster disegnati su canvas. Crediti in `public/clinic/CREDITS.md`.
 *
 * Scala: 1 unità ≈ 0.43 m (il cane è una taglia media). Il piano del tavolo è a y = 0.
 * Le pareti sono a faccia singola rivolta verso l'interno: se la camera orbita oltre una parete,
 * questa sparisce ("casa delle bambole") invece di coprire il paziente.
 */
const M = 1 / 0.43; // metri → unità di scena
export const ROOM = { floor: -1.9, ceiling: 4.3, left: -5.2, right: 5.2, back: -3.4, front: 6.8 };
const BASE = '/clinic';
const model = (id: string) => `${BASE}/models/${id}.glb`;

/* ---------------------------------------------------------------- materiali */

type Surface = 'large_floor_tiles_02' | 'long_white_tiles' | 'painted_plaster_wall';
const SURFACES: Surface[] = ['large_floor_tiles_02', 'long_white_tiles', 'painted_plaster_wall'];

/** HDRI dell'illuminazione ambientale (usato in Scene). */
export const CLINIC_HDRI = `${BASE}/hospital_room_1k.hdr`;

/** URL delle mappe PBR di una superficie, nell'ordine in cui le carica `useTexture`. */
const pbrUrls = (id: Surface) => ({
  map: `${BASE}/textures/${id}_diff.jpg`,
  normalMap: `${BASE}/textures/${id}_nor.jpg`,
  roughnessMap: `${BASE}/textures/${id}_rough.jpg`,
});

const MODEL_IDS = [
  'wall_clock',
  'medical_box',
  'industrial_microscope',
  'clipboard',
  'hanging_picture_frame_01',
  'drawer_cabinet',
  'steel_frame_shelves_01',
  'potted_plant_02',
  'metal_stool_01',
  'mounted_fluorescent_lights',
  'modern_ceiling_lamp_01',
];

/** Avvia il download di modelli e texture dello studio (chiavi di cache identiche a quelle della scena). */
export function preloadClinic() {
  for (const id of MODEL_IDS) useGLTF.preload(model(id));
  for (const id of SURFACES) useTexture.preload(Object.values(pbrUrls(id)));
}

/** Set PBR (diffuse/normal/roughness) con repeat calcolato sulla dimensione reale del campione. */
function usePbr(id: Surface, sizeMeters: number, area: [number, number]) {
  const maps = useTexture(pbrUrls(id));
  return useMemo(() => {
    const tile = sizeMeters * M;
    const out = {} as typeof maps;
    for (const [k, t] of Object.entries(maps) as [keyof typeof maps, THREE.Texture][]) {
      const c = t.clone();
      c.wrapS = c.wrapT = THREE.RepeatWrapping;
      c.repeat.set(area[0] / tile, area[1] / tile);
      c.anisotropy = 8;
      if (k === 'map') c.colorSpace = THREE.SRGBColorSpace;
      c.needsUpdate = true;
      out[k] = c;
    }
    return out;
  }, [maps, sizeMeters, area[0], area[1]]);
}

const steel = { color: '#d5dade', metalness: 1, roughness: 0.28 } as const;
const steelBrushed = { color: '#b8bfc6', metalness: 1, roughness: 0.42 } as const;
const laminate = { color: '#f4f5f2', metalness: 0, roughness: 0.38 } as const;

/* ---------------------------------------------------------------- modelli glTF */

type Align = 'min' | 'center' | 'max';

/**
 * Carica un glTF, lo scala così che la dimensione `axis` misuri `meters` metri reali e lo allinea
 * rispetto al punto `position` (default: base centrata). Funziona anche con export in scale strane.
 */
function Prop({
  id,
  meters,
  axis = 'y',
  position,
  rotationY = 0,
  align = ['center', 'min', 'center'],
  // gli arredi glTF ricevono le ombre ma non le proiettano: alcuni hanno decine di migliaia di
  // triangoli (il vaso ~59.000) e ridisegnarli nella mappa d'ombra dimezzava i fotogrammi
  shadows = false,
  onScene,
}: {
  id: string;
  meters: number;
  axis?: 'x' | 'y' | 'z';
  position: [number, number, number];
  rotationY?: number;
  align?: [Align, Align, Align];
  shadows?: boolean;
  onScene?: (o: THREE.Object3D) => void;
}) {
  const { scene } = useGLTF(model(id));
  const obj = useMemo(() => {
    const root = scene.clone(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const s = (meters * M) / size[axis];
    const pick = (a: Align, min: number, max: number) => (a === 'min' ? min : a === 'max' ? max : (min + max) / 2);
    const anchor = new THREE.Vector3(
      pick(align[0], box.min.x, box.max.x),
      pick(align[1], box.min.y, box.max.y),
      pick(align[2], box.min.z, box.max.z),
    );
    const wrap = new THREE.Group();
    root.position.copy(anchor).multiplyScalar(-1);
    wrap.add(root);
    wrap.scale.setScalar(s);
    root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = shadows;
        o.receiveShadow = true;
      }
    });
    onScene?.(root);
    return wrap;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, meters, axis]);
  return <primitive object={obj} position={position} rotation={[0, rotationY, 0]} />;
}

/** Orologio da parete Poly Haven con le lancette che segnano l'ora reale. */
function WallClock({ position }: { position: [number, number, number] }) {
  const hands = useMemo(() => ({} as Record<'h' | 'm' | 's', THREE.Object3D | undefined>), []);
  useFrame(() => {
    const d = new Date();
    const s = d.getSeconds() + d.getMilliseconds() / 1000;
    const m = d.getMinutes() + s / 60;
    const h = (d.getHours() % 12) + m / 60;
    if (hands.s) hands.s.rotation.z = -(Math.floor(s) / 60) * Math.PI * 2;
    if (hands.m) hands.m.rotation.z = -(m / 60) * Math.PI * 2;
    if (hands.h) hands.h.rotation.z = -(h / 12) * Math.PI * 2;
  });
  return (
    <Prop
      id="wall_clock"
      meters={0.32}
      position={position}
      align={['center', 'center', 'min']}
      shadows={false}
      onScene={(root) => {
        hands.h = root.getObjectByName('wall_clock_hours_hand');
        hands.m = root.getObjectByName('wall_clock_minute_hand');
        hands.s = root.getObjectByName('wall_clock_second_hand');
      }}
    />
  );
}

/* ---------------------------------------------------------------- poster su canvas */

function useCanvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void): THREE.CanvasTexture {
  return useMemo(() => {
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    draw(cv.getContext('2d')!, w, h);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

const SERIF = 'Georgia, "Times New Roman", serif';
const SANS = '"Helvetica Neue", Arial, sans-serif';

function drawAnatomy(g: CanvasRenderingContext2D, w: number, h: number) {
  g.fillStyle = '#f7f4ec';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#1f3b4d';
  g.font = `bold 46px ${SERIF}`;
  g.textAlign = 'center';
  g.fillText('Canis lupus familiaris', w / 2, 80);
  g.font = `24px ${SANS}`;
  g.fillStyle = '#58707e';
  g.fillText('ANATOMIA TORACO-ADDOMINALE', w / 2, 118);
  g.strokeStyle = '#1f3b4d';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(60, 140);
  g.lineTo(w - 60, 140);
  g.stroke();

  g.save();
  g.translate(w / 2 - 10, h * 0.45);
  // sagoma laterale (linea)
  g.strokeStyle = '#3d4f5c';
  g.lineWidth = 3;
  g.fillStyle = '#ebe3d3';
  g.beginPath();
  g.moveTo(-230, -40);
  g.bezierCurveTo(-180, -95, 90, -105, 160, -70);
  g.bezierCurveTo(190, -110, 220, -170, 270, -160);
  g.bezierCurveTo(320, -150, 345, -120, 340, -100);
  g.lineTo(290, -90);
  g.bezierCurveTo(250, -60, 230, -10, 200, 30);
  g.lineTo(205, 190);
  g.lineTo(175, 190);
  g.lineTo(160, 60);
  g.bezierCurveTo(90, 70, -40, 70, -150, 50);
  g.lineTo(-170, 190);
  g.lineTo(-200, 190);
  g.lineTo(-215, 40);
  g.bezierCurveTo(-245, 10, -250, -20, -230, -40);
  g.closePath();
  g.fill();
  g.stroke();
  // coda
  g.beginPath();
  g.moveTo(-228, -38);
  g.bezierCurveTo(-280, -80, -300, -140, -290, -170);
  g.stroke();
  // organi, colori da tavola anatomica
  const organ = (x: number, y: number, rx: number, ry: number, rot: number, col: string) => {
    g.fillStyle = col;
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  };
  organ(85, -25, 72, 42, -0.15, '#e8a7a7');
  organ(115, 10, 26, 32, 0.4, '#a5282c');
  organ(0, 0, 42, 34, 0.2, '#7b3f2a');
  organ(-55, 20, 40, 26, 0, '#d89c6a');
  organ(-110, 5, 30, 24, 0.3, '#c98a5a');
  organ(-70, -45, 14, 20, 0, '#8a3b3b');
  g.restore();

  // didascalie numerate
  const labels = ['Polmoni', 'Cuore', 'Fegato', 'Stomaco', 'Intestino', 'Rene'];
  g.textAlign = 'left';
  g.font = `22px ${SANS}`;
  labels.forEach((l, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 80 + col * 230;
    const y = h * 0.8 + row * 40;
    g.fillStyle = '#1f3b4d';
    g.fillText(`${i + 1}.  ${l}`, x, y);
  });
}

/**
 * Pergamena di laurea appesa in ambulatorio, in verticale, con impaginazione classica.
 * È un oggetto di scena: niente stemma, motto, formule di legge, firme o nomi reali di autorità.
 */
function drawDiploma(g: CanvasRenderingContext2D, w: number, h: number) {
  const paper = g.createRadialGradient(w / 2, h / 2, 80, w / 2, h / 2, h * 0.75);
  paper.addColorStop(0, '#f8f6ee');
  paper.addColorStop(1, '#e6e0cc');
  g.fillStyle = paper;
  g.fillRect(0, 0, w, h);
  // cornice sottile decorativa
  g.strokeStyle = '#b8a57a';
  g.lineWidth = 2;
  g.strokeRect(18, 18, w - 36, h - 36);
  g.lineWidth = 0.8;
  g.strokeRect(26, 26, w - 52, h - 52);
  const ink = '#2f2a24';
  g.fillStyle = ink;
  g.textAlign = 'center';
  // maiuscoletto: le lettere già maiuscole nel testo restano grandi, le altre diventano maiuscole piccole
  const smallCaps = (text: string, y: number, size: number) => {
    const big = `${size}px ${SERIF}`;
    const small = `${Math.round(size * 0.74)}px ${SERIF}`;
    const pieces = [...text].map((ch) => [ch.toUpperCase(), ch === ch.toUpperCase() && ch !== ' ' ? big : small] as const);
    const width = (t: string, f: string) => {
      g.font = f;
      return g.measureText(t).width;
    };
    let x = w / 2 - pieces.reduce((sum, [t, f]) => sum + width(t, f), 0) / 2;
    g.textAlign = 'left';
    for (const [t, f] of pieces) {
      g.font = f;
      g.fillText(t, x, y);
      x += g.measureText(t).width;
    }
    g.textAlign = 'center';
  };
  // fregio decorativo in alto (generico)
  g.strokeStyle = '#8a7a55';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(w / 2 - 60, 70);
  g.lineTo(w / 2 + 60, 70);
  g.stroke();
  g.beginPath();
  g.arc(w / 2, 70, 6, 0, Math.PI * 2);
  g.stroke();
  smallCaps('Università degli Studi', 128, 30);
  smallCaps('di Napoli Federico II', 164, 30);
  g.font = `18px ${SERIF}`;
  g.fillText('DIPLOMA DI LAUREA', w / 2, 232);
  smallCaps('la Laurea di Dottore', 300, 22);
  g.font = `17px ${SERIF}`;
  g.fillText('IN', w / 2, 334);
  smallCaps('Medicina Veterinaria', 372, 26);
  g.font = `17px ${SERIF}`;
  g.fillText('È CONFERITA A', w / 2, 420);
  g.font = `32px ${SERIF}`;
  g.fillText('Tommaso Santillo', w / 2, 472);
  // fregio decorativo in basso (generico)
  g.beginPath();
  g.moveTo(w / 2 - 90, h - 110);
  g.lineTo(w / 2 + 90, h - 110);
  g.stroke();
  g.font = `italic 13px ${SERIF}`;
  g.fillStyle = '#6b6152';
  g.fillText('Napoli', w / 2, h - 80);
}

function drawXray(g: CanvasRenderingContext2D, w: number, h: number) {
  const bg = g.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, w * 0.7);
  bg.addColorStop(0, '#2a3440');
  bg.addColorStop(1, '#05080c');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.filter = 'blur(2px)';
  g.strokeStyle = 'rgba(225,235,245,0.8)';
  g.lineCap = 'round';
  g.lineWidth = 16;
  g.beginPath();
  g.moveTo(30, h * 0.26);
  g.quadraticCurveTo(w / 2, h * 0.17, w - 30, h * 0.3);
  g.stroke();
  g.lineWidth = 6;
  for (let i = 0; i < 10; i++) {
    const x = w * 0.18 + i * w * 0.065;
    g.beginPath();
    g.moveTo(x, h * 0.24);
    g.quadraticCurveTo(x + 34, h * 0.58, x - 6, h * 0.84);
    g.stroke();
  }
  g.fillStyle = 'rgba(200,215,230,0.28)';
  g.beginPath();
  g.ellipse(w * 0.6, h * 0.6, 70, 88, -0.45, 0, Math.PI * 2);
  g.fill();
  g.filter = 'none';
  g.fillStyle = 'rgba(255,255,255,0.75)';
  g.font = '18px monospace';
  g.fillText('L  LAT', 18, h - 18);
}

function Poster({ pos, size, tex }: { pos: [number, number, number]; size: [number, number]; tex: THREE.Texture }) {
  return (
    <mesh position={[pos[0], pos[1], pos[2] + 0.006]} receiveShadow>
      <planeGeometry args={size} />
      <meshStandardMaterial map={tex} roughness={0.55} />
    </mesh>
  );
}

/** Cornice in alluminio con vetro (riflessi dall'HDRI). */
function FramedPrint({
  pos,
  size,
  tex,
  rotY = 0,
}: {
  pos: [number, number, number];
  size: [number, number];
  tex: THREE.Texture;
  rotY?: number;
}) {
  const [w, h] = size;
  const b = 0.05;
  return (
    <group position={pos} rotation={[0, rotY, 0]}>
      <mesh position={[0, 0, 0.025]} castShadow>
        <boxGeometry args={[w + b * 2, h + b * 2, 0.05]} />
        <meshStandardMaterial color="#2b2b2b" metalness={0.8} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0, 0.051]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial map={tex} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0, 0.056]}>
        <planeGeometry args={[w, h]} />
        <meshPhysicalMaterial transparent opacity={0.12} roughness={0.02} metalness={0} color="#ffffff" />
      </mesh>
    </group>
  );
}

/**
 * Pergamena cliccabile: col mouse, passandoci sopra compare un alone luminoso e un clic la apre grande;
 * da telefono (niente "sopra") si apre con un doppio tocco.
 */
function DiplomaFrame({ pos, size, tex }: { pos: [number, number, number]; size: [number, number]; tex: THREE.CanvasTexture }) {
  const [hover, setHover] = useState(false);
  const halo = useRef<THREE.Mesh>(null);
  const lastTap = useRef(0);
  useFrame(({ clock }) => {
    const m = halo.current;
    if (!m) return;
    const mat = m.material as THREE.MeshBasicMaterial;
    const target = hover ? 0.45 + 0.2 * Math.sin(clock.elapsedTime * 4) : 0;
    mat.opacity = THREE.MathUtils.lerp(mat.opacity, target, 0.2);
    m.visible = mat.opacity > 0.01;
  });
  const open = () => useGame.getState().setDiploma((tex.image as HTMLCanvasElement).toDataURL('image/png'));
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const type = (e.nativeEvent as PointerEvent).pointerType ?? 'mouse';
    if (type === 'mouse') return open();
    // tocco: serve il doppio tocco ravvicinato
    const now = performance.now();
    if (now - lastTap.current < 400) {
      lastTap.current = 0;
      open();
    } else lastTap.current = now;
  };
  const [w, h] = size;
  return (
    <group
      onPointerOver={(e) => {
        e.stopPropagation();
        if ((e.nativeEvent as PointerEvent).pointerType !== 'mouse') return;
        setHover(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHover(false);
        document.body.style.cursor = '';
      }}
      onClick={onClick}
    >
      {/* alone dietro la cornice */}
      <mesh ref={halo} position={[pos[0], pos[1], pos[2] + 0.004]} visible={false}>
        <planeGeometry args={[w + 0.28, h + 0.28]} />
        <meshBasicMaterial color="#ffe066" transparent opacity={0} toneMapped={false} depthWrite={false} />
      </mesh>
      <FramedPrint pos={pos} size={size} tex={tex} />
    </group>
  );
}

/* ---------------------------------------------------------------- stanza */

function Room() {
  const { floor, ceiling, left, right, back, front } = ROOM;
  const W = right - left;
  const D = front - back;
  const cx = (left + right) / 2;
  const cz = (back + front) / 2;
  const split = floor + 1.25 * M; // piastrelle fino a 1.25 m

  const floorMat = usePbr('large_floor_tiles_02', 3, [W, D]);
  const tilesMat = usePbr('long_white_tiles', 1.27, [W, split - floor]);
  const plasterMat = usePbr('painted_plaster_wall', 2, [W, ceiling - split]);

  const walls: [[number, number], number, number][] = [
    [[cx, back], 0, W],
    [[cx, front], Math.PI, W],
    [[left, cz], Math.PI / 2, D],
    [[right, cz], -Math.PI / 2, D],
  ];

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, floor, cz]} receiveShadow>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial {...floorMat} color="#ffffff" roughness={1} normalScale={new THREE.Vector2(0.6, 0.6)} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[cx, ceiling, cz]}>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color="#f2f1ee" roughness={0.95} />
      </mesh>
      {walls.map(([[x, z], ry, w], i) => (
        <group key={i} position={[x, 0, z]} rotation={[0, ry, 0]}>
          <mesh position={[0, (split + ceiling) / 2, 0]} receiveShadow>
            <planeGeometry args={[w, ceiling - split]} />
            <meshStandardMaterial normalMap={plasterMat.normalMap} roughnessMap={plasterMat.roughnessMap} color="#efe9df" roughness={1} />
          </mesh>
          <mesh position={[0, (floor + split) / 2, 0]} receiveShadow>
            <planeGeometry args={[w, split - floor]} />
            <meshStandardMaterial {...tilesMat} color="#ffffff" roughness={1} />
          </mesh>
          {/* profilo in alluminio e zoccolino */}
          <mesh position={[0, split, 0.012]}>
            <boxGeometry args={[w, 0.03, 0.025]} />
            <meshStandardMaterial {...steelBrushed} />
          </mesh>
          <mesh position={[0, floor + 0.12, 0.015]}>
            <boxGeometry args={[w, 0.24, 0.03]} />
            <meshStandardMaterial color="#9aa3a6" roughness={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * Sfondo per lo schermo 4:3 sul bancone a partire da un'immagine quasi quadrata: l'immagine intera al centro
 * (niente tagli della scritta) e ai lati la stessa immagine ingrandita, sfocata e scurita, come uno sfondo del desktop.
 */
function wallpaperTexture(src: THREE.Texture) {
  const img = src.image as CanvasImageSource & { width: number; height: number };
  const W = 1024;
  const H = 738; // proporzioni dello schermo 1,36 × 0,98
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#111';
  g.fillRect(0, 0, W, H);
  // riempimento ai lati
  const cover = Math.max(W / img.width, H / img.height);
  g.filter = 'blur(18px) brightness(0.55)';
  g.drawImage(img, (W - img.width * cover) / 2, (H - img.height * cover) / 2, img.width * cover, img.height * cover);
  g.filter = 'none';
  // immagine intera al centro, con un'ombra leggera
  const fit = Math.min(W / img.width, H / img.height) * 0.94;
  const iw = img.width * fit;
  const ih = img.height * fit;
  g.shadowColor = 'rgba(0,0,0,0.6)';
  g.shadowBlur = 24;
  g.drawImage(img, (W - iw) / 2, (H - ih) / 2, iw, ih);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Immagini opzionali dell'ambulatorio (public/clinic/local). */
export const LOCAL_IMAGES = { vesuvio: '/clinic/local/vesuvio.jpg', screen: '/clinic/local/poster.png' } as const;

/** Scarica un'immagine opzionale: `null` se il file non c'è (Vite risponde con index.html ai file mancanti). */
async function loadLocalTexture(url: string): Promise<THREE.Texture | null> {
  const ok = await fetch(url, { method: 'HEAD' })
    .then((r) => r.ok && !(r.headers.get('content-type') ?? '').includes('text/html'))
    .catch(() => false);
  if (!ok) return null;
  try {
    const t = await new THREE.TextureLoader().loadAsync(url);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  } catch {
    return null;
  }
}

/** Avvia in anticipo il download delle immagini opzionali (stessa cache di `useLocalTexture`). */
export function preloadLocalImages() {
  for (const url of Object.values(LOCAL_IMAGES)) preload(() => loadLocalTexture(url), ['local-texture', url]);
}

/**
 * Immagine opzionale con Suspense: la scena aspetta che sia pronta (o che risulti mancante) prima di
 * comparire, così i materiali della finestra e dello schermo non cambiano più dopo il preriscaldamento
 * degli shader. Se il file non c'è resta `null` e si usa il ripiego (vetro opalino, lastra RX).
 */
function useLocalTexture(url: string) {
  return suspend(() => loadLocalTexture(url), ['local-texture', url]);
}

/**
 * Finestra con veneziana. Con la foto del Vesuvio (locale) il vetro mostra il panorama, luminoso come un
 * esterno di giorno e ritagliato sulle proporzioni della finestra; senza, vetro opalino retroilluminato.
 */
function FrostedWindow({ pos, size, view }: { pos: [number, number, number]; size: [number, number]; view?: THREE.Texture | null }) {
  const [w, h] = size;
  const slats = 14;
  const frame = { color: '#f4f4f2', roughness: 0.35 } as const;
  const viewTex = useMemo(() => {
    if (!view) return null;
    const t = view.clone();
    const img = view.image as { width: number; height: number } | undefined;
    const imgAspect = img ? img.width / img.height : 1.4;
    const winAspect = w / h;
    // "cover": riempie il vetro senza deformare, tagliando i lati (o sopra/sotto)
    if (imgAspect > winAspect) {
      t.repeat.set(winAspect / imgAspect, 1);
      t.offset.set((1 - t.repeat.x) / 2, 0);
    } else {
      t.repeat.set(1, imgAspect / winAspect);
      t.offset.set(0, (1 - t.repeat.y) / 2);
    }
    t.needsUpdate = true;
    return t;
  }, [view, w, h]);
  return (
    <group position={pos}>
      {viewTex ? (
        <>
          {/* panorama fuori dalla finestra: non illuminato dalla stanza, un po' più chiaro come la luce del giorno */}
          <mesh position={[0, 0, 0.01]}>
            <planeGeometry args={[w, h]} />
            <meshBasicMaterial map={viewTex} color="#f4f8ff" toneMapped={false} />
          </mesh>
          {/* riflesso del vetro */}
          <mesh position={[0, 0, 0.02]}>
            <planeGeometry args={[w, h]} />
            <meshPhysicalMaterial transparent opacity={0.1} roughness={0.05} color="#ffffff" depthWrite={false} />
          </mesh>
        </>
      ) : (
        <mesh position={[0, 0, 0.01]}>
          <planeGeometry args={[w, h]} />
          <meshStandardMaterial color="#ffffff" emissive="#eaf3ff" emissiveIntensity={2.2} toneMapped={false} />
        </mesh>
      )}
      {[
        [0, h / 2 + 0.05, w + 0.2, 0.1],
        [0, -h / 2 - 0.05, w + 0.2, 0.1],
        [-w / 2 - 0.05, 0, 0.1, h + 0.2],
        [w / 2 + 0.05, 0, 0.1, h + 0.2],
        [0, 0, 0.07, h],
      ].map(([x, y, bw, bh], i) => (
        <mesh key={i} position={[x, y, 0.05]} castShadow>
          <boxGeometry args={[bw, bh, 0.1]} />
          <meshStandardMaterial {...frame} />
        </mesh>
      ))}
      <mesh position={[0, -h / 2 - 0.12, 0.14]} castShadow receiveShadow>
        <boxGeometry args={[w + 0.4, 0.05, 0.3]} />
        <meshStandardMaterial color="#e9e7e2" roughness={0.3} />
      </mesh>
      {/* veneziana alzata a metà, lamelle inclinate */}
      <mesh position={[0, h / 2 - 0.02, 0.18]}>
        <boxGeometry args={[w + 0.12, 0.07, 0.08]} />
        <meshStandardMaterial color="#d9dcde" metalness={0.3} roughness={0.4} />
      </mesh>
      {Array.from({ length: slats }, (_, i) => (
        <mesh key={i} position={[0, h / 2 - 0.09 - i * 0.055, 0.18]} rotation={[1.1, 0, 0]} castShadow>
          <boxGeometry args={[w + 0.08, 0.055, 0.003]} />
          <meshStandardMaterial color="#eceeef" metalness={0.2} roughness={0.45} />
        </mesh>
      ))}
    </group>
  );
}

function ExamTable() {
  const { floor } = ROOM;
  const colTop = -0.3;
  const colH = colTop - (floor + 0.12);
  return (
    <group>
      <RoundedBox args={[2.8, 0.1, 1.5]} radius={0.03} smoothness={4} position={[0, -0.05, 0]} castShadow receiveShadow>
        <meshStandardMaterial {...steel} />
      </RoundedBox>
      {/* tappetino in gomma */}
      <RoundedBox args={[2.3, 0.012, 1.15]} radius={0.005} position={[0, 0.0, 0]} receiveShadow>
        <meshStandardMaterial color="#3c4246" roughness={0.95} />
      </RoundedBox>
      <mesh position={[0, -0.17, 0]} castShadow>
        <boxGeometry args={[2.3, 0.14, 1.1]} />
        <meshStandardMaterial {...steelBrushed} />
      </mesh>
      {/* colonna telescopica */}
      <mesh position={[0, colTop - colH * 0.3, 0]} castShadow>
        <boxGeometry args={[0.42, colH * 0.6, 0.42]} />
        <meshStandardMaterial {...steel} />
      </mesh>
      <mesh position={[0, floor + 0.12 + colH * 0.3, 0]} castShadow>
        <boxGeometry args={[0.5, colH * 0.6, 0.5]} />
        <meshStandardMaterial color="#e4e6e7" roughness={0.45} />
      </mesh>
      <RoundedBox args={[1.9, 0.12, 1.1]} radius={0.04} position={[0, floor + 0.06, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#e4e6e7" roughness={0.45} />
      </RoundedBox>
      <mesh position={[0.65, floor + 0.15, 0.55]} rotation={[-0.2, 0, 0]}>
        <boxGeometry args={[0.32, 0.04, 0.22]} />
        <meshStandardMaterial color="#2b2f31" roughness={0.8} />
      </mesh>
    </group>
  );
}

/** Mobile con lavello (laminato bianco + top inox) lungo la parete di fondo, a destra. */
function Counter({ screen }: { screen?: THREE.Texture | null }) {
  const { floor, back, right } = ROOM;
  const x0 = 1.8;
  const w = right - x0;
  const cx = (x0 + right) / 2;
  const d = 0.62 * M;
  const top = floor + 0.9 * M;
  const z = back + d / 2;
  const doors = 4;
  const dw = w / doors;
  const xray = useCanvasTexture(512, 384, drawXray);
  return (
    <group>
      <mesh position={[cx, (floor + 0.1 + top) / 2, z - 0.02]} castShadow receiveShadow>
        <boxGeometry args={[w, top - floor - 0.1, d - 0.04]} />
        <meshStandardMaterial {...laminate} />
      </mesh>
      <mesh position={[cx, floor + 0.05, z - 0.08]}>
        <boxGeometry args={[w, 0.1, d - 0.16]} />
        <meshStandardMaterial color="#2b2f31" roughness={0.8} />
      </mesh>
      {Array.from({ length: doors }, (_, i) => {
        const x = x0 + dw * (i + 0.5);
        const fz = back + d;
        return (
          <group key={i}>
            <mesh position={[x, top - 0.28, fz + 0.005]} castShadow>
              <boxGeometry args={[dw - 0.03, 0.4, 0.04]} />
              <meshStandardMaterial {...laminate} />
            </mesh>
            <mesh position={[x, (floor + 0.12 + top - 0.5) / 2, fz + 0.005]} castShadow>
              <boxGeometry args={[dw - 0.03, top - 0.5 - floor - 0.12, 0.04]} />
              <meshStandardMaterial {...laminate} />
            </mesh>
            <mesh position={[x, top - 0.14, fz + 0.035]}>
              <boxGeometry args={[dw * 0.5, 0.025, 0.025]} />
              <meshStandardMaterial {...steelBrushed} />
            </mesh>
          </group>
        );
      })}
      {/* top in acciaio con vasca */}
      <mesh position={[cx, top + 0.03, z + 0.03]} castShadow receiveShadow>
        <boxGeometry args={[w + 0.02, 0.06, d + 0.06]} />
        <meshStandardMaterial {...steelBrushed} />
      </mesh>
      <mesh position={[x0 + 1.1, top + 0.061, z + 0.05]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.0, 0.75]} />
        <meshStandardMaterial color="#6f777e" metalness={1} roughness={0.3} />
      </mesh>
      <group position={[x0 + 1.1, top + 0.06, back + 0.18]}>
        <mesh position={[0, 0.28, 0]} castShadow>
          <cylinderGeometry args={[0.03, 0.045, 0.56, 16]} />
          <meshStandardMaterial {...steel} />
        </mesh>
        <mesh position={[0, 0.54, 0.17]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.022, 0.022, 0.36, 12]} />
          <meshStandardMaterial {...steel} />
        </mesh>
        <mesh position={[0.12, 0.5, 0]} rotation={[0, 0, -1.2]}>
          <boxGeometry args={[0.02, 0.22, 0.02]} />
          <meshStandardMaterial {...steel} />
        </mesh>
      </group>
      {/* dispenser di sapone */}
      <mesh position={[x0 + 1.75, top + 0.2, back + 0.2]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 0.28, 16]} />
        <meshStandardMaterial color="#cfe8e4" roughness={0.2} />
      </mesh>
      <Prop id="medical_box" meters={0.53} axis="x" position={[x0 + 2.55, top + 0.06, z - 0.05]} rotationY={-0.15} />
      <Prop id="industrial_microscope" meters={0.46} position={[x0 + 3.25, top + 0.06, z - 0.2]} rotationY={-0.5} />
      <Prop id="clipboard" meters={0.34} axis="z" position={[x0 + 1.95, top + 0.065, z + 0.15]} rotationY={0.3} />
      {/* diafanoscopio */}
      <group position={[x0 + 1.75, top + 1.25, back + 0.03]}>
        <RoundedBox args={[1.5, 1.12, 0.07]} radius={0.02} castShadow>
          <meshStandardMaterial color="#e7e9ea" roughness={0.4} />
        </RoundedBox>
        <mesh position={[0, 0, 0.036]}>
          <planeGeometry args={[1.36, 0.98]} />
          {/* schermo acceso: lo sfondo locale se c'è, altrimenti la lastra RX */}
          <meshStandardMaterial map={screen ?? xray} emissive="#ffffff" emissiveMap={screen ?? xray} emissiveIntensity={screen ? 1.05 : 1.4} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

export function Clinic() {
  const anatomy = useCanvasTexture(600, 840, drawAnatomy);
  const diploma = useCanvasTexture(480, 680, drawDiploma);
  // immagini opzionali (public/clinic/local): panorama del Vesuvio e sfondo dello schermo sul bancone
  const vesuvio = useLocalTexture(LOCAL_IMAGES.vesuvio);
  const meme = useLocalTexture(LOCAL_IMAGES.screen);
  const wallpaper = useMemo(() => (meme ? wallpaperTexture(meme) : null), [meme]);
  const { back, left, right, floor, ceiling } = ROOM;
  const wz = back + 0.001;
  return (
    <group>
      <Room />
      <ExamTable />
      <Counter screen={wallpaper} />
      <FrostedWindow pos={[-2.7, 1.85, wz]} size={[2.4, 2.1]} view={vesuvio} />
      <Poster pos={[-0.2, 1.85, wz]} size={[1.06, 1.48]} tex={anatomy} />
      {/* pergamena di laurea in cornice, al posto del poster sul protocollo vaccinale */}
      <DiplomaFrame pos={[1.05, 1.7, wz]} size={[0.8, 1.13]} tex={diploma} />
      <WallClock position={[1.05, 3.25, wz]} />
      <Prop id="hanging_picture_frame_01" meters={0.84} position={[left + 0.001, 2.2, 1.2]} rotationY={Math.PI / 2} align={['center', 'center', 'min']} />

      {/* arredi Poly Haven */}
      <Prop id="drawer_cabinet" meters={1.88} position={[left + 0.25 * M + 0.02, floor, -1.2]} rotationY={Math.PI / 2} />
      <Prop id="steel_frame_shelves_01" meters={1.9} position={[right - 0.5, floor, 1.6]} rotationY={-Math.PI / 2} />
      <Prop id="potted_plant_02" meters={0.95} position={[left + 0.75, floor, back + 0.8]} rotationY={0.6} />
      <Prop id="metal_stool_01" meters={0.62} position={[-1.8, floor, 1.5]} />
      {[
        [-2.4, 0],
        [2.4, 0],
        [0, 3.6],
      ].map(([x, z], i) => (
        <Prop key={i} id="mounted_fluorescent_lights" meters={0.91} axis="x" position={[x, ceiling, z]} align={['center', 'max', 'center']} shadows={false} />
      ))}
      <Prop id="modern_ceiling_lamp_01" meters={0.95} position={[-0.6, ceiling, -1.2]} align={['center', 'max', 'center']} />
    </group>
  );
}

# Modello del cane

`dog.glb` deriva da **“PitBull”** di **Joseph AYYAD**
(https://sketchfab.com/3d-models/2be37d5b9f754ed4bcc2d8f41b23a1d7, autore https://sketchfab.com/Joseph.AD),
con licenza [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

Animazioni incluse: Bark, Die, Eat, IDdle, Run, Sit, Stand up, Walkl.

## Modifiche

- Denti, occhi e unghie: nel file originale i loro vertici sono in un frame scalato (~0.735) e traslato
  lungo z rispetto al corpo, quindi in three.js restavano staccati (unghie sul tavolo, denti davanti
  al collo). I vertici sono stati riportati nello spazio del corpo: `v' = (x, y, z − 1.25) / 0.735`.
- Occhi (bulbi oculari): dopo la correzione di scala restavano nascosti dentro il muso. Sono stati
  spostati nelle orbite, misurate con un raycast sull'occhio dipinto nella texture: centro in spazio di
  bind ≈ (±4.5, 140.0, 93.3).
- Mandibola interna (denti inferiori, lingua, gengive): era legata per intero all'osso ausiliario
  `joint1_028`, che il corpo non usa, e vista di fronte risultava spostata di lato. È stata ricollegata
  a `Jaw_M_027`, lo stesso osso del labbro inferiore.
- Nel codice (`src/three/Dog.tsx`) vengono scartate le tracce di traslazione di collo e testa delle
  clip: lo "squash & stretch" di `Bark` gonfiava e piegava il collo. Di `Bark` si usa solo il tratto
  0,4–0,85 s (testa in avanti, bocca aperta): nella carica iniziale e nel ritorno la testa rientra
  verso le spalle e lo skinning fa una piega verticale sulla gola.
- Ottimizzato con gltf-transform (`optimize --texture-compress webp --compress meshopt --simplify false`):
  4,7 MB → 0,67 MB.

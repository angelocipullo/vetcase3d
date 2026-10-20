# VetCase 3D

Simulatore clinico veterinario: visiti un cane 3D (stile toon/Nintendogs), usi fonendoscopio, termometro e siringa, raccogli i dati e formuli la diagnosi. Ogni caso ha requisiti espliciti (esami obbligatori) e un esito valutato.

Stack: **Vite + React 18 + TypeScript + three.js** (via `@react-three/fiber` / `drei`), stato con `zustand`.

```bash
npm install
npm run dev      # http://localhost:5173 (anche da telefono in LAN, --host attivo)
npm run build
```

## Come si gioca

| Strumento | Interazione | Dato raccolto |
|---|---|---|
| ✋ Coccole | tocca il cane, trascina per ruotare | abbassa lo stress |
| 🩺 Fonendo | tieni premuto sul torace e trascina; il volume dipende dalla distanza dal focus cardiaco/polmonare. Dopo 3 s di ascolto scegli cosa hai sentito | `HeartSound`, `LungSound` (interpretazione dell'utente) |
| 🌡️ Termometro | tocca sotto la coda, poi tieni premuto senza staccare finché bippa | temperatura |
| 💉 Siringa | zoom sulla vena cefalica → laccio → disinfezione → angolo 15–30° → tocca la vena → aspira a impulsi (la pressione non deve saturare) → togli il laccio PRIMA dell'ago | emocromo (HCT, WBC, NEUT, PLT, PT) |

Lo **stress** del cane sale con gli errori; sopra 80 non puoi pungere finché non lo calmi.

## Modello dati (`src/game/`)

- `types.ts` — tutti gli enum: `Tool`, `Zone`, `Exam`, `HeartSound`, `LungSound`, `Diagnosis`, `Outcome`, `TechniqueError`, `CaseId`, `LabParam`, `SyringePhase`.
- `cases.ts` — 5 casi: parvovirosi, broncopolmonite, endocardiosi mitralica, babesiosi, paziente sano. Ognuno ha `vitals`, `blood`, `correctDiagnosis`, `requiredExams`, `explanation`.
- `evaluation.ts` — `evaluate(case, record, diagnosis)` → `Outcome` + punteggio:
  - Diagnosi 50 · Esami richiesti 25 · Interpretazione auscultazione 15 · Tecnica 10 (−3 per errore)
  - `Wrong` se la diagnosi è sbagliata; `CorrectIncomplete` se giusta ma mancano esami richiesti; `Excellent` ≥ 88.

Per aggiungere un caso: aggiungi un valore a `CaseId` e una voce in `CASES`.

## Audio

`src/audio/engine.ts` **sintetizza** in tempo reale S1/S2, soffio sistolico, aritmie, murmure vescicolare, crepitii e sibili, sulla frequenza del caso. Funziona senza file.

Per usare **registrazioni vere** mettile in `public/audio/` (vedi il README lì): se il file esiste viene usato al posto della sintesi.

## Modello 3D del cane

Il cane attuale è **procedurale** (`src/three/Dog.tsx`), così il progetto gira senza asset. Per sostituirlo con un `.glb` (es. generato con Higgsfield o da una libreria CC0):

1. metti il file in `public/models/dog.glb`;
2. in `Dog.tsx` caricalo con `useGLTF` di drei e mantieni le stesse prop/eventi;
3. dai alla mesh della zampa anteriore sinistra il nome `leg_fl` (serve al prelievo);
4. riallinea i punti in `src/three/anatomy.ts` (`ZONES`, `VEIN_CURVE`, `CAMERA_VIEWS`).

Requisiti per un modello che funzioni bene: in piedi, muso verso +X, fianco sinistro verso +Z, altezza garrese ~1.2 unità, rigging opzionale (respiro e coda sono animati via codice se le parti sono separate).

> Didattico, non sostituisce la formazione clinica.

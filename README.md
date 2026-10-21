# VetCase 3D

Simulatore clinico veterinario: visiti un cane 3D (stile toon/Nintendogs), usi fonendoscopio, termometro e siringa, raccogli i dati e formuli la diagnosi. Ogni caso ha requisiti espliciti (esami obbligatori) e un esito valutato.

Stack: **Vite + React 18 + TypeScript + three.js** (via `@react-three/fiber` / `drei`), stato con `zustand`.

```bash
npm install
npm run dev      # http://localhost:5173 (anche da telefono in LAN, --host attivo)
npm run build
```

## Come si gioca

La schermata iniziale precarica la scena 3D (`src/three/preload.ts`); **Inizia** assegna un caso casuale (diverso dal precedente) e un nome sorteggiato al paziente. Dopo la scheda di accettazione (segnalamento, motivo della visita, anamnesi) visiti il cane e formuli la diagnosi, che resta nascosta fino al risultato. Gli shader vengono compilati in background (`ShaderWarmup` in `Scene.tsx`) mentre leggi la scheda.

Su desktop: `1–4` strumenti, `D` diagnosi, `C` cartella, `G` guida, `Esc` chiude.

| Strumento | Interazione | Dato raccolto |
|---|---|---|
| ✋ Coccole | tocca il cane, trascina per ruotare | abbassa lo stress |
| 🩺 Fonendo | tieni premuto sul torace e trascina; il volume dipende dalla distanza dal focus cardiaco/polmonare. Dopo 3 s di ascolto scegli cosa hai sentito | `HeartSound`, `LungSound` (interpretazione dell'utente) |
| 🌡️ Termometro | tocca sotto la coda (il cane la solleva) → lubrifica la punta → tieni premuto: il termometro entra e il display sale fino al bip → estrai. Senza lubrificante o staccando prima del bip è un errore di tecnica | temperatura |
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

## Ambulatorio e cane 3D

- **Ambulatorio** (`src/three/Clinic.tsx`): stanza con materiali PBR, HDRI e arredi glTF di Poly Haven (CC0, crediti in `public/clinic/CREDITS.md`); poster e lastra RX sono disegnati su canvas. Ambient occlusion in `src/three/Effects.tsx`.
- **Cane** (`src/three/Dog.tsx`): `public/models/dog.glb`, “PitBull” di Joseph AYYAD (CC BY 4.0, crediti e modifiche in `public/models/CREDITS.md`). Usa le animazioni `IDdle` e `Bark` (in sincronia con il suono); scodinzolio, ansimare, sguardo e tremore sono aggiunti via codice sulle ossa.
- Il modello è ruotato e specchiato (`DOG_TRANSFORM` in `anatomy.ts`) così il muso guarda +X e il fianco **sinistro** la camera (auscultazione e cefalica si fanno a sinistra). L'avambraccio sinistro ha un collider invisibile `leg_fl` per il prelievo.

Per cambiare modello: sostituisci `dog.glb`, poi in sviluppo usa `window.__dogSkin()` dalla console per leggere la posizione della mesh deformata attorno a ogni osso e riallinea `ZONES`, `FRONT_LEFT_LEG` e `CAMERA_VIEWS` in `src/three/anatomy.ts`.

> Didattico, non sostituisce la formazione clinica.

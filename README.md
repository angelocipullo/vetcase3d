# VetCase 3D

Simulatore clinico veterinario: visiti un cane 3D (stile toon/Nintendogs), usi fonendoscopio, termometro e siringa, raccogli i dati e formuli la diagnosi. Ogni caso ha requisiti espliciti (esami obbligatori) e un esito valutato.

Stack: **Vite + React 18 + TypeScript + three.js** (via `@react-three/fiber` / `drei`), stato con `zustand`.

```bash
npm install
npm run dev      # http://localhost:5173 (anche da telefono in LAN, --host attivo)
npm run build
```

## Simulatore clinico (gameplay principale)

La schermata iniziale mostra un piccolo ospedale in pixel art: **Iniziamo il turno di lavoro** fa entrare il medico nell'edificio (animazione in `src/ui/TitleScene.tsx`) e apre la sala d'attesa con l'elenco dei pazienti e la loro difficoltà. Il simulatore di Pronto Soccorso ha tre casi: **Michele** (gatto con FeLV, generato, facile), **Nala** (caso reale anonimizzato, pitbull con diarrea cronica, anemia immunomediata e sospetto linfoma, medio) e **Birillo** (caso reale anonimizzato, gatto con iperaldosteronismo primario, difficile): anamnesi con budget di domande, scheda PS con minigiochi (termometro, polso, respiro, mucose, TRC, stato mentale, PA Doppler), quiz con distrattori senza limite di tempo, richiesta esami con costi e tempi, interpretazione dell'emogas, preparazione della pompa di KCl, terapia intensiva con un paziente che evolve ora per ora (ipokaliemia refrattaria), lettura della TC e debriefing.

Codice in `src/sim/` (motore e casi) e `src/ui/sim/` (interfaccia). Architettura, come aggiungere un caso e la strada per generarli: [`docs/simulatore.md`](docs/simulatore.md). Dati reali e generati di Birillo: [`docs/birillo.md`](docs/birillo.md); caso Michele: [`docs/michele.md`](docs/michele.md); caso Nala: [`docs/nala.md`](docs/nala.md). I PDF della documentazione clinica originale non sono versionati (`.gitignore`).

## Ambulatorio 3D (dentro i casi)

L'ambulatorio 3D si apre dalla scheda di PS del caso, con il paziente del caso sul tavolo, e restituisce i valori alla scheda. Non ci sono più casi casuali. Codice: `src/ui/ClinicVisit.tsx` (visita e pannelli), `src/three/Scene.tsx`, `Instruments.tsx`, `Dog.tsx`, `Cat.tsx`; stato in `src/store.ts` (`openVisit`); quali parametri sono 3D in `src/ui/clinicTools.ts`.

- **Sul modello 3D**: temperatura, polso, respiro, auscultazione.
- **In finestra** (dalla scheda o dalla barra dell'ambulatorio, segnati con ⧉): mucose, TRC, stato mentale, pressione Doppler.
- **Prelievo**: inviando esami del sangue si apre la finestra del prelievo (tricotomia → laccio → disinfezione → angolo dell'ago → puntura sulla vena → aspirazione a impulsi → laccio tolto PRIMA dell'ago → cerotto). Gli errori di tecnica vanno nel diario e tolgono punti all'esame clinico.
- I referti si leggono nella cartella clinica 🗂️, apribile anche dall'ambulatorio.
- Modelli: **cane** = pitbull glTF (`Dog.tsx`); **gatto** = gatto semi-realistico costruito in codice (`Cat.tsx`, nessun file esterno: tronco scolpito, mantello tigrato su texture generata) con i colori del caso. Punti anatomici e inquadrature per specie in `src/three/anatomy.ts` (`setSpecies`).

| Strumento 3D | Interazione sul modello | Dato |
|---|---|---|
| ✋ Coccole | tocca l'animale, trascina per girare attorno al tavolo | abbassa lo stress |
| 🌡️ Temperatura | tocca sotto la coda → lubrifica → tieni premuto fino al bip → estrai | °C (errore se senza lubrificante o interrotto) |
| 💗 Polso femorale | tocca l'interno coscia: le dita pulsano a ogni battito; conta per 6 s e classifica | bpm |
| 🫁 Respiro | inquadratura del torace, che si espande alla FR del caso; tocca "Atto" per 15 s | atti/min |
| 🩺 Auscultazione | tieni premuto sul torace (suoni alla FC/FR del caso) | — |

`G` attiva/disattiva la guida (punti che lampeggiano), `Esc` torna alla scheda.

## Audio

`src/audio/engine.ts` **sintetizza** in tempo reale S1/S2, soffio sistolico, aritmie, murmure vescicolare, crepitii e sibili, sulla frequenza del caso. Funziona senza file.

Non c'è musica di sottofondo. Sono sintetizzati anche i blip dei pulsanti e la voce "farfugliata" del proprietario che risponde alle domande dell'anamnesi. Il tasto `M` o il pulsante 🔊 silenziano tutto.

Per usare **registrazioni vere** mettile in `public/audio/` (vedi il README lì): se il file esiste viene usato al posto della sintesi.

## Ambulatorio e cane 3D

- **Ambulatorio** (`src/three/Clinic.tsx`): stanza con materiali PBR, HDRI e arredi glTF di Poly Haven (CC0, crediti in `public/clinic/CREDITS.md`); poster e lastra RX sono disegnati su canvas. Ambient occlusion in `src/three/Effects.tsx`.
- **Cane** (`src/three/Dog.tsx`): `public/models/dog.glb`, “PitBull” di Joseph AYYAD (CC BY 4.0, crediti e modifiche in `public/models/CREDITS.md`). Usa le animazioni `IDdle` e `Bark` (in sincronia con il suono); scodinzolio, ansimare, sguardo e tremore sono aggiunti via codice sulle ossa.
- Il modello è ruotato e specchiato (`DOG_TRANSFORM` in `anatomy.ts`) così il muso guarda +X e il fianco **sinistro** la camera (auscultazione e cefalica si fanno a sinistra). L'avambraccio sinistro ha un collider invisibile `leg_fl` per il prelievo.

Per cambiare modello: sostituisci `dog.glb`, poi in sviluppo usa `window.__dogSkin()` dalla console per leggere la posizione della mesh deformata attorno a ogni osso e riallinea `ZONES`, `FRONT_LEFT_LEG` e `CAMERA_VIEWS` in `src/three/anatomy.ts`.

> Didattico, non sostituisce la formazione clinica.

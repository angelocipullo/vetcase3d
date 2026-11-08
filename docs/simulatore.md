# Simulatore clinico a fasi

Il gameplay principale di VetCase è un **simulatore di Pronto Soccorso**: il medico (utente) segue un caso reale dall'arrivo del paziente fino alla diagnosi e alla terapia. Le scelte consumano tempo simulato e il paziente **evolve** con un modello fisiologico, quindi gli errori hanno conseguenze cliniche e non solo di punteggio.

L'ambulatorio 3D resta disponibile come prototipo dalla schermata del titolo.

## Struttura di una partita

Un caso è una sequenza di **fasi** (`Stage`). Ogni tipo di fase è un meccanismo di gioco riusabile:

| Tipo | Meccanica | Esempio (Birillo) |
|---|---|---|
| `narrative` | testo e scelta di proseguire | arrivo in PS |
| `quiz` | scelta multipla a tempo con distrattori (stile *L'Eredità*); risposte parziali, bonus velocità, effetti sul paziente | "Cosa fai per primo?", scala di Greco, sospetto diagnostico |
| `interview` | anamnesi: budget di domande, domande chiave/utili/irrilevanti | allergie, terapie, PU/PD, diarrea, ultimo pasto, ambiente, dieta |
| `vitals` | scheda PS con un minigioco per ciascun parametro | termometro, polso (conta in 6 s + bradi/normo/tachicardico rispetto a `hrRange`), respiro (15 s), mucose, TRC (l’utente stima i secondi, tolleranza ±0,5 s), LOC, PA Doppler |
| `orders` | richiesta esami con costi e tempi; punteggio di appropriatezza; minigiochi per alcuni esami | Eco-FAST, Doppler, fondo oculare |
| `abg` | interpretazione dell'emogas: tocca i valori anomali, poi pH → disturbo primario → compenso | alcalosi metabolica con ipokaliemia |
| `pump` | preparazione sacca (ml di KCl) e velocità della pompa con indicatore di sicurezza (≤ 0,5 mEq/kg/h) | KCl 80 mEq/L in Ringer |
| `monitor` | terapia intensiva: avanzi il tempo, ripeti esami, cambi pompa e farmaci; grafici di andamento | ipokaliemia refrattaria, poi risposta allo spironolattone |
| `ct` | lettura TC: scorri le fette e tocca la lesione (convenzione radiologica) | massa surrenalica sinistra |
| `debrief` | diagnosi finale a scelta multipla (`diagnosisOptions`), poi punteggio per area, K⁺ misurato contro K⁺ reale simulato, caso reale, punti didattici | |

### Punteggio

Sei aree (`src/sim/scoring.ts`): ragionamento clinico, anamnesi, esame clinico, appropriatezza degli esami, terapia e sicurezza, monitoraggio. Gli eventi avversi (bolo di KCl, infusione oltre 0,5 mEq/kg/h, K⁺ < 1,5 o > 6) sottraggono punti e vengono "salvati" da un collega, così la partita può continuare.

## Casi disponibili

| Caso | Difficoltà | Origine | Diagnosi |
|---|---|---|---|
| Michele (`cases/michele.ts`) | facile | generato | FeLV progressiva con anemia non rigenerativa ([docs/michele.md](michele.md)) |
| Birillo (`cases/birillo.ts`) | difficile | reale, anonimizzato | iperaldosteronismo primario ([docs/birillo.md](birillo.md)) |

## Interfaccia in stile RPG

Le parti conversazionali usano un'interfaccia da RPG anni '90 (`src/ui/sim/rpg.tsx`):

- **ritratti in pixel art 18×18 generati in codice** da un `SpriteSpec` (umano: pelle, capelli, acconciatura, vestiti, camice, occhiali; gatto: pelo, tigratura, occhi). Un nuovo personaggio è solo un oggetto, senza immagini;
- **scena** con i personaggi sulle loro piattaforme: chi parla è in primo piano e muove la bocca;
- **finestra di dialogo** con cartellino del nome, testo a macchina da scrivere (clic/Invio per completare e proseguire) e ▼ lampeggiante;
- **menu di scelta** con cursore ▶ per le risposte dei quiz e le domande dell'anamnesi.

Personaggi: il **Primario** pone le domande dei quiz e dà i consigli nelle fasi tecniche, il **proprietario** risponde nell'anamnesi, l'**Infermiere** annuncia gli eventi critici. Proprietario e paziente si definiscono nel caso (`cast`); primario e infermiere sono in `src/sim/cast.ts`. Nelle fasi `narrative` i paragrafi tra «…» li pronuncia il proprietario, gli altri il narratore (oppure si scrive un `dialogue` esplicito).

## Architettura (`src/sim/`)

```
types.ts       modello dati (SimCase, Stage, Phys, Therapy, ResultDoc…)
physiology.ts  modello fisiologico: tick(phys, therapy, disease, t, dt) e segni clinici
protocols.ts   protocolli riusabili (scala di Greco, calcolo KCl, mantenimento)
exams.ts       catalogo esami/farmaci/fluidi (costi, tempi, minigiochi)
results.ts     helper per i referti (flag automatici, emogas dallo stato fisiologico)
store.ts       motore: orologio, avanzamento, esami, eventi critici, log, punteggio
scoring.ts     riepilogo del punteggio
cases/         un file per caso + registro e validazione (cases/index.ts)
```

UI in `src/ui/sim/`: `SimScreen.tsx` (layout a 3 colonne su desktop, a schede su mobile), `stagesA.tsx` / `stagesB.tsx` (una vista per tipo di fase), `vitalGames.tsx` e `imagingGames.tsx` (minigiochi), `sim.css`.

In sviluppo lo store è in `window.__sim` (es. `__sim.setState({ stageIdx: 10 })` per saltare a una fase).

### Il paziente evolve

`physiology.ts` integra ogni 5 minuti simulati il bilancio del potassio (infusione, perdita renale guidata dall'aldosterone, vomito, shift da glucosio/insulina), l'equilibrio acido-base (HCO₃⁻ con compenso respiratorio, ipoventilazione sotto 1,7 mEq/L), sodio, pressione (amlodipina, spironolattone), FC/FR/T. Gli esami di laboratorio "dinamici" (emogas, lattati, PA, ECG, FE K⁺) sono calcolati **dallo stato del paziente al momento del prelievo**.

Il modello è didattico e tarato sul caso reale (K⁺ 1,9 → ~2,4 in 24 h con KCl a mantenimento; plateau < 3,5 anche alla velocità massima; normalizzazione con lo spironolattone). Non è un modello quantitativo validato.

## Aggiungere un caso

1. Crea `src/sim/cases/<id>.ts` che esporta un `SimCase` (usa `birillo.ts` come modello).
2. Registralo in `SIM_CASES` (`src/sim/cases/index.ts`). In sviluppo `validateCase` segnala in console gli errori di struttura (id duplicati, quiz senza risposta corretta, esami sconosciuti…).
3. Per i dati assenti dai documenti, generali coerenti con il quadro e marcali: `source: 'generato'` sul referto, `gen: true` sulla singola riga di un referto misto. In gioco compaiono come "simulato".

Un caso definisce: segnalamento, `disease` (profilo per il modello fisiologico), `initialPhys`, `vitals` (verità per i minigiochi PS), `stages`, `results` (un generatore di referto per esame), `refuse` (quando un esame non si può fare, es. anestesia in paziente instabile), eventuale `ct`, `realCase` e `teaching`.

## Verso la generazione di casi diversi

Il motore non contiene nulla di specifico di Birillo: tutto ciò che è clinico sta nel file del caso. Questo permette di **generare** casi nuovi in tre modi, dal più semplice al più ambizioso:

1. **Varianti dello stesso caso.** Parametri casuali entro intervalli plausibili (K⁺ iniziale, PAS, peso, lato della massa, tempi di risposta ai farmaci) e opzioni dei quiz rimescolate. Si ottengono partite diverse con la stessa malattia.
2. **Nuove malattie sullo stesso modello fisiologico.** `DiseaseProfile` va esteso con altri "assi" fisiopatologici (es. `insulinDeficit` per DKA, `renalLoss` per IRC, `hypovolemia` per shock, `gluco` per Cushing) e `tick()` va aggiornato. I casi poi combinano gli assi: DKA = deficit di insulina + diuresi osmotica + acidosi, ostruzione uretrale = iperkaliemia + azotemia post-renale, e così via.
3. **Casi generati da documentazione clinica.** La pipeline è quella usata per Birillo: si estraggono dai referti reali (PDF della cartella, anonimizzati e non versionati) segnalamento, anamnesi, parametri PS, esami e timeline; un LLM produce un `SimCase` in JSON completando i dati mancanti (marcati `generato`) e scrivendo quiz con distrattori plausibili; `validateCase` più una revisione clinica umana decidono se pubblicarlo. Per farlo serve una versione **serializzabile** del caso: le funzioni dinamiche (`(ctx) => …`) vanno sostituite da descrittori dichiarativi, ad esempio `{ "type": "bloodGas" }`, `{ "type": "static", "rows": [...] }` oppure `{ "type": "byK", "thresholds": [...] }`, interpretati dal motore.

Il passo successivo consigliato è introdurre il formato JSON dichiarativo (punto 3) e convertire Birillo in quel formato: è il prerequisito per generare casi senza scrivere codice.

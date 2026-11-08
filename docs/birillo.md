# Birillo: dati reali e dati generati

Caso reale anonimizzato: gatto comune europeo, maschio castrato, 7 anni, 5 kg (nome di fantasia; ospedale veterinario universitario, 16/06–24/07/2026).
I PDF originali contengono dati personali del proprietario e non sono versionati: i nomi dei file citati sotto si riferiscono alla copia locale.
Diagnosi finale: **iperaldosteronismo primario (sindrome di Conn)** da neoplasia del surrene sinistro (TC 22/07).

> Nella visita di controllo del 17/06 compare la dicitura "Iperadrenocorticismo primario (sindrome di Conn)". La sindrome di Conn è l'**iperaldosteronismo** primario: nel gioco si usa il termine corretto e lo si spiega nel quiz di diagnosi.

## Dati reali (dai documenti originali)

| Dato | Fonte |
|---|---|
| Motivo della visita, anamnesi (allergie, terapie, PU/PD, diarrea, ultimo pasto, anamnesi remota) | Scheda di PS |
| T 39,2 °C, polso ritmico, FR 20, mucose normali, TRC 2 s, ottundimento | Scheda di PS |
| Terapia in PS: maropitant e integrazione di KCl; Eco-FAST negativo | Scheda di PS |
| Emocromo del 16/06 | emocromo 1.pdf |
| Azotemia 55, creatinina 1,6, T4, FIV/FeLV negativi | Risultati Laboratorio fiv felv azo crea, t4.pdf |
| Evoluzione del 17/06: K⁺ 2,4 in terapia, alcalosi rientrata, Na⁺ ai limiti alti, ipertensione persistente, terapia con amlodipina e spironolattone | EOG |
| ALT, ALP, bilirubina (valori del 22/07 usati nel biochimico) | Risultati Laboratorio 4 |
| Esame urine (PS 1010, proteine +, UPC 0,10) | urine ultimo |
| Ecocardiografia ed ECG | Esame cardiovascolare |
| TC total body | referto tc.pdf |

## Dati generati (assenti o incompleti nei documenti)

Generati in modo coerente con il quadro clinico e marcati "simulato" (o con * nei referti misti).

### Emogas venoso ed elettroliti

Calcolati dal modello fisiologico (`src/sim/physiology.ts`). Valori all'arrivo:

| Parametro | Valore | Rif. (gatto, venoso) | Note |
|---|---|---|---|
| pH | 7,47 | 7,28–7,41 | alcalemia |
| pCO₂ | 45,6 mmHg | 33–45 | compenso respiratorio atteso: 40 + 0,7 × ΔHCO₃⁻ |
| HCO₃⁻ | 32 mmol/L | 18–23 | alcalosi metabolica da eccesso di mineralcorticoidi |
| BE | +8 | −5/+2 | |
| Na⁺ | 157 mEq/L | 147–157 | limite alto (coerente con l'EOG) |
| **K⁺** | **1,9 mEq/L** | 3,5–5,5 | ipokaliemia grave → ventroflessione del collo |
| Cl⁻ | 107 mEq/L | 115–123 | ipocloremia |
| iCa | 1,21 mmol/L | 1,1–1,4 | |
| Glucosio | 142 mg/dL | 70–150 | iperglicemia da stress |
| Lattati | 1,4 mmol/L | < 2,5 | perfusione conservata |

**Dinamica del potassio** (il cuore del caso): la perdita renale cresce in modo ripido con il K⁺ plasmatico sotto aldosterone.

- Senza terapia: K⁺ cala di ~0,03 mEq/L/h.
- KCl 80 mEq/L a mantenimento (~15 ml/h, 0,25 mEq/kg/h): K⁺ ~2,4 dopo 24 h (come nel caso reale).
- Velocità massima sicura (30 ml/h, ~0,5 mEq/kg/h): plateau ~3,1 → **ipokaliemia refrattaria**.
- Con spironolattone (effetto pieno in ~12 h simulate): la perdita cala e il K⁺ si normalizza in 24–36 h; se non si riduce il KCl c'è il rischio di iperkaliemia.

### Altri dati generati

| Dato | Valore | Motivazione |
|---|---|---|
| FC all'arrivo | 200 bpm | dalla visita cardiologica del 06/07 (FC 200) |
| PA sistolica (Doppler) | 210 mmHg | l'EOG parla di "ipertensione persistente" ma senza valori |
| Fondo oculare | emorragie retiniche, vasi tortuosi, distacco bolloso parziale OS | spiega il "non ci vede bene" e la midriasi |
| Biochimico: proteine 6,4, albumina 2,9, P 4,6, Ca 9,6, **Mg 2,2** (normale), **CK 2850 U/L** (↑) | | Mg normale per escludere l'ipomagnesiemia come causa; CK alta da miopatia ipokaliemica |
| FE K⁺ urinaria | ~34% all'inizio (rif. < 4% in ipokaliemia) | dimostra la perdita renale; calcolata dal modello |
| Aldosterone sierico | 1850 pmol/L (rif. 110–540) | richiesto nel caso reale, referto non disponibile |
| Ecografia addominale | surrene sn 1,8 × 1,5 cm, disomogeneo con aree anecogene; surrene dx 0,4 cm | eseguita nel caso reale (17/06), referto non disponibile; coerente con la TC |
| ECG in PS | tachicardia sinusale, onde T ridotte, lieve sottoslivellamento ST | segni tipici di ipokaliemia; l'ECG reale (06/07, K⁺ corretto) era normale |
| Coagulazione, RX torace, gastroscopia | nella norma / aspecifici | esami distrattori |
| Risposte della proprietaria su ambiente (indoor), dieta (commerciale), tossici (nessuno), aspetto del vomito, vista | | servono a escludere parassiti, carenza di tiamina e permetrina |

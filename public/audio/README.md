# Registrazioni di auscultazione (opzionali)

Se metti qui file `.mp3` con questi nomi, l'app li usa al posto della sintesi:

| File | Contenuto |
|---|---|
| `heart_normal.mp3` | cuore normale, registrato a ~100 bpm |
| `heart_tachycardia.mp3` | (opzionale, altrimenti viene riscalato) |
| `heart_murmur.mp3` | soffio sistolico mitralico |
| `heart_arrhythmia.mp3` | aritmia |
| `lungs_normal.mp3` | murmure vescicolare, ~24 atti/min |
| `lungs_crackles.mp3` | crepitii |
| `lungs_wheezes.mp3` | sibili |
| `lungs_muffled.mp3` | suoni attutiti (versamento) |

Il cuore viene riprodotto con `playbackRate = bpm_caso / 100`, i polmoni con `rr_caso / 24` (limitato 0.5–2×). Registra/esporta loop puliti di 4–8 secondi.

Fonti con licenza da verificare caso per caso: Freesound (filtra per CC0), librerie di auscultazione delle università veterinarie, oppure registrazioni tue con uno stetoscopio digitale (es. Eko). Controlla sempre la licenza prima di includerle nel repo.

## Abbaio

`bark_1.mp3` e `bark_2.mp3` sono due abbai registrati (ricavati da un'unica clip): l'app li alterna, con una leggera variazione di intonazione, e anima il cane con la clip `Bark` del modello. Se mancano, l'abbaio viene sintetizzato.

## Ambiente

`ambient_hospital.mp3` è il rumore di fondo dell'ambulatorio: “Hospital Busy X-Ray Room Tone” di *freesound_community* (file originale `freesound_community-hospital-busy-x-ray-room-tone-56441.mp3`, scaricato con il nome tipico di Pixabay, quindi presumibilmente sotto Pixabay Content License: verifica la licenza alla fonte). Rispetto all'originale sono stati tolti i silenzi iniziale/finale e ricodificato a 96 kbps.

L'app lo riproduce in loop infinito con crossfade a potenza costante di 4 s (`startAmbient` in `src/audio/engine.ts`), a volume di sottofondo, e lo abbassa durante l'auscultazione. Il pulsante 🔊/🔇 (o il tasto `M`) silenzia tutto l'audio; la scelta resta salvata nel browser.

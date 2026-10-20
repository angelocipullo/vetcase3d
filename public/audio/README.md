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

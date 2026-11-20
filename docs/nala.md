# Nala: dati reali e dati generati

Caso reale anonimizzato: pitbull femmina, 4 anni, 26 kg, mantello fulvo scuro (nome di fantasia; ospedale veterinario universitario, 25/09–30/10/2026). Codice: `src/sim/cases/nala.ts`. Difficoltà media.
I PDF originali contengono dati personali della proprietaria e non sono versionati.

**Diagnosi del caso:** anemia immunomediata secondaria con iperplasia linfoide atipica; sospetto linfoma, da confermare con istologia e immunoistochimica (la conferma istologica non è nella documentazione).

## Percorso

1. Accettazione: paziente cronica, già trattata altrove → prima si ricostruisce la storia e si fa un esame obiettivo completo.
2. Anamnesi (reale): esordio a fine giugno, carne cruda, titolazioni ehrlichia/babesia 1:80, PCR negative, risposta al prednisone, ricovero ad agosto, terapie in corso, reazione alle vitamine B EV, dieta casalinga.
3. Esame obiettivo: T 38,5 °C, polso 100 ritmico, respiro regolare, mucose pallide, vigile (rif. FC 60–140).
4. Lista dei problemi (scelta multipla): anemia, linfoadenomegalia generalizzata, diarrea cronica con ematochezia.
5. Esami: emocromo, biochimico e citologia linfonodale sempre eseguiti; PCR e Coombs indispensabili; TC ed endoscopia rifiutate (anestesia con HCT 17%).
6. Quiz: anemia grave non rigenerativa.
7. Quiz: Coombs positivo → componente immunomediata, cercare la causa.
8. Quiz: iperplasia linfoide atipica → istologia e immunoistochimica prima del cortisone.
9. Piano (scelta multipla): immunosoppressione dopo la biopsia, tromboprofilassi, controlli con reticolociti, dieta casalinga bilanciata, olio di salmone. Distrattori: carne cruda, vitamine B EV, trasfusione immediata.
10. Follow-up con gli emocromi reali: l’anemia diventa rigenerativa, con poco ferro disponibile.
11. Debriefing con diagnosi finale a scelta multipla.

## Dati reali (dai documenti originali)

| Dato | Fonte |
|---|---|
| Anamnesi remota e attuale, terapie, dieta, ambiente, profilassi | Esame obiettivo generale (25/09) |
| T, polso, respiro, mucose, linfonodi, BCS, conclusioni | Esame obiettivo generale (25/09) |
| Emocromo del 25/09 (tutti i valori tranne i reticolociti) | emocromo con formula |
| Controllo del 29/09: anemia non rigenerativa, ecografia, coagulazione negativa, PCR negative | Esame obiettivo generale, visite di controllo |
| Coprologico FLOTAC negativo | esame parassitologico (25/09) |
| Citologia del linfonodo prescapolare destro | Referto ap linfonodo |
| Emocromi del 14/10, 21/10, 30/10 | emocromo con formula 2, 3, 4 |
| Visita nutrizionale (peso 24,3 kg, BCS 4/9, ingredienti, olio di salmone) | ESAME NUTRIZIONALE (30/10) |

## Dati generati (assenti o incompleti nei documenti)

Marcati "simulato" nel gioco (o con * nei referti misti).

| Esame | Valori | Motivo |
|---|---|---|
| Reticolociti del 25/09 | 32 K/µL | assenti nel referto; il 29/09 l’anemia è descritta come non rigenerativa |
| Biochimico | ALT 186, ALP 248, globuline 5,1 g/dL, resto nella norma | il referto dice solo "aumento dei valori di funzionalità epatica, lieve aumento gammaglobuline" |
| Coombs diretto | positivo 1:32 | richiesto il 29/09, esito non presente; la visita del 30/10 parla di anemia immunomediata |
| Coagulazione | PT, aPTT, fibrinogeno nella norma | il referto dice solo "esito negativo" |
| Urine | PS 1028, proteine +, UPC 0,6 | non eseguite nei documenti; coerenti con la glomerulonefrite riferita |
| RX torace | lieve linfoadenomegalia sternale | non eseguita nei documenti |
| Gruppo sanguigno | DEA 1 positivo | non eseguito |
| FR, TRC, PA, emogas | FR 24, TRC 2 s, PAS 130 | la scheda riporta solo "respiro regolare" |
| Risposte irrilevanti dell’anamnesi | nome, pettorina | riempitivi di gioco |

Le domande dei quiz e i distrattori sono scritti per il gioco. La terapia effettivamente somministrata tra il 29/09 e il 30/10 non è documentata: nel caso il piano terapeutico segue le linee guida, non la cartella.

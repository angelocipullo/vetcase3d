import { row, txt } from '../results';
import { Phys, ResultRow, SimCase } from '../types';

/**
 * EMANUELE — pitbull, maschio, 4 anni, 26 kg, mantello fulvo scuro.
 * Caso reale anonimizzato (ospedale veterinario universitario, settembre–ottobre 2026):
 * diarrea cronica, grave anemia non rigenerativa con componente immunomediata e linfoadenomegalia
 * generalizzata; citologia linfonodale "iperplasia linfoide atipica", sospetto linfoma.
 * Nome di fantasia; i documenti originali (con i dati del proprietario) non sono versionati.
 *
 * Reali: anamnesi, esame obiettivo, emocromi del 25/09, 14/10, 21/10 e 30/10, ecografia, coagulazione,
 * PCR, coprologico (FLOTAC), citologia, visita nutrizionale. Generati (marcati `gen` / 'generato'):
 * valori del biochimico, reticolociti del 25/09, test di Coombs, urine, RX, gruppo, emogas, FR e TRC.
 * Elenco completo in `docs/nala.md`.
 */

const KG = 26;

/** Emogas venoso con intervalli di riferimento canini, calcolato dallo stato fisiologico. */
function canineGasRows(p: Phys): ResultRow[] {
  const be = 0.93 * (p.hco3 - 24.4 + 14.8 * (p.ph - 7.4));
  return [
    row('pH', p.ph, '', 7.35, 7.45, true, 2),
    row('pCO₂', p.pco2, 'mmHg', 33, 50, true, 1),
    row('HCO₃⁻', p.hco3, 'mmol/L', 18, 26, true, 1),
    row('BE', be, 'mmol/L', -4, 4, true, 1),
    row('Na⁺', p.na, 'mEq/L', 140, 154, true, 0),
    row('K⁺', p.k, 'mEq/L', 3.6, 5.5, true, 1),
    row('Cl⁻', p.cl, 'mEq/L', 105, 120, true, 0),
    row('iCa', 1.22, 'mmol/L', 1.12, 1.4, true, 2),
    row('Glucosio', p.glu, 'mg/dL', 70, 140, true, 0),
    row('Lattati', p.lact, 'mmol/L', null, 2.5, true, 1),
  ];
}

export const EMANUELE: SimCase = {
  id: 'nala',
  title: 'Diarrea cronica, gengive pallide e linfonodi ingrossati',
  difficulty: 2,
  arrival: '2026-09-25T10:19:00',
  patient: { name: 'Emanuele', species: 'cane', breed: 'Pitbull', sex: 'Maschio', age: '4 anni', kg: KG, coat: 'fulvo scuro, pelo raso' },
  complaint:
    'diarrea cronica da fine giugno (feci molli alternate a diarrea liquida con sangue vivo), vomito sporadico. Già trattato altrove per ehrlichiosi e babesiosi, con ricovero ad agosto. Ora mangia, ma la proprietaria nota le gengive pallide.',
  cast: {
    owner: { name: 'Proprietaria', sprite: { kind: 'human', skin: '#f1d0b5', hair: '#c9a26b', hairStyle: 'long', clothes: '#5f3dc4' } },
    patient: { kind: 'dog', fur: '#9a5b2e', dark: '#5c3218', eyes: '#c58b2a', muzzle: '#b97a48', blaze: true },
  },
  disease: { kg: KG, aldo: 0, hrBase: 100, rrBase: 24 },
  initialPhys: {
    k: 4.1, na: 146, cl: 112, hco3: 21, pco2: 36, ph: 7.39, glu: 92, lact: 1.8, sbp: 130, hr: 100, rr: 24, temp: 38.5, vomiting: false,
  },
  vitals: {
    temp: 38.5,
    hr: 100,
    hrRange: [60, 140],
    rr: 24,
    mucose: 'pallide',
    trcSec: 2,
    loc: 'vigile',
    locDescription:
      'Emanuele entra scodinzolando, annusa tutto l’ambulatorio e si lascia visitare tranquillamente. È vigile e attivo, risponde subito quando lo chiami.',
    sbp: 130,
  },

  stages: [
    {
      kind: 'narrative',
      id: 'arrivo',
      phase: 'Accettazione',
      title: 'Una paziente con una lunga storia',
      body:
        'Venerdì 25 settembre, ore 10:19. Entra una signora con Emanuele, pitbull maschio di 4 anni, fulvo scuro, 26 kg. Ha con sé una cartellina piena di referti di altre strutture.\n\n«Da fine giugno ha diarrea e vomito. L’hanno curato per ehrlichia e babesia, ha preso il cortisone, ad agosto è stato pure ricoverato… ma la diarrea non passa: a volte è liquida, con sangue rosso.»\n\n«Adesso mangia, però guardi le gengive: sono bianche.»',
      bullets: ['Difficoltà media.', 'Una storia lunga e piena di diagnosi altrui: rimettila in ordine prima di ripetere esami.'],
      cta: 'Prendi in carico Emanuele',
    },
    {
      kind: 'quiz',
      id: 'primo',
      phase: 'Accettazione',
      title: 'Da dove parti?',
      question: 'Emanuele è vigile e stabile, ma porta mesi di diagnosi e terapie diverse. Qual è la prima cosa da fare?',
      points: 10,
      options: [
        { id: 'a', text: 'Esegui anamnesi ed EOG', bold: true, score: 1, feedback: 'Corretto: nei pazienti cronici “già visti da tutti” il dato nuovo spesso emerge da un esame obiettivo fatto bene. Qui i linfonodi fanno la differenza.' },
        { id: 'b', text: 'Ripetere subito le titolazioni per ehrlichia e babesia', score: 0.3, feedback: 'Le malattie trasmesse da vettori vanno riconsiderate, ma prima serve un quadro clinico completo. E la sierologia da sola non distingue esposizione e malattia.' },
        { id: 'c', text: 'Un altro ciclo di antibiotico empirico', score: 0, feedback: 'Ne ha già fatti senza risolvere: ripetere la stessa terapia senza una diagnosi non aiuta.' },
        { id: 'd', text: 'Cambiare crocchette e ricontrollare tra un mese', score: 0.1, feedback: 'Le mucose pallide richiedono un inquadramento adesso, non tra un mese.' },
      ],
      explanation: 'Davanti a un caso cronico complesso: problem list, cronologia, esame clinico completo. Solo dopo si decide quali esami servono davvero.',
    },
    {
      kind: 'interview',
      id: 'anamnesi',
      phase: 'Anamnesi',
      title: 'Anamnesi con la proprietaria',
      intro: 'Hai tempo per circa 8 domande. Ricostruisci la storia: esordio, diagnosi e terapie precedenti, come ha risposto, cosa mangia.',
      budget: 8,
      points: 20,
      questions: [
        { id: 'esordio', topic: 'Esordio', weight: 'key', source: 'documento', q: 'Quando e come è iniziato tutto?', a: 'A fine giugno: vomitava spesso, aveva diarrea, non mangiava ed era abbattuto.' },
        { id: 'dieta', topic: 'Dieta', weight: 'key', source: 'documento', q: 'Cosa mangiava prima che si ammalasse e cosa mangia adesso?', a: 'Prima le davo carne cruda. Adesso cucino io: manzo, maiale o pollo, piselli, patate o pasta, carote e broccoli, con un po’ di olio di salmone. Le crocchette medicate, gastrointestinali ed epatiche, non le vuole.' },
        { id: 'diagnosi', topic: 'Diagnosi precedenti', weight: 'key', source: 'documento', q: 'Che diagnosi le hanno fatto finora, e con quali esami?', a: 'In un’altra clinica le hanno trovato ehrlichia e babesia con il titolo, 1:80 tutte e due. Ha fatto antibiotici e flebo in day hospital. Poi hanno rifatto le analisi per le malattie infettive con la PCR ed erano tutte negative.' },
        { id: 'cortisone', topic: 'Risposta alle terapie', weight: 'key', source: 'documento', q: 'Ha mai fatto cortisone? Come è andata?', a: 'Sì, ad agosto, per 8–10 giorni di prednisone. Stava molto meglio! Poi a metà agosto è peggiorato ed è stato ricoverato: anemia, infiammazione “di tutti gli organi” e il fegato alto.' },
        { id: 'terapie', topic: 'Terapie in corso', weight: 'key', source: 'documento', q: 'Che farmaci o integratori prende adesso?', a: 'VSL#3, pantoprazolo, Glutamax e Carobin forte.' },
        { id: 'feci', topic: 'Feci e vomito', weight: 'key', source: 'documento', q: 'Com’è la diarrea adesso? E il vomito?', a: 'Alterna feci molli e diarrea liquida, a volte con sangue rosso vivo. Vomita una o due volte a settimana.' },
        { id: 'allergie', topic: 'Reazioni avverse', weight: 'key', source: 'documento', q: 'Ha mai avuto reazioni a farmaci?', a: 'Sì, durante la flebo ha avuto una reazione alle vitamine del gruppo B in vena.' },
        { id: 'analisi', topic: 'Esami precedenti', weight: 'useful', source: 'documento', q: 'Cosa mostravano le analisi e l’ecografia fatte altrove?', a: 'A luglio anemia lieve, globuli bianchi alti e piastrine basse; l’ecografia diceva intestino infiammato, fegato grasso e un problema ai reni, glomerulonefrite. Dopo il cortisone era ancora anemica, con le transaminasi alte, e una volta aveva il calcio bassissimo.' },
        { id: 'appetito', topic: 'Grandi funzioni', weight: 'useful', source: 'documento', q: 'Mangia volentieri? Beve e urina normalmente?', a: 'La dieta cotta la mangia con abbastanza appetito. Beve e fa pipì come sempre.' },
        { id: 'profilassi', topic: 'Profilassi', weight: 'useful', source: 'documento', q: 'È vaccinato? Fa l’antiparassitario?', a: 'È vaccinato e gli metto la fialetta antiparassitaria.' },
        { id: 'ambiente', topic: 'Ambiente', weight: 'useful', source: 'documento', q: 'Dove vive?', a: 'In città, in appartamento.' },
        { id: 'nome', topic: '—', weight: 'irrelevant', source: 'generato', q: 'Chi ha scelto il nome?', a: 'Mia figlia, ha visto un cartone animato.' },
        { id: 'pettorina', topic: '—', weight: 'irrelevant', source: 'generato', q: 'Usa collare o pettorina?', a: 'La pettorina, tira tantissimo!' },
      ],
    },
    {
      kind: 'vitals',
      id: 'eog',
      phase: 'Esame clinico',
      title: 'Esame obiettivo generale',
      intro: 'Emanuele è collaborativo: compila la scheda con le prove pratiche.',
      required: ['temp', 'polso', 'resp', 'mucose', 'trc', 'loc'],
      optional: ['pa'],
      points: 20,
    },
    {
      kind: 'quiz',
      id: 'problemi',
      phase: 'Ragionamento',
      title: 'Lista dei problemi',
      context:
        'T 38,5 °C, polso 100 bpm ritmico e pieno, respiro regolare, BCS 5/9, nessuna disidratazione. Mucose pallide. Linfonodi esplorabili tutti aumentati di volume, soprattutto retrofaringei e prescapolari. Auscultazione e palpazione addominale nella norma.',
      question: 'Quali problemi metti nella lista? (seleziona tutti quelli presenti)',
      multi: true,
      points: 15,
      options: [
        { id: 'anemia', text: 'Mucose pallide (sospetta anemia)', score: 1, feedback: 'Sì: è il problema più urgente da quantificare.' },
        { id: 'linfo', text: 'Linfoadenomegalia generalizzata', score: 1, feedback: 'Sì, ed è il dato nuovo: nei referti precedenti non compariva.' },
        { id: 'diarrea', text: 'Diarrea cronica con ematochezia', score: 1, feedback: 'Sì: sangue rosso vivo indica il coinvolgimento del grosso intestino.' },
        { id: 'febbre', text: 'Ipertermia', score: 0, feedback: '38,5 °C è nella norma per il cane.' },
        { id: 'disidr', text: 'Disidratazione', score: 0, feedback: 'Assente all’esame obiettivo.' },
        { id: 'ittero', text: 'Ittero', score: 0, feedback: 'Le mucose sono pallide, non gialle.' },
      ],
      explanation: 'Anemia + linfoadenomegalia generalizzata nel cane: pensa a malattie infettive (leishmaniosi, ehrlichiosi), immunomediate e neoplastiche (linfoma multicentrico). La diarrea cronica può far parte dello stesso quadro.',
    },
    {
      kind: 'orders',
      id: 'lab',
      phase: 'Esami',
      title: 'Esami di laboratorio e diagnostica',
      intro: 'Scegli gli esami: quanto è grave l’anemia e di che tipo è? Perché i linfonodi sono ingrossati? Infezioni da escludere davvero?',
      groups: [
        { title: 'Laboratorio', exams: ['emocromo', 'biochimico', 'coombs', 'pcr', 'coprologico', 'coagulazione', 'urine', 'gruppo', 'emogas'] },
        { title: 'Diagnostica e citologia', exams: ['citologia', 'ecografia', 'rx', 'pa', 'ecg', 'endoscopia', 'tc'] },
      ],
      relevance: {
        emocromo: { rel: 'essential', why: 'Quantifica l’anemia e, con i reticolociti, dice se è rigenerativa.' },
        biochimico: { rel: 'essential', why: 'Fegato (storia di transaminasi alte), reni (glomerulonefrite), proteine e globuline, calcio.' },
        citologia: { rel: 'essential', why: 'Linfoadenomegalia generalizzata: l’agoaspirato è rapido, economico e senza anestesia.' },
        pcr: { rel: 'essential', why: 'Le titolazioni 1:80 non provano una malattia attiva: la PCR (anche per Leishmania su aspirato) chiarisce.' },
        coombs: { rel: 'essential', why: 'Anemia grave in un cane che era migliorato con il cortisone: va cercata una componente immunomediata.' },
        ecografia: { rel: 'useful', why: 'Organomegalie, linfonodi addominali, versamenti: utile anche per stadiare un eventuale linfoma.' },
        coprologico: { rel: 'useful', why: 'Diarrea cronica: escludere i parassiti costa poco.' },
        coagulazione: { rel: 'useful', why: 'Prima di procedure invasive e con piastrine ai limiti bassi.' },
        urine: { rel: 'useful', why: 'Storia di glomerulonefrite: proteinuria (UPC).' },
        rx: { rel: 'useful', why: 'Linfonodi intratoracici e polmoni, per la stadiazione.' },
        pa: { rel: 'useful', why: 'Glomerulonefrite: la pressione va controllata.' },
        gruppo: { rel: 'neutral', why: 'Emanuele è stabile e compensato: per ora non serve una trasfusione.' },
        emogas: { rel: 'neutral', why: 'Paziente stabile, nessun disturbo acido-base sospetto.' },
        ecg: { rel: 'neutral', why: 'Polso ritmico, auscultazione normale.' },
        endoscopia: { rel: 'inappropriate', why: 'Richiede anestesia con un ematocrito al 17%: prima l’anemia, poi eventualmente le biopsie intestinali.' },
        tc: { rel: 'inappropriate', why: 'Anestesia e costo non giustificati adesso: i dati chiave arrivano da esami semplici.' },
      },
      forced: ['emocromo', 'biochimico', 'citologia'],
      points: 20,
    },
    {
      kind: 'quiz',
      id: 'rigenerativa',
      phase: 'Ragionamento',
      title: 'Leggi l’emocromo',
      context: 'HCT 16,7% · RBC 2,74 M/µL · Hb 6,5 g/dL · MCV 60,8 fL · MCHC 38,9 g/dL (↑) · reticolociti 32 K/µL* · PLT 136 K/µL · WBC 10,93 K/µL (linfociti 10,4%)',
      question: 'Come classifichi questa anemia?',
      points: 15,
      options: [
        { id: 'a', text: 'Grave e non rigenerativa', score: 1, feedback: 'Corretto: con un HCT del 17% il midollo dovrebbe produrre ben oltre 110 K/µL di reticolociti. Ed è un’anemia di mesi, quindi non è solo “pre-rigenerativa”.' },
        { id: 'b', text: 'Rigenerativa, da emolisi acuta', score: 0.2, feedback: 'I reticolociti sono bassi. L’MCHC alta merita però uno striscio: può essere un artefatto da emolisi o indicare sferociti.' },
        { id: 'c', text: 'Ferro-carenziale da perdite intestinali croniche', score: 0.3, feedback: 'Il sangue nelle feci rende il sospetto ragionevole, ma la carenza di ferro dà microcitosi e MCHC bassa; qui MCV è ai limiti bassi e MCHC è alta.' },
        { id: 'd', text: 'Da malattia renale cronica', score: 0, feedback: 'Possibile in teoria (storia di glomerulonefrite), ma serve azotemia: il biochimico non la mostra.' },
      ],
      explanation:
        'Anemia non rigenerativa nel cane: infiammazione cronica, malattia renale, endocrinopatie, malattie del midollo (mieloftisi, neoplasie) e anemia immunomediata contro i precursori (PIMA). *Reticolociti simulati: il referto reale del 25/09 non li riporta; la visita del 29/09 descrive l’anemia come non rigenerativa.',
    },
    {
      kind: 'quiz',
      id: 'coombs',
      phase: 'Ragionamento',
      title: 'Infezioni negative, Coombs positivo',
      context:
        'PCR (6 patogeni trasmessi da vettori) su sangue: negativa. PCR Leishmania su aspirato linfonodale: negativa. Coprologico FLOTAC negativo. Ecografia: epatomegalia, splenomegalia, lieve versamento. Coombs diretto positivo*.',
      question: 'Come usi il Coombs positivo?',
      points: 15,
      options: [
        { id: 'a', text: 'Conferma una componente immunomediata: ora cerco una causa scatenante (neoplasia, infezione, farmaci)', score: 1, feedback: 'Esatto. Un’anemia immunomediata si dice primaria solo dopo aver escluso le cause secondarie, e qui c’è una linfoadenomegalia generalizzata da spiegare.' },
        { id: 'b', text: 'È un’anemia immunomediata primaria: il caso è chiuso', score: 0.3, feedback: 'Troppo presto: i linfonodi ingrossati vanno spiegati prima di parlare di forma idiopatica.' },
        { id: 'c', text: 'Esclude un linfoma', score: 0, feedback: 'Al contrario: il linfoma è una delle cause più note di anemia immunomediata secondaria.' },
        { id: 'd', text: 'È un falso positivo da trasfusioni precedenti', score: 0, feedback: 'Emanuele non è mai stato trasfuso.' },
      ],
      explanation:
        'Cause di anemia immunomediata secondaria nel cane: neoplasie (soprattutto linfoma), infezioni (Babesia, Ehrlichia, Leishmania, Anaplasma), farmaci, vaccinazioni recenti. *Coombs simulato: nei documenti è richiesto il 29/09 e la visita del 30/10 parla di anemia immunomediata.',
    },
    {
      kind: 'quiz',
      id: 'citologia',
      phase: 'Diagnosi',
      title: 'Il referto citologico',
      context:
        'Agoaspirato del linfonodo prescapolare destro: buona cellularità, popolazione linfoide eterogenea. Alcuni elementi blastici grandi (1,5–2 RBC), con alto rapporto nucleo/citoplasma, a volte nucleoli prominenti e nuclei indentati; per il resto piccoli linfociti e rare plasmacellule. Diagnosi morfologica: iperplasia linfoide atipica.',
      question: 'Qual è il passo successivo?',
      points: 15,
      options: [
        { id: 'a', text: 'Biopsia escissionale di un linfonodo per istologia e immunoistochimica (± PARR per la clonalità), prima di iniziare il cortisone', score: 1, feedback: 'Corretto: è il consiglio del patologo. L’iperplasia atipica è una lesione borderline e solo l’istologia distingue un linfoma iniziale da una reazione.' },
        { id: 'b', text: 'È un linfoma: inizio subito il protocollo CHOP', score: 0.2, feedback: 'La citologia non è diagnostica: i blasti sono pochi e solo lievemente atipici. Prima la conferma.' },
        { id: 'c', text: 'È una reazione: nessun altro accertamento', score: 0, feedback: '“Atipica” vuol dire proprio che non si può escludere una neoplasia.' },
        { id: 'd', text: 'Prednisolone immunosoppressivo e ricontrollo i linfonodi tra un mese', score: 0.2, feedback: 'Il cortisone può far regredire un linfoma e rendere poi illeggibile la biopsia. Ricorda che ad agosto Emanuele era migliorato con il prednisone: succede sia nell’anemia immunomediata sia nel linfoma.' },
      ],
      explanation: 'Iperplasia linfoide atipica = lesione borderline. Si ripete l’aspirato su altri linfonodi oppure si asporta un linfonodo intero per istologia e immunoistochimica. Prelevare prima di iniziare i corticosteroidi.',
    },
    {
      kind: 'quiz',
      id: 'piano',
      phase: 'Terapia',
      title: 'Piano terapeutico e nutrizionale',
      question: 'Cosa imposti per Emanuele? (seleziona tutte le scelte corrette)',
      multi: true,
      points: 20,
      options: [
        { id: 'immuno', text: 'Immunosoppressione con prednisolone, dopo aver prelevato i campioni per l’istologia', score: 1, feedback: 'La componente immunomediata va trattata, ma senza compromettere la diagnosi.' },
        { id: 'trombo', text: 'Valutare una tromboprofilassi (es. clopidogrel)', score: 1, feedback: 'L’anemia immunomediata ha un rischio tromboembolico importante.' },
        { id: 'controlli', text: 'Emocromo con reticolociti ogni 7–10 giorni', score: 1, feedback: 'Serve a vedere quando l’anemia diventa rigenerativa e a dosare l’immunosoppressione.' },
        { id: 'dieta', text: 'Dieta casalinga cotta, bilanciata da un nutrizionista (minerali e vitamine)', score: 1, feedback: 'È ciò che è stato fatto: una dieta casalinga non integrata è quasi sempre carente.' },
        { id: 'olio', text: 'Olio di salmone, mezzo cucchiaino a pasto', score: 1, feedback: 'Indicazione reale della visita nutrizionale: fonte di omega-3.' },
        { id: 'crudo', text: 'Tornare alla carne cruda, più “naturale”', score: 0, feedback: 'In un cane immunodepresso la carne cruda aumenta il rischio di Salmonella e altri patogeni.' },
        { id: 'vitb', text: 'Vitamine del gruppo B in vena per l’anemia', score: 0, feedback: 'Ha già avuto una reazione avversa e non c’è carenza dimostrata.' },
        { id: 'trasf', text: 'Trasfusione immediata', score: 0, feedback: 'Emanuele è vigile, normocardico e compensato: oggi la trasfusione non è indicata.' },
      ],
      after: [{ kind: 'flag', flag: 'terapia' }],
      explanation: 'Trattare l’anemia immunomediata senza perdere la diagnosi di fondo, proteggere dal tromboembolismo, monitorare la risposta e rendere completa la dieta casalinga.',
    },
    {
      kind: 'quiz',
      id: 'followup',
      phase: 'Follow-up',
      title: 'Tre settimane dopo',
      context:
        'Emocromi reali di controllo. 14/10: HCT 22,2%, leucociti 39,5 K/µL (neutrofili 32,8, monociti 3,2), PLT 115. 21/10: HCT 24,0%, reticolociti 152 K/µL (↑), emoglobina reticolocitaria 20,2 pg (↓), PLT 91. 30/10: HCT 30,1%, reticolociti 133 K/µL, leucociti 11,5, PLT 184.',
      question: 'Cosa ti dicono reticolociti ed emoglobina reticolocitaria del 21/10?',
      points: 10,
      options: [
        { id: 'a', text: 'L’anemia è diventata rigenerativa, ma la disponibilità di ferro per i nuovi globuli rossi è ridotta', score: 1, feedback: 'Corretto: il midollo risponde. Una Retic-HGB bassa suggerisce poco ferro disponibile (infiammazione o perdite intestinali croniche).' },
        { id: 'b', text: 'Il midollo è ancora soppresso', score: 0, feedback: 'Con 152 K/µL di reticolociti il midollo sta lavorando.' },
        { id: 'c', text: 'È in corso un nuovo episodio emolitico grave', score: 0.2, feedback: 'L’ematocrito sale (17 → 22 → 24 → 30%): la tendenza è verso il miglioramento.' },
        { id: 'd', text: 'I reticolociti non contano dopo l’inizio della terapia', score: 0, feedback: 'Al contrario: sono il miglior indice precoce di risposta.' },
      ],
      explanation:
        'Dal 25/09 al 30/10 l’ematocrito passa da 16,7% a 30,1% e le piastrine si normalizzano. Il leucogramma del 14/10 (neutrofilia, monocitosi, eosinopenia) è compatibile con un leucogramma da stress o da corticosteroidi.',
    },
    { kind: 'debrief', id: 'debrief', phase: 'Debriefing', title: 'Debriefing' },
  ],

  results: {
    emocromo: () => ({
      title: 'Emocromo con formula',
      source: 'misto',
      rows: [
        row('Leucociti', 10.93, 'K/µL', 6, 17),
        row('Neutrofili', 8.68, 'K/µL', 3.62, 12.3),
        row('Linfociti %', 10.4, '%', 12, 33),
        row('Linfociti', 1.14, 'K/µL', 0.83, 4.91),
        row('Monociti', 0.96, 'K/µL', 0.14, 1.97),
        row('Eosinofili', 0.15, 'K/µL', 0.04, 1.62),
        row('Eritrociti', 2.74, 'M/µL', 5.5, 8.5),
        row('Emoglobina', 6.5, 'g/dL', 12, 18),
        row('Ematocrito', 16.7, '%', 36.5, 55.5),
        row('MCV', 60.8, 'fL', 60, 77),
        row('MCH', 23.7, 'pg', 19, 25),
        row('MCHC', 38.9, 'g/dL', 30, 38),
        row('RDW-CV', 13.4, '%', 11, 15.5),
        row('Reticolociti', 32, 'K/µL', 10, 110, true),
        row('Piastrine', 136, 'K/µL', 117, 500),
        row('MPV', 10.1, 'fL', 6.1, 13.1),
      ],
      conclusion:
        'Anemia grave normocitica, non rigenerativa per il grado di anemia. MCHC lievemente aumentata (valutare emolisi in vitro o sferociti allo striscio). Linfopenia relativa. Piastrine ai limiti bassi.',
    }),
    biochimico: () => ({
      title: 'Profilo biochimico',
      source: 'misto',
      rows: [
        row('Azotemia', 34, 'mg/dL', 20, 50, true),
        row('Creatinina', 0.9, 'mg/dL', 0.5, 1.5, true),
        row('ALT (GPT)', 186, 'U/L', 10, 100, true),
        row('ALP', 248, 'U/L', 20, 150, true),
        row('Bilirubina totale', 0.4, 'mg/dL', 0.1, 0.6, true),
        row('Proteine totali', 7.8, 'g/dL', 5.5, 7.5, true),
        row('Albumina', 2.7, 'g/dL', 2.6, 4, true),
        row('Globuline', 5.1, 'g/dL', 2.5, 4.5, true),
        row('Calcio totale', 9.6, 'mg/dL', 9, 11.5, true),
        row('Glucosio', 92, 'mg/dL', 70, 140, true),
        row('Amilasi', 820, 'U/L', 300, 1500, true),
        row('Lipasi DGGR', 64, 'U/L', null, 120, true),
      ],
      conclusion: 'Aumento degli enzimi epatici e lieve iperglobulinemia (dati del referto reale; i singoli valori sono simulati). Funzione renale e calcio nella norma, amilasi e lipasi DGGR nella norma.',
    }),
    coombs: () => ({
      title: 'Test di Coombs diretto',
      source: 'generato',
      rows: [txt('Coombs diretto polivalente (37 °C)', 'POSITIVO 1:32', 'negativo', true, true), txt('Autoagglutinazione su vetrino', 'negativa', '', true)],
      conclusion: 'Anticorpi adesi agli eritrociti: componente immunomediata dell’anemia.',
    }),
    pcr: () => ({
      title: 'PCR malattie infettive',
      source: 'documento',
      rows: [txt('Pannello PCR “6 in 1” su sangue EDTA', 'negativo'), txt('PCR Leishmania infantum su aspirato linfonodale', 'negativo')],
      conclusion: 'Nessuna evidenza molecolare di infezione attiva da patogeni trasmessi da vettori né di leishmaniosi. Le titolazioni precedenti (1:80) indicano al massimo un’esposizione.',
    }),
    coprologico: () => ({
      title: 'Esame coprologico FLOTAC (dual technique)',
      source: 'documento',
      rows: [
        row('Giardia duodenalis', 0, 'cpg', null, null),
        row('Isospora spp.', 0, 'opg', null, null),
        row('Toxocara canis', 0, 'upg', null, null),
        row('Trichuris vulpis', 0, 'upg', null, null),
        row('Ancylostomidae', 0, 'upg', null, null),
        row('Strongyloides stercoralis', 0, 'lpg', null, null),
        txt('Dipylidium / Taeniidae', 'negativo'),
      ],
      conclusion: 'Negativo per tutti i parassiti ricercati (19 generi o gruppi).',
    }),
    citologia: () => ({
      title: 'Citologia: agoaspirato linfonodo prescapolare destro',
      source: 'documento',
      text:
        'Buona cellularità su fondo con scarsa contaminazione ematica, materiale proteinaceo e numerosi nuclei nudi. Popolazione linfoide eterogenea: alcuni elementi blastici di grandi dimensioni (1,5–2 RBC), alto rapporto nucleo/citoplasma, a volte nucleoli prominenti e nuclei indentati (linfoblasti); la restante popolazione è di piccoli linfociti. Occasionali plasmacellule.',
      conclusion:
        'Quadro suggestivo di iperplasia linfoide atipica (lesione borderline). Si consiglia di ripetere il prelievo su altri linfonodi aumentati di volume o di asportare un linfonodo per esame istologico e immunoistochimico.',
    }),
    ecografia: () => ({
      title: 'Ecografia addominale',
      source: 'documento',
      text: 'Epatomegalia e splenomegalia. Lieve falda di liquido libero in addome. Iperecogenicità dell’area pancreatica, in assenza di alterazioni di amilasi e lipasi DGGR.',
      conclusion: 'Epato-splenomegalia con lieve versamento: quadro compatibile con un processo infiltrativo o reattivo sistemico.',
    }),
    coagulazione: () => ({
      title: 'Profilo coagulativo di base',
      source: 'misto',
      rows: [row('PT', 7.4, 's', 6, 9, true), row('aPTT', 13.2, 's', 10, 16, true), row('Fibrinogeno', 310, 'mg/dL', 150, 400, true)],
      conclusion: 'Esito negativo (nella norma), come da referto reale; valori numerici simulati.',
    }),
    urine: () => ({
      title: 'Esame urine (cistocentesi) + UPC',
      source: 'generato',
      rows: [txt('Peso specifico', '1028', '', true), txt('Proteine', '+', '', true, true), txt('Sangue/emoglobina', 'assente', '', true), txt('Bilirubina', 'tracce', '', true), txt('Sedimento', 'inattivo', '', true), row('UPC', 0.6, '', null, 0.5, true)],
      conclusion: 'Proteinuria lieve (UPC borderline), compatibile con la glomerulopatia riferita in anamnesi.',
    }),
    rx: () => ({
      title: 'RX torace (3 proiezioni)',
      source: 'generato',
      text: 'Lieve aumento di volume del linfonodo sternale. Nessuna massa mediastinica craniale. Parenchima polmonare e silhouette cardiaca nella norma.',
      conclusion: 'Possibile linfoadenomegalia sternale; nessuna lesione polmonare.',
    }),
    gruppo: () => ({
      title: 'Gruppo sanguigno e crossmatch',
      source: 'generato',
      rows: [txt('DEA 1', 'positivo', '', true), txt('Crossmatch maggiore con donatore DEA 1+', 'compatibile', '', true)],
      conclusion: 'Donatore compatibile disponibile, se servisse.',
    }),
    emogas: (ctx) => ({ title: 'Emogas venoso + elettroliti', source: 'generato', rows: canineGasRows(ctx.phys) }),
    pa: (ctx) => ({ title: 'Pressione arteriosa (Doppler)', source: 'generato', rows: [row('PA sistolica', ctx.phys.sbp, 'mmHg', null, 160, true, 0)], conclusion: 'Nei limiti.' }),
    ecg: (ctx) => ({ title: 'ECG', source: 'generato', text: `Ritmo sinusale ${Math.round(ctx.phys.hr)} bpm, nessuna aritmia.`, conclusion: 'Nella norma.' }),
  },
  refuse: {
    endoscopia: () => 'anestesia generale sconsigliata con ematocrito al 17%: prima stabilizzare l’anemia.',
    tc: () => 'anestesia generale sconsigliata con ematocrito al 17%: prima stabilizzare l’anemia.',
  },

  observation: (ctx) =>
    ctx.flags.terapia
      ? ['Mucose ancora pallide, ma più rosee nei controlli successivi', 'Linfonodi superficiali aumentati di volume', 'Vigile, mangia la dieta casalinga']
      : ['Mucose pallide', 'Linfonodi retrofaringei e prescapolari aumentati di volume, bilateralmente', 'Vigile e attivo, buona condizione corporea', 'Feci molli con sangue rosso vivo'],

  realCase: [
    { date: 'giugno–agosto 2026', text: 'Altra struttura. Da fine giugno vomito, diarrea, anoressia, abbattimento (alimentata con carne cruda). Titolazioni ehrlichia e babesia 1:80: antibiotico e fluidoterapia (reazione avversa a vitamine B EV). A luglio anemia lieve, leucocitosi, piastrinopenia; eco: enteropatia infiammatoria, steatosi epatica, glomerulonefrite. Poi grave ipocalcemia, PCR infettive negative, 8–10 giorni di prednisone con miglioramento. A metà agosto ricovero per stato infiammatorio multiorgano, anemia non rigenerativa, ALT alta.' },
    { date: '25/09/2026', text: 'Prima visita: vigile, BCS 5/9, 26 kg, T 38,5 °C, polso 100. Mucose pallide, linfoadenomegalia generalizzata (retrofaringei e prescapolari), diarrea. Emocromo: HCT 16,7%, Hb 6,5 g/dL. Biochimico: enzimi epatici aumentati, lieve iperglobulinemia. Coprologico FLOTAC negativo.' },
    { date: '29/09/2026', text: 'Controllo: anemia grave non rigenerativa. Eco: epato-splenomegalia, lieve versamento, pancreas iperecogeno con amilasi e lipasi DGGR normali. Coagulazione negativa. PCR 6 in 1 su sangue e PCR Leishmania su aspirato linfonodale negative. Richiesto il test di Coombs. Citologia del linfonodo prescapolare destro: iperplasia linfoide atipica; consigliati istologia e immunoistochimica.' },
    { date: '14/10/2026', text: 'Emocromo: HCT 22,2%, leucociti 39,5 K/µL (neutrofilia e monocitosi), PLT 115 K/µL.' },
    { date: '21/10/2026', text: 'Emocromo: HCT 24,0%, reticolociti 152 K/µL (anemia rigenerativa), Retic-HGB 20,2 pg (ferro poco disponibile), leucociti 19,1, PLT 91.' },
    { date: '30/10/2026', text: 'Emocromo: HCT 30,1%, reticolociti 133 K/µL, leucociti 11,5, PLT 184. Visita nutrizionale: 24,3 kg, BCS 4/9, “anemia immunomediata, sospetto linfoma”; dieta casalinga da bilanciare, olio di salmone mezzo cucchiaino a pasto.' },
  ],
  finalDiagnosis: 'Anemia immunomediata secondaria con iperplasia linfoide atipica: sospetto linfoma, da confermare con istologia e immunoistochimica',
  diagnosisPoints: 20,
  diagnosisOptions: [
    { id: 'imha_linfo', text: 'Anemia immunomediata secondaria con iperplasia linfoide atipica: sospetto linfoma da confermare con istologia', score: 1, feedback: 'Anemia grave inizialmente non rigenerativa, componente immunomediata, infezioni escluse con la PCR, linfoadenomegalia generalizzata con citologia borderline.' },
    { id: 'linfoma', text: 'Linfoma multicentrico (diagnosi certa)', score: 0.5, feedback: 'È il sospetto principale, ma la citologia è borderline: senza istologia non è una diagnosi certa.' },
    { id: 'imha_prim', text: 'Anemia emolitica immunomediata primaria (idiopatica)', score: 0.3, feedback: 'Non spiega la linfoadenomegalia generalizzata: la forma primaria si definisce solo dopo aver escluso le cause secondarie.' },
    { id: 'leish', text: 'Leishmaniosi', score: 0.1, feedback: 'Quadro compatibile (anemia, linfonodi, iperglobulinemia), ma la PCR su aspirato linfonodale è negativa.' },
    { id: 'ehrlichia', text: 'Ehrlichiosi cronica', score: 0.1, feedback: 'Titolo basso (1:80) e PCR negativa: esposizione, non malattia attiva.' },
    { id: 'ibd', text: 'Enteropatia cronica infiammatoria come unica causa', score: 0.1, feedback: 'Può spiegare la diarrea, non l’anemia immunomediata né i linfonodi.' },
  ],
  teaching: [
    'Nei casi cronici “già visti da tutti”, ricostruisci la storia in ordine e rifai un esame obiettivo completo: qui il dato nuovo erano i linfonodi.',
    'Titolazioni basse (1:80) per ehrlichia o babesia indicano un’esposizione; la PCR aiuta a capire se l’infezione è attiva.',
    'Anemia + linfoadenomegalia generalizzata nel cane: infezioni, malattie immunomediate, linfoma.',
    'Classifica l’anemia: con un HCT del 17% i reticolociti dovrebbero essere ben sopra 110 K/µL.',
    'Coombs positivo = componente immunomediata, non diagnosi di forma primaria: cerca sempre la causa.',
    'Iperplasia linfoide atipica è una diagnosi citologica borderline: serve l’istologia con immunoistochimica, possibilmente prima del cortisone.',
    'Reticolociti ed emoglobina reticolocitaria sono il primo segnale di risposta alla terapia e della disponibilità di ferro.',
    'In un paziente immunodepresso niente carne cruda; la dieta casalinga va bilanciata da un nutrizionista.',
  ],
};

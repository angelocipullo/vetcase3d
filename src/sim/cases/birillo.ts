import { aldoEffective } from '../physiology';
import { kScale } from '../protocols';
import { bloodGasRows, row, txt } from '../results';
import { SimCase, SimCtx } from '../types';

/**
 * BIRILLO — gatto comune europeo, MC, 7 anni, 5 kg.
 * Caso reale anonimizzato (ospedale veterinario universitario, giugno–luglio 2026): iperaldosteronismo
 * primario (sindrome di Conn) da neoplasia surrenalica sinistra. Nome di fantasia; i documenti
 * originali non sono versionati.
 *
 * I dati assenti nella documentazione (emogas/elettroliti, pressione, fondo oculare, FE K,
 * aldosterone, ecografia, risposte del proprietario su ambiente/dieta…) sono GENERATI in modo
 * coerente con il quadro e marcati `gen` / source 'generato'. Elenco in `docs/birillo.md`.
 */

const KG = 5;

const kMeasured = (ctx: SimCtx) => ctx.lastValue('emogas', 'K⁺');
const kText = (ctx: SimCtx) => {
  const k = kMeasured(ctx);
  return k === undefined ? 'non ancora misurato' : `${k.toFixed(1)} mEq/L`;
};

const unstable = (ctx: SimCtx) =>
  ctx.phys.k < 3.0
    ? 'anestesia generale controindicata: paziente con elettroliti non ancora stabilizzati (rischio aritmie e ipoventilazione). Prima stabilizzare.'
    : null;

export const BIRILLO: SimCase = {
  id: 'birillo',
  title: 'Vomito, andatura incoordinata e “non ci vede bene”',
  difficulty: 3,
  arrival: '2026-06-16T15:50:00',
  patient: { name: 'Birillo', species: 'gatto', breed: 'Comune europeo', sex: 'Maschio castrato', age: '7 anni', kg: KG, coat: 'tigrato, pelo corto' },
  complaint:
    'tre episodi di vomito da ieri pomeriggio, poi ha iniziato a deambulare male; la proprietaria sospetta che non veda bene. Nei video il gatto presenta ventroflessione del collo e incoordinazione motoria.',
  cast: {
    owner: { name: 'Proprietaria', sprite: { kind: 'human', skin: '#f1c7a3', hair: '#5b3a24', hairStyle: 'long', clothes: '#d6336c' } },
    patient: { kind: 'cat', fur: '#a07850', dark: '#4a3424', eyes: '#94d82d', muzzle: '#e8d5bd' },
  },
  disease: { kg: KG, aldo: 1 },
  initialPhys: {
    k: 1.9, na: 157, cl: 107, hco3: 32, pco2: 45.6, ph: 7.47, glu: 142, lact: 1.4, sbp: 210, hr: 200, rr: 20, temp: 39.2, vomiting: true,
  },
  vitals: {
    temp: 39.2, // documento
    hr: 200, // generato (FC del controllo cardiologico)
    hrRange: [140, 220], // riferimento felino
    rr: 20, // documento
    mucose: 'rosee', // documento: "normali"
    trcSec: 2, // documento
    loc: 'ottundimento', // documento
    locDescription:
      'Birillo è sdraiato sul tavolo con la testa flessa verso lo sterno. Apre gli occhi quando lo chiami e segue la tua voce, ma con lentezza; risponde agli stimoli tattili in modo rallentato e non cerca di scappare.',
    sbp: 210, // generato: "ipertensione persistente" nel documento, valore assente
  },

  stages: [
    {
      kind: 'narrative',
      id: 'arrivo',
      phase: 'Triage',
      title: 'Arrivo in Pronto Soccorso',
      body:
        'Martedì 16 giugno, ore 15:50. La proprietaria entra di corsa con un trasportino. Dentro c’è Birillo, gatto comune europeo tigrato, maschio castrato di 7 anni, circa 5 kg.\n\n«Da ieri ha vomitato tre volte, poi ha cominciato a camminare male… e credo che non ci veda bene. Guardi questi video.»\n\nNei video Birillo tiene il collo piegato con il mento verso il petto (ventroflessione) e barcolla.',
      bullets: ['Sei il medico di turno in PS.', 'Ogni scelta consuma tempo simulato: il paziente evolve.', 'Domande a tempo: rispondere presto e bene vale di più.'],
      cta: 'Prendi in carico Birillo',
    },
    {
      kind: 'quiz',
      id: 'primo',
      phase: 'Triage',
      title: 'Prima mossa',
      question: 'Birillo è appena arrivato. Cosa fai per prima cosa?',
      timer: 25,
      points: 10,
      options: [
        { id: 'a', text: 'Valuto rapidamente A-B-C e raccolgo un’anamnesi mirata dalla proprietaria', score: 1, feedback: 'Vie aeree pervie, respira, mucose rosee: nessuna manovra salvavita immediata. Un’anamnesi mirata orienta tutto il resto.' },
        { id: 'b', text: 'Diazepam EV per controllare l’incoordinazione', score: 0, feedback: 'Non ci sono crisi convulsive: un sedativo deprime ulteriormente lo stato mentale e maschera il quadro neurologico.' },
        { id: 'c', text: 'TC total body urgente per escludere una lesione encefalica', score: 0, feedback: 'Esame che richiede anestesia in un paziente non ancora inquadrato né stabilizzato. Prima anamnesi, esame clinico e laboratorio di base.' },
        { id: 'd', text: 'Antiemetico e dimissione con controllo domani', score: 0, feedback: 'Ventroflessione del collo e deficit visivo non sono un semplice disturbo gastroenterico: il paziente va inquadrato oggi.', effects: [{ kind: 'time', min: 10 }] },
      ],
      explanation: 'Nel paziente stabile dal punto di vista A-B-C, la raccolta anamnestica guidata è il primo passo: allergie, terapie in corso, grandi funzioni organiche, ambiente e alimentazione.',
    },
    {
      kind: 'interview',
      id: 'anamnesi',
      phase: 'Anamnesi',
      title: 'Anamnesi con la proprietaria',
      intro: 'Hai tempo per circa 9 domande prima che il paziente debba essere visitato. Scegli quelle che contano.',
      budget: 9,
      points: 20,
      questions: [
        { id: 'esordio', topic: 'Recente', weight: 'useful', source: 'documento', q: 'Mi racconta come è iniziato?', a: 'Ieri pomeriggio ha vomitato, poi altre due volte. Stamattina camminava male, barcollava e teneva la testa bassa, col mento sul petto.' },
        { id: 'allergie', topic: 'Allergie', weight: 'key', source: 'documento', q: 'Ha allergie note a farmaci o alimenti?', a: 'Che io sappia no, non ha mai avuto reazioni.' },
        { id: 'terapie', topic: 'Terapie', weight: 'key', source: 'documento', q: 'Sta prendendo farmaci, integratori o terapie?', a: 'No, nessuna terapia.' },
        { id: 'pupd', topic: 'PU/PD', weight: 'key', source: 'documento', q: 'Beve o urina più del solito?', a: 'No, mi sembra normale. La lettiera è come sempre.' },
        { id: 'diarrea', topic: 'Feci', weight: 'key', source: 'documento', q: 'Ha diarrea? Come sono le feci?', a: 'No, niente diarrea, feci normali.' },
        { id: 'pasto', topic: 'Ultimo pasto', weight: 'key', source: 'documento', q: 'Quando ha mangiato l’ultima volta?', a: 'Un’ora fa ha mangiato qualche crocchetta.' },
        { id: 'ambiente', topic: 'Ambiente', weight: 'key', source: 'generato', q: 'Vive in casa o esce? Che abitudini ha?', a: 'Vive in appartamento, al massimo va sul balcone. Non esce mai, non ci sono altri animali.' },
        { id: 'dieta', topic: 'Alimentazione', weight: 'key', source: 'generato', q: 'Cosa mangia di solito?', a: 'Crocchette commerciali per gatti sterilizzati e ogni tanto una bustina. Niente casalingo, niente pesce crudo.' },
        { id: 'remota', topic: 'Anamnesi remota', weight: 'key', source: 'documento', q: 'Ha avuto malattie in passato? È vaccinato?', a: 'È sempre stato bene, niente di rilevante. Vaccinato da piccolo, poi non più perché non esce.' },
        { id: 'tossici', topic: 'Tossici', weight: 'useful', source: 'generato', q: 'Può aver ingerito piante, farmaci, detersivi o antiparassitari per cani?', a: 'No, in casa non ci sono gigli. L’ultimo antiparassitario era uno spot-on per gatti, due mesi fa.' },
        { id: 'vista', topic: 'Vista', weight: 'useful', source: 'misto', q: 'Perché pensa che non ci veda?', a: 'Da un paio di giorni sbatte contro i mobili e la sera ha le pupille enormi.' },
        { id: 'vomito', topic: 'Vomito', weight: 'useful', source: 'generato', q: 'Com’era il vomito? Cibo, liquido, sangue, peli?', a: 'Cibo e un po’ di liquido giallo. Niente sangue.' },
        { id: 'traumi', topic: 'Traumi', weight: 'useful', source: 'generato', q: 'Può essere caduto o aver subito traumi?', a: 'Non credo, è sempre in casa e non l’ho visto cadere.' },
        { id: 'gioco', topic: '—', weight: 'irrelevant', source: 'generato', q: 'Qual è il suo gioco preferito?', a: 'La pallina con il sonaglio… perché?' },
        { id: 'chip', topic: '—', weight: 'irrelevant', source: 'generato', q: 'Il microchip è registrato all’anagrafe?', a: 'Credo di sì, lo ha fatto il veterinario anni fa.' },
      ],
    },
    {
      kind: 'vitals',
      id: 'ps',
      phase: 'Scheda PS',
      title: 'Parametri base di Pronto Soccorso',
      intro: 'Compila la scheda di PS: ogni parametro si rileva con una piccola prova pratica. Quelli obbligatori servono per chiudere la scheda.',
      required: ['temp', 'polso', 'resp', 'mucose', 'trc', 'loc'],
      optional: ['pa'],
      points: 20,
    },
    {
      kind: 'quiz',
      id: 'ventroflessione',
      phase: 'Ragionamento',
      title: 'Primo sospetto',
      context: 'Vomito, debolezza, ventroflessione del collo, ottundimento. Gatto di casa, dieta commerciale, nessun tossico.',
      question: 'Nel gatto la ventroflessione del collo è un segno tipico di…',
      timer: 20,
      points: 10,
      options: [
        { id: 'a', text: 'Miopatia ipokaliemica', score: 1, feedback: 'Esatto: il gatto non ha il legamento nucale, quindi la debolezza dei muscoli del collo da ipokaliemia si vede come ventroflessione.' },
        { id: 'b', text: 'Carenza di tiamina', score: 0.3, feedback: 'Causa possibile di ventroflessione, ma con una dieta commerciale completa è improbabile.' },
        { id: 'c', text: 'Intossicazione da permetrina', score: 0.2, feedback: 'Dà tremori e fascicolazioni; inoltre l’anamnesi esclude antiparassitari per cani.' },
        { id: 'd', text: 'Ernia discale cervicale', score: 0, feedback: 'Rara nel gatto e non spiega vomito e deficit visivo.' },
      ],
      explanation: 'Diagnosi differenziali della ventroflessione nel gatto: ipokaliemia (la più frequente), carenza di tiamina, miastenia gravis, intossicazioni (organofosfati), polimiosite, ipercalcemia. Il laboratorio di base te lo confermerà.',
    },
    {
      kind: 'quiz',
      id: 'vista',
      phase: 'Ragionamento',
      title: '“Non ci vede bene”',
      context: 'Pupille dilatate, urta i mobili, ottundimento. Gatto adulto.',
      question: 'Quale condizione sistemica devi sospettare e misurare subito?',
      timer: 20,
      points: 10,
      options: [
        { id: 'a', text: 'Ipertensione arteriosa sistemica (retinopatia/encefalopatia ipertensiva)', score: 1, feedback: 'Corretto: nel gatto l’ipertensione causa distacco ed emorragie retiniche con cecità acuta e midriasi. Misura la pressione e guarda il fondo dell’occhio.' },
        { id: 'b', text: 'Toxoplasmosi', score: 0.2, feedback: 'Può dare uveite/corioretinite, ma un gatto di casa senza altri segni è poco probabile.' },
        { id: 'c', text: 'Cataratta bilaterale', score: 0, feedback: 'Non causa midriasi né ottundimento ed evolve lentamente.' },
        { id: 'd', text: 'Neoplasia encefalica', score: 0.3, feedback: 'Possibile, ma prima si escludono cause sistemiche frequenti e misurabili subito, come l’ipertensione.' },
      ],
      explanation: 'Gli organi bersaglio dell’ipertensione nel gatto sono occhio, encefalo, cuore e rene. Ipertensione + ipokaliemia è un’associazione da ricordare: fa pensare all’iperaldosteronismo.',
    },
    {
      kind: 'orders',
      id: 'lab-ps',
      phase: 'Esami',
      title: 'Esami di laboratorio e diagnostica in PS',
      intro: 'In base al sospetto, scegli gli esami. Ogni esame ha un costo e richiede tempo: chiedi ciò che cambia la gestione.',
      groups: [
        { title: 'Laboratorio di base', exams: ['emocromo', 'biochimico', 'emogas', 'coagulazione', 'lattati', 'urine'] },
        { title: 'Esami aggiuntivi', exams: ['ecofast', 'pa', 'fondo', 'ecg', 'rx', 'ecografia', 'endoscopia', 'tc'] },
      ],
      relevance: (ctx) => ({
        emocromo: { rel: 'essential', why: 'Base di ogni paziente in PS.' },
        biochimico: { rel: 'essential', why: 'Funzione renale ed epatica, CK, magnesio.' },
        emogas: { rel: 'essential', why: 'Conferma l’ipokaliemia e rivela l’alcalosi metabolica: è l’esame chiave.' },
        ecofast: { rel: 'useful', why: 'Rapido, esclude versamenti in un paziente che vomita (eseguito nel caso reale: negativo).' },
        pa: { rel: ctx.findings.pa ? 'neutral' : 'essential', why: 'Il deficit visivo impone di misurare la pressione.' },
        fondo: { rel: 'useful', why: 'Documenta la retinopatia ipertensiva.' },
        ecg: { rel: 'useful', why: 'Con K⁺ così basso conviene escludere aritmie.' },
        lattati: { rel: 'neutral', why: 'Perfusione già buona clinicamente.' },
        coagulazione: { rel: 'neutral', why: 'Nessun segno emorragico.' },
        urine: { rel: 'neutral', why: 'Utile, ma non prioritario nei primi minuti.' },
        rx: { rel: 'neutral', why: 'Nessun segno respiratorio.' },
        ecografia: { rel: 'neutral', why: 'Verrà dopo, nell’approfondimento.' },
        endoscopia: { rel: 'inappropriate', why: 'Invasiva, richiede anestesia: non indicata.' },
        tc: { rel: 'inappropriate', why: 'Anestesia in un paziente instabile: non ora.' },
      }),
      forced: ['emogas'],
      points: 20,
    },
    {
      kind: 'abg',
      id: 'emogas',
      phase: 'Esami',
      title: 'Interpreta l’emogas',
      intro: 'Ecco la stampa dell’emogasanalizzatore. Tocca i valori anomali, poi interpreta l’equilibrio acido-base passo per passo.',
      points: 15,
    },
    {
      kind: 'quiz',
      id: 'priorita',
      phase: 'Stabilizzazione',
      title: 'Priorità terapeutica',
      context: (ctx) => `K⁺ ${kText(ctx)}, alcalosi metabolica, vomito.`,
      question: 'Qual è la priorità terapeutica adesso?',
      timer: 20,
      points: 10,
      options: [
        { id: 'a', text: 'Fluidoterapia con KCl in infusione controllata + maropitant', score: 1, feedback: 'Corretto: si corregge il potassio con un’infusione a velocità sicura e si ferma il vomito, che fa perdere altro potassio.' },
        {
          id: 'b', text: 'Bolo EV di KCl per correggere subito', score: 0, feedback: 'Il KCl in bolo è cardiotossico e può causare arresto cardiaco. Il limite è 0,5 mEq/kg/h.',
          effects: [{ kind: 'safety', penalty: 10, title: 'Bolo di KCl fermato in extremis', body: 'L’infermiere si rifiuta di somministrare il bolo e chiama il primario: il KCl non si dà mai in bolo EV. Il limite di velocità è 0,5 mEq/kg/h.' }],
        },
        { id: 'c', text: 'Glucosata 5% perché non mangia', score: 0, feedback: 'Il glucosio stimola l’insulina, che sposta K⁺ nelle cellule: peggiora l’ipokaliemia.' },
        { id: 'd', text: 'Furosemide per abbassare la pressione', score: 0, feedback: 'I diuretici dell’ansa aumentano la perdita renale di potassio: controindicati.' },
      ],
      after: [{ kind: 'drug', drug: 'maropitant' }],
      explanation: 'Il maropitant (1 mg/kg) è stato usato nel caso reale. L’integrazione di KCl si dosa con la scala di Greco in base al K⁺ misurato.',
    },
    {
      kind: 'quiz',
      id: 'greco',
      phase: 'Stabilizzazione',
      title: 'Scala di integrazione del potassio',
      context: (ctx) => `Ultimo K⁺ misurato: ${kText(ctx)}.`,
      question: 'Quanti mEq di KCl aggiungi per ogni litro di fluido?',
      ordered: true,
      timer: 25,
      points: 10,
      options: (ctx) => {
        const target = kScale(kMeasured(ctx) ?? 1.9).meqL;
        return [20, 40, 60, 80].map((v) => ({
          id: String(v),
          text: `${v} mEq/L`,
          score: v === target ? 1 : Math.abs(v - target) === 20 ? 0.3 : 0,
          feedback:
            v === target
              ? 'Esatto, è la concentrazione indicata per questa fascia di K⁺.'
              : `Per questo valore di K⁺ la scala indica ${target} mEq/L.`,
        }));
      },
      explanation:
        'Scala di Greco: K⁺ < 2,0 → 80 mEq/L (max 6 ml/kg/h); 2,1–2,5 → 60 (max 8); 2,6–3,0 → 40 (max 12); 3,1–3,5 → 28 (max 18); 3,6–5,0 → 20 (max 25). In ogni caso non superare 0,5 mEq/kg/h.',
    },
    {
      kind: 'pump',
      id: 'pompa',
      phase: 'Stabilizzazione',
      title: 'Prepara la sacca e imposta la pompa',
      intro: (ctx) => `Birillo pesa ${KG} kg. K⁺ misurato: ${kText(ctx)}. Hai sacche da 500 ml e fiale di KCl 2 mEq/ml.`,
      bagMl: 500,
      kclMeqPerMl: 2,
      points: 15,
    },
    {
      kind: 'monitor',
      id: 'icu1',
      phase: 'Terapia intensiva',
      title: 'Terapia intensiva: la prima notte',
      intro:
        'Birillo è stabile e viene trasferito in terapia intensiva. Monitora il potassio durante la notte: puoi ripetere l’emogas, regolare la pompa e aggiungere farmaci. Il paziente evolve con il tempo.',
      goal: 'Arriva al mattino seguente (almeno 16 ore) ricontrollando il K⁺ e mantenendo l’infusione sicura.',
      minHours: 16,
      target: { kMin: 3.5, kMax: 5.5 },
      points: 15,
    },
    {
      kind: 'quiz',
      id: 'refrattaria',
      phase: 'Ragionamento',
      title: 'Il potassio non sale',
      context: (ctx) =>
        `Mattina del giorno 2. Ultimo K⁺: ${kText(ctx)} nonostante l’integrazione. Birillo ha ancora la ventroflessione del collo.`,
      question: 'Perché il potassio non si normalizza?',
      timer: 25,
      points: 15,
      options: [
        { id: 'a', text: 'Perdita renale inappropriata di K⁺: va quantificata e cercata la causa', score: 1, feedback: 'Esatto. Con il vomito fermo e un’integrazione adeguata, un K⁺ che non sale indica che il rene lo perde: serve la frazione di escrezione e lo studio delle cause (mineralcorticoidi, rene).' },
        { id: 'b', text: 'Serve solo più tempo: porto l’infusione a 1 mEq/kg/h', score: 0, feedback: 'Doppio errore: il limite è 0,5 mEq/kg/h, e aumentare senza cercare la causa non risolve la perdita.' },
        { id: 'c', text: 'Ipomagnesiemia refrattaria', score: 0.4, feedback: 'Causa reale di ipokaliemia refrattaria, va sempre considerata. Ma il magnesio del biochimico era nella norma.' },
        { id: 'd', text: 'La pompa infusionale è guasta', score: 0, feedback: 'Si verifica in un minuto, ma non spiega il quadro.' },
      ],
      explanation: 'Ipokaliemia refrattaria + ipertensione + alcalosi metabolica + sodio ai limiti alti = eccesso di mineralcorticoidi finché non si dimostra il contrario.',
    },
    {
      kind: 'orders',
      id: 'workup',
      phase: 'Approfondimento',
      title: 'Approfondimento diagnostico',
      intro: 'Il quadro è persistente: ventroflessione, debolezza, ipokaliemia e ipertensione. Quali esami richiedi?',
      groups: [
        { title: 'Laboratorio', exams: ['urine', 'biochimico', 't4', 'fivfelv', 'aldosterone', 'emocromo'] },
        { title: 'Diagnostica strumentale', exams: ['ecografia', 'pa', 'fondo', 'ecocardio', 'ecg', 'rx', 'tc', 'endoscopia'] },
      ],
      relevance: (ctx) => ({
        urine: { rel: 'essential', why: 'Frazione di escrezione del K⁺: dimostra la perdita renale.' },
        aldosterone: { rel: 'essential', why: 'Conferma dell’iperaldosteronismo (eseguito nel caso reale).' },
        ecografia: { rel: 'essential', why: 'Cerca la massa surrenalica (eseguita nel caso reale).' },
        pa: { rel: ctx.findings.pa || ctx.hasResult('pa') ? 'useful' : 'essential', why: 'L’ipertensione persistente è un criterio chiave.' },
        biochimico: { rel: 'useful', why: 'Azotemia e creatinina: escludere la malattia renale come causa (eseguiti nel caso reale).' },
        t4: { rel: 'useful', why: 'L’ipertiroidismo è una causa frequente di ipertensione nel gatto (eseguito: nella norma).' },
        fivfelv: { rel: 'useful', why: 'Screening nel gatto ricoverato (eseguito: negativo).' },
        fondo: { rel: 'useful', why: 'Danno d’organo da ipertensione.' },
        ecocardio: { rel: 'useful', why: 'Danno cardiaco da ipertensione, utile prima dell’anestesia.' },
        emocromo: { rel: 'neutral', why: 'Già eseguito in PS.' },
        ecg: { rel: 'neutral', why: 'Utile solo se il monitor mostra aritmie.' },
        rx: { rel: 'neutral', why: 'Non risponde alla domanda.' },
        tc: { rel: 'neutral', why: 'Verrà usata per la pianificazione chirurgica, a paziente stabile.' },
        endoscopia: { rel: 'inappropriate', why: 'Non pertinente.' },
      }),
      points: 20,
    },
    {
      kind: 'quiz',
      id: 'diagnosi',
      phase: 'Diagnosi',
      title: 'Sospetto diagnostico',
      context: (ctx) => {
        const fek = ctx.lastValue('urine', 'FE K⁺');
        const t4 = ctx.lastValue('t4', 'T4 totale');
        const parts = [`K⁺ ${kText(ctx)}`, 'ipertensione', 'alcalosi metabolica', 'Na⁺ ai limiti alti'];
        if (fek !== undefined) parts.push(`FE K⁺ ${fek}%`);
        if (t4 !== undefined) parts.push(`T4 ${t4} µg/dL`);
        if (ctx.hasResult('ecografia')) parts.push('massa surrenalica sinistra all’ecografia');
        return parts.join(' · ');
      },
      question: 'Qual è il sospetto diagnostico principale?',
      timer: 25,
      points: 20,
      options: [
        { id: 'a', text: 'Iperaldosteronismo primario (sindrome di Conn)', score: 1, feedback: 'Esatto. Un adenoma o carcinoma surrenalico produce aldosterone in modo autonomo: il rene perde K⁺ e trattiene Na⁺, con ipertensione e alcalosi metabolica.' },
        { id: 'b', text: 'Malattia renale cronica con ipokaliemia', score: 0.3, feedback: 'L’IRC dà ipokaliemia e ipertensione, ma l’azotemia è lieve, e la perdita renale di K⁺ con alcalosi e la massa surrenalica indicano un eccesso di mineralcorticoidi.' },
        { id: 'c', text: 'Ipertiroidismo', score: 0, feedback: 'Il T4 totale è nella norma.' },
        { id: 'd', text: 'Iperadrenocorticismo ipofisi-dipendente (Cushing)', score: 0.2, feedback: 'Nel gatto si associa spesso a diabete e fragilità cutanea; qui il quadro è mineralcorticoide, non glucocorticoide.' },
      ],
      explanation:
        'Nella cartella reale compare la dicitura “iperadrenocorticismo primario (sindrome di Conn)”: il termine corretto per la sindrome di Conn è iperaldosteronismo primario. Conferma con l’aldosterone sierico (idealmente il rapporto aldosterone/renina) e la diagnostica per immagini.',
    },
    {
      kind: 'quiz',
      id: 'terapia',
      phase: 'Terapia',
      title: 'Piano terapeutico',
      question: 'Imposta la terapia in attesa di decidere sulla chirurgia (seleziona tutte le scelte corrette).',
      multi: true,
      timer: 40,
      points: 20,
      options: [
        { id: 'spiro', text: 'Spironolattone 2 mg/kg BID', score: 1, feedback: 'Antagonista dell’aldosterone: riduce la perdita renale di K⁺ (caso reale).', effects: [{ kind: 'drug', drug: 'spironolattone' }] },
        { id: 'amlo', text: 'Amlodipina 0,125–0,25 mg/kg SID', score: 1, feedback: 'Antipertensivo di prima scelta nel gatto (caso reale).', effects: [{ kind: 'drug', drug: 'amlodipina' }] },
        { id: 'koral', text: 'Integrazione orale di potassio', score: 1, feedback: 'Permette di ridurre l’integrazione endovenosa (caso reale: potassio gluconato).', effects: [{ kind: 'drug', drug: 'kclOrale' }] },
        { id: 'chir', text: 'Proporre la surrenalectomia come prima opzione', score: 1, feedback: 'È il trattamento risolutivo nei tumori unilaterali (proposta nel caso reale).', effects: [{ kind: 'flag', flag: 'surgeryProposed' }] },
        { id: 'trilo', text: 'Trilostano', score: 0, feedback: 'Si usa nell’ipercortisolismo, non nell’iperaldosteronismo.' },
        { id: 'meti', text: 'Metimazolo', score: 0, feedback: 'Per l’ipertiroidismo: il T4 è normale.' },
        { id: 'furo', text: 'Furosemide', score: 0, feedback: 'Aumenta la perdita di potassio.', effects: [{ kind: 'drug', drug: 'furosemide' }] },
        { id: 'pred', text: 'Prednisolone', score: 0, feedback: 'Non indicato e peggiora ipertensione e ritenzione di sodio.' },
      ],
      explanation:
        'Attenzione: lo spironolattone trattiene il potassio. Quando il farmaco agisce (nel simulatore ~12 h, nella realtà qualche giorno) l’integrazione di KCl va ridotta in base agli emogas di controllo, altrimenti rischi l’iperkaliemia.',
    },
    {
      kind: 'monitor',
      id: 'icu2',
      phase: 'Terapia intensiva',
      title: 'Terapia intensiva: risposta alla terapia medica',
      intro: (ctx) =>
        `Terapia medica impostata. Nelle prossime 36 ore riporta il K⁺ in range senza superarlo e tieni la pressione sistolica sotto 160 mmHg. Ultimo K⁺: ${kText(ctx)}.`,
      goal: 'Almeno 36 ore. A fine fase: K⁺ 3,5–5,5 mEq/L e PAS < 160 mmHg.',
      minHours: 36,
      target: { kMin: 3.5, kMax: 5.5, sbpMax: 160 },
      points: 20,
    },
    {
      kind: 'quiz',
      id: 'tc-scelta',
      phase: 'Chirurgia',
      title: 'Pianificazione chirurgica',
      context: 'Paziente stabilizzato. I proprietari accettano di valutare la surrenalectomia sinistra.',
      question: 'Quale esame chiedi per pianificare l’intervento?',
      timer: 25,
      points: 10,
      options: [
        { id: 'a', text: 'TC total body con mezzo di contrasto', score: 1, feedback: 'Corretto (eseguita nel caso reale): valuta dimensioni, invasione della vena cava caudale, metastasi, surrene controlaterale e ipofisi.' },
        { id: 'b', text: 'Radiografia del torace in 3 proiezioni', score: 0.3, feedback: 'Utile per le metastasi polmonari, ma non mostra il rapporto della massa con i vasi.' },
        { id: 'c', text: 'Biopsia ecoguidata del surrene', score: 0, feedback: 'Rischio emorragico alto e scarsa utilità: l’istologia si fa dopo l’exeresi.' },
        { id: 'd', text: 'Ripetere l’ecografia tra un mese', score: 0, feedback: 'Ritarda la decisione senza aggiungere informazioni per il chirurgo.' },
      ],
      explanation: 'Prima dell’anestesia nel caso reale è stato fatto anche un controllo cardiologico (ECG nella norma, lieve ipertrofia concentrica del VS da probabile danno ipertensivo).',
    },
    {
      kind: 'ct',
      id: 'tc',
      phase: 'Chirurgia',
      title: 'Leggi la TC',
      skipMin: 12 * 60,
      intro:
        'Scorri le fette assiali dell’addome craniale e tocca la lesione. Convenzione radiologica: il lato SINISTRO del paziente è a DESTRA dello schermo; il ventrale è in alto.',
      points: 15,
    },
    { kind: 'debrief', id: 'debrief', phase: 'Debriefing', title: 'Debriefing' },
  ],

  results: {
    emocromo: () => ({
      title: 'Emocromo (analizzatore ematologico)',
      source: 'documento',
      rows: [
        row('Eritrociti', 11.1, 'M/µL', 6.54, 12.2),
        row('Ematocrito', 48.3, '%', 30.3, 52.3),
        row('Emoglobina', 15.6, 'g/dL', 9.8, 16.2),
        row('MCV', 43.5, 'fL', 35.9, 53.1),
        row('Reticolociti', 53.3, 'K/µL', 3, 50),
        row('Leucociti', 8.27, 'K/µL', 2.87, 17.02),
        row('Neutrofili', 4.56, 'K/µL', 2.3, 10.29),
        row('Linfociti', 2.96, 'K/µL', 0.92, 6.88),
        row('Eosinofili', 0.43, 'K/µL', 0.17, 1.57),
        row('Piastrine', 272, 'K/µL', 151, 600),
      ],
      conclusion: 'Nei limiti, lieve reticolocitosi non significativa.',
    }),
    biochimico: (ctx) => ({
      title: 'Profilo biochimico',
      source: 'misto',
      rows: [
        row('Azotemia', 55, 'mg/dL', 20, 30),
        row('Creatinina', 1.6, 'mg/dL', null, 1.8),
        row('Glucosio', ctx.phys.glu, 'mg/dL', 70, 150, true, 0),
        row('ALT (GPT)', 37, 'U/L', null, 50),
        row('ALP', 47, 'U/L', null, null),
        row('Bilirubina', 0.12, 'mg/dL', 0.15, 0.5),
        row('Proteine totali', 6.4, 'g/dL', 5.8, 7.8, true),
        row('Albumina', 2.9, 'g/dL', 2.1, 3.3, true),
        row('Fosforo', 4.6, 'mg/dL', 4.5, 8.1, true),
        row('Calcio totale', 9.6, 'mg/dL', 8.5, 10.5, true),
        row('Magnesio', 2.2, 'mg/dL', 1.8, 2.6, true),
        row('CK', 2850, 'U/L', 50, 450, true),
      ],
      conclusion: 'Azotemia lieve con creatinina nei limiti; CK aumentata (danno muscolare da ipokaliemia); magnesio nella norma.',
    }),
    emogas: (ctx) => ({ title: 'Emogas venoso + elettroliti', source: 'generato', rows: bloodGasRows(ctx.phys) }),
    lattati: (ctx) => ({ title: 'Lattatemia', source: 'generato', rows: [row('Lattati', ctx.phys.lact, 'mmol/L', null, 2.5, true, 1)] }),
    coagulazione: () => ({
      title: 'Coagulazione',
      source: 'generato',
      rows: [row('PT', 11.2, 's', 8, 15, true), row('aPTT', 14.5, 's', 10, 25, true)],
      conclusion: 'Nella norma.',
    }),
    urine: (ctx) => {
      const fek = Math.round(4 + 30 * aldoEffective(BIRILLO.disease, ctx.therapy, ctx.clock));
      return {
        title: 'Esame urine (cistocentesi) + FE K⁺',
        source: 'misto',
        rows: [
          txt('Peso specifico', '1010'),
          txt('pH', '7.5'),
          txt('Proteine', '+', '', false, true),
          txt('Glucosio', 'assente'),
          txt('Sangue', 'assente'),
          txt('Sedimento', 'leucociti e cellule epiteliali rare'),
          row('UPC', 0.1, '', null, 0.2),
          row('FE K⁺', fek, '%', null, 4, true),
        ],
        conclusion: `Frazione di escrezione del potassio ${fek}%: in corso di ipokaliemia dovrebbe essere < 4%. Perdita renale inappropriata di K⁺.`,
      };
    },
    t4: () => ({ title: 'T4 totale', source: 'documento', rows: [row('T4 totale', 1.55, 'µg/dL', 0.78, 4.66)], conclusion: 'Nella norma: ipertiroidismo improbabile.' }),
    fivfelv: () => ({ title: 'FIV / FeLV', source: 'documento', rows: [txt('FIV Ab', 'negativo'), txt('FeLV Ag', 'negativo')] }),
    aldosterone: () => ({
      title: 'Aldosterone sierico',
      source: 'generato',
      rows: [row('Aldosterone', 1850, 'pmol/L', 110, 540, true)],
      conclusion: 'Marcatamente aumentato. Con ipokaliemia e ipertensione è compatibile con iperaldosteronismo primario (per la conferma servirebbe il rapporto aldosterone/renina).',
    }),
    ecofast: () => ({ title: 'Eco-FAST', source: 'documento', text: 'A-FAST: finestre diaframmatico-epatica, spleno-renale, epato-renale e cisto-colica senza liquido libero. T-FAST negativo.', conclusion: 'Negativo.' }),
    ecografia: () => ({
      title: 'Ecografia addominale specialistica',
      source: 'generato',
      text:
        'Surrene sinistro aumentato di volume (1,8 × 1,5 cm), ovalare, ecostruttura disomogenea con piccole aree anecogene. Surrene destro nei limiti (spessore 0,4 cm). Reni: lieve riduzione della differenziazione cortico-midollare bilaterale. Colecisti con sedimento. Vena cava caudale senza segni evidenti di invasione.',
      conclusion: 'Neoformazione surrenalica sinistra.',
    }),
    rx: () => ({ title: 'RX torace', source: 'generato', text: 'Silhouette cardiaca nei limiti. Parenchima polmonare senza reperti di rilievo. Nessun segno di metastasi.', conclusion: 'Nei limiti.' }),
    ecg: (ctx) => ({
      title: 'ECG',
      source: 'generato',
      text:
        ctx.phys.k < 2.5
          ? `Ritmo sinusale ${Math.round(ctx.phys.hr)} bpm. Onde T di ampiezza ridotta, lieve sottoslivellamento del tratto ST. Nessuna aritmia.`
          : `Ritmo sinusale ${Math.round(ctx.phys.hr)} bpm, asse nel quadrante di riferimento, nessuna aritmia.`,
      conclusion: ctx.phys.k < 2.5 ? 'Alterazioni compatibili con ipokaliemia.' : 'Nei limiti della norma.',
    }),
    endoscopia: () => ({ title: 'Gastroscopia', source: 'generato', text: 'Mucosa gastrica lievemente iperemica, nessun corpo estraneo.', conclusion: 'Reperto aspecifico.' }),
    tc: () => ({
      title: 'TC total body con mdc',
      source: 'documento',
      text:
        'Surrene sn discretamente ingrandito e ovalare (diam. max 1,84 × 1,58 cm), con densità e impregnazione irregolari per alcune cavitazioni ipodense non impregnanti; surrene dx nei limiti. Non apprezzabili secondarismi. Ipofisi ai limiti superiori della norma (P:B 0,48). Reperti accessori: moderata dilatazione atriale (soprattutto sn) con moderato ispessimento del setto e delle pareti del VS; ridotta impregnazione della corticale renale bilaterale; sedimento denso in colecisti.',
      conclusion:
        'Lesione neoplastica del surrene sn e dubbio microadenoma ipofisario in soggetto con note di cardiomiopatia ipertrofica, fango biliare e insufficienza renale.',
    }),
    ecocardio: () => ({
      title: 'Ecocardiografia',
      source: 'documento',
      text: 'Lieve ipertrofia ventricolare concentrica senza SAM. Lieve dilatazione dell’atrio destro senza rigurgito tricuspidale.',
      conclusion: 'Ipertrofia lieve, probabilmente secondaria all’ipertensione.',
    }),
    pa: (ctx) => ({
      title: 'Pressione arteriosa (Doppler)',
      source: 'generato',
      rows: [row('PA sistolica', ctx.phys.sbp, 'mmHg', null, 160, true, 0)],
      conclusion: ctx.phys.sbp >= 180 ? 'Ipertensione grave: rischio elevato di danno d’organo.' : ctx.phys.sbp >= 160 ? 'Ipertensione.' : 'Nei limiti.',
    }),
    fondo: (ctx) => ({
      title: 'Fondo oculare',
      source: 'generato',
      text:
        ctx.phys.sbp >= 170
          ? 'Emorragie retiniche multifocali bilaterali, vasi tortuosi, distacco retinico bolloso parziale nell’OS. Riflesso pupillare diretto ridotto.'
          : 'Esiti di emorragie retiniche in riassorbimento, retina adesa.',
      conclusion: 'Retinopatia ipertensiva.',
    }),
  },
  refuse: { tc: unstable, endoscopia: unstable },
  ct: { slices: 30, lesion: { side: 'sx', from: 9, to: 15, cx: 192, cy: 178, r: 20, label: 'Surrene sinistro: 1,84 × 1,58 cm, cavitazioni ipodense' } },

  realCase: [
    { date: '16/06/2026', text: 'PS: T 39,2 °C, polso ritmico, FR 20, mucose normali, TRC 2 s, ottundimento. Ematologia, biochimico ed emogas; Eco-FAST negativo. Terapia: maropitant e integrazione di KCl. Stabile, trasferito in terapia intensiva.' },
    { date: '17/06/2026', text: 'Persistono ventroflessione del collo, debolezza, ipokaliemia e ipertensione. Azotemia 55, creatinina 1,6, T4 1,55 (norma), FIV/FeLV negativi, richiesti aldosterone ed ecografia addominale. Sospetto di sindrome di Conn: amlodipina, spironolattone 2 mg/kg BID, KCl in fluidoterapia. Ultimo emogas: alcalosi rientrata, K⁺ 2,4, Na⁺ ai limiti alti.' },
    { date: '06/07/2026', text: 'Controllo cardiologico pre-anestetico (neoformazione surrenalica): FC 200, ECG nella norma, lieve ipertrofia concentrica del VS senza SAM.' },
    { date: '13–15/07/2026', text: 'Degenza: azotemia 80 → 59 mg/dL, creatinina 2,8 → 2,12 mg/dL. Terapia: amlodipina, spironolattone, potassio orale, maropitant.' },
    { date: '22/07/2026', text: 'TC total body: lesione neoplastica del surrene sn (1,84 × 1,58 cm), dubbio microadenoma ipofisario, cardiomiopatia ipertrofica, fango biliare, insufficienza renale.' },
    { date: '24/07/2026', text: 'Urine: PS 1010, proteine +, UPC 0,10.' },
  ],
  finalDiagnosis: 'Iperaldosteronismo primario (sindrome di Conn) da neoplasia del surrene sinistro',
  diagnosisPoints: 20,
  diagnosisOptions: [
    { id: 'conn', text: 'Iperaldosteronismo primario (sindrome di Conn) da neoplasia del surrene sinistro', score: 1, feedback: 'Ipokaliemia refrattaria con perdita renale di K⁺, ipertensione, alcalosi metabolica, aldosterone elevato e massa surrenalica sinistra unilaterale alla TC.' },
    { id: 'iperplasia', text: 'Iperaldosteronismo primario da iperplasia surrenalica bilaterale', score: 0.5, feedback: 'La sindrome è giusta, ma la causa no: la TC mostra una lesione unilaterale a sinistra con il surrene destro nei limiti. Cambia la terapia: qui la chirurgia è risolutiva.' },
    { id: 'pdh', text: 'Iperadrenocorticismo ipofisi-dipendente (microadenoma ipofisario)', score: 0.1, feedback: 'La TC segnala un dubbio microadenoma, ma il quadro è mineralcorticoide (K⁺, alcalosi, ipertensione), non glucocorticoide: niente diabete, fragilità cutanea o addome pendulo.' },
    { id: 'feo', text: 'Feocromocitoma surrenalico', score: 0.2, feedback: 'Massa surrenalica con ipertensione, ma un feocromocitoma non spiega la perdita renale di K⁺, l’alcalosi e l’aldosterone elevato.' },
    { id: 'irc', text: 'Malattia renale cronica con ipertensione secondaria', score: 0.2, feedback: 'Birillo ha una componente renale (azotemia, TC), ma è una conseguenza: non spiega una FE K⁺ così alta né l’aldosterone elevato.' },
    { id: 'tiro', text: 'Ipertiroidismo', score: 0, feedback: 'T4 totale nella norma.' },
  ],
  teaching: [
    'Ventroflessione del collo nel gatto: pensa prima all’ipokaliemia.',
    'Gatto con cecità acuta e midriasi: misura la pressione e guarda il fondo dell’occhio.',
    'Mai superare 0,5 mEq/kg/h di K⁺ EV; dosa con la scala di Greco e ricontrolla spesso.',
    'Ipokaliemia refrattaria + ipertensione + alcalosi metabolica → cerca un eccesso di mineralcorticoidi.',
    'Lo spironolattone trattiene K⁺: riduci l’integrazione quando agisce.',
    'Nella TC il lato sinistro del paziente è a destra dello schermo.',
  ],
};

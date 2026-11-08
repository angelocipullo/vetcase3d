import { useMemo, useState } from 'react';
import { useGame } from '../../store';
import { DRUGS, EXAMS, FLUID_LABEL } from '../../sim/exams';
import { clinicalSigns, K_MAX_SAFE, kInfusionRate } from '../../sim/physiology';
import { K_SCALE, kclMlToAdd, kScale, maintenanceMlH } from '../../sim/protocols';
import { CAT_LABEL, summarize } from '../../sim/scoring';
import { dyn, fmtClock, fmtElapsed, useSim, useSimCtx } from '../../sim/store';
import { CtStage, DebriefStage, DrugId, FluidId, Fluids, MonitorStage, PumpStage } from '../../sim/types';
import { Continue, ResultView, stableShuffle, StageHeader, TrendChart } from './common';
import { CtViewer } from './imagingGames';
import { MENTOR } from '../../sim/cast';
import { SpeechBubble } from './rpg';

const KCL_STEPS = [0, 20, 28, 40, 60, 80];

/* ================================================================ pompa */
export function PumpView({ stage }: { stage: PumpStage }) {
  const ctx = useSimCtx();
  const c = useSim((s) => s.caseDef)!;
  const next = useSim((s) => s.next);
  const kg = c.disease.kg;
  const k = ctx.lastValue('emogas', 'K⁺') ?? c.initialPhys.k;
  const scale = kScale(k);
  const [fluid, setFluid] = useState<FluidId | null>(null);
  const [ml, setMl] = useState('');
  const [rate, setRate] = useState(Math.round(maintenanceMlH(kg)));
  const [done, setDone] = useState<{ pts: number; notes: string[] } | null>(null);

  const fluidK = fluid === 'rl' ? 4 : 0;
  const mlNum = Number(ml.replace(',', '.'));
  const conc = mlNum > 0 ? (mlNum * stage.kclMeqPerMl) / (stage.bagMl / 1000) : 0;
  const correctMl = kclMlToAdd(stage.bagMl, scale.meqL, stage.kclMeqPerMl, fluidK);
  const meqKgH = kInfusionRate({ fluids: { fluid: fluid ?? 'none', rateMlH: rate, kclMeqL: conc }, drugs: {} }, kg);
  const maint = maintenanceMlH(kg);
  const maxRate = scale.maxMlKgH * kg;
  const tone = meqKgH > K_MAX_SAFE ? 'bad' : meqKgH > 0.4 ? 'mid' : 'good';

  const confirm = () => {
    const st = useSim.getState();
    if (!st.markDone(stage.id) || !fluid) return;
    const notes: string[] = [];
    let frac = 0;
    if (fluid === 'rl' || fluid === 'nacl') frac += 0.25;
    else notes.push('La glucosata stimola l’insulina e sposta K⁺ nelle cellule: scelta del fluido sbagliata.');
    const calcOk = Math.abs(mlNum - correctMl) <= 1.01 || Math.abs(conc - scale.meqL) <= 4;
    if (calcOk) frac += 0.35;
    else notes.push(`Calcolo: per ${scale.meqL} mEq/L in ${stage.bagMl} ml servono ~${correctMl.toFixed(0)} ml di KCl ${stage.kclMeqPerMl} mEq/ml. La tua sacca è a ${conc.toFixed(0)} mEq/L.`);
    const safe = st.setFluids({ fluid, rateMlH: rate, kclMeqL: Math.round(conc) });
    if (safe && rate >= maint * 0.8 && rate <= maxRate + 0.5) frac += 0.4;
    else if (safe) notes.push(`Velocità: tra il mantenimento (~${maint.toFixed(0)} ml/h) e il massimo della scala (${maxRate} ml/h).`);
    st.addScore('terapia', Math.round(stage.points * frac), stage.points, 'Preparazione sacca e pompa');
    st.advance(10);
    setDone({ pts: Math.round(stage.points * frac), notes });
  };

  return (
    <div className="s-stage">
      <StageHeader eyebrow={stage.phase} title={stage.title}>
        <SpeechBubble speaker={MENTOR} text={dyn(stage.intro, ctx)} />
      </StageHeader>

      <section className="s-pump-step">
        <h4>1 · Fluido</h4>
        <div className="s-seg col">
          {(['rl', 'nacl', 'g5'] as FluidId[]).map((f) => (
            <button key={f} className={fluid === f ? 'on' : ''} disabled={!!done} onClick={() => setFluid(f)}>{FLUID_LABEL[f]}</button>
          ))}
        </div>
      </section>

      <section className="s-pump-step">
        <h4>2 · KCl nella sacca</h4>
        <p className="s-muted">
          Obiettivo dalla scala: <b>{scale.meqL} mEq/L</b>. Quanti ml di KCl {stage.kclMeqPerMl} mEq/ml aggiungi alla sacca da {stage.bagMl} ml?
          {fluid === 'rl' && ' (Il Ringer contiene già 4 mEq/L di K⁺.)'}
        </p>
        <div className="s-form">
          <label>
            ml di KCl
            <input type="number" min={0} step={0.5} value={ml} disabled={!!done} onChange={(e) => setMl(e.target.value)} />
          </label>
          <span className="s-calc">→ {conc ? conc.toFixed(0) : '—'} mEq/L {fluidK ? `(+${fluidK} dal Ringer)` : ''}</span>
        </div>
      </section>

      <section className="s-pump-step">
        <h4>3 · Velocità della pompa</h4>
        <div className="s-pump">
          <div className="s-pump-lcd">
            <span>{rate}</span>
            <small>ml/h</small>
          </div>
          <input type="range" min={0} max={60} value={rate} disabled={!!done} onChange={(e) => setRate(Number(e.target.value))} />
          <div className="s-pump-info">
            <span>Mantenimento ~{maint.toFixed(0)} ml/h</span>
            <span>Max scala {maxRate} ml/h ({scale.maxMlKgH} ml/kg/h)</span>
            <span className={`s-safety ${tone}`}>K⁺ {meqKgH.toFixed(2)} mEq/kg/h {meqKgH > K_MAX_SAFE ? '⚠ oltre 0,5!' : ''}</span>
          </div>
        </div>
      </section>

      <details className="s-ref">
        <summary>Scala di integrazione del potassio</summary>
        <table className="s-lab">
          <tbody>
            {K_SCALE.map((r) => (
              <tr key={r.range}>
                <td>K⁺ {r.range}</td>
                <td className="num">{r.meqL} mEq/L</td>
                <td className="ref">max {r.maxMlKgH} ml/kg/h</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      {!done ? (
        <button className="s-btn primary" disabled={!fluid || !ml} onClick={confirm}>Avvia l’infusione</button>
      ) : (
        <>
          <div className={`s-verdict ${done.notes.length ? 'mid' : 'good'}`}>
            <b>Infusione avviata · +{done.pts}/{stage.points}</b>
            {done.notes.length ? done.notes.map((n) => <p key={n}>{n}</p>) : <p>Sacca e velocità corrette, infusione entro il limite di sicurezza.</p>}
          </div>
          <Continue onClick={next} />
        </>
      )}
    </div>
  );
}

/* ================================================================ pannello terapia (riusato nel monitor) */
function TherapyEditor() {
  const therapy = useSim((s) => s.therapy);
  const kg = useSim((s) => s.caseDef!.disease.kg);
  const [f, setF] = useState<Fluids>(therapy.fluids);
  const dirty = f.fluid !== therapy.fluids.fluid || f.rateMlH !== therapy.fluids.rateMlH || f.kclMeqL !== therapy.fluids.kclMeqL;
  const rate = kInfusionRate({ fluids: f, drugs: {} }, kg);
  return (
    <div className="s-therapy">
      <h4>Pompa infusionale</h4>
      <div className="s-pump-row">
        <select value={f.fluid} onChange={(e) => setF({ ...f, fluid: e.target.value as FluidId })}>
          {(Object.keys(FLUID_LABEL) as FluidId[]).map((id) => (
            <option key={id} value={id}>{FLUID_LABEL[id]}</option>
          ))}
        </select>
        <label>
          <input type="number" min={0} max={80} value={f.rateMlH} onChange={(e) => setF({ ...f, rateMlH: Math.max(0, Number(e.target.value)) })} /> ml/h
        </label>
        <label>
          KCl
          <select value={f.kclMeqL} onChange={(e) => setF({ ...f, kclMeqL: Number(e.target.value) })}>
            {[...new Set([...KCL_STEPS, f.kclMeqL])].sort((a, b) => a - b).map((v) => (
              <option key={v} value={v}>{v} mEq/L</option>
            ))}
          </select>
        </label>
      </div>
      <div className="s-row">
        <span className={`s-safety ${rate > K_MAX_SAFE ? 'bad' : rate > 0.4 ? 'mid' : 'good'}`}>{rate.toFixed(2)} mEq/kg/h</span>
        <button className="s-btn small primary" disabled={!dirty} onClick={() => useSim.getState().setFluids(f)}>Applica</button>
      </div>
      <h4>Farmaci</h4>
      <div className="s-drugs">
        {(Object.keys(DRUGS) as DrugId[]).map((d) => {
          const on = therapy.drugs[d] !== undefined;
          return (
            <button key={d} className={`s-drug ${on ? 'on' : ''}`} onClick={() => useSim.getState().setDrug(d, !on)} title={DRUGS[d].note}>
              <b>{DRUGS[d].label}</b>
              <small>{DRUGS[d].dose}</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ================================================================ terapia intensiva */
export function MonitorView({ stage }: { stage: MonitorStage }) {
  const ctx = useSimCtx();
  const c = useSim((s) => s.caseDef)!;
  const clock = useSim((s) => s.clock);
  const stageStart = useSim((s) => s.stageStart);
  const results = useSim((s) => s.results);
  const phys = useSim((s) => s.phys);
  const history = useSim((s) => s.history);
  const flags = useSim((s) => s.flags);
  const next = useSim((s) => s.next);
  const [startState] = useState(() => ({ k: useSim.getState().phys.k, flags: { ...useSim.getState().flags } }));
  const [intro] = useState(() => dyn(stage.intro, useSim.getState().ctx()));
  const [verdict, setVerdict] = useState<{ pts: number; notes: string[] } | null>(null);

  const elapsedH = (clock - stageStart) / 60;
  const kPoints = results
    .filter((r) => r.exam === 'emogas' && !r.refused && r.readyAt <= clock)
    .map((r) => ({ t: r.readyAt, v: Number(r.rows!.find((x) => x.label === 'K⁺')!.value) }));
  const checksHere = results.filter((r) => r.exam === 'emogas' && r.orderedAt >= stageStart).length;
  const sbpPoints = history.filter((h) => h.t >= Math.max(0, stageStart - 60)).map((h) => ({ t: h.t, v: h.sbp }));
  const signs = clinicalSigns(phys, c.observation?.(useSim.getState().ctx()));
  const minChecks = Math.ceil(stage.minHours / 10);

  const recheck = () => {
    const st = useSim.getState();
    st.addResult('emogas');
    st.advance(5);
  };

  const finish = () => {
    const st = useSim.getState();
    if (!st.markDone(stage.id)) return;
    const notes: string[] = [];
    let frac = 0;
    if (checksHere >= minChecks) frac += 0.3;
    else notes.push(`Hai ricontrollato il K⁺ solo ${checksHere} volte: in ${stage.minHours} h ne servono almeno ${minChecks}.`);
    const crisis = (['critLowK', 'critHighK'] as const).some((f) => flags[f] && !startState.flags[f]);
    if (!crisis) frac += 0.3;
    else notes.push('Durante la fase c’è stata una crisi elettrolitica.');
    const { kMin, kMax, sbpMax } = stage.target;
    if (stage.id === 'icu1') {
      if (phys.k > startState.k + 0.2) frac += 0.4;
      else notes.push('Il K⁺ non è migliorato rispetto all’inizio della fase.');
    } else {
      if (phys.k >= kMin && phys.k <= kMax) frac += 0.25;
      else notes.push(`K⁺ attuale ${phys.k.toFixed(1)} mEq/L, fuori dall’intervallo ${kMin}–${kMax}.`);
      if (!sbpMax || phys.sbp < sbpMax) frac += 0.15;
      else notes.push(`PAS ancora ${Math.round(phys.sbp)} mmHg.`);
    }
    const pts = Math.round(stage.points * frac);
    st.addScore('monitoraggio', pts, stage.points, stage.title);
    setVerdict({ pts, notes });
  };

  return (
    <div className="s-stage">
      <StageHeader eyebrow={stage.phase} title={stage.title}>
        <SpeechBubble speaker={MENTOR} text={intro} />
        <p className="s-goal">🎯 {stage.goal}</p>
      </StageHeader>

      <div className="s-monitor">
        <div className="s-mon-tile hr"><small>FC</small><b>{Math.round(phys.hr)}</b><i>bpm</i></div>
        <div className="s-mon-tile rr"><small>FR</small><b>{Math.round(phys.rr)}</b><i>/min</i></div>
        <div className="s-mon-tile bp"><small>PAS</small><b>{Math.round(phys.sbp)}</b><i>mmHg</i></div>
        <div className="s-mon-tile t"><small>T</small><b>{phys.temp.toFixed(1)}</b><i>°C</i></div>
      </div>
      <ul className="s-signs">
        {signs.signs.map((s) => (
          <li key={s}>{s}</li>
        ))}
        <li>Stato mentale: {signs.mentation}</li>
      </ul>

      <div className="s-charts">
        <div>
          <h4>K⁺ misurato (mEq/L)</h4>
          <TrendChart points={kPoints} band={[stage.target.kMin, stage.target.kMax]} yMin={1} yMax={7} unit="K⁺" t0={0} t1={clock} />
        </div>
        <div>
          <h4>PAS da monitor (mmHg)</h4>
          <TrendChart points={[]} line={sbpPoints} band={[100, 160]} yMin={80} yMax={240} unit="PAS" t0={Math.max(0, stageStart - 60)} t1={clock} height={110} />
        </div>
      </div>

      {!verdict && (
        <>
          <div className="s-timebar">
            <div className="s-timebar-fill" style={{ width: `${Math.min(100, (elapsedH / stage.minHours) * 100)}%` }} />
            <span>{fmtElapsed(clock - stageStart)} / {stage.minHours} h · {fmtClock(c, clock)}</span>
          </div>
          <div className="s-row wrap">
            <button className="s-btn" onClick={recheck}>⚗️ Emogas di controllo ({EXAMS.emogas.cost} €)</button>
            <button className="s-btn" onClick={() => useSim.getState().advance(60)}>+1 h</button>
            <button className="s-btn" onClick={() => useSim.getState().advance(240)}>+4 h</button>
            <button className="s-btn" onClick={() => useSim.getState().advance(480)}>+8 h</button>
          </div>
          <TherapyEditor />
          <button className="s-btn primary" disabled={elapsedH < stage.minHours} onClick={finish}>
            {elapsedH < stage.minHours ? `Ancora ${Math.ceil(stage.minHours - elapsedH)} h di osservazione` : 'Concludi la fase'}
          </button>
        </>
      )}
      {verdict && (
        <>
          <div className={`s-verdict ${verdict.notes.length ? 'mid' : 'good'}`}>
            <b>{stage.title} · +{verdict.pts}/{stage.points}</b>
            {verdict.notes.length ? verdict.notes.map((n) => <p key={n}>{n}</p>) : <p>Monitoraggio attento e paziente in miglioramento.</p>}
          </div>
          <Continue onClick={next} />
        </>
      )}
      {ctx.lastValue('emogas', 'K⁺') === undefined && <p className="s-hint">Nessun emogas disponibile.</p>}
    </div>
  );
}

/* ================================================================ TC */
export function CtView({ stage }: { stage: CtStage }) {
  const c = useSim((s) => s.caseDef)!;
  const next = useSim((s) => s.next);
  const [found, setFound] = useState<number | null>(null);
  const [doc, setDoc] = useState<ReturnType<ReturnType<typeof useSim.getState>['addResult']> | null>(null);

  const onFound = (misses: number) => {
    const st = useSim.getState();
    if (!st.markDone(stage.id)) return;
    if (st.phys.k < 3.0) {
      st.addScore('monitoraggio', -5, 0, 'TC rinviata: paziente non stabilizzato');
      st.addLog('evento', 'L’anestesista accetta solo dopo 24 h di ulteriore stabilizzazione');
      st.advance(24 * 60);
    }
    const d = st.addResult('tc', true);
    st.advance(EXAMS.tc.workMin + EXAMS.tc.turnaroundMin);
    st.addScore('ragionamento', Math.round(stage.points * Math.max(0.4, 1 - 0.15 * misses)), stage.points, `Lettura TC (${misses} errori)`);
    setFound(misses);
    setDoc(d);
  };

  return (
    <div className="s-stage">
      <StageHeader eyebrow={stage.phase} title={stage.title}>
        <SpeechBubble speaker={MENTOR} text={stage.intro} />
      </StageHeader>
      {c.ct && <CtViewer spec={c.ct} onFound={onFound} />}
      {found !== null && doc && (
        <>
          <ResultView doc={doc} />
          <Continue onClick={next} label="Vai al debriefing" />
        </>
      )}
    </div>
  );
}

/* ================================================================ debriefing */

/** Diagnosi finale a scelta multipla: va data prima di vedere l'esito. */
function FinalDiagnosis({ stage }: { stage: DebriefStage }) {
  const c = useSim((s) => s.caseDef)!;
  const options = useMemo(() => stableShuffle(c.diagnosisOptions, `${c.id}-dx`), [c]);
  const [pick, setPick] = useState<string | null>(null);
  return (
    <div className="s-stage">
      <StageHeader eyebrow={stage.phase} title="Diagnosi finale">
        <SpeechBubble speaker={MENTOR} text={`Bene, hai raccolto tutti i dati. Allora, qual è la diagnosi di ${c.patient.name}? Prima di vedere com’è andata, devi sceglierne una.`} />
      </StageHeader>
      <div className="s-options multi">
        {options.map((o, i) => (
          <button key={o.id} className={`s-option ${pick === o.id ? 'sel' : ''}`} onClick={() => setPick(o.id)}>
            <span className="s-letter">{'ABCDEFGH'[i]}</span>
            <span className="s-opt-text">{o.text}</span>
          </button>
        ))}
      </div>
      <Continue label="Conferma e vedi il debriefing" disabled={!pick} onClick={() => pick && useSim.getState().chooseFinalDx(pick)} />
    </div>
  );
}
export function DebriefView({ stage }: { stage: DebriefStage }) {
  const c = useSim((s) => s.caseDef)!;
  const score = useSim((s) => s.score);
  const history = useSim((s) => s.history);
  const results = useSim((s) => s.results);
  const clock = useSim((s) => s.clock);
  const spent = useSim((s) => s.spent);
  const log = useSim((s) => s.log);
  const sum = useMemo(() => summarize(score), [score]);
  const kMeasured = results
    .filter((r) => r.exam === 'emogas' && !r.refused && r.readyAt <= clock)
    .map((r) => ({ t: r.readyAt, v: Number(r.rows!.find((x) => x.label === 'K⁺')!.value) }));
  const kTrue = history.map((h) => ({ t: h.t, v: h.k }));
  const finalDx = useSim((s) => s.finalDx);
  const restart = () => useSim.getState().start(c);
  const toMenu = () => useGame.getState().toMenu();

  if (!finalDx) return <FinalDiagnosis stage={stage} />;
  const chosen = c.diagnosisOptions.find((o) => o.id === finalDx)!;
  const right = c.diagnosisOptions.find((o) => o.score === 1)!;

  return (
    <div className="s-stage debrief">
      <StageHeader eyebrow={stage.phase} title={`Il caso di ${c.patient.name}`} />
      <div className="s-grade">
        <div className="s-grade-pct">{sum.pct}<small>%</small></div>
        <div>
          <b>{sum.grade}</b>
          <p className="s-muted">
            {sum.pts}/{sum.max} punti · {fmtElapsed(clock)} di tempo simulato · {spent} € in esami
          </p>
        </div>
      </div>

      <section className="s-card">
        <h4>Diagnosi</h4>
        <p className={chosen.score === 1 ? 'good' : chosen.score > 0 ? 'mid' : 'bad'}>
          La tua diagnosi: <b>{chosen.text}</b> · +{Math.round(c.diagnosisPoints * chosen.score)}/{c.diagnosisPoints}
        </p>
        <p className="s-muted">{chosen.feedback}</p>
        {chosen.score !== 1 && (
          <p>
            Corretta: <b>{right.text}</b>
            <br />
            <span className="s-muted">{right.feedback}</span>
          </p>
        )}
      </section>

      <section className="s-card">
        <h4>Punteggio per area</h4>
        {sum.byCat.map((cat) => (
          <details key={cat.cat} className="s-catrow">
            <summary>
              <span>{CAT_LABEL[cat.cat]}</span>
              <span className="s-bar"><i style={{ width: `${cat.max ? (cat.pts / cat.max) * 100 : 0}%` }} /></span>
              <b>{cat.pts}/{cat.max}</b>
            </summary>
            <ul>
              {cat.entries.map((e, i) => (
                <li key={i} className={e.pts < 0 ? 'bad' : ''}>
                  {e.note}: {e.pts}{e.max ? `/${e.max}` : ''}
                </li>
              ))}
            </ul>
          </details>
        ))}
      </section>

      {kMeasured.length > 1 && (
        <section className="s-card">
          <h4>Il potassio: cosa hai misurato e cosa succedeva davvero</h4>
          <TrendChart points={kMeasured} line={kTrue} band={[3.5, 5.5]} yMin={1} yMax={7} unit="K⁺" t1={clock} height={170} />
          <p className="s-legend"><i className="truth" /> andamento reale simulato <i className="meas" /> emogas eseguiti</p>
        </section>
      )}

      <section className="s-card">
        <h4>Da ricordare</h4>
        <ul className="s-bullets">
          {c.teaching.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </section>

      {c.generated ? (
        <section className="s-card">
          <h4>Origine del caso</h4>
          <p className="s-muted">Caso interamente generato a scopo didattico: tutti i dati sono simulati, in modo coerente con il quadro clinico.</p>
        </section>
      ) : (
        <section className="s-card">
          <h4>Il caso reale</h4>
          <ol className="s-real">
            {c.realCase.map((r) => (
              <li key={r.date}><b>{r.date}</b> {r.text}</li>
            ))}
          </ol>
          <p className="s-muted">I dati marcati “simulato” non sono nella documentazione originale e sono stati generati in modo coerente con il quadro clinico.</p>
        </section>
      )}

      <details className="s-card">
        <summary><b>Diario completo ({log.length} voci)</b></summary>
        <ul className="s-diary">
          {log.map((l, i) => (
            <li key={i} className={l.kind}><span>{fmtClock(c, l.t)}</span> {l.text}</li>
          ))}
        </ul>
      </details>

      <div className="s-row">
        <button className="s-btn" onClick={toMenu}>Torna al titolo</button>
        <button className="s-btn primary" onClick={restart}>Rigioca il caso</button>
      </div>
    </div>
  );
}

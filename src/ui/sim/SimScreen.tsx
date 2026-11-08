import { useEffect, useMemo, useState } from 'react';
import { useGame } from '../../store';
import { DRUGS, EXAMS, FLUID_LABEL, VITAL_LABEL } from '../../sim/exams';
import { clinicalSigns, kInfusionRate } from '../../sim/physiology';
import { fmtClock, fmtElapsed, useSim } from '../../sim/store';
import { DrugId, Stage, VitalId } from '../../sim/types';
import { NURSE } from '../../sim/cast';
import { ResultView } from './common';
import { PixelSprite } from './rpg';
import { AbgView, InterviewView, NarrativeView, OrdersView, QuizView, VitalsView } from './stagesA';
import { CtView, DebriefView, MonitorView, PumpView } from './stagesB';
import './sim.css';

function StageView({ stage }: { stage: Stage }) {
  switch (stage.kind) {
    case 'narrative':
      return <NarrativeView stage={stage} />;
    case 'quiz':
      return <QuizView stage={stage} />;
    case 'interview':
      return <InterviewView stage={stage} />;
    case 'vitals':
      return <VitalsView stage={stage} />;
    case 'orders':
      return <OrdersView stage={stage} />;
    case 'abg':
      return <AbgView stage={stage} />;
    case 'pump':
      return <PumpView stage={stage} />;
    case 'monitor':
      return <MonitorView stage={stage} />;
    case 'ct':
      return <CtView stage={stage} />;
    case 'debrief':
      return <DebriefView stage={stage} />;
  }
}

/** Paziente: osservazione clinica, parametri rilevati, terapia in corso. */
function PatientPanel() {
  const c = useSim((s) => s.caseDef)!;
  const phys = useSim((s) => s.phys);
  const findings = useSim((s) => s.findings);
  const therapy = useSim((s) => s.therapy);
  const stageIdx = useSim((s) => s.stageIdx);
  const signs = clinicalSigns(phys, c.observation?.(useSim.getState().ctx()));
  const inIcu = c.stages.slice(0, stageIdx + 1).some((s) => s.kind === 'monitor');
  const drugs = (Object.keys(therapy.drugs) as DrugId[]).filter((d) => therapy.drugs[d] !== undefined);
  const f = therapy.fluids;
  return (
    <div className="s-panel">
      <div className="s-pt">
        <div className="s-pt-avatar" aria-hidden>
          <PixelSprite spec={c.cast.patient} size={44} />
        </div>
        <div>
          <b>{c.patient.name}</b>
          <span>
            {c.patient.species} {c.patient.breed} · {c.patient.sex} · {c.patient.age} · {c.patient.kg} kg
          </span>
        </div>
      </div>
      <p className="s-complaint">{c.complaint}</p>

      <h4>Osservazione</h4>
      <ul className="s-signs">
        {signs.signs.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>

      {inIcu && (
        <>
          <h4>Monitor</h4>
          <div className="s-monitor mini">
            <div className="s-mon-tile hr"><small>FC</small><b>{Math.round(phys.hr)}</b></div>
            <div className="s-mon-tile rr"><small>FR</small><b>{Math.round(phys.rr)}</b></div>
            <div className="s-mon-tile bp"><small>PAS</small><b>{Math.round(phys.sbp)}</b></div>
          </div>
        </>
      )}

      <h4>Scheda PS</h4>
      {Object.keys(findings).length === 0 ? (
        <p className="s-muted">Nessun parametro rilevato.</p>
      ) : (
        <dl className="s-kv">
          {(Object.keys(findings) as VitalId[]).map((v) => (
            <div key={v}>
              <dt>{VITAL_LABEL[v].icon} {VITAL_LABEL[v].label}</dt>
              <dd>{findings[v]!.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <h4>Terapia in corso</h4>
      {f.fluid === 'none' && drugs.length === 0 ? (
        <p className="s-muted">Nessuna.</p>
      ) : (
        <ul className="s-ther">
          {f.fluid !== 'none' && f.rateMlH > 0 && (
            <li>
              💧 {FLUID_LABEL[f.fluid]} {f.rateMlH} ml/h + KCl {f.kclMeqL} mEq/L{' '}
              <small>({kInfusionRate(therapy, c.disease.kg).toFixed(2)} mEq/kg/h)</small>
            </li>
          )}
          {drugs.map((d) => (
            <li key={d}>💊 {DRUGS[d].label} <small>{DRUGS[d].dose}</small></li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Cartella clinica: referti e diario. */
function ChartPanel() {
  const c = useSim((s) => s.caseDef)!;
  const results = useSim((s) => s.results);
  const clock = useSim((s) => s.clock);
  const log = useSim((s) => s.log);
  const stageKind = useSim((s) => s.caseDef!.stages[s.stageIdx].kind);
  const [tab, setTab] = useState<'referti' | 'diario'>('referti');
  const sorted = [...results].reverse();
  // durante l'interpretazione dell'emogas la stampa con i flag non va mostrata in cartella
  const hidden = stageKind === 'abg' ? sorted.find((r) => r.exam === 'emogas')?.id : undefined;
  return (
    <div className="s-panel">
      <div className="s-tabs-inline">
        <button className={tab === 'referti' ? 'on' : ''} onClick={() => setTab('referti')}>Referti ({results.length})</button>
        <button className={tab === 'diario' ? 'on' : ''} onClick={() => setTab('diario')}>Diario</button>
      </div>
      {tab === 'referti' &&
        (sorted.length === 0 ? (
          <p className="s-muted">Nessun esame richiesto.</p>
        ) : (
          sorted.map((r) =>
            r.id === hidden ? (
              <div key={r.id} className="s-result pending">
                <b>{EXAMS[r.exam].label}</b>
                <span className="s-muted">stampa in lettura: interpretala nella fase corrente</span>
              </div>
            ) : r.refused || r.readyAt <= clock ? (
              <ResultView key={r.id} doc={r} compact />
            ) : (
              <div key={r.id} className="s-result pending">
                <b>{EXAMS[r.exam].label}</b>
                <span className="s-muted">in corso · pronto alle {fmtClock(c, r.readyAt)}</span>
              </div>
            ),
          )
        ))}
      {tab === 'diario' && (
        <ul className="s-diary">
          {[...log].reverse().map((l, i) => (
            <li key={i} className={l.kind}>
              <span>{fmtClock(c, l.t)}</span> {l.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SimScreen() {
  const c = useSim((s) => s.caseDef);
  const stageIdx = useSim((s) => s.stageIdx);
  const clock = useSim((s) => s.clock);
  const spent = useSim((s) => s.spent);
  const modal = useSim((s) => s.modal);
  const [tab, setTab] = useState<'caso' | 'paziente' | 'cartella'>('caso');
  const phases = useMemo(() => (c ? [...new Set(c.stages.map((s) => s.phase))] : []), [c]);

  // torna sulla fase quando cambia la fase (su mobile)
  useEffect(() => setTab('caso'), [stageIdx]);
  useEffect(() => {
    document.querySelector('.s-main')?.scrollTo({ top: 0 });
  }, [stageIdx]);

  if (!c) return null;
  const stage = c.stages[stageIdx];
  const phaseIdx = phases.indexOf(stage.phase);

  return (
    <div className={`sim tab-${tab}`}>
      <header className="s-top">
        <button className="s-x" onClick={() => useGame.getState().toMenu()} aria-label="Esci" title="Torna al titolo">←</button>
        <div className="s-top-title">
          <b>PS · {c.patient.name}</b>
          <span>{c.title}</span>
        </div>
        <div className="s-clock">
          <b>{fmtClock(c, clock)}</b>
          <span>T+{fmtElapsed(clock)}</span>
        </div>
        <div className="s-spent" title="Spesa in esami">{spent} €</div>
      </header>
      <ol className="s-phases" aria-label="Fasi del caso">
        {phases.map((p, i) => (
          <li key={p} className={i < phaseIdx ? 'done' : i === phaseIdx ? 'cur' : ''}>{p}</li>
        ))}
      </ol>
      <div className="s-body">
        <aside className="s-left">
          <PatientPanel />
        </aside>
        <main className="s-main">
          <StageView key={stage.id} stage={stage} />
        </main>
        <aside className="s-right">
          <ChartPanel />
        </aside>
      </div>
      <nav className="s-tabs">
        <button className={tab === 'caso' ? 'on' : ''} onClick={() => setTab('caso')}>🩺 Caso</button>
        <button className={tab === 'paziente' ? 'on' : ''} onClick={() => setTab('paziente')}>🐈 Paziente</button>
        <button className={tab === 'cartella' ? 'on' : ''} onClick={() => setTab('cartella')}>📋 Cartella</button>
      </nav>
      {modal && (
        <div className="s-modal-backdrop">
          <div className={`s-modal rpg-alert ${modal.tone}`} role="alertdialog">
            <div className="rpg-alert-face">
              <PixelSprite spec={NURSE.sprite!} talking size={72} />
            </div>
            <div>
              <h3>{modal.tone === 'danger' ? '🚨 ' : '⚠️ '}{modal.title}</h3>
              <p>{modal.body}</p>
              <button className="s-btn primary" onClick={() => useSim.getState().closeModal()}>Ho capito</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

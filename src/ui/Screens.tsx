import { useEffect, useState } from 'react';
import { CASE_LIST, CASES } from '../game/cases';
import { evaluate } from '../game/evaluation';
import { DIAGNOSIS_LABEL, EXAM_LABEL, HEART_LABEL, LUNG_LABEL, OUTCOME_LABEL, TECH_ERROR_LABEL } from '../game/labels';
import { Outcome } from '../game/types';
import { useGame } from '../store';
import { audio } from '../audio/engine';

export function MenuScreen() {
  const start = useGame((s) => s.startCase);
  return (
    <div className="screen menu">
      <header className="brand">
        <div className="paw">🐾</div>
        <h1>VetCase 3D</h1>
        <p>Visita il paziente, raccogli i dati, trova la diagnosi.</p>
      </header>
      <div className="case-list">
        {CASE_LIST.map((c) => (
          <button
            key={c.id}
            className="case-card"
            onClick={() => {
              audio.unlock();
              start(c.id);
            }}
          >
            <span className="swatch" style={{ background: c.coat.base, borderColor: c.coat.ears }} />
            <span className="case-text">
              <b>{c.patient.name}</b>
              <span>{c.title}</span>
            </span>
            <span className="diff">{'●'.repeat(c.difficulty)}{'○'.repeat(3 - c.difficulty)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function ResultScreen() {
  const { caseId, exams, diagnosis, startCase, toMenu } = useGame();
  const c = CASES[caseId];
  const ev = diagnosis ? evaluate(c, exams, diagnosis) : null;
  const target = ev?.score ?? 0;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let v = 0;
    const id = setInterval(() => {
      v = Math.min(target, v + 2);
      setShown(v);
      if (v >= target) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [target]);
  if (!diagnosis || !ev) return null;
  const o = OUTCOME_LABEL[ev.outcome];

  return (
    <div className="screen result">
      <div className={`badge ${ev.outcome}`}>
        <span className="emoji">{o.emoji}</span>
        <h2>{o.title}</h2>
        <div className="score">{shown}<small>/100</small></div>
      </div>

      <section className="card">
        <h4>La tua diagnosi</h4>
        <p className={ev.diagnosisCorrect ? 'good' : 'bad'}>{DIAGNOSIS_LABEL[diagnosis]}</p>
        {!ev.diagnosisCorrect && (
          <p>
            Corretta: <b>{DIAGNOSIS_LABEL[c.correctDiagnosis]}</b>
          </p>
        )}
        <p className="muted">{c.explanation}</p>
      </section>

      <section className="card">
        <h4>Requisiti per la diagnosi</h4>
        <ul className="checks">
          {c.requiredExams.map((e) => (
            <li key={e} className={ev.missingExams.includes(e) ? 'bad' : 'good'}>
              {ev.missingExams.includes(e) ? '✗' : '✓'} {EXAM_LABEL[e]}
            </li>
          ))}
        </ul>
        {ev.outcome === Outcome.CorrectIncomplete && (
          <p className="hint warn">Diagnosi giusta, ma senza gli esami necessari a giustificarla.</p>
        )}
      </section>

      <section className="card">
        <h4>Auscultazione</h4>
        <dl className="kv">
          <dt>Cuore</dt>
          <dd>
            {exams.heart.answer ? (
              <span className={ev.interpretation.heart ? 'good' : 'bad'}>{HEART_LABEL[exams.heart.answer]}</span>
            ) : (
              '—'
            )}{' '}
            <span className="muted">reale: {HEART_LABEL[c.vitals.heartSound]} ({c.vitals.heartRate} bpm)</span>
          </dd>
          <dt>Polmoni</dt>
          <dd>
            {exams.lungs.answer ? (
              <span className={ev.interpretation.lungs ? 'good' : 'bad'}>{LUNG_LABEL[exams.lungs.answer]}</span>
            ) : (
              '—'
            )}{' '}
            <span className="muted">reale: {LUNG_LABEL[c.vitals.lungSound]} ({c.vitals.respRate} atti/min)</span>
          </dd>
        </dl>
      </section>

      <section className="card">
        <h4>Punteggio</h4>
        {ev.breakdown.map((b) => (
          <div key={b.label} className="meter">
            <span>
              {b.label} <b>{b.points}/{b.max}</b>
            </span>
            <div className="meter-track">
              <div className="meter-fill" style={{ width: `${(b.points / b.max) * 100}%`, background: 'var(--green)' }} />
            </div>
          </div>
        ))}
        {exams.errors.length > 0 && (
          <ul className="dots small">
            {exams.errors.map((e, i) => (
              <li key={i}>{TECH_ERROR_LABEL[e]}</li>
            ))}
          </ul>
        )}
      </section>

      <div className="row sticky">
        <button className="ghost" onClick={toMenu}>Altri casi</button>
        <button className="primary" onClick={() => startCase(caseId)}>Rifai il caso</button>
      </div>
    </div>
  );
}

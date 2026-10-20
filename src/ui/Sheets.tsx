import { useState } from 'react';
import { CASES } from '../game/cases';
import { DIAGNOSIS_LABEL, EXAM_LABEL, HEART_LABEL, LAB_META, LUNG_LABEL } from '../game/labels';
import { examsDone } from '../game/evaluation';
import { Diagnosis, Exam, LabParam } from '../game/types';
import { useGame } from '../store';

function Sheet({ title, children }: { title: string; children: React.ReactNode }) {
  const close = () => useGame.getState().setSheet(null);
  return (
    <div className="sheet-backdrop" onClick={close}>
      <div className="sheet slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon" onClick={close} aria-label="Chiudi">✕</button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

export function LabTable({ values }: { values: Record<LabParam, number> }) {
  return (
    <table className="lab">
      <tbody>
        {(Object.keys(LAB_META) as LabParam[]).map((k) => {
          const m = LAB_META[k];
          const v = values[k];
          const flag = v < m.min ? '↓' : v > m.max ? '↑' : '';
          return (
            <tr key={k} className={flag ? 'abn' : ''}>
              <td>{m.label}</td>
              <td className="num">
                {v} <small>{m.unit}</small> <b>{flag}</b>
              </td>
              <td className="ref">
                {m.min}–{m.max}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function RecordSheet() {
  const caseId = useGame((s) => s.caseId);
  const exams = useGame((s) => s.exams);
  const c = CASES[caseId];
  const p = c.patient;
  return (
    <Sheet title="📋 Cartella clinica">
      <section className="card">
        <h4>
          {p.name} · {p.breed}
        </h4>
        <p className="muted">
          {p.sex === 'F' ? 'Femmina' : 'Maschio'} · {p.age} · {p.weightKg} kg
        </p>
        <ul className="dots">
          {c.anamnesis.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </section>
      <section className="card">
        <h4>Esame obiettivo</h4>
        <dl className="kv">
          <dt>❤️ Cuore</dt>
          <dd>{exams.heart.answer ? HEART_LABEL[exams.heart.answer] : <em>non auscultato</em>}</dd>
          <dt>🫁 Polmoni</dt>
          <dd>{exams.lungs.answer ? LUNG_LABEL[exams.lungs.answer] : <em>non auscultati</em>}</dd>
          <dt>🌡️ Temperatura</dt>
          <dd>
            {exams.temperature !== undefined ? (
              <>
                {exams.temperature.toFixed(1)} °C <span className="muted">(rif. 37,5–39,2)</span>
              </>
            ) : (
              <em>non misurata</em>
            )}
          </dd>
        </dl>
      </section>
      <section className="card">
        <h4>🧪 Emocromo</h4>
        {exams.blood.resultsReady ? (
          <LabTable values={c.blood} />
        ) : exams.blood.success ? (
          <p className="muted">Campione in analisi…</p>
        ) : (
          <p className="muted">Nessun prelievo eseguito.</p>
        )}
      </section>
    </Sheet>
  );
}

export function DiagnosisSheet() {
  const exams = useGame((s) => s.exams);
  const submit = useGame((s) => s.submitDiagnosis);
  const [pick, setPick] = useState<Diagnosis | null>(null);
  const done = examsDone(exams);
  const all = Object.values(Exam);
  return (
    <Sheet title="🩺 Formula la diagnosi">
      <div className="exam-chips">
        {all.map((e) => (
          <span key={e} className={`chip ${done.has(e) ? 'on' : ''}`}>
            {done.has(e) ? '✓' : '○'} {EXAM_LABEL[e]}
          </span>
        ))}
      </div>
      <div className="dx-list">
        {(Object.keys(DIAGNOSIS_LABEL) as Diagnosis[]).map((d) => (
          <button key={d} className={`dx ${pick === d ? 'sel' : ''}`} onClick={() => setPick(d)}>
            {DIAGNOSIS_LABEL[d]}
          </button>
        ))}
      </div>
      <button className="primary wide" disabled={!pick} onClick={() => pick && submit(pick)}>
        Conferma diagnosi
      </button>
    </Sheet>
  );
}

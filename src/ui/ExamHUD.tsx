import { useEffect, useState } from 'react';
import { CASES } from '../game/cases';
import { TOOL_LABEL } from '../game/labels';
import { examsDone } from '../game/evaluation';
import { Tool } from '../game/types';
import { useGame } from '../store';
import { DiagnosisSheet, RecordSheet } from './Sheets';
import { SoundToggle } from './SoundToggle';
import { ListenPrompt, StethoscopeHint, SyringePanel, ThermometerPanel } from './ToolPanels';

/** Scorciatoie da tastiera (desktop): mostrate nel dock. */
const TOOL_KEY: Record<Tool, string> = {
  [Tool.Hand]: '1',
  [Tool.Stethoscope]: '2',
  [Tool.Thermometer]: '3',
  [Tool.Syringe]: '4',
};

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const g = useGame.getState();
      if (e.key === 'Escape') {
        if (g.sheet) g.setSheet(null);
        return;
      }
      if (e.key === 'm' || e.key === 'M') {
        g.toggleMute();
        return;
      }
      if (g.intro) {
        if (e.key === 'Enter') g.closeIntro();
        return;
      }
      if (g.sheet || g.prompt) return;
      const tool = (Object.keys(TOOL_KEY) as Tool[]).find((t) => TOOL_KEY[t] === e.key);
      if (tool) g.setTool(tool);
      else if (e.key === 'd' || e.key === 'D') g.setSheet('diagnosis');
      else if (e.key === 'c' || e.key === 'C') g.setSheet('record');
      else if (e.key === 'g' || e.key === 'G') g.setGuided(!g.guided);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

const TOOL_ICON: Record<Tool, string> = {
  [Tool.Hand]: '✋',
  [Tool.Stethoscope]: '🩺',
  [Tool.Thermometer]: '🌡️',
  [Tool.Syringe]: '💉',
};

function Toast() {
  const toast = useGame((s) => s.toast);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!toast) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 2600);
    return () => clearTimeout(t);
  }, [toast?.id]);
  if (!toast || !visible) return null;
  return <div key={toast.id} className="toast pop">{toast.text}</div>;
}

/** Scheda di accettazione: chi è il paziente e perché è qui. La diagnosi resta da scoprire. */
function IntroCard() {
  const caseId = useGame((s) => s.caseId);
  const p = useGame((s) => s.patient);
  const closeIntro = useGame((s) => s.closeIntro);
  const c = CASES[caseId];
  return (
    <div className="modal-backdrop intro-backdrop">
      <div className="modal intro pop" role="dialog" aria-labelledby="intro-title">
        <p className="eyebrow">Nuovo paziente in sala visita</p>
        <div className="intro-head">
          <span className="avatar big" style={{ background: c.coat.base, borderColor: c.coat.ears }} />
          <div>
            <h3 id="intro-title">{p.name}</h3>
            <p className="muted">
              {p.breed} · {p.sex === 'F' ? 'femmina' : 'maschio'} · {p.age} · {p.weightKg} kg
            </p>
          </div>
        </div>
        <div className="intro-reason">
          <small>Motivo della visita</small>
          <b>{c.title}</b>
        </div>
        <ul className="dots">
          {c.anamnesis.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
        <p className="hint">Visitalo, raccogli i dati che servono e formula la diagnosi.</p>
        <button className="primary wide" onClick={closeIntro} autoFocus>
          Inizia la visita
        </button>
      </div>
    </div>
  );
}

export function ExamHUD() {
  const caseId = useGame((s) => s.caseId);
  const stress = useGame((s) => Math.round(s.stress));
  const tool = useGame((s) => s.tool);
  const guided = useGame((s) => s.guided);
  const sheet = useGame((s) => s.sheet);
  const exams = useGame((s) => s.exams);
  const { setTool, setGuided, setSheet, toMenu } = useGame.getState();
  const c = CASES[caseId];
  const p = useGame((s) => s.patient);
  const intro = useGame((s) => s.intro);
  const doneCount = examsDone(exams).size;
  useShortcuts();

  return (
    <div className="hud">
      <div className="topbar">
        <button className="icon" onClick={toMenu} aria-label="Menu">←</button>
        <span className="avatar" style={{ background: c.coat.base, borderColor: c.coat.ears }} />
        <div className="patient">
          <b>{p.name}</b>
          <span>{p.breed} · {p.age}</span>
        </div>
        <div className="stress" title="Stress del paziente">
          <small>Stress <span>{stress}%</span></small>
          <span>{stress > 70 ? '😰' : stress > 40 ? '😐' : '😊'}</span>
          <div className="meter-track thin">
            <div
              className="meter-fill"
              style={{ width: `${stress}%`, background: stress > 70 ? 'var(--red)' : stress > 40 ? 'var(--orange)' : 'var(--green)' }}
            />
          </div>
        </div>
      </div>

      <div className="side-actions">
        <SoundToggle />
        <button className="pill" onClick={() => setSheet('record')} title="Cartella clinica (C)">
          📋 <span className="pill-label">Cartella</span> <span className="count">{doneCount}</span>
        </button>
        <button className={`pill ${guided ? 'on' : ''}`} onClick={() => setGuided(!guided)} title="Guida (G)">
          {guided ? '🎯 Guida on' : '🎯 Guida'}
        </button>
      </div>

      <Toast />

      <div className="bottom">
        {tool === Tool.Stethoscope && <StethoscopeHint />}
        {tool === Tool.Thermometer && <ThermometerPanel />}
        {tool === Tool.Syringe && <SyringePanel />}
        {tool === Tool.Hand && (
          <div className="panel compact">
            <p className="panel-title">Accarezza {p.name} per calmarlo · trascina per ruotare</p>
          </div>
        )}
      </div>

      <nav className="toolbar">
        {Object.values(Tool).map((t) => (
          <button key={t} className={`tool ${tool === t ? 'sel' : ''}`} onClick={() => setTool(t)} title={`${TOOL_LABEL[t]} (${TOOL_KEY[t]})`}>
            <span className="ti">{TOOL_ICON[t]}</span>
            <span className="tl">{TOOL_LABEL[t]}</span>
            <kbd>{TOOL_KEY[t]}</kbd>
          </button>
        ))}
        <button className="tool dx-btn" onClick={() => setSheet('diagnosis')} title="Diagnosi (D)">
          <span className="ti">🧠</span>
          <span className="tl">Diagnosi</span>
          <kbd>D</kbd>
        </button>
      </nav>

      {intro && <IntroCard />}
      <ListenPrompt />
      {sheet === 'record' && <RecordSheet />}
      {sheet === 'diagnosis' && <DiagnosisSheet />}
    </div>
  );
}

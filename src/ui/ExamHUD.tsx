import { useEffect, useState } from 'react';
import { CASES } from '../game/cases';
import { TOOL_LABEL } from '../game/labels';
import { examsDone } from '../game/evaluation';
import { Tool } from '../game/types';
import { useGame } from '../store';
import { DiagnosisSheet, RecordSheet } from './Sheets';
import { ListenPrompt, StethoscopeHint, SyringePanel, ThermometerPanel } from './ToolPanels';

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

export function ExamHUD() {
  const caseId = useGame((s) => s.caseId);
  const stress = useGame((s) => Math.round(s.stress));
  const tool = useGame((s) => s.tool);
  const guided = useGame((s) => s.guided);
  const sheet = useGame((s) => s.sheet);
  const exams = useGame((s) => s.exams);
  const { setTool, setGuided, setSheet, toMenu } = useGame.getState();
  const p = CASES[caseId].patient;
  const doneCount = examsDone(exams).size;

  return (
    <div className="hud">
      <div className="topbar">
        <button className="icon" onClick={toMenu} aria-label="Menu">←</button>
        <div className="patient">
          <b>{p.name}</b>
          <span>{p.breed} · {p.age}</span>
        </div>
        <div className="stress" title="Stress del paziente">
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
        <button className="pill" onClick={() => setSheet('record')}>
          📋 <span className="count">{doneCount}</span>
        </button>
        <button className={`pill ${guided ? 'on' : ''}`} onClick={() => setGuided(!guided)}>
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
        <nav className="toolbar">
          {Object.values(Tool).map((t) => (
            <button key={t} className={`tool ${tool === t ? 'sel' : ''}`} onClick={() => setTool(t)}>
              <span className="ti">{TOOL_ICON[t]}</span>
              <span className="tl">{TOOL_LABEL[t]}</span>
            </button>
          ))}
          <button className="tool dx-btn" onClick={() => setSheet('diagnosis')}>
            <span className="ti">🧠</span>
            <span className="tl">Diagnosi</span>
          </button>
        </nav>
      </div>

      <ListenPrompt />
      {sheet === 'record' && <RecordSheet />}
      {sheet === 'diagnosis' && <DiagnosisSheet />}
    </div>
  );
}

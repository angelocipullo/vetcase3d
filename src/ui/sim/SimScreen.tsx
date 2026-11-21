import { useEffect, useState } from 'react';
import { useGame } from '../../store';
import { fmtClock, fmtElapsed, useSim } from '../../sim/store';
import { Stage } from '../../sim/types';
import { NURSE } from '../../sim/cast';
import { ClinicalRecord, PatientBanner, readyCount } from './archive';
import { ClinicVisit } from '../ClinicVisit';
import { SoundToggle } from '../SoundToggle';
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

export function SimScreen() {
  const c = useSim((s) => s.caseDef);
  const stageIdx = useSim((s) => s.stageIdx);
  const clock = useSim((s) => s.clock);
  const spent = useSim((s) => s.spent);
  const modal = useSim((s) => s.modal);
  const results = useSim((s) => s.results);
  const [recordOpen, setRecordOpen] = useState(false);
  // referti già visti aprendo la cartella: il badge mostra solo i nuovi
  const [seen, setSeen] = useState(0);
  const ready = readyCount(results, clock);
  const unseen = Math.max(0, ready - seen);
  const openRecord = () => {
    setSeen(ready);
    setRecordOpen(true);
  };
  useEffect(() => {
    if (results.length === 0) setSeen(0);
  }, [results.length]);
  // tasto M: audio on/off anche durante il caso (non mentre si scrive in un campo)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'm' || e.key === 'M') && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        useGame.getState().toggleMute();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    document.querySelector('.s-main')?.scrollTo({ top: 0 });
  }, [stageIdx]);

  if (!c) return null;
  const stage = c.stages[stageIdx];

  return (
    <div className="sim">
      <header className="s-top">
        <button className="s-x" onClick={() => useGame.getState().toMenu()} aria-label="Esci" title="Torna al titolo">←</button>
        <div className="s-clock">
          <b>{fmtClock(c, clock)}</b>
          <span>T+{fmtElapsed(clock)}</span>
        </div>
        <div className="s-spent" title="Spesa in esami">{spent} €</div>
        <SoundToggle className="s-sound" />
        <button className="s-archive" onClick={openRecord} title="Cartella clinica" aria-label={`Cartella clinica${unseen ? `, ${unseen} referti nuovi` : ''}`}>
          🗂️<span className="s-archive-label">Cartella</span>
          {unseen > 0 && <em className="s-badge">{unseen}</em>}
        </button>
      </header>
      <div className="s-body">
        <aside className="s-side">
          <PatientBanner onOpenRecord={openRecord} />
        </aside>
        <main className="s-main">
          <StageView key={stage.id} stage={stage} />
        </main>
      </div>
      {recordOpen && <ClinicalRecord onClose={() => setRecordOpen(false)} />}
      <ClinicVisit />
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

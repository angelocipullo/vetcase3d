import { useProgress } from '@react-three/drei';
import { useEffect, useState } from 'react';
import { CASES } from '../game/cases';
import { evaluate } from '../game/evaluation';
import { DIAGNOSIS_LABEL, EXAM_LABEL, HEART_LABEL, LUNG_LABEL, OUTCOME_LABEL, TECH_ERROR_LABEL } from '../game/labels';
import { Outcome } from '../game/types';
import { useGame } from '../store';
import { audio } from '../audio/engine';
import { preloadScene } from '../three/preload';
import { SoundToggle } from './SoundToggle';
import { SIM_CASES } from '../sim/cases';
import { PixelSprite } from './sim/rpg';
import { ClinicScene } from './TitleScene';

const DIFFICULTY = ['', 'facile', 'medio', 'difficile'];

type TitlePhase = 'outside' | 'walking' | 'wipe' | 'inside';

/**
 * Schermata iniziale: fuori c'è il piccolo ospedale in pixel art con "Iniziamo il turno di lavoro";
 * il medico entra camminando, una transizione a bande chiude lo schermo e dentro compare l'elenco
 * dei pazienti (casi clinici) con la difficoltà. Precarica anche la scena 3D del prototipo.
 */
export function TitleScreen() {
  const startRandom = useGame((s) => s.startRandom);
  const startSim = useGame((s) => s.startSim);
  const { active, loaded, total, errors } = useProgress();
  const [ready, setReady] = useState(false);
  const [starting, setStarting] = useState(false);
  const [phase, setPhase] = useState<TitlePhase>('outside');

  useEffect(() => {
    preloadScene();
  }, []);

  // pronto quando il loading manager è fermo e tutto è caricato (con un attimo di margine: le texture
  // dentro i .glb partono solo dopo che il file è stato letto)
  useEffect(() => {
    if (ready) return;
    if (errors.length > 0 || (!active && total > 0 && loaded === total)) {
      const t = setTimeout(() => setReady(true), 350);
      return () => clearTimeout(t);
    }
  }, [active, loaded, total, errors.length, ready]);

  const pct = ready ? 100 : total ? Math.min(99, Math.round((loaded / total) * 100)) : 0;
  const start3d = () => {
    if (!ready || starting) return;
    audio.unlock();
    setStarting(true);
    // lascia disegnare il feedback prima di montare la scena 3D
    setTimeout(startRandom, 60);
  };

  const enter = () => {
    if (phase !== 'outside') return;
    audio.unlock();
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    setPhase(reduced ? 'inside' : 'walking');
  };
  const entered = () => {
    setPhase('wipe');
    setTimeout(() => setPhase('inside'), 650);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        if (phase === 'outside') enter();
        else if (phase === 'walking') entered();
      }
      if (e.key === 'm' || e.key === 'M') useGame.getState().toggleMute();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className={`screen title-screen phase-${phase}`}>
      <div className="title-glow" aria-hidden />
      <SoundToggle className="title-sound" />

      {phase !== 'inside' ? (
        <main className="title-main">
          <p className="eyebrow">Simulatore clinico veterinario</p>
          <h1 className="title-logo small">
            VetCase <span>3D</span>
          </h1>
          {/* durante la camminata un tocco salta l'animazione */}
          <div className="title-scene-wrap" onClick={phase === 'walking' ? entered : undefined}>
            <ClinicScene walking={phase !== 'outside'} onEntered={entered} />
          </div>
          <button className="pixel-btn" onClick={enter} disabled={phase !== 'outside'}>
            ▶ Iniziamo il turno di lavoro
          </button>
          <p className="title-hint">{phase === 'outside' ? 'Premi Invio o tocca il pulsante' : 'Tocca per saltare'}</p>
        </main>
      ) : (
        <main className="title-main lobby">
          <div className="lobby-box">
            <p className="lobby-eyebrow">Pronto Soccorso · sala d’attesa</p>
            <h2>Pazienti da visitare</h2>
            <p className="lobby-sub">Scegli chi visitare. Prenditi tutto il tempo: conta il ragionamento.</p>
            <ul className="lobby-list">
              {SIM_CASES.map((c) => (
                <li key={c.id}>
                  <button
                    className="lobby-pick"
                    onClick={() => {
                      audio.unlock();
                      startSim(c.id);
                    }}
                  >
                    <span className="lobby-face" aria-hidden>
                      <PixelSprite spec={c.cast.patient} size={56} />
                    </span>
                    <span className="lobby-info">
                      <b>
                        {c.patient.name} <small>{c.patient.species} {c.patient.breed.toLowerCase()}, {c.patient.age}</small>
                      </b>
                      <span className="lobby-title">{c.title}</span>
                      <span className={`lobby-meta d${c.difficulty}`}>
                        <span className="lobby-stars" aria-label={`difficoltà ${DIFFICULTY[c.difficulty]}`}>
                          {'★'.repeat(c.difficulty)}
                          <i>{'★'.repeat(3 - c.difficulty)}</i>
                        </span>
                        {DIFFICULTY[c.difficulty]} · {c.generated ? 'caso generato' : 'caso reale'}
                      </span>
                    </span>
                    <span className="lobby-go" aria-hidden>▶</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="lobby-foot">
              <button className="lobby-link" onClick={() => setPhase('outside')}>← Esci</button>
              <button
                className={`start-btn secondary ${ready ? 'ready-2' : ''}`}
                onClick={start3d}
                disabled={!ready}
                style={{ '--pct': `${pct}%` } as React.CSSProperties}
              >
                <span className="start-fill" aria-hidden />
                <span className="start-label">
                  {starting ? 'Entro in ambulatorio…' : ready ? 'Ambulatorio 3D (prototipo)' : `Preparo l’ambulatorio 3D… ${pct}%`}
                </span>
              </button>
            </div>
          </div>
        </main>
      )}

      {/* transizione a bande che chiudono e riaprono lo schermo */}
      {(phase === 'wipe' || phase === 'inside') && <div className={`title-wipe ${phase}`} aria-hidden />}

      <p className="credits">
        Cane 3D: “PitBull” di{' '}
        <a href="https://sketchfab.com/3d-models/2be37d5b9f754ed4bcc2d8f41b23a1d7" target="_blank" rel="noreferrer">
          Joseph AYYAD
        </a>{' '}
        (CC BY 4.0, modificato) · ambulatorio: asset CC0 di Poly Haven · Didattico, non sostituisce la formazione clinica
      </p>
    </div>
  );
}

export function ResultScreen() {
  const { caseId, exams, diagnosis, patient, startCase, startRandom, toMenu } = useGame();
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
      <header className="result-head">
        <p className="eyebrow">Esito della visita</p>
        <h1>
          Il caso di {patient.name}
        </h1>
      </header>
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
        <button className="ghost" onClick={() => startCase(caseId)}>Rivisita {patient.name}</button>
        <button className="primary" onClick={startRandom}>Nuovo paziente →</button>
      </div>
      <button className="link center" onClick={toMenu}>Torna al titolo</button>
    </div>
  );
}

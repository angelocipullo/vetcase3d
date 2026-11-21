import { useEffect, useState } from 'react';
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
 * dei pazienti (casi clinici) con la difficoltà. Precarica anche l'ambulatorio 3D.
 */
export function TitleScreen() {
  const startSim = useGame((s) => s.startSim);
  const [phase, setPhase] = useState<TitlePhase>('outside');

  // precarica in sottofondo modello del paziente e ambulatorio 3D (usati nella scheda di PS)
  useEffect(() => {
    preloadScene();
  }, []);

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
        (CC BY 4.0, modificato) · gatto 3D: “calico-cami” di{' '}
        <a href="https://sketchfab.com/3d-models/calico-cami-f26918cfa2964127a93177c2922972e7" target="_blank" rel="noreferrer">
          Cartoon cat oficial
        </a>{' '}
        (CC BY 4.0, modificato) · ambulatorio: asset CC0 di Poly Haven · Didattico, non sostituisce la formazione clinica
      </p>
    </div>
  );
}

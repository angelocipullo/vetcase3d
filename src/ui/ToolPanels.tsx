import { useEffect, useRef, useState } from 'react';
import { audio } from '../audio/engine';
import { HeartSound, LungSound, SyringePhase, TechniqueError, Tool } from '../game/types';
import { HEART_LABEL, LISTEN_REQUIRED_MS, LUNG_LABEL, useGame } from '../store';
import { num } from '../sim/format';

function useRaf(cb: (dt: number) => void, active: boolean) {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    if (!active) return;
    let last = performance.now();
    let id = 0;
    const loop = (now: number) => {
      ref.current(Math.min(0.05, (now - last) / 1000));
      last = now;
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [active]);
}

/** Auscultazione libera: cuore e polmoni del paziente, alla FC e FR del caso. */
export function StethoscopeHint() {
  const a = useGame((s) => s.auscult);
  const heart = Math.min(1, a.heartMs / LISTEN_REQUIRED_MS);
  const lungs = Math.min(1, a.lungsMs / LISTEN_REQUIRED_MS);
  return (
    <div className="panel compact">
      <p className="panel-title">🩺 Tieni premuto sul torace e trascina</p>
      <div className="meters">
        <Meter label={`❤️ Cuore${a.heart ? ` · ${HEART_LABEL[a.heart]}` : ''}`} value={heart} color="var(--red)" />
        <Meter label={`🫁 Polmoni${a.lungs ? ` · ${LUNG_LABEL[a.lungs]}` : ''}`} value={lungs} color="var(--blue)" />
      </div>
      <p className="hint">Usa le cuffie. Il cuore si sente meglio in basso, subito dietro il gomito; i polmoni più in alto e indietro.</p>
    </div>
  );
}

/** Dopo abbastanza ascolto: cosa hai sentito al cuore / ai polmoni? */
export function ListenPrompt() {
  const prompt = useGame((s) => s.listenPrompt);
  if (!prompt) return null;
  const { answerListen, closeListen } = useGame.getState();
  const options =
    prompt === 'heart'
      ? (Object.keys(HEART_LABEL) as HeartSound[]).map((k) => ({ k, label: HEART_LABEL[k] }))
      : (Object.keys(LUNG_LABEL) as LungSound[]).map((k) => ({ k, label: LUNG_LABEL[k] }));
  return (
    <div className="modal-backdrop listen-prompt">
      <div className="modal pop">
        <h3>{prompt === 'heart' ? '❤️ Cosa hai sentito al cuore?' : '🫁 Cosa hai sentito ai polmoni?'}</h3>
        <div className="choice-grid">
          {options.map((o) => (
            <button key={o.k} className="choice" onClick={() => answerListen(o.k)}>
              {o.label}
            </button>
          ))}
        </div>
        <button className="link listen-again" onClick={closeListen}>
          Voglio riascoltare
        </button>
      </div>
    </div>
  );
}

/** Secondi per inserire il termometro e per la lettura fino al bip. */
const INSERT_TIME = 0.6;
const READ_TIME = 3.5;

export function ThermometerPanel() {
  const thermo = useGame((s) => s.thermo);
  const target = useGame((s) => s.visit?.truth.temp ?? 38.5);
  const name = useGame((s) => s.visit?.patient.name ?? 'Il paziente');
  const g = useGame.getState;
  const [holding, setHolding] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const insertT = useRef(0);
  // errori di tecnica di questa misura: finiscono come nota nella scheda di PS
  const noLube = useRef(false);
  const interrupted = useRef(false);

  useRaf((dt) => {
    const s = g();
    if (!holding) return;
    // prima l'inserimento (il termometro scorre dentro), poi la lettura
    if (insertT.current < INSERT_TIME) {
      insertT.current += dt;
      return;
    }
    const p = Math.min(1, s.thermo.progress + dt / READ_TIME);
    s.patchThermo({ progress: p });
    if (p >= 1) {
      setHolding(false);
      audio.beep(3);
      s.addStress(5);
      setResult(target);
    }
  }, holding);

  if (!thermo.active) {
    return (
      <div className="panel compact">
        <p className="panel-title">🌡️ Tocca sotto la coda per posizionare il termometro</p>
        <p className="hint">La temperatura si misura per via rettale.</p>
      </div>
    );
  }

  const shown = 35.5 + (target - 35.5) * (1 - Math.pow(1 - thermo.progress, 3));
  const startHold = () => {
    audio.unlock();
    const s = g();
    if (!s.thermo.lubed) {
      noLube.current = true;
      s.addError(TechniqueError.NoLubricant);
      s.addStress(8);
      s.showToast(`Senza lubrificante è fastidioso: ${name} si irrigidisce`);
    }
    insertT.current = 0;
    s.patchThermo({ inserted: true });
    setHolding(true);
  };
  const release = () => {
    if (!holding) return;
    setHolding(false);
    if (g().thermo.progress < 1) {
      interrupted.current = true;
      g().patchThermo({ progress: 0, inserted: false });
      g().addError(TechniqueError.InterruptedReading);
      g().addStress(4);
      g().showToast('Hai tolto il termometro prima del bip: riprova');
    }
  };
  const extract = () => {
    const note = noLube.current ? 'Termometro inserito senza lubrificante' : interrupted.current ? 'Lettura interrotta prima del segnale acustico' : undefined;
    g().visit?.onRecord?.('temp', `${result!.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} °C`, !noLube.current && !interrupted.current, note);
    g().patchThermo({ active: false, inserted: false, progress: 0, lubed: false });
    g().setTool(Tool.Hand);
  };
  const phase = result !== null ? 'done' : !holding ? 'ready' : insertT.current < INSERT_TIME ? 'insert' : 'read';

  return (
    <div className="panel">
      <p className="panel-title">🌡️ Temperatura rettale</p>
      <div className="lcd">{thermo.progress > 0 ? num(shown, 1) : '--,-'} °C</div>
      {result === null ? (
        <>
          <div className="steps">
            <button className={`step ${thermo.lubed ? 'ok' : ''}`} onClick={() => g().patchThermo({ lubed: true })} disabled={holding}>
              {thermo.lubed ? '✓ Punta lubrificata' : '1 Lubrifica la punta'}
            </button>
          </div>
          <button
            className={`hold ${holding ? 'active' : ''}`}
            onPointerDown={startHold}
            onPointerUp={release}
            onPointerLeave={release}
            onPointerCancel={release}
          >
            {phase === 'insert' ? 'Inserisco delicatamente…' : phase === 'read' ? 'Tieni fermo fino al bip…' : '2 Tieni premuto: inserisci e misura'}
          </button>
        </>
      ) : (
        <button className="primary" onClick={extract}>
          Estrai e registra · {num(result, 1)} °C
        </button>
      )}
      <div className="meter-track thin">
        <div className="meter-fill" style={{ width: `${thermo.progress * 100}%`, background: 'var(--orange)' }} />
      </div>
    </div>
  );
}

/** Prelievo dalla vena cefalica: tricotomia → laccio → alcol → ago → aspirazione → laccio via PRIMA dell'ago → cerotto (solo pulsante, non disegnato). */
export function SyringePanel() {
  const s = useGame((st) => st.syringe);
  const g = useGame.getState;
  const [holding, setHolding] = useState(false);
  const [clipping, setClipping] = useState(false);

  // tricotomia: la macchinetta scende lungo la vena in ~1,8 s
  useRaf((dt) => {
    const c = Math.min(1, g().syringe.clip + dt / 1.8);
    g().patchSyringe({ clip: c });
    if (c >= 1) setClipping(false);
  }, clipping);

  useRaf((dt) => {
    const st = g().syringe;
    if (st.phase !== SyringePhase.Aspirate) return;
    let { fill, pressure } = st;
    if (holding) {
      fill = Math.min(1, fill + dt * 0.22);
      pressure += dt * 0.75;
    } else pressure = Math.max(0, pressure - dt * 0.9);
    if (pressure >= 1) {
      setHolding(false);
      g().addError(TechniqueError.VeinCollapsed);
      g().addStress(10);
      if (g().visit?.patient.species === 'gatto') audio.meow(true);
      else audio.whine();
      g().showToast('Vena collassata! Hai aspirato troppo forte. Ripungi');
      g().patchSyringe({ phase: SyringePhase.Insert, fill: 0, pressure: 0, insertPoint: undefined });
      return;
    }
    if (fill >= 1) {
      setHolding(false);
      g().patchSyringe({ phase: SyringePhase.Finish, fill: 1, pressure: 0 });
      g().showToast('Provetta piena. Ora chiudi la procedura nell’ordine giusto');
      return;
    }
    g().patchSyringe({ fill, pressure });
  }, s.phase === SyringePhase.Aspirate);

  if (s.phase === SyringePhase.Prepare) {
    return (
      <div className="panel">
        <p className="panel-title">💉 Prelievo dalla vena cefalica</p>
        <div className="steps">
          <button className={`step ${s.clip >= 1 ? 'ok' : ''}`} disabled={clipping || s.clip >= 1} onClick={() => setClipping(true)}>
            {s.clip >= 1 ? '✓ Tricotomia' : clipping ? 'Rasatura…' : '1 Tricotomia'}
          </button>
          <button className={`step ${s.tourniquet ? 'ok' : ''}`} onClick={() => g().patchSyringe({ tourniquet: true })}>
            {s.tourniquet ? '✓' : '2'} Applica laccio emostatico
          </button>
          <button className={`step ${s.disinfected ? 'ok' : ''}`} onClick={() => g().patchSyringe({ disinfected: true })}>
            {s.disinfected ? '✓' : '3'} Disinfetta con alcol
          </button>
        </div>
        <button className="primary" disabled={clipping} onClick={() => g().patchSyringe({ phase: SyringePhase.Insert })}>
          Prepara l’ago →
        </button>
      </div>
    );
  }

  if (s.phase === SyringePhase.Insert) {
    const ok = s.angle >= 15 && s.angle <= 30;
    return (
      <div className="panel">
        <p className="panel-title">Inclina l’ago, poi tocca la vena blu</p>
        <label className="slider">
          <span>
            Angolo ago: <b className={ok ? 'good' : 'warn'}>{s.angle}°</b>
          </span>
          <input type="range" min={5} max={60} value={s.angle} onChange={(e) => g().patchSyringe({ angle: Number(e.target.value) })} />
        </label>
        {!s.tourniquet && (
          <button className="ghost" onClick={() => g().patchSyringe({ tourniquet: true })}>
            Metti il laccio
          </button>
        )}
      </div>
    );
  }

  if (s.phase === SyringePhase.Aspirate) {
    return (
      <div className="panel">
        <p className="panel-title">Aspira lentamente</p>
        <div className="meters">
          <Meter label="🩸 Campione" value={s.fill} color="var(--red)" />
          <Meter label="⚠️ Pressione" value={s.pressure} color={s.pressure > 0.7 ? 'var(--red)' : 'var(--orange)'} />
        </div>
        <button
          className={`hold ${holding ? 'active' : ''}`}
          onPointerDown={() => setHolding(true)}
          onPointerUp={() => setHolding(false)}
          onPointerLeave={() => setHolding(false)}
          onPointerCancel={() => setHolding(false)}
        >
          {holding ? 'Aspirando…' : 'Tieni premuto per tirare lo stantuffo'}
        </button>
      </div>
    );
  }

  if (s.phase === SyringePhase.Finish) {
    const extract = () => {
      if (s.tourniquet) {
        g().addError(TechniqueError.Hematoma);
        g().showToast('Ematoma! Il laccio va tolto PRIMA di estrarre l’ago');
        g().addStress(6);
      }
      g().patchSyringe({ phase: SyringePhase.Bandage, tourniquet: false, insertPoint: undefined });
    };
    return (
      <div className="panel">
        <p className="panel-title">Concludi il prelievo</p>
        <div className="steps">
          {s.tourniquet ? (
            <button className="step" onClick={() => g().patchSyringe({ tourniquet: false })}>Rimuovi il laccio</button>
          ) : (
            <span className="step ok">✓ Laccio rimosso</span>
          )}
          <button className="step" onClick={extract}>Estrai l’ago e comprimi</button>
        </div>
      </div>
    );
  }

  if (s.phase === SyringePhase.Bandage) {
    return (
      <div className="panel">
        <p className="panel-title">🩹 Ago estratto: metti il cerotto e manda il campione</p>
        <button
          className="primary"
          onClick={() => {
            // cerotto sul punto di prelievo (solo come passaggio, non disegnato) e invio della provetta
            g().patchSyringe({ phase: SyringePhase.Done });
            g().completeBlood();
          }}
        >
          Metti il cerotto e invia la provetta
        </button>
      </div>
    );
  }
  return null;
}

function Meter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="meter">
      <span>{label}</span>
      <div className="meter-track">
        <div className="meter-fill" style={{ width: `${value * 100}%`, background: color }} />
      </div>
    </div>
  );
}

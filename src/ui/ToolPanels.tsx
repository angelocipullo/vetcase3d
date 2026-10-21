import { useEffect, useRef, useState } from 'react';
import { audio } from '../audio/engine';
import { CASES } from '../game/cases';
import { HEART_LABEL, LUNG_LABEL } from '../game/labels';
import { HeartSound, LungSound, SyringePhase, TechniqueError, Tool } from '../game/types';
import { useGame } from '../store';

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

/** Barra che mostra quanto si è ascoltato cuore/polmoni. */
export function StethoscopeHint() {
  const heart = useGame((s) => Math.min(1, s.exams.heart.listenedMs / 3000));
  const lungs = useGame((s) => Math.min(1, s.exams.lungs.listenedMs / 3000));
  return (
    <div className="panel compact">
      <p className="panel-title">🩺 Tieni premuto sul torace e trascina</p>
      <div className="meters">
        <Meter label="❤️ Cuore" value={heart} color="var(--red)" />
        <Meter label="🫁 Polmoni" value={lungs} color="var(--blue)" />
      </div>
      <p className="hint">Usa le cuffie. Il cuore si sente meglio in basso dietro il gomito.</p>
    </div>
  );
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

export function ListenPrompt() {
  const prompt = useGame((s) => s.prompt);
  const answer = useGame((s) => s.answerPrompt);
  const close = useGame((s) => s.closePrompt);
  if (!prompt) return null;
  const options =
    prompt === 'heart'
      ? (Object.keys(HEART_LABEL) as HeartSound[]).map((k) => ({ k, label: HEART_LABEL[k] }))
      : (Object.keys(LUNG_LABEL) as LungSound[]).map((k) => ({ k, label: LUNG_LABEL[k] }));
  return (
    <div className="modal-backdrop">
      <div className="modal pop">
        <h3>{prompt === 'heart' ? '❤️ Cosa hai sentito al cuore?' : '🫁 Cosa hai sentito ai polmoni?'}</h3>
        <div className="choice-grid">
          {options.map((o) => (
            <button key={o.k} className="choice" onClick={() => answer(o.k)}>
              {o.label}
            </button>
          ))}
        </div>
        <button className="link" onClick={close}>
          Voglio riascoltare
        </button>
      </div>
    </div>
  );
}

/** Secondi di pressione per far avanzare il termometro prima che inizi la misura. */
const INSERT_TIME = 0.6;
const READ_TIME = 3.5;

export function ThermometerPanel() {
  const thermo = useGame((s) => s.thermo);
  const caseId = useGame((s) => s.caseId);
  const done = useGame((s) => s.exams.temperature);
  const name = useGame((s) => s.patient.name);
  const g = useGame.getState;
  const target = CASES[caseId].vitals.temperature;
  const [holding, setHolding] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const insertT = useRef(0);

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
      s.setTemperature(target);
      s.addStress(5);
      setResult(target);
    }
  }, holding);

  if (!thermo.active) {
    return (
      <div className="panel compact">
        <p className="panel-title">🌡️ Tocca sotto la coda per posizionare il termometro</p>
        {done !== undefined && <p className="hint">Ultima misura: {done.toFixed(1)} °C</p>}
      </div>
    );
  }

  const shown = 35.5 + (target - 35.5) * (1 - Math.pow(1 - thermo.progress, 3));
  const startHold = () => {
    audio.unlock();
    const s = g();
    if (!s.thermo.lubed) {
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
      g().patchThermo({ progress: 0, inserted: false });
      g().addError(TechniqueError.InterruptedReading);
      g().addStress(4);
      g().showToast('Hai tolto il termometro prima del bip: riprova');
    }
  };
  const extract = () => {
    g().patchThermo({ active: false, inserted: false, progress: 0, lubed: false });
    g().setTool(Tool.Hand);
  };
  const phase = result !== null ? 'done' : !holding ? 'ready' : insertT.current < INSERT_TIME ? 'insert' : 'read';

  return (
    <div className="panel">
      <p className="panel-title">🌡️ Temperatura rettale</p>
      <div className="lcd">{thermo.progress > 0 ? shown.toFixed(1) : '--.-'} °C</div>
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
          Estrai · {result.toFixed(1)} °C
        </button>
      )}
      <div className="meter-track thin">
        <div className="meter-fill" style={{ width: `${thermo.progress * 100}%`, background: 'var(--orange)' }} />
      </div>
      {result === null && <p className="hint">Riferimento nel cane: 37,5–39,2 °C</p>}
    </div>
  );
}

export function SyringePanel() {
  const s = useGame((st) => st.syringe);
  const g = useGame.getState;
  const [holding, setHolding] = useState(false);

  useRaf((dt) => {
    const st = g().syringe;
    if (st.phase !== SyringePhase.Aspirate) return;
    let { fill, pressure } = st;
    if (holding) {
      fill = Math.min(1, fill + dt * 0.22);
      pressure += dt * 0.75;
    } else {
      pressure = Math.max(0, pressure - dt * 0.9);
    }
    if (pressure >= 1) {
      setHolding(false);
      g().addError(TechniqueError.VeinCollapsed);
      g().addStress(10);
      audio.whine();
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

  const cancel = () => g().setTool(Tool.Hand);

  if (s.phase === SyringePhase.Prepare) {
    return (
      <div className="panel">
        <p className="panel-title">💉 Prelievo dalla vena cefalica</p>
        <div className="steps">
          <button className={`step ${s.tourniquet ? 'ok' : ''}`} onClick={() => g().patchSyringe({ tourniquet: true })}>
            {s.tourniquet ? '✓' : '1'} Applica laccio emostatico
          </button>
          <button className={`step ${s.disinfected ? 'ok' : ''}`} onClick={() => g().patchSyringe({ disinfected: true })}>
            {s.disinfected ? '✓' : '2'} Disinfetta con alcol
          </button>
        </div>
        <div className="row">
          <button className="ghost" onClick={cancel}>Annulla</button>
          <button className="primary" onClick={() => g().patchSyringe({ phase: SyringePhase.Insert })}>
            Prepara l’ago →
          </button>
        </div>
      </div>
    );
  }

  if (s.phase === SyringePhase.Insert) {
    const angleOk = s.angle >= 15 && s.angle <= 30;
    return (
      <div className="panel">
        <p className="panel-title">Inclina l’ago, poi tocca la vena</p>
        <label className="slider">
          <span>
            Angolo ago: <b className={angleOk ? 'good' : 'warn'}>{s.angle}°</b>
          </span>
          <input
            type="range"
            min={5}
            max={60}
            value={s.angle}
            onChange={(e) => g().patchSyringe({ angle: Number(e.target.value) })}
          />
          <AngleGauge angle={s.angle} />
        </label>
        {!s.tourniquet && <p className="hint warn">Senza laccio la vena è poco visibile e sottile.</p>}
        <div className="row">
          <button className="ghost" onClick={cancel}>Annulla</button>
          {!s.tourniquet && (
            <button className="ghost" onClick={() => g().patchSyringe({ tourniquet: true })}>
              Metti il laccio
            </button>
          )}
        </div>
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
        <p className="hint">Rilascia quando la pressione sale, poi riprendi.</p>
      </div>
    );
  }

  if (s.phase === SyringePhase.Finish) {
    const finish = (needleFirst: boolean) => {
      if (needleFirst && s.tourniquet) {
        g().addError(TechniqueError.Hematoma);
        g().showToast('Ematoma! Il laccio va tolto PRIMA di estrarre l’ago');
        g().addStress(6);
      }
      g().patchSyringe({ phase: SyringePhase.Done, tourniquet: false, insertPoint: undefined });
      g().completeBlood();
      setTimeout(() => g().setTool(Tool.Hand), 600);
    };
    return (
      <div className="panel">
        <p className="panel-title">Concludi il prelievo</p>
        <div className="steps">
          {s.tourniquet ? (
            <button className="step" onClick={() => g().patchSyringe({ tourniquet: false })}>
              Rimuovi il laccio
            </button>
          ) : (
            <span className="step ok">✓ Laccio rimosso</span>
          )}
          <button className="step" onClick={() => finish(true)}>
            Estrai l’ago e comprimi
          </button>
        </div>
      </div>
    );
  }
  return null;
}

function AngleGauge({ angle }: { angle: number }) {
  const a = (angle * Math.PI) / 180;
  const x = 10 + Math.cos(a) * 70;
  const y = 50 - Math.sin(a) * 70;
  const zone = (deg: number) => [10 + Math.cos((deg * Math.PI) / 180) * 70, 50 - Math.sin((deg * Math.PI) / 180) * 70];
  const [x1, y1] = zone(15);
  const [x2, y2] = zone(30);
  return (
    <svg viewBox="0 0 90 55" className="gauge" aria-hidden>
      <path d={`M10 50 L${x1} ${y1} A70 70 0 0 0 ${x2} ${y2} Z`} fill="var(--green-soft)" />
      <line x1="0" y1="50" x2="90" y2="50" stroke="var(--ink-soft)" strokeWidth="3" strokeLinecap="round" />
      <line x1="10" y1="50" x2={x} y2={y} stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" />
      <circle cx={x} cy={y} r="3" fill="var(--blue)" />
    </svg>
  );
}

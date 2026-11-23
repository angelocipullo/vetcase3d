import { Canvas } from '@react-three/fiber';
import { Suspense, useEffect, useRef, useState } from 'react';
import { Tool } from '../game/types';
import { VITAL_LABEL } from '../sim/exams';
import { useSim } from '../sim/store';
import { VitalId } from '../sim/types';
import { useGame } from '../store';
import { CAMERA_VIEWS } from '../three/anatomy';
import { Scene } from '../three/Scene';
import { ClinicalRecord } from './sim/archive';
import { GameModal } from './sim/stagesA';
import { PixelSprite } from './sim/rpg';
import { DopplerGame, LocGame, MucousGame, PulseGame, RespGame, TrcGame } from './sim/vitalGames';
import { SoundToggle } from './SoundToggle';
import { VITAL_TOOL } from './clinicTools';
import { ListenPrompt, StethoscopeHint, SyringePanel, ThermometerPanel } from './ToolPanels';

/* =====================================================================
 * Visita nell'ambulatorio 3D, aperta da una fase del caso (scheda di PS
 * o prelievo). Il paziente sul tavolo è quello del caso; ogni parametro
 * si prende sul modello 3D e torna nella scheda del simulatore.
 * ===================================================================== */


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

/** Dove appoggiare lo strumento, finché non è nel punto giusto. */
function PlaceHint({ text }: { text: string }) {
  return (
    <div className="panel compact">
      <p className="panel-title">👆 {text}</p>
      <p className="hint">Con la guida attiva il punto giusto lampeggia sul paziente.</p>
    </div>
  );
}

function ToolPanel() {
  const visit = useGame((s) => s.visit)!;
  const tool = useGame((s) => s.tool);
  const placed = useGame((s) => s.placed);
  const t = visit.truth;
  const g = useGame.getState;

  const record = (v: VitalId) => (value: string, ok: boolean, note?: string) => {
    visit.onRecord?.(v, value, ok, note);
    g().showToast(`✓ ${VITAL_LABEL[v].label}: ${value}`);
    g().setTool(Tool.Hand);
  };
  const game = (node: React.ReactNode) => <div className="panel clinic-game">{node}</div>;

  switch (tool) {
    case Tool.Hand:
      return (
        <div className="panel compact">
          <p className="panel-title">✋ Accarezza {visit.patient.name} per calmarlo · trascina per girare attorno al tavolo</p>
          <p className="hint">{visit.mode === 'prelievo' ? 'Scegli 💉 Prelievo nella barra degli strumenti.' : 'Scegli un parametro nella barra degli strumenti.'}</p>
        </div>
      );
    case Tool.Stethoscope:
      return <StethoscopeHint />;
    case Tool.Thermometer:
      return <ThermometerPanel />;
    case Tool.Syringe:
      return <SyringePanel />;
    case Tool.Pulse:
      return placed ? game(<PulseGame truth={t} onDone={record('polso')} onBeat={() => g().beatPulse()} embedded />) : <PlaceHint text="Tocca l’interno della coscia posteriore: arteria femorale" />;
    case Tool.Resp:
      return game(<RespGame truth={t} onDone={record('resp')} embedded />);
  }
}

/** Parametri senza strumento 3D: finestra sopra l'ambulatorio con il minigioco della scheda di PS. */
function VitalWindow({ v, onClose }: { v: VitalId; onClose: () => void }) {
  const visit = useGame((s) => s.visit)!;
  const phys = useSim((s) => s.phys);
  const t = visit.truth;
  const done = (value: string, ok: boolean, note?: string) => {
    visit.onRecord?.(v, value, ok, note);
    useGame.getState().showToast(`✓ ${VITAL_LABEL[v].label}: ${value}`);
    onClose();
  };
  return (
    <GameModal title={`${VITAL_LABEL[v].icon} ${VITAL_LABEL[v].label}`} onClose={onClose} className="over-clinic">
      {v === 'mucose' && <MucousGame truth={t} onDone={done} />}
      {v === 'trc' && <TrcGame truth={t} onDone={done} />}
      {v === 'loc' && <LocGame truth={t} onDone={done} />}
      {v === 'pa' && <DopplerGame sbp={phys.sbp} hr={t.hr} onDone={(value, ok, note) => done(value, ok, note)} />}
    </GameModal>
  );
}

function ClinicHUD() {
  const visit = useGame((s) => s.visit)!;
  const tool = useGame((s) => s.tool);
  const stress = useGame((s) => Math.round(s.stress));
  const guided = useGame((s) => s.guided);
  const findings = useSim((s) => s.findings);
  const { setTool, setGuided, closeVisit } = useGame.getState();
  const [win, setWin] = useState<VitalId | null>(visit.startFocus && !VITAL_TOOL[visit.startFocus] ? visit.startFocus : null);
  const [record, setRecord] = useState(false);
  const diploma = useGame((s) => s.diploma);
  const auscultDone = useGame((s) => !!s.auscult.heart && !!s.auscult.lungs);

  const pickVital = (v: VitalId) => {
    const t = VITAL_TOOL[v];
    if (!t) return setWin(v);
    if (tool !== t) setTool(t);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && useGame.getState().diploma) return useGame.getState().setDiploma(null);
      if (e.key === 'Escape' && useGame.getState().listenPrompt) return useGame.getState().closeListen();
      if (e.key === 'Escape' && !record && !win) closeVisit();
      if ((e.key === 'g' || e.key === 'G') && !(e.target instanceof HTMLInputElement)) setGuided(!useGame.getState().guided);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [record, win, closeVisit, setGuided]);

  return (
    <div className="hud clinic-hud">
      <div className="topbar">
        <button className="icon" onClick={closeVisit} aria-label="Torna alla scheda" title="Torna alla scheda (Esc)">←</button>
        <span className="clinic-face" aria-hidden>
          <PixelSprite spec={visit.sprite} size={34} />
        </span>
        <div className="patient">
          <b>{visit.patient.name}</b>
          <span>
            {visit.mode === 'prelievo' ? 'Prelievo di sangue' : 'Scheda di Pronto Soccorso'} · {visit.patient.breed}
          </span>
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
        <button className="pill" onClick={() => setRecord(true)} title="Cartella clinica">
          🗂️ <span className="pill-label">Cartella</span>
        </button>
        {/* guida: pulsante tondo con il punto interrogativo; acceso = i punti giusti lampeggiano sul paziente */}
        <button
          className={`pill help-btn ${guided ? 'on' : ''}`}
          onClick={() => setGuided(!guided)}
          title={guided ? 'Guida attiva (G): tocca per spegnerla' : 'Guida (G): mostra dove toccare'}
          aria-label={guided ? 'Guida attiva' : 'Guida'}
          aria-pressed={guided}
        >
          ?
        </button>
      </div>

      <Toast />

      <div className="bottom">
        <ToolPanel />
      </div>

      <nav className="toolbar">
        <button className={`tool ${tool === Tool.Hand ? 'sel' : ''}`} onClick={() => setTool(Tool.Hand)}>
          <span className="ti">✋</span>
          <span className="tl">Coccole</span>
        </button>
        {visit.mode === 'prelievo' && (
          <button className={`tool ${tool === Tool.Syringe ? 'sel' : ''}`} onClick={() => setTool(Tool.Syringe)}>
            <span className="ti">💉</span>
            <span className="tl">Prelievo</span>
          </button>
        )}
        {visit.vitals.map((v) => {
          const sel = win === v || (!!VITAL_TOOL[v] && tool === VITAL_TOOL[v]);
          return (
            <button key={v} className={`tool ${sel ? 'sel' : ''} ${findings[v] ? 'done' : ''}`} onClick={() => pickVital(v)} title={VITAL_LABEL[v].label}>
              <span className="ti">{VITAL_LABEL[v].icon}</span>
              <span className="tl">{VITAL_LABEL[v].label.replace(' (Doppler)', '').replace('Tempo di riempimento capillare', 'TRC').replace('Stato mentale (LOC)', 'Stato mentale')}</span>
              {findings[v] && <em className="tool-ok">✓</em>}
            </button>
          );
        })}
        {visit.mode === 'vitals' && (
          <button className={`tool ${tool === Tool.Stethoscope ? 'sel' : ''} ${auscultDone ? 'done' : ''}`} onClick={() => setTool(Tool.Stethoscope)}>
            <span className="ti">🩺</span>
            <span className="tl">Auscultazione</span>
            {auscultDone && <em className="tool-ok">✓</em>}
          </button>
        )}
      </nav>

      <ListenPrompt />
      {win && <VitalWindow v={win} onClose={() => setWin(null)} />}
      {record && <ClinicalRecord onClose={() => setRecord(false)} />}
      {diploma && (
        <div className="diploma-view" role="dialog" aria-label="Pergamena di laurea" onClick={() => useGame.getState().setDiploma(null)}>
          <img src={diploma} alt="Pergamena di laurea in Medicina Veterinaria" onClick={(e) => e.stopPropagation()} />
          <button className="diploma-close" aria-label="Chiudi" onClick={() => useGame.getState().setDiploma(null)}>✕</button>
        </div>
      )}
    </div>
  );
}

/** Ambulatorio 3D a schermo intero sopra il simulatore, finché la visita è aperta. */
export function ClinicVisit() {
  const visit = useGame((s) => s.visit);
  const sceneReady = useGame((s) => s.sceneReady);
  const box = useRef<HTMLDivElement>(null);
  // il canvas 3D si ridimensiona sull'evento "resize" della finestra: se cambia solo il contenitore
  // (pannello ridimensionato, barra degli indirizzi del telefono, zoom) lo si avvisa, così niente fasce vuote
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [visit]);
  if (!visit) return null;
  const cam = CAMERA_VIEWS.default.pos;
  return (
    <div className="clinic-visit" ref={box}>
      <Canvas
        shadows
        dpr={[1, 1.5]}
        performance={{ min: 0.6 }}
        // il 3D lavora già sotto la schermata di caricamento (preriscaldamento: vedi ShaderWarmup)
        frameloop="always"
        camera={{ position: [cam.x, cam.y, cam.z], fov: 40, near: 0.05, far: 50 }}
        className="canvas"
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
      <ClinicHUD />
      {!sceneReady && <div className="clinic-loading">Preparo l’ambulatorio…</div>}
    </div>
  );
}

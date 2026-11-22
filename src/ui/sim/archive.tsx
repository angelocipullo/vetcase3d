import { useEffect, useState } from 'react';
import { DRUGS, EXAMS, FLUID_LABEL, VITAL_LABEL } from '../../sim/exams';
import { clinicalSigns, kInfusionRate } from '../../sim/physiology';
import { fmtClock, useSim } from '../../sim/store';
import { DrugId, InterviewQuestion, ResultDoc, SimCase, VitalId } from '../../sim/types';
import { ResultView, SourceBadge } from './common';
import { PixelSprite } from './rpg';
import { num } from '../../sim/format';

/* =====================================================================
 * Banner laterale (paziente + parametri) e archivio "Cartella clinica".
 * Il banner resta sempre visibile ma piccolo; tutta la documentazione
 * (anamnesi, EOG, referti, terapie, diario) sta nell'archivio.
 * ===================================================================== */

const capitalize = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const kg = (n: number) => `${n.toLocaleString('it-IT')} kg`;

const VITAL_ORDER: VitalId[] = ['temp', 'polso', 'resp', 'mucose', 'trc', 'loc', 'pa'];

function activeDrugs(therapy: ReturnType<typeof useSim.getState>['therapy']) {
  return (Object.keys(therapy.drugs) as DrugId[]).filter((d) => therapy.drugs[d] !== undefined);
}

/** Referti visibili ora: quelli pronti, quelli in corso e quello eventualmente "in lettura" nella fase emogas. */
function useVisibleResults() {
  const results = useSim((s) => s.results);
  const clock = useSim((s) => s.clock);
  const stageKind = useSim((s) => s.caseDef!.stages[s.stageIdx].kind);
  const hidden = stageKind === 'abg' ? [...results].reverse().find((r) => r.exam === 'emogas')?.id : undefined;
  return { results, clock, hidden };
}

export function readyCount(results: ResultDoc[], clock: number) {
  return results.filter((r) => r.refused || r.readyAt <= clock).length;
}

/* ------------------------------------------------------------------ banner */

export function PatientBanner({ onOpenRecord }: { onOpenRecord: () => void }) {
  const c = useSim((s) => s.caseDef)!;
  const phys = useSim((s) => s.phys);
  const findings = useSim((s) => s.findings);
  const therapy = useSim((s) => s.therapy);
  const stageIdx = useSim((s) => s.stageIdx);
  // su schermi larghi il banner parte aperto (c'è spazio), su telefono resta una striscia compatta
  const [open, setOpen] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 900px)').matches);
  const signs = clinicalSigns(phys, c.observation?.(useSim.getState().ctx())).signs;
  const inIcu = c.stages.slice(0, stageIdx + 1).some((s) => s.kind === 'monitor');
  const drugs = activeDrugs(therapy);
  const f = therapy.fluids;
  const measured = VITAL_ORDER.filter((v) => findings[v]);

  return (
    <div className={`s-banner ${open ? 'open' : ''}`}>
      <button className="s-banner-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="s-pt-avatar" aria-hidden>
          <PixelSprite spec={c.cast.patient} size={40} />
        </span>
        <span className="s-banner-id">
          <b>{c.patient.name}</b>
          <small>
            {c.patient.breed} · {c.patient.sex.toLowerCase()} · {c.patient.age} · {kg(c.patient.kg)}
          </small>
        </span>
        <span className="s-banner-toggle" aria-hidden>{open ? '▴' : '▾'}</span>
      </button>

      {/* striscia compatta dei parametri (su telefono è l'unica cosa visibile da chiusa) */}
      <div className="s-chips">
        {measured.length === 0 ? (
          <span className="s-chip empty">Parametri non ancora rilevati</span>
        ) : (
          measured.map((v) => (
            <span key={v} className="s-chip" title={VITAL_LABEL[v].label}>
              {VITAL_LABEL[v].icon} {findings[v]!.value}
            </span>
          ))
        )}
      </div>

      <div className="s-banner-more">
        <h4>Motivo della visita</h4>
        <p className="s-complaint">{capitalize(c.complaint)}</p>

        <h4>Osservazione</h4>
        <ul className="s-signs">
          {signs.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>

        {inIcu && (
          <div className="s-monitor mini">
            <div className="s-mon-tile hr"><small>FC</small><b>{Math.round(phys.hr)}</b></div>
            <div className="s-mon-tile rr"><small>FR</small><b>{Math.round(phys.rr)}</b></div>
            <div className="s-mon-tile bp"><small>PAS</small><b>{Math.round(phys.sbp)}</b></div>
          </div>
        )}

        {(drugs.length > 0 || (f.fluid !== 'none' && f.rateMlH > 0)) && (
          <>
            <h4>Terapia in corso</h4>
            <ul className="s-ther">
              {f.fluid !== 'none' && f.rateMlH > 0 && <li>💧 {FLUID_LABEL[f.fluid]} {f.rateMlH} ml/h</li>}
              {drugs.map((d) => (
                <li key={d}>💊 {DRUGS[d].label}</li>
              ))}
            </ul>
          </>
        )}

        <button className="s-btn s-banner-record" onClick={onOpenRecord}>🗂️ Apri la cartella clinica</button>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- cartella clinica */

type Section = 'frontespizio' | 'anamnesi' | 'eog' | 'esami' | 'terapia' | 'diario';

const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: 'frontespizio', label: 'Frontespizio', icon: '📄' },
  { id: 'anamnesi', label: 'Anamnesi', icon: '🗣️' },
  { id: 'eog', label: 'Esame obiettivo', icon: '🩺' },
  { id: 'esami', label: 'Esami e referti', icon: '🧪' },
  { id: 'terapia', label: 'Terapia', icon: '💊' },
  { id: 'diario', label: 'Diario clinico', icon: '📝' },
];

function recordNumber(c: SimCase) {
  const year = c.arrival.slice(0, 4);
  let h = 0;
  for (const ch of c.id) h = (h * 31 + ch.charCodeAt(0)) % 100000;
  return `CC-${year}-${String(h).padStart(5, '0')}`;
}

function interviewQuestions(c: SimCase): InterviewQuestion[] {
  return c.stages.flatMap((s) => (s.kind === 'interview' ? s.questions : []));
}

function Frontespizio({ c }: { c: SimCase }) {
  const arrival = new Date(c.arrival);
  return (
    <section className="cc-sec">
      <h3>Dati del paziente</h3>
      <dl className="cc-grid">
        <div><dt>Nome</dt><dd>{c.patient.name}</dd></div>
        <div><dt>Specie</dt><dd>{c.patient.species}</dd></div>
        <div><dt>Razza</dt><dd>{c.patient.breed}</dd></div>
        <div><dt>Sesso</dt><dd>{c.patient.sex}</dd></div>
        <div><dt>Età</dt><dd>{c.patient.age}</dd></div>
        <div><dt>Peso all’ingresso</dt><dd>{kg(c.patient.kg)}</dd></div>
        {c.patient.coat && <div><dt>Mantello</dt><dd>{c.patient.coat}</dd></div>}
        <div>
          <dt>Accettazione</dt>
          <dd>{arrival.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}, ore {arrival.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</dd>
        </div>
      </dl>
      <h3>Motivo della visita</h3>
      <p className="cc-text">{capitalize(c.complaint)}</p>
      <p className="cc-note">Dati del proprietario omessi (caso didattico anonimizzato).</p>
    </section>
  );
}

function Anamnesi({ c }: { c: SimCase }) {
  const asked = useSim((s) => s.asked);
  const qs = interviewQuestions(c);
  const done = asked.map((id) => qs.find((q) => q.id === id)).filter((q): q is InterviewQuestion => !!q);
  return (
    <section className="cc-sec">
      <h3>Motivo della visita</h3>
      <p className="cc-text">{capitalize(c.complaint)}</p>
      <h3>Anamnesi raccolta</h3>
      {done.length === 0 ? (
        <p className="cc-empty">Anamnesi non ancora raccolta.</p>
      ) : (
        <table className="cc-table">
          <thead>
            <tr><th>Voce</th><th>Domanda</th><th>Risposta del proprietario</th></tr>
          </thead>
          <tbody>
            {done.map((q) => (
              <tr key={q.id}>
                <td className="cc-topic">{q.topic === '—' ? 'Altro' : q.topic}</td>
                <td>{q.q}</td>
                <td>
                  {q.a} {q.source === 'generato' && <SourceBadge source="generato" />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function Eog({ c }: { c: SimCase }) {
  const findings = useSim((s) => s.findings);
  const phys = useSim((s) => s.phys);
  const signs = clinicalSigns(phys, c.observation?.(useSim.getState().ctx())).signs;
  const vitalsStage = c.stages.find((s) => s.kind === 'vitals');
  const rows = VITAL_ORDER.filter((v) => findings[v] || (vitalsStage?.kind === 'vitals' && vitalsStage.required.includes(v)));
  return (
    <section className="cc-sec">
      <h3>Scheda di Pronto Soccorso</h3>
      <table className="cc-table">
        <thead>
          <tr><th>Parametro</th><th>Valore rilevato</th><th>Ora</th></tr>
        </thead>
        <tbody>
          {rows.map((v) => {
            const f = findings[v];
            return (
              <tr key={v}>
                <td className="cc-topic">{VITAL_LABEL[v].icon} {VITAL_LABEL[v].label}</td>
                <td>{f ? <>{f.value}{f.note && <small className="cc-sub"> — {f.note}</small>}</> : <span className="cc-empty">non rilevato</span>}</td>
                <td className="cc-time">{f ? fmtClock(c, f.t) : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <h3>Osservazione clinica</h3>
      <ul className="cc-list">
        {signs.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
    </section>
  );
}

function Esami({ c }: { c: SimCase }) {
  const { results, clock, hidden } = useVisibleResults();
  const [filter, setFilter] = useState<'tutti' | 'lab' | 'strumentale'>('tutti');
  const list = [...results]
    .filter((r) => filter === 'tutti' || EXAMS[r.exam].kind === filter)
    .sort((a, b) => a.orderedAt - b.orderedAt);
  return (
    <section className="cc-sec">
      <div className="cc-filter">
        {(['tutti', 'lab', 'strumentale'] as const).map((k) => (
          <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>
            {k === 'tutti' ? 'Tutti' : k === 'lab' ? 'Laboratorio' : 'Diagnostica strumentale'}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="cc-empty">Nessun esame richiesto.</p>
      ) : (
        list.map((r) =>
          r.id === hidden ? (
            <div key={r.id} className="s-result pending">
              <b>{EXAMS[r.exam].label}</b>
              <span className="s-muted">stampa in lettura: interpretala nella fase corrente</span>
            </div>
          ) : r.refused || r.readyAt <= clock ? (
            <ResultView key={r.id} doc={r} />
          ) : (
            <div key={r.id} className="s-result pending">
              <b>{EXAMS[r.exam].label}</b>
              <span className="s-muted">richiesto alle {fmtClock(c, r.orderedAt)} · referto atteso alle {fmtClock(c, r.readyAt)}</span>
            </div>
          ),
        )
      )}
    </section>
  );
}

function Terapia({ c }: { c: SimCase }) {
  const therapy = useSim((s) => s.therapy);
  const log = useSim((s) => s.log);
  const drugs = activeDrugs(therapy);
  const f = therapy.fluids;
  const entries = log.filter((l) => l.kind === 'terapia' || l.kind === 'decisione');
  return (
    <section className="cc-sec">
      <h3>Terapia in corso</h3>
      {f.fluid === 'none' && drugs.length === 0 ? (
        <p className="cc-empty">Nessuna terapia in corso.</p>
      ) : (
        <table className="cc-table">
          <thead>
            <tr><th>Farmaco / fluido</th><th>Posologia</th><th>Dal</th></tr>
          </thead>
          <tbody>
            {f.fluid !== 'none' && f.rateMlH > 0 && (
              <tr>
                <td className="cc-topic">💧 {FLUID_LABEL[f.fluid]}</td>
                <td>{f.rateMlH} ml/h{f.kclMeqL > 0 && ` + KCl ${f.kclMeqL} mEq/L (${num(kInfusionRate(therapy, c.disease.kg), 2)} mEq/kg/h)`}</td>
                <td className="cc-time">—</td>
              </tr>
            )}
            {drugs.map((d) => (
              <tr key={d}>
                <td className="cc-topic">💊 {DRUGS[d].label} <small className="cc-sub">{DRUGS[d].note}</small></td>
                <td>{DRUGS[d].dose}</td>
                <td className="cc-time">{fmtClock(c, therapy.drugs[d]!)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <h3>Prescrizioni e decisioni cliniche</h3>
      {entries.length === 0 ? (
        <p className="cc-empty">Nessuna decisione registrata.</p>
      ) : (
        <ul className="cc-diary">
          {entries.map((l, i) => (
            <li key={i} className={l.kind}>
              <span>{fmtClock(c, l.t)}</span> {l.text}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Diario({ c }: { c: SimCase }) {
  const log = useSim((s) => s.log);
  return (
    <section className="cc-sec">
      <h3>Diario clinico</h3>
      <ul className="cc-diary">
        {log.map((l, i) => (
          <li key={i} className={l.kind}>
            <span>{fmtClock(c, l.t)}</span> {l.text}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ClinicalRecord({ onClose }: { onClose: () => void }) {
  const c = useSim((s) => s.caseDef)!;
  const clock = useSim((s) => s.clock);
  const results = useSim((s) => s.results);
  const [sec, setSec] = useState<Section>('frontespizio');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="cc-backdrop" role="dialog" aria-modal="true" aria-label="Cartella clinica" onClick={onClose}>
      <div className="cc-folder" onClick={(e) => e.stopPropagation()}>
        <header className="cc-head">
          <div className="cc-head-id">
            <small>Ospedale veterinario didattico · Pronto Soccorso</small>
            <b>Cartella clinica n° {recordNumber(c)}</b>
            <span>
              {c.patient.name} · {c.patient.species} {c.patient.breed} · {c.patient.sex.toLowerCase()} · {c.patient.age}
            </span>
          </div>
          <button className="s-x cc-close" onClick={onClose} aria-label="Chiudi la cartella">✕</button>
        </header>
        <nav className="cc-nav" aria-label="Sezioni della cartella">
          {SECTIONS.map((s) => (
            <button key={s.id} className={sec === s.id ? 'on' : ''} onClick={() => setSec(s.id)}>
              <span aria-hidden>{s.icon}</span> {s.label}
              {s.id === 'esami' && results.length > 0 && <em>{readyCount(results, clock)}/{results.length}</em>}
            </button>
          ))}
        </nav>
        <div className="cc-page">
          {sec === 'frontespizio' && <Frontespizio c={c} />}
          {sec === 'anamnesi' && <Anamnesi c={c} />}
          {sec === 'eog' && <Eog c={c} />}
          {sec === 'esami' && <Esami c={c} />}
          {sec === 'terapia' && <Terapia c={c} />}
          {sec === 'diario' && <Diario c={c} />}
          <footer className="cc-foot">Aggiornata al {fmtClock(c, clock)} · documento didattico, non valido a fini clinici</footer>
        </div>
      </div>
    </div>
  );
}

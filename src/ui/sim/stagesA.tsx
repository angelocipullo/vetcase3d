import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { EXAMS, VITAL_LABEL } from '../../sim/exams';
import { dyn, useSim, useSimCtx } from '../../sim/store';
import {
  AbgStage,
  DialogueLine,
  ExamId,
  InterviewQuestion,
  InterviewStage,
  NarrativeStage,
  OrdersStage,
  QuizOption,
  QuizStage,
  ResultDoc,
  VitalId,
  VitalsStage,
} from '../../sim/types';
import { MENTOR, speaker } from '../../sim/cast';
import { Continue, ResultView, stableShuffle, StageHeader, useCountdown } from './common';
import { Actor, DialogueBox, RpgMenu, RpgScene, SpeechBubble } from './rpg';
import { EcoFastGame, FundusGame } from './imagingGames';
import { DopplerGame, LocGame, MucousGame, PulseGame, RespGame, ThermoGame, TrcGame } from './vitalGames';

/* ================================================================ narrativa */
function linesFor(stage: NarrativeStage, ctx: ReturnType<typeof useSimCtx>): DialogueLine[] {
  if (stage.dialogue) return stage.dialogue;
  const lines: DialogueLine[] = dyn(stage.body, ctx)
    .split('\n\n')
    .map((p) => {
      const m = p.match(/^«([\s\S]*)»$/);
      return m ? { who: 'owner' as const, text: m[1].trim() } : { who: 'narratore' as const, text: p };
    });
  const bullets = stage.bullets ? dyn(stage.bullets, ctx) : [];
  if (bullets.length) lines.push({ who: 'mentor', text: bullets.join(' ') });
  return lines;
}

export function NarrativeView({ stage }: { stage: NarrativeStage }) {
  const ctx = useSimCtx();
  const c = useSim((s) => s.caseDef)!;
  const next = useSim((s) => s.next);
  const [lines] = useState(() => linesFor(stage, ctx));
  const [i, setI] = useState(0);
  const [typing, setTyping] = useState(true);
  const line = lines[i];
  const last = i === lines.length - 1;
  const actors: Actor[] = [
    { id: 'mentor', speaker: MENTOR, side: 'left' },
    { id: 'owner', speaker: c.cast.owner, side: 'right' },
    { id: 'patient', speaker: speaker(c, 'patient'), side: 'right', small: true },
  ].filter((a) => a.id !== 'mentor' || lines.some((l) => l.who === 'mentor')) as Actor[];
  return (
    <div className="s-stage rpg">
      <StageHeader eyebrow={stage.phase} title={stage.title} />
      <RpgScene actors={actors} active={line.who} talking={typing && line.who !== 'narratore'} />
      <DialogueBox key={i} speaker={speaker(c, line.who)} text={line.text} onTyping={setTyping} onNext={last ? undefined : () => setI(i + 1)}>
        {last && (
          <RpgMenu>
            <button onClick={next}>{stage.cta}</button>
          </RpgMenu>
        )}
      </DialogueBox>
      <p className="rpg-hint">Tocca la finestra o premi Invio per proseguire</p>
    </div>
  );
}

/* ================================================================ quiz a tempo */
const LETTERS = 'ABCDEFGH';

export function QuizView({ stage }: { stage: QuizStage }) {
  const ctx = useSimCtx();
  const c = useSim((s) => s.caseDef)!;
  const next = useSim((x) => x.next);
  // le opzioni vengono fissate all'ingresso nella fase (non cambiano se lo stato evolve)
  const [options] = useState<QuizOption[]>(() => {
    const o = dyn(stage.options, useSim.getState().ctx());
    return stage.ordered ? o : stableShuffle(o, stage.id);
  });
  const [prompt] = useState(() => {
    const cx = stage.context ? dyn(stage.context, useSim.getState().ctx()) : '';
    return { context: cx, question: dyn(stage.question, useSim.getState().ctx()) };
  });
  const [picked, setPicked] = useState<string[]>([]);
  const [result, setResult] = useState<{ pts: number; frac: number } | null>(null);
  const [typing, setTyping] = useState(true);

  const submit = (ids: string[], timedOut = false) => {
    if (result || !useSim.getState().markDone(stage.id)) return;
    const st = useSim.getState();
    const frac0 = Math.max(0, left / (stage.timer ?? 1));
    let frac: number;
    if (stage.multi) {
      const correct = options.filter((o) => o.score === 1);
      const hits = ids.filter((id) => correct.some((o) => o.id === id)).length;
      const wrong = ids.length - hits;
      frac = Math.max(0, (hits - wrong) / correct.length);
    } else {
      frac = ids.length ? options.find((o) => o.id === ids[0])!.score : 0;
    }
    const speed = stage.timer ? (stage.multi ? 0.85 + 0.15 * frac0 : 0.7 + 0.3 * frac0) : 1;
    const pts = Math.round(stage.points * frac * speed);
    st.addScore('ragionamento', pts, stage.points, stage.title);
    const chosen = options.filter((o) => ids.includes(o.id));
    st.addLog('decisione', `${stage.title}: ${timedOut && !chosen.length ? 'tempo scaduto' : chosen.map((o) => o.text).join('; ')}`);
    st.advance(2);
    for (const o of chosen) st.applyEffects(o.effects);
    st.applyEffects(stage.after);
    setPicked(ids);
    setResult({ pts, frac });
  };

  // il tempo parte quando il primario ha finito di porre la domanda
  const left = useCountdown(stage.timer, !result && !typing, () => submit(stage.multi ? picked : [], true));
  const toggle = (id: string) => {
    if (result) return;
    if (stage.multi) setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
    else submit([id]);
  };

  const verdict = result
    ? `${result.frac >= 1 ? 'Ottimo!' : result.frac > 0 ? 'In parte.' : picked.length ? 'No.' : 'Tempo scaduto!'} ${stage.explanation}`
    : '';
  const tone = result ? (result.frac >= 1 ? 'good' : result.frac > 0 ? 'mid' : 'bad') : undefined;

  return (
    <div className="s-stage rpg">
      <StageHeader eyebrow={stage.phase} title={stage.title} />
      <RpgScene
        actors={[
          { id: 'mentor', speaker: MENTOR, side: 'left' },
          { id: 'patient', speaker: speaker(c, 'patient'), side: 'right', small: true },
        ]}
        active="mentor"
        talking={typing}
      />
      {!result ? (
        <DialogueBox speaker={MENTOR} text={`${prompt.context ? prompt.context + '\n' : ''}${prompt.question}`} onTyping={setTyping} />
      ) : (
        <DialogueBox key="verdict" speaker={MENTOR} text={verdict} tone={tone} onTyping={setTyping}>
          <span className="rpg-score">+{result.pts} punti</span>
        </DialogueBox>
      )}
      {stage.timer && !result && !typing && (
        <div className="s-timer">
          <div className="s-timer-fill" style={{ width: `${(left / stage.timer) * 100}%` }} />
          <span>{Math.ceil(left)} s</span>
        </div>
      )}
      {(!typing || result) && (
        <RpgMenu cols={stage.multi ? 1 : 2} className="quiz">
          {options.map((o, i) => {
            const sel = picked.includes(o.id);
            const cls = result ? (o.score === 1 ? 'right' : sel ? 'wrong' : o.score > 0 ? 'partial' : 'dim') : sel ? 'sel' : '';
            return (
              <button key={o.id} className={cls} onClick={() => toggle(o.id)} disabled={!!result}>
                <span className="rpg-letter">{stage.multi ? (sel ? '☑' : '☐') : LETTERS[i]}</span>
                <span className="rpg-opt">
                  {o.text}
                  {result && (sel || o.score === 1) && <small>{o.feedback}</small>}
                </span>
              </button>
            );
          })}
        </RpgMenu>
      )}
      {stage.multi && !result && !typing && (
        <button className="s-btn primary" disabled={!picked.length} onClick={() => submit(picked)}>
          Conferma selezione
        </button>
      )}
      {result && <Continue onClick={next} />}
    </div>
  );
}

/* ================================================================ anamnesi */
export function InterviewView({ stage }: { stage: InterviewStage }) {
  const c = useSim((s) => s.caseDef)!;
  const asked = useSim((s) => s.asked);
  const next = useSim((s) => s.next);
  const [closed, setClosed] = useState(false);
  const [typing, setTyping] = useState(true);
  const [log, setLog] = useState(false);
  // in ordine di domanda (asked è cronologico), non nell'ordine del caso
  const mine = asked.map((id) => stage.questions.find((q) => q.id === id)).filter((q): q is InterviewQuestion => !!q);
  const left = stage.budget - mine.length;
  const remaining = stage.questions.filter((q) => !asked.includes(q.id));
  const lastQ = mine[mine.length - 1];
  const owner = c.cast.owner;

  const finish = () => {
    const st = useSim.getState();
    if (!st.markDone(stage.id)) return;
    const key = stage.questions.filter((q) => q.weight === 'key');
    const useful = stage.questions.filter((q) => q.weight === 'useful');
    const k = mine.filter((q) => q.weight === 'key').length;
    const u = mine.filter((q) => q.weight === 'useful').length;
    const irr = mine.filter((q) => q.weight === 'irrelevant').length;
    const frac = Math.max(0, (k / key.length) * 0.8 + (u / useful.length) * 0.2 - irr * 0.05);
    st.addScore('anamnesi', Math.round(stage.points * Math.min(1, frac)), stage.points, `Domande chiave ${k}/${key.length}`);
    st.addLog('azione', `Anamnesi raccolta (${mine.length} domande)`);
    setClosed(true);
  };

  const text = closed
    ? 'Grazie dottore. Ditemi voi cosa fare adesso…'
    : lastQ
      ? lastQ.a
      : 'Mi dica dottore, cosa vuole sapere?';

  return (
    <div className="s-stage rpg">
      <StageHeader eyebrow={stage.phase} title={stage.title} />
      <SpeechBubble speaker={MENTOR} text={stage.intro} />
      <RpgScene
        actors={[
          { id: 'owner', speaker: owner, side: 'right' },
          { id: 'patient', speaker: speaker(c, 'patient'), side: 'right', small: true },
        ]}
        active="owner"
        talking={typing}
      />
      {lastQ && !closed && <p className="rpg-you">Tu: «{lastQ.q}»</p>}
      <DialogueBox key={closed ? 'end' : lastQ?.id ?? 'start'} speaker={owner} text={text} onTyping={setTyping}>
        {!closed && <span className="rpg-score">Domande rimaste: {left}</span>}
      </DialogueBox>

      {!closed ? (
        <RpgMenu className="ask">
          {remaining.map((q) => (
            <button key={q.id} disabled={left <= 0} onClick={() => useSim.getState().ask(q.id, 1)}>
              <span className="rpg-opt">{q.q}</span>
            </button>
          ))}
          <button className="end" disabled={mine.length === 0} onClick={finish}>
            <span className="rpg-opt">Ho finito con le domande</span>
          </button>
        </RpgMenu>
      ) : (
        <>
          <div className="s-review">
            <h4>Cosa contava</h4>
            <ul>
              {stage.questions
                .filter((q) => q.weight !== 'irrelevant')
                .map((q) => (
                  <li key={q.id} className={asked.includes(q.id) ? 'good' : q.weight === 'key' ? 'bad' : 'muted'}>
                    {asked.includes(q.id) ? '✓' : '✗'} {q.topic} {q.weight === 'key' ? '' : <small>(utile)</small>}
                  </li>
                ))}
            </ul>
            {mine.some((q) => q.weight === 'irrelevant') && <p className="s-muted">Hai speso tempo in domande non pertinenti.</p>}
          </div>
          <Continue onClick={next} />
        </>
      )}

      {mine.length > 0 && (
        <details className="rpg-log" open={log} onToggle={(e) => setLog((e.target as HTMLDetailsElement).open)}>
          <summary>📜 Registro della conversazione ({mine.length})</summary>
          <div className="s-chat">
            {mine.map((q) => (
              <div key={q.id} className="s-qa">
                <p className="me">{q.q}</p>
                <p className="owner">{q.a}</p>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

/* ================================================================ scheda PS */

/** Minigioco a tutto schermo (portal nel contenitore .sim per ereditarne il tema). Esc chiude. */
function GameModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);
  const host = document.querySelector('.sim');
  if (!host) return null;
  return createPortal(
    <div className="s-game-modal" role="dialog" aria-modal="true" aria-label={title}>
      <div className="s-game-modal-head">
        <b>{title}</b>
        <button className="s-x" onClick={onClose} aria-label="Chiudi">✕</button>
      </div>
      <div className="s-game-modal-body">{children}</div>
    </div>,
    host,
  );
}
export function VitalsView({ stage }: { stage: VitalsStage }) {
  const c = useSim((s) => s.caseDef)!;
  const findings = useSim((s) => s.findings);
  const phys = useSim((s) => s.phys);
  const next = useSim((s) => s.next);
  const [open, setOpen] = useState<VitalId | null>(null);
  const [closed, setClosed] = useState(false);
  const all = [...stage.required, ...stage.optional];
  const missing = stage.required.filter((v) => !findings[v]);

  const record = (v: VitalId) => (value: string, ok: boolean, note?: string) => {
    const st = useSim.getState();
    st.recordFinding(v, { value, ok, note });
    st.addLog('azione', `${VITAL_LABEL[v].label}: ${value}`);
    st.advance(VITAL_LABEL[v].min);
    setOpen(null);
  };

  const finish = () => {
    const st = useSim.getState();
    if (!st.markDone(stage.id)) return;
    const ok = stage.required.filter((v) => findings[v]?.ok).length;
    let pts = (stage.points * ok) / stage.required.length;
    const bonus = stage.optional.filter((v) => findings[v]?.ok).length;
    pts += bonus * 3;
    st.addScore('clinica', Math.round(pts), stage.points, `Parametri corretti ${ok}/${stage.required.length}${bonus ? ` + ${bonus} facoltativi` : ''}`);
    setClosed(true);
  };

  const truth = { ...c.vitals, sbp: phys.sbp };
  const game = (v: VitalId) => {
    const done = record(v);
    switch (v) {
      case 'temp':
        return <ThermoGame truth={truth} onDone={done} />;
      case 'polso':
        return <PulseGame truth={truth} onDone={done} />;
      case 'resp':
        return <RespGame truth={truth} onDone={done} />;
      case 'mucose':
        return <MucousGame truth={truth} onDone={done} />;
      case 'trc':
        return <TrcGame truth={truth} onDone={done} />;
      case 'loc':
        return <LocGame truth={truth} onDone={done} />;
      case 'pa':
        return <DopplerGame sbp={phys.sbp} hr={phys.hr} onDone={(value, ok, note) => done(value, ok, note)} />;
    }
  };

  return (
    <div className="s-stage">
      <StageHeader eyebrow={stage.phase} title={stage.title}>
        <SpeechBubble speaker={MENTOR} text={stage.intro} />
      </StageHeader>
      <div className="s-vitals">
        {all.map((v) => {
          const f = findings[v];
          const req = stage.required.includes(v);
          return (
            <button key={v} className={`s-vital ${f ? 'done' : ''} ${open === v ? 'open' : ''}`} disabled={closed} onClick={() => setOpen(open === v ? null : v)}>
              <span className="ic">{VITAL_LABEL[v].icon}</span>
              <span className="lb">
                {VITAL_LABEL[v].label}
                {!req && <small> · facoltativo</small>}
              </span>
              <span className="val">
                {f ? f.value : '—'}
                {closed && f && <i className={f.ok ? 'good' : 'bad'}>{f.ok ? ' ✓' : ' ✗'}</i>}
              </span>
            </button>
          );
        })}
      </div>
      {open && !closed && (
        <GameModal title={`${VITAL_LABEL[open].icon} ${VITAL_LABEL[open].label}`} onClose={() => setOpen(null)}>
          {game(open)}
        </GameModal>
      )}
      {!closed ? (
        <button className="s-btn primary" disabled={missing.length > 0} onClick={finish}>
          {missing.length ? `Mancano ${missing.length} parametri obbligatori` : 'Chiudi la scheda PS'}
        </button>
      ) : (
        <>
          <div className="s-review">
            <h4>Verifica della scheda</h4>
            <ul>
              {all
                .filter((v) => findings[v])
                .map((v) => (
                  <li key={v} className={findings[v]!.ok ? 'good' : 'bad'}>
                    {findings[v]!.ok ? '✓' : '✗'} {VITAL_LABEL[v].label}: {findings[v]!.value}
                    {findings[v]!.note && <small> — {findings[v]!.note}</small>}
                  </li>
                ))}
            </ul>
            {!findings.pa && <p className="s-muted">Non hai misurato la pressione: con un deficit visivo è un dato prezioso.</p>}
          </div>
          <Continue onClick={next} />
        </>
      )}
    </div>
  );
}

/* ================================================================ richiesta esami */
type PendingGame = { exam: ExamId; kind: 'ecofast' | 'doppler' | 'fondo' };

export function OrdersView({ stage }: { stage: OrdersStage }) {
  const ctx = useSimCtx();
  const results = useSim((s) => s.results);
  const clock = useSim((s) => s.clock);
  const phys = useSim((s) => s.phys);
  const next = useSim((s) => s.next);
  const [cart, setCart] = useState<ExamId[]>([]);
  const [games, setGames] = useState<PendingGame[] | null>(null);
  const [sent, setSent] = useState<ResultDoc[] | null>(null);
  const [rel] = useState(() => dyn(stage.relevance, useSim.getState().ctx()));
  const [scored, setScored] = useState<{ pts: number; lines: { exam: ExamId; text: string; tone: string }[] } | null>(null);

  const total = cart.reduce((a, e) => a + EXAMS[e].cost, 0);
  const toggle = (e: ExamId) => setCart((c) => (c.includes(e) ? c.filter((x) => x !== e) : [...c, e]));

  const send = () => {
    const g = cart.filter((e) => EXAMS[e].minigame).map((e) => ({ exam: e, kind: EXAMS[e].minigame! }));
    if (g.length) setGames(g);
    else dispatch();
  };

  const dispatch = () => {
    const st = useSim.getState();
    if (!st.markDone(stage.id)) return;
    const docs = st.orderExams(cart);
    // esami che il caso esegue comunque (es. emogas): li chiede il collega
    for (const f of stage.forced ?? []) {
      if (!cart.includes(f)) {
        st.addLog('evento', `Il collega richiede comunque: ${EXAMS[f].label}`);
        docs.push(st.addResult(f));
      }
    }
    // punteggio di appropriatezza
    let raw = 0;
    let max = 0;
    const lines: { exam: ExamId; text: string; tone: string }[] = [];
    for (const [e, r] of Object.entries(rel) as [ExamId, { rel: string; why: string }][]) {
      const chosen = cart.includes(e);
      if (r.rel === 'essential') {
        max += 10;
        if (chosen) raw += 10;
        lines.push({ exam: e, text: r.why, tone: chosen ? 'good' : 'bad' });
      } else if (r.rel === 'useful') {
        max += 4;
        if (chosen) raw += 4;
        lines.push({ exam: e, text: r.why, tone: chosen ? 'good' : 'muted' });
      } else if (r.rel === 'inappropriate' && chosen) {
        raw -= 8;
        lines.push({ exam: e, text: r.why, tone: 'bad' });
      } else if (r.rel === 'neutral' && chosen) {
        raw -= 1;
        lines.push({ exam: e, text: r.why, tone: 'muted' });
      }
    }
    const pts = Math.round(stage.points * Math.max(0, raw / max));
    st.addScore('esami', pts, stage.points, `${stage.title} (spesa ${total} €)`);
    setScored({ pts, lines });
    setSent(docs);
  };

  const gameDone = (exam: ExamId, value: string, ok: boolean) => {
    const st = useSim.getState();
    st.addLog('azione', `${EXAMS[exam].short}: ${value}`);
    if (exam === 'pa') st.recordFinding('pa', { value, ok });
    if (!ok) st.addScore('clinica', -2, 0, `${EXAMS[exam].short}: esecuzione/lettura imprecisa`);
    const rest = games!.slice(1);
    if (rest.length) setGames(rest);
    else {
      setGames([]);
      dispatch();
    }
  };

  const pending = sent?.filter((d) => !d.refused && d.readyAt > clock) ?? [];
  const ready = sent?.filter((d) => d.refused || d.readyAt <= clock) ?? [];

  return (
    <div className="s-stage">
      <StageHeader eyebrow={stage.phase} title={stage.title}>
        <SpeechBubble speaker={MENTOR} text={dyn(stage.intro, ctx)} />
      </StageHeader>

      {!sent && !games?.length && (
        <>
          {stage.groups.map((g) => (
            <section key={g.title} className="s-exgroup">
              <h4>{g.title}</h4>
              <div className="s-exgrid">
                {g.exams.map((e) => {
                  const m = EXAMS[e];
                  const prev = results.some((r) => r.exam === e && !r.refused);
                  return (
                    <button key={e} className={`s-exam ${cart.includes(e) ? 'on' : ''}`} onClick={() => toggle(e)}>
                      <span className="ic">{m.icon}</span>
                      <span className="lb">
                        {m.short}
                        {prev && <small> · già eseguito</small>}
                      </span>
                      <span className="meta">
                        {m.cost} € · {m.turnaroundMin >= 600 ? `${Math.round(m.turnaroundMin / 60)} h` : `${m.workMin + m.turnaroundMin}'`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
          <div className="s-cartbar">
            <span>{cart.length} esami · <b>{total} €</b></span>
            <button className="s-btn primary" disabled={!cart.length} onClick={send}>Invia richieste</button>
          </div>
        </>
      )}

      {games && games.length > 0 && (
        <div className="s-game-box">
          <div className="s-game-head">
            <b>{EXAMS[games[0].exam].icon} {EXAMS[games[0].exam].label}</b>
          </div>
          {games[0].kind === 'ecofast' && <EcoFastGame onDone={(ok, note) => gameDone('ecofast', note, ok)} />}
          {games[0].kind === 'doppler' && <DopplerGame sbp={phys.sbp} hr={phys.hr} onDone={(v, ok) => gameDone('pa', v, ok)} />}
          {games[0].kind === 'fondo' && <FundusGame hypertensive={phys.sbp >= 170} onDone={(ok, a) => gameDone('fondo', a, ok)} />}
        </div>
      )}

      {sent && scored && (
        <>
          <div className="s-review">
            <h4>Appropriatezza: +{scored.pts}/{stage.points}</h4>
            <ul>
              {scored.lines.map((l) => (
                <li key={l.exam} className={l.tone}>
                  <b>{EXAMS[l.exam].short}</b> — {l.text}
                </li>
              ))}
            </ul>
          </div>
          {pending.length > 0 && (
            <div className="s-pending">
              <p>In corso: {pending.map((d) => EXAMS[d.exam].short).join(', ')}</p>
              <button className="s-btn" onClick={() => useSim.getState().waitForResults(180)}>⏳ Attendi i referti</button>
            </div>
          )}
          {ready.map((d) => (
            <ResultView key={d.id} doc={d} compact />
          ))}
          <Continue onClick={next} disabled={pending.some((d) => d.readyAt - clock <= 180)} label={pending.some((d) => d.readyAt - clock <= 180) ? 'Attendi i referti' : 'Continua'} />
        </>
      )}
    </div>
  );
}

/* ================================================================ emogas */
export function AbgView({ stage }: { stage: AbgStage }) {
  const results = useSim((s) => s.results);
  const clock = useSim((s) => s.clock);
  const next = useSim((s) => s.next);
  const doc = useMemo(() => [...results].reverse().find((r) => r.exam === 'emogas' && !r.refused), [results]);
  const [tapped, setTapped] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [part1, setPart1] = useState<number | null>(null);

  if (!doc) {
    return (
      <div className="s-stage">
        <StageHeader eyebrow={stage.phase} title={stage.title} />
        <p className="s-muted">Nessun emogas disponibile: il collega lo esegue ora.</p>
        <button className="s-btn primary" onClick={() => useSim.getState().orderExams(['emogas'])}>Esegui emogas</button>
      </div>
    );
  }
  if (doc.readyAt > clock) {
    return (
      <div className="s-stage">
        <StageHeader eyebrow={stage.phase} title={stage.title} />
        <button className="s-btn primary" onClick={() => useSim.getState().waitForResults()}>⏳ Attendi l’emogas</button>
      </div>
    );
  }
  const rows = doc.rows!;
  const num = (l: string) => Number(rows.find((r) => r.label === l)!.value);
  const ph = num('pH');
  const hco3 = num('HCO₃⁻');
  const pco2 = num('pCO₂');
  const expected = 40 + 0.7 * (hco3 - 24);
  const abnormal = rows.filter((r) => r.flag).map((r) => r.label);

  const checkTaps = () => {
    const tp = tapped.filter((t) => abnormal.includes(t)).length;
    const fp = tapped.length - tp;
    setPart1(Math.max(0, (tp - fp) / abnormal.length));
  };

  const phState = ph > 7.41 ? 'alcalemia' : ph < 7.28 ? 'acidemia' : 'pH normale';
  const primary = ph > 7.41 ? (hco3 > 23 ? 'alcalosi metabolica' : 'alcalosi respiratoria') : ph < 7.28 ? (hco3 < 18 ? 'acidosi metabolica' : 'acidosi respiratoria') : 'nessun disturbo primario evidente';
  const comp = Math.abs(pco2 - expected) <= 4 ? 'compenso respiratorio adeguato' : 'disturbo misto';
  const steps = [
    { q: `Il pH è ${ph}. Indica…`, opts: ['acidemia', 'pH normale', 'alcalemia'], right: phState },
    { q: `HCO₃⁻ ${hco3} mmol/L, pCO₂ ${pco2} mmHg. Il disturbo primario è…`, opts: ['acidosi metabolica', 'alcalosi metabolica', 'acidosi respiratoria', 'alcalosi respiratoria'], right: primary },
    { q: `pCO₂ attesa = 40 + 0,7 × (HCO₃⁻ − 24) = ${expected.toFixed(1)} mmHg. Misurata ${pco2}. Quindi…`, opts: ['compenso respiratorio adeguato', 'disturbo misto'], right: comp },
  ];

  const answer = (o: string) => {
    const ok = o === steps[step].right;
    const a = [...answers, ok];
    setAnswers(a);
    if (step + 1 < steps.length) setStep(step + 1);
    else {
      const st = useSim.getState();
      if (st.markDone(stage.id)) {
        const frac = 0.4 * (part1 ?? 0) + 0.2 * a.filter(Boolean).length;
        st.addScore('ragionamento', Math.round(stage.points * frac), stage.points, 'Interpretazione emogas');
        st.addLog('decisione', `Emogas interpretato: ${a.filter(Boolean).length}/3 passaggi corretti`);
      }
      setStep(steps.length);
    }
  };

  return (
    <div className="s-stage">
      <StageHeader eyebrow={stage.phase} title={stage.title}>
        <SpeechBubble speaker={MENTOR} text={stage.intro} />
      </StageHeader>
      <div className="s-printout">
        <p className="s-print-head">EMOGASANALIZZATORE · campione venoso · {doc.title}</p>
        {rows.map((r) => {
          const on = tapped.includes(r.label);
          const reveal = part1 !== null;
          const cls = reveal ? (r.flag ? (on ? 'hit' : 'miss') : on ? 'fp' : '') : on ? 'on' : '';
          return (
            <button key={r.label} className={`s-print-row ${cls}`} disabled={part1 !== null} onClick={() => setTapped((t) => (on ? t.filter((x) => x !== r.label) : [...t, r.label]))}>
              <span>{r.label}</span>
              <span className="v">{r.value} {r.unit}</span>
              <span className="r">{reveal ? r.ref : ''}</span>
            </button>
          );
        })}
      </div>
      {part1 === null ? (
        <button className="s-btn primary" disabled={!tapped.length} onClick={checkTaps}>Verifica i valori anomali</button>
      ) : (
        <>
          <p className="s-hint">Valori anomali individuati: {Math.round(part1 * 100)}% · ora i valori di riferimento sono visibili.</p>
          {step < steps.length ? (
            <div className="s-step">
              <h3 className="s-question">{steps[step].q}</h3>
              <div className="s-seg col">
                {steps[step].opts.map((o) => (
                  <button key={o} onClick={() => answer(o)}>{o}</button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="s-verdict good">
                <b>Interpretazione</b>
                <p>
                  {phState}, {primary} con {comp}. K⁺ {num('K⁺')} mEq/L. L’ipokaliemia e l’alcalosi metabolica si alimentano a vicenda: in alcalosi il K⁺ entra nelle cellule e il rene, sotto stimolo mineralcorticoide, scambia Na⁺ con K⁺ e H⁺ (ENaC/ROMK, pompa Na⁺/K⁺-ATPasi basolaterale).
                </p>
                <ul className="s-steps-res">
                  {steps.map((s, i) => (
                    <li key={i} className={answers[i] ? 'good' : 'bad'}>{answers[i] ? '✓' : '✗'} {s.right}</li>
                  ))}
                </ul>
              </div>
              <Continue onClick={next} />
            </>
          )}
        </>
      )}
    </div>
  );
}

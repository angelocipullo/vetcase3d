import { HeartSound, LungSound, Vitals } from '../game/types';

const BARK_SAMPLES = ['bark_1', 'bark_2'];

const MUTE_KEY = 'vetcase3d.muted';
function readMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Rumore d'ambiente dell'ambulatorio (public/audio/ambient_hospital.mp3), in loop continuo. */
const AMBIENT_SAMPLE = 'ambient_hospital';
const AMBIENT_VOLUME = 1.1; // sottofondo: la registrazione è già bassa (media ≈ -43 dB)
const AMBIENT_XFADE = 4; // secondi di sovrapposizione fra una ripetizione e la successiva
/** Durante l'auscultazione le olive del fonendo isolano dall'ambiente. */
const AMBIENT_DUCK = 0.2;

/** Curve a potenza costante (sin/cos) per il crossfade: niente calo di volume a metà. */
const XFADE_STEPS = 64;
const FADE_IN = Float32Array.from({ length: XFADE_STEPS }, (_, i) => Math.sin((i / (XFADE_STEPS - 1)) * (Math.PI / 2)));
const FADE_OUT = Float32Array.from({ length: XFADE_STEPS }, (_, i) => Math.cos((i / (XFADE_STEPS - 1)) * (Math.PI / 2)));

/**
 * Motore audio dell'auscultazione.
 *
 * Di default SINTETIZZA in tempo reale cuore (S1 "lub" / S2 "dub", soffio, aritmie)
 * e respiro (murmure vescicolare, crepitii, sibili), parametrizzati sui parametri vitali del caso.
 *
 * Per usare REGISTRAZIONI VERE metti i file in /public/audio con questi nomi
 * (vedi public/audio/README.md): heart_<heartSound>.mp3, lungs_<lungSound>.mp3.
 * Se il file esiste viene usato in loop (il cuore viene riscalato sulla frequenza del caso),
 * altrimenti si usa la sintesi.
 */

const SAMPLE_BPM = 100; // frequenza di riferimento delle registrazioni cardiache
const SAMPLE_RR = 24;

class AuscultationEngine {
  private ctx?: AudioContext;
  private master?: GainNode;
  private heartBus?: GainNode;
  private lungBus?: GainNode;
  private noise?: AudioBuffer;
  private timer?: number;
  private nextBeat = 0;
  private nextBreath = 0;
  private vitals?: Vitals;
  private sampleCache = new Map<string, AudioBuffer | null>();
  private sampleNodes: AudioBufferSourceNode[] = [];
  private ambientBus?: GainNode;
  private ambientNext = 0;
  private ambientTimer?: number;
  /** Uscita generale: tutti i suoni passano di qui (serve al pulsante muto). */
  private out?: GainNode;
  private muted = readMuted();
  private usingHeartSample = false;
  private usingLungSample = false;
  running = false;

  private ensure() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.out = this.ctx.createGain();
      this.out.gain.value = this.muted ? 0 : 1;
      this.out.connect(this.ctx.destination);
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      // il fonendoscopio taglia le alte frequenze
      const steth = this.ctx.createBiquadFilter();
      steth.type = 'lowpass';
      steth.frequency.value = 900;
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(steth).connect(comp).connect(this.out);
      this.heartBus = this.ctx.createGain();
      this.lungBus = this.ctx.createGain();
      this.heartBus.gain.value = 0;
      this.lungBus.gain.value = 0;
      this.heartBus.connect(this.master);
      this.lungBus.connect(this.master);
      const len = this.ctx.sampleRate * 2;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      // rumore "rosa" approssimato
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + w * 0.099046;
        b1 = 0.963 * b1 + w * 0.2965164;
        b2 = 0.57 * b2 + w * 1.0526913;
        d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  isMuted() {
    return this.muted;
  }

  /** Silenzia/riattiva tutto l'audio (preferenza salvata nel browser). */
  setMuted(muted: boolean) {
    this.muted = muted;
    try {
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch {
      /* storage non disponibile: vale solo per questa sessione */
    }
    if (this.ctx && this.out) this.out.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.05);
  }

  /** Va chiamato da un gesto utente almeno una volta (policy autoplay iOS). */
  unlock() {
    this.ensure();
    // precarica gli abbai registrati (public/audio/bark_1.mp3, bark_2.mp3)
    for (const name of BARK_SAMPLES) void this.loadSample(name);
    void this.startAmbient();
  }

  /**
   * Avvia l'ambiente in loop infinito. Ogni ripetizione parte AMBIENT_XFADE secondi prima della fine
   * della precedente e si incrociano con curve a potenza costante. Le ripetizioni vengono programmate
   * con largo anticipo, così il loop regge anche con i timer rallentati delle schede in background.
   */
  private async startAmbient() {
    if (this.ambientBus) return;
    const ctx = this.ensure();
    this.ambientBus = ctx.createGain();
    this.ambientBus.gain.value = AMBIENT_VOLUME;
    this.ambientBus.connect(this.out!);
    const buf = await this.loadSample(AMBIENT_SAMPLE);
    if (!buf) return;
    const xf = Math.min(AMBIENT_XFADE, buf.duration / 3);
    const scheduleOne = (when: number, fadeIn: number) => {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = 0;
      g.gain.setValueCurveAtTime(FADE_IN, when, fadeIn);
      g.gain.setValueCurveAtTime(FADE_OUT, when + buf.duration - xf, xf);
      src.connect(g).connect(this.ambientBus!);
      src.start(when);
      src.stop(when + buf.duration);
      src.onended = () => g.disconnect();
      this.ambientNext = when + buf.duration - xf;
    };
    const fill = () => {
      // tieni sempre programmata la ripetizione successiva: ~90 s di margine anche se il browser
      // rallenta i timer della scheda in background (fino a una volta al minuto)
      while (this.ambientNext - ctx.currentTime < buf.duration) scheduleOne(this.ambientNext, xf);
    };
    scheduleOne(ctx.currentTime + 0.05, 2.5);
    fill();
    this.ambientTimer = window.setInterval(fill, 5000);
  }

  private duckAmbient(on: boolean) {
    if (!this.ctx || !this.ambientBus) return;
    const g = this.ambientBus.gain;
    g.cancelScheduledValues(this.ctx.currentTime);
    g.setTargetAtTime(on ? AMBIENT_VOLUME * AMBIENT_DUCK : AMBIENT_VOLUME, this.ctx.currentTime, 0.15);
  }

  private async loadSample(name: string): Promise<AudioBuffer | null> {
    if (this.sampleCache.has(name)) return this.sampleCache.get(name)!;
    const ctx = this.ensure();
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}audio/${name}.mp3`);
      if (!res.ok || !(res.headers.get('content-type') ?? '').includes('audio')) throw new Error('missing');
      const buf = await ctx.decodeAudioData(await res.arrayBuffer());
      this.sampleCache.set(name, buf);
      return buf;
    } catch {
      this.sampleCache.set(name, null);
      return null;
    }
  }

  async start(vitals: Vitals) {
    const ctx = this.ensure();
    this.stop();
    this.vitals = vitals;
    this.running = true;
    this.nextBeat = ctx.currentTime + 0.05;
    this.nextBreath = ctx.currentTime + 0.05;

    const [hs, ls] = await Promise.all([
      this.loadSample(`heart_${vitals.heartSound}`),
      this.loadSample(`lungs_${vitals.lungSound}`),
    ]);
    if (!this.running) return;
    this.usingHeartSample = !!hs;
    this.usingLungSample = !!ls;
    if (hs) this.playLoop(hs, this.heartBus!, vitals.heartRate / SAMPLE_BPM);
    if (ls) this.playLoop(ls, this.lungBus!, vitals.respRate / SAMPLE_RR);

    this.timer = window.setInterval(() => this.schedule(), 50);
    this.duckAmbient(true);
  }

  private playLoop(buf: AudioBuffer, dest: AudioNode, rate: number) {
    const src = this.ctx!.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.playbackRate.value = Math.max(0.5, Math.min(2, rate));
    src.connect(dest);
    src.start();
    this.sampleNodes.push(src);
  }

  stop() {
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.sampleNodes.forEach((n) => {
      try { n.stop(); } catch { /* noop */ }
    });
    this.sampleNodes = [];
    this.setGains(0, 0);
    this.duckAmbient(false);
  }

  setGains(heart: number, lungs: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.heartBus!.gain.setTargetAtTime(heart, t, 0.05);
    this.lungBus!.gain.setTargetAtTime(lungs * 0.9, t, 0.05);
  }

  // ---------- scheduler ----------
  private schedule() {
    const ctx = this.ctx!;
    const v = this.vitals!;
    const horizon = ctx.currentTime + 0.2;
    if (!this.usingHeartSample) {
      while (this.nextBeat < horizon) {
        let interval = 60 / v.heartRate;
        let skip = false;
        if (v.heartSound === HeartSound.Arrhythmia) {
          interval *= 0.7 + Math.random() * 0.7;
          skip = Math.random() < 0.12;
        }
        if (!skip) this.beat(this.nextBeat, interval, v.heartSound);
        this.nextBeat += interval;
      }
    }
    if (!this.usingLungSample) {
      while (this.nextBreath < horizon) {
        const cycle = 60 / v.respRate;
        this.breath(this.nextBreath, cycle, v.lungSound);
        this.nextBreath += cycle;
      }
    }
  }

  private thump(t: number, freq: number, dur: number, gain: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 1.5, t);
    osc.frequency.exponentialRampToValueAtTime(freq, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.heartBus!);
    osc.start(t);
    osc.stop(t + dur + 0.05);

    const n = ctx.createBufferSource();
    n.buffer = this.noise!;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = freq * 3;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(gain * 1.4, t + 0.008);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.8);
    n.connect(lp).connect(ng).connect(this.heartBus!);
    n.start(t, Math.random());
    n.stop(t + dur);
  }

  private beat(t: number, interval: number, type: HeartSound) {
    const systole = Math.min(0.32, interval * 0.38);
    this.thump(t, 48, 0.12, 0.9); // S1 lub
    this.thump(t + systole, 70, 0.09, 0.6); // S2 dub
    if (type === HeartSound.Murmur) {
      const ctx = this.ctx!;
      const n = ctx.createBufferSource();
      n.buffer = this.noise!;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 280;
      bp.Q.value = 0.9;
      const g = ctx.createGain();
      const a = t + 0.05;
      const b = t + systole - 0.01;
      g.gain.setValueAtTime(0.0001, a);
      g.gain.linearRampToValueAtTime(0.55, a + 0.03);
      g.gain.setValueAtTime(0.5, b - 0.03);
      g.gain.linearRampToValueAtTime(0.0001, b);
      n.connect(bp).connect(g).connect(this.heartBus!);
      n.start(a, Math.random());
      n.stop(b + 0.02);
    }
  }

  private breath(t: number, cycle: number, type: LungSound) {
    const ctx = this.ctx!;
    const insp = cycle * 0.4;
    const exp = cycle * 0.5;
    const muffled = type === LungSound.Muffled;
    const level = muffled ? 0.12 : 0.35;

    const make = (start: number, dur: number, peak: number, freq: number) => {
      const n = ctx.createBufferSource();
      n.buffer = this.noise!;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = muffled ? 200 : freq;
      bp.Q.value = 0.6;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, start);
      g.gain.linearRampToValueAtTime(peak, start + dur * 0.55);
      g.gain.linearRampToValueAtTime(0.0001, start + dur);
      n.connect(bp).connect(g).connect(this.lungBus!);
      n.start(start, Math.random());
      n.stop(start + dur + 0.02);
    };
    make(t, insp, level, 520);
    make(t + insp + 0.05, exp, level * 0.45, 380);

    if (type === LungSound.Crackles) {
      const count = 8 + Math.floor(Math.random() * 6);
      for (let i = 0; i < count; i++) {
        const ct = t + insp * (0.35 + Math.random() * 0.65);
        const n = ctx.createBufferSource();
        n.buffer = this.noise!;
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 350;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, ct);
        g.gain.exponentialRampToValueAtTime(0.9, ct + 0.002);
        g.gain.exponentialRampToValueAtTime(0.0001, ct + 0.012);
        n.connect(hp).connect(g).connect(this.lungBus!);
        n.start(ct, Math.random());
        n.stop(ct + 0.02);
      }
    }
    if (type === LungSound.Wheezes) {
      const s = t + insp + 0.05;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(420, s);
      osc.frequency.linearRampToValueAtTime(360, s + exp);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, s);
      g.gain.linearRampToValueAtTime(0.12, s + exp * 0.3);
      g.gain.linearRampToValueAtTime(0.0001, s + exp);
      osc.connect(g).connect(this.lungBus!);
      osc.start(s);
      osc.stop(s + exp + 0.05);
    }
  }

  // ---------- effetti UI (fuori dal filtro del fonendo) ----------
  beep(times = 3) {
    const ctx = this.ensure();
    for (let i = 0; i < times; i++) {
      const t = ctx.currentTime + i * 0.18;
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = 2400;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.06, t);
      g.gain.setValueAtTime(0, t + 0.1);
      o.connect(g).connect(this.out!);
      o.start(t);
      o.stop(t + 0.12);
    }
  }

  whine() {
    const ctx = this.ensure();
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(950, t);
    o.frequency.exponentialRampToValueAtTime(620, t + 0.5);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1600;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.08, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    o.connect(lp).connect(g).connect(this.out!);
    o.start(t);
    o.stop(t + 0.6);
  }

  private barkIndex = 0;

  /** Abbaio registrato, alternando i campioni; se non ancora caricati usa la sintesi. */
  bark() {
    const ctx = this.ensure();
    const name = BARK_SAMPLES[this.barkIndex++ % BARK_SAMPLES.length];
    const buf = this.sampleCache.get(name);
    if (!buf) {
      void this.loadSample(name);
      this.barkSynth();
      return;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = 0.94 + Math.random() * 0.12;
    const g = ctx.createGain();
    g.gain.value = 0.9;
    src.connect(g).connect(this.out!);
    src.start();
  }

  private barkSynth() {
    const ctx = this.ensure();
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(520, t);
    o.frequency.exponentialRampToValueAtTime(300, t + 0.12);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    bp.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(bp).connect(g).connect(this.out!);
    o.start(t);
    o.stop(t + 0.2);
  }
}

export const audio = new AuscultationEngine();

// MoleculeForge — procedural sound via Web Audio API. No audio files.

let ctx = null;
let masterGain = null;
let muted = true;

function ensureCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  masterGain = ctx.createGain();
  masterGain.gain.value = muted ? 0 : 0.4;
  masterGain.connect(ctx.destination);
  return ctx;
}

export function setMuted(v) {
  muted = !!v;
  if (masterGain) masterGain.gain.value = muted ? 0 : 0.4;
}

// Wake context on user interaction (browsers require it).
export function unlockAudio() {
  ensureCtx();
  if (ctx && ctx.state === "suspended") ctx.resume();
}

function envelope(node, t0, attack, decay, sustain, release, peak = 1) {
  const g = node.gain;
  g.cancelScheduledValues(t0);
  g.setValueAtTime(0, t0);
  g.linearRampToValueAtTime(peak, t0 + attack);
  g.linearRampToValueAtTime(peak * sustain, t0 + attack + decay);
  g.linearRampToValueAtTime(0, t0 + attack + decay + release);
}

function tone({ freq, freqEnd = freq, type = "sine", dur = 0.3, vol = 0.3, attack = 0.01, decay = 0.05, sustain = 0.7, release = 0.1, filter = null, delay = 0 }) {
  if (!ensureCtx() || muted) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd !== freq) osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
  envelope(gain, t0, attack, decay, sustain, release, vol);

  let last = osc;
  if (filter) {
    const f = ctx.createBiquadFilter();
    f.type = filter.type || "lowpass";
    f.frequency.value = filter.freq || 800;
    f.Q.value = filter.Q || 1;
    last.connect(f); last = f;
  }
  last.connect(gain).connect(masterGain);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noiseBurst({ dur = 0.15, vol = 0.2, filterFreq = 1500, filterStart = 4000, delay = 0 }) {
  if (!ensureCtx() || muted) return;
  const t0 = ctx.currentTime + delay;
  const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.setValueAtTime(filterStart, t0);
  f.frequency.exponentialRampToValueAtTime(filterFreq, t0 + dur);
  const gain = ctx.createGain();
  envelope(gain, t0, 0.005, 0.04, 0.5, dur - 0.05, vol);
  src.connect(f).connect(gain).connect(masterGain);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

export const SFX = {
  atomMaterialize() {
    tone({ freq: 200, freqEnd: 800, type: "sine", dur: 0.18, vol: 0.25, attack: 0.005, decay: 0.05, sustain: 0.6, release: 0.12 });
    tone({ freq: 400, freqEnd: 1600, type: "triangle", dur: 0.18, vol: 0.12, attack: 0.005, decay: 0.05, sustain: 0.4, release: 0.12, delay: 0.02 });
  },
  bondSnap() {
    noiseBurst({ dur: 0.12, vol: 0.18, filterStart: 5000, filterFreq: 800 });
    tone({ freq: 600, type: "square", dur: 0.06, vol: 0.08, attack: 0.001, decay: 0.02, sustain: 0.3, release: 0.04 });
  },
  correct() {
    // C5 + E5 major third
    tone({ freq: 523.25, type: "sine", dur: 0.4, vol: 0.18, attack: 0.005, decay: 0.08, sustain: 0.6, release: 0.3 });
    tone({ freq: 659.25, type: "sine", dur: 0.4, vol: 0.16, attack: 0.005, decay: 0.08, sustain: 0.6, release: 0.3, delay: 0.02 });
  },
  wrong() {
    // Minor 2nd dissonance
    tone({ freq: 261.63, type: "sawtooth", dur: 0.2, vol: 0.14, attack: 0.005, decay: 0.05, sustain: 0.5, release: 0.12, filter: { freq: 1200 } });
    tone({ freq: 277.18, type: "sawtooth", dur: 0.2, vol: 0.12, attack: 0.005, decay: 0.05, sustain: 0.5, release: 0.12, filter: { freq: 1200 }, delay: 0.01 });
  },
  forgeComplete() {
    // Rising C-E-G-C arpeggio
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      tone({ freq: f, type: "triangle", dur: 0.25, vol: 0.18, attack: 0.005, decay: 0.06, sustain: 0.6, release: 0.18, delay: i * 0.12 });
    });
  },
  tick() {
    tone({ freq: 1200, type: "sine", dur: 0.04, vol: 0.06, attack: 0.001, decay: 0.01, sustain: 0.3, release: 0.02 });
  }
};

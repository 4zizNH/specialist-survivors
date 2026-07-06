// engine/audio.js
// Zero-dependency procedural audio via WebAudio: synthesized SFX + a small
// generative music loop. The AudioContext can only start after a user gesture,
// so everything no-ops until unlock() runs (wired to the first keydown).
// Master volume comes from the save profile via the getVolume callback.

const AC =
  typeof window !== "undefined"
    ? window.AudioContext || window.webkitAudioContext
    : null;

export function createAudio(getVolume = () => 1) {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let musicTimer = null;
  let musicStep = 0;
  let lastFire = 0;
  let lastPickup = 0;

  function unlock() {
    if (!AC || ctx) return;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = getVolume();
      master.connect(ctx.destination);
      startMusic();
    } catch {
      ctx = null;
    }
  }

  if (typeof window !== "undefined" && AC) {
    window.addEventListener("keydown", unlock, { once: true });
    window.addEventListener("pointerdown", unlock, { once: true });
  }

  // A pitched blip: oscillator with an exponential pitch/volume envelope.
  function blip({ type = "square", f0 = 440, f1 = f0, dur = 0.1, vol = 0.15, delay = 0 }) {
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(1, f0), t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  // A filtered noise burst (impacts).
  function noise({ dur = 0.08, vol = 0.12, freq = 1200 }) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const len = Math.max(1, (ctx.sampleRate * dur) | 0);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(master);
    src.start(t);
  }

  // --- Generative music: a soft minor loop (bass line + pad chords) ---------
  const BASS = [110, 110, 87.3, 87.3, 130.8, 130.8, 98, 98]; // A2 F2 C3 G2
  const CHORDS = [
    [220, 261.6, 329.6], // Am
    [174.6, 220, 261.6], // F
    [261.6, 329.6, 392], // C
    [196, 246.9, 293.7], // G
  ];

  function startMusic() {
    if (!ctx || musicTimer) return;
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.5; // music sits under SFX; master scales all
    musicGain.connect(master);
    musicStep = 0;
    musicTimer = setInterval(() => {
      if (!ctx) return;
      const t = ctx.currentTime;
      // Bass note every step (0.5s).
      playInto(musicGain, "triangle", BASS[musicStep % BASS.length], 0.45, 0.1, t);
      // Pad chord every 4 steps.
      if (musicStep % 4 === 0) {
        for (const f of CHORDS[(musicStep / 4) % CHORDS.length | 0]) {
          playInto(musicGain, "sine", f, 2.0, 0.035, t);
        }
      }
      musicStep++;
    }, 500);
  }

  function playInto(dest, type, freq, dur, vol, t) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  return {
    unlock,
    setVolume(v) {
      if (master) master.gain.value = Math.max(0, Math.min(1, v));
    },
    get ready() {
      return !!ctx;
    },
    sfx: {
      fire() {
        // Weapons fire constantly — throttle so it reads as texture, not spam.
        const now = performance.now();
        if (now - lastFire < 90) return;
        lastFire = now;
        blip({ type: "square", f0: 320, f1: 180, dur: 0.06, vol: 0.05 });
      },
      hit() {
        noise({ dur: 0.05, vol: 0.06, freq: 1600 });
      },
      kill() {
        blip({ type: "triangle", f0: 200, f1: 70, dur: 0.12, vol: 0.12 });
      },
      pickup() {
        const now = performance.now();
        if (now - lastPickup < 60) return;
        lastPickup = now;
        blip({ type: "sine", f0: 660, f1: 990, dur: 0.08, vol: 0.08 });
      },
      levelup() {
        blip({ type: "square", f0: 440, f1: 440, dur: 0.09, vol: 0.1 });
        blip({ type: "square", f0: 554, f1: 554, dur: 0.09, vol: 0.1, delay: 0.09 });
        blip({ type: "square", f0: 659, f1: 880, dur: 0.16, vol: 0.12, delay: 0.18 });
      },
      hurt() {
        blip({ type: "sawtooth", f0: 140, f1: 60, dur: 0.15, vol: 0.14 });
      },
      death() {
        blip({ type: "sawtooth", f0: 220, f1: 40, dur: 0.7, vol: 0.18 });
        noise({ dur: 0.4, vol: 0.1, freq: 500 });
      },
      bossSpawn() {
        blip({ type: "sawtooth", f0: 60, f1: 45, dur: 0.8, vol: 0.2 });
        blip({ type: "square", f0: 880, f1: 660, dur: 0.25, vol: 0.08, delay: 0.1 });
      },
    },
  };
}

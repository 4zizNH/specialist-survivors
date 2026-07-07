// engine/rng.js
// Deterministic RNG for ALL gameplay randomness — enemy spawns (position +
// type), weapon spread, crits, mine/burst angles, and the level-up draft.
// Same seed ⇒ identical run, which is what powers the headless balance sim
// (Prompt 19) and the seeded daily challenge (Prompt 20).
//
// Gameplay code calls rng() instead of Math.random(). By default rng() IS
// Math.random (normal play is unseeded and feels random); the sim/daily inject
// a seeded stream via seedRng()/setRng() before a run and clearRng() after.
//
// Cosmetic-only randomness — particles, screen shake, render flicker, audio
// noise, the gem-trail sparkle — deliberately stays on Math.random so it can
// never consume from (and desync) the gameplay stream, and so the sim, which
// skips all of it, produces identical numbers to a rendered run.

// mulberry32: tiny, fast, well-distributed 32-bit PRNG. Returns [0, 1).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Hash an arbitrary string/number into a 32-bit seed (e.g. a date for dailies).
export function hashSeed(input) {
  const s = String(input);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

let current = Math.random; // active generator (Math.random until seeded)

// The gameplay RNG. Use this instead of Math.random() in gameplay code.
export function rng() {
  return current();
}

// Point the gameplay RNG at a fresh deterministic stream (number or string).
export function seedRng(seed) {
  current = mulberry32(typeof seed === "number" ? seed : hashSeed(seed));
  return current;
}

// Inject an arbitrary generator (the sim supplies its own per run).
export function setRng(fn) {
  current = fn || Math.random;
}

// Back to nondeterministic Math.random (normal play).
export function clearRng() {
  current = Math.random;
}

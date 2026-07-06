// systems/difficulty.js
// Time-based difficulty curve, driven entirely by data/balance.js (ENEMY_SCALING
// + PACING). getDifficulty(t) returns the spawn/scaling knobs for the current
// run time; unlockedTypes(t) is the set of pool-spawnable archetypes so far.

import { ENEMY_LIST } from "../data/enemies.js";
import { ENEMY_SCALING as S, PACING } from "../data/balance.js";

export const BOSS_INTERVAL = PACING.miniBossEvery; // Warden cadence (s)
export const BOSS_AT = PACING.bossAt; // the Colossus arrives (s)

export function getDifficulty(t) {
  return {
    spawnInterval: clamp(
      S.spawnIntervalStart * Math.pow(0.5, t / S.spawnIntervalHalfLife),
      S.spawnIntervalMin,
      S.spawnIntervalStart
    ),
    spawnBatch: 1 + Math.floor(t / S.batchGrowthEvery),
    hpMult: 1 + t * S.hpGrowthPerSec,
    dmgMult: 1 + t * S.dmgGrowthPerSec,
    maxAlive: Math.min(S.maxAliveCap, Math.floor(S.maxAliveBase + t * S.maxAliveGrowthPerSec)),
  };
}

// Archetypes unlocked by time `t` — excludes bosses and split-children.
export function unlockedTypes(t) {
  return ENEMY_LIST.filter(
    (e) => !e.isBoss && !e.poolExclude && (PACING.unlocks[e.id] ?? Infinity) <= t
  );
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

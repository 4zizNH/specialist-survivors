// meta/progression.js
// Cross-run RPG progression (distinct from the run-local systems/xp.js):
//  - resolveCharacterStats: base stats + per-level growth -> effective stats
//  - characterXpToNext / awardRunXp: permanent character leveling from runs
//
// Character XP is earned from time survived. Stats are resolved fresh at the
// start of each run from the character's persisted level.

export function resolveCharacterStats(charDef, level) {
  const b = charDef.baseStats;
  const g = charDef.statGrowthPerLevel || {};
  const n = Math.max(0, level - 1);
  return {
    maxHp: Math.round(b.maxHp + (g.maxHp || 0) * n),
    moveSpeed: b.moveSpeed + (g.moveSpeed || 0) * n,
    might: b.might + (g.might || 0) * n,
    pickupRadius: b.pickupRadius + (g.pickupRadius || 0) * n,
    cooldown: b.cooldown + (g.cooldown || 0) * n,
  };
}

// XP needed to go from `level` to `level + 1`. Grows ~35%/level.
export function characterXpToNext(level) {
  return Math.floor(20 * Math.pow(1.35, level - 1)) + level * 10;
}

// Award XP for a finished run (based on time survived), leveling up as needed.
// Mutates `save` in place and returns a summary for the results screen.
export function awardRunXp(save, characterId, timeSurvivedSec) {
  const prog =
    save.characters[characterId] ||
    (save.characters[characterId] = { level: 1, xp: 0 });

  const levelBefore = prog.level;
  // Permanent character XP is a slow, many-run investment: a strong run is worth
  // roughly one level early on, tapering to well under a level per run later as
  // the (growing) thresholds outpace it. (Was ×2 — that gave ~4 levels/run.)
  const gained = Math.max(1, Math.floor(timeSurvivedSec * 0.5));
  prog.xp += gained;
  while (prog.xp >= characterXpToNext(prog.level)) {
    prog.xp -= characterXpToNext(prog.level);
    prog.level += 1;
  }

  save.meta.totalRuns = (save.meta.totalRuns || 0) + 1;
  if (timeSurvivedSec > (save.meta.bestTimeSec || 0)) {
    save.meta.bestTimeSec = timeSurvivedSec;
  }

  return {
    gained,
    levelBefore,
    levelAfter: prog.level,
    leveledUp: prog.level > levelBefore,
  };
}

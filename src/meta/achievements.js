// meta/achievements.js
// Achievement evaluation over the persistent save. The save carries a raw
// stats-tracking layer (save.stats — lifetime kills, boss kills, seconds
// survived, fusions, best time per specialization); everything else the
// achievement conditions need (collection breadth, evolutions discovered,
// character levels, runs) is DERIVED from the save at evaluation time so it
// can never drift out of sync.
//
// evaluateAchievements() runs at natural checkpoints (end of run, on fusion,
// on evolution, on in-run level-up, once at boot for migrated saves) — never
// per frame. Mid-run checkpoints pass a `live` delta ({ kills, bossKills,
// timeSec, spec }) so lifetime-style milestones can pop as toasts during play
// without double-counting: unlocks are recorded immediately, the raw stats are
// only banked at end of run, and the unlocked set makes re-awards impossible.

import { ACHIEVEMENTS, DEFAULT_UNLOCKED_CHARACTERS } from "../data/achievements.js";
import { EVOLUTIONS } from "../data/balance.js";
import { CHARACTERS_BY_ID } from "../data/characters.js";

export { ACHIEVEMENTS, DEFAULT_UNLOCKED_CHARACTERS };

// The derived view achievement conditions read.
export function statsView(save, live = null) {
  const st = save.stats || {};
  const inv = save.inventory || [];
  const raritiesOwned = {};
  for (const s of inv) raritiesOwned[s.rarity] = (raritiesOwned[s.rarity] || 0) + s.count;
  let maxCharLevel = 1;
  for (const c of Object.values(save.characters || {})) {
    if ((c.level || 1) > maxCharLevel) maxCharLevel = c.level;
  }

  let kills = st.kills || 0;
  let bossKills = st.bossKills || 0;
  let timeSec = st.timeSec || 0;
  const bestTimeBySpec = { ...(st.bestTimeBySpec || {}) };
  if (live) {
    kills += live.kills || 0;
    bossKills += live.bossKills || 0;
    timeSec += live.timeSec || 0;
    if (live.spec) {
      bestTimeBySpec[live.spec] = Math.max(bestTimeBySpec[live.spec] || 0, live.timeSec || 0);
    }
  }

  return {
    kills,
    bossKills,
    timeSec,
    bestTimeBySpec,
    runs: save.meta?.totalRuns || 0,
    bestTime: save.meta?.bestTimeSec || 0,
    fusions: st.fusions || 0,
    fusionsByTarget: st.fusionsByTarget || {},
    evolutionsSeen: (save.evolutionsSeen || []).length,
    evolutionsTotal: Object.keys(EVOLUTIONS).length,
    distinctStacks: inv.length,
    raritiesOwned,
    maxCharLevel,
  };
}

// Check every not-yet-unlocked achievement; record + apply rewards for the
// newly satisfied ones. Mutates the save (caller persists). Returns the newly
// unlocked defs (for toasts / the results screen).
export function evaluateAchievements(save, live = null) {
  const view = statsView(save, live);
  const unlocked = save.achievements.unlocked;
  const newly = [];
  for (const def of ACHIEVEMENTS) {
    if (unlocked.includes(def.id)) continue;
    const { cur, goal } = def.progress(view);
    if (goal > 0 && cur >= goal) {
      unlocked.push(def.id);
      applyReward(save, def);
      newly.push(def);
    }
  }
  return newly;
}

function applyReward(save, def) {
  const r = def.reward || {};
  if (r.gold) save.currency.gold = (save.currency.gold || 0) + r.gold;
  if (r.title && !save.titles.includes(r.title)) save.titles.push(r.title);
  if (r.characterId && !save.unlockedCharacters.includes(r.characterId)) {
    save.unlockedCharacters.push(r.characterId);
  }
}

// --- Reads for the UI ---

export function isAchievementUnlocked(save, id) {
  return save.achievements.unlocked.includes(id);
}

export function isCharacterUnlocked(save, characterId) {
  return save.unlockedCharacters.includes(characterId);
}

// The achievement that gates a character (null if never gated).
export function unlockAchievementFor(characterId) {
  return ACHIEVEMENTS.find((a) => a.reward?.characterId === characterId) || null;
}

// Everything Character Select needs to render a locked card: requirement text
// + live progress.
export function characterUnlockInfo(save, characterId) {
  const def = unlockAchievementFor(characterId);
  if (!def) return null;
  const { cur, goal } = def.progress(statsView(save));
  return { def, cur, goal, display: def.display || "count" };
}

// Human-readable reward summary ("+100 gold · title “Veteran” · unlocks Riven").
export function rewardText(def) {
  const r = def.reward || {};
  const parts = [];
  if (r.gold) parts.push(`+${r.gold} gold`);
  if (r.title) parts.push(`title “${r.title}”`);
  if (r.characterId) parts.push(`unlocks ${CHARACTERS_BY_ID[r.characterId]?.name ?? r.characterId}`);
  return parts.join(" · ");
}

// --- Stat recording (called from the checkpoints in main.js) ---

// Bank a finished run's raw numbers into the persistent stats layer.
export function recordRunStats(save, { time, kills, bossKills }, specialization) {
  const st = save.stats;
  st.kills += kills || 0;
  st.bossKills += bossKills || 0;
  st.timeSec += time || 0;
  if (specialization) {
    st.bestTimeBySpec[specialization] = Math.max(st.bestTimeBySpec[specialization] || 0, time || 0);
  }
}

// Bank a successful fusion (targetRarity = what was forged).
export function recordFusion(save, targetRarity) {
  const st = save.stats;
  st.fusions += 1;
  st.fusionsByTarget[targetRarity] = (st.fusionsByTarget[targetRarity] || 0) + 1;
}

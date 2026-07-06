// meta/rewards.js
// End-of-run rewards. grantRunRewards() converts a run's performance (time,
// kills, run level, boss kills) into: permanent character XP (via progression),
// soft currency (gold), and a chance at a tool drop whose rarity odds improve
// with performance. Mutates the save (caller persists) and returns a summary
// for the reward screen.

import { awardRunXp } from "./progression.js";
import { addTool } from "./inventory.js";
import { RARITY_ORDER } from "../data/rarities.js";
import { TOOL_BASE_LIST, makeTool } from "../data/tools.js";
import { CHARACTERS_BY_ID } from "../data/characters.js";
import { FUSION } from "../data/balance.js";

// A single 0..1-ish "performance score". ~0.2 for a quick 30s death, ~1.0 for a
// strong 5-minute run; boss kills push it further.
export function performanceScore({ time, kills, level, bossKills }) {
  const t = Math.min(1, time / 300); // 5 min caps the time part
  const k = Math.min(1, kills / 300);
  const l = Math.min(1, (level - 1) / 12);
  const b = Math.min(1, bossKills / 2);
  return t * 0.45 + k * 0.25 + l * 0.2 + b * 0.35; // can exceed 1 with bosses
}

export function goldReward(results) {
  return Math.max(
    1,
    Math.round(
      results.time * 0.6 + results.kills * 0.35 + (results.level - 1) * 4 + results.bossKills * 25
    )
  );
}

// Base rarity weights, shifted toward higher rarities as score grows.
// score 0  -> commons dominate; score ~1+ -> rare/epic likely, legendary real.
function rarityWeights(score) {
  const s = Math.max(0, Math.min(1.3, score));
  return {
    common: Math.max(5, 60 - s * 45),
    uncommon: 25 + s * 5,
    rare: 10 + s * 22,
    epic: 4 + s * 16,
    legendary: 1 + s * 8,
  };
}

export function rollRarity(score, rng = Math.random) {
  const w = rarityWeights(score);
  const total = RARITY_ORDER.reduce((sum, r) => sum + w[r], 0);
  let roll = rng() * total;
  for (const r of RARITY_ORDER) {
    roll -= w[r];
    if (roll <= 0) return r;
  }
  return "common";
}

// Drop chance: even a bad run has a shot; good runs approach certainty.
export function dropChance(score) {
  return Math.min(0.95, 0.25 + score * 0.6);
}

// Roll the (possible) tool drop. Returns a full tool or null. Drops are biased
// toward bases the player already OWNS (see FUSION.duplicateDropBias) so
// duplicates accumulate into fusable stacks instead of feeling like dead loot.
export function rollToolDrop(score, rng = Math.random, save = null) {
  if (rng() > dropChance(score)) return null;
  let base = TOOL_BASE_LIST[(rng() * TOOL_BASE_LIST.length) | 0];
  const ownedBases = save
    ? [...new Set((save.inventory || []).map((s) => s.baseId))]
    : [];
  if (ownedBases.length > 0 && rng() < FUSION.duplicateDropBias) {
    const pick = ownedBases[(rng() * ownedBases.length) | 0];
    base = TOOL_BASE_LIST.find((b) => b.baseId === pick) || base;
  }
  const rarity = rollRarity(score, rng);
  return makeTool(base.baseId, rarity);
}

// The full end-of-run grant. Mutates `save`; returns the reward summary.
export function grantRunRewards(save, characterId, results, rng = Math.random) {
  const score = performanceScore(results);
  const characterXp = awardRunXp(save, characterId, results.time); // also bumps meta.totalRuns/bestTime

  // Scrapper-style passives multiply gold earned.
  const goldMult = CHARACTERS_BY_ID[characterId]?.passive?.goldMult ?? 1;
  const gold = Math.round(goldReward(results) * goldMult);
  save.currency.gold = (save.currency.gold || 0) + gold;

  // Lucky Charm (shop): each level nudges drop chance + rarity odds upward.
  const luck = (save.shop && save.shop.lucky_drops) || 0;
  const droppedTool = rollToolDrop(score + luck * 0.12, rng, save);
  if (droppedTool) {
    addTool(save, droppedTool.baseId, droppedTool.rarity, 1);
  }

  return { score, characterXp, gold, droppedTool };
}

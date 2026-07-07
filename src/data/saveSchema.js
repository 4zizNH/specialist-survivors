// data/saveSchema.js
// Shape of the persisted profile plus a factory for a fresh one. Persisted as
// JSON in localStorage by meta/saveManager.js. `version` lets us migrate the
// shape without wiping progress.
//
// v6: inventory is stored as STACKS — [{ baseId, rarity, count }] — so
// duplicates are first-class (they feed the fusion system). A stack's tool id
// is `${baseId}_${rarity}`; loadouts reference those stack ids.
// v7: adds `evolutionsSeen` — base tool ids whose evolution has been witnessed
// in a run; the Collection shows those recipes as discovered lore entries.
// v8: adds the achievements layer — `stats` (lifetime tracking), `achievements`
// (unlocked ids), `unlockedCharacters` (the roster gate; only the defaults
// start unlocked), and `titles` (cosmetic).
// v9: adds the Daily Challenge — `daily` ({ attempts by date, imported friend
// entries by date }) + a `profileName` for the local leaderboard.

import { CHARACTERS_LIST } from "./characters.js";
import { DEFAULT_UNLOCKED_CHARACTERS } from "./achievements.js";

export const SAVE_VERSION = 9;
export const SAVE_KEY = "specialist-survivors:save";

// Starter collection. Flame Saber ×3 is deliberately fusable out of the box,
// and the legendary Rune Orb demonstrates the rarity cap on the fusion screen.
const STARTER_STACKS = [
  ["flame_saber", "common", 3],
  ["whirl_blades", "rare", 1],
  ["scatter_gun", "common", 2],
  ["hand_cannon", "epic", 1],
  ["arc_bolt", "common", 2],
  ["rune_orb", "legendary", 1],
  ["thorn_ring", "common", 1],
  ["seed_shot", "rare", 1],
];

export function createDefaultSave() {
  const characters = {};
  for (const c of CHARACTERS_LIST) {
    characters[c.id] = { level: 1, xp: 0 };
  }

  const inventory = STARTER_STACKS.map(([baseId, rarity, count]) => ({
    baseId,
    rarity,
    count,
  }));

  // Equip each character a compatible starter stack so runs always have a
  // weapon. Category lookup avoids importing tools.js (keeps this module leaf).
  const STARTER_CATEGORY = {
    flame_saber: "blades",
    whirl_blades: "blades",
    scatter_gun: "guns",
    hand_cannon: "guns",
    arc_bolt: "arcane",
    rune_orb: "arcane",
    thorn_ring: "nature",
    seed_shot: "nature",
  };
  const loadouts = {};
  for (const c of CHARACTERS_LIST) {
    const match = inventory.find(
      (s) => STARTER_CATEGORY[s.baseId] === c.specialization
    );
    loadouts[c.id] = match ? [`${match.baseId}_${match.rarity}`] : [];
  }

  return {
    version: SAVE_VERSION,
    characters, // id -> { level, xp } (persistent)
    inventory, // tool stacks [{ baseId, rarity, count }]
    loadouts, // characterId -> [stackId] where stackId = `${baseId}_${rarity}`
    currency: { gold: 0 },
    evolutionsSeen: [], // base tool ids with a witnessed evolution (lore unlock)
    // Lifetime stats layer read by achievement conditions (meta/achievements).
    stats: { kills: 0, bossKills: 0, timeSec: 0, fusions: 0, fusionsByTarget: {}, bestTimeBySpec: {} },
    achievements: { unlocked: [] }, // achievement ids earned
    unlockedCharacters: [...DEFAULT_UNLOCKED_CHARACTERS], // the roster gate
    titles: [], // cosmetic titles from achievements
    shop: { extra_slot: 0, global_might: 0, lucky_drops: 0 },
    settings: { masterVolume: 1 },
    lastSelectedCharacterId: CHARACTERS_LIST[0].id,
    meta: { totalRuns: 0, bestTimeSec: 0 },
    profileName: "You", // shown on the local daily leaderboard
    daily: {
      // date -> { status: "in_progress"|"done"|"dnf", seed, score, breakdown, timeSec }
      attempts: {},
      // date -> [{ name, score, seed, imported: true }]  (friend share codes)
      imported: {},
    },
  };
}

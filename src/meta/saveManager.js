// meta/saveManager.js
// Load/save the profile to localStorage behind a small interface. Robust to
// missing/corrupt data and forward-compatible: loading always returns a
// well-formed save (missing fields and newly-added roster characters are
// backfilled from the default).

import { SAVE_KEY, SAVE_VERSION, createDefaultSave } from "../data/saveSchema.js";
import { CHARACTERS_LIST } from "../data/characters.js";

function storage() {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

export function loadSave() {
  const store = storage();
  if (!store) return createDefaultSave();
  try {
    const raw = store.getItem(SAVE_KEY);
    if (!raw) return createDefaultSave();
    return normalize(JSON.parse(raw));
  } catch {
    return createDefaultSave();
  }
}

export function writeSave(save) {
  const store = storage();
  if (!store) return false;
  try {
    store.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

// Wipe all progress: mutate the live save object back to a fresh default (so
// every module holding a reference sees the reset) and persist it.
export function resetSave(save) {
  const fresh = createDefaultSave();
  for (const k of Object.keys(save)) delete save[k];
  Object.assign(save, fresh);
  writeSave(save);
  return save;
}

export function clearSave() {
  const store = storage();
  if (store) {
    try {
      store.removeItem(SAVE_KEY);
    } catch {
      /* ignore */
    }
  }
}

// Merge a loaded save onto a fresh default so the shape is always complete.
function normalize(loaded) {
  const base = createDefaultSave();
  if (!loaded || typeof loaded !== "object") return base;

  // v5 → v6: the inventory moved from per-instance entries ({id, baseId,
  // rarity}) to stacks ({baseId, rarity, count}), and loadouts now reference
  // stack ids (`${baseId}_${rarity}`). Migrate both, preserving everything.
  let inventory = base.inventory;
  let loadouts = { ...base.loadouts, ...(loaded.loadouts || {}) };
  if (Array.isArray(loaded.inventory)) {
    const looksStacked =
      loaded.inventory.length === 0 ||
      typeof loaded.inventory[0]?.count === "number";
    if (looksStacked) {
      inventory = loaded.inventory
        .filter((s) => s && s.baseId && s.rarity)
        .map((s) => ({ baseId: s.baseId, rarity: s.rarity, count: Math.max(1, s.count | 0) }));
    } else {
      // Group old instances into stacks and remember old-id → stack-id.
      const stacks = new Map();
      const idMap = new Map();
      for (const it of loaded.inventory) {
        if (!it || !it.baseId || !it.rarity) continue;
        const key = `${it.baseId}_${it.rarity}`;
        stacks.set(key, (stacks.get(key) || 0) + 1);
        if (it.id) idMap.set(it.id, key);
      }
      inventory = [...stacks.entries()].map(([key, count]) => {
        const idx = key.lastIndexOf("_");
        return { baseId: key.slice(0, idx), rarity: key.slice(idx + 1), count };
      });
      // Remap loadout ids (old unique ids → stack ids), dropping unknowns.
      for (const cid of Object.keys(loadouts)) {
        loadouts[cid] = (loadouts[cid] || [])
          .map((id) => idMap.get(id) || (stacks.has(id) ? id : null))
          .filter(Boolean);
      }
    }
  }

  const merged = {
    ...base,
    ...loaded,
    version: SAVE_VERSION,
    characters: { ...base.characters, ...(loaded.characters || {}) },
    meta: { ...base.meta, ...(loaded.meta || {}) },
    inventory,
    loadouts,
    currency: { ...base.currency, ...(loaded.currency || {}) },
    evolutionsSeen: Array.isArray(loaded.evolutionsSeen)
      ? loaded.evolutionsSeen.filter((id) => typeof id === "string")
      : [],
    stats: {
      ...base.stats,
      ...(loaded.stats || {}),
      fusionsByTarget: { ...(loaded.stats?.fusionsByTarget || {}) },
      bestTimeBySpec: { ...(loaded.stats?.bestTimeBySpec || {}) },
    },
    achievements: {
      unlocked: Array.isArray(loaded.achievements?.unlocked)
        ? loaded.achievements.unlocked.filter((id) => typeof id === "string")
        : [],
    },
    titles: Array.isArray(loaded.titles)
      ? loaded.titles.filter((t) => typeof t === "string")
      : [],
    shop: { ...base.shop, ...(loaded.shop || {}) },
    settings: { ...base.settings, ...(loaded.settings || {}) },
  };

  // v7 → v8 (achievements): pre-v8 saves have no roster gate. Migrate
  // gracefully — unlock the defaults plus any character the player has clearly
  // already played (level ≥ 2); seed total time survived with their best time
  // (the one number we know is a lower bound). Achievements their stats
  // already satisfy are granted by the boot-time evaluate in main.js.
  if (Array.isArray(loaded.unlockedCharacters)) {
    merged.unlockedCharacters = [
      ...new Set([
        ...base.unlockedCharacters, // defaults can never be lost
        ...loaded.unlockedCharacters.filter((id) => typeof id === "string"),
      ]),
    ];
  } else {
    merged.unlockedCharacters = [...base.unlockedCharacters];
    for (const c of CHARACTERS_LIST) {
      const p = loaded.characters?.[c.id];
      if (p && (p.level || 1) >= 2 && !merged.unlockedCharacters.includes(c.id)) {
        merged.unlockedCharacters.push(c.id);
      }
    }
    if (!loaded.stats) {
      merged.stats.timeSec = Math.max(merged.stats.timeSec, merged.meta.bestTimeSec || 0);
    }
  }

  // Ensure every roster character has a valid progress entry + loadout array.
  for (const c of CHARACTERS_LIST) {
    const p = merged.characters[c.id];
    if (!p || typeof p.level !== "number") {
      merged.characters[c.id] = { level: 1, xp: 0 };
    }
    if (!Array.isArray(merged.loadouts[c.id])) {
      merged.loadouts[c.id] = [];
    }
  }
  return merged;
}

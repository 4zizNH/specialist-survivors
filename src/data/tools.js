// data/tools.js
// Tools are collectible weapons. Each has a `category` that MUST match a
// character's `specialization` to be equippable (the core RPG rule), a rarity,
// and a `weaponDef` (the data-driven weapon from the weapon system). Rarity
// multipliers scale the base weapon stats.
//
// A TOOL_BASE is a template; makeTool() stamps out an owned instance at a given
// rarity. resolveToolWeaponDef() produces the effective weapon fed into a run.

import { RARITIES } from "./rarities.js";
import { TOOL_STATS } from "./balance.js";

export const TOOL_CATEGORIES = ["blades", "guns", "arcane", "nature"];

// Base templates, built from the balance table (data/balance.js) so every
// tool's numbers are tunable in one place. weaponDef uses the Prompt-4 weapon
// shape (fireBehavior + stats).
export const TOOL_BASES = {};
for (const [baseId, def] of Object.entries(TOOL_STATS)) {
  TOOL_BASES[baseId] = {
    baseId,
    name: def.name,
    category: def.category,
    weaponDef: def.weapon,
  };
}

export const TOOL_BASE_LIST = Object.values(TOOL_BASES);

// Build a full owned-tool instance from a base id + rarity.
export function makeTool(baseId, rarity, instanceId) {
  const base = TOOL_BASES[baseId];
  if (!base) return null;
  const rar = RARITIES[rarity] || RARITIES.common;
  return {
    id: instanceId || `${baseId}_${rar.id}`,
    baseId,
    name: base.name,
    category: base.category,
    rarity: rar.id,
    weaponDef: base.weaponDef,
    rarityMultipliers: { ...rar.mult },
  };
}

// Reconstruct a full tool from the minimal stored form { id, baseId, rarity }.
export function resolveTool(stored) {
  return makeTool(stored.baseId, stored.rarity, stored.id);
}

// Effective weapon stats fed to the weapon system: base × rarity multipliers.
export function resolveToolWeaponDef(tool) {
  const base = tool.weaponDef;
  const m = tool.rarityMultipliers || {};
  return {
    ...base,
    id: tool.baseId,
    name: tool.name,
    rarity: tool.rarity, // UI pass-through (HUD icons); combat ignores it
    damage: round2(base.damage * (m.damage ?? 1)),
    cooldown: round3(base.cooldown * (m.cooldown ?? 1)),
    area: round2(base.area * (m.area ?? 1)),
  };
}

function round2(v) {
  return Math.round(v * 100) / 100;
}
function round3(v) {
  return Math.round(v * 1000) / 1000;
}

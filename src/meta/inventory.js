// meta/inventory.js
// Owned-tool STACKS + loadout logic operating on the save profile, and the core
// rule: a tool can only be equipped by a character whose specialization matches
// the tool's category.
//
// The inventory stores stacks: { baseId, rarity, count }. A stack's tool id is
// `${baseId}_${rarity}` (what makeTool produces by default); loadouts reference
// those ids. Equipping is per-stack — owning more copies feeds fusion, not
// extra equips.

import { makeTool, resolveToolWeaponDef } from "../data/tools.js";
import { CHARACTERS_BY_ID, SPECIALIZATIONS } from "../data/characters.js";

export const BASE_EQUIP_SLOTS = 1; // before shop upgrades

export function stackId(baseId, rarity) {
  return `${baseId}_${rarity}`;
}

// Tools a character can equip — grows with the Tool Harness shop upgrade.
export function getEquipSlots(save) {
  return BASE_EQUIP_SLOTS + ((save && save.shop && save.shop.extra_slot) || 0);
}

// --- The rule ---
export function canEquip(character, tool) {
  return !!character && !!tool && character.specialization === tool.category;
}

// Human-readable reason a tool is locked for a character (null if equippable).
export function equipReason(character, tool) {
  if (canEquip(character, tool)) return null;
  const label = (SPECIALIZATIONS[tool.category] || { label: tool.category }).label;
  return `Requires a ${label} specialist`;
}

// --- Stack reads ---
// Resolved tools (id = stackId), each carrying its stack `count`.
export function getOwnedTools(save) {
  return (save.inventory || [])
    .map((s) => {
      const t = makeTool(s.baseId, s.rarity);
      if (!t) return null;
      t.count = s.count;
      return t;
    })
    .filter(Boolean);
}

export function getStack(save, baseId, rarity) {
  return (save.inventory || []).find((s) => s.baseId === baseId && s.rarity === rarity) || null;
}

// --- Stack mutations (caller persists via writeSave) ---
export function addTool(save, baseId, rarity, n = 1) {
  const s = getStack(save, baseId, rarity);
  if (s) s.count += n;
  else save.inventory.push({ baseId, rarity, count: n });
}

// Remove n copies; deletes the stack when it empties. Returns true if the
// stack still exists afterwards.
export function removeTool(save, baseId, rarity, n = 1) {
  const s = getStack(save, baseId, rarity);
  if (!s) return false;
  s.count -= n;
  if (s.count <= 0) {
    save.inventory = save.inventory.filter((x) => x !== s);
    return false;
  }
  return true;
}

// --- Loadouts ---
export function getLoadout(save, charId) {
  return (save.loadouts && save.loadouts[charId]) || [];
}

export function isEquipped(save, charId, toolId) {
  return getLoadout(save, charId).includes(toolId);
}

// Characters (ids) that have this stack equipped.
export function equippedBy(save, toolId) {
  return Object.keys(save.loadouts || {}).filter((cid) =>
    save.loadouts[cid].includes(toolId)
  );
}

export function unequipEverywhere(save, toolId) {
  const affected = equippedBy(save, toolId);
  for (const cid of affected) {
    save.loadouts[cid] = save.loadouts[cid].filter((id) => id !== toolId);
  }
  return affected;
}

// Equip a tool to a character. Enforces the rule + the (shop-upgradable) slot
// count; when full, equipping replaces the oldest tool. Returns { ok, reason }.
export function equipTool(save, charId, tool) {
  const character = CHARACTERS_BY_ID[charId];
  if (!character) return { ok: false, reason: "Unknown character" };
  if (!canEquip(character, tool)) {
    return { ok: false, reason: equipReason(character, tool) };
  }
  const slots = getEquipSlots(save);
  let loadout = getLoadout(save, charId).slice();
  if (loadout.includes(tool.id)) return { ok: true, reason: null };
  while (loadout.length >= slots) loadout.shift(); // free the oldest slot
  loadout.push(tool.id);
  save.loadouts[charId] = loadout;
  return { ok: true, reason: null };
}

export function unequipTool(save, charId, toolId) {
  save.loadouts[charId] = getLoadout(save, charId).filter((id) => id !== toolId);
}

// Resolve a character's equipped loadout into weapon defs for the run.
export function resolveRunWeaponDefs(save, charId) {
  const owned = new Map(getOwnedTools(save).map((t) => [t.id, t]));
  return getLoadout(save, charId)
    .map((id) => owned.get(id))
    .filter(Boolean)
    .map(resolveToolWeaponDef);
}

// meta/fusion.js
// Tool fusion: consume N copies of the same base at the same rarity to forge 1
// copy at the next rarity (Legendary is the cap). Costs gold per target rarity.
// All the tunables live in data/balance.js (FUSION).
//
// Equipped-material policy (consistent everywhere): a stack CAN be fused while
// equipped; if the fusion empties the stack, the confirm dialog warns and the
// fusion unequips it from every character.

import { FUSION } from "../data/balance.js";
import { RARITY_ORDER } from "../data/rarities.js";
import { makeTool } from "../data/tools.js";
import {
  getStack,
  addTool,
  removeTool,
  stackId,
  equippedBy,
  unequipEverywhere,
} from "./inventory.js";

export function nextRarity(rarity) {
  const i = RARITY_ORDER.indexOf(rarity);
  return i >= 0 && i < RARITY_ORDER.length - 1 ? RARITY_ORDER[i + 1] : null;
}

export function copiesNeeded(rarity) {
  return FUSION.copiesNeeded[rarity] ?? 3;
}

export function fusionCost(targetRarity) {
  return FUSION.goldCost[targetRarity] ?? 0;
}

// Everything the UI needs to render a stack's fusion status.
export function fusionInfo(save, baseId, rarity) {
  const stack = getStack(save, baseId, rarity);
  const have = stack ? stack.count : 0;
  const target = nextRarity(rarity);
  if (!target) {
    return { fusable: false, reason: "MAX RARITY — cannot be fused further", have, needed: null, cost: null, target: null, wouldUnequip: [] };
  }
  const needed = copiesNeeded(rarity);
  const cost = fusionCost(target);
  const gold = (save.currency && save.currency.gold) || 0;
  let reason = null;
  if (have < needed) reason = `Need ${needed - have} more cop${needed - have === 1 ? "y" : "ies"}`;
  else if (gold < cost) reason = `Costs ◆${cost} — you have ◆${gold}`;
  // Fusing exactly `needed` copies empties the stack → any equips get removed.
  const wouldUnequip =
    !reason && have === needed ? equippedBy(save, stackId(baseId, rarity)) : [];
  return { fusable: !reason, reason, have, needed, cost, target, wouldUnequip };
}

// Perform the fusion. Mutates the save (caller persists).
// Returns { ok, reason, result, unequipped }.
export function fuse(save, baseId, rarity) {
  const info = fusionInfo(save, baseId, rarity);
  if (!info.fusable) return { ok: false, reason: info.reason, result: null, unequipped: [] };

  const stillExists = removeTool(save, baseId, rarity, info.needed);
  save.currency.gold -= info.cost;
  addTool(save, baseId, info.target, 1);

  // Consistent policy: emptied + equipped → unequip everywhere.
  const unequipped = stillExists ? [] : unequipEverywhere(save, stackId(baseId, rarity));

  return { ok: true, reason: null, result: makeTool(baseId, info.target), unequipped };
}

// data/rarities.js
// The 5 rarities: identity (labels/colors/order) lives here; the stat
// multipliers are tuned in data/balance.js. These colors are the single source
// of truth — every UI that shows a tool tints by rarity using rarityColor().

import { RARITY_MULTIPLIERS } from "./balance.js";

export const RARITIES = {
  common: { id: "common", label: "Common", color: "#b8c0cc", order: 0, mult: RARITY_MULTIPLIERS.common },
  uncommon: { id: "uncommon", label: "Uncommon", color: "#5fd66f", order: 1, mult: RARITY_MULTIPLIERS.uncommon },
  rare: { id: "rare", label: "Rare", color: "#5aa9ff", order: 2, mult: RARITY_MULTIPLIERS.rare },
  epic: { id: "epic", label: "Epic", color: "#b06bff", order: 3, mult: RARITY_MULTIPLIERS.epic },
  legendary: { id: "legendary", label: "Legendary", color: "#ffb03a", order: 4, mult: RARITY_MULTIPLIERS.legendary },
};

export const RARITY_ORDER = ["common", "uncommon", "rare", "epic", "legendary"];

export function rarityColor(rarity) {
  return (RARITIES[rarity] || RARITIES.common).color;
}

// data/shop.js
// The meta-shop: permanent, account-wide upgrades bought with gold. Levels are
// stored in save.shop (persisted); effects are applied where they matter:
//   extra_slot   → meta/inventory.js getEquipSlots()
//   global_might → main.js startRun (multiplies player.might)
//   lucky_drops  → meta/rewards.js (boosts drop chance + rarity odds)

export const SHOP_UPGRADES = [
  {
    id: "extra_slot",
    name: "Tool Harness",
    desc: "+1 equip slot for every character",
    max: 2,
    cost: (lvl) => [150, 400][lvl],
    effectText: (lvl) => `${1 + lvl} slot${lvl > 0 ? "s" : ""}`,
  },
  {
    id: "global_might",
    name: "Whetstone",
    desc: "+5% damage for all characters, per level",
    max: 5,
    cost: (lvl) => Math.round(60 * Math.pow(1.7, lvl)),
    effectText: (lvl) => `+${5 * lvl}% damage`,
  },
  {
    id: "lucky_drops",
    name: "Lucky Charm",
    desc: "Better tool-drop chance and rarity odds, per level",
    max: 5,
    cost: (lvl) => Math.round(80 * Math.pow(1.7, lvl)),
    effectText: (lvl) => (lvl > 0 ? `+${lvl} luck` : "no bonus"),
  },
];

export function getShopLevel(save, id) {
  return (save.shop && save.shop[id]) || 0;
}

// Attempt a purchase. Mutates the save (caller persists). Returns {ok, reason}.
export function buyUpgrade(save, id) {
  const def = SHOP_UPGRADES.find((u) => u.id === id);
  if (!def) return { ok: false, reason: "Unknown upgrade" };
  const lvl = getShopLevel(save, id);
  if (lvl >= def.max) return { ok: false, reason: "Already maxed" };
  const price = def.cost(lvl);
  if ((save.currency.gold || 0) < price) return { ok: false, reason: "Not enough gold" };
  save.currency.gold -= price;
  if (!save.shop) save.shop = {};
  save.shop[id] = lvl + 1;
  return { ok: true, reason: null };
}

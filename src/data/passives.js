// data/passives.js
// Passive items — a pickable category in the level-up draft. Each grants a
// permanent (for the run) stat boost via apply(player), and some double as the
// catalyst for a weapon evolution (see EVOLUTIONS in data/balance.js).
// The player holds at most MAX_PASSIVES; owned ids live in player.passiveItems.

export const MAX_PASSIVES = 4;

export const PASSIVES = {
  whetstone: {
    id: "whetstone",
    name: "Whetstone",
    short: "+20% damage",
    color: "#ffb03a",
    apply(p) {
      p.might *= 1.2;
    },
  },
  focus_crystal: {
    id: "focus_crystal",
    name: "Focus Crystal",
    short: "-12% weapon cooldowns",
    color: "#5ad1ff",
    apply(p) {
      p.cooldownMult *= 0.88;
    },
  },
  storm_core: {
    id: "storm_core",
    name: "Storm Core",
    short: "+15% crit chance",
    color: "#b06bff",
    apply(p) {
      p.critChance += 0.15;
    },
  },
  growth_charm: {
    id: "growth_charm",
    name: "Growth Charm",
    short: "+25% XP gain",
    color: "#74f0a0",
    apply(p) {
      p.xpMult *= 1.25;
    },
  },
  iron_pendant: {
    id: "iron_pendant",
    name: "Iron Pendant",
    short: "+40 max HP",
    color: "#c0c8d8",
    apply(p) {
      p.maxHp += 40;
      p.hp += 40;
    },
  },
  swift_boots: {
    id: "swift_boots",
    name: "Swift Boots",
    short: "+12% move speed",
    color: "#ffd34d",
    apply(p) {
      p.speed = Math.round(p.speed * 1.12);
    },
  },
};

export const PASSIVE_LIST = Object.values(PASSIVES);

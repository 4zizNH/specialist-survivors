// data/characters.js
// The playable roster — six specialists across the four tool categories, each
// with a PASSIVE that changes how they play (not just different numbers).
// Persistent level lives in the save profile, not here.
//
// Stat convention: maxHp is ABSOLUTE; moveSpeed / might / pickupRadius / cooldown
// are MULTIPLIERS where 1.0 = baseline. `might` scales damage; `cooldown` < 1
// means faster weapons.
//
// Passive hooks (applied to the run player in main.startRun / meta/rewards):
//   onKillHeal       heal N HP per kill
//   lowHpSpeedBoost  +X% move speed while below 50% HP
//   critChance       chance for any hit to deal double damage
//   goldMult         multiplies end-of-run gold
//   xpMult           multiplies XP collected from gems
//   regen            overrides passive HP regen (hp/sec)

export const CHARACTERS = {
  ember_knight: {
    id: "ember_knight",
    name: "Ember Knight",
    specialization: "blades",
    baseStats: { maxHp: 112, moveSpeed: 0.95, might: 1.08, pickupRadius: 1.0, cooldown: 1.0 },
    statGrowthPerLevel: { maxHp: 10, might: 0.03 },
    passive: { id: "bloodlust", name: "Bloodlust", desc: "Heal 1 HP per kill", onKillHeal: 1 },
    startingToolId: null,
    color: "#ff7a5a",
    blurb: "Durable blade fighter who feeds on the carnage.",
  },
  riven: {
    id: "riven",
    name: "Riven",
    specialization: "blades",
    baseStats: { maxHp: 90, moveSpeed: 1.15, might: 1.0, pickupRadius: 1.0, cooldown: 0.9 },
    statGrowthPerLevel: { maxHp: 6, might: 0.025 },
    passive: { id: "adrenaline", name: "Adrenaline", desc: "+25% move speed below half HP", lowHpSpeedBoost: 0.25 },
    startingToolId: null,
    color: "#ff5a8a",
    blurb: "Reckless duelist who gets faster as the wounds pile up.",
  },
  deadeye: {
    id: "deadeye",
    name: "Deadeye",
    specialization: "guns",
    baseStats: { maxHp: 85, moveSpeed: 1.1, might: 1.0, pickupRadius: 1.0, cooldown: 0.82 },
    statGrowthPerLevel: { maxHp: 6, might: 0.02 },
    passive: { id: "deadshot", name: "Deadshot", desc: "15% chance to deal double damage", critChance: 0.15 },
    startingToolId: null,
    color: "#f0c850",
    blurb: "Fast gunslinger whose shots sometimes hit twice as hard.",
  },
  junker: {
    id: "junker",
    name: "Junker",
    specialization: "guns",
    baseStats: { maxHp: 118, moveSpeed: 0.9, might: 0.97, pickupRadius: 1.25, cooldown: 1.0 },
    statGrowthPerLevel: { maxHp: 9, might: 0.022 },
    passive: { id: "scrapper", name: "Scrapper", desc: "+35% gold from runs", goldMult: 1.35 },
    startingToolId: null,
    color: "#c8925a",
    blurb: "Slow, sturdy scavenger who strips every run for parts.",
  },
  arcanist: {
    id: "arcanist",
    name: "Arcanist",
    specialization: "arcane",
    baseStats: { maxHp: 76, moveSpeed: 0.95, might: 1.3, pickupRadius: 1.15, cooldown: 1.05 },
    statGrowthPerLevel: { maxHp: 5, might: 0.045 },
    passive: { id: "resonance", name: "Resonance", desc: "+30% XP from gems", xpMult: 1.3 },
    startingToolId: null,
    color: "#a97bff",
    blurb: "Glass cannon who levels faster than anyone alive.",
  },
  thornweaver: {
    id: "thornweaver",
    name: "Thornweaver",
    specialization: "nature",
    baseStats: { maxHp: 100, moveSpeed: 1.0, might: 0.95, pickupRadius: 1.4, cooldown: 0.95 },
    statGrowthPerLevel: { maxHp: 8, might: 0.025 },
    passive: { id: "overgrowth", name: "Overgrowth", desc: "Regenerates 2 HP per second", regen: 2.0 },
    startingToolId: null,
    color: "#6ad89a",
    blurb: "Patient naturalist who outlasts what she can't outrun.",
  },
};

export const CHARACTERS_LIST = Object.values(CHARACTERS);
export const CHARACTERS_BY_ID = CHARACTERS;

// Specialization metadata (labels + colors) for UI and the equip gate.
export const SPECIALIZATIONS = {
  blades: { label: "Blades", color: "#ff7a5a" },
  guns: { label: "Guns", color: "#f0c850" },
  arcane: { label: "Arcane", color: "#a97bff" },
  nature: { label: "Nature", color: "#6ad89a" },
};

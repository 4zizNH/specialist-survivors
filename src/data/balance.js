// data/balance.js
// THE tuning surface. Tool stats, rarity multipliers, enemy scaling, and run
// pacing all live here so numbers can be tuned in one place.
//
// ── RUN TIMELINE (what unlocks when) ─────────────────────────────────────────
//  0:00  grunts only — learn to move
//  0:25  runners — first pressure to kite
//  1:00  brutes — walls of HP appear
//  2:00  swarmlings — density spikes
//  2:30  first WARDEN mini-boss (repeats every 2:30)
//  3:30  spitters — ranged fire forces repositioning
//  5:00  blobmothers — splitters flood the field on death
// 10:00  THE COLOSSUS — real boss, two phases (enrages below 50% HP)
// 10:00+ everything keeps scaling toward the population cap (~15:00 plateau)

// ── Tool fusion (combine duplicates → next rarity) ───────────────────────────
export const FUSION = {
  // Copies consumed per fusion, keyed by SOURCE rarity.
  copiesNeeded: { common: 3, uncommon: 3, rare: 3, epic: 3 },
  // Gold cost per fusion, keyed by TARGET rarity.
  goldCost: { uncommon: 20, rare: 50, epic: 120, legendary: 300 },
  // End-of-run drops favor bases you already own, so duplicates read as
  // fusion progress instead of dead loot.
  duplicateDropBias: 0.65,
};

// ── Rarity multipliers (applied on top of a tool's base weapon stats) ────────
export const RARITY_MULTIPLIERS = {
  common: { damage: 1.0, cooldown: 1.0, area: 1.0 },
  uncommon: { damage: 1.15, cooldown: 0.97, area: 1.05 },
  rare: { damage: 1.35, cooldown: 0.93, area: 1.12 },
  epic: { damage: 1.6, cooldown: 0.88, area: 1.2 },
  legendary: { damage: 2.0, cooldown: 0.82, area: 1.32 },
};

// ── In-run XP curve (levels within a run) ────────────────────────────────────
// threshold(lv) = floor(base × growth^(lv-1)) + (lv-1) × linear
// Tuned so the first level takes ~3 kills and the draft cadence doesn't
// interrupt combat every few seconds in the opening minute.
export const XP_CURVE = { base: 12, growth: 1.42, linear: 4 };

// ── Enemy scaling over run time (seconds) ────────────────────────────────────
export const ENEMY_SCALING = {
  hpGrowthPerSec: 1 / 70, // +100% HP per ~70s (softened so builds keep pace)
  dmgGrowthPerSec: 1 / 150, // +100% damage per 2.5 min
  spawnIntervalStart: 0.7, // s between spawn ticks at t=0 (gentle opening)
  spawnIntervalHalfLife: 120, // halves every 2 min...
  spawnIntervalMin: 0.07, // ...down to this floor
  batchGrowthEvery: 90, // +1 enemy per spawn tick every 90s
  maxAliveBase: 200,
  maxAliveGrowthPerSec: 1.5,
  maxAliveCap: 800,
};

// ── Pacing: unlock times (s) + boss schedule ─────────────────────────────────
export const PACING = {
  unlocks: {
    grunt: 0,
    runner: 35, // pushed back — the opening minute stays learnable
    brute: 60,
    swarmling: 120,
    spitter: 210,
    blobmother: 300,
  },
  miniBossEvery: 150, // Warden cadence
  bossAt: 600, // the Colossus arrives at 10:00
};

// ── Weapon evolutions (max in-run level + matching passive → transformation) ─
// Keyed by the BASE tool id. When that tool is at max in-run level AND the
// player holds `requiresPassiveId`, the next elite/boss kill drops an evolution
// chest; opening it swaps the weapon for `weapon` (an evolved def) for the rest
// of the run. Evolved forms are mechanically distinct: burn DoT, impact
// explosions, pulsing orbits, thorn novas — not just bigger numbers.
// One evolution per specialization category so every character has a chase.
export const EVOLUTIONS = {
  // BLADES — Flame Saber + Whetstone. Infinite pierce + burning damage-over-time.
  flame_saber: {
    requiresPassiveId: "whetstone",
    evolvedName: "Inferno Edge",
    desc: "A fan of unstoppable flame blades that set everything they touch ablaze.",
    weapon: { fireBehavior: "nearestEnemy", damage: 30, cooldown: 0.42, projectileSpeed: 540, count: 3, area: 15, pierce: -1, lifetime: 1.4, maxLevel: 8, color: "#ff4a1a", burnDps: 14, burnDuration: 3 },
  },
  // GUNS — Hand Cannon + Focus Crystal. Shells detonate on impact.
  hand_cannon: {
    requiresPassiveId: "focus_crystal",
    evolvedName: "Siege Breaker",
    desc: "Twin siege shells that detonate on impact, blasting everything nearby.",
    weapon: { fireBehavior: "nearestEnemy", damage: 62, cooldown: 0.8, projectileSpeed: 580, count: 2, area: 10, pierce: 0, lifetime: 1.4, maxLevel: 8, color: "#ffb02a", explodeRadius: 78, explodeDamageMult: 0.8 },
  },
  // ARCANE — Rune Orb + Storm Core. Orbit radius pulses in and out, sweeping the field.
  rune_orb: {
    requiresPassiveId: "storm_core",
    evolvedName: "Maelstrom Halo",
    desc: "A storm of six orbs that sweep in and out, scouring the whole field.",
    weapon: { fireBehavior: "aroundPlayer", damage: 26, cooldown: 2.6, count: 6, area: 16, pierce: -1, lifetime: 2.6, reHitInterval: 0.25, orbitRadius: 115, orbitSpeed: 4.2, orbitPulseAmp: 72, orbitPulseFreq: 2.4, maxLevel: 8, color: "#8a5aff" },
  },
  // NATURE — Thorn Ring + Growth Charm. Aura + periodic radial thorn novas.
  thorn_ring: {
    requiresPassiveId: "growth_charm",
    evolvedName: "Verdant Cataclysm",
    desc: "Living brambles shroud you and erupt in relentless thorn novas.",
    weapon: { fireBehavior: "novaPulse", damage: 18, cooldown: 1.5, projectileSpeed: 350, count: 12, area: 9, pierce: 2, lifetime: 0.9, auraDamage: 10, auraArea: 120, auraRehit: 0.35, maxLevel: 8, color: "#3aff8a" },
  },
};

// ── Tool roster: 4 per category, distinct fire behaviors within each ─────────
// weapon: { fireBehavior, damage, cooldown, projectileSpeed, count, area,
//           pierce, lifetime, spread?, orbitRadius?, orbitSpeed?, reHitInterval? }
export const TOOL_STATS = {
  // ——— BLADES: brutal, short-range ———
  flame_saber: {
    name: "Flame Saber",
    category: "blades",
    weapon: { fireBehavior: "nearestEnemy", damage: 16, cooldown: 0.5, projectileSpeed: 460, count: 1, area: 8, pierce: 2, lifetime: 1.3, maxLevel: 8, color: "#ff7a5a" },
  },
  whirl_blades: {
    name: "Whirl Blades",
    category: "blades",
    weapon: { fireBehavior: "aroundPlayer", damage: 11, cooldown: 3.2, count: 3, area: 14, pierce: -1, lifetime: 3.0, reHitInterval: 0.35, orbitRadius: 80, orbitSpeed: 3.4, maxLevel: 8, color: "#ff9a6a" },
  },
  crescent_arc: {
    name: "Crescent Arc",
    category: "blades",
    weapon: { fireBehavior: "forwardSpread", damage: 22, cooldown: 1.0, projectileSpeed: 320, count: 3, area: 10, pierce: 1, lifetime: 0.35, spread: 0.9, maxLevel: 8, color: "#ffb08a" },
  },
  blade_cyclone: {
    name: "Blade Cyclone",
    category: "blades",
    weapon: { fireBehavior: "aura", damage: 8, cooldown: 4.0, count: 1, area: 85, pierce: -1, lifetime: 4.0, reHitInterval: 0.5, maxLevel: 8, color: "#ff8a7a" },
  },

  // ——— GUNS: fast, directed fire ———
  scatter_gun: {
    name: "Scatter Gun",
    category: "guns",
    weapon: { fireBehavior: "forwardSpread", damage: 8, cooldown: 0.85, projectileSpeed: 400, count: 5, area: 5, pierce: 0, lifetime: 0.55, spread: 0.7, maxLevel: 8, color: "#f0c850" },
  },
  hand_cannon: {
    name: "Hand Cannon",
    category: "guns",
    weapon: { fireBehavior: "nearestEnemy", damage: 34, cooldown: 1.1, projectileSpeed: 520, count: 1, area: 9, pierce: 1, lifetime: 1.2, maxLevel: 8, color: "#ffd67a" },
  },
  flak_burst: {
    name: "Flak Burst",
    category: "guns",
    weapon: { fireBehavior: "randomBurst", damage: 9, cooldown: 0.85, projectileSpeed: 360, count: 6, area: 6, pierce: 0, lifetime: 0.8, maxLevel: 8, color: "#e8b04a" },
  },
  landmine: {
    name: "Landmine",
    category: "guns",
    weapon: { fireBehavior: "mines", damage: 30, cooldown: 1.6, count: 2, area: 24, pierce: 2, lifetime: 6.0, maxLevel: 8, color: "#d09040" },
  },

  // ——— ARCANE: high power, wide reach ———
  arc_bolt: {
    name: "Arc Bolt",
    category: "arcane",
    weapon: { fireBehavior: "nearestEnemy", damage: 14, cooldown: 0.55, projectileSpeed: 440, count: 1, area: 7, pierce: 2, lifetime: 1.4, maxLevel: 8, color: "#9fe8ff" },
  },
  rune_orb: {
    name: "Rune Orb",
    category: "arcane",
    weapon: { fireBehavior: "aroundPlayer", damage: 12, cooldown: 3.4, count: 3, area: 13, pierce: -1, lifetime: 3.0, reHitInterval: 0.4, orbitRadius: 78, orbitSpeed: 3.2, maxLevel: 8, color: "#c79bff" },
  },
  static_field: {
    name: "Static Field",
    category: "arcane",
    weapon: { fireBehavior: "aura", damage: 6, cooldown: 3.6, count: 1, area: 100, pierce: -1, lifetime: 3.6, reHitInterval: 0.45, maxLevel: 8, color: "#8fb8ff" },
  },
  chaos_barrage: {
    name: "Chaos Barrage",
    category: "arcane",
    weapon: { fireBehavior: "randomBurst", damage: 9, cooldown: 0.5, projectileSpeed: 420, count: 4, area: 6, pierce: 1, lifetime: 0.9, maxLevel: 8, color: "#b090ff" },
  },

  // ——— NATURE: zoning and sustain ———
  thorn_ring: {
    name: "Thorn Ring",
    category: "nature",
    weapon: { fireBehavior: "aroundPlayer", damage: 9, cooldown: 3.0, count: 4, area: 12, pierce: -1, lifetime: 3.2, reHitInterval: 0.3, orbitRadius: 70, orbitSpeed: 3.0, maxLevel: 8, color: "#6ad89a" },
  },
  seed_shot: {
    name: "Seed Shot",
    category: "nature",
    weapon: { fireBehavior: "forwardSpread", damage: 8, cooldown: 0.8, projectileSpeed: 380, count: 4, area: 6, pierce: 1, lifetime: 0.7, spread: 0.5, maxLevel: 8, color: "#8ee0a8" },
  },
  spore_cloud: {
    name: "Spore Cloud",
    category: "nature",
    weapon: { fireBehavior: "aura", damage: 5, cooldown: 4.2, count: 1, area: 110, pierce: -1, lifetime: 4.2, reHitInterval: 0.4, maxLevel: 8, color: "#7ac890" },
  },
  bramble_trap: {
    name: "Bramble Trap",
    category: "nature",
    weapon: { fireBehavior: "mines", damage: 24, cooldown: 1.8, count: 3, area: 22, pierce: 3, lifetime: 7.0, maxLevel: 8, color: "#5ab878" },
  },
};

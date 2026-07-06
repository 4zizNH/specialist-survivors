// data/enemies.js
// Enemy archetypes. WHEN each type appears is pacing data (data/balance.js →
// PACING.unlocks); HOW MUCH they scale over time is ENEMY_SCALING. This file
// defines what each archetype IS.
//
// movement: "seek" (default chase) | "charger" (periodic lunge) |
//           "ranged" (holds distance, fires bullets) | "boss" (phased Colossus)
// splitInto: spawned on death (splitter archetypes)
// poolExclude: never spawns from the normal pool (split children)
// isBoss: spawned on the boss schedule, counts toward bossKills

export const ENEMIES = {
  // Slow and weak — the opening act.
  grunt: {
    id: "grunt",
    name: "Grunt",
    maxHp: 24,
    speed: 75,
    radius: 15,
    contactDamage: 10,
    xpValue: 5,
    movement: "seek",
    color: "#d05a6e",
  },
  // Fast, fragile flankers.
  runner: {
    id: "runner",
    name: "Runner",
    maxHp: 12,
    speed: 150,
    radius: 11,
    contactDamage: 6,
    xpValue: 3,
    movement: "seek",
    color: "#e0b24a",
  },
  // Slow, tanky, hits hard.
  brute: {
    id: "brute",
    name: "Brute",
    maxHp: 80,
    speed: 52,
    radius: 22,
    contactDamage: 18,
    xpValue: 12,
    movement: "seek",
    color: "#9a5acc",
  },
  // Tiny, very fast, swarms in numbers.
  swarmling: {
    id: "swarmling",
    name: "Swarmling",
    maxHp: 6,
    speed: 178,
    radius: 8,
    contactDamage: 4,
    xpValue: 2,
    movement: "seek",
    color: "#7ad8a0",
  },
  // RANGED — holds distance and spits bullets; forces repositioning.
  spitter: {
    id: "spitter",
    name: "Spitter",
    maxHp: 20,
    speed: 85,
    radius: 13,
    contactDamage: 8,
    xpValue: 7,
    movement: "ranged",
    range: 340, // holds here and fires
    fireInterval: 2.2,
    bulletSpeed: 240,
    bulletDamage: 10,
    bulletRadius: 5,
    color: "#5ad1d1",
  },
  // SPLITTER — bursts into blobs on death.
  blobmother: {
    id: "blobmother",
    name: "Blobmother",
    maxHp: 70,
    speed: 60,
    radius: 20,
    contactDamage: 12,
    xpValue: 10,
    movement: "seek",
    splitInto: { id: "blob", count: 3 },
    color: "#c86ab8",
  },
  // Split child — only ever spawned by a dying blobmother.
  blob: {
    id: "blob",
    name: "Blob",
    maxHp: 8,
    speed: 130,
    radius: 9,
    contactDamage: 4,
    xpValue: 2,
    movement: "seek",
    poolExclude: true,
    color: "#e08ad0",
  },
  // Mini-boss — huge HP, telegraphed lunges. On the miniBossEvery timer.
  warden: {
    id: "warden",
    name: "Warden",
    maxHp: 600,
    speed: 58,
    radius: 38,
    contactDamage: 30,
    xpValue: 120,
    isBoss: true,
    movement: "charger",
    color: "#ff5a5a",
  },
  // THE boss — two phases. Phase 1: slow advance + radial bullet bursts.
  // Phase 2 (below 50% HP): enraged — faster, denser, quicker bursts.
  colossus: {
    id: "colossus",
    name: "The Colossus",
    maxHp: 2200, // was 3000 — killable inside ~90s with a developed build
    speed: 45,
    radius: 55,
    contactDamage: 40,
    xpValue: 400,
    isBoss: true,
    movement: "boss",
    burstInterval: 3.8, // phase 1 cadence
    burstCount: 12, // phase 1 bullets per burst
    enragedBurstInterval: 2.4, // phase 2 cadence
    enragedBurstCount: 18,
    enragedSpeedMult: 1.7,
    bulletSpeed: 190,
    bulletDamage: 12,
    bulletRadius: 6,
    color: "#b02a3a",
  },
};

export const ENEMY_LIST = Object.values(ENEMIES);

// data/weapons.js
// Weapons are DATA. The combat system reads `fireBehavior` (a string) and looks
// it up in a behavior registry, so adding a new weapon means adding a data
// object here and referencing an existing behavior — no new logic.
//
// Later, collected "tools" will be these same shapes, generated per rarity.
//
// Fields:
//   fireBehavior     which firing pattern to use (see systems/weapons.js registry)
//   damage           damage per hit
//   cooldown         seconds between activations
//   projectileSpeed  px/sec (linear behaviors)
//   count            projectiles/orbs per activation
//   area             projectile radius (px)
//   pierce           extra enemies a shot passes through; -1 = infinite/persistent
//   lifetime         seconds before the projectile despawns
//   reHitInterval    persistent shots: seconds before the same enemy can be hit again
//   spread           forwardSpread: total fan angle (radians)
//   orbitRadius/orbitSpeed  aroundPlayer: orbit geometry

export const WEAPONS = {
  // Seeking bolt — flies at the nearest enemy, pierces a couple.
  magic_bolt: {
    id: "magic_bolt",
    name: "Magic Bolt",
    fireBehavior: "nearestEnemy",
    damage: 14,
    cooldown: 0.5,
    projectileSpeed: 440,
    count: 1,
    area: 6,
    pierce: 2,
    lifetime: 1.4,
    maxLevel: 8,
    color: "#9fe8ff",
  },

  // Orbital — spins guardian orbs around the player for a few seconds.
  orbiter: {
    id: "orbiter",
    name: "Orbiter",
    fireBehavior: "aroundPlayer",
    damage: 10,
    cooldown: 3.4,
    count: 3,
    area: 13,
    pierce: -1, // persistent — never consumed by hits
    lifetime: 3.0,
    reHitInterval: 0.4,
    orbitRadius: 78,
    orbitSpeed: 3.2, // rad/sec
    maxLevel: 8,
    color: "#ffd27f",
  },

  // Shotgun-style fan in the player's facing direction (example of a 3rd
  // behavior; not equipped by default).
  scattergun: {
    id: "scattergun",
    name: "Scattergun",
    fireBehavior: "forwardSpread",
    damage: 8,
    cooldown: 0.9,
    projectileSpeed: 380,
    count: 5,
    area: 5,
    pierce: 0,
    lifetime: 0.55,
    spread: 0.7,
    maxLevel: 8,
    color: "#ff9f6e",
  },
};

// The player's starting loadout. Add a second weapon by appending an id here —
// that's the whole change.
export const STARTING_WEAPONS = ["magic_bolt"];

# Wyrdclass — Design + Technical Plan

Reference doc for the build. Working title; everything here is subject to tuning.

---

## 1. Game design summary

**Run loop (the arena — `PLAYING` state):**

1. You control **one character** in a top-down arena. WASD/arrows move; the rest
   is automatic.
2. **Equipped tools (weapons) auto-fire** on their own cooldowns.
3. Enemies **swarm toward you** in escalating waves; difficulty ramps with
   elapsed time.
4. Killed enemies drop **XP gems**; walking within pickup radius collects them.
5. Filling the XP bar triggers a **level-up**: the run pauses and offers a
   **draft of upgrade choices** (weapon levels, passive stat boosts).
6. Survive as long as possible. Death (HP → 0) or beating the timer ends the run
   → `GAMEOVER`, which tallies rewards and returns to the hub.

> In-run leveling is _temporary_ — it resets every run (Vampire Survivors-style).

**Meta loop (the hub — `MENU` / hub states):**

1. **Character roster:** pick from unlocked characters, each with a
   **specialization** (melee, ranged, arcane, support, ...).
2. **Permanent character levels:** characters gain XP from runs and level up
   _forever_, raising base stats — this carries between runs.
3. **Tool collection:** runs/currency award **tools** with **rarities**
   (common → legendary). Each tool has a **specialization category**.
4. **Equip gate (the twist):** a tool only slots on a character whose
   `specialization` matches the tool's.
5. Spend gold to unlock characters/upgrade tools, then **start a new run**.

**Hook:** roguelite run variety over RPG permanent progression and a
collectible, specialization-gated gear system.

---

## 2. Tech stack

- **HTML5 Canvas 2D + vanilla JavaScript (ES modules).** No framework, no
  bundler, **no build step**, **zero dependencies**.
- **Run** with any static server (modules don't load over `file://`):
  `python -m http.server` or `npx serve`.
- **Why:** the genre is simple shapes/sprites with _many_ entities. Canvas 2D
  handles hundreds–low-thousands at 60 FPS if we keep allocations low and use a
  spatial grid for collision. No build step keeps iteration instant and the
  project portable. Revisit WebGL only if profiling demands it.
- **Persistence:** `localStorage` (JSON) behind a `saveManager` abstraction.

---

## 3. File / folder structure

```
ClaudePlayground/
├── index.html              # Full-window <canvas>, loads main.js as a module
├── DESIGN.md               # This plan
├── README.md               # How to run + scaffold controls
└── src/
    ├── main.js             # Entry point: wires canvas + loop + state machine
    ├── engine/             # Reusable, game-agnostic foundation
    │   ├── loop.js         # Fixed-timestep loop: update(dt) @60Hz, render(alpha)
    │   ├── canvas.js       # Canvas creation, DPR scaling, full-window resize
    │   └── input.js        # Keyboard: held keys + one-shot "was pressed"
    ├── state/              # Game-flow state machine (MENU/PLAYING/PAUSED/GAMEOVER)
    │   ├── states.js       # GameState enum
    │   └── stateMachine.js # Transition-guarded machine + change hooks
    ├── entities/           # Per-instance game objects
    │   ├── player.js       # Player avatar (stub)
    │   ├── enemy.js        # Enemy instances + chase AI (stub)
    │   └── pickup.js       # XP gems / drops (stub)
    ├── systems/            # Logic over many entities each tick
    │   ├── spawner.js      # Time-based wave/difficulty director (stub)
    │   ├── combat.js       # Auto-fire weapons, projectiles, damage (stub)
    │   ├── xp.js           # In-run XP, level curve, level-up trigger (stub)
    │   └── upgrades.js     # Level-up draft + apply modifiers (stub)
    ├── meta/               # Cross-run progression (RPG/meta loop)
    │   ├── saveManager.js  # localStorage load/save + migrations (stub)
    │   └── progression.js  # Permanent leveling, inventory, unlocks (stub)
    ├── data/               # Static, data-driven content
    │   ├── characters.js   # Character roster
    │   ├── tools.js        # Tools with rarity + specialization + equip gate
    │   └── saveSchema.js   # Save-file shape + fresh-save factory
    └── ui/                 # Presentation
        ├── styles.css      # Page reset; canvas fills viewport
        └── hud.js          # HUD/menus drawn on the canvas (stub)
```

`meta/` is separate from `state/`: `state/` is per-run game flow; `meta/` is
cross-run RPG progression.

---

## 4. Core systems & build order

1. **Engine foundation** ✅ — loop, canvas, input, state machine _(this scaffold)_
2. Player & movement — player entity, WASD, arena bounds, camera follow
3. Rendering layer — camera transform, shape/sprite draw, debug overlay
4. Enemy spawning — spawn director: waves + time-based ramp
5. Enemy AI — chase player + separation
6. Collision (broad-phase) — spatial grid for many entities
7. Weapons / combat — cooldowns, projectiles, hit detection, damage
8. Health & death — player HP, contact damage, → GAMEOVER
9. XP & in-run leveling — gems, pickup radius, level curve, level-up
10. Upgrade drafts — choice modal, apply modifiers
11. HUD — timer, HP/XP bars, level, pause overlay
12. Save system — saveManager + default save in localStorage
13. Meta progression — permanent character XP/levels, gold, unlocks
14. Tools & inventory — rarities + specialization equip gate, loadout
15. Hub UI — character select, equip screen, start-run flow
16. Content & balance — data-driven enemies/tools/characters; tuning
17. Polish — audio, particles, screen shake, juice

---

## 5. Data shapes (placeholders)

These mirror the modules in `src/data/`.

```js
// CHARACTER (src/data/characters.js)
{
  id: 'knight',                  // unique slug / save key
  name: 'Knight',                // display name
  specialization: 'melee',       // EQUIP GATE: only tools of this category fit
  description: '',               // flavor text
  baseStats: {                   // run-start stats before tools/upgrades
    maxHp: 100, moveSpeed: 100, armor: 0,
    pickupRadius: 50, critChance: 0, critMult: 1.5,
  },
  growthPerLevel: { maxHp: 10, moveSpeed: 1 }, // per PERMANENT level
  startingToolId: 'rusty_blade', // auto-equipped at run start
  sprite: '',                    // asset key
}

// TOOL / WEAPON (src/data/tools.js)
{
  id: 'rusty_blade',             // unique slug / inventory key
  name: 'Rusty Blade',
  specialization: 'melee',       // must match character.specialization to equip
  rarity: 'common',              // common | uncommon | rare | epic | legendary
  description: '',
  fireMode: 'melee_arc',         // melee_arc | projectile | orbit | aura | ...
  baseStats: {
    damage: 10, cooldown: 1.0, area: 1.0, speed: 300,
    count: 1, pierce: 0, duration: 0.3, knockback: 0,
  },
  maxLevel: 8,
  levelUpEffects: [],            // per-level stat deltas
  evolution: null,               // { into: 'toolId', requires: [...] }
  icon: '',
}

// SAVE FILE (src/data/saveSchema.js → createDefaultSave())
{
  version: 1,                    // schema version for migrations
  meta: { createdAt: 0, updatedAt: 0, totalRuns: 0, totalKills: 0, bestTimeSec: 0 },
  currency: { gold: 0 },
  characters: { knight: { unlocked: true, level: 1, xp: 0 } }, // by id
  tools: { rusty_blade: { owned: true, count: 1 } },           // by id
  loadouts: { knight: ['rusty_blade'] },                       // equipped, gate-validated
  unlocks: [],
  settings: { masterVolume: 1, sfxVolume: 1, musicVolume: 1 },
  lastSelectedCharacterId: 'knight',
}
```

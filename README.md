# Specialist Survivors

A 2D top-down action-roguelite (Vampire Survivors-style) with an RPG twist:
a roster of **specialists** who level up permanently across runs, and
collectible **tools** (weapons) with rarities — a tool can only be equipped by
a character whose **specialization** matches its category.

Built with HTML5 Canvas + vanilla JavaScript (ES modules). **No dependencies,
no build step.** See [DESIGN.md](DESIGN.md) for the original design plan.

## How to run

ES modules don't load over `file://`, so serve the folder with any static
server and open the printed URL:

```sh
node serve.mjs                    # bundled zero-dependency server → http://localhost:8000
# or:
python -m http.server 8000
npx serve
```

## How to play

**The loop:** Hub → pick a specialist → equip a tool → survive the arena →
collect rewards (character XP, gold, tool drops) → grow stronger → repeat.

| Context | Keys |
| --- | --- |
| Move | `WASD` / Arrow keys |
| Pause | `P` / `Esc` (menu: resume · restart · settings · quit) |
| Pick a level-up upgrade | `1` `2` `3` |
| Menus | Arrows + `Enter`, `Esc` back |
| Character select | `E` equip screen |
| Equip screen | `Enter` equip · `X` unequip |
| Collection filters | `F` category · `R` rarity |
| Debug overlay (FPS/entities) | `F3` |

Progress (characters, tools, loadouts, gold, shop upgrades, settings) is saved
to `localStorage` automatically. **Reset Progress** in the hub wipes it (with a
confirmation).

## Tuning & adding content

All balance numbers live in **`src/data/balance.js`** — tool stats, rarity
multipliers, enemy scaling, the XP curve, and the run-pacing timeline
(what unlocks at which minute).

### Add a new tool

1. Add an entry to `TOOL_STATS` in `src/data/balance.js`:

```js
frost_lance: {
  name: "Frost Lance",
  category: "arcane", // blades | guns | arcane | nature — the equip gate
  weapon: {
    fireBehavior: "nearestEnemy", // nearestEnemy | aroundPlayer | forwardSpread
                                  // | randomBurst | aura | mines
    damage: 18, cooldown: 0.7, projectileSpeed: 500,
    count: 1, area: 7, pierce: 3, lifetime: 1.2,
    maxLevel: 8, color: "#a0e8ff",
  },
},
```

That's it — it can now roll any rarity, drop from runs, appear in the
collection/equip screens, and be discovered mid-run by matching specialists.

### Add a new character

1. Add an entry to `CHARACTERS` in `src/data/characters.js`:

```js
frost_witch: {
  id: "frost_witch",
  name: "Frost Witch",
  specialization: "arcane", // which tool category she can equip
  baseStats: { maxHp: 75, moveSpeed: 1.0, might: 1.2, pickupRadius: 1.1, cooldown: 0.95 },
  statGrowthPerLevel: { maxHp: 6, might: 0.035 }, // per PERMANENT level
  passive: { id: "resonance", name: "Echo", desc: "+30% XP from gems", xpMult: 1.3 },
  startingToolId: null,
  color: "#a0e8ff",
  blurb: "One line of flavor.",
},
```

Existing saves pick up new characters automatically (backfilled at level 1).
Passive hooks available: `onKillHeal`, `lowHpSpeedBoost`, `critChance`,
`goldMult`, `xpMult`, `regen`.

### Add a new enemy

Add an archetype to `src/data/enemies.js` (movement: `seek`, `charger`,
`ranged`, `boss`; `splitInto` for splitters) and give it an unlock time in
`PACING.unlocks` in `src/data/balance.js`.

## Project structure

```
src/
├── main.js        entry point — wires everything, owns the state machine
├── engine/        game-agnostic: loop, canvas, input, pools, grid, particles, audio
├── state/         MENU/PLAYING/… state machine
├── entities/      player, enemy, projectile, pickup
├── systems/       spawner, weapons, xp, upgrades, difficulty, fx
├── meta/          cross-run: save manager, progression, inventory, rewards
├── data/          ALL content + balance tables (characters, tools, enemies, shop)
└── ui/            hub, character select, equip, collection, shop, HUD, pause
```

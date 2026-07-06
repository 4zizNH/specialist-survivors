// main.js
// Entry point. Wires the canvas, fixed-timestep loop, input, state machine, and
// (new) the player + camera + scrolling world. The loop and state machine from
// the scaffold are preserved unchanged; gameplay is layered into the PLAYING
// state.

import { createCanvas } from "./engine/canvas.js";
import { createLoop } from "./engine/loop.js";
import { initInput, wasPressed, endFrameInput } from "./engine/input.js";
import { createCamera } from "./engine/camera.js";
import { drawBackground } from "./engine/background.js";
import { createStateMachine } from "./state/stateMachine.js";
import { GameState } from "./state/states.js";
import { createPlayer } from "./entities/player.js";
import { createSpawner } from "./systems/spawner.js";
import { createWeaponSystem } from "./systems/weapons.js";
import { createFloatingText } from "./systems/floatingText.js";
import { createXpSystem } from "./systems/xp.js";
import { createFx } from "./systems/fx.js";
import { rollUpgrades } from "./systems/upgrades.js";
import { createEvolutionChests, makeEvolvedDef } from "./systems/evolution.js";
import { EVOLUTIONS } from "./data/balance.js";
import { PASSIVES } from "./data/passives.js";
import { drawHud } from "./ui/hud.js";
import { drawUpgradeScreen } from "./ui/upgradeScreen.js";
import { drawEvolutionScreen, EVOLUTION_DISMISS_DELAY } from "./ui/evolutionScreen.js";
import { drawGameOver } from "./ui/gameoverScreen.js";
import { drawCharacterSelect } from "./ui/characterSelect.js";
import { drawCollection, COLLECTION_COLS } from "./ui/collectionScreen.js";
import { drawEquip, EQUIP_COLS } from "./ui/equipScreen.js";
import { drawHub, HUB_OPTIONS, drawResetConfirm } from "./ui/hubScreen.js";
import { drawShop } from "./ui/shopScreen.js";
import { drawFusion, FUSION_COLS } from "./ui/fusionScreen.js";
import { fuse, fusionInfo } from "./meta/fusion.js";
import { drawPauseMenu, drawSettings, PAUSE_OPTIONS } from "./ui/pauseMenu.js";
import { createToasts } from "./ui/toasts.js";
import { drawAchievements, achievementRows } from "./ui/achievementsScreen.js";
import { buyUpgrade, SHOP_UPGRADES } from "./data/shop.js";
import { loadSave, writeSave, resetSave } from "./meta/saveManager.js";
import { resolveCharacterStats } from "./meta/progression.js";
import { grantRunRewards } from "./meta/rewards.js";
import {
  evaluateAchievements,
  recordRunStats,
  recordFusion,
  isCharacterUnlocked,
  characterUnlockInfo,
  rewardText,
} from "./meta/achievements.js";
import {
  getOwnedTools,
  getLoadout,
  isEquipped,
  equipTool,
  unequipTool,
  resolveRunWeaponDefs,
  getEquipSlots,
} from "./meta/inventory.js";
import { CHARACTERS_LIST, CHARACTERS_BY_ID } from "./data/characters.js";
import { RARITY_ORDER } from "./data/rarities.js";
import { TOOL_CATEGORIES } from "./data/tools.js";
import { WORLD } from "./data/world.js";

// A character's moveSpeed/pickupRadius multipliers scale these baselines.
const BASE_MOVE_SPEED = 260;
const BASE_PICKUP_RADIUS = 80;

const view = createCanvas("game");
const { ctx } = view;
initInput();

const camera = createCamera(view);
let player = createPlayer(WORLD.width / 2, WORLD.height / 2);
const spawner = createSpawner(WORLD);
const weapons = createWeaponSystem(WORLD);
const floatingText = createFloatingText();
const xp = createXpSystem();
const evoChests = createEvolutionChests(); // evolution chest drops (per run)
let upgradeOptions = []; // current level-up draft
let evolutionReveal = null; // data for the evolution reveal overlay
let evolutionRevealAt = 0; // performance.now() when the reveal started
let results = { time: 0, level: 1, kills: 0 }; // snapshot for the game-over screen
camera.follow(player);

// --- Meta / hub ---
const save = loadSave(); // persistent profile (characters + levels)
const fx = createFx(() => save.settings.masterVolume ?? 1); // juice: particles/shake/audio
const toasts = createToasts(); // achievement/unlock banners (drawn over every state)

// One toast per unlock (+ a second, character-colored one for roster unlocks).
function toastAchievements(defs) {
  for (const def of defs) {
    toasts.push(`🏆 Achievement — ${def.name}`, rewardText(def) || def.desc);
    const cid = def.reward?.characterId;
    if (cid && CHARACTERS_BY_ID[cid]) {
      toasts.push(`✦ ${CHARACTERS_BY_ID[cid].name} joins the roster!`, "New specialist unlocked", CHARACTERS_BY_ID[cid].color);
    }
  }
}

// Boot-time evaluation: migrated saves are granted any achievements their
// existing stats already satisfy (and the character unlocks that ride along).
{
  const migrated = evaluateAchievements(save);
  if (migrated.length) {
    writeSave(save);
    toastAchievements(migrated);
  }
}
let selectedIndex = Math.max(
  0,
  CHARACTERS_LIST.findIndex((c) => c.id === save.lastSelectedCharacterId)
);
let currentCharId = save.lastSelectedCharacterId; // character of the active run
let currentChar = CHARACTERS_BY_ID[currentCharId]; // its def (for spec-scoped upgrades)

// Hub sub-screen state.
let hubSel = 0; // hub menu cursor
let confirmReset = false; // reset-progress confirmation showing?
let shopSel = 0; // shop cursor
let shopMessage = null; // last purchase feedback { ok, text }
let fusionSel = 0; // fusion cursor
let fusionMode = "browse"; // "browse" | "confirm" | "reveal"
let fusionResult = null; // tool produced by the last fusion
let fusionRevealAt = 0; // performance.now() when the reveal started
let pauseSel = 0; // pause-menu cursor
let pauseMode = "menu"; // "menu" | "settings"
let showDebug = false; // F3 diagnostics overlay
let fade = 0; // screen-transition fade-in (1 → 0)
let collectionSel = 0;
let collectionCatIdx = 0; // 0 = All, else TOOL_CATEGORIES[idx - 1]
let collectionRarIdx = 0; // 0 = All, else RARITY_ORDER[idx - 1]
let equipSel = 0;
let achievementsScroll = 0; // achievements-screen scroll offset (rows)

// Allowed flow transitions. The HUB is home base; runs always land back there.
const machine = createStateMachine(GameState.HUB, {
  [GameState.HUB]: [GameState.MENU, GameState.COLLECTION, GameState.SHOP, GameState.FUSION, GameState.ACHIEVEMENTS],
  [GameState.MENU]: [GameState.PLAYING, GameState.EQUIP, GameState.HUB],
  [GameState.COLLECTION]: [GameState.HUB],
  [GameState.SHOP]: [GameState.HUB],
  [GameState.FUSION]: [GameState.HUB],
  [GameState.ACHIEVEMENTS]: [GameState.HUB],
  [GameState.EQUIP]: [GameState.MENU],
  [GameState.PLAYING]: [GameState.PAUSED, GameState.LEVELUP, GameState.EVOLUTION, GameState.GAMEOVER],
  [GameState.PAUSED]: [GameState.PLAYING, GameState.HUB],
  [GameState.LEVELUP]: [GameState.PLAYING],
  [GameState.EVOLUTION]: [GameState.PLAYING],
  [GameState.GAMEOVER]: [GameState.HUB, GameState.MENU], // MENU = "press C" shortcut to a freshly unlocked character
});

// PAUSED/LEVELUP/EVOLUTION are overlays on the run, not screen changes — no fade there.
const OVERLAY_STATES = new Set([GameState.PAUSED, GameState.LEVELUP, GameState.EVOLUTION]);

machine.onChange((next, prev) => {
  console.log(`[state] ${prev} -> ${next}`);
  if (!OVERLAY_STATES.has(next) && !OVERLAY_STATES.has(prev)) fade = 1;
  if (next === GameState.PAUSED) {
    pauseSel = 0;
    pauseMode = "menu";
  }
});

const HINTS = {
  [GameState.PLAYING]: "WASD / Arrows: move      P / Esc: pause      K: die",
  [GameState.PAUSED]: "P / Esc: resume      M: quit to menu",
  [GameState.LEVELUP]: "Press 1 · 2 · 3 to choose",
  [GameState.EVOLUTION]: "Enter: wield your evolved weapon",
  [GameState.GAMEOVER]: "Enter: back to menu",
};

// Start a run with the currently selected character: resolve its persisted-level
// stats into the run player, reset the run systems, then enter PLAYING.
function startRun() {
  const def = CHARACTERS_LIST[selectedIndex];
  if (!isCharacterUnlocked(save, def.id)) return; // achievement-gated
  currentCharId = def.id;
  currentChar = def;
  save.lastSelectedCharacterId = def.id;
  writeSave(save);

  const prog = save.characters[def.id] || { level: 1, xp: 0 };
  const s = resolveCharacterStats(def, prog.level);
  player = createPlayer(WORLD.width / 2, WORLD.height / 2);
  player.maxHp = s.maxHp;
  player.hp = s.maxHp;
  player.speed = BASE_MOVE_SPEED * s.moveSpeed;
  player.pickupRadius = BASE_PICKUP_RADIUS * s.pickupRadius;
  player.might = s.might;
  player.cooldownMult = s.cooldown;

  // Shop: Whetstone — permanent account-wide damage bonus.
  player.might *= 1 + 0.05 * ((save.shop && save.shop.global_might) || 0);

  // Character passive (the run-affecting hooks; goldMult applies in rewards).
  const p = def.passive || {};
  player.critChance = p.critChance ?? 0;
  player.xpMult = p.xpMult ?? 1;
  player.onKillHeal = p.onKillHeal ?? 0;
  player.lowHpSpeedBoost = p.lowHpSpeedBoost ?? 0;
  if (p.regen != null) player.regen = p.regen;

  // Empty loadout (e.g. a newly added roster member on an old save): auto-equip
  // the first compatible owned tool so the run isn't weaponless.
  if (resolveRunWeaponDefs(save, def.id).length === 0) {
    const match = getOwnedTools(save).find((t) => t.category === def.specialization);
    if (match && equipTool(save, def.id, match).ok) writeSave(save);
  }

  weapons.setLoadout(resolveRunWeaponDefs(save, def.id)); // equipped tools -> run weapons
  spawner.reset();
  weapons.reset();
  floatingText.reset();
  xp.reset();
  evoChests.reset();
  fx.reset();
  camera.follow(player);
  runTime = 0;

  machine.transition(GameState.PLAYING);
}

// --- Hub sub-screen helpers ---
function collectionTools() {
  const cat = collectionCatIdx === 0 ? null : TOOL_CATEGORIES[collectionCatIdx - 1];
  const rar = collectionRarIdx === 0 ? null : RARITY_ORDER[collectionRarIdx - 1];
  let list = getOwnedTools(save);
  if (cat) list = list.filter((t) => t.category === cat);
  if (rar) list = list.filter((t) => t.rarity === rar);
  return { list, cat, rar };
}

function equipData() {
  const charDef = CHARACTERS_LIST[selectedIndex];
  const prog = save.characters[charDef.id] || { level: 1 };
  const owned = getOwnedTools(save);
  const byId = new Map(owned.map((t) => [t.id, t]));
  const loadout = getLoadout(save, charDef.id).map((id) => byId.get(id)).filter(Boolean);
  return {
    character: charDef,
    level: prog.level,
    tools: owned,
    selectedIndex: equipSel,
    loadout,
    slots: getEquipSlots(save),
  };
}

// Grid navigation shared by the collection/equip screens.
function moveGrid(sel, len, cols, code) {
  if (len === 0) return 0;
  if (code === "ArrowRight") return Math.min(sel + 1, len - 1);
  if (code === "ArrowLeft") return Math.max(sel - 1, 0);
  if (code === "ArrowDown") return Math.min(sel + cols, len - 1);
  if (code === "ArrowUp") return Math.max(sel - cols, 0);
  return sel;
}

// Restart the current run with the same character (from the pause menu).
function restartRun() {
  const idx = CHARACTERS_LIST.findIndex((c) => c.id === currentCharId);
  if (idx !== -1) selectedIndex = idx;
  startRun(); // PAUSED -> PLAYING is an allowed transition
}

// Open the upgrade draft for a queued level-up.
function openLevelUp() {
  upgradeOptions = rollUpgrades(weapons, player, currentChar, 3);
  fx.onLevelUp(player);
  machine.transition(GameState.LEVELUP);
}

// Apply the chosen option, then either present the next queued level-up or
// resume play.
function pickUpgrade(index) {
  const opt = upgradeOptions[index];
  if (!opt) return;
  opt.apply(weapons, player);
  xp.consumeLevelUp();

  // Achievement checkpoint (in-run level-up): evaluate with live-run deltas so
  // lifetime milestones can pop mid-run. Unlocks persist immediately; the raw
  // stats are only banked at end of run (the unlocked set prevents re-awards).
  const newly = evaluateAchievements(save, {
    kills: weapons.kills,
    bossKills: weapons.bossKills,
    timeSec: runTime,
    spec: currentChar?.specialization,
  });
  if (newly.length) {
    writeSave(save);
    toastAchievements(newly);
  }

  if (xp.pendingLevelUps > 0) {
    upgradeOptions = rollUpgrades(weapons, player, currentChar, 3); // stay in LEVELUP
  } else {
    machine.transition(GameState.PLAYING);
  }
}

// An evolution chest was opened: transform the weapon NOW (so the state can't
// be lost mid-reveal), record the discovery, then play the dramatic reveal.
function openEvolution(chest) {
  const evo = EVOLUTIONS[chest.baseId];
  const inst = weapons.list.find((w) => w.id === chest.baseId);
  if (!evo || !inst || inst.evolved) return;
  const fromName = inst.name;
  if (!weapons.evolveWeapon(chest.baseId, makeEvolvedDef(chest.baseId))) return;
  if (!save.evolutionsSeen.includes(chest.baseId)) {
    save.evolutionsSeen.push(chest.baseId); // persistent recipe discovery
    // Achievement checkpoint (on evolution) — discovery achievements pop here.
    toastAchievements(
      evaluateAchievements(save, {
        kills: weapons.kills,
        bossKills: weapons.bossKills,
        timeSec: runTime,
        spec: currentChar?.specialization,
      })
    );
    writeSave(save);
  }
  evolutionReveal = {
    fromName,
    toName: evo.evolvedName,
    desc: evo.desc,
    color: evo.weapon.color,
    passiveName: PASSIVES[evo.requiresPassiveId]?.name ?? evo.requiresPassiveId,
  };
  evolutionRevealAt = performance.now();
  fx.onEvolution(player);
  machine.transition(GameState.EVOLUTION);
}

// End the run: grant performance-based rewards (character XP, gold, possible
// tool drop), persist, snapshot for the reward screen.
function endRun() {
  const def = CHARACTERS_BY_ID[currentCharId];
  const runStats = {
    time: runTime,
    level: xp.level,
    kills: weapons.kills,
    bossKills: weapons.bossKills,
  };
  const reward = grantRunRewards(save, currentCharId, runStats); // mutates the save

  // Achievement checkpoint (end of run): bank the run's raw numbers into the
  // lifetime stats layer, then evaluate — AFTER rewards so fresh character
  // levels / tool drops / run counts all count.
  recordRunStats(save, runStats, def?.specialization);
  const newAchievements = evaluateAchievements(save);
  writeSave(save);
  toastAchievements(newAchievements);

  fx.onPlayerDeath();
  const unlockedCharId = newAchievements.find((a) => a.reward?.characterId)?.reward.characterId;
  results = {
    ...runStats,
    gold: reward.gold,
    droppedTool: reward.droppedTool,
    character: { name: def ? def.name : currentCharId, ...reward.characterXp },
    achievements: newAchievements,
    unlockedCharacter: unlockedCharId ? CHARACTERS_BY_ID[unlockedCharId] : null,
  };
  machine.transition(GameState.GAMEOVER);
}

let elapsed = 0; // total loop uptime (s) — proves the loop ticks
let runTime = 0; // time in the current run (s)

function handleTransitions() {
  switch (machine.current) {
    case GameState.HUB:
      if (confirmReset) {
        // Destructive action — explicit confirmation gate.
        if (wasPressed("Enter")) {
          resetSave(save);
          selectedIndex = 0;
          hubSel = 0;
          confirmReset = false;
        } else if (wasPressed("Escape")) {
          confirmReset = false;
        }
      } else if (wasPressed("ArrowUp") || wasPressed("KeyW"))
        hubSel = (hubSel + HUB_OPTIONS.length - 1) % HUB_OPTIONS.length;
      else if (wasPressed("ArrowDown") || wasPressed("KeyS"))
        hubSel = (hubSel + 1) % HUB_OPTIONS.length;
      else if (wasPressed("Enter") || wasPressed("Space")) {
        const dest = HUB_OPTIONS[hubSel].id;
        if (dest === "collection") {
          collectionSel = 0;
          machine.transition(GameState.COLLECTION);
        } else if (dest === "shop") {
          shopSel = 0;
          shopMessage = null;
          machine.transition(GameState.SHOP);
        } else if (dest === "fusion") {
          fusionSel = 0;
          fusionMode = "browse";
          machine.transition(GameState.FUSION);
        } else if (dest === "achievements") {
          achievementsScroll = 0;
          machine.transition(GameState.ACHIEVEMENTS);
        } else if (dest === "reset") {
          confirmReset = true;
        } else {
          // "play" and "roster" both open the character roster; from there Play
          // continues into equip/run, Roster is for browsing.
          machine.transition(GameState.MENU);
        }
      }
      break;
    case GameState.SHOP:
      if (wasPressed("Escape")) machine.transition(GameState.HUB);
      else if (wasPressed("ArrowUp") || wasPressed("KeyW"))
        shopSel = (shopSel + SHOP_UPGRADES.length - 1) % SHOP_UPGRADES.length;
      else if (wasPressed("ArrowDown") || wasPressed("KeyS"))
        shopSel = (shopSel + 1) % SHOP_UPGRADES.length;
      else if (wasPressed("Enter") || wasPressed("Space")) {
        const u = SHOP_UPGRADES[shopSel];
        const r = buyUpgrade(save, u.id);
        if (r.ok) writeSave(save);
        shopMessage = { ok: r.ok, text: r.ok ? `${u.name} upgraded!` : r.reason };
      }
      break;
    case GameState.FUSION: {
      const stacks = getOwnedTools(save);
      if (fusionMode === "reveal") {
        if (wasPressed("Enter") || wasPressed("Space") || wasPressed("Escape")) {
          fusionMode = "browse";
          if (fusionSel >= stacks.length) fusionSel = Math.max(0, stacks.length - 1);
        }
      } else if (fusionMode === "confirm") {
        if (wasPressed("Escape")) fusionMode = "browse";
        else if (wasPressed("Enter") || wasPressed("Space")) {
          const t = stacks[fusionSel];
          const r = t ? fuse(save, t.baseId, t.rarity) : { ok: false };
          if (r.ok) {
            // Achievement checkpoint (on fusion).
            recordFusion(save, r.result.rarity);
            toastAchievements(evaluateAchievements(save));
            writeSave(save);
            fusionResult = r.result;
            fusionRevealAt = performance.now();
            fusionMode = "reveal";
          } else {
            fusionMode = "browse";
          }
        }
      } else {
        if (wasPressed("Escape")) machine.transition(GameState.HUB);
        else if (wasPressed("Enter") || wasPressed("Space")) {
          const t = stacks[fusionSel];
          if (t && fusionInfo(save, t.baseId, t.rarity).fusable) fusionMode = "confirm";
        } else {
          for (const code of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"])
            if (wasPressed(code)) fusionSel = moveGrid(fusionSel, stacks.length, FUSION_COLS, code);
        }
        if (fusionSel >= stacks.length) fusionSel = Math.max(0, stacks.length - 1);
      }
      break;
    }
    case GameState.MENU:
      if (wasPressed("ArrowLeft") || wasPressed("KeyA"))
        selectedIndex = (selectedIndex + CHARACTERS_LIST.length - 1) % CHARACTERS_LIST.length;
      else if (wasPressed("ArrowRight") || wasPressed("KeyD"))
        selectedIndex = (selectedIndex + 1) % CHARACTERS_LIST.length;
      else if (wasPressed("KeyE")) {
        // Equipping is only meaningful for unlocked characters.
        if (isCharacterUnlocked(save, CHARACTERS_LIST[selectedIndex].id)) {
          equipSel = 0;
          machine.transition(GameState.EQUIP);
        }
      } else if (wasPressed("Escape")) machine.transition(GameState.HUB);
      else if (wasPressed("Enter") || wasPressed("Space")) startRun(); // no-op on locked cards
      break;
    case GameState.ACHIEVEMENTS: {
      if (wasPressed("Escape")) machine.transition(GameState.HUB);
      else if (wasPressed("ArrowUp") || wasPressed("KeyW"))
        achievementsScroll = Math.max(0, achievementsScroll - 1);
      else if (wasPressed("ArrowDown") || wasPressed("KeyS"))
        achievementsScroll = Math.min(Math.max(0, achievementRows(save).length - 6), achievementsScroll + 1);
      break;
    }
    case GameState.COLLECTION: {
      const { list } = collectionTools();
      if (wasPressed("KeyF")) {
        collectionCatIdx = (collectionCatIdx + 1) % (TOOL_CATEGORIES.length + 1);
        collectionSel = 0;
      } else if (wasPressed("KeyR")) {
        collectionRarIdx = (collectionRarIdx + 1) % (RARITY_ORDER.length + 1);
        collectionSel = 0;
      } else if (wasPressed("Escape") || wasPressed("KeyC")) {
        machine.transition(GameState.HUB);
      } else {
        for (const code of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"])
          if (wasPressed(code)) collectionSel = moveGrid(collectionSel, list.length, COLLECTION_COLS, code);
      }
      if (collectionSel >= list.length) collectionSel = Math.max(0, list.length - 1);
      break;
    }
    case GameState.EQUIP: {
      const owned = getOwnedTools(save);
      const charDef = CHARACTERS_LIST[selectedIndex];
      if (wasPressed("Escape") || wasPressed("KeyE")) {
        machine.transition(GameState.MENU);
      } else if (wasPressed("Enter") || wasPressed("Space")) {
        const tool = owned[equipSel];
        if (tool) {
          const r = equipTool(save, charDef.id, tool); // enforces the spec rule
          if (r.ok) writeSave(save);
        }
      } else if (wasPressed("KeyX") || wasPressed("Delete")) {
        const tool = owned[equipSel];
        if (tool && isEquipped(save, charDef.id, tool.id)) {
          unequipTool(save, charDef.id, tool.id);
          writeSave(save);
        }
      } else {
        for (const code of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"])
          if (wasPressed(code)) equipSel = moveGrid(equipSel, owned.length, EQUIP_COLS, code);
      }
      if (equipSel >= owned.length) equipSel = Math.max(0, owned.length - 1);
      break;
    }
    case GameState.PLAYING:
      if (wasPressed("KeyP") || wasPressed("Escape"))
        machine.transition(GameState.PAUSED);
      else if (wasPressed("KeyK")) endRun(); // debug: instant death
      break;
    case GameState.PAUSED:
      if (pauseMode === "settings") {
        if (wasPressed("Escape")) pauseMode = "menu";
        else if (wasPressed("ArrowLeft") || wasPressed("ArrowRight")) {
          const step = wasPressed("ArrowLeft") ? -0.1 : 0.1;
          save.settings.masterVolume = Math.round(
            Math.min(1, Math.max(0, (save.settings.masterVolume ?? 1) + step)) * 10
          ) / 10;
          writeSave(save);
          fx.setVolume(save.settings.masterVolume);
        }
      } else if (wasPressed("KeyP") || wasPressed("Escape")) {
        machine.transition(GameState.PLAYING);
      } else if (wasPressed("ArrowUp") || wasPressed("KeyW")) {
        pauseSel = (pauseSel + PAUSE_OPTIONS.length - 1) % PAUSE_OPTIONS.length;
      } else if (wasPressed("ArrowDown") || wasPressed("KeyS")) {
        pauseSel = (pauseSel + 1) % PAUSE_OPTIONS.length;
      } else if (wasPressed("Enter") || wasPressed("Space")) {
        const action = PAUSE_OPTIONS[pauseSel].id;
        if (action === "resume") machine.transition(GameState.PLAYING);
        else if (action === "restart") restartRun();
        else if (action === "settings") pauseMode = "settings";
        else if (action === "quit") machine.transition(GameState.HUB);
      }
      break;
    case GameState.LEVELUP:
      if (wasPressed("Digit1") || wasPressed("Numpad1")) pickUpgrade(0);
      else if (wasPressed("Digit2") || wasPressed("Numpad2")) pickUpgrade(1);
      else if (wasPressed("Digit3") || wasPressed("Numpad3")) pickUpgrade(2);
      break;
    case GameState.EVOLUTION:
      // Let the reveal land before accepting the dismiss.
      if (
        (performance.now() - evolutionRevealAt) / 1000 > EVOLUTION_DISMISS_DELAY &&
        (wasPressed("Enter") || wasPressed("Space"))
      ) {
        evolutionReveal = null;
        machine.transition(GameState.PLAYING);
      }
      break;
    case GameState.GAMEOVER:
      if (wasPressed("Enter")) machine.transition(GameState.HUB);
      else if (wasPressed("KeyC") && results.unlockedCharacter) {
        // Shortcut: jump straight to the freshly unlocked specialist.
        const idx = CHARACTERS_LIST.findIndex((c) => c.id === results.unlockedCharacter.id);
        if (idx !== -1) selectedIndex = idx;
        machine.transition(GameState.MENU);
      }
      break;
  }
}

function update(dt) {
  elapsed += dt;

  // Global: toggle the diagnostics overlay.
  if (wasPressed("F3")) showDebug = !showDebug;

  fx.update(dt); // particles/shake/flash decay even while paused screens show
  toasts.update(dt); // unlock banners tick in every state

  if (machine.current === GameState.PLAYING) {
    player.update(dt, WORLD);
    spawner.update(dt, runTime, player, view, fx);
    weapons.update(dt, player, spawner, floatingText, xp, fx, (x, y) =>
      evoChests.onEliteKill(x, y, weapons, player)
    );
    xp.update(dt, player, fx);
    const openedChest = evoChests.update(dt, player); // walk over it to open
    floatingText.update(dt);
    camera.follow(player);
    runTime += dt;

    // Death ends the run; otherwise an opened evolution chest or a banked
    // level-up interrupts with its overlay.
    if (player.hp <= 0) endRun();
    else if (openedChest) openEvolution(openedChest);
    else if (xp.pendingLevelUps > 0) openLevelUp();
  }

  handleTransitions();
  endFrameInput();
}

// --- Rendering ---------------------------------------------------------------

function hudData() {
  return { player, xp, runTime, kills: weapons.kills, weapons: weapons.list };
}

function renderWorld() {
  // Screen shake: offset the camera for this frame only.
  const so = fx.shakeOffset;
  const cam = { x: camera.x + so.x, y: camera.y + so.y };
  // Visible world rect (+margin) — everything culls against this.
  const vb = {
    left: cam.x - 60,
    top: cam.y - 60,
    right: cam.x + view.width + 60,
    bottom: cam.y + view.height + 60,
  };

  drawBackground(ctx, cam, view, WORLD);
  ctx.save();
  ctx.translate(-cam.x, -cam.y); // into world space
  spawner.render(ctx, vb); // enemies + enemy bullets under everything
  xp.render(ctx, vb); // gems over enemies so they're visible
  evoChests.render(ctx); // evolution chest + beacon over gems
  weapons.render(ctx, vb); // projectiles over gems
  fx.particles.render(ctx, vb); // sparks/bursts over projectiles
  player.render(ctx);
  floatingText.render(ctx); // damage numbers on top
  ctx.restore();

  // Level-up flash (fades fast).
  if (fx.flash > 0) {
    ctx.fillStyle = `rgba(255, 240, 190, ${fx.flash * 0.5})`;
    ctx.fillRect(0, 0, view.width, view.height);
  }
}

// Dev diagnostics (F3), tucked below the HP bar + tool icons.
function renderOverlay() {
  ctx.fillStyle = "#5a5a6c";
  ctx.font = "12px ui-monospace, monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(`fps ${fps.toFixed(0)}   enemies ${spawner.count}`, 12, 78);
  ctx.fillText(
    `shots ${weapons.projectileCount}   gems ${xp.gemCount}   bullets ${spawner.bulletCount}   fx ${fx.particles.count}`,
    12,
    94
  );
}

let fps = 60;
let lastRenderMs = performance.now();

function render() {
  // Smoothed FPS readout (independent of the fixed update rate).
  const now = performance.now();
  const frameMs = now - lastRenderMs;
  lastRenderMs = now;
  if (frameMs > 0) fps = fps * 0.9 + (1000 / frameMs) * 0.1;

  switch (machine.current) {
    case GameState.PLAYING:
      renderWorld();
      drawHud(ctx, view, hudData());
      if (showDebug) renderOverlay();
      break;

    case GameState.LEVELUP:
      renderWorld();
      drawHud(ctx, view, hudData());
      drawUpgradeScreen(ctx, view, upgradeOptions);
      break;

    case GameState.EVOLUTION:
      renderWorld();
      drawHud(ctx, view, hudData());
      if (evolutionReveal)
        drawEvolutionScreen(ctx, view, evolutionReveal, (performance.now() - evolutionRevealAt) / 1000);
      break;

    case GameState.PAUSED:
      renderWorld();
      if (pauseMode === "settings") drawSettings(ctx, view, save.settings);
      else
        drawPauseMenu(ctx, view, pauseSel, {
          weapons: weapons.list,
          passives: player.passiveItems,
        });
      break;

    case GameState.GAMEOVER:
      drawGameOver(ctx, view, results);
      break;

    case GameState.COLLECTION: {
      const { list, cat, rar } = collectionTools();
      drawCollection(ctx, view, {
        tools: list,
        selectedIndex: collectionSel,
        catFilter: cat,
        rarFilter: rar,
        evolutionsSeen: save.evolutionsSeen,
      });
      break;
    }

    case GameState.EQUIP:
      drawEquip(ctx, view, equipData());
      break;

    case GameState.SHOP:
      drawShop(ctx, view, { save, selectedIndex: shopSel, message: shopMessage });
      break;

    case GameState.FUSION:
      drawFusion(ctx, view, {
        save,
        stacks: getOwnedTools(save),
        selectedIndex: fusionSel,
        mode: fusionMode,
        result: fusionResult,
        revealElapsed: (performance.now() - fusionRevealAt) / 1000,
      });
      break;

    case GameState.MENU: {
      // Locked cards need their gating achievement's requirement + progress.
      const unlockInfo = {};
      for (const c of CHARACTERS_LIST) {
        if (!isCharacterUnlocked(save, c.id)) {
          unlockInfo[c.id] = characterUnlockInfo(save, c.id);
        }
      }
      drawCharacterSelect(ctx, view, {
        characters: CHARACTERS_LIST,
        progress: save.characters,
        selectedIndex,
        unlockedIds: save.unlockedCharacters,
        unlockInfo,
      });
      break;
    }

    case GameState.ACHIEVEMENTS:
      drawAchievements(ctx, view, { save, scroll: achievementsScroll });
      break;

    case GameState.HUB:
    default:
      drawHub(ctx, view, { save, selectedIndex: hubSel });
      if (confirmReset) drawResetConfirm(ctx, view);
      break;
  }

  // Screen-transition fade-in (set on state change, decays over ~0.25s).
  if (fade > 0) {
    ctx.fillStyle = `rgba(6, 6, 10, ${Math.min(1, fade)})`;
    ctx.fillRect(0, 0, view.width, view.height);
    fade -= Math.min(frameMs, 50) / 250;
  }

  // Unlock banners ride on top of everything, in every state.
  toasts.render(ctx, view);
}

const loop = createLoop({ update, render });
loop.start();

// Dev-only inspection hook (handy for debugging from the console).
if (typeof window !== "undefined") {
  window.__game = {
    get state() {
      return machine.current;
    },
    get pending() {
      return xp.pendingLevelUps;
    },
    get level() {
      return xp.level;
    },
    get hp() {
      return Math.ceil(player.hp);
    },
    get runTime() {
      return runTime;
    },
    get results() {
      return results;
    },
    get build() {
      return {
        weapons: weapons.list.map((w) => `${w.id} L${w.level}${w.evolved ? " ★" : ""}`),
        passives: player.passiveItems.slice(),
        speed: player.speed,
        pickupRadius: player.pickupRadius,
        maxHp: player.maxHp,
      };
    },
    evolution: evoChests,
    get achievements() {
      return {
        unlocked: save.achievements.unlocked.slice(),
        roster: save.unlockedCharacters.slice(),
        stats: JSON.parse(JSON.stringify(save.stats)),
        titles: save.titles.slice(),
      };
    },
    toasts,
    get save() {
      return save;
    },
    get selectedCharacterId() {
      return CHARACTERS_LIST[selectedIndex]?.id;
    },
    get ownedTools() {
      return getOwnedTools(save).map((t) => ({ id: t.id, name: t.name, category: t.category, rarity: t.rarity }));
    },
    loadoutOf(charId) {
      return getLoadout(save, charId);
    },
    tryEquip(charId, toolId) {
      const t = getOwnedTools(save).find((x) => x.id === toolId);
      if (!t) return { ok: false, reason: "not owned" };
      const r = equipTool(save, charId, t);
      if (r.ok) writeSave(save);
      return r;
    },
    startRun,
    machine,
    xp,
    weapons,
    spawner,
    get player() {
      return player; // `player` is reassigned each run — always return the live one
    },
  };
}

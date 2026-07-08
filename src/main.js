// main.js
// Entry point. Wires the canvas, fixed-timestep loop, input, state machine, and
// (new) the player + camera + scrolling world. The loop and state machine from
// the scaffold are preserved unchanged; gameplay is layered into the PLAYING
// state.

import { createCanvas } from "./engine/canvas.js";
import { createLoop } from "./engine/loop.js";
import {
  initInput,
  updateInput,
  pressed,
  endFrameInput,
  consumeTap,
  consumeWheel,
  setTouchJoystickEnabled,
  padDisconnected,
} from "./engine/input.js";
import { clearRegions, hitRegion } from "./engine/hitRegions.js";
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
import { EVOLUTIONS, INPUT } from "./data/balance.js";
import { PASSIVES } from "./data/passives.js";
import { seedRng, clearRng } from "./engine/rng.js";
import { dailyFor } from "./data/daily.js";
import {
  startScoredAttempt,
  recordScoredResult,
  finalizeStaleAttempts,
  myRank,
  myShareCode,
  importShareCode,
  getAttempt,
  canPlayScored,
} from "./meta/daily.js";
import { drawDaily, dailyButtons } from "./ui/dailyScreen.js";
import { drawHud } from "./ui/hud.js";
import { drawTouchControls } from "./ui/touchControls.js";
import { drawUpgradeScreen } from "./ui/upgradeScreen.js";
import { drawEvolutionScreen, EVOLUTION_DISMISS_DELAY } from "./ui/evolutionScreen.js";
import { drawGameOver } from "./ui/gameoverScreen.js";
import { drawCharacterSelect } from "./ui/characterSelect.js";
import { drawCollection, collectionCols } from "./ui/collectionScreen.js";
import { drawEquip, equipCols } from "./ui/equipScreen.js";
import { drawHub, HUB_OPTIONS, drawResetConfirm } from "./ui/hubScreen.js";
import { drawShop } from "./ui/shopScreen.js";
import { drawFusion, fusionCols } from "./ui/fusionScreen.js";
import { fuse, fusionInfo } from "./meta/fusion.js";
import { drawPauseMenu, drawSettings, PAUSE_OPTIONS } from "./ui/pauseMenu.js";
import { createToasts } from "./ui/toasts.js";
import { drawAchievements, achievementRows } from "./ui/achievementsScreen.js";
import { buyUpgrade, SHOP_UPGRADES } from "./data/shop.js";
import { loadSave, writeSave, resetSave } from "./meta/saveManager.js";
import { createRunPlayer } from "./meta/runSetup.js";
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
import { TOOL_CATEGORIES, makeTool, resolveToolWeaponDef } from "./data/tools.js";
import { WORLD } from "./data/world.js";

const view = createCanvas("game");
const { ctx } = view;
initInput(view.canvas, INPUT); // action layer: keyboard + gamepad + touch

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
let runMode = "normal"; // "normal" | "daily-scored" | "daily-practice"
let dailyContext = null; // the daily config for the active run (date/seed/prescription)
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
  // Anti-reroll: a scored daily left "in_progress" (tab closed/reloaded
  // mid-run) is spent as a DNF now, so it can't be retried this session.
  if (finalizeStaleAttempts(save)) writeSave(save);
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
let levelUpSel = 0; // level-up draft cursor (gamepad/keyboard nav)
let padWarning = false; // "controller disconnected" banner on the pause menu
let dailySel = 0; // daily-screen button cursor
let dailyMessage = null; // copy/import feedback { ok, text }

// Allowed flow transitions. The HUB is home base; runs always land back there.
const machine = createStateMachine(GameState.HUB, {
  [GameState.HUB]: [GameState.MENU, GameState.COLLECTION, GameState.SHOP, GameState.FUSION, GameState.ACHIEVEMENTS, GameState.DAILY],
  [GameState.MENU]: [GameState.PLAYING, GameState.EQUIP, GameState.HUB],
  [GameState.COLLECTION]: [GameState.HUB],
  [GameState.SHOP]: [GameState.HUB],
  [GameState.FUSION]: [GameState.HUB],
  [GameState.ACHIEVEMENTS]: [GameState.HUB],
  [GameState.DAILY]: [GameState.HUB, GameState.PLAYING], // start today's daily
  [GameState.EQUIP]: [GameState.MENU],
  [GameState.PLAYING]: [GameState.PAUSED, GameState.LEVELUP, GameState.EVOLUTION, GameState.GAMEOVER],
  [GameState.PAUSED]: [GameState.PLAYING, GameState.HUB],
  [GameState.LEVELUP]: [GameState.PLAYING],
  [GameState.EVOLUTION]: [GameState.PLAYING],
  [GameState.GAMEOVER]: [GameState.HUB, GameState.MENU, GameState.DAILY], // MENU = "press C" shortcut; DAILY = return after a daily run
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
  if (next === GameState.PLAYING) padWarning = false; // resumed — banner done
});

// Start a run with the currently selected character: resolve its persisted-level
// stats into the run player, reset the run systems, then enter PLAYING.
// `daily` = null for a normal run, or { date, seed, characterId, baseId,
// rarity, scored } for a Daily Challenge run.
function startRun(daily = null) {
  let def;
  let loadoutDefs;

  if (daily) {
    def = CHARACTERS_BY_ID[daily.characterId];
    runMode = daily.scored ? "daily-scored" : "daily-practice";
    dailyContext = daily;
    // FAIRNESS: level 1 + an empty shop disables all meta bonuses (character
    // levels + shop upgrades), so the board measures play, not grind. The
    // character's PASSIVE stays — that's identity, not progression.
    player = createRunPlayer(def, { level: 1, xp: 0 }, { shop: {} }, WORLD);
    loadoutDefs = [resolveToolWeaponDef(makeTool(daily.baseId, daily.rarity))];
    seedRng(daily.seed); // everyone on this date shares one deterministic stream
    // Consume the scored attempt immediately (anti-reroll persistence).
    if (daily.scored) {
      startScoredAttempt(save, daily.date, daily.seed);
      writeSave(save);
    }
  } else {
    def = CHARACTERS_LIST[selectedIndex];
    if (!isCharacterUnlocked(save, def.id)) return; // achievement-gated
    runMode = "normal";
    dailyContext = null;
    save.lastSelectedCharacterId = def.id;
    writeSave(save);
    // Shared with the headless sim so starting stats/passives can't diverge.
    const prog = save.characters[def.id] || { level: 1, xp: 0 };
    player = createRunPlayer(def, prog, save, WORLD);
    // Empty loadout (e.g. a newly added roster member on an old save): auto-equip
    // the first compatible owned tool so the run isn't weaponless.
    if (resolveRunWeaponDefs(save, def.id).length === 0) {
      const match = getOwnedTools(save).find((t) => t.category === def.specialization);
      if (match && equipTool(save, def.id, match).ok) writeSave(save);
    }
    loadoutDefs = resolveRunWeaponDefs(save, def.id);
    clearRng(); // normal play is unseeded (unchanged feel)
  }

  currentCharId = def.id;
  currentChar = def;

  weapons.setLoadout(loadoutDefs);
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

// The hub's DAILY row desc: today's prescription + attempt status (so the hub
// doubles as the daily card).
function dailyStatusLine() {
  const d = dailyFor();
  const char = CHARACTERS_BY_ID[d.characterId];
  const who = `${char ? char.name : d.characterId} · ${d.rarity} ${d.baseId.replace(/_/g, " ")}`;
  const a = getAttempt(save, d.date);
  const status = a && a.status === "done" ? `score ${a.score.toLocaleString()}` : a && a.status === "dnf" ? "attempt spent" : "not played";
  return `${who} — ${status}`;
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

// Restart the current run (from the pause menu). A scored daily can't be
// restarted — the attempt is already consumed — so it bounces to the hub
// instead of re-rolling. Practice dailies restart as practice.
function restartRun() {
  if (runMode === "daily-scored") {
    machine.transition(GameState.HUB);
    return;
  }
  if (runMode === "daily-practice" && dailyContext) {
    startRun({ ...dailyContext, scored: false });
    return;
  }
  const idx = CHARACTERS_LIST.findIndex((c) => c.id === currentCharId);
  if (idx !== -1) selectedIndex = idx;
  startRun(); // PAUSED -> PLAYING is an allowed transition
}

// Open the upgrade draft for a queued level-up.
function openLevelUp() {
  upgradeOptions = rollUpgrades(weapons, player, currentChar, 3);
  levelUpSel = 0;
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
    levelUpSel = 0;
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

// End the run. Normal + scored-daily runs grant rewards and evaluate
// achievements; a scored daily additionally records its score to the local
// board. Practice dailies grant nothing and record nothing (warm-up only).
function endRun() {
  const def = CHARACTERS_BY_ID[currentCharId];
  const runStats = {
    time: runTime,
    level: xp.level,
    kills: weapons.kills,
    bossKills: weapons.bossKills,
  };
  fx.onPlayerDeath();

  // Practice daily: no rewards, no score, no stat banking.
  if (runMode === "daily-practice") {
    results = { ...runStats, daily: { practice: true } };
    machine.transition(GameState.GAMEOVER);
    return;
  }

  // Rewards apply to normal + scored-daily runs (playing the daily never feels
  // like a detour). Meta bonuses were off during the run, but rewards earned
  // still bank to the profile.
  const reward = grantRunRewards(save, currentCharId, runStats); // mutates the save

  // Achievement checkpoint (end of run): bank the run's raw numbers into the
  // lifetime stats layer, then evaluate — AFTER rewards so fresh character
  // levels / tool drops / run counts all count.
  recordRunStats(save, runStats, def?.specialization);
  const newAchievements = evaluateAchievements(save);

  let daily = null;
  if (runMode === "daily-scored" && dailyContext) {
    const { total, parts } = recordScoredResult(save, dailyContext.date, runStats);
    daily = {
      date: dailyContext.date,
      total,
      parts,
      rank: myRank(save, dailyContext.date),
      code: myShareCode(save, dailyContext.date),
    };
  }

  writeSave(save);
  toastAchievements(newAchievements);

  const unlockedCharId = newAchievements.find((a) => a.reward?.characterId)?.reward.characterId;
  results = {
    ...runStats,
    gold: reward.gold,
    droppedTool: reward.droppedTool,
    character: { name: def ? def.name : currentCharId, ...reward.characterXp },
    achievements: newAchievements,
    unlockedCharacter: unlockedCharId ? CHARACTERS_BY_ID[unlockedCharId] : null,
    daily,
  };
  machine.transition(GameState.GAMEOVER);
}

let elapsed = 0; // total loop uptime (s) — proves the loop ticks
let runTime = 0; // time in the current run (s)

// Activate the currently selected hub option (shared by confirm + tap).
function activateHubOption() {
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
  } else if (dest === "daily") {
    dailySel = 0;
    dailyMessage = null;
    machine.transition(GameState.DAILY);
  } else if (dest === "reset") {
    confirmReset = true;
  } else {
    // "play" and "roster" both open the character roster; from there Play
    // continues into equip/run, Roster is for browsing.
    machine.transition(GameState.MENU);
  }
}

// Daily-screen button actions. Copy/import use the clipboard as an honest
// stand-in for a leaderboard backend (a real backend would POST/GET here).
function activateDailyButton(id) {
  const d = dailyFor();
  if (id === "scored") {
    if (canPlayScored(save, d.date)) startRun({ ...d, scored: true });
  } else if (id === "practice") {
    startRun({ ...d, scored: false });
  } else if (id === "copy") {
    const code = myShareCode(save, d.date);
    if (code && navigator.clipboard) {
      navigator.clipboard.writeText(code).then(
        () => (dailyMessage = { ok: true, text: "Share code copied to clipboard!" }),
        () => (dailyMessage = { ok: false, text: `Code: ${code}` })
      );
    } else {
      dailyMessage = code ? { ok: true, text: `Code: ${code}` } : null;
    }
  } else if (id === "import") {
    if (navigator.clipboard && navigator.clipboard.readText) {
      navigator.clipboard.readText().then(
        (text) => {
          const r = importShareCode(save, text.trim());
          if (r.ok) writeSave(save);
          dailyMessage = { ok: r.ok, text: r.ok ? `Imported ${r.entry.name}'s score!` : r.reason };
        },
        () => (dailyMessage = { ok: false, text: "Clipboard blocked — paste not available" })
      );
    } else {
      dailyMessage = { ok: false, text: "Clipboard not available in this browser" };
    }
  } else if (id === "back") {
    machine.transition(GameState.HUB);
  }
}

function activatePauseOption() {
  const action = PAUSE_OPTIONS[pauseSel].id;
  if (action === "resume") machine.transition(GameState.PLAYING);
  else if (action === "restart") restartRun();
  else if (action === "settings") pauseMode = "settings";
  else if (action === "quit") machine.transition(GameState.HUB);
}

function adjustVolume(step) {
  save.settings.masterVolume =
    Math.round(Math.min(1, Math.max(0, (save.settings.masterVolume ?? 1) + step)) * 10) / 10;
  writeSave(save);
  fx.setVolume(save.settings.masterVolume);
}

// All flow input is ACTIONS (pressed(...)) plus taps hit-tested against the
// regions the previous frame's render registered. Tap ids follow a convention:
// "sel:N" selects (and, where safe, activates) item N; "back"/"confirm"/named
// ids mirror their action counterparts.
function handleTransitions() {
  const tap = consumeTap();
  const tapId = tap ? hitRegion(tap.x, tap.y) : null;
  const tapSel = tapId && tapId.startsWith("sel:") ? Number(tapId.slice(4)) : null;

  switch (machine.current) {
    case GameState.HUB:
      if (confirmReset) {
        // Destructive action — explicit confirmation gate.
        if (pressed("confirm") || tapId === "confirm") {
          resetSave(save);
          selectedIndex = 0;
          hubSel = 0;
          confirmReset = false;
        } else if (pressed("cancel") || tapId === "back") {
          confirmReset = false;
        }
      } else if (pressed("navUp"))
        hubSel = (hubSel + HUB_OPTIONS.length - 1) % HUB_OPTIONS.length;
      else if (pressed("navDown"))
        hubSel = (hubSel + 1) % HUB_OPTIONS.length;
      else if (tapSel !== null) {
        hubSel = tapSel; // hub rows are safe to tap-activate directly
        activateHubOption();
      } else if (pressed("confirm")) activateHubOption();
      break;

    case GameState.SHOP:
      if (pressed("cancel") || tapId === "back") machine.transition(GameState.HUB);
      else if (pressed("navUp"))
        shopSel = (shopSel + SHOP_UPGRADES.length - 1) % SHOP_UPGRADES.length;
      else if (pressed("navDown"))
        shopSel = (shopSel + 1) % SHOP_UPGRADES.length;
      else if (pressed("confirm") || (tapSel !== null && tapSel === shopSel)) {
        // Spends gold — taps must select first, then tap again to buy.
        const u = SHOP_UPGRADES[shopSel];
        const r = buyUpgrade(save, u.id);
        if (r.ok) writeSave(save);
        shopMessage = { ok: r.ok, text: r.ok ? `${u.name} upgraded!` : r.reason };
      } else if (tapSel !== null) shopSel = tapSel;
      break;

    case GameState.FUSION: {
      const stacks = getOwnedTools(save);
      if (fusionMode === "reveal") {
        if (pressed("confirm") || pressed("cancel") || tapId === "confirm") {
          fusionMode = "browse";
          if (fusionSel >= stacks.length) fusionSel = Math.max(0, stacks.length - 1);
        }
      } else if (fusionMode === "confirm") {
        if (pressed("cancel") || tapId === "back") fusionMode = "browse";
        else if (pressed("confirm") || tapId === "confirm") {
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
        const openConfirm = () => {
          const t = stacks[fusionSel];
          if (t && fusionInfo(save, t.baseId, t.rarity).fusable) fusionMode = "confirm";
        };
        if (pressed("cancel") || tapId === "back") machine.transition(GameState.HUB);
        else if (pressed("confirm")) openConfirm();
        else if (tapSel !== null) {
          if (tapSel === fusionSel) openConfirm(); // second tap = act
          else fusionSel = tapSel;
        } else {
          for (const [action, code] of NAV_CODES)
            if (pressed(action)) fusionSel = moveGrid(fusionSel, stacks.length, fusionCols(view.width), code);
        }
        if (fusionSel >= stacks.length) fusionSel = Math.max(0, stacks.length - 1);
      }
      break;
    }

    case GameState.MENU:
      if (pressed("navLeft"))
        selectedIndex = (selectedIndex + CHARACTERS_LIST.length - 1) % CHARACTERS_LIST.length;
      else if (pressed("navRight"))
        selectedIndex = (selectedIndex + 1) % CHARACTERS_LIST.length;
      else if (pressed("equip") || tapId === "equip") {
        // Equipping is only meaningful for unlocked characters.
        if (isCharacterUnlocked(save, CHARACTERS_LIST[selectedIndex].id)) {
          equipSel = 0;
          machine.transition(GameState.EQUIP);
        }
      } else if (pressed("cancel") || tapId === "back") machine.transition(GameState.HUB);
      else if (pressed("confirm") || tapId === "start") startRun(); // no-op on locked cards
      else if (tapSel !== null) {
        if (tapSel === selectedIndex) startRun(); // second tap = start
        else selectedIndex = tapSel;
      }
      break;

    case GameState.ACHIEVEMENTS: {
      const maxScroll = Math.max(0, achievementRows(save).length - 6);
      const wheel = consumeWheel();
      if (pressed("cancel") || tapId === "back") machine.transition(GameState.HUB);
      else if (pressed("navUp") || tapId === "scrollUp")
        achievementsScroll = Math.max(0, achievementsScroll - 1);
      else if (pressed("navDown") || tapId === "scrollDown")
        achievementsScroll = Math.min(maxScroll, achievementsScroll + 1);
      else if (wheel !== 0)
        achievementsScroll = Math.max(0, Math.min(maxScroll, achievementsScroll + Math.sign(wheel)));
      break;
    }

    case GameState.DAILY: {
      const buttons = dailyButtons(save, dailyFor().date);
      if (pressed("cancel") || tapId === "back") machine.transition(GameState.HUB);
      else if (pressed("navUp")) dailySel = (dailySel + buttons.length - 1) % buttons.length;
      else if (pressed("navDown")) dailySel = (dailySel + 1) % buttons.length;
      else if (tapSel !== null) {
        dailySel = tapSel;
        activateDailyButton(buttons[tapSel]?.id);
      } else if (pressed("confirm")) activateDailyButton(buttons[dailySel]?.id);
      if (dailySel >= buttons.length) dailySel = Math.max(0, buttons.length - 1);
      break;
    }

    case GameState.COLLECTION: {
      const { list } = collectionTools();
      if (pressed("filterCat") || tapId === "filterCat") {
        collectionCatIdx = (collectionCatIdx + 1) % (TOOL_CATEGORIES.length + 1);
        collectionSel = 0;
      } else if (pressed("filterRar") || tapId === "filterRar") {
        collectionRarIdx = (collectionRarIdx + 1) % (RARITY_ORDER.length + 1);
        collectionSel = 0;
      } else if (pressed("cancel") || pressed("tryChar") || tapId === "back") {
        machine.transition(GameState.HUB);
      } else if (tapSel !== null) {
        collectionSel = tapSel;
      } else {
        for (const [action, code] of NAV_CODES)
          if (pressed(action)) collectionSel = moveGrid(collectionSel, list.length, collectionCols(view.width), code);
      }
      if (collectionSel >= list.length) collectionSel = Math.max(0, list.length - 1);
      break;
    }

    case GameState.EQUIP: {
      const owned = getOwnedTools(save);
      const charDef = CHARACTERS_LIST[selectedIndex];
      const equipSelected = () => {
        const tool = owned[equipSel];
        if (!tool) return;
        const r = equipTool(save, charDef.id, tool); // enforces the spec rule
        if (r.ok) writeSave(save);
      };
      const unequipSelected = () => {
        const tool = owned[equipSel];
        if (tool && isEquipped(save, charDef.id, tool.id)) {
          unequipTool(save, charDef.id, tool.id);
          writeSave(save);
        }
      };
      if (pressed("cancel") || pressed("equip") || tapId === "back") {
        machine.transition(GameState.MENU);
      } else if (pressed("confirm")) equipSelected();
      else if (pressed("remove")) unequipSelected();
      else if (tapSel !== null) {
        if (tapSel === equipSel) {
          // Second tap toggles: equipped → unequip, otherwise equip.
          const tool = owned[equipSel];
          if (tool && isEquipped(save, charDef.id, tool.id)) unequipSelected();
          else equipSelected();
        } else equipSel = tapSel;
      } else {
        for (const [action, code] of NAV_CODES)
          if (pressed(action)) equipSel = moveGrid(equipSel, owned.length, equipCols(view.width), code);
      }
      if (equipSel >= owned.length) equipSel = Math.max(0, owned.length - 1);
      break;
    }

    case GameState.PLAYING:
      if (pressed("pause") || tapId === "pause") machine.transition(GameState.PAUSED);
      else if (pressed("debugDie")) endRun(); // debug: instant death
      break;

    case GameState.PAUSED:
      if (pauseMode === "settings") {
        if (pressed("cancel") || tapId === "back") pauseMode = "menu";
        else if (pressed("navLeft") || tapId === "volDown") adjustVolume(-0.1);
        else if (pressed("navRight") || tapId === "volUp") adjustVolume(0.1);
      } else if (pressed("pause")) {
        machine.transition(GameState.PLAYING);
      } else if (pressed("navUp")) {
        pauseSel = (pauseSel + PAUSE_OPTIONS.length - 1) % PAUSE_OPTIONS.length;
      } else if (pressed("navDown")) {
        pauseSel = (pauseSel + 1) % PAUSE_OPTIONS.length;
      } else if (tapSel !== null) {
        pauseSel = tapSel; // pause rows are safe to tap-activate directly
        activatePauseOption();
      } else if (pressed("confirm")) activatePauseOption();
      break;

    case GameState.LEVELUP: {
      const n = upgradeOptions.length;
      if (pressed("choice1")) pickUpgrade(0);
      else if (pressed("choice2")) pickUpgrade(1);
      else if (pressed("choice3")) pickUpgrade(2);
      else if (tapId && tapId.startsWith("pick:")) pickUpgrade(Number(tapId.slice(5)));
      else if (n > 0) {
        // Stick/d-pad navigation with a visible cursor + confirm.
        if (pressed("navLeft") || pressed("navUp")) levelUpSel = (levelUpSel + n - 1) % n;
        else if (pressed("navRight") || pressed("navDown")) levelUpSel = (levelUpSel + 1) % n;
        else if (pressed("confirm")) pickUpgrade(levelUpSel);
      }
      break;
    }

    case GameState.EVOLUTION:
      // Let the reveal land before accepting the dismiss.
      if (
        (performance.now() - evolutionRevealAt) / 1000 > EVOLUTION_DISMISS_DELAY &&
        (pressed("confirm") || tapId === "confirm")
      ) {
        evolutionReveal = null;
        machine.transition(GameState.PLAYING);
      }
      break;

    case GameState.GAMEOVER:
      // Copy the daily share code (tap only).
      if (tapId === "copyDaily" && results.daily && results.daily.code) {
        if (navigator.clipboard) navigator.clipboard.writeText(results.daily.code).catch(() => {});
      } else if (pressed("confirm") || tapId === "continue") {
        // A daily run returns to the daily screen; normal runs go to the hub.
        if (results.daily) {
          dailySel = 0;
          dailyMessage = null;
          machine.transition(GameState.DAILY);
        } else machine.transition(GameState.HUB);
      } else if ((pressed("tryChar") || tapId === "tryChar") && results.unlockedCharacter) {
        // Shortcut: jump straight to the freshly unlocked specialist.
        const idx = CHARACTERS_LIST.findIndex((c) => c.id === results.unlockedCharacter.id);
        if (idx !== -1) selectedIndex = idx;
        machine.transition(GameState.MENU);
      }
      break;
  }
}

// nav action → the direction code moveGrid understands.
const NAV_CODES = [
  ["navLeft", "ArrowLeft"],
  ["navRight", "ArrowRight"],
  ["navUp", "ArrowUp"],
  ["navDown", "ArrowDown"],
];

function update(dt) {
  elapsed += dt;

  updateInput(dt); // poll the gamepad backend (buttons + stick nav)
  // Lower-left touches steer the run; everywhere else they're taps.
  setTouchJoystickEnabled(machine.current === GameState.PLAYING);

  // The active controller dropped mid-run: pause and explain (overlay banner).
  if (padDisconnected() && machine.current === GameState.PLAYING) {
    padWarning = true;
    machine.transition(GameState.PAUSED);
  }

  // Global: toggle the diagnostics overlay.
  if (pressed("debugToggle")) showDebug = !showDebug;

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

  // Tap targets are re-registered by whatever this frame draws.
  clearRegions();

  switch (machine.current) {
    case GameState.PLAYING:
      renderWorld();
      drawHud(ctx, view, hudData());
      drawTouchControls(ctx, view); // joystick + pause button (touch only)
      if (showDebug) renderOverlay();
      break;

    case GameState.LEVELUP:
      renderWorld();
      drawHud(ctx, view, hudData());
      drawUpgradeScreen(ctx, view, upgradeOptions, levelUpSel);
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
        drawPauseMenu(
          ctx,
          view,
          pauseSel,
          { weapons: weapons.list, passives: player.passiveItems },
          padWarning
        );
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

    case GameState.DAILY:
      drawDaily(ctx, view, { save, selectedButton: dailySel, message: dailyMessage });
      break;

    case GameState.HUB:
    default:
      drawHub(ctx, view, { save, selectedIndex: hubSel, dailyStatus: dailyStatusLine() });
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
    // Daily-challenge inspection/testing.
    get daily() {
      return {
        today: dailyFor(),
        runMode,
        attempts: JSON.parse(JSON.stringify(save.daily.attempts)),
        imported: JSON.parse(JSON.stringify(save.daily.imported)),
      };
    },
    startDaily(scored = true) {
      startRun({ ...dailyFor(), scored });
    },
    machine,
    xp,
    weapons,
    spawner,
    get player() {
      return player; // `player` is reassigned each run — always return the live one
    },
  };
}

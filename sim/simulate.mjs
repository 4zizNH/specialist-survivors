// sim/simulate.mjs
// Headless balance harness. Steps the REAL game systems (the same spawner,
// weapons, xp, difficulty scaling, enemy AI, and level-up draft as the live
// game) at a fixed dt with no canvas and no real-time waiting — so balance can
// be measured numerically. A pluggable bot (sim/bot.mjs) drives movement and
// upgrade choices; all gameplay randomness flows through the seeded RNG
// (src/engine/rng.js), so same seed + same config ⇒ identical run.
//
//   npm run simulate -- [--seeds=N] [--maxTime=S] [--suite=all|roster|tools|rarity]
//                       [--strategy=balanced|always-damage|random]
//                       [--json=path] [--csv=path] [--no-exit]
//
// Prints a comparison table per suite, flags balance smells against tunable
// thresholds, runs regression assertions (nonzero exit on failure), verifies
// determinism, and reports sim throughput.

import { writeFileSync } from "node:fs";

import { WORLD } from "../src/data/world.js";
import { seedRng, rng } from "../src/engine/rng.js";
import { createSpawner } from "../src/systems/spawner.js";
import { createWeaponSystem } from "../src/systems/weapons.js";
import { createXpSystem } from "../src/systems/xp.js";
import { createEvolutionChests, makeEvolvedDef } from "../src/systems/evolution.js";
import { rollUpgrades } from "../src/systems/upgrades.js";
import { createRunPlayer } from "../src/meta/runSetup.js";
import { makeTool, resolveToolWeaponDef } from "../src/data/tools.js";
import { CHARACTERS_BY_ID } from "../src/data/characters.js";

import { createBot } from "./bot.mjs";
import { buildScenarios, THRESHOLDS, REFERENCE, RARITY_REF } from "./scenarios.mjs";

const DT = 1 / 60; // must match engine/loop.js FIXED_DT
const SIM_VIEW = { width: 1280, height: 720 }; // canonical viewport for spawn rings
const NOOP_TEXT = { spawn() {}, update() {}, reset() {} }; // floating damage numbers are cosmetic

// --- One run of the REAL systems -------------------------------------------

function simulateRun({ character, tools, strategy = "balanced", level = 1, seed, maxTime }) {
  seedRng(seed); // deterministic stream for this run

  const def = CHARACTERS_BY_ID[character];
  const spawner = createSpawner(WORLD);
  const weapons = createWeaponSystem(WORLD);
  const xp = createXpSystem();
  const evo = createEvolutionChests();

  const player = createRunPlayer(def, { level, xp: 0 }, { shop: {} }, WORLD);
  weapons.setLoadout(tools.map((t) => resolveToolWeaponDef(makeTool(t.baseId, t.rarity))));
  spawner.reset();
  weapons.reset();
  xp.reset();
  evo.reset();

  const bot = createBot(spawner, xp, rng, { world: WORLD, strategy });
  player.moveSource = () => bot.move(player);

  const maxSteps = Math.ceil(maxTime / DT);
  let t = 0;
  let steps = 0;
  let firstThreatT = null;
  const xpCurve = [];

  while (player.hp > 0 && steps < maxSteps) {
    player.update(DT, WORLD);
    spawner.update(DT, t, player, SIM_VIEW, null);
    weapons.update(DT, player, spawner, NOOP_TEXT, xp, null, (x, y) =>
      evo.onEliteKill(x, y, weapons, player)
    );
    xp.update(DT, player, null);
    const chest = evo.update(DT, player);

    t += DT;
    steps++;

    if (firstThreatT === null && player.damageTaken > 0) firstThreatT = t;

    if (chest) {
      const d = makeEvolvedDef(chest.baseId);
      if (d) weapons.evolveWeapon(chest.baseId, d);
    } else if (xp.pendingLevelUps > 0) {
      // The live game opens the draft and pauses; headless drains it inline.
      let guard = 0;
      while (xp.pendingLevelUps > 0 && guard++ < 50) {
        const options = rollUpgrades(weapons, player, def, 3);
        const idx = bot.pickUpgrade(options);
        if (options[idx]) options[idx].apply(weapons, player);
        xp.consumeLevelUp();
      }
    }

    if (steps % 600 === 0) xpCurve.push({ t: Math.round(t), level: xp.level });
  }

  return {
    survival: t,
    steps,
    level: xp.level,
    kills: weapons.kills,
    bossKills: weapons.bossKills,
    damageDealt: weapons.damageDealt,
    damageTaken: player.damageTaken,
    firstThreatT: firstThreatT ?? t,
    xpCurve,
  };
}

// Run one cell across N seeds and aggregate.
function runCell(cell, seeds, maxTime) {
  const runs = seeds.map((seed) => simulateRun({ ...cell, seed, maxTime }));
  const surv = runs.map((r) => r.survival);
  return {
    ...cell,
    n: runs.length,
    steps: sum(runs.map((r) => r.steps)),
    medianSurv: median(surv),
    meanSurv: mean(surv),
    meanKills: mean(runs.map((r) => r.kills)),
    meanLevel: mean(runs.map((r) => r.level)),
    meanDmg: mean(runs.map((r) => r.damageDealt)),
    meanTaken: mean(runs.map((r) => r.damageTaken)),
    meanFirstThreat: mean(runs.map((r) => r.firstThreatT)),
  };
}

// --- Suites -----------------------------------------------------------------

function reportRoster(cells) {
  const avg = mean(cells.map((c) => c.medianSurv));
  const rows = cells.map((c) => {
    const dev = pct(c.medianSurv - avg, avg);
    const flagged = Math.abs(dev) > THRESHOLDS.rosterDeviationPct;
    return {
      row: c,
      dev,
      flagged,
      out: {
        Character: c.label,
        Cat: c.category,
        "Median s": fixed(c.medianSurv),
        "Mean s": fixed(c.meanSurv),
        Kills: Math.round(c.meanKills),
        Level: fixed(c.meanLevel, 1),
        "Dev%": signed(dev),
        "": flagged ? "⚠" : "",
      },
    };
  });
  return { title: `ROSTER — median survival vs roster avg (${fixed(avg)}s)`, rows };
}

function reportTools(cells) {
  const byCat = groupBy(cells, (c) => c.subgroup);
  const rows = [];
  for (const [cat, list] of byCat) {
    const catSurv = mean(list.map((c) => c.meanSurv));
    const catDmg = mean(list.map((c) => c.meanDmg));
    for (const c of list) {
      const vsSurv = pct(c.meanSurv - catSurv, catSurv);
      const vsDmg = catDmg > 0 ? c.meanDmg / catDmg : 0;
      const flagged = vsSurv > THRESHOLDS.toolOutperformPct || vsDmg > THRESHOLDS.toolDamageMultCap;
      rows.push({
        row: c,
        catSurv,
        catDmg,
        vsSurv,
        vsDmg,
        flagged,
        out: {
          Tool: c.label,
          Cat: cat,
          "Mean s": fixed(c.meanSurv),
          Kills: Math.round(c.meanKills),
          "Mean dmg": Math.round(c.meanDmg),
          "vsCat surv%": signed(vsSurv),
          "vsCat dmg×": fixed(vsDmg, 2),
          "": flagged ? "⚠" : "",
        },
      });
    }
  }
  return { title: "TOOLS — within each category (survival + damage vs category mean)", rows };
}

function reportRarity(cells, maxTime) {
  const common = cells.find((c) => c.rarity === "common");
  const base = common ? common.medianSurv : cells[0].medianSurv;
  const rows = cells.map((c) => {
    const swing = pct(c.medianSurv - base, base);
    return {
      row: c,
      swing,
      out: {
        Rarity: c.rarity,
        "Median s": fixed(c.medianSurv),
        "Mean s": fixed(c.meanSurv),
        Kills: Math.round(c.meanKills),
        "Mean dmg": Math.round(c.meanDmg),
        "vsCommon%": signed(swing),
      },
    };
  });
  const topSwing = pct(Math.max(...cells.map((c) => c.medianSurv)) - base, base);
  // If even Common survives to the cap, survival can't differentiate rarity —
  // report on kills/damage instead of a bogus "pointless" flag.
  const saturated = base >= maxTime - 1;
  return { title: `RARITY — ${RARITY_REF.baseId} across tiers (swing vs common)`, rows, topSwing, saturated };
}

// --- Main -------------------------------------------------------------------

function main() {
  const args = parseArgs(process.argv.slice(2));
  const N = int(args.seeds, 6);
  const maxTime = int(args.maxTime, 240);
  const strategy = args.strategy || "balanced";
  const which = args.suite || "all";
  const seeds = Array.from({ length: N }, (_, i) => ((i + 1) * 0x9e3779b1) >>> 0);

  console.log(
    `\nSpecialist Survivors — headless balance sim` +
      `\n  seeds=${N}  maxTime=${maxTime}s  strategy=${strategy}  suite=${which}\n`
  );

  const t0 = Date.now();
  const scen = buildScenarios({ strategy });
  const results = {};
  let totalSteps = 0;

  const runSuite = (key) => {
    const cells = scen[key].map((cell) => {
      const agg = runCell(cell, seeds, maxTime);
      totalSteps += agg.steps;
      return agg;
    });
    results[key] = cells;
    return cells;
  };

  const reports = [];
  if (which === "all" || which === "roster") reports.push(reportRoster(runSuite("roster")));
  if (which === "all" || which === "tools") reports.push(reportTools(runSuite("tools")));
  if (which === "all" || which === "rarity") reports.push(reportRarity(runSuite("rarity"), maxTime));

  for (const rep of reports) {
    console.log(`\n=== ${rep.title} ===`);
    console.table(rep.rows.map((r) => r.out));
  }

  // --- Balance smells ---
  const smells = collectSmells(reports, results);
  console.log(`\n=== BALANCE SMELLS (${smells.length}) ===`);
  if (smells.length === 0) console.log("  none — everything inside thresholds.");
  else for (const s of smells) console.log(`  ⚠ ${s}`);

  // --- Regression assertions ---
  const assertions = runAssertions(results, maxTime);
  console.log(`\n=== ASSERTIONS ===`);
  for (const a of assertions) console.log(`  ${a.pass ? "PASS" : "FAIL"} — ${a.name}`);
  const failed = assertions.filter((a) => !a.pass);

  // --- Determinism check (short cap — proving identical streams needs no long
  // run, and keeps this cheap) ---
  const detCfg = { character: REFERENCE.character, tools: [{ baseId: REFERENCE.baseId, rarity: REFERENCE.rarity }], strategy, seed: 0xc0ffee, maxTime: Math.min(maxTime, 120) };
  const detA = simulateRun(detCfg);
  const detB = simulateRun(detCfg);
  const deterministic =
    detA.survival === detB.survival &&
    detA.kills === detB.kills &&
    detA.damageDealt === detB.damageDealt &&
    detA.damageTaken === detB.damageTaken;
  console.log(`\n=== DETERMINISM ===`);
  console.log(
    `  same seed + same config ⇒ ${deterministic ? "IDENTICAL ✓" : "DIVERGED ✗"}` +
      `  (survival ${fixed(detA.survival)}s / ${fixed(detB.survival)}s, kills ${detA.kills}/${detB.kills})`
  );

  // --- Throughput ---
  const secs = (Date.now() - t0) / 1000;
  console.log(`\n=== THROUGHPUT ===`);
  console.log(
    `  ${totalSteps.toLocaleString()} sim steps in ${secs.toFixed(1)}s ` +
      `= ${Math.round(totalSteps / secs).toLocaleString()} steps/s ` +
      `(~${(totalSteps / 60 / secs).toFixed(0)}s of game time per real second)`
  );

  // --- Optional exports ---
  if (args.json) {
    writeFileSync(args.json, JSON.stringify(results, null, 2));
    console.log(`\n  wrote JSON → ${args.json}`);
  }
  if (args.csv) {
    writeFileSync(args.csv, toCsv(results));
    console.log(`  wrote CSV  → ${args.csv}`);
  }

  console.log("");
  if (failed.length && !("no-exit" in args)) {
    console.error(`${failed.length} assertion(s) failed.`);
    process.exit(1);
  }
}

function collectSmells(reports, results) {
  const out = [];
  for (const rep of reports) {
    for (const r of rep.rows) {
      if (r.flagged && rep.title.startsWith("ROSTER"))
        out.push(`${r.row.label}: median survival ${signed(r.dev)}% from roster average`);
      if (r.flagged && rep.title.startsWith("TOOLS")) {
        if (r.vsSurv > THRESHOLDS.toolOutperformPct)
          out.push(`${r.row.label}: ${signed(r.vsSurv)}% survival vs its category mean`);
        if (r.vsDmg > THRESHOLDS.toolDamageMultCap)
          out.push(`${r.row.label}: ${fixed(r.vsDmg, 2)}× category mean damage`);
      }
    }
    if (rep.title.startsWith("RARITY")) {
      if (rep.saturated) {
        out.push(
          `rarity survival saturates at the time cap — compare kills/damage instead ` +
            `(the reference build never dies within the run)`
        );
      } else {
        if (rep.topSwing < THRESHOLDS.rarityDeadPct)
          out.push(`rarity feels pointless — top tier only ${signed(rep.topSwing)}% survival over common`);
        if (rep.topSwing > THRESHOLDS.rarityMandatoryPct)
          out.push(`rarity feels mandatory — top tier ${signed(rep.topSwing)}% survival over common`);
      }
    }
  }
  return out;
}

function runAssertions(results, maxTime) {
  const a = [];

  // A1: default character + Common starter clears the survival floor. Only
  // meaningful when the cap allows it (a cap below the floor can't pass).
  const ref = (results.roster || []).find((c) => c.character === REFERENCE.character);
  if (ref && maxTime >= THRESHOLDS.minMedianSurvivalSec) {
    a.push({
      name: `${REFERENCE.character} + Common starter median survival ≥ ${THRESHOLDS.minMedianSurvivalSec}s (got ${fixed(ref.medianSurv)}s)`,
      pass: ref.medianSurv >= THRESHOLDS.minMedianSurvivalSec,
    });
  }

  // A2: no tool's mean damage exceeds Nx its category average.
  if (results.tools) {
    const byCat = groupBy(results.tools, (c) => c.subgroup);
    let worst = null;
    for (const [, list] of byCat) {
      const catDmg = mean(list.map((c) => c.meanDmg));
      for (const c of list) {
        const mult = catDmg > 0 ? c.meanDmg / catDmg : 0;
        if (!worst || mult > worst.mult) worst = { label: c.label, mult };
      }
    }
    a.push({
      name: `no tool mean damage > ${THRESHOLDS.toolDamageMultCap}× category avg (worst ${worst ? worst.label + " " + fixed(worst.mult, 2) + "×" : "n/a"})`,
      pass: !worst || worst.mult <= THRESHOLDS.toolDamageMultCap,
    });
  }

  // A3: nobody in the roster is unplayably weak.
  if (results.roster) {
    const min = results.roster.reduce((m, c) => (c.medianSurv < m.medianSurv ? c : m));
    a.push({
      name: `every character median survival ≥ ${THRESHOLDS.minCharMedianSec}s (weakest ${min.label} ${fixed(min.medianSurv)}s)`,
      pass: min.medianSurv >= THRESHOLDS.minCharMedianSec,
    });
  }

  return a;
}

// --- CSV / helpers ----------------------------------------------------------

function toCsv(results) {
  const lines = ["suite,label,character,category,rarity,n,medianSurv,meanSurv,meanKills,meanLevel,meanDmg,meanTaken,meanFirstThreat"];
  for (const [suite, cells] of Object.entries(results)) {
    for (const c of cells) {
      lines.push(
        [
          suite,
          csv(c.label),
          c.character,
          c.category ?? c.subgroup ?? "",
          c.rarity ?? (c.tools?.[0]?.rarity ?? ""),
          c.n,
          fixed(c.medianSurv),
          fixed(c.meanSurv),
          fixed(c.meanKills, 1),
          fixed(c.meanLevel, 1),
          Math.round(c.meanDmg),
          Math.round(c.meanTaken),
          fixed(c.meanFirstThreat),
        ].join(",")
      );
    }
  }
  return lines.join("\n") + "\n";
}

function csv(s) {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function parseArgs(argv) {
  const out = {};
  for (const a of argv) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    if (m) out[m[1]] = m[2] === undefined ? true : m[2];
  }
  return out;
}
function int(v, d) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : d;
}
function sum(a) {
  return a.reduce((s, x) => s + x, 0);
}
function mean(a) {
  return a.length ? sum(a) / a.length : 0;
}
function median(a) {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function pct(part, whole) {
  return whole ? (part / whole) * 100 : 0;
}
function fixed(v, d = 1) {
  return Number(v).toFixed(d);
}
function signed(v, d = 1) {
  return (v >= 0 ? "+" : "") + Number(v).toFixed(d);
}
function groupBy(arr, key) {
  const m = new Map();
  for (const x of arr) {
    const k = key(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
}

main();

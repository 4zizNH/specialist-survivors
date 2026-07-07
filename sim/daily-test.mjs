// sim/daily-test.mjs
// Focused checks for the Daily Challenge logic (no rendering). Run:
//   node sim/daily-test.mjs
// Exits nonzero if any check fails.

import { seedRng } from "../src/engine/rng.js";
import {
  dailyFor,
  dailySeed,
  prescribeDaily,
  scoreRun,
  encodeShare,
  decodeShare,
} from "../src/data/daily.js";
import { createDefaultSave } from "../src/data/saveSchema.js";
import {
  startScoredAttempt,
  recordScoredResult,
  finalizeStaleAttempts,
  canPlayScored,
  leaderboard,
  myRank,
  streak,
  personalBest,
  importShareCode,
  myShareCode,
} from "../src/meta/daily.js";
import { createSpawner } from "../src/systems/spawner.js";
import { WORLD } from "../src/data/world.js";
import { createPlayer } from "../src/entities/player.js";

let failures = 0;
function check(name, cond) {
  console.log(`  ${cond ? "PASS" : "FAIL"} — ${name}`);
  if (!cond) failures++;
}

// 1. Two profiles on the same date get an identical daily (seed + prescription).
const DATE = "2026-07-07";
const a = dailyFor(DATE);
const b = dailyFor(DATE);
check("same date ⇒ identical seed", a.seed === b.seed);
check(
  "same date ⇒ identical prescription",
  a.characterId === b.characterId && a.baseId === b.baseId && a.rarity === b.rarity
);
console.log(`    → ${DATE}: ${a.characterId} · ${a.rarity} ${a.baseId} (seed ${a.seed})`);

// 2. The SEEDED run is identical for two players (same spawns). Drive the real
//    spawner from the daily seed twice and compare enemy positions.
function spawnFingerprint(seed) {
  seedRng(seed);
  const spawner = createSpawner(WORLD);
  spawner.reset();
  const player = createPlayer(WORLD.width / 2, WORLD.height / 2);
  const view = { width: 1280, height: 720 };
  for (let i = 0; i < 600; i++) spawner.update(1 / 60, i / 60, player, view, null);
  return spawner.enemies
    .filter((e) => e.active)
    .map((e) => `${e.type}:${e.x.toFixed(2)},${e.y.toFixed(2)}`)
    .join("|");
}
const fpA = spawnFingerprint(a.seed);
const fpB = spawnFingerprint(a.seed);
check("same seed ⇒ identical spawn stream (10s)", fpA === fpB && fpA.length > 0);

// 3. Transparent score formula + breakdown.
const s = scoreRun({ time: 125, kills: 240, level: 8, bossKills: 2 });
const expected = 125 * 10 + 240 * 5 + 7 * 50 + 2 * 250;
check("score = 10·time + 5·kills + 50·(lvl-1) + 250·boss", s.total === expected);
check("breakdown parts sum to total", s.parts.time + s.parts.kills + s.parts.level + s.parts.boss === s.total);

// 4. Share codes round-trip; a tampered code is rejected by the checksum.
const code = encodeShare({ date: DATE, seed: a.seed, score: s.total });
const back = decodeShare(code);
check("share code round-trips", back && back.date === DATE && back.seed === a.seed && back.score === s.total);
check("tampered score rejected", decodeShare(code.replace(/\.[^.]+\.[^.]+$/, ".zzzz.zzzz")) === null);
check("garbage rejected", decodeShare("not-a-code") === null);

// 5. Leaderboard: your entry + an imported friend, sorted, with a rank.
const save = createDefaultSave();
startScoredAttempt(save, DATE, a.seed);
check("scored attempt consumed (can't replay)", canPlayScored(save, DATE) === false);
recordScoredResult(save, DATE, { time: 125, kills: 240, level: 8, bossKills: 2 });
const friendCode = encodeShare({ date: DATE, seed: a.seed, score: 999999 });
const imp = importShareCode(save, friendCode, "Rival");
check("friend code imported", imp.ok);
const board = leaderboard(save, DATE);
check("board sorted desc, friend on top", board.length === 2 && board[0].name === "Rival" && board[1].you);
const rk = myRank(save, DATE);
check("your rank computed", rk && rk.rank === 2 && rk.of === 2);
check("personal best reflects your score", personalBest(save) === expected);
check("my share code available after scoring", typeof myShareCode(save, DATE) === "string");

// 6. Anti-reroll: an interrupted (in_progress) attempt becomes a DNF at boot.
const save2 = createDefaultSave();
startScoredAttempt(save2, DATE, a.seed);
const changed = finalizeStaleAttempts(save2, DATE);
check("stale in_progress finalized to DNF", changed && save2.daily.attempts[DATE].status === "dnf");
check("DNF cannot be retried", canPlayScored(save2, DATE) === false);

// 7. Rollover: the next UTC day yields a different seed/prescription.
const tomorrow = "2026-07-08";
check("next day ⇒ different seed", dailySeed(DATE) !== dailySeed(tomorrow));
const p1 = prescribeDaily(dailySeed(DATE));
const p2 = prescribeDaily(dailySeed(tomorrow));
check(
  "next day ⇒ (likely) different prescription",
  p1.characterId !== p2.characterId || p1.baseId !== p2.baseId || p1.rarity !== p2.rarity
);
console.log(`    → ${tomorrow}: ${p2.characterId} · ${p2.rarity} ${p2.baseId}`);

// 8. Streak counts consecutive completed days.
const save3 = createDefaultSave();
for (const d of ["2026-07-05", "2026-07-06", "2026-07-07"]) {
  startScoredAttempt(save3, d, dailySeed(d));
  recordScoredResult(save3, d, { time: 60, kills: 10, level: 2, bossKills: 0 });
}
check("streak counts 3 consecutive days", streak(save3, "2026-07-07") === 3);

console.log(`\n${failures === 0 ? "ALL DAILY CHECKS PASSED" : failures + " CHECK(S) FAILED"}`);
process.exit(failures === 0 ? 0 : 1);

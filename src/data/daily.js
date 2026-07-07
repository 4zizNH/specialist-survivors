// data/daily.js
// The Daily Challenge: everyone playing on a given UTC date gets the identical
// seeded run under fixed rules. Pure logic only (no save access, no rendering)
// so it's trivially testable and shared by the meta layer + UI.
//
// Fairness model:
//  - The seed derives from the UTC date + a game-version salt, so the same day
//    ⇒ identical spawns, drop rolls, and upgrade offers for all players.
//  - The day also PRESCRIBES the character + starting tool + rarity (from the
//    seed), ignoring the player's roster/collection.
//  - Meta bonuses (character permanent levels, shop upgrades) are disabled by
//    the run setup — see main.startRun — so the board measures play, not grind.

import { mulberry32, hashSeed } from "../engine/rng.js";
import { CHARACTERS_LIST } from "./characters.js";
import { TOOL_BASES } from "./tools.js";

// Bump when a balance/content change should give a fresh daily identity even
// on the same calendar date.
export const DAILY_VERSION_SALT = "ss-daily-v1";

// Rarities a daily may prescribe (legendary excluded — kept as a chase, not a
// coin-flip gift that trivializes the board).
const DAILY_RARITIES = ["common", "uncommon", "rare", "epic"];

// --- Dates -----------------------------------------------------------------

// "YYYY-MM-DD" in UTC (toISOString is always UTC).
export function dailyDate(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

// Milliseconds until the next UTC midnight (for the rollover countdown).
export function msUntilNextUTCDay(now = new Date()) {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return next - now.getTime();
}

export function formatCountdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}h ${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
}

// --- Seed + prescription ----------------------------------------------------

export function dailySeed(date) {
  return hashSeed(`${DAILY_VERSION_SALT}:${date}`);
}

// Deterministically derive the day's fixed rules from its seed. Uses a LOCAL
// generator (separate from the gameplay stream) so choosing the prescription
// never perturbs in-run randomness.
export function prescribeDaily(seed) {
  const r = mulberry32(seed ^ 0x5bd1e995); // decorrelate from the run stream
  const char = CHARACTERS_LIST[Math.floor(r() * CHARACTERS_LIST.length)];
  const catTools = Object.values(TOOL_BASES).filter((b) => b.category === char.specialization);
  const tool = catTools[Math.floor(r() * catTools.length)];
  const rarity = DAILY_RARITIES[Math.floor(r() * DAILY_RARITIES.length)];
  return { characterId: char.id, baseId: tool.baseId, rarity };
}

// Everything the UI/meta need for today (or a given date).
export function dailyFor(date = dailyDate()) {
  const seed = dailySeed(date);
  return { date, seed, ...prescribeDaily(seed) };
}

// --- Score (transparent) ----------------------------------------------------

export const SCORE_WEIGHTS = { time: 10, kills: 5, level: 50, boss: 250 };

export function scoreRun({ time = 0, kills = 0, level = 1, bossKills = 0 }) {
  const parts = {
    time: Math.floor(time) * SCORE_WEIGHTS.time,
    kills: kills * SCORE_WEIGHTS.kills,
    level: Math.max(0, level - 1) * SCORE_WEIGHTS.level,
    boss: bossKills * SCORE_WEIGHTS.boss,
  };
  return { total: parts.time + parts.kills + parts.level + parts.boss, parts };
}

// --- Share codes ------------------------------------------------------------
// A compact, human-shareable stand-in for a server leaderboard: the date, seed,
// and score plus a checksum so a tampered/typo'd code is rejected on import.
// Format:  DLY.<yyyymmdd>.<seed36>.<score36>.<chk36>
//
// NOTE FOR A REAL BACKEND: replace encode/decode+import with POST/GET to a
// leaderboard service (the seed proves which daily it belongs to; the server
// would recompute/validate the score server-side instead of trusting the code).

const CODE_PREFIX = "DLY";

function checksum(dateNum, seed, score) {
  return hashSeed(`${dateNum}:${seed}:${score}`) % (36 ** 4); // 4 base36 chars
}

export function encodeShare({ date, seed, score }) {
  const dateNum = date.replace(/-/g, "");
  const chk = checksum(dateNum, seed, score);
  return [
    CODE_PREFIX,
    dateNum,
    (seed >>> 0).toString(36),
    Math.max(0, score | 0).toString(36),
    chk.toString(36),
  ].join(".");
}

// Returns { date, seed, score } or null if malformed / checksum fails.
export function decodeShare(code) {
  if (typeof code !== "string") return null;
  const parts = code.trim().split(".");
  if (parts.length !== 5 || parts[0] !== CODE_PREFIX) return null;
  const [, dateNum, seed36, score36, chk36] = parts;
  if (!/^\d{8}$/.test(dateNum)) return null;
  const seed = parseInt(seed36, 36) >>> 0;
  const score = parseInt(score36, 36);
  const chk = parseInt(chk36, 36);
  if (!Number.isFinite(seed) || !Number.isFinite(score) || !Number.isFinite(chk)) return null;
  if (checksum(dateNum, seed, score) !== chk) return null;
  const date = `${dateNum.slice(0, 4)}-${dateNum.slice(4, 6)}-${dateNum.slice(6, 8)}`;
  // Integrity: the code's seed must match the seed that date would actually
  // produce (rejects codes for a fabricated/mismatched daily).
  if (dailySeed(date) !== seed) return null;
  return { date, seed, score };
}

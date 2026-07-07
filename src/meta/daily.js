// meta/daily.js
// Save-facing Daily Challenge logic: consuming the one scored attempt per day
// (with anti-reroll persistence), recording results, building the local
// leaderboard (your entry + imported friend codes), streaks, personal bests,
// and importing share codes. Pure over the save object; callers persist.

import { dailyFor, scoreRun, encodeShare, decodeShare, dailyDate } from "../data/daily.js";

function store(save) {
  if (!save.daily) save.daily = { attempts: {}, imported: {} };
  if (!save.daily.attempts) save.daily.attempts = {};
  if (!save.daily.imported) save.daily.imported = {};
  return save.daily;
}

export function getAttempt(save, date) {
  return store(save).attempts[date] || null;
}

// True only if no scored attempt exists for `date` yet. Starting a scored run
// writes an "in_progress" attempt (persisted immediately), so from that instant
// on the scored run is spent — you can't re-roll by reloading, and a leftover
// in_progress becomes a DNF at the next boot (finalizeStaleAttempts).
export function canPlayScored(save, date) {
  return !getAttempt(save, date);
}

// Consume the scored attempt the instant a scored run starts, so reloading
// mid-run can't re-roll a bad start (finalizeStaleAttempts turns a leftover
// "in_progress" into a DNF on the next boot).
export function startScoredAttempt(save, date, seed) {
  store(save).attempts[date] = { status: "in_progress", seed, score: 0, breakdown: null, timeSec: 0 };
}

// A scored run finished — record its score + breakdown.
export function recordScoredResult(save, date, runStats) {
  const { total, parts } = scoreRun(runStats);
  store(save).attempts[date] = {
    status: "done",
    seed: dailyFor(date).seed,
    score: total,
    breakdown: parts,
    timeSec: runStats.time,
  };
  return { total, parts };
}

// Boot-time cleanup: any scored attempt still "in_progress" means the tab was
// closed/reloaded mid-run — spend it as a DNF so it can't be retried.
export function finalizeStaleAttempts(save, today = dailyDate()) {
  const attempts = store(save).attempts;
  let changed = false;
  for (const [date, a] of Object.entries(attempts)) {
    if (a.status === "in_progress") {
      // Anything still in-progress is stale by the time we boot (a live run
      // sets "done" before any reload can occur).
      a.status = "dnf";
      changed = true;
    }
  }
  return changed;
}

// --- Leaderboard ------------------------------------------------------------

// Today's board: your entry (if the run is done) + imported friend entries,
// sorted by score desc. Each entry: { name, score, you?, imported? }.
export function leaderboard(save, date) {
  const entries = [];
  const a = getAttempt(save, date);
  if (a && a.status === "done") {
    entries.push({ name: save.profileName || "You", score: a.score, you: true });
  }
  for (const e of store(save).imported[date] || []) {
    entries.push({ name: e.name || "Friend", score: e.score, imported: true });
  }
  entries.sort((x, y) => y.score - x.score);
  return entries;
}

// Your 1-based rank on today's board (null if you haven't posted a score).
export function myRank(save, date) {
  const board = leaderboard(save, date);
  const i = board.findIndex((e) => e.you);
  return i === -1 ? null : { rank: i + 1, of: board.length };
}

// Consecutive days (ending today or yesterday) with a completed scored attempt.
export function streak(save, today = dailyDate()) {
  const attempts = store(save).attempts;
  let count = 0;
  const d = new Date(today + "T00:00:00Z");
  // Allow the streak to still count if today isn't played yet but yesterday was.
  if (!(attempts[today]?.status === "done")) d.setUTCDate(d.getUTCDate() - 1);
  for (;;) {
    const key = d.toISOString().slice(0, 10);
    if (attempts[key]?.status === "done") {
      count++;
      d.setUTCDate(d.getUTCDate() - 1);
    } else break;
  }
  return count;
}

export function personalBest(save) {
  let best = 0;
  for (const a of Object.values(store(save).attempts)) {
    if (a.status === "done" && a.score > best) best = a.score;
  }
  return best;
}

// Recent completed dailies, newest first — for the history list.
export function history(save, limit = 6) {
  return Object.entries(store(save).attempts)
    .filter(([, a]) => a.status === "done" || a.status === "dnf")
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, limit)
    .map(([date, a]) => ({ date, status: a.status, score: a.score }));
}

// --- Sharing ----------------------------------------------------------------

// The share code for your completed attempt on `date`, or null.
export function myShareCode(save, date) {
  const a = getAttempt(save, date);
  if (!a || a.status !== "done") return null;
  return encodeShare({ date, seed: a.seed, score: a.score });
}

// Import a friend's code. Returns { ok, reason?, entry? }. Rejects malformed /
// checksum-failed codes and de-dupes identical entries.
export function importShareCode(save, code, name = "Friend") {
  const decoded = decodeShare(code);
  if (!decoded) return { ok: false, reason: "Invalid or corrupt code" };
  const imported = store(save).imported;
  const list = (imported[decoded.date] = imported[decoded.date] || []);
  if (list.some((e) => e.score === decoded.score && e.seed === decoded.seed && e.name === name)) {
    return { ok: false, reason: "Already imported" };
  }
  const entry = { name, score: decoded.score, seed: decoded.seed, imported: true };
  list.push(entry);
  return { ok: true, entry, date: decoded.date };
}

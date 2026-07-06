// data/achievements.js
// Data-driven achievement definitions. Each is:
//   { id, name, desc, hidden?, display?, progress(stats) -> { cur, goal }, reward }
//
// `progress` reads a derived STATS VIEW (built in meta/achievements.js from the
// save + optional live-run deltas) — never the raw save — so conditions stay
// one-liners. An achievement completes when cur >= goal. `display: "time"`
// renders progress as m:ss instead of a count.
//
// Rewards: { gold?, title?, characterId? }. Character rewards are the roster
// gate — the four locked specialists each teach a core system:
//   Riven        ← survival time (8:00 with a Blades specialist)
//   Junker       ← fusion (forge an Epic)
//   Arcanist     ← evolution (discover one)
//   Thornweaver  ← collection breadth (12 distinct stacks)

export const ACHIEVEMENTS = [
  // --- Character unlocks (always visible — no mystery boxes) ---
  {
    id: "blade_marathon",
    name: "Blade Dancer",
    desc: "Survive 8:00 in a single run with a Blades specialist",
    display: "time",
    progress: (s) => ({ cur: Math.min(s.bestTimeBySpec.blades || 0, 480), goal: 480 }),
    reward: { characterId: "riven" },
  },
  {
    id: "epic_forge",
    name: "Master Smith",
    desc: "Fuse a tool up to Epic (or better)",
    progress: (s) => ({
      cur: Math.min(1, (s.fusionsByTarget.epic || 0) + (s.fusionsByTarget.legendary || 0)),
      goal: 1,
    }),
    reward: { characterId: "junker" },
  },
  {
    id: "first_evolution",
    name: "Awakening",
    desc: "Discover your first weapon evolution",
    progress: (s) => ({ cur: Math.min(1, s.evolutionsSeen), goal: 1 }),
    reward: { characterId: "arcanist" },
  },
  {
    id: "collector",
    name: "Pack Rat",
    desc: "Own 12 distinct tool stacks at once",
    progress: (s) => ({ cur: Math.min(12, s.distinctStacks), goal: 12 }),
    reward: { characterId: "thornweaver" },
  },

  // --- Milestones (gold + titles) ---
  {
    id: "first_run",
    name: "Getting Started",
    desc: "Complete your first run",
    progress: (s) => ({ cur: Math.min(1, s.runs), goal: 1 }),
    reward: { gold: 25 },
  },
  {
    id: "first_fusion",
    name: "Apprentice Smith",
    desc: "Perform your first fusion",
    progress: (s) => ({ cur: Math.min(1, s.fusions), goal: 1 }),
    reward: { gold: 25 },
  },
  {
    id: "kills_100",
    name: "First Hundred",
    desc: "Defeat 100 enemies (lifetime)",
    progress: (s) => ({ cur: Math.min(100, s.kills), goal: 100 }),
    reward: { gold: 50 },
  },
  {
    id: "kills_1000",
    name: "Exterminator",
    desc: "Defeat 1,000 enemies (lifetime)",
    progress: (s) => ({ cur: Math.min(1000, s.kills), goal: 1000 }),
    reward: { gold: 200, title: "Exterminator" },
  },
  {
    id: "boss_10",
    name: "Giantsbane",
    desc: "Slay 10 elites or bosses (lifetime)",
    progress: (s) => ({ cur: Math.min(10, s.bossKills), goal: 10 }),
    reward: { gold: 150 },
  },
  {
    id: "marathon_30",
    name: "Iron Lungs",
    desc: "Survive 30 minutes total across all runs",
    display: "time",
    progress: (s) => ({ cur: Math.min(1800, s.timeSec), goal: 1800 }),
    reward: { gold: 100 },
  },
  {
    id: "runs_10",
    name: "Regular",
    desc: "Complete 10 runs",
    progress: (s) => ({ cur: Math.min(10, s.runs), goal: 10 }),
    reward: { gold: 100 },
  },
  {
    id: "veteran_10",
    name: "Veteran",
    desc: "Raise any character to level 10",
    progress: (s) => ({ cur: Math.min(10, s.maxCharLevel), goal: 10 }),
    reward: { gold: 150, title: "Veteran" },
  },

  // --- Hidden (shown as "???" until earned) ---
  {
    id: "all_evolutions",
    name: "Fully Awakened",
    desc: "Discover every weapon evolution",
    hidden: true,
    progress: (s) => ({ cur: Math.min(s.evolutionsTotal, s.evolutionsSeen), goal: s.evolutionsTotal }),
    reward: { gold: 500, title: "The Awakened" },
  },
  {
    id: "legendary_forge",
    name: "Forgemaster",
    desc: "Fuse a Legendary tool",
    hidden: true,
    progress: (s) => ({ cur: Math.min(1, s.fusionsByTarget.legendary || 0), goal: 1 }),
    reward: { gold: 300, title: "Forgemaster" },
  },
];

// Characters unlocked on a fresh profile — everyone else is achievement-gated.
export const DEFAULT_UNLOCKED_CHARACTERS = ["ember_knight", "deadeye"];

// sim/scenarios.mjs
// Declarative test matrix + balance thresholds for the sim. Kept data-only so
// tuning the suite doesn't touch the runner. Three suites, each isolating one
// variable so a flagged outlier points at a real cause:
//   roster — every character on its category's baseline starter (Common)
//   tools  — every tool in a category, on a fixed character of that category
//   rarity — one reference tool across all five rarities on a fixed character
//
// Runner reads these via buildScenarios() and compares within each suite.

import { CHARACTERS_LIST } from "../src/data/characters.js";
import { TOOL_BASES, TOOL_CATEGORIES } from "../src/data/tools.js";
import { RARITY_ORDER } from "../src/data/rarities.js";

// The "baseline" starter tool for each specialization (a plain single-target
// weapon, so cross-character comparisons aren't skewed by weapon choice).
export const STARTER_BY_CATEGORY = {
  blades: "flame_saber",
  guns: "hand_cannon",
  arcane: "arc_bolt",
  nature: "thorn_ring",
};

// A representative character per category (first in roster order) for the
// tool + rarity suites.
export function repCharacterFor(category) {
  return CHARACTERS_LIST.find((c) => c.specialization === category)?.id ?? null;
}

// Tunable balance-smell thresholds + regression-assertion limits.
export const THRESHOLDS = {
  rosterDeviationPct: 25, // char median survival vs roster average
  toolOutperformPct: 60, // tool mean survival vs its category mean
  rarityDeadPct: 5, // legendary-vs-common swing below this ⇒ rarity pointless
  rarityMandatoryPct: 60, // ...above this ⇒ rarity mandatory
  toolDamageMultCap: 3, // no tool's mean damage may exceed N× category average
  minMedianSurvivalSec: 240, // default char + Common starter must clear this
  minCharMedianSec: 60, // nobody in the roster may median below this
};

// Reference cell for the "default character survives" assertion + determinism
// check (the actual starter character on its Common starter tool).
export const REFERENCE = { character: "ember_knight", baseId: "flame_saber", rarity: "common" };

// The rarity suite uses a DELIBERATELY weaker pairing than REFERENCE: a strong
// character/tool survives to the time cap at every tier, so survival can't
// differentiate rarities (it saturates). A cap-sensitive build (the tanky-but-
// low-damage Junker on a single-target gun) actually dies mid-run, so rarity's
// effect on survival is measurable.
export const RARITY_REF = { character: "junker", baseId: "hand_cannon" };

// Tools in a category, in data order.
export function toolsInCategory(category) {
  return Object.values(TOOL_BASES)
    .filter((b) => b.category === category)
    .map((b) => b.baseId);
}

// Build the concrete suites for a given strategy. Each cell is a run config
// minus the seed (the runner sweeps seeds).
export function buildScenarios({ strategy = "balanced" } = {}) {
  const roster = CHARACTERS_LIST.map((c) => ({
    group: "roster",
    label: c.name,
    character: c.id,
    category: c.specialization,
    tools: [{ baseId: STARTER_BY_CATEGORY[c.specialization], rarity: "common" }],
    strategy,
  }));

  const tools = [];
  for (const cat of TOOL_CATEGORIES) {
    const character = repCharacterFor(cat);
    if (!character) continue;
    for (const baseId of toolsInCategory(cat)) {
      tools.push({
        group: "tools",
        subgroup: cat,
        label: `${TOOL_BASES[baseId].name} (${cat})`,
        character,
        category: cat,
        tools: [{ baseId, rarity: "common" }],
        strategy,
      });
    }
  }

  const rarity = RARITY_ORDER.map((r) => ({
    group: "rarity",
    label: `${TOOL_BASES[RARITY_REF.baseId].name} · ${r}`,
    character: RARITY_REF.character,
    rarity: r,
    tools: [{ baseId: RARITY_REF.baseId, rarity: r }],
    strategy,
  }));

  return { roster, tools, rarity };
}

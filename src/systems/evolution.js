// systems/evolution.js
// Weapon evolution: when a weapon is at max in-run level and the player holds
// its matching passive (recipes: EVOLUTIONS in data/balance.js), the next
// elite/boss kill drops an evolution chest at the kill spot. Walking over it
// opens the chest (main.js plays the reveal and swaps the weapon).
//
// Everything here is per-run state; the persistent "recipe discovered" flag
// (save.evolutionsSeen) is written by main.js when a chest opens.

import { EVOLUTIONS } from "../data/balance.js";

// The recipe for a weapon instance (null when none or already evolved).
export function evolutionFor(inst) {
  return inst.evolved ? null : EVOLUTIONS[inst.id] || null;
}

// Is this instance one passive/level away — or ready? Returns a status string
// for UI hints: "ready" | "needs-passive" | "needs-levels" | null.
export function evolutionStatus(inst, passiveItems) {
  const evo = evolutionFor(inst);
  if (!evo) return null;
  const hasPassive = (passiveItems || []).includes(evo.requiresPassiveId);
  const maxed = inst.level >= inst.maxLevel;
  if (maxed && hasPassive) return "ready";
  if (maxed) return "needs-passive";
  return "needs-levels";
}

// First weapon currently able to evolve, or null.
export function eligibleEvolution(weapons, player) {
  for (const w of weapons.list) {
    if (evolutionStatus(w, player.passiveItems) === "ready") {
      return { inst: w, evo: evolutionFor(w) };
    }
  }
  return null;
}

// The full evolved weapon def fed to weapons.evolveWeapon().
export function makeEvolvedDef(baseId) {
  const evo = EVOLUTIONS[baseId];
  if (!evo) return null;
  return {
    ...evo.weapon,
    id: `${baseId}_evolved`,
    name: evo.evolvedName,
    rarity: "legendary", // HUD border tint
    evolved: true,
  };
}

// --- Chest drops (one at a time) -------------------------------------------

const CHEST_PICKUP_RADIUS = 26;

export function createEvolutionChests() {
  let chest = null; // { x, y, baseId, t }

  return {
    // Called by the weapon system on every elite/boss kill.
    onEliteKill(x, y, weapons, player) {
      if (chest) return;
      const found = eligibleEvolution(weapons, player);
      if (!found) return;
      chest = { x, y, baseId: found.inst.id, t: 0 };
    },

    // Returns the chest when the player walks over it (opened), else null.
    update(dt, player) {
      if (!chest) return null;
      chest.t += dt;
      const dx = player.x - chest.x;
      const dy = player.y - chest.y;
      const rr = player.radius + CHEST_PICKUP_RADIUS;
      if (dx * dx + dy * dy <= rr * rr) {
        const opened = chest;
        chest = null;
        return opened;
      }
      return null;
    },

    // WORLD space. A golden chest with a sky beam so it reads across the arena.
    render(ctx) {
      if (!chest) return;
      const { x, y, t } = chest;
      const bob = Math.sin(t * 3) * 3;
      const pulse = 0.6 + Math.sin(t * 5) * 0.25;

      // Beam.
      const grad = ctx.createLinearGradient(x, y - 220, x, y);
      grad.addColorStop(0, "rgba(255, 211, 77, 0)");
      grad.addColorStop(1, `rgba(255, 211, 77, ${0.28 * pulse})`);
      ctx.fillStyle = grad;
      ctx.fillRect(x - 14, y - 220, 28, 220);

      // Ground glow.
      ctx.globalAlpha = 0.35 * pulse;
      ctx.fillStyle = "#ffd34d";
      ctx.beginPath();
      ctx.ellipse(x, y + 12, 26, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Chest body + lid.
      const cy = y + bob;
      ctx.fillStyle = "#8a5a20";
      ctx.strokeStyle = "#ffd34d";
      ctx.lineWidth = 2;
      ctx.fillRect(x - 14, cy - 8, 28, 18);
      ctx.strokeRect(x - 14, cy - 8, 28, 18);
      ctx.fillStyle = "#a87030";
      ctx.fillRect(x - 14, cy - 14, 28, 8);
      ctx.strokeRect(x - 14, cy - 14, 28, 8);
      // Clasp.
      ctx.fillStyle = "#ffd34d";
      ctx.fillRect(x - 2.5, cy - 9, 5, 7);
    },

    reset() {
      chest = null;
    },

    get active() {
      return chest;
    },
  };
}

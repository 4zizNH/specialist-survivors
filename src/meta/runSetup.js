// meta/runSetup.js
// THE single source of truth for turning a character def + its persisted
// progress + the save's shop bonuses into a fully-configured run player.
//
// Both the live game (main.startRun) and the headless balance sim call this,
// so the two can never disagree about starting stats or which passive hooks
// are active — which is what makes the sim's numbers trustworthy.

import { createPlayer } from "../entities/player.js";
import { resolveCharacterStats } from "./progression.js";
import { PLAYER_BASE } from "../data/balance.js";

export function createRunPlayer(def, prog, save, world) {
  const s = resolveCharacterStats(def, prog.level);
  const player = createPlayer(world.width / 2, world.height / 2);
  player.maxHp = s.maxHp;
  player.hp = s.maxHp;
  player.speed = PLAYER_BASE.moveSpeed * s.moveSpeed;
  player.pickupRadius = PLAYER_BASE.pickupRadius * s.pickupRadius;
  player.might = s.might;
  player.cooldownMult = s.cooldown;

  // Shop: Whetstone — permanent account-wide damage bonus.
  player.might *= 1 + 0.05 * ((save.shop && save.shop.global_might) || 0);

  // Character passive hooks (run-affecting; goldMult applies in rewards).
  const p = def.passive || {};
  player.critChance = p.critChance ?? 0;
  player.xpMult = p.xpMult ?? 1;
  player.onKillHeal = p.onKillHeal ?? 0;
  player.lowHpSpeedBoost = p.lowHpSpeedBoost ?? 0;
  if (p.regen != null) player.regen = p.regen;

  return player;
}

// systems/xp.js
// In-run experience. Owns the XP-gem pool: gems dropped on enemy death magnet
// toward the player when within pickupRadius and are collected on contact.
// Collected XP fills a level bar whose threshold grows each level; crossing it
// queues a level-up (consumed by the upgrade screen). RUN-LOCAL — resets each
// run, separate from meta/progression.

import { createPool } from "../engine/pool.js";
import { createGem } from "../entities/pickup.js";
import { XP_CURVE } from "../data/balance.js";

const MAGNET_SPEED = 480; // px/sec pull once within pickup radius

export function createXpSystem() {
  const pool = createPool(createGem);
  let level = 1;
  let xp = 0; // XP banked toward the current level
  let pending = 0; // queued level-ups awaiting an upgrade pick

  // Threshold to reach the next level — tuned in data/balance.js (XP_CURVE).
  const threshold = (lv) =>
    Math.floor(XP_CURVE.base * Math.pow(XP_CURVE.growth, lv - 1)) +
    (lv - 1) * XP_CURVE.linear;

  function gainXp(v) {
    xp += v;
    while (xp >= threshold(level)) {
      xp -= threshold(level);
      level += 1;
      pending += 1;
    }
  }

  return {
    spawnGem(x, y, value) {
      pool.acquire().reset(x, y, value);
    },

    update(dt, player, fx) {
      const collect = player.radius + 6;
      const magnet = player.pickupRadius;
      const collectSq = collect * collect;
      const magnetSq = magnet * magnet;
      const a = pool.active;
      for (let i = a.length - 1; i >= 0; i--) {
        const g = a[i];
        const dx = player.x - g.x;
        const dy = player.y - g.y;
        const d2 = dx * dx + dy * dy;
        if (d2 <= collectSq) {
          // Resonance-style passives multiply collected XP.
          gainXp(Math.max(1, Math.round(g.value * (player.xpMult || 1))));
          if (fx) fx.onGemCollect(g.x, g.y);
          pool.release(g);
          continue;
        }
        if (d2 <= magnetSq) {
          const d = Math.sqrt(d2) || 1;
          g.x += (dx / d) * MAGNET_SPEED * dt;
          g.y += (dy / d) * MAGNET_SPEED * dt;
          // Sparse sparkle trail while a gem streaks toward the player.
          if (fx && Math.random() < dt * 14) fx.onGemTrail(g.x, g.y);
        }
      }
    },

    // `b` = visible world bounds for culling (optional).
    render(ctx, b) {
      const a = pool.active;
      for (let i = 0; i < a.length; i++) {
        const g = a[i];
        if (b && (g.x < b.left - 12 || g.x > b.right + 12 || g.y < b.top - 12 || g.y > b.bottom + 12)) continue;
        g.render(ctx);
      }
    },

    reset() {
      pool.releaseAll();
      level = 1;
      xp = 0;
      pending = 0;
    },

    consumeLevelUp() {
      if (pending > 0) pending -= 1;
    },

    get level() {
      return level;
    },
    get xp() {
      return xp;
    },
    get xpToNext() {
      return threshold(level);
    },
    get progress() {
      return xp / threshold(level);
    },
    get pendingLevelUps() {
      return pending;
    },
    get gemCount() {
      return pool.activeCount;
    },
    // Live gems (the headless sim's bot drifts toward the nearest).
    get gems() {
      return pool.active;
    },
  };
}

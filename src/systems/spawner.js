// systems/spawner.js
// Spawn director + enemy manager, driven by the difficulty curve (balance.js):
// spawn cadence, batch size, population cap, HP/damage scaling, timed unlocks.
// The Warden mini-boss repeats on its interval; the Colossus arrives once at
// PACING.bossAt. Each frame it moves every enemy (with grid separation),
// applies contact damage through the player's iframes, runs the enemy-bullet
// pool (ranged/boss fire), and handles splitters bursting into children.

import { createPool } from "../engine/pool.js";
import { createSpatialGrid } from "../engine/spatialgrid.js";
import { createEnemy } from "../entities/enemy.js";
import { ENEMIES } from "../data/enemies.js";
import { getDifficulty, unlockedTypes, BOSS_INTERVAL, BOSS_AT } from "./difficulty.js";

const BULLET_MARGIN = 60; // despawn bullets this far outside the world

export function createSpawner(world, opts = {}) {
  const pool = createPool(createEnemy);
  const grid = createSpatialGrid(opts.cellSize ?? 48);
  const bullets = createPool(() => ({
    x: 0, y: 0, vx: 0, vy: 0, radius: 0, damage: 0, age: 0, life: 0,
  }));
  let spawnTimer = 0;
  let nextMiniBossAt = BOSS_INTERVAL;
  let bossSpawned = false;
  // Current difficulty multipliers, remembered so split-children (spawned from
  // damage(), outside update) scale like their parent.
  let curHpMult = 1;
  let curDmgMult = 1;

  // Enemy-fired projectile (Spitter shots, Colossus bursts).
  function fireBullet(x, y, angle, speed, damage, radius) {
    const b = bullets.acquire();
    b.x = x;
    b.y = y;
    b.vx = Math.cos(angle) * speed;
    b.vy = Math.sin(angle) * speed;
    b.radius = radius;
    b.damage = damage;
    b.age = 0;
    b.life = 6;
  }
  const enemyCtx = { fireBullet };

  function spawnAt(arch, player, view, hpMult, dmgMult, jitter = 0) {
    const ring = Math.hypot(view.width, view.height) / 2 + 50 + arch.radius;
    const a = Math.random() * Math.PI * 2;
    const x = clamp(player.x + Math.cos(a) * ring + rnd(jitter), 0, world.width);
    const y = clamp(player.y + Math.sin(a) * ring + rnd(jitter), 0, world.height);
    pool.acquire().reset(arch, x, y, hpMult, dmgMult);
  }

  return {
    update(dt, runTime, player, view, fx) {
      const diff = getDifficulty(runTime);
      const types = unlockedTypes(runTime);
      curHpMult = diff.hpMult;
      curDmgMult = diff.dmgMult;

      // --- Spawn normal enemies at the current cadence (capped) ---
      spawnTimer -= dt;
      while (spawnTimer <= 0) {
        spawnTimer += diff.spawnInterval;
        for (let i = 0; i < diff.spawnBatch && pool.activeCount < diff.maxAlive; i++) {
          const arch = types[(Math.random() * types.length) | 0];
          spawnAt(arch, player, view, diff.hpMult, diff.dmgMult);
        }
      }

      // --- Warden mini-boss on its repeating timer ---
      if (runTime >= nextMiniBossAt) {
        nextMiniBossAt += BOSS_INTERVAL;
        spawnAt(ENEMIES.warden, player, view, diff.hpMult, diff.dmgMult);
        if (fx) fx.onBossSpawn();
      }

      // --- The Colossus, once, at the scheduled minute ---
      if (!bossSpawned && runTime >= BOSS_AT) {
        bossSpawned = true;
        spawnAt(ENEMIES.colossus, player, view, diff.hpMult, diff.dmgMult);
        if (fx) fx.onBossSpawn();
      }

      const active = pool.active;

      // --- Rebuild the spatial grid for this frame ---
      grid.clear();
      for (let i = 0; i < active.length; i++) grid.insert(active[i]);

      // --- Move each enemy + find the hardest-hitting contact this frame ---
      const cell = grid.cellSize;
      let maxContact = 0;
      for (let i = 0; i < active.length; i++) {
        const e = active[i];

        // Separation from neighbors.
        let sx = 0;
        let sy = 0;
        const cx = Math.floor(e.x / cell);
        const cy = Math.floor(e.y / cell);
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            const bucket = grid.bucketAt(cx + ox, cy + oy);
            if (bucket === undefined) continue;
            for (let j = 0; j < bucket.length; j++) {
              const o = bucket[j];
              if (o === e) continue;
              const dx = e.x - o.x;
              const dy = e.y - o.y;
              const minDist = e.radius + o.radius;
              const distSq = dx * dx + dy * dy;
              if (distSq > 0 && distSq < minDist * minDist) {
                const dist = Math.sqrt(distSq);
                const push = (minDist - dist) / minDist;
                sx += (dx / dist) * push;
                sy += (dy / dist) * push;
              }
            }
          }
        }

        e.update(dt, player, sx, sy, world, enemyCtx);

        // Contact with the player?
        const dx = player.x - e.x;
        const dy = player.y - e.y;
        const rr = player.radius + e.radius;
        if (dx * dx + dy * dy <= rr * rr && e.contactDamage > maxContact) {
          maxContact = e.contactDamage;
        }
      }

      // One contact hit per frame; the player's iframes gate the actual rate.
      if (maxContact > 0 && player.takeDamage(maxContact) && fx) {
        fx.onPlayerHit(maxContact);
      }

      // --- Enemy bullets: move, hit the player, expire ---
      const bs = bullets.active;
      for (let i = bs.length - 1; i >= 0; i--) {
        const b = bs[i];
        b.age += dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (
          b.age >= b.life ||
          b.x < -BULLET_MARGIN || b.x > world.width + BULLET_MARGIN ||
          b.y < -BULLET_MARGIN || b.y > world.height + BULLET_MARGIN
        ) {
          bullets.release(b);
          continue;
        }
        const dx = player.x - b.x;
        const dy = player.y - b.y;
        const rr = player.radius + b.radius;
        if (dx * dx + dy * dy <= rr * rr) {
          if (player.takeDamage(b.damage) && fx) fx.onPlayerHit(b.damage);
          bullets.release(b);
        }
      }
    },

    // Apply damage to an enemy; returns true if it died (and was recycled).
    // Splitters burst into scaled children at their death spot.
    damage(enemy, amount) {
      if (!enemy.active) return false;
      enemy.hp -= amount;
      if (enemy.hp <= 0) {
        enemy.active = false;
        const split = enemy.splitInto;
        const ex = enemy.x;
        const ey = enemy.y;
        pool.release(enemy);
        if (split && ENEMIES[split.id]) {
          for (let i = 0; i < split.count; i++) {
            const child = pool.acquire();
            child.reset(
              ENEMIES[split.id],
              clamp(ex + rnd(24), 0, world.width),
              clamp(ey + rnd(24), 0, world.height),
              curHpMult,
              curDmgMult
            );
          }
        }
        return true;
      }
      return false;
    },

    // `vb` = visible world bounds for culling (optional).
    render(ctx, vb) {
      const active = pool.active;
      for (let i = 0; i < active.length; i++) {
        const e = active[i];
        if (
          vb &&
          (e.x + e.radius < vb.left || e.x - e.radius > vb.right ||
            e.y + e.radius < vb.top || e.y - e.radius > vb.bottom)
        )
          continue;
        e.render(ctx);
      }
      // Enemy bullets: hot orange so they read as "dodge me".
      const bs = bullets.active;
      for (let i = 0; i < bs.length; i++) {
        const b = bs[i];
        if (vb && (b.x < vb.left || b.x > vb.right || b.y < vb.top || b.y > vb.bottom)) continue;
        ctx.fillStyle = "#ff9a4a";
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.5)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    },

    reset() {
      pool.releaseAll();
      bullets.releaseAll();
      spawnTimer = 0;
      nextMiniBossAt = BOSS_INTERVAL;
      bossSpawned = false;
      curHpMult = 1;
      curDmgMult = 1;
    },

    get enemies() {
      return pool.active;
    },
    get count() {
      return pool.activeCount;
    },
    get pooled() {
      return pool.freeCount;
    },
    get bulletCount() {
      return bullets.activeCount;
    },
  };
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
function rnd(r) {
  return (Math.random() * 2 - 1) * r;
}

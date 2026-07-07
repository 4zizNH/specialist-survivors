// systems/weapons.js
// The automatic weapon system — the heart of combat, kept data-driven.
//
//  - Weapon DEFS live in data/weapons.js. Each names a `fireBehavior`.
//  - FIRE_BEHAVIORS below is a registry of those patterns. A behavior turns a
//    weapon's (mutable, per-instance) stats into projectiles via spawn().
//  - A WeaponInstance owns a CLONE of its def's stats (so in-run upgrades can
//    raise damage/count/etc. without touching shared data), plus a cooldown and
//    a level.
//  - Projectiles are pooled; collision uses a spatial grid over live enemies.
//    Damage goes through spawner.damage(); kills drop XP gems via the XP system.
//
// To add a weapon: add a data object in data/weapons.js using any existing
// fireBehavior. No code here changes.

import { createPool } from "../engine/pool.js";
import { createSpatialGrid } from "../engine/spatialgrid.js";
import { createProjectile } from "../entities/projectile.js";
import { WEAPONS } from "../data/weapons.js";
import { rng } from "../engine/rng.js";

const BOUNDS_MARGIN = 80;
const MAX_WEAPONS = 6;

// --- Fire behaviors -------------------------------------------------------
// Signature: (s, player, enemies, spawn) => boolean (true if it fired).
// `s` is the weapon instance's mutable stats. `spawn(config)` pushes a
// projectile into the pool.

const FIRE_BEHAVIORS = {
  nearestEnemy(s, player, enemies, spawn) {
    const target = nearest(player, enemies);
    if (!target) return false;
    const base = Math.atan2(target.y - player.y, target.x - player.x);
    const hits = s.pierce < 0 ? Infinity : s.pierce + 1;
    const fan = 0.12;
    for (let i = 0; i < s.count; i++) {
      const a = base + (i - (s.count - 1) / 2) * fan;
      spawn({
        motion: "linear",
        x: player.x,
        y: player.y,
        vx: Math.cos(a) * s.projectileSpeed,
        vy: Math.sin(a) * s.projectileSpeed,
        damage: s.damage,
        radius: s.area,
        color: s.color,
        remainingHits: hits,
        lifetime: s.lifetime,
      });
    }
    return true;
  },

  aroundPlayer(s, player, enemies, spawn) {
    for (let i = 0; i < s.count; i++) {
      const a = (i / s.count) * Math.PI * 2;
      spawn({
        motion: "orbit",
        anchor: player,
        orbitAngle: a,
        orbitRadius: s.orbitRadius,
        orbitSpeed: s.orbitSpeed,
        x: player.x + Math.cos(a) * s.orbitRadius,
        y: player.y + Math.sin(a) * s.orbitRadius,
        damage: s.damage,
        radius: s.area,
        color: s.color,
        remainingHits: Infinity,
        lifetime: s.lifetime,
        reHitInterval: s.reHitInterval,
      });
    }
    return true;
  },

  forwardSpread(s, player, enemies, spawn) {
    const base = Math.atan2(player.faceY, player.faceX);
    const spread = s.spread ?? 0.6;
    const hits = s.pierce < 0 ? Infinity : s.pierce + 1;
    for (let i = 0; i < s.count; i++) {
      const t = s.count === 1 ? 0 : i / (s.count - 1) - 0.5;
      const a = base + t * spread;
      spawn({
        motion: "linear",
        x: player.x,
        y: player.y,
        vx: Math.cos(a) * s.projectileSpeed,
        vy: Math.sin(a) * s.projectileSpeed,
        damage: s.damage,
        radius: s.area,
        color: s.color,
        remainingHits: hits,
        lifetime: s.lifetime,
      });
    }
    return true;
  },

  // Spray shots in random directions — chaotic crowd control.
  randomBurst(s, player, enemies, spawn) {
    const hits = s.pierce < 0 ? Infinity : s.pierce + 1;
    for (let i = 0; i < s.count; i++) {
      const a = rng() * Math.PI * 2;
      spawn({
        motion: "linear",
        x: player.x,
        y: player.y,
        vx: Math.cos(a) * s.projectileSpeed,
        vy: Math.sin(a) * s.projectileSpeed,
        damage: s.damage,
        radius: s.area,
        color: s.color,
        remainingHits: hits,
        lifetime: s.lifetime,
      });
    }
    return true;
  },

  // A persistent damaging field centered on the player (orbit of radius 0).
  aura(s, player, enemies, spawn) {
    spawn({
      motion: "orbit",
      anchor: player,
      orbitAngle: 0,
      orbitRadius: 0,
      orbitSpeed: 0,
      x: player.x,
      y: player.y,
      damage: s.damage,
      radius: s.area,
      color: s.color,
      remainingHits: Infinity,
      lifetime: s.lifetime,
      reHitInterval: s.reHitInterval,
    });
    return true;
  },

  // Evolved (Verdant Cataclysm): a persistent bramble aura PLUS a radial nova
  // of thorn shots every firing — zoning and burst in one weapon.
  novaPulse(s, player, enemies, spawn) {
    spawn({
      motion: "orbit",
      anchor: player,
      orbitAngle: 0,
      orbitRadius: 0,
      orbitSpeed: 0,
      x: player.x,
      y: player.y,
      damage: s.auraDamage,
      radius: s.auraArea,
      color: s.color,
      remainingHits: Infinity,
      lifetime: s.cooldown + 0.15, // seamless across firings
      reHitInterval: s.auraRehit,
    });
    const hits = s.pierce < 0 ? Infinity : s.pierce + 1;
    for (let i = 0; i < s.count; i++) {
      const a = (i / s.count) * Math.PI * 2;
      spawn({
        motion: "linear",
        x: player.x,
        y: player.y,
        vx: Math.cos(a) * s.projectileSpeed,
        vy: Math.sin(a) * s.projectileSpeed,
        damage: s.damage,
        radius: s.area,
        color: s.color,
        remainingHits: hits,
        lifetime: s.lifetime,
      });
    }
    return true;
  },

  // Drop stationary traps near the player that detonate on enemy contact.
  mines(s, player, enemies, spawn) {
    const hits = s.pierce < 0 ? Infinity : s.pierce + 1;
    for (let i = 0; i < s.count; i++) {
      const a = rng() * Math.PI * 2;
      const d = 30 + rng() * 50;
      spawn({
        motion: "linear",
        x: player.x + Math.cos(a) * d,
        y: player.y + Math.sin(a) * d,
        vx: 0,
        vy: 0,
        damage: s.damage,
        radius: s.area,
        color: s.color,
        remainingHits: hits,
        lifetime: s.lifetime,
      });
    }
    return true;
  },
};

function nearest(player, enemies) {
  let best = null;
  let bestSq = Infinity;
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (!e.active) continue;
    const dx = e.x - player.x;
    const dy = e.y - player.y;
    const d = dx * dx + dy * dy;
    if (d < bestSq) {
      bestSq = d;
      best = e;
    }
  }
  return best;
}

function makeInstance(def) {
  return {
    id: def.id,
    name: def.name,
    fireBehavior: def.fireBehavior,
    level: 1,
    maxLevel: def.maxLevel ?? 8,
    evolved: def.evolved ?? false,
    cooldownTimer: 0,
    stats: { ...def }, // per-instance mutable copy
  };
}

// Wrap a weapon's spawn so evolved payloads on its stats (burn DoT, impact
// explosions, orbit pulsing) ride along on every projectile it fires.
function payloadSpawn(spawn, st) {
  return (cfg) => {
    if (st.burnDps > 0) {
      cfg.burnDps = st.burnDps;
      cfg.burnDuration = st.burnDuration ?? 2;
    }
    if (st.explodeRadius > 0) {
      cfg.explodeRadius = st.explodeRadius;
      cfg.explodeDamage = Math.max(1, Math.round(st.damage * (st.explodeDamageMult ?? 0.75)));
    }
    if (st.orbitPulseAmp > 0 && cfg.motion === "orbit") {
      cfg.orbitPulseAmp = st.orbitPulseAmp;
      cfg.orbitPulseFreq = st.orbitPulseFreq ?? 2;
    }
    spawn(cfg);
  };
}

const BURN_TICK = 0.5; // seconds between burn damage ticks

// --- System ---------------------------------------------------------------

export function createWeaponSystem(world) {
  const pool = createPool(createProjectile);
  const grid = createSpatialGrid(40);
  const instances = [];
  // Resolved weapon defs for the current run (set from the character's equipped
  // tools via setLoadout). Falls back to a basic weapon so runs are never
  // weaponless.
  let loadoutDefs = [WEAPONS.magic_bolt];
  let kills = 0;
  let bossKills = 0;
  let damageDealt = 0; // lifetime run damage (for the balance sim's metrics)

  const spawn = (config) => pool.acquire().reset(config);

  function buildInstances() {
    instances.length = 0;
    for (const def of loadoutDefs) instances.push(makeInstance(def));
  }
  buildInstances();

  // Shared kill bookkeeping (projectile hits AND burn ticks): counters, XP gem,
  // on-kill heal, death FX, and the elite-kill hook (evolution chests).
  function registerKill(ex, ey, xpValue, eColor, wasBoss, player, xp, fx, onEliteKill) {
    kills++;
    if (wasBoss) bossKills++;
    if (xp) xp.spawnGem(ex, ey, xpValue);
    if (player.onKillHeal > 0) {
      player.hp = Math.min(player.maxHp, player.hp + player.onKillHeal);
    }
    if (fx) fx.onEnemyDeath(ex, ey, eColor, wasBoss);
    if (wasBoss && onEliteKill) onEliteKill(ex, ey);
  }

  return {
    update(dt, player, spawner, floatingText, xp, fx, onEliteKill) {
      const enemies = spawner.enemies;
      const might = player.might ?? 1; // character damage multiplier
      const cdMult = player.cooldownMult ?? 1; // character cooldown multiplier

      // 1. Tick weapons; fire when ready.
      for (let i = 0; i < instances.length; i++) {
        const w = instances[i];
        w.cooldownTimer -= dt;
        if (w.cooldownTimer <= 0) {
          const behavior = FIRE_BEHAVIORS[w.fireBehavior];
          const fired = behavior
            ? behavior(w.stats, player, enemies, payloadSpawn(spawn, w.stats))
            : false;
          w.cooldownTimer = fired ? w.cooldownTimer + w.stats.cooldown * cdMult : 0;
          if (fired && fx) fx.onFire();
        }
      }

      // 2. Index live enemies for broad-phase collision.
      grid.clear();
      for (let i = 0; i < enemies.length; i++) {
        if (enemies[i].active) grid.insert(enemies[i]);
      }

      // 3. Move projectiles, resolve hits, expire.
      const projs = pool.active;
      const cell = grid.cellSize;
      for (let i = projs.length - 1; i >= 0; i--) {
        const p = projs[i];
        p.update(dt);

        if (p.age >= p.lifetime) {
          pool.release(p);
          continue;
        }
        if (
          p.motion === "linear" &&
          (p.x < -BOUNDS_MARGIN ||
            p.x > world.width + BOUNDS_MARGIN ||
            p.y < -BOUNDS_MARGIN ||
            p.y > world.height + BOUNDS_MARGIN)
        ) {
          pool.release(p);
          continue;
        }

        const cx = Math.floor(p.x / cell);
        const cy = Math.floor(p.y / cell);
        let consumed = false;
        for (let oy = -1; oy <= 1 && !consumed; oy++) {
          for (let ox = -1; ox <= 1 && !consumed; ox++) {
            const bucket = grid.bucketAt(cx + ox, cy + oy);
            if (bucket === undefined) continue;
            for (let j = 0; j < bucket.length; j++) {
              const e = bucket[j];
              if (!e.active || p.recentlyHit.has(e)) continue;
              const rr = p.radius + e.radius;
              const dx = p.x - e.x;
              const dy = p.y - e.y;
              if (dx * dx + dy * dy > rr * rr) continue;

              // Hit. Character `might` scales damage; crit passives can double it.
              p.recentlyHit.add(e);
              const ex = e.x;
              const ey = e.y;
              const xpValue = e.xpValue;
              const eColor = e.color;
              let dmg = p.damage * might;
              let crit = false;
              if (player.critChance > 0 && rng() < player.critChance) {
                dmg *= 2;
                crit = true;
              }
              damageDealt += dmg;
              const wasBoss = e.isBoss;

              // Juice: hit-flash + knockback along the shot (or radially for
              // stationary effects like auras/mines). Bosses barely budge.
              e.flashTimer = 0.09;
              {
                let nx = p.vx;
                let ny = p.vy;
                let nl = Math.hypot(nx, ny);
                if (nl < 1) {
                  nx = ex - player.x;
                  ny = ey - player.y;
                  nl = Math.hypot(nx, ny) || 1;
                }
                const kb = 160 * (wasBoss ? 0.08 : 1);
                e.kbX += (nx / nl) * kb;
                e.kbY += (ny / nl) * kb;
              }

              const eRadius = e.radius;
              const killed = spawner.damage(e, dmg);
              if (killed) {
                registerKill(ex, ey, xpValue, eColor, wasBoss, player, xp, fx, onEliteKill);
              } else {
                if (fx) fx.onEnemyHit();
                // Igniting shots leave a burn (refreshed, not stacked).
                if (p.burnDps > 0) {
                  e.burnDps = Math.max(e.burnDps, p.burnDps);
                  e.burnLeft = Math.max(e.burnLeft, p.burnDuration);
                }
              }
              floatingText.spawn(
                ex,
                ey - eRadius - 4,
                String(Math.round(dmg)),
                crit ? "#ff9f3a" : killed ? "#ffd34d" : "#ffffff",
                crit ? 17 : 14
              );

              // Explosive shells detonate on first impact: a one-shot blast
              // (which never chains) replaces the projectile.
              if (p.explodeRadius > 0) {
                spawn({
                  motion: "linear",
                  x: ex,
                  y: ey,
                  vx: 0,
                  vy: 0,
                  damage: p.explodeDamage,
                  radius: p.explodeRadius,
                  color: p.color,
                  remainingHits: Infinity,
                  lifetime: 0.12,
                });
                if (fx) fx.onExplosion(ex, ey, p.color);
                pool.release(p);
                consumed = true;
                break;
              }

              if (p.remainingHits !== Infinity) {
                p.remainingHits -= 1;
                if (p.remainingHits <= 0) {
                  pool.release(p);
                  consumed = true;
                  break;
                }
              }
            }
          }
        }
      }

      // 4. Burn DoT: ignited enemies take periodic fire damage (can kill —
      // full kill bookkeeping applies, including evolution-chest drops).
      for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        if (!e.active || e.burnLeft <= 0) continue;
        e.burnLeft -= dt;
        e.burnTick -= dt;
        if (e.burnTick <= 0) {
          e.burnTick += BURN_TICK;
          const dmg = e.burnDps * BURN_TICK * might;
          damageDealt += dmg;
          const ex = e.x;
          const ey = e.y;
          const eRadius = e.radius;
          const xpValue = e.xpValue;
          const eColor = e.color;
          const wasBoss = e.isBoss;
          const killed = spawner.damage(e, dmg);
          if (killed) {
            registerKill(ex, ey, xpValue, eColor, wasBoss, player, xp, fx, onEliteKill);
          }
          floatingText.spawn(ex, ey - eRadius - 4, String(Math.round(dmg)), "#ff8a3a", 12);
        }
        if (e.burnLeft <= 0) e.burnDps = 0;
      }
    },

    // `b` = visible world bounds for culling (optional).
    render(ctx, b) {
      const projs = pool.active;
      for (let i = 0; i < projs.length; i++) {
        const p = projs[i];
        if (
          b &&
          (p.x + p.radius < b.left || p.x - p.radius > b.right ||
            p.y + p.radius < b.top || p.y - p.radius > b.bottom)
        )
          continue;
        p.render(ctx);
      }
    },

    // --- Loadout API (used by the upgrade system) ---
    hasWeapon(id) {
      return instances.some((w) => w.id === id);
    },
    addWeapon(id) {
      if (this.hasWeapon(id) || instances.length >= MAX_WEAPONS) return false;
      const def = WEAPONS[id];
      if (!def) return false;
      instances.push(makeInstance(def));
      return true;
    },
    // Add an already-resolved weapon def (e.g. a tool discovered mid-run).
    addWeaponDef(def) {
      if (!def || this.hasWeapon(def.id) || instances.length >= MAX_WEAPONS) return false;
      instances.push(makeInstance(def));
      return true;
    },
    // mutator(stats) tweaks the instance's stats; level increments (capped).
    upgradeWeapon(id, mutator) {
      const w = instances.find((i) => i.id === id);
      if (!w) return false;
      mutator(w.stats);
      if (w.level < w.maxLevel) w.level += 1;
      return true;
    },
    // Replace a maxed weapon with its evolved form (per-run; the collection
    // still stores the base tool). The evolved instance reads as max level.
    evolveWeapon(id, evolvedDef) {
      const idx = instances.findIndex((w) => w.id === id);
      if (idx === -1 || instances[idx].evolved) return false;
      const next = makeInstance({ ...evolvedDef, evolved: true });
      next.level = next.maxLevel;
      instances[idx] = next;
      return true;
    },

    // Set the run's starting weapons (resolved tool defs). Empty -> a basic
    // fallback so a run is never weaponless. Takes effect on the next reset().
    setLoadout(defs) {
      loadoutDefs = defs && defs.length ? defs.slice() : [WEAPONS.magic_bolt];
    },

    reset() {
      pool.releaseAll();
      buildInstances();
      kills = 0;
      bossKills = 0;
      damageDealt = 0;
    },

    get list() {
      return instances;
    },
    get projectiles() {
      return pool.active;
    },
    get projectileCount() {
      return pool.activeCount;
    },
    get count() {
      return instances.length;
    },
    get weaponCount() {
      return instances.length;
    },
    get kills() {
      return kills;
    },
    get bossKills() {
      return bossKills;
    },
    get damageDealt() {
      return damageDealt;
    },
  };
}

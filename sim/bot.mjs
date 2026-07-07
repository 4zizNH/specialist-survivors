// sim/bot.mjs
// A pluggable bot policy for the headless balance sim. It is NOT meant to play
// like a human — it's a consistent, deterministic yardstick so balance changes
// show up as changes in bot survival rather than noise.
//
// Movement: CIRCLE-STRAFE the swarm at a moderate buffer rather than fleeing to
// maximum range. This is deliberate — max-range fleeing lets short-range
// archetypes (orbitals, auras) never connect, which would measure the bot's
// policy instead of the weapon. Strafing keeps a trailing clump within reach of
// every weapon type while still dodging contact; it flees hard only when an
// enemy breaches a close buffer, avoids bosses extra, drifts toward gems when
// safe, and steers off the walls so it never corners itself.
//
// Upgrades: three strategies — "random" (seeded), "always-damage", "balanced".

const SENSE_RADIUS = 520; // px: enemies within this define the swarm to strafe
const CONTACT_BUFFER = 95; // px: closer than this ⇒ flee the nearest hard

export function createBot(spawner, xp, rngFn, opts = {}) {
  const world = opts.world;
  const strategy = opts.strategy || "balanced";
  const cx = world.width / 2;
  const cy = world.height / 2;

  function move(player) {
    const enemies = spawner.enemies;
    let sumX = 0;
    let sumY = 0;
    let cnt = 0;
    let ndx = 0;
    let ndy = 0;
    let nd2 = Infinity;
    let bdx = 0;
    let bdy = 0;
    let bd2 = Infinity;
    let hasBoss = false;

    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.active) continue;
      const dx = e.x - player.x;
      const dy = e.y - player.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > SENSE_RADIUS * SENSE_RADIUS) continue;
      sumX += e.x;
      sumY += e.y;
      cnt++;
      if (d2 < nd2) {
        nd2 = d2;
        ndx = dx;
        ndy = dy;
      }
      if (e.isBoss && d2 < bd2) {
        bd2 = d2;
        bdx = dx;
        bdy = dy;
        hasBoss = true;
      }
    }

    let mx = 0;
    let my = 0;

    if (cnt > 0) {
      // Outward from the swarm centroid.
      const ox = player.x - sumX / cnt;
      const oy = player.y - sumY / cnt;
      const ol = Math.hypot(ox, oy) || 1;
      const oux = ox / ol;
      const ouy = oy / ol;
      // Tangential (outward rotated +90°) → circle-strafe, keeping the swarm
      // trailing at a roughly constant distance where weapons can hit it.
      mx += -ouy;
      my += oux;
      // Gentle outward so the buffer doesn't collapse.
      mx += oux * 0.35;
      my += ouy * 0.35;
      // Hard flee if the nearest enemy breaches the contact buffer.
      const nd = Math.sqrt(nd2) || 1;
      if (nd < CONTACT_BUFFER) {
        const w = (CONTACT_BUFFER - nd) / CONTACT_BUFFER;
        mx += (-ndx / nd) * w * 2.2;
        my += (-ndy / nd) * w * 2.2;
      }
      // Bosses: extra standoff.
      if (hasBoss) {
        const bd = Math.sqrt(bd2) || 1;
        mx += (-bdx / bd) * 1.2;
        my += (-bdy / bd) * 1.2;
      }
    } else {
      // Nothing near — regroup toward the arena center.
      mx = cx - player.x;
      my = cy - player.y;
    }

    // Drift toward the nearest gem when not being pressed.
    if (nd2 > (CONTACT_BUFFER * 1.6) ** 2) {
      const g = nearestGem(xp.gems, player);
      if (g) {
        const dx = g.x - player.x;
        const dy = g.y - player.y;
        const d = Math.hypot(dx, dy) || 1;
        mx += (dx / d) * 0.5;
        my += (dy / d) * 0.5;
      }
    }

    // Wall avoidance — push inward as it nears an edge.
    const margin = 380;
    if (player.x < margin) mx += ((margin - player.x) / margin) * 2;
    else if (player.x > world.width - margin) mx -= ((player.x - (world.width - margin)) / margin) * 2;
    if (player.y < margin) my += ((margin - player.y) / margin) * 2;
    else if (player.y > world.height - margin) my -= ((player.y - (world.height - margin)) / margin) * 2;

    const m = Math.hypot(mx, my);
    if (m < 1e-4) return { x: 0, y: 0 };
    return { x: mx / m, y: my / m };
  }

  // Return the index of the option to take.
  function pickUpgrade(options) {
    if (options.length === 0) return 0;
    if (strategy === "random") return Math.floor(rngFn() * options.length) % options.length;

    const scorer = strategy === "always-damage" ? scoreDamage : scoreBalanced;
    let best = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < options.length; i++) {
      const s = scorer(options[i]);
      if (s > bestScore) {
        bestScore = s;
        best = i;
      }
    }
    return best;
  }

  return { move, pickUpgrade, strategy };
}

function nearestGem(gems, player) {
  let best = null;
  let bestSq = Infinity;
  for (let i = 0; i < gems.length; i++) {
    const g = gems[i];
    if (!g.active) continue;
    const dx = g.x - player.x;
    const dy = g.y - player.y;
    const d = dx * dx + dy * dy;
    if (d < bestSq) {
      bestSq = d;
      best = g;
    }
  }
  return best;
}

// Options carry { kind, title, desc }; strategies pattern-match on them.
function scoreDamage(opt) {
  const t = opt.title;
  if (opt.kind === "weapon" && /Damage/i.test(t)) return 100;
  if (opt.kind === "weapon" && /Projectile/i.test(t)) return 70;
  if (opt.kind === "weapon") return 55; // cooldown / area
  if (opt.kind === "new") return 50;
  if (opt.kind === "passive" && /Whetstone/i.test(t)) return 45;
  if (opt.kind === "passive") return 30;
  if (opt.kind === "stat" && /Max HP/i.test(t)) return 20;
  return 10;
}

function scoreBalanced(opt) {
  const t = opt.title;
  if (opt.kind === "weapon" && /Damage|Projectile|Cooldown/i.test(t)) return 6;
  if (opt.kind === "weapon") return 5; // area
  if (opt.kind === "new") return 6;
  if (opt.kind === "passive") return 6; // strong + enables evolutions
  if (opt.kind === "stat" && /Max HP/i.test(t)) return 5;
  if (opt.kind === "stat" && /Move/i.test(t)) return 4;
  return 3;
}

// entities/enemy.js
// Enemy instance. Pool-friendly: createEnemy() builds a blank object and
// reset() re-initializes it from an archetype on spawn, applying the run's
// HP/damage multipliers (difficulty scaling).
//
// Movement:
//   "seek"    — unit steering toward the player + grid-based separation
//   "charger" — slow seek, then a periodic committed lunge (Warden)
//   "ranged"  — advances to `range`, holds distance, fires bullets (Spitter)
//   "boss"    — the Colossus: phase 1 slow advance + radial bursts; phase 2
//               (below 50% HP) enrages: faster, denser, quicker bursts
//
// `ctx.fireBullet(x, y, angle, speed, damage, radius)` is provided by the
// spawner for ranged/boss archetypes. render() draws in WORLD space; bosses
// draw an HP bar; enraged bosses tint brighter.

const SEPARATION_WEIGHT = 1.3;
const CHARGE_INTERVAL = 2.6; // seconds between Warden lunges
const DASH_TIME = 0.6;
const DASH_MULT = 4;

export function createEnemy() {
  return {
    active: false,
    type: "",
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    hp: 0,
    maxHp: 0,
    speed: 0,
    radius: 0,
    contactDamage: 0,
    xpValue: 0,
    isBoss: false,
    movement: "seek",
    splitInto: null,
    color: "#ffffff",
    // charger state
    chargeTimer: 0,
    dashing: false,
    dashTime: 0,
    dashVx: 0,
    dashVy: 0,
    // ranged / boss state
    range: 0,
    fireInterval: 0,
    fireTimer: 0,
    bulletSpeed: 0,
    bulletDamage: 0,
    bulletRadius: 0,
    burstTimer: 0,
    enraged: false,
    arch: null, // archetype ref for boss phase params
    // juice state (set by the weapon system on hit)
    flashTimer: 0,
    kbX: 0,
    kbY: 0,
    // burn DoT (applied by evolved weapons, ticked by the weapon system)
    burnLeft: 0,
    burnDps: 0,
    burnTick: 0,

    reset(arch, x, y, hpMult = 1, dmgMult = 1) {
      this.active = true;
      this.type = arch.id;
      this.x = x;
      this.y = y;
      this.vx = 0;
      this.vy = 0;
      this.maxHp = Math.round(arch.maxHp * hpMult);
      this.hp = this.maxHp;
      this.speed = arch.speed;
      this.radius = arch.radius;
      this.contactDamage = arch.contactDamage * dmgMult;
      this.xpValue = arch.xpValue;
      this.isBoss = arch.isBoss ?? false;
      this.movement = arch.movement ?? "seek";
      this.splitInto = arch.splitInto ?? null;
      this.color = arch.color;
      this.chargeTimer = CHARGE_INTERVAL;
      this.dashing = false;
      this.dashTime = 0;
      this.range = arch.range ?? 0;
      this.fireInterval = arch.fireInterval ?? 0;
      this.fireTimer = this.fireInterval;
      this.bulletSpeed = arch.bulletSpeed ?? 0;
      this.bulletDamage = (arch.bulletDamage ?? 0) * dmgMult;
      this.bulletRadius = arch.bulletRadius ?? 0;
      this.burstTimer = arch.burstInterval ?? 0;
      this.enraged = false;
      this.arch = arch;
      this.flashTimer = 0;
      this.kbX = 0;
      this.kbY = 0;
      this.burnLeft = 0;
      this.burnDps = 0;
      this.burnTick = 0;
    },

    update(dt, target, sepX, sepY, world, ctx) {
      switch (this.movement) {
        case "charger":
          this.updateCharger(dt, target, sepX, sepY);
          break;
        case "ranged":
          this.updateRanged(dt, target, sepX, sepY, ctx);
          break;
        case "boss":
          this.updateBoss(dt, target, sepX, sepY, ctx);
          break;
        default:
          this.updateSeek(dt, target, sepX, sepY);
      }

      // Hit-flash + knockback impulse (decays fast; bosses barely budge).
      if (this.flashTimer > 0) this.flashTimer -= dt;
      if (this.kbX !== 0 || this.kbY !== 0) {
        this.x += this.kbX * dt;
        this.y += this.kbY * dt;
        const decay = Math.exp(-9 * dt);
        this.kbX *= decay;
        this.kbY *= decay;
        if (Math.abs(this.kbX) + Math.abs(this.kbY) < 1) {
          this.kbX = 0;
          this.kbY = 0;
        }
      }

      // Stay inside the arena.
      if (this.x < this.radius) this.x = this.radius;
      else if (this.x > world.width - this.radius) this.x = world.width - this.radius;
      if (this.y < this.radius) this.y = this.radius;
      else if (this.y > world.height - this.radius) this.y = world.height - this.radius;
    },

    updateSeek(dt, target, sepX, sepY, speedOverride) {
      let dx = target.x - this.x;
      let dy = target.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      dx /= d;
      dy /= d;

      let mx = dx + sepX * SEPARATION_WEIGHT;
      let my = dy + sepY * SEPARATION_WEIGHT;
      const m = Math.hypot(mx, my) || 1;
      const spd = speedOverride ?? this.speed;
      this.vx = (mx / m) * spd;
      this.vy = (my / m) * spd;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
    },

    updateCharger(dt, target, sepX, sepY) {
      if (this.dashing) {
        this.dashTime -= dt;
        this.x += this.dashVx * dt;
        this.y += this.dashVy * dt;
        if (this.dashTime <= 0) {
          this.dashing = false;
          this.chargeTimer = CHARGE_INTERVAL;
        }
        return;
      }
      this.updateSeek(dt, target, sepX, sepY);
      this.chargeTimer -= dt;
      if (this.chargeTimer <= 0) {
        let ax = target.x - this.x;
        let ay = target.y - this.y;
        const ad = Math.hypot(ax, ay) || 1;
        const dashSpeed = this.speed * DASH_MULT;
        this.dashVx = (ax / ad) * dashSpeed;
        this.dashVy = (ay / ad) * dashSpeed;
        this.dashTime = DASH_TIME;
        this.dashing = true;
      }
    },

    updateRanged(dt, target, sepX, sepY, ctx) {
      const dx = target.x - this.x;
      const dy = target.y - this.y;
      const d = Math.hypot(dx, dy) || 1;

      if (d > this.range) {
        // Close in until inside firing range.
        this.updateSeek(dt, target, sepX, sepY);
      } else {
        // Hold position; only drift apart from packed neighbors.
        this.x += sepX * this.speed * 0.5 * dt;
        this.y += sepY * this.speed * 0.5 * dt;
      }

      this.fireTimer -= dt;
      if (this.fireTimer <= 0 && d <= this.range * 1.15 && ctx?.fireBullet) {
        this.fireTimer = this.fireInterval;
        const angle = Math.atan2(dy, dx);
        ctx.fireBullet(this.x, this.y, angle, this.bulletSpeed, this.bulletDamage, this.bulletRadius);
      }
    },

    updateBoss(dt, target, sepX, sepY, ctx) {
      const a = this.arch;
      this.enraged = this.hp < this.maxHp * 0.5;
      const spd = this.enraged ? this.speed * (a.enragedSpeedMult ?? 1.5) : this.speed;
      this.updateSeek(dt, target, sepX, sepY, spd);

      this.burstTimer -= dt;
      if (this.burstTimer <= 0 && ctx?.fireBullet) {
        const count = this.enraged ? a.enragedBurstCount : a.burstCount;
        this.burstTimer = this.enraged ? a.enragedBurstInterval : a.burstInterval;
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2;
          ctx.fireBullet(this.x, this.y, angle, this.bulletSpeed, this.bulletDamage, this.bulletRadius);
        }
      }
    },

    render(ctx) {
      // Priority: hit-flash > charge telegraph > enrage tint > base color.
      const winding =
        this.movement === "charger" && !this.dashing && this.chargeTimer < 0.5;

      ctx.fillStyle =
        this.flashTimer > 0
          ? "#ffffff"
          : winding
            ? "#ffffff"
            : this.enraged
              ? "#ff4a2a"
              : this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = this.isBoss ? 2.5 : 1.5;
      ctx.strokeStyle = this.isBoss ? "#2a0a0a" : "rgba(0, 0, 0, 0.5)";
      ctx.stroke();

      // Burning: flickering ember ring.
      if (this.burnLeft > 0) {
        ctx.strokeStyle = "rgba(255, 120, 40, 0.85)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + 2.5 + Math.random() * 1.5, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (this.isBoss) this.drawHpBar(ctx);
    },

    drawHpBar(ctx) {
      const w = this.radius * 2;
      const h = 5;
      const x = this.x - this.radius;
      const y = this.y - this.radius - 10;
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = this.enraged ? "#ff8a2a" : "#ff5a5a";
      ctx.fillRect(x, y, w * Math.max(0, this.hp / this.maxHp), h);
    },
  };
}

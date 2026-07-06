// entities/projectile.js
// A single projectile. Pool-friendly: createProjectile() builds a blank object,
// reset() configures it from a fire behavior. One unified object covers both
// motion types so the rest of the system stays behavior-agnostic:
//   motion 'linear' — travels along (vx, vy)
//   motion 'orbit'  — circles its anchor (the player) at orbitRadius
//
// `recentlyHit` prevents hitting the same enemy twice in quick succession; for
// persistent shots (orbitals) it's periodically cleared so they re-tick.

export function createProjectile() {
  return {
    active: false,
    motion: "linear",
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    damage: 0,
    radius: 0,
    color: "#ffffff",
    remainingHits: 1, // Infinity = never consumed by hits (persistent)
    lifetime: 0,
    age: 0,
    reHitInterval: Infinity,
    reHitTimer: Infinity,
    recentlyHit: new Set(),
    // evolved-weapon payloads:
    burnDps: 0, // >0 = hits ignite the enemy (damage-over-time)
    burnDuration: 0,
    explodeRadius: 0, // >0 = detonate on first hit (AoE blast)
    explodeDamage: 0,
    // orbit-only:
    anchor: null,
    orbitAngle: 0,
    orbitRadius: 0,
    orbitSpeed: 0,
    orbitPulseAmp: 0, // >0 = orbit radius oscillates ±amp
    orbitPulseFreq: 0,

    reset(c) {
      this.active = true;
      this.motion = c.motion;
      this.x = c.x;
      this.y = c.y;
      this.vx = c.vx ?? 0;
      this.vy = c.vy ?? 0;
      this.damage = c.damage;
      this.radius = c.radius;
      this.color = c.color ?? "#ffffff";
      this.remainingHits = c.remainingHits;
      this.lifetime = c.lifetime;
      this.age = 0;
      this.reHitInterval = c.reHitInterval ?? Infinity;
      this.reHitTimer = this.reHitInterval;
      this.recentlyHit.clear();
      this.burnDps = c.burnDps ?? 0;
      this.burnDuration = c.burnDuration ?? 0;
      this.explodeRadius = c.explodeRadius ?? 0;
      this.explodeDamage = c.explodeDamage ?? 0;
      this.anchor = c.anchor ?? null;
      this.orbitAngle = c.orbitAngle ?? 0;
      this.orbitRadius = c.orbitRadius ?? 0;
      this.orbitSpeed = c.orbitSpeed ?? 0;
      this.orbitPulseAmp = c.orbitPulseAmp ?? 0;
      this.orbitPulseFreq = c.orbitPulseFreq ?? 0;
    },

    update(dt) {
      this.age += dt;
      if (this.motion === "orbit") {
        this.orbitAngle += this.orbitSpeed * dt;
        // Pulsing orbits (evolved) sweep in and out around the base radius.
        const r =
          this.orbitPulseAmp > 0
            ? Math.max(0, this.orbitRadius + Math.sin(this.age * this.orbitPulseFreq) * this.orbitPulseAmp)
            : this.orbitRadius;
        this.x = this.anchor.x + Math.cos(this.orbitAngle) * r;
        this.y = this.anchor.y + Math.sin(this.orbitAngle) * r;
      } else {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
      }
      if (this.reHitInterval !== Infinity) {
        this.reHitTimer -= dt;
        if (this.reHitTimer <= 0) {
          this.recentlyHit.clear();
          this.reHitTimer = this.reHitInterval;
        }
      }
    },

    render(ctx) {
      // Soft outer glow.
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius + 3, 0, Math.PI * 2);
      ctx.fill();
      // Core.
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
    },
  };
}

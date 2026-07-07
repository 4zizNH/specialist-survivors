// entities/player.js
// The player avatar. Colored circle with a facing indicator; later its stats
// come from the selected character + equipped tools.
//
// Movement reads the input layer's ANALOG moveVector() — keyboard is digital,
// gamepad stick / touch joystick give partial speeds — so the player is
// input-device-agnostic. Health: contact damage is applied via takeDamage(),
// which grants brief invulnerability frames (iframes) so a swarm can't delete
// you in one frame. Slow passive regen ticks while alive. render() draws in
// WORLD space.

import { moveVector } from "../engine/input.js";

const IFRAME_DURATION = 0.5; // seconds of invulnerability after a hit

export function createPlayer(x, y) {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    speed: 260, // px/sec
    radius: 16,
    pickupRadius: 80,
    maxHp: 100,
    hp: 100,
    regen: 0.5, // hp/sec passive (optional, minor)
    might: 1, // damage multiplier (from character)
    cooldownMult: 1, // weapon cooldown multiplier (<1 = faster)
    // Character passive hooks (set by startRun from the character def).
    critChance: 0, // chance any hit deals double damage
    xpMult: 1, // multiplies XP collected from gems
    onKillHeal: 0, // HP restored per kill
    lowHpSpeedBoost: 0, // +% move speed while below half HP
    passiveItems: [], // passive-item ids picked this run (data/passives.js)
    iframeTimer: 0,
    color: "#5ac8ff",
    faceX: 0,
    faceY: 1,

    // Returns true if the damage APPLIED (false while invulnerable/dead) —
    // used for hit feedback. Death is detected via hp <= 0.
    takeDamage(amount) {
      if (this.iframeTimer > 0 || this.hp <= 0) return false;
      this.hp -= amount;
      this.iframeTimer = IFRAME_DURATION;
      if (this.hp <= 0) this.hp = 0;
      return true;
    },

    get invulnerable() {
      return this.iframeTimer > 0;
    },

    update(dt, world) {
      if (this.iframeTimer > 0) this.iframeTimer -= dt;
      if (this.hp > 0 && this.hp < this.maxHp) {
        this.hp = Math.min(this.maxHp, this.hp + this.regen * dt);
      }

      // Analog movement: magnitude ≤ 1 (stick/joystick tilt = partial speed).
      const mv = moveVector();
      const dx = mv.x;
      const dy = mv.y;
      if (dx !== 0 || dy !== 0) {
        const inv = 1 / (Math.hypot(dx, dy) || 1);
        this.faceX = dx * inv;
        this.faceY = dy * inv;
      }

      // Adrenaline-style passives: faster while below half HP.
      const boosted =
        this.lowHpSpeedBoost > 0 && this.hp < this.maxHp * 0.5
          ? this.speed * (1 + this.lowHpSpeedBoost)
          : this.speed;
      this.vx = dx * boosted;
      this.vy = dy * boosted;
      this.x += this.vx * dt;
      this.y += this.vy * dt;

      this.x = clamp(this.x, this.radius, world.width - this.radius);
      this.y = clamp(this.y, this.radius, world.height - this.radius);
    },

    render(ctx) {
      // Faint pickup-radius ring (shows the magnet zone).
      ctx.strokeStyle = "rgba(120, 200, 255, 0.10)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.pickupRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Blink while invulnerable.
      const blink =
        this.iframeTimer > 0 && Math.floor(this.iframeTimer * 16) % 2 === 0;
      ctx.globalAlpha = blink ? 0.35 : 1;

      // Soft ground shadow for depth/readability.
      ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
      ctx.beginPath();
      ctx.ellipse(
        this.x,
        this.y + this.radius * 0.7,
        this.radius * 0.9,
        this.radius * 0.45,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();

      // Body.
      ctx.fillStyle = this.color;
      ctx.strokeStyle = "#0a0a0f";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Facing nub.
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(
        this.x + this.faceX * this.radius,
        this.y + this.faceY * this.radius
      );
      ctx.stroke();

      ctx.globalAlpha = 1;
    },
  };
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

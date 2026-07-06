// entities/pickup.js
// XP gem dropped by a dying enemy. Pool-friendly. The XP system (systems/xp.js)
// owns the pool and drives magnet/collection; the gem just holds its value and
// draws itself (in WORLD space). Size scales with value.

export function createGem() {
  return {
    active: false,
    x: 0,
    y: 0,
    value: 0,

    reset(x, y, value) {
      this.active = true;
      this.x = x;
      this.y = y;
      this.value = value;
    },

    render(ctx) {
      const s = 3 + this.value * 0.6; // bigger gem = more XP
      // glow
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = "#74f0a0";
      ctx.beginPath();
      ctx.arc(this.x, this.y, s + 2, 0, Math.PI * 2);
      ctx.fill();
      // diamond body
      ctx.globalAlpha = 1;
      ctx.fillStyle = this.value >= 5 ? "#5ad1ff" : "#74f0a0";
      ctx.beginPath();
      ctx.moveTo(this.x, this.y - s);
      ctx.lineTo(this.x + s, this.y);
      ctx.lineTo(this.x, this.y + s);
      ctx.lineTo(this.x - s, this.y);
      ctx.closePath();
      ctx.fill();
    },
  };
}

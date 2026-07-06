// systems/floatingText.js
// Floating combat text (damage numbers). Pooled, drawn in WORLD space so each
// number rises from the hit location and fades out.

import { createPool } from "../engine/pool.js";

const RISE_SPEED = 38; // px/sec upward
const GRAVITY = 26; // slight deceleration so it eases out
const DURATION = 0.7; // seconds

export function createFloatingText() {
  const pool = createPool(() => ({
    active: false,
    x: 0,
    y: 0,
    vy: 0,
    age: 0,
    text: "",
    color: "#ffffff",
    size: 14,
  }));

  return {
    spawn(x, y, text, color = "#ffffff", size = 14) {
      const t = pool.acquire();
      t.active = true;
      t.x = x;
      t.y = y;
      t.vy = -RISE_SPEED;
      t.age = 0;
      t.text = text;
      t.color = color;
      t.size = size;
    },

    update(dt) {
      const a = pool.active;
      for (let i = a.length - 1; i >= 0; i--) {
        const t = a[i];
        t.age += dt;
        t.y += t.vy * dt;
        t.vy += GRAVITY * dt;
        if (t.age >= DURATION) pool.release(t);
      }
    },

    render(ctx) {
      const a = pool.active;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let i = 0; i < a.length; i++) {
        const t = a[i];
        ctx.globalAlpha = Math.max(0, 1 - t.age / DURATION);
        ctx.fillStyle = t.color;
        ctx.font = `bold ${t.size}px ui-monospace, monospace`;
        ctx.fillText(t.text, t.x, t.y);
      }
      ctx.globalAlpha = 1;
    },

    reset() {
      pool.releaseAll();
    },

    get count() {
      return pool.activeCount;
    },
  };
}

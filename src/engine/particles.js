// engine/particles.js
// Pooled particle system for juice: death bursts, gem pops/trails, level-up
// rings. Hard cap keeps a full swarm from ever exploding the particle count.
// render() culls to the visible world rect when bounds are provided.

import { createPool } from "./pool.js";

const CAP = 700; // max simultaneous particles
const DRAG = 3; // velocity decay per second (exponential)

export function createParticles() {
  const pool = createPool(() => ({
    x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 0, size: 0, color: "#fff",
  }));

  function emit(x, y, vx, vy, life, size, color) {
    if (pool.activeCount >= CAP) return;
    const p = pool.acquire();
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.age = 0;
    p.life = life;
    p.size = size;
    p.color = color;
  }

  return {
    // Radial burst with randomized speed/direction (death pops, sparkles).
    burst(x, y, color, count = 8, speed = 130, life = 0.45, size = 3) {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = speed * (0.4 + Math.random() * 0.8);
        emit(x, y, Math.cos(a) * s, Math.sin(a) * s, life * (0.7 + Math.random() * 0.6), size, color);
      }
    },

    // Even ring (level-up flourish).
    ring(x, y, color, count = 26, speed = 240, life = 0.55, size = 3.5) {
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        emit(x, y, Math.cos(a) * speed, Math.sin(a) * speed, life, size, color);
      }
    },

    // Single faint spark (gem magnet trails).
    spark(x, y, color, size = 2) {
      emit(x, y, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, 0.3, size, color);
    },

    update(dt) {
      const a = pool.active;
      const decay = Math.exp(-DRAG * dt);
      for (let i = a.length - 1; i >= 0; i--) {
        const p = a[i];
        p.age += dt;
        if (p.age >= p.life) {
          pool.release(p);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= decay;
        p.vy *= decay;
      }
    },

    // Draws in WORLD space; `b` = visible bounds for culling (optional).
    render(ctx, b) {
      const a = pool.active;
      for (let i = 0; i < a.length; i++) {
        const p = a[i];
        if (b && (p.x < b.left || p.x > b.right || p.y < b.top || p.y > b.bottom)) continue;
        ctx.globalAlpha = Math.max(0, 1 - p.age / p.life);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
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

// ui/toasts.js
// Non-blocking notification banners (achievement unlocks, character unlocks).
// Drawn in SCREEN space, top-right, stacking downward; each slides in, holds,
// and fades out. Rendered over EVERY state (runs, hub, results) so an unlock is
// never missed; updated even while the run is frozen.

const TOAST_DURATION = 4.6; // s on screen
const SLIDE_IN = 0.25; // s
const FADE_OUT = 0.45; // s
const MAX_VISIBLE = 4;

export function createToasts() {
  const list = []; // { title, sub, color, age }

  return {
    push(title, sub = "", color = "#ffd34d") {
      list.push({ title, sub, color, age: 0 });
    },

    update(dt) {
      for (let i = list.length - 1; i >= 0; i--) {
        list[i].age += dt;
        if (list[i].age >= TOAST_DURATION) list.splice(i, 1);
      }
    },

    render(ctx, view) {
      if (list.length === 0) return;
      const w = 330;
      const h = 54;
      const gap = 10;
      let y = 44; // below the kills counter
      const visible = list.slice(0, MAX_VISIBLE);
      for (const t of visible) {
        // Slide in from the right; fade out at the end.
        const inT = Math.min(1, t.age / SLIDE_IN);
        const slide = (1 - easeOut(inT)) * (w + 24);
        const alpha = t.age > TOAST_DURATION - FADE_OUT ? (TOAST_DURATION - t.age) / FADE_OUT : 1;
        const x = view.width - w - 14 + slide;

        ctx.save();
        ctx.globalAlpha = Math.max(0, alpha);
        roundRect(ctx, x, y, w, h, 9);
        ctx.fillStyle = "rgba(16, 16, 24, 0.94)";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = t.color;
        ctx.stroke();
        // Accent bar.
        ctx.fillStyle = t.color;
        ctx.fillRect(x, y + 8, 4, h - 16);

        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = t.color;
        ctx.font = "700 14px system-ui, sans-serif";
        ctx.fillText(clip(ctx, t.title, w - 32), x + 16, y + 23);
        if (t.sub) {
          ctx.fillStyle = "#b8b8c8";
          ctx.font = "12px system-ui, sans-serif";
          ctx.fillText(clip(ctx, t.sub, w - 32), x + 16, y + 41);
        }
        ctx.restore();

        y += h + gap;
      }
    },

    reset() {
      list.length = 0;
    },

    get count() {
      return list.length;
    },
  };
}

function easeOut(t) {
  return 1 - (1 - t) * (1 - t);
}

function clip(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + "…").width > maxW) s = s.slice(0, -1);
  return s + "…";
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

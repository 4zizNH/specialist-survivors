// ui/evolutionScreen.js
// The weapon-evolution reveal, drawn in SCREEN space over the frozen world.
// Timed like the fusion reveal: rays + expanding rings burst from the center,
// the base weapon name burns away into the evolved one. main.js gates the
// dismiss key until the animation has landed.
//
// reveal = { fromName, toName, desc, color, passiveName }; t = seconds elapsed.

import { addRegion } from "../engine/hitRegions.js";
import { hintLine } from "./inputHints.js";

export const EVOLUTION_DISMISS_DELAY = 0.9; // s before Enter is accepted

export function drawEvolutionScreen(ctx, view, reveal, t) {
  const w = view.width;
  const h = view.height;
  const cx = w / 2;
  const cy = h / 2;

  ctx.fillStyle = "rgba(6, 4, 2, 0.88)";
  ctx.fillRect(0, 0, w, h);
  addRegion("confirm", 0, 0, w, h); // tap anywhere claims the weapon (delay-gated in main)

  const color = reveal.color || "#ffd34d";
  const ease = Math.min(1, t / 0.6); // 0→1 entrance

  // Rotating rays.
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t * 0.35);
  ctx.globalAlpha = 0.14 * ease;
  ctx.fillStyle = color;
  for (let i = 0; i < 10; i++) {
    ctx.rotate(Math.PI / 5);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w, -40);
    ctx.lineTo(w, 40);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Expanding rings.
  for (let i = 0; i < 3; i++) {
    const rt = (t * 0.9 + i * 0.33) % 1;
    ctx.globalAlpha = (1 - rt) * 0.5 * ease;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy - 20, 40 + rt * 260, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Core glow + weapon sigil.
  const pulse = 1 + Math.sin(t * 6) * 0.06;
  const grad = ctx.createRadialGradient(cx, cy - 20, 0, cx, cy - 20, 120 * pulse);
  grad.addColorStop(0, hexA(color, 0.55 * ease));
  grad.addColorStop(1, hexA(color, 0));
  ctx.fillStyle = grad;
  ctx.fillRect(cx - 130, cy - 150, 260, 260);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy - 20, 26 * pulse * ease, 0, Math.PI * 2);
  ctx.fill();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Title.
  ctx.fillStyle = "#ffd34d";
  ctx.font = `700 ${Math.round(40 + 6 * ease)}px system-ui, sans-serif`;
  ctx.fillText("⚡ EVOLUTION ⚡", cx, cy - 150);

  // From → To.
  ctx.fillStyle = "#8a8a9c";
  ctx.font = "600 18px system-ui, sans-serif";
  ctx.fillText(reveal.fromName, cx, cy + 42);
  ctx.fillStyle = "#cfcfe0";
  ctx.font = "20px system-ui, sans-serif";
  ctx.fillText("▼", cx, cy + 68);
  if (t > 0.45) {
    ctx.fillStyle = color;
    ctx.font = "700 34px system-ui, sans-serif";
    ctx.fillText(reveal.toName, cx, cy + 104);
  }

  // Flavor + recipe credit.
  if (t > 0.7) {
    ctx.fillStyle = "#b8b8c8";
    ctx.font = "15px system-ui, sans-serif";
    ctx.fillText(reveal.desc, cx, cy + 140);
    ctx.fillStyle = "#7a7a8c";
    ctx.font = "13px ui-monospace, monospace";
    ctx.fillText(`${reveal.fromName} MAX + ${reveal.passiveName}`, cx, cy + 164);
  }

  if (t > EVOLUTION_DISMISS_DELAY) {
    ctx.fillStyle = "#e8e8f0";
    ctx.font = "600 15px system-ui, sans-serif";
    const blink = Math.floor(t * 2) % 2 === 0;
    if (blink)
      ctx.fillText(
        hintLine("Press Enter to wield it", "Press Ⓐ to wield it", "Tap to wield it"),
        cx,
        h - 70
      );
  }
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

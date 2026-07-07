// ui/touchControls.js
// In-run touch chrome, drawn in SCREEN space over the HUD:
//  - the floating virtual joystick (base ring + knob) while a steering touch
//    is down — it spawns wherever the finger landed;
//  - a pause button (top-right, 44px+) since touch has no Esc key.
// Both appear only when touch is the active input method (the joystick ring
// additionally only while actively steering).

import { joystickState } from "../engine/input.js";
import { addRegion } from "../engine/hitRegions.js";
import { isTouch } from "./inputHints.js";

export function drawTouchControls(ctx, view) {
  if (!isTouch()) return;

  // --- Pause button (top-right, under the kills counter) ---
  const s = 44;
  const px = view.width - s - 10;
  const py = 38;
  ctx.beginPath();
  ctx.arc(px + s / 2, py + s / 2, s / 2, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(18, 18, 26, 0.75)";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.stroke();
  ctx.fillStyle = "#e0e0ea";
  ctx.fillRect(px + s / 2 - 7, py + s / 2 - 8, 5, 16);
  ctx.fillRect(px + s / 2 + 2, py + s / 2 - 8, 5, 16);
  addRegion("pause", px - 8, py - 8, s + 16, s + 16);

  // --- Floating joystick (only while steering) ---
  const joy = joystickState();
  if (!joy.active) return;
  const r = joy.radius;
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.arc(joy.baseX, joy.baseY, r, 0, Math.PI * 2);
  ctx.fillStyle = "#8898b8";
  ctx.fill();
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.arc(joy.baseX + joy.dx * r, joy.baseY + joy.dy * r, r * 0.42, 0, Math.PI * 2);
  ctx.fillStyle = "#dfe8ff";
  ctx.fill();
  ctx.globalAlpha = 1;
}

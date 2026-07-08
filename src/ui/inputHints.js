// ui/inputHints.js
// Device-aware UI hints. Screens pass three variants of their control line and
// the active input method (from the input layer) picks one — so a gamepad user
// sees "Ⓐ select", a touch user sees "tap", and keyboard users see keys.
//
// Also home to the shared "‹ Back" chip: a always-visible, clickable/tappable
// back button (top-left) so mouse AND touch users can leave any sub-screen
// without knowing the Esc shortcut. It registers the "back" hit region.

import { inputMethod } from "../engine/input.js";
import { addRegion } from "../engine/hitRegions.js";

export function hintLine(kb, pad, touch) {
  const m = inputMethod();
  return m === "gamepad" ? pad : m === "touch" ? touch : kb;
}

export function isTouch() {
  return inputMethod() === "touch";
}

// Compact top-left back button — a "‹" circle (the universal mobile back). Kept
// small so it clears the centered screen titles; always drawn on sub-screens,
// clickable/tappable via the "back" hit region. Keyboard users can still press
// Esc and gamepad users Ⓑ.
export function drawBackChip(ctx, view) {
  const cx = 30;
  const cy = 30;
  const r = 20;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(24, 24, 34, 0.92)";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(255,255,255,0.30)";
  ctx.stroke();
  ctx.fillStyle = "#cfcfe0";
  ctx.font = "700 26px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("‹", cx - 1, cy);
  ctx.textBaseline = "alphabetic";
  addRegion("back", cx - r - 6, cy - r - 6, r * 2 + 12, r * 2 + 12); // generous target
}

// ui/inputHints.js
// Device-aware UI hints. Screens pass three variants of their control line and
// the active input method (from the input layer) picks one — so a gamepad user
// sees "Ⓐ select", a touch user sees "tap", and keyboard users see keys.
//
// Also home to the shared touch chrome: the "‹ Back" chip drawn on sub-screens
// when touch is the active method (registers the "back" hit region).

import { inputMethod } from "../engine/input.js";
import { addRegion } from "../engine/hitRegions.js";

export function hintLine(kb, pad, touch) {
  const m = inputMethod();
  return m === "gamepad" ? pad : m === "touch" ? touch : kb;
}

export function isTouch() {
  return inputMethod() === "touch";
}

// Bottom-left back chip (44px+ touch target). Drawn + registered only when
// touch is active; keyboard/gamepad users use Esc / Ⓑ instead.
export function drawBackChip(ctx, view) {
  if (!isTouch()) return;
  const x = 12;
  const h = 44;
  const w = 92;
  const y = view.height - h - 12;
  ctx.beginPath();
  ctx.moveTo(x + 10, y);
  ctx.arcTo(x + w, y, x + w, y + h, 10);
  ctx.arcTo(x + w, y + h, x, y + h, 10);
  ctx.arcTo(x, y + h, x, y, 10);
  ctx.arcTo(x, y, x + w, y, 10);
  ctx.closePath();
  ctx.fillStyle = "rgba(24, 24, 34, 0.92)";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.stroke();
  ctx.fillStyle = "#cfcfe0";
  ctx.font = "700 16px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("‹ Back", x + w / 2, y + h / 2 + 1);
  addRegion("back", x - 6, y - 6, w + 12, h + 12); // generous target
}

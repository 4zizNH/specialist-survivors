// ui/responsive.js
// Small helpers for making the canvas-drawn UI adapt to phone-sized viewports
// (both orientations). Kept tiny and dependency-free so any screen can use it.

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// True when the viewport is narrow enough to warrant a compact/stacked layout.
export function isNarrow(view) {
  return view.width < 760;
}

// A uniform scale for the in-run HUD so it stays proportional on small screens.
export function hudScale(view) {
  return clamp(view.width / 520, 0.62, 1);
}

// Largest font size (≤ maxPx, ≥ minPx) at which `text` fits `maxWidth`. Sets
// ctx.font to the chosen size and returns it. One measure, no loop: glyph width
// scales ~linearly with px for a given face.
export function fitFont(ctx, text, maxWidth, maxPx, opts = {}) {
  const { minPx = 10, weight = "700", family = "system-ui, sans-serif" } = opts;
  ctx.font = `${weight} ${maxPx}px ${family}`;
  const wAt = ctx.measureText(text).width;
  const px = wAt <= maxWidth ? maxPx : Math.max(minPx, Math.floor((maxPx * maxWidth) / wAt));
  ctx.font = `${weight} ${px}px ${family}`;
  return px;
}

// Truncates `text` with an ellipsis so it fits `maxW` at the CURRENT ctx.font
// (caller sets font/color first). Returns the text unchanged if it already fits.
export function clipText(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + "…").width > maxW) s = s.slice(0, -1);
  return s + "…";
}

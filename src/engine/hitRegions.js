// engine/hitRegions.js
// Tap/click hit-testing for canvas-drawn UI. Screens register rectangular
// regions (with an id) as they render each frame; main.js hit-tests queued
// taps against last frame's regions. clearRegions() runs at the start of every
// render, so the registry always mirrors what's actually on screen.
//
// Later registrations win (drawn on top ⇒ hit first), so overlays like
// dialogs naturally shadow the screen beneath them.

const regions = [];

export function clearRegions() {
  regions.length = 0;
}

export function addRegion(id, x, y, w, h) {
  regions.push({ id, x, y, w, h });
}

export function hitRegion(px, py) {
  for (let i = regions.length - 1; i >= 0; i--) {
    const r = regions[i];
    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return r.id;
  }
  return null;
}

// engine/canvas.js
// Owns the <canvas>: device-pixel-ratio scaling and full-window resize.
//
// Drawing is done in CSS pixels — we scale the backing store by DPR and apply
// a matching transform, so render code never has to think about retina.

export function createCanvas(id) {
  const canvas = document.getElementById(id);
  if (!canvas) throw new Error(`Canvas #${id} not found`);
  const ctx = canvas.getContext("2d");

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    // Backing store in physical pixels...
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    // ...but draw in CSS pixels.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  window.addEventListener("resize", resize);
  resize();

  return {
    canvas,
    ctx,
    // Logical (CSS-pixel) dimensions for layout/render math.
    get width() {
      return window.innerWidth;
    },
    get height() {
      return window.innerHeight;
    },
  };
}

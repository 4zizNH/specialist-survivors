// engine/canvas.js
// Owns the <canvas>: device-pixel-ratio scaling and full-window resize.
//
// Drawing is done in CSS pixels — we scale the backing store by DPR and apply
// a matching transform, so render code never has to think about retina.
//
// CRITICAL for input accuracy on mobile: the canvas ELEMENT's CSS size is set
// explicitly (in JS) to window.innerWidth/innerHeight — the same values the
// drawing space uses — instead of relying on CSS `100vw/100vh`. On mobile
// `100vh` is the address-bar-hidden height, which differs from innerHeight when
// the bar is showing; that mismatch stretches the canvas and makes every
// tap/click land at the wrong spot (and pushes bottom content off-screen). We
// also re-fit when the visual viewport changes (address bar show/hide, rotate).

export function createCanvas(id) {
  const canvas = document.getElementById(id);
  if (!canvas) throw new Error(`Canvas #${id} not found`);
  const ctx = canvas.getContext("2d");

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    // Backing store in physical pixels...
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    // ...displayed at exactly the drawing size so pointer coords map 1:1...
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    // ...and draw in CSS pixels.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", resize);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", resize);
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

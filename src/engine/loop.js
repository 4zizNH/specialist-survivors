// engine/loop.js
// Fixed-timestep game loop.
//
// update(dt) is called at a constant 60 Hz (dt = 1/60 s) so simulation is
// deterministic and frame-rate independent. render(alpha) is called once per
// animation frame; `alpha` is the 0..1 fraction into the next step, available
// for interpolation later. A clamp on delta prevents the "spiral of death"
// after a tab stall.

const FIXED_DT = 1 / 60; // seconds per simulation step (60 FPS)
const MAX_FRAME = 0.25; // clamp huge deltas (e.g. background tab)

export function createLoop({ update, render }) {
  let accumulator = 0;
  let last = 0;
  let running = false;
  let rafId = null;

  function frame(nowMs) {
    if (!running) return;

    const now = nowMs / 1000;
    let delta = now - last;
    last = now;
    if (delta > MAX_FRAME) delta = MAX_FRAME;

    accumulator += delta;
    while (accumulator >= FIXED_DT) {
      update(FIXED_DT);
      accumulator -= FIXED_DT;
    }

    render(accumulator / FIXED_DT);
    rafId = requestAnimationFrame(frame);
  }

  return {
    start() {
      if (running) return;
      running = true;
      last = performance.now() / 1000;
      rafId = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
    },
    get isRunning() {
      return running;
    },
  };
}

// engine/camera.js
// A 2D camera that follows a target and keeps it centered. Stores the world
// coordinate at the top-left of the viewport (x, y). World-space rendering
// either subtracts (x, y) manually or applies translate(-x, -y) to the ctx.

export function createCamera(view) {
  let x = 0;
  let y = 0;

  return {
    get x() {
      return x;
    },
    get y() {
      return y;
    },

    // Center the viewport on the target's world position.
    follow(target) {
      x = target.x - view.width / 2;
      y = target.y - view.height / 2;
    },

    // Convert a world point to a screen point.
    worldToScreen(wx, wy) {
      return { x: wx - x, y: wy - y };
    },
  };
}

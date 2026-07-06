// engine/background.js
// Draws the scrolling world floor: a void outside the world, a tinted floor
// for the world rectangle, a grid clipped to that floor, and a border so the
// world's edges are visible. All drawn in screen space using the camera's
// top-left world coordinate, so no ctx transform is required.

export function drawBackground(ctx, camera, view, world) {
  const vw = view.width;
  const vh = view.height;
  const tile = world.tileSize;

  // The void beyond the world.
  ctx.fillStyle = "#06060a";
  ctx.fillRect(0, 0, vw, vh);

  // Where world (0,0) lands on screen.
  const ox = -camera.x;
  const oy = -camera.y;

  // Visible slice of the world floor, clamped to the viewport.
  const fx = Math.max(0, ox);
  const fy = Math.max(0, oy);
  const fr = Math.min(vw, ox + world.width);
  const fb = Math.min(vh, oy + world.height);
  if (fr <= fx || fb <= fy) return; // world entirely off-screen

  // Floor fill.
  ctx.fillStyle = "#0d0d16";
  ctx.fillRect(fx, fy, fr - fx, fb - fy);

  // Grid lines, clipped to the floor so they don't bleed into the void.
  ctx.save();
  ctx.beginPath();
  ctx.rect(fx, fy, fr - fx, fb - fy);
  ctx.clip();

  ctx.strokeStyle = "#191926";
  ctx.lineWidth = 1;
  ctx.beginPath();
  // +0.5 keeps 1px lines crisp.
  const startX = Math.floor(camera.x / tile) * tile;
  for (let x = startX; x <= camera.x + vw; x += tile) {
    const sx = Math.round(x - camera.x) + 0.5;
    ctx.moveTo(sx, fy);
    ctx.lineTo(sx, fb);
  }
  const startY = Math.floor(camera.y / tile) * tile;
  for (let y = startY; y <= camera.y + vh; y += tile) {
    const sy = Math.round(y - camera.y) + 0.5;
    ctx.moveTo(fx, sy);
    ctx.lineTo(fr, sy);
  }
  ctx.stroke();
  ctx.restore();

  // World border.
  ctx.strokeStyle = "#2a2a40";
  ctx.lineWidth = 2;
  ctx.strokeRect(ox + 1, oy + 1, world.width - 2, world.height - 2);
}

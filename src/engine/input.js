// engine/input.js
// Keyboard input. Tracks held keys (for continuous movement) and one-shot
// presses (for menu/state actions). Call endFrameInput() at the end of each
// fixed update so wasPressed() only fires on the tick the key went down.

const held = new Set();
const pressedThisFrame = new Set();

export function initInput(target = window) {
  target.addEventListener("keydown", (e) => {
    if (!held.has(e.code)) pressedThisFrame.add(e.code);
    held.add(e.code);
    // Stop arrows/space from scrolling the page.
    if (SCROLL_KEYS.has(e.code)) e.preventDefault();
  });
  target.addEventListener("keyup", (e) => {
    held.delete(e.code);
  });
  // Drop held state if focus is lost, so keys don't get "stuck".
  window.addEventListener("blur", () => {
    held.clear();
    pressedThisFrame.clear();
  });
}

const SCROLL_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Space",
]);

export function isDown(code) {
  return held.has(code);
}

export function wasPressed(code) {
  return pressedThisFrame.has(code);
}

export function endFrameInput() {
  pressedThisFrame.clear();
}

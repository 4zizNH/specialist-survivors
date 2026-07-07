// engine/input.js
// The INPUT ABSTRACTION LAYER. Gameplay and menus read ACTIONS — moveVector(),
// pressed("confirm"), pressed("navUp"), ... — never raw keys, buttons, or
// touches. Three backends (keyboard, gamepad, touch) feed the same actions,
// so every system stays input-agnostic.
//
//  - One-shot actions: pressed(action) is true only on the tick the press
//    happened; endFrameInput() clears them (same contract as old wasPressed).
//  - Movement: moveVector() is ANALOG — magnitude ≤ 1. Gamepad stick and the
//    touch joystick give partial speeds; keyboard is digital.
//  - Taps: touch taps and mouse clicks queue screen-space points; the game
//    hit-tests them against regions registered during render (hitRegions.js).
//  - inputMethod() reports the most recent device ("keyboard" | "gamepad" |
//    "touch") so UI hint lines can adapt.
//
// Tunables (dead zone, repeat rates, joystick radius) come from data/balance.js
// INPUT, passed in via initInput(canvas, config).

const DEFAULTS = {
  gamepadDeadZone: 0.22,
  stickNavThreshold: 0.55,
  stickNavRepeatDelay: 0.4,
  stickNavRepeatRate: 0.14,
  touchJoystickRadius: 64,
  touchTapMaxDist: 14,
};
let cfg = { ...DEFAULTS };

// --- Action maps -------------------------------------------------------------

// Keyboard code → actions.
const KEY_ACTIONS = {
  ArrowUp: ["navUp"], KeyW: ["navUp"],
  ArrowDown: ["navDown"], KeyS: ["navDown"],
  ArrowLeft: ["navLeft"], KeyA: ["navLeft"],
  ArrowRight: ["navRight"], KeyD: ["navRight"],
  Enter: ["confirm"], NumpadEnter: ["confirm"], Space: ["confirm"],
  Escape: ["cancel", "pause"], // context decides which applies
  KeyP: ["pause"],
  Digit1: ["choice1"], Numpad1: ["choice1"],
  Digit2: ["choice2"], Numpad2: ["choice2"],
  Digit3: ["choice3"], Numpad3: ["choice3"],
  KeyE: ["equip"],
  KeyX: ["remove"], Delete: ["remove"],
  KeyF: ["filterCat"],
  KeyR: ["filterRar"],
  KeyC: ["tryChar"],
  KeyK: ["debugDie"],
  F3: ["debugToggle"],
};

// Standard-mapping gamepad button → actions.
// A confirm · B cancel · X equip · Y remove/tryChar · LB/RB filters · Start pause.
const PAD_BUTTON_ACTIONS = {
  0: ["confirm"],
  1: ["cancel"],
  2: ["equip"],
  3: ["remove", "tryChar"],
  4: ["filterCat"],
  5: ["filterRar"],
  9: ["pause"],
  12: ["navUp"],
  13: ["navDown"],
  14: ["navLeft"],
  15: ["navRight"],
};

const SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"]);

// --- State --------------------------------------------------------------------

const heldKeys = new Set();
const pressedActions = new Set();
let method = "keyboard"; // most recent input device

// Gamepad.
let padIndex = null; // the active pad's index
let padButtonsDown = []; // previous frame's button state (edge detection)
let padDisconnectFlag = false;
let stickNavDir = null; // current quantized stick direction (menu nav)
let stickNavTimer = 0;

// Touch.
let joystickEnabled = false; // main.js enables this during PLAYING only
let joyTouchId = null;
const joy = { active: false, baseX: 0, baseY: 0, dx: 0, dy: 0 }; // dx/dy ∈ [-1, 1]
const touchStarts = new Map(); // id → { x, y, moved } (tap candidates)
let taps = []; // queued screen-space taps/clicks

// --- Init ----------------------------------------------------------------------

export function initInput(canvas = null, config = {}) {
  cfg = { ...DEFAULTS, ...config };

  window.addEventListener("keydown", (e) => {
    method = "keyboard";
    if (!heldKeys.has(e.code)) {
      for (const a of KEY_ACTIONS[e.code] || []) pressedActions.add(a);
    }
    heldKeys.add(e.code);
    if (SCROLL_KEYS.has(e.code)) e.preventDefault();
  });
  window.addEventListener("keyup", (e) => heldKeys.delete(e.code));
  // Drop held state if focus is lost, so keys don't get "stuck".
  window.addEventListener("blur", () => {
    heldKeys.clear();
    pressedActions.clear();
    releaseJoystick();
  });

  window.addEventListener("gamepadconnected", (e) => {
    if (padIndex === null) padIndex = e.gamepad.index;
  });
  window.addEventListener("gamepaddisconnected", (e) => {
    if (e.gamepad.index === padIndex) {
      padIndex = null;
      padButtonsDown = [];
      // Losing the pad you were playing with is a real problem — flag it so
      // main.js can pause and explain.
      if (method === "gamepad") padDisconnectFlag = true;
    }
  });

  if (canvas) {
    const opts = { passive: false }; // we preventDefault to stop browser gestures
    canvas.addEventListener("touchstart", onTouchStart, opts);
    canvas.addEventListener("touchmove", onTouchMove, opts);
    canvas.addEventListener("touchend", onTouchEnd, opts);
    canvas.addEventListener("touchcancel", onTouchEnd, opts);
    // Mouse clicks double as taps so canvas menus are clickable on desktop.
    // (Touch taps don't re-fire here: preventDefault suppresses synthetic clicks.)
    canvas.addEventListener("click", (e) => taps.push({ x: e.clientX, y: e.clientY }));
  }
}

// --- Touch backend --------------------------------------------------------------

function onTouchStart(e) {
  e.preventDefault(); // no pull-to-refresh / double-tap zoom during play
  method = "touch";
  for (const t of e.changedTouches) {
    // During runs, a touch in the lower-left region spawns the floating
    // joystick under the finger; everything else is a tap candidate.
    if (
      joystickEnabled &&
      joyTouchId === null &&
      t.clientX < window.innerWidth * 0.6 &&
      t.clientY > window.innerHeight * 0.25
    ) {
      joyTouchId = t.identifier;
      joy.active = true;
      joy.baseX = t.clientX;
      joy.baseY = t.clientY;
      joy.dx = 0;
      joy.dy = 0;
    } else {
      touchStarts.set(t.identifier, { x: t.clientX, y: t.clientY, moved: false });
    }
  }
}

function onTouchMove(e) {
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.identifier === joyTouchId) {
      const r = cfg.touchJoystickRadius;
      let dx = (t.clientX - joy.baseX) / r;
      let dy = (t.clientY - joy.baseY) / r;
      const m = Math.hypot(dx, dy);
      if (m > 1) {
        dx /= m;
        dy /= m;
      }
      joy.dx = dx;
      joy.dy = dy;
    } else {
      const s = touchStarts.get(t.identifier);
      if (s && Math.hypot(t.clientX - s.x, t.clientY - s.y) > cfg.touchTapMaxDist) {
        s.moved = true; // drifted too far — a drag, not a tap
      }
    }
  }
}

function onTouchEnd(e) {
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.identifier === joyTouchId) {
      releaseJoystick();
    } else {
      const s = touchStarts.get(t.identifier);
      touchStarts.delete(t.identifier);
      if (s && !s.moved) taps.push({ x: t.clientX, y: t.clientY });
    }
  }
}

function releaseJoystick() {
  joyTouchId = null;
  joy.active = false;
  joy.dx = 0;
  joy.dy = 0;
}

// --- Gamepad backend --------------------------------------------------------------

function activePad() {
  if (typeof navigator === "undefined" || !navigator.getGamepads) return null;
  const pads = navigator.getGamepads();
  if (padIndex !== null && pads[padIndex] && pads[padIndex].connected) return pads[padIndex];
  // Adopt any connected pad (covers pads plugged in before page load).
  for (const p of pads) {
    if (p && p.connected) {
      padIndex = p.index;
      return p;
    }
  }
  return null;
}

// Poll the pad once per fixed update: edge-detect buttons into one-shot
// actions, and quantize stick tilts into nav presses with hold-to-repeat.
export function updateInput(dt) {
  const pad = activePad();
  if (!pad) return;

  for (let b = 0; b < pad.buttons.length; b++) {
    const down = pad.buttons[b].pressed;
    if (down && !padButtonsDown[b]) {
      method = "gamepad";
      for (const a of PAD_BUTTON_ACTIONS[b] || []) pressedActions.add(a);
    }
    padButtonsDown[b] = down;
  }

  const ax = pad.axes[0] || 0;
  const ay = pad.axes[1] || 0;
  if (Math.hypot(ax, ay) > cfg.gamepadDeadZone) method = "gamepad";

  const th = cfg.stickNavThreshold;
  const dir =
    Math.abs(ax) > Math.abs(ay)
      ? ax > th ? "navRight" : ax < -th ? "navLeft" : null
      : ay > th ? "navDown" : ay < -th ? "navUp" : null;
  if (dir !== stickNavDir) {
    stickNavDir = dir;
    if (dir) {
      pressedActions.add(dir);
      stickNavTimer = cfg.stickNavRepeatDelay;
    }
  } else if (dir) {
    stickNavTimer -= dt;
    if (stickNavTimer <= 0) {
      pressedActions.add(dir);
      stickNavTimer = cfg.stickNavRepeatRate;
    }
  }
}

// --- Public API --------------------------------------------------------------------

// Analog movement from all backends, magnitude clamped to 1.
export function moveVector() {
  let x = 0;
  let y = 0;

  // Keyboard (digital).
  if (heldKeys.has("KeyW") || heldKeys.has("ArrowUp")) y -= 1;
  if (heldKeys.has("KeyS") || heldKeys.has("ArrowDown")) y += 1;
  if (heldKeys.has("KeyA") || heldKeys.has("ArrowLeft")) x -= 1;
  if (heldKeys.has("KeyD") || heldKeys.has("ArrowRight")) x += 1;

  // Gamepad: analog stick (dead-zone rescaled so speed ramps smoothly from the
  // zone's edge) + digital d-pad.
  const pad = activePad();
  if (pad) {
    const dz = cfg.gamepadDeadZone;
    const ax = pad.axes[0] || 0;
    const ay = pad.axes[1] || 0;
    const m = Math.hypot(ax, ay);
    if (m > dz) {
      const scaled = Math.min(1, (m - dz) / (1 - dz));
      x += (ax / m) * scaled;
      y += (ay / m) * scaled;
    }
    if (pad.buttons[12]?.pressed) y -= 1;
    if (pad.buttons[13]?.pressed) y += 1;
    if (pad.buttons[14]?.pressed) x -= 1;
    if (pad.buttons[15]?.pressed) x += 1;
  }

  // Touch joystick (analog).
  if (joy.active) {
    x += joy.dx;
    y += joy.dy;
  }

  const mag = Math.hypot(x, y);
  if (mag > 1) {
    x /= mag;
    y /= mag;
  }
  return { x, y };
}

// One-shot action press this tick.
export function pressed(action) {
  return pressedActions.has(action);
}

export function endFrameInput() {
  pressedActions.clear();
  taps.length = 0; // unconsumed taps don't leak into later frames
}

export function inputMethod() {
  return method;
}

// One queued tap/click per call (screen-space CSS px), or null.
export function consumeTap() {
  return taps.shift() || null;
}

// main.js flips this on during PLAYING so lower-left touches steer instead of tap.
export function setTouchJoystickEnabled(v) {
  joystickEnabled = v;
  if (!v) releaseJoystick();
}

// For the HUD's joystick overlay.
export function joystickState() {
  return { ...joy, radius: cfg.touchJoystickRadius };
}

// True if a pad is currently connected (for hint UIs).
export function hasGamepad() {
  return activePad() !== null;
}

// Consume-once: the pad the player was using dropped.
export function padDisconnected() {
  const f = padDisconnectFlag;
  padDisconnectFlag = false;
  return f;
}

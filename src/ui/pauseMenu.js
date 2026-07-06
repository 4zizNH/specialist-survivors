// ui/pauseMenu.js
// The in-run pause menu (Resume / Restart / Settings / Quit) with a build panel
// (weapon levels + evolution hints + passives), and the settings panel (master
// volume + key-binding reference). Drawn over the dimmed, frozen world in
// SCREEN space; navigation lives in main.js.

import { PASSIVES } from "../data/passives.js";
import { evolutionFor, evolutionStatus } from "../systems/evolution.js";

export const PAUSE_OPTIONS = [
  { id: "resume", label: "Resume" },
  { id: "restart", label: "Restart Run" },
  { id: "settings", label: "Settings" },
  { id: "quit", label: "Quit to Hub" },
];

const KEY_REFERENCE = [
  ["Move", "WASD / Arrow keys"],
  ["Pause", "P / Esc"],
  ["Pick upgrade", "1 · 2 · 3"],
  ["Menus", "Arrows + Enter"],
  ["Equip / Unequip", "E / X"],
  ["Collection filters", "F (category) · R (rarity)"],
  ["Debug overlay", "F3"],
];

export function drawPauseMenu(ctx, view, selectedIndex, build) {
  const w = view.width;
  const h = view.height;

  dim(ctx, w, h);
  if (build) drawBuildPanel(ctx, h, build);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#e8e8f0";
  ctx.font = "700 48px system-ui, sans-serif";
  ctx.fillText("PAUSED", w / 2, h * 0.3);

  const optW = 300;
  const optH = 48;
  const gap = 14;
  let y = h * 0.42;
  for (let i = 0; i < PAUSE_OPTIONS.length; i++) {
    const selected = i === selectedIndex;
    const x = w / 2 - optW / 2;
    roundRect(ctx, x, y, optW, optH, 9);
    ctx.fillStyle = selected ? "rgba(40, 40, 58, 0.98)" : "rgba(18, 18, 26, 0.92)";
    ctx.fill();
    ctx.lineWidth = selected ? 2.5 : 1;
    ctx.strokeStyle = selected ? "#5ac8ff" : "rgba(255,255,255,0.12)";
    ctx.stroke();
    ctx.fillStyle = selected ? "#ffffff" : "#c0c0d0";
    ctx.font = "700 17px system-ui, sans-serif";
    ctx.fillText(PAUSE_OPTIONS[i].label, w / 2, y + optH / 2 + 1);
    y += optH + gap;
  }

  ctx.fillStyle = "#5a5a6c";
  ctx.font = "13px system-ui, sans-serif";
  ctx.fillText("↑ ↓ select      Enter confirm      P / Esc resume", w / 2, y + 18);
}

export function drawSettings(ctx, view, settings) {
  const w = view.width;
  const h = view.height;

  dim(ctx, w, h);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#e8e8f0";
  ctx.font = "700 40px system-ui, sans-serif";
  ctx.fillText("SETTINGS", w / 2, h * 0.22);

  // --- Master volume slider ---
  const vol = settings.masterVolume ?? 1;
  const sliderW = 320;
  const sx = w / 2 - sliderW / 2;
  const sy = h * 0.34;
  ctx.textAlign = "left";
  ctx.fillStyle = "#cfcfe0";
  ctx.font = "600 16px system-ui, sans-serif";
  ctx.fillText("Master Volume", sx, sy - 22);
  ctx.textAlign = "right";
  ctx.fillStyle = "#5ac8ff";
  ctx.font = "700 16px ui-monospace, monospace";
  ctx.fillText(`${Math.round(vol * 100)}%`, sx + sliderW, sy - 22);

  roundRect(ctx, sx, sy, sliderW, 10, 5);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fill();
  if (vol > 0) {
    roundRect(ctx, sx, sy, sliderW * vol, 10, 5);
    ctx.fillStyle = "#5ac8ff";
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(sx + sliderW * vol, sy + 5, 8, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  ctx.textAlign = "center";
  ctx.fillStyle = "#7a7a8c";
  ctx.font = "12px system-ui, sans-serif";
  ctx.fillText("← → adjust  (audio arrives in a later pass — saved to your profile)", w / 2, sy + 32);

  // --- Key-binding reference ---
  ctx.fillStyle = "#9a9ab0";
  ctx.font = "700 14px ui-monospace, monospace";
  ctx.fillText("— KEY BINDINGS —", w / 2, h * 0.47);

  let ky = h * 0.47 + 34;
  ctx.font = "14px ui-monospace, monospace";
  for (const [action, keys] of KEY_REFERENCE) {
    ctx.textAlign = "right";
    ctx.fillStyle = "#9a9ab0";
    ctx.fillText(action, w / 2 - 14, ky);
    ctx.textAlign = "left";
    ctx.fillStyle = "#e0e0ea";
    ctx.fillText(keys, w / 2 + 14, ky);
    ky += 26;
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "#5a5a6c";
  ctx.font = "13px system-ui, sans-serif";
  ctx.fillText("Esc back", w / 2, ky + 18);
}

// Left-side "current build" panel: each weapon's in-run level (MAX in gold, ★
// once evolved) plus its evolution recipe status, then the owned passives.
function drawBuildPanel(ctx, h, { weapons = [], passives = [] }) {
  const x = 24;
  const width = 300;
  const lineH = 18;
  // Height: header + 2 lines per weapon (evolvable ones) + passives block.
  let lines = 1;
  for (const inst of weapons) lines += evolutionFor(inst) || inst.evolved ? 2 : 1;
  lines += 1 + Math.max(1, passives.length ? 1 : 1);
  const height = 24 + lines * lineH + 16;
  const top = h / 2 - height / 2;

  roundRect(ctx, x, top, width, height, 10);
  ctx.fillStyle = "rgba(14, 14, 20, 0.92)";
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  let y = top + 28;
  ctx.fillStyle = "#9a9ab0";
  ctx.font = "700 12px ui-monospace, monospace";
  ctx.fillText("— CURRENT BUILD —", x + 16, y);
  y += lineH + 4;

  ctx.font = "13px ui-monospace, monospace";
  for (const inst of weapons) {
    ctx.fillStyle = "#e0e0ea";
    const lvl = inst.evolved
      ? "★ EVOLVED"
      : inst.level >= inst.maxLevel
        ? "Lv MAX"
        : `Lv ${inst.level}/${inst.maxLevel}`;
    ctx.fillText(inst.name, x + 16, y);
    ctx.textAlign = "right";
    ctx.fillStyle = inst.evolved || inst.level >= inst.maxLevel ? "#ffd34d" : "#9a9ab0";
    ctx.fillText(lvl, x + width - 16, y);
    ctx.textAlign = "left";
    y += lineH;

    const evo = evolutionFor(inst);
    if (evo) {
      const status = evolutionStatus(inst, passives);
      const pasName = PASSIVES[evo.requiresPassiveId]?.name ?? evo.requiresPassiveId;
      ctx.font = "11px ui-monospace, monospace";
      if (status === "ready") {
        ctx.fillStyle = "#ffd34d";
        ctx.fillText(`  ⚡ EVOLUTION READY — slay an elite!`, x + 16, y);
      } else {
        ctx.fillStyle = status === "needs-passive" ? "#8fb8ff" : "#5a5a6c";
        const need = status === "needs-passive" ? "" : " (max level first)";
        ctx.fillText(`  Evolves with: ${pasName}${need}`, x + 16, y);
      }
      ctx.font = "13px ui-monospace, monospace";
      y += lineH;
    } else if (inst.evolved) {
      ctx.font = "11px ui-monospace, monospace";
      ctx.fillStyle = "#ffd34d";
      ctx.fillText(`  Evolved form — fully awakened`, x + 16, y);
      ctx.font = "13px ui-monospace, monospace";
      y += lineH;
    }
  }

  y += 6;
  ctx.fillStyle = "#9a9ab0";
  ctx.font = "700 12px ui-monospace, monospace";
  ctx.fillText("PASSIVES", x + 16, y);
  y += lineH;
  ctx.font = "13px ui-monospace, monospace";
  if (passives.length === 0) {
    ctx.fillStyle = "#5a5a6c";
    ctx.fillText("none yet", x + 16, y);
  } else {
    let px = x + 16;
    for (const id of passives) {
      const def = PASSIVES[id];
      if (!def) continue;
      ctx.fillStyle = def.color;
      ctx.fillText(def.name, px, y);
      px += ctx.measureText(def.name).width + 14;
    }
  }
}

function dim(ctx, w, h) {
  ctx.fillStyle = "rgba(6, 6, 10, 0.72)";
  ctx.fillRect(0, 0, w, h);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

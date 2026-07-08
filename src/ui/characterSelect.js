// ui/characterSelect.js
// The hub's character-select screen (drawn in SCREEN space). Shows the roster
// as cards — portrait, name, specialization, persistent level + XP, and the
// resolved stats that will feed into the run. The selected card is highlighted.
//
// Achievement-gated characters render as a SILHOUETTE card: darkened portrait,
// a lock, and the exact unlock requirement with live progress — the
// requirement is never a mystery (hidden achievements don't gate characters).

import { resolveCharacterStats, characterXpToNext } from "../meta/progression.js";
import { SPECIALIZATIONS } from "../data/characters.js";
import { formatTime } from "./hud.js";
import { addRegion } from "../engine/hitRegions.js";
import { hintLine, isTouch, drawBackChip } from "./inputHints.js";
import { fitFont } from "./responsive.js";

// Cards are authored at this logical size and uniformly scaled down to fit
// narrow screens (phone portrait ⇒ 2 columns of shrunken cards).
const CARD_W = 230;
const CARD_H = 356;

export function drawCharacterSelect(ctx, view, { characters, progress, selectedIndex, unlockedIds, unlockInfo }) {
  const w = view.width;
  const h = view.height;
  const compact = w < 760;

  ctx.fillStyle = "#0a0a0f";
  ctx.fillRect(0, 0, w, h);

  // Title.
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#e8e8f0";
  // Fit within the width, leaving the top-left corner clear for the back chip.
  fitFont(ctx, "CHOOSE YOUR SPECIALIST", w - 120, compact ? 26 : 40, { minPx: 18 });
  ctx.fillText("CHOOSE YOUR SPECIALIST", w / 2, compact ? 54 : 84);
  ctx.fillStyle = "#7a7a8c";
  ctx.font = "15px system-ui, sans-serif";
  ctx.fillText(
    hintLine(
      "← →  select      Enter  start run      E  equip      Esc  hub",
      "◀ ▶  select      Ⓐ  start run      Ⓧ  equip      Ⓑ  hub",
      "tap to select · tap again to start"
    ),
    w / 2,
    compact ? 84 : 112
  );

  // Grid layout: scale the authored card down until rows and columns fit.
  const n = characters.length;
  const gap = compact ? 12 : 22;
  const cols = compact ? 2 : n <= 4 ? n : Math.ceil(n / 2);
  const rows = Math.ceil(n / cols);
  const y0 = compact ? 100 : 136;
  const bottomLimit = h - (isTouch() ? 126 : 30); // leave room for touch buttons
  const availW = (w - 32 - (cols - 1) * gap) / cols;
  const availH = (bottomLimit - y0 - (rows - 1) * gap) / rows;
  const s = Math.max(0.3, Math.min(1, availW / CARD_W, availH / CARD_H));
  const cardW = CARD_W * s;
  const cardH = CARD_H * s;
  const totalW = cols * cardW + (cols - 1) * gap;
  const totalH = rows * cardH + (rows - 1) * gap;
  const x0 = (w - totalW) / 2;
  const yTop = Math.max(y0, y0 + (bottomLimit - y0 - totalH) / 2);

  for (let i = 0; i < n; i++) {
    const def = characters[i];
    const prog = progress[def.id] || { level: 1, xp: 0 };
    const x = x0 + (i % cols) * (cardW + gap);
    const y = yTop + Math.floor(i / cols) * (cardH + gap);
    const locked = unlockedIds ? !unlockedIds.includes(def.id) : false;
    addRegion(`sel:${i}`, x, y, cardW, cardH);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    if (locked) {
      drawLockedCard(ctx, 0, 0, CARD_W, CARD_H, def, i === selectedIndex, unlockInfo?.[def.id]);
    } else {
      drawCard(ctx, 0, 0, CARD_W, CARD_H, def, prog, i === selectedIndex);
    }
    ctx.restore();
  }

  // Touch: explicit START / EQUIP buttons (44px+ targets).
  if (isTouch()) {
    const sel = characters[selectedIndex];
    const selUnlocked = !unlockedIds || unlockedIds.includes(sel?.id);
    drawFooterButton(ctx, w / 2 - 150, h - 108, 180, 48, selUnlocked ? "▶ START RUN" : "🔒 LOCKED", selUnlocked ? "#5fd66f" : "#5a5a6c", "start");
    drawFooterButton(ctx, w / 2 + 42, h - 108, 108, 48, "EQUIP", selUnlocked ? "#5ac8ff" : "#5a5a6c", "equip");
  }

  drawBackChip(ctx, view);
}

function drawFooterButton(ctx, x, y, w, h, label, color, regionId) {
  roundRect(ctx, x, y, w, h, 10);
  ctx.fillStyle = "rgba(20, 20, 30, 0.95)";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = "700 16px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + w / 2, y + h / 2 + 1);
  ctx.textBaseline = "alphabetic";
  addRegion(regionId, x - 4, y - 4, w + 8, h + 8);
}

// A gated specialist: silhouette + lock + the exact requirement and progress.
function drawLockedCard(ctx, x, y, cw, ch, def, selected, info) {
  roundRect(ctx, x, y, cw, ch, 12);
  ctx.fillStyle = selected ? "rgba(24, 24, 32, 0.98)" : "rgba(13, 13, 19, 0.9)";
  ctx.fill();
  ctx.lineWidth = selected ? 3 : 1.5;
  ctx.strokeStyle = selected ? "#7a7a8c" : "rgba(255,255,255,0.08)";
  ctx.stroke();

  const cx = x + cw / 2;

  // Silhouette portrait: near-black disc with a faint tint of their color.
  ctx.fillStyle = "#16161e";
  ctx.beginPath();
  ctx.arc(cx, y + 60, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = hexA(def.color, 0.25);
  ctx.stroke();
  ctx.fillStyle = "#2a2a36";
  ctx.font = "700 34px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(def.name[0], cx, y + 61);

  // Lock badge over the portrait.
  ctx.font = "20px system-ui, sans-serif";
  ctx.fillStyle = "#9a9ab0";
  ctx.fillText("🔒", cx + 26, y + 84);

  // Dimmed name + spec pill.
  ctx.fillStyle = "#6a6a7c";
  ctx.font = "700 19px system-ui, sans-serif";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(def.name, cx, y + 120);
  const spec = SPECIALIZATIONS[def.specialization] || { label: def.specialization, color: "#888" };
  ctx.font = "700 11px ui-monospace, monospace";
  const label = spec.label.toUpperCase();
  const pillW = ctx.measureText(label).width + 20;
  roundRect(ctx, cx - pillW / 2, y + 132, pillW, 20, 10);
  ctx.fillStyle = hexA(spec.color, 0.1);
  ctx.fill();
  ctx.fillStyle = hexA(spec.color, 0.5);
  ctx.textBaseline = "middle";
  ctx.fillText(label, cx, y + 143);

  // The exact unlock requirement (always visible).
  ctx.fillStyle = "#9a9ab0";
  ctx.font = "700 12px ui-monospace, monospace";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("— LOCKED —", cx, y + 186);
  if (info) {
    ctx.fillStyle = "#cfcfe0";
    ctx.font = "13px system-ui, sans-serif";
    let ty = y + 210;
    for (const line of wrap(ctx, info.def.desc, cw - 32)) {
      ctx.fillText(line, cx, ty);
      ty += 18;
    }
    // Progress bar + readout.
    const barW = cw - 56;
    const bx = x + 28;
    const by = ty + 10;
    roundRect(ctx, bx, by, barW, 6, 3);
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.fill();
    const frac = info.goal > 0 ? Math.min(1, info.cur / info.goal) : 0;
    if (frac > 0) {
      roundRect(ctx, bx, by, barW * frac, 6, 3);
      ctx.fillStyle = "#5ac8ff";
      ctx.fill();
    }
    ctx.fillStyle = "#5ac8ff";
    ctx.font = "700 12px ui-monospace, monospace";
    const readout =
      info.display === "time"
        ? `${formatTime(info.cur)} / ${formatTime(info.goal)}`
        : `${info.cur} / ${info.goal}`;
    ctx.fillText(readout, cx, by + 24);

    // Achievement name credit at the bottom.
    ctx.fillStyle = "#5a5a6c";
    ctx.font = "italic 11px system-ui, sans-serif";
    ctx.fillText(`Achievement: ${info.def.name}`, cx, y + ch - 18);
  }
  ctx.textAlign = "center";
}

function wrap(ctx, text, maxWidth) {
  const words = String(text).split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? line + " " + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawCard(ctx, x, y, cw, ch, def, prog, selected) {
  const spec = SPECIALIZATIONS[def.specialization] || { label: def.specialization, color: "#888" };
  const stats = resolveCharacterStats(def, prog.level);

  // Panel.
  roundRect(ctx, x, y, cw, ch, 12);
  ctx.fillStyle = selected ? "rgba(30, 30, 44, 0.98)" : "rgba(18, 18, 26, 0.9)";
  ctx.fill();
  ctx.lineWidth = selected ? 3 : 1.5;
  ctx.strokeStyle = selected ? def.color : "rgba(255,255,255,0.12)";
  ctx.stroke();

  const cx = x + cw / 2;

  // Portrait (placeholder: colored disc with the initial).
  ctx.fillStyle = def.color;
  ctx.beginPath();
  ctx.arc(cx, y + 60, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0a0a0f";
  ctx.font = "700 34px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(def.name[0], cx, y + 61);

  // Name.
  ctx.fillStyle = "#f0f0f6";
  ctx.font = "700 19px system-ui, sans-serif";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(def.name, cx, y + 120);

  // Specialization pill.
  ctx.font = "700 11px ui-monospace, monospace";
  const label = spec.label.toUpperCase();
  const pillW = ctx.measureText(label).width + 20;
  roundRect(ctx, cx - pillW / 2, y + 132, pillW, 20, 10);
  ctx.fillStyle = hexA(spec.color, 0.18);
  ctx.fill();
  ctx.fillStyle = spec.color;
  ctx.textBaseline = "middle";
  ctx.fillText(label, cx, y + 143);

  // Level + XP bar.
  ctx.fillStyle = "#e8e8f0";
  ctx.font = "700 15px ui-monospace, monospace";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`Level ${prog.level}`, cx, y + 180);
  const barW = cw - 40;
  const bx = x + 20;
  const by = y + 190;
  roundRect(ctx, bx, by, barW, 6, 3);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fill();
  const frac = Math.min(1, prog.xp / characterXpToNext(prog.level));
  if (frac > 0) {
    roundRect(ctx, bx, by, barW * frac, 6, 3);
    ctx.fillStyle = def.color;
    ctx.fill();
  }

  // Stats.
  const rows = [
    ["HP", Math.round(stats.maxHp)],
    ["Move", `${stats.moveSpeed.toFixed(2)}×`],
    ["Might", `${stats.might.toFixed(2)}×`],
    ["Pickup", `${stats.pickupRadius.toFixed(2)}×`],
    ["Cooldown", `${stats.cooldown.toFixed(2)}×`],
  ];
  ctx.font = "13px ui-monospace, monospace";
  let ry = y + 220;
  for (const [k, v] of rows) {
    ctx.textAlign = "left";
    ctx.fillStyle = "#9a9ab0";
    ctx.fillText(k, x + 18, ry);
    ctx.textAlign = "right";
    ctx.fillStyle = "#e0e0ea";
    ctx.fillText(String(v), x + cw - 18, ry);
    ry += 19;
  }

  // Passive — the character's identity line.
  if (def.passive) {
    ctx.textAlign = "left";
    ctx.fillStyle = def.color;
    ctx.font = "700 12px ui-monospace, monospace";
    ctx.fillText(`★ ${def.passive.name}`, x + 18, ry + 8);
    ctx.fillStyle = "#9a9ab0";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText(def.passive.desc, x + 18, ry + 24);
  }
  ctx.textAlign = "center";
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
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

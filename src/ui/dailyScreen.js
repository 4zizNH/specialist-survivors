// ui/dailyScreen.js
// The Daily Challenge hub screen: today's prescription (fixed character + tool
// + rarity), the "meta bonuses OFF" fairness notice, your attempt status, the
// action buttons, the local leaderboard (you + imported friends) with your
// rank, streak + personal best, a recent-history strip, and a UTC-rollover
// countdown. Navigation/activation live in main.js; dailyButtons() is shared
// with it so the button list can't drift.

import { CHARACTERS_BY_ID, SPECIALIZATIONS } from "../data/characters.js";
import { makeTool, resolveToolWeaponDef } from "../data/tools.js";
import { RARITIES } from "../data/rarities.js";
import { dailyFor, formatCountdown, msUntilNextUTCDay } from "../data/daily.js";
import {
  leaderboard,
  myRank,
  streak,
  personalBest,
  history,
  canPlayScored,
  myShareCode,
  getAttempt,
} from "../meta/daily.js";
import { addRegion } from "../engine/hitRegions.js";
import { hintLine } from "./inputHints.js";
import { fitFont } from "./responsive.js";

// Shared button model (main.js reads this for nav + activation).
export function dailyButtons(save, date) {
  const list = [];
  if (canPlayScored(save, date)) list.push({ id: "scored", label: "▶ Play Scored Attempt" });
  list.push({ id: "practice", label: "Practice Run  ·  no score, no rewards" });
  if (myShareCode(save, date)) list.push({ id: "copy", label: "Copy My Share Code" });
  list.push({ id: "import", label: "Import Friend Code" });
  list.push({ id: "back", label: "Back to Hub" });
  return list;
}

export function drawDaily(ctx, view, { save, selectedButton, message }) {
  const w = view.width;
  const h = view.height;
  const compact = w < 820;
  const d = dailyFor();
  const char = CHARACTERS_BY_ID[d.characterId];
  const spec = SPECIALIZATIONS[char.specialization] || { label: char.specialization, color: "#888" };
  const rar = RARITIES[d.rarity] || RARITIES.common;
  const tool = resolveToolWeaponDef(makeTool(d.baseId, d.rarity));
  const attempt = getAttempt(save, d.date);

  ctx.fillStyle = "#0a0a0f";
  ctx.fillRect(0, 0, w, h);

  // Title + date + countdown.
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#e8e8f0";
  ctx.font = "700 32px system-ui, sans-serif";
  ctx.fillText("DAILY CHALLENGE", w / 2, 48);
  ctx.fillStyle = "#9a9ab0";
  ctx.font = "14px ui-monospace, monospace";
  ctx.fillText(`${d.date} (UTC)   ·   next in ${formatCountdown(msUntilNextUTCDay())}`, w / 2, 72);

  // --- Prescription band ---
  const px = Math.max(16, w / 2 - 380);
  const pw = Math.min(760, w - (compact ? 32 : 48));
  const py = 90;
  const ph = 92;
  roundRect(ctx, px, py, pw, ph, 12);
  ctx.fillStyle = "rgba(18, 18, 28, 0.95)";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = rar.color;
  ctx.stroke();

  // Character portrait.
  const portR = compact ? 26 : 30;
  const portX = px + portR + 16;
  ctx.fillStyle = char.color;
  ctx.beginPath();
  ctx.arc(portX, py + ph / 2, portR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0a0a0f";
  ctx.font = `700 ${compact ? 24 : 28}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(char.name[0], portX, py + ph / 2 + 1);

  // Prescription text — three stacked lines that fit the remaining width.
  const tx = portX + portR + 14;
  const availW = px + pw - tx - (compact ? 14 : 190); // wide: leave room for the notice
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#f0f0f6";
  ctx.font = "700 19px system-ui, sans-serif";
  ctx.fillText(`Today: ${char.name}`, tx, py + 30);
  ctx.fillStyle = rar.color;
  fitFont(ctx, `${rar.label.toUpperCase()} ${tool.name}`, availW, 14, { minPx: 11, weight: "700", family: "ui-monospace, monospace" });
  ctx.fillText(`${rar.label.toUpperCase()} ${tool.name}`, tx, py + 54);
  ctx.fillStyle = "#9a9ab0";
  const statLine = `${spec.label.toUpperCase()} · DMG ${tool.damage} · CD ${tool.cooldown}s · AR ${tool.area}`;
  fitFont(ctx, statLine, availW, 12, { minPx: 10, weight: "400", family: "ui-monospace, monospace" });
  ctx.fillText(statLine, tx, py + 76);

  let flow = py + ph; // running y below the band

  // Fairness notice: inside the band (right) on wide screens; a full line below
  // the band on narrow ones so nothing overlaps.
  if (compact) {
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffb03a";
    fitFont(ctx, "⚖ Fair run — everyone is Level 1 (no meta bonuses today)", w - 24, 12, {
      minPx: 10,
      weight: "700",
      family: "system-ui, sans-serif",
    });
    ctx.fillText("⚖ Fair run — everyone is Level 1 (no meta bonuses today)", w / 2, flow + 22);
    flow += 34;
  } else {
    ctx.textAlign = "right";
    ctx.fillStyle = "#ffb03a";
    ctx.font = "700 12px ui-monospace, monospace";
    ctx.fillText("⚖ FAIR RUN", px + pw - 18, py + 30);
    ctx.fillStyle = "#9a9ab0";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText("Everyone is Level 1 — character levels", px + pw - 18, py + 50);
    ctx.fillText("& shop upgrades are disabled today.", px + pw - 18, py + 66);
  }

  // Attempt status line.
  ctx.textAlign = "center";
  ctx.font = "600 14px system-ui, sans-serif";
  const statusY = flow + 24;
  if (attempt && attempt.status === "done") {
    ctx.fillStyle = "#5fd66f";
    ctx.fillText(`Your score today: ${attempt.score.toLocaleString()}`, w / 2, statusY);
  } else if (attempt && attempt.status === "dnf") {
    ctx.fillStyle = "#c85a5a";
    ctx.fillText("Scored attempt spent (did not finish). Practice is still open.", w / 2, statusY);
  } else {
    ctx.fillStyle = "#7ad0ff";
    ctx.fillText("Not attempted yet — one scored run today.", w / 2, statusY);
  }

  // --- Two columns: buttons (left) + leaderboard (right) ---
  const colTop = statusY + 24;
  const leftX = compact ? w / 2 - Math.min(360, w - 48) / 2 : px;
  const colW = compact ? Math.min(360, w - 48) : (pw - 24) / 2;
  const buttons = dailyButtons(save, d.date);

  // Buttons — a touch shorter on compact screens so the leaderboard below fits.
  const bh = compact ? 42 : 46;
  const bgap = compact ? 8 : 10;
  let by = colTop;
  for (let i = 0; i < buttons.length; i++) {
    const b = buttons[i];
    const selected = i === selectedButton;
    addRegion(`sel:${i}`, leftX, by, colW, bh);
    roundRect(ctx, leftX, by, colW, bh, 9);
    ctx.fillStyle = selected ? "rgba(40, 40, 58, 0.98)" : "rgba(18, 18, 26, 0.92)";
    ctx.fill();
    ctx.lineWidth = selected ? 2.5 : 1;
    ctx.strokeStyle = selected ? "#5ac8ff" : "rgba(255,255,255,0.12)";
    ctx.stroke();
    ctx.fillStyle =
      b.id === "scored" ? "#5fd66f" : b.id === "back" ? "#c0c0d0" : selected ? "#ffffff" : "#c0c0d0";
    ctx.font = "700 15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(b.label, leftX + colW / 2, by + bh / 2 + 1);
    by += bh + bgap;
  }

  // Feedback message (copy/import).
  if (message) {
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = message.ok ? "#5fd66f" : "#ff7a6a";
    ctx.font = "600 13px system-ui, sans-serif";
    ctx.fillText(message.text, leftX + colW / 2, by + 8);
  }

  // Leaderboard column.
  const rightX = compact ? leftX : px + pw / 2 + 12;
  const rightTop = compact ? by + 18 : colTop;
  drawLeaderboard(ctx, save, d.date, rightX, rightTop, colW);

  // Controls.
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#5a5a6c";
  ctx.font = "13px system-ui, sans-serif";
  ctx.fillText(
    hintLine("↑ ↓ select   Enter confirm   Esc back", "▲ ▼ select   Ⓐ confirm   Ⓑ back", "tap a button"),
    w / 2,
    h - 14
  );
  // No top-left back chip here — the daily screen has an explicit "Back to Hub"
  // button, and a chip would collide with the wide centered title.
}

function drawLeaderboard(ctx, save, date, x, y, w) {
  const board = leaderboard(save, date);
  const rank = myRank(save, date);
  const st = streak(save);
  const best = personalBest(save);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#9a9ab0";
  ctx.font = "700 13px ui-monospace, monospace";
  ctx.fillText("— TODAY'S BOARD —", x, y);

  let ry = y + 26;
  if (board.length === 0) {
    ctx.fillStyle = "#5a5a6c";
    ctx.font = "13px system-ui, sans-serif";
    ctx.fillText("No scores yet. Play, or import a friend's code.", x, ry);
    ry += 22;
  } else {
    ctx.font = "13px ui-monospace, monospace";
    board.slice(0, 6).forEach((e, i) => {
      ctx.fillStyle = e.you ? "#ffd34d" : "#cfcfe0";
      ctx.textAlign = "left";
      ctx.fillText(`${i + 1}. ${e.name}${e.imported ? " (imported)" : ""}`, x, ry);
      ctx.textAlign = "right";
      ctx.fillText(e.score.toLocaleString(), x + w, ry);
      ry += 20;
    });
  }

  // Rank + streak + best.
  ry += 10;
  ctx.textAlign = "left";
  ctx.font = "600 13px system-ui, sans-serif";
  ctx.fillStyle = "#e0e0ea";
  if (rank) ctx.fillText(`Your rank: #${rank.rank} of ${rank.of}`, x, ry);
  ry += 20;
  ctx.fillStyle = "#7ad0ff";
  ctx.fillText(`🔥 Streak: ${st} day${st === 1 ? "" : "s"}`, x, ry);
  ctx.textAlign = "right";
  ctx.fillStyle = "#ffd34d";
  ctx.fillText(`Best: ${best.toLocaleString()}`, x + w, ry);

  // History strip.
  ry += 30;
  ctx.textAlign = "left";
  ctx.fillStyle = "#9a9ab0";
  ctx.font = "700 12px ui-monospace, monospace";
  ctx.fillText("— RECENT —", x, ry);
  ry += 20;
  ctx.font = "12px ui-monospace, monospace";
  const hist = history(save, 5);
  if (hist.length === 0) {
    ctx.fillStyle = "#5a5a6c";
    ctx.fillText("no past dailies yet", x, ry);
  } else {
    for (const hrow of hist) {
      ctx.fillStyle = "#9a9ab0";
      ctx.textAlign = "left";
      ctx.fillText(hrow.date, x, ry);
      ctx.textAlign = "right";
      ctx.fillStyle = hrow.status === "done" ? "#cfcfe0" : "#c85a5a";
      ctx.fillText(hrow.status === "done" ? hrow.score.toLocaleString() : "DNF", x + w, ry);
      ry += 18;
    }
  }
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

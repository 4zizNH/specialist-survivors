// ui/gameoverScreen.js
// The end-of-run reward screen: run stats, character XP progress, gold earned,
// the tool-drop reveal (rarity-colored card, or "no drop"), plus any
// achievements earned this run — with a prominent reveal + "press C" shortcut
// when one of them unlocked a new playable character. Drawn in SCREEN space.

import { formatTime } from "./hud.js";
import { drawToolCard } from "./toolCard.js";
import { RARITIES } from "../data/rarities.js";
import { rewardText } from "../meta/achievements.js";
import { addRegion } from "../engine/hitRegions.js";
import { hintLine } from "./inputHints.js";
import { clamp } from "./responsive.js";

// This screen's layout is authored for a ~700px-wide canvas. On narrower
// phones we scale the whole thing down ("zoom out") instead of reflowing it,
// so every stat/label stays inside its box instead of clipping at the edges.
// `w`/`h` below are the resulting virtual (pre-scale) canvas size — the
// existing layout math is unchanged, addRegion() calls just need their
// rects converted back to real screen space via `scale`.
export function drawGameOver(ctx, view, results) {
  const scale = clamp(view.width / 700, 0.62, 1);
  const w = view.width / scale;
  const h = view.height / scale;
  const daily = results.daily || null;

  ctx.save();
  ctx.scale(scale, scale);

  ctx.fillStyle = "#0a0a0f";
  ctx.fillRect(0, 0, w, h);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillStyle = daily ? (daily.practice ? "#7ad0ff" : "#ffd34d") : "#ff5a5a";
  ctx.font = "700 58px system-ui, sans-serif";
  ctx.fillText(daily ? (daily.practice ? "PRACTICE OVER" : "DAILY COMPLETE") : "RUN OVER", w / 2, 96);

  // --- Run stats row ---
  const stats = [
    ["Time", formatTime(results.time)],
    ["Level", String(results.level)],
    ["Kills", String(results.kills)],
    ["Bosses", String(results.bossKills ?? 0)],
  ];
  const colW = 130;
  let sx = w / 2 - ((stats.length - 1) * colW) / 2;
  for (const [label, value] of stats) {
    ctx.fillStyle = "#7a7a8c";
    ctx.font = "600 13px ui-monospace, monospace";
    ctx.fillText(label.toUpperCase(), sx, 148);
    ctx.fillStyle = "#f0f0f6";
    ctx.font = "700 26px ui-monospace, monospace";
    ctx.fillText(value, sx, 178);
    sx += colW;
  }

  const panelW = Math.min(560, w - 80);
  const panelX = w / 2 - panelW / 2;
  const panelY = 220;

  // Daily runs replace the rewards panel with a score breakdown (scored) or a
  // simple practice note; normal runs show the rewards panel below.
  if (daily) {
    drawDailyResult(ctx, view, daily, panelX, panelY, panelW, scale);
    ctx.textAlign = "center";
    ctx.fillStyle = "#7a7a8c";
    ctx.font = "16px system-ui, sans-serif";
    ctx.fillText(
      hintLine("Press Enter to return to the hub", "Press Ⓐ to return to the hub", "Tap to return to the hub"),
      w / 2,
      h - 30
    );
    addRegion("continue", 0, (h - 64) * scale, w * scale, 64 * scale);
    ctx.restore();
    return;
  }

  // --- Rewards panel ---
  const panelH = 300;
  roundRect(ctx, panelX, panelY, panelW, panelH, 14);
  ctx.fillStyle = "rgba(18, 18, 28, 0.95)";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.stroke();

  ctx.fillStyle = "#ffd34d";
  ctx.font = "700 18px system-ui, sans-serif";
  ctx.fillText("— REWARDS —", w / 2, panelY + 30);

  // Character XP.
  const c = results.character;
  let ry = panelY + 66;
  if (c) {
    ctx.fillStyle = "#7ad0ff";
    ctx.font = "600 17px ui-monospace, monospace";
    const text = c.leveledUp
      ? `${c.name}  Lv ${c.levelBefore} → ${c.levelAfter}   (+${c.gained} XP)`
      : `${c.name}  +${c.gained} XP`;
    ctx.fillText(text, w / 2, ry);
    if (c.leveledUp) {
      ctx.fillStyle = "#ffd34d";
      ctx.font = "700 13px system-ui, sans-serif";
      ctx.fillText("CHARACTER LEVEL UP!", w / 2, ry + 22);
      ry += 22;
    }
    ry += 34;
  }

  // Gold.
  ctx.fillStyle = "#ffd34d";
  ctx.font = "600 17px ui-monospace, monospace";
  ctx.fillText(`+${results.gold ?? 0} gold`, w / 2, ry);
  ry += 36;

  // Tool drop reveal.
  if (results.droppedTool) {
    const rar = RARITIES[results.droppedTool.rarity];
    ctx.fillStyle = rar.color;
    ctx.font = "700 14px system-ui, sans-serif";
    ctx.fillText(`NEW TOOL DROP — ${rar.label.toUpperCase()}!`, w / 2, ry);
    const cardW = 250;
    const cardH = 96;
    drawToolCard(ctx, w / 2 - cardW / 2, ry + 14, cardW, cardH, results.droppedTool, {
      selected: true,
    });
  } else {
    ctx.fillStyle = "#5a5a6c";
    ctx.font = "italic 14px system-ui, sans-serif";
    ctx.fillText("No tool dropped this run — survive longer for better odds.", w / 2, ry);
  }

  // --- Achievements earned this run ---
  let ay = panelY + panelH + 26;
  const earned = results.achievements || [];
  // Non-character achievements as compact gold lines (character unlocks get
  // the big banner below instead).
  for (const def of earned.filter((d) => !d.reward?.characterId).slice(0, 3)) {
    ctx.fillStyle = "#ffd34d";
    ctx.font = "700 14px system-ui, sans-serif";
    const extra = rewardText(def);
    ctx.fillText(`🏆 ACHIEVEMENT — ${def.name}${extra ? `  (${extra})` : ""}`, w / 2, ay);
    ay += 24;
  }

  // --- New-character reveal (the headline moment) ---
  const nc = results.unlockedCharacter;
  if (nc) {
    const bw = Math.min(560, w - 80);
    const bx = w / 2 - bw / 2;
    const bh = 86;
    ay += 6;
    roundRect(ctx, bx, ay, bw, bh, 12);
    ctx.fillStyle = "rgba(34, 28, 12, 0.96)";
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#ffd34d";
    ctx.stroke();

    // Portrait disc.
    ctx.fillStyle = nc.color;
    ctx.beginPath();
    ctx.arc(bx + 46, ay + bh / 2, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0a0a0f";
    ctx.font = "700 28px system-ui, sans-serif";
    ctx.fillText(nc.name[0], bx + 46, ay + bh / 2 + 1);

    ctx.textAlign = "left";
    ctx.fillStyle = "#ffd34d";
    ctx.font = "700 17px system-ui, sans-serif";
    ctx.fillText(`NEW SPECIALIST UNLOCKED — ${nc.name}!`, bx + 88, ay + 32);
    ctx.fillStyle = "#c0c0d0";
    ctx.font = "13px system-ui, sans-serif";
    ctx.fillText(nc.blurb || "", bx + 88, ay + 52);
    ctx.fillStyle = "#5ac8ff";
    ctx.font = "700 13px ui-monospace, monospace";
    ctx.fillText(
      hintLine("Press C to try them now", "Press Ⓨ to try them now", "Tap here to try them now"),
      bx + 88,
      ay + 71
    );
    ctx.textAlign = "center";
    addRegion("tryChar", bx * scale, ay * scale, bw * scale, bh * scale); // the whole banner is the target
    ay += bh + 10;
  }

  ctx.fillStyle = "#7a7a8c";
  ctx.font = "16px system-ui, sans-serif";
  ctx.fillText(
    hintLine("Press Enter to return to the hub", "Press Ⓐ to return to the hub", "Tap to return to the hub"),
    w / 2,
    h - 30
  );
  // Touch: the bottom strip returns to the hub (doesn't overlap the banner).
  addRegion("continue", 0, (h - 64) * scale, w * scale, 64 * scale);
  ctx.restore();
}

// Daily results: a transparent score breakdown + local rank + share code
// (scored), or a plain note (practice).
function drawDailyResult(ctx, view, daily, x, y, w, scale) {
  const h = daily.practice ? 120 : 300;
  roundRect(ctx, x, y, w, h, 14);
  ctx.fillStyle = "rgba(18, 18, 28, 0.95)";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = daily.practice ? "rgba(122,208,255,0.4)" : "rgba(255,211,77,0.5)";
  ctx.stroke();

  if (daily.practice) {
    ctx.textAlign = "center";
    ctx.fillStyle = "#7ad0ff";
    ctx.font = "700 18px system-ui, sans-serif";
    ctx.fillText("PRACTICE RUN", x + w / 2, y + 40);
    ctx.fillStyle = "#9a9ab0";
    ctx.font = "14px system-ui, sans-serif";
    ctx.fillText("Not scored · no rewards — your scored attempt is untouched.", x + w / 2, y + 74);
    return;
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffd34d";
  ctx.font = "700 18px system-ui, sans-serif";
  ctx.fillText("— DAILY SCORE —", x + w / 2, y + 30);

  // Breakdown rows.
  const p = daily.parts || { time: 0, kills: 0, level: 0, boss: 0 };
  const rows = [
    ["Time survived", p.time],
    ["Kills", p.kills],
    ["Level reached", p.level],
    ["Bosses slain", p.boss],
  ];
  let ry = y + 66;
  ctx.font = "15px ui-monospace, monospace";
  for (const [label, pts] of rows) {
    ctx.textAlign = "left";
    ctx.fillStyle = "#9a9ab0";
    ctx.fillText(label, x + 30, ry);
    ctx.textAlign = "right";
    ctx.fillStyle = "#e0e0ea";
    ctx.fillText(`+${pts.toLocaleString()}`, x + w - 30, ry);
    ry += 26;
  }
  // Total.
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.beginPath();
  ctx.moveTo(x + 30, ry - 8);
  ctx.lineTo(x + w - 30, ry - 8);
  ctx.stroke();
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffd34d";
  ctx.font = "700 20px system-ui, sans-serif";
  ctx.fillText("TOTAL", x + 30, ry + 16);
  ctx.textAlign = "right";
  ctx.font = "700 24px ui-monospace, monospace";
  ctx.fillText(daily.total.toLocaleString(), x + w - 30, ry + 16);
  ry += 42;

  // Rank.
  ctx.textAlign = "center";
  ctx.font = "600 14px system-ui, sans-serif";
  ctx.fillStyle = "#7ad0ff";
  ctx.fillText(
    daily.rank ? `Local rank today: #${daily.rank.rank} of ${daily.rank.of}` : "Posted to today's local board",
    x + w / 2,
    ry
  );
  ry += 26;

  // Share code + copy button.
  ctx.fillStyle = "#7a7a8c";
  ctx.font = "12px ui-monospace, monospace";
  ctx.fillText(daily.code, x + w / 2, ry);
  const bw = 150;
  const bx = x + w / 2 - bw / 2;
  const byy = ry + 12;
  roundRect(ctx, bx, byy, bw, 30, 8);
  ctx.fillStyle = "rgba(90,200,255,0.15)";
  ctx.fill();
  ctx.strokeStyle = "#5ac8ff";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = "#5ac8ff";
  ctx.font = "700 13px system-ui, sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText("Copy Share Code", x + w / 2, byy + 16);
  ctx.textBaseline = "middle";
  addRegion("copyDaily", (bx - 4) * scale, (byy - 4) * scale, (bw + 8) * scale, 38 * scale);
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

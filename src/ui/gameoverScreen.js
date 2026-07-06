// ui/gameoverScreen.js
// The end-of-run reward screen: run stats, character XP progress, gold earned,
// the tool-drop reveal (rarity-colored card, or "no drop"), plus any
// achievements earned this run — with a prominent reveal + "press C" shortcut
// when one of them unlocked a new playable character. Drawn in SCREEN space.

import { formatTime } from "./hud.js";
import { drawToolCard } from "./toolCard.js";
import { RARITIES } from "../data/rarities.js";
import { rewardText } from "../meta/achievements.js";

export function drawGameOver(ctx, view, results) {
  const w = view.width;
  const h = view.height;

  ctx.fillStyle = "#0a0a0f";
  ctx.fillRect(0, 0, w, h);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillStyle = "#ff5a5a";
  ctx.font = "700 58px system-ui, sans-serif";
  ctx.fillText("RUN OVER", w / 2, 96);

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

  // --- Rewards panel ---
  const panelW = Math.min(560, w - 80);
  const panelX = w / 2 - panelW / 2;
  const panelY = 220;
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
    ctx.fillText("Press C to try them now", bx + 88, ay + 71);
    ctx.textAlign = "center";
    ay += bh + 10;
  }

  ctx.fillStyle = "#7a7a8c";
  ctx.font = "16px system-ui, sans-serif";
  ctx.fillText("Press Enter to return to the hub", w / 2, h - 30);
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

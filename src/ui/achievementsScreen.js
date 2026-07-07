// ui/achievementsScreen.js
// The hub's Achievements screen: in-progress achievements first (with progress
// bars), completed ones after (with their rewards). Hidden achievements render
// as "???" until earned. ↑/↓ scrolls when the list overflows.

import { formatTime } from "./hud.js";
import {
  ACHIEVEMENTS,
  statsView,
  isAchievementUnlocked,
  rewardText,
} from "../meta/achievements.js";
import { addRegion } from "../engine/hitRegions.js";
import { hintLine, drawBackChip, isTouch } from "./inputHints.js";

const ROW_H = 62;
const ROW_GAP = 10;

// Ordered rows: headers + in-progress + completed. Exported so main.js can
// clamp the scroll offset.
export function achievementRows(save) {
  const view = statsView(save);
  const inProgress = [];
  const completed = [];
  for (const def of ACHIEVEMENTS) {
    const done = isAchievementUnlocked(save, def.id);
    const { cur, goal } = def.progress(view);
    (done ? completed : inProgress).push({ def, done, cur, goal });
  }
  const rows = [];
  rows.push({ header: `IN PROGRESS — ${inProgress.length}` });
  rows.push(...inProgress);
  rows.push({ header: `COMPLETED — ${completed.length} / ${ACHIEVEMENTS.length}` });
  rows.push(...completed);
  return rows;
}

export function drawAchievements(ctx, view, { save, scroll }) {
  const w = view.width;
  const h = view.height;

  ctx.fillStyle = "#0a0a0f";
  ctx.fillRect(0, 0, w, h);

  // Title + earned-titles line.
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#e8e8f0";
  ctx.font = "700 34px system-ui, sans-serif";
  ctx.fillText("ACHIEVEMENTS", w / 2, 58);
  if (save.titles?.length) {
    ctx.fillStyle = "#ffd34d";
    ctx.font = "13px ui-monospace, monospace";
    ctx.fillText(`Titles earned: ${save.titles.join(" · ")}`, w / 2, 84);
  }

  const rows = achievementRows(save);
  const top = 104;
  const bottom = h - 40;
  const x = Math.max(16, w / 2 - 380);
  const width = Math.min(760, w - 32);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, top - 6, w, bottom - top + 12);
  ctx.clip();

  let y = top - scroll * (ROW_H + ROW_GAP);
  for (const row of rows) {
    if (y > bottom) break;
    if (row.header) {
      if (y + 20 > top) {
        ctx.textAlign = "left";
        ctx.fillStyle = "#7a7a8c";
        ctx.font = "700 13px ui-monospace, monospace";
        ctx.fillText(`— ${row.header} —`, x, y + 24);
      }
      y += 38;
      continue;
    }
    if (y + ROW_H > top) drawRow(ctx, x, y, width, row);
    y += ROW_H + ROW_GAP;
  }
  ctx.restore();

  // Overflow hint.
  ctx.textAlign = "center";
  ctx.fillStyle = "#5a5a6c";
  ctx.font = "13px system-ui, sans-serif";
  ctx.fillText(
    hintLine("↑ ↓ scroll      Esc back", "▲ ▼ scroll      Ⓑ back", "▲ ▼ to scroll"),
    w / 2,
    h - 16
  );
  drawBackChip(ctx, view);

  // Touch: chevron scroll buttons (right edge, 44px+).
  if (isTouch()) {
    scrollChevron(ctx, w - 56, h / 2 - 60, "▲", "scrollUp");
    scrollChevron(ctx, w - 56, h / 2 + 12, "▼", "scrollDown");
  }
}

function scrollChevron(ctx, x, y, glyph, regionId) {
  ctx.beginPath();
  ctx.arc(x + 22, y + 22, 22, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(24, 24, 34, 0.9)";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.stroke();
  ctx.fillStyle = "#cfcfe0";
  ctx.font = "700 17px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(glyph, x + 22, y + 23);
  addRegion(regionId, x - 4, y - 4, 52, 52);
}

function drawRow(ctx, x, y, w, { def, done, cur, goal }) {
  const secret = def.hidden && !done;
  const accent = done ? "#ffd34d" : secret ? "#3a3a4a" : "#5ac8ff";

  roundRect(ctx, x, y, w, ROW_H, 9);
  ctx.fillStyle = done ? "rgba(34, 30, 16, 0.92)" : "rgba(18, 18, 26, 0.92)";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = done ? "rgba(255, 211, 77, 0.5)" : "rgba(255,255,255,0.1)";
  ctx.stroke();

  // Status glyph.
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "20px system-ui, sans-serif";
  ctx.fillStyle = accent;
  ctx.fillText(done ? "🏆" : secret ? "?" : "◈", x + 28, y + ROW_H / 2 + 1);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  if (secret) {
    ctx.fillStyle = "#7a7a8c";
    ctx.font = "700 15px system-ui, sans-serif";
    ctx.fillText("???", x + 52, y + 26);
    ctx.fillStyle = "#5a5a6c";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText("Hidden achievement — keep playing to reveal it.", x + 52, y + 45);
    return;
  }

  // Name + description.
  ctx.fillStyle = done ? "#ffd34d" : "#f0f0f6";
  ctx.font = "700 15px system-ui, sans-serif";
  ctx.fillText(def.name, x + 52, y + 26);
  ctx.fillStyle = "#9a9ab0";
  ctx.font = "12px system-ui, sans-serif";
  ctx.fillText(def.desc, x + 52, y + 45);

  // Right side: reward + progress.
  ctx.textAlign = "right";
  const reward = rewardText(def);
  if (reward) {
    ctx.fillStyle = done ? "#c8a838" : "#7a7a8c";
    ctx.font = "11px ui-monospace, monospace";
    ctx.fillText(reward, x + w - 16, y + 45);
  }
  if (done) {
    ctx.fillStyle = "#ffd34d";
    ctx.font = "700 12px ui-monospace, monospace";
    ctx.fillText("COMPLETE", x + w - 16, y + 24);
  } else {
    // Progress readout + bar.
    const label =
      def.display === "time" ? `${formatTime(cur)} / ${formatTime(goal)}` : `${cur} / ${goal}`;
    ctx.fillStyle = "#cfcfe0";
    ctx.font = "700 12px ui-monospace, monospace";
    ctx.fillText(label, x + w - 16, y + 20);
    const barW = 150;
    const bx = x + w - 16 - barW;
    roundRect(ctx, bx, y + 26, barW, 5, 2.5);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fill();
    const frac = goal > 0 ? Math.min(1, cur / goal) : 0;
    if (frac > 0) {
      roundRect(ctx, bx, y + 26, barW * frac, 5, 2.5);
      ctx.fillStyle = accent;
      ctx.fill();
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

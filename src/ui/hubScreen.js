// ui/hubScreen.js
// The main-menu hub: title, gold + profile summary, and the destinations.
// Drawn in SCREEN space; navigation in main.js. Rows register tap regions
// ("sel:N") and the footer hint adapts to the active input device.

import { addRegion } from "../engine/hitRegions.js";
import { hintLine } from "./inputHints.js";

export const HUB_OPTIONS = [
  { id: "play", label: "PLAY", desc: "Pick a specialist, equip a tool, enter the arena" },
  { id: "daily", label: "DAILY CHALLENGE", desc: "Today's fixed seeded run + local leaderboard" },
  { id: "shop", label: "SHOP", desc: "Spend gold on permanent account-wide upgrades" },
  { id: "fusion", label: "FUSION", desc: "Combine duplicate tools into higher rarities" },
  { id: "collection", label: "COLLECTION", desc: "Browse your tools by category and rarity" },
  { id: "achievements", label: "ACHIEVEMENTS", desc: "Milestones, rewards, and locked specialists" },
  { id: "roster", label: "ROSTER", desc: "Review your specialists and their levels" },
  { id: "reset", label: "RESET PROGRESS", desc: "Wipe the profile and start fresh (asks first)" },
];

// `dailyStatus` (string) overrides the DAILY row's desc with today's live
// prescription + attempt status, so the hub doubles as the daily card.
export function drawHub(ctx, view, { save, selectedIndex, dailyStatus }) {
  const w = view.width;
  const h = view.height;

  ctx.fillStyle = "#0a0a0f";
  ctx.fillRect(0, 0, w, h);

  // Title.
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#e8e8f0";
  ctx.font = "700 54px system-ui, sans-serif";
  ctx.fillText("SPECIALIST SURVIVORS", w / 2, h * 0.2);
  ctx.fillStyle = "#7a7a8c";
  ctx.font = "15px system-ui, sans-serif";
  ctx.fillText("A roguelite of specialists and their tools", w / 2, h * 0.2 + 40);

  // Profile summary (+ latest cosmetic title, if any achievement granted one).
  const gold = save.currency?.gold ?? 0;
  const tools = save.inventory?.length ?? 0;
  const runs = save.meta?.totalRuns ?? 0;
  const best = save.meta?.bestTimeSec ?? 0;
  ctx.fillStyle = "#ffd34d";
  ctx.font = "600 16px ui-monospace, monospace";
  ctx.fillText(
    `◆ ${gold} gold      ${tools} tools      ${runs} runs      best ${Math.floor(best / 60)}:${String(Math.floor(best % 60)).padStart(2, "0")}`,
    w / 2,
    h * 0.2 + 78
  );
  const title = save.titles?.length ? save.titles[save.titles.length - 1] : null;
  if (title) {
    ctx.fillStyle = "#b06bff";
    ctx.font = "italic 600 14px system-ui, sans-serif";
    ctx.fillText(`“${title}”`, w / 2, h * 0.2 + 102);
  }

  // Menu options (sized so the 8 rows fit above the footer hint, and never
  // wider than a phone viewport).
  const optW = Math.min(420, w - 32);
  const optH = 48;
  const gap = 9;
  let y = h * 0.34;
  for (let i = 0; i < HUB_OPTIONS.length; i++) {
    const opt = HUB_OPTIONS[i];
    const selected = i === selectedIndex;
    const x = w / 2 - optW / 2;
    addRegion(`sel:${i}`, x, y, optW, optH);

    roundRect(ctx, x, y, optW, optH, 10);
    ctx.fillStyle = selected ? "rgba(40, 40, 58, 0.98)" : "rgba(18, 18, 26, 0.9)";
    ctx.fill();
    ctx.lineWidth = selected ? 2.5 : 1;
    ctx.strokeStyle = selected ? "#5ac8ff" : opt.id === "daily" ? "rgba(255, 211, 77, 0.4)" : "rgba(255,255,255,0.12)";
    ctx.stroke();

    const danger = opt.id === "reset";
    ctx.textAlign = "left";
    ctx.fillStyle = danger ? (selected ? "#ff8a7a" : "#a05a5a") : opt.id === "daily" ? "#ffd34d" : selected ? "#ffffff" : "#c0c0d0";
    ctx.font = "700 17px system-ui, sans-serif";
    ctx.fillText(opt.label, x + 22, y + 19);
    ctx.fillStyle = "#7a7a8c";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(opt.id === "daily" && dailyStatus ? dailyStatus : opt.desc, x + 22, y + 36);

    if (selected) {
      ctx.textAlign = "right";
      ctx.fillStyle = "#5ac8ff";
      ctx.font = "700 22px system-ui, sans-serif";
      ctx.fillText("▶", x + optW - 20, y + optH / 2);
    }
    y += optH + gap;
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "#5a5a6c";
  ctx.font = "13px system-ui, sans-serif";
  ctx.fillText(
    hintLine("↑ ↓ select      Enter confirm", "▲ ▼ select      Ⓐ confirm", "tap an option"),
    w / 2,
    h - 24
  );
}

// Destructive-action confirmation, drawn over the hub.
export function drawResetConfirm(ctx, view) {
  const w = view.width;
  const h = view.height;
  ctx.fillStyle = "rgba(6, 6, 10, 0.8)";
  ctx.fillRect(0, 0, w, h);

  const boxW = 460;
  const boxH = 170;
  const x = w / 2 - boxW / 2;
  const y = h / 2 - boxH / 2;
  roundRect(ctx, x, y, boxW, boxH, 12);
  ctx.fillStyle = "rgba(24, 18, 20, 0.98)";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#ff5a5a";
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ff8a7a";
  ctx.font = "700 22px system-ui, sans-serif";
  ctx.fillText("Reset all progress?", w / 2, y + 44);
  ctx.fillStyle = "#c0c0d0";
  ctx.font = "14px system-ui, sans-serif";
  ctx.fillText("Characters, tools, gold, and shop upgrades will be wiped.", w / 2, y + 78);

  // Two real buttons (44px+ targets) — tappable, and labeled per input device.
  drawDialogButton(ctx, w / 2 - 115, y + 104, 110, 44, hintLine("Enter: wipe it", "Ⓐ wipe it", "Wipe it"), "#ff5a5a", "confirm");
  drawDialogButton(ctx, w / 2 + 5, y + 104, 110, 44, hintLine("Esc: cancel", "Ⓑ cancel", "Cancel"), "#9a9ab0", "back");
}

// Shared dialog button: rounded, labeled, registered as a tap region.
export function drawDialogButton(ctx, x, y, w, h, label, color, regionId) {
  roundRect(ctx, x, y, w, h, 9);
  ctx.fillStyle = "rgba(18, 18, 26, 0.95)";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = "700 13px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + w / 2, y + h / 2 + 1);
  addRegion(regionId, x - 4, y - 4, w + 8, h + 8);
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

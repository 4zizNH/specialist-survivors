// ui/hubScreen.js
// The main-menu hub: title, gold + profile summary, and the three destinations
// (Play, Collection, Roster). Drawn in SCREEN space; navigation in main.js.

export const HUB_OPTIONS = [
  { id: "play", label: "PLAY", desc: "Pick a specialist, equip a tool, enter the arena" },
  { id: "shop", label: "SHOP", desc: "Spend gold on permanent account-wide upgrades" },
  { id: "fusion", label: "FUSION", desc: "Combine duplicate tools into higher rarities" },
  { id: "collection", label: "COLLECTION", desc: "Browse your tools by category and rarity" },
  { id: "achievements", label: "ACHIEVEMENTS", desc: "Milestones, rewards, and locked specialists" },
  { id: "roster", label: "ROSTER", desc: "Review your specialists and their levels" },
  { id: "reset", label: "RESET PROGRESS", desc: "Wipe the profile and start fresh (asks first)" },
];

export function drawHub(ctx, view, { save, selectedIndex }) {
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

  // Menu options (sized so the 7 rows fit above the footer hint).
  const optW = 420;
  const optH = 52;
  const gap = 11;
  let y = h * 0.37;
  for (let i = 0; i < HUB_OPTIONS.length; i++) {
    const opt = HUB_OPTIONS[i];
    const selected = i === selectedIndex;
    const x = w / 2 - optW / 2;

    roundRect(ctx, x, y, optW, optH, 10);
    ctx.fillStyle = selected ? "rgba(40, 40, 58, 0.98)" : "rgba(18, 18, 26, 0.9)";
    ctx.fill();
    ctx.lineWidth = selected ? 2.5 : 1;
    ctx.strokeStyle = selected ? "#5ac8ff" : "rgba(255,255,255,0.12)";
    ctx.stroke();

    const danger = opt.id === "reset";
    ctx.textAlign = "left";
    ctx.fillStyle = danger ? (selected ? "#ff8a7a" : "#a05a5a") : selected ? "#ffffff" : "#c0c0d0";
    ctx.font = "700 18px system-ui, sans-serif";
    ctx.fillText(opt.label, x + 24, y + 21);
    ctx.fillStyle = "#7a7a8c";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(opt.desc, x + 24, y + 39);

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
  ctx.fillText("↑ ↓ select      Enter confirm", w / 2, h - 24);
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
  ctx.fillStyle = "#9a9ab0";
  ctx.font = "700 15px ui-monospace, monospace";
  ctx.fillText("Enter: yes, wipe it      Esc: cancel", w / 2, y + 124);
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

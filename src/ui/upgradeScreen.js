// ui/upgradeScreen.js
// The level-up draft, drawn in SCREEN space over a dimmed, frozen world. Shows
// up to 3 option cards; pick via 1/2/3, stick/d-pad + Ⓐ (a focus ring marks
// the cursor), or tap. Cards stack vertically on narrow (phone) screens.

import { addRegion } from "../engine/hitRegions.js";
import { hintLine } from "./inputHints.js";

const KIND_COLOR = {
  new: "#5ad1ff",
  weapon: "#ffd27f",
  stat: "#74f0a0",
  passive: "#ff9fd0",
};
const KIND_LABEL = {
  new: "NEW WEAPON",
  weapon: "WEAPON",
  stat: "STAT",
  passive: "PASSIVE ITEM",
};

export function drawUpgradeScreen(ctx, view, options, selectedIndex = 0) {
  const w = view.width;
  const h = view.height;
  const stacked = w < 700; // phone portrait: cards stack vertically

  ctx.fillStyle = "rgba(6, 6, 12, 0.82)";
  ctx.fillRect(0, 0, w, h);

  const titleY = stacked ? 64 : h / 2 - 165;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#e8e8f0";
  ctx.font = `700 ${stacked ? 30 : 38}px system-ui, sans-serif`;
  ctx.fillText("LEVEL UP", w / 2, titleY);
  ctx.fillStyle = "#9a9ab0";
  ctx.font = "15px system-ui, sans-serif";
  ctx.fillText(
    hintLine(
      "Choose an upgrade — press  1 · 2 · 3",
      "◀ ▶ choose      Ⓐ confirm",
      "tap an upgrade to take it"
    ),
    w / 2,
    titleY + (stacked ? 28 : 33)
  );

  const n = options.length;
  if (n === 0) return;

  if (stacked) {
    // Vertical, full-width cards — big tap targets on small screens.
    const cardW = Math.min(420, w - 32);
    const gap = 14;
    const top = titleY + 52;
    const cardH = Math.min(190, (h - top - 24 - (n - 1) * gap) / n);
    let y = top;
    for (let i = 0; i < n; i++) {
      addRegion(`pick:${i}`, w / 2 - cardW / 2, y, cardW, cardH);
      drawCard(ctx, w / 2 - cardW / 2, y, cardW, cardH, i + 1, options[i], i === selectedIndex);
      y += cardH + gap;
    }
    return;
  }

  const cardH = 210;
  const gap = 24;
  const cardW = Math.min(300, (w - 80 - (n - 1) * gap) / n);
  const totalW = n * cardW + (n - 1) * gap;
  let x = (w - totalW) / 2;
  const y = h / 2 - cardH / 2 + 14;

  for (let i = 0; i < n; i++) {
    addRegion(`pick:${i}`, x, y, cardW, cardH);
    drawCard(ctx, x, y, cardW, cardH, i + 1, options[i], i === selectedIndex);
    x += cardW + gap;
  }
}

function drawCard(ctx, x, y, cw, ch, num, opt, focused) {
  const accent = KIND_COLOR[opt.kind] ?? "#ffffff";

  // Focus ring: the stick/keyboard cursor is always visible.
  if (focused) {
    roundRect(ctx, x - 5, y - 5, cw + 10, ch + 10, 15);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
    ctx.stroke();
  }

  // Panel.
  roundRect(ctx, x, y, cw, ch, 12);
  ctx.fillStyle = "rgba(22, 22, 32, 0.95)";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = accent;
  ctx.stroke();

  // Number badge.
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(x + 26, y + 28, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0a0a0f";
  ctx.font = "700 17px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(num), x + 26, y + 29);

  // Kind tag.
  ctx.fillStyle = accent;
  ctx.font = "700 11px ui-monospace, monospace";
  ctx.textAlign = "left";
  ctx.fillText(KIND_LABEL[opt.kind] ?? "", x + 50, y + 28);

  // Title (wrapped).
  ctx.fillStyle = "#f0f0f6";
  ctx.font = "700 18px system-ui, sans-serif";
  const titleLines = wrap(ctx, opt.title, cw - 36);
  let ty = y + 78;
  for (const line of titleLines) {
    ctx.fillText(line, x + 18, ty);
    ty += 24;
  }

  // Description (wrapped).
  ctx.fillStyle = "#aab";
  ctx.font = "14px system-ui, sans-serif";
  let dy = ty + 8;
  for (const line of wrap(ctx, opt.desc, cw - 36)) {
    ctx.fillText(line, x + 18, dy);
    dy += 20;
  }
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

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

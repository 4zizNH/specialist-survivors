// ui/shopScreen.js
// The meta-shop: spend gold on permanent account-wide upgrades. Drawn in
// SCREEN space; navigation lives in main.js.

import { SHOP_UPGRADES, getShopLevel } from "../data/shop.js";

export function drawShop(ctx, view, { save, selectedIndex, message }) {
  const w = view.width;
  const h = view.height;

  ctx.fillStyle = "#0a0a0f";
  ctx.fillRect(0, 0, w, h);

  // Title + gold.
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#e8e8f0";
  ctx.font = "700 40px system-ui, sans-serif";
  ctx.fillText("SHOP", w / 2, 80);
  ctx.fillStyle = "#ffd34d";
  ctx.font = "700 20px ui-monospace, monospace";
  ctx.fillText(`◆ ${save.currency.gold} gold`, w / 2, 112);

  // Upgrade rows.
  const rowW = Math.min(640, w - 80);
  const rowH = 92;
  const gap = 16;
  const x = w / 2 - rowW / 2;
  let y = 160;

  for (let i = 0; i < SHOP_UPGRADES.length; i++) {
    const u = SHOP_UPGRADES[i];
    const lvl = getShopLevel(save, u.id);
    const maxed = lvl >= u.max;
    const price = maxed ? null : u.cost(lvl);
    const affordable = !maxed && save.currency.gold >= price;
    const selected = i === selectedIndex;

    roundRect(ctx, x, y, rowW, rowH, 10);
    ctx.fillStyle = selected ? "rgba(38, 38, 54, 0.98)" : "rgba(18, 18, 26, 0.92)";
    ctx.fill();
    ctx.lineWidth = selected ? 2.5 : 1;
    ctx.strokeStyle = selected ? "#ffd34d" : "rgba(255,255,255,0.12)";
    ctx.stroke();

    // Name + description.
    ctx.textAlign = "left";
    ctx.fillStyle = "#f0f0f6";
    ctx.font = "700 18px system-ui, sans-serif";
    ctx.fillText(u.name, x + 20, y + 30);
    ctx.fillStyle = "#9a9ab0";
    ctx.font = "13px system-ui, sans-serif";
    ctx.fillText(u.desc, x + 20, y + 52);

    // Level pips.
    let px = x + 20;
    for (let p = 0; p < u.max; p++) {
      ctx.fillStyle = p < lvl ? "#ffd34d" : "rgba(255,255,255,0.15)";
      ctx.fillRect(px, y + 64, 22, 6);
      px += 27;
    }
    ctx.fillStyle = "#7a7a8c";
    ctx.font = "12px ui-monospace, monospace";
    ctx.fillText(u.effectText(lvl), px + 8, y + 71);

    // Price / status.
    ctx.textAlign = "right";
    if (maxed) {
      ctx.fillStyle = "#5fd66f";
      ctx.font = "700 15px ui-monospace, monospace";
      ctx.fillText("MAXED", x + rowW - 20, y + 40);
    } else {
      ctx.fillStyle = affordable ? "#ffd34d" : "#8a5a5a";
      ctx.font = "700 17px ui-monospace, monospace";
      ctx.fillText(`◆ ${price}`, x + rowW - 20, y + 34);
      ctx.fillStyle = "#7a7a8c";
      ctx.font = "12px system-ui, sans-serif";
      ctx.fillText(affordable ? "Enter to buy" : "not enough gold", x + rowW - 20, y + 56);
    }

    y += rowH + gap;
  }

  // Feedback line (last purchase result).
  if (message) {
    ctx.textAlign = "center";
    ctx.fillStyle = message.ok ? "#5fd66f" : "#ff7a6a";
    ctx.font = "600 15px system-ui, sans-serif";
    ctx.fillText(message.text, w / 2, y + 18);
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "#5a5a6c";
  ctx.font = "13px system-ui, sans-serif";
  ctx.fillText("↑ ↓ select      Enter buy      Esc back", w / 2, h - 24);
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

// ui/fusionScreen.js
// The Fusion screen: the collection grouped into stacks (baseId + rarity) with
// counts, fusable stacks glowing, and a before/after stat preview. Confirm is a
// dialog (fusion is destructive); success plays a scale-in reveal styled like
// the end-of-run drop reveal. Navigation lives in main.js.

import { drawToolCard } from "./toolCard.js";
import { RARITIES } from "../data/rarities.js";
import { resolveToolWeaponDef, makeTool } from "../data/tools.js";
import { fusionInfo } from "../meta/fusion.js";
import { CHARACTERS_BY_ID } from "../data/characters.js";
import { addRegion } from "../engine/hitRegions.js";
import { hintLine, drawBackChip } from "./inputHints.js";
import { drawDialogButton } from "./hubScreen.js";

// Grid columns shrink on narrow screens so cards stay readable/tappable.
export function fusionCols(viewWidth) {
  return viewWidth < 700 ? 2 : 4;
}

export function drawFusion(ctx, view, { save, stacks, selectedIndex, mode, result, revealElapsed }) {
  const w = view.width;
  const h = view.height;

  ctx.fillStyle = "#0a0a0f";
  ctx.fillRect(0, 0, w, h);

  // Title + gold.
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#e8e8f0";
  ctx.font = "700 34px system-ui, sans-serif";
  ctx.fillText("FUSION", w / 2, 60);
  ctx.fillStyle = "#9a9ab0";
  ctx.font = "13px system-ui, sans-serif";
  ctx.fillText("Combine copies of a tool to forge the next rarity", w / 2, 84);
  ctx.textAlign = "right";
  ctx.fillStyle = "#ffd34d";
  ctx.font = "700 16px ui-monospace, monospace";
  ctx.fillText(`◆ ${save.currency.gold} gold`, w - 40, 62);

  // Grid of stacks.
  const cols = fusionCols(w);
  const marginX = Math.min(40, w * 0.04);
  const gap = 16;
  const cardW = (w - marginX * 2 - gap * (cols - 1)) / cols;
  const cardH = 104;
  const top = 104;
  const detailTop = h - 168;

  for (let i = 0; i < stacks.length; i++) {
    const t = stacks[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = marginX + col * (cardW + gap);
    const y = top + row * (cardH + gap);
    if (y + cardH > detailTop - 10) break;
    const info = fusionInfo(save, t.baseId, t.rarity);
    addRegion(`sel:${i}`, x, y, cardW, cardH);
    drawToolCard(ctx, x, y, cardW, cardH, t, {
      selected: i === selectedIndex,
      highlight: info.fusable,
      count: t.count,
    });
  }

  // Before/after preview panel.
  drawPreview(ctx, view, save, stacks[selectedIndex], detailTop);

  // Controls.
  ctx.textAlign = "center";
  ctx.fillStyle = "#5a5a6c";
  ctx.font = "13px system-ui, sans-serif";
  ctx.fillText(
    hintLine(
      "← → ↑ ↓ select      Enter fuse      Esc back",
      "✚ select      Ⓐ fuse      Ⓑ back",
      "tap to select · tap again to fuse"
    ),
    w / 2,
    h - 16
  );
  drawBackChip(ctx, view);

  // Overlays.
  if (mode === "confirm") drawConfirm(ctx, view, save, stacks[selectedIndex]);
  else if (mode === "reveal") drawReveal(ctx, view, result, revealElapsed);
}

function drawPreview(ctx, view, save, tool, top) {
  const w = view.width;
  const x = 40;
  const width = w - 80;
  const height = 136;

  roundRect(ctx, x, top, width, height, 10);
  ctx.fillStyle = "rgba(18, 18, 26, 0.95)";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.stroke();
  if (!tool) return;

  const info = fusionInfo(save, tool.baseId, tool.rarity);
  const rar = RARITIES[tool.rarity];
  const cur = resolveToolWeaponDef(tool);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#f0f0f6";
  ctx.font = "700 19px system-ui, sans-serif";
  ctx.fillText(`${tool.name}  ×${tool.count}`, x + 18, top + 30);
  ctx.fillStyle = rar.color;
  ctx.font = "700 12px ui-monospace, monospace";
  ctx.fillText(rar.label.toUpperCase(), x + 18, top + 50);

  if (!info.target) {
    // Legendary cap — shown, not hidden.
    ctx.fillStyle = "#ffb03a";
    ctx.font = "700 15px system-ui, sans-serif";
    ctx.fillText("★ MAX RARITY — this tool cannot be fused further.", x + 18, top + 86);
    return;
  }

  const nxt = resolveToolWeaponDef(makeTool(tool.baseId, info.target));
  const trar = RARITIES[info.target];

  // Recipe line.
  ctx.fillStyle = "#cfcfe0";
  ctx.font = "14px ui-monospace, monospace";
  ctx.fillText(
    `${info.needed}× ${rar.label}  +  ◆${info.cost}   →   1× `,
    x + 18,
    top + 80
  );
  const prefixW = ctx.measureText(`${info.needed}× ${rar.label}  +  ◆${info.cost}   →   1× `).width;
  ctx.fillStyle = trar.color;
  ctx.font = "700 14px ui-monospace, monospace";
  ctx.fillText(trar.label, x + 18 + prefixW, top + 80);

  // Stat deltas.
  ctx.font = "13px ui-monospace, monospace";
  ctx.fillStyle = "#9a9ab0";
  const deltas = [
    `DMG ${cur.damage} → `,
    `CD ${cur.cooldown}s → `,
    `AREA ${cur.area} → `,
  ];
  const values = [`${nxt.damage}`, `${nxt.cooldown}s`, `${nxt.area}`];
  let px = x + 18;
  for (let i = 0; i < deltas.length; i++) {
    ctx.fillStyle = "#9a9ab0";
    ctx.fillText(deltas[i], px, top + 106);
    px += ctx.measureText(deltas[i]).width;
    ctx.fillStyle = "#5fd66f";
    ctx.fillText(values[i], px, top + 106);
    px += ctx.measureText(values[i]).width + 26;
  }

  // Status (fusable / why not / unequip warning).
  ctx.textAlign = "right";
  if (info.fusable) {
    ctx.fillStyle = "#5fd66f";
    ctx.font = "700 14px system-ui, sans-serif";
    ctx.fillText("READY — press Enter to fuse", x + width - 18, top + 34);
    if (info.wouldUnequip.length) {
      ctx.fillStyle = "#ffb03a";
      ctx.font = "12px system-ui, sans-serif";
      const names = info.wouldUnequip.map((c) => CHARACTERS_BY_ID[c]?.name || c).join(", ");
      ctx.fillText(`⚠ will unequip from ${names}`, x + width - 18, top + 54);
    }
  } else {
    ctx.fillStyle = "#c85a5a";
    ctx.font = "600 13px system-ui, sans-serif";
    ctx.fillText(info.reason, x + width - 18, top + 34);
  }
}

function drawConfirm(ctx, view, save, tool) {
  const w = view.width;
  const h = view.height;
  const info = fusionInfo(save, tool.baseId, tool.rarity);
  const trar = RARITIES[info.target];

  ctx.fillStyle = "rgba(6, 6, 10, 0.8)";
  ctx.fillRect(0, 0, w, h);

  const boxW = 480;
  const boxH = info.wouldUnequip.length ? 200 : 172;
  const x = w / 2 - boxW / 2;
  const y = h / 2 - boxH / 2;
  roundRect(ctx, x, y, boxW, boxH, 12);
  ctx.fillStyle = "rgba(22, 22, 32, 0.98)";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = trar.color;
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#f0f0f6";
  ctx.font = "700 20px system-ui, sans-serif";
  ctx.fillText(`Fuse ${info.needed}× ${tool.name}?`, w / 2, y + 40);
  ctx.fillStyle = "#cfcfe0";
  ctx.font = "14px ui-monospace, monospace";
  ctx.fillText(`${info.needed}× ${RARITIES[tool.rarity].label}  +  ◆${info.cost}   →   1× ${trar.label}`, w / 2, y + 74);
  let ly = y + 102;
  if (info.wouldUnequip.length) {
    ctx.fillStyle = "#ffb03a";
    ctx.font = "600 13px system-ui, sans-serif";
    const names = info.wouldUnequip.map((c) => CHARACTERS_BY_ID[c]?.name || c).join(", ");
    ctx.fillText(`⚠ This consumes the last copies — ${names} will be unequipped.`, w / 2, ly);
    ly += 28;
  }
  drawDialogButton(ctx, w / 2 - 120, ly + 4, 115, 44, hintLine("Enter: fuse", "Ⓐ fuse", "Fuse"), "#5fd66f", "confirm");
  drawDialogButton(ctx, w / 2 + 5, ly + 4, 115, 44, hintLine("Esc: cancel", "Ⓑ cancel", "Cancel"), "#9a9ab0", "back");
}

function drawReveal(ctx, view, result, elapsed) {
  const w = view.width;
  const h = view.height;
  const rar = RARITIES[result.rarity];
  // Ease-out scale-in over ~0.35s, consistent with the drop-reveal styling.
  const t = Math.min(1, elapsed / 0.35);
  const scale = 0.6 + 0.4 * (1 - Math.pow(1 - t, 3));

  ctx.fillStyle = "rgba(6, 6, 10, 0.85)";
  ctx.fillRect(0, 0, w, h);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.globalAlpha = t;
  ctx.fillStyle = rar.color;
  ctx.font = "700 26px system-ui, sans-serif";
  ctx.fillText(`FUSION COMPLETE — ${rar.label.toUpperCase()}!`, w / 2, h / 2 - 90);

  const cardW = 260;
  const cardH = 100;
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(scale, scale);
  drawToolCard(ctx, -cardW / 2, -cardH / 2, cardW, cardH, result, { selected: true });
  ctx.restore();

  if (t >= 1) {
    ctx.fillStyle = "#9a9ab0";
    ctx.font = "14px system-ui, sans-serif";
    ctx.fillText(hintLine("Press Enter to continue", "Ⓐ continue", "tap to continue"), w / 2, h / 2 + 90);
  }
  ctx.globalAlpha = 1;
  addRegion("confirm", 0, 0, w, h); // tap anywhere dismisses the reveal
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

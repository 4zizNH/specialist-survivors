// ui/collectionScreen.js
// The Collection / Inventory screen: a rarity-color-coded grid of owned tools
// with category + rarity filters and a detail panel (the "tooltip") showing the
// selected tool's full stats.

import { drawToolCard, drawToolDetailPanel } from "./toolCard.js";
import { RARITIES } from "../data/rarities.js";
import { SPECIALIZATIONS } from "../data/characters.js";

export const COLLECTION_COLS = 4;

export function drawCollection(ctx, view, { tools, selectedIndex, catFilter, rarFilter, evolutionsSeen }) {
  const w = view.width;
  const h = view.height;

  ctx.fillStyle = "#0a0a0f";
  ctx.fillRect(0, 0, w, h);

  // Title.
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#e8e8f0";
  ctx.font = "700 34px system-ui, sans-serif";
  ctx.fillText("COLLECTION", w / 2, 60);

  // Filters.
  ctx.font = "14px ui-monospace, monospace";
  ctx.textAlign = "left";
  const catText = catFilter
    ? (SPECIALIZATIONS[catFilter] || { label: catFilter }).label
    : "All";
  const rarText = rarFilter ? RARITIES[rarFilter].label : "All";
  ctx.fillStyle = "#9a9ab0";
  ctx.fillText(`Category [F]: `, 40, 92);
  ctx.fillStyle = catFilter ? (SPECIALIZATIONS[catFilter]?.color ?? "#e0e0ea") : "#e0e0ea";
  ctx.fillText(catText, 155, 92);
  ctx.fillStyle = "#9a9ab0";
  ctx.fillText(`Rarity [R]: `, 300, 92);
  ctx.fillStyle = rarFilter ? RARITIES[rarFilter].color : "#e0e0ea";
  ctx.fillText(rarText, 400, 92);
  ctx.textAlign = "right";
  ctx.fillStyle = "#7a7a8c";
  ctx.fillText(`${tools.length} tools`, w - 40, 92);

  // Grid.
  const cols = COLLECTION_COLS;
  const marginX = 40;
  const gap = 16;
  const cardW = (w - marginX * 2 - gap * (cols - 1)) / cols;
  const cardH = 104;
  const top = 118;
  const detailTop = h - 150;

  if (tools.length === 0) {
    ctx.textAlign = "center";
    ctx.fillStyle = "#7a7a8c";
    ctx.font = "18px system-ui, sans-serif";
    ctx.fillText("No tools match this filter.", w / 2, top + 120);
  }

  for (let i = 0; i < tools.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = marginX + col * (cardW + gap);
    const y = top + row * (cardH + gap);
    if (y + cardH > detailTop - 10) break; // don't spill into the detail panel
    drawToolCard(ctx, x, y, cardW, cardH, tools[i], { selected: i === selectedIndex });
  }

  // Detail panel ("tooltip") for the selected tool — shared with Equip. Here
  // it also shows the evolution recipe (discovered) or a "???" hint.
  drawToolDetailPanel(ctx, view, tools[selectedIndex], detailTop, 118, evolutionsSeen || []);

  // Controls.
  ctx.textAlign = "center";
  ctx.fillStyle = "#5a5a6c";
  ctx.font = "13px system-ui, sans-serif";
  ctx.fillText("← → ↑ ↓ browse      F category      R rarity      Esc back", w / 2, h - 16);
}

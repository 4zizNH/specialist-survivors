// ui/collectionScreen.js
// The Collection / Inventory screen: a rarity-color-coded grid of owned tools
// with category + rarity filters and a detail panel (the "tooltip") showing the
// selected tool's full stats. Cards and the filter labels are tap targets.

import { drawToolCard, drawToolDetailPanel } from "./toolCard.js";
import { RARITIES } from "../data/rarities.js";
import { SPECIALIZATIONS } from "../data/characters.js";
import { addRegion } from "../engine/hitRegions.js";
import { hintLine, drawBackChip } from "./inputHints.js";

// Grid columns shrink on narrow screens so cards stay readable/tappable.
export function collectionCols(viewWidth) {
  return viewWidth < 700 ? 2 : 4;
}

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

  // Filters (each is a tap target that cycles its filter). On narrow screens
  // the two filters split the row and the tool count is dropped.
  const compact = w < 700;
  const catX = compact ? 16 : 40;
  const rarX = compact ? w / 2 + 8 : 300;
  ctx.font = compact ? "12px ui-monospace, monospace" : "14px ui-monospace, monospace";
  ctx.textAlign = "left";
  const catText = catFilter
    ? (SPECIALIZATIONS[catFilter] || { label: catFilter }).label
    : "All";
  const rarText = rarFilter ? RARITIES[rarFilter].label : "All";
  ctx.fillStyle = "#9a9ab0";
  ctx.fillText(`Category [F]: `, catX, 92);
  ctx.fillStyle = catFilter ? (SPECIALIZATIONS[catFilter]?.color ?? "#e0e0ea") : "#e0e0ea";
  ctx.fillText(catText, catX + (compact ? 96 : 115), 92);
  addRegion("filterCat", catX - 6, 70, compact ? 170 : 226, 34);
  ctx.fillStyle = "#9a9ab0";
  ctx.fillText(`Rarity [R]: `, rarX, 92);
  ctx.fillStyle = rarFilter ? RARITIES[rarFilter].color : "#e0e0ea";
  ctx.fillText(rarText, rarX + (compact ? 82 : 100), 92);
  addRegion("filterRar", rarX - 6, 70, compact ? 170 : 200, 34);
  if (!compact) {
    ctx.textAlign = "right";
    ctx.fillStyle = "#7a7a8c";
    ctx.fillText(`${tools.length} tools`, w - 40, 92);
  }

  // Grid.
  const cols = collectionCols(w);
  const marginX = Math.min(40, w * 0.04);
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
    addRegion(`sel:${i}`, x, y, cardW, cardH);
    drawToolCard(ctx, x, y, cardW, cardH, tools[i], { selected: i === selectedIndex });
  }

  // Detail panel ("tooltip") for the selected tool — shared with Equip. Here
  // it also shows the evolution recipe (discovered) or a "???" hint.
  drawToolDetailPanel(ctx, view, tools[selectedIndex], detailTop, 118, evolutionsSeen || []);

  // Controls.
  ctx.textAlign = "center";
  ctx.fillStyle = "#5a5a6c";
  ctx.font = "13px system-ui, sans-serif";
  ctx.fillText(
    hintLine(
      "← → ↑ ↓ browse      F category      R rarity      Esc back",
      "✚ browse      LB category      RB rarity      Ⓑ back",
      "tap a card to inspect · tap a filter to cycle it"
    ),
    w / 2,
    h - 16
  );
  drawBackChip(ctx, view);
}

// ui/equipScreen.js
// The per-character Equip screen. Shows the character's spec + equip slot, then
// all owned tools: compatible ones are selectable, incompatible ones are greyed
// out with the reason ("Requires a Blades specialist"). This is where the core
// specialization rule is enforced and explained.

import { drawToolCard, drawToolDetailPanel } from "./toolCard.js";
import { SPECIALIZATIONS } from "../data/characters.js";
import { canEquip, equipReason } from "../meta/inventory.js";
import { addRegion } from "../engine/hitRegions.js";
import { hintLine, drawBackChip } from "./inputHints.js";

// Grid columns shrink on narrow screens so cards stay readable/tappable.
export function equipCols(viewWidth) {
  return viewWidth < 700 ? 2 : 4;
}

export function drawEquip(ctx, view, { character, level, tools, selectedIndex, loadout, slots = 1 }) {
  const w = view.width;
  const h = view.height;
  const spec = SPECIALIZATIONS[character.specialization] || { label: character.specialization, color: "#888" };

  ctx.fillStyle = "#0a0a0f";
  ctx.fillRect(0, 0, w, h);

  // --- Header: portrait, name, spec, equip slot ---
  // Portrait sits right of the top-left back chip so they never overlap.
  const narrow = w < 620;
  ctx.fillStyle = character.color;
  ctx.beginPath();
  ctx.arc(116, 52, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0a0a0f";
  ctx.font = "700 24px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(character.name[0], 116, 53);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#f0f0f6";
  ctx.font = "700 22px system-ui, sans-serif";
  ctx.fillText(`${character.name}`, 150, 46);
  ctx.font = "700 12px ui-monospace, monospace";
  ctx.fillStyle = spec.color;
  ctx.fillText(`${spec.label.toUpperCase()} · LV ${level}`, 150, 66);

  // Equip slot summary (right side). Full names on wide screens; a compact
  // count on narrow ones so it can't collide with the character name.
  const equippedNames = (loadout || []).map((t) => t.name);
  ctx.textAlign = "right";
  if (narrow) {
    ctx.fillStyle = equippedNames.length ? "#e0e0ea" : "#5a5a6c";
    ctx.font = "700 14px ui-monospace, monospace";
    ctx.fillText(`${equippedNames.length}/${slots} equipped`, w - 14, 40);
  } else {
    ctx.fillStyle = "#9a9ab0";
    ctx.font = "14px ui-monospace, monospace";
    ctx.fillText(`Equipped (${equippedNames.length}/${slots}):`, w - 40, 44);
    ctx.fillStyle = equippedNames.length ? "#e0e0ea" : "#5a5a6c";
    ctx.font = "700 15px system-ui, sans-serif";
    ctx.fillText(equippedNames.length ? equippedNames.join(", ") : "— none —", w - 40, 66);
  }

  // Divider + prompt.
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath();
  ctx.moveTo(40, 92);
  ctx.lineTo(w - 40, 92);
  ctx.stroke();
  ctx.textAlign = narrow ? "center" : "left";
  ctx.fillStyle = "#7a7a8c";
  ctx.font = "13px system-ui, sans-serif";
  ctx.fillText(
    narrow
      ? `Only ${spec.label} tools fit ${character.name}.`
      : `Only ${spec.label} tools can be equipped by ${character.name}. Incompatible tools are locked.`,
    narrow ? w / 2 : 40,
    112
  );

  // --- Grid of owned tools ---
  const cols = equipCols(w);
  const marginX = Math.min(40, w * 0.04);
  const gap = 16;
  const cardW = (w - marginX * 2 - gap * (cols - 1)) / cols;
  const cardH = 104;
  const top = 128;

  const detailTop = h - 160;
  const equippedIds = new Set((loadout || []).map((t) => t.id));
  for (let i = 0; i < tools.length; i++) {
    const tool = tools[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = marginX + col * (cardW + gap);
    const y = top + row * (cardH + gap);
    if (y + cardH > detailTop - 10) break;
    const compatible = canEquip(character, tool);
    addRegion(`sel:${i}`, x, y, cardW, cardH);
    drawToolCard(ctx, x, y, cardW, cardH, tool, {
      selected: i === selectedIndex,
      dimmed: !compatible,
      equipped: equippedIds.has(tool.id),
      lockText: compatible ? null : equipReason(character, tool),
    });
  }

  // Full-stats tooltip for the selected tool — shared with the Collection.
  drawToolDetailPanel(ctx, view, tools[selectedIndex], detailTop);

  // Controls.
  ctx.textAlign = "center";
  ctx.fillStyle = "#5a5a6c";
  ctx.font = "13px system-ui, sans-serif";
  ctx.fillText(
    hintLine(
      "← → ↑ ↓ select      Enter equip      X unequip      Esc back",
      "✚ select      Ⓐ equip      Ⓨ unequip      Ⓑ back",
      "tap to select · tap again to equip/unequip"
    ),
    w / 2,
    h - 16
  );
  drawBackChip(ctx, view);
}

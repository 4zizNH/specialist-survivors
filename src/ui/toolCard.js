// ui/toolCard.js
// Shared tool-card renderer used by the Collection and Equip screens. Color is
// driven by rarity (single source of truth in data/rarities.js). `dimmed` +
// `lockText` render an incompatible/locked tool.

import { RARITIES } from "../data/rarities.js";
import { SPECIALIZATIONS, CHARACTERS_LIST } from "../data/characters.js";
import { resolveToolWeaponDef } from "../data/tools.js";
import { EVOLUTIONS } from "../data/balance.js";
import { PASSIVES } from "../data/passives.js";
import { clipText } from "./responsive.js";

export function drawToolCard(ctx, x, y, w, h, tool, opts = {}) {
  const {
    selected = false,
    dimmed = false,
    equipped = false,
    lockText = null,
    count = tool.count, // stack size badge (shown when > 1)
    highlight = false, // e.g. "fusable" glow
  } = opts;
  const rar = RARITIES[tool.rarity] || RARITIES.common;
  const spec = SPECIALIZATIONS[tool.category] || { label: tool.category, color: "#888" };
  const stats = resolveToolWeaponDef(tool);

  ctx.save();
  if (dimmed) ctx.globalAlpha = 0.45;

  // Panel + rarity border (+optional outer glow for fusable stacks).
  if (highlight) {
    roundRect(ctx, x - 3, y - 3, w + 6, h + 6, 10);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255, 211, 77, 0.55)";
    ctx.stroke();
  }
  roundRect(ctx, x, y, w, h, 8);
  ctx.fillStyle = selected ? "rgba(40, 40, 56, 0.98)" : "rgba(19, 19, 27, 0.95)";
  ctx.fill();
  ctx.lineWidth = selected ? 3 : 2;
  ctx.strokeStyle = rar.color;
  ctx.stroke();

  // Rarity accent strip (top).
  ctx.fillStyle = rar.color;
  ctx.fillRect(x + 8, y + 9, w - 16, 3);

  // Name.
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#f0f0f6";
  ctx.font = "700 15px system-ui, sans-serif";
  ctx.fillText(tool.name, x + 12, y + 32);

  // Rarity label + category pill.
  ctx.font = "700 10px ui-monospace, monospace";
  ctx.fillStyle = rar.color;
  ctx.fillText(rar.label.toUpperCase(), x + 12, y + 48);

  const catLabel = spec.label.toUpperCase();
  const pillW = ctx.measureText(catLabel).width + 14;
  const pillX = x + w - pillW - 12;
  roundRect(ctx, pillX, y + 38, pillW, 15, 7);
  ctx.fillStyle = hexA(spec.color, 0.18);
  ctx.fill();
  ctx.fillStyle = spec.color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(catLabel, pillX + pillW / 2, y + 46);

  // Stats — shrunk to fit the card so long values (e.g. epic/legendary
  // rolls with more digits) never spill past the card's edge.
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#9a9ab0";
  const line = `DMG ${stats.damage}  CD ${stats.cooldown}s  AR ${stats.area}`;
  fitMonoFont(ctx, line, w - 24, 12);
  ctx.fillText(line, x + 12, y + 74);

  // Stack count badge (×N, bottom-right) — measured up front so the
  // equipped/lock text below stays clear of it (they used to sit on the same
  // baseline and collide once a stack had a count and a locked reason).
  let countBadgeW = 0;
  if (count > 1) {
    ctx.font = "700 14px ui-monospace, monospace";
    countBadgeW = ctx.measureText(`×${count}`).width;
    ctx.textAlign = "right";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#ffd34d";
    ctx.fillText(`×${count}`, x + w - 12, y + h - 10);
    ctx.textAlign = "left"; // restore for the badges below
  }

  // Equipped badge or lock reason.
  const bottomTextMaxW = w - 24 - (countBadgeW ? countBadgeW + 14 : 0);
  if (equipped) {
    ctx.fillStyle = "#5fd66f";
    ctx.font = "700 11px ui-monospace, monospace";
    ctx.fillText(clipText(ctx, "● EQUIPPED", bottomTextMaxW), x + 12, y + h - 12);
  } else if (dimmed && lockText) {
    ctx.globalAlpha = 1; // reason stays readable over the dim
    ctx.fillStyle = "#c85a5a";
    ctx.font = "italic 11px system-ui, sans-serif";
    ctx.fillText(clipText(ctx, "🔒 " + lockText, bottomTextMaxW), x + 12, y + h - 12);
  }

  ctx.restore();
}

// Shared detail panel ("tooltip") — used by the Collection and Equip screens so
// rarity color, category, full stats, and who can use the tool read identically
// everywhere.
// `evolutionsSeen` (optional array of base tool ids) unlocks the recipe text —
// discovered evolutions read as lore entries, undiscovered ones as "???".
export function drawToolDetailPanel(ctx, view, tool, top, height = 118, evolutionsSeen = null) {
  const w = view.width;
  const compact = w < 700; // phone portrait: fewer columns, no right-side extras
  const x = compact ? 12 : 40;
  const width = w - x * 2;

  roundRect(ctx, x, top, width, height, 10);
  ctx.fillStyle = "rgba(18, 18, 26, 0.95)";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = tool ? RARITIES[tool.rarity].color : "rgba(255,255,255,0.1)";
  ctx.stroke();

  if (!tool) return;
  const rar = RARITIES[tool.rarity];
  const spec = SPECIALIZATIONS[tool.category] || { label: tool.category, color: "#888" };
  const s = resolveToolWeaponDef(tool);
  const m = tool.rarityMultipliers || {};

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#f0f0f6";
  ctx.font = "700 20px system-ui, sans-serif";
  ctx.fillText(tool.name, x + 18, top + 30);

  ctx.font = "700 12px ui-monospace, monospace";
  ctx.fillStyle = rar.color;
  ctx.fillText(rar.label.toUpperCase(), x + 18, top + 50);
  ctx.fillStyle = spec.color;
  ctx.fillText(
    `· ${spec.label.toUpperCase()}`,
    x + 18 + ctx.measureText(rar.label.toUpperCase() + " ").width + 6,
    top + 50
  );

  const evo = evolutionsSeen ? EVOLUTIONS[tool.baseId] : null;
  const evoSeen = evo && evolutionsSeen.includes(tool.baseId);

  if (compact) {
    // Compact: one dense stat line + one evolution line; skip the extras.
    ctx.fillStyle = "#cfcfe0";
    const line = `DMG ${s.damage}  CD ${s.cooldown}s  AR ${s.area}  ×${s.count}  P ${s.pierce < 0 ? "∞" : s.pierce}`;
    fitMonoFont(ctx, line, width - 36, 12);
    ctx.fillText(line, x + 18, top + 74);
    if (evo) {
      ctx.fillStyle = evoSeen ? "#ffd34d" : "#7a7a8c";
      ctx.fillText(`⚡ Evolution: ${evoSeen ? evo.evolvedName : "???"}`, x + 18, top + 96);
    }
    return;
  }

  // Effective stats (base × rarity).
  ctx.font = "13px ui-monospace, monospace";
  ctx.fillStyle = "#cfcfe0";
  const parts = [
    `Behavior: ${s.fireBehavior}`,
    `Damage: ${s.damage}`,
    `Cooldown: ${s.cooldown}s`,
    `Area: ${s.area}`,
    `Count: ${s.count}`,
    `Pierce: ${s.pierce < 0 ? "∞" : s.pierce}`,
  ];
  let px = x + 18;
  const py = top + 74;
  for (const p of parts) {
    ctx.fillText(p, px, py);
    px += ctx.measureText(p).width + 22;
  }

  // Who can wield it.
  const users = CHARACTERS_LIST.filter((c) => c.specialization === tool.category);
  ctx.fillStyle = "#9a9ab0";
  ctx.fillText("Usable by:", x + 18, top + 96);
  ctx.fillStyle = spec.color;
  ctx.fillText(users.map((c) => c.name).join(", ") || "—", x + 96, top + 96);

  // Rarity multipliers (top-right).
  ctx.textAlign = "right";
  ctx.fillStyle = "#7a7a8c";
  ctx.fillText(
    `rarity ×  dmg ${fmtMult(m.damage)}  cd ${fmtMult(m.cooldown)}  area ${fmtMult(m.area)}`,
    x + width - 18,
    top + 30
  );

  // Evolution recipe entry (right side). Discovered in a past run → full lore;
  // otherwise a "???" hint at what's waiting.
  if (evo) {
    ctx.textAlign = "right";
    if (evoSeen) {
      ctx.fillStyle = "#ffd34d";
      ctx.fillText(`⚡ Evolution: ${evo.evolvedName}`, x + width - 18, top + 50);
      ctx.fillStyle = "#9a9ab0";
      const pas = PASSIVES[evo.requiresPassiveId]?.name ?? evo.requiresPassiveId;
      ctx.fillText(`max level + ${pas}`, x + width - 18, top + 96);
    } else {
      ctx.fillStyle = "#7a7a8c";
      ctx.fillText("⚡ Evolution: ???", x + width - 18, top + 50);
      ctx.fillStyle = "#5a5a6c";
      ctx.fillText("max it in a run holding the right passive…", x + width - 18, top + 96);
    }
  }
}

// Sets ctx.font to the largest monospace size (≤ basePx, ≥ 8px) at which
// `text` fits `maxWidth`, so stat lines never overflow the card/panel they're
// drawn in — long rolls (bigger numbers) just render a touch smaller.
function fitMonoFont(ctx, text, maxWidth, basePx) {
  let px = basePx;
  ctx.font = `${px}px ui-monospace, monospace`;
  while (px > 8 && ctx.measureText(text).width > maxWidth) {
    px -= 1;
    ctx.font = `${px}px ui-monospace, monospace`;
  }
}

function fmtMult(v) {
  return v == null ? "1.00" : v.toFixed(2);
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
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

// ui/hud.js
// In-run HUD drawn in SCREEN space: HP bar + equipped-tool icons + passive
// chips (top-left), run timer (top-center), kills (top-right), XP bar + level
// (bottom). Tool icons are rarity-bordered chips: border = rarity color, dot =
// the weapon's own color, small level number in the corner. A weapon at max
// level shows MAX (gold), an evolvable one pulses gold, an evolved one gets ★.
//
// Everything scales by hudScale(view) and the HP bar is width-capped so it can
// never collide with the centered timer on a phone.

import { rarityColor } from "../data/rarities.js";
import { PASSIVES } from "../data/passives.js";
import { evolutionStatus } from "../systems/evolution.js";
import { hudScale } from "./responsive.js";

export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function drawHud(ctx, view, { player, xp, runTime, kills, weapons }) {
  const w = view.width;
  const h = view.height;
  const s = hudScale(view); // 0.62–1 by viewport width

  // --- HP bar (top-left) — width-capped so it never reaches the timer ---
  const hx = 10;
  const hy = 10 * s;
  const hpH = 18 * s;
  const hpW = Math.min(240 * s, w / 2 - 58); // leave center clear for the timer
  roundRect(ctx, hx, hy, hpW, hpH, 4);
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fill();
  const frac = Math.max(0, player.hp / player.maxHp);
  if (frac > 0) {
    roundRect(ctx, hx, hy, hpW * frac, hpH, 4);
    ctx.fillStyle = frac > 0.3 ? "#e0556a" : "#ff3b3b";
    ctx.fill();
  }
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${Math.round(12 * s)}px ui-monospace, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // Drop the " HP" suffix when the bar is narrow so the numbers stay readable.
  const hpLabel = hpW < 150 ? `${Math.ceil(player.hp)}/${player.maxHp}` : `${Math.ceil(player.hp)} / ${player.maxHp} HP`;
  ctx.fillText(hpLabel, hx + hpW / 2, hy + hpH / 2 + 1);

  // --- Equipped-tool icons (under the HP bar) ---
  const iy = hy + hpH + 8 * s;
  const size = 30 * s;
  if (weapons && weapons.length) {
    const gap = 6 * s;
    let ix = hx;
    for (const inst of weapons) {
      const status = evolutionStatus(inst, player.passiveItems);
      const rc = inst.evolved ? "#ffd34d" : rarityColor(inst.stats.rarity || "common");
      roundRect(ctx, ix, iy, size, size, 6);
      ctx.fillStyle = "rgba(10, 10, 16, 0.8)";
      ctx.fill();
      ctx.lineWidth = 2;
      // Evolution ready: pulsing gold border begging for an elite kill.
      ctx.strokeStyle =
        status === "ready"
          ? `rgba(255, 211, 77, ${0.6 + Math.sin(performance.now() / 150) * 0.4})`
          : rc;
      ctx.stroke();
      // Weapon-color core.
      ctx.fillStyle = inst.stats.color || "#ffffff";
      ctx.beginPath();
      ctx.arc(ix + size / 2, iy + size / 2, 7 * s, 0, Math.PI * 2);
      ctx.fill();
      // Level badge — MAX in gold, ★ once evolved.
      ctx.font = `bold ${Math.round(9 * s)}px ui-monospace, monospace`;
      ctx.textAlign = "right";
      ctx.textBaseline = "alphabetic";
      if (inst.evolved) {
        ctx.fillStyle = "#ffd34d";
        ctx.fillText("★", ix + size - 3, iy + size - 3);
      } else if (inst.level >= inst.maxLevel) {
        ctx.fillStyle = "#ffd34d";
        ctx.fillText("MAX", ix + size - 3, iy + size - 3);
      } else {
        ctx.fillStyle = "#e8e8f0";
        ctx.fillText(String(inst.level), ix + size - 4, iy + size - 4);
      }
      ix += size + gap;
    }
  }

  // --- Owned passive items (small round chips under the tool icons) ---
  const passives = player.passiveItems || [];
  if (passives.length) {
    const pr = 9 * s;
    let px = hx + pr;
    const py = iy + size + 8 * s + pr;
    for (const id of passives) {
      const def = PASSIVES[id];
      if (!def) continue;
      ctx.fillStyle = "rgba(10, 10, 16, 0.8)";
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = def.color;
      ctx.stroke();
      ctx.fillStyle = def.color;
      ctx.font = `bold ${Math.round(10 * s)}px ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(def.name[0], px, py + 0.5);
      px += pr * 2 + 5 * s;
    }
  }

  // --- Run timer (top-center) ---
  ctx.fillStyle = "#e8e8f0";
  ctx.font = `700 ${Math.round(26 * s)}px ui-monospace, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(formatTime(runTime), w / 2, 8 * s);

  // --- Kills (top-right) ---
  ctx.fillStyle = "#cfcfe0";
  ctx.font = `bold ${Math.round(14 * s)}px ui-monospace, monospace`;
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.fillText(`Kills ${kills}`, w - 10, 12 * s);

  // --- XP bar + level (bottom) ---
  const barH = Math.max(12, 16 * s);
  const y = h - barH;
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(0, y, w, barH);
  ctx.fillStyle = "#3ea76a";
  ctx.fillRect(0, y, w * Math.min(1, xp.progress), barH);
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${Math.round(11 * s)}px ui-monospace, monospace`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(`LV ${xp.level}`, 8, y + barH / 2);
  ctx.textAlign = "right";
  ctx.fillText(`${xp.xp} / ${xp.xpToNext} XP`, w - 8, y + barH / 2);
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

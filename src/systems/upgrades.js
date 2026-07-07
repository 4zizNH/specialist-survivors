// systems/upgrades.js
// Level-up drafting. rollUpgrades() inspects current state and returns N random,
// distinct option objects. Each option has a title, a preview desc (computed
// from current values), and apply(weapons, player) that performs the change.
//
// The pool is SCOPED TO THE CHARACTER: new-tool discoveries are limited to the
// character's specialization (never other categories); weapon upgrades apply to
// the tools they're already wielding; stats are generic.
//
// Four kinds:
//   new     — discover a tool within the character's specialization
//   weapon  — upgrade an active weapon (damage / cooldown / count / area)
//   stat    — boost a player stat (move speed / pickup radius / max HP)
//   passive — take a passive item (stat boost + possible evolution catalyst)

import { TOOL_BASES, makeTool, resolveToolWeaponDef } from "../data/tools.js";
import { PASSIVE_LIST, MAX_PASSIVES } from "../data/passives.js";
import { EVOLUTIONS } from "../data/balance.js";
import { rng } from "../engine/rng.js";

const MAX_WEAPONS = 6;

export function rollUpgrades(weapons, player, character, count = 3) {
  const candidates = [];
  const spec = character?.specialization;

  // Discover a new tool — only within the character's specialization, and only
  // ones not already active. Never offers weapons from other categories.
  if (spec && weapons.count < MAX_WEAPONS) {
    for (const base of Object.values(TOOL_BASES)) {
      if (base.category !== spec) continue;
      if (weapons.hasWeapon(base.baseId)) continue;
      candidates.push({
        kind: "new",
        title: `New Tool: ${base.name}`,
        desc: toolBlurb(base),
        apply: (w) => w.addWeaponDef(resolveToolWeaponDef(makeTool(base.baseId, "common"))),
      });
    }
  }

  // Upgrades for owned weapons.
  for (const inst of weapons.list) {
    if (inst.level >= inst.maxLevel) continue;
    const s = inst.stats;
    candidates.push(
      weaponUp(inst, "+30% Damage", `${s.damage} → ${Math.round(s.damage * 1.3)}`, (st) => {
        st.damage = Math.round(st.damage * 1.3);
      }),
      weaponUp(inst, "-15% Cooldown", `${s.cooldown.toFixed(2)}s → ${Math.max(0.08, s.cooldown * 0.85).toFixed(2)}s`, (st) => {
        st.cooldown = Math.max(0.08, +(st.cooldown * 0.85).toFixed(3));
      }),
      weaponUp(inst, "+1 Projectile", `${s.count} → ${s.count + 1}`, (st) => {
        st.count += 1;
      }),
      weaponUp(inst, "+25% Area", `${round1(s.area)} → ${round1(s.area * 1.25)}`, (st) => {
        st.area = +(st.area * 1.25).toFixed(2);
      })
    );
  }

  // Passive items — one pick each, capped slots. If a passive is the catalyst
  // for a currently-wielded weapon's evolution, say so on the card.
  const held = player.passiveItems || [];
  if (held.length < MAX_PASSIVES) {
    for (const pas of PASSIVE_LIST) {
      if (held.includes(pas.id)) continue;
      const evolves = weapons.list
        .filter((w) => !w.evolved && EVOLUTIONS[w.id]?.requiresPassiveId === pas.id)
        .map((w) => w.name);
      candidates.push({
        kind: "passive",
        title: `Passive: ${pas.name}`,
        desc: pas.short + (evolves.length ? ` · Evolves: ${evolves.join(", ")}` : ""),
        apply: (w, p) => {
          pas.apply(p);
          p.passiveItems.push(pas.id);
        },
      });
    }
  }

  // Player stats (always available).
  candidates.push(
    {
      kind: "stat",
      title: "+10% Move Speed",
      desc: `${player.speed} → ${Math.round(player.speed * 1.1)}`,
      apply: (w, p) => {
        p.speed = Math.round(p.speed * 1.1);
      },
    },
    {
      kind: "stat",
      title: "+30 Pickup Radius",
      desc: `${player.pickupRadius} → ${player.pickupRadius + 30}`,
      apply: (w, p) => {
        p.pickupRadius += 30;
      },
    },
    {
      kind: "stat",
      title: "+25 Max HP",
      desc: `${player.maxHp} → ${player.maxHp + 25}`,
      apply: (w, p) => {
        p.maxHp += 25;
        p.hp = p.maxHp;
      },
    }
  );

  return sample(candidates, count);
}

function weaponUp(inst, label, desc, mutator) {
  // Surface the in-run level on every weapon card, and — when this pick would
  // max the weapon — the evolution recipe it unlocks.
  let levelNote = `Lv ${inst.level} → ${inst.level + 1}`;
  const evo = !inst.evolved && EVOLUTIONS[inst.id];
  if (evo && inst.level + 1 >= inst.maxLevel) {
    levelNote += ` (MAX) · Evolves with: ${passiveName(evo.requiresPassiveId)}`;
  }
  return {
    kind: "weapon",
    title: `${inst.name}: ${label}`,
    desc: `${desc} · ${levelNote}`,
    apply: (w) => w.upgradeWeapon(inst.id, mutator),
  };
}

function passiveName(id) {
  const p = PASSIVE_LIST.find((x) => x.id === id);
  return p ? p.name : id;
}

function toolBlurb(base) {
  const how =
    {
      nearestEnemy: "Seeks the nearest enemy",
      aroundPlayer: "Orbits around you",
      forwardSpread: "Fires a forward fan",
      randomBurst: "Sprays shots in all directions",
      aura: "Damaging field around you",
      mines: "Drops traps that detonate",
    }[base.weaponDef.fireBehavior] || "";
  return `${how} · ${base.weaponDef.damage} dmg`;
}

function round1(v) {
  return Math.round(v * 10) / 10;
}

// Fisher-Yates shuffle, take the first n.
function sample(arr, n) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0;
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a.slice(0, Math.min(n, a.length));
}

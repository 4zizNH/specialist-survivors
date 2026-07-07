# Game Build Prompt Pack
### A Vampire-Survivors-style game with an RPG twist (characters, leveling, rarity-locked tools)

This is a sequence of prompts. Feed them to your AI coding assistant **one at a time, in order**. After each one, run the game, confirm it works, and only then move to the next prompt. Each step builds on the previous step's code.

---

## How to use this pack

1. **Paste one prompt per turn.** Don't combine them — the whole point is to keep each step small enough to be implemented fully and tested.
2. **Keep the previous output.** The AI is building on the same codebase. Every prompt below tells it to preserve working features; don't let it rewrite things from scratch.
3. **Test after every step.** If something broke, fix it before continuing. A bug in step 4 gets much harder to find by step 11.
4. **Adjust freely.** These are starting points. Change numbers, names, and art direction to taste.

A note on the design: this game has **two layers**.
- **The Hub (meta layer):** pick a character, see your tool collection, equip tools, level characters up over time.
- **The Run (action layer):** the actual Vampire-Survivors gameplay — survive, auto-attack, collect XP, pick in-run upgrades, die, and bring rewards back to the hub.

Keep that split in mind; several prompts reference it.

---

## PROMPT 1 — Design doc & architecture (do this first, minimal code)

> I'm building a 2D top-down action-roguelite inspired by Vampire Survivors, with an RPG twist. Before writing gameplay code, produce a short design + technical plan I can reference for the rest of the build.
>
> **Game concept:** The player controls one character in a top-down arena, moving to dodge swarms of enemies. Weapons fire **automatically**. Killing enemies drops XP; collecting XP levels you up *within a run* and lets you pick upgrades. The twist: there's a **roster of characters** that **level up permanently across runs**, and you **collect "tools" (weapons) with rarities**. Each tool belongs to a **specialization category**, and a tool can only be equipped by a character whose specialization matches it.
>
> **Deliver:**
> 1. A one-page game design summary (core loop for a run, and the meta loop in the hub).
> 2. A tech stack recommendation. Default to **HTML5 Canvas + vanilla JavaScript (ES modules), no build step**, runnable via a simple local server. Keep it dependency-free.
> 3. A proposed file/folder structure with one-line descriptions of each module (e.g., `engine/`, `entities/`, `systems/`, `data/`, `ui/`, `state/`).
> 4. A list of the core systems we'll build and the order we'll build them in.
> 5. The data shapes (as commented JS/JSON) for: a **Character**, a **Tool**, and a **save file**. Leave fields as placeholders for now.
>
> Then scaffold the project: create the folders, an `index.html`, a `main.js` entry point, and a fixed-timestep **game loop** (`update(dt)` / `render()`) running at 60 FPS with a simple state machine for `MENU`, `PLAYING`, `PAUSED`, `GAMEOVER`. Render a blank canvas that fills the window and prints the current state name. Don't build gameplay yet.
>
> **Done when:** opening the page shows a full-window canvas, a steady loop is running, and the file structure from the plan exists.

---

## PROMPT 2 — Player movement & camera

> Build the player and a scrolling world. Preserve the existing loop and state machine.
>
> - Add a **Player** entity with position, velocity, speed, and a placeholder sprite (a colored shape is fine for now).
> - **Top-down 8-directional movement** with WASD and arrow keys. Normalize diagonal speed.
> - The **world is larger than the screen**. Add a **camera that follows the player**, keeping them centered.
> - Draw a tiled or grid background so motion is visibly readable.
> - Enter the `PLAYING` state from `MENU` on a key press for now.
>
> **Done when:** I can move the player smoothly around a world bigger than the viewport, with the camera tracking them and the background scrolling.

---

## PROMPT 3 — Enemies that swarm

> Add an enemy system. Preserve all existing features.
>
> - An **Enemy** entity with HP, speed, contact damage, and a placeholder sprite.
> - A **spawner** that spawns enemies **off-screen around the player** at a steady rate, so they're always closing in.
> - Enemies **move toward the player** each frame (simple seek/steering). Add light separation so they don't perfectly stack.
> - Enemy ↔ player **contact damage** (just log it for now — health comes later).
> - Use an **object pool** for enemies to keep performance stable as counts grow into the hundreds.
> - Add 2 basic enemy archetypes that differ in speed and HP.
>
> **Done when:** enemies continuously spawn around me and chase me, and I can outrun or get surrounded by them.

---

## PROMPT 4 — Auto-attacking weapons (the core VS mechanic)

> Build the automatic weapon system. This is the heart of the game, so make it **data-driven** — later we'll plug "tools" into it. Preserve existing features.
>
> - A **weapon definition** is data: name, damage, cooldown, projectile speed, count, area/size, pierce, and a `fireBehavior` (e.g., `nearestEnemy`, `aroundPlayer`, `forwardSpread`).
> - A **WeaponInstance** tracks its own cooldown and **fires automatically** with no player input.
> - Add a **projectile** system with movement, **collision against enemies**, damage application, and **pierce/lifetime**.
> - Implement at least 2 distinct fire behaviors (e.g., a projectile that flies at the nearest enemy, and a rotating orbital).
> - Show floating **damage numbers** on hits and remove enemies at 0 HP.
> - The player starts with one weapon for now.
>
> **Done when:** my weapon fires on its own, kills enemies, and I can add a second weapon by adding one data object — no new logic required.

---

## PROMPT 5 — XP, pickups, and in-run level-ups

> Add the in-run progression loop. Preserve existing features.
>
> - Enemies **drop XP gems** on death (gem value scales with enemy type).
> - The player has a **pickup radius**; gems within it **magnet toward the player** and are collected on contact.
> - An **XP bar** and **level counter**. Crossing the XP threshold triggers a level-up (threshold grows each level).
> - On level-up, **pause the game and show an upgrade screen**: present **3 randomly chosen options**, player picks one. Options can: add a new weapon, upgrade an existing weapon (damage/cooldown/count/area), or boost a player stat (move speed, pickup radius, max HP).
> - Resume after the pick. Support leveling up multiple times if enough XP was banked.
>
> **Done when:** killing enemies fills my XP bar, and leveling up lets me choose from 3 upgrades that visibly change my power.

---

## PROMPT 6 — Health, death, timer, and difficulty scaling

> Add survival stakes and pacing. Preserve existing features.
>
> - Give the player **max HP, current HP, and optional regen**. Contact damage now actually hurts; add brief **invulnerability frames** after a hit.
> - At 0 HP → transition to `GAMEOVER` with a results screen (time survived, level reached, kills).
> - Add a visible **run timer**.
> - **Difficulty scales with time:** spawn rate rises, enemy HP/damage ramps, and **new enemy types unlock at time thresholds**. Spawn a **mini-boss** every few minutes (high HP, special movement).
> - Add a HUD showing HP, timer, level, and kill count.
>
> **Done when:** runs have a real arc — they start easy, get overwhelming, and end in a death screen with stats.

---

## PROMPT 7 — Character roster & permanent character levels (RPG layer begins)

> Introduce the **character roster** and meta-progression. This is where the RPG twist starts. Preserve all run gameplay.
>
> - Define a **Character** data model. Example shape:
>   ```js
>   {
>     id: "ember_knight",
>     name: "Ember Knight",
>     specialization: "blades",        // the tool category this character can use
>     level: 1,                        // PERSISTENT, grows across runs
>     xp: 0,
>     baseStats: { maxHp: 100, moveSpeed: 1.0, might: 1.0, pickupRadius: 1.0, cooldown: 1.0 },
>     statGrowthPerLevel: { maxHp: 8, might: 0.03 },
>     startingToolId: null,
>     portrait: "..."                  // placeholder ok
>   }
>   ```
> - Create **4 characters**, each with a **different `specialization`** (e.g., `blades`, `guns`, `arcane`, `nature`) and distinct base stats so they feel different to play.
> - Build a **Character Select screen** in the hub: browse the roster, see each character's stats, specialization, and level, and choose who to play a run with. The chosen character's base stats feed into the run.
> - Add a **persistence layer** (localStorage): save and load a profile. Characters and their levels persist between sessions.
> - For now, characters gain **character XP** at the end of a run based on time survived; show their level rising in the hub.
>
> **Done when:** I can pick a character from a hub, play a run, return, and see that character's permanent level go up — and it survives a page reload.

---

## PROMPT 8 — Tools, rarities, and the specialization lock

> Build the **tool/weapon collection system with rarities** and enforce the specialization rule. Preserve everything.
>
> - Define a **Tool** data model. Example shape:
>   ```js
>   {
>     id: "flame_saber_r3_a91",
>     baseId: "flame_saber",
>     name: "Flame Saber",
>     category: "blades",              // MUST match a character's specialization to be equippable
>     rarity: "rare",                  // common | uncommon | rare | epic | legendary
>     weaponDef: { /* the data-driven weapon stats from Prompt 4 */ },
>     rarityMultipliers: { damage: 1.4, cooldown: 0.9, area: 1.2 } // applied on top of base
>   }
>   ```
> - Define the **5 rarities** with ascending stat multipliers and distinct **colors** (use these colors consistently in all UI).
> - **Enforce the core rule:** a tool can only be **equipped by a character whose `specialization === tool.category`**. The UI must clearly show locked/incompatible tools and explain *why* (e.g., greyed out + "Requires a Blades specialist").
> - Add a **Collection / Inventory** screen: list owned tools, filter by category and rarity, color-coded by rarity, with a tooltip showing full stats.
> - Add an **Equip screen per character**: show only **compatible** tools, let the player equip up to N tools (e.g., start the run with 1, allow more slots later), and persist the loadout to the save file.
>
> **Done when:** I own a set of tools of varying rarity, the inventory shows them color-coded, and I can equip a tool to a matching character but am blocked from equipping it to a non-matching one.

---

## PROMPT 9 — Tools drive the run

> Wire equipped tools into actual gameplay. Preserve everything.
>
> - When a run starts, the character's **equipped tool(s)** become their **starting weapon(s)**, using each tool's `weaponDef` with its **rarity multipliers applied**. A Legendary Flame Saber should noticeably outperform a Common one.
> - The **in-run level-up upgrade pool** should be **scoped to the character**: offer upgrades for their equipped tools, plus generic stat upgrades, plus tools **within their specialization** they could discover mid-run. Don't offer weapons from other categories.
> - Make sure character `baseStats` (might, cooldown, etc.) correctly modify the equipped tools' performance during the run.
>
> **Done when:** the character I picked starts the run wielding the exact tool(s) I equipped, rarity visibly changes power, and level-up choices respect their specialization.

---

## PROMPT 10 — End-of-run rewards & the hub loop

> Close the meta loop so runs feed progression. Preserve everything.
>
> - On run end, grant rewards based on performance (time, kills, level, boss kills):
>   - **Character XP** (toward permanent level).
>   - A soft **currency**.
>   - A chance to **drop a new tool**, with a **rarity roll** (longer/better runs improve the odds of higher rarities). Show a satisfying reward screen revealing drops.
> - New tools are added to the **collection** (Prompt 8) and persist.
> - Build a proper **Hub / Main Menu** that ties it together: Play (→ character select → equip → start run), Collection, Roster. Returning from a run lands back in the hub with rewards applied.
> - Make the **save file** authoritative for: characters + levels, owned tools, equipped loadouts, currency, and settings. Save on every meaningful change.
>
> **Done when:** a full cycle works end to end — hub → pick & equip → run → die → collect rewards → see character level + new tools in the hub, all persisted.

---

## PROMPT 11 — Content pass (make it a real game, not a demo)

> Expand the content so the game has depth. Preserve all systems and balance as you go.
>
> - **Characters:** flesh the roster out to ~6, across the categories. Give each a small identity (a passive bonus or starting tendency) so they play differently.
> - **Tools:** create a roster of base tools **per category** (aim for 4–6 each), each with a distinct `fireBehavior`, so collecting feels varied. Every base tool can roll any rarity.
> - **Enemies:** add several archetypes (fast/weak, slow/tanky, ranged, splitter) and at least one real **boss** with phases.
> - **Run pacing:** define what unlocks at which minute so a run has a satisfying difficulty curve from minute 0 to ~15.
> - Provide a short **balance table** (a data file) for tool stats, rarity multipliers, and enemy scaling so I can tune numbers in one place.
>
> **Done when:** I have multiple meaningfully different characters and a varied pool of collectible tools, and runs stay interesting for 10+ minutes.

---

## PROMPT 12 — UI/UX polish

> Polish the interface across hub and run. Don't change gameplay logic.
>
> - Clean, readable **HUD**: HP bar, XP bar, timer, level, kill count, and equipped-tool icons.
> - **Tooltips everywhere** in menus, showing rarity (with its color), category, full stats, and which character can use a tool.
> - A real **pause menu** (resume, restart, quit to hub) and a **settings** panel (volume, key bindings).
> - Smooth **screen transitions** between hub, character select, equip, run, and results.
> - Make rarity color-coding **consistent** across collection, equip, tooltips, and drop reveals.
>
> **Done when:** every screen is legible and self-explanatory, and rarity/specialization are obvious at a glance.

---

## PROMPT 13 — Game feel / juice & performance

> Add polish that makes it feel good, and keep it fast. Preserve gameplay.
>
> - **Hit feedback:** enemy flash on hit, knockback, particle bursts on death, and a snappy **level-up flash/fanfare**.
> - **Screen shake** on big hits / boss spawns (keep it tasteful).
> - **Audio:** sound effects for firing, hits, pickups, level-up, death; background music with a volume control.
> - **XP gem** collection feedback (trail + pop).
> - **Performance:** confirm object pooling for enemies, projectiles, gems, and particles; cull off-screen entities from rendering; keep a steady 60 FPS with hundreds of enemies on screen. Add a small on-screen FPS/entity counter behind a debug toggle.
>
> **Done when:** combat feels punchy, the audio reinforces it, and the frame rate holds steady under a full swarm.

---

## PROMPT 14 — Final balance, save safety, and optional meta-shop

> Final pass. Preserve everything; focus on robustness and tuning.
>
> - **Balance pass:** tune the data tables so early game is approachable and late game is intense; make sure no single tool/character is strictly dominant, and that rarity feels impactful but not mandatory.
> - **Save robustness:** version the save file, handle missing/corrupt saves gracefully, and add a **"reset progress"** option with a confirmation.
> - *(Optional)* A **meta-upgrade shop** in the hub that spends the soft currency on permanent account-wide bonuses (e.g., extra starting tool slot, +5% global might, better rarity odds).
> - *(Optional)* **Difficulty modes** that change scaling and reward multipliers.
> - Write a short **README**: how to run it, the controls, and how to add a new character or tool by editing the data files.
>
> **Done when:** the game is tunable from data files, saves can't soft-lock me, and a new player can go from hub to a satisfying run without confusion.

---

## PROMPT 15 — Tool fusion (combine duplicates to raise rarity)

> Add a **tool fusion system** to the hub: combining duplicate tools produces a higher-rarity version. Preserve all existing systems, especially the collection, equip screens, and save file.
>
> **Rules:**
> - Fusion requires **N copies of the same `baseId` at the same rarity** (default N = 3; put this in the balance data file so it's tunable per rarity).
> - Fusing consumes the copies and produces **1 copy of the same base tool at the next rarity up** (3× Common Flame Saber → 1× Uncommon Flame Saber).
> - **Legendary is the cap** — Legendary tools cannot be fused further; the UI should say so rather than hiding them.
> - Tools that are currently **equipped** on a character either can't be selected as fusion material, or the UI clearly warns and unequips them on confirm — pick one behavior and be consistent.
> - Optionally charge a small amount of the soft currency per fusion, scaling with target rarity (put the costs in the balance file).
>
> **Build:**
> - A **Fusion screen** in the hub: group the collection by `baseId` + rarity, show stack counts (e.g., "Flame Saber ×4 Common"), highlight fusable stacks, and show a **before/after stat preview** using the rarity multipliers so the player sees exactly what they'll gain.
> - A confirm dialog (fusion is destructive), then a short **reveal animation** consistent with the drop-reveal style from Prompt 10, showing the new higher-rarity tool.
> - To make this matter, change end-of-run drops so **duplicate `baseId` drops are common** — duplicates should now feel like fusion progress, not dead loot. Surface stack counts in the Collection screen too.
> - Update the **save file** (and bump its version per Prompt 14) to store tool stacks/counts correctly.
>
> **Done when:** I can take 3 identical Commons into the fusion screen, preview the Uncommon result, confirm, watch the reveal, and see the new tool in my collection — with the duplicates gone and everything persisted after reload.

---

## PROMPT 16 — Evolved weapons (maxed tool + specific passive = transformation)

> Add **weapon evolution**: during a run, a tool that reaches its **max in-run level** while the character holds a **specific matching passive item** can transform into a powerful evolved form. This is the classic Vampire Survivors endgame hook. Preserve all systems.
>
> **Prerequisites to build first (if not present):**
> - **In-run weapon levels:** each equipped tool has an in-run level (e.g., 1–8) raised via the Prompt 5 level-up choices. Track and display it.
> - **Passive items:** a new pickable category in the level-up pool (e.g., Whetstone, Focus Crystal, Growth Charm) that grant passive stat boosts. Show owned passives in the HUD. Cap passive slots (e.g., 4).
>
> **Evolution rules (data-driven, in the balance/data files):**
> - Each **base tool** defines an optional `evolution` entry: `{ requiresPassiveId, evolvedWeaponDef, evolvedName, evolvedVisuals }`. Example: Flame Saber (max) + Whetstone → **Inferno Edge** (bigger arc, burning damage-over-time).
> - Trigger: when a tool is at max in-run level AND the required passive is held, the **next mini-boss/elite kill** drops an **evolution chest**; opening it plays a dramatic reveal and replaces the weapon with its evolved form for the rest of the run.
> - Evolved forms should be **significantly stronger and mechanically distinct** (new or modified `fireBehavior`), not just bigger numbers.
> - Evolution is **per-run** — the collection still stores the base tool. But record a persistent flag `evolutionsSeen` in the save so discovered evolutions show in the Collection as unlocked lore/recipe entries; undiscovered ones display as "???" hints.
>
> **UX:**
> - In the level-up screen and pause menu, show each weapon's level and a subtle indicator when an evolution is possible or one passive away (e.g., "Evolves with: Whetstone").
> - Define at least **one evolution per specialization category** (4+ total) so every character has a build to chase.
>
> **Done when:** I can max a tool, grab its matching passive, kill an elite, open the chest, and watch my weapon transform into a visibly and mechanically upgraded form — and afterwards the recipe shows as discovered in my collection.

---

## PROMPT 17 — Achievements & unlocks (gate new characters behind milestones)

> Add an **achievements system** where milestones unlock rewards — most importantly, **new playable characters**. Preserve everything.
>
> **Framework:**
> - A data-driven **achievement definition** list: `{ id, name, description, condition, reward, hidden? }`. Conditions should be expressed as checks against a **stats-tracking layer** you'll add: lifetime kills, runs completed, minutes survived (best and total), bosses killed, tools collected per rarity, evolutions discovered, character levels, fusions performed, etc. Track these persistently in the save file.
> - Evaluate conditions at natural checkpoints (end of run, on fusion, on evolution, on level-up) rather than every frame.
>
> **Character gating:**
> - Change the roster so only **2–3 characters are unlocked by default**; the rest are **locked behind specific achievements**, and each locked character's card in Character Select shows a silhouette + the exact unlock requirement (e.g., "Survive 15 minutes with a Blades specialist", "Fuse your first Epic tool", "Discover 2 evolutions"). No mystery-box frustration — requirements are always visible unless the achievement is explicitly `hidden`.
> - Make the unlock conditions **teach the game's systems**: at least one tied to survival time, one to fusion, one to evolution, and one to collection breadth.
> - Other reward types to support: soft currency grants and cosmetic titles (cheap to add, nice to have).
>
> **UX:**
> - An **Achievements screen** in the hub: list with progress bars (e.g., 7/10 bosses), completed vs. in-progress sections, and hidden achievements shown as "???".
> - A **toast notification** when an achievement unlocks — both mid-run (non-blocking, small banner) and on the results screen (with a callout if a character was unlocked).
> - On the results screen, if a new character unlocked, show a prominent reveal and a shortcut to try them.
> - Persist all of it; bump the save version and migrate older saves gracefully (older saves should auto-unlock the default characters and grant any achievements their stats already satisfy).
>
> **Done when:** a fresh profile starts with a partial roster, I can see exactly what each locked character needs, hitting a milestone pops a toast and unlocks them, and my achievement progress survives reloads and old-save migration.

---

## PROMPT 18 — Controller/gamepad support & mobile touch controls

> Add full input-device support: gamepads on desktop and touch controls on mobile. Preserve all gameplay and UI behavior for keyboard/mouse users.
>
> **Architecture first:**
> - Refactor input into a single **input abstraction layer**: gameplay and menus read *actions* (`moveVector`, `confirm`, `cancel`, `pause`, `navigate`) — never raw keys, buttons, or touches. Keyboard, gamepad, and touch are three backends feeding the same actions. This keeps every later system input-agnostic.
> - Detect the **active input method** from the most recent input and switch UI hints accordingly (show "Press A" vs "Press Enter" vs a tap icon).
>
> **Gamepad (Gamepad API):**
> - **Left stick / d-pad** = movement (analog stick gives analog speed, with a proper dead zone — make the dead-zone value tunable in the data files).
> - Map confirm/cancel/pause to standard face buttons; support **menu navigation** with stick/d-pad + confirm in every screen (hub, character select, equip, fusion, level-up choices, pause, results). Add a visible **focus highlight** so the selected element is always obvious.
> - Handle **connect/disconnect** gracefully: pause the game and show a "controller disconnected" overlay if the active pad drops mid-run.
>
> **Touch (mobile):**
> - A **floating virtual joystick**: touch anywhere on the lower-left region to spawn the stick under the finger; drag to move. Since weapons auto-fire, movement is the only in-run input — keep it to one thumb.
> - Make all menus **tap-friendly**: minimum ~44px touch targets, no hover-dependent tooltips (tap to toggle tooltip instead), and larger level-up choice cards on small screens.
> - Add **responsive canvas scaling** for phone aspect ratios and handle `devicePixelRatio` so it's crisp on high-DPI screens. Prevent default browser gestures (pull-to-refresh, double-tap zoom) during play.
>
> **Done when:** I can play a full loop (hub → equip → run → results) start-to-finish using only a gamepad, and separately using only touch on a phone-sized screen, with correct button/tap hints shown for whichever device I'm using.

---

## PROMPT 19 — Automated headless playtests for balance

> Build a **headless simulation harness** that plays runs automatically with no rendering, so I can test balance numerically. This must not change gameplay — it reuses the real game systems.
>
> **Architecture:**
> - The key requirement: the **simulation must run the real `update(dt)` code** — the same spawner, weapons, XP, scaling, and enemy logic as the live game. Refactor if needed so all game logic is renderer-free and the renderer is a thin layer on top (if Prompt 1's structure held, this should be small). Any divergence between sim and game makes the results worthless, so call out and fix any logic currently living in render code.
> - Create a **headless runner** (Node script, e.g. `npm run simulate`) that steps the game loop at fixed dt as fast as possible — no real-time waiting, no canvas.
> - Add a **bot player policy** (pluggable): default bot kites away from the nearest enemy-density centroid and drifts toward XP gems. On level-up, picks upgrades by a simple strategy (configurable: random / always-damage / balanced). It won't play like a human — that's fine; it's a consistent yardstick.
>
> **Determinism:**
> - Route ALL randomness (spawns, drops, upgrade choices, rarity rolls, crits) through a single **seeded RNG** instead of `Math.random()`. Same seed + same config ⇒ identical run. This is essential here and will be reused by Prompt 20.
>
> **The test suite:**
> - A config file defines **scenarios**: character × loadout (tool + rarity) × bot strategy × seed count (e.g., 50 seeds each).
> - Per run, record: survival time, level reached, kills, damage dealt/taken, time-to-first-death-threat, XP curve over time.
> - Output a **summary report** (console table + JSON/CSV): mean/median survival per scenario, flagging balance smells against tunable thresholds — e.g., a character whose median survival deviates >25% from the roster average, a tool that outperforms its category baseline, a rarity tier that changes survival by less than 5% (rarity feels pointless) or more than 60% (mandatory).
> - Add 2–3 **regression assertions** that can fail CI-style (e.g., "default character with a Common starter survives at least 4 minutes at median" / "no tool's mean damage exceeds 3× category average"), so balance breakage from future prompts is caught automatically.
> - Keep it fast: a 15-minute game run should simulate in seconds. Report total sim throughput.
>
> **Done when:** one command simulates dozens of seeded runs across characters and tools in under a couple of minutes, prints a comparison table, flags outliers against the thresholds, and re-running with the same seeds gives identical numbers.

---

## PROMPT 20 — Seeded daily challenge with a local leaderboard

> Add a **Daily Challenge mode**: everyone playing on a given date gets the identical seeded run under fixed rules, with a local leaderboard tracking results. Preserve the normal mode untouched.
>
> **Prerequisite:** this reuses the **seeded RNG** from Prompt 19 (build that first, or at minimum implement the seeded-RNG refactor from it).
>
> **The daily run:**
> - The seed derives deterministically from the **UTC date** (e.g., hash of `"YYYY-MM-DD"` + a game-version salt), so all players on the same day share identical spawn patterns, drop rolls, and upgrade offers.
> - **Fixed rules for fairness:** the daily prescribes the character and a standardized loadout (derived from the seed — e.g., "today: the Arcane specialist with a Rare starting tool"), ignoring the player's personal roster levels and collection. Character permanent-level bonuses are **disabled** in daily mode so the leaderboard measures play, not grind. State this clearly on the daily screen.
> - **One scored attempt per day** per profile (allow unscored practice retries, clearly labeled). Attempt state must survive refresh mid-run — no re-rolling a bad start by reloading.
> - **Score** = a transparent formula from time survived, kills, level, and boss kills; show the breakdown on the results screen.
> - Daily runs still grant normal end-of-run rewards (XP/currency/drops) so playing it never feels like a detour — but rewards don't affect the daily's fairness since meta bonuses are off.
>
> **Leaderboard (local):**
> - Store per-date entries locally: profile name, score, breakdown, and the seed. Show today's board plus a browsable history of past dates; highlight personal bests and streaks (consecutive days played).
> - Add an **export/import** of a result as a compact code (date + seed + score + a simple checksum) so friends can share and manually compare — an honest stand-in for a server backend. Note in code comments where a real backend would slot in later.
>
> **UX:**
> - A **Daily Challenge card** in the hub: today's date, the prescribed character/loadout, your attempt status (not played / score), and a countdown to the next daily (UTC rollover).
> - On the results screen for a daily: score breakdown, today's rank locally, and the share-code button.
>
> **Done when:** two different profiles playing today's daily get identical spawns and drops, my score lands on today's local leaderboard with a breakdown, I can't re-roll my scored attempt, and tomorrow the challenge rolls over to a new seed automatically.

---

### Tip
If the AI ever starts rewriting working code or drifting from the architecture from Prompt 1, paste this reminder: *"Preserve all existing, working features. Build only what this step asks, follow the file structure and data shapes from the design doc, and tell me exactly which files you changed."*

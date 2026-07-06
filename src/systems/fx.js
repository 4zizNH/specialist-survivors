// systems/fx.js
// Juice orchestrator: one object the game systems call with named events
// (onEnemyDeath, onGemCollect, ...) that fans out to particles, screen shake,
// the level-up flash, and audio. Keeps feel concerns out of gameplay code.
//
// Shake is trauma-based: events add trauma, offset = trauma² × max — small
// hits barely register, big moments thump, and it decays fast (tasteful).

import { createParticles } from "../engine/particles.js";
import { createAudio } from "../engine/audio.js";

const MAX_SHAKE = 13; // px at full trauma
const TRAUMA_DECAY = 2.4; // per second
const FLASH_DECAY = 2.6; // per second

export function createFx(getVolume) {
  const particles = createParticles();
  const audio = createAudio(getVolume);
  let trauma = 0;
  let flash = 0;

  return {
    particles,

    update(dt) {
      particles.update(dt);
      trauma = Math.max(0, trauma - TRAUMA_DECAY * dt);
      flash = Math.max(0, flash - FLASH_DECAY * dt);
    },

    addShake(amount) {
      trauma = Math.min(1, trauma + amount);
    },

    // Random offset to add to the camera this frame.
    get shakeOffset() {
      const t = trauma * trauma;
      if (t < 0.001) return { x: 0, y: 0 };
      const m = MAX_SHAKE * t;
      return { x: (Math.random() * 2 - 1) * m, y: (Math.random() * 2 - 1) * m };
    },

    // 0..~0.6 screen-flash alpha (level-up fanfare).
    get flash() {
      return flash;
    },

    setVolume(v) {
      audio.setVolume(v);
    },

    // --- Game events -------------------------------------------------------
    onFire() {
      audio.sfx.fire();
    },
    onEnemyHit() {
      audio.sfx.hit();
    },
    onEnemyDeath(x, y, color, isBoss) {
      particles.burst(x, y, color, isBoss ? 42 : 8, isBoss ? 260 : 130, isBoss ? 0.8 : 0.45, isBoss ? 4 : 3);
      audio.sfx.kill();
      if (isBoss) this.addShake(0.55);
    },
    onGemCollect(x, y) {
      particles.burst(x, y, "#9df5bc", 5, 90, 0.3, 2.5);
      audio.sfx.pickup();
    },
    onGemTrail(x, y) {
      particles.spark(x, y, "#74f0a0");
    },
    onLevelUp(player) {
      flash = 0.55;
      particles.ring(player.x, player.y, "#ffd34d");
      audio.sfx.levelup();
    },
    onPlayerHit(damage) {
      audio.sfx.hurt();
      if (damage >= 15) this.addShake(0.3);
    },
    onPlayerDeath() {
      this.addShake(0.8);
      audio.sfx.death();
    },
    onBossSpawn() {
      this.addShake(0.5);
      audio.sfx.bossSpawn();
    },
    // Evolved-weapon shell detonation.
    onExplosion(x, y, color) {
      particles.burst(x, y, color, 18, 220, 0.5, 3.5);
      audio.sfx.hit();
      this.addShake(0.12);
    },
    // Weapon-evolution reveal fanfare.
    onEvolution(player) {
      flash = 0.6;
      particles.ring(player.x, player.y, "#ffd34d");
      particles.burst(player.x, player.y, "#ffd34d", 30, 240, 0.7, 4);
      audio.sfx.levelup();
      this.addShake(0.45);
    },

    reset() {
      particles.reset();
      trauma = 0;
      flash = 0;
    },
  };
}

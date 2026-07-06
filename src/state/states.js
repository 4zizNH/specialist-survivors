// state/states.js
// Top-level game-flow states. (Not to be confused with meta/ progression.)

export const GameState = Object.freeze({
  HUB: "HUB", // main menu — Play / Collection / Roster
  MENU: "MENU", // character select (reached via Play/Roster)
  COLLECTION: "COLLECTION", // tool inventory
  EQUIP: "EQUIP", // equip tools to the selected character
  SHOP: "SHOP", // meta-upgrade shop (spend gold)
  FUSION: "FUSION", // combine duplicate tools into higher rarities
  ACHIEVEMENTS: "ACHIEVEMENTS", // milestones, rewards, roster unlocks
  PLAYING: "PLAYING", // an active run in the arena
  PAUSED: "PAUSED", // run frozen, overlay shown
  LEVELUP: "LEVELUP", // run frozen, upgrade draft shown
  EVOLUTION: "EVOLUTION", // run frozen, weapon-evolution reveal shown
  GAMEOVER: "GAMEOVER", // run ended — reward reveal
});

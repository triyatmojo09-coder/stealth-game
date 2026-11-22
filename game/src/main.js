// SHADOW PROTOCOL — entry point.
// One job: wire the canvas, input, game and renderer together, run the frame
// loop, and expose the hooks the maker uses to play-test and photograph it:
//   window.__game        the live Game (state, level, player, guards)
//   window.__stageShot() place the game in a staged scene for a screenshot

import { TILE, VIEW_W, VIEW_H } from './config.js';
import { Input } from './input.js';
import { Game } from './game.js';
import { Renderer } from './render.js';

const canvas = document.getElementById('game');
canvas.width = VIEW_W;
canvas.height = VIEW_H;

const game = new Game(canvas);
const renderer = new Renderer(game);
const input = new Input(canvas, () => game.sound.unlock());
game.input = input;

let last = performance.now();
let frames = 0;

// Hold the first frames until the bundled display and UI fonts are in, so
// no screenshot or first paint ever falls back to a system face.
const fontsReady = Promise.all([
  document.fonts.load("76px 'Black Ops One'"),
  document.fonts.load("700 16px 'Rajdhani'"),
  document.fonts.load("600 14px 'Rajdhani'"),
  document.fonts.load("500 14px 'Rajdhani'"),
]).then(() => {
  window.__fontsReady = true;
});

function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  game.update(dt, input);
  renderer.render();
  input.endFrame();
  frames += 1;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---- maker hooks (used by the play-test and screenshot scripts) ----
// Positions are tile columns and the row of the floor the figure stands on.

function stagePlayer(tx, floorRow, crouch) {
  game.player.x = (tx + 0.5) * TILE;
  game.player.y = floorRow * TILE;
  game.player.vy = 0;
  game.player.forceCrouch = !!crouch;
  if (crouch) game.player.crouching = true;
}

function stageGuard(index, tx, facing) {
  const gd = game.level.guards[index];
  gd.x = (tx + 0.5) * TILE;
  gd.facing = facing;
  gd.state = 'patrol';
  gd.meter = 0;
  gd.pauseTimer = 999; // hold still for the photograph
  return gd;
}

window.__game = game;

window.__stageShot = function (name) {
  if (name === 'cover') {
    // Level 1, ground floor: the operative crouches in the dark alcove
    // while a guard's cone rakes down the corridor toward him and the
    // camera watches from the mezzanine edge.
    game.startLevel(0, true);
    stagePlayer(11, 20, true);
    game.player.facing = 1;
    stageGuard(1, 16, -1);
    const cam = game.level.cameras[0];
    cam.phase = -0.4;
    cam.speed = 0;
    game.setMessage('In the dark the cone slides past — stay low, stay patient.', 6);
  } else if (name === 'vault') {
    // Level 2, vault floor: keycard in hand, the operative times the
    // laser grid while the vault guard patrols beyond the door.
    game.startLevel(1, true);
    game.player.hasKeycard = true;
    game.level.keycard.taken = true;
    stagePlayer(25, 13, true);
    game.player.facing = 1;
    stageGuard(2, 36, -1);
    const cam = game.level.cameras[1];
    cam.phase = 0.4;
    cam.speed = 0;
    game.setMessage('Laser grid ahead — cross while it blinks off.', 6);
  } else if (name === 'core') {
    // Level 3, core floor: crouched in the dark alcove behind the rack —
    // the core guard's cone stops dead at the rack — by the intel.
    game.startLevel(2, true);
    stagePlayer(35, 13, true);
    game.player.facing = -1;
    const gd = stageGuard(2, 31, 1);
    gd.meter = 0.3;
    const cam = game.level.cameras[2];
    cam.phase = 0.5;
    cam.speed = 0;
    game.setMessage('The core. Ghost it — never be spotted.', 6);
  } else if (name === 'grade') {
    // Level 1, finished clean: the grade screen after a ghost run.
    game.startLevel(0, true);
    game.player.hasIntel = true;
    game.level.intel.taken = true;
    game.player.x = (37 + 0.5) * TILE;
    game.player.y = 20 * TILE;
  }
  return game.state;
};

window.__frames = () => frames;

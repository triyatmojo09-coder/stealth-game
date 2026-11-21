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

function tileCenter(tx, ty) {
  return { x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE };
}

function stagePlayer(tx, ty, sneak) {
  const p = tileCenter(tx, ty);
  game.player.x = p.x;
  game.player.y = p.y;
  game.player.forceSneak = !!sneak;
  if (sneak) game.player.sneaking = true;
}

function stageGuard(index, tx, ty, angleDegrees) {
  const gd = game.level.guards[index];
  const p = tileCenter(tx, ty);
  gd.x = p.x;
  gd.y = p.y;
  gd.angle = (angleDegrees * Math.PI) / 180;
  gd.waypoint = 0;
  gd.pauseTimer = 999; // hold still for the photograph
  return gd;
}

window.__game = game;

window.__stageShot = function (name) {
  if (name === 'cover') {
    // Level 1, mid-infiltration: the player crouches in the dark intel room
    // just below a guard's sweeping cone; the intel glints top-right.
    game.startLevel(0);
    stagePlayer(31, 4, true);
    const gd = stageGuard(0, 28, 4, -45);
    gd.meter = 0.45;
    gd.state = 'patrol';
    game.player.angle = 0;
    game.setMessage('Stay in the dark — the cone cannot see you here.', 6);
  } else if (name === 'vault') {
    // Level 2: the player, keycard in hand, times the laser grid in front
    // of the vault while a guard patrols the far side and a camera sweeps.
    game.startLevel(1);
    game.player.hasKeycard = true;
    game.level.keycard.taken = true;
    stagePlayer(32, 3, true);
    game.player.angle = Math.PI / 2;
    stageGuard(2, 35, 8, -90);
    game.level.cameras[1].phase = 0.6;
    game.setMessage('Laser grid ahead — cross while it blinks off.', 6);
  } else if (name === 'core') {
    // Level 3: the player slips past the core's laser wall as two guards
    // and a camera work the room around them.
    game.startLevel(2);
    stagePlayer(16, 13, true);
    game.player.angle = Math.PI;
    stageGuard(0, 17, 5, 90);
    stageGuard(2, 30, 16, 180);
    game.level.cameras[1].phase = 0.3;
    game.setMessage('The core. Ghost it — never be spotted.', 6);
  } else if (name === 'grade') {
    // Level 1, finished clean: the grade screen after a ghost run.
    game.startLevel(0);
    game.player.hasIntel = true;
    game.level.intel.taken = true;
    const e = tileCenter(37, 19);
    game.player.x = e.x;
    game.player.y = e.y;
  }
  return game.state;
};

window.__frames = () => frames;

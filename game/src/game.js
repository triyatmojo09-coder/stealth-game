// SHADOW PROTOCOL — the game itself.
// One job: own the state machine (title / playing / paused / caught /
// complete / victory), load a level from its definition, and run one frame:
// player, guards, cameras, lasers, coins, pickups, alarm and objectives.

import { TILE, TUNING, PAR_TIMES } from './config.js';
import { LEVELS, findTiles } from './levels.js';
import { Guard, Camera } from './guards.js';
import { Player } from './player.js';
import { SoundFX } from './audio.js';
import { computeLevelScore, gradeFor } from './scoring.js';
import { loadProgress, saveProgress } from './storage.js';
import { pointToSegmentDistance } from './vision.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.sound = new SoundFX();
    this.progress = loadProgress();
    this.sound.muted = this.progress.muted;
    this.state = 'title';
    this.levelIndex = 0;
    this.level = null;
    this.player = null;
    this.thrownCoins = [];
    this.time = 0;
    this.stats = { detections: 0, takedowns: 0, coinsCollected: 0 };
    this.everSpotted = false;
    this.alarm = false;
    this.alarmFlash = 0;
    this.message = '';
    this.messageTimer = 0;
    this.result = null;
    this.totalScore = 0;
    this.buttons = [];
    this.laserCooldown = 0;
    this.caughtBy = null;
  }

  // ---- level loading ----

  loadLevel(index) {
    const def = LEVELS[index];
    this.levelIndex = index;
    const grid = def.map.map((row) => row.split(''));
    const at = (ch) => findTiles(def, ch)[0];
    const start = at('P');
    const intel = at('I');
    const exit = at('E');
    const keycard = findTiles(def, 'K')[0] || null;

    // Entity tiles become plain floor in the collision grid.
    grid.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell === 'P' || cell === 'I' || cell === 'E' || cell === 'K' || cell === 'o') {
          grid[y][x] = '.';
        }
      });
    });

    this.level = {
      def,
      grid,
      name: def.name,
      briefing: def.briefing,
      intel: intel ? { x: (intel.x + 0.5) * TILE, y: (intel.y + 0.5) * TILE, taken: false } : null,
      exit: exit ? { x: (exit.x + 0.5) * TILE, y: (exit.y + 0.5) * TILE } : null,
      keycard: keycard
        ? { x: (keycard.x + 0.5) * TILE, y: (keycard.y + 0.5) * TILE, taken: false }
        : null,
      coins: findTiles(def, 'o').map((t) => ({ x: (t.x + 0.5) * TILE, y: (t.y + 0.5) * TILE, taken: false })),
      guards: def.guards.map((g) => new Guard(g, { grid })),
      cameras: def.cameras.map((c) => new Camera(c)),
      lasers: def.lasers.map((l) => ({
        x1: (l.x1 + 0.5) * TILE,
        y1: (l.y1 + 0.5) * TILE,
        x2: (l.x2 + 0.5) * TILE,
        y2: (l.y2 + 0.5) * TILE,
        phase: l.phase || 0,
        active: true,
      })),
    };
    this.player = new Player((start.x + 0.5) * TILE, (start.y + 0.5) * TILE);
    this.thrownCoins = [];
    this.time = 0;
    this.stats = { detections: 0, takedowns: 0, coinsCollected: 0 };
    this.everSpotted = false;
    this.alarm = false;
    this.alarmFlash = 0;
    this.result = null;
    this.laserCooldown = 0;
    this.caughtBy = null;
    this.setMessage(def.briefing, 5);
  }

  get doorsOpen() {
    return this.player ? this.player.hasKeycard : false;
  }

  setMessage(text, seconds) {
    this.message = text;
    this.messageTimer = seconds || 3;
  }

  // ---- flow ----

  startLevel(index) {
    if (index >= LEVELS.length) return;
    this.loadLevel(index);
    this.state = 'playing';
  }

  retryLevel() {
    // A retry keeps the detections already earned: no farming a ghost grade.
    const keepDetections = this.stats.detections;
    const keepSpotted = this.everSpotted;
    this.loadLevel(this.levelIndex);
    this.stats.detections = keepDetections;
    this.everSpotted = keepSpotted;
    this.state = 'playing';
  }

  backToTitle() {
    this.state = 'title';
    this.level = null;
    this.player = null;
  }

  finishLevel() {
    const result = {
      timeSeconds: this.time,
      detections: this.stats.detections,
      takedowns: this.stats.takedowns,
      coinsCollected: this.stats.coinsCollected,
      ghost: !this.everSpotted,
    };
    const scored = computeLevelScore(this.levelIndex, result);
    const grade = gradeFor(this.levelIndex, result);
    this.result = { ...result, ...scored, grade };
    this.totalScore += scored.score;
    const idx = this.levelIndex;
    const prev = this.progress.grades[idx];
    if (!prev || gradeValue(grade) > gradeValue(prev)) this.progress.grades[idx] = grade;
    const best = this.progress.bestScores[idx] || 0;
    if (scored.score > best) this.progress.bestScores[idx] = scored.score;
    if (idx + 1 < LEVELS.length && this.progress.unlocked < idx + 2) {
      this.progress.unlocked = idx + 2;
    }
    saveProgress(this.progress);
    this.sound.win();
    this.state = this.levelIndex === LEVELS.length - 1 ? 'victory' : 'complete';
  }

  // ---- alarm ----

  triggerAlarm(x, y, reason) {
    this.alarm = true;
    this.alarmFlash = 1;
    this.everSpotted = true;
    this.stats.detections += 1;
    this.sound.alarm();
    this.setMessage(reason === 'laser' ? 'LASER TRIPPED — the guards are coming!' : 'SPOTTED — the guards are coming!', 3);
    for (const g of this.level.guards) g.raiseAlarm(x, y);
  }

  // ---- per-frame update ----

  update(dt, input) {
    if (this.messageTimer > 0) this.messageTimer -= dt;
    if (this.alarmFlash > 0) this.alarmFlash = Math.max(0, this.alarmFlash - dt * 1.5);
    if (this.laserCooldown > 0) this.laserCooldown -= dt;

    if (this.state === 'title') {
      this.updateTitle(input);
      return;
    }
    if (this.state === 'playing') {
      this.updatePlaying(dt, input);
      return;
    }
    if (this.state === 'paused') {
      if (input.wasPressed('Escape') || input.wasPressed('KeyP')) this.state = 'playing';
      if (input.wasPressed('KeyQ')) this.backToTitle();
      return;
    }
    if (this.state === 'caught') {
      this.handleClicks(input);
      if (input.wasPressed('Enter') || input.wasPressed('KeyR')) this.retryLevel();
      if (input.wasPressed('Escape')) this.backToTitle();
      return;
    }
    if (this.state === 'complete' || this.state === 'victory') {
      this.handleClicks(input);
      if (input.wasPressed('Enter') || input.wasPressed('Space')) {
        if (this.state === 'victory' || this.levelIndex + 1 >= LEVELS.length) this.backToTitle();
        else this.startLevel(this.levelIndex + 1);
      }
      if (input.wasPressed('Escape')) this.backToTitle();
    }
  }

  updateTitle(input) {
    // Number keys pick a level; Enter starts the first unlocked one.
    for (let i = 0; i < LEVELS.length; i++) {
      if (input.wasPressed('Digit' + (i + 1)) || input.wasPressed('Numpad' + (i + 1))) {
        if (i < this.progress.unlocked) this.startLevel(i);
      }
    }
    if (input.wasPressed('Enter') || input.wasPressed('Space')) {
      this.startLevel(Math.min(this.progress.unlocked - 1, LEVELS.length - 1));
    }
    if (input.wasPressed('KeyM')) this.toggleMute();
    this.handleClicks(input);
  }

  updatePlaying(dt, input) {
    if (input.wasPressed('Escape') || input.wasPressed('KeyP')) {
      this.state = 'paused';
      return;
    }
    if (input.wasPressed('KeyM')) this.toggleMute();

    this.time += dt;
    const level = this.level;
    const player = this.player;

    player.update(dt, input, level, this.doorsOpen, this.sound);

    // Throw a coin toward the mouse (Q, or a click on the playfield).
    if ((input.wasPressed('KeyQ') || input.clicked) && player.coins > 0) {
      const landing = player.throwCoin(input.mouseX, input.mouseY);
      if (landing) {
        this.thrownCoins.push({ x: landing.x, y: landing.y, ttl: TUNING.coinNoiseSeconds });
        this.sound.coin();
        for (const g of level.guards) {
          if (Math.hypot(g.x - landing.x, g.y - landing.y) <= TUNING.coinNoiseRadius * TILE) {
            g.hearNoise(landing.x, landing.y);
          }
        }
      }
    }

    // Rear takedown (E): only from behind, only while the guard is unaware.
    if (input.wasPressed('KeyE')) {
      let best = null;
      let bestDist = Infinity;
      for (const g of level.guards) {
        if (g.knocked || g.state === 'alarm') continue;
        const d = Math.hypot(g.x - player.x, g.y - player.y);
        if (d < bestDist && g.playerIsBehind(player)) {
          best = g;
          bestDist = d;
        }
      }
      if (best) {
        best.knockOut();
        this.stats.takedowns += 1;
        this.sound.takedown();
        this.setMessage('Guard taken down. Stay quiet.', 2);
      }
    }

    // Guards and cameras watch the player.
    for (const g of level.guards) {
      const wasAlarm = g.state === 'alarm';
      g.update(dt, player, this.doorsOpen);
      if (g.state === 'alarm' && !wasAlarm) {
        this.alarm = true;
        this.alarmFlash = 1;
        this.everSpotted = true;
        this.stats.detections += 1;
        this.sound.alert();
        this.setMessage('SPOTTED!', 2.5);
        for (const other of level.guards) {
          if (other !== g) other.raiseAlarm(player.x, player.y);
        }
      }
    }
    for (const cam of level.cameras) {
      const wasFull = cam.meter >= 1;
      cam.update(dt, player, level, this.doorsOpen);
      if (cam.meter >= 1 && !wasFull) {
        this.triggerAlarm(player.x, player.y, 'camera');
      }
    }

    // Lasers blink on a timer; crossing a live beam trips the alarm.
    for (const lz of level.lasers) {
      const cycle = TUNING.laserOnSeconds + TUNING.laserOffSeconds;
      lz.active = ((this.time + lz.phase) % cycle) < TUNING.laserOnSeconds;
      if (lz.active && this.laserCooldown <= 0) {
        const d = pointToSegmentDistance(player.x, player.y, lz.x1, lz.y1, lz.x2, lz.y2);
        if (d < TILE * 0.4) {
          this.laserCooldown = 2;
          this.triggerAlarm(player.x, player.y, 'laser');
        }
      }
    }

    // Thrown coins fade out.
    for (const c of this.thrownCoins) c.ttl -= dt;
    this.thrownCoins = this.thrownCoins.filter((c) => c.ttl > 0);

    // Pickups: keycard, coins, intel.
    if (level.keycard && !level.keycard.taken) {
      if (Math.hypot(player.x - level.keycard.x, player.y - level.keycard.y) < TILE * 0.8) {
        level.keycard.taken = true;
        player.hasKeycard = true;
        this.sound.door();
        this.setMessage('Keycard acquired — locked doors are open.', 3);
      }
    }
    for (const c of level.coins) {
      if (!c.taken && Math.hypot(player.x - c.x, player.y - c.y) < TILE * 0.8) {
        c.taken = true;
        player.coins += 1;
        this.stats.coinsCollected += 1;
        this.sound.pickup();
      }
    }
    if (level.intel && !level.intel.taken) {
      if (Math.hypot(player.x - level.intel.x, player.y - level.intel.y) < TILE * 0.8) {
        level.intel.taken = true;
        player.hasIntel = true;
        this.sound.intel();
        this.setMessage('Intel secured — reach the EXIT.', 3);
      }
    }

    // Exit: only counts once the intel is in hand.
    if (player.hasIntel && level.exit) {
      if (Math.hypot(player.x - level.exit.x, player.y - level.exit.y) < TILE * 0.8) {
        this.finishLevel();
        return;
      }
    }

    // Caught: an alarming guard reached the player.
    this.alarm = level.guards.some((g) => g.state === 'alarm');
    for (const g of level.guards) {
      if (g.state === 'alarm' && Math.hypot(g.x - player.x, g.y - player.y) < TUNING.catchDistance * TILE) {
        this.caughtBy = g;
        this.state = 'caught';
        this.sound.caught();
        return;
      }
    }
  }

  toggleMute() {
    this.sound.muted = !this.sound.muted;
    this.progress.muted = this.sound.muted;
    saveProgress(this.progress);
  }

  // Clickable buttons registered by the renderer this frame.
  handleClicks(input) {
    if (!input.clicked) return;
    for (const b of this.buttons) {
      if (input.mouseX >= b.x && input.mouseX <= b.x + b.w && input.mouseY >= b.y && input.mouseY <= b.y + b.h) {
        b.onClick();
        return;
      }
    }
  }

  // What the HUD shows: the worst detection meter among all watchers.
  get topMeter() {
    if (!this.level) return 0;
    let m = 0;
    for (const g of this.level.guards) m = Math.max(m, g.meter);
    for (const c of this.level.cameras) m = Math.max(m, c.meter);
    return m;
  }

  get parTime() {
    return PAR_TIMES[this.levelIndex] || 90;
  }
}

function gradeValue(grade) {
  return { S: 4, A: 3, B: 2, C: 1 }[grade] || 0;
}

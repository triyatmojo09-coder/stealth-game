// SHADOW PROTOCOL — shared tuning, colours and constants.
// One job: every number the rest of the game agrees on lives here.

export const TILE = 32;
export const VIEW_W = 1280;
export const VIEW_H = 720;
export const MAP_W = 40;
export const MAP_H = 22;

// Bundled typefaces (game/assets/fonts, loaded by index.html @font-face).
export const FONT_DISPLAY = "'Black Ops One', 'Rajdhani', sans-serif";
export const FONT_UI = "'Rajdhani', sans-serif";

export const COLORS = {
  // Structure: dark steel-blue slabs and walls, read against the back wall.
  slab: '#3d4c68',
  slabTop: '#7d92b8',
  slabFace: '#2c3850',
  slabSide: '#1a2336',
  slabSeam: '#10182a',
  // Vision cones: [inner, outer] gradient stops per watcher state.
  conePatrol: ['rgba(255, 216, 84, 0.30)', 'rgba(255, 196, 40, 0.02)'],
  conePatrolEdge: 'rgba(255, 214, 64, 0.5)',
  coneSuspicious: ['rgba(255, 156, 44, 0.38)', 'rgba(255, 130, 20, 0.03)'],
  coneSuspiciousEdge: 'rgba(255, 150, 40, 0.65)',
  coneAlarm: ['rgba(255, 66, 52, 0.42)', 'rgba(255, 40, 30, 0.04)'],
  coneAlarmEdge: 'rgba(255, 60, 50, 0.75)',
  coneCamera: ['rgba(110, 216, 255, 0.26)', 'rgba(90, 190, 255, 0.02)'],
  coneCameraEdge: 'rgba(120, 220, 255, 0.5)',
  // Light pools cast by ceiling fixtures over the playfield.
  lightPool: 'rgba(255, 226, 160, 0.055)',
  // Figures.
  player: '#2fd4c4',
  playerDark: '#0e7d74',
  playerHood: '#0a2e33',
  guard: '#ff5a4e',
  guardDark: '#8f231c',
  guardGear: '#5d1712',
  guardKnocked: '#7a4a44',
  // Objectives and pickups.
  intel: '#ffd23f',
  exit: '#3dff7a',
  keycard: '#ffe066',
  coin: '#ffcf3f',
  laser: '#ff2e4d',
  ladder: '#66779c',
  // Interface.
  hudBg: 'rgba(7, 11, 20, 0.88)',
  hudLine: 'rgba(126, 166, 224, 0.35)',
  hudText: '#e9effc',
  hudDim: '#93a7c9',
  danger: '#ff5a4e',
  ok: '#3dff7a',
  accent: '#ffd23f',
};

export const TUNING = {
  // Physics (side view): gravity in px/s^2, speeds in tiles per second.
  gravity: 1500,
  maxFall: 880,
  walkSpeed: 4.4,
  sneakSpeed: 2.0, // crouched: slower, quieter, harder to spot
  climbSpeed: 2.6,
  // Body sizes in pixels.
  bodyW: 20,
  standH: 46,
  crouchH: 28,
  guardH: 46,
  // Guard movement, tiles per second.
  guardPatrolSpeed: 1.6,
  guardInvestigateSpeed: 2.3,
  guardChaseSpeed: 3.0,
  // Vision.
  guardViewRange: 7.0, // tiles
  guardViewHalfAngle: 0.40, // ~23 degrees each side of the facing axis
  guardViewTilt: 0.10, // the axis tips slightly downward
  cameraViewRange: 6.5,
  cameraViewHalfAngle: 0.34,
  coneRays: 22,
  // Detection meter 0..1. Fill per second while the watcher sees the player.
  detectFillClose: 1.5, // within 2 tiles, standing in the light
  detectFillFar: 0.28, // at max range
  detectSneakFactor: 0.45, // crouched
  detectShadowFactor: 0.3, // standing in a shadow zone
  detectDecay: 0.3,
  suspiciousAt: 0.35, // meter above this: guard gets suspicious
  alarmAt: 1.0,
  alarmLoseSightSeconds: 5, // unseen this long: alarm clears
  catchRangeX: 26, // px: an alarming guard this close on your floor catches you
  // Coins.
  coinsStart: 3,
  coinNoiseRadius: 6.5, // tiles
  coinNoiseSeconds: 2.5,
  coinThrowSpeed: 560, // px/s before the lob lift
  // Takedown.
  takedownRange: 1.3, // tiles, from directly behind
  // Lasers.
  laserOnSeconds: 2.4,
  laserOffSeconds: 1.5,
  // Scoring.
  baseScore: 1000,
  timeBonusPerSecond: 12,
  ghostBonus: 500,
  detectionPenalty: 150,
  takedownBonus: 100,
  coinPickupBonus: 25,
};

// Par times (seconds) per level, used for the time bonus and grades.
export const PAR_TIMES = [95, 130, 170];

export const GAME_TITLE = 'SHADOW PROTOCOL';
export const GAME_SUBTITLE = 'THREE SITES. ONE OPERATIVE. NO WITNESSES.';

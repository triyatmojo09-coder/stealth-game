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
  // Floors: deep slate-navy plate metal, read at a glance against the walls.
  floorA: '#232c3e',
  floorB: '#202838',
  floorSeam: 'rgba(6, 9, 16, 0.55)',
  floorSheen: 'rgba(140, 170, 220, 0.05)',
  carpetA: '#2d3352',
  carpetB: '#29304c',
  shadowFloor: '#0b101d',
  shadowFloorB: '#090e19',
  shadowEdge: '#31436b',
  // Walls: bevelled blocks — dark base, lit top face, shadowed skirt.
  wall: '#46587a',
  wallTop: '#7186ad',
  wallFace: '#54688c',
  wallSide: '#232f47',
  wallSeam: '#141c2d',
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
  // Player movement, tiles per second.
  walkSpeed: 4.6,
  sneakSpeed: 2.2,
  // Guard movement, tiles per second.
  guardPatrolSpeed: 1.7,
  guardInvestigateSpeed: 2.4,
  guardChaseSpeed: 3.1,
  // Vision.
  guardViewRange: 7.5,
  guardViewHalfAngle: 0.61, // ~35 degrees each side
  cameraViewRange: 6.5,
  cameraViewHalfAngle: 0.5,
  coneRays: 26,
  // Detection meter 0..1. Fill per second while the watcher sees the player.
  detectFillClose: 1.5, // within 2 tiles, standing in the light
  detectFillFar: 0.28, // at max range
  detectSneakFactor: 0.45,
  detectShadowFactor: 0.3,
  detectDecay: 0.3,
  suspiciousAt: 0.35, // meter above this: guard gets suspicious
  alarmAt: 1.0,
  alarmLoseSightSeconds: 5, // unseen this long: alarm clears
  catchDistance: 0.62, // tiles: an alarming guard this close catches you
  // Coins.
  coinsStart: 3,
  coinNoiseRadius: 6,
  coinNoiseSeconds: 2.5,
  coinThrowRange: 7,
  // Takedown.
  takedownRange: 1.35,
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
export const PAR_TIMES = [75, 110, 150];

export const GAME_TITLE = 'SHADOW PROTOCOL';
export const GAME_SUBTITLE = 'THREE SITES. ONE OPERATIVE. NO WITNESSES.';

// SHADOW PROTOCOL — shared tuning, colours and constants.
// One job: every number the rest of the game agrees on lives here.

export const TILE = 32;
export const VIEW_W = 1280;
export const VIEW_H = 720;
export const MAP_W = 40;
export const MAP_H = 22;

export const COLORS = {
  floorA: '#1c2433',
  floorB: '#182031',
  shadowFloor: '#0d1322',
  shadowEdge: '#233250',
  wall: '#3a4a66',
  wallTop: '#5a6f96',
  wallSide: '#2a3852',
  conePatrol: 'rgba(255, 214, 64, 0.20)',
  conePatrolEdge: 'rgba(255, 214, 64, 0.55)',
  coneSuspicious: 'rgba(255, 150, 40, 0.26)',
  coneSuspiciousEdge: 'rgba(255, 150, 40, 0.65)',
  coneAlarm: 'rgba(255, 60, 50, 0.30)',
  coneAlarmEdge: 'rgba(255, 60, 50, 0.75)',
  coneCamera: 'rgba(120, 220, 255, 0.16)',
  coneCameraEdge: 'rgba(120, 220, 255, 0.5)',
  player: '#2fd4c4',
  playerDark: '#0e7d74',
  guard: '#ff5a4e',
  guardDark: '#a12720',
  guardKnocked: '#7a4a44',
  intel: '#ffd23f',
  exit: '#3dff7a',
  keycard: '#ffe066',
  coin: '#ffcf3f',
  laser: '#ff2e4d',
  hudBg: 'rgba(8, 12, 24, 0.82)',
  hudText: '#e8eefc',
  hudDim: '#9fb0d0',
  danger: '#ff5a4e',
  ok: '#3dff7a',
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
export const GAME_SUBTITLE = 'a quiet infiltration in three facilities';

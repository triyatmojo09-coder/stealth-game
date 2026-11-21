// SHADOW PROTOCOL — scoring and grades.
// One job: turn a finished level into points and a letter grade.
//   base + time bonus (faster than par pays) + ghost bonus (never spotted)
//   + takedowns and coin pickups, minus a penalty per detection.

import { PAR_TIMES, TUNING } from './config.js';

export function computeLevelScore(levelIndex, result) {
  const par = PAR_TIMES[levelIndex] || 90;
  const timeBonus = Math.max(0, Math.round((par - result.timeSeconds) * TUNING.timeBonusPerSecond));
  const ghostBonus = result.detections === 0 ? TUNING.ghostBonus : 0;
  const score =
    TUNING.baseScore +
    timeBonus +
    ghostBonus +
    result.takedowns * TUNING.takedownBonus +
    result.coinsCollected * TUNING.coinPickupBonus -
    result.detections * TUNING.detectionPenalty;
  return { score: Math.max(0, score), timeBonus, ghostBonus };
}

export function gradeFor(levelIndex, result) {
  const par = PAR_TIMES[levelIndex] || 90;
  if (result.detections === 0 && result.timeSeconds <= par) return 'S';
  if (result.detections === 0) return 'A';
  if (result.detections <= 1 && result.timeSeconds <= par * 1.5) return 'B';
  return 'C';
}

export const GRADE_ORDER = { S: 4, A: 3, B: 2, C: 1, '-': 0 };

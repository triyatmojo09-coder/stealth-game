// SHADOW PROTOCOL — line of sight and vision cones.
// One job: answer "can this watcher see that point?" with raycasts that
// walls block, and build the cone polygon the renderer draws.

import { TILE, TUNING } from './config.js';

// True when the straight segment between two points (in pixels) crosses no wall.
// A keycard door blocks sight only while it is still locked (doorsOpen false).
export function hasLineOfSight(level, x0, y0, x1, y1, doorsOpen) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  if (dist === 0) return true;
  const steps = Math.ceil(dist / (TILE * 0.2));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const px = x0 + dx * t;
    const py = y0 + dy * t;
    const tx = Math.floor(px / TILE);
    const ty = Math.floor(py / TILE);
    const tile = level.grid[ty] && level.grid[ty][tx];
    if (tile === '#' || tile === 'L') return false;
    if (tile === 'D' && !doorsOpen) return false;
  }
  return true;
}

// Cast one ray from (x, y) at angle; returns the distance in pixels before a
// wall or the range limit. Steps in small increments so thin walls still block.
export function castRay(level, x, y, angle, maxDist, doorsOpen) {
  const step = TILE * 0.25;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  for (let d = step; d <= maxDist; d += step) {
    const px = x + cos * d;
    const py = y + sin * d;
    const tx = Math.floor(px / TILE);
    const ty = Math.floor(py / TILE);
    const tile = level.grid[ty] && level.grid[ty][tx];
    if (tile === '#' || tile === 'L') return d - step;
    if (tile === 'D' && !doorsOpen) return d - step;
  }
  return maxDist;
}

// The vision cone as a polygon of pixel points: origin plus one ray end per
// step across the field of view. Walls shorten each ray, so the cone wraps
// around cover exactly like the watcher's sight does.
export function computeVisionCone(level, x, y, angle, halfAngle, range, doorsOpen) {
  const points = [{ x, y }];
  const rays = TUNING.coneRays;
  for (let i = 0; i <= rays; i++) {
    const a = angle - halfAngle + (2 * halfAngle * i) / rays;
    const d = castRay(level, x, y, a, range, doorsOpen);
    points.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d });
  }
  return points;
}

// Is the target point inside this watcher's cone and line of sight?
export function canSeePoint(level, watcher, tx, ty, doorsOpen) {
  const dx = tx - watcher.x;
  const dy = ty - watcher.y;
  const dist = Math.hypot(dx, dy);
  if (dist > watcher.range) return { seen: false, dist };
  let ang = Math.atan2(dy, dx) - watcher.angle;
  while (ang > Math.PI) ang -= Math.PI * 2;
  while (ang < -Math.PI) ang += Math.PI * 2;
  if (Math.abs(ang) > watcher.halfAngle) return { seen: false, dist };
  if (!hasLineOfSight(level, watcher.x, watcher.y, tx, ty, doorsOpen)) return { seen: false, dist };
  return { seen: true, dist };
}

// Is the tile at (tx, ty) a shadow tile? Standing there makes you far harder
// to spot. tx/ty are tile coordinates.
export function isShadowTile(level, tx, ty) {
  return level.grid[ty] && level.grid[ty][tx] === ',';
}

// Distance from a point (px) to a segment, in pixels. Used for laser trips.
export function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

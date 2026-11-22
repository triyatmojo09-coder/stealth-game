// SHADOW PROTOCOL — line of sight and vision cones, side view.
// One job: answer "can this watcher see that point?" Sight travels in
// straight lines and stops at solid tiles (walls, floors, locked doors)
// and at cover furniture: a crate is low cover that hides a crouched
// operative, a server rack hides anyone behind it. The cone polygon the
// renderer draws is built from the same raycasts, so what a guard can see
// and what the player sees of the cone always agree.

import { TILE, TUNING } from './config.js';
import { isSolidTile } from './physics.js';

// True when the straight segment between two pixel points crosses no solid
// tile and no cover rectangle. Cover edges are inset a few pixels, so a
// sight line that merely grazes a crate's top corner still counts as clear.
export function segmentBlocked(level, x0, y0, x1, y1, doorsOpen) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  if (dist === 0) return false;
  const steps = Math.max(1, Math.ceil(dist / 4));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const px = x0 + dx * t;
    const py = y0 + dy * t;
    if (isSolidTile(level, Math.floor(px / TILE), Math.floor(py / TILE), doorsOpen)) return true;
  }
  for (const c of level.cover) {
    if (segmentIntersectsRect(x0, y0, x1, y1, c.x + 2, c.y + 3, c.x + c.w - 2, c.y + c.h)) return true;
  }
  return false;
}

// Segment vs axis-aligned rectangle (slab test).
export function segmentIntersectsRect(x0, y0, x1, y1, rx0, ry0, rx1, ry1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  let tmin = 0;
  let tmax = 1;
  if (Math.abs(dx) < 1e-9) {
    if (x0 < rx0 || x0 > rx1) return false;
  } else {
    let t1 = (rx0 - x0) / dx;
    let t2 = (rx1 - x0) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  if (Math.abs(dy) < 1e-9) {
    if (y0 < ry0 || y0 > ry1) return false;
  } else {
    let t1 = (ry0 - y0) / dy;
    let t2 = (ry1 - y0) / dy;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  return true;
}

// Cast one ray from (x, y) at an angle; returns the distance in pixels
// before a solid tile, a piece of cover furniture, or the range limit.
// Used to draw the cones, so the cone wraps around cover exactly like
// the watcher's sight does.
export function castRay(level, x, y, angle, maxDist, doorsOpen) {
  const step = TILE * 0.2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  for (let d = step; d <= maxDist; d += step) {
    const px = x + cos * d;
    const py = y + sin * d;
    if (isSolidTile(level, Math.floor(px / TILE), Math.floor(py / TILE), doorsOpen)) return d - step / 2;
    for (const c of level.cover) {
      if (px >= c.x && px <= c.x + c.w && py >= c.y && py <= c.y + c.h) return d - step / 2;
    }
  }
  return maxDist;
}

// The vision cone as a polygon of pixel points: the eye plus one ray end
// per step across the field of view. Floors and walls shorten each ray.
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

export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Can this watcher see the player? A watcher has an eye point, a facing
// axis angle, a half-angle and a range. The player is tested at two
// points — head and torso — so crouching behind low cover, which hides
// both, breaks sight, while standing behind it leaves the head exposed.
export function canSeePlayer(level, watcher, player, doorsOpen) {
  const points = [
    { x: player.x, y: player.y - player.h * 0.86 },
    { x: player.x, y: player.y - player.h * 0.38 },
  ];
  let nearest = Infinity;
  for (const p of points) {
    const dx = p.x - watcher.eyeX;
    const dy = p.y - watcher.eyeY;
    const dist = Math.hypot(dx, dy);
    if (dist > watcher.range) continue;
    if (Math.abs(angleDiff(Math.atan2(dy, dx), watcher.axis)) > watcher.halfAngle) continue;
    if (segmentBlocked(level, watcher.eyeX, watcher.eyeY, p.x, p.y, doorsOpen)) continue;
    nearest = Math.min(nearest, dist);
  }
  return { seen: nearest !== Infinity, dist: nearest === Infinity ? watcher.range : nearest };
}

// Is the pixel point inside a shadow zone? Standing in one makes the
// operative far harder to spot. Shadow is a property of grid cells.
export function isShadowAt(level, px, py) {
  const tx = Math.floor(px / TILE);
  const ty = Math.floor(py / TILE);
  return !!(level.grid[ty] && level.grid[ty][tx] === ',');
}

// Distance from a point to a segment, in pixels. Used for laser trips.
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

// SHADOW PROTOCOL — bodies against tiles.
// One job: move an axis-aligned body (the player, a guard) through the tile
// grid without ever letting it inside a solid tile. A body is
//   { x, y, w, h }  — x is the centre, y is the FEET (the bottom edge),
// so standing on a floor means y equals that floor's top edge exactly.
// Movement is resolved one axis at a time, so bodies slide along walls and
// land cleanly on floors. Ladders and shadow cells are not solid; keycard
// doors are solid until the card is held (doorsOpen). A caller may pass
// extraSolid(tx, ty) to treat further cells as solid — the player uses it
// for ladder-top gaps, which hold you up until you climb down on purpose.

import { TILE } from './config.js';

export function isSolidTile(level, tx, ty, doorsOpen) {
  if (tx < 0 || ty < 0 || tx >= level.grid[0].length || ty >= level.grid.length) return true;
  const t = level.grid[ty][tx];
  if (t === '#' || t === 'L') return true;
  if (t === 'D' && !doorsOpen) return true;
  return false;
}

function solid(level, tx, ty, doorsOpen, extraSolid) {
  return isSolidTile(level, tx, ty, doorsOpen) || !!(extraSolid && extraSolid(tx, ty));
}

// Does this body's box overlap any solid tile right now?
export function bodyHitsSolid(level, body, doorsOpen, extraSolid) {
  const eps = 0.02;
  const left = body.x - body.w / 2 + eps;
  const right = body.x + body.w / 2 - eps;
  const top = body.y - body.h + eps;
  const bottom = body.y - eps;
  const minTx = Math.floor(left / TILE);
  const maxTx = Math.floor(right / TILE);
  const minTy = Math.floor(top / TILE);
  const maxTy = Math.floor(bottom / TILE);
  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      if (solid(level, tx, ty, doorsOpen, extraSolid)) return true;
    }
  }
  return false;
}

// Move a body by (dx, dy) pixels, resolving collisions per axis.
// Returns { hitX, hitY, grounded }: grounded is true when a downward move
// was stopped by a floor this call.
export function moveBody(level, body, dx, dy, doorsOpen, extraSolid) {
  const out = { hitX: false, hitY: false, grounded: false };
  if (dx !== 0) {
    body.x += dx;
    if (bodyHitsSolid(level, body, doorsOpen, extraSolid)) {
      out.hitX = true;
      if (dx > 0) {
        const tile = Math.floor((body.x + body.w / 2) / TILE);
        body.x = tile * TILE - body.w / 2 - 0.01;
      } else {
        const tile = Math.floor((body.x - body.w / 2) / TILE);
        body.x = (tile + 1) * TILE + body.w / 2 + 0.01;
      }
      if (bodyHitsSolid(level, body, doorsOpen, extraSolid)) body.x -= dx > 0 ? 1 : -1;
    }
  }
  if (dy !== 0) {
    body.y += dy;
    if (bodyHitsSolid(level, body, doorsOpen, extraSolid)) {
      out.hitY = true;
      if (dy > 0) {
        const tile = Math.floor(body.y / TILE);
        body.y = tile * TILE;
        out.grounded = true;
      } else {
        const tile = Math.floor((body.y - body.h) / TILE);
        body.y = (tile + 1) * TILE + body.h + 0.01;
      }
      if (bodyHitsSolid(level, body, doorsOpen, extraSolid)) body.y -= dy > 0 ? 1 : -1;
    }
  }
  return out;
}

// The tile character at a pixel point ('' outside the grid).
export function tileAtPoint(level, px, py) {
  const tx = Math.floor(px / TILE);
  const ty = Math.floor(py / TILE);
  if (!level.grid[ty] || tx < 0 || tx >= level.grid[ty].length) return '';
  return level.grid[ty][tx];
}

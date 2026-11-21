// SHADOW PROTOCOL — the player.
// One job: the infiltrator's body. Walks, sneaks (slower, quieter, harder to
// spot), throws coin lures toward the mouse, and performs rear takedowns.
// Movement collides against walls tile by tile, one axis at a time.

import { TILE, TUNING } from './config.js';
import { isShadowTile } from './vision.js';

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 11;
    this.angle = -Math.PI / 2;
    this.sneaking = false;
    this.moving = false;
    this.coins = TUNING.coinsStart;
    this.hasKeycard = false;
    this.hasIntel = false;
    this.forceSneak = false; // set by the staging hook for screenshots
  }

  get tileX() {
    return Math.floor(this.x / TILE);
  }

  get tileY() {
    return Math.floor(this.y / TILE);
  }

  // Circle-vs-tile collision, resolved per axis so the player slides along walls.
  collides(level, px, py, doorsOpen) {
    const r = this.radius - 1;
    const minTx = Math.floor((px - r) / TILE);
    const maxTx = Math.floor((px + r) / TILE);
    const minTy = Math.floor((py - r) / TILE);
    const maxTy = Math.floor((py + r) / TILE);
    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        const tile = level.grid[ty] && level.grid[ty][tx];
        if (tile === '#' || tile === 'L') return true;
        if (tile === 'D' && !doorsOpen) return true;
      }
    }
    return false;
  }

  update(dt, input, level, doorsOpen, sound) {
    const mv = input.moveVector();
    this.sneaking = input.sneaking || this.forceSneak;
    this.moving = mv.x !== 0 || mv.y !== 0;
    if (this.moving) {
      const speed = (this.sneaking ? TUNING.sneakSpeed : TUNING.walkSpeed) * TILE;
      this.angle = Math.atan2(mv.y, mv.x);
      const nx = this.x + mv.x * speed * dt;
      const ny = this.y + mv.y * speed * dt;
      if (!this.collides(level, nx, this.y, doorsOpen)) this.x = nx;
      if (!this.collides(level, this.x, ny, doorsOpen)) this.y = ny;
      if (sound) sound.step(this.sneaking);
    }
    this.shadowed = isShadowTile(level, this.tileX, this.tileY);
  }

  // Throw a coin toward a pixel target. Returns the landing point or null.
  throwCoin(tx, ty) {
    if (this.coins <= 0) return null;
    this.coins -= 1;
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.hypot(dx, dy);
    const max = TUNING.coinThrowRange * TILE;
    const d = Math.min(dist, max);
    const ux = dist === 0 ? 0 : dx / dist;
    const uy = dist === 0 ? 0 : dy / dist;
    return { x: this.x + ux * d, y: this.y + uy * d };
  }
}

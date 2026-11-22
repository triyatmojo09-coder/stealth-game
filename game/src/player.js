// SHADOW PROTOCOL — the player.
// One job: the infiltrator's body, in side view. Runs left and right under
// gravity, crouches (slower, quieter, low enough to hide behind a crate),
// climbs ladders between floors, and throws coin lures in an arc toward
// the mouse. The gap at the top of a ladder holds the player up like any
// floor until they deliberately climb down it.

import { TILE, TUNING } from './config.js';
import { moveBody, bodyHitsSolid } from './physics.js';
import { isShadowAt } from './vision.js';

export class Player {
  constructor(x, y) {
    this.x = x; // centre
    this.y = y; // feet
    this.w = TUNING.bodyW;
    this.h = TUNING.standH;
    this.vy = 0;
    this.grounded = false;
    this.climbing = false;
    this.ladderX = 0; // pixel centre of the ladder column being climbed
    this.crouching = false;
    this.moving = false;
    this.facing = 1;
    this.walkPhase = 0;
    this.coins = TUNING.coinsStart;
    this.hasKeycard = false;
    this.hasIntel = false;
    this.forceCrouch = false; // set by the staging hook for screenshots
    this.shadowed = false;
  }

  get tileX() {
    return Math.floor(this.x / TILE);
  }

  get tileY() {
    return Math.floor(this.y / TILE);
  }

  // Does the body overlap a ladder cell anywhere along its height?
  onLadder(level) {
    const tx = Math.floor(this.x / TILE);
    const top = Math.floor((this.y - this.h + 4) / TILE);
    const bottom = Math.floor((this.y - 4) / TILE);
    for (let ty = top; ty <= bottom; ty++) {
      if (level.grid[ty] && level.grid[ty][tx] === 'H') return true;
    }
    return false;
  }

  // Ladder-top gaps hold the player up: an 'H' cell with solid floor
  // beside it (precomputed in level.ladderTops) is solid for this body —
  // unless it is climbing, or holding Down to descend on purpose, or its
  // feet are already below the gap's top edge (inside the shaft).
  gapSolid(level, downHeld) {
    return (tx, ty) => {
      if (this.climbing || downHeld) return false;
      if (!level.ladderTops.has(tx + ',' + ty)) return false;
      return this.y <= ty * TILE + 6;
    };
  }

  update(dt, input, level, doorsOpen, sound) {
    const left = input.down('KeyA') || input.down('ArrowLeft');
    const right = input.down('KeyD') || input.down('ArrowRight');
    const up = input.down('KeyW') || input.down('ArrowUp');
    const down = input.down('KeyS') || input.down('ArrowDown');
    const dirX = (right ? 1 : 0) - (left ? 1 : 0);
    const extraSolid = this.gapSolid(level, down);

    // --- ladders: grab, climb, release ---
    const touchingLadder = this.onLadder(level);
    if (!this.climbing && touchingLadder && (up || (down && !this.grounded))) {
      this.climbing = true;
      this.ladderX = (Math.floor(this.x / TILE) + 0.5) * TILE;
      this.vy = 0;
    }
    if (this.climbing) {
      this.x += (this.ladderX - this.x) * Math.min(1, dt * 14);
      const climb = ((down ? 1 : 0) - (up ? 1 : 0)) * TUNING.climbSpeed * TILE * dt;
      if (climb !== 0) {
        const res = moveBody(level, this, 0, climb, doorsOpen, null);
        if (climb > 0 && res.grounded) this.climbing = false; // reached the foot
      }
      // Step off sideways: allowed when the way is clear (at the top the
      // body clears the floor edge; mid-shaft it means letting go).
      if (dirX !== 0) {
        const res = moveBody(level, this, dirX * TUNING.walkSpeed * TILE * dt, 0, doorsOpen, null);
        if (!res.hitX && !this.onLadder(level)) this.climbing = false;
        else if (res.hitX) this.x += (this.ladderX - this.x) * Math.min(1, dt * 14);
      }
      if (!this.onLadder(level) && !touchingLadder) this.climbing = false;
      this.crouching = false;
      this.moving = climb !== 0 || dirX !== 0;
      if (this.moving) this.walkPhase += dt * 7;
      this.shadowed = isShadowAt(level, this.x, this.y - 8);
      return;
    }

    // --- crouch: Shift, or Down while standing on solid ground ---
    const wantCrouch = input.sneaking || this.forceCrouch || (down && this.grounded);
    if (wantCrouch) {
      this.crouching = true;
    } else if (this.crouching) {
      // Stand up only with headroom.
      const tall = { x: this.x, y: this.y, w: this.w, h: TUNING.standH };
      if (!bodyHitsSolid(level, tall, doorsOpen, extraSolid)) this.crouching = false;
    }
    this.h = this.crouching ? TUNING.crouchH : TUNING.standH;

    // --- run and gravity ---
    this.moving = dirX !== 0;
    if (dirX !== 0) this.facing = dirX;
    const speed = (this.crouching ? TUNING.sneakSpeed : TUNING.walkSpeed) * TILE;
    if (dirX !== 0) {
      moveBody(level, this, dirX * speed * dt, 0, doorsOpen, extraSolid);
      this.walkPhase += dt * (this.crouching ? 6 : 10);
      if (sound && this.grounded) sound.step(this.crouching);
    }
    this.vy = Math.min(TUNING.maxFall, this.vy + TUNING.gravity * dt);
    const res = moveBody(level, this, 0, this.vy * dt, doorsOpen, extraSolid);
    if (res.grounded) {
      this.grounded = true;
      this.vy = 0;
    } else if (res.hitY) {
      this.vy = 0;
      this.grounded = false;
    } else {
      this.grounded = false;
    }
    this.shadowed = isShadowAt(level, this.x, this.y - 8);
  }

  // Throw a coin toward a pixel target. Returns the projectile's starting
  // state (position and velocity) or null when out of coins. The game
  // simulates the arc; the noise lands where the coin lands.
  throwCoin(tx, ty) {
    if (this.coins <= 0) return null;
    this.coins -= 1;
    const sx = this.x;
    const sy = this.y - this.h * 0.7;
    const dx = tx - sx;
    const dy = ty - sy;
    const dist = Math.hypot(dx, dy) || 1;
    const speed = TUNING.coinThrowSpeed;
    return {
      x: sx,
      y: sy,
      vx: (dx / dist) * speed,
      vy: (dy / dist) * speed - 150, // the lob: always arcs a little
      landed: false,
    };
  }
}

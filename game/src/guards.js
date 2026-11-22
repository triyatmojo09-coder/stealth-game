// SHADOW PROTOCOL — guard AI and security cameras, side view.
// One job: the watchers' brains. A guard walks his floor between two
// patrol points, vision cone ahead of him, and lives in one of:
//   patrol     walk the patrol span, pausing at each end, watching the cone
//   suspicious meter passed the threshold, or a noise: walk to the spot, look
//   alarm      the meter filled: chase the player along the floor
//   return     lost the player: walk back to the patrol span
//   knocked    taken down from behind: out for the rest of the level
// The detection meter (0..1) is the heart of the stealth: it fills while
// the guard can see the player — fast up close, slow at range, slower
// still when the player crouches or stands in shadow — and drains when
// the player is unseen. Guards never leave their floor: no ladders, and
// they stop at its edges. Cameras sweep from their mounts into the same
// meter and the same alarm.

import { TILE, TUNING } from './config.js';
import { moveBody, isSolidTile } from './physics.js';
import { canSeePlayer } from './vision.js';

export class Guard {
  constructor(def, level) {
    this.level = level;
    this.fromX = (def.from + 0.5) * TILE;
    this.toX = (def.to + 0.5) * TILE;
    this.pause = def.pause || 1;
    this.x = (def.start + 0.5) * TILE;
    this.y = def.floor * TILE; // feet, on the patrol floor
    this.w = TUNING.bodyW;
    this.h = TUNING.guardH;
    this.vy = 0;
    this.facing = def.to >= def.start ? 1 : -1;
    this.targetX = this.facing === 1 ? this.toX : this.fromX;
    this.state = 'patrol';
    this.meter = 0;
    this.pauseTimer = 0;
    this.lookTimer = 0;
    this.lookFacing = 1;
    this.lastSeen = null;
    this.investigateTarget = null;
    this.unseenTimer = 0;
    this.walkPhase = Math.random() * 6;
    this.moving = false;
    this.range = TUNING.guardViewRange * TILE;
    this.halfAngle = TUNING.guardViewHalfAngle;
  }

  get knocked() {
    return this.state === 'knocked';
  }

  get eyeX() {
    return this.x + this.facing * 8;
  }

  get eyeY() {
    return this.y - this.h * 0.83;
  }

  // The cone's axis: straight ahead, tipped a little downward.
  get axis() {
    return this.facing === 1 ? TUNING.guardViewTilt : Math.PI - TUNING.guardViewTilt;
  }

  // How fast the meter fills right now: distance, crouching, shadow.
  detectionRate(player, sight) {
    const distTiles = sight.dist / TILE;
    const close = Math.max(0, 1 - distTiles / TUNING.guardViewRange);
    let rate = TUNING.detectFillFar + (TUNING.detectFillClose - TUNING.detectFillFar) * close;
    if (player.crouching) rate *= TUNING.detectSneakFactor;
    if (player.shadowed) rate *= TUNING.detectShadowFactor;
    return rate;
  }

  // Is there floor ahead at this body's own level? Guards stop at edges.
  groundAhead(dir) {
    const aheadX = this.x + dir * (this.w / 2 + 7);
    const row = Math.floor((this.y + 8) / TILE);
    return isSolidTile(this.level, Math.floor(aheadX / TILE), row, this.doorsOpen !== false);
  }

  // Walk toward a pixel x at a speed in tiles/sec, stopping at floor
  // edges. Returns true when arrived (or when an edge bars the way).
  moveTowardX(tx, speed, dt) {
    const dx = tx - this.x;
    if (Math.abs(dx) < 3) {
      this.moving = false;
      return true;
    }
    const dir = Math.sign(dx);
    this.facing = dir;
    if (!this.groundAhead(dir)) {
      this.moving = false;
      return true;
    }
    const step = Math.min(Math.abs(dx), speed * TILE * dt);
    const res = moveBody(this.level, this, dir * step, 0, this.doorsOpen !== false);
    this.moving = !res.hitX;
    if (this.moving) this.walkPhase += dt * 8;
    return res.hitX;
  }

  // Settle onto the floor (gravity), so a staged or nudged guard lands.
  settle(dt, doorsOpen) {
    this.vy = Math.min(TUNING.maxFall, this.vy + TUNING.gravity * dt);
    const res = moveBody(this.level, this, 0, this.vy * dt, doorsOpen);
    if (res.grounded || res.hitY) this.vy = 0;
  }

  // A noise at (x, y): the guard walks over to check it out.
  hearNoise(x, y) {
    if (this.knocked || this.state === 'alarm') return;
    this.investigateTarget = { x, y };
    this.state = 'suspicious';
    this.lookTimer = 0;
  }

  // The alarm went off somewhere: converge on the player's position.
  raiseAlarm(x, y) {
    if (this.knocked) return;
    this.state = 'alarm';
    this.lastSeen = { x, y };
    this.unseenTimer = 0;
  }

  // Knocked out from behind by the player.
  knockOut() {
    this.state = 'knocked';
    this.meter = 0;
  }

  // Is the player behind this guard, close, on about the same floor?
  // Used for the rear takedown.
  playerIsBehind(player) {
    if (Math.abs(player.y - this.y) > 30) return false;
    const dx = player.x - this.x;
    if (Math.abs(dx) > TUNING.takedownRange * TILE) return false;
    return dx * this.facing < -2; // on the side the guard is not facing
  }

  update(dt, player, doorsOpen) {
    if (this.knocked) return;
    this.doorsOpen = doorsOpen;
    this.settle(dt, doorsOpen);

    // --- sight: does this guard see the player right now? ---
    const sight = canSeePlayer(this.level, this, player, doorsOpen);
    if (sight.seen) {
      this.meter = Math.min(1, this.meter + this.detectionRate(player, sight) * dt);
      this.lastSeen = { x: player.x, y: player.y };
      this.unseenTimer = 0;
    } else {
      this.meter = Math.max(0, this.meter - TUNING.detectDecay * dt);
      this.unseenTimer += dt;
    }

    if (this.meter >= TUNING.alarmAt && this.state !== 'alarm') {
      this.state = 'alarm';
      this.unseenTimer = 0;
    } else if (this.meter >= TUNING.suspiciousAt && this.state === 'patrol') {
      this.state = 'suspicious';
      this.investigateTarget = this.lastSeen ? { ...this.lastSeen } : null;
      this.lookTimer = 0;
    }

    // --- behaviour by state ---
    if (this.state === 'patrol') {
      if (this.pauseTimer > 0) {
        this.pauseTimer -= dt;
        this.moving = false;
        if (this.pauseTimer <= 0) {
          this.targetX = this.targetX === this.toX ? this.fromX : this.toX;
          this.facing = this.targetX > this.x ? 1 : -1;
        }
      } else if (this.moveTowardX(this.targetX, TUNING.guardPatrolSpeed, dt)) {
        this.pauseTimer = this.pause;
      }
    } else if (this.state === 'suspicious') {
      const target = this.investigateTarget;
      const sameFloor = target && Math.abs(target.y - this.y) < 44;
      if (target && sameFloor && this.moveTowardX(target.x, TUNING.guardInvestigateSpeed, dt)) {
        this.investigateTarget = null;
        this.lookTimer = 3;
        this.lookFacing = this.facing;
      } else if (target && !sameFloor) {
        // The stimulus is on another floor: face it and watch a moment.
        this.facing = target.x >= this.x ? 1 : -1;
        this.investigateTarget = null;
        this.lookTimer = 2;
        this.lookFacing = this.facing;
        this.moving = false;
      } else if (!target) {
        this.lookTimer -= dt;
        this.moving = false;
        // Look back and forth while the spot stays empty.
        this.facing = Math.sin(this.lookTimer * 2.4) > 0 ? this.lookFacing : -this.lookFacing;
        if (this.lookTimer <= 0) {
          this.state = 'return';
          this.meter = Math.max(this.meter, TUNING.suspiciousAt * 0.5);
        }
      }
    } else if (this.state === 'alarm') {
      const target = this.lastSeen || { x: player.x, y: player.y };
      this.moveTowardX(target.x, TUNING.guardChaseSpeed, dt);
      if (this.unseenTimer > TUNING.alarmLoseSightSeconds) {
        this.state = 'suspicious';
        this.investigateTarget = this.lastSeen ? { ...this.lastSeen } : null;
        this.meter = TUNING.suspiciousAt + 0.1;
      }
    } else if (this.state === 'return') {
      // Walk back to the nearer end of the patrol span, then resume.
      const target = Math.abs(this.fromX - this.x) < Math.abs(this.toX - this.x) ? this.fromX : this.toX;
      if (this.moveTowardX(target, TUNING.guardInvestigateSpeed, dt)) {
        this.targetX = target === this.fromX ? this.toX : this.fromX;
        this.state = 'patrol';
        this.meter = 0;
      }
    }
  }
}

// A sweeping security camera: mounted under a slab or ceiling, its cone
// swings back and forth across the floor below. Its meter feeds the same
// alarm as the guards'.
export class Camera {
  constructor(def) {
    this.x = (def.tx + 0.5) * TILE;
    this.y = (def.ty + 1) * TILE; // hangs from the underside of its tile
    this.eyeX = this.x;
    this.eyeY = this.y;
    this.sweep = def.sweep;
    this.speed = def.speed;
    this.phase = Math.random() * Math.PI * 2;
    this.range = TUNING.cameraViewRange * TILE;
    this.halfAngle = TUNING.cameraViewHalfAngle;
    this.meter = 0;
  }

  // The cone's axis: downward, swinging side to side.
  get axis() {
    return Math.PI / 2 + Math.sin(this.phase) * this.sweep;
  }

  update(dt, player, level, doorsOpen) {
    this.phase += dt * this.speed;
    const sight = canSeePlayer(level, this, player, doorsOpen);
    if (sight.seen) {
      const distTiles = sight.dist / TILE;
      const close = Math.max(0, 1 - distTiles / TUNING.cameraViewRange);
      let rate = TUNING.detectFillFar + (TUNING.detectFillClose - TUNING.detectFillFar) * close;
      if (player.crouching) rate *= TUNING.detectSneakFactor;
      if (player.shadowed) rate *= TUNING.detectShadowFactor;
      this.meter = Math.min(1, this.meter + rate * dt);
    } else {
      this.meter = Math.max(0, this.meter - TUNING.detectDecay * dt);
    }
  }
}

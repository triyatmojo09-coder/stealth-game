// SHADOW PROTOCOL — guard AI.
// One job: one guard's brain. States:
//   patrol     walk the waypoints, pausing at each, watching the cone
//   suspicious meter passed the threshold: walk to the last seen spot, look around
//   alarm      the meter filled: chase the player; touch them and they are caught
//   return     lost the player: walk back to the patrol route
//   knocked    taken down from behind: out for the rest of the level
// The detection meter (0..1) is the heart of the stealth: it fills while the
// guard can see the player — fast up close, slow at range, slower still when
// the player sneaks or hides in shadow — and drains when the player is unseen.

import { TILE, TUNING } from './config.js';
import { canSeePoint, isShadowTile } from './vision.js';

export class Guard {
  constructor(def, level) {
    this.patrol = def.patrol.map((p) => ({ x: (p.x + 0.5) * TILE, y: (p.y + 0.5) * TILE }));
    this.pause = def.pause || 1;
    this.x = this.patrol[0].x;
    this.y = this.patrol[0].y;
    this.waypoint = 1 % this.patrol.length;
    this.angle = 0;
    this.state = 'patrol';
    this.meter = 0;
    this.pauseTimer = 0;
    this.lookTimer = 0;
    this.lookAngle = 0;
    this.lastSeen = null;
    this.investigateTarget = null;
    this.unseenTimer = 0;
    this.level = level;
    this.range = TUNING.guardViewRange * TILE;
    this.halfAngle = TUNING.guardViewHalfAngle;
    this.faceWaypoint();
  }

  faceWaypoint() {
    const t = this.patrol[this.waypoint];
    this.angle = Math.atan2(t.y - this.y, t.x - this.x);
  }

  get knocked() {
    return this.state === 'knocked';
  }

  // How fast the meter fills right now: distance, sneaking and shadow matter.
  detectionRate(player, seen) {
    if (!seen) return 0;
    const distTiles = Math.hypot(player.x - this.x, player.y - this.y) / TILE;
    const close = Math.max(0, 1 - distTiles / TUNING.guardViewRange);
    let rate = TUNING.detectFillFar + (TUNING.detectFillClose - TUNING.detectFillFar) * close;
    if (player.sneaking) rate *= TUNING.detectSneakFactor;
    if (isShadowTile(this.level, Math.floor(player.x / TILE), Math.floor(player.y / TILE))) {
      rate *= TUNING.detectShadowFactor;
    }
    return rate;
  }

  // Move toward a pixel target at a speed in tiles/sec. Returns true on arrival.
  moveToward(tx, ty, speed, dt) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 2) return true;
    const step = speed * TILE * dt;
    const nx = this.x + (dx / dist) * Math.min(step, dist);
    const ny = this.y + (dy / dist) * Math.min(step, dist);
    this.x = nx;
    this.y = ny;
    this.angle = Math.atan2(dy, dx);
    return dist <= step + 2;
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

  // Is the player behind this guard? Used for the rear takedown.
  playerIsBehind(player) {
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > TUNING.takedownRange * TILE) return false;
    const toPlayer = Math.atan2(dy, dx);
    let diff = toPlayer - this.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return Math.abs(diff) > Math.PI * 0.55;
  }

  update(dt, player, doorsOpen) {
    if (this.knocked) return;

    // --- sight: does this guard see the player right now? ---
    const sight = canSeePoint(this.level, this, player.x, player.y, doorsOpen);
    if (sight.seen) {
      this.meter = Math.min(1, this.meter + this.detectionRate(player, true) * dt);
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
        if (this.pauseTimer <= 0) this.faceWaypoint();
      } else {
        const target = this.patrol[this.waypoint];
        if (this.moveToward(target.x, target.y, TUNING.guardPatrolSpeed, dt)) {
          this.waypoint = (this.waypoint + 1) % this.patrol.length;
          this.pauseTimer = this.pause;
        }
      }
    } else if (this.state === 'suspicious') {
      const target = this.investigateTarget;
      if (target && this.moveToward(target.x, target.y, TUNING.guardInvestigateSpeed, dt)) {
        this.investigateTarget = null;
        this.lookTimer = 3;
        this.lookAngle = this.angle;
      } else if (!target) {
        this.lookTimer -= dt;
        this.angle = this.lookAngle + Math.sin(this.lookTimer * 2.2) * 1.1;
        if (this.lookTimer <= 0) {
          this.state = 'return';
          this.meter = Math.max(this.meter, TUNING.suspiciousAt * 0.5);
        }
      }
    } else if (this.state === 'alarm') {
      if (sight.seen) {
        this.lastSeen = { x: player.x, y: player.y };
        this.unseenTimer = 0;
      }
      const target = this.lastSeen || { x: player.x, y: player.y };
      this.moveToward(target.x, target.y, TUNING.guardChaseSpeed, dt);
      if (this.unseenTimer > TUNING.alarmLoseSightSeconds) {
        this.state = 'suspicious';
        this.investigateTarget = this.lastSeen ? { ...this.lastSeen } : null;
        this.meter = TUNING.suspiciousAt + 0.1;
      }
    } else if (this.state === 'return') {
      // Walk back to the nearest patrol waypoint, then resume the route.
      let nearest = 0;
      let best = Infinity;
      this.patrol.forEach((p, i) => {
        const d = Math.hypot(p.x - this.x, p.y - this.y);
        if (d < best) {
          best = d;
          nearest = i;
        }
      });
      const target = this.patrol[nearest];
      if (this.moveToward(target.x, target.y, TUNING.guardInvestigateSpeed, dt)) {
        this.waypoint = (nearest + 1) % this.patrol.length;
        this.state = 'patrol';
        this.meter = 0;
      }
    }
  }
}

// A sweeping security camera: fixed to a wall, its cone sweeps back and forth.
// Its meter feeds the same alarm as the guards'.
export class Camera {
  constructor(def) {
    this.x = (def.tx + 0.5) * TILE;
    this.y = (def.ty + 0.5) * TILE;
    this.baseAngle = def.angle;
    this.sweep = def.sweep;
    this.speed = def.speed;
    this.phase = Math.random() * Math.PI * 2;
    this.angle = this.baseAngle;
    this.range = TUNING.cameraViewRange * TILE;
    this.halfAngle = TUNING.cameraViewHalfAngle;
    this.meter = 0;
  }

  update(dt, player, level, doorsOpen) {
    this.phase += dt * this.speed;
    this.angle = this.baseAngle + Math.sin(this.phase) * this.sweep;
    const sight = canSeePoint(level, this, player.x, player.y, doorsOpen);
    if (sight.seen) {
      const distTiles = sight.dist / TILE;
      const close = Math.max(0, 1 - distTiles / TUNING.cameraViewRange);
      let rate = TUNING.detectFillFar + (TUNING.detectFillClose - TUNING.detectFillFar) * close;
      if (player.sneaking) rate *= TUNING.detectSneakFactor;
      if (isShadowTile(level, Math.floor(player.x / TILE), Math.floor(player.y / TILE))) {
        rate *= TUNING.detectShadowFactor;
      }
      this.meter = Math.min(1, this.meter + rate * dt);
    } else {
      this.meter = Math.max(0, this.meter - TUNING.detectDecay * dt);
    }
  }
}

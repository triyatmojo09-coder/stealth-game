// SHADOW PROTOCOL — everything the player sees.
// One job: draw the world (floor, walls, cones, entities), the HUD, and the
// menu screens, all on one canvas. Buttons register their hit-boxes on the
// game so clicks work.

import { TILE, VIEW_W, VIEW_H, COLORS, GAME_TITLE, GAME_SUBTITLE } from './config.js';
import { LEVELS } from './levels.js';
import { computeVisionCone } from './vision.js';

export class Renderer {
  constructor(game) {
    this.game = game;
    this.ctx = game.ctx;
  }

  render() {
    const g = this.game;
    const ctx = this.ctx;
    g.buttons = [];
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = '#070a12';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    if (g.state === 'title') {
      this.drawTitle();
    } else if (g.level) {
      this.drawWorld();
      this.drawHud();
      if (g.state === 'paused') this.drawPaused();
      else if (g.state === 'caught') this.drawCaught();
      else if (g.state === 'complete') this.drawComplete();
      else if (g.state === 'victory') this.drawVictory();
    }
    if (g.alarmFlash > 0 && g.state === 'playing') {
      ctx.fillStyle = `rgba(255, 40, 40, ${g.alarmFlash * 0.12})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  // ---- world ----

  drawWorld() {
    const g = this.game;
    const ctx = this.ctx;
    const level = g.level;
    const doorsOpen = g.doorsOpen;

    // Floor: checker of two dark blues; shadow tiles darker with a rim.
    for (let y = 0; y < level.grid.length; y++) {
      for (let x = 0; x < level.grid[y].length; x++) {
        const t = level.grid[y][x];
        const px = x * TILE;
        const py = y * TILE;
        if (t === '#') continue;
        ctx.fillStyle = t === ',' ? COLORS.shadowFloor : (x + y) % 2 === 0 ? COLORS.floorA : COLORS.floorB;
        ctx.fillRect(px, py, TILE, TILE);
        if (t === ',') {
          ctx.strokeStyle = 'rgba(70, 110, 180, 0.18)';
          ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
        }
      }
    }

    // Walls: block with a lighter top edge so the layout reads at a glance.
    for (let y = 0; y < level.grid.length; y++) {
      for (let x = 0; x < level.grid[y].length; x++) {
        if (level.grid[y][x] !== '#') continue;
        const px = x * TILE;
        const py = y * TILE;
        ctx.fillStyle = COLORS.wall;
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = COLORS.wallTop;
        ctx.fillRect(px, py, TILE, 5);
        ctx.fillStyle = COLORS.wallSide;
        ctx.fillRect(px, py + TILE - 3, TILE, 3);
      }
    }

    // Keycard doors: shut and red-striped while locked, open and green once held.
    for (let y = 0; y < level.grid.length; y++) {
      for (let x = 0; x < level.grid[y].length; x++) {
        if (level.grid[y][x] !== 'D') continue;
        const px = x * TILE;
        const py = y * TILE;
        if (doorsOpen) {
          ctx.fillStyle = '#1d3a24';
          ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = COLORS.ok;
          ctx.font = 'bold 11px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('OPEN', px + TILE / 2, py + TILE / 2 + 4);
        } else {
          ctx.fillStyle = '#4a2b12';
          ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = '#ffb020';
          ctx.fillRect(px + 4, py + 6, TILE - 8, 4);
          ctx.fillRect(px + 4, py + TILE - 10, TILE - 8, 4);
          ctx.fillStyle = '#ffe9a8';
          ctx.font = 'bold 10px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('KEYCARD', px + TILE / 2, py + TILE / 2 + 3);
        }
      }
    }

    // Vision cones: cameras first, then guards, coloured by alert state.
    for (const cam of level.cameras) {
      this.drawCone(cam.x, cam.y, cam.angle, cam.halfAngle, cam.range, COLORS.coneCamera, COLORS.coneCameraEdge);
    }
    for (const gd of level.guards) {
      if (gd.knocked) continue;
      const fill = gd.state === 'alarm' ? COLORS.coneAlarm : gd.state === 'suspicious' ? COLORS.coneSuspicious : COLORS.conePatrol;
      const edge = gd.state === 'alarm' ? COLORS.coneAlarmEdge : gd.state === 'suspicious' ? COLORS.coneSuspiciousEdge : COLORS.conePatrolEdge;
      this.drawCone(gd.x, gd.y, gd.angle, gd.halfAngle, gd.range, fill, edge);
    }

    // Lasers: blinking red beams between their posts.
    for (const lz of level.lasers) {
      const blink = lz.active ? 1 : 0.12;
      ctx.strokeStyle = `rgba(255, 46, 77, ${blink})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(lz.x1, lz.y1);
      ctx.lineTo(lz.x2, lz.y2);
      ctx.stroke();
      if (lz.active) {
        ctx.strokeStyle = 'rgba(255, 120, 140, 0.5)';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(lz.x1, lz.y1);
        ctx.lineTo(lz.x2, lz.y2);
        ctx.stroke();
      }
      for (const [ex, ey] of [[lz.x1, lz.y1], [lz.x2, lz.y2]]) {
        ctx.fillStyle = '#5a1020';
        ctx.fillRect(ex - 7, ey - 7, 14, 14);
        ctx.fillStyle = lz.active ? '#ff2e4d' : '#7a2030';
        ctx.beginPath();
        ctx.arc(ex, ey, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Pickups and objectives.
    if (level.keycard && !level.keycard.taken) this.drawKeycard(level.keycard.x, level.keycard.y);
    for (const c of level.coins) {
      if (!c.taken) this.drawCoin(c.x, c.y);
    }
    if (level.intel && !level.intel.taken) this.drawIntel(level.intel.x, level.intel.y);
    if (level.exit) this.drawExit(level.exit.x, level.exit.y);

    // Thrown coins: a gold dot with a fading noise ring guards can hear.
    for (const c of this.game.thrownCoins) {
      const pulse = 1 - c.ttl / 2.5;
      ctx.strokeStyle = `rgba(255, 207, 63, ${0.7 * (1 - pulse)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 8 + pulse * 70, 0, Math.PI * 2);
      ctx.stroke();
      this.drawCoin(c.x, c.y);
    }

    // Cameras: wall mount + lens.
    for (const cam of level.cameras) {
      ctx.fillStyle = '#8fa8c8';
      ctx.beginPath();
      ctx.arc(cam.x, cam.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1c2739';
      ctx.beginPath();
      ctx.arc(cam.x + Math.cos(cam.angle) * 6, cam.y + Math.sin(cam.angle) * 6, 4, 0, Math.PI * 2);
      ctx.fill();
      if (cam.meter > 0.05) {
        ctx.fillStyle = cam.meter >= 1 ? '#ff3c32' : '#ffb020';
        ctx.beginPath();
        ctx.arc(cam.x, cam.y - 12, 3 + cam.meter * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Guards.
    for (const gd of level.guards) this.drawGuard(gd);

    // Player.
    if (this.game.player) this.drawPlayer(this.game.player);
  }

  drawCone(x, y, angle, halfAngle, range, fill, edge) {
    const ctx = this.ctx;
    const pts = computeVisionCone(this.game.level, x, y, angle, halfAngle, range, this.game.doorsOpen);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  drawGuard(gd) {
    const ctx = this.ctx;
    if (gd.knocked) {
      ctx.save();
      ctx.translate(gd.x, gd.y);
      ctx.fillStyle = COLORS.guardKnocked;
      ctx.beginPath();
      ctx.ellipse(0, 0, 13, 9, gd.angle, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#e8eefc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-4, -4);
      ctx.lineTo(4, 4);
      ctx.moveTo(4, -4);
      ctx.lineTo(-4, 4);
      ctx.stroke();
      ctx.restore();
      return;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(gd.x, gd.y + 10, 11, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = gd.state === 'alarm' ? '#ff2e2e' : COLORS.guard;
    ctx.beginPath();
    ctx.arc(gd.x, gd.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.guardDark;
    ctx.beginPath();
    ctx.arc(gd.x, gd.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.guard;
    ctx.beginPath();
    ctx.arc(gd.x, gd.y, 10, 0, Math.PI * 2);
    ctx.fill();
    // Visor: a line across the facing direction.
    ctx.strokeStyle = '#ffd9d4';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(gd.x + Math.cos(gd.angle + 0.5) * 7, gd.y + Math.sin(gd.angle + 0.5) * 7);
    ctx.lineTo(gd.x + Math.cos(gd.angle - 0.5) * 7, gd.y + Math.sin(gd.angle - 0.5) * 7);
    ctx.stroke();
    // Direction tick.
    ctx.strokeStyle = COLORS.guard;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(gd.x + Math.cos(gd.angle) * 10, gd.y + Math.sin(gd.angle) * 10);
    ctx.lineTo(gd.x + Math.cos(gd.angle) * 17, gd.y + Math.sin(gd.angle) * 17);
    ctx.stroke();
    // Alert markers.
    if (gd.state === 'suspicious' || gd.state === 'alarm') {
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = gd.state === 'alarm' ? '#ff2e2e' : '#ffb020';
      ctx.fillText(gd.state === 'alarm' ? '!' : '?', gd.x, gd.y - 20);
    }
    // Detection meter arc over the guard.
    if (gd.meter > 0.03) {
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(gd.x, gd.y, 16, -Math.PI / 2, Math.PI * 1.5);
      ctx.stroke();
      ctx.strokeStyle = gd.meter >= 1 ? '#ff2e2e' : '#ffd640';
      ctx.beginPath();
      ctx.arc(gd.x, gd.y, 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * gd.meter);
      ctx.stroke();
    }
  }

  drawPlayer(p) {
    const ctx = this.ctx;
    const r = p.sneaking ? 9 : 11;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 10, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Cloak: teal circle with a hood point in the facing direction.
    ctx.fillStyle = COLORS.playerDark;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0b2f2c';
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(p.angle) * 4, p.y + Math.sin(p.angle) * 4, 4.5, 0, Math.PI * 2);
    ctx.fill();
    // Facing tick.
    ctx.strokeStyle = '#dffffb';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(p.angle) * r, p.y + Math.sin(p.angle) * r);
    ctx.lineTo(p.x + Math.cos(p.angle) * (r + 6), p.y + Math.sin(p.angle) * (r + 6));
    ctx.stroke();
    // Shadow marker: you are hard to see here.
    if (p.shadowed) {
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#9fc4ff';
      ctx.fillText('HIDDEN', p.x, p.y - r - 8);
    }
  }

  drawCoin(x, y) {
    const ctx = this.ctx;
    ctx.fillStyle = '#8a6d00';
    ctx.beginPath();
    ctx.arc(x, y + 1, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.coin;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff3b0';
    ctx.beginPath();
    ctx.arc(x - 1.5, y - 1.5, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  drawKeycard(x, y) {
    const ctx = this.ctx;
    const bob = Math.sin(performance.now() / 300) * 2;
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.fillStyle = '#8a6d00';
    ctx.fillRect(-9, -5, 18, 12);
    ctx.fillStyle = COLORS.keycard;
    ctx.fillRect(-9, -7, 18, 12);
    ctx.fillStyle = '#1c2739';
    ctx.fillRect(-6, -4, 6, 6);
    ctx.fillStyle = '#1c2739';
    ctx.fillRect(2, -4, 5, 2);
    ctx.fillRect(2, 0, 5, 2);
    ctx.restore();
  }

  drawIntel(x, y) {
    const ctx = this.ctx;
    const pulse = 0.5 + Math.sin(performance.now() / 250) * 0.2;
    ctx.fillStyle = `rgba(255, 210, 63, ${0.25 * pulse})`;
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = COLORS.intel;
    ctx.fillRect(-8, -8, 16, 16);
    ctx.fillStyle = '#fff3b0';
    ctx.fillRect(-4, -4, 8, 8);
    ctx.restore();
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.intel;
    ctx.fillText('INTEL', x, y - 24);
  }

  drawExit(x, y) {
    const ctx = this.ctx;
    const g = this.game;
    const open = g.player && g.player.hasIntel;
    const pulse = open ? 0.6 + Math.sin(performance.now() / 200) * 0.25 : 0.25;
    ctx.fillStyle = `rgba(61, 255, 122, ${0.18 * pulse + 0.1})`;
    ctx.fillRect(x - 16, y - 16, 32, 32);
    ctx.strokeStyle = open ? COLORS.exit : '#2a7a44';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 16, y - 16, 32, 32);
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = open ? COLORS.exit : '#7ac79a';
    ctx.fillText('EXIT', x, y + 4);
    if (!open) {
      ctx.fillStyle = '#7ac79a';
      ctx.font = '10px system-ui, sans-serif';
      ctx.fillText('needs intel', x, y + 28);
    }
  }

  // Word-wrap a string into lines of at most maxChars characters.
  wrapText(text, maxChars) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      if ((line + ' ' + w).trim().length > maxChars && line) {
        lines.push(line);
        line = w;
      } else {
        line = (line + ' ' + w).trim();
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  // ---- HUD ----

  drawHud() {
    const g = this.game;
    const ctx = this.ctx;
    const level = g.level;
    const p = g.player;

    ctx.fillStyle = COLORS.hudBg;
    ctx.fillRect(0, 0, VIEW_W, 46);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(0, 46, VIEW_W, 1);

    // Left: level + objective.
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.hudText;
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.fillText(level.name, 14, 20);
    ctx.fillStyle = COLORS.hudDim;
    ctx.font = '13px system-ui, sans-serif';
    const objective = !p.hasIntel ? 'Objective: steal the INTEL' : 'Objective: reach the EXIT';
    ctx.fillText(objective, 14, 38);

    // Centre: detection meter.
    const meter = g.topMeter;
    const mw = 220;
    const mx = VIEW_W / 2 - mw / 2;
    ctx.fillStyle = COLORS.hudText;
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const label = g.alarm ? 'ALARM!' : meter >= 0.35 ? 'SUSPICIOUS' : 'UNSEEN';
    ctx.fillStyle = g.alarm ? COLORS.danger : meter >= 0.35 ? '#ffb020' : COLORS.hudDim;
    ctx.fillText('◉ ' + label, VIEW_W / 2, 16);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(mx, 24, mw, 10);
    ctx.fillStyle = g.alarm ? COLORS.danger : meter >= 0.35 ? '#ffb020' : '#ffd640';
    ctx.fillRect(mx, 24, mw * Math.min(1, meter), 10);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(mx + 0.5, 24.5, mw, 10);

    // Right: time, coins, keycard, score.
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.hudText;
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(this.formatTime(g.time), VIEW_W - 14, 20);
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = COLORS.hudDim;
    const bits = [];
    bits.push('◉ ' + p.coins + ' coins');
    if (p.hasKeycard) bits.push('▮ KEYCARD');
    bits.push('Spotted ' + g.stats.detections);
    ctx.fillText(bits.join('   '), VIEW_W - 14, 38);

    // Bottom hint bar.
    ctx.fillStyle = COLORS.hudBg;
    ctx.fillRect(0, VIEW_H - 30, VIEW_W, 30);
    ctx.fillStyle = COLORS.hudDim;
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'left';
    const hints = 'WASD move · SHIFT sneak · Q / click throw coin · E takedown from behind · ESC pause · M mute';
    ctx.fillText(hints, 14, VIEW_H - 11);
    ctx.textAlign = 'right';
    ctx.fillText(p.shadowed ? 'In shadow — hard to see' : p.sneaking ? 'Sneaking — slow and quiet' : '', VIEW_W - 14, VIEW_H - 11);

    // Transient message banner.
    if (g.messageTimer > 0 && g.message) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 16px system-ui, sans-serif';
      const w = ctx.measureText(g.message).width + 32;
      ctx.fillStyle = 'rgba(8, 12, 24, 0.85)';
      ctx.fillRect(VIEW_W / 2 - w / 2, 58, w, 32);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.strokeRect(VIEW_W / 2 - w / 2, 58, w, 32);
      ctx.fillStyle = '#ffe9a8';
      ctx.fillText(g.message, VIEW_W / 2, 80);
    }
  }

  formatTime(t) {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return m + ':' + String(s).padStart(2, '0');
  }

  // ---- menus ----

  button(x, y, w, h, label, onClick, opts) {
    const ctx = this.ctx;
    const g = this.game;
    const hover = g.input
      ? g.input.mouseX >= x && g.input.mouseX <= x + w && g.input.mouseY >= y && g.input.mouseY <= y + h
      : false;
    ctx.fillStyle = hover ? '#2b3f66' : '#1d2a44';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = hover ? '#7fa8e8' : '#43587f';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.fillStyle = COLORS.hudText;
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x + w / 2, y + h / 2 + 6);
    g.buttons.push({ x, y, w, h, onClick });
  }

  drawTitle() {
    const g = this.game;
    const ctx = this.ctx;
    // Backdrop: a dark facility grid.
    ctx.fillStyle = '#0a0f1c';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.strokeStyle = 'rgba(90, 120, 180, 0.07)';
    ctx.lineWidth = 1;
    for (let x = 0; x < VIEW_W; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, VIEW_H);
      ctx.stroke();
    }
    for (let y = 0; y < VIEW_H; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(VIEW_W, y);
      ctx.stroke();
    }
    // A decorative vision cone sweeping the title.
    const cx = VIEW_W / 2;
    const cy = 300;
    const ang = -Math.PI / 2 + Math.sin(performance.now() / 1600) * 0.5;
    ctx.fillStyle = 'rgba(255, 214, 64, 0.06)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, 260, ang - 0.6, ang + 0.6);
    ctx.closePath();
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.hudText;
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.fillText(GAME_TITLE, VIEW_W / 2, 130);
    ctx.fillStyle = '#ffd640';
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText(GAME_SUBTITLE, VIEW_W / 2, 162);
    ctx.fillStyle = COLORS.hudDim;
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText('Infiltrate three facilities. Steal the intel. Reach the exit unseen.', VIEW_W / 2, 190);

    // Level cards.
    const cardW = 300;
    const cardH = 110;
    const gap = 24;
    const totalW = LEVELS.length * cardW + (LEVELS.length - 1) * gap;
    let x = (VIEW_W - totalW) / 2;
    const y = 240;
    LEVELS.forEach((def, i) => {
      const locked = i >= g.progress.unlocked;
      const grade = g.progress.grades[i] || '-';
      const best = g.progress.bestScores[i];
      ctx.fillStyle = locked ? 'rgba(20, 28, 46, 0.85)' : 'rgba(29, 42, 68, 0.9)';
      ctx.fillRect(x, y, cardW, cardH);
      ctx.strokeStyle = locked ? '#2a3852' : '#43587f';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 0.5, y + 0.5, cardW - 1, cardH - 1);
      ctx.fillStyle = locked ? '#5a6a88' : COLORS.hudText;
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.fillText((i + 1) + '. ' + def.name, x + cardW / 2, y + 34);
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillStyle = locked ? '#5a6a88' : COLORS.hudDim;
      if (locked) {
        ctx.fillText('LOCKED — finish the previous facility first', x + cardW / 2, y + 58);
      } else {
        const lines = this.wrapText(def.briefing, 38);
        lines.slice(0, 2).forEach((line, li) => ctx.fillText(line, x + cardW / 2, y + 56 + li * 17));
      }
      if (!locked) {
        ctx.fillStyle = grade === 'S' ? '#ffd640' : COLORS.hudText;
        ctx.font = 'bold 15px system-ui, sans-serif';
        ctx.fillText('Grade ' + grade + (best ? '   ·   Best ' + best : ''), x + cardW / 2, y + 96);
        g.buttons.push({
          x, y, w: cardW, h: cardH,
          onClick: () => g.startLevel(i),
        });
      }
      x += cardW + gap;
    });

    // Controls.
    ctx.fillStyle = COLORS.hudDim;
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText('WASD / arrows — move      SHIFT — sneak (slow, quiet, hard to see)', VIEW_W / 2, 420);
    ctx.fillText('Q or click — throw a coin to lure a guard      E — takedown from behind', VIEW_W / 2, 444);
    ctx.fillText('Hide in the dark blue shadow zones. Cameras sweep. Lasers blink — cross while off.', VIEW_W / 2, 468);
    ctx.fillText('Ghost bonus: finish a level without ever being spotted.', VIEW_W / 2, 492);

    this.button(VIEW_W / 2 - 130, 530, 260, 48, '▶  START — ' + LEVELS[Math.min(g.progress.unlocked - 1, 2)].name, () => {
      g.startLevel(Math.min(g.progress.unlocked - 1, LEVELS.length - 1));
    });

    ctx.fillStyle = '#5a6a88';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('An original game. No network, no accounts — progress is saved on this computer.', VIEW_W / 2, 620);
    ctx.fillText('Press M to ' + (g.sound.muted ? 'unmute' : 'mute') + ' sound.', VIEW_W / 2, 640);
  }

  overlayPanel(title, lines, buttons) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(4, 7, 14, 0.72)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const w = 560;
    const h = 130 + lines.length * 30 + (buttons ? 70 : 0);
    const x = (VIEW_W - w) / 2;
    const y = (VIEW_H - h) / 2;
    ctx.fillStyle = '#101828';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#43587f';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.hudText;
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillText(title, VIEW_W / 2, y + 52);
    ctx.font = '15px system-ui, sans-serif';
    lines.forEach((line, i) => {
      ctx.fillStyle = line.dim ? COLORS.hudDim : COLORS.hudText;
      ctx.fillText(line.text, VIEW_W / 2, y + 92 + i * 30);
    });
    if (buttons) {
      const bw = 200;
      const gap = 20;
      const total = buttons.length * bw + (buttons.length - 1) * gap;
      let bx = VIEW_W / 2 - total / 2;
      for (const b of buttons) {
        this.button(bx, y + h - 58, bw, 40, b.label, b.onClick);
        bx += bw + gap;
      }
    }
    return { x, y, w, h };
  }

  drawPaused() {
    const g = this.game;
    this.overlayPanel('PAUSED', [
      { text: g.level.name + '  ·  ' + this.formatTime(g.time) },
      { text: 'ESC resume   ·   Q quit to title', dim: true },
    ], [
      { label: 'Resume (ESC)', onClick: () => { g.state = 'playing'; } },
      { label: 'Quit to title', onClick: () => g.backToTitle() },
    ]);
  }

  drawCaught() {
    const g = this.game;
    this.overlayPanel('CAUGHT!', [
      { text: 'A guard got you. The facility resets — detections stay on your record.' },
      { text: 'Detections so far: ' + g.stats.detections + '   ·   Time: ' + this.formatTime(g.time), dim: true },
    ], [
      { label: 'Try again (R)', onClick: () => g.retryLevel() },
      { label: 'Quit to title', onClick: () => g.backToTitle() },
    ]);
  }

  drawComplete() {
    const g = this.game;
    const r = g.result;
    this.overlayPanel(g.level.name + ' — CLEAR!', [
      { text: 'Grade ' + r.grade + '      Score ' + r.score },
      { text: 'Time ' + this.formatTime(r.timeSeconds) + '  (par ' + this.formatTime(g.parTime) + ')  ·  Detections ' + r.detections + '  ·  Takedowns ' + r.takedowns },
      { text: r.ghost ? 'GHOST — never spotted!  +500 bonus' : 'Spotted ' + r.detections + ' time(s) — ghost bonus missed', dim: !r.ghost },
    ], [
      { label: 'Next facility ▶', onClick: () => g.startLevel(g.levelIndex + 1) },
      { label: 'Title', onClick: () => g.backToTitle() },
    ]);
  }

  drawVictory() {
    const g = this.game;
    const r = g.result;
    this.overlayPanel('ALL FACILITIES CLEAR!', [
      { text: 'You ghosted the whole network. Final facility grade: ' + r.grade },
      { text: 'Total score ' + g.totalScore + '   ·   Detections ' + r.detections, dim: true },
      { text: 'Replay any facility from the title screen to raise your grades.', dim: true },
    ], [
      { label: 'Back to title', onClick: () => g.backToTitle() },
    ]);
  }
}

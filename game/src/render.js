// SHADOW PROTOCOL — everything the player sees.
// One job: draw the facility cross-section (layered back wall, slabs,
// ladders, cover furniture, vision cones, side-view figures), the
// ops-style HUD, the mission brief, and the menu screens, all on one
// canvas. Buttons register their hit-boxes on the game so clicks work.
// All presentation: nothing here changes the game.

import { TILE, VIEW_W, VIEW_H, COLORS, FONT_DISPLAY, FONT_UI, GAME_TITLE, GAME_SUBTITLE } from './config.js';
import { LEVELS } from './levels.js';
import { computeVisionCone } from './vision.js';

// Deterministic per-tile hash: stable detail with no RNG state, so every
// frame (and every screenshot) draws the same building.
function tileHash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >> 13)) | 0;
  h = Math.imul(h, 1274126177);
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

// Guard cone colours ease between states instead of snapping: each guard
// carries a smoothed suspicion value (0 patrol, 1 suspicious, 2 alarm).
function coneStopsFor(gd) {
  const target = gd.state === 'alarm' ? 2 : gd.state === 'suspicious' ? 1 : 0;
  gd.smoothState = gd.smoothState === undefined ? target : gd.smoothState + (target - gd.smoothState) * 0.12;
  const s = gd.smoothState;
  if (s < 1) return mixStops(COLORS.conePatrol, COLORS.coneSuspicious, s);
  return mixStops(COLORS.coneSuspicious, COLORS.coneAlarm, s - 1);
}

function mixStops(a, b, t) {
  return [mixRgba(a[0], b[0], t), mixRgba(a[1], b[1], t)];
}

const rgbaCache = new Map();
function parseRgba(str) {
  if (!rgbaCache.has(str)) {
    const m = str.match(/[\d.]+/g).map(Number);
    rgbaCache.set(str, m);
  }
  return rgbaCache.get(str);
}

function mixRgba(a, b, t) {
  const pa = parseRgba(a);
  const pb = parseRgba(b);
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  const al = (pa[3] + (pb[3] - pa[3]) * t).toFixed(3);
  return `rgba(${r}, ${g}, ${bl}, ${al})`;
}

// The same colour with its alpha scaled — a cone's mid-gradient stop.
function fadeStop(str, f) {
  const p = parseRgba(str);
  return `rgba(${p[0]}, ${p[1]}, ${p[2]}, ${(p[3] * f).toFixed(3)})`;
}

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
    ctx.fillStyle = '#04060b';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    if (g.state === 'title') {
      this.drawTitle();
    } else if (g.level) {
      this.drawWorld();
      this.drawHud();
      if (g.briefing && g.state === 'playing') this.drawBrief();
      else if (g.state === 'paused') this.drawPaused();
      else if (g.state === 'caught') this.drawCaught();
      else if (g.state === 'complete') this.drawComplete();
      else if (g.state === 'victory') this.drawVictory();
    }
    if (g.alarmFlash > 0 && g.state === 'playing') {
      ctx.fillStyle = `rgba(255, 40, 40, ${g.alarmFlash * 0.14})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  // ---- shared drawing helpers ----

  // A panel with two clipped corners — the ops-console house style.
  panel(x, y, w, h, fill, stroke) {
    const ctx = this.ctx;
    const c = 12;
    ctx.beginPath();
    ctx.moveTo(x + c, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h - c);
    ctx.lineTo(x + w - c, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + c);
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  // Thin-line icon strokes, drawn not typed: no emoji anywhere in the UI.
  icon(kind, x, y, s, color) {
    const ctx = this.ctx;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    if (kind === 'coin') {
      ctx.arc(x, y, s * 0.62, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, s * 0.3, 0, Math.PI * 2);
      ctx.stroke();
    } else if (kind === 'key') {
      ctx.arc(x - s * 0.3, y, s * 0.38, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + s * 0.05, y + s * 0.1);
      ctx.lineTo(x + s * 0.62, y + s * 0.55);
      ctx.moveTo(x + s * 0.35, y + s * 0.32);
      ctx.lineTo(x + s * 0.55, y + s * 0.15);
      ctx.stroke();
    } else if (kind === 'eye') {
      ctx.ellipse(x, y, s * 0.85, s * 0.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, s * 0.26, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'clock') {
      ctx.arc(x, y, s * 0.7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - s * 0.45);
      ctx.moveTo(x, y);
      ctx.lineTo(x + s * 0.35, y + s * 0.1);
      ctx.stroke();
    } else if (kind === 'doc') {
      ctx.strokeRect(x - s * 0.45, y - s * 0.6, s * 0.9, s * 1.2);
      ctx.beginPath();
      ctx.moveTo(x - s * 0.25, y - s * 0.2);
      ctx.lineTo(x + s * 0.25, y - s * 0.2);
      ctx.moveTo(x - s * 0.25, y + s * 0.12);
      ctx.lineTo(x + s * 0.25, y + s * 0.12);
      ctx.stroke();
    } else if (kind === 'exit') {
      ctx.moveTo(x - s * 0.5, y - s * 0.6);
      ctx.lineTo(x + s * 0.1, y - s * 0.6);
      ctx.lineTo(x + s * 0.1, y + s * 0.6);
      ctx.lineTo(x - s * 0.5, y + s * 0.6);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - s * 0.15, y);
      ctx.lineTo(x + s * 0.6, y);
      ctx.moveTo(x + s * 0.35, y - s * 0.28);
      ctx.lineTo(x + s * 0.62, y);
      ctx.lineTo(x + s * 0.35, y + s * 0.28);
      ctx.stroke();
    }
  }

  // ---- world ----

  drawWorld() {
    const g = this.game;
    const level = g.level;
    const doorsOpen = g.doorsOpen;

    this.drawBackground(level);
    this.drawShadowZones(level);
    this.drawSlabs(level);
    this.drawLadders(level);
    this.drawDoors(level, doorsOpen);
    this.drawCoverSet(level, false);

    // Vision cones: cameras first, then guards, coloured by alert state.
    for (const cam of level.cameras) {
      this.drawCone(cam.eyeX, cam.eyeY, cam.axis, cam.halfAngle, cam.range, COLORS.coneCamera, COLORS.coneCameraEdge);
    }
    for (const gd of level.guards) {
      if (gd.knocked) continue;
      const stops = coneStopsFor(gd);
      this.drawCone(gd.eyeX, gd.eyeY, gd.axis, gd.halfAngle, gd.range, stops, COLORS.conePatrolEdge);
    }

    this.drawLasers(level);

    // Pickups and objectives.
    if (level.keycard && !level.keycard.taken) this.drawKeycard(level.keycard.x, level.keycard.y);
    for (const c of level.coins) {
      if (!c.taken) this.drawCoin(c.x, c.y - 10);
    }
    if (level.intel && !level.intel.taken) this.drawIntel(level.intel.x, level.intel.y);
    if (level.exit) this.drawExit(level.exit.x, level.exit.y);

    // Coins in flight and landed, still ringing.
    for (const p of g.projectiles) this.drawCoin(p.x, p.y);
    for (const c of g.thrownCoins) {
      const pulse = 1 - c.ttl / 2.5;
      this.ctx.strokeStyle = `rgba(255, 207, 63, ${0.7 * (1 - pulse)})`;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(c.x, c.y - 4, 8 + pulse * 70, 0, Math.PI * 2);
      this.ctx.stroke();
      this.drawCoin(c.x, c.y - 2);
    }

    for (const cam of level.cameras) this.drawCamera(cam);
    for (const gd of level.guards) this.drawGuard(gd);
    if (g.player) this.drawPlayer(g.player);
    // The one piece of furniture the operative is tucked behind draws
    // over him: he is behind it, not in front of it.
    this.drawCoverSet(level, true);

    this.drawFx();
    this.drawLightPools(level);
    this.drawVignette();
  }

  // The far wall of the cross-section, themed per facility: shelving and
  // windows for the archive, steel panels and the vault door for the
  // vault, a server wall with live LEDs for the core.
  drawBackground(level) {
    const ctx = this.ctx;
    const theme = level.def.theme;
    const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    if (theme === 'archive') {
      grad.addColorStop(0, '#181423');
      grad.addColorStop(1, '#0a0d16');
    } else if (theme === 'vault') {
      grad.addColorStop(0, '#131a29');
      grad.addColorStop(1, '#090d15');
    } else {
      grad.addColorStop(0, '#0c1523');
      grad.addColorStop(1, '#070b12');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    if (theme === 'archive') this.drawArchiveWall();
    else if (theme === 'vault') this.drawVaultWall();
    else this.drawCoreWall();

    // Ceiling pipe run with hanging drops, common to every site.
    ctx.fillStyle = '#05080f';
    ctx.fillRect(0, 26, VIEW_W, 9);
    ctx.fillStyle = 'rgba(150, 175, 220, 0.20)';
    ctx.fillRect(0, 26, VIEW_W, 2);
    ctx.fillStyle = '#05080f';
    for (let x = 150; x < VIEW_W; x += 290) ctx.fillRect(x, 35, 7, 26);
  }

  drawArchiveWall() {
    const ctx = this.ctx;
    // Tall windows with night glow, upper west wall.
    for (const wx of [70, 240]) {
      const wg = ctx.createLinearGradient(0, 60, 0, 210);
      wg.addColorStop(0, 'rgba(84, 130, 205, 0.30)');
      wg.addColorStop(1, 'rgba(40, 70, 130, 0.10)');
      ctx.fillStyle = wg;
      ctx.fillRect(wx, 58, 86, 158);
      ctx.strokeStyle = 'rgba(140, 170, 230, 0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(wx, 58, 86, 158);
      ctx.beginPath();
      ctx.moveTo(wx + 43, 58);
      ctx.lineTo(wx + 43, 216);
      ctx.moveTo(wx, 137);
      ctx.lineTo(wx + 86, 137);
      ctx.stroke();
      ctx.fillStyle = 'rgba(220, 235, 255, 0.7)';
      for (let i = 0; i < 7; i++) {
        const sx = wx + 8 + tileHash(wx, i * 3) * 68;
        const sy = 70 + tileHash(i, wx) * 130;
        ctx.fillRect(sx, sy, 1.6, 1.6);
      }
    }
    // Shelving bands behind each floor: dark units, book-spine ticks.
    const bands = [[300, 150], [470, 190], [130, 120]];
    for (const [by, bh] of bands) {
      for (let bx = 24; bx < VIEW_W - 60; bx += 118) {
        ctx.fillStyle = 'rgba(16, 12, 24, 0.85)';
        ctx.fillRect(bx, by, 104, bh);
        ctx.strokeStyle = 'rgba(120, 100, 160, 0.14)';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx + 0.5, by + 0.5, 103, bh - 1);
        for (let shelf = 0; shelf < 3; shelf++) {
          const sy = by + 12 + shelf * ((bh - 20) / 3);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
          ctx.fillRect(bx + 5, sy + 26, 94, 3);
          for (let b = 0; b < 11; b++) {
            const h = tileHash(bx + b * 7, shelf * 31 + by);
            const palette = ['#4a3a52', '#54423a', '#3a4a54', '#514a35', '#423a5e'];
            ctx.fillStyle = palette[Math.floor(h * palette.length)];
            ctx.globalAlpha = 0.5;
            ctx.fillRect(bx + 8 + b * 8.4, sy + 26 - 12 - h * 9, 5.4, 12 + h * 9);
            ctx.globalAlpha = 1;
          }
        }
      }
    }
    // A stencilled sign on the back wall.
    ctx.font = `26px ${FONT_DISPLAY}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(200, 190, 230, 0.13)';
    ctx.fillText('RECORDS — STACK 7', 700, 130);
  }

  drawVaultWall() {
    const ctx = this.ctx;
    // Steel panel grid with rivets.
    for (let px = 0; px < VIEW_W; px += 160) {
      for (let py = 40; py < VIEW_H; py += 150) {
        ctx.strokeStyle = 'rgba(130, 160, 210, 0.10)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, 159, 149);
        ctx.fillStyle = 'rgba(170, 195, 235, 0.13)';
        for (const [rx, ry] of [[8, 8], [150, 8], [8, 140], [150, 140]]) {
          ctx.beginPath();
          ctx.arc(px + rx, py + ry, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    // The great vault door on the back wall of the chamber, behind the
    // intel: concentric rings, spokes, a hub.
    const cx = 1152;
    const cy = 368;
    ctx.save();
    ctx.strokeStyle = 'rgba(190, 205, 235, 0.20)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(cx, cy, 86, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 66, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(190, 205, 235, 0.14)';
    ctx.lineWidth = 7;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 18, cy + Math.sin(a) * 18);
      ctx.lineTo(cx + Math.cos(a) * 62, cy + Math.sin(a) * 62);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(190, 205, 235, 0.18)';
    ctx.beginPath();
    ctx.arc(cx, cy, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.font = `26px ${FONT_DISPLAY}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(200, 215, 245, 0.13)';
    ctx.fillText('VAULT 07 — BEARER BONDS', 60, 130);
  }

  drawCoreWall() {
    const ctx = this.ctx;
    const now = performance.now();
    // Server cabinets wall to wall, each with vents and live LEDs.
    for (let bx = 16; bx < VIEW_W - 60; bx += 92) {
      for (let by = 52; by < 640; by += 148) {
        ctx.fillStyle = 'rgba(10, 16, 28, 0.9)';
        ctx.fillRect(bx, by, 80, 136);
        ctx.strokeStyle = 'rgba(90, 140, 220, 0.13)';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx + 0.5, by + 0.5, 79, 135);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        for (let v = 0; v < 4; v++) ctx.fillRect(bx + 8, by + 12 + v * 9, 64, 3);
        for (let led = 0; led < 9; led++) {
          const h = tileHash(bx * 3 + led, by + led);
          const blink = h > 0.82 && Math.sin(now / 300 + h * 40) > 0.2;
          ctx.fillStyle = blink ? '#ffd23f' : h > 0.5 ? 'rgba(61, 255, 122, 0.55)' : 'rgba(110, 216, 255, 0.4)';
          ctx.fillRect(bx + 8 + led * 7.4, by + 62 + (led % 3) * 16, 3, 3);
        }
        ctx.fillStyle = 'rgba(140, 180, 255, 0.05)';
        ctx.fillRect(bx + 6, by + 108, 68, 18);
      }
    }
    // Cable trays running the height of the room.
    ctx.strokeStyle = 'rgba(110, 160, 240, 0.10)';
    ctx.lineWidth = 2;
    for (const ty of [210, 420, 590]) {
      ctx.beginPath();
      ctx.moveTo(0, ty);
      ctx.lineTo(VIEW_W, ty);
      ctx.stroke();
    }
    ctx.font = `26px ${FONT_DISPLAY}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(170, 210, 255, 0.12)';
    ctx.fillText('CORE — AUTHORISED EYES ONLY', 700, 130);
  }

  // Shadow zones: soft dark washes over the back wall wherever the grid
  // marks dark ground, so what is safe reads at a glance.
  drawShadowZones(level) {
    const ctx = this.ctx;
    for (let y = 0; y < level.grid.length; y++) {
      for (let x = 0; x < level.grid[y].length; x++) {
        if (level.grid[y][x] !== ',') continue;
        const px = x * TILE;
        const py = y * TILE;
        ctx.fillStyle = 'rgba(2, 4, 10, 0.34)';
        ctx.fillRect(px, py, TILE, TILE);
        // Soften the top of the zone where it meets lit air.
        if (!level.grid[y - 1] || level.grid[y - 1][x] !== ',') {
          const grad = ctx.createLinearGradient(0, py - 12, 0, py + 8);
          grad.addColorStop(0, 'rgba(2, 4, 10, 0)');
          grad.addColorStop(1, 'rgba(2, 4, 10, 0.34)');
          ctx.fillStyle = grad;
          ctx.fillRect(px, py - 12, TILE, 20);
        }
      }
    }
  }

  // Solid slabs: floors you can read by their lit top edge, ceilings by
  // their shadowed underside, with seams, rivets and hazard stripes
  // warning the floor in front of lasers and keycard doors.
  drawSlabs(level) {
    const ctx = this.ctx;
    const grid = level.grid;
    const hazardCols = new Set();
    if (this.game.levelIndex > 0) {
      for (const lz of level.lasers) {
        const tx = Math.round(lz.x1 / TILE);
        hazardCols.add(tx - 1);
        hazardCols.add(tx);
      }
      for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[y].length; x++) {
          if (grid[y][x] === 'D') {
            hazardCols.add(x - 1);
            hazardCols.add(x + 1);
          }
        }
      }
    }
    const isSlab = (x, y) => grid[y] && grid[y][x] === '#';
    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid[y].length; x++) {
        if (grid[y][x] !== '#') continue;
        const px = x * TILE;
        const py = y * TILE;
        ctx.fillStyle = COLORS.slabFace;
        ctx.fillRect(px, py, TILE, TILE);
        // Panel seam down the middle of deep structure.
        ctx.fillStyle = 'rgba(8, 12, 22, 0.35)';
        ctx.fillRect(px, py + TILE - 2, TILE, 2);
        if (!isSlab(x, y - 1)) {
          // Walking surface: lit top edge, sheen, rivets.
          ctx.fillStyle = COLORS.slab;
          ctx.fillRect(px, py, TILE, 9);
          ctx.fillStyle = COLORS.slabTop;
          ctx.fillRect(px, py, TILE, 3);
          ctx.fillStyle = 'rgba(220, 235, 255, 0.20)';
          ctx.fillRect(px + 3, py + 5, 2.5, 2.5);
          ctx.fillRect(px + TILE - 6, py + 5, 2.5, 2.5);
          if (hazardCols.has(x)) {
            // Hazard chevrons striped along the danger floor.
            ctx.save();
            ctx.beginPath();
            ctx.rect(px, py, TILE, 9);
            ctx.clip();
            ctx.fillStyle = 'rgba(255, 178, 32, 0.5)';
            for (let s = -1; s < 4; s++) {
              ctx.beginPath();
              ctx.moveTo(px + s * 12, py + 9);
              ctx.lineTo(px + s * 12 + 6, py);
              ctx.lineTo(px + s * 12 + 12, py);
              ctx.lineTo(px + s * 12 + 6, py + 9);
              ctx.fill();
            }
            ctx.restore();
          }
        }
        if (!isSlab(x, y + 1)) {
          // Underside: a shadowed skirt with a faint rim of light.
          ctx.fillStyle = COLORS.slabSide;
          ctx.fillRect(px, py + TILE - 6, TILE, 6);
          ctx.fillStyle = 'rgba(160, 190, 240, 0.16)';
          ctx.fillRect(px, py + TILE - 7, TILE, 1);
          // Drop shadow onto whatever lies below.
          ctx.fillStyle = 'rgba(0, 0, 0, 0.30)';
          ctx.fillRect(px - 2, py + TILE, TILE + 4, 7);
        }
        if (!isSlab(x - 1, y)) {
          ctx.fillStyle = 'rgba(200, 220, 255, 0.10)';
          ctx.fillRect(px, py, 2, TILE);
        }
        if (!isSlab(x + 1, y)) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
          ctx.fillRect(px + TILE - 2, py, 2, TILE);
        }
      }
    }
  }

  drawLadders(level) {
    const ctx = this.ctx;
    ctx.strokeStyle = COLORS.ladder;
    ctx.lineWidth = 2.5;
    for (let y = 0; y < level.grid.length; y++) {
      for (let x = 0; x < level.grid[y].length; x++) {
        if (level.grid[y][x] !== 'H') continue;
        const px = x * TILE;
        const py = y * TILE;
        ctx.beginPath();
        ctx.moveTo(px + 7, py);
        ctx.lineTo(px + 7, py + TILE);
        ctx.moveTo(px + TILE - 7, py);
        ctx.lineTo(px + TILE - 7, py + TILE);
        ctx.stroke();
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px + 7, py + 9);
        ctx.lineTo(px + TILE - 7, py + 9);
        ctx.moveTo(px + 7, py + 21);
        ctx.lineTo(px + TILE - 7, py + 21);
        ctx.stroke();
        ctx.lineWidth = 2.5;
      }
    }
  }

  drawDoors(level, doorsOpen) {
    const ctx = this.ctx;
    const drawn = new Set();
    for (let y = 0; y < level.grid.length; y++) {
      for (let x = 0; x < level.grid[y].length; x++) {
        if (level.grid[y][x] !== 'D' || drawn.has(x)) continue;
        drawn.add(x);
        // Measure the column's full height.
        let y2 = y;
        while (level.grid[y2] && level.grid[y2][x] === 'D') y2 += 1;
        const px = x * TILE;
        const py = y * TILE;
        const ph = (y2 - y) * TILE;
        // Frame and slab: the door reads as a doorway, not a tile.
        ctx.fillStyle = '#131a29';
        ctx.fillRect(px - 3, py - 2, TILE + 6, ph + 2);
        ctx.fillStyle = doorsOpen ? '#1d2f24' : '#2c2118';
        ctx.fillRect(px, py, TILE, ph);
        ctx.fillStyle = doorsOpen ? 'rgba(61, 255, 122, 0.30)' : 'rgba(255, 176, 32, 0.6)';
        ctx.fillRect(px, py + ph * 0.45, TILE, 6);
        ctx.strokeStyle = 'rgba(190, 210, 245, 0.25)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 4.5, py + 6.5, TILE - 9, ph - 13);
        // Status lamp and label above the frame.
        ctx.fillStyle = doorsOpen ? COLORS.ok : '#ffb020';
        ctx.beginPath();
        ctx.arc(px + TILE / 2, py - 8, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = `700 9px ${FONT_UI}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = doorsOpen ? '#b9ffd2' : '#ffe9a8';
        ctx.fillText(doorsOpen ? 'OPEN' : 'KEYCARD', px + TILE / 2, py + ph + 12);
      }
    }
  }

  // Is this the piece of furniture the operative is hiding behind now?
  hidesPlayer(c) {
    const p = this.game.player;
    if (!p || !p.crouching) return false;
    if (Math.abs(p.y - (c.y + c.h)) > 5) return false;
    const centre = c.x + c.w / 2;
    return Math.abs(p.x - centre) < c.w / 2 + 16;
  }

  drawCoverSet(level, front) {
    for (const c of level.cover) {
      if (this.hidesPlayer(c) === front) this.drawCover(c);
    }
  }

  drawCover(c) {
    const ctx = this.ctx;
    const { x, y, w, h } = c;
    // Ground shadow first: furniture sits IN the room.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h + 2, w / 2 + 4, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    if (c.kind === 'crate') {
      ctx.fillStyle = '#57493a';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#6a5942';
      ctx.fillRect(x, y, w, 5);
      ctx.strokeStyle = '#2c251c';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
      ctx.beginPath();
      ctx.moveTo(x + 2, y + 2);
      ctx.lineTo(x + w - 2, y + h - 2);
      ctx.moveTo(x + w - 2, y + 2);
      ctx.lineTo(x + 2, y + h - 2);
      ctx.stroke();
      ctx.font = `700 8px ${FONT_UI}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255, 240, 200, 0.5)';
      ctx.fillText('SUPPLY', x + w / 2, y + h / 2 + 3);
    } else if (c.kind === 'desk') {
      // A teller counter with a glowing monitor.
      ctx.fillStyle = '#3a3f4d';
      ctx.fillRect(x, y + h - 8, w, 8);
      ctx.fillStyle = '#2b303d';
      ctx.fillRect(x + 3, y + 10, w - 6, h - 18);
      ctx.fillStyle = '#4a5165';
      ctx.fillRect(x, y + 6, w, 5);
      ctx.fillStyle = '#0d1522';
      ctx.fillRect(x + w * 0.55, y - 12, 17, 13);
      ctx.fillStyle = 'rgba(110, 216, 255, 0.55)';
      ctx.fillRect(x + w * 0.55 + 2, y - 10, 13, 9);
      ctx.fillStyle = '#59637a';
      ctx.fillRect(x + w * 0.55 + 7, y + 1, 3, 5);
    } else {
      // Server rack: vents, slots, live LEDs.
      ctx.fillStyle = '#12161f';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#2c3852';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      for (let v = 0; v < 4; v++) ctx.fillRect(x + 5, y + 8 + v * 7, w - 10, 2.5);
      const now = performance.now();
      for (let led = 0; led < 5; led++) {
        const hh = tileHash(x + led * 13, y);
        const blink = hh > 0.8 && Math.sin(now / 280 + hh * 30) > 0.3;
        ctx.fillStyle = blink ? '#ffd23f' : hh > 0.45 ? 'rgba(61, 255, 122, 0.7)' : 'rgba(110, 216, 255, 0.5)';
        ctx.fillRect(x + 6 + led * 4.6, y + h - 12, 2.6, 2.6);
      }
      ctx.fillStyle = 'rgba(190, 210, 245, 0.16)';
      ctx.fillRect(x, y, w, 2);
    }
  }

  drawLasers(level) {
    const ctx = this.ctx;
    const now = performance.now();
    for (const lz of level.lasers) {
      // A slim pylon behind free-standing beams (the ground gate).
      if (Math.abs(lz.x1 - lz.x2) < 1) {
        ctx.fillStyle = '#1a2233';
        ctx.fillRect(lz.x1 - 12, Math.min(lz.y1, lz.y2), 5, Math.abs(lz.y2 - lz.y1));
        ctx.fillStyle = 'rgba(255, 178, 32, 0.5)';
        for (let py = Math.min(lz.y1, lz.y2) + 8; py < Math.max(lz.y1, lz.y2) - 4; py += 16) {
          ctx.fillRect(lz.x1 - 12, py, 5, 5);
        }
      }
      const pulse = lz.active ? 0.82 + Math.sin(now / 90) * 0.18 : 0;
      if (lz.active) {
        ctx.save();
        ctx.shadowColor = 'rgba(255, 46, 77, 0.9)';
        ctx.shadowBlur = 10;
        ctx.strokeStyle = `rgba(255, 46, 77, ${pulse})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(lz.x1, lz.y1);
        ctx.lineTo(lz.x2, lz.y2);
        ctx.stroke();
        ctx.restore();
        ctx.strokeStyle = 'rgba(255, 190, 200, 0.85)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(lz.x1, lz.y1);
        ctx.lineTo(lz.x2, lz.y2);
        ctx.stroke();
      } else {
        ctx.strokeStyle = 'rgba(255, 46, 77, 0.13)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.moveTo(lz.x1, lz.y1);
        ctx.lineTo(lz.x2, lz.y2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      for (const [ex, ey] of [[lz.x1, lz.y1], [lz.x2, lz.y2]]) {
        ctx.fillStyle = '#2a2f3d';
        ctx.fillRect(ex - 6, ey - 6, 12, 12);
        ctx.fillStyle = '#4a5468';
        ctx.fillRect(ex - 6, ey - 6, 12, 3);
        ctx.fillStyle = lz.active ? '#ff2e4d' : '#5c2331';
        ctx.beginPath();
        ctx.arc(ex, ey, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  drawCone(x, y, angle, halfAngle, range, stops, edge) {
    const ctx = this.ctx;
    const pts = computeVisionCone(this.game.level, x, y, angle, halfAngle, range, this.game.doorsOpen);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    // Gradient falloff: bright at the watcher, gone at the rim, with a
    // faint pulse so the cone feels alive rather than painted on.
    const pulse = 1 + Math.sin(performance.now() / 700 + x * 0.01) * 0.03;
    const grad = ctx.createRadialGradient(x, y, 6, x, y, range * pulse);
    grad.addColorStop(0, stops[0]);
    grad.addColorStop(0.55, fadeStop(stops[0], 0.45));
    grad.addColorStop(1, stops[1]);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1.25;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  drawCamera(cam) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(cam.x, cam.y);
    // Hanging mount and bracket.
    ctx.fillStyle = '#39465e';
    ctx.fillRect(-2, -8, 4, 9);
    ctx.fillRect(-8, -2, 16, 5);
    ctx.rotate(cam.axis);
    // Body and lens, aimed along the sweep.
    ctx.fillStyle = '#aebfd9';
    ctx.fillRect(-4, -5, 15, 10);
    ctx.fillStyle = '#d7e3f5';
    ctx.fillRect(7, -5, 4, 10);
    ctx.fillStyle = '#101c30';
    ctx.beginPath();
    ctx.arc(11, 0, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7fd8ff';
    ctx.beginPath();
    ctx.arc(11, 0, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Status light: amber while its meter climbs, red at full.
    if (cam.meter > 0.05) {
      ctx.fillStyle = cam.meter >= 1 ? '#ff3c32' : '#ffb020';
      ctx.beginPath();
      ctx.arc(cam.x + 10, cam.y + 8, 2.5 + cam.meter * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---- figures ----

  limb(x1, y1, x2, y2, color, width) {
    const ctx = this.ctx;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  drawGuard(gd) {
    const ctx = this.ctx;
    const c = COLORS;
    ctx.save();
    ctx.translate(gd.x, gd.y);

    if (gd.knocked) {
      // Slumped on the floor: body flat, head at one end, rifle beside.
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(0, 2, 20, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = c.guardDark;
      ctx.beginPath();
      ctx.ellipse(-2, -6, 16, 7, -0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#d8b28c';
      ctx.beginPath();
      ctx.arc(13, -6, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2e3444';
      ctx.beginPath();
      ctx.arc(13, -8, 6, Math.PI, Math.PI * 2);
      ctx.fill();
      this.limb(6, -3, 20, 0, '#22262f', 4);
      this.limb(-10, -3, -22, -1, '#22262f', 4);
      ctx.fillStyle = c.guardDark;
      ctx.fillRect(-34, -4, 14, 4);
      ctx.restore();
      ctx.font = `700 10px ${FONT_UI}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#9fb2d8';
      ctx.fillText('DOWN', gd.x, gd.y - 24);
      return;
    }

    const f = gd.facing;
    const moving = gd.state === 'patrol' || gd.state === 'return' || gd.state === 'suspicious';
    const sw = moving ? Math.sin(gd.walkPhase) * 7 : 0;
    const bob = moving ? Math.abs(Math.sin(gd.walkPhase)) * 1.6 : 0;
    const alert = gd.state === 'alarm';
    const lean = gd.state === 'suspicious' ? 3 : alert ? 2 : 0;

    // Ground shadow.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 13, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Legs and boots.
    this.limb(0, -22, sw, 0, '#232833', 5.5);
    this.limb(0, -22, -sw, 0, '#1b202a', 5.5);
    ctx.fillStyle = '#0c0f16';
    ctx.fillRect(f * sw - 3 + (f > 0 ? 0 : -2), -2.5, 7, 3);
    ctx.fillRect(f * -sw - 3 + (f > 0 ? 0 : -2), -2.5, 7, 3);
    // Torso: uniform, darker vest, state tint when the alarm is up.
    ctx.save();
    ctx.translate(0, -bob);
    ctx.fillStyle = alert ? '#7d2b26' : c.guardDark;
    ctx.beginPath();
    ctx.roundRect(-6.5 + f * lean * 0.4, -44, 13, 23, 4);
    ctx.fill();
    ctx.fillStyle = c.guardGear;
    ctx.fillRect(-5 + f * lean * 0.4, -40, 10, 13);
    ctx.fillStyle = 'rgba(230, 240, 255, 0.25)';
    ctx.fillRect(-5 + f * lean * 0.4, -40, 10, 2);
    // Rifle: held ready when suspicious or alarmed, slung otherwise.
    ctx.fillStyle = '#14181f';
    if (alert || gd.state === 'suspicious') {
      ctx.save();
      ctx.translate(f * 5, -32);
      ctx.rotate(f * 0.5);
      ctx.fillRect(0, -2, 17, 4.5);
      ctx.fillRect(11, 2, 3.5, 5);
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(-f * 6, -40);
      ctx.rotate(f * 0.6);
      ctx.fillRect(-2, 0, 4.5, 17);
      ctx.restore();
    }
    // Arm.
    this.limb(f * 2, -40, f * (alert || gd.state === 'suspicious' ? 12 : 6), -26, '#5d2721', 4.5);
    // Head: skin, cap with a visor toward the facing, earpiece.
    ctx.fillStyle = '#d8b28c';
    ctx.beginPath();
    ctx.arc(f * (1 + lean * 0.5), -49, 6.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2e3444';
    ctx.beginPath();
    ctx.arc(f * (1 + lean * 0.5), -50.5, 6.6, Math.PI * 0.95, Math.PI * 2.05);
    ctx.fill();
    ctx.fillRect(f * (1 + lean * 0.5) + (f > 0 ? 0 : -11), -51, 11, 2.6);
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(-f * 5 - 1, -47, 2, 3);
    ctx.restore();
    ctx.restore();

    // Detection meter: an arc that fills over the guard.
    if (gd.meter > 0.02) {
      ctx.strokeStyle = 'rgba(10, 14, 24, 0.75)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(gd.x, gd.y - 62, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = gd.meter >= 1 ? '#ff3c32' : '#ffb020';
      ctx.beginPath();
      ctx.arc(gd.x, gd.y - 62, 10, -Math.PI / 2, -Math.PI / 2 + gd.meter * Math.PI * 2);
      ctx.stroke();
    }
    // Alert marker.
    if (gd.state === 'suspicious' || gd.state === 'alarm') {
      const col = gd.state === 'alarm' ? '#ff3c32' : '#ffb020';
      ctx.save();
      ctx.translate(gd.x, gd.y - 78);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = col;
      ctx.fillRect(-4.5, -4.5, 9, 9);
      ctx.restore();
      ctx.font = `700 11px ${FONT_UI}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = col;
      ctx.fillText(gd.state === 'alarm' ? '!' : '?', gd.x, gd.y - 74);
    }
  }

  drawPlayer(p) {
    const ctx = this.ctx;
    const c = COLORS;
    const dark = p.shadowed;
    const body = dark ? c.playerDark : c.player;
    const suit = dark ? '#0d2226' : '#16444b';
    const pants = dark ? '#0a181c' : '#10333a';
    const f = p.facing;

    ctx.save();
    ctx.translate(p.x, p.y);
    // Soft ground shadow, plus a wide low ring while sneaking.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 12, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
    if (p.crouching) {
      ctx.strokeStyle = 'rgba(127, 216, 255, 0.13)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, 1, 20, 5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (p.climbing) {
      // On the ladder: back to camera-ish, rungs between the limbs.
      this.limb(0, -20, -7, -6, pants, 5);
      this.limb(0, -20, 7, -12, pants, 5);
      ctx.fillStyle = suit;
      ctx.beginPath();
      ctx.roundRect(-6.5, -40, 13, 21, 4);
      ctx.fill();
      ctx.fillStyle = dark ? '#12333a' : '#1d5a63';
      ctx.fillRect(-10, -38, 5, 14);
      this.limb(-3, -36, -8, -26 - Math.sin(p.walkPhase) * 3, suit, 4.5);
      this.limb(3, -36, 8, -26 + Math.sin(p.walkPhase) * 3, suit, 4.5);
      ctx.fillStyle = '#caa27e';
      ctx.beginPath();
      ctx.arc(0, -45, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = body;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, -45.5, 6.4, Math.PI * 0.9, Math.PI * 2.1);
      ctx.stroke();
    } else if (p.crouching) {
      // Low profile: knees bent, torso pitched forward, head tucked.
      this.limb(0, -14, 8, -6, pants, 5);
      this.limb(8, -6, 5, 0, pants, 5);
      this.limb(0, -14, -7, -7, pants, 5);
      this.limb(-7, -7, -9, 0, pants, 5);
      ctx.save();
      ctx.translate(0, 0);
      ctx.rotate(f * 0.5);
      ctx.fillStyle = suit;
      ctx.beginPath();
      ctx.roundRect(-6, -30, 13, 18, 4);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = dark ? '#12333a' : '#1d5a63';
      ctx.fillRect(f > 0 ? -11 : 6, -28, 5, 12);
      this.limb(f * 4, -24, f * 11, -13, suit, 4.5);
      ctx.fillStyle = '#caa27e';
      ctx.beginPath();
      ctx.arc(f * 10, -30, 5.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = body;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(f * 10, -30.5, 6.2, Math.PI * 0.85, Math.PI * 2.15);
      ctx.stroke();
      // Rim light along the hood.
      ctx.strokeStyle = 'rgba(160, 240, 255, 0.75)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(f * 10, -30.5, 6.6, Math.PI * 1.05, Math.PI * 1.6);
      ctx.stroke();
    } else {
      const moving = p.moving;
      const sw = moving ? Math.sin(p.walkPhase) * 8 : 0;
      const bob = moving ? Math.abs(Math.sin(p.walkPhase)) * 1.8 : 0;
      this.limb(0, -23, sw, 0, pants, 5.5);
      this.limb(0, -23, -sw, 0, pants, 5.5);
      ctx.fillStyle = '#0a1418';
      ctx.fillRect(f * sw - 3, -2.5, 7.5, 3);
      ctx.fillRect(f * -sw - 3, -2.5, 7.5, 3);
      ctx.save();
      ctx.translate(0, -bob);
      // Backpack behind the torso.
      ctx.fillStyle = dark ? '#12333a' : '#1d5a63';
      ctx.beginPath();
      ctx.roundRect(-f * 11 - 3, -42, 7, 17, 2.5);
      ctx.fill();
      // Torso with a slight forward lean.
      ctx.fillStyle = suit;
      ctx.beginPath();
      ctx.roundRect(-6 + f * 1.5, -45, 12.5, 23, 4);
      ctx.fill();
      ctx.fillStyle = 'rgba(160, 240, 255, 0.28)';
      ctx.fillRect(-6 + f * 1.5, -45, 12.5, 2.5);
      // Arm swinging opposite the stride.
      this.limb(f * 3, -41, f * 3 - sw * 0.7, -27, suit, 4.5);
      // Head with hood and a pale face in shadow.
      ctx.fillStyle = '#caa27e';
      ctx.beginPath();
      ctx.arc(f * 2.5, -50, 6.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = body;
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.arc(f * 2.5, -50.5, 6.6, Math.PI * 0.85, Math.PI * 2.15);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(160, 240, 255, 0.8)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(f * 2.5, -50.5, 7, Math.PI * 1.05, Math.PI * 1.65);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    // State tag above the operative when the dark is working for him.
    if (p.shadowed) {
      ctx.font = `700 10px ${FONT_UI}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(10, 14, 24, 0.7)';
      const label = 'HIDDEN';
      const tw = ctx.measureText(label).width + 22;
      ctx.fillRect(p.x - tw / 2, p.y - p.h - 24, tw, 15);
      this.icon('eye', p.x - tw / 2 + 9, p.y - p.h - 16.5, 7, '#7fd8ff');
      ctx.fillStyle = '#bfe9ff';
      ctx.fillText(label, p.x + 5, p.y - p.h - 13);
    }
  }

  // ---- pickups, fx, light ----

  drawCoin(x, y) {
    const ctx = this.ctx;
    const bob = Math.sin(performance.now() / 350 + x * 0.05) * 1.5;
    ctx.fillStyle = COLORS.coin;
    ctx.beginPath();
    ctx.arc(x, y + bob, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe89a';
    ctx.beginPath();
    ctx.arc(x - 1.5, y + bob - 1.5, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  drawKeycard(x, y) {
    const ctx = this.ctx;
    const bob = Math.sin(performance.now() / 300) * 2;
    ctx.save();
    ctx.translate(x, y - 16 + bob);
    ctx.rotate(-0.12);
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(-9, -6, 18, 12);
    ctx.fillStyle = '#20304a';
    ctx.fillRect(-9, -2, 18, 3.5);
    ctx.restore();
    ctx.font = `700 9px ${FONT_UI}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText('KEYCARD', x, y + 14);
  }

  drawIntel(x, y) {
    const ctx = this.ctx;
    // A pedestal terminal with the data core floating over it.
    ctx.fillStyle = '#232c3f';
    ctx.fillRect(x - 11, y - 10, 22, 10);
    ctx.fillStyle = '#39465e';
    ctx.fillRect(x - 13, y - 12, 26, 3);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(x - 13, y + 1, 26, 3);
    const pulse = 1 + Math.sin(performance.now() / 260) * 0.12;
    ctx.save();
    ctx.translate(x, y - 24 + Math.sin(performance.now() / 300) * 2);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = COLORS.intel;
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(7, 0);
    ctx.lineTo(0, 9);
    ctx.lineTo(-7, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.beginPath();
    ctx.moveTo(0, -4.5);
    ctx.lineTo(3.5, 0);
    ctx.lineTo(0, 4.5);
    ctx.lineTo(-3.5, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.font = `700 9px ${FONT_UI}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd9e2';
    ctx.fillText('INTEL', x, y + 16);
  }

  drawExit(x, y) {
    const ctx = this.ctx;
    const open = this.game.player && this.game.player.hasIntel;
    // A doorway standing on the floor: frame, glow when the run is done.
    ctx.fillStyle = '#101623';
    ctx.fillRect(x - 17, y - 54, 34, 54);
    ctx.strokeStyle = open ? COLORS.ok : '#3d5a48';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x - 17, y - 54, 34, 54);
    if (open) {
      const grad = ctx.createLinearGradient(0, y - 54, 0, y);
      grad.addColorStop(0, 'rgba(61, 255, 122, 0.35)');
      grad.addColorStop(1, 'rgba(61, 255, 122, 0.05)');
      ctx.fillStyle = grad;
      ctx.fillRect(x - 14, y - 51, 28, 51);
    } else {
      ctx.fillStyle = 'rgba(20, 30, 26, 0.85)';
      ctx.fillRect(x - 14, y - 51, 28, 51);
    }
    ctx.fillStyle = open ? '#b9ffd2' : '#5f7a68';
    ctx.beginPath();
    ctx.moveTo(x - 6, y - 38);
    ctx.lineTo(x + 2, y - 30);
    ctx.lineTo(x - 6, y - 22);
    ctx.lineTo(x - 6, y - 27);
    ctx.lineTo(x - 10, y - 30);
    ctx.lineTo(x - 6, y - 33);
    ctx.closePath();
    ctx.fill();
    ctx.font = `700 10px ${FONT_UI}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = open ? '#b9ffd2' : '#7d968a';
    ctx.fillText(open ? 'EXIT OPEN' : 'EXIT', x, y + 14);
    // A light strip on the floor in front of the door.
    ctx.fillStyle = open ? 'rgba(61, 255, 122, 0.35)' : 'rgba(61, 120, 90, 0.25)';
    ctx.fillRect(x - 20, y - 2, 40, 2);
  }

  drawFx() {
    const ctx = this.ctx;
    const g = this.game;
    for (const fx of g.particles) {
      ctx.globalAlpha = Math.max(0, fx.life / fx.maxLife);
      ctx.fillStyle = fx.color;
      ctx.fillRect(fx.x - fx.size / 2, fx.y - fx.size / 2, fx.size, fx.size);
    }
    ctx.globalAlpha = 1;
    for (const f of g.floaters) {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
      ctx.font = `700 ${f.size}px ${FONT_UI}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  // Warm pools under the fixtures: a wash on the walking surface every
  // few tiles, with a rod and lamp where a ceiling hangs close above.
  drawLightPools(level) {
    const ctx = this.ctx;
    const grid = level.grid;
    for (let y = 1; y < grid.length; y++) {
      for (let x = 2; x < grid[y].length - 2; x++) {
        if (grid[y][x] !== '#' || grid[y - 1][x] === '#') continue;
        if (x % 6 !== 2) continue;
        const sx = x * TILE + TILE / 2;
        const sy = y * TILE;
        const grad = ctx.createRadialGradient(sx, sy, 4, sx, sy, 96);
        grad.addColorStop(0, 'rgba(255, 214, 140, 0.10)');
        grad.addColorStop(1, 'rgba(255, 214, 140, 0)');
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(sx, sy + 3, 96, 26, 0, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = grad;
        ctx.fillRect(sx - 96, sy - 24, 192, 52);
        ctx.restore();
        // Fixture: find a ceiling within five tiles and hang a lamp.
        for (let up = 2; up <= 5; up++) {
          if (grid[y - up] && grid[y - up][x] === '#') {
            const fy = (y - up + 1) * TILE;
            ctx.strokeStyle = 'rgba(160, 180, 220, 0.35)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(sx, fy);
            ctx.lineTo(sx, fy + 10);
            ctx.stroke();
            ctx.fillStyle = '#2c3648';
            ctx.fillRect(sx - 8, fy + 10, 16, 5);
            ctx.fillStyle = 'rgba(255, 224, 160, 0.8)';
            ctx.fillRect(sx - 6, fy + 15, 12, 2);
            break;
          }
        }
      }
    }
  }

  drawVignette() {
    const ctx = this.ctx;
    const grad = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.42, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.85);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.38)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  // ---- HUD ----

  drawHud() {
    const g = this.game;
    const ctx = this.ctx;
    const p = g.player;
    const def = g.level.def;

    // Top-left: facility + operative state.
    this.panel(14, 12, 300, 62, 'rgba(8, 12, 22, 0.78)', 'rgba(120, 160, 230, 0.35)');
    ctx.textAlign = 'left';
    ctx.font = `15px ${FONT_DISPLAY}`;
    ctx.fillStyle = '#e8f1ff';
    ctx.fillText(def.name, 28, 36);
    ctx.font = `600 11px ${FONT_UI}`;
    ctx.fillStyle = '#8fa5c8';
    ctx.fillText(`${GAME_TITLE} — SIDE INFILTRATION`, 28, 56);
    if (g.alarm) {
      ctx.fillStyle = '#ff5040';
      ctx.font = `700 12px ${FONT_UI}`;
      ctx.fillText('ALARM RAISED', 200, 56);
    }

    // Top-centre: the detection gauge, segmented and eased.
    const worst = g.topMeter;
    this.panel(VIEW_W / 2 - 130, 12, 260, 44, 'rgba(8, 12, 22, 0.78)', 'rgba(120, 160, 230, 0.35)');
    ctx.textAlign = 'center';
    ctx.font = `700 10px ${FONT_UI}`;
    ctx.fillStyle = '#8fa5c8';
    ctx.fillText('DETECTION', VIEW_W / 2, 27);
    const segW = 22;
    const segGap = 4;
    const totalW = 8 * segW + 7 * segGap;
    for (let i = 0; i < 8; i++) {
      const filled = worst >= (i + 1) / 8 - 0.001;
      const partial = !filled && worst > i / 8;
      const sx = VIEW_W / 2 - totalW / 2 + i * (segW + segGap);
      ctx.fillStyle = 'rgba(70, 90, 130, 0.35)';
      ctx.fillRect(sx, 34, segW, 9);
      if (filled || partial) {
        ctx.fillStyle = worst >= 0.99 ? '#ff3c32' : worst > 0.55 ? '#ffb020' : '#7fd8ff';
        ctx.fillRect(sx, 34, partial ? segW * (worst * 8 - i) : segW, 9);
      }
    }

    // Top-right: time and mute.
    this.panel(VIEW_W - 190, 12, 176, 44, 'rgba(8, 12, 22, 0.78)', 'rgba(120, 160, 230, 0.35)');
    this.icon('clock', VIEW_W - 168, 34, 13, '#8fa5c8');
    ctx.textAlign = 'left';
    ctx.font = `700 17px ${FONT_UI}`;
    ctx.fillStyle = '#e8f1ff';
    ctx.fillText(formatTime(g.time), VIEW_W - 152, 40);
    ctx.font = `600 10px ${FONT_UI}`;
    ctx.fillStyle = '#8fa5c8';
    ctx.fillText(g.sound.muted ? 'MUTED (M)' : 'SOUND (M)', VIEW_W - 96, 40);

    // Bottom-left: what the run still needs, ticked off as it happens.
    const items = [];
    if (g.level.keycard) items.push({ label: 'KEYCARD', done: p.hasKeycard, icon: 'key' });
    items.push({ label: 'STEAL THE INTEL', done: p.hasIntel, icon: 'doc' });
    items.push({ label: 'REACH THE EXIT', done: false, icon: 'exit' });
    const boxH = 26 + items.length * 21;
    this.panel(14, VIEW_H - boxH - 12, 208, boxH, 'rgba(8, 12, 22, 0.78)', 'rgba(120, 160, 230, 0.35)');
    ctx.font = `700 10px ${FONT_UI}`;
    ctx.fillStyle = '#8fa5c8';
    ctx.fillText('OBJECTIVES', 28, VIEW_H - boxH + 12);
    items.forEach((it, i) => {
      const y = VIEW_H - boxH + 32 + i * 21;
      this.icon(it.icon, 36, y - 4, 10, it.done ? '#3dff7a' : '#c8d6f2');
      ctx.font = `600 12.5px ${FONT_UI}`;
      ctx.fillStyle = it.done ? '#3dff7a' : '#dbe6fb';
      ctx.fillText(it.label, 50, y);
      if (it.done) {
        ctx.strokeStyle = '#3dff7a';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(196, y - 4);
        ctx.lineTo(200, y);
        ctx.lineTo(207, y - 8);
        ctx.stroke();
      }
    });

    // Bottom-centre: the controls, one quiet line.
    ctx.textAlign = 'center';
    ctx.font = `600 11.5px ${FONT_UI}`;
    ctx.fillStyle = 'rgba(160, 180, 220, 0.75)';
    ctx.fillText('A/D MOVE — W/S LADDERS — SHIFT CROUCH — Q / CLICK THROW COIN — E TAKEDOWN — ESC PAUSE — M MUTE', VIEW_W / 2, VIEW_H - 16);

    // Bottom-right: pockets and posture.
    this.panel(VIEW_W - 224, VIEW_H - 52, 210, 40, 'rgba(8, 12, 22, 0.78)', 'rgba(120, 160, 230, 0.35)');
    this.icon('coin', VIEW_W - 202, VIEW_H - 32, 12, '#ffd23f');
    ctx.textAlign = 'left';
    ctx.font = `700 14px ${FONT_UI}`;
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(`x ${p.coins}`, VIEW_W - 190, VIEW_H - 27);
    ctx.font = `600 11px ${FONT_UI}`;
    ctx.fillStyle = p.shadowed ? '#7fd8ff' : p.crouching ? '#bfe9ff' : '#8fa5c8';
    const posture = p.climbing ? 'ON LADDER' : p.shadowed ? 'IN SHADOW — HARD TO SEE' : p.crouching ? 'CROUCHED — LOW AND QUIET' : 'EXPOSED';
    ctx.fillText(posture, VIEW_W - 140, VIEW_H - 27);

    // Centre toast.
    if (g.messageTimer > 0 && g.message) {
      ctx.font = `600 15px ${FONT_UI}`;
      const tw = ctx.measureText(g.message).width + 36;
      this.panel(VIEW_W / 2 - tw / 2, 74, tw, 34, 'rgba(8, 12, 22, 0.85)', 'rgba(255, 210, 63, 0.4)');
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffe9a8';
      ctx.fillText(g.message, VIEW_W / 2, 96);
    }
  }

  // ---- brief and overlays ----

  drawBrief() {
    const g = this.game;
    const ctx = this.ctx;
    const def = g.level.def;
    ctx.fillStyle = 'rgba(3, 5, 10, 0.82)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const w = 620;
    const h = 436;
    const x = (VIEW_W - w) / 2;
    const y = (VIEW_H - h) / 2;
    this.panel(x, y, w, h, 'rgba(10, 15, 27, 0.97)', 'rgba(127, 216, 255, 0.55)');

    ctx.textAlign = 'left';
    ctx.font = `700 11px ${FONT_UI}`;
    ctx.fillStyle = '#7fd8ff';
    ctx.fillText(`MISSION BRIEF — FACILITY ${g.levelIndex + 1} OF ${LEVELS.length}`, x + 34, y + 42);
    ctx.font = `30px ${FONT_DISPLAY}`;
    ctx.fillStyle = '#f2f7ff';
    ctx.fillText(def.name, x + 34, y + 82);
    ctx.font = `600 13px ${FONT_UI}`;
    ctx.fillStyle = '#93a9cf';
    ctx.fillText(def.op, x + 34, y + 106);

    ctx.strokeStyle = 'rgba(127, 216, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 34, y + 122);
    ctx.lineTo(x + w - 34, y + 122);
    ctx.stroke();

    ctx.font = `700 11px ${FONT_UI}`;
    ctx.fillStyle = '#7fd8ff';
    ctx.fillText('THE JOB', x + 34, y + 146);
    ctx.font = `600 14.5px ${FONT_UI}`;
    ctx.fillStyle = '#dbe6fb';
    def.objectives.forEach((line, i) => ctx.fillText(line, x + 34, y + 170 + i * 21));

    ctx.font = `700 11px ${FONT_UI}`;
    ctx.fillStyle = '#7fd8ff';
    ctx.fillText('INTEL ON THE GROUND', x + 34, y + 248);
    ctx.font = `600 13.5px ${FONT_UI}`;
    ctx.fillStyle = '#b9c9e8';
    wrapTextLeft(ctx, def.intel.join(' '), x + 34, y + 272, w - 68, 19);

    this.button(x + w / 2 - 120, y + h - 58, 240, 40, 'BEGIN INFILTRATION', () => { g.briefing = false; }, true);
    ctx.textAlign = 'center';
    ctx.font = `600 11px ${FONT_UI}`;
    ctx.fillStyle = '#7186ab';
    ctx.fillText('Any key or click deploys you — read it first, the guards are already walking', x + w / 2, y + h + 22);
  }

  dimScreen(alpha) {
    this.ctx.fillStyle = `rgba(3, 5, 10, ${alpha})`;
    this.ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  drawPaused() {
    const ctx = this.ctx;
    this.dimScreen(0.72);
    ctx.textAlign = 'center';
    ctx.font = `34px ${FONT_DISPLAY}`;
    ctx.fillStyle = '#f2f7ff';
    ctx.fillText('PAUSED', VIEW_W / 2, VIEW_H / 2 - 40);
    ctx.font = `600 14px ${FONT_UI}`;
    ctx.fillStyle = '#a9bce0';
    ctx.fillText('The facility holds its breath with you.', VIEW_W / 2, VIEW_H / 2 - 12);
    ctx.font = `700 14px ${FONT_UI}`;
    ctx.fillStyle = '#7fd8ff';
    ctx.fillText('ESC — RESUME', VIEW_W / 2, VIEW_H / 2 + 28);
    ctx.fillStyle = '#8fa5c8';
    ctx.fillText('Q — ABANDON TO TITLE', VIEW_W / 2, VIEW_H / 2 + 54);
  }

  drawCaught() {
    const g = this.game;
    const ctx = this.ctx;
    this.dimScreen(0.66);
    ctx.strokeStyle = 'rgba(255, 60, 50, 0.6)';
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, VIEW_W - 20, VIEW_H - 20);
    ctx.textAlign = 'center';
    ctx.font = `38px ${FONT_DISPLAY}`;
    ctx.fillStyle = '#ff5040';
    ctx.fillText('COMPROMISED', VIEW_W / 2, VIEW_H / 2 - 66);
    ctx.font = `600 15px ${FONT_UI}`;
    ctx.fillStyle = '#f0d9d6';
    ctx.fillText('A guard got a hand on you. The run is blown.', VIEW_W / 2, VIEW_H / 2 - 34);
    ctx.font = `600 13.5px ${FONT_UI}`;
    ctx.fillStyle = '#a9bce0';
    ctx.fillText(`Held for ${formatTime(g.time)} — detections this run: ${g.stats.detections}. The dark was there; use more of it.`, VIEW_W / 2, VIEW_H / 2 - 10);
    this.button(VIEW_W / 2 - 120, VIEW_H / 2 + 16, 240, 42, 'TRY AGAIN (R)', () => g.retryLevel());
    this.button(VIEW_W / 2 - 120, VIEW_H / 2 + 70, 240, 42, 'BACK TO TITLE', () => g.backToTitle());
  }

  drawComplete() {
    const g = this.game;
    const ctx = this.ctx;
    const r = g.result;
    this.dimScreen(0.6);
    const w = 520;
    const h = 380;
    const x = (VIEW_W - w) / 2;
    const y = (VIEW_H - h) / 2;
    this.panel(x, y, w, h, 'rgba(10, 15, 27, 0.96)', 'rgba(127, 216, 255, 0.5)');
    ctx.textAlign = 'center';
    ctx.font = `24px ${FONT_DISPLAY}`;
    ctx.fillStyle = '#f2f7ff';
    ctx.fillText('EXTRACTION CLEAN', VIEW_W / 2, y + 52);
    ctx.font = `600 13px ${FONT_UI}`;
    ctx.fillStyle = '#93a9cf';
    ctx.fillText(g.level.def.name, VIEW_W / 2, y + 76);

    // The grade as a stamped verdict, rotated like ink on the dossier.
    ctx.save();
    ctx.translate(x + w - 92, y + 58);
    ctx.rotate(-0.16);
    ctx.strokeStyle = r.grade === 'S' ? '#ffd23f' : '#7fd8ff';
    ctx.lineWidth = 3;
    ctx.strokeRect(-34, -30, 68, 60);
    ctx.font = `44px ${FONT_DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = r.grade === 'S' ? '#ffd23f' : '#bfe9ff';
    ctx.fillText(r.grade, 0, 16);
    ctx.restore();

    const rows = [
      ['TIME', formatTime(r.timeSeconds)],
      ['DETECTIONS', String(r.detections)],
      ['TAKEDOWNS', String(r.takedowns)],
      ['COINS RECOVERED', String(r.coinsCollected)],
      ['GHOST BONUS', r.ghost ? '+1,500 — NEVER SPOTTED' : '—'],
      ['SCORE', String(r.score)],
    ];
    ctx.font = `600 14.5px ${FONT_UI}`;
    rows.forEach((row, i) => {
      const ry = y + 118 + i * 28;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#8fa5c8';
      ctx.fillText(row[0], x + 52, ry);
      ctx.textAlign = 'right';
      ctx.fillStyle = row[0] === 'SCORE' ? '#ffd23f' : '#e8f1ff';
      ctx.font = row[0] === 'SCORE' ? `700 17px ${FONT_UI}` : `600 14.5px ${FONT_UI}`;
      ctx.fillText(row[1], x + w - 52, ry);
      ctx.font = `600 14.5px ${FONT_UI}`;
    });

    this.button(x + 40, y + h - 62, 200, 40, 'NEXT FACILITY', () => g.startLevel(g.levelIndex + 1), true);
    this.button(x + w - 240, y + h - 62, 200, 40, 'REPLAY LEVEL', () => g.startLevel(g.levelIndex));
  }

  drawVictory() {
    const g = this.game;
    const ctx = this.ctx;
    this.dimScreen(0.78);
    ctx.textAlign = 'center';
    ctx.font = `38px ${FONT_DISPLAY}`;
    ctx.fillStyle = '#ffd23f';
    ctx.fillText('PROTOCOL COMPLETE', VIEW_W / 2, VIEW_H / 2 - 90);
    ctx.font = `600 15.5px ${FONT_UI}`;
    ctx.fillStyle = '#dbe6fb';
    wrapText(ctx, 'Three facilities, three secrets, and not one face on any camera that matters. The archive, the vault and the core all keep your secret — you were a rumour in their own halls.', VIEW_W / 2, VIEW_H / 2 - 52, 640, 22);
    ctx.font = `700 17px ${FONT_UI}`;
    ctx.fillStyle = '#e8f1ff';
    ctx.fillText(`TOTAL SCORE  ${g.totalScore}`, VIEW_W / 2, VIEW_H / 2 + 26);
    this.button(VIEW_W / 2 - 120, VIEW_H / 2 + 52, 240, 44, 'BACK TO TITLE', () => g.backToTitle(), true);
  }

  // ---- title ----

  drawTitle() {
    const g = this.game;
    const ctx = this.ctx;

    // A facility cross-section in silhouette behind the title: stacked
    // floors, a ladder, one cone sweeping the dark.
    const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    grad.addColorStop(0, '#0a0f1e');
    grad.addColorStop(1, '#04060c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = 'rgba(23, 42, 74, 0.5)';
    ctx.fillRect(0, 640, VIEW_W, 80);
    ctx.fillRect(120, 452, 700, 26);
    ctx.fillRect(560, 264, 720, 26);
    ctx.fillStyle = 'rgba(110, 216, 255, 0.22)';
    ctx.fillRect(0, 640, VIEW_W, 2);
    ctx.fillRect(120, 452, 700, 2);
    ctx.fillRect(560, 264, 720, 2);
    ctx.strokeStyle = 'rgba(140, 170, 230, 0.3)';
    ctx.lineWidth = 2;
    for (const [lx, ly, lh] of [[700, 478, 162], [240, 290, 162]]) {
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx, ly + lh);
      ctx.moveTo(lx + 16, ly);
      ctx.lineTo(lx + 16, ly + lh);
      for (let r = 12; r < lh; r += 18) {
        ctx.moveTo(lx, ly + r);
        ctx.lineTo(lx + 16, ly + r);
      }
      ctx.stroke();
    }
    // One sweeping cone.
    const sweep = Math.sin(performance.now() / 2400) * 0.5;
    ctx.save();
    ctx.translate(1010, 290);
    ctx.rotate(0.5 + sweep);
    const cg = ctx.createRadialGradient(0, 0, 4, 0, 0, 320);
    cg.addColorStop(0, 'rgba(255, 214, 94, 0.20)');
    cg.addColorStop(1, 'rgba(255, 214, 94, 0)');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 320, -0.42, 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.font = `58px ${FONT_DISPLAY}`;
    ctx.fillStyle = '#f2f7ff';
    ctx.fillText(GAME_TITLE, VIEW_W / 2, 118);
    ctx.font = `600 15px ${FONT_UI}`;
    ctx.fillStyle = '#7fd8ff';
    ctx.fillText(GAME_SUBTITLE, VIEW_W / 2, 148);
    ctx.font = `600 13.5px ${FONT_UI}`;
    ctx.fillStyle = '#a9bce0';
    ctx.fillText('Three facilities. One operative. Work the floors, own the dark, leave no face behind.', VIEW_W / 2, 178);

    // Facility cards.
    const cardW = 340;
    const gap = 28;
    const totalW = cardW * LEVELS.length + gap * (LEVELS.length - 1);
    const startX = (VIEW_W - totalW) / 2;
    LEVELS.forEach((def, i) => {
      const x = startX + i * (cardW + gap);
      const y = 216;
      const unlocked = i < g.progress.unlocked;
      const bestScore = g.progress.bestScores[i] || 0;
      const bestGrade = g.progress.grades[i];
      this.panel(x, y, cardW, 172, unlocked ? 'rgba(12, 19, 34, 0.92)' : 'rgba(8, 11, 19, 0.92)', unlocked ? 'rgba(127, 216, 255, 0.45)' : 'rgba(90, 105, 140, 0.3)');
      ctx.textAlign = 'left';
      ctx.font = `700 10.5px ${FONT_UI}`;
      ctx.fillStyle = unlocked ? '#7fd8ff' : '#5c6d8f';
      ctx.fillText(`OPERATION ${i + 1}${unlocked ? '' : ' — CLEAR THE PREVIOUS SITE FIRST'}`, x + 20, y + 30);
      ctx.font = `19px ${FONT_DISPLAY}`;
      ctx.fillStyle = unlocked ? '#f2f7ff' : '#7787a5';
      ctx.fillText(def.name, x + 20, y + 58);
      ctx.font = `600 12.5px ${FONT_UI}`;
      ctx.fillStyle = '#93a9cf';
      ctx.fillText(def.objectives[0], x + 20, y + 82);
      ctx.fillText(`Guards ${def.guards.length} — cameras ${def.cameras.length} — lasers ${def.lasers.length}`, x + 20, y + 104);
      if (bestGrade) {
        ctx.fillStyle = '#ffd23f';
        ctx.font = `700 13px ${FONT_UI}`;
        ctx.fillText(`BEST ${bestScore} — GRADE ${bestGrade}`, x + 20, y + 130);
      } else if (unlocked) {
        ctx.fillStyle = '#7186ab';
        ctx.font = `600 12.5px ${FONT_UI}`;
        ctx.fillText('Not yet infiltrated.', x + 20, y + 130);
      }
      if (unlocked) {
        this.game.buttons.push({ x, y, w: cardW, h: 172, onClick: () => g.startLevel(i) });
      }
    });

    ctx.textAlign = 'center';
    ctx.font = `600 13px ${FONT_UI}`;
    ctx.fillStyle = '#a9bce0';
    ctx.fillText('A/D OR ARROWS — MOVE        W/S — CLIMB LADDERS        SHIFT — CROUCH, LOW AND QUIET', VIEW_W / 2, 448);
    ctx.fillText('Q OR CLICK — THROW A COIN TO LURE A GUARD        E — SILENT TAKEDOWN FROM BEHIND', VIEW_W / 2, 472);
    ctx.fillText('HIDE IN THE DARK ZONES AND BEHIND CRATES AND RACKS. CAMERAS SWEEP. LASERS BLINK — CROSS WHILE THEY ARE DARK.', VIEW_W / 2, 496);
    ctx.fillStyle = '#ffd23f';
    ctx.fillText('Finish unseen for the GHOST bonus. Click a facility card to begin.', VIEW_W / 2, 528);
    const career = LEVELS.reduce((sum, _def, i) => sum + (g.progress.bestScores[i] || 0), 0);
    if (career > 0) {
      ctx.fillStyle = '#e8f1ff';
      ctx.font = `700 14px ${FONT_UI}`;
      ctx.fillText(`CAREER SCORE ${career}`, VIEW_W / 2, 562);
    }
  }

  button(x, y, w, h, label, action, primary) {
    const ctx = this.ctx;
    this.panel(x, y, w, h, primary ? 'rgba(24, 52, 84, 0.95)' : 'rgba(14, 22, 38, 0.95)', primary ? '#7fd8ff' : 'rgba(127, 160, 220, 0.5)');
    ctx.font = `700 14px ${FONT_UI}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = primary ? '#eaf7ff' : '#c8d6f2';
    ctx.fillText(label, x + w / 2, y + h / 2 + 5);
    this.game.buttons.push({ x, y, w, h, onClick: action });
  }
}

function formatTime(t) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function wrapTextLeft(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lh;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

function wrapText(ctx, text, cx, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, cx, yy);
      line = word;
      yy += lh;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, cx, yy);
}

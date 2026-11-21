// SHADOW PROTOCOL — everything the player sees.
// One job: draw the world (floors, bevelled walls, light and shadow, vision
// cones, detailed figures), the ops-style HUD, the mission brief, and the
// menu screens, all on one canvas. Buttons register their hit-boxes on the
// game so clicks work. All presentation: nothing here changes the game.

import { TILE, VIEW_W, VIEW_H, COLORS, FONT_DISPLAY, FONT_UI, GAME_TITLE, GAME_SUBTITLE } from './config.js';
import { LEVELS } from './levels.js';
import { computeVisionCone } from './vision.js';

// Deterministic per-tile hash: stable scuffs, seams and wear with no RNG
// state, so every frame (and every screenshot) draws the same floor.
function tileHash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >> 13)) | 0;
  h = Math.imul(h, 1274126177);
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

// Ceiling light fixtures: a pool of light every few tiles of open floor.
function lightAt(x, y) {
  return x % 5 === 2 && y % 5 === 2;
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
    const ctx = this.ctx;
    const level = g.level;
    const doorsOpen = g.doorsOpen;

    this.drawFloors(level);
    this.drawDoors(level, doorsOpen);
    this.drawWalls(level);
    this.drawLightAndShadow(level);

    // Vision cones: cameras first, then guards, coloured by alert state.
    for (const cam of level.cameras) {
      this.drawCone(cam.x, cam.y, cam.angle, cam.halfAngle, cam.range, COLORS.coneCamera, COLORS.coneCameraEdge);
    }
    for (const gd of level.guards) {
      if (gd.knocked) continue;
      const stops = coneStopsFor(gd);
      this.drawCone(gd.x, gd.y, gd.angle, gd.halfAngle, gd.range, stops, COLORS.conePatrolEdge);
    }

    // Lasers: glowing pulsing beams between their emitter posts.
    const now = performance.now();
    for (const lz of level.lasers) {
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

    // Pickups and objectives.
    if (level.keycard && !level.keycard.taken) this.drawKeycard(level.keycard.x, level.keycard.y);
    for (const c of level.coins) {
      if (!c.taken) this.drawCoin(c.x, c.y);
    }
    if (level.intel && !level.intel.taken) this.drawIntel(level.intel.x, level.intel.y);
    if (level.exit) this.drawExit(level.exit.x, level.exit.y);

    // Thrown coins: a gold lure with a fading noise ring guards can hear.
    for (const c of g.thrownCoins) {
      const pulse = 1 - c.ttl / 2.5;
      ctx.strokeStyle = `rgba(255, 207, 63, ${0.7 * (1 - pulse)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 8 + pulse * 70, 0, Math.PI * 2);
      ctx.stroke();
      this.drawCoin(c.x, c.y);
    }

    // Cameras: bracket mount, body, lens, status light.
    for (const cam of level.cameras) this.drawCamera(cam);

    // Guards, then the player.
    for (const gd of level.guards) this.drawGuard(gd);
    if (g.player) this.drawPlayer(g.player);

    this.drawFx();
    this.drawVignette();
  }

  drawFloors(level) {
    const ctx = this.ctx;
    for (let y = 0; y < level.grid.length; y++) {
      for (let x = 0; x < level.grid[y].length; x++) {
        const t = level.grid[y][x];
        if (t === '#') continue;
        const px = x * TILE;
        const py = y * TILE;
        const h = tileHash(x, y);
        if (t === ',') {
          // Shadow carpet: near-black, soft — safety you can read.
          ctx.fillStyle = (x + y) % 2 === 0 ? COLORS.shadowFloor : COLORS.shadowFloorB;
          ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = 'rgba(120, 150, 210, 0.05)';
          for (let i = 0; i < 3; i++) {
            const sx = px + 4 + tileHash(x * 3 + i, y) * 24;
            const sy = py + 4 + tileHash(x, y * 3 + i) * 24;
            ctx.fillRect(sx, sy, 3, 1);
          }
          continue;
        }
        // Plate-metal floor: alternating panels, seams, a sheen corner.
        const carpet = y >= 17 || (x >= 27 && y <= 7);
        ctx.fillStyle = carpet
          ? (x + y) % 2 === 0 ? COLORS.carpetA : COLORS.carpetB
          : (x + y) % 2 === 0 ? COLORS.floorA : COLORS.floorB;
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = COLORS.floorSheen;
        ctx.fillRect(px, py, TILE, 7);
        ctx.fillRect(px, py, 7, TILE);
        ctx.strokeStyle = COLORS.floorSeam;
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
        // Panel bolts.
        ctx.fillStyle = 'rgba(160, 185, 225, 0.20)';
        ctx.fillRect(px + 3, py + 3, 2, 2);
        ctx.fillRect(px + TILE - 5, py + 3, 2, 2);
        ctx.fillRect(px + 3, py + TILE - 5, 2, 2);
        ctx.fillRect(px + TILE - 5, py + TILE - 5, 2, 2);
        // Wear: scuffs and a darker worn patch, stable per tile.
        if (h > 0.55) {
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.16)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          const sx = px + 5 + h * 18;
          const sy = py + 6 + tileHash(y, x) * 18;
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + 5 + h * 7, sy + 2);
          ctx.stroke();
        }
        if (h < 0.16) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.13)';
          ctx.beginPath();
          ctx.ellipse(px + 8 + h * 90, py + 10 + h * 60, 7, 4, h * 3, 0, Math.PI * 2);
          ctx.fill();
        }
        // Hazard chevrons on the floor of vault and core approaches.
        if (this.game.levelIndex > 0 && ((x >= 31 && x <= 35 && y <= 7) || (x === 15 && y >= 11) || (y === 5 && x >= 30))) {
          ctx.fillStyle = 'rgba(255, 178, 32, 0.10)';
          ctx.fillRect(px, py + TILE - 5, TILE, 3);
        }
      }
    }
  }

  drawWalls(level) {
    const ctx = this.ctx;
    const grid = level.grid;
    const isWall = (x, y) => !grid[y] || grid[y][x] === '#';
    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid[y].length; x++) {
        if (grid[y][x] !== '#') continue;
        const px = x * TILE;
        const py = y * TILE;
        // Drop shadow onto whatever lies below the block.
        if (!isWall(x, y + 1)) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
          ctx.fillRect(px - 2, py + TILE - 2, TILE + 4, 8);
        }
        // Base block and face.
        ctx.fillStyle = COLORS.wall;
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = COLORS.wallFace;
        ctx.fillRect(px + 2, py + 8, TILE - 4, TILE - 13);
        // Panel seam and rivets on the face.
        ctx.strokeStyle = 'rgba(10, 14, 24, 0.35)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 5.5, py + 11.5, TILE - 11, TILE - 19);
        ctx.fillStyle = 'rgba(200, 215, 240, 0.20)';
        ctx.fillRect(px + 5, py + 11, 2, 2);
        ctx.fillRect(px + TILE - 7, py + 11, 2, 2);
        // Lit top face: the bevel that catches the ceiling light.
        ctx.fillStyle = COLORS.wallTop;
        ctx.fillRect(px, py, TILE, 7);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.20)';
        ctx.fillRect(px, py, TILE, 2);
        // Skirt shadow at the foot of the block.
        ctx.fillStyle = COLORS.wallSide;
        ctx.fillRect(px, py + TILE - 4, TILE, 4);
        // Seams between neighbouring blocks.
        ctx.fillStyle = COLORS.wallSeam;
        if (!isWall(x - 1, y)) ctx.fillRect(px, py, 2, TILE);
        if (!isWall(x + 1, y)) ctx.fillRect(px + TILE - 2, py, 2, TILE);
      }
    }
  }

  drawDoors(level, doorsOpen) {
    const ctx = this.ctx;
    for (let y = 0; y < level.grid.length; y++) {
      for (let x = 0; x < level.grid[y].length; x++) {
        if (level.grid[y][x] !== 'D') continue;
        const px = x * TILE;
        const py = y * TILE;
        // Door slab: steel frame, hazard band, a status lamp.
        ctx.fillStyle = '#20293c';
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = doorsOpen ? '#274435' : '#43301c';
        ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
        ctx.fillStyle = doorsOpen ? 'rgba(61, 255, 122, 0.25)' : 'rgba(255, 176, 32, 0.55)';
        ctx.fillRect(px + 3, py + 13, TILE - 6, 5);
        ctx.fillStyle = doorsOpen ? COLORS.ok : '#ffb020';
        ctx.beginPath();
        ctx.arc(px + TILE / 2, py + 8, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = `700 8px ${FONT_UI}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = doorsOpen ? '#b9ffd2' : '#ffe9a8';
        ctx.fillText(doorsOpen ? 'OPEN' : 'KEYCARD', px + TILE / 2, py + TILE - 5);
      }
    }
  }

  drawLightAndShadow(level) {
    const ctx = this.ctx;
    // Pools of light under the ceiling fixtures.
    for (let y = 0; y < level.grid.length; y++) {
      for (let x = 0; x < level.grid[y].length; x++) {
        const t = level.grid[y][x];
        if (t === '#' || t === ',' || !lightAt(x, y)) continue;
        const cx = (x + 0.5) * TILE;
        const cy = (y + 0.5) * TILE;
        const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, TILE * 1.9);
        grad.addColorStop(0, COLORS.lightPool);
        grad.addColorStop(1, 'rgba(255, 226, 160, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(cx - TILE * 2, cy - TILE * 2, TILE * 4, TILE * 4);
        ctx.fillStyle = 'rgba(255, 240, 200, 0.5)';
        ctx.fillRect(cx - 3, cy - 3, 6, 6);
      }
    }
    // Shadow zones sink further: a soft dark wash inside each dark region.
    ctx.fillStyle = 'rgba(2, 4, 10, 0.30)';
    for (let y = 0; y < level.grid.length; y++) {
      for (let x = 0; x < level.grid[y].length; x++) {
        if (level.grid[y][x] !== ',') continue;
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }
    // A rim where shadow meets lit floor, so the safe ground reads clearly.
    ctx.strokeStyle = 'rgba(90, 130, 200, 0.20)';
    ctx.lineWidth = 1;
    for (let y = 0; y < level.grid.length; y++) {
      for (let x = 0; x < level.grid[y].length; x++) {
        if (level.grid[y][x] !== ',') continue;
        const px = x * TILE;
        const py = y * TILE;
        ctx.beginPath();
        if (level.grid[y][x - 1] !== ',') { ctx.moveTo(px + 0.5, py); ctx.lineTo(px + 0.5, py + TILE); }
        if (level.grid[y][x + 1] !== ',') { ctx.moveTo(px + TILE - 0.5, py); ctx.lineTo(px + TILE - 0.5, py + TILE); }
        if (!level.grid[y - 1] || level.grid[y - 1][x] !== ',') { ctx.moveTo(px, py + 0.5); ctx.lineTo(px + TILE, py + 0.5); }
        if (!level.grid[y + 1] || level.grid[y + 1][x] !== ',') { ctx.moveTo(px, py + TILE - 0.5); ctx.lineTo(px + TILE, py + TILE - 0.5); }
        ctx.stroke();
      }
    }
  }

  drawVignette() {
    const ctx = this.ctx;
    const grad = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.42, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.86);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.36)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
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
    // Sweep bracket on the wall mount.
    ctx.fillStyle = '#39465e';
    ctx.fillRect(-8, -8, 16, 16);
    ctx.fillStyle = '#57698a';
    ctx.fillRect(-8, -8, 16, 4);
    ctx.rotate(cam.angle);
    // Body and lens, aimed along the sweep.
    ctx.fillStyle = '#aebfd9';
    ctx.fillRect(-3, -5, 13, 10);
    ctx.fillStyle = '#d7e3f5';
    ctx.fillRect(6, -5, 4, 10);
    ctx.fillStyle = '#101c30';
    ctx.beginPath();
    ctx.arc(10, 0, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7fd8ff';
    ctx.beginPath();
    ctx.arc(10, 0, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Status light: amber while its meter climbs, red at full.
    if (cam.meter > 0.05) {
      ctx.fillStyle = cam.meter >= 1 ? '#ff3c32' : '#ffb020';
      ctx.beginPath();
      ctx.arc(cam.x, cam.y - 13, 2.5 + cam.meter * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // A top-down figure with shoulders, head and gear, rotated to facing.
  // walkPhase bobs the shoulders; colours come from the caller.
  drawFigure(x, y, angle, palette, walkPhase, opts) {
    const ctx = this.ctx;
    const bob = walkPhase ? Math.sin(walkPhase) * 1.1 : 0;
    ctx.save();
    ctx.translate(x, y);
    // Soft blob shadow.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
    ctx.beginPath();
    ctx.ellipse(1.5, 3.5, 12.5, 9.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(angle);
    // Shoulders / torso: a rounded wedge, wider behind the head.
    ctx.fillStyle = palette.dark;
    ctx.beginPath();
    ctx.ellipse(-1, bob * 0.4, 11.5, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = palette.body;
    ctx.beginPath();
    ctx.ellipse(0, bob * 0.4, 10.5, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    // Shoulder pads.
    ctx.fillStyle = palette.dark;
    ctx.beginPath();
    ctx.arc(1, -8 + bob, 4.2, 0, Math.PI * 2);
    ctx.arc(1, 8 - bob, 4.2, 0, Math.PI * 2);
    ctx.fill();
    // Gear on the back: a pack or a weapon silhouette.
    if (opts.pack) {
      ctx.fillStyle = palette.gear;
      ctx.fillRect(-9, -5.5 + bob * 0.4, 7, 11);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.fillRect(-9, -5.5 + bob * 0.4, 7, 2.5);
    }
    if (opts.weapon) {
      ctx.fillStyle = '#141a26';
      ctx.fillRect(4, 6.5 - bob, 13, 3.4);
      ctx.fillRect(14, 5.6 - bob, 4, 5);
    }
    // Head with a hood or cap arc toward facing.
    ctx.fillStyle = palette.head;
    ctx.beginPath();
    ctx.arc(2.5, 0, 5.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = palette.hood;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(2.5, 0, 6.4, -1.15, 1.15);
    ctx.stroke();
    ctx.restore();
    return bob;
  }

  drawGuard(gd) {
    const ctx = this.ctx;
    if (gd.knocked) {
      // Out cold: slumped figure, kit spilled, a still pool of shadow.
      ctx.save();
      ctx.translate(gd.x, gd.y);
      ctx.rotate(gd.angle + 0.7);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.ellipse(0, 2, 15, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.guardKnocked;
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 9.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5d3630';
      ctx.beginPath();
      ctx.arc(9, -2, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#141a26';
      ctx.fillRect(-2, 8, 12, 3.2);
      ctx.restore();
      ctx.font = `700 10px ${FONT_UI}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(233, 239, 252, 0.55)';
      ctx.fillText('DOWN', gd.x, gd.y - 16);
      return;
    }
    if (gd.walkPhase === undefined) gd.walkPhase = Math.random() * 6;
    const moving = gd.state !== 'patrol' || gd.pauseTimer <= 0;
    if (moving) gd.walkPhase += 0.28;
    this.drawFigure(gd.x, gd.y, gd.angle, {
      body: gd.state === 'alarm' ? '#ff4438' : COLORS.guard,
      dark: COLORS.guardDark,
      gear: COLORS.guardGear,
      head: '#e8b39a',
      hood: COLORS.guardDark,
    }, gd.walkPhase, { weapon: true });
    // Alert marker: a drawn chevron diamond, amber or red — never a glyph.
    if (gd.state === 'suspicious' || gd.state === 'alarm') {
      const bobY = Math.sin(performance.now() / 180) * 1.5;
      ctx.save();
      ctx.translate(gd.x, gd.y - 24 + bobY);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = gd.state === 'alarm' ? '#ff2e2e' : '#ffb020';
      ctx.fillRect(-4.5, -4.5, 9, 9);
      ctx.fillStyle = '#0b0f18';
      ctx.fillRect(-1.6, -1.6, 3.2, 3.2);
      ctx.restore();
    }
    // Detection meter arc over the guard.
    if (gd.meter > 0.03) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(gd.x, gd.y, 17, -Math.PI / 2, Math.PI * 1.5);
      ctx.stroke();
      ctx.strokeStyle = gd.meter >= 1 ? '#ff2e2e' : '#ffd640';
      ctx.beginPath();
      ctx.arc(gd.x, gd.y, 17, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * gd.meter);
      ctx.stroke();
    }
  }

  drawPlayer(p) {
    const ctx = this.ctx;
    if (p.walkPhase === undefined) p.walkPhase = 0;
    if (p.moving) p.walkPhase += p.sneaking ? 0.22 : 0.34;
    // Sneak ring: a soft teal halo while crouched low.
    if (p.sneaking) {
      ctx.strokeStyle = 'rgba(47, 212, 196, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 15 + Math.sin(performance.now() / 300) * 1.2, 0, Math.PI * 2);
      ctx.stroke();
    }
    this.drawFigure(p.x, p.y, p.angle, {
      body: COLORS.player,
      dark: COLORS.playerDark,
      gear: '#0d4d47',
      head: '#d9b08c',
      hood: COLORS.playerHood,
    }, p.walkPhase, { pack: true });
    // Shadow marker: drawn eye icon + label — you are hard to see here.
    if (p.shadowed) {
      this.icon('eye', p.x - 22, p.y - 22, 7, '#9fc4ff');
      ctx.font = `700 10px ${FONT_UI}`;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#9fc4ff';
      ctx.fillText('HIDDEN', p.x - 15, p.y - 19);
    }
  }

  drawCoin(x, y) {
    const ctx = this.ctx;
    const bob = Math.sin(performance.now() / 350 + x) * 1.2;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(x, y + 5, 6, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8a6d00';
    ctx.beginPath();
    ctx.arc(x, y + bob + 1, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.coin;
    ctx.beginPath();
    ctx.arc(x, y + bob, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff3b0';
    ctx.beginPath();
    ctx.arc(x - 1.5, y + bob - 1.5, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  drawKeycard(x, y) {
    const ctx = this.ctx;
    const bob = Math.sin(performance.now() / 300) * 2;
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.fillStyle = 'rgba(255, 224, 102, 0.16)';
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8a6d00';
    ctx.fillRect(-9, -4, 18, 12);
    ctx.fillStyle = COLORS.keycard;
    ctx.fillRect(-9, -6, 18, 12);
    ctx.fillStyle = '#1c2739';
    ctx.fillRect(-6, -3, 6, 6);
    ctx.fillRect(2, -3, 5, 2);
    ctx.fillRect(2, 0, 5, 2);
    ctx.restore();
  }

  drawIntel(x, y) {
    const ctx = this.ctx;
    const now = performance.now();
    const pulse = 0.5 + Math.sin(now / 250) * 0.2;
    ctx.fillStyle = `rgba(255, 210, 63, ${0.30 * pulse})`;
    ctx.beginPath();
    ctx.arc(x, y, 21, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4 + Math.sin(now / 600) * 0.08);
    ctx.fillStyle = COLORS.intel;
    ctx.fillRect(-8, -8, 16, 16);
    ctx.fillStyle = '#fff3b0';
    ctx.fillRect(-4, -4, 8, 8);
    ctx.restore();
    ctx.font = `700 10px ${FONT_UI}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.intel;
    ctx.fillText('INTEL', x, y - 26);
  }

  drawExit(x, y) {
    const ctx = this.ctx;
    const g = this.game;
    const open = g.player && g.player.hasIntel;
    const pulse = open ? 0.6 + Math.sin(performance.now() / 200) * 0.25 : 0.25;
    ctx.fillStyle = `rgba(61, 255, 122, ${0.20 * pulse + 0.08})`;
    ctx.fillRect(x - 17, y - 17, 34, 34);
    // Chevron frame pointing the way out.
    ctx.strokeStyle = open ? COLORS.exit : '#2a7a44';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 17, y - 17, 34, 34);
    ctx.beginPath();
    ctx.moveTo(x - 7, y - 6);
    ctx.lineTo(x + 2, y);
    ctx.lineTo(x - 7, y + 6);
    ctx.moveTo(x + 1, y - 6);
    ctx.lineTo(x + 10, y);
    ctx.lineTo(x + 1, y + 6);
    ctx.stroke();
    ctx.font = `700 10px ${FONT_UI}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = open ? COLORS.exit : '#7ac79a';
    ctx.fillText(open ? 'EXIT OPEN' : 'EXIT — NEEDS INTEL', x, y + 30);
  }

  // Particles and floating score text, above the world, below the HUD.
  drawFx() {
    const g = this.game;
    const ctx = this.ctx;
    for (const p of g.particles) {
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    for (const f of g.floaters) {
      const a = Math.max(0, Math.min(1, f.life / 0.6));
      ctx.globalAlpha = a;
      ctx.font = `700 13px ${FONT_UI}`;
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
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

    // Top bar: clipped-corner strip.
    ctx.fillStyle = COLORS.hudBg;
    ctx.fillRect(0, 0, VIEW_W, 48);
    ctx.fillStyle = COLORS.hudLine;
    ctx.fillRect(0, 48, VIEW_W, 1);
    ctx.fillStyle = COLORS.accent;
    ctx.fillRect(0, 0, 4, 48);

    // Left: operation + facility + live objective tracker.
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.hudText;
    ctx.font = `18px ${FONT_DISPLAY}`;
    ctx.fillText(level.name, 16, 21);
    ctx.font = `600 12.5px ${FONT_UI}`;
    const obj = !p.hasIntel
      ? { icon: 'doc', text: 'OBJECTIVE — SECURE THE INTEL', color: COLORS.hudDim }
      : { icon: 'exit', text: 'OBJECTIVE — REACH THE EXIT', color: COLORS.ok };
    this.icon(obj.icon, 24, 36, 7, obj.color);
    ctx.fillStyle = obj.color;
    ctx.fillText(obj.text, 36, 40);

    // Centre: segmented detection gauge.
    const meter = g.topMeter;
    const segs = 14;
    const segW = 13;
    const segGap = 3;
    const totalW = segs * segW + (segs - 1) * segGap;
    const mx = VIEW_W / 2 - totalW / 2;
    ctx.font = `700 12px ${FONT_UI}`;
    ctx.textAlign = 'center';
    const label = g.alarm ? 'ALARM — BREAK LINE OF SIGHT' : meter >= 0.35 ? 'SUSPICIOUS' : 'UNSEEN';
    ctx.fillStyle = g.alarm ? COLORS.danger : meter >= 0.35 ? '#ffb020' : COLORS.hudDim;
    ctx.fillText(label, VIEW_W / 2, 15);
    const lit = Math.round(Math.min(1, meter) * segs);
    for (let i = 0; i < segs; i++) {
      const x = mx + i * (segW + segGap);
      const frac = i / segs;
      ctx.fillStyle = i < lit
        ? frac < 0.4 ? '#ffd640' : frac < 0.75 ? '#ff9c2c' : '#ff4030'
        : 'rgba(255, 255, 255, 0.13)';
      ctx.fillRect(x, 22, segW, 9);
      if (i < lit) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.fillRect(x, 22, segW, 3);
      }
    }
    ctx.font = `600 11px ${FONT_UI}`;
    ctx.fillStyle = COLORS.hudDim;
    ctx.fillText('DETECTION', VIEW_W / 2, 43);

    // Right: clock, coins, keycard, spotted count — icons drawn, not typed.
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.hudText;
    ctx.font = `700 16px ${FONT_UI}`;
    ctx.fillText(this.formatTime(g.time), VIEW_W - 16, 21);
    this.icon('clock', VIEW_W - 62, 16, 8, COLORS.hudDim);
    let rx = VIEW_W - 16;
    ctx.font = `600 13px ${FONT_UI}`;
    ctx.fillStyle = COLORS.hudDim;
    const spotted = 'SPOTTED ' + g.stats.detections;
    ctx.fillText(spotted, rx, 40);
    rx -= ctx.measureText(spotted).width + 14;
    if (p.hasKeycard) {
      this.icon('key', rx - 8, 36, 8, COLORS.keycard);
      ctx.fillStyle = COLORS.keycard;
      ctx.fillText('KEYCARD', rx - 18, 40);
      rx -= ctx.measureText('KEYCARD').width + 34;
    }
    this.icon('coin', rx - 7, 36, 8, COLORS.coin);
    ctx.fillStyle = COLORS.hudDim;
    ctx.fillText('x ' + p.coins, rx - 18, 40);

    // Bottom hint bar.
    ctx.fillStyle = COLORS.hudBg;
    ctx.fillRect(0, VIEW_H - 30, VIEW_W, 30);
    ctx.fillStyle = COLORS.hudLine;
    ctx.fillRect(0, VIEW_H - 30, VIEW_W, 1);
    ctx.fillStyle = COLORS.hudDim;
    ctx.font = `600 12.5px ${FONT_UI}`;
    ctx.textAlign = 'left';
    ctx.fillText('WASD MOVE — SHIFT SNEAK — Q / CLICK THROW COIN — E TAKEDOWN — ESC PAUSE — M MUTE', 14, VIEW_H - 11);
    ctx.textAlign = 'right';
    ctx.fillStyle = p.shadowed ? '#9fc4ff' : COLORS.hudDim;
    ctx.fillText(p.shadowed ? 'IN SHADOW — HARD TO SEE' : p.sneaking ? 'SNEAKING — SLOW AND QUIET' : '', VIEW_W - 14, VIEW_H - 11);

    // Transient message banner.
    if (g.messageTimer > 0 && g.message) {
      ctx.textAlign = 'center';
      ctx.font = `600 15.5px ${FONT_UI}`;
      const w = ctx.measureText(g.message).width + 36;
      this.panel(VIEW_W / 2 - w / 2, 60, w, 34, 'rgba(8, 12, 24, 0.88)', COLORS.hudLine);
      ctx.fillStyle = '#ffe9a8';
      ctx.fillText(g.message, VIEW_W / 2, 82);
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
    this.panel(x, y, w, h, hover ? '#2b3f66' : '#1a2740', hover ? '#8fb4ee' : '#43587f');
    if (hover) {
      ctx.fillStyle = COLORS.accent;
      ctx.fillRect(x, y, 3, h);
    }
    ctx.fillStyle = COLORS.hudText;
    ctx.font = `700 15.5px ${FONT_UI}`;
    ctx.textAlign = 'center';
    ctx.fillText(label, x + w / 2, y + h / 2 + 5.5);
    g.buttons.push({ x, y, w, h, onClick });
  }

  drawTitle() {
    const g = this.game;
    const ctx = this.ctx;
    // Backdrop: a dark facility grid with a sweeping cone.
    ctx.fillStyle = '#070c16';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.strokeStyle = 'rgba(90, 120, 180, 0.08)';
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
    const cx = VIEW_W / 2;
    const cy = 316;
    const ang = -Math.PI / 2 + Math.sin(performance.now() / 1600) * 0.5;
    const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 270);
    grad.addColorStop(0, 'rgba(255, 214, 64, 0.10)');
    grad.addColorStop(1, 'rgba(255, 214, 64, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, 270, ang - 0.6, ang + 0.6);
    ctx.closePath();
    ctx.fill();

    // Wordmark in the bundled stencil display face.
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.font = `76px ${FONT_DISPLAY}`;
    ctx.fillText(GAME_TITLE, VIEW_W / 2 + 3, 133);
    ctx.fillStyle = COLORS.hudText;
    ctx.fillText(GAME_TITLE, VIEW_W / 2, 130);
    ctx.fillStyle = COLORS.accent;
    ctx.font = `700 17px ${FONT_UI}`;
    ctx.fillText(GAME_SUBTITLE, VIEW_W / 2, 164);
    ctx.fillStyle = COLORS.hudDim;
    ctx.font = `600 14.5px ${FONT_UI}`;
    ctx.fillText('Infiltrate three facilities. Steal the intel. Reach the exit unseen.', VIEW_W / 2, 192);

    // Facility cards.
    const cardW = 308;
    const cardH = 118;
    const gap = 22;
    const totalW = LEVELS.length * cardW + (LEVELS.length - 1) * gap;
    let x = (VIEW_W - totalW) / 2;
    const y = 232;
    LEVELS.forEach((def, i) => {
      const locked = i >= g.progress.unlocked;
      const grade = g.progress.grades[i] || '-';
      const best = g.progress.bestScores[i];
      this.panel(x, y, cardW, cardH, locked ? 'rgba(16, 22, 38, 0.88)' : 'rgba(24, 36, 60, 0.92)', locked ? '#2a3852' : '#4d6a9e');
      ctx.fillStyle = locked ? '#33415e' : COLORS.accent;
      ctx.fillRect(x, y, 4, cardH);
      ctx.textAlign = 'left';
      ctx.fillStyle = locked ? '#5a6a88' : COLORS.hudText;
      ctx.font = `19px ${FONT_DISPLAY}`;
      ctx.fillText(def.name, x + 18, y + 32);
      ctx.font = `600 11.5px ${FONT_UI}`;
      ctx.fillStyle = locked ? '#5a6a88' : COLORS.hudDim;
      ctx.fillText(locked ? 'SEALED — CLEAR THE PREVIOUS SITE' : def.op, x + 18, y + 52);
      if (!locked) {
        const lines = this.wrapText(def.objectives[0], 40);
        ctx.font = `600 12.5px ${FONT_UI}`;
        ctx.fillStyle = COLORS.hudDim;
        lines.slice(0, 2).forEach((line, li) => ctx.fillText(line, x + 18, y + 72 + li * 16));
        ctx.fillStyle = grade === 'S' ? '#ffd640' : COLORS.hudText;
        ctx.font = `700 14px ${FONT_UI}`;
        ctx.textAlign = 'right';
        ctx.fillText('GRADE ' + grade + (best ? '  ·  BEST ' + best : ''), x + cardW - 14, y + cardH - 12);
        ctx.textAlign = 'left';
        g.buttons.push({
          x, y, w: cardW, h: cardH,
          onClick: () => g.startLevel(i),
        });
      }
      x += cardW + gap;
    });

    // Controls, set like a field manual.
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.hudDim;
    ctx.font = `600 14px ${FONT_UI}`;
    ctx.fillText('WASD / ARROWS — MOVE        SHIFT — SNEAK (SLOW, QUIET, HARD TO SEE)', VIEW_W / 2, 424);
    ctx.fillText('Q OR CLICK — THROW A COIN TO LURE A GUARD        E — TAKEDOWN FROM BEHIND', VIEW_W / 2, 448);
    ctx.fillText('HIDE IN THE DARK CARPET ZONES. CAMERAS SWEEP. LASERS BLINK — CROSS WHILE DARK.', VIEW_W / 2, 472);
    ctx.fillText('GHOST BONUS: CLEAR A SITE WITHOUT EVER BEING SPOTTED.', VIEW_W / 2, 496);

    this.button(VIEW_W / 2 - 140, 528, 280, 50, 'DEPLOY — ' + LEVELS[Math.min(g.progress.unlocked - 1, 2)].name, () => {
      g.startLevel(Math.min(g.progress.unlocked - 1, LEVELS.length - 1));
    });

    ctx.fillStyle = '#5a6a88';
    ctx.font = `600 12px ${FONT_UI}`;
    ctx.fillText('AN ORIGINAL GAME. NO NETWORK, NO ACCOUNTS — PROGRESS IS SAVED ON THIS COMPUTER.', VIEW_W / 2, 622);
    ctx.fillText('PRESS M TO ' + (g.sound.muted ? 'UNMUTE' : 'MUTE') + ' SOUND.', VIEW_W / 2, 642);
  }

  // ---- mission brief ----

  drawBrief() {
    const g = this.game;
    const ctx = this.ctx;
    const level = g.level;
    // Wrap everything first so the panel is exactly as tall as its text.
    const objectives = level.objectives.map((o) => this.wrapText(o, 60));
    const intel = level.intelNotes.map((n) => this.wrapText(n, 74));
    let contentH = 122 + 22; // header block + OBJECTIVES label
    for (const lines of objectives) contentH += 6 + lines.length * 19 + 6;
    contentH += 28 + 22; // SITE INTEL label
    for (const lines of intel) contentH += lines.length * 18 + 8;
    contentH += 34; // footer prompt

    ctx.fillStyle = 'rgba(3, 5, 10, 0.62)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const w = 680;
    const h = contentH;
    const x = (VIEW_W - w) / 2;
    const y = (VIEW_H - h) / 2 - 8;
    this.panel(x, y, w, h, 'rgba(10, 15, 26, 0.96)', '#4d6a9e');
    ctx.fillStyle = COLORS.accent;
    ctx.fillRect(x, y, 5, h);

    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.accent;
    ctx.font = `700 12.5px ${FONT_UI}`;
    ctx.fillText('MISSION BRIEF', x + 28, y + 32);
    ctx.fillStyle = COLORS.hudText;
    ctx.font = `30px ${FONT_DISPLAY}`;
    ctx.fillText(level.op, x + 28, y + 68);
    ctx.fillStyle = COLORS.hudDim;
    ctx.font = `600 13.5px ${FONT_UI}`;
    ctx.fillText('SITE: ' + level.name + '  ·  INFILTRATION WINDOW OPEN', x + 28, y + 90);

    let ly = y + 122;
    ctx.fillStyle = COLORS.hudText;
    ctx.font = `700 13px ${FONT_UI}`;
    ctx.fillText('OBJECTIVES', x + 28, ly);
    ly += 22;
    ctx.font = `600 14px ${FONT_UI}`;
    objectives.forEach((lines, i) => {
      ctx.fillStyle = COLORS.accent;
      ctx.fillText(String(i + 1) + '.', x + 28, ly);
      ctx.fillStyle = COLORS.hudText;
      lines.forEach((line, li) => ctx.fillText(line, x + 48, ly + li * 19));
      ly += lines.length * 19 + 12;
    });

    ly += 10;
    ctx.fillStyle = COLORS.hudText;
    ctx.font = `700 13px ${FONT_UI}`;
    ctx.fillText('SITE INTEL', x + 28, ly);
    ly += 22;
    ctx.font = `500 13.5px ${FONT_UI}`;
    ctx.fillStyle = COLORS.hudDim;
    for (const lines of intel) {
      lines.forEach((line, li) => ctx.fillText(line, x + 28, ly + li * 18));
      ly += lines.length * 18 + 8;
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.accent;
    ctx.font = `700 14px ${FONT_UI}`;
    const blink = Math.sin(performance.now() / 350) > -0.3;
    if (blink) ctx.fillText('MOVE TO DEPLOY', VIEW_W / 2, y + h - 16);
  }

  // ---- overlays ----

  overlayPanel(title, lines, buttons, panelH, stampGrade) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(3, 5, 10, 0.74)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const w = 600;
    const h = panelH || 150 + lines.length * 32 + (buttons ? 76 : 0);
    const x = (VIEW_W - w) / 2;
    const y = (VIEW_H - h) / 2;
    this.panel(x, y, w, h, 'rgba(13, 19, 33, 0.97)', '#4d6a9e');
    ctx.fillStyle = COLORS.accent;
    ctx.fillRect(x, y, 5, h);
    ctx.fillStyle = COLORS.hudText;
    ctx.font = `30px ${FONT_DISPLAY}`;
    if (stampGrade) {
      // With a grade stamp on the right, the title sets left like a header.
      ctx.textAlign = 'left';
      ctx.fillText(title, x + 30, y + 54);
      ctx.textAlign = 'center';
    } else {
      ctx.textAlign = 'center';
      ctx.fillText(title, VIEW_W / 2, y + 54);
    }
    ctx.font = `600 15px ${FONT_UI}`;
    lines.forEach((line, i) => {
      ctx.fillStyle = line.dim ? COLORS.hudDim : COLORS.hudText;
      ctx.fillText(line.text, VIEW_W / 2, y + 96 + i * 32);
    });
    if (buttons) {
      const bw = 210;
      const gap = 20;
      const total = buttons.length * bw + (buttons.length - 1) * gap;
      let bx = VIEW_W / 2 - total / 2;
      for (const b of buttons) {
        this.button(bx, y + h - 62, bw, 42, b.label, b.onClick);
        bx += bw + gap;
      }
    }
    if (stampGrade) this.drawGradeStamp(x + w - 84, y + 104, stampGrade);
    return { x, y, w, h };
  }

  drawPaused() {
    const g = this.game;
    this.overlayPanel('PAUSED', [
      { text: g.level.name + '  ·  ' + this.formatTime(g.time) },
      { text: 'ESC RESUME   ·   Q QUIT TO TITLE', dim: true },
    ], [
      { label: 'RESUME (ESC)', onClick: () => { g.state = 'playing'; } },
      { label: 'QUIT TO TITLE', onClick: () => g.backToTitle() },
    ]);
  }

  drawCaught() {
    const g = this.game;
    this.overlayPanel('COMPROMISED', [
      { text: 'A guard got hands on you. The site resets — detections stay on your record.' },
      { text: 'Detections so far: ' + g.stats.detections + '   ·   Time: ' + this.formatTime(g.time), dim: true },
    ], [
      { label: 'TRY AGAIN (R)', onClick: () => g.retryLevel() },
      { label: 'QUIT TO TITLE', onClick: () => g.backToTitle() },
    ]);
  }

  // The grade as a stencil stamp: oversized, rotated, slammed in on an
  // ease-out scale in the first fifth of a second after the result lands.
  drawGradeStamp(cx, cy, grade) {
    const g = this.game;
    const ctx = this.ctx;
    const t = Math.min(1, Math.max(0, (g.uiTime - g.stampAt) / 0.22));
    const scale = 2.1 - 1.1 * (1 - Math.pow(1 - t, 3));
    const alpha = Math.min(1, t * 2.5);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.13);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;
    ctx.font = `84px ${FONT_DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = grade === 'S' ? '#ffd640' : grade === 'A' ? '#7fe8a8' : grade === 'B' ? '#8fb4ee' : '#c7cede';
    ctx.strokeRect(-54, -60, 108, 106);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fillText(grade, 0, 20);
    ctx.font = `700 11px ${FONT_UI}`;
    ctx.fillText('GRADE', 0, 40);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  drawComplete() {
    const g = this.game;
    const r = g.result;
    this.overlayPanel(g.level.name + ' — CLEAR', [
      { text: 'SCORE ' + r.score + '      TIME ' + this.formatTime(r.timeSeconds) + '  (PAR ' + this.formatTime(g.parTime) + ')' },
      { text: 'Detections ' + r.detections + '  ·  Takedowns ' + r.takedowns + '  ·  Coins ' + r.coinsCollected },
      { text: r.ghost ? 'GHOST — NEVER SPOTTED.  +500 BONUS' : 'Spotted ' + r.detections + ' time(s) — ghost bonus missed', dim: !r.ghost },
    ], [
      { label: 'NEXT SITE', onClick: () => g.startLevel(g.levelIndex + 1) },
      { label: 'TITLE', onClick: () => g.backToTitle() },
    ], 330, r.grade);
  }

  drawVictory() {
    const g = this.game;
    const r = g.result;
    this.overlayPanel('NETWORK GHOSTED', [
      { text: 'Every site cleared. Final facility score ' + r.score + '.' },
      { text: 'Total score ' + g.totalScore + '   ·   Detections ' + r.detections, dim: true },
      { text: 'Replay any facility from the title screen to raise your grades.', dim: true },
    ], [
      { label: 'BACK TO TITLE', onClick: () => g.backToTitle() },
    ], 330, r.grade);
  }
}

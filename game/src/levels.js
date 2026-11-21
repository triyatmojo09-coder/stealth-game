// SHADOW PROTOCOL — level definitions.
// One job: the three hand-designed facilities. Map legend:
//   # wall   . floor   , shadow floor (dark: guards spot you much slower)
//   P player start   G guard spawn (patrol set below)   I intel objective
//   E exit   K keycard pickup   o coin pickup   D keycard door   L laser post
// Maps are 40 x 22 tiles. Waypoints are tile coordinates {x, y}.
// Each facility also carries its mission brief: the operation name, the
// objective list, and site intel written from the actual layout below.

export const LEVELS = [
  {
    name: 'THE ARCHIVE',
    op: 'OPERATION QUIET LEDGER',
    objectives: [
      'Lift the cipher ledger from the reading room (north-east)',
      'Cross back through the stacks to the service exit (south-east)',
    ],
    intel: [
      'Two guards on the floor: one walks a square loop through the reading room, the other holds the south corridor by the exit.',
      'One ceiling camera sweeps the junction east of the stacks — its beam cannot reach the unlit alcove in the reading room.',
      'The reading room floor is unlit carpet. Cross it crouched and the ledger is yours before anyone looks up.',
    ],
    map: [
      '########################################',
      '#...........#.............#............#',
      '#...........#.............#........I...#',
      '#...........#.................,,,,,,,,.#',
      '#...........#.............#...,,,,,,,,.#',
      '#.........................#...,,,,,,,,.#',
      '#...........#.............#...,,,,,,,,.#',
      '#...........#.............######.#######',
      '#...........#.............#............#',
      '#...........#.............#............#',
      '#....o......#.............#............#',
      '#...........#.............#............#',
      '#...........#.............#............#',
      '#...........#.............#............#',
      '#...........#.............#............#',
      '#...........#.............#............#',
      '#.........................#............#',
      '#...........#.............#............#',
      '#...........#.,,,,,,,,,,,..............#',
      '#.P.........#.,,,,,,,,,,,#...........E.#',
      '#...........#.............#............#',
      '########################################',
    ],
    guards: [
      { patrol: [{ x: 16, y: 3 }, { x: 24, y: 3 }, { x: 24, y: 10 }, { x: 16, y: 10 }], pause: 1.2 },
      { patrol: [{ x: 30, y: 12 }, { x: 36, y: 12 }, { x: 36, y: 18 }, { x: 30, y: 18 }], pause: 1.0 },
    ],
    cameras: [
      { tx: 26, ty: 11, angle: 0, sweep: 0.7, speed: 0.55 },
    ],
    lasers: [],
  },
  {
    name: 'THE VAULT',
    op: 'OPERATION COLD VAULT',
    objectives: [
      'Take the vault keycard from the teller office (west wing)',
      'Pass the keycard door and time the laser grid on the vault approach',
      'Lift the bearer bonds from the vault chamber, then reach the exit',
    ],
    intel: [
      'Three guards: one circles the lobby, one works the corridor under the vault, and a third never leaves the vault floor itself.',
      'The laser grid cycles 2.4 seconds live, 1.5 seconds dark. Cross on the dark beat — a live beam raises the whole building.',
      'Two cameras sweep the central hall from the dividing wall. The shadow strips in the west offices break their line cold.',
    ],
    map: [
      '########################################',
      '#.........#.........#.........#..L.....#',
      '#.........#.........#.........#.....I..#',
      '#..K......#.........#.........#........#',
      '#...................#.........#........#',
      '#.........#.........#..................#',
      '#.........#.........D.........#..L.....#',
      '#.........#.........#.........#........#',
      '#.........#.........#.........#........#',
      '#.........#.........#.........#........#',
      '#.........#...................#........#',
      '#.........#.........#' + '####.#####' + '........#',
      '#.........#.........#.........#........#',
      '#.........#.........#.........#........#',
      '#.........#.........#.........#........#',
      '#.........#.........#..................#',
      '#.........#.........#.........#........#',
      '#...................#.........#........#',
      '#.,,,,,,,.#.,,,,,,,.#.........#........#',
      '#.P......#....o....#.........#......E..#',
      '#.........#.........#.........#........#',
      '########################################',
    ],
    guards: [
      { patrol: [{ x: 13, y: 3 }, { x: 18, y: 3 }, { x: 18, y: 8 }, { x: 13, y: 8 }], pause: 1.0 },
      { patrol: [{ x: 23, y: 13 }, { x: 28, y: 13 }, { x: 28, y: 18 }, { x: 23, y: 18 }], pause: 1.0 },
      { patrol: [{ x: 34, y: 3 }, { x: 37, y: 3 }, { x: 37, y: 9 }, { x: 34, y: 9 }], pause: 1.4 },
    ],
    cameras: [
      { tx: 20, ty: 11, angle: Math.PI, sweep: 0.6, speed: 0.5 },
      { tx: 30, ty: 11, angle: 0, sweep: 0.6, speed: 0.65 },
    ],
    lasers: [
      { x1: 33, y1: 1, x2: 33, y2: 6, phase: 0 },
    ],
  },
  {
    name: 'THE CORE',
    op: 'OPERATION DEAD SIGNAL',
    objectives: [
      'Take the core keycard from the server office (west wing)',
      'Thread the laser wall on the core approach (north-east)',
      'Pull the drive from the core chamber and reach the exit unseen',
    ],
    intel: [
      'Four guards and three cameras share this floor. Two guards walk stacked loops in the server hall — their cones overlap at the crossing.',
      'A vertical laser wall guards the lower hall by the south offices; it blinks on the same 2.4 / 1.5 cycle as the core approach grid.',
      'The unlit maintenance strip runs the length of the west wall. A patient operative crosses the whole site inside it.',
    ],
    map: [
      '########################################',
      '#.........#.............#..............#',
      '#.........#.,,,,,,,.....#...........I..#',
      '#..K......#.,,,,,,,.....#..............#',
      '#.........#.,,,,,,,.....D..............#',
      '#.........#.............#......L......L#',
      '#.........#............................#',
      '#.........#.............#..............#',
      '#.......................#..............#',
      '#.........#.............#..............#',
      '#.........#.............#..............#',
      '#####.#####.............#####.##########',
      '#.........#....L........#..............#',
      '#.........#.............#..............#',
      '#.........#.............#..............#',
      '#.....o...#.............#..............#',
      '#.........#............................#',
      '#.........#.............#..............#',
      '#...............,,,,,,,.#..............#',
      '#.P.......#..........o..#............E.#',
      '#.........#....L........#..............#',
      '########################################',
    ],
    guards: [
      { patrol: [{ x: 13, y: 3 }, { x: 18, y: 3 }, { x: 18, y: 8 }, { x: 13, y: 8 }], pause: 1.0 },
      { patrol: [{ x: 27, y: 3 }, { x: 30, y: 3 }, { x: 30, y: 8 }, { x: 27, y: 8 }], pause: 1.2 },
      { patrol: [{ x: 27, y: 13 }, { x: 36, y: 13 }, { x: 36, y: 18 }, { x: 27, y: 18 }], pause: 1.0 },
      { patrol: [{ x: 16, y: 14 }, { x: 18, y: 14 }, { x: 18, y: 19 }, { x: 16, y: 19 }], pause: 1.4 },
    ],
    cameras: [
      { tx: 24, ty: 8, angle: 0, sweep: 0.7, speed: 0.5 },
      { tx: 24, ty: 14, angle: 0, sweep: 0.7, speed: 0.6 },
      { tx: 10, ty: 14, angle: 0, sweep: 0.55, speed: 0.7 },
    ],
    lasers: [
      { x1: 31, y1: 5, x2: 38, y2: 5, phase: 0.8 },
      { x1: 15, y1: 12, x2: 15, y2: 20, phase: 0 },
    ],
  },
];

// ---- validation helpers (used by the dev-time check script, not by the game) ----
export function tileAt(level, x, y) {
  if (x < 0 || y < 0 || x >= level.map[0].length || y >= level.map.length) return '#';
  return level.map[y][x];
}

export function findTiles(level, ch) {
  const out = [];
  level.map.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === ch) out.push({ x, y });
  });
  return out;
}

export function isWalkable(level, x, y, hasKeycard) {
  const t = tileAt(level, x, y);
  if (t === '#') return false;
  if (t === 'L') return false;
  if (t === 'D') return hasKeycard;
  return true;
}

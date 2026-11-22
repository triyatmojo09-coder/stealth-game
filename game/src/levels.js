// SHADOW PROTOCOL — level definitions.
// One job: the three hand-designed facilities, drawn as building
// cross-sections. Map legend (40 x 22 tiles, one tile = 32 px):
//   # solid slab/wall   H ladder   , shadow zone (dark: detection crawls)
//   D keycard door (solid until the card is held)
//   P player start   I intel   E exit   K keycard   o spare coin
// Markers sit in the cell just above the floor they stand on. Guards are
// defined by the floor they patrol (the row of the slab they walk on) and
// the tile columns they walk between. Cover furniture (crates, desks,
// server racks) is listed per level: it blocks sight, never movement —
// crouch behind a crate and a guard's cone passes over you.
// Each facility also carries its mission brief: the operation name, the
// objective list, and site intel written from the actual layout below.

export const LEVELS = [
  {
    name: 'THE ARCHIVE',
    op: 'OPERATION QUIET LEDGER',
    theme: 'archive',
    objectives: [
      'Climb the west ladder to the mezzanine, or take the long east shaft straight up',
      'Lift the cipher ledger from the reading room (top floor, east)',
      'Drop back down and reach the service exit (ground floor, east) unseen',
    ],
    intel: [
      'Two guards: one walks the reading room overhead, the other works the ground corridor between the long ladder and the exit.',
      'One camera hangs under the mezzanine edge and sweeps the ground crossing — cross while its beam is turned away, or crouch behind the crate below it.',
      'The ground alcove and the reading room\u2019s unlit half are true dark: detection crawls there. The reading-room rack hides you completely.',
    ],
    map: [
      '########################################',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#.............................,,,,,....#',
      '#.........................H...,,,,,.I..#',
      '#........................#H#############',
      '#.........................H............#',
      '#.........................H............#',
      '#.........................H............#',
      '#.........................H............#',
      '#.........................H............#',
      '#....o...........H........H............#',
      '#################H##......H............#',
      '#................H........H............#',
      '#................H........H............#',
      '#................H........H............#',
      '#................H........H............#',
      '#.......,,,,,....H........H............#',
      '#.P.....,,o,,....H........H..........E.#',
      '########################################',
      '########################################',
    ],
    guards: [
      { floor: 6, from: 28, to: 37, start: 29, pause: 1.2 },
      { floor: 20, from: 27, to: 35, start: 33, pause: 1.0 },
    ],
    cameras: [
      { tx: 19, ty: 13, sweep: 0.55, speed: 0.55 },
    ],
    lasers: [],
    cover: [
      { tx: 22, floor: 20, w: 1, h: 1.05, kind: 'crate' },
      { tx: 32, floor: 6, w: 1, h: 1.8, kind: 'rack' },
      { tx: 8, floor: 13, w: 1, h: 1.05, kind: 'crate' },
    ],
  },
  {
    name: 'THE VAULT',
    op: 'OPERATION COLD VAULT',
    theme: 'vault',
    objectives: [
      'Take the vault keycard from the teller office (west stack, middle floor)',
      'Climb to the vault floor, time the first laser, and open the keycard door',
      'Lift the bearer bonds past the second laser, then reach the exit',
    ],
    intel: [
      'Three guards: one works the lobby under the teller office, one the ground under the vault, and a third never leaves the vault floor itself.',
      'Both vault lasers cycle 2.4 seconds live, 1.5 seconds dark. Cross on the dark beat — a live beam raises the whole building.',
      'A camera under the vault slab watches the second ladder\u2019s foot; another sweeps the vault door from the chamber ceiling.',
    ],
    map: [
      '########################################',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#.....................##################',
      '#............................D.........#',
      '#,,,,........................D.........#',
      '#,,K,.....o.H...........H....D......I..#',
      '############H##.......##H###############',
      '#...........H...........H..............#',
      '#...........H...........H..............#',
      '#...........H...........H..............#',
      '#...........H...........H..............#',
      '#...........H...........H..,,,,,.......#',
      '#.P.........H.....o.....H..,,,,,.....E.#',
      '########################################',
      '########################################',
    ],
    guards: [
      { floor: 20, from: 6, to: 16, start: 8, pause: 1.0 },
      { floor: 20, from: 24, to: 33, start: 30, pause: 1.0 },
      { floor: 13, from: 31, to: 37, start: 35, pause: 1.4 },
    ],
    cameras: [
      { tx: 22, ty: 13, sweep: 0.55, speed: 0.5 },
      { tx: 30, ty: 9, sweep: 0.5, speed: 0.65 },
    ],
    lasers: [
      { x1: 26, y1: 10, x2: 26, y2: 13, phase: 0 },
      { x1: 33, y1: 10, x2: 33, y2: 13, phase: 1.9 },
    ],
    cover: [
      { tx: 6, floor: 13, w: 2, h: 1.0, kind: 'desk' },
      { tx: 20, floor: 20, w: 1, h: 1.05, kind: 'crate' },
      { tx: 35, floor: 13, w: 1, h: 1.8, kind: 'rack' },
    ],
  },
  {
    name: 'THE CORE',
    op: 'OPERATION DEAD SIGNAL',
    theme: 'core',
    objectives: [
      'Take the core keycard from the server office (west stack, middle floor)',
      'Thread the ground laser gate, then climb the east shaft to the core floor',
      'Pull the drive from the core chamber and reach the exit unseen',
    ],
    intel: [
      'Four guards and three cameras share this site. Two guards work the west stack\u2019s floors; a third holds the core floor, a fourth the east ground.',
      'The ground laser gate blinks on the same 2.4 / 1.5 cycle as the core beam. The maintenance strip along the west ground is unlit end to end.',
      'The core chamber\u2019s east alcove is dark and its rack is full cover — the drive sits one guard-patrol past it.',
    ],
    map: [
      '########################################',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#...o.........H........................#',
      '##############H#.......................#',
      '#.............H........................#',
      '#.............H.........################',
      '#.............H..............D.........#',
      '#,,,,.........H..............D...,,,...#',
      '#,,K,.........H..Ho......H...D...,,,I..#',
      '#################H##.....H##############',
      '#................H.......H.............#',
      '#................H.......H.............#',
      '#................H.......H.............#',
      '#................H.......H.............#',
      '#,,,,,...........H.......H.............#',
      '#,P,,,...........H.......H....o......E.#',
      '########################################',
      '########################################',
    ],
    guards: [
      { floor: 13, from: 5, to: 12, start: 11, pause: 1.0 },
      { floor: 7, from: 3, to: 12, start: 6, pause: 1.2 },
      { floor: 13, from: 31, to: 37, start: 34, pause: 1.0 },
      { floor: 20, from: 27, to: 34, start: 30, pause: 1.4 },
    ],
    cameras: [
      { tx: 10, ty: 7, sweep: 0.5, speed: 0.6 },
      { tx: 18, ty: 13, sweep: 0.55, speed: 0.5 },
      { tx: 27, ty: 13, sweep: 0.5, speed: 0.7 },
    ],
    lasers: [
      { x1: 20, y1: 17, x2: 20, y2: 20, phase: 0 },
      { x1: 32, y1: 10, x2: 32, y2: 13, phase: 0.8 },
    ],
    cover: [
      { tx: 6, floor: 13, w: 2, h: 1.0, kind: 'desk' },
      { tx: 15, floor: 13, w: 1, h: 1.8, kind: 'rack' },
      { tx: 34, floor: 13, w: 1, h: 1.8, kind: 'rack' },
      { tx: 22, floor: 20, w: 1, h: 1.05, kind: 'crate' },
      { tx: 10, floor: 20, w: 1, h: 1.05, kind: 'crate' },
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

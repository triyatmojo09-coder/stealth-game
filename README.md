# Shadow Protocol

[![make.fun](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/triyatmojo09-coder/stealth-game/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/triyatmojo09-coder/stealth-game/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)

An original side-view 2D stealth game. Each facility is a cross-section of
stacked floors, ladders and dark alcoves: run the slabs, climb between
levels, steal the intel, and reach the exit unseen. Made for the make.fun bounty
[Make the best stealth game](https://make.fun/bounty/best-stealth-game-20261121-1759).

Every infiltration opens with a **mission brief** — an operation name, the
objective list, and site intel written from that facility's actual layout
(guard counts, patrol spans, laser timing, where the dark ground runs).
The presentation is an ops-console look: bundled stencil and condensed
typefaces, thick floor slabs with lit edges and hazard striping, layered
back walls (archive shelving and night windows, vault steel and the great
door, a live server wall in the core), gradient vision cones that warm
from amber to red as a guard's suspicion climbs, and a stencil grade
stamp on every clear.

## How it plays

You are a lone infiltrator in a hood and backpack, seen from the side.
Gravity is real: you run along floors, drop off edges and climb ladders
between the stacked levels of each facility.

- **Guards patrol** their floor with horizontal raycast vision cones —
  walls, doors, crates and server racks block their sight, exactly as
  they block yours. A guard who half-sees you gets **suspicious** and
  comes to investigate; a guard who fills the meter raises the
  **alarm** and every guard converges on you. Get caught and the
  facility resets.
- **Detection meter.** It fills fast up close and in the open, slowly at
  range, slower while you crouch — and far slower in the dark
  **shadow alcoves**, where the HUD reads HIDDEN and your silhouette dims.
- **Crouch (SHIFT, or DOWN while standing):** slower, quieter, harder to
  spot — and low enough to disappear behind a crate or a counter that a
  standing figure would be seen over.
- **Coin lure (Q or click):** lob one of your few coins in a gravity arc
  in the direction you face. The clink where it lands pulls nearby guards
  over to investigate — or away from your route.
- **Rear takedown (E):** creep up behind an unaware guard on his own
  floor and take them out for good.
- **Security cameras** hang under the slabs and sweep their cones back
  and forth; being caught on camera fills the same meter and raises the
  same alarm.
- **Keycard doors** block the way between floors until you hold the
  keycard. **Laser grids** blink on a timer — cross while they are off,
  or trip the alarm.
- **Objectives:** steal the INTEL, then reach the EXIT. Finish a level
  without ever being spotted for the **ghost bonus** (+1,500) and the S grade.

## Levels

1. **The Archive** — *Operation Quiet Ledger.* Three stacked floors, two
   guards, one camera under the mezzanine, and an unlit reading room on
   the top floor where the cipher ledger sits.
2. **The Vault** — *Operation Cold Vault.* A keycard on the west teller
   floor, a timed laser grid inside the vault chamber, three guards, and
   the bearer bonds glowing behind the great door.
3. **The Core** — *Operation Dead Signal.* Four guards, three cameras,
   two laser grids, a dark maintenance run under the server floor, and a
   shadow alcove behind the last rack. Ghost it.

Grades (S/A/B/C) reward speed, clean runs and ghost bonuses. Progress and
best grades are saved in localStorage; finished levels unlock the next one.

## Controls

| Key | Action |
| --- | --- |
| A / D or ← / → | Run left / right |
| W / S or ↑ / ↓ | Climb ladders (↓ on a ladder gap descends; ↓ standing crouches) |
| SHIFT (hold) | Crouch — slow, quiet, hard to see, hides behind cover |
| Q or mouse click | Throw a coin in a gravity arc toward your facing (limited) |
| E | Rear takedown (only from behind, same floor, guard unaware) |
| ESC / P | Pause |
| M | Mute / unmute |
| 1 / 2 / 3, Enter | Pick a level on the title screen |

## Tech

- Plain static files under `game/` — no build step, no libraries, no network
  requests. Open `game/index.html` in a desktop browser and play.
- Canvas 2D rendering, ES modules, WebAudio sound effects synthesized in
  code (footsteps, coin clinks, alert stings, win arpeggio).
- Type is bundled, never loaded: subset Black Ops One (display) and Rajdhani
  (HUD/body) woff2 files under `game/assets/fonts/`, both open-source
  (OFL), subset to the game's character set — about 44 KB in total.
- Source is split by job: `config.js` (tuning), `levels.js` (the three
  facilities), `physics.js` (gravity and tile collision), `vision.js`
  (raycast sight), `guards.js` (guard and camera AI), `player.js`,
  `render.js`, `game.js` (state machine), `scoring.js`, `storage.js`,
  `audio.js`, `input.js`, `main.js` (bootstrap).

## Play locally

```sh
# serve game/ with any static server, then open http://localhost:8080
python3 -m http.server --directory game 8080
```

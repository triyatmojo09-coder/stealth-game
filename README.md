# Shadow Protocol

[![make.fun](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/triyatmojo09-coder/stealth-game/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/triyatmojo09-coder/stealth-game/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)

An original top-down 2D stealth game. Infiltrate three facilities, steal the
intel, and reach the exit unseen. Made for the make.fun bounty
[Make the best stealth game](https://make.fun/bounty/best-stealth-game-20261121-1759).

## How it plays

You are a lone infiltrator in a hooded teal cloak. Every facility is a
hand-designed floor plan of walls, shadow zones, patrol routes, cameras and
laser grids.

- **Guards patrol** fixed routes with raycast vision cones — walls block
  their sight, exactly as they block yours. A guard who half-sees you gets
  **suspicious** and comes to investigate; a guard who fills the meter
  raises the **alarm** and every guard converges on you. Get caught and the
  facility resets.
- **Detection meter.** It fills fast up close and in the open, slowly at
  range, slower still while you sneak — and far slower in the dark-blue
  **shadow zones**, where the HUD reads HIDDEN.
- **Sneak (SHIFT):** slower, quieter, harder to spot. Walking is faster but
  louder and more visible.
- **Coin lure (Q or click):** throw one of your few coins toward the mouse.
  The clink pulls nearby guards over to investigate — or away from your route.
- **Rear takedown (E):** creep up behind an unaware guard and take them out
  for good.
- **Security cameras** sweep their cones back and forth; being caught on
  camera fills the same meter and raises the same alarm.
- **Keycard doors** open only once you have the keycard. **Laser grids**
  blink on a timer — cross while they are off, or trip the alarm.
- **Objectives:** steal the INTEL, then reach the EXIT. Finish a level
  without ever being spotted for the **ghost bonus** (+500) and the S grade.

## Levels

1. **The Archive** — learn the ropes: two guards, one camera, one shadowy
   intel room.
2. **The Vault** — a keycard door and a laser grid guard the intel.
3. **The Core** — four guards, three cameras, two laser grids. Ghost it.

Grades (S/A/B/C) reward speed, clean runs and ghost bonuses. Progress and
best grades are saved in localStorage; finished levels unlock the next one.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move |
| SHIFT (hold) | Sneak — slow, quiet, hard to see |
| Q or mouse click | Throw a coin toward the mouse (limited) |
| E | Rear takedown (only from behind, only while the guard is unaware) |
| ESC / P | Pause |
| M | Mute / unmute |
| 1 / 2 / 3, Enter | Pick a level on the title screen |

## Tech

- Plain static files under `game/` — no build step, no libraries, no network
  requests. Open `game/index.html` in a desktop browser and play.
- Canvas 2D rendering, ES modules, WebAudio sound effects synthesized in
  code (footsteps, coin clinks, alert stings, win arpeggio).
- Source is split by job: `config.js` (tuning), `levels.js` (the three
  facilities), `vision.js` (raycast sight), `guards.js` (guard and camera
  AI), `player.js`, `render.js`, `game.js` (state machine), `scoring.js`,
  `storage.js`, `audio.js`, `input.js`, `main.js` (bootstrap).

## Play locally

```sh
# serve game/ with any static server, then open http://localhost:8080
python3 -m http.server --directory game 8080
```

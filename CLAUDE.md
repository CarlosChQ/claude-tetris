# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JavaScript Tetris on HTML5 Canvas. No dependencies, no `package.json`, no build step, no linter, no tests. Three source files: `index.html`, `style.css`, `game.js`. README and UI strings are in Spanish; keep user-facing text in Spanish.

## Running

Open `index.html` directly (`start index.html` on Windows) or serve the folder with any static server, e.g. `python -m http.server 8000` and visit `http://localhost:8000`. Verify changes manually in the browser.

## Architecture (`game.js`)

- **Global mutable state**: `board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `lastTime`, `dropAccum`, `dropInterval`, `animId`, `gravityCharges` are module-level `let`s. `init()` resets all of them and is also the restart handler.
- **Board model**: `ROWS × COLS` matrix; each cell is `0` (empty) or a piece type index `1–9`. The same index selects the color in `COLORS` and is the value stored inside each `PIECES` shape matrix, so `COLORS`, `PIECES` and the type range in `randomPiece()` must stay aligned.
- **Gravity power-up**: `randomPiece()` marks one cell with probability `POWER_CHANCE` by storing `type + POWER` (`11–19`). Always derive color via `v % POWER`, and keep `POWER` greater than the highest type. Clearing a row with a marked cell gives `gravityCharges++` in `clearLines()`. Key `G` spends one charge on `applyGravity()`, which compacts each column downward and then calls `clearLines()`.
- **Pieces**: square matrices; `rotateCW` transposes and reverses. `tryRotate` applies simple wall kicks with x offsets `[0, -1, 1, -2, 2]` (not SRS).
- **Collision**: `collide(shape, ox, oy)` is the single source of truth for movement, rotation, ghost projection (`ghostY`), and game-over detection in `spawn()`. Cells with `y < 0` are allowed.
- **Game loop**: `loop(ts)` via `requestAnimationFrame`, accumulates `dt` into `dropAccum` and drops one row when it exceeds `dropInterval`. Pause/game over work by `cancelAnimationFrame(animId)`.
- **Piece lifecycle**: `lockPiece()` = `merge()` → `clearLines()` → `spawn()`. `clearLines()` also updates `lines`, `score`, `level` and `dropInterval`.
- **Scoring/speed**: `LINE_SCORES[cleared] * level`; hard drop +2 per cell, soft drop +1 per row. Level = `floor(lines / 10) + 1`; `dropInterval = max(100, 1000 - (level - 1) * 90)` ms.
- **HUD**: DOM elements (`#score`, `#lines`, `#level`, `#gravity`) updated through `updateHUD()`; overlay (`#overlay`) is shown/hidden by toggling the `hidden` class.

## Coupling to watch

- Changing `COLS`, `ROWS` or `BLOCK` requires updating the `<canvas id="board">` `width`/`height` in `index.html` (`COLS × BLOCK` by `ROWS × BLOCK`).
- `drawNext()` assumes a 4×4 grid of 30px cells, matching the 120×120 `#next-canvas`.
- Key bindings live in the `keydown` listener in `game.js` and are also listed in the controls panel in `index.html` and the README table; keep all three in sync.

# Voltiris: The Game

Offline-first isometric idle management game (greenhouse + energy) for iOS/Android.
Stack: TypeScript strict, React, Vite, PixiJS, Zustand, Dexie, Vitest, Capacitor.

Full design and phased plan: `Voltiris The Game – Build Plan for Claude Code.md` (repo root).

## Rules

- Game rules live ONLY in packages/sim. No DOM, no React, no Date.now() there.
- The sim is deterministic: seeded RNG saved in state, injected clock.
- Every player action is a Command (UUID + timestamp) handled by the sim.
- Fixed tick = 1 in-game hour = 15 real seconds. Offline catch-up runs ticks in a loop.
- Content (crops, equipment, modules, buildings, events) is data in packages/content.
- GameState is versioned; any change to its shape needs a migration + test.
- Persistence only via the SaveStore interface (local now, cloud later).
- Write Vitest tests for all sim logic. Keep functions small and typed.
- Work on one build-plan phase at a time and stop when its Done-when list passes.

## Commands (run from repo root)

- `npm test` – all Vitest projects (sim, content, mobile)
- `npm run lint` – ESLint (bans Date.now / Math.random / new Date() in packages/sim)
- `npm run typecheck` – tsc in every workspace
- `npm run format` / `npm run format:check` – Prettier
- `npm run dev` – Vite dev server for apps/mobile
- `npm run build` – production web build to apps/mobile/dist
- `npm run e2e` – Playwright end-to-end tests of the production build: WebKit as iPhone 16 and iPhone SE, Chromium as Pixel 7 (landscape, full screen). Screenshots land in `apps/mobile/e2e/results`
- `npm run cap:sync -w @voltiris/mobile` – build and copy web assets into android/ and ios/
- `npm run android -w @voltiris/mobile` – build, sync and run on an Android emulator/device

## CI and iOS (no Mac needed)

- `.github/workflows/ci.yml` (every push, Ubuntu): checks, unit tests, e2e tests, Android debug build.
- `.github/workflows/ios.yml` (pushes to main, macOS 26 / Xcode 26): builds the iOS app for the Simulator and runs `apps/mobile/scripts/ios-smoke.sh` (launch, close for 30 s at 240x, relaunch from the save). Screenshots, console logs and save files are uploaded as the `ios-smoke` artifact: `gh run download <run> -n ios-smoke`.
- iOS minimum is 16.4 (Xcode project); Vite builds for `chrome107` and `safari16.4`.

## Sim API (packages/sim)

- `createGame({ playerId, seed }, content, clock)` – new GameState (ids come from the seeded RNG)
- `applyCommand(state, command, content)` – `{ ok: true, state }` or `{ ok: false, error }`; rejected commands leave state untouched
- `tick(state, content)` – exactly one in-game hour
- `advance(state, clock, content)` – runs every tick due by `clock.now()`, at most `content.time.maxCatchUpMs` (24 real hours); the rest is skipped. Call it before applying a command
- `catchUp(state, clock, content)` – `advance` plus a report for the "while you were away" summary (time away, ticks, skipped time, crops that became ready, money change)
- `restoreGame(raw, content)` – turns saved JSON back into a GameState: runs `MIGRATIONS`, then checks every field. When STATE_VERSION goes up, add `MIGRATIONS[oldVersion]` with a test; `src/fixtures/save-v1.json` must keep loading
- Content is always passed in (`defaultContent` from @voltiris/content), so tests and balance scripts can use their own
- Sim tests share helpers in `packages/sim/src/test-utils.ts`

## App structure (apps/mobile/src)

- `game/` – Zustand store (`createGameStore`), game loop (pauses in the background), app lifecycle, services context, formatting, gauge readings. The UI only reads state and calls store actions that send sim commands.
- `save/` – `SaveStore` interface: files in the app's Library folder on phones (Capacitor Filesystem; iOS may clear web storage), IndexedDB (Dexie) in browsers, memory for tests. `loadGame` (current save, then the 2 backups); autosave; the `voltiris-save` JSON file format for export (share sheet on phones, download in browsers) and import.
- `iso/` – pure isometric math: projection, camera, world layout (lot, buildings, road, tap targets), scenery placement, draw order, gesture tracking. Unit-tested.
- `scene/` – Pixi world via @pixi/react; `draw/` holds the placeholder toon shapes. Camera moves are written straight to the Pixi container (and the DOM name tags over buildings), never through React state.
- `ui/` – DOM overlay: HUD, climate badges, plot bubble, game windows (buildings, settings, welcome back, load problem), toast. Shared game look: `GameButton`, `GameWindow`, `icons.tsx`, Fredoka font.
- App tests mock `scene/GameCanvas` (jsdom has no WebGL); rendering and real taps are covered by the e2e tests (`apps/mobile/e2e`, positions from `iso/view.ts`) and the emulator / iOS Simulator.

## Dev flags

- Browser: `?speed=240&debug`. Emulator build: `VITE_TIME_SPEED=240 VITE_DEBUG=1 npm run build -w @voltiris/mobile`, then sync.
- `speed` multiplies game time, including time while the app is closed: at 240, closing the app for 30 s is a 2-hour break. Loading a save at a different speed makes time jump (the 24-hour cap absorbs it).
- `debug` shows an FPS meter (also logged as `[fps]`, visible in `adb logcat`), previews the equipment shapes, and logs `[app] hidden` / `[app] visible`.

## Design decisions

- Currency: Volticoin (coin icon with a lightning bolt).
- Tone: playful toon look, but real units (°C, %, ppm, PAR, EC) with plain-language status ("Too cold").
- Climate is static greenhouse state until its drivers arrive: water/nutrient use (Phase 5), equipment (Phase 6), weather (Phase 10).
- Gauges judge each value against the growing crop that is worst off.
- Game modes are buildings on the map, not a menu: Market stall → Market, Energy shed → Energy, Town hall → Village. Tap the building or its name tag. They show "under construction" until their phase.
- Tapping a plot opens a bubble at the plot (seeds, growth, what holds it back); panning closes it.
- Climate shows as badges down the left edge; the ring colour is the status, with a note when off.
- The player's lot sits beside a road on endless land. The camera stays over the lot (2 tiles inside the fence) and zooms out until the whole lot fits. "For sale" signs mark future expansions. The lot and building spots live in `iso/layout.ts` until Phase 9 puts land into GameState.
- Full screen: system bars and the iOS home indicator hidden (Capacitor SystemBars); edge swipes are deferred (`GameViewController` on iOS, transient bars on Android) so panning near an edge stays in the game.
- Saves: every 30 s, after every command and when the app is hidden; current save plus 2 backups. A damaged save or one from a newer version is never replaced without asking.
- "Welcome back" appears after launch or a return from the background when 20+ ticks (5 real minutes) were caught up; stalls while playing never trigger it.

## Notes

- Workspaces import each other's TypeScript source directly (package `exports` point to `src/index.ts`); there is no per-package build.
- TypeScript is pinned to ~6.0 because typescript-eslint does not support 7.x yet.
- The app is landscape-only (AndroidManifest `sensorLandscape`, iOS Info.plist orientations).

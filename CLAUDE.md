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
- `npm run cap:sync -w @voltiris/mobile` – build and copy web assets into android/ and ios/
- `npm run android -w @voltiris/mobile` – build, sync and run on an Android emulator/device

## Sim API (packages/sim)

- `createGame({ playerId, seed }, content, clock)` – new GameState (ids come from the seeded RNG)
- `applyCommand(state, command, content)` – `{ ok: true, state }` or `{ ok: false, error }`; rejected commands leave state untouched
- `tick(state, content)` – exactly one in-game hour
- `advance(state, clock, content)` – runs every tick due by `clock.now()`; call it before applying a command
- Content is always passed in (`defaultContent` from @voltiris/content), so tests and balance scripts can use their own
- Sim tests share helpers in `packages/sim/src/test-utils.ts`

## App structure (apps/mobile/src)

- `game/` – Zustand store (`createGameStore`), game loop, formatting, gauge readings. The UI only reads state and calls store actions that send sim commands.
- `iso/` – pure isometric math: projection, camera, scene layout, gesture tracking. Unit-tested.
- `scene/` – Pixi scene via @pixi/react; `draw/` holds the placeholder toon shapes. Camera moves are written straight to the Pixi container, never through React state.
- `ui/` – DOM overlay: HUD, climate gauges, plant panel, bottom nav.
- App tests mock `scene/GameCanvas` (jsdom has no WebGL); check rendering on the emulator.

## Dev flags

- Browser: `?speed=240&debug`. Emulator build: `VITE_TIME_SPEED=240 VITE_DEBUG=1 npm run build -w @voltiris/mobile`, then sync.
- `speed` multiplies game time; `debug` shows an FPS meter (also logged as `[fps]`, visible in `adb logcat`) and previews the equipment shapes.

## Design decisions

- Currency: Volticoin (coin icon with a lightning bolt).
- Tone: playful toon look, but real units (°C, %, ppm, PAR, EC) with plain-language status ("Too cold").
- Climate is static greenhouse state until its drivers arrive: water/nutrient use (Phase 5), equipment (Phase 6), weather (Phase 10).
- Gauges judge each value against the growing crop that is worst off.

## Notes

- Workspaces import each other's TypeScript source directly (package `exports` point to `src/index.ts`); there is no per-package build.
- TypeScript is pinned to ~6.0 because typescript-eslint does not support 7.x yet.
- The app is landscape-only (AndroidManifest `sensorLandscape`, iOS Info.plist orientations).

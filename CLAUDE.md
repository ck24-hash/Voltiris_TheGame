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

- `.github/workflows/ci.yml` (every push, Ubuntu): checks, unit tests, e2e tests, Android debug build. Headless WebKit on Linux does not draw the WebGL map (its screenshots show only the HUD), so there it tests the UI and saves; the map's drawing is covered by Chromium and the iOS job.
- `.github/workflows/ios.yml` (pushes to main, macOS 26 / Xcode 26): builds the iOS app for the Simulator and runs `apps/mobile/scripts/ios-smoke.sh` (launch, close for 30 s at 240x, relaunch from the save). Screenshots, console logs and save files are uploaded as the `ios-smoke` artifact: `gh run download <run> -n ios-smoke`.
- iOS minimum is 16.4 (Xcode project); Vite builds for `chrome107` and `safari16.4`.

## Sim API (packages/sim)

- `createGame({ playerId, seed }, content, clock)` – new GameState (ids come from the seeded RNG)
- `applyCommand(state, command, content)` – `{ ok: true, state }` or `{ ok: false, error }`; rejected commands leave state untouched. Commands: `PlantCrop` (pays the seeds), `Water`, `Fertilize` (top up a greenhouse for a fee), `HarvestCrop` (ready crop → storage lot), `SellCrop` (units of a crop, oldest lots first), `BuyEquipment` (install or next level, as new), `ServiceEquipment` (clears wear), `SetSetpoint` (pushes its partner to keep heating below venting, fogging below venting), `SetAutoControl` (needs a climate computer), `UpgradeGreenhouse` (`glass`, `size` adds plots with seeded ids, `computer`). Crop commands are in `commands.ts`, greenhouse ones in `greenhouseCommands.ts`
- `tick(state, content)` – exactly one in-game hour: crops grow in the climate at the start of the hour; each greenhouse's plan runs (`climate.ts`) if the money covers what it owes, else its equipment stays off; the air moves toward the plan's balance, the plants drink, fertigation tops up, devices wear by their load; whole Volticoins are paid and the fraction carries over in `owed`; spoiled lots leave storage, market swings move (seeded RNG)
- `climate.ts` – `planClimate` / `greenhousePlan` (setpoints in use, each device's load and cost, the air's balance, water and nutrients after the hour, gas and power kWh, cost), `plantActivity`, `nextClimate` (air settles a share of the way and snaps on within 0.01). Flows are per plot, so size changes costs, not the climate. `control.ts` – the climate computer's `autoSetpoints`; `equipment.ts` – levels, wear `strength`, `serviceCost`
- `advance(state, clock, content)` – runs every tick due by `clock.now()`, at most `content.time.maxCatchUpMs` (24 real hours); the rest is skipped. Call it before applying a command
- `catchUp(state, clock, content)` – `advance` plus a report for the "while you were away" summary (time away, ticks, skipped time, crops that became ready, produce that spoiled, money change)
- `market.ts` – `cropPrice` = base price × `seasonalFactor` × swing; `storage.ts` – `freshness`, `lotQuality`, `stockOf`, `sell`. Prices and growth use only + − × ÷ where they must match on every device (no `Math.sin`)
- `restoreGame(raw, content)` – turns saved JSON back into a GameState: runs `MIGRATIONS`, then checks every field. When STATE_VERSION goes up, add `MIGRATIONS[oldVersion]` with a test; `src/fixtures/save-v1.json` and `save-v2.json` must keep loading
- Content is always passed in (`defaultContent` from @voltiris/content), so tests and balance scripts can use their own
- Sim tests share helpers in `packages/sim/src/test-utils.ts`: `STILL_AIR` (content where the air holds whatever climate a test sets with `withClimate`), `equipped`, `buy`, `growCrop` (plant every plot, run until ready, water and feed by hand)

## App structure (apps/mobile/src)

- `game/` – Zustand store (`createGameStore`), game loop (pauses in the background), app lifecycle, services context, formatting, gauge readings. The UI only reads state and calls store actions that send sim commands.
- `save/` – `SaveStore` interface: files in the app's Library folder on phones (Capacitor Filesystem; iOS may clear web storage), IndexedDB (Dexie) in browsers, memory for tests. `loadGame` (current save, then the 2 backups); autosave; the `voltiris-save` JSON file format for export (share sheet on phones, download in browsers) and import.
- `iso/` – pure isometric math: projection, camera, world layout (lot, buildings, road, tap targets), scenery placement, draw order, gesture tracking. Unit-tested.
- `scene/` – Pixi world via @pixi/react; `draw/` holds the placeholder toon shapes. Camera moves are written straight to the Pixi container (and the DOM name tags over buildings), never through React state.
- `ui/` – DOM overlay: HUD, climate badges (with water/feed "+"), plot bubble (seeds, growth, harvest), game windows (greenhouse with Equipment / Climate / Upgrades tabs, market, storage, buildings to come, settings, welcome back, load problem), toast. Shared game look: `GameButton`, `GameWindow`, `CareButton`, `icons.tsx`, Fredoka font. Equipment names and setpoint labels are in `ui/equipmentInfo.ts`.
- Store actions for commands return the sim's `CommandError` (or null); the screen that sent it shows it (`game/commandErrors.ts` has the player-facing text).
- `game/selectors.ts` `equipmentPlan` – the coming hour's plan and whether it runs (money covers `owed` + cost); the greenhouse window and the scene's equipment drawings both use it.
- Gauges judge a value as it is shown (rounded to the gauge's precision), so "22.0 °C" never reads "Too cold" for a crop that wants 22 °C.
- App tests mock `scene/GameCanvas` (jsdom has no WebGL); rendering and real taps are covered by the e2e tests (`apps/mobile/e2e`, positions from `iso/view.ts`) and the emulator / iOS Simulator.
- In e2e tests, skip game time with `page.clock.fastForward` (or `setSystemTime`), never `runFor`: `runFor` fires every animation frame in between and stalls software rendering.

## Dev flags

- Browser: `?speed=240&debug`. Emulator build: `VITE_TIME_SPEED=240 VITE_DEBUG=1 npm run build -w @voltiris/mobile`, then sync.
- `speed` multiplies game time, including time while the app is closed: at 240, closing the app for 30 s is a 2-hour break. Loading a save at a different speed makes time jump (the 24-hour cap absorbs it).
- `debug` shows an FPS meter (also logged as `[fps]`, visible in `adb logcat`) and logs `[app] hidden` / `[app] visible`.

## Design decisions

- Currency: Volticoin (coin icon with a lightning bolt).
- Tone: playful toon look, but real units (°C, %, ppm, PAR, EC) with plain-language status ("Too cold").
- Crops (quickest first): microgreens ~2 min, cucumber ~7 min, strawberry ~30 min, tomato ~1 h, pepper ~2 h of real time in the starting greenhouse (`growthHours` in content). Slower crops earn more per harvest but less per hour, so active play pays and slow crops suit a break. `sim/src/economy.test.ts` guards these targets and the Phase 5 "profit in 10 minutes".
- Water and nutrients drain as crops grow; the player tops them up by hand for a small fee (fixed steps, too much is bad too). A crop that runs dry stops growing and takes stress (lower quality), but never dies. Fertigation keeps them at its setpoints, at half the price of doing it by hand.
- Harvests go to the storage barn (capacity in content) and lose freshness linearly over the crop's shelf life, then spoil. Ready crops wait on the plant without losing quality.
- Market price = base × season (gradual, per crop) × a swing that wanders around 1 every tick. Sale value = units × price × quality × freshness, rounded to whole Volticoins.
- Climate: each hour the air moves part of the way to a balance set by the weather outside (steady until Phase 10: 12 °C, 60%, 420 ppm, 500 PAR), the glass (heat loss, light, leaks), the plants (moisture out, CO₂ in) and the equipment. An empty starting greenhouse balances at the starting climate (20 °C, 60%, 420 ppm, 400 PAR); cucumbers start a little too dry, which is the fogger's job.
- Equipment, one of each per greenhouse, each with levels: heater (gas heater → hot-water pipes, both gas with a little CO₂ in the exhaust → electric heat pump, 4× as efficient; the player chose gas first), vents (roof vents → fans), fogger (raises humidity, cools a little), CO₂ injector, grow lights (sodium → LED), fertigation. Each works to its setpoints as far as its output allows; prices and outputs are in `content/src/equipment.ts`. `sim/src/equipment.test.ts` guards the Phase 6 "each piece changes the climate and growth". Starting setpoints sit inside the crops' bands (heat to 23 °C, fog below 75%), so new equipment helps straight away.
- Climate computer (greenhouse upgrade): on auto it sets every target just inside the band all growing crops share (the middle where they disagree), and lets the equipment idle when nothing grows; the player can switch it to manual.
- Glass: double glass keeps the sun's heat in (warmer for free, a little darker, needs venting for cool crops); diffuse glass adds light. Size: 4 → 6 → 8 plots.
- Running costs: gas and power (flat prices until Phase 7) plus supplies (CO₂, water, fertilizer). Equipment runs only while the money covers what it owes, so being broke switches it off rather than going into debt. Devices wear by their load and lose up to half their output; a service costs a share of the price times the wear. Breakdowns come in Phase 10.
- Gauges judge each value against the growing crop that is worst off.
- Game modes are on the map, not a menu: the greenhouse (its glass, roof or name tag) → Greenhouse, Market stall → Market, Storage barn → Storage, Energy shed → Energy, Town hall → Village. Tap the building or its name tag. Energy and Village show "under construction" (cones, "Soon") until their phase.
- The equipment is drawn in the greenhouse: floor devices along the back walls (behind every plot), lamps and the fog line over the plants, vents on the roof opening as far as they work; heaters glow, lamps light and fog mists while they run.
- Tapping a plot opens a bubble at the plot (seeds with cost and time, growth, what holds it back with water/feed buttons, harvest); panning closes it.
- A window's backdrop only closes it when the press started on the backdrop: the click that follows the tap which opened the window lands there.
- Climate shows as badges down the left edge; the ring colour is the status, with a note when off.
- The player's lot sits beside a road on endless land. The camera stays over the lot (2 tiles inside the fence) and zooms out until the whole lot fits, or the whole yard fits beside the HUD. "For sale" signs mark future expansions. The lot and building spots live in `iso/layout.ts` until Phase 9 puts land into GameState.
- "Reduce Motion" turns off the pop-in animations (the e2e tests run with it on).
- Full screen: system bars and the iOS home indicator hidden (Capacitor SystemBars); edge swipes are deferred (`GameViewController` on iOS, transient bars on Android) so panning near an edge stays in the game.
- Saves: every 30 s, after every command and when the app is hidden; current save plus 2 backups. A damaged save or one from a newer version is never replaced without asking.
- "Welcome back" appears after launch or a return from the background when 20+ ticks (5 real minutes) were caught up; stalls while playing never trigger it.

## Notes

- Workspaces import each other's TypeScript source directly (package `exports` point to `src/index.ts`); there is no per-package build.
- TypeScript is pinned to ~6.0 because typescript-eslint does not support 7.x yet.
- The app is landscape-only (AndroidManifest `sensorLandscape`, iOS Info.plist orientations).

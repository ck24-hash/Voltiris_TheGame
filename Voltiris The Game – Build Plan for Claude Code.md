# Voltiris: The Game – Build Plan for Claude Code

Oct 8, 2026 · @Charbel El Khoury

## Vision and scope

Voltiris: The Game is an offline-first, real-time idle management game for iOS and Android where you run a greenhouse complex, balance climate, CO2, nutrients and electricity, and sell tomatoes, cucumbers and peppers for profit. Voltiris modules are the signature upgrade: they generate power and boost yield at the same time.

**Core loop**

1. Plant a crop and set up the climate.
2. Keep temperature, humidity, CO2, light, water and nutrients in the crop's optimal band while managing energy cost.
3. Harvest, store, and sell at fluctuating market prices or to customer orders.
4. Reinvest in equipment, greenhouse upgrades, Voltiris modules and new buildings.
5. Survive weather, pests, breakdowns and outages, then grow into a village complex.

**Decisions already made**

| Topic | Decision |
| --- | --- |
| Platform | Mobile (iOS and Android) |
| Time | Real-time idle style, with offline catch-up when the app is reopened |
| Visuals | 2D isometric, light toon style |
| Stack | TypeScript and React |
| Simulation depth | Medium at launch, designed to be deepened later |
| Crops at launch | Tomatoes, cucumbers, peppers |
| Energy | Grid (variable price), solar panels, batteries, CHP/biogas, plus Voltiris modules |
| Village | Greenhouses plus storage, market, energy plant and workshop |
| Events | Weather and seasons, pests and disease, market prices and orders, breakdowns and outages |
| Online | Offline for now, local save on the phone, architecture kept ready for online later |

**Out of scope for v1:** accounts, multiplayer, in-app purchases, staff hiring, flowers and herbs, 3D.

## Tech stack and architecture

Build one TypeScript codebase: a React web app with a PixiJS isometric renderer, packaged for iOS and Android with Capacitor. The game rules live in a pure TypeScript simulation package with no UI or browser code, so it can later run on a server unchanged.

| Layer | Choice | Why |
| --- | --- | --- |
| Language | TypeScript (strict) | Typed game state and fewer simulation bugs |
| App shell | React + Vite | Fast iteration, familiar stack |
| Isometric rendering | PixiJS (WebGL) via @pixi/react | Handles many sprites smoothly on phones; ideal for 2D iso |
| Mobile packaging | Capacitor | Wraps the web app as native iOS/Android, gives local notifications, storage and haptics |
| UI state | Zustand | Small, simple store that reads from the simulation |
| Local save | IndexedDB (Dexie) behind a `SaveStore` interface | Offline now, swappable for a cloud save later |
| Tests | Vitest | The simulation is tested headless, with no screen needed |
| Art | Placeholder SVG/PNG first, toon sprite sheets later | Gameplay does not wait on art |

**Architecture rules Claude Code must follow**

- **Separate simulation from UI.** The `sim` package takes a state and a command or tick, and returns a new state. React and Pixi only read state and send commands.
- **Everything the player does is a command** (for example `PlantCrop`, `BuyEquipment`, `SetThermostat`). This makes online play, replays and server validation possible later.
- **Deterministic sim.** Use a seeded random generator whose state is saved with the game. Time comes from an injected clock, never `Date.now()` inside the sim.
- **Fixed tick.** One tick equals one in-game hour. Real-time play runs ticks on a timer; offline catch-up runs many ticks in a loop (see Data model and save system).
- **Data-driven content.** Crops, equipment, modules, buildings and events are defined in JSON/TS data files, never hardcoded in logic, so balancing needs no code changes.
- **Service interfaces for later online use:** `SaveStore`, `Clock`, `Analytics`, `AuthService` (stub). Only local implementations exist now.

**Suggested repo layout**

```text
voltiris/
  packages/sim/        # pure game rules, commands, tick, tests
  packages/content/    # crops, equipment, modules, buildings, events (data)
  apps/mobile/         # React + Pixi UI, Capacitor config
  CLAUDE.md            # rules for Claude Code
```

## Game systems design

Crop growth is driven by a set of climate factors that are balanced against energy cost: better conditions grow faster and give higher quality, but cost electricity, heat, CO2 and water.

**Time scale (all values are tunable constants)**

- 1 tick = 1 in-game hour = 15 real seconds.
- 1 in-game day = 6 real minutes. 1 season = 15 in-game days (90 real minutes). 1 year = 4 seasons.

**Climate model (medium depth)**

Each greenhouse tracks six variables, updated every tick:

| Variable | Raised by | Lowered by |
| --- | --- | --- |
| Temperature (°C) | Sun, heaters, CHP heat | Heat loss to outside, ventilation, fogging |
| Humidity (%) | Plant transpiration, fogging | Ventilation, heating |
| CO2 (ppm) | CO2 injection, CHP exhaust | Plant uptake; ventilation pulls it toward 420 ppm outside |
| Light (PAR) | Sun, grow lights | Cloud cover, season, Voltiris module shading |
| Water | Irrigation | Plant use |
| Nutrients (EC) | Fertilizer | Plant uptake |

**Growth formula.** Each crop has an optimal range per variable. Each variable gives a factor from 0 to 1 (1 inside the optimal band, falling off outside it). Growth per tick = base rate × weighted geometric mean of the factors × equipment and Voltiris yield bonuses. Time spent outside the band builds up stress, which lowers final quality and raises disease risk. Humidity above about 85% sharply raises fungal risk.

**Crops at launch** (starting values, to be balanced in the tuning phase)

| Crop | Growth time (in-game days) | Yield per plot | Base price | Likes | Sensitive to |
| --- | --- | --- | --- | --- | --- |
| Cucumber | 20 | 14 | 1.0 | Warm, humid | Cold nights, low water |
| Tomato | 30 | 10 | 1.6 | High light, CO2 | Humidity swings, nutrients |
| Pepper | 36 | 7 | 2.4 | Steady warmth | Cold, low light |

**Equipment** (each has a level, power draw, wear and breakdown risk)

- Heating: basic heater, then hot-water pipe network, then heat pump.
- Ventilation: roof vents, then fans with automatic control.
- Fogging system: raises humidity and cools in heatwaves.
- CO2 injector, fertigation (fertilizer + water) system, grow lights.
- Greenhouse upgrades: glass type (insulation, light), size (more plots), climate computer (automatic control).

**Energy system**

- Demand comes from heaters, grow lights, fans, fog pumps, CO2 injectors and the climate computer, measured in kW per hour.
- Supply sources: **grid** (price changes with time of day and season, can sell surplus at a lower price), **solar panels**, **CHP/biogas** (makes electricity and heat, and its exhaust gives CO2, so it supports the climate system), **batteries** (store cheap or surplus power, bridge outages).
- A dispatch step each tick uses own generation first, then batteries, then the grid. Blackouts cut the grid for several hours.

**Voltiris modules**

The signature mechanic. Modules are installed on greenhouse roof slots and do two things at once: generate electricity (kW depends on sun and season) and apply a yield multiplier to the crops underneath. Tiers 1 to 3 increase output and yield bonus, with rising price and upkeep. Roof slots are limited per greenhouse size, so the player chooses between modules, standard solar panels, and light for the crops. Exact trade-offs are listed as an open question below.

**Village buildings**

- **Storage:** holds harvested crops; produce loses quality over time, and capacity can be upgraded.
- **Market:** sets sale prices (random walk + seasonality + demand) and posts customer orders with a deadline and a price bonus.
- **Energy plant:** hosts CHP, batteries and the grid connection.
- **Workshop:** repairs equipment, reduces breakdown risk, and unlocks upgrades.

**Events and challenges**

- **Weather and seasons:** heatwaves, cold snaps, storms and cloudy spells change outside temperature and light.
- **Pests and disease:** whitefly, aphids and grey mould (botrytis); triggered by stress and humidity, treated with sprays or biological control.
- **Market:** price spikes and crashes, and customer orders with deadlines.
- **Breakdowns and outages:** equipment wears out and can fail; grid blackouts test the energy setup.

## Data model and save system

The whole game is one serializable `GameState` object saved locally, with a version number so old saves can be migrated when the game changes.

```ts
interface GameState {
  version: number;              // save schema version, drives migrations
  playerId: string;             // UUID, ready for online accounts later
  clock: { gameHour: number; lastTickAt: number };  // lastTickAt = real time ms
  rng: { seed: number; state: number };             // deterministic randomness
  money: number;
  village: { tiles: Tile[]; buildings: Building[] };
  greenhouses: Greenhouse[];    // climate, plots, equipment, modules
  energy: { batteries: Battery[]; generators: Generator[]; gridPrice: number };
  storage: { items: StoredCrop[]; capacity: number };
  market: { prices: Record<CropId, number>; orders: Order[] };
  world: { weather: Weather; season: Season; activeEvents: GameEvent[] };
  progress: { unlocked: string[]; goals: GoalState[]; stats: Stats };
  settings: { sound: boolean; notifications: boolean };
}
```

**Saving.** Save to IndexedDB every 30 seconds, after every purchase, and when the app goes to the background. Keep the last 2 saves as backup. Export/import a save file for debugging.

**Offline catch-up.** On launch, compute the real time passed since `lastTickAt`, convert it to ticks, and run them in a fast loop with coarser decisions (automation follows its saved settings, events are rolled normally). Cap catch-up at 24 real hours, and show a "while you were away" summary: harvest ready, money earned, events, equipment problems.

**Online-ready.** Every player action is a command with a UUID and timestamp, and all IDs are UUIDs, so commands can later be sent to a server, validated by the same `sim` package, and synced to a cloud save.

## Phased build plan for Claude Code

Give Claude Code one phase at a time, in order. Start every session with: "Read CLAUDE.md and the build plan, then do Phase N only. Write tests, and stop when the Done-when list passes." Each phase ends with a playable or testable result.

### Phase 1: Foundation

- **Goal:** a working project skeleton.
- **Tasks:** monorepo with `packages/sim`, `packages/content`, `apps/mobile`; React + Vite + TypeScript strict; Vitest; ESLint and Prettier; Capacitor added for iOS and Android; write `CLAUDE.md` with the architecture rules from this plan.
- **Done when:** `npm test` runs, the app opens in a browser with a blank game screen, and a Capacitor build opens on an Android emulator.

### Phase 2: Simulation core (no UI)

- **Goal:** the headless engine.
- **Tasks:** `GameState`, command system, fixed tick, seeded RNG, injected clock; one greenhouse with the six climate variables; crop growth formula; data files for the three crops.
- **Done when:** tests show a tomato planted in good conditions grows to harvest in the expected ticks, and bad climate slows growth and lowers quality. Same seed gives identical results.

### Phase 3: Isometric view and UI shell

- **Goal:** see and touch the greenhouse.
- **Tasks:** PixiJS isometric tile renderer with camera pan and pinch zoom; placeholder toon-style shapes for plants, greenhouse and equipment; HUD showing money, time, season and climate gauges; tap a plot to open a plant panel; bottom navigation bar.
- **Done when:** a greenhouse with plants renders at 60 fps on a mid-range phone, and gauges update live from the simulation.

### Phase 4: Save system and offline catch-up

- **Goal:** progress is never lost.
- **Tasks:** `SaveStore` interface with IndexedDB implementation; autosave rules; versioned migrations; offline catch-up loop with 24-hour cap; "while you were away" summary screen; backup save and export/import.
- **Done when:** closing and reopening the app after 2 hours restores the game and fast-forwards it correctly, verified by tests.

### Phase 5: Crop loop and economy

- **Goal:** the first fun loop.
- **Tasks:** commands for plant, water, fertilize, harvest; storage building with quality decay; market with price random walk and seasonality; sell crops; starting money and costs from data files.
- **Done when:** a new player can plant, harvest and sell, and make a small profit within the first 10 minutes.

### Phase 6: Climate equipment and upgrades

- **Goal:** climate management becomes a strategy.
- **Tasks:** buy and level up heaters, vents, fogging, CO2 injector, fertigation, grow lights; manual setpoints plus automatic control from a climate computer; greenhouse upgrades (glass, size); equipment wear and running costs.
- **Done when:** each piece of equipment visibly changes climate variables and growth in tests and in the UI.

### Phase 7: Energy system

- **Goal:** electricity is a real constraint.
- **Tasks:** demand calculation; grid with time-of-day and seasonal price plus selling surplus; solar panels; batteries; CHP/biogas producing power, heat and CO2; dispatch order each tick; energy panel with live flows and daily cost.
- **Done when:** a player can cut their power bill by adding solar and a battery, and a CHP unit lowers heating and CO2 costs.

### Phase 8: Voltiris modules

- **Goal:** the signature feature.
- **Tasks:** module roof slots; three module tiers with kW output, yield multiplier, price and upkeep; shading versus yield trade-off with other roof uses; module panel showing generated kWh and yield gain; visual effect on the greenhouse roof.
- **Done when:** installing a module measurably increases both power generation and harvest, and the trade-off against solar panels is clear in the UI.

### Phase 9: Village and buildings

- **Goal:** grow from one greenhouse to a complex.
- **Tasks:** village tile map with buildable land and expansion; build more greenhouses; market, storage, energy plant and workshop buildings with upgrades; building placement UI; camera between buildings.
- **Done when:** the player can run three greenhouses sharing one energy plant, storage and market.

### Phase 10: Events and challenges

- **Goal:** pressure and variety.
- **Tasks:** weather and seasons driving outside temperature and light; heatwaves, cold snaps, storms; pests and disease with treatments; equipment breakdowns and workshop repairs; grid blackouts; customer orders with deadlines; event notifications.
- **Done when:** each event type triggers, can be survived with the right equipment, and is covered by tests.

### Phase 11: Progression, tutorial and balance

- **Goal:** a game people can learn and keep playing.
- **Tasks:** unlock tree for crops, equipment and modules; goals and achievements; guided tutorial for the first greenhouse; balance pass on prices, growth, energy and events using a simulation script that runs many in-game days; settings and sound.
- **Done when:** a balance script shows a sensible progression curve, and a new player completes the tutorial without help.

### Phase 12: Mobile polish and release prep

- **Goal:** ready for stores.
- **Tasks:** local push notifications (harvest ready, outage, order due); haptics; toon art pass and animations; performance and battery tuning; app icon, splash screen, store listing assets; privacy policy; test builds on iOS and Android.
- **Done when:** a release build installs and runs smoothly on real iOS and Android devices.

### Later: going online

Add accounts, cloud save, a server that replays commands through the same `sim` package, leaderboards, and trading. No rewrite should be needed because of the architecture rules above.

## CLAUDE.md starter and open questions

Paste this into `CLAUDE.md` at the repo root in Phase 1, so every Claude Code session follows the same rules.

```markdown
# Voltiris: The Game
Offline-first isometric idle management game (greenhouse + energy) for iOS/Android.
Stack: TypeScript strict, React, Vite, PixiJS, Zustand, Dexie, Vitest, Capacitor.

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
```

**Open questions to decide before or during the matching phase**

- **Voltiris modules (Phase 8):** what is the exact trade-off? Options: modules cover a percentage of the roof and shade crops slightly while boosting yield through light quality, or they have no shading but a higher price and upkeep.
- **Currency and tone (Phase 3):** plain money, or a branded currency? Is the tone realistic and educational, or playful and cartoonish?
- **Heating fuel (Phase 6):** is heating electric only, or also gas/biomass boilers?
- **Game length (Phase 11):** should the game have an end goal (for example a zero-emission, energy-positive complex) or stay open-ended?
- **Art (Phase 3 and 12):** will you supply toon art, generate it, or hire an artist? Phases 1 to 11 use placeholders.
- **Monetization (later):** stay premium or ad-free single purchase, or add optional purchases once online?

**Balance numbers.** All starting values (prices, growth times, energy costs, event odds) are first guesses and live in data files, so Phase 11 can change them without touching code.

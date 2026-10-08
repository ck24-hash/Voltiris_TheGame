# Voltiris: The Game

Offline-first, real-time idle management game for iOS and Android: run a greenhouse complex, balance climate and energy, and sell crops. See [the build plan](./Voltiris%20The%20Game%20–%20Build%20Plan%20for%20Claude%20Code.md) for the full design.

## Repo layout

```text
packages/sim/       pure game rules (no DOM, no React, deterministic)
packages/content/   game content as data (crops, equipment, modules, ...)
apps/mobile/        React + Vite app, packaged for Android/iOS with Capacitor
```

npm workspaces link the packages; the app imports their TypeScript source directly, so there is no per-package build.

## Requirements

- Node.js 24 (see `.nvmrc`)
- For Android: JDK 21, Android SDK (platform 36, build tools, emulator) and an Android Virtual Device
- For iOS: a Mac with Xcode

## Getting started

```sh
npm install
npm test          # run all tests
npm run dev       # open the game in a browser at http://localhost:5173
```

Other scripts (run from the repo root):

| Script              | What it does                                               |
| ------------------- | ---------------------------------------------------------- |
| `npm run lint`      | ESLint, including the determinism rules for `packages/sim` |
| `npm run typecheck` | TypeScript check in every workspace                        |
| `npm run format`    | Format all files with Prettier                             |
| `npm run build`     | Production web build to `apps/mobile/dist`                 |
| `npm run e2e`       | End-to-end tests in WebKit (iPhone) and Chromium (Android) |

The end-to-end tests need Playwright's browsers once: `npx playwright install webkit chromium`.

## Android

1. Install JDK 21 (Gradle 8.14 does not run on the JDK 25 bundled with Android Studio) and Android Studio:

   ```sh
   winget install Microsoft.OpenJDK.21
   winget install Google.AndroidStudio
   ```

2. Set the user environment variables:
   - `JAVA_HOME` = your JDK 21 folder (the Microsoft installer sets this)
   - `ANDROID_HOME` = `%LOCALAPPDATA%\Android\Sdk`
   - add `%ANDROID_HOME%\platform-tools`, `%ANDROID_HOME%\emulator` and `%ANDROID_HOME%\cmdline-tools\latest\bin` to `PATH`

3. Install the SDK packages and create an emulator (or use Android Studio's SDK and Device Managers). With command-line tools 23+, `sdkmanager` takes slash-style package IDs:

   ```sh
   sdkmanager "platform-tools" "emulator" "platforms/android-36" "build-tools/35.0.0" "system-images/android-36/google_apis/x86_64"
   avdmanager create avd -n Voltiris_Pixel_7a -d pixel_7a -k "system-images;android-36;google_apis;x86_64"
   ```

4. Start the emulator, then build, sync and run:

   ```sh
   emulator -avd Voltiris_Pixel_7a
   npm run android -w @voltiris/mobile
   ```

   Or open the native project in Android Studio with `npx cap open android` from `apps/mobile`.

## iOS

The Xcode project lives in `apps/mobile/ios` (Swift Package Manager, no CocoaPods). It needs iOS 16.4 or later and Xcode 26.

No Mac is needed day to day: on every push to `main`, the **iOS** GitHub Actions workflow builds the app on a macOS machine, plays it in the iPhone Simulator and uploads screenshots, console logs and save files (`gh run download <run id> -n ios-smoke`). The end-to-end tests also run the game in WebKit, Safari's engine.

On a Mac:

```sh
npm install
npm run cap:sync -w @voltiris/mobile
cd apps/mobile && npx cap open ios
```

## License

Proprietary. All rights reserved. See [LICENSE](./LICENSE).

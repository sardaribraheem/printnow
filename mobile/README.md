# PrintNow Android app

This is the native React Native/Expo app. It opens with **Upload & Print**, then file review, printing settings, pickup/delivery, offers and orders. The Next.js app in the repository root remains the browser/admin app.

## Try without cloud setup

Leave the public configuration empty. The app starts in clearly labelled **PREVIEW MODE** with sample customer/printer accounts and sample offers. No real printing is placed and selected documents are not uploaded. Selected files are private local cache copies; previews are cleared on logout/reset and the next startup. Sample state is in memory, so restarting the app resets it. Keep your original documents in your phone's file provider.

Android inspects PDF page counts and PNG/JPEG signatures/dimensions on the device and provides an in-app PDF page viewer. Up to three files, 25 MiB each, 75 MiB total and 200 printed sides are supported. Each image is one page; each file and copy starts on a fresh sheet.

**Current limitation:** APK/native-module compilation has not completed in this cloud environment because the required React Native Android archive redirects to `repo.reactnative.dev`, which its network policy blocks. No APK is attached and native-device functionality is not yet verified. JavaScript bundle/type checks and browser-based checks of the React Native UI do not replace Android device tests.

## Run on a laptop with Android Studio

Use Node 24, Java 21 to launch Gradle, an installed Java 17 compilation toolchain, Android Studio/SDK, and an Android device with USB debugging or an emulator. From a checkout:

```bash
cd mobile
npm ci
npm run android
```

`expo run:android` generates the Android project, compiles the native module and installs a development app. Keep the Metro terminal running for development. This custom PDF module requires a native build; Expo Go does not include it. On Windows, use Android Studio and the SDK in the same Windows environment as the mobile build, or follow a supported Expo Windows setup. The root web sandbox's WSL instructions do not automatically configure Android tooling.

Dependencies are pinned in `package-lock.json`. The SDK 58 project currently selects Android platform `platforms;android-37.0`, build-tools 37.0.0, NDK 27.1.12297006 and CMake 3.22.1. Set `ANDROID_HOME` to your installed SDK and make both JDKs discoverable. If Gradle cannot discover Java 17, set `org.gradle.java.installations.paths` in your local Gradle properties. Do not commit machine paths or signing keys.

## Build an APK for testing

```bash
cd mobile
npm ci
npm run build:apk
```

The build helper generates native Android files, checks the official Gradle distribution checksum and runs `assembleRelease`. On success the standalone, development-signed APK is `mobile/builds/printnow-preview.apk`. Install it on Android to test without Metro. It includes ARM64 and x86_64 architectures. It is for internal testing, not a Google Play release or production signing setup.

The **Android preview APK** GitHub Actions workflow also builds on changes to `main` or a manual dispatch. After a successful run, download its `printnow-android-preview` artifact, unzip it and install the APK on an Android phone. Artifacts expire after three days. A failed/pending run supplies no APK; check the workflow result before expecting a download. Running this workflow has not yet been observed from this task.

## Checks

```bash
npm run typecheck
npm run export:android
```

For shared tests and UI checks from the repository root, install root dependencies as well:

```bash
npm ci
npm --prefix mobile ci
npm run check
npm run mobile:typecheck
npm run mobile:lint
npm run test:mobile
```

`test:mobile` exports the React Native web test target and exercises the phone layout with Playwright/Chromium. It does not exercise Android's document picker, PdfRenderer or secure storage. The web export is a test aid, not the mobile distribution artifact.

## Later connected beta — deferred

No Supabase/Vercel setup is needed for preview work. When connected testing resumes, copy `.env.example` to ignored `.env.local` and supply only public API/Supabase bindings. Never put a Supabase secret/service-role key into the mobile app: `EXPO_PUBLIC_*` values ship inside it. The reachable HTTPS API, Supabase schema/Auth/Storage and worker must all be verified first. A phone's localhost is the phone, not your laptop.

Google/reset links, secure session refresh, real private uploads, remote PDF review and provider orders need hosted/device validation. No background push or guaranteed background upload is implemented. The Android PDF viewer is not implemented for iOS yet. See [../MOBILE_APP_PLAN.md](../MOBILE_APP_PLAN.md) for milestones and the minimal-cloud-storage requirement.

# PrintNow native package

This package uses Expo 58, React Native and TypeScript. Android is the first target. Read the installed package APIs and matching SDK documentation before changing native/Expo integrations. Prefer the versioned docs at https://docs.expo.dev/versions/v58.0.0/ and the index at https://docs.expo.dev/llms.txt. If network policy blocks docs, inspect the installed SDK source/types and record unverified native behavior.

## Architecture

- React Navigation manages native stacks and tabs in App.tsx; screen implementations live in src/screens/. Preserve that navigation contract.
- Portable domain rules/types come from ../src/lib/. Do not import server code, Node-only packages or privileged keys into mobile code.
- Native PDF inspection/rendering lives in modules/printnow-pdf/. Restrict local access to the app-owned selected-file cache; keep remote viewing authenticated and bounded.
- Generated android/ and ios/ projects are ignored. Configure native behavior in app.json, local modules and config plugins, then use Expo prebuild. Do not hand-edit generated projects.
- Custom native modules require a native development/release build; Expo Go is insufficient.

## Build and checks

Use the pinned lockfile with npm ci. Choose SDK-compatible Expo packages and verify against the installed SDK's bundledNativeModules.json. Consult mobile/README.md for local Android/Java requirements.

From the repository root after installing both dependency sets:

- npm run mobile:lint
- npm run mobile:typecheck
- npm run test:mobile (browser-based native UI checks, not device evidence)
- npm --prefix mobile run export:android (JavaScript bundle only)

Run lint and typecheck for native changes. APK compilation and physical-device tests are separate gates; never imply they passed because a JS export or browser test passed.

## Product/privacy

The founder deferred hosted setup. Continue useful native/on-device work without requesting Supabase/Vercel credentials. Default unconfigured builds to clearly labelled sample mode; no actual printing or document upload may occur there. Keep file selection, inspection and previews local. Minimize later request-scoped temporary storage without silently changing retention/dispute protections. See MOBILE_APP_PLAN.md.

Use local Android tooling or repository CI for testing APKs. EAS is optional; do not provision paid services, submit to stores or add an OTA/push service as an incidental change. Never commit signing material, generated builds or private environment bindings.

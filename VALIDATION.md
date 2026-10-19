# Validation evidence

The following checks ran in this cloud workspace against the implemented local application. They do not establish a hosted Supabase/Vercel deployment or a production release.

| Check                                          | Observed result                                                                                                                                                    |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Lint and generated-route TypeScript validation | Passed                                                                                                                                                             |
| Unit/domain/auth/file-worker tests             | 54 passed; none skipped                                                                                                                                            |
| Production Next.js build                       | Passed                                                                                                                                                             |
| Fresh PostgreSQL authorization suite           | Passed, including 22 initial identity/provider assertions and the marketplace/privacy/retention/history suites                                                     |
| Real concurrent PostgreSQL sessions            | One winning acceptance; idempotent retry; expiry after lock wait; one cancel/start-printing winner; consistent withdraw/accept race                                |
| Unconfigured production browser tests          | 14 passed across desktop/mobile, including rejection of sandbox cookies/endpoints in production                                                                    |
| Mobile marketplace browser tests               | 5 passed: complete PDF pickup, complete PNG/JPEG delivery, sandbox/origin guard, private onboarding restoration, and dispute-held physical file retention/deletion |
| Production dependency audit                    | Zero reported vulnerabilities at the time checked                                                                                                                  |
| Product documents                              | PRD.md/SPECs.md updated with the accepted native-app amendment; current milestones in MOBILE_APP_PLAN.md                                                           |

The full pickup/delivery tests upload actual fixture bytes, wait for background validation, collect offers from two independent printer accounts, accept an offer, verify losing-printer HTTP range access is denied, persist chat, advance fulfillment, record payment reports, confirm completion and reload the order. The PDF fixture verifies five pages × two duplex copies = ten printed sides and six physical sheets. Payment assertions are not bank verification.

The retention browser test verifies an unresolved support hold preserves real object bytes, admin evidence access requires an explicit case, resolution releases the hold, and originals, derived PDFs and preview images are physically removed. Database tests separately protect active orders and unresolved expired review holds.

Tests use synthetic local accounts/data. A local PostgreSQL auth harness models the Supabase roles/claims; hosted Auth/PostgREST/Storage/Realtime/MFA still require staging validation. The auth return in the onboarding test is simulated through the development-only sample identity; no real signup/login or email/OAuth delivery was tested.

Use the commands in README.md to reproduce. CI configuration exists, but a GitHub Actions run, Vercel deployment, hosted migration, hosted load/accessibility review, backup restore and real university pilot have not been observed or performed in this task. Generated screenshots/traces are under ignored test-results/.

## Native Android work — 19 October 2026

- Frozen mobile dependency installation and mobile TypeScript passed. Exact Expo/React Native dependencies are recorded in mobile/package-lock.json.
- Android Hermes JavaScript export passed (approximately 3 MB app bundle). This does not compile Kotlin or create an APK.
- Two Playwright checks passed against the React Native web test export at a phone viewport: upload-first home/tabs and local image preview/back navigation, settings/counts, consent, sample offers and order creation. This is browser evidence, not Android device evidence.
- Root lint/generated-route TypeScript, 54 unit tests and production Next.js build passed. Four native sample-flow tests cover pickup, delivery, chat retries/payment assertions, actual offer expiry and unknown PDF counts. Bearer transport/server tests cover required authentication and separation from browser/sample identities; Supabase verification is mocked in these unit tests, not a hosted result.
- Fresh PostgreSQL tests passed with all three migrations, including mobile file-registration retry identity, changed-payload conflicts, finalization recovery and denial of direct access to the internal base RPC. Existing ownership/privacy/retention and five real concurrency checks passed.
- All five local marketplace browser flows and all 14 unconfigured production browser checks passed after the mobile changes. Browser and native UI test configurations are separated.
- The local Android SDK/emulator were installed and the emulator booted, but no PrintNow native app was installed. APK assembly remains blocked when the React Native archive redirects to repo.reactnative.dev and the environment network policy returns HTTP 403. The custom Android PDF inspection/view module is discovered by Expo autolinking but has not been successfully compiled or tested on a device.
- A repository workflow prepares a standalone development-signed testing APK and a checksum, with three-day artifact retention and no persistent Gradle build cache. A successful GitHub Actions APK run has not been observed; there is no APK delivery or store release claim.

The founder deferred Supabase/Vercel setup. Preview files remain on device; no hosted migrations, provisioning or real print jobs were performed. Background push, process-death upload recovery, production signing, iOS PDF support, physical-device/accessibility/performance checks and hosted auth/storage/retention verification remain open.

Mobile dependency audit: npm audit --omit=dev reports 22 findings (15 high, 7 moderate) in the Expo/Metro/configuration dependency tree, including node-forge, braces and uuid. The reported root fixes require downgrading to incompatible Expo 44/React Native 0.72; no forced downgrade was applied. Many affected packages are build tools included by Expo's production dependency graph, but release requires a dependency review and compatible upstream fixes. The earlier zero-vulnerability audit applies to the root web production dependencies only.

# PrintNow native app plan

Accepted direction: Android first, React Native + Expo, English, PKR/Asia-Karachi. Updated 19 October 2026 following the founder's approval to start and subsequent instruction to defer Supabase/Vercel setup and reduce cloud storage.

## Product and current work

An installed app opens to a prominent **Upload & Print** action and Home, Orders, Messages and Account tabs. Selecting PDF, PNG or JPEG opens the phone's document picker. Customers preview files, choose printing settings and pickup/delivery, review consent, compare printer offers and follow the order. Approved printers use the same app in printer mode; administration remains on the web.

The native package is implemented in `mobile/`, with a clearly labelled preview mode requiring no hosting or credentials. Preview offers/orders are synthetic and place no printing orders. Selected files stay on the device. Preview data lives in memory and resets when the app restarts. This is not an offline production ordering system.

Native screens cover composing requests, file review, offers, acceptance, orders, chat, fulfillment, payment reports, account/provider settings and notifications. The connected API/auth/upload code is prepared, with local database tests, but hosted integration is deferred and unverified. Push notifications are future work; in-app refresh is implemented.

## Milestones

| Milestone                         | Deliverable                                                                                                                                   | Status and acceptance gate                                                                                                                                                                                                        |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0 — Native foundation            | Separate Expo/React Native package, native navigation, original upload-first home, icon and build commands                                    | Implemented; mobile TypeScript and Android JavaScript bundle checks pass.                                                                                                                                                         |
| M1 — On-device preview app        | Native picker, PDF/image previews, page and sheet counts, sample customer/printer journey; standalone Android testing APK                     | Code implemented. Android PDF module/native APK compilation and physical-device testing remain unverified. This cloud environment blocks a required React Native Maven download. A GitHub Actions APK build workflow is prepared. |
| M2 — Phone reliability            | Verify install, file picker/corrupt-file handling, keyboard/back navigation, device cache cleanup, accessibility, memory and interrupted work | Pending actual target-device evidence. Unsaved preview state does not survive process termination; do not promise background upload/resume.                                                                                       |
| M3 — Connected beta               | Verified Supabase auth, reachable API/worker, private uploads/viewing, actual customer/two-printer pickup and delivery                        | Deferred by founder. No hosted migrations/deployment are required for M1/M2 work.                                                                                                                                                 |
| M4 — Notifications and operations | Authorized push dispatch, token cleanup, retries/deep links, support, account deletion and retention verification                             | Pending. Foreground notifications do not establish background push delivery.                                                                                                                                                      |
| M5 — Release                      | Signed beta, real-user jobs, performance/privacy review, production operation and store package                                               | Pending. A development-signed testing APK is not a store release; iOS requires separate native implementation checks, signing and device tests.                                                                                   |

## Minimal cloud storage

1. Keep file selection, Android page inspection, previews and print configuration on the phone before an explicit connected submission. Preview mode makes no document upload.
2. Copy selected files into the app's private cache. Clear owned selected copies on logout, preview reset and next app startup. The Android viewer renders one bounded page at a time. Remote preview copies are removed when the view closes, with crash leftovers removed on next module initialization. The original document selected from the user's document provider is not deleted.
3. For the later connected beta, upload only request files needed for authorized printing after explicit consent. Never upload every file merely selected, abandoned previews, or device-library contents. Do not introduce a permanent cloud document library.
4. Server validation remains mandatory for live requests: a client-reported page count is not trusted authorization or validated printing evidence. Scope remote objects to requests; avoid repeated uploads by stable registration keys and retain only derivatives needed for printing/review.
5. Existing retention deadlines, active-order protection and unresolved-dispute holds remain binding. Before enabling real uploads, review measured storage usage and remove redundant derivatives without silently shortening those protections. No remote retention policy was changed in this native implementation.
6. Native builds run through local Android tooling or repository CI; no paid Expo build service is required. The prepared CI workflow retains testing APK artifacts for three days and does not persist a Gradle build cache.

## Technical boundaries

React Native/Expo screens reuse portable marketplace types and print rules. Next.js remains the browser/admin app and versioned mobile API host. Native requests verify Supabase bearer tokens and use database authorization as the user; business operations never use a privileged service identity. Browser origin/CSRF rules remain intact.

The Android PDF module uses the platform PdfRenderer rather than an external cloud renderer. Local URIs must resolve to the app-owned selected-file cache. Files are size-bounded; PDF page counts and image signatures/dimensions are inspected locally. Remote viewing requires HTTPS bearer authentication and renewed access checks for subsequent PDF pages. This native module still needs compilation and device validation.

The connected upload registration migration adds retry identity without bypassing ownership, draft state or byte validation. Apply all three migrations in order only when hosted setup resumes; local test fixtures must never run against hosted data.

## Verification and next action

See [VALIDATION.md](VALIDATION.md) for observed results and limitations, and [mobile/README.md](mobile/README.md) for build/run steps. Finish APK compilation and exercise the app on an Android phone, then improve device reliability before resuming cloud integration. No Supabase/Vercel setup is requested now. Public store submission and paid provisioning remain separate decisions.

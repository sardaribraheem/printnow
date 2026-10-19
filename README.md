# PrintNow

A mobile-first printing marketplace for the NIIT community and nearby Lahore providers. Customers upload PDF, PNG or JPEG files, compare five-minute printer offers, choose a provider, and follow pickup or delivery through completion. Payments go directly to the printer; launch commission and platform order fees are zero.

The application is implemented and runs in the development environment. Hosted Supabase deployment, real authentication/email/OAuth, a production worker and Vercel deployment are **not verified or completed**. [PRD.md](PRD.md) and [SPECs.md](SPECs.md) define the product; [PRODUCTION_PLAN.md](PRODUCTION_PLAN.md) records the accepted image-upload expansion and remaining release gates.

The Android-first native app is now in [mobile/](mobile/README.md). It has an upload-first phone interface and a clearly labelled sample mode that keeps selected files on the device. Supabase/Vercel setup is deferred at the founder's request. Native APK compilation/device testing remain outstanding; see [MOBILE_APP_PLAN.md](MOBILE_APP_PLAN.md) for milestone status.

## What works

- Three-step introduction; customer contact/address setup; tab-scoped setup restoration through sign-in; manual location entry and geolocation fallback.
- Customer requests, private file uploads, bounded background validation, PDF page counting, normalized print PDFs, previews, per-file page ranges/settings, side/sheet counts, and quality warnings for small images.
- Explicit posting consent, matching by service area/capabilities/pickup radius, structured clarification requests, immutable published revisions, and request editing/reposting.
- Printer applications, manual approvals/restrictions, capabilities/hours, own-offer history, complete price breakdowns, fixed five-minute offers, withdrawal/decline/replacement and transactional single acceptance.
- Approved order snapshots, private participant chat with history/read indicators, pickup/delivery progress, cancellation rules, direct-payment assertions/disputes and customer confirmation.
- Notifications, authorized Supabase Realtime subscriptions with polling fallback, admin MFA, audited case-scoped evidence review, support resolutions and retention holds.
- Cleanup of originals/previews/derivatives; active-order protection; unresolved-case holds; retry/failure visibility and stale-order review notifications.

## Run the development app

For a laptop, follow [LOCAL_LAPTOP.md](LOCAL_LAPTOP.md), including Windows/WSL and macOS prerequisites. The local sandbox creates sample accounts without Supabase credentials.

Each cloud task already has an isolated checkout. Use the existing checkout; do not create a Git worktree unless explicitly requested.

Requirements: Node 24, npm, Docker, Chromium for browser tests, and Poppler (`pdftoppm`) for file previews. These are available in the current cloud machine. Dependencies are pinned in `package-lock.json`. The worker Dockerfile installs Poppler on other hosts.

```bash
cd /workspace/printnow
npm --cache /workspace/.npm ci
npm --prefix mobile --cache /workspace/.npm ci
npm run sandbox
```

Start these in separate terminals:

```bash
npm run worker
```

```bash
NODE_USE_ENV_PROXY=1 npm run dev -- --port 3001
```

The development-only account selector offers a customer, two printers and an admin. These are visibly labelled sample accounts backed by real local PostgreSQL data and private local files. They are not real Supabase identities. The local adapter and production adapter call the same versioned database functions.

Sandbox identities require `NODE_ENV=development` and an explicit loopback database URL. Production rejects the sandbox endpoint and cookies, including when local configuration files exist. Never use the sandbox with real customer data. Its Docker volume persists locally, but restoration of Docker volumes in a new cloud snapshot is unverified; this is not a production database/backup strategy.

`npm run sandbox` preserves existing local data, applies unapplied migrations and idempotently installs synthetic fixture accounts. It does not reset a database or connect to hosted Supabase. The helper adds local development bindings to ignored `.env.local` without replacing existing entries. Uploaded bytes live in ignored `.printnow-files/` and are not public assets.

This cloud machine uses an outbound HTTP proxy. Set `NODE_USE_ENV_PROXY=1` before starting Node for hosted Supabase requests. Normal hosts without a proxy do not need it.

## Checks

```bash
npm run check             # lint, generated route types, TypeScript, unit/worker tests, build
npm run test:db           # fresh disposable PostgreSQL, RLS and real concurrency checks
npm run test:e2e          # isolated unconfigured production build; desktop/mobile checks
npm run test:marketplace  # starts its own dev server/worker; mobile marketplace flows
npm run format:check
npm run mobile:typecheck
npm run mobile:lint
npm run test:mobile       # native UI through a browser test target; not an Android device test
```

Database tests use a digest-pinned PostgreSQL image and synthetic data, without host ports or application data mounts. They check ownership, self-promotion, exact-address privacy, offer visibility, acceptance retries, lock-wait expiry, concurrent acceptance/cancellation/withdrawal, radius filtering, evidence holds, active-order retention, bounded chat history and worker isolation. The container is removed after the run.

Worker tests process real fixtures, including encrypted/corrupt PDFs and PNG/JPEG images, and verify removal of PDF active-content entry points. The parser runs in a separate process with time/memory/page/pixel bounds. This is not a claim of antivirus certification.

`test:e2e` intentionally builds with empty public Supabase variables. Use a separate output directory if another development server is running:

```bash
PRINTNOW_BUILD_DIR=.next-offline npm run test:e2e
```

`test:marketplace` uses `.next-marketplace/`, port 3101 and the local sandbox. It starts/stops only its own web/worker process groups. Its tests cover PDF pickup, mixed-image delivery, two providers, acceptance, chat, losing-printer file denial, fulfillment/payment/completion, private onboarding restoration and physical file deletion after a dispute hold is released. No email is sent and no OAuth provider is contacted by these tests. Screenshots/traces are generated under ignored `test-results/`.

Playwright uses `/usr/bin/chromium` when present. Otherwise install its Chromium or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. CI is configured to install Poppler and Chromium; execution on GitHub Actions has not been observed from this task.

## Hosted Supabase configuration

Use environment settings for bindings, or ignored `.env.local` for local integration. Never commit key values or use a privileged key in a public variable.

| Variable                               | Purpose                                                                                                                                              |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Public project URL; the selected development project is `https://zuxptuwyjsjnlotvyjvy.supabase.co`                                                   |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project publishable key, intended for browser use                                                                                                    |
| `NEXT_PUBLIC_SITE_URL`                 | Exact deployed app origin, initially the assigned `https://….vercel.app` origin                                                                      |
| `PRINTNOW_SUPABASE_SERVER_KEY`         | **Server/worker only:** a fresh privileged project key for private-object proxying and background jobs; supply securely through environment settings |
| `NODE_USE_ENV_PROXY`                   | `1` for Node 24 in this cloud environment                                                                                                            |

The privileged key previously exposed in chat was not used or stored and must be rotated. Do not reuse it for deployment. The public key/project connection was verified with read-only JWKS/auth-settings requests. Email signup is enabled and Google is disabled; the login UI reflects live provider settings. Successful hosted signup/login is unverified.

Hosted setup is deferred. When it resumes, the public API key cannot apply SQL migrations. Authenticated SQL/management access remains unavailable in this chat. Hosted application tables were absent at the last read-only check. Apply all three files in `supabase/migrations/` in timestamp order through authenticated Supabase tooling after inspecting the target. **Never run files in `supabase/tests/` against a hosted project.**

The migrations create private buckets, storage policies, grants/RLS, transactional business functions and Realtime publication membership when Supabase's publication exists. `marketplace_worker` is executable only by `service_role`. Providers cannot independently download or sign Storage objects: every viewing/range request goes through authorization and audit, using private/no-store responses. Privileged clients are created only in server/worker code.

Bootstrap the first admin by inserting the intended authenticated user ID into `admin_users` through privileged SQL. There is no user-facing role-escalation path. Hosted admins must enroll and verify TOTP before accessing operational data. The development admin's simulated AAL2 is restricted to the local sandbox; it does not verify the real MFA integration.

## Deployment

Vercel with a `vercel.app` address is the selected web host. No deployment or paid infrastructure was provisioned. See [DEPLOYMENT.md](DEPLOYMENT.md) for migration, worker, authentication, validation, backup and rollback gates. Live Auth/Storage/Realtime, the separate worker host, production load/accessibility checks and the real university pilot remain release prerequisites. Optional sponsor/advertising placement is deferred and does not block printing; ratings, push, integrated payments, commissions and courier integration remain out of scope as documented.

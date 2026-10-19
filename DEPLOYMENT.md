# Deployment and operations

The local marketplace is functional. This document prepares deployment; it is not evidence that any hosted deployment, restore or pilot has occurred.

Hosted work is deferred by the founder while native/on-device work continues. See MOBILE_APP_PLAN.md for the Android milestones and minimal-cloud-storage requirement. This runbook is for when connected testing resumes.

## Stage before production

1. Use the selected fresh Supabase project for development/staging. Inspect its schema and apply all three migrations in order: `202610190001_identity_and_providers.sql`, `202610190002_marketplace.sql`, then `202610190003_mobile_upload_retries.sql`. Use authenticated management/SQL access. Keep production separate. Never apply the local auth harness or synthetic seeds to hosted projects.
2. Add the public project URL/publishable key and exact Vercel app origin in environment settings. Provide a **rotated**, server-only `PRINTNOW_SUPABASE_SERVER_KEY` for object proxying and the worker. Keep it out of public variables, source files, browser bundles and logs.
3. Configure verified email/password delivery and allowed redirect URLs. Enable Google OAuth only after its consent/configuration and callback URLs are ready. Test success/failure, expiry, unsafe-return-path rejection and sign-out on the actual origin.
4. Privileged SQL provisions the first admin's `auth.users` ID in `admin_users`; then enroll/verify TOTP through the app. Confirm AAL1 fails and AAL2 succeeds. Add the actual service zone and review provider location/contact/capabilities/hours before activation.
5. Build/deploy the Next.js app to Vercel with Node 24 and the environment variables present at build time. Rebuild after public-variable changes. Production mode ignores sandbox identity/configuration. Vercel credentials/project access have not been provided in this chat, and deployment has not been attempted.
6. Deploy the separate worker using `workers/Dockerfile` (or equivalent Node 24 + Poppler host). Supply the same project URL and server-only key. Use one worker initially, with a process/container memory limit, restart policy, restricted network destinations and logs that exclude document contents and credentials. One child parses at a time with a 45-second timeout, 256 MiB JS heap, a 40-million-pixel limit and bounded source/derived sizes. Benchmark representative PDFs before changing resources/concurrency.
7. Verify a real PDF/PNG/JPEG upload reaches `ready`, preview/view permissions and HTTP range behavior, original/private object denial, losing-printer revocation, correct order snapshots and actual cleanup of stored bytes. Confirm Realtime subscriptions deliver only RLS-authorized rows and reconnect reconciles state. Local tests do not replace these hosted checks.
8. Run staging customer/two-printer/admin journeys, expired/replaced/declined offers, cancellation and dispute cases, concurrency/access tests, mobile/accessibility/load checks and operational alert tests. Fix failures before inviting real users.

Do not configure an additional VPN client or disable TLS/checksum verification to resolve connectivity. Use the platform network settings and supported proxy routes.

## Worker and retention

The worker claims durable jobs with leases and bounded attempts. Processing failures are visible to the customer and admin. Files are private until validation succeeds. Previews and sanitized print PDFs are derived from immutable originals; selected page ranges, copies, sizing and finishing remain authoritative in the immutable approved order snapshot.

The worker sweeps expired statuses and retries eligible deletion. Expiry/acceptance enforcement is in transactions and does not depend on the sweep. Deletion marks files unavailable before removing all originals/derivatives/previews, then records completion. Failed object removal remains unavailable and retries; cleanup failures are visible in operations. Active orders are protected even if a deletion timestamp is accidentally stale.

Drafts expire after 24h; closed unmatched files after 24h; completed/cancelled order files after seven days. Necessary evidence under an unresolved support case is preserved even if the review timestamp passes. Admin resolution releases that case's hold. A hold cannot recall bytes after deletion has already committed. Review open cases/holds weekly and approve a chat/transaction/audit-record retention policy before real use.

Active orders older than seven days generate review notifications; a 30-day notification requires an explicit operational decision. Do not let stale jobs retain files indefinitely: resolve, cancel or document an approved extension through support review. These notifications are not an automatic completion/deletion policy.

## Monitoring and recovery

Monitor file-job failures/lease exhaustion, deletion failures, stale orders, support queue, auth/email failures, first-offer latency, competing-provider count, accepted timing, worker memory/timeouts and database/storage costs. Keep uploaded bytes, exact addresses/phones, chat text and signed URLs out of analytics/logs. In-app notifications are durable; no guarantee of browser push/email delivery is implied.

Take database backups appropriate to the hosted plan and separately back up private Storage objects according to the approved retention policy. Database backups alone are not Storage-object backups. Before production, perform a staging restore rehearsal and prove that auth identities, RLS/grants, objects, job leases and order state reconcile correctly. No restore rehearsal has been performed here.

Deploy schema compatibly before dependent UI releases. If a web release fails, roll back the Vercel deployment while keeping additive schema intact. Pause workers before any destructive database restoration, preserve incident evidence, restore the matching database/object state, then reconcile jobs before resuming. Do not reverse migrations or delete live data as a blind rollback. Exact hosted backup/restore commands depend on the selected project/plan and must be verified on staging.

## Launch gate

Require two approved operational providers, named support ownership, confirmed service zone/hours and pickup/delivery arrangements, working verified auth/email, all critical hosted tests passing, cleanup and restore evidence, and zero enabled commissions/fees. Run real internal delivery/pickup jobs before the university pilot. The two-week/30-paid-job pilot and its learning thresholds remain in `PRD.md`.

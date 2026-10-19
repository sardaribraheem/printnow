# SPECs — Print Request Marketplace

Version: 2.0 · 18 October 2026  
Product contract: [PRD.md](PRD.md)  
Target: React Native/Expo Android + Next.js App Router + TypeScript + Supabase Auth/Postgres/Storage/Realtime
Status: implementation specification, not an implemented or tested application.

## 1. Architecture and principles

Accepted mobile amendment — 19 October 2026: `mobile/` contains native screens/navigation, device file selection and bounded Android PDF/image inspection and previews. Share portable domain rules/types; keep server credentials and Node-only code out of native bundles. The versioned bearer-token mobile API verifies Supabase identity before database-authorized operations; browser cookie/origin protections remain intact. Keep selected files local until explicit connected submission. Hosted integration is deferred; M1/M2 continue with clearly labelled local samples. See MOBILE_APP_PLAN.md for acceptance gates and storage/reliability limitations.

Use a modular monolith. Next.js provides mobile-first UI, server-rendered authenticated pages, Route Handlers and a shared server data-access layer. Supabase supplies identity, relational data, private file storage and realtime events. Background processing handles file validation/previews, notification delivery and cleanup. Do not run long PDF jobs inside a request with an unreliable time budget.

Use the currently supported stable package versions at project initialization, record exact versions in package.json and commit the lockfile. Do not assume an unverified version number from this document. Pin and test the chosen PDF parser/viewer and all auth packages.

Server rules are authoritative. Browser timers, role selectors, hidden buttons and client-calculated totals are presentation only. Store PKR money as integer paisa, time as timestamptz in UTC, and display dates in Asia/Karachi. Store user-facing enum labels separately from DB values.

### Repository shape

```text
src/app/(public)/                 intro, login, provider signup
src/app/(customer)/               home, requests, offers, history
src/app/(printer)/                application, feed, quotes, jobs
src/app/(shared)/orders/[id]/      summary, chat, support
src/app/admin/                    moderation and operations
src/app/api/                      typed route handlers
src/lib/auth/                    server/browser Supabase clients
src/lib/dal/                     authorization and safe projections
src/lib/domain/                  validation, print counts, transitions
src/components/                  shared UI and forms
mobile/                          React Native/Expo Android client and local PDF module
supabase/migrations/              schema, RLS, functions, constraints
supabase/tests/                   SQL authorization/concurrency tests
workers/                         PDF checks, notifications, cleanup
```

## 2. Authentication and onboarding

Use Supabase Auth with Google OAuth and verified email/password as pilot defaults. Use the official SSR client pattern with cookie-backed server/browser clients. Validate server identity using getClaims() or an appropriate fresh getUser() check; never authorize from unverified getSession() cookie data alone. Do not cache authenticated responses across users. Follow current Next.js/Supabase guidance for session refresh and Proxy integration. [T1, T2]

Protect every mutation and read by identity plus database authorization, not only route redirects. Check live account/provider restriction status on sensitive actions; a stale JWT role must not keep a suspended provider active. Require stronger authentication for admins.

Onboarding order: intro → default address or pickup area → auth → persist profile/setup → home. Hold pre-auth form data in tab-scoped temporary state only, with an explicit clear on abandonment/logout; never put address in OAuth query parameters. Allow a safe auth return path from a server allowlist. Auth callback must not allow an open redirect.

Model customer access and provider membership independently; one user can use both modes. Admin grants are stored in an admin-controlled table. Do not trust user-editable auth metadata for elevated roles. One provider and one owner per provider suffice for MVP; a membership table leaves room for staff later.

## 3. Data model

All primary keys UUID unless noted. Add created_at and relevant updated_at fields. Every exposed table has RLS. Defaults and derived fields are assigned server-side.

| Table | Main fields / constraints |
|---|---|
| profiles | user_id FK auth.users PK, display_name, contact_phone, phone_verified_at nullable, account_status |
| customer_addresses | id, owner_id, label, recipient_name, phone, full_address, landmark, lat/lng, is_default; owner-only |
| provider_public_profiles | id, display_name, business_type, public_pickup_address, pickup_lat/lng, rating aggregates from real reviews |
| provider_private_profiles | provider_id PK, responsible_contact, verification_notes, application_state, delivery/pickup flags, hours, zone_id |
| provider_members | provider_id, user_id, membership_role; unique pair; admin-controlled additions |
| provider_capabilities | provider_id, size/color/stock/duplex/finishing supported; normalized catalog references |
| admin_users | user_id PK; writes only by privileged admin provisioning |
| service_zones | id, name, bounds/geometry, active; pilot area definition |
| print_requests | id, customer_id, state, current_revision_id, urgency, fulfillment_mode, zone_id, coarse_area_label, published_at, expires_at, matched_order_id nullable |
| request_private_destinations | request_id, revision_id, exact address/phone/lat/lng snapshot; never part of provider feed projection |
| request_revisions | id, request_id, revision_no, immutable configuration/instructions, total_sides, latest_needed_at; unique request/revision_no |
| request_files | id, request_id, owner_id, object_key, checksum, media_type, byte_count, page_count, processing_state, delete_after, deleted_at |
| revision_items | revision_id, file_id, position, selected_pages, copies, stock_id, size, color, sides, duplex_edge, scaling, finishing |
| offers | id, request_id, revision_id, provider_id, status, print_paisa, delivery_paisa, total_paisa generated, duration_minutes, payment_method, note, created_at, expires_at |
| orders | id, request_id UNIQUE, accepted_offer_id UNIQUE, customer_id, provider_id, status, accepted_at, due_at, immutable_spec_snapshot, price_snapshot, commission_bps_snapshot=0, row_version |
| order_contact_snapshots | order_id UNIQUE, destination or pickup snapshot, necessary contacts; accepted participants only |
| order_payment_reports | order_id, actor_id, actor_role, assertion, method, reported_at; server validates role |
| order_events | id, order_id, actor_id, event_type, safe_payload, created_at; append-only |
| conversations | id, order_id UNIQUE |
| messages | id, conversation_id, sender_id, client_message_id, body, created_at; unique(sender_id, client_message_id) |
| conversation_reads | conversation_id, user_id, last_read_at; unique pair |
| support_cases | id, order_id nullable, reporter_id, category, status, assigned_admin, resolution |
| document_access_events | actor_id, provider_id nullable, file_id, purpose, timestamp; immutable audit |
| notifications | id, recipient_id, type, safe_payload, read_at |
| outbox_events | id, kind, aggregate_id, dedupe_key UNIQUE, state, attempts, next_attempt_at |
| file_jobs | file_id, job_kind, status, attempts, locked_until; bounded retries |
| file_retention_holds | file_id, case_id, reason, expires_at, approved_by |
| restrictions | target_user/provider, reason, scope, effective_at, expires_at, admin_actor |
| feature_flags | key, value, updated_by; server-controlled |
| sponsor_slots | id, placement, image/text/link, active_window, active; no private targeting |

Do not put private fields and feed-visible fields in one readable row and rely on UI column filtering. Row-level security controls rows, not which returned fields a careless API selects. Separate tables/projections enforce the intended boundary.

### Constraints and indexes

- Amounts >= 0, printing amount > 0; total generated from print + delivery.
- Pickup offers must have delivery_paisa = 0 and match the request fulfillment mode, enforced in offer RPC.
- duration_minutes > 0; expires_at = created_at + interval '5 minutes', assigned in RPC.
- One active offer row per provider/request via partial unique index WHERE status='active'. Expired rows are transitioned before replacement; acceptance also checks time regardless of row status.
- Unique orders(request_id) and orders(accepted_offer_id); one accepted offer per request via partial index.
- Unique messages(sender_id, client_message_id) prevents duplicate retry messages.
- Index requests(zone_id, state, expires_at), offers(request_id,status,expires_at), orders(customer_id,created_at), orders(provider_id,status), messages(conversation_id,created_at,id), files(delete_after), notifications(recipient_id,read_at).
- Prevent acceptance of own provider offer through the customer role.

## 4. Request and offer lifecycle

### Request states

`draft → processing → open → matched`

Alternative terminal states: `cancelled`, `expired`. Validation failures return editable draft with errors. Editing an open request atomically withdraws active offers, removes it from feed, creates a new immutable revision, and returns to draft; reposting publishes the new revision. Preserve files if unchanged and validated. One order maximum per request. After matched-order cancellation, **Create a new request** clones settings into a new request ID, never reopens the old one.

Urgent request lifetime 30 minutes; Standard 120 minutes. Cap by latest_needed_at if supplied. Publishing requires more than five minutes of remaining request life. New offers require at least five minutes remaining. No automatic request extension.

### Offer states

`active → accepted | declined | withdrawn | expired | not_selected | invalidated`

Five minutes begins at database creation. At the exact expiry timestamp, an offer is invalid. Customer decline affects only that offer. Replacement withdraws the old row and inserts a new row with a new ID/timer. Notify customer of replacement; never mutate the card they are already accepting.

Offer expiration is enforced in transactions, not by a scheduled job. A sweeper only materializes expired status for housekeeping. Return server_now with offer reads and compute display countdown from offset-adjusted server time; refresh after tab resume/network reconnect.

### Order states and allowed actors

| From | To | Actor / condition |
|---|---|---|
| confirmed | printing | Assigned active printer; no cancellation already committed |
| confirmed | cancelled | Customer or assigned printer with reason |
| printing | ready | Assigned printer |
| ready | out_for_delivery | Assigned printer, delivery only |
| out_for_delivery | handover_reported | Assigned printer, delivery only |
| ready | handover_reported | Assigned printer, pickup only |
| handover_reported | completed | Customer confirms or admin verifies evidence |
| active state | disputed | Participant reports material issue; preserve last fulfillment stage |
| disputed | prior active/completed/cancelled | Admin resolution with audit reason |

Implementation can model `fulfillment_status` and `issue_status` separately to avoid losing the prior stage. Customer confirmation can complete a genuinely received order even when the printer missed an intermediate status, with an audit event. No automatic completion merely after a timer. Overdue jobs go to support.

## 5. Atomic operations — the critical implementation contract

Implement core multi-row writes as transactional Postgres functions/RPCs. Browser performs no direct state or price mutations. Revoke table write grants and function execution from roles that do not need them. A SECURITY DEFINER function must use a safe fixed search_path, schema-qualified objects, explicit auth.uid() and permission checks, and tightly scoped execution grants. SECURITY INVOKER is preferred where practical. [T3, T6]

Use the same lock order for every operation: relevant provider row(s), request row, then offer/order row(s). For operations with multiple providers, lock in UUID order. Suspension takes the provider lock. All create/replace/accept/cancel paths must follow the lock discipline to prevent deadlocks and restriction races.

### publish_request(request_id, expected_revision)

Authenticate owner; lock request; confirm expected revision; validate all file processing states, counts, supported settings, area, consent and timing. Snapshot private address and publish. Insert a metadata-only outbox event. Repeated call on same published revision returns existing request; different body/state conflicts.

### create_offer(request_id, revision_id, print_paisa, delivery_paisa, duration_minutes, payment_method, note)

Authenticate provider membership; lock/check provider active and eligible; lock request; check open, current revision, matching capabilities/mode and at least five minutes remaining. Validate requested latest-needed time against duration at current time. Expire/withdraw old offer from this provider; insert new offer with server timestamps, computed total and fixed five-minute TTL. Store idempotency key plus payload hash to avoid accidental duplicate replacement.

### accept_offer(offer_id, expected_revision, idempotency_key)

Transactional pseudocode, not deploy-ready SQL:

```text
verify authenticated customer; resolve immutable offer provider/request IDs
lock provider, then request, then offer
set decision_now = clock_timestamp() AFTER locks are acquired
if idempotent acceptance already exists for this customer + offer: return order
assert provider is eligible/active; customer owns request
assert request=open; current revision matches; request expiry > decision_now
assert offer=active; offer expiry > decision_now; offer revision matches
assert customer is not a member of this provider
assert decision_now + offer duration <= latest_needed_at, if set
insert order with unique request_id and immutable approved snapshot
  accepted_at=decision_now; due_at=decision_now + duration
  commission_bps_snapshot=0; platform_fee_paisa=0
mark offer accepted and request matched
mark other active offers not_selected
create conversation, contact snapshot, system event and notification outbox
commit; return order
```

Evaluate expiry after waiting for locks, not at transaction start: an offer valid when a request began may expire while blocked. The successful guarded write is the acceptance decision point. Unique constraints and locking mean simultaneous accepts in two tabs create one order. Losing calls return REQUEST_ALREADY_MATCHED, never a second accepted printer. Retrying the same accepted offer returns the original order, even if its five-minute timer has since elapsed.

### cancel_order / start_printing

Lock request/order in the defined order, authenticate actor and compare row_version. Both compete for the same state transition. If cancel wins, printing fails; if printing wins, cancellation returns CANCELLATION_REQUIRES_SUPPORT. A notification race cannot override database state.

## 6. Upload processing and controlled document access

Private buckets: `print-originals` and `print-previews`. Object keys: `{owner_uuid}/{request_uuid}/{file_uuid}.pdf`; generated IDs, never original filenames. Keep original filename only as user-visible metadata. No public bucket, upsert or overwrite for immutable file versions.

1. Authenticated owner requests upload authorization for draft request.
2. Server checks quota/ownership and inserts pending file metadata.
3. Upload directly to private Storage using scoped authorization. Use resumable upload for larger files; Supabase recommends it above 6 MB for reliability. [T8]
4. Finalize endpoint confirms object ownership and queues validation; never trust client MIME/count/checksum.
5. Bounded isolated worker validates signature, byte size, parser success, encryption, page count and scan policy. Reject encrypted/corrupt/unprocessable files. Disable embedded scripts and external-resource fetching in viewer/processing.
6. Produce controlled previews and page metadata; mark ready only after required checks. Cap CPU, memory, page count and job duration against malicious/oversized inputs.
7. User reviews settings/preview and posts explicitly.

Provider review route `/api/files/:id/view` checks current eligibility and logs access. Use an authenticated server proxy with `Cache-Control: private, no-store` for pre-accept review; verify each document/range request. Storage should not grant unassigned providers direct SELECT access, which could let them issue independent longer-lived URLs. Server privileged credentials stay server-only and are used only after explicit per-file authorization. [T4]

Owner and accepted winner download through similarly authorized routes; a short-lived URL is permissible for the winner with a documented residual access window. Prefer the proxy for consistency. Never return object keys/URLs in feed events or analytics. On matching/cancellation/expiry, future review requests from losing providers are denied immediately. Already loaded bytes cannot be recalled.

File page counts: selected pages deduplicated and sorted; reject invalid ranges. Each file/copy starts on a fresh sheet. sides=sum(selected_pages × copies); duplex sheets=sum(ceil(selected_pages/2) × copies). Store settings per revision item and compute totals server-side.

## 7. RLS and authorization matrix

| Resource | Customer | Eligible active printer before match | Accepted printer | Admin |
|---|---|---|---|---|
| Own draft/files | Own only | Denied | Denied unless owner | Case-based audited access |
| Open request safe summary | Own | Eligible zone/capabilities | Same eligibility | Read |
| Pre-accept file review | Own | Authorized proxy only | If eligible before match | Audited |
| Exact destination/phone | Own | Denied | Assigned order only | Case-based |
| Offers | All on own request | Own offers only | Own accepted offer | Read |
| Orders/chat | Participant only | Denied | Participant only | Case-based |
| Provider approval/restrictions | Read own application where relevant | Cannot edit approval | Cannot edit approval | Authorized mutation |
| Commission flags | No write | No write | No write | Controlled future rollout |

Enforce ownership through auth.uid(), not a user ID supplied by the browser. Feed is a narrow server-authorized projection; underlying exact-location tables have no printer access before acceptance. Protect against ID enumeration through routes, RPCs, Storage and Realtime. Keep published customer identifiers pseudonymous in feeds.

Supabase RLS is required on exposed tables. Service-role/secret keys bypass protections and must never enter NEXT_PUBLIC variables or client bundles. A server proxy using privileged access must reimplement the relevant checks explicitly; do not assume the key preserves RLS. [T3, T4]

## 8. API contracts

All mutations use schema validation, authenticated sessions, same-origin/CSRF defenses as appropriate, rate limits, request IDs and structured error responses. Domain functions serve both Route Handlers and any Server Actions; avoid duplicated rules.

| Method / route | Input | Result |
|---|---|---|
| POST /api/onboarding/customer | setup fields | own profile/default location |
| POST /api/providers/apply | provider application | pending provider |
| POST /api/requests | initial draft | request ID/revision |
| POST /api/requests/:id/uploads | filename,size | scoped upload authorization/file ID |
| POST /api/files/:id/finalize | upload completion | processing state |
| GET /api/files/:id/view | auth + file ID | authorized bytes/preview |
| PATCH /api/requests/:id | expected revision + settings | new draft revision; invalidated offers |
| POST /api/requests/:id/publish | revision + consent version | open request + expiry |
| GET /api/printer/feed | cursor + supported filters | safe eligible request summaries |
| POST /api/requests/:id/offers | structured amounts/timing | offer + expires_at + server_now |
| GET /api/requests/:id/offers | owner auth | own-request offers + server_now |
| POST /api/offers/:id/decline | expected state | declined |
| POST /api/offers/:id/withdraw | provider auth | withdrawn |
| POST /api/offers/:id/accept | revision + idempotency key | exactly one order |
| POST /api/requests/:id/cancel | expected revision | closed request |
| POST /api/orders/:id/transition | action + row_version | authorized new state |
| POST /api/orders/:id/messages | client_message_id + text | persisted message |
| POST /api/orders/:id/payment-report | assertion + method | report, not bank verification |
| POST /api/orders/:id/issues | category + description | support case |
| POST /api/admin/providers/:id/review | decision + reason | audited approval/restriction |

Error codes: AUTH_REQUIRED, FORBIDDEN, PROVIDER_PENDING, PROVIDER_RESTRICTED, FILE_NOT_READY, UNSUPPORTED_FILE, LIMIT_EXCEEDED, REVISION_CHANGED, REQUEST_CLOSED, REQUEST_ALREADY_MATCHED, OFFER_EXPIRED, OFFER_WITHDRAWN, OFFER_WINDOW_TOO_SHORT, DEADLINE_UNACHIEVABLE, CANCELLATION_REQUIRES_SUPPORT, RATE_LIMITED and RETRYABLE_FAILURE. Return useful user text without leaking other users’ data.

## 9. Chat, notifications and realtime

Persist messages to Postgres; do not treat websocket delivery as durable storage. Plain text only, max 2,000 characters, escaped rendering, cursor pagination and unique retry IDs. Mark order events distinctly from user messages. MVP does not support chat attachments, so changed production files must use a new request.

Use RLS-filtered Postgres Changes for recipient notifications and participant messages. Subscriptions follow table permissions. Avoid broadcasting private request/offer rows to a shared zone topic. Feed can poll every 10–15 seconds in pilot; notify approved providers using safe metadata only. Reconnect fetches current state and unread events.

If Broadcast/Presence is introduced, use private channels and explicit realtime.messages policies; these differ from table RLS. Do not assume a private channel name alone authorizes its data. [T5]

Outbox worker retries notification sends after commit. In-app notifications are P0; email can assist. Browser push is P1 and cannot be assumed available when the app is closed. Staff pilot providers during test hours so five-minute offers have a realistic audience. Notification delays never extend an offer.

## 10. Jobs, retention and observability

Use Supabase Cron or an authenticated scheduler to enqueue bounded tasks; PDF scanning/rendering can run in a separate container worker. Pick worker hosting after testing file workloads and execution limits. Cron is housekeeping, not the security/expiry enforcement boundary. [T7]

Jobs: expire request/offer status; retry file processing; purge stale uploads; delete eligible originals/previews via Storage API; process notification outbox; flag overdue/stale orders; review retention holds.

Retention uses the PRD durations. On purge, first mark access unavailable, then delete all corresponding objects and mark deleted after success. Retry partial failure and alert admin. Do not delete storage metadata directly in SQL and assume object bytes disappear. Prevent workers deleting active-order files through a final DB eligibility check/lock. Deletion and acceptance must coordinate on the request; closed unmatched requests cannot be accepted.

Record request/offer creation, expiry, decline, acceptance, print start, ready, handover, completion, issue and file-access events. Analytics contains IDs and safe aggregates only; no PDF contents, private instructions, phone, address, chat body or signed URLs. Operational metrics include first-offer latency, competing-provider count, acceptance rate, on-time rate, scan failures, deletion backlog and websocket failures.

## 11. Launch monetization implementation

Server flags:

```json
{
  "commission_enabled": false,
  "commission_rate_bps": 0,
  "platform_order_fee_paisa": 0,
  "sponsor_slots_enabled": false
}
```

Sponsor slots may be enabled when an advertiser exists; never require ads for the print flow. Use first-party assets, validated links and labeled placements. Do not mount third-party ad scripts on authenticated document/chat/address/order pages. Empty slots collapse.

Every MVP order snapshots 0% and zero fee. No commission ledger, overdue job or commission restriction is active in MVP. Keep future billing behind a separately tested migration/feature rollout, not a hidden UI-only toggle.

Future schema: commission_policies, commission_entries, provider_statements, settlement_reports and verified_settlements. Snapshot policy/base/rate per new accepted order; proposed base excludes delivery. Recognize debt only under the adopted completion/payment policy, reverse on qualifying refunds, and freeze disputed balances. Manual payment reports require verification before settling. Grace period and suspension rules remain unactivated until defined with the founder. Never recompute old zero-rate orders using a new global percentage.

## 12. Security and functional acceptance tests

Tests must exercise real DB/RLS boundaries, not only mocked UI logic.

| ID | Test / expected result |
|---|---|
| A01 | Address/pickup setup survives auth; denied location permission allows manual setup. |
| A02 | Customer cannot self-grant printer approval/admin through profiles or metadata. |
| F01 | Draft files inaccessible to other customers and all providers. |
| F02 | Eligible approved provider can review live files; ineligible/pending/suspended provider cannot. |
| F03 | Exact address absent from feed, direct DB reads, network payloads and realtime events. |
| F04 | Losing provider’s next range/view request denied after acceptance; no direct Storage bypass. |
| F05 | Corrupt, encrypted, oversize and parser-timeout files never become publishable. |
| F06 | Five-page PDF × two duplex copies yields 10 sides / 6 sheets. |
| O01 | Rs. 200 + Rs. 150 displays Rs. 350; pickup rejects nonzero delivery. |
| O02 | Offer has exactly five-minute TTL from server creation, independent of client clock. |
| O03 | Acceptance at/after expiry rejected even if sweeper has not run. |
| O04 | Acceptance waiting on a lock rechecks real time after lock acquisition. |
| O05 | Concurrent acceptance of two offers yields one order/winner. |
| O06 | Retry same acceptance returns same order; no duplicate conversation/notification. |
| O07 | Changed request revision invalidates offers and blocks stale acceptance. |
| O08 | Withdraw/accept and suspend/accept races yield one consistent outcome. |
| O09 | Offers arriving with <5 minutes request life rejected; no hidden shortened TTL. |
| O10 | Customer cannot accept their own provider offer. |
| C01 | Only accepted participants can read/write chat; duplicate sends collapse. |
| C02 | Chat text cannot change price, files or order specifications. |
| C03 | Cancel versus start-printing race has exactly one valid transition. |
| P01 | Printer payment claim does not show independently verified payment. |
| P02 | Pickup completes without dispatch; delivery cannot silently become pickup. |
| M01 | Pilot orders always have zero fees/commission; no overdue commission restriction. |
| M02 | New commission policy never creates a charge on historical zero-rate orders. |
| R01 | File cleanup removes objects/previews; failures retry; active/held files preserved. |
| R02 | Reconnect reconciles offer/message state without trusting stale cached data. |

Also run mobile end-to-end tests: one delivery, one pickup, two competing providers, all offers declined, all expired, provider cancellation, bad print dispute and temporary network loss. Use non-sensitive fixture PDFs for concurrency/access tests.

## 13. Build sequence and release checklist

1. Schema, migrations, auth, roles and manual provider approval; establish RLS tests first.
2. Customer/provider onboarding, default location and editable capabilities.
3. Private uploads, worker validation, preview and print-count calculator.
4. Publish/request feed, consent and controlled pre-bid file viewing.
5. Offer composer/list, expiry, atomic acceptance and idempotency.
6. Order summary, chat, production/pickup/delivery transitions and payment reports.
7. Support/admin restrictions, retention workers and notifications.
8. Run acceptance tests and real sample jobs; fix failures before university invitations.

Separate local, staging and production Supabase projects/environments. Keep seed data synthetic. Track all schema/RLS/function changes in migrations. Deploy database changes compatibly before dependent UI changes. Smoke-test customer/printer/admin identities after deployment. Maintain rollback instructions, transaction backups and a restore rehearsal. Verify secrets absent from browser bundles/logs and that private files cannot be indexed or cached publicly.

Release requires: two approved operational providers; named support owner; functioning authentication email/OAuth setup; valid service zone and hours; all critical tests passing; file-cleanup job verified; and no enabled commissions. Hosting vendor, SMTP provider, domain, PDF worker deployment and exact dependencies are implementation selections, not assumed existing services.

## 14. Technical sources

Official documentation consulted 18 October 2026. Domain rules above are proposed application design, not claims that these vendors implement the marketplace automatically.

- T1: [Next.js authentication and authorization](https://nextjs.org/docs/app/guides/authentication)
- T2: [Supabase SSR clients for Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs)
- T3: [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- T4: [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control)
- T5: [Supabase Realtime authorization](https://supabase.com/docs/guides/realtime/authorization)
- T6: [Supabase database functions](https://supabase.com/docs/guides/database/functions)
- T7: [Supabase Cron](https://supabase.com/docs/guides/cron)
- T8: [Supabase upload guidance](https://supabase.com/docs/guides/storage/uploads/standard-uploads)

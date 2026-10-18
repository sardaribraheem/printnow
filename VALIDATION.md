# Validation evidence

The following checks ran in this cloud workspace against the implemented local application. They do not establish a hosted Supabase/Vercel deployment or a production release.

| Check                                          | Observed result                                                                                                                                                    |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Lint and generated-route TypeScript validation | Passed                                                                                                                                                             |
| Unit/domain/auth/file-worker tests             | 31 passed; none skipped                                                                                                                                            |
| Production Next.js build                       | Passed                                                                                                                                                             |
| Fresh PostgreSQL authorization suite           | Passed, including 22 initial identity/provider assertions and the marketplace/privacy/retention/history suites                                                     |
| Real concurrent PostgreSQL sessions            | One winning acceptance; idempotent retry; expiry after lock wait; one cancel/start-printing winner; consistent withdraw/accept race                                |
| Unconfigured production browser tests          | 14 passed across desktop/mobile, including rejection of sandbox cookies/endpoints in production                                                                    |
| Mobile marketplace browser tests               | 5 passed: complete PDF pickup, complete PNG/JPEG delivery, sandbox/origin guard, private onboarding restoration, and dispute-held physical file retention/deletion |
| Production dependency audit                    | Zero reported vulnerabilities at the time checked                                                                                                                  |
| Product documents                              | PRD.md and SPECs.md preserved; accepted scope changes recorded in the production plan                                                                              |

The full pickup/delivery tests upload actual fixture bytes, wait for background validation, collect offers from two independent printer accounts, accept an offer, verify losing-printer HTTP range access is denied, persist chat, advance fulfillment, record payment reports, confirm completion and reload the order. The PDF fixture verifies five pages × two duplex copies = ten printed sides and six physical sheets. Payment assertions are not bank verification.

The retention browser test verifies an unresolved support hold preserves real object bytes, admin evidence access requires an explicit case, resolution releases the hold, and originals, derived PDFs and preview images are physically removed. Database tests separately protect active orders and unresolved expired review holds.

Tests use synthetic local accounts/data. A local PostgreSQL auth harness models the Supabase roles/claims; hosted Auth/PostgREST/Storage/Realtime/MFA still require staging validation. The auth return in the onboarding test is simulated through the development-only sample identity; no real signup/login or email/OAuth delivery was tested.

Use the commands in README.md to reproduce. CI configuration exists, but a GitHub Actions run, Vercel deployment, hosted migration, hosted load/accessibility review, backup restore and real university pilot have not been observed or performed in this task. Generated screenshots/traces are under ignored test-results/.

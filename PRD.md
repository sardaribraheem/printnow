# PRD — Print Request Marketplace

Version: 2.0 · 18 October 2026  
Owner: Muhammad Ibraheem Anwar  
Initial market: NIIT university community and nearby Lahore printing providers  
Implementation companion: [SPECs.md](SPECs.md)

## 1. Product decision

Build a mobile-first marketplace where customers publish print requests and nearby printing providers submit competing, time-limited offers. Customers select the provider; the platform does not impose print prices or assign the cheapest printer automatically.

A customer uploads documents, keeps default settings or customizes them, selects delivery or pickup, marks the request Urgent or Standard, and taps **Post request**. Eligible printers review the documents and requirements and send offers. Each offer lasts five minutes. Accepting one locks the job to that printer and opens order chat. The printer produces the documents and either arranges delivery or prepares shop pickup.

Example: Printer A offers Rs. 200 printing + Rs. 150 delivery = **Rs. 350 total**. Printer B offers Rs. 200 + Rs. 140 = **Rs. 340 total**. The customer may accept either based on price, timing, location and reputation. The customer is not obliged to accept the lowest offer.

This document supersedes the operating model in the 16 October PRD. The older PDF/DOCX remain historical reference documents. This Markdown pair is the implementation source of truth.

### Explicit changes from version 1

| Earlier proposal | Version 2 decision |
|---|---|
| Managed allocation and standardized rates | Multiple competing printer offers; customer chooses |
| Files released only to assigned printer | Eligible approved printers can review files before bidding |
| Commission/service fee at launch | Zero platform commission and zero platform order fee at launch |
| Dispatcher-led delivery | Accepted printer owns delivery arrangements |
| Prepayment-oriented checkout | Direct customer-to-printer payment; no platform checkout in MVP |
| Pilot before main software | Build the scoped MVP, run test jobs, then pilot at university |

## 2. Decisions and working defaults

The founder’s explicit requirements are binding. The following defaults make implementation possible and can be changed before coding their related features.

| Topic | Decision / default | Status |
|---|---|---|
| Stack | Next.js and Supabase | Founder requirement |
| Offers | Five minutes from server creation; multiple printers | Founder requirement |
| Files | Temporarily stored in private cloud storage | Founder requirement |
| File visibility | Eligible approved printers may review while request is live | Founder requirement, with consent and access controls |
| Fulfillment | Delivery or pickup selected per request | Founder requirement |
| Urgency | Standard or Urgent; provider supplies actual timing | Founder requirement |
| Accounts | Customer onboarding and distinct Printer Account signup | Founder requirement |
| Money | Customer pays printer directly; launch commission 0% | Founder requirement / direct-payment assumption |
| Auth | Google login plus email/password; contact phone separately | Working default |
| Printer eligibility | Shops and home-based providers may apply; manual pilot approval | Working default |
| Chat | Customer and winning printer only, after acceptance | Working default |
| File formats | PDF only in MVP; reject unsupported formats with export guidance | Working default |
| Retention | Drafts 24h; unsuccessful requests 24h after closing; completed orders 7 days | Working default |
| Request lifetime | Urgent 30 minutes; Standard 2 hours, capped by latest-needed time | Working default; distinct from offer lifetime |
| Future commission | 10% on print subtotal, excluding delivery | Proposed basis; founder must confirm before enabling |

## 3. Goals and non-goals

### Goals

- Make it easy to post an accurate print request from a phone.
- Let providers compete on complete price and fulfillment time.
- Make offer expiry and acceptance unambiguous.
- Support a real delivery or pickup job through completion.
- Let customer and printer coordinate without losing the approved requirements.
- Validate university demand and printer participation with paid printing orders.

### Not in MVP

Platform payment processing, escrow, automatic commission deductions, courier API integration, rider accounts, live rider GPS, native mobile apps, automated printer hardware control, public document URLs, office-file conversion, custom merchandise, automated refund payouts, or nationwide dispatch.

An order can be paid even though the platform earns nothing. The printer receives printing/delivery revenue; the app charges no order fee.

## 4. Users and onboarding

### Customer

1. See three short, skippable slides: upload; compare offers; receive or collect.
2. Answer **Where should we deliver your prints?** Enter home/default address, recipient phone, landmark and location pin. Allow manual entry when location permission is denied.
3. Provide a **I’ll use shop pickup** option so pickup users need not supply a home address. They still choose their search area/campus.
4. Sign up or log in. Preserve the unsubmitted address during auth without putting it in URLs or analytics; persist it only to that authenticated account.
5. Land on the customer home screen with **New print request**.

Collect name, authenticated identity and reachable phone. Do not present an unverified contact phone as verified. Store multiple addresses later; one editable default is enough initially. Changing the default must not change an already posted request or existing order.

### Printing provider

A visible **Printer Account — Receive print jobs** entry starts provider onboarding. A single identity can have customer access and an approved printer profile, with a mode switch; no duplicate login is necessary.

Collect provider/display name, responsible person, shop or home-based business type, production/pickup address, contact phone, service zone, operating hours, supported sizes/color/paper/finishing, pickup availability and delivery availability. Explain that the pickup address will be shown to potential pickup customers. A home-based provider must knowingly agree before making a residential pickup location visible.

Provider states: pending review, active, restricted, suspended or rejected. Pending providers see their application status but cannot browse customer documents, quote or chat. Admin approves pilot providers after a contact and sample-print check. A user cannot promote themselves to approved printer or admin.

## 5. Customer request creation

### Default settings

PDF; A4; black-and-white; single-sided; one copy; all pages; fit to printable area; standard white paper; no finishing. Show actual GSM choices only when supported in the pilot catalog. Do not claim a weight that providers cannot supply.

Customization: color/B&W per file, A4/A3, paper stock from configured catalog, copies, single/double-sided, duplex edge, all pages or page ranges, fit/actual size, loose/stapled, and short instructions. Selected color-page ranges, booklet layouts and unusual stock are deferred.

Limits: 3 PDFs, 25 MiB each, 75 MiB combined, and 200 printed sides per request as configurable pilot limits. Count pages server-side. Show logical pages, printed sides and physical sheets separately. Five pages × two duplex copies = 10 printed sides and 6 sheets, because each copy starts on a new sheet.

### Fulfillment and urgency

Choose Delivery or Pickup before posting. Delivery uses a snapshot of the default address, editable for this request. Pickup uses a search area and maximum travel radius; customer compares each provider’s collection location.

Urgent means the customer needs faster fulfillment, not a platform guarantee. Allow a latest-needed time. Offers must specify a maximum completion duration from acceptance: delivered within X minutes or ready for pickup within X minutes. Standard also requires a time commitment. No platform-wide 15/30-minute promise.

### Posting

Show final review, file-sharing notice and **Post request**. Suggested notice:

> Posting lets approved printing providers in your selected area review these files to prepare offers. Your exact delivery address and phone are shared only with the provider you accept. Uploaded documents may themselves contain personal information.

Posting is explicit consent, not implied by upload. Draft files are visible only to their owner. A live request is visible in an authenticated provider feed, not on a public website. Public metadata includes job requirements and coarse destination area, never precise coordinates, customer phone or home address. Providers can request clarification through a structured “Needs clarification” signal; customer edits/reposts rather than opening multi-provider chat in MVP.

## 6. Printer feed, document review and offers

An active provider sees open requests in their approved pilot zone matching their capabilities. Feed cards show urgency, remaining request lifetime, delivery/pickup, coarse area, document/page summary, settings and deadline. Providers may open an authorized viewer for full file review. Log document access; do not expose bulk document downloads or public links.

The platform cannot prevent screenshots or copies of documents already viewed. Disclose that limitation and require providers to use files only for quotation/fulfillment and delete their copies. Revoking app access cannot remotely erase downloaded files.

### Offer requirements

Each offer contains printing amount, delivery amount, total, fulfillment mode, completion duration, payment method, provider identity, pickup location when applicable, and optional short note. Finishing and packaging must be included in printing subtotal and explained in the note. No surprise add-ons after acceptance.

- Pickup delivery amount must equal zero.
- Total = printing amount + delivery amount.
- Cash at pickup/receipt is the default payment method; direct transfer may be selected by the printer and shown before acceptance.
- MVP transfers are due at handover, not deposits. Advance-payment support is deferred.
- An offer is bound to an immutable request revision.
- Five-minute expiry begins at creation, not when a notification is opened.
- Offers may be withdrawn before acceptance. Replacing an offer withdraws the previous one and starts a new five-minute clock.
- One active offer per printer per request. Apply posting limits against spam.
- Providers see their own bids, not competitor identities/prices.

A request with fewer than five minutes remaining does not accept new offers. Its owner can extend/repost explicitly; existing offers are invalidated by reposting. The UI must explain this rather than issue offers with secretly shortened lifetimes.

## 7. Compare, accept or decline

Offer cards lead with **Rs. 350 total**, followed by the print/delivery breakdown, timing, payment method, printer name, pickup location if relevant, and a live expiry countdown. Show rating only from genuine completed orders; use **New provider** otherwise.

Default sort is newest first. Customer can choose lowest total or fastest completion. Sponsored placement never changes the organic offer order or disguises a bid as the best option.

Decline dismisses that offer; other offers and the request remain live. On accept, show a final confirmation sheet with price, fulfillment method, payment method and completion commitment. Server acceptance must succeed before the app shows success.

Acceptance creates exactly one order, marks the request matched, accepts one offer, closes other offers as not selected, and prevents further bidding. Losing providers lose document access. The winner gains production-file access and, for delivery, exact address and necessary contact data. The customer and winner gain an order chat.

Accepting is a commitment to the job, not a platform card charge. The printer must not print merely because it submitted an offer. If the customer tries to accept an expired offer, show **This offer expired. Ask for a new offer**. Never silently renew it or select another offer.

## 8. Order, chat and fulfillment

Order statuses: Confirmed → Printing → Ready → Out for delivery → Delivered for delivery; Confirmed → Printing → Ready → Collected for pickup. Printer can mark handover reported, but completion requires customer confirmation or admin-reviewed evidence. Keep collection of money separate from physical fulfillment.

Order chat supports plain text, system events, timestamps and unread indicators. It opens after acceptance and remains accessible for support after completion. Do not allow replacement files through chat attachments in MVP. A message such as “change to color” does not change the approved order or authorize a new charge.

Before printing, material changes require a mutual cancellation and a new request/offer. The printer and customer can clarify a landmark or an existing instruction without changing price/output. After printing begins, reprints or added work require a separate request. Keep a visible approved-job summary above chat.

The printer handles delivery personally or through a legitimate courier arrangement and includes the full expected cost in its bid. The app records manual dispatch notes and optional external tracking URL. No courier has access to PDFs. For pickup, show shop address, hours, ready status and pickup reference. Gate/reception delivery must be clear in the offer if doorstep access is unavailable.

## 9. Payment, cancellations and issues

No platform wallet, checkout, payment guarantee or automatic refunds in MVP. Record payment method agreed at acceptance and separate assertions: printer says received; customer says paid. Display **Payment disputed** when assertions conflict. A bank-transfer screenshot or a printer click is not independent payment verification.

Customer can cancel unaccepted requests freely. For accepted orders, allow customer cancellation until the printer atomically marks Printing; notify the printer immediately. Printers can cancel with a reason before production, with repeated cancellations triggering review. After production starts, cancellation becomes a support request; no hidden fees or automatic penalties.

Wrong output, damaged delivery, missed deadline and nonpayment can be reported from the order. Admin logs evidence, decision and resolution. Printer-issued refunds/reprints are tracked as agreed/reported/confirmed, not executed by the app. Do not promise platform-funded refunds without a funded policy.

If a provider is suspended while jobs are active, block new feed/file access and bids, but preserve necessary existing-order/support access under admin supervision. An account restriction must not trap customers mid-order.

## 10. Monetization

### Launch

Commission rate is **0%**; platform order fee is **Rs. 0**. No commission debts, overdue reminders or commission-based suspensions can be generated for pilot orders. Ads are the only intended launch revenue channel, but earnings are not assumed and an empty ad slot must not block launch.

Use optional clearly labeled local sponsor placements on home/help/completion surfaces. Keep ads out of PDF viewers, file uploads, chat, address forms and acceptance controls. No document/address/chat data may be sent to ad networks. Prefer first-party sponsor cards in the pilot; integrating a third-party ad network is a separate approval/configuration task.

### Later: printer-paid commission

Future proposal: 10% charged to the provider after payment collection, with weekly statements and manual settlement. Proposed basis is printing subtotal excluding delivery: Rs. 200 print + Rs. 150 delivery gives Rs. 20 commission, not Rs. 35. The founder must confirm the base before activation.

Introduce a published effective date, accepted provider terms, a per-order rate/base snapshot, payment evidence review, dispute handling and a grace period. Start with reminders and restrict new bidding for overdue undisputed balances; retain statement, support and existing-order access. Restore access after verified settlement. Never retroactively charge launch orders. Direct/off-platform payments mean collection and under-reporting remain business risks; suspension alone does not solve them.

## 11. Privacy and retention

- Private storage; draft owner only; live request review by eligible approved printers; matched order winner only.
- Request eligibility is rechecked on every file-view operation, including account restriction.
- Delete abandoned drafts after 24h, closed unmatched-request files after 24h, and completed/cancelled order files after 7 days.
- Disputes pause deletion only for necessary evidence under an explicit audited hold. Review unresolved holds and stale orders weekly.
- Prevent active orders from retaining files indefinitely: investigate stale jobs after 7 days; resolve or explicitly extend with an audit event, with a 30-day review boundary.
- Remove originals, previews and temporary outputs; retain minimal order/offer records under a separately approved policy.
- Saved addresses persist until edited/deleted; they are not temporary file attachments.
- The customer can request earlier file deletion; an active printing job must first be safely cancelled/resolved.

## 12. Screens and P0 scope

Customer: intro; address/pickup setup; signup/login; home; request editor; upload validation; request review; waiting/offers; offer confirmation; order/chat; history; settings/support.

Printer: role signup; provider application/status; feed; request detail/document viewer; offer composer; my offers; active jobs; order/chat; capabilities/hours; profile/restriction notice.

Admin: provider approvals; request/order search; issue queue; restrictions; audit/file-access events; file-cleanup failures; sponsor configuration.

P0 includes all core screens, secure uploads, offer expiry, single acceptance, chat, pickup/delivery milestones, direct-payment records, privacy controls and basic moderation. P1 includes ratings, saved multiple addresses, push notifications and improved search. Future phases include commissions, integrated payments, courier integration, selected color pages and merchandise.

## 13. University pilot and success criteria

Build first, then run internal test jobs before inviting the NIIT community. Recruit 2–3 approved providers and 20–30 consenting students. Use real ordinary assignments, not sensitive identity documents. Publish staffed hours and define campus-gate/pickup arrangements. No claim of university endorsement without permission.

Aim for 30 completed paid print jobs in a two-week pilot. Proposed learning thresholds, not industry benchmarks:

- 80% of valid requests receive an offer within 5 minutes during staffed hours.
- At least 50% receive offers from two distinct printers; otherwise it is not yet a liquid multi-provider marketplace.
- Track acceptance/posted-request rate and reasons for no acceptance.
- At least 90% of completed jobs meet the accepted timing commitment.
- Print-error/reprint rate at most 5%.
- Zero confirmed unauthorized file/address access; any incident pauses affected access pending repair.
- Measure repeat orders, per-provider participation, support minutes/order and actual hosting/storage expense.

Do not use ad revenue as proof of demand. The strongest evidence is customers accepting realistic offers, paying printers and returning.

## 14. Global references and competitor study

Research checked 18 October 2026. Public descriptions show advertised workflows, not independently tested reliability. No private account access or purchase was performed. The services below are not verified examples of this exact five-minute bidding model.

| Product / market | Verified public description | What to inspect and learn |
|---|---|---|
| [Printt](https://printt.com/) — UK | Help center describes file upload, print choices, delivery and Click & Collect. [C1] | Upload friction, settings, collection selection, total-price presentation |
| [Printo](https://printo.in/p/same-day-delivery-document-printing) — India | Offers document printing, binding and selected 4–6-hour express jobs. [C2] | Product configuration, finishing options, location-dependent timing |
| [Printster](https://printster.in/print/how-it-works) — India | Describes document upload, paper/color/binding choices, saved shipping details and delivery; store pickup also described. [C3] | Detailed settings, order review and repeat-order convenience |
| [PrintWithMe](https://printwithme.com/) — US | Find a self-service printer, upload, pay and use a secure release code. [C4] | Printer discovery, simple mobile flow and controlled physical release |
| [Printist](https://www.printist.in/en) — India | Shop-focused QR upload and print-queue workflow. [C5] | Provider dashboard, queue clarity and ease of receiving files |
| [iPrintSol](https://www.iprintsol.pk/) — Pakistan | Self-describes a multi-vendor printing marketplace in Lahore. [C6] | Local vendor presentation; verify current operations before benchmarking |

The iPrintSol page contains broken shortcodes/unrelated links, so its current operational status is uncertain. Printt’s homepage text extraction was limited; its own help center supports the workflow summary. Do not repeat unverified “first” or customer-count claims.

### Comparable task to try on each service

Use a non-sensitive sample PDF: 10 A4 pages, B&W, two copies, duplex, pickup then delivery. Record account requirement, supported files, default settings, total-price visibility, delivery estimates, edit behavior, cancellation terms and privacy notice. Stop before payment unless intentionally purchasing. Capture your observations in a comparison table; do not copy proprietary designs or attempt access to private systems.

The recommended design takeaway is to borrow proven configuration and tracking patterns while keeping your own competitive-offer model. Research has not established that any listed product uses five-minute competing bids.

### Research sources

- C1: [Printt official getting-started guide](https://intercom.help/printt/en/articles/9352578-how-to-get-started-with-printt)
- C2: [Printo same-day documents](https://printo.in/p/same-day-delivery-document-printing)
- C3: [Printster ordering guide](https://printster.in/print/how-it-works)
- C4: [PrintWithMe workflow](https://printwithme.com/)
- C5: [Printist](https://www.printist.in/en)
- C6: [iPrintSol](https://www.iprintsol.pk/)

## 15. Decisions to revisit before launch

Confirm pilot provider addresses and service zone; whether home-based pickups are permitted; supported stock/sizes; who staffs admin support; and who bears reprint/delivery failures. Confirm authentication/email delivery setup. Decide a retention schedule for chats and transaction records. Before enabling commissions, confirm the base, collection schedule, grace period and dispute process. These do not block implementation of the defaults above.

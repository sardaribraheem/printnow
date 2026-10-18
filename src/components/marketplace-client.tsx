"use client";
import Link from "next/link";
import { LocationFields } from "./location-fields";
import {
  api,
  uploadRequestFile,
  listenForChanges,
} from "@/lib/marketplace/client";
export { api } from "@/lib/marketplace/client";
import { useCallback, useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Clock3,
  FileText,
  LoaderCircle,
  MapPin,
  ShieldCheck,
  Check,
} from "lucide-react";
import {
  formatMoney,
  parsePages,
  validateUploadBatch,
} from "@/lib/domain/printing";
import type {
  Session,
  PrintRequest,
  RequestSummary,
  OrderSummary,
  Order,
  Offer,
  Capabilities,
} from "@/lib/marketplace/types";
export function useData<T>(path: string, poll = false) {
  const [snapshot, setSnapshot] = useState<{ path: string; value: T } | null>(
    null,
  );
  const data = snapshot?.path === path ? snapshot.value : null;
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const refresh = useCallback(async () => {
    try {
      const value = await api<T>(path);
      setSnapshot({ path, value });
      setError("");
      setCode("");
    } catch (e) {
      setError((e as Error).message);
      setCode((e as { code: string }).code);
    }
  }, [path]);
  useEffect(() => {
    let disposed = false;
    const load = () => {
      if (!disposed) void refresh();
    };
    const timer = setTimeout(load, 0);
    const interval = poll ? setInterval(load, 5000) : null;
    window.addEventListener("focus", load);
    let unsubscribe: (() => void) | undefined;
    if (poll)
      void listenForChanges(path, load).then((close) => {
        if (disposed) close();
        else unsubscribe = close;
      });
    return () => {
      unsubscribe?.();
      disposed = true;
      clearTimeout(timer);
      if (interval) clearInterval(interval);
      window.removeEventListener("focus", load);
    };
  }, [refresh, poll, path]);
  return { data, error, code, refresh };
}
export function Status({
  error,
  code,
  loading = false,
}: {
  error?: string;
  code?: string;
  loading?: boolean;
}) {
  return error ? (
    <div role="alert" className="error-message">
      {error}
      {code === "AUTH_REQUIRED" && (
        <Link className="text-link" href="/login">
          Sign in <ArrowRight size={14} />
        </Link>
      )}
    </div>
  ) : loading ? (
    <div className="loading-panel" role="status">
      <LoaderCircle size={22} className="spin" />
      Getting things ready…
    </div>
  ) : null;
}
export function SandboxBar({
  accounts,
  current,
}: {
  accounts: readonly { id: string; name: string }[];
  current: string | null;
}) {
  return (
    <div className="sandbox-bar">
      <span>
        <strong>Development sandbox</strong> · Sample accounts, real local data
      </span>
      <label>
        Try as{" "}
        <select
          aria-label="Sample account"
          value={current ?? ""}
          onChange={async (e) => {
            sessionStorage.removeItem("printnow-onboarding");
            await fetch("/api/sandbox", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: e.target.value }),
            });
            window.location.reload();
          }}
        >
          <option value="" disabled>
            Choose an account
          </option>
          {accounts.map((a) => (
            <option value={a.id} key={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
export function HistoryPanel() {
  const q = useData<{
    requests: RequestSummary[];
    orders: OrderSummary[];
    offers?: {
      id: string;
      request_id: string;
      title: string;
      status: string;
      total_paisa: number;
      duration_minutes: number;
      order_id: string | null;
    }[];
  }>("history", true);
  return (
    <>
      <Status error={q.error} code={q.code} loading={!q.data && !q.error} />
      {q.data && (
        <>
          <div className="section-heading">
            <h2>Your requests</h2>
            <Link href="/requests/new" className="button button-orange">
              New request <ArrowRight size={16} />
            </Link>
          </div>
          {!q.data.requests.length ? (
            <Empty
              title="Your first print starts here."
              text="Upload a file and invite local printers to make an offer."
            />
          ) : (
            <div className="request-grid">
              {q.data.requests.map((r) => (
                <RequestCard key={r.id} request={r} />
              ))}
            </div>
          )}
          {!!q.data.offers?.length && (
            <>
              <div className="section-heading space-top">
                <h2>Your offers</h2>
              </div>
              <div className="request-grid">
                {q.data.offers.map((o) => (
                  <Link
                    key={o.id}
                    href={
                      o.order_id
                        ? "/orders/" + o.order_id
                        : "/requests/" + o.request_id
                    }
                    className="panel job-card"
                  >
                    <span className={"status-pill " + o.status}>
                      {label(o.status)}
                    </span>
                    <h3>{o.title}</h3>
                    <p>
                      {formatMoney(o.total_paisa)} · {o.duration_minutes} minute
                      commitment
                    </p>
                    <span className="text-link">
                      View {o.order_id ? "order" : "request"}{" "}
                      <ArrowRight size={15} />
                    </span>
                  </Link>
                ))}
              </div>
            </>
          )}
          <div className="section-heading space-top">
            <h2>Orders</h2>
          </div>
          {!q.data.orders.length ? (
            <Empty
              title="No orders yet"
              text="Accept an offer to start your first order."
            />
          ) : (
            <div className="request-grid">
              {q.data.orders.map((o) => (
                <Link
                  className="panel job-card"
                  key={o.id}
                  href={"/orders/" + o.id}
                >
                  <span className={"status-pill " + o.status}>
                    {label(o.status)}
                  </span>
                  <h3>{o.title}</h3>
                  <p>
                    {o.mode === "pickup" ? "Shop pickup" : "Delivery"} ·{" "}
                    {formatMoney(o.price_snapshot.total_paisa)}
                  </p>
                  <span className="text-link">
                    View order <ArrowRight size={15} />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
export function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="panel empty-state">
      <FileText size={32} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
export function label(value: string) {
  return value.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
}
function RequestCard({ request: r }: { request: RequestSummary }) {
  return (
    <Link href={"/requests/" + r.id} className="panel job-card">
      <div className="job-card-top">
        <span className={"status-pill " + r.state}>{label(r.state)}</span>
        {r.urgency === "urgent" && <span className="urgent">Urgent</span>}
      </div>
      <h3>{r.title}</h3>
      <p>
        {r.total_sides ? `${r.total_sides} printed sides` : "Draft"} ·{" "}
        {r.mode === "pickup" ? "Pickup" : "Delivery"}
        {r.area ? " · " + r.area : ""}
      </p>
      <span className="text-link">
        {r.state === "open" ? "View request & offers" : "View request"}{" "}
        <ArrowRight size={15} />
      </span>
    </Link>
  );
}
export function Countdown({
  expires,
  serverNow,
}: {
  expires: string;
  serverNow: string;
}) {
  const [clock, setClock] = useState(() => Date.now());
  const [offset] = useState(() => new Date(serverNow).getTime() - Date.now());
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const remaining = Math.max(
    0,
    Math.ceil((new Date(expires).getTime() - clock - offset) / 1000),
  );
  return (
    <span
      className={remaining === 0 ? "expired-text" : "countdown"}
      data-clock={clock}
    >
      <Clock3 size={13} />
      {remaining === 0
        ? "Expired"
        : `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`}
    </span>
  );
}
export function RequestPanel({ id }: { id: string }) {
  const q = useData<PrintRequest>("request/" + id, true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [consent, setConsent] = useState(false);
  const [sort, setSort] = useState("newest");
  const [confirm, setConfirm] = useState<Offer | null>(null);
  const router = useRouter();
  const r = q.data;
  const mutate = async (action: string, input: object) => {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ id?: string }>(action, input);
      if (action === "accept" && result.id) router.push("/orders/" + result.id);
      else await q.refresh();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  if (!r) return <Status error={q.error} code={q.code} loading={!q.error} />;
  const ready = r.files.length > 0 && r.files.every((f) => f.state === "ready");
  const offers = [...r.offers].sort((a, b) =>
    sort === "price"
      ? a.total_paisa - b.total_paisa
      : sort === "time"
        ? a.duration_minutes - b.duration_minutes
        : new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  return (
    <>
      <div className="detail-heading">
        <div>
          <span className={"status-pill " + r.state}>{label(r.state)}</span>
          <h1>{r.title}</h1>
          <p>
            {r.mode === "pickup" ? "Shop pickup" : "Printer-arranged delivery"}{" "}
            · {r.area} · {r.urgency === "urgent" ? "Urgent" : "Standard"}
          </p>
        </div>
        {r.expires_at && r.state === "open" && (
          <Countdown
            key={r.server_now}
            expires={r.expires_at}
            serverNow={r.server_now}
          />
        )}
      </div>
      <Status error={error || q.error} />
      {r.order_id && r.mine && (
        <div className="success-message">
          An offer has been accepted.{" "}
          <Link className="text-link" href={"/orders/" + r.order_id}>
            Open your order <ArrowRight size={15} />
          </Link>
        </div>
      )}
      <div className="detail-layout">
        <div>
          <section className="panel">
            {r.mine && r.clarifications?.length ? (
              <div className="config-note">
                <strong>A printer needs a detail.</strong>
                {r.clarifications.map((c) => (
                  <p key={c.id}>
                    {c.provider_name}: clarify {label(c.category).toLowerCase()}
                    .
                  </p>
                ))}
                <p>
                  Use Edit / repost to clarify the requirements. Existing offers
                  will be invalidated.
                </p>
              </div>
            ) : null}
            <h2>Print requirements</h2>
            <Spec
              settings={r.settings}
              sides={r.total_sides}
              sheets={r.sheets}
            />
            {r.instructions && <p className="instructions">{r.instructions}</p>}
            <h3 className="space-top">Documents</h3>
            <div className="document-list">
              {r.files.map((f) => (
                <div key={f.id} className="document-item">
                  <FileText size={23} />
                  <div>
                    <strong>{f.name}</strong>
                    <small>
                      {f.pages
                        ? `${f.pages} page${f.pages === 1 ? "" : "s"}`
                        : label(f.state)}{" "}
                      · {(f.bytes / 1024 / 1024).toFixed(2)} MiB
                    </small>
                    <FilePrintSpec settings={r.settings} fileId={f.id} />
                    {f.pixel_width &&
                      f.pixel_height &&
                      Math.min(
                        f.pixel_width /
                          (r.settings.size === "A3" ? 11.69 : 8.27),
                        f.pixel_height /
                          (r.settings.size === "A3" ? 16.54 : 11.69),
                      ) < 150 && (
                        <p className="image-quality-note">
                          This image may look soft at {r.settings.size}. A
                          higher-resolution image will print more sharply.
                        </p>
                      )}
                    {f.error && <p className="error-message">{f.error}</p>}
                  </div>
                  {f.state === "ready" ? (
                    <a
                      href={`/api/files/${f.id}/view`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="button button-outline"
                    >
                      View file
                    </a>
                  ) : f.state === "failed" ? (
                    <span className="status-pill cancelled">
                      Needs replacing
                    </span>
                  ) : (
                    <LoaderCircle size={18} className="spin" />
                  )}
                </div>
              ))}
            </div>
          </section>
          {r.mine && r.state === "draft" && (
            <DraftEditor key={r.revision} request={r} refresh={q.refresh} />
          )}
          {r.mine && r.state === "draft" && (
            <section className="panel space-top">
              <h2>Review & post</h2>
              <p className="body-copy">
                Posting lets eligible approved printers in your area review your
                files. Your exact address and phone are shared only with the
                printer whose offer you accept.
              </p>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                I agree to share these files with eligible approved printers for
                quotations.
              </label>
              <button
                className="button button-orange"
                disabled={!ready || !consent || busy}
                onClick={() =>
                  mutate("publish", {
                    id: r.id,
                    revision: r.revision,
                    consent: "file-sharing-v1",
                  })
                }
              >
                {ready ? "Post request" : "Waiting for file validation"}{" "}
                <ArrowRight size={16} />
              </button>
            </section>
          )}
          {r.mine && r.state === "open" && (
            <section className="panel space-top">
              <div className="section-heading">
                <h2>Printer offers</h2>
                <select
                  aria-label="Sort offers"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="compact-select"
                >
                  <option value="newest">Newest first</option>
                  <option value="price">Lowest total</option>
                  <option value="time">Fastest</option>
                </select>
              </div>
              {!offers.length ? (
                <Empty
                  title="Your request is out there."
                  text="Eligible printers can now review your files and send offers. This page updates automatically."
                />
              ) : (
                <div className="offer-list">
                  {offers.map((offer) => (
                    <div
                      key={offer.id}
                      className={
                        "offer-card " +
                        (offer.status !== "active" ? "inactive" : "")
                      }
                    >
                      <div className="offer-card-top">
                        <div>
                          <h3>{offer.provider_name}</h3>
                          <small>New provider</small>
                        </div>
                        <strong className="offer-total">
                          {formatMoney(offer.total_paisa)}
                        </strong>
                      </div>
                      <div className="offer-breakdown">
                        <span>Printing {formatMoney(offer.print_paisa)}</span>
                        <span>
                          Delivery {formatMoney(offer.delivery_paisa)}
                        </span>
                      </div>
                      <p>
                        {r.mode === "pickup" ? "Ready for pickup" : "Delivered"}{" "}
                        within {offer.duration_minutes} minutes of acceptance ·{" "}
                        {offer.payment_method === "cash"
                          ? "Cash at handover"
                          : "Direct transfer at handover"}
                      </p>
                      {offer.pickup_address && (
                        <p>
                          <MapPin size={13} /> {offer.pickup_address}
                        </p>
                      )}
                      {offer.note && <p className="offer-note">{offer.note}</p>}
                      <div className="offer-actions">
                        <Countdown
                          key={r.server_now}
                          expires={offer.expires_at}
                          serverNow={r.server_now}
                        />
                        {offer.status === "active" ? (
                          <>
                            <button
                              className="text-button"
                              disabled={busy}
                              onClick={() =>
                                mutate("decline", { id: offer.id })
                              }
                            >
                              Decline
                            </button>
                            <button
                              className="button button-dark"
                              disabled={
                                busy ||
                                new Date(offer.expires_at) <=
                                  new Date(r.server_now)
                              }
                              onClick={() => setConfirm(offer)}
                            >
                              Choose this printer
                            </button>
                          </>
                        ) : (
                          <span className="status-pill">
                            {label(offer.status)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
          {!r.mine && r.state === "open" && (
            <>
              <OfferComposer request={r} onDone={q.refresh} />
              <section className="panel space-top">
                <h2>Need a detail first?</h2>
                <p className="body-copy">
                  Send a structured clarification request. The customer can edit
                  and repost; chat opens only after acceptance.
                </p>
                <div className="action-row">
                  {[
                    "page_selection",
                    "print_settings",
                    "fulfillment_details",
                  ].map((category) => (
                    <button
                      key={category}
                      className="button button-outline"
                      disabled={busy}
                      onClick={() => mutate("clarify", { id: r.id, category })}
                    >
                      Clarify {label(category).toLowerCase()}
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
        <aside>
          <section className="panel">
            <h2>At a glance</h2>
            <div className="summary-lines">
              <p>
                <span>Platform fee</span>
                <strong>Rs. 0</strong>
              </p>
              <p>
                <span>Payment</span>
                <strong>Direct to printer</strong>
              </p>
              <p>
                <span>Printed sides</span>
                <strong>{r.total_sides || "After validation"}</strong>
              </p>
              <p>
                <span>Physical sheets</span>
                <strong>{r.sheets || "After validation"}</strong>
              </p>
            </div>
            <p className="body-copy">
              Every offer lasts five minutes. You choose the printer; no money
              is charged through PrintNow.
            </p>
            {r.mine && r.state === "open" && (
              <button
                className="button button-outline full-width space-top"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      "Withdraw offers and return this request to a draft?",
                    )
                  )
                    void mutate("edit_request", {
                      id: r.id,
                      revision: r.revision,
                    });
                }}
              >
                Edit / repost request
              </button>
            )}
            {r.mine && ["draft", "open"].includes(r.state) && (
              <button
                className="text-button danger space-top"
                disabled={busy}
                onClick={() => {
                  if (window.confirm("Cancel this print request?"))
                    void mutate("cancel_request", { id: r.id });
                }}
              >
                Cancel request
              </button>
            )}
          </section>
        </aside>
      </div>
      {confirm && (
        <ConfirmModal busy={busy} onClose={() => setConfirm(null)}>
          <div className="eyebrow">ONE LAST LOOK</div>
          <h2 id="confirm-offer-title">Choose {confirm.provider_name}?</h2>
          <strong className="offer-total">
            {formatMoney(confirm.total_paisa)} total
          </strong>
          <p className="body-copy">
            {r.mode === "pickup" ? "Pickup ready" : "Delivery"} within{" "}
            {confirm.duration_minutes} minutes of acceptance. Pay the printer
            directly at handover by{" "}
            {confirm.payment_method === "cash" ? "cash" : "bank transfer"}. This
            accepts the approved print requirements.
          </p>
          <div className="action-row">
            <button
              className="button button-outline"
              disabled={busy}
              onClick={() => setConfirm(null)}
            >
              Go back
            </button>
            <button
              className="button button-orange"
              disabled={busy}
              onClick={async () => {
                const accepted = await mutate("accept", {
                  id: confirm.id,
                  revision: r.revision,
                  key: crypto.randomUUID(),
                });
                if (accepted) setConfirm(null);
              }}
            >
              Confirm printer
            </button>
          </div>
        </ConfirmModal>
      )}
    </>
  );
}
export function Spec({
  settings: s,
  sides,
  sheets,
}: {
  settings: PrintRequest["settings"];
  sides: number;
  sheets: number;
}) {
  return (
    <div className="spec-chips">
      <span>{s.size}</span>
      <span>{s.color === "bw" ? "Black & white" : "Color"}</span>
      <span>
        {s.copies} {s.copies === 1 ? "copy" : "copies"}
      </span>
      <span>{s.duplex ? "Double-sided" : "Single-sided"}</span>
      <span>{label(s.finishing)}</span>
      <span>{s.scaling === "actual" ? "Actual size" : "Fit to paper"}</span>
      {sides > 0 && (
        <span>
          {sides} sides / {sheets} sheets
        </span>
      )}
    </div>
  );
}
function OfferComposer({
  request: r,
  onDone,
}: {
  request: PrintRequest;
  onDone: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <section className="panel space-top">
      <h2>Send your offer</h2>
      <p className="body-copy">
        Include all printing and finishing costs. Your quote will last five
        minutes; your timing starts at acceptance.
      </p>
      <form
        className="auth-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          setBusy(true);
          setError("");
          try {
            await api("offer", {
              id: r.id,
              revision: r.revision,
              key: crypto.randomUUID(),
              print_paisa: Math.round(Number(form.get("printing")) * 100),
              delivery_paisa:
                r.mode === "pickup"
                  ? 0
                  : Math.round(Number(form.get("delivery")) * 100),
              duration_minutes: Number(form.get("duration")),
              payment_method: form.get("payment"),
              note: form.get("note"),
            });
            await onDone();
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="settings-grid">
          <label>
            Printing amount (Rs.)
            <input
              name="printing"
              type="number"
              min="1"
              max="1000000"
              step="0.01"
              required
            />
          </label>
          {r.mode === "delivery" && (
            <label>
              Delivery amount (Rs.)
              <input
                name="delivery"
                type="number"
                min="0"
                max="1000000"
                step="0.01"
                required
              />
            </label>
          )}
          <label>
            {r.mode === "pickup" ? "Ready" : "Delivered"} within (minutes)
            <input name="duration" type="number" min="1" max="10080" required />
          </label>
          <label>
            Payment at handover
            <select name="payment">
              <option value="cash">Cash</option>
              <option value="transfer">Direct transfer</option>
            </select>
          </label>
        </div>
        <label>
          Optional note
          <textarea name="note" maxLength={500} rows={2} />
        </label>
        <Status error={error} />
        <button className="button button-orange" disabled={busy} type="submit">
          {busy ? "Sending…" : "Send 5-minute offer"} <ArrowRight size={16} />
        </button>
      </form>
      {r.offers.length > 0 && (
        <div className="space-top">
          <h3>Your previous offers</h3>
          {r.offers.map((o) => (
            <p className="body-copy" key={o.id}>
              {formatMoney(o.total_paisa)} · {label(o.status)}{" "}
              {o.status === "active" && (
                <button
                  className="text-button"
                  onClick={async () => {
                    try {
                      await api("withdraw", { id: o.id });
                      await onDone();
                    } catch (err) {
                      setError((err as Error).message);
                    }
                  }}
                >
                  Withdraw
                </button>
              )}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
export function PrinterPanel() {
  const session = useData<Session>("session");
  const q = useData<{ requests: RequestSummary[]; server_now: string }>(
    "feed",
    true,
  );
  return (
    <>
      <div className="detail-heading">
        <div>
          <div className="eyebrow">LOCAL JOBS. YOUR NEXT OPPORTUNITY.</div>
          <h1>{session.data?.provider?.display_name ?? "Printer dashboard"}</h1>
          <p>Requests matching your service area and capabilities.</p>
        </div>
        <Link className="button button-outline" href="/printer/settings">
          Capabilities & hours
        </Link>
      </div>
      {session.data && !session.data.provider ? (
        <div className="panel">
          <h2>Start your provider application</h2>
          <p className="body-copy">
            Approved printers can review eligible requests and send offers.
          </p>
          <Link href="/printers/apply" className="button button-dark">
            Apply as a provider
          </Link>
        </div>
      ) : (
        <>
          <Status error={q.error} code={q.code} loading={!q.data && !q.error} />
          {q.data &&
            (!q.data.requests.length ? (
              <Empty
                title="A fresh batch will arrive here."
                text="No matching requests right now. Your feed refreshes automatically."
              />
            ) : (
              <div className="request-grid">
                {q.data.requests.map((r) => (
                  <RequestCard key={r.id} request={r} />
                ))}
              </div>
            ))}
        </>
      )}
      <div className="section-heading space-top">
        <h2>Your active and previous jobs</h2>
        <Link href="/history" className="text-link">
          Open jobs & offers <ArrowRight size={16} />
        </Link>
      </div>
    </>
  );
}
export function OrderPanel({ id }: { id: string }) {
  const q = useData<Order>("order/" + id, true);
  const request = useData<PrintRequest>(
    q.data ? "request/" + q.data.request_id : "session",
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("chat");
  const [older, setOlder] = useState<Order["messages"]>([]);
  const [moreHistory, setMoreHistory] = useState(true);
  const lastMessage = q.data?.messages.at(-1)?.id;
  const orderLoaded = Boolean(q.data);
  useEffect(() => {
    if (orderLoaded) void api("mark_order_read", { id }).catch(() => {});
  }, [id, lastMessage, orderLoaded]);
  const displayed = q.data
    ? [
        ...new Map(
          [...older, ...q.data.messages].map((m) => [m.id, m]),
        ).values(),
      ].sort(
        (a, b) =>
          a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
      )
    : [];
  const o = q.data;
  const mutate = async (action: string, input: object) => {
    setBusy(true);
    setError("");
    try {
      await api(action, { id, ...input });
      await q.refresh();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  if (!o) return <Status error={q.error} code={q.code} loading={!q.error} />;
  const stages =
    o.mode === "pickup"
      ? ["confirmed", "printing", "ready", "handover_reported", "completed"]
      : [
          "confirmed",
          "printing",
          "ready",
          "out_for_delivery",
          "handover_reported",
          "completed",
        ];
  const index = stages.indexOf(o.status);
  const next = stages[index + 1];
  const disputed =
    (o.customer_payment === "paid" && o.provider_payment === "not_received") ||
    (o.customer_payment === "not_paid" && o.provider_payment === "received");
  return (
    <>
      <div className="detail-heading">
        <div>
          <span className={"status-pill " + o.status}>{label(o.status)}</span>
          <h1>{o.spec_snapshot.title}</h1>
          <p>
            {o.provider_name} ·{" "}
            {o.mode === "pickup" ? "Shop pickup" : "Delivery"} · Due{" "}
            {time(o.due_at)}
          </p>
        </div>
        <strong className="offer-total">
          {formatMoney(o.price_snapshot.total_paisa)}
        </strong>
      </div>
      <Status error={error || q.error} />
      {o.mine && ["completed", "cancelled"].includes(o.status) && (
        <div className="action-row space-top" style={{ marginBottom: 24 }}>
          <Link
            className="button button-outline"
            href={"/requests/new?from=" + o.id}
          >
            Create a new request with these settings <ArrowRight size={15} />
          </Link>
        </div>
      )}
      <div className="progress-track">
        {stages.map((s, i) => (
          <div key={s} className={index >= i ? "done" : ""}>
            <span>{index > i ? <Check size={14} /> : i + 1}</span>
            <small>{label(s)}</small>
          </div>
        ))}
      </div>
      <div className="detail-layout">
        <div>
          <section className="panel">
            <div className="section-heading">
              <h2>Approved job</h2>
              <span className="muted">Revision {o.spec_snapshot.revision}</span>
            </div>
            <Spec
              settings={o.spec_snapshot.settings}
              sides={o.spec_snapshot.sides}
              sheets={o.spec_snapshot.sheets}
            />
            {o.spec_snapshot.instructions && (
              <p className="instructions">{o.spec_snapshot.instructions}</p>
            )}
            <div className="file-links">
              {request.data?.files
                ?.filter((f) => f.state === "ready")
                .map((f) => (
                  <a
                    key={f.id}
                    className="button button-outline"
                    href={`/api/files/${f.id}/view`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <FileText size={15} />
                    {f.name}
                  </a>
                ))}
            </div>
            {request.data?.files
              ?.filter((f) => f.state === "ready")
              .map((f) => (
                <div className="approved-file-spec" key={f.id}>
                  <strong>{f.name}</strong>
                  <FilePrintSpec
                    settings={o.spec_snapshot.settings}
                    fileId={f.id}
                  />
                </div>
              ))}
            <p className="inline-note">
              Chat messages don’t change these settings or authorize extra
              charges.
            </p>
            <div className="action-row space-top">
              {!o.mine &&
                next &&
                next !== "completed" &&
                o.status !== "cancelled" && (
                  <button
                    className="button button-orange"
                    disabled={busy}
                    onClick={() =>
                      mutate("transition", {
                        version: o.row_version,
                        status: next,
                      })
                    }
                  >
                    Mark {label(next).toLowerCase()}
                  </button>
                )}
              {o.mine && !["cancelled", "completed"].includes(o.status) && (
                <button
                  className="button button-dark"
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Confirm you have received the correct prints?",
                      )
                    )
                      void mutate("transition", {
                        version: o.row_version,
                        status: "completed",
                      });
                  }}
                >
                  Confirm received
                </button>
              )}
              {o.status === "confirmed" && (
                <button
                  className="button button-outline"
                  disabled={busy}
                  onClick={() => {
                    const reason = window.prompt(
                      "Why are you cancelling? (at least 5 characters)",
                    );
                    if (reason)
                      void mutate("transition", {
                        version: o.row_version,
                        status: "cancelled",
                        reason,
                      });
                  }}
                >
                  Cancel order
                </button>
              )}
            </div>
          </section>
          <section className="panel space-top">
            <div className="tab-row">
              {["chat", "activity", "support"].map((t) => (
                <button
                  key={t}
                  className={tab === t ? "selected" : ""}
                  onClick={() => setTab(t)}
                >
                  {label(t)}
                </button>
              ))}
            </div>
            {tab === "chat" ? (
              <>
                {o.messages.length >= 100 && moreHistory && (
                  <button
                    className="text-button"
                    onClick={async () => {
                      const oldest = displayed[0];
                      if (!oldest) return;
                      try {
                        const previous = await api<Order["messages"]>(
                          `messages/${id}?before=${encodeURIComponent(oldest.created_at)}&cursor=${oldest.id}`,
                        );
                        setOlder((current) => [...previous, ...current]);
                        setMoreHistory(previous.length === 100);
                      } catch (err) {
                        setError((err as Error).message);
                      }
                    }}
                  >
                    Load earlier messages
                  </button>
                )}
                <div className="chat-list" aria-live="polite">
                  {!o.messages.length && (
                    <p className="body-copy">
                      Your conversation starts here. Keep price and print
                      changes out of chat; material changes need a new request.
                    </p>
                  )}
                  {displayed.map((m) => (
                    <div
                      key={m.id}
                      className={"chat-message " + (m.mine ? "mine" : "")}
                    >
                      <small>
                        {m.mine ? "You" : m.sender_name} · {time(m.created_at)}
                      </small>
                      <p>{m.body}</p>
                      {m.mine && (
                        <small>
                          {o.other_read_at &&
                          new Date(o.other_read_at) >= new Date(m.created_at)
                            ? "Read"
                            : "Sent"}
                        </small>
                      )}
                    </div>
                  ))}
                </div>
                <form
                  className="chat-compose"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const body = String(
                      new FormData(form).get("message") ?? "",
                    );
                    if (
                      await mutate("message", {
                        key: crypto.randomUUID(),
                        body,
                      })
                    )
                      form.reset();
                  }}
                >
                  <label className="sr-only" htmlFor="chat-message">
                    Message
                  </label>
                  <input
                    id="chat-message"
                    name="message"
                    required
                    maxLength={2000}
                    placeholder="Write a message…"
                  />
                  <button className="button button-dark" disabled={busy}>
                    Send
                  </button>
                </form>
              </>
            ) : tab === "activity" ? (
              <ol className="activity-list">
                {o.events.map((e) => (
                  <li key={e.id}>
                    <strong>{label(e.kind)}</strong>
                    <small>{time(e.created_at)}</small>
                    {e.details.reason && <p>{e.details.reason}</p>}
                  </li>
                ))}
              </ol>
            ) : (
              <>
                <p className="body-copy">
                  Report a printing, delivery or payment issue. After printing
                  starts, cancellation needs support review. Refunds/reprints
                  are arranged with the printer.
                </p>
                {o.issues.map((i) => (
                  <div className="support-card" key={i.id}>
                    <strong>
                      {label(i.category)} · {label(i.state)}
                    </strong>
                    <p>{i.description}</p>
                    {i.resolution && <p>Resolution: {i.resolution}</p>}
                  </div>
                ))}
                <form
                  className="auth-form"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const f = new FormData(form);
                    await mutate("issue", {
                      category: f.get("category"),
                      description: f.get("description"),
                    });
                    form.reset();
                  }}
                >
                  <label>
                    Issue category
                    <select name="category">
                      <option value="wrong_output">Wrong print output</option>
                      <option value="damaged_delivery">Damaged delivery</option>
                      <option value="missed_deadline">Missed deadline</option>
                      <option value="nonpayment">Payment disagreement</option>
                      <option value="cancellation">
                        Cancellation after production
                      </option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                  <label>
                    What happened?
                    <textarea
                      name="description"
                      required
                      minLength={5}
                      maxLength={3000}
                      rows={3}
                    />
                  </label>
                  <button className="button button-outline" disabled={busy}>
                    Report issue
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
        <aside>
          <section className="panel">
            <h2>
              {o.mode === "pickup" ? "Pickup details" : "Delivery details"}
            </h2>
            <p className="body-copy">
              {o.mode === "pickup"
                ? o.contacts.pickup_address
                : o.contacts.delivery?.address}
            </p>
            {o.mode === "pickup" && (
              <p className="body-copy">{o.contacts.hours}</p>
            )}
            {o.contacts.delivery?.landmark && (
              <p className="body-copy">
                Landmark: {o.contacts.delivery.landmark}
              </p>
            )}
            <p className="body-copy">
              {o.mine ? "Printer" : "Customer"}:{" "}
              {o.mine ? o.contacts.provider_phone : o.contacts.customer_phone}
            </p>
            <p className="inline-note">
              Order reference {o.id.slice(0, 8).toUpperCase()}
            </p>
          </section>
          <section className="panel space-top">
            <h2>Direct payment</h2>
            <div className="summary-lines">
              <p>
                <span>Printing</span>
                <strong>{formatMoney(o.price_snapshot.print_paisa)}</strong>
              </p>
              <p>
                <span>Delivery</span>
                <strong>{formatMoney(o.price_snapshot.delivery_paisa)}</strong>
              </p>
              <p>
                <span>Platform fee</span>
                <strong>Rs. 0</strong>
              </p>
            </div>
            <p className="body-copy">
              {o.price_snapshot.payment_method === "cash"
                ? "Cash"
                : "Direct transfer"}{" "}
              at handover. PrintNow doesn’t collect this payment.
            </p>
            {disputed ? (
              <p className="error-message">Payment disputed</p>
            ) : (
              <p className="inline-note">
                Customer:{" "}
                {o.customer_payment ? label(o.customer_payment) : "No report"} ·
                Printer:{" "}
                {o.provider_payment ? label(o.provider_payment) : "No report"}
              </p>
            )}
            <div className="action-row">
              <button
                className="button button-outline"
                disabled={busy}
                onClick={() =>
                  mutate("payment", { assertion: o.mine ? "paid" : "received" })
                }
              >
                {o.mine ? "I paid the printer" : "Payment received"}
              </button>
              <button
                className="text-button"
                disabled={busy}
                onClick={() =>
                  mutate("payment", {
                    assertion: o.mine ? "not_paid" : "not_received",
                  })
                }
              >
                {o.mine ? "Not paid" : "Not received"}
              </button>
            </div>
            <p className="inline-note">
              These are participant reports, not independent bank verification.
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
export function time(value: string) {
  return new Intl.DateTimeFormat("en-PK", {
    timeZone: "Asia/Karachi",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
export function ProviderSettings() {
  const q = useData<Session>("session");
  const [error, setError] = useState("");
  const [point, setPoint] = useState({ lat: "", lng: "" });
  const [saved, setSaved] = useState(false);
  if (!q.data)
    return <Status error={q.error} code={q.code} loading={!q.error} />;
  const p = q.data.provider;
  if (!p)
    return (
      <Link href="/printers/apply" className="button button-dark">
        Apply as a provider
      </Link>
    );
  return (
    <section className="panel narrow-panel">
      <h1>Capabilities & hours</h1>
      <p className="body-copy">
        Your feed only includes requests you can fulfill.
      </p>
      <form
        className="auth-form"
        key={p.id}
        onSubmit={async (e) => {
          e.preventDefault();
          setSaved(false);
          setError("");
          const f = new FormData(e.currentTarget);
          const capabilities: Capabilities = {
            sizes: f.getAll("sizes").map(String),
            colors: f.getAll("colors").map(String),
            duplex: f.get("duplex") === "on",
            finishing: f.getAll("finishing").map(String),
          };
          try {
            await api("provider_settings", {
              capabilities,
              hours: f.get("hours"),
              accepting: f.get("accepting") === "on",
            });
            setSaved(true);
            await q.refresh();
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      >
        <fieldset>
          <legend>Paper sizes</legend>
          {["A4", "A3"].map((s) => (
            <label key={s} className="checkbox-label">
              <input
                type="checkbox"
                name="sizes"
                value={s}
                defaultChecked={p.capabilities.sizes.includes(s)}
              />
              {s}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Color modes</legend>
          {["bw", "color"].map((s) => (
            <label key={s} className="checkbox-label">
              <input
                type="checkbox"
                name="colors"
                value={s}
                defaultChecked={p.capabilities.colors.includes(s)}
              />
              {s === "bw" ? "Black & white" : "Color"}
            </label>
          ))}
        </fieldset>
        <label className="checkbox-label">
          <input
            type="checkbox"
            name="duplex"
            defaultChecked={p.capabilities.duplex}
          />
          Double-sided printing
        </label>
        <fieldset>
          <legend>Finishing</legend>
          {["loose", "stapled"].map((s) => (
            <label key={s} className="checkbox-label">
              <input
                type="checkbox"
                name="finishing"
                value={s}
                defaultChecked={p.capabilities.finishing.includes(s)}
              />
              {label(s)}
            </label>
          ))}
        </fieldset>
        <label>
          Operating hours
          <input
            name="hours"
            required
            minLength={2}
            maxLength={300}
            defaultValue={p.hours}
          />
        </label>
        <LocationFields value={point} onChange={setPoint} />
        <label className="checkbox-label">
          <input
            type="checkbox"
            name="accepting"
            defaultChecked={p.accepting}
          />
          Accepting new jobs
        </label>
        <Status error={error} />
        {saved && (
          <p className="success-message" role="status">
            Capabilities saved.
          </p>
        )}
        <button className="button button-orange">Save settings</button>
      </form>
    </section>
  );
}
interface AdminData {
  providers: {
    id: string;
    name: string;
    type: string;
    state: string;
    contact: string;
    phone: string;
    address: string;
    zone_id: string | null;
    capabilities: Capabilities;
    hours: string;
  }[];
  issues: {
    id: string;
    order_id: string;
    category: string;
    description: string;
    state: string;
    resolution: string | null;
  }[];
  cleanup?: { id: string; error: string }[];
  jobs: { id: string; state: string; attempts: number; error: string | null }[];
  audit: { id: string; action: string; reason: string; created_at: string }[];
}
export function AdminPanel() {
  const q = useData<AdminData>("admin", true);
  const session = useData<Session>("session");
  const [error, setError] = useState("");
  const [tab, setTab] = useState("providers");
  const [busy, setBusy] = useState(false);
  const mutate = async (action: string, input: object) => {
    setBusy(true);
    setError("");
    try {
      await api(action, input);
      await q.refresh();
      await session.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="detail-heading">
        <div>
          <div className="eyebrow">A LITTLE CARE BEHIND EVERY PRINT</div>
          <h1>Operations</h1>
          <p>
            Provider approvals, service areas, issues and processing health.
          </p>
        </div>
      </div>
      <Status
        error={error || q.error}
        code={q.code}
        loading={!q.data && !q.error}
      />
      {q.code === "MFA_REQUIRED" && <MfaPanel />}
      {q.data && (
        <>
          <div className="tab-row">
            {["providers", "issues", "areas", "processing", "audit"].map(
              (t) => (
                <button
                  className={tab === t ? "selected" : ""}
                  key={t}
                  onClick={() => setTab(t)}
                >
                  {label(t)}
                </button>
              ),
            )}
          </div>
          {tab === "providers" ? (
            <div className="request-grid">
              {q.data.providers.map((p) => (
                <section className="panel" key={p.id}>
                  <span className={"status-pill " + p.state}>
                    {label(p.state)}
                  </span>
                  <h2 className="space-top">{p.name}</h2>
                  <p className="body-copy">
                    {label(p.type)} · {p.contact} · {p.phone}
                    <br />
                    {p.address}
                    <br />
                    {p.hours || "Hours not set"}
                  </p>
                  <div className="spec-chips">
                    {p.capabilities.sizes.map((s) => (
                      <span key={s}>{s}</span>
                    ))}
                    {p.capabilities.colors.map((s) => (
                      <span key={s}>{s === "bw" ? "B&W" : "Color"}</span>
                    ))}
                  </div>
                  <form
                    className="auth-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      void mutate("admin_provider", {
                        id: p.id,
                        state: f.get("state"),
                        zone_id: f.get("zone_id") || null,
                        reason: f.get("reason"),
                      });
                    }}
                  >
                    <label>
                      Decision
                      <select
                        name="state"
                        defaultValue={
                          p.state === "pending" ? "active" : p.state
                        }
                      >
                        <option value="active">Approve / active</option>
                        <option value="restricted">Restrict new jobs</option>
                        <option value="suspended">Suspend new jobs</option>
                        <option value="rejected">Reject</option>
                      </select>
                    </label>
                    <label>
                      Service zone
                      <select name="zone_id" defaultValue={p.zone_id ?? ""}>
                        <option value="">Choose zone</option>
                        {session.data?.zones.map((z) => (
                          <option key={z.id} value={z.id}>
                            {z.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Review reason / evidence
                      <textarea
                        name="reason"
                        required
                        minLength={5}
                        maxLength={1000}
                      />
                    </label>
                    <button className="button button-dark" disabled={busy}>
                      Save review
                    </button>
                  </form>
                </section>
              ))}
            </div>
          ) : tab === "issues" ? (
            <div className="request-grid">
              {!q.data.issues.length && (
                <Empty
                  title="No issues reported"
                  text="Order support cases will appear here."
                />
              )}
              {q.data.issues.map((i) => (
                <section className="panel" key={i.id}>
                  <span className="status-pill">{label(i.state)}</span>
                  <h2 className="space-top">{label(i.category)}</h2>
                  <p className="body-copy">{i.description}</p>
                  <small>Order {i.order_id.slice(0, 8).toUpperCase()}</small>
                  {i.state === "open" ? (
                    <form
                      className="auth-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void mutate("admin_resolve", {
                          id: i.id,
                          reason: new FormData(e.currentTarget).get("reason"),
                        });
                      }}
                    >
                      <label>
                        Evidence / agreed resolution
                        <textarea
                          name="reason"
                          required
                          minLength={5}
                          maxLength={1000}
                        />
                      </label>
                      <button className="button button-dark" disabled={busy}>
                        Resolve issue
                      </button>
                    </form>
                  ) : (
                    <p className="body-copy">{i.resolution}</p>
                  )}
                </section>
              ))}
            </div>
          ) : tab === "areas" ? (
            <section className="panel narrow-panel">
              <h2>Pilot service areas</h2>
              <div className="spec-chips">
                {session.data?.zones.map((z) => (
                  <span key={z.id}>{z.name}</span>
                ))}
              </div>
              <form
                className="auth-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void mutate("admin_zone", {
                    name: f.get("name"),
                    reason: f.get("reason"),
                  });
                }}
              >
                <label>
                  Area name
                  <input name="name" required minLength={2} maxLength={100} />
                </label>
                <label>
                  Reason / coverage notes
                  <textarea
                    name="reason"
                    required
                    minLength={5}
                    maxLength={1000}
                  />
                </label>
                <button className="button button-orange" disabled={busy}>
                  Add service area
                </button>
              </form>
            </section>
          ) : tab === "processing" ? (
            <section className="panel">
              <h2>File processing failures</h2>
              {q.data.cleanup?.map((f) => (
                <div className="error-message" key={f.id}>
                  File cleanup: {f.error} · {f.id.slice(0, 8)}
                </div>
              ))}
              {!q.data.jobs.length ? (
                <p className="body-copy">No failed jobs.</p>
              ) : (
                q.data.jobs.map((j) => (
                  <div key={j.id} className="support-card">
                    <strong>
                      {label(j.state)} · {j.attempts} attempt(s)
                    </strong>
                    <p>{j.error}</p>
                  </div>
                ))
              )}
            </section>
          ) : (
            <section className="panel">
              <h2>Admin audit</h2>
              <ol className="activity-list">
                {q.data.audit.map((a) => (
                  <li key={a.id}>
                    <strong>{label(a.action)}</strong>
                    <p>{a.reason}</p>
                    <small>{time(a.created_at)}</small>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </>
      )}
    </>
  );
}
function MfaPanel() {
  const [image, setImage] = useState("");
  const [factor, setFactor] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section className="panel narrow-panel">
      <ShieldCheck size={30} />
      <h2>Secure admin access</h2>
      <p className="body-copy">
        Use an authenticator app to verify your identity before reviewing
        private operational data.
      </p>
      <Status error={error} />
      {!factor ? (
        <button
          className="button button-dark"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const { createBrowserClient } = await import("@supabase/ssr");
              const client = createBrowserClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
              );
              const factors = await client.auth.mfa.listFactors();
              const existing = factors.data?.totp.find(
                (f) => f.status === "verified",
              );
              if (existing) {
                setFactor(existing.id);
                return;
              }
              const { data, error } = await client.auth.mfa.enroll({
                factorType: "totp",
                friendlyName: "PrintNow admin",
              });
              if (error || !data) throw error;
              setFactor(data.id);
              setImage(data.totp.qr_code);
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Set up / verify authenticator
        </button>
      ) : (
        <form
          className="auth-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const { createBrowserClient } = await import("@supabase/ssr");
              const client = createBrowserClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
              );
              const { error } = await client.auth.mfa.challengeAndVerify({
                factorId: factor,
                code: String(new FormData(e.currentTarget).get("code")),
              });
              if (error) throw error;
              window.location.reload();
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {image && (
            <div>
              <p className="body-copy">
                Scan this code with your authenticator app.
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={
                  image.startsWith("data:")
                    ? image
                    : `data:image/svg+xml;utf-8,${encodeURIComponent(image)}`
                }
                width={220}
                height={220}
                alt="Authenticator setup QR code"
              />
            </div>
          )}
          <label>
            Six-digit code
            <input
              name="code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              autoComplete="one-time-code"
              required
            />
          </label>
          <button className="button button-orange" disabled={busy}>
            Verify admin access
          </button>
        </form>
      )}
    </section>
  );
}
export function ProviderApplication() {
  const q = useData<Session>("session");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section className="panel narrow-panel">
      <h1>Your printer account.</h1>
      <p className="body-copy">
        Shop and home-based providers can apply. Every application is reviewed
        before document access or bidding.
      </p>
      <Status error={q.error} code={q.code} loading={!q.data && !q.error} />
      {q.data?.provider ? (
        <>
          <p className="success-message">
            Application status: {label(q.data.provider.state)}
          </p>
          <p className="body-copy">
            Complete your capabilities and hours before approval.
          </p>
          <Link href="/printer/settings" className="button button-dark">
            Capabilities & hours <ArrowRight size={16} />
          </Link>
        </>
      ) : (
        <form
          className="auth-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const f = new FormData(e.currentTarget);
            try {
              await api("apply_provider", {
                name: f.get("name"),
                type: f.get("type"),
                contact: f.get("contact"),
                phone: f.get("phone"),
                address: f.get("address"),
                pickup: f.get("pickup") === "on",
                delivery: f.get("delivery") === "on",
                consent: f.get("consent") === "on",
              });
              await q.refresh();
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Provider / business name
            <input name="name" required minLength={2} maxLength={100} />
          </label>
          <label>
            Business type
            <select name="type">
              <option value="shop">Print shop</option>
              <option value="home">Home-based provider</option>
            </select>
          </label>
          <label>
            Responsible person
            <input name="contact" required minLength={2} maxLength={100} />
          </label>
          <label>
            Contact phone
            <input
              name="phone"
              type="tel"
              required
              minLength={7}
              maxLength={25}
            />
          </label>
          <label>
            Production / pickup address
            <textarea name="address" required minLength={5} maxLength={1000} />
          </label>
          <label className="checkbox-label">
            <input name="pickup" type="checkbox" />
            Shop / home pickup
          </label>
          <label className="checkbox-label">
            <input name="delivery" type="checkbox" />
            Printer-arranged delivery
          </label>
          <label className="checkbox-label">
            <input name="consent" type="checkbox" />
            If I offer pickup, I agree to show this pickup address to potential
            pickup customers, including when it is my home.
          </label>
          <Status error={error} />
          <button className="button button-dark" disabled={busy || !q.data}>
            Submit application
          </button>
          {!q.data && (
            <p className="inline-note">Sign in to submit your application.</p>
          )}
        </form>
      )}
    </section>
  );
}
function DraftEditor({
  request: r,
  refresh,
}: {
  request: PrintRequest;
  refresh: () => Promise<void>;
}) {
  const [settings, setSettings] = useState(r.settings);
  const [title, setTitle] = useState(r.title);
  const [instructions, setInstructions] = useState(r.instructions);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const setFile = (
    id: string,
    patch: Partial<PrintRequest["settings"]> & { pages?: string },
  ) =>
    setSettings((s) => ({
      ...s,
      files: { ...s.files, [id]: { ...s.files?.[id], ...patch } },
    }));
  return (
    <section className="panel space-top">
      <h2>Fine-tune each file</h2>
      <p className="body-copy">
        Keep the defaults or choose page ranges, copies and print settings per
        file. Each copy starts on a fresh sheet.
      </p>
      <div className="auth-form">
        <label>
          Request title
          <input
            value={title}
            minLength={2}
            maxLength={100}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label>
          Instructions
          <textarea
            value={instructions}
            rows={3}
            maxLength={1000}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </label>
      </div>
      {r.files.map((f) => {
        const spec = { ...settings, ...settings.files?.[f.id] };
        return (
          <div className="per-file-settings" key={f.id}>
            <h3>{f.name}</h3>
            <div className="settings-grid auth-form">
              <label>
                Pages (all if blank)
                <input
                  value={spec.pages ?? ""}
                  placeholder={
                    f.pages ? `1-${f.pages}` : "Waiting for validation"
                  }
                  disabled={!f.pages}
                  onChange={(e) => setFile(f.id, { pages: e.target.value })}
                />
              </label>
              <label>
                Copies
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={spec.copies}
                  onChange={(e) =>
                    setFile(f.id, { copies: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                Paper
                <select
                  value={spec.size}
                  onChange={(e) =>
                    setFile(f.id, { size: e.target.value as "A4" | "A3" })
                  }
                >
                  <option>A4</option>
                  <option>A3</option>
                </select>
              </label>
              <label>
                Color
                <select
                  value={spec.color}
                  onChange={(e) =>
                    setFile(f.id, { color: e.target.value as "bw" | "color" })
                  }
                >
                  <option value="bw">Black & white</option>
                  <option value="color">Color</option>
                </select>
              </label>
              <label>
                Finishing
                <select
                  value={spec.finishing}
                  onChange={(e) =>
                    setFile(f.id, {
                      finishing: e.target.value as "loose" | "stapled",
                    })
                  }
                >
                  <option value="loose">Loose</option>
                  <option value="stapled">Stapled</option>
                </select>
              </label>
              <label>
                Sides
                <select
                  value={spec.duplex ? "duplex" : "single"}
                  onChange={(e) =>
                    setFile(f.id, { duplex: e.target.value === "duplex" })
                  }
                >
                  <option value="single">Single-sided</option>
                  <option value="duplex">Double-sided</option>
                </select>
              </label>
            </div>
            <button
              className="text-button danger"
              disabled={busy}
              onClick={async () => {
                setError("");
                setBusy(true);
                try {
                  await api("remove_file", { id: f.id });
                  await refresh();
                } catch (err) {
                  setError((err as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Remove file
            </button>
          </div>
        );
      })}
      <Status error={error} />
      <div className="action-row space-top">
        <button
          className="button button-outline"
          disabled={busy}
          onClick={async () => {
            setError("");
            setBusy(true);
            try {
              for (const file of r.files) {
                const spec = { ...settings, ...settings.files?.[file.id] };
                if (file.pages) parsePages(spec.pages ?? "", file.pages);
              }
              await api("edit_request", {
                id: r.id,
                revision: r.revision,
                settings,
                title,
                instructions,
              });
              await refresh();
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Save file settings
        </button>
        <label className="button button-outline">
          Add / replace file
          <input
            className="sr-only"
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            disabled={busy}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const problem = validateUploadBatch([
                ...r.files.map((f) => ({ name: f.name, size: f.bytes })),
                file,
              ]);
              if (problem) {
                setError(problem);
                return;
              }
              setBusy(true);
              setError("");
              try {
                await uploadRequestFile(r.id, file);
                await refresh();
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
      </div>
      <p className="inline-note">
        Save settings before posting. File checks run in the background.
      </p>
    </section>
  );
}
export function Notifications() {
  const q = useData<
    {
      id: string;
      kind: string;
      entity_id: string;
      read_at: string | null;
      created_at: string;
    }[]
  >("notifications", true);
  const [open, setOpen] = useState(false);
  const unread = q.data?.filter((n) => !n.read_at).length ?? 0;
  return (
    <div className="notifications">
      <button
        className="account-link"
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        Updates
        {unread > 0 && <span className="notification-count">{unread}</span>}
      </button>
      {open && (
        <div className="panel notification-popover">
          <div className="section-heading">
            <h3>Updates</h3>
            <button
              className="text-button"
              onClick={async () => {
                await api("notification_read", {});
                await q.refresh();
              }}
            >
              Mark all read
            </button>
          </div>
          {!q.data?.length ? (
            <p className="body-copy">Your updates will appear here.</p>
          ) : (
            q.data.slice(0, 20).map((n) => (
              <Link
                key={n.id}
                className={"notification-item " + (!n.read_at ? "unread" : "")}
                href={
                  (n.kind.startsWith("order") || n.kind === "new_message"
                    ? "/orders/"
                    : "/requests/") + n.entity_id
                }
                onClick={() => {
                  setOpen(false);
                  void api("notification_read", { id: n.id }).then(q.refresh);
                }}
              >
                <strong>{label(n.kind)}</strong>
                <small>{time(n.created_at)}</small>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
function FilePrintSpec({
  settings,
  fileId,
}: {
  settings: PrintRequest["settings"];
  fileId: string;
}) {
  const spec = { ...settings, ...settings.files?.[fileId] };
  return (
    <small className="file-print-spec">
      Pages: {spec.pages || "All"} · {spec.copies}{" "}
      {spec.copies === 1 ? "copy" : "copies"} · {spec.size} ·{" "}
      {spec.color === "bw" ? "B&W" : "Color"} ·{" "}
      {spec.duplex ? "Double-sided" : "Single-sided"} · {label(spec.finishing)}{" "}
      · {spec.scaling === "actual" ? "Actual size" : "Fit to paper"}
      {spec.duplex ? ` · ${label(spec.duplex_edge)} edge` : ""}
    </small>
  );
}
export function SupportCasePanel({ id }: { id: string }) {
  const q = useData<{
    case: {
      category: string;
      description: string;
      state: string;
      resolution: string | null;
    };
    order: Order;
    contacts: Order["contacts"];
    files: { id: string; name: string; state: string }[];
    messages: { body: string; created_at: string }[];
  }>("case/" + id);
  if (!q.data)
    return <Status error={q.error} code={q.code} loading={!q.error} />;
  const data = q.data;
  return (
    <>
      <div className="detail-heading">
        <div>
          <div className="eyebrow">AUDITED SUPPORT REVIEW</div>
          <h1>{label(data.case.category)}</h1>
          <p>
            Case {id.slice(0, 8).toUpperCase()} · {label(data.case.state)}
          </p>
        </div>
        <Link href="/admin" className="button button-outline">
          Back to operations
        </Link>
      </div>
      <section className="panel">
        <h2>Reported issue</h2>
        <p className="instructions">{data.case.description}</p>
        {data.case.resolution && (
          <p className="body-copy">Resolution: {data.case.resolution}</p>
        )}
        <h2 className="space-top">Approved order</h2>
        <Spec
          settings={data.order.spec_snapshot.settings}
          sides={data.order.spec_snapshot.sides}
          sheets={data.order.spec_snapshot.sheets}
        />
        <p className="body-copy">
          {label(data.order.status)} ·{" "}
          {formatMoney(data.order.price_snapshot.total_paisa)} ·{" "}
          {data.contacts.customer_name} / {data.contacts.provider_name}
        </p>
        <div className="file-links">
          {data.files.map((f) =>
            f.state === "ready" && data.case.state === "open" ? (
              <a
                className="button button-outline"
                target="_blank"
                rel="noopener noreferrer"
                href={`/api/files/${f.id}/view?case=${id}`}
                key={f.id}
              >
                <FileText size={15} />
                {f.name}
              </a>
            ) : (
              <span key={f.id} className="muted">
                {f.name} · {label(f.state)}
              </span>
            ),
          )}
        </div>
        <p className="inline-note">
          Every evidence view is logged. File access is limited to an open case.
        </p>
        <h2 className="space-top">Recent order conversation</h2>
        <div className="chat-list">
          {data.messages.map((m, i) => (
            <div className="chat-message" key={i}>
              <small>{time(m.created_at)}</small>
              <p>{m.body}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
function ConfirmModal({
  children,
  onClose,
  busy,
}: {
  children: React.ReactNode;
  onClose: () => void;
  busy: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="panel modal"
      aria-labelledby="confirm-offer-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      {children}
    </dialog>
  );
}

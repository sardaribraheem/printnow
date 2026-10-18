"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { LocationFields } from "./location-fields";
import { uploadRequestFile } from "@/lib/marketplace/client";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  FileText,
  Info,
  LockKeyhole,
  MapPin,
  Minus,
  Plus,
  ShieldCheck,
  Trash2,
  Truck,
  UploadCloud,
  LoaderCircle,
} from "lucide-react";
import {
  printCounts,
  uploadKind,
  validateUploadBatch,
} from "@/lib/domain/printing";
import { api, Status, useData } from "./marketplace-client";
import type { Session, PrintSettings } from "@/lib/marketplace/types";
export function RequestComposer({
  preset,
  initial,
}: {
  preset?: string;
  initial?: {
    title: string;
    mode: "pickup" | "delivery";
    settings: PrintSettings;
  };
}) {
  const q = useData<Session>("session");
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [copies, setCopies] = useState(initial?.settings.copies ?? 1);
  const [duplex, setDuplex] = useState(initial?.settings.duplex ?? false);
  const [color, setColor] = useState<"bw" | "color">(
    initial?.settings.color ?? (preset === "image" ? "color" : "bw"),
  );
  const [size, setSize] = useState<"A4" | "A3">(initial?.settings.size ?? "A4");
  const [modeChoice, setMode] = useState<"pickup" | "delivery" | null>(
    initial?.mode ?? null,
  );
  const mode = modeChoice ?? q.data?.user.preferred_fulfillment ?? "pickup";
  const [urgency, setUrgency] = useState("standard");
  const [finishing, setFinishing] = useState<"loose" | "stapled">(
    initial?.settings.finishing ?? "loose",
  );
  const [edge, setEdge] = useState<"long" | "short">(
    initial?.settings.duplex_edge ?? "long",
  );
  const [scaling, setScaling] = useState<"fit" | "actual">(
    initial?.settings.scaling ?? "fit",
  );
  const [title, setTitle] = useState(initial?.title ?? "");
  const [instructions, setInstructions] = useState("");
  const [zone, setZone] = useState("");
  const [area, setArea] = useState("");
  const [name, setName] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [landmark, setLandmark] = useState<string | null>(null);
  const [deadline, setDeadline] = useState("");
  const [pointChoice, setPoint] = useState<{ lat: string; lng: string } | null>(
    null,
  );
  const point =
    pointChoice ??
    (mode === "delivery" && q.data?.address
      ? {
          lat: q.data.address.lat?.toString() ?? "",
          lng: q.data.address.lng?.toString() ?? "",
        }
      : { lat: "", lng: "" });
  const [radius, setRadius] = useState("");
  const recipientName =
    name ?? q.data?.address?.recipient_name ?? q.data?.user.display_name ?? "";
  const recipientPhone =
    phone ?? q.data?.address?.phone ?? q.data?.user.contact_phone ?? "";
  const recipientAddress = address ?? q.data?.address?.full_address ?? "";
  const recipientLandmark = landmark ?? q.data?.address?.landmark ?? "";
  const requestId = useRef<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const requestKey = useRef<string | null>(null);
  const uploaded = useRef(new Set<File>());
  const pdfPending = files.some((f) => uploadKind(f.name) === "pdf");
  let counts: ReturnType<typeof printCounts> | null = null;
  let countError = "";
  try {
    if (files.length && !pdfPending)
      counts = printCounts(files.map(() => ({ pages: 1, copies, duplex })));
  } catch (e) {
    countError = (e as Error).message;
  }
  function add(incoming: FileList | null) {
    if (!incoming) return;
    const next = [...files, ...Array.from(incoming)];
    const problem = validateUploadBatch(next);
    if (problem) {
      setError(problem);
      return;
    }
    setFiles(next);
    setError("");
    if (input.current) input.current.value = "";
  }
  async function submit() {
    setError("");
    if (!files.length) {
      setError("Add at least one PDF, PNG or JPEG.");
      return;
    }
    if (!area.trim()) {
      setError("Choose a search area or campus.");
      return;
    }
    if (
      mode === "delivery" &&
      (!recipientName.trim() ||
        recipientPhone.length < 7 ||
        recipientAddress.length < 5)
    ) {
      setError("Add the delivery recipient, phone and address.");
      return;
    }
    if (radius && (!point.lat || !point.lng)) {
      setError("Add a location pin to limit pickup distance.");
      return;
    }
    if (!q.data?.zones.length) {
      setError("The pilot service area needs to be configured before posting.");
      return;
    }
    setBusy(true);
    try {
      if (!requestKey.current) requestKey.current = crypto.randomUUID();
      const settings: PrintSettings = {
        size,
        color,
        copies,
        duplex,
        duplex_edge: edge,
        finishing,
        scaling,
      };
      if (!requestId.current) {
        const created = await api<{ id: string }>("create_request", {
          key: requestKey.current,
          title: title.trim() || files[0].name.replace(/\.[^.]+$/, ""),
          mode,
          urgency,
          zone_id: zone || q.data.zones[0].id,
          area,
          coordinates: point,
          radius_km: radius ? Number(radius) : null,
          settings,
          instructions,
          latest_needed_at: deadline
            ? new Date(deadline + ":00+05:00").toISOString()
            : null,
          destination:
            mode === "delivery"
              ? {
                  name: recipientName,
                  phone: recipientPhone,
                  address: recipientAddress,
                  landmark: recipientLandmark,
                }
              : null,
        });
        requestId.current = created.id;
        setSavedId(created.id);
      }
      for (let i = 0; i < files.length; i++) {
        if (uploaded.current.has(files[i])) continue;
        setProgress(`Uploading file ${i + 1} of ${files.length}…`);
        await uploadRequestFile(requestId.current, files[i]);
        uploaded.current.add(files[i]);
      }
      router.push("/requests/" + requestId.current);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setProgress("");
    }
  }
  return (
    <div className="composer-layout">
      <div className="composer-main">
        {initial && (
          <p className="success-message">
            Default settings copied from your previous order. Add files again
            and review before posting.
          </p>
        )}
        <section className="panel">
          <div className="panel-title">
            <span className="number-badge">1</span>
            <div>
              <h2>Your files</h2>
              <p>A document, a few notes, or an idea in full color.</p>
            </div>
          </div>
          <input
            ref={input}
            type="file"
            id="upload-files"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
            className="sr-only"
            disabled={busy}
            onChange={(e) => add(e.target.files)}
          />
          <button
            disabled={busy}
            type="button"
            className="dropzone"
            onClick={() => input.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (!busy) add(e.dataTransfer.files);
            }}
          >
            <span className="upload-icon">
              <UploadCloud size={30} />
            </span>
            <strong>
              Drop your files here, or <span>browse files</span>
            </strong>
            <small>PDF, PNG, JPEG · Up to 3 files · 25 MiB each</small>
          </button>
          {files.length > 0 && (
            <ul className="file-list">
              {files.map((file, i) => (
                <li key={`${file.name}-${i}`}>
                  <span className="file-icon">
                    <FileText size={21} />
                  </span>
                  <span className="file-detail">
                    <strong>{file.name}</strong>
                    <small>
                      {(file.size / 1024 / 1024).toFixed(2)} MiB ·{" "}
                      {uploadKind(file.name) === "pdf"
                        ? "Page count needs server validation"
                        : "1 image page · awaiting validation"}
                    </small>
                  </span>
                  <button
                    disabled={busy || !!savedId}
                    className="icon-button"
                    aria-label={`Remove ${file.name}`}
                    onClick={() => setFiles(files.filter((_, n) => n !== i))}
                  >
                    <Trash2 size={17} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="inline-note">
            <LockKeyhole size={14} />
            Files stay on your device until you choose Upload & review.
          </p>
        </section>
        <section className="panel">
          <div className="panel-title">
            <span className="number-badge">2</span>
            <div>
              <h2>The little details</h2>
              <p>Good defaults, with room to make it yours.</p>
            </div>
          </div>
          <label className="field-label" htmlFor="request-title">
            Request title
          </label>
          <input
            id="request-title"
            value={title}
            maxLength={100}
            placeholder="e.g. Monday assignment notes"
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className="settings-grid space-top">
            <fieldset>
              <legend>Print color</legend>
              <div className="segmented">
                {(["bw", "color"] as const).map((c) => (
                  <button
                    type="button"
                    key={c}
                    className={color === c ? "selected" : ""}
                    aria-pressed={color === c}
                    onClick={() => setColor(c)}
                  >
                    {c === "bw" ? "Black & white" : "Color"}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>Paper size</legend>
              <div className="segmented">
                {(["A4", "A3"] as const).map((s) => (
                  <button
                    type="button"
                    key={s}
                    className={size === s ? "selected" : ""}
                    aria-pressed={size === s}
                    onClick={() => setSize(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>Print sides</legend>
              <div className="segmented">
                <button
                  type="button"
                  className={!duplex ? "selected" : ""}
                  aria-pressed={!duplex}
                  onClick={() => setDuplex(false)}
                >
                  Single-sided
                </button>
                <button
                  type="button"
                  className={duplex ? "selected" : ""}
                  aria-pressed={duplex}
                  onClick={() => setDuplex(true)}
                >
                  Double-sided
                </button>
              </div>
            </fieldset>
            <fieldset>
              <legend>Copies per file</legend>
              <div className="stepper">
                <button
                  aria-label="Fewer copies"
                  disabled={copies === 1}
                  onClick={() => setCopies(copies - 1)}
                >
                  <Minus size={15} />
                </button>
                <output aria-live="polite">{copies}</output>
                <button
                  aria-label="More copies"
                  disabled={copies === 200}
                  onClick={() => setCopies(copies + 1)}
                >
                  <Plus size={15} />
                </button>
              </div>
            </fieldset>
            <label className="field-label">
              Finishing
              <select
                value={finishing}
                onChange={(e) =>
                  setFinishing(e.target.value as typeof finishing)
                }
              >
                <option value="loose">Loose sheets</option>
                <option value="stapled">Stapled</option>
              </select>
            </label>
            <label className="field-label">
              Scaling
              <select
                value={scaling}
                onChange={(e) => setScaling(e.target.value as typeof scaling)}
              >
                <option value="fit">Fit to printable area</option>
                <option value="actual">Actual size</option>
              </select>
            </label>
            {duplex && (
              <label className="field-label">
                Duplex edge
                <select
                  value={edge}
                  onChange={(e) => setEdge(e.target.value as typeof edge)}
                >
                  <option value="long">Long-edge binding</option>
                  <option value="short">Short-edge binding</option>
                </select>
              </label>
            )}
          </div>
          <div className="default-settings">
            <Check size={15} />
            Standard white paper · Per-file page ranges available after
            validation
          </div>
          <label className="field-label" htmlFor="instructions">
            Anything the printer should know? <span>(optional)</span>
          </label>
          <textarea
            id="instructions"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="A small detail that makes a big difference…"
            rows={3}
            maxLength={1000}
          />
          <p className="inline-note">
            <Info size={14} />
            Images keep their proportions. Each file and copy starts on a fresh
            sheet.
          </p>
        </section>
        <section className="panel">
          <div className="panel-title">
            <span className="number-badge">3</span>
            <div>
              <h2>How should it reach you?</h2>
              <p>Your schedule. Your way.</p>
            </div>
          </div>
          <div className="choice-grid">
            {[
              {
                id: "pickup" as const,
                icon: MapPin,
                title: "I’ll pick it up",
                text: "Collect from your chosen printer.",
              },
              {
                id: "delivery" as const,
                icon: Truck,
                title: "Bring it to me",
                text: "Your printer arranges delivery.",
              },
            ].map(({ id, icon: Icon, title, text }) => (
              <button
                type="button"
                key={id}
                className={`choice-card ${mode === id ? "selected" : ""}`}
                aria-pressed={mode === id}
                onClick={() => setMode(id)}
              >
                <Icon size={22} />
                <strong>{title}</strong>
                <span>{text}</span>
                {mode === id && <Check className="choice-check" size={16} />}
              </button>
            ))}
          </div>
          <div className="auth-form">
            <label>
              Service zone
              <select
                value={zone || q.data?.zones[0]?.id || ""}
                onChange={(e) => setZone(e.target.value)}
              >
                <option value="" disabled>
                  Choose a pilot zone
                </option>
                {q.data?.zones.map((z) => (
                  <option value={z.id} key={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Search area / campus
              <input
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="e.g. NIIT main gate"
                minLength={2}
                maxLength={100}
              />
            </label>
            {mode === "delivery" && (
              <>
                <label>
                  Recipient name
                  <input
                    value={recipientName}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={100}
                  />
                </label>
                <label>
                  Recipient phone
                  <input
                    type="tel"
                    value={recipientPhone}
                    onChange={(e) => setPhone(e.target.value)}
                    maxLength={25}
                  />
                </label>
                <label>
                  Exact delivery address
                  <textarea
                    value={recipientAddress}
                    onChange={(e) => setAddress(e.target.value)}
                    maxLength={1000}
                  />
                </label>
                <label>
                  Landmark (optional)
                  <input
                    value={recipientLandmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    maxLength={300}
                  />
                </label>
                <p className="inline-note">
                  Your exact address and phone stay hidden until you accept a
                  printer.
                </p>
              </>
            )}
          </div>
          <LocationFields value={point} onChange={setPoint} />
          {mode === "pickup" && (
            <label className="field-label space-top">
              Maximum pickup travel distance
              <select
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
              >
                <option value="">Anywhere in my service area</option>
                <option value="2">2 km from my pin</option>
                <option value="5">5 km from my pin</option>
                <option value="10">10 km from my pin</option>
              </select>
            </label>
          )}
          <fieldset className="urgency-field">
            <legend>How soon do you need it?</legend>
            <div className="segmented">
              {["standard", "urgent"].map((s) => (
                <button
                  type="button"
                  key={s}
                  className={urgency === s ? "selected" : ""}
                  aria-pressed={urgency === s}
                  onClick={() => setUrgency(s)}
                >
                  {s === "standard" ? "Standard" : "Urgent"}
                </button>
              ))}
            </div>
          </fieldset>
          <p className="inline-note">
            {urgency === "urgent"
              ? "Urgent requests stay open for 30 minutes."
              : "Standard requests stay open for up to 2 hours."}{" "}
            Each printer offers their own completion time.
          </p>
          <label className="field-label space-top">
            Latest needed (Pakistan time, optional)
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </label>
        </section>
      </div>
      <aside className="request-summary">
        <div className="panel summary-panel">
          <div className="eyebrow">YOUR REQUEST AT A GLANCE</div>
          <h2>A little print plan.</h2>
          <dl>
            <div>
              <dt>Files</dt>
              <dd>
                {files.length ? `${files.length} selected` : "Not added yet"}
              </dd>
            </div>
            <div>
              <dt>Paper</dt>
              <dd>
                {size} · {color === "bw" ? "B&W" : "Color"}
              </dd>
            </div>
            <div>
              <dt>Sides</dt>
              <dd>{duplex ? "Double-sided" : "Single-sided"}</dd>
            </div>
            <div>
              <dt>Copies per file</dt>
              <dd>{copies}</dd>
            </div>
            <div>
              <dt>Fulfillment</dt>
              <dd>{mode === "pickup" ? "Shop pickup" : "Delivery"}</dd>
            </div>
            {counts && (
              <>
                <div>
                  <dt>Printed sides</dt>
                  <dd>{counts.printedSides}*</dd>
                </div>
                <div>
                  <dt>Physical sheets</dt>
                  <dd>{counts.sheets}*</dd>
                </div>
              </>
            )}
          </dl>
          {counts && (
            <p className="inline-note">*Estimated until files are validated.</p>
          )}
          {pdfPending && (
            <p className="inline-note">
              PDF totals appear after server validation.
            </p>
          )}
          <Status error={error || countError} />
          <div className="price-note">
            <span>Platform fee</span>
            <strong>Rs. 0</strong>
          </div>
          <p className="summary-explainer">
            Printers set their own prices. You’ll see the full total before
            choosing an offer.
          </p>
          {q.data ? (
            q.data.user.display_name && q.data.user.contact_phone ? (
              <button
                className="button button-orange full-width"
                disabled={busy || !!countError}
                onClick={submit}
              >
                {busy ? (
                  <>
                    <LoaderCircle size={17} className="spin" />
                    {progress || "Saving…"}
                  </>
                ) : (
                  <>
                    Upload & review <ArrowRight size={17} />
                  </>
                )}
              </button>
            ) : (
              <Link
                className="button button-orange full-width"
                href="/onboarding"
              >
                Add contact details <ArrowRight size={17} />
              </Link>
            )
          ) : (
            <Link
              className="button button-orange full-width"
              href="/login?next=/requests/new"
            >
              Sign in to continue <ArrowRight size={17} />
            </Link>
          )}
          {q.error && q.code !== "AUTH_REQUIRED" && <Status error={q.error} />}
          <p className="inline-note">
            Uploading saves a private draft. You review and consent before
            posting it to printers.
          </p>
          {savedId && (
            <Link className="text-link space-top" href={"/requests/" + savedId}>
              Open saved draft <ArrowRight size={14} />
            </Link>
          )}
        </div>
        <div className="privacy-note">
          <ShieldCheck size={22} />
          <div>
            <strong>You’re in control.</strong>
            <p>
              Posting lets eligible approved printers review your files. Your
              exact address and phone go only to the printer you choose.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}

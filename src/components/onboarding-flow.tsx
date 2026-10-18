"use client";
import { useEffect, useState, useRef } from "react";
import { LocationFields } from "./location-fields";
import { useRouter } from "next/navigation";
import { ArrowRight, Upload, Layers3, MapPin, ShieldCheck } from "lucide-react";
import { api } from "@/lib/marketplace/client";
import { Status, useData } from "./marketplace-client";
import type { Session } from "@/lib/marketplace/types";
const draftKey = "printnow-onboarding";
const empty = {
  name: "",
  phone: "",
  mode: "pickup",
  address: "",
  landmark: "",
  lat: "",
  lng: "",
};
export function OnboardingFlow() {
  const q = useData<Session>("session");
  const router = useRouter();
  const [draft, setDraft] = useState(empty);
  const initialized = useRef(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        const saved = sessionStorage.getItem(draftKey);
        if (saved) {
          initialized.current = true;
          const value = JSON.parse(saved);
          if (value && typeof value === "object")
            setDraft({
              ...empty,
              ...Object.fromEntries(
                Object.keys(empty).map((key) => [
                  key,
                  typeof value[key] === "string"
                    ? value[key].slice(0, 1000)
                    : empty[key as keyof typeof empty],
                ]),
              ),
            });
        }
        if (sessionStorage.getItem("printnow-intro-seen")) setStep(3);
      } catch {
        sessionStorage.removeItem(draftKey);
      }
    });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!q.data) return;
    queueMicrotask(() => {
      if (initialized.current) return;
      initialized.current = true;
      setDraft({
        name: q.data!.user.display_name,
        phone: q.data!.user.contact_phone ?? "",
        mode: q.data!.user.preferred_fulfillment ?? "pickup",
        address: q.data!.address?.full_address ?? "",
        landmark: q.data!.address?.landmark ?? "",
        lat: q.data!.address?.lat?.toString() ?? "",
        lng: q.data!.address?.lng?.toString() ?? "",
      });
    });
  }, [q.data]);
  const intro = [
    {
      icon: Upload,
      title: "Your files, ready for a fresh start.",
      text: "Upload PDFs, PNGs or JPEGs and choose exactly how you want them printed.",
    },
    {
      icon: Layers3,
      title: "A few offers. One good choice.",
      text: "Approved local printers send complete offers. Each is valid for five minutes. You choose who gets the job.",
    },
    {
      icon: MapPin,
      title: "From their printer to your hands.",
      text: "Choose pickup or printer-arranged delivery. Pay the printer directly, with no platform order fee.",
    },
  ];
  const goForm = () => {
    sessionStorage.setItem("printnow-intro-seen", "1");
    setStep(3);
  };
  if (step < 3) {
    const slide = intro[step];
    const Icon = slide.icon;
    return (
      <section className="panel onboarding-intro">
        <div className="eyebrow">A SMALL ERRAND, MADE EASIER</div>
        <span className="intro-icon">
          <Icon size={45} />
        </span>
        <h1>{slide.title}</h1>
        <p>{slide.text}</p>
        <div className="intro-dots">
          {intro.map((_, i) => (
            <span key={i} className={i === step ? "active" : ""} />
          ))}
        </div>
        <div className="action-row">
          <button className="text-button" onClick={goForm}>
            Skip intro
          </button>
          <button
            className="button button-orange"
            onClick={() => (step === 2 ? goForm() : setStep(step + 1))}
          >
            {step === 2 ? "Let’s get started" : "Next"} <ArrowRight size={16} />
          </button>
        </div>
      </section>
    );
  }
  return (
    <section className="panel narrow-panel">
      <div className="eyebrow">A FEW DETAILS, THEN YOU’RE OFF</div>
      <h1>Where should your prints go?</h1>
      <p className="body-copy">
        Choose pickup or add a default delivery address. You can enter
        everything manually; location permission isn’t required.
      </p>
      <form
        className="auth-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          setBusy(true);
          try {
            if (!q.data) {
              if (q.code !== "AUTH_REQUIRED")
                throw new Error(
                  "Account services are temporarily unavailable. Try again shortly.",
                );
              sessionStorage.setItem(draftKey, JSON.stringify(draft));
              router.push("/login?next=/onboarding");
              return;
            }
            await api("onboard", draft);
            sessionStorage.removeItem(draftKey);
            router.push("/requests/new");
            router.refresh();
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Your name
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            required
            minLength={2}
            maxLength={100}
            autoComplete="name"
          />
        </label>
        <label>
          Contact phone
          <input
            value={draft.phone}
            onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
            type="tel"
            required
            minLength={7}
            maxLength={25}
            autoComplete="tel"
          />
        </label>
        <div className="segmented">
          <button
            type="button"
            className={draft.mode === "pickup" ? "selected" : ""}
            onClick={() => setDraft({ ...draft, mode: "pickup" })}
          >
            I’ll use shop pickup
          </button>
          <button
            type="button"
            className={draft.mode === "delivery" ? "selected" : ""}
            onClick={() => setDraft({ ...draft, mode: "delivery" })}
          >
            Deliver to me
          </button>
        </div>
        {draft.mode === "delivery" && (
          <>
            <label>
              Default delivery address
              <textarea
                value={draft.address}
                onChange={(e) =>
                  setDraft({ ...draft, address: e.target.value })
                }
                required
                minLength={5}
                maxLength={1000}
                autoComplete="street-address"
              />
            </label>
            <label>
              Landmark (optional)
              <input
                value={draft.landmark}
                onChange={(e) =>
                  setDraft({ ...draft, landmark: e.target.value })
                }
                maxLength={300}
              />
            </label>
          </>
        )}
        <LocationFields
          value={{ lat: draft.lat, lng: draft.lng }}
          onChange={(point) => setDraft({ ...draft, ...point })}
        />
        <p className="inline-note">
          <ShieldCheck size={15} />
          Your phone is a contact number. We won’t present it as verified.
        </p>
        <Status error={error} />
        <div className="action-row">
          <button
            className="text-button"
            type="button"
            onClick={() => {
              sessionStorage.removeItem(draftKey);
              router.push("/");
            }}
          >
            Discard setup
          </button>
          <button
            className="button button-orange"
            disabled={busy || (!q.data && !q.error)}
          >
            {q.data ? "Save & continue" : "Continue to sign in"}{" "}
            <ArrowRight size={16} />
          </button>
        </div>
        <p className="inline-note">
          Unsubmitted details stay in this tab during sign-in. They’re saved to
          your account only when you confirm.
        </p>
      </form>
    </section>
  );
}

"use client";
import { useState } from "react";
import { MapPin } from "lucide-react";
export interface Coordinates {
  lat: string;
  lng: string;
}
export function LocationFields({
  value,
  onChange,
}: {
  value: Coordinates;
  onChange: (value: Coordinates) => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <fieldset className="location-fields">
      <legend>Location pin (optional)</legend>
      <p className="inline-note">
        Use your location or enter coordinates manually. You can continue with a
        service area if you prefer.
      </p>
      <button
        type="button"
        className="button button-outline"
        disabled={busy}
        onClick={() => {
          setError("");
          if (!navigator.geolocation) {
            setError(
              "Location isn’t available. Enter coordinates manually or use your service area.",
            );
            return;
          }
          setBusy(true);
          navigator.geolocation.getCurrentPosition(
            (position) => {
              onChange({
                lat: position.coords.latitude.toFixed(6),
                lng: position.coords.longitude.toFixed(6),
              });
              setBusy(false);
            },
            () => {
              setError(
                "Location access wasn’t available. You can enter coordinates manually or continue without a pin.",
              );
              setBusy(false);
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
          );
        }}
      >
        <MapPin size={15} />
        {busy ? "Finding your location…" : "Use my current location"}
      </button>
      <div className="settings-grid auth-form">
        <label>
          Latitude
          <input
            type="number"
            step="any"
            min={-90}
            max={90}
            value={value.lat}
            placeholder="e.g. 31.5204"
            onChange={(e) => onChange({ ...value, lat: e.target.value })}
          />
        </label>
        <label>
          Longitude
          <input
            type="number"
            step="any"
            min={-180}
            max={180}
            value={value.lng}
            placeholder="e.g. 74.3587"
            onChange={(e) => onChange({ ...value, lng: e.target.value })}
          />
        </label>
      </div>
      {error && (
        <p className="inline-note" role="status">
          {error}
        </p>
      )}
    </fieldset>
  );
}

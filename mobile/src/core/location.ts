export function optionalPoint(latitude: string, longitude: string) {
  if (!latitude.trim() && !longitude.trim()) return null;
  const lat = Number(latitude),
    lng = Number(longitude);
  if (
    !latitude.trim() ||
    !longitude.trim() ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  )
    throw new Error(
      "Enter a valid latitude and longitude, or leave both blank.",
    );
  return { lat, lng };
}

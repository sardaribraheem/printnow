export function authConfiguration() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || key.startsWith("sb_secret_")) return null;
  try {
    if (
      new URL(url).protocol !== "https:" &&
      !url.startsWith("http://127.0.0.1:")
    )
      return null;
  } catch {
    return null;
  }
  return { url, key };
}
export function siteOrigin() {
  const value =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NODE_ENV === "development"
        ? "http://localhost:3000"
        : null);
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" &&
      !(process.env.NODE_ENV !== "production" && url.hostname === "localhost")
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}
export function safeReturnPath(path: string | null | undefined) {
  const allowed = [
    "/",
    "/history",
    "/requests/new",
    "/printers/apply",
    "/printer",
    "/admin",
    "/onboarding",
  ];
  return path &&
    (allowed.includes(path) ||
      /^\/(requests|orders)\/[0-9a-f-]{36}$/.test(path))
    ? path
    : "/";
}

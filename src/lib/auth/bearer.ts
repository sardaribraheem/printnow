export function bearerToken(headers: Headers): string | null {
  const value = headers.get("authorization");
  if (!value || value.length > 8192) return null;
  const match =
    /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(value);
  return match?.[1] ?? null;
}

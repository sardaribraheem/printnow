export function isLocalDatabase(
  url: string | undefined,
  nodeEnvironment: string | undefined,
) {
  if (nodeEnvironment !== "development" || !url) return false;
  try {
    const parsed = new URL(url);
    return (
      ["postgres:", "postgresql:"].includes(parsed.protocol) &&
      ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)
    );
  } catch {
    return false;
  }
}

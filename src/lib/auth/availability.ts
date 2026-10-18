import "server-only";
import { authConfiguration } from "./config";
import { parseAuthMethods, unavailableAuthMethods } from "./methods";
export async function availableAuthMethods() {
  const config = authConfiguration();
  if (!config) return unavailableAuthMethods;
  try {
    const response = await fetch(`${config.url}/auth/v1/settings`, {
      headers: { apikey: config.key },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return unavailableAuthMethods;
    return parseAuthMethods(await response.json());
  } catch {
    return unavailableAuthMethods;
  }
}

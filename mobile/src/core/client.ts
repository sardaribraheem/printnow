import "react-native-url-polyfill/auto";
import { createClient, processLock } from "@supabase/supabase-js";
import { File } from "expo-file-system";
import { fetch as expoFetch } from "expo/fetch";
import { secureStorage } from "./secure-storage";
import type { SelectedFile } from "../navigation";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const origin = process.env.EXPO_PUBLIC_API_URL ?? "";
function https(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}
export const configured =
  https(url) && key.startsWith("sb_publishable_") && https(origin);
export const apiOrigin = https(origin) ? new URL(origin).origin : "";
export const supabase = configured
  ? createClient(url, key, {
      auth: {
        storage: secureStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: "pkce",
        lock: processLock,
      },
    })
  : null;
export async function accessToken() {
  if (!supabase)
    throw new Error("Live sign-in is not enabled in this preview build.");
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error("Please sign in to continue.");
  return data.session.access_token;
}
export async function request<T>(path: string, input?: unknown): Promise<T> {
  const token = await accessToken();
  const response = await fetch(apiOrigin + "/api/mobile/v1/" + path, {
    method: input === undefined ? "GET" : "POST",
    headers: {
      Authorization: "Bearer " + token,
      ...(input === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: input === undefined ? undefined : JSON.stringify(input),
  });
  const data = await response.json();
  if (!response.ok)
    throw Object.assign(
      new Error(
        data.message ?? "The service is unavailable. Please try again.",
      ),
      { code: data.error },
    );
  return data;
}
export async function upload(
  requestId: string,
  file: SelectedFile,
  registeredId?: string,
  uploadKey?: string,
) {
  const metadata = await request<{
    id: string;
    upload_url?: string;
    already_finalized?: boolean;
  }>("uploads", {
    request_id: requestId,
    name: file.name,
    bytes: file.size,
    client_key: uploadKey,
    ...(registeredId ? { file_id: registeredId } : {}),
  });
  if (metadata.already_finalized) return metadata.id;
  if (!metadata.upload_url) throw new Error("Unable to authorize this upload.");
  const target = new URL(metadata.upload_url);
  if (target.protocol !== "https:" || target.origin !== new URL(url).origin)
    throw new Error("The upload destination is invalid.");
  try {
    const response = await expoFetch(metadata.upload_url, {
      method: "PUT",
      body: new File(file.uri),
      headers: { "Content-Type": file.mimeType },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (
        !["Duplicate", "ResourceAlreadyExists"].includes(
          error.error ?? error.code,
        )
      )
        throw new Error("Upload failed. Retry while this screen is open.");
    }
    await request("marketplace/finalize_file", { id: metadata.id });
    return metadata.id;
  } catch (error) {
    throw Object.assign(
      error instanceof Error ? error : new Error("Upload interrupted."),
      { registeredId: metadata.id },
    );
  }
}
export async function authMethods() {
  if (!configured) return { google: false };
  try {
    const response = await fetch(url + "/auth/v1/settings", {
      headers: { apikey: key },
    });
    if (!response.ok) return { google: false };
    const data = await response.json();
    return { google: data.external?.google === true };
  } catch {
    return { google: false };
  }
}
const exchangedCodes = new Map<string, Promise<void>>();
export async function finishAuthUrl(value: string) {
  if (!supabase) return null;
  const parsed = new URL(value);
  if (
    parsed.protocol !== "printnow:" ||
    parsed.host !== "auth" ||
    !["/callback", "/reset"].includes(parsed.pathname)
  )
    return null;
  const code = parsed.searchParams.get("code");
  if (!code) return null;
  let pending = exchangedCodes.get(code);
  if (!pending) {
    pending = supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error)
        throw new Error(
          "The sign-in link is invalid or expired. Please try again.",
        );
    });
    exchangedCodes.set(code, pending);
    setTimeout(() => exchangedCodes.delete(code), 60000);
  }
  await pending;
  return { recovery: parsed.pathname === "/reset" };
}

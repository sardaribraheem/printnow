import "server-only";
import { createClient } from "@supabase/supabase-js";
import { authConfiguration } from "@/lib/auth/config";
import { bearerToken } from "@/lib/auth/bearer";
import { AppError } from "@/lib/marketplace/server";

// Mobile requests never use browser cookies or the local sample-account adapter.
export async function mobileActor(request: Request) {
  const token = bearerToken(request.headers);
  if (!token) throw new AppError("AUTH_REQUIRED", 401);
  const config = authConfiguration();
  if (!config) throw new AppError("SERVICE_UNAVAILABLE", 503);
  const client = createClient(config.url, config.key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new AppError("AUTH_REQUIRED", 401);
  return {
    id: data.user.id,
    client,
    async rpc(kind: "read" | "mutate", operation: string, input?: unknown) {
      const { data, error } = await client.rpc(
        kind === "read" ? "marketplace_read" : "marketplace_mutate",
        kind === "read"
          ? { p_kind: operation, p_id: input ?? null }
          : { p_action: operation, p_input: input ?? {} },
      );
      if (error) {
        const code =
          error.code === "P0001" && /^[A-Z_]+$/.test(error.message)
            ? error.message
            : "SERVICE_UNAVAILABLE";
        if (
          error.code?.startsWith("22") ||
          ["23502", "23514"].includes(error.code)
        )
          throw new AppError("INVALID_INPUT", 400);
        throw new AppError(
          code,
          code === "FORBIDDEN"
            ? 403
            : code === "NOT_FOUND"
              ? 404
              : code === "SERVICE_UNAVAILABLE"
                ? 503
                : 409,
        );
      }
      return data;
    },
  };
}

export const mobileReads = new Set([
  "session",
  "history",
  "feed",
  "request",
  "order",
  "notifications",
  "messages",
]);
export const mobileWrites = new Set([
  "onboard",
  "forget_address",
  "apply_provider",
  "provider_settings",
  "clarify",
  "create_request",
  "finalize_file",
  "edit_request",
  "remove_file",
  "publish",
  "cancel_request",
  "offer",
  "accept",
  "withdraw",
  "decline",
  "transition",
  "message",
  "mark_order_read",
  "payment",
  "issue",
  "notification_read",
]);

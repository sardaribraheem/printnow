import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/lib/auth/server";
import { localMode, localRpc, sandboxAccounts } from "./local";
export class AppError extends Error {
  constructor(
    public code: string,
    public status = 400,
  ) {
    super(code);
  }
}
export async function actorId() {
  if (localMode()) {
    const id = (await cookies()).get("printnow_sandbox")?.value;
    return sandboxAccounts.some((a) => a.id === id) ? id! : null;
  }
  const client = await createClient();
  if (!client) return null;
  const {
    data: { user },
  } = await client.auth.getUser();
  return user?.id ?? null;
}
export async function marketplace<T = unknown>(
  kind: "read" | "mutate",
  operation: string,
  input?: unknown,
): Promise<T> {
  const actor = await actorId();
  if (!actor) throw new AppError("AUTH_REQUIRED", 401);
  try {
    if (localMode())
      return await localRpc(
        actor,
        kind === "read" ? "marketplace_read" : "marketplace_mutate",
        [
          operation,
          kind === "read" ? (input ?? null) : JSON.stringify(input ?? {}),
        ],
      );
    const client = await createClient();
    if (!client) throw new AppError("SERVICE_UNAVAILABLE", 503);
    const { data, error } = await client.rpc(
      kind === "read" ? "marketplace_read" : "marketplace_mutate",
      kind === "read"
        ? { p_kind: operation, p_id: input ?? null }
        : { p_action: operation, p_input: input ?? {} },
    );
    if (error) throw error;
    return data;
  } catch (error) {
    if (error instanceof AppError) throw error;
    const e = error as { message?: string; code?: string };
    const code =
      e.code === "P0001" && e.message && /^[A-Z_]+$/.test(e.message)
        ? e.message
        : "SERVICE_UNAVAILABLE";
    if (e.code?.startsWith("22") || ["23502", "23514"].includes(e.code ?? ""))
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
}
export const errorMessages: Record<string, string> = {
  AUTH_REQUIRED: "Please sign in to continue.",
  PROFILE_REQUIRED: "Add your name and contact details first.",
  PROVIDER_PENDING:
    "Your provider account needs approval before receiving requests.",
  PROVIDER_SETUP_REQUIRED:
    "Complete hours, capabilities and service zone before approval.",
  FORBIDDEN: "You don’t have access to this action.",
  FILE_PROCESSING:
    "This file is still being checked. Please wait before removing it.",
  INVALID_LOCATION: "Enter both latitude and longitude, or leave both blank.",
  FILE_NOT_READY: "Wait for all files to finish validation.",
  REQUEST_CLOSED: "This request is no longer open.",
  OFFER_EXPIRED: "This offer expired. Ask for a new offer.",
  OFFER_WITHDRAWN: "This offer is no longer available.",
  REQUEST_ALREADY_MATCHED:
    "An offer has already been accepted for this request.",
  REVISION_CHANGED: "This page changed. Refresh and try again.",
  OFFER_WINDOW_TOO_SHORT:
    "Less than five minutes remain. Ask the customer to repost.",
  DEADLINE_UNACHIEVABLE:
    "The completion time would miss the requested deadline.",
  INVALID_PAGES: "Check your selected page ranges.",
  LIMIT_EXCEEDED: "This exceeds the pilot file or print limit.",
  INVALID_DELIVERY_PRICE: "Pickup offers must have zero delivery cost.",
  CANCELLATION_REQUIRES_SUPPORT:
    "Printing has started. Contact support to request cancellation.",
  INVALID_TRANSITION: "That status change is not available.",
  MFA_REQUIRED: "Admin access requires multi-factor authentication.",
  RATE_LIMITED: "Too many requests. Please try again shortly.",
  SERVICE_UNAVAILABLE:
    "The service is temporarily unavailable. Please try again.",
  REASON_REQUIRED: "Please provide a reason of at least five characters.",
  IDEMPOTENCY_CONFLICT:
    "This retry has different details. Refresh before trying again.",
};
export function errorResponse(error: unknown) {
  const e =
    error instanceof AppError
      ? error
      : new AppError("SERVICE_UNAVAILABLE", 503);
  return Response.json(
    {
      error: e.code,
      message: errorMessages[e.code] ?? "Check the details and try again.",
    },
    { status: e.status, headers: { "Cache-Control": "private, no-store" } },
  );
}
export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  try {
    const source = new URL(origin ?? "");
    if (
      !host ||
      source.host !== host ||
      !["http:", "https:"].includes(source.protocol)
    )
      throw new Error();
  } catch {
    throw new AppError("FORBIDDEN", 403);
  }
}
export async function readJson(request: Request, limit = 32768) {
  if (Number(request.headers.get("content-length") ?? 0) > limit)
    throw new AppError("LIMIT_EXCEEDED", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new AppError("INVALID_INPUT");
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > limit) {
      await reader.cancel();
      throw new AppError("LIMIT_EXCEEDED", 413);
    }
    chunks.push(value);
  }
  try {
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new AppError("INVALID_INPUT");
  }
}

import { z } from "zod";
import {
  marketplace,
  errorResponse,
  requireSameOrigin,
  AppError,
  readJson,
} from "@/lib/marketplace/server";
export const dynamic = "force-dynamic";
const reads = new Set([
  "messages",
  "case",
  "session",
  "history",
  "feed",
  "request",
  "order",
  "notifications",
  "admin",
]);
const writes = new Set([
  "apply_provider",
  "clarify",
  "mark_order_read",
  "forget_address",
  "notification_read",
  "remove_file",
  "onboard",
  "provider_settings",
  "create_request",
  "register_file",
  "finalize_file",
  "edit_request",
  "cancel_request",
  "publish",
  "offer",
  "accept",
  "withdraw",
  "decline",
  "transition",
  "message",
  "payment",
  "issue",
  "admin_provider",
  "admin_resolve",
  "admin_zone",
]);
export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const [kind, id] = (await params).path;
    if (!reads.has(kind)) throw new AppError("NOT_FOUND", 404);
    if (id && !z.uuid().safeParse(id).success)
      throw new AppError("NOT_FOUND", 404);
    let operation = kind;
    if (kind === "messages") {
      const params = new URL(request.url).searchParams;
      const before = params.get("before"),
        cursor = params.get("cursor");
      if (
        !before ||
        before.length > 50 ||
        Number.isNaN(Date.parse(before)) ||
        !z.uuid().safeParse(cursor).success
      )
        throw new AppError("INVALID_INPUT");
      operation = `messages|${before}|${cursor}`;
    }
    const data = await marketplace("read", operation, id);
    return Response.json(data, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    requireSameOrigin(request);
    const [action] = (await params).path;
    if (!writes.has(action)) throw new AppError("NOT_FOUND", 404);
    const input = await readJson(request);
    if (typeof input !== "object" || input === null || Array.isArray(input))
      throw new AppError("INVALID_INPUT");
    return Response.json(await marketplace("mutate", action, input), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

import { z } from "zod";
import { mobileActor, mobileReads, mobileWrites } from "@/lib/mobile/server";
import { AppError, errorResponse, readJson } from "@/lib/marketplace/server";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const actor = await mobileActor(request);
    const path = (await params).path;
    const [kind, id] = path;
    if (
      path.length > 2 ||
      !mobileReads.has(kind) ||
      (id && !z.uuid().safeParse(id).success)
    )
      throw new AppError("NOT_FOUND", 404);
    let operation = kind;
    if (kind === "messages") {
      if (!id) throw new AppError("INVALID_INPUT");
      const search = new URL(request.url).searchParams;
      const before = search.get("before"),
        cursor = search.get("cursor");
      if (
        !before ||
        before.length > 50 ||
        Number.isNaN(Date.parse(before)) ||
        !z.uuid().safeParse(cursor).success
      )
        throw new AppError("INVALID_INPUT");
      operation = `messages|${before}|${cursor}`;
    }
    return Response.json(await actor.rpc("read", operation, id), {
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
    const actor = await mobileActor(request);
    const path = (await params).path;
    if (path.length !== 1 || !mobileWrites.has(path[0]))
      throw new AppError("NOT_FOUND", 404);
    const input = await readJson(request);
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw new AppError("INVALID_INPUT");
    return Response.json(await actor.rpc("mutate", path[0], input), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

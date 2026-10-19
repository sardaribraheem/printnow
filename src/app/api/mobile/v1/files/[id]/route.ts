import { z } from "zod";
import { mobileActor } from "@/lib/mobile/server";
import { privilegedStorage } from "@/lib/marketplace/storage";
import { AppError, errorResponse } from "@/lib/marketplace/server";
import { byteRange } from "@/lib/domain/ranges";
export const dynamic = "force-dynamic";
export async function HEAD(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await mobileActor(request);
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) throw new AppError("NOT_FOUND", 404);
    await actor.rpc("mutate", "file_access", { id });
    return new Response(null, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await mobileActor(request);
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) throw new AppError("NOT_FOUND", 404);
    await actor.rpc("mutate", "file_access", { id });
    const storage = privilegedStorage();
    const { data: file, error } = await storage
      .from("request_files")
      .select("original_name,preview_key,derivative_key")
      .eq("id", id)
      .single();
    if (error || !file) throw new AppError("NOT_FOUND", 404);
    const preview = new URL(request.url).searchParams.get("preview") === "1";
    const key = preview ? file.preview_key : file.derivative_key;
    if (!key) throw new AppError("FILE_NOT_READY");
    const { data, error: downloadError } = await storage.storage
      .from("print-previews")
      .download(key);
    if (downloadError || !data) throw new AppError("FILE_NOT_READY");
    const bytes = new Uint8Array(await data.arrayBuffer());
    const headers = new Headers({
      "Content-Type": preview ? "image/png" : "application/pdf",
      "Cache-Control": "private, no-store",
      "Accept-Ranges": "bytes",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(String(file.original_name).replace(/\.[^.]+$/, "") + (preview ? ".png" : ".pdf"))}`,
    });
    let range;
    try {
      range = byteRange(request.headers.get("range"), bytes.length);
    } catch {
      headers.set("Content-Range", `bytes */${bytes.length}`);
      return new Response(null, { status: 416, headers });
    }
    if (range) {
      headers.set(
        "Content-Range",
        `bytes ${range.start}-${range.end}/${bytes.length}`,
      );
      return new Response(bytes.slice(range.start, range.end + 1), {
        status: 206,
        headers,
      });
    }
    return new Response(bytes, { headers });
  } catch (error) {
    return errorResponse(error);
  }
}

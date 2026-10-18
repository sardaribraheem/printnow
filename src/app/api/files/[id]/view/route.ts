import { marketplace, errorResponse } from "@/lib/marketplace/server";
import { fileRecord, fileBytes } from "@/lib/marketplace/storage";
import { byteRange } from "@/lib/domain/ranges";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await marketplace("mutate", "file_access", {
      id,
      case_id: new URL(request.url).searchParams.get("case"),
    });
    const file = await fileRecord(id);
    const preview = new URL(request.url).searchParams.get("preview") === "1";
    const bytes = await fileBytes(file, preview);
    const headers = new Headers({
      "Content-Type": preview ? "image/png" : "application/pdf",
      "Cache-Control": "private, no-store",
      "Accept-Ranges": "bytes",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.original_name.replace(/\.[^.]+$/, "") + ".pdf")}`,
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
      headers.set("Content-Length", String(range.end - range.start + 1));
      return new Response(
        new Uint8Array(bytes.subarray(range.start, range.end + 1)),
        { status: 206, headers },
      );
    }
    headers.set("Content-Length", String(bytes.length));
    return new Response(new Uint8Array(bytes), { headers });
  } catch (error) {
    return errorResponse(error);
  }
}

import { saveLocalUpload } from "@/lib/marketplace/storage";
import {
  requireSameOrigin,
  errorResponse,
  AppError,
} from "@/lib/marketplace/server";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireSameOrigin(request);
    const length = Number(request.headers.get("content-length") ?? 0);
    if (length <= 0 || length > 25 * 1024 * 1024)
      throw new AppError("LIMIT_EXCEEDED", 413);
    const bytes = Buffer.from(await request.arrayBuffer());
    if (bytes.length > 25 * 1024 * 1024)
      throw new AppError("LIMIT_EXCEEDED", 413);
    await saveLocalUpload((await params).id, bytes);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

import { z } from "zod";
import {
  marketplace,
  requireSameOrigin,
  errorResponse,
  AppError,
  actorId,
  readJson,
} from "@/lib/marketplace/server";
import { localMode } from "@/lib/marketplace/local";
import { createClient } from "@/lib/auth/server";
import { uploadKind } from "@/lib/domain/printing";
const input = z.object({
  request_id: z.uuid(),
  name: z.string().min(1).max(255),
  bytes: z
    .number()
    .int()
    .min(1)
    .max(25 * 1024 * 1024),
});
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const parsed = input.safeParse(await readJson(request));
    if (!parsed.success) throw new AppError("INVALID_FILE");
    const data = parsed.data;
    const kind = uploadKind(data.name);
    if (!kind) throw new AppError("INVALID_FILE");
    const file = await marketplace<{ id: string }>("mutate", "register_file", {
      id: data.request_id,
      name: data.name,
      bytes: data.bytes,
      kind,
    });
    if (localMode())
      return Response.json({
        id: file.id,
        upload_url: `/api/files/${file.id}/upload`,
        local: true,
      });
    const client = await createClient();
    if (!client) throw new AppError("AUTH_REQUIRED", 401);
    const key = `${await actorId()}/${data.request_id}/${file.id}.original`;
    const { data: signed, error } = await client.storage
      .from("print-originals")
      .createSignedUploadUrl(key);
    if (error || !signed) throw new AppError("SERVICE_UNAVAILABLE", 503);
    return Response.json({
      id: file.id,
      upload_url: signed.signedUrl,
      local: false,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

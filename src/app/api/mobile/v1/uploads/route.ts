import { z } from "zod";
import { mobileActor } from "@/lib/mobile/server";
import { AppError, errorResponse, readJson } from "@/lib/marketplace/server";
import { uploadKind, UPLOAD_LIMITS } from "@/lib/domain/printing";
const schema = z.object({
  request_id: z.uuid(),
  file_id: z.uuid().optional(),
  client_key: z.uuid().optional(),
  name: z.string().min(1).max(255),
  bytes: z.number().int().min(1).max(UPLOAD_LIMITS.fileBytes),
});
export async function POST(request: Request) {
  try {
    const actor = await mobileActor(request);
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) throw new AppError("INVALID_FILE");
    const { request_id, file_id, client_key, name, bytes } = parsed.data;
    const kind = uploadKind(name);
    if (!kind) throw new AppError("INVALID_FILE");
    let file: { id: string; already_finalized?: boolean };
    if (file_id && !client_key) {
      const draft = await actor.rpc("read", "request", request_id);
      const existing = draft.files?.find(
        (item: { id: string; name: string; bytes: number; state: string }) =>
          item.id === file_id &&
          item.name === name &&
          item.bytes === bytes &&
          item.state === "pending",
      );
      if (!draft.mine || draft.state !== "draft" || !existing)
        throw new AppError("FORBIDDEN", 403);
      file = { id: file_id };
    } else
      file = await actor.rpc("mutate", "register_file", {
        id: request_id,
        name,
        bytes,
        kind,
        client_key,
      });
    if (file.already_finalized)
      return Response.json(
        { id: file.id, already_finalized: true },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    const key = `${actor.id}/${request_id}/${file.id}.original`;
    const { data, error } = await actor.client.storage
      .from("print-originals")
      .createSignedUploadUrl(key);
    if (error || !data) throw new AppError("SERVICE_UNAVAILABLE", 503);
    return Response.json(
      {
        id: file.id,
        upload_url: data.signedUrl,
        path: data.path,
        token: data.token,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

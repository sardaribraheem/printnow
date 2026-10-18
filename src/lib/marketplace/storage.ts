import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname, sep } from "node:path";
import { localMode, localPool } from "./local";
import { AppError, actorId, marketplace } from "./server";
import type { FileRecord } from "./types";
export function privilegedStorage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.PRINTNOW_SUPABASE_SERVER_KEY;
  if (!url || !key) throw new AppError("SERVICE_UNAVAILABLE", 503);
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export function privatePath(bucket: string, key: string) {
  const root = resolve(
    process.env.PRINTNOW_LOCAL_FILES_ROOT ?? ".printnow-files",
    bucket,
  );
  const path = resolve(root, key);
  if (!path.startsWith(root + sep)) throw new AppError("FORBIDDEN", 403);
  return path;
}
export async function fileRecord(id: string): Promise<FileRecord> {
  if (localMode()) {
    const result = await localPool().query(
      "select * from public.request_files where id=$1",
      [id],
    );
    if (!result.rows[0]) throw new AppError("NOT_FOUND", 404);
    return result.rows[0];
  }
  const { data, error } = await privilegedStorage()
    .from("request_files")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) throw new AppError("NOT_FOUND", 404);
  return data;
}
export async function saveLocalUpload(id: string, buffer: Buffer) {
  if (!localMode()) throw new AppError("NOT_FOUND", 404);
  const actor = await actorId();
  const file = await fileRecord(id);
  if (!actor || file.owner_id !== actor) throw new AppError("FORBIDDEN", 403);
  const request = await marketplace<{ state: string }>(
    "read",
    "request",
    file.request_id,
  );
  if (request.state !== "draft" || file.processing_state !== "pending")
    throw new AppError("REQUEST_CLOSED");
  if (buffer.length !== file.byte_count) throw new AppError("INVALID_FILE");
  const path = privatePath("print-originals", file.object_key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, buffer, { flag: "wx", mode: 0o600 });
}
export async function fileBytes(file: FileRecord, preview = false) {
  const key = preview ? file.preview_key : file.derivative_key;
  if (!key) throw new AppError("FILE_NOT_READY");
  if (localMode()) return readFile(privatePath("print-previews", key));
  const { data, error } = await privilegedStorage()
    .storage.from("print-previews")
    .download(key);
  if (error || !data) throw new AppError("FILE_NOT_READY");
  return Buffer.from(await data.arrayBuffer());
}

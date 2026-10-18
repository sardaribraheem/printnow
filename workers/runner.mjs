import { Pool } from "pg";
import { createClient } from "@supabase/supabase-js";
import {
  mkdtemp,
  readFile,
  writeFile,
  mkdir,
  rm,
  copyFile,
} from "node:fs/promises";
import { join, dirname, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const run = promisify(execFile);
const local =
  process.env.NODE_ENV !== "production" &&
  !!process.env.PRINTNOW_LOCAL_DATABASE_URL &&
  ["127.0.0.1", "localhost", "[::1]"].includes(
    new URL(process.env.PRINTNOW_LOCAL_DATABASE_URL).hostname,
  );
const pool = local
  ? new Pool({
      connectionString: process.env.PRINTNOW_LOCAL_DATABASE_URL,
      max: 2,
    })
  : null;
const supabase = local
  ? null
  : createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.PRINTNOW_SUPABASE_SERVER_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
async function rpc(action, input = {}) {
  if (pool) {
    const c = await pool.connect();
    try {
      await c.query("begin");
      await c.query("set local role service_role");
      const r = await c.query(
        "select public.marketplace_worker($1,$2::jsonb) data",
        [action, JSON.stringify(input)],
      );
      await c.query("commit");
      return r.rows[0].data;
    } catch (e) {
      await c.query("rollback");
      throw e;
    } finally {
      c.release();
    }
  }
  const { data, error } = await supabase.rpc("marketplace_worker", {
    p_action: action,
    p_input: input,
  });
  if (error) throw error;
  return data;
}
function path(bucket, key) {
  const root = resolve(
    process.env.PRINTNOW_LOCAL_FILES_ROOT ?? ".printnow-files",
    bucket,
  );
  const file = resolve(root, key);
  if (!file.startsWith(root + sep)) throw new Error("BAD_OBJECT_KEY");
  return file;
}
async function download(bucket, key) {
  if (local) return readFile(path(bucket, key));
  const { data, error } = await supabase.storage.from(bucket).download(key);
  if (error) throw error;
  return Buffer.from(await data.arrayBuffer());
}
async function upload(key, file, type) {
  if (local) {
    const dest = path("print-previews", key);
    await mkdir(dirname(dest), { recursive: true });
    await copyFile(file, dest);
    return;
  }
  const { error } = await supabase.storage
    .from("print-previews")
    .upload(key, await readFile(file), { contentType: type, upsert: false });
  if (error) throw error;
}
async function remove(bucket, keys) {
  keys = keys.filter(Boolean);
  if (!keys.length) return;
  if (local) {
    for (const key of keys) await rm(path(bucket, key), { force: true });
    return;
  }
  const { error } = await supabase.storage.from(bucket).remove(keys);
  if (error) throw error;
}
let stopping = false;
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});
console.log("PrintNow file worker started.");
let tick = 0;
while (!stopping) {
  try {
    const file = await rpc("claim");
    if (file) {
      const work = await mkdtemp(join(tmpdir(), "printnow-job-"));
      try {
        const original = join(work, "original");
        await writeFile(
          original,
          await download("print-originals", file.object_key),
          { mode: 0o600 },
        );
        const { stdout } = await run(
          process.execPath,
          [
            "--max-old-space-size=256",
            join(process.cwd(), "workers/process-file.mjs"),
            original,
            work,
            file.kind,
            String(file.byte_count),
          ],
          {
            timeout: 45000,
            maxBuffer: 1024 * 1024,
            env: { PATH: process.env.PATH, LANG: "C.UTF-8" },
          },
        );
        const result = JSON.parse(stdout.trim());
        const prefix = `${file.owner_id}/${file.request_id}/${file.id}`;
        await upload(
          prefix + ".pdf",
          join(work, "print.pdf"),
          "application/pdf",
        );
        await upload(prefix + ".png", join(work, "preview.png"), "image/png");
        await rpc("ready", {
          id: file.id,
          ...result,
          derivative_key: prefix + ".pdf",
          preview_key: prefix + ".png",
        });
        console.log("File processed successfully.");
      } catch (error) {
        await rpc("failed", { id: file.id, error: error.message });
        console.error("File validation failed.");
      } finally {
        await rm(work, { recursive: true, force: true });
      }
    }
    if (tick++ % 10 === 0) {
      await rpc("sweep");
      for (let n = 0; n < 10; n++) {
        const obsolete = await rpc("retention");
        if (!obsolete) break;
        try {
          const prefix = `${obsolete.owner_id}/${obsolete.request_id}/${obsolete.id}`;
          await remove("print-originals", [obsolete.object_key]);
          await remove("print-previews", [
            obsolete.derivative_key ?? prefix + ".pdf",
            obsolete.preview_key ?? prefix + ".png",
          ]);
          await rpc("deleted", { id: obsolete.id });
        } catch {
          await rpc("retention_failed", { id: obsolete.id });
          break;
        }
      }
    }
    if (process.argv.includes("--once")) break;
    await new Promise((r) => setTimeout(r, file ? 100 : 1000));
  } catch {
    console.error("Worker operation failed; retrying shortly.");
    if (process.argv.includes("--once")) {
      process.exitCode = 1;
      break;
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
}
if (pool) await pool.end();

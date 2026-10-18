import "server-only";
import { isLocalDatabase } from "@/lib/domain/local-mode";
import { Pool } from "pg";
export const sandboxAccounts = [
  {
    id: "10000000-0000-0000-0000-000000000001",
    name: "Ayesha · customer",
    role: "customer",
  },
  {
    id: "10000000-0000-0000-0000-000000000002",
    name: "Campus Print · printer",
    role: "printer",
  },
  {
    id: "10000000-0000-0000-0000-000000000003",
    name: "Paper & Ink · printer",
    role: "printer",
  },
  {
    id: "10000000-0000-0000-0000-000000000004",
    name: "Pilot admin",
    role: "admin",
  },
] as const;
export function localMode() {
  return isLocalDatabase(
    process.env.PRINTNOW_LOCAL_DATABASE_URL,
    process.env.NODE_ENV,
  );
}
const globalPools = globalThis as unknown as { printnowPool?: Pool };
export function localPool() {
  if (!localMode()) throw new Error("LOCAL_MODE_DISABLED");
  return (globalPools.printnowPool ??= new Pool({
    connectionString: process.env.PRINTNOW_LOCAL_DATABASE_URL,
    max: 8,
  }));
}
export async function localRpc(
  actor: string,
  name: "marketplace_read" | "marketplace_mutate" | "marketplace_worker",
  args: unknown[],
  worker = false,
) {
  const client = await localPool().connect();
  try {
    await client.query("begin");
    await client.query(
      worker ? "set local role service_role" : "set local role authenticated",
    );
    await client.query(
      "select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",
      [
        actor,
        JSON.stringify({
          sub: actor,
          role: worker ? "service_role" : "authenticated",
          aal: sandboxAccounts.some((a) => a.id === actor && a.role === "admin")
            ? "aal2"
            : "aal1",
        }),
      ],
    );
    const sql =
      name === "marketplace_read"
        ? "select public.marketplace_read($1,$2) as data"
        : name === "marketplace_worker"
          ? "select public.marketplace_worker($1,$2::jsonb) as data"
          : "select public.marketplace_mutate($1,$2::jsonb) as data";
    const result = await client.query(sql, args);
    await client.query("commit");
    return result.rows[0].data;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

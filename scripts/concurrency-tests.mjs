import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
const container = process.argv[2];
if (!container) throw new Error("Container required");
const customer = "10000000-0000-0000-0000-000000000001",
  a = "10000000-0000-0000-0000-000000000002",
  b = "10000000-0000-0000-0000-000000000003";
const providerA = "30000000-0000-0000-0000-000000000001",
  providerB = "30000000-0000-0000-0000-000000000002";
function sql(text, onLine) {
  return new Promise((resolve, reject) => {
    const p = spawn("docker", [
      "exec",
      "-i",
      container,
      "psql",
      "-qAtX",
      "-U",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
    ]);
    let out = "",
      err = "";
    p.stdout.on("data", (v) => {
      out += v;
      onLine?.(v.toString());
    });
    p.stderr.on("data", (v) => (err += v));
    p.on("error", reject);
    p.on("close", (code) =>
      code === 0 ? resolve(out.trim()) : reject(new Error(err)),
    );
    p.stdin.end(text);
  });
}
function as(user, text) {
  return `set role authenticated;set request.jwt.claim.sub='${user}';${text}`;
}
function call(action, data) {
  return `select public.marketplace_mutate('${action}','${JSON.stringify(data).replaceAll("'", "''")}'::jsonb);`;
}
async function fixture() {
  const id = randomUUID(),
    offerA = randomUUID(),
    offerB = randomUUID();
  await sql(`insert into public.print_requests(id,customer_id,client_key,title,mode,urgency,zone_id,area,settings,state,published_at,expires_at,total_sides,sheets)values('${id}','${customer}','${randomUUID()}','Concurrency test','pickup','standard','20000000-0000-0000-0000-000000000001','Campus','{"size":"A4","color":"bw","copies":1,"duplex":false,"duplex_edge":"long","finishing":"loose","scaling":"fit"}','open',clock_timestamp(),clock_timestamp()+interval '2 hours',1,1);
insert into public.offers(id,request_id,revision,provider_id,client_key,print_paisa,delivery_paisa,duration_minutes,payment_method,created_at,expires_at)select v.id,'${id}',1,v.provider,'${randomUUID()}',20000,0,20,'cash',t,t+interval '5 minutes' from(values('${offerA}'::uuid,'${providerA}'::uuid),('${offerB}'::uuid,'${providerB}'::uuid))v(id,provider) cross join lateral(select clock_timestamp() t)stamp;`);
  return { id, offerA, offerB };
}
const first = await fixture();
const attempts = await Promise.allSettled([
  sql(
    as(
      customer,
      call("accept", { id: first.offerA, revision: 1, key: randomUUID() }),
    ),
  ),
  sql(
    as(
      customer,
      call("accept", { id: first.offerB, revision: 1, key: randomUUID() }),
    ),
  ),
]);
assert.equal(attempts.filter((r) => r.status === "fulfilled").length, 1);
assert.match(
  attempts.find((r) => r.status === "rejected").reason.message,
  /REQUEST_ALREADY_MATCHED/,
);
assert.equal(
  await sql(
    `select count(*) from public.orders where request_id='${first.id}'`,
  ),
  "1",
);
console.log("PASS O05: concurrent accepts create exactly one order.");
const winner = attempts[0].status === "fulfilled" ? first.offerA : first.offerB;
const original = JSON.parse(
  attempts.find((r) => r.status === "fulfilled").value,
).id;
const retry = JSON.parse(
  await sql(
    as(
      customer,
      call("accept", { id: winner, revision: 1, key: randomUUID() }),
    ),
  ),
).id;
assert.equal(retry, original);
console.log("PASS O06: retried acceptance returns the original order.");
const second = await fixture();
let releaseSignal;
const locked = new Promise((r) => (releaseSignal = r));
const held = sql(
  `begin;select 1 from public.provider_private_profiles where provider_id='${providerA}' for update;update public.offers set created_at=stamp.t-interval '4 minutes 59 seconds',expires_at=stamp.t+interval '1 second' from(select clock_timestamp() t)stamp where id='${second.offerA}';select 'LOCK_READY';select pg_sleep(1.8);commit;`,
  (chunk) => {
    if (chunk.includes("LOCK_READY")) releaseSignal();
  },
);
// The update above uses one clock value to preserve the fixed TTL constraint.
await locked;
const expiryAttempt = sql(
  as(
    customer,
    call("accept", { id: second.offerA, revision: 1, key: randomUUID() }),
  ),
);
await held;
await assert.rejects(expiryAttempt, /OFFER_EXPIRED/);
console.log(
  "PASS O04: acceptance rechecks expiry after waiting for its provider lock.",
);
const third = await fixture();
const order = JSON.parse(
  await sql(
    as(
      customer,
      call("accept", { id: third.offerA, revision: 1, key: randomUUID() }),
    ),
  ),
).id;
const transitions = await Promise.allSettled([
  sql(
    as(
      customer,
      call("transition", {
        id: order,
        version: 1,
        status: "cancelled",
        reason: "Customer cancellation race",
      }),
    ),
  ),
  sql(as(a, call("transition", { id: order, version: 1, status: "printing" }))),
]);
assert.equal(transitions.filter((r) => r.status === "fulfilled").length, 1);
assert.match(
  await sql(`select status from public.orders where id='${order}'`),
  /^(printing|cancelled)$/,
);
console.log("PASS C03: cancel/start-printing race has exactly one winner.");
const fourth = await fixture();
const withdrawal = await Promise.allSettled([
  sql(
    as(
      customer,
      call("accept", { id: fourth.offerB, revision: 1, key: randomUUID() }),
    ),
  ),
  sql(as(b, call("withdraw", { id: fourth.offerB }))),
]);
assert.equal(withdrawal.filter((r) => r.status === "fulfilled").length, 1);
const state = await sql(
  `select status from public.offers where id='${fourth.offerB}'`,
);
assert.match(state, /^(accepted|withdrawn)$/);
console.log("PASS O08: withdraw/accept race produces one consistent result.");

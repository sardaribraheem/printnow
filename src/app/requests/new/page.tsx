import { Shell } from "@/components/shell";
import { RequestComposer } from "@/components/request-composer";
import { marketplace, actorId } from "@/lib/marketplace/server";
import type { Order, PrintSettings } from "@/lib/marketplace/types";
export default async function NewRequest({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string; from?: string }>;
}) {
  const { preset, from } = await searchParams;
  let initial:
    | { title: string; mode: "pickup" | "delivery"; settings: PrintSettings }
    | undefined;
  if (from && /^[0-9a-f-]{36}$/.test(from) && (await actorId())) {
    try {
      const order = await marketplace<Order>("read", "order", from);
      if (order.mine)
        initial = {
          title: order.spec_snapshot.title,
          mode: order.mode as "pickup" | "delivery",
          settings: order.spec_snapshot.settings,
        };
    } catch {}
  }
  return (
    <Shell active="new">
      <div className="page-heading">
        <div>
          <div className="eyebrow">FROM YOUR SCREEN TO YOUR HANDS</div>
          <h1>
            Let’s make it print<span>.</span>
          </h1>
          <p>A few details now. The right offer next.</p>
        </div>
        <span className="community-tag">01 / YOUR REQUEST</span>
      </div>
      <RequestComposer key={from ?? "new"} preset={preset} initial={initial} />
    </Shell>
  );
}

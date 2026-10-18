import { Shell } from "@/components/shell";
import { OrderPanel } from "@/components/marketplace-client";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Shell>
      <OrderPanel key={id} id={id} />
    </Shell>
  );
}

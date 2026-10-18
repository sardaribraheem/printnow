import { Shell } from "@/components/shell";
import { RequestPanel } from "@/components/marketplace-client";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Shell>
      <RequestPanel key={id} id={id} />
    </Shell>
  );
}

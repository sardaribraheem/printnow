import { Shell } from "@/components/shell";
import { SupportCasePanel } from "@/components/marketplace-client";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Shell>
      <SupportCasePanel key={id} id={id} />
    </Shell>
  );
}

import { Shell } from "@/components/shell";
import { ProviderApplication } from "@/components/marketplace-client";
export default function Page() {
  return (
    <Shell active="printer">
      <ProviderApplication />
    </Shell>
  );
}

import { Shell } from "@/components/shell";
import { ProviderSettings } from "@/components/marketplace-client";
export default function Page() {
  return (
    <Shell active="printer">
      <ProviderSettings />
    </Shell>
  );
}

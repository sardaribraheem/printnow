import { Shell } from "@/components/shell";
import { PrinterPanel } from "@/components/marketplace-client";
export default function Page() {
  return (
    <Shell active="printer">
      <PrinterPanel />
    </Shell>
  );
}

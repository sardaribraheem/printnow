import { Shell } from "@/components/shell";
import { HistoryPanel } from "@/components/marketplace-client";
export default function Page() {
  return (
    <Shell active="history">
      <div className="page-heading">
        <div>
          <div className="eyebrow">ALL YOUR PRINTS, TOGETHER</div>
          <h1>My requests.</h1>
        </div>
      </div>
      <HistoryPanel />
    </Shell>
  );
}

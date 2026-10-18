import { Shell } from "@/components/shell";
import { OnboardingFlow } from "@/components/onboarding-flow";
export default function Page() {
  return (
    <Shell active="home">
      <OnboardingFlow />
    </Shell>
  );
}

import Link from "next/link";
import { Shell } from "@/components/shell";
export default function NotFound() {
  return (
    <Shell>
      <div className="not-found">
        <h1>This page hasn’t made it to print.</h1>
        <p>Let’s get you back to a fresh page.</p>
        <Link href="/" className="button button-dark">
          Back to PrintNow
        </Link>
      </div>
    </Shell>
  );
}

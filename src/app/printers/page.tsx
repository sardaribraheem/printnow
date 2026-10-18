import Link from "next/link";
import {
  ArrowUpRight,
  Coins,
  FileCheck2,
  Printer,
  ShieldCheck,
} from "lucide-react";
import { Shell } from "@/components/shell";
export default function Printers() {
  return (
    <Shell active="printer">
      <section className="provider-heading">
        <div className="eyebrow">YOUR PRINTER. A LITTLE MORE POSSIBILITY.</div>
        <h1>
          Local requests.
          <br />
          Your next opportunity.
        </h1>
        <p>
          Help your community turn files into something real. Review local print
          requests, send your own offers, and take on the jobs that work for
          you.
        </p>
        <Link
          href="/printers/apply"
          className="button button-dark"
          style={{ marginTop: 25 }}
        >
          Apply as a printing provider <ArrowUpRight size={18} />
        </Link>
      </section>
      <section className="provider-benefits">
        <div className="panel">
          <Printer size={26} />
          <h2>Your prices. Your schedule.</h2>
          <p>
            Set your capabilities, review the print requirements and send a
            complete offer with your timing.
          </p>
        </div>
        <div className="panel">
          <Coins size={26} />
          <h2>Keep your print revenue.</h2>
          <p>
            Launch commission is 0%. Customers pay you directly. There is no
            platform order fee.
          </p>
        </div>
        <div className="panel">
          <FileCheck2 size={26} />
          <h2>A clear job from the start.</h2>
          <p>
            Start production only after acceptance. The approved requirements
            and order chat stay together.
          </p>
        </div>
      </section>
      <div className="panel">
        <div className="panel-title">
          <ShieldCheck size={25} />
          <div>
            <h2>A trusted community, by design.</h2>
            <p>
              Shop and home-based providers can apply. Every application is
              reviewed before file access or bidding is enabled. A home pickup
              address is shared only with explicit provider consent.
            </p>
          </div>
        </div>
      </div>
    </Shell>
  );
}

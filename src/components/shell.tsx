import Link from "next/link";
import { actorId, marketplace } from "@/lib/marketplace/server";
import { localMode, sandboxAccounts } from "@/lib/marketplace/local";
import { SandboxBar, Notifications } from "./marketplace-client";
import type { Session } from "@/lib/marketplace/types";
import { SignOutButton } from "./sign-out-button";
import {
  ArrowUpRight,
  FileText,
  History,
  House,
  MapPin,
  Printer,
} from "lucide-react";
export function Brand() {
  return (
    <Link className="brand" href="/" aria-label="PrintNow home">
      <span className="brand-mark">
        <Printer size={23} />
      </span>
      printnow<span className="brand-dot">.</span>
    </Link>
  );
}
export async function Shell({
  children,
  active = "home",
}: {
  children: React.ReactNode;
  active?: "home" | "new" | "history" | "printer";
}) {
  const actor = await actorId();
  const user = actor ? { id: actor } : null;
  let session: Session | null = null;
  if (actor) {
    try {
      session = await marketplace<Session>("read", "session");
    } catch {}
  }
  const items = [
    { href: "/", label: "Overview", icon: House, key: "home" },
    { href: "/requests/new", label: "New request", icon: FileText, key: "new" },
    { href: "/history", label: "My requests", icon: History, key: "history" },
  ];
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar">
        <Brand />
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav aria-label="Main navigation">
          {items.map(({ href, label, icon: Icon, key }) => (
            <Link
              key={key}
              href={href}
              className={`nav-link ${active === key ? "active" : ""}`}
              aria-current={active === key ? "page" : undefined}
            >
              <Icon size={19} />
              {label}
              {key === "new" && <span className="nav-plus">+</span>}
            </Link>
          ))}
          {session?.provider && (
            <Link
              className={`nav-link ${active === "printer" ? "active" : ""}`}
              href="/printer"
            >
              <Printer size={19} />
              Printer dashboard
            </Link>
          )}
          {session?.admin && (
            <Link className="nav-link" href="/admin">
              <Printer size={19} />
              Admin
            </Link>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="provider-promo">
            <span className="tiny-icon">
              <Printer size={18} />
            </span>
            <h3>Have a printer?</h3>
            <p>Turn your printing setup into your next opportunity.</p>
            <Link href="/printers">
              Become a provider <ArrowUpRight size={15} />
            </Link>
          </div>
          <span className="sidebar-foot">Made for your everyday prints.</span>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <div className="mobile-brand">
            <Brand />
          </div>
          <div className="location">
            <MapPin size={16} />
            <span>NIIT community · Lahore</span>
          </div>
          {user && <Notifications />}
          {user ? (
            <SignOutButton />
          ) : (
            <Link className="account-link" href="/login">
              Sign in <ArrowUpRight size={16} />
            </Link>
          )}
        </header>
        {localMode() && (
          <SandboxBar accounts={sandboxAccounts} current={actor} />
        )}
        <main id="main-content">{children}</main>
        <footer className="footer">
          <span>Good prints. Better choices.</span>
          <span>PrintNow · Built for the community</span>
        </footer>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {items.map(({ href, label, icon: Icon, key }) => (
          <Link
            key={key}
            href={href}
            aria-current={active === key ? "page" : undefined}
            className={active === key ? "active" : ""}
          >
            <Icon size={19} />
            <span>{label}</span>
          </Link>
        ))}
        <Link href="/printers" className={active === "printer" ? "active" : ""}>
          <Printer size={19} />
          <span>For printers</span>
        </Link>
      </nav>
    </div>
  );
}

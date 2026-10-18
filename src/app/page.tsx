import Link from "next/link";
import { actorId } from "@/lib/marketplace/server";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  Clock3,
  FileCheck2,
  FileText,
  Layers3,
  MapPin,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import { Shell } from "@/components/shell";
export default async function Home() {
  const startPath = (await actorId()) ? "/requests/new" : "/onboarding";
  return (
    <Shell>
      <div className="page-heading">
        <div>
          <div className="eyebrow">LESS HASSLE. MORE POSSIBILITY.</div>
          <h1>
            Your next print, sorted<span>.</span>
          </h1>
          <p>From the file on your phone to the pages in your hands.</p>
        </div>
        <span className="community-tag">
          <span />A little closer to local.
        </span>
      </div>
      <section className="hero">
        <div className="hero-copy">
          <div className="hero-kicker">
            <Sparkles size={15} />
            YOUR FILES. YOUR CHOICE.
          </div>
          <h2>
            Big deadlines.
            <br />
            Small print errands.
          </h2>
          <p>
            Share what you need. Compare offers from local printers. Choose the
            one that works for you.
          </p>
          <Link className="button button-dark" href={startPath}>
            Create a print request <ArrowUpRight size={19} />
          </Link>
          <div className="hero-note">
            <ShieldCheck size={15} />
            Private files. Clear prices. No platform fee.
          </div>
        </div>
        <div className="print-illustration" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <span className="floating-label label-top">
            <Check size={13} />
            Ready when you are
          </span>
          <div className="paper paper-back" />
          <div className="paper paper-front">
            <div className="paper-logo">
              <Layers3 size={18} />a fresh start.
            </div>
            <span className="paper-eyebrow">IDEAS LOOK GOOD ON PAPER</span>
            <div className="paper-title">
              Make it
              <br />
              happen<span>.</span>
            </div>
            <div className="paper-grid">
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="paper-line" />
            <div className="paper-line short" />
            <div className="paper-bottom">
              YOUR NEXT CHAPTER <ArrowUpRight size={16} />
            </div>
          </div>
          <span className="floating-label label-bottom">
            <FileCheck2 size={18} />
            <span>
              From screen
              <br />
              <strong>to something real.</strong>
            </span>
          </span>
          <span className="starburst">✳</span>
        </div>
      </section>
      <section className="trust-strip" aria-label="How PrintNow works">
        <div>
          <span className="step-icon">
            <Upload size={20} />
          </span>
          <span>
            <strong>Upload in a moment</strong>
            <small>PDF, PNG or JPEG. All in one place.</small>
          </span>
        </div>
        <div>
          <span className="step-icon">
            <Clock3 size={20} />
          </span>
          <span>
            <strong>Compare fresh offers</strong>
            <small>Every offer is valid for 5 minutes.</small>
          </span>
        </div>
        <div>
          <span className="step-icon">
            <MapPin size={20} />
          </span>
          <span>
            <strong>Get it your way</strong>
            <small>Pick it up or arrange delivery.</small>
          </span>
        </div>
      </section>
      <div className="section-heading">
        <div>
          <span className="eyebrow">A GOOD PLACE TO START</span>
          <h2>What are we printing?</h2>
        </div>
        <span className="muted desktop-only">
          Everyday things, made easier.
        </span>
      </div>
      <section className="quick-grid">
        <Link href="/requests/new?preset=assignment" className="quick-card">
          <span className="quick-icon peach">
            <FileText size={25} />
          </span>
          <ArrowUpRight className="card-arrow" size={18} />
          <h3>Assignments & notes</h3>
          <p>
            One less thing between you
            <br />
            and your deadline.
          </p>
          <span className="card-meta">A4 · Black & white</span>
        </Link>
        <Link href="/requests/new?preset=document" className="quick-card">
          <span className="quick-icon sage">
            <Layers3 size={25} />
          </span>
          <ArrowUpRight className="card-arrow" size={18} />
          <h3>Everyday documents</h3>
          <p>
            Forms, handouts, and everything
            <br />
            that needs a paper trail.
          </p>
          <span className="card-meta">Simple, flexible settings</span>
        </Link>
        <Link href="/requests/new?preset=image" className="quick-card">
          <span className="quick-icon lilac">
            <Sparkles size={25} />
          </span>
          <ArrowUpRight className="card-arrow" size={18} />
          <h3>Something more colorful</h3>
          <p>
            Bring your images and ideas
            <br />a little closer to life.
          </p>
          <span className="card-meta">PNG, JPEG & PDF</span>
        </Link>
      </section>
      <section className="recent-section">
        <div className="section-heading">
          <h2>A fresh page awaits</h2>
          <Link className="text-link" href="/history">
            My requests <ArrowRight size={16} />
          </Link>
        </div>
        <div className="empty-row">
          <span className="empty-icon">
            <FileText size={28} />
          </span>
          <div>
            <h3>Let’s get your first print going.</h3>
            <p>Sign in to post requests and keep track of your orders here.</p>
          </div>
          <Link className="button button-outline" href={startPath}>
            Start a request <ArrowRight size={16} />
          </Link>
        </div>
      </section>
      <div className="bottom-note">
        <ShieldCheck size={16} />
        <span>
          Your documents stay private. You choose which printer gets the job.
        </span>
        <ArrowDown size={14} />
      </div>
    </Shell>
  );
}

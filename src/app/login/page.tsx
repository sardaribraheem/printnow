import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Shell } from "@/components/shell";
import { authConfiguration, safeReturnPath } from "@/lib/auth/config";
import { googleAuth, passwordAuth } from "./actions";
import { availableAuthMethods } from "@/lib/auth/availability";
export const dynamic = "force-dynamic";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{
    mode?: string;
    next?: string;
    message?: string;
    notice?: string;
  }>;
}) {
  const params = await searchParams;
  const signup = params.mode === "signup";
  const configured = !!authConfiguration();
  const methods = await availableAuthMethods();
  const ready = methods.reachable;
  const emailReady = ready && methods.email && (!signup || methods.signup);
  const next = safeReturnPath(params.next);
  return (
    <Shell>
      <section className="panel auth-layout">
        <div className="eyebrow">GOOD TO HAVE YOU HERE</div>
        <h1>{signup ? "Your next chapter." : "Welcome back."}</h1>
        <p>
          {signup
            ? "Create an account to find your next print."
            : "Sign in to turn your next to-do into done."}
        </p>
        {!ready && (
          <div className="config-note" role="status">
            {configured
              ? "Sign-in is temporarily unavailable. Please try again shortly."
              : "Sign-in is being set up. Please check back soon."}
          </div>
        )}
        {params.message && (
          <div role="alert" className="error-message">
            {params.message}
          </div>
        )}
        {params.notice && (
          <div role="status" className="success-message">
            {params.notice}
          </div>
        )}
        <form className="auth-form" action={googleAuth}>
          <input type="hidden" name="next" value={next} />
          <button
            disabled={!ready || !methods.google}
            className="button button-outline full-width"
            type="submit"
          >
            Continue with Google <ArrowRight size={16} />
          </button>
        </form>
        {ready && !methods.google && (
          <p className="inline-note">
            Google sign-in isn’t enabled yet. Use email to continue.
          </p>
        )}
        {signup && ready && !methods.signup && (
          <p className="config-note" role="status">
            New registrations are currently closed.
          </p>
        )}
        <div className="divider">or use your email</div>
        <form className="auth-form" action={passwordAuth}>
          <input type="hidden" name="next" value={next} />
          <input
            type="hidden"
            name="mode"
            value={signup ? "signup" : "login"}
          />
          <label>
            Email address
            <input
              type="email"
              name="email"
              placeholder="you@example.com"
              autoComplete="email"
              required
              maxLength={254}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              name="password"
              placeholder="At least 8 characters"
              autoComplete={signup ? "new-password" : "current-password"}
              minLength={8}
              maxLength={128}
              required
            />
          </label>
          <button
            disabled={!emailReady}
            className="button button-dark"
            type="submit"
          >
            {signup ? "Create account" : "Sign in"}
            <ArrowRight size={17} />
          </button>
        </form>
        <p className="auth-switch">
          {signup ? "Already have an account?" : "New around here?"}{" "}
          <Link
            href={`/login?mode=${signup ? "login" : "signup"}&next=${encodeURIComponent(next)}`}
          >
            {signup ? "Sign in" : "Create an account"}
          </Link>
        </p>
        <p className="inline-note">
          <ShieldCheck size={14} />
          One account for customers and printing providers. Provider approval is
          separate.
        </p>
      </section>
    </Shell>
  );
}

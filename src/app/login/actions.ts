"use server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { localMode } from "@/lib/marketplace/local";
import { z } from "zod";
import { createClient } from "@/lib/auth/server";
import { safeReturnPath, siteOrigin } from "@/lib/auth/config";
const credentials = z.object({
  email: z.email().max(254),
  password: z.string().min(8).max(128),
});
function loginError(message: string, next: string): never {
  redirect(
    `/login?message=${encodeURIComponent(message)}&next=${encodeURIComponent(next)}`,
  );
}
export async function passwordAuth(form: FormData) {
  const next = safeReturnPath(String(form.get("next") ?? "/"));
  const parsed = credentials.safeParse({
    email: form.get("email"),
    password: form.get("password"),
  });
  if (!parsed.success)
    loginError(
      "Enter a valid email and a password of at least 8 characters.",
      next,
    );
  const client = await createClient();
  if (!client) loginError("Authentication is not connected yet.", next);
  const signup = form.get("mode") === "signup";
  const origin = siteOrigin();
  if (signup && !origin)
    loginError(
      "The deployment callback URL needs configuration before signup.",
      next,
    );
  const { error } = signup
    ? await client.auth.signUp({
        ...parsed.data,
        options: {
          emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      })
    : await client.auth.signInWithPassword(parsed.data);
  if (error)
    loginError(
      signup
        ? "We couldn’t create the account. Please try again or sign in."
        : "Unable to sign in. Check your email and password, and confirm your email if needed.",
      next,
    );
  if (signup)
    redirect(
      `/login?notice=${encodeURIComponent("Check your email to confirm your account, then sign in.")}&next=${encodeURIComponent(next)}`,
    );
  redirect(next);
}
export async function googleAuth(form: FormData) {
  const next = safeReturnPath(String(form.get("next") ?? "/"));
  const client = await createClient();
  const origin = siteOrigin();
  if (!client || !origin)
    loginError(
      "Google sign-in needs Supabase and a configured deployment callback URL.",
      next,
    );
  const { data, error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error || !data.url)
    loginError(
      "Google sign-in is unavailable. Try email sign-in instead.",
      next,
    );
  redirect(data.url);
}
export async function signOut() {
  if (localMode()) {
    (await cookies()).delete("printnow_sandbox");
    redirect("/login");
  }
  const client = await createClient();
  if (client) await client.auth.signOut();
  redirect("/login");
}

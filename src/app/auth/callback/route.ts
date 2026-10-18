import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/auth/server";
import { safeReturnPath, siteOrigin } from "@/lib/auth/config";
export async function GET(request: NextRequest) {
  const origin = siteOrigin();
  if (!origin)
    return Response.json(
      { message: "Sign-in callback is not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  const code = request.nextUrl.searchParams.get("code");
  const next = safeReturnPath(request.nextUrl.searchParams.get("next"));
  const client = await createClient();
  if (code && client) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }
  return NextResponse.redirect(
    new URL(
      "/login?message=We%20couldn’t%20confirm%20this%20sign-in.%20Please%20try%20again.",
      origin,
    ),
  );
}

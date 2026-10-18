import { cookies } from "next/headers";
import { localMode, sandboxAccounts } from "@/lib/marketplace/local";
import {
  requireSameOrigin,
  errorResponse,
  AppError,
} from "@/lib/marketplace/server";
export async function POST(request: Request) {
  try {
    if (!localMode()) throw new AppError("NOT_FOUND", 404);
    requireSameOrigin(request);
    const data = await request.json();
    if (!sandboxAccounts.some((a) => a.id === data.id))
      throw new AppError("FORBIDDEN", 403);
    (await cookies()).set("printnow_sandbox", data.id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 86400,
    });
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

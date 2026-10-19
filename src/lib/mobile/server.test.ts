import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  create: vi.fn(),
  user: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: mock.create }));
import { mobileActor } from "./server";
describe("verified native identities", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test-project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    mock.create.mockReset();
    mock.user.mockReset();
    mock.rpc.mockReset();
    mock.create.mockReturnValue({
      auth: { getUser: mock.user },
      rpc: mock.rpc,
    });
  });
  it("rejects sandbox and browser cookies before creating a client", async () => {
    await expect(
      mobileActor(
        new Request("https://app.test/api/mobile/v1/marketplace/session", {
          headers: { Cookie: "printnow_sandbox=admin" },
        }),
      ),
    ).rejects.toMatchObject({ code: "AUTH_REQUIRED", status: 401 });
    expect(mock.create).not.toHaveBeenCalled();
  });
  it("rejects a forged or expired token reported by the auth server", async () => {
    mock.user.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid JWT" },
    });
    await expect(
      mobileActor(
        new Request("https://app.test", {
          headers: { Authorization: "Bearer forged.claims.signature" },
        }),
      ),
    ).rejects.toMatchObject({ status: 401 });
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it("verifies the token and executes RPCs as that user, never as a service role", async () => {
    mock.user.mockResolvedValue({
      data: { user: { id: "verified-user" } },
      error: null,
    });
    mock.rpc.mockResolvedValue({ data: { id: "order" }, error: null });
    const actor = await mobileActor(
      new Request("https://app.test", {
        headers: { Authorization: "Bearer valid.claims.signature" },
      }),
    );
    expect(mock.user).toHaveBeenCalledWith("valid.claims.signature");
    expect(mock.create).toHaveBeenCalledWith(
      "https://test-project.supabase.co",
      "sb_publishable_test",
      expect.objectContaining({
        global: { headers: { Authorization: "Bearer valid.claims.signature" } },
      }),
    );
    expect(actor.id).toBe("verified-user");
    await expect(
      actor.rpc("mutate", "accept", { id: "offer" }),
    ).resolves.toEqual({ id: "order" });
    expect(mock.rpc).toHaveBeenCalledWith("marketplace_mutate", {
      p_action: "accept",
      p_input: { id: "offer" },
    });
  });
});

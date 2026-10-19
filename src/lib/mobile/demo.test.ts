import { describe, expect, it, vi } from "vitest";
import { DemoService } from "../../../mobile/src/core/demo";
import type { PrintRequest, Order } from "../../../mobile/src/core/types";
async function requestWithOffers(mode = "pickup") {
  const service = new DemoService();
  const { id } = await service.mutate("create_request", {
    title: "Test print",
    mode,
    area: "Test area",
  });
  await service.upload(id, {
    uri: "file:///private/test.png",
    name: "test.png",
    size: 1234,
    mimeType: "image/png",
  });
  await service.mutate("publish", { id });
  const request = await service.read<PrintRequest>("request/" + id);
  return { service, request };
}
describe("native preview workflows", () => {
  it("completes a pickup flow in customer and printer modes without external effects", async () => {
    const { service, request } = await requestWithOffers();
    const { id } = await service.mutate("accept", { id: request.offers[0].id });
    await expect(
      service.mutate("accept", { id: request.offers[0].id }),
    ).resolves.toEqual({ id });
    service.providerMode = true;
    for (const status of ["printing", "ready", "collected"])
      await service.mutate("transition", { id, status });
    service.providerMode = false;
    await service.mutate("transition", { id, status: "completed" });
    expect((await service.read<Order>("order/" + id)).status).toBe("completed");
    expect(service.orders).toHaveLength(1);
  });
  it("keeps a delivery flow, chat retries and payment assertions separate", async () => {
    const { service, request } = await requestWithOffers("delivery");
    const { id } = await service.mutate("accept", { id: request.offers[0].id });
    await service.mutate("message", {
      id,
      key: "message-key",
      body: "At reception, please.",
    });
    await service.mutate("message", {
      id,
      key: "message-key",
      body: "At reception, please.",
    });
    service.providerMode = true;
    for (const status of ["printing", "ready", "out_for_delivery", "delivered"])
      await service.mutate("transition", { id, status });
    await service.mutate("payment", { id, assertion: "received" });
    service.providerMode = false;
    await service.mutate("payment", { id, assertion: "paid" });
    await service.mutate("transition", { id, status: "completed" });
    const order = await service.read<Order>("order/" + id);
    expect(order.messages).toHaveLength(1);
    expect(order.customer_payment).toBe("paid");
    expect(order.provider_payment).toBe("received");
    expect(order.price_snapshot.platform_fee_paisa).toBe(0);
  });
  it("does not restart five-minute offer clocks on refresh or accept expired offers", async () => {
    vi.useFakeTimers();
    try {
      const { service, request } = await requestWithOffers();
      vi.advanceTimersByTime(301000);
      const refreshed = await service.read<PrintRequest>(
        "request/" + request.id,
      );
      expect(refreshed.offers[0].expires_at).toBe(request.offers[0].expires_at);
      await expect(
        service.mutate("accept", { id: request.offers[0].id }),
      ).rejects.toThrow("expired");
    } finally {
      vi.useRealTimers();
    }
  });
  it("does not invent verified PDF page counts from selected file metadata", async () => {
    const service = new DemoService();
    const { id } = await service.mutate("create_request", {
      title: "PDF preview",
      mode: "pickup",
      area: "Test",
    });
    await service.upload(id, {
      uri: "file:///private/test.pdf",
      name: "test.pdf",
      size: 1024,
      mimeType: "application/pdf",
    });
    const draft = await service.read<PrintRequest>("request/" + id);
    expect(draft.files[0].pages).toBeNull();
    expect(draft.files[0].state).toBe("ready");
  });
});

import * as Crypto from "expo-crypto";
import type {
  Session,
  PrintRequest,
  Order,
  Offer,
  PrintSettings,
  PrintFile,
  History,
} from "./types";
import type { SelectedFile } from "../navigation";
const id = () => Crypto.randomUUID();
const now = () => new Date().toISOString();
const defaults: PrintSettings = {
  size: "A4",
  color: "bw",
  copies: 1,
  duplex: false,
  duplex_edge: "long",
  finishing: "loose",
  scaling: "fit",
};
// The in-memory sample adapter mirrors heterogeneous RPC payloads; live inputs
// are validated by the API/database and never pass through this adapter.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Input = Record<string, any>;
export class DemoService {
  providerMode = false;
  readonly customer = id();
  readonly provider = id();
  readonly zone = id();
  requests: PrintRequest[] = [];
  orders: Order[] = [];
  session: Session = {
    user: {
      user_id: this.customer,
      display_name: "Alex",
      contact_phone: "03000000000",
      preferred_fulfillment: "pickup",
    },
    provider: {
      id: this.provider,
      display_name: "Campus Print Studio",
      state: "active",
      capabilities: {
        sizes: ["A4", "A3"],
        colors: ["bw", "color"],
        duplex: true,
        finishing: ["loose", "stapled"],
      },
      hours: "9am – 8pm",
      accepting: true,
      zone_id: this.zone,
    },
    admin: false,
    zones: [{ id: this.zone, name: "NIIT · Lahore" }],
    address: null,
    server_now: now(),
  };
  fileUris = new Map<string, string>();
  async read<T>(path: string): Promise<T> {
    const [kind, requestId] = path.split("/");
    let result: unknown;
    if (kind === "session") result = { ...this.session, server_now: now() };
    else if (kind === "history")
      result = {
        requests: this.requests.map((r) => ({ ...r, created_at: now() })),
        orders: this.orders.map((o) => ({
          ...o,
          title: o.spec_snapshot.title,
          accepted_at: now(),
        })),
        offers: this.requests.flatMap((r) =>
          r.offers
            .filter((o) => o.provider_id === this.provider)
            .map((o) => ({
              ...o,
              request_id: r.id,
              title: r.title,
              order_id: r.order_id,
            })),
        ),
      } satisfies History;
    else if (kind === "feed")
      result = {
        requests: this.requests.filter((r) => r.state === "open"),
        server_now: now(),
      };
    else if (kind === "request") {
      const request = this.requests.find((r) => r.id === requestId);
      if (!request) throw new Error("Request not found.");
      result = {
        ...request,
        mine: !this.providerMode,
        server_now: now(),
        offers: this.providerMode
          ? request.offers.filter((o) => o.provider_id === this.provider)
          : request.offers,
      };
    } else if (kind === "order") {
      const order = this.orders.find((o) => o.id === requestId);
      if (!order) throw new Error("Order not found.");
      result = {
        ...order,
        mine: !this.providerMode,
        messages: order.messages.map((m) => ({
          ...m,
          mine:
            m.sender_name ===
            (this.providerMode ? "Campus Print Studio" : "You"),
        })),
        server_now: now(),
      };
    } else if (kind === "notifications") result = [];
    else throw new Error("This action is unavailable in the preview.");
    return JSON.parse(JSON.stringify(result)) as T;
  }
  async upload(requestId: string, file: SelectedFile) {
    const request = this.requests.find((r) => r.id === requestId)!;
    const image = file.mimeType.startsWith("image/");
    const item: PrintFile = {
      id: id(),
      name: file.name,
      bytes: file.size,
      kind: image ? (file.mimeType === "image/png" ? "png" : "jpeg") : "pdf",
      pages: file.pages ?? (image ? 1 : null),
      state: "ready",
      error: null,
    };
    request.files.push(item);
    this.fileUris.set(item.id, file.uri);
    return item.id;
  }
  private offers(request: PrintRequest): Offer[] {
    return [
      {
        id: id(),
        provider_id: this.provider,
        provider_name: "Campus Print Studio",
        pickup_address: "Sample shop · Campus Road",
        print_paisa: 20000,
        delivery_paisa: request.mode === "delivery" ? 15000 : 0,
        duration_minutes: 25,
        note: "Carefully printed and packed.",
        payment_method: "cash",
      },
      {
        id: id(),
        provider_id: id(),
        provider_name: "Paper & Ink",
        pickup_address: "Sample shop · Main Market",
        print_paisa: 18000,
        delivery_paisa: request.mode === "delivery" ? 14000 : 0,
        duration_minutes: 40,
        note: "Ready when you need it.",
        payment_method: "cash",
      },
    ].map((o) => ({
      ...o,
      total_paisa: o.print_paisa + o.delivery_paisa,
      expires_at: new Date(Date.now() + 300000).toISOString(),
      status: "active",
      created_at: now(),
    }));
  }
  async mutate<T = { id: string }>(action: string, input: Input): Promise<T> {
    const request = this.requests.find(
      (r) => r.id === input.id || r.offers.some((o) => o.id === input.id),
    );
    const order = this.orders.find((o) => o.id === input.id);
    let result: unknown = { ok: true };
    if (action === "onboard") {
      this.session.user.display_name = input.name;
      this.session.user.contact_phone = input.phone;
      this.session.user.preferred_fulfillment = input.mode;
      if (input.mode === "delivery")
        this.session.address = {
          recipient_name: input.name,
          phone: input.phone,
          full_address: input.address,
          landmark: input.landmark ?? "",
          lat: null,
          lng: null,
        };
    } else if (action === "create_request") {
      const value: PrintRequest = {
        id: id(),
        title: input.title,
        state: "draft",
        revision: 1,
        mine: true,
        mode: input.mode,
        urgency: input.urgency,
        area: input.area,
        settings: input.settings ?? defaults,
        instructions: input.instructions ?? "",
        total_sides: 0,
        sheets: 0,
        latest_needed_at: null,
        expires_at: null,
        server_now: now(),
        files: [],
        offers: [],
        order_id: null,
        destination: input.destination,
      };
      this.requests.unshift(value);
      result = { id: value.id };
    } else if (action === "publish" && request) {
      request.state = "open";
      request.expires_at = new Date(Date.now() + 7200000).toISOString();
      const images = request.files
        .filter((f) => f.pages !== null)
        .reduce((sum, f) => sum + f.pages!, 0);
      request.total_sides = images * request.settings.copies;
      request.sheets = images * request.settings.copies;
      request.offers = this.offers(request);
      result = { id: request.id };
    } else if (action === "offer" && request) {
      request.offers = request.offers.filter(
        (o) => o.provider_id !== this.provider,
      );
      const offer: Offer = {
        ...input,
        id: id(),
        provider_id: this.provider,
        provider_name: "Campus Print Studio",
        pickup_address: "Sample shop · Campus Road",
        total_paisa: input.print_paisa + input.delivery_paisa,
        status: "active",
        expires_at: new Date(Date.now() + 300000).toISOString(),
        created_at: now(),
      } as Offer;
      request.offers.unshift(offer);
      result = { id: offer.id };
    } else if (action === "accept" && request) {
      if (request.order_id) return { id: request.order_id } as T;
      const offer = request.offers.find((o) => o.id === input.id);
      if (
        !offer ||
        offer.status !== "active" ||
        Date.parse(offer.expires_at) <= Date.now()
      )
        throw new Error("This offer expired. Ask for a new offer.");
      const orderId = id();
      request.order_id = orderId;
      request.state = "matched";
      request.offers.forEach((o) => {
        o.status = o.id === offer.id ? "accepted" : "not_selected";
      });
      this.orders.unshift({
        id: orderId,
        request_id: request.id,
        status: "confirmed",
        issue_status: "none",
        mine: true,
        mode: request.mode,
        provider_name: offer.provider_name,
        spec_snapshot: {
          title: request.title,
          settings: request.settings,
          instructions: request.instructions,
          sides: request.total_sides,
          sheets: request.sheets,
          revision: request.revision,
        },
        price_snapshot: {
          print_paisa: offer.print_paisa,
          delivery_paisa: offer.delivery_paisa,
          total_paisa: offer.total_paisa,
          payment_method: offer.payment_method,
          commission_bps: 0,
          platform_fee_paisa: 0,
        },
        row_version: 1,
        due_at: new Date(
          Date.now() + offer.duration_minutes * 60000,
        ).toISOString(),
        customer_payment: null,
        provider_payment: null,
        contacts: {
          provider_name: offer.provider_name,
          provider_phone: "03000000000",
          pickup_address: offer.pickup_address ?? "",
          hours: "9am – 8pm",
          customer_name: this.session.user.display_name,
          customer_phone: "03000000000",
          delivery: request.destination,
        },
        messages: [],
        events: [
          { id: id(), kind: "order_confirmed", created_at: now(), details: {} },
        ],
        issues: [],
        server_now: now(),
      });
      result = { id: orderId };
    } else if (action === "provider_settings" && this.session.provider) {
      this.session.provider.capabilities = input.capabilities;
      this.session.provider.hours = input.hours;
      this.session.provider.accepting = input.accepting;
    } else if (action === "edit_request" && request) {
      request.settings = input.settings ?? request.settings;
      request.instructions = input.instructions ?? request.instructions;
      request.revision++;
      request.state = "draft";
      request.offers = [];
    } else if (action === "forget_address") this.session.address = null;
    else if (action === "cancel_request" && request)
      request.state = "cancelled";
    else if (action === "decline" && request) {
      const offer = request.offers.find((o) => o.id === input.id);
      if (offer) offer.status = "declined";
    } else if (action === "withdraw" && request) {
      const offer = request.offers.find((o) => o.id === input.id);
      if (offer) offer.status = "withdrawn";
    } else if (action === "transition" && order) {
      const valid =
        (input.status === "cancelled" &&
          order.status === "confirmed" &&
          String(input.reason ?? "").trim().length >= 5) ||
        (!this.providerMode
          ? input.status === "completed" &&
            ["ready", "delivered", "collected"].includes(order.status)
          : (
              {
                confirmed: "printing",
                printing: "ready",
                ready:
                  order.mode === "delivery" ? "out_for_delivery" : "collected",
                out_for_delivery: "delivered",
              } as Record<string, string>
            )[order.status] === input.status);
      if (!valid) throw new Error("That status change is not available.");
      order.status = input.status;
      order.row_version++;
      order.events.push({
        id: id(),
        kind: input.status,
        created_at: now(),
        details: {},
      });
    } else if (action === "message" && order) {
      if (!order.messages.some((m) => m.id === input.key))
        order.messages.push({
          id: input.key,
          mine: !this.providerMode,
          body: input.body,
          sender_name: this.providerMode ? "Campus Print Studio" : "You",
          created_at: now(),
        });
    } else if (action === "payment" && order) {
      if (this.providerMode) order.provider_payment = input.assertion;
      else order.customer_payment = input.assertion;
    } else if (action === "issue" && order) {
      order.issues.push({
        id: id(),
        category: input.category,
        description: input.description,
        state: "open",
        resolution: null,
      });
      order.issue_status = "open";
    } else if (
      ["mark_order_read", "notification_read", "finalize_file"].includes(action)
    ) {
      /* No external effects in preview. */
    } else throw new Error("This preview action is unavailable.");
    return JSON.parse(JSON.stringify(result)) as T;
  }
}

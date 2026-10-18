export interface Session {
  user: {
    user_id: string;
    display_name: string;
    contact_phone: string | null;
    preferred_fulfillment?: "pickup" | "delivery";
  };
  provider: null | {
    id: string;
    display_name: string;
    state: string;
    capabilities: Capabilities;
    hours: string;
    accepting: boolean;
    zone_id: string | null;
  };
  admin: boolean;
  zones: { id: string; name: string }[];
  address?: {
    recipient_name: string;
    phone: string;
    full_address: string;
    landmark: string;
    lat: number | null;
    lng: number | null;
  } | null;
  server_now: string;
}
export interface Capabilities {
  sizes: string[];
  colors: string[];
  duplex: boolean;
  finishing: string[];
}
export interface PrintSettings {
  size: "A4" | "A3";
  color: "bw" | "color";
  copies: number;
  duplex: boolean;
  duplex_edge: "long" | "short";
  finishing: "loose" | "stapled";
  scaling: "fit" | "actual";
  files?: Record<string, Partial<PrintSettings> & { pages?: string }>;
}
export interface PrintFile {
  pixel_width?: number | null;
  pixel_height?: number | null;
  id: string;
  name: string;
  kind: string;
  pages: number | null;
  bytes: number;
  state: string;
  error: string | null;
}
export interface Offer {
  id: string;
  provider_id: string;
  provider_name: string;
  pickup_address: string | null;
  print_paisa: number;
  delivery_paisa: number;
  total_paisa: number;
  duration_minutes: number;
  payment_method: string;
  status: string;
  expires_at: string;
  note: string;
  created_at: string;
}
export interface PrintRequest {
  id: string;
  title: string;
  state: string;
  revision: number;
  mine: boolean;
  mode: "pickup" | "delivery";
  urgency: string;
  area: string;
  settings: PrintSettings;
  instructions: string;
  total_sides: number;
  sheets: number;
  latest_needed_at: string | null;
  expires_at: string | null;
  server_now: string;
  files: PrintFile[];
  offers: Offer[];
  clarifications?: { id: string; category: string; provider_name: string }[];
  order_id: string | null;
  destination?: {
    recipient_name: string;
    phone: string;
    address: string;
    landmark: string;
  };
}
export interface RequestSummary {
  id: string;
  title: string;
  state: string;
  mode: string;
  urgency: string;
  total_sides: number;
  created_at: string;
  expires_at: string | null;
  area?: string;
  settings?: PrintSettings;
}
export interface Price {
  print_paisa: number;
  delivery_paisa: number;
  total_paisa: number;
  payment_method: string;
  commission_bps: number;
  platform_fee_paisa: number;
}
export interface OrderSummary {
  id: string;
  status: string;
  mode: string;
  price_snapshot: Price;
  due_at: string;
  accepted_at: string;
  title: string;
}
export interface Order {
  id: string;
  request_id: string;
  status: string;
  issue_status: string;
  mine: boolean;
  mode: string;
  provider_name: string;
  spec_snapshot: {
    title: string;
    settings: PrintSettings;
    instructions: string;
    sides: number;
    sheets: number;
    revision: number;
  };
  price_snapshot: Price;
  row_version: number;
  due_at: string;
  other_read_at?: string | null;
  customer_payment: string | null;
  provider_payment: string | null;
  contacts: {
    provider_name: string;
    provider_phone: string;
    pickup_address: string;
    hours: string;
    customer_name: string;
    customer_phone: string;
    delivery?: {
      address: string;
      landmark: string;
      phone: string;
      recipient_name: string;
    };
  };
  messages: {
    id: string;
    mine: boolean;
    body: string;
    created_at: string;
    sender_name: string;
  }[];
  events: {
    id: string;
    kind: string;
    created_at: string;
    details: { reason?: string };
  }[];
  issues: {
    id: string;
    category: string;
    description: string;
    state: string;
    resolution: string | null;
  }[];
  server_now: string;
}
export interface FileRecord {
  id: string;
  request_id: string;
  owner_id: string;
  original_name: string;
  kind: string;
  byte_count: number;
  page_count: number | null;
  object_key: string;
  derivative_key: string | null;
  preview_key: string | null;
  job_id?: string;
  processing_state: string;
}

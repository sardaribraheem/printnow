export type * from "../../../src/lib/marketplace/types";
export {
  validateUploadBatch,
  parsePages,
  printCounts,
  formatMoney,
  UPLOAD_LIMITS,
} from "../../../src/lib/domain/printing";
export type History = {
  requests: import("./types").RequestSummary[];
  orders: import("./types").OrderSummary[];
  offers?: {
    id: string;
    request_id: string;
    title: string;
    status: string;
    total_paisa: number;
    duration_minutes: number;
    order_id: string | null;
  }[];
};
export type NotificationItem = {
  id: string;
  kind: string;
  entity_id: string;
  read_at: string | null;
  created_at: string;
};
export function label(value: string) {
  return value.replaceAll("_", " ").replace(/^\w/, (c) => c.toUpperCase());
}

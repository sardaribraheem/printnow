export const UPLOAD_LIMITS = {
  files: 3,
  fileBytes: 25 * 1024 * 1024,
  totalBytes: 75 * 1024 * 1024,
  printedSides: 200,
} as const;
export type UploadKind = "pdf" | "png" | "jpeg";
export function uploadKind(name: string): UploadKind | null {
  const extension = name.split(".").pop()?.toLowerCase();
  return extension === "pdf"
    ? "pdf"
    : extension === "png"
      ? "png"
      : extension === "jpg" || extension === "jpeg"
        ? "jpeg"
        : null;
}
export function validateUploadBatch(
  files: readonly { name: string; size: number }[],
): string | null {
  if (files.length > UPLOAD_LIMITS.files)
    return "Choose up to 3 files per request.";
  if (files.some((file) => !uploadKind(file.name)))
    return "Choose PDF, PNG or JPEG files.";
  if (files.some((file) => file.size <= 0))
    return "Empty files cannot be printed.";
  if (files.some((file) => file.size > UPLOAD_LIMITS.fileBytes))
    return "Each file must be 25 MiB or smaller.";
  if (
    files.reduce((sum, file) => sum + file.size, 0) > UPLOAD_LIMITS.totalBytes
  )
    return "Files must total 75 MiB or less.";
  return null;
}
export function parsePages(input: string, pageCount: number): number[] {
  if (!Number.isSafeInteger(pageCount) || pageCount < 1 || pageCount > 10000)
    throw new Error("Invalid page count.");
  if (!input.trim()) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const result = new Set<number>();
  for (const part of input.split(",")) {
    const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new Error("Use page numbers or ranges, such as 1, 3-5.");
    const first = Number(match[1]),
      last = Number(match[2] ?? match[1]);
    if (first < 1 || last < first || last > pageCount)
      throw new Error("Page range is outside this file.");
    for (let page = first; page <= last; page++) result.add(page);
  }
  return [...result].sort((a, b) => a - b);
}
export function printCounts(
  items: readonly { pages: number; copies: number; duplex: boolean }[],
) {
  let logicalPages = 0,
    printedSides = 0,
    sheets = 0;
  for (const item of items) {
    if (
      !Number.isSafeInteger(item.pages) ||
      item.pages < 1 ||
      !Number.isSafeInteger(item.copies) ||
      item.copies < 1 ||
      item.copies > 200
    )
      throw new Error(
        "Pages and copies must be positive whole numbers within the print limit.",
      );
    logicalPages += item.pages;
    printedSides += item.pages * item.copies;
    sheets +=
      (item.duplex ? Math.ceil(item.pages / 2) : item.pages) * item.copies;
  }
  if (printedSides > UPLOAD_LIMITS.printedSides)
    throw new Error("A request can have at most 200 printed sides.");
  return { logicalPages, printedSides, sheets };
}
export function formatMoney(paisa: number) {
  if (!Number.isSafeInteger(paisa) || paisa < 0)
    throw new Error("Money must be nonnegative integer paisa.");
  return `Rs. ${new Intl.NumberFormat("en-PK", { maximumFractionDigits: 2 }).format(paisa / 100)}`;
}

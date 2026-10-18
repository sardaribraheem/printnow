import { describe, expect, it } from "vitest";
import {
  formatMoney,
  parsePages,
  printCounts,
  validateUploadBatch,
} from "./printing";
describe("print calculations", () => {
  it("starts every duplex copy on a fresh sheet (F06)", () => {
    expect(printCounts([{ pages: 5, copies: 2, duplex: true }])).toEqual({
      logicalPages: 5,
      printedSides: 10,
      sheets: 6,
    });
  });
  it("does not combine separate images onto one duplex sheet", () => {
    expect(
      printCounts([
        { pages: 1, copies: 1, duplex: true },
        { pages: 1, copies: 1, duplex: true },
      ]).sheets,
    ).toBe(2);
  });
  it("sorts and deduplicates selected pages", () => {
    expect(parsePages("5, 1-3, 2", 5)).toEqual([1, 2, 3, 5]);
  });
  it.each(["0", "6", "4-2", "1,", "1.5", "-1"])(
    "rejects invalid ranges: %s",
    (value) => {
      expect(() => parsePages(value, 5)).toThrow();
    },
  );
  it("enforces total printed-side limit across files", () => {
    expect(() =>
      printCounts([{ pages: 101, copies: 2, duplex: true }]),
    ).toThrow(/200/);
  });
  it("rejects fractional copies", () => {
    expect(() =>
      printCounts([{ pages: 1, copies: 1.5, duplex: false }]),
    ).toThrow();
  });
  it("shows the complete print plus delivery amount (O01 presentation)", () => {
    expect(formatMoney(20000 + 15000)).toBe("Rs. 350");
  });
});
describe("upload selection checks (server verification is still required)", () => {
  it("accepts PDF, PNG and both JPEG extensions", () => {
    for (const name of ["a.PDF", "a.png", "a.jpg", "a.jpeg"])
      expect(validateUploadBatch([{ name, size: 100 }])).toBeNull();
  });
  it("rejects unsupported formats and empty files", () => {
    expect(validateUploadBatch([{ name: "a.docx", size: 10 }])).toMatch(/PDF/);
    expect(validateUploadBatch([{ name: "a.pdf", size: 0 }])).toMatch(/Empty/);
  });
  it("enforces per-file and batch limits", () => {
    expect(
      validateUploadBatch([{ name: "a.pdf", size: 26 * 1024 * 1024 }]),
    ).toMatch(/25/);
    expect(
      validateUploadBatch(
        Array.from({ length: 4 }, () => ({ name: "a.png", size: 1 })),
      ),
    ).toMatch(/3/);
  });
});

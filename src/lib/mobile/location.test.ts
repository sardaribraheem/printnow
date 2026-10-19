import { describe, it, expect } from "vitest";
import { optionalPoint } from "../../../mobile/src/core/location";
describe("native pickup location boundaries", () => {
  it("uses zone-only matching without an invented radius center", () => {
    expect(optionalPoint("", "")).toBeNull();
  });
  it("accepts an actual valid location, including zero coordinates", () => {
    expect(optionalPoint("31.5", "74.3")).toEqual({ lat: 31.5, lng: 74.3 });
    expect(optionalPoint("0", "0")).toEqual({ lat: 0, lng: 0 });
  });
  it.each([
    ["31", ""],
    ["", "74"],
    ["91", "74"],
    ["31", "-181"],
    ["NaN", "74"],
  ])("rejects invalid or incomplete pins %s, %s", (lat, lng) => {
    expect(() => optionalPoint(lat, lng)).toThrow();
  });
});

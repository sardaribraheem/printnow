import { expect, it } from "vitest";
import { byteRange } from "./ranges";
it("serves exact, open-ended and suffix ranges", () => {
  expect(byteRange(null, 100)).toBeNull();
  expect(byteRange("bytes=0-9", 100)).toEqual({ start: 0, end: 9 });
  expect(byteRange("bytes=95-", 100)).toEqual({ start: 95, end: 99 });
  expect(byteRange("bytes=-10", 100)).toEqual({ start: 90, end: 99 });
  expect(byteRange("bytes=0-500", 100)).toEqual({ start: 0, end: 99 });
});
it.each([
  "bytes=100-",
  "bytes=5-4",
  "bytes=-0",
  "bytes=0-2,4-8",
  "bytes=-",
  "bytes=a-b",
])("rejects invalid range %s", (value) => {
  expect(() => byteRange(value, 100)).toThrow();
});

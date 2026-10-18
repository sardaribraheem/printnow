import { expect, it } from "vitest";
import { safeReturnPath } from "./config";
it("permits only explicit local auth return destinations", () => {
  expect(safeReturnPath("/requests/new")).toBe("/requests/new");
  for (const path of [
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/login",
    "/history?next=https://evil.example",
    undefined,
  ])
    expect(safeReturnPath(path)).toBe("/");
});

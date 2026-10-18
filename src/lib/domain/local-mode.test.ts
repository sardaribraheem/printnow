import { expect, it } from "vitest";
import { isLocalDatabase } from "./local-mode";
it("allows sample identities only with an explicit loopback development database", () => {
  expect(
    isLocalDatabase(
      "postgresql://postgres@127.0.0.1:55432/postgres",
      "development",
    ),
  ).toBe(true);
  expect(
    isLocalDatabase(
      "postgresql://postgres@localhost:55432/postgres",
      "development",
    ),
  ).toBe(true);
});
it("rejects production, remote databases, missing bindings and invalid URLs", () => {
  for (const [url, mode] of [
    ["postgresql://postgres@127.0.0.1:55432/postgres", "production"],
    ["postgresql://user@database.example.com/app", "development"],
    ["https://localhost/", "development"],
    [undefined, "development"],
    ["not-a-url", "development"],
  ] as const)
    expect(isLocalDatabase(url, mode)).toBe(false);
});

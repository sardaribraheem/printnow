import { expect, it } from "vitest";
import { parseAuthMethods, unavailableAuthMethods } from "./methods";
it("offers email without advertising a disabled Google provider", () => {
  expect(
    parseAuthMethods({
      external: { email: true, google: false },
      disable_signup: false,
    }),
  ).toEqual({ reachable: true, email: true, google: false, signup: true });
});
it("respects disabled signup independently from login", () => {
  expect(
    parseAuthMethods({
      external: { email: true, google: true },
      disable_signup: true,
    }),
  ).toEqual({ reachable: true, email: true, google: true, signup: false });
});
it("fails closed for incomplete or malformed settings", () => {
  for (const value of [
    null,
    {},
    { external: { email: "true" }, disable_signup: false },
    { external: { email: true } },
  ])
    expect(parseAuthMethods(value)).toEqual(unavailableAuthMethods);
});

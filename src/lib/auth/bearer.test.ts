import { describe, expect, it } from "vitest";
import { bearerToken } from "./bearer";
describe("mobile bearer transport", () => {
  it("extracts a JWT without trusting or decoding it", () => {
    expect(
      bearerToken(
        new Headers({ Authorization: "Bearer header.claims.signature" }),
      ),
    ).toBe("header.claims.signature");
  });
  it("does not accept browser or sandbox cookies as mobile authentication", () => {
    expect(
      bearerToken(
        new Headers({
          Cookie:
            "printnow_sandbox=some-user; access_token=header.claims.signature",
        }),
      ),
    ).toBeNull();
  });
  it.each([
    "Basic header.claims.signature",
    "Bearer unsigned",
    "Bearer one.two",
    "Bearer one.two.three.four",
    "Bearer one.two.three extra",
    "Bearer a.b.",
  ])("rejects malformed authorization %s", (value) => {
    expect(bearerToken(new Headers({ Authorization: value }))).toBeNull();
  });
  it("bounds untrusted header size", () => {
    expect(
      bearerToken(
        new Headers({ Authorization: "Bearer " + "a".repeat(9000) + ".b.c" }),
      ),
    ).toBeNull();
  });
});

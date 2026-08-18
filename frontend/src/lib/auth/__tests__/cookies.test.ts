import { afterEach, describe, expect, it, vi } from "vitest";

import { isExpiringSoon } from "../cookies";

/** Build a JWT-shaped string. Only the payload is ever read. */
function tokenExpiringAt(secondsFromNow: number): string {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + secondsFromNow }),
  ).toString("base64url");
  return `header.${payload}.signature`;
}

describe("isExpiringSoon", () => {
  afterEach(() => vi.useRealTimers());

  it("treats a missing token as expired", () => {
    expect(isExpiringSoon(undefined)).toBe(true);
  });

  it("treats a token that is not a JWT as expired", () => {
    expect(isExpiringSoon("not-a-jwt")).toBe(true);
    expect(isExpiringSoon("only.two")).toBe(true);
  });

  it("treats a payload without an exp as expired", () => {
    const payload = Buffer.from(JSON.stringify({ sub: "1" })).toString("base64url");
    expect(isExpiringSoon(`header.${payload}.sig`)).toBe(true);
  });

  it("accepts a token with plenty of life left", () => {
    expect(isExpiringSoon(tokenExpiringAt(15 * 60))).toBe(false);
  });

  it("rejects a token that has already expired", () => {
    expect(isExpiringSoon(tokenExpiringAt(-60))).toBe(true);
  });

  it("refreshes early, so clock skew cannot cause a rejected request", () => {
    // Still valid, but only just: renew now rather than race the server.
    expect(isExpiringSoon(tokenExpiringAt(10))).toBe(true);
    expect(isExpiringSoon(tokenExpiringAt(45))).toBe(false);
  });

  it("honours a custom skew window", () => {
    expect(isExpiringSoon(tokenExpiringAt(60), 120)).toBe(true);
    expect(isExpiringSoon(tokenExpiringAt(60), 5)).toBe(false);
  });
});

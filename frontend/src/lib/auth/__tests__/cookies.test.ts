// @vitest-environment node
import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearAuthCookies,
  isExpiringSoon,
  setAuthCookies,
} from "../cookies";

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

describe("setAuthCookies", () => {
  const tokens = { access: "access-token", refresh: "refresh-token" };

  it("stores both tokens", () => {
    const response = NextResponse.json({});

    setAuthCookies(response, tokens);

    expect(response.cookies.get(ACCESS_COOKIE)?.value).toBe("access-token");
    expect(response.cookies.get(REFRESH_COOKIE)?.value).toBe("refresh-token");
  });

  it("keeps the tokens away from page scripts", () => {
    const response = NextResponse.json({});

    setAuthCookies(response, tokens);

    for (const name of [ACCESS_COOKIE, REFRESH_COOKIE]) {
      expect(response.cookies.get(name)?.httpOnly).toBe(true);
    }
  });

  it("uses SameSite=Lax, which is what blocks cross-site mutations", () => {
    const response = NextResponse.json({});

    setAuthCookies(response, tokens);

    expect(response.cookies.get(ACCESS_COOKIE)?.sameSite).toBe("lax");
  });

  it("scopes the cookies to the whole site", () => {
    const response = NextResponse.json({});

    setAuthCookies(response, tokens);

    expect(response.cookies.get(ACCESS_COOKIE)?.path).toBe("/");
  });

  it("expires the access token long before the refresh token", () => {
    const response = NextResponse.json({});

    setAuthCookies(response, tokens);

    const access = response.cookies.get(ACCESS_COOKIE)?.maxAge ?? 0;
    const refresh = response.cookies.get(REFRESH_COOKIE)?.maxAge ?? 0;
    expect(access).toBeLessThan(refresh);
    expect(access).toBe(15 * 60);
  });

  it("does not set Secure in development, where it would be dropped over http", () => {
    const response = NextResponse.json({});

    setAuthCookies(response, tokens);

    expect(response.cookies.get(ACCESS_COOKIE)?.secure).toBe(false);
  });
});

describe("clearAuthCookies", () => {
  it("empties both cookies and expires them immediately", () => {
    const response = NextResponse.json({});
    setAuthCookies(response, { access: "a", refresh: "b" });

    clearAuthCookies(response);

    for (const name of [ACCESS_COOKIE, REFRESH_COOKIE]) {
      expect(response.cookies.get(name)?.value).toBe("");
      expect(response.cookies.get(name)?.maxAge).toBe(0);
    }
  });
});

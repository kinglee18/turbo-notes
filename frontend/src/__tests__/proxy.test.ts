// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { proxy } from "../proxy";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/auth/cookies";

const refreshTokens = vi.fn();
vi.mock("@/lib/api/django", () => ({
  refreshTokens: (token: string) => refreshTokens(token),
}));

/** A JWT-shaped string whose payload expires `secondsFromNow` from now. */
function token(secondsFromNow: number): string {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + secondsFromNow }),
  ).toString("base64url");
  return `header.${payload}.signature`;
}

function request(path: string, cookies: Record<string, string> = {}) {
  const nextRequest = new NextRequest(`http://localhost:3000${path}`);
  for (const [name, value] of Object.entries(cookies)) {
    nextRequest.cookies.set(name, value);
  }
  return nextRequest;
}

const location = (response: Response) => response.headers.get("location");

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.resetAllMocks());

describe("signed out", () => {
  it("sends a visitor to the login page", async () => {
    const response = await proxy(request("/notes"));

    expect(response.status).toBe(307);
    expect(location(response)).toContain("/login");
  });

  it("guards individual notes too, not just the list", async () => {
    const response = await proxy(request("/notes/abc-123"));
    expect(location(response)).toContain("/login");
  });

  it("lets the login and signup pages through", async () => {
    for (const path of ["/login", "/signup"]) {
      const response = await proxy(request(path));
      expect(response.status).toBe(200);
    }
  });
});

describe("signed in", () => {
  const valid = { [ACCESS_COOKIE]: token(15 * 60), [REFRESH_COOKIE]: "refresh-token" };

  it("allows the notes list through untouched", async () => {
    const response = await proxy(request("/notes", valid));

    expect(response.status).toBe(200);
    expect(refreshTokens).not.toHaveBeenCalled();
  });

  it("bounces an already-authenticated user away from the login page", async () => {
    const response = await proxy(request("/login", valid));

    expect(response.status).toBe(307);
    expect(location(response)).toContain("/notes");
  });
});

describe("token renewal", () => {
  it("renews a token that is about to expire and re-sets both cookies", async () => {
    refreshTokens.mockResolvedValue({ access: token(900), refresh: "new-refresh" });

    const response = await proxy(
      request("/notes", {
        [ACCESS_COOKIE]: token(5), // valid, but inside the skew window
        [REFRESH_COOKIE]: "old-refresh",
      }),
    );

    expect(refreshTokens).toHaveBeenCalledWith("old-refresh");
    expect(response.status).toBe(200);
    expect(response.cookies.get(ACCESS_COOKIE)?.value).toBeTruthy();
    expect(response.cookies.get(REFRESH_COOKIE)?.value).toBe("new-refresh");
  });

  it("renews when the access cookie is missing but a refresh token remains", async () => {
    refreshTokens.mockResolvedValue({ access: token(900), refresh: "new-refresh" });

    const response = await proxy(request("/notes", { [REFRESH_COOKIE]: "still-good" }));

    expect(refreshTokens).toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("logs the user out when the refresh token is spent", async () => {
    refreshTokens.mockResolvedValue(null);

    const response = await proxy(request("/notes", { [REFRESH_COOKIE]: "expired" }));

    expect(location(response)).toContain("/login");
    // Cleared, so the next request doesn't pay for another round trip to
    // rediscover that this token is dead.
    expect(response.cookies.get(REFRESH_COOKIE)?.value).toBe("");
  });

  it("keeps a renewed user on the login page moving to their notes", async () => {
    refreshTokens.mockResolvedValue({ access: token(900), refresh: "new-refresh" });

    const response = await proxy(request("/login", { [REFRESH_COOKIE]: "good" }));

    expect(location(response)).toContain("/notes");
  });
});

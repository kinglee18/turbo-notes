import type { NextResponse } from "next/server";

export const ACCESS_COOKIE = "tn_access";
export const REFRESH_COOKIE = "tn_refresh";

const ACCESS_MAX_AGE = 15 * 60; // matches SIMPLE_JWT ACCESS_TOKEN_LIFETIME
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60;

/**
 * HttpOnly keeps the tokens out of reach of any script on the page, and
 * SameSite=Lax means the browser will not attach them to cross-site
 * mutations, which is what makes this CSRF-resistant without a token dance.
 */
function options(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    // Secure cookies are silently dropped over plain http://localhost.
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export interface TokenPair {
  access: string;
  refresh: string;
}

export function setAuthCookies(response: NextResponse, tokens: TokenPair): void {
  response.cookies.set(ACCESS_COOKIE, tokens.access, options(ACCESS_MAX_AGE));
  response.cookies.set(REFRESH_COOKIE, tokens.refresh, options(REFRESH_MAX_AGE));
}

export function clearAuthCookies(response: NextResponse): void {
  response.cookies.set(ACCESS_COOKIE, "", options(0));
  response.cookies.set(REFRESH_COOKIE, "", options(0));
}

/**
 * Read a JWT's `exp` without verifying its signature.
 *
 * Deliberately unverified: this is only a hint about when to refresh, and
 * Django is the authority on whether a token is actually valid. Checking the
 * signature here would mean giving the frontend the signing secret, which is
 * a real cost for no benefit — a forged token would still be rejected on the
 * next API call.
 */
export function isExpiringSoon(token: string | undefined, skewSeconds = 30): boolean {
  if (!token) return true;
  try {
    const [, payload] = token.split(".");
    const { exp } = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    if (typeof exp !== "number") return true;
    return exp * 1000 - Date.now() < skewSeconds * 1000;
  } catch {
    return true;
  }
}

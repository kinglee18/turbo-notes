import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearAuthCookies,
  isExpiringSoon,
  setAuthCookies,
} from "@/lib/auth/cookies";
import { refreshTokens } from "@/lib/api/django";

const LOGIN = "/login";
const HOME = "/notes";

/**
 * Refreshing has to happen here rather than in a page.
 *
 * A Server Component cannot write cookies while rendering, so if it were the
 * first thing to notice an expired access token it would have nowhere to put
 * the new one. This proxy runs before render and can mutate the response, so
 * by the time any page renders its access cookie is known to be fresh.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthPage = pathname === LOGIN || pathname === "/signup";

  let access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;

  let renewed: { access: string; refresh: string } | null = null;
  if (refresh && isExpiringSoon(access)) {
    renewed = await refreshTokens(refresh);
    access = renewed?.access;
  }

  const signedIn = Boolean(access);

  const response = signedIn
    ? isAuthPage
      ? NextResponse.redirect(new URL(HOME, request.url))
      : NextResponse.next()
    : isAuthPage
      ? NextResponse.next()
      : NextResponse.redirect(new URL(LOGIN, request.url));

  if (renewed) setAuthCookies(response, renewed);
  // A refresh token that Django rejected is spent; drop it so the next
  // request doesn't pay for another round trip to rediscover that.
  else if (refresh && !signedIn) clearAuthCookies(response);

  return response;
}

export const config = {
  matcher: ["/", "/login", "/signup", "/notes/:path*"],
};

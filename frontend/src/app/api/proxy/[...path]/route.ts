import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { DJANGO_URL, refreshTokens, safeJson } from "@/lib/api/django";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearAuthCookies,
  setAuthCookies,
} from "@/lib/auth/cookies";

/**
 * Every client-side request to the API passes through here.
 *
 * It attaches the access token from the httpOnly cookie, and on a 401 it
 * refreshes once and replays the request, so a token expiring mid-session is
 * invisible to the user.
 */
async function handle(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const target = `${DJANGO_URL}/api/${path.join("/")}/${request.nextUrl.search}`;

  // Read the body once: it cannot be streamed twice if we need to replay.
  const body = ["GET", "HEAD"].includes(request.method)
    ? undefined
    : await request.text();

  let access = request.cookies.get(ACCESS_COOKIE)?.value;
  let renewed: { access: string; refresh: string } | null = null;

  let upstream = await forward(target, request.method, body, access);

  if (upstream.status === 401) {
    const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
    renewed = refresh ? await refreshTokens(refresh) : null;

    if (renewed) {
      access = renewed.access;
      upstream = await forward(target, request.method, body, access);
    } else {
      const response = NextResponse.json({ detail: "Session expired." }, { status: 401 });
      clearAuthCookies(response);
      return response;
    }
  }

  const payload = upstream.status === 204 ? null : await safeJson(upstream);
  const response =
    payload === null
      ? new NextResponse(null, { status: upstream.status })
      : NextResponse.json(payload, { status: upstream.status });

  if (renewed) setAuthCookies(response, renewed);
  return response;
}

function forward(
  url: string,
  method: string,
  body: string | undefined,
  accessToken: string | undefined,
) {
  return fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body,
    cache: "no-store",
  });
}

export {
  handle as GET,
  handle as POST,
  handle as PATCH,
  handle as PUT,
  handle as DELETE,
};

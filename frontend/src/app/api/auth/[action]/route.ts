import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { ApiError, callDjango } from "@/lib/api/django";
import {
  REFRESH_COOKIE,
  clearAuthCookies,
  setAuthCookies,
  type TokenPair,
} from "@/lib/auth/cookies";
import type { User } from "@/lib/types";

type Action = "login" | "signup" | "logout";

const DJANGO_PATH: Record<Exclude<Action, "logout">, string> = {
  login: "/api/auth/login/",
  signup: "/api/auth/register/",
};

/**
 * The credential boundary: this is the only place tokens are turned into
 * cookies. The browser posts here with an email and password and gets back
 * only the user — never a token it could read.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  const { action } = await params;

  if (action === "logout") return logout(request);
  if (action !== "login" && action !== "signup") {
    return NextResponse.json({ detail: "Not found." }, { status: 404 });
  }

  let credentials: unknown;
  try {
    credentials = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid request body." }, { status: 400 });
  }

  try {
    const result = await callDjango<TokenPair & { user: User }>({
      path: DJANGO_PATH[action],
      method: "POST",
      body: credentials,
    });

    const response = NextResponse.json(
      { user: result.user },
      { status: action === "signup" ? 201 : 200 },
    );
    setAuthCookies(response, result);
    return response;
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(error.data, { status: error.status });
    }
    return NextResponse.json({ detail: "Could not reach the server." }, { status: 502 });
  }
}

async function logout(request: NextRequest) {
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;

  // Blacklist server-side as well as clearing cookies: otherwise a stolen
  // refresh token would stay valid for its full seven days.
  if (refresh) {
    await callDjango({
      path: "/api/auth/logout/",
      method: "POST",
      body: { refresh },
      accessToken: request.cookies.get("tn_access")?.value,
    }).catch(() => undefined);
  }

  const response = new NextResponse(null, { status: 204 });
  clearAuthCookies(response);
  return response;
}

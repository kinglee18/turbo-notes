/**
 * The only module that knows Django's address.
 *
 * The browser never calls Django directly: every request goes through a Next
 * route handler, which is why the API needs no CORS configuration at all.
 */

export const DJANGO_URL =
  process.env.DJANGO_API_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8000";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly data: unknown,
  ) {
    super(`Django responded ${status}`);
    this.name = "ApiError";
  }
}

interface DjangoRequest {
  path: string;
  method?: string;
  body?: unknown;
  accessToken?: string;
}

export async function callDjango<T>({
  path,
  method = "GET",
  body,
  accessToken,
}: DjangoRequest): Promise<T> {
  const response = await fetch(`${DJANGO_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new ApiError(response.status, await safeJson(response));
  }

  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/** Exchange a refresh token for a fresh pair. Returns null if it is spent. */
export async function refreshTokens(
  refresh: string,
): Promise<{ access: string; refresh: string } | null> {
  try {
    return await callDjango({
      path: "/api/auth/refresh/",
      method: "POST",
      body: { refresh },
    });
  } catch {
    return null;
  }
}

import type { Category, CategorySlug, Note, Paginated } from "@/lib/types";

/**
 * Browser-side API access. Everything goes through /api/proxy, which is
 * same-origin, so the httpOnly auth cookies ride along automatically and
 * there is no token for page scripts to touch.
 */

export class ClientApiError extends Error {
  constructor(
    readonly status: number,
    readonly data: unknown,
  ) {
    super(`Request failed with ${status}`);
    this.name = "ClientApiError";
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Let the request outlive the page, for saves fired during unload. */
  keepalive?: boolean;
  signal?: AbortSignal;
}

export async function apiFetch<T>(
  path: string,
  { method = "GET", body, keepalive, signal }: RequestOptions = {},
): Promise<T> {
  const response = await fetch(`/api/proxy/${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      // A cross-origin HTML form cannot set a custom header, so requiring
      // one here is a cheap second line of defence behind SameSite=Lax.
      "X-Requested-With": "turbo-notes",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    keepalive,
    signal,
  });

  if (!response.ok) {
    let data: unknown = null;
    try {
      data = await response.json();
    } catch {
      /* empty body */
    }
    throw new ClientApiError(response.status, data);
  }

  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export const notesApi = {
  list: (params: { category?: string; q?: string }) => {
    const query = new URLSearchParams();
    if (params.category) query.set("category", params.category);
    if (params.q) query.set("q", params.q);
    return apiFetch<Paginated<Note>>(`notes${query.size ? `?${query}` : ""}`);
  },

  create: (category: CategorySlug) =>
    apiFetch<Note>("notes", { method: "POST", body: { category } }),

  update: (id: string, changes: Partial<Note>, options?: { keepalive?: boolean }) =>
    apiFetch<Note>(`notes/${id}`, {
      method: "PATCH",
      body: changes,
      keepalive: options?.keepalive,
    }),

  remove: (id: string, options?: { keepalive?: boolean }) =>
    apiFetch<void>(`notes/${id}`, { method: "DELETE", keepalive: options?.keepalive }),

  restore: (id: string) => apiFetch<Note>(`notes/${id}/restore`, { method: "POST" }),
};

export const categoriesApi = {
  list: () => apiFetch<Category[]>("categories"),
};

export const authApi = {
  logout: () => fetch("/api/auth/logout", { method: "POST" }),
};

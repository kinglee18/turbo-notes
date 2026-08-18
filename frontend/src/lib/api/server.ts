import { cookies } from "next/headers";

import { callDjango } from "./django";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";
import type { Category, Note, Paginated } from "@/lib/types";

/**
 * Data fetching for Server Components.
 *
 * These talk to Django directly rather than looping back through the proxy.
 * Middleware has already refreshed the access cookie by the time any of this
 * runs, so the token here is known to be fresh.
 */
async function accessToken(): Promise<string | undefined> {
  return (await cookies()).get(ACCESS_COOKIE)?.value;
}

export async function fetchCategories(): Promise<Category[]> {
  return callDjango<Category[]>({
    path: "/api/categories/",
    accessToken: await accessToken(),
  });
}

export async function fetchNotes(searchParams: {
  category?: string;
  q?: string;
}): Promise<Paginated<Note>> {
  const query = new URLSearchParams();
  if (searchParams.category) query.set("category", searchParams.category);
  if (searchParams.q) query.set("q", searchParams.q);
  const suffix = query.size ? `?${query}` : "";

  return callDjango<Paginated<Note>>({
    path: `/api/notes/${suffix}`,
    accessToken: await accessToken(),
  });
}

export async function fetchNote(id: string): Promise<Note> {
  return callDjango<Note>({
    path: `/api/notes/${id}/`,
    accessToken: await accessToken(),
  });
}

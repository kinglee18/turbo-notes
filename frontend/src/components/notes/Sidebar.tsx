"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { authApi } from "@/lib/api/client";
import type { Category } from "@/lib/types";

export function Sidebar({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selected = searchParams.get("category");

  // The filter lives in the URL rather than component state, so it survives a
  // reload, works with the back button, and is shareable.
  function hrefFor(slug: string | null) {
    const next = new URLSearchParams(searchParams);
    if (slug) next.set("category", slug);
    else next.delete("category");
    return `/notes${next.size ? `?${next}` : ""}`;
  }

  async function logout() {
    await authApi.logout();
    router.replace("/login");
    router.refresh();
  }

  return (
    <aside className="flex w-48 shrink-0 flex-col justify-between">
      <nav aria-label="Categories">
        <Link
          href={hrefFor(null)}
          aria-current={selected ? undefined : "page"}
          className={`block text-xs ${selected ? "text-ink/70" : "font-bold text-ink"}`}
        >
          All Categories
        </Link>

        <ul className="mt-3 space-y-2">
          {categories.map((category) => {
            const active = selected === category.slug;
            return (
              <li key={category.slug}>
                <Link
                  href={hrefFor(category.slug)}
                  data-category={category.slug}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-2 text-xs ${active ? "font-bold text-ink" : "text-ink/70"}`}
                >
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-full bg-[var(--cat-dot)]"
                  />
                  <span className="flex-1 truncate">{category.name}</span>
                  <span className="tabular-nums text-ink/50">{category.note_count}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <button
        onClick={logout}
        className="mt-8 self-start text-xs text-muted underline underline-offset-2 hover:text-accent"
      >
        Log out
      </button>
    </aside>
  );
}

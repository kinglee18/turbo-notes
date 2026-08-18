"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { authApi } from "@/lib/api/client";
import type { Category } from "@/lib/types";

/**
 * Below `lg` each entry is a wrapping pill with a 44px tap target, so the nav
 * reflows into rows above the grid instead of holding a 192px column open on a
 * phone. Every chip class is reverted at `lg`, where this is the bare text link
 * it has always been.
 */
const LINK =
  "inline-flex min-h-11 items-center gap-2 rounded-full " +
  "border border-[color-mix(in_oklab,var(--color-accent)_25%,transparent)] " +
  "bg-surface px-3 text-xs " +
  "lg:min-h-0 lg:rounded-none lg:border-0 lg:bg-transparent lg:px-0";

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
    <aside className="flex w-full shrink-0 flex-col gap-3 lg:w-48 lg:justify-between lg:gap-0">
      <nav
        aria-label="Categories"
        className="flex flex-wrap items-center gap-2 lg:flex-col lg:items-stretch lg:gap-0"
      >
        <Link
          href={hrefFor(null)}
          aria-current={selected ? undefined : "page"}
          className={`${LINK} ${selected ? "text-ink/70" : "font-bold text-ink"}`}
        >
          All Categories
        </Link>

        <ul className="flex flex-wrap items-center gap-2 lg:mt-3 lg:w-full lg:flex-col lg:items-stretch lg:gap-2">
          {categories.map((category) => {
            const active = selected === category.slug;
            return (
              <li key={category.slug} className="lg:w-full">
                <Link
                  href={hrefFor(category.slug)}
                  data-category={category.slug}
                  aria-current={active ? "page" : undefined}
                  className={`${LINK} lg:flex lg:w-full ${active ? "font-bold text-ink" : "text-ink/70"}`}
                >
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-full bg-[var(--cat-dot)]"
                  />
                  <span className="truncate lg:flex-1">{category.name}</span>
                  <span className="tabular-nums text-ink/50">{category.note_count}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <button
        onClick={logout}
        className="inline-flex min-h-11 items-center self-start text-xs text-muted underline underline-offset-2 hover:text-accent lg:mt-8 lg:min-h-0"
      >
        Log out
      </button>
    </aside>
  );
}

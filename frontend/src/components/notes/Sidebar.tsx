"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { authApi } from "@/lib/api/client";
import type { Category } from "@/lib/types";

/**
 * Below `lg` each entry is a pill with a 44px tap target, laid out as one
 * horizontally scrollable row rather than a 192px column. Every chip class is
 * reverted at `lg`, where this is the bare text link it has always been.
 *
 * `shrink-0` and `whitespace-nowrap` matter: without them the flex row
 * compresses the chips to fit instead of letting the strip scroll, and
 * "Random Thoughts" wraps onto two lines inside its own pill.
 */
const LINK =
  "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full whitespace-nowrap " +
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
    // `contents` below lg so the nav and the log-out button become children of
    // the page's own flex column. The nav can then stick against the full
    // scroll height; nested inside a short aside it would unstick almost
    // immediately, having nothing left to travel over.
    <aside className="contents lg:flex lg:w-48 lg:shrink-0 lg:flex-col lg:justify-between">
      <nav
        aria-label="Categories"
        // Full-bleed (-mx-4 px-4) so the paper background covers the whole
        // width as cards scroll underneath, rather than leaving a gutter.
        className="no-scrollbar sticky top-0 z-20 -mx-4 flex items-center gap-2 overflow-x-auto border-b border-[color-mix(in_oklab,var(--color-accent)_18%,transparent)] bg-paper px-4 py-3 sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:flex-col lg:items-stretch lg:gap-0 lg:overflow-visible lg:border-b-0 lg:bg-transparent lg:p-0"
      >
        <Link
          href={hrefFor(null)}
          aria-current={selected ? undefined : "page"}
          className={`${LINK} ${selected ? "text-ink/70" : "font-bold text-ink"}`}
        >
          All Categories
        </Link>

        <ul className="flex shrink-0 items-center gap-2 lg:mt-3 lg:w-full lg:flex-col lg:items-stretch lg:gap-2">
          {categories.map((category) => {
            const active = selected === category.slug;
            return (
              <li key={category.slug} className="shrink-0 lg:w-full">
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

      {/* order-last drops this to the foot of the page on mobile, where it
          reads as a footer rather than sitting between the filters and the
          notes taking up a row of its own. */}
      <button
        onClick={logout}
        className="order-last inline-flex min-h-11 items-center self-start text-xs text-muted underline underline-offset-2 hover:text-accent lg:order-none lg:mt-8 lg:min-h-0"
      >
        Log out
      </button>
    </aside>
  );
}

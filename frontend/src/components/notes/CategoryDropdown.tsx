"use client";

import { useEffect, useRef, useState } from "react";

import type { Category, CategorySlug } from "@/lib/types";

interface CategoryDropdownProps {
  categories: Category[];
  value: CategorySlug;
  onChange: (slug: CategorySlug) => void;
}

export function CategoryDropdown({ categories, value, onChange }: CategoryDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const current = categories.find((category) => category.slug === value);
  const others = categories.filter((category) => category.slug !== value);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((shown) => !shown)}
        aria-haspopup="listbox"
        aria-expanded={open}
        data-category={value}
        className="flex w-44 items-center gap-2 rounded-lg border border-[var(--cat-border)] bg-surface px-3 py-1.5 text-xs text-ink sm:w-52"
      >
        <span aria-hidden className="size-2 rounded-full bg-[var(--cat-dot)]" />
        <span className="flex-1 text-left">{current?.name ?? "Uncategorised"}</span>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Category"
          className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-[color-mix(in_oklab,var(--color-accent)_25%,transparent)] bg-surface py-1 shadow-sm"
        >
          {others.map((category) => (
            <li key={category.slug}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                data-category={category.slug}
                onClick={() => {
                  onChange(category.slug);
                  setOpen(false);
                }}
                className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-xs text-ink hover:bg-[var(--cat-fill)] lg:min-h-0 lg:py-1.5"
              >
                <span aria-hidden className="size-2 rounded-full bg-[var(--cat-dot)]" />
                {category.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden
      className={`transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

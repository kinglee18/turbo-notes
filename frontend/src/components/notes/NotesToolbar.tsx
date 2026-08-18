"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { notesApi } from "@/lib/api/client";
import { isCategorySlug } from "@/lib/types";

export function NotesToolbar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [creating, setCreating] = useState(false);
  const [failed, setFailed] = useState(false);

  const currentQuery = searchParams.get("q") ?? "";

  // Push the search term into the URL after a pause, so the server component
  // refetches once the user stops typing rather than on every keystroke.
  useEffect(() => {
    if (query === currentQuery) return;

    const timer = setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      if (query) next.set("q", query);
      else next.delete("q");
      startTransition(() => router.replace(`/notes${next.size ? `?${next}` : ""}`));
    }, 300);

    return () => clearTimeout(timer);
  }, [query, currentQuery, router, searchParams]);

  async function createNote() {
    setCreating(true);
    setFailed(false);
    try {
      // Create on the server first so the editor has a real id and URL, and
      // so "Last Edited" is truthful from the very first paint.
      const filter = searchParams.get("category");
      const category = isCategorySlug(filter) ? filter : "random-thoughts";
      const note = await notesApi.create(category);
      router.push(`/notes/${note.id}`);
    } catch {
      // Caught rather than left to become an unhandled rejection: without
      // this the button silently re-enables and the user is never told why
      // nothing opened.
      setFailed(true);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mb-6 flex items-center justify-end gap-3">
      <p role="alert" className="text-xs text-red-800">
        {failed && "Couldn't start a new note."}
      </p>

      <label className="sr-only" htmlFor="note-search">
        Search notes
      </label>
      <input
        id="note-search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search your notes…"
        className="w-56 rounded-full border border-[color-mix(in_oklab,var(--color-accent)_35%,transparent)] bg-surface px-4 py-2 text-xs text-ink placeholder:text-muted"
      />

      <Button onClick={createNote} disabled={creating}>
        <span aria-hidden>+</span> New Note
      </Button>
    </div>
  );
}

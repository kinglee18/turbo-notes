"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { CategoryDropdown } from "./CategoryDropdown";
import { useAutosave, type SaveStatus } from "@/hooks/useAutosave";
import { ClientApiError, notesApi } from "@/lib/api/client";
import { formatLastEdited } from "@/lib/format";
import type { Category, CategorySlug, Note } from "@/lib/types";

type Draft = Pick<Note, "title" | "body" | "category">;

interface NoteEditorProps {
  note: Note;
  categories: Category[];
}

export function NoteEditor({ note, categories }: NoteEditorProps) {
  const router = useRouter();

  const [draft, setDraft] = useState<Draft>({
    title: note.title,
    body: note.body,
    category: note.category,
  });
  const [lastEdited, setLastEdited] = useState(note.updated_at);
  const [deleting, setDeleting] = useState(false);

  // Tracks whether this note has ever held content, so an untouched note
  // created by "+ New Note" can be cleaned up on the way out.
  const everHadContent = useRef(Boolean(note.title || note.body));

  const { status, change, flush } = useAutosave<Draft>({
    saved: { title: note.title, body: note.body, category: note.category },
    save: async (changes, { keepalive }) => {
      const updated = await notesApi.update(note.id, changes, { keepalive });
      // Take the timestamp from the response rather than reading a local
      // clock, so what's displayed is by construction what's in the database.
      setLastEdited(updated.updated_at);
      return {
        title: updated.title,
        body: updated.body,
        category: updated.category,
      };
    },
    // Validation errors and an expired session will never succeed on retry.
    isFatal: (error) =>
      error instanceof ClientApiError && error.status >= 400 && error.status < 500,
  });

  const edit = useCallback(
    (patch: Partial<Draft>) => {
      setDraft((previous) => {
        const next = { ...previous, ...patch };
        if (next.title || next.body) everHadContent.current = true;
        change(next);
        return next;
      });
    },
    [change],
  );

  async function close() {
    await flush();

    // A note created but never written to is an accident of "+ New Note"
    // routing straight into the editor; don't leave it cluttering the grid.
    if (!everHadContent.current && !draft.title && !draft.body) {
      await notesApi.remove(note.id).catch(() => undefined);
    }

    router.push("/notes");
    router.refresh();
  }

  async function remove() {
    setDeleting(true);
    await notesApi.remove(note.id).catch(() => undefined);
    router.push(`/notes?undo=${note.id}`);
    router.refresh();
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "s") {
        event.preventDefault();
        void flush();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [flush]);

  return (
    <main
      data-category={draft.category}
      className="mx-auto flex h-screen max-w-5xl flex-col gap-3 px-8 py-6"
    >
      <div className="flex items-center justify-between">
        <CategoryDropdown
          categories={categories}
          value={draft.category}
          onChange={(category: CategorySlug) => edit({ category })}
        />

        <div className="flex items-center gap-3">
          <button
            onClick={remove}
            disabled={deleting}
            className="text-xs text-muted underline underline-offset-2 hover:text-red-800"
          >
            Delete
          </button>
          <button onClick={close} aria-label="Close note" className="text-ink/60 hover:text-ink">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden rounded-panel border border-[var(--cat-border)] bg-[var(--cat-fill)] p-6 transition-colors duration-300">
        <div className="mb-3 flex items-baseline justify-end gap-3 text-[11px] text-ink/60">
          <SaveIndicator status={status} />
          <time dateTime={lastEdited} suppressHydrationWarning>
            {formatLastEdited(lastEdited)}
          </time>
        </div>

        <input
          value={draft.title}
          onChange={(event) => edit({ title: event.target.value })}
          onBlur={() => void flush()}
          placeholder="Note Title"
          aria-label="Note title"
          className="editor-field w-full bg-transparent font-display text-2xl text-ink outline-none placeholder:text-ink/45"
        />

        <textarea
          value={draft.body}
          onChange={(event) => edit({ body: event.target.value })}
          onBlur={() => void flush()}
          placeholder="Pour your heart out..."
          aria-label="Note body"
          className="editor-field mt-3 w-full flex-1 resize-none bg-transparent text-sm leading-relaxed text-ink outline-none placeholder:text-ink/45"
        />
      </div>
    </main>
  );
}

const MESSAGES: Record<SaveStatus, string> = {
  idle: "",
  saving: "Saving…",
  saved: "Saved",
  error: "Couldn't save — retrying",
};

/** The design has no save button, so the state of the save has to be visible. */
function SaveIndicator({ status }: { status: SaveStatus }) {
  return (
    <span
      aria-live="polite"
      className={status === "error" ? "text-red-800" : "text-ink/60"}
    >
      {MESSAGES[status]}
    </span>
  );
}

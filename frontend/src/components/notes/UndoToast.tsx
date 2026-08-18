"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { notesApi } from "@/lib/api/client";

const VISIBLE_MS = 6_000;

/**
 * Offers to undo the delete that just happened.
 *
 * Deletes are soft on the server, so restoring is a real operation rather
 * than a client-side illusion — the note comes back with its content and
 * timestamps intact.
 */
export function UndoToast() {
  const noteId = useSearchParams().get("undo");
  if (!noteId) return null;

  // Keying on the id remounts the toast for each delete, which resets the
  // countdown without an effect reaching back in to reset state.
  return <Toast key={noteId} noteId={noteId} />;
}

function Toast({ noteId }: { noteId: string }) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDismissed(true), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, []);

  if (dismissed) return null;

  async function restore() {
    setDismissed(true);
    await notesApi.restore(noteId).catch(() => undefined);
    router.replace("/notes");
    router.refresh();
  }

  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-4 rounded-full border border-[color-mix(in_oklab,var(--color-accent)_35%,transparent)] bg-surface px-5 py-2.5 text-xs text-ink shadow-sm"
    >
      <span>Note deleted.</span>
      <button
        onClick={restore}
        className="font-semibold text-accent underline underline-offset-2"
      >
        Undo
      </button>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

import { formatCardDate, parseBody } from "@/lib/format";
import type { Category, Note } from "@/lib/types";

interface NoteCardProps {
  note: Note;
  categoryName: string;
}

export function NoteCard({ note, categoryName }: NoteCardProps) {
  return (
    <Link
      href={`/notes/${note.id}`}
      data-category={note.category}
      className="flex h-56 flex-col overflow-hidden rounded-card border bg-[var(--cat-fill)] border-[var(--cat-border)] p-4 transition-transform hover:-translate-y-0.5"
    >
      <p className="mb-1 flex items-baseline gap-2 text-[11px]">
        <CardDate iso={note.updated_at} />
        <span className="text-ink/55">{categoryName}</span>
      </p>

      <h2 className="font-display text-lg leading-tight break-words text-ink">
        {note.title || "Untitled"}
      </h2>

      <BodyPreview body={note.body} />
    </Link>
  );
}

const NEVER_CHANGES = () => () => {};

/**
 * "today" depends on the reader's clock and timezone, which the server does
 * not know, so the server's answer and the browser's can differ.
 *
 * useSyncExternalStore is the right tool: it hands back the server snapshot
 * during SSR and hydration, then re-renders once with the client snapshot.
 * That gets the correct local label without a setState in an effect, which
 * would cause a second cascading render on every card.
 */
function CardDate({ iso }: { iso: string }) {
  // Subscribing here does nothing except buy one guaranteed re-render after
  // hydration, at which point new Date() reflects the reader's own clock.
  useSyncExternalStore(
    NEVER_CHANGES,
    () => true,
    () => false,
  );

  return (
    <time dateTime={iso} suppressHydrationWarning className="font-semibold text-ink">
      {formatCardDate(iso, new Date())}
    </time>
  );
}

function BodyPreview({ body }: { body: string }) {
  const blocks = parseBody(body);

  if (blocks.length === 0) {
    return <p className="mt-2 text-xs text-ink/50">Note content…</p>;
  }

  return (
    <div className="mt-2 flex-1 space-y-1 overflow-hidden break-words text-xs leading-relaxed text-ink/80">
      {blocks.map((block, index) =>
        block.kind === "list" ? (
          <ul key={index} className="list-disc space-y-0.5 pl-4">
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>{item}</li>
            ))}
          </ul>
        ) : (
          <p key={index}>{block.text}</p>
        ),
      )}
    </div>
  );
}

export function NoteGrid({ notes, categories }: { notes: Note[]; categories: Category[] }) {
  const names = new Map(categories.map((category) => [category.slug, category.name]));

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {notes.map((note) => (
        <NoteCard
          key={note.id}
          note={note}
          categoryName={names.get(note.category) ?? note.category}
        />
      ))}
    </div>
  );
}

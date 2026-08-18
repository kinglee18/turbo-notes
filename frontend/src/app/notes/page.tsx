import Image from "next/image";

import { NoteGrid } from "@/components/notes/NoteCard";
import { NotesToolbar } from "@/components/notes/NotesToolbar";
import { Sidebar } from "@/components/notes/Sidebar";
import { UndoToast } from "@/components/notes/UndoToast";
import { fetchCategories, fetchNotes } from "@/lib/api/server";

interface NotesPageProps {
  searchParams: Promise<{ category?: string; q?: string }>;
}

export default async function NotesPage({ searchParams }: NotesPageProps) {
  const filters = await searchParams;

  // Fetched on the server so the grid is in the first paint, with no spinner
  // and no flash of an empty layout.
  const [categories, notes] = await Promise.all([
    fetchCategories(),
    fetchNotes(filters),
  ]);

  const searching = Boolean(filters.q);

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl gap-8 px-8 py-10">
      <Sidebar categories={categories} />

      <section className="flex-1">
        <NotesToolbar />

        {notes.results.length > 0 ? (
          <NoteGrid notes={notes.results} categories={categories} />
        ) : searching ? (
          <p className="mt-24 text-center text-sm text-accent">
            Nothing matches “{filters.q}”.
          </p>
        ) : (
          <EmptyState />
        )}
      </section>

      <UndoToast />
    </main>
  );
}

function EmptyState() {
  return (
    <div className="mt-16 flex flex-col items-center">
      <Image
        src="/illustrations/bubble-tea.png"
        alt="A cheerful cup of bubble tea"
        width={200}
        height={200}
        priority
        className="h-auto w-auto"
      />
      <p className="mt-2 text-sm text-accent">
        I&apos;m just here waiting for your charming notes...
      </p>
    </div>
  );
}

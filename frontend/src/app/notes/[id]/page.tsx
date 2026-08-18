import { notFound } from "next/navigation";

import { NoteEditor } from "@/components/notes/NoteEditor";
import { ApiError } from "@/lib/api/django";
import { fetchCategories, fetchNote } from "@/lib/api/server";

export default async function NotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  try {
    const [note, categories] = await Promise.all([fetchNote(id), fetchCategories()]);
    return <NoteEditor note={note} categories={categories} />;
  } catch (error) {
    // Someone else's note is a 404 from the API, and should be a 404 here too.
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

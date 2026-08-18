import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NoteCard, NoteGrid } from "../NoteCard";
import type { Category, Note } from "@/lib/types";

const NOTE: Note = {
  id: "abc-123",
  category: "school",
  title: "Meeting with Team",
  body: "Discuss project timeline and milestones.",
  created_at: "2024-07-20T10:00:00Z",
  updated_at: "2024-07-20T10:00:00Z",
};

const CATEGORIES: Category[] = [
  { slug: "school", name: "School", note_count: 1 },
  { slug: "personal", name: "Personal", note_count: 0 },
];

describe("NoteCard", () => {
  it("shows the title, preview and category", () => {
    render(<NoteCard note={NOTE} categoryName="School" />);

    expect(screen.getByText("Meeting with Team")).toBeInTheDocument();
    expect(screen.getByText(/Discuss project timeline/)).toBeInTheDocument();
    expect(screen.getByText("School")).toBeInTheDocument();
  });

  it("links to its own editor route", () => {
    render(<NoteCard note={NOTE} categoryName="School" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/notes/abc-123");
  });

  it("carries the category as a data attribute, which is what colours it", () => {
    render(<NoteCard note={NOTE} categoryName="School" />);
    expect(screen.getByRole("link")).toHaveAttribute("data-category", "school");
  });

  it("renders dashed lines as a real list", () => {
    render(
      <NoteCard
        note={{ ...NOTE, body: "- Milk\n- Eggs" }}
        categoryName="School"
      />,
    );

    const items = screen.getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual(["Milk", "Eggs"]);
  });

  it("falls back to a placeholder when the note has no title", () => {
    render(<NoteCard note={{ ...NOTE, title: "" }} categoryName="School" />);
    expect(screen.getByText("Untitled")).toBeInTheDocument();
  });

  it("hints at empty content rather than showing a blank card", () => {
    render(<NoteCard note={{ ...NOTE, body: "" }} categoryName="School" />);
    expect(screen.getByText("Note content…")).toBeInTheDocument();
  });
});

describe("NoteGrid", () => {
  it("resolves each note's category to its display name", () => {
    render(<NoteGrid notes={[NOTE]} categories={CATEGORIES} />);
    expect(screen.getByText("School")).toBeInTheDocument();
  });

  it("renders one card per note", () => {
    render(
      <NoteGrid
        notes={[NOTE, { ...NOTE, id: "def-456", title: "Second" }]}
        categories={CATEGORIES}
      />,
    );
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });
});

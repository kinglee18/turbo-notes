import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NoteEditor } from "../NoteEditor";
import type { Category, Note } from "@/lib/types";

const router = { push: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const update = vi.fn();
const remove = vi.fn();
vi.mock("@/lib/api/client", () => ({
  ClientApiError: class extends Error {
    constructor(
      readonly status: number,
      readonly data: unknown,
    ) {
      super("failed");
    }
  },
  notesApi: {
    update: (id: string, changes: unknown, options: unknown) =>
      update(id, changes, options),
    remove: (id: string) => remove(id),
  },
}));

const CATEGORIES: Category[] = [
  { slug: "random-thoughts", name: "Random Thoughts", note_count: 1 },
  { slug: "school", name: "School", note_count: 0 },
  { slug: "personal", name: "Personal", note_count: 0 },
  { slug: "drama", name: "Drama", note_count: 0 },
];

const EMPTY_NOTE: Note = {
  id: "note-1",
  category: "random-thoughts",
  title: "",
  body: "",
  created_at: "2024-07-21T20:38:00Z",
  updated_at: "2024-07-21T20:38:00Z",
};

const WRITTEN_NOTE: Note = { ...EMPTY_NOTE, title: "Grocery List", body: "- Milk" };

beforeEach(() => {
  vi.clearAllMocks();
  update.mockImplementation(async (_id, changes) => ({
    ...WRITTEN_NOTE,
    ...(changes as object),
    updated_at: "2024-07-22T09:00:00Z",
  }));
  remove.mockResolvedValue(undefined);
});

afterEach(() => vi.useRealTimers());

const renderEditor = (note = WRITTEN_NOTE) =>
  render(<NoteEditor note={note} categories={CATEGORIES} />);

describe("rendering", () => {
  it("shows the note's content", () => {
    renderEditor();

    expect(screen.getByLabelText("Note title")).toHaveValue("Grocery List");
    expect(screen.getByLabelText("Note body")).toHaveValue("- Milk");
  });

  it("uses the design's placeholders for an empty note", () => {
    renderEditor(EMPTY_NOTE);

    expect(screen.getByPlaceholderText("Note Title")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Pour your heart out...")).toBeInTheDocument();
  });

  it("shows when the note was last edited", () => {
    renderEditor();
    expect(screen.getByText(/Last Edited: July 21, 2024/)).toBeInTheDocument();
  });

  it("carries the category as the data attribute that colours the page", () => {
    const { container } = renderEditor();
    expect(container.querySelector("main")).toHaveAttribute(
      "data-category",
      "random-thoughts",
    );
  });
});

describe("autosave", () => {
  beforeEach(() => vi.useFakeTimers());

  it("saves after the user stops typing", async () => {
    renderEditor();

    fireEvent.change(screen.getByLabelText("Note title"), {
      target: { value: "Grocery List v2" },
    });
    expect(update).not.toHaveBeenCalled();

    await act(async () => void vi.advanceTimersByTime(800));

    expect(update).toHaveBeenCalledWith(
      "note-1",
      { title: "Grocery List v2" },
      { keepalive: false },
    );
  });

  it("shows that the save happened, since there is no save button", async () => {
    renderEditor();

    fireEvent.change(screen.getByLabelText("Note body"), {
      target: { value: "- Milk\n- Eggs" },
    });
    await act(async () => void vi.advanceTimersByTime(800));

    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("retimes Last Edited from the server's answer, not the local clock", async () => {
    renderEditor();

    fireEvent.change(screen.getByLabelText("Note title"), {
      target: { value: "Renamed" },
    });
    await act(async () => void vi.advanceTimersByTime(800));

    expect(screen.getByText(/Last Edited: July 22, 2024/)).toBeInTheDocument();
  });

  it("saves immediately on blur instead of waiting out the debounce", async () => {
    renderEditor();

    const title = screen.getByLabelText("Note title");
    fireEvent.change(title, { target: { value: "Blurred" } });
    await act(async () => {
      fireEvent.blur(title);
    });

    expect(update).toHaveBeenCalledOnce();
  });
});

describe("category", () => {
  it("recolours the page the moment a category is picked", async () => {
    const { container } = renderEditor();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /Random Thoughts/ }));
    await user.click(screen.getByRole("option", { name: "Personal" }));

    expect(container.querySelector("main")).toHaveAttribute(
      "data-category",
      "personal",
    );
  });

  it("persists the new category", async () => {
    renderEditor();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /Random Thoughts/ }));
    await user.click(screen.getByRole("option", { name: "School" }));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        "note-1",
        { category: "school" },
        expect.anything(),
      ),
    );
  });
});

describe("leaving the editor", () => {
  it("returns to the grid on close", async () => {
    renderEditor();

    await userEvent.click(screen.getByLabelText("Close note"));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/notes"));
  });

  it("discards a note created by mistake and never touched", async () => {
    renderEditor(EMPTY_NOTE);

    await userEvent.click(screen.getByLabelText("Close note"));

    await waitFor(() => expect(remove).toHaveBeenCalledWith("note-1"));
  });

  it("keeps a note whose only edit was choosing a category", async () => {
    // Regression: filing a note under a category then closing used to delete
    // it, because "touched" only counted title and body text.
    renderEditor(EMPTY_NOTE);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /Random Thoughts/ }));
    await user.click(screen.getByRole("option", { name: "Personal" }));
    await user.click(screen.getByLabelText("Close note"));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/notes"));
    expect(remove).not.toHaveBeenCalled();
  });

  it("keeps a note that has content", async () => {
    renderEditor();

    await userEvent.click(screen.getByLabelText("Close note"));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/notes"));
    expect(remove).not.toHaveBeenCalled();
  });

  it("offers an undo after deleting", async () => {
    renderEditor();

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith("/notes?undo=note-1"),
    );
    expect(remove).toHaveBeenCalledWith("note-1");
  });
});

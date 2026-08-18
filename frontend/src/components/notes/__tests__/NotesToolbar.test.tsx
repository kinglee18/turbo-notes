import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NotesToolbar } from "../NotesToolbar";

const searchParams = { current: new URLSearchParams() };
const router = { replace: vi.fn(), push: vi.fn(), refresh: vi.fn() };

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => searchParams.current,
}));

const create = vi.fn();
vi.mock("@/lib/api/client", () => ({
  notesApi: { create: (slug: string) => create(slug) },
}));

beforeEach(() => {
  vi.clearAllMocks();
  create.mockResolvedValue({ id: "new-note-id" });
  searchParams.current = new URLSearchParams();
});

afterEach(() => vi.useRealTimers());

/**
 * Types one character at a time.
 *
 * fireEvent rather than userEvent here: userEvent awaits between keystrokes,
 * which deadlocks against fake timers once the component also uses a
 * transition. The debounce is what these tests are about, and fireEvent
 * exercises it exactly the same way.
 */
function search(term: string) {
  const box = screen.getByLabelText("Search notes");
  for (let index = 1; index <= term.length; index++) {
    fireEvent.change(box, { target: { value: term.slice(0, index) } });
  }
}

const settle = (ms = 300) => act(() => void vi.advanceTimersByTime(ms));

describe("search", () => {
  beforeEach(() => vi.useFakeTimers());

  it("waits for a pause before touching the URL", () => {
    render(<NotesToolbar />);

    search("week");
    expect(router.replace).not.toHaveBeenCalled();

    settle();
    expect(router.replace).toHaveBeenCalledWith("/notes?q=week");
  });

  it("navigates once for a burst of typing, not once per key", () => {
    render(<NotesToolbar />);

    search("weekend");
    settle();

    expect(router.replace).toHaveBeenCalledOnce();
  });

  it("drops the parameter when the box is cleared", () => {
    searchParams.current = new URLSearchParams("q=weekend");
    render(<NotesToolbar />);

    fireEvent.change(screen.getByLabelText("Search notes"), { target: { value: "" } });
    settle();

    expect(router.replace).toHaveBeenCalledWith("/notes");
  });

  it("keeps the category filter while searching within it", () => {
    searchParams.current = new URLSearchParams("category=school");
    render(<NotesToolbar />);

    search("essay");
    settle();

    expect(router.replace).toHaveBeenCalledWith("/notes?category=school&q=essay");
  });

  it("shows the term already in the URL on first render", () => {
    searchParams.current = new URLSearchParams("q=weekend");
    render(<NotesToolbar />);

    expect(screen.getByLabelText("Search notes")).toHaveValue("weekend");
  });
});

describe("new note", () => {
  it("creates the note first, then opens it at its own URL", async () => {
    render(<NotesToolbar />);

    await userEvent.click(screen.getByRole("button", { name: /New Note/ }));

    expect(create).toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith("/notes/new-note-id");
  });

  it("defaults to the first category when nothing is filtered", async () => {
    render(<NotesToolbar />);

    await userEvent.click(screen.getByRole("button", { name: /New Note/ }));

    expect(create).toHaveBeenCalledWith("random-thoughts");
  });

  it("files the note under the category being viewed", async () => {
    searchParams.current = new URLSearchParams("category=drama");
    render(<NotesToolbar />);

    await userEvent.click(screen.getByRole("button", { name: /New Note/ }));

    expect(create).toHaveBeenCalledWith("drama");
  });

  it("ignores a category in the URL that is not a real one", async () => {
    searchParams.current = new URLSearchParams("category=made-up");
    render(<NotesToolbar />);

    await userEvent.click(screen.getByRole("button", { name: /New Note/ }));

    expect(create).toHaveBeenCalledWith("random-thoughts");
  });

  it("says so instead of failing silently when the note cannot be created", async () => {
    create.mockRejectedValue(new Error("offline"));
    render(<NotesToolbar />);

    const button = screen.getByRole("button", { name: /New Note/ });
    await userEvent.click(button);

    expect(router.push).not.toHaveBeenCalled();
    expect(button).not.toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't start a new note.");
  });
});

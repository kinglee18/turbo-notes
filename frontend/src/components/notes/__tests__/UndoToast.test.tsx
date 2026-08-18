import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UndoToast } from "../UndoToast";

const searchParams = { current: new URLSearchParams() };
const router = { replace: vi.fn(), refresh: vi.fn() };

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => searchParams.current,
}));

const restore = vi.fn();
vi.mock("@/lib/api/client", () => ({
  notesApi: { restore: (id: string) => restore(id) },
}));

beforeEach(() => {
  vi.clearAllMocks();
  restore.mockResolvedValue({});
  searchParams.current = new URLSearchParams("undo=note-1");
});

afterEach(() => vi.useRealTimers());

describe("UndoToast", () => {
  it("stays hidden when nothing was just deleted", () => {
    searchParams.current = new URLSearchParams();
    render(<UndoToast />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("offers an undo after a delete", () => {
    render(<UndoToast />);

    expect(screen.getByRole("status")).toHaveTextContent("Note deleted.");
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
  });

  it("restores the note that was deleted, not some other one", async () => {
    render(<UndoToast />);

    await userEvent.click(screen.getByRole("button", { name: "Undo" }));

    expect(restore).toHaveBeenCalledWith("note-1");
  });

  it("clears the undo param and refreshes once restored", async () => {
    render(<UndoToast />);

    await userEvent.click(screen.getByRole("button", { name: "Undo" }));

    expect(router.replace).toHaveBeenCalledWith("/notes");
    expect(router.refresh).toHaveBeenCalled();
  });

  it("disappears as soon as Undo is pressed, so it cannot be clicked twice", async () => {
    render(<UndoToast />);

    await userEvent.click(screen.getByRole("button", { name: "Undo" }));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("gives up after a while rather than hanging around", () => {
    vi.useFakeTimers();
    render(<UndoToast />);

    expect(screen.getByRole("status")).toBeInTheDocument();

    act(() => void vi.advanceTimersByTime(6_000));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("starts a fresh countdown for a second delete", () => {
    vi.useFakeTimers();
    const { rerender } = render(<UndoToast />);

    act(() => void vi.advanceTimersByTime(5_000));
    expect(screen.getByRole("status")).toBeInTheDocument();

    // A different note was deleted: the toast should reset, not vanish 1s later.
    searchParams.current = new URLSearchParams("undo=note-2");
    rerender(<UndoToast />);

    act(() => void vi.advanceTimersByTime(5_000));
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("survives the restore request failing", async () => {
    restore.mockRejectedValue(new Error("offline"));
    render(<UndoToast />);

    await userEvent.click(screen.getByRole("button", { name: "Undo" }));

    expect(router.replace).toHaveBeenCalledWith("/notes");
  });
});

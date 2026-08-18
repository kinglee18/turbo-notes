import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEBOUNCE_MS, MAX_WAIT_MS, useAutosave } from "../useAutosave";

interface Draft {
  title: string;
  body: string;
}

const INITIAL: Draft = { title: "", body: "" };

/** A save that resolves when the test says so, to control in-flight timing. */
function deferredSave() {
  const calls: Partial<Draft>[] = [];
  const resolvers: ((value: Draft) => void)[] = [];

  const save = vi.fn((changes: Partial<Draft>) => {
    calls.push(changes);
    return new Promise<Draft>((resolve) => resolvers.push(resolve));
  });

  return { save, calls, resolvers };
}

describe("useAutosave", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("collapses a burst of edits into a single save", async () => {
    const save = vi.fn(async (changes: Partial<Draft>) => ({ ...INITIAL, ...changes }));
    const { result } = renderHook(() => useAutosave<Draft>({ save, saved: INITIAL }));

    act(() => {
      result.current.change({ title: "H", body: "" });
      result.current.change({ title: "He", body: "" });
      result.current.change({ title: "Hel", body: "" });
      result.current.change({ title: "Hello", body: "" });
    });

    expect(save).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS);
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0]).toEqual({ title: "Hello" });
  });

  it("saves during continuous typing thanks to the max wait", async () => {
    const save = vi.fn(async (changes: Partial<Draft>) => ({ ...INITIAL, ...changes }));
    const { result } = renderHook(() => useAutosave<Draft>({ save, saved: INITIAL }));

    // Keep typing so the debounce never gets a chance to elapse.
    await act(async () => {
      for (let tick = 0; tick < 20; tick++) {
        result.current.change({ title: "x".repeat(tick + 1), body: "" });
        vi.advanceTimersByTime(DEBOUNCE_MS - 250);
      }
    });

    expect(save).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBeGreaterThanOrEqual(0);
    expect(MAX_WAIT_MS).toBeGreaterThan(DEBOUNCE_MS);
  });

  it("sends only the fields that actually changed", async () => {
    const save = vi.fn(async (changes: Partial<Draft>) => ({
      title: "kept",
      body: "new",
      ...changes,
    }));
    const { result } = renderHook(() =>
      useAutosave<Draft>({ save, saved: { title: "kept", body: "old" } }),
    );

    act(() => result.current.change({ title: "kept", body: "new" }));
    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS);
    });

    expect(save.mock.calls[0][0]).toEqual({ body: "new" });
  });

  it("does not call save when nothing changed", async () => {
    const save = vi.fn(async () => INITIAL);
    const { result } = renderHook(() => useAutosave<Draft>({ save, saved: INITIAL }));

    act(() => result.current.change({ ...INITIAL }));
    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS);
    });

    expect(save).not.toHaveBeenCalled();
  });

  it("keeps exactly one request in flight and sends one follow-up", async () => {
    const { save, resolvers } = deferredSave();
    const { result } = renderHook(() => useAutosave<Draft>({ save, saved: INITIAL }));

    act(() => result.current.change({ title: "first", body: "" }));
    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS);
    });
    expect(save).toHaveBeenCalledTimes(1);

    // Three more edits arrive while the first request is still open.
    act(() => {
      result.current.change({ title: "second", body: "" });
      result.current.change({ title: "third", body: "" });
      result.current.change({ title: "fourth", body: "" });
    });
    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS);
    });

    // Still just the one: no overlapping writes, so no out-of-order applies.
    expect(save).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolvers[0]({ title: "first", body: "" });
    });

    // One follow-up carrying the newest state, not one per edit.
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0]).toEqual({ title: "fourth" });
  });

  it("reports saving, then saved", async () => {
    const { save, resolvers } = deferredSave();
    const { result } = renderHook(() => useAutosave<Draft>({ save, saved: INITIAL }));

    expect(result.current.status).toBe("idle");

    act(() => result.current.change({ title: "typing", body: "" }));
    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS);
    });
    expect(result.current.status).toBe("saving");

    await act(async () => {
      resolvers[0]({ title: "typing", body: "" });
    });
    expect(result.current.status).toBe("saved");
  });

  it("retries a network failure with backoff", async () => {
    const save = vi
      .fn<(changes: Partial<Draft>) => Promise<Draft>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({ title: "retry me", body: "" });

    const { result } = renderHook(() => useAutosave<Draft>({ save, saved: INITIAL }));

    act(() => result.current.change({ title: "retry me", body: "" }));
    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS);
    });

    expect(result.current.status).toBe("error");
    expect(save).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(1_000);
    });

    expect(save).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe("saved");
  });

  it("does not retry an error it cannot recover from", async () => {
    const save = vi
      .fn<(changes: Partial<Draft>) => Promise<Draft>>()
      .mockRejectedValue(new Error("validation"));

    const { result } = renderHook(() =>
      useAutosave<Draft>({ save, saved: INITIAL, isFatal: () => true }),
    );

    act(() => result.current.change({ title: "bad", body: "" }));
    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS);
    });

    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("error");
  });

  it("flushes pending edits when the editor unmounts", async () => {
    const save = vi.fn(
      async (changes: Partial<Draft>, _options: { keepalive: boolean }) => ({
        ...INITIAL,
        ...changes,
      }),
    );
    const { result, unmount } = renderHook(() =>
      useAutosave<Draft>({ save, saved: INITIAL }),
    );

    act(() => result.current.change({ title: "unsaved", body: "" }));
    expect(save).not.toHaveBeenCalled();

    await act(async () => {
      unmount();
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][1]).toEqual({ keepalive: true });
  });

  it("flushes when the tab is hidden, so edits survive a closed laptop", async () => {
    const save = vi.fn(async (changes: Partial<Draft>) => ({ ...INITIAL, ...changes }));
    const { result } = renderHook(() => useAutosave<Draft>({ save, saved: INITIAL }));

    act(() => result.current.change({ title: "quick", body: "" }));

    await act(async () => {
      vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(save).toHaveBeenCalledTimes(1);
  });

  it("reports whether there is anything left to save", async () => {
    const save = vi.fn(async (changes: Partial<Draft>) => ({ ...INITIAL, ...changes }));
    const { result } = renderHook(() => useAutosave<Draft>({ save, saved: INITIAL }));

    expect(result.current.hasUnsavedChanges()).toBe(false);

    act(() => result.current.change({ title: "dirty", body: "" }));
    expect(result.current.hasUnsavedChanges()).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS);
    });
    expect(result.current.hasUnsavedChanges()).toBe(false);
  });
});

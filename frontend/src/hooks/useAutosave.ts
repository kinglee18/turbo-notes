"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export const DEBOUNCE_MS = 750;
/** Someone typing without pause still gets a save this often. */
export const MAX_WAIT_MS = 5_000;
const RETRY_BASE_MS = 1_000;
const RETRY_CAP_MS = 30_000;

export interface AutosaveOptions<T> {
  /** Persist `changes` and resolve with whatever the server now holds. */
  save: (changes: Partial<T>, options: { keepalive: boolean }) => Promise<T>;
  /** The last known server state, used to compute what actually changed. */
  saved: T;
  onSaved?: (value: T) => void;
  /** Permanent failures (validation, expired session) should not be retried. */
  isFatal?: (error: unknown) => boolean;
}

function changedFields<T extends object>(draft: T, saved: T): Partial<T> {
  const changes: Partial<T> = {};
  for (const key of Object.keys(draft) as (keyof T)[]) {
    if (draft[key] !== saved[key]) changes[key] = draft[key];
  }
  return changes;
}

/**
 * Debounced autosave for the note editor, which has no save button.
 *
 * Two properties matter here. Only one request is ever in flight for a note:
 * edits arriving mid-request set a dirty flag and are sent in a single
 * follow-up when it lands, so responses can never be applied out of order and
 * last-write-wins on the server is correct. And a save is skipped entirely
 * when nothing changed, so "Last Edited" never advances without an edit.
 */
export function useAutosave<T extends object>({
  save,
  saved,
  onSaved,
  isFatal,
}: AutosaveOptions<T>) {
  const [status, setStatus] = useState<SaveStatus>("idle");

  const draftRef = useRef<T>(saved);
  const savedRef = useRef<T>(saved);
  const inFlightRef = useRef(false);
  const dirtyRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxWaitRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);

  // Keep the callbacks current without making `flush` change identity, which
  // would re-arm the unload listeners on every keystroke.
  const saveRef = useRef(save);
  const onSavedRef = useRef(onSaved);
  const isFatalRef = useRef(isFatal);
  useEffect(() => {
    saveRef.current = save;
    onSavedRef.current = onSaved;
    isFatalRef.current = isFatal;
  });

  /**
   * The save routine, built exactly once.
   *
   * It has to be able to call itself — to retry after a failure, and to send
   * the follow-up write when edits arrived mid-request — which a useCallback
   * cannot do without referencing itself before it exists. A lazy useState
   * initialiser gives one stable closure instead, and everything it touches
   * already lives in a ref, so it never needs rebuilding.
   */
  const [run] = useState(() => {
    const clearTimers = () => {
      for (const ref of [debounceRef, maxWaitRef, retryRef]) {
        if (ref.current) clearTimeout(ref.current);
        ref.current = null;
      }
    };

    async function save_(options: { keepalive?: boolean }): Promise<void> {
      clearTimers();

      const changes = changedFields(draftRef.current, savedRef.current);
      if (Object.keys(changes).length === 0) return;

      if (inFlightRef.current) {
        dirtyRef.current = true;
        return;
      }

      inFlightRef.current = true;
      setStatus("saving");

      try {
        const result = await saveRef.current(changes, {
          keepalive: options.keepalive ?? false,
        });
        savedRef.current = result;
        attemptRef.current = 0;
        setStatus("saved");
        onSavedRef.current?.(result);
      } catch (error) {
        setStatus("error");
        if (!isFatalRef.current?.(error)) {
          const delay = Math.min(RETRY_BASE_MS * 2 ** attemptRef.current++, RETRY_CAP_MS);
          retryRef.current = setTimeout(() => void save_({}), delay);
        }
        return;
      } finally {
        inFlightRef.current = false;
      }

      if (dirtyRef.current) {
        dirtyRef.current = false;
        void save_({});
      }
    }

    return save_;
  });

  const flush = useCallback(
    (options: { keepalive?: boolean } = {}) => run(options),
    [run],
  );

  /** Record an edit and schedule the save. */
  const change = useCallback(
    (draft: T) => {
      draftRef.current = draft;

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => void run({}), DEBOUNCE_MS);

      if (!maxWaitRef.current) {
        maxWaitRef.current = setTimeout(() => void run({}), MAX_WAIT_MS);
      }
    },
    [run],
  );

  /** Adopt server state that arrived from somewhere other than a save. */
  const reset = useCallback((value: T) => {
    draftRef.current = value;
    savedRef.current = value;
  }, []);

  const hasUnsavedChanges = useCallback(
    () => Object.keys(changedFields(draftRef.current, savedRef.current)).length > 0,
    [],
  );

  // Don't let a pending edit die with the page.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush({ keepalive: true });
    };
    const onPageHide = () => void flush({ keepalive: true });

    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      void flush({ keepalive: true });
    };
  }, [flush]);

  return { status, change, flush, reset, hasUnsavedChanges };
}

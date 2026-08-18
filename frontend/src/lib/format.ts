/**
 * Date helpers.
 *
 * These take `now` explicitly rather than reading the clock themselves. The
 * server renders in UTC and the browser in local time, so a self-reading
 * "today" check produces a hydration mismatch; passing `now` also makes the
 * boundary cases trivial to test.
 */

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** The date line on a note card: "today", "yesterday", "July 16". */
export function formatCardDate(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const dayDelta = Math.round(
    (startOfDay(now).getTime() - startOfDay(date).getTime()) / 86_400_000,
  );

  if (dayDelta <= 0) return "today";
  if (dayDelta === 1) return "yesterday";

  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/** The editor's timestamp: "Last Edited: July 21, 2024 at 8:38pm". */
export function formatLastEdited(iso: string): string {
  const date = new Date(iso);
  const day = date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const time = date
    .toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    })
    .replace(/\s?([AP]M)/i, (_, meridiem: string) => meridiem.toLowerCase());

  return `Last Edited: ${day} at ${time}`;
}

/**
 * Split a plain-text body into blocks for preview and reading.
 *
 * The design shows bulleted content inside note cards, but the body is stored
 * as plain text; lines starting with "-", "*" or "•" render as list items.
 */
export type BodyBlock =
  | { kind: "list"; items: string[] }
  | { kind: "text"; text: string };

const BULLET = /^\s*[-*•]\s+/;

export function parseBody(body: string): BodyBlock[] {
  const blocks: BodyBlock[] = [];

  for (const line of body.split("\n")) {
    if (BULLET.test(line)) {
      const item = line.replace(BULLET, "").trim();
      const last = blocks.at(-1);
      if (last?.kind === "list") last.items.push(item);
      else blocks.push({ kind: "list", items: [item] });
      continue;
    }

    if (!line.trim()) continue;

    const last = blocks.at(-1);
    if (last?.kind === "text") last.text += ` ${line.trim()}`;
    else blocks.push({ kind: "text", text: line.trim() });
  }

  return blocks;
}

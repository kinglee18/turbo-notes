import { describe, expect, it } from "vitest";

import { formatCardDate, formatLastEdited, parseBody } from "../format";

describe("formatCardDate", () => {
  const now = new Date("2024-07-21T14:30:00");

  it("calls the current day today", () => {
    expect(formatCardDate("2024-07-21T09:00:00", now)).toBe("today");
  });

  it("calls the day before yesterday", () => {
    expect(formatCardDate("2024-07-20T23:59:00", now)).toBe("yesterday");
  });

  it("compares calendar days, not elapsed hours", () => {
    // Only 40 minutes earlier, but on the previous date.
    expect(formatCardDate("2024-07-20T23:50:00", new Date("2024-07-21T00:30:00"))).toBe(
      "yesterday",
    );
  });

  it("falls back to a month and day further back", () => {
    expect(formatCardDate("2024-07-16T10:00:00", now)).toBe("July 16");
  });

  it("includes the year once it is a different one", () => {
    expect(formatCardDate("2023-11-02T10:00:00", now)).toBe("November 2, 2023");
  });

  it("treats a future timestamp as today rather than a negative day count", () => {
    expect(formatCardDate("2024-07-22T10:00:00", now)).toBe("today");
  });
});

describe("formatLastEdited", () => {
  it("matches the wording in the design", () => {
    expect(formatLastEdited("2024-07-21T20:38:00")).toBe(
      "Last Edited: July 21, 2024 at 8:38pm",
    );
  });

  it("lowercases the meridiem in the morning too", () => {
    expect(formatLastEdited("2024-07-21T08:05:00")).toContain("8:05am");
  });
});

describe("parseBody", () => {
  it("groups consecutive dashed lines into one list", () => {
    expect(parseBody("- Milk\n- Eggs\n- Bread")).toEqual([
      { kind: "list", items: ["Milk", "Eggs", "Bread"] },
    ]);
  });

  it("accepts asterisks and bullet characters too", () => {
    expect(parseBody("* One\n• Two")).toEqual([
      { kind: "list", items: ["One", "Two"] },
    ]);
  });

  it("keeps prose and lists as separate blocks", () => {
    expect(parseBody("Shopping today:\n- Milk\nDon't forget cash.")).toEqual([
      { kind: "text", text: "Shopping today:" },
      { kind: "list", items: ["Milk"] },
      { kind: "text", text: "Don't forget cash." },
    ]);
  });

  it("joins wrapped prose lines into one paragraph", () => {
    expect(parseBody("A long thought\nthat wrapped.")).toEqual([
      { kind: "text", text: "A long thought that wrapped." },
    ]);
  });

  it("returns nothing for an empty body", () => {
    expect(parseBody("")).toEqual([]);
    expect(parseBody("\n\n  \n")).toEqual([]);
  });

  it("does not mistake a hyphenated word for a bullet", () => {
    expect(parseBody("well-being matters")).toEqual([
      { kind: "text", text: "well-being matters" },
    ]);
  });
});

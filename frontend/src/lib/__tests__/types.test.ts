import { describe, expect, it } from "vitest";

import { CATEGORY_SLUGS, isCategorySlug } from "../types";

describe("isCategorySlug", () => {
  it("accepts every slug the seed migration creates", () => {
    for (const slug of CATEGORY_SLUGS) {
      expect(isCategorySlug(slug)).toBe(true);
    }
  });

  it("rejects a slug that is not one of them", () => {
    expect(isCategorySlug("homework")).toBe(false);
    expect(isCategorySlug("Random Thoughts")).toBe(false);
  });

  it("rejects absent values, which is how a missing query param arrives", () => {
    expect(isCategorySlug(null)).toBe(false);
    expect(isCategorySlug(undefined)).toBe(false);
    expect(isCategorySlug("")).toBe(false);
  });

  it("rejects non-strings", () => {
    expect(isCategorySlug(0)).toBe(false);
    expect(isCategorySlug({ slug: "school" })).toBe(false);
  });
});

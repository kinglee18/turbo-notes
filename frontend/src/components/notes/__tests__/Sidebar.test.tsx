import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Sidebar } from "../Sidebar";
import type { Category } from "@/lib/types";

const searchParams = { current: new URLSearchParams() };

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => searchParams.current,
}));

const CATEGORIES: Category[] = [
  { slug: "random-thoughts", name: "Random Thoughts", note_count: 4 },
  { slug: "school", name: "School", note_count: 3 },
  { slug: "personal", name: "Personal", note_count: 3 },
  { slug: "drama", name: "Drama", note_count: 2 },
];

describe("Sidebar", () => {
  beforeEach(() => {
    searchParams.current = new URLSearchParams();
  });

  it("shows every category with its count", () => {
    render(<Sidebar categories={CATEGORIES} />);

    for (const category of CATEGORIES) {
      expect(screen.getByText(category.name)).toBeInTheDocument();
    }
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("links each category to a filtered list", () => {
    render(<Sidebar categories={CATEGORIES} />);

    expect(screen.getByRole("link", { name: /School/ })).toHaveAttribute(
      "href",
      "/notes?category=school",
    );
  });

  it("marks All Categories as current when nothing is filtered", () => {
    render(<Sidebar categories={CATEGORIES} />);

    expect(screen.getByRole("link", { name: "All Categories" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("marks the selected category as current instead", () => {
    searchParams.current = new URLSearchParams("category=school");
    render(<Sidebar categories={CATEGORIES} />);

    expect(screen.getByRole("link", { name: /School/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: "All Categories" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("clears only the category when All Categories is followed, keeping the search", () => {
    searchParams.current = new URLSearchParams("category=school&q=milk");
    render(<Sidebar categories={CATEGORIES} />);

    expect(screen.getByRole("link", { name: "All Categories" })).toHaveAttribute(
      "href",
      "/notes?q=milk",
    );
  });

  it("offers a way to log out", () => {
    render(<Sidebar categories={CATEGORIES} />);
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
  });
});

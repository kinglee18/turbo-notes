import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CategoryDropdown } from "../CategoryDropdown";
import type { Category } from "@/lib/types";

const CATEGORIES: Category[] = [
  { slug: "random-thoughts", name: "Random Thoughts", note_count: 3 },
  { slug: "school", name: "School", note_count: 1 },
  { slug: "personal", name: "Personal", note_count: 2 },
  { slug: "drama", name: "Drama", note_count: 0 },
];

function setup(onChange = vi.fn()) {
  render(
    <CategoryDropdown
      categories={CATEGORIES}
      value="random-thoughts"
      onChange={onChange}
    />,
  );
  return { onChange, user: userEvent.setup() };
}

describe("CategoryDropdown", () => {
  it("shows the current category on the trigger", () => {
    setup();
    expect(screen.getByRole("button")).toHaveTextContent("Random Thoughts");
  });

  it("starts closed", () => {
    setup();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("lists the other categories, not the current one", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button"));

    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["School", "Personal", "Drama"]);
  });

  it("reports the chosen category and closes", async () => {
    const { onChange, user } = setup();

    await user.click(screen.getByRole("button"));
    await user.click(screen.getByRole("option", { name: "Personal" }));

    expect(onChange).toHaveBeenCalledWith("personal");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("closes on Escape without choosing anything", async () => {
    const { onChange, user } = setup();

    await user.click(screen.getByRole("button"));
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("closes when the user clicks elsewhere", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button"));
    await user.click(document.body);

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});

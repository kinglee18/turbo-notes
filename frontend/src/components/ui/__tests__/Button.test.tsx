import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "../Button";

describe("Button", () => {
  it("renders its children", () => {
    render(<Button>New Note</Button>);
    expect(screen.getByRole("button", { name: "New Note" })).toBeInTheDocument();
  });

  it("calls onClick when pressed", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);

    await userEvent.click(screen.getByRole("button"));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it("does not fire while disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Save
      </Button>,
    );

    await userEvent.click(screen.getByRole("button"));

    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("defaults to a submit-safe button type passthrough", () => {
    render(<Button type="submit">Sign Up</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });

  it("styles the ghost variant differently from the primary one", () => {
    const { rerender } = render(<Button>Primary</Button>);
    const primary = screen.getByRole("button").className;

    rerender(<Button variant="ghost">Ghost</Button>);

    expect(screen.getByRole("button").className).not.toBe(primary);
  });

  it("keeps caller classes alongside its own", () => {
    render(<Button className="w-full">Wide</Button>);
    expect(screen.getByRole("button")).toHaveClass("w-full", "rounded-full");
  });
});

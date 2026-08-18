import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PasswordInput, TextInput } from "../TextInput";

describe("TextInput", () => {
  it("associates the label with the field, so it is reachable by name", () => {
    render(<TextInput label="Email address" />);
    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
  });

  it("uses the label as the visible placeholder, as the design does", () => {
    render(<TextInput label="Email address" />);
    expect(screen.getByPlaceholderText("Email address")).toBeInTheDocument();
  });

  it("reports what the user typed", async () => {
    const onChange = vi.fn();
    render(<TextInput label="Email address" onChange={onChange} />);

    await userEvent.type(screen.getByLabelText("Email address"), "hi");

    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("gives each field its own id when several are on the page", () => {
    render(
      <>
        <TextInput label="First" />
        <TextInput label="Second" />
      </>,
    );

    const [first, second] = screen.getAllByRole("textbox");
    expect(first.id).not.toBe(second.id);
  });
});

describe("PasswordInput", () => {
  it("masks the value by default", () => {
    render(<PasswordInput label="Password" />);
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  });

  it("reveals and re-masks the value on the toggle", async () => {
    render(<PasswordInput label="Password" />);
    const field = screen.getByLabelText("Password");

    await userEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(field).toHaveAttribute("type", "text");

    await userEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(field).toHaveAttribute("type", "password");
  });

  it("does not submit the surrounding form when toggling", async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <PasswordInput label="Password" />
      </form>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Show password" }));

    expect(onSubmit).not.toHaveBeenCalled();
  });
});

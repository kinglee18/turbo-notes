import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthForm } from "../AuthForm";

const router = { replace: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

function renderLogin() {
  render(
    <AuthForm
      mode="login"
      heading="Yay, You're Back!"
      submitLabel="Login"
      illustration={{ src: "/i.png", alt: "A cactus", width: 10, height: 10 }}
      altLink={{ href: "/signup", label: "Oops! I've never been here before" }}
    />,
  );
}

async function submit(email = "a@example.com", password = "pw-123-abc") {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Email address"), email);
  await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Login" }));
}

/** The JSON body of the nth fetch call. */
function sentBody(index = 0) {
  const [, init] = fetchMock.mock.calls[index] as [string, RequestInit];
  return JSON.parse(init.body as string);
}

describe("AuthForm", () => {
  it("shows the heading and the link to the other mode", () => {
    renderLogin();

    expect(screen.getByRole("heading")).toHaveTextContent("Yay, You're Back!");
    expect(
      screen.getByRole("link", { name: "Oops! I've never been here before" }),
    ).toHaveAttribute("href", "/signup");
  });

  it("posts the credentials to the matching endpoint", async () => {
    renderLogin();

    await submit("me@example.com", "hunter22two");

    expect(fetchMock.mock.calls[0][0]).toBe("/api/auth/login");
    expect(sentBody()).toEqual({ email: "me@example.com", password: "hunter22two" });
  });

  it("goes to the notes list once signed in", async () => {
    renderLogin();

    await submit();

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/notes"));
    // refresh() so Server Components re-fetch with the new session cookie.
    expect(router.refresh).toHaveBeenCalled();
  });

  it("surfaces a plain detail message from the API", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ detail: "Incorrect email or password." }), {
        status: 400,
      }),
    );
    renderLogin();

    await submit();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Incorrect email or password.",
    );
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("surfaces a field error, which is the shape DRF actually returns", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ email: ["An account with this email already exists."] }),
        { status: 400 },
      ),
    );
    renderLogin();

    await submit();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "An account with this email already exists.",
    );
  });

  it("falls back to something readable when the error body is unrecognised", async () => {
    fetchMock.mockResolvedValue(new Response("not json at all", { status: 500 }));
    renderLogin();

    await submit();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
  });

  it("reports a network failure rather than hanging", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    renderLogin();

    await submit();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not reach the server.",
    );
  });

  it("re-enables the button after a failure so the user can retry", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ detail: "nope" }), { status: 400 }),
    );
    renderLogin();

    await submit();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Login" })).not.toBeDisabled(),
    );
  });

  it("asks the browser for the right autofill on each mode", () => {
    renderLogin();
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
  });
});

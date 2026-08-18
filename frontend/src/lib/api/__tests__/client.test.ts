import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ClientApiError, apiFetch, categoriesApi, notesApi } from "../client";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** The URL and init of the nth fetch call. */
function callArgs(index = 0) {
  const [url, init] = fetchMock.mock.calls[index] as [string, RequestInit];
  return { url, init };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe("apiFetch", () => {
  it("routes through the Next proxy rather than calling Django directly", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    await apiFetch("notes");

    expect(callArgs().url).toBe("/api/proxy/notes");
  });

  it("sends a header a cross-origin form could not set", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));

    await apiFetch("notes");

    const headers = callArgs().init.headers as Record<string, string>;
    expect(headers["X-Requested-With"]).toBe("turbo-notes");
  });

  it("returns the parsed body", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: "abc" }));

    await expect(apiFetch("notes/abc")).resolves.toEqual({ id: "abc" });
  });

  it("returns nothing for a 204, which has no body to parse", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(apiFetch("notes/abc")).resolves.toBeUndefined();
  });

  it("omits a body on GET so the request stays a GET", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));

    await apiFetch("notes");

    expect(callArgs().init.body).toBeUndefined();
  });

  it("serialises the body it is given", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));

    await apiFetch("notes", { method: "POST", body: { category: "school" } });

    expect(callArgs().init.body).toBe('{"category":"school"}');
  });

  it("throws an error carrying the status and the server's explanation", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: "Session expired." }, 401));

    const error = await apiFetch("notes").catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ClientApiError);
    expect((error as ClientApiError).status).toBe(401);
    expect((error as ClientApiError).data).toEqual({ detail: "Session expired." });
  });

  it("still throws when the failure body is not JSON", async () => {
    fetchMock.mockResolvedValue(new Response("<html>502</html>", { status: 502 }));

    const error = await apiFetch("notes").catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ClientApiError);
    expect((error as ClientApiError).status).toBe(502);
    expect((error as ClientApiError).data).toBeNull();
  });

  it("passes keepalive through, so a save can outlive the page", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));

    await apiFetch("notes/abc", { method: "PATCH", body: {}, keepalive: true });

    expect(callArgs().init.keepalive).toBe(true);
  });
});

describe("notesApi", () => {
  beforeEach(() => fetchMock.mockResolvedValue(jsonResponse({})));

  it("asks for everything when no filter is set", async () => {
    await notesApi.list({});
    expect(callArgs().url).toBe("/api/proxy/notes");
  });

  it("passes the category filter through", async () => {
    await notesApi.list({ category: "school" });
    expect(callArgs().url).toBe("/api/proxy/notes?category=school");
  });

  it("passes both filters together", async () => {
    await notesApi.list({ category: "school", q: "homework" });
    expect(callArgs().url).toBe("/api/proxy/notes?category=school&q=homework");
  });

  it("escapes a search term so spaces cannot break the query string", async () => {
    await notesApi.list({ q: "weekend plans" });
    expect(callArgs().url).toBe("/api/proxy/notes?q=weekend+plans");
  });

  it("creates a note with only a category, since a new note is empty", async () => {
    await notesApi.create("personal");

    const { url, init } = callArgs();
    expect(url).toBe("/api/proxy/notes");
    expect(init.method).toBe("POST");
    expect(init.body).toBe('{"category":"personal"}');
  });

  it("PATCHes an update rather than replacing the note", async () => {
    await notesApi.update("abc", { title: "New" });

    const { url, init } = callArgs();
    expect(url).toBe("/api/proxy/notes/abc");
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe('{"title":"New"}');
  });

  it("deletes by id", async () => {
    await notesApi.remove("abc");

    const { url, init } = callArgs();
    expect(url).toBe("/api/proxy/notes/abc");
    expect(init.method).toBe("DELETE");
  });

  it("restores through the dedicated action", async () => {
    await notesApi.restore("abc");

    const { url, init } = callArgs();
    expect(url).toBe("/api/proxy/notes/abc/restore");
    expect(init.method).toBe("POST");
  });
});

describe("categoriesApi", () => {
  it("fetches the sidebar list", async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));

    await categoriesApi.list();

    expect(callArgs().url).toBe("/api/proxy/categories");
  });
});

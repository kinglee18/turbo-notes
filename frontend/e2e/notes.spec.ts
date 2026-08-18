import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "cozy-notes-2024";

/** Each test gets its own account, so they cannot see each other's notes. */
function uniqueEmail() {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

async function signUp(page: Page, email = uniqueEmail()) {
  await page.goto("/signup");
  await page.getByPlaceholder("Email address").fill(email);
  await page.getByPlaceholder("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign Up" }).click();
  await page.waitForURL("**/notes");
  return email;
}

async function createNote(page: Page) {
  await page.getByRole("button", { name: "New Note" }).click();
  await page.waitForURL(/\/notes\/[0-9a-f-]{36}$/);
}

/** Resolves when a save carrying `contains` has been acknowledged. */
function savedResponse(page: Page, contains: string) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      response.url().includes("/api/proxy/notes/") &&
      (response.request().postData() ?? "").includes(contains) &&
      response.ok(),
  );
}

test("a new account starts empty and can create its first note", async ({ page }) => {
  await signUp(page);

  await expect(
    page.getByText("I'm just here waiting for your charming notes..."),
  ).toBeVisible();

  await createNote(page);
  await expect(page.getByLabel("Note title")).toHaveValue("");
  await expect(page.getByPlaceholder("Pour your heart out...")).toBeVisible();
});

test("typing is saved without a save button and survives a reload", async ({ page }) => {
  await signUp(page);
  await createNote(page);
  const noteUrl = page.url();

  await page.getByLabel("Note title").fill("Persisted Title");

  // Wait for the debounced write that carries the body to actually land.
  // "Saved" alone is not enough here: the title flushes on blur the moment
  // focus moves to the textarea, so the indicator would already be showing
  // while the body was still sitting in the debounce.
  const bodySaved = savedResponse(page, "- One");
  await page.getByLabel("Note body").fill("- One\n- Two");
  await expect(page.getByText("Saved")).toBeVisible();
  await bodySaved;

  await page.reload();

  await expect(page).toHaveURL(noteUrl);
  await expect(page.getByLabel("Note title")).toHaveValue("Persisted Title");
  await expect(page.getByLabel("Note body")).toHaveValue("- One\n- Two");
});

test("changing category recolours the editor and moves the sidebar count", async ({
  page,
}) => {
  await signUp(page);
  await createNote(page);

  const editor = page.locator("main[data-category]");
  await expect(editor).toHaveAttribute("data-category", "random-thoughts");

  await page.getByRole("button", { name: /Random Thoughts/ }).click();
  await page.getByRole("option", { name: "Personal" }).click();

  await expect(editor).toHaveAttribute("data-category", "personal");
  await expect(page.getByText("Saved")).toBeVisible();

  await page.getByLabel("Close note").click();
  await page.waitForURL("**/notes");

  await expect(page.getByRole("link", { name: /Personal 1/ })).toBeVisible();
});

test("notes filter by category and by search term", async ({ page }) => {
  await signUp(page);

  await createNote(page);
  const homeworkSaved = savedResponse(page, "Chemistry Homework");
  await page.getByLabel("Note title").fill("Chemistry Homework");
  await homeworkSaved;
  await page.getByRole("button", { name: /Random Thoughts/ }).click();
  await page.getByRole("option", { name: "School" }).click();
  await expect(page.getByText("Saved")).toBeVisible();
  await page.getByLabel("Close note").click();
  await page.waitForURL("**/notes");

  await createNote(page);
  const plansSaved = savedResponse(page, "Weekend Plans");
  await page.getByLabel("Note title").fill("Weekend Plans");
  await plansSaved;
  await page.getByLabel("Close note").click();
  await page.waitForURL("**/notes");

  await expect(page.getByRole("link", { name: /Chemistry Homework/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Weekend Plans/ })).toBeVisible();

  await page.getByRole("link", { name: /School 1/ }).click();
  await expect(page.getByRole("link", { name: /Chemistry Homework/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Weekend Plans/ })).toHaveCount(0);

  await page.getByRole("link", { name: "All Categories" }).click();
  await page.getByPlaceholder("Search your notes…").fill("weekend");
  await expect(page.getByRole("link", { name: /Weekend Plans/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Chemistry Homework/ })).toHaveCount(0);
});

test("a deleted note can be undone", async ({ page }) => {
  await signUp(page);
  await createNote(page);
  const saved = savedResponse(page, "Regrettable Deletion");
  await page.getByLabel("Note title").fill("Regrettable Deletion");
  await saved;

  await page.getByRole("button", { name: "Delete" }).click();
  await page.waitForURL(/\/notes\?undo=/);
  await expect(page.getByRole("link", { name: /Regrettable Deletion/ })).toHaveCount(0);

  await page.getByRole("button", { name: "Undo" }).click();

  await expect(page.getByRole("link", { name: /Regrettable Deletion/ })).toBeVisible();
});

test("logging out locks the notes behind the login page", async ({ page }) => {
  await signUp(page);

  await page.getByRole("button", { name: "Log out" }).click();
  await page.waitForURL("**/login");

  // Straight back to the protected route, which should bounce.
  await page.goto("/notes");
  await expect(page).toHaveURL(/\/login$/);
});

test("one account cannot see another's notes", async ({ page }) => {
  await signUp(page);
  await createNote(page);
  const saved = savedResponse(page, "Private To The First User");
  await page.getByLabel("Note title").fill("Private To The First User");
  await saved;
  const privateUrl = page.url();

  await page.goto("/notes");
  await page.getByRole("button", { name: "Log out" }).click();
  await page.waitForURL("**/login");

  await signUp(page);
  await expect(
    page.getByText("I'm just here waiting for your charming notes..."),
  ).toBeVisible();

  // The id is guessable from the URL; the API must still refuse it.
  const response = await page.goto(privateUrl);
  expect(response?.status()).toBe(404);
});

import { expect, test, type Page } from "@playwright/test";

/**
 * Runs only under the `mobile` project (375x812, touch), which is where these
 * assertions mean anything. The rule the whole file enforces: nothing may
 * extend past the right edge of the viewport, and anything you tap must be at
 * least 44px tall.
 */

const PASSWORD = "cozy-notes-2024";
const TAP_TARGET_MIN = 44;

function uniqueEmail() {
  return `responsive-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

async function signUp(page: Page) {
  await page.goto("/signup");
  await page.getByPlaceholder("Email address").fill(uniqueEmail());
  await page.getByPlaceholder("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign Up" }).click();
  await page.waitForURL("**/notes");
}

async function createNote(page: Page, title: string) {
  await page.getByRole("button", { name: "New Note" }).click();
  await page.waitForURL(/\/notes\/[0-9a-f-]{36}$/);
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      (response.request().postData() ?? "").includes(title) &&
      response.ok(),
  );
  await page.getByLabel("Note title").fill(title);
  await saved;
}

/**
 * Reports *which* elements overflow, not just that something does — a bare
 * scrollWidth comparison tells you it is broken but not where.
 *
 * Anything inside a horizontal scroller is exempt. The category strip is one:
 * its chips are *meant* to run past the right edge, since that is what gives
 * it something to scroll. The invariant that matters is the document-level
 * one below — the page itself must not scroll sideways.
 */
async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const insideScroller = (element: HTMLElement) => {
      for (let node = element.parentElement; node; node = node.parentElement) {
        const overflowX = getComputedStyle(node).overflowX;
        if (overflowX === "auto" || overflowX === "scroll") return true;
      }
      return false;
    };

    return {
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      culprits: [...document.querySelectorAll<HTMLElement>("body *")]
        .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
        .filter((element) => !insideScroller(element))
        .map((element) => `${element.tagName}.${element.className}`)
        .slice(0, 5),
    };
  });

  expect(overflow.culprits, "elements past the right edge").toEqual([]);
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth);
}

test("the login page fits the viewport", async ({ page }) => {
  await page.goto("/login");
  await expectNoHorizontalOverflow(page);
});

test("the empty notes page fits the viewport", async ({ page }) => {
  await signUp(page);
  await expect(
    page.getByText("I'm just here waiting for your charming notes..."),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("a populated grid fits the viewport, long titles included", async ({ page }) => {
  await signUp(page);

  await createNote(page, "Groceries");
  await page.getByLabel("Close note").click();
  await page.waitForURL("**/notes");

  await createNote(page, "Weekend Plans");
  await page.getByLabel("Close note").click();
  await page.waitForURL("**/notes");

  // An unbroken token is the classic way a grid cell widens its whole row.
  await createNote(page, "Supercalifragilisticexpialidociousandthensome");
  await page.getByLabel("Close note").click();
  await page.waitForURL("**/notes");

  await expect(page.getByRole("link", { name: /Groceries/ })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("the category nav and its controls meet the 44px tap-target floor", async ({
  page,
}) => {
  await signUp(page);

  for (const name of [/All Categories/, /School 0/]) {
    const box = await page.getByRole("link", { name }).boundingBox();
    expect(box, `${name} should be laid out`).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(TAP_TARGET_MIN);
  }

  for (const name of ["Log out", "New Note"]) {
    const box = await page.getByRole("button", { name }).boundingBox();
    expect(box, `${name} should be laid out`).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(TAP_TARGET_MIN);
  }
});

test("the category strip stays pinned to the top while the notes scroll", async ({
  page,
}) => {
  await signUp(page);
  for (const title of ["One", "Two", "Three", "Four"]) {
    await createNote(page, title);
    await page.getByLabel("Close note").click();
    await page.waitForURL("**/notes");
  }

  const strip = page.getByRole("navigation", { name: "Categories" });
  await expect(strip).toBeInViewport();

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

  // Guard against the assertion below passing because nothing scrolled.
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

  await expect(strip).toBeInViewport();
  expect((await strip.boundingBox())!.y).toBeLessThanOrEqual(1);
});

test("every category is reachable from the pinned strip", async ({ page }) => {
  await signUp(page);

  // The strip is one scrolling row, so the later chips start out clipped;
  // scrollIntoViewIfNeeded is what a thumb-swipe does.
  const drama = page.getByRole("link", { name: /Drama/ });
  await drama.scrollIntoViewIfNeeded();
  await drama.click();

  await expect(page).toHaveURL(/category=drama/);
  await expect(drama).toBeInViewport();
});

test("the editor fills the visual viewport without scrolling the page", async ({
  page,
}) => {
  await signUp(page);
  await createNote(page, "Editor Fit");

  await expectNoHorizontalOverflow(page);

  // h-dvh, not h-screen: 100vh on mobile includes the retracted URL bar, which
  // would push the bottom of the textarea under browser chrome.
  const scrollsVertically = await page.evaluate(
    () => document.documentElement.scrollHeight > window.innerHeight + 1,
  );
  expect(scrollsVertically).toBe(false);
});

test("the open category dropdown stays inside the viewport", async ({ page }) => {
  await signUp(page);
  await createNote(page, "Dropdown Fit");

  await page.getByRole("button", { name: /Random Thoughts/ }).click();
  await expect(page.getByRole("option", { name: "Personal" })).toBeVisible();

  await expectNoHorizontalOverflow(page);
});

test("the undo toast stays inside the viewport", async ({ page }) => {
  await signUp(page);
  await createNote(page, "Regrettable Deletion");

  await page.getByRole("button", { name: "Delete" }).click();
  await page.waitForURL(/\/notes\?undo=/);
  await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();

  await expectNoHorizontalOverflow(page);
});

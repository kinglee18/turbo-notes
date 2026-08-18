import { expect, test, type Page } from "@playwright/test";

/**
 * Not really a test: this generates the images embedded in the README, so
 * they can be regenerated from a known state instead of drifting as the UI
 * changes. Run it deliberately:
 *
 *   SHOTS=1 npx playwright test screenshots
 */
const OUT = "../docs/screenshots";

test.skip(!process.env.SHOTS, "set SHOTS=1 to refresh the README images");

test.use({ viewport: { width: 1440, height: 900 } });

async function signUp(page: Page) {
  await page.goto("/signup");
  await page.getByPlaceholder("Email address").fill(`shots-${Date.now()}@example.com`);
  await page.getByPlaceholder("Password").fill("cozy-notes-2024");
  await page.getByRole("button", { name: "Sign Up" }).click();
  await page.waitForURL("**/notes");
}

test("capture", async ({ page }) => {
  await page.goto("/login");
  await page.screenshot({ path: `${OUT}/login.png` });

  await signUp(page);
  await expect(
    page.getByText("I'm just here waiting for your charming notes..."),
  ).toBeVisible();
  await page.screenshot({ path: `${OUT}/empty-state.png` });

  await page.getByRole("button", { name: "New Note" }).click();
  await page.waitForURL(/\/notes\/[0-9a-f-]{36}$/);
  await page.getByLabel("Note title").fill("Vacation Ideas");
  await page
    .getByLabel("Note body")
    .fill(
      "- Visit Bali for beaches and culture\n- Explore the historic sites in Rome\n" +
        "- Go hiking in the Swiss Alps\n- Relax in the hot springs of Iceland",
    );
  await expect(page.getByText("Saved")).toBeVisible();
  await page.screenshot({ path: `${OUT}/editor.png` });

  await page.getByRole("button", { name: /Random Thoughts/ }).click();
  await page.screenshot({ path: `${OUT}/category-dropdown.png` });
});

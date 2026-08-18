import { defineConfig, devices } from "@playwright/test";

const WEB = "http://localhost:3100";
const API_PORT = 8100;

/**
 * Runs against dedicated ports and a throwaway SQLite file, so an E2E run
 * never touches the database being used for local development.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: WEB,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command:
        `cd ../backend && rm -f e2e.sqlite3 && ` +
        `DATABASE_URL=sqlite:///e2e.sqlite3 uv run python manage.py migrate --noinput && ` +
        `DATABASE_URL=sqlite:///e2e.sqlite3 uv run python manage.py runserver ${API_PORT} --noreload`,
      url: `http://127.0.0.1:${API_PORT}/api/schema/`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      // A production build rather than `next dev`: it exercises the artifact
      // that would actually ship, and it does not collide with a dev server
      // someone already has running on :3000.
      command: `npm run build && npm run start -- --port 3100`,
      url: WEB,
      reuseExistingServer: false,
      timeout: 180_000,
      env: { DJANGO_API_URL: `http://127.0.0.1:${API_PORT}` },
    },
  ],
});

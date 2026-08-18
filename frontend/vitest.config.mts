import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // e2e/ belongs to Playwright; Vitest picking it up just errors out.
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      include: ["src/**/*.{ts,tsx}"],
      // Excluded because a unit test cannot say anything meaningful about
      // them, not to flatter the number: these are the seams where Next and
      // Django meet, and Playwright drives every one of them end to end.
      // proxy.ts and lib/api/client.ts are deliberately NOT here — they hold
      // real branching logic and are unit tested.
      exclude: [
        "src/**/*.d.ts",
        "src/app/**/layout.tsx",
        "src/app/**/page.tsx",
        "src/app/api/**/route.ts", // Next route handlers
        "src/lib/api/server.ts", // RSC-only, built on next/headers
        "src/lib/api/django.ts", // thin fetch wrapper, no branching
        "src/components/QueryProvider.tsx", // provider wiring
      ],
      // Set a little under the current numbers: tight enough that deleting
      // tests breaks the build, loose enough that an ordinary refactor
      // doesn't fail CI on a rounding error.
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 85,
        lines: 90,
      },
    },
  },
});

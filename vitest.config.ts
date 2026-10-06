import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["packages/*", "apps/web"],
    coverage: {
      provider: "v8",
      include: ["packages/calc/src/**", "packages/riot/src/**"],
      exclude: ["**/*.test.ts", "**/index.ts", "**/types.ts"],
      // The spend and stat math is pure and must stay fully tested.
      thresholds: {
        "packages/calc/src/**": { statements: 100, branches: 100, functions: 100, lines: 100 },
      },
    },
  },
});

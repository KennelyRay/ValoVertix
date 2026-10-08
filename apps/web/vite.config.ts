import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";

/** Reads the "/*" block of public/_headers so preview (and E2E) run under the production CSP. */
export function productionHeaders(): Record<string, string> {
  const lines = readFileSync(new URL("./public/_headers", import.meta.url), "utf8").split(/\r?\n/);
  const headers: Record<string, string> = {};
  let inBlock = false;
  for (const line of lines) {
    if (/^\S/.test(line)) {
      inBlock = line.trim() === "/*";
      continue;
    }
    const match = inBlock ? /^\s+([\w-]+):\s*(.+)$/.exec(line) : null;
    if (match) headers[match[1]!] = match[2]!;
  }
  return headers;
}

/**
 * The domain users are told to check before pasting their access URL.
 * Set VITE_OFFICIAL_DOMAIN to pin it (e.g. a custom domain); on Vercel it
 * otherwise defaults to the project's production domain.
 */
const officialDomain =
  process.env.VITE_OFFICIAL_DOMAIN ||
  process.env.VERCEL_PROJECT_PRODUCTION_URL ||
  "valovertix.vercel.app";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: { __OFFICIAL_DOMAIN__: JSON.stringify(officialDomain) },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  preview: { headers: productionHeaders() },
  // Emit JSON as JSON.parse("..."), which parses much faster than object literals (demo fixtures).
  json: { stringify: true },
  build: {
    target: "es2022",
    // No inline scripts or data-URI modules: the CSP only allows script-src 'self'.
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
    // The demo fixtures chunk is large on purpose and only loads in demo mode.
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Libraries in their own chunks: they rarely change, so after a deploy
        // returning visitors (and the CDN) keep them cached and only refetch app code.
        manualChunks: {
          react: ["react", "react-dom"],
          tanstack: ["@tanstack/react-router", "@tanstack/react-query"],
          motion: ["framer-motion"],
          zod: ["zod"],
          icons: ["lucide-react"],
        },
      },
    },
  },
  test: {
    name: "web",
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    testTimeout: 30000,
  },
});

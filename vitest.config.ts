import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "jsdom",
    include: [
      "tests/unit/**/*.test.{ts,tsx}",
      "tests/security/**/*.spec.ts",
      "lib/**/*.test.{ts,tsx}",
    ],
    // tests/security/*.spec.ts each reset the whole shared Postgres schema
    // at module load (resetDatabase()) — running spec files in parallel
    // (Vitest's default) races those resets against each other. The suite
    // is small enough that sequential files cost nothing noticeable.
    fileParallelism: false,
  },
});

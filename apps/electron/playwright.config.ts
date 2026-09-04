import path from "node:path";
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.test.ts",
  fullyParallel: true,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: "list",
  outputDir: path.resolve(import.meta.dirname, "../../tmp/e2e/playwright"),
});

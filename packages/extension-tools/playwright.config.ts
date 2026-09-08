import { defineConfig } from "@playwright/test";
import path from "node:path";

export default defineConfig({
  testDir: "./test",
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  outputDir: path.resolve(
    import.meta.dirname,
    "../../tmp/extension-prototype/results",
  ),
  use: { trace: "retain-on-failure", screenshot: "only-on-failure" },
});

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { compileFormatForPath, compileViewerSource } from "./compileViewer.js";

const packageRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const sampleSpec = path.join(packageRoot, "fixtures", "sample-spec.md");

describe("compileViewer", () => {
  test("treats .md paths as markdown and other paths as MDX", () => {
    expect(compileFormatForPath("specs/plugin-system.md")).toBe("md");
    expect(compileFormatForPath("/tmp/walkthrough.mdx")).toBe("mdx");
  });

  test("keeps spec prose braces as text", async () => {
    const compiled = await compileViewerSource({
      source: "# Spec fixture\n\nA plugin lives at {workspace}/.halo/.\n",
      format: "md",
    });
    expect(String(compiled)).toContain("{workspace}");
  });

  test("keeps angle brackets inside inline code", async () => {
    const compiled = await compileViewerSource({
      source: "# Spec fixture\n\nUse `{workspace}/plugins/<id>/`.\n",
      format: "md",
    });
    expect(String(compiled)).toContain("{workspace}/plugins/<id>/");
  });

  test("compiles the spec fixture as markdown", async () => {
    const source = await fs.readFile(sampleSpec, "utf8");
    const compiled = await compileViewerSource({
      source,
      format: compileFormatForPath(sampleSpec),
    });
    expect(String(compiled)).toContain("Spec fixture");
  });
});

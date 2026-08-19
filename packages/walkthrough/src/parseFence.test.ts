import { describe, expect, test } from "vitest";
import {
  isCallStackSource,
  parseFence,
  pathFromDiffSource,
} from "./parseFence.js";

describe("parseFence", () => {
  test("reads mermaid, html, callstack, and tree fences", () => {
    expect(parseFence("mermaid", "flowchart TD\n  A --> B\n")).toEqual({
      kind: "mermaid",
      source: "flowchart TD\n  A --> B",
    });
    expect(parseFence("html", "<aside>Hi</aside>")).toEqual({
      kind: "html",
      source: "<aside>Hi</aside>",
    });
    expect(parseFence("callstack", " main\n+└── next\n")).toEqual({
      kind: "callstack",
      source: " main\n+└── next",
    });
    expect(parseFence("tree", "src/a.ts\nsrc/b.ts\n")).toEqual({
      kind: "tree",
      paths: ["src/a.ts", "src/b.ts"],
    });
  });

  test("reads start:end:path file excerpts", () => {
    expect(
      parseFence(
        "12:15:packages/walkthrough/src/parseFence.ts",
        "export type Fence",
      ),
    ).toEqual({
      kind: "file",
      start: 12,
      end: 15,
      path: "packages/walkthrough/src/parseFence.ts",
      source: "export type Fence",
    });
  });

  test("treats diff fences with tree characters as call stacks", () => {
    const source = " requestHandler\n-└── oldService\n+└── newService\n";
    expect(isCallStackSource(source)).toBe(true);
    expect(parseFence("diff", source)).toEqual({
      kind: "callstack",
      source: source.replace(/\n$/, ""),
    });
  });

  test("reads unified diffs and optional diff:path lang", () => {
    const source =
      "--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1 +1 @@\n-const x = 1\n+const x = 2\n";
    expect(pathFromDiffSource(source)).toBe("src/a.ts");
    expect(parseFence("diff", source)).toEqual({
      kind: "diff",
      path: "src/a.ts",
      source: source.replace(/\n$/, ""),
    });
    expect(parseFence("diff:src/b.ts", "+hello")).toEqual({
      kind: "diff",
      path: "src/b.ts",
      source: "+hello",
    });
  });

  test("falls back to a highlighted code fence", () => {
    expect(parseFence("ts", "const n = 1")).toEqual({
      kind: "code",
      lang: "ts",
      source: "const n = 1",
    });
  });
});

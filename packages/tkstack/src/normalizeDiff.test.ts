import { describe, expect, test } from "vitest";
import { toUnifiedDiff } from "./normalizeDiff.js";

describe("toUnifiedDiff", () => {
  test("strips a // path comment that carries the leading diff context marker", () => {
    const wrapped = toUnifiedDiff(
      [
        " // src/cli.ts",
        ' Cli.create("tkstack", {',
        '-  description: "Serve a walkthrough",',
        '+  description: "Serve a spec or code walkthrough as a local page",',
        " }",
      ].join("\n"),
      "src/cli.ts",
    );
    expect(wrapped.startsWith("--- a/src/cli.ts\n+++ b/src/cli.ts\n")).toBe(
      true,
    );
    expect(wrapped).not.toContain("// src/cli.ts");
    expect(wrapped).toContain('-  description: "Serve a walkthrough"');
    expect(wrapped).toContain(
      '+  description: "Serve a spec or code walkthrough as a local page"',
    );
  });

  test("strips a // path comment without a leading space", () => {
    const wrapped = toUnifiedDiff(
      [
        "// src/handler.ts",
        " async function requestHandler() {",
        "-  return old;",
        "+  return new;",
        " }",
      ].join("\n"),
      "src/handler.ts",
    );
    expect(wrapped).not.toContain("// src/handler.ts");
    expect(
      wrapped.startsWith("--- a/src/handler.ts\n+++ b/src/handler.ts\n"),
    ).toBe(true);
  });

  test("does not strip a first line that is not a // comment", () => {
    const wrapped = toUnifiedDiff(
      [" requestHandler", "-└── oldService", "+└── newService"].join("\n"),
      "callstack",
    );
    expect(wrapped).toContain(" requestHandler");
    expect(wrapped).toContain("-└── oldService");
    expect(wrapped).toContain("+└── newService");
  });
});

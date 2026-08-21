import { describe, expect, test } from "vitest";
import { toUnifiedDiff } from "./normalizeDiff.js";

describe("toUnifiedDiff", () => {
  test("keeps a complete unified diff", () => {
    const source =
      "--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1 +1 @@\n-const x = 1\n+const x = 2\n";
    expect(toUnifiedDiff(source, "ignored.ts")).toBe(source);
  });

  test("wraps a preview diff that only has plus and minus lines", () => {
    const wrapped = toUnifiedDiff(
      "// src/handler.ts\n async function requestHandler(input: Input) {\n-  return existingService(input);\n+  const valid = validateInput(input);\n+  return existingService(valid);\n }\n",
      "src/handler.ts",
    );
    expect(
      wrapped.startsWith("--- a/src/handler.ts\n+++ b/src/handler.ts\n"),
    ).toBe(true);
    expect(wrapped).toContain("-  return existingService(input);");
    expect(wrapped).toContain("+  const valid = validateInput(input);");
  });

  test("wraps a call-stack preview so Pierre can render it", () => {
    const wrapped = toUnifiedDiff(
      " requestHandler\n-└── oldService\n+└── newService\n    └── dataStore\n",
      "callstack",
    );
    expect(wrapped.startsWith("--- a/callstack\n+++ b/callstack\n")).toBe(true);
    expect(wrapped).toContain("-└── oldService");
    expect(wrapped).toContain("+└── newService");
  });
});

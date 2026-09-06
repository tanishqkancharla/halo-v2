import { describe, expect, test } from "vitest";
import { parseFence, pathFromDiffSource } from "./parseFence.js";

describe("pathFromDiffSource", () => {
  test("reads path from a // body comment with a leading diff context marker", () => {
    const source = [
      " // apps/halo/src-tauri/src/lib.rs",
      " struct HaloState {",
      "     agentos: Arc<AgentOsService>,",
      "+    startup: StartupConfig,",
      " }",
    ].join("\n");
    expect(pathFromDiffSource(source)).toBe("apps/halo/src-tauri/src/lib.rs");
    expect(parseFence("diff", source)).toEqual({
      kind: "diff",
      path: "apps/halo/src-tauri/src/lib.rs",
      source,
    });
  });

  test("reads path from a // body comment without a leading space", () => {
    const source = [
      "// src/handler.ts",
      " async function requestHandler() {",
      "-  return old;",
      "+  return new;",
      " }",
    ].join("\n");
    expect(pathFromDiffSource(source)).toBe("src/handler.ts");
    expect(parseFence("diff", source)).toEqual({
      kind: "diff",
      path: "src/handler.ts",
      source,
    });
  });

  test("prefers +++/--- headers over a // body comment", () => {
    const source = [
      "--- a/src/a.ts",
      "+++ b/src/a.ts",
      " // src/other.ts",
      "-old",
      "+new",
    ].join("\n");
    expect(pathFromDiffSource(source)).toBe("src/a.ts");
  });

  test("prefers a diff:path info string over a // body comment", () => {
    const source = " // src/body.ts\n-old\n+new";
    expect(parseFence("diff:src/info.ts", source)).toEqual({
      kind: "diff",
      path: "src/info.ts",
      source,
    });
  });

  test("returns undefined when there is no path source", () => {
    const source = "-old helper\n+new helper";
    expect(pathFromDiffSource(source)).toBe(undefined);
    expect(parseFence("diff", source)).toEqual({
      kind: "diff",
      path: undefined,
      source,
    });
  });
});

import { describe, expect, test } from "vitest";
import { applyPathEvents } from "./pathEvents.js";

describe("applyPathEvents", () => {
  test("creates add a new path and dedupe an existing one", () => {
    expect(
      applyPathEvents(["a.ts"], [{ type: "create", path: "b.ts" }]),
    ).toEqual(["a.ts", "b.ts"]);
    expect(
      applyPathEvents(["a.ts"], [{ type: "create", path: "a.ts" }]),
    ).toEqual(["a.ts"]);
  });

  test("a file delete removes only the matching path", () => {
    expect(
      applyPathEvents(
        ["module/a.ts", "module-extra.ts", "module.ts"],
        [{ type: "delete", path: "module/a.ts" }],
      ),
    ).toEqual(["module-extra.ts", "module.ts"]);
  });

  test("a no-slash directory delete removes the entry and its descendants", () => {
    expect(
      applyPathEvents(
        ["module", "module/index.ts", "module/sub/deep.ts", "other.ts"],
        [{ type: "delete", path: "module" }],
      ),
    ).toEqual(["other.ts"]);
  });

  test("a trailing-slash directory delete removes the entry and its descendants", () => {
    expect(
      applyPathEvents(
        [
          "module/",
          "module/index.ts",
          "module/sub/deep.ts",
          "module/sub/",
          "other.ts",
        ],
        [{ type: "delete", path: "module/" }],
      ),
    ).toEqual(["other.ts"]);
  });

  test("a trailing-slash directory delete does not strip sibling directories with similar names", () => {
    expect(
      applyPathEvents(
        [
          "module/",
          "module/index.ts",
          "module2/",
          "module2/index.ts",
          "module-files/x.ts",
        ],
        [{ type: "delete", path: "module/" }],
      ),
    ).toEqual(["module2/", "module2/index.ts", "module-files/x.ts"]);
  });

  test("a nested trailing-slash directory delete removes only its subtree", () => {
    expect(
      applyPathEvents(
        ["src/a/", "src/a/x.ts", "src/a/sub/y.ts", "src/b/", "src/b/z.ts"],
        [{ type: "delete", path: "src/a/" }],
      ),
    ).toEqual(["src/b/", "src/b/z.ts"]);
  });

  test("delete events in a batch all apply in order", () => {
    expect(
      applyPathEvents(
        ["a/", "a/x.ts", "b/", "b/y.ts", "c.ts"],
        [
          { type: "delete", path: "a/" },
          { type: "delete", path: "b/" },
        ],
      ),
    ).toEqual(["c.ts"]);
  });

  test("reproduces the directory-move orphan for a directory created mid-session", () => {
    expect(
      applyPathEvents(
        [],
        [
          { type: "create", path: "module/" },
          { type: "create", path: "module/index.ts" },
          { type: "delete", path: "module/" },
        ],
      ),
    ).toEqual([]);
  });

  test("reproduces the directory-move orphan for a directory empty at session start", () => {
    expect(
      applyPathEvents(
        ["emptydir/"],
        [
          { type: "create", path: "emptydir/index.ts" },
          { type: "delete", path: "emptydir/" },
        ],
      ),
    ).toEqual([]);
  });
});

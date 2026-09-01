import { describe, expect, test } from "vitest";
import { parsePluginArgv } from "./parsePluginArgv.js";

describe("parsePluginArgv", () => {
  test("parses commands and calls", () => {
    expect(parsePluginArgv(["new", "notes"], undefined)).toEqual({
      kind: "create",
      id: "notes",
    });
    expect(parsePluginArgv(["types"], undefined)).toEqual({ kind: "types" });
    expect(parsePluginArgv(["notes", "todos.list"], undefined)).toEqual({
      kind: "call",
      id: "notes",
      path: ["todos", "list"],
      input: undefined,
    });
    expect(parsePluginArgv(["notes", "todos", "list"], '{"n":1}')).toEqual({
      kind: "call",
      id: "notes",
      path: ["todos", "list"],
      input: { n: 1 },
    });
  });
});

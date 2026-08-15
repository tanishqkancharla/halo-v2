import { describe, expect, test } from "vitest";
import {
  evaluateExtensionSource,
  ExtensionEvaluateError,
  ExtensionExportError,
} from "./evaluateExtensionSource.ts";

function unusedRequire() {
  throw new Error("no host modules");
}

describe("evaluateExtensionSource", () => {
  test("reads a CommonJS default export", () => {
    const loaded = evaluateExtensionSource({
      id: "sample",
      source: `
        function Main() {}
        module.exports = {
          default: {
            sidebarEntries: [{
              id: "sample",
              label: "Sample",
              items: [{ id: "sample.main", label: "Main", viewId: "main" }],
            }],
            views: { main: Main },
          },
        };
      `,
      requireModule: unusedRequire,
    });
    expect(loaded).not.toBeInstanceOf(Error);
    if (loaded instanceof Error) return;
    expect(loaded.id).toBe("sample");
    expect(loaded.sidebarEntries).toEqual([
      {
        id: "sample",
        label: "Sample",
        items: [{ id: "sample.main", label: "Main", viewId: "main" }],
      },
    ]);
    expect(typeof loaded.views.main).toBe("function");
  });

  test("reads named sidebarEntries and views on module.exports", () => {
    const loaded = evaluateExtensionSource({
      id: "named",
      source: `
        module.exports.sidebarEntries = [];
        module.exports.views = { main: function Main() {} };
      `,
      requireModule: unusedRequire,
    });
    expect(loaded).not.toBeInstanceOf(Error);
    if (loaded instanceof Error) return;
    expect(loaded.sidebarEntries).toEqual([]);
    expect(typeof loaded.views.main).toBe("function");
  });

  test("returns ExtensionExportError for a non-object export", () => {
    const loaded = evaluateExtensionSource({
      id: "bad",
      source: `module.exports = 1;`,
      requireModule: unusedRequire,
    });
    expect(loaded).toBeInstanceOf(ExtensionExportError);
  });

  test("returns ExtensionEvaluateError when the source throws", () => {
    const loaded = evaluateExtensionSource({
      id: "throws",
      source: `throw new Error("nope");`,
      requireModule: unusedRequire,
    });
    expect(loaded).toBeInstanceOf(ExtensionEvaluateError);
  });
});

const { describe, test } = require("node:test");
const assert = require("node:assert/strict");

const {
  findDocumentSymbolPath,
  findSymbolInformationPath,
} = require("./symbolPath.js");

function range(start, end) {
  return {
    start: { line: start },
    end: { line: end },
    contains: (position) => position.line >= start && position.line <= end,
  };
}

// oxlint-disable-next-line typescript/no-floating-promises -- node:test owns the registered suite Promise.
describe("findDocumentSymbolPath", () => {
  // oxlint-disable-next-line typescript/no-floating-promises -- node:test owns the registered test Promise.
  test("returns the deepest symbol path at the selection", () => {
    const symbols = [
      {
        name: "PluginService",
        range: range(10, 40),
        children: [{ name: "load", range: range(20, 30), children: [] }],
      },
    ];

    assert.deepEqual(findDocumentSymbolPath(symbols, { line: 25 }), [
      "PluginService",
      "load",
    ]);
  });

  // oxlint-disable-next-line typescript/no-floating-promises -- node:test owns the registered test Promise.
  test("returns undefined outside every symbol", () => {
    const symbols = [{ name: "load", range: range(20, 30), children: [] }];
    assert.equal(findDocumentSymbolPath(symbols, { line: 10 }), undefined);
  });
});

// oxlint-disable-next-line typescript/no-floating-promises -- node:test owns the registered suite Promise.
describe("findSymbolInformationPath", () => {
  // oxlint-disable-next-line typescript/no-floating-promises -- node:test owns the registered test Promise.
  test("uses the smallest matching symbol and its container", () => {
    const symbols = [
      {
        name: "PluginService",
        containerName: "",
        location: { range: range(10, 40) },
      },
      {
        name: "load",
        containerName: "PluginService",
        location: { range: range(20, 30) },
      },
    ];

    assert.deepEqual(findSymbolInformationPath(symbols, { line: 25 }), [
      "PluginService",
      "load",
    ]);
  });
});

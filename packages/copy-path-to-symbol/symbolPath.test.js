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

describe("findDocumentSymbolPath", () => {
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

  test("returns undefined outside every symbol", () => {
    const symbols = [{ name: "load", range: range(20, 30), children: [] }];
    assert.equal(findDocumentSymbolPath(symbols, { line: 10 }), undefined);
  });
});

describe("findSymbolInformationPath", () => {
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

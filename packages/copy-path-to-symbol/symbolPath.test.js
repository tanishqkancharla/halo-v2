const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { rangePath } = require("./rangePath.js");

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
describe("rangePath", () => {
  // oxlint-disable-next-line typescript/no-floating-promises -- node:test owns the registered test Promise.
  test("copies the selected lines as a one-based range", () => {
    assert.equal(
      rangePath("src/file.ts", {
        start: { line: 11, character: 4 },
        end: { line: 17, character: 9 },
      }),
      "src/file.ts:12-18",
    );
  });

  // oxlint-disable-next-line typescript/no-floating-promises -- node:test owns the registered test Promise.
  test("excludes a line when the selection ends at its start", () => {
    assert.equal(
      rangePath("notes.txt", {
        start: { line: 11, character: 0 },
        end: { line: 18, character: 0 },
      }),
      "notes.txt:12-18",
    );
  });

  // oxlint-disable-next-line typescript/no-floating-promises -- node:test owns the registered test Promise.
  test("copies a single line without a repeated endpoint", () => {
    assert.equal(
      rangePath("notes.txt", {
        start: { line: 0, character: 2 },
        end: { line: 0, character: 8 },
      }),
      "notes.txt:1",
    );
    assert.equal(
      rangePath("notes.txt", {
        start: { line: 0, character: 0 },
        end: { line: 1, character: 0 },
      }),
      "notes.txt:1",
    );
  });
});

// oxlint-disable-next-line typescript/no-floating-promises -- node:test owns the registered suite Promise.
describe("findDocumentSymbolPath", () => {
  // oxlint-disable-next-line typescript/no-floating-promises -- node:test owns the registered test Promise.
  test("returns the deepest symbol path at the selection", () => {
    const symbols = [
      {
        name: "ExtensionHost",
        range: range(10, 40),
        children: [{ name: "load", range: range(20, 30), children: [] }],
      },
    ];

    assert.deepEqual(findDocumentSymbolPath(symbols, { line: 25 }), [
      "ExtensionHost",
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
        name: "ExtensionHost",
        containerName: "",
        location: { range: range(10, 40) },
      },
      {
        name: "load",
        containerName: "ExtensionHost",
        location: { range: range(20, 30) },
      },
    ];

    assert.deepEqual(findSymbolInformationPath(symbols, { line: 25 }), [
      "ExtensionHost",
      "load",
    ]);
  });
});

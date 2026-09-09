const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { rangePath } = require("./rangePath.js");

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
  // oxlint-disable-next-line typescript/no-floating-promises -- node:test owns the registered test Promise.
  test("copies the cursor line even at column zero", () => {
    for (const character of [0, 4]) {
      assert.equal(
        rangePath("notes.txt", {
          start: { line: 11, character },
          end: { line: 11, character },
        }),
        "notes.txt:12",
      );
    }
  });
});

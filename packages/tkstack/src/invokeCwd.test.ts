import path from "node:path";
import { describe, expect, test } from "vitest";
import { invokeWorkingDirectory, resolveFromInvokeCwd } from "./invokeCwd.js";

describe("invokeCwd", () => {
  test("resolves relative spec paths from INIT_CWD", () => {
    const previous = process.env.INIT_CWD;
    process.env.INIT_CWD = "/workspace";
    const cwd = invokeWorkingDirectory();
    const relative = resolveFromInvokeCwd("specs/sessions-ui.md");
    const absolute = resolveFromInvokeCwd("/tmp/walkthrough.mdx");
    if (previous === undefined) {
      delete process.env.INIT_CWD;
    } else {
      process.env.INIT_CWD = previous;
    }
    expect(cwd).toBe("/workspace");
    expect(relative).toBe(path.join("/workspace", "specs/sessions-ui.md"));
    expect(absolute).toBe("/tmp/walkthrough.mdx");
  });
});

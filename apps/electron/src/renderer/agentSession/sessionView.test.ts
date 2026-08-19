import { describe, expect, test } from "vitest";
import { toolPartLabel } from "./sessionView.js";

const workspaceRoot = "/home/ubuntu/halo-workspace";

describe("toolPartLabel", () => {
  test("read labels strip the workspace root prefix", () => {
    expect(
      toolPartLabel(
        {
          toolName: "read",
          args: { path: `${workspaceRoot}/src/renderer/App.tsx` },
        },
        workspaceRoot,
      ),
    ).toEqual({ kind: "read", text: "src/renderer/App.tsx" });
  });

  test("write and edit labels strip the workspace root prefix", () => {
    expect(
      toolPartLabel(
        { toolName: "write", args: { path: `${workspaceRoot}/notes.md` } },
        workspaceRoot,
      ),
    ).toEqual({ kind: "wrote", text: "notes.md" });
    expect(
      toolPartLabel(
        { toolName: "edit", args: { path: `${workspaceRoot}/src/a.ts` } },
        workspaceRoot,
      ),
    ).toEqual({ kind: "wrote", text: "src/a.ts" });
  });

  test("shows . when the path is the workspace root", () => {
    expect(
      toolPartLabel(
        { toolName: "read", args: { path: workspaceRoot } },
        workspaceRoot,
      ),
    ).toEqual({ kind: "read", text: "." });
  });

  test("leaves paths outside the workspace unchanged", () => {
    expect(
      toolPartLabel(
        { toolName: "read", args: { path: "/etc/hosts" } },
        workspaceRoot,
      ),
    ).toEqual({ kind: "read", text: "/etc/hosts" });
    expect(
      toolPartLabel(
        {
          toolName: "read",
          args: { path: "/home/ubuntu/halo-workspace-other/a.ts" },
        },
        workspaceRoot,
      ),
    ).toEqual({
      kind: "read",
      text: "/home/ubuntu/halo-workspace-other/a.ts",
    });
  });

  test("leaves relative paths unchanged", () => {
    expect(
      toolPartLabel(
        { toolName: "read", args: { path: "src/App.tsx" } },
        workspaceRoot,
      ),
    ).toEqual({ kind: "read", text: "src/App.tsx" });
  });

  test("strips a trailing slash on the workspace root", () => {
    expect(
      toolPartLabel(
        { toolName: "read", args: { path: `${workspaceRoot}/src/a.ts` } },
        `${workspaceRoot}/`,
      ),
    ).toEqual({ kind: "read", text: "src/a.ts" });
  });

  test("normalizes backslashes when stripping", () => {
    expect(
      toolPartLabel(
        { toolName: "read", args: { path: "C:\\proj\\src\\a.ts" } },
        "C:\\proj",
      ),
    ).toEqual({ kind: "read", text: "src/a.ts" });
  });

  test("keeps the original path when workspace root is missing", () => {
    expect(
      toolPartLabel(
        { toolName: "read", args: { path: `${workspaceRoot}/src/a.ts` } },
        undefined,
      ),
    ).toEqual({ kind: "read", text: `${workspaceRoot}/src/a.ts` });
  });
});

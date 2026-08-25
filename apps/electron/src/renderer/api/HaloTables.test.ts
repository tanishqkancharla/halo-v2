import { describe, expect, test } from "vitest";
import {
  commitWrites,
  haloDb,
  pathRows,
  pathsFromRows,
  replaceCollection,
  sessionFromRow,
  sessionToRow,
  workspaceFromRow,
  workspaceToRow,
} from "./HaloTables.ts";

describe("HaloTables", () => {
  test("replaceCollection swaps every row in a collection", async () => {
    await haloDb.ready;
    await commitWrites(haloDb, (tx) => {
      replaceCollection(tx, "sessions", [
        {
          id: "a",
          agent: "pi",
          cwd: "/tmp/a",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ]);
    });
    expect(
      haloDb.query({ collection: "sessions" }).map((row) => row.id),
    ).toEqual(["a"]);

    await commitWrites(haloDb, (tx) => {
      replaceCollection(tx, "sessions", [
        {
          id: "b",
          agent: "pi",
          cwd: "/tmp/b",
          createdAt: "2026-01-02T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
        },
      ]);
    });
    expect(
      haloDb.query({ collection: "sessions" }).map((row) => row.id),
    ).toEqual(["b"]);
  });

  test("workspace and session converters keep optional fields off the row", () => {
    const needs = workspaceFromRow(
      workspaceToRow({ status: "needs-workspace" }),
    );
    expect(needs).toEqual({ status: "needs-workspace" });

    const ready = workspaceFromRow(
      workspaceToRow({
        status: "ready",
        workspace: { name: "halo", workspaceRoot: "/tmp/halo" },
      }),
    );
    expect(ready).toEqual({
      status: "ready",
      workspace: { name: "halo", workspaceRoot: "/tmp/halo" },
    });

    const session = sessionFromRow(
      sessionToRow({
        sessionId: "s1",
        agent: "pi",
        cwd: "/tmp",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
    );
    expect(session).toEqual({
      sessionId: "s1",
      agent: "pi",
      cwd: "/tmp",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
  });

  test("path rows round-trip the workspace path list", () => {
    const paths = ["src/App.tsx", "package.json"];
    expect(pathsFromRows(pathRows(paths))).toEqual(paths);
  });
});

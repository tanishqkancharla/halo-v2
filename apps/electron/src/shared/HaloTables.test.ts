import { TandemClient } from "@tandem/core";
import { describe, expect, test } from "vitest";
import {
  applyPathEvents,
  commitWrites,
  haloTables,
  pathRows,
  pathsFromRows,
  replaceCollection,
  sessionFromRow,
  sessionToRow,
  silentTandemLogger,
  workspaceFromRow,
  workspaceToRow,
  type HaloSchema,
} from "./HaloTables.ts";

describe("HaloTables", () => {
  test("replaceCollection swaps every row in a collection", async () => {
    const client = new TandemClient<HaloSchema>({
      schema: haloTables,
      logger: silentTandemLogger,
    });
    await client.ready;
    await commitWrites(client, (tx) => {
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
      client.query({ collection: "sessions" }).map((row) => row.id),
    ).toEqual(["a"]);

    await commitWrites(client, (tx) => {
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
      client.query({ collection: "sessions" }).map((row) => row.id),
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

  test("applyPathEvents adds files and removes directories recursively", () => {
    const afterCreate = applyPathEvents(
      ["src/App.tsx"],
      [{ type: "create", path: "README.md" }],
    );
    expect(afterCreate).toEqual(["src/App.tsx", "README.md"]);

    const afterDelete = applyPathEvents(
      ["src/App.tsx", "src/api/Halo.ts", "README.md"],
      [{ type: "delete", path: "src" }],
    );
    expect(afterDelete).toEqual(["README.md"]);
  });
});

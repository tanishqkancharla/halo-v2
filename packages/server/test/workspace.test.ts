import { expect } from "vitest";
import { serverTest } from "./serverTest.js";

serverTest("reads and writes workspace files over RPC", async ({ server }) => {
  await server.rpc.workspace.writeFile({
    path: "notes/today.md",
    content: "# Today",
  });

  expect(await server.rpc.workspace.readFile({ path: "notes/today.md" })).toBe(
    "# Today",
  );
  expect(await server.rpc.workspace.listPaths()).toContain("notes/today.md");
});

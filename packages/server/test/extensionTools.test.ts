import { expect } from "vitest";
import { serverTest } from "./serverTest.js";

const extensionTest = serverTest.extend<{ extensionId: string }>({
  extensionId: async ({ server }, use) => {
    await server.harness.files.write({
      path: "workspace/.halo/extensions/notes/package.json",
      content: JSON.stringify({ name: "notes", private: true, type: "module" }),
    });
    await use("notes");
  },
});

extensionTest(
  "keeps previously declined tools out of a new request",
  async ({ server, extensionId }) => {
    await server.rpc.extensions.tools.add({
      id: extensionId,
      paths: ["files.read"],
    });
    await server.rendererRpc.extensions.tools.decide({
      id: extensionId,
      paths: ["files.read"],
      action: "deny",
    });

    const result = await server.rpc.extensions.tools.add({
      id: extensionId,
      paths: ["files.write"],
    });

    expect(result.pending).toEqual(["files.write"]);
  },
);

extensionTest(
  "approves only the tools shown in a request",
  async ({ server, extensionId }) => {
    await server.rpc.extensions.tools.add({
      id: extensionId,
      paths: ["files.read"],
    });
    await server.rpc.extensions.tools.add({
      id: extensionId,
      paths: ["files.write"],
    });

    const result = await server.rendererRpc.extensions.tools.decide({
      id: extensionId,
      paths: ["files.read"],
      action: "allow",
    });

    expect(result.granted).toEqual(["files.read"]);
    expect(result.pending).toEqual(["files.write"]);
  },
);

extensionTest(
  "requires approval again after a declaration is removed and re-added",
  async ({ server, extensionId }) => {
    await server.rpc.extensions.tools.add({
      id: extensionId,
      paths: ["files.read"],
    });
    await server.rendererRpc.extensions.tools.decide({
      id: extensionId,
      paths: ["files.read"],
      action: "allow",
    });

    await server.harness.files.write({
      path: "workspace/.halo/extensions/notes/package.json",
      content: JSON.stringify({ name: "notes", halo: { capabilities: [] } }),
    });
    await server.rpc.extensions.tools.check({ id: extensionId });
    const result = await server.rpc.extensions.tools.add({
      id: extensionId,
      paths: ["files.read"],
    });

    expect(result.granted).toEqual([]);
    expect(result.pending).toEqual(["files.read"]);
  },
);

extensionTest(
  "keeps capability declarations when the user revokes access",
  async ({ server, extensionId }) => {
    await server.rpc.extensions.tools.add({
      id: extensionId,
      paths: ["files.read"],
    });
    await server.rendererRpc.extensions.tools.decide({
      id: extensionId,
      paths: ["files.read"],
      action: "allow",
    });

    const result = await server.rendererRpc.extensions.tools.decide({
      id: extensionId,
      paths: ["files.read"],
      action: "revoke",
    });

    expect(result.requested).toEqual(["files.read"]);
    expect(result.granted).toEqual([]);
    expect(result.pending).toEqual([]);
  },
);

extensionTest(
  "does not let the CLI approve its own request",
  async ({ server, extensionId }) => {
    await server.rpc.extensions.tools.add({
      id: extensionId,
      paths: ["files.read"],
    });

    await expect(
      server.rpc.extensions.tools.decide({
        id: extensionId,
        paths: ["files.read"],
        action: "allow",
      }),
    ).rejects.toThrow("Approve extension access in Halo.");
  },
);

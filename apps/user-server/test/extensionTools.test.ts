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
  "preserves both capability additions made at the same time",
  async ({ server, extensionId }) => {
    await Promise.all([
      server.rpc.extensions.tools.add({
        id: extensionId,
        paths: ["files.read"],
      }),
      server.rpc.extensions.tools.add({
        id: extensionId,
        paths: ["files.write"],
      }),
    ]);

    const result = await server.rpc.extensions.tools.check({ id: extensionId });
    expect(result.requested).toEqual(["files.read", "files.write"]);
    expect(result.pending).toEqual(["files.read", "files.write"]);
  },
);

extensionTest(
  "restores each extension's approvals and pending requests after restart",
  async ({ server, extensionId }) => {
    await server.harness.files.write({
      path: "workspace/.halo/extensions/calendar/package.json",
      content: JSON.stringify({
        name: "calendar",
        private: true,
        type: "module",
      }),
    });
    await server.rpc.extensions.tools.add({
      id: extensionId,
      paths: ["files.read", "files.write"],
    });
    await server.rpc.extensions.tools.add({
      id: "calendar",
      paths: ["files.read"],
    });
    await server.rendererRpc.extensions.tools.decide({
      id: extensionId,
      paths: ["files.read"],
      action: "allow",
    });

    await server.stop();
    await server.start();

    const notes = await server.rpc.extensions.tools.check({ id: extensionId });
    expect(notes.granted).toEqual(["files.read"]);
    expect(notes.pending).toEqual(["files.write"]);
    const calendar = await server.rpc.extensions.tools.check({
      id: "calendar",
    });
    expect(calendar.granted).toEqual([]);
    expect(calendar.pending).toEqual(["files.read"]);

    const requests = await server.rendererRpc.extensions.tools.requests();
    expect((await requests.next()).value).toEqual([
      { id: "calendar", displayName: "calendar", paths: ["files.read"] },
      { id: extensionId, displayName: "notes", paths: ["files.write"] },
    ]);

    await server.rendererRpc.extensions.tools.decide({
      id: extensionId,
      paths: ["files.write"],
      action: "allow",
    });

    expect((await requests.next()).value).toEqual([
      { id: "calendar", displayName: "calendar", paths: ["files.read"] },
    ]);
    await requests.return();
  },
);

extensionTest(
  "keeps declined tools out of a new request after restart",
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

    await server.stop();
    await server.start();

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
  "preserves revocation and capability declarations after restart",
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

    await server.rendererRpc.extensions.tools.decide({
      id: extensionId,
      paths: ["files.read"],
      action: "revoke",
    });

    await server.stop();
    await server.start();

    const result = await server.rpc.extensions.tools.check({ id: extensionId });
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

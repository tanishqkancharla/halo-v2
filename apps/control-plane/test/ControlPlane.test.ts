import fs from "node:fs/promises";
import { join, resolve } from "node:path";
import * as errore from "errore";
import { expect, test } from "vitest";
import { ControlPlane } from "../src/ControlPlane.js";
import { readControlPlaneFile } from "../src/ControlPlaneFile.js";

const testAuth = {
  secret: "test-control-plane-auth-secret-key!",
  googleClientId: "test-google-client-id.apps.googleusercontent.com",
  googleClientSecret: "test-google-client-secret",
};

const controlPlaneTest = test.extend<{ appDataDir: string }>({
  appDataDir: async ({ task }, use) => {
    const parent = resolve(import.meta.dirname, "../../../tmp/control-plane");
    await fs.mkdir(parent, { recursive: true });
    const appDataDir = await fs.mkdtemp(join(parent, `${task.id}-`));
    await use(appDataDir);
    await fs.rm(appDataDir, { recursive: true, force: true });
  },
});

controlPlaneTest(
  "stays reachable on loopback and removes the origin file on close",
  async ({ appDataDir }) => {
    await using cleanup = new errore.AsyncDisposableStack();
    const plane = await ControlPlane.start({
      appDataDir,
      port: 0,
      auth: testAuth,
    });
    if (plane instanceof Error) throw plane;
    const lifetime = { open: true };
    cleanup.defer(async () => {
      if (!lifetime.open) return;
      const closed = await plane.close();
      if (closed instanceof Error) console.warn(closed);
    });

    const health = await fetch(`${plane.origin}/health`);
    expect(health.status).toBe(200);

    const published = await readControlPlaneFile(appDataDir);
    if (published instanceof Error) throw published;
    expect(published).toEqual({ origin: plane.origin });

    lifetime.open = false;
    const closed = await plane.close();
    if (closed instanceof Error) throw closed;

    const removed = await readControlPlaneFile(appDataDir);
    if (removed instanceof Error) throw removed;
    expect(removed).toBeUndefined();

    const afterClose = await fetch(`${plane.origin}/health`).then(
      () => "answered",
      () => "gone",
    );
    expect(afterClose).toBe("gone");
  },
);

controlPlaneTest("serves Better Auth at /api/auth", async ({ appDataDir }) => {
  await using cleanup = new errore.AsyncDisposableStack();
  const plane = await ControlPlane.start({
    appDataDir,
    port: 0,
    auth: testAuth,
  });
  if (plane instanceof Error) throw plane;
  cleanup.defer(async () => {
    const closed = await plane.close();
    if (closed instanceof Error) console.warn(closed);
  });

  const ok = await fetch(`${plane.origin}/api/auth/ok`);
  expect(ok.status).toBe(200);
  expect(await ok.json()).toEqual({ ok: true });
});

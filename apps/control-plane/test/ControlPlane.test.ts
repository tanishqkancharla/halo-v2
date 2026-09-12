import fs from "node:fs/promises";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { betterAuth } from "better-auth";
import { testUtils } from "better-auth/plugins";
import * as errore from "errore";
import { expect, test } from "vitest";
import { ControlPlane } from "../src/ControlPlane.js";
import { readControlPlaneFile } from "../src/ControlPlaneFile.js";

const testAuth = {
  secret: "test-control-plane-auth-secret-key!",
  googleClientId: "test-google-client-id.apps.googleusercontent.com",
  googleClientSecret: "test-google-client-secret",
};

const desktopAuthState = "desktop-auth-state-0123456789abcdef";

const desktopAuthSessionSchema = Type.Object({
  token: Type.String({ minLength: 1 }),
  session: Type.Object({
    id: Type.String({ minLength: 1 }),
    userId: Type.String({ minLength: 1 }),
    expiresAt: Type.String({ minLength: 1 }),
  }),
  user: Type.Object({
    id: Type.String({ minLength: 1 }),
    email: Type.String({ minLength: 1 }),
    name: Type.String({ minLength: 1 }),
    image: Type.Optional(Type.String()),
  }),
});

const controlPlaneTest = test.extend<{
  appDataDir: string;
  plane: ControlPlane;
}>({
  appDataDir: async ({ task }, use) => {
    const parent = resolve(import.meta.dirname, "../../../tmp/control-plane");
    await fs.mkdir(parent, { recursive: true });
    const appDataDir = await fs.mkdtemp(join(parent, `${task.id}-`));
    await use(appDataDir);
    await fs.rm(appDataDir, { recursive: true, force: true });
  },
  plane: async ({ appDataDir }, use) => {
    const plane = await ControlPlane.start({
      deployment: "local",
      appDataDir,
      port: 0,
      auth: testAuth,
    });
    if (plane instanceof Error) throw plane;
    await use(plane);
    const closed = await plane.close();
    if (closed instanceof Error) console.warn(closed);
  },
});

controlPlaneTest(
  "stays reachable on loopback and removes the origin file on close",
  async ({ appDataDir }) => {
    await using cleanup = new errore.AsyncDisposableStack();
    const plane = await ControlPlane.start({
      deployment: "local",
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

controlPlaneTest("serves Better Auth at /api/auth", async ({ plane }) => {
  const ok = await fetch(`${plane.origin}/api/auth/ok`);
  expect(ok.status).toBe(200);
  expect(await ok.json()).toEqual({ ok: true });
});

controlPlaneTest(
  "starts Google sign-in for a desktop loopback callback",
  async ({ plane }) => {
    const start = new URL("/api/desktop-auth/start", plane.origin);
    start.searchParams.set("callback", "http://127.0.0.1:49152/auth/callback");
    start.searchParams.set("state", desktopAuthState);

    const response = await fetch(start, { redirect: "manual" });
    expect(response.status).toBe(302);
    const location = response.headers.get("location");
    if (location === null) throw new Error("Desktop sign-in did not redirect");
    const google = new URL(location);
    expect(google.origin).toBe("https://accounts.google.com");
    expect(google.pathname).toBe("/o/oauth2/v2/auth");
  },
);

controlPlaneTest(
  "rejects a desktop callback outside loopback",
  async ({ plane }) => {
    const start = new URL("/api/desktop-auth/start", plane.origin);
    start.searchParams.set(
      "callback",
      "https://attacker.example/auth/callback",
    );
    start.searchParams.set("state", desktopAuthState);

    const response = await fetch(start, { redirect: "manual" });
    expect(response.status).toBe(400);
  },
);

controlPlaneTest(
  "exchanges a one-time code for a bearer session",
  async ({ appDataDir, plane }) => {
    const browserHeaders = await createAuthenticatedHeaders(
      appDataDir,
      plane.origin,
    );
    const callback = "http://127.0.0.1:49152/auth/callback";
    const complete = new URL("/api/desktop-auth/complete", plane.origin);
    complete.searchParams.set("callback", callback);
    complete.searchParams.set("state", desktopAuthState);

    const completion = await fetch(complete, {
      headers: browserHeaders,
      redirect: "manual",
    });
    expect(completion.status).toBe(302);
    const location = completion.headers.get("location");
    if (location === null) throw new Error("Desktop sign-in did not complete");
    const redirected = new URL(location);
    expect(redirected.origin + redirected.pathname).toBe(callback);
    expect(redirected.searchParams.get("state")).toBe(desktopAuthState);
    const code = redirected.searchParams.get("code");
    if (code === null) throw new Error("Desktop sign-in did not return a code");

    const exchange = await fetch(`${plane.origin}/api/desktop-auth/exchange`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
    expect(exchange.status).toBe(200);
    const payload: unknown = await exchange.json();
    if (!Value.Check(desktopAuthSessionSchema, payload))
      throw new Error("Desktop exchange returned an invalid session");
    expect(payload.user.email).toBe("desktop@example.com");

    const session = await fetch(`${plane.origin}/api/auth/get-session`, {
      headers: { authorization: `Bearer ${payload.token}` },
    });
    expect(session.status).toBe(200);
    expect(await session.json()).toMatchObject({
      user: { email: "desktop@example.com" },
    });

    const reused = await fetch(`${plane.origin}/api/desktop-auth/exchange`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
    expect(reused.status).toBe(400);
  },
);

async function createAuthenticatedHeaders(appDataDir: string, origin: string) {
  using database = new DatabaseSync(join(appDataDir, "auth.db"));
  const auth = betterAuth({
    baseURL: origin,
    secret: testAuth.secret,
    database,
    plugins: [testUtils()],
  });
  const context = await auth.$context;
  const user = context.test.createUser({
    email: "desktop@example.com",
    name: "Desktop User",
  });
  await context.test.saveUser(user);
  const login = await context.test.login({ userId: user.id });
  return login.headers;
}

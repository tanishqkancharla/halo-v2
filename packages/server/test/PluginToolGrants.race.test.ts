import path from "node:path";
import * as errore from "errore";
import { expect, test as baseTest } from "vitest";
import { FilesystemService } from "../src/filesystem/FilesystemService.js";
import { PluginToolGrants } from "../src/plugins/PluginToolGrants.js";
import { WorkspaceService } from "../src/workspace/WorkspaceService.js";
import { createTestArtifacts } from "./TestArtifacts.js";

type GrantsFileState = {
  plugins: Record<string, { observed: string[]; granted: string[] }>;
};

type GrantsEnv = {
  filesystem: FilesystemService;
  grants: PluginToolGrants;
  grantsFile: string;
  writes: GrantsWriteInstrument;
};

const test = baseTest.extend<{ env: GrantsEnv }>({
  env: async ({ task }, use) => {
    const artifacts = await createTestArtifacts(task.id);
    await using cleanup = new errore.AsyncDisposableStack();
    cleanup.defer(() =>
      artifacts.finish({ passed: task.result?.state === "pass" }),
    );
    const filesystem = new FilesystemService();
    cleanup.defer(async () => {
      await filesystem.close();
    });
    const workspace = new WorkspaceService({
      appDataDir: artifacts.paths.userData,
      filesystem,
      appVersion: "0.0.0-test",
    });
    cleanup.defer(() => workspace.close());
    const selected = await workspace.select(artifacts.paths.workspace);
    if (selected instanceof Error) throw selected;
    const grants = new PluginToolGrants({ filesystem, workspace });
    const grantsFile = path.join(
      artifacts.paths.workspace,
      ".halo",
      "pluginGrants.json",
    );
    const writes = instrumentGrantsWrites(filesystem, grantsFile);
    await use({ filesystem, grants, grantsFile, writes });
  },
});

test("serializes concurrent grants so neither capability is lost", async ({
  env,
}) => {
  const { grants, writes } = env;

  writes.armGate();
  const alpha = grants.grant({
    pluginId: "alpha",
    declaredPaths: ["files.read"],
    grantPaths: ["files.read"],
  });
  await writes.firstWriteSuspended();

  const beta = grants.grant({
    pluginId: "beta",
    declaredPaths: ["files.write"],
    grantPaths: ["files.write"],
  });
  await writes.waitForSecondWriteAttempt(50);

  writes.openGate();
  const [alphaResult, betaResult] = await Promise.all([alpha, beta]);

  expect(alphaResult).not.toBeInstanceOf(Error);
  expect(betaResult).not.toBeInstanceOf(Error);
  if (alphaResult instanceof Error) throw alphaResult;
  if (betaResult instanceof Error) throw betaResult;
  expect(alphaResult.granted).toContain("files.read");
  expect(betaResult.granted).toContain("files.write");

  const state = await readGrantsFile(env);
  expect(state.plugins["alpha"]?.granted ?? []).toContain("files.read");
  expect(state.plugins["beta"]?.granted ?? []).toContain("files.write");
}, 10_000);

test("serializes concurrent grants so an interleaving reconcile cannot lose a grant", async ({
  env,
}) => {
  const { grants, writes } = env;

  writes.armGate();
  const grantOp = grants.grant({
    pluginId: "alpha",
    declaredPaths: ["files.read"],
    grantPaths: ["files.read"],
  });
  await writes.firstWriteSuspended();

  const reconcileOp = grants.reconcile({
    pluginId: "beta",
    declaredPaths: ["files.write"],
  });
  await writes.waitForSecondWriteAttempt(50);

  writes.openGate();
  const [grantResult, reconcileResult] = await Promise.all([
    grantOp,
    reconcileOp,
  ]);

  expect(grantResult).not.toBeInstanceOf(Error);
  expect(reconcileResult).not.toBeInstanceOf(Error);

  const state = await readGrantsFile(env);
  expect(state.plugins["alpha"]?.granted ?? []).toContain("files.read");
  expect(state.plugins["beta"]).toBeDefined();
}, 10_000);

test("authorize does not write when the manifest is unchanged", async ({
  env,
}) => {
  const granted = await env.grants.grant({
    pluginId: "reader",
    declaredPaths: ["files.read"],
    grantPaths: ["files.read"],
  });
  if (granted instanceof Error) throw granted;
  env.writes.reset();

  for (let i = 0; i < 5; i += 1) {
    const ok = await env.grants.authorize({
      pluginId: "reader",
      declaredPaths: ["files.read"],
      path: "files.read",
    });
    expect(ok).toBe(true);
  }
  expect(env.writes.count).toBe(0);

  const afterChange = await env.grants.authorize({
    pluginId: "reader",
    declaredPaths: ["files.read", "files.write"],
    path: "files.read",
  });
  expect(afterChange).toBe(true);
  expect(env.writes.count).toBe(1);
});

test("authorize denies a removed capability immediately", async ({ env }) => {
  const granted = await env.grants.grant({
    pluginId: "reader",
    declaredPaths: ["files.read"],
    grantPaths: ["files.read"],
  });
  if (granted instanceof Error) throw granted;

  const denied = await env.grants.authorize({
    pluginId: "reader",
    declaredPaths: [],
    path: "files.read",
  });
  expect(denied).toBe(false);
});

test("re-adding a removed capability requires a new grant", async ({ env }) => {
  const granted = await env.grants.grant({
    pluginId: "reader",
    declaredPaths: ["files.read"],
    grantPaths: ["files.read"],
  });
  if (granted instanceof Error) throw granted;
  expect(
    await env.grants.authorize({
      pluginId: "reader",
      declaredPaths: ["files.read"],
      path: "files.read",
    }),
  ).toBe(true);

  const removed = await env.grants.authorize({
    pluginId: "reader",
    declaredPaths: [],
    path: "files.read",
  });
  expect(removed).toBe(false);

  expect(
    await env.grants.authorize({
      pluginId: "reader",
      declaredPaths: ["files.read"],
      path: "files.read",
    }),
  ).toBe(false);

  const regranted = await env.grants.grant({
    pluginId: "reader",
    declaredPaths: ["files.read"],
    grantPaths: ["files.read"],
  });
  if (regranted instanceof Error) throw regranted;
  expect(
    await env.grants.authorize({
      pluginId: "reader",
      declaredPaths: ["files.read"],
      path: "files.read",
    }),
  ).toBe(true);
}, 10_000);

test("persists concurrent grants for distinct plugins under load", async ({
  env,
}) => {
  const plugins = ["alpha", "beta", "gamma", "delta"] as const;
  const grants = await Promise.all(
    plugins.map((pluginId) =>
      env.grants.grant({
        pluginId,
        declaredPaths: [`files.read.${pluginId}`],
        grantPaths: [`files.read.${pluginId}`],
      }),
    ),
  );
  for (const result of grants) {
    expect(result).not.toBeInstanceOf(Error);
  }
  const state = await readGrantsFile(env);
  for (const pluginId of plugins) {
    expect(state.plugins[pluginId]?.granted ?? []).toContain(
      `files.read.${pluginId}`,
    );
  }
});

type GrantsWriteInstrument = {
  readonly count: number;
  reset(): void;
  armGate(): void;
  openGate(): void;
  firstWriteSuspended(): Promise<void>;
  waitForSecondWriteAttempt(timeoutMs: number): Promise<void>;
};

function instrumentGrantsWrites(
  filesystem: FilesystemService,
  grantsFile: string,
): GrantsWriteInstrument {
  const state = { count: 0, reachedTwo: false };
  let gateArmed = false;
  let firstWriteSawGate = false;
  let gatePromise: Promise<void> | undefined;
  let openGateFn: (() => void) | undefined;
  let firstWriteSuspendedFn: (() => void) | undefined;
  let firstWriteSuspendedPromise: Promise<void> | undefined;
  let secondWriteResolver: (() => void) | undefined;
  let secondWritePromise: Promise<void> = new Promise<void>((resolve) => {
    secondWriteResolver = () => {
      state.reachedTwo = true;
      resolve();
    };
  });
  const originalWriteFile = filesystem.writeFile.bind(filesystem);
  filesystem.writeFile = async (filePath, data, options) => {
    if (filePath === grantsFile) {
      state.count += 1;
      if (!state.reachedTwo && state.count >= 2) {
        secondWriteResolver?.();
      }
      if (gateArmed && !firstWriteSawGate) {
        firstWriteSawGate = true;
        firstWriteSuspendedFn?.();
        if (gatePromise !== undefined) await gatePromise;
      }
    }
    return originalWriteFile(filePath, data, options);
  };
  return {
    get count() {
      return state.count;
    },
    reset() {
      state.count = 0;
      state.reachedTwo = false;
      secondWritePromise = new Promise<void>((resolve) => {
        secondWriteResolver = () => {
          state.reachedTwo = true;
          resolve();
        };
      });
    },
    armGate() {
      gatePromise = new Promise<void>((resolve) => {
        openGateFn = resolve;
      });
      firstWriteSuspendedPromise = new Promise<void>((resolve) => {
        firstWriteSuspendedFn = resolve;
      });
      gateArmed = true;
      firstWriteSawGate = false;
    },
    openGate() {
      gateArmed = false;
      openGateFn?.();
      openGateFn = undefined;
      gatePromise = undefined;
    },
    firstWriteSuspended() {
      if (firstWriteSuspendedPromise === undefined) {
        throw new Error(
          "armGate() must be called before firstWriteSuspended()",
        );
      }
      return firstWriteSuspendedPromise;
    },
    async waitForSecondWriteAttempt(timeoutMs) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timed = new Promise<void>((resolve) => {
        timer = setTimeout(resolve, timeoutMs);
      });
      await Promise.race([secondWritePromise, timed]);
      if (timer !== undefined) clearTimeout(timer);
    },
  };
}

async function readGrantsFile(env: GrantsEnv): Promise<GrantsFileState> {
  const raw = await env.filesystem.readFile(env.grantsFile, "utf8");
  if (raw instanceof Error) throw raw;
  // SAFETY: PluginToolGrants.write serializes a versioned PluginToolGrantState.
  return JSON.parse(raw) as GrantsFileState;
}

import fs from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { readSecret } from "@get-halo/gcp/secrets";
import { Value } from "@sinclair/typebox/value";
import { Logger } from "@repo/logger";
import { JsonlLoggerSink } from "@repo/logger/JsonlLoggerSink";
import * as errore from "errore";
import { HaloServer } from "./HaloServer.js";
import { FilesystemService } from "./filesystem/FilesystemService.js";
import { UserService } from "./UserService.js";
import {
  writeWorkspaceServerConnection,
  removeWorkspaceServerConnection,
} from "./ConnectionFile.js";
import { writeHaloRpcFile, removeHaloRpcFile } from "./rpcFile.js";
import {
  workspaceServerConfigSchema,
  type WorkspaceServerConfig,
  type WorkspaceServerReady,
} from "./WorkspaceServerConfig.js";
import { FileCredentialVault } from "./agent/runtime/FileCredentialVault.js";
import { createPiLLMApi } from "./llm/PiLLMApi.js";
import {
  createOpenAILLMApi,
  type OpenAILLMApiOptions,
} from "./llm/OpenAILLMApi.js";

class WorkspaceServerStartupError extends errore.createTaggedError({
  name: "WorkspaceServerStartupError",
  message: "Workspace server startup failed: $detail",
}) {}

const openAiApiKeySecretId = "halo-dev-local-openai-api-key";
const secretProjectId = "halo-relay";

async function readConfiguration(): Promise<WorkspaceServerConfig | Error> {
  const configPath = process.argv[2];
  if (configPath === undefined) return await developmentConfiguration();
  const raw = await fs.readFile(configPath, "utf8").catch(
    (cause) =>
      new WorkspaceServerStartupError({
        detail: "read configuration",
        cause,
      }),
  );
  if (raw instanceof Error) return raw;
  const config = errore.try({
    // SAFETY: JSON.parse is untyped; workspaceServerConfigSchema validates the result below.
    try: () => JSON.parse(raw) as unknown,
    catch: (cause) =>
      new WorkspaceServerStartupError({ detail: "parse configuration", cause }),
  });
  if (config instanceof Error) return config;
  if (!Value.Check(workspaceServerConfigSchema, config))
    return new WorkspaceServerStartupError({ detail: "invalid configuration" });
  return config;
}

async function developmentConfiguration(): Promise<
  WorkspaceServerConfig | Error
> {
  const repositoryRoot = resolve(import.meta.dirname, "../../..");
  const filesystem = new FilesystemService();
  await using cleanup = new errore.AsyncDisposableStack();
  cleanup.defer(async () => {
    const closed = await filesystem.close();
    if (closed instanceof Error) console.warn(closed);
  });
  const workspaceRoot = process.env.HALO_WORKSPACE_ROOT;
  if (workspaceRoot === undefined)
    return new WorkspaceServerStartupError({
      detail: "set HALO_WORKSPACE_ROOT or pass a configuration JSON file",
    });
  const appDataDir =
    process.env.HALO_USER_DATA === undefined
      ? join(repositoryRoot, ".halo")
      : resolve(process.env.HALO_USER_DATA);
  const user = await new UserService({ filesystem, appDataDir }).getUser();
  if (user instanceof Error) return user;
  const rendererPort =
    process.env.HALO_RENDERER_PORT === undefined
      ? "1420"
      : process.env.HALO_RENDERER_PORT;
  const rendererOrigin = `http://localhost:${rendererPort}`;
  return {
    workspaceRoot: resolve(workspaceRoot),
    appDataDir,
    appVersion: "0.0.0",
    ownerUserId: user.id,
    logFilePath: join(appDataDir, "logs", "server.jsonl"),
    corsOrigins: [rendererOrigin, "null"],
    port: 0,
    cliEntry: join(repositoryRoot, "packages", "halo-cli", "src", "cli.ts"),
    cliNodeExecutable: process.execPath,
    extensionRuntime: {
      executable: process.execPath,
      electronRunAsNode: false,
    },
    appBrowserTarget: {
      cdpUrl: "http://127.0.0.1:4445",
      pageUrl: rendererOrigin,
    },
  };
}

async function createLLMApi(workspaceRoot: string) {
  const configuration = process.env.HALO_LLM_CONFIG;
  if (configuration !== undefined) {
    const options = errore.try({
      // SAFETY: The host supplies serialized OpenAILLMApiOptions as launch configuration.
      try: () => JSON.parse(configuration) as OpenAILLMApiOptions,
      catch: (cause) =>
        new WorkspaceServerStartupError({
          detail: "parse HALO_LLM_CONFIG",
          cause,
        }),
    });
    if (options instanceof Error) return options;
    return createOpenAILLMApi(options);
  }
  const apiKey = await readSecret({
    projectId: secretProjectId,
    secretId: openAiApiKeySecretId,
  });
  if (apiKey instanceof Error) return apiKey;
  return await createPiLLMApi({
    agentDir: join(workspaceRoot, ".pi", "agent"),
    provider: "openai-codex",
    modelId: "gpt-5.6-terra",
    apiKey,
  });
}

async function run() {
  const stopping = new Promise<void>((stop) => {
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
    process.once("disconnect", stop);
    process.on("message", (message) => {
      if (message === "shutdown") stop();
    });
  });
  const config = await readConfiguration();
  if (config instanceof Error) return config;
  process.env.HALO_USER_DATA = config.appDataDir;
  const created = await fs
    .mkdir(dirname(config.logFilePath), { recursive: true })
    .catch(
      (cause) =>
        new WorkspaceServerStartupError({
          detail: "create log directory",
          cause,
        }),
    );
  if (created instanceof Error) return created;
  const llmApi = await createLLMApi(config.workspaceRoot);
  if (llmApi instanceof Error) return llmApi;
  const logger = new Logger({
    sinks: [new JsonlLoggerSink({ filePath: config.logFilePath })],
  });
  await using cleanup = new errore.AsyncDisposableStack();
  cleanup.defer(() => logger.destroy());
  const server = await HaloServer.start({
    ...config,
    llmApi,
    ownerUserId: Promise.resolve(config.ownerUserId),
    logger: logger.scope("rpc"),
    host: "127.0.0.1",
    port: config.port,
    createCredentialVault: ({ filesystem, workspaceRoot }) =>
      new FileCredentialVault({
        filesystem,
        directory: join(workspaceRoot, ".halo", "executor", "credentials"),
      }),
  });
  if (server instanceof Error) return server;
  cleanup.defer(async () => {
    const closed = await server.close();
    if (closed instanceof Error) console.error(closed);
  });
  const cliPublished = await writeHaloRpcFile({
    userDataDir: config.appDataDir,
    connection: server.connections.cli,
  });
  if (cliPublished instanceof Error) return cliPublished;
  cleanup.defer(async () => {
    const removed = await removeHaloRpcFile({ userDataDir: config.appDataDir });
    if (removed instanceof Error) console.error(removed);
  });
  const renderer = server.connections.renderer;
  const published = await writeWorkspaceServerConnection({
    appDataDir: config.appDataDir,
    connection: {
      workspaceRoot: server.getWorkspace().workspaceRoot,
      origin: `http://${renderer.host}:${renderer.port}`,
      token: renderer.token,
    },
  });
  if (published instanceof Error) return published;
  cleanup.defer(async () => {
    const removed = await removeWorkspaceServerConnection(config.appDataDir);
    if (removed instanceof Error) console.error(removed);
  });
  const ready: WorkspaceServerReady = {
    workspace: server.getWorkspace(),
    connections: server.connections,
  };
  console.log(`Workspace server ready for ${ready.workspace.workspaceRoot}`);
  if (process.connected) process.send?.(ready);

  await stopping;
}

// oxlint-disable-next-line typescript/no-floating-promises -- This entry point owns the process lifetime and exits after service cleanup.
run().then((result) => {
  if (result instanceof Error) console.error(result);
  process.exit(result instanceof Error ? 1 : 0);
});

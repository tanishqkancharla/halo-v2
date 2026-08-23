import { dialog, type BrowserWindow } from "electron";
import { implement } from "@orpc/server";
import type { Logger } from "@repo/logger";
import { agentSessionStateFromSession } from "../shared/AgentSessionState.js";
import { contract } from "../shared/contract.js";
import type { AgentSessionEvent, WorkspaceTreeEvent } from "../shared/rpc.js";
import {
  AbortFailedError,
  EmptyPromptError,
  PromptFailedError,
} from "./agent-session-errors.js";
import type { AgentSessionRegistry } from "./AgentSessionRegistry.js";
import { getAppInfo, installAppUpdate } from "./AppUpdate.js";
import { AsyncEventQueue } from "../shared/AsyncEventQueue.js";
import { orpcErrors } from "./orpcErrors.js";
import type { PiService } from "./pi-service.js";
import type { PluginService } from "./plugins/PluginService.js";
import type { WorkspaceService } from "./workspace-service.js";

export type HaloContext = {
  workspace: WorkspaceService;
  pi: PiService;
  plugins: PluginService;
  sessions: AgentSessionRegistry;
  getWindow: () => BrowserWindow;
  logger: Logger;
};

const os = implement(contract).$context<HaloContext>();

export const router = {
  getAppInfo: os.getAppInfo.handler(({ context }) => {
    context.logger.info({ event: "getAppInfo" });
    return getAppInfo();
  }),
  installAppUpdate: os.installAppUpdate.handler(() => {
    const result = installAppUpdate();
    if (result instanceof Error) return orpcErrors.badRequest(result);
  }),
  getWorkspace: os.getWorkspace.handler(({ context }) => {
    context.logger.info({ event: "getWorkspace" });
    return context.workspace.getWorkspace();
  }),
  chooseWorkspace: os.chooseWorkspace.handler(async ({ context }) => {
    context.logger.info({ event: "chooseWorkspace" });
    const selection = await dialog.showOpenDialog(context.getWindow(), {
      title: "Choose a Halo workspace",
      buttonLabel: "Choose workspace",
      properties: ["openDirectory"],
    });
    if (selection.canceled) return undefined;
    const workspace = await context.workspace.select(selection.filePaths[0]!);
    if (workspace instanceof Error) return orpcErrors.badRequest(workspace);
    return workspace;
  }),
  listSessions: os.listSessions.handler(async ({ context }) => {
    context.logger.info({ event: "listSessions" });
    const sessions = await context.pi.listSessions();
    if (sessions instanceof Error) return orpcErrors.badRequest(sessions);
    return sessions;
  }),
  listWorkspacePaths: os.listWorkspacePaths.handler(async ({ context }) => {
    context.logger.info({ event: "listWorkspacePaths" });
    const paths = await context.workspace.listPaths();
    if (paths instanceof Error) return orpcErrors.badRequest(paths);
    return paths;
  }),
  listPlugins: os.listPlugins.handler(async ({ context }) => {
    context.logger.info({ event: "listPlugins" });
    const listed = await context.plugins.list();
    if (listed instanceof Error) return orpcErrors.badRequest(listed);
    context.logger.info({
      event: "listPluginsResult",
      pluginIds: listed.plugins.map((plugin) => plugin.id),
      compiledViewIds: listed.compiledViews.map((view) => view.id),
      errors: listed.errors,
    });
    return listed;
  }),
  subscribeWorkspaceTree: os.subscribeWorkspaceTree.handler(
    ({ context, signal }) => {
      context.logger.info({ event: "subscribeWorkspaceTree" });
      const queue = new AsyncEventQueue<WorkspaceTreeEvent[]>();
      context.workspace.setTreeListener((events) => {
        void queue.push(events);
      });
      return (async function* () {
        try {
          yield* queue.values(signal);
        } finally {
          context.workspace.setTreeListener(undefined);
        }
      })();
    },
  ),
  newAgentSession: os.newAgentSession.handler(async ({ context }) => {
    context.logger.info({ event: "newAgentSession" });
    const session = await context.pi.newAgentSession();
    if (session instanceof Error) return orpcErrors.badRequest(session);
    context.sessions.add(session);
    return { sessionId: session.sessionId };
  }),
  openAgentSession: os.openAgentSession.handler(async ({ input, context }) => {
    context.logger.info({
      event: "openAgentSession",
      sessionId: input.sessionId,
    });
    const live = context.sessions.get(input.sessionId);
    if (live instanceof Error) {
      const session = await context.pi.openAgentSession(input.sessionId);
      if (session instanceof Error) return orpcErrors.badRequest(session);
      context.sessions.add(session);
      return {
        sessionId: session.sessionId,
        state: agentSessionStateFromSession({
          messages: session.messages,
          isStreaming: session.isStreaming,
        }),
      };
    }
    return {
      sessionId: live.sessionId,
      state: agentSessionStateFromSession({
        messages: live.messages,
        isStreaming: live.isStreaming,
      }),
    };
  }),
  agentSession: {
    events: os.agentSession.events.handler(({ input, context, signal }) => {
      context.logger.info({
        event: "agentSession.events",
        sessionId: input.sessionId,
      });
      const session = context.sessions.get(input.sessionId);
      if (session instanceof Error) return orpcErrors.badRequest(session);
      const queue = new AsyncEventQueue<AgentSessionEvent>();
      const unsubscribe = session.subscribe((event) => {
        void queue.push(event);
      });
      return (async function* () {
        try {
          yield* queue.values(signal);
        } finally {
          unsubscribe();
        }
      })();
    }),
    prompt: os.agentSession.prompt.handler(async ({ input, context }) => {
      context.logger.info({
        event: "prompt",
        sessionId: input.sessionId,
        textLength: input.text.length,
      });
      const session = context.sessions.get(input.sessionId);
      if (session instanceof Error) return orpcErrors.badRequest(session);
      if (input.text.trim().length === 0)
        return orpcErrors.badRequest(new EmptyPromptError());
      const prompted = await session
        .prompt(input.text, { streamingBehavior: "steer" })
        .catch(
          (e) =>
            new PromptFailedError({
              reason: e instanceof Error ? e.message : String(e),
              cause: e,
            }),
        );
      if (prompted instanceof Error) return orpcErrors.badRequest(prompted);
    }),
    abort: os.agentSession.abort.handler(async ({ input, context }) => {
      context.logger.info({
        event: "abort",
        sessionId: input.sessionId,
      });
      const session = context.sessions.get(input.sessionId);
      if (session instanceof Error) return orpcErrors.badRequest(session);
      const aborted = await session.abort().catch(
        (e) =>
          new AbortFailedError({
            reason: e instanceof Error ? e.message : String(e),
            cause: e,
          }),
      );
      if (aborted instanceof Error) return orpcErrors.badRequest(aborted);
    }),
    close: os.agentSession.close.handler(({ input, context }) => {
      context.logger.info({
        event: "agentSession.close",
        sessionId: input.sessionId,
      });
      const closed = context.sessions.close(input.sessionId);
      if (closed instanceof Error) return orpcErrors.badRequest(closed);
    }),
  },
};

import { contract, haloProtocolVersion } from "@get-halo/shared/contract";
import { implement } from "@orpc/server";
import { appRouter, type AppRouterContext } from "./app/appRouter.js";
import {
  pluginsRouter,
  type PluginsRouterContext,
} from "./plugins/pluginsRouter.js";
import {
  sessionsRouter,
  type SessionsRouterContext,
} from "./sessions/sessionsRouter.js";
import {
  workspaceRouter,
  type WorkspaceRouterContext,
} from "./workspace/workspaceRouter.js";

export type HaloContext = AppRouterContext &
  WorkspaceRouterContext &
  SessionsRouterContext &
  PluginsRouterContext;

const server = implement(contract.server);

const serverRouter = server.router({
  info: server.info.handler(() => ({ protocolVersion: haloProtocolVersion })),
});

export const haloRpcRouter = {
  ...appRouter,
  server: serverRouter,
  workspace: workspaceRouter,
  sessions: sessionsRouter,
  plugins: pluginsRouter,
};

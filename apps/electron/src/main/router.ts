import { appRouter, type AppRouterContext } from "./app/appRouter.js";
import {
  pluginsRouter,
  type PluginsRouterContext,
} from "./plugins/pluginsRouter.js";
import {
  sessionsRouter,
  type SessionsRouterContext,
} from "./agent/sessionsRouter.js";
import {
  workspaceRouter,
  type WorkspaceRouterContext,
} from "./workspace/workspaceRouter.js";

export type HaloContext = AppRouterContext &
  WorkspaceRouterContext &
  SessionsRouterContext &
  PluginsRouterContext;

export const haloRpcRouter = {
  ...appRouter,
  workspace: workspaceRouter,
  sessions: sessionsRouter,
  plugins: pluginsRouter,
};

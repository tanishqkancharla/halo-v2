import { appRouter, type AppRouterContext } from "./app/appRouter.js";
import {
  integrationsRouter,
  type IntegrationsRouterContext,
} from "./integrations/integrationsRouter.js";
import type { PluginService } from "./plugins/PluginService.js";
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
  IntegrationsRouterContext &
  PluginsRouterContext;

export function haloRpcRouter(plugins: PluginService) {
  return {
    ...appRouter,
    workspace: workspaceRouter,
    sessions: sessionsRouter,
    integrations: integrationsRouter,
    plugins: { ...pluginsRouter, servers: plugins.lazyRouter },
  };
}

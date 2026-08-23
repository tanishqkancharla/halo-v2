import type { AnyRouter, RouterClient } from "@orpc/server";
import * as errore from "errore";
import {
  createContext,
  createElement,
  useContext,
  type ReactNode,
} from "react";

export type PluginServerValue = {
  pluginId: string;
  server?: RouterClient<AnyRouter>;
};

export const PluginServerProviderContext = createContext<
  PluginServerValue | undefined
>(undefined);

export function PluginServerProvider(args: {
  pluginId: string;
  server?: RouterClient<AnyRouter>;
  children: ReactNode;
}) {
  return createElement(
    PluginServerProviderContext.Provider,
    { value: { pluginId: args.pluginId, server: args.server } },
    args.children,
  );
}

export class PluginServerMissingError extends errore.createTaggedError({
  name: "PluginServerMissingError",
  message: "usePluginServer must run inside a Halo plugin view",
}) {}

// Import the plugin router as a type only: import type router from "./server.ts"
export function usePluginServer<T extends AnyRouter>(): RouterClient<T> {
  const runtime = useContext(PluginServerProviderContext);
  if (runtime === undefined) throw new PluginServerMissingError();
  if (runtime.server === undefined) throw new PluginServerMissingError();
  // SAFETY: this view is compiled against router T; the host client is that router.
  return runtime.server as RouterClient<T>;
}

import type { AnyRouter, RouterClient } from "@orpc/server";
import * as errore from "errore";
import {
  createContext,
  createElement,
  useContext,
  type ReactNode,
} from "react";

export type PluginRuntimeValue = {
  pluginId: string;
  server?: RouterClient<AnyRouter>;
};

export const PluginRuntimeContext = createContext<
  PluginRuntimeValue | undefined
>(undefined);

export function PluginRuntimeProvider(args: {
  pluginId: string;
  server?: RouterClient<AnyRouter>;
  children: ReactNode;
}) {
  return createElement(
    PluginRuntimeContext.Provider,
    { value: { pluginId: args.pluginId, server: args.server } },
    args.children,
  );
}

export class PluginRuntimeMissingError extends errore.createTaggedError({
  name: "PluginRuntimeMissingError",
  message: "usePluginServer must run inside a Halo plugin view",
}) {}

// Import the plugin router as a type only: import type router from "./server.ts"
export function usePluginServer<T extends AnyRouter>(): RouterClient<T> {
  const runtime = useContext(PluginRuntimeContext);
  if (runtime === undefined) throw new PluginRuntimeMissingError();
  if (runtime.server === undefined) throw new PluginRuntimeMissingError();
  // SAFETY: this view is compiled against router T; the host client is that router.
  return runtime.server as RouterClient<T>;
}

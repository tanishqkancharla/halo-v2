import { implement } from "@orpc/server";
import { contract } from "@get-halo/shared/contract";
import type { ExtensionHost } from "./ExtensionHost.js";

export type ExtensionsRouterContext = { extensions: ExtensionHost };
const os = implement(contract.extensions).$context<ExtensionsRouterContext>();

export const extensionsRouter = os.router({
  list: os.list.handler(({ context }) => context.extensions.list()),
  reload: os.reload.handler(({ context }) => context.extensions.reload()),
});

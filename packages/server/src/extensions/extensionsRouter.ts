import { implement, os as baseOs, type } from "@orpc/server";
import { contract } from "@get-halo/shared/contract";
import { orpcErrors } from "../orpcErrors.js";
import type { ExtensionHost } from "./ExtensionHost.js";
import { ExtensionToolsError, type ExtensionTools } from "./ExtensionTools.js";

export type ExtensionsRouterContext = {
  extensions: ExtensionHost;
  extensionTools: ExtensionTools;
  extensionApprovalAllowed: boolean;
};
const os = implement(contract.extensions).$context<ExtensionsRouterContext>();

export const extensionsRouter = os.router({
  list: os.list.handler(({ context }) => context.extensions.list()),
  reload: os.reload.handler(({ context }) => context.extensions.reload()),
  tools: {
    add: os.tools.add.handler(async ({ context, input }) => {
      const result = await context.extensionTools.add(input.id, input.paths);
      if (result instanceof Error) return orpcErrors.badRequest(result);
      return result;
    }),
    check: os.tools.check.handler(async ({ context, input }) => {
      const result = await context.extensionTools.check(input.id);
      if (result instanceof Error) return orpcErrors.badRequest(result);
      return result;
    }),
    requests: os.tools.requests.handler(({ context, signal }) =>
      context.extensionTools.requests(signal),
    ),
    decide: os.tools.decide.handler(async ({ context, input }) => {
      if (!context.extensionApprovalAllowed)
        return orpcErrors.badRequest(
          new ExtensionToolsError({
            detail: "Approve extension access in Halo.",
          }),
        );
      const result = await context.extensionTools.decide(
        input.id,
        input.paths,
        input.action,
      );
      if (result instanceof Error) return orpcErrors.badRequest(result);
      return result;
    }),
  },
});

const toolOs = baseOs.$context<{
  extensionTools: ExtensionTools;
  extensionId: string;
}>();
export const extensionToolRouter = {
  invoke: toolOs
    .input(type<{ path: string; input: unknown }>())
    .handler(async ({ input, context, signal }) => {
      const result = await context.extensionTools.invoke(context.extensionId, {
        path: input.path,
        args: input.input,
        signal,
      });
      if (result instanceof Error) throw orpcErrors.badRequest(result);
      return result;
    }),
};

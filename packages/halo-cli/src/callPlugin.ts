import * as errore from "errore";
import type { PluginCallInput, PluginJson } from "./parsePluginArgv.js";

export class PluginCallError extends errore.createTaggedError({
  name: "PluginCallError",
  message: "Plugin call failed: $detail",
}) {}

export type PluginNode = {
  (input?: PluginJson): Promise<PluginJson | undefined>;
  [name: string]: PluginNode | undefined;
};

export type PluginRouter = {
  [name: string]: PluginNode | undefined;
};

export async function callPluginProcedure(args: {
  client: { plugins: PluginRouter };
  id: string;
  path: string[];
  input: PluginCallInput;
}) {
  let current = args.client.plugins[args.id];
  if (current === undefined) {
    return new PluginCallError({
      detail: `plugin '${args.id}' is not mounted`,
    });
  }

  for (const segment of args.path) {
    current = current[segment];
    if (current === undefined) {
      return new PluginCallError({
        detail: `no procedure at ${args.path.join(".")}`,
      });
    }
  }

  return current(args.input).catch(
    (e) =>
      new PluginCallError({
        detail: e instanceof Error ? e.message : String(e),
        cause: e,
      }),
  );
}

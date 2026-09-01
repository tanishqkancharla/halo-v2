import * as errore from "errore";

export const reservedPluginCommands = [
  "new",
  "build",
  "types",
  "list",
  "check",
  "grant",
  "call",
] as const;

export type PluginJson =
  | string
  | number
  | boolean
  | PluginJson[]
  | { readonly [key: string]: PluginJson };

type PluginCallInput = PluginJson | undefined;

export type HaloPluginArgv =
  | { kind: "create"; id: string }
  | { kind: "build" }
  | { kind: "types" }
  | {
      kind: "call";
      id: string;
      path: string[];
      input: PluginCallInput;
    };

export class PluginArgvError extends errore.createTaggedError({
  name: "PluginArgvError",
  message: "halo plugin: $detail",
}) {}

export function parsePluginArgv(
  argv: string[],
  inputJson: string | undefined,
): HaloPluginArgv | PluginArgvError {
  const first = argv[0];
  if (first === undefined) {
    return new PluginArgvError({
      detail:
        "expected new <id>, list, build, types, check <id>, grant <id>, or <id> <endpoint>",
    });
  }

  if (first === "new") {
    const id = argv[1];
    if (id === undefined) {
      return new PluginArgvError({ detail: "missing plugin id" });
    }
    return { kind: "create", id };
  }

  if (first === "build") return { kind: "build" };
  if (first === "types") return { kind: "types" };

  const rest = argv.slice(1);
  if (rest.length === 0) {
    return new PluginArgvError({
      detail: `missing procedure path for plugin '${first}'`,
    });
  }

  const input = parseInputJson(inputJson);
  if (input instanceof PluginArgvError) return input;

  const dotted = rest[0];
  const path =
    rest.length === 1 && dotted !== undefined && dotted.includes(".")
      ? dotted.split(".")
      : rest;
  return { kind: "call", id: first, path, input };
}

function parseInputJson(inputJson: string | undefined) {
  if (inputJson === undefined) return undefined;
  return errore.try({
    try: () => {
      // SAFETY: JSON.parse is untyped; the value is the procedure payload.
      return JSON.parse(inputJson) as PluginJson;
    },
    catch: (e) =>
      new PluginArgvError({
        detail: "--input must be JSON",
        cause: e,
      }),
  });
}

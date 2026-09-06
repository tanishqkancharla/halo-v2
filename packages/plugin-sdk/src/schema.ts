import { Type, type Static, type TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import * as errore from "errore";

export { Type, type Static };

// errore reserves $name on tagged errors.
export class SchemaParseError extends errore.createTaggedError({
  name: "SchemaParseError",
  message: "Failed to parse $document: $detail",
}) {}

export function parseVersioned<S extends TSchema>(args: {
  name: string;
  schema: S;
  value: unknown;
}): SchemaParseError | Static<S> {
  if (Value.Check(args.schema, args.value)) return args.value;
  const first = [...Value.Errors(args.schema, args.value)][0];
  const path = first === undefined ? "" : first.path;
  const message = first === undefined ? "invalid" : first.message;
  return new SchemaParseError({
    document: args.name,
    detail: path.length === 0 ? message : `${path} ${message}`,
  });
}

export const paneTargetSchema = Type.Object(
  {
    paneId: Type.String({ minLength: 1 }),
    params: Type.Record(Type.String(), Type.String()),
  },
  { additionalProperties: false },
);
export type PaneTarget = Static<typeof paneTargetSchema>;

export const sidebarEntitySchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    title: Type.String({ minLength: 1 }),
    target: paneTargetSchema,
  },
  { additionalProperties: false },
);
export type SidebarEntity = Static<typeof sidebarEntitySchema>;

export const paneDefinitionSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    title: Type.String({ minLength: 1 }),
    content: Type.Object(
      {
        kind: Type.Literal("webview"),
        entry: Type.String({ minLength: 1 }),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);
export type PaneDefinition = Static<typeof paneDefinitionSchema>;

export const pluginContributionsSchema = Type.Object(
  {
    sidebar: Type.Array(sidebarEntitySchema),
    panes: Type.Array(paneDefinitionSchema),
  },
  { additionalProperties: false },
);
export type PluginContributions = Static<typeof pluginContributionsSchema>;

export const haloManifestV1 = Type.Object({
  version: Type.Literal(1),
  name: Type.String({ minLength: 1 }),
  description: Type.Optional(Type.String()),
  view: Type.Optional(Type.String({ minLength: 1 })),
  server: Type.Optional(Type.String({ minLength: 1 })),
  contributes: Type.Optional(pluginContributionsSchema),
  capabilities: Type.Optional(
    Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true }),
  ),
});

// A later version is a new object in this union. Add an `up` only when the
// host must normalize to latest.
export const haloManifestSchema = Type.Union([haloManifestV1]);
export type HaloManifest = Static<typeof haloManifestV1>;

export const pluginPackageJsonSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  halo: haloManifestSchema,
});
export type PluginPackageJson = Static<typeof pluginPackageJsonSchema>;

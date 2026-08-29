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

export const haloManifestV1 = Type.Object({
  version: Type.Literal(1),
  name: Type.String({ minLength: 1 }),
  description: Type.Optional(Type.String()),
  view: Type.Optional(Type.String({ minLength: 1 })),
  server: Type.Optional(Type.String({ minLength: 1 })),
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

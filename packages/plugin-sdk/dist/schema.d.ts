import { Type, type Static, type TSchema } from "@sinclair/typebox";
import * as errore from "errore";
export { Type, type Static };
declare const SchemaParseError_base: errore.FactoryTaggedErrorClass<"SchemaParseError", "Failed to parse $document: $detail", Error>;
export declare class SchemaParseError extends SchemaParseError_base {
}
export declare function parseVersioned<S extends TSchema>(args: {
    name: string;
    schema: S;
    value: unknown;
}): SchemaParseError | Static<S>;
export declare const haloManifestV1: import("@sinclair/typebox").TObject<{
    version: import("@sinclair/typebox").TLiteral<1>;
    name: import("@sinclair/typebox").TString;
    description: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
    view: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
    server: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
    capabilities: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TArray<import("@sinclair/typebox").TString>>;
}>;
export declare const haloManifestSchema: import("@sinclair/typebox").TObject<{
    version: import("@sinclair/typebox").TLiteral<1>;
    name: import("@sinclair/typebox").TString;
    description: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
    view: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
    server: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
    capabilities: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TArray<import("@sinclair/typebox").TString>>;
}>;
export type HaloManifest = Static<typeof haloManifestV1>;
export declare const pluginPackageJsonSchema: import("@sinclair/typebox").TObject<{
    name: import("@sinclair/typebox").TString;
    halo: import("@sinclair/typebox").TObject<{
        version: import("@sinclair/typebox").TLiteral<1>;
        name: import("@sinclair/typebox").TString;
        description: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
        view: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
        server: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
        capabilities: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TArray<import("@sinclair/typebox").TString>>;
    }>;
}>;
export type PluginPackageJson = Static<typeof pluginPackageJsonSchema>;

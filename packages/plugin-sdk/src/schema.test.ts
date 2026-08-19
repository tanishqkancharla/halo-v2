import { describe, expect, test } from "vitest";
import {
  haloManifestSchema,
  parseVersioned,
  SchemaParseError,
} from "@halo/plugin-sdk/schema";

describe("parseVersioned", () => {
  test("accepts version 1 with a name", () => {
    const parsed = parseVersioned({
      name: "halo",
      schema: haloManifestSchema,
      value: { version: 1, name: "Calendar" },
    });
    if (parsed instanceof Error) throw parsed;
    expect(parsed.version).toBe(1);
    expect(parsed.name).toBe("Calendar");
  });

  test("rejects a missing version", () => {
    const parsed = parseVersioned({
      name: "halo",
      schema: haloManifestSchema,
      value: { name: "Calendar" },
    });
    expect(parsed).toBeInstanceOf(SchemaParseError);
  });

  test("rejects version 2", () => {
    const parsed = parseVersioned({
      name: "halo",
      schema: haloManifestSchema,
      value: { version: 2, name: "Calendar" },
    });
    expect(parsed).toBeInstanceOf(SchemaParseError);
  });

  test("ignores extra keys", () => {
    const parsed = parseVersioned({
      name: "halo",
      schema: haloManifestSchema,
      value: { version: 1, name: "Calendar", extra: "ok" },
    });
    if (parsed instanceof Error) throw parsed;
    expect(parsed.version).toBe(1);
    expect(parsed.name).toBe("Calendar");
  });

  test("rejects an empty name", () => {
    const parsed = parseVersioned({
      name: "halo",
      schema: haloManifestSchema,
      value: { version: 1, name: "" },
    });
    expect(parsed).toBeInstanceOf(SchemaParseError);
  });

  test("rejects an empty view path", () => {
    const parsed = parseVersioned({
      name: "halo",
      schema: haloManifestSchema,
      value: { version: 1, name: "Calendar", view: "" },
    });
    expect(parsed).toBeInstanceOf(SchemaParseError);
  });

  test("rejects an empty server path", () => {
    const parsed = parseVersioned({
      name: "halo",
      schema: haloManifestSchema,
      value: { version: 1, name: "Calendar", server: "" },
    });
    expect(parsed).toBeInstanceOf(SchemaParseError);
  });

  test("rejects a missing halo object", () => {
    const parsed = parseVersioned({
      name: "halo",
      schema: haloManifestSchema,
      value: undefined,
    });
    expect(parsed).toBeInstanceOf(SchemaParseError);
  });

  test("rejects a non-object halo value", () => {
    const parsed = parseVersioned({
      name: "halo",
      schema: haloManifestSchema,
      value: "Calendar",
    });
    expect(parsed).toBeInstanceOf(SchemaParseError);
  });

  test("accepts optional description, view, and server", () => {
    const parsed = parseVersioned({
      name: "halo",
      schema: haloManifestSchema,
      value: {
        version: 1,
        name: "Notes",
        description: "Scratch notes.",
        view: "./view.tsx",
        server: "./server.ts",
      },
    });
    if (parsed instanceof Error) throw parsed;
    expect(parsed).toEqual({
      version: 1,
      name: "Notes",
      description: "Scratch notes.",
      view: "./view.tsx",
      server: "./server.ts",
    });
  });
});

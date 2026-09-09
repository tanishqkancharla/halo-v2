import { readFile } from "node:fs/promises";
import type { Plugin } from "vite";
import * as errore from "errore";

class PiSchemaReadError extends errore.createTaggedError({
  name: "PiSchemaReadError",
  message: "Could not package Pi's session database schema",
}) {}

export function copyPiSchemaPlugin(): Plugin {
  return {
    name: "copy-pi-schema",
    async generateBundle() {
      const schema = await readFile(
        new URL(
          "./sqlite/migrations/001_initial.sql",
          import.meta.resolve("@earendil-works/pi-session-backend-sqlite-node"),
        ),
        "utf8",
      ).catch((cause) => new PiSchemaReadError({ cause }));
      if (schema instanceof Error) throw schema;
      // Pi resolves this asset beside import.meta.url, which becomes main.cjs after bundling.
      this.emitFile({
        type: "asset",
        fileName: "migrations/001_initial.sql",
        source: schema,
      });
    },
  };
}

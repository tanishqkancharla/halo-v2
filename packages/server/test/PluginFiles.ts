import path from "node:path";
import type { PluginPackageJson } from "@halo/plugin-sdk/schema";
import * as errore from "errore";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

class PluginPackageReadError extends errore.createTaggedError({
  name: "PluginPackageReadError",
  message: "Could not parse test plugin package in '$directory'",
}) {}

export class PluginFiles {
  constructor(
    private readonly options: {
      directory: string;
      files: {
        read(path: string): Promise<Buffer>;
        write(input: {
          path: string;
          content: string | Uint8Array;
        }): Promise<void>;
      };
    },
  ) {}

  async write(files: Record<string, string>) {
    for (const [file, content] of Object.entries(files)) {
      await this.options.files.write({
        path: path.join(this.options.directory, file),
        content,
      });
    }
  }

  async updateManifest(fields: Record<string, JsonValue>) {
    const raw = await this.options.files.read(
      path.join(this.options.directory, "package.json"),
    );
    const packageJson = errore.try({
      // SAFETY: plugins.create writes the package and halo objects; only their fields are patched by this helper.
      try: () => JSON.parse(raw.toString("utf8")) as PluginPackageJson,
      catch: (cause) =>
        new PluginPackageReadError({
          directory: this.options.directory,
          cause,
        }),
    });
    if (packageJson instanceof Error) throw packageJson;
    await this.write({
      "package.json": JSON.stringify(
        { ...packageJson, halo: { ...packageJson.halo, ...fields } },
        undefined,
        2,
      ),
    });
  }
}

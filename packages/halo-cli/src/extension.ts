import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { scaffoldExtension } from "@get-halo/extension-tools/scaffold";
import { Cli, z } from "incur";
import * as errore from "errore";
import { connectHalo } from "./connectHalo.js";

const exec = promisify(execFile);

class ExtensionCommandError extends errore.createTaggedError({
  name: "ExtensionCommandError",
  message: "Extension command failed: $detail",
}) {}

const env = z.object({
  HALO_RPC_FILE: z.string().optional(),
  HALO_USER_DATA: z.string().optional(),
});

export const extension = Cli.create("extension", {
  description: "Create and load standalone workspace extensions",
})
  .command("new", {
    description: "Scaffold an extension and install its dependencies",
    args: z.object({ id: z.string().regex(/^[a-z][a-z0-9-]*$/) }),
    env,
    async run(c) {
      const connected = await connectHalo(c.env);
      if (connected instanceof Error) {
        return c.error({ code: "NOT_RUNNING", message: connected.message });
      }
      const workspace = await connected.client.workspace
        .get()
        .catch(
          (cause) =>
            new ExtensionCommandError({ detail: "read workspace", cause }),
        );
      if (workspace instanceof Error) {
        return c.error({ code: "EXTENSION", message: workspace.message });
      }
      if (workspace === undefined) {
        return c.error({
          code: "NO_WORKSPACE",
          message: "Open a workspace first",
        });
      }
      const created = await createExtension(workspace.workspaceRoot, c.args.id);
      if (created instanceof Error) {
        return c.error({ code: "EXTENSION", message: created.message });
      }
      return c.ok(created);
    },
  })
  .command("reload", {
    description:
      "Discover built extensions and stop servers for deleted extensions",
    env,
    async run(c) {
      const connected = await connectHalo(c.env);
      if (connected instanceof Error) {
        return c.error({ code: "NOT_RUNNING", message: connected.message });
      }
      const reloaded = await connected.client.extensions
        .reload()
        .catch(
          (cause) =>
            new ExtensionCommandError({ detail: "reload extensions", cause }),
        );
      if (reloaded instanceof Error) {
        return c.error({ code: "EXTENSION", message: reloaded.message });
      }
      return c.ok(reloaded);
    },
  });

async function createExtension(workspaceRoot: string, id: string) {
  const parent = join(workspaceRoot, ".halo", "extensions");
  const made = await mkdir(parent, { recursive: true }).catch(
    (cause) =>
      new ExtensionCommandError({
        detail: "create extensions directory",
        cause,
      }),
  );
  if (made instanceof Error) return made;

  const directory = join(parent, id);
  const scaffolded = await scaffoldExtension({
    directory,
    name: id,
  });
  if (scaffolded instanceof Error) return scaffolded;

  const installed = await exec(
    "npm",
    [
      "install",
      "--workspaces=false",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
    ],
    { cwd: directory },
  ).catch(
    (cause) =>
      new ExtensionCommandError({
        detail: `install dependencies: ${cause.message}`,
        cause,
      }),
  );
  if (installed instanceof Error) return installed;
  return { id, directory };
}
